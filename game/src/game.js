// Game orchestration: owns every system, steps them in a fixed order
// each frame, and resolves how they touch each other — stealing cars,
// running missions, police busts, combat crime, pickups, saving.

import { WORLD, WANTED, ECONOMY, DISTRICTS } from './config.js';
import { createRng, clamp, distance } from './random.js';
import { buildCity, LANDMARKS } from './world.js';
import { spawnParkedCars, spawnTraffic, stepTrafficCar, stepCarPhysics, carSpeedKmh, CAR_MODELS, makeCar, unstickCar } from './vehicles.js';
import { spawnPedestrians, stepPedestrian, hurtPedestrian } from './pedestrians.js';
import { createPlayer, stepPlayerOnFoot, nearestEnterableCar, enterCar, exitCar, playerPosition, hurtPlayer, respawnPlayer } from './player.js';
import { createWanted, addHeat, clearWanted, desiredPolice, spawnPoliceCar, stepWanted, stepPoliceCar, copSeesPlayer } from './police.js';
import { createCombat, tryShoot, fire, heatForHit } from './combat.js';
import { createMissionState, currentMission, currentStep, objectiveText, advanceStep, stepTarget, MISSIONS } from './missions.js';
import { createCamera } from './render.js';
import { loadSave, storeSave } from './save.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_ENDING = 'ending';

const SPAWN = { x: 620, y: 660 };

export function createGame(seed) {
  const rng = createRng(seed);
  const { save, exists } = loadSave();
  const city = buildCity(seed);
  const parked = spawnParkedCars(rng, 22);
  const traffic = spawnTraffic(rng, 15);
  // The marked coupe for Job 1 waits at Molo Garage.
  const markedCar = makeCar(460, 800, -Math.PI / 2, CAR_MODELS[0], rng);
  const cars = [...parked, ...traffic, markedCar];
  const missions = createMissionState(exists ? save.missionIndex : 0);

  const game = {
    seed,
    rng,
    city,
    cars,
    markedCar,
    markedCarUsed: false,
    peds: spawnPedestrians(rng, 34),
    player: createPlayer(SPAWN.x, SPAWN.y),
    wanted: createWanted(),
    combat: createCombat(),
    missions,
    save,
    camera: createCamera(),
    screen: SCREEN_TITLE,
    time: 0,
    timeOfDay: 0.68, // late golden afternoon
    cashBags: [],
    input: null,
    audio: null,
    aimAngle: 0,
    bustProgress: 0,
    speedKmh: 0,
    districtName: 'DOWNTOWN',
    onToast: null,
    onBanner: null,
    hadSave: exists,
  };
  game.camera.x = SPAWN.x - 640;
  game.camera.y = SPAWN.y - 360;
  refreshCashBags(game);
  syncDerived(game);
  return game;
}

function refreshCashBags(game) {
  const step = currentStep(game.missions);
  game.cashBags = [];
  if (step && step.kind === 'collect') {
    game.cashBags = step.points.map(([x, y]) => ({ x, y, taken: false }));
  }
}

export function syncDerived(game) {
  game.mission = currentMission(game.missions);
  game.objectiveText = objectiveText(game.missions);
  game.missionTarget = stepTarget(game.missions);
  game.playerPos = playerPosition(game.player);
  const pos = game.playerPos;
  let district = DISTRICTS[0];
  let best = Infinity;
  for (const d of DISTRICTS) {
    const dd = distance(pos.x, pos.y, d.x, d.y);
    if (dd < best) { best = dd; district = d; }
  }
  game.districtName = pos.x > WORLD.beachX ? 'THE BEACH' : district.name;
  game.speedKmh = game.player.inCar ? carSpeedKmh(game.player.inCar) : 0;
}

export function startPlay(game) {
  game.screen = SCREEN_PLAY;
  const mission = currentMission(game.missions);
  if (mission && game.onBanner) game.onBanner(`${mission.title} — ${mission.giver}`);
  if (mission && game.onToast) game.onToast(mission.brief, 6);
}

