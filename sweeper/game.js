// Drawing, controls and screens for Chaos Sweeper. The rules live in logic.js.
"use strict";

const COLORS = {
  board: "#121A23",
  hiddenTop: "#243344",
  hiddenBottom: "#1A2532",
  open: "#0D131A",
  text: "#E8EEF4",
  dim: "#8090A0",
  green: "#7BD65B",
  red: "#F05A4F",
  gold: "#F5C542",
  purple: "#B98AF0",
  cyan: "#6FE3FF",
  pink: "#FF4FA3",
};
const NUMBER_COLORS = [null, "#5CC2FF", "#7BD65B", "#FF6B9A", "#B98AF0", "#FFA24C", "#3FD0C9", "#F5C542", "#E8EEF4"];
const KIND_COLORS = { good: COLORS.green, bad: COLORS.purple };

// The countdown pills above the board
const EFFECTS = [
  { name: "PANIC", color: "red", left: () => (panicking() ? 1 : 0), total: () => 1, noTimer: true },
  { name: "TURBO", color: "orange", left: () => game.turboLeft(), total: () => SETTINGS.turboTime },
  { name: "LIAR", color: "purple", left: () => game.liarLeft(), total: () => SETTINGS.liarTime },
  { name: "FOG", color: "grey", left: () => game.fogLeft(), total: () => SETTINGS.fogTime },
  { name: "FROZEN", color: "cyan", left: () => game.frozenLeft(), total: () => SETTINGS.freezeTime },
  { name: "X-RAY", color: "cyan", left: () => game.xrayLeft(), total: () => SETTINGS.xrayTime },
];

// The sass
const BOOMS = ["KABOOM", "WHOOPS", "OH NO", "CALLED IT", "BYE", "OOF"];
const LOSE_TAUNTS = ["You had a choice. You chose the bomb.", "That was a guess, wasn't it?", "Bold. Wrong, but bold.",
  "The bomb was in the last place you looked. Obviously.", "Your clicking finger needs a nap.",
  "Somewhere, a bomb is very proud of itself.", "Statistically, that was impressive."];
const TIMEOUT_TAUNTS = ["The bombs didn't even have to try.", "Thinking is allowed. This much thinking isn't.",
  "A glacier would have finished first.", "Tick tock. Mostly tock."];
const CLASSIC_TAUNTS = ["Classic mode. Classic mistake.", "Nothing moved and you still found a bomb.",
  "That's the calm version, you know.", "No tricks. No lies. Just you."];
const WIN_LINES = ["Okay, show-off.", "The bombs demand a rematch.", "Fine. You're good. Happy?",
  "Clean sweep. Disgusting.", "Not one boom. Who raised you?"];

const BORDER = 4;          // the board's border width in style.css
const MAX_CELL = 58;
const POPUP_TIME = 1.0;
const LONG_PRESS = 380;    // milliseconds to hold a finger down to plant a flag
const OVER_DELAY = 1100;   // let the board sink in before the game over panel covers it
const BEST_KEY = "mjy-sweeper-best";
const MODE_KEY = "mjy-sweeper-mode";
const SIZE_KEY = "mjy-sweeper-size";

const $ = (id) => document.getElementById(id);
const boardWrap = $("board-wrap");
const canvas = $("board");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const playButton = $("play-button");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

let game = null;          // the current SweeperGame
let mode = "start";       // "start", "playing", "paused" or "over"
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" (Chaos) or "classic"
let sizeName = SIZES[loadSetting(SIZE_KEY)] ? loadSetting(SIZE_KEY) : "normal";
let tool = "dig";         // what a plain tap or click does
let best = loadBest();
let cell = 40;            // size of one square in CSS pixels
let popups = [];
let particles = [];
let shake = { until: 0, strength: 0 };
let hover = null;         // the square under the mouse
let overTimer = null;
const openedAt = new Map();    // when each square was dug, for a little flash
const capsuleAt = new Map();   // when each capsule was dug up, for its pop
const changedAt = new Map();   // when a number changed because bombs moved
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

