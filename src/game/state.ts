import { BALANCE } from '../data/balance';

/** One part of the vehicle currently on the dismantling pad. */
export interface ActivePart {
  id: string;
  /** Work already applied. */
  work: number;
  done: boolean;
}

export interface ActiveVehicle {
  defId: string;
  parts: ActivePart[];
}

export interface ResearchProgress {
  id: string;
  /** Seconds left. */
  remaining: number;
}

/**
 * The complete, serializable game state. Everything here survives a save;
 * anything derived (rates, capacities, multipliers) lives in `stats.ts`.
 */
export interface GameState {
  version: number;
  createdAt: number;
  /** Epoch ms of the last save - basis for offline progress. */
  lastSeen: number;
  /** Seconds of active play. */
  playtime: number;

  money: number;
  /** Earned in the current company - drives the prestige payout. */
  runEarned: number;
  lifetimeEarned: number;

  level: number;
  xp: number;

  /** material id -> units in storage. */
  storage: Record<string, number>;
  /** purchasable id -> owned count. */
  owned: Record<string, number>;

  research: { done: string[]; active: ResearchProgress | null };

  /** Deliveries bought and waiting for the pad. */
  queue: string[];
  active: ActiveVehicle | null;

  /** Which delivery the logistics automation orders. */
  autoBuyVehicle: string;
  autoBuyEnabled: boolean;
  autoSellEnabled: boolean;
  /** Materials the player holds back from auto-selling (e.g. smelter input). */
  autoSellLocked: Record<string, boolean>;

  prestige: {
    reputation: number;
    perks: Record<string, number>;
    runs: number;
    bestRun: number;
  };

  /** Map state (GDD chapter 3). Geometry itself is derived, not stored. */
  world: {
    /** Instance key → slot id. Only player overrides and auto-assignments. */
    placements: Record<string, string>;
    /** Seconds into the current 15-minute day. */
    dayTime: number;
    weather: string;
    /** Seconds left of the current weather. */
    weatherLeft: number;
  };

  tutorial: { step: number; done: boolean; choiceOffered: boolean };

  progressStats: {
    vehiclesDone: number;
    partsRemoved: number;
    taps: number;
    /** Manual sales - drives tutorial progress. */
    sales: number;
    /** Manually ordered deliveries. */
    purchases: number;
    /** Vehicle ids ever dismantled - "alle Fahrzeugtypen entdeckt". */
    discovered: string[];
  };

  settings: { haptics: boolean };
}

export const SAVE_VERSION = 1;

export function createInitialState(carryPrestige?: GameState['prestige']): GameState {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    lastSeen: now,
    playtime: 0,

    money: BALANCE.start.money,
    runEarned: 0,
    lifetimeEarned: 0,

    level: 1,
    xp: 0,

    storage: {},
    owned: {},

    research: { done: [], active: null },

    queue: [],
    active: null,

    autoBuyVehicle: 'kleinwagen',
    autoBuyEnabled: true,
    autoSellEnabled: true,
    autoSellLocked: {},

    prestige: carryPrestige ?? { reputation: 0, perks: {}, runs: 0, bestRun: 0 },

    world: { placements: {}, dayTime: 300, weather: 'clear', weatherLeft: 120 },

    tutorial: { step: 0, done: false, choiceOffered: false },

    progressStats: { vehiclesDone: 0, partsRemoved: 0, taps: 0, sales: 0, purchases: 0, discovered: [] },

    settings: { haptics: true },
  };
}

/** XP needed to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.floor(BALANCE.level.base * Math.pow(BALANCE.level.growth, level - 1));
}

export function owned(state: GameState, id: string): number {
  return state.owned[id] ?? 0;
}

export function stored(state: GameState, materialId: string): number {
  return state.storage[materialId] ?? 0;
}

export function storedTotal(state: GameState): number {
  let total = 0;
  for (const key in state.storage) total += state.storage[key];
  return total;
}
