import { Content } from '../../data';
import { fmt, money, rate, units } from '../../core/format';
import type { Game } from '../../game/game';
import { craftsAvailable, craftsThatFit } from '../../game/systems/processing';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/** Lager: what is in storage, what it is worth, what gets processed. */
export class StorageScreen implements Screen {
  readonly id = 'storage';
  readonly label = 'Lager';
  readonly icon = '📦';
  readonly root = el('div', 'screen');

  constructor(private game: Game) {}

  hasNews(): boolean {
    return this.stockValue() > 0;
  }

  private stockValue(): number {
    let total = 0;
    for (const [id, amount] of Object.entries(this.game.state.storage)) {
      total += amount * this.game.sellPrice(id);
    }
    return total;
  }

  refresh(): void {
    clear(this.root);
    const { game } = this;

    const grid = el('div', 'stat-grid');
    grid.appendChild(stat(money(this.stockValue()), 'Lagerwert'));
    grid.appendChild(stat(`${units(game.storageUsed())} / ${units(game.stats.storage)}`, 'Belegung'));
    this.root.appendChild(grid);

    const row = el('div', 'btn-row');
    const sellAll = el('button', 'good', 'Alles verkaufen');
    sellAll.disabled = this.stockValue() <= 0;
    sellAll.addEventListener('click', () => {
      game.sellAll();
      this.refresh();
    });
    row.appendChild(sellAll);

    const auto = el('button', game.state.autoSellEnabled ? '' : 'ghost');
    auto.innerHTML = `Auto-Verkauf: ${game.state.autoSellEnabled ? 'An' : 'Aus'}<span class="price">${
      game.stats.autoSellPerSec > 0 ? rate(game.stats.autoSellPerSec) : 'keine Anlage'
    }</span>`;
    auto.addEventListener('click', () => {
      game.state.autoSellEnabled = !game.state.autoSellEnabled;
      this.refresh();
    });
    row.appendChild(auto);
    this.root.appendChild(row);

    this.root.appendChild(el('div', 'screen-title', 'Materialien'));
    const owned = Content.materialsSorted().filter((m) => (game.state.storage[m.id] ?? 0) > 0);
    if (owned.length === 0) {
      this.root.appendChild(el('div', 'empty', 'Noch nichts im Lager. Zerlege ein Fahrzeug im Hof.'));
    }
    for (const mat of owned) this.root.appendChild(this.materialRow(mat.id));

    this.renderProcessing();
  }

  private materialRow(materialId: string): HTMLElement {
    const { game } = this;
    const def = Content.material(materialId)!;
    const amount = game.state.storage[materialId] ?? 0;
    const price = game.sellPrice(materialId);
    const drift = game.marketFactor(materialId);
    const locked = !!game.state.autoSellLocked[materialId];

    const row = el('div', 'mat-row');
    const icon = el('div', 'card-icon', def.icon);
    icon.style.background = 'transparent';
    row.appendChild(icon);

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', def.name));
    const priceLine = el('div', 'mat-price');
    const trend = drift >= 1 ? 'trend-up' : 'trend-down';
    priceLine.innerHTML = `${money(price)}/Stk <span class="${trend}">${
      drift >= 1 ? '▲' : '▼'
    } ${Math.abs((drift - 1) * 100).toFixed(0)} %</span>`;
    body.appendChild(priceLine);
    row.appendChild(body);

    const amountBox = el('div');
    amountBox.style.textAlign = 'right';
    amountBox.appendChild(el('div', 'mat-amount', units(amount)));
    amountBox.appendChild(el('div', 'mat-price', money(amount * price)));
    row.appendChild(amountBox);

    const actions = el('div', 'card-actions');
    const sell = el('button', 'primary', 'Verkaufen');
    sell.addEventListener('click', () => {
      this.game.sellMaterial(materialId);
      this.refresh();
    });
    actions.appendChild(sell);

    const lock = el('button', locked ? '' : 'ghost', locked ? '🔒' : '🔓');
    lock.title = locked ? 'Wird nicht automatisch verkauft' : 'Wird automatisch verkauft';
    lock.addEventListener('click', () => {
      if (locked) delete this.game.state.autoSellLocked[materialId];
      else this.game.state.autoSellLocked[materialId] = true;
      this.refresh();
    });
    actions.appendChild(lock);
    row.appendChild(actions);
    return row;
  }

  /** Production chains - only shown once the Schmelzerei exists. */
  private renderProcessing(): void {
    const { game } = this;
    if (!game.stats.unlocks.has('processing')) return;

    this.root.appendChild(el('div', 'screen-title', 'Verarbeitung'));
    const active = Object.keys(game.stats.processes);
    if (active.length === 0) {
      this.root.appendChild(
        el('div', 'empty', 'Kaufe im Ausbau Verarbeitungsmaschinen, um Rohstoffe zu veredeln.'),
      );
      return;
    }

    for (const recipeId of active) {
      const recipe = Content.recipe(recipeId);
      if (!recipe) continue;
      const perSec = game.stats.processes[recipeId];
      const possible = craftsAvailable(game, recipe);
      const fits = craftsThatFit(game, recipe);

      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', Content.material(recipe.output[0].material)?.icon ?? '⚙️'));
      const body = el('div', 'card-body');
      body.appendChild(el('div', 'card-title', recipe.name));
      body.appendChild(el('div', 'card-desc', recipe.desc ?? ''));
      const running = possible > 0 && fits > 0;
      body.appendChild(
        el(
          'div',
          running ? 'card-desc' : 'card-note',
          running
            ? `${rate(perSec, '/s')} · Material reicht für ${fmt(possible, 0)} Durchläufe`
            : possible <= 0
              ? 'Wartet auf Material'
              : 'Wartet auf Lagerplatz',
        ),
      );
      card.appendChild(body);
      this.root.appendChild(card);
    }
  }
}

function stat(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.appendChild(el('b', undefined, value));
  box.appendChild(el('span', undefined, label));
  return box;
}
