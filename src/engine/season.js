// Simulates one full season: league, domestic cup, continental competition,
// internationals, stats, awards, promotion/relegation.
import { rand, chance, irand, clamp, noise } from './rng.js';
import { clubStrength, settleClubQuality, leagueLevel, countryCoeff } from './data.js';
import {
  domesticCupName, CONTINENTAL, continentalSlots,
  continentalTournamentInYear, isWorldCupYear, WORLD_CUP, AWARDS
} from './competitions.js';
import { effectiveRole, positionGroup } from './player.js';

// How far above (or below) the typical starter in this division the player is,
// in units of 12 ability points. 0 = an ordinary first-team player at this
// level, +1.5 = one of its best, -1.5 = squad filler.
function squadEdge(ability, level) {
  return (ability - level * 0.78) / 12;
}

// Managers protect teenagers and manage veterans' legs.
function ageMinutesFactor(age) {
  if (age <= 17) return 0.34;
  if (age === 18) return 0.5;
  if (age === 19) return 0.72;
  if (age === 20) return 0.88;
  if (age <= 32) return 1;
  if (age <= 34) return 0.93;
  if (age <= 36) return 0.84;
  return 0.7;
}

// Share of the club's matches the player starts, before injuries.
function selectionShare(career, level) {
  const p = career.player;
  const edge = squadEdge(p.ability, level);
  let share = 0.62 + edge * 0.2 + (p.form - 55) / 320 + (p.morale - 60) / 900;
  if (career.yearsAtClub === 0) share -= 0.05;   // settling in at a new club
  if (career.flags.listed) share -= 0.12;        // frozen out while listed
  if (p.captain) share += 0.04;
  share *= ageMinutesFactor(p.age);
  return clamp(share, 0.04, 0.95);
}

// A real season's fixture list: a double round-robin of whatever size the
// division actually is, so a 20-club league gives 38 games and a 12-club one
// gives 22 (plus the split/play-off rounds smaller leagues use).
function leagueFixtures(clubCount) {
  const n = clamp(clubCount || 18, 6, 24);
  const base = (n - 1) * 2;
  return clamp(n <= 12 ? Math.round(base * 1.4) : base, 14, 46);
}

// Matches played in a knockout run. `reached` is the index of the last round
// won (-1 = out at the first hurdle), so one more round was played and lost
// unless the run ended with the trophy.
function knockoutGames(reached, roundCount, won, twoLegged, firstStageGames = 0) {
  const played = won ? roundCount : Math.min(reached + 2, roundCount);
  let games = firstStageGames;
  for (let r = firstStageGames ? 1 : 0; r < played; r++) {
    games += twoLegged && r < roundCount - 1 ? 2 : 1;
  }
  return games;
}

function playerSeasonStats(career, level, load, injuryWeeks) {
  const p = career.player;
  const role = effectiveRole(p);
  const edge = squadEdge(p.ability, level);
  const availability = clamp(1 - injuryWeeks / 40, 0.08, 1);
  const share = selectionShare(career, level) * availability;

  // Cups mean rotation; continental nights are for the first choice XI.
  const appsBy = {
    league: Math.round(load.league * share),
    cup: Math.round(load.cup * share * 0.82),
    continental: Math.round(load.continental * share * 0.95)
  };
  const apps = Math.min(appsBy.league + appsBy.cup + appsBy.continental, load.total);

  // Standing above the division's ordinary starter, tempered by form and mood.
  // Being far too good for a league still tails off: even a great player only
  // scores so many, so gains above an outstanding season are halved.
  let quality = 0.6 + edge * 0.26 + (p.form - 55) / 240 + (p.morale - 60) / 600 + noise() * 0.09;
  if (quality > 1.05) quality = 1.05 + (quality - 1.05) * 0.45;
  quality = clamp(quality, 0.18, 1.35);

  let goals = 0, assists = 0, cleanSheets = 0, saves = 0;
  if (role.group === 'GK') {
    // A keeper in a strong side faces fewer shots but keeps more clean sheets.
    saves = Math.round(apps * clamp(3.4 - edge * 0.35, 1.5, 5.2) * (0.85 + rand() * 0.3));
    cleanSheets = Math.round(apps * clamp(0.16 + edge * 0.07 + quality * 0.08, 0.05, 0.55));
  } else {
    goals = Math.round(apps * role.goals * quality * (0.7 + rand() * 0.6));
    assists = Math.round(apps * role.assists * quality * (0.7 + rand() * 0.6));
  }
  goals += career.flags.bonusGoals || 0;

  const rating = clamp(6.55 + (quality - 0.6) * 2.0 + noise() * 0.22, 4.9, 9.5);
  return {
    apps, appsBy, possible: load.total, goals, assists, cleanSheets, saves,
    rating: Math.round(rating * 100) / 100,
    quality, share
  };
}

