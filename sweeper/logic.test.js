// Tests for the game rules. Run with: node logic.test.js
const assert = require("assert");
const { SweeperGame, SIZES, SETTINGS, CAPSULES } = require("./logic.js");

// A game with bombs exactly where we say, already started
function boardWith(mines, { classic = false, size = "easy", capsules = [] } = {}) {
  const g = new SweeperGame({ classic, size });
  for (const [x, y] of mines) g.cell(x, y).mine = true;
  for (const [x, y] of capsules) g.cell(x, y).capsule = true;
  g.mineCount = mines.length;
  g.started = true;
  return g;
}
// Checks that the board is never in a state that can't happen
function checkBoard(g, label) {
  for (const cell of g.cells) {
    if (cell.revealed) assert.ok(!cell.mine, `${label}: a bomb is showing as dug`);
    if (cell.revealed) assert.ok(!cell.flagged, `${label}: a dug square is flagged`);
    if (cell.revealed && g.number(cell) === 0 && !g.over) {
      for (const n of g.neighbours(cell)) {
        assert.ok(n.revealed || n.flagged, `${label}: a 0 still has hidden neighbours`);
      }
    }
  }
  assert.strictEqual(g.cells.filter((c) => c.mine).length, g.mineCount, `${label}: bomb count is off`);
}

// Numbers count every touching bomb, diagonals included
let g = boardWith([[0, 0], [2, 0], [1, 2]]);
assert.strictEqual(g.number(g.cell(1, 1)), 3);
assert.strictEqual(g.number(g.cell(1, 0)), 2);
assert.strictEqual(g.number(g.cell(7, 9)), 0);
console.log("numbers OK");

// The first dig is always safe and opens an area; bombs only appear after it
for (let i = 0; i < 300; i++) {
  g = new SweeperGame({ size: ["easy", "normal", "hard"][i % 3] });
  assert.strictEqual(g.cells.filter((c) => c.mine).length, 0, "no bombs before the first dig");
  const x = i % g.cols, y = (i * 7) % g.rows;
  g.dig(x, y);
  assert.strictEqual(g.over, null, "first dig blew up");
  assert.strictEqual(g.number(g.cell(x, y)), 0);
  assert.ok(g.cells.filter((c) => c.revealed).length >= 4, "first dig should open an area");
  assert.strictEqual(g.cells.filter((c) => c.mine).length, g.size.mines);
  assert.strictEqual(g.cells.filter((c) => c.capsule).length, g.size.capsules);
  assert.ok(g.cells.every((c) => !(c.capsule && c.revealed)), "the first dig shouldn't open capsules");
  checkBoard(g, "first dig");
}
console.log("first dig OK");

// Flood fill opens zeros and stops at numbers
g = boardWith([[7, 9]]);
g.dig(0, 0);
assert.strictEqual(g.cells.filter((c) => c.revealed).length, 80 - 1, "everything but the bomb opens");
assert.strictEqual(g.won, true, "and that's a win");
console.log("flood fill + win OK");

// Flags stop digs, can't be placed before the first dig, and chording works
g = new SweeperGame({ size: "easy" });
g.toggleFlag(3, 3); assert.ok(!g.cell(3, 3).flagged); assert.ok(g.events.some((e) => e.type === "flagEarly"));
g = boardWith([[1, 0], [5, 5]]);
g.toggleFlag(1, 0); g.dig(1, 0); assert.ok(!g.cell(1, 0).revealed, "flagged squares can't be dug");
g.dig(0, 0); assert.ok(g.cell(0, 0).revealed);
g.dig(0, 0);  // chord: 1 flag around a 1, so the rest of its neighbours open
assert.ok(g.cell(0, 1).revealed && g.cell(1, 1).revealed);
g = boardWith([[1, 0], [5, 5]]); g.dig(0, 0); g.toggleFlag(0, 1); g.dig(0, 0);
assert.strictEqual(g.over, "You dug up a grumpy bomb.", "chording with a wrong flag blows up");
console.log("flags + chording OK");

// Losing
g = boardWith([[4, 4]]); g.dig(4, 4);
assert.strictEqual(g.won, false); assert.ok(g.cell(4, 4).exploded); assert.ok(g.events.some((e) => e.type === "boom"));
console.log("boom OK");

