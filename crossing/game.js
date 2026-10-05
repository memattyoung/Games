// Drawing, controls and screens for Chaos Crossing. The rules live in logic.js.
"use strict";

const TILE = 40;                       // board units per tile
const W = SETTINGS.cols * TILE;
const H = SETTINGS.rows * TILE;
const COLORS = {
  text: "#E8EEF4",
  dim: "#8090A0",
  green: "#7BD65B",
  red: "#F05A4F",
  gold: "#F5C542",
  purple: "#B98AF0",
  orange: "#FFA24C",
  cyan: "#6FE3FF",
  pink: "#FF4FA3",
  fog: "5, 8, 12",
};
const CAR_COLORS = ["#F05A4F", "#4DA3FF", "#F5C542", "#9B7BFF", "#3FD0C9"];
// How Pip looks. Drunk turns Pip purple and reversed turns Pip orange, so it's obvious.
const LOOKS = {
  normal: { body: "#7BD6E8", dark: "#3C93A8" },
  drunk: { body: "#C08CFF", dark: "#6B3FA0" },
  reversed: { body: "#FFB25C", dark: "#B05A14" },
};
const KIND_COLORS = { good: COLORS.green, bad: COLORS.purple };

// The countdown pills above the board, in the order they appear
const EFFECTS = [
  { name: "REVERSED", color: "orange", left: () => game.reversedLeft(), total: () => SETTINGS.effectTime },
  { name: "DRUNK", color: "purple", left: () => game.drunkLeft(), total: () => SETTINGS.effectTime },
  { name: "FOG", color: "grey", left: () => game.fogLeft(), total: () => SETTINGS.fogTime },
  { name: "RUSH HOUR", color: "red", left: () => game.rushLeft(), total: () => SETTINGS.shortEffectTime },
  { name: "SWERVE", color: "red", left: () => game.swerveLeft(), total: () => SETTINGS.shortEffectTime },
  { name: "SINKING", color: "red", left: () => game.sinkLeft(), total: () => SETTINGS.shortEffectTime },
  { name: "WIND", color: "grey", left: () => game.windLeft(), total: () => SETTINGS.windTime },
  { name: "SLOW-MO", color: "cyan", left: () => game.slowLeft(), total: () => SETTINGS.shortEffectTime },
  { name: "FREEZE", color: "cyan", left: () => game.freezeLeft(), total: () => SETTINGS.freezeTime },
  { name: "SUPER HOP", color: "green", left: () => game.superhopLeft(), total: () => SETTINGS.shortEffectTime },
  { name: "SHIELD", color: "cyan", left: () => (game.shield ? 1 : 0), total: () => 1, noTimer: true },
  { name: "ROAD WORK", color: "gold", left: () => game.roadWorkLeft(), total: () => SETTINGS.roadWorkTime },
];

// The sass
const SPLAT_LINES = {
  car: ["SPLAT!", "BEEP BEEP!", "LOOK BOTH WAYS", "PANCAKE'D", "THAT'S A NO", "HONK HONK"],
  demon: ["DEMON'D", "TOLD YOU SO", "ZOOOM. SPLAT."],
  water: ["SPLOOSH", "GLUB GLUB", "PIP CAN'T SWIM", "BLUB?"],
  swept: ["BYE, PIP", "WHEEEE—", "OFF THE MAP"],
  hedge: ["OUCH, HEDGE", "BUSH: 1, YOU: 0", "THAT'S A PLANT"],
  time: ["TOO SLOW", "NAP TIME", "TICK TOCK"],
};
const HOME_LINES = ["HOME!", "SAFE!", "COZY", "NAILED IT", "PIP IS HOME", "SNUG"];
const LEVEL_LINES = ["Traffic is mad now.", "Pip's family is impressed.", "Fine. Do it again, faster.",
  "Who taught you to hop?", "The ducks are getting nervous."];
const TAUNTS = ["Pip trusted you.", "Rage quit? Pip would understand.", "The ducks are laughing at you.",
  "Have you tried not hopping into traffic?", "Somewhere, a car is honking about you.",
  "Pip's insurance doesn't cover this.", "Bold strategy. Pip disagrees."];
const CLASSIC_TAUNTS = ["Even the easy roads got you.", "No tricks. Just bad hopping.", "Classic mode. Classic splat.",
  "That was the gentle version, you know."];

const BORDER = 4;
const POPUP_TIME = 1.0;
const FLASH_TIME = 2;
const HOP_ANIM = 0.12;
const SWIPE_DISTANCE = 24;
const MAX_PARTICLES = 260;
const BEST_KEY = "mjy-crossing-best";
const MODE_KEY = "mjy-crossing-mode";
const KEY_DIRECTIONS = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

const $ = (id) => document.getElementById(id);
const boardWrap = $("board-wrap");
const canvas = $("board");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const playButton = $("play-button");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

