// Drawing, controls and screens for Chaos Snake. The rules live in logic.js.
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
  orange: "#FFA24C",
  cyan: "#6FE3FF",
  fog: "5, 8, 12",   // as "r, g, b" so it can fade
  ghost: "#DDEFFF",
};
// How the snake looks. Drunk turns it purple and reversed turns it orange, so it's obvious.
const LOOKS = {
  normal: { head: "#8BE05F", start: "#6FCF4E", end: "#2C7A3A" },
  drunk: { head: "#C08CFF", start: "#A66BEA", end: "#5B2E91" },
  reversed: { head: "#FFB25C", start: "#F59A3C", end: "#9A4B12" },
  dead: { head: "#E2574C", start: "#D0493F", end: "#6E2420" },
};
// Every apple on the board is the normal red one (apart from the rainbow apple). The other
// colors only show up next to the score, to reveal what an apple really was.
const APPLES = {
  normal: { skin: "#E8453C", shine: "#FF9A8F" },
  benefit: { skin: "#F5C542", shine: "#FFF2B8" },
  bad: { skin: "#9B4DCA", shine: "#E0BFFF" },
  jackpot: { rainbow: true, shine: "#FFFFFF" },
};
const TYPE_COLORS = { normal: COLORS.text, benefit: COLORS.gold, bad: COLORS.purple, jackpot: "#FFD45C" };

// The countdown pills above the board, in the order they appear
const EFFECTS = [
  { name: "REVERSED", color: "orange", left: () => game.reversedLeft(), total: () => SETTINGS.effectTime },
  { name: "DRUNK", color: "purple", left: () => game.drunkLeft(), total: () => SETTINGS.effectTime },
  { name: "FOG", color: "grey", left: () => game.fogLeft(), total: () => SETTINGS.fogTime },
  { name: "RUNAWAY", color: "red", left: () => game.runawayLeft(), total: () => SETTINGS.effectTime },
  { name: "GHOST", color: "cyan", left: () => game.ghostLeft(), total: () => SETTINGS.effectTime },
  { name: "SHIELD", color: "cyan", left: () => (game.shield ? 1 : 0), total: () => 1, noTimer: true },
  { name: "COMBO", color: "gold", left: () => game.comboLeft(), total: () => SETTINGS.comboTime,
    label: () => `COMBO ×${game.combo}` },
];

const FULL_COLS = 39;      // the same board size as the Python version...
const FULL_ROWS = 36;
const MIN_FULL_CELL = 14;  // ...as long as each cell can be at least this many pixels
const SMALL_CELL = 20;     // otherwise (phones) use fewer, bigger cells
const MIN_CELLS = 12;
const BORDER = 4;          // the board's border width in style.css

const POPUP_TIME = 0.9;
const FLASH_TIME = 2;      // effects flash on and off for their last 2 seconds
const SWIPE_DISTANCE = 24;
const BEST_KEY = "mjy-snake-best";  // kept from the old name so saved best scores still load
const MODE_KEY = "mjy-snake-mode";
const HEAD_ANGLE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const KEY_DIRECTIONS = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};
// A lumpy boulder, designed on a 20px cell
const ROCK_SHAPE = [[-8, 4], [-7, -3], [-3, -8], [3, -7], [8, -2], [8, 5], [3, 8], [-4, 8]];

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
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" or "classic"
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

