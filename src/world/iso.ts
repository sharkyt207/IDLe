/**
 * Isometric projection.
 *
 * Tile ratio 64:36 gives a camera pitch of atan(36/64) ≈ 29.4° - inside the
 * 30–35° band the GDD asks for, while keeping tile maths cheap and pixel
 * alignment clean.
 */
export const TILE_W = 64;
export const TILE_H = 36;
/** Height of one "storey" in world pixels, used for building volumes. */
export const LEVEL_H = 34;

/** The full map is a square grid; owned plots are rectangles inside it. */
export const MAP_TILES = 46;

/** Horizontal offset so every projected coordinate stays positive. */
const OFFSET_X = MAP_TILES * (TILE_W / 2);

export interface Point {
  x: number;
  y: number;
}

/** Tile (can be fractional) → world pixel of the tile centre's ground point. */
export function tileToWorld(tx: number, ty: number): Point {
  return {
    x: (tx - ty) * (TILE_W / 2) + OFFSET_X,
    y: (tx + ty) * (TILE_H / 2),
  };
}

/** World pixel → fractional tile coordinate. */
export function worldToTile(wx: number, wy: number): Point {
  const x = wx - OFFSET_X;
  return {
    x: (x / (TILE_W / 2) + wy / (TILE_H / 2)) / 2,
    y: (wy / (TILE_H / 2) - x / (TILE_W / 2)) / 2,
  };
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** World-pixel bounding box of a tile rectangle, with room for building height. */
export function rectToWorldBounds(rect: TileRect, heightLevels = 4): TileRect {
  const corners = [
    tileToWorld(rect.x, rect.y),
    tileToWorld(rect.x + rect.w, rect.y),
    tileToWorld(rect.x, rect.y + rect.h),
    tileToWorld(rect.x + rect.w, rect.y + rect.h),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const top = Math.min(...ys) - heightLevels * LEVEL_H;
  return {
    x: Math.min(...xs),
    y: top,
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - top,
  };
}

/** Merges tile rectangles into one enclosing rectangle. */
export function unionRects(rects: TileRect[]): TileRect {
  if (rects.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function rectContains(rect: TileRect, tx: number, ty: number): boolean {
  return tx >= rect.x && ty >= rect.y && tx < rect.x + rect.w && ty < rect.y + rect.h;
}

/** Draws the diamond outline of one tile at world position (no fill/stroke). */
export function tilePath(ctx: CanvasRenderingContext2D, tx: number, ty: number, inset = 0): void {
  const c = tileToWorld(tx + 0.5, ty + 0.5);
  const hw = TILE_W / 2 - inset;
  const hh = TILE_H / 2 - inset * (TILE_H / TILE_W);
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - hh);
  ctx.lineTo(c.x + hw, c.y);
  ctx.lineTo(c.x, c.y + hh);
  ctx.lineTo(c.x - hw, c.y);
  ctx.closePath();
}

/**
 * Painter's-algorithm depth key. Larger = drawn later (in front).
 * Ties are broken by the caller's insertion order.
 */
export function depthOf(tx: number, ty: number): number {
  return tx + ty;
}
