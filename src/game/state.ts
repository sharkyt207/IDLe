import { BALANCE } from '../data/balance';
import { UI } from '../data/ui';

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
  /** The level being researched. */
  level: number;
  /** Seconds left. */
  remaining: number;
  /** Total seconds this project takes - basis for the progress bar. */
  total: number;
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
  /** material id -> weighted average quality of that pile, 0…1. */
  quality: Record<string, number>;
  /** purchasable id -> owned count (machines: level). */
  owned: Record<string, number>;
  /** machine id -> condition 0…1. Missing means "as good as new". */
  condition: Record<string, number>;
  /** employee id -> accumulated experience. */
  staffXp: Record<string, number>;

  /**
   * Research (GDD chapter 7). Technologies have levels, not a done flag, and
   * several projects can run at once once the lab is big enough.
   */
  research: {
    /** Accumulated research points - not buyable with money. */
    points: number;
    /** technology id -> level reached. */
    techs: Record<string, number>;
    active: ResearchProgress[];
    /** Milestone keys (`tech@level`) already announced. */
    seen: string[];
  };

  /** Deliveries bought and waiting for the pad. */
  queue: string[];
  active: ActiveVehicle | null;

  /** Which delivery the logistics automation orders. */
  autoBuyVehicle: string;
  autoBuyEnabled: boolean;
  autoSellEnabled: boolean;
  /** Materials the player holds back from auto-selling (e.g. smelter input). */
  autoSellLocked: Record<string, boolean>;
  /** Warehouse rules per material (GDD chapter 6). */
  rules: Record<string, WarehouseRule>;
  /** The company focus the operation follows. */
  priority: string;

  prestige: {
    /** Industriepunkte, spendable in the prestige tree. */
    points: number;
    /** Earned over the whole career - drives titles and rare technologies. */
    lifetimePoints: number;
    perks: Record<string, number>;
    runs: number;
    bestRun: number;
  };

  /** Achievement ids already earned (GDD chapter 7). */
  achievements: string[];

  /** Contracts and auctions (GDD chapter 4). */
  trade: {
    offers: ContractOffer[];
    active: ActiveContract[];
    /** Seconds until the offer list rotates. */
    offerTimer: number;
    auction: AuctionState | null;
    /** Seconds until the next lot goes up. */
    auctionTimer: number;
  };

  /** Collectible id -> how many are in the display case. */
  collection: Record<string, number>;

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
    /** material id -> units ever produced. Basis for material achievements. */
    materials: Record<string, number>;
  };

  /** Rolling business metrics for the statistics screen. */
  metrics: {
    /** Seconds into the current business day. */
    dayTime: number;
    dayEarned: number;
    daySpent: number;
    /** Completed days, newest last, capped to one week. */
    dayHistory: { earned: number; spent: number }[];
    /** Units of material ever recycled - basis for the CO₂ figure. */
    unitsRecycled: number;
    /** Wages and upkeep still owed because the account ran dry. */
    arrears: number;
  };

  /** Presentation and accessibility (GDD chapter 8). */
  settings: {
    haptics: boolean;
    /** Interface language (GDD chapter 9). */
    locale: string;
    /** Theme id from `data/ui.ts`: standard, night, winter. */
    theme: string;
    /** Interface scale, 0.8…1.5. */
    uiScale: number;
    colorblind: boolean;
    /** Fewer particles and no spring animations - accessibility *and* perf. */
    reducedEffects: boolean;
    /** Moves the primary actions to the left of the screen. */
    leftHanded: boolean;
    sound: boolean;
    volumeMusic: number;
    volumeEffects: number;
    volumeUi: number;
  };
}

/** Long-term storage strategy for one material. */
export interface WarehouseRule {
  /** Never auto-sell below this stock. */
  keep?: number;
  /** Only auto-sell when a unit fetches at least this much. */
  minPrice?: number;
}

/** A customer's open request. */
export interface ContractOffer {
  /** Unique per offer, not per contract type. */
  key: string;
  defId: string;
  demand: { material: string; amount: number }[];
  payout: number;
  /** EUR per second while the contract runs. */
  income: number;
}

export interface ActiveContract extends ContractOffer {
  delivered: Record<string, number>;
  /** Seconds of recurring income left; 0 while still being fulfilled. */
  incomeLeft: number;
  done: boolean;
}

export interface AuctionState {
  lotId: string;
  /** Estimated market value of the lot. */
  value: number;
  bid: number;
  increment: number;
  playerLeads: boolean;
  /** Seconds left in the bidding window. */
  timeLeft: number;
  /** Seconds until the AI reacts again. */
  aiThink: number;
  /** The AI never bids above this. */
  aiMax: number;
}

export const SAVE_VERSION = 4;

export function createInitialState(
  carryPrestige?: GameState['prestige'],
  carryAchievements?: string[],
): GameState {
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
    quality: {},
    owned: {},
    condition: {},
    staffXp: {},

    research: { points: 0, techs: {}, active: [], seen: [] },

    queue: [],
    active: null,

    autoBuyVehicle: 'kleinwagen',
    autoBuyEnabled: true,
    autoSellEnabled: true,
    autoSellLocked: {},
    rules: {},
    priority: 'balanced',

    prestige: carryPrestige ?? { points: 0, lifetimePoints: 0, perks: {}, runs: 0, bestRun: 0 },
    achievements: carryAchievements ?? [],

    trade: { offers: [], active: [], offerTimer: 20, auction: null, auctionTimer: 90 },
    collection: {},

    world: { placements: {}, dayTime: 300, weather: 'clear', weatherLeft: 120 },

    tutorial: { step: 0, done: false, choiceOffered: false },

    progressStats: {
      vehiclesDone: 0,
      partsRemoved: 0,
      taps: 0,
      sales: 0,
      purchases: 0,
      discovered: [],
      materials: {},
    },

    metrics: { dayTime: 0, dayEarned: 0, daySpent: 0, dayHistory: [], unitsRecycled: 0, arrears: 0 },

    settings: {
      haptics: true,
      locale: 'de',
      theme: 'standard',
      uiScale: UI.scale.default,
      colorblind: false,
      reducedEffects: false,
      leftHanded: false,
      sound: true,
      volumeMusic: UI.volume.music,
      volumeEffects: UI.volume.effects,
      volumeUi: UI.volume.ui,
    },
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
