// The rules of Chaos Crossing, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls. The board is a grid of 11 x 13 tiles; positions are in tiles.
"use strict";

const SETTINGS = {
  cols: 11,
  rows: 13,
  homeRow: 0,            // the hedge with the homes in it
  medianRow: 6,          // the grassy strip between the river and the road
  startRow: 12,          // where Pip starts every crossing
  homeCols: [1, 3, 5, 7, 9],
  lives: 3,
  maxLives: 5,
  crossingTime: 30,      // seconds to get home, on level 1
  minCrossingTime: 22,
  hopCooldown: 0.13,     // seconds between hops
  respawnDelay: 0.8,     // how long the splat stays on screen before Pip tries again
  levelSpeedUp: 0.12,    // each level makes everything this much faster...
  maxSpeedUp: 2.2,       // ...up to this many times the starting speed
  heroHalfWidth: 0.3,    // how wide Pip is, for getting hit by cars (in tiles, either side of centre)
  wrapMargin: 5,         // lanes wrap around this many tiles off each edge of the board
  // Points
  rowPoints: 10,         // for every new row Pip reaches on a crossing
  homePoints: 50,
  timePoints: 5,         // per second left when Pip gets home
  levelPoints: 200,      // times the level number
  // Chaos mode
  effectTime: 10,        // reversed and drunk
  shortEffectTime: 8,    // slow traffic, super hop, rush hour, swerving cars, sinking logs
  fogTime: 6,
  windTime: 5,
  freezeTime: 4,
  drunkDelay: 0.4,       // how late a drunk hop happens, in seconds
  slowScale: 0.5,
  rushScale: 1.8,
  windSpeed: 1.3,        // tiles per second
  fogRadius: 2.2,        // tiles you can see around Pip in the fog
  pickupLife: 9,         // seconds a mystery box stays before it vanishes
  pickupGapMin: 5,
  pickupGapMax: 9,
  maxPickups: 2,
  eventGapMin: 18,       // seconds between random events
  eventGapMax: 32,
  roadWorkTime: 10,
  demonWarning: 1.3,     // seconds of warning before a speed demon comes through
  demonSpeed: 9,
  shieldGrace: 1.2,      // seconds Pip can't be hurt after the shield saves them
};

// What each lane holds. Rows 1-5 are the river, 7-11 the road.
const LANES = {
  1: { kind: "log", len: 3, dir: 1, speed: 1.1, count: 3 },
  2: { kind: "ducks", len: 2, dir: -1, speed: 1.5, count: 4 },
  3: { kind: "log", len: 4, dir: 1, speed: 0.8, count: 3 },
  4: { kind: "ducks", len: 3, dir: -1, speed: 1.2, count: 3 },
  5: { kind: "log", len: 2, dir: 1, speed: 1.7, count: 4 },
  7: { kind: "truck", len: 2, dir: -1, speed: 1.0, count: 2 },
  8: { kind: "car", len: 1, dir: 1, speed: 2.2, count: 2 },
  9: { kind: "car", len: 1, dir: -1, speed: 1.5, count: 3 },
  10: { kind: "van", len: 2, dir: 1, speed: 1.1, count: 2 },
  11: { kind: "car", len: 1, dir: -1, speed: 1.2, count: 3 },
};
const RIVER_ROWS = [1, 2, 3, 4, 5];
const ROAD_ROWS = [7, 8, 9, 10, 11];

