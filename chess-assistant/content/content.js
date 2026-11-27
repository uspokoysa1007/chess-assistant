// content.js - Шахматный Помощник (Chess.com & Lichess Edition)
// Поддержка MultiPV (1 / 3 / 5 стрелок), безопасный премув с полной проверкой правил, единые знаки оценок и защита от гонок

const extApi = typeof browser !== "undefined" ? browser : chrome;
const IS_MOBILE_BUILD = false;

console.log("[Content Script] Шахматный Помощник загружен (Chess.com & Lichess)!");

function safeGetStorage(key, fallback = null) {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch (_) {
    return fallback;
  }
}

function safeSetStorage(key, value) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch (_) {}
}

let boardObserver = null;
let boardResizeObserver = null;
let currentObservedBoard = null;
const savedAutoHintsSetting = safeGetStorage("chess_auto_hints_enabled");
let isAutoHintEnabled = savedAutoHintsSetting !== null ? savedAutoHintsSetting === "true" : true;
const savedOnlyMyTurnSetting = safeGetStorage("chess_only_my_turn");
let isOnlyMyTurnEnabled = savedOnlyMyTurnSetting !== null ? savedOnlyMyTurnSetting === "true" : true;
const savedPremovesSetting = safeGetStorage("chess_premoves_enabled");
let isPremovesEnabled = savedPremovesSetting !== null ? savedPremovesSetting === "true" : !IS_MOBILE_BUILD;
let isMinimized = IS_MOBILE_BUILD;
let isUserInteractingWithBoard = false;
let debounceTimer = null;
let followUpCheckTimer = null;
let lastAnalyzedFEN = "";
let lastBoardFlipped = null;
let lastRenderedState = null;
let lastEvalState = { score: null, activeTurn: "w" };
let currentRequestId = 0;

// Язык интерфейса (RU / EN)
const browserLang = (typeof navigator !== "undefined" && navigator.language) ? navigator.language : "en";
let currentLang = safeGetStorage("chess_lang") || (browserLang.startsWith("ru") ? "ru" : "en");

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
    premovesLabel: "Премувы",
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
    amateurModeLabel: "Легит-режимы (Античит):",
    legit1Title: "Легит 1 (~1750 ELO)",
    legit1Desc: "~85% точность",
    legit2Title: "Легит 2 (~1350 ELO)",
    legit2Desc: "~75% точность",
    legitDelayLabel: "Мышление легита:",
    amateurModeOn: "Легит включён",
    bulletShort: "Пуля",
    blitzShort: "Блиц",
    rapidShort: "Рапид",
    ultraShort: "Ультра (7с)",
    dragHandleTip: "Потяни, чтобы переместить",
    minimizeTip: "Свернуть / Развернуть",
    closeTip: "Закрыть",
    legit1Tip: "Точность ~85% • Клубный уровень",
    legit2Tip: "Точность ~75% • Безопасный любитель",
    delayPrefix: "Задержка",
    unitMs: "мс",
    unitSec: "с",
    refreshTip: "Обновить расчёт",
    toggleTip: "Скрыть / показать стрелки",
    cornerGripTip: "Потяни за угол"
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
    premovesLabel: "Premoves",
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
    amateurModeLabel: "Anti-cheat Legit modes:",
    legit1Title: "Legit 1 (~1750 ELO)",
    legit1Desc: "~85% accuracy",
    legit2Title: "Legit 2 (~1350 ELO)",
    legit2Desc: "~75% accuracy",
    legitDelayLabel: "Legit thinking time:",
    amateurModeOn: "Legit enabled",
    bulletShort: "Bullet",
    blitzShort: "Blitz",
    rapidShort: "Rapid",
    ultraShort: "Ultra (7s)",
    dragHandleTip: "Drag to move",
    minimizeTip: "Minimize / Expand",
    closeTip: "Close",
    legit1Tip: "~85% accuracy • Club level",
    legit2Tip: "~75% accuracy • Casual player",
    delayPrefix: "Delay",
    unitMs: "ms",
    unitSec: "s",
    refreshTip: "Recalculate position",
    toggleTip: "Hide / show arrows",
    cornerGripTip: "Drag corner to move"
  }
};

function t(key) {
  const dict = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.ru[key] || key;
}

const SPEED_MODES = IS_MOBILE_BUILD
  ? {
      bullet: { nameKey: "bulletShort", name: "Пуля", movetime: 50, depth: 8, debounce: 80, label: "Пуля (50мс • 8d)" },
      blitz:  { nameKey: "blitzShort", name: "Блиц", movetime: 100, depth: 9, debounce: 100, label: "Блиц (100мс • 9d)" },
      rapid:  { nameKey: "rapidShort", name: "Рапид", movetime: 150, depth: 11, debounce: 120, label: "Рапид (150мс • 11d)" }
    }
  : {
      bullet: { nameKey: "bulletShort", name: "Пуля", movetime: 150, depth: null, debounce: 50, label: "Пуля (150мс)" },
      blitz:  { nameKey: "blitzShort", name: "Блиц", movetime: 500, depth: 11, debounce: 150, label: "Блиц (~0.5с)" },
      rapid:  { nameKey: "rapidShort", name: "Рапид", movetime: null, depth: 14, debounce: 300, label: "Рапид" },
      ultra:  { nameKey: "ultraShort", name: "Ультра (7с)", movetime: 7000, depth: 26, debounce: 300, label: "Ультра (7с • 26х)" }
    };

// Настройки режимов (сохраняются безопасно через safeGetStorage)
const rawArrowMode = safeGetStorage("chess_arrow_mode");
let arrowMode = IS_MOBILE_BUILD
  ? "multi1"
  : ((rawArrowMode === "multi1" || rawArrowMode === "multi3" || rawArrowMode === "multi5") ? rawArrowMode : "multi3");

const rawMarkerShape = safeGetStorage("chess_marker_shape");
let markerShape = (rawMarkerShape === "square" || rawMarkerShape === "circle" || rawMarkerShape === "none")
  ? rawMarkerShape
  : "square";

let speedMode = safeGetStorage("chess_speed_mode") || (IS_MOBILE_BUILD ? "rapid" : "bullet");
if (!SPEED_MODES[speedMode]) {
  speedMode = IS_MOBILE_BUILD ? "rapid" : "bullet";
}

// ==========================================
// 1.1. АНТИЧИТ ЛЕГИТ-МОДУЛИ
// legit1: Клубный уровень (~1750 ELO, точность ~82–85%)
// legit2: Любитель (~1350 ELO, точность ~72–75%)
// ==========================================
const rawAmateurStorage = safeGetStorage("chess_amateur_mode");
let amateurMode = "off";
if (rawAmateurStorage === "legit1" || rawAmateurStorage === "legit2") {
  amateurMode = rawAmateurStorage;
} else if (rawAmateurStorage === "true") {
  amateurMode = "legit1"; // обратная совместимость
}
let amateurModeEnabled = amateurMode !== "off";

const VALID_LEGIT_DELAYS = ["50", "250", "500", "1000", "2000", "3000", "5000"];
const rawDelayStorage = safeGetStorage("chess_legit_delay");
let legitDelay = VALID_LEGIT_DELAYS.includes(rawDelayStorage) ? rawDelayStorage : "1000";

const AMATEUR_CONFIGS = {
  legit1: {
    nameKey: "legit1Title",
    name: "Легит 1 (~1750 ELO)",
    bestMoveProb: 0.72,
    maxBlunderCp: 120,
    forceBestOnMate: true,
    depth: 11
  },
  legit2: {
    nameKey: "legit2Title",
    name: "Легит 2 (~1350 ELO)",
    bestMoveProb: 0.50,
    maxBlunderCp: 220,
    forceBestOnMate: true,
    depth: 8
  }
};

/**
 * Выбирает ход в стиле живого человека (Легит 1 или Легит 2).
 * Работает по сырым оценкам со стороны текущего игрока.
 * @param {Array} moves — массив {move, score} от Stockfish
 * @returns {{move, score}|null} — выбранный ход
 */
function amateurPickMove(moves) {
  if (!moves || moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const config = AMATEUR_CONFIGS[amateurMode] || AMATEUR_CONFIGS.legit1;
  const best = moves[0];

  // Всегда играем лучший ход при мате или угрозе мата
  if (config.forceBestOnMate) {
    if (best.score?.type === "mate") return best;
    // Если у лучшего хода огромный перевес (> 8 пешек) — позиция решена, не отдаём материал
    if (best.score?.type === "cp" && Math.abs(best.score.value) > 800) return best;
  }

  // Бросаем монетку: играем лучший ход или нет
  const roll = Math.random();
  if (roll < config.bestMoveProb) return best;

  // Собираем безопасные субоптимальные ходы (только с известной оценкой)
  if (!best.score || best.score.type !== "cp") return best;
  const bestCp = best.score.value;
  const candidates = moves.slice(1).filter((m) => {
    if (!m.score) return false;
    if (m.score.type === "mate") {
      return m.score.value > 0;
    }
    if (m.score.type === "cp") {
      const loss = bestCp - m.score.value;
      return loss <= config.maxBlunderCp;
    }
    return false;
  });

  if (candidates.length === 0) return best;

  // Взвешенный выбор: второй ход выбирается чаще, чем третий
  const weights = candidates.map((_, i) => 1 / (i + 1.4));
  const totalW = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalW;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// Определение платформы: строго по домену, с fallback на хранилище
function detectInitialPlatform() {
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (host.includes("lichess.org")) return "lichess";
  if (host.includes("chess.com")) return "chesscom";
  const saved = safeGetStorage("chess_platform");
  if (saved === "chesscom" || saved === "lichess") return saved;
  return "chesscom";
}
let currentPlatform = detectInitialPlatform();

const MULTI3_COLORS = ["#000000", "#808080", "#ffffff"];
const MULTI5_COLOR = "#000000";
const PREMOVE_COLOR = IS_MOBILE_BUILD ? "#7c3aed" : "#22c55e";

// ==========================================
// 1. АДАПТЕРЫ ПЛАТФОРМ (Chess.com & Lichess)
// ==========================================

const STANDARD_START_FEN_RANKS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";

let gameTracking = {
  whiteKingMoved: false,
  blackKingMoved: false,
  whiteRookA1Moved: false,
  whiteRookH1Moved: false,
  blackRookA8Moved: false,
  blackRookH8Moved: false
};
let lastPlyCount = 0;
let lastPieceCount = 0;
let lastTrackedUrl = typeof location !== "undefined" ? location.href : "";
let reversibleHistory = {
  baseFen: "",
  currentFen: "",
  moves: [],
  lastPosKey: ""
};

function countGridPieces(grid) {
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (grid[r] && grid[r][c]) count++;
    }
  }
  return count;
}

function resetGameTracking() {
  gameTracking = {
    whiteKingMoved: false,
    blackKingMoved: false,
    whiteRookA1Moved: false,
    whiteRookH1Moved: false,
    blackRookA8Moved: false,
    blackRookH8Moved: false
  };
  lastPlyCount = 0;
  lastPieceCount = 0;
  lastTrackedUrl = typeof location !== "undefined" ? location.href : "";
  reversibleHistory = {
    baseFen: "",
    currentFen: "",
    moves: [],
    lastPosKey: ""
  };
}

function isElementVisible(el) {
  if (!el) return false;
  if (el.classList && (el.classList.contains("element-pool") || el.classList.contains("hidden"))) {
    return false;
  }
  if (el.style) {
    if (el.style.display === "none" || el.style.visibility === "hidden" || el.style.opacity === "0") {
      return false;
    }
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function queryVisibleElements(root, selector) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(selector)).filter(isElementVisible);
}

function isRedPremoveOrRightClick(hl) {
  if (!hl) return false;
  if (hl.classList && (hl.classList.contains("premove") || hl.classList.contains("highlight-premove"))) {
    return true;
  }
  const bg = (hl.style && hl.style.backgroundColor) || "";
  const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    if (r >= 200 && g <= 115 && b <= 115) return true;
  }
  return false;
}

function getChesscomLastMoveHighlights(board) {
  return queryVisibleElements(board, ".highlight:not(.element-pool):not(.selected)")
    .filter((hl) => !isRedPremoveOrRightClick(hl));
}

function findFirstNonEmptySelector(selectors) {
  for (const sel of selectors) {
    const nodes = document.querySelectorAll(sel);
    if (nodes.length > 0) return Array.from(nodes);
  }
  return [];
}

const CHESSCOM_MOVE_SELECTORS = [
  "wc-vertical-move-list .node:not(.variation .node)",
  "wc-simple-move-list .node:not(.variation .node)",
  ".vertical-move-list .node:not(.variation .node)",
  ".move-list-wrapper .node:not(.variation .node)",
  ".move-node:not(.variation .move-node)",
  ".move-text-component"
];