let game = null;          // the current CrossingGame
let mode = "start";       // "start", "playing", "paused" or "over"
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" or "classic"
let best = loadBest();
let scale = 1;            // CSS pixels per board unit
let popups = [];
let particles = [];
let banner = null;
let shake = { until: 0, strength: 0 };
let hopAnim = null;       // so a hop looks like a hop: { dx, dy, at }
let lastFrame = performance.now();

// ---------- Small helpers ----------

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

function blend(color1, color2, amount) {
  let mixed = "#";
  for (const i of [1, 3, 5]) {
    const start = parseInt(color1.slice(i, i + 2), 16);
    const end = parseInt(color2.slice(i, i + 2), 16);
    mixed += Math.round(start + (end - start) * amount).toString(16).padStart(2, "0");
  }
  return mixed;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function setText(element, text) {
  text = String(text);
  if (element.textContent !== text) element.textContent = text;
}

function showing(timeLeft, now) {
  // An effect's look flashes on and off during its last couple of seconds
  if (timeLeft <= 0) return false;
  return timeLeft > FLASH_TIME || Math.floor(now / 150) % 2 === 0;
}

function loadSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;  // storage can be blocked, e.g. in private browsing
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // not being able to save isn't worth stopping the game for
  }
}

function bestKey() {
  return gameMode === "classic" ? BEST_KEY + "-classic" : BEST_KEY;
}

function loadBest() {
  return Number(loadSetting(bestKey())) || 0;
}

// ---------- Board size ----------

function resizeCanvas() {
  const rect = boardWrap.getBoundingClientRect();
  scale = Math.max(0.2, Math.min((rect.width - 2 * BORDER) / W, (rect.height - 2 * BORDER) / H));
  const w = Math.floor(W * scale);
  const h = Math.floor(H * scale);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  document.documentElement.style.setProperty("--board-width", Math.max(w + 2 * BORDER, 340) + "px");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = w / W;
}

// ---------- Drawing ----------

