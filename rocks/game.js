// Drawing, controls and screens for Chaos Rocks. The rules live in logic.js.
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
  fog: "4, 6, 12",
};
// Each rock gets one of these, as [light, dark]
const ROCK_COLORS = [
  ["#FF9A6B", "#A8442A"], ["#A98BFF", "#4E35A0"], ["#5FE0D2", "#1F7A73"],
  ["#FFD36B", "#A8741A"], ["#FF7FA8", "#A3335C"], ["#8EE06A", "#3B7F2C"],
];
// How the ship looks. Drunk turns it purple and reversed turns it orange, so it's obvious.
const LOOKS = {
  normal: { light: "#A6F0FF", dark: "#1E8FBF" },
  drunk: { light: "#D2A8FF", dark: "#6B3FA0" },
  reversed: { light: "#FFC27A", dark: "#B05A14" },
};
const KIND_COLORS = { good: COLORS.green, bad: COLORS.purple };
const TAU = Math.PI * 2;

// The countdown pills above the board, in the order they appear
const EFFECTS = [
  { name: "REVERSED", color: "orange", left: () => game.reversedLeft(), total: () => SETTINGS.effectTime },
  { name: "DRUNK", color: "purple", left: () => game.drunkLeft(), total: () => SETTINGS.effectTime },
  { name: "BLACK HOLE", color: "pink", left: () => game.holeLeft(), total: () => SETTINGS.holeTime },
  { name: "FOG", color: "grey", left: () => game.fogLeft(), total: () => SETTINGS.fogTime },
  { name: "MORE ROCKS", color: "red", left: () => game.splitsLeft(), total: () => SETTINGS.effectTime },
  { name: "SLIPPERY", color: "grey", left: () => game.slipperyLeft(), total: () => SETTINGS.effectTime },
  { name: "CURVY", color: "red", left: () => game.curvyLeft(), total: () => SETTINGS.effectTime },
  { name: "SHIELD", color: "cyan", left: () => game.shieldLeft(), total: () => SETTINGS.shieldTime },
  { name: "RAPID", color: "gold", left: () => game.rapidLeft(), total: () => SETTINGS.effectTime },
  { name: "SPREAD", color: "green", left: () => game.spreadLeft(), total: () => SETTINGS.effectTime },
  { name: "SLOW-MO", color: "cyan", left: () => game.slowLeft(), total: () => SETTINGS.effectTime },
];

// The sass
const DEATH_POPUPS = {
  rock: ["BONK", "SPLAT", "SPACE DUST", "THAT WAS A ROCK", "WHOOPS", "YOU HAD ONE JOB"],
  ufo: ["GOT YOU", "UFO: 1, YOU: 0", "OUCH", "OWNED BY A SAUCER"],
  hole: ["SPAGHETTI'D", "BYE BYE", "YOINK", "INTO THE VOID"],
  hyper: ["HYPERSPACE ROULETTE", "BAD JUMP", "CONFETTI MODE"],
};
const UFO_ARRIVES = ["HELLO, LOSER", "BEEP BOOP", "I'M HERE TO JUDGE", "NICE SHIP. NOT.", "MIND IF I SHOOT?"];
const UFO_SHOTS = ["PEW", "TAKE THAT", "LOL", "DODGE THIS", "PEW PEW"];
const UFO_DOWN = ["UFO DOWN. RUDE.", "SEE YA, SAUCER", "NOT SO TOUGH NOW"];
const WAVE_LINES = ["The rocks have filed a complaint.", "Okay, sharpshooter.", "More rocks. Obviously.",
  "Space is getting crowded.", "They brought friends.", "Don't let it go to your head."];
const TAUNTS = ["Space: 1. You: 0.", "The rocks would like to thank you for coming.", "That ship had a family.",
  "Rage quit? Totally understandable.", "Have you tried shooting the rocks?", "Houston, we have a skill issue.",
  "Somewhere, a rock is telling its friends about you."];
const CLASSIC_TAUNTS = ["Classic mode. Classic crash.", "No tricks, just rocks. Still lost.",
  "The plain version got you. Wow.", "Retro? More like retr-oh no."];

