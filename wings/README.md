# Chaos Wings

Matt Young presents **Chaos Wings**, part of the [Rage Quit Menu](https://memattyoung.github.io/Games/).

**[Play it here](https://memattyoung.github.io/Games/wings/)** on a phone or a computer.

Tap to flap. Fly Grump, a small and deeply grumpy fluffball, through the gaps in the pillars while
everything else tries to ruin your day.

## Two modes

Pick a mode on the start screen. Each mode keeps its own best score.

- **Chaos:** everything described below.
- **Classic:** the plain one-tap flyer. No orbs, no surprises.

## How to play

- **Computer:** Space, the up arrow or a click flaps. P pauses.
- **Phone:** tap anywhere to flap.
- 1 point for every gap. Touch a pillar, the ceiling or the floor and it's over. No lives.
- The pillars speed up and the gaps get tighter the better you do.
- The game counts your deaths tonight. It resets after 6 hours without dying, so it's always
  "tonight".

### Mystery orbs (Chaos mode)

About 1 in 3 gaps (after the first two) has an orb in it. They all look the same until you fly
through one:

| Kind | What it does (one of these, at random) |
| --- | --- |
| Good | Shield (survive one crash) · Slow-mo · Tiny Grump · Double points |
| Bad | Gravity flip (fall up, tap to go down) · Reversed (Grump flaps by itself, hold to drop) · Drunk (flaps arrive 0.25s late) · Fog · Wind gusts · Heavy · Sliding pillars |

Effects last 8 seconds (fog lasts 6). Grump turns purple when drunk and orange when reversed, and
flashes when an effect is about to wear off.

### Out of nowhere (Chaos mode)

Every 18 to 30 seconds something just happens, with one second of warning: the screen flips upside
down, an earthquake, a disco, or a big gust of wind.

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
