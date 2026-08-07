import { Content } from '../../data';
import { duration, fmt, money } from '../../core/format';
import { t } from '../../core/i18n';
import type { Game } from '../../game/game';
import { rows as missionRows, track, type MissionRow } from '../../missions/manager';
import { rows as milestoneRows } from '../../missions/milestones';
import {
  badge,
  infoCard,
  secondaryButton,
  sectionTitle,
  segmentRow,
  statGrid,
  statTile,
} from '../components';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

type Tab = 'offen' | 'meilensteine' | 'erledigt';

/**
 * Missionen (GDD chapter 10).
 *
 * The full list behind the three-entry task widget: what is open, what the
 * company is growing towards, and what has already been done. The last tab
 * matters more than it looks - a player who comes back after a week wants to
 * see that the time they put in is still on the record.
 */
export class MissionsScreen implements Screen {
  readonly id = 'missions';
  readonly label = 'nav.sub.missions';
  readonly icon = '🎯';
  readonly root = el('div', 'screen');

  private tab: Tab = 'offen';
  private signature = '';

  constructor(private game: Game) {}

  /** A dot on the tab while something is finished but unseen, or brand new. */
  hasNews(): boolean {
    return missionRows(this.game).some((row) => row.progress >= 0.999);
  }

  refresh(): void {
    const { game } = this;
    const open = missionRows(game);
    const milestones = milestoneRows(game);
    const doneCount = game.state.missions.done.length;

    // Rebuilt only when it would look different - otherwise the "Verfolgen"
    // button is replaced under the player's thumb four times a second, which
    // is exactly how taps get dropped (chapter 9).
    const signature = [
      this.tab,
      doneCount,
      game.state.missions.tracked,
      milestones.filter((m) => m.reached).length,
      ...open.map((r) => `${r.def.id}:${Math.round(r.progress * 60)}`),
    ].join('|');
    if (signature === this.signature) return;
    this.signature = signature;

    clear(this.root);

    this.root.appendChild(
      statGrid(
        statTile(fmt(open.length, 0), t('missions.open')),
        statTile(fmt(doneCount, 0), t('missions.done'), 'good'),
        statTile(
          `${milestones.filter((m) => m.reached).length}/${milestones.length}`,
          t('missions.milestones'),
        ),
      ),
    );

    this.root.appendChild(
      segmentRow(
        [
          { id: 'offen', label: t('missions.tab.open'), icon: '🎯' },
          { id: 'meilensteine', label: t('missions.tab.milestones'), icon: '🏁' },
          { id: 'erledigt', label: t('missions.tab.done'), icon: '✔' },
        ],
        this.tab,
        (id) => {
          this.tab = id as Tab;
          this.refresh();
        },
      ),
    );

    if (this.tab === 'offen') this.renderOpen(open);
    else if (this.tab === 'meilensteine') this.renderMilestones(milestones);
    else this.renderDone();
  }

  private renderOpen(rows: MissionRow[]): void {
    if (rows.length === 0) {
      this.root.appendChild(el('p', 'card-desc', t('missions.empty')));
      return;
    }

    const groups: { kind: string; title: string }[] = [
      { kind: 'tutorial', title: t('missions.group.tutorial') },
      { kind: 'main', title: t('missions.group.main') },
      { kind: 'side', title: t('missions.group.side') },
      { kind: 'daily', title: t('missions.group.daily') },
      { kind: 'weekly', title: t('missions.group.weekly') },
    ];

    for (const group of groups) {
      const inGroup = rows.filter((row) => row.def.kind === group.kind);
      if (inGroup.length === 0) continue;
      this.root.appendChild(sectionTitle(group.title));
      for (const row of inGroup) this.root.appendChild(this.card(row));
    }
  }

  private card(row: MissionRow): HTMLElement {
    const tracked = this.game.state.missions.tracked === row.def.id;
    const actions: HTMLElement[] = [
      secondaryButton({
        label: tracked ? t('missions.tracked') : t('missions.track'),
        tone: tracked ? 'info' : 'neutral',
        onClick: () => {
          track(this.game, row.def.id);
          this.refresh();
        },
      }),
    ];

    const lines = [row.text, `${t('missions.reward')}: ${row.rewardText}`];
    // A timed mission says how long it has - the only place a deadline is ever
    // shown, because it is the only place one exists.
    if (row.entry.expires > 0) lines.push(t('missions.expires', { time: duration(row.entry.expires) }));

    return infoCard({
      icon: row.def.icon,
      title: row.def.name,
      lines,
      progress: row.progress,
      note: row.done ? t('missions.readyToCollect') : undefined,
      actions,
    });
  }

  private renderMilestones(rows: ReturnType<typeof milestoneRows>): void {
    this.root.appendChild(sectionTitle(t('missions.milestonesTitle')));
    this.root.appendChild(el('p', 'card-desc', t('missions.milestonesBody')));
    for (const row of rows) {
      this.root.appendChild(
        infoCard({
          icon: row.def.icon,
          title: row.def.name,
          subtitle: row.def.desc,
          lines: [`${t('missions.reward')}: ${row.rewardText}`],
          progress: row.reached ? 1 : row.progress,
          note: row.reached
            ? undefined
            : `${money(row.value)} / ${money(row.def.value)}`,
          locked: !row.reached,
          accent: row.reached ? 'var(--green)' : undefined,
        }),
      );
    }
  }

  private renderDone(): void {
    const done = this.game.state.missions.done
      .map((id) => Content.mission(id))
      .filter((def): def is NonNullable<typeof def> => !!def);

    if (done.length === 0) {
      this.root.appendChild(el('p', 'card-desc', t('missions.noneDone')));
      return;
    }
    this.root.appendChild(sectionTitle(t('missions.doneTitle')));
    for (const def of done.reverse()) {
      const card = infoCard({
        icon: def.icon,
        title: def.name,
        subtitle: def.desc,
        accent: 'var(--green)',
        actions: [badge('✔', 'good')],
      });
      this.root.appendChild(card);
    }
  }
}
