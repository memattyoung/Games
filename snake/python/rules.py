from tkinter import font as tkfont
from turtle import Turtle
from board import PANEL_BG, BORDER, TEXT, DIM_TEXT, GREEN, GOLD, PURPLE, RED, PINK, draw_rounded_rect
from food import FOOD_COUNT, BAD_SHRINK, SHRINK_FLOOR
from snake import EFFECT_TIME, DRUNK_DELAY, MIN_SPEED, MAX_SPEED
from fog import FOG_TIME
from scoreboard import COMBO_TIME, MAX_COMBO
from jackpot import JACKPOT_POINTS, JACKPOT_TIME

PANEL_LEFT = 210
PANEL_RIGHT = 590
PANEL_TOP = 390
PANEL_BOTTOM = -390
MARGIN = 20
TITLE_FONT = ("Arial", 20, "bold")
HEADING_FONT = ("Arial", 13, "bold")
BODY_FONT = ("Arial", 11, "normal")
LINE_HEIGHT = 15
ICON_INDENT = 24
TEXT_WIDTH = PANEL_RIGHT - PANEL_LEFT - 2 * MARGIN


class RulesPanel(Turtle):
    """The panel to the right of the board that explains how the game works."""

    def __init__(self):
        super().__init__()
        self.hideturtle()
        self.penup()
        self.y = PANEL_TOP - 42
        self.measure = tkfont.Font(family=BODY_FONT[0], size=BODY_FONT[1]).measure
        draw_rounded_rect(self, PANEL_LEFT, PANEL_BOTTOM, PANEL_RIGHT - PANEL_LEFT,
                          PANEL_TOP - PANEL_BOTTOM, 12, PANEL_BG, BORDER)
        self.write_rules()

    def wrap(self, text, width):
        # Turtle can't wrap text by itself, so split it into lines that fit the panel
        lines = []
        line = ""
        for word in text.split():
            longer = word if not line else line + " " + word
            if self.measure(longer) <= width:
                line = longer
            else:
                lines.append(line)
                line = word
        lines.append(line)
        return lines

    def write_line(self, text, color, font, indent=0):
        self.goto(PANEL_LEFT + MARGIN + indent, self.y)
        self.color(color)
        self.write(text, font=font)
        self.y -= LINE_HEIGHT

    def title(self, text):
        self.write_line(text, GREEN, TITLE_FONT)
        self.y -= 8

    def section(self, text):
        self.y -= 7
        self.write_line(text, DIM_TEXT, HEADING_FONT)
        self.y -= 2

    def paragraph(self, text, color=TEXT, indent=0, gap=4):
        for line in self.wrap(text, TEXT_WIDTH - indent):
            self.write_line(line, color, BODY_FONT, indent)
        self.y -= gap

    def bullets(self, items):
        for item in items:
            lines = self.wrap(item, TEXT_WIDTH - ICON_INDENT - 12)
            self.goto(PANEL_LEFT + MARGIN + ICON_INDENT, self.y)
            self.color(DIM_TEXT)
            self.write("•", font=BODY_FONT)
            for line in lines:
                self.write_line(line, TEXT, BODY_FONT, ICON_INDENT + 12)
        self.y -= 4

    def food(self, shape, name, color):
        icon = Turtle(shape)
        icon.penup()
        icon.setheading(90)
        icon.goto(PANEL_LEFT + MARGIN + 9, self.y + 8)
        self.write_line(name, color, HEADING_FONT, indent=ICON_INDENT)

    def write_rules(self):
        self.title("HOW TO PLAY")

        self.section("CONTROLS")
        self.paragraph("Steer with the arrow keys. Hit a wall, a rock or your own body and the game is over.")

        self.section("HUNGER")
        self.paragraph("Your snake is always hungry and keeps shrinking, and the longer it is, the "
                       "faster it shrinks. When the hunger bar fills up, you lose a segment.")
        self.paragraph("If your snake shrinks down to nothing, it starves to death.", RED)

        self.section("POINTS")
        self.paragraph(f"Every apple is worth 1 point. Eat the next one within {COMBO_TIME} seconds "
                       f"for a combo: ×2, ×3, up to ×{MAX_COMBO}.")
        self.food("rainbow_0", "RAINBOW APPLE", PINK)
        self.paragraph(f"Now and then a sparkly rainbow apple appears for {JACKPOT_TIME} seconds. "
                       f"It's worth {JACKPOT_POINTS} points.", indent=ICON_INDENT)

        self.section("APPLES")
        self.paragraph(f"There are always {FOOD_COUNT} apples and they all look the same. Every apple "
                       "grows your snake by 1 segment unless it says otherwise. You only find out what "
                       "you ate afterwards, next to your score.")

        self.food("apple", "NORMAL", TEXT)
        self.paragraph("Grow 1 segment and speed up 5%.", indent=ICON_INDENT)

        self.food("golden_apple", "BENEFIT (one of these)", GOLD)
        self.bullets([
            "Grow 1 segment and slow down 10%",
            "Grow 2 segments",
            "Shield: your next crash is forgiven",
            f"Ghost: go through walls for {EFFECT_TIME} seconds",
        ])

        self.food("poison_apple", "BAD (one of these)", PURPLE)
        self.bullets([
            "Speed up 20%",
            f"Lose {BAD_SHRINK} segments (never below {SHRINK_FLOOR})",
            f"Reversed controls for {EFFECT_TIME} seconds",
            f"Drunk for {EFFECT_TIME} seconds: turns happen {DRUNK_DELAY:g}s late",
            "A rock appears where you ate it",
            f"Fog for {FOG_TIME} seconds: you can only see near your head",
            f"The apples run away from you for {EFFECT_TIME} seconds",
        ])

        self.section("GOOD TO KNOW")
        self.paragraph("Your snake turns purple when drunk, orange when reversed, and see-through as "
                       "a ghost. It flashes when an effect is about to wear off. Speed always stays "
                       f"between {MIN_SPEED:g}x and {MAX_SPEED:g}x.")
