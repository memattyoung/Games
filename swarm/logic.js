// The rules of Chaos Swarm, with no drawing code, so they can be tested on their own.
// game.js handles drawing and controls. Everything here is measured on a 600 x 800 board.
"use strict";

const SETTINGS = {
  width: 600,
  height: 800,
  shipY: 740,             // the middle of your ship
  shipWidth: 44,
  shipHeight: 26,
  shipKeySpeed: 520,      // how fast the arrow keys move the ship, per second
  shipChaseSpeed: 1800,   // how fast the ship chases your mouse or finger, per second
  fireCooldown: 0.32,     // seconds between shots
  bulletSpeed: 760,
  bulletWidth: 4,
  bulletHeight: 14,
  cols: 8,
  alienWidth: 40,
  alienHeight: 30,
  alienGapX: 22,
  alienGapY: 18,
  formationTop: 90,
  stepSize: 12,           // how far the swarm shuffles sideways each step
  dropSize: 18,           // how far it drops when it reaches an edge
  stepFull: 0.62,         // seconds between steps with a full swarm...
  stepEmpty: 0.06,        // ...down to this with one alien left
  waveSpeedUp: 0.07,      // each wave makes the swarm this much faster
  enemyBulletSpeed: 260,
  enemyFireRate: 0.55,    // enemy shots per second on wave 1...
  fireRatePerWave: 0.15,  // ...plus this much per wave
  maxEnemyBullets: 8,
  diveEvery: 7,           // seconds between dive bombers on wave 1
  diveEveryMin: 2.5,
  diveSpeed: 230,
  lives: 3,
  maxLives: 5,
  invulnerableTime: 2,    // after losing a life you can't be hit for this long
  landingY: 690,          // if the swarm reaches this line, it has landed and you lose
  dropChance: 0.15,       // how often a dead alien drops a mystery capsule
  capsuleSpeed: 150,
  effectTime: 10,         // how long most capsule effects last, in seconds
  fogTime: 6,
  dodgeTime: 8,
  dodgeChance: 0.5,       // while the swarm can dodge, this many shots miss on purpose
  drunkDelay: 0.5,        // how far behind your controls the ship is when drunk, in seconds
  spreadAngle: 0.22,      // radians between spread shots
  rapidScale: 0.4,
  jamScale: 2.6,
  slowScale: 1.8,
  speedUpScale: 0.5,
  comboStep: 5,           // every 5 kills in a row adds 1 to the multiplier...
  maxMultiplier: 5,       // ...up to x5
  waveBonus: 200,         // times the wave number
  bossPoints: 500,
  bossHp: 3,
  bossSpeed: 140,
  bossGapMin: 25,
  bossGapMax: 45,
};

// Points by row, top to bottom
const ALIEN_TYPES = [
  { name: "grump", points: 30 },
  { name: "sneer", points: 20 },
  { name: "sneer", points: 20 },
  { name: "goober", points: 10 },
  { name: "goober", points: 10 },
  { name: "goober", points: 10 },
];

// Every capsule looks the same until you catch it. "weight" is how likely each one is.
const CAPSULES = {
  spread: { kind: "good", weight: 1, text: "Good: spread shot. Spray and pray, baby.", popup: "SPREAD!" },
  rapid: { kind: "good", weight: 1, text: "Good: rapid fire. Your trigger finger thanks you.", popup: "RAPID!" },
  shield: { kind: "good", weight: 1, text: "Good: shield. One free hit. Try not to need it.", popup: "SHIELD!" },
  pierce: { kind: "good", weight: 1, text: "Good: piercing laser. Goes right through them. Rude.", popup: "PIERCE!" },
  slow: { kind: "good", weight: 1, text: "Good: slow swarm. They're tired. Unlike you.", popup: "SLOW-MO" },
  life: { kind: "good", weight: 0.5, text: "Good: extra life. Don't make it weird.", popup: "+1 LIFE" },
  reversed: { kind: "bad", weight: 1, text: "Bad: controls reversed. Left is a state of mind.", popup: "REVERSED!" },
  drunk: { kind: "bad", weight: 1, text: "Bad: drunk ship. Who let you fly like this?", popup: "DRUNK!" },
  jammed: { kind: "bad", weight: 1, text: "Bad: jammed gun. Pew… pew…", popup: "JAMMED!" },
  fog: { kind: "bad", weight: 1, text: "Bad: fog. Shoot at where you think they are.", popup: "FOG!" },
  speedup: { kind: "bad", weight: 1, text: "Bad: the swarm had coffee. Lots of coffee.", popup: "ZOOM!" },
  boomerang: { kind: "bad", weight: 1, text: "Bad: boomerang bullets. Your misses come back for you.", popup: "BOOMERANG!" },
  dodge: { kind: "bad", weight: 1, text: "Bad: the swarm learned to dodge. Great.", popup: "NOPE!" },
};

