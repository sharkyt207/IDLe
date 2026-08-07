import { Content } from '../data';
import { staffLevel } from '../data/company';
import type { Game } from '../game/game';
import { owned, type MissionCounters } from '../game/state';
import { automationRate } from './prestige';
import { techLevelsTotal, techsDone } from './unlocks';

/**
 * Progress Tracker (GDD chapter 10).
 *
 * One place that answers "what is the current value of X". Achievements,
 * missions and milestones all ask here instead of each reimplementing "how
 * many vehicles has the player dismantled".
 *
 * That matters more than it sounds: before this existed, a new mission type
 * meant a new switch statement, and two of them would have drifted apart the
 * first time a counter changed meaning.
 */

export type Metric =
  // career totals - survive a prestige restart
  | 'vehiclesDone'
  | 'lifetimeEarned'
  | 'collectibles'
  | 'prestigeRuns'
  | 'materialProduced'
  | 'contractsDone'
  | 'auctionsWon'
  | 'partsRemoved'
  | 'taps'
  | 'sales'
  | 'purchases'
  | 'vehicleTypes'
  | 'playtime'
  | 'missionsDone'
  // current company
  | 'money'
  | 'companyValue'
  | 'level'
  | 'techLevels'
  | 'techsDone'
  | 'machineLevels'
  | 'maxMachineLevel'
  | 'machineTypes'
  | 'staffLevel'
  | 'staffCount'
  | 'buildingCount'
  | 'lotCount'
  | 'lineCount'
  | 'ownedCount'
  | 'ownedOf'
  | 'techLevelOf'
  | 'decorCount'
  | 'materialStored'
  | 'storageCapacity'
  | 'teardownRate'
  | 'sellRate'
  | 'buyRate'
  | 'researchPoints'
  | 'prestigePoints'
  | 'achievements'
  | 'automationRate'
  | 'efficiency'
  | 'condition'
  // per-run counters, reset by the mission that owns them
  | 'runVehicles'
  | 'runEarned'
  | 'runContracts'
  | 'runAuctions'
  | 'runResearch'
  | 'runMaterial';

/** A metric plus the extra key some of them need. */
export interface MetricRef {
  metric: Metric;
  /** Material id for `materialProduced` / `materialStored`. */
  material?: string;
  /** Content id for `ownedOf` (purchasable) and `techLevelOf` (technology). */
  id?: string;
}

/**
 * Reads one metric.
 *
 * @param since optional counter snapshot; the `run*` metrics are measured
 *   against it, which is how a daily mission asks for "ten vehicles *from
 *   now*" rather than "ten vehicles ever".
 */
export function readMetric(game: Game, ref: MetricRef, since?: Counters): number {
  const { state, stats } = game;
  switch (ref.metric) {
    case 'vehiclesDone':
      return state.progressStats.vehiclesDone;
    case 'lifetimeEarned':
      return state.lifetimeEarned;
    case 'collectibles':
      return Object.values(state.collection).reduce((a, b) => a + b, 0);
    case 'prestigeRuns':
      return state.prestige.runs;
    case 'materialProduced':
      return ref.material ? (state.progressStats.materials[ref.material] ?? 0) : 0;
    case 'contractsDone':
      return state.progressStats.contractsDone;
    case 'auctionsWon':
      return state.progressStats.auctionsWon;
    case 'partsRemoved':
      return state.progressStats.partsRemoved;
    case 'taps':
      return state.progressStats.taps;
    case 'sales':
      return state.progressStats.sales;
    case 'purchases':
      return state.progressStats.purchases;
    case 'vehicleTypes':
      return state.progressStats.discovered.length;
    case 'playtime':
      return state.playtime;
    case 'missionsDone':
      return state.missions.done.length;

    case 'money':
      return state.money;
    case 'companyValue':
      return game.companyValue();
    case 'level':
      return state.level;
    case 'techLevels':
      return techLevelsTotal(state);
    case 'techsDone':
      return techsDone(state);
    case 'machineLevels':
      return countCategory(game, 'machine');
    case 'maxMachineLevel':
      return Math.max(
        0,
        ...Content.purchasables
          .filter((d) => d.category === 'machine')
          .map((d) => owned(game.state, d.id)),
      );
    case 'machineTypes':
      return typesOwned(game, 'machine');
    case 'staffLevel':
      return Math.max(0, ...Object.values(state.staffXp).map(staffLevel));
    case 'staffCount':
      return countCategory(game, 'employee');
    case 'buildingCount':
      return countCategory(game, 'building');
    case 'lotCount':
      return countCategory(game, 'lot');
    case 'lineCount':
      return countCategory(game, 'line');
    case 'ownedCount':
      return Object.values(state.owned).reduce((a, b) => a + b, 0);
    case 'ownedOf':
      return ref.id ? owned(state, ref.id) : 0;
    case 'techLevelOf':
      return ref.id ? (state.research.techs[ref.id] ?? 0) : 0;
    case 'decorCount':
      return countCategory(game, 'decor');
    case 'materialStored':
      return ref.material ? (state.storage[ref.material] ?? 0) : game.storageUsed();
    case 'storageCapacity':
      return stats.storage;
    case 'teardownRate':
      return stats.teardownRate;
    case 'sellRate':
      return stats.autoSellPerSec;
    case 'buyRate':
      return stats.autoBuyPerMinute;
    case 'researchPoints':
      return state.research.points;
    case 'prestigePoints':
      return state.prestige.points;
    case 'achievements':
      return state.achievements.length;
    case 'automationRate':
      return automationRate(game);
    case 'efficiency':
      return stats.power.factor * stats.condition;
    case 'condition':
      return stats.condition;

    // Per-run counters are differences against a snapshot.
    case 'runVehicles':
      return state.progressStats.vehiclesDone - (since?.vehicles ?? 0);
    case 'runEarned':
      return state.lifetimeEarned - (since?.earned ?? 0);
    case 'runContracts':
      return state.progressStats.contractsDone - (since?.contracts ?? 0);
    case 'runAuctions':
      return state.progressStats.auctionsWon - (since?.auctions ?? 0);
    case 'runResearch':
      return techLevelsTotal(state) - (since?.research ?? 0);
    case 'runMaterial':
      return ref.material
        ? (state.progressStats.materials[ref.material] ?? 0) - (since?.material ?? 0)
        : 0;
  }
}

/**
 * The counters a timed mission measures against. Lives in the state module
 * because it is serialised with the mission that owns it.
 */
export type Counters = MissionCounters;

/**
 * Snapshot of every counter a `run*` metric uses.
 *
 * @param material the material a `runMaterial` goal watches. Only one per
 *   snapshot, because a snapshot belongs to exactly one mission.
 */
export function snapshot(game: Game, material?: string): Counters {
  return {
    vehicles: game.state.progressStats.vehiclesDone,
    earned: game.state.lifetimeEarned,
    contracts: game.state.progressStats.contractsDone,
    auctions: game.state.progressStats.auctionsWon,
    research: techLevelsTotal(game.state),
    material: material ? (game.state.progressStats.materials[material] ?? 0) : 0,
  };
}

function countCategory(game: Game, category: string): number {
  return Content.purchasables
    .filter((d) => d.category === category)
    .reduce((sum, d) => sum + owned(game.state, d.id), 0);
}

function typesOwned(game: Game, category: string): number {
  return Content.purchasables.filter((d) => d.category === category && owned(game.state, d.id) > 0).length;
}
