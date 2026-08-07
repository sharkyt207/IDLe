import { Content } from '../data';
import { COMPANY } from '../data/company';
import type { Game } from '../game/game';
import { owned } from '../game/state';
import { storedValue } from '../economy/market';
import { runningCosts } from './payroll';

/**
 * Company Statistics (GDD chapter 6).
 *
 * Everything here is derived on demand from the state plus a few rolling
 * accumulators - no per-tick history buffer, so the dashboard costs nothing
 * while the player is not looking at it.
 */

export interface CompanyReport {
  dayProfit: number;
  dayEarned: number;
  daySpent: number;
  weekProfit: number;
  /** Fraction of the current business day elapsed, 0…1. */
  dayProgress: number;
  storageUnits: number;
  storageValue: number;
  powerDemand: number;
  powerSupply: number;
  employees: number;
  machines: number;
  buildings: number;
  companyValue: number;
  /** Power × condition × payroll health, 0…1. */
  efficiency: number;
  runningCosts: number;
  co2Saved: number;
  unitsRecycled: number;
}

/** Advances the rolling day/week accumulators. */
export function tickMetrics(game: Game, dt: number): void {
  const metrics = game.state.metrics;
  metrics.dayTime += dt;
  if (metrics.dayTime < COMPANY.metrics.daySeconds) return;

  metrics.dayTime -= COMPANY.metrics.daySeconds;
  metrics.dayHistory.push({ earned: metrics.dayEarned, spent: metrics.daySpent });
  while (metrics.dayHistory.length > COMPANY.metrics.weekDays) metrics.dayHistory.shift();
  metrics.dayEarned = 0;
  metrics.daySpent = 0;
}

export function report(game: Game): CompanyReport {
  const { state, stats } = game;
  const metrics = state.metrics;

  const weekEarned = metrics.dayHistory.reduce((sum, d) => sum + d.earned, metrics.dayEarned);
  const weekSpent = metrics.dayHistory.reduce((sum, d) => sum + d.spent, metrics.daySpent);

  let employees = 0;
  let machines = 0;
  let buildings = 0;
  for (const def of Content.purchasables) {
    const count = owned(state, def.id);
    if (count <= 0) continue;
    if (def.category === 'employee') employees += count;
    else if (def.category === 'machine') machines++;
    else if (def.category === 'building' || def.category === 'lot') buildings += count;
  }

  const payrollHealth = metrics.arrears > 0 ? COMPANY.payroll.unpaidFactor : 1;

  return {
    dayProfit: metrics.dayEarned - metrics.daySpent,
    dayEarned: metrics.dayEarned,
    daySpent: metrics.daySpent,
    weekProfit: weekEarned - weekSpent,
    dayProgress: metrics.dayTime / COMPANY.metrics.daySeconds,
    storageUnits: game.storageUsed(),
    storageValue: storedValue(state, stats),
    powerDemand: stats.power.demand,
    powerSupply: stats.power.supply,
    employees,
    machines,
    buildings,
    companyValue: game.companyValue(),
    efficiency: stats.power.factor * stats.condition * payrollHealth,
    runningCosts: runningCosts(game),
    co2Saved: metrics.unitsRecycled * COMPANY.metrics.co2PerUnit,
    unitsRecycled: metrics.unitsRecycled,
  };
}
