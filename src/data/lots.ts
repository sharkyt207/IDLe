import type { TileRect } from '../world/iso';

/**
 * Map layout: the starting yard, the ten expansions and the road network.
 *
 * Economy (price, unlock requirements) lives with the matching entry in
 * `purchasables.ts` under the category `lot`; this file only describes
 * *where* things are. Adding a plot means one entry here plus one
 * purchasable - no system code.
 */

export type ZoneKind =
  | 'road'
  | 'gate'
  | 'delivery'
  | 'scrapyard'
  | 'workshop'
  | 'storage'
  | 'buildable'
  | 'recycling'
  | 'smelter'
  | 'logistics'
  | 'lab'
  | 'port'
  | 'rail'
  | 'industry'
  | 'steel';

export interface LotDef {
  /** Purchasable id that unlocks the plot; empty for the starting yard. */
  id: string;
  name: string;
  zone: ZoneKind;
  rect: TileRect;
  /** Signature structure drawn on the plot, so buying it changes the skyline. */
  landmark?: string;
  /** Waypoints from the main yard road to this plot (tile coordinates). */
  road: { x: number; y: number }[];
}

/** Horizontal bands inside the starting yard, top to bottom (GDD chapter 3). */
export const BASE_BANDS: { zone: ZoneKind; from: number; to: number }[] = [
  { zone: 'road', from: 7, to: 7 },
  { zone: 'gate', from: 8, to: 8 },
  { zone: 'delivery', from: 9, to: 11 },
  { zone: 'scrapyard', from: 12, to: 15 },
  { zone: 'workshop', from: 16, to: 18 },
  { zone: 'storage', from: 19, to: 21 },
  { zone: 'buildable', from: 22, to: 24 },
];

/** The plot the player starts on. Always owned. */
export const BASE_LOT: LotDef = {
  id: '',
  name: 'Schrottplatz',
  zone: 'scrapyard',
  rect: { x: 16, y: 7, w: 12, h: 18 },
  road: [],
};

/** The ten expansions from the GDD, in unlock order. */
export const LOTS: LotDef[] = [
  {
    id: 'lot_storage',
    name: 'Mehr Lagerfläche',
    zone: 'storage',
    rect: { x: 28, y: 12, w: 8, h: 9 },
    landmark: 'silo',
    road: [
      { x: 21.5, y: 16.5 },
      { x: 32, y: 16.5 },
    ],
  },
  {
    id: 'lot_workshop2',
    name: 'Zweite Werkstatt',
    zone: 'workshop',
    rect: { x: 8, y: 12, w: 8, h: 9 },
    landmark: 'hall',
    road: [
      { x: 21.5, y: 17.5 },
      { x: 12, y: 17.5 },
    ],
  },
  {
    id: 'lot_recycling',
    name: 'Recyclinghalle',
    zone: 'recycling',
    rect: { x: 16, y: 25, w: 12, h: 7 },
    landmark: 'recycling_hall',
    road: [
      { x: 21.5, y: 24 },
      { x: 21.5, y: 28.5 },
    ],
  },
  {
    id: 'lot_smelter',
    name: 'Schmelzwerk',
    zone: 'smelter',
    rect: { x: 28, y: 22, w: 9, h: 10 },
    landmark: 'smelter',
    road: [
      { x: 21.5, y: 22.5 },
      { x: 32.5, y: 22.5 },
      { x: 32.5, y: 27 },
    ],
  },
  {
    id: 'lot_logistics',
    name: 'Logistikzentrum',
    zone: 'logistics',
    rect: { x: 7, y: 22, w: 9, h: 10 },
    landmark: 'depot',
    road: [
      { x: 21.5, y: 23.5 },
      { x: 11.5, y: 23.5 },
      { x: 11.5, y: 27 },
    ],
  },
  {
    id: 'lot_lab',
    name: 'Forschungslabor',
    zone: 'lab',
    rect: { x: 28, y: 3, w: 8, h: 8 },
    landmark: 'lab',
    road: [
      { x: 31.5, y: 7.5 },
      { x: 31.5, y: 7 },
    ],
  },
  {
    id: 'lot_port',
    name: 'Containerhafen',
    zone: 'port',
    rect: { x: 8, y: 3, w: 8, h: 8 },
    landmark: 'crane_port',
    road: [
      { x: 11.5, y: 7.5 },
      { x: 11.5, y: 7 },
    ],
  },
  {
    id: 'lot_rail',
    name: 'Bahnhof',
    zone: 'rail',
    rect: { x: 16, y: 32, w: 12, h: 7 },
    landmark: 'station',
    road: [
      { x: 21.5, y: 31 },
      { x: 21.5, y: 35 },
    ],
  },
  {
    id: 'lot_industry',
    name: 'Industriepark',
    zone: 'industry',
    rect: { x: 37, y: 12, w: 7, h: 14 },
    landmark: 'factory',
    road: [
      { x: 32, y: 19.5 },
      { x: 40, y: 19.5 },
    ],
  },
  {
    id: 'lot_steel',
    name: 'Eigener Stahlhersteller',
    zone: 'steel',
    rect: { x: 1, y: 12, w: 6, h: 14 },
    landmark: 'steel_mill',
    road: [
      { x: 12, y: 19.5 },
      { x: 4, y: 19.5 },
    ],
  },
];

