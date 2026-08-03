// Simulates one full season: league, domestic cup, continental competition,
// internationals, stats, awards, promotion/relegation.
import { rand, chance, irand, clamp, noise, strHash } from './rng.js';
import { clubStrength, leagueLevel, countryCoeff } from './data.js';
import {
  domesticCupName, CONTINENTAL, continentalSlots,
  continentalTournamentInYear, isWorldCupYear, WORLD_CUP, AWARDS
} from './competitions.js';
import { effectivePosition } from './player.js';

// How well the player matches the level of their league (>1 = above the level).
function levelRatio(player, level) {
  return player.ability / Math.max(18, level);
}

function playerSeasonStats(career, level, injuryWeeks) {
  const p = career.player;
  const pos = effectivePosition(p);
  const ratio = levelRatio(p, level);
  const availability = clamp(1 - injuryWeeks / 40, 0.1, 1);
  // Selection share: dominant if above the level, rotation if below.
  let share = clamp(0.15 + (ratio - 0.75) * 1.4 + (p.form - 50) / 250, 0.05, 0.97);
  share *= availability;
  const leagueGames = 34 + irand(0, 8);
  const apps = Math.round(leagueGames * share);
  const quality = clamp(ratio * 0.55 + p.form / 200 + p.morale / 400 + noise() * 0.08, 0.15, 1.35);

  let goals = 0, assists = 0, cleanSheets = 0;
  const per90 = { GK: 0, DEF: 0.06, MID: 0.22, FWD: 0.62 }[pos];
  const aper90 = { GK: 0.01, DEF: 0.08, MID: 0.28, FWD: 0.22 }[pos];
  goals = Math.round(apps * per90 * quality * (0.7 + rand() * 0.6));
  assists = Math.round(apps * aper90 * quality * (0.7 + rand() * 0.6));
  if (pos === 'GK') cleanSheets = Math.round(apps * clamp(0.2 + quality * 0.25, 0.1, 0.6));
  goals += career.flags.bonusGoals || 0;

  const rating = clamp(5.6 + quality * 1.6 + noise() * 0.25, 5.0, 9.8);
  return { apps, goals, assists, cleanSheets, rating: Math.round(rating * 100) / 100, quality: clamp(quality, 0, 1.2), share };
}

// Rank all clubs in the league; returns table array of {name, pts} sorted.
function simulateTable(career, level) {
  const clubs = career.leagueClubs;
  const n = clubs.length;
  const games = (n - 1) * 2;
  const rows = clubs.map((c) => {
    let s = clubStrength(c.name, level);
    if (c.name === career.club.name) {
      const contrib = clamp((career.player.ability - level) / 100, -0.1, 0.35) *
        clamp(career.lastStats?.share ?? 0.6, 0.2, 1);
      s *= 1 + contrib + (career.player.captain ? 0.03 : 0);
    }
    s *= 1 + noise() * 0.16;
    const ppg = clamp(0.7 + (s / level) * 0.75 + noise() * 0.18, 0.35, 2.55);
    return { name: c.name, pts: Math.round(ppg * games) };
  });
  rows.sort((a, b) => b.pts - a.pts);
  return rows;
}

function knockoutRun(teamStr, fieldStr, roundsNames) {
  // Returns { reached, won } — reached is index into roundsNames (last = champion).
  let reached = -1;
  for (let i = 0; i < roundsNames.length; i++) {
    const oppStr = fieldStr * (0.75 + (i / roundsNames.length) * 0.45) * (1 + noise() * 0.15);
    const pWin = clamp(teamStr / (teamStr + oppStr), 0.08, 0.92);
    if (chance(pWin)) reached = i; else break;
  }
  return { reached, won: reached === roundsNames.length - 1 };
}

