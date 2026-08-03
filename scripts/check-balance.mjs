// Asserts the two balance properties the engine is designed around:
//
//  1. Appearances are realistic — a first-choice player in a 20-club league
//     plays most of it, a fringe player does not, and nobody exceeds the
//     fixtures their club actually has.
//  2. A career's overall rating is driven by football, not by decision cards:
//     across a career, far more OVR movement must come from season
//     development than from the choices made on the cards.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

globalThis.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, v); },
  removeItem(k) { this._m.delete(k); }
};
globalThis.fetch = async (url) => {
  const p = path.join(ROOT, 'public', String(url));
  try {
    const body = await readFile(p, 'utf8');
    return { ok: true, json: async () => JSON.parse(body) };
  } catch {
    return { ok: false, json: async () => { throw new Error('404 ' + url); } };
  }
};

const {
  startCareer, acceptOffer, stayAtClub, chooseEventOption, runSeason,
  advanceToNextSeason, currentEvent
} = await import('../src/engine/career.js');
const { countryCoeff, leagueLevel } = await import('../src/engine/data.js');

// How far above the division's ordinary starter a player stands, in the same
// units the engine uses. Judging a 50-rated player as "fringe" is meaningless
// in a league where 50 is a star, so every band below is drawn on this.
const edgeOf = (ovr, club) => (ovr - leagueLevel(countryCoeff(club.country, club.confederation), club.tier) * 0.78) / 12;

const N = Number(process.argv[2] || 200);
const NATS = ['ENG', 'ESP', 'ITA', 'GER', 'FRA', 'BRA', 'ARG', 'NED', 'POR', 'BEL', 'MAR', 'JPN', 'USA', 'MLT'];
const POS = ['GK', 'CB', 'LB', 'RB', 'LWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];

const seasons = [];          // one row per season played
let decisionOvr = 0;         // absolute OVR moved by decision cards
let developmentOvr = 0;      // absolute OVR moved by season development
const errors = [];

for (let i = 0; i < N; i++) {
  try {
    const c = await startCareer({ name: 'Bal ' + i, nationality: NATS[i % NATS.length], position: POS[i % POS.length] });
    if (!c.offers.length) { errors.push('no starting offers'); continue; }
    await acceptOffer(c, c.offers[0]);
    let guard = 0;
    while (!c.retired && guard++ < 400) {
      if (c.phase === 'offers') {
        if (c.offers.length && Math.random() < 0.5) await acceptOffer(c, c.offers[Math.floor(Math.random() * c.offers.length)]);
        else stayAtClub(c);
      } else if (c.phase === 'event') {
        const ev = currentEvent(c);
        const out = chooseEventOption(c, Math.floor(Math.random() * ev.choices.length));
        decisionOvr += Math.abs(out.ovrDelta || 0);
        c.lastOutcome = null;
        if (c.phase === 'review') {
          const r = runSeason(c);
          developmentOvr += Math.abs(r.ovrDelta || 0);
          if (!r.cut) {
            seasons.push({
              ovr: r.ovrBefore, age: c.history[c.history.length - 1].age,
              edge: edgeOf(r.ovrBefore, c.club),
              apps: r.stats.apps, possible: r.stats.possible,
              league: r.matchLoad.league, cont: r.matchLoad.continental,
              goals: r.stats.goals, assists: r.stats.assists, saves: r.stats.saves,
              role: c.history[c.history.length - 1].role,
              rating: r.stats.rating, tier: c.club.tier
            });
          }
        }
      } else if (c.phase === 'postseason') {
        await advanceToNextSeason(c);
      } else { errors.push('stuck in ' + c.phase); break; }
    }
  } catch (e) {
    errors.push(e.stack.split('\n').slice(0, 3).join(' | '));
  }
}

const pct = (a, q) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))] ?? 0;
};
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

console.log(`seasons sampled: ${seasons.length} (errors: ${errors.length})`);

