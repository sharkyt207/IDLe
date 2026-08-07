import { Content } from '../data';
import { fmt, money, units } from '../core/format';
import type { Game } from '../game/game';
import { xpForLevel } from '../game/state';
import { progressOf } from '../economy/contracts';
import { needsService } from '../game/systems/maintenance';
import { clear, el } from './dom';
import { statusIndicator, tooltip } from './components';

/**
 * The HUD (GDD chapter 8).
 *
 * Top: money, company value, prestige points, research points.
 * Left: what is running - tasks, events, contracts.
 * Right: hints and warnings that are not urgent enough for a toast.
 *
 * The rails are deliberately quiet: they only appear when they have something
 * to say, because a permanently half-empty sidebar is clutter, and "weniger
 * Elemente, dafür bessere" is the stated philosophy of this chapter.
 */
export class Hud {
  readonly top = el('header', 'topbar');
  readonly left = el('aside', 'rail rail-left');
  readonly right = el('aside', 'rail rail-right');

  private money = el('div', 'money');
  private rate = el('div', 'rate');
  private level = el('span', 'level-chip');
  private xpFill = el('i');
  private storageFill = el('i');
  private storageBar = el('div', 'storage-bar');
  private storageText = el('span');
  private resources = el('div', 'topbar-resources');

  /** Smoothed income for the "€/s" readout. */
  private incomeEma = 0;
  private lastEarned = 0;
  private sampleTimer = 0;

  constructor(private game: Game) {
    const row = el('div', 'topbar-row');
    row.appendChild(this.money);
    row.appendChild(this.level);
    row.appendChild(this.rate);
    this.top.appendChild(row);

    const xp = el('div', 'xp-bar');
    xp.appendChild(this.xpFill);
    this.top.appendChild(xp);

    // Company value, Industriepunkte and research points, as the GDD lists.
    this.top.appendChild(this.resources);

    const storageLine = el('div', 'storage-line');
    storageLine.appendChild(el('span', undefined, '📦'));
    this.storageBar.appendChild(this.storageFill);
    storageLine.appendChild(this.storageBar);
    storageLine.appendChild(this.storageText);
    this.top.appendChild(storageLine);

    tooltip(this.top, () => this.summary());
    this.lastEarned = game.state.lifetimeEarned;
  }

  /** Feeds the income average. Called every frame by the shell. */
  sample(dt: number): void {
    this.sampleTimer += dt;
    if (this.sampleTimer < 0.5) return;
    const earned = this.game.state.lifetimeEarned - this.lastEarned;
    this.lastEarned = this.game.state.lifetimeEarned;
    this.incomeEma += (earned / this.sampleTimer - this.incomeEma) * 0.35;
    this.sampleTimer = 0;
  }

  refresh(): void {
    const { state, stats } = this.game;

    this.money.textContent = money(state.money);
    this.level.textContent = `Lv ${state.level}`;
    this.rate.textContent = `${money(this.incomeEma)}/s`;
    this.xpFill.style.width = `${Math.min(100, (state.xp / xpForLevel(state.level)) * 100)}%`;

    clear(this.resources);
    this.resources.appendChild(chip('🏢', money(this.game.companyValue()), 'Firmenwert'));
    if (state.prestige.points > 0 || state.prestige.runs > 0) {
      this.resources.appendChild(chip('🏆', fmt(state.prestige.points, 0), 'Industriepunkte'));
    }
    if (stats.unlocks.has('research')) {
      this.resources.appendChild(chip('🔬', fmt(state.research.points, 0), 'Forschungspunkte'));
    }

    const used = this.game.storageUsed();
    const ratio = stats.storage > 0 ? used / stats.storage : 0;
    this.storageFill.style.width = `${Math.min(100, ratio * 100)}%`;
    this.storageBar.classList.toggle('full', ratio >= 0.999);
    this.storageText.textContent = `${units(used)}/${units(stats.storage)}`;

    this.refreshLeft();
    this.refreshRight();
  }

