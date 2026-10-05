// The rules of Chaos Breaker, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls. Everything here is measured on a 600 x 800 board.
"use strict";

const SETTINGS = {
  width: 600,
  height: 800,
  paddleY: 740,          // the top edge of the paddle
  paddleHeight: 14,
  paddleWidth: 100,
  paddleKeySpeed: 820,   // how fast the arrow keys move the paddle, per second
  paddleChaseSpeed: 2600, // how fast the paddle chases your mouse or finger, per second
  ballRadius: 8,
  ballSpeed: 400,        // per second, on level 1
  levelSpeedUp: 0.06,    // each level makes the ball this much faster
  maxBounceAngle: 60,    // degrees from straight up, when the ball hits the very edge of the paddle
  lives: 3,
  maxLives: 5,
  maxBalls: 8,
  cols: 10,
  brickWidth: 56,
  brickHeight: 22,
  brickGap: 4,
  wallTop: 70,           // where the top row of bricks starts
  rowStep: 26,           // brick height plus the gap; also how far the wall creeps each time
  maxRows: 9,
  dropChance: 0.2,       // how often a broken brick drops a mystery capsule
  capsuleSpeed: 170,
  effectTime: 10,        // how long most capsule effects last, in seconds
  fogTime: 6,
  invisibleTime: 6,
  drunkDelay: 0.5,       // how far behind your controls the paddle is when drunk, in seconds
  wideScale: 1.6,
  tinyScale: 0.55,
  fastScale: 1.45,
  slowScale: 0.65,
  launchWait: 3,         // the ball launches itself if you wait this long
  stickyWait: 1.5,       // and this long when it's stuck to a sticky paddle
  creepFull: 10,         // with a full wall it creeps down a row every 10 seconds...
  creepEmpty: 24,        // ...slowing to every 24 seconds as it empties
  dangerGap: 12,         // the game is over when the wall gets this close to the paddle
  netY: 788,             // where the safety net catches the ball
  brickPoints: 10,
  levelBonus: 100,       // times the level number
  rainbowPoints: 250,
  rainbowTime: 8,
  rainbowGapMin: 20,
  rainbowGapMax: 40,
};

