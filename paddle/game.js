// Drawing, controls and screens for Chaos Paddle. The rules live in logic.js.
"use strict";

const COLORS = {
  courtTop: "#17223A",
  courtBottom: "#16251E",
  text: "#E8EEF4",
  dim: "#8090A0",
  green: "#7BD65B",
  red: "#F05A4F",
  gold: "#F5C542",
  purple: "#B98AF0",
  orange: "#FFA24C",
  cyan: "#6FE3FF",
  pink: "#FF4FA3",
  tuna: "#5CC2FF",
  fog: "5, 8, 12",
};
// How the paddles look. Drunk turns a paddle purple and reversed turns it orange, so it's obvious.
const LOOKS = {
  player: { light: "#9BE86F", dark: "#3E9B3A" },
  cpu: { light: "#8FD6FF", dark: "#2B6CB0" },
  drunk: { light: "#C99CFF", dark: "#6B3FA0" },
  reversed: { light: "#FFBE6E", dark: "#B05A14" },
};
const KIND_COLORS = { good: COLORS.green, bad: COLORS.purple };

// Your effects, as countdown pills above the court
const EFFECTS = [
  { name: "REVERSED", color: "orange", left: () => game.left("player", "reversed"), total: () => SETTINGS.effectTime },
  { name: "DRUNK", color: "purple", left: () => game.left("player", "drunk"), total: () => SETTINGS.effectTime },
  { name: "TINY", color: "red", left: () => game.left("player", "tiny"), total: () => SETTINGS.effectTime },
  { name: "FOG", color: "grey", left: () => game.left("player", "fog"), total: () => SETTINGS.shortTime },
  { name: "INVISIBLE", color: "grey", left: () => game.left("player", "invisible"), total: () => SETTINGS.shortTime },
  { name: "TILT", color: "red", left: () => game.tiltLeft(), total: () => SETTINGS.tiltTime },
  { name: "GIANT", color: "green", left: () => game.left("player", "giant"), total: () => SETTINGS.effectTime },
  { name: "CURVE", color: "gold", left: () => game.left("player", "curve"), total: () => SETTINGS.effectTime },
  { name: "SLOW-MO", color: "cyan", left: () => game.left("player", "slow"), total: () => SETTINGS.effectTime },
  { name: "SHIELD", color: "cyan", left: () => (game.shield.player ? 1 : 0), total: () => 1, noTimer: true },
];
// Tuna Marie's effects, written under his paddle so you can laugh at him
const TUNA_EFFECTS = [["giant", "GIANT"], ["tiny", "TINY"], ["reversed", "REVERSED"], ["drunk", "DRUNK"],
  ["fog", "FOGGED"], ["invisible", "BLIND"], ["curve", "CURVE"], ["slow", "SLOW-MO"]];

// The sass. Tuna Marie has a lot to say.
const TUNA_HELLO = ["Prepare to lose, human.", "Oh good. You're back.", "I've been practising.",
  "Let's go, meat-based player.", "Try to keep up."];
const TUNA_ANGRY = ["Okay. Now I'm trying.", "That last match was a fluke.", "I updated my drivers. You're done.",
  "Round two. No more Mr Nice Computer."];
const TUNA_SCORES = ["Too easy.", "Did you blink?", "I'm not even trying.", "Beep boop. You lose.",
  "Is your paddle decorative?", "Calculated.", "You call that defence?", "Get good."];
const TUNA_CONCEDES = ["Lag.", "That didn't count.", "My fan was on.", "Lucky.", "I let you have that.",
  "Rude.", "Hacks!", "I wasn't ready."];
const TUNA_LAUGHS = ["Ha! Enjoy that.", "Karma.", "LOL.", "That one's my favourite.", "Oh no. Anyway."];
const TUNA_JEALOUS = ["Hey, that's not fair!", "Who keeps leaving those there?", "Cheater.", "Ugh. Fine."];
const TUNA_RALLY = ["Okay, this is getting intense.", "Just give up already.", "I can do this all day.",
  "My circuits are sweating."];
