import { BALANCE } from '../data/balance';
import { ECONOMY } from '../data/economy';
import { MACHINES, conditionFactor, levelMultiplier, powerFactor } from '../data/machines';
import { COMPANY, staffLevel, staffProductivity } from '../data/company';
import { PROGRESS } from '../data/progress';
import { Content } from '../data';
import { permanentBonuses } from '../progress/bonuses';
import { meets, requirementText as gateText } from '../progress/unlocks';
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
  /** Cosmetic prestige - decoration and plots, never production. */
  companyValue: number;
  /** Average material quality the yard produces, 0…1. */
  quality: number;
  /** Electricity supplied and drawn, in kW. */
  power: { supply: number; demand: number; factor: number };
  /** Average condition of all owned machines, 0…1. */
  condition: number;
  /** Condition points restored per second by automatic maintenance. */
  autoService: number;
  /** Contracts that can run at the same time. */
  contractSlots: number;
  /** Research points generated per second (GDD chapter 7). */
  researchPointsPerSec: number;
  /** Extra parallel research projects beyond the base slot. */
  researchSlots: number;
  /** Extra technology levels the lab may reach. */
  techTier: number;
  /** Yield multipliers: '*' applies to everything, plus per-material entries. */
  yieldMult: Record<string, number>;
}

