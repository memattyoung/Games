# Chaos Crossing

Matt Young presents **Chaos Crossing**, part of the [Rage Quit Menu](https://memattyoung.github.io/Games/).

**[Play it here](https://memattyoung.github.io/Games/crossing/)** on a phone or a computer.

This is Pip. Pip is a small, anxious blob who lives on the other side of a busy road and a river.
Get Pip home. Try not to make it worse.

## Two modes

Pick a mode on the start screen. Each mode keeps its own best score.

- **Chaos:** everything described below.
- **Classic:** a plain crossing game. No mystery boxes, no random events.

## How to play

- **Computer:** hop with the arrow keys or WASD. P pauses, Space starts.
- **Phone:** swipe to hop, tap to hop forward, or use the arrow buttons under the board.

Hop Pip across 5 lanes of traffic, a grassy strip, then 5 lanes of river (ride the logs and rubber
duck floats, because Pip can't swim) into one of the 5 empty homes in the hedge. Fill all 5 to clear
the level. Each level speeds everything up and adds traffic.

Pip gets splatted by anything with wheels, by falling in the water, by floating off the edge, by
hopping into the hedge or a full home, and by running out of time (30 seconds a crossing, a little
less on later levels). You get 3 lives.

### Points

10 points for every new row, 50 for getting home plus 5 for every second left, and 200 times the
level number for clearing a level.

### Mystery boxes (Chaos mode)

Gift boxes turn up on the road and the grassy strip, and vanish after 9 seconds. They all look the
same until Pip grabs one:

| Kind | What it does (one of these, at random) |
| --- | --- |
| Good | Shield (one free splat, back to the last safe strip) · Slow traffic for 8s · Time freeze for 4s · Super hop (two rows at a time) for 8s · Extra life (rare) |
| Bad | Reversed controls for 10s · Drunk hops (0.4s late) for 10s · Fog for 6s · Rush hour for 8s · Swerving cars for 8s · Sinking logs for 8s · A wind gust for 5s |

### Random events (Chaos mode)

Every 18 to 32 seconds something happens: a road crew closes a lane with cones you can't hop
through, or a speed demon blasts down a lane after a short warning.

Pip turns purple when drunk and orange when reversed (half and half when both), and flashes when an
effect is about to wear off.

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