// Every mystery box looks the same until Pip grabs it. "weight" is how likely each one is.
const PICKUPS = {
  shield: { kind: "good", weight: 1, text: "Good: shield. One free splat. Don't waste it.", popup: "SHIELD!" },
  slow: { kind: "good", weight: 1, text: "Good: slow traffic. Everyone's suddenly polite.", popup: "SLOW-MO" },
  freeze: { kind: "good", weight: 1, text: "Good: time freeze. Go, go, go!", popup: "FREEZE!" },
  superhop: { kind: "good", weight: 1, text: "Good: super hop. Two rows at a time, show-off.", popup: "SUPER HOP" },
  life: { kind: "good", weight: 0.5, text: "Good: extra life. Pip believes in you. Barely.", popup: "+1 LIFE" },
  reversed: { kind: "bad", weight: 1, text: "Bad: reversed controls. Up is down now. Enjoy.", popup: "REVERSED!" },
  drunk: { kind: "bad", weight: 1, text: "Bad: drunk hops. Pip had one too many juice boxes.", popup: "DRUNK!" },
  fog: { kind: "bad", weight: 1, text: "Bad: fog. Hope you remember where the cars are.", popup: "FOG!" },
  rush: { kind: "bad", weight: 1, text: "Bad: rush hour. Everyone's late and angry.", popup: "RUSH HOUR!" },
  swerve: { kind: "bad", weight: 1, text: "Bad: swerving cars. Lanes are just suggestions now.", popup: "SWERVE!" },
  sink: { kind: "bad", weight: 1, text: "Bad: sinking logs. Trust nothing that floats.", popup: "SINKING!" },
  wind: { kind: "bad", weight: 1, text: "Bad: wind gust. Pip weighs nothing.", popup: "WHOOSH!" },
};

// Why the game ended, by what got Pip last
const ENDINGS = {
  car: "Flattened by traffic. Pip had plans.",
  demon: "A speed demon got you. You were warned.",
  water: "Pip can't swim. You knew that.",
  swept: "Swept off the edge. Pip's on holiday now.",
  hedge: "You hopped into a hedge. Bold.",
  time: "Out of time. Pip got bored and lay down.",
};

const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };
const MAX_QUEUED_HOPS = 3;

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

class CrossingGame {
  // Classic mode is the plain game: no mystery boxes and no random events
  constructor({ classic = false, random = Math.random } = {}) {
    this.classic = classic;
    this.random = random;
    this.time = 0;          // game clock in seconds; it only runs while the game is being played
    this.events = [];       // things that happened, for the screen to react to (popups etc.)
    this.over = null;       // why the game ended, once it has

    this.score = 0;
    this.level = 1;
    this.lives = SETTINGS.lives;
    this.splats = 0;
    this.homesFilled = 0;
    this.grabbed = { good: 0, bad: 0 };
    this.pendingHops = [];  // hops waiting to happen (drunk hops happen late): { at, dir }
    this.nextHopAt = 0;

    // Effects from mystery boxes. Each "Until" is the game time the effect wears off.
    this.reversedUntil = 0;
    this.drunkUntil = 0;
    this.fogUntil = 0;
    this.rushUntil = 0;
    this.swerveUntil = 0;
    this.sinkUntil = 0;
    this.windUntil = 0;
    this.windDir = 1;
    this.slowUntil = 0;
    this.freezeUntil = 0;
    this.superhopUntil = 0;
    this.shield = false;
    this.safeUntil = 0;     // can't be hurt until then (just after the shield saves Pip)
    this.nextSwerveAt = 0;

    this.pickups = [];      // mystery boxes on the board: { col, row, until }
    this.nextPickupAt = this.gap(SETTINGS.pickupGapMin, SETTINGS.pickupGapMax);
    this.cones = [];        // road work: tiles Pip can't hop onto: { col, row }
    this.roadWork = null;   // { row, until }
    this.demon = null;      // a speed demon: { row, dir, at, x }
    this.nextEventAt = this.gap(SETTINGS.eventGapMin, SETTINGS.eventGapMax);

    this.buildLevel();
  }

  gap(min, max) {
    return this.time + min + this.random() * (max - min);
  }

  // ---- Levels ----

