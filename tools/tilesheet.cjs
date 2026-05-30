#!/usr/bin/env node
/**
 * Tilesheet slicer for the Kenney Roguelike/RPG pack (coloured, transparent).
 *
 * Geometry: 16×16 tiles, 1px spacing, no margin → stride 17px.
 * Sheet: 49 cols × 22 rows (832×373).
 *
 * Subcommands:
 *   region <c0> <r0> <c1> <r1> <scale> <out.png>
 *       Compose tiles in the inclusive rect [c0..c1]×[r0..r1], each upscaled
 *       nearest-neighbour, with gridlines — for visually identifying tiles.
 *
 *   map <map.json> <scale>
 *       For each { "<key>": [col,row] }, extract the tile, upscale, and write
 *       apps/game/public/sprites/<key>.png.
 *
 *   montage <map.json> <scale> <out.png>
 *       Compose every mapped tile into one labelled grid (cells in map order)
 *       for a quick visual review.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const TILE = 16;
const STRIDE = 17; // 16 + 1px spacing
const ROOT = path.resolve(__dirname, '..');
const SHEET = path.join(ROOT, 'apps/game/art/tilesheet-source.png');

function loadSheet() {
  return PNG.sync.read(fs.readFileSync(SHEET));
}

/** Returns a 16×16 RGBA Buffer for tile (col,row). */
function getTile(sheet, col, row) {
  const out = Buffer.alloc(TILE * TILE * 4);
  const x0 = col * STRIDE;
  const y0 = row * STRIDE;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const si = ((y0 + y) * sheet.width + (x0 + x)) * 4;
      const di = (y * TILE + x) * 4;
      sheet.data.copy(out, di, si, si + 4);
    }
  }
  return out;
}

/** Nearest-neighbour upscale of a TILE×TILE RGBA buffer by `scale`. */
function upscale(tile, scale) {
  const size = TILE * scale;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const si = ((Math.floor(y / scale)) * TILE + Math.floor(x / scale)) * 4;
      const di = (y * size + x) * 4;
      tile.copy(out, di, si, si + 4);
    }
  }
  return out;
}

function writePng(outPath, width, height, rgba) {
  const png = new PNG({ width, height });
  rgba.copy(png.data);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

/** Blit a w×h RGBA block into a destination canvas at (dx,dy). */
function blit(dst, dstW, src, w, h, dx, dy) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      const di = ((dy + y) * dstW + (dx + x)) * 4;
      src.copy(dst, di, si, si + 4);
    }
  }
}

function cmdRegion(c0, r0, c1, r1, scale, out) {
  const sheet = loadSheet();
  const cols = c1 - c0 + 1;
  const rows = r1 - r0 + 1;
  const cell = TILE * scale + 2; // +2 for a 1px gridline gutter
  const W = cols * cell;
  const H = rows * cell;
  const canvas = Buffer.alloc(W * H * 4); // transparent
  // light gridline colour
  for (let i = 0; i < canvas.length; i += 4) { canvas[i] = 40; canvas[i + 1] = 50; canvas[i + 2] = 70; canvas[i + 3] = 255; }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const up = upscale(getTile(sheet, c0 + c, r0 + r), scale);
      blit(canvas, W, up, TILE * scale, TILE * scale, c * cell + 1, r * cell + 1);
    }
  }
  writePng(out, W, H, canvas);
  console.log(`region [${c0}..${c1}]x[${r0}..${r1}] @${scale}x -> ${out} (${W}x${H})`);
}

function cmdMap(mapPath, scale) {
  const sheet = loadSheet();
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const size = TILE * scale;
  let n = 0;
  for (const [key, [col, row]] of Object.entries(map)) {
    const up = upscale(getTile(sheet, col, row), scale);
    writePng(path.join(ROOT, 'apps/game/public/sprites', `${key}.png`), size, size, up);
    n++;
  }
  console.log(`wrote ${n} sprites @ ${size}x${size} to apps/game/public/sprites/`);
}

function cmdMontage(mapPath, scale, out) {
  const sheet = loadSheet();
  const map = Object.entries(JSON.parse(fs.readFileSync(mapPath, 'utf8')));
  const cols = 8;
  const rows = Math.ceil(map.length / cols);
  const cell = TILE * scale + 4;
  const W = cols * cell;
  const H = rows * cell;
  const canvas = Buffer.alloc(W * H * 4);
  for (let i = 0; i < canvas.length; i += 4) { canvas[i] = 12; canvas[i + 1] = 16; canvas[i + 2] = 26; canvas[i + 3] = 255; }
  map.forEach(([, [col, row]], i) => {
    const up = upscale(getTile(sheet, col, row), scale);
    const cx = (i % cols) * cell + 2;
    const cy = Math.floor(i / cols) * cell + 2;
    blit(canvas, W, up, TILE * scale, TILE * scale, cx, cy);
  });
  writePng(out, W, H, canvas);
  console.log(`montage of ${map.length} tiles @${scale}x -> ${out} (order: ${map.map(([k]) => k).join(', ')})`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'region') cmdRegion(+args[0], +args[1], +args[2], +args[3], +args[4], args[5]);
else if (cmd === 'map') cmdMap(args[0], +(args[1] ?? 4));
else if (cmd === 'montage') cmdMontage(args[0], +(args[1] ?? 4), args[2]);
else { console.error('usage: region|map|montage — see file header'); process.exit(1); }
