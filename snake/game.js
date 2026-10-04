// Drawing, controls and screens for Rage Quit Snake. The rules live in logic.js.
"use strict";

const COLORS = {
  boardDark: "#18222D",
  boardLight: "#1C2834",
  text: "#E8EEF4",
  dim: "#8090A0",
  green: "#7BD65B",
  red: "#F05A4F",
  gold: "#F5C542",
  purple: "#B98AF0",
  head: "#8BE05F",
  bodyStart: "#6FCF4E",
  bodyEnd: "#2C7A3A",
  deadHead: "#E2574C",
  deadStart: "#D0493F",
  deadEnd: "#6E2420",
};
// Every apple on the board is the normal red one. The other colors only show
// up next to the score, to reveal what an apple really was.
const APPLES = {
  normal: { skin: "#E8453C", shine: "#FF9A8F" },
  benefit: { skin: "#F5C542", shine: "#FFF2B8" },
  bad: { skin: "#9B4DCA", shine: "#E0BFFF" },
};
const TYPE_COLORS = { normal: COLORS.text, benefit: COLORS.gold, bad: COLORS.purple };

const FULL_COLS = 39;      // the same board size as the Python version...
const FULL_ROWS = 36;
const MIN_FULL_CELL = 14;  // ...as long as each cell can be at least this many pixels
const SMALL_CELL = 20;     // otherwise (phones) use fewer, bigger cells
const MIN_CELLS = 12;
const BORDER = 4;          // the board's border width in style.css

const POPUP_TIME = 0.9;
const SWIPE_DISTANCE = 24;
const BEST_KEY = "mjy-snake-best";  // kept from the old name so saved best scores still load
const HEAD_ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
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

let game = null;          // the current SnakeGame
let mode = "start";       // "start", "playing", "paused" or "over"
let cols = FULL_COLS;
let rows = FULL_ROWS;
let cell = 20;            // size of one grid cell in CSS pixels
let background = null;    // the checkerboard, drawn once whenever the board is resized
let popups = [];
let best = loadBest();
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

function setText(element, text) {
  // Only touch the page when something actually changed
  text = String(text);
  if (element.textContent !== text) element.textContent = text;
}

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;  // storage can be blocked, e.g. in private browsing
  }
}

function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // not being able to save the best score isn't worth stopping the game for
  }
}

// ---------- Board size ----------

function boardSpace() {
  const rect = boardWrap.getBoundingClientRect();
  return { width: rect.width - 2 * BORDER, height: rect.height - 2 * BORDER };
}

function chooseGrid() {
  const { width, height } = boardSpace();
  if (width / FULL_COLS >= MIN_FULL_CELL && height / FULL_ROWS >= MIN_FULL_CELL) {
    return [FULL_COLS, FULL_ROWS];
  }
  return [
    clamp(Math.floor(width / SMALL_CELL), MIN_CELLS, FULL_COLS),
    clamp(Math.floor(height / SMALL_CELL), MIN_CELLS, FULL_ROWS),
  ];
}

function resizeCanvas() {
  // The grid stays the same mid-game; only the size of each cell changes
  const { width, height } = boardSpace();
  cell = Math.max(6, Math.floor(Math.min(width / cols, height / rows)));
  const w = cell * cols;
  const h = cell * rows;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  document.documentElement.style.setProperty("--board-width", w + 2 * BORDER + "px");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  background = document.createElement("canvas");
  background.width = canvas.width;
  background.height = canvas.height;
  const bg = background.getContext("2d");
  bg.setTransform(dpr, 0, 0, dpr, 0, 0);
  bg.fillStyle = COLORS.boardDark;
  bg.fillRect(0, 0, w, h);
  bg.fillStyle = COLORS.boardLight;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      if ((x + y) % 2 === 0) bg.fillRect(x * cell, y * cell, cell, cell);
    }
  }
}

// ---------- Drawing ----------

function roundedRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawApple(c, cx, cy, size, kind) {
  // Designed on a 20px cell, then scaled to fit
  const colors = APPLES[kind];
  c.save();
  c.translate(cx, cy);
  c.scale(size / 20, size / 20);

  c.beginPath();
  c.ellipse(0, 1, 8.5, 8, 0, 0, Math.PI * 2);
  c.fillStyle = colors.skin;
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = blend(colors.skin, "#000000", 0.25);
  c.stroke();

  c.beginPath();
  c.ellipse(-3.2, -1.5, 1.6, 2.6, (20 * Math.PI) / 180, 0, Math.PI * 2);
  c.fillStyle = colors.shine;
  c.fill();

  c.beginPath();
  c.moveTo(-0.8, -5.5);
  c.lineTo(0.8, -5.5);
  c.lineTo(1.8, -10.5);
  c.lineTo(0.4, -10.5);
  c.closePath();
  c.fillStyle = "#7A5230";
  c.fill();

  c.beginPath();
  c.ellipse(4.6, -9.2, 3.6, 1.6, (-25 * Math.PI) / 180, 0, Math.PI * 2);
  c.fillStyle = "#5DBB63";
  c.fill();
  c.restore();
}