export function stepGame(game, dt) {
  if (game.screen !== SCREEN_PLAY) { syncDerived(game); return; }
  game.time += dt;
  game.timeOfDay = (game.timeOfDay + dt / 480) % 1;
  const input = game.input;
  const player = game.player;
  const pos = playerPosition(player);

  // Aim from the mouse.
  if (input) {
    const viewW = game.viewW || 1280;
    const viewH = game.viewH || 720;
    const worldMouseX = game.camera.x + input.mouse.x;
    const worldMouseY = game.camera.y + input.mouse.y;
    game.aimAngle = Math.atan2(worldMouseY - pos.y, worldMouseX - pos.x);
  }

  // --- Player movement / driving
  if (player.inCar) {
    const car = player.inCar;
    let throttle = 0;
    let steer = 0;
    if (input.forward) throttle = 1;
    if (input.back) throttle = -1;
    if (input.left) steer = -1;
    if (input.right) steer = 1;
    if (input.brake) { car.speed *= Math.pow(0.02, dt); }
    const crashed = stepCarPhysics(car, throttle, steer, dt, game.city);
    if (crashed) {
      game.camera.shake = 7;
      if (game.audio) game.audio.hit();
      addHeat(game.wanted, 0.05);
    }
    player.x = car.x;
    player.y = car.y;
    if (game.audio) game.audio.setEngine(car.speed / car.model.topSpeed, true);
    // Running over pedestrians is a serious crime.
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      if (Math.abs(car.speed) > 60 && distance(car.x, car.y, ped.x, ped.y) < 26) {
        if (hurtPedestrian(ped, 30)) {
          addHeat(game.wanted, WANTED.crimeHitPed);
          game.camera.shake = 5;
          if (game.onToast) game.onToast('You ran someone down — the Policia are coming!', 3);
        }
      }
    }
  } else {
    stepPlayerOnFoot(player, input, dt, game.city);
    if (game.audio) game.audio.setEngine(0, false);
  }

  // --- Enter / exit cars
  if (input.consumeInteract()) {
    if (player.inCar) {
      exitCar(player);
      if (game.audio) game.audio.door();
    } else {
      const car = nearestEnterableCar(player, game.cars);
      if (car) {
        const wasParked = car.driver === null;
        enterCar(player, car);
        if (game.audio) game.audio.door();
        if (wasParked) {
          game.save.carsStolen += 1;
          addHeat(game.wanted, WANTED.crimeSteal * 0.5);
          if (game.onToast) game.onToast(`Stole the ${car.model.name}! WASD to drive, E to get out.`, 3);
        }
        if (car === game.markedCar) game.markedCarUsed = true;
        storeSave(game.save);
      }
    }
  }

  // --- Combat
  tryShoot(game.combat, dt);
  if (input.mouse.down && !player.dead) {
    const hit = fire(game.combat, pos.x, pos.y, game.aimAngle, { city: game.city, peds: game.peds, cars: game.cars });
    if (hit !== null) {
      if (game.audio) game.audio.shot();
      addHeat(game.wanted, heatForHit(hit));
      if (hit.kind === 'ped' && hit.ped) hurtPedestrian(hit.ped, 30);
      if (hit.kind === 'car' && hit.car) {
        hit.car.health -= 14;
        if (hit.car.health <= 0) hit.car.wrecked = true;
      }
      game.camera.shake = Math.max(game.camera.shake, 2);
    }
  }

  // --- Traffic and pedestrians
  const danger = input.mouse.down || game.wanted.level > 0
    ? { x: pos.x, y: pos.y, radius: input.mouse.down ? 260 : 0 }
    : { x: pos.x, y: pos.y, radius: 0 };
  for (const car of game.cars) {
    if (car.driver === 'traffic') stepTrafficCar(car, dt, game.city, game.rng, game.cars);
  }
  for (const ped of game.peds) stepPedestrian(ped, dt, game.city, danger);
  for (const car of game.cars) unstickCar(car, game.city);

  // --- Police
  stepPolice(game, dt, pos);

  // --- Missions
  stepMissions(game, pos);

  // --- Death
  if (player.dead) {
    game.screen = SCREEN_WASTED;
    game.save.timesWasted += 1;
    game.save.money = Math.max(0, game.save.money - 90);
    storeSave(game.save);
    if (game.audio) game.audio.wasted();
  }
  syncDerived(game);
}

