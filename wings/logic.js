// The rules of Chaos Wings, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls. Everything here is measured on a 480 x 800 board.
"use strict";

const SETTINGS = {
  width: 480,
  height: 800,
  groundY: 730,          // the top of the floor
  heroX: 130,
  heroRadius: 17,
  tinyScale: 0.6,
  gravity: 1550,         // how hard Grump falls, per second per second
  heavyScale: 1.45,
  flapSpeed: 470,        // how fast a flap sends Grump upwards
  maxFallSpeed: 720,
  pillarWidth: 78,
  pillarSpacing: 260,    // distance between one pillar and the next
  firstPillarX: 600,
  startSpeed: 190,       // how fast the pillars scroll, per second
  speedUp: 4,            // extra speed for every point...
  maxSpeed: 330,         // ...up to this
  startGap: 215,         // the size of the gap you fly through...
  gapShrink: 2.2,        // ...shrinking this much for every point...
  minGap: 150,           // ...down to this
  gapMargin: 110,        // how close a gap can get to the ceiling or the floor
  orbChance: 0.35,       // how often a pillar has a mystery orb in its gap
  orbRadius: 13,
  effectTime: 8,         // how long most orb effects last, in seconds
  fogTime: 6,
  slowScale: 0.6,
  drunkDelay: 0.25,      // how late your flaps arrive when drunk, in seconds
  autoFlapEvery: 0.42,   // when reversed, Grump flaps by itself this often (unless you hold)
  slideAmount: 55,       // how far sliding pillars move up and down
  gustForce: 950,        // how hard a gust of wind shoves Grump
  shieldGrace: 1.2,      // after the shield saves you, nothing can hurt you for this long
  suddenGapMin: 18,      // in Chaos mode something sudden happens every 18 to 30 seconds
  suddenGapMax: 30,
  suddenWarning: 1,      // with this much warning
};

// Every orb looks the same until you fly through it
const ORBS = {
  shield: { kind: "good", text: "Good: shield. One free crash. Use it wisely (you won't).", popup: "SHIELD!" },
  slow: { kind: "good", text: "Good: slow-mo. Even you can react in time now.", popup: "SLOW-MO" },
  tiny: { kind: "good", text: "Good: tiny Grump. Smaller target, same attitude.", popup: "TINY!" },
  double: { kind: "good", text: "Good: double points. Don't get greedy.", popup: "×2 POINTS" },
  gravity: { kind: "bad", text: "Bad: gravity flipped. Down is up. Tap to go down.", popup: "UPSIDE DOWN!" },
  reversed: { kind: "bad", text: "Bad: reversed. Grump flaps by itself now. Hold to drop.", popup: "REVERSED!" },
  drunk: { kind: "bad", text: "Bad: drunk. Your flaps show up fashionably late.", popup: "DRUNK!" },
  fog: { kind: "bad", text: "Bad: fog. Good luck seeing the next pillar.", popup: "FOG!" },
  wind: { kind: "bad", text: "Bad: windy. Grump is basically a kite now.", popup: "WINDY!" },
  heavy: { kind: "bad", text: "Bad: heavy. Grump ate too many snacks.", popup: "HEAVY!" },
  sliding: { kind: "bad", text: "Bad: sliding pillars. They move now. Sorry.", popup: "SLIDING!" },
};

