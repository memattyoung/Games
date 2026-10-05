# Chaos Paddle

Matt Young presents **Chaos Paddle**, part of the [Rage Quit Menu](https://memattyoung.github.io/Games/).

**[Play it here](https://memattyoung.github.io/Games/paddle/)** on a phone or a computer.

A paddle duel against Tuna Marie, a computer who talks a lot of trash, on a court full of mystery orbs
that make everything worse.

## Two modes

Pick a mode on the start screen. Each mode keeps its own best win streak.

- **Chaos:** everything described below.
- **Classic:** a plain duel. No orbs, no effects. Tuna Marie still has opinions.

## How to play

- **Computer:** move your paddle with the mouse, or the arrow keys (or A and D). P pauses.
- **Phone:** drag anywhere and your paddle follows your finger.
- You're at the bottom. Tuna Marie is at the top.

First to 7 points wins the match. Where the ball hits your paddle decides where it goes, and the
longer a rally goes, the faster the ball gets. Beat Tuna Marie and you go straight into the next match,
where he's faster and sharper. Your best score is your longest win streak.

### Mystery orbs (Chaos mode)

Orbs keep popping up in the middle of the court, and they all look the same. When the ball hits
one, whoever touched the ball last gets the effect, Tuna Marie included:

| Kind | What it does (one of these, at random) |
| --- | --- |
| Good | Giant paddle for 10s · Multiball (+2 balls) · Curveballs for 10s · Slow-mo for 10s (the ball slows down coming at you) · A shield that saves one ball |
| Bad | Tiny paddle for 10s · Reversed controls for 10s · Drunk paddle (lags 0.5s behind) for 10s · Fog for 6s · Invisible ball for 6s · The court tilts for 8s |

Paddles turn purple when drunk and orange when reversed, and flash when an effect is about to wear
off. Tuna Marie's effects are listed under his paddle.

## What's in here

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The web page and its layout |
| `logic.js` | The game rules, physics and Tuna Marie's brain, with no drawing code |
| `game.js` | Drawing, controls, screens and Tuna Marie's mouth |
| `logic.test.js` | Tests for the rules: `node logic.test.js` |
| `thumb.svg` | The picture on the Rage Quit Menu card |

When you change `style.css`, `logic.js` or `game.js`, bump the `?v=` number on them in `index.html`.
Otherwise browsers can keep using the old files for a few minutes and the game breaks.
