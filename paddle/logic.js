// The rules of Chaos Paddle, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls. Everything here is measured on a 600 x 800 court.
"use strict";

const SETTINGS = {
  width: 600,
  height: 800,
  playerY: 740,          // the top edge of your paddle, at the bottom of the court
  cpuY: 46,              // the top edge of Tuna Marie's paddle, at the top of the court
  paddleHeight: 14,
  paddleWidth: 100,
  paddleKeySpeed: 900,   // how fast the arrow keys move your paddle, per second
  paddleChaseSpeed: 2600, // how fast your paddle chases your mouse or finger, per second
  ballRadius: 9,
  ballSpeed: 380,        // per second, at the start of a rally
  rallySpeedUp: 0.05,    // every paddle hit in a rally makes the ball this much faster...
  maxRallySpeed: 1.9,    // ...up to this many times its starting speed
  matchSpeedUp: 0.05,    // and every match you win makes it a bit faster too
  maxBounceAngle: 60,    // degrees from straight, when the ball hits the very end of a paddle
  winScore: 7,           // first to this many points wins the match
  serveWait: 1.1,        // pause before each serve, in seconds
  maxBalls: 5,
  orbRadius: 16,
  maxOrbs: 2,
  orbGapMin: 5,          // a new mystery orb shows up this many seconds after the last one...
  orbGapMax: 9,          // ...up to this many
  orbLife: 14,           // and fizzles out if nobody hits it in time
  effectTime: 10,        // how long most orb effects last, in seconds
  shortTime: 6,          // fog and the invisible ball don't last as long
  tiltTime: 8,
  drunkDelay: 0.5,       // how far behind your controls a drunk paddle is, in seconds
  giantScale: 1.6,
  tinyScale: 0.55,
  slowScale: 0.6,        // slow-mo: the ball moves this fast while it's coming at you
  curvePush: 420,        // how hard a curveball bends, sideways, per second per second
  tiltPush: 260,         // how hard a tilted court pulls the ball sideways
  shieldPlayerY: 782,    // where the shields sit behind each goal
  shieldCpuY: 18,
  cpuBaseSpeed: 340,     // how fast Tuna Marie can move his paddle, per second...
  cpuSpeedPerWin: 70,    // ...and how much faster he gets every match you win
  cpuMaxSpeed: 980,
  cpuBaseError: 80,      // how far off Tuna Marie's aim can be, in court units...
  cpuErrorPerWin: 8,     // ...getting sharper every match you win
  cpuMinError: 20,
  cpuThink: 0.12,        // Tuna Marie rethinks where to go this often, in seconds
};

const SIDES = ["player", "cpu"];
const OTHER = { player: "cpu", cpu: "player" };

// Every orb looks the same until the ball hits it. Whoever last touched the ball gets the effect.
// "text" is what you see when you get it, "cpuText" when Tuna Marie does, "quip" is Tuna Marie complaining.
const ORBS = {
  giant: { kind: "good", weight: 1, popup: "GIANT!", text: "Good: giant paddle. Finally, a fair fight.",
    cpuText: "Tuna Marie got a giant paddle. Cheater.", quip: "Size upgrade installed." },
  multi: { kind: "good", weight: 1, popup: "MULTIBALL!", text: "Good: multiball. Tuna Marie hates this one.",
    cpuText: "Tuna Marie set off multiball. Chaos for everyone.", quip: "More balls, more problems. For YOU." },
  curve: { kind: "good", weight: 1, popup: "CURVE!", text: "Good: curveballs. Your shots bend now. Show-off.",
    cpuText: "Tuna Marie's shots curve now. Ugh.", quip: "Watch this. Physics is optional." },
  slow: { kind: "good", weight: 1, popup: "SLOW-MO", text: "Good: slow-mo. The ball strolls over to you.",
    cpuText: "Tuna Marie got slow-mo. The ball takes its sweet time getting to him.", quip: "Ahh. Plenty of time." },
  shield: { kind: "good", weight: 1, popup: "SHIELD!", text: "Good: a shield behind you. One free save.",
    cpuText: "Tuna Marie got a shield. Coward.", quip: "Try getting past THAT." },
  tiny: { kind: "bad", weight: 1, popup: "TINY!", text: "Bad: tiny paddle. Good luck with that.",
    cpuText: "Tuna Marie got a tiny paddle. Ha!", quip: "Hey! Give that back!" },
  reversed: { kind: "bad", weight: 1, popup: "REVERSED!", text: "Bad: controls reversed. Left is right. Right is wrong.",
    cpuText: "Tuna Marie's controls are reversed. Watch him flail.", quip: "Which way is LEFT?!" },
  drunk: { kind: "bad", weight: 1, popup: "DRUNK!", text: "Bad: drunk paddle. Tuna Marie is laughing.",
    cpuText: "Tuna Marie is drunk. On electricity, probably.", quip: "I'm not drunk, YOU'RE drunk." },
  fog: { kind: "bad", weight: 1, popup: "FOG!", text: "Bad: fog. You can only see near the ball.",
    cpuText: "Tuna Marie is lost in the fog. He can't see a thing.", quip: "Who turned off the lights?" },
  invisible: { kind: "bad", weight: 1, popup: "WHERE'D IT GO?", text: "Bad: invisible ball. Just guess.",
    cpuText: "The ball is invisible to Tuna Marie. Sneaky.", quip: "Where'd it go?! Where'd it GO?!" },
  tilt: { kind: "bad", weight: 1, popup: "TILT!", text: "Bad: the court tilts. Physics has left the chat.",
    cpuText: "Tuna Marie tilted the court. Everyone suffers.", quip: "Why is the floor slanted?" },
};
const TIMED = ["giant", "curve", "slow", "tiny", "reversed", "drunk", "fog", "invisible", "tilt"];

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

