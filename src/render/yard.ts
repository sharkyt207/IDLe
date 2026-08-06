import { Content } from '../data';
import type { VehicleShape } from '../data/types';
import type { Game } from '../game/game';
import { Camera, WORLD } from './camera';
import { Effects } from './effects';

/** Where the vehicle on the pad is drawn, in world units. */
const PAD = { x: 90, y: 400, w: 820, h: 560 };
/** Hotspot radius; the touch target is deliberately larger (see hitTestPart). */
const HOTSPOT_R = 46;

/** Part ids that hide a piece of the silhouette once removed. */
const DETAIL_BY_PART: Record<string, string> = {
  wheels: 'wheels',
  tracks: 'wheels',
  glass: 'glass',
  seats: 'interior',
  interior: 'interior',
  cab: 'interior',
  cabin: 'interior',
  hood: 'hood',
  engine: 'engine',
  body: 'body',
  shell: 'body',
  frame: 'body',
  wreck_front: 'body',
  trailer: 'body',
  arm: 'body',
};

export class YardRenderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  readonly effects = new Effects();

  private dpr = 1;
  private viewW = 0;
  private viewH = 0;

  /** Pulse timer for the "tap me" highlight. */
  private time = 0;

  onTapPart?: (partId: string) => void;
  onTapEmpty?: () => void;

  private pointers = new Map<number, { x: number; y: number }>();
  private dragStart: { x: number; y: number; time: number } | null = null;
  private dragged = false;
  private pinchDistance = 0;

  constructor(private canvas: HTMLCanvasElement, private game: Game) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D nicht verfügbar');
    this.ctx = ctx;
    this.camera = new Camera(canvas.clientWidth || 360, canvas.clientHeight || 480);
    this.bindInput();
    this.resize();
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.viewW = Math.max(1, rect.width);
    this.viewH = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.viewW * this.dpr);
    this.canvas.height = Math.round(this.viewH * this.dpr);
    this.camera.setViewport(this.viewW, this.viewH);
    // Start framed on the whole lot: the player sees the queue, the pad and
    // their machines at once, and can pinch in from there.
    this.camera.fit();
    this.camera.focus(PAD.x + PAD.w / 2, PAD.y + PAD.h / 2);
  }

  private bindInput(): void {
    const el = this.canvas;
    el.style.touchAction = 'none';

    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.dragStart = { x: e.clientX, y: e.clientY, time: performance.now() };
        this.dragged = false;
      } else if (this.pointers.size === 2) {
        this.pinchDistance = this.currentPinchDistance();
      }
    });

    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 1) {
        if (Math.abs(dx) + Math.abs(dy) > 1) {
          this.camera.panBy(dx, dy);
          if (this.dragStart) {
            const total = Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y);
            if (total > 10) this.dragged = true;
          }
        }
      } else if (this.pointers.size === 2) {
        const distance = this.currentPinchDistance();
        if (this.pinchDistance > 0 && distance > 0) {
          const rect = el.getBoundingClientRect();
          const [a, b] = [...this.pointers.values()];
          const midX = (a.x + b.x) / 2 - rect.left;
          const midY = (a.y + b.y) / 2 - rect.top;
          this.camera.zoomAt(midX, midY, distance / this.pinchDistance);
        }
        this.pinchDistance = distance;
        this.dragged = true;
      }
    });

    const end = (e: PointerEvent) => {
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
      if (!wasSingle || !this.dragStart) return;

      const heldMs = performance.now() - this.dragStart.time;
      this.dragStart = null;
      if (this.dragged || heldMs > 600) return;

      const rect = this.canvas.getBoundingClientRect();
      this.handleTap(e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', (e) => {
      this.pointers.delete(e.pointerId);
      this.dragStart = null;
    });

    // Desktop convenience - the game itself is designed for touch.
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        this.camera.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 0.89);
      },
      { passive: false },
    );
  }

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private handleTap(screenX: number, screenY: number): void {
    const world = this.camera.screenToWorld(screenX, screenY);
    const partId = this.hitTestPart(world.x, world.y);
    if (partId) this.onTapPart?.(partId);
    else this.onTapEmpty?.();
  }

  /** Finds the tapped part hotspot, with a generous touch radius. */
  private hitTestPart(worldX: number, worldY: number): string | null {
    const active = this.game.state.active;
    if (!active) return null;
    const def = Content.vehicle(active.defId);
    if (!def) return null;

    let best: string | null = null;
    let bestDist = HOTSPOT_R * 1.8;
    for (const partState of active.parts) {
      if (partState.done) continue;
      const partDef = def.parts.find((p) => p.id === partState.id);
      if (!partDef) continue;
      const px = PAD.x + partDef.x * PAD.w;
      const py = PAD.y + partDef.y * PAD.h;
      const dist = Math.hypot(worldX - px, worldY - py);
      if (dist < bestDist) {
        bestDist = dist;
        best = partState.id;
      }
    }
    return best;
  }

  /** World position of a part hotspot - used to spawn effects on tap. */
  partWorldPos(partId: string): { x: number; y: number } | null {
    const active = this.game.state.active;
    const def = active ? Content.vehicle(active.defId) : undefined;
    const part = def?.parts.find((p) => p.id === partId);
    if (!part) return null;
    return { x: PAD.x + part.x * PAD.w, y: PAD.y + part.y * PAD.h };
  }

  padCenter(): { x: number; y: number } {
    return { x: PAD.x + PAD.w / 2, y: PAD.y + PAD.h / 2 };
  }

  /** Converts a normalized sprite coordinate (as stored on a part) to world space. */
  normalizedToWorld(nx: number, ny: number): { x: number; y: number } {
    return { x: PAD.x + nx * PAD.w, y: PAD.y + ny * PAD.h };
  }

  /** Re-centres the camera on the dismantling pad. */
  centerOnPad(): void {
    this.camera.focus(PAD.x + PAD.w / 2, PAD.y + PAD.h / 2);
  }

  // -------------------------------------------------------------------------
  // Drawing
  // -------------------------------------------------------------------------

  render(dt: number): void {
    this.time += dt;
    this.effects.update(dt);

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#20242b';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    this.camera.apply(ctx);

    this.drawGround(ctx);
    this.drawBuildings(ctx);
    this.drawPad(ctx);
    this.drawVehicle(ctx);
    this.drawQueue(ctx);
    this.drawMachines(ctx);
    this.effects.draw(ctx);

    ctx.restore();
  }

  private drawGround(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // Dirt patches for a bit of texture without images.
    ctx.fillStyle = '#41464e';
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137) % WORLD.width) + 20;
      const y = ((i * 271) % WORLD.height) + 15;
      ctx.beginPath();
      ctx.ellipse(x, y, 70 + (i % 5) * 18, 34 + (i % 3) * 12, i, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= WORLD.width; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.height; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.width, y);
      ctx.stroke();
    }

    // Fence
    ctx.strokeStyle = '#5a616b';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, WORLD.width - 40, WORLD.height - 40);
  }

  private drawPad(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.fillStyle = '#2c3138';
    ctx.strokeStyle = '#f0c04a';
    ctx.lineWidth = 6;
    ctx.setLineDash([28, 20]);
    const pad = { x: PAD.x - 40, y: PAD.y - 40, w: PAD.w + 80, h: PAD.h + 80 };
    ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
    ctx.strokeRect(pad.x, pad.y, pad.w, pad.h);
    ctx.restore();

    if (!this.game.state.active) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = '600 34px system-ui, sans-serif';
      ctx.fillText('Zerlegeplatz frei', PAD.x + PAD.w / 2, PAD.y + PAD.h / 2 - 20);
      ctx.font = '500 26px system-ui, sans-serif';
      ctx.fillText('Kaufe im Ankauf neuen Schrott', PAD.x + PAD.w / 2, PAD.y + PAD.h / 2 + 26);
      ctx.restore();
    }
  }

  private drawVehicle(ctx: CanvasRenderingContext2D): void {
    const active = this.game.state.active;
    if (!active) return;
    const def = Content.vehicle(active.defId);
    if (!def) return;

    const removed = new Set<string>();
    for (const part of active.parts) {
      if (part.done) removed.add(DETAIL_BY_PART[part.id] ?? part.id);
    }

    ctx.save();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(PAD.x + PAD.w / 2, PAD.y + PAD.h * 0.92, PAD.w * 0.42, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    drawShape(ctx, def.shape, PAD, def.color, removed);
    ctx.restore();

    // Overall progress bar above the vehicle
    const totalWork = def.parts.reduce((sum, p) => sum + p.work, 0);
    const doneWork = active.parts.reduce((sum, p) => sum + p.work, 0);
    const progress = totalWork > 0 ? doneWork / totalWork : 0;
    const barW = PAD.w * 0.7;
    const barX = PAD.x + (PAD.w - barW) / 2;
    const barY = PAD.y - 78;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, barX - 4, barY - 4, barW + 8, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#4a5058';
    roundRect(ctx, barX, barY, barW, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#6fd08c';
    roundRect(ctx, barX, barY, Math.max(6, barW * progress), 18, 9);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillText(`${def.icon} ${def.name}`, PAD.x + PAD.w / 2, barY - 14);

    // Hotspots
    const pulse = 1 + Math.sin(this.time * 4) * 0.06;
    for (const partState of active.parts) {
      if (partState.done) continue;
      const partDef = def.parts.find((p) => p.id === partState.id);
      if (!partDef) continue;
      const x = PAD.x + partDef.x * PAD.w;
      const y = PAD.y + partDef.y * PAD.h;
      const r = HOTSPOT_R * pulse;
      const ratio = Math.min(1, partState.work / partDef.work);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(18,20,24,0.78)';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();

      if (ratio > 0) {
        ctx.beginPath();
        ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
        ctx.strokeStyle = '#f0c04a';
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '30px system-ui, sans-serif';
      ctx.fillText(partDef.icon, x, y + 1);
      ctx.restore();
    }
  }

  /** Deliveries waiting for a free pad. */
  private drawQueue(ctx: CanvasRenderingContext2D): void {
    const queue = this.game.state.queue;
    if (queue.length === 0) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText(`Warteschlange (${queue.length})`, WORLD.width / 2, 150);

    ctx.font = '48px system-ui, sans-serif';
    const perRow = Math.min(6, Math.max(1, queue.length));
    queue.slice(0, 12).forEach((id, i) => {
      const def = Content.vehicle(id);
      const col = i % perRow;
      const rowWidth = Math.min(perRow, queue.length - Math.floor(i / perRow) * perRow) * 100;
      const x = WORLD.width / 2 - rowWidth / 2 + 50 + col * 100;
      const y = 240 + Math.floor(i / perRow) * 100;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      roundRect(ctx, x - 42, y - 42, 84, 84, 16);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(def?.icon ?? '❓', x, y + 2);
    });
    ctx.restore();
  }

  /** Every owned machine/building with `yardIcon` shows up on the lot. */
  private drawMachines(ctx: CanvasRenderingContext2D): void {
    const entries: { icon: string; count: number }[] = [];
    for (const def of Content.purchasables) {
      if (!def.yardIcon) continue;
      const count = this.game.state.owned[def.id] ?? 0;
      if (count > 0) entries.push({ icon: def.icon, count });
    }
    if (entries.length === 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '600 30px system-ui, sans-serif';
    ctx.fillText('Anlagen', WORLD.width / 2, 1055);

    const perRow = 5;
    entries.slice(0, 20).forEach((entry, i) => {
      const x = 140 + (i % perRow) * 180;
      const y = 1160 + Math.floor(i / perRow) * 130;
      ctx.fillStyle = 'rgba(20,22,26,0.55)';
      roundRect(ctx, x - 62, y - 52, 124, 104, 18);
      ctx.fill();
      ctx.font = '50px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(entry.icon, x, y - 8);
      ctx.font = '700 24px system-ui, sans-serif';
      ctx.fillStyle = '#f0c04a';
      ctx.fillText(`×${entry.count}`, x, y + 34);
    });
    ctx.restore();
  }

  /** Static scenery that grows with the company. */
  private drawBuildings(ctx: CanvasRenderingContext2D): void {
    const storageLevels = this.game.state.owned['storage_yard'] ?? 0;
    const piles = Math.min(12, storageLevels);
    ctx.save();
    for (let i = 0; i < piles; i++) {
      const x = 160 + (i % 6) * 140;
      const y = 1520 + Math.floor(i / 6) * 110;
      ctx.fillStyle = '#565d67';
      ctx.beginPath();
      ctx.moveTo(x - 52, y + 40);
      ctx.lineTo(x, y - 34);
      ctx.lineTo(x + 52, y + 40);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#666e79';
      ctx.fillRect(x - 52, y + 34, 104, 12);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Vehicle silhouettes
// ---------------------------------------------------------------------------

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: VehicleShape,
  box: { x: number; y: number; w: number; h: number },
  color: string,
  removed: Set<string>,
): void {
  const { x, y, w, h } = box;
  const hasBody = !removed.has('body');
  const bodyFill = hasBody ? color : 'rgba(0,0,0,0)';
  const outline = shade(color, -0.45);

  ctx.lineWidth = 6;
  ctx.strokeStyle = outline;

  const panel = (px: number, py: number, pw: number, ph: number, radius = 18) => {
    roundRect(ctx, px, py, pw, ph, radius);
    ctx.fillStyle = bodyFill;
    if (hasBody) ctx.fill();
    ctx.setLineDash(hasBody ? [] : [16, 12]);
    ctx.strokeStyle = hasBody ? outline : 'rgba(255,255,255,0.35)';
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const wheel = (cx: number, cy: number, r: number) => {
    if (removed.has('wheels')) return;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#23262b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#8d949e';
    ctx.fill();
  };

  const window_ = (wx: number, wy: number, ww: number, wh: number) => {
    if (removed.has('glass')) return;
    roundRect(ctx, wx, wy, ww, wh, 10);
    ctx.fillStyle = 'rgba(160,215,225,0.75)';
    ctx.fill();
  };

  const seat = (sx: number, sy: number) => {
    if (removed.has('interior')) return;
    roundRect(ctx, sx, sy, 48, 56, 10);
    ctx.fillStyle = '#8a5c3a';
    ctx.fill();
  };

  const engine = (ex: number, ey: number) => {
    if (removed.has('engine')) return;
    roundRect(ctx, ex, ey, 96, 72, 12);
    ctx.fillStyle = '#6c737d';
    ctx.fill();
    ctx.fillStyle = '#4c525a';
    ctx.fillRect(ex + 16, ey + 14, 64, 12);
    ctx.fillRect(ex + 16, ey + 38, 64, 12);
  };

  switch (shape) {
    case 'bike': {
      panel(x + w * 0.3, y + h * 0.42, w * 0.34, h * 0.2, 16);
      panel(x + w * 0.38, y + h * 0.28, w * 0.18, h * 0.16, 14);
      engine(x + w * 0.42, y + h * 0.5);
      wheel(x + w * 0.22, y + h * 0.72, h * 0.16);
      wheel(x + w * 0.74, y + h * 0.72, h * 0.16);
      break;
    }
    case 'car': {
      panel(x + w * 0.1, y + h * 0.45, w * 0.82, h * 0.3, 22);
      panel(x + w * 0.3, y + h * 0.22, w * 0.42, h * 0.26, 26);
      window_(x + w * 0.34, y + h * 0.27, w * 0.15, h * 0.16);
      window_(x + w * 0.53, y + h * 0.27, w * 0.15, h * 0.16);
      seat(x + w * 0.4, y + h * 0.46);
      engine(x + w * 0.74, y + h * 0.5);
      wheel(x + w * 0.24, y + h * 0.78, h * 0.13);
      wheel(x + w * 0.76, y + h * 0.78, h * 0.13);
      break;
    }
    case 'van': {
      panel(x + w * 0.08, y + h * 0.3, w * 0.86, h * 0.46, 20);
      window_(x + w * 0.68, y + h * 0.36, w * 0.2, h * 0.18);
      window_(x + w * 0.16, y + h * 0.36, w * 0.22, h * 0.18);
      seat(x + w * 0.6, y + h * 0.5);
      engine(x + w * 0.8, y + h * 0.54);
      wheel(x + w * 0.22, y + h * 0.79, h * 0.14);
      wheel(x + w * 0.78, y + h * 0.79, h * 0.14);
      break;
    }
    case 'truck': {
      panel(x + w * 0.06, y + h * 0.26, w * 0.52, h * 0.44, 12);
      panel(x + w * 0.62, y + h * 0.34, w * 0.3, h * 0.36, 16);
      window_(x + w * 0.66, y + h * 0.38, w * 0.2, h * 0.14);
      engine(x + w * 0.8, y + h * 0.56);
      wheel(x + w * 0.16, y + h * 0.78, h * 0.14);
      wheel(x + w * 0.32, y + h * 0.78, h * 0.14);
      wheel(x + w * 0.74, y + h * 0.78, h * 0.14);
      break;
    }
    case 'container': {
      panel(x + w * 0.1, y + h * 0.24, w * 0.8, h * 0.54, 10);
      if (hasBody) {
        ctx.strokeStyle = shade(color, -0.25);
        ctx.lineWidth = 5;
        for (let i = 1; i < 9; i++) {
          const lx = x + w * 0.1 + (w * 0.8 * i) / 9;
          ctx.beginPath();
          ctx.moveTo(lx, y + h * 0.26);
          ctx.lineTo(lx, y + h * 0.76);
          ctx.stroke();
        }
      }
      break;
    }
    case 'machine': {
      panel(x + w * 0.2, y + h * 0.42, w * 0.44, h * 0.26, 14);
      panel(x + w * 0.5, y + h * 0.24, w * 0.2, h * 0.24, 12);
      window_(x + w * 0.53, y + h * 0.28, w * 0.14, h * 0.14);
      engine(x + w * 0.26, y + h * 0.46);
      if (!removed.has('body')) {
        ctx.strokeStyle = shade(color, -0.2);
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.64, y + h * 0.4);
        ctx.lineTo(x + w * 0.8, y + h * 0.22);
        ctx.lineTo(x + w * 0.9, y + h * 0.46);
        ctx.stroke();
      }
      if (!removed.has('wheels')) {
        roundRect(ctx, x + w * 0.16, y + h * 0.7, w * 0.54, h * 0.16, 24);
        ctx.fillStyle = '#23262b';
        ctx.fill();
      }
      break;
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Lightens (amount > 0) or darkens (amount < 0) a hex colour. */
function shade(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (channel: number) =>
    Math.round(amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
