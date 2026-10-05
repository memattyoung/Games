// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { WingsGame, SETTINGS, ORBS, SUDDEN } = require("./logic.js");

const close = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
function run(game, seconds, step = 1 / 60) {
  for (let t = 0; t < seconds && !game.over; t += step) game.update(step);
}
// A started game with no pillars, orbs or surprises in the way
function openSky(options = {}) {
  const g = new WingsGame(options);
  g.flap();
  g.pillars = [];
  g.nextSuddenAt = 1e9;
  g.addPillar = function () {};  // no new pillars either
  return g;
}

// Hovering until the first flap
let g = new WingsGame();
run(g, 2); assert.strictEqual(g.over, null); assert.strictEqual(g.pillars.length, 0, "nothing moves before the first flap");
g.flap(); assert.ok(g.started); assert.ok(g.hero.vy < 0, "first flap goes up"); assert.strictEqual(g.pillars.length, 1);
console.log("waiting to start OK");

// Gravity and flapping
g = openSky(); g.hero.y = 400; g.hero.vy = 0;
run(g, 0.3); assert.ok(g.hero.y > 400, "falls"); const fallSpeed = g.hero.vy;
g.flap(); close(g.hero.vy, -SETTINGS.flapSpeed, "flap speed");
assert.ok(fallSpeed > 0);
console.log("gravity + flap OK");

// Floor and ceiling end the game
g = openSky(); g.hero.y = 700; g.hero.vy = 400; run(g, 1);
assert.strictEqual(g.over, "You hit the floor. Gravity: 1, you: 0.");
g = openSky(); g.hero.y = 40; g.hero.vy = -600; run(g, 0.5);
assert.strictEqual(g.over, "You hit the ceiling. Ambitious, but no.");
console.log("floor + ceiling OK");

// Pillars: through the gap scores, hitting one ends it
g = openSky();  // only the pillar below, so a random new one can't get in the way
g.pillars.push({ x: 200, center: 400, gap: 300, passed: false, offset: 0, phase: 0, orb: null });
g.hero.y = 400;
for (let i = 0; i < 120; i++) { if (g.hero.y > 400) g.flap(); g.update(1 / 60); }
assert.strictEqual(g.score, 1, "got through the gap"); assert.strictEqual(g.over, null);
g = openSky(); g.pillars.push({ x: 160, center: 200, gap: 150, passed: false, offset: 0, phase: 0, orb: null });
g.hero.y = 500; g.hero.vy = 0; run(g, 0.5);
assert.strictEqual(g.over, "You hit a pillar. It wasn't even moving.");
console.log("pillars OK");

// It gets harder: faster pillars and smaller gaps, with limits
g = new WingsGame(); close(g.speed(), 190, "start speed"); close(g.gapSize(), 215, "start gap");
g.score = 10; close(g.speed(), 230, "faster"); close(g.gapSize(), 193, "tighter");
g.score = 500; close(g.speed(), SETTINGS.maxSpeed, "speed limit"); close(g.gapSize(), SETTINGS.minGap, "gap limit");
console.log("difficulty OK");

// Gaps always leave room above and below
g = new WingsGame(); g.flap();
for (let i = 0; i < 500; i++) g.addPillar(1000 + i * 260);
for (const p of g.pillars) {
  assert.ok(p.center - p.gap / 2 >= SETTINGS.gapMargin - 0.01 && p.center + p.gap / 2 <= SETTINGS.groundY - SETTINGS.gapMargin + 0.01);
}
console.log("gap placement OK");

// Orbs: never in classic, never in the first two pillars, about 35% after that
g = new WingsGame({ classic: true }); g.flap(); for (let i = 0; i < 300; i++) g.addPillar(1000);
assert.ok(g.pillars.every((p) => !p.orb), "no orbs in classic");
g = new WingsGame(); g.flap(); for (let i = 0; i < 3000; i++) g.addPillar(1000);
assert.ok(!g.pillars[0].orb && !g.pillars[1].orb, "first two pillars are fair");
const rate = g.pillars.filter((p) => p.orb).length / g.pillars.length;
assert.ok(rate > 0.3 && rate < 0.4, `orb rate ${rate}`);
console.log("orb placement OK", rate.toFixed(3));

