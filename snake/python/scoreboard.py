from turtle import Turtle
from board import (CELL, LEFT_WALL, RIGHT_WALL, TEXT, DIM_TEXT, GREEN, GOLD, RED, TRACK,
                   PURPLE_DEEP, PURPLE_TRACK, blend, draw_bar)
from food import REVEAL_SHAPES, TYPE_COLORS
from snake import EFFECT_TIME

HUD_LEFT = LEFT_WALL - CELL / 2 + 10
HUD_RIGHT = RIGHT_WALL + CELL / 2
ROW_1 = 366
ROW_2 = 342
FONT = ("Arial", 14, "bold")
SMALL_FONT = ("Arial", 12, "bold")

FOOD_X = HUD_LEFT + 120
HUNGER_WIDTH = 180
HUNGER_LEFT = HUD_RIGHT - HUNGER_WIDTH
PILL_WIDTH = 160
DRUNK_LEFT = HUD_RIGHT - PILL_WIDTH
REVERSED_LEFT = DRUNK_LEFT - PILL_WIDTH - 10


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
        self.score = 0
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
        self.effects = make_writer()
        # What's currently on screen, so things are only redrawn when they change
        self.drawn_stats = None
        self.drawn_hunger = None
        self.drawn_effects = None
        self.show_score()

    def reset_score(self):
        self.score = 0
        self.food_icon.hideturtle()
        self.food_text.clear()
        self.drawn_stats = None
        self.drawn_hunger = None
        self.drawn_effects = None
        self.show_score()

    def show_score(self):
        self.clear()
        self.goto(HUD_LEFT, ROW_1)
        write_label(self, "SCORE", self.score)

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
        self.show_effects(snake.reversed_time_left(), snake.drunk_time_left())

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

    def show_effects(self, reversed_left, drunk_left):
        effects = (round(reversed_left, 1), round(drunk_left, 1))
        if effects == self.drawn_effects:
            return
        self.drawn_effects = effects

        self.effects.clear()
        if reversed_left > 0:
            self.draw_effect(REVERSED_LEFT, "REVERSED", reversed_left)
        if drunk_left > 0:
            self.draw_effect(DRUNK_LEFT, "DRUNK", drunk_left)

    def draw_effect(self, left, name, time_left):
        # A pill that drains from full to empty as the effect wears off
        pen = self.effects
        draw_bar(pen, left, ROW_2 - 3, PILL_WIDTH, 22, PURPLE_TRACK)
        draw_bar(pen, left, ROW_2 - 3, PILL_WIDTH * time_left / EFFECT_TIME, 22, PURPLE_DEEP)
        pen.goto(left + PILL_WIDTH / 2, ROW_2)
        pen.color(TEXT)
        pen.write(f"{name}  {time_left:.1f}s", align="center", font=SMALL_FONT)
