// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { CrossingGame, SETTINGS, PICKUPS, ENDINGS, RIVER_ROWS, ROAD_ROWS } = require("./logic.js");

const close = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
function run(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds && !game.over; t += step) game.update(step);
}
// A game with empty lanes and nothing random going on, so a test only sees what it sets up
function quietGame(options = {}) {
  const g = new CrossingGame(options);
  for (const lane of g.lanes) lane.objects = [];
  g.nextPickupAt = 1e9;
  g.nextEventAt = 1e9;
  return g;
}
function hop(g, dir) {
  g.press(dir);
  g.nextHopAt = 0;
  g.update(0.001);
}
function logUnderPip(g, row) {
  // A long, slow-ish log right where Pip is
  const lane = g.lane(row);
  lane.objects = [{ x: g.hero.cx - 2, len: 4, kind: "log", color: 0, phase: 0 }];
  return lane;
}

// The board
let g = new CrossingGame();
assert.strictEqual(g.lanes.length, 10);
assert.deepStrictEqual(g.hero.row, SETTINGS.startRow);
assert.strictEqual(g.homes.length, 5);
for (const lane of g.lanes) assert.ok(lane.objects.length >= 2, `lane ${lane.row} has things in it`);
console.log("board OK");

// Hopping, rows and points
g = quietGame();
hop(g, "up"); assert.strictEqual(g.hero.row, 11); assert.strictEqual(g.score, 10);
hop(g, "down"); hop(g, "up"); assert.strictEqual(g.score, 10, "no points for a row you've already reached");
const startX = g.hero.cx; hop(g, "left"); close(g.hero.cx, startX - 1, "left");
for (let i = 0; i < 20; i++) hop(g, "left");
close(g.hero.cx, 0.5, "can't hop off the side");
g.hero.row = 12; hop(g, "down"); assert.strictEqual(g.hero.row, 12, "can't hop off the bottom");
console.log("hopping OK");

// Hops have a short cooldown
g = quietGame(); g.press("up"); g.press("up"); g.update(0.001);
assert.strictEqual(g.hero.row, 11); g.update(0.15); assert.strictEqual(g.hero.row, 10);
console.log("hop cooldown OK");

// Cars splat Pip; lives run out
g = quietGame();
g.lane(11).objects = [{ x: g.hero.cx - 0.5, len: 1, kind: "car", color: 0, phase: 0 }];
hop(g, "up");
assert.ok(g.hero.dead); assert.strictEqual(g.lives, 2);
assert.ok(g.events.some((e) => e.type === "splat" && e.cause === "car"));
run(g, 1); assert.ok(!g.hero.dead); assert.strictEqual(g.hero.row, SETTINGS.startRow, "back at the start");
g.lives = 1; g.lane(11).objects = [{ x: g.hero.cx - 0.5, len: 1, kind: "car", color: 0, phase: 0 }]; hop(g, "up");
assert.strictEqual(g.over, ENDINGS.car);
console.log("cars + lives OK");

// The river: logs carry Pip, water and the edge splat them
g = quietGame();
g.hero.row = SETTINGS.medianRow;
let lane = logUnderPip(g, 5);
hop(g, "up"); assert.ok(!g.hero.dead, "standing on the log");
const before = g.hero.cx; run(g, 0.5); assert.ok(g.hero.cx > before, "carried along by the log");
g = quietGame(); g.hero.row = SETTINGS.medianRow; hop(g, "up");
assert.ok(g.hero.dead); assert.strictEqual(g.hero.cause, "water");
g = quietGame(); g.hero.row = SETTINGS.medianRow; g.hero.cx = 9.5;
lane = logUnderPip(g, 5); hop(g, "up"); run(g, 3);
assert.ok(g.events.some((e) => e.type === "splat" && e.cause === "swept"), "swept off the edge");
console.log("river OK");

// Homes: fill them, don't hit the hedge or a full home, clear the level
g = quietGame(); g.hero.row = 1; g.hero.cx = 3.5; g.timeLeft = 20;
hop(g, "up"); assert.ok(g.homes[1]); assert.ok(g.score >= SETTINGS.homePoints + 20 * SETTINGS.timePoints);
assert.strictEqual(g.hero.row, SETTINGS.startRow, "back to the start after getting home");
g.hero.row = 1; g.hero.cx = 3.5; hop(g, "up"); assert.strictEqual(g.hero.cause, "hedge", "that home is full");
g = quietGame(); g.hero.row = 1; g.hero.cx = 2.5; hop(g, "up"); assert.strictEqual(g.hero.cause, "hedge");
g = quietGame(); g.homes = [true, true, true, true, false]; g.hero.row = 1; g.hero.cx = 9.5;
const levelScore = g.score; hop(g, "up");
assert.strictEqual(g.level, 2); assert.ok(g.homes.every((h) => !h), "fresh homes");
assert.ok(g.score - levelScore >= SETTINGS.levelPoints, "level bonus");
assert.ok(g.lanes.find((l) => l.row === 8).speed > 2.2, "level 2 is faster");
console.log("homes + levels OK");