// Flying through an orb applies an effect and reveals it
g = openSky(); g.pillars.push({ x: SETTINGS.heroX - 39, center: 400, gap: 300, passed: false, offset: 0, phase: 0, orb: { taken: false } });
g.hero.y = 400; g.hero.vy = 0; g.update(1 / 60);
const orbEvent = g.events.find((e) => e.type === "orb");
assert.ok(orbEvent && ORBS[orbEvent.name] && orbEvent.text, "orb was taken"); assert.ok(g.pillars[0].orb.taken);
console.log("taking orbs OK", orbEvent.name);

// Each orb does what it says
function withOrb(name) { const game = openSky(); game.hero.y = 400; game.applyOrb(name); return game; }
g = withOrb("shield"); assert.ok(g.shield);
g = withOrb("slow"); g.hero.vy = 0; const slowStart = g.hero.y; run(g, 0.2); const slowDrop = g.hero.y - slowStart;
g = openSky(); g.hero.y = 400; g.hero.vy = 0; run(g, 0.2); const normalDrop = g.hero.y - 400;
assert.ok(slowDrop < normalDrop * 0.75, `slow-mo slows things down (${slowDrop.toFixed(1)} vs ${normalDrop.toFixed(1)})`);
g = withOrb("tiny"); close(g.heroRadius(), SETTINGS.heroRadius * SETTINGS.tinyScale, "tiny");
g = withOrb("double"); g.pillars.push({ x: 20, center: 400, gap: 300, passed: false, offset: 0, phase: 0, orb: null });
g.update(1 / 60); assert.strictEqual(g.score, 2, "double points");
g = withOrb("gravity"); g.hero.vy = 0; run(g, 0.2); assert.ok(g.hero.y < 400, "falls up");
g.flap(); assert.ok(g.hero.vy > 0, "flap pushes down");
g = withOrb("heavy"); g.hero.vy = 0; run(g, 0.2); assert.ok(g.hero.y - 400 > normalDrop * 1.3, "heavy falls faster");
g = withOrb("drunk"); g.hero.vy = 0; g.flap(); assert.ok(g.hero.vy >= 0, "drunk flap hasn't happened yet");
run(g, 0.3); assert.ok(g.events.some((e) => e.type === "flap"), "drunk flap arrived late");
g = withOrb("reversed"); g.hero.vy = 200; g.flap(); assert.strictEqual(g.hero.vy, 200, "taps do nothing when reversed");
run(g, 0.5); assert.ok(g.events.filter((e) => e.type === "flap").length >= 1, "flaps by itself");
g.events = []; g.setHolding(true); g.hero.y = 300; run(g, 0.4);
assert.strictEqual(g.events.filter((e) => e.type === "flap").length, 0, "holding stops the flapping");
g = withOrb("fog"); close(g.fogLeft(), SETTINGS.fogTime, "fog");
g = withOrb("wind"); g.hero.y = 400; g.events = [];
for (let i = 0; i < 300 && !g.over; i++) { if (g.hero.y > 450) g.flap(); g.update(1 / 60); }
assert.ok(g.events.filter((e) => e.type === "gust").length >= 2, "gusts happen");
g = withOrb("sliding"); g.pillars.push({ x: 300, center: 400, gap: 300, passed: false, offset: 0, phase: 1, orb: null });
g.hero.y = 400; for (let i = 0; i < 90; i++) { if (g.hero.y > 400) g.flap(); g.update(1 / 60); }
assert.ok(Math.abs(g.pillars[0].offset) > 5, "pillars slide");
for (const name of Object.keys(ORBS)) assert.ok(ORBS[name].text && ORBS[name].popup, `${name} has a message`);
console.log("orb effects OK");

