// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { SnakeGame, SETTINGS } = require("./logic.js");

function run(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds; t += step) game.update(step);
}
const len = (g) => g.segments.length;

// Moves on a timer, stops at the wall
let g = new SnakeGame(10, 10);
g.foods = [];  // keep food out of the way
g.update(0.001); assert.deepStrictEqual(g.segments[0], { x: 6, y: 5 });
run(g, 0.19); assert.deepStrictEqual(g.segments[0], { x: 6, y: 5 }, "moved too early");
run(g, 0.02); assert.deepStrictEqual(g.segments[0], { x: 7, y: 5 });
run(g, 2); assert.strictEqual(g.over, "You crashed!"); assert.strictEqual(g.segments[0].x, 9, "head left the board");
console.log("movement + wall OK");

// Two quick presses can't reverse the snake
g = new SnakeGame(20, 20); g.foods = [];
g.press("up"); g.press("left"); g.step();
assert.strictEqual(g.heading, "up"); assert.strictEqual(g.over, null);
console.log("no reversing into yourself OK");

// Self collision
g = new SnakeGame(20, 20); g.foods = []; g.grow(3); g.step(); g.step(); g.step();
for (const d of ["up", "left", "down"]) { g.press(d); g.step(); }
assert.strictEqual(g.over, "You crashed!");
console.log("self collision OK");

// Hunger: 30 / length seconds per segment, and starving at length 1
g = new SnakeGame(30, 30); g.foods = []; g.nextMoveAt = 1e9;   // freeze movement
g.update(9.9); assert.strictEqual(len(g), 3);
g.update(0.2); assert.strictEqual(len(g), 2);
assert.ok(g.events.some((e) => e.type === "lost"));
g.update(15.1); assert.strictEqual(len(g), 1);
g.update(29.9); assert.strictEqual(g.over, null);
g.update(0.2); assert.strictEqual(g.over, "Your snake starved to death!"); assert.strictEqual(len(g), 0);
console.log("hunger + starving OK");

// Bad shrink apple never goes below 2
for (const [start, expected] of [[1, 1], [2, 2], [3, 2], [4, 2], [5, 2], [6, 3], [9, 6]]) {
  g = new SnakeGame(30, 30); g.foods = [];
  if (start < 3) g.segments.length = start; else g.grow(start - 3);
  let i = 0; const seq = [0.3];   // pick "shrink" from the 4 bad effects
  g.random = () => seq[i++ % seq.length];
  const r = g.applyFood("bad");
  assert.strictEqual(len(g), expected, `start ${start}`); assert.strictEqual(g.over, null);
}
console.log("bad apple floor OK");

// Speed changes and limits
g = new SnakeGame(30, 30);
g.applyFood("normal"); assert.ok(Math.abs(g.speed - 1.05) < 1e-9); assert.strictEqual(len(g), 4);
for (let i = 0; i < 50; i++) g.changeSpeed(20);
assert.ok(Math.abs(g.delay() - 0.05) < 1e-9);
for (let i = 0; i < 80; i++) g.changeSpeed(-10);
assert.ok(Math.abs(g.delay() - 0.4) < 1e-9);
console.log("speed OK");

// Reversed and drunk controls, and they wear off after 10s of game time
g = new SnakeGame(30, 30); g.foods = []; g.nextMoveAt = 1e9;
g.reversedUntil = g.time + SETTINGS.effectTime;
g.press("up"); g.step(); assert.strictEqual(g.heading, "down");
g.update(10.1); g.press("left"); g.step(); assert.strictEqual(g.heading, "left");
g.drunkUntil = g.time + SETTINGS.effectTime;
g.press("up"); g.update(0.3); g.step(); assert.strictEqual(g.heading, "left", "drunk turn too early");
g.update(0.3); g.step(); assert.strictEqual(g.heading, "up");
console.log("reversed + drunk OK");

// Eating: score, respawn, event
g = new SnakeGame(30, 30);
g.foods[0] = { x: g.segments[0].x + 1, y: g.segments[0].y, type: "normal" };
g.step();
assert.strictEqual(g.score, 1); assert.strictEqual(g.foods.length, 3);
assert.ok(g.events.some((e) => e.type === "ate" && e.popup === "+1"));
console.log("eating OK");

// Food never spawns on the snake or other food; types are roughly even
g = new SnakeGame(15, 15); g.grow(40);
const counts = { normal: 0, benefit: 0, bad: 0 };
for (let i = 0; i < 3000; i++) {
  const k = i % 3; g.foods[k] = null; g.foods[k] = g.newFood(); counts[g.foods[k].type]++;
  const spots = new Set(g.foods.map((f) => f.x + "," + f.y));
  assert.strictEqual(spots.size, 3);
  for (const f of g.foods) assert.ok(!g.segments.some((s) => s.x === f.x && s.y === f.y));
}
console.log("food placement OK", counts);

// A completely full board doesn't hang
g = new SnakeGame(12, 12); g.foods = []; g.segments = []; for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) g.segments.push({ x, y });
assert.strictEqual(g.newFood(), null);
console.log("full board OK");
