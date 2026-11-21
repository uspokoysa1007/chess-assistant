/**
 * ♟️ Chess Assistant - TypeScript Описания Типов (Type Definitions)
 * 
 * Этот файл описывает структуры данных, которые используются
 * в скриптах расширения (content.js, background.js).
 * 
 * Благодаря этому файлу редактор кода понимает, какие свойства
 * есть у ходов, движка и визуальных стрелок, и даёт умные подсказки!
 */

/** Клетка шахматной доски (например, 'e2', 'e4', 'a1') */
export type ChessSquare = string;

/** Режим отображения стрелок на доске */
export type ArrowMode = "single" | "multi3" | "multi5";

/** Стиль меток на целевых клетках */
export type MarkerStyle = "square" | "circle" | "none";

/** Контроль времени и скорость расчёта движка */
export type SpeedMode = "bullet" | "blitz" | "rapid" | "ultra";

/** Оценка позиции от Stockfish */
export interface EvaluationScore {
  /** 'cp' - пешечный перевес в сантипешках (100 = 1 пешка), 'mate' - мат в N ходов */
  type: "cp" | "mate";
  /** Значение: если cp, то например +150 (перевес 1.5 пешки), если mate, то например 3 */
  value: number;
}

/** Информация об одном рассчитанном ходе от Stockfish */
export interface ChessMoveAnalysis {
  /** Ход в формате UCI (например, "e2e4", "g1f3", "e7e8q") */
  move: string;
  /** Текстовая или числовая оценка хода (например, "+1.2" или score-объект) */
  score?: number | string;
  /** Порядковый номер варианта (0 - лучший ход, 1 - второй и т.д.) */
  rankIndex?: number;
  /** Основная линия (вариант развития партии) */
  pv?: string[];
}

/** Состояние для отрисовки графики на Canvas */
export interface VisualsState {
  /** Список ходов для рисования стрелок */
  moves: ChessMoveAnalysis[];
  /** Ход соперника для премува (если есть) */
  premoveMove?: string | null;
}

/** Сообщение для общения между content.js и background.js */
export interface ExtensionMessage {
  action: "START_ANALYSIS" | "STOP_ANALYSIS" | "UPDATE_SETTINGS" | "EVAL_RESULT";
  fen?: string;
  speedMode?: SpeedMode;
  arrowMode?: ArrowMode;
  payload?: any;
}
