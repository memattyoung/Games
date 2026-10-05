# Chaos Sweeper

Matt Young presents **Chaos Sweeper**, part of the [Rage Quit Menu](https://memattyoung.github.io/Games/).

**[Play it here](https://memattyoung.github.io/Games/sweeper/)** on a phone or a computer.

A bomb-finding puzzle where the numbers lie, the bombs move, and the clock hates you.

## Two modes

Pick a mode (and a board size) on the start screen. Each mode keeps its own best score.

- **Chaos:** everything described below.
- **Classic:** just bombs, numbers and a clock counting up. Nothing moves, nothing lies.

## How to play

- **Computer:** left click digs, right click (or Shift+click) flags. F flips the Dig/Flag switch, P pauses.
- **Phone:** tap to dig, hold to flag, or use the Dig/Flag switch under the board.
- Each number says how many bombs touch that square, diagonals included. Dig every square that
  isn't a bomb to win. Your first dig is always safe.
- Dig a number that already has enough flags around it and its other neighbours get dug for you.

| Size | Board | Bombs | Chaos time limit / Classic par | Points multiplier |
| --- | --- | --- | --- | --- |
| Easy | 8 × 10 | 12 | 2:30 | ×1 |
| Normal | 10 × 13 | 24 | 5:00 | ×2 |
| Hard | 12 × 16 | 40 | 8:00 | ×3 |

### Points

1 point per square you dig (times the multiplier). Winning adds 500 (times the multiplier) plus 10
points for every second left on the clock in Chaos, or every second under par in Classic.

### The clock (Chaos mode)

It starts on your first dig. Run out and you lose. Under 20 seconds, the board starts to panic.

### Mystery capsules (Chaos mode)

Some safe squares hide a capsule. They all look the same until you dig one up:

| Kind | What it does (one of these, at random) |
| --- | --- |
| Good | Free flag (a bomb gets flagged for you) · Free dig (a patch of safe squares gets dug) · Time freeze for 10s · X-ray: see nearby bombs for 2s |
| Bad | Shuffle: up to 3 unflagged bombs move · Fog: numbers vanish for 6s · Liar: some numbers are off by one for 6s (they glitch) · Turbo clock: double speed for 10s · An extra bomb gets planted |

Bombs never move into or out of a flagged square, so correct flags stay correct. When bombs move,
numbers that changed flash yellow.

## What's in here

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The web page and its layout |
| `logic.js` | The game rules, with no drawing code |
| `game.js` | Drawing, controls and screens |
| `logic.test.js` | Tests for the rules: `node logic.test.js` |
| `thumb.svg` | The picture on the Rage Quit Menu card |

When you change `style.css`, `logic.js` or `game.js`, bump the `?v=` number on them in `index.html`.
Otherwise browsers can keep using the old files for a few minutes and the game breaks.
