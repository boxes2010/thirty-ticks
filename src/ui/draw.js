import { heroStats, expToNext, SLOTS } from '../core/hero.js';
import { townMenu } from '../core/session.js';
import { openStages } from '../core/campaign.js';
import { PAUSE_MENU } from '../core/app.js';

export const W = 640;
export const H = 360;

const C = {
  void: '#070e10', bg: '#0f1c20', bar: '#0a1417', panel: '#16282d', edge: '#2c474d',
  ink: '#efe6cf', dim: '#7f959b', brass: '#d9a441', copper: '#c9743a', teal: '#4fb3a5',
  red: '#e2574a', green: '#7fc97f', dark: '#12201f',
};
const MEDAL = { gold: '#e8c04a', silver: '#c9d2d6', bronze: '#c9834a', none: '#55686d' };
const SANS = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const HUD = 46;

// ---------- small helpers ----------

function text(ctx, str, x, y, { size = 12, color = C.ink, align = 'left', weight = 500, mono = false } = {}) {
  ctx.font = `${weight} ${size}px ${mono ? MONO : SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y);
}

function wrap(ctx, str, width, size, weight = 500) {
  ctx.font = `${weight} ${size}px ${SANS}`;
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function paragraph(ctx, str, x, y, width, { size = 12, color = C.ink, align = 'left', weight = 500 } = {}) {
  const lines = wrap(ctx, str, width, size, weight);
  lines.forEach((line, i) => text(ctx, line, x, y + i * size * 1.45, { size, color, align, weight }));
  return y + lines.length * size * 1.45;
}

function box(ctx, x, y, w, h, { fill = C.panel, edge = C.edge, r = 7 } = {}) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = edge;
    ctx.stroke();
  }
}

function disc(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function gearPath(ctx, x, y, r, teeth, turn) {
  ctx.beginPath();
  for (let i = 0; i < teeth * 4; i++) {
    const a = turn + (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : r * 0.78;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

const seconds = (t) => `${t.toFixed(1)}s`;

// ---------- effects ----------

export function createFx() {
  return { floats: [], shake: 0, flash: null, hero: { x: 0, y: 0 }, foe: { x: 0, y: 0 } };
}

export function absorb(fx, events) {
  for (const e of events) {
    if (e.type === 'clash') {
      fx.floats.push({ x: fx.foe.x, y: fx.foe.y, text: `${e.dealt}`, color: C.ink, age: 0 });
      fx.floats.push({ x: fx.hero.x, y: fx.hero.y, text: `-${e.taken}`, color: C.red, age: 0 });
      fx.shake = 0.12;
    } else if (e.type === 'fight' || e.type === 'start') {
      fx.floats.length = 0;
      fx.flash = { color: C.ink, age: 0, life: 0.18 };
    } else if (e.type === 'rewind') {
      fx.flash = { color: C.teal, age: 0, life: 0.5 };
    } else if (e.type === 'unwound' || e.type === 'down') {
      fx.flash = { color: C.red, age: 0, life: 0.5 };
    } else if (e.type === 'cleared') {
      fx.flash = { color: C.brass, age: 0, life: 0.6 };
    }
  }
}

export function ageFx(fx, dt) {
  fx.shake = Math.max(0, fx.shake - dt);
  for (const f of fx.floats) f.age += dt;
  fx.floats = fx.floats.filter((f) => f.age < 0.7);
  if (fx.flash && (fx.flash.age += dt) >= fx.flash.life) fx.flash = null;
}

// ---------- characters ----------

function drawHero(ctx, x, y, r, facing, stride, time) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.95, r * 0.8, r * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const keyX = x - side * r * 0.75 + (side === 0 ? r * 0.75 : 0);
  if (facing !== 'down') {
    const spin = Math.abs(Math.cos(time * 9));
    ctx.fillStyle = C.brass;
    ctx.fillRect(keyX - r * 0.08, y - r * 0.25, r * 0.16, r * 0.3);
    ctx.beginPath();
    ctx.ellipse(keyX, y - r * 0.4, r * 0.32 * spin + r * 0.06, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const lift = Math.sin(stride * Math.PI * 2) * r * 0.16;
  ctx.fillStyle = C.dark;
  ctx.fillRect(x - r * 0.45, y + r * 0.55 - Math.max(0, lift), r * 0.32, r * 0.35);
  ctx.fillRect(x + r * 0.13, y + r * 0.55 - Math.max(0, -lift), r * 0.32, r * 0.35);

  ctx.beginPath();
  ctx.roundRect(x - r * 0.55, y - r * 0.2, r * 1.1, r * 0.9, r * 0.25);
  ctx.fillStyle = C.teal;
  ctx.fill();
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = Math.max(1, r * 0.09);
  ctx.stroke();

  disc(ctx, x, y - r * 0.5, r * 0.5, C.ink);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - r * 0.56, r * 0.5, Math.PI, 0);
  ctx.fillStyle = C.brass;
  ctx.fill();
  if (facing !== 'up') {
    const look = side * r * 0.16;
    disc(ctx, x - r * 0.17 + look, y - r * 0.42, r * 0.08, C.dark);
    disc(ctx, x + r * 0.17 + look, y - r * 0.42, r * 0.08, C.dark);
  }
}

function eyes(ctx, x, y, r, angry) {
  for (const dx of [-r * 0.9, r * 0.9]) {
    disc(ctx, x + dx, y, r, C.ink);
    disc(ctx, x + dx - r * 0.3, y, r * 0.45, C.dark);
  }
  if (angry) {
    line(ctx, x - r * 2, y - r * 1.9, x - r * 0.2, y - r * 0.9, C.dark, r * 0.6);
    line(ctx, x + r * 2, y - r * 1.9, x + r * 0.2, y - r * 0.9, C.dark, r * 0.6);
  }
}

// Draws a unit standing on `ground`, facing left. Returns the top of its head.
function drawUnit(ctx, unit, x, ground, time, seed) {
  const r = 21 * unit.size;
  const t = time + seed * 1.7;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, ground, r * 0.9, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineJoin = 'round';

  if (unit.look === 'mite') {
    const cy = ground - r * 0.75;
    ctx.strokeStyle = C.dark;
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    for (let i = -1; i <= 1; i++) {
      const sway = Math.sin(t * 12 + i) * r * 0.12;
      line(ctx, x + i * r * 0.45, cy, x + i * r * 0.7 + sway, ground, C.dark, ctx.lineWidth);
    }
    ctx.beginPath();
    ctx.ellipse(x, cy, r, r * 0.68, 0, 0, Math.PI * 2);
    ctx.fillStyle = unit.tint;
    ctx.fill();
    ctx.stroke();
    line(ctx, x - r * 0.1, cy - r * 0.62, x - r * 0.1, cy + r * 0.62, 'rgba(0,0,0,0.25)', 1.5);
    eyes(ctx, x - r * 0.55, cy - r * 0.1, r * 0.17, false);
    return cy - r * 0.7;
  }

  if (unit.look === 'spring') {
    const height = r * (1.5 + Math.sin(t * 7) * 0.22);
    ctx.beginPath();
    ctx.moveTo(x, ground);
    const turns = 5;
    for (let i = 1; i <= turns; i++) ctx.lineTo(x + (i % 2 ? -1 : 1) * r * 0.55, ground - (height * i) / turns);
    ctx.strokeStyle = unit.tint;
    ctx.lineWidth = Math.max(2, r * 0.2);
    ctx.stroke();
    const cy = ground - height - r * 0.4;
    disc(ctx, x, cy, r * 0.55, unit.tint);
    ctx.strokeStyle = C.dark;
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.stroke();
    eyes(ctx, x - r * 0.15, cy - r * 0.05, r * 0.14, false);
    return cy - r * 0.55;
  }

  if (unit.look === 'wisp') {
    const cy = ground - r * 1.1 + Math.sin(t * 4) * r * 0.15;
    const tip = Math.sin(t * 5) * r * 0.35;
    ctx.beginPath();
    ctx.moveTo(x + tip, cy - r * 1.5);
    ctx.quadraticCurveTo(x + r * 1.1, cy - r * 0.2, x + r * 0.75, cy + r * 0.35);
    ctx.arc(x, cy + r * 0.35, r * 0.75, 0, Math.PI);
    ctx.quadraticCurveTo(x - r * 1.1, cy - r * 0.2, x + tip, cy - r * 1.5);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = unit.tint;
    ctx.fill();
    ctx.globalAlpha = 1;
    eyes(ctx, x - r * 0.15, cy + r * 0.2, r * 0.16, true);
    return cy - r * 1.5;
  }

  const boss = unit.look === 'boss';
  const cy = ground - r * 1.05 + (boss ? Math.sin(t * 3) * 2 : 0);
  gearPath(ctx, x, cy, r, boss ? 10 : 8, -t * (boss ? 0.8 : 2.4));
  ctx.fillStyle = unit.tint;
  ctx.fill();
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.stroke();
  disc(ctx, x, cy, r * 0.56, C.dark);
  if (boss) {
    ctx.beginPath();
    for (const dx of [-0.5, 0, 0.5]) {
      ctx.moveTo(x + (dx - 0.2) * r, cy - r * 0.95);
      ctx.lineTo(x + dx * r, cy - r * 1.5);
      ctx.lineTo(x + (dx + 0.2) * r, cy - r * 0.95);
    }
    ctx.fillStyle = C.brass;
    ctx.fill();
    eyes(ctx, x - r * 0.05, cy - r * 0.05, r * 0.13, true);
    line(ctx, x - r * 0.25, cy + r * 0.28, x + r * 0.2, cy + r * 0.28, C.ink, r * 0.07);
    return cy - r * 1.5;
  }
  eyes(ctx, x - r * 0.08, cy, r * 0.15, false);
  return cy - r;
}

// ---------- map tiles and sites ----------

function drawTile(ctx, ch, px, py, T, x, y, time) {
  const r = hash(x, y);
  const r2 = hash(y + 31, x + 17);
  const fill = (color) => {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, T + 0.5, T + 0.5);
  };
  if (ch === '.') {
    fill(r < 0.5 ? '#2c6a4c' : '#2f6f50');
    line(ctx, px + r * T * 0.7 + 3, py + r2 * T * 0.6 + 6, px + r * T * 0.7 + 5, py + r2 * T * 0.6 + 2, '#48906a', 1.2);
    line(ctx, px + r2 * T * 0.7 + 3, py + r * T * 0.5 + 9, px + r2 * T * 0.7 + 1, py + r * T * 0.5 + 5, '#3d8260', 1.2);
  } else if (ch === ',') {
    fill(r < 0.5 ? '#566a3b' : '#5c7040');
    disc(ctx, px + 4 + r * T * 0.6, py + 5 + r2 * T * 0.6, 1.4, '#7d9152');
    disc(ctx, px + 4 + r2 * T * 0.6, py + 4 + r * T * 0.5, 1.1, '#3f5230');
  } else if (ch === 'f') {
    fill('#1b4636');
    disc(ctx, px + T * (0.3 + r * 0.15), py + T * (0.38 + r2 * 0.1), T * 0.27, '#2d6b4f');
    disc(ctx, px + T * (0.68 - r2 * 0.1), py + T * (0.64 + r * 0.08), T * 0.25, '#327557');
    disc(ctx, px + T * (0.3 + r * 0.15) - 2, py + T * (0.38 + r2 * 0.1) - 2, T * 0.09, '#3f8765');
  } else if (ch === '=') {
    fill('#a48e63');
    disc(ctx, px + 3 + r * (T - 6), py + 3 + r2 * (T - 6), 1.2, '#8b7650');
    disc(ctx, px + 3 + r2 * (T - 6), py + 3 + r * (T - 6), 0.9, '#bba77c');
  } else if (ch === '#') {
    fill('#1b4a66');
    ctx.fillStyle = '#8b6b45';
    ctx.fillRect(px, py + T * 0.12, T + 0.5, T * 0.76);
    for (let i = 1; i < 4; i++) line(ctx, px + (i * T) / 4, py + T * 0.12, px + (i * T) / 4, py + T * 0.88, '#6d5234', 1);
    line(ctx, px, py + T * 0.12, px + T, py + T * 0.12, '#5a4329', 1.5);
    line(ctx, px, py + T * 0.88, px + T, py + T * 0.88, '#5a4329', 1.5);
  } else if (ch === '~') {
    fill(r < 0.5 ? '#1b4a66' : '#1d4f6c');
    const shift = Math.sin(time * 1.6 + x * 0.9 + y * 1.7) * 2;
    ctx.beginPath();
    ctx.arc(px + T * 0.35 + shift, py + T * (0.35 + r * 0.3), T * 0.16, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = '#3479a0';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (ch === '^') {
    fill('#363c43');
    ctx.beginPath();
    ctx.moveTo(px + T * 0.1, py + T * 0.9);
    ctx.lineTo(px + T * (0.42 + r * 0.16), py + T * 0.12);
    ctx.lineTo(px + T * 0.9, py + T * 0.9);
    ctx.closePath();
    ctx.fillStyle = '#59626b';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + T * (0.42 + r * 0.16), py + T * 0.12);
    ctx.lineTo(px + T * 0.9, py + T * 0.9);
    ctx.lineTo(px + T * 0.55, py + T * 0.9);
    ctx.closePath();
    ctx.fillStyle = '#464e56';
    ctx.fill();
  }
}

function drawTownSite(ctx, cx, cy, T) {
  const w = T * 0.84;
  ctx.fillStyle = C.ink;
  ctx.fillRect(cx - w / 2, cy - T * 0.12, w, T * 0.52);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.62, cy - T * 0.1);
  ctx.lineTo(cx, cy - T * 0.56);
  ctx.lineTo(cx + w * 0.62, cy - T * 0.1);
  ctx.closePath();
  ctx.fillStyle = C.brass;
  ctx.fill();
  ctx.strokeStyle = C.dark;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeRect(cx - w / 2, cy - T * 0.12, w, T * 0.52);
  disc(ctx, cx, cy + T * 0.13, T * 0.17, C.teal);
  line(ctx, cx, cy + T * 0.13, cx, cy + T * 0.02, C.dark, 1.2);
  line(ctx, cx, cy + T * 0.13, cx + T * 0.08, cy + T * 0.16, C.dark, 1.2);
}

function drawTowerSite(ctx, cx, cy, T, time) {
  const w = T * 0.5;
  ctx.fillStyle = '#2a2f36';
  ctx.fillRect(cx - w / 2, cy - T * 0.62, w, T * 1.02);
  ctx.fillRect(cx - w * 0.72, cy - T * 0.74, w * 1.44, T * 0.16);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2, cy - T * 0.62, w, T * 1.02);
  disc(ctx, cx, cy - T * 0.26, T * 0.16, Math.sin(time * 6) > 0 ? C.red : '#7a2a24');
  line(ctx, cx, cy - T * 0.74, cx, cy - T * 1.05, C.ink, 1);
  ctx.beginPath();
  ctx.moveTo(cx, cy - T * 1.05);
  ctx.lineTo(cx + T * 0.3, cy - T * 0.96);
  ctx.lineTo(cx, cy - T * 0.86);
  ctx.fillStyle = C.red;
  ctx.fill();
}

function fieldLayout(stage) {
  const cols = stage.map[0].length;
  const rows = stage.map.length;
  const room = H - HUD - 30;
  const T = Math.floor(Math.min(W / cols, room / rows));
  return { T, ox: Math.round((W - cols * T) / 2), oy: Math.round(HUD + 4 + (room - rows * T) / 2) };
}

// ---------- heads-up display ----------

function drawClock(ctx, x, y, r, left, total, stopped, time) {
  const low = left < 10 && !stopped;
  const beat = low ? 1 + Math.max(0, Math.sin(time * 12)) * 0.08 : 1;
  const color = stopped ? C.teal : low ? C.red : C.brass;
  disc(ctx, x, y, r * beat + 4, C.bar);
  ctx.beginPath();
  ctx.arc(x, y, r * beat, 0, Math.PI * 2);
  ctx.strokeStyle = C.edge;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * beat, -Math.PI / 2, -Math.PI / 2 + (left / total) * Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.stroke();
  text(ctx, left.toFixed(1), x, y + 5.5, { size: 15 * beat, color, align: 'center', weight: 700, mono: true });
}

function drawHud(ctx, app) {
  const s = app.session;
  const { hero, clock } = s;
  const stats = heroStats(hero, s.data);
  const total = s.data.balance.clock.seconds;
  const stopped = s.mode === 'town' || app.screen !== 'stage' || app.paused;
  ctx.fillStyle = C.bar;
  ctx.fillRect(0, 0, W, HUD);

  text(ctx, `Lv ${hero.level}`, 12, 19, { size: 14, color: C.brass, weight: 700 });
  const frac = Math.max(0, hero.hp / stats.maxHp);
  box(ctx, 62, 9, 132, 11, { fill: '#243338', edge: null, r: 3 });
  if (frac > 0) box(ctx, 62, 9, Math.max(4, 132 * frac), 11, { fill: frac > 0.35 ? C.green : C.red, edge: null, r: 3 });
  text(ctx, `${Math.ceil(hero.hp)}/${stats.maxHp}`, 200, 19, { size: 11, color: C.ink, mono: true });
  box(ctx, 62, 24, 132, 3, { fill: '#243338', edge: null, r: 1.5 });
  const expFrac = hero.exp / expToNext(hero.level, s.data);
  if (expFrac > 0) box(ctx, 62, 24, 132 * expFrac, 3, { fill: C.teal, edge: null, r: 1.5 });
  text(ctx, s.stage.name, 12, 39, { size: 10, color: C.dim });

  text(ctx, `${hero.gold}g`, W - 12, 20, { size: 15, color: C.brass, align: 'right', weight: 700, mono: true });
  text(ctx, `ATK ${stats.atk}   DEF ${stats.def}`, W - 12, 38, { size: 10, color: C.dim, align: 'right', mono: true });

  ctx.fillStyle = '#243338';
  ctx.fillRect(0, HUD - 3, W, 3);
  ctx.fillStyle = stopped ? C.teal : clock.left < 10 ? C.red : C.brass;
  ctx.fillRect(0, HUD - 3, W * (clock.left / total), 3);
  drawClock(ctx, W / 2, 28, 24, clock.left, total, stopped, app.time);
  if (clock.rewinds) text(ctx, `rewinds ${clock.rewinds}`, W / 2 + 40, 39, { size: 10, color: C.dim });
  if (s.mode === 'town') text(ctx, 'stopped', W / 2 - 40, 39, { size: 10, color: C.teal, align: 'right' });
}

function drawNotice(ctx, notice) {
  if (!notice) return;
  ctx.font = `600 12px ${SANS}`;
  const w = Math.min(W - 40, ctx.measureText(notice.text).width + 28);
  ctx.globalAlpha = Math.min(1, notice.ttl * 3);
  box(ctx, (W - w) / 2, H - 58, w, 24, { fill: 'rgba(8,16,18,0.92)', edge: C.brass, r: 12 });
  text(ctx, notice.text, W / 2, H - 42, { size: 12, align: 'center', weight: 600 });
  ctx.globalAlpha = 1;
}

function hint(ctx, str) {
  text(ctx, str, W / 2, H - 9, { size: 10, color: C.dim, align: 'center' });
}

// ---------- stage views ----------

function drawField(ctx, app) {
  const s = app.session;
  const { stage } = s;
  const { T, ox, oy } = fieldLayout(stage);
  const center = ([x, y]) => [ox + x * T + T / 2, oy + y * T + T / 2];

  stage.map.forEach((row, y) => [...row].forEach((ch, x) => drawTile(ctx, ch, ox + x * T, oy + y * T, T, x, y, app.time)));

  for (const gate of stage.gates) {
    if (s.flags.has(gate.until)) continue;
    const [cx, cy] = center(gate.at);
    line(ctx, cx - T * 0.35, cy - T * 0.35, cx + T * 0.35, cy + T * 0.35, C.red, 3);
    line(ctx, cx + T * 0.35, cy - T * 0.35, cx - T * 0.35, cy + T * 0.35, C.red, 3);
  }
  for (const spot of stage.spots) {
    const open = (spot.needs ?? []).every((f) => s.flags.has(f)) && !(spot.lacks ?? []).some((f) => s.flags.has(f));
    if (!open) continue;
    const [cx, cy] = center(spot.at);
    const size = T * (0.22 + Math.sin(app.time * 5) * 0.06);
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 1.6);
    ctx.quadraticCurveTo(cx, cy, cx + size * 1.6, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy + size * 1.6);
    ctx.quadraticCurveTo(cx, cy, cx - size * 1.6, cy);
    ctx.quadraticCurveTo(cx, cy, cx, cy - size * 1.6);
    ctx.fillStyle = C.brass;
    ctx.fill();
  }
  for (const town of stage.towns) drawTownSite(ctx, ...center(town.at), T);
  drawTowerSite(ctx, ...center(stage.tower.at), T, app.time);

  let hx = s.pos.x;
  let hy = s.pos.y;
  if (s.move) {
    hx = s.move.from.x + (s.move.to.x - s.move.from.x) * s.move.t;
    hy = s.move.from.y + (s.move.to.y - s.move.from.y) * s.move.t;
  }
  drawHero(ctx, ox + hx * T + T / 2, oy + hy * T + T / 2 - T * 0.08, T * 0.42, s.facing, s.move ? s.move.t : 0, app.time);

  drawNotice(ctx, s.notice);
  hint(ctx, 'Arrows / WASD  move      Enter  go in      Esc  pause      M  sound');
}

function drawBattle(ctx, app, fx) {
  const s = app.session;
  const b = s.battle;
  const ground = 262;
  const sx = (x) => 46 + x * 1.08;

  const sky = ctx.createLinearGradient(0, HUD, 0, ground);
  sky.addColorStop(0, s.boss ? '#2a1418' : '#123038');
  sky.addColorStop(1, s.boss ? '#3a2320' : '#1f4a4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, HUD, W, ground - HUD);
  for (let i = 0; i < 7; i++) {
    const gx = ((i * 110 - (app.time * 14 + b.heroX * 0.3)) % 770 + 770) % 770 - 60;
    gearPath(ctx, gx, ground - 26 - (i % 3) * 22, 20 + (i % 3) * 9, 9, app.time * (i % 2 ? 0.3 : -0.3));
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.fill();
  }
  ctx.fillStyle = s.boss ? '#241a1a' : '#16302c';
  ctx.fillRect(0, ground, W, H - ground);
  line(ctx, 0, ground, W, ground, s.boss ? '#5a3a34' : '#2f5c53', 2);

  ctx.save();
  if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4);

  const front = b.foes.find((f) => f.hp > 0);
  b.foes.forEach((foe, i) => {
    if (foe.hp <= 0) return;
    const unit = s.data.units[foe.unit];
    const top = drawUnit(ctx, unit, sx(foe.x), ground, app.time, i);
    if (foe === front) fx.foe = { x: sx(foe.x), y: top - 16 };
    if (!s.boss) {
      const w = 46 * unit.size;
      box(ctx, sx(foe.x) - w / 2, top - 11, w, 4, { fill: '#243338', edge: null, r: 2 });
      box(ctx, sx(foe.x) - w / 2, top - 11, Math.max(2, w * (foe.hp / unit.hp)), 4, { fill: C.red, edge: null, r: 2 });
    }
  });

  const heroX = sx(b.heroX);
  drawHero(ctx, heroX, ground - 30, 30, 'right', app.time * 5, app.time);
  fx.hero = { x: heroX, y: ground - 82 };
  ctx.restore();

  for (const f of fx.floats) {
    ctx.globalAlpha = 1 - f.age / 0.7;
    text(ctx, f.text, f.x, f.y - f.age * 46, { size: 17, color: f.color, align: 'center', weight: 800, mono: true });
  }
  ctx.globalAlpha = 1;

  if (s.boss && front) {
    const unit = s.data.units[front.unit];
    text(ctx, unit.name, W / 2, HUD + 22, { size: 13, align: 'center', weight: 700 });
    box(ctx, W / 2 - 150, HUD + 29, 300, 7, { fill: '#243338', edge: null, r: 3 });
    box(ctx, W / 2 - 150, HUD + 29, Math.max(3, 300 * (front.hp / unit.hp)), 7, { fill: C.red, edge: null, r: 3 });
  } else if (front) {
    text(ctx, b.foes.filter((f) => f.hp > 0).map((f) => s.data.units[f.unit].name).join('  +  '), W / 2, HUD + 22, { size: 12, align: 'center', color: C.dim, weight: 600 });
  }
  hint(ctx, 'Fighting is automatic.      Hold Space  dash (costs health)      Hold X  run away');
}

function itemPerks(item) {
  const perks = [];
  if (item.atk) perks.push(`+${item.atk} ATK`);
  if (item.def) perks.push(`+${item.def} DEF`);
  if (item.hp) perks.push(`+${item.hp} HP`);
  if (item.pace) perks.push(`+${item.pace} pace`);
  return perks.join('  ');
}

function drawTown(ctx, app) {
  const s = app.session;
  const { hero } = s;
  const stats = heroStats(hero, s.data);
  const menu = townMenu(s);

  box(ctx, 20, HUD + 12, 376, 232);
  text(ctx, s.town.name, 36, HUD + 38, { size: 17, color: C.brass, weight: 700 });
  text(ctx, 'Every clock in here is stopped. Take your time.', 36, HUD + 55, { size: 10.5, color: C.dim });
  const rowHeight = Math.min(26, 158 / (menu.length - 1));
  menu.forEach((entry, i) => {
    const y = HUD + 80 + i * rowHeight;
    const picked = i === app.cursor;
    if (picked) box(ctx, 28, y - 16, 360, Math.min(23, rowHeight - 1), { fill: '#21393f', edge: C.brass, r: 5 });
    const color = entry.enabled ? C.ink : '#5f7378';
    if (picked) text(ctx, '>', 36, y, { size: 13, color: C.brass, weight: 800, mono: true });
    text(ctx, entry.label, 52, y, { size: 12.5, color, weight: picked ? 700 : 500 });
    if (entry.kind === 'buy') {
      ctx.font = `${picked ? 700 : 500} 12.5px ${SANS}`;
      const after = 52 + ctx.measureText(entry.label).width + 10;
      text(ctx, itemPerks(s.data.items[entry.item]), after, y, { size: 10.5, color: entry.enabled ? C.teal : '#4d6166', mono: true });
    }
    if (entry.price !== undefined) {
      const poor = hero.gold < entry.price;
      text(ctx, `${entry.price}g`, 378, y, { size: 12, color: poor ? C.red : C.brass, align: 'right', weight: 700, mono: true });
    }
  });

  box(ctx, 408, HUD + 12, 212, 232);
  drawHero(ctx, 444, HUD + 58, 22, 'down', 0, app.time);
  text(ctx, `Level ${hero.level}`, 480, HUD + 48, { size: 15, weight: 700 });
  text(ctx, `${hero.exp}/${expToNext(hero.level, s.data)} exp`, 480, HUD + 64, { size: 10.5, color: C.dim, mono: true });
  const rows = [
    ['Health', `${Math.ceil(hero.hp)} / ${stats.maxHp}`],
    ['Attack', `${stats.atk}`],
    ['Defence', `${stats.def}`],
    ['Pace', `${stats.pace}`],
  ];
  rows.forEach(([label, value], i) => {
    text(ctx, label, 424, HUD + 104 + i * 18, { size: 11.5, color: C.dim });
    text(ctx, value, 604, HUD + 104 + i * 18, { size: 11.5, align: 'right', mono: true });
  });
  line(ctx, 424, HUD + 166, 604, HUD + 166, C.edge);
  SLOTS.forEach((slot, i) => {
    const item = s.data.items[hero.gear[slot]];
    text(ctx, slot[0].toUpperCase() + slot.slice(1), 424, HUD + 184 + i * 15, { size: 10.5, color: C.dim });
    text(ctx, item ? item.name : 'none', 604, HUD + 184 + i * 15, { size: 10.5, color: item ? C.ink : '#5f7378', align: 'right' });
  });

  box(ctx, 20, HUD + 252, 600, 52, { fill: '#0c181b' });
  if (app.said) paragraph(ctx, app.said, 34, HUD + 271, 572, { size: 11.5 });
  else text(ctx, 'Up / Down  choose      Enter  do it      X or Esc  leave', 34, HUD + 282, { size: 11, color: C.dim });
}

function drawPause(ctx, app) {
  ctx.fillStyle = 'rgba(5,10,12,0.72)';
  ctx.fillRect(0, 0, W, H);
  box(ctx, W / 2 - 130, 124, 260, 116);
  text(ctx, 'Paused', W / 2, 152, { size: 17, color: C.brass, align: 'center', weight: 700 });
  PAUSE_MENU.forEach((label, i) => {
    const y = 184 + i * 28;
    const picked = i === app.pauseCursor;
    if (picked) box(ctx, W / 2 - 116, y - 17, 232, 24, { fill: '#21393f', edge: C.brass, r: 5 });
    text(ctx, label, W / 2, y, { size: 12.5, align: 'center', weight: picked ? 700 : 500 });
  });
}

function stage(ctx, app, fx) {
  const s = app.session;
  if (s.mode === 'town') drawTown(ctx, app);
  else if (s.mode === 'battle') drawBattle(ctx, app, fx);
  else drawField(ctx, app);
  drawHud(ctx, app);
  if (s.mode !== 'town' && s.clock.left < 6) {
    const edge = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    edge.addColorStop(0, 'rgba(226,87,74,0)');
    edge.addColorStop(1, `rgba(226,87,74,${0.12 + (6 - s.clock.left) * 0.05})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, HUD, W, H - HUD);
  }
  if (app.paused) drawPause(ctx, app);
}

