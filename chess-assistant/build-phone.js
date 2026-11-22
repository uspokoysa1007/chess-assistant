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

// 4. overlay.css: чистый единый набор правил без дублирования десктопных блоков
let css = fs.readFileSync(path.join(SRC_DIR, 'content/overlay.css'), 'utf8');
css = css.replace(/backdrop-filter:\s*blur\([^)]*\);?/gi, '');
css = css.replace(/-webkit-backdrop-filter:\s*blur\([^)]*\);?/gi, '');

css = css.replace(
  /#chess-canvas-overlay\{[^}]+\}/,
  '#chess-canvas-overlay{position:absolute!important;top:0!important;left:0!important;width:100%!important;height:100%!important;pointer-events:none!important;z-index:9999!important;background:transparent!important;transform:translateZ(0)!important;will-change:transform!important}'
);

css = css.replace(
  /#chess-assistant-widget\{[^}]+position:fixed;bottom:12px;[^}]+\}/,
  '#chess-assistant-widget{--theme-color:#7c3aed;--theme-glow:rgba(124,58,237,0.2);--theme-header:#a78bfa;--theme-badge-bg:rgba(124,58,237,0.15);--theme-badge-border:rgba(124,58,237,0.35);--theme-badge-text:#c4b5fd;--theme-btn-primary:linear-gradient(135deg,#7c3aed,#5b21b6);position:fixed;background:#151020!important;bottom:max(10px,env(safe-area-inset-bottom,10px));right:max(10px,env(safe-area-inset-right,10px));width:min(320px,calc(100vw - 20px))!important;max-height:min(75vh,calc(100dvh - 70px))!important;box-sizing:border-box!important;padding:8px 10px!important;border-radius:14px!important;touch-action:pan-y!important;z-index:10000000!important;box-shadow:0 4px 16px rgba(0,0,0,0.7)!important;color:#e2d9f3;border:1px solid #3a2660;font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,sans-serif;user-select:none;transition:all 0.2s ease;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#2e1f4a #080510}'
);

css = css.replace(
  /#chess-assistant-widget\.minimized\{[^}]+\}/,
  '#chess-assistant-widget.minimized{width:auto!important;max-width:calc(100vw - 20px)!important;padding:6px 14px!important;border-radius:20px!important;cursor:pointer!important;touch-action:none!important;box-shadow:0 4px 16px rgba(168,85,247,0.4),0 2px 8px rgba(0,0,0,0.8)!important}'
);

css = css.replace(
  /\.widget-drag-handle\{[^}]+\}/,
  '.widget-drag-handle{width:44px!important;height:5px!important;background:rgba(196,181,253,0.45)!important;border-radius:3px!important;margin:0 auto 6px auto!important;cursor:grab!important;touch-action:none!important}'
);

css = css.replace(
  /\.widget-drag-handle:active\{[^}]+\}/,
  '.widget-drag-handle:active{cursor:grabbing!important;background:rgba(196,181,253,0.75)!important}'
);

css = css.replace(
  /\.widget-header\{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;cursor:grab\}/,
  '.widget-header,.settings-panel-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;cursor:grab!important;touch-action:none!important}'
);

css = css.replace(
  /\.widget-header:active\{cursor:grabbing\}/,
  '.widget-header:active,.settings-panel-header:active{cursor:grabbing!important}'
);

css = css.replace(
  /\.speed-modes-grid\{[^}]+\}/,
  '.speed-modes-grid{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:4px!important}'
);

css = css.replace(
  /#chess-assistant-widget button\{background:#100b1e;color:#c4b5fd;border:1px solid #2e1f4a;border-radius:5px;padding:5px 8px;cursor:pointer;font-size:10.5px;font-weight:500;transition:all 0.15s ease;flex:1\}/,
  '#chess-assistant-widget button,.btn-speed-pill,.btn-style-pill{min-height:36px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:11px!important;touch-action:manipulation!important;box-sizing:border-box!important;background:#100b1e;color:#c4b5fd;border:1px solid #2e1f4a;border-radius:5px;cursor:pointer;font-weight:500;transition:all 0.15s ease;flex:1}'
);

css = css.replace(
  /\.btn-settings\{[^}]+\}/,
  '.btn-settings,.btn-minimize,.btn-panel-close{min-width:28px!important;min-height:28px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;background:rgba(255,255,255,0.05)!important;border:1px solid rgba(255,255,255,0.1)!important;color:#c4b5fd!important;font-size:12px!important;cursor:pointer!important;border-radius:4px!important;line-height:1!important;transition:all 0.2s ease!important}'
);

css = css.replace(
  /\.chess-toggle-label\{[^}]+\}/,
  '.chess-toggle-label{padding:5px 0!important;font-size:11.5px!important;touch-action:manipulation!important;color:#9d87c4;display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:4px;white-space:nowrap}'
);

