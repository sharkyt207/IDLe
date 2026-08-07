import { Content } from '../data';
import type { Effect } from '../data/types';
import type { GameState } from '../game/state';

/**
 * Permanent Bonus System (GDD chapter 7).
 *
 * One place that answers "what does the player permanently own?" — technology
 * levels, prestige nodes and achievements. `stats.ts` asks this module instead
 * of walking three different structures, which means a fourth source of
 * permanent bonuses (a season pass, an event reward) is added here alone.
 *
 * Every entry is `{ effect, count }`: `count` is how often the effect applies,
 * so a level-4 technology returns its per-level effects with count 4.
 */
export interface BonusEntry {
  effect: Effect;
  count: number;
}

/** Technology levels and the milestones they crossed. */
export function techBonuses(state: GameState): BonusEntry[] {
  const out: BonusEntry[] = [];
  for (const [id, level] of Object.entries(state.research.techs)) {
    const tech = Content.researchNode(id);
    if (!tech || level <= 0) continue;
    const owned = Math.min(level, tech.maxLevel);
    for (const effect of tech.perLevel ?? []) out.push({ effect, count: owned });
    for (const milestone of tech.milestones ?? []) {
      if (owned < milestone.level) continue;
      for (const effect of milestone.effects) out.push({ effect, count: 1 });
    }
  }
  return out;
}

/** Prestige tree nodes, which survive every restart. */
export function prestigeBonuses(state: GameState): BonusEntry[] {
  const out: BonusEntry[] = [];
  for (const [id, level] of Object.entries(state.prestige.perks)) {
    const perk = Content.perk(id);
    if (!perk || level <= 0) continue;
    for (const effect of perk.effects) out.push({ effect, count: Math.min(level, perk.maxLevel) });
  }
  return out;
}

/** Achievement rewards. Deliberately small - a nod, not a second economy. */
export function achievementBonuses(state: GameState): BonusEntry[] {
  const out: BonusEntry[] = [];
  for (const id of state.achievements) {
    const def = Content.achievement(id);
    for (const effect of def?.effects ?? []) out.push({ effect, count: 1 });
  }
  return out;
}

/** Everything permanent, in the order stats.ts should fold it. */
export function permanentBonuses(state: GameState): BonusEntry[] {
  return [...techBonuses(state), ...prestigeBonuses(state), ...achievementBonuses(state)];
}
