// Club crest resolution: TheSportsDB (free tier, key "3") at runtime,
// cached in localStorage, with a generated initials badge as fallback.
const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';
const CACHE_KEY = 'fcsim.badges';

let cache = null;
function loadCache() {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
  catch { cache = {}; }
  return cache;
}
function persist() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full */ }
}

const inflight = new Map();
// Failures are remembered for this session only, never persisted: a blip in
// the network must not permanently blank a crest on every later visit.
const missed = new Set();

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Drop punctuation and the club/league boilerplate that differs between
// sources ("FC", "SAD", sponsor names) so names compare on their real words.
const NOISE = /\b(fc|cf|afc|ac|as|sc|sv|cd|ud|us|sd|rc|ss|ssc|aa|bk|if|nk|hnk|fk|sk|club|calcio|futebol|football|soccer|de|do|da|the|of|sad|u23|b)\b/g;
function norm(s) {
  return strip(s).replace(/[.'’\-–—/()]/g, ' ').replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
}
function tokens(s) { return new Set(norm(s).split(' ').filter((w) => w.length > 2)); }
// Fraction of the shorter name's distinctive words that both names share.
function overlap(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  return hit / Math.min(A.size, B.size);
}

// Try each candidate image URL in turn, keeping the last-resort fallback if
// all of them fail. TheSportsDB does not host every size for every asset.
function loadInto(el, urls, fallback) {
  let i = 0;
  const next = () => {
    if (i >= urls.length) {
      if (fallback) { el.onerror = null; el.src = fallback; } else { el.remove(); }
      return;
    }
    el.onerror = next;
    el.src = urls[i++];
  };
  next();
}

// A name search can return several clubs sharing a word ("Leuven", "United").
// Prefer football clubs from the right country, then the closest name match,
// so a short local name never resolves to a foreign club's crest.
function pickTeam(teams, club) {
  const soccer = (teams || []).filter((t) => t.strSport === 'Soccer' && t.strBadge);
  if (!soccer.length) return null;
  const want = norm(club.name);
  const country = club.country ? strip(club.country) : null;
  const scored = soccer.map((t) => {
    const name = norm(t.strTeam || '');
    const alts = (t.strTeamAlternate || '').split(',').map((a) => norm(a));
    let s = 0;
    if (country && strip(t.strCountry || '') === country) s += 10;
    if (name === want || alts.includes(want)) s += 8;
    else s += Math.max(overlap(club.name, t.strTeam || ''), ...alts.map((a) => (a ? overlap(want, a) : 0))) * 6;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s);
  // Require some real name agreement, not just a shared country.
  return scored[0].s >= 3 ? scored[0].t : null;
}

// Resolve a badge URL for a club; returns null when unavailable.
export async function resolveBadge(club) {
  const c = loadCache();
  const key = club.tsdbTeamId ? `id:${club.tsdbTeamId}` : `n:${club.name}`;
  if (key in c) return c[key];
  if (missed.has(key)) return null;
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    let badge = null;
    try {
      if (club.tsdbTeamId) {
        const res = await fetch(`${TSDB}/lookupteam.php?id=${club.tsdbTeamId}`, { signal: AbortSignal.timeout(6000) });
        if (res.ok) badge = (await res.json()).teams?.[0]?.strBadge || null;
      }
      if (!badge) {
        // Search the full name, then a cleaned-up form ("Nottingham Forest FC"
        // → "nottingham forest"), which matches more of TheSportsDB's entries.
        for (const q of [club.name, norm(club.name)]) {
          if (!q) continue;
          const res = await fetch(`${TSDB}/searchteams.php?t=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) continue;
          const team = pickTeam((await res.json()).teams, club);
          if (team?.strBadge) { badge = team.strBadge; break; }
        }
      }
    } catch { /* offline or blocked — treated as a miss, retried next session */ }
    if (badge) { c[key] = badge; persist(); } else { missed.add(key); }
    inflight.delete(key);
    return badge;
  })();
  inflight.set(key, p);
  return p;
}

// TheSportsDB hosted trophy image for a league, when the league id is known.
export async function resolveTrophyImage(tsdbLeagueId) {
  if (!tsdbLeagueId) return null;
  const c = loadCache();
  const key = `trophy:${tsdbLeagueId}`;
  if (key in c) return c[key];
  let img = null;
  try {
    const res = await fetch(`${TSDB}/lookupleague.php?id=${tsdbLeagueId}`, { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const json = await res.json();
      img = json.leagues?.[0]?.strTrophy || null;
    }
  } catch { /* fall through */ }
  c[key] = img;
  persist();
  return img;
}

// Name → TheSportsDB league id, via the full league list (fetched once,
// cached as a name→id map). Covers domestic leagues, cups and continental
// competitions, so trophies can show real hosted artwork where it exists.
let leagueMapPromise = null;
async function leagueIdMap() {
  const c = loadCache();
  if (c['leaguemap']) return c['leaguemap'];
  if (leagueMapPromise) return leagueMapPromise;
  leagueMapPromise = (async () => {
    const map = {};
    try {
      const res = await fetch(`${TSDB}/all_leagues.php`, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const json = await res.json();
        for (const l of json.leagues || []) {
          if (l.strSport === 'Soccer' && l.strLeague) map[norm(l.strLeague)] = Number(l.idLeague);
        }
      }
    } catch { /* offline — empty map, retried next session */ }
    if (Object.keys(map).length) { c['leaguemap'] = map; persist(); }
    return map;
  })();
  return leagueMapPromise;
}

// Leagues are named inconsistently between sources ("Belgian Pro League" vs
// "Belgian First Division A"), so when the country is known, search only that
// country's leagues and take the best word-overlap match. The global name map
// is the fallback for competitions with no single country (continental cups).
async function leagueIdByName(name, country) {
  if (country) {
    const c = loadCache();
    const ckey = `lgcountry:${country}`;
    let list = c[ckey];
    if (!list) {
      try {
        const res = await fetch(`${TSDB}/search_all_leagues.php?c=${encodeURIComponent(country)}&s=Soccer`,
          { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const json = await res.json();
          list = (json.countries || json.leagues || [])
            .map((l) => ({ id: Number(l.idLeague), name: l.strLeague || '', alt: l.strLeagueAlternate || '' }))
            .filter((l) => l.id && l.name);
          if (list.length) { c[ckey] = list; persist(); }
        }
      } catch { /* fall through to the global map */ }
    }
    if (list?.length) {
      let best = null, bestScore = 0;
      for (const l of list) {
        const s = Math.max(overlap(name, l.name), l.alt ? overlap(name, l.alt) : 0);
        if (s > bestScore) { bestScore = s; best = l; }
      }
      // A country's top flight is usually its first listed league; accept it
      // when nothing matches by name but only one league exists.
      if (best && bestScore >= 0.5) return best.id;
      if (list.length === 1) return list[0].id;
    }
  }
  const map = await leagueIdMap();
  const n = norm(name);
  if (map[n]) return map[n];
  let best = null, bestScore = 0;
  for (const [k, v] of Object.entries(map)) {
    const s = overlap(n, k);
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return bestScore >= 0.6 ? best : null;
}

// League crest (badge) by TheSportsDB id or league name, cached.
export async function resolveLeagueBadge(leagueName, tsdbLeagueId, country) {
  const c = loadCache();
  const key = `lbadge:${tsdbLeagueId || leagueName}`;
  if (key in c) return c[key];
  if (missed.has(key)) return null;
  let badge = null;
  try {
    const id = tsdbLeagueId || await leagueIdByName(leagueName, country);
    if (id) {
      const res = await fetch(`${TSDB}/lookupleague.php?id=${id}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        badge = json.leagues?.[0]?.strBadge || json.leagues?.[0]?.strLogo || null;
      }
    }
  } catch { /* offline — treated as a miss, retried next session */ }
  if (badge) { c[key] = badge; persist(); } else { missed.add(key); }
  return badge;
}

// Small league crest <img>; hidden until (and unless) the crest resolves.
export function leagueBadgeImg(leagueName, tsdbLeagueId, cls = 'lg-badge', country) {
  const id = 'l' + Math.random().toString(36).slice(2, 9);
  queueMicrotask(async () => {
    const url = await resolveLeagueBadge(leagueName, tsdbLeagueId, country);
    const el = document.getElementById(id);
    if (el && url) {
      el.style.display = '';
      loadInto(el, [url + '/tiny', url + '/small', url], null);
    }
  });
  return `<img id="${id}" class="${cls}" style="display:none" alt="" loading="lazy">`;
}

export async function resolveTrophyImageByName(competitionName) {
  const c = loadCache();
  const key = `trophyname:${competitionName}`;
  if (key in c) return c[key];
  const map = await leagueIdMap();
  const name = competitionName.toLowerCase();
  // Exact match, then a contains-match either way round.
  let id = map[name] ?? null;
  if (!id) {
    for (const [k, v] of Object.entries(map)) {
      if (k.includes(name) || name.includes(k)) { id = v; break; }
    }
  }
  const img = id ? await resolveTrophyImage(id) : null;
  c[key] = img;
  persist();
  return img;
}

// Generated initials badge (SVG data URI) in club colours.
export function initialsBadge(name, colors) {
  const initials = name
    .replace(/\(.*?\)/g, '')
    .split(/[\s-]+/)
    .filter((w) => w && !/^(fc|cf|afc|ac|as|cd|sc|sd|ud|us|club|de|do|da|the|of)$/i.test(w))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();
  const c1 = colors?.[0] || pickColor(name, 0);
  const c2 = colors?.[1] || '#ffffff';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 110">` +
    `<path d="M50 4 L92 18 V58 C92 84 72 100 50 108 C28 100 8 84 8 58 V18 Z" fill="${c1}" stroke="${c2}" stroke-width="4"/>` +
    `<text x="50" y="63" font-family="system-ui,sans-serif" font-size="${initials.length > 2 ? 26 : 32}" font-weight="700" fill="${c2}" text-anchor="middle">${initials}</text>` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const PALETTE = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#2c3e50', '#7f0000', '#004d98', '#1a5c1a'];
function pickColor(name, i) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[(h + i) % PALETTE.length];
}

// Render helper: an <img> that swaps to the generated badge on failure,
// and upgrades to the real crest when resolution completes.
export function badgeImg(club, cls = 'badge-img') {
  const fallback = initialsBadge(club.name, club.colors);
  const id = 'b' + Math.random().toString(36).slice(2, 9);
  queueMicrotask(async () => {
    const url = await resolveBadge(club);
    const el = document.getElementById(id);
    if (el && url) loadInto(el, [url + '/small', url], fallback);
  });
  return `<img id="${id}" class="${cls}" src="${fallback}" alt="" loading="lazy">`;
}
