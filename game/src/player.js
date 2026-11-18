// Rafi, the player character: walking, sprinting, swimming shallows,
// entering and leaving cars, health, and the on-foot feel (a little
// acceleration smoothing so movement does not feel like a light switch).

import { PLAYER, WORLD } from './config.js';
import { clamp } from './random.js';
import { collideBuildings } from './world.js';

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    health: PLAYER.healthMax,
    inCar: null,
    walkPhase: 0,
    moving: false,
    dead: false,
  };
}

export function stepPlayerOnFoot(player, input, dt, city) {
  let mx = 0;
  let my = 0;
  if (input.forward) my -= 1;
  if (input.back) my += 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const len = Math.sqrt(mx * mx + my * my);
  player.moving = len > 0;
  const inWater = player.x > WORLD.waterX + 40;
  const maxSpeed = (input.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * (inWater ? 0.45 : 1);
  let tx = 0;
  let ty = 0;
  if (len > 0) {
    tx = (mx / len) * maxSpeed;
    ty = (my / len) * maxSpeed;
    player.angle = Math.atan2(ty, tx);
  }
  const blend = 1 - Math.pow(0.0001, dt);
  player.vx += (tx - player.vx) * blend * 0.55;
  player.vy += (ty - player.vy) * blend * 0.55;
  const nx = player.x + player.vx * dt;
  const ny = player.y + player.vy * dt;
  const fixed = collideBuildings(city, nx, ny, PLAYER.radius);
  player.x = clamp(fixed.x, 20, WORLD.width - 20);
  player.y = clamp(fixed.y, 20, WORLD.height - 20);
  if (player.moving) player.walkPhase += dt * (input.sprint ? 12 : 8.5);
  return fixed.hit;
}

export function nearestEnterableCar(player, cars) {
  let best = null;
  let bestDist = PLAYER.reachCar;
  for (const car of cars) {
    if (car.wrecked) continue;
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}

export function enterCar(player, car) {
  player.inCar = car;
  car.driver = 'player';
  if (car.ai) car.ai = null;
}

export function exitCar(player) {
  const car = player.inCar;
  if (!car) return null;
  car.driver = null;
  player.inCar = null;
  // Step out on the left side of the car.
  player.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
  player.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
  player.vx = 0;
  player.vy = 0;
  return car;
}

export function playerPosition(player) {
  if (player.inCar) return { x: player.inCar.x, y: player.inCar.y, angle: player.inCar.angle };
  return { x: player.x, y: player.y, angle: player.angle };
}

export function hurtPlayer(player, damage) {
  player.health -= damage;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
    return true;
  }
  return false;
}

export function respawnPlayer(player, x, y) {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.health = PLAYER.healthMax;
  player.dead = false;
  player.inCar = null;
}
