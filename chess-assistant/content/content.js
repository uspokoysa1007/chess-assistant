// content.js - Шахматный Помощник (Chess.com & Lichess Edition)
// Поддержка MultiPV (3 и 5 стрелок), фоновый премув, адаптеры платформ, SVG в Base64

const extApi = typeof browser !== "undefined" ? browser : chrome;
console.log("♟️ [Content Script] Шахматный Помощник загружен (Chess.com & Lichess)!");

let boardObserver = null;
let currentObservedBoard = null;
let isAutoHintEnabled = true;
let isOnlyMyTurnEnabled = true;
let isMinimized = false;
let isUserInteractingWithBoard = false;
let debounceTimer = null;
let lastAnalyzedFEN = "";
let lastBoardFlipped = null;
let hasOverlayDrawings = false;
let lastRenderedState = null;

// Язык интерфейса (RU / EN)
let currentLang = localStorage.getItem("chess_lang") || (navigator.language && navigator.language.startsWith("ru") ? "ru" : "en");

const TRANSLATIONS = {
  ru: {
    title: "Stockfish 19",
    titlePhone: "Stockfish 19 Lite WASM",
    settingsTitle: "Настройки",
    langLabel: "Язык / Language:",
    arrowModeLabel: "Режим стрелок:",
    arrowMode1: "1 стрелка (только лучший ход)",
    arrowMode3: "3 стрелки (чёрная / серая / белая)",
    arrowMode5: "5 стрелок с бейджами (MultiPV 5)",
    markerStyleLabel: "Стиль меток:",
    markerSquare: "Квадрат",
    markerCircle: "Круг",
    markerNone: "Только стрелка",
    evalLabel: "Оценка:",
    equalPos: "Равная позиция",
    almostEqualPos: "Примерно равная позиция",
    advantageWhite: "Преимущество белых",
    advantageBlack: "Преимущество чёрных",
    inYourFavor: "(в твою пользу)",
    opponentAdvantage: "(в пользу соперника)",
    bulletName: "Пуля (150мс)",
    blitzName: "Блиц (~0.5с)",
    rapidName: "Рапид",
    ultraName: "Ультра (7с / 26х)",
    bulletNamePhone: "Пуля (50мс)",
    blitzNamePhone: "Блиц (100мс)",
    rapidNamePhone: "Рапид (150мс)",
    autoHintsLabel: "Стрелки после каждого хода",
    myTurnOnlyLabel: "Только мой ход",
    refreshBtn: "Обновить",
    disableBtn: "Отключить",
    enableBtn: "Включить",
    readyMsg: "Готов. Сделай ход или нажми кнопку.",
    boardNotFound: "Доска не найдена. Открой партию.",
    boardNotFoundWarn: "Шахматная доска не найдена.",
    oppTurnWait: "Ход соперника...",
    oppTurnPremove: "Ход соперника... считаю премув",
    premoveLabel: "Премув:",
    premoveOnOpp: "на",
    noMovesMsg: "Ходы не найдены или партия завершена.",
    refreshingMsg: "Пересчёт позиции...",
    hintsDisabledMsg: "Подсказки отключены.",
    hintsEnabledMsg: "Подсказки включены.",
    switchedTo: "Переключено на",
    searchingTurn: "ищет ход",
    ultraThinking: "Ультра: расчёт до 26 ходов",
    whiteGen: "белых",
    blackGen: "чёрных",
    label1st: "1-й",
    label2nd: "2-й",
    label3rd: "3-й",
    bestMovePhone: "Лучший ход:",
    amateurModeLabel: "Легит-режим (80–85%):",
    amateurModeOn: "🟢 Легит включён",
    amateurModeOff: "⚪ Включить Легит"
  },
  en: {
    title: "Stockfish 19",
    titlePhone: "Stockfish 19 Lite WASM",
    settingsTitle: "Settings",
    langLabel: "Language / Язык:",
    arrowModeLabel: "Arrow mode:",
    arrowMode1: "1 arrow (best move only)",
    arrowMode3: "3 arrows (black / gray / white)",
    arrowMode5: "5 arrows with badges (MultiPV 5)",
    markerStyleLabel: "Marker style:",
    markerSquare: "Square",
    markerCircle: "Circle",
    markerNone: "Arrow only",
    evalLabel: "Eval:",
    equalPos: "Equal position",
    almostEqualPos: "Roughly equal position",
    advantageWhite: "White is winning",
    advantageBlack: "Black is winning",
    inYourFavor: "(in your favor)",
    opponentAdvantage: "(opponent advantage)",
    bulletName: "Bullet (150ms)",
    blitzName: "Blitz (~0.5s)",
    rapidName: "Rapid",
    ultraName: "Ultra (7s / 26d)",
    bulletNamePhone: "Bullet (50ms)",
    blitzNamePhone: "Blitz (100ms)",
    rapidNamePhone: "Rapid (150ms)",
    autoHintsLabel: "Arrows after each move",
    myTurnOnlyLabel: "My turn only",
    refreshBtn: "Refresh",
    disableBtn: "Disable",
    enableBtn: "Enable",
    readyMsg: "Ready. Make a move or click a button.",
    boardNotFound: "Board not found. Open a game.",
    boardNotFoundWarn: "Chessboard not found.",
    oppTurnWait: "Opponent's turn...",
    oppTurnPremove: "Opponent's turn... calculating premove",
    premoveLabel: "Premove:",
    premoveOnOpp: "against",
    noMovesMsg: "No moves found or game over.",
    refreshingMsg: "Recalculating position...",
    hintsDisabledMsg: "Hints disabled.",
    hintsEnabledMsg: "Hints enabled.",
    switchedTo: "Switched to",
    searchingTurn: "calculating move for",
    ultraThinking: "Ultra: deep search up to 26 moves",
    whiteGen: "White",
    blackGen: "Black",
    label1st: "1st",
    label2nd: "2nd",
    label3rd: "3rd",
    bestMovePhone: "Best move:",
    amateurModeLabel: "Legit mode (80–85%):",
    amateurModeOn: "🟢 Legit enabled",
    amateurModeOff: "⚪ Enable Legit"
  }
};

function t(key) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.ru[key] || key;
}

function setLanguage(lang) {
  if (lang !== "ru" && lang !== "en") return;
  currentLang = lang;
  localStorage.setItem("chess_lang", currentLang);

  const widget = document.getElementById("chess-assistant-widget");
  const wasSettingsOpen = document.getElementById("chess-settings-panel")?.style.display !== "none";
  if (widget) {
    widget.remove();
    createWidget();
    if (wasSettingsOpen) {
      const panel = document.getElementById("chess-settings-panel");
      if (panel) panel.style.display = "block";
    }
    if (lastRenderedState) {
      drawAllVisuals(lastRenderedState);
    }
  }
}

// Настройки режимов (сохраняются в localStorage)
let arrowMode = localStorage.getItem("chess_arrow_mode") || "multi3"; // "multi1" | "multi3" | "multi5"
let markerShape = localStorage.getItem("chess_marker_shape") || "square"; // "square" | "circle" | "none"
let speedMode = localStorage.getItem("chess_speed_mode") || "bullet"; // "bullet" | "blitz" | "rapid" | "ultra"

// ==========================================
// МОДУЛЬ «ЛЮБИТЕЛЬ» (Accuracy 80–85%)
// ==========================================
// Имитирует игру уровня CM/любителя: Stockfish иногда
// намеренно выбирает не лучший ход, как живой игрок.
let amateurModeEnabled = localStorage.getItem("chess_amateur_mode") === "true";

const AMATEUR_CONFIG = {
  // Вероятность сыграть ЛУЧШИЙ ход (остальное — случайный субоптимальный)
  bestMoveProb: 0.72,
  // Максимальный допустимый «ляп» в сантипешках (больше — не выбираем)
  maxBlunderCp: 150,
  // При мате или угрозе мата — всегда лучший ход
  forceBestOnMate: true,
  // Пониженная глубина (уровень сильного любителя ~1700–1900 ELO)
  depth: 11,
  // Задержка «раздумья» перед показом стрелки (мс): [min, max]
  delayMs: [2000, 3000],
};

/**
 * Выбирает ход в стиле любителя (точность ~80–85%).
 * @param {Array} moves — массив {move, score} от Stockfish (по убыванию качества: [0] = лучший)
 * @returns {{move, score}} — выбранный ход
 */