// ---------- other screens ----------

function dial(ctx, x, y, r, time) {
  disc(ctx, x, y, r + 8, C.bar);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = C.brass;
  ctx.lineWidth = 3;
  ctx.stroke();
  const left = 30 - (time % 30);
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI / 2 + (i / 30) * Math.PI * 2;
    const spent = i >= Math.ceil(left);
    line(ctx, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, x + Math.cos(a) * r * 0.93, y + Math.sin(a) * r * 0.93, spent ? C.edge : C.ink, i % 5 ? 1.2 : 2.6);
  }
  const hand = -Math.PI / 2 + (left / 30) * Math.PI * 2;
  line(ctx, x, y, x + Math.cos(hand) * r * 0.7, y + Math.sin(hand) * r * 0.7, C.red, 2.5);
  disc(ctx, x, y, 4.5, C.brass);
}

function title(ctx, app) {
  for (let i = 0; i < 6; i++) {
    gearPath(ctx, 70 + i * 104, 70 + (i % 2) * 220, 46 + (i % 3) * 14, 11, app.time * (i % 2 ? 0.25 : -0.25));
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fill();
  }
  dial(ctx, W / 2, 118, 64, app.time);
  text(ctx, 'THIRTY TICKS', W / 2, 238, { size: 42, align: 'center', weight: 800, color: C.ink });
  text(ctx, 'Pull the pin, and a district has thirty seconds left to exist.', W / 2, 262, { size: 12.5, align: 'center', color: C.dim });
  if (Math.sin(app.time * 4) > -0.3) text(ctx, 'Press Enter', W / 2, 304, { size: 15, align: 'center', color: C.brass, weight: 700 });
  hint(ctx, 'Arrows / WASD  move      Enter  confirm      X  back      M  sound');
}