// Shield: survives one crash, then the next one is real
g = openSky(); g.shield = true; g.hero.y = 700; g.hero.vy = 500; run(g, 0.3);
assert.strictEqual(g.over, null, "shield saved a floor crash"); assert.ok(!g.shield);
assert.ok(g.events.some((e) => e.type === "shieldSave"));
g = openSky(); g.shield = true; g.pillars.push({ x: SETTINGS.heroX - 10, center: 150, gap: 150, passed: false, offset: 0, phase: 0, orb: null });
g.hero.y = 500; g.hero.vy = 0; g.update(1 / 60);
assert.strictEqual(g.over, null); run(g, 0.5); assert.strictEqual(g.over, null, "safe for a moment after");
g.pillars = [{ x: SETTINGS.heroX - 10, center: 150, gap: 150, passed: false, offset: 0, phase: 0, orb: null }];
g.time = g.safeUntil + 0.01; g.hero.y = 500; g.hero.vy = 0; g.update(1 / 60);
assert.ok(g.over && g.over.startsWith("You hit a pillar"), "second crash is real");
console.log("shield OK");

// Sudden events in chaos mode only, with a warning first
g = new WingsGame(); g.flap(); g.nextSuddenAt = g.time + 0.1; g.pillars = []; g.addPillar = function () {};
for (let i = 0; i < 20; i++) { if (g.hero.y > 330) g.flap(); g.update(1 / 60); }
assert.ok(g.sudden && g.events.some((e) => e.type === "suddenWarning"));
const type = g.sudden.type; assert.ok(!g.suddenActive(type), "not active during the warning");
for (let i = 0; i < 70; i++) { if (g.hero.y > 330) g.flap(); g.update(1 / 60); }
assert.ok(g.suddenActive(type) || type === "gust", "active after the warning");
g = new WingsGame({ classic: true }); g.flap(); g.pillars = []; g.addPillar = function () {};
for (let i = 0; i < 60 * 70; i++) { if (g.hero.y > 330) g.flap(); g.update(1 / 60); }
assert.strictEqual(g.sudden, null, "nothing sudden in classic");
console.log("sudden events OK");

// Long games with a computer pilot: nothing breaks and Grump never leaves the board alive
const results = { chaos: [], classic: [] };
for (let seed = 0; seed < 40; seed++) {
  const classic = seed % 2 === 1;
  g = new WingsGame({ classic });
  g.flap();
  let frames = 0;
  while (!g.over && frames < 60 * 60 * 5) {
    const next = g.pillars.find((p) => p.x + SETTINGS.pillarWidth > SETTINGS.heroX - 20);
    const target = next ? g.gapCenter(next) + 12 : 380;
    const flipped = g.gravityLeft() > 0;
    if (g.reversedLeft() > 0) {
      g.setHolding(g.hero.y < target);
    } else {
      g.setHolding(false);
      if (!flipped && g.hero.y > target && g.hero.vy > -60) g.flap();
      if (flipped && g.hero.y < target - 24 && g.hero.vy < 60) g.flap();
    }
    g.update(1 / 60);
    frames++;
    assert.ok(Number.isFinite(g.hero.y) && Number.isFinite(g.hero.vy) && Number.isFinite(g.score));
    if (!g.over) {
      assert.ok(g.hero.y >= -1 && g.hero.y <= SETTINGS.groundY + 1, `Grump escaped: ${g.hero.y}`);
    }
  }
  results[classic ? "classic" : "chaos"].push(g.score);
}
const avg = (list) => (list.reduce((a, b) => a + b, 0) / list.length).toFixed(1);
console.log("long games OK  chaos scores", results.chaos.join(" "), "avg", avg(results.chaos));
console.log("               classic scores", results.classic.join(" "), "avg", avg(results.classic));
