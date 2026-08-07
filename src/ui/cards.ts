import { fmt, money } from '../core/format';
import { MACHINES, levelMultiplier } from '../data/machines';
import { COMPANY, staffLevel, staffProductivity, staffXpForLevel } from '../data/company';
import type { PurchasableDef } from '../data/types';
import type { Game } from '../game/game';
import { meetsRequirement, nextCost, requirementText } from '../game/stats';
import { owned } from '../game/state';
import { RARITY_COLOR, RARITY_ORDER } from '../data/ui';
import { tooltip } from './components';
import { openDetails } from './details';
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

  const isMachine = def.category === 'machine';
  const card = el('div', `card${unlocked ? '' : ' locked'}`);
  // Rarity colour on the left edge: machines climb tiers as they are levelled,
  // so a mastered machine reads as legendary at a glance (GDD chapter 8).
  if (isMachine && count > 0) {
    const tier = RARITY_ORDER[Math.min(RARITY_ORDER.length - 1, Math.floor(count / 2))];
    card.style.setProperty('--card-accent', RARITY_COLOR[tier]);
  }
  // Hold a card to open its detail window without buying anything.
  if (unlocked && count > 0) {
    tooltip(card, () => `${def.name} — halten für Details`);
    card.addEventListener('dblclick', () => openDetails(game, def.id, onBuy));
  }

  const icon = el('div', 'card-icon', def.icon);
  card.appendChild(icon);

  const body = el('div', 'card-body');
  const title = el('div', 'card-title');
  title.appendChild(document.createTextNode(def.name));
  if (count > 0) {
    // Machines are levelled, everything else is counted.
    title.appendChild(el('span', 'count', isMachine ? `Stufe ${count}/${def.maxCount}` : `×${count}`));
  }
  body.appendChild(title);
  body.appendChild(el('div', 'card-desc', def.desc));

  if (isMachine && count > 0) {
    const condition = game.state.condition[def.id] ?? 1;
    const parts = [`Leistung ×${levelMultiplier(count).toFixed(2)}`];
    if (count >= MACHINES.qualityFromLevel) parts.push('Qualitätsbonus');
    if (count >= MACHINES.master.level) parts.push('Meisterstufe: Energiebonus + Fundchance');
    body.appendChild(el('div', 'card-desc', parts.join(' · ')));
    body.appendChild(
      el(
        'div',
        condition < MACHINES.wear.warnBelow ? 'card-note' : 'card-desc',
        `Zustand ${fmt(condition * 100, 0)} %`,
      ),
    );
  }

  if (def.category === 'employee' && count > 0) {
    const xp = game.state.staffXp[def.id] ?? 0;
    const level = staffLevel(xp);
    const productivity = staffProductivity(level);
    const wage = (def.salary ?? 0) * count * (1 + (level - 1) * COMPANY.staff.salaryPerLevel);
    body.appendChild(
      el(
        'div',
        'card-desc',
        `Erfahrung ${level}/${COMPANY.staff.maxLevel} · Leistung ×${productivity.toFixed(2)} · Lohn ${money(wage)}/s`,
      ),
    );
    if (level < COMPANY.staff.maxLevel) {
      const bar = el('div', 'xp-bar');
      const fill = el('i');
      let spent = 0;
      for (let l = 1; l < level; l++) spent += staffXpForLevel(l);
      fill.style.width = `${Math.min(100, ((xp - spent) / staffXpForLevel(level)) * 100)}%`;
      bar.appendChild(fill);
      bar.style.marginTop = '4px';
      body.appendChild(bar);
    }
  } else if (def.category === 'employee' && def.salary) {
    body.appendChild(el('div', 'card-desc', `Lohn ${money(def.salary)}/s pro Person`));
  }
  if (def.upkeep) {
    body.appendChild(el('div', 'card-desc', `Unterhalt ${money(def.upkeep)}/s pro Stufe`));
  }

  if (!unlocked) {
    body.appendChild(el('div', 'card-note', `🔒 ${requirementText(def.requires)}`));
  } else if (maxed) {
    body.appendChild(el('div', 'card-note', isMachine ? '✔ Meisterstufe erreicht' : '✔ Maximal ausgebaut'));
  }
  card.appendChild(body);

  const actions = el('div', 'card-actions');
  if (unlocked && !maxed) {
    const btn = el('button', affordable ? 'primary' : '');
    const label = isMachine && count > 0 ? `Stufe ${count + 1}` : 'Kaufen';
    btn.innerHTML = `${label}<span class="price">${money(cost)}</span>`;
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
