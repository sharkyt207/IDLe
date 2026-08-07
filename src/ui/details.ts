import { Content } from '../data';
import { MACHINES, conditionFactor, levelMultiplier } from '../data/machines';
import { RARITY_COLOR, type RarityTier } from '../data/ui';
import { fmt, money, rate } from '../core/format';
import type { Game } from '../game/game';
import type { Effect, PurchasableDef } from '../data/types';
import { owned } from '../game/state';
import { investedIn } from '../game/systems/maintenance';
import { nextCost } from '../game/stats';
import {
  badge,
  dialog,
  infoCard,
  primaryButton,
  progressBar,
  statusIndicator,
  statGrid,
  statTile,
} from './components';
import { el } from './dom';

/**
 * The detail window (GDD chapter 8).
 *
 * "Jede Maschine besitzt ein Detailfenster" with name, picture, level,
 * production rate, energy draw, maintenance status, upgrades and description.
 * Reached by tapping a structure on the yard or holding a card.
 *
 * Everything shown is derived from the same effect descriptors the simulation
 * uses, so a new machine needs no work here.
 */
export function openDetails(game: Game, defId: string, onChange?: () => void): void {
  const def = Content.purchasable(defId);
  if (!def) return;

  const content = el('div');
  const render = () => {
    content.replaceChildren(...body(game, def, () => {
      close();
      openDetails(game, defId, onChange);
      onChange?.();
    }));
  };
  render();

  const close = dialog({ title: def.name, icon: def.icon, content });
}

function body(game: Game, def: PurchasableDef, afterBuy: () => void): HTMLElement[] {
  const out: HTMLElement[] = [];
  const level = owned(game.state, def.id);
  const isMachine = def.category === 'machine';
  const condition = game.state.condition[def.id] ?? 1;

  // --- picture -------------------------------------------------------------
  const hero = el('div', 'detail-hero');
  hero.textContent = def.icon;
  hero.style.setProperty('--card-accent', RARITY_COLOR[tierOf(def, level)]);
  out.push(hero);

  out.push(el('p', undefined, def.desc));

  // --- numbers -------------------------------------------------------------
  const tiles = [
    statTile(`${level} / ${def.maxCount}`, isMachine ? 'Ausbaustufe' : 'Anzahl'),
    statTile(money(nextCost(game.state, def.id)), 'Nächste Stufe'),
  ];

  const output = effectSummary(def.effects, isMachine ? levelMultiplier(Math.min(level, MACHINES.maxLevel)) : level);
  if (output.rate) tiles.push(statTile(output.rate, 'Leistung'));
  if (output.power) tiles.push(statTile(output.power, 'Stromverbrauch'));
  if (def.upkeep) tiles.push(statTile(rate(def.upkeep * Math.max(1, level), ' €/s'), 'Unterhalt'));
  if (def.salary) tiles.push(statTile(rate(def.salary * Math.max(1, level), ' €/s'), 'Gehalt'));
  out.push(statGrid(...tiles));

  // --- maintenance ---------------------------------------------------------
  if (isMachine && level > 0) {
    const card = el('div', 'card');
    const cardBody = el('div', 'card-body');
    const title = el('div', 'card-title');
    title.appendChild(document.createTextNode('Wartungszustand'));
    title.appendChild(badge(`${Math.round(condition * 100)} %`, toneOf(condition)));
    cardBody.appendChild(title);
    cardBody.appendChild(progressBar(condition, toneOf(condition)));
    cardBody.appendChild(
      el(
        'div',
        'card-desc',
        `Leistung ${Math.round(conditionFactor(condition) * 100)} % · Wiederherstellung kostet ${money(
          investedIn(game, def) * MACHINES.wear.serviceCostFactor * (1 - condition),
        )}`,
      ),
    );
    cardBody.appendChild(
      statusIndicator(
        condition >= MACHINES.wear.warnBelow ? 'Läuft' : 'Wartung empfohlen',
        condition >= MACHINES.wear.warnBelow ? 'good' : 'warn',
      ),
    );
    card.appendChild(cardBody);
    out.push(card);
  }

  // --- upgrade -------------------------------------------------------------
  if (level < def.maxCount) {
    const preview = isMachine
      ? `Stufe ${level + 1}: ×${levelMultiplier(Math.min(level + 1, MACHINES.maxLevel)).toFixed(2)} Leistung`
      : 'Eine weitere Einheit';
    out.push(
      infoCard({
        icon: '⬆️',
        title: 'Ausbauen',
        subtitle: preview,
        actions: [
          primaryButton({
            label: 'Kaufen',
            icon: '💶',
            hint: money(nextCost(game.state, def.id)),
            disabled: !game.canBuy(def.id),
            onClick: () => {
              if (game.buyPurchasable(def.id)) afterBuy();
            },
          }),
        ],
      }),
    );
  } else {
    out.push(el('div', 'card-note', '✔ Endstufe erreicht.'));
  }

  return out;
}

/** Rarity of an entry: machines climb tiers as they are levelled. */
function tierOf(def: PurchasableDef, level: number): RarityTier {
  if (def.category !== 'machine') return 'common';
  if (level >= MACHINES.maxLevel) return 'mythic';
  if (level >= 8) return 'legendary';
  if (level >= 6) return 'epic';
  if (level >= 4) return 'rare';
  if (level >= 2) return 'uncommon';
  return 'common';
}

function toneOf(condition: number): 'good' | 'warn' | 'bad' {
  if (condition >= MACHINES.wear.warnBelow) return 'good';
  return condition >= 0.4 ? 'warn' : 'bad';
}

/** Reads production and power straight out of the effect descriptors. */
function effectSummary(effects: readonly Effect[], scale: number): { rate?: string; power?: string } {
  let work = 0;
  let power = 0;
  let sell = 0;
  let buy = 0;
  for (const effect of effects) {
    if (effect.kind === 'teardownRate') work += effect.amount * scale;
    else if (effect.kind === 'powerUse') power += effect.amount * scale;
    else if (effect.kind === 'autoSell') sell += effect.unitsPerSec * scale;
    else if (effect.kind === 'autoBuy') buy += effect.perMinute * scale;
  }
  const parts: string[] = [];
  if (work > 0) parts.push(`${fmt(work)}/s`);
  if (sell > 0) parts.push(`${fmt(sell)}/s Verkauf`);
  if (buy > 0) parts.push(`${fmt(buy)}/min Ankauf`);
  return {
    rate: parts.length ? parts.join(' · ') : undefined,
    power: power > 0 ? `${fmt(power)} kW` : undefined,
  };
}
