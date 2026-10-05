# Chaos Rocks

Matt Young presents **Chaos Rocks**, part of the [Rage Quit Menu](https://memattyoung.github.io/Games/).

**[Play it here](https://memattyoung.github.io/Games/rocks/)** on a phone or a computer.

A space-rock shooter where every capsule is a mystery, and space itself is out to get you.

## Two modes

Pick a mode on the start screen. Each mode keeps its own best score.

- **Chaos:** everything described below.
- **Classic:** the plain space-rock shooter. No capsules, no rainbow rocks.

## How to play

- **Computer:** turn with the left and right arrows (or A and D), thrust with up (or W), hold Space to
  shoot. Down, S or Shift jumps to hyperspace, and P pauses.
- **Phone:** push the joystick the way you want to face, and all the way out to fly that way. Hold
  FIRE to shoot, tap WARP for hyperspace.
- Everything wraps around the edges, including you.

Big rocks split into medium ones, medium into small, and small ones are gone. Clear the wave and a
bigger one arrives. A UFO drops by now and then to shoot at you. You get 3 lives and an extra one
every 10,000 points. Hyperspace is a gamble: 1 jump in 12 or so blows you up.

### Points

Big rocks 20, medium 50, small 100, UFO 300. In Chaos mode a rock sometimes turns rainbow for 10
seconds; smash it for 1000 points and a free capsule.

### Mystery capsules (Chaos mode)

About 1 in 7 smashed rocks drops a capsule. They all look the same until you fly into one:

| Kind | What it does (one of these, at random) |
| --- | --- |
| Good | Shield (one free crash, up to 15s) · Rapid fire for 10s · Spread shot for 10s · Slow rocks for 10s · Smart bomb (wipes out rocks near you) · Extra life (rare) |
| Bad | Reversed controls for 10s · Drunk steering (0.5s late) for 10s · Fog for 6s · A black hole for 8s that pulls you in (shields don't help) · Rocks split into more pieces for 10s · Slippery space, no brakes, for 10s · Curvy bullets for 10s |

The ship turns purple when drunk and orange when reversed, and flashes when an effect is about to
wear off.

## What's in here

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The web page and its layout |
| `logic.js` | The game rules and physics, with no drawing code |
| `game.js` | Drawing, controls and screens |
| `logic.test.js` | Tests for the rules: `node logic.test.js` |
| `thumb.svg` | The picture on the Rage Quit Menu card |

When you change `style.css`, `logic.js` or `game.js`, bump the `?v=` number on them in `index.html`.
Otherwise browsers can keep using the old files for a few minutes and the game breaks.