const LICHESS_MOVE_SELECTORS = [
  "l4x kwdb",
  "rm6 kwdb",
  "l4x m2",
  ".analyse__moves move:not(interrupt move):not(variation move)",
  ".tview2 move:not(interrupt move):not(variation move)",
  ".moves move:not(variation move)"
];

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
      return queryVisibleElements(
        b,
        ".hint:not(.element-pool), .capture-hint:not(.element-pool), .square-selected:not(.element-pool), .highlight.selected:not(.element-pool)"
      ).length > 0;
    },
    isInteracting(board) {
      return isUserInteractingWithBoard || this.isDragging(board) || this.isSelecting(board);
    },
    detectTurnFromHighlights(board) {
      if (!board || this.isDragging(board)) return null;
      const highlights = getChesscomLastMoveHighlights(board);
      if (highlights.length === 2) {
        for (const hl of highlights) {
          const hlClasses = Array.from(hl.classList);
          const sqClass = hlClasses.find((c) => /^square-[1-8]{2}$/.test(c));
          if (sqClass) {
            const piece =
              board.querySelector(`.piece.${sqClass}:not(.dragging):not(.ghost):not(.element-pool)`) ||
              board.querySelector(`.piece.${sqClass}:not(.ghost):not(.element-pool)`);
            if (piece) {
              const pieceClasses = Array.from(piece.classList);
              const typeClass = pieceClasses.find((c) => /^[wb][pnbrqk]$/.test(c));
              if (typeClass) {
                return typeClass[0] === "w" ? "b" : "w";
              }
            }
          }
        }
      }
      return null;
    },
    detectTurnFromMoveList(moveNodes, selectedIdx) {
      if (!moveNodes || moveNodes.length === 0) return "w";
      const activeIdx = selectedIdx !== -1 ? selectedIdx : moveNodes.length - 1;
      const activeNode = moveNodes[activeIdx];
      if (activeNode) {
        if (
          activeNode.classList.contains("white") ||
          activeNode.classList.contains("white-move") ||
          activeNode.closest(".white-move")
        ) {
          return "b";
        }
        if (
          activeNode.classList.contains("black") ||
          activeNode.classList.contains("black-move") ||
          activeNode.closest(".black-move")
        ) {
          return "w";
        }
        const rawPly = activeNode.getAttribute("data-ply");
        if (rawPly !== null) {
          const ply = parseInt(rawPly, 10);
          if (!Number.isNaN(ply)) {
            return ply % 2 === 1 ? "b" : "w";
          }
        }
      }
      const activePlyCount = activeIdx + 1;
      return activePlyCount % 2 === 1 ? "b" : "w";
    },
    detectTurn(board) {
      const isFlipped = this.isBoardFlipped(board);
      const moveNodes = findFirstNonEmptySelector(CHESSCOM_MOVE_SELECTORS);
      const selectedIdx = moveNodes.findIndex((n) => n.classList.contains("selected") || !!n.querySelector(".selected"));
      const isViewingPast = selectedIdx !== -1 && selectedIdx + 1 < moveNodes.length;

      // 1. Проверяем часы с активным ходом на Chess.com (если не смотрим историю партии)
      if (!isViewingPast) {
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
      }

      // 2. Проверяем 2 подсветки последнего завершённого хода (задачи, история, партии без часов)
      const hlTurn = this.detectTurnFromHighlights(board);
      if (hlTurn) return hlTurn;

      // 3. Список ходов по приоритету селекторов
      if (moveNodes.length > 0) {
        return this.detectTurnFromMoveList(moveNodes, selectedIdx);
      }

      return "w";
    },
    getCastlingAndEnPassant(board, grid, activeTurn = "w", fenRanks = "") {
      const moveNodes = findFirstNonEmptySelector(CHESSCOM_MOVE_SELECTORS);
      const selectedIdx = moveNodes.findIndex((n) => n.classList.contains("selected") || !!n.querySelector(".selected"));
      const isViewingPast = selectedIdx !== -1 && selectedIdx + 1 < moveNodes.length;
      const activePlyCount = selectedIdx !== -1 ? selectedIdx + 1 : moveNodes.length;
      const pieceCount = countGridPieces(grid);
      const currentUrl = typeof location !== "undefined" ? location.href : "";
      const urlChanged = Boolean(currentUrl && lastTrackedUrl && currentUrl !== lastTrackedUrl);
      const piecesIncreased = lastPieceCount > 0 && pieceCount > lastPieceCount;

      if (fenRanks === STANDARD_START_FEN_RANKS || activePlyCount < lastPlyCount || isViewingPast || urlChanged || piecesIncreased) {
        resetGameTracking();
      }
      lastPlyCount = activePlyCount;
      lastTrackedUrl = currentUrl;
      if (!this.isDragging(board)) {
        lastPieceCount = pieceCount;
      }

      if (!this.isDragging(board)) {
        if (grid[0][4] !== "wk") gameTracking.whiteKingMoved = true;
        if (grid[0][0] !== "wr") gameTracking.whiteRookA1Moved = true;
        if (grid[0][7] !== "wr") gameTracking.whiteRookH1Moved = true;

        if (grid[7][4] !== "bk") gameTracking.blackKingMoved = true;
        if (grid[7][0] !== "br") gameTracking.blackRookA8Moved = true;
        if (grid[7][7] !== "br") gameTracking.blackRookH8Moved = true;
      }

      moveNodes.slice(0, activePlyCount).forEach((node, idx) => {
        let isWhite = idx % 2 === 0;
        if (
          node.classList.contains("white") ||
          node.classList.contains("white-move") ||
          node.closest(".white-move")
        ) {
          isWhite = true;
        } else if (
          node.classList.contains("black") ||
          node.classList.contains("black-move") ||
          node.closest(".black-move")
        ) {
          isWhite = false;
        } else {
          const rawPly = node.getAttribute("data-ply");
          if (rawPly !== null) {
            const ply = parseInt(rawPly, 10);
            if (!Number.isNaN(ply)) isWhite = ply % 2 === 1;
          }
        }
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
            if (/^(R|Л)?a[a-hx]/i.test(text) || text.includes("a1")) gameTracking.whiteRookA1Moved = true;
            if (/^(R|Л)?h[a-hx]/i.test(text) || text.includes("h1")) gameTracking.whiteRookH1Moved = true;
          } else {
            if (/^(R|Л)?a[a-hx]/i.test(text) || text.includes("a8")) gameTracking.blackRookA8Moved = true;
            if (/^(R|Л)?h[a-hx]/i.test(text) || text.includes("h8")) gameTracking.blackRookH8Moved = true;
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
      const highlights = getChesscomLastMoveHighlights(board);
      if (highlights.length >= 2) {
        const sqs = [];
        highlights.forEach((hl) => {
          const cl = Array.from(hl.classList).find((c) => /^square-[1-8]{2}$/.test(c));
          if (cl) {
            const cr = cl.replace("square-", "");
            const col = parseInt(cr[0], 10) - 1;
            const row = parseInt(cr[1], 10) - 1;
            if (col >= 0 && col < 8 && row >= 0 && row < 8) {
              sqs.push({ col, row });
            }
          }
        });
        if (sqs.length === 2) {
          const colLetters = ["a", "b", "c", "d", "e", "f", "g", "h"];
          for (const s of sqs) {
            const p = grid[s.row][s.col];
            if (p === "wp" && s.row === 3 && activeTurn === "b" && grid[2][s.col] === null && grid[1][s.col] === null) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 1);
              if (fromSq) enPassant = `${colLetters[s.col]}3`;
            } else if (p === "bp" && s.row === 4 && activeTurn === "w" && grid[5][s.col] === null && grid[6][s.col] === null) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 6);
              if (fromSq) enPassant = `${colLetters[s.col]}6`;
            }
          }
        }
      }
      const fullMove = Math.max(1, Math.floor(activePlyCount / 2) + 1);
      return { rights, enPassant, fullMove };
    },
    parseBoardToFEN(board) {
      const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
      const pieces = board.querySelectorAll(".piece:not(.ghost):not(.element-pool)");
      pieces.forEach((p) => {
        const classes = Array.from(p.classList);
        const typeClass = classes.find((c) => /^[wb][pnbrqk]$/.test(c));
        const squareClass = classes.find((c) => /^square-[1-8]{2}$/.test(c));
        if (typeClass && squareClass) {
          const coords = squareClass.replace("square-", "");
          const col = parseInt(coords[0], 10) - 1;
          const row = parseInt(coords[1], 10) - 1;
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
      const { rights, enPassant, fullMove } = this.getCastlingAndEnPassant(board, grid, activeTurn, fenRanks);
      const posKey = `${fenRanks} ${activeTurn} ${rights} ${enPassant}`;
      const halfMove = updateReversibleHistory(posKey, fullMove, this.isDragging(board));
      return `${posKey} ${halfMove} ${fullMove}`;
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
      return queryVisibleElements(wrap, "square.selected, square.move-dest").length > 0;
    },
    isInteracting(board) {
      return isUserInteractingWithBoard || this.isDragging(board) || this.isSelecting(board);
    },
    isAnimating(board) {
      const b = board || this.getBoardElement();
      return !!(b && b.querySelector("piece.anim"));
    },
    detectTurnFromHighlights(board) {
      if (!board || this.isDragging(board) || this.isAnimating(board)) return null;
      const lastMoves = queryVisibleElements(board, "square.last-move:not(.current-premove)");
      if (lastMoves.length === 2) {
        const pieces = Array.from(board.querySelectorAll("piece:not(.dragging):not(.fading):not(.anim)")).filter(isElementVisible);
        for (const sq of lastMoves) {
          const sqRect = sq.getBoundingClientRect();
          const piece = pieces.find((p) => {
            const pr = p.getBoundingClientRect();
            return Math.abs(pr.left - sqRect.left) < 6 && Math.abs(pr.top - sqRect.top) < 6;
          });
          if (piece) {
            if (piece.classList.contains("white")) return "b";
            if (piece.classList.contains("black")) return "w";
          }
        }
      }
      return null;
    },
    detectTurnFromMoveList(moves, activeIdx) {
      if (!moves || moves.length === 0) return "w";
      const idx = activeIdx !== -1 ? activeIdx : moves.length - 1;
      const node = moves[idx];
      if (node) {
        const rawPly = node.getAttribute("p");
        if (rawPly !== null) {
          const ply = parseInt(rawPly, 10);
          if (!Number.isNaN(ply)) {
            return ply % 2 === 1 ? "b" : "w";
          }
        }
      }
      const firstPrev = moves[0]?.previousElementSibling;
      const startsWithBlackPlaceholder = Boolean(
        firstPrev &&
        !moves.includes(firstPrev) &&
        (firstPrev.classList.contains("empty") || /^(?:\.{3}|…)$/.test((firstPrev.textContent || "").trim()))
      );
      const activePlyCount = idx + 1 + (startsWithBlackPlaceholder ? 1 : 0);
      return activePlyCount % 2 === 1 ? "b" : "w";
    },
    detectTurn(board) {
      const isFlipped = this.isBoardFlipped(board);
      const moves = findFirstNonEmptySelector(LICHESS_MOVE_SELECTORS);
      const activeIdx = moves.findIndex((n) => n.classList.contains("active"));
      const isViewingPast = activeIdx !== -1 && activeIdx + 1 < moves.length;

      // 1. Проверяем часы по прямому цвету и позиции (если не смотрим историю партии)
      if (!isViewingPast) {
        if (document.querySelector(".rclock.white.running, .rclock-white.running, .clock-white.running")) {
          return "w";
        }
        if (document.querySelector(".rclock.black.running, .rclock-black.running, .clock-black.running")) {
          return "b";
        }
        if (document.querySelector(".rclock-bottom.running")) {
          return isFlipped ? "b" : "w";
        }
        if (document.querySelector(".rclock-top.running")) {
          return isFlipped ? "w" : "b";
        }
      }

      // 2. Подсветка последнего хода на доске (задачи, просмотр истории, без часов)
      const hlTurn = this.detectTurnFromHighlights(board);
      if (hlTurn) return hlTurn;

      // 3. Список ходов (учитываем активный полуход и сдвиг при ходе чёрных)
      if (moves.length > 0) {
        return this.detectTurnFromMoveList(moves, activeIdx);
      }

      return "w";
    },
    getCastlingAndEnPassant(board, grid, activeTurn = "w", fenRanks = "") {
      const moveNodes = findFirstNonEmptySelector(LICHESS_MOVE_SELECTORS);
      const activeIdx = moveNodes.findIndex((n) => n.classList.contains("active"));
      const isViewingPast = activeIdx !== -1 && activeIdx + 1 < moveNodes.length;
      const activePlyCount = activeIdx !== -1 ? activeIdx + 1 : moveNodes.length;
      const pieceCount = countGridPieces(grid);
      const currentUrl = typeof location !== "undefined" ? location.href : "";
      const urlChanged = Boolean(currentUrl && lastTrackedUrl && currentUrl !== lastTrackedUrl);
      const piecesIncreased = lastPieceCount > 0 && pieceCount > lastPieceCount;

      if (fenRanks === STANDARD_START_FEN_RANKS || activePlyCount < lastPlyCount || isViewingPast || urlChanged || piecesIncreased) {
        resetGameTracking();
      }
      lastPlyCount = activePlyCount;
      lastTrackedUrl = currentUrl;
      if (!this.isDragging(board)) {
        lastPieceCount = pieceCount;
      }

      if (!this.isDragging(board)) {
        if (grid[0][4] !== "K") gameTracking.whiteKingMoved = true;
        if (grid[0][0] !== "R") gameTracking.whiteRookA1Moved = true;
        if (grid[0][7] !== "R") gameTracking.whiteRookH1Moved = true;

        if (grid[7][4] !== "k") gameTracking.blackKingMoved = true;
        if (grid[7][0] !== "r") gameTracking.blackRookA8Moved = true;
        if (grid[7][7] !== "r") gameTracking.blackRookH8Moved = true;
      }

      const firstPrev = moveNodes[0]?.previousElementSibling;
      const startsWithBlackPlaceholder = Boolean(
        firstPrev &&
        !moveNodes.includes(firstPrev) &&
        (firstPrev.classList.contains("empty") || /^(?:\.{3}|…)$/.test((firstPrev.textContent || "").trim()))
      );

      moveNodes.slice(0, activePlyCount).forEach((node, idx) => {
        let isWhite = ((idx + (startsWithBlackPlaceholder ? 1 : 0)) % 2) === 0;
        const rawPly = node.getAttribute("p");
        if (rawPly !== null) {
          const ply = parseInt(rawPly, 10);
          if (!Number.isNaN(ply)) isWhite = ply % 2 === 1;
        }
        const text = (node.textContent || "").trim();
        if (/^(K|O-O|0-0)/.test(text) || text.includes("O-O") || text.includes("0-0")) {
          if (isWhite) gameTracking.whiteKingMoved = true;
          else gameTracking.blackKingMoved = true;
        }
        if (/^R/.test(text)) {
          if (isWhite) {
            if (/^Ra[a-hx]/i.test(text) || text.includes("a1")) gameTracking.whiteRookA1Moved = true;
            if (/^Rh[a-hx]/i.test(text) || text.includes("h1")) gameTracking.whiteRookH1Moved = true;
          } else {
            if (/^Ra[a-hx]/i.test(text) || text.includes("a8")) gameTracking.blackRookA8Moved = true;
            if (/^Rh[a-hx]/i.test(text) || text.includes("h8")) gameTracking.blackRookH8Moved = true;
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
      const lastMoves = queryVisibleElements(board || document, "square.last-move:not(.current-premove)");
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
            if (p === "P" && s.row === 3 && activeTurn === "b" && grid[2][s.col] === null && grid[1][s.col] === null) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 1);
              if (fromSq) enPassant = `${colLetters[s.col]}3`;
            } else if (p === "p" && s.row === 4 && activeTurn === "w" && grid[5][s.col] === null && grid[6][s.col] === null) {
              const fromSq = sqs.find((o) => o !== s && o.col === s.col && o.row === 6);
              if (fromSq) enPassant = `${colLetters[s.col]}6`;
            }
          }
        }
      }
      const effectivePlyCount = activePlyCount + (startsWithBlackPlaceholder ? 1 : 0);
      const fullMove = Math.max(1, Math.floor(effectivePlyCount / 2) + 1);
      return { rights, enPassant, fullMove };
    },
    parseBoardToFEN(board) {
      const bRect = board.getBoundingClientRect();
      if (!bRect.width || !bRect.height) return "";
      if (this.isAnimating(board)) return "";
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

      const draggingEl = board.querySelector("piece.dragging");
      const hasDragging = !!draggingEl;
      const pieces = board.querySelectorAll(hasDragging ? "piece:not(.dragging):not(.fading)" : "piece:not(.ghost):not(.fading)");
      pieces.forEach((p) => {
        if (p.classList.contains("dragging") || !isElementVisible(p)) return;
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

      // Если на Lichess отключена опция ghost-фигуры при перетаскивании — восстанавливаем её на исходной selected-клетке
      if (hasDragging && draggingEl) {
        const dragType = getPieceType(draggingEl);
        const selectedSq = queryVisibleElements(board, "square.selected")[0];
        if (dragType && selectedSq) {
          const sr = selectedSq.getBoundingClientRect();
          const col = Math.floor((sr.left - bRect.left + sr.width / 2) / sqW);
          const rankIndex = Math.floor((sr.top - bRect.top + sr.height / 2) / sqH);
          if (col >= 0 && col <= 7 && rankIndex >= 0 && rankIndex <= 7) {
            const file = isFlipped ? 7 - col : col;
            const row = isFlipped ? rankIndex : 7 - rankIndex;
            if (!grid[row][file]) grid[row][file] = dragType;
          }
        }
      }

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
      const { rights, enPassant, fullMove } = this.getCastlingAndEnPassant(board, grid, activeTurn, fenRanks);
      const posKey = `${fenRanks} ${activeTurn} ${rights} ${enPassant}`;
      const halfMove = updateReversibleHistory(posKey, fullMove, hasDragging);
      return `${posKey} ${halfMove} ${fullMove}`;
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
function isBoardAnimating(board) {
  const adapter = getAdapter();
  return adapter && adapter.isAnimating ? adapter.isAnimating(board || getBoardElement()) : false;
}
function detectTurn(board) {
  return getAdapter().detectTurn(board || getBoardElement());
}
function parseBoardToFEN(board) {
  return getAdapter().parseBoardToFEN(board || getBoardElement());
}

// ==========================================
// МИНИ-СИМУЛЯТОР ШАХМАТ ДЛЯ ПРОВЕРКИ ПРЕМУВОВ
// ==========================================
const PIECE_VALS = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
function getPieceValue(p) {
  if (!p) return 0;
  return PIECE_VALS[p.toLowerCase()] || 0;
}

class ChessSimulator {
  constructor(fen) {
    this.load(fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  }

  load(fen) {
    const safeFen = (typeof fen === "string" && fen.trim())
      ? fen.trim()
      : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const parts = safeFen.split(/\s+/);
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    const rows = (parts[0] || "").split("/");
    for (let r = 0; r < Math.min(8, rows.length); r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (f > 7) break;
        if (/\d/.test(ch)) {
          f += parseInt(ch, 10);
        } else {
          this.board[r][f] = ch;
          f++;
        }
      }
    }
    this.turn = parts[1] === "b" ? "b" : "w";
    this.castling = parts[2] || "-";
    this.ep = parts[3] || "-";
    this.half = parseInt(parts[4] || "0", 10);
    this.full = parseInt(parts[5] || "1", 10);
  }

  static sqToCoord(sq) {
    if (!sq || sq.length < 2) return null;
    const f = sq.charCodeAt(0) - 97;
    const r = 8 - parseInt(sq[1], 10);
    if (f < 0 || f > 7 || r < 0 || r > 7 || Number.isNaN(r)) return null;
    return { r, f };
  }

  static coordToSq(r, f) {
    return String.fromCharCode(97 + f) + (8 - r);
  }

  isPieceWhite(p) {
    return Boolean(p && p === p.toUpperCase());
  }

  getPiece(r, f) {
    if (r < 0 || r > 7 || f < 0 || f > 7) return null;
    return this.board[r][f];
  }

  isPathClear(fromCoord, toCoord) {
    const dr = Math.sign(toCoord.r - fromCoord.r);
    const df = Math.sign(toCoord.f - fromCoord.f);
    let r = fromCoord.r + dr;
    let f = fromCoord.f + df;
    while (r !== toCoord.r || f !== toCoord.f) {
      if (r < 0 || r > 7 || f < 0 || f > 7) return false;
      if (this.board[r][f] !== null) return false;
      r += dr;
      f += df;
    }
    return true;
  }

  isAttacked(targetR, targetF, byColor) {
    const isByWhite = byColor === "w";

    // 1. Пешки
    const attackerPawnR = isByWhite ? targetR + 1 : targetR - 1;
    const pawnChar = isByWhite ? "P" : "p";
    if (attackerPawnR >= 0 && attackerPawnR < 8) {
      if (targetF - 1 >= 0 && this.board[attackerPawnR][targetF - 1] === pawnChar) return true;
      if (targetF + 1 < 8 && this.board[attackerPawnR][targetF + 1] === pawnChar) return true;
    }

    // 2. Кони
    const knightChar = isByWhite ? "N" : "n";
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, df] of knightOffsets) {
      const nr = targetR + dr;
      const nf = targetF + df;
      if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        if (this.board[nr][nf] === knightChar) return true;
      }
    }

    // 3. Король
    const kingChar = isByWhite ? "K" : "k";
    for (let dr = -1; dr <= 1; dr++) {
      for (let df = -1; df <= 1; df++) {
        if (dr === 0 && df === 0) continue;
        const nr = targetR + dr;
        const nf = targetF + df;
        if (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
          if (this.board[nr][nf] === kingChar) return true;
        }
      }
    }

    // 4. Диагонали (слоны, ферзи)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const bChar = isByWhite ? "B" : "b";
    const qChar = isByWhite ? "Q" : "q";
    for (const [dr, df] of diagDirs) {
      let step = 1;
      while (true) {
        const nr = targetR + dr * step;
        const nf = targetF + df * step;
        if (nr < 0 || nr > 7 || nf < 0 || nf > 7) break;
        const p = this.board[nr][nf];
        if (p) {
          if (p === bChar || p === qChar) return true;
          break;
        }
        step++;
      }
    }

    // 5. Линии (ладьи, ферзи)
    const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const rChar = isByWhite ? "R" : "r";
    for (const [dr, df] of orthoDirs) {
      let step = 1;
      while (true) {
        const nr = targetR + dr * step;
        const nf = targetF + df * step;
        if (nr < 0 || nr > 7 || nf < 0 || nf > 7) break;
        const p = this.board[nr][nf];
        if (p) {
          if (p === rChar || p === qChar) return true;
          break;
        }
        step++;
      }
    }

    return false;
  }

  isCheck(color) {
    const kingChar = color === "w" ? "K" : "k";
    const oppColor = color === "w" ? "b" : "w";
    let kr = -1;
    let kf = -1;
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        if (this.board[r][f] === kingChar) {
          kr = r;
          kf = f;
          break;
        }
      }
      if (kr !== -1) break;
    }
    if (kr === -1) return false;
    return this.isAttacked(kr, kf, oppColor);
  }

  makeMove(uci) {
    if (!uci || uci.length < 4) return false;
    const fromCoord = ChessSimulator.sqToCoord(uci.slice(0, 2));
    const toCoord = ChessSimulator.sqToCoord(uci.slice(2, 4));
    if (!fromCoord || !toCoord) return false;
    if (fromCoord.r === toCoord.r && fromCoord.f === toCoord.f) return false;

    const piece = this.board[fromCoord.r][fromCoord.f];
    if (!piece) return false;

    const isPieceWhite = this.isPieceWhite(piece);
    if ((this.turn === "w") !== isPieceWhite) return false;

    const movingColor = this.turn;
    const opponentColor = movingColor === "w" ? "b" : "w";
    const savedTarget = this.board[toCoord.r][toCoord.f];

    if (savedTarget && this.isPieceWhite(savedTarget) === isPieceWhite) {
      return false;
    }

    const rawPromo = uci[4] ? uci[4].toLowerCase() : null;
    if (rawPromo && !["q", "r", "b", "n"].includes(rawPromo)) return false;
    const promo = rawPromo ? (isPieceWhite ? rawPromo.toUpperCase() : rawPromo) : null;

    const dr = toCoord.r - fromCoord.r;
    const df = toCoord.f - fromCoord.f;
    const absDr = Math.abs(dr);
    const absDf = Math.abs(df);
    const lowerPiece = piece.toLowerCase();

    let epCapturedPos = null;
    let epCaptured = null;
    let castlingRookFrom = null;
    let castlingRookTo = null;
    let castlingRookPiece = null;

    // Проверка правил движения для каждой фигуры
    if (lowerPiece === "p") {
      const dir = isPieceWhite ? -1 : 1;
      const startRank = isPieceWhite ? 6 : 1;
      const promoRank = isPieceWhite ? 0 : 7;

      if (toCoord.r === promoRank) {
        if (!promo) return false;
      } else if (promo) {
        return false;
      }

      if (df === 0) {
        if (savedTarget) return false;
        if (dr === dir) {
          // Одиночный ход вперёд
        } else if (dr === 2 * dir && fromCoord.r === startRank) {
          if (this.board[fromCoord.r + dir][fromCoord.f] !== null) return false;
        } else {
          return false;
        }
      } else if (absDf === 1 && dr === dir) {
        if (savedTarget) {
          // Обычное взятие по диагонали
        } else if (uci.slice(2, 4) === this.ep) {
          const expectedOppPawn = isPieceWhite ? "p" : "P";
          if (this.board[fromCoord.r][toCoord.f] !== expectedOppPawn) return false;
          epCapturedPos = { r: fromCoord.r, f: toCoord.f };
          epCaptured = this.board[fromCoord.r][toCoord.f];
        } else {
          return false;
        }
      } else {
        return false;
      }
    } else {
      if (promo) return false;

      if (lowerPiece === "n") {
        if (!((absDr === 2 && absDf === 1) || (absDr === 1 && absDf === 2))) return false;
      } else if (lowerPiece === "b") {
        if (absDr !== absDf || absDr === 0 || !this.isPathClear(fromCoord, toCoord)) return false;
      } else if (lowerPiece === "r") {
        if ((dr !== 0 && df !== 0) || (absDr + absDf === 0) || !this.isPathClear(fromCoord, toCoord)) return false;
      } else if (lowerPiece === "q") {
        if ((absDr !== absDf && dr !== 0 && df !== 0) || (absDr + absDf === 0) || !this.isPathClear(fromCoord, toCoord)) return false;
      } else if (lowerPiece === "k") {
        if (absDr <= 1 && absDf <= 1) {
          // Обычный ход короля
        } else if (dr === 0 && absDf === 2) {
          if (this.isAttacked(fromCoord.r, fromCoord.f, opponentColor)) return false;
          if (piece === "K" && uci === "e1g1") {
            if (!this.castling.includes("K") || this.board[7][7] !== "R") return false;
            if (this.board[7][5] !== null || this.board[7][6] !== null) return false;
            if (this.isAttacked(7, 5, "b")) return false;
            castlingRookFrom = { r: 7, f: 7 };
            castlingRookTo = { r: 7, f: 5 };
            castlingRookPiece = "R";
          } else if (piece === "K" && uci === "e1c1") {
            if (!this.castling.includes("Q") || this.board[7][0] !== "R") return false;
            if (this.board[7][1] !== null || this.board[7][2] !== null || this.board[7][3] !== null) return false;
            if (this.isAttacked(7, 3, "b")) return false;
            castlingRookFrom = { r: 7, f: 0 };
            castlingRookTo = { r: 7, f: 3 };
            castlingRookPiece = "R";
          } else if (piece === "k" && uci === "e8g8") {
            if (!this.castling.includes("k") || this.board[0][7] !== "r") return false;
            if (this.board[0][5] !== null || this.board[0][6] !== null) return false;
            if (this.isAttacked(0, 5, "w")) return false;
            castlingRookFrom = { r: 0, f: 7 };
            castlingRookTo = { r: 0, f: 5 };
            castlingRookPiece = "r";
          } else if (piece === "k" && uci === "e8c8") {
            if (!this.castling.includes("q") || this.board[0][0] !== "r") return false;
            if (this.board[0][1] !== null || this.board[0][2] !== null || this.board[0][3] !== null) return false;
            if (this.isAttacked(0, 3, "w")) return false;
            castlingRookFrom = { r: 0, f: 0 };
            castlingRookTo = { r: 0, f: 3 };
            castlingRookPiece = "r";
          } else {
            return false;
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    this.board[fromCoord.r][fromCoord.f] = null;
    if (epCapturedPos) {
      this.board[epCapturedPos.r][epCapturedPos.f] = null;
    }
    if (castlingRookFrom) {
      this.board[castlingRookFrom.r][castlingRookFrom.f] = null;
      this.board[castlingRookTo.r][castlingRookTo.f] = castlingRookPiece;
    }
    this.board[toCoord.r][toCoord.f] = promo || piece;

    if (this.isCheck(movingColor)) {
      this.board[fromCoord.r][fromCoord.f] = piece;
      this.board[toCoord.r][toCoord.f] = savedTarget;
      if (epCapturedPos) {
        this.board[epCapturedPos.r][epCapturedPos.f] = epCaptured;
      }
      if (castlingRookFrom) {
        this.board[castlingRookFrom.r][castlingRookFrom.f] = castlingRookPiece;
        this.board[castlingRookTo.r][castlingRookTo.f] = null;
      }
      return false;
    }

    if (lowerPiece === "p" && absDr === 2) {
      const epR = (fromCoord.r + toCoord.r) / 2;
      this.ep = ChessSimulator.coordToSq(epR, fromCoord.f);
    } else {
      this.ep = "-";
    }

    if (piece === "K") {
      this.castling = this.castling.replace("K", "").replace("Q", "");
    } else if (piece === "k") {
      this.castling = this.castling.replace("k", "").replace("q", "");
    } else if (piece === "R") {
      if (fromCoord.r === 7 && fromCoord.f === 7) this.castling = this.castling.replace("K", "");
      if (fromCoord.r === 7 && fromCoord.f === 0) this.castling = this.castling.replace("Q", "");
    } else if (piece === "r") {
      if (fromCoord.r === 0 && fromCoord.f === 7) this.castling = this.castling.replace("k", "");
      if (fromCoord.r === 0 && fromCoord.f === 0) this.castling = this.castling.replace("q", "");
    }

    // Снимаем право рокировки при взятии ладьи на угловой клетке
    if (toCoord.r === 7 && toCoord.f === 7) this.castling = this.castling.replace("K", "");
    if (toCoord.r === 7 && toCoord.f === 0) this.castling = this.castling.replace("Q", "");
    if (toCoord.r === 0 && toCoord.f === 7) this.castling = this.castling.replace("k", "");
    if (toCoord.r === 0 && toCoord.f === 0) this.castling = this.castling.replace("q", "");
    if (!this.castling) this.castling = "-";

    this.turn = opponentColor;
    if (this.turn === "w") this.full++;
    this.half = (lowerPiece === "p" || savedTarget || epCapturedPos) ? 0 : this.half + 1;

    return true;
  }

  toFEN() {
    let str = "";
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r][f];
        if (!p) {
          empty++;
        } else {
          if (empty > 0) { str += empty; empty = 0; }
          str += p;
        }
      }
      if (empty > 0) str += empty;
      if (r < 7) str += "/";
    }
    return `${str} ${this.turn} ${this.castling} ${this.ep} ${this.half} ${this.full}`;
  }
}

function tryFindSingleReversibleMove(prevFen, nextPosKey) {
  if (!prevFen || !nextPosKey) return null;
  const prevParts = prevFen.trim().split(/\s+/);
  const nextParts = nextPosKey.trim().split(/\s+/);
  if (prevParts.length < 4 || nextParts.length < 4) return null;
  if (prevParts[1] === nextParts[1]) return null;
  if (prevParts[2] !== nextParts[2]) return null;
  if (nextParts[3] !== "-") return null;

  const sim = new ChessSimulator(prevFen);
  const targetSim = new ChessSimulator(`${nextPosKey} 0 1`);

  let fromCoord = null;
  let toCoord = null;
  let movedPiece = null;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const a = sim.board[r][f];
      const b = targetSim.board[r][f];
      if (a === b) continue;
      if (a && !b) {
        if (fromCoord) return null;
        fromCoord = { r, f };
        movedPiece = a;
      } else if (!a && b) {
        if (toCoord) return null;
        toCoord = { r, f };
      } else {
        return null;
      }
    }
  }

  if (!fromCoord || !toCoord || !movedPiece) return null;
  if (movedPiece.toLowerCase() === "p") return null;
  if (targetSim.board[toCoord.r][toCoord.f] !== movedPiece) return null;

  const uci = ChessSimulator.coordToSq(fromCoord.r, fromCoord.f) + ChessSimulator.coordToSq(toCoord.r, toCoord.f);
  if (!sim.makeMove(uci)) return null;

  const afterKey = sim.toFEN().split(/\s+/).slice(0, 4).join(" ");
  if (afterKey !== nextPosKey) return null;

  return { uci, nextSimFen: sim.toFEN() };
}

