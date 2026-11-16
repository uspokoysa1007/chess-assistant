/**
 * Скрипт сборки мобильной версии Chess Assistant (Mobile Lightspeed + WASM Turbo)
 * Оптимизирует параметры WebAssembly (WASM), тайминги, память и упаковывает в chess-assistant_phone.xpi
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

global.self = global;

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'chess-assistant');
const PHONE_DIR = path.join(ROOT_DIR, 'chess-assistant_phone');
const XPI_PATH = path.join(PHONE_DIR, 'chess-assistant_phone.xpi');

console.log('⚡ [Phone Build] Сборка ультра-быстрой мобильной версии с WASM-оптимизацией...');

// 1. Очистка и создание структуры
if (fs.existsSync(PHONE_DIR)) {
  fs.rmSync(PHONE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(path.join(PHONE_DIR, 'icons'), { recursive: true });
fs.mkdirSync(path.join(PHONE_DIR, 'background'), { recursive: true });
fs.mkdirSync(path.join(PHONE_DIR, 'content'), { recursive: true });

// 2. Иконка
fs.copyFileSync(path.join(SRC_DIR, 'icons/pawn.svg'), path.join(PHONE_DIR, 'icons/pawn.svg'));

// Функция экранирования и минификации JSON
function escapeAndMinifyJson(obj) {
  const jsonStr = JSON.stringify(obj);
  return jsonStr.replace(/[\u007f-\uffff]/g, (c) => {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

// 3. manifest.json
const manifest = {
  manifest_version: 3,
  name: "Шахматный Помощник (Mobile)",
  version: "2.3",
  description: "Мобильный шахматный плагин со Stockfish 19 WASM Lite",
  permissions: [
    "activeTab"
  ],
  action: {
    default_icon: "icons/pawn.svg",
    default_title: "Шахматный Помощник (Mobile)"
  },
  icons: {
    "48": "icons/pawn.svg",
    "96": "icons/pawn.svg"
  },
  browser_specific_settings: {
    gecko: {
      id: "{f79148d2-5b32-41eb-8903-4e2b056e1875}",
      strict_min_version: "109.0"
    }
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  background: {
    scripts: [
      "background/background.js"
    ]
  },
  content_scripts: [
    {
      matches: [
        "*://*.chess.com/*",
        "*://lichess.org/*",
        "*://*.lichess.org/*"
      ],
      js: [
        "content/content.js"
      ],
      css: [
        "content/overlay.css"
      ],
      run_at: "document_idle"
    }
  ],
  web_accessible_resources: [
    {
      resources: [
        "background/stockfish-19.js",
        "background/stockfish-19.wasm"
      ],
      matches: [
        "*://*.chess.com/*",
        "*://lichess.org/*",
        "*://*.lichess.org/*"
      ]
    }
  ]
};

fs.writeFileSync(path.join(PHONE_DIR, 'manifest.json'), escapeAndMinifyJson(manifest), 'utf8');

// 4. overlay.css (без тяжелых блюров backdrop-filter для плавных 60-120 FPS на мобилках)
let css = fs.readFileSync(path.join(SRC_DIR, 'content/overlay.css'), 'utf8');
css = css.replace(/backdrop-filter:\s*blur\([^)]*\);?/gi, '');
css = css.replace(/-webkit-backdrop-filter:\s*blur\([^)]*\);?/gi, '');
css = css.replace(/background:\s*rgba\(20,\s*16,\s*28,\s*0\.96\);?/gi, 'background: #151020;');

const mobileCssRules = `
/* Позиционирование доски на мобильных (Chess.com) */
wc-chess-board, chess-board, .board-layout-chessboard, #board-single, .board-component {
  position: relative !important;
}

#chess-canvas-overlay {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none !important;
  z-index: 9999 !important;
  background: transparent !important;
  transform: translateZ(0) !important;
  will-change: transform !important;
}

