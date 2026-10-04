// The rules of Rage Quit Snake, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls.
"use strict";

const SETTINGS = {
  startDelay: 0.2,      // seconds between moves at normal speed
  minSpeed: 0.5,        // slowest the snake can go (0.4s between moves)
  maxSpeed: 4,          // fastest the snake can go (0.05s between moves)
  shrinkTime: 30,       // the snake loses a segment every shrinkTime / length seconds
  effectTime: 10,       // how long reversed, drunk, ghost and runaway last, in seconds
  drunkDelay: 0.5,      // how far behind the controls are when drunk, in seconds
  fogTime: 5,           // how long fog lasts, in seconds
  fogRadius: 4,         // how many cells you can see around your head in fog
  shieldPause: 1,       // how long the snake waits after the shield saves it, in seconds
  runawayStep: 0.35,    // how often runaway apples move, in seconds
  foodCount: 3,         // apples on the board at any time
  badShrink: 3,         // segments the bad "shrink" apple takes away...
  shrinkFloor: 2,       // ...but it never leaves the snake shorter than this
  comboTime: 3,         // eat the next apple within this many seconds to build a combo
  maxCombo: 5,          // the biggest combo multiplier
  jackpotPoints: 5,     // what the rainbow apple is worth
  jackpotTime: 5,       // how long the rainbow apple stays, in seconds
  jackpotGapMin: 20,    // the rainbow apple shows up this many seconds after the last one...
  jackpotGapMax: 40,    // ...up to this many
  classicSpeedUp: 3,    // in Classic mode, each apple makes you this much faster (percent)
};

const NORMAL = "normal";
const BENEFIT = "benefit";
const BAD = "bad";
const JACKPOT = "jackpot";
const FOOD_TYPES = [NORMAL, BENEFIT, BAD];

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
// Grid y grows downward, like the screen
const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const MAX_QUEUED_TURNS = 4;

