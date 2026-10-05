# Chaos Snake

Matt Young presents **Chaos Snake**, part of the [Rage Quit Menu](https://memattyoung.github.io/Games/).

**[Play it here](https://memattyoung.github.io/Games/snake/)** on a phone or a computer.

Snake, with a twist: every apple looks the same, but some help you and some don't.
You only find out what you ate after you eat it.

## Two modes

Pick a mode on the start screen. Each mode keeps its own best score.

- **Chaos:** everything described below.
- **Classic:** plain old snake. One apple at a time, each worth 1 point and 1 segment, and each
  one makes you 3% faster. No hunger, no surprises.

## How to play (Chaos mode)

- **Computer:** steer with the arrow keys or WASD. P pauses, Space starts.
- **Phone:** swipe on the board, or use the arrow buttons under it.
- Hit a wall, a rock or your own body and the game is over.

### Hunger

Your snake is always hungry and keeps shrinking, and the longer it is, the faster it shrinks
(one segment every 30 ÷ length seconds). If it shrinks down to nothing, it starves to death.

### Points

Every apple is worth 1 point. Eat the next one within 3 seconds for a combo: ×2, ×3, up to ×5.
Now and then a sparkly rainbow apple appears for 5 seconds. It's worth 5 points.

### Apples

There are always 3 apples on the board and they all look the same. Every apple grows your snake
by 1 segment unless it says otherwise. Each one is one of these, at random:

| Apple | What it does (one of these, at random) |
| --- | --- |
| Normal | Grow 1 segment and speed up 5% |
| Benefit | Grow 1 segment and slow down 10% · Grow 2 segments · Shield: your next crash is forgiven · Ghost: go through walls for 10 seconds |
| Bad | Speed up 20% · Lose 3 segments (never below 2) · Reversed controls for 10 seconds · Drunk for 10 seconds (turns happen half a second late) · A rock appears where you ate it · Fog for 5 seconds (you can only see near your head) · The apples run away from you for 10 seconds |

Your snake turns purple when drunk, orange when reversed and see-through as a ghost, and flashes
when an effect is about to wear off. Speed always stays between 0.5x and 4x.

## What's in here

The game was first written in Python with the `turtle` module, then rebuilt for the web so it
can be played in a browser and on phones.

| File | What it is |
| --- | --- |
| `index.html`, `style.css` | The web page and its layout |
| `logic.js` | The game rules, with no drawing code |
| `game.js` | Drawing, controls and screens |
| `logic.test.js` | Tests for the rules: `node logic.test.js` |
| `python/` | The original Python version |

When you change `style.css`, `logic.js` or `game.js`, bump the `?v=` number on them in `index.html`.
Otherwise browsers can keep using the old files for a few minutes and the game breaks.

### Running the Python version

It needs Python 3 with Tk (included with the python.org installers):

```
cd python
python3 main.py
```