// Things that just happen in Chaos mode, with a second of warning
const SUDDEN = {
  flip: { time: 3, warning: "FLIP INCOMING!" },
  quake: { time: 2.5, warning: "EARTHQUAKE!" },
  disco: { time: 5, warning: "DISCO TIME" },
  gust: { time: 0.6, warning: "BIG GUST!" },
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

class WingsGame {
  // Classic mode is the plain one-tap flyer: no orbs and nothing sudden
  constructor({ classic = false, random = Math.random } = {}) {
    this.classic = classic;
    this.random = random;
    this.time = 0;          // game clock in seconds; it only runs while the game is being played
    this.events = [];       // things that happened, for the screen to react to (popups etc.)
    this.over = null;       // why the game ended, once it has
    this.started = false;   // Grump hovers until your first flap

    this.score = 0;
    this.caught = { good: 0, bad: 0 };
    this.hero = { y: SETTINGS.height * 0.42, vy: 0, flapAt: -1 };
    this.distance = 0;      // how far the world has scrolled, for the background
    this.pillars = [];
    this.pillarsMade = 0;
    this.holding = false;   // whether the flap button is held down (for reversed)
    this.pendingFlaps = []; // flaps waiting to happen when drunk
    this.nextAutoFlapAt = 0;

    // Effects from orbs. Each "Until" is the game time the effect wears off.
    this.shield = false;
    this.safeUntil = 0;
    this.slowUntil = 0;
    this.tinyUntil = 0;
    this.doubleUntil = 0;
    this.gravityUntil = 0;
    this.reversedUntil = 0;
    this.drunkUntil = 0;
    this.fogUntil = 0;
    this.windUntil = 0;
    this.heavyUntil = 0;
    this.slidingUntil = 0;
    this.slide = 0;         // eases between 0 and 1, so sliding pillars start and stop smoothly
    this.gust = { until: 0, force: 0, nextAt: 0 };

    this.sudden = null;     // { type, startsAt, until } once something sudden is coming
    this.nextSuddenAt = this.suddenGap();
  }

  // ---- Controls ----

  flap() {
    if (this.over) return;
    if (!this.started) {
      this.started = true;
      this.addPillar(SETTINGS.firstPillarX);
      this.nextSuddenAt = this.time + this.suddenGap();
    }
    if (this.reversedLeft() > 0) return;  // reversed: Grump flaps by itself, your taps don't count
    if (this.drunkLeft() > 0) {
      this.pendingFlaps.push(this.time + SETTINGS.drunkDelay);
      return;
    }
    this.doFlap();
  }

  setHolding(holding) {
    this.holding = holding;
  }

  doFlap() {
    // Upside down, a flap pushes Grump down instead
    this.hero.vy = -SETTINGS.flapSpeed * this.gravityDirection();
    this.hero.flapAt = this.time;
    this.events.push({ type: "flap", y: this.hero.y });
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over) return;
    this.time += dt;
    if (!this.started) {
      // Bob gently until the first flap
      this.hero.y = SETTINGS.height * 0.42 + Math.sin(this.time * 4) * 8;
      return;
    }
    const step = dt * (this.slowLeft() > 0 ? SETTINGS.slowScale : 1);

    while (this.pendingFlaps.length && this.pendingFlaps[0] <= this.time) {
      this.pendingFlaps.shift();
      this.doFlap();
    }
    if (this.reversedLeft() > 0 && !this.holding && this.time >= this.nextAutoFlapAt) {
      this.nextAutoFlapAt = this.time + SETTINGS.autoFlapEvery;
      this.doFlap();
    }

    this.moveHero(step);
    this.movePillars(step);
    this.updateSudden();
    if (!this.over) this.checkCrash();
  }

  gravityDirection() {
    return this.gravityLeft() > 0 ? -1 : 1;
  }

  heroRadius() {
    return SETTINGS.heroRadius * (this.tinyLeft() > 0 ? SETTINGS.tinyScale : 1);
  }

  speed() {
    return Math.min(SETTINGS.maxSpeed, SETTINGS.startSpeed + SETTINGS.speedUp * this.score);
  }

  gapSize() {
    return Math.max(SETTINGS.minGap, SETTINGS.startGap - SETTINGS.gapShrink * this.score);
  }

  moveHero(step) {
    const hero = this.hero;
    let gravity = SETTINGS.gravity * this.gravityDirection();
    if (this.heavyLeft() > 0) gravity *= SETTINGS.heavyScale;
    hero.vy += gravity * step;

    // Wind: gusts shove Grump up or down every second or two
    if (this.windLeft() > 0 && this.time >= this.gust.nextAt) {
      const force = (this.random() < 0.5 ? -1 : 1) * SETTINGS.gustForce;
      this.gust = { until: this.time + 0.45, force, nextAt: this.time + 1.2 + this.random() * 0.8 };
      this.events.push({ type: "gust", direction: Math.sign(force) });
    }
    if (this.time < this.gust.until) hero.vy += this.gust.force * step;

    hero.vy = clamp(hero.vy, -SETTINGS.maxFallSpeed, SETTINGS.maxFallSpeed);
    hero.y += hero.vy * step;
  }

  movePillars(step) {
    const move = this.speed() * step;
    this.distance += move;
    // Sliding pillars ease in and out instead of snapping
    const target = this.slidingLeft() > 0 ? 1 : 0;
    this.slide += clamp(target - this.slide, -step, step);

    for (const pillar of this.pillars) {
      pillar.x -= move;
      pillar.offset = this.slide * SETTINGS.slideAmount * Math.sin(this.time * 2.2 + pillar.phase);
    }
    this.pillars = this.pillars.filter((p) => p.x + SETTINGS.pillarWidth > -20);
    const last = this.pillars[this.pillars.length - 1];
    if (!last || last.x < SETTINGS.width + 20 - SETTINGS.pillarSpacing) {
      this.addPillar((last ? last.x : SETTINGS.width) + SETTINGS.pillarSpacing);
    }

    const r = this.heroRadius();
    for (const pillar of this.pillars) {
      // Through the gap: a point (or two)
      if (!pillar.passed && pillar.x + SETTINGS.pillarWidth < SETTINGS.heroX - r) {
        pillar.passed = true;
        const points = this.doubleLeft() > 0 ? 2 : 1;
        const before = this.score;
        this.score += points;
        this.events.push({ type: "point", points, score: this.score });
        for (const milestone of [10, 25, 50, 75, 100, 150, 200]) {
          if (before < milestone && this.score >= milestone) this.events.push({ type: "milestone", score: milestone });
        }
      }
      // Flying through an orb
      const orb = pillar.orb;
      if (orb && !orb.taken) {
        const x = pillar.x + SETTINGS.pillarWidth / 2;
        const y = this.gapCenter(pillar);
        if (Math.hypot(SETTINGS.heroX - x, this.hero.y - y) < r + SETTINGS.orbRadius) {
          orb.taken = true;
          this.takeOrb(x, y);
        }
      }
    }
  }

  addPillar(x) {
    const gap = this.gapSize();
    const low = SETTINGS.gapMargin + gap / 2;
    const high = SETTINGS.groundY - SETTINGS.gapMargin - gap / 2;
    // Orbs start from the third pillar, so the first few seconds are fair
    const orb = !this.classic && this.pillarsMade >= 2 && this.random() < SETTINGS.orbChance ? { taken: false } : null;
    this.pillars.push({ x, center: low + this.random() * (high - low), gap, passed: false, offset: 0,
      phase: this.random() * Math.PI * 2, orb });
    this.pillarsMade += 1;
  }

  gapCenter(pillar) {
    return pillar.center + pillar.offset;
  }

  // ---- Crashing ----

  checkCrash() {
    const hero = this.hero;
    const r = this.heroRadius();
    const safe = this.time < this.safeUntil;

    // Ceiling and floor
    let crash = null;
    if (hero.y - r < 0) crash = "ceiling";
    if (hero.y + r > SETTINGS.groundY) crash = "floor";
    if (crash && (safe || this.shield)) {
      if (!safe) this.useShield();
      // Bounce off instead
      hero.y = crash === "ceiling" ? r : SETTINGS.groundY - r;
      hero.vy = crash === "ceiling" ? Math.abs(hero.vy) * 0.5 : -Math.abs(hero.vy) * 0.6 - 200;
      crash = null;
    }
    if (crash) {
      this.end(crash);
      return;
    }

    if (safe) return;
    for (const pillar of this.pillars) {
      if (this.touchingPillar(pillar, r)) {
        if (this.shield) {
          this.useShield();
          return;
        }
        this.end("pillar");
        return;
      }
    }
  }

  touchingPillar(pillar, r) {
    const left = pillar.x;
    const right = pillar.x + SETTINGS.pillarWidth;
    const top = this.gapCenter(pillar) - pillar.gap / 2;
    const bottom = this.gapCenter(pillar) + pillar.gap / 2;
    const x = SETTINGS.heroX;
    const y = this.hero.y;
    // The point of each half of the pillar closest to Grump
    const cx = clamp(x, left, right);
    for (const [rectTop, rectBottom] of [[-1000, top], [bottom, SETTINGS.groundY + 1000]]) {
      const cy = clamp(y, rectTop, rectBottom);
      if (Math.hypot(x - cx, y - cy) < r - 1) return true;
    }
    return false;
  }

  useShield() {
    this.shield = false;
    this.safeUntil = this.time + SETTINGS.shieldGrace;
    this.events.push({ type: "shieldSave", y: this.hero.y });
  }

  // ---- Orbs ----

  takeOrb(x, y) {
    const kind = this.random() < 0.5 ? "good" : "bad";
    const options = Object.keys(ORBS).filter((name) => ORBS[name].kind === kind);
    const name = options[Math.floor(this.random() * options.length)];
    this.caught[kind] += 1;
    this.applyOrb(name);
    this.events.push({ type: "orb", name, kind, x, y, text: ORBS[name].text, popup: ORBS[name].popup });
  }

  applyOrb(name) {
    const until = this.time + SETTINGS.effectTime;
    if (name === "shield") this.shield = true;
    if (name === "slow") this.slowUntil = until;
    if (name === "tiny") this.tinyUntil = until;
    if (name === "double") this.doubleUntil = until;
    if (name === "gravity") this.gravityUntil = until;
    if (name === "reversed") {
      this.reversedUntil = until;
      this.nextAutoFlapAt = this.time + 0.15;
    }
    if (name === "drunk") this.drunkUntil = until;
    if (name === "fog") this.fogUntil = this.time + SETTINGS.fogTime;
    if (name === "wind") {
      this.windUntil = until;
      this.gust.nextAt = this.time + 0.6;
    }
    if (name === "heavy") this.heavyUntil = until;
    if (name === "sliding") this.slidingUntil = until;
  }

  // ---- Sudden events ----

  suddenGap() {
    return SETTINGS.suddenGapMin + this.random() * (SETTINGS.suddenGapMax - SETTINGS.suddenGapMin);
  }

  updateSudden() {
    if (this.classic) return;
    if (this.sudden && this.time >= this.sudden.until) {
      this.sudden = null;
      this.nextSuddenAt = this.time + this.suddenGap();
    }
    if (!this.sudden && this.time >= this.nextSuddenAt) {
      const types = Object.keys(SUDDEN);
      const type = types[Math.floor(this.random() * types.length)];
      const startsAt = this.time + SETTINGS.suddenWarning;
      this.sudden = { type, startsAt, until: startsAt + SUDDEN[type].time, hit: false };
      this.events.push({ type: "suddenWarning", sudden: type, text: SUDDEN[type].warning });
    }
    const sudden = this.sudden;
    if (sudden && !sudden.hit && this.time >= sudden.startsAt) {
      sudden.hit = true;
      if (sudden.type === "gust") this.hero.vy += (this.random() < 0.5 ? -1 : 1) * 520;
      this.events.push({ type: "sudden", sudden: sudden.type });
    }
  }

  suddenActive(type) {
    return Boolean(this.sudden && this.sudden.type === type && this.time >= this.sudden.startsAt);
  }

  // ---- Helpers ----

  timeLeft(until) {
    return Math.max(0, until - this.time);
  }

  slowLeft() { return this.timeLeft(this.slowUntil); }
  tinyLeft() { return this.timeLeft(this.tinyUntil); }
  doubleLeft() { return this.timeLeft(this.doubleUntil); }
  gravityLeft() { return this.timeLeft(this.gravityUntil); }
  reversedLeft() { return this.timeLeft(this.reversedUntil); }
  drunkLeft() { return this.timeLeft(this.drunkUntil); }
  fogLeft() { return this.timeLeft(this.fogUntil); }
  windLeft() { return this.timeLeft(this.windUntil); }
  heavyLeft() { return this.timeLeft(this.heavyUntil); }
  slidingLeft() { return this.timeLeft(this.slidingUntil); }

  end(what) {
    const reasons = {
      pillar: this.slide > 0.2 ? "You hit a pillar. Okay, that one was moving." : "You hit a pillar. It wasn't even moving.",
      floor: "You hit the floor. Gravity: 1, you: 0.",
      ceiling: "You hit the ceiling. Ambitious, but no.",
    };
    this.over = reasons[what];
    this.crashedInto = what;
    this.events.push({ type: "over", reason: this.over, what });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { WingsGame, SETTINGS, ORBS, SUDDEN };
}
