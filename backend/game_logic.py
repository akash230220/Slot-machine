"""
Core slot machine engine.

This is a direct refactor of the original CLI game logic into stateless,
reusable functions so it can be driven by a web API instead of input().
The math and probabilities are unchanged from the original script.
"""

import random

ROWS = 3
COLS = 3
MAX_LINES = 3
MAX_BET = 100
MIN_BET = 1

SYMBOL_COUNT = {"A": 2, "B": 4, "C": 6, "D": 8}
SYMBOL_VALUE = {"A": 5, "B": 4, "C": 3, "D": 2}


def get_slot_machine_spin(rows=ROWS, cols=COLS, symbols=None):
    """Generate a random rows x cols grid of symbols, column by column,
    without replacement within a column (same behaviour as the original)."""
    symbols = symbols or SYMBOL_COUNT
    all_symbols = []
    for symbol, count in symbols.items():
        all_symbols.extend([symbol] * count)

    columns = []
    for _ in range(cols):
        column = []
        current_symbols = all_symbols[:]
        for _ in range(rows):
            value = random.choice(current_symbols)
            current_symbols.remove(value)
            column.append(value)
        columns.append(column)

    return columns


def check_winnings(columns, lines, bet, values=None):
    """Check each horizontal line for a match across all columns."""
    values = values or SYMBOL_VALUE
    winnings = 0
    winning_lines = []
    for line in range(lines):
        symbol = columns[0][line]
        for column in columns:
            if column[line] != symbol:
                break
        else:
            winnings += values[symbol] * bet
            winning_lines.append(line + 1)

    return winnings, winning_lines


def play_spin(bet, lines):
    """Validate inputs, run a spin, and return a full result payload."""
    if not (MIN_BET <= bet <= MAX_BET):
        raise ValueError(f"Bet must be between {MIN_BET} and {MAX_BET}.")
    if not (1 <= lines <= MAX_LINES):
        raise ValueError(f"Lines must be between 1 and {MAX_LINES}.")

    total_bet = bet * lines
    columns = get_slot_machine_spin(ROWS, COLS, SYMBOL_COUNT)
    winnings, winning_lines = check_winnings(columns, lines, bet, SYMBOL_VALUE)
    net = winnings - total_bet

    return {
        "columns": columns,
        "lines": lines,
        "bet": bet,
        "total_bet": total_bet,
        "winnings": winnings,
        "winning_lines": winning_lines,
        "net": net,
    }
