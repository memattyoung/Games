// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { RockGame, SETTINGS, ROCK_SIZES, CAPSULES, wrap, wrapDelta } = require("./logic.js");

const close = (a, b, why, within = 1e-6) => assert.ok(Math.abs(a - b) < within, `${why}: ${a} vs ${b}`);
function run(game, seconds, step = 1 / 60) {
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps && !game.over; i++) game.update(step);
}
// A game with no rocks, no UFO and nothing random happening
function emptyGame(options = {}) {
  const g = new RockGame(options);
  g.rocks = [];
  g.nextWaveAt = 1e9;
  g.nextUfoAt = 1e9;
  g.nextRainbowAt = 1e9;
  g.ship.invulnerableUntil = 0;
  return g;
}
function rockAt(g, size, x, y, vx = 0, vy = 0) {
  const rock = g.newRock(size, x, y);
  rock.vx = vx;
  rock.vy = vy;
  g.rocks.push(rock);
  return rock;
}
function catchOne(g, name) {
  g.pickCapsule = () => name;
  g.catchCapsule({ kind: CAPSULES[name].kind });
  return g.events.filter((e) => e.type === "caught").pop();
}

// Wrapping helpers
assert.strictEqual(wrap(-10, 800), 790); assert.strictEqual(wrap(810, 800), 10);
assert.strictEqual(wrapDelta(790, 800), -10); assert.strictEqual(wrapDelta(-790, 800), 10);
console.log("wrapping OK");

// Waves start with 4 big rocks, never on top of the ship
let g = new RockGame();
assert.strictEqual(g.rocks.length, 4); assert.ok(g.rocks.every((r) => r.size === "big"));
assert.ok(g.rocks.every((r) => g.distance(r, g.ship) >= SETTINGS.safeSpawnDistance));
console.log("first wave OK");

// Flying: turning, thrust, drag, top speed and wraparound
g = emptyGame();
g.setInput({ turn: 1 }); run(g, 0.5); close(g.ship.angle, -Math.PI / 2 + SETTINGS.turnSpeed * 0.5, "turned right", 0.05);
g = emptyGame(); g.setInput({ thrust: 1 }); run(g, 0.5);
assert.ok(g.ship.vy < -150, "thrust pushes forward (up)");
g.setInput({}); const fast = Math.hypot(g.ship.vx, g.ship.vy); run(g, 1);
assert.ok(Math.hypot(g.ship.vx, g.ship.vy) < fast * 0.6, "drag slows the ship down");
g = emptyGame(); g.setInput({ thrust: 1 }); run(g, 5);
assert.ok(Math.hypot(g.ship.vx, g.ship.vy) <= SETTINGS.maxSpeed + 1e-6, "top speed");
assert.ok(g.ship.y >= 0 && g.ship.y < 800, "wrapped around");
g = emptyGame(); g.ship.y = 5; g.ship.vy = -300; g.setInput({}); run(g, 0.1);
assert.ok(g.ship.y > 700, "flying off the top brings you back at the bottom");
console.log("flying OK");

// Joystick: the ship swings round to face where the stick points
g = emptyGame(); g.setInput({ aim: 0 }); run(g, 0.5); close(g.ship.angle, 0, "faces right", 0.01);
g.setInput({ aim: Math.PI / 2, thrust: 1 }); run(g, 0.6); assert.ok(g.ship.vy > 100, "pushes down");
console.log("joystick OK");

// Shooting: cooldown and the bullet limit
g = emptyGame(); g.setInput({ fire: true }); run(g, 0.21);
assert.strictEqual(g.bullets.length, 1, "one shot per 0.22s");
run(g, 3); assert.ok(g.bullets.length <= SETTINGS.maxBullets);
g = emptyGame(); g.setInput({ fire: true }); run(g, 0.05);
const b = g.bullets[0]; close(Math.hypot(b.vx, b.vy), SETTINGS.bulletSpeed, "bullet speed", 1);
run(g, 0.9); assert.ok(!g.bullets.includes(b), "bullets fizzle out");
console.log("shooting OK");

