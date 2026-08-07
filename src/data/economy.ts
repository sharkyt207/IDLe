/**
 * Central economy configuration (GDD chapter 4).
 *
 * Every price relationship in the game is derived from these numbers, so
 * rebalancing means editing this file - never the systems.
 */
export const ECONOMY = {
  /**
   * Target margin per vehicle class: material value ÷ purchase price.
   * Rising with the class is what makes climbing the ladder worthwhile, and
   * it is why higher tiers stay profitable as costs inflate.
   */
  vehicleMargin: [2.2, 2.4, 2.6, 2.8, 3.0, 3.3] as const,

  /** Material quality, from "Schlecht" to "Rein". */
  quality: {
    names: ['Schlecht', 'Normal', 'Gut', 'Hochwertig', 'Rein'] as const,
    /** Price multiplier per level. */
    multiplier: [0.7, 1.0, 1.3, 1.7, 2.2] as const,
    /**
     * Quality a bare yard produces. 0.25 maps exactly onto "Normal" = 1.0×,
     * so a fresh yard sells at the listed price and every upgrade is a gain
     * rather than the removal of a hidden penalty.
     */
    base: 0.25,
    /** Cap, reached only with the best machines and research. */
    max: 1,
  },

  /** Dynamic market prices. */
  market: {
    /** Long, slow swing so storing material is a real decision. */
    slowAmplitude: 0.35,
    slowCycleSeconds: 900,
    /** Faster ripple on top. */
    fastAmplitude: 0.1,
    fastCycleSeconds: 210,
    /** A price counts as trending when it deviates by more than this. */
    trendThreshold: 0.06,
  },

  /** Fluids cost money to dispose of until recycling is researched. */
  disposal: {
    /** Fraction of the base price charged as a disposal fee. */
    feeFactor: 1,
    /** Effect id that turns disposal into a sellable product. */
    unlockId: 'fluid_recycling',
  },

  /** Contracts: recurring customers. */
  contracts: {
    maxActive: 3,
    maxOffers: 4,
    /** Seconds until the offer list refreshes. */
    offerRefreshSeconds: 240,
    /** Recurring income runs this long after fulfilment. */
    incomeSeconds: 600,
    /** Reward = material value × this, split into bonus and recurring income. */
    rewardFactor: 1.9,
    recurringShare: 0.45,
  },

  /** Auctions: bidding against AI companies. */
  auctions: {
    /** A new lot appears roughly this often (seconds). */
    intervalSeconds: 210,
    /** Bidding window. */
    durationSeconds: 45,
    /** Opening bid as a fraction of the lot's value. */
    startFactor: 0.35,
    /** The AI never pays more than this fraction of the value. */
    aiMaxFactor: [0.55, 0.75],
    /** Each raise adds this fraction of the opening bid. */
    increment: 0.15,
    /** Seconds between AI counter-bids. */
    aiThinkSeconds: [2.5, 6],
    maxOpen: 2,
  },

  /** Random finds while dismantling. */
  finds: {
    /** Base chance per finished vehicle, scaled by class and rareFind. */
    baseChance: 0.06,
    perTier: 0.02,
  },

  /** Company value (Firmenwert). */
  companyValue: {
    /** Share of what was invested in structures that counts as value. */
    assetShare: 0.8,
    /** Stored material counts at its current market value, times this. */
    inventoryShare: 0.5,
    /** Each completed research node adds this much. */
    perResearch: 25_000,
    /** Each employee adds this much. */
    perEmployee: 5_000,
  },
} as const;

export type QualityLevel = 0 | 1 | 2 | 3 | 4;

/** Maps a 0…1 quality value onto a level index. */
export function qualityLevel(value: number): QualityLevel {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.min(4, Math.floor(clamped * 5)) as QualityLevel;
}

export function qualityName(value: number): string {
  return ECONOMY.quality.names[qualityLevel(value)];
}

/** Price multiplier for a 0…1 quality value, interpolated between levels. */
export function qualityMultiplier(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  const scaled = clamped * 4;
  const low = Math.floor(scaled);
  const high = Math.min(4, low + 1);
  const t = scaled - low;
  const m = ECONOMY.quality.multiplier;
  return m[low] + (m[high] - m[low]) * t;
}
