import time
from turtle import Turtle
from board import (CELL, LEFT_WALL, RIGHT_WALL, BOTTOM_WALL, TOP_WALL, BOARD_CENTER,
                   BODY_START, BODY_END, DEAD_START, DEAD_END, blend)

START_X = round(BOARD_CENTER[0])
START_POSITION = [(START_X, 0), (START_X - CELL, 0), (START_X - 2 * CELL, 0)]
UP = 90
DOWN = 270
LEFT = 180
RIGHT = 0
OPPOSITE = {UP: DOWN, DOWN: UP, LEFT: RIGHT, RIGHT: LEFT}
STEP = {UP: (0, CELL), DOWN: (0, -CELL), LEFT: (-CELL, 0), RIGHT: (CELL, 0)}

START_DELAY = 0.2    # seconds between moves at normal speed
MIN_SPEED = 0.5      # half speed  (0.4s between moves)
MAX_SPEED = 4.0      # four times  (0.05s between moves)
SHRINK_TIME = 30     # the snake loses a segment every SHRINK_TIME / length seconds
EFFECT_TIME = 10     # how long reversed or drunk controls last, in seconds
DRUNK_DELAY = 0.5    # how far behind the controls are when drunk, in seconds


class Snake:
    def __init__(self):
        self.segments = []
        self.spare_segments = []
        self.reset()

    def reset(self):
        """Put everything back the way it is at the start of a game."""
        for segment in self.segments:
            segment.hideturtle()
            self.spare_segments.append(segment)
        self.segments = []
        self.longest = 0
        self.create_snake()
        self.head = self.segments[0]
        self.head.shape("snake_head")
        self.head.setheading(RIGHT)
        self.recolor()
        # The direction the snake actually moved last step. Turns are checked against
        # this (not the head's current heading) so two quick key presses in one frame
        # can't spin the snake back into itself.
        self.last_heading = RIGHT
        # Key presses waiting to be applied, as (time to apply, heading)
        self.pending_turns = []
        self.speed = 1.0
        self.reversed_until = 0
        self.drunk_until = 0
        # Builds up from 0 to 1; when it reaches 1 the snake loses a segment
        self.hunger = 0
        self.last_hunger_update = time.monotonic()
        self.starved = False
        self.blocked_by_wall = False

    def create_snake(self):
        for position in START_POSITION:
            self.make_segment(position)

    def make_segment(self, position):
        # Reuse a segment the snake lost earlier, if there is one
        if self.spare_segments:
            new_segment = self.spare_segments.pop()
            new_segment.shape("segment")  # it might have been the head last game
            new_segment.showturtle()
        else:
            new_segment = Turtle("segment")
            new_segment.penup()
        new_segment.goto(position)
        self.segments.append(new_segment)
        self.longest = max(self.longest, len(self.segments))

    def add_segments(self, count):
        for _ in range(count):
            self.make_segment(self.segments[-1].pos())
        self.recolor()

    def remove_segments(self, count):
        for _ in range(count):
            if len(self.segments) == 1:
                # Losing the head means there's nothing left, so the snake has starved
                self.head.hideturtle()
                self.starved = True
                return
            segment = self.segments.pop()
            segment.hideturtle()
            self.spare_segments.append(segment)
        self.recolor()

    def recolor(self, start=BODY_START, end=BODY_END):
        # Fade the body from bright behind the head to dark at the tail
        body = self.segments[1:]
        for index, segment in enumerate(body):
            fill = blend(start, end, index / max(len(body) - 1, 1))
            segment.color(blend(fill, "#000000", 0.3), fill)

    def shrink_over_time(self):
        """Lose a segment whenever hunger fills up. Returns where it was lost, or None."""
        now = time.monotonic()
        # The longer the snake, the faster it gets hungry
        self.hunger += (now - self.last_hunger_update) * len(self.segments) / SHRINK_TIME
        self.last_hunger_update = now
        if self.hunger < 1:
            return None

        self.hunger = 0
        lost_at = self.segments[-1].pos()
        self.remove_segments(1)
        return lost_at

    def move(self):
        self.apply_turns()
        step_x, step_y = STEP[round(self.head.heading())]
        new_x = self.head.xcor() + step_x
        new_y = self.head.ycor() + step_y
        if not (LEFT_WALL <= new_x <= RIGHT_WALL and BOTTOM_WALL <= new_y <= TOP_WALL):
            # Stop at the wall instead of poking out of the board
            self.blocked_by_wall = True
            return

        for seg_num in range(len(self.segments) - 1, 0, -1):
            self.segments[seg_num].goto(self.segments[seg_num - 1].pos())
        self.head.goto(new_x, new_y)
        self.last_heading = self.head.heading()

    def delay(self):
        return START_DELAY / self.speed

    def change_speed(self, percent):
        self.speed *= 1 + percent / 100
        self.speed = max(MIN_SPEED, min(self.speed, MAX_SPEED))

    def up(self):
        self.press(UP)

    def down(self):
        self.press(DOWN)

    def left(self):
        self.press(LEFT)

    def right(self):
        self.press(RIGHT)

    def press(self, heading):
        apply_at = time.monotonic()
        if apply_at < self.reversed_until:
            heading = OPPOSITE[heading]
        if apply_at < self.drunk_until:
            apply_at += DRUNK_DELAY
        self.pending_turns.append((apply_at, heading))

    def apply_turns(self):
        now = time.monotonic()
        while self.pending_turns and self.pending_turns[0][0] <= now:
            apply_at, heading = self.pending_turns.pop(0)
            if OPPOSITE[heading] != self.last_heading:
                self.head.setheading(heading)

    def reverse_controls(self):
        self.reversed_until = time.monotonic() + EFFECT_TIME

    def get_drunk(self):
        self.drunk_until = time.monotonic() + EFFECT_TIME

    def reversed_time_left(self):
        return max(0, self.reversed_until - time.monotonic())

    def drunk_time_left(self):
        return max(0, self.drunk_until - time.monotonic())

    def occupies(self, x, y):
        for segment in self.segments:
            if segment.distance(x, y) < 10:
                return True
        return False

    def is_hit(self):
        for segment in self.segments[1:]:
            if self.head.distance(segment) < 10:
                self.you_died()
                return True
        return False

    def you_died(self):
        self.recolor(DEAD_START, DEAD_END)
        self.head.shape("dead_head")

    def hit_wall(self):
        if self.blocked_by_wall:
            self.you_died()
            return True
        return False
