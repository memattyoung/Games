from turtle import Turtle
from board import BOARD_CENTER, PANEL_BG, BORDER, TEXT, DIM_TEXT, GREEN, RED, draw_rounded_rect

TITLE_FONT = ("Arial", 40, "bold")


class Overlay(Turtle):
    """The start and game over panels shown in the middle of the board."""

    def __init__(self):
        super().__init__()
        self.hideturtle()
        self.penup()

    def panel(self, width, height):
        x, y = BOARD_CENTER
        draw_rounded_rect(self, x - width / 2, y - height / 2, width, height, 16, PANEL_BG, BORDER)

    def text(self, words, y_offset, color, font, shadow=False):
        x, y = BOARD_CENTER
        if shadow:
            self.goto(x + 3, y + y_offset - 3)
            self.color("#000000")
            self.write(words, align="center", font=font)
        self.goto(x, y + y_offset)
        self.color(color)
        self.write(words, align="center", font=font)

    def show_start(self):
        self.panel(440, 200)
        self.text("MJY SNAKE", 30, GREEN, TITLE_FONT, shadow=True)
        self.text("Read the rules on the right, then", -10, DIM_TEXT, ("Arial", 14, "normal"))
        self.text("press SPACE to start", -50, TEXT, ("Arial", 20, "bold"))

    def show_game_over(self, reason, score, longest):
        self.panel(460, 250)
        self.text("GAME OVER", 45, RED, TITLE_FONT, shadow=True)
        self.text(reason, 10, TEXT, ("Arial", 18, "bold"))
        self.text(f"Score {score}     Longest snake {longest}", -25, DIM_TEXT, ("Arial", 15, "normal"))
        self.text("Press SPACE to play again", -70, TEXT, ("Arial", 18, "bold"))
        self.text("or close the window to quit", -95, DIM_TEXT, ("Arial", 12, "normal"))

    def hide(self):
        self.clear()
