import { t } from '../core/i18n';
import type { Game } from '../game/game';
import { fmt, money } from '../core/format';
import { visibleRows, track, type MissionRow } from '../missions/manager';
import { attachPress, tooltip } from './components';
import { clear, el } from './dom';

/**
 * The task list (GDD chapter 10).
 *
 * Top left, at most three entries, each with a title, a progress bar, the
 * reward and a way to jump to where the work happens. Everything else about a
 * mission lives on the Missionen screen - this is the glanceable version, and
 * it earns its place on a phone screen by staying small.
 *
 * Rebuilt only when it would actually look different, for the same reason the
 * tab bar is: replacing the node under the player's finger four times a second
 * eats taps.
 */
export class TaskList {
  readonly root = el('div', 'tasks');
  private signature = '';
  private collapsed = false;

  constructor(
    private game: Game,
    private navigate: (screen: string) => void,
  ) {}

  refresh(): void {
    const rows = visibleRows(this.game);
    const tracked = this.game.state.missions.tracked;
    const folded = this.collapsed;
    const signature = [
      folded ? 'c' : 'o',
      tracked,
      ...rows.map((r) => `${r.def.id}:${Math.round(r.progress * 40)}:${Math.round(r.target)}`),
    ].join('|');
    if (signature === this.signature) return;
    this.signature = signature;

    clear(this.root);
    this.root.style.display = rows.length ? '' : 'none';
    if (rows.length === 0) return;

    const head = el('button', 'tasks-head');
    head.appendChild(el('span', 'tasks-title', t('tasks.title')));
    head.appendChild(el('span', 'tasks-count', `${rows.length}`));
    head.appendChild(el('span', 'tasks-toggle', folded ? '▸' : '▾'));
    attachPress(head, () => {
      this.collapsed = !this.collapsed;
      this.signature = '';
      this.refresh();
    });
    this.root.appendChild(head);
    if (folded) return;

    for (const row of rows) this.root.appendChild(this.card(row, tracked === row.def.id));
  }

  private card(row: MissionRow, tracked: boolean): HTMLElement {
    const card = el('div', `task${tracked ? ' tracked' : ''} kind-${row.def.kind}`);

    const head = el('div', 'task-head');
    head.appendChild(el('span', 'task-icon', row.def.icon));
    head.appendChild(el('span', 'task-name', row.def.name));
    card.appendChild(head);

    const bar = el('div', 'task-bar');
    const fill = el('i');
    fill.style.width = `${Math.max(3, row.progress * 100)}%`;
    bar.appendChild(fill);
    card.appendChild(bar);

    const foot = el('div', 'task-foot');
    foot.appendChild(el('span', 'task-progress', progressLabel(row)));
    foot.appendChild(el('span', 'task-reward', row.rewardText));
    card.appendChild(foot);

    // Tapping the card jumps to where the work happens ("Verfolgen"); holding
    // it pins the mission to the top of the list.
    attachPress(card, () => {
      if (row.def.screen) this.navigate(row.def.screen);
    });
    tooltip(card, () => `${row.text}\n${t('tasks.hold')}`);
    let hold: number | undefined;
    card.addEventListener('pointerdown', () => {
      hold = window.setTimeout(() => {
        track(this.game, row.def.id);
        this.signature = '';
        this.refresh();
      }, 420);
    });
    const cancel = () => window.clearTimeout(hold);
    card.addEventListener('pointerup', cancel);
    card.addEventListener('pointercancel', cancel);
    card.addEventListener('pointerleave', cancel);
    return card;
  }
}

/** "4 / 12" for counts, "1.200 € / 25.000 €" for money goals. */
export function progressLabel(row: MissionRow): string {
  const isMoney = row.def.goal.metric === 'runEarned' || row.def.goal.metric.endsWith('Earned') || row.def.goal.metric === 'companyValue' || row.def.goal.metric === 'money';
  const format = (value: number) => (isMoney ? money(value) : fmt(Math.floor(value), 0));
  return `${format(Math.min(row.value, row.target))} / ${format(row.target)}`;
}
