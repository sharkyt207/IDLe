import { Content } from '../data';
import { COMPANY, staffLevel } from '../data/company';
import type { Game } from '../game/game';
import { owned } from '../game/state';

/**
 * Employee Manager: wages, upkeep and experience.
 *
 * Running costs are what turn a pile of upgrades into a company - hiring is
 * suddenly a decision with a downside. Unpaid wages never make staff quit,
 * they just work at reduced pace, in keeping with the GDD's no-punishment rule.
 */

export interface StaffRow {
  id: string;
  name: string;
  icon: string;
  count: number;
  level: number;
  xp: number;
  /** Wage per second for the whole group. */
  wage: number;
}

/** Everyone on the payroll, with experience and cost. */
export function staffRows(game: Game): StaffRow[] {
  const rows: StaffRow[] = [];
  for (const def of Content.purchasables) {
    if (def.category !== 'employee') continue;
    const count = owned(game.state, def.id);
    if (count <= 0) continue;
    const xp = game.state.staffXp[def.id] ?? 0;
    const level = staffLevel(xp);
    rows.push({
      id: def.id,
      name: def.name,
      icon: def.icon,
      count,
      level,
      xp,
      wage:
        (def.salary ?? 0) * count * (1 + (level - 1) * COMPANY.staff.salaryPerLevel) * game.stats.mult.salary,
    });
  }
  return rows;
}

/** Total wages per second. */
export function wageBill(game: Game): number {
  return staffRows(game).reduce((sum, row) => sum + row.wage, 0);
}

/** Total building and plant upkeep per second. */
export function upkeepBill(game: Game): number {
  let total = 0;
  for (const def of Content.purchasables) {
    if (!def.upkeep) continue;
    total += def.upkeep * owned(game.state, def.id);
  }
  return total;
}

/** Everything the company pays out per second. */
export function runningCosts(game: Game): number {
  return wageBill(game) + upkeepBill(game);
}

let lastWarn = 0;

/**
 * Charges wages and upkeep, and lets staff gain experience.
 * @param working whether the yard has anything to do
 */
export function tickPayroll(game: Game, dt: number, working: boolean): void {
  const state = game.state;

  const due = runningCosts(game) * dt;
  if (due > 0) {
    const paid = Math.min(state.money, due);
    state.money -= paid;
    state.metrics.daySpent += paid;
    const missed = due - paid;
    if (missed > 0) {
      state.metrics.arrears += missed;
      const now = game.state.playtime;
      if (now - lastWarn > COMPANY.payroll.warnEverySeconds) {
        lastWarn = now;
        game.bus.emit('notice', {
          text: 'Löhne können nicht voll gezahlt werden — das Team arbeitet langsamer.',
          icon: '💸',
          tone: 'warn',
        });
      }
    } else if (state.metrics.arrears > 0) {
      state.metrics.arrears = Math.max(0, state.metrics.arrears - paid * 0.1);
    }
  }

  if (!working) return;

  // Experience: everyone on shift learns a little.
  let levelled = false;
  for (const def of Content.purchasables) {
    if (def.category !== 'employee') continue;
    const count = owned(state, def.id);
    if (count <= 0) continue;
    const before = staffLevel(state.staffXp[def.id] ?? 0);
    state.staffXp[def.id] = (state.staffXp[def.id] ?? 0) + COMPANY.staff.xpPerSecond * dt;
    if (staffLevel(state.staffXp[def.id]) > before) {
      levelled = true;
      game.bus.emit('notice', {
        text: `${def.name}: Erfahrungsstufe ${staffLevel(state.staffXp[def.id])}`,
        icon: def.icon,
        tone: 'good',
      });
    }
  }
  if (levelled) game.markStatsDirty();
}

/** Payroll trouble halves nothing outright - it just slows the crew down. */
export function payrollFactor(game: Game): number {
  return game.state.metrics.arrears > 0 ? COMPANY.payroll.unpaidFactor : 1;
}
