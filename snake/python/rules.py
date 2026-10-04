import textwrap
from turtle import Turtle
from board import PANEL_BG, BORDER, TEXT, DIM_TEXT, GREEN, GOLD, PURPLE, RED, draw_rounded_rect
from food import FOOD_COUNT, BAD_SHRINK, SHRINK_FLOOR
from snake import EFFECT_TIME, DRUNK_DELAY, MIN_SPEED, MAX_SPEED

PANEL_LEFT = 210
PANEL_RIGHT = 590
PANEL_TOP = 390
PANEL_BOTTOM = -390
MARGIN = 22
TITLE_FONT = ("Arial", 22, "bold")
HEADING_FONT = ("Arial", 14, "bold")
BODY_FONT = ("Arial", 13, "normal")
LINE_HEIGHT = 18
WRAP_WIDTH = 41  # roughly how many characters fit on one line of the panel


class RulesPanel(Turtle):
    """The panel to the right of the board that explains how the game works."""

    def __init__(self):
        super().__init__()
        self.hideturtle()
        self.penup()
        self.y = PANEL_TOP - 50
        draw_rounded_rect(self, PANEL_LEFT, PANEL_BOTTOM, PANEL_RIGHT - PANEL_LEFT,
                          PANEL_TOP - PANEL_BOTTOM, 12, PANEL_BG, BORDER)
        self.write_rules()

    def write_line(self, text, color, font, indent=0):
        self.goto(PANEL_LEFT + MARGIN + indent, self.y)
        self.color(color)
        self.write(text, font=font)
        self.y -= LINE_HEIGHT

    def title(self, text):
        self.write_line(text, GREEN, TITLE_FONT)
        self.y -= 12

    def section(self, text):
        self.y -= 10
        self.write_line(text, DIM_TEXT, HEADING_FONT)
        self.y -= 4

    def paragraph(self, text, color=TEXT, indent=0):
        # Turtle can't wrap text by itself, so split it into lines that fit the panel
        for line in textwrap.wrap(text, WRAP_WIDTH - indent // 7):
            self.write_line(line, color, BODY_FONT, indent)
        self.y -= 6

    def food(self, shape, name, color):
        icon = Turtle(shape)
        icon.penup()
        icon.setheading(90)
        icon.goto(PANEL_LEFT + MARGIN + 9, self.y + 9)
        self.write_line(name, color, HEADING_FONT, indent=26)

    def write_rules(self):
        self.title("HOW TO PLAY")

        self.section("CONTROLS")
        self.paragraph("Steer with the arrow keys. Hit a wall or your own body and the game is over.")

        self.section("HUNGER")
        self.paragraph("Your snake is always hungry and keeps shrinking, and the longer it is, the "
                       "faster it shrinks. When the hunger bar above the board fills up, you lose "
                       "a segment.")
        self.paragraph("If your snake shrinks down to nothing, it starves to death.", RED)

        self.section("FOOD")
        self.paragraph(f"There are always {FOOD_COUNT} apples on the board and they all look the "
                       "same. You only find out what you ate afterwards, next to your score. "
                       "Every apple is worth 1 point.")

        self.food("apple", "NORMAL", TEXT)
        self.paragraph("Grow 1 segment and speed up 5%.", indent=26)

        self.food("golden_apple", "BENEFIT", GOLD)
        self.paragraph("One of these at random: slow down 10%, or grow 2 segments.", indent=26)

        self.food("poison_apple", "BAD", PURPLE)
        self.paragraph("One of these at random:", indent=26)
        self.y += 6
        self.paragraph("•  Speed up 20%", indent=26)
        self.y += 6
        self.paragraph(f"•  Lose {BAD_SHRINK} segments (never below {SHRINK_FLOOR})", indent=26)
        self.y += 6
        self.paragraph(f"•  Reversed controls for {EFFECT_TIME} seconds", indent=26)
        self.y += 6
        self.paragraph(f"•  Drunk for {EFFECT_TIME} seconds: every turn happens "
                       f"{DRUNK_DELAY:g}s late", indent=26)

        self.section("GOOD TO KNOW")
        self.paragraph("Reversed and drunk show a countdown above the board. "
                       f"Speed always stays between {MIN_SPEED:g}x and {MAX_SPEED:g}x.")
