from turtle import Turtle


class Rocks(Turtle):
    """Rocks left behind by bad apples. They stay for the rest of the game.

    Each rock is a stamp, so it always sits underneath the snake and the apples."""

    def __init__(self):
        super().__init__("rock")
        self.hideturtle()
        self.penup()
        self.setheading(90)  # draws the rock shape the right way up
        self.spots = set()

    def add(self, x, y):
        self.goto(x, y)
        self.stamp()
        self.spots.add((round(x), round(y)))

    def at(self, x, y):
        return (round(x), round(y)) in self.spots

    def remove_all(self):
        self.clearstamps()
        self.spots = set()
