// The rules of Chaos Sweeper, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls.
"use strict";

// Board sizes. "par" is the time limit in Chaos mode, and the time to beat for bonus points in Classic.
const SIZES = {
  easy: { label: "Easy", cols: 8, rows: 10, mines: 12, capsules: 3, par: 150, multiplier: 1 },
  normal: { label: "Normal", cols: 10, rows: 13, mines: 24, capsules: 5, par: 300, multiplier: 2 },
  hard: { label: "Hard", cols: 12, rows: 16, mines: 40, capsules: 7, par: 480, multiplier: 3 },
};

const SETTINGS = {
  freezeTime: 10,     // seconds the clock stops for
  xrayTime: 2,        // seconds you can see nearby bombs for
  xrayRadius: 3,      // how many squares around the capsule the x-ray reaches
  fogTime: 6,
  liarTime: 6,
  liarShare: 0.4,     // how many of the numbers lie
  turboTime: 10,
  turboScale: 2,      // how much faster the clock runs
  shuffleCount: 3,    // most bombs that move in a shuffle
  panicTime: 20,      // seconds left when the board starts to panic
  cellPoints: 1,      // per square dug, times the size multiplier
  winBonus: 500,      // times the size multiplier
  secondPoints: 10,   // per second left on the clock (or under par in Classic)
};

// Every capsule looks the same until you dig it up
const CAPSULES = {
  autoflag: { kind: "good", text: "Good: I flagged a bomb for you. You're welcome.", popup: "FREE FLAG" },
  patch: { kind: "good", text: "Good: free dig. A whole patch, on the house.", popup: "FREE DIG" },
  freeze: { kind: "good", text: "Good: time freeze. Breathe. Think. Panic later.", popup: "FROZEN" },
  xray: { kind: "good", text: "Good: x-ray. Look fast, it's two seconds.", popup: "X-RAY!" },
  shuffle: { kind: "bad", text: "Bad: the bombs got bored and moved. Recheck everything.", popup: "SHUFFLE!" },
  fog: { kind: "bad", text: "Bad: fog. Hope you remember the numbers.", popup: "FOG!" },
  liar: { kind: "bad", text: "Bad: the numbers are lying. Trust no one.", popup: "LIES!" },
  turbo: { kind: "bad", text: "Bad: the clock is in a hurry. Now so are you.", popup: "TURBO CLOCK" },
  plant: { kind: "bad", text: "Bad: I planted another bomb. Somewhere. Good luck.", popup: "+1 BOMB" },
};

const NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

