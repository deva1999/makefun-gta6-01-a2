// Deterministic screenshot states, selected with ?shot=<name>&seed=<n>.
// Each state builds the real game, then arranges a composed, honest scene
// with the game's own systems — the same traffic, police and missions a
// player would meet — so a screenshot shows the game as it really plays.
//
//   start  the title screen over a live, drifting view of Downtown
//   foot   on foot in the Old Market with pedestrians, HUD and minimap
//   drive  driving the Brisa Coupe among traffic on Sunset Strip
//   chase  a three-star police chase mid-mission, objective on the HUD

import { createGame, startPlay, SCREEN_TITLE } from './game.js';
import { addHeat } from './police.js';
import { enterCar } from './player.js';
import { distance } from './random.js';

export const SHOT_NAMES = ['start', 'foot', 'drive', 'chase'];

export function stageShot(name, seed) {
  const game = createGame(seed);
  if (!SHOT_NAMES.includes(name)) name = 'start';

  if (name === 'start') {
    game.screen = SCREEN_TITLE;
    game.player.x = 880;
    game.player.y = 620;
    game.camera.x = game.player.x - 640;
    game.camera.y = game.player.y - 360;
    return game;
  }

  startPlay(game);

  if (name === 'foot') {
    game.missions.index = 1; // Job 2 in progress
    game.missions.stepIndex = 0;
    game.player.x = 1170;
    game.player.y = 520;
    game.player.angle = 0.4;
    game.save.money = 370;
    // A small crowd around the market square.
    let placed = 0;
    for (const ped of game.peds) {
      if (placed >= 9) break;
      ped.x = 1120 + (placed % 3) * 85;
      ped.y = 470 + Math.floor(placed / 3) * 75;
      placed += 1;
    }
    game.camera.x = game.player.x - 640;
    game.camera.y = game.player.y - 360;
    return game;
  }

  if (name === 'drive') {
    game.missions.index = 1;
    game.missions.stepIndex = 1;
    game.save.money = 770;
    // Put the player in the marked coupe on the Sunset Strip avenue.
    const car = game.markedCar;
    car.x = 1620;
    car.y = 1220;
    car.angle = 0;
    car.speed = 210;
    enterCar(game.player, car);
    game.markedCarUsed = true;
    // Traffic ahead and behind on the same road.
    let offset = 0;
    for (const other of game.cars) {
      if (other === car || other.isPolice) continue;
      if (other.driver !== 'traffic') continue;
      offset += 1;
      if (offset === 1) { other.x = 1830; other.y = 1180; other.angle = Math.PI; other.speed = 120; }
      if (offset === 2) { other.x = 1420; other.y = 1220; other.angle = 0; other.speed = 150; }
      if (offset === 3) { other.x = 1900; other.y = 1220; other.angle = 0; other.speed = 140; }
      if (offset > 3) break;
    }
    game.camera.x = car.x - 640;
    game.camera.y = car.y - 360;
    return game;
  }

  // chase: three stars, two interceptors close, Job 4 active.
  game.missions.index = 3;
  game.missions.stepIndex = 0;
  game.missions.collected = 1;
  game.cashBags = [{ x: 2050, y: 860, taken: false }, { x: 420, y: 1660, taken: false }, { x: 1680, y: 2060, taken: false }];
  game.cashBags[0].taken = false;
  game.save.money = 1450;
  game.save.respect = 60;
  const car = game.markedCar;
  car.x = 1560;
  car.y = 820;
  car.angle = 0.05;
  car.speed = 235;
  enterCar(game.player, car);
  game.markedCarUsed = true;
  addHeat(game.wanted, 3.2);
  // Force the chase to be visible: run the real step loop briefly so
  // police spawn by the wanted rules, then pin two of them in frame.
  game.viewW = 1280;
  game.viewH = 720;
  return game;
}

export function arrangeChasePolice(game) {
  // Called after a few real steps: pull the two nearest spawned patrol
  // cars into the frame behind the player, still driven by police AI.
  const pos = { x: game.player.inCar ? game.player.inCar.x : game.player.x, y: game.player.inCar ? game.player.inCar.y : game.player.y };
  const cops = game.cars.filter((c) => c.isPolice).sort((a, b) => distance(a.x, a.y, pos.x, pos.y) - distance(b.x, b.y, pos.x, pos.y));
  if (cops[0]) { cops[0].x = pos.x - 185; cops[0].y = 820; cops[0].angle = 0.1; cops[0].speed = 200; }
  if (cops[1]) { cops[1].x = pos.x - 320; cops[1].y = 782; cops[1].angle = 0.05; cops[1].speed = 215; }
  if (cops[2]) { cops[2].x = pos.x + 250; cops[2].y = 782; cops[2].angle = Math.PI; cops[2].speed = 120; }
  game.camera.x = pos.x - 640;
  game.camera.y = pos.y - 360;
}