console.log('\nappearances by standing in the division (ages 21-32)');
const bands = [[-9, -1, 'well below it'], [-1, 0, 'below it'], [0, 1, 'a regular'], [1, 2, 'one of its best'], [2, 99, 'far too good for it']];
for (const [lo, hi, label] of bands) {
  const rows = seasons.filter((s) => s.edge >= lo && s.edge < hi && s.age >= 21 && s.age <= 32);
  if (!rows.length) { console.log(`  ${label}: no sample`); continue; }
  const apps = rows.map((r) => r.apps);
  const share = rows.map((r) => r.apps / r.possible);
  console.log(`  ${label.padEnd(20)}: apps avg ${avg(apps).toFixed(1)} | med ${pct(apps, 0.5)} | p90 ${pct(apps, 0.9)} | max ${Math.max(...apps)} | ${(avg(share) * 100).toFixed(0)}% of fixtures`);
}

const withCont = seasons.filter((s) => s.cont > 0);
console.log(`\nfixtures: league avg ${avg(seasons.map((s) => s.league)).toFixed(1)} | total avg ${avg(seasons.map((s) => s.possible)).toFixed(1)}`);
console.log(`continental seasons: ${withCont.length} (${(withCont.length / seasons.length * 100).toFixed(0)}%), total fixtures avg ${avg(withCont.map((s) => s.possible)).toFixed(1)}`);

const strikers = seasons.filter((s) => s.role === 'ST' && s.tier === 1 && s.apps >= 20);
const keepers = seasons.filter((s) => s.role === 'GK' && s.apps >= 20);
console.log(`\nstriker seasons (20+ apps): goals avg ${avg(strikers.map((s) => s.goals)).toFixed(1)} | p90 ${pct(strikers.map((s) => s.goals), 0.9)} | max ${Math.max(0, ...strikers.map((s) => s.goals))}`);
console.log(`keeper seasons (20+ apps): saves avg ${avg(keepers.map((s) => s.saves)).toFixed(1)} | per game ${(avg(keepers.map((s) => s.saves / s.apps))).toFixed(2)}`);

const totalOvr = decisionOvr + developmentOvr;
const decisionShare = totalOvr ? decisionOvr / totalOvr : 0;
console.log(`\nOVR movement: season development ${developmentOvr.toFixed(0)} | decision cards ${decisionOvr.toFixed(0)} → cards are ${(decisionShare * 100).toFixed(0)}% of all movement`);

// ---- assertions ----
const fails = [];
if (errors.length) fails.push(`${errors.length} simulation errors: ${[...new Set(errors)].slice(0, 3).join(' ; ')}`);
if (seasons.some((s) => s.apps > s.possible)) fails.push('a player made more appearances than the club had fixtures');

const elite = seasons.filter((s) => s.edge >= 1 && s.age >= 23 && s.age <= 31);
const eliteShare = avg(elite.map((s) => s.apps / s.possible));
if (elite.length && eliteShare < 0.8) fails.push(`players well above their division play only ${(eliteShare * 100).toFixed(0)}% of fixtures (expected 80%+)`);

const fringe = seasons.filter((s) => s.edge < -1 && s.age >= 21 && s.age <= 32);
const fringeShare = avg(fringe.map((s) => s.apps / s.possible));
if (fringe.length && fringeShare > 0.55) fails.push(`players well below their division play ${(fringeShare * 100).toFixed(0)}% of fixtures (expected under 55%)`);

const youth = seasons.filter((s) => s.age <= 18);
const youthShare = avg(youth.map((s) => s.apps / s.possible));
if (youth.length && youthShare > 0.5) fails.push(`teenagers play ${(youthShare * 100).toFixed(0)}% of fixtures (expected under 50%)`);

if (decisionShare > 0.3) fails.push(`decision cards account for ${(decisionShare * 100).toFixed(0)}% of OVR movement (expected under 30%)`);

if (fails.length) {
  console.log('\nBALANCE FAIL:');
  fails.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log('\nBALANCE PASS');
