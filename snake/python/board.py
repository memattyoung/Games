import math
from turtle import Turtle, Shape

CELL = 20
# The snake and food move on a grid of 20px cells. These are the outermost cell
# centers. The board sits on the left of the window, with the rules on the right.
LEFT_WALL = -580
RIGHT_WALL = 180
BOTTOM_WALL = -380
TOP_WALL = 320  # leaves room for the scoreboard above the board
BOARD_CENTER = ((LEFT_WALL + RIGHT_WALL) / 2, (BOTTOM_WALL + TOP_WALL) / 2)

# Colors
WINDOW_BG = "#0D131A"
PANEL_BG = "#141C26"
BOARD_DARK = "#18222D"
BOARD_LIGHT = "#1C2834"
BORDER = "#2E4053"
TRACK = "#243140"
TEXT = "#E8EEF4"
DIM_TEXT = "#8090A0"
GREEN = "#7BD65B"
RED = "#F05A4F"
GOLD = "#F5C542"
PURPLE = "#B98AF0"
PURPLE_DEEP = "#7444B8"
PURPLE_TRACK = "#2B2140"

HEAD_COLOR = "#8BE05F"
BODY_START = "#6FCF4E"
BODY_END = "#2C7A3A"
DEAD_HEAD_COLOR = "#E2574C"
DEAD_START = "#D0493F"
DEAD_END = "#6E2420"

# The snake changes color while an effect is on it, so it's obvious
DRUNK_HEAD_COLOR = "#C08CFF"
DRUNK_START = "#A66BEA"
DRUNK_END = "#5B2E91"
REVERSED_HEAD_COLOR = "#FFB25C"
REVERSED_START = "#F59A3C"
REVERSED_END = "#9A4B12"
GHOST_TINT = "#DDEFFF"   # ghosts are mixed 55% toward this, so they look see-through
GHOST_AMOUNT = 0.55

CYAN = "#6FE3FF"
ORANGE = "#F59A3C"
PINK = "#FF8FD0"
FOG_COLOR = "#05080C"
RAINBOW = ["#FF5A5A", "#FFA63D", "#FFE14D", "#6EE06E", "#4DB8FF", "#B57BFF"]


def blend(color1, color2, amount):
    """Mix two "#rrggbb" colors. An amount of 0 gives color1, 1 gives color2."""
    mixed = "#"
    for i in (1, 3, 5):
        start = int(color1[i:i + 2], 16)
        end = int(color2[i:i + 2], 16)
        mixed += "%02x" % round(start + (end - start) * amount)
    return mixed


def show_if(turtle, visible):
    """Show or hide a turtle, but only touch it when that actually changes."""
    if visible and not turtle.isvisible():
        turtle.showturtle()
    elif not visible and turtle.isvisible():
        turtle.hideturtle()


def draw_rect(pen, left, bottom, width, height, color):
    """Fill a plain rectangle with no outline."""
    pen.penup()
    pen.color(color)
    pen.goto(left, bottom)
    pen.begin_fill()
    pen.goto(left + width, bottom)
    pen.goto(left + width, bottom + height)
    pen.goto(left, bottom + height)
    pen.goto(left, bottom)
    pen.end_fill()


def draw_rounded_rect(pen, left, bottom, width, height, radius, color, outline=None):
    """Fill a rectangle with rounded corners, with an optional outline."""
    pen.penup()
    pen.goto(left + radius, bottom)
    pen.setheading(0)
    pen.color(outline or color, color)
    if outline:
        pen.pensize(2)
        pen.pendown()
    pen.begin_fill()
    for side in (width, height, width, height):
        pen.forward(side - 2 * radius)
        pen.circle(radius, 90)
    pen.end_fill()
    pen.penup()


def draw_bar(pen, left, bottom, width, height, color):
    """A pill-shaped bar, used for the hunger and effect meters."""
    if width > 0:
        draw_rounded_rect(pen, left, bottom, width, height, min(width, height) / 2, color)


def ellipse(center_x, center_y, radius_x, radius_y, tilt=0, points=20):
    """The corner points of an ellipse, for building custom turtle shapes."""
    tilt = math.radians(tilt)
    corners = []
    for i in range(points):
        angle = 2 * math.pi * i / points
        x = radius_x * math.cos(angle)
        y = radius_y * math.sin(angle)
        corners.append((center_x + x * math.cos(tilt) - y * math.sin(tilt),
                        center_y + x * math.sin(tilt) + y * math.cos(tilt)))
    return tuple(corners)


def rounded_square(half, cut):
    """A square with its corners clipped off, so it looks softer."""
    return ((-half + cut, -half), (half - cut, -half), (half, -half + cut), (half, half - cut),
            (half - cut, half), (-half + cut, half), (-half, half - cut), (-half, -half + cut))


