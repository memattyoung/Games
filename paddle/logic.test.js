// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { PaddleGame, SETTINGS, ORBS } = require("./logic.js");

const W = SETTINGS.width;
const H = SETTINGS.height;
const close = (a, b, why, within = 1e-6) => assert.ok(Math.abs(a - b) < within, `${why}: ${a} vs ${b}`);
function run(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds && !game.over; t += step) game.update(step);
}
// A game with a ball already flying, Kevin parked out of the way and no orbs
function flying(options = {}, ball = {}) {
  const g = new PaddleGame(options);
  g.nextOrbAt = 1e9;
  g.balls = [{ x: 300, y: 400, vx: 0, vy: 380, spin: 0, waiting: false, lastHit: "cpu", ...ball }];
  return g;
}
function freezeCpu(g, x = 50) {
  g.cpuPlan = () => x;
  g.paddles.cpu.x = x;
}

// Serving: the ball waits, then heads for you; after a point it heads for whoever lost it
let g = new PaddleGame(); g.nextOrbAt = 1e9;
run(g, 1.0); assert.ok(g.balls[0].waiting, "still waiting to serve");
run(g, 0.2); assert.ok(!g.balls[0].waiting && g.balls[0].vy > 0, "served towards you");
assert.ok(Math.abs(g.balls[0].vx) < Math.abs(g.balls[0].vy), "serve isn't too sideways");
g = flying({}, { vy: -380 }); freezeCpu(g); g.paddles.player.x = 300;
run(g, 1.5);
assert.strictEqual(g.score.player, 1);
assert.strictEqual(g.serveToward, "cpu", "Kevin lost the point, so he receives");
console.log("serving OK");

// Side walls
g = flying({}, { x: 20, vx: -300, vy: 200 }); run(g, 0.2); assert.ok(g.balls[0].vx > 0, "bounced off the left wall");
g = flying({}, { x: 580, vx: 300, vy: 200 }); run(g, 0.2); assert.ok(g.balls[0].vx < 0, "bounced off the right wall");
console.log("walls OK");

// Your paddle: the ball goes back up, at an angle from the edge, a little faster each hit
g = flying({}, { x: 345, y: 700, vy: 380 }); freezeCpu(g); g.paddles.player.x = 300; g.setInput({ targetX: 300 });
run(g, 0.15);
let ball = g.balls[0];
assert.ok(ball.vy < 0 && ball.vx > 0, "right end sends it up and right"); assert.strictEqual(ball.lastHit, "player");
assert.strictEqual(g.rally, 1); close(Math.hypot(ball.vx, ball.vy), 380 * 1.05, "sped up 5%", 0.01);
g.rally = 100; close(g.ballSpeed(), 380 * 1.9, "speed is capped", 0.01);
console.log("your paddle OK");

// Kevin's paddle sends it back down
g = flying({}, { x: 300, y: 120, vy: -380 }); g.cpuPlan = () => 300; g.paddles.cpu.x = 300;
run(g, 0.2); assert.ok(g.balls[0].vy > 0); assert.strictEqual(g.balls[0].lastHit, "cpu");
console.log("Kevin's paddle OK");

// Points, match point and winning at 7
g = flying(); freezeCpu(g); g.paddles.player.x = 30; g.setInput({ targetX: 30 }); g.balls[0].x = 500;
g.score.cpu = 5; run(g, 1.5);
assert.strictEqual(g.score.cpu, 6); assert.ok(g.events.some((e) => e.type === "matchPoint" && e.side === "cpu"));
g = flying({}, { vy: -380 }); freezeCpu(g); g.score.player = 6;
run(g, 1.5);
assert.strictEqual(g.winner, "player"); assert.ok(g.over.startsWith("You beat Kevin"));
assert.ok(g.events.some((e) => e.type === "over" && e.winner === "player"));
console.log("scoring OK");

