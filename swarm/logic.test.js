// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { SwarmGame, SETTINGS, CAPSULES } = require("./logic.js");

const close = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
function run(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds && !game.over; t += step) game.update(step);
}
// A calm game: nothing shoots, dives or marches unless a test turns it on
function calmGame(options = {}) {
  const g = new SwarmGame(options);
  g.enemyFire = () => {};
  g.diveTimer = -1e9;
  g.stepTimer = -1e9;
  g.nextBossAt = 1e9;
  return g;
}
function onlyAlien(g, x, y, extra = {}) {
  // The target sits in the formation, which is moved so its slot is at (x, y)
  g.formation.x = x;
  g.formation.y = y;
  g.aliens = [{ col: 0, row: 0, type: "goober", points: 10, alive: true, dive: null, x, y,
    w: SETTINGS.alienWidth, h: SETTINGS.alienHeight, ...extra }];
  // a far-away second alien keeps the wave from counting as cleared
  g.aliens.push({ col: 7, row: 0, type: "goober", points: 10, alive: true, dive: { phase: "parked" }, x: -500, y: -500,
    w: SETTINGS.alienWidth, h: SETTINGS.alienHeight });
  g.moveDivers = () => {};
  return g.aliens[0];
}

// Waves
let g = new SwarmGame();
assert.strictEqual(g.aliens.length, 32, "wave 1 is 4 rows of 8");
assert.ok(g.aliens.every((a) => a.x >= 0 && a.x + a.w <= SETTINGS.width));
g.wave = 3; g.buildWave(); assert.strictEqual(g.aliens.length, 48, "rows cap at 6");
console.log("waves OK");

// Moving and firing
g = calmGame();
g.setInput({ right: true }); run(g, 0.5); assert.ok(g.ship.x > 300 + 200, "keys move the ship");
g.setInput({ targetX: 100 }); run(g, 0.5); assert.ok(Math.abs(g.ship.x - 100) < 1, "mouse moves the ship");
g.setInput({ targetX: -500 }); run(g, 0.5); assert.strictEqual(g.ship.x, SETTINGS.shipWidth / 2, "stays on the board");
g = calmGame(); g.setInput({ fire: true }); run(g, 1.0);
const shots = g.events.filter((e) => e.type === "shot").length;
assert.ok(shots >= 3 && shots <= 4, "fires about every 0.32s while held");
console.log("ship OK");

// The swarm marches, drops at the edge, and speeds up as it thins out
g = new SwarmGame(); g.enemyFire = () => {}; g.diveTimer = -1e9; g.nextBossAt = 1e9;
const startX = g.formation.x; run(g, 0.7); assert.strictEqual(g.formation.x, startX + SETTINGS.stepSize);
for (let i = 0; i < 200 && g.formation.dir === 1; i++) run(g, 0.1);
assert.strictEqual(g.formation.dir, -1, "turned around at the edge");
assert.strictEqual(g.formation.y, SETTINGS.formationTop + SETTINGS.dropSize, "dropped a row");
const fullInterval = g.stepInterval(); g.aliens.forEach((a, i) => { if (i) a.alive = false; });
assert.ok(g.stepInterval() < fullInterval / 5, "one alien left marches much faster");
console.log("marching OK");

// Landing ends the game
g = calmGame(); g.formation.y = SETTINGS.landingY; g.stepTimer = 0; g.update(0.01);
assert.ok(g.over && g.over.startsWith("The swarm landed"));
console.log("landing OK");

