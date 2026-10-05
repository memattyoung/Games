// Drawing, controls and screens for Chaos Breaker. The rules live in logic.js.
"use strict";

const COLORS = {
  boardTop: "#1A2533",
  boardBottom: "#121A23",
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
// One colour per row, top to bottom
const ROW_COLORS = ["#F05A4F", "#FF8A3D", "#F5C542", "#7BD65B", "#3FD0C9", "#4DA3FF", "#9B7BFF", "#E266D4", "#FF6B9A"];
// How the paddle looks. Drunk turns it purple and reversed turns it orange, so it's obvious.
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
  { name: "TINY", color: "red", left: () => game.tinyLeft(), total: () => SETTINGS.effectTime },
  { name: "ZOOM", color: "red", left: () => game.fastLeft(), total: () => SETTINGS.effectTime },
  { name: "FOG", color: "grey", left: () => game.fogLeft(), total: () => SETTINGS.fogTime },
  { name: "INVISIBLE", color: "grey", left: () => game.invisibleLeft(), total: () => SETTINGS.invisibleTime },
  { name: "WIDE", color: "green", left: () => game.wideLeft(), total: () => SETTINGS.effectTime },
  { name: "SLOW-MO", color: "cyan", left: () => game.slowLeft(), total: () => SETTINGS.effectTime },
  { name: "STICKY", color: "gold", left: () => game.stickyLeft(), total: () => SETTINGS.effectTime },
  { name: "NET", color: "cyan", left: () => (game.net ? 1 : 0), total: () => 1, noTimer: true },
  { name: "COMBO", color: "gold", left: () => (!game.classic && game.combo >= 2 ? 1 : 0), total: () => 1,
    noTimer: true, label: () => `COMBO ×${game.combo}` },
];

// The sass
const OOPS = ["OOPS", "YIKES", "BUTTERFINGERS", "REALLY?", "SKILL ISSUE", "BOLD MOVE", "CLASSIC YOU", "WOW."];
const LEVEL_LINES = ["Don't get cocky.", "Okay, not bad.", "Beginner's luck?", "The bricks are mad now.",
  "Fine. That was decent.", "Who taught you that?"];
const TAUNTS = ["That was… a choice.", "Rage quit? Totally understandable.", "The bricks are laughing at you.",
  "Bold strategy. Didn't work.", "Have you tried not missing?", "Your paddle deserved better.",
  "Somewhere, a brick is telling its friends about you."];
const CLASSIC_TAUNTS = ["Even the easy mode got you.", "Classic mode. Classic mistakes.", "No tricks. No excuses.",
  "That's the plain version, you know."];
const COMBO_LINES = { 5: "×5 SHOW-OFF", 8: "×8 OKAY, CALM DOWN", 12: "×12 WHO ARE YOU", 16: "×16 STOP IT" };

const BORDER = 4;          // the board's border width in style.css
const POPUP_TIME = 1.0;
const FLASH_TIME = 2;      // effects flash on and off for their last 2 seconds
const MAX_PARTICLES = 320;
const BEST_KEY = "mjy-bricks-best";
const MODE_KEY = "mjy-bricks-mode";
const W = SETTINGS.width;
const H = SETTINGS.height;

const $ = (id) => document.getElementById(id);
const boardWrap = $("board-wrap");
const canvas = $("board");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const playButton = $("play-button");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

