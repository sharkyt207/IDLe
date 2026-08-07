import { Content } from '../data';
import { ECONOMY } from '../data/economy';
import type { Game } from '../game/game';
import { nextCost } from '../game/stats';
import { owned } from '../game/state';
import { tickAuctions } from './auctions';
import { collectionValue } from './collection';
import { tickContracts } from './contracts';
import { storedValue } from './market';

/**
 * Economy manager: the one place that ties the trading systems into the tick
 * and answers "what is this company worth?".
 */
export function tickEconomy(game: Game, dt: number, efficiency: number): void {
  // Contracts keep paying while away; auctions need a present bidder, so they
  // are skipped during offline catch-up.
  tickContracts(game, dt);
  if (efficiency >= 1) tickAuctions(game, dt);
}

/**
 * Company value (Firmenwert): what the player has built, not what is in the
 * bank. Rises with structures, land, stock, staff, research and collection.
 */
export function companyValue(game: Game): number {
  const { assetShare, inventoryShare, perResearch, perEmployee } = ECONOMY.companyValue;
  const state = game.state;

  // What was sunk into everything owned - the geometric sum of the cost curve.
  let assets = 0;
  let employees = 0;
  for (const def of Content.purchasables) {
    const count = owned(state, def.id);
    if (count <= 0) continue;
    if (def.category === 'employee') employees += count;

    if (def.costGrowth === 1) {
      assets += def.baseCost * count;
    } else {
      // baseCost * (g^count - 1) / (g - 1)
      assets += (def.baseCost * (Math.pow(def.costGrowth, count) - 1)) / (def.costGrowth - 1);
    }
    void nextCost;
  }

  return (
    assets * assetShare +
    storedValue(state, game.stats) * inventoryShare +
    state.research.done.length * perResearch +
    employees * perEmployee +
    collectionValue(game) +
    game.stats.companyValue
  );
}