// Rocks split: big -> 2 medium -> 2 small -> gone, with the right points
g = emptyGame(); let rock = rockAt(g, "big", 400, 200);
g.destroyRock(rock, { split: true, drops: false }); g.rocks = g.rocks.filter((r) => !r.dead);
assert.deepStrictEqual(g.rocks.map((r) => r.size), ["medium", "medium"]); assert.strictEqual(g.score, 20);
g.destroyRock(g.rocks[0], { split: true, drops: false }); g.rocks = g.rocks.filter((r) => !r.dead);
assert.deepStrictEqual(g.rocks.map((r) => r.size).sort(), ["medium", "small", "small"]); assert.strictEqual(g.score, 70);
const small = g.rocks.find((r) => r.size === "small");
g.destroyRock(small, { split: true, drops: false }); g.rocks = g.rocks.filter((r) => !r.dead);
assert.strictEqual(g.rocks.length, 2); assert.strictEqual(g.score, 170);
console.log("splitting + points OK");

// A bullet actually hitting a rock
g = emptyGame(); rockAt(g, "big", 400, 250); g.setInput({ fire: true }); run(g, 0.2);
assert.ok(g.score === 20 && g.rocks.length === 2 && g.rocks.every((r) => r.size === "medium"), "shot the rock above the ship");
assert.strictEqual(g.stats.hits >= 1, true);
console.log("bullet hits OK");

// Clearing a wave brings a bigger one after a short wait
g = new RockGame(); g.nextUfoAt = 1e9; g.rocks = [];
run(g, 0.1); assert.ok(g.events.some((e) => e.type === "waveClear"));
run(g, SETTINGS.waveDelay + 0.1); assert.strictEqual(g.wave, 2); assert.strictEqual(g.rocks.length, 5);
console.log("waves OK");

// Crashing, respawning safely and running out of ships
g = emptyGame(); rockAt(g, "big", 400, 400); run(g, 0.05);
assert.ok(!g.ship.alive); assert.strictEqual(g.lives, 2); assert.strictEqual(g.deathCause, "rock");
run(g, 2); assert.ok(!g.ship.alive, "waits for the middle to clear");
g.rocks = []; run(g, 0.1); assert.ok(g.ship.alive, "respawned"); assert.ok(g.time < g.ship.invulnerableUntil, "safe for a moment");
rockAt(g, "small", 400, 400); run(g, 0.5); assert.ok(g.ship.alive, "invulnerable right after respawning");
g = emptyGame(); g.lives = 1; rockAt(g, "big", 400, 400); run(g, 0.05);
assert.strictEqual(g.over, null, "a moment to watch yourself explode"); run(g, SETTINGS.gameOverDelay + 0.1);
assert.strictEqual(g.over, "Out of ships. The last one hit a rock.");
console.log("lives + respawn OK");

// Extra life every 10,000 points
g = emptyGame(); g.addScore(9990); assert.strictEqual(g.lives, 3); g.addScore(20); assert.strictEqual(g.lives, 4);
g.addScore(25000); assert.strictEqual(g.lives, 6, "two more, capped at 6");
console.log("extra lives OK");

// Hyperspace: jumps somewhere random, has a cooldown, and sometimes blows you up
g = emptyGame(); g.random = () => 0.9; assert.ok(g.hyperspace()); close(g.ship.x, 720, "jumped");
assert.ok(!g.hyperspace(), "cooldown"); run(g, 1.3); g.random = () => 0.01; g.hyperspace();
assert.ok(!g.ship.alive); assert.strictEqual(g.deathCause, "hyper");
console.log("hyperspace OK");

// The UFO turns up, shoots at you, and can be shot down
g = emptyGame(); g.nextUfoAt = 0; run(g, 0.05); assert.ok(g.ufo, "UFO arrived");
g.ship.invulnerableUntil = 1e9; run(g, 3); assert.ok(g.events.some((e) => e.type === "ufoShot"));
g.ufo.x = 400; g.ufo.y = 300; g.ufo.vx = 0; g.ufo.vy = 0; g.ufo.nextTurnAt = 1e9; g.ufoBullets = [];
const before = g.score; g.ship.angle = -Math.PI / 2; g.setInput({ fire: true }); run(g, 0.6);
assert.strictEqual(g.ufo, null); assert.strictEqual(g.score - before, 300);
g = emptyGame(); g.ufoBullets.push({ x: 400, y: 400, vx: 0, vy: 0, life: 1 }); run(g, 0.05);
assert.strictEqual(g.deathCause, "ufo");
console.log("UFO OK");

