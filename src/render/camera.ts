/**
 * World size of the yard in virtual units.
 * Portrait proportions on purpose: phones are tall, and a landscape yard
 * would letterbox into thick dead bands above and below the lot.
 */
export const WORLD = { width: 1000, height: 1700 };

/**
 * Pan/zoom camera for the yard view. Keeps the world inside the viewport and
 * never follows anything on its own (GDD: the camera stays under player
 * control).
 */
export class Camera {
  x = WORLD.width / 2;
  y = WORLD.height / 2;
  scale = 1;

  minScale = 0.4;
  maxScale = 2.4;

  constructor(private viewW: number, private viewH: number) {
    this.fit();
  }

  setViewport(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
    this.minScale = Math.min(1, Math.min(w / WORLD.width, h / WORLD.height));
    this.clamp();
  }

  /** Frames the whole yard. */
  fit(): void {
    this.scale = Math.min(this.viewW / WORLD.width, this.viewH / WORLD.height);
    this.minScale = Math.min(1, this.scale);
    this.x = WORLD.width / 2;
    this.y = WORLD.height / 2;
    this.clamp();
  }

  /** Centers on a world point without changing zoom. */
  focus(x: number, y: number): void {
    this.x = x;
    this.y = y;
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
    if (halfW * 2 >= WORLD.width) this.x = WORLD.width / 2;
    else this.x = Math.min(WORLD.width - halfW, Math.max(halfW, this.x));
    if (halfH * 2 >= WORLD.height) this.y = WORLD.height / 2;
    else this.y = Math.min(WORLD.height - halfH, Math.max(halfH, this.y));
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

  /** Applies the transform to a 2D context (call inside save/restore). */
  apply(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);
  }
}