/** The public road at the top of the map - through traffic, always visible. */
export const STREET_Y = 7.5;

/** The yard's main road: in through the gate, straight down the middle. */
export const MAIN_ROAD: { x: number; y: number }[] = [
  { x: 21.5, y: STREET_Y },
  { x: 21.5, y: 24 },
];

/** Where delivery trucks stop to unload. */
export const UNLOAD_POINT = { x: 21.5, y: 10.5 };

/** Fixed structures of the starting yard (GDD: Waage, Büro, Werkbank …). */
export const BASE_FIXTURES: { model: string; tx: number; ty: number; rot?: number }[] = [
  { model: 'scale', tx: 18, ty: 9 },
  { model: 'office_container', tx: 25, ty: 9 },
  { model: 'workbench', tx: 17, ty: 17 },
  { model: 'scrap_pile', tx: 25, ty: 13 },
  { model: 'scrap_pile', tx: 26, ty: 14 },
  { model: 'scrap_pile', tx: 17, ty: 13 },
];

/** The dismantling pad: where the active vehicle stands. */
export const TEARDOWN_PAD: TileRect = { x: 20, y: 12, w: 4, h: 4 };

/** Parking for bought-but-not-yet-processed deliveries. */
export const PARKING: TileRect = { x: 16, y: 9, w: 3, h: 3 };

/**
 * Build slots are derived from a plot rectangle on a fixed pitch, so a new
 * plot automatically offers sensible places to build.
 */
export interface BuildSlot {
  id: string;
  tx: number;
  ty: number;
  lot: string;
}

const SLOT_PITCH = 3;

export function slotsOfLot(lot: LotDef): BuildSlot[] {
  const slots: BuildSlot[] = [];
  const isBase = lot.id === '';
  // The starting yard keeps its upper bands free for delivery and teardown.
  const startY = isBase ? 16 : lot.rect.y + 1;
  const endY = lot.rect.y + lot.rect.h - 1;
  const startX = lot.rect.x + 1;
  const endX = lot.rect.x + lot.rect.w - 1;

  for (let ty = startY; ty + 2 <= endY; ty += SLOT_PITCH) {
    for (let tx = startX; tx + 2 <= endX; tx += SLOT_PITCH) {
      // Keep the main road clear.
      if (isBase && tx <= 21.5 && tx + 2 >= 21.5) continue;
      slots.push({ id: `${lot.id || 'base'}:${tx},${ty}`, tx, ty, lot: lot.id });
    }
  }
  return slots;
}

/** Every slot on the map, in lot order. */
export function allSlots(): BuildSlot[] {
  return [BASE_LOT, ...LOTS].flatMap(slotsOfLot);
}
