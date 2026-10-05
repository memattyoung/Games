// Drawing, controls and screens for Chaos Swarm. The rules live in logic.js.
"use strict";

const COLORS = {
  spaceTop: "#0B1220",
  spaceBottom: "#151E2B",
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
// The three kinds of alien, top row to bottom. All original critters, no relation to anyone famous.
const ALIEN_COLORS = {
  grump: { body: "#FF4FA3", dark: "#B02A6E" },
  sneer: { body: "#3FD0C9", dark: "#1F8A85" },
  goober: { body: "#9BE86F", dark: "#4E9B33" },
};
// How the ship looks. Drunk turns it purple and reversed turns it orange, so it's obvious.
const LOOKS = {
  normal: { light: "#9BE86F", dark: "#3E9B3A" },
  drunk: { light: "#C99CFF", dark: "#6B3FA0" },
  reversed: { light: "#FFBE6E", dark: "#B05A14" },
};
const KIND_COLORS = { good: COLORS.green, bad: COLORS.purple };

// The countdown pills above the board, in the order they appear
const EFFECTS = [
  { name: "REVERSED", color: "orange", left: () => game.reversedLeft(), total: () => SETTINGS.effectTime },
  { name: "DRUNK", color: "purple", left: () => game.drunkLeft(), total: () => SETTINGS.effectTime },
  { name: "JAMMED", color: "red", left: () => game.jammedLeft(), total: () => SETTINGS.effectTime },
  { name: "FOG", color: "grey", left: () => game.fogLeft(), total: () => SETTINGS.fogTime },
  { name: "ZOOM", color: "red", left: () => game.speedUpLeft(), total: () => SETTINGS.effectTime },
  { name: "BOOMERANG", color: "orange", left: () => game.boomerangLeft(), total: () => SETTINGS.effectTime },
  { name: "DODGY", color: "grey", left: () => game.dodgeLeft(), total: () => SETTINGS.dodgeTime },
  { name: "SPREAD", color: "green", left: () => game.spreadLeft(), total: () => SETTINGS.effectTime },
  { name: "RAPID", color: "green", left: () => game.rapidLeft(), total: () => SETTINGS.effectTime },
  { name: "PIERCE", color: "cyan", left: () => game.pierceLeft(), total: () => SETTINGS.effectTime },
  { name: "SLOW-MO", color: "cyan", left: () => game.slowLeft(), total: () => SETTINGS.effectTime },
  { name: "SHIELD", color: "cyan", left: () => (game.shield ? 1 : 0), total: () => 1, noTimer: true },
  { name: "COMBO", color: "gold", left: () => (game.multiplier() >= 2 ? 1 : 0), total: () => 1,
    noTimer: true, label: () => `×${game.multiplier()} · ${game.combo} IN A ROW` },
];

// The sass
const OOPS = ["OUCH", "YIKES", "SKILL ISSUE", "BRUH", "REALLY?", "BONK", "WOW."];
const DODGES = ["NOPE", "MISSED ME", "TOO SLOW", "LOL", "NICE TRY", "NOT TODAY"];
const DIVES = ["INCOMING!", "HE'S BRAVE", "HERE HE COMES", "KAMIKAZE!"];
const WAVE_LINES = ["They're sending more. Rude.", "Okay, show-off.", "The swarm called for backup.",
  "Beginner's luck, probably.", "They're mad now.", "Fine. That was decent."];
const TAUNTS = ["The swarm sends its regards.", "Space is hard. You made it look harder.",
  "Rage quit? We'd understand.", "The aliens are writing a song about you. It's not flattering.",
  "Bold strategy, standing still.", "They didn't even need the boss."];
const CLASSIC_TAUNTS = ["Even the plain version got you.", "Classic mode. Classic mistakes.",
  "No tricks. Just bullets. And you still lost."];
const COMBO_LINES = { 2: "×2 NICE", 3: "×3 SPICY", 4: "×4 SHOW-OFF", 5: "×5 OKAY, CALM DOWN" };

const BORDER = 4;          // the board's border width in style.css
const POPUP_TIME = 1.0;
const FLASH_TIME = 2;      // effects flash on and off for their last 2 seconds
const MAX_PARTICLES = 360;
const BEST_KEY = "mjy-swarm-best";
const MODE_KEY = "mjy-swarm-mode";
const W = SETTINGS.width;
const H = SETTINGS.height;

const $ = (id) => document.getElementById(id);
const boardWrap = $("board-wrap");
const canvas = $("board");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const playButton = $("play-button");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

let game = null;          // the current SwarmGame
let mode = "start";       // "start", "playing", "paused" or "over"
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" or "classic"
let best = loadBest();
let scale = 1;            // CSS pixels per board unit
let popups = [];
let particles = [];
let banner = null;        // the big "WAVE 2" message
let shake = { until: 0, strength: 0 };
let stepBounce = 0;       // the swarm hops a little every time it steps
let lastMultiplier = 1;
const keys = { left: false, right: false, fire: false };
let mouseDown = false;
let pointerX = null;      // where your mouse or finger is, in board units (null when using keys)
let lastFrame = performance.now();

// A sky full of stars, made once
const STARS = Array.from({ length: 90 }, () => ({
  x: Math.random() * W, y: Math.random() * H, size: Math.random() * 1.6 + 0.4, twinkle: Math.random() * 6,
}));

// ---------- Small helpers ----------

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

function blend(color1, color2, amount) {
  // Mix two "#rrggbb" colors. An amount of 0 gives color1, 1 gives color2.
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
  // Only touch the page when something actually changed
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

// Each mode keeps its own best score
function bestKey() {
  return gameMode === "classic" ? BEST_KEY + "-classic" : BEST_KEY;
}

function loadBest() {
  return Number(loadSetting(bestKey())) || 0;
}

// ---------- Board size ----------

function resizeCanvas() {
  // The board is always 600 x 800 units, scaled to fit the space it has
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

function toBoardX(clientX) {
  const rect = canvas.getBoundingClientRect();
  return (clientX - rect.left - BORDER) / scale;
}

// ---------- Drawing ----------

function roundedRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawBackground(now) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, COLORS.spaceTop);
  sky.addColorStop(1, COLORS.spaceBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (const star of STARS) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 700 + star.twinkle);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(star.x, (star.y + now / 60) % H, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  // The line the swarm must never reach
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "rgba(240, 90, 79, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, SETTINGS.landingY);
  ctx.lineTo(W, SETTINGS.landingY);
  ctx.stroke();
  ctx.restore();
}

function drawEyes(cx, cy, spacing, size, lookX, lookY, lids) {
  for (const side of [-1, 1]) {
    const ex = cx + side * spacing;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(ex, cy, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(ex + lookX * size * 0.4, cy + lookY * size * 0.4, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    if (lids) {
      // Half-closed lids: smug
      ctx.fillStyle = lids;
      ctx.beginPath();
      ctx.arc(ex, cy, size + 0.5, Math.PI, 0);
      ctx.fill();
    }
  }
}

function drawAlien(alien, now) {
  const colors = ALIEN_COLORS[alien.type];
  const cx = alien.x + alien.w / 2;
  const cy = alien.y + alien.h / 2;
  const wobble = Math.sin(now / 180 + alien.col * 0.8 + alien.row);
  const squash = 1 + 0.06 * wobble + stepBounce * 0.08;
  // Look at the ship, because they're watching you
  const lookX = clamp((game.ship.x - cx) / 200, -1, 1);
  const lookY = 0.6;

  ctx.save();
  ctx.translate(cx, cy);
  if (alien.dive) ctx.rotate(clamp((game.ship.x - cx) / 300, -0.5, 0.5));
  ctx.scale(1 / squash, squash);

  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
  glow.addColorStop(0, colors.body + "55");
  glow.addColorStop(1, colors.body + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(-32, -32, 64, 64);

  ctx.fillStyle = colors.body;
  ctx.strokeStyle = colors.dark;
  ctx.lineWidth = 2;
  if (alien.type === "grump") {
    // A spiky round grump with one big angry eye
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(-14, -8);
    ctx.lineTo(-10, -16);
    ctx.lineTo(-6, -9);
    ctx.lineTo(0, -18);
    ctx.lineTo(6, -9);
    ctx.lineTo(10, -16);
    ctx.lineTo(14, -8);
    ctx.lineTo(16, 4);
    ctx.quadraticCurveTo(16, 14, 0, 14);
    ctx.quadraticCurveTo(-16, 14, -16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(lookX * 2.5, 1.5, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3A0F25";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-8, -9);
    ctx.lineTo(7, -5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 10);
    ctx.quadraticCurveTo(0, 7, 5, 10);
    ctx.stroke();
  } else if (alien.type === "sneer") {
    // A smug jelly with little horns
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(-13, -17);
    ctx.lineTo(-5, -13);
    ctx.moveTo(10, -10);
    ctx.lineTo(13, -17);
    ctx.lineTo(5, -13);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 13, 0, Math.PI, 0);
    ctx.lineTo(18, 9);
    ctx.quadraticCurveTo(0, 15, -18, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawEyes(0, -2, 7, 4.2, lookX, lookY, colors.body);
    ctx.strokeStyle = "#0E3A38";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 6);
    ctx.quadraticCurveTo(2, 11, 8, 4);
    ctx.stroke();
  } else {
    // A droopy goober with googly eyes and its tongue out
    ctx.beginPath();
    ctx.moveTo(-17, 2);
    ctx.quadraticCurveTo(-17, -14, 0, -14);
    ctx.quadraticCurveTo(17, -14, 17, 2);
    ctx.lineTo(17, 8);
    for (const dx of [12, 4, -4, -12]) {
      ctx.quadraticCurveTo(dx + 2, 18 + Math.sin(now / 160 + dx) * 2, dx - 2, 8);
    }
    ctx.lineTo(-17, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawEyes(0, -3, 7, 4.6, lookX * 1.2, Math.sin(now / 300 + alien.col), null);
    ctx.fillStyle = "#FF6B9A";
    roundedRect(ctx, 1, 5, 6, 7, 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawBoss(now) {
  const boss = game.boss;
  if (!boss) return;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const rainbow = ctx.createLinearGradient(-45, 0, 45, 0);
  const shift = (now / 6) % 360;
  for (let i = 0; i <= 5; i++) rainbow.addColorStop(i / 5, `hsl(${(shift + i * 60) % 360}, 90%, 62%)`);
  const glow = ctx.createRadialGradient(0, 0, 10, 0, 0, 70);
  glow.addColorStop(0, "rgba(255, 240, 180, 0.4)");
  glow.addColorStop(1, "rgba(255, 240, 180, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(-75, -75, 150, 150);

  // A big rainbow blob in sunglasses, with a tiny crown, obviously
  ctx.fillStyle = rainbow;
  ctx.beginPath();
  ctx.ellipse(0, 2, 45, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.moveTo(-12, -16);
  ctx.lineTo(-12, -28);
  ctx.lineTo(-6, -21);
  ctx.lineTo(0, -30);
  ctx.lineTo(6, -21);
  ctx.lineTo(12, -28);
  ctx.lineTo(12, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#111111";
  roundedRect(ctx, -26, -6, 22, 11, 4);
  ctx.fill();
  roundedRect(ctx, 4, -6, 22, 11, 4);
  ctx.fill();
  ctx.fillRect(-4, -3, 8, 3);
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fillRect(-22, -4, 6, 2);
  ctx.fillRect(8, -4, 6, 2);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-8, 12);
  ctx.quadraticCurveTo(2, 17, 12, 10);
  ctx.stroke();
  // How many hits it has left
  for (let i = 0; i < boss.hp; i++) {
    ctx.fillStyle = COLORS.red;
    ctx.beginPath();
    ctx.arc(-10 + i * 10, 30, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCapsuleShape(c, x, y, w, h, kind) {
  // The mystery look: every capsule in the game is drawn exactly the same way
  roundedRect(c, x - w / 2, y - h / 2, w, h, h / 2);
  if (kind === "mystery") {
    const body = c.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    body.addColorStop(0, "#FFFFFF");
    body.addColorStop(1, "#C9D1DB");
    c.fillStyle = body;
  } else {
    c.fillStyle = KIND_COLORS[kind];
  }
  c.fill();
  c.lineWidth = 1.2;
  c.strokeStyle = kind === "mystery" ? "#8090A0" : blend(KIND_COLORS[kind], "#000000", 0.35);
  c.stroke();
  c.fillStyle = kind === "mystery" ? COLORS.pink : "#0D131A";
  c.font = `900 ${Math.round(h * 0.85)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(kind === "mystery" ? "?" : kind === "good" ? "+" : "!", x, y + h * 0.05);
}

function drawCapsules(now) {
  for (const capsule of game.capsules) {
    ctx.save();
    ctx.translate(capsule.x, capsule.y);
    ctx.rotate(Math.sin(now / 120 + capsule.x) * 0.2);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
    glow.addColorStop(0, "rgba(255, 79, 163, 0.45)");
    glow.addColorStop(1, "rgba(255, 79, 163, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-30, -30, 60, 60);
    drawCapsuleShape(ctx, 0, 0, 30, 15, "mystery");
    ctx.restore();
  }
}

function drawBullets(now) {
  // Yours: green bolts (pink when piercing)
  for (const bullet of game.bullets) {
    const color = bullet.pierce ? COLORS.pink : COLORS.green;
    ctx.save();
    ctx.translate(bullet.x, bullet.y + SETTINGS.bulletHeight / 2);
    ctx.rotate(Math.atan2(bullet.vx, -bullet.vy));
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    roundedRect(ctx, -2.5, -8, 5, 16, 2.5);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    roundedRect(ctx, -1, -6, 2, 10, 1);
    ctx.fill();
    ctx.restore();
  }
  // Theirs: wobbly red goo. Your own boomerangs come back green.
  for (const bullet of game.enemyBullets) {
    if (bullet.boomerang) {
      ctx.fillStyle = COLORS.green;
      ctx.shadowColor = COLORS.green;
      ctx.shadowBlur = 10;
      roundedRect(ctx, bullet.x - 2.5, bullet.y, 5, 16, 2.5);
      ctx.fill();
      ctx.shadowBlur = 0;
      continue;
    }
    const wiggle = Math.sin(now / 60 + bullet.x) * 2;
    ctx.fillStyle = "#FF6B5E";
    ctx.shadowColor = "#FF6B5E";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(bullet.x + wiggle, bullet.y + 6, 3.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawShip(now) {
  const x = game.ship.x;
  const y = SETTINGS.shipY;
  // Blink while you can't be hit
  if (game.invulnerable() && !game.over && Math.floor(now / 90) % 2 === 0) return;
  const drunk = showing(game.drunkLeft(), now);
  const reversed = showing(game.reversedLeft(), now);
  const look = drunk ? LOOKS.drunk : reversed ? LOOKS.reversed : LOOKS.normal;

  ctx.save();
  ctx.translate(x, y);
  if (game.drunkLeft() > 0) ctx.rotate(Math.sin(now / 110) * 0.18);  // a drunk ship wobbles

  // Engine flame
  const flame = 8 + Math.random() * 6;
  ctx.fillStyle = "#FFB347";
  ctx.beginPath();
  ctx.moveTo(-6, 11);
  ctx.lineTo(0, 11 + flame);
  ctx.lineTo(6, 11);
  ctx.fill();

  const body = ctx.createLinearGradient(0, -14, 0, 14);
  body.addColorStop(0, look.light);
  body.addColorStop(1, look.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(8, -2);
  ctx.lineTo(22, 8);
  ctx.lineTo(22, 12);
  ctx.lineTo(6, 10);
  ctx.lineTo(-6, 10);
  ctx.lineTo(-22, 12);
  ctx.lineTo(-22, 8);
  ctx.lineTo(-8, -2);
  ctx.closePath();
  ctx.fill();

  if (drunk && reversed) {
    // Both at once: orange stripes over the purple
    ctx.save();
    ctx.clip();
    ctx.fillStyle = LOOKS.reversed.light;
    for (let sx = -30; sx < 30; sx += 10) ctx.fillRect(sx, -20, 5, 40);
    ctx.restore();
  }
  // Cockpit
  ctx.fillStyle = "#BFE9FF";
  ctx.beginPath();
  ctx.ellipse(0, -2, 3.5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (game.shield) {
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 150);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawFog() {
  const timeLeft = game.fogLeft();
  if (timeLeft <= 0) return;
  // Darkness everywhere except a circle around your ship; it lifts gently at the end
  const strength = Math.min(1, timeLeft / 0.4) * 0.96;
  const x = game.ship.x;
  const y = SETTINGS.shipY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.moveTo(x + 170, y);
  ctx.arc(x, y, 170, 0, Math.PI * 2, true);
  ctx.fillStyle = `rgba(${COLORS.fog}, ${strength})`;
  ctx.fill("evenodd");
  const edge = ctx.createRadialGradient(x, y, 100, x, y, 171);
  edge.addColorStop(0, `rgba(${COLORS.fog}, 0)`);
  edge.addColorStop(1, `rgba(${COLORS.fog}, ${strength})`);
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.arc(x, y, 171, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(dt) {
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.vy += 500 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life / 0.4);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, count, speed = 260) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power - 80,
      size: 3 + Math.random() * 5, color, life: 0.5 + Math.random() * 0.4 });
  }
}

function drawPopups(now) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  popups = popups.filter((popup) => now - popup.born < POPUP_TIME * 1000);
  for (const popup of popups) {
    const progress = (now - popup.born) / (POPUP_TIME * 1000);
    const pop = progress < 0.12 ? 0.7 + progress * 2.5 : 1;  // a little bounce when it appears
    ctx.font = `900 ${Math.round((popup.size || 20) * pop)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const y = popup.y - 46 * progress;
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
  ctx.font = '900 64px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#0D131A";
  ctx.strokeText(banner.title, W / 2, H / 2 - 20);
  ctx.fillStyle = COLORS.green;
  ctx.fillText(banner.title, W / 2, H / 2 - 20);
  ctx.font = '800 24px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeText(banner.line, W / 2, H / 2 + 30);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(banner.line, W / 2, H / 2 + 30);
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
  stepBounce *= Math.pow(0.001, dt || 0.016);
  drawBackground(now);
  for (const alien of game.aliens) {
    if (alien.alive) drawAlien(alien, now);
  }
  drawBoss(now);
  drawCapsules(now);
  drawBullets(now);
  drawParticles(dt);
  drawFog();
  drawShip(now);     // drawn after the fog, so you can always see your own ship
  drawPopups(now);
  drawBanner(now);
  ctx.restore();
}

function paintIcon(iconCanvas, kind) {
  const dpr = window.devicePixelRatio || 1;
  iconCanvas.width = 26 * dpr;
  iconCanvas.height = 14 * dpr;
  const c = iconCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, 26, 14);
  drawCapsuleShape(c, 13, 7, 24, 12, kind);
}

// ---------- Scoreboard ----------

const hud = {
  score: $("score"),
  wave: $("wave"),
  lives: $("lives"),
  swarmLabel: $("swarm-label"),
  swarmFill: $("swarm-fill"),
  lastCapsule: $("last-capsule"),
  lastCapsuleIcon: $("last-capsule-icon"),
  lastCapsuleText: $("last-capsule-text"),
  effects: $("effects"),
};

// One pill per effect, built once and shown or hidden as needed
for (const effect of EFFECTS) {
  effect.pill = document.createElement("span");
  effect.pill.className = `pill pill-${effect.color}`;
  effect.pill.hidden = true;
  effect.pill.innerHTML = '<span class="pill-fill"></span><span class="pill-text"></span>';
  hud.effects.appendChild(effect.pill);
}

function updateHud() {
  setText(hud.score, game.score);
  setText(hud.wave, game.wave);
  setText(hud.lives, "♥".repeat(Math.max(0, game.lives)) || "—");

  // How close the swarm is to landing
  const progress = clamp((game.swarmBottom() - 200) / (SETTINGS.landingY - 200), 0, 1);
  const danger = progress > 0.75;
  setText(hud.swarmLabel, danger ? "SWARM!!" : "SWARM");
  hud.swarmLabel.classList.toggle("danger", danger);
  hud.swarmFill.style.width = (progress * 100).toFixed(1) + "%";
  hud.swarmFill.style.background = progress < 0.5
    ? blend(COLORS.green, COLORS.gold, progress * 2)
    : blend(COLORS.gold, COLORS.red, (progress - 0.5) * 2);

  for (const effect of EFFECTS) {
    const timeLeft = effect.left();
    effect.pill.hidden = timeLeft <= 0;
    if (timeLeft <= 0) continue;
    effect.pill.firstChild.style.width = ((timeLeft / effect.total()) * 100).toFixed(1) + "%";
    const name = effect.label ? effect.label() : effect.name;
    setText(effect.pill.lastChild, effect.noTimer ? name : `${name}  ${timeLeft.toFixed(1)}s`);
  }
}

function showLastCapsule(kind, text) {
  paintIcon(hud.lastCapsuleIcon, kind);
  setText(hud.lastCapsuleText, text);
  hud.lastCapsuleText.style.color = KIND_COLORS[kind];
  hud.lastCapsule.classList.remove("empty");
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
    setText($("overlay-title"), "CHAOS SWARM");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic"
      ? "Just aliens. No surprises. Shoot the things."
      : "Every capsule is a mystery. The swarm is not. It hates you.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Drag to move. Your ship shoots by itself." : "or press Space");
  } else if (kind === "paused") {
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "Taking a breather? The swarm is judging you.");
    setText($("overlay-stats"), `Score ${game.score}  ·  Wave ${game.wave}`);
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
      `Score ${game.score}  ·  Wave ${game.wave}  ·  ` + (newBest ? "New best!" : `Best ${best}`));
    let taunt = newBest ? "Don't let it go to your head." : pick(game.classic ? CLASSIC_TAUNTS : TAUNTS);
    taunt += `  ${game.kills} aliens down. Best streak ${game.bestCombo}.`;
    if (!game.classic) taunt += ` Capsules: ${game.caught.good} good, ${game.caught.bad} bad.`;
    setText($("overlay-taunt"), taunt);
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  game = new SwarmGame({ classic: gameMode === "classic" });
  popups = [];
  particles = [];
  banner = null;
  lastMultiplier = 1;
  hud.lastCapsule.classList.add("empty");
}

function setMode(newMode) {
  gameMode = newMode;
  saveSetting(MODE_KEY, newMode);
  best = loadBest();
  document.body.classList.toggle("classic", newMode === "classic");
  for (const button of document.querySelectorAll(".mode")) {
    button.setAttribute("aria-checked", String(button.dataset.mode === newMode));
  }
  // On the start screen, show a fresh swarm for the new mode behind the panel
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
  keys.fire = false;
  mouseDown = false;
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
  popups.push({ x: clamp(x, 80, W - 80), y, text, color, born: performance.now(), ...options });
}

function shakeScreen(strength) {
  shake = { until: performance.now() + 400, strength };
}

function handleEvents() {
  const now = performance.now();
  for (const event of game.events) {
    switch (event.type) {
      case "kill": {
        burst(event.x, event.y, ALIEN_COLORS[event.alienType].body, 14, 240);
        if (event.diving) addPopup(event.x, event.y, `+${event.points} DIVER!`, COLORS.gold, { size: 18 });
        const multiplier = game.multiplier();
        if (multiplier > lastMultiplier && COMBO_LINES[multiplier]) {
          addPopup(event.x, event.y - 20, COMBO_LINES[multiplier], COLORS.gold, { size: 24 });
        }
        lastMultiplier = multiplier;
        break;
      }
      case "step":
        stepBounce = 1;
        break;
      case "dodge":
        if (Math.random() < 0.6) addPopup(event.x, event.y - 10, pick(DODGES), COLORS.dim, { size: 16 });
        break;
      case "dive":
        if (Math.random() < 0.5) addPopup(event.x, event.y + 40, pick(DIVES), COLORS.red, { size: 16 });
        break;
      case "rammed":
        burst(event.x, event.y, COLORS.red, 24, 300);
        break;
      case "caught":
        showLastCapsule(event.kind, event.text);
        addPopup(event.x, event.y, event.popup, KIND_COLORS[event.kind], { size: 24 });
        burst(event.x, event.y, KIND_COLORS[event.kind], 16, 220);
        break;
      case "shieldBlock":
        addPopup(event.x, SETTINGS.shipY - 40, "BLOCKED", COLORS.cyan, { size: 20 });
        burst(event.x, SETTINGS.shipY, COLORS.cyan, 20, 240);
        break;
      case "lostLife":
        shakeScreen(14);
        burst(event.x, SETTINGS.shipY, COLORS.orange, 40, 340);
        addPopup(event.x, SETTINGS.shipY - 50, pick(OOPS), COLORS.red, { size: 24 });
        lastMultiplier = 1;
        break;
      case "boomerang":
        addPopup(event.x, 40, "BOOMERANG!", COLORS.orange, { size: 16 });
        break;
      case "boss":
        addPopup(event.x, event.y + 40, "RAINBOW BOSS!", COLORS.gold, { size: 22 });
        break;
      case "bossHit":
        burst(event.x, event.y, "#FFFFFF", 12, 200);
        addPopup(event.x, event.y + 30, event.hp === 1 ? "ONE MORE!" : "OW", COLORS.gold, { size: 16 });
        break;
      case "bossKill":
        burst(event.x, event.y, COLORS.gold, 60, 400);
        addPopup(event.x, event.y + 30, `+${event.points} BOSS DOWN!`, COLORS.gold, { size: 26 });
        shakeScreen(8);
        break;
      case "wave":
        banner = { title: `WAVE ${event.wave}`, line: pick(WAVE_LINES), born: now };
        burst(W / 2, H / 2, COLORS.gold, 60, 420);
        break;
      case "over":
        mode = "over";
        shakeScreen(18);
        showOverlay("over");
        break;
    }
  }
  game.events = [];
}

// ---------- Controls ----------

const KEY_LEFT = ["ArrowLeft", "KeyA"];
const KEY_RIGHT = ["ArrowRight", "KeyD"];

document.addEventListener("keydown", (event) => {
  if (KEY_LEFT.includes(event.code) || KEY_RIGHT.includes(event.code)) {
    if (mode === "playing") event.preventDefault();  // stop the arrow keys scrolling the page
    keys.left = keys.left || KEY_LEFT.includes(event.code);
    keys.right = keys.right || KEY_RIGHT.includes(event.code);
    pointerX = null;  // the keyboard takes over from the mouse
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (mode === "playing") keys.fire = true;
    else if (!event.repeat) primaryAction();
  } else if (event.code === "Enter") {
    event.preventDefault();
    if (!event.repeat && mode !== "playing") primaryAction();
  } else if (event.code === "KeyP" || event.code === "Escape") {
    if (mode === "playing") pause();
    else resume();
  }
});
document.addEventListener("keyup", (event) => {
  if (KEY_LEFT.includes(event.code)) keys.left = false;
  if (KEY_RIGHT.includes(event.code)) keys.right = false;
  if (event.code === "Space") keys.fire = false;
});

// The mouse moves the ship wherever it is on the page; a finger has to be on the board
window.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse" && mode === "playing") pointerX = toBoardX(event.clientX);
});
window.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse") mouseDown = false;
});

let touching = false;
boardWrap.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".panel")) return;  // let the buttons on the overlay work normally
  if (event.pointerType === "mouse") {
    mouseDown = true;
    pointerX = toBoardX(event.clientX);
    return;
  }
  touching = true;
  pointerX = toBoardX(event.clientX);
});
boardWrap.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" && touching) pointerX = toBoardX(event.clientX);
});
for (const type of ["pointerup", "pointercancel"]) {
  boardWrap.addEventListener(type, (event) => {
    if (event.pointerType !== "mouse") touching = false;
  });
}

$("pause-button").addEventListener("click", () => {
  if (mode === "playing") pause();
  else resume();
});
playButton.addEventListener("click", primaryAction);
for (const button of document.querySelectorAll(".mode")) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}

// Pause if you switch tabs, lock your phone or click away from the window
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", () => {
  keys.left = keys.right = keys.fire = false;
  mouseDown = false;
  pause();
});

new ResizeObserver(() => resizeCanvas()).observe(boardWrap);

// ---------- Start up ----------

function frame(now) {
  // Never jump more than a twentieth of a second, so a slow frame can't make bullets skip things
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (mode === "playing") {
    // On phones the ship shoots by itself
    game.setInput({ left: keys.left, right: keys.right, targetX: pointerX, fire: isTouch || keys.fire || mouseDown });
    game.update(dt);
    handleEvents();
  }
  updateHud();
  draw(now, mode === "playing" ? dt : 0);
  requestAnimationFrame(frame);
}

for (const element of document.querySelectorAll("[data-setting]")) {
  element.textContent = SETTINGS[element.dataset.setting];
}
for (const icon of document.querySelectorAll("canvas[data-capsule]")) {
  paintIcon(icon, icon.dataset.capsule);
}

resizeCanvas();
setMode(gameMode);  // also puts a fresh swarm behind the start screen
requestAnimationFrame(frame);
