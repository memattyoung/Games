from turtle import Turtle
from board import CELL, LEFT_WALL, RIGHT_WALL, BOTTOM_WALL, TOP_WALL, FOG_COLOR

FOG_TIME = 5     # seconds the fog lasts
FOG_RADIUS = 4   # how many cells you can see around the head
SEE = FOG_RADIUS * CELL + CELL / 2  # from the head's center to the edge of what you can see

BOARD_LEFT = LEFT_WALL - CELL / 2
BOARD_RIGHT = RIGHT_WALL + CELL / 2
BOARD_BOTTOM = BOTTOM_WALL - CELL / 2
BOARD_TOP = TOP_WALL + CELL / 2


class Fog:
    """Covers the board except for a small square around the snake's head."""

    def __init__(self):
        # Four stretched squares cover everything above, below, left and right of the
        # square you can see. Anything under them is hidden too (see hides()).
        self.covers = []
        for _ in range(4):
            cover = Turtle("square")
            cover.hideturtle()
            cover.penup()
            cover.color(FOG_COLOR)
            self.covers.append(cover)
        self.active = False
        self.center = None  # where the head was when the covers were last placed

    def update(self, active, head_x, head_y):
        self.active = active
        if not active:
            if self.center is not None:
                for cover in self.covers:
                    cover.hideturtle()
                self.center = None
            return
        if self.center == (head_x, head_y):
            return
        self.center = (head_x, head_y)

        left = max(BOARD_LEFT, head_x - SEE)
        right = min(BOARD_RIGHT, head_x + SEE)
        bottom = max(BOARD_BOTTOM, head_y - SEE)
        top = min(BOARD_TOP, head_y + SEE)
        self.place(self.covers[0], BOARD_LEFT, top, BOARD_RIGHT, BOARD_TOP)        # above
        self.place(self.covers[1], BOARD_LEFT, BOARD_BOTTOM, BOARD_RIGHT, bottom)  # below
        self.place(self.covers[2], BOARD_LEFT, bottom, left, top)                  # left
        self.place(self.covers[3], right, bottom, BOARD_RIGHT, top)                # right

    def place(self, cover, left, bottom, right, top):
        if right - left < 1 or top - bottom < 1:
            cover.hideturtle()
            return
        # The square shape is 20px across; stretch it to fill the rectangle
        cover.shapesize((top - bottom) / 20, (right - left) / 20)
        cover.goto((left + right) / 2, (bottom + top) / 2)
        cover.showturtle()

    def hides(self, thing):
        """True if the fog is covering this turtle's spot."""
        if not self.active:
            return False
        head_x, head_y = self.center
        return abs(thing.xcor() - head_x) > SEE or abs(thing.ycor() - head_y) > SEE