// Capsules: about 15% of smashed rocks drop one in chaos mode, never in classic
g = emptyGame(); let drops = 0;
for (let i = 0; i < 4000; i++) { g.capsules = []; g.destroyRock(g.newRock("small", 100, 100), { split: false, drops: true }); drops += g.capsules.length; }
assert.ok(drops > 480 && drops < 720, `drop rate ${drops / 4000}`);
g = emptyGame({ classic: true });
for (let i = 0; i < 500; i++) g.destroyRock(g.newRock("small", 100, 100), { split: false, drops: true });
assert.strictEqual(g.capsules.length, 0);
g = emptyGame(); g.capsules.push({ x: 400, y: 400, vx: 0, vy: 0, until: 100, kind: "good" });
g.pickCapsule = () => "rapid"; run(g, 0.05); assert.ok(g.rapidLeft() > 0, "picked up by flying into it");
g.capsules.push({ x: 100, y: 100, vx: 0, vy: 0, until: g.time + 1, kind: "bad" }); run(g, 1.2);
assert.strictEqual(g.capsules.length, 0, "capsules don't hang around forever");
console.log("capsules OK", (drops / 4000).toFixed(3));

// Every capsule does what it says
g = emptyGame(); catchOne(g, "shield"); rockAt(g, "big", 400, 400); run(g, 0.05);
assert.ok(g.ship.alive, "shield takes the hit"); assert.strictEqual(g.shieldLeft(), 0, "used up");
g = emptyGame(); catchOne(g, "rapid"); g.setInput({ fire: true }); run(g, 0.5); assert.ok(g.bullets.length >= 6, "rapid fire");
g = emptyGame(); catchOne(g, "spread"); g.setInput({ fire: true }); run(g, 0.05); assert.strictEqual(g.bullets.length, 3, "spread shot");
g = emptyGame(); catchOne(g, "slow"); rock = rockAt(g, "big", 100, 100, 100, 0); run(g, 1);
close(rock.x, 100 + 100 * SETTINGS.slowScale, "slow rocks", 1);
g = emptyGame(); rockAt(g, "big", 450, 400); rockAt(g, "small", 300, 300); rockAt(g, "big", 100, 700);
const bomb = catchOne(g, "bomb"); assert.strictEqual(g.rocks.length, 1, "bomb cleared the nearby rocks"); assert.strictEqual(bomb.popup, "KABOOM!");
g = emptyGame(); assert.strictEqual(catchOne(g, "bomb").popup, "WASTED");
g = emptyGame(); catchOne(g, "life"); assert.strictEqual(g.lives, 4);
g = emptyGame(); g.lives = 6; assert.strictEqual(catchOne(g, "life").popup, "MAXED");
g = emptyGame(); catchOne(g, "fog"); close(g.fogLeft(), SETTINGS.fogTime, "fog");
g = emptyGame(); catchOne(g, "splits"); rock = rockAt(g, "big", 100, 100);
g.destroyRock(rock, { split: true, drops: false }); g.rocks = g.rocks.filter((r) => !r.dead);
assert.ok(g.rocks.length >= 3, "more pieces");
g = emptyGame(); catchOne(g, "slippery"); g.ship.vx = 200; run(g, 2); close(g.ship.vx, 200, "no drag at all", 1e-6);
g = emptyGame(); catchOne(g, "curvy"); g.setInput({ fire: true }); run(g, 0.05);
const curvy = g.bullets[0]; const startAngle = Math.atan2(curvy.vy, curvy.vx); g.setInput({}); run(g, 0.3);
assert.ok(Math.abs(angleOf(curvy) - startAngle) > 0.5, "curvy bullets bend");
function angleOf(bullet) { return Math.atan2(bullet.vy, bullet.vx); }
for (const name of Object.keys(CAPSULES)) {
  const caught = catchOne(emptyGame(), name);
  assert.ok(caught && caught.text && caught.popup, `${name} has a message`);
}
console.log("capsule effects OK");

