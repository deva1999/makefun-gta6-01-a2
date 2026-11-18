// Vehicles: parked cars waiting to be stolen, traffic that drives
// the road grid on its own, and the shared car physics every driver
// (player, traffic, police) steers through.

import { CAR, WORLD } from './config.js';
import { clamp, turnToward, wrapAngle } from './random.js';
import { roadLines, collideBuildings } from './world.js';

export const CAR_MODELS = [
  { name: 'Brisa Coupe', color: '#e74c3c', topSpeed: 330 },
  { name: 'Palma Sedan', color: '#3498db', topSpeed: 285 },
  { name: 'Sol Hatch', color: '#f1c40f', topSpeed: 260 },
  { name: 'Marina Van', color: '#ecf0f1', topSpeed: 230 },
  { name: 'Tide Pickup', color: '#2ecc71', topSpeed: 250 },
  { name: 'Neon Roadster', color: '#9b59b6', topSpeed: 360 },
  { name: 'Coral Taxi', color: '#ff9f1a', topSpeed: 275 },
  { name: 'Duna Buggy', color: '#e67e22', topSpeed: 240 },
];

let nextCarId = 1;

export function makeCar(x, y, angle, model, rng) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    steer: 0,
    model,
    color: model.color,
    health: CAR.healthMax,
    driver: null,       // 'player' | 'traffic' | 'police' | null (parked)
    isPolice: false,
    sirenPhase: rng ? rng.range(0, Math.PI * 2) : 0,
    honkTimer: 0,
    wrecked: false,
  };
}

export function spawnParkedCars(rng, count) {
  const cars = [];
  const { vertical, horizontal } = roadLines();
  for (let i = 0; i < count; i += 1) {
    const model = rng.pick(CAR_MODELS);
    if (rng.chance(0.5)) {
      const rx = rng.pick(vertical);
      const y = rng.range(120, WORLD.height - 120);
      cars.push(makeCar(rx + WORLD.roadHalf - 14, y, -Math.PI / 2, model, rng));
    } else {
      const ry = rng.pick(horizontal);
      const x = rng.range(120, WORLD.beachX - 120);
      cars.push(makeCar(x, ry + WORLD.roadHalf - 14, 0, model, rng));
    }
  }
  return cars;
}

export function spawnTraffic(rng, count) {
  const cars = [];
  const { vertical, horizontal } = roadLines();
  for (let i = 0; i < count; i += 1) {
    const model = rng.pick(CAR_MODELS);
    const horizontalRoad = rng.chance(0.5);
    let car;
    if (horizontalRoad) {
      const ry = rng.pick(horizontal);
      const dir = rng.sign();
      const lane = dir > 0 ? ry + 20 : ry - 20;
      car = makeCar(rng.range(150, WORLD.beachX - 150), lane, dir > 0 ? 0 : Math.PI, model, rng);
      car.ai = { axis: 'x', dir, road: ry, cruise: rng.range(110, 165) };
    } else {
      const rx = rng.pick(vertical);
      const dir = rng.sign();
      const lane = dir > 0 ? rx - 20 : rx + 20;
      car = makeCar(lane, rng.range(150, WORLD.height - 150), dir > 0 ? Math.PI / 2 : -Math.PI / 2, model, rng);
      car.ai = { axis: 'y', dir, road: rx, cruise: rng.range(110, 165) };
    }
    car.driver = 'traffic';
    cars.push(car);
  }
  return cars;
}

export function stepCarPhysics(car, throttle, steerInput, dt, city) {
  // Arcade car feel: strong grip, forgiving drift, speed-sensitive steering.
  const model = car.model || CAR_MODELS[1];
  if (throttle > 0) car.speed += CAR.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 12) car.speed -= CAR.brake * dt;
    else car.speed = Math.max(-CAR.reverseMax, car.speed + CAR.accel * throttle * dt);
  }
  car.speed *= Math.pow(CAR.drag, dt * 60 * 0.16);
  if (throttle === 0) car.speed *= Math.pow(0.985, dt * 60);
  car.speed = clamp(car.speed, -CAR.reverseMax, model.topSpeed);
  const steerAuthority = clamp(Math.abs(car.speed) / 90, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steerInput * 2.35 * steerAuthority * dt;
  car.steer = steerInput;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collideBuildings(city, nx, ny, CAR.width);
  if (hit.hit) {
    car.health -= Math.abs(car.speed) * 0.045;
    car.speed *= -0.25;
    if (car.health <= 0) car.wrecked = true;
    return true;
  }
  car.x = clamp(nx, 30, WORLD.width - 30);
  car.y = clamp(ny, 30, WORLD.height - 30);
  return false;
}

export function stepTrafficCar(car, dt, city, rng, obstacles) {
  const ai = car.ai;
  if (!ai || car.wrecked) return;
  // Slow down when something is right ahead.
  let throttle = 0.75;
  for (const other of obstacles) {
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
    if (ahead > 0 && ahead < 74 && Math.abs(side) < 17) throttle = ahead < 40 ? -0.4 : 0.1;
  }
  // At an intersection, sometimes turn onto the crossing road.
  const { vertical, horizontal } = roadLines();
  if (ai.axis === 'x') {
    for (const rx of vertical) {
      if (Math.abs(car.x - rx) < 8 && rng.chance(0.012)) {
        ai.axis = 'y';
        ai.road = rx;
        ai.dir = rng.sign();
        break;
      }
    }
  } else {
    for (const ry of horizontal) {
      if (Math.abs(car.y - ry) < 8 && rng.chance(0.012)) {
        ai.axis = 'x';
        ai.road = ry;
        ai.dir = rng.sign();
        break;
      }
    }
  }
  // Steer toward a lookahead point on the car's lane: the car arcs
  // around corners instead of cutting across the blocks.
  const laneCoord = ai.axis === 'x' ? ai.road + (ai.dir > 0 ? 20 : -20) : ai.road + (ai.dir > 0 ? -20 : 20);
  const lookX = ai.axis === 'x' ? car.x + ai.dir * 130 : laneCoord;
  const lookY = ai.axis === 'x' ? laneCoord : car.y + ai.dir * 130;
  const targetAngle = Math.atan2(lookY - car.y, lookX - car.x);
  const steer = clamp(wrapAngle(targetAngle - car.angle) * 2.6, -1, 1);
  stepCarPhysics(car, throttle * clamp(ai.cruise / 160, 0.4, 1), steer, dt, city);
  // Wrap traffic around the world edges so the city never empties.
  if (car.x < 40) car.x = WORLD.beachX - 80;
  if (car.x > WORLD.beachX - 40) car.x = 80;
  if (car.y < 40) car.y = WORLD.height - 80;
  if (car.y > WORLD.height - 40) car.y = 80;
}

export function unstickCar(car, city) {
  // Safety net: a car whose centre ended a frame inside a building is
  // eased back to the nearest road point instead of sitting on a roof.
  let guard = 0;
  while (guard < 4) {
    const fixed = collideBuildings(city, car.x, car.y, 26);
    if (!fixed.hit) break;
    if (fixed.x === car.x && fixed.y === car.y) break;
    car.x = fixed.x;
    car.y = fixed.y;
    guard += 1;
  }
}

export function carSpeedKmh(car) {
  return Math.round(Math.abs(car.speed) * 0.36 * 3.2);
}
