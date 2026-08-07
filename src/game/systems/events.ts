import { Content } from '../../data';
import { COMPANY } from '../../data/company';
import { money } from '../../core/format';
import { log } from '../../core/log';
import { t } from '../../core/i18n';
import type { Game } from '../game';

/**
 * Event Manager (GDD chapter 9).
 *
 * Owns the things that happen *to* the company rather than because the player
 * did something: the end of a business day, and the occasional random event.
 *
 * It never touches another system directly - it emits, and whoever cares
 * listens. That is the whole point of the bus: a new listener (a quest log, a
 * telemetry sink) plugs in without this file knowing.
 */

export interface RandomEventDef {
  id: string;
  name: string;
  icon: string;
  /** Relative draw weight. */
  weight: number;
  /** Only fires once the company is at least this level. */
  minLevel?: number;
  /** What it does. Kept small: an event is flavour plus a nudge, not a wall. */
  apply: (game: Game) => string;
}

/**
 * Random events are deliberately mild and mostly positive.
 *
 * Chapter 1 rules out punishment mechanics, so nothing here destroys progress;
 * the worst case costs a little money or slows a shift. The point is that the
 * yard feels alive when the player is watching it.
 */
export const RANDOM_EVENTS: RandomEventDef[] = [
  {
    id: 'scrap_delivery',
    name: 'Unerwartete Anlieferung',
    icon: '🚚',
    weight: 10,
    apply: (game) => {
      const id = game.state.autoBuyVehicle;
      game.buyVehicle(id, true, true);
      return `${Content.vehicle(id)?.name ?? 'Schrott'} kostenlos geliefert`;
    },
  },
  {
    id: 'bulk_buyer',
    name: 'Großabnehmer',
    icon: '🤝',
    weight: 8,
    minLevel: 5,
    apply: (game) => {
      const bonus = Math.max(50, game.state.lifetimeEarned * 0.002);
      game.addMoney(bonus);
      return `Sonderabnahme: ${money(bonus)}`;
    },
  },
  {
    id: 'found_cash',
    name: 'Fund im Handschuhfach',
    icon: '💵',
    weight: 7,
    apply: (game) => {
      const bonus = Math.max(25, game.state.lifetimeEarned * 0.0008);
      game.addMoney(bonus);
      return `Bargeld gefunden: ${money(bonus)}`;
    },
  },
  {
    id: 'inspection',
    name: 'Betriebsprüfung',
    icon: '📋',
    weight: 4,
    minLevel: 8,
    apply: (game) => {
      const fee = Math.min(game.state.money * 0.02, Math.max(20, game.state.lifetimeEarned * 0.0004));
      game.spendMoney(fee);
      return `Prüfgebühr: ${money(fee)}`;
    },
  },
  {
    id: 'power_spike',
    name: 'Netzschwankung',
    icon: '⚡',
    weight: 4,
    minLevel: 10,
    apply: (game) => {
      // Costs condition, not progress - the maintenance system absorbs it.
      for (const id of Object.keys(game.state.condition)) {
        game.state.condition[id] = Math.max(0.3, (game.state.condition[id] ?? 1) - 0.04);
      }
      game.markStatsDirty();
      return 'Spannungsspitze — die Anlagen haben etwas gelitten';
    },
  },
  {
    id: 'apprentice',
    name: 'Praktikant',
    icon: '🎓',
    weight: 5,
    minLevel: 6,
    apply: (game) => {
      for (const def of Content.purchasables) {
        if (def.category !== 'employee') continue;
        if ((game.state.owned[def.id] ?? 0) <= 0) continue;
        game.state.staffXp[def.id] = (game.state.staffXp[def.id] ?? 0) + 60;
      }
      game.markStatsDirty();
      return 'Das Team hat dazugelernt';
    },
  },
];

/** Seconds between random-event rolls. */
const ROLL_SECONDS = 180;
/** Chance a roll actually fires something. */
const ROLL_CHANCE = 0.5;

let rollTimer = ROLL_SECONDS;
let lastDay = -1;

/**
 * Advances the event manager.
 *
 * Called from the game tick, so it also runs during offline catch-up - which
 * is why the day boundary is detected from the metrics rather than counted
 * here: a twelve-hour absence must not fire forty-eight day-end notices.
 */
export function tickEvents(game: Game, dt: number, efficiency = 1): void {
  const metrics = game.state.metrics;

  // --- day boundary --------------------------------------------------------
  const day = Math.floor(game.state.playtime / COMPANY.metrics.daySeconds);
  if (lastDay < 0) lastDay = day;
  if (day !== lastDay) {
    lastDay = day;
    const closed = metrics.dayHistory[metrics.dayHistory.length - 1];
    if (closed && efficiency >= 1) {
      const profit = closed.earned - closed.spent;
      game.bus.emit('dayEnded', { profit });
      game.bus.emit('notice', {
        text: t('event.dayEnded', { profit: money(profit) }),
        icon: '📅',
        tone: profit >= 0 ? 'good' : 'warn',
      });
    }
  }

  // --- random events -------------------------------------------------------
  // Offline time is folded in at reduced efficiency; firing events there would
  // dump a stack of toasts on a returning player.
  if (efficiency < 1) return;
  rollTimer -= dt;
  if (rollTimer > 0) return;
  rollTimer = ROLL_SECONDS;
  if (Math.random() > ROLL_CHANCE) return;

  const pool = RANDOM_EVENTS.filter((e) => (e.minLevel ?? 1) <= game.state.level);
  if (pool.length === 0) return;
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  const picked = pool.find((e) => (roll -= e.weight) <= 0) ?? pool[0];

  try {
    const text = picked.apply(game);
    game.bus.emit('randomEvent', { id: picked.id });
    game.bus.emit('notice', { text: `${picked.name}: ${text}`, icon: picked.icon, tone: 'info' });
  } catch (error) {
    log.error('events', `Zufallsereignis ${picked.id} fehlgeschlagen`, error);
  }
}

/** Resets the internal timers. Used by prestige and by the tests. */
export function resetEvents(): void {
  rollTimer = ROLL_SECONDS;
  lastDay = -1;
}
