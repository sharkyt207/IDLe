/**
 * Machine configuration (GDD chapter 5).
 *
 * Three separate progression axes, on purpose:
 *
 *   1. **Tier**  — a shredder replaces a crane (×1000 over the whole ladder).
 *   2. **Level** — 10 upgrade steps per machine, up to +150 % (the GDD table).
 *   3. **Linie** — parallel production lines multiply everything (the idle axis).
 *
 * Levels alone would flatten late-game growth; lines alone would make each
 * individual machine meaningless. Together they give both the "one more level"
 * pull and the exponential curve an idle game needs.
 */
export const MACHINES = {
  maxLevel: 10,

  /**
   * Output multiplier per level, index 0 = level 1.
   * Matches the GDD table: +15 % per step up to level 5, +150 % at level 10.
   */
  levelMultiplier: [1, 1.15, 1.3, 1.45, 1.6, 1.78, 1.96, 2.14, 2.32, 2.5] as const,

  /** From this level on, a machine also lifts material quality. */
  qualityFromLevel: 5,
  qualityPerMachine: 0.02,

  /** Level 10 perks (GDD: "+150 % + Energiebonus + seltene Fundchance"). */
  master: {
    level: 10,
    /** Power draw multiplier - a maxed machine runs more efficiently. */
    powerFactor: 0.8,
    /** Multiplicative bonus to the rare-find chance, per mastered machine. */
    rareFind: 1.08,
  },

  /** Energy. Power is an efficiency dial, never a hard stop. */
  power: {
    /** The yard's existing grid connection, free from the start. */
    baseSupply: 30,
    /** Output factor when the grid is completely overloaded. */
    minFactor: 0.4,
    /** Below this ratio the UI warns about the shortfall. */
    warnRatio: 0.95,
  },

  /** Wear and maintenance. Deliberately slow - nobody wants a repair job. */
  wear: {
    /** Condition lost per second while the machine is working. */
    perSecond: 1 / (30 * 60),
    /** Output factor at zero condition. */
    minFactor: 0.6,
    /** A full service costs this fraction of what the machine cost to build. */
    serviceCostFactor: 0.1,
    /** Condition below this triggers the maintenance hint. */
    warnBelow: 0.55,
  },
} as const;

/** Output multiplier of a machine at a given level (1-based). */
export function levelMultiplier(level: number): number {
  if (level <= 0) return 0;
  const table = MACHINES.levelMultiplier;
  return table[Math.min(table.length, Math.max(1, Math.round(level))) - 1];
}

/** How much a worn machine still delivers, 0…1 condition → factor. */
export function conditionFactor(condition: number): number {
  const c = Math.max(0, Math.min(1, condition));
  return MACHINES.wear.minFactor + (1 - MACHINES.wear.minFactor) * c;
}

/** Grid factor from supply and demand. */
export function powerFactor(supply: number, demand: number): number {
  if (demand <= 0) return 1;
  return Math.max(MACHINES.power.minFactor, Math.min(1, supply / demand));
}
