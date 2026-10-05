// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { SnakeGame, SETTINGS, REASONS } = require("./logic.js");

function run(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) game.update(step);
}
const len = (g) => g.segments.length;
// A game with nothing else on the board, so a test only sees what it sets up
function emptyGame(cols = 30, rows = 30) {
  const g = new SnakeGame(cols, rows);
  g.foods = [];
  g.nextJackpotAt = 1e9;
  return g;
}
// Makes the next random picks come out as the given list indexes (out of `of` choices)
function rig(g, ...picks) {
  const values = picks.map(([index, of]) => (index + 0.5) / of);
  g.random = () => (values.length ? values.shift() : 0.5);
}
const BENEFITS = 4;
const BADS = 7;

// Moves on a timer, stops at the wall
let g = emptyGame(10, 10);
g.update(0.001); assert.deepStrictEqual(g.segments[0], { x: 6, y: 5 });
run(g, 0.19); assert.deepStrictEqual(g.segments[0], { x: 6, y: 5 }, "moved too early");
run(g, 0.02); assert.deepStrictEqual(g.segments[0], { x: 7, y: 5 });
run(g, 2); assert.strictEqual(g.over, REASONS.wall); assert.strictEqual(g.segments[0].x, 9, "head left the board");
console.log("movement + wall OK");

// Two quick presses can't reverse the snake
g = emptyGame(); g.press("up"); g.press("left"); g.step();
assert.strictEqual(g.heading, "up"); assert.strictEqual(g.over, null);
console.log("no reversing into yourself OK");

// Self collision, and moving into the cell the tail is leaving is fine
g = emptyGame(); g.grow(3); g.step(); g.step(); g.step();
for (const d of ["up", "left", "down"]) { g.press(d); g.step(); }
assert.strictEqual(g.over, REASONS.body);
g = emptyGame(); g.grow(1); g.step();            // a 4-long snake can chase its own tail in a square
for (const d of ["up", "left", "down", "right"]) { g.press(d); g.step(); }
assert.strictEqual(g.over, null);
console.log("self collision OK");

// Hunger: 30 / length seconds per segment, and starving at length 1
g = emptyGame(); g.nextMoveAt = 1e9;
g.update(9.9); assert.strictEqual(len(g), 3);
g.update(0.2); assert.strictEqual(len(g), 2);
assert.ok(g.events.some((e) => e.type === "lost"));
g.update(15.1); assert.strictEqual(len(g), 1);
g.update(29.9); assert.strictEqual(g.over, null);
g.update(0.2); assert.strictEqual(g.over, REASONS.starved); assert.strictEqual(len(g), 0);
console.log("hunger + starving OK");

// Normal apple
g = emptyGame(); g.applyFood("normal", g.segments[0]);
assert.ok(Math.abs(g.speed - 1.05) < 1e-9); assert.strictEqual(len(g), 4);
console.log("normal apple OK");

// Benefit apple: each of the 4 options
g = emptyGame(); rig(g, [0, BENEFITS]); let r = g.applyFood("benefit", g.segments[0]);
assert.strictEqual(len(g), 4); assert.ok(Math.abs(g.speed - 0.9) < 1e-9); assert.strictEqual(r.popup, "SLOWER");
g = emptyGame(); rig(g, [1, BENEFITS]); r = g.applyFood("benefit", g.segments[0]);
assert.strictEqual(len(g), 5); assert.strictEqual(g.speed, 1);
g = emptyGame(); rig(g, [2, BENEFITS]); r = g.applyFood("benefit", g.segments[0]);
assert.strictEqual(g.shield, true); assert.strictEqual(r.popup, "SHIELD!"); assert.strictEqual(len(g), 4);
g = emptyGame(); rig(g, [3, BENEFITS]); r = g.applyFood("benefit", g.segments[0]);
assert.strictEqual(g.ghostLeft(), SETTINGS.effectTime); assert.strictEqual(len(g), 4);
console.log("benefit apple (4 options) OK");

// Shield: forgives one crash, waits, then the next crash is real
g = emptyGame(10, 10); g.shield = true;
g.segments = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }];
g.step();
assert.strictEqual(g.over, null); assert.strictEqual(g.shield, false);
assert.deepStrictEqual(g.segments[0], { x: 9, y: 5 }, "snake should stay put");
assert.ok(g.events.some((e) => e.type === "saved"));
assert.ok(Math.abs(g.nextMoveAt - (g.time + SETTINGS.shieldPause)) < 1e-9);
g.step(); assert.strictEqual(g.over, REASONS.wall);
g = emptyGame(); g.shield = true; g.rocks.push({ x: g.segments[0].x + 1, y: g.segments[0].y });
g.step(); assert.strictEqual(g.over, null, "shield should cover rocks too");
console.log("shield OK");

// Ghost: wraps around the edges, but walls are deadly again once it wears off
g = emptyGame(10, 10); g.ghostUntil = 100;
g.segments = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }];
g.step(); assert.deepStrictEqual(g.segments[0], { x: 0, y: 5 }); assert.strictEqual(g.over, null);
g.segments = [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }]; g.heading = g.lastHeading = "up";
g.step(); assert.deepStrictEqual(g.segments[0], { x: 4, y: 9 }, "should wrap top to bottom");
g.ghostUntil = 0; g.segments = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }]; g.heading = g.lastHeading = "right";
g.step(); assert.strictEqual(g.over, REASONS.wall);
console.log("ghost OK");

