import math
import time
from turtle import Turtle
from board import (CELL, LEFT_WALL, RIGHT_WALL, BOTTOM_WALL, TOP_WALL, BOARD_CENTER,
                   BODY_START, BODY_END, DEAD_START, DEAD_END, DRUNK_START, DRUNK_END,
                   REVERSED_START, REVERSED_END, GHOST_TINT, GHOST_AMOUNT, CYAN, blend, show_if)

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
EFFECT_TIME = 10     # how long reversed, drunk, ghost and runaway last, in seconds
DRUNK_DELAY = 0.5    # how far behind the controls are when drunk, in seconds
SHIELD_PAUSE = 1     # after the shield saves you, the snake waits this long before moving again
FLASH_TIME = 2       # an effect's colors flash for its last 2 seconds...
FLASH_SPEED = 0.15   # ...switching on and off this often
WOBBLE = 10          # how far a drunk snake's head sways, in degrees
EFFECTS = ["reversed", "drunk", "ghost", "fog", "runaway"]


class Snake:
    def __init__(self):
        self.segments = []
        self.spare_segments = []
        self.reset()
        # A ring around the head while the shield is up
        self.ring = Turtle("circle")
        self.ring.hideturtle()
        self.ring.penup()
        self.ring.shapesize(1.5, 1.5, 2.5)
        self.ring.color(CYAN, "")  # an empty fill color leaves the middle see-through

    def reset(self):
        """Put everything back the way it is at the start of a game."""
        for segment in self.segments:
            segment.hideturtle()
            self.spare_segments.append(segment)
        self.segments = []
        self.longest = 0
        self.dead = False
        # Which effect colors are showing: (drunk, reversed, ghost)
        self.look = (False, False, False)
        self.create_snake()
        self.head = self.segments[0]
        self.head.shape("snake_head")
        self.head.setheading(RIGHT)
        self.head.tiltangle(0)
        self.recolor()
        # The direction the snake actually moved last step. Turns are checked against
        # this (not the head's current heading) so two quick key presses in one frame
        # can't spin the snake back into itself.
        self.last_heading = RIGHT
        # Key presses waiting to be applied, as (time to apply, heading)
        self.pending_turns = []
        self.speed = 1.0
        # When each effect wears off
        self.effects_until = {name: 0 for name in EFFECTS}
        self.shielded = False
        # Builds up from 0 to 1; when it reaches 1 the snake loses a segment
        self.hunger = 0
        self.last_hunger_update = time.monotonic()
        self.starved = False

    def create_snake(self):
        for position in START_POSITION:
            self.make_segment(position)

    def make_segment(self, position):
        # Reuse a segment the snake lost earlier, if there is one
        if self.spare_segments:
            new_segment = self.spare_segments.pop()
            new_segment.shape("segment")  # it might have been the head last game
            new_segment.tiltangle(0)
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

    # ---- Colors ----

    def recolor(self):
        # Fade the body from bright behind the head to dark at the tail
        body = self.segments[1:]
        for index, segment in enumerate(body):
            fill = self.body_color(index, index / max(len(body) - 1, 1))
            segment.color(blend(fill, "#000000", 0.3), fill)

    def body_color(self, index, shade):
        drunk, reversed_controls, ghost = self.look
        if self.dead:
            start, end = DEAD_START, DEAD_END
        elif drunk and reversed_controls:
            # Both at once: purple and orange stripes
            start, end = (DRUNK_START, DRUNK_END) if index % 2 == 0 else (REVERSED_START, REVERSED_END)
        elif drunk:
            start, end = DRUNK_START, DRUNK_END
        elif reversed_controls:
            start, end = REVERSED_START, REVERSED_END
        else:
            start, end = BODY_START, BODY_END
        fill = blend(start, end, shade)
        if ghost and not self.dead:
            fill = blend(fill, GHOST_TINT, GHOST_AMOUNT)
        return fill

    def head_shape(self):
        drunk, reversed_controls, ghost = self.look
        if drunk:
            return "drunk_head"
        if reversed_controls:
            return "reversed_head"
        if ghost:
            return "ghost_head"
        return "snake_head"

    def effect_showing(self, name):
        """True while an effect is on, except it flashes off and on in its last few seconds."""
        time_left = self.time_left(name)
        if time_left <= 0:
            return False
        if time_left > FLASH_TIME:
            return True
        return int(time_left / FLASH_SPEED) % 2 == 0

    def update_look(self):
        """Change the snake's colors to match the effects on it. Only redraws when they change."""
        if self.dead:
            return
        look = (self.effect_showing("drunk"), self.effect_showing("reversed"), self.effect_showing("ghost"))
        if look != self.look:
            self.look = look
            self.recolor()
            self.head.shape(self.head_shape())
        # A drunk snake's head sways from side to side
        if self.time_left("drunk") > 0:
            self.head.tiltangle(WOBBLE * math.sin(time.monotonic() * 9))
        else:
            self.head.tiltangle(0)

    def update_visibility(self, fog):
        show_if(self.head, not self.starved)
        for segment in self.segments[1:]:
            show_if(segment, not fog.hides(segment))
        show_if(self.ring, self.shielded and not self.starved and not self.dead)
        if self.ring.isvisible():
            self.ring.goto(self.head.pos())

    # ---- Hunger ----

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

    # ---- Moving ----

    def move(self, rocks):
        """Move one cell. Returns what the snake crashed into ("wall", "body" or "rock"),
        "saved" if the shield stopped it from crashing, or None if nothing happened."""
        self.apply_turns()
        step_x, step_y = STEP[round(self.head.heading())]
        new_x = self.head.xcor() + step_x
        new_y = self.head.ycor() + step_y
        if self.time_left("ghost") > 0:
            # Ghosts go out one side of the board and come back in the other
            if new_x > RIGHT_WALL:
                new_x = LEFT_WALL
            elif new_x < LEFT_WALL:
                new_x = RIGHT_WALL
            if new_y > TOP_WALL:
                new_y = BOTTOM_WALL
            elif new_y < BOTTOM_WALL:
                new_y = TOP_WALL

        crash = self.crash_at(new_x, new_y, rocks)
        if crash:
            if self.shielded:
                # The shield takes the hit, and the snake stays put instead of crashing
                self.shielded = False
                return "saved"
            self.you_died()
            return crash

        for seg_num in range(len(self.segments) - 1, 0, -1):
            self.segments[seg_num].goto(self.segments[seg_num - 1].pos())
        self.head.goto(new_x, new_y)
        self.last_heading = self.head.heading()
        return None

    def crash_at(self, x, y, rocks):
        if not (LEFT_WALL <= x <= RIGHT_WALL and BOTTOM_WALL <= y <= TOP_WALL):
            return "wall"
        if rocks.at(x, y):
            return "rock"
        # The tail moves out of the way this step, so only the segments in between count
        for segment in self.segments[1:-1]:
            if segment.distance(x, y) < 10:
                return "body"
        return None

    def delay(self):
        return START_DELAY / self.speed

    def change_speed(self, percent):
        self.speed *= 1 + percent / 100
        self.speed = max(MIN_SPEED, min(self.speed, MAX_SPEED))

    # ---- Controls ----

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
        if self.time_left("reversed") > 0:
            heading = OPPOSITE[heading]
        if self.time_left("drunk") > 0:
            apply_at += DRUNK_DELAY
        self.pending_turns.append((apply_at, heading))

    def apply_turns(self):
        now = time.monotonic()
        while self.pending_turns and self.pending_turns[0][0] <= now:
            apply_at, heading = self.pending_turns.pop(0)
            if OPPOSITE[heading] != self.last_heading:
                self.head.setheading(heading)

    # ---- Effects ----

    def start_effect(self, name, seconds):
        self.effects_until[name] = time.monotonic() + seconds

    def time_left(self, name):
        return max(0, self.effects_until[name] - time.monotonic())

    def occupies(self, x, y):
        for segment in self.segments:
            if segment.distance(x, y) < 10:
                return True
        return False

    def you_died(self):
        self.dead = True
        self.recolor()
        self.head.shape("dead_head")
        self.head.tiltangle(0)