// Kevin returns most normal shots, misses more when he can't see, and gets better as you win
function returnRate(wins, setup) {
  let returned = 0;
  const tries = 400;
  for (let i = 0; i < tries; i++) {
    const game = flying({ wins, random: Math.random });
    game.rollCpuError();
    if (setup) setup(game);
    const angle = (Math.random() - 0.5) * 1.6;
    const speed = game.ballSpeed() * (1 + Math.random() * 0.4);
    game.balls[0] = { x: 100 + Math.random() * 400, y: 600, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed,
      spin: 0, waiting: false, lastHit: "player" };
    game.paddles.cpu.x = 100 + Math.random() * 400;
    for (let t = 0; t < 3 && !game.over; t += 1 / 60) {
      game.update(1 / 60);
      if (game.balls[0] && game.balls[0].lastHit === "cpu") { returned++; break; }
      if (game.score.player > 0) break;
    }
  }
  return returned / tries;
}
const rookie = returnRate(0);
const pro = returnRate(6);
const foggy = returnRate(0, (game) => { game.fx.cpu.fog = 100; game.rollCpuError(); });
console.log(`  Kevin returns: ${(rookie * 100).toFixed(0)}% at the start, ${(pro * 100).toFixed(0)}% after 6 wins, ${(foggy * 100).toFixed(0)}% in fog`);
assert.ok(rookie > 0.5 && rookie < 0.97, "rookie Kevin is good but beatable");
assert.ok(pro > rookie, "Kevin improves");
assert.ok(foggy < rookie - 0.1, "fog makes Kevin worse");
console.log("Kevin OK");

// Mystery orbs: chaos only, 5-9 seconds apart, at most 2, fizzle after a while
g = new PaddleGame(); assert.ok(g.nextOrbAt >= 5 && g.nextOrbAt <= 9);
g.balls[0].waiting = true; g.serveAt = 1e9;
for (let i = 0; i < 60; i++) g.update(0.5);
assert.ok(g.orbs.length >= 1 && g.orbs.length <= SETTINGS.maxOrbs, "orbs appeared");
assert.ok(g.orbs.every((o) => o.x >= 60 && o.x <= W - 60 && o.y >= 250 && o.y <= 550));
assert.ok(g.events.some((e) => e.type === "orbFizzle"), "unused orbs fizzle");
g = new PaddleGame({ classic: true }); g.serveAt = 1e9;
for (let i = 0; i < 60; i++) g.update(0.5);
assert.strictEqual(g.orbs.length, 0, "no orbs in classic");
console.log("orb spawning OK");

// Hitting an orb gives the effect to whoever touched the ball last
g = flying({}, { y: 500, vy: -300, lastHit: "player" }); freezeCpu(g);
g.orbs.push({ x: 300, y: 450, until: 100 }); g.pickOrb = () => "giant"; g.random = () => 0.2;
run(g, 0.3);
assert.ok(g.left("player", "giant") > 0 && g.left("cpu", "giant") === 0, "you got it");
assert.ok(g.events.some((e) => e.type === "orb" && e.owner === "player" && e.name === "giant"));
g = flying({}, { y: 300, vy: 300, lastHit: "cpu" }); freezeCpu(g);
g.orbs.push({ x: 300, y: 350, until: 100 }); g.pickOrb = () => "drunk";
run(g, 0.3); assert.ok(g.left("cpu", "drunk") > 0, "Kevin got it");
console.log("orb ownership OK");

function withOrb(side, name, setup) {
  const game = flying();
  freezeCpu(game, 300);
  if (setup) setup(game);
  game.applyOrb(side, name, game.balls[0]);
  return game;
}
g = withOrb("player", "giant"); close(g.paddleWidth("player"), 160, "giant");
g = withOrb("cpu", "tiny"); close(g.paddleWidth("cpu"), 55, "tiny"); close(g.paddleWidth("player"), 100, "only Kevin's");
g = withOrb("player", "shield"); assert.ok(g.shield.player);
g = withOrb("player", "multi"); assert.strictEqual(g.balls.length, 3);
g = withOrb("player", "multi", (x) => { for (let i = 0; i < 4; i++) x.balls.push({ ...x.balls[0] }); });
assert.strictEqual(g.balls.length, SETTINGS.maxBalls, "never more than 5 balls");
g = withOrb("player", "fog"); close(g.left("player", "fog"), SETTINGS.shortTime, "fog is short");
g = withOrb("player", "tilt"); assert.ok(g.tiltLeft() > 0 && g.left("player", "tilt") > 0);
for (const [name, orb] of Object.entries(ORBS)) {
  assert.ok(orb.text && orb.cpuText && orb.quip && orb.popup, `${name} has its messages`);
}
console.log("orb effects OK");

// Reversed and drunk paddles, for you and for Kevin
g = withOrb("player", "reversed"); g.setInput({ targetX: 100 }); run(g, 0.5);
assert.ok(g.paddles.player.x > 450, "mouse on the left sends your paddle right");
g = withOrb("player", "drunk"); g.setInput({ targetX: 300 }); run(g, 0.8);
g.setInput({ targetX: 100 }); run(g, 0.3); assert.ok(g.paddles.player.x > 290, "drunk: not yet");
run(g, 0.4); assert.ok(g.paddles.player.x < 110, "drunk: there it goes");
g = withOrb("cpu", "reversed"); g.cpuPlan = () => 100; run(g, 0.6);
assert.ok(g.paddles.cpu.x > 450, "reversed Kevin goes the wrong way");
console.log("reversed + drunk OK");

