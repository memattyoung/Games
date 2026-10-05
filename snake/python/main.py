from turtle import Screen, Terminator
from tkinter import TclError
import time
import random
from board import WINDOW_BG, DIM_TEXT, GOLD, CYAN, register_shapes, draw_board, show_if
from snake import Snake, EFFECT_TIME, SHIELD_PAUSE
from food import (Food, FOOD_COUNT, NORMAL, BENEFIT, RAINBOW, TYPE_COLORS, BAD_SHRINK, SHRINK_FLOOR,
                  RUNAWAY_STEP, run_away)
from rocks import Rocks
from fog import Fog, FOG_TIME
from jackpot import Jackpot, JACKPOT_POINTS
from scoreboard import Scoreboard
from popups import Popups
from overlay import Overlay
from rules import RulesPanel

FRAME_TIME = 1 / 30  # redraw 30 times a second, even when the snake moves slower

screen = Screen()
screen.setup(width=1200, height=800)
screen.bgcolor(WINDOW_BG)
screen.title("Matt Young Presents Chaos Snake")
screen.tracer(0)
register_shapes(screen)

draw_board()
RulesPanel()
score = Scoreboard()
popups = Popups()
overlay = Overlay()
screen.update()

# Created once and reused every game. Nothing shows until the game starts.
rocks = Rocks()
jackpot = Jackpot()
my_snake = Snake()
foods = []


def cell_is_free(x, y):
    """True if nothing is on this cell: no snake, rock, apple or jackpot."""
    if my_snake.occupies(x, y) or rocks.at(x, y) or jackpot.is_at(x, y):
        return False
    for food in foods:
        if food.distance(x, y) < 10:
            return False
    return True


for _ in range(FOOD_COUNT):
    foods.append(Food(cell_is_free))
# Made last so it covers everything else on the board
fog = Fog()

space_pressed = False


def press_space():
    global space_pressed
    space_pressed = True


screen.listen()
screen.onkey(press_space, "space")
screen.onkey(my_snake.up, "Up")
screen.onkey(my_snake.down, "Down")
screen.onkey(my_snake.left, "Left")
screen.onkey(my_snake.right, "Right")


def wait_for_space():
    global space_pressed
    space_pressed = False
    canvas = screen.getcanvas()
    while not space_pressed:
        time.sleep(FRAME_TIME)
        # Only check for key presses here. screen.update() would redraw the
        # snake and food on top of the panel that's showing.
        canvas.update()
        # update() doesn't notice the window being closed, but this raises TclError if it was
        canvas.winfo_exists()


def eat(food):
    """Apply the eaten food's effect. Returns the scoreboard text and the popup text."""
    if food.food_type == NORMAL:
        my_snake.add_segments(1)
        my_snake.change_speed(5)
        return "Normal: +1 segment, speed +5%", "+1"

    if food.food_type == BENEFIT:
        effect = random.choice(["slower", "grow", "shield", "ghost"])
        # Every apple grows the snake by 1, unless it says otherwise
        if effect in ("shield", "ghost"):
            my_snake.add_segments(1)
        if effect == "slower":
            my_snake.add_segments(1)
            my_snake.change_speed(-10)
            return "Benefit: +1 segment, speed -10%", "SLOWER"
        if effect == "grow":
            my_snake.add_segments(2)
            return "Benefit: +2 segments", "+2"
        if effect == "shield":
            my_snake.shielded = True  # you can only have one shield at a time
            return "Benefit: shield! Next crash forgiven", "SHIELD!"
        my_snake.start_effect("ghost", EFFECT_TIME)
        return "Benefit: ghost! Go through walls", "GHOST!"

    # Otherwise it's bad food
    effect = random.choice(["faster", "shrink", "reverse", "drunk", "rock", "fog", "runaway"])
    if effect != "shrink":
        my_snake.add_segments(1)
    if effect == "faster":
        my_snake.change_speed(20)
        return "Bad: speed +20%", "FASTER!"
    if effect == "shrink":
        # A bad apple can hurt, but it never shrinks the snake below SHRINK_FLOOR
        lost = min(BAD_SHRINK, max(0, len(my_snake.segments) - SHRINK_FLOOR))
        my_snake.remove_segments(lost)
        if lost == 0:
            return "Bad: shrink, but you're already tiny", "SAFE"
        return f"Bad: -{lost} segment" + ("s" if lost > 1 else ""), f"-{lost}"
    if effect == "reverse":
        my_snake.start_effect("reversed", EFFECT_TIME)
        return "Bad: controls reversed!", "REVERSED!"
    if effect == "drunk":
        my_snake.start_effect("drunk", EFFECT_TIME)
        return "Bad: drunk!", "DRUNK!"
    if effect == "rock":
        # The rock goes where the apple was, which is right under the head
        rocks.add(*my_snake.head.pos())
        return "Bad: a rock appeared!", "ROCK!"
    if effect == "fog":
        my_snake.start_effect("fog", FOG_TIME)
        return "Bad: fog!", "FOG!"
    my_snake.start_effect("runaway", EFFECT_TIME)
    return "Bad: the apples are running away!", "RUNAWAY!"


