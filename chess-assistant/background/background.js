// Фоновый скрипт (background.js)
// Динамический MultiPV (1 / 3 / 5), расчёт премува (ponder) и мгновенная отмена устаревших задач

const extApi = typeof browser !== "undefined" ? browser : chrome;
const IS_MOBILE_BUILD = false;

console.log("♟️ [Background] Запуск фонового скрипта (Dynamic MultiPV & Premove Engine)...");

let stockfish = null;
let isReady = false;
let isUciOk = false;
let currentMultiPV = IS_MOBILE_BUILD ? 1 : 3;
let desiredMultiPV = currentMultiPV;

// Массив кандидатов для MultiPV 1..5: { move, score, ponder }
let completedDepth = 0;
let completedCandidates = [];
let activeDepth = 0;
let activeDepthCandidates = [];
let moveInfoMap = new Map();

let isSearching = false;
let currentSearch = null; // { fen, options, resolve, timer, emergencyTimer, stopSent, cancelled }
let nextSearch = null;    // { fen, options, resolve }
let staleBestmovesPending = 0;
let wedgedWorkerTimer = null;

const EMPTY_SEARCH_RESULT = {
  cancelled: false,
  moves: [],
  ponderMove: null,
  bestMove: null,
  bestScore: null
};

const CANCELLED_SEARCH_RESULT = {
  cancelled: true,
  moves: [],
  ponderMove: null,
  bestMove: null,
  bestScore: null
};

const ERROR_SEARCH_RESULT = {
  cancelled: true,
  timedOut: true,
  moves: [],
  ponderMove: null,
  bestMove: null,
  bestScore: null
};

function destroyWorker(worker) {
  if (!worker) return;
  worker.onmessage = null;
  worker.onerror = null;
  try {
    worker.terminate();
  } catch (_) {}
}

