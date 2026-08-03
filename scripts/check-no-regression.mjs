// Compares working-tree league data against the last commit and reports any
// league that LOST clubs or disappeared. Guards edits that are meant to be
// additive (e.g. adding a tier without disturbing the others).
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIR = path.join(ROOT, 'public/data/leagues');
const REL = 'public/data/leagues';

function committed(file) {
  try {
    return JSON.parse(execFileSync('git', ['show', `HEAD:${REL}/${file}`], { cwd: ROOT, encoding: 'utf8' }));
  } catch { return null; } // new file — nothing to regress from
}

const index = (data) => {
  const m = new Map();
  for (const l of data?.leagues || []) m.set(`${l.tier}`, l);
  return m;
};

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json'));
const losses = [];
let gained = 0, files_changed = 0;

for (const f of files) {
  const before = committed(f);
  if (!before) continue;
  let after;
  try { after = JSON.parse(await readFile(path.join(DIR, f), 'utf8')); }
  catch (e) { losses.push(`${f}: unreadable — ${e.message}`); continue; }

  const a = index(before), b = index(after);
  let changed = false;
  for (const [tier, oldL] of a) {
    const newL = b.get(tier);
    const oldN = (oldL.clubs || []).length;
    if (!newL) {
      if (oldN) losses.push(`${f}: tier ${tier} "${oldL.name}" REMOVED (had ${oldN} clubs)`);
      continue;
    }
    const newN = (newL.clubs || []).length;
    if (newN < oldN) losses.push(`${f}: tier ${tier} "${oldL.name}" lost clubs (${oldN} → ${newN})`);
    if (newN !== oldN) changed = true;
    if (newN > oldN) gained += newN - oldN;
  }
  for (const [tier, newL] of b) if (!a.has(tier)) { gained += (newL.clubs || []).length; changed = true; }
  if (changed) files_changed++;
}

console.log(`Files with club-count changes: ${files_changed}; clubs added: ${gained}`);
if (losses.length) {
  console.log(`\nREGRESSIONS (${losses.length}):`);
  losses.forEach((l) => console.log('  ✗ ' + l));
  process.exit(1);
}
console.log('No data lost relative to HEAD.');