// The timer
g = quietGame(); run(g, SETTINGS.crossingTime + 0.1);
assert.strictEqual(g.hero.cause, "time"); assert.strictEqual(g.lives, 2);
console.log("timer OK");

// Classic: no mystery boxes, no events
g = new CrossingGame({ classic: true });
for (let i = 0; i < 60 * 60 && !g.over; i++) { g.update(1 / 60); g.hero.dead = false; g.lives = 3; g.timeLeft = 30; }
assert.strictEqual(g.pickups.length, 0); assert.strictEqual(g.roadWork, null); assert.strictEqual(g.demon, null);
console.log("classic OK");

// Mystery boxes appear on the road or the strip and get grabbed
g = new CrossingGame(); for (const l of g.lanes) l.objects = []; g.nextEventAt = 1e9;
g.nextPickupAt = 0; g.update(0.01);
assert.strictEqual(g.pickups.length, 1);
const box = g.pickups[0];
assert.ok([...ROAD_ROWS, SETTINGS.medianRow].includes(box.row));
g.hero.row = box.row; g.hero.cx = box.col + 0.5; g.update(0.01);
assert.strictEqual(g.pickups.length, 0); assert.ok(g.events.some((e) => e.type === "pickup"));
g = quietGame(); g.pickups.push({ col: 1, row: 7, until: g.time + SETTINGS.pickupLife }); run(g, SETTINGS.pickupLife + 0.1);
assert.strictEqual(g.pickups.length, 0, "boxes vanish after a while");
console.log("mystery boxes OK");

// Every pickup does what it says
function grabbed(name, setup) {
  const game = quietGame();
  if (setup) setup(game);
  game.pickPickup = () => name;
  game.grab({ col: 0, row: 7 });
  return game;
}
for (const name of Object.keys(PICKUPS)) {
  const ev = grabbed(name).events.find((e) => e.type === "pickup");
  assert.ok(ev.text && ev.popup, `${name} has a message`);
}
g = grabbed("life"); assert.strictEqual(g.lives, 4);
g = grabbed("life", (x) => (x.lives = 5)); assert.strictEqual(g.lives, 5);
g = grabbed("slow"); const slowLane = g.lane(8); close(g.laneSpeed(slowLane), slowLane.speed * SETTINGS.slowScale, "slow");
g = grabbed("rush"); close(g.laneSpeed(g.lane(8)), g.lane(8).speed * SETTINGS.rushScale, "rush hour");
assert.strictEqual(g.laneSpeed(g.lane(3)), g.lane(3).speed, "rush hour doesn't touch the river");
g = grabbed("fog"); close(g.fogLeft(), SETTINGS.fogTime, "fog");
console.log("pickup effects OK");

// Shield saves one splat and puts Pip on the last safe strip
g = grabbed("shield"); g.hero.row = SETTINGS.medianRow; g.lastSafeRow = SETTINGS.medianRow;
hop(g, "up");  // into the water
assert.ok(!g.hero.dead); assert.strictEqual(g.hero.row, SETTINGS.medianRow); assert.strictEqual(g.shield, false);
assert.ok(g.events.some((e) => e.type === "saved"));
run(g, SETTINGS.shieldGrace + 0.1); hop(g, "up"); assert.ok(g.hero.dead, "only one free splat");
console.log("shield OK");

// Freeze stops traffic and the timer, but Pip can still hop
g = grabbed("freeze"); g.lane(8).objects = [{ x: 2, len: 1, kind: "car", color: 0, phase: 0 }];
const timer = g.timeLeft; run(g, 1);
close(g.lane(8).objects[0].x, 2, "traffic frozen"); close(g.timeLeft, timer, "timer frozen");
hop(g, "up"); assert.strictEqual(g.hero.row, 11);
console.log("freeze OK");

// Super hop goes two rows at a time
g = grabbed("superhop"); hop(g, "up"); assert.strictEqual(g.hero.row, 10); assert.strictEqual(g.score, 20);
console.log("super hop OK");

// Reversed and drunk
g = grabbed("reversed"); g.hero.row = 9; hop(g, "up"); assert.strictEqual(g.hero.row, 10, "up goes down");
g = grabbed("drunk"); g.press("up"); g.update(0.2); assert.strictEqual(g.hero.row, 12, "not yet");
g.update(0.25); assert.strictEqual(g.hero.row, 11, "hopped late");
console.log("reversed + drunk OK");

