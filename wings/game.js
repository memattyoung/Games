// Drawing, controls and screens for Chaos Wings. The rules live in logic.js.
"use strict";

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
  fog: "6, 8, 16",
};
// How Grump looks. Drunk turns it purple and reversed turns it orange, so it's obvious.
const LOOKS = {
  normal: { light: "#9DF2D2", dark: "#2F8C6E", wing: "#2A7A60" },
  drunk: { light: "#D6B0FF", dark: "#6B3FA0", wing: "#55308A" },
  reversed: { light: "#FFC98A", dark: "#B05A14", wing: "#8E4A12" },
};
const NEON = ["#5CE1E6", "#FF5FA2", "#B6F35C"];
const KIND_COLORS = { good: COLORS.green, bad: COLORS.purple };

// The countdown pills above the board, in the order they appear
const EFFECTS = [
  { name: "UPSIDE DOWN", color: "red", left: () => game.gravityLeft(), total: () => SETTINGS.effectTime },
  { name: "REVERSED", color: "orange", left: () => game.reversedLeft(), total: () => SETTINGS.effectTime },
  { name: "DRUNK", color: "purple", left: () => game.drunkLeft(), total: () => SETTINGS.effectTime },
  { name: "FOG", color: "grey", left: () => game.fogLeft(), total: () => SETTINGS.fogTime },
  { name: "WINDY", color: "grey", left: () => game.windLeft(), total: () => SETTINGS.effectTime },
  { name: "HEAVY", color: "red", left: () => game.heavyLeft(), total: () => SETTINGS.effectTime },
  { name: "SLIDING", color: "red", left: () => game.slidingLeft(), total: () => SETTINGS.effectTime },
  { name: "SLOW-MO", color: "cyan", left: () => game.slowLeft(), total: () => SETTINGS.effectTime },
  { name: "TINY", color: "green", left: () => game.tinyLeft(), total: () => SETTINGS.effectTime },
  { name: "×2 POINTS", color: "gold", left: () => game.doubleLeft(), total: () => SETTINGS.effectTime },
  { name: "SHIELD", color: "cyan", left: () => (game.shield ? 1 : 0), total: () => 1, noTimer: true },
];

// The sass
const CRASHES = ["SPLAT", "BONK", "OOF", "WHOOPS", "YIKES", "OUCH", "RIP GRUMP"];
const MILESTONES = {
  10: "10! OKAY, I SEE YOU", 25: "25?! WHO ARE YOU", 50: "50. GO OUTSIDE", 75: "75. GRUMP IS SWEATING",
  100: "100. SERIOUSLY?", 150: "150. ARE YOU A ROBOT?", 200: "200. I GIVE UP",
};
const TAUNTS = ["Rage quit? Honestly, valid.", "Grump is disappointed in you.", "That pillar didn't even try.",
  "Tap. Tap. Tap. It's not that hard. (It's so hard.)", "Bold of you to fly into that.",
  "Your thumb needs a nap.", "Grump would like a new pilot."];
const CLASSIC_TAUNTS = ["Even the plain version got you.", "No tricks. Just you and gravity. Gravity won.",
  "Classic mode. Classic crash."];

const BORDER = 4;          // the board's border width in style.css
const POPUP_TIME = 1.0;
const FLASH_TIME = 2;      // effects flash on and off for their last 2 seconds
const MAX_PARTICLES = 260;
const BEST_KEY = "mjy-wings-best";
const MODE_KEY = "mjy-wings-mode";
const DEATHS_KEY = "mjy-wings-deaths";
const DEATHS_RESET = 6 * 60 * 60 * 1000;  // "tonight" ends after 6 hours without dying
const W = SETTINGS.width;
const H = SETTINGS.height;

const $ = (id) => document.getElementById(id);
const boardWrap = $("board-wrap");
const canvas = $("board");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const playButton = $("play-button");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