// Bad apple: each of the 7 options
const badResults = [];
for (let i = 0; i < BADS; i++) {
  g = emptyGame(); g.grow(5); rig(g, [i, BADS]);
  const head = { ...g.segments[0] };
  badResults.push(g.applyFood("bad", head).popup);
  if (i === 0) assert.ok(Math.abs(g.speed - 1.2) < 1e-9);
  // Every bad apple grows you by 1, apart from the one that shrinks you
  assert.strictEqual(len(g), i === 1 ? 5 : 9, `bad option ${i} length`);
  if (i === 2) assert.strictEqual(g.reversedLeft(), 10);
  if (i === 3) assert.strictEqual(g.drunkLeft(), 10);
  if (i === 4) assert.deepStrictEqual(g.rocks, [head]);
  if (i === 5) assert.strictEqual(g.fogLeft(), SETTINGS.fogTime);
  if (i === 6) assert.strictEqual(g.runawayLeft(), 10);
}
assert.deepStrictEqual(badResults, ["FASTER!", "-3", "REVERSED!", "DRUNK!", "ROCK!", "FOG!", "RUNAWAY!"]);
console.log("bad apple (7 options) OK");

// Bad shrink apple never goes below 2
for (const [start, expected] of [[1, 1], [2, 2], [3, 2], [4, 2], [5, 2], [6, 3], [9, 6]]) {
  g = emptyGame();
  if (start < 3) g.segments.length = start; else g.grow(start - 3);
  rig(g, [1, BADS]);
  g.applyFood("bad", g.segments[0]);
  assert.strictEqual(len(g), expected, `start ${start}`); assert.strictEqual(g.over, null);
}
console.log("bad apple shrink floor OK");

// Rocks: hitting one ends the game, and nothing spawns on them
g = emptyGame(); g.rocks.push({ x: g.segments[0].x + 1, y: g.segments[0].y });
g.step(); assert.strictEqual(g.over, REASONS.rock);
g = emptyGame(6, 6); g.segments = [{ x: 3, y: 3 }];
for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) {
  if (!(x === 0 && y === 0) && !(x === 3 && y === 3)) g.rocks.push({ x, y });
}
const onlyFree = g.newFood();
assert.deepStrictEqual([onlyFree.x, onlyFree.y], [0, 0]);
console.log("rocks OK");

// The rock is left where the apple was eaten, and the snake carries on safely
g = emptyGame(); rig(g, [4, BADS]);
g.foods = [{ x: g.segments[0].x + 1, y: g.segments[0].y, type: "bad" }];
g.step();
assert.deepStrictEqual(g.rocks[0], g.segments[0]);
g.step(); g.step();
assert.strictEqual(g.over, null, "the rock under your head shouldn't kill you");
console.log("rock placement OK");

// Runaway: apples move away from the head, stay on the board, and never overlap
g = emptyGame(20, 20); g.nextMoveAt = 1e9;
g.segments = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
g.foods = [{ x: 12, y: 10, type: "normal" }, { x: 10, y: 13, type: "bad" }, { x: 19, y: 19, type: "benefit" }];
g.runawayUntil = 100; g.nextRunawayAt = 0;
const before = g.foods.map((f) => (f.x - 10) ** 2 + (f.y - 10) ** 2);
g.update(0.01);
g.foods.forEach((f, i) => {
  assert.ok((f.x - 10) ** 2 + (f.y - 10) ** 2 > before[i] || i === 2, "apple should have moved away");
  assert.ok(f.x >= 0 && f.x < 20 && f.y >= 0 && f.y < 20);
});
assert.deepStrictEqual(g.foods[2], { x: 19, y: 19, type: "benefit" }, "a cornered apple stays put");
run(g, 3);
assert.strictEqual(new Set(g.foods.map((f) => f.x + "," + f.y)).size, 3);
g.runawayUntil = 0; const frozen = JSON.stringify(g.foods); run(g, 1);
assert.strictEqual(JSON.stringify(g.foods), frozen, "apples should stop once runaway wears off");
console.log("runaway OK");

// Combo: within 3 seconds builds x2, x3 ... up to x5, then resets after a gap
g = emptyGame();
const gains = [];
for (let i = 0; i < 7; i++) { const s = g.score; g.addPoints(1); gains.push(g.score - s); g.time += 2; }
assert.deepStrictEqual(gains, [1, 2, 3, 4, 5, 5, 5]);
g.time += 3.1; g.addPoints(1); assert.strictEqual(g.combo, 1);
assert.strictEqual(g.comboLeft(), 0, "no combo timer for a x1");
console.log("combo OK");