// Shooting an alien: points by row, combo multiplier, misses reset it
g = calmGame();
let alien = onlyAlien(g, 280, 400, { points: 30 });
g.ship.x = 300; g.fire(); run(g, 0.5);
assert.ok(!alien.alive, "hit"); assert.strictEqual(g.score, 30);
g = calmGame(); g.combo = 9; alien = onlyAlien(g, 280, 400); g.ship.x = 300; g.fire(); run(g, 0.5);
assert.strictEqual(g.score, 10 * 3, "10th kill in a row is x3");
g = calmGame(); g.combo = 9; onlyAlien(g, 0, 0, { alive: false }); g.ship.x = 300; g.fire(); run(g, 1.2);
assert.strictEqual(g.combo, 0, "a miss resets the combo");
g = calmGame({ classic: true }); g.combo = 9; onlyAlien(g, 280, 400); g.ship.x = 300; g.fire(); run(g, 0.5);
assert.strictEqual(g.score, 10, "no combos in classic");
console.log("shooting + combo OK");

// Diving aliens are worth double, and ramming you costs a life
g = calmGame(); alien = onlyAlien(g, 280, 400); alien.dive = { phase: "down" }; g.ship.x = 300; g.fire(); run(g, 0.5);
assert.strictEqual(g.score, 20, "divers are worth double");
g = calmGame(); g.diveTimer = 1e9; g.aliens.forEach((a, i) => { if (i > 1) a.alive = false; });
run(g, 0.02);
assert.ok(g.aliens.some((a) => a.dive), "someone dived");
g.ship.x = g.aliens.find((a) => a.dive).dive.targetX + SETTINGS.alienWidth / 2;
g.setInput({ targetX: g.ship.x });
run(g, 4);
assert.strictEqual(g.lives, 2, "the dive bomber rammed you");
console.log("divers OK");

// Divers that miss come back in from the top and rejoin the swarm
g = calmGame(); g.diveTimer = 1e9; g.ship.x = 30; g.setInput({ targetX: 30 });
run(g, 0.02); const diver = g.aliens.find((a) => a.dive); diver.dive.targetX = 500;
for (let i = 0; i < 600 && diver.dive; i++) g.update(1 / 60);
assert.strictEqual(diver.dive, null, "back in formation"); assert.ok(diver.alive);
close(diver.x, g.slotX(diver), "back in its slot");
console.log("dive and return OK");

// Enemy fire: only the bottom alien of a column shoots, and getting hit costs a life
g = new SwarmGame(); g.diveTimer = -1e9; g.stepTimer = -1e9; g.nextBossAt = 1e9;
g.fireTimer = 1; g.update(0.001);
const shot = g.enemyBullets[0];
const shooter = g.aliens.find((a) => Math.abs(a.x + a.w / 2 - shot.x) < 1e-6 && Math.abs(a.y + a.h - (shot.y - shot.vy * 0.001)) < 1);
assert.ok(shooter && shooter.row === 3, "the bottom row shoots");
g = calmGame(); g.enemyBullets.push({ x: g.ship.x, y: SETTINGS.shipY - 60, vy: 300 }); run(g, 0.5);
assert.strictEqual(g.lives, 2); assert.ok(g.invulnerable(), "a moment of safety after a hit");
g.enemyBullets.push({ x: g.ship.x, y: SETTINGS.shipY - 60, vy: 300 }); run(g, 0.5);
assert.strictEqual(g.lives, 2, "can't be hit while blinking");
g.lives = 1; g.invulnerableUntil = 0; g.enemyBullets.push({ x: g.ship.x, y: SETTINGS.shipY - 60, vy: 300 }); run(g, 0.5);
assert.ok(g.over && g.over.startsWith("Shot down"));
console.log("enemy fire + lives OK");

// Clearing a wave
g = calmGame(); g.aliens.forEach((a, i) => { if (i) a.alive = false; });
g.killAlien(g.aliens[0]); g.update(0.01);
assert.strictEqual(g.wave, 2); assert.strictEqual(g.aliens.length, 40); assert.ok(g.score >= 200 * 1);
assert.ok(g.events.some((e) => e.type === "wave" && e.wave === 2));
console.log("wave clear OK");

