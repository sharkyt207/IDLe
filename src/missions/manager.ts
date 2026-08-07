import { Content } from '../data';
import { money as fmtMoney, fmt } from '../core/format';
import type { MissionDef } from '../data/types';
import type { Game } from '../game/game';
import type { MissionEntry } from '../game/state';
import { meetsRequirement } from '../game/stats';
import { readMetric, snapshot, type Metric } from '../progress/tracker';
import { TUTORIAL_MISSION_IDS } from '../data/missions';
import { describeAll, grantAll } from './rewards';
import { rollDaily, rollWeekly, dayIndex, weekIndex } from './daily';

/**
 * Mission Manager (GDD chapter 10).
 *
 * Owns the whole life cycle: which missions are offered, what their goal is
 * worth right now, when one is finished and what it pays. Every kind of
 * mission - tutorial, main, side, daily, weekly - runs through the same three
 * functions, because the only real difference between them is where they come
 * from and how long they last.
 *
 * Missions cannot be failed. A daily that runs out is *replaced*, never lost,
 * which is the chapter's "keine Bestrafung" rule applied to the one system
 * that would otherwise be tempted to break it.
 */

/** How many missions the task list shows at once (GDD: "maximal drei"). */
export const VISIBLE_TASKS = 3;

export interface MissionRow {
  def: MissionDef;
  entry: MissionEntry;
  value: number;
  target: number;
  /** 0…1 for the progress bar. */
  progress: number;
  done: boolean;
  rewardText: string;
  /** Goal text with the scaled amount filled in. */
  text: string;
}

/** Reads one mission's current progress. */
export function rowOf(game: Game, entry: MissionEntry): MissionRow | null {
  const def = Content.mission(entry.id);
  if (!def) return null;
  const value = readMetric(game, { metric: def.goal.metric as Metric, material: def.goal.material, id: def.goal.id }, entry.since);
  const target = Math.max(1, entry.target);
  return {
    def,
    entry,
    value,
    target,
    progress: Math.max(0, Math.min(1, value / target)),
    done: value >= target,
    rewardText: describeAll(def.rewards, game),
    text: goalText(def, target),
  };
}

/** Every accepted mission, tutorial first, then main, side, daily, weekly. */
export function rows(game: Game): MissionRow[] {
  const order: Record<string, number> = { tutorial: 0, main: 1, side: 2, daily: 3, weekly: 4 };
  return game.state.missions.active
    .map((entry) => rowOf(game, entry))
    .filter((row): row is MissionRow => row !== null)
    .sort((a, b) => order[a.def.kind] - order[b.def.kind] || b.progress - a.progress);
}

/**
 * The three the HUD shows.
 *
 * The tracked mission is always among them - the player asked for it - and the
 * rest are the ones closest to done, because a task list that shows what is
 * nearly finished is a task list people look at.
 */
export function visibleRows(game: Game): MissionRow[] {
  const all = rows(game);
  const tracked = all.find((r) => r.def.id === game.state.missions.tracked);
  const rest = all
    .filter((r) => r !== tracked)
    .sort((a, b) => {
      const order: Record<string, number> = { tutorial: 0, main: 1, side: 3, daily: 2, weekly: 2 };
      return order[a.def.kind] - order[b.def.kind] || b.progress - a.progress;
    });
  return [...(tracked ? [tracked] : []), ...rest].slice(0, VISIBLE_TASKS);
}

/** Fills the placeholder in a daily/weekly description. */
function goalText(def: MissionDef, target: number): string {
  if (!def.desc.includes('{amount}')) return def.desc;
  const money = def.goal.metric === 'runEarned' || def.goal.metric === 'lifetimeEarned';
  return def.desc.replace('{amount}', money ? fmtMoney(target) : fmt(target, 0));
}

/**
 * Goal amount for a mission right now.
 *
 * Money goals scale off the company value, counts scale off the level. That
 * split is not cosmetic: an early version scaled everything linearly with the
 * level, and a "verdiene heute 25.000 €" daily was being cleared inside two
 * minutes by minute thirty - which then paid out a crate, which paid research
 * points, which pulled the whole chapter-7 tree forward by hours.
 */
export function targetFor(game: Game, def: MissionDef): number {
  if (!def.levelScale) return def.goal.amount;
  if (def.scaleBy === 'company') {
    return Math.max(def.goal.amount, Math.round(game.companyValue() * def.levelScale));
  }
  const scale = 1 + Math.max(0, game.state.level - 1) * def.levelScale;
  return Math.max(1, Math.round(def.goal.amount * scale));
}

function accept(game: Game, def: MissionDef, expires = 0): void {
  const missions = game.state.missions;
  if (missions.active.some((m) => m.id === def.id) || missions.done.includes(def.id)) return;
  missions.active.push({
    id: def.id,
    target: targetFor(game, def),
    since: snapshot(game, def.goal.material),
    expires,
  });
}

