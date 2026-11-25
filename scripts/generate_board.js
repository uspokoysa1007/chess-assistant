const fs = require('fs');
const path = require('path');

const PIECES = ['wp', 'wn', 'wb', 'wr', 'wq', 'wk', 'bp', 'bn', 'bb', 'br', 'bq', 'bk'];

// Расположение фигур на превью-доске (ранг 8 -> ранг 1, файлы a -> h)
const board = [
  ['br', null, 'bb', 'bq', 'bk', null, null, 'br'],
  [null, null, 'bp', null, null, 'bp', 'bp', 'bp'],
  ['bp', null, 'bn', 'bp', null, 'bn', null, null],
  [null, 'bp', 'bb', null, 'bp', null, null, null],
  [null, null, null, null, 'wp', null, null, null],
  [null, 'wb', 'wp', null, null, 'wn', null, null],
  ['wp', 'wp', null, 'wp', null, 'wp', 'wp', 'wp'],
  ['wr', 'wn', 'wb', 'wq', null, 'wr', 'wk', null]
];

const SITE_SVG_PATH = path.join(__dirname, '../site/board-preview.svg');

function loadCachedPieceAssets() {
  const cached = {};
  if (!fs.existsSync(SITE_SVG_PATH)) return cached;

  const existingSvg = fs.readFileSync(SITE_SVG_PATH, 'utf8');
  const imgRegex = /<image\s+href="(data:image\/png;base64,[^"]+)"\s+x="(\d+)"\s+y="(\d+)"/g;
  let match;
  while ((match = imgRegex.exec(existingSvg)) !== null) {
    const col = Math.round(parseInt(match[2], 10) / 100);
    const row = Math.round(parseInt(match[3], 10) / 100);
    const pieceName = board[row] && board[row][col];
    if (pieceName && !cached[pieceName]) {
      cached[pieceName] = match[1];
    }
  }
  return cached;
}