function drawSegment(segment, fill) {
  const size = cell * 0.9;
  const x = segment.x * cell + (cell - size) / 2;
  const y = segment.y * cell + (cell - size) / 2;
  roundedRect(ctx, x, y, size, size, cell * 0.18);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = blend(fill, "#000000", 0.3);
  ctx.stroke();
}

function drawHead(segment, heading, dead, now) {
  // Drawn facing up, then turned to face the way the snake is going
  ctx.save();
  ctx.translate((segment.x + 0.5) * cell, (segment.y + 0.5) * cell);
  ctx.rotate(HEAD_ANGLE[heading]);
  ctx.scale(cell / 20, cell / 20);

  const skin = dead ? COLORS.deadHead : COLORS.head;
  roundedRect(ctx, -10, -10, 20, 20, 5);
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = blend(skin, "#000000", 0.3);
  ctx.stroke();

  for (const side of [-1, 1]) {
    if (dead) {
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(4.5 * side - 2.3, -5.3);
      ctx.lineTo(4.5 * side + 2.3, -0.7);
      ctx.moveTo(4.5 * side + 2.3, -5.3);
      ctx.lineTo(4.5 * side - 2.3, -0.7);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(4.5 * side, -3, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4.5 * side, -4.3, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = "#111111";
      ctx.fill();
    }
  }

  // The tongue flicks in and out
  if (!dead && now % 1400 < 700) {
    ctx.beginPath();
    ctx.moveTo(-0.8, -9);
    ctx.lineTo(0.8, -9);
    ctx.lineTo(0.8, -12.5);
    ctx.lineTo(2.6, -15);
    ctx.lineTo(1.6, -15.6);
    ctx.lineTo(0, -13.6);
    ctx.lineTo(-1.6, -15.6);
    ctx.lineTo(-2.6, -15);
    ctx.lineTo(-0.8, -12.5);
    ctx.closePath();
    ctx.fillStyle = "#FF4D6D";
    ctx.fill();
  }
  ctx.restore();
}

function drawSnake(now) {
  const segments = game.segments;
  const dead = Boolean(game.over);
  const bodyLength = segments.length - 1;

  // Tail first, so each segment sits on top of the one behind it
  for (let i = segments.length - 1; i >= 1; i--) {
    const shade = bodyLength > 1 ? (i - 1) / (bodyLength - 1) : 0;
    const fill = dead
      ? blend(COLORS.deadStart, COLORS.deadEnd, shade)
      : blend(COLORS.bodyStart, COLORS.bodyEnd, shade);
    drawSegment(segments[i], fill);
  }
  if (segments.length > 0) drawHead(segments[0], game.heading, dead, now);
}

function drawPopups(now) {
  const scale = clamp(cell / 20, 0.8, 1.4);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${Math.round(15 * scale)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.lineJoin = "round";

  popups = popups.filter((popup) => now - popup.born < POPUP_TIME * 1000);
  for (const popup of popups) {
    const progress = (now - popup.born) / (POPUP_TIME * 1000);
    const x = (popup.x + 0.5) * cell;
    const y = (popup.y + 0.5) * cell - 8 * scale - 35 * scale * progress;
    ctx.globalAlpha = 1 - progress * progress;
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.boardDark;
    ctx.strokeText(popup.text, x, y);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, x, y);
  }
  ctx.globalAlpha = 1;
}

function draw(now) {
  ctx.clearRect(0, 0, cols * cell, rows * cell);
  ctx.drawImage(background, 0, 0, cols * cell, rows * cell);
  for (const food of game.foods) {
    if (food) drawApple(ctx, (food.x + 0.5) * cell, (food.y + 0.5) * cell, cell, "normal");
  }
  drawSnake(now);
  drawPopups(now);
}

function paintIcon(iconCanvas, kind) {
  const dpr = window.devicePixelRatio || 1;
  iconCanvas.width = 20 * dpr;
  iconCanvas.height = 20 * dpr;
  const c = iconCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, 20, 20);
  drawApple(c, 10, 10.5, 18, kind);
}

// ---------- Scoreboard ----------

const hud = {
  score: $("score"),
  length: $("length"),
  speed: $("speed"),
  hungerLabel: $("hunger-label"),
  hungerFill: $("hunger-fill"),
  lastFood: $("last-food"),
  lastFoodIcon: $("last-food-icon"),
  lastFoodText: $("last-food-text"),
  reversed: $("pill-reversed"),
  drunk: $("pill-drunk"),
};

function hungerColor(hunger) {
  // Green when it's just lost a segment, turning yellow then red as the next one gets close
  if (hunger < 0.5) return blend(COLORS.green, COLORS.gold, hunger * 2);
  return blend(COLORS.gold, COLORS.red, (hunger - 0.5) * 2);
}

