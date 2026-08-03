// Competition framework: domestic cups, continental club competitions,
// international tournaments. Names of real competitions are used as labels;
// cycles are game config.

// Real domestic cup names for well-known associations; generic fallback otherwise.
const CUP_NAMES = {
  ENG: 'FA Cup', ESP: 'Copa del Rey', ITA: 'Coppa Italia', GER: 'DFB-Pokal',
  FRA: 'Coupe de France', POR: 'Taça de Portugal', NED: 'KNVB Beker',
  SCO: 'Scottish Cup', BEL: 'Belgian Cup', TUR: 'Turkish Cup', GRE: 'Greek Cup',
  ARG: 'Copa Argentina', BRA: 'Copa do Brasil', USA: 'US Open Cup', MEX: 'Copa MX',
  JPN: 'Emperor’s Cup', KOR: 'Korean FA Cup', KSA: 'King’s Cup',
  EGY: 'Egypt Cup', MAR: 'Throne Cup', RSA: 'Nedbank Cup', AUS: 'Australia Cup',
  CHI: 'Copa Chile', COL: 'Copa Colombia', URU: 'Copa Uruguay', SUI: 'Swiss Cup',
  AUT: 'ÖFB-Cup', DEN: 'Danish Cup', SWE: 'Svenska Cupen', NOR: 'Norwegian Cup',
  POL: 'Polish Cup', CZE: 'Czech Cup', CRO: 'Croatian Cup', SRB: 'Serbian Cup',
  ROU: 'Cupa României', UKR: 'Ukrainian Cup', RUS: 'Russian Cup', IRL: 'FAI Cup',
  NIR: 'Irish Cup', WAL: 'Welsh Cup', ISR: 'Israel State Cup', IND: 'Super Cup',
  CHN: 'Chinese FA Cup', NGA: 'Federation Cup', GHA: 'Ghanaian FA Cup'
};

export function domesticCupName(code, countryName) {
  return CUP_NAMES[code] || `${countryName} Cup`;
}

// Continental club competitions per confederation: [primary, secondary].
export const CONTINENTAL = {
  UEFA: [
    { key: 'ucl', name: 'UEFA Champions League', prestige: 100 },
    { key: 'uel', name: 'UEFA Europa League', prestige: 72 },
    { key: 'uecl', name: 'UEFA Conference League', prestige: 55 }
  ],
  CONMEBOL: [
    { key: 'libertadores', name: 'Copa Libertadores', prestige: 88 },
    { key: 'sudamericana', name: 'Copa Sudamericana', prestige: 62 }
  ],
  CONCACAF: [
    { key: 'ccc', name: 'CONCACAF Champions Cup', prestige: 70 }
  ],
  CAF: [
    { key: 'cafcl', name: 'CAF Champions League', prestige: 72 },
    { key: 'cafcc', name: 'CAF Confederation Cup', prestige: 52 }
  ],
  AFC: [
    { key: 'acle', name: 'AFC Champions League Elite', prestige: 72 },
    { key: 'acl2', name: 'AFC Champions League Two', prestige: 52 }
  ],
  OFC: [
    { key: 'ofccl', name: 'OFC Champions League', prestige: 45 }
  ]
};

// Continental national-team championships. First editions on/after 2027,
// then the real cycle (config approximations for the game calendar).
export const NATIONS_TOURNAMENTS = {
  UEFA: { name: 'European Championship', first: 2028, cycle: 4, prestige: 90 },
  CONMEBOL: { name: 'Copa América', first: 2028, cycle: 4, prestige: 85 },
  CONCACAF: { name: 'Gold Cup', first: 2027, cycle: 2, prestige: 62 },
  CAF: { name: 'Africa Cup of Nations', first: 2027, cycle: 2, prestige: 72 },
  AFC: { name: 'Asian Cup', first: 2027, cycle: 4, prestige: 70 },
  OFC: { name: 'OFC Nations Cup', first: 2028, cycle: 4, prestige: 45 }
};

export const WORLD_CUP = { name: 'FIFA World Cup', first: 2026, cycle: 4, prestige: 100 };

export function isWorldCupYear(year) {
  return year >= WORLD_CUP.first && (year - WORLD_CUP.first) % WORLD_CUP.cycle === 0;
}

export function continentalTournamentInYear(confed, year) {
  const t = NATIONS_TOURNAMENTS[confed];
  if (!t) return null;
  if (year >= t.first && (year - t.first) % t.cycle === 0) return t;
  return null;
}

// How many continental club slots a league's top finish earns, by country coeff.
export function continentalSlots(coeff) {
  if (coeff >= 80) return { primary: 4, secondary: 2 };
  if (coeff >= 65) return { primary: 2, secondary: 2 };
  if (coeff >= 50) return { primary: 1, secondary: 2 };
  return { primary: 1, secondary: 1 };
}

export const AWARDS = {
  goldenBoot: 'Golden Boot',
  playerOfSeason: 'Player of the Season',
  worldBest: 'World Footballer of the Year',
  youngPlayer: 'Young Player of the Year',
  goldenGlove: 'Golden Glove'
};
