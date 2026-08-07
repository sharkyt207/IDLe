import { Content } from '../../data';
import { t } from '../../core/i18n';
import { VEHICLE_CLASS_NAMES } from '../../data/vehicles';
import { fmt, money } from '../../core/format';
import type { VehicleDef } from '../../data/types';
import type { Game } from '../../game/game';
import { requirementText } from '../../game/stats';
import { RARITY_COLOR } from '../../data/ui';
import { rarityBadge } from '../components';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/** Ankauf: order deliveries and pick what the automation should buy. */
export class MarketScreen implements Screen {
  readonly id = 'market';
  readonly label = 'nav.sub.market';
  readonly icon = '🛒';
  readonly root = el('div', 'screen');

  constructor(private game: Game) {}

  refresh(): void {
    clear(this.root);
    const { game } = this;
    const queueFull = !!game.state.active && game.state.queue.length >= game.stats.queueSlots;

    const status = el('div', 'toggle-row');
    status.innerHTML = `<span>🅿️</span><span>Warteschlange <b>${game.state.queue.length}/${game.stats.queueSlots}</b></span>`;
    const spacer = el('span', 'spacer');
    status.appendChild(spacer);
    status.appendChild(
      el('span', queueFull ? 'pill' : 'pill on', queueFull ? 'Voll' : 'Platz frei'),
    );
    this.root.appendChild(status);

    if (game.stats.autoBuyPerMinute > 0) {
      this.root.appendChild(this.autoBuyPanel());
    }

    // Grouped by quality class (GDD chapter 4), best first inside each class.
    for (let cls = 1; cls <= VEHICLE_CLASS_NAMES.length; cls++) {
      const list = Content.vehicles.filter((v) => v.vehicleClass === cls);
      if (list.length === 0) continue;
      // Hide classes the player is still far away from.
      if (!list.some((v) => game.isUnlocked(v.id)) && cls > 1) {
        const first = list[0];
        if ((first.requires?.level ?? 1) > game.state.level + 6) continue;
      }
      this.root.appendChild(el('div', 'screen-title', `Stufe ${cls} · ${VEHICLE_CLASS_NAMES[cls - 1]}`));
      for (const def of list) this.root.appendChild(this.vehicleCard(def, queueFull));
    }
  }

  private autoBuyPanel(): HTMLElement {
    const { game } = this;
    const box = el('div', 'card');
    box.appendChild(el('div', 'card-icon', '🛻'));

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', 'Automatischer Ankauf'));
    body.appendChild(
      el('div', 'card-desc', `${fmt(game.stats.autoBuyPerMinute)} Fahrzeuge/min · Ziel wählen:`),
    );

    const select = el('select');
    select.style.cssText =
      'margin-top:6px;width:100%;background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:7px;font-size:13px;';
    for (const def of Content.vehicles) {
      if (!game.isUnlocked(def.id)) continue;
      const option = el('option');
      option.value = def.id;
      option.textContent = `${def.icon} ${def.name} — ${money(game.buyPrice(def.id))}`;
      if (def.id === game.state.autoBuyVehicle) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener('change', () => {
      game.state.autoBuyVehicle = select.value;
      game.bus.emit('changed', undefined);
    });
    body.appendChild(select);
    box.appendChild(body);

    const actions = el('div', 'card-actions');
    const toggle = el('button', game.state.autoBuyEnabled ? 'good' : 'ghost');
    toggle.textContent = game.state.autoBuyEnabled ? 'An' : 'Aus';
    toggle.addEventListener('click', () => {
      game.state.autoBuyEnabled = !game.state.autoBuyEnabled;
      this.refresh();
    });
    actions.appendChild(toggle);
    box.appendChild(actions);
    return box;
  }

  private vehicleCard(def: VehicleDef, queueFull: boolean): HTMLElement {
    const { game } = this;
    const unlocked = game.isUnlocked(def.id);
    const price = game.buyPrice(def.id);
    const affordable = game.state.money >= price;

    const card = el('div', `card${unlocked ? '' : ' locked'}`);
    card.appendChild(el('div', 'card-icon', def.icon));

    const body = el('div', 'card-body');
    const title = el('div', 'card-title');
    title.appendChild(document.createTextNode(def.name));
    // The same rarity colours as machines, materials and finds (chapter 8).
    title.appendChild(rarityBadge(def.rarity));
    card.style.setProperty('--card-accent', RARITY_COLOR[def.rarity]);
    body.appendChild(title);

    const totalWork = def.parts.reduce((sum, p) => sum + p.work, 0);
    body.appendChild(
      el(
        'div',
        'card-desc',
        `${def.parts.length} Teile · ${fmt(totalWork, 0)} Arbeit · ${fmt(def.weightKg, 0)} kg · ${def.xp} XP`,
      ),
    );
    body.appendChild(el('div', 'card-desc', `Erwartet: ${expectedValueText(game, def)}`));

    if (!unlocked) body.appendChild(el('div', 'card-note', `🔒 ${requirementText(def.requires)}`));
    else if (queueFull) body.appendChild(el('div', 'card-note', t('market.queueFull')));
    card.appendChild(body);

    const actions = el('div', 'card-actions');
    if (unlocked) {
      const buy = el('button', affordable && !queueFull ? 'primary' : '');
      buy.innerHTML = `Ankaufen<span class="price">${money(price)}</span>`;
      buy.disabled = !affordable || queueFull;
      buy.addEventListener('click', () => {
        if (game.buyVehicle(def.id)) this.refresh();
      });
      actions.appendChild(buy);
    }
    card.appendChild(actions);
    return card;
  }
}

/** Rough material value of a delivery at current prices - the buy decision. */
function expectedValueText(game: Game, def: VehicleDef): string {
  let value = 0;
  for (const part of def.parts) {
    for (const y of part.yields) {
      value += ((y.min + y.max) / 2) * game.sellPrice(y.material);
    }
    value += part.cash ?? 0;
  }
  const price = game.buyPrice(def.id);
  const marginText = price > 0 ? ` (${(value / price).toFixed(1)}×)` : '';
  return `≈ ${money(value)}${marginText}`;
}