function updateReversibleHistory(posKey, fullMove, isDraggingNow) {
  if (!posKey) return 0;
  if (posKey === reversibleHistory.lastPosKey) {
    return reversibleHistory.moves.length;
  }
  if (isDraggingNow) {
    return reversibleHistory.moves.length;
  }
  if (!reversibleHistory.currentFen) {
    const initFen = `${posKey} 0 ${fullMove}`;
    reversibleHistory = {
      baseFen: initFen,
      currentFen: initFen,
      moves: [],
      lastPosKey: posKey
    };
    return 0;
  }

  const step = tryFindSingleReversibleMove(reversibleHistory.currentFen, posKey);
  if (step && reversibleHistory.moves.length < 120) {
    reversibleHistory.moves.push(step.uci);
    reversibleHistory.currentFen = step.nextSimFen;
    reversibleHistory.lastPosKey = posKey;
    return reversibleHistory.moves.length;
  }

  const resetFen = `${posKey} 0 ${fullMove}`;
  reversibleHistory = {
    baseFen: resetFen,
    currentFen: resetFen,
    moves: [],
    lastPosKey: posKey
  };
  return 0;
}

function getPromoSuffix(uci, includeQueen = true) {
  if (typeof uci !== "string" || uci.length < 5) return "";
  const p = uci[4].toUpperCase();
  if (!["Q", "R", "B", "N"].includes(p)) return "";
  if (!includeQueen && p === "Q") return "";
  return `=${p}`;
}