function map(ctx, app) {
  const open = openStages(app.campaign, app.stages);
  for (let x = 20; x < W; x += 40) line(ctx, x, 56, x, 268, 'rgba(255,255,255,0.035)');
  for (let y = 56; y <= 268; y += 40) line(ctx, 0, y, W, y, 'rgba(255,255,255,0.035)');
  text(ctx, 'Cogmere', 24, 34, { size: 20, weight: 800, color: C.brass });
  text(ctx, 'Choose a district', 24, 50, { size: 11, color: C.dim });

  const byId = Object.fromEntries(app.stages.map((st) => [st.id, st]));
  for (const st of app.stages) {
    for (const id of st.after) {
      ctx.setLineDash([5, 5]);
      line(ctx, ...byId[id].pin, ...st.pin, open.includes(st.id) ? C.brass : C.edge, 2);
      ctx.setLineDash([]);
    }
  }
  app.stages.forEach((st, i) => {
    const [x, y] = st.pin;
    const best = app.campaign.cleared[st.id];
    const locked = !open.includes(st.id);
    if (i === app.pick) {
      ctx.beginPath();
      ctx.arc(x, y, 19 + Math.sin(app.time * 5) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    gearPath(ctx, x, y, 14, 8, locked ? 0 : app.time * 0.6);
    ctx.fillStyle = locked ? '#2a3b40' : best ? MEDAL[best.medal] : C.red;
    ctx.fill();
    disc(ctx, x, y, 5, C.bg);
    text(ctx, st.name, x, y + 34, { size: 11.5, align: 'center', color: locked ? '#55686d' : C.ink, weight: 600 });
  });

  const st = app.stages[app.pick];
  const best = app.campaign.cleared[st.id];
  box(ctx, 20, 278, 600, 58);
  text(ctx, st.name, 36, 302, { size: 16, weight: 700 });
  if (best) {
    disc(ctx, 42, 318, 5, MEDAL[best.medal]);
    text(ctx, `Best ${seconds(best.elapsed)}   ${best.rewinds} rewinds   reached level ${best.level}`, 54, 322, { size: 11, color: C.dim, mono: true });
  } else {
    text(ctx, 'The pin is still missing.', 36, 322, { size: 11, color: C.red });
  }
  text(ctx, `Par  gold ${st.par[0]}s   silver ${st.par[1]}s   bronze ${st.par[2]}s`, 604, 322, { size: 10.5, color: C.dim, align: 'right', mono: true });
  hint(ctx, 'Left / Right  choose      Enter  go      X  title');
}

function intro(ctx, app) {
  const st = app.session.stage;
  drawField(ctx, app);
  drawHud(ctx, app);
  ctx.fillStyle = 'rgba(5,10,12,0.78)';
  ctx.fillRect(0, HUD, W, H - HUD);
  box(ctx, 110, 108, 420, 168);
  text(ctx, st.name, W / 2, 146, { size: 24, align: 'center', color: C.brass, weight: 800 });
  const end = paragraph(ctx, st.intro, W / 2, 174, 370, { size: 12.5, align: 'center' });
  text(ctx, 'Reach the tower and take the pin back.', W / 2, end + 10, { size: 11.5, align: 'center', color: C.dim });
  if (Math.sin(app.time * 4) > -0.3) text(ctx, 'Enter: start the clock', W / 2, 258, { size: 13, align: 'center', color: C.ink, weight: 700 });
}

function cleared(ctx, app) {
  const s = app.session;
  const r = s.result;
  const best = app.campaign.cleared[s.stage.id];
  box(ctx, 130, 56, 380, 250);
  text(ctx, 'Pin restored', W / 2, 96, { size: 26, align: 'center', color: C.brass, weight: 800 });
  text(ctx, `${s.stage.name} ticks on.`, W / 2, 116, { size: 12, align: 'center', color: C.dim });
  gearPath(ctx, W / 2, 158, 24, 10, app.time * 0.8);
  ctx.fillStyle = MEDAL[r.medal];
  ctx.fill();
  disc(ctx, W / 2, 158, 9, C.panel);
  text(ctx, r.medal === 'none' ? 'no medal' : `${r.medal} medal`, W / 2, 200, { size: 12, align: 'center', color: MEDAL[r.medal], weight: 700 });
  const rows = [
    ['Time on the clock', seconds(r.elapsed)],
    ['Rewinds bought', `${r.rewinds}`],
    ['Level reached', `${r.level}`],
    ['Best run', best.elapsed === r.elapsed ? 'this one' : seconds(best.elapsed)],
  ];
  rows.forEach(([label, value], i) => {
    text(ctx, label, 170, 226 + i * 17, { size: 11.5, color: C.dim });
    text(ctx, value, 470, 226 + i * 17, { size: 11.5, align: 'right', mono: true });
  });
  hint(ctx, 'Enter  back to the map');
}

function unwound(ctx, app) {
  for (let i = 0; i < 9; i++) {
    const drift = (app.time * (10 + i * 3)) % 60;
    gearPath(ctx, 50 + i * 68, 90 + (i % 3) * 70 + drift, 16 + (i % 4) * 5, 8, app.time * 0.5 + i);
    ctx.fillStyle = 'rgba(226,87,74,0.07)';
    ctx.fill();
  }
  box(ctx, 150, 108, 340, 144, { edge: C.red });
  text(ctx, 'Unwound', W / 2, 152, { size: 28, align: 'center', color: C.red, weight: 800 });
  text(ctx, `${app.session.stage.name} ran out of ticks.`, W / 2, 178, { size: 12.5, align: 'center' });
  text(ctx, `You reached level ${app.session.hero.level}.`, W / 2, 198, { size: 11.5, align: 'center', color: C.dim });
  text(ctx, 'Enter  try again        X  map', W / 2, 232, { size: 12.5, align: 'center', color: C.brass, weight: 700 });
}

const SCREENS = { title, map, intro, stage, cleared, unwound };

export function draw(ctx, app, fx) {
  const { width, height } = ctx.canvas;
  const scale = Math.min(width / W, height / H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.void;
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, scale, (width - W * scale) / 2, (height - H * scale) / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  SCREENS[app.screen](ctx, app, fx);
  if (fx.flash) {
    ctx.globalAlpha = 0.35 * (1 - fx.flash.age / fx.flash.life);
    ctx.fillStyle = fx.flash.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
