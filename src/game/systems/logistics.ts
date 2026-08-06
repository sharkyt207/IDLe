import { BALANCE } from '../../data/balance';
import { Content } from '../../data';
import type { Game } from '../game';

/**
 * Delivery logistics: pulls waiting vehicles onto the pad and orders new ones
 * with the player's automation (pickups, tow trucks, buyers).
 */
export function runLogistics(game: Game, dt: number, efficiency: number): void {
  const state = game.state;

  if (!state.active) game.loadNextFromQueue();
  if (!state.active) rescueFromDeadEnd(game);
  if (!state.autoBuyEnabled) return;

  const perMinute = game.stats.autoBuyPerMinute * efficiency;
  if (perMinute <= 0) return;

  game.autoBuyCredit += (perMinute / 60) * dt;
  // Never bank more than a few orders - away time should not dump a huge
  // backlog of purchases the moment the player returns.
  game.autoBuyCredit = Math.min(game.autoBuyCredit, 5);

  for (let guard = 0; guard < 20 && game.autoBuyCredit >= 1; guard++) {
    if (state.active && state.queue.length >= game.stats.queueSlots) break;
    if (!game.buyVehicle(state.autoBuyVehicle, true)) break;
    game.autoBuyCredit -= 1;
  }
}

/**
 * Safety net: empty pad, empty queue, empty storage and not enough money for
 * the cheapest delivery would be a dead end. The GDD rules that out, so the
 * scrap dealer drops off a free starter wreck.
 */
function rescueFromDeadEnd(game: Game): void {
  const state = game.state;
  if (state.queue.length > 0) return;
  if (Object.keys(state.storage).length > 0) return; // still has material to sell

  const cheapest = Content.vehicles
    .filter((v) => game.isUnlocked(v.id))
    .reduce<number>((min, v) => Math.min(min, game.buyPrice(v.id)), Infinity);
  if (state.money >= cheapest) return;

  game.loadVehicle(BALANCE.start.starterVehicle);
  game.bus.emit('notice', {
    text: 'Ein Bekannter bringt dir einen alten Wagen vorbei.',
    icon: '🚗',
    tone: 'good',
  });
}