#chess-assistant-widget {
  background: #151020 !important;
  bottom: max(10px, env(safe-area-inset-bottom, 10px)) !important;
  right: max(10px, env(safe-area-inset-right, 10px)) !important;
  width: min(320px, calc(100vw - 20px)) !important;
  max-height: min(75vh, calc(100dvh - 70px)) !important;
  box-sizing: border-box !important;
  padding: 8px 10px !important;
  border-radius: 14px !important;
  touch-action: pan-y !important;
  z-index: 10000000 !important;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7) !important;
}

#chess-assistant-widget.minimized {
  width: auto !important;
  max-width: calc(100vw - 20px) !important;
  padding: 6px 14px !important;
  border-radius: 20px !important;
  cursor: pointer !important;
  touch-action: none !important;
  box-shadow: 0 4px 16px rgba(168, 85, 247, 0.4), 0 2px 8px rgba(0, 0, 0, 0.8) !important;
}

.widget-header {
  touch-action: none !important;
}

.speed-modes-grid {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 4px !important;
}

#chess-assistant-widget button,
.btn-speed-pill,
.btn-style-pill {
  min-height: 36px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 11px !important;
  touch-action: manipulation !important;
  box-sizing: border-box !important;
}

.btn-minimize, .btn-settings, .btn-panel-close {
  min-width: 28px !important;
  min-height: 28px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.chess-toggle-label {
  padding: 5px 0 !important;
  font-size: 11.5px !important;
  touch-action: manipulation !important;
}

.chess-toggle-label input[type="checkbox"] {
  width: 17px !important;
  height: 17px !important;
}
`;

css += '\n' + mobileCssRules;
const cssMin = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>+~])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim();
fs.writeFileSync(path.join(PHONE_DIR, 'content/overlay.css'), cssMin, 'utf8');

// 5. background.js: WASM-оптимизация под мобильные процессоры
let bgCode = fs.readFileSync(path.join(SRC_DIR, 'background/background.js'), 'utf8');

// Подключаем мобильный WASM-модуль Stockfish 19 Lite
bgCode = bgCode.replace(
  'const workerUrl = extApi.runtime.getURL("background/stockfish-19-full.js");',
  'const workerUrl = extApi.runtime.getURL("background/stockfish-19.js");'
);

bgCode = bgCode.replace(
  'let currentMultiPV = 3;',
  'let currentMultiPV = 1;'
);

// Оптимизация параметров WASM-движка под мобильные процессоры
const wasmMobileReadyBlock = `      if (line === "uciok" || line === "readyok") {
        isReady = true;
        // 1. Фиксируем 1 поток WASM, чтобы избежать троттлинга и задержек переключения контекста
        stockfish.postMessage("setoption name Threads value 1");
        // 2. Хэш-таблица 16 МБ: быстрое кэширование без перегрузки памяти смартфона
        stockfish.postMessage("setoption name Hash value 16");
        // 3. Отключаем ponder (фоновый расчет на ходе противника для экономии батареи)
        stockfish.postMessage("setoption name Ponder value false");
        // 4. Компенсация задержки передачи сообщений между JS и WASM
        stockfish.postMessage("setoption name Move Overhead value 10");
        stockfish.postMessage("setoption name MultiPV value 1");
        // 5. Предварительный прогрев WASM JIT-компилятора (JIT pre-warming)
        stockfish.postMessage("position startpos");
        stockfish.postMessage("go depth 1");
        console.log("✅ [Stockfish 19 Lite WASM Mobile] Оптимизирован под мобильный процессор и готов!");
      }`;

bgCode = bgCode.replace(
  /if \(line === "uciok" \|\| line === "readyok"\) \{[\s\S]*?console\.log\(`✅ \[Stockfish 19 FULL NNUE\][^`]*`\);\s*\}/,
  wasmMobileReadyBlock
);

// 6. content.js: тайминги, 1 стрелка, адаптивный сенсорный виджет
let contentCode = fs.readFileSync(path.join(SRC_DIR, 'content/content.js'), 'utf8');

