const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

// ─── PNG Writer Helper ───
function writePng(filename, width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type (6 = RGBA)
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk (with Scanline Filter 0 = None)
  const scanlineLength = width * 4 + 1;
  const filtered = Buffer.alloc(height * scanlineLength);
  for (let y = 0; y < height; y++) {
    filtered[y * scanlineLength] = 0;
    rgbaBuffer.copy(
      filtered,
      y * scanlineLength + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }
  const compressed = zlib.deflateSync(filtered);
  const idat = createChunk('IDAT', compressed);

  const iend = createChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdr, idat, iend]);
  const destDir = path.dirname(filename);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.writeFileSync(filename, png);
  console.log(`[PNG Builder] Saved ${path.basename(filename)} successfully.`);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.slice(4, 8 + length));
  chunk.writeUInt32BE(crc, 8 + length);
  return chunk;
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ─── Drawing Helper Maths ───
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx*dx + dy*dy;
  if (l2 === 0) return Math.sqrt((px - x1)**2 + (py - y1)**2);
  let t = ((px - x1) * dx + (py - py) * dy) / l2; // Wait, typo: py - py should be py - y1
  t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - (x1 + t * dx))**2 + (py - (y1 + t * dy))**2);
}

function inPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > py) !== (yj > py))
        && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Generate Task Icon (Purple Gradient Circle + White Checkmark) ───
function generateTaskIcon(destPath) {
  const width = 192, height = 192;
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - 96;
      const dy = y - 96;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 88) {
        // Draw gradient background (Purple: #8B5CF6 to #6D28D9)
        const factor = (dx + dy + 192) / 384;
        const r = Math.round(139 + (109 - 139) * factor);
        const g = Math.round(92 + (40 - 92) * factor);
        const b = Math.round(246 + (217 - 246) * factor);

        // Check if inside checkmark (lines: (60,96)->(84,120) and (84,120)->(136,68))
        const d1 = distToSegment(x, y, 60, 98, 84, 122);
        const d2 = distToSegment(x, y, 84, 122, 136, 70);
        const onCheckmark = Math.min(d1, d2) < 7;

        if (onCheckmark) {
          buffer[idx] = 255;   // R
          buffer[idx+1] = 255; // G
          buffer[idx+2] = 255; // B
          buffer[idx+3] = 255; // A
        } else {
          buffer[idx] = r;
          buffer[idx+1] = g;
          buffer[idx+2] = b;
          buffer[idx+3] = 255;
        }
      } else {
        // Transparent border
        buffer[idx+3] = 0;
      }
    }
  }
  writePng(destPath, width, height, buffer);
}

// ─── Generate Habit Icon (Amber Gradient Circle + White Star) ───
function generateHabitIcon(destPath) {
  const width = 192, height = 192;
  const buffer = Buffer.alloc(width * height * 4);

  // Star Points Setup
  const starPoints = [];
  const cx = 96, cy = 96, spikes = 5, outerRadius = 40, innerRadius = 18;
  let rot = Math.PI / 2 * 3;
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes; i++) {
    starPoints.push({ x: cx + Math.cos(rot) * outerRadius, y: cy + Math.sin(rot) * outerRadius });
    rot += step;
    starPoints.push({ x: cx + Math.cos(rot) * innerRadius, y: cy + Math.sin(rot) * innerRadius });
    rot += step;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - 96;
      const dy = y - 96;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 88) {
        // Draw gradient background (Amber: #F59E0B to #D97706)
        const factor = (dx + dy + 192) / 384;
        const r = Math.round(245 + (217 - 245) * factor);
        const g = Math.round(158 + (119 - 158) * factor);
        const b = Math.round(11 + (6 - 11) * factor);

        if (inPolygon(x, y, starPoints)) {
          buffer[idx] = 255;
          buffer[idx+1] = 255;
          buffer[idx+2] = 255;
          buffer[idx+3] = 255;
        } else {
          buffer[idx] = r;
          buffer[idx+1] = g;
          buffer[idx+2] = b;
          buffer[idx+3] = 255;
        }
      } else {
        buffer[idx+3] = 0;
      }
    }
  }
  writePng(destPath, width, height, buffer);
}

// ─── Generate Timer Icon (Red/Rose Gradient Circle + White Alarm Clock) ───
function generateTimerIcon(destPath) {
  const width = 192, height = 192;
  const buffer = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - 96;
      const dy = y - 96;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 88) {
        // Draw gradient background (Rose/Red: #EF4444 to #B91C1C)
        const factor = (dx + dy + 192) / 384;
        const r = Math.round(239 + (185 - 239) * factor);
        const g = Math.round(68 + (28 - 68) * factor);
        const b = Math.round(68 + (28 - 68) * factor);

        // Clock shapes in white
        const distToClockCenter = Math.sqrt((x - 96)**2 + (y - 102)**2);
        const onClockRing = Math.abs(distToClockCenter - 34) < 5;
        
        // Hands: Hour hand: (96,102) to (96,82); Minute hand: (96,102) to (112,102)
        const dHourHand = distToSegment(x, y, 96, 102, 96, 82);
        const dMinHand = distToSegment(x, y, 96, 102, 112, 102);
        const onHands = Math.min(dHourHand, dMinHand) < 3.5;

        // Legs: small lines from center out
        const dLegLeft = distToSegment(x, y, 66, 136, 56, 146);
        const dLegRight = distToSegment(x, y, 126, 136, 136, 146);
        const onLegs = Math.min(dLegLeft, dLegRight) < 4;

        // Alarm bells (semi-circles/ears on top)
        const distToLeftEar = Math.sqrt((x - 64)**2 + (y - 66)**2);
        const distToRightEar = Math.sqrt((x - 128)**2 + (y - 66)**2);
        const onEars = Math.abs(distToLeftEar - 12) < 4 || Math.abs(distToRightEar - 12) < 4;
        const inEarAngleRange = (y < 66); // Top half only

        const drawClock = onClockRing || onHands || onLegs || (onEars && inEarAngleRange);

        if (drawClock) {
          buffer[idx] = 255;
          buffer[idx+1] = 255;
          buffer[idx+2] = 255;
          buffer[idx+3] = 255;
        } else {
          buffer[idx] = r;
          buffer[idx+1] = g;
          buffer[idx+2] = b;
          buffer[idx+3] = 255;
        }
      } else {
        buffer[idx+3] = 0;
      }
    }
  }
  writePng(destPath, width, height, buffer);
}

// ─── Main Execution ───
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
generateTaskIcon(path.join(iconsDir, 'badge-task.png'));
generateHabitIcon(path.join(iconsDir, 'badge-habit.png'));
generateTimerIcon(path.join(iconsDir, 'badge-timer.png'));
