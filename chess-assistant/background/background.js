// Фоновый скрипт (background.js)
// Динамический MultiPV (1 / 3 / 5), расчёт премува (ponder) и мгновенная отмена устаревших задач

const extApi = typeof browser !== "undefined" ? browser : chrome;

console.log("♟️ [Background] Запуск фонового скрипта (Dynamic MultiPV & Premove Engine)...");

let stockfish = null;
let isReady = false;
let currentMultiPV = 3;

// Массив кандидатов для MultiPV 1..5: { move, score, ponder }
let candidates = [];

let isSearching = false;
let currentSearch = null; // { fen, options, resolve, timer, stopSent, cancelled }
let nextSearch = null;    // { fen, options, resolve }

function initStockfish() {
  if (stockfish) return;

  try {
    const workerUrl = extApi.runtime.getURL("background/stockfish-19-full.js");
    stockfish = new Worker(workerUrl);

    stockfish.onerror = function (err) {
      console.error("❌ [Stockfish Worker Error]:", err);
    };

    stockfish.onmessage = function (event) {
      const line = typeof event.data === "string" ? event.data : "";

      if (line.startsWith("id name")) {
        console.log("♟️ [Engine Identification]:", line);
      }

      if (line === "uciok" || line === "readyok") {
        isReady = true;
        stockfish.postMessage(`setoption name MultiPV value ${currentMultiPV}`);
        console.log(`✅ [Stockfish 19 FULL NNUE] Готов! MultiPV = ${currentMultiPV}`);
      }

      // Универсальный парсинг линий MultiPV (1..5) + второго хода (ponder / премув)
      if (line.includes("multipv ")) {
        const mpvMatch = line.match(/\bmultipv\s+(\d+)/);
        if (mpvMatch) {
          const idx = parseInt(mpvMatch[1], 10) - 1;
          if (idx >= 0 && idx < 5) {
            if (!candidates[idx]) {
              candidates[idx] = { move: null, score: null, ponder: null };
            }

            const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
            const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
            if (cpMatch) {
              candidates[idx].score = { type: "cp", value: parseInt(cpMatch[1], 10) };
            } else if (mateMatch) {
              candidates[idx].score = { type: "mate", value: parseInt(mateMatch[1], 10) };
            }

            const pvMatch = line.match(/\bpv\s+(.+)$/);
            if (pvMatch) {
              const pvMoves = pvMatch[1].trim().split(/\s+/);
              if (pvMoves[0] && pvMoves[0] !== "(none)") candidates[idx].move = pvMoves[0];
              if (pvMoves[1] && pvMoves[1] !== "(none)") candidates[idx].ponder = pvMoves[1];
            }
          }
        }
      }

      // Завершение анализа позиции
      if (line.startsWith("bestmove")) {
        const parts = line.trim().split(/\s+/);
        const bestFromLine = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
        const ponderFromLine = (parts[2] === "ponder" && parts[3] && parts[3] !== "(none)") ? parts[3] : null;

        const moves = buildMovesResult(bestFromLine);
        const ponderMove = candidates[0]?.ponder || ponderFromLine || null;

        console.log(`🎯 [Stockfish PV=${currentMultiPV}] Ходы:`, moves.map((m) => m.move).join(", "), "| Премув:", ponderMove);

        finishCurrentSearch({
          cancelled: false,
          moves,
          ponderMove,
          bestMove: moves[0]?.move || null,
          bestScore: moves[0]?.score || null
        });
      }
    };

    stockfish.postMessage("uci");
    stockfish.postMessage("isready");
  } catch (err) {
    console.error("❌ Ошибка при создании Worker Stockfish:", err);
  }
}

function buildMovesResult(fallbackBest) {
  const result = [];
  const seen = new Set();

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i];
    if (item && item.move && item.move !== "(none)" && !seen.has(item.move)) {
      seen.add(item.move);
      result.push({ move: item.move, score: item.score || null });
    }
  }

  if (result.length === 0 && fallbackBest && fallbackBest !== "(none)") {
    result.push({ move: fallbackBest, score: candidates[0]?.score || null });
  }

  return result;
}

initStockfish();

