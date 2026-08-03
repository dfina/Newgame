// Legacy score and trophy cabinet assembly.

const TYPE_POINTS = {
  league: 30, cup: 15, continental: 60, international: 90, award: 25, special: 10
};
const NAME_BONUS = [
  [/World Cup/i, 160],
  [/Champions League|Libertadores/i, 40],
  [/World Footballer/i, 120]
];

export function computeLegacy(career) {
  const p = career.player;
  let pts = 0;
  for (const t of career.trophies) {
    pts += TYPE_POINTS[t.type] || 10;
    for (const [re, bonus] of NAME_BONUS) if (re.test(t.name)) pts += bonus;
  }
  pts += p.caps * 1.5 + p.intlGoals * 2;
  pts += Math.max(0, p.peakAbility - 60) * 4;
  pts += p.seasonsPlayed * 3;
  const totalGoals = career.history.reduce((s, h) => s + h.goals, 0);
  const totalApps = career.history.reduce((s, h) => s + h.apps, 0);
  pts += totalGoals * 0.6 + totalApps * 0.12;
  if (career.testimonial) pts += 15;
  pts = Math.round(pts);

  let grade, blurb;
  if (pts >= 1400) { grade = 'An Immortal of the Game'; blurb = 'Statues will be built. Children will wear your name for generations.'; }
  else if (pts >= 900) { grade = 'World-Class Great'; blurb = 'You belong in any conversation about the very best of your era.'; }
  else if (pts >= 550) { grade = 'International Star'; blurb = 'A career the whole country followed, full of big nights.'; }
  else if (pts >= 300) { grade = 'Club Legend'; blurb = 'One club’s faithful will sing your name forever.'; }
  else if (pts >= 150) { grade = 'Solid Professional'; blurb = 'A career most who ever kick a ball could only dream of.'; }
  else { grade = 'Journeyman'; blurb = 'You lived the dream, even when the dream was a wet Tuesday away from home.'; }
  return { points: pts, grade, blurb, totalGoals, totalApps };
}

// Group identical trophies with counts and years for the cabinet.
export function assembleCabinet(career) {
  const map = new Map();
  for (const t of career.trophies) {
    const key = `${t.type}|${t.name}`;
    if (!map.has(key)) map.set(key, { ...t, years: [] });
    map.get(key).years.push(t.year);
  }
  const order = { international: 0, continental: 1, league: 2, cup: 3, award: 4, special: 5 };
  return [...map.values()].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
}
