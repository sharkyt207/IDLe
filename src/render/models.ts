import { LEVEL_H, TILE_H, TILE_W, tileToWorld, type Point } from '../world/iso';

/**
 * Isometric model library.
 *
 * Everything is drawn from vector primitives - no image assets, which keeps
 * the download tiny and lets a structure recolour itself per upgrade stage.
 * A model is a table entry plus, where it earns it, a small detail painter.
 */

export interface ModelSpec {
  /** Footprint in tiles (defaults to the structure's own size). */
  w?: number;
  d?: number;
  /** Height in "levels" per stage 1–5. */
  height: number[];
  /** Body colour per stage - the visible renovation. */
  color: string[];
  roof?: string;
  detail?: DetailKind;
  /** Lights up at night. */
  lit?: boolean;
  flat?: boolean;
}

type DetailKind =
  | 'crane'
  | 'grabber'
  | 'belt'
  | 'chimney'
  | 'antenna'
  | 'rack'
  | 'pile'
  | 'tree'
  | 'flowers'
  | 'lamp'
  | 'flag'
  | 'sign'
  | 'sculpture'
  | 'car'
  | 'gantry'
  | 'rails'
  | 'workbench'
  | 'scale'
  | 'silo';

/** Five-stage palettes: rusty shed → renovated → hall → hightech → futuristic. */
const STAGES = {
  industrial: ['#6b5f52', '#7a6c58', '#8a8377', '#93a0a8', '#a8bcc9'],
  hall: ['#5f6a72', '#6d7a82', '#7d8d96', '#8fa4b0', '#a6c0cf'],
  machine: ['#6d6a63', '#7b7870', '#8b8a82', '#95a09b', '#a4b8bd'],
  warm: ['#7a5c44', '#8a6a4c', '#9a7c5a', '#ab9070', '#c0a888'],
};