const BORDER = 4;          // the board's border width in style.css
const POPUP_TIME = 1.0;
const FLASH_TIME = 2;      // effects flash on and off for their last 2 seconds
const MAX_PARTICLES = 420;
const FOG_RADIUS = 170;
const SHIP_SCALE = 1.35;   // the ship is drawn a bit bigger than it collides, so it's easy to see
const BEST_KEY = "mjy-rocks-best";
const MODE_KEY = "mjy-rocks-mode";
const W = SETTINGS.width;
const H = SETTINGS.height;

const $ = (id) => document.getElementById(id);
const boardWrap = $("board-wrap");
const canvas = $("board");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const playButton = $("play-button");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

let game = null;          // the current RockGame
let mode = "start";       // "start", "playing", "paused" or "over"
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" or "classic"
let best = loadBest();
let scale = 1;            // CSS pixels per board unit
let backdrop = null;      // the starfield and nebula, drawn once whenever the board is resized
let popups = [];
let particles = [];
let rings = [];           // expanding circles for bombs and hyperspace jumps
let banner = null;        // the big "WAVE 2" message
let shake = { until: 0, strength: 0 };
let hintUntil = 0;        // when the "how to fly" hint at the start of a game goes away
const keys = { left: false, right: false, up: false, fire: false };
const touch = { aim: null, thrust: 0, fire: false };
let lastFrame = performance.now();

