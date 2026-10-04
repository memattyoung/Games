import random
from turtle import Turtle
from board import CELL, LEFT_WALL, RIGHT_WALL, BOTTOM_WALL, TOP_WALL, TEXT, GOLD, PURPLE, PINK

FOOD_COUNT = 3
BAD_SHRINK = 3       # how many segments the bad "shrink" apple takes away...
SHRINK_FLOOR = 2     # ...but it never leaves the snake shorter than this
RUNAWAY_STEP = 0.35  # while apples are running away, they move one cell this often

NORMAL = "Normal"
BENEFIT = "Benefit"
BAD = "Bad"
RAINBOW = "Rainbow"  # the jackpot apple
FOOD_TYPES = [NORMAL, BENEFIT, BAD]
# All food looks like the same red apple on the board. Once it's eaten,
# the scoreboard reveals what it really was.
REVEAL_SHAPES = {NORMAL: "apple", BENEFIT: "golden_apple", BAD: "poison_apple", RAINBOW: "rainbow_0"}
TYPE_COLORS = {NORMAL: TEXT, BENEFIT: GOLD, BAD: PURPLE, RAINBOW: PINK}
NEIGHBOURS = [(CELL, 0), (-CELL, 0), (0, CELL), (0, -CELL)]


def random_cell(is_free):
    """Pick a random cell on the board that nothing is using."""
    while True:
        x = random.randint(LEFT_WALL // CELL, RIGHT_WALL // CELL) * CELL
        y = random.randint(BOTTOM_WALL // CELL, TOP_WALL // CELL) * CELL
        if is_free(x, y):
            return x, y


def run_away(apple, head, is_free):
    """Move an apple one cell further from the snake's head, if any move gets it further away."""
    best_distance = head.distance(apple)
    best_spots = []
    for step_x, step_y in NEIGHBOURS:
        x = round(apple.xcor()) + step_x
        y = round(apple.ycor()) + step_y
        if not (LEFT_WALL <= x <= RIGHT_WALL and BOTTOM_WALL <= y <= TOP_WALL) or not is_free(x, y):
            continue
        distance = head.distance(x, y)
        if distance > best_distance + 0.5:
            best_distance = distance
            best_spots = [(x, y)]
        elif best_spots and abs(distance - best_distance) <= 0.5:
            best_spots.append((x, y))  # a tie, so pick between them at random
    if best_spots:
        apple.goto(random.choice(best_spots))


class Food(Turtle):
    def __init__(self, is_free):
        super().__init__()
        # A function that says whether a cell is empty (no snake, rock or other apple)
        self.is_free = is_free
        self.food_type = None
        self.shape("apple")
        self.setheading(90)  # keeps the apple's stem pointing up
        self.penup()
        self.move_food()

    def move_food(self):
        self.food_type = random.choice(FOOD_TYPES)
        self.goto(random_cell(self.is_free))