function formatTime(seconds) {
  const whole = Math.max(0, Math.ceil(seconds - 1e-9));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function key(c) {
  return c.y * game.cols + c.x;
}

function panicking() {
  return !game.classic && game.started && !game.over && game.clock <= SETTINGS.panicTime;
}

function loadSetting(name) {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;  // storage can be blocked, e.g. in private browsing
  }
}

function saveSetting(name, value) {
  try {
    localStorage.setItem(name, String(value));
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
  const rect = boardWrap.getBoundingClientRect();
  cell = Math.floor(Math.min((rect.width - 2 * BORDER) / game.cols, (rect.height - 2 * BORDER) / game.rows));
  cell = clamp(cell, 12, MAX_CELL);
  const w = cell * game.cols;
  const h = cell * game.rows;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  document.documentElement.style.setProperty("--board-width", Math.max(w + 2 * BORDER, 330) + "px");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
}

function cellAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((clientX - rect.left - BORDER) / cell);
  const y = Math.floor((clientY - rect.top - BORDER) / cell);
  return game.cell(x, y);
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

function drawBomb(cx, cy, size, now, alpha = 1) {
  // A grumpy little bomb: neon rim, angry eyebrows, sparking fuse
  const r = size * 0.3;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.55, cy - r * 0.8);
  ctx.quadraticCurveTo(cx + r * 1.0, cy - r * 1.5, cx + r * 1.3, cy - r * 1.25);
  ctx.stroke();
  const spark = 0.5 + 0.5 * Math.sin(now / 70 + cx);
  ctx.fillStyle = `rgba(255, 210, 90, ${0.6 + 0.4 * spark})`;
  ctx.beginPath();
  ctx.arc(cx + r * 1.3, cy - r * 1.25, size * (0.05 + 0.04 * spark), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2A3140";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.pink;
  ctx.lineWidth = Math.max(1.2, size * 0.045);
  ctx.stroke();

  // Angry face
  const eye = r * 0.36;
  ctx.fillStyle = "#FFFFFF";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * eye, cy - r * 0.05, r * 0.16, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#111";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * eye * 0.9, cy, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = Math.max(1.2, size * 0.04);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - eye * 1.6, cy - r * 0.42);
  ctx.lineTo(cx - eye * 0.3, cy - r * 0.22);
  ctx.moveTo(cx + eye * 1.6, cy - r * 0.42);
  ctx.lineTo(cx + eye * 0.3, cy - r * 0.22);
  ctx.moveTo(cx - r * 0.3, cy + r * 0.48);
  ctx.quadraticCurveTo(cx, cy + r * 0.3, cx + r * 0.3, cy + r * 0.48);
  ctx.stroke();
  ctx.restore();
}

function drawFlag(cx, cy, size, gift, wrong) {
  const color = gift ? COLORS.gold : COLORS.pink;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.25;
  ctx.strokeStyle = "#E8EEF4";
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.12, cy + size * 0.28);
  ctx.lineTo(cx - size * 0.12, cy - size * 0.28);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.1, cy - size * 0.28);
  ctx.lineTo(cx + size * 0.26, cy - size * 0.14);
  ctx.lineTo(cx - size * 0.1, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (wrong) {
    // A flag on a square with no bomb, shown when the game ends
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.28, cy - size * 0.28);
    ctx.lineTo(cx + size * 0.28, cy + size * 0.28);
    ctx.moveTo(cx + size * 0.28, cy - size * 0.28);
    ctx.lineTo(cx - size * 0.28, cy + size * 0.28);
    ctx.stroke();
  }
}

