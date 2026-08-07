/**
 * Content type definitions.
 *
 * Everything the player can encounter in Scrap Empire is described by these
 * plain-data interfaces. Systems never hardcode content ids - they read the
 * registry (see `src/data/index.ts`) and react to *effect descriptors*.
 * Adding a vehicle, machine, employee or research node therefore means adding
 * one object to a data file, nothing else.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Yard categories - drive which screen a purchasable shows up on. */
export type PurchaseCategory =
  | 'tool'
  | 'machine'
  | 'employee'
  | 'building'
  | 'lot'
  | 'decor'
  | 'line'
  | 'power';

/** Visual archetype used by the canvas renderer to draw a delivery. */
export type VehicleShape = 'bike' | 'car' | 'van' | 'truck' | 'container' | 'machine';

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

/**
 * Effect descriptors are the single extension point between content and code.
 * Tools, machines, employees, buildings, research nodes and prestige perks all
 * emit the same descriptors; `src/game/stats.ts` folds them into one Stats
 * object each time the player's inventory changes.
 */
export type Effect =
  /** Work applied per manual tap. */
  | { kind: 'tapPower'; amount: number }
  /** Work applied automatically every second (cranes, mechanics, robots). */
  | { kind: 'teardownRate'; amount: number }
  /** Extra material units the yard can hold. */
  | { kind: 'storage'; amount: number }
  /** Vehicles automatically ordered per minute. */
  | { kind: 'autoBuy'; perMinute: number }
  /** Material units automatically sold per second (highest value first). */
  | { kind: 'autoSell'; unitsPerSec: number }
  /** Crafting throughput for one recipe, in crafts per second. */
  | { kind: 'process'; recipe: string; craftsPerSec: number }
  /** Extra parking slots for bought-but-not-yet-processed deliveries. */
  | { kind: 'queueSlots'; amount: number }
  /** Hours of offline progress that are simulated on return. */
  | { kind: 'offlineHours'; amount: number }
  /** Multiplier on a named stat, e.g. 'sellPrice', 'teardownRate', 'tapPower'. */
  | { kind: 'multiplier'; target: MultiplierTarget; factor: number }
  /** Cosmetic prestige. Raises the company value, never the production. */
  | { kind: 'companyValue'; amount: number }
  /** Raises the average material quality the yard produces (0…1, additive). */
  | { kind: 'quality'; amount: number }
  /** Electricity supplied to the yard, in kW. */
  | { kind: 'power'; amount: number }
  /** Electricity the machine draws, in kW. */
  | { kind: 'powerUse'; amount: number }
  /** Condition restored per second without the player lifting a finger. */
  | { kind: 'autoService'; amount: number }
  /**
   * Multiplies what a dismantled part yields. Without `material` it lifts
   * every yield (Magnetseparator); with one it targets a single material
   * (Wirbelstromseparator, Batteriestation).
   */
  | { kind: 'yield'; material?: string; factor: number }
  /** Extra contracts the company can run at once. */
  | { kind: 'contractSlots'; amount: number }
  /** Unlocks content that is otherwise gated (vehicles, recipes, purchasables). */
  | { kind: 'unlock'; id: string };

export type MultiplierTarget =
  | 'tapPower'
  | 'teardownRate'
  | 'sellPrice'
  | 'buyPrice'
  | 'processSpeed'
  | 'xpGain'
  | 'rareFind'
  | 'autoSell'
  | 'autoBuy'
  | 'storage'
  | 'powerUse'
  | 'wear'
  | 'autoService'
  | 'researchSpeed'
  | 'contractReward'
  | 'staffProductivity';

/** Requirement gate. All listed conditions must hold. */
export interface Requirement {
  /** Minimum company level. */
  level?: number;
  /** Research node ids that must be completed. */
  research?: string[];
  /** Purchasable ids the player must own at least one (or `n`) of. */
  owned?: { id: string; count?: number }[];
  /** Explicit unlock flags granted by `{ kind: 'unlock' }` effects. */
  flags?: string[];
}

// ---------------------------------------------------------------------------
// Materials & recipes
// ---------------------------------------------------------------------------

