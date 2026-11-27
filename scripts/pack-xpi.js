/**
 * Кроссплатформенный упаковщик .xpi (ZIP) на чистом Node.js (fs + zlib)
 * Не требует PowerShell или сторонних утилит и безопасно работает с любыми путями
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  return { dosTime, dosDate };
}

function collectFilesRecursive(rootDir, currentDir = rootDir, excludeExt = null) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursive(rootDir, fullPath, excludeExt));
    } else if (entry.isFile()) {
      if (excludeExt && path.extname(entry.name).toLowerCase() === excludeExt.toLowerCase()) {
        continue;
      }
      const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');
      files.push({ fullPath, relPath });
    }
  }
  return files;
}

function packDirectoryToXpi(sourceDir, outXpiPath, options = {}) {
  const excludeExt = options.excludeExt || null;
  const files = collectFilesRecursive(sourceDir, sourceDir, excludeExt);
  // Ставим manifest.json первым в архиве для быстрой валидации браузером
  files.sort((a, b) => {
    if (a.relPath === 'manifest.json') return -1;
    if (b.relPath === 'manifest.json') return 1;
    return a.relPath.localeCompare(b.relPath);
  });

  fs.mkdirSync(path.dirname(outXpiPath), { recursive: true });
  if (fs.existsSync(outXpiPath)) {
    fs.unlinkSync(outXpiPath);
  }

  const fd = fs.openSync(outXpiPath, 'w');
  const centralRecords = [];
  let offset = 0;

  try {
    for (const file of files) {
      const stat = fs.statSync(file.fullPath);
      const rawData = fs.readFileSync(file.fullPath);
      const fileCrc = crc32(rawData);
      const deflated = zlib.deflateRawSync(rawData, { level: 6 });
      const useDeflate = deflated.length < rawData.length;
      const storedData = useDeflate ? deflated : rawData;
      const method = useDeflate ? 8 : 0;
      const { dosTime, dosDate } = toDosDateTime(stat.mtime || new Date());
      const nameBuf = Buffer.from(file.relPath, 'utf8');

      const localHeader = Buffer.alloc(30);
      localHeader.writeUInt32LE(0x04034b50, 0);
      localHeader.writeUInt16LE(20, 4);
      localHeader.writeUInt16LE(0x0800, 6); // UTF-8
      localHeader.writeUInt16LE(method, 8);
      localHeader.writeUInt16LE(dosTime, 10);
      localHeader.writeUInt16LE(dosDate, 12);
      localHeader.writeUInt32LE(fileCrc, 14);
      localHeader.writeUInt32LE(storedData.length, 18);
      localHeader.writeUInt32LE(rawData.length, 22);
      localHeader.writeUInt16LE(nameBuf.length, 26);
      localHeader.writeUInt16LE(0, 28);

      const localHeaderOffset = offset;
      fs.writeSync(fd, localHeader);
      offset += localHeader.length;
      fs.writeSync(fd, nameBuf);
      offset += nameBuf.length;
      fs.writeSync(fd, storedData);
      offset += storedData.length;

      const centralHeader = Buffer.alloc(46);
      centralHeader.writeUInt32LE(0x02014b50, 0);
      centralHeader.writeUInt16LE(20, 4);
      centralHeader.writeUInt16LE(20, 6);
      centralHeader.writeUInt16LE(0x0800, 8); // UTF-8
      centralHeader.writeUInt16LE(method, 10);
      centralHeader.writeUInt16LE(dosTime, 12);
      centralHeader.writeUInt16LE(dosDate, 14);
      centralHeader.writeUInt32LE(fileCrc, 16);
      centralHeader.writeUInt32LE(storedData.length, 20);
      centralHeader.writeUInt32LE(rawData.length, 24);
      centralHeader.writeUInt16LE(nameBuf.length, 28);
      centralHeader.writeUInt16LE(0, 30);
      centralHeader.writeUInt16LE(0, 32);
      centralHeader.writeUInt16LE(0, 34);
      centralHeader.writeUInt16LE(0, 36);
      centralHeader.writeUInt32LE(0, 38);
      centralHeader.writeUInt32LE(localHeaderOffset, 42);

      centralRecords.push(Buffer.concat([centralHeader, nameBuf]));
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const rec of centralRecords) {
      fs.writeSync(fd, rec);
      centralDirSize += rec.length;
    }

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(centralRecords.length, 8);
    eocd.writeUInt16LE(centralRecords.length, 10);
    eocd.writeUInt32LE(centralDirSize, 12);
    eocd.writeUInt32LE(centralDirOffset, 16);
    eocd.writeUInt16LE(0, 20);
    fs.writeSync(fd, eocd);
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = { packDirectoryToXpi };
