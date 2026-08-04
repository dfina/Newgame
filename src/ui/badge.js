// Club crest and competition crest resolution: TheSportsDB (free tier, key
// "3") at runtime, cached in localStorage, with a generated initials badge as
// the fallback.
//
// The reliable route is by id, not by name: a bare search for "Serie A" or
// "Hamburger SV" happily returns Serie D Girone A and a reserve side. So a
// competition is looked up by its curated id where the game ships one, and a
// club is looked for inside its own league's squad list before the open
// search is ever tried.
import { leagueId as curatedLeagueId, competitionId } from './tsdb-ids.js';

const TSDB = 'https://www.thesportsdb.com/api/v1/json/3';
// Versioned: a bumped key retires crests cached by an earlier, wronger matcher.
const CACHE_KEY = 'fcsim.badges.v4';

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

async function getJson(url, ms = 7000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ms) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// TheSportsDB has renamed these fields across API versions and still serves a
// mix; take whichever one this record happens to carry.
function imageOf(rec, kind = 'team') {
  if (!rec) return null;
  const keys = kind === 'team'
    ? ['strBadge', 'strTeamBadge', 'strLogo', 'strTeamLogo']
    : ['strBadge', 'strLeagueBadge', 'strLogo'];
  for (const k of keys) if (rec[k]) return rec[k];
  return null;
}