function amateurPickMove(moves) {
  if (!moves || moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const best = moves[0];

  // Всегда играем лучший ход при мате или угрозе мата
  if (AMATEUR_CONFIG.forceBestOnMate) {
    if (best.score?.type === "mate") return best;
    // Если у лучшего хода огромный перевес (> 8 пешек) — позиция решена, не блундерим
    if (best.score?.type === "cp" && Math.abs(best.score.value) > 800) return best;
  }

  // Бросаем монетку: играем лучший ход или нет?
  const roll = Math.random();
  if (roll < AMATEUR_CONFIG.bestMoveProb) return best;

  // Собираем «безопасные» субоптимальные ходы (не слишком плохие)
  const bestCp = best.score?.type === "cp" ? best.score.value : 0;
  const candidates = moves.slice(1).filter((m) => {
    if (!m.score) return true;
    if (m.score.type === "mate" && m.score.value < 0) return false; // ход ведёт к мату — исключаем
    if (m.score.type === "cp") {
      const diff = Math.abs(bestCp - m.score.value);
      return diff <= AMATEUR_CONFIG.maxBlunderCp;
    }
    return true;
  });

  if (candidates.length === 0) return best; // нет безопасных альтернатив — лучший ход

  // Взвешенный выбор: второй ход выбирается чаще, чем третий
  const weights = candidates.map((_, i) => 1 / (i + 1.5));
  const totalW = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalW;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Определение платформы: авто по location.hostname с сохранением в localStorage
function detectInitialPlatform() {
  const saved = localStorage.getItem("chess_platform");
  if (saved === "chesscom" || saved === "lichess") return saved;
  return location.hostname.includes("lichess.org") ? "lichess" : "chesscom";
}
let currentPlatform = detectInitialPlatform();

const MULTI3_COLORS = ["#000000", "#808080", "#ffffff"];
const MULTI5_COLOR = "#000000";
const PREMOVE_COLOR = "#22c55e";

const SPEED_MODES = {
  bullet: { name: "⚡ Пуля", movetime: 150, depth: null, debounce: 50, label: "⚡ Пуля (150мс)" },
  blitz:  { name: "🎯 Блиц", movetime: 500, depth: 11, debounce: 150, label: "🎯 Блиц (~0.5с)" },
  rapid:  { name: "🧠 Рапид", movetime: null, depth: 14, debounce: 300, label: "🧠 Рапид" },
  ultra:  { name: "👑 Ультра (7с)", movetime: 7000, depth: 26, debounce: 300, label: "👑 Ультра (7с • 26х)" }
};

// ==========================================
// 1. АДАПТЕРЫ ПЛАТФОРМ (Chess.com & Lichess)
// ==========================================

let gameTracking = {
  whiteKingMoved: false,
  blackKingMoved: false,
  whiteRookA1Moved: false,
  whiteRookH1Moved: false,
  blackRookA8Moved: false,
  blackRookH8Moved: false
};

function resetGameTracking() {
  gameTracking = {
    whiteKingMoved: false,
    blackKingMoved: false,
    whiteRookA1Moved: false,
    whiteRookH1Moved: false,
    blackRookA8Moved: false,
    blackRookH8Moved: false
  };
}

const Adapters = {
  chesscom: {
    name: "Chess.com",
    getBoardElement() {
      return document.querySelector("wc-chess-board") ||
             document.querySelector("chess-board") ||
             document.querySelector(".board-layout-chessboard") ||
             document.querySelector(".board") ||
             document.querySelector("#board-single") ||
             document.querySelector(".board-component");
    },
    isBoardFlipped(board) {
      if (!board) return false;
      return board.classList.contains("flipped");
    },
    isDragging(board) {
      const b = board || this.getBoardElement();
      if (!b) return false;
      return !!(
        b.querySelector(".piece.dragging, .dragging") ||
        document.querySelector("wc-chess-board .dragging, chess-board .dragging, .board .dragging")
      );
    },
    isSelecting(board) {
      const b = board || this.getBoardElement();
      if (!b) return false;
      return !!(
        b.querySelector(".hint, .square-selected, .highlight.selected") ||
        document.querySelector("wc-chess-board .hint, chess-board .hint, .board .hint")
      );
    },
    isInteracting(board) {
      return isUserInteractingWithBoard || this.isDragging(board) || this.isSelecting(board);
    },
    detectTurn(board) {
      const isFlipped = this.isBoardFlipped(board);

      // 1. Проверяем часы с активным ходом на Chess.com
      const blackClockRunning = document.querySelector(
        ".clock-component.clock-black.clock-player-turn, .clock-component.clock-black.clock-running, .clock-black.clock-player-turn, .clock-black.clock-running, .player-component.black.player-turn, .player-tagline.black.turn"
      );
      if (blackClockRunning) return "b";

      const whiteClockRunning = document.querySelector(
        ".clock-component.clock-white.clock-player-turn, .clock-component.clock-white.clock-running, .clock-white.clock-player-turn, .clock-white.clock-running, .player-component.white.player-turn, .player-tagline.white.turn"
      );
      if (whiteClockRunning) return "w";

      const turnClock = document.querySelector(".clock-component.clock-player-turn, .clock-player-turn, .player-component.player-turn");
      if (turnClock) {
        if (turnClock.classList.contains("clock-black") || turnClock.classList.contains("black")) return "b";
        if (turnClock.classList.contains("clock-white") || turnClock.classList.contains("white")) return "w";
        if (turnClock.classList.contains("clock-top")) return isFlipped ? "w" : "b";
        if (turnClock.classList.contains("clock-bottom")) return isFlipped ? "b" : "w";
      }

      // 2. Список ходов (самый надёжный счётчик на Chess.com)
      const moveNodes = document.querySelectorAll(
        "wc-vertical-move-list .node, .vertical-move-list .node, .move-list-wrapper .node, .move-node, .move-text-component"
      );
      if (moveNodes.length > 0) {
        return moveNodes.length % 2 === 1 ? "b" : "w";
      }

      // 3. Если часов и списка ходов нет: проверяем 2 подсветки последнего завершённого хода.
      // ВАЖНО: проверяем только если игрок НЕ выбирает и НЕ тащит фигуру!
      if (board && !this.isInteracting(board)) {
        const highlights = board.querySelectorAll(".highlight");
        if (highlights.length === 2) {
          for (const hl of highlights) {
            const hlClasses = Array.from(hl.classList);
            const sqClass = hlClasses.find((c) => c.startsWith("square-"));
            if (sqClass) {
              const piece = board.querySelector(`.piece.${sqClass}:not(.dragging)`) || board.querySelector(`.piece.${sqClass}`);
              if (piece) {
                const pieceClasses = Array.from(piece.classList);
                const typeClass = pieceClasses.find((c) => c.length === 2 && (c[0] === "w" || c[0] === "b"));
                if (typeClass) {
                  return typeClass[0] === "w" ? "b" : "w";
                }
              }
            }
          }
        }
      }

      return "w";
    },
    getCastlingAndEnPassant(board, grid) {
      const moveNodes = document.querySelectorAll(
        "wc-vertical-move-list .node, .vertical-move-list .node, .move-list-wrapper .node, .move-node"
      );
      if (moveNodes.length === 0) resetGameTracking();

      if (!this.isDragging(board)) {
        if (grid[0][4] !== "wk") gameTracking.whiteKingMoved = true;
        if (grid[0][0] !== "wr") gameTracking.whiteRookA1Moved = true;
        if (grid[0][7] !== "wr") gameTracking.whiteRookH1Moved = true;

        if (grid[7][4] !== "bk") gameTracking.blackKingMoved = true;
        if (grid[7][0] !== "br") gameTracking.blackRookA8Moved = true;
        if (grid[7][7] !== "br") gameTracking.blackRookH8Moved = true;
      }

      moveNodes.forEach((node, idx) => {
        const isWhite = idx % 2 === 0;
        const text = (node.textContent || "").trim();
        const html = node.innerHTML || "";
        const isKing = html.includes('figurine="K"') || html.includes("king") || /^(K|Кр|O-O|0-0)/i.test(text) || text.includes("O-O") || text.includes("0-0");
        if (isKing) {
          if (isWhite) gameTracking.whiteKingMoved = true;
          else gameTracking.blackKingMoved = true;
        }
        const isRook = html.includes('figurine="R"') || html.includes("rook") || /^(R|Л)/i.test(text);
        if (isRook) {
          if (isWhite) {
            if (/^(R|Л)a/i.test(text) || text.includes("a1")) gameTracking.whiteRookA1Moved = true;
            if (/^(R|Л)h/i.test(text) || text.includes("h1")) gameTracking.whiteRookH1Moved = true;
          } else {
            if (/^(R|Л)a/i.test(text) || text.includes("a8")) gameTracking.blackRookA8Moved = true;
            if (/^(R|Л)h/i.test(text) || text.includes("h8")) gameTracking.blackRookH8Moved = true;
          }
        }
      });

      let rights = "";
      if (grid[0][4] === "wk" && !gameTracking.whiteKingMoved) {
        if (grid[0][7] === "wr" && !gameTracking.whiteRookH1Moved) rights += "K";
        if (grid[0][0] === "wr" && !gameTracking.whiteRookA1Moved) rights += "Q";
      }
      if (grid[7][4] === "bk" && !gameTracking.blackKingMoved) {
        if (grid[7][7] === "br" && !gameTracking.blackRookH8Moved) rights += "k";
        if (grid[7][0] === "br" && !gameTracking.blackRookA8Moved) rights += "q";
      }
      if (rights === "") rights = "-";

      let enPassant = "-";
      const highlights = board.querySelectorAll(".highlight");
      if (highlights.length >= 2) {
        const sqs = [];
        highlights.forEach((hl) => {
          const cl = Array.from(hl.classList).find((c) => c.startsWith("square-"));
          if (cl) {
            const cr = cl.replace("square-", "");
            sqs.push({ col: parseInt(cr[0]) - 1, row: parseInt(cr[1]) - 1 });
          }
        });
        if (sqs.length === 2) {
          const colLetters = ["a", "b", "c", "d", "e", "f", "g", "h"];
          for (const s of sqs) {
            const p = grid[s.row][s.col];
            if (p === "wp" && s.row === 3) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 1);
              if (fromSq) enPassant = `${colLetters[s.col]}3`;
            } else if (p === "bp" && s.row === 4) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 6);
              if (fromSq) enPassant = `${colLetters[s.col]}6`;
            }
          }
        }
      }
      return { rights, enPassant };
    },
    parseBoardToFEN(board) {
      const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
      const pieces = board.querySelectorAll(".piece");
      pieces.forEach((p) => {
        const classes = Array.from(p.classList);
        const typeClass = classes.find((c) => c.length === 2 && (c[0] === "w" || c[0] === "b"));
        const squareClass = classes.find((c) => c.startsWith("square-"));
        if (typeClass && squareClass) {
          const coords = squareClass.replace("square-", "");
          const col = parseInt(coords[0]) - 1;
          const row = parseInt(coords[1]) - 1;
          if (col >= 0 && col < 8 && row >= 0 && row < 8) {
            grid[row][col] = typeClass;
          }
        }
      });
      const pieceMap = {
        wp: "P", wn: "N", wb: "B", wr: "R", wq: "Q", wk: "K",
        bp: "p", bn: "n", bb: "b", br: "r", bq: "q", bk: "k"
      };
      const ranks = [];
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        let rankStr = "";
        for (let c = 0; c < 8; c++) {
          const piece = grid[r][c];
          if (!piece) empty++;
          else {
            if (empty > 0) { rankStr += empty; empty = 0; }
            rankStr += pieceMap[piece] || "";
          }
        }
        if (empty > 0) rankStr += empty;
        ranks.push(rankStr);
      }
      const fenRanks = ranks.join("/");
      if (!fenRanks.includes("K") || !fenRanks.includes("k")) {
        return "";
      }
      const activeTurn = this.detectTurn(board);
      const { rights, enPassant } = this.getCastlingAndEnPassant(board, grid);
      return `${fenRanks} ${activeTurn} ${rights} ${enPassant} 0 1`;
    }
  },

  lichess: {
    name: "Lichess",
    getBoardElement() {
      return document.querySelector(".round__app cg-board, .main-board cg-board, .analyse__app cg-board, .puzzle-app cg-board, cg-board") ||
             document.querySelector(".cg-wrap") ||
             document.querySelector("main.round cg-board");
    },
    isBoardFlipped(board) {
      const wrap = board ? (board.closest(".cg-wrap") || board) : document.querySelector(".cg-wrap");
      return wrap ? wrap.classList.contains("orientation-black") : false;
    },
    isDragging(board) {
      const b = board || this.getBoardElement();
      if (!b) return false;
      const wrap = b.closest(".cg-wrap") || b;
      return !!(
        wrap.querySelector("piece.dragging") ||
        wrap.classList.contains("dragging") ||
        document.body.classList.contains("dragging")
      );
    },
    isSelecting(board) {
      const b = board || this.getBoardElement();
      if (!b) return false;
      const wrap = b.closest(".cg-wrap") || b;
      return !!(
        wrap.querySelector("square.selected, square.move-dest") ||
        document.querySelector("cg-board square.selected, cg-board square.move-dest")
      );
    },
    isInteracting(board) {
      return isUserInteractingWithBoard || this.isDragging(board) || this.isSelecting(board);
    },
    detectTurn(board) {
      const isFlipped = this.isBoardFlipped(board);
      if (document.querySelector(".rclock-bottom.running, .rclock.white.running")) {
        return isFlipped ? "b" : "w";
      }
      if (document.querySelector(".rclock-top.running, .rclock.black.running")) {
        return isFlipped ? "w" : "b";
      }
      const moves = document.querySelectorAll("l4x m2, .moves move, .analyse__moves move, .tview2 move, m2");
      if (moves.length > 0) {
        return moves.length % 2 === 1 ? "b" : "w";
      }
      if (!this.isInteracting(board)) {
        const lastMoves = (board || document).querySelectorAll("square.last-move");
        if (lastMoves.length === 2) {
          for (const sq of lastMoves) {
            const sqRect = sq.getBoundingClientRect();
            const piece = Array.from((board || document).querySelectorAll("piece:not(.dragging)")).find((p) => {
              const pr = p.getBoundingClientRect();
              return Math.abs(pr.left - sqRect.left) < 6 && Math.abs(pr.top - sqRect.top) < 6;
            });
            if (piece) {
              if (piece.classList.contains("white")) return "b";
              if (piece.classList.contains("black")) return "w";
            }
          }
        }
      }
      return "w";
    },
    getCastlingAndEnPassant(board, grid) {
      const moveNodes = document.querySelectorAll("l4x m2, .moves move, .analyse__moves move, .tview2 move, m2");
      if (moveNodes.length === 0) resetGameTracking();

      if (!this.isDragging(board)) {
        if (grid[0][4] !== "K") gameTracking.whiteKingMoved = true;
        if (grid[0][0] !== "R") gameTracking.whiteRookA1Moved = true;
        if (grid[0][7] !== "R") gameTracking.whiteRookH1Moved = true;

        if (grid[7][4] !== "k") gameTracking.blackKingMoved = true;
        if (grid[7][0] !== "r") gameTracking.blackRookA8Moved = true;
        if (grid[7][7] !== "r") gameTracking.blackRookH8Moved = true;
      }

      moveNodes.forEach((node, idx) => {
        const isWhite = idx % 2 === 0;
        const text = (node.textContent || "").trim();
        if (/^(K|O-O|0-0)/.test(text) || text.includes("O-O") || text.includes("0-0")) {
          if (isWhite) gameTracking.whiteKingMoved = true;
          else gameTracking.blackKingMoved = true;
        }
        if (/^R/.test(text)) {
          if (isWhite) {
            if (/^Ra/i.test(text) || text.includes("a1")) gameTracking.whiteRookA1Moved = true;
            if (/^Rh/i.test(text) || text.includes("h1")) gameTracking.whiteRookH1Moved = true;
          } else {
            if (/^Ra/i.test(text) || text.includes("a8")) gameTracking.blackRookA8Moved = true;
            if (/^Rh/i.test(text) || text.includes("h8")) gameTracking.blackRookH8Moved = true;
          }
        }
      });

      let rights = "";
      if (grid[0][4] === "K" && !gameTracking.whiteKingMoved) {
        if (grid[0][7] === "R" && !gameTracking.whiteRookH1Moved) rights += "K";
        if (grid[0][0] === "R" && !gameTracking.whiteRookA1Moved) rights += "Q";
      }
      if (grid[7][4] === "k" && !gameTracking.blackKingMoved) {
        if (grid[7][7] === "r" && !gameTracking.blackRookH8Moved) rights += "k";
        if (grid[7][0] === "r" && !gameTracking.blackRookA8Moved) rights += "q";
      }
      if (rights === "") rights = "-";

      let enPassant = "-";
      const lastMoves = (board || document).querySelectorAll("square.last-move");
      if (lastMoves.length >= 2) {
        const bRect = board.getBoundingClientRect();
        const sqW = bRect.width / 8;
        const sqH = bRect.height / 8;
        const isFlipped = this.isBoardFlipped(board);
        const sqs = [];
        lastMoves.forEach((sq) => {
          const sRect = sq.getBoundingClientRect();
          const relX = sRect.left - bRect.left + sRect.width / 2;
          const relY = sRect.top - bRect.top + sRect.height / 2;
          const col = Math.floor(relX / sqW);
          const rankIndex = Math.floor(relY / sqH);
          if (col >= 0 && col < 8 && rankIndex >= 0 && rankIndex < 8) {
            const file = isFlipped ? 7 - col : col;
            const row = isFlipped ? rankIndex : 7 - rankIndex;
            sqs.push({ col: file, row });
          }
        });
        if (sqs.length === 2) {
          const colLetters = ["a", "b", "c", "d", "e", "f", "g", "h"];
          for (const s of sqs) {
            const p = grid[s.row][s.col];
            if (p === "P" && s.row === 3) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 1);
              if (fromSq) enPassant = `${colLetters[s.col]}3`;
            } else if (p === "p" && s.row === 4) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 6);
              if (fromSq) enPassant = `${colLetters[s.col]}6`;
            }
          }
        }
      }
      return { rights, enPassant };
    },
    parseBoardToFEN(board) {
      const bRect = board.getBoundingClientRect();
      if (!bRect.width || !bRect.height) return "";
      const sqW = bRect.width / 8;
      const sqH = bRect.height / 8;
      const isFlipped = this.isBoardFlipped(board);
      const grid = Array.from({ length: 8 }, () => Array(8).fill(null));

      function getPieceType(el) {
        const cl = el.classList;
        const isW = cl.contains("white");
        const isB = cl.contains("black");
        if (!isW && !isB) return null;
        let r = null;
        if (cl.contains("pawn")) r = "p";
        else if (cl.contains("knight")) r = "n";
        else if (cl.contains("bishop")) r = "b";
        else if (cl.contains("rook")) r = "r";
        else if (cl.contains("queen")) r = "q";
        else if (cl.contains("king")) r = "k";
        if (!r) return null;
        return isW ? r.toUpperCase() : r.toLowerCase();
      }

      const hasDragging = !!board.querySelector("piece.dragging");
      const pieces = board.querySelectorAll(hasDragging ? "piece:not(.dragging)" : "piece:not(.ghost)");
      pieces.forEach((p) => {
        if (p.classList.contains("dragging")) return;
        const pType = getPieceType(p);
        if (!pType) return;
        const pr = p.getBoundingClientRect();
        const relX = pr.left - bRect.left + pr.width / 2;
        const relY = pr.top - bRect.top + pr.height / 2;
        const col = Math.floor(relX / sqW);
        const rankIndex = Math.floor(relY / sqH);
        if (col < 0 || col > 7 || rankIndex < 0 || rankIndex > 7) return;
        const file = isFlipped ? 7 - col : col;
        const row = isFlipped ? rankIndex : 7 - rankIndex;
        grid[row][file] = pType;
      });

      const ranks = [];
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        let rankStr = "";
        for (let c = 0; c < 8; c++) {
          const piece = grid[r][c];
          if (!piece) empty++;
          else {
            if (empty > 0) { rankStr += empty; empty = 0; }
            rankStr += piece;
          }
        }
        if (empty > 0) rankStr += empty;
        ranks.push(rankStr);
      }

      const fenRanks = ranks.join("/");
      if (!fenRanks.includes("K") || !fenRanks.includes("k")) {
        return "";
      }
      const activeTurn = this.detectTurn(board);
      const { rights, enPassant } = this.getCastlingAndEnPassant(board, grid);
      return `${fenRanks} ${activeTurn} ${rights} ${enPassant} 0 1`;
    }
  }
};