const newSpeedModes = `const SPEED_MODES = {
  bullet: { name: "⚡ Пуля", movetime: 50, depth: 8, debounce: 80, label: "⚡ Пуля (50мс • 8d)" },
  blitz:  { name: "🎯 Блиц", movetime: 100, depth: 9, debounce: 100, label: "🎯 Блиц (100мс • 9d)" },
  rapid:  { name: "🧠 Рапид", movetime: 150, depth: 11, debounce: 120, label: "🧠 Рапид (150мс • 11d)" }
};`;

contentCode = contentCode.replace(
  /const SPEED_MODES = \{[\s\S]*?\};/,
  newSpeedModes
);

contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill \$\{speedMode === 'bullet' \? 'active' : ''\}" data-speed="bullet"[^>]*>.*?<\/button>/,
  `<button type="button" class="btn-speed-pill \${speedMode === 'bullet' ? 'active' : ''}" data-speed="bullet">⚡ Пуля (50мс)</button>`
);
contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill \$\{speedMode === 'blitz' \? 'active' : ''\}" data-speed="blitz"[^>]*>.*?<\/button>/,
  `<button type="button" class="btn-speed-pill \${speedMode === 'blitz' ? 'active' : ''}" data-speed="blitz">🎯 Блиц (100мс)</button>`
);
contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill \$\{speedMode === 'rapid' \? 'active' : ''\}" data-speed="rapid"[^>]*>.*?<\/button>/,
  `<button type="button" class="btn-speed-pill \${speedMode === 'rapid' ? 'active' : ''}" data-speed="rapid">🧠 Рапид (150мс)</button>`
);
contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill[^"]*" data-speed="ultra"[^>]*>.*?<\/button>/g,
  ''
);

// Убираем блок смены стрелок из настроек (на телефоне строго 1 лучшая стрелка)
const arrowSettingsBlock = `        <!-- 1. Режим стрелок (MultiPV 3 / MultiPV 5) -->
        <div class="setting-item">
          <div class="setting-label-row">
            <span>🏹 Режим стрелок:</span>
          </div>
          <div class="arrow-mode-column">
            <button type="button" class="btn-style-pill arrow-mode-btn \${arrowMode === 'multi3' ? 'active' : ''}" data-arrow-mode="multi3">
              3 стрелки (чёрная / серая / белая)
            </button>
            <button type="button" class="btn-style-pill arrow-mode-btn \${arrowMode === 'multi5' ? 'active' : ''}" data-arrow-mode="multi5">
              5 чёрных стрелок с бейджами (MultiPV 5)
            </button>
          </div>
        </div>

        <!-- 2. Форма меток клеток (квадрат / круг / только стрелка) -->
        <div class="setting-item" style="margin-top: 6px;">`;

const cleanSettingsBlock = `        <!-- Форма меток клеток (квадрат / круг / только стрелка) -->
        <div class="setting-item">`;

contentCode = contentCode.replace(arrowSettingsBlock, cleanSettingsBlock);

contentCode = contentCode.replace(
  /\/\/ Переключение режима стрелок \(MultiPV 3 \/ MultiPV 5\)[\s\S]*?requestBestMoves\(\);\s*\}\);\s*\}\);/,
  '// Режим стрелок зафиксирован на 1 стрелке'
);

// Отрисовка ровно 1 стрелки
const singleArrowDrawBlock = `  // 1 лучшая стрелка (максимальная скорость и чистота экрана на телефоне)
  if (validMoves.length > 0) {
    const best = validMoves[0];
    const start = getSquareBox(best.move.slice(0, 2), squareSize, dpr, isFlipped);
    const end = getSquareBox(best.move.slice(2, 4), squareSize, dpr, isFlipped);
    const arrowColor = "#000000";

    drawSquareMarker(ctx, start, arrowColor, dpr);
    drawSquareMarker(ctx, end, arrowColor, dpr);
    drawArrow(ctx, start, end, arrowColor, dpr);
    drawBadge(ctx, end, best.score, arrowColor, dpr, "top-center", 0);
  }`;

