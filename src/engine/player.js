import { irand, rand, clamp, chance } from './rng.js';
import { getRole, roleGroup, shirtFor } from './positions.js';

export function createPlayer({ name, nationality, position }) {
  const potential = irand(62, 96);
  const role = getRole(position).key;
  const shirt = shirtFor(role);
  return {
    name,
    nationality,          // FIFA code
    position: role,       // specific role, e.g. CAM / LWB / ST
    shirt: shirt[irand(0, shirt.length - 1)],
    age: 17,
    ability: irand(38, 52),
    potential,
    form: 60,
    morale: 70,
    fitness: 100,
    injuryProne: rand() * 0.5 + 0.15,
    reputation: 5,        // 0..100, drives transfers and call-ups
    caps: 0,
    intlGoals: 0,
    captain: false,
    retrained: null,      // e.g. 'MID' late-career
    agent: 'none',        // none | honest | shark
    wage: 200,            // weekly, in game currency (£)
    contractYears: 0,
    peakAbility: 0,
    seasonsPlayed: 0,
    careerEnded: false
  };
}

// Yearly growth toward potential while young, decline from early 30s — driven
// by how the season actually went on the pitch (see seasonPerformance), so a
// year of 40 appearances and goals moves a career far more than any one
// decision ever can.
//
// `perf` is 0..1.3: 0.5 is a season that merely kept a place in the side, 1.0
// an outstanding one, above that a season that defines an era.
export function developPlayer(p, perf) {
  const q = clamp(perf, 0, 1.3);
  let delta = 0;
  if (p.age <= 21) delta = (p.potential - p.ability) * (0.05 + 0.26 * q);
  else if (p.age <= 23) delta = (p.potential - p.ability) * (0.03 + 0.22 * q);
  else if (p.age <= 27) delta = (p.potential - p.ability) * (0.01 + 0.15 * q) + (q - 0.55) * 1.2;
  else if (p.age <= 30) delta = (q - 0.5) * 3.4;
  else if (p.age <= 33) delta = -2.6 + q * 3.6 - rand() * 0.8;
  else delta = -4.2 + q * 3.4 - rand() * 1.2;
  p.ability = clamp(p.ability + delta, 20, 99);
  p.peakAbility = Math.max(p.peakAbility, Math.round(p.ability));
  return delta;
}

// How good a season was, 0..1.3, from what a football career is actually
// judged on: minutes on the pitch, output in the final third (or goals kept
// out, for a goalkeeper) and the rating the performances earned.
//
// Each component is measured against what the role and the standard of the
// league make a normal season, so 25 goals as a striker and 8 as a centre-back
// count for the same thing.
export function seasonPerformance(stats, role) {
  const played = clamp(stats.apps / Math.max(12, stats.possible * 0.72), 0, 1.25);
  const rated = clamp((stats.rating - 6.15) / 1.15, 0, 1.3);

  let output;
  if (role.group === 'GK') {
    const sheets = stats.apps ? (stats.cleanSheets / stats.apps) : 0;
    const saves = stats.apps ? (stats.saves / stats.apps) / 3.2 : 0;
    output = clamp(sheets / 0.30 * 0.38 + saves * 0.30, 0, 1.3);
  } else {
    const expected = (role.goals + role.assists) * Math.max(1, stats.apps);
    output = expected > 0 ? clamp((stats.goals + stats.assists) / expected * 0.62, 0, 1.3) : 0.5;
  }

  // Minutes are the foundation: a brilliant rating over six appearances is not
  // a season. Output and rating then decide how far above ordinary it went.
  return clamp(played * 0.34 + rated * 0.38 + output * 0.28, 0, 1.3);
}

export function agePlayer(p) {
  p.age += 1;
  p.seasonsPlayed += 1;
  if (p.age >= 30 && chance(0.25)) p.injuryProne += 0.05;
}

// Should the game force retirement talk?
export function retirementPressure(p) {
  if (p.age >= 40) return 1;
  if (p.age >= 36) return (p.age - 35) * 0.22 + (p.ability < 45 ? 0.25 : 0);
  if (p.age >= 33 && p.ability < 38) return 0.35;
  return 0;
}

export function effectivePosition(p) {
  return getRole(p.retrained || p.position).key;
}

// The full role record for the position the player currently occupies.
export function effectiveRole(p) {
  return getRole(p.retrained || p.position);
}

// The broad line of the team the player belongs to (GK / DEF / MID / FWD).
export function positionGroup(p) {
  return roleGroup(p.retrained || p.position);
}

// Market value in euros: rises steeply with ability, peaks around 26, and
// falls away as a contract-free veteran approaches retirement.
export function marketValue(p) {
  const base = Math.pow(Math.max(0, p.ability - 30) / 10, 3.4) * 42000;
  let ageMult;
  if (p.age <= 20) ageMult = 1.15;
  else if (p.age <= 26) ageMult = 1.3;
  else if (p.age <= 29) ageMult = 1.0;
  else if (p.age <= 32) ageMult = 0.6;
  else if (p.age <= 35) ageMult = 0.28;
  else ageMult = 0.1;
  return Math.max(25000, Math.round((base * ageMult) / 10000) * 10000);
}

export function formatValue(v) {
  if (v >= 1e6) return '€' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  return '€' + Math.round(v / 1000) + 'K';
}
