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

// Resolve a badge URL for a club; returns null when unavailable.
export async function resolveBadge(club) {
  const c = loadCache();
  const key = club.tsdbTeamId ? `id:${club.tsdbTeamId}` : `n:${club.name}`;
  if (key in c) return c[key];
  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    let badge = null;
    try {
      const url = club.tsdbTeamId
        ? `${TSDB}/lookupteam.php?id=${club.tsdbTeamId}`
        : `${TSDB}/searchteams.php?t=${encodeURIComponent(club.name)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        const team = json.teams?.find((t) => t.strSport === 'Soccer') || json.teams?.[0];
        if (team?.strBadge) badge = team.strBadge + '/small';
      }
    } catch { /* offline or blocked — fall through to null */ }
    c[key] = badge;
    persist();
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
          if (l.strSport === 'Soccer') map[l.strLeague.toLowerCase()] = Number(l.idLeague);
        }
      }
    } catch { /* offline — empty map, retried next session */ }
    if (Object.keys(map).length) { c['leaguemap'] = map; persist(); }
    return map;
  })();
  return leagueMapPromise;
}

async function leagueIdByName(name) {
  const map = await leagueIdMap();
  const n = name.toLowerCase();
  if (map[n]) return map[n];
  for (const [k, v] of Object.entries(map)) {
    if (k.includes(n) || n.includes(k)) return v;
  }
  return null;
}

// League crest (badge) by TheSportsDB id or league name, cached.
export async function resolveLeagueBadge(leagueName, tsdbLeagueId) {
  const c = loadCache();
  const key = `lbadge:${tsdbLeagueId || leagueName}`;
  if (key in c) return c[key];
  let badge = null;
  try {
    const id = tsdbLeagueId || await leagueIdByName(leagueName);
    if (id) {
      const res = await fetch(`${TSDB}/lookupleague.php?id=${id}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = await res.json();
        badge = json.leagues?.[0]?.strBadge || json.leagues?.[0]?.strLogo || null;
      }
    }
  } catch { /* offline — fall through */ }
  c[key] = badge;
  persist();
  return badge;
}

// Small league crest <img>; hidden until (and unless) the crest resolves.
export function leagueBadgeImg(leagueName, tsdbLeagueId, cls = 'lg-badge') {
  const id = 'l' + Math.random().toString(36).slice(2, 9);
  queueMicrotask(async () => {
    const url = await resolveLeagueBadge(leagueName, tsdbLeagueId);
    const el = document.getElementById(id);
    if (el && url) {
      el.onerror = () => el.remove();
      el.src = url + '/tiny';
      el.style.display = '';
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
    if (el && url) {
      el.onerror = () => { el.onerror = null; el.src = fallback; };
      el.src = url;
    }
  });
  return `<img id="${id}" class="${cls}" src="${fallback}" alt="" loading="lazy">`;
}
