// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { BrickGame, SETTINGS, CAPSULES } = require("./logic.js");

const close = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
function run(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds && !game.over; t += step) game.update(step);
}
// A game with no bricks in the way and nothing random going on
function emptyGame(options = {}) {
  const g = new BrickGame(options);
  g.bricks = [];
  g.startingBricks = 1;
  g.nextRainbowAt = 1e9;
  g.bricks.push(brickAt(-1000, SETTINGS.wallTop));  // out of reach; stops the level counting as cleared
  return g;
}
function brickAt(x, y, extra = {}) {
  return { x, y, w: SETTINGS.brickWidth, h: SETTINGS.brickHeight, row: 0, hp: 1, maxHp: 1, steel: false,
    alive: true, rainbowUntil: 0, ...extra };
}
function ballAt(g, x, y, vx, vy) {
  const length = Math.hypot(vx, vy);
  g.balls = [{ x, y, vx: vx / length, vy: vy / length, stuck: false, offset: 0 }];
  return g.balls[0];
}

// Level layouts
let g = new BrickGame();
assert.strictEqual(g.bricks.length, 50); assert.ok(g.bricks.every((b) => b.hp === 1 && !b.steel));
g.level = 2; g.buildLevel();
assert.strictEqual(g.bricks.length, 60); assert.strictEqual(g.bricks.filter((b) => b.hp === 2).length, 20);
g.level = 3; g.buildLevel(); assert.ok(g.bricks.some((b) => b.steel), "rage level 3 has steel");
g = new BrickGame({ classic: true }); g.level = 5; g.buildLevel(); assert.ok(!g.bricks.some((b) => b.steel), "no steel in classic");
for (const brick of new BrickGame().bricks) {
  assert.ok(brick.x >= 0 && brick.x + brick.w <= SETTINGS.width);
}
console.log("levels OK");

// The ball waits on the paddle, then launches itself after 3 seconds
g = new BrickGame();
run(g, 2.9); assert.ok(g.balls[0].stuck);
run(g, 0.2); assert.ok(!g.balls[0].stuck); assert.ok(g.events.some((e) => e.type === "autoLaunch"));
g = new BrickGame(); assert.ok(g.launch()); assert.ok(g.balls[0].vy < 0, "launches upwards");
console.log("launching OK");

// Walls and ceiling
g = emptyGame(); let ball = ballAt(g, 20, 400, -1, -0.5);
run(g, 0.2); assert.ok(ball.vx > 0, "bounced off the left wall");
ball = ballAt(g, 300, 20, 0.2, -1); run(g, 0.2); assert.ok(ball.vy > 0, "bounced off the ceiling");
console.log("walls OK");

// Paddle: the edge of the paddle sends the ball off at an angle, and combos reset
g = emptyGame(); g.combo = 4;
ball = ballAt(g, 300 + 45, SETTINGS.paddleY - 20, 0, 1);
run(g, 0.1);
assert.ok(ball.vy < 0 && ball.vx > 0.6, "right edge sends it right"); assert.strictEqual(g.combo, 0);
ball = ballAt(g, 300, SETTINGS.paddleY - 20, 0, 1); run(g, 0.1); close(ball.vx, 0, "middle goes straight up");
console.log("paddle OK");

// Breaking bricks, scoring and combos
g = emptyGame();
g.bricks.push(brickAt(270, 300), brickAt(270, 200), brickAt(270, 100));
ball = ballAt(g, 298, 400, 0, -1);
for (let i = 0; i < 400 && g.score < 60; i++) {
  g.update(1 / 120);
  if (ball.vy > 0) { ball.vy = -1; ball.vx = 0; }  // keep it going up so it chains through the bricks
}
assert.strictEqual(g.score, 10 + 20 + 30, "combo multiplies each brick"); assert.strictEqual(g.combo, 3);
console.log("bricks + combo OK");

