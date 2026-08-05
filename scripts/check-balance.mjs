// Asserts the two balance properties the engine is designed around:
//
//  1. Appearances are realistic — a first-choice player in a 20-club league
//     plays most of it, a fringe player does not, and nobody exceeds the
//     fixtures their club actually has.
//  2. A career's overall rating is driven by football, not by decision cards:
//     across a career, far more OVR movement must come from season
//     development than from the choices made on the cards.
//  3. Decision cards are rare, and always a choice between exactly two options.
//  4. Clubs behave like the clubs they are: a side cannot climb from the
//     fourth tier to the first in successive seasons, and the teams that win
//     continental trophies are the strong ones, not whoever qualified.
//  5. The same season is worth more at a higher standard: identical output in
//     a stronger league must move a young player's rating further.
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
const { countryCoeff, leagueLevel, clubStature } = await import('../src/engine/data.js');

// How far above the division's ordinary starter a player stands, in the same
// units the engine uses. Judging a 50-rated player as "fringe" is meaningless
// in a league where 50 is a star, so every band below is drawn on this.
const edgeOf = (ovr, club) => (ovr - leagueLevel(countryCoeff(club.country, club.confederation), club.tier) * 0.78) / 12;

const N = Number(process.argv[2] || 200);
const NATS = ['ENG', 'ESP', 'ITA', 'GER', 'FRA', 'BRA', 'ARG', 'NED', 'POR', 'BEL', 'MAR', 'JPN', 'USA', 'MLT'];
const POS = ['GK', 'CB', 'LB', 'RB', 'LWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST'];

const seasons = [];          // one row per season played

// Record a finished season for the report below.
function record(c, r) {
  developmentOvr += Math.abs(r.ovrDelta || 0);
  if (r.cut) return;
  seasons.push({
    ovr: r.ovrBefore, age: c.history[c.history.length - 1].age,
    edge: edgeOf(r.ovrBefore, c.club),
    apps: r.stats.apps, possible: r.stats.possible,
    league: r.matchLoad.league, cont: r.matchLoad.continental,
    goals: r.stats.goals, assists: r.stats.assists, saves: r.stats.saves,
    role: c.history[c.history.length - 1].role,
    rating: r.stats.rating, tier: c.club.tier,
    club: c.club.name, quality: r.clubQuality, position: r.position, champion: !!r.champion,
    promoted: !!r.promoted, relegated: !!r.relegated, ovrDelta: r.ovrDelta || 0, perf: r.performance || 0,
    level: leagueLevel(countryCoeff(c.club.country, c.club.confederation), c.club.tier),
    topPts: r.table[0]?.pts ?? 0, botPts: r.table[r.table.length - 1]?.pts ?? 0, clubs: r.table.length,
    contPlayed: !!r.continentalRun, contWon: !!(r.continentalRun && r.continentalRun.won),
    contName: r.continentalRun ? r.continentalRun.name : null
  });
}
let decisionOvr = 0;         // absolute OVR moved by decision cards
let developmentOvr = 0;      // absolute OVR moved by season development
let cardsPlayed = 0;         // decision cards seen across all careers
let badChoiceCount = 0;      // cards that did not offer exactly two options
let pointlessCards = 0;      // cards where neither option could move the rating
const promoStreaks = [];     // longest run of successive promotions per career
const afterPromotion = [];   // where a promoted side finishes, 0 (top) to 1 (bottom)
const eliteOffers = [];      // who the biggest clubs in the biggest leagues call
const peaks = [];            // the best rating each career ever reached
const errors = [];