  buildLevel() {
    this.homes = SETTINGS.homeCols.map(() => false);
    const speedUp = Math.min(1 + SETTINGS.levelSpeedUp * (this.level - 1), SETTINGS.maxSpeedUp);
    const period = SETTINGS.cols + 2 * SETTINGS.wrapMargin;
    this.lanes = [];
    for (const [row, setup] of Object.entries(LANES)) {
      const road = ROAD_ROWS.includes(Number(row));
      // More traffic and fewer logs as the levels go up
      let count = road ? setup.count + Math.floor((this.level - 1) / 2) : setup.count - Math.floor((this.level - 1) / 3);
      count = road ? Math.min(count, Math.floor(period / (setup.len + 2))) : Math.max(count, 2);
      const lane = { row: Number(row), kind: setup.kind, dir: setup.dir, speed: setup.speed * speedUp, road, objects: [] };
      const spacing = period / count;
      for (let i = 0; i < count; i++) {
        lane.objects.push({
          x: -SETTINGS.wrapMargin + i * spacing + this.random() * Math.max(0, spacing - setup.len - 1.5),
          len: setup.len,
          kind: setup.kind,
          color: Math.floor(this.random() * 5),
          phase: this.random() * 3,  // when it dips under, if logs are sinking
        });
      }
      this.lanes.push(lane);
    }
    this.cones = [];
    this.roadWork = null;
    this.demon = null;
    this.resetHero();
  }

  lane(row) {
    return this.lanes.find((l) => l.row === row);
  }

  resetHero() {
    this.hero = { cx: Math.floor(SETTINGS.cols / 2) + 0.5, row: SETTINGS.startRow, dead: false, facing: "up" };
    this.furthestRow = SETTINGS.startRow;
    this.lastSafeRow = SETTINGS.startRow;
    this.timeLeft = Math.max(SETTINGS.minCrossingTime, SETTINGS.crossingTime - (this.level - 1));
    this.pendingHops = [];
  }

  // ---- Controls ----

  press(dir) {
    if (this.over || this.hero.dead || this.pendingHops.length >= MAX_QUEUED_HOPS) return;
    if (this.reversedLeft() > 0) dir = OPPOSITE[dir];
    const at = this.time + (this.drunkLeft() > 0 ? SETTINGS.drunkDelay : 0);
    this.pendingHops.push({ at, dir });
  }

  hop(dir) {
    const hero = this.hero;
    const [dx, dy] = STEPS[dir];
    const rows = dy !== 0 && this.superhopLeft() > 0 ? 2 : 1;
    const row = clamp(hero.row + dy * rows, SETTINGS.homeRow, SETTINGS.startRow);
    const cx = clamp(hero.cx + dx, 0.5, SETTINGS.cols - 0.5);
    hero.facing = dir;
    if (row === hero.row && cx === hero.cx) return;  // already at the edge

    if (this.cones.some((c) => c.row === row && Math.abs(c.col + 0.5 - cx) < 0.6)) {
      this.events.push({ type: "bump", cx: hero.cx, row: hero.row });
      return;
    }
    const from = { cx: hero.cx, row: hero.row };
    hero.cx = cx;
    hero.row = row;
    this.events.push({ type: "hop", from, to: { cx, row } });

    if (row === SETTINGS.medianRow || row === SETTINGS.startRow) this.lastSafeRow = row;
    if (row < this.furthestRow) {
      this.score += SETTINGS.rowPoints * (this.furthestRow - row);
      this.furthestRow = row;
    }
    if (row === SETTINGS.homeRow) this.reachTop();
  }

  reachTop() {
    const hero = this.hero;
    const slot = SETTINGS.homeCols.findIndex((col) => Math.abs(col + 0.5 - hero.cx) <= 0.5);
    if (slot === -1 || this.homes[slot]) {
      this.splat("hedge");
      return;
    }
    this.homes[slot] = true;
    this.homesFilled += 1;
    const points = SETTINGS.homePoints + SETTINGS.timePoints * Math.floor(this.timeLeft);
    this.score += points;
    this.events.push({ type: "home", slot, col: SETTINGS.homeCols[slot], points });
    if (this.homes.every(Boolean)) {
      const bonus = SETTINGS.levelPoints * this.level;
      this.score += bonus;
      this.level += 1;
      this.events.push({ type: "level", level: this.level, bonus });
      this.buildLevel();
    } else {
      this.resetHero();
    }
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over) return;
    this.time += dt;
    const hero = this.hero;

    if (hero.dead) {
      if (this.time >= hero.respawnAt) this.resetHero();
    } else {
      while (this.pendingHops.length && this.pendingHops[0].at <= this.time && this.time >= this.nextHopAt) {
        this.hop(this.pendingHops.shift().dir);
        this.nextHopAt = this.time + SETTINGS.hopCooldown;
        if (this.over || this.hero.dead || this.hero !== hero) break;
      }
    }

