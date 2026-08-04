// Crest resolution is the one part of the game that depends on matching our
// club and league names against a third party's. It cannot be checked against
// the live API here (egress blocks TheSportsDB), so this drives the matcher
// against canned responses shaped like the real ones, covering every way it
// has been seen to pick the wrong crest:
//
//   - a reserve side wearing the senior club's name ("Hamburger SV II")
//   - a same-named club in another country (a French "La Louvière")
//   - a division marker that word-overlap ignores ("Serie A" vs "Serie D
//     Girone A", "Ligue 1" vs "Ligue 2")

globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, v); },
  removeItem(k) { this._m.delete(k); }
};

const LEAGUES = {
  4328: 'English Premier League', 4331: 'German Bundesliga', 4332: 'Italian Serie A',
  4334: 'French Ligue 1', 4338: 'Belgian Jupiler League', 4351: 'Brazilian Brasileirao',
  4398: 'Italian Serie C', 4401: 'French Ligue 2', 4786: 'Italy Serie D Girone A',
  9001: 'Testland Liga 1', 9002: 'Testland Liga 2'
};

const TEAMS = [
  { strTeam: 'Nottingham Forest', strCountry: 'England', strSport: 'Soccer', strTeamBadge: 'B/forest' },
  { strTeam: 'Arsenal', strCountry: 'England', strSport: 'Soccer', strBadge: 'B/arsenal' },
  { strTeam: 'Hamburger SV', strCountry: 'Germany', strSport: 'Soccer', strBadge: 'B/hsv', strTeamAlternate: 'Hamburg,HSV' },
  { strTeam: 'Hamburger SV II', strCountry: 'Germany', strSport: 'Soccer', strBadge: 'B/hsv-reserves' },
  { strTeam: 'RAAL La Louviere', strCountry: 'Belgium', strSport: 'Soccer', strBadge: 'B/raal' },
  { strTeam: 'La Louviere Centre', strCountry: 'Belgium', strSport: 'Soccer', strBadge: 'B/llc' },
  { strTeam: 'Louviere Sportif', strCountry: 'France', strSport: 'Soccer', strBadge: 'B/french-louviere' },
  { strTeam: 'Nottingham Rugby', strCountry: 'England', strSport: 'Rugby', strBadge: 'B/rugby' },
  { strTeam: 'Rangers', strCountry: 'Scotland', strSport: 'Soccer', strBadge: 'B/gers' },
  { strTeam: 'Queens Park Rangers', strCountry: 'England', strSport: 'Soccer', strBadge: 'B/qpr' },
  { strTeam: 'AS Vita Club', strCountry: 'DR Congo', strSport: 'Soccer', strBadge: 'B/vita' },
  { strTeam: "FC Rànger's", strCountry: 'Andorra', strSport: 'Soccer', strBadge: 'B/andorra-rangers' }
];

const ROSTERS = {
  4328: ['Arsenal', 'Nottingham Forest'],
  4331: ['Hamburger SV', 'Bayern Munich'],
  4338: ['RAAL La Louviere', 'Club Brugge']
};

