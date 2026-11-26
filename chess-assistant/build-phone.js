/**
 * Скрипт сборки мобильной версии Chess Assistant (v2.4 • Mobile Lightspeed + WASM Turbo)
 * Переключает единую кодовую базу в режим IS_MOBILE_BUILD = true,
 * оптимизирует стили под сенсорный экран, упаковывает в chess-assistant_phone.xpi
 * и синхронизирует файл скачивания в site/downloads/chess-assistant_phone.xpi.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

global.self = global;

const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'chess-assistant');
const PHONE_DIR = path.join(ROOT_DIR, 'chess-assistant_phone');
const XPI_PATH = path.join(PHONE_DIR, 'chess-assistant_phone.xpi');
const SITE_DOWNLOAD_PATH = path.join(ROOT_DIR, 'site', 'downloads', 'chess-assistant_phone.xpi');

console.log('⚡ [Phone Build] Сборка мобильной версии Chess Assistant v2.4...');

// 1. Очистка и создание структуры
if (fs.existsSync(PHONE_DIR)) {
  fs.rmSync(PHONE_DIR, { recursive: true, force: true });
}
fs.mkdirSync(path.join(PHONE_DIR, 'icons'), { recursive: true });
fs.mkdirSync(path.join(PHONE_DIR, 'background'), { recursive: true });
fs.mkdirSync(path.join(PHONE_DIR, 'content'), { recursive: true });

// 2. Иконка
fs.copyFileSync(path.join(SRC_DIR, 'icons', 'pawn.svg'), path.join(PHONE_DIR, 'icons', 'pawn.svg'));

function escapeAndMinifyJson(obj) {
  const jsonStr = JSON.stringify(obj);
  return jsonStr.replace(/[\u007f-\uffff]/g, (c) => {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

// 3. manifest.json
const srcManifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'manifest.json'), 'utf8'));
const manifest = {
  manifest_version: 3,
  name: 'Шахматный Помощник (Mobile)',
  version: srcManifest.version || '2.4',
  description: 'Мобильный шахматный плагин со Stockfish 19 WASM Lite',
  permissions: ['activeTab'],
  action: {
    default_icon: 'icons/pawn.svg',
    default_title: 'Шахматный Помощник (Mobile)'
  },
  icons: {
    '48': 'icons/pawn.svg',
    '96': 'icons/pawn.svg'
  },
  browser_specific_settings: {
    gecko: {
      id: '{f79148d2-5b32-41eb-8903-4e2b056e1875}',
      strict_min_version: '109.0'
    }
  },
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  },
  background: {
    scripts: ['background/background.js']
  },
  content_scripts: [
    {
      matches: ['*://*.chess.com/*', '*://lichess.org/*', '*://*.lichess.org/*'],
      js: ['content/content.js'],
      css: ['content/overlay.css'],
      run_at: 'document_idle'
    }
  ]
};

fs.writeFileSync(path.join(PHONE_DIR, 'manifest.json'), escapeAndMinifyJson(manifest), 'utf8');

// 4. overlay.css: базовые стили без blur + адаптивные мобильные переопределения
const mobileCssOverrides = `
#chess-canvas-overlay {
  transform: translateZ(0) !important;
  will-change: transform !important;
}
#chess-assistant-widget {
  background: #151020 !important;
  bottom: max(10px, env(safe-area-inset-bottom, 10px));
  right: max(10px, env(safe-area-inset-right, 10px));
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
.widget-drag-handle {
  width: 44px !important;
  height: 5px !important;
  background: rgba(196, 181, 253, 0.45) !important;
  border-radius: 3px !important;
  margin: 0 auto 6px auto !important;
}
.widget-drag-handle:active {
  background: rgba(196, 181, 253, 0.75) !important;
}
.widget-corner-grip {
  width: 26px !important;
  height: 26px !important;
  opacity: 0.6 !important;
}
.widget-header,
.settings-panel-header {
  cursor: grab !important;
  touch-action: none !important;
}
.widget-header:active,
.settings-panel-header:active {
  cursor: grabbing !important;
}
.speed-modes-grid {
  grid-template-columns: repeat(3, 1fr) !important;
}
#chess-assistant-widget .chess-row button,
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
.btn-settings,
.btn-minimize,
.btn-panel-close {
  min-width: 28px !important;
  min-height: 28px !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex: none !important;
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

let css = fs.readFileSync(path.join(SRC_DIR, 'content', 'overlay.css'), 'utf8');
css = css.replace(/-webkit-backdrop-filter:\s*blur\([^)]*\);?/gi, '');
css = css.replace(/backdrop-filter:\s*blur\([^)]*\);?/gi, '');
css = (css + '\n' + mobileCssOverrides)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>~])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim();
fs.writeFileSync(path.join(PHONE_DIR, 'content', 'overlay.css'), css, 'utf8');

// 5. Активация флага IS_MOBILE_BUILD = true в background.js и content.js
function enableMobileFlag(sourceCode, label) {
  const target = 'const IS_MOBILE_BUILD = false;';
  if (!sourceCode.includes(target)) {
    throw new Error(`[Phone Build] Не найден флаг "${target}" в ${label}!`);
  }
  return sourceCode.replace(target, 'const IS_MOBILE_BUILD = true;');
}

const bgCode = enableMobileFlag(
  fs.readFileSync(path.join(SRC_DIR, 'background', 'background.js'), 'utf8'),
  'background/background.js'
);
const contentCode = enableMobileFlag(
  fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8'),
  'content/content.js'
);

// 6. Обфускация
const obfuscatorPath = path.resolve(ROOT_DIR, 'scripts/obfuscator.bundle.js');
if (!fs.existsSync(obfuscatorPath)) {
  throw new Error(`Не найден обфускатор: ${obfuscatorPath}`);
}
const Obfuscator = require(obfuscatorPath);

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

console.log('⚙️ [Phone Build] Обфускация background.js...');
const obfBg = Obfuscator.obfuscate(bgCode, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(PHONE_DIR, 'background', 'background.js'), obfBg, 'utf8');

console.log('⚙️ [Phone Build] Обфускация content.js...');
const obfContent = Obfuscator.obfuscate(contentCode, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(PHONE_DIR, 'content', 'content.js'), obfContent, 'utf8');

// 7. Копирование файлов Stockfish 19 WASM Lite (1.8 MB)
console.log('📦 [Phone Build] Копирование Stockfish 19 WASM Lite...');
fs.copyFileSync(path.join(SRC_DIR, 'background', 'stockfish-19.js'), path.join(PHONE_DIR, 'background', 'stockfish-19.js'));
fs.copyFileSync(path.join(SRC_DIR, 'background', 'stockfish-19.wasm'), path.join(PHONE_DIR, 'background', 'stockfish-19.wasm'));

// 8. Упаковка в chess-assistant_phone.xpi и синхронизация с сайтом
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

fs.mkdirSync(path.dirname(SITE_DOWNLOAD_PATH), { recursive: true });
fs.copyFileSync(XPI_PATH, SITE_DOWNLOAD_PATH);
console.log(`🔄 [Phone Build] Скопирован в site/downloads/chess-assistant_phone.xpi`);

const sizeMb = (fs.statSync(XPI_PATH).size / 1024 / 1024).toFixed(2);
console.log(`🎉 [Phone Build] chess-assistant_phone.xpi готов! Размер: ${sizeMb} MB`);