    const frozen = this.freezeLeft() > 0;
    if (!frozen) this.moveLanes(dt);
    this.updateDemon(dt, frozen);
    if (!this.classic) {
      this.updatePickups();
      this.updateEvents();
      if (this.swerveLeft() > 0 && this.time >= this.nextSwerveAt) {
        this.nextSwerveAt = this.time + 0.7;
        this.swerveACar();
      }
    }
    if (this.over) return;
    if (!this.hero.dead) this.checkHero(dt, frozen);
  }

  laneSpeed(lane) {
    let speed = lane.speed;
    if (this.slowLeft() > 0) speed *= SETTINGS.slowScale;
    if (lane.road && this.rushLeft() > 0) speed *= SETTINGS.rushScale;
    return speed;
  }

  moveLanes(dt) {
    const period = SETTINGS.cols + 2 * SETTINGS.wrapMargin;
    for (const lane of this.lanes) {
      const step = lane.dir * this.laneSpeed(lane) * dt;
      for (const object of lane.objects) {
        object.x += step;
        // Wrap round, well off the edge of the board so nothing pops into view
        object.x = ((object.x + SETTINGS.wrapMargin) % period + period) % period - SETTINGS.wrapMargin;
      }
    }
  }

  sunk(object) {
    // While logs are sinking, everything floating dips under for a bit every 3 seconds
    if (this.sinkLeft() <= 0) return false;
    return (this.time + object.phase) % 3 > 2.1;
  }

  sinkingSoon(object) {
    if (this.sinkLeft() <= 0) return false;
    const t = (this.time + object.phase) % 3;
    return t > 1.5 && t <= 2.1;
  }

  checkHero(dt, frozen) {
    const hero = this.hero;
    if (!frozen) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.splat("time");
        return;
      }
    }
    if (this.windLeft() > 0 && !frozen) {
      hero.cx += this.windDir * SETTINGS.windSpeed * dt;
      if (!RIVER_ROWS.includes(hero.row)) hero.cx = clamp(hero.cx, 0.5, SETTINGS.cols - 0.5);
    }

    const lane = this.lane(hero.row);
    if (lane && !lane.road) {
      // On the river Pip has to be standing on something that floats
      const ride = lane.objects.find((o) => !this.sunk(o) && hero.cx >= o.x + 0.1 && hero.cx <= o.x + o.len - 0.1);
      if (ride) {
        if (!frozen) hero.cx += lane.dir * this.laneSpeed(lane) * dt;
        if (hero.cx < 0.15 || hero.cx > SETTINGS.cols - 0.15) this.splat("swept");
      } else {
        this.splat("water");
      }
      if (hero.dead || this.over) return;
    } else if (lane && lane.road) {
      const half = SETTINGS.heroHalfWidth;
      const hit = lane.objects.some((o) => hero.cx + half > o.x + 0.08 && hero.cx - half < o.x + o.len - 0.08);
      if (hit) {
        this.splat("car");
        return;
      }
    }
    if (this.demon && this.demon.x !== null && this.demon.row === hero.row &&
        Math.abs(this.demon.x + 0.75 - hero.cx) < 0.75 + SETTINGS.heroHalfWidth) {
      this.splat("demon");
      return;
    }

    // Grab a mystery box
    const index = this.pickups.findIndex((p) => p.row === hero.row && Math.abs(p.col + 0.5 - hero.cx) < 0.6);
    if (index !== -1) {
      const [pickup] = this.pickups.splice(index, 1);
      this.grab(pickup);
    }
  }

  splat(cause) {
    const hero = this.hero;
    if (this.time < this.safeUntil && cause !== "hedge") return;
    if (this.shield && cause !== "time") {
      // The shield takes the hit and puts Pip back on the last safe strip
      this.shield = false;
      this.safeUntil = this.time + SETTINGS.shieldGrace;
      this.events.push({ type: "saved", cx: hero.cx, row: hero.row });
      hero.row = this.lastSafeRow;
      hero.cx = clamp(Math.floor(hero.cx) + 0.5, 0.5, SETTINGS.cols - 0.5);
      return;
    }
    this.lives -= 1;
    this.splats += 1;
    hero.dead = true;
    hero.cause = cause;
    hero.respawnAt = this.time + SETTINGS.respawnDelay;
    this.pendingHops = [];
    this.events.push({ type: "splat", cause, cx: hero.cx, row: hero.row, lives: this.lives });
    if (this.lives <= 0) this.end(ENDINGS[cause]);
  }

  // ---- Mystery boxes ----

  updatePickups() {
    this.pickups = this.pickups.filter((p) => p.until > this.time);
    if (this.time < this.nextPickupAt) return;
    this.nextPickupAt = this.gap(SETTINGS.pickupGapMin, SETTINGS.pickupGapMax);
    if (this.pickups.length >= SETTINGS.maxPickups) return;
    // Boxes land on the road or the grassy strip, never on top of Pip or another box
    const rows = [...ROAD_ROWS, SETTINGS.medianRow];
    for (let tries = 0; tries < 20; tries++) {
      const row = rows[Math.floor(this.random() * rows.length)];
      const col = Math.floor(this.random() * SETTINGS.cols);
      const taken = this.pickups.some((p) => p.row === row && p.col === col) ||
        this.cones.some((c) => c.row === row && c.col === col) ||
        (this.hero.row === row && Math.abs(this.hero.cx - (col + 0.5)) < 1);
      if (!taken) {
        this.pickups.push({ col, row, until: this.time + SETTINGS.pickupLife });
        return;
      }
    }
  }

  pickPickup(kind) {
    const options = Object.entries(PICKUPS).filter(([, p]) => p.kind === kind);
    let roll = this.random() * options.reduce((total, [, p]) => total + p.weight, 0);
    for (const [name, pickup] of options) {
      roll -= pickup.weight;
      if (roll < 0) return name;
    }
    return options[options.length - 1][0];
  }

  grab(pickup) {
    const kind = this.random() < 0.5 ? "good" : "bad";
    const name = this.pickPickup(kind);
    this.grabbed[kind] += 1;
    const message = this.applyPickup(name) || PICKUPS[name];
    this.events.push({ type: "pickup", name, kind, cx: this.hero.cx, row: this.hero.row,
      text: message.text, popup: message.popup });
  }

  applyPickup(name) {
    const long = this.time + SETTINGS.effectTime;
    const short = this.time + SETTINGS.shortEffectTime;
    if (name === "shield") this.shield = true;
    if (name === "slow") this.slowUntil = short;
    if (name === "freeze") this.freezeUntil = this.time + SETTINGS.freezeTime;
    if (name === "superhop") this.superhopUntil = short;
    if (name === "reversed") this.reversedUntil = long;
    if (name === "drunk") this.drunkUntil = long;
    if (name === "fog") this.fogUntil = this.time + SETTINGS.fogTime;
    if (name === "rush") this.rushUntil = short;
    if (name === "swerve") {
      this.swerveUntil = short;
      this.nextSwerveAt = this.time;
    }
    if (name === "sink") this.sinkUntil = short;
    if (name === "wind") {
      this.windUntil = this.time + SETTINGS.windTime;
      this.windDir = this.random() < 0.5 ? -1 : 1;
    }
    if (name === "life") {
      if (this.lives >= SETTINGS.maxLives) return { text: "Good: extra life, but you're full. Greedy.", popup: "MAXED" };
      this.lives += 1;
    }
    return null;
  }

  swerveACar() {
    // A random car jumps into the next lane over, if there's room
    const lanes = this.lanes.filter((l) => l.road);
    const from = lanes[Math.floor(this.random() * lanes.length)];
    if (!from.objects.length) return;
    const car = from.objects[Math.floor(this.random() * from.objects.length)];
    if (car.x + car.len < 0 || car.x > SETTINGS.cols) return;  // only ones you can see
    const row = from.row + (this.random() < 0.5 ? -1 : 1);
    const to = this.lane(row);
    if (!to || !to.road || (this.roadWork && this.roadWork.row === row)) return;
    const blocked = to.objects.some((o) => car.x < o.x + o.len + 0.5 && car.x + car.len + 0.5 > o.x);
    if (blocked) return;
    from.objects.splice(from.objects.indexOf(car), 1);
    to.objects.push(car);
    this.events.push({ type: "swerve", x: car.x + car.len / 2, row });
  }

  // ---- Random events ----

  updateEvents() {
    if (this.roadWork && this.time >= this.roadWork.until) {
      // The road crew packs up and the traffic comes back
      this.lane(this.roadWork.row).objects = this.roadWork.cars;
      this.roadWork = null;
      this.cones = [];
      this.events.push({ type: "roadWorkDone" });
    }
    if (this.time < this.nextEventAt) return;
    this.nextEventAt = this.gap(SETTINGS.eventGapMin, SETTINGS.eventGapMax);
    if (this.random() < 0.5 && !this.roadWork) this.startRoadWork();
    else if (!this.demon) this.startDemon();
  }

  startRoadWork() {
    // Close a lane: no cars, but cones block most of it, leaving two gaps
    const rows = ROAD_ROWS.filter((r) => r !== this.hero.row);
    const row = rows[Math.floor(this.random() * rows.length)];
    const lane = this.lane(row);
    this.roadWork = { row, until: this.time + SETTINGS.roadWorkTime, cars: lane.objects };
    lane.objects = [];
    const gaps = new Set();
    while (gaps.size < 2) gaps.add(1 + Math.floor(this.random() * (SETTINGS.cols - 2)));
    this.cones = [];
    for (let col = 0; col < SETTINGS.cols; col++) {
      if (!gaps.has(col)) this.cones.push({ col, row });
    }
    this.pickups = this.pickups.filter((p) => p.row !== row);
    this.events.push({ type: "roadWork", row });
  }

  startDemon() {
    const rows = ROAD_ROWS.filter((r) => !(this.roadWork && this.roadWork.row === r));
    const row = rows[Math.floor(this.random() * rows.length)];
    const dir = this.lane(row).dir;
    this.demon = { row, dir, at: this.time + SETTINGS.demonWarning, x: null };
    this.events.push({ type: "demonWarning", row, dir });
  }

  updateDemon(dt, frozen) {
    const demon = this.demon;
    if (!demon) return;
    if (demon.x === null) {
      if (this.time >= demon.at) {
        demon.x = demon.dir > 0 ? -2 : SETTINGS.cols + 0.5;
        this.events.push({ type: "demon", row: demon.row });
      }
      return;
    }
    if (!frozen) demon.x += demon.dir * SETTINGS.demonSpeed * dt;
    if (demon.x < -3 || demon.x > SETTINGS.cols + 2) this.demon = null;
  }

  // ---- Helpers ----

  timeLeftOf(until) {
    return Math.max(0, until - this.time);
  }

  reversedLeft() { return this.timeLeftOf(this.reversedUntil); }
  drunkLeft() { return this.timeLeftOf(this.drunkUntil); }
  fogLeft() { return this.timeLeftOf(this.fogUntil); }
  rushLeft() { return this.timeLeftOf(this.rushUntil); }
  swerveLeft() { return this.timeLeftOf(this.swerveUntil); }
  sinkLeft() { return this.timeLeftOf(this.sinkUntil); }
  windLeft() { return this.timeLeftOf(this.windUntil); }
  slowLeft() { return this.timeLeftOf(this.slowUntil); }
  freezeLeft() { return this.timeLeftOf(this.freezeUntil); }
  superhopLeft() { return this.timeLeftOf(this.superhopUntil); }
  roadWorkLeft() { return this.roadWork ? this.timeLeftOf(this.roadWork.until) : 0; }

  crossingTime() {
    return Math.max(SETTINGS.minCrossingTime, SETTINGS.crossingTime - (this.level - 1));
  }

  end(reason) {
    this.over = reason;
    this.events.push({ type: "over", reason });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { CrossingGame, SETTINGS, LANES, PICKUPS, ENDINGS, RIVER_ROWS, ROAD_ROWS };
}
