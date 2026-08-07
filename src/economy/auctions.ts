import { Content } from '../data';
import { ECONOMY } from '../data/economy';
import type { AuctionLotDef } from '../data/trade';
import { vehicleValue } from '../data/vehicles';
import type { Game } from '../game/game';
import { addToStorage } from './inventory';
import { unitPrice } from './market';

/**
 * Auction system: bidding against AI companies.
 *
 * A lot opens every few minutes, the AI counter-bids up to a hidden ceiling,
 * and whoever leads when the clock runs out takes it. Because the ceiling sits
 * below the lot's real value, patience is rewarded - but so is knowing when to
 * stop.
 */

function eligibleLots(game: Game): AuctionLotDef[] {
  return Content.auctionLots.filter((lot) => {
    if ((lot.requires?.level ?? 0) > game.state.level) return false;
    return (lot.vehicles ?? []).every((v) => !!Content.vehicle(v.id));
  });
}

/** Market value of everything inside a lot. */
export function lotValue(game: Game, lot: AuctionLotDef): number {
  let value = 0;
  for (const entry of lot.vehicles ?? []) {
    const def = Content.vehicle(entry.id);
    if (def) value += vehicleValue(def.parts) * entry.count;
  }
  for (const entry of lot.materials ?? []) {
    value += entry.amount * Math.max(0, unitPrice(game.state, game.stats, entry.material));
  }
  return value;
}

export function openLot(game: Game): void {
  const pool = eligibleLots(game);
  if (pool.length === 0) return;
  const lot = pool[Math.floor(Math.random() * pool.length)];
  const value = lotValue(game, lot);
  if (value <= 0) return;

  const [minFactor, maxFactor] = ECONOMY.auctions.aiMaxFactor;
  const start = Math.ceil(value * ECONOMY.auctions.startFactor);

  game.state.trade.auction = {
    lotId: lot.id,
    value,
    bid: start,
    increment: Math.max(1, Math.ceil(start * ECONOMY.auctions.increment)),
    playerLeads: false,
    timeLeft: ECONOMY.auctions.durationSeconds,
    aiThink: 3,
    aiMax: value * (minFactor + Math.random() * (maxFactor - minFactor)),
  };
  game.bus.emit('notice', { text: `Auktion: ${lot.name}`, icon: '🔨', tone: 'info' });
  game.bus.emit('changed', undefined);
}

/** The player raises. Money is only taken when the lot is actually won. */
export function placeBid(game: Game): boolean {
  const auction = game.state.trade.auction;
  if (!auction) return false;
  const next = auction.playerLeads ? auction.bid : auction.bid + auction.increment;
  if (game.state.money < next) {
    game.bus.emit('notice', { text: 'Nicht genug Geld für dieses Gebot.', icon: '💸', tone: 'warn' });
    return false;
  }
  auction.bid = next;
  auction.playerLeads = true;
  // A contested lot gets a little more time, so a duel can actually happen.
  auction.timeLeft = Math.max(auction.timeLeft, 8);
  game.bus.emit('changed', undefined);
  return true;
}

export function tickAuctions(game: Game, dt: number): void {
  const trade = game.state.trade;

  if (!trade.auction) {
    trade.auctionTimer -= dt;
    if (trade.auctionTimer <= 0) {
      trade.auctionTimer = ECONOMY.auctions.intervalSeconds;
      openLot(game);
    }
    return;
  }

  const auction = trade.auction;
  auction.timeLeft -= dt;
  auction.aiThink -= dt;

  // AI counter-bid.
  if (auction.playerLeads && auction.aiThink <= 0) {
    const [minThink, maxThink] = ECONOMY.auctions.aiThinkSeconds;
    auction.aiThink = minThink + Math.random() * (maxThink - minThink);
    const next = auction.bid + auction.increment;
    if (next <= auction.aiMax) {
      auction.bid = next;
      auction.playerLeads = false;
    }
  }

  if (auction.timeLeft > 0) return;

  const lot = Content.auctionLot(auction.lotId);
  if (auction.playerLeads && lot && game.spendMoney(auction.bid)) {
    awardLot(game, lot);
    game.bus.emit('notice', {
      text: `Zuschlag: ${lot.name} für ${Math.round(auction.bid).toLocaleString('de-DE')} €`,
      icon: '🏅',
      tone: 'good',
    });
  } else if (auction.playerLeads) {
    game.bus.emit('notice', { text: 'Zuschlag verfallen — Geld fehlte.', icon: '💸', tone: 'warn' });
  } else {
    game.bus.emit('notice', { text: 'Auktion verloren.', icon: '🔨', tone: 'info' });
  }

  trade.auction = null;
  trade.auctionTimer = ECONOMY.auctions.intervalSeconds;
  game.bus.emit('changed', undefined);
  game.bus.emit('progress', undefined);
}

function awardLot(game: Game, lot: AuctionLotDef): void {
  for (const entry of lot.vehicles ?? []) {
    for (let i = 0; i < entry.count; i++) {
      if (!game.state.active) game.loadVehicle(entry.id);
      else game.state.queue.push(entry.id);
      game.bus.emit('delivery', { vehicleId: entry.id });
    }
  }
  for (const entry of lot.materials ?? []) {
    game.addMaterial(entry.material, entry.amount);
  }
  void addToStorage;
}