function drawCapsuleShape(c, x, y, w, h, kind) {
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

function drawHidden(px, py, square, isHover) {
  const gap = Math.max(1.5, cell * 0.05);
  const body = ctx.createLinearGradient(0, py, 0, py + cell);
  body.addColorStop(0, isHover ? "#2E4258" : COLORS.hiddenTop);
  body.addColorStop(1, isHover ? "#22334A" : COLORS.hiddenBottom);
  roundedRect(ctx, px + gap, py + gap, cell - 2 * gap, cell - 2 * gap, cell * 0.16);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = isHover ? "rgba(111, 227, 255, 0.55)" : "rgba(111, 227, 255, 0.16)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
  ctx.fillRect(px + gap + cell * 0.12, py + gap + 1.5, cell - 2 * gap - cell * 0.24, Math.max(1.5, cell * 0.05));
}

function drawNumber(px, py, value, now, liar) {
  const cx = px + cell / 2;
  const cy = py + cell / 2 + cell * 0.03;
  ctx.font = `900 ${Math.round(cell * 0.56)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (liar) {
    // While the numbers are lying they glitch, so you know not to trust them
    const jitter = Math.sin(now / 40 + px * 3 + py) * cell * 0.04;
    ctx.fillStyle = "rgba(255, 79, 163, 0.75)";
    ctx.fillText(value, cx - cell * 0.04 + jitter, cy);
    ctx.fillStyle = "rgba(111, 227, 255, 0.75)";
    ctx.fillText(value, cx + cell * 0.04 - jitter, cy);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(value, cx, cy);
    return;
  }
  ctx.fillStyle = NUMBER_COLORS[value];
  ctx.shadowColor = NUMBER_COLORS[value];
  ctx.shadowBlur = cell * 0.18;
  ctx.fillText(value, cx, cy);
  ctx.shadowBlur = 0;
}

function drawSquare(square, now) {
  const px = square.x * cell;
  const py = square.y * cell;
  const done = Boolean(game.over);
  const k = key(square);

  if (square.revealed) {
    ctx.fillStyle = COLORS.open;
    ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
    const since = now - (openedAt.get(k) || -1e9);
    if (since < 260) {
      ctx.fillStyle = `rgba(111, 227, 255, ${0.25 * (1 - since / 260)})`;
      ctx.fillRect(px, py, cell, cell);
    }
    const changed = now - (changedAt.get(k) || -1e9);
    if (changed < 1400) {
      ctx.fillStyle = `rgba(245, 197, 66, ${0.4 * (1 - changed / 1400)})`;
      ctx.fillRect(px, py, cell, cell);
    }
    if (game.fogLeft() > 0 && !game.over) {
      // Fog hides what the numbers say
      ctx.fillStyle = "rgba(60, 72, 88, 0.9)";
      ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      const drift = (now / 30 + px) % cell;
      ctx.fillRect(px + 1, py + drift * 0.4, cell - 2, cell * 0.16);
    } else {
      const lying = game.liarLeft() > 0 && !game.over;
      const value = lying ? game.shownNumber(square) : game.number(square);
      if (value > 0) drawNumber(px, py, value, now, lying);
    }
    if (square.capsule) {
      const popAge = now - (capsuleAt.get(k) || -1e9);
      if (popAge < 900) {
        const grow = popAge < 150 ? popAge / 150 : 1;
        ctx.globalAlpha = popAge > 600 ? 1 - (popAge - 600) / 300 : 1;
        drawCapsuleShape(ctx, px + cell / 2, py + cell / 2, cell * 0.8 * grow, cell * 0.4 * grow, "mystery");
        ctx.globalAlpha = 1;
      } else {
        // A little mark so you remember a capsule was here
        ctx.fillStyle = COLORS.pink;
        ctx.beginPath();
        ctx.arc(px + cell * 0.82, py + cell * 0.18, Math.max(1.8, cell * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  if (square.exploded) {
    ctx.fillStyle = "#5A1A20";
    ctx.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
    drawBomb(px + cell / 2, py + cell / 2, cell, now);
    return;
  }
  const isHover = !done && mode === "playing" && hover === square;
  drawHidden(px, py, square, isHover);
  if (square.flagged) {
    drawFlag(px + cell / 2, py + cell / 2, cell, square.gift, done && !game.won && !square.mine);
  } else if (done && square.mine) {
    drawBomb(px + cell / 2, py + cell / 2, cell, now, game.won ? 1 : 0.9);
  } else if (square.mine && game.xrayLeft() > 0 && game.xrayCenter &&
             Math.max(Math.abs(square.x - game.xrayCenter.x), Math.abs(square.y - game.xrayCenter.y)) <= SETTINGS.xrayRadius) {
    // X-ray: a quick look at the bombs nearby
    drawBomb(px + cell / 2, py + cell / 2, cell, now, 0.75);
    ctx.strokeStyle = `rgba(111, 227, 255, ${0.5 + 0.4 * Math.sin(now / 90)})`;
    ctx.lineWidth = 2;
    roundedRect(ctx, px + 2, py + 2, cell - 4, cell - 4, cell * 0.16);
    ctx.stroke();
  }
}

function drawXrayArea(now) {
  if (game.over || game.xrayLeft() <= 0 || !game.xrayCenter) return;
  const r = SETTINGS.xrayRadius;
  const x = (game.xrayCenter.x - r) * cell;
  const y = (game.xrayCenter.y - r) * cell;
  ctx.strokeStyle = `rgba(111, 227, 255, ${0.35 + 0.25 * Math.sin(now / 120)})`;
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, (2 * r + 1) * cell - 2, (2 * r + 1) * cell - 2);
  ctx.setLineDash([]);
}

function drawParticles(dt) {
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.vy += 700 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.globalAlpha = Math.min(1, p.life / 0.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, count, speed = 220) {
  for (let i = 0; i < count && particles.length < 300; i++) {
    const angle = Math.random() * Math.PI * 2;
    const power = speed * (0.4 + Math.random() * 0.8);
    particles.push({ x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power - 100,
      size: 2 + Math.random() * 3.5, color, life: 0.45 + Math.random() * 0.4 });
  }
}

function drawPopups(now) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const w = game.cols * cell;
  popups = popups.filter((popup) => now - popup.born < (popup.life || POPUP_TIME) * 1000);
  for (const popup of popups) {
    const progress = (now - popup.born) / ((popup.life || POPUP_TIME) * 1000);
    const pop = progress < 0.12 ? 0.7 + progress * 2.5 : 1;
    const size = Math.round(clamp(cell * 0.5, 15, 24) * (popup.big ? 1.4 : 1) * pop);
    ctx.font = `900 ${size}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    const textWidth = ctx.measureText(popup.text).width;
    const x = clamp(popup.x, textWidth / 2 + 6, w - textWidth / 2 - 6);
    // Float up, but never off the top of the board
    const rise = cell * 1.2 * progress;
    const y = clamp(clamp(popup.y, size * 1.6, game.rows * cell - size) - rise, size * 0.75, game.rows * cell - size);
    ctx.globalAlpha = 1 - progress * progress;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#0D131A";
    ctx.strokeText(popup.text, x, y);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, x, y);
  }
  ctx.globalAlpha = 1;
}

