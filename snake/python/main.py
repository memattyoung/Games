from turtle import Screen, Terminator
from tkinter import TclError
import time
import random
from board import WINDOW_BG, DIM_TEXT, register_shapes, draw_board
from snake import Snake
from food import Food, FOOD_COUNT, NORMAL, BENEFIT, TYPE_COLORS, BAD_SHRINK, SHRINK_FLOOR
from scoreboard import Scoreboard
from popups import Popups
from overlay import Overlay
from rules import RulesPanel

FRAME_TIME = 1 / 30  # redraw 30 times a second, even when the snake moves slower

screen = Screen()
screen.setup(width=1200, height=800)
screen.bgcolor(WINDOW_BG)
screen.title("MJY Snake Game")
screen.tracer(0)
register_shapes(screen)

draw_board()
RulesPanel()
score = Scoreboard()
popups = Popups()
overlay = Overlay()
screen.update()

# Created once and reused every game. Nothing shows until the game starts.
my_snake = Snake()
foods = []
for _ in range(FOOD_COUNT):
    foods.append(Food(my_snake, foods))

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
        if random.randint(0, 1) == 0:
            my_snake.change_speed(-10)
            return "Benefit: speed -10%", "SLOWER"
        my_snake.add_segments(2)
        return "Benefit: +2 segments", "+2"

    # Otherwise it's bad food
    effect = random.choice(["faster", "shrink", "reverse", "drunk"])
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
        my_snake.reverse_controls()
        return "Bad: controls reversed!", "REVERSED!"
    my_snake.get_drunk()
    return "Bad: drunk!", "DRUNK!"


def play_game():
    """Run one game until the snake dies. Returns the reason it died."""
    next_move = time.monotonic()

    while True:
        time.sleep(FRAME_TIME)

        # The snake only moves every few frames, depending on how fast it's going
        if time.monotonic() >= next_move:
            next_move = time.monotonic() + my_snake.delay()
            my_snake.move()

            if my_snake.is_hit() or my_snake.hit_wall():
                return "You crashed!"

            for food in foods:
                if my_snake.head.distance(food) < 15:
                    score_text, popup_text = eat(food)
                    score.score += 1
                    score.show_score()
                    score.show_food(food.food_type, score_text)
                    popups.add(food.xcor(), food.ycor(), popup_text, TYPE_COLORS[food.food_type])
                    # Respawn it somewhere new, as a new random type
                    food.move_food()

        lost_at = my_snake.shrink_over_time()
        if lost_at:
            popups.add(lost_at[0], lost_at[1], "-1", DIM_TEXT)
        if my_snake.starved:
            return "Your snake starved to death!"

        score.update(my_snake)
        popups.update()
        screen.update()


try:
    overlay.show_start()
    wait_for_space()

    while True:
        my_snake.reset()
        for food in foods:
            food.move_food()
        score.reset_score()
        overlay.hide()

        reason = play_game()

        popups.clear()
        score.update(my_snake)
        screen.update()
        # Drawn after the last update so it sits on top of the snake and food
        overlay.show_game_over(reason, score.score, my_snake.longest)
        wait_for_space()
except (Terminator, TclError):
    # The window was closed, so there's nothing left to do
    pass