function getAdapter() {
  return Adapters[currentPlatform] || Adapters.chesscom;
}
function getBoardElement() {
  return getAdapter().getBoardElement();
}
function isBoardFlipped(board) {
  return getAdapter().isBoardFlipped(board || getBoardElement());
}
function isDragging(board) {
  const adapter = getAdapter();
  return adapter.isDragging ? adapter.isDragging(board || getBoardElement()) : false;
}
function isInteractingWithBoard(board) {
  if (isUserInteractingWithBoard) return true;
  const adapter = getAdapter();
  if (adapter && adapter.isInteracting) return adapter.isInteracting(board || getBoardElement());
  return isDragging(board);
}
function detectTurn(board) {
  return getAdapter().detectTurn(board || getBoardElement());
}
function parseBoardToFEN(board) {
  return getAdapter().parseBoardToFEN(board || getBoardElement());
}

function setPlatform(platform) {
  if (platform !== "chesscom" && platform !== "lichess") return;
  currentPlatform = platform;
  localStorage.setItem("chess_platform", currentPlatform);

  const widget = document.getElementById("chess-assistant-widget");
  if (widget) {
    widget.querySelectorAll("[data-platform]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-platform") === currentPlatform);
    });
  }

  clearOverlay();
  lastAnalyzedFEN = "";
  lastBoardFlipped = null;
  currentObservedBoard = null;
  setupBoardObserver();
  requestBestMoves();

  const out = document.getElementById("chess-assistant-output");
  if (out) {
    out.innerText = `${t("switchedTo")} ${Adapters[currentPlatform].name}...`;
  }
}