class SweeperGame {
  // Classic mode is the plain puzzle: no capsules, and the clock counts up instead of down
  constructor({ classic = false, size = "normal", random = Math.random } = {}) {
    this.classic = classic;
    this.sizeName = SIZES[size] ? size : "normal";
    this.size = SIZES[this.sizeName];
    this.random = random;
    this.cols = this.size.cols;
    this.rows = this.size.rows;
    this.mineCount = this.size.mines;

    this.time = 0;          // game clock; it only runs once you've dug and while you're playing
    this.elapsed = 0;       // seconds since your first dig
    this.clock = this.size.par;  // Chaos mode's countdown
    this.started = false;   // the bombs are only placed on your first dig, so it's always safe
    this.over = null;       // why the game ended, once it has
    this.won = false;
    this.score = 0;
    this.events = [];       // things that happened, for the screen to react to
    this.dug = { good: 0, bad: 0 };
    this.panicked = false;
    this.capsuleQueue = [];

    // Effects from capsules. Each "Until" is the game time the effect wears off.
    this.frozenUntil = 0;
    this.xrayUntil = 0;
    this.xrayCenter = null;
    this.fogUntil = 0;
    this.liarUntil = 0;
    this.liarOffsets = new Map();  // which numbers are lying, and by how much
    this.turboUntil = 0;

    this.cells = [];
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.cells.push({ x, y, mine: false, revealed: false, flagged: false, capsule: false,
          capsuleUsed: false, gift: false, exploded: false });
      }
    }
  }

  // ---- Looking at the board ----

  cell(x, y) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return null;
    return this.cells[y * this.cols + x];
  }

  neighbours(cell) {
    const around = [];
    for (const [dx, dy] of NEIGHBOURS) {
      const next = this.cell(cell.x + dx, cell.y + dy);
      if (next) around.push(next);
    }
    return around;
  }

  number(cell) {
    // How many bombs touch this square, diagonals included
    return this.neighbours(cell).filter((n) => n.mine).length;
  }

  shownNumber(cell) {
    // What the square says, which isn't always the truth while the liar capsule is working
    const truth = this.number(cell);
    if (truth === 0 || this.liarLeft() <= 0) return truth;
    const offset = this.liarOffsets.get(cell.y * this.cols + cell.x);
    if (!offset) return truth;
    let lie = truth + offset;
    if (lie < 1 || lie > 8) lie = truth - offset;
    return lie;
  }

  flagsPlaced() {
    return this.cells.filter((c) => c.flagged).length;
  }

  minesLeft() {
    return this.mineCount - this.flagsPlaced();
  }

  safeLeft() {
    return this.cells.filter((c) => !c.mine && !c.revealed).length;
  }

  // ---- Your moves ----

  dig(x, y) {
    if (this.over) return;
    const cell = this.cell(x, y);
    if (!cell || cell.flagged) return;
    if (!this.started) this.start(cell);
    if (cell.revealed) this.chord(cell);
    else this.reveal(cell);
    this.drainCapsules();
    this.checkWin();
  }

  toggleFlag(x, y) {
    if (this.over) return;
    const cell = this.cell(x, y);
    if (!cell || cell.revealed) return;
    if (!this.started) {
      this.events.push({ type: "flagEarly", x, y });
      return;
    }
    cell.flagged = !cell.flagged;
    cell.gift = false;
    this.events.push({ type: "flag", x, y, on: cell.flagged });
  }

  chord(cell) {
    // Digging a number that already has enough flags around it digs all its other neighbours
    const truth = this.number(cell);
    if (truth === 0) return;
    const around = this.neighbours(cell);
    if (around.filter((n) => n.flagged).length !== truth) {
      this.events.push({ type: "chordNope", x: cell.x, y: cell.y });
      return;
    }
    for (const next of around) {
      if (!next.revealed && !next.flagged && !this.over) this.reveal(next);
    }
  }

  start(first) {
    // Place the bombs anywhere except your first square and the ones around it,
    // so the first dig always opens up an area
    const keepClear = new Set([first, ...this.neighbours(first)]);
    const spots = this.shuffled(this.cells.filter((c) => !keepClear.has(c)));
    spots.slice(0, this.mineCount).forEach((c) => (c.mine = true));

    if (!this.classic) {
      // Capsules hide in safe squares that the first dig won't open
      const opening = this.floodArea(first);
      const hiding = this.shuffled(this.cells.filter((c) => !c.mine && !opening.has(c)));
      hiding.slice(0, this.size.capsules).forEach((c) => (c.capsule = true));
    }
    this.started = true;
  }

  floodArea(start) {
    // The squares a dig here would open, without actually opening them
    const area = new Set();
    const stack = [start];
    while (stack.length) {
      const cell = stack.pop();
      if (area.has(cell) || cell.mine) continue;
      area.add(cell);
      if (this.number(cell) === 0) stack.push(...this.neighbours(cell));
    }
    return area;
  }

  reveal(start) {
    if (start.mine) {
      this.boom(start);
      return;
    }
    // Open the square, and if it's a 0, everything around it too
    const opened = [];
    const stack = [start];
    while (stack.length) {
      const cell = stack.pop();
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      opened.push(cell);
      if (cell.capsule && !cell.capsuleUsed) this.capsuleQueue.push(cell);
      if (this.liarLeft() > 0 && this.number(cell) > 0 && this.random() < SETTINGS.liarShare) {
        this.liarOffsets.set(cell.y * this.cols + cell.x, this.random() < 0.5 ? -1 : 1);
      }
      if (this.number(cell) === 0) {
        for (const next of this.neighbours(cell)) {
          if (!next.revealed && !next.flagged) stack.push(next);
        }
      }
    }
    if (opened.length === 0) return;
    const points = opened.length * SETTINGS.cellPoints * this.size.multiplier;
    this.score += points;
    this.events.push({ type: "reveal", cells: opened.map((c) => ({ x: c.x, y: c.y })), points });
  }

  boom(cell) {
    cell.exploded = true;
    this.events.push({ type: "boom", x: cell.x, y: cell.y });
    this.end(false, "You dug up a grumpy bomb.");
  }

  checkWin() {
    if (this.over || !this.started || this.safeLeft() > 0) return;
    // Every safe square is open: flag the rest for them, and pay out
    for (const cell of this.cells) {
      if (cell.mine) cell.flagged = true;
    }
    const seconds = this.classic ? Math.max(0, this.size.par - this.elapsed) : this.clock;
    const bonus = SETTINGS.winBonus * this.size.multiplier + Math.round(seconds) * SETTINGS.secondPoints;
    this.score += bonus;
    this.events.push({ type: "win", bonus });
    this.end(true, "Every bomb found. Who even are you?");
  }

  end(won, reason) {
    this.over = reason;
    this.won = won;
    this.events.push({ type: "over", won, reason });
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over || !this.started) return;
    this.time += dt;
    this.elapsed += dt;
    if (this.classic) return;

    let rate = 1;
    if (this.frozenLeft() > 0) rate = 0;
    else if (this.turboLeft() > 0) rate = SETTINGS.turboScale;
    this.clock = Math.max(0, this.clock - dt * rate);
    if (!this.panicked && this.clock <= SETTINGS.panicTime) {
      this.panicked = true;
      this.events.push({ type: "panic" });
    }
    if (this.clock <= 0) this.end(false, "Time's up. The bombs win by forfeit.");
  }

  // ---- Capsules ----

  drainCapsules() {
    // Capsules dug up this turn go off one after another (a free dig can dig up more of them)
    while (this.capsuleQueue.length && !this.over) {
      const cell = this.capsuleQueue.shift();
      if (cell.capsuleUsed) continue;
      cell.capsuleUsed = true;
      const kind = this.random() < 0.5 ? "good" : "bad";
      const options = Object.keys(CAPSULES).filter((name) => CAPSULES[name].kind === kind);
      const name = options[Math.floor(this.random() * options.length)];
      this.useCapsule(name, cell);
    }
    this.checkWin();
  }

  useCapsule(name, cell) {
    this.dug[CAPSULES[name].kind] += 1;
    const message = this.applyCapsule(name, cell) || CAPSULES[name];
    this.events.push({ type: "capsule", name, kind: CAPSULES[name].kind, x: cell.x, y: cell.y,
      text: message.text, popup: message.popup });
  }

  applyCapsule(name, cell) {
    if (name === "freeze") this.frozenUntil = this.time + SETTINGS.freezeTime;
    if (name === "fog") this.fogUntil = this.time + SETTINGS.fogTime;
    if (name === "turbo") this.turboUntil = this.time + SETTINGS.turboTime;
    if (name === "xray") {
      this.xrayUntil = this.time + SETTINGS.xrayTime;
      this.xrayCenter = { x: cell.x, y: cell.y };
    }
    if (name === "liar") this.startLying();
    if (name === "autoflag") return this.giftFlag();
    if (name === "patch") return this.freeDig();
    if (name === "shuffle") return this.shuffleBombs();
    if (name === "plant") return this.plantBomb();
    return null;
  }

  startLying() {
    this.liarUntil = this.time + SETTINGS.liarTime;
    this.liarOffsets = new Map();
    const numbered = this.cells.filter((c) => c.revealed && this.number(c) > 0);
    for (const cell of numbered) {
      if (this.random() < SETTINGS.liarShare) {
        this.liarOffsets.set(cell.y * this.cols + cell.x, this.random() < 0.5 ? -1 : 1);
      }
    }
    // At least one of them has to lie, or it's not much of a capsule
    if (this.liarOffsets.size === 0 && numbered.length) {
      const cell = numbered[Math.floor(this.random() * numbered.length)];
      this.liarOffsets.set(cell.y * this.cols + cell.x, 1);
    }
  }

  frontier(test) {
    // Hidden squares next to ones you've opened, which pass the test
    return this.cells.filter((c) => !c.revealed && test(c) && this.neighbours(c).some((n) => n.revealed));
  }

  giftFlag() {
    const unflagged = (c) => c.mine && !c.flagged;
    const choices = this.frontier(unflagged).length ? this.frontier(unflagged) : this.cells.filter(unflagged);
    if (!choices.length) return { text: "Good: a free flag, but every bomb is already flagged. Show-off.", popup: "NOTHING TO FLAG" };
    const bomb = choices[Math.floor(this.random() * choices.length)];
    bomb.flagged = true;
    bomb.gift = true;
    this.events.push({ type: "flag", x: bomb.x, y: bomb.y, on: true, gift: true });
    return null;
  }

  freeDig() {
    const safe = (c) => !c.mine && !c.flagged && !c.capsule;
    const choices = this.frontier(safe).length ? this.frontier(safe) : this.cells.filter((c) => !c.revealed && safe(c));
    if (!choices.length) return { text: "Good: a free dig, but there's nothing safe left to dig. Huh.", popup: "NOTHING TO DIG" };
    const centre = choices[Math.floor(this.random() * choices.length)];
    for (const target of [centre, ...this.neighbours(centre)]) {
      if (!target.revealed && safe(target)) this.reveal(target);
    }
    return null;
  }

  canTakeBomb(cell) {
    // Bombs only move into hidden squares that aren't flagged and don't hide a capsule
    return !cell.revealed && !cell.mine && !cell.flagged && !(cell.capsule && !cell.capsuleUsed);
  }

  shuffleBombs() {
    // Only bombs you haven't flagged move, and never into a flagged square, so correct flags stay correct
    const before = this.revealedNumbers();
    const movers = this.shuffled(this.cells.filter((c) => c.mine && !c.flagged)).slice(0, SETTINGS.shuffleCount);
    const moves = [];
    for (const from of movers) {
      const spots = this.cells.filter((c) => this.canTakeBomb(c) && c !== from);
      if (!spots.length) break;
      const to = spots[Math.floor(this.random() * spots.length)];
      from.mine = false;
      to.mine = true;
      moves.push({ from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } });
    }
    if (!moves.length) return { text: "Bad: the bombs tried to move, but they're boxed in. Lucky you.", popup: "STUCK" };
    this.afterBombsMoved(before);
    return null;
  }

  plantBomb() {
    const before = this.revealedNumbers();
    const spots = this.cells.filter((c) => this.canTakeBomb(c));
    if (!spots.length) return { text: "Bad: I tried to plant a bomb, but there's no room. Fine.", popup: "NO ROOM" };
    const spot = spots[Math.floor(this.random() * spots.length)];
    spot.mine = true;
    this.mineCount += 1;
    this.events.push({ type: "plant", x: spot.x, y: spot.y });
    this.afterBombsMoved(before);
    return null;
  }

  revealedNumbers() {
    const numbers = new Map();
    for (const cell of this.cells) {
      if (cell.revealed) numbers.set(cell, this.number(cell));
    }
    return numbers;
  }

  afterBombsMoved(before) {
    // Flash any open number that changed, and if one dropped to 0, open its neighbours for free
    const changed = [];
    for (const [cell, old] of before) {
      const now = this.number(cell);
      if (now !== old) changed.push({ x: cell.x, y: cell.y });
      if (now === 0) {
        for (const next of this.neighbours(cell)) {
          if (!next.revealed && !next.flagged && !next.mine) this.reveal(next);
        }
      }
    }
    this.events.push({ type: "numbersChanged", cells: changed });
  }

  // ---- Helpers ----

  shuffled(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  timeLeft(until) {
    return Math.max(0, until - this.time);
  }

  frozenLeft() { return this.timeLeft(this.frozenUntil); }
  xrayLeft() { return this.timeLeft(this.xrayUntil); }
  fogLeft() { return this.timeLeft(this.fogUntil); }
  liarLeft() { return this.timeLeft(this.liarUntil); }
  turboLeft() { return this.timeLeft(this.turboUntil); }

  clockShown() {
    // Chaos counts down; Classic counts up
    return this.classic ? this.elapsed : this.clock;
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { SweeperGame, SIZES, SETTINGS, CAPSULES };
}
