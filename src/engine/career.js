// Career state machine: creation, offers, events, season loop, saves.
import { seed, getSeed, rand, chance, irand, pick, clamp, weightedPick } from './rng.js';
import { loadAssociations, getAssociation, loadCountry, countryCoeff, leagueLevel, playableLeagues } from './data.js';
import { createPlayer, developPlayer, agePlayer, retirementPressure, effectivePosition } from './player.js';
import { drawSeasonEvents, getEventById } from './events.js';
import { simulateSeason } from './season.js';

const SAVE_KEY = 'fcsim.career';
const HALL_KEY = 'fcsim.hall';
const START_YEAR = 2026;

let index = null; // data index: [{code, country, confederation, leagues:[{tier,name,clubs,verified}]}]

export async function loadIndex() {
  if (index) return index;
  const res = await fetch('data/index.json');
  index = (await res.json()).countries;
  return index;
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
    v: 1,
    seed: getSeed(),
    year: START_YEAR,
    phase: 'offers',
    player,
    nation: { code: nation.code, name: nation.name, confederation: nation.confederation },
    club: null,
    leagueClubs: [],
    yearsAtClub: 0,
    rival: null,
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
  const target = isStart
    ? clamp(p.ability * 0.75 + rand() * 12, 8, 55)
    : clamp(p.ability * (0.9 + rand() * 0.25) + p.reputation * 0.15, 10, 105);

  const candidates = [];
  for (const c of idx) {
    for (const l of c.leagues) {
      if (l.clubs < 6) continue;
      const lvl = leagueLevel(countryCoeff(c.code, c.confederation), l.tier);
      const fit = 1 - Math.abs(lvl - target) / 30;
      if (fit > 0) candidates.push({ c, l, lvl, fit });
    }
  }
  if (!candidates.length) return [];

  const homeBias = (cand) => (cand.c.code === p.nationality ? 2.2 : 1);
  const count = isStart ? 3 : irand(2, 4);
  const offers = [];
  const seen = new Set();
  for (let i = 0; i < count * 3 && offers.length < count; i++) {
    const cand = weightedPick(candidates, (x) => Math.max(0.01, x.fit) * homeBias(x));
    const clubs = await clubsOf(cand.c.code, cand.l.tier);
    if (!clubs.length) continue;
    const club = pick(clubs);
    const key = cand.c.code + club.name;
    if (seen.has(key) || club.name === career.club?.name) continue;
    seen.add(key);
    const wage = Math.round((50 + Math.pow(cand.lvl, 1.7) * 3) * (0.8 + rand() * 0.5) *
      (p.agent === 'shark' ? 1.2 : 1)) * 5;
    offers.push({
      clubName: club.name,
      tsdbTeamId: club.tsdbTeamId ?? null,
      colors: club.colors || null,
      ...leagueRef(cand.c, { tier: cand.l.tier, name: cand.l.name, tsdbLeagueId: cand.l.tsdbLeagueId }),
      wage,
      years: irand(2, 4),
      loan: !isStart && cand.lvl < target - 8 && chance(0.3)
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
  career.player.captain = false;
  career.continental = null;
  await refreshLeagueContext(career, entry);
  // A rival: another club in the same division (a derby narrative anchor).
  const others = career.leagueClubs.filter((c) => c.name !== career.club.name);
  career.rival = others.length && chance(0.7) ? pick(others).name : null;
  career.news.unshift({ tone: 'good', text: `You sign for ${career.club.name} (${career.club.leagueName}, ${career.club.countryName}) on ${fmtWage(offer.wage)} a week.` });
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

function beginSeason(career) {
  career.flags = {};
  const nEvents = irand(3, 4);
  career.pendingEvents = drawSeasonEvents(career, nEvents).map((e) => e.id);
  // Rare career-threatening injury interjection.
  if (chance(0.012 + career.player.injuryProne * 0.012 + (career.player.age > 30 ? 0.008 : 0))) {
    career.pendingEvents.splice(irand(0, career.pendingEvents.length), 0, '__grave-injury');
  }
  career.eventIdx = 0;
  career.phase = 'event';
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
    choices: e.choices.map((ch, i) => ({ i, label: ch.label, sub: ch.sub }))
  };
}

function graveInjuryEvent(career) {
  return {
    id: '__grave-injury',
    title: 'A sickening moment',
    text: 'A crunching challenge leaves you in hospital. The surgeon is blunt: this is a career-threatening injury. How you respond will define everything.',
    choices: [
      { i: 0, label: 'Fight through brutal rehabilitation', sub: 'Long odds, but a road back' },
      { i: 1, label: 'Retire on medical advice', sub: 'Walk away with your health' }
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
      outcome = chance(0.55)
        ? { text: 'Eighteen agonising months later, you run out to a standing ovation. You are back.', tone: 'gold', fx: { injuryWeeks: 30, ability: -4, morale: 10, reputation: 4 } }
        : { text: 'The comeback attempt fails. Your body cannot do it any more.', tone: 'bad', fx: {} };
      if (outcome.fx.injuryWeeks === undefined) career.player.careerEnded = true;
    }
  } else {
    const e = getEventById(id);
    outcome = e.choices[choiceIdx].resolve(career);
    career.usedEventIds.push(id);
  }
  applyEffects(career, outcome.fx || {});
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
  if (fx.fanFavourite) career.flags.fanFavourite = true;
}

// Runs the season sim; returns the report. Career remains in 'review' phase.
export function runSeason(career) {
  if (career.player.careerEnded) {
    career.report = { news: [], trophies: [], awards: [], stats: { apps: 0, goals: 0, assists: 0, cleanSheets: 0, rating: 0 }, position: null, table: [], year: career.year, cut: true };
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
  career.history.push({
    year: career.year,
    club: career.club.name,
    country: career.club.country,
    league: career.club.leagueName,
    tier: career.club.tier,
    position: report.position,
    apps: report.stats.apps,
    goals: report.stats.goals,
    assists: report.stats.assists,
    cleanSheets: report.stats.cleanSheets,
    rating: report.stats.rating,
    trophies: (report.trophies || []).map((t) => t.name),
    awards: report.awards || []
  });

  // Development, ageing, contract.
  developPlayer(p, clamp((report.stats.rating - 5.8) / 3, 0, 1));
  agePlayer(p);
  p.contractYears = Math.max(0, p.contractYears - 1);
  career.yearsAtClub += 1;
  career.clubSeasons[career.club.name] = (career.clubSeasons[career.club.name] || 0) + 1;
  if (career.clubSeasons[career.club.name] > (career.longestClub.seasons || 0)) {
    career.longestClub = { name: career.club.name, seasons: career.clubSeasons[career.club.name] };
  }
  p.form = clamp(50 + (p.form - 50) * 0.4 + (report.stats.rating - 6.6) * 8, 15, 95);
  p.morale = clamp(p.morale + (report.position && report.position <= 4 ? 4 : -2), 10, 95);

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
      const others = career.leagueClubs.filter((c) => c.name !== career.club.name);
      career.rival = others.length && chance(0.5) ? pick(others).name : career.rival;
    }
    career.pendingTierRefresh = false;
  }

  // Transfer window: offers arrive when in demand, listed, or out of contract.
  const wantOffers = career.flags.listed || p.contractYears === 0 ||
    (p.reputation > 30 && chance(0.45)) || chance(0.2);
  career.offers = wantOffers ? await generateOffers(career) : [];
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
    return raw ? JSON.parse(raw) : null;
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
