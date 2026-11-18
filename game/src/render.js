// Canvas renderer: paints Palma Bay top-down with a warm sunset grade —
// grass blocks, asphalt avenues with lane paint, pastel rooftops with
// names, palms, the beach and the bay, then cars, people and effects.
// The camera follows the player and looks ahead toward the mouse.

import { WORLD, COLORS } from './config.js';
import { roadLines } from './world.js';

export function createCamera() {
  return { x: 0, y: 0, shake: 0 };
}

export function updateCamera(camera, focusX, focusY, viewW, viewH, dt) {
  const tx = focusX - viewW / 2;
  const ty = focusY - viewH / 2;
  const blend = 1 - Math.pow(0.001, dt);
  camera.x += (tx - camera.x) * blend * 0.6;
  camera.y += (ty - camera.y) * blend * 0.6;
  camera.shake = Math.max(0, camera.shake - dt * 26);
}

export function drawWorld(ctx, game, viewW, viewH, time) {
  const cam = game.camera;
  const shakeX = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  const shakeY = cam.shake ? (Math.random() - 0.5) * cam.shake : 0;
  ctx.save();
  ctx.translate(-Math.round(cam.x + shakeX), -Math.round(cam.y + shakeY));
  const left = cam.x - 60;
  const top = cam.y - 60;
  const right = cam.x + viewW + 60;
  const bottom = cam.y + viewH + 60;

  // Ground: grass, then sand, then sea.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = COLORS.grassDark;
  for (let gx = Math.floor(left / 200) * 200; gx < right; gx += 200) {
    for (let gy = Math.floor(top / 200) * 200; gy < bottom; gy += 200) {
      if ((gx / 200 + gy / 200) % 2 === 0) ctx.fillRect(gx, gy, 200, 200);
    }
  }
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(WORLD.beachX, top, WORLD.waterX - WORLD.beachX, bottom - top);
  const wave = Math.sin(time * 1.4) * 6;
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(WORLD.waterX + wave, top, WORLD.width - WORLD.waterX + 80, bottom - top);
  ctx.fillStyle = COLORS.waterDeep;
  ctx.fillRect(WORLD.waterX + 130 + wave, top, WORLD.width - WORLD.waterX, bottom - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(WORLD.waterX + wave, top);
  ctx.lineTo(WORLD.waterX + wave, bottom);
  ctx.stroke();

  drawRoads(ctx, left, top, right, bottom);
  drawDistricts(ctx, game.city, left, top, right, bottom);
  for (const b of game.city.buildings) {
    if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
    drawBuilding(ctx, b);
  }
  for (const prop of game.city.props) drawProp(ctx, prop, time);
  for (const tree of game.city.trees) {
    if (tree.x < left || tree.x > right || tree.y < top || tree.y > bottom) continue;
    drawPalm(ctx, tree);
  }
  drawMarkers(ctx, game, time);
  for (const car of game.cars) {
    if (car.x < left - 80 || car.x > right + 80 || car.y < top - 80 || car.y > bottom + 80) continue;
    drawCar(ctx, car, time);
  }
  for (const ped of game.peds) {
    if (ped.x < left || ped.x > right || ped.y < top || ped.y > bottom) continue;
    drawPedestrian(ctx, ped);
  }
  if (!game.player.inCar) drawPlayer(ctx, game, time);
  drawCombatFx(ctx, game.combat);
  ctx.restore();

  // Sunset vignette.
  const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, viewH * 0.42, viewW / 2, viewH / 2, viewH * 0.95);
  grad.addColorStop(0, 'rgba(255,150,60,0)');
  grad.addColorStop(1, 'rgba(120,40,90,0.20)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
}

function drawRoads(ctx, left, top, right, bottom) {
  const { vertical, horizontal } = roadLines();
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of vertical) ctx.fillRect(rx - WORLD.roadHalf - WORLD.sidewalk, top, (WORLD.roadHalf + WORLD.sidewalk) * 2, bottom - top);
  for (const ry of horizontal) ctx.fillRect(left, ry - WORLD.roadHalf - WORLD.sidewalk, right - left, (WORLD.roadHalf + WORLD.sidewalk) * 2);
  ctx.fillStyle = COLORS.road;
  for (const rx of vertical) ctx.fillRect(rx - WORLD.roadHalf, top, WORLD.roadHalf * 2, bottom - top);
  for (const ry of horizontal) ctx.fillRect(left, ry - WORLD.roadHalf, right - left, WORLD.roadHalf * 2);
  ctx.strokeStyle = COLORS.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const rx of vertical) { ctx.moveTo(rx, top); ctx.lineTo(rx, bottom); }
  for (const ry of horizontal) { ctx.moveTo(left, ry); ctx.lineTo(right, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of vertical) {
    for (const ry of horizontal) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(rx + i * 12 - 4, ry - WORLD.roadHalf - 10, 8, 7);
        ctx.fillRect(rx + i * 12 - 4, ry + WORLD.roadHalf + 3, 8, 7);
      }
    }
  }
}

function drawDistricts(ctx, city, left, top, right, bottom) {
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const d of city.districts) {
    if (d.x < left || d.x > right || d.y < top || d.y > bottom) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillText(d.name, d.x, d.y);
  }
}