// Classic: no combos
g = emptyGame({ classic: true });
g.bricks.push(brickAt(270, 300), brickAt(270, 200));
ball = ballAt(g, 298, 400, 0, -1);
for (let i = 0; i < 400 && g.score < 20; i++) { g.update(1 / 120); if (ball.vy > 0) { ball.vy = -1; ball.vx = 0; } }
assert.strictEqual(g.score, 20);
console.log("classic scoring OK");

// Tough bricks take more hits, steel never breaks
g = emptyGame(); const tough = brickAt(270, 300, { hp: 2, maxHp: 2 }); g.bricks.push(tough);
ball = ballAt(g, 298, 400, 0, -1); run(g, 0.5);
assert.strictEqual(tough.hp, 1); assert.ok(tough.alive);
const steel = brickAt(270, 300, { steel: true }); g.bricks.push(steel); tough.alive = false;
ball = ballAt(g, 298, 400, 0, -1); run(g, 0.5); assert.ok(steel.alive, "steel survives");
console.log("tough + steel bricks OK");

// Losing balls and lives
g = emptyGame(); ballAt(g, 300, 700, 0.05, 1); g.paddle.x = 50; g.setInput({ targetX: 50 });
run(g, 1);
assert.strictEqual(g.lives, 2); assert.ok(g.balls[0].stuck, "a new ball waits on the paddle");
g.balls.push({ x: 300, y: 300, vx: 0, vy: -1, stuck: false, offset: 0 });
g.balls[0].stuck = false; g.balls[0].x = 550; g.balls[0].y = 790; g.balls[0].vy = 1;
run(g, 0.2); assert.strictEqual(g.lives, 2, "losing one of two balls costs nothing"); assert.strictEqual(g.balls.length, 1);
g.lives = 1; g.balls = [{ x: 550, y: 790, vx: 0, vy: 1, stuck: false, offset: 0 }];
run(g, 0.2); assert.strictEqual(g.over, "Out of balls. Embarrassing.");
console.log("lives OK");

// Safety net saves exactly one ball
g = emptyGame(); g.net = true; g.paddle.x = 50; g.setInput({ targetX: 50 });
ball = ballAt(g, 400, 760, 0.1, 1); run(g, 0.3);
assert.strictEqual(g.net, false); assert.ok(ball.vy < 0); assert.strictEqual(g.lives, 3);
assert.ok(g.events.some((e) => e.type === "netSave"));
console.log("safety net OK");

// The wall creeps down (every 10s when full), and reaching the paddle ends the game
g = new BrickGame(); g.nextRainbowAt = 1e9;
const startY = g.bricks[0].y;
g.balls[0].stuck = true; g.autoLaunchAt = 1e9;
g.update(9.9); assert.strictEqual(g.bricks[0].y, startY);
g.update(0.2); assert.strictEqual(g.bricks[0].y, startY + SETTINGS.rowStep);
assert.ok(g.events.some((e) => e.type === "creep"));
for (let i = 0; i < 40 && !g.over; i++) g.update(10.1);
assert.ok(g.over && g.over.startsWith("The wall got you"));
g = new BrickGame({ classic: true }); g.autoLaunchAt = 1e9; const classicY = g.bricks[0].y;
for (let i = 0; i < 20; i++) g.update(10); assert.strictEqual(g.bricks[0].y, classicY, "no creeping in classic");
console.log("creeping wall OK");

// Fewer bricks left means the wall creeps more slowly
g = new BrickGame(); g.autoLaunchAt = 1e9; g.nextRainbowAt = 1e9;
g.bricks.forEach((b, i) => { if (i > 0) b.alive = false; });
const lonely = g.bricks[0].y; g.update(20); assert.strictEqual(g.bricks[0].y, lonely, "almost empty wall waits longer");
g.update(4.5); assert.strictEqual(g.bricks[0].y, lonely + SETTINGS.rowStep);
console.log("creep speed OK");