// Every capsule looks the same until you catch it. "weight" is how likely each one is.
const CAPSULES = {
  wide: { kind: "good", weight: 1, text: "Good: wide paddle. Even you can't miss now.", popup: "WIDE!" },
  multi: { kind: "good", weight: 1, text: "Good: +2 balls. Chaos, but the fun kind.", popup: "MULTIBALL!" },
  slow: { kind: "good", weight: 1, text: "Good: slow-mo. Your reflexes needed this.", popup: "SLOW-MO" },
  sticky: { kind: "good", weight: 1, text: "Good: sticky paddle. Catch it, aim it, show off.", popup: "STICKY!" },
  net: { kind: "good", weight: 1, text: "Good: safety net. One free mistake. Don't waste it.", popup: "NET!" },
  life: { kind: "good", weight: 0.5, text: "Good: extra life. Someone believes in you.", popup: "+1 LIFE" },
  reversed: { kind: "bad", weight: 1, text: "Bad: controls reversed. Left is right now. Good luck.", popup: "REVERSED!" },
  drunk: { kind: "bad", weight: 1, text: "Bad: drunk paddle. Maybe sit this one out.", popup: "DRUNK!" },
  tiny: { kind: "bad", weight: 1, text: "Bad: tiny paddle. Aim better, I guess.", popup: "TINY!" },
  fast: { kind: "bad", weight: 1, text: "Bad: fast ball. Blink and it's gone.", popup: "ZOOM!" },
  fog: { kind: "bad", weight: 1, text: "Bad: fog. Hope you memorised the bricks.", popup: "FOG!" },
  invisible: { kind: "bad", weight: 1, text: "Bad: invisible ball. Where'd it go? Exactly.", popup: "WHERE'D IT GO?" },
  steel: { kind: "bad", weight: 1, text: "Bad: a steel brick. That one's not going anywhere.", popup: "STEEL!" },
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

class BrickGame {
  // Classic mode is plain brick breaker: no capsules, no creeping wall, no combos
  constructor({ classic = false, random = Math.random } = {}) {
    this.classic = classic;
    this.random = random;
    this.time = 0;          // game clock in seconds; it only runs while the game is being played
    this.events = [];       // things that happened, for the screen to react to (popups etc.)
    this.over = null;       // why the game ended, once it has

    this.score = 0;
    this.level = 1;
    this.lives = SETTINGS.lives;
    this.combo = 0;         // bricks broken since the ball last touched the paddle
    this.bestCombo = 0;
    this.caught = { good: 0, bad: 0 };

    this.paddle = { x: SETTINGS.width / 2 };
    this.input = { left: false, right: false, targetX: null };
    this.inputHistory = [];  // recent controls, so a drunk paddle can follow them late

    // Effects from capsules. Each "Until" is the game time the effect wears off.
    this.wideUntil = 0;
    this.slowUntil = 0;
    this.stickyUntil = 0;
    this.reversedUntil = 0;
    this.drunkUntil = 0;
    this.tinyUntil = 0;
    this.fastUntil = 0;
    this.fogUntil = 0;
    this.invisibleUntil = 0;
    this.net = false;

    this.rainbowBrick = null;
    this.nextRainbowAt = this.rainbowGap();
    this.buildLevel();
  }

  // ---- Levels ----

  buildLevel() {
    const rows = Math.min(4 + this.level, SETTINGS.maxRows);
    const left = (SETTINGS.width - (SETTINGS.cols * SETTINGS.brickWidth + (SETTINGS.cols - 1) * SETTINGS.brickGap)) / 2;
    this.bricks = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < SETTINGS.cols; col++) {
        // From level 3 a few bricks are missing, so no two walls look the same
        if (this.level >= 3 && this.random() < 0.08) continue;
        let hp = 1;
        if (this.level >= 2 && row < 2) hp = 2;
        if (this.level >= 4 && row === 0) hp = 3;
        this.bricks.push({
          x: left + col * (SETTINGS.brickWidth + SETTINGS.brickGap),
          y: SETTINGS.wallTop + row * SETTINGS.rowStep,
          w: SETTINGS.brickWidth,
          h: SETTINGS.brickHeight,
          row,
          hp,
          maxHp: hp,
          steel: false,
          alive: true,
          rainbowUntil: 0,
        });
      }
    }
    // From level 3, Chaos mode mixes in some steel bricks that never break
    if (!this.classic && this.level >= 3) {
      for (let i = 0; i < Math.min(this.level - 2, 4); i++) {
        const brick = this.bricks[Math.floor(this.random() * this.bricks.length)];
        brick.steel = true;
      }
    }
    this.startingBricks = Math.max(1, this.breakableLeft());
    this.creepProgress = 0;
    this.capsules = [];
    this.rainbowBrick = null;
    this.balls = [this.newBall()];
    this.autoLaunchAt = this.time + SETTINGS.launchWait;
  }

  breakableLeft() {
    return this.bricks.filter((b) => b.alive && !b.steel).length;
  }

  levelUp() {
    const bonus = SETTINGS.levelBonus * this.level;
    this.score += bonus;
    this.events.push({ type: "level", level: this.level + 1, bonus });
    this.level += 1;
    this.combo = 0;
    this.buildLevel();
  }

  // ---- Controls ----

  setInput({ left = false, right = false, targetX = null }) {
    this.input = { left, right, targetX };
  }

  controls() {
    // A drunk paddle follows what you were doing half a second ago
    let input = this.input;
    if (this.drunkLeft() > 0) {
      const then = this.time - SETTINGS.drunkDelay;
      input = { left: false, right: false, targetX: null };
      for (let i = this.inputHistory.length - 1; i >= 0; i--) {
        if (this.inputHistory[i].t <= then) {
          input = this.inputHistory[i];
          break;
        }
      }
    }
    // Reversed controls swap left and right, and mirror your mouse or finger
    if (this.reversedLeft() > 0) {
      return {
        left: input.right,
        right: input.left,
        targetX: input.targetX === null ? null : SETTINGS.width - input.targetX,
      };
    }
    return input;
  }

  launch() {
    // Sends off any ball that's sitting on the paddle
    let launched = false;
    for (const ball of this.balls) {
      if (!ball.stuck) continue;
      const offset = clamp(ball.offset / (this.paddleWidth() / 2), -1, 1);
      const angle = (offset * 0.6 + (this.random() - 0.5) * 0.3) * (SETTINGS.maxBounceAngle * Math.PI / 180);
      ball.vx = Math.sin(angle);
      ball.vy = -Math.cos(angle);
      ball.stuck = false;
      launched = true;
    }
    return launched;
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over) return;
    this.time += dt;
    this.inputHistory.push({ t: this.time, ...this.input });
    while (this.inputHistory.length && this.inputHistory[0].t < this.time - 2) this.inputHistory.shift();

    this.movePaddle(dt);
    for (const ball of this.balls) {
      if (ball.stuck) this.rideOnPaddle(ball);
    }
    if (this.balls.some((b) => b.stuck) && this.time >= this.autoLaunchAt) {
      this.launch();
      this.events.push({ type: "autoLaunch", x: this.paddle.x });
    }

    this.moveBalls(dt);
    if (this.over) return;
    this.moveCapsules(dt);
    this.updateRainbow();
    this.creep(dt);
    if (this.over) return;
    if (this.breakableLeft() === 0) this.levelUp();
  }

  movePaddle(dt) {
    const { left, right, targetX } = this.controls();
    const paddle = this.paddle;
    if (targetX !== null) {
      const most = SETTINGS.paddleChaseSpeed * dt;
      paddle.x += clamp(targetX - paddle.x, -most, most);
    }
    if (left) paddle.x -= SETTINGS.paddleKeySpeed * dt;
    if (right) paddle.x += SETTINGS.paddleKeySpeed * dt;
    const half = this.paddleWidth() / 2;
    paddle.x = clamp(paddle.x, half, SETTINGS.width - half);
  }

  rideOnPaddle(ball) {
    const half = this.paddleWidth() / 2;
    ball.offset = clamp(ball.offset, -half + 4, half - 4);
    ball.x = this.paddle.x + ball.offset;
    ball.y = SETTINGS.paddleY - SETTINGS.ballRadius - 0.5;
  }

  newBall() {
    return { x: this.paddle.x, y: SETTINGS.paddleY - SETTINGS.ballRadius - 0.5, vx: 0, vy: -1, stuck: true, offset: 0 };
  }

  ballSpeed() {
    let speed = SETTINGS.ballSpeed * (1 + SETTINGS.levelSpeedUp * (this.level - 1));
    if (this.fastLeft() > 0) speed *= SETTINGS.fastScale;
    if (this.slowLeft() > 0) speed *= SETTINGS.slowScale;
    return speed;
  }

  paddleWidth() {
    let width = SETTINGS.paddleWidth;
    if (this.wideLeft() > 0) width *= SETTINGS.wideScale;
    if (this.tinyLeft() > 0) width *= SETTINGS.tinyScale;
    return width;
  }

  moveBalls(dt) {
    // Balls store their direction; the speed comes from the level and the current effects
    const speed = this.ballSpeed();
    const steps = Math.max(1, Math.ceil((speed * dt) / 4));  // small steps, so it never skips through a brick
    for (const ball of this.balls) {
      const length = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx /= length;
      ball.vy /= length;
      for (let i = 0; i < steps && !ball.stuck && !ball.gone; i++) {
        this.moveBall(ball, (speed * dt) / steps);
      }
    }
    this.balls = this.balls.filter((b) => !b.gone);
    if (this.balls.length === 0) this.loseLife();
  }

  moveBall(ball, distance) {
    const r = SETTINGS.ballRadius;
    const prevY = ball.y;
    ball.x += ball.vx * distance;
    ball.y += ball.vy * distance;

    // Walls and ceiling
    if (ball.x < r) { ball.x = r; ball.vx = Math.abs(ball.vx); }
    if (ball.x > SETTINGS.width - r) { ball.x = SETTINGS.width - r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < r) { ball.y = r; ball.vy = Math.abs(ball.vy); }

    // The paddle
    const half = this.paddleWidth() / 2;
    if (ball.vy > 0 && prevY + r <= SETTINGS.paddleY + 1 && ball.y + r >= SETTINGS.paddleY &&
        Math.abs(ball.x - this.paddle.x) <= half + r) {
      this.hitPaddle(ball, half);
      return;
    }

    // Bricks: bounce off the first one we're touching
    for (const brick of this.bricks) {
      if (!brick.alive) continue;
      if (this.bounceOffBrick(ball, brick)) {
        this.hitBrick(brick);
        break;
      }
    }

    // The safety net catches one ball, then it's gone
    if (this.net && ball.vy > 0 && ball.y + r >= SETTINGS.netY) {
      this.net = false;
      ball.y = SETTINGS.netY - r;
      ball.vy = -Math.abs(ball.vy);
      this.events.push({ type: "netSave", x: ball.x });
    }
    // Falling off the bottom
    if (ball.y - r > SETTINGS.height) {
      ball.gone = true;
      this.events.push({ type: "lostBall", x: ball.x });
    }
  }

  hitPaddle(ball, half) {
    const r = SETTINGS.ballRadius;
    ball.y = SETTINGS.paddleY - r;
    // Where it lands on the paddle decides the angle it leaves at
    const offset = clamp((ball.x - this.paddle.x) / half, -1, 1);
    const angle = offset * SETTINGS.maxBounceAngle * Math.PI / 180;
    ball.vx = Math.sin(angle);
    ball.vy = -Math.cos(angle);
    this.combo = 0;
    this.events.push({ type: "paddle", x: ball.x });
    if (this.stickyLeft() > 0) {
      ball.stuck = true;
      ball.offset = ball.x - this.paddle.x;
      this.autoLaunchAt = this.time + SETTINGS.stickyWait;
    }
  }

  bounceOffBrick(ball, brick) {
    const r = SETTINGS.ballRadius;
    // The point on the brick closest to the ball's centre
    const cx = clamp(ball.x, brick.x, brick.x + brick.w);
    const cy = clamp(ball.y, brick.y, brick.y + brick.h);
    let nx = ball.x - cx;
    let ny = ball.y - cy;
    const distance = Math.hypot(nx, ny);
    if (distance > r) return false;

    if (distance === 0) {
      // The ball's centre is inside the brick: push it out through the nearest edge
      const exits = [
        [ball.x - brick.x, -1, 0], [brick.x + brick.w - ball.x, 1, 0],
        [ball.y - brick.y, 0, -1], [brick.y + brick.h - ball.y, 0, 1],
      ].sort((a, b) => a[0] - b[0]);
      [, nx, ny] = exits[0];
      ball.x = nx ? (nx < 0 ? brick.x - r : brick.x + brick.w + r) : ball.x;
      ball.y = ny ? (ny < 0 ? brick.y - r : brick.y + brick.h + r) : ball.y;
    } else {
      nx /= distance;
      ny /= distance;
      ball.x = cx + nx * r;
      ball.y = cy + ny * r;
    }

    // Bounce off the surface it hit, if it was heading into it
    const dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) {
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
    }
    // Never let it end up going almost sideways, or it would take forever to come back down
    if (Math.abs(ball.vy) < 0.25) {
      ball.vy = ball.vy < 0 ? -0.25 : 0.25;
      ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(1 - 0.25 * 0.25);
    }
    return true;
  }

  hitBrick(brick) {
    const x = brick.x + brick.w / 2;
    const y = brick.y + brick.h / 2;
    if (brick.steel) {
      this.events.push({ type: "steelHit", x, y });
      return;
    }
    brick.hp -= 1;
    if (brick.hp > 0) {
      this.events.push({ type: "brickHit", x, y, brick });
      return;
    }

    brick.alive = false;
    const rainbow = brick.rainbowUntil > this.time;
    // Every brick broken before the ball gets back to the paddle grows the combo
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const multiplier = this.classic ? 1 : this.combo;
    const points = (rainbow ? SETTINGS.rainbowPoints : SETTINGS.brickPoints) * multiplier;
    this.score += points;
    this.events.push({ type: "brick", x, y, brick, points, combo: multiplier, rainbow });

    if (!this.classic && !rainbow && this.random() < SETTINGS.dropChance) {
      this.capsules.push({ x, y, kind: this.random() < 0.5 ? "good" : "bad" });
    }
  }

  loseLife() {
    this.lives -= 1;
    this.combo = 0;
    this.events.push({ type: "lostLife", lives: this.lives });
    if (this.lives <= 0) {
      this.end("Out of balls. Embarrassing.");
      return;
    }
    this.balls = [this.newBall()];
    this.autoLaunchAt = this.time + SETTINGS.launchWait;
  }

  // ---- The wall ----

  creep(dt) {
    if (this.classic) return;
    // It creeps faster when there are more bricks left
    const full = this.breakableLeft() / this.startingBricks;
    const interval = SETTINGS.creepEmpty - (SETTINGS.creepEmpty - SETTINGS.creepFull) * full;
    this.creepProgress += dt / interval;
    if (this.creepProgress < 1) return;

    this.creepProgress = 0;
    for (const brick of this.bricks) brick.y += SETTINGS.rowStep;
    this.events.push({ type: "creep" });
    // Don't leave a ball stuck inside a brick that just moved onto it
    for (const ball of this.balls) {
      if (ball.stuck) continue;
      for (const brick of this.bricks) {
        if (brick.alive && this.touching(ball, brick)) {
          ball.y = brick.y + brick.h + SETTINGS.ballRadius;
          ball.vy = Math.abs(ball.vy);
        }
      }
    }
    if (this.wallBottom() >= SETTINGS.paddleY - SETTINGS.dangerGap) {
      this.end("The wall got you. It moves at like one mile an hour.");
    }
  }

  wallBottom() {
    let bottom = 0;
    for (const brick of this.bricks) {
      if (brick.alive) bottom = Math.max(bottom, brick.y + brick.h);
    }
    return bottom;
  }

  touching(ball, rect) {
    const cx = clamp(ball.x, rect.x, rect.x + rect.w);
    const cy = clamp(ball.y, rect.y, rect.y + rect.h);
    return Math.hypot(ball.x - cx, ball.y - cy) <= SETTINGS.ballRadius;
  }

  // ---- Capsules ----

  moveCapsules(dt) {
    const half = this.paddleWidth() / 2;
    for (const capsule of this.capsules) {
      capsule.y += SETTINGS.capsuleSpeed * dt;
      const onPaddle = capsule.y + 8 >= SETTINGS.paddleY && capsule.y - 8 <= SETTINGS.paddleY + SETTINGS.paddleHeight &&
        Math.abs(capsule.x - this.paddle.x) <= half + 17;
      if (onPaddle) {
        capsule.done = true;
        this.catchCapsule(capsule);
      } else if (capsule.y - 8 > SETTINGS.height) {
        capsule.done = true;
      }
    }
    this.capsules = this.capsules.filter((c) => !c.done);
  }

  pickCapsule(kind) {
    const options = Object.entries(CAPSULES).filter(([, c]) => c.kind === kind);
    let roll = this.random() * options.reduce((total, [, c]) => total + c.weight, 0);
    for (const [name, capsule] of options) {
      roll -= capsule.weight;
      if (roll < 0) return name;
    }
    return options[options.length - 1][0];
  }

  catchCapsule(capsule) {
    const name = this.pickCapsule(capsule.kind);
    this.caught[capsule.kind] += 1;
    const message = this.applyCapsule(name) || CAPSULES[name];
    this.events.push({ type: "caught", name, kind: capsule.kind, x: capsule.x, y: SETTINGS.paddleY,
      text: message.text, popup: message.popup });
  }

  applyCapsule(name) {
    const until = this.time + SETTINGS.effectTime;
    if (name === "wide") this.wideUntil = until;
    if (name === "slow") this.slowUntil = until;
    if (name === "sticky") this.stickyUntil = until;
    if (name === "reversed") this.reversedUntil = until;
    if (name === "drunk") this.drunkUntil = until;
    if (name === "tiny") this.tinyUntil = until;
    if (name === "fast") this.fastUntil = until;
    if (name === "fog") this.fogUntil = this.time + SETTINGS.fogTime;
    if (name === "invisible") this.invisibleUntil = this.time + SETTINGS.invisibleTime;
    if (name === "net") this.net = true;
    if (name === "life") {
      if (this.lives >= SETTINGS.maxLives) return { text: "Good: extra life, but you're maxed out. Greedy.", popup: "MAXED" };
      this.lives += 1;
    }
    if (name === "multi") this.addBalls(2);
    if (name === "steel" && !this.addSteelBrick()) {
      return { text: "Bad: a steel brick, but there was no room. Lucky.", popup: "PHEW" };
    }
    return null;
  }

  addBalls(count) {
    // New balls split off an existing one at slightly different angles
    const source = this.balls.find((b) => !b.stuck) || this.balls[0];
    for (let i = 0; i < count && this.balls.length < SETTINGS.maxBalls; i++) {
      const turn = (i === 0 ? -1 : 1) * 0.45;
      let vx = source.stuck ? 0 : source.vx;
      let vy = source.stuck ? -1 : source.vy;
      [vx, vy] = [vx * Math.cos(turn) - vy * Math.sin(turn), vx * Math.sin(turn) + vy * Math.cos(turn)];
      if (Math.abs(vy) < 0.3) vy = vy < 0 ? -0.3 : 0.3;
      const length = Math.hypot(vx, vy);
      this.balls.push({ x: source.x, y: source.y, vx: vx / length, vy: vy / length, stuck: false, offset: 0 });
    }
  }

  addSteelBrick() {
    // Put a steel brick in an empty spot in the wall, or just below it
    const left = (SETTINGS.width - (SETTINGS.cols * SETTINGS.brickWidth + (SETTINGS.cols - 1) * SETTINGS.brickGap)) / 2;
    const top = Math.min(...this.bricks.filter((b) => b.alive).map((b) => b.y), SETTINGS.wallTop);
    const lowest = SETTINGS.paddleY - SETTINGS.dangerGap - 3 * SETTINGS.rowStep;
    const spots = [];
    for (let y = top; y <= Math.min(this.wallBottom() + SETTINGS.rowStep, lowest); y += SETTINGS.rowStep) {
      for (let col = 0; col < SETTINGS.cols; col++) {
        const spot = { x: left + col * (SETTINGS.brickWidth + SETTINGS.brickGap), y, w: SETTINGS.brickWidth, h: SETTINGS.brickHeight };
        const taken = this.bricks.some((b) => b.alive && Math.abs(b.x - spot.x) < 1 && Math.abs(b.y - spot.y) < 1);
        const ballThere = this.balls.some((ball) => this.touching(ball, { x: spot.x - 4, y: spot.y - 4, w: spot.w + 8, h: spot.h + 8 }));
        if (!taken && !ballThere) spots.push(spot);
      }
    }
    if (spots.length === 0) return false;
    const spot = spots[Math.floor(this.random() * spots.length)];
    this.bricks.push({ ...spot, row: -1, hp: 1, maxHp: 1, steel: true, alive: true, rainbowUntil: 0, isNew: true });
    this.events.push({ type: "steel", x: spot.x + spot.w / 2, y: spot.y + spot.h / 2 });
    return true;
  }

  // ---- The rainbow brick ----

  rainbowGap() {
    return this.time + SETTINGS.rainbowGapMin + this.random() * (SETTINGS.rainbowGapMax - SETTINGS.rainbowGapMin);
  }

  updateRainbow() {
    if (this.classic) return;
    const current = this.rainbowBrick;
    if (current && (!current.alive || current.rainbowUntil <= this.time)) {
      this.rainbowBrick = null;
      this.nextRainbowAt = this.rainbowGap();
    } else if (!current && this.time >= this.nextRainbowAt) {
      const choices = this.bricks.filter((b) => b.alive && !b.steel);
      if (choices.length) {
        const brick = choices[Math.floor(this.random() * choices.length)];
        brick.rainbowUntil = this.time + SETTINGS.rainbowTime;
        this.rainbowBrick = brick;
        this.events.push({ type: "rainbow", x: brick.x + brick.w / 2, y: brick.y + brick.h / 2 });
      } else {
        this.nextRainbowAt = this.rainbowGap();
      }
    }
  }

  // ---- Helpers ----

  timeLeft(until) {
    return Math.max(0, until - this.time);
  }

  wideLeft() { return this.timeLeft(this.wideUntil); }
  slowLeft() { return this.timeLeft(this.slowUntil); }
  stickyLeft() { return this.timeLeft(this.stickyUntil); }
  reversedLeft() { return this.timeLeft(this.reversedUntil); }
  drunkLeft() { return this.timeLeft(this.drunkUntil); }
  tinyLeft() { return this.timeLeft(this.tinyUntil); }
  fastLeft() { return this.timeLeft(this.fastUntil); }
  fogLeft() { return this.timeLeft(this.fogUntil); }
  invisibleLeft() { return this.timeLeft(this.invisibleUntil); }

  end(reason) {
    this.over = reason;
    this.events.push({ type: "over", reason });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { BrickGame, SETTINGS, CAPSULES };
}