const strip = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Drop punctuation and the club/league boilerplate that differs between
// sources ("FC", "SAD", sponsor names) so names compare on their real words.
const NOISE = /\b(fc|cf|afc|ac|as|sc|sv|cd|ud|us|sd|rc|ss|ssc|aa|bk|if|nk|hnk|fk|sk|club|calcio|futebol|football|soccer|de|do|da|the|of|sad)\b/g;
function norm(s) {
  // Apostrophes are dropped rather than split on: "FC Rànger's" has to reduce
  // to "rangers", not to "ranger s", or nothing will ever match it.
  return strip(s).replace(/['’]/g, '').replace(/[.\-–—/()]/g, ' ')
    .replace(NOISE, ' ').replace(/\s+/g, ' ').trim();
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

// FIFA's country names and TheSportsDB's disagree often enough to break the
// one filter that keeps a Congolese club from wearing a Scottish crest.
const COUNTRY_ALIASES = {
  'congo dr': ['dr congo', 'democratic republic of the congo', 'congo democratic republic', 'congo-kinshasa'],
  'congo': ['republic of the congo', 'congo-brazzaville'],
  'united states': ['usa', 'united states of america', 'us'],
  'korea republic': ['south korea', 'korea south'],
  'korea dpr': ['north korea', 'korea north'],
  'ir iran': ['iran'],
  'côte d\'ivoire': ['ivory coast', 'cote divoire'],
  'cabo verde': ['cape verde'],
  'chinese taipei': ['taiwan'],
  'hong kong, china': ['hong kong'],
  'macau': ['macao'],
  'china pr': ['china'],
  'türkiye': ['turkey'],
  'czechia': ['czech republic'],
  'netherlands': ['holland'],
  'north macedonia': ['macedonia'],
  'eswatini': ['swaziland'],
  'timor-leste': ['east timor'],
  'curaçao': ['curacao'],
  'st kitts and nevis': ['saint kitts and nevis'],
  'st lucia': ['saint lucia'],
  'st vincent and the grenadines': ['saint vincent and the grenadines'],
  'bosnia and herzegovina': ['bosnia', 'bosnia-herzegovina'],
  'ireland': ['republic of ireland'],
  'chinese hong kong': ['hong kong']
};

// Do these two country names refer to the same association?
function sameCountry(a, b) {
  if (!a || !b) return false;
  const x = strip(a).trim(), y = strip(b).trim();
  if (x === y) return true;
  const known = (k, v) => (COUNTRY_ALIASES[k] || []).some((n) => strip(n) === v);
  return known(x, y) || known(y, x);
}

// Reserve, youth and B teams share almost every word with the senior side.
// The markers are matched only where they sit — as a suffix, or the Dutch
// "Jong" prefix — so B 36 Tórshavn is not mistaken for somebody's B team.
const RESERVE_SUFFIX = /\S+\s+(ii|iii|b|u\s?1[6-9]|u\s?2[0-3]|reserves?|youth|futures|academy|nxt)(\s|$)/;
const RESERVE_PREFIX = /^jong\s/;
function isReserve(name) {
  const n = strip(name).replace(/['’]/g, '').replace(/[.\-–—/()]/g, ' ').replace(/\s+/g, ' ').trim();
  return RESERVE_PREFIX.test(n) || RESERVE_SUFFIX.test(n);
}

// Names the game uses that TheSportsDB files under something else. These are
// alternative names for the same club, tried as extra search terms only.
const CLUB_ALIASES = {
  'Hamburger SV': ['Hamburg', 'Hamburger SV'],
  'RAAL La Louvière': ['RAAL La Louviere', 'La Louviere'],
  'Nottingham Forest': ['Nottingham Forest', 'Nottm Forest'],
  'Internazionale': ['Inter Milan', 'Internazionale'],
  'Bayern Munich': ['Bayern Munich', 'FC Bayern München'],
  'Borussia Mönchengladbach': ['Borussia Monchengladbach', 'Gladbach'],
  'Sporting CP': ['Sporting Lisbon', 'Sporting CP'],
  'Paris Saint-Germain': ['Paris Saint Germain', 'PSG'],
  'Manchester United': ['Manchester United', 'Man United'],
  'Manchester City': ['Manchester City', 'Man City'],
  'Wolverhampton Wanderers': ['Wolves', 'Wolverhampton'],
  'Brighton & Hove Albion': ['Brighton', 'Brighton Hove Albion'],
  'Union Saint-Gilloise': ['Union Saint-Gilloise', 'Royale Union Saint Gilloise'],
  'OH Leuven': ['Oud-Heverlee Leuven', 'OH Leuven'],
  'Standard Liège': ['Standard Liege', 'Standard Liège'],
  "FC Rànger's": ["FC Ranger's", 'Rangers', 'FC Rangers'],
  "Atlètic Club d'Escaldes": ["Atletic Club d'Escaldes", 'Atletic Escaldes'],
  "Inter Club d'Escaldes": ["Inter Club d'Escaldes", 'Inter Escaldes'],
  "Penya Encarnada d'Andorra": ['Penya Encarnada']
};

function searchTerms(club) {
  const terms = CLUB_ALIASES[club.name] ? [...CLUB_ALIASES[club.name]] : [];
  terms.unshift(club.name);
  // The stripped-down form ("Nottingham Forest FC" → "nottingham forest")
  // matches more of TheSportsDB's entries, so it is always worth a query of
  // its own — compare raw text, since every term normalises to itself.
  const cleaned = norm(club.name);
  if (cleaned && !terms.some((t) => t.toLowerCase() === cleaned)) terms.push(cleaned);
  return [...new Set(terms.filter(Boolean))];
}

// ---------------- club crests ----------------

// A name search can return several clubs sharing a word ("Leuven", "United").
// Prefer football clubs from the right country, then the closest name match,
// so a short local name never resolves to a foreign club's crest.
function pickTeam(teams, club) {
  let soccer = (teams || []).filter((t) => t.strSport === 'Soccer' && imageOf(t));
  if (!soccer.length) return null;
  const want = norm(club.name);
  const wantReserve = isReserve(club.name);
  // A club may only wear a crest from its own country. Glasgow Rangers and
  // Kinshasa's Rangers share a name and nothing else; without this, whichever
  // the search happened to rank first won. When the country is known and no
  // candidate comes from it, the honest answer is no crest at all.
  if (club.country) {
    soccer = soccer.filter((t) => sameCountry(club.country, t.strCountry));
    if (!soccer.length) return null;
  }
  const scored = soccer.map((t) => {
    const name = norm(t.strTeam || '');
    const alts = (t.strTeamAlternate || '').split(',').map((a) => norm(a)).filter(Boolean);
    let s = (name === want || alts.includes(want))
      ? 1.4
      : Math.max(overlap(club.name, t.strTeam || ''), ...alts.map((a) => overlap(want, a)), 0);
    // Never hand a senior side its reserve team's crest, or the other way round.
    if (isReserve(t.strTeam || '') !== wantReserve) s -= 1.2;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s);
  // Require real name agreement, not merely a shared country.
  return scored[0].s >= 0.6 ? scored[0].t : null;
}

// Every club in a TheSportsDB league, cached by league id. Matching a club
// against its own division's squad list is far safer than a global search.
async function leagueRoster(id) {
  const c = loadCache();
  const key = `roster:${id}`;
  if (key in c) return c[key];
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const json = await getJson(`${TSDB}/lookup_all_teams.php?id=${id}`, 9000);
    const list = (json?.teams || [])
      .map((t) => ({ name: t.strTeam || '', alt: t.strTeamAlternate || '', badge: imageOf(t) }))
      .filter((t) => t.name && t.badge);
    if (list.length) { c[key] = list; persist(); }
    inflight.delete(key);
    return list;
  })();
  inflight.set(key, p);
  return p;
}

function pickFromRoster(list, clubName) {
  const want = norm(clubName);
  const wantReserve = isReserve(clubName);
  let best = null, bestScore = 0;
  for (const t of list) {
    if (isReserve(t.name) !== wantReserve) continue;
    const alts = t.alt.split(',').map((a) => norm(a)).filter(Boolean);
    let s = (norm(t.name) === want || alts.includes(want))
      ? 1.6
      : Math.max(overlap(clubName, t.name), ...alts.map((a) => overlap(want, a)), 0);
    if (s > bestScore) { bestScore = s; best = t; }
  }
  return bestScore >= 0.6 ? best.badge : null;
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
    if (club.tsdbTeamId) {
      const json = await getJson(`${TSDB}/lookupteam.php?id=${club.tsdbTeamId}`);
      badge = imageOf(json?.teams?.[0]);
    }
    // The club's own division: a pool of twenty candidates from one country
    // beats a global name search every time.
    if (!badge && club.countryCode && club.tier) {
      const lid = curatedLeagueId(club.countryCode, club.tier);
      if (lid) {
        const roster = await leagueRoster(lid);
        if (roster?.length) badge = pickFromRoster(roster, club.name);
      }
    }
    if (!badge) {
      for (const q of searchTerms(club)) {
        const json = await getJson(`${TSDB}/searchteams.php?t=${encodeURIComponent(q)}`);
        const team = pickTeam(json?.teams, club);
        const img = imageOf(team);
        if (img) { badge = img; break; }
      }
    }
    if (badge) { c[key] = badge; persist(); } else { missed.add(key); }
    inflight.delete(key);
    return badge;
  })();
  inflight.set(key, p);
  return p;
}

// ---------------- competition crests and trophies ----------------

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
    const json = await getJson(`${TSDB}/all_leagues.php`, 10000);
    for (const l of json?.leagues || []) {
      if (l.strSport === 'Soccer' && l.strLeague) map[norm(l.strLeague)] = Number(l.idLeague);
    }
    if (Object.keys(map).length) { c['leaguemap'] = map; persist(); }
    return map;
  })();
  return leagueMapPromise;
}

