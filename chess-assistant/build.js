/**
 * Скрипт сборки расширения Chess Assistant (PC версия)
 * Собирает проект в dist/ и упаковывает в chess-assistant.xpi
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

global.self = global;

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const XPI_PATH = path.join(ROOT_DIR, 'chess-assistant.xpi');

console.log('🚀 [Build PC] Начало сборки Chess Assistant (PC)...');

// 1. Очистка и создание структуры dist/
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(path.join(DIST_DIR, 'background'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'content'), { recursive: true });

// Функция юникод-экранирования и минификации JSON (защита от чтения и удаление метаданных)
function escapeAndMinifyJson(obj) {
  const jsonStr = JSON.stringify(obj);
  return jsonStr.replace(/[\u007f-\uffff]/g, (c) => {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

// 2. Обработка manifest.json (минификация, экранирование Unicode, анонимный GUID)
console.log('📄 [Build PC] Обработка manifest.json...');
const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);

manifest.action = {
  default_title: "Шахматный Помощник"
};
delete manifest.icons;

manifest.browser_specific_settings = {
  gecko: {
    id: "{ec8030f7-c20a-464f-9b0e-13a3a9e97384}",
    strict_min_version: "109.0"
  }
};

manifest.content_scripts = [
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
];

manifest.web_accessible_resources = [
  {
    resources: [
      "background/stockfish-19-full.js",
      "background/stockfish-19-full.wasm"
    ],
    matches: [
      "*://*.chess.com/*",
      "*://lichess.org/*",
      "*://*.lichess.org/*"
    ]
  }
];

fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), escapeAndMinifyJson(manifest), 'utf8');
console.log('✅ manifest.json сохранен в dist/ (минифицирован + Unicode экранирование)');

// 3. Минификация overlay.css
console.log('🎨 [Build PC] Минификация overlay.css...');
const cssRaw = fs.readFileSync(path.join(ROOT_DIR, 'content/overlay.css'), 'utf8');
const cssMin = cssRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>+~])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim();
fs.writeFileSync(path.join(DIST_DIR, 'content/overlay.css'), cssMin, 'utf8');
console.log(`✅ dist/content/overlay.css сохранен (${cssMin.length} байт)`);

// 4. Загрузка обфускатора
function getObfuscator() {
  const localObf = path.join(ROOT_DIR, '../scripts/obfuscator.bundle.js');
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

// Обфускация background.js
console.log('⚙️ [Build PC] Обфускация background.js...');
const bgRaw = fs.readFileSync(path.join(ROOT_DIR, 'background/background.js'), 'utf8');
const bgCode = Obfuscator.obfuscate(bgRaw, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(DIST_DIR, 'background/background.js'), bgCode, 'utf8');
console.log(`✅ dist/background/background.js готов (${bgCode.length} байт)`);

// Обфускация content.js
console.log('⚙️ [Build PC] Обфускация content.js...');
const contentRaw = fs.readFileSync(path.join(ROOT_DIR, 'content/content.js'), 'utf8');
const contentCode = Obfuscator.obfuscate(contentRaw, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(DIST_DIR, 'content/content.js'), contentCode, 'utf8');
console.log(`✅ dist/content/content.js готов (${contentCode.length} байт)`);

// 5. Копирование библиотечных файлов Stockfish для ПК (Stockfish 19 Full NNUE)
const stockfishFiles = [
  'stockfish-19-full.js',
  'stockfish-19-full.wasm'
];

for (const file of stockfishFiles) {
  const src = path.join(ROOT_DIR, 'background', file);
  const dst = path.join(DIST_DIR, 'background', file);
  if (fs.existsSync(src)) {
    console.log(`📦 [Build PC] Копирование background/${file}...`);
    fs.copyFileSync(src, dst);
  }
}

// 6. Упаковка dist/ в chess-assistant.xpi
console.log('📦 [Build PC] Упаковка в chess-assistant.xpi...');
if (fs.existsSync(XPI_PATH)) {
  fs.unlinkSync(XPI_PATH);
}

const psScript = `
  Add-Type -AssemblyName System.IO.Compression;
  Add-Type -AssemblyName System.IO.Compression.FileSystem;
  $dist = '${DIST_DIR.replace(/\\/g, '/')}';
  $xpi = '${XPI_PATH.replace(/\\/g, '/')}';
  $archive = [System.IO.Compression.ZipFile]::Open($xpi, [System.IO.Compression.ZipArchiveMode]::Create);
  $files = Get-ChildItem -Path $dist -Recurse -File;
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($dist.Length + 1);
    $rel = $rel.Replace([char]92, [char]47);
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $f.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal);
  };
  $archive.Dispose();
`;

execSync(`powershell -NoProfile -Command "${psScript.replace(/[\r\n]+/g, ' ')}"`, { stdio: 'inherit' });
console.log(`🎉 [Build PC] chess-assistant.xpi успешно создан! (${(fs.statSync(XPI_PATH).size / 1024 / 1024).toFixed(1)} MB)`);
