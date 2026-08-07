import { Content } from '../../data';
import { MACHINES } from '../../data/machines';
import type { PurchasableDef } from '../../data/types';
import type { Game } from '../game';
import { owned } from '../state';

/**
 * Wear and maintenance (GDD chapter 5).
 *
 * Machines lose condition while they work and a worn machine delivers less -
 * but never less than 60 %, and automatic maintenance is cheap and early. The
 * GDD is explicit that the player must not end up doing repair chores, so wear
 * is a slow background pressure that nudges towards hiring a technician, not a
 * timer to babysit.
 */

/** What the player has sunk into a machine so far - basis for the service fee. */
export function investedIn(game: Game, def: PurchasableDef): number {
  const count = owned(game.state, def.id);
  if (count <= 0) return 0;
  if (def.costGrowth === 1) return def.baseCost * count;
  return (def.baseCost * (Math.pow(def.costGrowth, count) - 1)) / (def.costGrowth - 1);
}

/** Machines the yard owns, with their current condition. */
export function machineList(game: Game): { def: PurchasableDef; level: number; condition: number }[] {
  return Content.purchasables
    .filter((def) => def.category === 'machine' && owned(game.state, def.id) > 0)
    .map((def) => ({
      def,
      level: owned(game.state, def.id),
      condition: game.state.condition[def.id] ?? 1,
    }));
}

/** Cost of restoring everything to as-new. */
export function serviceCost(game: Game): number {
  let total = 0;
  for (const { def, condition } of machineList(game)) {
    total += investedIn(game, def) * MACHINES.wear.serviceCostFactor * (1 - condition);
  }
  return Math.ceil(total);
}

/** Full service of every machine. Returns false if the player cannot pay. */
export function serviceAll(game: Game): boolean {
  const cost = serviceCost(game);
  if (cost <= 0) {
    game.bus.emit('notice', { text: 'Alle Anlagen sind in Bestzustand.', icon: '🔧', tone: 'info' });
    return false;
  }
  if (!game.spendMoney(cost)) {
    game.bus.emit('notice', { text: 'Nicht genug Geld für die Wartung.', icon: '💸', tone: 'warn' });
    return false;
  }
  for (const { def } of machineList(game)) game.state.condition[def.id] = 1;
  game.recompute();
  game.bus.emit('notice', { text: 'Alle Anlagen gewartet', icon: '🔧', tone: 'good' });
  return true;
}

/** True while at least one machine has dropped below the warning threshold. */
export function needsService(game: Game): boolean {
  return machineList(game).some((m) => m.condition < MACHINES.wear.warnBelow);
}

/**
 * Advances wear and automatic maintenance.
 * @param running whether the yard actually has work to do
 */
export function runMaintenance(game: Game, dt: number, running: boolean, efficiency: number): void {
  const machines = machineList(game);
  if (machines.length === 0) return;

  const wear = running ? MACHINES.wear.perSecond * dt * efficiency : 0;
  // Automatic maintenance is shared across the yard.
  const repair = (game.stats.autoService * dt) / machines.length;
  if (wear <= 0 && repair <= 0) return;

  let changed = false;
  for (const { def, condition } of machines) {
    const next = Math.max(0, Math.min(1, condition - wear + repair));
    if (Math.abs(next - condition) < 1e-6) continue;
    game.state.condition[def.id] = next;
    changed = true;
  }
  // Condition feeds the derived stats, so they have to be rebuilt - but only
  // a few times a second, not on every wear tick.
  if (changed) game.markStatsDirty();
}