// Slow-mo only slows the ball while it heads at whoever has it
g = withOrb("player", "slow"); g.balls[0] = { x: 300, y: 300, vx: 0, vy: 300, spin: 0, waiting: false, lastHit: "cpu" };
run(g, 0.5); close(g.balls[0].y, 300 + 300 * 0.5 * SETTINGS.slowScale, "slow coming to you", 6);
g.balls[0] = { x: 300, y: 600, vx: 0, vy: -300, spin: 0, waiting: false, lastHit: "player" };
run(g, 0.5); close(g.balls[0].y, 600 - 150, "normal speed going away", 8);
console.log("slow-mo OK");

// Curveballs bend after the owner hits them; a tilted court pulls every ball sideways
g = withOrb("player", "curve"); g.balls[0] = { x: 300, y: 700, vx: 0, vy: 380, spin: 0, waiting: false, lastHit: "cpu" };
g.paddles.player.x = 300; g.setInput({ targetX: 300 }); run(g, 0.2);
assert.ok(Math.abs(g.balls[0].spin) > 0, "curve applied"); const vx0 = g.balls[0].vx; run(g, 0.3);
assert.ok(Math.abs(g.balls[0].vx - vx0) > 50, "the ball bent");
g = withOrb("cpu", "tilt"); g.tiltDir = 1; g.balls[0] = { x: 300, y: 400, vx: 0, vy: 200, spin: 0, waiting: false, lastHit: "cpu" };
run(g, 0.5); assert.ok(g.balls[0].vx > 100, "tilt pulls the ball");
console.log("curve + tilt OK");

// Shields save one ball, then they're gone
g = withOrb("player", "shield"); g.paddles.player.x = 30; g.setInput({ targetX: 30 }); g.balls[0].x = 500;
run(g, 1.2); assert.strictEqual(g.score.cpu, 0); assert.strictEqual(g.shield.player, false);
assert.ok(g.events.some((e) => e.type === "shieldSave"));
console.log("shield OK");

// With several balls, the first one out scores and the rest are cleared
g = flying(); freezeCpu(g); g.paddles.player.x = 30; g.setInput({ targetX: 30 }); g.balls[0].x = 500;
g.balls.push({ x: 450, y: 600, vx: 0, vy: 380, spin: 0, waiting: false, lastHit: "cpu" });
g.balls.push({ x: 400, y: 200, vx: 0, vy: -380, spin: 0, waiting: false, lastHit: "player" });
run(g, 0.7);
assert.strictEqual(g.score.cpu + g.score.player, 1, "only one point"); assert.strictEqual(g.balls.length, 1);
assert.ok(g.balls[0].waiting, "and a fresh serve");
console.log("multiball points OK");

// Lots of whole matches with a decent computer player standing in for you
const results = { chaos: { player: 0, cpu: 0 }, classic: { player: 0, cpu: 0 } };
let longest = 0;
for (let seed = 0; seed < 40; seed++) {
  const classic = seed % 4 === 0;
  g = new PaddleGame({ classic, wins: seed % 5 });
  let t = 0;
  for (; t < 60 * 20 && !g.over; t += 1 / 60) {
    const coming = g.balls.filter((b) => !b.waiting && b.vy > 0).sort((a, b) => b.y - a.y)[0];
    const aim = coming ? coming.x + Math.sin(t * 3) * 25 : 300;
    g.setInput(Math.floor(t) % 13 === 0 ? { right: true } : { targetX: aim });
    g.update(1 / 60);
    for (const b of g.balls) {
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy), "ball broke");
      assert.ok(b.x >= SETTINGS.ballRadius - 0.01 && b.x <= W - SETTINGS.ballRadius + 0.01, "ball left the court sideways");
      assert.ok(b.waiting || Math.abs(b.vy) > 50, "ball stalled sideways");
    }
    for (const side of ["player", "cpu"]) {
      const half = g.paddleWidth(side) / 2;
      assert.ok(g.paddles[side].x >= half - 0.01 && g.paddles[side].x <= W - half + 0.01, "paddle left the court");
    }
    assert.ok(g.balls.length <= SETTINGS.maxBalls);
  }
  assert.ok(g.over, `match ${seed} never finished`);
  results[classic ? "classic" : "chaos"][g.winner] += 1;
  longest = Math.max(longest, t);
}
console.log("whole matches OK", JSON.stringify(results), `longest match ${(longest / 60).toFixed(1)} min`);
