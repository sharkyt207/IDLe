/**
 * Long-term progression configuration (GDD chapter 7).
 *
 * Research, technologies, prestige and achievements all pull their numbers
 * from here, so the pace of the whole late game is tunable in one file.
 */
export const PROGRESS = {
  research: {
    /**
     * Points the bare lab produces per second, before staff and upgrades.
     * Tuned so the first technology lands inside the first session - a lab
     * that produces nothing for half an hour reads as broken, not as slow.
     */
    basePointsPerSecond: 0.12,
    /** Projects that can run in parallel without lab upgrades. */
    baseSlots: 1,
    /**
     * Highest technology level the lab may reach before it is upgraded.
     * Each lab level raises this, which is what makes the lab feel like a
     * building rather than a checkbox.
     */
    baseTechTier: 2,
    /** Lab levels (GDD: "Das Labor besitzt 10 Ausbaustufen"). */
    labLevels: 10,
    /** Per lab level. */
    labPointsPerLevel: 0.14,
    labSpeedPerLevel: 0.12,
    labTierPerLevel: 1,
    /** A second and third parallel project at these lab levels. */
    labSlotAt: [4, 8],
  },

  prestige: {
    /**
     * Three independent doors (GDD): company value, full automation, or a tree
     * that is nearly explored. Any one of them opens the restart.
     */
    companyValue: 500_000_000,
    automationRate: 1,
    researchShare: 0.9,
    /** Industriepunkte = (runEarned / divisor) ^ exponent. */
    divisor: 250_000,
    exponent: 0.5,
    /** Below this the button stays closed - a restart must feel worth it. */
    minPoints: 20,
    /**
     * Every restart makes the world a little tougher and a little richer.
     * Deliberately mild: 6 % more expensive, 12 % better rewards, so the
     * curve bends upward rather than punishing veterans.
     */
    difficultyPerRun: 0.06,
    rewardPerRun: 0.12,
    /** The difficulty ramp stops here; the reward ramp does not. */
    maxDifficultyRuns: 12,
  },

  achievements: {
    /** Points awarded per achievement, so completionists progress too. */
    prestigePoints: 1,
  },
} as const;

/** Research points a technology level costs, with the prestige ramp applied. */
export function techCostScale(level: number, growth: number): number {
  return Math.pow(growth, Math.max(0, level - 1));
}

/** Difficulty multiplier on costs after `runs` restarts. */
export function difficultyFactor(runs: number): number {
  const capped = Math.min(runs, PROGRESS.prestige.maxDifficultyRuns);
  return 1 + capped * PROGRESS.prestige.difficultyPerRun;
}

/** Reward multiplier after `runs` restarts. Never capped - veterans win. */
export function veteranFactor(runs: number): number {
  return 1 + runs * PROGRESS.prestige.rewardPerRun;
}

/** Lab level from the owned count of the Forschungslabor. */
export function labLevel(owned: number): number {
  return Math.min(PROGRESS.research.labLevels, Math.max(0, owned));
}