function initStockfish() {
  if (stockfish) return;

  try {
    const workerUrl = extApi.runtime.getURL(
      IS_MOBILE_BUILD ? "background/stockfish-19.js" : "background/stockfish-19-full.js"
    );
    const worker = new Worker(workerUrl);
    stockfish = worker;
    isReady = false;
    isUciOk = false;

    worker.onerror = function (err) {
      if (worker !== stockfish) return;
      console.error("❌ [Stockfish Worker Error]:", err);
      stockfish = null;
      isReady = false;
      isUciOk = false;
      staleBestmovesPending = 0;
      if (wedgedWorkerTimer) {
        clearTimeout(wedgedWorkerTimer);
        wedgedWorkerTimer = null;
      }

      destroyWorker(worker);

      if (currentSearch) {
        finishCurrentSearch({ ...ERROR_SEARCH_RESULT });
      }
      if (nextSearch) {
        const pending = nextSearch;
        nextSearch = null;
        pending.resolve({ ...ERROR_SEARCH_RESULT });
      }
    };

    worker.onmessage = function (event) {
      if (worker !== stockfish) return;
      const line = typeof event.data === "string" ? event.data : "";

      if (line.startsWith("id name")) {
        console.log("♟️ [Engine Identification]:", line);
      }

      if (line === "uciok") {
        if (!isUciOk) {
          isUciOk = true;
          currentMultiPV = desiredMultiPV;
          if (IS_MOBILE_BUILD) {
            // Оптимизация параметров WASM-движка под мобильные процессоры
            worker.postMessage("setoption name Threads value 1");
            worker.postMessage("setoption name Hash value 16");
            worker.postMessage("setoption name Ponder value false");
            worker.postMessage("setoption name Move Overhead value 10");
          }
          worker.postMessage(`setoption name MultiPV value ${currentMultiPV}`);
          worker.postMessage("isready");
        }
      }

      if (line === "readyok") {
        isReady = true;
        if (IS_MOBILE_BUILD) {
          console.log(`✅ [Stockfish 19 Lite WASM Mobile] Оптимизирован под мобильный процессор и готов! MultiPV = ${currentMultiPV}`);
        } else {
          console.log(`✅ [Stockfish 19 FULL NNUE] Готов! MultiPV = ${currentMultiPV}`);
        }
        if (nextSearch && !isSearching && staleBestmovesPending === 0) {
          const next = nextSearch;
          nextSearch = null;
          startSearch(next.fen, next.options, next.resolve);
        }
      }

      // Если ждём запоздавший bestmove от принудительно сброшенного расчёта — не смешиваем его с новым
      if (staleBestmovesPending > 0) {
        if (line.startsWith("bestmove")) {
          staleBestmovesPending = Math.max(0, staleBestmovesPending - 1);
          if (staleBestmovesPending === 0) {
            if (wedgedWorkerTimer) {
              clearTimeout(wedgedWorkerTimer);
              wedgedWorkerTimer = null;
            }
            if (nextSearch && stockfish && isReady && !isSearching) {
              const next = nextSearch;
              nextSearch = null;
              startSearch(next.fen, next.options, next.resolve);
            }
          }
        }
        return;
      }

      // Универсальный парсинг линий MultiPV (1..5) + второго хода (ponder / премув) с учётом глубины
      if (line.includes("multipv ") || (currentMultiPV === 1 && line.startsWith("info ") && /\bscore\b/.test(line))) {
        const mpvMatch = line.match(/\bmultipv\s+(\d+)/);
        const idx = mpvMatch ? parseInt(mpvMatch[1], 10) - 1 : 0;
        if (idx >= 0 && idx < 5) {
          const depthMatch = line.match(/\bdepth\s+(\d+)/);
          const depth = depthMatch ? parseInt(depthMatch[1], 10) : activeDepth;
          const isBound = /\b(lowerbound|upperbound)\b/.test(line);

          const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
          const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
          let parsedScore = null;
          if (cpMatch) {
            parsedScore = { type: "cp", value: parseInt(cpMatch[1], 10) };
          } else if (mateMatch) {
            parsedScore = { type: "mate", value: parseInt(mateMatch[1], 10) };
          }

          const pvMatch = line.match(/\bpv\s+(.+)$/);
          let newMove = null;
          let parsedPonder = null;
          if (pvMatch) {
            const pvMoves = pvMatch[1].trim().split(/\s+/);
            if (pvMoves[0] && pvMoves[0] !== "(none)") {
              newMove = pvMoves[0];
              if (pvMoves[1] && pvMoves[1] !== "(none)") {
                parsedPonder = pvMoves[1];
              }
            }
          }

          if (depth > activeDepth) {
            // Не сбрасываем активный слой, если на новой глубине пока прилетел только промежуточный bound без полного хода
            if (!isBound || activeDepth === 0) {
              const activeValid = activeDepthCandidates.filter((c) => c && c.move && !c.isBound).length;
              const completedValid = completedCandidates.filter((c) => c && c.move).length;
              if (activeValid > 0 && (activeValid >= completedValid || completedValid === 0)) {
                completedCandidates = activeDepthCandidates.map((c) => (c ? { ...c } : null));
                completedDepth = activeDepth;
              }
              activeDepth = depth;
              activeDepthCandidates = [];
            }
          }

          if (newMove) {
            const prev = moveInfoMap.get(newMove);
            if (!prev || depth > prev.depth || (depth === prev.depth && (!isBound || prev.isBound))) {
              const exactPrevScore = (!prev?.isBound && prev?.score) ? prev.score : null;
              moveInfoMap.set(newMove, {
                move: newMove,
                score: (!isBound && parsedScore) ? parsedScore : (exactPrevScore || parsedScore || prev?.score || null),
                ponder: parsedPonder || (prev ? prev.ponder : null),
                depth,
                isBound
              });
            }
          }

          if (depth === activeDepth) {
            if (!activeDepthCandidates[idx]) {
              activeDepthCandidates[idx] = { move: null, score: null, ponder: null, depth, isBound };
            }

            const prevExact = newMove ? moveInfoMap.get(newMove) : null;
            if (!isBound && parsedScore) {
              activeDepthCandidates[idx].score = parsedScore;
              activeDepthCandidates[idx].isBound = false;
              activeDepthCandidates[idx].depth = depth;
            } else if (!activeDepthCandidates[idx].score) {
              activeDepthCandidates[idx].score = prevExact?.score || parsedScore || null;
              activeDepthCandidates[idx].isBound = Boolean(isBound && !prevExact?.score);
              activeDepthCandidates[idx].depth = prevExact?.score ? prevExact.depth : depth;
            }

            if (newMove && (!isBound || !activeDepthCandidates[idx].move)) {
              const moveChanged = activeDepthCandidates[idx].move !== newMove;
              activeDepthCandidates[idx].move = newMove;
              if (moveChanged && isBound && prevExact?.score) {
                activeDepthCandidates[idx].score = prevExact.score;
                activeDepthCandidates[idx].depth = prevExact.depth;
              }
              if (parsedPonder) {
                activeDepthCandidates[idx].ponder = parsedPonder;
              } else if (moveChanged || !isBound) {
                activeDepthCandidates[idx].ponder = prevExact?.ponder || null;
              }
            }

            const validCount = activeDepthCandidates.filter((c) => c && c.move && !c.isBound).length;
            const completedCount = completedCandidates.filter((c) => c && c.move).length;
            if (!isBound && (validCount >= currentMultiPV || (validCount >= completedCount && idx + 1 >= currentMultiPV))) {
              completedCandidates = activeDepthCandidates.map((c) => (c ? { ...c } : null));
              completedDepth = activeDepth;
            }
          }
        }
      }

      // Завершение анализа позиции
      if (line.startsWith("bestmove")) {
        if (!currentSearch) return;
        const parts = line.trim().split(/\s+/);
        const bestFromLine = parts[1] && parts[1] !== "(none)" ? parts[1] : null;
        const ponderFromLine = (parts[2] === "ponder" && parts[3] && parts[3] !== "(none)") ? parts[3] : null;

        const moves = buildMovesResult(bestFromLine, ponderFromLine);
        const ponderMove = (moves[0]?.move === bestFromLine ? (ponderFromLine || moves[0]?.ponder) : moves[0]?.ponder) || ponderFromLine || null;

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

    worker.postMessage("uci");
  } catch (err) {
    console.error("❌ Ошибка при создании Worker Stockfish:", err);
    stockfish = null;
    isReady = false;
    isUciOk = false;
  }
}

function buildMovesResult(fallbackBest, fallbackPonder = null) {
  const result = [];
  const seen = new Set();

  for (let i = 0; i < activeDepthCandidates.length; i++) {
    const item = activeDepthCandidates[i];
    if (item && item.move && item.move !== "(none)" && !seen.has(item.move)) {
      seen.add(item.move);
      result.push({
        move: item.move,
        score: item.score ? { ...item.score } : null,
        ponder: item.ponder || null,
        _depth: item.depth || activeDepth
      });
    }
  }

  for (let i = 0; i < completedCandidates.length && result.length < currentMultiPV; i++) {
    const item = completedCandidates[i];
    if (item && item.move && item.move !== "(none)" && !seen.has(item.move)) {
      seen.add(item.move);
      result.push({
        move: item.move,
        score: item.score ? { ...item.score } : null,
        ponder: item.ponder || null,
        _depth: item.depth || completedDepth
      });
    }
  }

  if (fallbackBest && fallbackBest !== "(none)") {
    const existingIdx = result.findIndex((m) => m.move === fallbackBest);
    if (existingIdx > 0) {
      const [bestItem] = result.splice(existingIdx, 1);
      result.unshift(bestItem);
    } else if (existingIdx === -1) {
      const info = moveInfoMap.get(fallbackBest);
      result.unshift({
        move: fallbackBest,
        score: info?.score ? { ...info.score } : null,
        ponder: fallbackPonder || info?.ponder || null,
        _depth: info?.depth || activeDepth
      });
      if (result.length > currentMultiPV) {
        result.length = currentMultiPV;
      }
    }
    if (result[0] && result[0].move === fallbackBest && !result[0].ponder && fallbackPonder) {
      result[0].ponder = fallbackPonder;
    }
  }

  // Согласование оценок при смешивании незавершённой новой глубины со старой:
  // ход более низкого ранга со старой глубины не может иметь cp-оценку выше хода более высокого ранга с новой глубины
  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const curr = result[i];
    if (
      prev.score &&
      curr.score &&
      prev.score.type === "cp" &&
      curr.score.type === "cp" &&
      curr._depth < prev._depth &&
      curr.score.value > prev.score.value
    ) {
      curr.score = { type: "cp", value: prev.score.value };
    }
  }

  return result.map(({ move, score, ponder }) => ({ move, score, ponder }));
}

initStockfish();

function scheduleEmergencyReset(searchState) {
  if (!searchState || searchState.emergencyTimer) return;
  searchState.emergencyTimer = setTimeout(() => {
    if (currentSearch === searchState) {
      staleBestmovesPending++;
      if (wedgedWorkerTimer) clearTimeout(wedgedWorkerTimer);
      wedgedWorkerTimer = setTimeout(() => {
        if (staleBestmovesPending > 0) {
          console.warn("⚠️ [Stockfish] Воркер завис окончательно, перезапускаем...");
          const hungWorker = stockfish;
          stockfish = null;
          isReady = false;
          isUciOk = false;
          staleBestmovesPending = 0;
          wedgedWorkerTimer = null;
          destroyWorker(hungWorker);
          if (nextSearch) {
            initStockfish();
            if (!stockfish && nextSearch) {
              const pending = nextSearch;
              nextSearch = null;
              pending.resolve({ ...ERROR_SEARCH_RESULT });
            }
          }
        }
      }, 2500);

      const moves = buildMovesResult(null);
      const ponderMove = moves[0]?.ponder || null;
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

function startSearch(fen, options, resolve) {
  if (!stockfish || !isReady) {
    if (nextSearch) {
      nextSearch.resolve({ ...CANCELLED_SEARCH_RESULT });
    }
    nextSearch = { fen, options, resolve };
    initStockfish();
    return;
  }

  isSearching = true;
  completedDepth = 0;
  completedCandidates = [];
  activeDepth = 0;
  activeDepthCandidates = [];
  moveInfoMap = new Map();

  const movetime = options.movetime || null;
  const depth = options.depth || null;
  const requestedPV = Math.max(1, Math.min(5, options.multiPV || desiredMultiPV));
  desiredMultiPV = requestedPV;

  if (requestedPV !== currentMultiPV) {
    currentMultiPV = requestedPV;
    stockfish.postMessage(`setoption name MultiPV value ${currentMultiPV}`);
  }

  const waitLimit = movetime
    ? Math.max(4500, movetime + 4000)
    : (depth ? Math.max(12000, depth * 800) : 15000);

  const searchState = {
    fen,
    options,
    resolve,
    timer: null,
    emergencyTimer: null,
    stopSent: false,
    cancelled: false
  };

  searchState.timer = setTimeout(() => {
    if (currentSearch === searchState && !searchState.stopSent) {
      console.warn("⚠️ [Stockfish] Лимит ожидания, отправляем stop:", fen);
      searchState.stopSent = true;
      if (stockfish) {
        stockfish.postMessage("stop");
      }
      scheduleEmergencyReset(searchState);
    }
  }, waitLimit);

  currentSearch = searchState;

  const hasHistoryMoves =
    typeof options.uciBaseFen === "string" &&
    options.uciBaseFen.trim() &&
    Array.isArray(options.uciMoves) &&
    options.uciMoves.length > 0;

  if (hasHistoryMoves) {
    stockfish.postMessage(`position fen ${options.uciBaseFen.trim()} moves ${options.uciMoves.join(" ")}`);
  } else {
    stockfish.postMessage(`position fen ${fen}`);
  }
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
    if (currentSearch.emergencyTimer) {
      clearTimeout(currentSearch.emergencyTimer);
    }
    const cb = currentSearch.resolve;
    const wasCancelled = currentSearch.cancelled;
    currentSearch = null;
    isSearching = false;
    if (cb) {
      cb(wasCancelled ? { ...CANCELLED_SEARCH_RESULT } : result);
    }
  } else {
    isSearching = false;
  }

  // Запускаем самую свежую позицию из очереди, если она ждёт и движок свободен от старых хвостов
  if (nextSearch && stockfish && isReady && staleBestmovesPending === 0) {
    const next = nextSearch;
    nextSearch = null;
    startSearch(next.fen, next.options, next.resolve);
  }
}

function calculateMove(fen, options = {}) {
  return new Promise((resolve) => {
    if (typeof fen !== "string" || !fen.trim()) {
      resolve({ ...EMPTY_SEARCH_RESULT });
      return;
    }

    initStockfish();

    if (!stockfish) {
      resolve({ ...ERROR_SEARCH_RESULT });
      return;
    }

    if (!isReady || staleBestmovesPending > 0) {
      if (nextSearch) {
        nextSearch.resolve({ ...CANCELLED_SEARCH_RESULT });
      }
      nextSearch = { fen, options, resolve };
      return;
    }

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
      scheduleEmergencyReset(currentSearch);
    }

    if (nextSearch) {
      nextSearch.resolve({ ...CANCELLED_SEARCH_RESULT });
    }
    nextSearch = { fen, options, resolve };
  });
}

// Связь через sendMessage
extApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || typeof request !== "object") return false;

  if (request.type === "ANALYZE_POSITION") {
    calculateMove(request.fen, {
      uciBaseFen: request.uciBaseFen || null,
      uciMoves: Array.isArray(request.uciMoves) ? request.uciMoves : null,
      depth: request.depth,
      movetime: request.movetime,
      multiPV: request.multiPV
    }).then((res) => {
      try {
        sendResponse(res);
      } catch (_) {}
    });
    return true;
  }

  if (request.type === "SET_MULTIPV") {
    const pv = Math.max(1, Math.min(5, request.multiPV || (IS_MOBILE_BUILD ? 1 : 3)));
    desiredMultiPV = pv;
    initStockfish();
    if (stockfish && isReady && !isSearching && staleBestmovesPending === 0 && pv !== currentMultiPV) {
      currentMultiPV = pv;
      stockfish.postMessage(`setoption name MultiPV value ${currentMultiPV}`);
    }
    try {
      sendResponse({ ok: true, multiPV: pv });
    } catch (_) {}
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
