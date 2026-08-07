import { Content } from '../data';
import { ECONOMY } from '../data/economy';
import type { CollectibleDef } from '../data/trade';
import type { Game } from '../game/game';

/**
 * Random finds while dismantling.
 *
 * A find can be sold immediately or kept - kept pieces stay in the display
 * case and count towards the company value, so collecting is a real choice
 * rather than a delayed sale.
 */

/** Rolls a find for a finished vehicle. Returns the find, if any. */
export function rollFind(game: Game, vehicleClass: number): CollectibleDef | null {
  const chance =
    (ECONOMY.finds.baseChance + ECONOMY.finds.perTier * (vehicleClass - 1)) * game.stats.mult.rareFind;
  if (Math.random() > Math.min(0.6, chance)) return null;

  const pool = Content.collectibles.filter((c) => (c.minClass ?? 1) <= vehicleClass);
  if (pool.length === 0) return null;

  const total = pool.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * total;
  for (const item of pool) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return pool[pool.length - 1];
}

export function addToCollection(game: Game, id: string): void {
  game.state.collection[id] = (game.state.collection[id] ?? 0) + 1;
}

/** Sells one copy out of the display case. */
export function sellCollectible(game: Game, id: string): number {
  const def = Content.collectible(id);
  const have = game.state.collection[id] ?? 0;
  if (!def || have <= 0) return 0;

  const value = def.value * game.stats.mult.sellPrice;
  game.state.collection[id] = have - 1;
  if (game.state.collection[id] <= 0) delete game.state.collection[id];
  game.addMoney(value);
  game.bus.emit('sold', { amount: value, auto: false });
  game.bus.emit('changed', undefined);
  return value;
}

/** Value of the kept collection - part of the company value. */
export function collectionValue(game: Game): number {
  let total = 0;
  for (const [id, count] of Object.entries(game.state.collection)) {
    total += (Content.collectible(id)?.value ?? 0) * count;
  }
  return total;
}
