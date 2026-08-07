import type { Game } from '../game/game';
import type { WarehouseRule } from '../game/state';

/**
 * Warehouse Manager: long-term storage strategy (GDD chapter 6).
 *
 * The player writes standing orders - "always keep 500 steel", "never sell
 * gold automatically", "only sell copper above X" - and the automation obeys
 * them. That is what turns selling from a reflex into a strategy.
 */

export function ruleFor(game: Game, materialId: string): WarehouseRule {
  return game.state.rules[materialId] ?? {};
}

export function setRule(game: Game, materialId: string, rule: WarehouseRule): void {
  const clean: WarehouseRule = {};
  if (rule.keep && rule.keep > 0) clean.keep = Math.floor(rule.keep);
  if (rule.minPrice && rule.minPrice > 0) clean.minPrice = rule.minPrice;
  if (Object.keys(clean).length === 0) delete game.state.rules[materialId];
  else game.state.rules[materialId] = clean;
  game.bus.emit('changed', undefined);
}

/** Units of a material the automation is allowed to sell right now. */
export function sellableAmount(game: Game, materialId: string): number {
  if (game.state.autoSellLocked[materialId]) return 0;
  const rule = ruleFor(game, materialId);
  const have = game.state.storage[materialId] ?? 0;

  if (rule.minPrice !== undefined && game.sellPrice(materialId) < rule.minPrice) return 0;
  const keep = rule.keep ?? 0;
  return Math.max(0, have - keep);
}

/** Whether a material may be sold at all right now. */
export function maySell(game: Game, materialId: string): boolean {
  return sellableAmount(game, materialId) > 0;
}

/** Short human-readable summary of a rule, for the material row. */
export function ruleText(game: Game, materialId: string): string {
  const rule = ruleFor(game, materialId);
  const parts: string[] = [];
  if (game.state.autoSellLocked[materialId]) parts.push('nie automatisch verkaufen');
  if (rule.keep) parts.push(`mind. ${rule.keep} halten`);
  if (rule.minPrice) parts.push(`erst ab ${rule.minPrice.toFixed(2)} €`);
  return parts.join(' · ');
}

/** Materials that currently have a standing order. */
export function ruledMaterials(game: Game): string[] {
  const ids = new Set([...Object.keys(game.state.rules), ...Object.keys(game.state.autoSellLocked)]);
  return [...ids];
}
