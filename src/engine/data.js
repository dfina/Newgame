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

// Where a club sits within its division, 0..1: 0 is a relegation candidate,
// 1 is the side that wins the thing. Clubs the game has no opinion about fall
// back to a stable hash of the name, which spreads them evenly across the
// division and keeps every league playable.
//
// The table below is gameplay tuning informed by recent standing — the same
// kind of value as COEFF above, not a sourced fact — and exists because a
// league where Real Madrid and Getafe are equally likely to win it does not
// feel like football, and because it decides which clubs come calling for a
// player of a given standard.
const STATURE = {
  // Spain
  'Real Madrid': 0.98, 'Barcelona': 0.97, 'Atlético Madrid': 0.88, 'Athletic Club': 0.74,
  'Villarreal': 0.72, 'Real Betis': 0.68, 'Real Sociedad': 0.66, 'Sevilla': 0.62,
  'Valencia': 0.56, 'Celta Vigo': 0.54, 'Osasuna': 0.50, 'Rayo Vallecano': 0.46,
  'Getafe': 0.45, 'Espanyol': 0.40, 'Alavés': 0.36, 'Elche': 0.32, 'Levante': 0.30,
  'Racing Santander': 0.28, 'Deportivo La Coruña': 0.30, 'Málaga': 0.27,
  // England
  'Manchester City': 0.96, 'Liverpool': 0.95, 'Arsenal': 0.93, 'Chelsea': 0.85,
  'Manchester United': 0.78, 'Tottenham Hotspur': 0.76, 'Newcastle United': 0.74,
  'Aston Villa': 0.72, 'Brighton & Hove Albion': 0.62, 'Nottingham Forest': 0.58,
  'Crystal Palace': 0.56, 'Fulham': 0.52, 'Bournemouth': 0.52, 'Everton': 0.50,
  'Brentford': 0.48, 'Leeds United': 0.44, 'Sunderland': 0.38, 'Ipswich Town': 0.32,
  'Coventry City': 0.30, 'Hull City': 0.26,
  // Italy
  'Inter': 0.93, 'Napoli': 0.88, 'Juventus': 0.87, 'Milan': 0.85, 'Atalanta': 0.82,
  'Roma': 0.76, 'Lazio': 0.70, 'Fiorentina': 0.66, 'Bologna': 0.62, 'Torino': 0.52,
  'Udinese': 0.48, 'Como': 0.48, 'Genoa': 0.42, 'Cagliari': 0.38, 'Sassuolo': 0.36,
  'Parma': 0.34, 'Lecce': 0.30, 'Monza': 0.30, 'Venezia': 0.26, 'Frosinone': 0.24,
  // Germany
  'Bayern Munich': 0.97, 'Bayer Leverkusen': 0.86, 'Borussia Dortmund': 0.84,
  'RB Leipzig': 0.80, 'Eintracht Frankfurt': 0.72, 'VfB Stuttgart': 0.66,
  'SC Freiburg': 0.60, 'Borussia Mönchengladbach': 0.54, 'Werder Bremen': 0.52,
  'FSV Mainz 05': 0.50, 'TSG Hoffenheim': 0.48, 'Union Berlin': 0.46, 'FC Augsburg': 0.42,
  'Hamburger SV': 0.40, '1. FC Köln': 0.38, 'Schalke 04': 0.36, 'SC Paderborn': 0.26,
  'SV Elversberg': 0.24,
  // France
  'Paris Saint-Germain': 0.98, 'Olympique de Marseille': 0.78, 'AS Monaco': 0.76,
  'LOSC Lille': 0.70, 'Olympique Lyonnais': 0.68, 'OGC Nice': 0.62, 'RC Lens': 0.58,
  'Stade Rennais FC': 0.54, 'RC Strasbourg': 0.52, 'Toulouse FC': 0.44,
  'Stade Brestois 29': 0.42, 'AJ Auxerre': 0.38, 'Paris FC': 0.32, 'Angers SCO': 0.30,
  'FC Lorient': 0.30, 'Le Havre AC': 0.28, 'ESTAC Troyes': 0.24, 'Le Mans FC': 0.22,
  // Portugal, Netherlands, Scotland, Belgium, Greece, Turkey
  'SL Benfica': 0.93, 'FC Porto': 0.92, 'Sporting CP': 0.91, 'SC Braga': 0.78,
  'Vitória SC': 0.62, 'FC Famalicão': 0.48, 'Moreirense FC': 0.44, 'Gil Vicente FC': 0.42,
  'Rio Ave FC': 0.40, 'Estoril Praia': 0.38, 'FC Arouca': 0.38, 'CD Santa Clara': 0.36,
  'Casa Pia AC': 0.32, 'CD Nacional': 0.30, 'CD Marítimo': 0.30, 'Estrela da Amadora': 0.28,
  'FC Alverca': 0.26, 'Académico de Viseu': 0.24,
  'PSV': 0.92, 'Ajax': 0.90, 'Feyenoord': 0.86, 'AZ': 0.74, 'FC Twente': 0.68,
  'FC Utrecht': 0.62, 'Go Ahead Eagles': 0.48, 'N.E.C. Nijmegen': 0.48, 'SC Heerenveen': 0.46,
  'Sparta Rotterdam': 0.40, 'FC Groningen': 0.38, 'PEC Zwolle': 0.34, 'Fortuna Sittard': 0.34,
  'Willem II': 0.30, 'Excelsior Rotterdam': 0.28, 'ADO Den Haag': 0.26, 'SC Cambuur': 0.26,
  'Telstar': 0.18,
  'Celtic': 0.96, 'Rangers': 0.90, 'Aberdeen': 0.62, 'Heart of Midlothian': 0.60,
  'Hibernian': 0.56, 'Dundee United': 0.44, 'Motherwell': 0.42, 'St Mirren': 0.38,
  'Kilmarnock': 0.36, 'Dundee': 0.32, 'St Johnstone': 0.30, 'Falkirk': 0.26,
  'Club Brugge': 0.90, 'Union Saint-Gilloise': 0.82, 'Anderlecht': 0.78, 'Genk': 0.74,
  'Gent': 0.68, 'Royal Antwerp': 0.66, 'Standard Liège': 0.60, 'Cercle Brugge': 0.52,
  'Charleroi': 0.48, 'Sint-Truiden': 0.44, 'KVC Westerlo': 0.42, 'OH Leuven': 0.38,
  'Zulte Waregem': 0.36, 'Kortrijk': 0.30, 'Beveren': 0.30, 'RAAL La Louvière': 0.28,
  'Lommel': 0.26,
  'Olympiacos': 0.92, 'PAOK': 0.84, 'AEK Athens': 0.82, 'Panathinaikos': 0.80,
  'Aris Thessaloniki': 0.60, 'Atromitos': 0.44, 'OFI Crete': 0.40, 'Asteras Tripolis': 0.40,
  'Panetolikos': 0.34, 'Volos': 0.32, 'Iraklis': 0.28, 'Kalamata': 0.26,
  'Galatasaray': 0.94, 'Fenerbahçe': 0.90, 'Beşiktaş': 0.80, 'Trabzonspor': 0.72,
  'İstanbul Başakşehir': 0.62, 'Samsunspor': 0.52, 'Konyaspor': 0.48, 'Alanyaspor': 0.46,
  'Göztepe': 0.44, 'Kasımpaşa': 0.40, 'Çaykur Rizespor': 0.38, 'Gaziantep FK': 0.38,
  'Eyüpspor': 0.34, 'Gençlerbirliği': 0.30, 'Kocaelispor': 0.28, 'Erzurumspor': 0.24,
  'Amedspor': 0.24, 'Çorum FK': 0.22,
  // South America
  'Palmeiras': 0.93, 'Flamengo': 0.92, 'Botafogo': 0.80, 'Atlético Mineiro': 0.76,
  'Cruzeiro': 0.74, 'São Paulo': 0.74, 'Corinthians': 0.72, 'Grêmio': 0.70,
  'Internacional': 0.70, 'Fluminense': 0.68, 'Bahia': 0.64, 'Santos': 0.58,
  'Vasco da Gama': 0.58, 'Red Bull Bragantino': 0.56, 'Athletico Paranaense': 0.54,
  'Vitória': 0.40, 'Mirassol': 0.38, 'Coritiba': 0.36, 'Chapecoense': 0.30, 'Clube do Remo': 0.28,
  'River Plate': 0.93, 'Boca Juniors': 0.92, 'Racing Club': 0.78, 'Vélez Sarsfield': 0.70,
  'Independiente': 0.70, 'Estudiantes de La Plata': 0.68, 'San Lorenzo': 0.66,
  'Talleres': 0.64, 'Rosario Central': 0.62, 'Lanús': 0.60, "Newell's Old Boys": 0.58,
  'Argentinos Juniors': 0.56, 'Defensa y Justicia': 0.56, 'Huracán': 0.52, 'Banfield': 0.48,
  'Belgrano': 0.46, 'Unión de Santa Fe': 0.44, 'Gimnasia y Esgrima La Plata': 0.44,
  'Central Córdoba (SdE)': 0.42, 'Atlético Tucumán': 0.42, 'Platense': 0.40, 'Tigre': 0.40,
  'Instituto': 0.40, 'Barracas Central': 0.38, 'Independiente Rivadavia': 0.36,
  'Sarmiento (Junín)': 0.32, 'Deportivo Riestra': 0.30, 'Aldosivi': 0.28,
  'Gimnasia de Mendoza': 0.28, 'Estudiantes de Río Cuarto': 0.26,
  // Rest of the world
  'Zenit Saint Petersburg': 0.90, 'Krasnodar': 0.82, 'Spartak Moscow': 0.80,
  'CSKA Moscow': 0.74, 'Lokomotiv Moscow': 0.74, 'Dinamo Moscow': 0.72,
  'Shakhtar Donetsk': 0.92, 'Dynamo Kyiv': 0.88,
  'Club América': 0.88, 'Cruz Azul': 0.82, 'Tigres UANL': 0.80, 'Monterrey (Rayados)': 0.80,
  'Toluca': 0.76, 'Guadalajara (Chivas)': 0.72, 'Pachuca': 0.70, 'León': 0.64,
  'Santos Laguna': 0.56,
  'Al-Hilal': 0.95, 'Al-Nassr': 0.90, 'Al-Ittihad': 0.86, 'Al-Ahli': 0.84,
  'Kawasaki Frontale': 0.78, 'Vissel Kobe': 0.78, 'Kashima Antlers': 0.74,
  'Yokohama F. Marinos': 0.74, 'Urawa Red Diamonds': 0.72, 'Sanfrecce Hiroshima': 0.70,
  'Gamba Osaka': 0.62, 'Cerezo Osaka': 0.60,
  'Al Ahly': 0.96, 'Zamalek': 0.88, 'Pyramids FC': 0.84,
  'Mamelodi Sundowns': 0.94, 'Orlando Pirates': 0.78, 'Kaizer Chiefs': 0.66,
  'Stellenbosch FC': 0.60,
  'Wydad Casablanca': 0.88, 'Raja Club Athletic': 0.86, 'Renaissance de Berkane': 0.72,
  'AS FAR Rabat': 0.70,
  'Los Angeles FC': 0.84, 'Inter Miami CF': 0.82, 'Columbus Crew': 0.78, 'FC Cincinnati': 0.78,
  'Seattle Sounders FC': 0.74, 'Philadelphia Union': 0.72, 'San Diego FC': 0.70,
  'LA Galaxy': 0.66, 'New York City FC': 0.66, 'Vancouver Whitecaps FC': 0.66,
  'Orlando City SC': 0.62, 'Nashville SC': 0.58, 'New York Red Bulls': 0.58,
  'Atlanta United FC': 0.58, 'Portland Timbers': 0.58, 'Minnesota United FC': 0.56,
  'Charlotte FC': 0.56, 'Houston Dynamo FC': 0.52, 'Real Salt Lake': 0.52,
  'Sporting Kansas City': 0.48, 'Austin FC': 0.48, 'FC Dallas': 0.46, 'Colorado Rapids': 0.44,
  'New England Revolution': 0.44, 'Chicago Fire FC': 0.42, 'St. Louis City SC': 0.40,
  'Toronto FC': 0.40, 'San Jose Earthquakes': 0.34, 'D.C. United': 0.34, 'CF Montréal': 0.32
};

