// The rules of Rage Quit Snake, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls.
"use strict";

const SETTINGS = {
  startDelay: 0.2,   // seconds between moves at normal speed
  minSpeed: 0.5,     // slowest the snake can go (0.4s between moves)
  maxSpeed: 4,       // fastest the snake can go (0.05s between moves)
  shrinkTime: 30,    // the snake loses a segment every shrinkTime / length seconds
  effectTime: 10,    // how long reversed or drunk controls last, in seconds
  drunkDelay: 0.5,   // how far behind the controls are when drunk, in seconds
  foodCount: 3,      // apples on the board at any time
  badShrink: 3,      // segments the bad "shrink" apple takes away...
  shrinkFloor: 2,    // ...but it never leaves the snake shorter than this
};

const NORMAL = "normal";
const BENEFIT = "benefit";
const BAD = "bad";
const FOOD_TYPES = [NORMAL, BENEFIT, BAD];

const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
// Grid y grows downward, like the screen
const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const MAX_QUEUED_TURNS = 4;

class SnakeGame {
  constructor(cols, rows, random = Math.random) {
    this.cols = cols;
    this.rows = rows;
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
    this.reversedUntil = 0;
    this.drunkUntil = 0;
    this.hunger = 0;         // builds from 0 to 1; at 1 the snake loses a segment
    this.nextMoveAt = 0;
    this.score = 0;

    this.foods = [];
    for (let i = 0; i < SETTINGS.foodCount; i++) {
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
    this.getHungry(dt);
  }

  step() {
    this.applyTurns();
    const [dx, dy] = STEP[this.heading];
    const head = this.segments[0];
    const next = { x: head.x + dx, y: head.y + dy };

    // Stop at the wall instead of poking out of the board
    if (next.x < 0 || next.x >= this.cols || next.y < 0 || next.y >= this.rows) {
      this.end("You crashed!");
      return;
    }

    this.segments.unshift(next);
    this.segments.pop();
    this.lastHeading = this.heading;

    if (this.segments.slice(1).some((s) => s.x === next.x && s.y === next.y)) {
      this.end("You crashed!");
      return;
    }

    const index = this.foods.findIndex((f) => f && f.x === next.x && f.y === next.y);
    if (index !== -1) this.eat(index);
  }

  getHungry(dt) {
    // The longer the snake, the faster it gets hungry
    this.hunger += (dt * this.segments.length) / SETTINGS.shrinkTime;
    if (this.hunger < 1) return;

    this.hunger = 0;
    const tail = this.segments[this.segments.length - 1];
    this.events.push({ type: "lost", x: tail.x, y: tail.y });
    this.shrink(1);
  }

  // ---- Food ----

  newFood() {
    // Pick a random empty cell, so food never lands on the snake or other food
    const taken = new Set(this.segments.map((s) => s.x + "," + s.y));
    for (const food of this.foods) {
      if (food) taken.add(food.x + "," + food.y);
    }
    const free = [];
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (!taken.has(x + "," + y)) free.push({ x, y });
      }
    }
    if (free.length === 0) return null;

    const cell = free[Math.floor(this.random() * free.length)];
    const type = FOOD_TYPES[Math.floor(this.random() * FOOD_TYPES.length)];
    return { x: cell.x, y: cell.y, type };
  }

  eat(index) {
    const food = this.foods[index];
    const { text, popup } = this.applyFood(food.type);
    this.score += 1;
    this.events.push({ type: "ate", food: food.type, x: food.x, y: food.y, text, popup });
    // Respawn it somewhere new, as a new random type
    this.foods[index] = null;
    this.foods[index] = this.newFood();
  }

  applyFood(type) {
    if (type === NORMAL) {
      this.grow(1);
      this.changeSpeed(5);
      return { text: "Normal: +1 segment, speed +5%", popup: "+1" };
    }

    if (type === BENEFIT) {
      if (this.random() < 0.5) {
        this.changeSpeed(-10);
        return { text: "Benefit: speed -10%", popup: "SLOWER" };
      }
      this.grow(2);
      return { text: "Benefit: +2 segments", popup: "+2" };
    }

    // Otherwise it's bad food
    const effects = ["faster", "shrink", "reverse", "drunk"];
    const effect = effects[Math.floor(this.random() * effects.length)];
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
    this.drunkUntil = this.time + SETTINGS.effectTime;
    return { text: "Bad: drunk!", popup: "DRUNK!" };
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

  reversedLeft() {
    return Math.max(0, this.reversedUntil - this.time);
  }

  drunkLeft() {
    return Math.max(0, this.drunkUntil - this.time);
  }

  end(reason) {
    this.over = reason;
    this.events.push({ type: "over", reason });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { SnakeGame, SETTINGS, NORMAL, BENEFIT, BAD };
}
