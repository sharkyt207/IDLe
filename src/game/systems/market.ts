import { BALANCE } from '../../data/balance';
import type { Game } from '../game';

/**
 * Removes `qty` units from storage and pays for them.
 * `factor` lets automation trade a little margin for convenience.
 */
export function sellUnits(game: Game, materialId: string, qty: number, factor = 1, auto = false): number {
  const have = game.state.storage[materialId] ?? 0;
  const amount = Math.min(have, qty);
  if (amount <= 0) return 0;

  const value = amount * game.sellPrice(materialId) * factor;
  const left = have - amount;
  if (left <= 0.0001) delete game.state.storage[materialId];
  else game.state.storage[materialId] = left;

  game.addMoney(value);
  game.addXp(value * BALANCE.xpPerEuroSold);
  game.bus.emit('sold', { amount: value, auto });
  return value;
}

/**
 * Auto-sell target: the pile with the highest total value.
 * Clearing the biggest pile first keeps storage free, and the manual lock
 * lets the player protect inputs their processing chain still needs.
 */
export function pickAutoSellTarget(game: Game): string | null {
  let best: string | null = null;
  let bestValue = 0;
  for (const [id, amount] of Object.entries(game.state.storage)) {
    if (game.state.autoSellLocked[id]) continue;
    if (amount <= 0) continue;
    const value = amount * game.sellPrice(id);
    if (value > bestValue) {
      bestValue = value;
      best = id;
    }
  }
  return best;
}

/** Conveyors, sorters and sorting staff. */
export function runAutoSell(game: Game, dt: number, efficiency: number): void {
  if (!game.state.autoSellEnabled) return;
  const perSec = game.stats.autoSellPerSec * efficiency;
  if (perSec <= 0) return;

  game.autoSellCredit += perSec * dt;
  let budget = Math.floor(game.autoSellCredit);
  if (budget <= 0) return;
  game.autoSellCredit -= budget;

  // A handful of piles per step is plenty; the rest carries to the next tick.
  for (let guard = 0; guard < 12 && budget > 0; guard++) {
    const target = pickAutoSellTarget(game);
    if (!target) break;
    const have = game.state.storage[target] ?? 0;
    const qty = Math.min(have, budget);
    if (qty <= 0) break;
    sellUnits(game, target, qty, BALANCE.autoSellPriceFactor, true);
    budget -= qty;
  }
}