// ==========================================
// 2. Связь с Background
// ==========================================
function requestMovesFromBackground(fen, cfg = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const payload = {
      type: "ANALYZE_POSITION",
      fen,
      depth: cfg.depth || null,
      movetime: cfg.movetime || null,
      multiPV: cfg.multiPV || (arrowMode === "multi5" ? 5 : (arrowMode === "multi1" ? 1 : 3))
    };

    extApi.runtime.sendMessage(payload, (res) => {
      if (!resolved) {
        resolved = true;
        resolve(res || { cancelled: false, moves: [], ponderMove: null, bestMove: null, bestScore: null });
      }
    });

    const timeoutWait = cfg.movetime ? Math.max(3000, cfg.movetime + 3500) : (cfg.depth ? Math.max(12000, cfg.depth * 800) : 16000);
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ cancelled: false, moves: [], ponderMove: null, bestMove: null, bestScore: null });
      }
    }, timeoutWait);
  });
}

function formatScore(score, matePrefix = "M") {
  if (!score) return "";
  if (score.type === "mate") {
    const sign = score.value < 0 ? "-" : (matePrefix === "#M" ? "" : "+");
    return `${sign}${matePrefix}${Math.abs(score.value)}`;
  }
  const val = score.value / 100;
  return (val > 0 ? "+" : "") + val.toFixed(1);
}

function getAdvantageText(score, activeTurn, isFlipped) {
  if (!score) return t("equalPos");
  let cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
  const whiteCp = activeTurn === "w" ? cp : -cp;
  const myColor = isFlipped ? "b" : "w";

  if (Math.abs(whiteCp) <= 25) {
    return t("almostEqualPos");
  }

  const leaderColor = whiteCp > 0 ? t("advantageWhite") : t("advantageBlack");
  const isMine = (myColor === "w" && whiteCp > 0) || (myColor === "b" && whiteCp < 0);
  const who = isMine ? t("inYourFavor") : t("opponentAdvantage");
  return `${leaderColor} ${who}`;
}

function updateEvalBar(score, activeTurn) {
  let cp = 0;
  if (score) {
    if (score.type === "mate") {
      cp = score.value > 0 ? 10000 : -10000;
    } else {
      cp = score.value;
    }
  }

  const whiteCp = activeTurn === "w" ? cp : -cp;
  let whitePercent = 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * whiteCp)) - 1);
  whitePercent = Math.max(4, Math.min(96, whitePercent));

  const board = getBoardElement();
  const isFlipped = board ? isBoardFlipped(board) : false;

  const widgetFill = document.querySelector(".widget-eval-fill");
  const widgetScore = document.querySelector(".widget-eval-score");
  const widgetDesc = document.querySelector(".widget-eval-desc");

  // Нормализуем оценку со стороны белых (общепринятый шахматный стандарт шкалы оценки)
  const normalizedScore = score ? {
    type: score.type,
    value: activeTurn === "w" ? score.value : -score.value
  } : null;
  const scoreText = formatScore(normalizedScore);
  const advText = getAdvantageText(score, activeTurn, isFlipped);

  if (widgetFill) widgetFill.style.width = `${whitePercent}%`;
  if (widgetScore) widgetScore.innerText = scoreText || "0.0";
  if (widgetDesc) widgetDesc.innerText = advText;
}

// ==========================================
// 3. Canvas и отрисовка стрелок
// ==========================================

function getOrCreateCanvas(board) {
  let canvas = document.getElementById("chess-canvas-overlay");
  if (!canvas || canvas.parentElement !== board) {
    if (canvas) canvas.remove();
    canvas = document.createElement("canvas");
    canvas.id = "chess-canvas-overlay";
    board.appendChild(canvas);
  }

  const rect = board.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const targetWidth = Math.round(rect.width * dpr);
  const targetHeight = Math.round(rect.height * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  return canvas;
}

function clearOverlay() {
  hasOverlayDrawings = false;
  const canvas = document.getElementById("chess-canvas-overlay");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function drawCornerBrackets(ctx, x, y, size, cornerLen, r, color, dpr) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 3 * dpr;
  ctx.lineWidth = 2.8 * dpr;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.arcTo(x, y, x + cornerLen, y, r);
  ctx.lineTo(x + cornerLen, y);

  ctx.moveTo(x + size - cornerLen, y);
  ctx.arcTo(x + size, y, x + size, y + cornerLen, r);
  ctx.lineTo(x + size, y + cornerLen);

  ctx.moveTo(x + size, y + size - cornerLen);
  ctx.arcTo(x + size, y + size, x + size - cornerLen, y + size, r);
  ctx.lineTo(x + size - cornerLen, y + size);

  ctx.moveTo(x + cornerLen, y + size);
  ctx.arcTo(x, y + size, x, y + size - cornerLen, r);
  ctx.lineTo(x, y + size - cornerLen);

  ctx.stroke();
  ctx.restore();
}

function drawCircleReticle(ctx, cx, cy, radius, color, dpr) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 3 * dpr;
  ctx.lineWidth = 2.5 * dpr;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawSquareMarker(ctx, sqBox, color, dpr) {
  if (markerShape === "none") return;
  if (markerShape === "circle") {
    drawCircleReticle(ctx, sqBox.x, sqBox.y, sqBox.boxSize * 0.44, color, dpr);
  } else {
    drawCornerBrackets(ctx, sqBox.boxX, sqBox.boxY, sqBox.boxSize, Math.round(sqBox.boxSize * 0.28), 5 * dpr, color, dpr);
  }
}

function getSquareBox(sq, squareSize, dpr, isFlipped) {
  const colNum = sq.charCodeAt(0) - 96;
  const rowNum = parseInt(sq[1]);
  const col = isFlipped ? 9 - colNum : colNum;
  const row = isFlipped ? rowNum : 9 - rowNum;
  return {
    x: (col - 1) * squareSize + squareSize / 2,
    y: (row - 1) * squareSize + squareSize / 2,
    boxX: (col - 1) * squareSize + 4 * dpr,
    boxY: (row - 1) * squareSize + 4 * dpr,
    boxSize: squareSize - 8 * dpr
  };
}

function drawArrow(ctx, start, end, color, dpr) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = 15.5 * dpr;
  const lineWidth = 6.2 * dpr;

  const lineEndX = end.x - Math.cos(angle) * (headLength * 0.7);
  const lineEndY = end.y - Math.sin(angle) * (headLength * 0.7);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 3.5 * dpr;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = color === "#ffffff" ? "#000000" : "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();

  ctx.restore();
}

function drawBadge(ctx, end, score, color, dpr, badgePosition, extraY = 0) {
  const text = formatScore(score);
  if (!text) return;

  ctx.save();
  ctx.font = `bold ${Math.round(11 * dpr)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  const textMetrics = ctx.measureText(text);
  const paddingX = 5.5 * dpr;
  const paddingY = 2.5 * dpr;
  const badgeWidth = textMetrics.width + paddingX * 2;
  const badgeHeight = 16 * dpr;

  let badgeX = end.x - badgeWidth / 2;
  let badgeY = end.y - badgeHeight / 2;

  switch (badgePosition) {
    case "top-left":
      badgeX = end.x - badgeWidth - 4 * dpr;
      badgeY = end.y - badgeHeight - 4 * dpr;
      break;
    case "top-right":
      badgeX = end.x + 4 * dpr;
      badgeY = end.y - badgeHeight - 4 * dpr;
      break;
    case "top-center":
    default:
      badgeX = end.x - badgeWidth / 2;
      badgeY = end.y - badgeHeight - 8 * dpr + extraY;
      break;
  }

  const margin = 2 * dpr;
  const maxW = ctx.canvas.width;
  const maxH = ctx.canvas.height;
  badgeX = Math.max(margin, Math.min(badgeX, maxW - badgeWidth - margin));
  badgeY = Math.max(margin, Math.min(badgeY, maxH - badgeHeight - margin));

  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 5 * dpr);
  ctx.fillStyle = "rgba(10, 8, 16, 0.94)";
  ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = 4 * dpr;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = color === "#ffffff" ? "#e4e4e7" : color;
  ctx.lineWidth = 1.2 * dpr;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5 * dpr);

  ctx.restore();
}

function drawMulti5Badges(ctx, items, dpr) {
  ctx.save();
  const scoreFont = `bold ${Math.round(11 * dpr)}px ui-monospace, SFMono-Regular, monospace`;
  const digitFont = `900 ${Math.round(10.5 * dpr)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  const placedRects = [];
  const margin = 3 * dpr;
  const maxW = ctx.canvas.width;
  const maxH = ctx.canvas.height;
  const circleR = 7.5 * dpr;
  const circleDiam = circleR * 2;
  const padLeft = 3.5 * dpr;
  const gapAfterCircle = 4.5 * dpr;
  const padRight = 6.5 * dpr;
  const badgeH = 21 * dpr;

  const overlaps = (a, b) => !(
    a.x + a.w + margin <= b.x ||
    b.x + b.w + margin <= a.x ||
    a.y + a.h + margin <= b.y ||
    b.y + b.h + margin <= a.y
  );

  ctx.font = scoreFont;
  const badges = items.map((item) => {
    const scoreStr = formatScore(item.score, "#M");
    const rankStr = String(item.rankIndex + 1);
    const scoreWidth = scoreStr ? ctx.measureText(scoreStr).width : 0;
    const w = scoreStr ? padLeft + circleDiam + gapAfterCircle + scoreWidth + padRight : badgeH;
    const h = badgeH;

    const dx = item.start.x - item.end.x;
    const dy = item.start.y - item.end.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    const candidates = [
      [0, -21 * dpr],
      [ux * 19 * dpr, uy * 19 * dpr],
      [0, 14 * dpr],
      [-w * 0.6, -16 * dpr],
      [w * 0.6, -16 * dpr],
      [ux * 36 * dpr, uy * 36 * dpr],
      [0, -40 * dpr],
      [0, 32 * dpr]
    ];

    let chosen = null;
    for (const [ox, oy] of candidates) {
      const cx = Math.min(Math.max(2 * dpr, item.end.x - w / 2 + ox), maxW - w - 2 * dpr);
      const cy = Math.min(Math.max(2 * dpr, item.end.y - h / 2 + oy), maxH - h - 2 * dpr);
      const rect = { x: cx, y: cy, w, h };
      if (!placedRects.some((p) => overlaps(rect, p))) {
        chosen = rect;
        break;
      }
    }

    if (!chosen) {
      const fx = Math.min(Math.max(2 * dpr, item.end.x - w / 2), maxW - w - 2 * dpr);
      const fy = Math.min(Math.max(2 * dpr, item.end.y - h / 2 - 20 * dpr), maxH - h - 2 * dpr);
      chosen = { x: fx, y: fy, w, h };
    }

    placedRects.push(chosen);
    return { rect: chosen, rankStr, scoreStr, isBest: item.rankIndex === 0 };
  });

  for (let i = badges.length - 1; i >= 0; i--) {
    const b = badges[i];
    const centerY = b.rect.y + b.rect.h / 2;

    drawRoundedRect(ctx, b.rect.x, b.rect.y, b.rect.w, b.rect.h, b.rect.h / 2);
    ctx.fillStyle = b.isBest ? "#09090b" : "#18181b";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 4 * dpr;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = b.isBest ? "#ffffff" : "#71717a";
    ctx.lineWidth = (b.isBest ? 2.2 : 1.2) * dpr;
    ctx.stroke();

    const circleX = b.scoreStr ? b.rect.x + padLeft + circleR : b.rect.x + b.rect.w / 2;
    ctx.beginPath();
    ctx.arc(circleX, centerY, circleR, 0, Math.PI * 2);
    ctx.fillStyle = b.isBest ? "#ffffff" : "#d4d4d8";
    ctx.fill();

    ctx.font = digitFont;
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.rankStr, circleX, centerY + 0.6 * dpr);

    if (b.scoreStr) {
      ctx.font = scoreFont;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(b.scoreStr, b.rect.x + padLeft + circleDiam + gapAfterCircle, centerY + 0.5 * dpr);
    }
  }

  ctx.restore();
}

