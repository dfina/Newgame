// Data verification: schema conformance, source presence, duplicate detection,
// coverage summary. Run after any dataset change. Exits 1 on hard violations.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIR = path.join(ROOT, 'public/data/leagues');
const assoc = JSON.parse(await readFile(path.join(ROOT, 'public/data/associations.json'), 'utf8'));

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
const errors = [];
const warnings = [];
let clubTotal = 0, leagueTotal = 0, verifiedLeagues = 0, countriesWithData = 0;

const codes = new Set(assoc.associations.map((a) => a.code));
for (const f of files) {
  const code = f.replace('.json', '');
  let data;
  try { data = JSON.parse(await readFile(path.join(DIR, f), 'utf8')); }
  catch (e) { errors.push(`${f}: invalid JSON — ${e.message}`); continue; }
  if (!codes.has(code)) errors.push(`${f}: code not in associations.json`);
  if (data.association !== code) errors.push(`${f}: association field "${data.association}" ≠ filename`);
  if (!Array.isArray(data.leagues)) { errors.push(`${f}: leagues not an array`); continue; }
  if (data.leagues.length) countriesWithData++;
  for (const l of data.leagues) {
    leagueTotal++;
    if (!Number.isInteger(l.tier) || l.tier < 1 || l.tier > 4) errors.push(`${f}: bad tier ${l.tier}`);
    if (!l.name) errors.push(`${f}: league missing name`);
    if (!Array.isArray(l.sources) || !l.sources.length) {
      if ((l.clubs || []).length) errors.push(`${f}: ${l.name} has clubs but no sources`);
    }
    if (l.verified) verifiedLeagues++;
    const seen = new Set();
    for (const c of l.clubs || []) {
      clubTotal++;
      if (!c.name) errors.push(`${f}: ${l.name} club missing name`);
      const k = c.name?.toLowerCase();
      if (seen.has(k)) warnings.push(`${f}: ${l.name} duplicate club "${c.name}"`);
      seen.add(k);
      if (c.tsdbTeamId != null && !Number.isInteger(c.tsdbTeamId)) errors.push(`${f}: ${l.name}/${c.name} non-integer tsdbTeamId`);
    }
    if (l.verified && !(l.groups) && l.clubs.length < 8) warnings.push(`${f}: ${l.name} verified but only ${l.clubs.length} clubs`);
  }
}

const missing = [...codes].filter((c) => !files.includes(c + '.json'));
if (missing.length) warnings.push(`No data file for: ${missing.join(', ')}`);

console.log(`Files: ${files.length}/211 associations`);
console.log(`Countries with league data: ${countriesWithData}`);
console.log(`Leagues: ${leagueTotal} (${verifiedLeagues} verified), clubs: ${clubTotal}`);
if (warnings.length) { console.log(`\nWarnings (${warnings.length}):`); warnings.forEach((w) => console.log('  ⚠ ' + w)); }
if (errors.length) { console.log(`\nErrors (${errors.length}):`); errors.forEach((er) => console.log('  ✗ ' + er)); process.exit(1); }
console.log('\nOK — no hard violations.');
