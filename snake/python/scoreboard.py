import math
import time
from tkinter import font as tkfont
from turtle import Turtle
from board import (CELL, LEFT_WALL, RIGHT_WALL, TEXT, DIM_TEXT, GREEN, GOLD, RED, TRACK, WINDOW_BG,
                   PURPLE, ORANGE, CYAN, blend, draw_bar)
from food import REVEAL_SHAPES, TYPE_COLORS, NORMAL, BENEFIT, BAD, RAINBOW
from snake import EFFECT_TIME
from fog import FOG_TIME

HUD_LEFT = LEFT_WALL - CELL / 2 + 10
HUD_RIGHT = RIGHT_WALL + CELL / 2
ROW_1 = 366
ROW_2 = 342
FONT = ("Arial", 14, "bold")
PILL_FONT = ("Arial", 9, "bold")

FOOD_X = HUD_LEFT + 120
HUNGER_WIDTH = 180
HUNGER_LEFT = HUD_RIGHT - HUNGER_WIDTH
PILLS_LEFT_LIMIT = HUD_LEFT + 240  # pills never go further left than this, past LENGTH and SPEED
PILL_PADDING = 6
PILL_GAP = 4

COMBO_TIME = 3   # eat the next apple within this many seconds to build a combo
MAX_COMBO = 5

# The pills for effects with a timer: (effect, label, color, how long it lasts)
EFFECT_PILLS = [
    ("reversed", "REVERSED", ORANGE, EFFECT_TIME),
    ("drunk", "DRUNK", PURPLE, EFFECT_TIME),
    ("fog", "FOG", DIM_TEXT, FOG_TIME),
    ("ghost", "GHOST", CYAN, EFFECT_TIME),
    ("runaway", "RUNAWAY", RED, EFFECT_TIME),
]


def make_writer():
    writer = Turtle()
    writer.hideturtle()
    writer.penup()
    return writer


def write_label(writer, label, value):
    """Write a dim label followed by a bright value, e.g. LENGTH 5."""
    writer.color(DIM_TEXT)
    writer.write(label + " ", move=True, font=FONT)
    writer.color(TEXT)
    writer.write(value, move=True, font=FONT)


