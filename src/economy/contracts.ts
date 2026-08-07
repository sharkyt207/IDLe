import { Content } from '../data';
import { ECONOMY } from '../data/economy';
import type { ContractDef } from '../data/trade';
import type { Game } from '../game/game';
import type { ActiveContract, ContractOffer } from '../game/state';
import { removeFromStorage } from './inventory';
import { unitPrice } from './market';

/**
 * Contract system: long-term customers.
 *
 * An offer asks for materials and pays a lump sum plus a recurring income for
 * a while - the "regelmäßiges Einkommen" from the GDD. Demand scales with the
 * player's level so a contract stays a real order rather than pocket change.
 */

let counter = 0;

function eligible(game: Game): ContractDef[] {
  return Content.contracts.filter((def) => (def.requires?.level ?? 0) <= game.state.level);
}

/** Value of a demand list at current prices - the basis for the reward. */
function demandValue(game: Game, demand: { material: string; amount: number }[]): number {
  return demand.reduce(
    (sum, entry) => sum + entry.amount * Math.max(0.01, unitPrice(game.state, game.stats, entry.material)),
    0,
  );
}

function makeOffer(game: Game, def: ContractDef): ContractOffer {
  const scale = def.scaleWithLevel ? 1 + Math.max(0, game.state.level - (def.requires?.level ?? 1)) * 0.35 : 1;
  const demand = def.demand.map((entry) => ({
    material: entry.material,
    amount: Math.max(1, Math.round(entry.amount * scale)),
  }));
  const reward = demandValue(game, demand) * ECONOMY.contracts.rewardFactor;
  const recurring = reward * ECONOMY.contracts.recurringShare;

  return {
    key: `${def.id}#${++counter}`,
    defId: def.id,
    demand,
    payout: Math.round(reward - recurring),
    income: recurring / ECONOMY.contracts.incomeSeconds,
  };
}

/** Rotates the offer board. */
export function refreshOffers(game: Game): void {
  const pool = eligible(game);
  const trade = game.state.trade;
  trade.offers = [];
  if (pool.length === 0) return;

  const picked = new Set<string>();
  for (let i = 0; i < ECONOMY.contracts.maxOffers && picked.size < pool.length; i++) {
    const def = pool[Math.floor(Math.random() * pool.length)];
    if (picked.has(def.id)) continue;
    picked.add(def.id);
    trade.offers.push(makeOffer(game, def));
  }
  trade.offerTimer = ECONOMY.contracts.offerRefreshSeconds;
}

export function canAccept(game: Game): boolean {
  return game.state.trade.active.length < ECONOMY.contracts.maxActive;
}

export function acceptOffer(game: Game, key: string): boolean {
  const trade = game.state.trade;
  if (!canAccept(game)) return false;
  const index = trade.offers.findIndex((o) => o.key === key);
  if (index < 0) return false;
  const [offer] = trade.offers.splice(index, 1);
  trade.active.push({ ...offer, delivered: {}, incomeLeft: 0, done: false });
  game.bus.emit('notice', { text: 'Auftrag angenommen', icon: '📝', tone: 'good' });
  game.bus.emit('changed', undefined);
  return true;
}

export function abandon(game: Game, key: string): void {
  const trade = game.state.trade;
  trade.active = trade.active.filter((c) => c.key !== key);
  game.bus.emit('changed', undefined);
}

/** How much of the contract is covered so far, 0…1. */
export function progressOf(contract: ActiveContract): number {
  const total = contract.demand.reduce((sum, d) => sum + d.amount, 0);
  const have = contract.demand.reduce(
    (sum, d) => sum + Math.min(d.amount, contract.delivered[d.material] ?? 0),
    0,
  );
  return total > 0 ? have / total : 0;
}

/** Ships whatever the yard can spare into the contract. */
export function deliver(game: Game, key: string): boolean {
  const contract = game.state.trade.active.find((c) => c.key === key);
  if (!contract || contract.done) return false;

  let moved = 0;
  for (const entry of contract.demand) {
    const missing = entry.amount - (contract.delivered[entry.material] ?? 0);
    if (missing <= 0) continue;
    const taken = removeFromStorage(game.state, entry.material, missing);
    if (taken > 0) {
      contract.delivered[entry.material] = (contract.delivered[entry.material] ?? 0) + taken;
      moved += taken;
    }
  }
  if (moved === 0) {
    game.bus.emit('notice', { text: 'Kein passendes Material im Lager.', icon: '📦', tone: 'warn' });
    return false;
  }

  const complete = contract.demand.every((d) => (contract.delivered[d.material] ?? 0) >= d.amount);
  if (complete) {
    contract.done = true;
    contract.incomeLeft = ECONOMY.contracts.incomeSeconds;
    game.addMoney(contract.payout);
    const def = Content.contract(contract.defId);
    game.bus.emit('notice', {
      text: `${def?.client ?? 'Kunde'} beliefert — Vertrag läuft`,
      icon: '🤝',
      tone: 'good',
    });
  }
  game.bus.emit('changed', undefined);
  game.bus.emit('progress', undefined);
  return true;
}

/** Pays out running contracts and rotates the offer board. */
export function tickContracts(game: Game, dt: number): void {
  const trade = game.state.trade;

  trade.offerTimer -= dt;
  if (trade.offerTimer <= 0 || trade.offers.length === 0) refreshOffers(game);

  for (const contract of trade.active) {
    if (!contract.done || contract.incomeLeft <= 0) continue;
    const seconds = Math.min(dt, contract.incomeLeft);
    contract.incomeLeft -= seconds;
    game.addMoney(contract.income * seconds);
  }

  const finished = trade.active.filter((c) => c.done && c.incomeLeft <= 0);
  if (finished.length > 0) {
    trade.active = trade.active.filter((c) => !finished.includes(c));
    for (const c of finished) {
      const def = Content.contract(c.defId);
      game.bus.emit('notice', {
        text: `Vertrag mit ${def?.client ?? 'Kunde'} ausgelaufen`,
        icon: '📄',
        tone: 'info',
      });
    }
  }
}

/**
 * Materials an accepted contract still needs.
 *
 * Selling automation skips these: a conveyor quietly shipping off the steel
 * the player just promised a customer is a trap, not a decision.
 */
export function reservedMaterials(game: Game): Set<string> {
  const reserved = new Set<string>();
  for (const contract of game.state.trade.active) {
    if (contract.done) continue;
    for (const entry of contract.demand) {
      if ((contract.delivered[entry.material] ?? 0) < entry.amount) reserved.add(entry.material);
    }
  }
  return reserved;
}

/** Total recurring income currently flowing, for the UI. */
export function recurringIncome(game: Game): number {
  return game.state.trade.active.reduce((sum, c) => sum + (c.done && c.incomeLeft > 0 ? c.income : 0), 0);
}