// Rank all clubs in the league; returns table array of {name, pts} sorted.
// The player's own club uses its carried-over quality rather than the
// division's baseline, so a side that has just come up plays like a side that
// has just come up.
function simulateTable(career, level, quality, share) {
  const clubs = career.leagueClubs;
  const n = clubs.length;
  const games = (n - 1) * 2;
  const rows = clubs.map((c) => {
    let s = clubStrength(c.name, level);
    if (c.name === career.club.name) {
      s = quality;
      const contrib = clamp((career.player.ability - level) / 130, -0.1, 0.22) * clamp(share, 0.2, 1);
      s *= 1 + contrib + (career.player.captain ? 0.03 : 0);
    }
    s *= 1 + noise() * 0.13;
    // Points per game across a real division run from about 0.8 for a side
    // that goes down to 2.3 for a champion; the strength spread is mapped onto
    // that range so a table looks like a table.
    const ppg = clamp(0.80 + (s / level - 0.7) * 2.3 + noise() * 0.16, 0.3, 2.55);
    return { name: c.name, pts: Math.round(ppg * games) };
  });
  rows.sort((a, b) => b.pts - a.pts);
  return rows;
}

// Cup football is not a coin toss weighted by a hair. Raising both sides to a
// power before comparing them makes a real gap in quality tell over a run of
// rounds, which is why the clubs that win continental trophies are the strong
// ones rather than whoever happened to qualify.
const KO_EDGE = 2.6;