export const MODELS: Record<string, ModelSpec> = {
  // --- production ---------------------------------------------------------
  crane: { height: [1.6, 2, 2.4, 2.8, 3.2], color: STAGES.machine, detail: 'crane' },
  grabber: { height: [1.4, 1.7, 2, 2.4, 2.8], color: STAGES.machine, detail: 'grabber' },
  robot: { height: [1.3, 1.6, 1.9, 2.2, 2.6], color: STAGES.machine, detail: 'antenna', lit: true },
  shredder: { height: [1.8, 2.2, 2.6, 3, 3.4], color: STAGES.industrial, detail: 'chimney' },
  ai_line: { height: [2, 2.4, 2.8, 3.2, 3.6], color: STAGES.hall, detail: 'antenna', lit: true },
  conveyor: { height: [0.5, 0.6, 0.7, 0.8, 0.9], color: STAGES.machine, detail: 'belt' },
  sorter: { height: [1, 1.2, 1.4, 1.6, 1.8], color: STAGES.machine, detail: 'belt' },
  sort_ai: { height: [1.2, 1.5, 1.8, 2.1, 2.4], color: STAGES.hall, detail: 'antenna', lit: true },
  furnace: { height: [1.6, 1.9, 2.2, 2.6, 3], color: STAGES.warm, detail: 'chimney', lit: true },
  plant: { height: [1.5, 1.8, 2.1, 2.5, 2.9], color: STAGES.hall, detail: 'chimney', lit: true },
  press: { height: [1.4, 1.7, 2, 2.3, 2.7], color: STAGES.machine, detail: 'gantry' },

  // --- storage ------------------------------------------------------------
  scrap_pile: { height: [0.6, 0.9, 1.2, 1.5, 1.8], color: STAGES.industrial, detail: 'pile' },
  warehouse: { height: [1.6, 1.9, 2.2, 2.6, 3], color: STAGES.hall, roof: '#8d99a4', lit: true },
  high_rack: { height: [2.4, 2.8, 3.2, 3.6, 4], color: STAGES.hall, detail: 'rack', lit: true },
  silo: { height: [3], color: STAGES.industrial, detail: 'silo' },

  // --- buildings ----------------------------------------------------------
  smelter: { height: [2.4], color: STAGES.warm, detail: 'chimney', lit: true },
  lab: { height: [2.2], color: ['#5d7186'], detail: 'antenna', lit: true },
  office: { height: [1.6, 2, 2.4, 2.8, 3.2], color: ['#6a7c8c', '#758a9c', '#8098ad', '#8ba6bd', '#9ab6cd'], lit: true },
  garage: { height: [1.2, 1.4, 1.6, 1.9, 2.2], color: STAGES.industrial, roof: '#79838d' },
  depot: { height: [1.8, 2.1, 2.4, 2.8, 3.2], color: STAGES.hall, roof: '#8d99a4', lit: true },
  hall: { height: [2], color: STAGES.hall, roof: '#8d99a4', lit: true },
  recycling_hall: { height: [2.2], color: ['#4f7a58'], roof: '#6f9a78', lit: true },
  factory: { height: [2.8], color: STAGES.industrial, detail: 'chimney', lit: true },
  steel_mill: { height: [3.2], color: ['#7a5a48'], detail: 'chimney', lit: true },
  station: { height: [1.8], color: ['#6a6258'], detail: 'rails', lit: true },
  crane_port: { height: [2.2], color: ['#4a6a80'], detail: 'gantry', lit: true },
  antenna_tower: { height: [3.2, 3.6, 4, 4.4, 4.8], color: ['#c8d2dc'], detail: 'antenna', lit: true },

  // --- fixtures -----------------------------------------------------------
  scale: { w: 2, d: 2, height: [0.18], color: ['#5a5a5a'], detail: 'scale', flat: true },
  office_container: { w: 2, d: 1, height: [1], color: ['#5f7f9a'], lit: true },
  workbench: { w: 2, d: 1, height: [0.6], color: ['#7a6a4a'], detail: 'workbench' },

  // --- decoration ---------------------------------------------------------
  tree: { w: 1, d: 1, height: [1.6], color: ['#3f6b3f'], detail: 'tree' },
  flowers: { w: 1, d: 1, height: [0.2], color: ['#7a5f7a'], detail: 'flowers', flat: true },
  lamp: { w: 1, d: 1, height: [1.8], color: ['#6a6f76'], detail: 'lamp', lit: true },
  sign: { w: 1, d: 1, height: [1.2], color: ['#7a6a52'], detail: 'sign', lit: true },
  flag: { w: 1, d: 1, height: [2.2], color: ['#9aa2aa'], detail: 'flag' },
  decor_container: { w: 1, d: 1, height: [0.8], color: ['#3f7f9f'] },
  oldtimer: { w: 1, d: 1, height: [0.5], color: ['#9a3f3f'], detail: 'car' },
  sculpture: { w: 1, d: 1, height: [1.6], color: ['#8a8a92'], detail: 'sculpture' },
};

export interface DrawOptions {
  stage: number;
  /** Seconds, for animation. */
  time: number;
  /** 0 (day) … 1 (night) - turns lights on. */
  darkness: number;
  /** Machines animate only when the yard is actually working. */
  active: boolean;
  /** Dimmed preview while choosing a slot. */
  ghost?: boolean;
}

/** Corners of a tile-aligned footprint, ground level. */
function corners(tx: number, ty: number, w: number, d: number): [Point, Point, Point, Point] {
  return [
    tileToWorld(tx, ty),
    tileToWorld(tx + w, ty),
    tileToWorld(tx + w, ty + d),
    tileToWorld(tx, ty + d),
  ];
}

