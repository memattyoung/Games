# Chaos Swarm

Matt Young presents **Chaos Swarm**, part of the [Rage Quit Menu](https://memattyoung.github.io/Games/).

**[Play it here](https://memattyoung.github.io/Games/swarm/)** on a phone or a computer.

An alien-wave shooter where every capsule is a mystery, the swarm has opinions about you, and some
of them have learned to dodge.

## Two modes

Pick a mode on the start screen. Each mode keeps its own best score.

- **Chaos:** everything described below.
- **Classic:** a plain wave shooter. No capsules, no boss, no combos.

## How to play

- **Computer:** move with the mouse or the arrow keys (or A and D). Hold Space or the mouse button
  to shoot. P pauses.
- **Phone:** drag anywhere and your ship follows your finger. It shoots by itself.

The swarm marches side to side and drops a row every time it reaches an edge, and it speeds up as
it thins out. Every so often one of them breaks formation and dives at you. Clear the swarm and a
meaner one arrives. You get 3 lives, and the game is over if you lose them all or the swarm reaches
the red line above your ship.

### Points

Bottom row 10, middle 20, top row 30, and double for shooting a diver. Every 5 kills in a row without
missing adds 1 to your multiplier, up to ×5. Clearing a wave is worth 200 times the wave number. In
Chaos mode a rainbow boss in sunglasses floats across the top every 25 to 45 seconds: 3 hits for 500
points (times your multiplier).

### Mystery capsules (Chaos mode)

About 1 in 7 dead aliens drops a capsule. They all look the same until you fly into one:

| Kind | What it does (one of these, at random) |
| --- | --- |
| Good | Spread shot for 10s · Rapid fire for 10s · Piercing laser for 10s · Slow swarm for 10s · Shield (takes one hit) · Extra life (rare) |
| Bad | Reversed controls for 10s · Drunk ship (lags 0.5s behind) for 10s · Jammed gun for 10s · Fog for 6s · Swarm speed-up for 10s · Boomerang bullets for 10s (misses come back at you) · The swarm learns to dodge for 8s |

Your ship turns purple when drunk and orange when reversed, and flashes when an effect is about to
wear off.

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
