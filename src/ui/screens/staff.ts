import { Content } from '../../data';
import { COMPANY, staffXpForLevel } from '../../data/company';
import { money, rate } from '../../core/format';
import { t } from '../../core/i18n';
import type { Game } from '../../game/game';
import { staffRows, upkeepBill, wageBill } from '../../company/payroll';
import {
  infoCard,
  progressBar,
  segmentRow,
  sectionTitle,
  statGrid,
  statTile,
  tooltip,
} from '../components';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/**
 * Mitarbeiter (GDD chapter 8, one of the six main areas).
 *
 * Personnel management: the company focus at the top - because that is the
 * only instruction the player ever gives - then the payroll with experience
 * and cost per role.
 */
export class StaffScreen implements Screen {
  readonly id = 'staff';
  readonly label = 'nav.staff';
  readonly icon = '👷';
  readonly root = el('div', 'screen');

  constructor(private game: Game) {}

  refresh(): void {
    clear(this.root);
    const { game, root } = this;
    const rows = staffRows(game);
    const headcount = rows.reduce((sum, r) => sum + r.count, 0);

    root.appendChild(
      statGrid(
        statTile(String(headcount), t('staff.headcount')),
        statTile(rate(wageBill(game), ' €/s'), t('staff.wages')),
        statTile(rate(upkeepBill(game), ' €/s'), t('staff.upkeep')),
        statTile(`×${game.stats.mult.staffProductivity.toFixed(2)}`, t('staff.productivity')),
      ),
    );

    this.renderPriorities();

    root.appendChild(sectionTitle(t('staff.roster')));
    if (rows.length === 0) {
      root.appendChild(el('div', 'empty', t('staff.empty')));
      return;
    }

    if (game.state.metrics.arrears > 0) {
      root.appendChild(
        el(
          'div',
          'card-note',
          t('staff.arrears', {
            amount: money(game.state.metrics.arrears),
            percent: Math.round(COMPANY.payroll.unpaidFactor * 100),
          }),
        ),
      );
    }

    for (const row of rows) {
      const def = Content.purchasable(row.id);
      const spent = xpSpent(row.level);
      const need = staffXpForLevel(row.level);
      const share = row.level >= COMPANY.staff.maxLevel ? 1 : (row.xp - spent) / need;

      const card = infoCard({
        icon: row.icon,
        title: `${row.name} ×${row.count}`,
        subtitle: t('staff.experience', {
          level: row.level,
          max: COMPANY.staff.maxLevel,
          wage: rate(row.wage, ' €/s'),
        }),
        lines: def?.desc ? [def.desc] : undefined,
        progress: share,
      });
      tooltip(card, () =>
        row.level >= COMPANY.staff.maxLevel
          ? t('staff.mastered', { name: row.name })
          : t('staff.toNextLevel', {
              name: row.name,
              amount: Math.ceil(need - (row.xp - spent)),
              level: row.level + 1,
            }),
      );
      root.appendChild(card);
    }
  }

  /** The one instruction the player gives (GDD chapter 6). */
  private renderPriorities(): void {
    const { game, root } = this;
    root.appendChild(sectionTitle(t('staff.focus')));
    root.appendChild(
      segmentRow(
        Content.priorities.map((p) => ({ id: p.id, label: p.name, icon: p.icon })),
        game.state.priority,
        (id) => {
          game.setPriority(id);
          this.refresh();
        },
      ),
    );

    const current = Content.priority(game.state.priority) ?? Content.priorities[0];
    root.appendChild(
      infoCard({
        icon: current.icon,
        title: current.name,
        subtitle: current.desc,
        lines: [t('staff.focusNote')],
      }),
    );
  }
}

/** Experience consumed by all levels below `level`. */
function xpSpent(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += staffXpForLevel(l);
  return total;
}

export { progressBar };