export function clubStature(clubName) {
  const known = STATURE[clubName];
  return known !== undefined ? known : strHash(clubName);
}

// Stable per-club strength within a league. The spread has to be wide: a
// champion takes well over two points a game and a relegated side barely one,
// and a table where everyone finishes within a few points of each other is
// what let any club win anything.
export function clubStrength(clubName, level) {
  return level * (0.70 + clubStature(clubName) * 0.60);
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

// Reserve, B and under-age sides genuinely play in some second tiers, so they
// belong in the league tables — but nobody signs for one as a professional.
// The markers only count where they actually sit: as a suffix ("Sporting CP
// B", "Hamburger SV II") or the Dutch prefix ("Jong Ajax"). A leading letter
// is part of the name — B 36 Tórshavn is a club in its own right.
const RESERVE_SUFFIX = /\S+\s+(ii|iii|b|u\s?1[6-9]|u\s?2[0-3]|reserves?|futures|nxt)(\s|$)/i;
const RESERVE_PREFIX = /^jong\s/i;

export function isReserveSide(name) {
  const n = String(name).replace(/[.'’\-–—/()]/g, ' ').replace(/\s+/g, ' ').trim();
  return RESERVE_PREFIX.test(n) || RESERVE_SUFFIX.test(n);
}

// Build a flat playable list of leagues for a country file.
export function playableLeagues(countryData) {
  if (!countryData?.leagues) return [];
  return countryData.leagues
    .filter((l) => Array.isArray(l.clubs) && l.clubs.length >= 6)
    .sort((a, b) => a.tier - b.tier);
}
