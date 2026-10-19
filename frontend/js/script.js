// =============================================================================
// THE GILDED REEL — frontend logic
// Talks to the Flask API for every spin (all randomness/payouts happen
// server-side); this file is purely presentation + animation.
// =============================================================================

const API_BASE = window.SLOT_API_BASE || "http://127.0.0.1:5000/api";

const SYMBOLS = ["A", "B", "C", "D"];
const ROWS = 3;
const COLS = 3;
const CELL_HEIGHT = window.innerWidth <= 420 ? 60 : 72;

// A session id persisted for the tab's lifetime so the server can track
// this player's balance without needing real accounts.
let sessionId = sessionStorage.getItem("gilded-reel-session") ||
  (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
sessionStorage.setItem("gilded-reel-session", sessionId);

let state = {
  balance: 0,
  lines: 1,
  bet: 1,
  maxLines: 3,
  maxBet: 100,
  minBet: 1,
  spinning: false,
};

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const depositScreen = document.getElementById("deposit-screen");
const gameScreen = document.getElementById("game-screen");
const overScreen = document.getElementById("over-screen");

const depositInput = document.getElementById("deposit-input");
const depositBtn = document.getElementById("deposit-btn");
const depositError = document.getElementById("deposit-error");

const reelsEl = document.getElementById("reels");
const resultMessage = document.getElementById("result-message");
const spinBtn = document.getElementById("spin-btn");
const cashoutBtn = document.getElementById("cashout-btn");
const spinError = document.getElementById("spin-error");

const linesValueEl = document.getElementById("lines-value");
const betValueEl = document.getElementById("bet-value");
const totalBetValueEl = document.getElementById("total-bet-value");

const balanceOdometer = document.getElementById("balance-odometer");
const winOdometer = document.getElementById("win-odometer");
const finalOdometer = document.getElementById("final-odometer");

const playAgainBtn = document.getElementById("play-again-btn");

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": sessionId,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

// ---------------------------------------------------------------------------
// Odometer rendering (signature mechanical-counter element)
// ---------------------------------------------------------------------------
function buildOdometer(container, digitCount) {
  container.innerHTML = "";
  const prefix = document.createElement("span");
  prefix.className = "odometer-prefix";
  prefix.textContent = "$";
  container.appendChild(prefix);

  for (let i = 0; i < digitCount; i++) {
    const digit = document.createElement("div");
    digit.className = "odometer-digit";
    const strip = document.createElement("div");
    strip.className = "digit-strip";
    for (let n = 0; n <= 9; n++) {
      const span = document.createElement("span");
      span.textContent = n;
      strip.appendChild(span);
    }
    digit.appendChild(strip);
    container.appendChild(digit);
  }
}

function setOdometerValue(container, value, digitCount) {
  const clamped = Math.max(0, Math.min(value, Math.pow(10, digitCount) - 1));
  const str = String(clamped).padStart(digitCount, "0");
  const digitEls = container.querySelectorAll(".odometer-digit .digit-strip");
  digitEls.forEach((strip, i) => {
    const n = parseInt(str[i], 10);
    strip.style.transform = `translateY(${-n * 22}px)`;
  });
}

function digitsNeeded(maxPossible) {
  return Math.max(3, String(maxPossible).length);
}

// ---------------------------------------------------------------------------
// Reel construction
// ---------------------------------------------------------------------------
function buildReels() {
  reelsEl.innerHTML = "";
  for (let c = 0; c < COLS; c++) {
    const col = document.createElement("div");
    col.className = "reel-col";
    col.dataset.col = c;

    const strip = document.createElement("div");
    strip.className = "reel-strip";
    // seed with random symbols; will be replaced on first spin
    for (let r = 0; r < ROWS; r++) {
      strip.appendChild(makeCell(randomSymbol()));
    }
    col.appendChild(strip);
    reelsEl.appendChild(col);
  }
}

function makeCell(symbol) {
  const cell = document.createElement("div");
  cell.className = `symbol-cell sym-${symbol}`;
  cell.textContent = symbol;
  cell.dataset.symbol = symbol;
  return cell;
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// Animate each column: append a long strip of random symbols, slide it
// past, then land on the real result from the server.
function animateReels(finalColumns) {
  return new Promise((resolve) => {
    const cols = reelsEl.querySelectorAll(".reel-col");
    let completed = 0;

    cols.forEach((col, colIndex) => {
      const strip = col.querySelector(".reel-strip");
      const finalSymbols = finalColumns[colIndex]; // array of ROWS symbols

      // Build a long filler strip of random symbols to simulate a real spin.
      const fillerCount = 18 + colIndex * 4; // stagger stop times per column
      const allSymbols = [];
      for (let i = 0; i < fillerCount; i++) allSymbols.push(randomSymbol());
      allSymbols.push(...finalSymbols);

      strip.innerHTML = "";
      allSymbols.forEach((s) => strip.appendChild(makeCell(s)));

      // Start above the frame, no transition, then transition down.
      strip.style.transition = "none";
      strip.style.transform = "translateY(0px)";

      // Force reflow so the browser registers the reset position.
      // eslint-disable-next-line no-unused-expressions
      strip.offsetHeight;

      const targetOffset = (allSymbols.length - ROWS) * CELL_HEIGHT;
      const duration = 900 + colIndex * 350;

      requestAnimationFrame(() => {
        strip.style.transition = `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
        strip.style.transform = `translateY(-${targetOffset}px)`;
      });

      const onEnd = () => {
        strip.removeEventListener("transitionend", onEnd);
        // Trim the strip down to just the final visible symbols so the
        // DOM stays small, keeping it at the same visual position.
        strip.innerHTML = "";
        finalSymbols.forEach((s) => strip.appendChild(makeCell(s)));
        strip.style.transition = "none";
        strip.style.transform = "translateY(0px)";

        completed += 1;
        if (completed === cols.length) resolve();
      };
      strip.addEventListener("transitionend", onEnd);
    });
  });
}

function highlightWinningLines(winningLines, finalColumns) {
  document.querySelectorAll(".payline").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".symbol-cell").forEach((c) => c.classList.remove("win-glow"));

  winningLines.forEach((lineNum) => {
    const payline = document.querySelector(`.payline-${lineNum}`);
    if (payline) payline.classList.add("active");

    const rowIndex = lineNum - 1;
    document.querySelectorAll(".reel-col").forEach((col) => {
      const cell = col.querySelectorAll(".symbol-cell")[rowIndex];
      if (cell) cell.classList.add("win-glow");
    });
  });
}

// ---------------------------------------------------------------------------
// Confetti burst
// ---------------------------------------------------------------------------
function launchConfetti() {
  const layer = document.getElementById("confetti-layer");
  const colors = ["#c9a227", "#e8c766", "#6fe3a3", "#e8927a", "#8ac7e8"];
  for (let i = 0; i < 36; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

// ---------------------------------------------------------------------------
// Controls (lines / bet steppers)
// ---------------------------------------------------------------------------
function refreshControlsUI() {
  linesValueEl.textContent = state.lines;
  betValueEl.textContent = state.bet;
  totalBetValueEl.textContent = `$${state.lines * state.bet}`;
}

document.querySelectorAll(".step-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.target;
    const dir = parseInt(btn.dataset.dir, 10);
    if (target === "lines") {
      state.lines = Math.min(state.maxLines, Math.max(1, state.lines + dir));
    } else if (target === "bet") {
      state.bet = Math.min(state.maxBet, Math.max(state.minBet, state.bet + dir));
    }
    refreshControlsUI();
  });
});

// ---------------------------------------------------------------------------
// Deposit flow
// ---------------------------------------------------------------------------
depositBtn.addEventListener("click", handleDeposit);
depositInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleDeposit();
});

async function handleDeposit() {
  depositError.textContent = "";
  const amount = parseInt(depositInput.value, 10);

  if (!Number.isInteger(amount) || amount <= 0) {
    depositError.textContent = "Enter a whole number greater than 0.";
    return;
  }

  depositBtn.disabled = true;
  try {
    const data = await apiFetch("/deposit", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
    state.balance = data.balance;
    await loadConfig();
    buildOdometer(balanceOdometer, digitsNeeded(state.balance));
    buildOdometer(winOdometer, 4);
    setOdometerValue(balanceOdometer, state.balance, digitsNeeded(state.balance));
    setOdometerValue(winOdometer, 0, 4);

    depositScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    buildReels();
    refreshControlsUI();
  } catch (err) {
    depositError.textContent = err.message;
  } finally {
    depositBtn.disabled = false;
  }
}

async function loadConfig() {
  try {
    const cfg = await apiFetch("/config");
    state.maxLines = cfg.maxLines;
    state.maxBet = cfg.maxBet;
    state.minBet = cfg.minBet;
    state.bet = Math.max(state.minBet, state.bet);
  } catch (err) {
    // Fall back to defaults already set in state if config can't be reached.
    console.warn("Could not load config:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Spin flow
// ---------------------------------------------------------------------------
spinBtn.addEventListener("click", handleSpin);

async function handleSpin() {
  if (state.spinning) return;
  spinError.textContent = "";
  resultMessage.classList.remove("win", "lose");
  document.querySelectorAll(".payline").forEach((p) => p.classList.remove("active"));
  winOdometer.classList.remove("flash");

  const totalBet = state.lines * state.bet;
  if (totalBet > state.balance) {
    spinError.textContent = `You need $${totalBet} for this spin — balance is $${state.balance}.`;
    return;
  }

  state.spinning = true;
  spinBtn.disabled = true;
  cashoutBtn.disabled = true;
  spinBtn.classList.add("pulling");
  resultMessage.textContent = "Reels turning…";

  try {
    const data = await apiFetch("/spin", {
      method: "POST",
      body: JSON.stringify({ lines: state.lines, bet: state.bet }),
    });

    // data.slots is columns-major: [[col0row0,col0row1,col0row2], [col1...], [col2...]]
    await animateReels(data.slots);
    highlightWinningLines(data.winningLines, data.slots);

    const digitCount = digitsNeeded(Math.max(state.balance, data.balance));
    if (balanceOdometer.querySelectorAll(".odometer-digit").length < digitCount) {
      buildOdometer(balanceOdometer, digitCount);
    }
    setOdometerValue(balanceOdometer, data.balance, balanceOdometer.querySelectorAll(".odometer-digit").length);
    setOdometerValue(winOdometer, data.winnings, 4);

    state.balance = data.balance;

    if (data.winnings > 0) {
      winOdometer.classList.add("flash");
      resultMessage.textContent = `You won $${data.winnings} on line${data.winningLines.length > 1 ? "s" : ""} ${data.winningLines.join(", ")}!`;
      resultMessage.classList.add("win");
      if (data.winnings >= totalBet * 2) launchConfetti();
    } else {
      resultMessage.textContent = "No match this time — pull again.";
      resultMessage.classList.add("lose");
    }

    if (state.balance <= 0) {
      setTimeout(() => showGameOver(), 900);
    }
  } catch (err) {
    spinError.textContent = err.message;
    resultMessage.textContent = "Place your bet and pull the lever.";
  } finally {
    state.spinning = false;
    spinBtn.disabled = false;
    cashoutBtn.disabled = false;
    spinBtn.classList.remove("pulling");
  }
}

// ---------------------------------------------------------------------------
// Cash out / game over
// ---------------------------------------------------------------------------
cashoutBtn.addEventListener("click", () => showGameOver());

async function showGameOver() {
  try {
    await apiFetch("/reset", { method: "POST" });
  } catch (err) {
    console.warn("Reset failed:", err.message);
  }

  gameScreen.classList.add("hidden");
  overScreen.classList.remove("hidden");
  buildOdometer(finalOdometer, digitsNeeded(state.balance));
  setOdometerValue(finalOdometer, state.balance, digitsNeeded(state.balance));
}

playAgainBtn.addEventListener("click", () => {
  state.balance = 0;
  state.lines = 1;
  state.bet = 1;
  overScreen.classList.add("hidden");
  depositScreen.classList.remove("hidden");
  depositInput.value = "";
  depositError.textContent = "";
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
loadConfig();
