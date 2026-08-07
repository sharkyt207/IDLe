import type { GameState } from '../game/state';

/**
 * Inventory system: storage with per-pile quality.
 *
 * A pile keeps one weighted-average quality instead of a bucket per level.
 * That is a deliberate simplification: it gives the player the same feedback
 * ("better machines raise my average") for a fraction of the save size and
 * without a combinatorial UI.
 */

export function stored(state: GameState, materialId: string): number {
  return state.storage[materialId] ?? 0;
}

export function storedTotal(state: GameState): number {
  let total = 0;
  for (const key in state.storage) total += state.storage[key];
  return total;
}

/** Adds material and blends its quality into the pile's average. */
export function addToStorage(state: GameState, materialId: string, amount: number, quality: number): void {
  if (amount <= 0) return;
  const have = state.storage[materialId] ?? 0;
  const currentQuality = state.quality[materialId] ?? quality;
  const total = have + amount;
  state.storage[materialId] = total;
  state.quality[materialId] = (currentQuality * have + quality * amount) / total;
}

/** Removes material. Quality stays as it is - a pile is homogeneous. */
export function removeFromStorage(state: GameState, materialId: string, amount: number): number {
  const have = state.storage[materialId] ?? 0;
  const taken = Math.min(have, amount);
  if (taken <= 0) return 0;
  const left = have - taken;
  if (left <= 0.0001) {
    delete state.storage[materialId];
    delete state.quality[materialId];
  } else {
    state.storage[materialId] = left;
  }
  return taken;
}

/** Quality of a stored pile, falling back to what the yard currently makes. */
export function qualityOf(state: GameState, materialId: string, fallback: number): number {
  return state.quality[materialId] ?? fallback;
}
