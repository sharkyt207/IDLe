import { BALANCE } from '../../data/balance';
import { reservedMaterials } from '../../economy/contracts';
import { removeFromStorage } from '../../economy/inventory';
import type { Game } from '../game';

/**
 * Removes `qty` units from storage and pays for them.
 * `factor` lets automation trade a little margin for convenience.
 */
export function sellUnits(game: Game, materialId: string, qty: number, factor = 1, auto = false): number {
  const have = game.state.storage[materialId] ?? 0;
  const amount = Math.min(have, qty);
  if (amount <= 0) return 0;

  const unit = game.sellPrice(materialId);
  const value = amount * unit * factor;
  removeFromStorage(game.state, materialId, amount);

  if (value >= 0) {
    game.addMoney(value);
    game.addXp(value * BALANCE.xpPerEuroSold);
    game.bus.emit('sold', { amount: value, auto });
  } else {
    // Hazardous material: proper disposal costs money instead of earning it.
    game.state.money = Math.max(0, game.state.money + value);
    game.bus.emit('sold', { amount: 0, auto });
  }
  return value;
}

/**
 * Auto-sell target: the pile with the highest total value.
 * Clearing the biggest pile first keeps storage free, and the manual lock
 * lets the player protect inputs their processing chain still needs.
 */
export function pickAutoSellTarget(game: Game): string | null {
  const reserved = reservedMaterials(game);
  let best: string | null = null;
  let bestValue = 0;
  for (const [id, amount] of Object.entries(game.state.storage)) {
    if (game.state.autoSellLocked[id] || reserved.has(id)) continue;
    if (amount <= 0) continue;
    const value = amount * game.sellPrice(id);
    if (value <= 0) continue;
    if (value > bestValue) {
      bestValue = value;
      best = id;
    }
  }
  return best;
}

/**
 * Hazardous piles never turn a profit, so the sorting line only touches them
 * once the yard is running out of room - otherwise fluids would silently drain
 * the bank account.
 */
function disposalTarget(game: Game): string | null {
  if (game.storageUsed() < game.stats.storage * 0.85) return null;
  let best: string | null = null;
  let bestAmount = 0;
  for (const [id, amount] of Object.entries(game.state.storage)) {
    if (!game.isDisposal(id)) continue;
    if (amount > bestAmount) {
      bestAmount = amount;
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
    const target = pickAutoSellTarget(game) ?? disposalTarget(game);
    if (!target) break;
    const have = game.state.storage[target] ?? 0;
    const qty = Math.min(have, budget);
    if (qty <= 0) break;
    sellUnits(game, target, qty, BALANCE.autoSellPriceFactor, true);
    budget -= qty;
  }
}