function clamp(value, low, high) {
  return Math.max(low, Math.min(value, high));
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class SwarmGame {
  // Classic mode is a plain wave shooter: no capsules, no boss, no combos
  constructor({ classic = false, random = Math.random } = {}) {
    this.classic = classic;
    this.random = random;
    this.time = 0;          // game clock in seconds; it only runs while the game is being played
    this.events = [];       // things that happened, for the screen to react to (popups etc.)
    this.over = null;       // why the game ended, once it has

    this.score = 0;
    this.wave = 1;
    this.lives = SETTINGS.lives;
    this.combo = 0;         // kills in a row without missing
    this.bestCombo = 0;
    this.kills = 0;
    this.caught = { good: 0, bad: 0 };

    this.ship = { x: SETTINGS.width / 2 };
    this.input = { left: false, right: false, targetX: null, fire: false };
    this.inputHistory = [];  // recent controls, so a drunk ship can follow them late
    this.nextShotAt = 0;
    this.invulnerableUntil = 0;
    this.bullets = [];       // yours, going up
    this.enemyBullets = [];  // theirs (and your boomerangs), coming down
    this.capsules = [];

    // Effects from capsules. Each "Until" is the game time the effect wears off.
    this.spreadUntil = 0;
    this.rapidUntil = 0;
    this.pierceUntil = 0;
    this.slowUntil = 0;
    this.reversedUntil = 0;
    this.drunkUntil = 0;
    this.jammedUntil = 0;
    this.fogUntil = 0;
    this.speedUpUntil = 0;
    this.boomerangUntil = 0;
    this.dodgeUntil = 0;
    this.shield = false;

    this.boss = null;
    this.nextBossAt = this.bossGap();
    this.buildWave();
  }

  // ---- Waves ----

  buildWave() {
    const rows = Math.min(3 + this.wave, ALIEN_TYPES.length);
    this.aliens = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < SETTINGS.cols; col++) {
        const type = ALIEN_TYPES[row];
        this.aliens.push({ col, row, type: type.name, points: type.points, alive: true, dive: null,
          x: 0, y: 0, w: SETTINGS.alienWidth, h: SETTINGS.alienHeight });
      }
    }
    const width = SETTINGS.cols * SETTINGS.alienWidth + (SETTINGS.cols - 1) * SETTINGS.alienGapX;
    this.formation = { x: (SETTINGS.width - width) / 2, y: SETTINGS.formationTop, dir: 1 };
    this.startingAliens = this.aliens.length;
    this.stepTimer = 0;
    this.fireTimer = 0;
    this.diveTimer = 0;
    this.placeFormation();
  }

  slotX(alien) {
    return this.formation.x + alien.col * (SETTINGS.alienWidth + SETTINGS.alienGapX);
  }

  slotY(alien) {
    return this.formation.y + alien.row * (SETTINGS.alienHeight + SETTINGS.alienGapY);
  }

  placeFormation() {
    for (const alien of this.aliens) {
      if (alien.alive && !alien.dive) {
        alien.x = this.slotX(alien);
        alien.y = this.slotY(alien);
      }
    }
  }

  aliensLeft() {
    return this.aliens.filter((a) => a.alive).length;
  }

  nextWave() {
    const bonus = SETTINGS.waveBonus * this.wave;
    this.score += bonus;
    this.events.push({ type: "wave", wave: this.wave + 1, bonus });
    this.wave += 1;
    this.enemyBullets = [];
    this.buildWave();
  }

  // ---- Controls ----

  setInput({ left = false, right = false, targetX = null, fire = false }) {
    this.input = { left, right, targetX, fire };
  }

  controls() {
    // A drunk ship follows what you were doing half a second ago
    let input = this.input;
    if (this.drunkLeft() > 0) {
      const then = this.time - SETTINGS.drunkDelay;
      input = { left: false, right: false, targetX: null, fire: this.input.fire };
      for (let i = this.inputHistory.length - 1; i >= 0; i--) {
        if (this.inputHistory[i].t <= then) {
          input = { ...this.inputHistory[i], fire: this.input.fire };
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
        fire: input.fire,
      };
    }
    return input;
  }

  // ---- Each frame ----

  update(dt) {
    if (this.over) return;
    this.time += dt;
    this.inputHistory.push({ t: this.time, ...this.input });
    while (this.inputHistory.length && this.inputHistory[0].t < this.time - 2) this.inputHistory.shift();

    const controls = this.controls();
    this.moveShip(controls, dt);
    if (controls.fire) this.fire();

    this.marchSwarm(dt);
    if (this.over) return;
    this.moveDivers(dt);
    this.enemyFire(dt);
    this.moveBullets(dt);
    if (this.over) return;
    this.moveCapsules(dt);
    this.updateBoss(dt);
    if (this.aliensLeft() === 0) this.nextWave();
  }

  moveShip({ left, right, targetX }, dt) {
    const ship = this.ship;
    if (targetX !== null) {
      const most = SETTINGS.shipChaseSpeed * dt;
      ship.x += clamp(targetX - ship.x, -most, most);
    }
    if (left) ship.x -= SETTINGS.shipKeySpeed * dt;
    if (right) ship.x += SETTINGS.shipKeySpeed * dt;
    const half = SETTINGS.shipWidth / 2;
    ship.x = clamp(ship.x, half, SETTINGS.width - half);
  }

  shipBox() {
    // A little smaller than the drawing, so near misses feel fair
    return { x: this.ship.x - 15, y: SETTINGS.shipY - 8, w: 30, h: 16 };
  }

  fire() {
    if (this.time < this.nextShotAt) return false;
    let cooldown = SETTINGS.fireCooldown;
    if (this.rapidLeft() > 0) cooldown *= SETTINGS.rapidScale;
    if (this.jammedLeft() > 0) cooldown *= SETTINGS.jamScale;
    this.nextShotAt = this.time + cooldown;

    const angles = this.spreadLeft() > 0 ? [-SETTINGS.spreadAngle, 0, SETTINGS.spreadAngle] : [0];
    const pierce = this.pierceLeft() > 0;
    for (const angle of angles) {
      this.bullets.push({
        x: this.ship.x,
        y: SETTINGS.shipY - SETTINGS.shipHeight / 2,
        vx: Math.sin(angle) * SETTINGS.bulletSpeed,
        vy: -Math.cos(angle) * SETTINGS.bulletSpeed,
        pierce,
        hits: 0,
        dodgedBy: new Set(),
      });
    }
    this.events.push({ type: "shot", x: this.ship.x });
    return true;
  }

  // ---- The swarm ----

  stepInterval() {
    const full = this.aliensLeft() / this.startingAliens;
    let interval = SETTINGS.stepEmpty + (SETTINGS.stepFull - SETTINGS.stepEmpty) * full;
    interval *= Math.max(0.45, 1 - SETTINGS.waveSpeedUp * (this.wave - 1));
    if (this.slowLeft() > 0) interval *= SETTINGS.slowScale;
    if (this.speedUpLeft() > 0) interval *= SETTINGS.speedUpScale;
    return interval;
  }

  marchSwarm(dt) {
    this.stepTimer += dt;
    if (this.stepTimer >= this.stepInterval()) {
      this.stepTimer = 0;
      const alive = this.aliens.filter((a) => a.alive);
      if (alive.length) {
        const left = Math.min(...alive.map((a) => this.slotX(a)));
        const right = Math.max(...alive.map((a) => this.slotX(a) + SETTINGS.alienWidth));
        const step = SETTINGS.stepSize * this.formation.dir;
        if (left + step < 10 || right + step > SETTINGS.width - 10) {
          // Hit the edge: drop down and turn around
          this.formation.y += SETTINGS.dropSize;
          this.formation.dir *= -1;
        } else {
          this.formation.x += step;
        }
        this.events.push({ type: "step" });
      }
    }
    this.placeFormation();

    const bottom = Math.max(0, ...this.aliens.filter((a) => a.alive && !a.dive).map((a) => a.y + a.h));
    if (bottom >= SETTINGS.landingY) this.end("The swarm landed. They're redecorating.");
  }

  moveDivers(dt) {
    const speed = SETTINGS.diveSpeed * (this.slowLeft() > 0 ? 0.6 : 1) * (this.speedUpLeft() > 0 ? 1.4 : 1);
    // Every so often an alien breaks formation and dives at you
    this.diveTimer += dt;
    const every = Math.max(SETTINGS.diveEveryMin, SETTINGS.diveEvery - 0.6 * (this.wave - 1));
    if (this.diveTimer >= every) {
      this.diveTimer = 0;
      const choices = this.aliens.filter((a) => a.alive && !a.dive);
      if (choices.length > 1) {
        const alien = choices[Math.floor(this.random() * choices.length)];
        alien.dive = { phase: "down", t: 0, startX: alien.x, startY: alien.y, targetX: this.ship.x - alien.w / 2 };
        this.events.push({ type: "dive", x: alien.x + alien.w / 2, y: alien.y });
      }
    }

    for (const alien of this.aliens) {
      if (!alien.alive || !alien.dive) continue;
      const dive = alien.dive;
      dive.t += dt;
      if (dive.phase === "down") {
        alien.y += speed * dt;
        // Swoop towards where you were, wobbling on the way
        const progress = clamp((alien.y - dive.startY) / (SETTINGS.shipY - dive.startY), 0, 1);
        alien.x = dive.startX + (dive.targetX - dive.startX) * progress + Math.sin(dive.t * 4) * 50 * (1 - progress);
        alien.x = clamp(alien.x, 0, SETTINGS.width - alien.w);
        if (alien.y > SETTINGS.height + 40) {
          // Fell off the bottom: come back in from the top and fly home
          alien.y = -40;
          dive.phase = "home";
        }
      } else {
        const dx = this.slotX(alien) - alien.x;
        const dy = this.slotY(alien) - alien.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= speed * dt) {
          alien.dive = null;
          alien.x = this.slotX(alien);
          alien.y = this.slotY(alien);
        } else {
          alien.x += (dx / distance) * speed * dt;
          alien.y += (dy / distance) * speed * dt;
        }
      }

      if (alien.dive && !this.invulnerable() && overlaps(alien, this.shipBox())) {
        alien.alive = false;
        this.events.push({ type: "rammed", x: alien.x + alien.w / 2, y: alien.y + alien.h / 2 });
        this.hitShip("Rammed by a dive bomber. Rude.");
        if (this.over) return;
      }
    }
  }

  enemyFire(dt) {
    let rate = SETTINGS.enemyFireRate + SETTINGS.fireRatePerWave * (this.wave - 1);
    if (this.speedUpLeft() > 0) rate *= 1.5;
    if (this.slowLeft() > 0) rate *= 0.6;
    this.fireTimer += dt * rate;
    if (this.fireTimer < 1) return;
    this.fireTimer = 0;
    if (this.enemyBullets.length >= SETTINGS.maxEnemyBullets) return;

    // Only the alien at the bottom of each column can shoot (plus anyone diving)
    const shooters = [];
    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      if (alien.dive) {
        if (alien.dive.phase === "down") shooters.push(alien);
        continue;
      }
      const below = this.aliens.some((other) => other.alive && !other.dive && other.col === alien.col && other.row > alien.row);
      if (!below) shooters.push(alien);
    }
    if (!shooters.length) return;
    const shooter = shooters[Math.floor(this.random() * shooters.length)];
    const speed = SETTINGS.enemyBulletSpeed * (1 + 0.06 * (this.wave - 1)) * (this.slowLeft() > 0 ? 0.6 : 1);
    this.enemyBullets.push({ x: shooter.x + shooter.w / 2, y: shooter.y + shooter.h, vy: speed });
  }

  // ---- Bullets ----

  moveBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      const box = { x: bullet.x - SETTINGS.bulletWidth / 2, y: bullet.y, w: SETTINGS.bulletWidth, h: SETTINGS.bulletHeight };

      for (const alien of this.aliens) {
        if (!alien.alive || bullet.gone || bullet.dodgedBy.has(alien) || !overlaps(box, alien)) continue;
        // While they can dodge, half your shots get sidestepped
        if (this.dodgeLeft() > 0 && this.random() < SETTINGS.dodgeChance) {
          bullet.dodgedBy.add(alien);
          this.events.push({ type: "dodge", x: alien.x + alien.w / 2, y: alien.y + alien.h / 2 });
          continue;
        }
        this.killAlien(alien);
        bullet.hits += 1;
        if (!bullet.pierce) bullet.gone = true;
      }

      if (!bullet.gone && this.boss && overlaps(box, this.bossBox())) {
        this.hitBoss();
        bullet.hits += 1;
        if (!bullet.pierce) bullet.gone = true;
      }

      if (!bullet.gone && (bullet.y < -20 || bullet.x < -20 || bullet.x > SETTINGS.width + 20)) {
        bullet.gone = true;
        if (bullet.hits === 0) {
          this.combo = 0;
          // Boomerang bullets come straight back down at you
          if (this.boomerangLeft() > 0 && bullet.y < 0) {
            this.enemyBullets.push({ x: clamp(bullet.x, 4, SETTINGS.width - 4), y: 0, vy: 420, boomerang: true });
            this.events.push({ type: "boomerang", x: bullet.x });
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.gone);

    for (const bullet of this.enemyBullets) {
      bullet.y += bullet.vy * dt;
      if (bullet.y > SETTINGS.height + 20) {
        bullet.gone = true;
      } else if (overlaps({ x: bullet.x - 3, y: bullet.y, w: 6, h: 12 }, this.shipBox())) {
        bullet.gone = true;
        this.hitShip(bullet.boomerang ? "Shot by your own boomerang. Iconic." : "Shot down. They aim better than you.");
        if (this.over) return;
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.gone);
  }

  multiplier() {
    if (this.classic) return 1;
    return Math.min(SETTINGS.maxMultiplier, 1 + Math.floor(this.combo / SETTINGS.comboStep));
  }

  killAlien(alien) {
    alien.alive = false;
    this.kills += 1;
    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const diving = Boolean(alien.dive);
    const multiplier = this.multiplier();
    const points = alien.points * (diving ? 2 : 1) * multiplier;
    this.score += points;
    const x = alien.x + alien.w / 2;
    const y = alien.y + alien.h / 2;
    this.events.push({ type: "kill", x, y, alienType: alien.type, points, multiplier, diving, combo: this.combo });
    if (!this.classic && this.random() < SETTINGS.dropChance) {
      this.capsules.push({ x, y, kind: this.random() < 0.5 ? "good" : "bad" });
    }
  }

  hitShip(reason) {
    if (this.time < this.invulnerableUntil) return;
    if (this.shield) {
      this.shield = false;
      this.invulnerableUntil = this.time + 0.6;
      this.events.push({ type: "shieldBlock", x: this.ship.x });
      return;
    }
    this.lives -= 1;
    this.combo = 0;
    this.events.push({ type: "lostLife", x: this.ship.x, lives: this.lives });
    if (this.lives <= 0) {
      this.end(reason);
      return;
    }
    this.invulnerableUntil = this.time + SETTINGS.invulnerableTime;
    this.enemyBullets = [];
  }

  // ---- Capsules ----

  moveCapsules(dt) {
    const ship = this.shipBox();
    const grab = { x: ship.x - 10, y: ship.y - 10, w: ship.w + 20, h: ship.h + 20 };
    for (const capsule of this.capsules) {
      capsule.y += SETTINGS.capsuleSpeed * dt;
      if (overlaps({ x: capsule.x - 13, y: capsule.y - 7, w: 26, h: 14 }, grab)) {
        capsule.done = true;
        this.catchCapsule(capsule);
      } else if (capsule.y > SETTINGS.height + 10) {
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
    this.events.push({ type: "caught", name, kind: capsule.kind, x: this.ship.x, y: SETTINGS.shipY - 30,
      text: message.text, popup: message.popup });
  }

  applyCapsule(name) {
    const until = this.time + SETTINGS.effectTime;
    if (name === "spread") this.spreadUntil = until;
    if (name === "rapid") this.rapidUntil = until;
    if (name === "pierce") this.pierceUntil = until;
    if (name === "slow") this.slowUntil = until;
    if (name === "reversed") this.reversedUntil = until;
    if (name === "drunk") this.drunkUntil = until;
    if (name === "jammed") this.jammedUntil = until;
    if (name === "speedup") this.speedUpUntil = until;
    if (name === "boomerang") this.boomerangUntil = until;
    if (name === "fog") this.fogUntil = this.time + SETTINGS.fogTime;
    if (name === "dodge") this.dodgeUntil = this.time + SETTINGS.dodgeTime;
    if (name === "shield") this.shield = true;
    if (name === "life") {
      if (this.lives >= SETTINGS.maxLives) return { text: "Good: extra life, but you're maxed out. Greedy.", popup: "MAXED" };
      this.lives += 1;
    }
    return null;
  }

  // ---- The rainbow boss ----

  bossGap() {
    return this.time + SETTINGS.bossGapMin + this.random() * (SETTINGS.bossGapMax - SETTINGS.bossGapMin);
  }

  bossBox() {
    return { x: this.boss.x - 45, y: this.boss.y - 20, w: 90, h: 40 };
  }

  updateBoss(dt) {
    if (this.classic) return;
    if (!this.boss) {
      if (this.time >= this.nextBossAt) {
        const fromLeft = this.random() < 0.5;
        this.boss = { x: fromLeft ? -60 : SETTINGS.width + 60, baseY: 50, y: 50, vx: (fromLeft ? 1 : -1) * SETTINGS.bossSpeed,
          hp: SETTINGS.bossHp, t: 0 };
        this.events.push({ type: "boss", x: fromLeft ? 60 : SETTINGS.width - 60, y: 50 });
      }
      return;
    }
    const boss = this.boss;
    boss.t += dt;
    boss.x += boss.vx * dt;
    boss.y = boss.baseY + Math.sin(boss.t * 3) * 8;
    if (boss.x < -80 || boss.x > SETTINGS.width + 80) {
      this.boss = null;
      this.nextBossAt = this.bossGap();
      this.events.push({ type: "bossGone" });
    }
  }

  hitBoss() {
    const boss = this.boss;
    boss.hp -= 1;
    if (boss.hp > 0) {
      this.events.push({ type: "bossHit", x: boss.x, y: boss.y, hp: boss.hp });
      return;
    }
    const multiplier = this.multiplier();
    const points = SETTINGS.bossPoints * multiplier;
    this.score += points;
    this.events.push({ type: "bossKill", x: boss.x, y: boss.y, points });
    this.boss = null;
    this.nextBossAt = this.bossGap();
  }

  // ---- Helpers ----

  timeLeft(until) {
    return Math.max(0, until - this.time);
  }

  spreadLeft() { return this.timeLeft(this.spreadUntil); }
  rapidLeft() { return this.timeLeft(this.rapidUntil); }
  pierceLeft() { return this.timeLeft(this.pierceUntil); }
  slowLeft() { return this.timeLeft(this.slowUntil); }
  reversedLeft() { return this.timeLeft(this.reversedUntil); }
  drunkLeft() { return this.timeLeft(this.drunkUntil); }
  jammedLeft() { return this.timeLeft(this.jammedUntil); }
  fogLeft() { return this.timeLeft(this.fogUntil); }
  speedUpLeft() { return this.timeLeft(this.speedUpUntil); }
  boomerangLeft() { return this.timeLeft(this.boomerangUntil); }
  dodgeLeft() { return this.timeLeft(this.dodgeUntil); }
  invulnerable() { return this.time < this.invulnerableUntil; }

  swarmBottom() {
    return Math.max(0, ...this.aliens.filter((a) => a.alive && !a.dive).map((a) => a.y + a.h));
  }

  end(reason) {
    this.over = reason;
    this.events.push({ type: "over", reason });
  }
}

// Lets the tests load this file in Node; browsers just ignore it
if (typeof module !== "undefined") {
  module.exports = { SwarmGame, SETTINGS, CAPSULES, ALIEN_TYPES };
}
