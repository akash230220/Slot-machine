# 🎰 The Gilded Reel

A full-stack web version of a Python CLI slot machine — a Flask API doing all
the game logic and payout math, and a vanilla HTML/CSS/JS frontend styled
as a 1920s art-deco arcade cabinet, with a real mechanical reel-spin
animation and odometer-style counters.

The original CLI script (`main.py`-style logic) is preserved almost exactly
in `backend/game_logic.py` — same symbol counts, same payout values, same
odds. Only the interface changed.

## Live demo (once deployed)

Run the backend and frontend locally following the steps below, or deploy
using the notes at the bottom of this file.

## Project structure

```
slot-machine/
├── backend/
│   ├── app.py              # Flask API (routes, session/balance handling)
│   ├── game_logic.py       # Core game engine (ported from the CLI script)
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── index.html          # Cabinet layout (deposit / game / cash-out screens)
│   ├── css/
│   │   └── style.css       # Art-deco theme, reel + odometer animations
│   └── js/
│       └── script.js       # API calls, reel spin animation, confetti
├── .gitignore
└── README.md
```

## How it works

- **Backend (`/backend`)** — a small Flask app with four endpoints:
  - `GET /api/config` — game constants (max lines, bet limits, symbol values)
  - `POST /api/deposit` — starts a session with a starting balance
  - `POST /api/spin` — validates the bet, spins, returns the result, updates balance
  - `POST /api/reset` — clears a session (used by "Cash Out")

  The balance is tracked **server-side in memory**, keyed by a session ID the
  browser generates once (`X-Session-Id` header). This mirrors the trust
  boundary of the original CLI game: the player never gets to tell the
  server what they won — the server always computes it.

- **Frontend (`/frontend`)** — no build step, no framework. `script.js` calls
  the API, then animates the DOM to match the result: each reel column gets
  a strip of random filler symbols appended before the real result and
  slides past it with a staggered `cubic-bezier` easing per column (so the
  columns don't all stop at once, like a real machine), then trims back down
  to the final symbols.

## Running it locally

### 1. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API will be running at `http://127.0.0.1:5000`.

### 2. Frontend

The frontend is static — no build tools needed. Easiest way to serve it
with CORS working correctly:

```bash
cd frontend
python3 -m http.server 5500
```

Then open `http://127.0.0.1:5500` in your browser.

> If you serve the frontend from a different host/port, update `API_BASE`
> at the top of `js/script.js` (or set `window.SLOT_API_BASE` before the
> script loads).

## Game rules (unchanged from the original script)

| Symbol | Count in pool | Payout multiplier |
|--------|---------------|--------------------|
| A      | 2             | ×5                 |
| B      | 4             | ×4                 |
| C      | 6             | ×3                 |
| D      | 8             | ×2                 |

- 3×3 grid, up to 3 horizontal paylines.
- A line pays out `bet × symbol value` if all 3 symbols in that row match.
- Total bet = `bet per line × number of lines`.

## Deploying

- **Backend**: any Python host works (Render, Railway, Fly.io, a small VPS
  with gunicorn). Set `debug=False` and put a real `SECRET_KEY`/session store
  behind it if you want persistence across restarts.
- **Frontend**: any static host (GitHub Pages, Netlify, Vercel). Just update
  `API_BASE` in `js/script.js` to point at your deployed backend URL, and
  make sure CORS on the backend allows your frontend's origin.

## Next steps / ideas

- Swap the in-memory `GAME_STATE` dict for Redis or a database for real
  persistence across server restarts.
- Add a sound skill (reel clicks, coin drop) with the Web Audio API.
- Add a `/api/leaderboard` endpoint if you want to track high scores.
