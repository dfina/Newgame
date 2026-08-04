// Illustrations for decision cards: original inline SVG scenes, one per theme.
// Inline because the page has no network budget for stock photography and no
// right to any — these are drawn from primitives, sized by the card, and tuned
// to sit on the dark panel without fighting the odds chips beneath them.

const P = {
  grass: ['#1b5e34', '#0f3b21'],
  night: ['#1b2440', '#0c1020'],
  warm: ['#3a2a17', '#1c1409'],
  cool: ['#16304a', '#0b1a2a'],
  red: ['#4a1d1d', '#240d0d'],
  sky: ['#1d4a63', '#0d2433']
};

function frame(id, pair, body) {
  const [a, b] = pair;
  return `<svg class="art" viewBox="0 0 120 96" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="120" height="96" fill="url(#${id})"/>
    ${body}
  </svg>`;
}

// Each scene is drawn against a tinted ground, in a limited palette so a row
// of two cards reads as one object rather than two posters.
const SCENES = {
  // A ball on the centre spot, halfway line behind it.
  pitch: () => `<g stroke="#ffffff2e" fill="none" stroke-width="1.6">
      <line x1="0" y1="48" x2="120" y2="48"/><circle cx="60" cy="48" r="20"/></g>
    <circle cx="60" cy="48" r="9" fill="#f2f4f7"/>
    <path d="M60 39 l5 4 -2 6 h-6 l-2 -6 z" fill="#1b2430"/>`,

  // Cones laid out for a drill.
  cones: () => `<g fill="#c6f24b">
      <path d="M20 74 l8 -22 8 22 z"/><path d="M52 78 l9 -26 9 26 z"/><path d="M86 72 l7 -20 7 20 z"/></g>
    <g stroke="#ffffff26" stroke-width="1.4"><line x1="0" y1="82" x2="120" y2="82"/></g>
    <circle cx="99" cy="40" r="7" fill="#eef1f5"/>`,

  // Boots and a ball, mid-stride.
  training: () => `<path d="M22 68 q14 -6 26 -2 l12 4 q6 2 6 7 h-46 z" fill="#e8ecf2"/>
    <path d="M60 77 h-46 v5 h48 q4 0 4 -3 z" fill="#9aa4b2"/>
    <circle cx="90" cy="62" r="13" fill="#f2f4f7"/>
    <path d="M90 49 l7 6 -3 9 h-9 l-3 -9 z" fill="#1b2430"/>`,

  // A weights bar: the physical route.
  gym: () => `<rect x="18" y="44" width="84" height="6" rx="3" fill="#cdd5df"/>
    <g fill="#7f8a99"><rect x="16" y="32" width="9" height="30" rx="3"/><rect x="28" y="38" width="7" height="18" rx="3"/>
    <rect x="95" y="32" width="9" height="30" rx="3"/><rect x="85" y="38" width="7" height="18" rx="3"/></g>
    <path d="M0 78 h120" stroke="#ffffff1f" stroke-width="2"/>`,

  // A plate of clean food.
  nutrition: () => `<circle cx="60" cy="52" r="27" fill="#eceff3"/><circle cx="60" cy="52" r="21" fill="#dfe4ea"/>
    <path d="M46 52 a12 9 0 0 1 24 0 z" fill="#4caf50"/>
    <circle cx="70" cy="45" r="6" fill="#e2544a"/><circle cx="52" cy="43" r="5" fill="#f0a83c"/>
    <rect x="18" y="40" width="4" height="26" rx="2" fill="#9aa4b2"/><rect x="99" y="40" width="4" height="26" rx="2" fill="#9aa4b2"/>`,

  // The other diet.
  burger: () => `<path d="M32 46 a28 18 0 0 1 56 0 z" fill="#c98a3e"/>
    <rect x="30" y="46" width="60" height="7" rx="3" fill="#7ab55c"/>
    <rect x="30" y="53" width="60" height="10" rx="3" fill="#6b3d24"/>
    <rect x="30" y="63" width="60" height="7" rx="3" fill="#e0a94f"/>
    <path d="M30 70 h60 a6 6 0 0 1 -6 8 h-48 a6 6 0 0 1 -6 -8 z" fill="#c98a3e"/>`,

  // Camera and microphone: the media option.
  media: () => `<rect x="26" y="38" width="46" height="30" rx="4" fill="#20293a" stroke="#8894a6" stroke-width="1.5"/>
    <path d="M72 46 l20 -8 v34 l-20 -8 z" fill="#2b3547" stroke="#8894a6" stroke-width="1.5"/>
    <circle cx="42" cy="53" r="8" fill="#4c8dff" opacity="0.85"/>
    <rect x="52" y="70" width="6" height="18" rx="3" fill="#6d7686"/><circle cx="55" cy="68" r="6" fill="#c2cad6"/>`,

  // Head down, out of the noise.
  quiet: () => `<circle cx="60" cy="42" r="14" fill="#c2cad6"/>
    <path d="M36 82 q24 -22 48 0 z" fill="#8894a6"/>
    <path d="M22 22 l14 10 M98 22 l-14 10" stroke="#ffffff26" stroke-width="2"/>`,

  // The armband.
  armband: () => `<path d="M30 40 h60 v22 h-60 z" fill="#e2b23c"/>
    <path d="M30 40 q30 10 60 0 v22 q-30 10 -60 0 z" fill="#f0c65a"/>
    <text x="60" y="57" font-family="system-ui,sans-serif" font-size="13" font-weight="800" fill="#3a2a06" text-anchor="middle">C</text>`,

  // A contract on the desk.
  contract: () => `<rect x="32" y="24" width="56" height="52" rx="4" fill="#eceff3"/>
    <g stroke="#9aa4b2" stroke-width="2"><line x1="40" y1="36" x2="80" y2="36"/><line x1="40" y1="44" x2="80" y2="44"/>
      <line x1="40" y1="52" x2="68" y2="52"/></g>
    <path d="M42 66 q10 -8 18 0 q8 8 18 -4" stroke="#4c8dff" stroke-width="2.5" fill="none"/>`,

  // Money on the table.
  money: () => `<g><rect x="24" y="46" width="50" height="28" rx="3" fill="#2e7d52"/>
    <rect x="34" y="38" width="50" height="28" rx="3" fill="#3a9765"/>
    <rect x="44" y="30" width="50" height="28" rx="3" fill="#46b077"/>
    <circle cx="69" cy="44" r="8" fill="#eef7f1" opacity="0.9"/></g>`,

  // A handshake: the steady road.
  handshake: () => `<path d="M20 52 l22 -10 18 8 -18 10 z" fill="#c2cad6"/>
    <path d="M100 52 l-22 -10 -18 8 18 10 z" fill="#8894a6"/>
    <rect x="52" y="48" width="16" height="12" rx="4" fill="#eceff3"/>`,

  // Neon and a long night.
  nightlife: () => `<g fill="#ffffff14"><rect x="14" y="18" width="18" height="60"/><rect x="40" y="30" width="16" height="48"/>
      <rect x="64" y="14" width="20" height="64"/><rect x="92" y="34" width="14" height="44"/></g>
    <g fill="#f0a83c"><rect x="18" y="26" width="4" height="6"/><rect x="26" y="38" width="4" height="6"/>
      <rect x="70" y="24" width="4" height="6"/><rect x="76" y="44" width="4" height="6"/></g>
    <path d="M46 62 l12 -14 12 14 -12 6 z" fill="#c060d8" opacity="0.8"/>`,

  // A lamp on at home.
  home: () => `<path d="M28 52 l32 -24 32 24 v30 h-64 z" fill="#2b3547"/>
    <path d="M22 54 l38 -28 38 28" stroke="#8894a6" stroke-width="3" fill="none"/>
    <rect x="50" y="60" width="20" height="22" rx="2" fill="#f0c65a" opacity="0.9"/>`,

  // A tactics board.
  tactics: () => `<rect x="20" y="22" width="80" height="54" rx="4" fill="#14401f" stroke="#8894a6" stroke-width="1.5"/>
    <g stroke="#ffffff40" fill="none" stroke-width="1.2"><line x1="60" y1="22" x2="60" y2="76"/><circle cx="60" cy="49" r="10"/></g>
    <g fill="#f2f4f7"><circle cx="36" cy="38" r="3.5"/><circle cx="36" cy="60" r="3.5"/><circle cx="52" cy="49" r="3.5"/></g>
    <g fill="#e2544a"><circle cx="80" cy="38" r="3.5"/><circle cx="86" cy="58" r="3.5"/></g>
    <path d="M52 49 q14 -12 28 -11" stroke="#f0c65a" stroke-width="2" fill="none" stroke-dasharray="4 3"/>`,

  // The signature boot.
  boot: () => `<path d="M24 62 q16 -8 30 -4 l16 5 q10 3 10 11 h-56 z" fill="#f0c65a"/>
    <path d="M80 74 h-56 v6 h58 q4 0 4 -3 z" fill="#8894a6"/>
    <path d="M34 56 l10 4 M44 52 l10 5 M54 50 l10 6" stroke="#3a2a06" stroke-width="2"/>`,

  // Two players squaring up.
  row: () => `<circle cx="42" cy="36" r="11" fill="#c2cad6"/><path d="M24 76 q18 -20 36 0 z" fill="#8894a6"/>
    <circle cx="82" cy="36" r="11" fill="#e2a3a0"/><path d="M64 76 q18 -20 36 0 z" fill="#b5716e"/>
    <path d="M52 44 l20 0" stroke="#f2544b" stroke-width="3"/>`,

  // The spot, twelve yards out.
  penalty: () => `<g stroke="#ffffff33" fill="none" stroke-width="2"><rect x="14" y="14" width="92" height="30" rx="1"/>
      <rect x="36" y="14" width="48" height="14" rx="1"/></g>
    <circle cx="60" cy="60" r="3" fill="#ffffff66"/>
    <circle cx="60" cy="74" r="9" fill="#f2f4f7"/><path d="M60 65 l5 4 -2 6 h-6 l-2 -6 z" fill="#1b2430"/>`,

  // A parasol and a flat sea.
  beach: () => `<rect x="0" y="58" width="120" height="38" fill="#1c6b7d"/>
    <path d="M30 44 a26 16 0 0 1 52 0 z" fill="#e0a94f"/>
    <rect x="54" y="44" width="4" height="30" rx="2" fill="#8894a6"/>
    <g fill="#eceff3"><rect x="66" y="64" width="26" height="5" rx="2"/><rect x="20" y="66" width="24" height="5" rx="2"/></g>
    <circle cx="98" cy="24" r="10" fill="#f0c65a"/>`,

  // A plane over a runway: the move abroad.
  plane: () => `<path d="M18 58 l50 -12 22 -18 6 6 -14 18 24 -6 6 8 -26 12 -8 20 -8 2 2 -18 -50 12 z" fill="#e4e9f0"/>
    <path d="M0 80 h120" stroke="#ffffff26" stroke-width="3" stroke-dasharray="10 8"/>`,

  // A suitcase: a season away on loan.
  loan: () => `<rect x="30" y="38" width="60" height="40" rx="5" fill="#6b4a2c"/>
    <rect x="30" y="52" width="60" height="6" fill="#4a3320"/>
    <path d="M50 38 v-8 a10 6 0 0 1 20 0 v8" stroke="#c2cad6" stroke-width="3" fill="none"/>
    <rect x="54" y="50" width="12" height="10" rx="2" fill="#e0a94f"/>`,

  // A flag on a pole.
  flag: () => `<rect x="34" y="18" width="4" height="62" rx="2" fill="#c2cad6"/>
    <path d="M38 22 q18 8 34 0 v26 q-16 8 -34 0 z" fill="#4c8dff"/>
    <path d="M38 30 q18 8 34 0" stroke="#ffffff55" stroke-width="2" fill="none"/>`,

  // A young player being shown the way.
  youth: () => `<circle cx="44" cy="34" r="12" fill="#c2cad6"/><path d="M24 78 q20 -22 40 0 z" fill="#8894a6"/>
    <circle cx="82" cy="46" r="8" fill="#e4e9f0"/><path d="M68 78 q14 -16 28 0 z" fill="#a7b1c0"/>
    <path d="M60 44 q10 4 14 8" stroke="#f0c65a" stroke-width="2.5" fill="none"/>`,

  // Hands and a heart: the community day.
  charity: () => `<path d="M60 76 q-26 -16 -26 -32 a13 13 0 0 1 26 -6 a13 13 0 0 1 26 6 q0 16 -26 32 z" fill="#e2544a"/>
    <path d="M20 82 q20 -10 40 -4 q20 -6 40 4" stroke="#ffffff33" stroke-width="3" fill="none"/>`
};

export function cardArt(key) {
  const scene = SCENES[key] || SCENES.pitch;
  const tint = {
    gym: P.cool, nutrition: P.cool, burger: P.warm, media: P.night, quiet: P.night,
    armband: P.warm, contract: P.cool, money: P.grass, handshake: P.cool,
    nightlife: P.night, home: P.night, tactics: P.grass, boot: P.warm, row: P.red,
    penalty: P.grass, beach: P.sky, plane: P.sky, loan: P.warm, flag: P.cool,
    youth: P.cool, charity: P.red, cones: P.grass, training: P.grass, pitch: P.grass
  }[key] || P.grass;
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  return frame(id, tint, scene());
}
