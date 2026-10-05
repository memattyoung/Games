# Rage Quit Brick Breaker

Matt Young presents **Rage Quit Brick Breaker**.

**[Play it here](https://memattyoung.github.io/Games/bricks/)** on a phone or a computer.

A brick breaker where every capsule is a mystery, and most of them hate you.

## Two modes

Pick a mode on the start screen. Each mode keeps its own best score.

- **Rage Quit:** the chaos described below.
- **Classic:** plain brick breaker. No capsules, no creeping wall, no combos.

## How to play

- **Computer:** move with the mouse, or the arrow keys (or A and D). Space or a click launches the
  ball, and P pauses.
- **Phone:** drag anywhere and the paddle follows your finger. Tap to launch.
- If you don't launch, the ball launches itself after 3 seconds.

Break every brick to clear the level. Each level adds more bricks, and some take a few hits. You
get 3 lives.

### The wall (Rage Quit)

The whole wall creeps down a row every 10 to 24 seconds, faster when there are more bricks left. If
it reaches the red line above your paddle, the game is over, even with lives left.

### Points

10 points a brick, times your combo: every brick you break before the ball comes back to your
paddle adds 1 to it. Clearing a level is worth 100 times the level number. Now and then a brick
turns rainbow for 8 seconds and is worth 250 points (times your combo).

### Mystery capsules (Rage Quit)

About 1 in 5 broken bricks drops a capsule. They all look the same until you catch one:

| Kind | What it does (one of these, at random) |
| --- | --- |
| Good | Wide paddle for 10s · Multiball (+2 balls) · Slow-mo ball for 10s · Sticky paddle for 10s · Safety net (saves one ball) · Extra life (rare) |
| Bad | Reversed controls for 10s · Drunk paddle (lags 0.5s behind) for 10s · Tiny paddle for 10s · Fast ball for 10s · Fog for 6s · Invisible ball for 6s · An unbreakable steel brick |

The paddle turns purple when drunk and orange when reversed, and flashes when an effect is about
to wear off. From level 3 the wall also has some steel bricks in it.

## What's in here

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The web page and its layout |
| `logic.js` | The game rules and physics, with no drawing code |
| `game.js` | Drawing, controls and screens |
| `logic.test.js` | Tests for the rules: `node logic.test.js` |

When you change `style.css`, `logic.js` or `game.js`, bump the `?v=` number on them in `index.html`.
Otherwise browsers can keep using the old files for a few minutes and the game breaks.