const NEUTRAL: Record<MultiplierTarget, number> = {
  tapPower: 1,
  teardownRate: 1,
  sellPrice: 1,
  buyPrice: 1,
  processSpeed: 1,
  xpGain: 1,
  rareFind: 1,
  autoSell: 1,
  autoBuy: 1,
  storage: 1,
  powerUse: 1,
  wear: 1,
  autoService: 1,
  researchSpeed: 1,
  contractReward: 1,
  staffProductivity: 1,
  researchPoints: 1,
  techCost: 1,
  salary: 1,
  offlineRate: 1,
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
  companyValue: number;
  quality: number;
  power: number;
  powerUse: number;
  autoService: number;
  contractSlots: number;
  researchPoints: number;
  researchSlots: number;
  techTier: number;
  yieldMult: Record<string, number>;
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
    case 'companyValue':
      acc.companyValue += effect.amount * count;
      break;
    case 'quality':
      acc.quality += effect.amount * count;
      break;
    case 'power':
      acc.power += effect.amount * count;
      break;
    case 'powerUse':
      acc.powerUse += effect.amount * count;
      break;
    case 'autoService':
      acc.autoService += effect.amount * count;
      break;
    case 'contractSlots':
      acc.contractSlots += effect.amount * count;
      break;
    case 'researchPoints':
      acc.researchPoints += effect.perSecond * count;
      break;
    case 'researchSlots':
      acc.researchSlots += effect.amount * count;
      break;
    case 'techTier':
      acc.techTier += effect.amount * count;
      break;
    case 'yield': {
      const key = effect.material ?? '*';
      acc.yieldMult[key] = (acc.yieldMult[key] ?? 1) * Math.pow(effect.factor, count);
      break;
    }
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
    companyValue: 0,
    quality: ECONOMY.quality.base,
    power: MACHINES.power.baseSupply,
    powerUse: 0,
    autoService: 0,
    contractSlots: 0,
    researchPoints: 0,
    researchSlots: 0,
    techTier: 0,
    yieldMult: {},
  };

  let conditionSum = 0;
  let machineCount = 0;
  // Staff are folded in last: the welfare multiplier comes from buildings.
  const staff: { def: (typeof Content.purchasables)[number]; count: number; productivity: number }[] = [];

  for (const def of Content.purchasables) {
    const count = owned(state, def.id);
    if (count <= 0) continue;

    if (def.category === 'machine') {
      // A machine is levelled, not duplicated: output follows the level table
      // and is scaled by how well the machine has been maintained.
      const level = Math.min(count, MACHINES.maxLevel);
      const condition = state.condition[def.id] ?? 1;
      const scale = levelMultiplier(level) * conditionFactor(condition);
      conditionSum += condition;
      machineCount++;

      for (const effect of def.effects) {
        // Power draw is not reduced by wear - a worn machine still eats power.
        const factor =
          effect.kind === 'powerUse'
            ? levelMultiplier(level) * (level >= MACHINES.master.level ? MACHINES.master.powerFactor : 1)
            : scale;
        applyEffect(acc, effect, factor);
      }
      if (level >= MACHINES.qualityFromLevel) acc.quality += MACHINES.qualityPerMachine;
      if (level >= MACHINES.master.level) acc.mult.rareFind *= MACHINES.master.rareFind;
      continue;
    }

    if (def.category === 'employee') {
      // Experience and welfare buildings both scale what a role delivers.
      const level = staffLevel(state.staffXp[def.id] ?? 0);
      staff.push({ def, count, productivity: staffProductivity(level) });
      continue;
    }

    for (const effect of def.effects) applyEffect(acc, effect, count);
  }

  // Technologies, prestige nodes and achievements all arrive through the
  // permanent bonus system, so a new source of lasting bonuses is added there.
  for (const entry of permanentBonuses(state)) applyEffect(acc, entry.effect, entry.count);

  for (const entry of staff) {
    // Experience and welfare raise how much a role *delivers*, not the
    // percentage it grants. Feeding the productivity bonus into the exponent
    // of a multiplier effect turns "+5 % per manager" into "+105 % per
    // manager" once the bonuses stack, which is what blew the late-game
    // economy past 1e120 before this split existed.
    const output = entry.count * entry.productivity * acc.mult.staffProductivity;
    for (const effect of entry.def.effects) {
      const scale = effect.kind === 'multiplier' || effect.kind === 'yield' ? entry.count : output;
      applyEffect(acc, effect, scale);
    }
  }

  // The Forschungslabor has 10 levels (GDD chapter 7): each raises point
  // output, speed, the reachable technology tier, and at two steps the number
  // of parallel projects.
  const lab = Math.min(PROGRESS.research.labLevels, owned(state, 'lab'));
  if (lab > 0) {
    acc.researchPoints += PROGRESS.research.basePointsPerSecond + lab * PROGRESS.research.labPointsPerLevel;
    acc.mult.researchSpeed *= 1 + lab * PROGRESS.research.labSpeedPerLevel;
    acc.techTier += lab * PROGRESS.research.labTierPerLevel;
    for (const at of PROGRESS.research.labSlotAt) if (lab >= at) acc.researchSlots += 1;
  }

  // The company focus (GDD chapter 6) is just another effect source.
  const priority = Content.priority(state.priority);
  for (const effect of priority?.effects ?? []) applyEffect(acc, effect, 1);

  // Staff productivity bonuses from buildings apply to every employee effect
  // that was already folded in, so they ride on the multiplier instead.
  void COMPANY;

  // Company level is a gentle, always-on income bonus.
  acc.mult.sellPrice *= 1 + (state.level - 1) * BALANCE.level.incomePerLevel;

  const demand = acc.powerUse * acc.mult.powerUse;
  const factor = powerFactor(acc.power, demand);
  const condition = machineCount > 0 ? conditionSum / machineCount : 1;

  const processes: Record<string, number> = {};
  for (const [recipe, rateValue] of Object.entries(acc.process)) {
    processes[recipe] = rateValue * acc.mult.processSpeed * factor;
  }

  return {
    // Manual work needs no electricity - the hammer always swings.
    tapPower: acc.tapFlat * acc.mult.tapPower,
    teardownRate: acc.teardownFlat * acc.mult.teardownRate * factor,
    storage: acc.storageFlat * acc.mult.storage,
    queueSlots: acc.queueFlat,
    autoBuyPerMinute: acc.autoBuy * acc.mult.autoBuy,
    autoSellPerSec: acc.autoSell * acc.mult.autoSell * factor,
    offlineHours: Math.min(BALANCE.offline.maxHours, acc.offlineHours),
    processes,
    mult: acc.mult,
    unlocks: acc.unlocks,
    companyValue: acc.companyValue,
    quality: Math.max(0, Math.min(ECONOMY.quality.max, acc.quality)),
    power: { supply: acc.power, demand, factor },
    condition,
    autoService: acc.autoService * acc.mult.autoService,
    contractSlots: acc.contractSlots,
    researchPointsPerSec: acc.researchPoints * acc.mult.researchPoints,
    researchSlots: acc.researchSlots,
    techTier: acc.techTier,
    yieldMult: acc.yieldMult,
  };
}

/** Evaluates a content requirement. Delegates to the unlock manager. */
export function meetsRequirement(state: GameState, stats: Stats, req?: Requirement): boolean {
  return meets(state, req, stats.unlocks);
}

/** Human readable reason a locked entry is locked - used on every card. */
export const requirementText = gateText;

/** Price of the next copy of a purchasable. */
export function nextCost(state: GameState, id: string): number {
  const def = Content.purchasable(id);
  if (!def) return Infinity;
  return Math.ceil(def.baseCost * Math.pow(def.costGrowth, owned(state, id)));
}

/** Industriepunkte the next level of a prestige node costs. */
export function nextPerkCost(state: GameState, id: string): number {
  const perk = Content.perk(id);
  if (!perk) return Infinity;
  const level = state.prestige.perks[id] ?? 0;
  return Math.ceil(perk.cost * Math.pow(perk.costGrowth, level));
}
