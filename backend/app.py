"""
Slot Machine Backend API

Wraps game_logic.py in a Flask REST API. The balance lives server-side,
in memory, keyed by a session id the frontend generates once and sends
back on every request via the X-Session-Id header. This is deliberately
simple (no database, no auth) so the project stays easy to read and run,
but it means balances reset whenever the server restarts.
"""

import uuid

from flask import Flask, request, jsonify
from flask_cors import CORS

from game_logic import (
    get_slot_machine_spin,
    check_winnings,
    MAX_LINES,
    MAX_BET,
    MIN_BET,
    ROWS,
    COLS,
    SYMBOL_COUNT,
    SYMBOL_VALUE,
)

app = Flask(__name__)
CORS(app, supports_credentials=True)


GAME_STATE = {}


def get_session_id():
    """Read the session id the frontend generated, or mint a new one."""
    sid = request.headers.get("X-Session-Id")
    return sid or str(uuid.uuid4())


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/config", methods=["GET"])
def get_config():
    return jsonify({
        "maxLines": MAX_LINES,
        "maxBet": MAX_BET,
        "minBet": MIN_BET,
        "rows": ROWS,
        "cols": COLS,
        "symbolValue": SYMBOL_VALUE,
        "symbolCount": SYMBOL_COUNT,
    })


@app.route("/api/deposit", methods=["POST"])
def deposit():
    data = request.get_json(silent=True) or {}
    amount = data.get("amount")
    sid = get_session_id()

    if not isinstance(amount, int) or amount <= 0:
        return jsonify({"error": "Amount must be a positive integer."}), 400

    GAME_STATE[sid] = amount
    return jsonify({"sessionId": sid, "balance": GAME_STATE[sid]})


@app.route("/api/balance", methods=["GET"])
def get_balance():
    sid = get_session_id()
    balance = GAME_STATE.get(sid, 0)
    return jsonify({"sessionId": sid, "balance": balance})


@app.route("/api/spin", methods=["POST"])
def spin():
    data = request.get_json(silent=True) or {}
    sid = get_session_id()

    if sid not in GAME_STATE:
        return jsonify({"error": "No active session. Please deposit first."}), 400

    lines = data.get("lines")
    bet = data.get("bet")

    if not isinstance(lines, int) or not (1 <= lines <= MAX_LINES):
        return jsonify({"error": f"Lines must be between 1 and {MAX_LINES}."}), 400

    if not isinstance(bet, int) or not (MIN_BET <= bet <= MAX_BET):
        return jsonify({"error": f"Bet must be between ${MIN_BET} and ${MAX_BET}."}), 400

    balance = GAME_STATE[sid]
    total_bet = bet * lines

    if total_bet > balance:
        return jsonify({
            "error": f"You do not have enough to bet that amount. Current balance: ${balance}"
        }), 400

    slots = get_slot_machine_spin(ROWS, COLS, SYMBOL_COUNT)
    winnings, winning_lines = check_winnings(slots, lines, bet, SYMBOL_VALUE)

    new_balance = balance - total_bet + winnings
    GAME_STATE[sid] = new_balance

    return jsonify({
        "sessionId": sid,
        "slots": slots,           # e.g. [["A","B","C"], ["B","B","C"], ["C","B","A"]]
        "lines": lines,
        "bet": bet,
        "totalBet": total_bet,
        "winnings": winnings,
        "winningLines": winning_lines,
        "netChange": winnings - total_bet,
        "balance": new_balance,
    })


@app.route("/api/reset", methods=["POST"])
def reset():
    sid = get_session_id()
    GAME_STATE.pop(sid, None)
    return jsonify({"message": "Session reset."})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