let game = null;          // the current WingsGame
let mode = "start";       // "start", "playing", "paused" or "over"
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" or "classic"
let best = loadBest();
let deaths = loadDeaths();
let scale = 1;            // CSS pixels per board unit
let popups = [];
let particles = [];
let banner = null;        // a big warning in the middle of the screen
let overAt = 0;           // when the last game ended, so frantic tapping doesn't restart it straight away
let shake = { until: 0, strength: 0 };
let lastFrame = performance.now();

// Stars and a skyline, made once with a fixed pattern so they don't jump around
const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 137.5) % W, y: (i * 89.3) % (H * 0.55), size: 0.8 + ((i * 7) % 5) * 0.35, twinkle: i * 1.7,
}));
const SKYLINE = Array.from({ length: 16 }, (_, i) => ({
  x: i * 60, w: 36 + ((i * 23) % 26), h: 70 + ((i * 53) % 120), windows: (i * 31) % 4,
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

function loadDeaths() {
  // How many times you've crashed tonight; it starts again after 6 hours off
  try {
    const saved = JSON.parse(loadSetting(DEATHS_KEY) || "null");
    if (saved && Date.now() - saved.last < DEATHS_RESET) return saved.count;
  } catch {
    // a broken saved value just means we start counting again
  }
  return 0;
}

function addDeath() {
  deaths = loadDeaths() + 1;
  saveSetting(DEATHS_KEY, JSON.stringify({ count: deaths, last: Date.now() }));
}

// ---------- Board size ----------

function resizeCanvas() {
  // The board is always 480 x 800 units, scaled to fit the space it has
  const rect = boardWrap.getBoundingClientRect();
  scale = Math.max(0.2, Math.min((rect.width - 2 * BORDER) / W, (rect.height - 2 * BORDER) / H));
  const w = Math.floor(W * scale);
  const h = Math.floor(H * scale);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  // The scoreboard can be wider than this narrow board, so the effect pills fit on one row
  document.documentElement.style.setProperty("--board-width", Math.max(w + 2 * BORDER, 560) + "px");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  scale = w / W;
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
  const sky = ctx.createLinearGradient(0, 0, 0, SETTINGS.groundY);
  sky.addColorStop(0, "#151D33");
  sky.addColorStop(1, "#2A1F3D");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const star of STARS) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 600 + star.twinkle);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
  // A grumpy moon
  ctx.fillStyle = "#F3E9C6";
  ctx.beginPath();
  ctx.arc(380, 110, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#151D33";
  ctx.beginPath();
  ctx.arc(396, 100, 30, 0, Math.PI * 2);
  ctx.fill();

  // Skyline, scrolling slowly for depth
  const shift = (game.distance * 0.2) % 960;
  for (let copy = 0; copy < 2; copy++) {
    for (const b of SKYLINE) {
      const x = b.x - shift + copy * 960;
      if (x > W || x + b.w < 0) continue;
      ctx.fillStyle = "#1E1830";
      ctx.fillRect(x, SETTINGS.groundY - b.h, b.w, b.h);
      ctx.fillStyle = "rgba(245, 197, 66, 0.35)";
      for (let wy = SETTINGS.groundY - b.h + 12; wy < SETTINGS.groundY - 10; wy += 18) {
        for (let wx = x + 6; wx < x + b.w - 6; wx += 10) {
          if ((Math.floor(wx + wy) + b.windows) % 3 === 0) ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
  }

  if (game.suddenActive("disco")) {
    // Disco: the whole sky cycles through colours, with spinning spotlights
    const hue = (now / 4) % 360;
    ctx.fillStyle = `hsla(${hue}, 85%, 55%, 0.22)`;
    ctx.fillRect(0, 0, W, SETTINGS.groundY);
    for (let i = 0; i < 4; i++) {
      const angle = now / 500 + i * (Math.PI / 2);
      const spot = ctx.createRadialGradient(W / 2 + Math.cos(angle) * 160, 300 + Math.sin(angle) * 140, 0,
        W / 2 + Math.cos(angle) * 160, 300 + Math.sin(angle) * 140, 90);
      spot.addColorStop(0, `hsla(${(hue + i * 90) % 360}, 90%, 65%, 0.35)`);
      spot.addColorStop(1, "hsla(0, 0%, 100%, 0)");
      ctx.fillStyle = spot;
      ctx.fillRect(0, 0, W, SETTINGS.groundY);
    }
  }
}

function drawGround() {
  ctx.fillStyle = "#101826";
  ctx.fillRect(0, SETTINGS.groundY, W, H - SETTINGS.groundY);
  ctx.fillStyle = "#5CE1E6";
  ctx.globalAlpha = 0.8;
  ctx.fillRect(0, SETTINGS.groundY, W, 3);
  ctx.globalAlpha = 0.25;
  const shift = game.distance % 40;
  for (let x = -shift; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, SETTINGS.groundY + 70);
    ctx.lineTo(x + 20, SETTINGS.groundY + 70);
    ctx.lineTo(x + 34, SETTINGS.groundY + 6);
    ctx.lineTo(x + 14, SETTINGS.groundY + 6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPillarPart(x, top, bottom, neon, capAtBottom) {
  const w = SETTINGS.pillarWidth;
  if (bottom <= top) return;
  const stone = ctx.createLinearGradient(x, 0, x + w, 0);
  stone.addColorStop(0, "#2C3A57");
  stone.addColorStop(0.5, "#1D263B");
  stone.addColorStop(1, "#2C3A57");
  ctx.fillStyle = stone;
  ctx.fillRect(x, top, w, bottom - top);
  // Stone block lines
  ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = Math.ceil(top / 30) * 30; y < bottom; y += 30) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    const joint = (y / 30) % 2 === 0 ? x + w / 3 : x + (2 * w) / 3;
    ctx.moveTo(joint, y);
    ctx.lineTo(joint, Math.min(y + 30, bottom));
  }
  ctx.stroke();
  // Neon edges
  ctx.fillStyle = neon;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(x, top, 3, bottom - top);
  ctx.fillRect(x + w - 3, top, 3, bottom - top);
  ctx.globalAlpha = 1;
  // A glowing cap at the edge of the gap
  const capY = capAtBottom ? bottom - 18 : top;
  roundedRect(ctx, x - 6, capY, w + 12, 18, 4);
  ctx.fillStyle = "#2F3D5C";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = neon;
  ctx.shadowColor = neon;
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawPillars() {
  for (const pillar of game.pillars) {
    const neon = NEON[Math.floor(pillar.phase * 10) % NEON.length];
    const center = game.gapCenter(pillar);
    drawPillarPart(pillar.x, -10, center - pillar.gap / 2, neon, true);
    drawPillarPart(pillar.x, center + pillar.gap / 2, SETTINGS.groundY, neon, false);
  }
}

function drawOrbShape(c, x, y, r, kind, now) {
  // The mystery look: every orb on the board is drawn exactly the same way
  const body = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  if (kind === "mystery") {
    body.addColorStop(0, "#FFFFFF");
    body.addColorStop(1, "#FF8FC4");
  } else {
    body.addColorStop(0, blend(KIND_COLORS[kind], "#FFFFFF", 0.5));
    body.addColorStop(1, KIND_COLORS[kind]);
  }
  c.fillStyle = body;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = kind === "mystery" ? "#B0105A" : "#0D131A";
  c.font = `900 ${Math.round(r * 1.25)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(kind === "mystery" ? "?" : kind === "good" ? "+" : "!", x, y + r * 0.08);
}

function drawOrbs(now) {
  for (const pillar of game.pillars) {
    if (!pillar.orb || pillar.orb.taken) continue;
    const x = pillar.x + SETTINGS.pillarWidth / 2;
    const y = game.gapCenter(pillar) + Math.sin(now / 250 + pillar.phase) * 4;
    const glow = ctx.createRadialGradient(x, y, 4, x, y, 34);
    glow.addColorStop(0, "rgba(255, 79, 163, 0.5)");
    glow.addColorStop(1, "rgba(255, 79, 163, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 36, y - 36, 72, 72);
    drawOrbShape(ctx, x, y, SETTINGS.orbRadius, "mystery", now);
    ctx.fillStyle = "#FFFFFF";
    for (let k = 0; k < 2; k++) {
      const angle = now / 300 + k * Math.PI;
      drawSparkle(x + Math.cos(angle) * 20, y + Math.sin(angle) * 20, 3);
    }
  }
}

function drawSparkle(x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
}

function drawWing(r, angle, color, front) {
  ctx.save();
  ctx.translate(-r * 0.15, -r * 0.05);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-r * 0.9, -r * 0.55, -r * 1.15, -r * 0.05);
  ctx.quadraticCurveTo(-r * 0.75, r * 0.05, -r * 0.55, r * 0.3);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.15, 0, r * 0.25);
  ctx.closePath();
  ctx.fillStyle = front ? blend(color, "#FFFFFF", 0.15) : color;
  ctx.fill();
  ctx.restore();
}

function drawHero(now) {
  const hero = game.hero;
  const r = game.heroRadius();
  const x = SETTINGS.heroX;
  const y = hero.y;
  const drunk = showing(game.drunkLeft(), now);
  const reversed = showing(game.reversedLeft(), now);
  const look = drunk ? LOOKS.drunk : reversed ? LOOKS.reversed : LOOKS.normal;
  const flipped = game.gravityLeft() > 0;
  const safe = game.time < game.safeUntil;
  if (safe && Math.floor(now / 90) % 2 === 0) return;  // blinking after the shield saves you

  ctx.save();
  ctx.translate(x, y);
  if (flipped) ctx.scale(1, -1);
  // Nose up when flapping, nose down when falling
  const falling = hero.vy * (flipped ? -1 : 1);
  let tilt = game.started ? clamp(falling / 900, -0.45, 1.0) : 0;
  if (game.drunkLeft() > 0) tilt += Math.sin(now / 120) * 0.2;
  ctx.rotate(tilt);

  // Wings snap up on a flap, then settle
  const sinceFlap = game.time - hero.flapAt;
  const wingAngle = sinceFlap >= 0 && sinceFlap < 0.16 ? -0.95 : 0.25 + Math.sin(now / 80) * 0.18;
  drawWing(r, wingAngle - 0.25, look.wing, false);

  // The fluffy body
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  body.addColorStop(0, look.light);
  body.addColorStop(1, look.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (drunk && reversed) {
    // Both at once: orange stripes over the purple
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = LOOKS.reversed.light;
    for (let sx = -r * 1.5; sx < r * 1.5; sx += r * 0.7) {
      ctx.fillRect(sx, -r, r * 0.3, r * 2);
    }
    ctx.restore();
  }
  // Tufts of grumpy fur on top
  ctx.fillStyle = look.dark;
  for (const tx of [-0.35, -0.05, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(r * (tx - 0.12), -r * 0.88);
    ctx.lineTo(r * tx, -r * 1.25);
    ctx.lineTo(r * (tx + 0.14), -r * 0.86);
    ctx.fill();
  }
  // Pale belly
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.ellipse(r * 0.15, r * 0.4, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes looking ahead, under angry eyebrows
  for (const ex of [0.05, 0.5]) {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(r * ex, -r * 0.18, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(r * (ex + 0.08), -r * 0.14, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = Math.max(1.5, r * 0.13);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.55);
  ctx.lineTo(r * 0.22, -r * 0.38);
  ctx.moveTo(r * 0.75, -r * 0.55);
  ctx.lineTo(r * 0.36, -r * 0.38);
  ctx.stroke();
  // A frown with one little fang
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.beginPath();
  ctx.arc(r * 0.3, r * 0.42, r * 0.22, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(r * 0.38, r * 0.24);
  ctx.lineTo(r * 0.46, r * 0.24);
  ctx.lineTo(r * 0.42, r * 0.36);
  ctx.fill();

  drawWing(r, wingAngle, look.wing, true);
  ctx.restore();

  if (game.shield) {
    ctx.beginPath();
    ctx.arc(x, y, r + 9, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(111, 227, 255, 0.14)";
    ctx.fill();
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 150);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawWind(now) {
  if (game.windLeft() <= 0) return;
  // Streaks blowing past, and an arrow during a gust
  ctx.strokeStyle = "rgba(220, 235, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const y = (i * 61 + now / 6) % SETTINGS.groundY;
    const x = W - ((now / 2 + i * 97) % (W + 120));
    ctx.moveTo(x, y);
    ctx.lineTo(x + 50, y + (game.time < game.gust.until ? game.gust.force / 60 : 0));
  }
  ctx.stroke();
  if (game.time < game.gust.until) {
    const up = game.gust.force < 0;
    const x = SETTINGS.heroX + 44;
    const y = game.hero.y;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.moveTo(x, y + (up ? -26 : 26));
    ctx.lineTo(x - 10, y + (up ? -10 : 10));
    ctx.lineTo(x + 10, y + (up ? -10 : 10));
    ctx.fill();
    ctx.fillRect(x - 3, up ? y - 12 : y, 6, 12);
  }
}

function drawFog() {
  const timeLeft = game.fogLeft();
  if (timeLeft <= 0) return;
  // Darkness everywhere except a little circle around Grump; it lifts gently at the end
  const strength = Math.min(1, timeLeft / 0.4) * 0.96;
  const x = SETTINGS.heroX;
  const y = game.hero.y;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.moveTo(x + 125, y);
  ctx.arc(x, y, 125, 0, Math.PI * 2, true);
  ctx.fillStyle = `rgba(${COLORS.fog}, ${strength})`;
  ctx.fill("evenodd");
  const edge = ctx.createRadialGradient(x, y, 70, x, y, 126);
  edge.addColorStop(0, `rgba(${COLORS.fog}, 0)`);
  edge.addColorStop(1, `rgba(${COLORS.fog}, ${strength})`);
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.arc(x, y, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(dt) {
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life / 0.35);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, count, speed = 240, gravity = 700) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.3 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power - 80, gravity,
      size: 2 + Math.random() * 3, color, life: 0.45 + Math.random() * 0.4 });
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
    ctx.font = `900 ${Math.round((popup.size || 22) * pop)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const y = popup.y - 46 * progress;
    ctx.globalAlpha = 1 - progress * progress;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#0D131A";
    ctx.strokeText(popup.text, popup.x, y);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, y);
  }
  ctx.globalAlpha = 1;
}

function drawBanner(now) {
  if (!banner || now > banner.until) {
    banner = null;
    return;
  }
  if (Math.floor(now / 140) % 2 === 0 && banner.flash) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Up near the top, so it doesn't hide Grump or the next gap
  ctx.font = '900 34px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#0D131A";
  ctx.strokeText(banner.text, W / 2, H * 0.12);
  ctx.fillStyle = banner.color;
  ctx.fillText(banner.text, W / 2, H * 0.12);
}

function drawReady(now) {
  if (mode !== "playing" || game.started) return;
  ctx.globalAlpha = 0.6 + 0.35 * Math.sin(now / 200);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 30px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#0D131A";
  const text = isTouch ? "TAP TO FLAP" : "SPACE OR CLICK TO FLAP";
  ctx.strokeText(text, W / 2, H * 0.6);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(text, W / 2, H * 0.6);
  ctx.globalAlpha = 1;
}

function draw(now, dt) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  let strength = now < shake.until ? shake.strength * ((shake.until - now) / 400) : 0;
  if (game.suddenActive("quake")) strength = Math.max(strength, 9);
  if (strength) ctx.translate((Math.random() - 0.5) * strength, (Math.random() - 0.5) * strength);
  if (game.suddenActive("flip")) {
    // The whole world turns upside down for a few seconds
    ctx.translate(0, H);
    ctx.scale(1, -1);
  }
  drawBackground(now);
  drawPillars();
  drawOrbs(now);
  drawGround();
  drawWind(now);
  drawParticles(dt);
  drawHero(now);
  drawFog();
  ctx.restore();
  // Words are drawn the right way up, even when the world is flipped
  drawPopups(now);
  drawReady(now);
  drawBanner(now);
}

function paintIcon(iconCanvas, kind) {
  const dpr = window.devicePixelRatio || 1;
  iconCanvas.width = 18 * dpr;
  iconCanvas.height = 18 * dpr;
  const c = iconCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, 18, 18);
  drawOrbShape(c, 9, 9, 8, kind, 0);
}

// ---------- Scoreboard ----------

const hud = {
  score: $("score"),
  best: $("best"),
  deaths: $("deaths"),
  lastOrb: $("last-orb"),
  lastOrbIcon: $("last-orb-icon"),
  lastOrbText: $("last-orb-text"),
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
  setText(hud.best, Math.max(best, game.score));
  setText(hud.deaths, deaths);
  for (const effect of EFFECTS) {
    const timeLeft = effect.left();
    effect.pill.hidden = timeLeft <= 0;
    if (timeLeft <= 0) continue;
    effect.pill.firstChild.style.width = ((timeLeft / effect.total()) * 100).toFixed(1) + "%";
    setText(effect.pill.lastChild, effect.noTimer ? effect.name : `${effect.name}  ${timeLeft.toFixed(1)}s`);
  }
}

function showLastOrb(kind, text) {
  paintIcon(hud.lastOrbIcon, kind);
  setText(hud.lastOrbText, text);
  hud.lastOrbText.style.color = KIND_COLORS[kind];
  hud.lastOrb.classList.remove("empty");
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
    setText($("overlay-title"), "CHAOS WINGS");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic"
      ? "Just you, gravity and some pillars. Gravity's winning."
      : "Tap to flap. Everything else is out to get you.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Tap to flap. Try not to die." : "or press Space");
  } else if (kind === "paused") {
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "Grump needs a breather. So do you.");
    setText($("overlay-stats"), `Score ${game.score}`);
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
    setText($("overlay-stats"), `Score ${game.score}  ·  ` + (newBest ? "New best!" : `Best ${best}`));
    let taunt = newBest ? "Grump is mildly impressed." : pick(game.classic ? CLASSIC_TAUNTS : TAUNTS);
    taunt += `  Deaths tonight: ${deaths}.` + (deaths >= 10 ? " Who's counting? (Me. I am.)" : "");
    setText($("overlay-taunt"), taunt);
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  game = new WingsGame({ classic: gameMode === "classic" });
  popups = [];
  particles = [];
  banner = null;
  hud.lastOrb.classList.add("empty");
}

function setMode(newMode) {
  gameMode = newMode;
  saveSetting(MODE_KEY, newMode);
  best = loadBest();
  document.body.classList.toggle("classic", newMode === "classic");
  for (const button of document.querySelectorAll(".mode")) {
    button.setAttribute("aria-checked", String(button.dataset.mode === newMode));
  }
  // On the start screen, show a fresh board for the new mode behind the panel
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
  game.setHolding(false);
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
  popups.push({ x: clamp(x, 90, W - 90), y, text, color, born: performance.now(), ...options });
}

function shakeScreen(strength) {
  shake = { until: performance.now() + 400, strength };
}

function handleEvents() {
  const now = performance.now();
  for (const event of game.events) {
    switch (event.type) {
      case "flap":
        burst(SETTINGS.heroX - 12, event.y + 8, "rgba(220, 255, 240, 0.8)", 4, 90, 200);
        break;
      case "point":
        // Popups go off to the right of Grump, so they never hide him or the gap he's aiming for
        addPopup(SETTINGS.heroX + 80, game.hero.y - 24, `+${event.points}`, event.points > 1 ? COLORS.gold : COLORS.text,
          { size: 18 });
        break;
      case "milestone":
        banner = { text: MILESTONES[event.score], color: COLORS.gold, until: now + 1500 };
        burst(W / 2, H * 0.12, COLORS.gold, 50, 380);
        break;
      case "orb":
        showLastOrb(event.kind, event.text);
        addPopup(event.x + 120, event.y - 30, event.popup, KIND_COLORS[event.kind], { size: 24 });
        burst(event.x, event.y, KIND_COLORS[event.kind], 22, 260);
        break;
      case "shieldSave":
        addPopup(SETTINGS.heroX + 150, event.y - 40, "SAVED (BARELY)", COLORS.cyan, { size: 20 });
        burst(SETTINGS.heroX, event.y, COLORS.cyan, 26, 300);
        shakeScreen(8);
        break;
      case "gust":
        addPopup(SETTINGS.heroX + 110, game.hero.y + (event.direction < 0 ? -40 : 40), "WHOOSH", COLORS.dim, { size: 16 });
        break;
      case "suddenWarning":
        banner = { text: event.text, color: COLORS.red, until: now + SETTINGS.suddenWarning * 1000, flash: true };
        break;
      case "sudden":
        if (event.sudden === "gust") shakeScreen(10);
        break;
      case "over":
        addDeath();
        addPopup(SETTINGS.heroX + 20, game.hero.y - 30, pick(CRASHES), COLORS.red, { size: 30 });
        burst(SETTINGS.heroX, game.hero.y, LOOKS.normal.light, 40, 340);
        shakeScreen(18);
        mode = "over";
        overAt = now;
        showOverlay("over");
        break;
    }
  }
  game.events = [];
}

// ---------- Controls ----------

const FLAP_KEYS = ["Space", "ArrowUp", "KeyW", "Enter"];

document.addEventListener("keydown", (event) => {
  if (FLAP_KEYS.includes(event.code)) {
    event.preventDefault();  // stop Space and the arrows scrolling the page
    if (event.repeat) return;
    if (mode === "playing") {
      game.setHolding(true);
      game.flap();
    } else if ((event.code === "Space" || event.code === "Enter") && performance.now() - overAt > 700) {
      primaryAction();
    }
  } else if (event.code === "KeyP" || event.code === "Escape") {
    if (mode === "playing") pause();
    else resume();
  }
});
document.addEventListener("keyup", (event) => {
  if (FLAP_KEYS.includes(event.code) && game) game.setHolding(false);
});

// Tap or click anywhere on the board to flap; holding down matters when reversed
boardWrap.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".panel")) return;  // let the buttons on the overlay work normally
  if (mode !== "playing") return;
  event.preventDefault();
  game.setHolding(true);
  game.flap();
});
for (const type of ["pointerup", "pointercancel", "pointerleave"]) {
  boardWrap.addEventListener(type, () => game && game.setHolding(false));
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
window.addEventListener("blur", pause);

new ResizeObserver(() => resizeCanvas()).observe(boardWrap);

// ---------- Start up ----------

function frame(now) {
  // Never jump more than a twentieth of a second, so a slow frame can't send Grump through a pillar
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
  element.textContent = SETTINGS[element.dataset.setting];
}
for (const icon of document.querySelectorAll("canvas[data-orb]")) {
  paintIcon(icon, icon.dataset.orb);
}

resizeCanvas();
setMode(gameMode);  // also puts a fresh board behind the start screen
requestAnimationFrame(frame);
