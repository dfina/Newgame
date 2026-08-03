// Seeded RNG (mulberry32) so a career is reproducible from its seed.
let state = Date.now() >>> 0;

export function seed(s) { state = s >>> 0; }
export function getSeed() { return state; }

export function rand() {
  state |= 0; state = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const chance = (p) => rand() < p;
export const irand = (min, max) => min + Math.floor(rand() * (max - min + 1));
export const pick = (arr) => arr[Math.floor(rand() * arr.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Roughly normal noise in [-1, 1]
export function noise() {
  return (rand() + rand() + rand()) / 1.5 - 1;
}

// Deterministic hash of a string to [0,1) — stable club jitter across seasons.
export function strHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function weightedPick(items, weightFn) {
  const ws = items.map(weightFn);
  const total = ws.reduce((a, b) => a + b, 0);
  if (total <= 0) return pick(items);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