contentCode = contentCode.replace(
  /if \(arrowMode === "multi5" && validMoves\.length > 0\) \{[\s\S]*?drawBadge\(ctx, items\[i\]\.end, items\[i\]\.score, items\[i\]\.color, dpr, items\[i\]\.badgePos, items\[i\]\.extraY\);\s*\}\s*\}/,
  singleArrowDrawBlock
);

// Компактный вывод в лог (1 лучший ход)
contentCode = contentCode.replace(
  /function formatMovesLog\([\s\S]*?return moves\.slice\(0, 3\)[\s\S]*?join\("\\n"\);\s*\}/,
  `function formatMovesLog(moves, activeTurn, isFlipped) {
  if (!moves || moves.length === 0) return "Нет ходов";
  const m = moves[0];
  const s = formatScore(m.score, "M");
  const who = (score) => {
    if (!score) return "";
    const cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
    const whiteCp = activeTurn === "w" ? cp : -cp;
    return whiteCp > 0 ? "в твою пользу" : "в пользу соперника";
  };
  const scorePart = s ? ' [' + s + ' • ' + who(m.score) + ']' : '';
  return '⭐ Лучший ход: ' + m.move.slice(0, 2).toUpperCase() + ' ➔ ' + m.move.slice(2, 4).toUpperCase() + scorePart;
}`
);

// DPR 1.0 (быстрый рендеринг без перегрузки GPU)
contentCode = contentCode.replace(
  /const dpr = window\.devicePixelRatio \|\| 1;/g,
  'const dpr = 1.0;'
);

// Отключение теней на холсте
contentCode = contentCode.replace(
  /ctx\.shadowBlur = [^;]+;/g,
  'ctx.shadowBlur = 0;'
);
contentCode = contentCode.replace(
  /ctx\.shadowColor = [^;]+;/g,
  'ctx.shadowColor = "transparent";'
);

// Заголовок и бейдж
contentCode = contentCode.replace(
  /<span>♟️ Stockfish 19<\/span>\s*<span class="badge">🔥 4050 ELO<\/span>/,
  '<span>♟️ Stockfish 19 Lite WASM</span>\n        <span class="badge">⚡ 3650 ELO</span>'
);

// Свернут по умолчанию в аккуратную плавающую кнопку
contentCode = contentCode.replace(
  'let isMinimized = false;',
  'let isMinimized = true;'
);

// Инициализация свернутого состояния при создании виджета
contentCode = contentCode.replace(
  'document.body.appendChild(widget);\n\n  const minBtn = document.getElementById("btn-minimize-widget");',
  `document.body.appendChild(widget);
  if (isMinimized) {
    widget.classList.add("minimized");
  }

  const minBtn = document.getElementById("btn-minimize-widget");
  if (isMinimized && minBtn) {
    minBtn.innerText = "+";
  }`
);

// Дефолтный режим: Рапид (150мс)
contentCode = contentCode.replace(
  'let speedMode = localStorage.getItem("chess_speed_mode") || "bullet";',
  'let speedMode = localStorage.getItem("chess_speed_mode") || "rapid";\nif (speedMode === "ultra") speedMode = "rapid";'
);

// Отключение премувов на телефоне для экономии батареи
contentCode = contentCode.replace(
  /if \(isOnlyMyTurnEnabled && isOpponentTurn\) \{[\s\S]*?onAnalysisReceived\(res, fen, true\);\s*return;\s*\}/,
  `if (isOpponentTurn) {
    clearOverlay();
    if (output) output.innerText = "⏳ Ход соперника... Ожидаем ответ ☕";
    return;
  }`
);
contentCode = contentCode.replace(
  /const hasPremove = premoveMove && premoveMove\.length >= 4;/g,
  'const hasPremove = false;'
);

// multiPV: 1
contentCode = contentCode.replace(
  /multiPV:\s*arrowMode\s*===\s*"multi5"\s*\?\s*5\s*:\s*3/g,
  'multiPV: 1'
);

// Оптимизация поворота экрана и динамического ресайза доски (ResizeObserver)
const oldResizeBlock = `function handleResizeOrOrientation() {
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
});`;

