import { Content } from '../data';
import type { MissionDef } from '../data/types';
import type { Game } from '../game/game';
import { meetsRequirement } from '../game/stats';

/**
 * Daily & weekly mission generator (GDD chapter 10).
 *
 * Two rules make this work:
 *
 * 1. The set is **derived from the calendar**, not from a countdown that runs
 *    while the game is open. A player who plays once a week gets a fresh set,
 *    not six stale ones - and nobody can farm a daily by leaving the app open.
 * 2. The roll is **seeded by the day**, so every device shows the same set on
 *    the same date and a reload cannot re-roll into something easier.
 */

/** Days since the epoch, in local time. */
export function dayIndex(now = Date.now()): number {
  const d = new Date(now);
  return Math.floor((now - d.getTimezoneOffset() * 60_000) / 86_400_000);
}

/** Weeks since the epoch, weeks starting on Monday. */
export function weekIndex(now = Date.now()): number {
  // The epoch (1970-01-01) was a Thursday; shifting by 4 days puts week
  // boundaries on Monday.
  return Math.floor((dayIndex(now) + 3) / 7);
}

/** Seconds left in the current local day. */
export function secondsLeftToday(now = Date.now()): number {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return Math.max(1, (end.getTime() - now) / 1000);
}

/** Seconds left in the current week. */
export function secondsLeftThisWeek(now = Date.now()): number {
  const daysLeft = (weekIndex(now) + 1) * 7 - (dayIndex(now) + 3) - 1;
  return secondsLeftToday(now) + Math.max(0, daysLeft) * 86_400;
}

/** Small deterministic hash - the same seed always yields the same order. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Weighted pick without replacement. */
function pick(pool: MissionDef[], count: number, rand: () => number): MissionDef[] {
  const left = [...pool];
  const chosen: MissionDef[] = [];
  while (chosen.length < count && left.length > 0) {
    const total = left.reduce((sum, def) => sum + (def.weight ?? 1), 0);
    let roll = rand() * total;
    let index = 0;
    for (; index < left.length - 1; index++) {
      roll -= left[index].weight ?? 1;
      if (roll <= 0) break;
    }
    chosen.push(left.splice(index, 1)[0]);
  }
  return chosen;
}

function eligible(game: Game, kind: 'daily' | 'weekly'): MissionDef[] {
  return Content.missions.filter(
    (def) => def.kind === kind && meetsRequirement(game.state, game.stats, def.requires),
  );
}

/** How many dailies are offered at once. Two, so neither one blocks the other. */
const DAILY_COUNT = 2;

type Accept = (game: Game, def: MissionDef, expires: number) => void;

export function rollDaily(game: Game, accept: Accept, now = Date.now()): void {
  const missions = game.state.missions;
  const today = dayIndex(now);
  if (missions.dailyDay === today) return;
  missions.dailyDay = today;

  // Yesterday's dailies go away unfinished - no penalty, just a clean slate.
  missions.active = missions.active.filter((entry) => Content.mission(entry.id)?.kind !== 'daily');

  const pool = eligible(game, 'daily');
  if (pool.length === 0) return;
  const expires = secondsLeftToday(now);
  for (const def of pick(pool, DAILY_COUNT, mulberry(today * 7919))) accept(game, def, expires);
}

export function rollWeekly(game: Game, accept: Accept, now = Date.now()): void {
  const missions = game.state.missions;
  const week = weekIndex(now);
  if (missions.weeklyWeek === week) return;
  missions.weeklyWeek = week;

  missions.active = missions.active.filter((entry) => Content.mission(entry.id)?.kind !== 'weekly');

  const pool = eligible(game, 'weekly');
  if (pool.length === 0) return;
  const expires = secondsLeftThisWeek(now);
  for (const def of pick(pool, 1, mulberry(week * 104_729))) accept(game, def, expires);
}
