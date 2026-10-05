// The rules of Chaos Rocks, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls. Everything here is measured on an 800 x 800 board
// that wraps around: fly off one edge and you come back on the other.
"use strict";

const SETTINGS = {
  width: 800,
  height: 800,
  shipRadius: 13,
  turnSpeed: 4.4,          // radians per second with the arrow keys
  aimTurnSpeed: 7,         // how fast the ship swings round to face the joystick
  thrust: 430,             // speed gained per second at full thrust
  maxSpeed: 460,
  drag: 0.75,              // how quickly the ship slows down by itself
  bulletSpeed: 620,
  bulletLife: 0.85,        // seconds before a bullet fizzles out
  fireDelay: 0.22,
  rapidFireDelay: 0.08,
  maxBullets: 5,           // on screen at once
  rapidMaxBullets: 14,
  spreadAngle: 0.2,        // radians between spread shots
  curveRate: 2.6,          // how hard curvy bullets bend, radians per second
  lives: 3,
  maxLives: 6,
  extraLifeEvery: 10000,
  respawnDelay: 1.5,
  respawnSafeRadius: 130,  // no rock this close to the middle before you respawn
  invulnerableTime: 2.5,
  gameOverDelay: 1.6,      // time to enjoy your own explosion
  hyperspaceCooldown: 1.2,
  hyperspaceFailChance: 0.08,
  firstWaveRocks: 4,
  maxWaveRocks: 11,
  waveDelay: 2.2,
  maxRocks: 44,
  safeSpawnDistance: 220,  // new waves never start this close to you
  ufoGapMin: 16,
  ufoGapMax: 30,
  ufoSpeed: 120,
  ufoRadius: 18,
  ufoPoints: 300,
  ufoBulletSpeed: 360,
  ufoBulletLife: 1.7,
  dropChance: 0.15,        // how often a smashed rock drops a mystery capsule
  capsuleLife: 9,
  capsuleRadius: 13,
  effectTime: 10,          // how long most capsule effects last, in seconds
  fogTime: 6,
  holeTime: 8,
  shieldTime: 15,
  slowScale: 0.4,
  bombRadius: 230,
  holePull: 52000,         // how hard the black hole pulls (it gets stronger up close)
  holeCore: 24,            // touch this and you're spaghetti
  drunkDelay: 0.5,
  rainbowPoints: 1000,
  rainbowTime: 10,
  rainbowGapMin: 25,
  rainbowGapMax: 45,
};

const ROCK_SIZES = {
  big: { r: 46, points: 20, speed: [40, 80], splitsInto: "medium" },
  medium: { r: 26, points: 50, speed: [70, 120], splitsInto: "small" },
  small: { r: 14, points: 100, speed: [110, 170], splitsInto: null },
};

// Every capsule looks the same until you grab it. "weight" is how likely each one is.
const CAPSULES = {
  shield: { kind: "good", weight: 1, text: "Good: shield. One free bonk.", popup: "SHIELD!" },
  rapid: { kind: "good", weight: 1, text: "Good: rapid fire. Spray and pray.", popup: "RAPID FIRE!" },
  spread: { kind: "good", weight: 1, text: "Good: spread shot. Aiming is optional now.", popup: "SPREAD!" },
  slow: { kind: "good", weight: 1, text: "Good: slow rocks. They're as tired as you are.", popup: "SLOW-MO" },
  bomb: { kind: "good", weight: 1, text: "Good: smart bomb. Smarter than you, anyway.", popup: "KABOOM!" },
  life: { kind: "good", weight: 0.5, text: "Good: extra life. Don't make it weird.", popup: "+1 LIFE" },
  reversed: { kind: "bad", weight: 1, text: "Bad: controls reversed. Forward is backward now. Enjoy.", popup: "REVERSED!" },
  drunk: { kind: "bad", weight: 1, text: "Bad: drunk steering. Who let you fly like this?", popup: "DRUNK!" },
  fog: { kind: "bad", weight: 1, text: "Bad: space fog. Don't ask how that works.", popup: "FOG!" },
  gravity: { kind: "bad", weight: 1, text: "Bad: black hole. It's pulling you in, like bad habits.", popup: "BLACK HOLE!" },
  splits: { kind: "bad", weight: 1, text: "Bad: rocks split into more pieces. Math hates you.", popup: "MORE ROCKS!" },
  slippery: { kind: "bad", weight: 1, text: "Bad: space is slippery. Brakes are a myth.", popup: "WHEEE!" },
  curvy: { kind: "bad", weight: 1, text: "Bad: curvy bullets. Your shots have commitment issues.", popup: "CURVY!" },
};