// Capsules: every one does what it says
function catchOne(name, setup) {
  const game = calmGame();
  if (setup) setup(game);
  game.pickCapsule = () => name;
  game.catchCapsule({ x: game.ship.x, y: SETTINGS.shipY, kind: CAPSULES[name].kind });
  return game;
}
g = catchOne("spread"); g.fire(); assert.strictEqual(g.bullets.length, 3, "spread fires three");
g = catchOne("pierce"); g.fire(); assert.ok(g.bullets[0].pierce);
g = catchOne("shield"); assert.ok(g.shield);
g.enemyBullets.push({ x: g.ship.x, y: SETTINGS.shipY - 60, vy: 300 }); run(g, 0.5);
assert.strictEqual(g.lives, 3, "shield takes the hit"); assert.ok(!g.shield);
g = catchOne("life"); assert.strictEqual(g.lives, 4);
g = catchOne("life", (x) => (x.lives = 5)); assert.strictEqual(g.lives, 5);
assert.strictEqual(g.events.find((e) => e.type === "caught").popup, "MAXED");
g = catchOne("slow"); const slowInterval = g.stepInterval(); g.slowUntil = 0;
assert.ok(slowInterval > g.stepInterval() * 1.7, "slow swarm");
g = catchOne("speedup"); assert.ok(g.stepInterval() < calmGame().stepInterval() * 0.6, "fast swarm");
function shotGap(game) {
  game.setInput({ fire: true }); run(game, 3); game.setInput({});
  return 3 / game.events.filter((e) => e.type === "shot").length;
}
const normalGap = shotGap(calmGame());
assert.ok(shotGap(catchOne("rapid")) < normalGap * 0.6, "rapid fire");
assert.ok(shotGap(catchOne("jammed")) > normalGap * 2, "jammed gun");
g = catchOne("fog"); close(g.fogLeft(), SETTINGS.fogTime, "fog");
for (const name of Object.keys(CAPSULES)) {
  const caught = catchOne(name).events.find((e) => e.type === "caught");
  assert.ok(caught && caught.text && caught.popup, `${name} has a message`);
}
console.log("capsule effects OK");

// Piercing shots go through a whole column
g = calmGame(); g.pierceUntil = 100; g.moveDivers = () => {};
g.aliens.forEach((a) => { if (a.col !== 3) a.alive = false; });
g.ship.x = g.slotX(g.aliens.find((a) => a.col === 3)) + SETTINGS.alienWidth / 2;
g.fire(); run(g, 1);
assert.ok(g.aliens.filter((a) => a.col === 3).every((a) => !a.alive) || g.wave === 2, "one shot, whole column");
console.log("pierce OK");

// Reversed and drunk
g = catchOne("reversed"); g.setInput({ targetX: 100 }); run(g, 0.5); assert.ok(g.ship.x > 450, "mirrored");
g.setInput({ left: true }); const before = g.ship.x; run(g, 0.1); assert.ok(g.ship.x > before, "left goes right");
g = calmGame(); g.drunkUntil = 100; g.setInput({ targetX: 300 }); run(g, 1);
g.setInput({ targetX: 100 }); run(g, 0.3); assert.ok(g.ship.x > 290, "drunk ship hasn't reacted yet");
run(g, 0.4); assert.ok(g.ship.x < 110, "reacted after the delay");
console.log("reversed + drunk OK");

// Boomerang: a miss comes back down at you
g = calmGame(); g.boomerangUntil = 100; onlyAlien(g, 0, 0, { alive: false }); g.ship.x = 300;
g.setInput({ targetX: 300 }); g.fire(); run(g, 1.0);
assert.ok(g.events.some((e) => e.type === "boomerang"), "it came back");
run(g, 2.5); assert.strictEqual(g.lives, 2, "and it hurt");
console.log("boomerang OK");

