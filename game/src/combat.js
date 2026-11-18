// Combat: mouse-aimed shooting on foot and drive-by fire from a car,
// tracer rounds, muzzle flash, hit sparks, and the crime reports that
// feed the wanted system. Simple and readable — every shot is a ray
// resolved the moment it is fired.

import { WANTED } from './config.js';

export function createCombat() {
  return {
    cooldown: 0,
    tracers: [],   // {x1,y1,x2,y2,life}
    sparks: [],    // {x,y,vx,vy,life,color}
    shells: 0,     // lifetime shots fired
  };
}

export function tryShoot(combat, dt) {
  combat.cooldown -= dt;
  for (const t of combat.tracers) t.life -= dt * 6;
  combat.tracers = combat.tracers.filter((t) => t.life > 0);
  for (const s of combat.sparks) {
    s.life -= dt * 2.4;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 130 * dt;
  }
  combat.sparks = combat.sparks.filter((s) => s.life > 0);
}

export function fire(combat, fromX, fromY, angle, world) {
  if (combat.cooldown > 0) return null;
  combat.cooldown = 0.16;
  combat.shells += 1;
  const range = 460;
  let endX = fromX + Math.cos(angle) * range;
  let endY = fromY + Math.sin(angle) * range;
  let hit = null;

  // Buildings stop rounds.
  for (const b of world.city.buildings) {
    // Cheap segment test: sample along the ray.
    for (let t = 0.08; t < 1; t += 0.04) {
      const px = fromX + Math.cos(angle) * range * t;
      const py = fromY + Math.sin(angle) * range * t;
      if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) {
        if (!hit || t < hit.t) hit = { kind: 'building', t, x: px, y: py };
        break;
      }
    }
  }
  // Pedestrians.
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    const dx = ped.x - fromX;
    const dy = ped.y - fromY;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const side = -dx * Math.sin(angle) + dy * Math.cos(angle);
    if (along > 10 && along < range && Math.abs(side) < 13) {
      const t = along / range;
      if (!hit || t < hit.t) hit = { kind: 'ped', t, x: ped.x, y: ped.y, ped };
    }
  }
  // Cars (traffic, parked, police).
  for (const car of world.cars) {
    const dx = car.x - fromX;
    const dy = car.y - fromY;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const side = -dx * Math.sin(angle) + dy * Math.cos(angle);
    if (along > 10 && along < range && Math.abs(side) < 24) {
      const t = along / range;
      if (!hit || t < hit.t) hit = { kind: 'car', t, x: car.x, y: car.y, car };
    }
  }
  if (hit) { endX = hit.x; endY = hit.y; }
  combat.tracers.push({ x1: fromX, y1: fromY, x2: endX, y2: endY, life: 1 });
  if (hit) {
    for (let i = 0; i < 6; i += 1) {
      combat.sparks.push({
        x: hit.x, y: hit.y,
        vx: (Math.random() - 0.5) * 190, vy: (Math.random() - 0.5) * 190 - 40,
        life: 0.5 + Math.random() * 0.5,
        color: hit.kind === 'ped' ? '#ff5d5d' : '#ffd23f',
      });
    }
  }
  return hit;
}

export function heatForHit(hit) {
  if (!hit) return WANTED.crimeShot * 0.4;
  if (hit.kind === 'ped') return WANTED.crimeHitPed;
  if (hit.kind === 'car' && hit.car && hit.car.isPolice) return 0.9;
  if (hit.kind === 'car') return 0.3;
  return 0.08;
}