let game = null;          // the current BrickGame
let mode = "start";       // "start", "playing", "paused" or "over"
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" or "classic"
let best = loadBest();
let scale = 1;            // CSS pixels per board unit
let popups = [];
let particles = [];
let banner = null;        // the big "LEVEL 2" message
let shake = { until: 0, strength: 0 };
const trails = new WeakMap();  // recent positions of each ball, for the little tail behind it
const flashes = new WeakMap(); // when each brick was last hit, so it can flash
const keys = { left: false, right: false };
let pointerX = null;      // where your mouse or finger is, in board units (null when using keys)
let lastFrame = performance.now();

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

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, COLORS.boardTop);
  sky.addColorStop(1, COLORS.boardBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // A faint grid, so the board doesn't feel empty
  ctx.strokeStyle = "rgba(255, 255, 255, 0.025)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  if (!game.classic) {
    // The line the wall must never reach
    const y = SETTINGS.paddleY - SETTINGS.dangerGap;
    ctx.save();
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = "rgba(240, 90, 79, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.restore();
  }
  if (game.net) {
    const glow = 0.6 + 0.4 * Math.sin(performance.now() / 180);
    ctx.strokeStyle = `rgba(111, 227, 255, ${glow})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, SETTINGS.netY);
    ctx.lineTo(W, SETTINGS.netY);
    ctx.stroke();
  }
}

function drawBrick(brick, now) {
  const { x, y, w, h } = brick;
  const hitAgo = now - (flashes.get(brick) || -1e9);

  if (brick.steel) {
    const metal = ctx.createLinearGradient(x, y, x, y + h);
    metal.addColorStop(0, "#C9D1DB");
    metal.addColorStop(0.5, "#7D8794");
    metal.addColorStop(1, "#4E5763");
    roundedRect(ctx, x, y, w, h, 3);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.strokeStyle = "#2E353F";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#3A424D";
    for (const rx of [x + 6, x + w - 6]) {
      for (const ry of [y + 6, y + h - 6]) {
        ctx.beginPath();
        ctx.arc(rx, ry, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (hitAgo < 120) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      roundedRect(ctx, x, y, w, h, 3);
      ctx.fill();
    }
    return;
  }

  const rainbow = brick.rainbowUntil > game.time;
  let fill;
  if (rainbow) {
    fill = ctx.createLinearGradient(x, y, x + w, y + h);
    const shift = (now / 6) % 360;
    for (let i = 0; i <= 5; i++) fill.addColorStop(i / 5, `hsl(${(shift + i * 60) % 360}, 90%, 62%)`);
  } else {
    const base = ROW_COLORS[(brick.row < 0 ? 0 : brick.row) % ROW_COLORS.length];
    fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, blend(base, "#FFFFFF", 0.25));
    fill.addColorStop(1, blend(base, "#000000", 0.2));
  }
  roundedRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = fill;
  ctx.fill();

  // Tough bricks show how many hits they have left, and crack as they take damage
  if (brick.maxHp > 1) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    for (let i = 0; i < brick.hp; i++) {
      ctx.beginPath();
      ctx.arc(x + w / 2 + (i - (brick.hp - 1) / 2) * 9, y + h / 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (brick.hp < brick.maxHp) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 8, y + 3);
      ctx.lineTo(x + 15, y + 11);
      ctx.lineTo(x + 11, y + h - 3);
      ctx.moveTo(x + w - 10, y + h - 3);
      ctx.lineTo(x + w - 16, y + 9);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.fillRect(x + 3, y + 2, w - 6, 3);
  if (hitAgo < 120) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    roundedRect(ctx, x, y, w, h, 4);
    ctx.fill();
  }
  if (rainbow) {
    // Sparkles, so it's impossible to miss
    ctx.fillStyle = "#FFFFFF";
    for (let k = 0; k < 3; k++) {
      const t = now / 300 + k * 2.1;
      drawSparkle(x + w / 2 + Math.cos(t) * (w / 2 + 2), y + h / 2 + Math.sin(t * 1.3) * (h / 2 + 2), 3.5 + Math.sin(t * 3));
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

function drawCapsuleShape(c, x, y, w, h, kind, now) {
  // The mystery look: every capsule on the board is drawn exactly the same way
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
    const wobble = Math.sin(now / 120 + capsule.x) * 0.15;
    ctx.save();
    ctx.translate(capsule.x, capsule.y);
    ctx.rotate(wobble);
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 30);
    glow.addColorStop(0, "rgba(255, 79, 163, 0.45)");
    glow.addColorStop(1, "rgba(255, 79, 163, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-32, -32, 64, 64);
    drawCapsuleShape(ctx, 0, 0, 34, 16, "mystery", now);
    ctx.restore();
  }
}

function drawPaddle(now) {
  const width = game.paddleWidth();
  const height = SETTINGS.paddleHeight;
  const x = game.paddle.x - width / 2;
  const y = SETTINGS.paddleY;
  const drunk = showing(game.drunkLeft(), now);
  const reversed = showing(game.reversedLeft(), now);
  const look = drunk ? LOOKS.drunk : reversed ? LOOKS.reversed : LOOKS.normal;

  ctx.save();
  if (game.drunkLeft() > 0) {
    // A drunk paddle wobbles about
    ctx.translate(game.paddle.x, y + height / 2);
    ctx.rotate(Math.sin(now / 110) * 0.09);
    ctx.translate(-game.paddle.x, -(y + height / 2));
  }
  const body = ctx.createLinearGradient(0, y, 0, y + height);
  body.addColorStop(0, look.light);
  body.addColorStop(1, look.dark);
  roundedRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = body;
  ctx.fill();

  if (drunk && reversed) {
    // Both at once: orange stripes over the purple
    ctx.save();
    roundedRect(ctx, x, y, width, height, height / 2);
    ctx.clip();
    ctx.fillStyle = LOOKS.reversed.light;
    for (let sx = x - height; sx < x + width; sx += 18) {
      ctx.beginPath();
      ctx.moveTo(sx, y + height);
      ctx.lineTo(sx + 9, y + height);
      ctx.lineTo(sx + 9 + height, y);
      ctx.lineTo(sx + height, y);
      ctx.fill();
    }
    ctx.restore();
  }
  if (showing(game.stickyLeft(), now)) {
    // Gooey gold top for the sticky paddle
    ctx.fillStyle = COLORS.gold;
    roundedRect(ctx, x + 2, y - 2, width - 4, 5, 2.5);
    ctx.fill();
    for (let dx = 12; dx < width - 8; dx += 22) {
      ctx.beginPath();
      ctx.arc(x + dx, y + 3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  roundedRect(ctx, x + 6, y + 2, width - 12, 3, 1.5);
  ctx.fill();
  ctx.restore();
}

function drawBalls(now) {
  const hidden = game.invisibleLeft() > 0 && now % 650 > 110;  // only flickers into view
  const fast = game.fastLeft() > 0;
  const slow = game.slowLeft() > 0;
  const glowColor = fast ? "255, 90, 80" : slow ? "111, 227, 255" : "255, 255, 255";
  const r = SETTINGS.ballRadius;

  for (const ball of game.balls) {
    let trail = trails.get(ball);
    if (!trail) trails.set(ball, (trail = []));
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 8) trail.shift();
    if (hidden) continue;

    trail.forEach((spot, i) => {
      ctx.globalAlpha = (i / trail.length) * 0.35;
      ctx.fillStyle = `rgb(${glowColor})`;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, r * (0.4 + (0.6 * i) / trail.length), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(ball.x, ball.y, r * 0.5, ball.x, ball.y, r * 2.6);
    glow.addColorStop(0, `rgba(${glowColor}, 0.55)`);
    glow.addColorStop(1, `rgba(${glowColor}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(ball.x - r * 3, ball.y - r * 3, r * 6, r * 6);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFog() {
  const timeLeft = game.fogLeft();
  if (timeLeft <= 0) return;
  // Darkness everywhere except a little circle around each ball; it lifts gently at the end
  const strength = Math.min(1, timeLeft / 0.4) * 0.96;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  for (const ball of game.balls) {
    ctx.moveTo(ball.x + 120, ball.y);
    ctx.arc(ball.x, ball.y, 120, 0, Math.PI * 2, true);
  }
  ctx.fillStyle = `rgba(${COLORS.fog}, ${strength})`;
  ctx.fill("evenodd");
  for (const ball of game.balls) {
    // Soften the edge of each clear circle
    const edge = ctx.createRadialGradient(ball.x, ball.y, 70, ball.x, ball.y, 121);
    edge.addColorStop(0, `rgba(${COLORS.fog}, 0)`);
    edge.addColorStop(1, `rgba(${COLORS.fog}, ${strength})`);
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 121, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawParticles(dt) {
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life / 0.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, count, speed = 260) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power - 120,
      size: 3 + Math.random() * 4, color, life: 0.5 + Math.random() * 0.4 });
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
    const y = popup.y - (popup.row || 0) * 22 - 46 * progress;
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

function drawLaunchHint(now) {
  if (mode !== "playing" || !game.balls.some((b) => b.stuck) || game.stickyLeft() > 0) return;
  ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 200);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '800 18px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(isTouch ? "TAP TO LAUNCH" : "SPACE OR CLICK TO LAUNCH", W / 2, SETTINGS.paddleY - 60);
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
  drawBackground();
  for (const brick of game.bricks) {
    if (brick.alive) drawBrick(brick, now);
  }
  drawCapsules(now);
  drawBalls(now);
  drawParticles(dt);
  drawFog();
  drawPaddle(now);   // drawn after the fog, so you can always see your own paddle
  drawPopups(now);
  drawLaunchHint(now);
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
  drawCapsuleShape(c, 13, 7, 24, 12, kind, 0);
}

// ---------- Scoreboard ----------

const hud = {
  score: $("score"),
  level: $("level"),
  lives: $("lives"),
  wallLabel: $("wall-label"),
  wallFill: $("wall-fill"),
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
  setText(hud.level, game.level);
  setText(hud.lives, "♥".repeat(Math.max(0, game.lives)) || "—");

  // How close the wall is to moving again, and how close it is to the red line
  const progress = game.creepProgress;
  const rowsLeft = (SETTINGS.paddleY - SETTINGS.dangerGap - game.wallBottom()) / SETTINGS.rowStep;
  const danger = rowsLeft <= 3;
  setText(hud.wallLabel, danger ? "WALL!!" : "WALL");
  hud.wallLabel.classList.toggle("danger", danger);
  hud.wallFill.style.width = (progress * 100).toFixed(1) + "%";
  hud.wallFill.style.background = progress < 0.5
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

  if (kind === "start") {
    setText($("overlay-title"), "CHAOS BREAKER");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic"
      ? "Just bricks. No drama. Kind of boring, honestly."
      : "Every capsule is a mystery. Most of them hate you.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Drag to move. Tap to launch." : "or press Space");
  } else if (kind === "paused") {
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "Take a breather. The bricks will wait.");
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
    if (!game.classic) {
      taunt += `  Best combo ×${game.bestCombo}. Capsules: ${game.caught.good} good, ${game.caught.bad} bad.`;
    }
    setText($("overlay-taunt"), taunt);
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  game = new BrickGame({ classic: gameMode === "classic" });
  popups = [];
  particles = [];
  banner = null;
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
  popups.push({ x: clamp(x, 70, W - 70), y, text, color, born: performance.now(), ...options });
}

