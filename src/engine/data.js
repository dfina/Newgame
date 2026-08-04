// Loads association and league data files, and models club/league strength.
import { strHash } from './rng.js';

let associations = null;
const countryCache = new Map();

export async function loadAssociations() {
  if (associations) return associations;
  const res = await fetch('data/associations.json');
  const json = await res.json();
  associations = json.associations;
  return associations;
}

export function getAssociation(code) {
  return associations?.find((a) => a.code === code) || null;
}

// Returns the parsed league file for an association, or null when absent.
export async function loadCountry(code) {
  if (countryCache.has(code)) return countryCache.get(code);
  let data = null;
  try {
    const res = await fetch(`data/leagues/${code}.json`);
    if (res.ok) data = await res.json();
  } catch { /* offline or missing — treated as no data */ }
  countryCache.set(code, data);
  return data;
}

export function listCountryCodesCached() {
  return [...countryCache.keys()].filter((c) => countryCache.get(c)?.leagues?.length);
}

// Strength coefficient per association's league system, 0..100.
// Gameplay tuning values (not sourced facts): informed by relative standing
// of leagues; defaults per confederation for the long tail.
const COEFF = {
  ENG: 95, ESP: 90, ITA: 87, GER: 87, FRA: 83,
  POR: 76, NED: 76, BEL: 71, TUR: 70, SCO: 62, AUT: 63, SUI: 64, GRE: 62,
  CZE: 61, DEN: 62, CRO: 60, NOR: 60, SWE: 60, POL: 60, UKR: 60, SRB: 58,
  RUS: 60, ROU: 56, ISR: 55, HUN: 54, CYP: 53, BUL: 51, SVK: 51, SVN: 51,
  BIH: 48, ALB: 45, MKD: 44, IRL: 47, NIR: 40, WAL: 38, ISL: 46, FIN: 47,
  KAZ: 48, AZE: 47, GEO: 46, ARM: 43, BLR: 46, MDA: 42, LVA: 41, LTU: 41,
  EST: 40, MLT: 38, LUX: 38, FRO: 35, MNE: 42, KOS: 42, GIB: 30, AND: 28, SMR: 22, LIE: 30,
  BRA: 82, ARG: 78, URU: 66, COL: 65, CHI: 62, ECU: 62, PAR: 60, PER: 58, BOL: 52, VEN: 52,
  MEX: 74, USA: 72, CAN: 58, CRC: 56, HON: 52, PAN: 52, SLV: 48, GUA: 50, JAM: 45, TRI: 42,
  KSA: 72, JPN: 70, KOR: 66, QAT: 62, UAE: 60, IRN: 60, AUS: 60, CHN: 58, UZB: 55, IRQ: 52, THA: 50, IND: 48, VIE: 47, IDN: 46, MAS: 46,
  EGY: 62, MAR: 62, RSA: 58, TUN: 58, ALG: 58, NGA: 50, GHA: 46, CIV: 46, SEN: 46, COD: 46, ZAM: 43, TAN: 44, KEN: 42, UGA: 42, ANG: 42, SDN: 40,
  NZL: 44
};
const CONF_DEFAULT = { UEFA: 36, CONMEBOL: 50, CONCACAF: 34, CAF: 34, AFC: 34, OFC: 24 };

export function countryCoeff(code, confederation) {
  return COEFF[code] ?? CONF_DEFAULT[confederation] ?? 30;
}

// Absolute league level 0..100: tier 1 = coeff, each tier down ~72% of the one above.
export function leagueLevel(coeff, tier) {
  return coeff * Math.pow(0.72, tier - 1);
}

// Where a club sits within its division, 0..1, stable for the life of the
// club: 0 is a relegation candidate, 1 is the side that wins the thing.
export function clubStature(clubName) {
  return strHash(clubName);
}

// Stable per-club strength within a league: level ± 18% by name hash.
export function clubStrength(clubName, level) {
  return level * (0.82 + clubStature(clubName) * 0.36);
}

// A club promoted into a stronger division does not become a stronger club
// overnight — it arrives as one of the weakest sides there and has to build.
// This drifts a club's absolute quality toward what its stature would be worth
// in its current division, a fraction of the way each season, which is why a
// Serie D side cannot reach Serie A in three years and why a club that keeps
// qualifying for Europe becomes genuinely capable of winning it.
const DRIFT = 0.16;

export function settleClubQuality(current, clubName, level) {
  const target = clubStrength(clubName, level);
  if (current == null) return target;
  return current + (target - current) * DRIFT;
}

// Build a flat playable list of leagues for a country file.
export function playableLeagues(countryData) {
  if (!countryData?.leagues) return [];
  return countryData.leagues
    .filter((l) => Array.isArray(l.clubs) && l.clubs.length >= 6)
    .sort((a, b) => a.tier - b.tier);
}