const MISSED = ["MISSED", "OOPS", "YIKES", "SKILL ISSUE", "BUTTERFINGERS", "REALLY?"];
const SCORED = ["NICE", "GOT HIM", "TAKE THAT, TUNA MARIE", "BOOM", "WHO'S CRYING NOW"];
const LOSS_TAUNTS = ["Beaten by a computer named Tuna Marie.", "Tuna Marie is already telling his friends.",
  "Your paddle is filing a complaint.", "That was hard to watch. Tuna Marie loved it.",
  "Rage quit? Tuna Marie would love that.", "Tuna Marie didn't even use all his processing power."];
const WIN_SULKS = ["Tuna Marie: \"I demand a rematch.\"", "Tuna Marie: \"My fan was on.\"", "Tuna Marie: \"Best of three?\"",
  "Tuna Marie: \"I was lagging.\"", "Tuna Marie: \"I let you win. Obviously.\""];

const BORDER = 4;          // the court's border width in style.css
const POPUP_TIME = 1.0;
const SPEECH_TIME = 2.4;
const FLASH_TIME = 2;      // effects flash on and off for their last 2 seconds
const MAX_PARTICLES = 260;
const BEST_KEY = "mjy-paddle-best";
const MODE_KEY = "mjy-paddle-mode";
const W = SETTINGS.width;
const H = SETTINGS.height;

const $ = (id) => document.getElementById(id);
const boardWrap = $("board-wrap");
const canvas = $("board");
const ctx = canvas.getContext("2d");
const overlay = $("overlay");
const playButton = $("play-button");
const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

let game = null;          // the current PaddleGame (one match)
let mode = "start";       // "start", "playing", "paused", "won" (between matches) or "over"
let gameMode = loadSetting(MODE_KEY) === "classic" ? "classic" : "rage";  // "rage" or "classic"
let streak = 0;           // matches won in a row
let best = loadBest();    // your longest win streak in this mode
let scale = 1;            // CSS pixels per court unit
let popups = [];
let particles = [];
let speech = null;        // what Tuna Marie is saying right now
let banner = null;        // the big "MATCH POINT" message
let shake = { until: 0, strength: 0 };
const trails = new WeakMap();
const keys = { left: false, right: false };
let pointerX = null;      // where your mouse or finger is, in court units (null when using keys)
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

// Each mode keeps its own best win streak
function bestKey() {
  return gameMode === "classic" ? BEST_KEY + "-classic" : BEST_KEY;
}

function loadBest() {
  return Number(loadSetting(bestKey())) || 0;
}

// ---------- Court size ----------

