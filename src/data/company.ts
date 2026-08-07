import type { Effect } from './types';

/**
 * Company configuration (GDD chapter 6).
 *
 * Everything about payroll, staff experience, priorities and the statistics
 * dashboard is tuned from here.
 */
export const COMPANY = {
  /** Staff gain experience while the yard is working. */
  staff: {
    maxLevel: 10,
    /**
     * XP per second per role while there is work to do. Tuned so the first
     * promotion lands within a few minutes - an experience system nobody ever
     * sees move is not a feature - and mastery takes a good few hours.
     */
    xpPerSecond: 0.25,
    /** XP needed for level n: base * growth^(n-1). */
    xpBase: 60,
    xpGrowth: 1.55,
    /** Output bonus per experience level. */
    productivityPerLevel: 0.09,
    /** Experienced staff also cost more. */
    salaryPerLevel: 0.08,
  },

  /** Wages and upkeep are charged continuously. */
  payroll: {
    /**
     * When the account cannot cover wages, staff work at this factor instead
     * of quitting. The GDD never punishes with a hard stop.
     */
    unpaidFactor: 0.6,
    /** Seconds of arrears before the warning fires again. */
    warnEverySeconds: 30,
  },

  /** A game day is 15 minutes (chapter 3); a week is seven of those. */
  metrics: {
    daySeconds: 15 * 60,
    weekDays: 7,
    /** kg CO₂ saved per unit of material recycled instead of mined. */
    co2PerUnit: 1.6,
  },
} as const;

export interface PriorityDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  effects: Effect[];
}

/**
 * Company priorities. The player does not assign individual jobs - they set a
 * focus and the operation follows it (GDD: "Das System arbeitet anschließend
 * automatisch").
 */
export const PRIORITIES: PriorityDef[] = [
  {
    id: 'balanced',
    name: 'Ausgeglichen',
    icon: '⚖️',
    desc: 'Keine besondere Gewichtung. Alles läuft nach Plan.',
    effects: [],
  },
  {
    id: 'production',
    name: 'Produktion maximieren',
    icon: '🏭',
    desc: '+20 % Zerlegeleistung und Verarbeitung, dafür verschleißen die Anlagen schneller.',
    effects: [
      { kind: 'multiplier', target: 'teardownRate', factor: 1.2 },
      { kind: 'multiplier', target: 'processSpeed', factor: 1.2 },
      { kind: 'multiplier', target: 'wear', factor: 1.6 },
    ],
  },
  {
    id: 'maintenance',
    name: 'Wartung bevorzugen',
    icon: '🔧',
    desc: 'Deutlich mehr automatische Wartung und halber Verschleiß.',
    effects: [
      { kind: 'multiplier', target: 'autoService', factor: 3 },
      { kind: 'multiplier', target: 'wear', factor: 0.5 },
    ],
  },
  {
    id: 'research',
    name: 'Forschung beschleunigen',
    icon: '🔬',
    desc: '+60 % Forschungstempo und mehr Erfahrung, dafür weniger Durchsatz.',
    effects: [
      { kind: 'multiplier', target: 'researchSpeed', factor: 1.6 },
      { kind: 'multiplier', target: 'xpGain', factor: 1.25 },
      { kind: 'multiplier', target: 'teardownRate', factor: 0.9 },
    ],
  },
  {
    id: 'storage',
    name: 'Lager auffüllen',
    icon: '📦',
    desc: '+35 % Lagerplatz, die Sortierung verkauft zurückhaltender.',
    effects: [
      { kind: 'multiplier', target: 'storage', factor: 1.35 },
      { kind: 'multiplier', target: 'autoSell', factor: 0.65 },
    ],
  },
  {
    id: 'contracts',
    name: 'Verträge priorisieren',
    icon: '🤝',
    desc: '+35 % Vertragsprämien und ein zusätzlicher Auftragsplatz.',
    effects: [
      { kind: 'multiplier', target: 'contractReward', factor: 1.35 },
      { kind: 'contractSlots', amount: 1 },
    ],
  },
];

/** XP needed to reach the next staff level. */
export function staffXpForLevel(level: number): number {
  return Math.floor(COMPANY.staff.xpBase * Math.pow(COMPANY.staff.xpGrowth, level - 1));
}

/** Experience level from accumulated XP. */
export function staffLevel(xp: number): number {
  let level = 1;
  let left = xp;
  while (level < COMPANY.staff.maxLevel && left >= staffXpForLevel(level)) {
    left -= staffXpForLevel(level);
    level++;
  }
  return level;
}

/** Output multiplier of a role at a given experience level. */
export function staffProductivity(level: number): number {
  return 1 + (level - 1) * COMPANY.staff.productivityPerLevel;
}