const DEATH_LINES = {
  rock: "The last one hit a rock.",
  ufo: "The UFO got the last laugh.",
  hole: "The last one fell into a black hole.",
  hyper: "The last one gambled on hyperspace and lost.",
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

function wrap(value, size) {
  return ((value % size) + size) % size;
}

// The shortest way from one side to the other on a board that wraps around
function wrapDelta(delta, size) {
  return wrap(delta + size / 2, size) - size / 2;
}

function angleDiff(target, current) {
  return wrapDelta(target - current, Math.PI * 2);
}

class RockGame {
  // Classic mode is the plain space-rock shooter: no capsules, no rainbow rocks
  constructor({ classic = false, random = Math.random } = {}) {
    this.classic = classic;
    this.random = random;
    this.time = 0;          // game clock in seconds; it only runs while the game is being played
    this.events = [];       // things that happened, for the screen to react to (popups etc.)
    this.over = null;       // why the game ended, once it has

    this.score = 0;
    this.wave = 0;
    this.lives = SETTINGS.lives;
    this.nextLifeAt = SETTINGS.extraLifeEvery;
    this.stats = { shots: 0, hits: 0, rocks: 0, ufos: 0, good: 0, bad: 0 };

    this.ship = this.newShip();
    this.ship.invulnerableUntil = 2;
    this.input = { turn: 0, thrust: 0, aim: null, fire: false };
    this.inputHistory = [];  // recent controls, so drunk steering can follow them late
    this.fireReadyAt = 0;
    this.hyperReadyAt = 0;

    this.bullets = [];
    this.ufoBullets = [];
    this.rocks = [];
    this.capsules = [];
    this.ufo = null;
    this.hole = null;        // the black hole, while there is one: { x, y, until }
    this.nextUfoAt = this.gap(SETTINGS.ufoGapMin, SETTINGS.ufoGapMax);
    this.nextWaveAt = null;
    this.endingAt = null;
    this.deathCause = null;

    // Effects from capsules. Each "Until" is the game time the effect wears off.
    this.shieldUntil = 0;
    this.rapidUntil = 0;
    this.spreadUntil = 0;
    this.slowUntil = 0;
    this.reversedUntil = 0;
    this.drunkUntil = 0;
    this.fogUntil = 0;
    this.splitsUntil = 0;
    this.slipperyUntil = 0;
    this.curvyUntil = 0;

    this.rainbowRock = null;
    this.nextRainbowAt = this.gap(SETTINGS.rainbowGapMin, SETTINGS.rainbowGapMax);
    this.startWave(1);
  }

  // ---- Helpers ----

  gap(min, max) {
    return this.time + min + this.random() * (max - min);
  }

  // Distance on the wrapping board
  distance(a, b) {
    return Math.hypot(wrapDelta(b.x - a.x, SETTINGS.width), wrapDelta(b.y - a.y, SETTINGS.height));
  }

  newShip() {
    return { x: SETTINGS.width / 2, y: SETTINGS.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
      alive: true, thrusting: 0, invulnerableUntil: this.time + SETTINGS.invulnerableTime, respawnAt: 0 };
  }

  waveSpeed() {
    return Math.min(1 + 0.05 * (this.wave - 1), 1.6);
  }

  newRock(size, x, y) {
    const info = ROCK_SIZES[size];
    const angle = this.random() * Math.PI * 2;
    const speed = (info.speed[0] + this.random() * (info.speed[1] - info.speed[0])) * this.waveSpeed();
    const shape = [];
    for (let i = 0; i < 11; i++) shape.push(0.72 + this.random() * 0.4);
    return {
      size, r: info.r, x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      shape,                                  // lumpiness, for drawing
      color: Math.floor(this.random() * 6),   // which colour it's drawn in
      spin: (this.random() - 0.5) * 2.4,
      angle: this.random() * Math.PI * 2,
      rainbowUntil: 0,
    };
  }

  // ---- Waves ----

  startWave(number) {
    this.wave = number;
    const count = Math.min(SETTINGS.firstWaveRocks + number - 1, SETTINGS.maxWaveRocks);
    for (let i = 0; i < count; i++) {
      // Never drop a rock right on top of the ship
      let spot = null;
      for (let tries = 0; tries < 60; tries++) {
        const candidate = { x: this.random() * SETTINGS.width, y: this.random() * SETTINGS.height };
        if (this.distance(candidate, this.ship) >= SETTINGS.safeSpawnDistance) {
          spot = candidate;
          break;
        }
      }
      spot = spot || { x: 0, y: 0 };
      this.rocks.push(this.newRock("big", spot.x, spot.y));
    }
  }

  // ---- Controls ----

  setInput({ turn = 0, thrust = 0, aim = null, fire = false }) {
    this.input = { turn, thrust, aim, fire };
  }

  controls() {
    // Drunk steering follows what you were doing half a second ago
    let input = this.input;
    if (this.drunkLeft() > 0) {
      const then = this.time - SETTINGS.drunkDelay;
      input = { turn: 0, thrust: 0, aim: null, fire: input.fire };
      for (let i = this.inputHistory.length - 1; i >= 0; i--) {
        if (this.inputHistory[i].t <= then) {
          input = { ...this.inputHistory[i], fire: this.input.fire };
          break;
        }
      }
    }
    // Reversed: the keys turn and push the wrong way, and the joystick points you backwards
    if (this.reversedLeft() > 0) {
      if (input.aim !== null) return { ...input, aim: input.aim + Math.PI };
      return { ...input, turn: -input.turn, thrust: -input.thrust };
    }
    return input;
  }

  hyperspace() {
    const ship = this.ship;
    if (!ship.alive || this.over || this.time < this.hyperReadyAt) return false;
    this.hyperReadyAt = this.time + SETTINGS.hyperspaceCooldown;
    const from = { x: ship.x, y: ship.y };
    if (this.random() < SETTINGS.hyperspaceFailChance) {
      this.events.push({ type: "hyperspace", from, to: from, failed: true });
      this.kill("hyper");
      return true;
    }
    ship.x = this.random() * SETTINGS.width;
    ship.y = this.random() * SETTINGS.height;
    ship.vx = 0;
    ship.vy = 0;
    this.events.push({ type: "hyperspace", from, to: { x: ship.x, y: ship.y }, failed: false });
    return true;
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over) return;
    this.time += dt;
    this.inputHistory.push({ t: this.time, ...this.input });
    while (this.inputHistory.length && this.inputHistory[0].t < this.time - 2) this.inputHistory.shift();

    if (this.ship.alive) {
      this.flyShip(dt);
      this.fire();
    } else {
      this.tryRespawn();
    }
    this.moveBullets(dt);
    this.moveRocks(dt);
    this.updateUfo(dt);
    this.updateCapsules(dt);
    if (this.hole && this.time >= this.hole.until) this.hole = null;
    this.updateRainbow();
    this.checkHits();
    this.updateWaves();

    if (this.endingAt !== null && this.time >= this.endingAt) {
      this.end(`Out of ships. ${DEATH_LINES[this.deathCause] || ""}`.trim());
    }
  }

  flyShip(dt) {
    const ship = this.ship;
    const input = this.controls();
    if (input.aim !== null) {
      const step = SETTINGS.aimTurnSpeed * dt;
      ship.angle += clamp(angleDiff(input.aim, ship.angle), -step, step);
    } else {
      ship.angle += input.turn * SETTINGS.turnSpeed * dt;
    }
    ship.angle = wrapDelta(ship.angle, Math.PI * 2);

    const push = SETTINGS.thrust * input.thrust * dt;
    ship.vx += Math.cos(ship.angle) * push;
    ship.vy += Math.sin(ship.angle) * push;
    ship.thrusting = Math.sign(input.thrust);

    if (this.hole) {
      // The black hole pulls harder the closer you get
      const dx = wrapDelta(this.hole.x - ship.x, SETTINGS.width);
      const dy = wrapDelta(this.hole.y - ship.y, SETTINGS.height);
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const pull = Math.min(SETTINGS.holePull / Math.max(distance, 30), 900) * dt;
      ship.vx += (dx / distance) * pull;
      ship.vy += (dy / distance) * pull;
    }
    if (this.slipperyLeft() <= 0) {
      const slowDown = Math.exp(-SETTINGS.drag * dt);
      ship.vx *= slowDown;
      ship.vy *= slowDown;
    }
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > SETTINGS.maxSpeed) {
      ship.vx *= SETTINGS.maxSpeed / speed;
      ship.vy *= SETTINGS.maxSpeed / speed;
    }
    ship.x = wrap(ship.x + ship.vx * dt, SETTINGS.width);
    ship.y = wrap(ship.y + ship.vy * dt, SETTINGS.height);
  }

  fire() {
    if (!this.input.fire || this.time < this.fireReadyAt) return;
    const rapid = this.rapidLeft() > 0;
    const spread = this.spreadLeft() > 0;
    const most = (rapid ? SETTINGS.rapidMaxBullets : SETTINGS.maxBullets) + (spread ? 6 : 0);
    if (this.bullets.length >= most) return;

    const ship = this.ship;
    const angles = spread ? [-SETTINGS.spreadAngle, 0, SETTINGS.spreadAngle] : [0];
    for (const turn of angles) {
      const angle = ship.angle + turn;
      this.bullets.push({
        x: wrap(ship.x + Math.cos(ship.angle) * 16, SETTINGS.width),
        y: wrap(ship.y + Math.sin(ship.angle) * 16, SETTINGS.height),
        vx: ship.vx + Math.cos(angle) * SETTINGS.bulletSpeed,
        vy: ship.vy + Math.sin(angle) * SETTINGS.bulletSpeed,
        life: SETTINGS.bulletLife,
        curve: this.curvyLeft() > 0 ? (this.random() < 0.5 ? -1 : 1) * SETTINGS.curveRate : 0,
      });
    }
    this.stats.shots += 1;
    this.fireReadyAt = this.time + (rapid ? SETTINGS.rapidFireDelay : SETTINGS.fireDelay);
    this.events.push({ type: "shot", x: ship.x, y: ship.y });
  }

  moveBullets(dt) {
    for (const bullet of this.bullets) {
      if (bullet.curve) {
        // Curvy bullets keep turning as they fly
        const turn = bullet.curve * dt;
        const { vx, vy } = bullet;
        bullet.vx = vx * Math.cos(turn) - vy * Math.sin(turn);
        bullet.vy = vx * Math.sin(turn) + vy * Math.cos(turn);
      }
      bullet.x = wrap(bullet.x + bullet.vx * dt, SETTINGS.width);
      bullet.y = wrap(bullet.y + bullet.vy * dt, SETTINGS.height);
      bullet.life -= dt;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    for (const bullet of this.ufoBullets) {
      bullet.x = wrap(bullet.x + bullet.vx * dt, SETTINGS.width);
      bullet.y = wrap(bullet.y + bullet.vy * dt, SETTINGS.height);
      bullet.life -= dt;
    }
    this.ufoBullets = this.ufoBullets.filter((b) => b.life > 0);
  }

  moveRocks(dt) {
    const pace = this.slowLeft() > 0 ? SETTINGS.slowScale : 1;
    for (const rock of this.rocks) {
      rock.x = wrap(rock.x + rock.vx * dt * pace, SETTINGS.width);
      rock.y = wrap(rock.y + rock.vy * dt * pace, SETTINGS.height);
      rock.angle += rock.spin * dt * pace;
    }
  }

  // ---- Hits ----

  checkHits() {
    // Your bullets against rocks and the UFO
    for (const bullet of this.bullets) {
      if (this.ufo && Math.hypot(bullet.x - this.ufo.x, bullet.y - this.ufo.y) < SETTINGS.ufoRadius) {
        bullet.life = 0;
        this.destroyUfo();
        continue;
      }
      for (const rock of this.rocks) {
        if (!rock.dead && this.distance(bullet, rock) < rock.r) {
          bullet.life = 0;
          this.stats.hits += 1;
          this.destroyRock(rock, { split: true, drops: true });
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.rocks = this.rocks.filter((r) => !r.dead);

    const ship = this.ship;
    if (!ship.alive) return;

    // The black hole doesn't care about your shield
    if (this.hole && this.distance(ship, this.hole) < SETTINGS.holeCore) {
      this.kill("hole");
      return;
    }
    if (this.time < ship.invulnerableUntil) return;

    for (const rock of this.rocks) {
      if (this.distance(ship, rock) < rock.r * 0.9 + SETTINGS.shipRadius) {
        if (this.useShield()) this.destroyRock(rock, { split: true, drops: false });
        else this.kill("rock");
        break;
      }
    }
    this.rocks = this.rocks.filter((r) => !r.dead);
    if (!ship.alive) return;

    for (const bullet of this.ufoBullets) {
      if (this.distance(ship, bullet) < SETTINGS.shipRadius + 3) {
        bullet.life = 0;
        if (!this.useShield()) this.kill("ufo");
        break;
      }
    }
    this.ufoBullets = this.ufoBullets.filter((b) => b.life > 0);
    if (!ship.alive) return;

    if (this.ufo && Math.hypot(ship.x - this.ufo.x, ship.y - this.ufo.y) < SETTINGS.shipRadius + SETTINGS.ufoRadius) {
      this.destroyUfo();
      if (!this.useShield()) this.kill("ufo");
    }
  }

  useShield() {
    if (this.shieldLeft() <= 0) return false;
    this.shieldUntil = 0;
    this.ship.invulnerableUntil = this.time + 1;
    this.events.push({ type: "shieldHit", x: this.ship.x, y: this.ship.y });
    return true;
  }

  destroyRock(rock, { split, drops }) {
    rock.dead = true;
    const rainbow = rock.rainbowUntil > this.time;
    const points = rainbow ? SETTINGS.rainbowPoints : ROCK_SIZES[rock.size].points;
    this.stats.rocks += 1;
    this.addScore(points);
    this.events.push({ type: "rock", x: rock.x, y: rock.y, size: rock.size, color: rock.color, points, rainbow });

    const next = ROCK_SIZES[rock.size].splitsInto;
    if (split && next) {
      // "More pieces" makes every rock split into 3 or 4 instead of 2
      let pieces = this.splitsLeft() > 0 ? 3 + (this.random() < 0.5 ? 1 : 0) : 2;
      pieces = Math.min(pieces, SETTINGS.maxRocks - this.rocks.filter((r) => !r.dead).length);
      for (let i = 0; i < pieces; i++) this.rocks.push(this.newRock(next, rock.x, rock.y));
    }
    if (drops && !this.classic && (rainbow || this.random() < SETTINGS.dropChance)) {
      const angle = this.random() * Math.PI * 2;
      this.capsules.push({ x: rock.x, y: rock.y, vx: Math.cos(angle) * 30, vy: Math.sin(angle) * 30,
        until: this.time + SETTINGS.capsuleLife, kind: this.random() < 0.5 ? "good" : "bad" });
    }
  }

  addScore(points) {
    this.score += points;
    while (this.score >= this.nextLifeAt) {
      this.nextLifeAt += SETTINGS.extraLifeEvery;
      if (this.lives < SETTINGS.maxLives) {
        this.lives += 1;
        this.events.push({ type: "extraLife" });
      }
    }
  }

  kill(cause) {
    const ship = this.ship;
    ship.alive = false;
    ship.thrusting = 0;
    this.lives -= 1;
    this.deathCause = cause;
    this.events.push({ type: "died", cause, x: ship.x, y: ship.y, lives: this.lives });
    if (this.lives <= 0) this.endingAt = this.time + SETTINGS.gameOverDelay;
    else ship.respawnAt = this.time + SETTINGS.respawnDelay;
  }

  tryRespawn() {
    if (this.lives <= 0 || this.time < this.ship.respawnAt) return;
    // Wait for the middle to clear, but not forever
    const middle = { x: SETTINGS.width / 2, y: SETTINGS.height / 2 };
    const safe = this.rocks.every((r) => this.distance(middle, r) > SETTINGS.respawnSafeRadius + r.r) &&
      this.ufoBullets.every((b) => this.distance(middle, b) > 80) &&
      (!this.hole || this.distance(middle, this.hole) > 160);
    if (safe || this.time >= this.ship.respawnAt + 3) {
      this.ship = this.newShip();
      this.events.push({ type: "respawn" });
    }
  }

  // ---- The UFO ----

  updateUfo(dt) {
    const ufo = this.ufo;
    if (!ufo) {
      if (this.time >= this.nextUfoAt) {
        const direction = this.random() < 0.5 ? 1 : -1;
        this.ufo = {
          x: direction > 0 ? -SETTINGS.ufoRadius : SETTINGS.width + SETTINGS.ufoRadius,
          y: 100 + this.random() * 600,
          vx: direction * SETTINGS.ufoSpeed,
          vy: 0,
          nextTurnAt: this.time + 1.2,
          nextShotAt: this.time + 1,
        };
        this.events.push({ type: "ufo", x: this.ufo.x, y: this.ufo.y });
      }
      return;
    }

    ufo.x += ufo.vx * dt;
    ufo.y = wrap(ufo.y + ufo.vy * dt, SETTINGS.height);
    if (this.time >= ufo.nextTurnAt) {
      ufo.vy = [-90, 0, 90][Math.floor(this.random() * 3)];
      ufo.nextTurnAt = this.time + 1 + this.random();
    }
    if (this.ship.alive && this.time >= ufo.nextShotAt) {
      // It gets better at aiming as the waves go on
      const wobble = Math.max(0.08, 0.35 - 0.03 * this.wave) * (this.random() * 2 - 1);
      const angle = Math.atan2(wrapDelta(this.ship.y - ufo.y, SETTINGS.height), this.ship.x - ufo.x) + wobble;
      this.ufoBullets.push({ x: wrap(ufo.x, SETTINGS.width), y: ufo.y, vx: Math.cos(angle) * SETTINGS.ufoBulletSpeed,
        vy: Math.sin(angle) * SETTINGS.ufoBulletSpeed, life: SETTINGS.ufoBulletLife });
      ufo.nextShotAt = this.time + Math.max(0.6, 1.3 - 0.05 * this.wave);
      this.events.push({ type: "ufoShot", x: ufo.x, y: ufo.y });
    }
    const gone = ufo.vx > 0 ? ufo.x > SETTINGS.width + 2 * SETTINGS.ufoRadius : ufo.x < -2 * SETTINGS.ufoRadius;
    if (gone) {
      this.ufo = null;
      this.nextUfoAt = this.gap(SETTINGS.ufoGapMin, SETTINGS.ufoGapMax);
      this.events.push({ type: "ufoGone" });
    }
  }

  destroyUfo() {
    const ufo = this.ufo;
    this.ufo = null;
    this.stats.ufos += 1;
    this.addScore(SETTINGS.ufoPoints);
    this.nextUfoAt = this.gap(SETTINGS.ufoGapMin, SETTINGS.ufoGapMax);
    this.events.push({ type: "ufoDown", x: ufo.x, y: ufo.y, points: SETTINGS.ufoPoints });
  }

  // ---- Waves ----

  updateWaves() {
    if (this.rocks.length === 0 && this.nextWaveAt === null) {
      this.nextWaveAt = this.time + SETTINGS.waveDelay;
      this.events.push({ type: "waveClear", wave: this.wave });
    }
    if (this.nextWaveAt !== null && this.time >= this.nextWaveAt) {
      this.nextWaveAt = null;
      this.startWave(this.wave + 1);
      this.events.push({ type: "wave", wave: this.wave });
    }
  }

  // ---- Capsules ----

  updateCapsules(dt) {
    for (const capsule of this.capsules) {
      capsule.x = wrap(capsule.x + capsule.vx * dt, SETTINGS.width);
      capsule.y = wrap(capsule.y + capsule.vy * dt, SETTINGS.height);
      if (this.time >= capsule.until) {
        capsule.done = true;
      } else if (this.ship.alive && this.distance(this.ship, capsule) < SETTINGS.shipRadius + SETTINGS.capsuleRadius) {
        capsule.done = true;
        this.catchCapsule(capsule);
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
    this.stats[capsule.kind] += 1;
    const message = this.applyCapsule(name) || CAPSULES[name];
    this.events.push({ type: "caught", name, kind: capsule.kind, x: this.ship.x, y: this.ship.y,
      text: message.text, popup: message.popup });
  }

  applyCapsule(name) {
    const until = this.time + SETTINGS.effectTime;
    if (name === "shield") this.shieldUntil = this.time + SETTINGS.shieldTime;
    if (name === "rapid") this.rapidUntil = until;
    if (name === "spread") this.spreadUntil = until;
    if (name === "slow") this.slowUntil = until;
    if (name === "reversed") this.reversedUntil = until;
    if (name === "drunk") this.drunkUntil = until;
    if (name === "fog") this.fogUntil = this.time + SETTINGS.fogTime;
    if (name === "splits") this.splitsUntil = until;
    if (name === "slippery") this.slipperyUntil = until;
    if (name === "curvy") this.curvyUntil = until;
    if (name === "gravity") this.spawnHole();
    if (name === "life") {
      if (this.lives >= SETTINGS.maxLives) return { text: "Good: extra life, but you're maxed out. Greedy.", popup: "MAXED" };
      this.lives += 1;
    }
    if (name === "bomb" && this.smartBomb() === 0) {
      return { text: "Good: smart bomb, but nothing was close. Wasted.", popup: "WASTED" };
    }
    return null;
  }

  smartBomb() {
    // Wipes out every rock (and the UFO) near the ship. No splitting, no mess.
    let count = 0;
    for (const rock of this.rocks) {
      if (this.distance(this.ship, rock) < SETTINGS.bombRadius) {
        this.destroyRock(rock, { split: false, drops: false });
        count += 1;
      }
    }
    this.rocks = this.rocks.filter((r) => !r.dead);
    if (this.ufo && Math.hypot(this.ship.x - this.ufo.x, this.ship.y - this.ufo.y) < SETTINGS.bombRadius) {
      this.destroyUfo();
      count += 1;
    }
    this.events.push({ type: "bomb", x: this.ship.x, y: this.ship.y, count });
    return count;
  }

  spawnHole() {
    // Somewhere you're not, so you get a moment to realise what's happening
    let spot = { x: wrap(this.ship.x + 400, SETTINGS.width), y: wrap(this.ship.y + 400, SETTINGS.height) };
    for (let tries = 0; tries < 40; tries++) {
      const candidate = { x: 60 + this.random() * 680, y: 60 + this.random() * 680 };
      if (this.distance(candidate, this.ship) >= 260) {
        spot = candidate;
        break;
      }
    }
    this.hole = { ...spot, until: this.time + SETTINGS.holeTime };
    this.events.push({ type: "hole", x: spot.x, y: spot.y });
  }

  // ---- The rainbow rock ----

  updateRainbow() {
    if (this.classic) return;
    const current = this.rainbowRock;
    if (current && (current.dead || current.rainbowUntil <= this.time)) {
      this.rainbowRock = null;
      this.nextRainbowAt = this.gap(SETTINGS.rainbowGapMin, SETTINGS.rainbowGapMax);
    } else if (!current && this.time >= this.nextRainbowAt) {
      if (this.rocks.length) {
        const rock = this.rocks[Math.floor(this.random() * this.rocks.length)];
        rock.rainbowUntil = this.time + SETTINGS.rainbowTime;
        this.rainbowRock = rock;
        this.events.push({ type: "rainbow", x: rock.x, y: rock.y });
      } else {
        this.nextRainbowAt = this.gap(SETTINGS.rainbowGapMin, SETTINGS.rainbowGapMax);
      }
    }
  }

  // ---- Timers ----

  timeLeft(until) {
    return Math.max(0, until - this.time);
  }

  shieldLeft() { return this.timeLeft(this.shieldUntil); }
  rapidLeft() { return this.timeLeft(this.rapidUntil); }
  spreadLeft() { return this.timeLeft(this.spreadUntil); }
  slowLeft() { return this.timeLeft(this.slowUntil); }
  reversedLeft() { return this.timeLeft(this.reversedUntil); }
  drunkLeft() { return this.timeLeft(this.drunkUntil); }
  fogLeft() { return this.timeLeft(this.fogUntil); }
  holeLeft() { return this.hole ? this.timeLeft(this.hole.until) : 0; }
  splitsLeft() { return this.timeLeft(this.splitsUntil); }
  slipperyLeft() { return this.timeLeft(this.slipperyUntil); }
  curvyLeft() { return this.timeLeft(this.curvyUntil); }
  hyperReady() { return this.time >= this.hyperReadyAt; }

  end(reason) {
    this.over = reason;
    this.events.push({ type: "over", reason });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { RockGame, SETTINGS, ROCK_SIZES, CAPSULES, wrap, wrapDelta };
}
