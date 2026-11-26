/**
 * Скрипт сборки расширения Chess Assistant (PC версия v2.4)
 * Собирает проект в dist/, упаковывает в chess-assistant.xpi и очищает временную папку dist/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

global.self = global;

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const XPI_PATH = path.join(ROOT_DIR, 'chess-assistant.xpi');

console.log('🚀 [Build PC] Начало сборки Chess Assistant v2.4 (PC)...');

// 1. Очистка и создание структуры dist/
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(path.join(DIST_DIR, 'background'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'content'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'icons'), { recursive: true });

// Копируем иконку пешки
const iconSrc = path.join(ROOT_DIR, 'icons', 'pawn.svg');
if (!fs.existsSync(iconSrc)) {
  throw new Error(`Не найдена иконка расширения: ${iconSrc}`);
}
fs.copyFileSync(iconSrc, path.join(DIST_DIR, 'icons', 'pawn.svg'));

// Минификация и Unicode-экранирование JSON
function escapeAndMinifyJson(obj) {
  const jsonStr = JSON.stringify(obj);
  return jsonStr.replace(/[\u007f-\uffff]/g, (c) => {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
}

// 2. Обработка manifest.json
console.log('📄 [Build PC] Обработка manifest.json...');
const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);

manifest.version = manifest.version || '2.4';
manifest.icons = {
  '48': 'icons/pawn.svg',
  '96': 'icons/pawn.svg'
};
manifest.action = {
  default_icon: 'icons/pawn.svg',
  default_title: 'Шахматный Помощник'
};
manifest.browser_specific_settings = {
  gecko: {
    id: '{a4c8e910-7d3b-4e2a-9f61-8b2d4c5e7a90}',
    strict_min_version: '109.0'
  }
};
manifest.content_scripts = [
  {
    matches: [
      '*://*.chess.com/*',
      '*://lichess.org/*',
      '*://*.lichess.org/*'
    ],
    js: ['content/content.js'],
    css: ['content/overlay.css'],
    run_at: 'document_idle'
  }
];
delete manifest.web_accessible_resources;

fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), escapeAndMinifyJson(manifest), 'utf8');
console.log('✅ manifest.json сохранен в dist/');

// 3. Минификация overlay.css
console.log('🎨 [Build PC] Минификация overlay.css...');
const cssRaw = fs.readFileSync(path.join(ROOT_DIR, 'content', 'overlay.css'), 'utf8');
const cssMin = cssRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>~])\s*/g, '$1')
  .replace(/;}/g, '}')
  .trim();
fs.writeFileSync(path.join(DIST_DIR, 'content', 'overlay.css'), cssMin, 'utf8');
console.log(`✅ dist/content/overlay.css готов (${cssMin.length} байт)`);

// 4. Загрузка обфускатора из локальной папки scripts/
const obfuscatorPath = path.resolve(ROOT_DIR, '../scripts/obfuscator.bundle.js');
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

// Обфускация background.js
console.log('⚙️ [Build PC] Обфускация background.js...');
const bgRaw = fs.readFileSync(path.join(ROOT_DIR, 'background', 'background.js'), 'utf8');
const bgCode = Obfuscator.obfuscate(bgRaw, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(DIST_DIR, 'background', 'background.js'), bgCode, 'utf8');
console.log(`✅ dist/background/background.js готов (${bgCode.length} байт)`);

// Обфускация content.js
console.log('⚙️ [Build PC] Обфускация content.js...');
const contentRaw = fs.readFileSync(path.join(ROOT_DIR, 'content', 'content.js'), 'utf8');
const contentCode = Obfuscator.obfuscate(contentRaw, obfOptions).getObfuscatedCode();
fs.writeFileSync(path.join(DIST_DIR, 'content', 'content.js'), contentCode, 'utf8');
console.log(`✅ dist/content/content.js готов (${contentCode.length} байт)`);

// 5. Копирование файлов Stockfish 19 Full NNUE
const stockfishFiles = ['stockfish-19-full.js', 'stockfish-19-full.wasm'];
for (const file of stockfishFiles) {
  const src = path.join(ROOT_DIR, 'background', file);
  const dst = path.join(DIST_DIR, 'background', file);
  if (!fs.existsSync(src)) {
    throw new Error(`Не найден файл движка: ${src}`);
  }
  console.log(`📦 [Build PC] Копирование background/${file}...`);
  fs.copyFileSync(src, dst);
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
const sizeMb = (fs.statSync(XPI_PATH).size / 1024 / 1024).toFixed(1);

// 7. Удаление временной папки dist/ (чтобы не хранить дубликат ~95 МБ)
fs.rmSync(DIST_DIR, { recursive: true, force: true });
console.log(`🧹 [Build PC] Временная папка dist/ очищена.`);
console.log(`🎉 [Build PC] chess-assistant.xpi успешно создан! (${sizeMb} MB)`);