function drawAllVisuals({ moves = [], premoveMove = null } = {}) {
  lastRenderedState = { moves, premoveMove };

  const board = getBoardElement();
  if (!board) return;

  const canvas = getOrCreateCanvas(board);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const isFlipped = isBoardFlipped(board);
  const squareSize = canvas.width / 8;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const validMoves = (moves || []).filter((m) => m && m.move && m.move.length >= 4);
  const hasPremove = premoveMove && premoveMove.length >= 4;

  if (validMoves.length === 0 && !hasPremove) {
    hasOverlayDrawings = false;
    return;
  }

  hasOverlayDrawings = true;

  if (arrowMode === "multi5" && validMoves.length > 0) {
    const items = validMoves.slice(0, 5).map((m, idx) => ({
      start: getSquareBox(m.move.slice(0, 2), squareSize, dpr, isFlipped),
      end: getSquareBox(m.move.slice(2, 4), squareSize, dpr, isFlipped),
      score: m.score,
      rankIndex: idx
    }));

    for (let i = items.length - 1; i >= 0; i--) {
      drawSquareMarker(ctx, items[i].start, MULTI5_COLOR, dpr);
      drawSquareMarker(ctx, items[i].end, MULTI5_COLOR, dpr);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      drawArrow(ctx, items[i].start, items[i].end, MULTI5_COLOR, dpr);
    }

    if (hasPremove) {
      const pStart = getSquareBox(premoveMove.slice(0, 2), squareSize, dpr, isFlipped);
      const pEnd = getSquareBox(premoveMove.slice(2, 4), squareSize, dpr, isFlipped);
      drawSquareMarker(ctx, pStart, PREMOVE_COLOR, dpr);
      drawSquareMarker(ctx, pEnd, PREMOVE_COLOR, dpr);
      drawArrow(ctx, pStart, pEnd, PREMOVE_COLOR, dpr);
    }

    drawMulti5Badges(ctx, items, dpr);
    return;
  }

  // Режим: 1 стрелка (только лучший ход)
  if (arrowMode === "multi1" && validMoves.length > 0) {
    const best = validMoves[0];
    const start = getSquareBox(best.move.slice(0, 2), squareSize, dpr, isFlipped);
    const end = getSquareBox(best.move.slice(2, 4), squareSize, dpr, isFlipped);
    const arrowColor = "#000000";

    drawSquareMarker(ctx, start, arrowColor, dpr);
    drawSquareMarker(ctx, end, arrowColor, dpr);
    drawArrow(ctx, start, end, arrowColor, dpr);
    drawBadge(ctx, end, best.score, arrowColor, dpr, "top-center", 0);

    if (hasPremove) {
      const pStart = getSquareBox(premoveMove.slice(0, 2), squareSize, dpr, isFlipped);
      const pEnd = getSquareBox(premoveMove.slice(2, 4), squareSize, dpr, isFlipped);
      drawSquareMarker(ctx, pStart, PREMOVE_COLOR, dpr);
      drawSquareMarker(ctx, pEnd, PREMOVE_COLOR, dpr);
      drawArrow(ctx, pStart, pEnd, PREMOVE_COLOR, dpr);
    }
    return;
  }

  // Режим 1: 3 стрелки (чёрная / серая / белая)
  if (validMoves.length > 0) {
    const top3 = validMoves.slice(0, 3);
    const t1 = top3[0] ? top3[0].move.slice(2, 4) : "";
    const t2 = top3[1] ? top3[1].move.slice(2, 4) : "";
    const t3 = top3[2] ? top3[2].move.slice(2, 4) : "";

    const badgePositions = ["top-center", "top-center", "top-center"];
    const extraYs = [0, 0, 0];

    if (t1 && t2 && t3 && t1 === t2 && t1 === t3) {
      badgePositions[0] = "top-center"; extraYs[0] = 22 * dpr;
      badgePositions[1] = "top-left";
      badgePositions[2] = "top-right";
    } else {
      if (t1 && t2 && t1 === t2) { badgePositions[0] = "top-right"; badgePositions[1] = "top-left"; }
      if (t1 && t3 && t1 === t3) { badgePositions[0] = "top-right"; badgePositions[2] = "top-left"; }
      if (t2 && t3 && t2 === t3) { badgePositions[1] = "top-left";  badgePositions[2] = "top-right"; }
    }

    const items = top3.map((m, idx) => ({
      start: getSquareBox(m.move.slice(0, 2), squareSize, dpr, isFlipped),
      end: getSquareBox(m.move.slice(2, 4), squareSize, dpr, isFlipped),
      color: MULTI3_COLORS[idx] || "#ffffff",
      score: m.score,
      badgePos: badgePositions[idx],
      extraY: extraYs[idx]
    }));

    for (let i = items.length - 1; i >= 0; i--) {
      drawSquareMarker(ctx, items[i].start, items[i].color, dpr);
      drawSquareMarker(ctx, items[i].end, items[i].color, dpr);
    }
    for (let i = items.length - 1; i >= 0; i--) {
      drawArrow(ctx, items[i].start, items[i].end, items[i].color, dpr);
    }
    for (let i = items.length - 1; i >= 0; i--) {
      drawBadge(ctx, items[i].end, items[i].score, items[i].color, dpr, items[i].badgePos, items[i].extraY);
    }
  }

  if (hasPremove) {
    const pStart = getSquareBox(premoveMove.slice(0, 2), squareSize, dpr, isFlipped);
    const pEnd = getSquareBox(premoveMove.slice(2, 4), squareSize, dpr, isFlipped);
    drawSquareMarker(ctx, pStart, PREMOVE_COLOR, dpr);
    drawSquareMarker(ctx, pEnd, PREMOVE_COLOR, dpr);
    drawArrow(ctx, pStart, pEnd, PREMOVE_COLOR, dpr);
  }
}

// ==========================================
// 4. Поворот экрана и ресайз (Исправление бага!)
// ==========================================
function handleResizeOrOrientation() {
  const board = getBoardElement();
  if (board) {
    getOrCreateCanvas(board);
    if (lastRenderedState) {
      drawAllVisuals(lastRenderedState);
    }
  }
}
window.addEventListener("resize", handleResizeOrOrientation);
window.addEventListener("orientationchange", () => {
  setTimeout(handleResizeOrOrientation, 150);
});

// Глобальная поддержка перетаскивания (мышь + сенсор) без утечки слушателей
let startX = 0, startY = 0, startRight = 14, startBottom = 12;
let isWidgetDragging = false, hasWidgetDragged = false;

function onDragStart(clientX, clientY, target) {
  const widget = document.getElementById("chess-assistant-widget");
  if (!widget) return false;

  // Не начинаем перетаскивание при клике на интерактивные кнопки, ссылки, поля ввода и чекбоксы
  if (target && target.closest && target.closest("button, input, a, select, textarea, label, .btn-speed-pill, .btn-style-pill, .btn-platform-pill")) {
    return false;
  }

  // Если виджет свернут в кнопку — разрешено тащить за любую точку
  if (isMinimized) {
    startX = clientX;
    startY = clientY;
    const rect = widget.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    isWidgetDragging = true;
    hasWidgetDragged = false;
    return true;
  }

  // Если меню открыто:
  // Разрешаем тащить за ручку перетаскивания (.widget-drag-handle),
  // заголовок (.widget-header), шапку настроек (.settings-panel-header)
  // или верхнюю область виджета (первые 42px)
  const isHeader = target && target.closest && target.closest(".widget-header, .settings-panel-header, .widget-drag-handle");
  const rect = widget.getBoundingClientRect();
  const isTopZone = (clientY - rect.top < 42) &&
                    !(target && target.closest && target.closest("#chess-assistant-output, .chess-watermark, .platform-switch-row, .speed-modes-grid, .chess-controls-group"));

  if (isHeader || isTopZone) {
    startX = clientX;
    startY = clientY;
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    isWidgetDragging = true;
    hasWidgetDragged = false;
    return true;
  }

  return false;
}