// Dodging: about half the shots get sidestepped
g = calmGame(); g.dodgeUntil = 1e9; let dodged = 0;
for (let i = 0; i < 400; i++) {
  g.bullets = []; g.capsules = []; g.spreadUntil = 0; g.pierceUntil = 0;
  alien = onlyAlien(g, 280, 400); g.nextShotAt = 0; g.ship.x = 300; g.fire(); run(g, 0.5);
  if (alien.alive) dodged++;
}
assert.ok(dodged > 150 && dodged < 250, `dodge rate ${dodged / 400}`);
console.log("dodge OK", (dodged / 400).toFixed(2));

// Capsules drop about 15% of the time, fall, and get caught by the ship
g = calmGame(); let drops = 0;
for (let i = 0; i < 4000; i++) { g.capsules = []; g.killAlien({ ...g.aliens[0], alive: true }); drops += g.capsules.length; }
assert.ok(drops > 480 && drops < 720, `drop rate ${drops / 4000}`);
g = calmGame({ classic: true }); g.killAlien({ ...g.aliens[0], alive: true }); assert.strictEqual(g.capsules.length, 0, "no capsules in classic");
g = calmGame(); g.pickCapsule = () => "spread"; g.capsules.push({ x: 300, y: 500, kind: "good" });
g.ship.x = 300; g.setInput({ targetX: 300 }); run(g, 2);
assert.ok(g.spreadLeft() > 0, "caught it"); assert.strictEqual(g.capsules.length, 0);
console.log("capsules OK", (drops / 4000).toFixed(3));

// The rainbow boss: shows up after 25-45s, takes 3 hits, worth 500
g = new SwarmGame(); assert.ok(g.nextBossAt >= 25 && g.nextBossAt <= 45);
g = calmGame(); g.nextBossAt = 0; g.update(0.01); assert.ok(g.boss, "boss appeared");
g.boss.vx = 0; g.boss.x = 300; g.boss.baseY = 50;
for (let i = 0; i < 3; i++) { g.ship.x = 300; g.nextShotAt = 0; g.fire(); run(g, 1); }
assert.strictEqual(g.boss, null); assert.ok(g.events.some((e) => e.type === "bossKill" && e.points >= 500));
g = calmGame({ classic: true }); g.nextBossAt = 0; g.update(0.01); assert.strictEqual(g.boss, null, "no boss in classic");
g = calmGame(); g.nextBossAt = 0; g.update(0.01); run(g, 6); assert.strictEqual(g.boss, null, "boss flies off");
console.log("boss OK");

// Long games with a computer player: nothing breaks and nothing leaves the board
const endings = {};
let bestWave = 0;
for (let seed = 0; seed < 25; seed++) {
  g = new SwarmGame({ classic: seed % 5 === 0 });
  for (let i = 0; i < 60 * 60 * 5 && !g.over; i++) {
    const target = g.aliens.filter((a) => a.alive).sort((a, b) => b.y - a.y)[0];
    const danger = g.enemyBullets.find((b) => Math.abs(b.x - g.ship.x) < 30 && b.y > 550);
    const aim = danger ? g.ship.x + (g.ship.x > 300 ? -80 : 80) : target ? target.x + target.w / 2 : 300;
    g.setInput({ targetX: aim + Math.sin(i / 50) * 10, fire: true });
    if (i % 1200 === 0) g.capsules.push({ x: g.ship.x, y: 700, kind: i % 2400 === 0 ? "good" : "bad" });
    g.update(1 / 60);
    for (const thing of [...g.bullets, ...g.enemyBullets, ...g.capsules]) {
      assert.ok(Number.isFinite(thing.x) && Number.isFinite(thing.y), "something's position broke");
    }
    for (const a of g.aliens) assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y), "alien position broke");
    assert.ok(g.ship.x >= SETTINGS.shipWidth / 2 && g.ship.x <= SETTINGS.width - SETTINGS.shipWidth / 2, "ship left the board");
    assert.ok(Number.isFinite(g.score));
  }
  bestWave = Math.max(bestWave, g.wave);
  endings[g.over || "still going"] = (endings[g.over || "still going"] || 0) + 1;
}
console.log("long games OK", { bestWave, endings });
