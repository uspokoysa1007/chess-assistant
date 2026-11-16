// content.js - Шахматный Помощник (Chess.com & Lichess Edition)
// Поддержка MultiPV (3 и 5 стрелок), фоновый премув, адаптеры платформ, SVG в Base64

const extApi = typeof browser !== "undefined" ? browser : chrome;
console.log("♟️ [Content Script] Шахматный Помощник загружен (Chess.com & Lichess)!");

// Base64 иконка пешки (защита от отдельного файла в папке)
const PAWN_ICON_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCIgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9InBhd25HcmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI2ZmZmZmZiIvPjxzdG9wIG9mZnNldD0iNTAlIiBzdG9wLWNvbG9yPSIjZTJlOGYwIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjY2JkNWUxIi8+PC9saW5lYXJHcmFkaWVudD48ZmlsdGVyIGlkPSJwYXduR2xvdyIgeD0iLTIwJSIgeT0iLTIwJSIgd2lkdGg9IjE0MCUiIGhlaWdodD0iMTQwJSI+PGZlRHJvcFNoYWRvdyBkeD0iMCIgZHk9IjEuNSIgc3RkRGV2aWF0aW9uPSIxLjUiIGZsb29kLWNvbG9yPSIjMDAwMDAwIiBmbG9vZC1vcGFjaXR5PSIwLjQ1Ii8+PC9maWx0ZXI+PC9kZWZzPjxnIGZpbHRlcj0idXJsKCNwYXduR2xvdykiPjxwYXRoIGQ9Ik0gMTIgNDEgQyAxMiAzOS41LCAzNiAzOS41LCAzNiA0MSBMIDM3IDQzLjUgQyAzNyA0NC41LCAxMSA0NC41LCAxMSA0My41IFoiIGZpbGw9InVybCgjcGF3bkdyYWQpIiBzdHJva2U9IiMzMzQxNTUiIHN0cm9rZS13aWR0aD0iMS42IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTSAxNC41IDM2LjUgQyAxNC41IDM1LjUsIDMzLjUgMzUuNSwgMzMuNSAzNi41IEwgMzUgMzkuNSBDIDM1IDQwLjUsIDEzIDQwLjUsIDEzIDM5LjUgWiIgZpbGw9InVybCgjcGF3bkdyYWQpIiBzdHJva2U9IiMzMzQxNTUiIHN0cm9rZS13aWR0aD0iMS42IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTSAyMC41IDE5LjUgQyAyMS41IDI0LjUsIDE2LjUgMjguNSwgMTYgMzUuNSBDIDE2IDM2LjUsIDMyIDM2LjUsIDMyIDM1LjUgQyAzMS41IDI4LjUsIDI2LjUgMjQuNSwgMjcuNSAxOS41IFoiIGZpbGw9InVybCgjcGF3bkdyYWQpIiBzdHJva2U9IiMzMzQxNTUiIHN0cm9rZS13aWR0aD0iMS42IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PGVsbGlwc2UgY3g9IjI0IiBjeT0iMTguNSIgcng9IjUuNSIgcnk9IjEuOCIgZmlsbD0idXJsKCNwYXduR2xvdykiIHN0cm9rZT0iIzMzNDE1NSIgc3Ryb2tlLXdpZHRoPSIxLjYiLz48Y2lyY2xlIGN4PSIyNCIgY3k9IjExLjUiIHI9IjYiIGZpbGw9InVybCgjcGF3bkdyYWQpIiBzdHJva2U9IiMzMzQxNTUiIHN0cm9rZS13aWR0aD0iMS42Ii8+PGVsbGlwc2UgY3g9IjIyLjIiIGN5PSI5LjgiIHJ4PSIyIiByeT0iMS40IiBmaWxsPSIjZmZmZmZmIiBvcGFjaXR5PSIwLjc1Ii8+PC9nPjwvc3ZnPg==";

let boardObserver = null;
let currentObservedBoard = null;
let isAutoHintEnabled = true;
let isOnlyMyTurnEnabled = true;
let isMinimized = false;
let debounceTimer = null;
let lastAnalyzedFEN = "";
let lastBoardFlipped = null;
let hasOverlayDrawings = false;
let lastRenderedState = null;