function roundedRect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGrass(row) {
  const y = row * TILE;
  ctx.fillStyle = "#2F6B3A";
  ctx.fillRect(0, y, W, TILE);
  ctx.fillStyle = "#357A41";
  for (let col = 0; col < SETTINGS.cols; col += 2) ctx.fillRect(col * TILE, y, TILE, TILE);
  // Little flowers, always in the same spots
  for (let i = 0; i < 6; i++) {
    const fx = ((i * 73 + row * 31) % W) + 6;
    const fy = y + 8 + ((i * 17 + row * 7) % 24);
    ctx.fillStyle = i % 2 ? "#F5C542" : "#FFFFFF";
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBackground(now) {
  // The hedge with the homes in it
  ctx.fillStyle = "#1F4A2A";
  ctx.fillRect(0, 0, W, TILE);
  ctx.fillStyle = "#2A6237";
  for (let x = 10; x < W; x += 22) {
    ctx.beginPath();
    ctx.arc(x, TILE - 6, 14, Math.PI, 0);
    ctx.fill();
  }
  // The river
  const water = ctx.createLinearGradient(0, TILE, 0, 6 * TILE);
  water.addColorStop(0, "#17507A");
  water.addColorStop(1, "#1E6A96");
  ctx.fillStyle = water;
  ctx.fillRect(0, TILE, W, 5 * TILE);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  for (let row = 1; row <= 5; row++) {
    for (let i = 0; i < 4; i++) {
      const x = ((now / 30 + i * 120 + row * 40) % (W + 40)) - 20;
      const y = row * TILE + 12 + (i % 2) * 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8, y - 4, x + 16, y);
      ctx.stroke();
    }
  }
  drawGrass(SETTINGS.medianRow);
  // The road
  ctx.fillStyle = "#2A3038";
  ctx.fillRect(0, 7 * TILE, W, 5 * TILE);
  ctx.strokeStyle = "rgba(201, 209, 219, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 12]);
  for (let row = 8; row <= 11; row++) {
    ctx.beginPath();
    ctx.moveTo(0, row * TILE);
    ctx.lineTo(W, row * TILE);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = "#F5C542";
  ctx.lineWidth = 3;
  for (const y of [7 * TILE + 1.5, 12 * TILE - 1.5]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  drawGrass(SETTINGS.startRow);
}

function drawPip(x, y, look, options = {}) {
  // Pip: a small, anxious blob. x and y are the middle of Pip's tile.
  const { facing = "up", squash = 0, happy = false, split = null, alpha = 1, scale: size = 1 } = options;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(size * (1 + squash * 0.18), size * (1 - squash * 0.18));
  ctx.fillStyle = look.dark;
  ctx.beginPath();
  ctx.ellipse(-6, 12, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.ellipse(6, 12, 4, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const body = () => {
    ctx.beginPath();
    ctx.ellipse(0, 1, 15, 13, 0, 0, Math.PI * 2);
  };
  body();
  ctx.fillStyle = look.body;
  ctx.fill();
  if (split) {
    // Drunk and reversed at once: half purple, half orange
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = split.body;
    ctx.fillRect(0, -14, 16, 30);
    ctx.restore();
  }
  body();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = look.dark;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(-5, -5, 5, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();

  if (happy) {
    // Home and happy: closed eyes and a smile
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-5, -1, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.moveTo(8, -1);
    ctx.arc(5, -1, 3, Math.PI * 1.1, Math.PI * 1.9);
    ctx.moveTo(-4, 5);
    ctx.quadraticCurveTo(0, 9, 4, 5);
    ctx.stroke();
  } else {
    const [lx, ly] = { up: [0, -1.6], down: [0, 1.6], left: [-1.6, 0], right: [1.6, 0] }[facing];
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(side * 5.5, -2, 4.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(side * 5.5 + lx, -2 + ly, 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Worried eyebrows
    ctx.strokeStyle = look.dark;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-9, -8.5);
    ctx.lineTo(-3, -10);
    ctx.moveTo(9, -8.5);
    ctx.lineTo(3, -10);
    ctx.stroke();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-3, 6.5);
    ctx.quadraticCurveTo(0, 5, 3, 6.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHomes() {
  SETTINGS.homeCols.forEach((col, i) => {
    const x = col * TILE;
    ctx.fillStyle = "#0F2414";
    roundedRect(x + 3, 4, TILE - 6, TILE - 4, 14);
    ctx.fill();
    ctx.fillStyle = "#5A3A1E";
    ctx.fillRect(x + 8, TILE - 6, TILE - 16, 4);
    if (game.homes[i]) {
      drawPip(x + TILE / 2, TILE / 2 + 2, LOOKS.normal, { happy: true, scale: 0.85 });
    }
  });
}

function drawLog(o, y, sinking, sunk) {
  const x = o.x * TILE;
  const w = o.len * TILE;
  ctx.globalAlpha = sunk ? 0.22 : sinking ? 0.75 : 1;
  roundedRect(x + 2, y + 6, w - 4, TILE - 12, 12);
  ctx.fillStyle = "#8A5A2E";
  ctx.fill();
  ctx.strokeStyle = "#5C3A1C";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(60, 35, 15, 0.6)";
  ctx.lineWidth = 1.2;
  for (let i = 1; i < o.len * 2; i++) {
    const lx = x + (i * w) / (o.len * 2);
    ctx.beginPath();
    ctx.moveTo(lx - 6, y + 12);
    ctx.lineTo(lx + 6, y + 12);
    ctx.moveTo(lx - 3, y + TILE - 13);
    ctx.lineTo(lx + 8, y + TILE - 13);
    ctx.stroke();
  }
  ctx.fillStyle = "#C08A55";
  ctx.beginPath();
  ctx.ellipse(x + w - 8, y + TILE / 2, 5, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8A5A2E";
  ctx.beginPath();
  ctx.ellipse(x + w - 8, y + TILE / 2, 2.5, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDucks(o, y, dir, sinking, sunk, now) {
  // A floating line of rubber ducks
  ctx.globalAlpha = sunk ? 0.22 : sinking ? 0.75 : 1;
  for (let i = 0; i < o.len; i++) {
    const cx = (o.x + i + 0.5) * TILE;
    const cy = y + TILE / 2 + Math.sin(now / 300 + i) * 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6, 16, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#F5C542";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + dir * 7, cy - 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FF8A3D";
    ctx.beginPath();
    ctx.moveTo(cx + dir * 13, cy - 7);
    ctx.lineTo(cx + dir * 19, cy - 5);
    ctx.lineTo(cx + dir * 13, cy - 3);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx + dir * 9, cy - 8, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBubbles(o, y, now) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  for (let i = 0; i < o.len * 2; i++) {
    const bx = (o.x + (i + 0.5) / 2) * TILE + Math.sin(now / 90 + i) * 3;
    const by = y + TILE / 2 + Math.cos(now / 120 + i * 2) * 8;
    ctx.beginPath();
    ctx.arc(bx, by, 2 + (i % 2), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVehicle(o, y, dir, demon = false) {
  const x = o.x * TILE;
  const w = (demon ? 1.5 : o.len) * TILE;
  const color = demon ? "#FF2E2E" : CAR_COLORS[o.color % CAR_COLORS.length];
  const top = y + 7;
  const height = TILE - 14;
  const front = dir > 0 ? x + w - 6 : x + 6;

  if (o.kind === "truck" && !demon) {
    // Cab at the front, a big box behind it
    const cabW = TILE * 0.62;
    const cabX = dir > 0 ? x + w - cabW - 2 : x + 2;
    const boxX = dir > 0 ? x + 2 : x + cabW + 4;
    roundedRect(boxX, top - 1, w - cabW - 6, height + 2, 4);
    ctx.fillStyle = "#D9DEE5";
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(boxX + 4, top + height / 2 - 2, w - cabW - 14, 4);
    roundedRect(cabX, top + 2, cabW, height - 4, 5);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "rgba(20, 30, 40, 0.6)";
    ctx.fillRect(dir > 0 ? cabX + cabW - 10 : cabX + 4, top + 5, 6, height - 10);
  } else {
    roundedRect(x + 3, top, w - 6, height, 8);
    ctx.fillStyle = color;
    ctx.fill();
    // Windscreen and roof
    ctx.fillStyle = "rgba(20, 30, 40, 0.55)";
    const glassX = dir > 0 ? x + w - 18 : x + 10;
    ctx.fillRect(glassX, top + 4, 8, height - 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    roundedRect(x + w / 2 - (w - 26) / 2, top + 5, w - 26, height - 10, 4);
    ctx.fill();
    if (o.kind === "van") {
      ctx.fillStyle = "rgba(20, 30, 40, 0.45)";
      for (let wx = x + 14; wx < x + w - 22; wx += 14) ctx.fillRect(wx, top + 3, 8, 4);
    }
  }
  // Wheels
  ctx.fillStyle = "#111";
  for (const wx of [x + 9, x + w - 15]) {
    ctx.fillRect(wx, top - 3, 7, 3);
    ctx.fillRect(wx, top + height, 7, 3);
  }
  // Headlights
  ctx.fillStyle = "#FFF2B8";
  ctx.fillRect(front - 2, top + 3, 3, 4);
  ctx.fillRect(front - 2, top + height - 7, 3, 4);
  if (demon) {
    // Flames out the back
    const back = dir > 0 ? x : x + w;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ["#FFE14D", "#FF8A3D", "#F05A4F"][i];
      ctx.beginPath();
      ctx.moveTo(back, top + 4 + i * 5);
      ctx.lineTo(back - dir * (14 + Math.random() * 10), top + 6 + i * 5);
      ctx.lineTo(back, top + 8 + i * 5);
      ctx.fill();
    }
  }
}

function drawCone(c) {
  const x = c.col * TILE + TILE / 2;
  const y = c.row * TILE;
  ctx.fillStyle = "#4E5763";
  ctx.fillRect(x - 12, y + TILE - 9, 24, 4);
  ctx.fillStyle = "#FF8A3D";
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x + 10, y + TILE - 9);
  ctx.lineTo(x - 10, y + TILE - 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x - 6, y + 20, 12, 4);
}

function drawBox(c, x, y, size, kind, now) {
  // A gift box. On the board every one is the mystery kind.
  const s = size / 18;
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const body = kind === "mystery" ? "#FFFFFF" : KIND_COLORS[kind];
  c.fillStyle = body;
  c.fillRect(-8, -5, 16, 13);
  c.fillStyle = kind === "mystery" ? "#E6EAF0" : blend(KIND_COLORS[kind], "#000000", 0.15);
  c.fillRect(-9, -8, 18, 4);
  c.fillStyle = kind === "mystery" ? COLORS.pink : "#0D131A";
  c.fillRect(-1.5, -8, 3, 16);
  c.beginPath();
  c.ellipse(-3.5, -9.5, 3.5, 2, -0.5, 0, Math.PI * 2);
  c.ellipse(3.5, -9.5, 3.5, 2, 0.5, 0, Math.PI * 2);
  c.fill();
  c.font = '900 9px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = kind === "mystery" ? COLORS.pink : "#0D131A";
  c.fillText(kind === "mystery" ? "?" : kind === "good" ? "+" : "!", -4.5, 2.5);
  c.restore();
}

function drawPickups(now) {
  for (const p of game.pickups) {
    const timeLeft = p.until - game.time;
    if (timeLeft < 2 && Math.floor(now / 120) % 2 === 0) continue;  // blinks before it vanishes
    const x = (p.col + 0.5) * TILE;
    const y = (p.row + 0.5) * TILE + Math.sin(now / 200 + p.col) * 2;
    const glow = ctx.createRadialGradient(x, y, 3, x, y, 24);
    glow.addColorStop(0, "rgba(255, 79, 163, 0.5)");
    glow.addColorStop(1, "rgba(255, 79, 163, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 24, y - 24, 48, 48);
    drawBox(ctx, x, y + 1, 26, "mystery", now);
  }
}

function drawDemonWarning(now) {
  const demon = game.demon;
  if (!demon || demon.x !== null) return;
  if (Math.floor(now / 140) % 2 === 0) return;
  const y = demon.row * TILE;
  ctx.fillStyle = "rgba(240, 90, 79, 0.25)";
  ctx.fillRect(0, y, W, TILE);
  const x = demon.dir > 0 ? 18 : W - 18;
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.moveTo(x, y + 7);
  ctx.lineTo(x + 13, y + TILE - 7);
  ctx.lineTo(x - 13, y + TILE - 7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '900 18px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", x, y + TILE / 2 + 3);
}

function lookOf(now) {
  const drunk = showing(game.drunkLeft(), now);
  const reversed = showing(game.reversedLeft(), now);
  if (drunk && reversed) return { look: LOOKS.drunk, split: LOOKS.reversed };
  return { look: drunk ? LOOKS.drunk : reversed ? LOOKS.reversed : LOOKS.normal, split: null };
}

function drawHero(now) {
  const hero = game.hero;
  let x = hero.cx * TILE;
  let y = (hero.row + 0.5) * TILE;
  const { look, split } = lookOf(now);

  if (hero.dead) {
    const age = clamp((game.time - (hero.respawnAt - SETTINGS.respawnDelay)) / SETTINGS.respawnDelay, 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - age * 0.6;
    if (hero.cause === "water" || hero.cause === "swept") {
      // Ripples where Pip went under
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x, y + 4, 6 + (age * 24 + i * 7), 3 + (age * 8 + i * 2), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // A cartoon splat, with dazed X eyes
      ctx.fillStyle = look.body;
      ctx.beginPath();
      ctx.ellipse(x, y + 6, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const [dx, dy] of [[-18, -2], [17, 0], [-8, 10], [10, 9]]) {
        ctx.beginPath();
        ctx.arc(x + dx, y + 6 + dy * 0.5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.8;
      for (const side of [-1, 1]) {
        const ex = x + side * 6;
        ctx.beginPath();
        ctx.moveTo(ex - 3, y + 1);
        ctx.lineTo(ex + 3, y + 6);
        ctx.moveTo(ex + 3, y + 1);
        ctx.lineTo(ex - 3, y + 6);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  // A hop: slide from where Pip was, with a little bounce
  let squash = 0;
  if (hopAnim) {
    const progress = (now - hopAnim.at) / (HOP_ANIM * 1000);
    if (progress < 1) {
      x -= hopAnim.dx * (1 - progress);
      y -= hopAnim.dy * (1 - progress);
      y -= Math.sin(progress * Math.PI) * 9;
      squash = -Math.sin(progress * Math.PI);
    } else {
      hopAnim = null;
    }
  }
  if (game.time < game.safeUntil && Math.floor(now / 100) % 2 === 0) return;  // blinking after a save

  if (showing(game.superhopLeft(), now)) {
    // Springs on Pip's feet
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 6 - 3, y + 14);
      for (let i = 0; i < 4; i++) ctx.lineTo(x + side * 6 + (i % 2 ? 3 : -3), y + 16 + i * 2);
      ctx.stroke();
    }
  }
  const lean = game.windLeft() > 0 ? game.windDir * 0.18 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean + (game.drunkLeft() > 0 ? Math.sin(now / 110) * 0.15 : 0));
  drawPip(0, 0, look, { facing: hero.facing, squash, split });
  ctx.restore();

  if (game.timeLeft < 8 && Math.floor(now / 400) % 2 === 0) {
    // Nervous sweat
    ctx.fillStyle = "#9FD8FF";
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 14);
    ctx.quadraticCurveTo(x + 19, y - 6, x + 14, y - 5);
    ctx.quadraticCurveTo(x + 9, y - 6, x + 14, y - 14);
    ctx.fill();
  }
  if (game.shield) {
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.65 + 0.3 * Math.sin(now / 150);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y + 1, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(111, 227, 255, 0.12)";
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawWind(now) {
  if (game.windLeft() <= 0) return;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const speed = 0.35 + (i % 3) * 0.1;
    let x = ((now * speed + i * 97) % (W + 80)) - 40;
    if (game.windDir < 0) x = W - x;
    const y = ((i * 53) % (H - 40)) + 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - game.windDir * 28, y);
    ctx.stroke();
  }
}

function drawFog() {
  const timeLeft = game.fogLeft();
  if (timeLeft <= 0) return;
  const strength = Math.min(1, timeLeft / 0.4) * 0.96;
  const x = game.hero.cx * TILE;
  const y = (game.hero.row + 0.5) * TILE;
  const radius = SETTINGS.fogRadius * TILE;
  const fog = ctx.createRadialGradient(x, y, radius * 0.55, x, y, radius);
  fog.addColorStop(0, `rgba(${COLORS.fog}, 0)`);
  fog.addColorStop(1, `rgba(${COLORS.fog}, ${strength})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, H);
}

function burst(x, y, color, count, speed = 220) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power - 100,
      size: 3 + Math.random() * 4, color, life: 0.45 + Math.random() * 0.4 });
  }
}

function drawParticles(dt) {
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.vy += 700 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life / 0.35);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawPopups(now) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  popups = popups.filter((popup) => now - popup.born < POPUP_TIME * 1000);
  for (const popup of popups) {
    const progress = (now - popup.born) / (POPUP_TIME * 1000);
    const pop = progress < 0.12 ? 0.7 + progress * 2.5 : 1;
    ctx.font = `900 ${Math.round((popup.size || 18) * pop)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const y = popup.y - (popup.row || 0) * 20 - 40 * progress;
    ctx.globalAlpha = 1 - progress * progress;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#0D131A";
    ctx.strokeText(popup.text, popup.x, y);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, y);
  }
  ctx.globalAlpha = 1;
}

function drawBanner(now) {
  if (!banner) return;
  const age = (now - banner.born) / 1800;
  if (age >= 1) {
    banner = null;
    return;
  }
  ctx.globalAlpha = age < 0.75 ? 1 : 1 - (age - 0.75) / 0.25;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 56px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#0D131A";
  ctx.strokeText(banner.title, W / 2, H / 2 - 18);
  ctx.fillStyle = COLORS.green;
  ctx.fillText(banner.title, W / 2, H / 2 - 18);
  ctx.font = '800 20px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeText(banner.line, W / 2, H / 2 + 26);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(banner.line, W / 2, H / 2 + 26);
  ctx.globalAlpha = 1;
}

function draw(now, dt) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (now < shake.until) {
    const s = shake.strength * ((shake.until - now) / 400);
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(now);
  drawHomes();
  const visible = (o) => o.x + o.len >= -0.5 && o.x <= SETTINGS.cols + 0.5;
  for (const lane of game.lanes.filter((l) => !l.road)) {
    const y = lane.row * TILE;
    for (const o of lane.objects.filter(visible)) {
      const sunk = game.sunk(o);
      const sinking = game.sinkingSoon(o);
      if (o.kind === "log") drawLog(o, y, sinking, sunk);
      else drawDucks(o, y, lane.dir, sinking, sunk, now);
      if (sinking) drawBubbles(o, y, now);
    }
  }
  for (const cone of game.cones) drawCone(cone);
  drawPickups(now);  // under the traffic, so cars drive over the boxes
  for (const lane of game.lanes.filter((l) => l.road)) {
    for (const o of lane.objects.filter(visible)) drawVehicle(o, lane.row * TILE, lane.dir);
  }
  drawDemonWarning(now);
  if (game.demon && game.demon.x !== null) {
    drawVehicle({ x: game.demon.x, len: 1.5, kind: "car", color: 0 }, game.demon.row * TILE, game.demon.dir, true);
  }
  drawHero(now);
  drawParticles(dt);
  drawWind(now);
  drawFog();
  drawPopups(now);
  drawBanner(now);
  ctx.restore();
}

function paintIcon(iconCanvas, kind) {
  const dpr = window.devicePixelRatio || 1;
  iconCanvas.width = 18 * dpr;
  iconCanvas.height = 18 * dpr;
  const c = iconCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, 18, 18);
  drawBox(c, 9, 10, 16, kind, 0);
}

// ---------- Scoreboard ----------

const hud = {
  score: $("score"),
  level: $("level"),
  lives: $("lives"),
  timeLabel: $("time-label"),
  timeFill: $("time-fill"),
  lastBox: $("last-box"),
  lastBoxIcon: $("last-box-icon"),
  lastBoxText: $("last-box-text"),
  effects: $("effects"),
};

for (const effect of EFFECTS) {
  effect.pill = document.createElement("span");
  effect.pill.className = `pill pill-${effect.color}`;
  effect.pill.hidden = true;
  effect.pill.innerHTML = '<span class="pill-fill"></span><span class="pill-text"></span>';
  hud.effects.appendChild(effect.pill);
}

function updateHud() {
  setText(hud.score, game.score);
  setText(hud.level, game.level);
  setText(hud.lives, "♥".repeat(Math.max(0, game.lives)) || "—");

  const left = game.timeLeft / game.crossingTime();
  const hurry = game.timeLeft < 8;
  setText(hud.timeLabel, hurry ? "TIME!!" : "TIME");
  hud.timeLabel.classList.toggle("danger", hurry);
  hud.timeFill.style.width = (clamp(left, 0, 1) * 100).toFixed(1) + "%";
  hud.timeFill.style.background = left > 0.5
    ? blend(COLORS.gold, COLORS.green, (left - 0.5) * 2)
    : blend(COLORS.red, COLORS.gold, left * 2);

  for (const effect of EFFECTS) {
    const timeLeft = effect.left();
    effect.pill.hidden = timeLeft <= 0;
    if (timeLeft <= 0) continue;
    effect.pill.firstChild.style.width = ((timeLeft / effect.total()) * 100).toFixed(1) + "%";
    setText(effect.pill.lastChild, effect.noTimer ? effect.name : `${effect.name}  ${timeLeft.toFixed(1)}s`);
  }
}

function showLastBox(kind, text) {
  paintIcon(hud.lastBoxIcon, kind);
  setText(hud.lastBoxText, text);
  hud.lastBoxText.style.color = KIND_COLORS[kind];
  hud.lastBox.classList.remove("empty");
}

// ---------- Screens ----------

function showOverlay(kind) {
  overlay.hidden = false;
  overlay.classList.toggle("over", kind === "over");
  const keyHint = isTouch ? "" : "or press Space";
  setText($("overlay-eyebrow"), kind === "start" ? "MATT YOUNG PRESENTS" : "");
  setText($("overlay-taunt"), "");
  $("modes").hidden = kind === "paused";  // the mode can only change between games
  $("menu-link").hidden = kind === "paused";

  if (kind === "start") {
    setText($("overlay-title"), "CHAOS CROSSING");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic"
      ? "Just roads and rivers. Pip still can't swim, though."
      : "Pip just wants to get home. Traffic has other plans.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Swipe or tap to hop. The arrows work too." : "or press Space");
  } else if (kind === "paused") {
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "Pip is hiding behind a bush. Take your time.");
    setText($("overlay-stats"), `Score ${game.score}  ·  Level ${game.level}`);
    setText(playButton, "Resume");
    setText($("overlay-hint"), keyHint);
  } else {
    const newBest = game.score > best;
    if (newBest) {
      best = game.score;
      saveSetting(bestKey(), best);
    }
    setText($("overlay-title"), "GAME OVER");
    setText($("overlay-reason"), game.over);
    setText($("overlay-stats"),
      `Score ${game.score}  ·  Level ${game.level}  ·  ` + (newBest ? "New best!" : `Best ${best}`));
    let taunt = newBest ? "Don't let it go to your head." : pick(game.classic ? CLASSIC_TAUNTS : TAUNTS);
    taunt += `  Homes: ${game.homesFilled}.`;
    if (!game.classic) taunt += ` Boxes: ${game.grabbed.good} good, ${game.grabbed.bad} bad.`;
    setText($("overlay-taunt"), taunt);
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  game = new CrossingGame({ classic: gameMode === "classic" });
  popups = [];
  particles = [];
  banner = null;
  hopAnim = null;
  hud.lastBox.classList.add("empty");
}

function setMode(newMode) {
  gameMode = newMode;
  saveSetting(MODE_KEY, newMode);
  best = loadBest();
  document.body.classList.toggle("classic", newMode === "classic");
  for (const button of document.querySelectorAll(".mode")) {
    button.setAttribute("aria-checked", String(button.dataset.mode === newMode));
  }
  if (mode === "start") {
    newGame();
    showOverlay("start");
  }
}

function startGame() {
  newGame();
  mode = "playing";
  overlay.hidden = true;
  playButton.blur();
}

function pause() {
  if (mode !== "playing") return;
  mode = "paused";
  showOverlay("paused");
}

function resume() {
  if (mode !== "paused") return;
  mode = "playing";
  overlay.hidden = true;
  playButton.blur();
}

function primaryAction() {
  if (mode === "paused") resume();
  else if (mode === "start" || mode === "over") startGame();
}

function addPopup(x, y, text, color, options = {}) {
  popups.push({ x: clamp(x, 60, W - 60), y, text, color, born: performance.now(), ...options });
}

function shakeScreen(strength) {
  shake = { until: performance.now() + 400, strength };
}

function handleEvents() {
  const now = performance.now();
  for (const event of game.events) {
    switch (event.type) {
      case "hop": {
        hopAnim = { dx: (event.to.cx - event.from.cx) * TILE, dy: (event.to.row - event.from.row) * TILE, at: now };
        burst(event.from.cx * TILE, (event.from.row + 0.9) * TILE, "rgba(255, 255, 255, 0.5)", 2, 60);
        break;
      }
      case "bump":
        addPopup(event.cx * TILE, event.row * TILE, "NOPE", COLORS.dim, { size: 16 });
        shakeScreen(3);
        break;
      case "splat": {
        const x = event.cx * TILE;
        const y = (event.row + 0.5) * TILE;
        const wet = event.cause === "water" || event.cause === "swept";
        burst(x, y, wet ? "#9FD8FF" : event.cause === "hedge" ? "#3E9B3A" : LOOKS.normal.body, 16, 240);
        addPopup(x, y - 6, pick(SPLAT_LINES[event.cause]), COLORS.red, { size: 22 });
        shakeScreen(event.cause === "demon" ? 18 : 10);
        break;
      }
      case "home": {
        const x = (event.col + 0.5) * TILE;
        burst(x, TILE / 2, COLORS.gold, 24, 260);
        burst(x, TILE / 2, COLORS.green, 12, 200);
        addPopup(x, TILE + 16, pick(HOME_LINES), COLORS.green, { size: 22 });
        addPopup(x, TILE + 40, `+${event.points}`, COLORS.gold, { size: 16 });
        break;
      }
      case "level":
        banner = { title: `LEVEL ${event.level}`, line: pick(LEVEL_LINES), born: now };
        burst(W / 2, H / 2, COLORS.gold, 50, 380);
        break;
      case "pickup":
        showLastBox(event.kind, event.text);
        addPopup(event.cx * TILE, event.row * TILE, event.popup, KIND_COLORS[event.kind], { size: 22 });
        burst(event.cx * TILE, (event.row + 0.5) * TILE, KIND_COLORS[event.kind], 14, 200);
        break;
      case "saved":
        addPopup(event.cx * TILE, event.row * TILE, "SAVED! BACK YOU GO", COLORS.cyan, { size: 18 });
        burst(event.cx * TILE, (event.row + 0.5) * TILE, COLORS.cyan, 18, 220);
        break;
      case "swerve":
        addPopup(event.x * TILE, event.row * TILE, "SWERVE!", COLORS.orange, { size: 15 });
        break;
      case "roadWork":
        addPopup(W / 2, event.row * TILE + 6, "ROAD WORK! LANE CLOSED", COLORS.gold, { size: 18 });
        break;
      case "roadWorkDone":
        addPopup(W / 2, 9 * TILE, "LANE REOPENED. HAVE FUN.", COLORS.dim, { size: 15 });
        break;
      case "demonWarning":
        addPopup(W / 2, event.row * TILE + 4, "SPEED DEMON INCOMING!", COLORS.red, { size: 18 });
        break;
      case "demon":
        shakeScreen(5);
        break;
      case "over":
        mode = "over";
        showOverlay("over");
        break;
    }
  }
  game.events = [];
}

// ---------- Controls ----------

document.addEventListener("keydown", (event) => {
  const direction = KEY_DIRECTIONS[event.code];
  if (direction) {
    if (mode === "playing") {
      event.preventDefault();  // stop the arrow keys scrolling the page
      if (!event.repeat) game.press(direction);
    }
    return;
  }
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (!event.repeat) primaryAction();
  } else if (event.code === "KeyP" || event.code === "Escape") {
    if (mode === "playing") pause();
    else resume();
  }
});

// Swipe on the board to hop. A quick tap hops forward.
let swipe = null;
boardWrap.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".panel")) return;  // let the buttons on the overlay work normally
  swipe = { x: event.clientX, y: event.clientY, at: performance.now(), swiped: false };
});
boardWrap.addEventListener("pointermove", (event) => {
  if (!swipe || mode !== "playing") return;
  const dx = event.clientX - swipe.x;
  const dy = event.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
  if (Math.abs(dx) > Math.abs(dy)) game.press(dx > 0 ? "right" : "left");
  else game.press(dy > 0 ? "down" : "up");
  swipe = { x: event.clientX, y: event.clientY, at: swipe.at, swiped: true };
});
boardWrap.addEventListener("pointerup", (event) => {
  if (!swipe) return;
  const moved = Math.hypot(event.clientX - swipe.x, event.clientY - swipe.y);
  if (!swipe.swiped && moved < 12 && performance.now() - swipe.at < 300 && mode === "playing") game.press("up");
  swipe = null;
});
boardWrap.addEventListener("pointercancel", () => (swipe = null));

for (const button of document.querySelectorAll(".dpad [data-dir]")) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.classList.add("pressed");
    if (mode === "playing") game.press(button.dataset.dir);
  });
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(type, () => button.classList.remove("pressed"));
  }
}

$("pause-button").addEventListener("click", () => {
  if (mode === "playing") pause();
  else resume();
});
playButton.addEventListener("click", primaryAction);
for (const button of document.querySelectorAll(".mode")) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", pause);

new ResizeObserver(() => resizeCanvas()).observe(boardWrap);

// ---------- Start up ----------

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (mode === "playing") {
    game.update(dt);
    handleEvents();
  }
  updateHud();
  draw(now, mode === "playing" ? dt : 0);
  requestAnimationFrame(frame);
}

for (const element of document.querySelectorAll("[data-setting]")) {
  const name = element.dataset.setting;
  element.textContent = name === "homeCount" ? SETTINGS.homeCols.length : SETTINGS[name];
}
for (const icon of document.querySelectorAll("canvas[data-box]")) {
  paintIcon(icon, icon.dataset.box);
}

resizeCanvas();
setMode(gameMode);
requestAnimationFrame(frame);