function startSearch(fen, options, resolve) {
  isSearching = true;
  candidates = [];

  const movetime = options.movetime || null;
  const depth = options.depth || null;
  const requestedPV = Math.max(1, Math.min(5, options.multiPV || 3));

  if (requestedPV !== currentMultiPV) {
    currentMultiPV = requestedPV;
    stockfish.postMessage(`setoption name MultiPV value ${currentMultiPV}`);
  }

  const waitLimit = movetime ? Math.max(3000, movetime + 3500) : (depth ? Math.max(12000, depth * 800) : 15000);

  const timer = setTimeout(() => {
    if (currentSearch && currentSearch.resolve === resolve && !currentSearch.stopSent) {
      console.warn("⚠️ [Stockfish] Лимит ожидания, отправляем stop:", fen);
      currentSearch.stopSent = true;
      stockfish.postMessage("stop");

      // Аварийный сброс, если воркер не ответил на stop за 800мс
      setTimeout(() => {
        if (currentSearch && currentSearch.resolve === resolve) {
          const moves = buildMovesResult(null);
          const ponderMove = candidates[0]?.ponder || null;
          finishCurrentSearch({
            cancelled: false,
            moves,
            ponderMove,
            bestMove: moves[0]?.move || null,
            bestScore: moves[0]?.score || null
          });
        }
      }, 800);
    }
  }, waitLimit);

  currentSearch = { fen, options, resolve, timer, stopSent: false, cancelled: false };

  stockfish.postMessage(`position fen ${fen}`);
  if (movetime && depth) {
    stockfish.postMessage(`go depth ${depth} movetime ${movetime}`);
  } else if (movetime) {
    stockfish.postMessage(`go movetime ${movetime}`);
  } else {
    stockfish.postMessage(`go depth ${depth || 14}`);
  }
}

function finishCurrentSearch(result) {
  if (currentSearch) {
    clearTimeout(currentSearch.timer);
    const cb = currentSearch.resolve;
    const wasCancelled = currentSearch.cancelled;
    currentSearch = null;
    isSearching = false;
    if (cb) {
      cb(wasCancelled ? { cancelled: true, moves: [], ponderMove: null, bestMove: null, bestScore: null } : result);
    }
  } else {
    isSearching = false;
  }

  // Запускаем самую свежую позицию из очереди, если она ждёт
  if (nextSearch) {
    const next = nextSearch;
    nextSearch = null;
    startSearch(next.fen, next.options, next.resolve);
  }
}

function calculateMove(fen, options = {}) {
  return new Promise((resolve) => {
    initStockfish();

    if (!isSearching) {
      startSearch(fen, options, resolve);
      return;
    }

    // Движок занят предыдущей задачей: помечаем её отменённой и прерываем!
    if (currentSearch) {
      currentSearch.cancelled = true;
      if (!currentSearch.stopSent) {
        currentSearch.stopSent = true;
        stockfish.postMessage("stop");
      }
    }

    if (nextSearch) {
      nextSearch.resolve({ cancelled: true, moves: [], ponderMove: null, bestMove: null, bestScore: null });
    }
    nextSearch = { fen, options, resolve };
  });
}

// Связь через sendMessage
extApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "ANALYZE_POSITION") {
    calculateMove(request.fen, {
      depth: request.depth,
      movetime: request.movetime,
      multiPV: request.multiPV
    }).then((res) => {
      sendResponse(res);
    });
    return true;
  }

  if (request.type === "SET_MULTIPV") {
    const pv = Math.max(1, Math.min(5, request.multiPV || 3));
    initStockfish();
    if (!isSearching && pv !== currentMultiPV) {
      currentMultiPV = pv;
      stockfish.postMessage(`setoption name MultiPV value ${currentMultiPV}`);
    }
    sendResponse({ ok: true, multiPV: pv });
    return false;
  }
});

// Обработчик клика по иконке пешки на панели инструментов браузера
const actionApi = extApi.action || extApi.browserAction;
if (actionApi && actionApi.onClicked) {
  actionApi.onClicked.addListener((tab) => {
    if (tab && tab.id) {
      extApi.tabs.sendMessage(tab.id, { type: "TOGGLE_WIDGET" }, () => {
        if (extApi.runtime.lastError) {
          // Игнорируем ошибку на страницах, где нет content script
        }
      });
    }
  });
}

