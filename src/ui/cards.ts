import { money } from '../core/format';
import type { PurchasableDef } from '../data/types';
import type { Game } from '../game/game';
import { meetsRequirement, nextCost, requirementText } from '../game/stats';
import { owned } from '../game/state';
import { el } from './dom';

/**
 * One purchase row, shared by the tools/machines/staff/buildings screens.
 * Locked entries stay visible so the player always sees what comes next.
 */
export function purchasableCard(game: Game, def: PurchasableDef, onBuy: () => void): HTMLElement {
  const count = owned(game.state, def.id);
  const unlocked = meetsRequirement(game.state, game.stats, def.requires);
  const maxed = count >= def.maxCount;
  const cost = nextCost(game.state, def.id);
  const affordable = game.state.money >= cost;

  const card = el('div', `card${unlocked ? '' : ' locked'}`);

  const icon = el('div', 'card-icon', def.icon);
  card.appendChild(icon);

  const body = el('div', 'card-body');
  const title = el('div', 'card-title');
  title.appendChild(document.createTextNode(def.name));
  if (count > 0) {
    const badge = el('span', 'count', `×${count}`);
    title.appendChild(badge);
  }
  body.appendChild(title);
  body.appendChild(el('div', 'card-desc', def.desc));

  if (!unlocked) {
    body.appendChild(el('div', 'card-note', `🔒 ${requirementText(def.requires)}`));
  } else if (maxed) {
    body.appendChild(el('div', 'card-note', '✔ Maximal ausgebaut'));
  }
  card.appendChild(body);

  const actions = el('div', 'card-actions');
  if (unlocked && !maxed) {
    const btn = el('button', affordable ? 'primary' : '');
    btn.innerHTML = `Kaufen<span class="price">${money(cost)}</span>`;
    btn.disabled = !affordable;
    btn.addEventListener('click', () => {
      if (game.buyPurchasable(def.id)) onBuy();
    });
    actions.appendChild(btn);
  }
  card.appendChild(actions);

  return card;
}

/** Groups definitions by their `group` field and renders titled sections. */
export function renderGroups(
  parent: HTMLElement,
  defs: PurchasableDef[],
  renderOne: (def: PurchasableDef) => HTMLElement,
): void {
  const groups = new Map<string, PurchasableDef[]>();
  for (const def of defs) {
    const list = groups.get(def.group) ?? [];
    list.push(def);
    groups.set(def.group, list);
  }
  for (const [group, list] of groups) {
    parent.appendChild(el('div', 'screen-title', group));
    for (const def of list) parent.appendChild(renderOne(def));
  }
}
