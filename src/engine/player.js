import { irand, rand, clamp, chance } from './rng.js';

export const POSITIONS = [
  { key: 'GK', name: 'Goalkeeper' },
  { key: 'DEF', name: 'Defender' },
  { key: 'MID', name: 'Midfielder' },
  { key: 'FWD', name: 'Forward' }
];

export function createPlayer({ name, nationality, position }) {
  const potential = irand(62, 96);
  return {
    name,
    nationality,          // FIFA code
    position,             // GK/DEF/MID/FWD
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

// Yearly growth toward potential while young, decline from early 30s.
export function developPlayer(p, seasonQuality /* 0..1 */) {
  let delta = 0;
  if (p.age <= 23) delta = (p.potential - p.ability) * (0.16 + 0.12 * seasonQuality);
  else if (p.age <= 27) delta = (p.potential - p.ability) * (0.08 + 0.08 * seasonQuality);
  else if (p.age <= 30) delta = (seasonQuality - 0.45) * 2.2;
  else if (p.age <= 33) delta = -1.6 - rand() * 1.8 + seasonQuality * 1.2;
  else delta = -3 - rand() * 2.6 + seasonQuality * 1.0;
  p.ability = clamp(p.ability + delta, 20, 99);
  p.peakAbility = Math.max(p.peakAbility, Math.round(p.ability));
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
  return p.retrained || p.position;
}
