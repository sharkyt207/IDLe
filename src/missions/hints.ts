import { Content } from '../data';
import { HINTS, MENTOR, type HintDef } from '../data/help';
import type { Game } from '../game/game';
import { needsService } from '../game/systems/maintenance';
import { canPrestige } from '../progress/prestige';
import { slotsFree } from '../progress/research';

/**
 * Hint Manager & mentor (GDD chapter 10).
 *
 * Three rules, all of them about restraint:
 *
 * 1. **Once each.** A hint the player has read is not a hint any more, it is
 *    noise. Every id is remembered in the save.
 * 2. **One at a time, with a gap.** Even a yard doing five things wrong gets
 *    one sentence per minute, not five at once.
 * 3. **Switchable off, and it stays off.** `settings.hints` gates the whole
 *    module, `settings.mentor` gates the voice separately - some players want
 *    the warnings without the personality.
 */

/** Seconds between two hints, however much is going on. */
const COOLDOWN = 75;
/** Grace period after a fresh start - the tutorial is already talking. */
const WARMUP = 45;

type Condition = (game: Game) => boolean;

/**
 * When each hint applies. Kept next to the manager rather than in the data
 * file because these are code questions ("is the grid short?"), not content.
 */
const CONDITIONS: Record<string, Condition> = {
  hint_queue: (g) => !g.state.active && g.state.queue.length === 0 && g.state.money > 200,
  hint_storage: (g) => g.storageUsed() >= g.stats.storage * 0.92,
  hint_money: (g) => g.state.money > 4_000 && Object.values(g.state.owned).reduce((a, b) => a + b, 0) < 6,
  hint_wear: (g) => needsService(g) && g.stats.condition < 0.6,
  hint_power: (g) => g.stats.power.factor < 0.9,
  hint_staff: (g) => g.state.level >= 4 && countCategory(g, 'employee') === 0,
  hint_contract: (g) => g.state.trade.offers.length > 0 && g.state.trade.active.length === 0 && g.state.level >= 3,
  hint_research: (g) => (g.state.owned['lab'] ?? 0) > 0 && slotsFree(g) > 0 && g.state.research.points > 40,
  hint_arrears: (g) => g.state.metrics.arrears > 0,
  hint_prestige: (g) => canPrestige(g),
};

function countCategory(game: Game, category: string): number {
  return Content.purchasables
    .filter((d) => d.category === category)
    .reduce((sum, d) => sum + (game.state.owned[d.id] ?? 0), 0);
}

let cooldown = WARMUP;

/** Resets the pacing - called on a fresh start and after a prestige restart. */
export function resetHints(): void {
  cooldown = WARMUP;
}

export function tickHints(game: Game, dt: number): void {
  if (!game.state.settings.hints) return;
  cooldown -= dt;
  if (cooldown > 0) return;

  const seen = game.state.missions.hints;
  const hint = HINTS.find((def) => !seen.includes(def.id) && CONDITIONS[def.id]?.(game));
  if (!hint) {
    // Nothing to say: check again shortly rather than every tick.
    cooldown = 5;
    return;
  }

  seen.push(hint.id);
  cooldown = COOLDOWN;
  game.bus.emit('hint', { id: hint.id, text: hint.text, icon: hint.icon, screen: hint.screen });
}

/** All hints, for the settings screen's "show hints again" button. */
export function forgetHints(game: Game): void {
  game.state.missions.hints = [];
  resetHints();
}

export function hintDefs(): readonly HintDef[] {
  return HINTS;
}

// ---------------------------------------------------------------------------
// Mentor
// ---------------------------------------------------------------------------

/** Last line used per occasion, so the same sentence never repeats twice. */
const lastLine: Record<string, string> = {};

/**
 * One line from the mentor, or null when the player has switched them off.
 * The mentor never blocks anything - the line is decoration on an event that
 * happened anyway.
 */
export function mentorLine(game: Game, occasion: string): string | null {
  if (!game.state.settings.mentor) return null;
  const pool = MENTOR[occasion];
  if (!pool || pool.length === 0) return null;
  const options = pool.length > 1 ? pool.filter((line) => line !== lastLine[occasion]) : pool;
  const line = options[Math.floor(Math.random() * options.length)];
  lastLine[occasion] = line;
  return line;
}
