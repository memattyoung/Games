import random
from turtle import Turtle
from board import CELL, LEFT_WALL, RIGHT_WALL, BOTTOM_WALL, TOP_WALL, TEXT, GOLD, PURPLE

FOOD_COUNT = 3
BAD_SHRINK = 3     # how many segments the bad "shrink" apple takes away...
SHRINK_FLOOR = 2   # ...but it never leaves the snake shorter than this

NORMAL = "Normal"
BENEFIT = "Benefit"
BAD = "Bad"
FOOD_TYPES = [NORMAL, BENEFIT, BAD]
# All food looks like the same red apple on the board. Once it's eaten,
# the scoreboard reveals what it really was.
REVEAL_SHAPES = {NORMAL: "apple", BENEFIT: "golden_apple", BAD: "poison_apple"}
TYPE_COLORS = {NORMAL: TEXT, BENEFIT: GOLD, BAD: PURPLE}


class Food(Turtle):
    def __init__(self, snake, all_food):
        super().__init__()
        self.snake = snake
        self.all_food = all_food
        self.food_type = None
        self.shape("apple")
        self.setheading(90)  # keeps the apple's stem pointing up
        self.penup()
        self.move_food()

    def move_food(self):
        self.food_type = random.choice(FOOD_TYPES)

        # Keep picking spots until we find one that isn't under the snake or another food
        while True:
            xcord = random.randint(LEFT_WALL // CELL, RIGHT_WALL // CELL) * CELL
            ycord = random.randint(BOTTOM_WALL // CELL, TOP_WALL // CELL) * CELL
            if not self.snake.occupies(xcord, ycord) and not self.other_food_at(xcord, ycord):
                break

        self.goto(xcord, ycord)

    def other_food_at(self, x, y):
        for food in self.all_food:
            if food is not self and food.distance(x, y) < 10:
                return True
        return False
