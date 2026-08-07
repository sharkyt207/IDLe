import {
  BASE_BANDS,
  BASE_LOT,
  BYPASS_ROAD,
  LOTS,
  MAIN_ROAD,
  STREET_Y,
  slotsOfLot,
  type BuildSlot,
  type LotDef,
  type ZoneKind,
} from '../data/lots';
import type { GameState } from '../game/state';
import { owned } from '../game/state';
import { MAP_TILES, rectContains, rectToWorldBounds, tileToWorld, unionRects, type TileRect } from './iso';

export interface RoadSegment {
  points: { x: number; y: number }[];
  /** The public street is wider and has markings. */
  street?: boolean;
}

/**
 * Map system: which land the player owns, what each tile is used for, where
 * buildings may go and how the roads run.
 *
 * Everything is derived from the owned lots and cached until that set
 * changes, so buying a plot is the only thing that reshapes the world.
 */
export class MapSystem {
  private cacheKey = '';
  private ownedLotsCache: LotDef[] = [];
  private slotCache: BuildSlot[] = [];
  private roadCache: RoadSegment[] = [];
  private decorCache: { id: string; tx: number; ty: number }[] = [];
  private boundsCache: TileRect = { x: 0, y: 0, w: 1, h: 1 };
  private tileBoundsCache: TileRect = { x: 0, y: 0, w: 1, h: 1 };

  /** Recomputes the derived map when the owned set changed. */
  sync(state: GameState): void {
    const key = LOTS.map((lot) => (owned(state, lot.id) > 0 ? '1' : '0')).join('');
    if (key === this.cacheKey) return;
    this.cacheKey = key;

    this.ownedLotsCache = [BASE_LOT, ...LOTS.filter((lot) => owned(state, lot.id) > 0)];
    this.slotCache = this.ownedLotsCache.flatMap(slotsOfLot);

    this.roadCache = [
      { points: [{ x: -2, y: STREET_Y }, { x: MAP_TILES + 2, y: STREET_Y }], street: true },
      { points: MAIN_ROAD },
      { points: BYPASS_ROAD },
      ...this.ownedLotsCache.filter((lot) => lot.road.length > 1).map((lot) => ({ points: lot.road })),
    ];

    this.tileBoundsCache = unionRects(this.ownedLotsCache.map((lot) => lot.rect));
    this.boundsCache = rectToWorldBounds(
      // A little margin so the fence and surrounding forest stay reachable.
      {
        x: this.tileBoundsCache.x - 2,
        y: this.tileBoundsCache.y - 2,
        w: this.tileBoundsCache.w + 4,
        h: this.tileBoundsCache.h + 4,
      },
      5,
    );

    this.decorCache = this.computeDecorSpots();
  }

  get lots(): LotDef[] {
    return this.ownedLotsCache;
  }

  get slots(): BuildSlot[] {
    return this.slotCache;
  }

  get roads(): RoadSegment[] {
    return this.roadCache;
  }

  /** World-pixel rectangle the camera may roam in. */
  get worldBounds(): TileRect {
    return this.boundsCache;
  }

  /** Tile rectangle of all owned land. */
  get tileBounds(): TileRect {
    return this.tileBoundsCache;
  }

  /** 1×1 spots for cosmetics, along plot edges where they read well. */
  get decorSpots(): { id: string; tx: number; ty: number }[] {
    return this.decorCache;
  }

  lotAt(tx: number, ty: number): LotDef | undefined {
    return this.ownedLotsCache.find((lot) => rectContains(lot.rect, tx, ty));
  }

  isOwned(tx: number, ty: number): boolean {
    return !!this.lotAt(tx, ty);
  }

  /** Purpose of a tile - drives the ground colour and where things get built. */
  zoneAt(tx: number, ty: number): ZoneKind | null {
    const lot = this.lotAt(tx, ty);
    if (!lot) return null;
    if (lot.id !== '') return lot.zone;
    const band = BASE_BANDS.find((b) => ty >= b.from && ty <= b.to);
    return band?.zone ?? 'buildable';
  }

  center(): { x: number; y: number } {
    const b = this.tileBoundsCache;
    return tileToWorld(b.x + b.w / 2, b.y + b.h / 2);
  }

  /** Centre of one lot in world pixels - used to glide the camera on unlock. */
  lotCenter(lotId: string): { x: number; y: number } | null {
    const lot = this.ownedLotsCache.find((l) => l.id === lotId);
    if (!lot) return null;
    return tileToWorld(lot.rect.x + lot.rect.w / 2, lot.rect.y + lot.rect.h / 2);
  }

  /**
   * Cosmetic spots run along the inner edge of each plot, skipping build
   * slots and roads, so decoration frames the yard instead of blocking it.
   */
  private computeDecorSpots(): { id: string; tx: number; ty: number }[] {
    const spots: { id: string; tx: number; ty: number }[] = [];
    const blocked = new Set(this.slotCache.flatMap((s) => footprintKeys(s.tx, s.ty, 3)));

    for (const lot of this.ownedLotsCache) {
      const r = lot.rect;
      const edge: { x: number; y: number }[] = [];
      for (let tx = r.x; tx < r.x + r.w; tx++) {
        edge.push({ x: tx, y: r.y + r.h - 1 });
        edge.push({ x: tx, y: r.y });
      }
      for (let ty = r.y; ty < r.y + r.h; ty++) {
        edge.push({ x: r.x, y: ty });
        edge.push({ x: r.x + r.w - 1, y: ty });
      }
      for (const tile of edge) {
        if (blocked.has(`${tile.x},${tile.y}`)) continue;
        // Keep the street and the gate approach clear.
        if (Math.abs(tile.y - STREET_Y) < 1.5) continue;
        if (Math.abs(tile.x - 21.5) < 1.5 && tile.y < 12) continue;
        const id = `${tile.x},${tile.y}`;
        if (spots.some((s) => s.id === id)) continue;
        spots.push({ id, tx: tile.x, ty: tile.y });
      }
    }
    return spots;
  }
}

function footprintKeys(tx: number, ty: number, size: number): string[] {
  const keys: string[] = [];
  for (let x = tx; x < tx + size; x++) {
    for (let y = ty; y < ty + size; y++) keys.push(`${x},${y}`);
  }
  return keys;
}

/** Ground colour per zone. Unowned land is the surrounding forest. */
export const ZONE_COLOR: Record<ZoneKind, string> = {
  road: '#3b3f45',
  gate: '#4a4640',
  delivery: '#585148',
  scrapyard: '#4e4b46',
  workshop: '#514c48',
  storage: '#55524c',
  buildable: '#4a5344',
  recycling: '#48544a',
  smelter: '#565049',
  logistics: '#4c5158',
  lab: '#4a5560',
  port: '#46525c',
  rail: '#514f4a',
  industry: '#4f4c4c',
  steel: '#57504a',
};
