// Career state machine: creation, offers, events, season loop, saves.
import { seed, getSeed, rand, chance, irand, pick, clamp, weightedPick } from './rng.js';
import { loadAssociations, getAssociation, loadCountry, countryCoeff, clubStature, isReserveSide, leagueLevel, playableLeagues } from './data.js';
import { createPlayer, developPlayer, revisePotential, seasonPerformance, agePlayer, retirementPressure, effectiveRole } from './player.js';
import { drawSeasonEvents, getEventById } from './events.js';
import { simulateSeason } from './season.js';

const SAVE_KEY = 'fcsim.career';
const SAVE_VERSION = 4;
const HALL_KEY = 'fcsim.hall';
const START_YEAR = 2026;

let index = null; // data index: [{code, country, confederation, leagues:[{tier,name,clubs,verified}]}]

export async function loadIndex() {
  if (index) return index;
  const res = await fetch('data/index.json');
  index = (await res.json()).countries;
  return index;
}

function nationConfederation(career) {
  return career.nation?.confederation || null;
}

function leagueRef(countryEntry, league) {
  return {
    country: countryEntry.code,
    countryName: countryEntry.country,
    confederation: countryEntry.confederation,
    tier: league.tier,
    leagueName: league.name,
    tsdbLeagueId: league.tsdbLeagueId ?? null
  };
}

async function clubsOf(code, tier) {
  const data = await loadCountry(code);
  const lg = playableLeagues(data).find((l) => l.tier === tier);
  return lg ? lg.clubs : [];
}

// ---------- Career creation ----------

