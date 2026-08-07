import { Content } from '../../data';
import { qualityName } from '../../data/economy';
import { priceInfo } from '../../economy/market';
import { ruleFor, ruleText, setRule } from '../../company/warehouse';
import { openModal } from '../modal';
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
      total += amount * Math.max(0, this.game.sellPrice(id));
    }
    return total;
  }

  refresh(): void {
    clear(this.root);
    const { game } = this;

    const grid = el('div', 'stat-grid');
    grid.appendChild(stat(money(this.stockValue()), 'Lagerwert'));
    grid.appendChild(stat(qualityName(game.stats.quality), 'Anlagenqualität'));
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
    const info = priceInfo(game.state, game.stats, materialId);
    const price = info.price;
    const drift = info.drift;
    const locked = !!game.state.autoSellLocked[materialId];

    const row = el('div', 'mat-row');
    const icon = el('div', 'card-icon', def.icon);
    icon.style.background = 'transparent';
    row.appendChild(icon);

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', def.name));
    const priceLine = el('div', 'mat-price');
    const trend = info.trend > 0 ? 'trend-up' : info.trend < 0 ? 'trend-down' : '';
    const arrow = info.trend > 0 ? '▲' : info.trend < 0 ? '▼' : '▬';
    priceLine.innerHTML = info.disposal
      ? `<span class="trend-down">Entsorgung ${money(-price)}/Stk</span>`
      : `${money(price)}/Stk <span class="${trend}">${arrow} ${Math.abs((drift - 1) * 100).toFixed(0)} %</span>`;
    body.appendChild(priceLine);
    if (!info.disposal) {
      body.appendChild(
        el('div', 'mat-price', `Qualität: ${qualityName(game.state.quality[materialId] ?? game.stats.quality)}`),
      );
    }
    const rule = ruleText(game, materialId);
    if (rule) body.appendChild(el('div', 'card-note', `📋 ${rule}`));
    row.appendChild(body);

    const amountBox = el('div');
    amountBox.style.textAlign = 'right';
    amountBox.appendChild(el('div', 'mat-amount', units(amount)));
    amountBox.appendChild(el('div', 'mat-price', money(amount * price)));
    row.appendChild(amountBox);

    const actions = el('div', 'card-actions');
    const sell = el('button', info.disposal ? '' : 'primary', info.disposal ? 'Entsorgen' : 'Verkaufen');
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

    const rules = el('button', 'ghost', '⚙️');
    rules.title = 'Lagerregel festlegen';
    rules.addEventListener('click', () => this.editRule(materialId));
    actions.appendChild(rules);
    row.appendChild(actions);
    return row;
  }

  /** Standing order for one material (GDD chapter 6: Lagerverwaltung). */
  private editRule(materialId: string): void {
    const { game } = this;
    const def = Content.material(materialId)!;
    const current = ruleFor(game, materialId);

    const content = el('div');
    const keepLabel = el('div', 'card-desc', 'Immer mindestens auf Lager halten:');
    content.appendChild(keepLabel);
    const keep = el('input');
    keep.type = 'number';
    keep.min = '0';
    keep.value = String(current.keep ?? '');
    keep.placeholder = '0';
    styleInput(keep);
    content.appendChild(keep);

    content.appendChild(el('div', 'card-desc', 'Erst automatisch verkaufen ab Preis (€/Stk):'));
    const minPrice = el('input');
    minPrice.type = 'number';
    minPrice.min = '0';
    minPrice.step = '0.1';
    minPrice.value = String(current.minPrice ?? '');
    minPrice.placeholder = String(def.basePrice.toFixed(2));
    styleInput(minPrice);
    content.appendChild(minPrice);

    const save = el('button', 'primary wide', 'Regel speichern');
    save.addEventListener('click', () => {
      setRule(game, materialId, {
        keep: Number(keep.value) || undefined,
        minPrice: Number(minPrice.value) || undefined,
      });
      close();
      this.refresh();
    });
    content.appendChild(save);

    const clear = el('button', 'ghost wide', 'Regel löschen');
    clear.addEventListener('click', () => {
      setRule(game, materialId, {});
      close();
      this.refresh();
    });
    content.appendChild(clear);

    const close = openModal({
      title: `${def.icon} ${def.name}`,
      body: 'Dauerauftrag für die Verkaufsautomatik. Gilt auch für „Alles verkaufen".',
      content,
    });
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

function styleInput(input: HTMLInputElement): void {
  input.style.cssText =
    'width:100%;margin:4px 0 10px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px;font-size:14px;';
}

function stat(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.appendChild(el('b', undefined, value));
  box.appendChild(el('span', undefined, label));
  return box;
}