def make_head(skin, dead=False):
    # Turtle shapes point "up" the y axis, so the eyes and tongue go at positive y
    # and the head turns with the snake automatically.
    head = Shape("compound")
    head.addcomponent(rounded_square(10, 4), skin, blend(skin, "#000000", 0.3))
    for side in (-1, 1):
        if dead:
            head.addcomponent(ellipse(4.5 * side, 3, 3.2, 0.9, tilt=45), "#1A1A1A")
            head.addcomponent(ellipse(4.5 * side, 3, 3.2, 0.9, tilt=-45), "#1A1A1A")
        else:
            head.addcomponent(ellipse(4.5 * side, 3, 3, 3), "#FFFFFF")
            head.addcomponent(ellipse(4.5 * side, 4.3, 1.6, 1.6), "#111111")
    if not dead:
        tongue = ((-0.8, 9), (0.8, 9), (0.8, 12.5), (2.6, 15), (1.6, 15.6), (0, 13.6),
                  (-1.6, 15.6), (-2.6, 15), (-0.8, 12.5))
        head.addcomponent(tongue, "#FF4D6D")
    return head


def make_apple(skin, shine):
    apple = Shape("compound")
    apple.addcomponent(ellipse(0, -1, 8.5, 8, points=24), skin, blend(skin, "#000000", 0.25))
    apple.addcomponent(ellipse(-3.2, 1.5, 1.6, 2.6, tilt=-20), shine)
    apple.addcomponent(((-0.8, 5.5), (0.8, 5.5), (1.8, 10.5), (0.4, 10.5)), "#7A5230")
    apple.addcomponent(ellipse(4.6, 9.2, 3.6, 1.6, tilt=25), "#5DBB63")
    return apple


def star(center_x, center_y, size):
    """A little four-pointed sparkle."""
    points = []
    for i in range(8):
        angle = math.pi / 4 * i
        reach = size if i % 2 == 0 else size * 0.3
        points.append((center_x + reach * math.cos(angle), center_y + reach * math.sin(angle)))
    return tuple(points)


SPARKLE_SPOTS = [(-10, 8), (10, 5), (-8, -9), (9, -8), (1, 13), (-12, 0)]


def make_rainbow_apple(index):
    # The jackpot apple: each frame of its animation is a different color, with
    # sparkles in different places, so it shimmers as it cycles through them
    skin = RAINBOW[index]
    apple = make_apple(skin, "#FFFFFF")
    for spot in (SPARKLE_SPOTS[index], SPARKLE_SPOTS[(index + 3) % len(SPARKLE_SPOTS)]):
        apple.addcomponent(star(spot[0], spot[1], 3), "#FFF6C8")
    return apple


def make_rock():
    rock = Shape("compound")
    outline = ((-9, -6), (-6, -9), (2, -9.5), (8, -7), (9.5, -1), (7, 6), (1, 9), (-5, 8.5), (-9.5, 3))
    rock.addcomponent(outline, "#7D8590", "#454B54")
    rock.addcomponent(ellipse(-3, 3, 3.2, 1.8, tilt=20), "#A3ABB5")
    rock.addcomponent(((1, -3), (5, 1.5), (4, 2.2), (0.2, -2.2)), "#4F5660")
    rock.addcomponent(ellipse(4, -5, 2, 1.2, tilt=-15), "#6A717B")
    return rock


def register_shapes(screen):
    screen.register_shape("segment", rounded_square(9, 3.5))
    screen.register_shape("snake_head", make_head(HEAD_COLOR))
    screen.register_shape("dead_head", make_head(DEAD_HEAD_COLOR, dead=True))
    screen.register_shape("drunk_head", make_head(DRUNK_HEAD_COLOR))
    screen.register_shape("reversed_head", make_head(REVERSED_HEAD_COLOR))
    screen.register_shape("ghost_head", make_head(blend(HEAD_COLOR, GHOST_TINT, GHOST_AMOUNT)))
    screen.register_shape("apple", make_apple("#E8453C", "#FF9A8F"))
    screen.register_shape("golden_apple", make_apple(GOLD, "#FFF2B8"))
    screen.register_shape("poison_apple", make_apple("#9B4DCA", "#E0BFFF"))
    for index in range(len(RAINBOW)):
        screen.register_shape(f"rainbow_{index}", make_rainbow_apple(index))
    screen.register_shape("rock", make_rock())


def draw_board():
    pen = Turtle("square")
    pen.hideturtle()
    pen.penup()

    left = LEFT_WALL - CELL / 2
    bottom = BOTTOM_WALL - CELL / 2
    width = RIGHT_WALL - LEFT_WALL + CELL
    height = TOP_WALL - BOTTOM_WALL + CELL
    draw_rounded_rect(pen, left - 4, bottom - 4, width + 8, height + 8, 6, BORDER)
    draw_rect(pen, left, bottom, width, height, BOARD_DARK)

    # Checkerboard: stamp a lighter square on every other cell
    pen.color(BOARD_LIGHT)
    for x in range(LEFT_WALL, RIGHT_WALL + 1, CELL):
        for y in range(BOTTOM_WALL, TOP_WALL + 1, CELL):
            if (x + y) // CELL % 2 == 0:
                pen.goto(x, y)
                pen.stamp()