// Points: 1 per square times the size, plus the win bonus and time left
g = boardWith([[0, 0], [1, 0]], { size: "normal" });
g.dig(9, 12);
const dug = g.cells.filter((c) => c.revealed).length;
assert.strictEqual(g.won, true);
assert.strictEqual(g.score, dug * 2 + 500 * 2 + 300 * 10);
console.log("scoring OK");

// The clock: Chaos counts down and runs out, Classic counts up and never ends the game
g = boardWith([[0, 0]]); g.update(SIZES.easy.par - 1);
assert.strictEqual(g.over, null); assert.ok(g.events.some((e) => e.type === "panic"));
g.update(1.1); assert.strictEqual(g.over, "Time's up. The bombs win by forfeit.");
g = boardWith([[0, 0]], { classic: true }); g.update(10000);
assert.strictEqual(g.over, null); assert.strictEqual(Math.round(g.clockShown()), 10000);
g = new SweeperGame({ size: "easy" }); g.update(50); assert.strictEqual(g.clock, SIZES.easy.par, "no clock before the first dig");
console.log("clock OK");

// Classic has no capsules
for (let i = 0; i < 50; i++) {
  g = new SweeperGame({ classic: true, size: "hard" }); g.dig(5, 5);
  assert.strictEqual(g.cells.filter((c) => c.capsule).length, 0);
}
console.log("classic has no capsules OK");

// Capsules: digging one up sets it off, once
// The default bombs sit next to the capsule square, so digging it opens just that one square
function withCapsule(name, mines = [[2, 2], [4, 4], [7, 9], [0, 9]], extra = {}) {
  const game = boardWith(mines, { capsules: [[3, 3]], ...extra });
  game.useCapsuleFor = name;
  const real = game.useCapsule.bind(game);
  game.drainCapsules = function () {
    while (this.capsuleQueue.length && !this.over) {
      const cell = this.capsuleQueue.shift();
      if (cell.capsuleUsed) continue;
      cell.capsuleUsed = true;
      real(name, cell);
    }
    this.checkWin();
  };
  return game;
}
g = withCapsule("freeze");
g.dig(3, 3);
assert.ok(g.cell(3, 3).capsuleUsed); assert.ok(g.frozenLeft() > 0);
const caught = g.events.find((e) => e.type === "capsule");
assert.strictEqual(caught.name, "freeze"); assert.strictEqual(caught.text, CAPSULES.freeze.text);
const clockBefore = g.clock; g.update(5); assert.strictEqual(g.clock, clockBefore, "frozen clock doesn't move");
g.update(6); assert.ok(g.clock < clockBefore, "and starts again after 10s");
console.log("freeze OK");

g = withCapsule("turbo"); g.dig(3, 3);
const turboStart = g.clock; g.update(2); assert.ok(Math.abs(turboStart - g.clock - 4) < 1e-9, "turbo runs at double speed");
console.log("turbo OK");

g = withCapsule("xray"); g.dig(3, 3);
assert.deepStrictEqual(g.xrayCenter, { x: 3, y: 3 }); assert.strictEqual(g.xrayLeft(), SETTINGS.xrayTime);
g = withCapsule("fog"); g.dig(3, 3); assert.strictEqual(g.fogLeft(), SETTINGS.fogTime);
console.log("x-ray + fog OK");

// Liar: some shown numbers are wrong by one, the real ones never change, and it wears off
g = withCapsule("liar", [[0, 0], [2, 0], [4, 0], [6, 0], [0, 2], [7, 9]]);
g.dig(5, 6);
const numbered = g.cells.filter((c) => c.revealed && g.number(c) > 0);
const lying = numbered.filter((c) => g.shownNumber(c) !== g.number(c));
assert.ok(lying.length >= 1, "something should be lying");
for (const c of lying) assert.strictEqual(Math.abs(g.shownNumber(c) - g.number(c)), 1);
g.update(SETTINGS.liarTime + 0.1);
assert.ok(numbered.every((c) => g.shownNumber(c) === g.number(c)), "the truth comes back");
console.log("liar OK");