// Jackpot: appears after 20-40s, lasts 5s, worth 5 points times the combo
g = new SnakeGame(30, 30); g.foods = []; g.nextMoveAt = 1e9;
assert.ok(g.nextJackpotAt >= 20 && g.nextJackpotAt <= 40);
g.update(g.nextJackpotAt + 0.01);
assert.ok(g.jackpot, "jackpot should have appeared");
assert.ok(g.events.some((e) => e.type === "jackpot"));
g.update(SETTINGS.jackpotTime + 0.01);
assert.strictEqual(g.jackpot, null, "jackpot should vanish after 5s");
assert.ok(g.nextJackpotAt - g.time >= 20 - 0.1);
g = emptyGame(); g.jackpot = { x: g.segments[0].x + 1, y: g.segments[0].y, until: 100 };
g.combo = 2; g.comboUntil = 1;
g.step();
assert.strictEqual(g.score, 15, "x3 combo times 5 points"); assert.strictEqual(g.eaten.jackpot, 1); assert.strictEqual(g.jackpot, null);
console.log("jackpot OK");

// Eating: score, breakdown counts, respawn, event
g = emptyGame(); g.foods = [{ x: g.segments[0].x + 1, y: g.segments[0].y, type: "normal" }];
g.step();
assert.strictEqual(g.score, 1); assert.strictEqual(g.eaten.normal, 1); assert.ok(g.foods[0]);
assert.ok(g.events.some((e) => e.type === "ate" && e.popup === "+1" && e.points === 1));
console.log("eating OK");

// Reversed and drunk controls, and they wear off
g = emptyGame(); g.nextMoveAt = 1e9;
g.reversedUntil = g.time + SETTINGS.effectTime;
g.press("up"); g.step(); assert.strictEqual(g.heading, "down");
g.update(10.1); g.press("left"); g.step(); assert.strictEqual(g.heading, "left");
g.drunkUntil = g.time + SETTINGS.effectTime;
g.press("up"); g.update(0.3); g.step(); assert.strictEqual(g.heading, "left", "drunk turn too early");
g.update(0.3); g.step(); assert.strictEqual(g.heading, "up");
console.log("reversed + drunk OK");

// Speed limits
g = emptyGame();
for (let i = 0; i < 50; i++) g.changeSpeed(20);
assert.ok(Math.abs(g.delay() - 0.05) < 1e-9);
for (let i = 0; i < 80; i++) g.changeSpeed(-10);
assert.ok(Math.abs(g.delay() - 0.4) < 1e-9);
console.log("speed OK");

// Food never spawns on the snake or other food; types are roughly even
g = emptyGame(15, 15); g.grow(40);
g.foods = [null, null, null]; for (let k = 0; k < 3; k++) g.foods[k] = g.newFood();
const counts = { normal: 0, benefit: 0, bad: 0 };
for (let i = 0; i < 3000; i++) {
  const k = i % 3; g.foods[k] = null; g.foods[k] = g.newFood(); counts[g.foods[k].type]++;
  assert.strictEqual(new Set(g.foods.map((f) => f.x + "," + f.y)).size, 3);
  for (const f of g.foods) assert.ok(!g.segments.some((s) => s.x === f.x && s.y === f.y));
}
console.log("food placement OK", counts);

// Lots of long random games never throw
let endings = {};
for (let seed = 0; seed < 40; seed++) {
  g = new SnakeGame(18, 28);
  const dirs = ["up", "down", "left", "right"];
  for (let i = 0; i < 6000 && !g.over; i++) {
    if (i % 5 === 0) g.press(dirs[Math.floor(Math.random() * 4)]);
    g.update(1 / 30);
  }
  endings[g.over || "still going"] = (endings[g.over || "still going"] || 0) + 1;
}
console.log("random games OK", endings);

// Classic mode: one apple, always normal, +1 point, a little faster, no hunger or rainbow apple
g = new SnakeGame(30, 30, { classic: true });
assert.strictEqual(g.foods.length, 1); assert.strictEqual(g.nextJackpotAt, Infinity);
g.foods[0] = { x: g.segments[0].x + 1, y: g.segments[0].y, type: "normal" };
g.step();
assert.strictEqual(g.score, 1); assert.strictEqual(len(g), 4); assert.ok(Math.abs(g.speed - 1.03) < 1e-9);
assert.strictEqual(g.foods.length, 1); assert.strictEqual(g.foods[0].type, "normal");
g.foods[0] = { x: g.segments[0].x + 1, y: g.segments[0].y, type: "normal" };
g.step(); assert.strictEqual(g.score, 2, "no combos in classic"); assert.strictEqual(g.comboLeft(), 0);
g.nextMoveAt = 1e9; g.update(300);
assert.strictEqual(len(g), 5, "no shrinking in classic"); assert.strictEqual(g.over, null); assert.strictEqual(g.jackpot, null);
for (let i = 0; i < 200; i++) { g.foods[0] = null; g.foods[0] = g.newFood(); assert.strictEqual(g.foods[0].type, "normal"); }
console.log("classic mode OK");

// A completely full board doesn't hang
g = emptyGame(12, 12); g.segments = [];
for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) g.segments.push({ x, y });
assert.strictEqual(g.newFood(), null);
g.nextJackpotAt = 0; g.updateJackpot(); assert.strictEqual(g.jackpot, null);
console.log("full board OK");