export async function startCareer({ name, nationality, position }) {
  seed((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  await loadAssociations();
  await loadIndex();
  const nation = getAssociation(nationality);
  const player = createPlayer({ name, nationality, position });

  const career = {
    v: SAVE_VERSION,
    seed: getSeed(),
    year: START_YEAR,
    phase: 'offers',
    player,
    nation: { code: nation.code, name: nation.name, confederation: nation.confederation },
    club: null,
    leagueClubs: [],
    yearsAtClub: 0,
    continental: null,
    hasHigherTier: false,
    hasLowerTier: false,
    flags: {},
    usedEventIds: [],
    pendingEvents: [],
    eventIdx: 0,
    offers: [],
    history: [],       // one entry per season
    trophies: [],
    news: [],
    longestClub: { name: null, seasons: 0 },
    clubSeasons: {},
    retired: false
  };
  career.offers = await generateOffers(career, true);
  saveCareer(career);
  return career;
}

// Candidate leagues whose level suits the player's current standing.
async function generateOffers(career, isStart = false) {
  const p = career.player;
  const idx = await loadIndex();
  // What level of football is currently open to this player. Last season's
  // form counts: a player who has just struggled is not courted by the clubs
  // who wanted him a year ago.
  const recent = career.lastStats?.rating ?? 6.6;
  const standing = clamp((recent - 6.4) / 1.3, -0.5, 0.5);

  // Big clubs sign the player they think you are becoming, not only the one
  // you are. A twenty-year-old with headroom and a rising line is chased by
  // clubs an established professional of the same rating would never hear
  // from — to keep, or to send back out on loan for a year. The pull fades as
  // a career settles: past the mid-twenties, only what you are counts.
  const lastOvr = career.history.length ? career.history[career.history.length - 1].ovr : p.ability;
  const rising = clamp(p.ability - lastOvr, 0, 6) / 6;
  // Room to grow is worth most at twenty and least at thirty, but it does not
  // vanish at twenty-six: a player in his prime is still expected to add
  // something, just less of it.
  const youth = p.age <= 21 ? 1 : p.age <= 23 ? 0.8 : p.age <= 25 ? 0.55
    : p.age <= 27 ? 0.35 : p.age <= 29 ? 0.15 : 0;
  const promise = clamp(((p.potential - p.ability) / 18 * 0.6 + rising * 0.4) * youth, 0, 1);

  const target = isStart
    ? clamp(p.ability * 0.75 + rand() * 12, 8, 55)
    : clamp(p.ability * (0.9 + rand() * 0.25) + p.reputation * 0.15, 10, 105) *
      (1 + standing * 0.12 + promise * 0.1) * (career.bigMove ? 1.18 : 1);

  // A veteran winding down, or a player who has asked for one last adventure,
  // will consider a drop that a peak-years professional never would.
  const loosen = isStart || career.adventure || p.age >= 33 || retirementPressure(p) > 0;

  // Home-country leagues get a wider acceptable band, so a player from a
  // small football nation still gets offers from home rather than none.
  const candidates = [];
  for (const c of idx) {
    const home = c.code === p.nationality;
    for (const l of c.leagues) {
      if (l.clubs < 6) continue;
      const lvl = leagueLevel(countryCoeff(c.code, c.confederation), l.tier);
      // Climbing is hard: a league well above the standard the player has
      // reached does not come calling. Dropping is easier, but not unlimited —
      // a first-choice player at Atlético is not phoned by a Serie B club.
      // The drop a player will actually be offered scales with where they are,
      // and widens again for a veteran winding down or one chasing a last
      // adventure, who really do go looking for it.
      const dropRoom = isStart ? (home ? 55 : 30) : target * (loosen ? 0.55 : 0.3) + (home ? 8 : 0);
      const band = lvl > target ? 18 : Math.max(12, dropRoom);
      const fit = 1 - Math.abs(lvl - target) / band;
      if (fit > 0) candidates.push({ c, l, lvl, fit });
    }
  }
  if (!candidates.length) return [];

  // Home-country pull is U-shaped across a career: strongest breaking through
  // and again when winding down, weakest at the peak when the whole world calls.
  const late = p.age >= 33 || retirementPressure(p) > 0;
  const early = isStart || p.seasonsPlayed <= 2;
  const homeWeight = early ? 7 : late ? 4.5 : 1.6;

  // A player chasing one last adventure draws romantic offers: far-off or
  // much weaker leagues get heavily upweighted for one window.
  const adventurous = career.adventure && !isStart;
  const homeBias = (cand) => {
    let w = 1;
    if (cand.c.code === p.nationality) w *= homeWeight;
    else if (cand.c.confederation === nationConfederation(career)) w *= early || late ? 1.8 : 1.15;
    if (adventurous) {
      if (cand.c.confederation !== career.club?.confederation) w *= 3;
      if (cand.lvl < target * 0.75) w *= 2.5;
    }
    return w;
  };
  const count = isStart ? 3 : irand(2, 4);

  // One of a youngster's first offers can come from a big club — its academy
  // or reserve side, or the bottom of a first division. The football there is
  // a level above him, which the season will show in his minutes; the reward
  // is training and a shop window. Where he starts is his to weigh.
  const academy = [];
  if (isStart) {
    for (const c of idx) {
      for (const l of c.leagues) {
        if (l.clubs < 6 || l.tier > 2) continue;
        const lvl = leagueLevel(countryCoeff(c.code, c.confederation), l.tier);
        if (lvl >= 52) academy.push({ c, l, lvl, fit: 1 });
      }
    }
  }

  // Breaking through and winding down, a player is courted from home. Reserve
  // slots for home-country clubs outright rather than trusting the weighting —
  // and where the home association has no playable league in the data, fall
  // back to its confederation so the pull still reads as "close to home".
  const homePool = candidates.filter((x) => x.c.code === p.nationality);
  const confedPool = candidates.filter((x) => x.c.confederation === nationConfederation(career));
  const nearHome = homePool.length ? homePool : confedPool;
  let reserved = 0;
  if (nearHome.length) reserved = early ? Math.min(2, count) : late ? 1 : 0;

  const offers = [];
  const seen = new Set();
  const academySlot = isStart && academy.length ? 1 : 0;
  for (let i = 0; i < count * 5 && offers.length < count; i++) {
    const useAcademy = academySlot && offers.length === count - 1;
    const useHome = !useAcademy && offers.length < reserved && nearHome.length;
    const pool = useAcademy ? academy : useHome ? nearHome : candidates;
    // The academy slot leans hard on home and on the size of the club: a big
    // side near home is the offer that means something to a seventeen-year-old.
    const cand = useAcademy
      ? weightedPick(pool, (x) => Math.pow(homeBias(x), 2) * Math.pow(x.lvl / 60, 1.5))
      : weightedPick(pool, (x) => Math.max(0.01, x.fit) * homeBias(x));
    const all = await clubsOf(cand.c.code, cand.l.tier);
    // A career is not spent at Jong Genk: reserve sides play in the division
    // but do not sign professionals from outside. Breaking through is the
    // exception — an academy or reserve side of a bigger club is exactly how
    // a seventeen-year-old gets started.
    const senior = isStart ? all : all.filter((cl) => !isReserveSide(cl.name));
    const clubs = senior.length >= 4 ? senior : all;
    if (!clubs.length) continue;
    if (useAcademy) {
      // The reserve side if the club has one in this division, otherwise the
      // club least likely to have a first-team place already spoken for.
      const reserves = clubs.filter((cl) => isReserveSide(cl.name));
      const pickFrom = reserves.length ? reserves
        : [...clubs].sort((a, b) => clubStature(a.name) - clubStature(b.name)).slice(0, 5);
      const chosen = pick(pickFrom);
      const key0 = cand.c.code + chosen.name;
      if (!seen.has(key0)) {
        seen.add(key0);
        offers.push({
          clubName: chosen.name,
          tsdbTeamId: chosen.tsdbTeamId ?? null,
          colors: chosen.colors || null,
          ...leagueRef(cand.c, { tier: cand.l.tier, name: cand.l.name, tsdbLeagueId: cand.l.tsdbLeagueId }),
          wage: Math.round((40 + Math.pow(cand.lvl, 1.5) * 1.2) * (0.8 + rand() * 0.4)) * 5,
          years: irand(2, 3),
          loan: false
        });
      }
      continue;
    }
    // Real Madrid do not call a 60-rated player who has just been relegated.
    // Where the player sits relative to the division decides which of its
    // clubs is interested: the champions at the top, the strugglers at the
    // bottom, and a spread of noise around it.
    // Where the player stands relative to this division, on the same scale the
    // season uses: half a division above its ordinary starter is a club near
    // the top, well below it is a club near the bottom.
    const fits = clamp(0.5 + (p.ability + p.reputation * 0.12 - cand.lvl * 0.88) / 30 +
      standing * 0.2 + promise * 0.25, 0, 1);
    // Clubs well above where the player stands do not call at all, and among
    // those that might, the closest match is heavily favoured. Without the
    // gate, a squared weight still leaves a champion picking up a 30-year-old
    // who is a division below them once in a hundred windows.
    const reachable = clubs.filter((cl) => clubStature(cl.name) - fits <= 0.35);
    const clubPool = reachable.length ? reachable : clubs;
    const club = weightedPick(clubPool, (cl) => 1 / Math.pow(0.1 + Math.abs(clubStature(cl.name) - fits), 2));
    const key = cand.c.code + club.name;
    if (seen.has(key) || club.name === career.club?.name) continue;
    seen.add(key);
    const wage = Math.round((50 + Math.pow(cand.lvl, 1.7) * 3) * (0.8 + rand() * 0.5) *
      (p.agent === 'shark' ? 1.2 : 1)) * 5;
    const loan = !isStart && cand.lvl < target - 8 && chance(0.3);
    offers.push({
      clubName: club.name,
      tsdbTeamId: club.tsdbTeamId ?? null,
      colors: club.colors || null,
      ...leagueRef(cand.c, { tier: cand.l.tier, name: cand.l.name, tsdbLeagueId: cand.l.tsdbLeagueId }),
      wage,
      years: loan ? 1 : irand(2, 4),
      loan
    });
  }
  return offers;
}

export async function acceptOffer(career, offer) {
  const idx = await loadIndex();
  const entry = idx.find((c) => c.code === offer.country);
  career.club = {
    name: offer.clubName,
    tsdbTeamId: offer.tsdbTeamId,
    colors: offer.colors,
    country: offer.country,
    countryName: offer.countryName,
    confederation: offer.confederation,
    tier: offer.tier,
    leagueName: offer.leagueName,
    tsdbLeagueId: offer.tsdbLeagueId
  };
  career.player.wage = offer.wage;
  career.player.contractYears = offer.years;
  career.yearsAtClub = 0;
  // A new club comes with its own standing in its own division; the quality
  // the last one had carried is not the player's to bring with them.
  career.clubQuality = null;
  career.player.captain = false;
  career.continental = null;
  await refreshLeagueContext(career, entry);
  career.news.unshift({ tone: 'good', text: offer.loan
    ? `You join ${career.club.name} (${career.club.leagueName}, ${career.club.countryName}) on a season-long loan.`
    : `You sign for ${career.club.name} (${career.club.leagueName}, ${career.club.countryName}) on ${fmtWage(offer.wage)} a week.` });
  beginSeason(career);
  saveCareer(career);
}

async function refreshLeagueContext(career, idxEntry) {
  const data = await loadCountry(career.club.country);
  const leagues = playableLeagues(data);
  const lg = leagues.find((l) => l.tier === career.club.tier);
  career.leagueClubs = lg ? lg.clubs.map((c) => ({ name: c.name, tsdbTeamId: c.tsdbTeamId ?? null, colors: c.colors || null })) : [];
  if (!career.leagueClubs.find((c) => c.name === career.club.name)) {
    career.leagueClubs.push({ name: career.club.name, tsdbTeamId: career.club.tsdbTeamId, colors: career.club.colors });
  }
  career.hasHigherTier = leagues.some((l) => l.tier === career.club.tier - 1);
  career.hasLowerTier = leagues.some((l) => l.tier === career.club.tier + 1);
}

// ---------- Season flow ----------

// How likely this season is to turn on a decision at all. Most seasons are
// just football: a career should be punctuated by a handful of these, not
// interrupted by one every August. A young career and a contract year throw up
// more of them, and two in consecutive seasons is deliberately unlikely.
function cardChance(career) {
  const p = career.player;
  let c = 0.34;
  if (p.age <= 21) c += 0.14;
  if (p.contractYears === 1) c += 0.12;
  if (p.morale < 45) c += 0.08;
  if (career.lastCardYear === career.year - 1) c -= 0.2;
  return clamp(c, 0.1, 0.6);
}

function beginSeason(career) {
  career.flags = {};
  const drawn = chance(cardChance(career)) ? drawSeasonEvents(career, 1) : [];
  if (drawn.length) career.lastCardYear = career.year;
  career.pendingEvents = drawn.map((e) => e.id);
  // Rare career-threatening injury interjection (~0.6%/season on average).
  if (chance(0.003 + career.player.injuryProne * 0.005 + (career.player.age > 30 ? 0.003 : 0))) {
    career.pendingEvents.splice(irand(0, career.pendingEvents.length), 0, '__grave-injury');
  }
  career.eventIdx = 0;
  career.phase = career.pendingEvents.length ? 'event' : 'review';
}

export function currentEvent(career) {
  if (career.phase !== 'event') return null;
  const id = career.pendingEvents[career.eventIdx];
  if (!id) return null;
  if (id === '__grave-injury') return graveInjuryEvent(career);
  const e = getEventById(id);
  if (!e) return null;
  return {
    id: e.id,
    title: e.title,
    text: e.text(career),
    // The odds shown are the very same number the outcome is rolled against,
    // and each side is labelled with the OVR it carries, so a card can never
    // advertise one thing and deliver another.
    // A rating cannot pass 99 or fall below 20, so a card at the ceiling shows
    // what it can actually deliver rather than a rise that will not arrive.
    choices: e.choices.map((ch, i) => {
      const now = Math.round(career.player.ability);
      return {
        i,
        label: ch.label,
        art: ch.art || 'pitch',
        risk: {
          p: choiceOdds(ch, career),
          up: clamp(choiceOvr(ch, true), -(now - 20), 99 - now),
          down: clamp(choiceOvr(ch, false), -(now - 20), 99 - now)
        }
      };
    })
  };
}

// Probability that a choice goes the player's way, 0..1 (1 = no gamble).
function choiceOdds(choice, career) {
  const p = typeof choice.odds === 'function' ? choice.odds(career) : choice.odds;
  return typeof p === 'number' ? clamp(p, 0.05, 0.95) : 1;
}

function choiceOvr(choice, won) {
  const swing = choice.ovr || [0, 0];
  return won ? swing[0] || 0 : swing[1] || 0;
}

function graveInjuryEvent(career) {
  return {
    id: '__grave-injury',
    title: 'A sickening moment',
    text: 'A crunching challenge leaves you in hospital. The surgeon is blunt: this is a career-threatening injury. How you respond will define everything.',
    choices: [
      { i: 0, label: 'Fight through rehabilitation', art: 'gym', risk: { p: 0.65, up: -4, down: 0 } },
      { i: 1, label: 'Retire on medical advice', art: 'quiet', risk: { p: 1, up: 0, down: 0 } }
    ]
  };
}

export function chooseEventOption(career, choiceIdx) {
  const id = career.pendingEvents[career.eventIdx];
  let outcome;
  if (id === '__grave-injury') {
    if (choiceIdx === 1) {
      outcome = { text: 'You announce your retirement from a hospital bed. Football mourns with you.', tone: 'bad', fx: {} };
      career.player.careerEnded = true;
    } else {
      outcome = chance(0.65)
        ? { text: 'Eighteen agonising months later, you run out to a standing ovation. You are back.', tone: 'gold', fx: { injuryWeeks: 30, ability: -4, morale: 10, reputation: 4 } }
        : { text: 'The comeback attempt fails. Your body cannot do it any more.', tone: 'bad', fx: {} };
      if (outcome.fx.injuryWeeks === undefined) career.player.careerEnded = true;
    }
  } else {
    const e = getEventById(id);
    const choice = e.choices[choiceIdx];
    // One roll decides everything: which branch is told, what it does to the
    // player, and the OVR that goes with it. Text and numbers cannot diverge.
    const p = choiceOdds(choice, career);
    const won = p >= 1 || chance(p);
    outcome = { ...(won ? choice.good(career) : choice.bad(career)) };
    outcome.ovrDelta = choiceOvr(choice, won);
    career.usedEventIds.push(id);
  }
  // Effects may carry their own ability change (a comeback that costs a yard
  // of pace); the outcome screen reports the whole movement, not part of it.
  const before = Math.round(career.player.ability);
  applyEffects(career, outcome.fx || {});
  p_applyOvr(career, outcome.ovrDelta || 0);
  outcome.ovrDelta = Math.round(career.player.ability) - before;
  career.news.unshift({ tone: outcome.tone, text: outcome.text });
  career.lastOutcome = { title: (id === '__grave-injury') ? 'A sickening moment' : getEventById(id).title, ...outcome };
  career.eventIdx += 1;
  if (career.player.careerEnded) {
    career.phase = 'review';
  } else if (career.eventIdx >= career.pendingEvents.length) {
    career.phase = 'review';
  }
  saveCareer(career);
  return outcome;
}

function p_applyOvr(career, delta) {
  career.player.ability = clamp(career.player.ability + delta, 20, 99);
}

function applyEffects(career, fx) {
  const p = career.player;
  if (fx.ability) p.ability = clamp(p.ability + fx.ability, 20, 99);
  if (fx.form) p.form = clamp(p.form + fx.form, 0, 100);
  if (fx.morale) p.morale = clamp(p.morale + fx.morale, 0, 100);
  if (fx.reputation) p.reputation = clamp(p.reputation + fx.reputation, 0, 100);
  if (fx.fitness) p.fitness = clamp(p.fitness + fx.fitness, 0, 100);
  if (fx.injuryWeeks) career.flags.injuryWeeks = (career.flags.injuryWeeks || 0) + fx.injuryWeeks;
  if (fx.wageMult) p.wage = Math.round(p.wage * fx.wageMult / 5) * 5;
  if (fx.wageBonus) p.wage += fx.wageBonus;
  if (fx.contractYears) p.contractYears = fx.contractYears;
  if (fx.listed) career.flags.listed = true;
  if (fx.captain) p.captain = true;
  if (fx.retrain) p.retrained = fx.retrain;
  if (fx.agent) p.agent = fx.agent;
  if (fx.bonusGoals) career.flags.bonusGoals = fx.bonusGoals;
  if (fx.intlBoost) career.flags.intlBoost = fx.intlBoost;
  if (fx.adventure) career.adventure = true;
  if (fx.forceOffers) career.forceOffers = true;
  if (fx.bigMove) career.bigMove = true;
}

// Runs the season sim; returns the report. Career remains in 'review' phase.
export function runSeason(career) {
  if (career.player.careerEnded) {
    career.report = { news: [], trophies: [], awards: [], stats: { apps: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, possible: 0, rating: 0 }, position: null, table: [], year: career.year, cut: true };
    return finishSeason(career);
  }
  const report = simulateSeason(career);
  career.report = report;
  return finishSeason(career);
}

function finishSeason(career) {
  const p = career.player;
  const report = career.report;

  // Record history + trophies.
  career.trophies.push(...(report.trophies || []));
  for (const n of report.news || []) career.news.unshift(n);
  // A season's performance — minutes above all, then output and rating — is
  // what moves a player's overall rating. Decisions nudge it; football decides it.
  //
  // Where that season was played counts for as much as what it contained. The
  // same thirty games and eight goals are worth far more in a great league
  // than in a fourth division, and more again at a club good enough to be
  // challenging in it: better team-mates, harder opponents, bigger occasions.
  const lvl = leagueLevel(countryCoeff(career.club.country, career.club.confederation), career.club.tier);
  const standard = clamp(0.7 + Math.pow(clamp(lvl / 95, 0, 1.1), 1.5) * 0.8, 0.7, 1.5);
  const clubFactor = clamp(0.9 + ((career.clubQuality ?? lvl) / Math.max(8, lvl) - 1) * 0.55, 0.88, 1.14);
  const perf = report.cut ? 0 : seasonPerformance(report.stats, effectiveRole(p)) * standard * clubFactor;
  report.performance = perf;
  const ovrBefore = Math.round(p.ability);

  career.history.push({
    year: career.year,
    age: p.age,
    ovr: ovrBefore,
    club: career.club.name,
    clubTsdbTeamId: career.club.tsdbTeamId ?? null,
    clubColors: career.club.colors || null,
    country: career.club.country,
    league: career.club.leagueName,
    leagueTsdbId: career.club.tsdbLeagueId ?? null,
    tier: career.club.tier,
    position: report.position,
    apps: report.stats.apps,
    possible: report.stats.possible ?? 0,
    goals: report.stats.goals,
    assists: report.stats.assists,
    cleanSheets: report.stats.cleanSheets,
    saves: report.stats.saves ?? 0,
    rating: report.stats.rating,
    role: effectiveRole(p).key,
    trophies: (report.trophies || []).map((t) => t.name),
    awards: report.awards || []
  });

  // Development, ageing, contract. The standard of the division sets how far
  // a player can be carried by it: the way past that is a move upward.
  revisePotential(p, perf);
  const grew = developPlayer(p, perf, clamp(lvl + 22, 40, 99));
  // A season good enough to improve a player, at a level that cannot improve
  // them any further, is the game telling them to move.
  report.outgrewLevel = grew.capped;
  report.ovrBefore = ovrBefore;
  report.ovrAfter = Math.round(p.ability);
  report.ovrDelta = report.ovrAfter - ovrBefore;
  agePlayer(p);
  p.contractYears = Math.max(0, p.contractYears - 1);
  career.yearsAtClub += 1;
  career.clubSeasons[career.club.name] = (career.clubSeasons[career.club.name] || 0) + 1;
  if (career.clubSeasons[career.club.name] > (career.longestClub.seasons || 0)) {
    career.longestClub = { name: career.club.name, seasons: career.clubSeasons[career.club.name] };
  }
  p.form = clamp(50 + (p.form - 50) * 0.4 + (report.stats.rating - 6.6) * 8, 15, 95);
  p.morale = clamp(p.morale + (report.position && report.position <= 4 ? 4 : -2), 10, 95);

  // Reputation is earned mainly by performing at a level — dominating a weak
  // division counts for less than holding your own in a strong one. Decision
  // events nudge it either way, but this is the engine of a career's standing.
  const target = clamp(
    lvl * 0.85 + (report.stats.rating - 6.6) * 18 + (report.champion ? 8 : 0) +
    (report.trophies || []).length * 3,
    0, 100
  );
  p.reputation = clamp(p.reputation + (target - p.reputation) * 0.4, 0, 100);

  // Movement between tiers.
  if (report.promoted) career.club.tier -= 1;
  if (report.relegated) career.club.tier += 1;
  career.pendingTierRefresh = report.promoted || report.relegated;
  career.continentalNext = report.nextContinental || null;

  career.phase = 'postseason';
  saveCareer(career);
  return report;
}

// Decide retirement or continue; generate offers for next season.
export async function advanceToNextSeason(career) {
  const p = career.player;
  if (p.careerEnded || (retirementPressure(p) > 0 && chance(retirementPressure(p)) ) || p.age >= 40) {
    return retire(career);
  }

  career.year += 1;
  career.continental = career.continentalNext ? { ...career.continentalNext } : null;

  if (career.pendingTierRefresh) {
    const idx = await loadIndex();
    const entry = idx.find((c) => c.code === career.club.country);
    const data = await loadCountry(career.club.country);
    const leagues = playableLeagues(data);
    const lg = leagues.find((l) => l.tier === career.club.tier);
    if (lg) {
      career.club.leagueName = lg.name;
      career.club.tsdbLeagueId = lg.tsdbLeagueId ?? null;
      await refreshLeagueContext(career, entry);
    }
    career.pendingTierRefresh = false;
  }

  // Transfer window: offers arrive when in demand, listed, or out of contract.
  // A decision that pushed for a move guarantees the phone rings.
  const wantOffers = career.forceOffers || career.flags.listed || p.contractYears === 0 ||
    (p.reputation > 30 && chance(0.45)) || chance(0.2);
  career.offers = wantOffers ? await generateOffers(career) : [];
  career.adventure = false;
  career.forceOffers = false;
  career.bigMove = false;
  if (p.contractYears === 0 && !career.offers.length) {
    // Out of contract with no suitors: the club offers a modest one-year deal.
    career.offers = [];
    p.contractYears = 1;
    p.wage = Math.round(p.wage * 0.85 / 5) * 5;
    career.news.unshift({ tone: 'neutral', text: `No suitors emerged; you sign a one-year extension at ${career.club.name}.` });
  }
  career.phase = career.offers.length ? 'offers' : 'preseason';
  if (career.phase === 'preseason') beginSeason(career);
  saveCareer(career);
  return null;
}

export function stayAtClub(career) {
  const p = career.player;
  if (p.contractYears === 0) {
    p.contractYears = irand(1, 2);
    career.news.unshift({ tone: 'neutral', text: `You renew with ${career.club.name} for ${p.contractYears} more year${p.contractYears > 1 ? 's' : ''}.` });
  }
  career.offers = [];
  career.flags.listed = false;
  beginSeason(career);
  saveCareer(career);
}

export function retire(career) {
  career.retired = true;
  career.phase = 'retired';
  // Testimonial: eight or more seasons at one club.
  if ((career.longestClub.seasons || 0) >= 8) {
    career.testimonial = career.longestClub.name;
    career.trophies.push({ type: 'special', name: `Testimonial Match — ${career.longestClub.name}`, year: career.year });
  }
  saveCareer(career);
  archiveCareer(career);
  return career;
}

// ---------- Persistence ----------

export function saveCareer(career) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(career)); } catch { /* storage full/unavailable */ }
}

export function loadCareer() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    // Saves from an older format lack the fields the timeline needs.
    if (c.v !== SAVE_VERSION) { localStorage.removeItem(SAVE_KEY); return null; }
    return c;
  } catch { return null; }
}

export function clearCareer() {
  localStorage.removeItem(SAVE_KEY);
}

function archiveCareer(career) {
  try {
    const hall = JSON.parse(localStorage.getItem(HALL_KEY) || '[]');
    hall.unshift({
      name: career.player.name,
      nationality: career.player.nationality,
      retiredYear: career.year,
      seasons: career.player.seasonsPlayed,
      trophies: career.trophies.length,
      savedAt: Date.now(),
      career
    });
    localStorage.setItem(HALL_KEY, JSON.stringify(hall.slice(0, 12)));
  } catch { /* ignore */ }
}

export function loadHall() {
  try { return JSON.parse(localStorage.getItem(HALL_KEY) || '[]'); } catch { return []; }
}

export function fmtWage(w) {
  return '£' + w.toLocaleString('en-GB');
}