function updatePill(pill, name, timeLeft) {
  pill.hidden = timeLeft <= 0;
  if (timeLeft <= 0) return;
  // The pill drains from full to empty as the effect wears off
  pill.querySelector(".pill-fill").style.width = ((timeLeft / SETTINGS.effectTime) * 100).toFixed(1) + "%";
  setText(pill.querySelector(".pill-text"), `${name}  ${timeLeft.toFixed(1)}s`);
}

function updateHud() {
  setText(hud.score, game.score);
  setText(hud.length, game.segments.length);
  setText(hud.speed, game.speed.toFixed(2) + "x");

  const starving = game.segments.length === 1;
  setText(hud.hungerLabel, starving ? "STARVING!" : "HUNGER");
  hud.hungerLabel.classList.toggle("starving", starving);
  hud.hungerFill.style.width = (Math.min(game.hunger, 1) * 100).toFixed(1) + "%";
  hud.hungerFill.style.background = starving ? COLORS.red : hungerColor(game.hunger);

  updatePill(hud.reversed, "REVERSED", game.reversedLeft());
  updatePill(hud.drunk, "DRUNK", game.drunkLeft());
}

function showLastFood(kind, text) {
  paintIcon(hud.lastFoodIcon, kind);
  setText(hud.lastFoodText, text);
  hud.lastFoodText.style.color = TYPE_COLORS[kind];
  hud.lastFood.classList.remove("empty");
}

// ---------- Screens ----------

function showOverlay(kind) {
  overlay.hidden = false;
  overlay.classList.toggle("over", kind === "over");
  const keyHint = isTouch ? "" : "or press Space";

  if (kind === "start") {
    setText($("overlay-eyebrow"), "MATT YOUNG PRESENTS");
    setText($("overlay-title"), "RAGE QUIT SNAKE");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), "Every apple is a mystery.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Swipe on the board or use the arrows to steer" : "or press Space");
  } else if (kind === "paused") {
    setText($("overlay-eyebrow"), "");
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), `Score ${game.score}`);
    setText(playButton, "Resume");
    setText($("overlay-hint"), keyHint);
  } else {
    const newBest = game.score > best;
    if (newBest) {
      best = game.score;
      saveBest(best);
    }
    setText($("overlay-eyebrow"), "");
    setText($("overlay-title"), "GAME OVER");
    setText($("overlay-reason"), game.over);
    setText($("overlay-stats"),
      `Score ${game.score}  ·  Longest ${game.longest}  ·  ` + (newBest ? "New best!" : `Best ${best}`));
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  [cols, rows] = chooseGrid();
  game = new SnakeGame(cols, rows);
  popups = [];
  resizeCanvas();
  hud.lastFood.classList.add("empty");
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

function handleEvents() {
  const now = performance.now();
  for (const event of game.events) {
    if (event.type === "ate") {
      showLastFood(event.food, event.text);
      popups.push({ x: event.x, y: event.y, text: event.popup, color: TYPE_COLORS[event.food], born: now });
    } else if (event.type === "lost") {
      popups.push({ x: event.x, y: event.y, text: "-1", color: COLORS.dim, born: now });
    } else if (event.type === "over") {
      mode = "over";
      showOverlay("over");
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
      game.press(direction);
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

// Swipe anywhere on the board. You can keep your finger down and swipe again to turn again.
let swipeStart = null;
boardWrap.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".panel")) return;  // let the buttons on the overlay work normally
  swipeStart = { x: event.clientX, y: event.clientY };
});
boardWrap.addEventListener("pointermove", (event) => {
  if (!swipeStart || mode !== "playing") return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
  if (Math.abs(dx) > Math.abs(dy)) game.press(dx > 0 ? "right" : "left");
  else game.press(dy > 0 ? "down" : "up");
  swipeStart = { x: event.clientX, y: event.clientY };
});
for (const type of ["pointerup", "pointercancel"]) {
  boardWrap.addEventListener(type, () => (swipeStart = null));
}

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

// Pause if you switch tabs, lock your phone or click away from the window
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("blur", pause);

new ResizeObserver(() => resizeCanvas()).observe(boardWrap);

// ---------- Start up ----------

function frame(now) {
  // Never jump more than a tenth of a second, so a slow frame can't make the snake skip
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  if (mode === "playing") {
    game.update(dt);
    handleEvents();
  }
  updateHud();
  draw(now);
  requestAnimationFrame(frame);
}

for (const element of document.querySelectorAll("[data-setting]")) {
  element.textContent = SETTINGS[element.dataset.setting];
}
for (const icon of document.querySelectorAll("canvas[data-apple]")) {
  paintIcon(icon, icon.dataset.apple);
}

newGame();  // a fresh board sits behind the start screen
showOverlay("start");
requestAnimationFrame(frame);