function formatMoveArrowText(uci) {
  if (typeof uci !== "string" || uci.length < 4) return "";
  return `${uci.slice(0, 2).toUpperCase()} ➔ ${uci.slice(2, 4).toUpperCase()}${getPromoSuffix(uci, true)}`;
}

function formatCompactMoveText(uci) {
  if (typeof uci !== "string" || uci.length < 4) return "";
  return `${uci.slice(0, 2).toUpperCase()}➔${uci.slice(2, 4).toUpperCase()}${getPromoSuffix(uci, true)}`;
}

function isPositionOutdated(fen, myColor, reqId) {
  if (reqId !== undefined && reqId !== currentRequestId) return true;
  if (!isAutoHintEnabled) return true;

  const liveBoard = getBoardElement();
  if (!liveBoard) return true;
  const liveFEN = parseBoardToFEN(liveBoard);
  if (liveFEN && liveFEN !== fen) {
    return true;
  }
  const liveTurn = detectTurn(liveBoard);
  if (liveTurn === myColor) {
    return true;
  }
  return false;
}

function setPlatform(platform) {
  if (platform !== "chesscom" && platform !== "lichess") return;
  currentPlatform = platform;
  const host = typeof location !== "undefined" ? location.hostname : "";
  if (!host.includes("chess.com") && !host.includes("lichess.org")) {
    safeSetStorage("chess_platform", currentPlatform);
  }

  const widget = document.getElementById("chess-assistant-widget");
  if (widget) {
    widget.querySelectorAll("[data-platform]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-platform") === currentPlatform);
    });
  }

  ++currentRequestId;
  clearTimeout(followUpCheckTimer);
  clearOverlay();
  lastRenderedState = null;
  lastAnalyzedFEN = "";
  lastBoardFlipped = null;
  currentObservedBoard = null;

  const out = document.getElementById("chess-assistant-output");
  if (out) {
    out.innerText = isAutoHintEnabled
      ? `${t("switchedTo")} ${Adapters[currentPlatform].name}...`
      : t("hintsDisabledMsg");
  }

  setupBoardObserver();
  requestBestMoves();
}

// ==========================================
// 2. Связь с Background и форматирование оценок
// ==========================================
function requestMovesFromBackground(fen, cfg = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId = null;
    const defaultPV = IS_MOBILE_BUILD
      ? (amateurModeEnabled ? 5 : 1)
      : (arrowMode === "multi5" ? 5 : (arrowMode === "multi1" ? 1 : 3));

    const useHistory = Boolean(
      cfg.useGameHistory &&
      reversibleHistory.moves.length > 0 &&
      reversibleHistory.baseFen &&
      typeof fen === "string" &&
      fen.startsWith(reversibleHistory.lastPosKey + " ")
    );

    const payload = {
      type: "ANALYZE_POSITION",
      fen,
      uciBaseFen: useHistory ? reversibleHistory.baseFen : null,
      uciMoves: useHistory ? reversibleHistory.moves.slice() : null,
      depth: cfg.depth || null,
      movetime: cfg.movetime || null,
      multiPV: cfg.multiPV || defaultPV
    };

    extApi.runtime.sendMessage(payload, (res) => {
      const hadRuntimeError = !!(extApi.runtime && extApi.runtime.lastError);
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (res) {
          resolve(res);
        } else {
          resolve({
            cancelled: hadRuntimeError,
            timedOut: hadRuntimeError,
            moves: [],
            ponderMove: null,
            bestMove: null,
            bestScore: null
          });
        }
      }
    });

    const bgLimit = cfg.movetime
      ? Math.max(4500, cfg.movetime + 4000)
      : (cfg.depth ? Math.max(12000, cfg.depth * 800) : 15000);
    const timeoutWait = bgLimit + 800 + 2500;
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ cancelled: true, timedOut: true, moves: [], ponderMove: null, bestMove: null, bestScore: null });
      }
    }, timeoutWait);
  });
}

function normalizeScoreToWhite(score, activeTurn = "w") {
  if (!score) return null;
  if (activeTurn === "w") {
    return { type: score.type, value: score.value };
  }
  return {
    type: score.type,
    value: score.value === 0 ? 0 : -score.value
  };
}

function formatScore(score, matePrefix = "M") {
  if (!score) return "";
  if (score.type === "mate") {
    const sign = score.value < 0 ? "-" : (matePrefix === "#M" ? "" : "+");
    return `${sign}${matePrefix}${Math.abs(score.value)}`;
  }
  const val = score.value / 100;
  if (Math.abs(val) < 0.05) return "0.0";
  return (val > 0 ? "+" : "") + val.toFixed(1);
}

