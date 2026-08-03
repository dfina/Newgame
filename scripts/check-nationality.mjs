// Verifies that home-country offers dominate at the start and end of a career
// and recede at the peak. Usage: node scripts/check-nationality.mjs [CODE ...]
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
  try {
    const body = await readFile(path.join(ROOT, 'public', String(url)), 'utf8');
    return { ok: true, json: async () => JSON.parse(body) };
  } catch { return { ok: false, json: async () => { throw new Error('404'); } }; }
};

const { startCareer, acceptOffer, stayAtClub, chooseEventOption, runSeason, advanceToNextSeason, currentEvent } =
  await import('../src/engine/career.js');

const codes = process.argv.slice(2);
const nations = codes.length ? codes : ['BEL', 'ENG', 'ESP', 'BRA', 'ARG', 'MAR', 'JPN'];
const RUNS = 40;
let failures = 0;

for (const nat of nations) {
  const phase = { start: { home: 0, total: 0 }, peak: { home: 0, total: 0 }, late: { home: 0, total: 0 } };
  for (let r = 0; r < RUNS; r++) {
    const c = await startCareer({ name: 'T', nationality: nat, position: 'MID' });
    for (const o of c.offers) { phase.start.total++; if (o.country === nat) phase.start.home++; }
    if (!c.offers.length) continue;
    await acceptOffer(c, c.offers[0]);
    let guard = 0;
    while (!c.retired && guard++ < 300) {
      if (c.phase === 'offers') {
        const bucket = c.player.age >= 33 ? phase.late : c.player.age >= 24 && c.player.age <= 29 ? phase.peak : null;
        if (bucket) for (const o of c.offers) { bucket.total++; if (o.country === nat) bucket.home++; }
        if (c.offers.length && Math.random() < 0.5) await acceptOffer(c, c.offers[0]);
        else stayAtClub(c);
      } else if (c.phase === 'event') {
        const ev = currentEvent(c);
        chooseEventOption(c, Math.floor(Math.random() * ev.choices.length));
        c.lastOutcome = null;
        if (c.phase === 'review') runSeason(c);
      } else if (c.phase === 'postseason') {
        await advanceToNextSeason(c);
      } else break;
    }
  }
  const pct = (b) => (b.total ? Math.round((b.home / b.total) * 100) : null);
  const s = pct(phase.start), pk = pct(phase.peak), l = pct(phase.late);
  const fmt = (v, b) => (v === null ? ' n/a' : `${String(v).padStart(3)}% (${b.home}/${b.total})`);
  console.log(`${nat}  start ${fmt(s, phase.start)}   peak ${fmt(pk, phase.peak)}   late ${fmt(l, phase.late)}`);
  // Only meaningful where the association actually has a playable league.
  if (s !== null && s > 0) {
    if (pk !== null && s <= pk) { console.log(`   ✗ ${nat}: start (${s}%) should exceed peak (${pk}%)`); failures++; }
    if (l !== null && pk !== null && l <= pk) { console.log(`   ✗ ${nat}: late (${l}%) should exceed peak (${pk}%)`); failures++; }
  } else {
    console.log(`   – ${nat}: no home offers possible (no playable league in data)`);
  }
}
console.log(failures ? `\n${failures} expectation(s) failed` : '\nNATIONALITY BIAS OK');
process.exit(failures ? 1 : 0);
