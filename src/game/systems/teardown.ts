import { Content } from '../../data';
import type { Game } from '../game';

/**
 * Applies work to the vehicle on the pad.
 *
 * Manual taps target one part (`onlyPartId`); machines pour their work into
 * the first unfinished part and spill over into the next one, so automation
 * never stalls on a half-finished car.
 *
 * @returns the work actually consumed
 */
export function applyTeardownWork(game: Game, work: number, onlyPartId?: string): number {
  const active = game.state.active;
  if (!active || work <= 0) return 0;
  const def = Content.vehicle(active.defId);
  if (!def) return 0;

  let remaining = work;

  for (const partState of active.parts) {
    if (remaining <= 0) break;
    if (partState.done) continue;
    if (onlyPartId && partState.id !== onlyPartId) continue;

    const partDef = def.parts.find((p) => p.id === partState.id);
    if (!partDef) {
      partState.done = true;
      continue;
    }

    const needed = partDef.work - partState.work;
    const applied = Math.min(remaining, needed);
    partState.work += applied;
    remaining -= applied;

    if (partState.work >= partDef.work - 1e-6) {
      partState.done = true;
      harvestPart(game, def.id, partDef.id);
    }

    if (onlyPartId) break;
  }

  if (active.parts.every((p) => p.done)) game.completeVehicle();

  return work - remaining;
}

/** Grants the materials and cash of a finished part and tells the renderer. */
function harvestPart(game: Game, vehicleId: string, partId: string): void {
  const vehicle = Content.vehicle(vehicleId);
  const part = vehicle?.parts.find((p) => p.id === partId);
  if (!part) return;

  for (const y of part.yields) {
    const amount = game.rollYield(y.min, y.max);
    if (amount > 0) game.addMaterial(y.material, amount);
  }

  const cash = part.cash ?? 0;
  if (cash > 0) game.addMoney(cash * game.stats.mult.sellPrice);

  game.state.progressStats.partsRemoved++;
  game.bus.emit('partRemoved', {
    vehicleId,
    partId,
    cash: cash * game.stats.mult.sellPrice,
    x: part.x ?? 0.5,
    y: part.y ?? 0.5,
  });
  game.bus.emit('changed', undefined);
}
