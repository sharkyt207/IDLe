import { Content } from '../data';
import { COMPANY, staffLevel } from '../data/company';
import type { AchievementDef } from '../data/types';
import type { Game } from '../game/game';
import { owned } from '../game/state';
import { automationRate } from './prestige';
import { techLevelsTotal } from './unlocks';

/**
 * Achievement Manager (GDD chapter 7).
 *
 * Every achievement is a metric plus a threshold, so a new one is a data entry.
 * They are checked on a slow timer rather than on every event: nothing here is
 * urgent, and a scan of a dozen counters twice a second would be waste.
 */

/** Current value of the metric an achievement watches. */
export function metricValue(game: Game, def: AchievementDef): number {
  const state = game.state;
  switch (def.goal.metric) {
    case 'vehiclesDone':
      return state.progressStats.vehiclesDone;
    case 'lifetimeEarned':
      return state.lifetimeEarned;
    case 'collectibles':
      return Object.values(state.collection).reduce((a, b) => a + b, 0);
    case 'techLevels':
      return techLevelsTotal(state);
    case 'prestigeRuns':
      return state.prestige.runs;
    case 'machineLevels':
      return Content.purchasables
        .filter((d) => d.category === 'machine')
        .reduce((sum, d) => sum + owned(state, d.id), 0);
    case 'staffLevel':
      return Math.max(0, ...Object.values(state.staffXp).map(staffLevel));
    case 'materialRecycled':
      return def.goal.material ? (state.progressStats.materials[def.goal.material] ?? 0) : 0;
    case 'automationRate':
      return automationRate(game);
    case 'companyValue':
      return game.companyValue();
  }
}

export interface AchievementRow {
  def: AchievementDef;
  earned: boolean;
  value: number;
  target: number;
  /** 0…1, for the progress bar. */
  progress: number;
}

export function rows(game: Game): AchievementRow[] {
  return Content.achievements.map((def) => {
    const value = metricValue(game, def);
    const target = def.goal.amount;
    return {
      def,
      earned: game.state.achievements.includes(def.id),
      value,
      target,
      progress: target > 0 ? Math.min(1, value / target) : 0,
    };
  });
}

export function earnedCount(game: Game): number {
  return game.state.achievements.length;
}

/** Titles the player has unlocked; the newest is shown next to the company. */
export function titles(game: Game): string[] {
  return game.state.achievements
    .map((id) => Content.achievement(id)?.title)
    .filter((title): title is string => !!title);
}

let timer = 0;

/**
 * Awards anything newly completed.
 * @param dt seconds; the check itself runs at most once per second
 */
export function tickAchievements(game: Game, dt: number): void {
  timer += dt;
  if (timer < 1) return;
  timer = 0;
  check(game);
}

/** Immediate scan - used after milestones like a prestige reset. */
export function check(game: Game): void {
  let awarded = false;
  for (const def of Content.achievements) {
    if (game.state.achievements.includes(def.id)) continue;
    if (metricValue(game, def) < def.goal.amount) continue;

    game.state.achievements.push(def.id);
    // The point is paid immediately, not at the next restart: an achievement
    // the player cannot feel is just a line in a list.
    game.state.prestige.points += 1;
    game.state.prestige.lifetimePoints += 1;
    awarded = true;
    game.bus.emit('notice', {
      text: `Erfolg: ${def.name}${def.title ? ` — „${def.title}"` : ''}`,
      icon: def.icon,
      tone: 'good',
    });
  }
  if (awarded) {
    game.recompute();
    game.bus.emit('progress', undefined);
  }
  void COMPANY;
}