// Free flag picks a real, unflagged bomb next to the open area
g = withCapsule("autoflag"); g.dig(3, 3);
const gifts = g.cells.filter((c) => c.gift);
assert.strictEqual(gifts.length, 1); assert.ok(gifts[0].mine && gifts[0].flagged);
console.log("free flag OK");

// Free dig opens safe squares only
g = withCapsule("patch", [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0], [7, 0], [0, 5], [7, 5]]);
g.cell(3, 3).capsule = true;
g.dig(3, 3);
const before = g.cells.filter((c) => c.revealed).length;
assert.strictEqual(g.over === null || g.won, true, "a free dig never blows up");
checkBoard(g, "free dig");
console.log("free dig OK", before);

// Shuffle: flagged bombs stay, nothing moves into a flagged square, and the board stays consistent
for (let i = 0; i < 300; i++) {
  g = new SweeperGame({ size: "normal" }); g.dig(4, 6);
  const bombs = g.cells.filter((c) => c.mine);
  bombs.slice(0, 5).forEach((c) => (c.flagged = true));
  const wrong = g.cells.filter((c) => !c.mine && !c.revealed && !c.capsule)[0];
  wrong.flagged = true;
  const flaggedBombs = bombs.slice(0, 5);
  g.applyCapsule("shuffle", g.cell(4, 6));
  assert.ok(flaggedBombs.every((c) => c.mine), "a flagged bomb moved");
  assert.ok(!wrong.mine, "a bomb moved under a wrong flag");
  assert.strictEqual(g.cells.filter((c) => c.mine).length, g.size.mines);
  checkBoard(g, "shuffle");
}
g = new SweeperGame({ size: "easy" }); g.dig(4, 5); g.applyCapsule("shuffle", g.cell(4, 5));
assert.ok(g.events.some((e) => e.type === "numbersChanged"));
console.log("shuffle OK");

// Plant: one more bomb, in a hidden unflagged square
for (let i = 0; i < 200; i++) {
  g = new SweeperGame({ size: "easy" }); g.dig(4, 5);
  const count = g.mineCount;
  g.applyCapsule("plant", g.cell(4, 5));
  assert.strictEqual(g.mineCount, count + 1);
  checkBoard(g, "plant");
}
console.log("plant OK");

// Every capsule has a message
for (const name of Object.keys(CAPSULES)) {
  g = withCapsule(name); g.dig(3, 3);
  const e = g.events.find((ev) => ev.type === "capsule");
  assert.ok(e && e.text && e.popup, `${name} message`);
}
console.log("capsule messages OK");

// Lots of games: a perfect player who digs safe squares (and uses the capsules) always wins,
// and random diggers never break the board
const results = { perfectWins: 0, randomLosses: 0, randomWins: 0, capsules: 0 };
for (let seed = 0; seed < 600; seed++) {
  const size = ["easy", "normal", "hard"][seed % 3];
  g = new SweeperGame({ size, classic: seed % 7 === 0 });
  g.dig(Math.floor(g.cols / 2), Math.floor(g.rows / 2));
  const perfect = seed % 2 === 0;
  for (let step = 0; step < 2000 && !g.over; step++) {
    const hidden = g.cells.filter((c) => !c.revealed && !c.flagged);
    if (!hidden.length) break;
    const safe = hidden.filter((c) => !c.mine);
    const pick = perfect && safe.length ? safe[Math.floor(Math.random() * safe.length)] : hidden[Math.floor(Math.random() * hidden.length)];
    if (!perfect && Math.random() < 0.15) g.toggleFlag(pick.x, pick.y);
    else g.dig(pick.x, pick.y);
    if (step % 3 === 0) g.update(0.5);
    checkBoard(g, `game ${seed}`);
    assert.ok(Number.isFinite(g.score) && g.score >= 0);
  }
  results.capsules += g.dug.good + g.dug.bad;
  if (perfect) {
    assert.ok(g.won || (g.over && g.over.startsWith("Time")), `perfect player lost game ${seed}: ${g.over}`);
    if (g.won) results.perfectWins += 1;
  } else if (g.won) results.randomWins += 1;
  else results.randomLosses += 1;
}
console.log("long games OK", results);