class PaddleGame {
  // Classic mode is a plain duel: no mystery orbs, no effects.
  // "wins" is how many matches you've won in a row, which makes Tuna Marie (and the ball) better.
  constructor({ classic = false, random = Math.random, wins = 0 } = {}) {
    this.classic = classic;
    this.random = random;
    this.wins = wins;
    this.time = 0;          // match clock in seconds; it only runs while the match is being played
    this.events = [];       // things that happened, for the screen to react to (popups etc.)
    this.over = null;       // why the match ended, once it has
    this.winner = null;     // "player" or "cpu"

    this.score = { player: 0, cpu: 0 };
    this.rally = 0;          // paddle hits since the last serve
    this.longestRally = 0;
    this.orbsHit = { player: 0, cpu: 0 };

    this.paddles = { player: { x: SETTINGS.width / 2 }, cpu: { x: SETTINGS.width / 2 } };
    this.input = { left: false, right: false, targetX: null };
    this.inputHistory = [];  // recent controls, so a drunk paddle can follow them late
    this.cpuTarget = SETTINGS.width / 2;
    this.cpuHistory = [];    // Tuna Marie's recent plans, for when he's drunk
    this.cpuError = 0;
    this.nextThinkAt = 0;

    // Effects from orbs, per side. Each value is the match time the effect wears off.
    this.fx = {};
    for (const side of SIDES) {
      this.fx[side] = {};
      for (const name of TIMED) this.fx[side][name] = 0;
    }
    this.shield = { player: false, cpu: false };
    this.tiltUntil = 0;
    this.tiltDir = 1;

    this.orbs = [];
    this.nextOrbAt = this.orbGap();
    this.balls = [];
    this.serve("player");
  }

  // ---- Effects ----

  left(side, name) {
    // Time left on an effect for one side. (A tilted court pulls on everyone; this is who caused it.)
    return Math.max(0, this.fx[side][name] - this.time);
  }

  tiltLeft() {
    return Math.max(0, this.tiltUntil - this.time);
  }

  paddleWidth(side) {
    let width = SETTINGS.paddleWidth;
    if (this.left(side, "giant") > 0) width *= SETTINGS.giantScale;
    if (this.left(side, "tiny") > 0) width *= SETTINGS.tinyScale;
    return width;
  }

  ballSpeed() {
    const rally = Math.min(1 + SETTINGS.rallySpeedUp * this.rally, SETTINGS.maxRallySpeed);
    return SETTINGS.ballSpeed * (1 + SETTINGS.matchSpeedUp * this.wins) * rally;
  }

  cpuSpeed() {
    return Math.min(SETTINGS.cpuBaseSpeed + SETTINGS.cpuSpeedPerWin * this.wins, SETTINGS.cpuMaxSpeed);
  }

  // ---- Serving ----

  serve(toward) {
    // The ball waits in the middle for a moment, then heads for whoever has to receive it
    this.balls = [{ x: SETTINGS.width / 2, y: SETTINGS.height / 2, vx: 0, vy: 0, spin: 0, waiting: true,
      lastHit: OTHER[toward] }];
    this.serveAt = this.time + SETTINGS.serveWait;
    this.serveToward = toward;
    this.rally = 0;
    this.rollCpuError();
    this.events.push({ type: "serve", toward });
  }