// Wind pushes Pip sideways
g = grabbed("wind"); const windStart = g.hero.cx; run(g, 1);
assert.ok(Math.abs(g.hero.cx - windStart) > 1, "blown sideways");
assert.ok(g.hero.cx >= 0.5 && g.hero.cx <= SETTINGS.cols - 0.5, "but not off the board on land");
console.log("wind OK");

// Sinking logs dip under and drop Pip in the river
g = grabbed("sink"); g.hero.row = 4; const sinkLane = g.lane(4);
sinkLane.objects = [{ x: g.hero.cx - 2, len: 4, kind: "ducks", color: 0, phase: 0 }];
sinkLane.speed = 0;
let fell = false;
for (let i = 0; i < 300 && !fell; i++) { g.update(1 / 60); fell = g.hero.dead; }
assert.ok(fell && g.hero.cause === "water", "the log sank");
console.log("sinking OK");

// Swerving cars change lanes
g = grabbed("swerve"); g.lane(9).objects = [{ x: 4, len: 1, kind: "car", color: 0, phase: 0 }];
for (const l of g.lanes) l.speed = 0;  // keep the car on screen so it gets the chance to swerve
for (const r of [8, 10]) g.lane(r).objects = [];
for (const l of g.lanes.filter((l) => l.road && ![8, 9, 10].includes(l.row))) l.objects = [];
let swerved = false;
for (let i = 0; i < 600 && !swerved; i++) { g.update(1 / 60); swerved = g.events.some((e) => e.type === "swerve"); }
assert.ok(swerved, "a car swerved");
console.log("swerve OK");

// Road work closes a lane with cones; a speed demon gives a warning first
g = quietGame(); g.startRoadWork();
const work = g.roadWork; assert.ok(work); assert.strictEqual(g.lane(work.row).objects.length, 0);
assert.strictEqual(g.cones.length, SETTINGS.cols - 2, "two gaps left");
g.hero.row = work.row + 1; const cone = g.cones[0]; g.hero.cx = cone.col + 0.5;
hop(g, "up"); assert.strictEqual(g.hero.row, work.row + 1, "cones block the hop");
assert.ok(g.events.some((e) => e.type === "bump"));
run(g, SETTINGS.roadWorkTime + 0.1); assert.strictEqual(g.roadWork, null); assert.strictEqual(g.cones.length, 0);
g = quietGame(); g.hero.row = 9; g.timeLeft = 100; g.startDemon(); g.demon.row = 9;
run(g, SETTINGS.demonWarning - 0.1); assert.ok(!g.hero.dead, "just a warning so far");
run(g, 2); assert.ok(g.events.some((e) => e.type === "splat" && e.cause === "demon"), "the demon got Pip");
console.log("road work + speed demon OK");

// Long random games: nothing breaks, Pip never leaves the board
let summary = { levels: 1, endings: {} };
for (let seed = 0; seed < 40; seed++) {
  g = new CrossingGame({ classic: seed % 4 === 0 });
  const dirs = ["up", "up", "up", "left", "right", "down"];
  for (let i = 0; i < 60 * 60 * 5 && !g.over; i++) {
    if (i % 9 === 0) g.press(dirs[Math.floor(Math.random() * dirs.length)]);
    if (i % 400 === 0 && !g.classic) { g.nextPickupAt = 0; }
    if (i % 900 === 0 && !g.classic) { g.pickPickup = (k) => { const names = Object.keys(PICKUPS).filter((n) => PICKUPS[n].kind === k); return names[Math.floor(Math.random() * names.length)]; }; }
    g.update(1 / 60);
    const h = g.hero;
    assert.ok(Number.isFinite(h.cx) && Number.isFinite(g.score) && Number.isFinite(g.timeLeft));
    assert.ok(h.row >= 0 && h.row <= SETTINGS.startRow, "row on the board");
    if (!h.dead && !RIVER_ROWS.includes(h.row)) assert.ok(h.cx >= 0.49 && h.cx <= SETTINGS.cols - 0.49, "column on the board");
    for (const lane of g.lanes) for (const o of lane.objects) assert.ok(o.x >= -SETTINGS.wrapMargin - 0.01 && o.x < SETTINGS.cols + SETTINGS.wrapMargin);
  }
  summary.levels = Math.max(summary.levels, g.level);
  summary.endings[g.over || "still going"] = (summary.endings[g.over || "still going"] || 0) + 1;
}
console.log("random games OK", summary);