function getAdvantageText(score, activeTurn, isFlipped) {
  if (!score) return t("equalPos");
  const cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
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
  lastEvalState = { score: score || null, activeTurn: activeTurn || "w" };

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

  const normalizedScore = normalizeScoreToWhite(score, activeTurn);
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
  const dpr = IS_MOBILE_BUILD ? 1.0 : (window.devicePixelRatio || 1);
  const targetWidth = Math.round(rect.width * dpr);
  const targetHeight = Math.round(rect.height * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  return canvas;
}

function clearOverlay() {
  const canvas = document.getElementById("chess-canvas-overlay");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
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
  if (size <= 0) return;
  const safeCorner = Math.max(0, Math.min(cornerLen, size / 2));
  const safeR = Math.max(0, Math.min(r, safeCorner));

  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = IS_MOBILE_BUILD ? "transparent" : "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = IS_MOBILE_BUILD ? 0 : 3 * dpr;
  ctx.lineWidth = 2.8 * dpr;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x, y + safeCorner);
  ctx.arcTo(x, y, x + safeCorner, y, safeR);
  ctx.lineTo(x + safeCorner, y);

  ctx.moveTo(x + size - safeCorner, y);
  ctx.arcTo(x + size, y, x + size, y + safeCorner, safeR);
  ctx.lineTo(x + size, y + safeCorner);

  ctx.moveTo(x + size, y + size - safeCorner);
  ctx.arcTo(x + size, y + size, x + size - safeCorner, y + size, safeR);
  ctx.lineTo(x + size - safeCorner, y + size);

  ctx.moveTo(x + safeCorner, y + size);
  ctx.arcTo(x, y + size, x, y + size - safeCorner, safeR);
  ctx.lineTo(x, y + size - safeCorner);

  ctx.stroke();
  ctx.restore();
}