function stepPolice(game, dt, pos) {
  const wanted = game.wanted;
  // Spawn or release patrol cars to match the wanted level.
  const police = game.cars.filter((c) => c.isPolice);
  const want = desiredPolice(wanted);
  if (police.length < want) {
    game.cars.push(spawnPoliceCar(game.rng, pos.x, pos.y));
  } else if (police.length > want && wanted.level === 0) {
    const extra = police[0];
    game.cars = game.cars.filter((c) => c !== extra);
  }
  let anySees = false;
  let closest = Infinity;
  for (const cop of game.cars) {
    if (!cop.isPolice) continue;
    const d = stepPoliceCar(cop, dt, game.city, { x: pos.x, y: pos.y, angle: game.playerPos ? game.playerPos.angle : 0 });
    if (copSeesPlayer(cop, pos.x, pos.y)) anySees = true;
    if (d < closest) closest = d;
    // Ramming the player hurts a little and raises heat.
    if (d < 30 && Math.abs(cop.speed) > 90) hurtPlayer(game.player, 4 * dt * 10);
  }
  stepWanted(wanted, dt, anySees);
  game.save.bestWanted = Math.max(game.save.bestWanted, wanted.level);

  // Bust logic: a cop close by while the player is slow or on foot.
  const playerSpeed = game.player.inCar ? Math.abs(game.player.inCar.speed) : Math.hypot(game.player.vx, game.player.vy);
  if (wanted.level > 0 && closest < 74 && playerSpeed < 55) {
    game.bustProgress += dt / 2.6;
  } else {
    game.bustProgress = Math.max(0, game.bustProgress - dt * 1.4);
  }
  wanted.bustProgress = game.bustProgress;
  if (game.bustProgress >= 1) {
    game.screen = SCREEN_BUSTED;
    game.save.timesBusted += 1;
    game.save.money = Math.max(0, game.save.money - 140);
    storeSave(game.save);
    if (game.audio) game.audio.busted();
  }
  if (game.audio) game.audio.setSiren(police.length > 0 && wanted.level > 0, game.time);
}

function stepMissions(game, pos) {
  const state = game.missions;
  const step = currentStep(state);
  if (!step) return;
  const finishStep = () => {
    const result = advanceStep(state);
    if (result.missionDone) {
      game.save.money += result.pay;
      game.save.respect += ECONOMY.respectPerMission;
      game.save.missionsDone += 1;
      storeSave(game.save);
      if (game.audio) game.audio.missionDone();
      if (game.onBanner) game.onBanner(`JOB DONE — +$${result.pay}`);
      if (state.complete) {
        game.screen = SCREEN_ENDING;
      } else {
        const next = currentMission(state);
        if (game.onToast && next) game.onToast(`${next.title}: ${next.brief}`, 6);
      }
      refreshCashBags(game);
    } else {
      if (game.audio) game.audio.pickup();
      refreshCashBags(game);
    }
  };
  if (step.kind === 'goto') {
    if (distance(pos.x, pos.y, step.x, step.y) < step.radius) finishStep();
  } else if (step.kind === 'enterMarkedCar') {
    if (game.markedCarUsed) finishStep();
  } else if (step.kind === 'reachWanted') {
    if (game.wanted.level >= step.stars) finishStep();
  } else if (step.kind === 'escapeTo') {
    if (game.wanted.level === 0 && distance(pos.x, pos.y, step.x, step.y) < step.radius) finishStep();
  } else if (step.kind === 'collect') {
    for (const bag of game.cashBags) {
      if (!bag.taken && distance(pos.x, pos.y, bag.x, bag.y) < 56) {
        bag.taken = true;
        state.collected += 1;
        game.save.money += ECONOMY.pickupCash;
        if (game.audio) game.audio.cash();
        if (game.onToast) game.onToast(`Cash bag +$${ECONOMY.pickupCash} (${state.collected}/${step.points.length})`, 2.4);
        if (state.collected >= step.points.length) { state.collected = step.points.length - 1; finishStep(); }
        storeSave(game.save);
        break;
      }
    }
  } else if (step.kind === 'checkpoints') {
    const target = stepTarget(state);
    if (target && distance(pos.x, pos.y, target.x, target.y) < 72) {
      state.collected += 1;
      addHeat(game.wanted, 0.4);
      if (game.audio) game.audio.pickup();
      if (state.collected >= step.points.length) { state.collected = step.points.length - 1; finishStep(); }
    }
  }
}

export function resumeAfterPenalty(game) {
  // After busted/wasted: back at the safehouse, heat cleared, story intact.
  clearWanted(game.wanted);
  game.bustProgress = 0;
  game.cars = game.cars.filter((c) => !c.isPolice);
  const safe = LANDMARKS.find((l) => l.kind === 'safehouse');
  respawnPlayer(game.player, safe.x, safe.y - 60);
  game.screen = SCREEN_PLAY;
}

export function freeRoamFacts(game) {
  return {
    missionsTotal: MISSIONS.length,
    missionsDone: game.save.missionsDone,
    carsStolen: game.save.carsStolen,
  };
}