  launchServe() {
    const angle = (this.random() - 0.5) * (50 * Math.PI / 180);
    const speed = this.ballSpeed();
    const ball = this.balls[0];
    ball.vx = Math.sin(angle) * speed;
    ball.vy = Math.cos(angle) * speed * (this.serveToward === "player" ? 1 : -1);
    ball.waiting = false;
  }

  // ---- Controls ----

  setInput({ left = false, right = false, targetX = null }) {
    this.input = { left, right, targetX };
  }

  playerControls() {
    // A drunk paddle follows what you were doing half a second ago
    let input = this.input;
    if (this.left("player", "drunk") > 0) {
      input = this.lookBack(this.inputHistory) || { left: false, right: false, targetX: null };
    }
    // Reversed controls swap left and right, and mirror your mouse or finger
    if (this.left("player", "reversed") > 0) {
      return { left: input.right, right: input.left,
        targetX: input.targetX === null ? null : SETTINGS.width - input.targetX };
    }
    return input;
  }

  lookBack(history) {
    const then = this.time - SETTINGS.drunkDelay;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].t <= then) return history[i];
    }
    return null;
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over) return;
    this.time += dt;
    this.inputHistory.push({ t: this.time, ...this.input });
    while (this.inputHistory.length && this.inputHistory[0].t < this.time - 2) this.inputHistory.shift();

    this.movePlayer(dt);
    this.moveCpu(dt);
    if (this.balls.length && this.balls[0].waiting && this.time >= this.serveAt) this.launchServe();
    this.moveBalls(dt);
    if (this.over) return;
    this.updateOrbs();
    this.keepPaddlesOnCourt();  // a paddle that just turned giant mustn't stick out of the court
  }

  keepPaddlesOnCourt() {
    for (const side of SIDES) {
      const half = this.paddleWidth(side) / 2;
      this.paddles[side].x = clamp(this.paddles[side].x, half, SETTINGS.width - half);
    }
  }

  movePlayer(dt) {
    const { left, right, targetX } = this.playerControls();
    const paddle = this.paddles.player;
    if (targetX !== null) {
      const most = SETTINGS.paddleChaseSpeed * dt;
      paddle.x += clamp(targetX - paddle.x, -most, most);
    }
    if (left) paddle.x -= SETTINGS.paddleKeySpeed * dt;
    if (right) paddle.x += SETTINGS.paddleKeySpeed * dt;
    this.keepPaddlesOnCourt();
  }

  // ---- Tuna Marie, the computer ----

  rollCpuError() {
    // Tuna Marie isn't perfect: each shot coming at him, he misjudges it by a random amount
    const error = Math.max(SETTINGS.cpuMinError, SETTINGS.cpuBaseError - SETTINGS.cpuErrorPerWin * this.wins);
    this.cpuError = (this.random() * 2 - 1) * error;
  }

  cpuPlan() {
    const r = SETTINGS.ballRadius;
    const hitY = SETTINGS.cpuY + SETTINGS.paddleHeight + r;
    // The ball coming at Tuna Marie that's closest to him
    const incoming = this.balls.filter((b) => !b.waiting && b.vy < 0).sort((a, b) => a.y - b.y)[0];
    if (!incoming) return SETTINGS.width / 2 + this.cpuError * 0.5;

    // Work out where it will cross his paddle, bouncing off the side walls on the way
    const t = (incoming.y - hitY) / -incoming.vy;
    let x = incoming.x + incoming.vx * t;
    const span = SETTINGS.width - 2 * r;
    x = ((x - r) % (2 * span) + 2 * span) % (2 * span);
    x = r + (x > span ? 2 * span - x : x);

    // He's much worse at it when he can't see the ball, or the court is tilted
    let error = this.cpuError;
    if (this.left("cpu", "fog") > 0 || this.left("cpu", "invisible") > 0) error *= 5;
    if (this.tiltLeft() > 0) error *= 2.5;
    x += error;
    // Once he's warmed up, he aims for the side you're not on
    if (this.wins >= 2) {
      const away = this.paddles.player.x < SETTINGS.width / 2 ? 1 : -1;
      x -= away * this.paddleWidth("cpu") * 0.3;
    }
    return x;
  }

  moveCpu(dt) {
    if (this.time >= this.nextThinkAt) {
      this.nextThinkAt = this.time + SETTINGS.cpuThink;
      this.cpuTarget = this.cpuPlan();
      this.cpuHistory.push({ t: this.time, targetX: this.cpuTarget });
      while (this.cpuHistory.length && this.cpuHistory[0].t < this.time - 2) this.cpuHistory.shift();
    }
    let target = this.cpuTarget;
    if (this.left("cpu", "drunk") > 0) {
      const then = this.lookBack(this.cpuHistory);
      target = then ? then.targetX : SETTINGS.width / 2;
    }
    if (this.left("cpu", "reversed") > 0) target = SETTINGS.width - target;
    const paddle = this.paddles.cpu;
    const most = this.cpuSpeed() * dt;
    paddle.x += clamp(target - paddle.x, -most, most);
    this.keepPaddlesOnCourt();
  }

  // ---- The ball ----

  moveBalls(dt) {
    const fastest = Math.max(...this.balls.map((b) => Math.hypot(b.vx, b.vy)), 1);
    const steps = Math.max(1, Math.ceil((fastest * dt) / 5));  // small steps, so it never skips a paddle
    for (let i = 0; i < steps && !this.over; i++) {
      for (const ball of this.balls) {
        if (!ball.waiting) this.moveBall(ball, dt / steps);
        if (this.pointScored) break;
      }
      if (this.pointScored) {
        this.pointScored = false;
        break;
      }
    }
  }

  moveBall(ball, dt) {
    const r = SETTINGS.ballRadius;
    const W = SETTINGS.width;
    // Slow-mo only slows the ball down while it's heading at whoever has it
    const heading = ball.vy > 0 ? "player" : "cpu";
    const time = this.left(heading, "slow") > 0 ? dt * SETTINGS.slowScale : dt;

    // Curveballs and a tilted court push the ball sideways
    let push = ball.spin;
    if (this.tiltLeft() > 0) push += this.tiltDir * SETTINGS.tiltPush;
    if (push) {
      const cap = Math.max(Math.abs(ball.vy) * 1.6, 200);
      ball.vx = clamp(ball.vx + push * time, -cap, cap);
    }

    const prevY = ball.y;
    ball.x += ball.vx * time;
    ball.y += ball.vy * time;

    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx); this.events.push({ type: "wall", x: r, y: ball.y }); }
    if (ball.x > W - r) { ball.x = W - r; ball.vx = -Math.abs(ball.vx); this.events.push({ type: "wall", x: W - r, y: ball.y }); }

    // Your paddle, at the bottom
    const playerTop = SETTINGS.playerY;
    if (ball.vy > 0 && prevY + r <= playerTop + 1 && ball.y + r >= playerTop &&
        Math.abs(ball.x - this.paddles.player.x) <= this.paddleWidth("player") / 2 + r) {
      ball.y = playerTop - r;
      this.hitPaddle(ball, "player");
    }
    // Tuna Marie's paddle, at the top
    const cpuBottom = SETTINGS.cpuY + SETTINGS.paddleHeight;
    if (ball.vy < 0 && prevY - r >= cpuBottom - 1 && ball.y - r <= cpuBottom &&
        Math.abs(ball.x - this.paddles.cpu.x) <= this.paddleWidth("cpu") / 2 + r) {
      ball.y = cpuBottom + r;
      this.hitPaddle(ball, "cpu");
    }

    // Mystery orbs
    for (const orb of this.orbs) {
      if (!orb.gone && Math.hypot(ball.x - orb.x, ball.y - orb.y) < SETTINGS.orbRadius + r) {
        orb.gone = true;
        this.collect(orb, ball);
      }
    }
    this.orbs = this.orbs.filter((o) => !o.gone);

    // Shields, then goals
    if (this.shield.player && ball.vy > 0 && ball.y + r >= SETTINGS.shieldPlayerY) {
      this.shield.player = false;
      ball.y = SETTINGS.shieldPlayerY - r;
      ball.vy = -Math.abs(ball.vy);
      this.events.push({ type: "shieldSave", side: "player", x: ball.x });
    }
    if (this.shield.cpu && ball.vy < 0 && ball.y - r <= SETTINGS.shieldCpuY) {
      this.shield.cpu = false;
      ball.y = SETTINGS.shieldCpuY + r;
      ball.vy = Math.abs(ball.vy);
      this.events.push({ type: "shieldSave", side: "cpu", x: ball.x });
    }
    if (ball.y - r > SETTINGS.height) this.point("cpu", ball);
    else if (ball.y + r < 0) this.point("player", ball);
  }

  hitPaddle(ball, side) {
    this.rally += 1;
    this.longestRally = Math.max(this.longestRally, this.rally);
    const speed = this.ballSpeed();
    // Where it lands on the paddle decides the angle it leaves at
    const half = this.paddleWidth(side) / 2;
    const offset = clamp((ball.x - this.paddles[side].x) / half, -1, 1);
    const angle = offset * SETTINGS.maxBounceAngle * Math.PI / 180;
    ball.vx = Math.sin(angle) * speed;
    ball.vy = Math.cos(angle) * speed * (side === "player" ? -1 : 1);
    ball.lastHit = side;
    // A curveball bends one way or the other, so it's hard to read
    ball.spin = this.left(side, "curve") > 0 ? (this.random() < 0.5 ? -1 : 1) * SETTINGS.curvePush : 0;
    if (side === "player") this.rollCpuError();
    this.events.push({ type: "hit", side, x: ball.x, y: ball.y, rally: this.rally });
  }

  point(scorer, ball) {
    this.score[scorer] += 1;
    this.pointScored = true;
    this.events.push({ type: "point", scorer, x: ball.x, rally: this.rally, score: { ...this.score } });
    if (this.score[scorer] >= SETTINGS.winScore) {
      this.balls = [];
      this.winner = scorer;
      this.end(scorer === "player" ? "You beat Tuna Marie. He's taking it personally."
        : "Tuna Marie wins. He will never let you forget this.");
      return;
    }
    if (this.score[scorer] === SETTINGS.winScore - 1) this.events.push({ type: "matchPoint", side: scorer });
    // The one who lost the point receives the next serve
    this.serve(OTHER[scorer]);
  }

  // ---- Mystery orbs ----

  orbGap() {
    return this.time + SETTINGS.orbGapMin + this.random() * (SETTINGS.orbGapMax - SETTINGS.orbGapMin);
  }

  updateOrbs() {
    if (this.classic) return;
    for (const orb of this.orbs) {
      if (this.time >= orb.until) {
        orb.gone = true;
        this.events.push({ type: "orbFizzle", x: orb.x, y: orb.y });
      }
    }
    this.orbs = this.orbs.filter((o) => !o.gone);
    if (this.time < this.nextOrbAt) return;
    this.nextOrbAt = this.orbGap();
    if (this.orbs.length >= SETTINGS.maxOrbs) return;
    // Somewhere in the middle of the court, away from the balls and the other orbs
    for (let tries = 0; tries < 20; tries++) {
      const x = 60 + this.random() * (SETTINGS.width - 120);
      const y = 250 + this.random() * 300;
      const tooClose = this.balls.some((b) => Math.hypot(b.x - x, b.y - y) < 70) ||
        this.orbs.some((o) => Math.hypot(o.x - x, o.y - y) < 60);
      if (!tooClose) {
        this.orbs.push({ x, y, born: this.time, until: this.time + SETTINGS.orbLife });
        this.events.push({ type: "orbSpawn", x, y });
        return;
      }
    }
  }

  pickOrb(kind) {
    const options = Object.entries(ORBS).filter(([, orb]) => orb.kind === kind);
    let roll = this.random() * options.reduce((total, [, orb]) => total + orb.weight, 0);
    for (const [name, orb] of options) {
      roll -= orb.weight;
      if (roll < 0) return name;
    }
    return options[options.length - 1][0];
  }

  collect(orb, ball) {
    const owner = ball.lastHit;
    const kind = this.random() < 0.5 ? "good" : "bad";
    const name = this.pickOrb(kind);
    this.orbsHit[owner] += 1;
    this.applyOrb(owner, name, ball);
    this.events.push({ type: "orb", owner, name, kind, x: orb.x, y: orb.y });
  }

  applyOrb(side, name, ball) {
    if (name === "multi") this.addBalls(ball, 2);
    else if (name === "shield") this.shield[side] = true;
    else if (name === "tilt") {
      this.tiltUntil = this.time + SETTINGS.tiltTime;
      this.tiltDir = this.random() < 0.5 ? -1 : 1;
      this.fx[side].tilt = this.tiltUntil;
    } else {
      const length = name === "fog" || name === "invisible" ? SETTINGS.shortTime : SETTINGS.effectTime;
      this.fx[side][name] = this.time + length;
    }
  }

  addBalls(source, count) {
    // New balls split off the one that hit the orb, at slightly different angles
    for (let i = 0; i < count && this.balls.length < SETTINGS.maxBalls; i++) {
      const turn = (i === 0 ? -1 : 1) * 0.45;
      let vx = source.vx * Math.cos(turn) - source.vy * Math.sin(turn);
      let vy = source.vx * Math.sin(turn) + source.vy * Math.cos(turn);
      const speed = Math.hypot(source.vx, source.vy) || this.ballSpeed();
      if (Math.abs(vy) < speed * 0.4) vy = Math.sign(vy || source.vy || 1) * speed * 0.4;
      this.balls.push({ x: source.x, y: source.y, vx, vy, spin: 0, waiting: false, lastHit: source.lastHit });
    }
  }

  end(reason) {
    this.over = reason;
    this.events.push({ type: "over", winner: this.winner, reason });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { PaddleGame, SETTINGS, ORBS };
}