// Настройки режимов (сохраняются в localStorage)
let arrowMode = localStorage.getItem("chess_arrow_mode") || "multi3"; // "multi3" | "multi5"
let markerShape = localStorage.getItem("chess_marker_shape") || "square"; // "square" | "circle" | "none"
let speedMode = localStorage.getItem("chess_speed_mode") || "bullet"; // "bullet" | "blitz" | "rapid" | "ultra"

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
    isDraggingOrSelecting(board) {
      return this.isInteracting(board);
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
    isDraggingOrSelecting(board) {
      return this.isInteracting(board);
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
  if (adapter.isDragging) return adapter.isDragging(board || getBoardElement());
  return adapter.isDraggingOrSelecting(board || getBoardElement());
}
function isDraggingOrSelecting(board) {
  return isDragging(board);
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
    out.innerText = `🔄 Переключено на ${Adapters[currentPlatform].name}. Поиск доски...`;
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
      multiPV: cfg.multiPV || (arrowMode === "multi5" ? 5 : 3)
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

function removeOldSideEvalBar() {
  const old = document.getElementById("chess-eval-bar-wrapper");
  if (old) old.remove();
}

function getAdvantageText(score, activeTurn, isFlipped) {
  if (!score) return "⚖️ Равная позиция";
  let cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
  const whiteCp = activeTurn === "w" ? cp : -cp;
  const myColor = isFlipped ? "b" : "w";

  if (Math.abs(whiteCp) <= 25) {
    return "⚖️ Примерно равная позиция";
  }

  const leaderColor = whiteCp > 0 ? "белых" : "чёрных";
  const isMine = (myColor === "w" && whiteCp > 0) || (myColor === "b" && whiteCp < 0);
  const who = isMine ? "(в твою пользу! 🎉)" : "(в пользу соперника ⚠️)";
  return `Преимущество ${leaderColor} ${who}`;
}

function updateEvalBar(score, activeTurn) {
  removeOldSideEvalBar();
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

  const scoreText = formatScore(score);
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
  removeOldSideEvalBar();
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

let isUserInteractingWithBoard = false;

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
    if (output) output.innerText = "❌ Доска не найдена. Открой партию!";
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
    if (output) output.innerText = "⏳ Ход соперника... Считаю премув (до 2с) 🟢💭";
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

  const cfg = SPEED_MODES[speedMode] || SPEED_MODES.bullet;
  const turnName = activeTurn === "w" ? "белых" : "чёрных";
  if (output) {
    if (speedMode === "ultra") {
      output.innerText = `👑 Ультра-режим: глубокий расчёт до 26 ходов (${turnName}, ~7 сек)... 🧠⏳`;
    } else {
      output.innerText = `🔮 ${cfg.name} ищет ход (${turnName})... ⚡💭`;
    }
  }

  const res = await requestMovesFromBackground(fen, {
    ...cfg,
    multiPV: arrowMode === "multi5" ? 5 : 3
  });
  onAnalysisReceived(res, fen, isOpponentTurn);
}

function formatMovesLog(moves, activeTurn, isFlipped) {
  const myColor = isFlipped ? "b" : "w";
  const who = (score) => {
    if (!score) return "";
    const cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
    const whiteCp = activeTurn === "w" ? cp : -cp;
    const isMine = (myColor === "w" && whiteCp > 0) || (myColor === "b" && whiteCp < 0);
    return isMine ? "в твою пользу" : "в пользу соперника";
  };

  if (arrowMode === "multi5") {
    return moves.slice(0, 5).map((m, i) => {
      const s = formatScore(m.score, "#M");
      const scorePart = s ? ` [${s} • ${who(m.score)}]` : "";
      return `#${i + 1}: ${m.move.slice(0, 2).toUpperCase()} ➔ ${m.move.slice(2, 4).toUpperCase()}${scorePart}`;
    }).join("\n");
  }

  const labels = ["⬛ 1-й", "◻️ 2-й", "▫️ 3-й"];
  return moves.slice(0, 3).map((m, i) => {
    const s = formatScore(m.score, "M");
    const scorePart = s ? ` [${s} • ${who(m.score)}]` : "";
    return `${labels[i]}: ${m.move.slice(0, 2).toUpperCase()} ➔ ${m.move.slice(2, 4).toUpperCase()}${scorePart}`;
  }).join("\n");
}

function onAnalysisReceived(res, fen, isOpponentTurn) {
  if (!res || res.cancelled) return;

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

  if (isOpponentTurn && isOnlyMyTurnEnabled) {
    if (res.ponderMove) {
      updateEvalBar(bestScore, activeTurn);
      drawAllVisuals({ moves: [], premoveMove: res.ponderMove });
      if (output) {
        const pm = res.ponderMove;
        const opp = res.bestMove;
        const oppNote = opp ? ` (на ${opp.slice(0, 2).toUpperCase()}➔${opp.slice(2, 4).toUpperCase()})` : "";
        output.innerText = `🟢 Премув: ${pm.slice(0, 2).toUpperCase()} ➔ ${pm.slice(2, 4).toUpperCase()}${oppNote}`;
      }
    } else {
      clearOverlay();
      if (output) output.innerText = "⏳ Ход соперника... Ожидаем ответ ☕";
    }
    return;
  }

  if (moves.length === 0) {
    if (output) output.innerText = "⚠️ Ходы не найдены или партия завершена.";
    clearOverlay();
    return;
  }

  updateEvalBar(bestScore, activeTurn);
  drawAllVisuals({
    moves,
    premoveMove: isOpponentTurn ? res.ponderMove : null
  });

  if (output) {
    let text = formatMovesLog(moves, activeTurn, isFlipped);
    if (isOpponentTurn && res.ponderMove) {
      const pm = res.ponderMove;
      text += `\n🟢 Премув: ${pm.slice(0, 2).toUpperCase()} ➔ ${pm.slice(2, 4).toUpperCase()}`;
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
    <div class="widget-header">
      <h3>
        <span>♟️ Stockfish 19</span>
        <span class="badge">🔥 4050 ELO</span>
        <button id="btn-settings-widget" class="btn-settings" title="Настройки ⚙️">⚙️</button>
      </h3>
      <div class="header-controls">
        <button id="btn-minimize-widget" class="btn-minimize" title="Свернуть / Развернуть">_</button>
      </div>
    </div>

    <div class="widget-body">
      <!-- Переключатель платформы (Chess.com / Lichess) -->
      <div class="platform-switch-row">
        <button type="button" class="btn-platform-pill ${currentPlatform === 'chesscom' ? 'active' : ''}" data-platform="chesscom" title="Переключить на Chess.com">
          ♟️ Chess.com
        </button>
        <button type="button" class="btn-platform-pill ${currentPlatform === 'lichess' ? 'active' : ''}" data-platform="lichess" title="Переключить на Lichess">
          ♞ Lichess
        </button>
      </div>

      <!-- Панель настроек (скрыта по умолчанию, открывается по кнопке ⚙️) -->
      <div id="chess-settings-panel" class="widget-settings-panel" style="display: none;">
        <div class="settings-panel-header">
          <span>⚙️ Настройки</span>
          <button id="btn-close-settings" class="btn-panel-close" title="Закрыть настройки">✕</button>
        </div>

        <!-- 1. Режим стрелок (MultiPV 3 / MultiPV 5) -->
        <div class="setting-item">
          <div class="setting-label-row">
            <span>🏹 Режим стрелок:</span>
          </div>
          <div class="arrow-mode-column">
            <button type="button" class="btn-style-pill arrow-mode-btn ${arrowMode === 'multi3' ? 'active' : ''}" data-arrow-mode="multi3">
              3 стрелки (чёрная / серая / белая)
            </button>
            <button type="button" class="btn-style-pill arrow-mode-btn ${arrowMode === 'multi5' ? 'active' : ''}" data-arrow-mode="multi5">
              5 чёрных стрелок с бейджами (MultiPV 5)
            </button>
          </div>
        </div>

        <!-- 2. Форма меток клеток (квадрат / круг / только стрелка) -->
        <div class="setting-item" style="margin-top: 6px;">
          <div class="setting-label-row">
            <span>🎯 Стиль меток на клетках:</span>
          </div>
          <div class="style-buttons-row">
            <button type="button" class="btn-style-pill ${markerShape === 'square' ? 'active' : ''}" data-marker="square">⏹️ Квадрат</button>
            <button type="button" class="btn-style-pill ${markerShape === 'circle' ? 'active' : ''}" data-marker="circle">⏺️ Круг</button>
            <button type="button" class="btn-style-pill ${markerShape === 'none' ? 'active' : ''}" data-marker="none">🏹 Только стрелка</button>
          </div>
        </div>
      </div>

      <!-- Мини-полоска преимущества внутри виджета -->
      <div class="widget-eval-row">
        <div class="widget-eval-bar-line">
          <span class="widget-eval-title">📊 Оценка:</span>
          <div class="widget-eval-track">
            <div class="widget-eval-fill"></div>
          </div>
          <span class="widget-eval-score">0.0</span>
        </div>
        <div class="widget-eval-desc">⚖️ Равная позиция</div>
      </div>

      <!-- Переключатель режима скорости (Пуля 150мс / Блиц / Рапид / Ультра 7с) -->
      <div class="speed-modes-container">
        <div class="speed-modes-grid">
          <button type="button" class="btn-speed-pill ${speedMode === 'bullet' ? 'active' : ''}" data-speed="bullet" title="Супер-быстро для пули (лимит 150 мс)">⚡ Пуля (150мс)</button>
          <button type="button" class="btn-speed-pill ${speedMode === 'blitz' ? 'active' : ''}" data-speed="blitz" title="Быстро для блица (~0.5 сек)">🎯 Блиц (~0.5с)</button>
          <button type="button" class="btn-speed-pill ${speedMode === 'rapid' ? 'active' : ''}" data-speed="rapid" title="Глубокий анализ для рапида (глубина 14)">🧠 Рапид</button>
          <button type="button" class="btn-speed-pill ${speedMode === 'ultra' ? 'active' : ''}" data-speed="ultra" title="Максимальный просчёт Stockfish 19: 7 секунд на ход, глубина до 26 ходов!">👑 Ультра (7с • 26х)</button>
        </div>
      </div>

      <label class="chess-toggle-label">
        <input type="checkbox" id="chess-auto-toggle" checked />
        <span>🏹 Стрелки после каждого хода ✨</span>
      </label>

      <label class="chess-toggle-label">
        <input type="checkbox" id="chess-my-turn-toggle" checked />
        <span>🎯 Стрелки только для моего хода ♟️</span>
      </label>

      <div class="chess-controls-group">
        <div class="chess-row">
          <button id="btn-refresh-hints" class="primary" title="Заново пересчитать позицию на доске при баге или невозможном ходе">
            🔄 Обновить
          </button>
          <button id="btn-toggle-hints" class="btn-toggle-hints" title="Включить или выключить подсказки">
            ⏸️ Отключить
          </button>
        </div>
      </div>

      <div id="chess-assistant-output">🚀 Готов к игре! Сделай ход или нажми кнопку 🎮✨</div>
    </div>
  `;

  document.body.appendChild(widget);

  const minBtn = document.getElementById("btn-minimize-widget");
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWidgetMinimize();
  });

  // Поддержка перетаскивания (мышь + сенсор)
  let startX = 0, startY = 0, startRight = 14, startBottom = 12;
  let isDragging = false, hasDragged = false;

  function onDragStart(clientX, clientY, target) {
    if (!isMinimized && !target.closest(".widget-header")) return;
    startX = clientX;
    startY = clientY;
    const rect = widget.getBoundingClientRect();
    startRight = window.innerWidth - rect.right;
    startBottom = window.innerHeight - rect.bottom;
    isDragging = true;
    hasDragged = false;
  }

  function onDragMove(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    if (Math.hypot(dx, dy) > 5) {
      hasDragged = true;
      const newRight = Math.max(4, Math.min(window.innerWidth - widget.offsetWidth - 4, startRight - dx));
      const newBottom = Math.max(4, Math.min(window.innerHeight - widget.offsetHeight - 4, startBottom - dy));
      widget.style.right = `${newRight}px`;
      widget.style.bottom = `${newBottom}px`;
      widget.style.left = "auto";
      widget.style.top = "auto";
    }
  }

  function onDragEnd() {
    isDragging = false;
  }

  widget.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    onDragStart(e.clientX, e.clientY, e.target);
  });
  window.addEventListener("mousemove", (e) => {
    if (isDragging) onDragMove(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => {
    if (isDragging) onDragEnd();
  });

  widget.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      onDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
    }
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (isDragging && e.touches.length === 1) {
      onDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });
  window.addEventListener("touchend", () => {
    if (isDragging) onDragEnd();
  }, { passive: true });

  widget.addEventListener("click", () => {
    if (hasDragged) {
      hasDragged = false;
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

  // Переключатель платформы (Chess.com / Lichess)
  widget.querySelectorAll("[data-platform]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = btn.getAttribute("data-platform");
      setPlatform(p);
    });
  });

  // Переключение режима стрелок (MultiPV 3 / MultiPV 5)
  widget.querySelectorAll("[data-arrow-mode]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const mode = btn.getAttribute("data-arrow-mode");
      arrowMode = mode === "multi5" ? "multi5" : "multi3";
      localStorage.setItem("chess_arrow_mode", arrowMode);

      widget.querySelectorAll("[data-arrow-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      clearOverlay();
      extApi.runtime.sendMessage({ type: "SET_MULTIPV", multiPV: arrowMode === "multi5" ? 5 : 3 });
      lastAnalyzedFEN = "";
      requestBestMoves();
    });
  });

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
    if (toggleHintsBtn) {
      if (isAutoHintEnabled) {
        toggleHintsBtn.innerText = "⏸️ Отключить";
        toggleHintsBtn.classList.remove("hints-off");
      } else {
        toggleHintsBtn.innerText = "▶️ Включить";
        toggleHintsBtn.classList.add("hints-off");
      }
    }
    if (autoToggle) {
      autoToggle.checked = isAutoHintEnabled;
    }
  }

  if (refreshHintsBtn) {
    refreshHintsBtn.addEventListener("click", () => {
      const board = getBoardElement();
      const out = document.getElementById("chess-assistant-output");
      clearOverlay();
      lastRenderedState = null;
      lastAnalyzedFEN = "";
      clearTimeout(debounceTimer);
      resetGameTracking();

      if (!board) {
        if (out) out.innerText = "⚠️ Шахматная доска не найдена!";
        return;
      }

      if (out) out.innerText = "🔄 Обновление позиции и пересчёт...";
      requestBestMoves();
    });
  }

  if (toggleHintsBtn) {
    toggleHintsBtn.addEventListener("click", () => {
      isAutoHintEnabled = !isAutoHintEnabled;
      updateToggleHintsUI();
      const out = document.getElementById("chess-assistant-output");
      if (!isAutoHintEnabled) {
        clearTimeout(debounceTimer);
        clearOverlay();
        lastRenderedState = null;
        if (out) out.innerText = "⏸️ Подсказки отключены (стрелки стёрты).";
      } else {
        lastAnalyzedFEN = "";
        if (out) out.innerText = "▶️ Подсказки включены!";
        requestBestMoves();
      }
    });
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
        if (out) out.innerText = "⏸️ Подсказки отключены.";
      } else {
        lastAnalyzedFEN = "";
        requestBestMoves();
      }
    });
  }

  const myTurnToggle = document.getElementById("chess-my-turn-toggle");
  myTurnToggle.addEventListener("change", (e) => {
    isOnlyMyTurnEnabled = e.target.checked;
    lastAnalyzedFEN = "";
    requestBestMoves();
  });

  setupBoardObserver();
}

setInterval(() => {
  createWidget();
  setupBoardObserver();
}, 1500);

setTimeout(() => {
  createWidget();
  setupBoardObserver();
}, 800);
