// Playing positions: the specific role a player occupies on the pitch, the
// coordinates used to draw the position picker, and the per-90 output each
// role is expected to produce at an average standard.
//
// x/y are percentages on a vertical pitch drawn with the player's own goal at
// the bottom (y = 100) and the opposition goal at the top (y = 0).

export const ROLES = [
  { key: 'GK',  name: 'Goalkeeper',           group: 'GK',  x: 50, y: 91, shirt: [1, 12, 13],     goals: 0,    assists: 0.005 },
  { key: 'LB',  name: 'Left-back',            group: 'DEF', x: 16, y: 75, shirt: [3, 15, 33],     goals: 0.04, assists: 0.13 },
  { key: 'CB',  name: 'Centre-back',          group: 'DEF', x: 50, y: 79, shirt: [4, 5, 6, 24],   goals: 0.07, assists: 0.03 },
  { key: 'RB',  name: 'Right-back',           group: 'DEF', x: 84, y: 75, shirt: [2, 12, 22],     goals: 0.04, assists: 0.13 },
  { key: 'LWB', name: 'Left wing-back',       group: 'DEF', x: 10, y: 62, shirt: [3, 17, 30],     goals: 0.06, assists: 0.20 },
  { key: 'CDM', name: 'Defensive midfielder', group: 'MID', x: 50, y: 63, shirt: [6, 16, 23],     goals: 0.06, assists: 0.10 },
  { key: 'RWB', name: 'Right wing-back',      group: 'DEF', x: 90, y: 62, shirt: [2, 18, 27],     goals: 0.06, assists: 0.20 },
  { key: 'LM',  name: 'Left midfielder',      group: 'MID', x: 12, y: 48, shirt: [11, 17, 21],    goals: 0.13, assists: 0.22 },
  { key: 'CM',  name: 'Central midfielder',   group: 'MID', x: 50, y: 50, shirt: [8, 14, 20],     goals: 0.13, assists: 0.17 },
  { key: 'RM',  name: 'Right midfielder',     group: 'MID', x: 88, y: 48, shirt: [7, 19, 26],     goals: 0.13, assists: 0.22 },
  { key: 'CAM', name: 'Attacking midfielder', group: 'MID', x: 50, y: 37, shirt: [10, 21, 8],     goals: 0.25, assists: 0.30 },
  { key: 'LW',  name: 'Left winger',          group: 'FWD', x: 13, y: 27, shirt: [11, 7, 17],     goals: 0.34, assists: 0.26 },
  { key: 'CF',  name: 'Second striker',       group: 'FWD', x: 50, y: 24, shirt: [10, 9, 20],     goals: 0.42, assists: 0.22 },
  { key: 'RW',  name: 'Right winger',         group: 'FWD', x: 87, y: 27, shirt: [7, 11, 27],     goals: 0.34, assists: 0.26 },
  { key: 'ST',  name: 'Striker',              group: 'FWD', x: 50, y: 12, shirt: [9, 19, 29],     goals: 0.52, assists: 0.13 }
];

const BY_KEY = new Map(ROLES.map((r) => [r.key, r]));

// Broad group → the role a save from before granular positions maps onto,
// and the fallback for anything unrecognised.
const GROUP_DEFAULT = { GK: 'GK', DEF: 'CB', MID: 'CM', FWD: 'ST' };

export function getRole(key) {
  return BY_KEY.get(key) || BY_KEY.get(GROUP_DEFAULT[key] || 'CM');
}

export function roleGroup(key) {
  return getRole(key).group;
}

export function roleName(key) {
  return getRole(key).name;
}

// Rows used to lay the picker out as a team sheet, back to front.
export const ROLE_ROWS = [
  { label: 'Goalkeeper', keys: ['GK'] },
  { label: 'Defence', keys: ['LB', 'CB', 'RB'] },
  { label: 'Wing-backs', keys: ['LWB', 'CDM', 'RWB'] },
  { label: 'Midfield', keys: ['LM', 'CM', 'RM'] },
  { label: 'Attack', keys: ['LW', 'CAM', 'RW'] },
  { label: 'Forwards', keys: ['CF', 'ST'] }
];

// Where a player moves when age forces a reinvention: one line deeper, or
// inside from the flank. Goalkeepers never retrain.
const RETRAIN = {
  ST: 'CF', CF: 'CAM', LW: 'LM', RW: 'RM', CAM: 'CM',
  LM: 'LWB', RM: 'RWB', CM: 'CDM', CDM: 'CB',
  LWB: 'LB', RWB: 'RB', LB: 'CB', RB: 'CB', CB: 'CDM'
};

export function retrainTarget(key) {
  return RETRAIN[getRole(key).key] || null;
}

export function shirtFor(key) {
  return getRole(key).shirt;
}