function drawBuilding(ctx, b) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  const rows = Math.max(1, Math.floor(b.h / 34));
  const cols = Math.max(1, Math.floor(b.w / 34));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      ctx.fillRect(b.x + 13 + c * 34, b.y + 13 + r * 34, 15, 11);
    }
  }
  if (b.w > 92 && b.h > 60) {
    ctx.fillStyle = 'rgba(20,16,32,0.78)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 4);
  }
}

function drawPalm(ctx, tree) {
  ctx.strokeStyle = '#8a6b45';
  ctx.lineWidth = 5 * tree.s;
  ctx.beginPath();
  ctx.moveTo(tree.x, tree.y);
  ctx.lineTo(tree.x + 4 * tree.s, tree.y - 6 * tree.s);
  ctx.stroke();
  ctx.strokeStyle = '#2f9e44';
  ctx.lineWidth = 3.4 * tree.s;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + tree.x * 0.01;
    ctx.beginPath();
    ctx.moveTo(tree.x + 4 * tree.s, tree.y - 6 * tree.s);
    ctx.quadraticCurveTo(
      tree.x + 4 * tree.s + Math.cos(a) * 15 * tree.s,
      tree.y - 6 * tree.s + Math.sin(a) * 9 * tree.s - 5,
      tree.x + 4 * tree.s + Math.cos(a) * 24 * tree.s,
      tree.y - 6 * tree.s + Math.sin(a) * 15 * tree.s + 3,
    );
    ctx.stroke();
  }
}

function drawProp(ctx, prop, time) {
  if (prop.kind === 'umbrella') {
    ctx.fillStyle = prop.color;
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'lamp') {
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.arc(prop.x, prop.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMarkers(ctx, game, time) {
  const target = game.missionTarget;
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  const beam = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.20;
    ctx.fillRect(x - 13, y - 190, 26, 190);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  };
  if (target) beam(target.x, target.y, '#ffd23f');
  for (const bag of game.cashBags || []) {
    if (!bag.taken) beam(bag.x, bag.y, '#51ff7a');
  }
  if (game.markedCar && !game.markedCarUsed) beam(game.markedCar.x, game.markedCar.y, '#4fc4a8');
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-21, -9 + 4, 46, 22);
  ctx.fillStyle = car.wrecked ? '#555a60' : car.color;
  ctx.beginPath();
  ctx.roundRect(-23, -11, 46, 22, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,34,0.9)';
  ctx.beginPath();
  ctx.roundRect(-6, -9, 17, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,220,255,0.85)';
  ctx.fillRect(2, -8, 7, 16);
  ctx.fillStyle = '#111';
  ctx.fillRect(-19, -13, 11, 4); ctx.fillRect(9, -13, 11, 4);
  ctx.fillRect(-19, 9, 11, 4); ctx.fillRect(9, 9, 11, 4);
  ctx.fillStyle = '#fff6bf';
  ctx.fillRect(21, -9, 3, 5); ctx.fillRect(21, 4, 3, 5);
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(-24, -9, 3, 5); ctx.fillRect(-24, 4, 3, 5);
  if (car.isPolice) {
    ctx.fillStyle = '#20304a';
    ctx.fillRect(-14, -11, 30, 5);
    ctx.fillRect(-14, 6, 30, 5);
    const red = Math.sin(time * 9 + car.sirenPhase) > 0;
    ctx.fillStyle = red ? '#ff2d2d' : '#2d7bff';
    ctx.beginPath();
    ctx.arc(2, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#12233c';
    ctx.font = '700 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICIA', 0, -14);
  }
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(-14, 0, 7 + Math.sin(time * 7) * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPedestrian(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.roundRect(-11, -5, 22, 10, 5); ctx.fill();
    ctx.fillStyle = '#f2c29b';
    ctx.beginPath(); ctx.arc(14, 0, 5.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 1.7;
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath(); ctx.ellipse(0, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#33404f';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 1); ctx.lineTo(Math.cos(ped.angle + 2.6) * 7, 4 + bob * 0.4);
  ctx.moveTo(0, 1); ctx.lineTo(Math.cos(ped.angle - 2.6) * 7, 4 - bob * 0.4);
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 2.4, Math.sin(ped.angle) * 2.4, 4.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, game, time) {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 6, 9, 4.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1d2733';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 1); ctx.lineTo(-6, 7 + bob * 0.4);
  ctx.moveTo(0, 1); ctx.lineTo(6, 7 - bob * 0.4);
  ctx.stroke();
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = '#ffcf3f';
  ctx.beginPath(); ctx.roundRect(-8, -9, 16, 19, 7); ctx.fill();
  ctx.fillStyle = '#e23b3b';
  ctx.fillRect(-8, -2, 16, 4.4);
  ctx.fillStyle = '#f2c29b';
  ctx.beginPath(); ctx.arc(0, -8, 5.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#14202e';
  ctx.fillRect(-6, -14.4, 12, 4.6);
  ctx.restore();
  // Aim line when the mouse is down.
  if (game.input && game.input.mouse.down) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(game.aimAngle || 0);
    ctx.fillStyle = '#14202e';
    ctx.fillRect(8, -2, 15, 4);
    ctx.restore();
  }
}

function drawCombatFx(ctx, combat) {
  if (!combat) return;
  for (const t of combat.tracers) {
    ctx.strokeStyle = `rgba(255,230,130,${0.75 * t.life})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  for (const s of combat.sparks) {
    ctx.fillStyle = s.color;
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}