function resizeCanvas() {
  // The court is always 600 x 800 units, scaled to fit the space it has
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

function toCourtX(clientX) {
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

function drawCourt(now) {
  const turf = ctx.createLinearGradient(0, 0, 0, H);
  turf.addColorStop(0, COLORS.courtTop);
  turf.addColorStop(1, COLORS.courtBottom);
  ctx.fillStyle = turf;
  ctx.fillRect(0, 0, W, H);

  // Court lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 70, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([16, 12]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
  ctx.restore();

  // A glow behind each goal
  const top = ctx.createLinearGradient(0, 0, 0, 90);
  top.addColorStop(0, "rgba(92, 194, 255, 0.18)");
  top.addColorStop(1, "rgba(92, 194, 255, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 90);
  const bottom = ctx.createLinearGradient(0, H, 0, H - 90);
  bottom.addColorStop(0, "rgba(123, 214, 91, 0.18)");
  bottom.addColorStop(1, "rgba(123, 214, 91, 0)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H - 90, W, 90);

  // Shields behind the goals
  for (const [side, y, color] of [["player", SETTINGS.shieldPlayerY, "111, 227, 255"], ["cpu", SETTINGS.shieldCpuY, "111, 227, 255"]]) {
    if (!game.shield[side]) continue;
    const glow = 0.6 + 0.4 * Math.sin(now / 160);
    ctx.strokeStyle = `rgba(${color}, ${glow})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(W - 10, y);
    ctx.stroke();
  }
}

function drawOrbShape(c, x, y, radius, kind, now) {
  // Every orb on the court is drawn exactly the same way: a pink "?" bubble
  const colors = { mystery: ["#FF8BC6", "#B0206A"], good: ["#B8F08F", "#3E9B3A"], bad: ["#D9B8FF", "#6B3FA0"] }[kind];
  const body = c.createRadialGradient(x - radius * 0.35, y - radius * 0.35, radius * 0.1, x, y, radius);
  body.addColorStop(0, colors[0]);
  body.addColorStop(1, colors[1]);
  c.fillStyle = body;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#FFFFFF";
  c.font = `900 ${Math.round(radius * 1.2)}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(kind === "mystery" ? "?" : kind === "good" ? "+" : "!", x, y + radius * 0.06);
}

function drawOrbs(now) {
  for (const orb of game.orbs) {
    const left = orb.until - game.time;
    if (left < 2 && Math.floor(now / 120) % 2 === 0) continue;  // blinks before it fizzles
    const pulse = 1 + 0.08 * Math.sin(now / 150 + orb.x);
    const glow = ctx.createRadialGradient(orb.x, orb.y, 6, orb.x, orb.y, 44);
    glow.addColorStop(0, "rgba(255, 79, 163, 0.45)");
    glow.addColorStop(1, "rgba(255, 79, 163, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(orb.x - 44, orb.y - 44, 88, 88);
    ctx.strokeStyle = `rgba(255, 139, 198, ${0.4 + 0.3 * Math.sin(now / 200)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, SETTINGS.orbRadius * pulse + 7, 0, Math.PI * 2);
    ctx.stroke();
    drawOrbShape(ctx, orb.x, orb.y, SETTINGS.orbRadius * pulse, "mystery", now);
  }
}

function paddleLook(side, now) {
  const drunk = showing(game.left(side, "drunk"), now);
  const reversed = showing(game.left(side, "reversed"), now);
  return { drunk, reversed, look: drunk ? LOOKS.drunk : reversed ? LOOKS.reversed : LOOKS[side] };
}

function drawPaddle(side, now) {
  const width = game.paddleWidth(side);
  const height = SETTINGS.paddleHeight;
  const cx = game.paddles[side].x;
  const x = cx - width / 2;
  const y = side === "player" ? SETTINGS.playerY : SETTINGS.cpuY;
  const { drunk, reversed, look } = paddleLook(side, now);

  ctx.save();
  if (game.left(side, "drunk") > 0) {
    // A drunk paddle wobbles about
    ctx.translate(cx, y + height / 2);
    ctx.rotate(Math.sin(now / 110 + (side === "cpu" ? 1.5 : 0)) * 0.1);
    ctx.translate(-cx, -(y + height / 2));
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
  if (showing(game.left(side, "curve"), now)) {
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    roundedRect(ctx, x - 2, y - 2, width + 4, height + 4, height / 2 + 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  roundedRect(ctx, x + 6, y + 2, width - 12, 3, 1.5);
  ctx.fill();

  if (side === "cpu") drawTunaFace(cx, y + height / 2, width, now);
  ctx.restore();
}

function drawTunaFace(cx, cy, width, now) {
  // Tuna Marie's eyes follow the ball, and his eyebrows show how he feels about the score
  const ball = game.balls[0];
  const look = ball ? clamp((ball.x - cx) / 120, -1, 1) * 2.2 : 0;
  const gap = Math.min(16, width / 5);
  const ahead = game.score.cpu - game.score.player;
  for (const side of [-1, 1]) {
    const ex = cx + side * gap;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(ex, cy, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0D131A";
    ctx.beginPath();
    ctx.arc(ex + look, cy + 1.2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Smug when he's winning, furious when he's losing
    ctx.strokeStyle = "#0D131A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const tilt = ahead > 0 ? -2 : ahead < 0 ? 2.5 : 0;
    ctx.moveTo(ex - 5, cy - 6 - tilt * side * -1);
    ctx.lineTo(ex + 5, cy - 6 + tilt * side * -1);
    ctx.stroke();
  }
}

function drawTunaTags(now) {
  // Tuna Marie's active effects, under his paddle
  const tags = TUNA_EFFECTS.filter(([name]) => game.left("cpu", name) > 0)
    .map(([name, label]) => `${label} ${Math.ceil(game.left("cpu", name))}s`);
  if (game.shield.cpu) tags.push("SHIELDED");
  if (!tags.length) return;
  ctx.font = '800 13px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(185, 138, 240, ${0.75 + 0.25 * Math.sin(now / 180)})`;
  ctx.fillText(tags.join("  ·  "), W / 2, SETTINGS.cpuY + 38);
}

function drawBalls(now) {
  const hidden = game.left("player", "invisible") > 0 && now % 650 > 110;  // only flickers into view
  const r = SETTINGS.ballRadius;
  for (const ball of game.balls) {
    let trail = trails.get(ball);
    if (!trail) trails.set(ball, (trail = []));
    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 9) trail.shift();
    if (hidden) continue;
    const spinning = ball.spin !== 0;
    const tint = spinning ? "245, 197, 66" : "255, 255, 255";
    trail.forEach((spot, i) => {
      ctx.globalAlpha = (i / trail.length) * 0.35;
      ctx.fillStyle = `rgb(${tint})`;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, r * (0.4 + (0.6 * i) / trail.length), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(ball.x, ball.y, r * 0.5, ball.x, ball.y, r * 2.6);
    glow.addColorStop(0, `rgba(${tint}, 0.55)`);
    glow.addColorStop(1, `rgba(${tint}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(ball.x - r * 3, ball.y - r * 3, r * 6, r * 6);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawServe(now) {
  const ball = game.balls[0];
  if (!ball || !ball.waiting || mode !== "playing") return;
  const left = game.serveAt - game.time;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '900 22px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 120);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(left > 0.55 ? "READY…" : "GO!", W / 2, H / 2 + 44 * (game.serveToward === "player" ? 1 : -1));
  ctx.globalAlpha = 1;
}

function drawFog() {
  const timeLeft = game.left("player", "fog");
  if (timeLeft <= 0) return;
  // Darkness everywhere except a little circle around each ball; it lifts gently at the end
  const strength = Math.min(1, timeLeft / 0.4) * 0.96;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-50, -50, W + 100, H + 100);
  for (const ball of game.balls) {
    ctx.moveTo(ball.x + 120, ball.y);
    ctx.arc(ball.x, ball.y, 120, 0, Math.PI * 2, true);
  }
  ctx.fillStyle = `rgba(${COLORS.fog}, ${strength})`;
  ctx.fill("evenodd");
  for (const ball of game.balls) {
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

function drawSpeech(now) {
  if (!speech) return;
  const age = (now - speech.born) / 1000;
  if (age > SPEECH_TIME) {
    speech = null;
    return;
  }
  // A speech bubble hanging off Tuna Marie's paddle
  ctx.font = '800 17px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const width = Math.min(ctx.measureText(speech.text).width + 28, W - 30);
  const x = clamp(game.paddles.cpu.x - width / 2, 15, W - 15 - width);
  const y = SETTINGS.cpuY + 54;
  const tipX = clamp(game.paddles.cpu.x, x + 18, x + width - 18);
  ctx.globalAlpha = age < 0.12 ? age / 0.12 : age > SPEECH_TIME - 0.3 ? (SPEECH_TIME - age) / 0.3 : 1;
  ctx.fillStyle = "#F4F7FB";
  roundedRect(ctx, x, y, width, 34, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tipX - 8, y + 1);
  ctx.lineTo(tipX, y - 10);
  ctx.lineTo(tipX + 8, y + 1);
  ctx.fill();
  ctx.fillStyle = "#14223A";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(speech.text, x + width / 2, y + 17, width - 20);
  ctx.globalAlpha = 1;
}

function drawParticles(dt) {
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) {
    p.vy += 600 * dt;
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
    particles.push({ x, y, vx: Math.cos(angle) * power, vy: Math.sin(angle) * power,
      size: 3 + Math.random() * 4, color, life: 0.45 + Math.random() * 0.4 });
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
    const y = popup.y + (popup.rise ?? -46) * progress;
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
  const age = (now - banner.born) / 1500;
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
  ctx.strokeText(banner.title, W / 2, H / 2 - 120);
  ctx.fillStyle = banner.color;
  ctx.fillText(banner.title, W / 2, H / 2 - 120);
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
  if (game.tiltLeft() > 0) {
    // The whole court leans while it's tilted
    const lean = Math.min(1, game.tiltLeft() / 0.5, (SETTINGS.tiltTime - game.tiltLeft()) / 0.5);
    ctx.translate(W / 2, H / 2);
    ctx.rotate(game.tiltDir * 0.045 * lean);
    ctx.scale(1 + 0.075 * lean, 1 + 0.075 * lean);  // zoom in a touch so the corners stay covered
    ctx.translate(-W / 2, -H / 2);
  }
  drawCourt(now);
  drawOrbs(now);
  drawBalls(now);
  drawParticles(dt);
  drawFog();
  drawPaddle("cpu", now);     // paddles go over the fog, so you can always see them
  drawPaddle("player", now);
  drawTunaTags(now);
  drawServe(now);
  drawPopups(now);
  drawSpeech(now);
  drawBanner(now);
  ctx.restore();
}

function paintIcon(iconCanvas, kind) {
  const dpr = window.devicePixelRatio || 1;
  iconCanvas.width = 16 * dpr;
  iconCanvas.height = 16 * dpr;
  const c = iconCanvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, 16, 16);
  drawOrbShape(c, 8, 8, 7.5, kind, 0);
}

// ---------- Scoreboard ----------

const hud = {
  player: $("score-player"),
  cpu: $("score-cpu"),
  streak: $("streak"),
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
  setText(hud.player, game.score.player);
  setText(hud.cpu, game.score.cpu);
  setText(hud.streak, streak);
  for (const effect of EFFECTS) {
    const timeLeft = effect.left();
    effect.pill.hidden = timeLeft <= 0;
    if (timeLeft <= 0) continue;
    effect.pill.firstChild.style.width = ((timeLeft / effect.total()) * 100).toFixed(1) + "%";
    setText(effect.pill.lastChild, effect.noTimer ? effect.name : `${effect.name}  ${timeLeft.toFixed(1)}s`);
  }
}

function showLastOrb(kind, text, color) {
  paintIcon(hud.lastOrbIcon, kind);
  setText(hud.lastOrbText, text);
  hud.lastOrbText.style.color = color;
  hud.lastOrb.classList.remove("empty");
}

// ---------- Screens ----------

function showOverlay(kind) {
  overlay.hidden = false;
  overlay.classList.toggle("over", kind === "over");
  const keyHint = isTouch ? "" : "or press Space";
  setText($("overlay-eyebrow"), kind === "start" ? "MATT YOUNG PRESENTS" : "");
  setText($("overlay-taunt"), "");
  $("modes").hidden = kind === "paused" || kind === "won";  // switching mode would end your streak
  const score = `You ${game.score.player} – ${game.score.cpu} Tuna Marie`;

  if (kind === "start") {
    setText($("overlay-title"), "CHAOS PADDLE");
    setText($("overlay-reason"), "");
    setText($("overlay-stats"), gameMode === "classic"
      ? "You, Tuna Marie and one ball. Old school. Tuna Marie still talks, though."
      : "First to 7 beats Tuna Marie. Tuna Marie cheats. So do the orbs.");
    setText(playButton, "Play");
    setText($("overlay-hint"), isTouch ? "Drag to move your paddle." : "or press Space");
  } else if (kind === "paused") {
    setText($("overlay-title"), "PAUSED");
    setText($("overlay-reason"), "Tuna Marie is waiting. He's tapping his foot.");
    setText($("overlay-stats"), score);
    setText(playButton, "Resume");
    setText($("overlay-hint"), keyHint);
  } else if (kind === "won") {
    setText($("overlay-title"), "YOU WIN?!");
    setText($("overlay-reason"), pick(WIN_SULKS));
    setText($("overlay-stats"), `${score}  ·  Win streak ${streak}  ·  Best ${best}`);
    setText($("overlay-taunt"), `Longest rally: ${game.longestRally}. Next match, Tuna Marie gets faster and sharper.`);
    setText(playButton, "Next match");
    setText($("overlay-hint"), keyHint);
  } else {
    setText($("overlay-title"), "GAME OVER");
    setText($("overlay-reason"), game.over);
    setText($("overlay-stats"), `${score}  ·  Streak ${streak}  ·  Best ${best}`);
    setText($("overlay-taunt"), pick(LOSS_TAUNTS));
    setText(playButton, "Rematch");
    setText($("overlay-hint"), keyHint);
  }
}

function newMatch() {
  game = new PaddleGame({ classic: gameMode === "classic", wins: streak });
  popups = [];
  particles = [];
  banner = null;
  speech = null;
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
  if (mode === "start") {
    newMatch();
    showOverlay("start");
  }
}

function say(text) {
  speech = { text, born: performance.now() };
}

function startMatch() {
  if (mode !== "won") streak = 0;  // a fresh game, unless you're carrying on a winning streak
  newMatch();
  mode = "playing";
  overlay.hidden = true;
  playButton.blur();
  say(streak > 0 ? pick(TUNA_ANGRY) : pick(TUNA_HELLO));
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
  else if (mode === "start" || mode === "over" || mode === "won") startMatch();
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
      case "hit":
        burst(event.x, event.y, event.side === "player" ? COLORS.green : COLORS.tuna, 7, 200);
        if (event.rally > 0 && event.rally % 10 === 0) {
          addPopup(W / 2, H / 2, `RALLY ×${event.rally}`, COLORS.gold, { size: 26 });
          if (!game.classic) say(pick(TUNA_RALLY));
        }
        break;
      case "orbSpawn":
        burst(event.x, event.y, COLORS.pink, 10, 160);
        break;
      case "orbFizzle":
        burst(event.x, event.y, COLORS.dim, 8, 120);
        break;
      case "orb": {
        const orb = ORBS[event.name];
        const color = KIND_COLORS[event.kind];
        burst(event.x, event.y, color, 22, 280);
        if (event.owner === "player") {
          showLastOrb(event.kind, orb.text, color);
          addPopup(event.x, event.y, orb.popup, color, { size: 24 });
          say(event.kind === "bad" ? pick(TUNA_LAUGHS) : pick(TUNA_JEALOUS));
        } else {
          showLastOrb(event.kind, orb.cpuText, COLORS.tuna);
          addPopup(event.x, event.y, `TUNA MARIE: ${orb.popup}`, COLORS.tuna, { size: 22 });
          say(orb.quip);
        }
        break;
      }
      case "shieldSave":
        addPopup(event.x, event.side === "player" ? SETTINGS.shieldPlayerY - 30 : SETTINGS.shieldCpuY + 40,
          event.side === "player" ? "SAVED!" : "BLOCKED!", COLORS.cyan, { size: 22 });
        say(event.side === "player" ? "That shield is cheating." : "Denied!");
        break;
      case "point":
        shakeScreen(event.scorer === "player" ? 8 : 14);
        if (event.scorer === "player") {
          burst(event.x, 20, COLORS.green, 30, 340);
          addPopup(event.x, 110, pick(SCORED), COLORS.green, { size: 26, rise: 40 });
          say(pick(TUNA_CONCEDES));
        } else {
          burst(event.x, H - 20, COLORS.red, 30, 340);
          addPopup(event.x, H - 110, pick(MISSED), COLORS.red, { size: 26 });
          say(pick(TUNA_SCORES));
        }
        break;
      case "matchPoint":
        banner = { title: "MATCH POINT", color: event.side === "player" ? COLORS.green : COLORS.red, born: now };
        say(event.side === "player" ? "Match point? Don't get cocky." : "Match point. Sweating yet?");
        break;
      case "over":
        if (event.winner === "player") {
          streak += 1;
          if (streak > best) {
            best = streak;
            saveSetting(bestKey(), best);
          }
          mode = "won";
          burst(W / 2, H / 2, COLORS.gold, 70, 420);
          showOverlay("won");
        } else {
          mode = "over";
          shakeScreen(18);
          showOverlay("over");
        }
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
    if (!event.repeat && mode !== "playing") primaryAction();
  } else if (event.code === "KeyP" || event.code === "Escape") {
    if (mode === "playing") pause();
    else resume();
  }
});
document.addEventListener("keyup", (event) => {
  if (KEY_LEFT.includes(event.code)) keys.left = false;
  if (KEY_RIGHT.includes(event.code)) keys.right = false;
});

// The mouse moves your paddle wherever it is on the page; a finger has to be on the court
window.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse" && mode === "playing") pointerX = toCourtX(event.clientX);
});
let dragging = false;
boardWrap.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".panel") || event.pointerType === "mouse") return;
  dragging = true;
  pointerX = toCourtX(event.clientX);
});
boardWrap.addEventListener("pointermove", (event) => {
  if (dragging && event.pointerType !== "mouse") pointerX = toCourtX(event.clientX);
});
for (const type of ["pointerup", "pointercancel"]) {
  boardWrap.addEventListener(type, () => (dragging = false));
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
for (const icon of document.querySelectorAll("canvas[data-orb]")) {
  paintIcon(icon, icon.dataset.orb);
}

resizeCanvas();
setMode(gameMode);  // also puts a fresh court behind the start screen
requestAnimationFrame(frame);