function draw(now, dt) {
  const dpr = window.devicePixelRatio || 1;
  const w = game.cols * cell;
  const h = game.rows * cell;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (now < shake.until) {
    const s = shake.strength * ((shake.until - now) / 400);
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  ctx.fillStyle = COLORS.board;
  ctx.fillRect(0, 0, w, h);
  for (const square of game.cells) drawSquare(square, now);
  drawXrayArea(now);
  drawParticles(dt);
  drawPopups(now);
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
  bombs: $("bombs"),
  clock: $("clock"),
  clockLabel: $("clock-label"),
  lastCapsule: $("last-capsule"),
  lastCapsuleIcon: $("last-capsule-icon"),
  lastCapsuleText: $("last-capsule-text"),
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
  const left = game.minesLeft();
  setText(hud.bombs, left);
  hud.bombs.classList.toggle("negative", left < 0);
  setText(hud.clockLabel, game.classic ? "TIME" : "LEFT");
  setText(hud.clock, formatTime(game.clockShown()));

  const panic = panicking();
  const frozen = !game.over && game.frozenLeft() > 0;
  hud.clock.classList.toggle("panic", panic && !frozen);
  hud.clock.classList.toggle("frozen", frozen);
  hud.clock.classList.toggle("turbo", !frozen && !panic && game.turboLeft() > 0);
  canvas.classList.toggle("panic", panic && !frozen && mode === "playing");
  canvas.classList.toggle("frozen", frozen);

  for (const effect of EFFECTS) {
    const timeLeft = game.over ? 0 : effect.left();
    effect.pill.hidden = timeLeft <= 0;
    if (timeLeft <= 0) continue;
    effect.pill.firstChild.style.width = ((timeLeft / effect.total()) * 100).toFixed(1) + "%";
    setText(effect.pill.lastChild, effect.noTimer ? effect.name : `${effect.name}  ${timeLeft.toFixed(1)}s`);
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
  overlay.classList.toggle("over", kind === "over" && !game.won);
  overlay.classList.toggle("won", kind === "over" && game.won);
  const keyHint = isTouch ? "" : "or press Space";
  setText($("overlay-eyebrow"), kind === "start" ? "MATT YOUNG PRESENTS" : "");
  setText($("overlay-taunt"), "");
  $("switches").hidden = kind === "paused";   // the mode and size can only change between games
  $("menu-link").hidden = kind === "paused";

  if (kind === "start") {
    setText($("overlay-title"), "CHAOS SWEEPER");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic"
      ? "Just bombs and numbers. Suspiciously calm."
      : "Every number is a promise. Some of them are lies.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Tap to dig. Hold to flag." : "Left click digs, right click flags. Or press Space.");
  } else if (kind === "paused") {
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "The bombs will wait. They're very patient.");
    setText($("overlay-stats"), `Score ${game.score}  ·  ${formatTime(game.clockShown())} ${game.classic ? "so far" : "left"}`);
    setText(playButton, "Resume");
    setText($("overlay-hint"), keyHint);
  } else {
    const newBest = game.score > best;
    if (newBest) {
      best = game.score;
      saveSetting(bestKey(), best);
    }
    const timedOut = game.over.startsWith("Time");
    setText($("overlay-title"), game.won ? "CLEARED!" : timedOut ? "TIME'S UP" : "KABOOM");
    setText($("overlay-reason"), game.over);
    setText($("overlay-stats"), `Score ${game.score}  ·  ${formatTime(game.elapsed)}  ·  ` +
      (newBest ? "New best!" : `Best ${best}`));
    let taunt = game.won ? pick(WIN_LINES)
      : newBest ? "New best, even though you lost. Don't let it go to your head."
      : game.classic ? pick(CLASSIC_TAUNTS) : timedOut ? pick(TIMEOUT_TAUNTS) : pick(LOSE_TAUNTS);
    if (!game.classic) taunt += `  Capsules: ${game.dug.good} good, ${game.dug.bad} bad.`;
    setText($("overlay-taunt"), taunt);
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  clearTimeout(overTimer);
  game = new SweeperGame({ classic: gameMode === "classic", size: sizeName });
  popups = [];
  particles = [];
  openedAt.clear();
  capsuleAt.clear();
  changedAt.clear();
  hover = null;
  hud.lastCapsule.classList.add("empty");
  resizeCanvas();
}

function updateSwitches() {
  document.body.classList.toggle("classic", gameMode === "classic");
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute("aria-checked", String(button.dataset.mode === gameMode));
  }
  for (const button of document.querySelectorAll("[data-size]")) {
    button.setAttribute("aria-checked", String(button.dataset.size === sizeName));
  }
  for (const button of document.querySelectorAll("[data-tool]")) {
    button.setAttribute("aria-checked", String(button.dataset.tool === tool));
  }
}

