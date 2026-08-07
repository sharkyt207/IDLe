import { Content } from '../data';
import type { MilestoneDef } from '../data/types';
import type { Game } from '../game/game';
import { describeAll, grantAll } from './rewards';

/**
 * Milestone Manager (GDD chapter 10).
 *
 * Company-value milestones are the one progression track the player never has
 * to accept, track or even look at. They fire when the number is crossed, and
 * because the company value only ever moves up over a run, "crossed" needs no
 * bookkeeping beyond the list of ones already celebrated.
 *
 * A restart keeps them: re-earning "die erste Lagerhalle" every prestige would
 * turn a reward into a chore.
 */

export interface MilestoneRow {
  def: MilestoneDef;
  reached: boolean;
  value: number;
  progress: number;
  rewardText: string;
}

export function rows(game: Game): MilestoneRow[] {
  const value = game.companyValue();
  return Content.milestones.map((def) => ({
    def,
    reached: game.state.missions.milestones.includes(def.id),
    value,
    progress: Math.max(0, Math.min(1, value / def.value)),
    rewardText: describeAll(def.rewards, game),
  }));
}

/** The next milestone the company is working towards, if any. */
export function next(game: Game): MilestoneRow | null {
  return rows(game).find((row) => !row.reached) ?? null;
}

let timer = 0;

export function tickMilestones(game: Game, dt: number): void {
  timer += dt;
  // The company value is a full asset sweep, so this is the one check that
  // genuinely wants a slow timer rather than a per-tick scan.
  if (timer < 2) return;
  timer = 0;
  checkMilestones(game);
}

/**
 * Awards **at most one** milestone per call.
 *
 * Company value is volatile - a single large sale can move it by an order of
 * magnitude between two checks - and firing three milestones in one frame is
 * both three celebration dialogs at once and, when the rewards are assets, a
 * cascade: each payout raises the number the next threshold is measured
 * against. One at a time turns that into three distinct moments.
 */
export function checkMilestones(game: Game): void {
  const reached = game.state.missions.milestones;
  const value = game.companyValue();
  const def = Content.milestones.find((m) => !reached.includes(m.id) && value >= m.value);
  if (!def) return;
  reached.push(def.id);
  const lines = grantAll(game, def.rewards);
  game.bus.emit('milestone', { id: def.id, rewards: lines });
}

/** True once the company has been big enough to see the prestige screen. */
export function prestigeVisible(game: Game): boolean {
  return game.stats.unlocks.has('prestige_visible') || game.state.prestige.runs > 0;
}