export interface MaterialDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  /** 0 raw · 1 refined · 2 component · 3 finished good. */
  tier: number;
  /** UI grouping: Metall, Kunststoff, Glas, Elektronik, Flüssigkeit, Selten … */
  category: string;
  /** Base price per unit in EUR. Market drift and quality apply on top. */
  basePrice: number;
  /**
   * Fluids and similar must be disposed of properly: they cost money instead
   * of earning it, until the recycling research turns them into a product.
   */
  hazardous?: boolean;
}

export interface RecipeDef {
  id: string;
  name: string;
  input: { material: string; amount: number }[];
  output: { material: string; amount: number }[];
  /** Shown in the UI so the player can compare value gain. */
  desc?: string;
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export interface PartDef {
  id: string;
  name: string;
  icon: string;
  /** Work units needed to detach this part. */
  work: number;
  /** Materials granted when the part comes off. */
  yields: { material: string; min: number; max: number }[];
  /** Instant cash for scrap dealers, keeps the very early loop rewarding. */
  cash?: number;
  /**
   * Legacy hotspot position on the flat sprite. The isometric view lays the
   * markers out on a ring instead, so this is optional.
   */
  x?: number;
  y?: number;
}

export interface VehicleDef {
  id: string;
  name: string;
  icon: string;
  shape: VehicleShape;
  color: string;
  rarity: Rarity;
  /** Quality class 1–6 (Alltag … Industrie), see GDD chapter 4. */
  vehicleClass: number;
  /**
   * Purchase price in EUR, derived from the material value and the class
   * margin in `economy.ts` - never hand-tuned, so the ladder stays profitable.
   */
  price: number;
  /** Cosmetic/flavour, also feeds the delivery card. */
  weightKg: number;
  /** XP granted when fully dismantled. */
  xp: number;
  requires?: Requirement;
  parts: PartDef[];
  /** Chance-based bonus loot, rolled once per completed vehicle. */
  rareFinds?: { chance: number; material: string; amount: number; label: string }[];
}

// ---------------------------------------------------------------------------
// Purchasables (tools, machines, employees, buildings)
// ---------------------------------------------------------------------------

export interface PurchasableDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: PurchaseCategory;
  /** Sub-grouping inside a screen, e.g. 'Zerlegen', 'Logistik'. */
  group: string;
  baseCost: number;
  /** Cost multiplier per already-owned copy. 1 = flat price. */
  costGrowth: number;
  /** Maximum copies/levels. */
  maxCount: number;
  requires?: Requirement;
  /** Wage per second per head (employees) - charged continuously. */
  salary?: number;
  /** Upkeep per second per copy (buildings and plants). */
  upkeep?: number;
  /**
   * Effects granted per owned copy. For `machine` entries `maxCount` is the
   * **level cap** and effects scale by the level multiplier instead, so a
   * machine is upgraded rather than duplicated (GDD chapter 5).
   */
  effects: Effect[];
  /**
   * Presence on the map. `model` selects the isometric shape the renderer
   * draws; `stageAt` lists the owned-counts at which the structure visibly
   * upgrades (GDD: Schuppen → renoviert → Halle → Hightech → futuristisch).
   */
  building?: {
    model: string;
    /** Footprint in tiles. Defaults to 2×2. */
    size?: number;
    stageAt?: number[];
    /** Node in the visual material flow, e.g. 'sort' | 'melt' | 'ship'. */
    flow?: FlowRole;
  };
}

/** Where a structure sits in the visible material chain. */
export type FlowRole = 'teardown' | 'sort' | 'store' | 'melt' | 'produce' | 'ship';

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export interface ResearchDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  branch: string;
  cost: number;
  /** Seconds the lab needs. 0 = instant. */
  duration: number;
  requires?: Requirement;
  effects: Effect[];
}

// ---------------------------------------------------------------------------
// Prestige
// ---------------------------------------------------------------------------

export interface PrestigePerkDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Reputation points per level. */
  cost: number;
  costGrowth: number;
  maxLevel: number;
  effects: Effect[];
}