// Capsules: every one does what it says
function catchOne(name, setup) {
  const game = emptyGame();
  if (setup) setup(game);
  const kind = CAPSULES[name].kind;
  game.pickCapsule = () => name;
  game.catchCapsule({ x: game.paddle.x, y: SETTINGS.paddleY, kind });
  return game;
}
g = catchOne("wide"); close(g.paddleWidth(), 160, "wide");
g = catchOne("tiny"); close(g.paddleWidth(), 55, "tiny");
g = catchOne("tiny", (x) => (x.wideUntil = 100)); close(g.paddleWidth(), 100 * 1.6 * 0.55, "wide and tiny together");
g = catchOne("slow"); close(g.ballSpeed(), 400 * 0.65, "slow");
g = catchOne("fast"); close(g.ballSpeed(), 400 * 1.45, "fast");
g = catchOne("net"); assert.ok(g.net);
g = catchOne("life"); assert.strictEqual(g.lives, 4);
g = catchOne("life", (x) => (x.lives = 5)); assert.strictEqual(g.lives, 5);
assert.ok(g.events.find((e) => e.type === "caught").popup === "MAXED");
g = catchOne("multi", (x) => ballAt(x, 300, 400, 0, -1)); assert.strictEqual(g.balls.length, 3);
assert.ok(g.balls.every((b) => Math.abs(Math.hypot(b.vx, b.vy) - 1) < 1e-9));
g = catchOne("multi", (x) => { ballAt(x, 300, 400, 0, -1); for (let i = 0; i < 6; i++) x.balls.push({ ...x.balls[0] }); });
assert.strictEqual(g.balls.length, SETTINGS.maxBalls, "never more than 8 balls");
g = catchOne("fog"); close(g.fogLeft(), SETTINGS.fogTime, "fog");
g = catchOne("invisible"); close(g.invisibleLeft(), SETTINGS.invisibleTime, "invisible");
g = catchOne("steel", (x) => { x.bricks = [brickAt(2, 70)]; });
assert.strictEqual(g.bricks.filter((b) => b.steel).length, 1, "a steel brick appeared");
assert.ok(g.bricks.every((b) => b.y + b.h < SETTINGS.paddleY - SETTINGS.dangerGap));
for (const name of Object.keys(CAPSULES)) {
  const caught = catchOne(name).events.find((e) => e.type === "caught");
  assert.ok(caught && caught.text && caught.popup, `${name} has a message`);
}
console.log("capsule effects OK");

// Sticky paddle catches the ball and lets go after 1.5s
g = emptyGame(); g.stickyUntil = 100;
ball = ballAt(g, 300, SETTINGS.paddleY - 20, 0, 1); run(g, 0.1);
assert.ok(ball.stuck, "caught by the sticky paddle");
run(g, 1.3); assert.ok(ball.stuck); run(g, 0.3); assert.ok(!ball.stuck, "let go after 1.5s");
console.log("sticky OK");

// Reversed controls swap keys and mirror the mouse
g = emptyGame(); g.reversedUntil = 100; g.balls[0] = { ...g.balls[0], stuck: true };
g.setInput({ targetX: 100 }); run(g, 0.5); assert.ok(g.paddle.x > 450, "mouse on the left sends the paddle right");
g.setInput({ left: true }); const before = g.paddle.x; run(g, 0.1); assert.ok(g.paddle.x > before, "left key moves right");
console.log("reversed OK");

// Drunk paddle is half a second behind
g = emptyGame(); g.drunkUntil = 100;
g.setInput({ targetX: 300 }); run(g, 1);
g.setInput({ targetX: 100 }); run(g, 0.3); assert.ok(g.paddle.x > 290, "hasn't reacted yet");
run(g, 0.4); assert.ok(g.paddle.x < 110, "reacted after the delay");
console.log("drunk OK");