function shakeScreen(strength) {
  shake = { until: performance.now() + 400, strength };
}

function handleEvents() {
  const now = performance.now();
  for (const event of game.events) {
    switch (event.type) {
      case "brick": {
        const color = event.rainbow ? "#FFFFFF" : ROW_COLORS[Math.max(0, event.brick.row) % ROW_COLORS.length];
        burst(event.x, event.y, color, event.rainbow ? 40 : 12, event.rainbow ? 380 : 260);
        if (event.rainbow) addPopup(event.x, event.y, `+${event.points} RAINBOW!`, COLORS.gold, { size: 26 });
        else if (COMBO_LINES[event.combo]) addPopup(event.x, event.y, COMBO_LINES[event.combo], COLORS.gold, { size: 24 });
        else if (event.combo >= 3) addPopup(event.x, event.y, `×${event.combo}`, COLORS.gold);
        break;
      }
      case "brickHit":
        flashes.set(event.brick, now);
        burst(event.x, event.y, "#FFFFFF", 4, 160);
        break;
      case "steelHit":
        burst(event.x, event.y, "#C9D1DB", 5, 200);
        if (Math.random() < 0.25) addPopup(event.x, event.y, "CLANK", COLORS.dim, { size: 16 });
        break;
      case "caught":
        showLastCapsule(event.kind, event.text);
        addPopup(event.x, event.y - 10, event.popup, KIND_COLORS[event.kind], { size: 24 });
        burst(event.x, event.y, KIND_COLORS[event.kind], 16, 220);
        break;
      case "steel":
        shakeScreen(6);
        burst(event.x, event.y, "#C9D1DB", 18, 240);
        break;
      case "lostBall":
        addPopup(event.x, H - 70, pick(OOPS), COLORS.red, { size: 24 });
        break;
      case "lostLife":
        shakeScreen(14);
        break;
      case "netSave":
        addPopup(event.x, SETTINGS.netY - 40, "SAVED BY THE NET", COLORS.cyan);
        break;
      case "autoLaunch":
        addPopup(event.x, SETTINGS.paddleY - 40, "FINE, I'LL DO IT", COLORS.dim, { size: 18 });
        break;
      case "creep":
        shakeScreen(5);
        addPopup(W / 2, game.wallBottom() + 30, "THE WALL MOVES", COLORS.red, { size: 18 });
        break;
      case "rainbow":
        addPopup(event.x, event.y, "RAINBOW!", COLORS.gold, { size: 20 });
        break;
      case "level":
        banner = { title: `LEVEL ${event.level}`, line: pick(LEVEL_LINES), born: now };
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
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (event.repeat) return;
    if (mode === "playing") game.launch();
    else primaryAction();
  } else if (event.code === "KeyP" || event.code === "Escape") {
    if (mode === "playing") pause();
    else resume();
  }
});
document.addEventListener("keyup", (event) => {
  if (KEY_LEFT.includes(event.code)) keys.left = false;
  if (KEY_RIGHT.includes(event.code)) keys.right = false;
});

// The mouse moves the paddle wherever it is on the page; a finger has to be on the board
window.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse" && mode === "playing") pointerX = toBoardX(event.clientX);
});

let touchStart = null;
boardWrap.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".panel")) return;  // let the buttons on the overlay work normally
  if (event.pointerType === "mouse") {
    if (mode === "playing") game.launch();
    return;
  }
  touchStart = { x: event.clientX, y: event.clientY, at: performance.now() };
  pointerX = toBoardX(event.clientX);
});
boardWrap.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" && touchStart) pointerX = toBoardX(event.clientX);
});
boardWrap.addEventListener("pointerup", (event) => {
  if (event.pointerType === "mouse" || !touchStart) return;
  // A quick tap (not a drag) launches the ball
  const moved = Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y);
  if (moved < 12 && performance.now() - touchStart.at < 300 && mode === "playing") game.launch();
  touchStart = null;
});
boardWrap.addEventListener("pointercancel", () => (touchStart = null));

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
  // Never jump more than a twentieth of a second, so a slow frame can't send the ball through things
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (mode === "playing") {
    game.setInput({ left: keys.left, right: keys.right, targetX: pointerX });
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
setMode(gameMode);  // also puts a fresh board behind the start screen
requestAnimationFrame(frame);