// The stars that twinkle; the rest are baked into the backdrop
const twinkles = Array.from({ length: 40 }, () => ({
  x: Math.random() * W, y: Math.random() * H, size: 1 + Math.random() * 1.6, phase: Math.random() * TAU,
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

// Calls draw(x, y) once, plus again on the far side of any edge the thing is poking over,
// so things that wrap around look right while they're half way across
function wrapped(x, y, radius, draw) {
  const xs = [x];
  if (x < radius) xs.push(x + W);
  if (x > W - radius) xs.push(x - W);
  const ys = [y];
  if (y < radius) ys.push(y + H);
  if (y > H - radius) ys.push(y - H);
  for (const wx of xs) {
    for (const wy of ys) draw(wx, wy);
  }
}

// ---------- Board size ----------

function resizeCanvas() {
  // The board is always 800 x 800 units, scaled to fit the space it has
  const rect = boardWrap.getBoundingClientRect();
  scale = Math.max(0.2, Math.min((rect.width - 2 * BORDER) / W, (rect.height - 2 * BORDER) / H));
  const size = Math.floor(W * scale);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  document.documentElement.style.setProperty("--board-width", Math.max(size + 2 * BORDER, 340) + "px");
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  scale = size / W;
  makeBackdrop(dpr);
}

function makeBackdrop(dpr) {
  backdrop = document.createElement("canvas");
  backdrop.width = canvas.width;
  backdrop.height = canvas.height;
  const c = backdrop.getContext("2d");
  c.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  const space = c.createLinearGradient(0, 0, W, H);
  space.addColorStop(0, "#0A1020");
  space.addColorStop(1, "#05070D");
  c.fillStyle = space;
  c.fillRect(0, 0, W, H);
  // A couple of soft nebula clouds
  for (const [x, y, r, color] of [[180, 220, 320, "120, 60, 200"], [640, 600, 300, "30, 140, 180"], [560, 140, 180, "200, 60, 120"]]) {
    const cloud = c.createRadialGradient(x, y, 0, x, y, r);
    cloud.addColorStop(0, `rgba(${color}, 0.22)`);
    cloud.addColorStop(1, `rgba(${color}, 0)`);
    c.fillStyle = cloud;
    c.fillRect(0, 0, W, H);
  }
  // Fixed stars, with a seeded pattern so they don't jump around on resize
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 160; i++) {
    c.globalAlpha = 0.25 + next() * 0.6;
    c.fillStyle = next() < 0.15 ? "#FFD6A6" : "#FFFFFF";
    c.fillRect(next() * W, next() * H, 1 + next() * 1.4, 1 + next() * 1.4);
  }
  c.globalAlpha = 1;
}

// ---------- Drawing ----------

function drawBackground(now) {
  ctx.drawImage(backdrop, 0, 0, W, H);
  ctx.fillStyle = "#FFFFFF";
  for (const star of twinkles) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(now / 600 + star.phase);
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;
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

function drawRock(rock, now) {
  const rainbow = rock.rainbowUntil > game.time;
  const [light, dark] = ROCK_COLORS[rock.color];
  const r = rock.r;
  wrapped(rock.x, rock.y, r * 1.2, (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    if (rainbow) {
      const glow = ctx.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.7);
      glow.addColorStop(0, "rgba(255, 240, 180, 0.4)");
      glow.addColorStop(1, "rgba(255, 240, 180, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-r * 1.8, -r * 1.8, r * 3.6, r * 3.6);
    }
    ctx.rotate(rock.angle);
    ctx.beginPath();
    rock.shape.forEach((bump, i) => {
      const angle = (i / rock.shape.length) * TAU;
      const px = Math.cos(angle) * r * bump;
      const py = Math.sin(angle) * r * bump;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    if (rainbow) {
      const shift = (now / 5) % 360;
      const fill = ctx.createLinearGradient(-r, -r, r, r);
      for (let i = 0; i <= 5; i++) fill.addColorStop(i / 5, `hsl(${(shift + i * 60) % 360}, 90%, 62%)`);
      ctx.fillStyle = fill;
    } else {
      const fill = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
      fill.addColorStop(0, light);
      fill.addColorStop(1, dark);
      ctx.fillStyle = fill;
    }
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = blend(dark, "#000000", 0.35);
    ctx.stroke();
    // Craters, placed using the rock's own lumpiness so each rock keeps its own
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    for (let k = 0; k < 3; k++) {
      const angle = rock.shape[k * 3] * 9;
      const distance = r * 0.45 * rock.shape[k * 3 + 1];
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance, r * 0.16 * rock.shape[k * 3 + 2], 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (rainbow) {
      ctx.fillStyle = "#FFFFFF";
      for (let k = 0; k < 3; k++) {
        const t = now / 300 + k * 2.1;
        drawSparkle(x + Math.cos(t) * (r + 6), y + Math.sin(t * 1.3) * (r + 6), 4 + Math.sin(t * 3) * 1.5);
      }
    }
  });
}

function drawCapsuleOrb(c, x, y, radius, kind, now) {
  // The mystery look: every capsule in space is drawn exactly the same way
  if (kind === "mystery") {
    const body = c.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
    body.addColorStop(0, "#FFFFFF");
    body.addColorStop(1, "#AEB8C4");
    c.fillStyle = body;
  } else {
    c.fillStyle = KIND_COLORS[kind];
  }
  c.beginPath();
  c.arc(x, y, radius, 0, TAU);
  c.fill();
  c.lineWidth = Math.max(1, radius * 0.12);
  c.strokeStyle = kind === "mystery" ? "#8090A0" : blend(KIND_COLORS[kind], "#000000", 0.35);
  c.stroke();
  c.fillStyle = kind === "mystery" ? COLORS.pink : "#0D131A";
  c.font = `900 ${Math.round(radius * 1.35)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(kind === "mystery" ? "?" : kind === "good" ? "+" : "!", x, y + radius * 0.08);
}

function drawCapsules(now) {
  for (const capsule of game.capsules) {
    const timeLeft = capsule.until - game.time;
    if (timeLeft < 2 && Math.floor(now / 120) % 2 === 0) continue;  // blinks before it vanishes
    wrapped(capsule.x, capsule.y, 30, (x, y) => {
      const glow = ctx.createRadialGradient(x, y, 4, x, y, 30);
      glow.addColorStop(0, "rgba(255, 79, 163, 0.5)");
      glow.addColorStop(1, "rgba(255, 79, 163, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(x - 32, y - 32, 64, 64);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.lineDashOffset = -now / 30;
      ctx.strokeStyle = "rgba(255, 79, 163, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 17, 0, TAU);
      ctx.stroke();
      ctx.restore();
      drawCapsuleOrb(ctx, x, y, SETTINGS.capsuleRadius - 1, "mystery", now);
    });
  }
}

function drawHole(now) {
  const hole = game.hole;
  if (!hole) return;
  const timeLeft = hole.until - game.time;
  const age = SETTINGS.holeTime - timeLeft;
  ctx.globalAlpha = clamp(Math.min(timeLeft / 0.6, age / 0.4), 0, 1);
  wrapped(hole.x, hole.y, 120, (x, y) => {
    const glow = ctx.createRadialGradient(x, y, 20, x, y, 130);
    glow.addColorStop(0, "rgba(155, 77, 202, 0.5)");
    glow.addColorStop(0.5, "rgba(120, 40, 160, 0.18)");
    glow.addColorStop(1, "rgba(120, 40, 160, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 130, y - 130, 260, 260);
    // Swirling rings
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      const start = now / (260 + k * 70) + k * 1.3;
      ctx.arc(x, y, 30 + k * 10, start, start + 1.7);
      ctx.strokeStyle = `hsla(${280 + k * 12}, 90%, ${62 - k * 4}%, ${0.75 - k * 0.08})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, y, SETTINGS.holeCore, 0, TAU);
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(210, 150, 255, 0.9)";
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // Bits of space getting sucked in
  if (mode === "playing" && Math.random() < 0.5) {
    const angle = Math.random() * TAU;
    particles.push({ x: hole.x + Math.cos(angle) * 130, y: hole.y + Math.sin(angle) * 130, vx: 0, vy: 0,
      size: 2, color: "#D2A8FF", life: 0.8, toward: hole });
  }
}

function drawShip(now) {
  const ship = game.ship;
  if (!ship.alive) return;
  if (game.time < ship.invulnerableUntil && Math.floor(now / 110) % 2 === 0) ctx.globalAlpha = 0.45;
  const drunk = showing(game.drunkLeft(), now);
  const reversed = showing(game.reversedLeft(), now);
  const look = drunk ? LOOKS.drunk : reversed ? LOOKS.reversed : LOOKS.normal;
  const wobble = game.drunkLeft() > 0 ? Math.sin(now / 110) * 0.14 : 0;  // a drunk ship can't sit still

  wrapped(ship.x, ship.y, 34, (x, y) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ship.angle + wobble);
    ctx.scale(SHIP_SCALE, SHIP_SCALE);
    if (ship.thrusting !== 0) {
      // Engine flame: out the back normally, out the front when reversed thrust pushes you backwards
      const length = 14 + Math.random() * 12;
      const back = ship.thrusting > 0;
      const baseX = back ? -9 : 17;
      const tipX = back ? baseX - length : baseX + length * 0.6;
      const flame = ctx.createLinearGradient(baseX, 0, tipX, 0);
      flame.addColorStop(0, "#FFF3B0");
      flame.addColorStop(0.5, "#FF9A3D");
      flame.addColorStop(1, "rgba(255, 80, 40, 0)");
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(baseX, -5);
      ctx.lineTo(tipX, 0);
      ctx.lineTo(baseX, 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(19, 0);
    ctx.quadraticCurveTo(4, -5, -11, -13);
    ctx.lineTo(-6, -4);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-6, 4);
    ctx.lineTo(-11, 13);
    ctx.quadraticCurveTo(4, 5, 19, 0);
    ctx.closePath();
    const body = ctx.createLinearGradient(-10, -12, 10, 12);
    body.addColorStop(0, look.light);
    body.addColorStop(1, look.dark);
    ctx.shadowColor = look.light;
    ctx.shadowBlur = 16;
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;
    if (drunk && reversed) {
      // Both at once: orange stripes over the purple
      ctx.save();
      ctx.clip();
      ctx.fillStyle = LOOKS.reversed.light;
      for (let sx = -20; sx < 24; sx += 8) ctx.fillRect(sx, -16, 4, 32);
      ctx.restore();
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(4, 0, 4.5, 3, 0, 0, TAU);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
    ctx.restore();

    if (showing(game.shieldLeft(), now)) {
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, TAU);
      ctx.fillStyle = "rgba(111, 227, 255, 0.12)";
      ctx.fill();
      ctx.strokeStyle = `rgba(111, 227, 255, ${0.6 + 0.3 * Math.sin(now / 140)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  });
  ctx.globalAlpha = 1;
}

function drawBullets(now) {
  for (const bullet of game.bullets) {
    const color = bullet.curve ? "255, 79, 163" : "166, 240, 255";
    ctx.fillStyle = `rgba(${color}, 0.35)`;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2.6, 0, TAU);
    ctx.fill();
  }
  for (const bullet of game.ufoBullets) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 60);
    ctx.fillStyle = `rgba(255, 92, 122, ${0.3 + 0.2 * pulse})`;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#FFD0D8";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 3.2, 0, TAU);
    ctx.fill();
  }
}

function drawUfo(now) {
  const ufo = game.ufo;
  if (!ufo) return;
  const draw = (x, y) => {
    ctx.save();
    ctx.translate(x, y + Math.sin(now / 200) * 2);
    // Glass dome with a very judgemental face
    ctx.beginPath();
    ctx.ellipse(0, -5, 12, 11, 0, Math.PI, 0);
    ctx.fillStyle = "rgba(166, 240, 255, 0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const look = game.ship.alive ? clamp((game.ship.x - ufo.x) / 300, -1, 1) * 1.5 : 0;
    for (const side of [-1, 1]) {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.ellipse(side * 4.5, -9, 2.6, 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#111111";
      ctx.beginPath();
      ctx.arc(side * 4.5 + look, -8.6, 1.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(side * 7.5, -13.5);
      ctx.lineTo(side * 2, -11.5);
      ctx.stroke();
    }
    // Saucer
    const body = ctx.createLinearGradient(0, -6, 0, 9);
    body.addColorStop(0, "#FF8FCB");
    body.addColorStop(1, "#A8205E");
    ctx.beginPath();
    ctx.ellipse(0, 1, 26, 9, 0, 0, TAU);
    ctx.fillStyle = body;
    ctx.shadowColor = "#FF4FA3";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 5; i++) {
      const on = Math.floor(now / 150 + i) % 3 === 0;
      ctx.fillStyle = on ? "#FFF3B0" : "#6B1D44";
      ctx.beginPath();
      ctx.arc(-16 + i * 8, 3, 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };
  draw(ufo.x, ufo.y);
  if (ufo.y < 30) draw(ufo.x, ufo.y + H);
  if (ufo.y > H - 30) draw(ufo.x, ufo.y - H);
}

function drawFog() {
  const timeLeft = game.fogLeft();
  if (timeLeft <= 0) return;
  // Darkness everywhere except a circle around the ship; it lifts gently at the end
  const strength = Math.min(1, timeLeft / 0.4) * 0.96;
  const ship = game.ship;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  wrapped(ship.x, ship.y, FOG_RADIUS, (x, y) => {
    ctx.moveTo(x + FOG_RADIUS, y);
    ctx.arc(x, y, FOG_RADIUS, 0, TAU, true);
  });
  ctx.fillStyle = `rgba(${COLORS.fog}, ${strength})`;
  ctx.fill("evenodd");
  wrapped(ship.x, ship.y, FOG_RADIUS, (x, y) => {
    const edge = ctx.createRadialGradient(x, y, FOG_RADIUS * 0.55, x, y, FOG_RADIUS + 1);
    edge.addColorStop(0, `rgba(${COLORS.fog}, 0)`);
    edge.addColorStop(1, `rgba(${COLORS.fog}, ${strength})`);
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.arc(x, y, FOG_RADIUS + 1, 0, TAU);
    ctx.fill();
  });
  ctx.restore();
}

function drawParticles(dt) {
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    if (p.toward) {
      // Sucked into the black hole
      p.x += (p.toward.x - p.x) * Math.min(1, dt * 3);
      p.y += (p.toward.y - p.y) * Math.min(1, dt * 3);
    } else {
      p.vx *= Math.exp(-1.5 * dt);
      p.vy *= Math.exp(-1.5 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    ctx.globalAlpha = Math.min(1, p.life / 0.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function burst(x, y, color, count, speed = 220, size = 4) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * TAU;
    const power = speed * (0.3 + Math.random() * 0.9);
    particles.push({ x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power,
      size: size * (0.5 + Math.random()), color, life: 0.5 + Math.random() * 0.6 });
  }
}

function addRing(x, y, color, from, to, duration = 450) {
  rings.push({ x, y, color, from, to, born: performance.now(), duration });
}

function drawRings(now) {
  rings = rings.filter((ring) => now - ring.born < ring.duration);
  for (const ring of rings) {
    const progress = (now - ring.born) / ring.duration;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 4 * (1 - progress) + 1;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.from + (ring.to - ring.from) * progress, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function exhaust() {
  // Little sparks from the engine while you thrust
  const ship = game.ship;
  if (!ship.alive || ship.thrusting === 0 || particles.length >= MAX_PARTICLES) return;
  const back = ship.thrusting > 0 ? -1 : 1;
  const spread = (Math.random() - 0.5) * 0.6;
  particles.push({
    x: ship.x + Math.cos(ship.angle) * 12 * back, y: ship.y + Math.sin(ship.angle) * 12 * back,
    vx: Math.cos(ship.angle + spread) * 160 * back + ship.vx * 0.5,
    vy: Math.sin(ship.angle + spread) * 160 * back + ship.vy * 0.5,
    size: 2.5, color: Math.random() < 0.5 ? "#FFB347" : "#FFF3B0", life: 0.3,
  });
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
    const y = popup.y - (popup.row || 0) * 24 - 50 * progress;
    ctx.globalAlpha = 1 - progress * progress;
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#05070D";
    ctx.strokeText(popup.text, popup.x, y);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, y);
  }
  ctx.globalAlpha = 1;
}

function drawBanner(now) {
  if (!banner) return;
  const age = (now - banner.born) / 2000;
  if (age >= 1) {
    banner = null;
    return;
  }
  ctx.globalAlpha = age < 0.75 ? 1 : 1 - (age - 0.75) / 0.25;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 72px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 9;
  ctx.strokeStyle = "#05070D";
  ctx.strokeText(banner.title, W / 2, H / 2 - 24);
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText(banner.title, W / 2, H / 2 - 24);
  ctx.font = '800 26px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.lineWidth = 6;
  ctx.strokeText(banner.line, W / 2, H / 2 + 32);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(banner.line, W / 2, H / 2 + 32);
  ctx.globalAlpha = 1;
}

function drawHint(now) {
  if (mode !== "playing" || now > hintUntil) return;
  ctx.globalAlpha = Math.min(1, (hintUntil - now) / 600) * (0.6 + 0.3 * Math.sin(now / 220));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '800 22px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(isTouch ? "JOYSTICK TO FLY  ·  HOLD FIRE TO SHOOT" : "← → TURN  ·  ↑ THRUST  ·  SPACE SHOOTS", W / 2, H - 70);
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
  drawHole(now);
  for (const rock of game.rocks) drawRock(rock, now);
  drawCapsules(now);
  drawBullets(now);
  drawUfo(now);
  if (mode === "playing") exhaust();
  drawParticles(dt);
  drawShip(now);
  drawRings(now);
  drawFog();
  drawPopups(now);
  drawHint(now);
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
  drawCapsuleOrb(c, 9, 9, 8, kind, 0);
}

// ---------- Scoreboard ----------

const hud = {
  score: $("score"),
  wave: $("wave"),
  lives: $("lives"),
  warp: $("warp-label"),
  warpButton: $("warp-button"),
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
  const ready = game.hyperReady() && game.ship.alive;
  setText(hud.warp, ready ? "WARP READY" : "WARP");
  hud.warp.classList.toggle("ready", ready);
  hud.warpButton.classList.toggle("ready", ready);

  for (const effect of EFFECTS) {
    const timeLeft = effect.left();
    effect.pill.hidden = timeLeft <= 0;
    if (timeLeft <= 0) continue;
    effect.pill.firstChild.style.width = ((timeLeft / effect.total()) * 100).toFixed(1) + "%";
    setText(effect.pill.lastChild, `${effect.name}  ${timeLeft.toFixed(1)}s`);
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
    setText($("overlay-title"), "CHAOS ROCKS");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic"
      ? "Just you, some rocks and the void. How retro."
      : "Every capsule is a mystery. Space is cold and so is your aim.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Joystick to fly. Hold FIRE to shoot." : "or press Space");
  } else if (kind === "paused") {
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "Take a breather. The rocks will wait. They're rocks.");
    setText($("overlay-stats"), `Score ${game.score}  ·  Wave ${game.wave}`);
    setText(playButton, "Resume");
    setText($("overlay-hint"), keyHint);
  } else {
    const newBest = game.score > best;
    if (newBest) {
      best = game.score;
      saveSetting(bestKey(), best);
    }
    const s = game.stats;
    const accuracy = s.shots ? Math.min(100, Math.round((s.hits / s.shots) * 100)) : 0;
    setText($("overlay-title"), "GAME OVER");
    setText($("overlay-reason"), game.over);
    setText($("overlay-stats"),
      `Score ${game.score}  ·  Wave ${game.wave}  ·  ` + (newBest ? "New best!" : `Best ${best}`));
    let taunt = newBest ? "Don't let it go to your head." : pick(game.classic ? CLASSIC_TAUNTS : TAUNTS);
    taunt += `  Accuracy ${accuracy}%. Rocks smashed: ${s.rocks}. UFOs: ${s.ufos}.`;
    if (!game.classic) taunt += ` Capsules: ${s.good} good, ${s.bad} bad.`;
    setText($("overlay-taunt"), taunt);
    setText(playButton, "Play again");
    setText($("overlay-hint"), keyHint);
  }
}

function newGame() {
  game = new RockGame({ classic: gameMode === "classic" });
  popups = [];
  particles = [];
  rings = [];
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
  hintUntil = performance.now() + 4000;
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
  popups.push({ x: clamp(x, 90, W - 90), y: clamp(y, 50, H - 40), text, color, born: performance.now(), ...options });
}

function shakeScreen(strength) {
  shake = { until: performance.now() + 400, strength };
}

function handleEvents() {
  const now = performance.now();
  for (const event of game.events) {
    switch (event.type) {
      case "rock": {
        const color = event.rainbow ? "#FFFFFF" : ROCK_COLORS[event.color][0];
        const size = { big: 26, medium: 16, small: 9 }[event.size];
        burst(event.x, event.y, color, event.rainbow ? 50 : size, event.rainbow ? 360 : 200, event.size === "big" ? 6 : 4);
        if (event.rainbow) addPopup(event.x, event.y, `+${event.points} RAINBOW!`, COLORS.gold, { size: 30 });
        if (event.size === "big") shakeScreen(4);
        break;
      }
      case "caught":
        showLastCapsule(event.kind, event.text);
        addPopup(event.x, event.y - 20, event.popup, KIND_COLORS[event.kind], { size: 28 });
        burst(event.x, event.y, KIND_COLORS[event.kind], 18, 220);
        addRing(event.x, event.y, KIND_COLORS[event.kind], 10, 60);
        break;
      case "died":
        shakeScreen(16);
        burst(event.x, event.y, "#A6F0FF", 40, 320, 5);
        burst(event.x, event.y, "#FFB347", 30, 260, 4);
        addRing(event.x, event.y, COLORS.red, 10, 90, 600);
        addPopup(event.x, event.y - 20, pick(DEATH_POPUPS[event.cause] || DEATH_POPUPS.rock), COLORS.red, { size: 30 });
        break;
      case "respawn":
        addRing(W / 2, H / 2, COLORS.cyan, 60, 8, 500);
        break;
      case "shieldHit":
        addPopup(event.x, event.y - 20, "SHIELD SAVED YOU", COLORS.cyan);
        addRing(event.x, event.y, COLORS.cyan, 20, 70);
        shakeScreen(8);
        break;
      case "hyperspace":
        addRing(event.from.x, event.from.y, COLORS.cyan, 8, 70);
        if (!event.failed) {
          addRing(event.to.x, event.to.y, COLORS.cyan, 70, 8);
          addPopup(event.to.x, event.to.y - 20, "WHOOSH", COLORS.cyan, { size: 20 });
        }
        break;
      case "bomb":
        addRing(event.x, event.y, "#FFF3B0", 10, SETTINGS.bombRadius, 600);
        addRing(event.x, event.y, COLORS.gold, 10, SETTINGS.bombRadius * 0.7, 450);
        shakeScreen(14);
        break;
      case "hole":
        addPopup(event.x, event.y - 30, "UH OH", COLORS.purple, { size: 26 });
        shakeScreen(6);
        break;
      case "ufo":
        addPopup(clamp(event.x, 120, W - 120), event.y - 30, pick(UFO_ARRIVES), COLORS.pink, { size: 22 });
        break;
      case "ufoShot":
        if (Math.random() < 0.18) addPopup(event.x, event.y - 30, pick(UFO_SHOTS), COLORS.pink, { size: 18 });
        break;
      case "ufoDown":
        burst(event.x, event.y, COLORS.pink, 40, 300, 5);
        addRing(event.x, event.y, COLORS.pink, 10, 80);
        addPopup(event.x, event.y - 20, pick(UFO_DOWN), COLORS.pink, { size: 24 });
        shakeScreen(8);
        break;
      case "rainbow":
        addPopup(event.x, event.y - 50, "RAINBOW ROCK!", COLORS.gold, { size: 24 });
        break;
      case "extraLife":
        addPopup(W / 2, 120, "+1 LIFE. LUCKY.", COLORS.green, { size: 26 });
        break;
      case "wave":
        banner = { title: `WAVE ${event.wave}`, line: pick(WAVE_LINES), born: now };
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

const KEY_NAMES = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  ArrowUp: "up", KeyW: "up",
};
const WARP_KEYS = ["ArrowDown", "KeyS", "ShiftLeft", "ShiftRight"];

document.addEventListener("keydown", (event) => {
  const name = KEY_NAMES[event.code];
  if (name) {
    if (mode === "playing") event.preventDefault();  // stop the arrow keys scrolling the page
    keys[name] = true;
    return;
  }
  if (WARP_KEYS.includes(event.code)) {
    if (mode === "playing") {
      event.preventDefault();
      if (!event.repeat) game.hyperspace();
    }
  } else if (event.code === "Space") {
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
  const name = KEY_NAMES[event.code];
  if (name) keys[name] = false;
  if (event.code === "Space") keys.fire = false;
});

// The joystick: push it the way you want to face; push past the dashed ring to fly that way
const stickZone = $("stick-zone");
const stick = $("stick");
const knob = $("knob");
let stickPointer = null;

function moveStick(event) {
  const rect = stick.getBoundingClientRect();
  const reach = rect.width / 2 - 10;
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.hypot(dx, dy);
  const pushed = Math.min(distance, reach);
  const kx = distance ? (dx / distance) * pushed : 0;
  const ky = distance ? (dy / distance) * pushed : 0;
  knob.style.transform = `translate(${kx}px, ${ky}px)`;
  const strength = pushed / reach;
  touch.aim = strength > 0.18 ? Math.atan2(dy, dx) : null;
  touch.thrust = strength >= 0.66 ? clamp(0.45 + ((strength - 0.66) / 0.34) * 0.55, 0, 1) : 0;
}

function releaseStick() {
  stickPointer = null;
  knob.style.transform = "";
  touch.aim = null;
  touch.thrust = 0;
}

stickZone.addEventListener("pointerdown", (event) => {
  if (stickPointer !== null) return;
  event.preventDefault();
  stickPointer = event.pointerId;
  stickZone.setPointerCapture?.(event.pointerId);
  moveStick(event);
});
stickZone.addEventListener("pointermove", (event) => {
  if (event.pointerId === stickPointer) moveStick(event);
});
for (const type of ["pointerup", "pointercancel"]) {
  stickZone.addEventListener(type, (event) => {
    if (event.pointerId === stickPointer) releaseStick();
  });
}

const fireButton = $("fire-button");
fireButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  fireButton.setPointerCapture?.(event.pointerId);
  touch.fire = true;
  fireButton.classList.add("pressed");
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  fireButton.addEventListener(type, () => {
    touch.fire = false;
    fireButton.classList.remove("pressed");
  });
}
hud.warpButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (mode === "playing") game.hyperspace();
});

$("pause-button").addEventListener("click", () => {
  if (mode === "playing") pause();
  else resume();
});
playButton.addEventListener("click", primaryAction);
for (const button of document.querySelectorAll(".mode")) {
  button.addEventListener("click", () => setMode(button.dataset.mode));
}

function releaseEverything() {
  for (const name of Object.keys(keys)) keys[name] = false;
  releaseStick();
  touch.fire = false;
  fireButton.classList.remove("pressed");
}

// Pause if you switch tabs, lock your phone or click away from the window
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pause();
    releaseEverything();
  }
});
window.addEventListener("blur", () => {
  pause();
  releaseEverything();
});

new ResizeObserver(() => resizeCanvas()).observe(boardWrap);

// ---------- Start up ----------

function frame(now) {
  // Never jump more than a twentieth of a second, so a slow frame can't send things through each other
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  if (mode === "playing") {
    game.setInput({
      turn: (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
      thrust: keys.up ? 1 : touch.thrust,
      aim: touch.aim,
      fire: keys.fire || touch.fire,
    });
    game.update(dt);
    handleEvents();
  }
  updateHud();
  draw(now, mode === "playing" || mode === "over" ? dt : 0);
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
