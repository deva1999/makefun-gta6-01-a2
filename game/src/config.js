// Palma Bay: Neon Tide — central tuning and world constants.
// Every other module reads its numbers from here so the feel of the
// city (speeds, sizes, prices, timers) can be tuned in one place.

export const WORLD = {
  width: 3200,
  height: 2400,
  block: 400,          // distance between road centrelines
  roadHalf: 46,        // half width of a road
  sidewalk: 14,
  beachX: 2760,        // sand starts here, water beyond 2960
  waterX: 2960,
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 185,
  sprintSpeed: 275,
  healthMax: 100,
  reachCar: 58,        // how close you must be to enter a car
  bustTime: 2.6,       // seconds in police grip before busted
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 340,
  brake: 520,
  reverseMax: 120,
  drag: 0.86,
  grip: 7.5,
  healthMax: 100,
};

export const WANTED = {
  max: 5,
  decaySeconds: 26,    // unseen time to drop one star
  policePerStar: 2,
  crimeShot: 0.55,
  crimeHitPed: 1.0,
  crimeSteal: 0.7,
  crimeRam: 0.45,
};

export const ECONOMY = {
  startMoney: 120,
  missionPay: [250, 400, 550, 750, 1200],
  pickupCash: 35,
  respectPerMission: 20,
};

export const COLORS = {
  sky: '#ffd9a0',
  grass: '#7ec850',
  grassDark: '#6ab544',
  sand: '#f2d492',
  water: '#2fb3c9',
  waterDeep: '#1d8fb0',
  road: '#3c4148',
  roadEdge: '#565d66',
  lane: '#f7e9a0',
  sidewalk: '#c9c2b4',
};

export const DISTRICTS = [
  { name: 'DOWNTOWN', x: 500, y: 500 },
  { name: 'OLD MARKET', x: 1300, y: 480 },
  { name: 'PALM HEIGHTS', x: 2100, y: 520 },
  { name: 'MARINA', x: 2500, y: 1750 },
  { name: 'CORAL FLATS', x: 900, y: 1650 },
  { name: 'SUNSET STRIP', x: 1750, y: 1250 },
];

export const GAME_TITLE = 'PALMA BAY';
export const GAME_SUBTITLE = 'NEON TIDE';
