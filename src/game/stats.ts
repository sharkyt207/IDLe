import { BALANCE } from '../data/balance';
import { Content } from '../data';
import type { Effect, MultiplierTarget, Requirement } from '../data/types';
import type { GameState } from './state';
import { owned } from './state';

export interface Stats {
  /** Work per manual tap, multipliers included. */
  tapPower: number;
  /** Work per second from machines and staff. */
  teardownRate: number;
  storage: number;
  queueSlots: number;
  autoBuyPerMinute: number;
  autoSellPerSec: number;
  offlineHours: number;
  /** recipe id -> crafts per second (process speed multiplier applied). */
  processes: Record<string, number>;
  mult: Record<MultiplierTarget, number>;
  /** Unlock flags granted by buildings/research. */
  unlocks: Set<string>;
}

const NEUTRAL: Record<MultiplierTarget, number> = {
  tapPower: 1,
  teardownRate: 1,
  sellPrice: 1,
  buyPrice: 1,
  processSpeed: 1,
  xpGain: 1,
  rareFind: 1,
};

interface Accumulator {
  tapFlat: number;
  teardownFlat: number;
  storageFlat: number;
  queueFlat: number;
  autoBuy: number;
  autoSell: number;
  offlineHours: number;
  process: Record<string, number>;
  mult: Record<MultiplierTarget, number>;
  unlocks: Set<string>;
}

function applyEffect(acc: Accumulator, effect: Effect, count: number): void {
  switch (effect.kind) {
    case 'tapPower':
      acc.tapFlat += effect.amount * count;
      break;
    case 'teardownRate':
      acc.teardownFlat += effect.amount * count;
      break;
    case 'storage':
      acc.storageFlat += effect.amount * count;
      break;
    case 'queueSlots':
      acc.queueFlat += effect.amount * count;
      break;
    case 'autoBuy':
      acc.autoBuy += effect.perMinute * count;
      break;
    case 'autoSell':
      acc.autoSell += effect.unitsPerSec * count;
      break;
    case 'offlineHours':
      acc.offlineHours += effect.amount * count;
      break;
    case 'process':
      acc.process[effect.recipe] = (acc.process[effect.recipe] ?? 0) + effect.craftsPerSec * count;
      break;
    case 'multiplier':
      acc.mult[effect.target] *= Math.pow(effect.factor, count);
      break;
    case 'unlock':
      if (count > 0) acc.unlocks.add(effect.id);
      break;
  }
}

/**
 * Folds every owned purchasable, completed research node and prestige perk
 * into one derived Stats object. Called whenever the inventory changes, not
 * every tick.
 */
export function computeStats(state: GameState): Stats {
  const acc: Accumulator = {
    tapFlat: BALANCE.start.tapPower,
    teardownFlat: 0,
    storageFlat: BALANCE.start.storage,
    queueFlat: BALANCE.start.queueSlots,
    autoBuy: 0,
    autoSell: 0,
    offlineHours: BALANCE.start.offlineHours,
    process: {},
    mult: { ...NEUTRAL },
    unlocks: new Set<string>(),
  };

  for (const def of Content.purchasables) {
    const count = owned(state, def.id);
    if (count <= 0) continue;
    for (const effect of def.effects) applyEffect(acc, effect, count);
  }

  for (const id of state.research.done) {
    const node = Content.researchNode(id);
    if (!node) continue;
    for (const effect of node.effects) applyEffect(acc, effect, 1);
  }

  for (const [id, level] of Object.entries(state.prestige.perks)) {
    const perk = Content.perk(id);
    if (!perk || level <= 0) continue;
    for (const effect of perk.effects) applyEffect(acc, effect, level);
  }

  // Company level is a gentle, always-on income bonus.
  acc.mult.sellPrice *= 1 + (state.level - 1) * BALANCE.level.incomePerLevel;

  const processes: Record<string, number> = {};
  for (const [recipe, rateValue] of Object.entries(acc.process)) {
    processes[recipe] = rateValue * acc.mult.processSpeed;
  }

  return {
    tapPower: acc.tapFlat * acc.mult.tapPower,
    teardownRate: acc.teardownFlat * acc.mult.teardownRate,
    storage: acc.storageFlat,
    queueSlots: acc.queueFlat,
    autoBuyPerMinute: acc.autoBuy,
    autoSellPerSec: acc.autoSell,
    offlineHours: acc.offlineHours,
    processes,
    mult: acc.mult,
    unlocks: acc.unlocks,
  };
}

/** Evaluates a content requirement against the current state. */
export function meetsRequirement(state: GameState, stats: Stats, req?: Requirement): boolean {
  if (!req) return true;
  if (req.level !== undefined && state.level < req.level) return false;
  if (req.research?.some((id) => !state.research.done.includes(id))) return false;
  if (req.owned?.some((o) => owned(state, o.id) < (o.count ?? 1))) return false;
  if (req.flags?.some((flag) => !stats.unlocks.has(flag))) return false;
  return true;
}

/** Human readable reason a locked entry is locked - used on every card. */
export function requirementText(req?: Requirement): string {
  if (!req) return '';
  const parts: string[] = [];
  if (req.level !== undefined) parts.push(`Level ${req.level}`);
  for (const id of req.research ?? []) {
    parts.push(`Forschung: ${Content.researchNode(id)?.name ?? id}`);
  }
  for (const o of req.owned ?? []) {
    const name = Content.purchasable(o.id)?.name ?? o.id;
    parts.push(o.count && o.count > 1 ? `${o.count}× ${name}` : name);
  }
  for (const flag of req.flags ?? []) parts.push(flag);
  return parts.join(' · ');
}

/** Price of the next copy of a purchasable. */
export function nextCost(state: GameState, id: string): number {
  const def = Content.purchasable(id);
  if (!def) return Infinity;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned(state, id)));
}

/** Reputation cost of the next level of a prestige perk. */
export function nextPerkCost(state: GameState, id: string): number {
  const perk = Content.perk(id);
  if (!perk) return Infinity;
  const level = state.prestige.perks[id] ?? 0;
  return Math.ceil(perk.cost * Math.pow(perk.costGrowth, level));
}