function onDragMove(clientX, clientY) {
  if (!isWidgetDragging) return;
  const widget = document.getElementById("chess-assistant-widget");
  if (!widget) return;
  const dx = clientX - startX;
  const dy = clientY - startY;
  if (Math.hypot(dx, dy) > 4) {
    hasWidgetDragged = true;
    const maxRight = Math.max(0, window.innerWidth - widget.offsetWidth - 4);
    const maxBottom = Math.max(0, window.innerHeight - widget.offsetHeight - 4);
    const newRight = Math.max(4, Math.min(maxRight, startRight - dx));
    const newBottom = Math.max(4, Math.min(maxBottom, startBottom - dy));
    widget.style.right = `${newRight}px`;
    widget.style.bottom = `${newBottom}px`;
    widget.style.left = "auto";
    widget.style.top = "auto";
  }
}

function onDragEnd() {
  if (isWidgetDragging && hasWidgetDragged) {
    const widget = document.getElementById("chess-assistant-widget");
    if (widget) {
      try {
        localStorage.setItem("chess_widget_pos_r", widget.style.right);
        localStorage.setItem("chess_widget_pos_b", widget.style.bottom);
      } catch (err) {}
    }
  }
  isWidgetDragging = false;
}

window.addEventListener("mousemove", (e) => {
  if (isWidgetDragging) onDragMove(e.clientX, e.clientY);
});
window.addEventListener("mouseup", () => {
  if (isWidgetDragging) onDragEnd();
});
window.addEventListener("touchmove", (e) => {
  if (isWidgetDragging && e.touches.length === 1) {
    if (e.cancelable) e.preventDefault(); // Останавливаем скролл страницы на телефоне во время перетаскивания
    onDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });
window.addEventListener("touchend", () => {
  if (isWidgetDragging) onDragEnd();
}, { passive: true });
window.addEventListener("touchcancel", () => {
  if (isWidgetDragging) onDragEnd();
}, { passive: true });

window.addEventListener("pointerdown", (e) => {
  const board = getBoardElement();
  if (board && (board.contains(e.target) || (e.target.closest && e.target.closest("wc-chess-board, chess-board, cg-board, .cg-wrap")))) {
    isUserInteractingWithBoard = true;
  }
}, { capture: true, passive: true });

function handleBoardInteractionEnd() {
  if (isUserInteractingWithBoard) {
    isUserInteractingWithBoard = false;
  }
  setTimeout(() => {
    const board = getBoardElement();
    if (!board || isInteractingWithBoard(board)) return;
    if (!isAutoHintEnabled) return;
    const fen = parseBoardToFEN(board);
    if (fen && fen !== lastAnalyzedFEN) {
      requestBestMoves();
    }
  }, 80);
}

window.addEventListener("pointerup", handleBoardInteractionEnd, { capture: true, passive: true });
window.addEventListener("pointercancel", handleBoardInteractionEnd, { capture: true, passive: true });
window.addEventListener("mouseup", handleBoardInteractionEnd, { capture: true, passive: true });
window.addEventListener("touchend", handleBoardInteractionEnd, { capture: true, passive: true });

// ==========================================
// 5. Запрос лучших ходов и вывод
// ==========================================
async function requestBestMoves() {
  const board = getBoardElement();
  const output = document.getElementById("chess-assistant-output");

  if (!board) {
    if (output) output.innerText = t("boardNotFound");
    return;
  }

  // Если игрок держит, перетаскивает или выбирает фигуру — не перебиваем подсказки
  if (isInteractingWithBoard(board)) return;

  const fen = parseBoardToFEN(board);
  if (!fen) return;
  if (fen === lastAnalyzedFEN) return;
  lastAnalyzedFEN = fen;

  const activeTurn = fen.includes(" w ") ? "w" : "b";
  const isFlipped = isBoardFlipped(board);
  lastBoardFlipped = isFlipped;
  const myColor = isFlipped ? "b" : "w";
  const isOpponentTurn = activeTurn !== myColor;

  if (isOnlyMyTurnEnabled && isOpponentTurn) {
    clearOverlay();
    if (output) output.innerText = t("oppTurnPremove");
    const res = await requestMovesFromBackground(fen, { movetime: 2000, depth: 16, multiPV: 1 });

    // Проверяем: если противник УЖЕ походил, пока мы считали премув —
    // отбрасываем старый премув и немедленно считаем наш ход!
    const liveBoard = getBoardElement();
    if (liveBoard) {
      const liveFEN = parseBoardToFEN(liveBoard);
      if (liveFEN && liveFEN !== fen) {
        lastAnalyzedFEN = "";
        requestBestMoves();
        return;
      }
      const liveTurn = detectTurn(liveBoard);
      if (liveTurn === myColor) {
        lastAnalyzedFEN = "";
        requestBestMoves();
        return;
      }
    }

    onAnalysisReceived(res, fen, true);
    return;
  }

  let cfg = SPEED_MODES[speedMode] || SPEED_MODES.bullet;
  const turnName = activeTurn === "w" ? t("whiteGen") : t("blackGen");

  // Легит-режим: пониженная глубина (depth 11) вместо любого speed-режима
  if (amateurModeEnabled) {
    cfg = { ...cfg, depth: AMATEUR_CONFIG.depth, movetime: null };
    if (output) {
      output.innerText = `🟢 ${t("amateurModeOn")} — ${t("searchingTurn")} (${turnName})... 🤔💭`;
    }
  } else if (output) {
    if (speedMode === "ultra") {
      output.innerText = `${t("ultraThinking")} (${turnName}, ~7s)... 🧠⏳`;
    } else {
      output.innerText = `🔮 ${cfg.name} ${t("searchingTurn")} (${turnName})... ⚡💭`;
    }
  }

  const res = await requestMovesFromBackground(fen, {
    ...cfg,
    multiPV: arrowMode === "multi5" ? 5 : (arrowMode === "multi1" ? 1 : 3)
  });

  // Легит-режим: «человеческая пауза» перед показом стрелки (2–3 сек)
  if (amateurModeEnabled && !isOpponentTurn) {
    const [minD, maxD] = AMATEUR_CONFIG.delayMs;
    const delay = minD + Math.random() * (maxD - minD);
    await new Promise(r => setTimeout(r, delay));
    if (!isAutoHintEnabled) {
      clearOverlay();
      return;
    }
    // Позиция могла смениться за время паузы — проверяем
    const liveBoard = getBoardElement();
    if (liveBoard) {
      const liveFEN = parseBoardToFEN(liveBoard);
      if (liveFEN && liveFEN !== fen) {
        lastAnalyzedFEN = "";
        requestBestMoves();
        return;
      }
    }
  }

  onAnalysisReceived(res, fen, isOpponentTurn);
}

function formatMovesLog(moves, activeTurn, isFlipped) {
  const myColor = isFlipped ? "b" : "w";
  const who = (score) => {
    if (!score) return "";
    const cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
    const whiteCp = activeTurn === "w" ? cp : -cp;
    const isMine = (myColor === "w" && whiteCp > 0) || (myColor === "b" && whiteCp < 0);
    return isMine ? t("inYourFavor") : t("opponentAdvantage");
  };

  if (arrowMode === "multi1") {
    const m = moves[0];
    if (!m) return t("noMovesMsg");
    const s = formatScore(m.score, "M");
    const scorePart = s ? ` [${s} • ${who(m.score)}]` : "";
    return `#1: ${m.move.slice(0, 2).toUpperCase()} ➔ ${m.move.slice(2, 4).toUpperCase()}${scorePart}`;
  }

  if (arrowMode === "multi5") {
    return moves.slice(0, 5).map((m, i) => {
      const s = formatScore(m.score, "#M");
      const scorePart = s ? ` [${s} • ${who(m.score)}]` : "";
      return `#${i + 1}: ${m.move.slice(0, 2).toUpperCase()} ➔ ${m.move.slice(2, 4).toUpperCase()}${scorePart}`;
    }).join("\n");
  }

  const labels = [t("label1st"), t("label2nd"), t("label3rd")];
  return moves.slice(0, 3).map((m, i) => {
    const s = formatScore(m.score, "M");
    const scorePart = s ? ` [${s} • ${who(m.score)}]` : "";
    return `${labels[i]}: ${m.move.slice(0, 2).toUpperCase()} ➔ ${m.move.slice(2, 4).toUpperCase()}${scorePart}`;
  }).join("\n");
}

function onAnalysisReceived(res, fen, isOpponentTurn) {
  if (!res || res.cancelled) return;
  if (!isAutoHintEnabled) {
    clearOverlay();
    return;
  }

  const board = getBoardElement();
  const output = document.getElementById("chess-assistant-output");
  if (!board) return;

  const currentFEN = parseBoardToFEN(board);
  if (fen && currentFEN && fen !== currentFEN) {
    console.log("⏳ [Chess Assistant] Устаревший расчёт проигнорирован.");
    if (currentFEN !== lastAnalyzedFEN && !isInteractingWithBoard(board)) {
      requestBestMoves();
    }
    return;
  }

  const activeTurn = fen && fen.includes(" w ") ? "w" : "b";
  const isFlipped = isBoardFlipped(board);
  const myColor = isFlipped ? "b" : "w";

  // Если был расчёт хода противника / премува, но на доске уже наш ход — не рисуем премув!
  if (isOpponentTurn) {
    const liveTurn = detectTurn(board);
    if (liveTurn === myColor) {
      lastAnalyzedFEN = "";
      requestBestMoves();
      return;
    }
  }

  const moves = res.moves || [];
  const bestScore = moves[0]?.score || res.bestScore || null;

  // === РЕЖИМ ЛЮБИТЕЛЯ ===
  // Если включён, иногда показываем не лучший ход, а чуть похуже
  let displayMoves = moves;
  if (amateurModeEnabled && moves.length > 0 && !isOpponentTurn) {
    const picked = amateurPickMove(moves);
    if (picked && picked.move !== moves[0].move) {
      // Перекладываем выбранный ход на первое место (остальные убираем из подсказки)
      displayMoves = [picked];
      console.log(`🎭 [Любитель] Выбран ход: ${picked.move} (вместо лучшего ${moves[0].move})`);
    } else {
      displayMoves = [moves[0]]; // показываем только 1 стрелку в режиме любителя
    }
  }

  if (isOpponentTurn && isOnlyMyTurnEnabled) {
    if (res.ponderMove) {
      updateEvalBar(bestScore, activeTurn);
      drawAllVisuals({ moves: [], premoveMove: res.ponderMove });
      if (output) {
        const pm = res.ponderMove;
        const opp = res.bestMove;
        const oppNote = opp ? ` (${t("premoveOnOpp")} ${opp.slice(0, 2).toUpperCase()}➔${opp.slice(2, 4).toUpperCase()})` : "";
        output.innerText = `${t("premoveLabel")} ${pm.slice(0, 2).toUpperCase()} ➔ ${pm.slice(2, 4).toUpperCase()}${oppNote}`;
      }
    } else {
      clearOverlay();
      if (output) output.innerText = t("oppTurnWait");
    }
    return;
  }

  if (moves.length === 0) {
    if (output) output.innerText = t("noMovesMsg");
    clearOverlay();
    return;
  }

  updateEvalBar(bestScore, activeTurn);
  drawAllVisuals({
    moves: displayMoves,
    premoveMove: isOpponentTurn ? res.ponderMove : null
  });

  if (output) {
    let text = formatMovesLog(displayMoves, activeTurn, isFlipped);
    if (amateurModeEnabled && !isOpponentTurn) {
      text = `🟢 ${t("amateurModeOn")}\n` + text;
    }
    if (isOpponentTurn && res.ponderMove) {
      const pm = res.ponderMove;
      text += `\n${t("premoveLabel")} ${pm.slice(0, 2).toUpperCase()} ➔ ${pm.slice(2, 4).toUpperCase()}`;
    }
    output.innerText = text;
  }
}

// ==========================================
// 6. MutationObserver
// ==========================================
function setupBoardObserver() {
  const board = getBoardElement();
  if (!board) return;

  if (board !== currentObservedBoard) {
    if (boardObserver) {
      boardObserver.disconnect();
    }
    currentObservedBoard = board;
    lastBoardFlipped = isBoardFlipped(board);

    boardObserver = new MutationObserver((mutations) => {
      const nowFlipped = isBoardFlipped(board);
      if (lastBoardFlipped !== null && nowFlipped !== lastBoardFlipped) {
        lastBoardFlipped = nowFlipped;
        clearOverlay();
        lastAnalyzedFEN = "";
        clearTimeout(debounceTimer);
        if (isAutoHintEnabled) requestBestMoves();
        return;
      }
      lastBoardFlipped = nowFlipped;

      if (!isAutoHintEnabled) return;

      // Если пользователь трогает, удерживает, перетаскивает фигуру или выбирает клетку —
      // НЕ стираем стрелки и НЕ запускаем расчёт во время удержания!
      if (isInteractingWithBoard(board)) {
        return;
      }

      clearTimeout(debounceTimer);
      const cfg = SPEED_MODES[speedMode] || SPEED_MODES.bullet;
      debounceTimer = setTimeout(() => {
        requestBestMoves();
      }, cfg.debounce || 50);
    });

    const targetToObserve = board.closest(".cg-wrap") || board;
    boardObserver.observe(targetToObserve, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });

    if (isAutoHintEnabled) {
      requestBestMoves();
    }
  }
}

