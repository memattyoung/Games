import time
from turtle import Turtle
from board import BOARD_DARK, blend

POPUP_TIME = 0.9   # seconds a popup stays on screen
POPUP_RISE = 35    # how far it floats up while fading out
POPUP_FONT = ("Arial", 15, "bold")


class Popups:
    """Little bits of text like "+1" that float up and fade out where something happened."""

    def __init__(self):
        self.active = []
        self.spare_writers = []

    def add(self, x, y, text, color):
        if self.spare_writers:
            writer = self.spare_writers.pop()
        else:
            writer = Turtle()
            writer.hideturtle()
            writer.penup()
        self.active.append({"writer": writer, "x": x, "y": y, "text": text,
                            "color": color, "start": time.monotonic()})

    def update(self):
        now = time.monotonic()
        for popup in self.active[:]:
            writer = popup["writer"]
            writer.clear()
            progress = (now - popup["start"]) / POPUP_TIME
            if progress >= 1:
                self.active.remove(popup)
                self.spare_writers.append(writer)
            else:
                writer.goto(popup["x"], popup["y"] + 4 + POPUP_RISE * progress)
                writer.color(blend(popup["color"], BOARD_DARK, progress ** 2))
                writer.write(popup["text"], align="center", font=POPUP_FONT)

    def clear(self):
        for popup in self.active:
            popup["writer"].clear()
            self.spare_writers.append(popup["writer"])
        self.active = []
