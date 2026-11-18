// HUD and minimap: money, health, wanted stars, speed, the mission
// banner and objective line, and a live minimap canvas that paints the
// road grid, the beach, blips for police (blue/red), traffic (grey),
// pedestrians (white dots), cash (green) and the mission target (gold).

import { WORLD } from './config.js';
import { roadLines } from './world.js';

export function createHud(root) {
  root.innerHTML = `
    <div id="hud-top-left">
      <div id="hud-money">$0</div>
      <div id="hud-healthbar"><div id="hud-healthfill"></div></div>
      <div id="hud-respect">RESPECT 0</div>
    </div>
    <div id="hud-top-right">
      <div id="hud-wanted"></div>
      <div id="hud-clock"></div>
    </div>
    <div id="hud-mission">
      <div id="hud-mission-title"></div>
      <div id="hud-objective"></div>
    </div>
    <div id="hud-speed"></div>
    <div id="hud-banner"></div>
    <div id="hud-toast"></div>
    <div id="hud-prompt"></div>
    <canvas id="minimap" width="196" height="148"></canvas>
    <div id="hud-controls">WASD move · E enter/exit car · Mouse aim · Click shoot · Shift sprint · P pause</div>
  `;
  return {
    money: root.querySelector('#hud-money'),
    healthFill: root.querySelector('#hud-healthfill'),
    respect: root.querySelector('#hud-respect'),
    wanted: root.querySelector('#hud-wanted'),
    clock: root.querySelector('#hud-clock'),
    missionTitle: root.querySelector('#hud-mission-title'),
    objective: root.querySelector('#hud-objective'),
    speed: root.querySelector('#hud-speed'),
    banner: root.querySelector('#hud-banner'),
    toast: root.querySelector('#hud-toast'),
    prompt: root.querySelector('#hud-prompt'),
    minimap: root.querySelector('#minimap'),
  };
}

let toastTimer = 0;
let bannerTimer = 0;

export function showToast(hud, text, seconds = 3) {
  hud.toast.textContent = text;
  hud.toast.style.opacity = '1';
  toastTimer = seconds;
}

export function showBanner(hud, text, seconds = 3.4) {
  hud.banner.textContent = text;
  hud.banner.style.opacity = '1';
  bannerTimer = seconds;
}

export function updateHud(hud, game, dt) {
  const save = game.save;
  hud.money.textContent = `$${save.money.toLocaleString('en-US')}`;
  hud.healthFill.style.width = `${Math.max(0, game.player.health)}%`;
  hud.healthFill.style.background = game.player.health > 35 ? '#51ff7a' : '#ff5d5d';
  hud.respect.textContent = `RESPECT ${save.respect} · ${game.districtName || 'PALMA BAY'}`;
  const stars = game.wanted.level;
  hud.wanted.textContent = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : '';
  hud.wanted.style.color = game.wanted.unseenTimer > 2 && stars > 0 ? '#9fb7c9' : '#ffd23f';
  const mins = Math.floor(game.timeOfDay * 24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  hud.clock.textContent = `${hh}:${mm}`;
  const mission = game.mission;
  hud.missionTitle.textContent = mission ? mission.title : 'PALMA BAY — FREE ROAM';
  hud.objective.textContent = game.objectiveText || '';
  hud.speed.textContent = game.player.inCar ? `${game.speedKmh} km/h · ${game.player.inCar.model.name}` : '';
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) hud.toast.style.opacity = '0'; }
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) hud.banner.style.opacity = '0'; }
  if (game.bustProgress > 0.02 && game.wanted.level > 0) {
    hud.prompt.textContent = `BUSTED IN ${(1 - game.bustProgress).toFixed(1)}s — MOVE!`;
  }
  drawMinimap(hud.minimap, game);
}

export function drawMinimap(canvas, game) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const sx = W / WORLD.width;
  const sy = H / WORLD.height;
  ctx.fillStyle = '#79b34a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f2d492';
  ctx.fillRect(WORLD.beachX * sx, 0, (WORLD.waterX - WORLD.beachX) * sx, H);
  ctx.fillStyle = '#2fb3c9';
  ctx.fillRect(WORLD.waterX * sx, 0, W - WORLD.waterX * sx, H);
  ctx.strokeStyle = '#3c4148';
  ctx.lineWidth = 2.4;
  const { vertical, horizontal } = roadLines();
  ctx.beginPath();
  for (const rx of vertical) { ctx.moveTo(rx * sx, 0); ctx.lineTo(rx * sx, H); }
  for (const ry of horizontal) { ctx.moveTo(0, ry * sy); ctx.lineTo(W, ry * sy); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (const b of game.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(1.4, b.w * sx), Math.max(1.4, b.h * sy));
  const dot = (x, y, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x * sx, y * sy, r, 0, Math.PI * 2); ctx.fill(); };
  for (const ped of game.peds) dot(ped.x, ped.y, 'rgba(255,255,255,0.75)', 1.1);
  for (const car of game.cars) {
    if (car.isPolice) dot(car.x, car.y, game.time % 0.6 < 0.3 ? '#ff2d2d' : '#2d7bff', 2.6);
    else dot(car.x, car.y, 'rgba(200,200,200,0.8)', 1.6);
  }
  for (const bag of game.cashBags || []) if (!bag.taken) dot(bag.x, bag.y, '#51ff7a', 3);
  if (game.missionTarget) {
    dot(game.missionTarget.x, game.missionTarget.y, '#ffd23f', 3.6);
    ctx.strokeStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(game.missionTarget.x * sx, game.missionTarget.y * sy, 5.6 + Math.sin(game.time * 4) * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  const pos = game.playerPos || { x: game.player.x, y: game.player.y, angle: game.player.angle };
  ctx.save();
  ctx.translate(pos.x * sx, pos.y * sy);
  ctx.rotate(pos.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4.4, -3.8); ctx.lineTo(-4.4, 3.8); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