for (let i = 0; i < N; i++) {
  try {
    const c = await startCareer({ name: 'Bal ' + i, nationality: NATS[i % NATS.length], position: POS[i % POS.length] });
    if (!c.offers.length) { errors.push('no starting offers'); continue; }
    await acceptOffer(c, c.offers[0]);
    let guard = 0;
    let streak = 0, maxStreak = 0;
    const before = seasons.length;
    while (!c.retired && guard++ < 400) {
      if (c.phase === 'offers') {
        for (const o of c.offers) {
          const lvl = leagueLevel(countryCoeff(o.country, o.confederation), o.tier);
          if (lvl >= 85 && clubStature(o.clubName) >= 0.85) {
            eliteOffers.push({ ovr: c.player.ability, age: c.player.age, headroom: c.player.potential - c.player.ability });
          }
        }
        if (c.offers.length && Math.random() < 0.5) await acceptOffer(c, c.offers[Math.floor(Math.random() * c.offers.length)]);
        else stayAtClub(c);
      } else if (c.phase === 'event') {
        const ev = currentEvent(c);
        if (ev.choices.length !== 2) badChoiceCount++;
        // A card where neither side can move the rating is not a decision.
        if (c.player.ability < 98 && ev.choices.every((ch) => !ch.risk.up && !ch.risk.down)) pointlessCards++;
        const out = chooseEventOption(c, Math.floor(Math.random() * ev.choices.length));
        decisionOvr += Math.abs(out.ovrDelta || 0);
        cardsPlayed++;
        c.lastOutcome = null;
        if (c.phase === 'review') record(c, runSeason(c));
      } else if (c.phase === 'review') {
        record(c, runSeason(c));
      } else if (c.phase === 'postseason') {
        await advanceToNextSeason(c);
      } else { errors.push('stuck in ' + c.phase); break; }
    }
    const mine = seasons.slice(before);
    for (let k = 0; k < mine.length; k++) {
      // Only a run at the same club counts: a player who moves to another
      // side that also goes up has not watched one club climb twice.
      const sameClub = k > 0 && mine[k - 1].club === mine[k].club;
      streak = mine[k].promoted ? (sameClub ? streak + 1 : 1) : 0;
      if (streak > maxStreak) maxStreak = streak;
      // How a side fares the season after going up, as a share of its new
      // division: 1.0 is bottom, 0 is champions.
      if (k > 0 && mine[k - 1].promoted && mine[k].tier === mine[k - 1].tier - 1) {
        mine[k].justUp = true;
        afterPromotion.push(mine[k].position / Math.max(2, mine[k].league / 2 + 1));
      }
    }
    promoStreaks.push(maxStreak);
    peaks.push(c.player.peakAbility);
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
const big = seasons.filter((s) => s.clubs >= 18);
if (big.length) {
  console.log(`\nleague tables (18+ club divisions): champions average ${avg(big.map((s) => s.topPts)).toFixed(0)} pts, bottom club ${avg(big.map((s) => s.botPts)).toFixed(0)} pts`);
}
console.log(`fixtures: league avg ${avg(seasons.map((s) => s.league)).toFixed(1)} | total avg ${avg(seasons.map((s) => s.possible)).toFixed(1)}`);
console.log(`continental seasons: ${withCont.length} (${(withCont.length / seasons.length * 100).toFixed(0)}%), total fixtures avg ${avg(withCont.map((s) => s.possible)).toFixed(1)}`);

const strikers = seasons.filter((s) => s.role === 'ST' && s.tier === 1 && s.apps >= 20);
const keepers = seasons.filter((s) => s.role === 'GK' && s.apps >= 20);
console.log(`\nstriker seasons (20+ apps): goals avg ${avg(strikers.map((s) => s.goals)).toFixed(1)} | p90 ${pct(strikers.map((s) => s.goals), 0.9)} | max ${Math.max(0, ...strikers.map((s) => s.goals))}`);
console.log(`keeper seasons (20+ apps): saves avg ${avg(keepers.map((s) => s.saves)).toFixed(1)} | per game ${(avg(keepers.map((s) => s.saves / s.apps))).toFixed(2)}`);

const contWinners = seasons.filter((s) => s.contWon);
const contEntrants = seasons.filter((s) => s.contPlayed);
const qAbs = (rows) => avg(rows.map((r) => r.quality));
console.log(`\ncontinental: ${contEntrants.length} campaigns, ${contWinners.length} won` +
  (contWinners.length ? ` | winners average quality ${qAbs(contWinners).toFixed(0)}, all entrants ${qAbs(contEntrants).toFixed(0)}` : ''));
// Compare the strongest quarter of each competition's entrants with the
// weakest, within the competition, so the two groups met the same field. The
// median split is too blunt: half the Champions League field is a giant.
let strongEntries = 0, strongWins = 0, weakEntries = 0, weakWins = 0;
for (const name of [...new Set(contEntrants.map((r) => r.contName))]) {
  const rows = contEntrants.filter((r) => r.contName === name);
  if (rows.length < 8) continue;
  const sorted = [...rows].sort((a, b) => a.quality - b.quality);
  const cut = Math.max(1, Math.floor(rows.length / 4));
  const up = sorted.slice(-cut), down = sorted.slice(0, cut);
  strongEntries += up.length; strongWins += up.filter((r) => r.contWon).length;
  weakEntries += down.length; weakWins += down.filter((r) => r.contWon).length;
  console.log(`  ${name.padEnd(26)} ${String(rows.length).padStart(3)} entries | won ${String(rows.filter((r) => r.contWon).length).padStart(2)}` +
    ` | strongest quarter ${(up.filter((r) => r.contWon).length / Math.max(1, up.length) * 100).toFixed(0)}%` +
    ` vs weakest ${(down.filter((r) => r.contWon).length / Math.max(1, down.length) * 100).toFixed(0)}%`);
}
const strongRate = strongWins / Math.max(1, strongEntries), weakRate = weakWins / Math.max(1, weakEntries);
console.log(`  strongest quarters win ${(strongRate * 100).toFixed(1)}% of their campaigns, weakest quarters ${(weakRate * 100).toFixed(1)}%`);
console.log(`promotions in successive seasons: longest run p90 ${pct(promoStreaks, 0.9)}, max ${Math.max(0, ...promoStreaks)}`);
if (afterPromotion.length) {
  console.log(`the season after promotion: average finish ${(avg(afterPromotion) * 100).toFixed(0)}% down its new division (${afterPromotion.length} samples)`);
}
if (peaks.length) {
  const sorted = [...peaks].sort((a, b) => a - b);
  const at = (f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
  const over = (t) => (peaks.filter((x) => x >= t).length / peaks.length * 100).toFixed(0);
  console.log(`\npeak rating reached: median ${at(0.5)} | p90 ${at(0.9)} | best ${sorted[sorted.length - 1]}` +
    ` | reached 85+ ${over(85)}% of careers, 90+ ${over(90)}%, 95+ ${over(95)}%`);
}
if (eliteOffers.length) {
  const kids = eliteOffers.filter((o) => o.age <= 23);
  console.log(`the biggest clubs called ${eliteOffers.length} times: target OVR avg ${avg(eliteOffers.map((o) => o.ovr)).toFixed(0)}` +
    `, age avg ${avg(eliteOffers.map((o) => o.age)).toFixed(1)} | ${kids.length} of them under 24 (OVR avg ${avg(kids.map((o) => o.ovr)).toFixed(0)}, headroom avg ${avg(kids.map((o) => o.headroom)).toFixed(0)})`);
}
console.log(`decision cards: ${cardsPlayed} over ${seasons.length} seasons (${(cardsPlayed / Math.max(1, seasons.length) * 100).toFixed(0)}% of seasons)`);

// The same season, played at a higher standard, has to be worth more.
const young = (lo, hi) => seasons.filter((s) => s.age <= 23 && s.apps >= 25 &&
  s.goals + s.assists >= 4 && s.goals + s.assists <= 14 && s.level >= lo && s.level < hi);
const weak = young(0, 45), strong = young(70, 999);
console.log(`the same season (25+ apps, 4-14 goals+assists, under 24) is worth:` +
  ` weak leagues ${avg(weak.map((s) => s.perf)).toFixed(2)} development | strong leagues ${avg(strong.map((s) => s.perf)).toFixed(2)}` +
  ` (raw movement +${avg(weak.map((s) => s.ovrDelta)).toFixed(2)} vs +${avg(strong.map((s) => s.ovrDelta)).toFixed(2)} OVR, headroom differs)`);

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

// A squad that has just gone up is collectively below its new division and
// still plays every week, so those seasons are excluded — and the bucket is
// only asserted once enough of it exists to mean anything.
const fringe = seasons.filter((s) => s.edge < -1 && s.age >= 21 && s.age <= 32 && !s.justUp);
const fringeShare = avg(fringe.map((s) => s.apps / s.possible));
if (fringe.length >= 40 && fringeShare > 0.6) fails.push(`players well below their division play ${(fringeShare * 100).toFixed(0)}% of fixtures (expected under 60%)`);

const youth = seasons.filter((s) => s.age <= 18);
const youthShare = avg(youth.map((s) => s.apps / s.possible));
if (youth.length && youthShare > 0.5) fails.push(`teenagers play ${(youthShare * 100).toFixed(0)}% of fixtures (expected under 50%)`);

const champPts = avg(big.map((s) => s.topPts));
if (big.length > 50 && (champPts < 70 || champPts > 102)) {
  fails.push(`champions of a 20-club division average ${champPts.toFixed(0)} points (expected 70-102)`);
}

// The biggest clubs chase two kinds of player: the finished article, and the
// prospect they think will become one. Neither is an ordinary professional.
if (eliteOffers.length > 30) {
  const eliteAvg = avg(eliteOffers.map((o) => o.ovr));
  if (eliteAvg < 78) fails.push(`the biggest clubs are calling players averaging ${eliteAvg.toFixed(0)} OVR (expected 78+)`);
  const kids = eliteOffers.filter((o) => o.age <= 23);
  const grown = eliteOffers.filter((o) => o.age >= 26);
  if (kids.length < eliteOffers.length * 0.015) {
    fails.push(`only ${kids.length} of ${eliteOffers.length} approaches from the biggest clubs went to a player under 24`);
  }
  // Promise is what a prospect is signed on, so they arrive rated lower than
  // the established players the same clubs approach.
  if (kids.length > 10 && grown.length > 10 && avg(kids.map((o) => o.ovr)) >= avg(grown.map((o) => o.ovr))) {
    fails.push('the biggest clubs are not signing prospects on promise — their under-24 targets are rated as highly as their established ones');
  }
}

// A career that ends in the nineties has to be the exception.
if (peaks.length > 60) {
  const share90 = peaks.filter((x) => x >= 90).length / peaks.length;
  const median = [...peaks].sort((a, b) => a - b)[Math.floor(peaks.length / 2)];
  if (share90 > 0.15) fails.push(`${(share90 * 100).toFixed(0)}% of careers peak at 90+ (expected under 15%)`);
  if (median > 82) fails.push(`the median career peaks at ${median} (expected 82 or below)`);
}

if (decisionShare > 0.3) fails.push(`decision cards account for ${(decisionShare * 100).toFixed(0)}% of OVR movement (expected under 30%)`);
if (badChoiceCount) fails.push(`${badChoiceCount} decision cards did not offer exactly two options`);
if (pointlessCards) fails.push(`${pointlessCards} decision cards could not change the rating either way`);

const cardRate = cardsPlayed / Math.max(1, seasons.length);
if (cardRate > 0.55) fails.push(`decision cards appear in ${(cardRate * 100).toFixed(0)}% of seasons (expected under 55%)`);

if (Math.max(0, ...promoStreaks) > 2) fails.push(`a club won ${Math.max(...promoStreaks)} promotions in successive seasons`);
if (pct(promoStreaks, 0.9) > 1) fails.push('back-to-back promotions are commonplace (p90 of the longest run is above 1)');

// Only asserted once the sample can carry it — a short run is too noisy.
if (strongEntries > 110 && weakEntries > 110 && strongRate < weakRate * 2.2) {
  fails.push(`the strongest entrants win ${(strongRate * 100).toFixed(1)}% of continental campaigns against ${(weakRate * 100).toFixed(1)}% for the weakest (expected at least 2.2x)`);
}
if (contEntrants.length > 50 && contWinners.length / contEntrants.length > 0.16) {
  fails.push(`${(contWinners.length / contEntrants.length * 100).toFixed(0)}% of continental campaigns end in the trophy (expected under 16%)`);
}

if (weak.length > 20 && strong.length > 20 && avg(strong.map((s) => s.perf)) <= avg(weak.map((s) => s.perf)) * 1.05) {
  fails.push(`the same season develops a player no more in a strong league (${avg(strong.map((s) => s.perf)).toFixed(2)}) than a weak one (${avg(weak.map((s) => s.perf)).toFixed(2)})`);
}

if (fails.length) {
  console.log('\nBALANCE FAIL:');
  fails.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log('\nBALANCE PASS');