/** True while the five tutorial missions still have something to teach. */
export function tutorialActive(game: Game): boolean {
  if (game.state.tutorial.done) return false;
  return TUTORIAL_MISSION_IDS.some((id) => !game.state.missions.done.includes(id));
}

/** The tutorial mission the player is on, if any. */
export function currentTutorial(game: Game): MissionRow | null {
  for (const id of TUTORIAL_MISSION_IDS) {
    if (game.state.missions.done.includes(id)) continue;
    const entry = game.state.missions.active.find((m) => m.id === id);
    return entry ? rowOf(game, entry) : null;
  }
  return null;
}

/**
 * Offers whatever should be open right now.
 *
 * Tutorial missions come one at a time and in order - five steps that arrive
 * all at once are a wall of text, not a tutorial. Everything else is offered
 * as soon as its gate opens.
 */
function offer(game: Game): void {
  const { state } = game;
  const missions = state.missions;

  if (tutorialActive(game)) {
    // Exactly one open tutorial step, and nothing else until they are done.
    const next = TUTORIAL_MISSION_IDS.find((id) => !missions.done.includes(id));
    const def = next ? Content.mission(next) : undefined;
    if (def) accept(game, def);
    return;
  }
  // A skipped tutorial (debug, tests, a migrated save) must not leave its
  // steps sitting in the task list forever.
  if (state.tutorial.done) {
    missions.active = missions.active.filter((m) => Content.mission(m.id)?.kind !== 'tutorial');
  }

  for (const def of Content.missions) {
    if (def.kind !== 'main' && def.kind !== 'side') continue;
    if (missions.done.includes(def.id)) continue;
    if (missions.active.some((m) => m.id === def.id)) continue;
    // A main mission waits for its predecessor: the chain is the through-line.
    if (def.after && !missions.done.includes(def.after)) continue;
    if (!meetsRequirement(state, game.stats, def.requires)) continue;
    accept(game, def);
  }

  rollDaily(game, accept);
  rollWeekly(game, accept);
}

/** Awards everything that is finished. Returns the missions completed. */
function collect(game: Game): MissionRow[] {
  const missions = game.state.missions;
  const finished: MissionRow[] = [];

  for (const entry of [...missions.active]) {
    const row = rowOf(game, entry);
    if (!row || !row.done) continue;
    missions.active = missions.active.filter((m) => m !== entry);
    missions.done.push(entry.id);
    if (missions.tracked === entry.id) missions.tracked = '';
    const lines = grantAll(game, row.def.rewards);
    finished.push(row);
    game.bus.emit('missionDone', { id: entry.id, rewards: lines });
  }

  // Dailies and weeklies repeat, so completing one must not lock it out of
  // tomorrow's pool.
  missions.done = missions.done.filter((id) => {
    const kind = Content.mission(id)?.kind;
    return kind !== 'daily' && kind !== 'weekly';
  });

  if (finished.length > 0 && !game.state.tutorial.done && !tutorialActive(game)) {
    game.state.tutorial.done = true;
    game.state.tutorial.step = TUTORIAL_MISSION_IDS.length;
  }
  return finished;
}

/**
 * Drops timed missions whose period is over.
 *
 * Nothing is lost when that happens - the pool simply re-rolls, which is the
 * whole reason a daily is allowed to have a deadline at all.
 */
function expire(game: Game, dt: number): void {
  const missions = game.state.missions;
  for (const entry of [...missions.active]) {
    if (entry.expires <= 0) continue;
    entry.expires -= dt;
    if (entry.expires > 0) continue;
    const kind = Content.mission(entry.id)?.kind;
    missions.active = missions.active.filter((m) => m !== entry);
    if (missions.tracked === entry.id) missions.tracked = '';
    if (kind === 'daily') missions.dailyDay = -1;
    if (kind === 'weekly') missions.weeklyWeek = -1;
  }
}

let timer = 0;

/**
 * Called every simulation step.
 *
 * The scan itself runs twice a second: nothing here is urgent, and reading two
 * dozen metrics at 10 Hz would be waste in exactly the place a mid-range phone
 * notices it.
 */
export function tickMissions(game: Game, dt: number): void {
  timer += dt;
  if (timer < 0.5) return;
  const step = timer;
  timer = 0;

  expire(game, step);
  offer(game);
  collect(game);
}

/** Immediate pass - used after a prestige restart or a debug jump. */
export function refreshMissions(game: Game): void {
  expire(game, 0);
  offer(game);
  collect(game);
}

/** Resets the daily/weekly bookkeeping so the next tick rolls a fresh set. */
export function resetTimedMissions(game: Game): void {
  const missions = game.state.missions;
  missions.active = missions.active.filter((entry) => {
    const kind = Content.mission(entry.id)?.kind;
    return kind !== 'daily' && kind !== 'weekly';
  });
  missions.dailyDay = dayIndex() - 1;
  missions.weeklyWeek = weekIndex() - 1;
}

/** The player taps "Verfolgen" on a mission. */
export function track(game: Game, id: string): void {
  const missions = game.state.missions;
  missions.tracked = missions.tracked === id ? '' : id;
}
