// Builds public/data/index.json — a light manifest of playable leagues so the
// game can generate offers without fetching all association files.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIR = path.join(ROOT, 'public/data/leagues');

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
const countries = [];
for (const f of files.sort()) {
  const data = JSON.parse(await readFile(path.join(DIR, f), 'utf8'));
  const leagues = (data.leagues || [])
    .filter((l) => Array.isArray(l.clubs) && l.clubs.length >= 6)
    .map((l) => ({
      tier: l.tier,
      name: l.name,
      clubs: l.clubs.length,
      verified: !!l.verified,
      tsdbLeagueId: l.tsdbLeagueId ?? null
    }))
    .sort((a, b) => a.tier - b.tier);
  if (leagues.length) {
    countries.push({
      code: data.association,
      country: data.country,
      confederation: data.confederation,
      leagues
    });
  }
}
await writeFile(
  path.join(ROOT, 'public/data/index.json'),
  JSON.stringify({ generated: new Date().toISOString(), countries }, null, 1)
);
console.log(`index.json: ${countries.length} playable countries, ${countries.reduce((s, c) => s + c.leagues.length, 0)} leagues`);
