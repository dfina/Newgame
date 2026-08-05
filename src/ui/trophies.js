// Original stylised SVG trophies — parameterised shapes that evoke a
// competition type without reproducing any real trophy design.
import { resolveTrophyImage, resolveTrophyImageByName } from './badge.js';

const TYPE_STYLE = {
  international: { metal: '#ffd75e', accent: '#2e86de', shape: 'globe' },
  continental: { metal: '#e8e8e8', accent: '#8e44ad', shape: 'tall' },
  league: { metal: '#ffd75e', accent: '#c0392b', shape: 'cup' },
  cup: { metal: '#d9d9d9', accent: '#16a085', shape: 'cup' },
  award: { metal: '#ffb84d', accent: '#2c3e50', shape: 'star' },
  special: { metal: '#c9a86a', accent: '#7f8c8d', shape: 'plaque' }
};

function hueShift(name) {
  let h = 0;
  for (const ch of name) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Two individual honours are distinctive enough to deserve their own shape
// rather than the generic award star.
const NAMED_SHAPE = [
  [/Ballon d'Or/i, 'ballon'],
  [/Golden Ball/i, 'goldenball'],
  [/Golden Boot/i, 'goldenboot'],
  [/Golden Glove/i, 'goldenglove']
];

export function trophySvg(trophy) {
  const style = TYPE_STYLE[trophy.type] || TYPE_STYLE.cup;
  const h = hueShift(trophy.name);
  const ribbon = `hsl(${h % 360} 55% 45%)`;
  const m = style.metal;
  const named = NAMED_SHAPE.find(([re]) => re.test(trophy.name || ''));
  const shape = named ? named[1] : style.shape;
  let body = '';
  switch (shape) {
    case 'ballon':
      // A football held up on a fluted plinth: the Ballon d'Or.
      body = `<circle cx="50" cy="32" r="20" fill="#f3c847"/>
        <g fill="#8a6a10"><path d="M50 18 l7 5 -3 8 h-8 l-3 -8 z"/>
          <path d="M33 30 l6 5 -2 6 -7 -3 z"/><path d="M67 30 l-6 5 2 6 7 -3 z"/>
          <path d="M41 46 l4 5 h10 l4 -5 -9 -3 z"/></g>
        <path d="M44 52 h12 l3 14 h-18 z" fill="#e0b23c"/>
        <rect x="34" y="66" width="32" height="6" rx="2" fill="#f3c847"/>
        <path d="M37 72 h26 l4 12 h-34 z" fill="#c99a2e"/>`;
      break;
    case 'goldenball':
      // A ball on a slim column with laurels: the tournament's best player.
      body = `<circle cx="50" cy="28" r="15" fill="#f6d564"/>
        <path d="M50 17 l6 4 -2 7 h-8 l-2 -7 z" fill="#8a6a10"/>
        <path d="M31 34 q-6 14 6 24 M69 34 q6 14 -6 24" stroke="#d8b34a" stroke-width="4" fill="none"/>
        <rect x="46" y="43" width="8" height="24" rx="2" fill="#e8c451"/>
        <path d="M38 67 h24 l5 15 h-34 z" fill="#c99a2e"/>`;
      break;
    case 'goldenboot':
      body = `<path d="M24 54 q18 -10 32 -5 l16 5 q12 4 12 13 h-60 z" fill="#f3c847"/>
        <path d="M84 67 h-60 v7 h62 q4 0 4 -3 z" fill="#c99a2e"/>
        <path d="M34 48 l10 4 M45 44 l10 5 M56 42 l10 6" stroke="#8a6a10" stroke-width="2.5"/>`;
      break;
    case 'goldenglove':
      body = `<path d="M34 30 q0 -8 7 -8 t7 8 v10 q4 -8 10 -6 t6 9 q5 -4 9 1 t2 12
          q-2 18 -18 22 q-16 -2 -21 -16 q-4 -12 -2 -32 z" fill="#f3c847"/>
        <path d="M32 74 h36 l4 10 h-44 z" fill="#c99a2e"/>`;
      break;
    case 'globe':
      body = `<circle cx="50" cy="38" r="20" fill="none" stroke="${m}" stroke-width="5"/>
        <ellipse cx="50" cy="38" rx="9" ry="20" fill="none" stroke="${m}" stroke-width="3"/>
        <line x1="30" y1="38" x2="70" y2="38" stroke="${m}" stroke-width="3"/>
        <path d="M42 56 L58 56 L55 74 L45 74 Z" fill="${m}"/>`;
      break;
    case 'tall':
      body = `<path d="M40 16 H60 L57 58 Q50 64 43 58 Z" fill="${m}"/>
        <path d="M40 20 C28 22 28 38 41 40 M60 20 C72 22 72 38 59 40" fill="none" stroke="${m}" stroke-width="4"/>
        <rect x="45" y="60" width="10" height="14" fill="${m}"/>`;
      break;
    case 'star':
      body = `<path d="M50 12 L57 34 L80 34 L61 47 L68 70 L50 56 L32 70 L39 47 L20 34 L43 34 Z" fill="${m}" stroke="${ribbon}" stroke-width="2"/>
        <rect x="44" y="66" width="12" height="10" fill="${m}"/>`;
      break;
    case 'plaque':
      body = `<rect x="26" y="16" width="48" height="58" rx="6" fill="${m}"/>
        <rect x="33" y="24" width="34" height="34" rx="4" fill="${ribbon}" opacity="0.85"/>
        <circle cx="50" cy="41" r="10" fill="none" stroke="#fff" stroke-width="3"/>`;
      break;
    default: // cup
      body = `<path d="M34 14 H66 L62 48 Q50 58 38 48 Z" fill="${m}"/>
        <path d="M34 18 C22 20 22 34 36 36 M66 18 C78 20 78 34 64 36" fill="none" stroke="${m}" stroke-width="4"/>
        <rect x="46" y="54" width="8" height="12" fill="${m}"/>
        <circle cx="50" cy="30" r="6" fill="${ribbon}" opacity="0.9"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${escapeAttr(trophy.name)}">
    ${body}
    <path d="M36 78 H64 L68 90 H32 Z" fill="${m}" opacity="0.9"/>
    <rect x="30" y="90" width="40" height="6" rx="2" fill="${ribbon}"/>
  </svg>`;
}

function escapeAttr(s) { return s.replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// Render a trophy tile; upgrades to TheSportsDB trophy image when available.
export function trophyTile(trophy) {
  const id = 't' + Math.random().toString(36).slice(2, 9);
  // Awards and specials are personal honours with no hosted artwork — SVG only.
  if (trophy.type !== 'award' && trophy.type !== 'special') {
    queueMicrotask(async () => {
      const img = trophy.tsdbLeagueId
        ? await resolveTrophyImage(trophy.tsdbLeagueId)
        : await resolveTrophyImageByName(trophy.name, trophy.countryName, trophy.country, trophy.tier);
      const holder = document.getElementById(id);
      if (holder && img) {
        const imgEl = document.createElement('img');
        imgEl.src = img + '/small';
        imgEl.alt = '';
        imgEl.loading = 'lazy';
        imgEl.onerror = () => imgEl.remove();
        imgEl.onload = () => { holder.querySelector('svg')?.remove(); };
        holder.prepend(imgEl);
      }
    });
  }
  const yrs = trophy.years?.length > 1
    ? `×${trophy.years.length} (${trophy.years.join(', ')})`
    : `${trophy.years?.[0] ?? trophy.year}`;
  return `<div class="trophy-cab"><div id="${id}">${trophySvg(trophy)}</div>
    <div class="tname">${trophy.name}</div>
    <div class="tmeta">${yrs}</div></div>`;
}
