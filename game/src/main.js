// Boot and frame loop: wires the canvas, DOM screens, HUD, input and
// audio together, runs the fixed-step simulation, and handles the
// title / pause / busted / wasted / ending screens.

import { createGame, stepGame, startPlay, resumeAfterPenalty, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_ENDING } from './game.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud, updateHud, showToast, showBanner } from './hud.js';
import { drawWorld, updateCamera } from './render.js';
import { stageShot, arrangeChasePolice } from './shots.js';
import { STORY_INTRO, MISSIONS } from './missions.js';
import { wipeSave } from './save.js';
import { GAME_TITLE, GAME_SUBTITLE } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hudRoot = document.getElementById('hud');
const hud = createHud(hudRoot);
const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-screen');
const endEl = document.getElementById('end-screen');

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 7) || 7;

let game;
if (shotName) {
  game = stageShot(shotName, seed);
} else {
  game = createGame(seed);
}
game.input = createInput(window);
game.audio = createAudio();
game.onToast = (text, seconds) => showToast(hud, text, seconds);
game.onBanner = (text) => showBanner(hud, text);
game.viewW = 1280;
game.viewH = 720;
// Screenshot driving scenes hold the accelerator so the car is truly
// travelling (with traffic and police reacting) when the frame is taken.
if (shotName === 'drive' || shotName === 'chase') game.input.keys.add('KeyW');

// Title screen copy.
document.getElementById('game-title').textContent = GAME_TITLE;
document.getElementById('game-subtitle').textContent = GAME_SUBTITLE;
document.getElementById('story-lines').innerHTML = STORY_INTRO.map((line) => `<p>${line}</p>`).join('');
document.getElementById('mission-list').innerHTML = MISSIONS.map((m) => `<li><b>${m.title}</b> — $${m.pay}</li>`).join('');
const continueBtn = document.getElementById('continue-btn');
if (!game.hadSave) continueBtn.style.display = 'none';
document.getElementById('continue-label').textContent = game.hadSave
  ? `Continue — $${game.save.money}, job ${Math.min(game.save.missionIndex + 1, MISSIONS.length)} of ${MISSIONS.length}`
  : '';

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  game.viewW = window.innerWidth;
  game.viewH = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
if (shotName) { game.viewW = 1280; game.viewH = 720; canvas.width = 1280; canvas.height = 720; }

function beginPlay(fresh) {
  if (fresh) {
    wipeSave();
    const seedNow = Number(params.get('seed') || 7) || 7;
    game = createGame(seedNow);
    game.input = createInput(window);
    game.audio = createAudio();
    game.onToast = (text, seconds) => showToast(hud, text, seconds);
    game.onBanner = (text) => showBanner(hud, text);
    game.viewW = window.innerWidth;
    game.viewH = window.innerHeight;
  }
  game.audio.unlock();
  startPlay(game);
}

document.getElementById('new-btn').addEventListener('click', () => beginPlay(true));
continueBtn.addEventListener('click', () => beginPlay(false));
document.getElementById('resume-btn').addEventListener('click', () => { game.screen = SCREEN_PLAY; });
document.getElementById('end-continue-btn').addEventListener('click', () => resumeAfterPenalty(game));
window.addEventListener('pointerdown', () => game.audio && game.audio.unlock(), { once: true });

// For the chase screenshot: let the real police spawner run, then frame it.
let chaseArranged = false;
let shotSteps = 0;

let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += dt;

  if (game.input.consumePause()) {
    if (game.screen === SCREEN_PLAY) game.screen = SCREEN_PAUSE;
    else if (game.screen === SCREEN_PAUSE) game.screen = SCREEN_PLAY;
  }
  while (accumulator >= STEP) {
    stepGame(game, STEP);
    accumulator -= STEP;
    shotSteps += 1;
    if (shotName === 'chase' && !chaseArranged && shotSteps > 40) {
      arrangeChasePolice(game);
      chaseArranged = true;
    }
    if (shotName && shotSteps > 200) accumulator = 0; // screenshots settle
  }

  const focus = game.playerPos || { x: game.player.x, y: game.player.y };
  updateCamera(game.camera, focus.x, focus.y, game.viewW, game.viewH, dt);
  const scaleX = canvas.width / game.viewW;
  const scaleY = canvas.height / game.viewH;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  ctx.fillStyle = '#79b34a';
  ctx.fillRect(0, 0, game.viewW, game.viewH);
  drawWorld(ctx, game, game.viewW, game.viewH, game.time + performance.now() / 1000 * 0.12);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Screens and HUD visibility.
  const playing = game.screen !== SCREEN_TITLE;
  hudRoot.style.display = playing ? 'block' : 'none';
  titleEl.style.display = game.screen === SCREEN_TITLE ? 'flex' : 'none';
  pauseEl.style.display = game.screen === SCREEN_PAUSE ? 'flex' : 'none';
  const ended = game.screen === SCREEN_BUSTED || game.screen === SCREEN_WASTED || game.screen === SCREEN_ENDING;
  endEl.style.display = ended ? 'flex' : 'none';
  if (ended) {
    document.getElementById('end-title').textContent =
      game.screen === SCREEN_BUSTED ? 'BUSTED' : game.screen === SCREEN_WASTED ? 'WASTED' : 'THE TIDE GOES OUT';
    document.getElementById('end-text').textContent =
      game.screen === SCREEN_BUSTED ? 'The Policia got their driver. Bail and hospital fees sting, but Lulu still has work for you.'
      : game.screen === SCREEN_WASTED ? 'Rafi wakes up outside Palma General, lighter in the wallet and heavier in lessons.'
      : 'Five jobs done. The dock crew is paid, the boat is gone, and Palma Bay keeps humming. Free roam — the city is yours.';
  }
  if (playing) updateHud(hud, game, dt);
  const nearCar = !game.player.inCar && game.screen === SCREEN_PLAY;
  hud.prompt.style.display = nearCar ? 'block' : 'none';
  if (nearCar) {
    // The game module resolves proximity; a static hint is enough here
    // because E beside any car enters it.
    hud.prompt.textContent = game.bustProgress > 0.02 ? hud.prompt.textContent : 'Press E beside a car to drive it · Click to shoot';
  }
  document.body.dataset.screen = game.screen;
  document.body.dataset.ready = 'true';
}
requestAnimationFrame(frame);