function setMode(newMode) {
  gameMode = newMode;
  saveSetting(MODE_KEY, newMode);
  best = loadBest();
  updateSwitches();
  if (mode === "start") {
    newGame();
    showOverlay("start");
  }
}

function setSize(newSize) {
  sizeName = newSize;
  saveSetting(SIZE_KEY, newSize);
  updateSwitches();
  if (mode === "start") {
    newGame();
    showOverlay("start");
  }
}

function setTool(newTool) {
  tool = newTool;
  updateSwitches();
}

function startGame() {
  newGame();
  mode = "playing";
  overlay.hidden = true;
  playButton.blur();
  addPopup(game.cols * cell / 2, game.rows * cell / 2, "DIG ANYWHERE. FIRST ONE'S FREE.", COLORS.text, { life: 3, hint: true });
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
  else if (mode === "start" || (mode === "over" && !overlay.hidden)) startGame();
}

function addPopup(x, y, text, color, options = {}) {
  popups.push({ x, y, text, color, born: performance.now(), ...options });
}

function shakeScreen(strength) {
  shake = { until: performance.now() + 400, strength };
}

function middleOf(spot) {
  return [(spot.x + 0.5) * cell, (spot.y + 0.5) * cell];
}

function handleEvents() {
  const now = performance.now();
  for (const event of game.events) {
    switch (event.type) {
      case "reveal":
        popups = popups.filter((p) => !p.hint);
        for (const spot of event.cells) openedAt.set(spot.y * game.cols + spot.x, now);
        if (event.cells.length >= 6) {
          const [x, y] = middleOf(event.cells[0]);
          addPopup(x, y, `+${event.points}`, COLORS.cyan);
        }
        break;
      case "capsule": {
        const [x, y] = middleOf(event);
        capsuleAt.set(event.y * game.cols + event.x, now);
        showLastCapsule(event.kind, event.text);
        addPopup(x, y - cell * 0.3, event.popup, KIND_COLORS[event.kind], { big: true });
        burst(x, y, KIND_COLORS[event.kind], 18);
        if (event.name === "shuffle" || event.name === "plant") shakeScreen(7);
        break;
      }
      case "numbersChanged":
        for (const spot of event.cells) changedAt.set(spot.y * game.cols + spot.x, now);
        break;
      case "flag": {
        const [x, y] = middleOf(event);
        if (event.on) burst(x, y, event.gift ? COLORS.gold : COLORS.pink, 6, 120);
        break;
      }
      case "flagEarly": {
        const [x, y] = middleOf(event);
        addPopup(x, y, "DIG FIRST, GENIUS", COLORS.dim);
        break;
      }
      case "chordNope": {
        if (popups.some((p) => p.text === "COUNT AGAIN")) break;
        const [x, y] = middleOf(event);
        addPopup(x, y, "COUNT AGAIN", COLORS.dim);
        break;
      }
      case "panic":
        addPopup(game.cols * cell / 2, game.rows * cell / 2, "PANIC!", COLORS.red, { big: true });
        shakeScreen(6);
        break;
      case "boom": {
        const [x, y] = middleOf(event);
        burst(x, y, COLORS.red, 50, 380);
        burst(x, y, COLORS.gold, 30, 300);
        shakeScreen(16);
        addPopup(x, y, pick(BOOMS), COLORS.red, { big: true });
        break;
      }
      case "win":
        for (let i = 0; i < 6; i++) {
          burst(Math.random() * game.cols * cell, Math.random() * game.rows * cell, pick([COLORS.gold, COLORS.green, COLORS.cyan]), 20, 300);
        }
        addPopup(game.cols * cell / 2, game.rows * cell / 2, `+${event.bonus} CLEARED!`, COLORS.gold, { big: true });
        break;
      case "over":
        mode = "over";
        if (!event.won && event.reason.startsWith("Time")) {
          addPopup(game.cols * cell / 2, game.rows * cell / 2, "TIME'S UP", COLORS.red, { big: true });
        }
        // Let them see the board (and every bomb they missed) before the panel covers it
        overTimer = setTimeout(() => showOverlay("over"), OVER_DELAY);
        break;
    }
  }
  game.events = [];
}