function toggleWidgetMinimize() {
  const widget = document.getElementById("chess-assistant-widget");
  const minBtn = document.getElementById("btn-minimize-widget");
  if (!widget) {
    createWidget();
    return;
  }
  isMinimized = !isMinimized;
  widget.classList.toggle("minimized", isMinimized);
  if (minBtn) minBtn.innerText = isMinimized ? "+" : "_";
}

extApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "TOGGLE_WIDGET") {
    toggleWidgetMinimize();
    sendResponse({ ok: true, isMinimized });
    return true;
  }
});

// ==========================================
// 7. Фиолетовый пульт управления (UI Widget)
// ==========================================
function createWidget() {
  if (document.getElementById("chess-assistant-widget")) return;

  const widget = document.createElement("div");
  widget.id = "chess-assistant-widget";
  widget.innerHTML = `
    <div class="widget-drag-handle" title="Потяни, чтобы переместить"></div>
    <div class="widget-header">
      <h3>
        <span>Stockfish 19</span>
        <span class="badge">4050 ELO</span>
        <button id="btn-settings-widget" class="btn-settings" title="Настройки">&#9881;</button>
      </h3>
      <div class="header-controls">
        <button id="btn-minimize-widget" class="btn-minimize" title="Свернуть / Развернуть">_</button>
      </div>
    </div>

    <div class="widget-body">
      <!-- Переключатель платформы (Chess.com / Lichess) -->
      <div class="platform-switch-row">
        <button type="button" class="btn-platform-pill ${currentPlatform === 'chesscom' ? 'active' : ''}" data-platform="chesscom" title="Chess.com">
          Chess.com
        </button>
        <button type="button" class="btn-platform-pill ${currentPlatform === 'lichess' ? 'active' : ''}" data-platform="lichess" title="Lichess">
          Lichess
        </button>
      </div>

      <!-- Панель настроек (скрыта по умолчанию, открывается по кнопке) -->
      <div id="chess-settings-panel" class="widget-settings-panel" style="display: none;">
        <div class="settings-panel-header">
          <span>${t("settingsTitle")}</span>
          <button id="btn-close-settings" class="btn-panel-close" title="Закрыть">&#x2715;</button>
        </div>

        <!-- 0. Выбор языка (Language: RU / EN) -->
        <div class="setting-item" style="margin-bottom: 6px;">
          <div class="setting-label-row">
            <span>${t("langLabel")}</span>
          </div>
          <div class="style-buttons-row">
            <button type="button" class="btn-style-pill ${currentLang === 'ru' ? 'active' : ''}" data-lang="ru">RU</button>
            <button type="button" class="btn-style-pill ${currentLang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
          </div>
        </div>

        <!-- 1. Режим стрелок (1 / 3 / 5 стрелок) -->
        <div class="setting-item">
          <div class="setting-label-row">
            <span>${t("arrowModeLabel")}</span>
          </div>
          <div class="arrow-mode-column">
            <button type="button" class="btn-style-pill arrow-mode-btn ${arrowMode === 'multi1' ? 'active' : ''}" data-arrow-mode="multi1">
              ${t("arrowMode1")}
            </button>
            <button type="button" class="btn-style-pill arrow-mode-btn ${arrowMode === 'multi3' ? 'active' : ''}" data-arrow-mode="multi3">
              ${t("arrowMode3")}
            </button>
            <button type="button" class="btn-style-pill arrow-mode-btn ${arrowMode === 'multi5' ? 'active' : ''}" data-arrow-mode="multi5">
              ${t("arrowMode5")}
            </button>
          </div>
        </div>

        <!-- 2. Форма меток клеток (квадрат / круг / только стрелка) -->
        <div class="setting-item" style="margin-top: 6px;">
          <div class="setting-label-row">
            <span>${t("markerStyleLabel")}</span>
          </div>
          <div class="style-buttons-row">
            <button type="button" class="btn-style-pill ${markerShape === 'square' ? 'active' : ''}" data-marker="square">${t("markerSquare")}</button>
            <button type="button" class="btn-style-pill ${markerShape === 'circle' ? 'active' : ''}" data-marker="circle">${t("markerCircle")}</button>
            <button type="button" class="btn-style-pill ${markerShape === 'none' ? 'active' : ''}" data-marker="none">${t("markerNone")}</button>
          </div>
        </div>

        <!-- 3. Режим Любителя -->
        <div class="setting-item" style="margin-top: 8px;">
          <div class="setting-label-row">
            <span>${t("amateurModeLabel")}</span>
          </div>
          <div class="style-buttons-row">
            <button type="button" id="btn-amateur-toggle" class="btn-style-pill${amateurModeEnabled ? ' active' : ''}" style="width:100%;">
              ${amateurModeEnabled ? t("amateurModeOn") : t("amateurModeOff")}
            </button>
          </div>
        </div>

        <!-- Ватермарка в меню настроек -->
        <div class="chess-settings-watermark">
          <div>tg <a href="https://t.me/Fsociety_405" target="_blank" rel="noopener noreferrer">@Fsociety_405</a></div>
          <div>tgc <a href="https://t.me/chessassistants" target="_blank" rel="noopener noreferrer">@chessassistants</a></div>
          <div>download: <a href="https://bygemini.chess-assistants.workers.dev/" target="_blank" rel="noopener noreferrer">https://bygemini.chess-assistants.workers.dev/</a></div>
        </div>
      </div>

      <!-- Мини-полоска преимущества внутри виджета -->
      <div class="widget-eval-row">
        <div class="widget-eval-bar-line">
          <span class="widget-eval-title">${t("evalLabel")}</span>
          <div class="widget-eval-track">
            <div class="widget-eval-fill"></div>
          </div>
          <span class="widget-eval-score">0.0</span>
        </div>
        <div class="widget-eval-desc">${t("equalPos")}</div>
      </div>

      <!-- Переключатель режима скорости -->
      <div class="speed-modes-container">
        <div class="speed-modes-grid">
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'bullet' ? 'active' : ''}" data-speed="bullet">${t("bulletName")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'blitz' ? 'active' : ''}" data-speed="blitz">${t("blitzName")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'rapid' ? 'active' : ''}" data-speed="rapid">${t("rapidName")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'ultra' ? 'active' : ''}" data-speed="ultra">${t("ultraName")}</button>
        </div>
      </div>

      <label class="chess-toggle-label">
        <input type="checkbox" id="chess-auto-toggle" ${isAutoHintEnabled ? "checked" : ""} />
        <span>${t("autoHintsLabel")}</span>
      </label>

      <label class="chess-toggle-label">
        <input type="checkbox" id="chess-my-turn-toggle" ${isOnlyMyTurnEnabled ? "checked" : ""} />
        <span>${t("myTurnOnlyLabel")}</span>
      </label>

      <div class="chess-controls-group">
        <div class="chess-row">
          <button id="btn-refresh-hints" class="primary" title="Обновить расчёт [R / К]">
            ${t("refreshBtn")}
          </button>
          <button id="btn-toggle-hints" class="btn-toggle-hints" title="Скрыть / показать стрелки [H / Р]">
            ${isAutoHintEnabled ? t("disableBtn") : t("enableBtn")}
          </button>
        </div>
      </div>

      <div id="chess-assistant-output">${t("readyMsg")}</div>

      <!-- Ватермарка внизу меню -->
      <div class="chess-watermark">
        <div class="watermark-links">
          <span>tg <a href="https://t.me/Fsociety_405" target="_blank" rel="noopener noreferrer">@Fsociety_405</a></span>
          <span class="watermark-sep">•</span>
          <span>tgc <a href="https://t.me/chessassistants" target="_blank" rel="noopener noreferrer">@chessassistants</a></span>
        </div>
        <div class="watermark-download">
          download: <a href="https://bygemini.chess-assistants.workers.dev/" target="_blank" rel="noopener noreferrer">https://bygemini.chess-assistants.workers.dev/</a>
        </div>
      </div>
    </div>
  `;

  try {
    const savedR = localStorage.getItem("chess_widget_pos_r");
    const savedB = localStorage.getItem("chess_widget_pos_b");
    if (savedR && savedB) {
      widget.style.right = savedR;
      widget.style.bottom = savedB;
      widget.style.left = "auto";
      widget.style.top = "auto";
    }
  } catch (err) {}

  document.body.appendChild(widget);

  const minBtn = document.getElementById("btn-minimize-widget");
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWidgetMinimize();
  });

  widget.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    onDragStart(e.clientX, e.clientY, e.target);
  });
  widget.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const ok = onDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
      if (ok && e.cancelable) {
        e.preventDefault();
      }
    }
  }, { passive: false });

  widget.addEventListener("click", () => {
    if (hasWidgetDragged) {
      hasWidgetDragged = false;
      return;
    }
    if (isMinimized) {
      isMinimized = false;
      widget.classList.remove("minimized");
      minBtn.innerText = "_";
    }
  });

  // Открытие / закрытие панели настроек
  const settingsBtn = document.getElementById("btn-settings-widget");
  const settingsPanel = document.getElementById("chess-settings-panel");
  const closeSettingsBtn = document.getElementById("btn-close-settings");

  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = settingsPanel.style.display === "none";
    settingsPanel.style.display = isHidden ? "block" : "none";
  });

  closeSettingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsPanel.style.display = "none";
  });

  // Предотвращение всплытия событий клика по ссылкам ватермарки
  widget.querySelectorAll(".chess-watermark a, .chess-settings-watermark a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  // Переключатель языка (RU / EN)
  widget.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lang = btn.getAttribute("data-lang");
      setLanguage(lang);
    });
  });

  // Переключатель платформы (Chess.com / Lichess)
  widget.querySelectorAll("[data-platform]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = btn.getAttribute("data-platform");
      setPlatform(p);
    });
  });

  // Переключение режима стрелок (1 / 3 / 5)
  widget.querySelectorAll("[data-arrow-mode]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute("data-arrow-mode");
      arrowMode = (mode === "multi5" || mode === "multi1") ? mode : "multi3";
      localStorage.setItem("chess_arrow_mode", arrowMode);

      widget.querySelectorAll("[data-arrow-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      clearOverlay();
      const targetPV = arrowMode === "multi5" ? 5 : (arrowMode === "multi1" ? 1 : 3);
      extApi.runtime.sendMessage({ type: "SET_MULTIPV", multiPV: targetPV });
      lastAnalyzedFEN = "";
      requestBestMoves();
    });
  });

  // Переключатель режима Любителя (Легит)
  const amateurBtn = document.getElementById("btn-amateur-toggle");
  if (amateurBtn) {
    amateurBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      amateurModeEnabled = !amateurModeEnabled;
      localStorage.setItem("chess_amateur_mode", String(amateurModeEnabled));
      amateurBtn.textContent = amateurModeEnabled ? t("amateurModeOn") : t("amateurModeOff");
      amateurBtn.classList.toggle("active", amateurModeEnabled);

      if (amateurModeEnabled) {
        // Отключаем подсветку со скоростных кнопок, чтобы они не горели вместе с легитом
        widget.querySelectorAll("[data-speed]").forEach((b) => b.classList.remove("active"));
      } else {
        // Возвращаем подсветку текущего режима скорости
        widget.querySelectorAll("[data-speed]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-speed") === speedMode);
        });
      }

      lastAnalyzedFEN = "";
      requestBestMoves();
    });
  }

  // Выбор дизайна меток клеток (Квадрат / Круг / Только стрелка)
  widget.querySelectorAll("[data-marker]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      markerShape = btn.getAttribute("data-marker");
      localStorage.setItem("chess_marker_shape", markerShape);

      widget.querySelectorAll("[data-marker]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (lastRenderedState) {
        drawAllVisuals(lastRenderedState);
      }
    });
  });

  // Переключение режимов скорости
  widget.querySelectorAll("[data-speed]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute("data-speed");
      if (SPEED_MODES[mode]) {
        speedMode = mode;
        localStorage.setItem("chess_speed_mode", speedMode);

        if (amateurModeEnabled) {
          amateurModeEnabled = false;
          localStorage.setItem("chess_amateur_mode", "false");
          const amateurBtnEl = document.getElementById("btn-amateur-toggle");
          if (amateurBtnEl) {
            amateurBtnEl.textContent = t("amateurModeOff");
            amateurBtnEl.classList.remove("active");
          }
        }

        widget.querySelectorAll("[data-speed]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        lastAnalyzedFEN = "";
        requestBestMoves();
      }
    });
  });

  const toggleHintsBtn = document.getElementById("btn-toggle-hints");
  const refreshHintsBtn = document.getElementById("btn-refresh-hints");
  const autoToggle = document.getElementById("chess-auto-toggle");

  function updateToggleHintsUI() {
    const toggleBtn = document.getElementById("btn-toggle-hints");
    const autoTog = document.getElementById("chess-auto-toggle");
    if (toggleBtn) {
      if (isAutoHintEnabled) {
        toggleBtn.innerText = t("disableBtn");
        toggleBtn.classList.remove("hints-off");
      } else {
        toggleBtn.innerText = t("enableBtn");
        toggleBtn.classList.add("hints-off");
      }
    }
    if (autoTog) {
      autoTog.checked = isAutoHintEnabled;
    }
  }

  function refreshHints() {
    const board = getBoardElement();
    const out = document.getElementById("chess-assistant-output");
    clearOverlay();
    lastRenderedState = null;
    lastAnalyzedFEN = "";
    clearTimeout(debounceTimer);
    resetGameTracking();

    if (!board) {
      if (out) out.innerText = t("boardNotFoundWarn");
      return;
    }

    if (out) out.innerText = t("refreshingMsg");
    requestBestMoves();
  }

  function toggleHints() {
    isAutoHintEnabled = !isAutoHintEnabled;
    updateToggleHintsUI();
    const out = document.getElementById("chess-assistant-output");
    if (!isAutoHintEnabled) {
      clearTimeout(debounceTimer);
      clearOverlay();
      lastRenderedState = null;
      if (out) out.innerText = t("hintsDisabledMsg");
    } else {
      lastAnalyzedFEN = "";
      if (out) out.innerText = t("hintsEnabledMsg");
      requestBestMoves();
    }
  }

  window.refreshChessHints = refreshHints;
  window.toggleChessHints = toggleHints;

  if (refreshHintsBtn) {
    refreshHintsBtn.addEventListener("click", refreshHints);
  }

  if (toggleHintsBtn) {
    toggleHintsBtn.addEventListener("click", toggleHints);
  }

  if (autoToggle) {
    autoToggle.addEventListener("change", (e) => {
      isAutoHintEnabled = e.target.checked;
      updateToggleHintsUI();
      if (!isAutoHintEnabled) {
        clearTimeout(debounceTimer);
        clearOverlay();
        lastRenderedState = null;
        const out = document.getElementById("chess-assistant-output");
        if (out) out.innerText = t("hintsDisabledMsg");
      } else {
        lastAnalyzedFEN = "";
        requestBestMoves();
      }
    });
  }

  const myTurnToggle = document.getElementById("chess-my-turn-toggle");
  if (myTurnToggle) {
    myTurnToggle.addEventListener("change", (e) => {
      isOnlyMyTurnEnabled = e.target.checked;
      lastAnalyzedFEN = "";
      requestBestMoves();
    });
  }

  setupBoardObserver();
}

// ==========================================
// 8. Горячие клавиши (Keyboard Shortcuts)
// H / Р - скрыть / показать подсказки
// R / К - обновить расчёт позиции
// ==========================================
if (!window.__chess_shortcuts_bound) {
  window.__chess_shortcuts_bound = true;
  window.addEventListener("keydown", (e) => {
    const activeEl = document.activeElement;
    const tag = activeEl ? activeEl.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || (activeEl && activeEl.isContentEditable)) {
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const key = e.key ? e.key.toLowerCase() : "";
    if (key === "h" || key === "р") {
      e.preventDefault();
      if (typeof window.toggleChessHints === "function") {
        window.toggleChessHints();
      }
    } else if (key === "r" || key === "к") {
      e.preventDefault();
      if (typeof window.refreshChessHints === "function") {
        window.refreshChessHints();
      }
    }
  });
}

setInterval(() => {
  createWidget();
  setupBoardObserver();
}, 1500);

setTimeout(() => {
  createWidget();
  setupBoardObserver();
}, 800);
