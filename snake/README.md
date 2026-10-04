# Rage Quit Snake

Matt Young presents **Rage Quit Snake**.

**[Play it here](https://memattyoung.github.io/Games/snake/)** on a phone or a computer.

Snake, with a twist: every apple looks the same, but some help you and some don't.
You only find out what you ate after you eat it.

## How to play

- **Computer:** steer with the arrow keys or WASD. P pauses, Space starts.
- **Phone:** swipe on the board, or use the arrow buttons under it.
- Hit a wall or your own body and the game is over.

### Hunger

Your snake is always hungry and keeps shrinking, and the longer it is, the faster it shrinks
(one segment every 30 ÷ length seconds). If it shrinks down to nothing, it starves to death.

### Apples

There are always 3 apples on the board. Each one is worth 1 point and is one of these, at random:

| Apple | What it does |
| --- | --- |
| Normal | Grow 1 segment and speed up 5% |
| Benefit | Either slow down 10%, or grow 2 segments |
| Bad | One of: speed up 20%, lose 3 segments (never below 2), reversed controls for 10 seconds, or drunk for 10 seconds (every turn happens half a second late) |

Speed always stays between 0.5x and 4x.

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

### Running the Python version

It needs Python 3 with Tk (included with the python.org installers):

```
cd python
python3 main.py
```