function drawCircleReticle(ctx, cx, cy, radius, color, dpr) {
  if (radius <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = IS_MOBILE_BUILD ? "transparent" : "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = IS_MOBILE_BUILD ? 0 : 3 * dpr;
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
  const rowNum = parseInt(sq[1], 10);
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
  ctx.shadowColor = IS_MOBILE_BUILD ? "transparent" : "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = IS_MOBILE_BUILD ? 0 : 3.5 * dpr;
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

function drawBadge(ctx, end, score, color, dpr, badgePosition, extraY = 0, activeTurn = "w", uciMove = "") {
  const promoTag = getPromoSuffix(uciMove, false);
  const scorePart = formatScore(normalizeScoreToWhite(score, activeTurn));
  const text = [promoTag, scorePart].filter(Boolean).join(" ");
  if (!text) return;

  ctx.save();
  ctx.font = `bold ${Math.round(11 * dpr)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  const textMetrics = ctx.measureText(text);
  const paddingX = 5.5 * dpr;
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
  ctx.shadowColor = IS_MOBILE_BUILD ? "transparent" : "rgba(0, 0, 0, 0.55)";
  ctx.shadowBlur = IS_MOBILE_BUILD ? 0 : 4 * dpr;
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

function drawMulti5Badges(ctx, items, dpr, activeTurn = "w") {
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
    const promoTag = getPromoSuffix(item.move, false);
    const rawScoreStr = formatScore(normalizeScoreToWhite(item.score, activeTurn), "#M");
    const scoreStr = [promoTag, rawScoreStr].filter(Boolean).join(" ");
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
    ctx.shadowColor = IS_MOBILE_BUILD ? "transparent" : "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = IS_MOBILE_BUILD ? 0 : 4 * dpr;
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

const UCI_MOVE_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/i;

function drawAllVisuals({ moves = [], premoveMove = null, activeTurn = "w", oppMove = null } = {}) {
  lastRenderedState = { moves, premoveMove, activeTurn, oppMove };

  const board = getBoardElement();
  if (!board) return;

  const canvas = getOrCreateCanvas(board);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (canvas.width < 16 || canvas.height < 16) return;

  const dpr = IS_MOBILE_BUILD ? 1.0 : (window.devicePixelRatio || 1);
  const isFlipped = isBoardFlipped(board);
  const squareSize = canvas.width / 8;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const validMoves = (moves || []).filter((m) => m && typeof m.move === "string" && UCI_MOVE_RE.test(m.move));
  const hasPremove = typeof premoveMove === "string" && UCI_MOVE_RE.test(premoveMove);

  if (validMoves.length === 0 && !hasPremove) {
    return;
  }

  // На мобильной версии всегда показываем 1 самую чёткую стрелку
  if (IS_MOBILE_BUILD) {
    if (validMoves.length > 0) {
      const best = validMoves[0];
      const start = getSquareBox(best.move.slice(0, 2), squareSize, dpr, isFlipped);
      const end = getSquareBox(best.move.slice(2, 4), squareSize, dpr, isFlipped);
      const arrowColor = "#000000";

      drawSquareMarker(ctx, start, arrowColor, dpr);
      drawSquareMarker(ctx, end, arrowColor, dpr);
      drawArrow(ctx, start, end, arrowColor, dpr);
      drawBadge(ctx, end, best.score, arrowColor, dpr, "top-center", 0, activeTurn, best.move);
    } else if (hasPremove) {
      const pStart = getSquareBox(premoveMove.slice(0, 2), squareSize, dpr, isFlipped);
      const pEnd = getSquareBox(premoveMove.slice(2, 4), squareSize, dpr, isFlipped);
      drawSquareMarker(ctx, pStart, PREMOVE_COLOR, dpr);
      drawSquareMarker(ctx, pEnd, PREMOVE_COLOR, dpr);
      drawArrow(ctx, pStart, pEnd, PREMOVE_COLOR, dpr);
      if (getPromoSuffix(premoveMove, false)) {
        drawBadge(ctx, pEnd, null, PREMOVE_COLOR, dpr, "top-center", 0, activeTurn, premoveMove);
      }
    }
    return;
  }

  if (arrowMode === "multi5" && validMoves.length > 0) {
    const items = validMoves.slice(0, 5).map((m, idx) => ({
      move: m.move,
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
      if (getPromoSuffix(premoveMove, false)) {
        drawBadge(ctx, pEnd, null, PREMOVE_COLOR, dpr, "top-center", 0, activeTurn, premoveMove);
      }
    }

    drawMulti5Badges(ctx, items, dpr, activeTurn);
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
    drawBadge(ctx, end, best.score, arrowColor, dpr, "top-center", 0, activeTurn, best.move);

    if (hasPremove) {
      const pStart = getSquareBox(premoveMove.slice(0, 2), squareSize, dpr, isFlipped);
      const pEnd = getSquareBox(premoveMove.slice(2, 4), squareSize, dpr, isFlipped);
      drawSquareMarker(ctx, pStart, PREMOVE_COLOR, dpr);
      drawSquareMarker(ctx, pEnd, PREMOVE_COLOR, dpr);
      drawArrow(ctx, pStart, pEnd, PREMOVE_COLOR, dpr);
      if (getPromoSuffix(premoveMove, false)) {
        drawBadge(ctx, pEnd, null, PREMOVE_COLOR, dpr, "top-center", 0, activeTurn, premoveMove);
      }
    }
    return;
  }

  // Режим: 3 стрелки (чёрная / серая / белая)
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
      move: m.move,
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
      drawBadge(ctx, items[i].end, items[i].score, items[i].color, dpr, items[i].badgePos, items[i].extraY, activeTurn, items[i].move);
    }
  }

  if (hasPremove) {
    const pStart = getSquareBox(premoveMove.slice(0, 2), squareSize, dpr, isFlipped);
    const pEnd = getSquareBox(premoveMove.slice(2, 4), squareSize, dpr, isFlipped);
    drawSquareMarker(ctx, pStart, PREMOVE_COLOR, dpr);
    drawSquareMarker(ctx, pEnd, PREMOVE_COLOR, dpr);
    drawArrow(ctx, pStart, pEnd, PREMOVE_COLOR, dpr);
    if (getPromoSuffix(premoveMove, false)) {
      drawBadge(ctx, pEnd, null, PREMOVE_COLOR, dpr, "top-center", 0, activeTurn, premoveMove);
    }
  }
}

// ==========================================
// 4. Поворот экрана, ресайз и перетаскивание виджета
// ==========================================
function handleResizeOrOrientation() {
  clampWidgetPosition();
  const board = getBoardElement();
  if (board) {
    getOrCreateCanvas(board);
    if (lastRenderedState) {
      drawAllVisuals(lastRenderedState);
    }
  }
}

function observeBoardResize(board) {
  if (typeof ResizeObserver === "undefined" || !board) return;
  if (boardResizeObserver) boardResizeObserver.disconnect();
  boardResizeObserver = new ResizeObserver(() => {
    handleResizeOrOrientation();
  });
  boardResizeObserver.observe(board);
}

let startX = 0;
let startY = 0;
let startRight = 14;
let startBottom = 12;
let isWidgetDragging = false;
let hasWidgetDragged = false;
let expandedOnPointerUp = false;
let interactionEndTimer = null;
let dragResetTimer = null;

function clampWidgetPosition() {
  const widget = document.getElementById("chess-assistant-widget");
  if (!widget || !widget.offsetWidth || !widget.offsetHeight) return;
  const rect = widget.getBoundingClientRect();
  const maxRight = Math.max(0, window.innerWidth - widget.offsetWidth - 4);
  const maxBottom = Math.max(0, window.innerHeight - widget.offsetHeight - 4);
  let currentRight = parseFloat(widget.style.right);
  if (isNaN(currentRight)) {
    currentRight = window.innerWidth - rect.right;
  }
  let currentBottom = parseFloat(widget.style.bottom);
  if (isNaN(currentBottom)) {
    currentBottom = window.innerHeight - rect.bottom;
  }
  const clampedRight = Math.max(4, Math.min(maxRight, currentRight));
  const clampedBottom = Math.max(4, Math.min(maxBottom, currentBottom));
  widget.style.setProperty("right", `${clampedRight}px`, "important");
  widget.style.setProperty("bottom", `${clampedBottom}px`, "important");
  widget.style.setProperty("left", "auto", "important");
  widget.style.setProperty("top", "auto", "important");
  safeSetStorage("chess_widget_pos_r", widget.style.right);
  safeSetStorage("chess_widget_pos_b", widget.style.bottom);
}

function onDragStart(clientX, clientY, target) {
  const widget = document.getElementById("chess-assistant-widget");
  if (!widget) return false;

  if (isMinimized) {
    clearTimeout(dragResetTimer);
    startX = clientX;
    startY = clientY;
    const rect = widget.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    isWidgetDragging = true;
    hasWidgetDragged = false;
    return true;
  }

  if (target && target.closest && target.closest("button, input, a, select, textarea, label, .btn-speed-pill, .btn-style-pill, .btn-platform-pill")) {
    return false;
  }

  const isHeader = target && target.closest && target.closest(".widget-header, .settings-panel-header, .widget-drag-handle, .widget-corner-grip");
  const isProtectedContent = target && target.closest && target.closest(
    "#chess-assistant-output, .chess-watermark, .platform-switch-row, .speed-modes-grid, .chess-controls-group, .widget-settings-panel"
  );
  const rect = widget.getBoundingClientRect();
  const isTopZone = (clientY - rect.top < 42) && !isProtectedContent;

  const cornerSize = 24;
  const isTopLeft = (clientX - rect.left <= cornerSize) && (clientY - rect.top <= cornerSize);
  const isTopRight = (rect.right - clientX <= cornerSize) && (clientY - rect.top <= cornerSize);
  const isBottomLeft = (clientX - rect.left <= cornerSize) && (rect.bottom - clientY <= cornerSize);
  const isBottomRight = (rect.right - clientX <= cornerSize) && (rect.bottom - clientY <= cornerSize);
  const isCorner = (isTopLeft || isTopRight || isBottomLeft || isBottomRight) && !isProtectedContent;

  if (isHeader || isTopZone || isCorner) {
    clearTimeout(dragResetTimer);
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
    widget.style.transition = "none";
    const maxRight = Math.max(0, window.innerWidth - widget.offsetWidth - 4);
    const maxBottom = Math.max(0, window.innerHeight - widget.offsetHeight - 4);
    const newRight = Math.max(4, Math.min(maxRight, startRight - dx));
    const newBottom = Math.max(4, Math.min(maxBottom, startBottom - dy));
    widget.style.setProperty("right", `${newRight}px`, "important");
    widget.style.setProperty("bottom", `${newBottom}px`, "important");
    widget.style.setProperty("left", "auto", "important");
    widget.style.setProperty("top", "auto", "important");
  }
}

function onDragEnd(cancelled = false) {
  if (!isWidgetDragging) return;
  const widget = document.getElementById("chess-assistant-widget");
  const wasDragged = hasWidgetDragged;
  if (widget) {
    widget.style.transition = "";
    if (wasDragged) {
      safeSetStorage("chess_widget_pos_r", widget.style.right);
      safeSetStorage("chess_widget_pos_b", widget.style.bottom);
    } else if (!cancelled && isMinimized) {
      isMinimized = false;
      expandedOnPointerUp = true;
      setTimeout(() => {
        expandedOnPointerUp = false;
      }, 250);
      widget.classList.remove("minimized");
      const minBtn = document.getElementById("btn-minimize-widget");
      if (minBtn) minBtn.innerText = "_";
      requestAnimationFrame(() => {
        clampWidgetPosition();
      });
    }
  }
  isWidgetDragging = false;
  clearTimeout(dragResetTimer);
  dragResetTimer = setTimeout(() => {
    hasWidgetDragged = false;
  }, 100);
}

function handleBoardInteractionEnd() {
  const wasInteracting = isUserInteractingWithBoard;
  isUserInteractingWithBoard = false;
  if (!wasInteracting) return;

  clearTimeout(interactionEndTimer);
  interactionEndTimer = setTimeout(() => {
    const board = getBoardElement();
    if (!board || isInteractingWithBoard(board)) return;
    if (!isAutoHintEnabled) return;
    const fen = parseBoardToFEN(board);
    if (fen && fen !== lastAnalyzedFEN) {
      requestBestMoves();
    }
  }, 80);
}

// ==========================================
// 5. Запрос лучших ходов и вывод
// ==========================================
function scheduleFollowUpCheck() {
  clearTimeout(followUpCheckTimer);
  followUpCheckTimer = setTimeout(() => {
    if (!isAutoHintEnabled) return;
    const b = getBoardElement();
    if (!b || isInteractingWithBoard(b) || isBoardAnimating(b)) return;
    const freshFen = parseBoardToFEN(b);
    if (freshFen && freshFen !== lastAnalyzedFEN) {
      requestBestMoves();
    }
  }, 350);
}

async function requestBestMoves() {
  const board = getBoardElement();
  const output = document.getElementById("chess-assistant-output");

  if (!isAutoHintEnabled) return;

  if (!board) {
    if (output) output.innerText = t("boardNotFound");
    return;
  }

  // Если игрок держит, перетаскивает или выбирает фигуру — не перебиваем подсказки
  if (isInteractingWithBoard(board)) return;

  if (isBoardAnimating(board)) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      requestBestMoves();
    }, 60);
    return;
  }

  const fen = parseBoardToFEN(board);
  if (!fen) return;
  if (fen === lastAnalyzedFEN) return;
  lastAnalyzedFEN = fen;
  scheduleFollowUpCheck();

  const reqId = ++currentRequestId;

  const activeTurn = fen.includes(" w ") ? "w" : "b";
  const isFlipped = isBoardFlipped(board);
  lastBoardFlipped = isFlipped;
  const myColor = isFlipped ? "b" : "w";
  const isOpponentTurn = activeTurn !== myColor;

  if (isOpponentTurn && isOnlyMyTurnEnabled) {
    if (!isPremovesEnabled) {
      clearOverlay();
      lastRenderedState = null;
      if (output) output.innerText = t("oppTurnWait");
      return;
    }

    clearOverlay();
    lastRenderedState = null;
    if (output) output.innerText = t("oppTurnPremove");

    // 1. Адаптивное время расчёта премува под выбранный режим скорости (чтобы в Пуле успевать до хода соперника)
    const premoveSearchProfile = IS_MOBILE_BUILD
      ? (speedMode === "bullet"
          ? { movetime: 130, depth: 8, multiPV: 3, branchTime: 35, branchDepth: 6 }
          : (speedMode === "blitz"
              ? { movetime: 240, depth: 9, multiPV: 4, branchTime: 45, branchDepth: 6 }
              : { movetime: 400, depth: 10, multiPV: 4, branchTime: 60, branchDepth: 7 }))
      : (speedMode === "bullet"
          ? { movetime: 240, depth: 10, multiPV: 4, branchTime: 45, branchDepth: 7 }
          : (speedMode === "blitz"
              ? { movetime: 550, depth: 12, multiPV: 5, branchTime: 70, branchDepth: 8 }
              : { movetime: 1200, depth: 14, multiPV: 5, branchTime: 90, branchDepth: 8 }));

    const oppRes = await requestMovesFromBackground(fen, {
      movetime: premoveSearchProfile.movetime,
      depth: premoveSearchProfile.depth,
      multiPV: premoveSearchProfile.multiPV,
      useGameHistory: true
    });

    if (reqId !== currentRequestId || !isAutoHintEnabled || !isPremovesEnabled || !isOnlyMyTurnEnabled) return;
    if (!oppRes || oppRes.cancelled) {
      if (lastAnalyzedFEN === fen) lastAnalyzedFEN = "";
      if (output) output.innerText = t("oppTurnWait");
      return;
    }
    if (isPositionOutdated(fen, myColor, reqId)) {
      if (reqId === currentRequestId && isAutoHintEnabled) {
        lastAnalyzedFEN = "";
        requestBestMoves();
      }
      return;
    }

    const oppMoves = oppRes?.moves || [];
    if (oppMoves.length === 0) {
      if (output) output.innerText = t("oppTurnWait");
      return;
    }

    const candidatePremove = oppMoves[0].ponder;
    if (!candidatePremove || candidatePremove.length < 4) {
      if (output) output.innerText = t("oppTurnWait");
      return;
    }

    // Оценка текущей позиции со стороны нашего игрока E_current
    const bestOppScore = oppMoves[0].score;
    if (!bestOppScore) {
      if (output) output.innerText = t("oppTurnWait");
      return;
    }
    const oppCp = bestOppScore.type === "mate"
      ? (bestOppScore.value > 0 ? 10000 : -10000)
      : (bestOppScore.value || 0);
    const E_current = -oppCp;

    // Учитываем естественный дебютный перевес белых (~+0.3), чтобы премувы работали и при игре чёрными в равной позиции
    const MIN_SAFE_PREMOVE_EVAL_CP = -85;
    const MAX_PREMOVE_DROP_CP = 35;
    if (E_current < MIN_SAFE_PREMOVE_EVAL_CP) {
      if (output) output.innerText = t("oppTurnWait");
      return;
    }

    // 2. Двухэтапная проверка топ-ответов соперника
    const branchesToCheck = oppMoves.slice(0, premoveSearchProfile.multiPV);
    let worstAfterPremove = E_current;
    let isPremoveSafe = true;
    let checkedBranches = 0;

    for (const opp of branchesToCheck) {
      const sim = new ChessSimulator(fen);
      const oppOk = sim.makeMove(opp.move);
      if (!oppOk) {
        isPremoveSafe = false;
        break;
      }

      const fromSq = candidatePremove.slice(0, 2);
      const toSq = candidatePremove.slice(2, 4);
      const fromCoord = ChessSimulator.sqToCoord(fromSq);
      const toCoord = ChessSimulator.sqToCoord(toSq);
      if (!fromCoord || !toCoord) { isPremoveSafe = false; break; }

      const ourPiece = sim.getPiece(fromCoord.r, fromCoord.f);
      if (!ourPiece) {
        isPremoveSafe = false;
        break;
      }

      const targetPieceBeforeOurMove = sim.getPiece(toCoord.r, toCoord.f);

      const ourOk = sim.makeMove(candidatePremove);
      if (!ourOk) {
        isPremoveSafe = false;
        break;
      }

      const oppColor = myColor === "w" ? "b" : "w";
      if (targetPieceBeforeOurMove) {
        const ourVal = getPieceValue(ourPiece);
        const targetVal = getPieceValue(targetPieceBeforeOurMove);
        const isTargetProtectedByOpp = sim.isAttacked(toCoord.r, toCoord.f, oppColor);
        if (isTargetProtectedByOpp && ourVal > targetVal) {
          isPremoveSafe = false;
          break;
        }
      }

      let E_branch = E_current;
      if (opp.ponder === candidatePremove && opp.score) {
        const bScore = opp.score;
        const bCp = bScore.type === "mate" ? (bScore.value > 0 ? 10000 : -10000) : (bScore.value || 0);
        E_branch = -bCp;
      } else {
        const branchFEN = sim.toFEN();
        const branchRes = await requestMovesFromBackground(branchFEN, {
          movetime: premoveSearchProfile.branchTime,
          depth: premoveSearchProfile.branchDepth,
          multiPV: 1
        });
        if (reqId !== currentRequestId || !isAutoHintEnabled || !isPremovesEnabled || !isOnlyMyTurnEnabled) return;
        if (isPositionOutdated(fen, myColor, reqId)) {
          if (reqId === currentRequestId && isAutoHintEnabled) {
            lastAnalyzedFEN = "";
            requestBestMoves();
          }
          return;
        }
        const bScore = branchRes?.moves?.[0]?.score;
        if (!branchRes || branchRes.cancelled) {
          isPremoveSafe = false;
          break;
        }
        if (bScore) {
          const bCp = bScore.type === "mate" ? (bScore.value > 0 ? 10000 : -10000) : bScore.value;
          E_branch = -bCp;
        } else if (!branchRes.moves || branchRes.moves.length === 0) {
          // Нет легальных ходов у соперника: мат в нашу пользу или пат
          E_branch = sim.isCheck(oppColor) ? 10000 : 0;
        } else {
          isPremoveSafe = false;
          break;
        }
      }

      if (E_branch < MIN_SAFE_PREMOVE_EVAL_CP - 15 || E_current - E_branch > MAX_PREMOVE_DROP_CP) {
        isPremoveSafe = false;
        break;
      }

      if (E_branch < worstAfterPremove) {
        worstAfterPremove = E_branch;
      }
      checkedBranches++;
    }

    if (reqId !== currentRequestId || !isAutoHintEnabled || !isPremovesEnabled || !isOnlyMyTurnEnabled) return;

    if (
      !isPremoveSafe ||
      checkedBranches === 0 ||
      worstAfterPremove < MIN_SAFE_PREMOVE_EVAL_CP - 15 ||
      (E_current - worstAfterPremove > MAX_PREMOVE_DROP_CP)
    ) {
      clearOverlay();
      lastRenderedState = null;
      if (output) output.innerText = t("oppTurnWait");
      return;
    }

    // Все проверки пройдены: премув безопасен!
    updateEvalBar(bestOppScore, activeTurn);
    drawAllVisuals({ moves: [], premoveMove: candidatePremove, activeTurn, oppMove: oppMoves[0].move });
    if (output) {
      const pm = candidatePremove;
      const opp = oppMoves[0].move;
      const oppNote = opp ? ` (${t("premoveOnOpp")} ${formatCompactMoveText(opp)})` : "";
      output.innerText = `${t("premoveLabel")} ${formatMoveArrowText(pm)}${oppNote}`;
    }
    return;
  }

  let cfg = SPEED_MODES[speedMode] || (IS_MOBILE_BUILD ? SPEED_MODES.rapid : SPEED_MODES.bullet);
  const turnName = activeTurn === "w" ? t("whiteGen") : t("blackGen");
  const curLegitConfig = AMATEUR_CONFIGS[amateurMode] || AMATEUR_CONFIGS.legit1;
  const baseLegitDelay = parseInt(legitDelay, 10) || 1000;

  if (amateurModeEnabled) {
    const legitMovetime = IS_MOBILE_BUILD
      ? Math.min(amateurMode === "legit2" ? 450 : 800, Math.max(80, baseLegitDelay))
      : Math.min(3500, Math.max(160, Math.round(baseLegitDelay * 0.85)));
    cfg = { ...cfg, depth: curLegitConfig.depth, movetime: legitMovetime };
    if (output) {
      output.innerText = `${t(curLegitConfig.nameKey)} — ${t("searchingTurn")} (${turnName})...`;
    }
  } else if (output) {
    if (speedMode === "ultra") {
      output.innerText = `${t("ultraThinking")} (${turnName}, ~7${t("unitSec")})...`;
    } else {
      output.innerText = `${t(cfg.nameKey)} — ${t("searchingTurn")} (${turnName})...`;
    }
  }

  const targetMultiPV = IS_MOBILE_BUILD
    ? (amateurModeEnabled ? 5 : 1)
    : (amateurModeEnabled ? 5 : (arrowMode === "multi5" ? 5 : (arrowMode === "multi3" ? 3 : 1)));

  const searchStartedAt = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  const res = await requestMovesFromBackground(fen, {
    ...cfg,
    multiPV: targetMultiPV,
    useGameHistory: true
  });

  if (reqId !== currentRequestId || !isAutoHintEnabled) return;

  // Легит-режим: естественная пауза с вычитанием времени, уже потраченного движком на расчёт
  if (amateurModeEnabled && !isOpponentTurn && res && !res.cancelled && res.moves && res.moves.length > 0) {
    const nowTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const elapsedMs = Math.max(0, nowTs - searchStartedAt);
    const jitter = (Math.random() * 0.24 - 0.12) * baseLegitDelay;
    const targetTotalDelay = Math.max(15, Math.round(baseLegitDelay + jitter));
    const remainingDelay = Math.max(0, Math.round(targetTotalDelay - elapsedMs));
    if (remainingDelay > 0) {
      await new Promise((r) => setTimeout(r, remainingDelay));
    }

    if (reqId !== currentRequestId || !isAutoHintEnabled) {
      if (!isAutoHintEnabled) clearOverlay();
      return;
    }

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

  onAnalysisReceived(res, fen, isOpponentTurn, reqId);
}

function formatMovesLog(moves, activeTurn, isFlipped) {
  if (!moves || moves.length === 0) return t("noMovesMsg");
  const myColor = isFlipped ? "b" : "w";
  const who = (score) => {
    if (!score) return "";
    const cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
    const whiteCp = activeTurn === "w" ? cp : -cp;
    if (score.type !== "mate" && Math.abs(whiteCp) <= 25) return "";
    const isMine = (myColor === "w" && whiteCp > 0) || (myColor === "b" && whiteCp < 0);
    return isMine ? t("inYourFavor") : t("opponentAdvantage");
  };
  const formatScorePart = (score, matePrefix) => {
    const normalized = normalizeScoreToWhite(score, activeTurn);
    const s = formatScore(normalized, matePrefix);
    if (!s) return "";
    const whoText = who(score);
    return whoText ? ` [${s} • ${whoText}]` : ` [${s}]`;
  };

  if (IS_MOBILE_BUILD) {
    const m = moves[0];
    const scorePart = formatScorePart(m.score, "M");
    return `${t("bestMovePhone")} ${formatMoveArrowText(m.move)}${scorePart}`;
  }

  if (arrowMode === "multi1") {
    const m = moves[0];
    const scorePart = formatScorePart(m.score, "M");
    return `#1: ${formatMoveArrowText(m.move)}${scorePart}`;
  }

  if (arrowMode === "multi5") {
    return moves.slice(0, 5).map((m, i) => {
      const scorePart = formatScorePart(m.score, "#M");
      return `#${i + 1}: ${formatMoveArrowText(m.move)}${scorePart}`;
    }).join("\n");
  }

  const labels = [t("label1st"), t("label2nd"), t("label3rd")];
  return moves.slice(0, 3).map((m, i) => {
    const scorePart = formatScorePart(m.score, "M");
    return `${labels[i]}: ${formatMoveArrowText(m.move)}${scorePart}`;
  }).join("\n");
}

function onAnalysisReceived(res, fen, isOpponentTurn, reqId) {
  if (reqId !== undefined && reqId !== currentRequestId) return;
  if (!res || res.cancelled) {
    if (lastAnalyzedFEN === fen) lastAnalyzedFEN = "";
    if (res && res.timedOut) {
      const output = document.getElementById("chess-assistant-output");
      if (output && isAutoHintEnabled) output.innerText = t("readyMsg");
    }
    return;
  }
  if (!isAutoHintEnabled) {
    clearOverlay();
    return;
  }

  const board = getBoardElement();
  const output = document.getElementById("chess-assistant-output");
  if (!board) return;

  const currentFEN = parseBoardToFEN(board);
  if (fen && currentFEN && fen !== currentFEN) {
    console.log("[Chess Assistant] Устаревший расчёт проигнорирован.");
    if (currentFEN !== lastAnalyzedFEN && !isInteractingWithBoard(board)) {
      requestBestMoves();
    }
    return;
  }

  const activeTurn = fen && fen.includes(" w ") ? "w" : "b";
  const isFlipped = isBoardFlipped(board);
  const myColor = isFlipped ? "b" : "w";

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

  let displayMoves = moves;
  if (amateurModeEnabled && moves.length > 0 && !isOpponentTurn) {
    const picked = amateurPickMove(moves);
    if (picked && picked.move !== moves[0].move) {
      displayMoves = [picked];
      console.log(`[Легит] Выбран ход: ${picked.move} (вместо лучшего ${moves[0].move})`);
    } else {
      displayMoves = [moves[0]];
    }
  }

  if (moves.length === 0) {
    if (output) output.innerText = t("noMovesMsg");
    clearOverlay();
    lastRenderedState = null;
    return;
  }

  updateEvalBar(bestScore, activeTurn);
  drawAllVisuals({
    moves: displayMoves,
    premoveMove: null,
    activeTurn
  });

  if (output) {
    let text = formatMovesLog(displayMoves, activeTurn, isFlipped);
    if (amateurModeEnabled && !isOpponentTurn) {
      text = `${t("amateurModeOn")}\n` + text;
    }
    output.innerText = text;
  }
}

// ==========================================
// 6. MutationObserver
// ==========================================
function setupBoardObserver() {
  const board = getBoardElement();
  if (!board) {
    if (boardObserver) {
      boardObserver.disconnect();
      boardObserver = null;
    }
    if (boardResizeObserver) {
      boardResizeObserver.disconnect();
      boardResizeObserver = null;
    }
    currentObservedBoard = null;
    const staleCanvas = document.getElementById("chess-canvas-overlay");
    if (staleCanvas) staleCanvas.remove();
    return;
  }

  if (board !== currentObservedBoard) {
    if (boardObserver) {
      boardObserver.disconnect();
    }
    currentObservedBoard = board;
    observeBoardResize(board);
    lastBoardFlipped = isBoardFlipped(board);

    boardObserver = new MutationObserver(() => {
      const nowFlipped = isBoardFlipped(board);
      if (lastBoardFlipped !== null && nowFlipped !== lastBoardFlipped) {
        lastBoardFlipped = nowFlipped;
        ++currentRequestId;
        clearTimeout(followUpCheckTimer);
        clearOverlay();
        lastRenderedState = null;
        lastAnalyzedFEN = "";
        clearTimeout(debounceTimer);
        if (lastEvalState && lastEvalState.score) {
          updateEvalBar(lastEvalState.score, lastEvalState.activeTurn);
        }
        if (isAutoHintEnabled) requestBestMoves();
        return;
      }
      lastBoardFlipped = nowFlipped;

      if (!isAutoHintEnabled) return;

      // Если пользователь трогает, удерживает, перетаскивает фигуру или выбирает клетку — не перебиваем стрелки
      if (isInteractingWithBoard(board)) {
        return;
      }

      clearTimeout(debounceTimer);
      const cfg = SPEED_MODES[speedMode] || (IS_MOBILE_BUILD ? SPEED_MODES.rapid : SPEED_MODES.bullet);
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
  if (!isMinimized) {
    requestAnimationFrame(() => {
      clampWidgetPosition();
    });
  }
}

// ==========================================
// 7. Фиолетовый пульт управления (UI Widget)
// ==========================================
function setLanguage(lang) {
  if (lang !== "ru" && lang !== "en") return;
  if (lang === currentLang) return;

  const oldOutput = document.getElementById("chess-assistant-output")?.innerText || "";
  const oldReady = t("readyMsg");
  const oldDisabled = t("hintsDisabledMsg");
  const oldOppWait = t("oppTurnWait");
  const oldOppPremove = t("oppTurnPremove");
  const oldNoMoves = t("noMovesMsg");
  const oldBoardNotFound = t("boardNotFound");
  const oldBoardNotFoundWarn = t("boardNotFoundWarn");

  currentLang = lang;
  safeSetStorage("chess_lang", currentLang);

  const widget = document.getElementById("chess-assistant-widget");
  const settingsEl = document.getElementById("chess-settings-panel");
  const wasSettingsOpen = settingsEl ? settingsEl.style.display !== "none" : false;

  if (widget) {
    widget.remove();
    createWidget();

    if (wasSettingsOpen) {
      const panel = document.getElementById("chess-settings-panel");
      if (panel) panel.style.display = "block";
    }
    requestAnimationFrame(() => {
      clampWidgetPosition();
    });

    if (lastEvalState && lastEvalState.score) {
      updateEvalBar(lastEvalState.score, lastEvalState.activeTurn);
    }

    const newOut = document.getElementById("chess-assistant-output");
    if (lastRenderedState && ((lastRenderedState.moves && lastRenderedState.moves.length > 0) || lastRenderedState.premoveMove)) {
      drawAllVisuals(lastRenderedState);
      if (newOut) {
        const board = getBoardElement();
        const isFlipped = board ? isBoardFlipped(board) : false;
        if (lastRenderedState.moves && lastRenderedState.moves.length > 0) {
          let text = formatMovesLog(lastRenderedState.moves, lastRenderedState.activeTurn, isFlipped);
          const myColor = isFlipped ? "b" : "w";
          const isOppTurn = lastRenderedState.activeTurn !== myColor;
          if (amateurModeEnabled && !isOppTurn) {
            text = `${t("amateurModeOn")}\n` + text;
          }
          if (isOppTurn && isPremovesEnabled && lastRenderedState.premoveMove) {
            const pm = lastRenderedState.premoveMove;
            text += `\n${t("premoveLabel")} ${formatMoveArrowText(pm)}`;
          }
          newOut.innerText = text;
        } else if (lastRenderedState.premoveMove) {
          const pm = lastRenderedState.premoveMove;
          const opp = lastRenderedState.oppMove;
          const oppNote = opp ? ` (${t("premoveOnOpp")} ${formatCompactMoveText(opp)})` : "";
          newOut.innerText = `${t("premoveLabel")} ${formatMoveArrowText(pm)}${oppNote}`;
        }
      }
    } else if (newOut) {
      if (!isAutoHintEnabled) {
        newOut.innerText = t("hintsDisabledMsg");
      } else if (oldOutput === oldOppWait) {
        newOut.innerText = t("oppTurnWait");
      } else if (oldOutput === oldOppPremove) {
        newOut.innerText = t("oppTurnPremove");
      } else if (oldOutput === oldNoMoves) {
        newOut.innerText = t("noMovesMsg");
      } else if (oldOutput === oldBoardNotFound) {
        newOut.innerText = t("boardNotFound");
      } else if (oldOutput === oldBoardNotFoundWarn) {
        newOut.innerText = t("boardNotFoundWarn");
      } else if (oldOutput === oldDisabled) {
        newOut.innerText = t("hintsDisabledMsg");
      } else if (oldOutput && oldOutput !== oldReady) {
        newOut.innerText = oldOutput;
      }
    }
  }
}

function createWidget() {
  if (document.getElementById("chess-assistant-widget")) return;

  const arrowModeSectionHtml = IS_MOBILE_BUILD
    ? ""
    : `
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
      `;

  const speedButtonsHtml = IS_MOBILE_BUILD
    ? `
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'bullet' ? 'active' : ''}" data-speed="bullet">${t("bulletNamePhone")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'blitz' ? 'active' : ''}" data-speed="blitz">${t("blitzNamePhone")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'rapid' ? 'active' : ''}" data-speed="rapid">${t("rapidNamePhone")}</button>
      `
    : `
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'bullet' ? 'active' : ''}" data-speed="bullet">${t("bulletName")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'blitz' ? 'active' : ''}" data-speed="blitz">${t("blitzName")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'rapid' ? 'active' : ''}" data-speed="rapid">${t("rapidName")}</button>
          <button type="button" class="btn-speed-pill ${!amateurModeEnabled && speedMode === 'ultra' ? 'active' : ''}" data-speed="ultra">${t("ultraName")}</button>
      `;

  const widget = document.createElement("div");
  widget.id = "chess-assistant-widget";
  widget.innerHTML = `
    <div class="widget-drag-handle" title="${t("dragHandleTip")}"></div>
    <div class="widget-header">
      <h3>
        <span>${IS_MOBILE_BUILD ? t("titlePhone") : t("title")}</span>
        <span class="badge">${IS_MOBILE_BUILD ? "3650 ELO" : "4050 ELO"}</span>
        <button id="btn-settings-widget" class="btn-settings" title="${t("settingsTitle")}">&#9881;</button>
      </h3>
      <div class="header-controls">
        <button id="btn-minimize-widget" class="btn-minimize" title="${t("minimizeTip")}">${isMinimized ? "+" : "_"}</button>
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

      <!-- Панель настроек -->
      <div id="chess-settings-panel" class="widget-settings-panel" style="display: none;">
        <div class="settings-panel-header">
          <span>${t("settingsTitle")}</span>
          <button id="btn-close-settings" class="btn-panel-close" title="${t("closeTip")}">&#x2715;</button>
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

        ${arrowModeSectionHtml}

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

        <!-- 3. Античит Легит-режимы (Легит 1 и Легит 2) -->
        <div class="setting-item" style="margin-top: 8px;">
          <div class="setting-label-row">
            <span>${t("amateurModeLabel")}</span>
          </div>
          <div class="style-buttons-row" style="flex-direction: column; gap: 4px;">
            <button type="button" class="btn-style-pill btn-legit-pill ${amateurMode === 'legit1' ? 'active' : ''}" data-legit="legit1" title="${t("legit1Tip")}">
              <span><b>${t("legit1Title")}</b></span>
              <span style="opacity: 0.85; font-size: 9px;">${t("legit1Desc")}</span>
            </button>
            <button type="button" class="btn-style-pill btn-legit-pill ${amateurMode === 'legit2' ? 'active' : ''}" data-legit="legit2" title="${t("legit2Tip")}">
              <span><b>${t("legit2Title")}</b></span>
              <span style="opacity: 0.85; font-size: 9px;">${t("legit2Desc")}</span>
            </button>
          </div>
        </div>

        <!-- 4. Время раздумий (мышление) Легит-режима -->
        <div class="setting-item" style="margin-top: 8px;">
          <div class="setting-label-row">
            <span>${t("legitDelayLabel")}</span>
          </div>
          <div class="legit-delay-row">
            <button type="button" class="btn-style-pill btn-delay-pill ${legitDelay === '50' ? 'active' : ''}" data-delay="50" title="${t("delayPrefix")} 50 ${t("unitMs")}">50 ${t("unitMs")}</button>
            <button type="button" class="btn-style-pill btn-delay-pill ${legitDelay === '250' ? 'active' : ''}" data-delay="250" title="${t("delayPrefix")} 250 ${t("unitMs")}">250 ${t("unitMs")}</button>
            <button type="button" class="btn-style-pill btn-delay-pill ${legitDelay === '500' ? 'active' : ''}" data-delay="500" title="${t("delayPrefix")} 500 ${t("unitMs")}">500 ${t("unitMs")}</button>
            <button type="button" class="btn-style-pill btn-delay-pill ${legitDelay === '1000' ? 'active' : ''}" data-delay="1000" title="${t("delayPrefix")} 1 ${t("unitSec")}">1 ${t("unitSec")}</button>
            <button type="button" class="btn-style-pill btn-delay-pill ${legitDelay === '2000' ? 'active' : ''}" data-delay="2000" title="${t("delayPrefix")} 2 ${t("unitSec")}">2 ${t("unitSec")}</button>
            <button type="button" class="btn-style-pill btn-delay-pill ${legitDelay === '3000' ? 'active' : ''}" data-delay="3000" title="${t("delayPrefix")} 3 ${t("unitSec")}">3 ${t("unitSec")}</button>
            <button type="button" class="btn-style-pill btn-delay-pill ${legitDelay === '5000' ? 'active' : ''}" data-delay="5000" title="${t("delayPrefix")} 5 ${t("unitSec")}">5 ${t("unitSec")}</button>
          </div>
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
          ${speedButtonsHtml}
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

      <label class="chess-toggle-label">
        <input type="checkbox" id="chess-premoves-toggle" ${isPremovesEnabled ? "checked" : ""} />
        <span>${t("premovesLabel")}</span>
      </label>

      <div class="chess-controls-group">
        <div class="chess-row">
          <button id="btn-refresh-hints" class="primary" title="${t("refreshTip")}">
            ${t("refreshBtn")}
          </button>
          <button id="btn-toggle-hints" class="btn-toggle-hints ${isAutoHintEnabled ? "" : "hints-off"}" title="${t("toggleTip")}">
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
          <div>download:</div>
          <div><a href="https://bygemini.chess-assistants.workers.dev/" target="_blank" rel="noopener noreferrer">bygemini.chess-assistants.workers.dev</a></div>
        </div>
      </div>
    </div>

    <!-- Угловые зоны для удобного перетаскивания открытого меню (вне прокручиваемого тела) -->
    <div class="widget-corner-grip bl" title="${t("cornerGripTip")}"></div>
    <div class="widget-corner-grip br" title="${t("cornerGripTip")}"></div>
  `;

  const savedR = safeGetStorage("chess_widget_pos_r");
  const savedB = safeGetStorage("chess_widget_pos_b");
  if (savedR && savedB) {
    widget.style.setProperty("right", savedR, "important");
    widget.style.setProperty("bottom", savedB, "important");
    widget.style.setProperty("left", "auto", "important");
    widget.style.setProperty("top", "auto", "important");
  }

  document.body.appendChild(widget);

  const minBtn = document.getElementById("btn-minimize-widget");
  if (isMinimized) {
    widget.classList.add("minimized");
    if (minBtn) minBtn.innerText = "+";
  }

  if (savedR && savedB) {
    requestAnimationFrame(() => {
      clampWidgetPosition();
    });
  }

  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (hasWidgetDragged || expandedOnPointerUp) {
      expandedOnPointerUp = false;
      return;
    }
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
      return;
    }
    if (isMinimized) {
      isMinimized = false;
      widget.classList.remove("minimized");
      minBtn.innerText = "_";
      requestAnimationFrame(() => {
        clampWidgetPosition();
      });
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
    if (isHidden) {
      requestAnimationFrame(() => {
        clampWidgetPosition();
      });
    }
  });

  closeSettingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsPanel.style.display = "none";
  });

  widget.querySelectorAll(".chess-watermark a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  widget.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const lang = btn.getAttribute("data-lang");
      setLanguage(lang);
    });
  });

  widget.querySelectorAll("[data-platform]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = btn.getAttribute("data-platform");
      setPlatform(p);
    });
  });

  widget.querySelectorAll("[data-arrow-mode]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute("data-arrow-mode");
      arrowMode = (mode === "multi5" || mode === "multi1") ? mode : "multi3";
      safeSetStorage("chess_arrow_mode", arrowMode);

      widget.querySelectorAll("[data-arrow-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      ++currentRequestId;
      clearTimeout(followUpCheckTimer);
      clearOverlay();
      lastRenderedState = null;
      const targetPV = amateurModeEnabled ? 5 : (arrowMode === "multi5" ? 5 : (arrowMode === "multi1" ? 1 : 3));
      extApi.runtime.sendMessage({ type: "SET_MULTIPV", multiPV: targetPV }, () => {
        if (extApi.runtime && extApi.runtime.lastError) { /* silent */ }
      });
      lastAnalyzedFEN = "";
      requestBestMoves();
    });
  });

  widget.querySelectorAll("[data-legit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const chosen = btn.getAttribute("data-legit");
      if (amateurMode === chosen) {
        amateurMode = "off";
        amateurModeEnabled = false;
        safeSetStorage("chess_amateur_mode", "off");
        widget.querySelectorAll("[data-legit]").forEach((b) => b.classList.remove("active"));
        widget.querySelectorAll("[data-speed]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-speed") === speedMode);
        });
      } else {
        amateurMode = chosen;
        amateurModeEnabled = true;
        safeSetStorage("chess_amateur_mode", amateurMode);
        widget.querySelectorAll("[data-legit]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-legit") === amateurMode);
        });
        widget.querySelectorAll("[data-speed]").forEach((b) => b.classList.remove("active"));
      }

      ++currentRequestId;
      clearTimeout(followUpCheckTimer);
      clearOverlay();
      lastRenderedState = null;
      lastAnalyzedFEN = "";
      requestBestMoves();
    });
  });

  widget.querySelectorAll("[data-delay]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const val = btn.getAttribute("data-delay");
      if (val) {
        legitDelay = val;
        safeSetStorage("chess_legit_delay", legitDelay);
        widget.querySelectorAll("[data-delay]").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-delay") === legitDelay);
        });
      }
    });
  });

  widget.querySelectorAll("[data-marker]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      markerShape = btn.getAttribute("data-marker");
      safeSetStorage("chess_marker_shape", markerShape);

      widget.querySelectorAll("[data-marker]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      if (lastRenderedState) {
        drawAllVisuals(lastRenderedState);
      }
    });
  });

  widget.querySelectorAll("[data-speed]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute("data-speed");
      if (SPEED_MODES[mode]) {
        speedMode = mode;
        safeSetStorage("chess_speed_mode", speedMode);

        if (amateurModeEnabled) {
          amateurMode = "off";
          amateurModeEnabled = false;
          safeSetStorage("chess_amateur_mode", "off");
          widget.querySelectorAll("[data-legit]").forEach((b) => b.classList.remove("active"));
        }

        widget.querySelectorAll("[data-speed]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        ++currentRequestId;
        clearTimeout(followUpCheckTimer);
        clearOverlay();
        lastRenderedState = null;
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
    ++currentRequestId;
    clearTimeout(followUpCheckTimer);
    clearOverlay();
    lastRenderedState = null;
    lastAnalyzedFEN = "";
    clearTimeout(debounceTimer);
    resetGameTracking();

    if (!isAutoHintEnabled) {
      if (out) out.innerText = t("hintsDisabledMsg");
      return;
    }

    if (!board || !parseBoardToFEN(board)) {
      if (out) out.innerText = t("boardNotFoundWarn");
      return;
    }

    if (isInteractingWithBoard(board)) {
      if (out) out.innerText = t("readyMsg");
      return;
    }

    if (out) out.innerText = t("refreshingMsg");
    requestBestMoves();
  }

  function toggleHints() {
    isAutoHintEnabled = !isAutoHintEnabled;
    safeSetStorage("chess_auto_hints_enabled", isAutoHintEnabled ? "true" : "false");
    updateToggleHintsUI();
    const out = document.getElementById("chess-assistant-output");
    ++currentRequestId;
    clearTimeout(followUpCheckTimer);
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

  if (refreshHintsBtn) {
    refreshHintsBtn.addEventListener("click", refreshHints);
  }

  if (toggleHintsBtn) {
    toggleHintsBtn.addEventListener("click", toggleHints);
  }

  if (autoToggle) {
    autoToggle.addEventListener("change", (e) => {
      isAutoHintEnabled = e.target.checked;
      safeSetStorage("chess_auto_hints_enabled", isAutoHintEnabled ? "true" : "false");
      updateToggleHintsUI();
      ++currentRequestId;
      clearTimeout(followUpCheckTimer);
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
      safeSetStorage("chess_only_my_turn", isOnlyMyTurnEnabled ? "true" : "false");
      ++currentRequestId;
      clearTimeout(followUpCheckTimer);
      clearOverlay();
      lastRenderedState = null;
      lastAnalyzedFEN = "";
      requestBestMoves();
    });
  }

  const premovesToggle = document.getElementById("chess-premoves-toggle");
  if (premovesToggle) {
    premovesToggle.addEventListener("change", (e) => {
      isPremovesEnabled = e.target.checked;
      safeSetStorage("chess_premoves_enabled", isPremovesEnabled ? "true" : "false");
      ++currentRequestId;
      clearTimeout(followUpCheckTimer);
      lastAnalyzedFEN = "";
      if (!isPremovesEnabled) {
        clearOverlay();
        lastRenderedState = null;
        const out = document.getElementById("chess-assistant-output");
        if (out) out.innerText = isAutoHintEnabled ? t("readyMsg") : t("hintsDisabledMsg");
      }
      requestBestMoves();
    });
  }

  setupBoardObserver();
}

// ==========================================
// 8. Инициализация событий окна
// ==========================================
if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("resize", handleResizeOrOrientation);
  window.addEventListener("orientationchange", () => {
    setTimeout(handleResizeOrOrientation, 100);
    setTimeout(handleResizeOrOrientation, 300);
  });
  if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
    window.screen.orientation.addEventListener("change", () => {
      setTimeout(handleResizeOrOrientation, 100);
      setTimeout(handleResizeOrOrientation, 300);
    });
  }

  window.addEventListener("mousemove", (e) => {
    if (isWidgetDragging) onDragMove(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => {
    if (isWidgetDragging) onDragEnd();
  });
  window.addEventListener("touchmove", (e) => {
    if (isWidgetDragging && e.touches.length === 1) {
      if (e.cancelable) e.preventDefault();
      onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: false });
  window.addEventListener("touchend", () => {
    if (isWidgetDragging) onDragEnd();
  }, { passive: true });
  window.addEventListener("touchcancel", () => {
    if (isWidgetDragging) onDragEnd(true);
  }, { passive: true });
  window.addEventListener("blur", () => {
    if (isWidgetDragging) onDragEnd(true);
    handleBoardInteractionEnd();
  });

  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const board = getBoardElement();
    if (board && e.target && (board.contains(e.target) || (e.target.closest && e.target.closest("wc-chess-board, chess-board, cg-board, .cg-wrap")))) {
      isUserInteractingWithBoard = true;
    }
  }, { capture: true, passive: true });

  window.addEventListener("pointerup", handleBoardInteractionEnd, { capture: true, passive: true });
  window.addEventListener("pointercancel", handleBoardInteractionEnd, { capture: true, passive: true });
  window.addEventListener("contextmenu", handleBoardInteractionEnd, { capture: true, passive: true });
  window.addEventListener("touchend", handleBoardInteractionEnd, { capture: true, passive: true });

  if (typeof extApi !== "undefined" && extApi.runtime && extApi.runtime.onMessage) {
    extApi.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === "TOGGLE_WIDGET") {
        toggleWidgetMinimize();
        sendResponse({ ok: true, isMinimized });
        return true;
      }
    });
  }

  setInterval(() => {
    createWidget();
    setupBoardObserver();
    if (isAutoHintEnabled) {
      const b = getBoardElement();
      if (b && !isInteractingWithBoard(b) && !isBoardAnimating(b)) {
        const fen = parseBoardToFEN(b);
        if (fen && fen !== lastAnalyzedFEN) {
          requestBestMoves();
        }
      }
    }
  }, 1500);

  setTimeout(() => {
    createWidget();
    setupBoardObserver();
  }, 800);
}