class SnakeGame {
  // Classic mode is plain snake: one apple at a time, no hunger and none of the crazy rules
  constructor(cols, rows, { classic = false, random = Math.random } = {}) {
    this.cols = cols;
    this.rows = rows;
    this.classic = classic;
    this.random = random;
    this.time = 0;          // game clock in seconds; it only runs while the game is being played
    this.events = [];       // things that happened, for the screen to react to (popups etc.)
    this.over = null;       // why the game ended, once it has

    const x = Math.floor(cols / 2);
    const y = Math.floor(rows / 2);
    this.segments = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }];
    this.longest = this.segments.length;
    this.heading = "right";
    // The direction the snake actually moved last step. Turns are checked against
    // this so two quick presses in one step can't spin the snake back into itself.
    this.lastHeading = "right";
    this.pendingTurns = [];  // key presses waiting to be applied: { at, direction }
    this.speed = 1;
    this.hunger = 0;         // builds from 0 to 1; at 1 the snake loses a segment
    this.nextMoveAt = 0;

    // Effects from apples. Each "Until" is the game time the effect wears off.
    this.reversedUntil = 0;
    this.drunkUntil = 0;
    this.ghostUntil = 0;
    this.fogUntil = 0;
    this.runawayUntil = 0;
    this.nextRunawayAt = 0;
    this.shield = false;
    this.rocks = [];

    this.score = 0;
    this.combo = 0;          // the multiplier the last apple got
    this.comboUntil = 0;     // eat another apple before this to grow the combo
    this.eaten = { normal: 0, benefit: 0, bad: 0, jackpot: 0 };

    this.jackpot = null;     // the rainbow apple, when it's on the board: { x, y, until }
    this.nextJackpotAt = classic ? Infinity : this.jackpotGap();

    this.foods = [];
    for (let i = 0; i < (classic ? 1 : SETTINGS.foodCount); i++) {
      this.foods.push(this.newFood());
    }
  }

  // ---- Controls ----

  press(direction) {
    if (this.over || this.pendingTurns.length >= MAX_QUEUED_TURNS) return;
    let at = this.time;
    if (this.time < this.reversedUntil) direction = OPPOSITE[direction];
    if (this.time < this.drunkUntil) at += SETTINGS.drunkDelay;
    this.pendingTurns.push({ at, direction });
  }

  applyTurns() {
    while (this.pendingTurns.length && this.pendingTurns[0].at <= this.time) {
      const turn = this.pendingTurns.shift();
      if (OPPOSITE[turn.direction] !== this.lastHeading) this.heading = turn.direction;
    }
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over) return;
    this.time += dt;

    // The snake only moves every so often, depending on how fast it's going
    if (this.time >= this.nextMoveAt) {
      this.nextMoveAt = this.time + this.delay();
      this.step();
      if (this.over) return;
    }

    if (this.time < this.runawayUntil && this.time >= this.nextRunawayAt) {
      this.nextRunawayAt = this.time + SETTINGS.runawayStep;
      this.runAway();
    }
    this.updateJackpot();
    this.getHungry(dt);
  }

  step() {
    this.applyTurns();
    const [dx, dy] = STEP[this.heading];
    const head = this.segments[0];
    let next = { x: head.x + dx, y: head.y + dy };

    // As a ghost, going off one edge brings you back on the other side
    if (this.ghostLeft() > 0) {
      next = { x: (next.x + this.cols) % this.cols, y: (next.y + this.rows) % this.rows };
    }

    const crash = this.crashAt(next);
    if (crash) {
      if (this.shield) {
        // The shield takes the hit: stay put and wait a moment so there's time to turn
        this.shield = false;
        this.nextMoveAt = this.time + SETTINGS.shieldPause;
        this.events.push({ type: "saved", x: head.x, y: head.y });
        return;
      }
      this.end(crash);
      return;
    }

    this.segments.unshift(next);
    this.segments.pop();
    this.lastHeading = this.heading;

    const index = this.foods.findIndex((f) => f && f.x === next.x && f.y === next.y);
    if (index !== -1) this.eat(index);
    if (this.jackpot && this.jackpot.x === next.x && this.jackpot.y === next.y) this.eatJackpot();
  }

  crashAt(cell) {
    // Returns why moving into this cell would end the game, or null if it's safe
    if (cell.x < 0 || cell.x >= this.cols || cell.y < 0 || cell.y >= this.rows) return "You crashed!";
    if (this.rocks.some((r) => r.x === cell.x && r.y === cell.y)) return "You hit a rock!";
    // The tail moves out of the way this step, so it doesn't count
    const body = this.segments.slice(1, this.segments.length - 1);
    if (body.some((s) => s.x === cell.x && s.y === cell.y)) return "You crashed!";
    return null;
  }

  getHungry(dt) {
    if (this.classic) return;
    // The longer the snake, the faster it gets hungry
    this.hunger += (dt * this.segments.length) / SETTINGS.shrinkTime;
    if (this.hunger < 1) return;

    this.hunger = 0;
    const tail = this.segments[this.segments.length - 1];
    this.events.push({ type: "lost", x: tail.x, y: tail.y });
    this.shrink(1);
  }

  // ---- Food ----

  isTaken(x, y) {
    return (
      this.segments.some((s) => s.x === x && s.y === y) ||
      this.rocks.some((r) => r.x === x && r.y === y) ||
      this.foods.some((f) => f && f.x === x && f.y === y) ||
      Boolean(this.jackpot && this.jackpot.x === x && this.jackpot.y === y)
    );
  }

  randomFreeCell() {
    // Pick a random empty cell, so nothing lands on the snake, a rock or other food
    const free = [];
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (!this.isTaken(x, y)) free.push({ x, y });
      }
    }
    if (free.length === 0) return null;
    return free[Math.floor(this.random() * free.length)];
  }

  newFood() {
    const cell = this.randomFreeCell();
    if (!cell) return null;
    const type = this.classic ? NORMAL : FOOD_TYPES[Math.floor(this.random() * FOOD_TYPES.length)];
    return { x: cell.x, y: cell.y, type };
  }

  eat(index) {
    const food = this.foods[index];
    const at = { x: food.x, y: food.y };
    const { text, popup } = this.applyFood(food.type, at);
    this.eaten[food.type] += 1;
    const points = this.addPoints(1);
    this.events.push({ type: "ate", food: food.type, x: at.x, y: at.y, text, popup, points, combo: this.combo });
    // Respawn it somewhere new, as a new random type
    this.foods[index] = null;
    this.foods[index] = this.newFood();
  }

  addPoints(base) {
    if (this.classic) {
      this.score += base;
      return base;
    }
    // Eating again within comboTime seconds grows the combo multiplier
    this.combo = this.time < this.comboUntil ? Math.min(this.combo + 1, SETTINGS.maxCombo) : 1;
    this.comboUntil = this.time + SETTINGS.comboTime;
    const points = base * this.combo;
    this.score += points;
    return points;
  }

  pick(options) {
    return options[Math.floor(this.random() * options.length)];
  }

  applyFood(type, at) {
    if (this.classic) {
      this.grow(1);
      this.changeSpeed(SETTINGS.classicSpeedUp);
      return { text: "", popup: "+1" };
    }

    if (type === NORMAL) {
      this.grow(1);
      this.changeSpeed(5);
      return { text: "Normal: +1 segment, speed +5%", popup: "+1" };
    }

    if (type === BENEFIT) {
      const effect = this.pick(["slower", "grow", "shield", "ghost"]);
      if (effect === "slower") {
        this.grow(1);
        this.changeSpeed(-10);
        return { text: "Benefit: +1 segment, speed -10%", popup: "SLOWER" };
      }
      if (effect === "grow") {
        this.grow(2);
        return { text: "Benefit: +2 segments", popup: "+2" };
      }
      // Apart from the ones that say otherwise, every apple grows you by 1
      if (effect === "shield") {
        this.grow(1);
        this.shield = true;
        return { text: "Benefit: shield! Next crash forgiven", popup: "SHIELD!" };
      }
      this.grow(1);
      this.ghostUntil = this.time + SETTINGS.effectTime;
      return { text: "Benefit: ghost! Go through walls", popup: "GHOST!" };
    }

    // Otherwise it's bad food. It still grows you by 1, unless it's the one that shrinks you.
    const effect = this.pick(["faster", "shrink", "reverse", "drunk", "rock", "fog", "runaway"]);
    if (effect !== "shrink") this.grow(1);
    if (effect === "faster") {
      this.changeSpeed(20);
      return { text: "Bad: speed +20%", popup: "FASTER!" };
    }
    if (effect === "shrink") {
      // A bad apple can hurt, but it never shrinks the snake below shrinkFloor
      const lost = Math.min(SETTINGS.badShrink, Math.max(0, this.segments.length - SETTINGS.shrinkFloor));
      this.shrink(lost);
      if (lost === 0) return { text: "Bad: shrink, but you're already tiny", popup: "SAFE" };
      return { text: `Bad: -${lost} segment${lost > 1 ? "s" : ""}`, popup: `-${lost}` };
    }
    if (effect === "reverse") {
      this.reversedUntil = this.time + SETTINGS.effectTime;
      return { text: "Bad: controls reversed!", popup: "REVERSED!" };
    }
    if (effect === "drunk") {
      this.drunkUntil = this.time + SETTINGS.effectTime;
      return { text: "Bad: drunk!", popup: "DRUNK!" };
    }
    if (effect === "rock") {
      // Left right where you ate it, for the rest of the game
      this.rocks.push({ x: at.x, y: at.y });
      return { text: "Bad: a rock appeared!", popup: "ROCK!" };
    }
    if (effect === "fog") {
      this.fogUntil = this.time + SETTINGS.fogTime;
      return { text: "Bad: fog!", popup: "FOG!" };
    }
    this.runawayUntil = this.time + SETTINGS.effectTime;
    this.nextRunawayAt = this.time + SETTINGS.runawayStep;
    return { text: "Bad: the apples are running away!", popup: "RUNAWAY!" };
  }

  runAway() {
    // Each apple hops to the neighbouring cell that's farthest from the head
    const head = this.segments[0];
    if (!head) return;
    const distance = (cell) => (cell.x - head.x) ** 2 + (cell.y - head.y) ** 2;
    const apples = this.foods.filter(Boolean);
    if (this.jackpot) apples.push(this.jackpot);

    for (const apple of apples) {
      let best = [];
      let bestDistance = distance(apple);
      for (const [dx, dy] of Object.values(STEP)) {
        const cell = { x: apple.x + dx, y: apple.y + dy };
        if (cell.x < 0 || cell.x >= this.cols || cell.y < 0 || cell.y >= this.rows) continue;
        if (this.isTaken(cell.x, cell.y)) continue;
        const d = distance(cell);
        if (d > bestDistance) {
          best = [cell];
          bestDistance = d;
        } else if (d === bestDistance && best.length) {
          best.push(cell);
        }
      }
      if (best.length) {
        const move = this.pick(best);
        apple.x = move.x;
        apple.y = move.y;
      }
    }
  }

  // ---- The rainbow apple ----

  jackpotGap() {
    return this.time + SETTINGS.jackpotGapMin + this.random() * (SETTINGS.jackpotGapMax - SETTINGS.jackpotGapMin);
  }

  updateJackpot() {
    if (this.jackpot && this.time >= this.jackpot.until) {
      this.jackpot = null;
      this.nextJackpotAt = this.jackpotGap();
    } else if (!this.jackpot && this.time >= this.nextJackpotAt) {
      const cell = this.randomFreeCell();
      if (cell) {
        this.jackpot = { x: cell.x, y: cell.y, until: this.time + SETTINGS.jackpotTime };
        this.events.push({ type: "jackpot", x: cell.x, y: cell.y });
      } else {
        this.nextJackpotAt = this.jackpotGap();
      }
    }
  }

  eatJackpot() {
    const at = { x: this.jackpot.x, y: this.jackpot.y };
    this.jackpot = null;
    this.nextJackpotAt = this.jackpotGap();
    this.eaten.jackpot += 1;
    const points = this.addPoints(SETTINGS.jackpotPoints);
    this.events.push({ type: "ate", food: JACKPOT, x: at.x, y: at.y, text: `Jackpot! +${points} points`,
      popup: `+${points}`, points, combo: this.combo });
  }

  // ---- Helpers ----

  grow(count) {
    for (let i = 0; i < count; i++) {
      const tail = this.segments[this.segments.length - 1];
      this.segments.push({ x: tail.x, y: tail.y });
    }
    this.longest = Math.max(this.longest, this.segments.length);
  }

  shrink(count) {
    for (let i = 0; i < count; i++) {
      if (this.segments.length === 1) {
        // Losing the head means there's nothing left
        this.segments = [];
        this.end("Your snake starved to death!");
        return;
      }
      this.segments.pop();
    }
  }

  changeSpeed(percent) {
    this.speed *= 1 + percent / 100;
    this.speed = Math.max(SETTINGS.minSpeed, Math.min(this.speed, SETTINGS.maxSpeed));
  }

  delay() {
    return SETTINGS.startDelay / this.speed;
  }

  timeLeft(until) {
    return Math.max(0, until - this.time);
  }

  reversedLeft() { return this.timeLeft(this.reversedUntil); }
  drunkLeft() { return this.timeLeft(this.drunkUntil); }
  ghostLeft() { return this.timeLeft(this.ghostUntil); }
  fogLeft() { return this.timeLeft(this.fogUntil); }
  runawayLeft() { return this.timeLeft(this.runawayUntil); }
  comboLeft() { return this.combo >= 2 ? this.timeLeft(this.comboUntil) : 0; }

  end(reason) {
    this.over = reason;
    this.events.push({ type: "over", reason });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { SnakeGame, SETTINGS, NORMAL, BENEFIT, BAD, JACKPOT };
}
