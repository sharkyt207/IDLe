import { Content } from '../../data';
import { fmt, rate, units } from '../../core/format';
import type { PurchaseCategory } from '../../data/types';
import type { Game } from '../../game/game';
import { meetsRequirement, nextCost } from '../../game/stats';
import { owned } from '../../game/state';
import { purchasableCard, renderGroups } from '../cards';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

const TABS: { id: PurchaseCategory; label: string; icon: string }[] = [
  { id: 'machine', label: 'Maschinen', icon: '🤖' },
  { id: 'employee', label: 'Team', icon: '👷' },
  { id: 'building', label: 'Gelände', icon: '🏢' },
  { id: 'tool', label: 'Werkzeug', icon: '🔨' },
];

/** Ausbau: everything the player can buy, grouped by category. */
export class BuildScreen implements Screen {
  readonly id = 'build';
  readonly label = 'Ausbau';
  readonly icon = '🛠️';
  readonly root = el('div', 'screen');

  private tab: PurchaseCategory = 'machine';

  constructor(private game: Game) {}

  hasNews(): boolean {
    return Content.purchasables.some((def) => this.game.canBuy(def.id));
  }

  refresh(): void {
    clear(this.root);

    const grid = el('div', 'stat-grid');
    grid.appendChild(stat(rate(this.game.stats.teardownRate), 'Auto-Zerlegen'));
    grid.appendChild(stat(fmt(this.game.stats.tapPower), 'Pro Tipp'));
    grid.appendChild(stat(units(this.game.stats.storage), 'Lagerplätze'));
    grid.appendChild(stat(rate(this.game.stats.autoSellPerSec), 'Auto-Verkauf'));
    this.root.appendChild(grid);

    const tabs = el('div', 'btn-row');
    for (const tab of TABS) {
      const btn = el('button', this.tab === tab.id ? 'primary' : 'ghost');
      btn.innerHTML = `${tab.icon}<span class="price">${tab.label}</span>`;
      btn.addEventListener('click', () => {
        this.tab = tab.id;
        this.refresh();
      });
      tabs.appendChild(btn);
    }
    this.root.appendChild(tabs);

    const defs = Content.purchasables
      .filter((def) => def.category === this.tab)
      .filter((def) => this.isVisible(def.id))
      .slice();

    if (defs.length === 0) {
      this.root.appendChild(el('div', 'empty', 'Hier gibt es aktuell nichts zu bauen.'));
      return;
    }

    renderGroups(this.root, defs, (def) =>
      purchasableCard(this.game, def, () => this.refresh()),
    );
  }

  /**
   * Keeps the list readable: a locked entry only shows once the player is
   * close to it (previous tier owned, or nothing of its group owned yet).
   */
  private isVisible(id: string): boolean {
    const def = Content.purchasable(id);
    if (!def) return false;
    if (owned(this.game.state, id) > 0) return true;
    if (meetsRequirement(this.game.state, this.game.stats, def.requires)) return true;
    // Locked: show if it is the next step of its group, hide deeper tiers.
    const group = Content.purchasables.filter((d) => d.category === def.category && d.group === def.group);
    const lockedInGroup = group.filter(
      (d) => !meetsRequirement(this.game.state, this.game.stats, d.requires) && owned(this.game.state, d.id) === 0,
    );
    return lockedInGroup.indexOf(def) < 2;
  }
}

function stat(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.appendChild(el('b', undefined, value));
  box.appendChild(el('span', undefined, label));
  return box;
}

/** Exported for the tutorial's first-investment modal. */
export function affordableHint(game: Game, id: string): string {
  return `${Content.purchasable(id)?.name ?? id} · ${fmt(nextCost(game.state, id))} €`;
}