css = css.replace(
  /\.chess-toggle-label input\[type="checkbox"\]\{[^}]+\}/,
  '.chess-toggle-label input[type="checkbox"]{cursor:pointer;accent-color:var(--theme-color);width:17px!important;height:17px!important}'
);

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
  bullet: { name: "Пуля", movetime: 50, depth: 8, debounce: 80, label: "Пуля (50мс • 8d)" },
  blitz:  { name: "Блиц", movetime: 100, depth: 9, debounce: 100, label: "Блиц (100мс • 9d)" },
  rapid:  { name: "Рапид", movetime: 150, depth: 11, debounce: 120, label: "Рапид (150мс • 11d)" }
};`;

contentCode = contentCode.replace(
  /const SPEED_MODES = \{[\s\S]*?\};/,
  newSpeedModes
);

contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill[^"]*" data-speed="bullet"[^>]*>.*?<\/button>/,
  `<button type="button" class="btn-speed-pill \${!amateurModeEnabled && speedMode === 'bullet' ? 'active' : ''}" data-speed="bullet">\${t("bulletNamePhone")}</button>`
);
contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill[^"]*" data-speed="blitz"[^>]*>.*?<\/button>/,
  `<button type="button" class="btn-speed-pill \${!amateurModeEnabled && speedMode === 'blitz' ? 'active' : ''}" data-speed="blitz">\${t("blitzNamePhone")}</button>`
);
contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill[^"]*" data-speed="rapid"[^>]*>.*?<\/button>/,
  `<button type="button" class="btn-speed-pill \${!amateurModeEnabled && speedMode === 'rapid' ? 'active' : ''}" data-speed="rapid">\${t("rapidNamePhone")}</button>`
);
contentCode = contentCode.replace(
  /<button type="button" class="btn-speed-pill[^"]*" data-speed="ultra"[^>]*>.*?<\/button>/g,
  ''
);

// Убираем блок смены стрелок из настроек (на телефоне строго 1 лучшая стрелка)
contentCode = contentCode.replace(
  /<!-- 1\. Режим стрелок[\s\S]*?<!-- 2\. Форма меток клеток \(квадрат \/ круг \/ только стрелка\) -->\s*<div class="setting-item" style="margin-top: 6px;">/,
  '<!-- 2. Форма меток клеток (квадрат / круг / только стрелка) -->\n        <div class="setting-item">'
);

contentCode = contentCode.replace(
  /\/\/ Переключение режима стрелок[\s\S]*?requestBestMoves\(\);\s*\}\);\s*\}\);/,
  '// Режим стрелок зафиксирован на 1 стрелке'
);

contentCode = contentCode.replace(
  /let arrowMode = localStorage\.getItem\("chess_arrow_mode"\) \|\| "multi3";/,
  'let arrowMode = "multi1";'
);

// Отрисовка ровно 1 стрелки (или стрелки безопасного премува)
const singleArrowDrawBlock = `  // 1 лучшая стрелка (максимальная скорость и чистота экрана на телефоне)
  if (hasPremove) {
    const pStart = getSquareBox(premoveMove.slice(0, 2), squareSize, dpr, isFlipped);
    const pEnd = getSquareBox(premoveMove.slice(2, 4), squareSize, dpr, isFlipped);
    const premoveColor = "#7c3aed";

    drawSquareMarker(ctx, pStart, premoveColor, dpr);
    drawSquareMarker(ctx, pEnd, premoveColor, dpr);
    drawArrow(ctx, pStart, pEnd, premoveColor, dpr);
    drawBadge(ctx, pEnd, null, premoveColor, dpr, "top-center", 0);
  } else if (validMoves.length > 0) {
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
  /hasOverlayDrawings = true;\s*if \(arrowMode === "multi5"[\s\S]*?function handleResizeOrOrientation\(\)/,
  `hasOverlayDrawings = true;\n\n${singleArrowDrawBlock}\n}\n\n// ==========================================\n// 4. Поворот экрана и ресайз (Исправление бага!)\n// ==========================================\nfunction handleResizeOrOrientation()`
);

// Компактный вывод в лог (1 лучший ход с объявлением myColor!)
contentCode = contentCode.replace(
  /function formatMovesLog\([\s\S]*?return moves\.slice\(0, 3\)[\s\S]*?join\("\\n"\);\s*\}/,
  `function formatMovesLog(moves, activeTurn, isFlipped) {
  if (!moves || moves.length === 0) return t("noMovesMsg");
  const myColor = isFlipped ? "b" : "w";
  const m = moves[0];
  const s = formatScore(m.score, "M");
  const who = (score) => {
    if (!score) return "";
    const cp = score.type === "mate" ? (score.value > 0 ? 10000 : -10000) : score.value;
    const whiteCp = activeTurn === "w" ? cp : -cp;
    const isMine = (myColor === "w" && whiteCp > 0) || (myColor === "b" && whiteCp < 0);
    return isMine ? t("inYourFavor") : t("opponentAdvantage");
  };
  const scorePart = s ? ' [' + s + ' • ' + who(m.score) + ']' : '';
  return t("bestMovePhone") + ' ' + m.move.slice(0, 2).toUpperCase() + ' ➔ ' + m.move.slice(2, 4).toUpperCase() + scorePart;
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
  /<span>Stockfish 19<\/span>\s*<span class="badge">4050 ELO<\/span>/,
  '<span>\${t("titlePhone")}</span>\n        <span class="badge">3650 ELO</span>'
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

// multiPV на телефоне: 5 при включенном легит-режиме, иначе 1 (для скорости)
contentCode = contentCode.replace(
  /const targetMultiPV = amateurModeEnabled \? 5 : \(arrowMode === "multi5" \? 5 : \(arrowMode === "multi3" \? 3 : 1\)\);/g,
  'const targetMultiPV = amateurModeEnabled ? 5 : 1;'
);
contentCode = contentCode.replace(
  /const targetMultiPV = cfg\.multiPV \|\| \(amateurModeEnabled \? 5 : \(arrowMode === "multi5" \? 5 : \(arrowMode === "multi3" \? 3 : 1\)\)\);/g,
  'const targetMultiPV = cfg.multiPV || (amateurModeEnabled ? 5 : 1);'
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
function getObfuscator() {
  const localObf = path.join(ROOT_DIR, 'scripts/obfuscator.bundle.js');
  if (fs.existsSync(localObf)) return require(localObf);
  const scratchBundle = 'C:/Users/fonya/.gemini/antigravity/brain/8ade855d-8452-4aa6-9764-aee78b8d5d0e/scratch/obfuscator.bundle.js';
  return require(scratchBundle);
}

const Obfuscator = getObfuscator();

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