function act(square, action) {
  if (mode !== "playing" || !square) return;
  if (action === "flag") game.toggleFlag(square.x, square.y);
  else game.dig(square.x, square.y);
  handleEvents();
}

// ---------- Controls ----------

document.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    if (event.target.closest && event.target.closest("button, a")) return;  // let buttons work normally
    event.preventDefault();
    if (!event.repeat) primaryAction();
  } else if (event.code === "KeyP" || event.code === "Escape") {
    if (mode === "playing") pause();
    else resume();
  } else if (event.code === "KeyF") {
    setTool(tool === "dig" ? "flag" : "dig");
  }
});

// Mouse: left click digs (or flags, if the switch says so), right click or Shift+click flags.
// Fingers: tap does whatever the switch says, holding a finger down plants a flag.
let press = null;
boardWrap.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("pointerdown", (event) => {
  if (mode !== "playing") return;
  const square = cellAt(event.clientX, event.clientY);
  if (!square) return;
  if (event.pointerType === "mouse") {
    if (event.button === 2 || event.shiftKey) act(square, "flag");
    else if (event.button === 0) act(square, tool);
    return;
  }
  event.preventDefault();
  press = { id: event.pointerId, square, x: event.clientX, y: event.clientY, held: false };
  press.timer = setTimeout(() => {
    if (!press || press.id !== event.pointerId) return;
    press.held = true;
    act(press.square, "flag");
    if (navigator.vibrate) navigator.vibrate(18);
  }, LONG_PRESS);
});
canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse") {
    hover = cellAt(event.clientX, event.clientY);
    return;
  }
  if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 14) {
    clearTimeout(press.timer);
    press = null;
  }
});
canvas.addEventListener("pointerleave", () => (hover = null));
canvas.addEventListener("pointerup", (event) => {
  if (!press || press.id !== event.pointerId) return;
  clearTimeout(press.timer);
  if (!press.held) act(press.square, tool);
  press = null;
});
canvas.addEventListener("pointercancel", () => {
  if (press) clearTimeout(press.timer);
  press = null;
});