const CUP_ROUNDS = ['Second Round', 'Third Round', 'Quarter-final', 'Semi-final', 'Final'];
const CONT_ROUNDS = ['League Phase', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
const TOURN_ROUNDS = ['Group Stage', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];

export function simulateSeason(career) {
  const p = career.player;
  const report = { news: [], trophies: [], awards: [], year: career.year };
  const coeff = countryCoeff(career.club.country, career.club.confederation);
  const level = leagueLevel(coeff, career.club.tier);
  const injuryWeeks = career.flags.injuryWeeks || 0;

  // ----- Player + league -----
  const stats = playerSeasonStats(career, level, injuryWeeks);
  career.lastStats = stats;
  const table = simulateTable(career, level);
  const position = table.findIndex((r) => r.name === career.club.name) + 1;
  const n = table.length;
  report.stats = stats;
  report.table = table;
  report.position = position;

  if (injuryWeeks > 0) {
    report.news.push({ tone: 'bad', text: `Injury kept you out for ${injuryWeeks} weeks of the season.` });
  }

  // Champion / promotion / relegation flags (applied by career.js).
  const promotedSlots = n >= 16 ? 3 : 2;
  const relegatedSlots = n >= 16 ? 3 : 2;
  report.champion = position === 1;
  report.promoted = career.club.tier > 1 && career.hasHigherTier && position <= promotedSlots;
  report.relegated = career.hasLowerTier && position > n - relegatedSlots;

  if (report.champion) {
    report.trophies.push({ type: 'league', name: career.club.leagueName, year: career.year, tsdbLeagueId: career.club.tsdbLeagueId ?? null });
    report.news.push({ tone: 'gold', text: `${career.club.name} are champions of the ${career.club.leagueName}!` });
  } else if (report.promoted) {
    report.news.push({ tone: 'good', text: `Promotion! ${career.club.name} finish ${ordinal(position)} and go up.` });
  } else if (report.relegated) {
    report.news.push({ tone: 'bad', text: `Relegation. ${career.club.name} finish ${ordinal(position)} and drop down a division.` });
  }

  // Continental qualification for NEXT season (tier 1 only).
  const comps = CONTINENTAL[career.club.confederation] || [];
  report.nextContinental = null;
  if (career.club.tier === 1 && comps.length) {
    const slots = continentalSlots(coeff);
    if (position <= slots.primary) report.nextContinental = comps[0];
    else if (comps[1] && position <= slots.primary + slots.secondary) report.nextContinental = comps[1];
    else if (comps[2] && position === slots.primary + slots.secondary + 1) report.nextContinental = comps[2];
  }

  // ----- Domestic cup -----
  const cupName = domesticCupName(career.club.country, career.club.countryName);
  const teamStr = clubStrength(career.club.name, level) * (1 + stats.quality * 0.12);
  const cupField = leagueLevel(coeff, 1) * 0.9;
  const cup = knockoutRun(teamStr, cupField, CUP_ROUNDS);
  if (cup.won) {
    report.trophies.push({ type: 'cup', name: cupName, year: career.year, tsdbLeagueId: null });
    report.news.push({ tone: 'gold', text: `${career.club.name} lift the ${cupName}!` });
  } else if (cup.reached >= 2) {
    report.news.push({ tone: 'neutral', text: `A ${cupName} run ends at the ${CUP_ROUNDS[cup.reached + 1] ?? 'final hurdle'}.` });
  }
  report.cup = { name: cupName, reachedName: cup.won ? 'Winners' : cup.reached >= 0 ? CUP_ROUNDS[cup.reached] : 'Early exit', won: cup.won };

  // ----- Continental club competition (qualified last season) -----
  if (career.continental) {
    const comp = career.continental;
    const contField = 70 * (comp.prestige / 100);
    const run = knockoutRun(teamStr * 1.05, contField, CONT_ROUNDS);
    if (run.won) {
      report.trophies.push({ type: 'continental', name: comp.name, year: career.year, tsdbLeagueId: null, key: comp.key });
      report.news.push({ tone: 'gold', text: `${career.club.name} are ${comp.name} champions — the pinnacle of club football on the continent!` });
      p.reputation = clamp(p.reputation + 10, 0, 100);
    } else if (run.reached >= 0) {
      report.news.push({ tone: 'neutral', text: `The ${comp.name} adventure ends at the ${CONT_ROUNDS[Math.min(run.reached + 1, CONT_ROUNDS.length - 1)]}.` });
      p.reputation = clamp(p.reputation + run.reached, 0, 100);
    } else {
      report.news.push({ tone: 'neutral', text: `An early exit from the ${comp.name}.` });
    }
    report.continentalRun = { name: comp.name, won: run.won };
  }

  // ----- Internationals -----
  simulateInternationals(career, report, stats);

  // ----- Awards -----
  const posKey = effectivePosition(p);
  if (posKey === 'FWD' && stats.goals >= 22 && chance(0.5 + (stats.goals - 22) * 0.06)) {
    report.awards.push(AWARDS.goldenBoot);
    report.trophies.push({ type: 'award', name: `${AWARDS.goldenBoot} — ${career.club.leagueName}`, year: career.year });
  }
  if (posKey === 'GK' && stats.cleanSheets >= 16 && chance(0.5)) {
    report.awards.push(AWARDS.goldenGlove);
    report.trophies.push({ type: 'award', name: `${AWARDS.goldenGlove} — ${career.club.leagueName}`, year: career.year });
  }
  if (stats.rating >= 7.6 && chance(clamp((stats.rating - 7.5) * 1.4, 0.1, 0.85))) {
    report.awards.push(AWARDS.playerOfSeason);
    report.trophies.push({ type: 'award', name: `${AWARDS.playerOfSeason} — ${career.club.leagueName}`, year: career.year });
  }
  if (p.age <= 21 && stats.rating >= 7.3 && chance(0.4)) {
    report.awards.push(AWARDS.youngPlayer);
    report.trophies.push({ type: 'award', name: AWARDS.youngPlayer, year: career.year });
  }
  const worldStage = coeff >= 75 && career.club.tier === 1;
  if (worldStage && p.ability >= 88 && stats.rating >= 7.8 && (report.champion || report.continentalRun?.won) && chance(0.45)) {
    report.awards.push(AWARDS.worldBest);
    report.trophies.push({ type: 'award', name: AWARDS.worldBest, year: career.year });
    report.news.push({ tone: 'gold', text: `You are named ${AWARDS.worldBest} — the world’s best footballer.` });
    p.reputation = 100;
  }

  return report;
}

function simulateInternationals(career, report, stats) {
  const p = career.player;
  const nation = career.nation; // {code, name, confederation}
  const natStr = countryCoeff(nation.code, nation.confederation);
  const threshold = clamp(70 - natStr * 0.55, 10, 68) - (career.flags.intlBoost || 0);
  const called = p.reputation >= threshold && stats.apps >= 8 && p.age >= 18;
  report.international = null;
  if (!called) {
    if (p.caps > 0 && p.age >= 33 && chance(0.4)) {
      report.news.push({ tone: 'neutral', text: `The ${nation.name} selectors look to youth; no call-up this year.` });
    }
    return;
  }

  const newCaps = irand(2, 8);
  p.caps += newCaps;
  const intlGoals = effectivePosition(p) === 'FWD' ? irand(0, Math.ceil(newCaps / 2)) : effectivePosition(p) === 'MID' ? irand(0, 2) : 0;
  p.intlGoals += intlGoals;
  report.news.push({ tone: 'good', text: `${newCaps} more caps for ${nation.name}${intlGoals ? ` (${intlGoals} international goal${intlGoals > 1 ? 's' : ''})` : ''}. Total: ${p.caps}.` });
  report.international = { caps: newCaps, goals: intlGoals };

  const teamStr = natStr * (1 + noise() * 0.1) + p.ability * 0.08;

  const cont = continentalTournamentInYear(nation.confederation, career.year);
  if (cont) {
    const qualified = chance(clamp(natStr / 75, 0.15, 0.95));
    if (qualified) {
      const run = knockoutRun(teamStr, 62, TOURN_ROUNDS);
      if (run.won) {
        report.trophies.push({ type: 'international', name: cont.name, year: career.year });
        report.news.push({ tone: 'gold', text: `${nation.name} win the ${cont.name} — and you were part of it!` });
        p.reputation = clamp(p.reputation + 8, 0, 100);
      } else {
        report.news.push({ tone: 'neutral', text: `${nation.name} bow out of the ${cont.name} at the ${TOURN_ROUNDS[Math.min(run.reached + 1, 4)]}.` });
      }
    } else {
      report.news.push({ tone: 'bad', text: `${nation.name} miss out on ${cont.name} qualification.` });
    }
  }

  if (isWorldCupYear(career.year)) {
    const slotsFactor = { UEFA: 0.85, CONMEBOL: 0.9, CAF: 0.55, AFC: 0.55, CONCACAF: 0.6, OFC: 0.35 }[nation.confederation] || 0.5;
    const qualified = chance(clamp((natStr / 80) * slotsFactor, 0.05, 0.92));
    if (qualified) {
      const run = knockoutRun(teamStr, 68, TOURN_ROUNDS);
      if (run.won) {
        report.trophies.push({ type: 'international', name: WORLD_CUP.name, year: career.year });
        report.news.push({ tone: 'gold', text: `WORLD CHAMPIONS! ${nation.name} win the ${WORLD_CUP.name}!` });
        p.reputation = 100;
      } else {
        report.news.push({ tone: 'neutral', text: `${nation.name}'s ${WORLD_CUP.name} ends at the ${TOURN_ROUNDS[Math.min(run.reached + 1, 4)]}.` });
        p.reputation = clamp(p.reputation + 3, 0, 100);
      }
    } else {
      report.news.push({ tone: 'bad', text: `${nation.name} fall short of ${WORLD_CUP.name} qualification.` });
    }
  }
}

export function ordinal(nu) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = nu % 100;
  return nu + (s[(v - 20) % 10] || s[v] || s[0]);
}
