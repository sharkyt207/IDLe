import { BALANCE } from '../../data/balance';
import type { Game } from '../game';

export interface OfflineReport {
  /** Seconds actually simulated (capped by the offline limit). */
  seconds: number;
  /** Seconds the player was away in total. */
  awaySeconds: number;
  capped: boolean;
  moneyGained: number;
  /** Grid factor while away - shown in the return report. */
  powerFactor: number;
  /** Automated output factor that was actually applied. */
  efficiency: number;
  vehiclesDone: number;
  materialsGained: number;
}

/**
 * Folds the time the player was away into the simulation.
 *
 * The run is chunked (never more than `maxChunks` steps) so a week offline
 * loads as fast as five minutes, and automated output runs at reduced
 * efficiency so that being online always stays the better option.
 */
export function simulateOffline(game: Game, awaySeconds: number): OfflineReport | null {
  if (awaySeconds < BALANCE.offline.minSeconds) return null;

  // GDD chapter 5: at most twelve hours of offline production.
  const limit = Math.min(BALANCE.offline.maxHours, game.stats.offlineHours) * 3600;
  const seconds = Math.min(awaySeconds, limit);
  if (seconds <= 0) return null;

  const moneyBefore = game.state.lifetimeEarned;
  const vehiclesBefore = game.state.progressStats.vehiclesDone;
  const partsBefore = game.state.progressStats.partsRemoved;

  // Offline runs at reduced efficiency so being online stays the better
  // option - but the Autonome Fabrik (GDD chapter 7) buys that gap back.
  const efficiency = Math.min(1, BALANCE.offline.efficiency * game.stats.mult.offlineRate);

  const chunks = Math.min(BALANCE.offline.maxChunks, Math.max(1, Math.ceil(seconds / 5)));
  const dt = seconds / chunks;
  for (let i = 0; i < chunks; i++) {
    game.tick(dt, efficiency);
  }

  return {
    seconds,
    awaySeconds,
    capped: awaySeconds > limit,
    moneyGained: game.state.lifetimeEarned - moneyBefore,
    powerFactor: game.stats.power.factor,
    efficiency,
    vehiclesDone: game.state.progressStats.vehiclesDone - vehiclesBefore,
    materialsGained: game.state.progressStats.partsRemoved - partsBefore,
  };
}