const mobileResizeEnhance = `function handleResizeOrOrientation() {
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
  setTimeout(handleResizeOrOrientation, 100);
  setTimeout(handleResizeOrOrientation, 300);
});
if (window.screen && window.screen.orientation) {
  window.screen.orientation.addEventListener("change", () => {
    setTimeout(handleResizeOrOrientation, 100);
    setTimeout(handleResizeOrOrientation, 300);
  });
}
let mobileBoardResizeObserver = null;
function observeBoardResize(board) {
  if (typeof ResizeObserver === "undefined" || !board) return;
  if (mobileBoardResizeObserver) mobileBoardResizeObserver.disconnect();
  mobileBoardResizeObserver = new ResizeObserver(() => {
    handleResizeOrOrientation();
  });
  mobileBoardResizeObserver.observe(board);
}`;

contentCode = contentCode.replace(oldResizeBlock, mobileResizeEnhance);

contentCode = contentCode.replace(
  'currentObservedBoard = board;\n    lastBoardFlipped = isBoardFlipped(board);',
  'currentObservedBoard = board;\n    observeBoardResize(board);\n    lastBoardFlipped = isBoardFlipped(board);'
);

// 7. Обфускация
const scratchBundle = 'C:/Users/fonya/.gemini/antigravity/brain/8ade855d-8452-4aa6-9764-aee78b8d5d0e/scratch/obfuscator.bundle.js';
const Obfuscator = require(scratchBundle);

const obfOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  numbersToExpressions: true,
  simplify: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.8,
  splitStrings: true,
  splitStringsChunkLength: 8,
  identifierNamesGenerator: 'hexadecimal',
  transformObjectKeys: true,
  renameGlobals: false
};

console.log('⚙️ [Phone Build] Обфускация background.js с WASM-оптимизациями...');
const obfBg = Obfuscator.obfuscate(bgCode, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(PHONE_DIR, 'background/background.js'), obfBg, 'utf8');

console.log('⚙️ [Phone Build] Обфускация content.js...');
const obfContent = Obfuscator.obfuscate(contentCode, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(PHONE_DIR, 'content/content.js'), obfContent, 'utf8');

// 8. Копирование файлов Stockfish 19 WASM Lite (1.8 MB)
console.log('📦 [Phone Build] Копирование Stockfish 19 WASM Lite...');
fs.copyFileSync(path.join(SRC_DIR, 'background/stockfish-19.js'), path.join(PHONE_DIR, 'background/stockfish-19.js'));
fs.copyFileSync(path.join(SRC_DIR, 'background/stockfish-19.wasm'), path.join(PHONE_DIR, 'background/stockfish-19.wasm'));

// 9. Упаковка в chess-assistant_phone.xpi
console.log('📦 [Phone Build] Упаковка в chess-assistant_phone.xpi...');
if (fs.existsSync(XPI_PATH)) {
  fs.unlinkSync(XPI_PATH);
}

const psScript = `
  Add-Type -AssemblyName System.IO.Compression;
  Add-Type -AssemblyName System.IO.Compression.FileSystem;
  $phone = '${PHONE_DIR.replace(/\\/g, '/')}';
  $xpi = '${XPI_PATH.replace(/\\/g, '/')}';
  $archive = [System.IO.Compression.ZipFile]::Open($xpi, [System.IO.Compression.ZipArchiveMode]::Create);
  $files = Get-ChildItem -Path $phone -Recurse -File | Where-Object { $_.Extension -ne '.xpi' };
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($phone.Length + 1);
    $rel = $rel.Replace([char]92, [char]47);
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal);
  };
  $archive.Dispose();
`;

execSync(`powershell -NoProfile -Command "${psScript.replace(/[\r\n]+/g, ' ')}"`, { stdio: 'inherit' });
console.log(`🎉 [Phone Build] chess-assistant_phone.xpi готов! Размер: ${(fs.statSync(XPI_PATH).size / 1024 / 1024).toFixed(2)} MB`);