// Capsules fall and are caught by the paddle, or missed
g = emptyGame(); g.pickCapsule = () => "wide";
g.capsules.push({ x: 300, y: 600, kind: "good" }); g.paddle.x = 300; g.setInput({ targetX: 300 });
run(g, 1.2); assert.strictEqual(g.capsules.length, 0); assert.ok(g.wideLeft() > 0, "caught");
g.wideUntil = 0; g.capsules.push({ x: 50, y: 600, kind: "good" }); g.setInput({ targetX: 500 });
run(g, 1.5); assert.strictEqual(g.capsules.length, 0); assert.strictEqual(g.wideLeft(), 0, "missed");
console.log("capsule catching OK");

// About 1 in 5 broken bricks drops a capsule
g = emptyGame(); let drops = 0;
for (let i = 0; i < 5000; i++) { g.capsules = []; g.hitBrick(brickAt(100, 100)); drops += g.capsules.length; }
assert.ok(drops > 850 && drops < 1150, `drop rate ${drops / 5000}`);
console.log("drop rate OK", (drops / 5000).toFixed(3));

// Rainbow brick: shows up after 20-40s, worth 250 x combo, gone after 8s
g = new BrickGame(); g.autoLaunchAt = 1e9;
assert.ok(g.nextRainbowAt >= 20 && g.nextRainbowAt <= 40);
for (let t = 0; t < 45 && !g.rainbowBrick; t += 0.5) g.update(0.5);
const rainbow = g.rainbowBrick; assert.ok(rainbow, "rainbow appeared");
g.combo = 1; const scoreBefore = g.score; g.hitBrick(rainbow);
assert.strictEqual(g.score - scoreBefore, 500, "250 x combo of 2");
g = new BrickGame(); g.autoLaunchAt = 1e9; g.nextRainbowAt = 0; g.update(0.01);
assert.ok(g.rainbowBrick); g.update(8.1); g.update(0.01); assert.strictEqual(g.rainbowBrick, null, "rainbow wears off");
console.log("rainbow brick OK");

// Clearing the level
g = new BrickGame(); g.autoLaunchAt = 1e9; g.score = 0;
g.bricks.forEach((b, i) => { if (i > 0) b.alive = false; });
g.hitBrick(g.bricks[0]); g.update(0.01);
assert.strictEqual(g.level, 2); assert.strictEqual(g.score, 10 + 100);
assert.strictEqual(g.bricks.length, 60); assert.ok(g.balls[0].stuck);
assert.ok(g.events.some((e) => e.type === "level" && e.level === 2));
console.log("level clear OK");

// Long games with a computer player: nothing breaks, the ball never ends up inside a brick
let results = { levels: 0, endings: {} };
for (let seed = 0; seed < 25; seed++) {
  g = new BrickGame({ classic: seed % 5 === 0 });
  for (let i = 0; i < 60 * 60 * 4 && !g.over; i++) {
    const lowest = g.balls.reduce((a, b) => (b.y > a.y ? b : a), g.balls[0]);
    // A decent but not perfect player
    const aim = lowest ? lowest.x + Math.sin(i / 40) * 30 : 300;
    g.setInput(i % 600 < 20 ? { left: true } : { targetX: aim });
    if (i % 300 === 0) g.launch();
    if (i % 900 === 0) g.capsules.push({ x: g.paddle.x, y: 700, kind: i % 1800 === 0 ? "good" : "bad" });
    g.update(1 / 60);
    for (const b of g.balls) {
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), "ball position broke");
      assert.ok(b.x >= SETTINGS.ballRadius - 0.01 && b.x <= SETTINGS.width - SETTINGS.ballRadius + 0.01, "ball left the sides");
      if (b.stuck) continue;
      for (const brick of g.bricks) {
        if (brick.alive) {
          const inside = b.x > brick.x + 0.5 && b.x < brick.x + brick.w - 0.5 && b.y > brick.y + 0.5 && b.y < brick.y + brick.h - 0.5;
          assert.ok(!inside, "ball got stuck inside a brick");
        }
      }
    }
    assert.ok(Number.isFinite(g.score));
  }
  results.levels = Math.max(results.levels, g.level);
  results.endings[g.over || "still going"] = (results.endings[g.over || "still going"] || 0) + 1;
}
console.log("long games OK", results);