// The black hole pulls you in, and its core is deadly (even with a shield)
g = emptyGame(); g.random = () => 0.05; catchOne(g, "gravity"); assert.ok(g.hole);
assert.ok(g.distance(g.hole, g.ship) >= 260, "starts away from you");
const d0 = g.distance(g.hole, g.ship); run(g, 1.5); assert.ok(g.distance(g.hole, g.ship) < d0, "pulled towards it");
g = emptyGame(); g.hole = { x: 400, y: 420, until: 100 }; g.shieldUntil = 100; run(g, 1);
assert.strictEqual(g.deathCause, "hole");
g = emptyGame(); g.hole = { x: 100, y: 100, until: 1 }; run(g, 1.1); assert.strictEqual(g.hole, null, "it goes away");
console.log("black hole OK");

// Reversed and drunk controls
g = emptyGame(); g.reversedUntil = 100; g.setInput({ turn: 1 }); run(g, 0.3);
assert.ok(g.ship.angle < -Math.PI / 2, "right turns left");
g = emptyGame(); g.reversedUntil = 100; g.setInput({ thrust: 1 }); run(g, 0.5); assert.ok(g.ship.vy > 100, "thrust goes backwards");
g = emptyGame(); g.reversedUntil = 100; g.setInput({ aim: 0 }); run(g, 1); close(Math.abs(g.ship.angle), Math.PI, "stick points you backwards", 0.02);
g = emptyGame(); g.drunkUntil = 100; g.setInput({ turn: 1 }); run(g, 0.4);
close(g.ship.angle, -Math.PI / 2, "hasn't reacted yet", 1e-9); run(g, 0.3);
assert.ok(g.ship.angle > -Math.PI / 2 + 0.2, "reacts half a second late");
console.log("reversed + drunk OK");

// Rainbow rock: shows up in chaos mode, worth 1000 and always drops a capsule
g = new RockGame(); g.nextUfoAt = 1e9; g.ship.invulnerableUntil = 1e9;
assert.ok(g.nextRainbowAt >= 25 && g.nextRainbowAt <= 45);
g.nextRainbowAt = 0; run(g, 0.05); const rainbow = g.rainbowRock; assert.ok(rainbow);
const s0 = g.score; g.destroyRock(rainbow, { split: true, drops: true });
assert.strictEqual(g.score - s0, 1000); assert.strictEqual(g.capsules.length, 1);
g = new RockGame({ classic: true }); g.nextRainbowAt = 0; run(g, 1); assert.strictEqual(g.rainbowRock, null, "not in classic");
console.log("rainbow rock OK");

// Long games with a computer pilot: nothing breaks, and everything stays on the board
const results = { waves: 0, endings: {} };
for (let seed = 0; seed < 30; seed++) {
  g = new RockGame({ classic: seed % 5 === 0 });
  for (let i = 0; i < 60 * 60 * 3 && !g.over; i++) {
    // Point at the nearest rock and blast away, with some random flying around
    const target = g.rocks.reduce((best, r) => (!best || g.distance(g.ship, r) < g.distance(g.ship, best) ? r : best), null);
    const aim = target ? Math.atan2(wrapDelta(target.y - g.ship.y, 800), wrapDelta(target.x - g.ship.x, 800)) : null;
    g.setInput({ aim, thrust: i % 200 < 30 ? 1 : 0, fire: true, turn: 0 });
    if (i % 700 === 0) g.hyperspace();
    if (i % 400 === 0) {
      const kind = i % 800 === 0 ? "good" : "bad";
      g.capsules.push({ x: g.ship.x, y: g.ship.y, vx: 0, vy: 0, until: g.time + 5, kind });
    }
    g.update(1 / 60);
    const things = [g.ship, ...g.rocks, ...g.bullets, ...g.ufoBullets, ...g.capsules];
    for (const thing of things) {
      assert.ok(Number.isFinite(thing.x) && Number.isFinite(thing.y), "position broke");
      assert.ok(thing.x >= 0 && thing.x < 800 && thing.y >= 0 && thing.y < 800, "left the board");
    }
    assert.ok(g.rocks.length <= SETTINGS.maxRocks + 4, "too many rocks");
    assert.ok(Number.isFinite(g.score));
  }
  results.waves = Math.max(results.waves, g.wave);
  results.endings[g.over || "still going"] = (results.endings[g.over || "still going"] || 0) + 1;
}
console.log("long games OK", results);
