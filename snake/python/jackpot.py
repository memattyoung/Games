import random
import time
from turtle import Turtle
from board import RAINBOW, show_if
from food import random_cell

JACKPOT_POINTS = 5
JACKPOT_TIME = 5          # seconds it stays on the board
JACKPOT_GAP = (20, 40)    # seconds until the next one shows up
SPARKLE_SPEED = 0.12      # seconds between each color of its shimmer
BLINK_TIME = 1.5          # it blinks for its last 1.5 seconds


class Jackpot(Turtle):
    """The sparkly rainbow apple: the only apple that looks different. It's worth extra points."""

    def __init__(self):
        super().__init__("rainbow_0")
        self.hideturtle()
        self.penup()
        self.setheading(90)
        self.active = False
        self.appears_at = 0
        self.leaves_at = 0

    def schedule(self):
        """Take it off the board, and pick when the next one shows up."""
        self.active = False
        self.hideturtle()
        self.appears_at = time.monotonic() + random.uniform(*JACKPOT_GAP)

    def update(self, is_free, fog):
        now = time.monotonic()
        if not self.active:
            if now < self.appears_at:
                return
            self.goto(random_cell(is_free))
            self.active = True
            self.leaves_at = now + JACKPOT_TIME
        if now >= self.leaves_at:
            self.schedule()
            return

        self.shape(f"rainbow_{int(now / SPARKLE_SPEED) % len(RAINBOW)}")
        blinked_off = self.leaves_at - now < BLINK_TIME and int(now / 0.15) % 2 == 1
        show_if(self, not blinked_off and not fog.hides(self))

    def is_at(self, x, y):
        return self.active and self.distance(x, y) < 10
