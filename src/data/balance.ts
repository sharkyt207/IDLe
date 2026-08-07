/**
 * Central balancing configuration.
 *
 * Every global tuning knob lives here. Content-specific numbers (prices,
 * yields, costs) live next to their content definition, so a designer only
 * ever touches `src/data/*`.
 */
export const BALANCE = {
  /** Starting loadout, mirrors GDD chapter 2 "Spielstart". */
  start: {
    money: 500,
    storage: 60,
    queueSlots: 1,
    tapPower: 1,
    offlineHours: 2,
    /** Free first delivery so the very first tap is possible immediately. */
    starterVehicle: 'kleinwagen',
  },

  /** Simulation. */
  tickRate: 10, // fixed simulation steps per second
  autosaveSeconds: 10,

  /** Offline progress. */
  offline: {
    /** Below this, returning is treated as "no meaningful absence". */
    minSeconds: 60,
    /** Automated production runs at this efficiency while away. */
    efficiency: 0.7,
    /** Max simulation chunks used to fold offline time (keeps load fast). */
    maxChunks: 400,
    /** Hard ceiling on offline production (GDD chapter 5). */
    maxHours: 12,
  },

  /** Levelling curve: xpForLevel(n) = base * growth^(n-1). */
  level: {
    base: 40,
    growth: 1.42,
    /** Every level grants a small permanent income bonus. */
    incomePerLevel: 0.02,
  },

  /** Market price drift keeps selling a decision instead of a reflex. */
  market: {
    /** Prices wander inside [1-amplitude, 1+amplitude]. */
    amplitude: 0.18,
    /** Seconds for a full drift cycle per material. */
    cycleSeconds: 180,
  },

  /** Prestige: reputation = floor((totalEarned / divisor) ^ exponent). */
  prestige: {
    divisor: 25_000,
    exponent: 0.55,
    /** Minimum reputation gain required before the button unlocks. */
    minReputation: 1,
    /** Unlocks the prestige screen. */
    requiredLevel: 8,
  },

  /** Manual selling gives full price; automation trades convenience for margin. */
  autoSellPriceFactor: 0.92,

  /**
   * Price for material that no longer fits in storage. Deliberately worse than
   * a proper sorting line: nothing is ever destroyed (GDD: no punishment), but
   * running the yard on overflow costs real money, so Lager and Sortierung
   * stay worth upgrading.
   */
  overflowPriceFactor: 0.75,

  /** XP awarded per euro of material sold. */
  xpPerEuroSold: 0.05,
} as const;