$("pause-button").addEventListener("click", () => {
  if (mode === "playing") pause();
  else resume();
});
playButton.addEventListener("click", primaryAction);
for (const button of document.querySelectorAll("[data-mode]")) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}
for (const button of document.querySelectorAll("[data-size]")) {
  button.addEventListener("click", () => setSize(button.dataset.size));
}
for (const button of document.querySelectorAll("[data-tool]")) {
  button.addEventListener("click", () => setTool(button.dataset.tool));
}

// Pause if you switch tabs, lock your phone or click away from the window
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", pause);

new ResizeObserver(() => resizeCanvas()).observe(boardWrap);

// ---------- Start up ----------

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (mode === "playing") {
    game.update(dt);
    handleEvents();
  }
  updateHud();
  draw(now, mode === "paused" ? 0 : dt);
  requestAnimationFrame(frame);
}

for (const element of document.querySelectorAll("[data-setting]")) {
  element.textContent = SETTINGS[element.dataset.setting];
}
for (const element of document.querySelectorAll("[data-par]")) {
  element.textContent = formatTime(SIZES[element.dataset.par].par);
}
for (const icon of document.querySelectorAll("canvas[data-capsule]")) {
  paintIcon(icon, icon.dataset.capsule);
}

updateSwitches();
newGame();  // a fresh board sits behind the start screen
showOverlay("start");
requestAnimationFrame(frame);