function knockoutRun(teamStr, fieldStr, roundsNames) {
  // Returns { reached, won } — reached is index into roundsNames (last = champion).
  let reached = -1;
  for (let i = 0; i < roundsNames.length; i++) {
    const oppStr = fieldStr * (0.75 + (i / roundsNames.length) * 0.45) * (1 + noise() * 0.15);
    const a = Math.pow(Math.max(1, teamStr), KO_EDGE);
    const b = Math.pow(Math.max(1, oppStr), KO_EDGE);
    const pWin = clamp(a / (a + b), 0.04, 0.94);
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

  // ----- The club's campaigns, which decide how many matches there are -----
  // The club's quality is carried between seasons and only drifts toward what
  // its standing is worth in its current division, so promotion is survived
  // rather than sailed through, and a regular in Europe grows into a contender.
  const quality = settleClubQuality(career.clubQuality, career.club.name, level);
  career.clubQuality = quality;
  report.clubQuality = quality;

  const teamStr = quality * (1 + clamp(squadEdge(p.ability, level), -0.15, 0.35) * 0.12);

  const cupName = domesticCupName(career.club.country, career.club.countryName);
  const cupField = leagueLevel(coeff, 1) * 0.9;
  const cup = knockoutRun(teamStr, cupField, CUP_ROUNDS);

  let cont = null;
  if (career.continental) {
    const comp = career.continental;
    // A continental field is made of the best sides on the continent, so the
    // bar is set by them and not by the entrant's own league. Winning the
    // Champions League means beating clubs of that stature, every round — and
    // even the third-tier competition is full of clubs from divisions as good
    // as your own, so it never becomes a stroll for a mid-table side.
    const contField = Math.max(comp.prestige * 1.02, level * 0.92);
    cont = { comp, ...knockoutRun(teamStr * 1.05, contField, CONT_ROUNDS) };
  }

  const load = {
    league: leagueFixtures(career.leagueClubs.length),
    cup: knockoutGames(cup.reached, CUP_ROUNDS.length, cup.won, false, 0),
    continental: cont
      // Eight matches of a league phase (six in a group format), then two-legged
      // knockout rounds and a one-off final.
      ? knockoutGames(cont.reached, CONT_ROUNDS.length, cont.won, true,
        cont.comp.prestige >= 70 ? 8 : 6)
      : 0
  };
  load.total = load.league + load.cup + load.continental;
  report.matchLoad = load;

  // ----- Player + league -----
  const stats = playerSeasonStats(career, level, load, injuryWeeks);
  career.lastStats = stats;
  const table = simulateTable(career, level, quality, stats.share);
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
    report.trophies.push({ type: 'league', name: career.club.leagueName, year: career.year,
      tsdbLeagueId: career.club.tsdbLeagueId ?? null, country: career.club.country,
      countryName: career.club.countryName, tier: career.club.tier });
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
  if (cup.won) {
    report.trophies.push({ type: 'cup', name: cupName, year: career.year, tsdbLeagueId: null,
      country: career.club.country, countryName: career.club.countryName });
    report.news.push({ tone: 'gold', text: `${career.club.name} lift the ${cupName}!` });
  } else if (cup.reached >= 2) {
    report.news.push({ tone: 'neutral', text: `A ${cupName} run ends at the ${CUP_ROUNDS[cup.reached + 1] ?? 'final hurdle'}.` });
  }
  report.cup = { name: cupName, reachedName: cup.won ? 'Winners' : cup.reached >= 0 ? CUP_ROUNDS[cup.reached] : 'Early exit', won: cup.won };

  // ----- Continental club competition (qualified last season) -----
  if (cont) {
    const comp = cont.comp;
    if (cont.won) {
      report.trophies.push({ type: 'continental', name: comp.name, year: career.year, tsdbLeagueId: null, key: comp.key });
      report.trophies[report.trophies.length - 1].countryName = null;
      report.news.push({ tone: 'gold', text: `${career.club.name} are ${comp.name} champions — the pinnacle of club football on the continent!` });
      p.reputation = clamp(p.reputation + 10, 0, 100);
    } else if (cont.reached >= 0) {
      report.news.push({ tone: 'neutral', text: `The ${comp.name} adventure ends at the ${CONT_ROUNDS[Math.min(cont.reached + 1, CONT_ROUNDS.length - 1)]}.` });
      p.reputation = clamp(p.reputation + cont.reached, 0, 100);
    } else {
      report.news.push({ tone: 'neutral', text: `An early exit from the ${comp.name}.` });
    }
    report.continentalRun = { name: comp.name, won: cont.won };
  }

  // ----- Internationals -----
  simulateInternationals(career, report, stats);

  // ----- Awards -----
  const group = positionGroup(p);
  if (group === 'FWD' && stats.goals >= 22 && chance(0.4 + (stats.goals - 22) * 0.06)) {
    report.awards.push(AWARDS.goldenBoot);
    report.trophies.push({ type: 'award', name: `${AWARDS.goldenBoot} — ${career.club.leagueName}`, year: career.year });
  }
  if (group === 'GK' && stats.cleanSheets >= 14 && chance(0.5)) {
    report.awards.push(AWARDS.goldenGlove);
    report.trophies.push({ type: 'award', name: `${AWARDS.goldenGlove} — ${career.club.leagueName}`, year: career.year });
  }
  if (stats.rating >= 7.7 && stats.apps >= load.total * 0.5 && chance(clamp((stats.rating - 7.6) * 1.2, 0.08, 0.7))) {
    report.awards.push(AWARDS.playerOfSeason);
    report.trophies.push({ type: 'award', name: `${AWARDS.playerOfSeason} — ${career.club.leagueName}`, year: career.year });
  }
  if (p.age <= 21 && stats.rating >= 7.2 && stats.apps >= 15 && chance(0.4)) {
    report.awards.push(AWARDS.youngPlayer);
    report.trophies.push({ type: 'award', name: AWARDS.youngPlayer, year: career.year });
  }
  const worldStage = coeff >= 75 && career.club.tier === 1;
  if (worldStage && p.ability >= 88 && stats.rating >= 7.7 && (report.champion || report.continentalRun?.won) && chance(0.45)) {
    report.awards.push(AWARDS.ballonDor);
    report.trophies.push({ type: 'award', name: AWARDS.ballonDor, year: career.year });
    report.news.push({ tone: 'gold', text: `You win the ${AWARDS.ballonDor} — the best footballer on earth this year.` });
    p.reputation = 100;
  }

  return report;
}

function simulateInternationals(career, report, stats) {
  const p = career.player;
  const nation = career.nation; // {code, name, confederation}
  const natStr = countryCoeff(nation.code, nation.confederation);
  // The stronger the nation, the higher the bar to break into the squad.
  const threshold = clamp(16 + natStr * 0.6, 12, 88) - (career.flags.intlBoost || 0);
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
  const group = positionGroup(p);
  const intlGoals = group === 'FWD' ? irand(0, Math.ceil(newCaps / 2)) : group === 'MID' ? irand(0, 2) : 0;
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
      }
      // The tournament's outstanding player, which a run to the closing
      // weekend and a season at this level can earn.
      if (run.reached >= 2 && p.ability >= 86 && stats.rating >= 7.4 && chance(run.won ? 0.4 : 0.15)) {
        report.awards.push(AWARDS.goldenBall);
        report.trophies.push({ type: 'award', name: AWARDS.goldenBall, year: career.year });
        report.news.push({ tone: 'gold', text: `You are voted the ${AWARDS.goldenBall} — the outstanding player of the tournament.` });
        p.reputation = 100;
      }
      if (!run.won) {
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
