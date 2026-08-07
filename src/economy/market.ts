import { Content } from '../data';
import { ECONOMY, qualityMultiplier } from '../data/economy';
import type { GameState } from '../game/state';
import type { Stats } from '../game/stats';

/**
 * Market system: what a unit of material is worth right now.
 *
 * Prices drift on two overlapping sine waves - a long one that makes storing
 * material a real decision, and a short ripple on top. Both are derived from
 * `playtime`, so the price the player sees survives a reload unchanged.
 */

export interface PriceInfo {
  /** Price for one unit at the pile's current quality. */
  price: number;
  /** Market drift alone, 1 = average. */
  drift: number;
  /** Quality multiplier of the stored pile. */
  quality: number;
  /** 1 = rising, -1 = falling, 0 = flat. */
  trend: -1 | 0 | 1;
  /** True for fluids that still cost money to get rid of. */
  disposal: boolean;
}

function hashPhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return (hash / 997) * Math.PI * 2;
}

/** Pure market drift for one material, independent of quality and upgrades. */
export function drift(materialId: string, playtime: number): number {
  const { slowAmplitude, slowCycleSeconds, fastAmplitude, fastCycleSeconds } = ECONOMY.market;
  const phase = hashPhase(materialId);
  const slow = Math.sin((playtime / slowCycleSeconds) * Math.PI * 2 + phase);
  const fast = Math.sin((playtime / fastCycleSeconds) * Math.PI * 2 + phase * 1.7);
  return 1 + slow * slowAmplitude + fast * fastAmplitude;
}

/** Whether a hazardous material still has to be paid for. */
export function isDisposal(materialId: string, stats: Stats): boolean {
  const def = Content.material(materialId);
  return !!def?.hazardous && !stats.unlocks.has(ECONOMY.disposal.unlockId);
}

/**
 * Full price for one unit, including drift, quality and the sell multiplier.
 * Negative for hazardous material that must be disposed of.
 */
export function unitPrice(state: GameState, stats: Stats, materialId: string): number {
  const def = Content.material(materialId);
  if (!def) return 0;
  const base = def.basePrice * drift(materialId, state.playtime);
  if (isDisposal(materialId, stats)) {
    return -base * ECONOMY.disposal.feeFactor;
  }
  const quality = qualityMultiplier(state.quality[materialId] ?? stats.quality);
  return base * quality * stats.mult.sellPrice;
}

export function priceInfo(state: GameState, stats: Stats, materialId: string): PriceInfo {
  const d = drift(materialId, state.playtime);
  const threshold = ECONOMY.market.trendThreshold;
  return {
    price: unitPrice(state, stats, materialId),
    drift: d,
    quality: qualityMultiplier(state.quality[materialId] ?? stats.quality),
    trend: d > 1 + threshold ? 1 : d < 1 - threshold ? -1 : 0,
    disposal: isDisposal(materialId, stats),
  };
}

/** Total value of everything in storage - feeds the company value. */
export function storedValue(state: GameState, stats: Stats): number {
  let total = 0;
  for (const [id, amount] of Object.entries(state.storage)) {
    total += amount * Math.max(0, unitPrice(state, stats, id));
  }
  return total;
}

/** Materials whose price is currently well above average. */
export function risingMaterials(state: GameState, stats: Stats, limit = 3): string[] {
  return Object.keys(state.storage)
    .filter((id) => !isDisposal(id, stats))
    .sort((a, b) => drift(b, state.playtime) - drift(a, state.playtime))
    .slice(0, limit);
}
