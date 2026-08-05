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
    case 'ballon': {
      // The Ballon d'Or as it actually looks: a polished golden football
      // resting on a rough nugget of gold. Drawn rather than photographed —
      // it carries its own base, so the generic plinth is skipped below.
      const g = 'bd' + h.toString(36).slice(0, 5);
      body = `<defs>
          <radialGradient id="${g}b" cx="34%" cy="26%" r="80%">
            <stop offset="0" stop-color="#fff6d2"/><stop offset="0.24" stop-color="#f6cf5c"/>
            <stop offset="0.62" stop-color="#cf9a22"/><stop offset="1" stop-color="#6d4c0c"/>
          </radialGradient>
          <linearGradient id="${g}n" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0" stop-color="#f0c65a"/><stop offset="0.5" stop-color="#c2921f"/>
            <stop offset="1" stop-color="#7d5a10"/>
          </linearGradient>
        </defs>
        <path d="M14 82 q1 -10 10 -9 q3 -8 11 -6 q5 -8 14 -5 q8 -7 16 -1 q9 -2 11 7
                 q8 3 9 9 q1 8 -9 9 q-16 3 -32 2 q-16 -1 -25 -2 q-8 -1 -5 -4 z"
              fill="url(#${g}n)"/>
        <path d="M22 92 h56 q-4 5 -12 5 h-32 q-8 0 -12 -5 z" fill="#8a6412"/>
        <g fill="#6b4b0c" opacity="0.55">
          <path d="M27 76 q6 3 3 7 q-6 -1 -3 -7 z"/><path d="M45 72 q7 2 4 8 q-8 -2 -4 -8 z"/>
          <path d="M63 74 q7 3 3 8 q-7 -2 -3 -8 z"/><path d="M36 84 q9 2 6 5 q-9 0 -6 -5 z"/>
        </g>
        <circle cx="50" cy="40" r="31" fill="url(#${g}b)"/>
        <g fill="none" stroke="#7d5a10" stroke-width="1.7" opacity="0.62" stroke-linejoin="round">
          <path d="M44 25 L53 31 L50 41 L39 41 L36 31 Z"/>
          <path d="M44 25 L45 12 M53 31 L64 22 M50 41 L58 52 M39 41 L31 52 M36 31 L25 24"/>
          <path d="M25 24 q-6 8 -6 16 M64 22 q8 7 10 16 M31 52 q9 6 20 5 q10 -1 7 -5"/>
        </g>
        <ellipse cx="38" cy="26" rx="11" ry="8" fill="#fff" opacity="0.4" transform="rotate(-28 38 26)"/>
        <path d="M72 52 a26 26 0 0 1 -30 17 a31 31 0 0 0 30 -17 z" fill="#fff" opacity="0.12"/>`;
      break;
    }
    case 'goldenball': {
      // A golden ball on a slim column: the outstanding player of a tournament.
      const g = 'gb' + h.toString(36).slice(0, 5);
      body = `<defs><radialGradient id="${g}" cx="34%" cy="26%" r="80%">
          <stop offset="0" stop-color="#fff6d2"/><stop offset="0.26" stop-color="#f6cf5c"/>
          <stop offset="0.66" stop-color="#cf9a22"/><stop offset="1" stop-color="#6d4c0c"/>
        </radialGradient></defs>
        <circle cx="50" cy="30" r="22" fill="url(#${g})"/>
        <g fill="none" stroke="#7d5a10" stroke-width="1.4" opacity="0.6" stroke-linejoin="round">
          <path d="M46 20 L53 24 L51 32 L43 32 L41 24 Z"/>
          <path d="M46 20 L47 10 M53 24 L61 17 M51 32 L57 40 M43 32 L37 40 M41 24 L33 18"/>
        </g>
        <ellipse cx="41" cy="21" rx="8" ry="6" fill="#fff" opacity="0.38" transform="rotate(-28 41 21)"/>
        <path d="M27 34 q-6 16 8 26 M73 34 q6 16 -8 26" stroke="#c99a2e" stroke-width="4" fill="none" opacity="0.85"/>
        <rect x="45" y="50" width="10" height="24" rx="3" fill="#e0b23c"/>
        <path d="M32 74 h36 q3 8 -4 9 h-28 q-7 -1 -4 -9 z" fill="#c99a2e"/>
        <rect x="30" y="83" width="40" height="6" rx="2" fill="#8a6412"/>`;
      break;
    }
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
  // Shapes that model a whole trophy bring their own base with them.
  const plinth = (shape === 'ballon' || shape === 'goldenball') ? '' : `
    <path d="M36 78 H64 L68 90 H32 Z" fill="${m}" opacity="0.9"/>
    <rect x="30" y="90" width="40" height="6" rx="2" fill="${ribbon}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${escapeAttr(trophy.name)}">
    ${body}${plinth}
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
