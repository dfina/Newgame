// Monte-Carlo engine check: plays many full careers headlessly and prints
// distribution stats. Guards against balance/flow regressions.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

// Browser shims for the engine modules.
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

const career_ = await import('../src/engine/career.js');
const { startCareer, acceptOffer, stayAtClub, chooseEventOption, runSeason, advanceToNextSeason, currentEvent } = career_;

const N = Number(process.argv[2] || 300);
const NATS = ['ENG', 'ARG', 'ESP', 'ITA', 'GER', 'BRA', 'MAR', 'TAN', 'USA', 'MEX', 'NZL', 'MLT', 'CHN', 'SEN', 'FIJ', 'TGA'];
const POS = ['GK', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'RB', 'LWB', 'RM'];
const agg = {
  seasons: [], retireAge: [], trophies: [], caps: [], clubs: [], goals: [],
  graveEndings: 0, promotions: 0, relegations: 0, transfers: 0, worldCups: 0,
  continentals: 0, leagues: 0, awards: 0, legacy: [], errors: []
};

for (let i = 0; i < N; i++) {
  try {
    const nat = NATS[i % NATS.length];
    const c = await startCareer({ name: 'Sim ' + i, nationality: nat, position: POS[i % POS.length] });
    if (!c.offers.length) { agg.errors.push(`${nat}: no starting offers`); continue; }
    await acceptOffer(c, c.offers[0]);
    let guard = 0;
    const clubsSeen = new Set([c.club.name]);
    while (!c.retired && guard++ < 400) {
      if (c.phase === 'offers') {
        if (c.offers.length && Math.random() < 0.5) {
          await acceptOffer(c, c.offers[Math.floor(Math.random() * c.offers.length)]);
          agg.transfers++;
          clubsSeen.add(c.club.name);
        } else stayAtClub(c);
      } else if (c.phase === 'event') {
        const ev = currentEvent(c);
        chooseEventOption(c, Math.floor(Math.random() * ev.choices.length));
        c.lastOutcome = null;
        if (c.phase === 'review') {
          const r = runSeason(c);
          if (r.promoted) agg.promotions++;
          if (r.relegated) agg.relegations++;
        }
      } else if (c.phase === 'review') {
        // Most seasons now carry no decision card at all and go straight here.
        const r = runSeason(c);
        if (r.promoted) agg.promotions++;
        if (r.relegated) agg.relegations++;
      } else if (c.phase === 'postseason') {
        await advanceToNextSeason(c);
      } else {
        agg.errors.push('stuck in phase ' + c.phase);
        break;
      }
    }
    if (guard >= 400) { agg.errors.push('guard tripped'); continue; }
    agg.seasons.push(c.player.seasonsPlayed);
    agg.retireAge.push(c.player.age);
    agg.trophies.push(c.trophies.length);
    agg.caps.push(c.player.caps);
    agg.goals.push(c.history.reduce((s, h) => s + h.goals, 0));
    agg.clubs.push(clubsSeen.size);
    if (c.player.careerEnded) agg.graveEndings++;
    for (const t of c.trophies) {
      if (t.name === 'FIFA World Cup') agg.worldCups++;
      if (t.type === 'continental') agg.continentals++;
      if (t.type === 'league') agg.leagues++;
      if (t.type === 'award') agg.awards++;
    }
    const { computeLegacy } = await import('../src/engine/legacy.js');
    agg.legacy.push(computeLegacy(c).points);
  } catch (e) {
    agg.errors.push(e.stack.split('\n').slice(0, 3).join(' | '));
  }
}

const stat = (a) => {
  if (!a.length) return 'n/a';
  const s = [...a].sort((x, y) => x - y);
  const avg = (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
  return `avg ${avg} | p10 ${s[Math.floor(a.length * 0.1)]} | med ${s[Math.floor(a.length * 0.5)]} | p90 ${s[Math.floor(a.length * 0.9)]} | max ${s[a.length - 1]}`;
};
console.log(`careers simulated: ${N} (errors: ${agg.errors.length})`);
console.log('seasons:   ', stat(agg.seasons));
console.log('retire age:', stat(agg.retireAge));
console.log('trophies:  ', stat(agg.trophies));
console.log('caps:      ', stat(agg.caps));
console.log('goals:     ', stat(agg.goals));
console.log('clubs:     ', stat(agg.clubs));
console.log('legacy:    ', stat(agg.legacy));
console.log(`grave endings: ${agg.graveEndings} | transfers: ${agg.transfers} | promotions: ${agg.promotions} | relegations: ${agg.relegations}`);
console.log(`league titles: ${agg.leagues} | continentals: ${agg.continentals} | world cups: ${agg.worldCups} | awards: ${agg.awards}`);
if (agg.errors.length) {
  console.log('\nERRORS (first 10):');
  [...new Set(agg.errors)].slice(0, 10).forEach((e) => console.log('  ' + e));
  process.exit(1);
}
console.log('\nSIM PASS');