const COUNTRY_LEAGUES = {
  Testland: [
    { idLeague: '9001', strLeague: 'Testland Liga 1', strBadge: 'BADGE/9001' },
    { idLeague: '9002', strLeague: 'Testland Liga 2', strBadge: 'BADGE/9002' }
  ],
  Italy: [
    { idLeague: '4786', strLeague: 'Italy Serie D Girone A', strBadge: 'BADGE/4786' },
    { idLeague: '4332', strLeague: 'Italian Serie A', strLeagueAlternate: 'Serie A', strBadge: 'BADGE/4332' }
  ]
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const calls = [];

globalThis.fetch = async (url) => {
  calls.push(url);
  const u = new URL(url);
  const q = u.searchParams;
  const body = () => {
    if (url.includes('lookupteam.php')) {
      return { teams: [] };
    }
    if (url.includes('lookup_all_teams.php')) {
      const names = ROSTERS[Number(q.get('id'))] || [];
      return { teams: names.map((n) => TEAMS.find((t) => t.strTeam === n) || { strTeam: n, strBadge: 'B/' + norm(n) }) };
    }
    if (url.includes('searchteams.php')) {
      const t = norm(q.get('t'));
      return { teams: TEAMS.filter((x) => norm(x.strTeam).includes(t) || t.includes(norm(x.strTeam)) || norm(x.strTeamAlternate || '').includes(t)) };
    }
    if (url.includes('search_all_leagues.php')) {
      return { countries: COUNTRY_LEAGUES[q.get('c')] || [] };
    }
    if (url.includes('lookupleague.php')) {
      const id = Number(q.get('id'));
      return LEAGUES[id] ? { leagues: [{ idLeague: id, strLeague: LEAGUES[id], strBadge: 'BADGE/' + id, strTrophy: 'TROPHY/' + id }] } : { leagues: [] };
    }
    if (url.includes('all_leagues.php')) {
      return { leagues: Object.entries(LEAGUES).map(([id, name]) => ({ idLeague: id, strLeague: name, strSport: 'Soccer' })) };
    }
    return {};
  };
  return { ok: true, json: async () => body() };
};

const { resolveBadge, resolveLeagueBadge } = await import('../src/ui/badge.js');

const fails = [];
async function expectClub(label, club, want) {
  const got = await resolveBadge(club);
  if (got !== want) fails.push(`${label}: expected ${want}, got ${got}`);
  else console.log(`  ok  ${label} → ${got}`);
}
async function refuseClub(label, club, forbidden) {
  const got = await resolveBadge(club);
  if (got === forbidden) fails.push(`${label}: must not resolve to ${forbidden}`);
  else console.log(`  ok  ${label} → ${got}`);
}
async function expectLeague(label, league, want) {
  const got = await resolveLeagueBadge(league);
  if (got !== want) fails.push(`${label}: expected ${want}, got ${got}`);
  else console.log(`  ok  ${label} → ${got}`);
}

console.log('club crests');
await expectClub('Nottingham Forest, via the Premier League squad list',
  { name: 'Nottingham Forest', country: 'England', countryCode: 'ENG', tier: 1 }, 'B/forest');
await expectClub('Hamburger SV takes the senior crest, not the reserves’',
  { name: 'Hamburger SV', country: 'Germany', countryCode: 'GER', tier: 1 }, 'B/hsv');
await expectClub('RAAL La Louvière, not the other club in its own town',
  { name: 'RAAL La Louvière', country: 'Belgium', countryCode: 'BEL', tier: 1 }, 'B/raal');
await expectClub('Hamburger SV by name search alone still avoids the reserves',
  { name: 'Hamburger SV', country: 'Germany' }, 'B/hsv');
await refuseClub('a Belgian club never takes a French lookalike’s crest',
  { name: 'Louvière SC', country: 'Belgium' }, 'B/french-louviere');
await refuseClub('an unknown club gets no crest rather than a stranger’s',
  { name: 'Wanderers of Nowhere', country: 'Belgium' }, 'B/raal');
await refuseClub('Kinshasa’s Rangers never wear Glasgow’s crest',
  { name: 'FC Rangers', country: 'Congo DR' }, 'B/gers');
await expectClub('Glasgow Rangers still resolve for Scotland',
  { name: 'Rangers', country: 'Scotland' }, 'B/gers');
await expectClub('a country named differently by each source still matches',
  { name: 'AS Vita Club', country: 'Congo DR' }, 'B/vita');
await expectClub('an apostrophe in a club name does not break the search',
  { name: "FC Rànger's", country: 'Andorra' }, 'B/andorra-rangers');

console.log('\nleague crests');
await expectLeague('Serie A is not Serie D Girone A',
  { name: 'Serie A', countryName: 'Italy', countryCode: 'ITA', tier: 1 }, 'BADGE/4332');
await expectLeague('Serie C has its own crest',
  { name: 'Serie C', countryName: 'Italy', countryCode: 'ITA', tier: 3 }, 'BADGE/4398');
await expectLeague('Ligue 1 is not Ligue 2',
  { name: 'Ligue 1', countryName: 'France', countryCode: 'FRA', tier: 1 }, 'BADGE/4334');
await expectLeague('the Belgian Pro League resolves despite its other name',
  { name: 'Belgian Pro League', countryName: 'Belgium', countryCode: 'BEL', tier: 1 }, 'BADGE/4338');
await expectLeague('Campeonato Brasileiro Série A resolves',
  { name: 'Campeonato Brasileiro Série A', countryName: 'Brazil', countryCode: 'BRA', tier: 1 }, 'BADGE/4351');
await expectLeague('an uncurated second tier still matches on its division marker',
  { name: 'Liga 2', countryName: 'Testland', countryCode: 'ZZZ', tier: 2 }, 'BADGE/9002');
await expectLeague('an uncurated top flight matches its own marker',
  { name: 'Liga 1', countryName: 'Testland', countryCode: 'ZZZ', tier: 1 }, 'BADGE/9001');

if (fails.length) {
  console.log('\nCREST FAIL:');
  fails.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log('\nCREST PASS');
