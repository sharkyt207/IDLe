/**
 * App icons, drawn rather than stored.
 *
 *   node scripts/make-icons.mjs
 *
 * The project has no binary assets: models are draw calls, sounds are
 * oscillators. An installable web app needs real PNGs though, so they are
 * generated here at build time from the same palette the game uses - `public/`
 * stays out of version control and a palette change reaches the home screen
 * icon like it reaches everything else.
 *
 * The PNG encoder is hand-rolled on top of `node:zlib` for the same reason the
 * rest of the project has no dependencies: it is forty lines, and a build that
 * pulls a rasteriser to draw six rectangles has its priorities wrong.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(OUT, { recursive: true });

// --- palette (src/styles.css) ----------------------------------------------
const BG_TOP = [0x22, 0x27, 0x2f];
const BG_BOTTOM = [0x16, 0x19, 0x1e];
const YELLOW = [0xf0, 0xc0, 0x4a];
const YELLOW_SIDE = [0xc9, 0x9c, 0x33];
const YELLOW_DARK = [0x8a, 0x6f, 0x24];
const STEEL = [0x9a, 0xa4, 0xb0];
const STEEL_SIDE = [0x6d, 0x76, 0x82];
const STEEL_DARK = [0x4a, 0x51, 0x5b];

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** RGBA pixel buffer -> PNG. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10-12: compression, filter, interlace - all zero.

  // One filter byte (0 = none) per scanline.
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const from = y * width * 4;
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, from, from + width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Drawing
//
// Everything is a coverage function over unit coordinates, sampled 4x4 per
// pixel. That is slow and completely irrelevant: this runs once per build and
// produces four images.
// ---------------------------------------------------------------------------

const SAMPLES = 4;

class Canvas {
  constructor(size) {
    this.size = size;
    this.data = Buffer.alloc(size * size * 4);
  }

  /**
   * @param coverage (x, y) in 0…1 -> 0…1 alpha
   * @param color [r, g, b] or (x, y) -> [r, g, b]
   */
  paint(coverage, color) {
    const { size, data } = this;
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        let alpha = 0;
        for (let sy = 0; sy < SAMPLES; sy++) {
          for (let sx = 0; sx < SAMPLES; sx++) {
            const x = (px + (sx + 0.5) / SAMPLES) / size;
            const y = (py + (sy + 0.5) / SAMPLES) / size;
            alpha += coverage(x, y);
          }
        }
        alpha /= SAMPLES * SAMPLES;
        if (alpha <= 0) continue;

        const cx = (px + 0.5) / size;
        const cy = (py + 0.5) / size;
        const [r, g, b] = typeof color === 'function' ? color(cx, cy) : color;
        const i = (py * size + px) * 4;
        // Source-over onto whatever is already there.
        const dstA = data[i + 3] / 255;
        const outA = alpha + dstA * (1 - alpha);
        if (outA <= 0) continue;
        data[i] = Math.round((r * alpha + data[i] * dstA * (1 - alpha)) / outA);
        data[i + 1] = Math.round((g * alpha + data[i + 1] * dstA * (1 - alpha)) / outA);
        data[i + 2] = Math.round((b * alpha + data[i + 2] * dstA * (1 - alpha)) / outA);
        data[i + 3] = Math.round(outA * 255);
      }
    }
  }
}

const inside = (test) => (x, y) => (test(x, y) ? 1 : 0);

function roundedRect(x0, y0, x1, y1, radius) {
  return inside((x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const dx = Math.max(x0 + radius - x, 0, x - (x1 - radius));
    const dy = Math.max(y0 + radius - y, 0, y - (y1 - radius));
    return dx * dx + dy * dy <= radius * radius;
  });
}

function polygon(points) {
  return inside((x, y) => {
    let hit = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  });
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/**
 * An isometric block on a dark plate: the shape the whole yard is built from.
 *
 * @param bleed `full` fills the canvas (maskable icons are cropped by the
 *   platform), `plate` leaves a rounded tile with a margin.
 */
function drawIcon(size, bleed) {
  const c = new Canvas(size);
  const inset = bleed === 'full' ? 0 : 0.055;

  c.paint(
    bleed === 'full'
      ? () => 1
      : roundedRect(inset, inset, 1 - inset, 1 - inset, 0.22),
    (_x, y) => mix(BG_TOP, BG_BOTTOM, y),
  );

  // Maskable icons lose up to 20 % on every edge, so the cluster shrinks to
  // fit the safe zone rather than trusting the launcher to be gentle.
  const scale = bleed === 'full' ? 0.78 : 1;

  // Two stacked blocks, drawn back to front: the steel one behind, the accent
  // one in front. Painter's algorithm, exactly like the game's world.
  block(c, 0.585, 0.435, 0.15 * scale, STEEL, STEEL_SIDE, STEEL_DARK);
  block(c, 0.455, 0.565, 0.235 * scale, YELLOW, YELLOW_SIDE, YELLOW_DARK);

  return c;
}

/** One isometric block: top face, then the two visible sides. */
function block(c, cx, cy, s, top, side, dark) {
  const h = s * 0.62;
  c.paint(polygon([[cx - s, cy], [cx, cy + s * 0.5], [cx, cy + s * 0.5 + h], [cx - s, cy + h]]), dark);
  c.paint(polygon([[cx, cy + s * 0.5], [cx + s, cy], [cx + s, cy + h], [cx, cy + s * 0.5 + h]]), side);
  c.paint(polygon([[cx, cy - s * 0.5], [cx + s, cy], [cx, cy + s * 0.5], [cx - s, cy]]), top);
}

/** Single block, no companion - at 16px anything else is mud. */
function drawFavicon(size) {
  const c = new Canvas(size);
  c.paint(roundedRect(0, 0, 1, 1, 0.2), (_x, y) => mix(BG_TOP, BG_BOTTOM, y));
  block(c, 0.5, 0.5, 0.34, YELLOW, YELLOW_SIDE, YELLOW_DARK);
  return c;
}

const ICONS = [
  { file: 'icon-192.png', size: 192, draw: (n) => drawIcon(n, 'plate') },
  { file: 'icon-512.png', size: 512, draw: (n) => drawIcon(n, 'plate') },
  { file: 'icon-maskable-512.png', size: 512, draw: (n) => drawIcon(n, 'full') },
  // iOS never applies a mask of its own, so the touch icon ships its own plate.
  { file: 'apple-touch-icon.png', size: 180, draw: (n) => drawIcon(n, 'full') },
  { file: 'favicon-64.png', size: 64, draw: drawFavicon },
];

for (const icon of ICONS) {
  const canvas = icon.draw(icon.size);
  const png = encodePng(icon.size, icon.size, canvas.data);
  writeFileSync(resolve(OUT, icon.file), png);
  console.log(`${icon.file.padEnd(24)} ${icon.size}×${icon.size}  ${(png.length / 1024).toFixed(1)} kB`);
}