function saveBest(score) {
  saveSetting(bestKey(), score);
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

function centerOf(spot) {
  return [(spot.x + 0.5) * cell, (spot.y + 0.5) * cell];
}

function drawApple(c, cx, cy, size, colors) {
  // Designed on a 20px cell, then scaled to fit
  c.save();
  c.translate(cx, cy);
  c.scale(size / 20, size / 20);

  c.beginPath();
  c.ellipse(0, 1, 8.5, 8, 0, 0, Math.PI * 2);
  if (colors.rainbow) {
    const rainbow = c.createLinearGradient(-8, -7, 8, 9);
    ["#FF4D4D", "#FFA23A", "#FFE14D", "#5DDB6A", "#4DB8FF", "#B57BFF"].forEach((color, i, all) =>
      rainbow.addColorStop(i / (all.length - 1), color));
    c.fillStyle = rainbow;
  } else {
    c.fillStyle = colors.skin;
  }
  c.fill();
  c.lineWidth = 1;
  c.strokeStyle = colors.outline || (colors.skin ? blend(colors.skin, "#000000", 0.25) : "#5A3A10");
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

function drawSparkle(x, y, size) {
  // A little four-pointed star
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x, y, x + size, y);
  ctx.quadraticCurveTo(x, y, x, y + size);
  ctx.quadraticCurveTo(x, y, x - size, y);
  ctx.quadraticCurveTo(x, y, x, y - size);
  ctx.fill();
}

function drawJackpot(now) {
  const jackpot = game.jackpot;
  const [cx, cy] = centerOf(jackpot);
  const timeLeft = jackpot.until - game.time;
  // Blink during its last moments so you know it's about to vanish
  if (timeLeft < 1.5 && Math.floor(now / 120) % 2 === 0) return;

  const pulse = 0.5 + 0.5 * Math.sin(now / 160);
  const glow = ctx.createRadialGradient(cx, cy, cell * 0.2, cx, cy, cell * (0.9 + 0.2 * pulse));
  glow.addColorStop(0, "rgba(255, 240, 180, 0.55)");
  glow.addColorStop(1, "rgba(255, 240, 180, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - cell * 1.2, cy - cell * 1.2, cell * 2.4, cell * 2.4);

  const hue = (now / 6) % 360;
  drawApple(ctx, cx, cy, cell * 1.05, {
    skin: `hsl(${hue}, 85%, 58%)`,
    shine: `hsl(${hue}, 90%, 88%)`,
    outline: `hsl(${hue}, 70%, 30%)`,
  });

  ctx.fillStyle = "#FFFFFF";
  for (let k = 0; k < 3; k++) {
    const angle = now / 380 + (k * Math.PI * 2) / 3;
    const twinkle = 0.6 + 0.4 * Math.sin(now / 90 + k * 2);
    drawSparkle(cx + Math.cos(angle) * cell * 0.7, cy + Math.sin(angle) * cell * 0.7, cell * 0.16 * twinkle);
  }
}

function drawRock(rock) {
  const [cx, cy] = centerOf(rock);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((rock.x * 7 + rock.y * 3) % 4) * (Math.PI / 2));  // so they don't all look the same
  ctx.scale(cell / 20, cell / 20);
  ctx.beginPath();
  ROCK_SHAPE.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = "#7D8794";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#3E4651";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -2);
  ctx.lineTo(-2, -5);
  ctx.lineTo(2, -5);
  ctx.strokeStyle = "#AAB3BE";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, 1);
  ctx.lineTo(4, 3);
  ctx.lineTo(3, 6);
  ctx.strokeStyle = "#4E5763";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
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

function drawHead(segment, skin, dead, wobble, now) {
  // Drawn facing up, then turned to face the way the snake is going
  ctx.save();
  ctx.translate(...centerOf(segment));
  ctx.rotate(HEAD_ANGLE[game.heading] + wobble);
  ctx.scale(cell / 20, cell / 20);

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
  if (segments.length === 0) return;
  const dead = Boolean(game.over);
  const drunk = !dead && showing(game.drunkLeft(), now);
  const reversed = !dead && showing(game.reversedLeft(), now);
  const ghost = !dead && showing(game.ghostLeft(), now);
  const bodyLength = segments.length - 1;

  const lookFor = (index) => {
    if (dead) return LOOKS.dead;
    if (drunk && reversed) return index % 2 === 0 ? LOOKS.reversed : LOOKS.drunk;  // stripes
    if (drunk) return LOOKS.drunk;
    if (reversed) return LOOKS.reversed;
    return LOOKS.normal;
  };
  // A ghost is pale and see-through
  const paint = (color) => (ghost ? blend(color, COLORS.ghost, 0.55) : color);
  ctx.globalAlpha = ghost ? 0.7 : 1;

  // Tail first, so each segment sits on top of the one behind it
  for (let i = segments.length - 1; i >= 1; i--) {
    const look = lookFor(i);
    const shade = bodyLength > 1 ? (i - 1) / (bodyLength - 1) : 0;
    drawSegment(segments[i], paint(blend(look.start, look.end, shade)));
  }

  const headLook = dead ? LOOKS.dead : drunk ? LOOKS.drunk : reversed ? LOOKS.reversed : LOOKS.normal;
  const wobble = !dead && game.drunkLeft() > 0 ? Math.sin(now / 110) * 0.2 : 0;
  drawHead(segments[0], paint(headLook.head), dead, wobble, now);
  ctx.globalAlpha = 1;

  if (game.shield && !dead) {
    const [cx, cy] = centerOf(segments[0]);
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(111, 227, 255, 0.15)";
    ctx.fill();
    ctx.strokeStyle = COLORS.cyan;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 150);
    ctx.lineWidth = Math.max(2.5, cell * 0.14);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawFog() {
  const timeLeft = game.fogLeft();
  if (timeLeft <= 0 || game.segments.length === 0) return;
  // Darkness everywhere except a small circle around the head; it lifts gently at the end
  const strength = Math.min(1, timeLeft / 0.4) * 0.97;
  const [cx, cy] = centerOf(game.segments[0]);
  const fog = ctx.createRadialGradient(cx, cy, cell * 2.5, cx, cy, cell * (SETTINGS.fogRadius + 0.5));
  fog.addColorStop(0, `rgba(${COLORS.fog}, 0)`);
  fog.addColorStop(1, `rgba(${COLORS.fog}, ${strength})`);
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, cols * cell, rows * cell);
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
    const [x, centerY] = centerOf(popup);
    const y = centerY - 8 * scale - (popup.row || 0) * 18 * scale - 35 * scale * progress;
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
  for (const rock of game.rocks) drawRock(rock);

  // Runaway apples bounce nervously
  const running = game.runawayLeft() > 0;
  game.foods.forEach((food, i) => {
    if (!food) return;
    const [cx, cy] = centerOf(food);
    const bob = running ? Math.sin(now / 70 + i * 2) * cell * 0.12 : 0;
    drawApple(ctx, cx, cy + bob, cell, APPLES.normal);
  });
  if (game.jackpot) drawJackpot(now);

  drawSnake(now);
  drawFog();
  drawPopups(now);
}

function paintIcon(iconCanvas, kind) {
  const dpr = window.devicePixelRatio || 1;
  iconCanvas.width = 20 * dpr;
  iconCanvas.height = 20 * dpr;
  const c = iconCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, 20, 20);
  drawApple(c, 10, 10.5, 18, APPLES[kind]);
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

function hungerColor(hunger) {
  // Green when it's just lost a segment, turning yellow then red as the next one gets close
  if (hunger < 0.5) return blend(COLORS.green, COLORS.gold, hunger * 2);
  return blend(COLORS.gold, COLORS.red, (hunger - 0.5) * 2);
}

function updateEffects() {
  for (const effect of EFFECTS) {
    const timeLeft = effect.left();
    effect.pill.hidden = timeLeft <= 0;
    if (timeLeft <= 0) continue;
    // Each pill drains from full to empty as the effect wears off
    effect.pill.firstChild.style.width = ((timeLeft / effect.total()) * 100).toFixed(1) + "%";
    const name = effect.label ? effect.label() : effect.name;
    setText(effect.pill.lastChild, effect.noTimer ? name : `${name}  ${timeLeft.toFixed(1)}s`);
  }
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
  updateEffects();
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
  setText($("overlay-eyebrow"), kind === "start" ? "MATT YOUNG PRESENTS" : "");
  setText($("overlay-breakdown"), "");
  $("modes").hidden = kind === "paused";  // the mode can only change between games

  if (kind === "start") {
    setText($("overlay-title"), "CHAOS SNAKE");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic" ? "Plain old snake. No surprises." : "Every apple is a mystery.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Swipe on the board or use the arrows to steer" : "or press Space");
  } else if (kind === "paused") {
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
    const ate = game.eaten;
    setText($("overlay-title"), "GAME OVER");
    setText($("overlay-reason"), game.over);
    setText($("overlay-stats"),
      `Score ${game.score}  ·  Longest ${game.longest}  ·  ` + (newBest ? "New best!" : `Best ${best}`));
    if (!game.classic) {
      setText($("overlay-breakdown"),
        `Ate ${ate.normal} normal · ${ate.benefit} benefit · ${ate.bad} bad · ${ate.jackpot} rainbow`);
    }
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  [cols, rows] = chooseGrid();
  game = new SnakeGame(cols, rows, { classic: gameMode === "classic" });
  popups = [];
  resizeCanvas();
  hud.lastFood.classList.add("empty");
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

function addPopup(spot, text, color, row = 0) {
  popups.push({ x: spot.x, y: spot.y, text, color, row, born: performance.now() });
}

function handleEvents() {
  for (const event of game.events) {
    if (event.type === "ate") {
      if (!game.classic) showLastFood(event.food, event.text);
      addPopup(event, event.popup, TYPE_COLORS[event.food]);
      if (event.combo >= 2) addPopup(event, `COMBO ×${event.combo}`, COLORS.gold, 1);
    } else if (event.type === "lost") {
      addPopup(event, "-1", COLORS.dim);
    } else if (event.type === "saved") {
      addPopup(event, "SAVED!", COLORS.cyan);
    } else if (event.type === "jackpot") {
      addPopup(event, "RAINBOW!", TYPE_COLORS.jackpot);
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

setMode(gameMode);  // also puts a fresh board behind the start screen
requestAnimationFrame(frame);
