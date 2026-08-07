import { Content } from '../data';
import type { FlowRole } from '../data/types';
import type { BuildSlot, ZoneKind } from '../data/lots';
import type { GameState } from '../game/state';
import { owned } from '../game/state';
import type { MapSystem } from './map';

export interface Structure {
  /** Stable instance key: purchasable id, or `id#n` for cosmetics. */
  key: string;
  defId: string;
  name: string;
  model: string;
  size: number;
  /** 1–5, drives the visual upgrade level (GDD: Schuppen → Hightech). */
  stage: number;
  count: number;
  tx: number;
  ty: number;
  flow?: FlowRole;
  decor: boolean;
}

/** Where a structure prefers to stand, by its role in the yard. */
const ZONE_PREFERENCE: Record<string, ZoneKind[]> = {
  teardown: ['scrapyard', 'workshop', 'industry', 'buildable'],
  sort: ['workshop', 'recycling', 'storage', 'buildable'],
  store: ['storage', 'port', 'buildable'],
  melt: ['smelter', 'steel', 'buildable'],
  produce: ['recycling', 'industry', 'buildable'],
  ship: ['logistics', 'delivery', 'rail', 'buildable'],
};

/**
 * Building system: decides what stands where.
 *
 * A purchasable with a `building` block gets exactly one structure on the map,
 * whose stage grows with the owned count - so buying the tenth crane visibly
 * upgrades the yard instead of littering it with ten icons.
 *
 * Placement is automatic on purchase (nearest free slot in a fitting zone) and
 * can be overridden by the player; overrides are stored in `state.world.placements`.
 */
export class BuildingSystem {
  private structures: Structure[] = [];
  private dirty = true;

  markDirty(): void {
    this.dirty = true;
  }

  /** Assigns slots to anything new and returns the current structure list. */
  sync(state: GameState, map: MapSystem): Structure[] {
    if (!this.dirty) return this.structures;
    this.dirty = false;

    const placements = state.world.placements;
    const taken = new Set<string>();
    const list: Structure[] = [];

    // Reserve slots the player explicitly chose.
    for (const slotId of Object.values(placements)) taken.add(slotId);

    const decorSpotIds = map.decorSpots.map((s) => s.id);
    let decorCursor = 0;

    for (const def of Content.purchasables) {
      const building = def.building;
      if (!building) continue;
      const count = owned(state, def.id);
      if (count <= 0) continue;

      if (def.category === 'decor') {
        // One instance per owned copy, scattered along the plot edges.
        for (let i = 0; i < count; i++) {
          const key = `${def.id}#${i}`;
          let spotId = placements[key];
          if (!spotId || !decorSpotIds.includes(spotId)) {
            while (decorCursor < decorSpotIds.length && taken.has(decorSpotIds[decorCursor])) decorCursor++;
            spotId = decorSpotIds[decorCursor];
            if (!spotId) break; // no room left - buy more land
            decorCursor++;
            // Remember it, so buying more cosmetics never reshuffles the yard.
            placements[key] = spotId;
          }
          taken.add(spotId);
          const spot = map.decorSpots.find((s) => s.id === spotId);
          if (!spot) continue;
          list.push({
            key,
            defId: def.id,
            name: def.name,
            model: building.model,
            size: building.size ?? 1,
            stage: 1,
            count: 1,
            tx: spot.tx,
            ty: spot.ty,
            decor: true,
          });
        }
        continue;
      }

      const slotId = this.slotFor(def.id, building.flow, state, map, taken);
      if (!slotId) continue;
      taken.add(slotId);
      const slot = map.slots.find((s) => s.id === slotId);
      if (!slot) continue;

      list.push({
        key: def.id,
        defId: def.id,
        name: def.name,
        model: building.model,
        size: building.size ?? 2,
        stage: stageOf(count, building.stageAt),
        count,
        tx: slot.tx,
        ty: slot.ty,
        flow: building.flow,
        decor: false,
      });
    }

    this.structures = list;
    return list;
  }

  /** Slots that are free right now - the targets of a move. */
  freeSlots(state: GameState, map: MapSystem): BuildSlot[] {
    const used = new Set(this.structures.filter((s) => !s.decor).map((s) => slotIdAt(map, s.tx, s.ty)));
    for (const id of Object.values(state.world.placements)) used.add(id);
    return map.slots.filter((slot) => !used.has(slot.id));
  }

  /** Player-driven relocation. Returns false if the slot is occupied. */
  move(state: GameState, map: MapSystem, key: string, slotId: string): boolean {
    if (!map.slots.some((s) => s.id === slotId) && !map.decorSpots.some((s) => s.id === slotId)) return false;
    for (const [otherKey, otherSlot] of Object.entries(state.world.placements)) {
      if (otherSlot === slotId && otherKey !== key) return false;
    }
    const occupant = this.structures.find((s) => s.key !== key && slotIdAt(map, s.tx, s.ty) === slotId);
    if (occupant) return false;
    state.world.placements[key] = slotId;
    this.markDirty();
    return true;
  }

  current(): Structure[] {
    return this.structures;
  }

  /** Structures that take part in the visible material flow. */
  flowNodes(role: FlowRole): Structure[] {
    return this.structures.filter((s) => s.flow === role);
  }

  private slotFor(
    key: string,
    flow: FlowRole | undefined,
    state: GameState,
    map: MapSystem,
    taken: Set<string>,
  ): string | undefined {
    const chosen = state.world.placements[key];
    if (chosen && map.slots.some((s) => s.id === chosen)) return chosen;

    const preference = flow ? ZONE_PREFERENCE[flow] ?? [] : [];
    const candidates = map.slots.filter((s) => !taken.has(s.id));
    for (const zone of preference) {
      const hit = candidates.find((s) => map.zoneAt(s.tx + 1, s.ty + 1) === zone);
      if (hit) {
        state.world.placements[key] = hit.id;
        return hit.id;
      }
    }
    const fallback = candidates[0];
    if (!fallback) return undefined;
    state.world.placements[key] = fallback.id;
    return fallback.id;
  }
}

function slotIdAt(map: MapSystem, tx: number, ty: number): string {
  return (
    map.slots.find((s) => s.tx === tx && s.ty === ty)?.id ??
    map.decorSpots.find((s) => s.tx === tx && s.ty === ty)?.id ??
    ''
  );
}

/** Visual stage 1–5 from the owned count. */
export function stageOf(count: number, stageAt?: number[]): number {
  if (!stageAt || stageAt.length === 0) return 1;
  let stage = 1;
  for (let i = 0; i < stageAt.length; i++) {
    if (count >= stageAt[i]) stage = i + 1;
  }
  return Math.min(5, stage);
}