// The division marker at the end of a league's name — "Serie A", "Ligue 2",
// "Liga 3". Word overlap alone treats all of them as the same league, which is
// exactly how a second division ends up wearing the top flight's crest.
const TIER_WORD = { a: 1, i: 1, one: 1, b: 2, ii: 2, two: 2, c: 3, iii: 3, three: 3, d: 4, iv: 4, four: 4 };
function tierMark(name) {
  const words = strip(name).replace(/[.'’\-–—/()]/g, ' ').split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (/^\d$/.test(w)) return Number(w);
    if (w in TIER_WORD) return TIER_WORD[w];
  }
  return null;
}

function leagueScore(wantName, wantTier, candName, candAlt) {
  let s = Math.max(overlap(wantName, candName), ...(candAlt || '').split(',')
    .map((a) => (a.trim() ? overlap(wantName, a) : 0)), 0);
  const want = tierMark(wantName) ?? wantTier ?? null;
  const got = tierMark(candName);
  if (want != null && got != null) s += want === got ? 0.4 : -0.8;
  return s;
}

// Leagues are named inconsistently between sources ("Belgian Pro League" vs
// "Belgian First Division A"), so when the country is known, search only that
// country's leagues and take the best match. The global name map is the
// fallback for competitions with no single country (continental cups).
async function leagueIdByName(name, countryName, tier) {
  if (countryName) {
    const list = await countryLeagues(countryName);
    if (list?.length) {
      let best = null, bestScore = 0;
      for (const l of list) {
        const s = leagueScore(name, tier, l.name, l.alt);
        if (s > bestScore) { bestScore = s; best = l; }
      }
      if (best && bestScore >= 0.5) return best.id;
      if (list.length === 1 && (tier ?? 1) === 1) return list[0].id;
    }
  }
  const map = await leagueIdMap();
  const n = norm(name);
  if (map[n]) return map[n];
  let best = null, bestScore = 0;
  for (const [k, v] of Object.entries(map)) {
    const s = leagueScore(name, tier, k, '');
    if (s > bestScore) { bestScore = s; best = v; }
  }
  return bestScore >= 0.7 ? best : null;
}

// One country's leagues, with the crest already attached — this endpoint
// returns artwork, so a matched league needs no second request.
async function countryLeagues(countryName) {
  const c = loadCache();
  const ckey = `lgcountry:${countryName}`;
  if (c[ckey]) return c[ckey];
  const json = await getJson(`${TSDB}/search_all_leagues.php?c=${encodeURIComponent(countryName)}&s=Soccer`, 9000);
  const list = (json?.countries || json?.leagues || [])
    .map((l) => ({ id: Number(l.idLeague), name: l.strLeague || '', alt: l.strLeagueAlternate || '', badge: imageOf(l, 'league') }))
    .filter((l) => l.id && l.name);
  if (list.length) { c[ckey] = list; persist(); }
  return list;
}

async function badgeOfLeagueId(id) {
  const c = loadCache();
  const key = `lid:${id}`;
  if (key in c) return c[key];
  const json = await getJson(`${TSDB}/lookupleague.php?id=${id}`);
  const badge = imageOf(json?.leagues?.[0], 'league');
  if (badge) { c[key] = badge; persist(); }
  return badge;
}

// League crest by curated id, explicit id, or name, cached.
// `league`: { name, tsdbLeagueId, countryName, countryCode, tier }
export async function resolveLeagueBadge(league) {
  const c = loadCache();
  const curated = curatedLeagueId(league.countryCode, league.tier);
  const known = league.tsdbLeagueId || curated || competitionId(league.name) || null;
  const key = `lbadge:${known || league.countryCode + ':' + league.tier + ':' + league.name}`;
  if (key in c) return c[key];
  if (missed.has(key)) return null;

  let badge = null;
  if (known) badge = await badgeOfLeagueId(known);
  if (!badge && league.countryName) {
    // The country listing carries crests inline; use its match directly.
    const list = await countryLeagues(league.countryName);
    let best = null, bestScore = 0;
    for (const l of list || []) {
      const s = leagueScore(league.name, league.tier, l.name, l.alt);
      if (s > bestScore) { bestScore = s; best = l; }
    }
    if (best && bestScore >= 0.5) badge = best.badge || await badgeOfLeagueId(best.id);
  }
  if (!badge) {
    const id = await leagueIdByName(league.name, league.countryName, league.tier);
    if (id) badge = await badgeOfLeagueId(id);
  }
  if (badge) { c[key] = badge; persist(); } else { missed.add(key); }
  return badge;
}

// Small league crest <img>; hidden until (and unless) the crest resolves.
export function leagueBadgeImg(league, cls = 'lg-badge') {
  const id = 'l' + Math.random().toString(36).slice(2, 9);
  queueMicrotask(async () => {
    const url = await resolveLeagueBadge(league);
    const el = document.getElementById(id);
    if (el && url) {
      el.style.display = '';
      loadInto(el, [url + '/tiny', url + '/small', url], null);
    }
  });
  return `<img id="${id}" class="${cls}" style="display:none" alt="" loading="lazy">`;
}

// TheSportsDB hosted trophy image for a competition id, when it has one.
export async function resolveTrophyImage(tsdbLeagueId) {
  if (!tsdbLeagueId) return null;
  const c = loadCache();
  const key = `trophy:${tsdbLeagueId}`;
  if (key in c) return c[key];
  const json = await getJson(`${TSDB}/lookupleague.php?id=${tsdbLeagueId}`);
  const img = json?.leagues?.[0]?.strTrophy || null;
  if (img) { c[key] = img; persist(); }
  return img;
}

// Trophy artwork for a competition the game names but has no id for on the
// trophy record itself (a domestic cup, a continental final).
export async function resolveTrophyImageByName(competitionName, countryName, countryCode, tier) {
  const c = loadCache();
  const key = `trophyname:${competitionName}`;
  if (key in c) return c[key];
  let id = competitionId(competitionName) || curatedLeagueId(countryCode, tier);
  if (!id) id = await leagueIdByName(competitionName, countryName, tier);
  const img = id ? await resolveTrophyImage(id) : null;
  if (img) { c[key] = img; persist(); }
  return img;
}

// ---------------- rendering helpers ----------------

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

// Generated initials badge (SVG data URI) in club colours.
export function initialsBadge(name, colors) {
  const initials = String(name)
    .replace(/\(.*?\)/g, '')
    .split(/[\s-]+/)
    .filter((w) => w && !/^(fc|cf|afc|ac|as|cd|sc|sd|ud|us|club|de|do|da|the|of)$/i.test(w))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('') || String(name).slice(0, 2).toUpperCase();
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
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
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