def show_points(x, y, text, color, combo):
    popups.add(x, y, text, color)
    if combo >= 2:
        popups.add(x, y + 22, f"COMBO ×{combo}", GOLD)


def check_for_food():
    for food in foods:
        if my_snake.head.distance(food) < 15:
            kind = food.food_type
            score_text, popup_text = eat(food)
            points, combo = score.score_apple(kind, 1)
            score.show_food(kind, score_text)
            show_points(food.xcor(), food.ycor(), popup_text, TYPE_COLORS[kind], combo)
            # Respawn it somewhere new, as a new random type
            food.move_food()

    if jackpot.active and my_snake.head.distance(jackpot) < 15:
        points, combo = score.score_apple(RAINBOW, JACKPOT_POINTS)
        score.show_food(RAINBOW, f"Jackpot! +{points} points")
        show_points(jackpot.xcor(), jackpot.ycor(), f"+{points}", TYPE_COLORS[RAINBOW], combo)
        jackpot.schedule()


def update_visibility(game_over=False):
    """Hide whatever the fog is covering. Once the game's over, the fog lifts."""
    fog_on = my_snake.time_left("fog") > 0 and not game_over
    fog.update(fog_on, *my_snake.head.pos())
    my_snake.update_visibility(fog)
    for food in foods:
        show_if(food, not fog.hides(food))
    if game_over:
        show_if(jackpot, jackpot.active)


def play_game():
    """Run one game until the snake dies. Returns the reason it died."""
    next_move = time.monotonic()
    next_runaway = 0

    while True:
        time.sleep(FRAME_TIME)
        now = time.monotonic()

        # The snake only moves every few frames, depending on how fast it's going
        if now >= next_move:
            next_move = now + my_snake.delay()
            crash = my_snake.move(rocks)
            if crash == "saved":
                popups.add(my_snake.head.xcor(), my_snake.head.ycor(), "SAVED!", CYAN)
                # Give the player a moment to turn away
                next_move = now + SHIELD_PAUSE
            elif crash == "rock":
                return "You hit a rock!"
            elif crash:
                return "You crashed!"
            else:
                check_for_food()

        if my_snake.time_left("runaway") > 0 and now >= next_runaway:
            next_runaway = now + RUNAWAY_STEP
            apples = foods + [jackpot] if jackpot.active else foods
            for apple in apples:
                run_away(apple, my_snake.head, cell_is_free)

        lost_at = my_snake.shrink_over_time()
        if lost_at:
            popups.add(lost_at[0], lost_at[1], "-1", DIM_TEXT)
        if my_snake.starved:
            return "Your snake starved to death!"

        my_snake.update_look()
        update_visibility()
        jackpot.update(cell_is_free, fog)
        score.update(my_snake)
        popups.update()
        screen.update()


try:
    overlay.show_start()
    wait_for_space()

    while True:
        my_snake.reset()
        rocks.remove_all()
        jackpot.schedule()
        for food in foods:
            food.move_food()
        score.reset_score()
        overlay.hide()

        reason = play_game()

        popups.clear()
        update_visibility(game_over=True)
        score.update(my_snake)
        screen.update()
        # Drawn after the last update so it sits on top of the snake and food
        overlay.show_game_over(reason, score.score, my_snake.longest, score.breakdown())
        wait_for_space()
except (Terminator, TclError):
    # The window was closed, so there's nothing left to do
    pass
