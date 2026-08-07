export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Pan/zoom camera.
 *
 * The bounds are not constant: they cover the land the player actually owns
 * and grow with every expansion, so panning never wanders into empty space
 * and buying a plot visibly enlarges the world.
 *
 * The camera never follows anything on its own (GDD chapter 2).
 */
export class Camera {
  x = 0;
  y = 0;
  scale = 1;

  minScale = 0.25;
  maxScale = 2.6;

  private bounds: Bounds = { x: 0, y: 0, w: 1000, h: 1000 };

  constructor(private viewW: number, private viewH: number) {}

  setViewport(w: number, h: number): void {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
    this.updateMinScale();
    this.clamp();
  }

  /** Replaces the reachable area. Keeps the current view if it still fits. */
  setBounds(bounds: Bounds, refit = false): void {
    const grew = bounds.w > this.bounds.w + 1 || bounds.h > this.bounds.h + 1;
    this.bounds = bounds;
    this.updateMinScale();
    if (refit || grew) this.scale = Math.max(this.scale, this.minScale);
    this.clamp();
  }

  getBounds(): Bounds {
    return this.bounds;
  }

  private updateMinScale(): void {
    // Cover, not contain: the owned land fills the screen in at least one
    // axis. A little slack (0.8) still allows an overview pull-back without
    // stranding the yard in an empty void.
    const cover = Math.max(this.viewW / this.bounds.w, this.viewH / this.bounds.h);
    this.minScale = cover * 0.8;
    this.maxScale = Math.max(this.minScale * 2.5, 2.6);
  }

  /** Frames the owned area so it fills the screen. */
  fit(): void {
    this.updateMinScale();
    this.scale = Math.max(this.viewW / this.bounds.w, this.viewH / this.bounds.h);
    this.x = this.bounds.x + this.bounds.w / 2;
    this.y = this.bounds.y + this.bounds.h / 2;
    this.clamp();
  }

  focus(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.clamp();
  }

  /** Eases toward a point - used when a new plot is unlocked. */
  glideTo(x: number, y: number, t: number): void {
    this.x += (x - this.x) * t;
    this.y += (y - this.y) * t;
    this.clamp();
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.x -= dxScreen / this.scale;
    this.y -= dyScreen / this.scale;
    this.clamp();
  }

  /** Zooms around a screen anchor so pinch feels attached to the fingers. */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const before = this.screenToWorld(screenX, screenY);
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, this.scale * factor));
    const after = this.screenToWorld(screenX, screenY);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
    this.clamp();
  }

  private clamp(): void {
    const halfW = this.viewW / 2 / this.scale;
    const halfH = this.viewH / 2 / this.scale;
    const b = this.bounds;
    if (halfW * 2 >= b.w) this.x = b.x + b.w / 2;
    else this.x = Math.min(b.x + b.w - halfW, Math.max(b.x + halfW, this.x));
    if (halfH * 2 >= b.h) this.y = b.y + b.h / 2;
    else this.y = Math.min(b.y + b.h - halfH, Math.max(b.y + halfH, this.y));
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.x) * this.scale + this.viewW / 2,
      y: (y - this.y) * this.scale + this.viewH / 2,
    };
  }

  screenToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.viewW / 2) / this.scale + this.x,
      y: (y - this.viewH / 2) / this.scale + this.y,
    };
  }

  /** Visible world rectangle - the basis for culling. */
  viewRect(margin = 0): Bounds {
    const halfW = this.viewW / 2 / this.scale + margin;
    const halfH = this.viewH / 2 / this.scale + margin;
    return { x: this.x - halfW, y: this.y - halfH, w: halfW * 2, h: halfH * 2 };
  }

  /** Applies the transform to a 2D context (call inside save/restore). */
  apply(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);
  }
}