/** Parses '#rgb', '#rrggbb' and 'rgb(r,g,b)' - shaded output feeds back in. */
function parseColor(color: string): [number, number, number] {
  if (color.startsWith('rgb')) {
    const parts = color.match(/-?\d+/g);
    if (parts && parts.length >= 3) return [+parts[0], +parts[1], +parts[2]];
    return [128, 128, 128];
  }
  const clean = color.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  if (Number.isNaN(num)) return [128, 128, 128];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Lightens (amount > 0) or darkens (amount < 0) any CSS colour we produce. */
export function shade(color: string, amount: number): string {
  const [r, g, b] = parseColor(color);
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/** Draws a cuboid volume; returns the centre of its top face. */
export function isoBox(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  w: number,
  d: number,
  heightPx: number,
  color: string,
  roof?: string,
): Point {
  const [n, e, s, wc] = corners(tx, ty, w, d);
  const up = (p: Point): Point => ({ x: p.x, y: p.y - heightPx });

  // Right face (east→south) and left face (west→south).
  ctx.fillStyle = shade(color, -0.28);
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(s.x, s.y);
  ctx.lineTo(up(s).x, up(s).y);
  ctx.lineTo(up(e).x, up(e).y);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = shade(color, -0.48);
  ctx.beginPath();
  ctx.moveTo(wc.x, wc.y);
  ctx.lineTo(s.x, s.y);
  ctx.lineTo(up(s).x, up(s).y);
  ctx.lineTo(up(wc).x, up(wc).y);
  ctx.closePath();
  ctx.fill();

  // Top face.
  ctx.fillStyle = roof ?? shade(color, 0.08);
  ctx.beginPath();
  ctx.moveTo(up(n).x, up(n).y);
  ctx.lineTo(up(e).x, up(e).y);
  ctx.lineTo(up(s).x, up(s).y);
  ctx.lineTo(up(wc).x, up(wc).y);
  ctx.closePath();
  ctx.fill();

  return { x: (up(n).x + up(s).x) / 2, y: (up(n).y + up(s).y) / 2 };
}

/** Ground shadow, drawn before the volume. */
function shadow(ctx: CanvasRenderingContext2D, tx: number, ty: number, w: number, d: number): void {
  const [n, e, s, wc] = corners(tx, ty, w, d);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.moveTo(n.x, n.y);
  ctx.lineTo(e.x, e.y);
  ctx.lineTo(s.x, s.y);
  ctx.lineTo(wc.x, wc.y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Draws one model. `size` is the structure footprint; the spec may override it
 * (a tree occupies one tile even inside a three-tile slot).
 */
export function drawModel(
  ctx: CanvasRenderingContext2D,
  model: string,
  tx: number,
  ty: number,
  size: number,
  opts: DrawOptions,
): void {
  const spec = MODELS[model];
  if (!spec) return;

  const w = spec.w ?? size;
  const d = spec.d ?? size;
  const stageIndex = Math.min(opts.stage, spec.height.length) - 1;
  const height = spec.height[Math.max(0, stageIndex)] * LEVEL_H;
  const color = spec.color[Math.min(opts.stage, spec.color.length) - 1] ?? spec.color[0];

  ctx.save();
  if (opts.ghost) ctx.globalAlpha = 0.45;

  shadow(ctx, tx, ty, w, d);

  if (!spec.flat) {
    const top = isoBox(ctx, tx, ty, w, d, height, color, spec.roof);
    if (spec.lit && opts.darkness > 0.35) drawWindows(ctx, tx, ty, w, d, height, opts.darkness);
    drawDetail(ctx, spec.detail, tx, ty, w, d, height, top, color, opts);
  } else {
    const flat = isoBox(ctx, tx, ty, w, d, height, color, spec.roof);
    drawDetail(ctx, spec.detail, tx, ty, w, d, height, flat, color, opts);
  }

  ctx.restore();
}

/** Lit windows on the south-facing walls. */
function drawWindows(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  w: number,
  d: number,
  height: number,
  darkness: number,
): void {
  const [, e, s] = corners(tx, ty, w, d);
  const rows = Math.max(1, Math.floor(height / LEVEL_H));
  ctx.save();
  ctx.fillStyle = `rgba(255,214,130,${0.25 + darkness * 0.6})`;
  for (let r = 0; r < rows; r++) {
    const t = (r + 0.5) / rows;
    for (let c = 0.25; c < 1; c += 0.35) {
      const x = s.x + (e.x - s.x) * c;
      const y = s.y + (e.y - s.y) * c - height * t;
      ctx.fillRect(x - 3, y - 5, 6, 6);
    }
  }
  ctx.restore();
}

function drawDetail(
  ctx: CanvasRenderingContext2D,
  detail: DetailKind | undefined,
  tx: number,
  ty: number,
  w: number,
  d: number,
  height: number,
  top: Point,
  color: string,
  opts: DrawOptions,
): void {
  if (!detail) return;
  const t = opts.time;
  const centre = tileToWorld(tx + w / 2, ty + d / 2);

  switch (detail) {
    case 'crane': {
      // Slewing jib - only turns while the yard is working.
      const angle = opts.active ? Math.sin(t * 0.6) * 0.9 : 0.3;
      const len = TILE_W * (0.7 + opts.stage * 0.12);
      ctx.strokeStyle = shade(color, 0.25);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      const ex = top.x + Math.cos(angle) * len;
      const ey = top.y + Math.sin(angle) * len * (TILE_H / TILE_W);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      // Hoist rope and magnet.
      const drop = 14 + Math.sin(t * 1.4) * (opts.active ? 10 : 0);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#2c2f34';
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex, ey + drop);
      ctx.stroke();
      ctx.fillStyle = '#b8433a';
      ctx.beginPath();
      ctx.arc(ex, ey + drop + 4, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'grabber': {
      const swing = opts.active ? Math.sin(t * 1.5) * 0.5 : 0;
      ctx.strokeStyle = shade(color, 0.3);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x + Math.cos(swing) * 34, top.y + 14 + Math.sin(swing) * 8);
      ctx.stroke();
      break;
    }
    case 'belt': {
      // Rollers scrolling along the top face.
      const [n, e] = corners(tx, ty, w, d);
      ctx.strokeStyle = 'rgba(20,22,26,0.55)';
      ctx.lineWidth = 2;
      const offset = opts.active ? (t * 26) % 12 : 0;
      for (let i = -12; i < TILE_W * w; i += 12) {
        const p = (i + offset) / (TILE_W * w);
        if (p < 0 || p > 1) continue;
        const x = n.x + (e.x - n.x) * p;
        const y = n.y + (e.y - n.y) * p - height;
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 3);
        ctx.lineTo(x + 6, y - 3);
        ctx.stroke();
      }
      break;
    }
    case 'chimney': {
      const cx = top.x + TILE_W * 0.16;
      const cy = top.y - 4;
      const h = 16 + opts.stage * 4;
      ctx.fillStyle = shade(color, -0.35);
      ctx.fillRect(cx - 5, cy - h, 10, h);
      if (opts.active) {
        // Smoke puffs rise and fade.
        for (let i = 0; i < 3; i++) {
          const phase = (t * 0.5 + i / 3) % 1;
          ctx.globalAlpha = (1 - phase) * 0.32;
          ctx.fillStyle = '#c9cdd4';
          ctx.beginPath();
          ctx.arc(cx + Math.sin(phase * 4 + i) * 6, cy - h - phase * 40, 5 + phase * 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'antenna': {
      ctx.strokeStyle = '#aeb6c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(top.x, top.y - 22);
      ctx.stroke();
      const blink = Math.sin(t * 3) > 0;
      ctx.fillStyle = blink ? '#ff6b5a' : '#5a2a26';
      ctx.beginPath();
      ctx.arc(top.x, top.y - 24, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'rack': {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 2;
      for (let i = 1; i < 4; i++) {
        const y = top.y + (height * i) / 4;
        ctx.beginPath();
        ctx.moveTo(top.x - TILE_W * 0.4, y);
        ctx.lineTo(top.x + TILE_W * 0.4, y);
        ctx.stroke();
      }
      break;
    }
    case 'pile': {
      // Loose scrap on top of the heap.
      ctx.fillStyle = shade(color, 0.18);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.7;
        ctx.fillRect(top.x + Math.cos(a) * 12 - 3, top.y + Math.sin(a) * 6 - 3, 7, 5);
      }
      break;
    }
    case 'silo': {
      ctx.fillStyle = shade(color, 0.15);
      ctx.beginPath();
      ctx.ellipse(top.x, top.y, TILE_W * 0.34, TILE_H * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'gantry': {
      ctx.strokeStyle = shade(color, 0.3);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(top.x - TILE_W * 0.5, top.y + 6);
      ctx.lineTo(top.x - TILE_W * 0.4, top.y - 26);
      ctx.lineTo(top.x + TILE_W * 0.4, top.y - 26);
      ctx.lineTo(top.x + TILE_W * 0.5, top.y + 6);
      ctx.stroke();
      const slide = opts.active ? Math.sin(t * 0.8) * TILE_W * 0.3 : 0;
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(top.x + slide - 6, top.y - 30, 12, 8);
      break;
    }
    case 'rails': {
      ctx.strokeStyle = '#8a8f96';
      ctx.lineWidth = 2.5;
      const [n, e] = corners(tx, ty, w, d);
      for (const off of [-6, 6]) {
        ctx.beginPath();
        ctx.moveTo(n.x, n.y + off);
        ctx.lineTo(e.x, e.y + off);
        ctx.stroke();
      }
      break;
    }
    case 'workbench': {
      ctx.fillStyle = '#4a4136';
      ctx.fillRect(top.x - 12, top.y - 4, 24, 4);
      if (opts.active && Math.sin(t * 8) > 0.6) {
        ctx.fillStyle = '#ffd27a';
        ctx.beginPath();
        ctx.arc(top.x + 8, top.y - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'scale': {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      const [n, e, s, wc] = corners(tx, ty, w, d);
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - height);
      ctx.lineTo(e.x, e.y - height);
      ctx.lineTo(s.x, s.y - height);
      ctx.lineTo(wc.x, wc.y - height);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'tree': {
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(centre.x - 2.5, centre.y - height * 0.55, 5, height * 0.55);
      const sway = Math.sin(t * 1.1 + tx) * 2;
      ctx.fillStyle = '#3f7a45';
      ctx.beginPath();
      ctx.ellipse(centre.x + sway, centre.y - height * 0.75, 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4b8f52';
      ctx.beginPath();
      ctx.ellipse(centre.x + sway - 4, centre.y - height * 0.88, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'flowers': {
      const colors = ['#e0698a', '#e8c04a', '#8a7ae0', '#e88a4a'];
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(centre.x + Math.cos(i * 2.1) * 11, centre.y + Math.sin(i * 2.1) * 6 - 3, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'lamp': {
      ctx.strokeStyle = '#7a8088';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centre.x, centre.y);
      ctx.lineTo(centre.x, centre.y - height);
      ctx.stroke();
      const on = opts.darkness > 0.3;
      ctx.fillStyle = on ? '#ffe6a0' : '#5f6670';
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y - height, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (on) {
        const glow = ctx.createRadialGradient(centre.x, centre.y - height, 2, centre.x, centre.y - height, 46);
        glow.addColorStop(0, `rgba(255,220,140,${0.3 * opts.darkness})`);
        glow.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(centre.x, centre.y - height, 46, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'flag': {
      ctx.strokeStyle = '#b8bec6';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(centre.x, centre.y);
      ctx.lineTo(centre.x, centre.y - height);
      ctx.stroke();
      ctx.fillStyle = '#e0b64a';
      ctx.beginPath();
      ctx.moveTo(centre.x, centre.y - height);
      for (let i = 0; i <= 6; i++) {
        const p = i / 6;
        ctx.lineTo(centre.x + p * 26, centre.y - height + 4 + Math.sin(t * 4 + p * 5) * 3);
      }
      for (let i = 6; i >= 0; i--) {
        const p = i / 6;
        ctx.lineTo(centre.x + p * 26, centre.y - height + 15 + Math.sin(t * 4 + p * 5) * 3);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'sign': {
      ctx.fillStyle = '#59636e';
      ctx.fillRect(centre.x - 2, centre.y - height, 4, height);
      ctx.fillStyle = opts.darkness > 0.3 ? '#f0c04a' : '#d8dde3';
      ctx.fillRect(centre.x - 18, centre.y - height - 12, 36, 14);
      ctx.fillStyle = '#20242b';
      ctx.font = '700 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SCRAP', centre.x, centre.y - height - 2);
      break;
    }
    case 'sculpture': {
      ctx.fillStyle = shade(color, 0.1);
      ctx.save();
      ctx.translate(centre.x, centre.y - height * 0.5);
      ctx.rotate(Math.sin(t * 0.3) * 0.05);
      ctx.fillRect(-6, -height * 0.5, 12, height * 0.6);
      ctx.fillRect(-16, -height * 0.2, 32, 6);
      ctx.restore();
      break;
    }
    case 'car': {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y - 8, 17, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(color, 0.35);
      ctx.beginPath();
      ctx.ellipse(centre.x + 2, centre.y - 14, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
}
