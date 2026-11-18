// Pedestrians: Palma Bay locals who stroll the sidewalks, cross at
// corners, chat in pairs, flee from gunfire and reckless driving, and
// drop a little cash when they are robbed by a collision (crime has
// consequences — see the wanted system).

import { WORLD } from './config.js';
import { clamp } from './random.js';
import { roadLines, collideBuildings } from './world.js';

const SHIRTS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a78bfa', '#f783ac', '#63e6be', '#ffa94d', '#74c0fc', '#e599f7', '#b2f2bb'];
const NAMES = ['Sari', 'Bima', 'Luz', 'Marco', 'Tania', 'Rio', 'Dewi', 'Fajar', 'Carmen', 'Nico', 'Ayu', 'Pedro', 'Laras', 'Bruno', 'Maya', 'Tito'];

let nextPedId = 1;

export function spawnPedestrians(rng, count) {
  const peds = [];
  const { vertical, horizontal } = roadLines();
  for (let i = 0; i < count; i += 1) {
    const onVertical = rng.chance(0.5);
    const road = onVertical ? rng.pick(vertical) : rng.pick(horizontal);
    const along = rng.range(80, onVertical ? WORLD.height - 80 : WORLD.beachX - 80);
    const side = rng.sign() * (WORLD.roadHalf + 9);
    const x = onVertical ? road + side : along;
    const y = onVertical ? along : road + side;
    peds.push({
      id: nextPedId++,
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: 0,
      walkPhase: rng.range(0, Math.PI * 2),
      shirt: rng.pick(SHIRTS),
      name: rng.pick(NAMES),
      state: 'walk',       // walk | flee | down
      targetAngle: 0,
      pauseTimer: rng.range(0, 4),
      health: 30,
      downTimer: 0,
    });
  }
  return peds;
}

export function stepPedestrian(ped, dt, city, danger) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) { ped.state = 'walk'; ped.health = 30; }
    return;
  }
  ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 7);
  let speed = 52;
  if (danger && danger.radius > 0) {
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < danger.radius) {
      ped.state = 'flee';
      ped.targetAngle = Math.atan2(dy, dx);
    }
  }
  if (ped.state === 'flee') {
    speed = 148;
    ped.angle = ped.targetAngle;
    ped.fleeTimer = (ped.fleeTimer || 0) + dt;
    if (ped.fleeTimer > 2.2) { ped.state = 'walk'; ped.fleeTimer = 0; }
  } else {
    ped.pauseTimer -= dt;
    if (ped.pauseTimer <= 0) {
      ped.pauseTimer = 2 + Math.random() * 5;
      ped.targetAngle = ped.angle + (Math.random() - 0.5) * 1.6;
    }
    let diff = ped.targetAngle - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    if (ped.pauseTimer > 4.6) speed = 0; // pausing to chat / check phone
  }
  ped.speed = speed;
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  const fixed = collideBuildings(city, nx, ny, 10);
  if (fixed.hit) {
    ped.angle += Math.PI * 0.7;
    return;
  }
  ped.x = clamp(fixed.x, 24, WORLD.width - 24);
  ped.y = clamp(fixed.y, 24, WORLD.height - 24);
  // Keep beach walkers out of the sea.
  if (ped.x > WORLD.waterX + 30) ped.angle = Math.PI;
}

export function hurtPedestrian(ped, damage) {
  ped.health -= damage;
  if (ped.health <= 0 && ped.state !== 'down') {
    ped.state = 'down';
    ped.downTimer = 7;
    return true; // newly downed
  }
  return false;
}