async function fetchPiece(name) {
  const url = `https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${name}.png`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  const buf = await res.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`;
}

async function main() {
  const pieceData = loadCachedPieceAssets();
  const missing = PIECES.filter((p) => !pieceData[p]);

  if (missing.length === 0) {
    console.log('Loaded all 12 piece assets offline from existing site/board-preview.svg.');
  } else {
    console.log(`Fetching missing piece assets: ${missing.join(', ')}...`);
    for (const p of missing) {
      pieceData[p] = await fetchPiece(p);
      console.log(`Fetched ${p}`);
    }
  }

  const squareSize = 100;
  const boardSize = 800;

  const lightColor = '#ebd0a1';
  const darkColor = '#b58863';
  const highlightColor = 'rgba(247, 236, 89, 0.72)';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${boardSize} ${boardSize}" width="100%" height="100%">\n`;
  svg += `  <defs>\n`;
  svg += `    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">\n`;
  svg += `      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.5"/>\n`;
  svg += `    </filter>\n`;
  svg += `  </defs>\n\n`;

  // 1. Клетки
  svg += `  <!-- Chessboard Squares -->\n  <g id="squares">\n`;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const x = c * squareSize;
      const y = r * squareSize;
      const color = isLight ? lightColor : darkColor;
      svg += `    <rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${color}" />\n`;
    }
  }
  svg += `  </g>\n\n`;

  // 2. Подсветка последнего хода d7-d6
  svg += `  <!-- Move Highlights (d7-d6) -->\n  <g id="highlights">\n`;
  svg += `    <rect x="${3 * squareSize}" y="${1 * squareSize}" width="${squareSize}" height="${squareSize}" fill="${highlightColor}" />\n`;
  svg += `    <rect x="${3 * squareSize}" y="${2 * squareSize}" width="${squareSize}" height="${squareSize}" fill="${highlightColor}" />\n`;
  svg += `  </g>\n\n`;

  // 3. Координаты
  svg += `  <!-- Board Coordinates -->\n  <g id="coordinates" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="700" font-size="14">\n`;
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  for (let r = 0; r < 8; r++) {
    const isLight = r % 2 === 0;
    const textColor = isLight ? darkColor : lightColor;
    svg += `    <text x="6" y="${r * squareSize + 18}" fill="${textColor}">${ranks[r]}</text>\n`;
  }
  for (let c = 0; c < 8; c++) {
    const isLight = (7 + c) % 2 === 0;
    const textColor = isLight ? darkColor : lightColor;
    svg += `    <text x="${c * squareSize + squareSize - 16}" y="${7 * squareSize + squareSize - 6}" fill="${textColor}">${files[c]}</text>\n`;
  }
  svg += `  </g>\n\n`;

  // 4. Фигуры
  svg += `  <!-- Pieces -->\n  <g id="pieces">\n`;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const x = c * squareSize;
        const y = r * squareSize;
        svg += `    <image href="${pieceData[piece]}" x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" />\n`;
      }
    }
  }
  svg += `  </g>\n\n`;

  function makeCornerBrackets(col, row, color, width = 3.2, cornerLen = 22, pad = 6) {
    const x = col * squareSize + pad;
    const y = row * squareSize + pad;
    const s = squareSize - pad * 2;
    const r = 6;

    let d = '';
    d += `M ${x} ${y + cornerLen} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} L ${x + cornerLen} ${y} `;
    d += `M ${x + s - cornerLen} ${y} L ${x + s - r} ${y} A ${r} ${r} 0 0 1 ${x + s} ${y + r} L ${x + s} ${y + cornerLen} `;
    d += `M ${x + s} ${y + s - cornerLen} L ${x + s} ${y + s - r} A ${r} ${r} 0 0 1 ${x + s - r} ${y + s} L ${x + s - cornerLen} ${y + s} `;
    d += `M ${x + cornerLen} ${y + s} L ${x + r} ${y + s} A ${r} ${r} 0 0 1 ${x} ${y + s - r} L ${x} ${y + s - cornerLen} `;

    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" filter="url(#shadow)"/>\n`;
  }

  // 5. Уголки клеток (3-й белый -> 2-й серый -> 1-й чёрный, как в расширении)
  svg += `  <!-- Assistant Brackets -->\n  <g id="brackets">\n`;
  // 3-й ход: a2 -> a4 (белый)
  svg += '    ' + makeCornerBrackets(0, 6, '#ffffff', 3.6, 22, 6);
  svg += '    ' + makeCornerBrackets(0, 4, '#ffffff', 3.6, 22, 6);
  // 2-й ход: f1 -> e1 (серый)
  svg += '    ' + makeCornerBrackets(5, 7, '#94a3b8', 3.6, 22, 6);
  svg += '    ' + makeCornerBrackets(4, 7, '#94a3b8', 3.6, 22, 6);
  // 1-й ход (лучший): d2 -> d4 (чёрный)
  svg += '    ' + makeCornerBrackets(3, 6, '#18181b', 3.6, 22, 6);
  svg += '    ' + makeCornerBrackets(3, 4, '#18181b', 3.6, 22, 6);
  svg += `  </g>\n\n`;

  function makeArrow(x1, y1, x2, y2, color, strokeColor = null, width = 6.2, headLen = 20) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const endLineX = x2 - Math.cos(angle) * (headLen * 0.7);
    const endLineY = y2 - Math.sin(angle) * (headLen * 0.7);

    const leftX = x2 - headLen * Math.cos(angle - Math.PI / 6);
    const leftY = y2 - headLen * Math.sin(angle - Math.PI / 6);
    const rightX = x2 - headLen * Math.cos(angle + Math.PI / 6);
    const rightY = y2 - headLen * Math.sin(angle + Math.PI / 6);

    let res = `<g filter="url(#shadow)">\n`;
    res += `  <line x1="${x1}" y1="${y1}" x2="${endLineX}" y2="${endLineY}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" />\n`;
    res += `  <polygon points="${x2},${y2} ${leftX},${leftY} ${rightX},${rightY}" fill="${color}" ${strokeColor ? `stroke="${strokeColor}" stroke-width="1.5"` : ''} stroke-linejoin="round" />\n`;
    res += `</g>\n`;
    return res;
  }

  // 6. Стрелки (3-я белая, 2-я серая, 1-я чёрная)
  svg += `  <!-- Assistant Arrows -->\n  <g id="arrows">\n`;
  svg += makeArrow(50, 640, 50, 420, '#ffffff', '#18181b');
  svg += makeArrow(540, 750, 420, 750, '#94a3b8', '#18181b');
  svg += makeArrow(350, 640, 350, 420, '#18181b', 'rgba(255,255,255,0.4)');
  svg += `  </g>\n\n`;

  function makeBadge(cx, cy, score, strokeColor) {
    const w = 48;
    const h = 22;
    const x = cx - w / 2;
    const y = cy - h / 2;
    let res = `<g filter="url(#shadow)">\n`;
    res += `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#18181b" stroke="${strokeColor}" stroke-width="1.2" />\n`;
    res += `  <text x="${cx}" y="${cy + 4.5}" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-weight="700" font-size="12" text-anchor="middle">${score}</text>\n`;
    res += `</g>\n`;
    return res;
  }

  // 7. Бейджи оценки (убывающий порядок по силе хода)
  svg += `  <!-- Assistant Eval Badges -->\n  <g id="badges">\n`;
  svg += '    ' + makeBadge(50, 400 + 13, '+0.2', '#e4e4e7');
  svg += '    ' + makeBadge(450, 700 + 13, '+0.3', '#94a3b8');
  svg += '    ' + makeBadge(350, 400 + 13, '+0.4', '#3f3f46');
  svg += `  </g>\n\n`;

  svg += `</svg>\n`;

  fs.writeFileSync(SITE_SVG_PATH, svg, 'utf8');
  console.log('Successfully generated site/board-preview.svg!');
}

main().catch((err) => {
  console.error('Error generating board:', err);
  process.exit(1);
});
