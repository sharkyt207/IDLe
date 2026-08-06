import { Content } from '../../data';
import type { RecipeDef } from '../../data/types';
import type { Game } from '../game';

/** How many times a recipe could run with the material currently in storage. */
export function craftsAvailable(game: Game, recipe: RecipeDef): number {
  let max = Infinity;
  for (const input of recipe.input) {
    const have = game.state.storage[input.material] ?? 0;
    max = Math.min(max, Math.floor(have / input.amount));
    if (max <= 0) return 0;
  }
  return Number.isFinite(max) ? max : 0;
}

/**
 * Net storage units one craft adds (outputs minus consumed inputs).
 * Positive means the run needs free space.
 */
function netUnits(recipe: RecipeDef): number {
  const out = recipe.output.reduce((sum, o) => sum + o.amount, 0);
  const inn = recipe.input.reduce((sum, i) => sum + i.amount, 0);
  return out - inn;
}

/** How many crafts fit into the remaining storage space. */
export function craftsThatFit(game: Game, recipe: RecipeDef): number {
  const net = netUnits(recipe);
  if (net <= 0) return Infinity;
  return Math.floor(game.storageFree() / net);
}

/**
 * Runs every recipe the yard has machines for. Missing inputs - or a full
 * warehouse - simply mean the line idles this tick: inputs are never consumed
 * for output that would not fit.
 */
export function runProcessing(game: Game, dt: number, efficiency: number): void {
  for (const [recipeId, ratePerSec] of Object.entries(game.stats.processes)) {
    if (ratePerSec <= 0) continue;
    const recipe = Content.recipe(recipeId);
    if (!recipe) continue;

    const credit = (game.processCredit[recipeId] ?? 0) + ratePerSec * dt * efficiency;
    const wanted = Math.floor(credit);
    game.processCredit[recipeId] = Math.min(credit - wanted, ratePerSec * 5 + 1);
    if (wanted <= 0) continue;

    const crafts = Math.min(wanted, craftsAvailable(game, recipe), craftsThatFit(game, recipe));
    if (crafts <= 0) continue;

    for (const input of recipe.input) {
      const left = (game.state.storage[input.material] ?? 0) - input.amount * crafts;
      if (left <= 0.0001) delete game.state.storage[input.material];
      else game.state.storage[input.material] = left;
    }
    for (const output of recipe.output) {
      game.addMaterial(output.material, output.amount * crafts);
    }
  }
}