class Scoreboard(Turtle):
    def __init__(self):
        super().__init__()
        self.hideturtle()
        self.penup()

        # A copy of the last food eaten, revealing what it really was
        self.food_icon = Turtle("apple")
        self.food_icon.hideturtle()
        self.food_icon.penup()
        self.food_icon.setheading(90)
        self.food_icon.goto(FOOD_X, ROW_1 + 10)
        self.food_text = make_writer()

        self.stats = make_writer()
        self.hunger_bar = make_writer()
        self.pills = make_writer()
        # Measures how wide a pill's text is, so each pill fits its words
        self.pill_font = tkfont.Font(family=PILL_FONT[0], size=PILL_FONT[1], weight=PILL_FONT[2])
        self.reset_score()

    def reset_score(self):
        self.score = 0
        self.combo = 1
        self.last_eaten = float("-inf")
        self.eaten = {NORMAL: 0, BENEFIT: 0, BAD: 0, RAINBOW: 0}
        self.food_icon.hideturtle()
        self.food_text.clear()
        # What's currently on screen, so things are only redrawn when they change
        self.drawn_stats = None
        self.drawn_hunger = None
        self.drawn_pills = None
        self.show_score()

    def show_score(self):
        self.clear()
        self.goto(HUD_LEFT, ROW_1)
        write_label(self, "SCORE", self.score)

    def score_apple(self, kind, points):
        """Add an apple's points with the combo bonus. Returns (points scored, combo)."""
        now = time.monotonic()
        if now - self.last_eaten <= COMBO_TIME:
            self.combo = min(self.combo + 1, MAX_COMBO)
        else:
            self.combo = 1
        self.last_eaten = now
        scored = points * self.combo
        self.score += scored
        self.eaten[kind] += 1
        self.show_score()
        return scored, self.combo

    def combo_time_left(self):
        if self.combo < 2:
            return 0
        return max(0, self.last_eaten + COMBO_TIME - time.monotonic())

    def breakdown(self):
        return (f"Ate {self.eaten[NORMAL]} normal · {self.eaten[BENEFIT]} benefit · "
                f"{self.eaten[BAD]} bad · {self.eaten[RAINBOW]} rainbow")

    def show_food(self, food_type, text):
        self.food_icon.shape(REVEAL_SHAPES[food_type])
        self.food_icon.showturtle()
        self.food_text.clear()
        self.food_text.goto(FOOD_X + 16, ROW_1)
        self.food_text.color(TYPE_COLORS[food_type])
        self.food_text.write(text, font=FONT)

    def update(self, snake):
        self.show_stats(len(snake.segments), snake.speed)
        self.show_hunger(snake.hunger, len(snake.segments) == 1)

        # Right to left: (text, color, how full the pill is)
        pills = []
        for effect, label, color, total in EFFECT_PILLS:
            time_left = snake.time_left(effect)
            if time_left > 0:
                pills.append((f"{label} {math.ceil(time_left)}s", color, time_left / total))
        if snake.shielded:
            pills.append(("SHIELD", CYAN, 1))
        combo_left = self.combo_time_left()
        if combo_left > 0:
            pills.append((f"COMBO ×{self.combo}", GOLD, combo_left / COMBO_TIME))
        self.show_pills(pills)

    def show_stats(self, length, speed):
        stats = (length, round(speed, 2))
        if stats == self.drawn_stats:
            return
        self.drawn_stats = stats

        self.stats.clear()
        self.stats.goto(HUD_LEFT, ROW_2)
        write_label(self.stats, "LENGTH", length)
        self.stats.goto(HUD_LEFT + 120, ROW_2)
        write_label(self.stats, "SPEED", f"{speed:.2f}x")

    def show_hunger(self, hunger, starving):
        fill_width = int((HUNGER_WIDTH - 4) * min(hunger, 1))
        if (fill_width, starving) == self.drawn_hunger:
            return
        self.drawn_hunger = (fill_width, starving)

        bar = self.hunger_bar
        bar.clear()
        bar.goto(HUNGER_LEFT - 10, ROW_1)
        if starving:
            bar.color(RED)
            bar.write("STARVING!", align="right", font=FONT)
            fill_color = RED
        else:
            bar.color(DIM_TEXT)
            bar.write("HUNGER", align="right", font=FONT)
            # Green when it's just lost a segment, turning yellow then red as the next one gets close
            if hunger < 0.5:
                fill_color = blend(GREEN, GOLD, hunger * 2)
            else:
                fill_color = blend(GOLD, RED, (hunger - 0.5) * 2)
        draw_bar(bar, HUNGER_LEFT, ROW_1 + 2, HUNGER_WIDTH, 16, TRACK)
        draw_bar(bar, HUNGER_LEFT + 2, ROW_1 + 4, fill_width, 12, fill_color)

    def show_pills(self, pills):
        # Only redraw when the words change or a pill drains a noticeable amount
        drawn = [(text, round(fullness * 40)) for text, color, fullness in pills]
        if drawn == self.drawn_pills:
            return
        self.drawn_pills = drawn

        pen = self.pills
        pen.clear()
        right = HUD_RIGHT
        for text, color, fullness in pills:
            width = self.pill_font.measure(text) + 2 * PILL_PADDING
            left = right - width
            if left < PILLS_LEFT_LIMIT:
                break  # no room for any more
            # Each pill drains from full to empty as its effect wears off
            draw_bar(pen, left, ROW_2 - 3, width, 20, blend(color, WINDOW_BG, 0.78))
            draw_bar(pen, left, ROW_2 - 3, width * fullness, 20, blend(color, "#000000", 0.35))
            pen.goto(left + width / 2, ROW_2 - 1)
            pen.color(TEXT)
            pen.write(text, align="center", font=PILL_FONT)
            right = left - PILL_GAP
