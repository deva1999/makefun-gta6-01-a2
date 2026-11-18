// City generation for Palma Bay: the road grid, city blocks filled
// with named buildings, palm trees, street props and the beach.
// The city is data, not drawing — render.js paints what lives here,
// and vehicles/pedestrians navigate by the road helpers below.

import { WORLD, DISTRICTS } from './config.js';
import { createRng } from './random.js';

const BUILDING_STYLES = [
  { name: 'Coral Tower', roof: '#e2725b', wall: '#c65a47' },
  { name: 'Azure Suites', roof: '#5b8dd9', wall: '#4a76b8' },
  { name: 'Palma Hotel', roof: '#f2b134', wall: '#d19a28' },
  { name: 'Neon Arcade', roof: '#b45bd9', wall: '#9650b5' },
  { name: 'Harbour Offices', roof: '#7d8a99', wall: '#66727f' },
  { name: 'Cafe Sol', roof: '#e8e3d5', wall: '#cfc8b4' },
  { name: 'Marina Mall', roof: '#4fc4a8', wall: '#3ea58c' },
  { name: 'Sunset Cinema', roof: '#d94f70', wall: '#b83f5c' },
  { name: 'Banco Palma', roof: '#8a7d5b', wall: '#736849' },
  { name: 'Tide Gym', roof: '#5bd9c9', wall: '#47b3a6' },
  { name: 'Flamingo Club', roof: '#ff7bac', wall: '#d95f8f' },
  { name: 'Dock Warehouse', roof: '#9c6b4f', wall: '#7f5740' },
];

const SHOP_NAMES = [
  'Taco Brisa', 'Surf & Slice', 'Palma Ink', 'Neon Nails', 'Bici Repairs',
  'Hotel Brisa', 'Kopi Senja', 'Fruteria Luz', 'Pawn del Mar', 'Radio Shack Bay',
  'Soto Ayam Bu Tini', 'Warung Kopi', 'Toko Roti Matahari', 'Apotek Sehat',
];

export function roadLines() {
  // Centreline coordinates of every vertical and horizontal road.
  const vertical = [];
  const horizontal = [];
  for (let x = WORLD.block; x < WORLD.beachX; x += WORLD.block) vertical.push(x);
  for (let y = WORLD.block; y < WORLD.height; y += WORLD.block) horizontal.push(y);
  return { vertical, horizontal };
}

export function isOnRoad(x, y) {
  const { vertical, horizontal } = roadLines();
  for (const rx of vertical) if (Math.abs(x - rx) <= WORLD.roadHalf) return true;
  for (const ry of horizontal) if (Math.abs(y - ry) <= WORLD.roadHalf) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  const { vertical, horizontal } = roadLines();
  let best = { x, y, d: Infinity };
  for (const rx of vertical) {
    const d = Math.abs(x - rx);
    if (d < best.d) best = { x: rx, y, d };
  }
  for (const ry of horizontal) {
    const d = Math.abs(y - ry);
    if (d < best.d) best = { x, y: ry, d };
  }
  return best;
}

export function buildCity(seed) {
  const rng = createRng(seed * 7919 + 13);
  const buildings = [];
  const trees = [];
  const props = [];
  const { vertical, horizontal } = roadLines();

  // One or two buildings per block, set back from the roads.
  for (let bx = 0; bx < vertical.length; bx += 1) {
    for (let by = 0; by < horizontal.length; by += 1) {
      const x0 = vertical[bx] + WORLD.roadHalf + WORLD.sidewalk + 12;
      const y0 = horizontal[by] + WORLD.roadHalf + WORLD.sidewalk + 12;
      const x1 = (vertical[bx + 1] ?? WORLD.beachX) - WORLD.roadHalf - WORLD.sidewalk - 12;
      const y1 = (horizontal[by + 1] ?? WORLD.height) - WORLD.roadHalf - WORLD.sidewalk - 12;
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 90 || h < 90) continue;
      const split = rng.chance(0.45);
      const lots = split
        ? [
            { x: x0, y: y0, w: w * 0.46, h },
            { x: x0 + w * 0.54, y: y0, w: w * 0.46, h },
          ]
        : [{ x: x0, y: y0, w, h }];
      for (const lot of lots) {
        const style = rng.pick(BUILDING_STYLES);
        const inset = rng.range(4, 16);
        buildings.push({
          x: lot.x + inset,
          y: lot.y + inset + rng.range(0, Math.max(0, lot.h * 0.25)),
          w: lot.w - inset * 2,
          h: Math.min(lot.h - inset * 2, rng.range(90, lot.h - inset * 2)),
          roof: style.roof,
          wall: style.wall,
          name: rng.chance(0.4) ? rng.pick(SHOP_NAMES) : style.name,
          floors: rng.int(2, 9),
        });
      }
      // Palms in the block corners that stayed empty.
      if (rng.chance(0.7)) {
        trees.push({ x: x0 + rng.range(6, 26), y: y0 + rng.range(6, 26), s: rng.range(0.8, 1.3) });
      }
    }
  }

  // Beach palms and umbrellas.
  for (let i = 0; i < 26; i += 1) {
    trees.push({ x: rng.range(WORLD.beachX + 20, WORLD.waterX - 30), y: rng.range(60, WORLD.height - 60), s: rng.range(0.9, 1.5) });
  }
  for (let i = 0; i < 14; i += 1) {
    props.push({ kind: 'umbrella', x: rng.range(WORLD.beachX + 30, WORLD.waterX - 20), y: rng.range(80, WORLD.height - 80), color: rng.pick(['#ff5d5d', '#ffd23f', '#4fc4a8', '#ff7bac']) });
  }
  // Street lamps along the avenues.
  for (const rx of vertical) {
    for (let y = 90; y < WORLD.height; y += 190) props.push({ kind: 'lamp', x: rx + WORLD.roadHalf + 6, y });
  }

  return { buildings, trees, props, districts: DISTRICTS, seed };
}

export function buildingAt(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function collideBuildings(city, x, y, radius) {
  // Push a circle out of any building it overlaps; returns corrected point.
  const b = buildingAt(city, x, y, radius * 0.4);
  if (!b) return { x, y, hit: false };
  const left = Math.abs(x - b.x);
  const right = Math.abs(x - (b.x + b.w));
  const top = Math.abs(y - b.y);
  const bottom = Math.abs(y - (b.y + b.h));
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: b.x - radius * 0.4 - 1, y, hit: true };
  if (m === right) return { x: b.x + b.w + radius * 0.4 + 1, y, hit: true };
  if (m === top) return { x, y: b.y - radius * 0.4 - 1, hit: true };
  return { x, y: b.y + b.h + radius * 0.4 + 1, hit: true };
}

export const LANDMARKS = [
  { name: 'Molo Garage', x: 460, y: 860, kind: 'garage' },
  { name: 'Palma Bay Marina', x: 2720, y: 1780, kind: 'marina' },
  { name: 'Casa Segura Safehouse', x: 860, y: 2060, kind: 'safehouse' },
  { name: 'Old Market Square', x: 1240, y: 440, kind: 'market' },
  { name: 'Neon Pier', x: 2900, y: 900, kind: 'pier' },
];
