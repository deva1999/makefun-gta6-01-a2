// The Palma Bay Policia and the wanted system: crime raises stars,
// stars bring patrol cars, patrol cars chase, ram and bust. Staying
// out of sight cools the heat down one star at a time.

import { WANTED, WORLD } from './config.js';
import { clamp } from './random.js';
import { makeCar, CAR_MODELS, stepCarPhysics } from './vehicles.js';

export const POLICE_MODEL = { name: 'Policia Interceptor', color: '#f4f6f8', topSpeed: 345 };

export function createWanted() {
  return {
    level: 0,          // whole stars shown on the HUD
    heat: 0,           // fractional heat; each full point is a star
    unseenTimer: 0,    // seconds since a cop last saw the player
    bustProgress: 0,   // 0..1 while a cop is close and player is slow
  };
}

export function addHeat(wanted, amount) {
  wanted.heat = clamp(wanted.heat + amount, 0, WANTED.max);
  wanted.level = Math.floor(wanted.heat + 0.0001);
  if (amount > 0) wanted.unseenTimer = 0;
}

export function clearWanted(wanted) {
  wanted.heat = 0;
  wanted.level = 0;
  wanted.bustProgress = 0;
  wanted.unseenTimer = 0;
}

export function desiredPolice(wanted) {
  return wanted.level * WANTED.policePerStar;
}

export function spawnPoliceCar(rng, playerX, playerY) {
  // Spawn off-screen at a road edge, close enough to join the chase.
  const angle = rng.range(0, Math.PI * 2);
  const dist = rng.range(520, 680);
  const x = clamp(playerX + Math.cos(angle) * dist, 80, WORLD.width - 80);
  const y = clamp(playerY + Math.sin(angle) * dist, 80, WORLD.height - 80);
  const car = makeCar(x, y, angle + Math.PI, POLICE_MODEL, rng);
  car.isPolice = true;
  car.driver = 'police';
  car.color = '#eef2f5';
  return car;
}

export function stepWanted(wanted, dt, anyCopSeesPlayer) {
  if (wanted.level <= 0) return;
  if (anyCopSeesPlayer) {
    wanted.unseenTimer = 0;
  } else {
    wanted.unseenTimer += dt;
    if (wanted.unseenTimer >= WANTED.decaySeconds) {
      wanted.unseenTimer = 0;
      wanted.heat = Math.max(0, Math.floor(wanted.heat) - 0.999);
      wanted.level = Math.floor(wanted.heat + 0.0001);
      if (wanted.level === 0) wanted.heat = 0;
    }
  }
}

export function stepPoliceCar(car, dt, city, target) {
  // Pursuit driving: aim at a point just behind the target, steer hard,
  // and ease off only when alongside (the bust position).
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const aimX = target.x - Math.cos(target.angle || 0) * 26;
  const aimY = target.y - Math.sin(target.angle || 0) * 26;
  const want = Math.atan2(aimY - car.y, aimX - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2.6, -1, 1);
  let throttle = 1;
  if (dist < 55) throttle = 0.35;
  if (Math.abs(diff) > 2.4) throttle = -0.5; // turn around when facing away
  stepCarPhysics(car, throttle, steer, dt, city);
  car.sirenPhase += dt * 9;
  return dist;
}

export function copSeesPlayer(car, playerX, playerY) {
  const dx = playerX - car.x;
  const dy = playerY - car.y;
  return dx * dx + dy * dy < 430 * 430;
}
