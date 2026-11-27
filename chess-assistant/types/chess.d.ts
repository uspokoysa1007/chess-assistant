/**
 * ♟️ Chess Assistant v2.5 — TypeScript Описания Типов (Type Definitions)
 *
 * Этот файл описывает структуры данных, которые используются
 * в скриптах расширения (content.js и background.js).
 */

/** Клетка шахматной доски в алгебраической нотации (например, 'e2', 'e4', 'a1') */
export type ChessSquare = string;

/** Поддерживаемые шахматные площадки */
export type PlatformId = "chesscom" | "lichess";

/** Режим отображения стрелок на доске */
export type ArrowMode = "multi1" | "multi3" | "multi5";

/** Стиль меток на целевых клетках */
export type MarkerShape = "square" | "circle" | "none";

/** Контроль времени и скорость расчёта движка */
export type SpeedMode = "bullet" | "blitz" | "rapid" | "ultra";

/** Режим легитной игры (античит): выкл, легит 1 (~1750 ELO), легит 2 (~1350 ELO) */
export type AmateurMode = "off" | "legit1" | "legit2";

/** Время мышления легит-режима в миллисекундах */
export type LegitDelay = "50" | "250" | "500" | "1000" | "2000" | "3000" | "5000";

/** Оценка позиции от Stockfish (со стороны игрока на очереди хода или нормализованная к белым) */
export interface EvaluationScore {
  /** 'cp' — перевес в сантипешках (100 = 1 пешка), 'mate' — мат в N ходов */
  type: "cp" | "mate";
  /** Значение: для cp например +150 (+1.5 пешки), для mate например 3 */
  value: number;
}

/** Информация об одном рассчитанном варианте от Stockfish */
export interface MoveCandidate {
  /** Ход в формате UCI (например, "e2e4", "g1f3", "e7e8q") */
  move: string;
  /** Оценка позиции после данного хода */
  score: EvaluationScore | null;
  /** Ожидаемый ответный ход (премув / ponder) */
  ponder: string | null;
}

/** Ответ background.js на запрос анализа позиции */
export interface AnalysisResponse {
  cancelled: boolean;
  timedOut?: boolean;
  moves: MoveCandidate[];
  ponderMove: string | null;
  bestMove: string | null;
  bestScore: EvaluationScore | null;
}

/** Состояние для отрисовки графики на Canvas */
export interface VisualsState {
  moves: MoveCandidate[];
  premoveMove?: string | null;
  activeTurn?: "w" | "b";
  oppMove?: string | null;
}

/** Запрос анализа позиции от content.js к background.js */
export interface AnalyzePositionMessage {
  type: "ANALYZE_POSITION";
  fen: string;
  uciBaseFen?: string | null;
  uciMoves?: string[] | null;
  depth?: number | null;
  movetime?: number | null;
  multiPV?: number;
}

/** Изменение количества линий MultiPV в фоне */
export interface SetMultiPVMessage {
  type: "SET_MULTIPV";
  multiPV: number;
}

/** Переключение свёрнутого состояния виджета при клике по иконке расширения */
export interface ToggleWidgetMessage {
  type: "TOGGLE_WIDGET";
}

/** Сообщения обмена между content.js и background.js */
export type ExtensionMessage =
  | AnalyzePositionMessage
  | SetMultiPVMessage
  | ToggleWidgetMessage;