  /** Left rail: what the company is working on right now. */
  private refreshLeft(): void {
    const { state, stats } = this.game;
    const rows: HTMLElement[] = [];

    for (const contract of state.trade.active.slice(0, 3)) {
      const def = Content.contract(contract.defId);
      const share = contract.done ? 1 : progressOf(contract);
      rows.push(
        railRow(
          '🤝',
          def?.client ?? 'Vertrag',
          contract.done ? 'läuft' : `${Math.round(share * 100)} %`,
          share,
        ),
      );
    }

    for (const project of state.research.active.slice(0, 2)) {
      const tech = Content.researchNode(project.id);
      rows.push(
        railRow(
          tech?.icon ?? '🔬',
          `${tech?.name ?? project.id} ${project.level}`,
          `${Math.round((1 - project.remaining / Math.max(1, project.total)) * 100)} %`,
          1 - project.remaining / Math.max(1, project.total),
        ),
      );
    }

    if (state.trade.auction) {
      const lot = Content.auctionLot(state.trade.auction.lotId);
      rows.push(railRow('🔨', lot?.name ?? 'Auktion', `${Math.ceil(state.trade.auction.timeLeft)} s`));
    }

    if (rows.length === 0 && stats.teardownRate > 0 && state.active) {
      rows.push(railRow('🤖', 'Automatik läuft', `${fmt(stats.teardownRate)}/s`));
    }

    clear(this.left);
    for (const row of rows.slice(0, 4)) this.left.appendChild(row);
    this.left.style.display = rows.length ? '' : 'none';
  }

  /** Right rail: standing warnings. Toasts handle the transient ones. */
  private refreshRight(): void {
    const { state, stats } = this.game;
    const rows: HTMLElement[] = [];

    if (stats.power.factor < 0.99) {
      rows.push(statusRow('Strommangel', `${Math.round(stats.power.factor * 100)} % Leistung`, 'bad'));
    }
    if (this.game.storageUsed() >= stats.storage * 0.9) {
      rows.push(statusRow('Lager fast voll', `${units(this.game.storageUsed())} Einheiten`, 'warn'));
    }
    if (needsService(this.game)) {
      rows.push(statusRow('Wartung nötig', `${Math.round(stats.condition * 100)} % Zustand`, 'warn'));
    }
    if (state.metrics.arrears > 0) {
      rows.push(statusRow('Löhne offen', money(state.metrics.arrears), 'bad'));
    }

    clear(this.right);
    for (const row of rows.slice(0, 3)) this.right.appendChild(row);
    this.right.style.display = rows.length ? '' : 'none';
  }

  /** Long-press summary of the whole company, for the top bar. */
  private summary(): string {
    const { state, stats } = this.game;
    return [
      `Level ${state.level}`,
      `Firmenwert ${money(this.game.companyValue())}`,
      `Zerlegen ${fmt(stats.teardownRate)}/s`,
      `Strom ${Math.round(stats.power.factor * 100)} %`,
    ].join(' · ');
  }
}

function chip(icon: string, value: string, title: string): HTMLElement {
  const node = el('div', 'res-chip');
  node.title = title;
  node.appendChild(el('span', 'res-icon', icon));
  node.appendChild(el('span', 'res-value', value));
  return node;
}

function railRow(icon: string, label: string, value: string, progress?: number): HTMLElement {
  const row = el('div', 'rail-row');
  row.appendChild(el('span', 'rail-icon', icon));
  const body = el('div', 'rail-body');
  body.appendChild(el('span', 'rail-label', label));
  body.appendChild(el('span', 'rail-value', value));
  if (progress !== undefined) {
    const bar = el('div', 'rail-bar');
    const fill = el('i');
    fill.style.width = `${Math.max(2, Math.min(100, progress * 100))}%`;
    bar.appendChild(fill);
    body.appendChild(bar);
  }
  row.appendChild(body);
  return row;
}

function statusRow(label: string, value: string, tone: 'warn' | 'bad'): HTMLElement {
  const row = el('div', 'rail-row');
  const body = el('div', 'rail-body');
  body.appendChild(statusIndicator(label, tone));
  body.appendChild(el('span', 'rail-value', value));
  row.appendChild(body);
  return row;
}
