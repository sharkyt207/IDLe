import { BALANCE } from '../data/balance';
import { Content } from '../data';
import { EventBus } from '../core/events';
import { chance, randInt } from '../core/rng';
import { computeStats, meetsRequirement, nextCost, nextPerkCost, type Stats } from './stats';
import { createInitialState, owned, storedTotal, xpForLevel, type ActiveVehicle, type GameState } from './state';
import { runLogistics } from './systems/logistics';
import { runProcessing } from './systems/processing';
import { runAutoSell, sellUnits } from './systems/market';
import { applyTeardownWork } from './systems/teardown';

/**
 * The game orchestrator. Owns the state, the derived stats and the fixed-step
 * simulation. Systems are pure-ish functions that take this instance; UI never
 * mutates state directly, it calls the action methods below.
 */
export class Game {
  state: GameState;
  stats: Stats;
  readonly bus = new EventBus();

  /** Fractional vehicles the logistics automation has accumulated. */
  autoBuyCredit = 0;
  /** Fractional crafts per recipe. */
  processCredit: Record<string, number> = {};
  /** Fractional units the sorting automation has accumulated. */
  autoSellCredit = 0;

  private lastFullNotice = 0;

  constructor(state?: GameState) {
    if (state) {
      this.state = state;
      this.stats = computeStats(this.state);
    } else {
      this.state = createInitialState();
      this.stats = computeStats(this.state);
      // A new company starts with one delivery already on the pad, so the
      // first tap works before the player has bought anything.
      this.loadVehicle(BALANCE.start.starterVehicle);
    }
  }

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  /** Recomputes stats after any inventory/research/perk change. */
  recompute(): void {
    this.stats = computeStats(this.state);
    this.bus.emit('changed', undefined);
  }

  /**
   * Market drift: deterministic from playtime, so the price the player sees is
   * identical before and after a reload.
   */
  marketFactor(materialId: string): number {
    let hash = 0;
    for (let i = 0; i < materialId.length; i++) hash = (hash * 31 + materialId.charCodeAt(i)) % 1000;
    const phase = (hash / 1000) * Math.PI * 2;
    const t = (this.state.playtime / BALANCE.market.cycleSeconds) * Math.PI * 2;
    return 1 + BALANCE.market.amplitude * Math.sin(t + phase);
  }

  /** Current sell price for one unit, multipliers and drift included. */
  sellPrice(materialId: string): number {
    const def = Content.material(materialId);
    if (!def) return 0;
    return def.basePrice * this.marketFactor(materialId) * this.stats.mult.sellPrice;
  }

  /** Current purchase price of a delivery. */
  buyPrice(vehicleId: string): number {
    const def = Content.vehicle(vehicleId);
    if (!def) return Infinity;
    return Math.ceil(def.price * this.stats.mult.buyPrice);
  }

  storageUsed(): number {
    return storedTotal(this.state);
  }

  storageFree(): number {
    return Math.max(0, this.stats.storage - this.storageUsed());
  }

  isUnlocked(vehicleId: string): boolean {
    const def = Content.vehicle(vehicleId);
    return !!def && meetsRequirement(this.state, this.stats, def.requires);
  }

  /** Reputation the player would gain by restarting the company now. */
  prestigeGain(): number {
    const { divisor, exponent } = BALANCE.prestige;
    if (this.state.runEarned <= 0) return 0;
    return Math.floor(Math.pow(this.state.runEarned / divisor, exponent));
  }

  canPrestige(): boolean {
    return (
      this.state.level >= BALANCE.prestige.requiredLevel &&
      this.prestigeGain() >= BALANCE.prestige.minReputation
    );
  }

  // -------------------------------------------------------------------------
  // Resource helpers
  // -------------------------------------------------------------------------

  addMoney(amount: number): void {
    if (amount <= 0) return;
    this.state.money += amount;
    this.state.runEarned += amount;
    this.state.lifetimeEarned += amount;
  }

  spendMoney(amount: number): boolean {
    if (this.state.money < amount) return false;
    this.state.money -= amount;
    return true;
  }

  /**
   * Adds material to storage. Anything above capacity is sold on the spot at
   * the automation price - material is never destroyed (GDD: no punishment),
   * but a full yard costs margin, which keeps storage upgrades worth buying.
   */
  addMaterial(materialId: string, amount: number): void {
    if (amount <= 0) return;
    const free = this.storageFree();
    const fits = Math.min(amount, free);
    if (fits > 0) this.state.storage[materialId] = (this.state.storage[materialId] ?? 0) + fits;

    const overflow = amount - fits;
    if (overflow <= 0) return;

    const value = overflow * this.sellPrice(materialId) * BALANCE.overflowPriceFactor;
    this.addMoney(value);
    this.addXp(value * BALANCE.xpPerEuroSold);
    this.bus.emit('sold', { amount: value, auto: true });
    this.noticeStorageFull();
  }

  private noticeStorageFull(): void {
    const now = Date.now();
    if (now - this.lastFullNotice < 12_000) return;
    this.lastFullNotice = now;
    this.bus.emit('notice', {
      text: 'Lager voll! Überschuss geht als Notverkauf raus (−25 %).',
      icon: '📦',
      tone: 'warn',
    });
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    this.state.xp += amount * this.stats.mult.xpGain;
    let levelled = false;
    while (this.state.xp >= xpForLevel(this.state.level)) {
      this.state.xp -= xpForLevel(this.state.level);
      this.state.level++;
      levelled = true;
      this.bus.emit('levelUp', { level: this.state.level });
    }
    if (levelled) this.recompute();
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  /** Manual dismantling. Returns the work actually applied. */
  tap(partId: string): number {
    if (!this.state.active) return 0;
    this.state.progressStats.taps++;
    const applied = applyTeardownWork(this, this.stats.tapPower, partId);
    this.bus.emit('progress', undefined);
    return applied;
  }

  /** Buys one delivery into the waiting queue. */
  buyVehicle(vehicleId: string, silent = false): boolean {
    const def = Content.vehicle(vehicleId);
    if (!def || !this.isUnlocked(vehicleId)) return false;
    if (this.state.queue.length >= this.stats.queueSlots && this.state.active) return false;

    const price = this.buyPrice(vehicleId);
    if (!this.spendMoney(price)) {
      if (!silent) {
        this.bus.emit('notice', { text: 'Nicht genug Geld für diese Lieferung.', icon: '💸', tone: 'warn' });
      }
      return false;
    }

    if (!this.state.active) this.loadVehicle(vehicleId);
    else this.state.queue.push(vehicleId);

    this.bus.emit('delivery', { vehicleId: def.id });
    if (!silent) {
      this.state.progressStats.purchases++;
      this.bus.emit('notice', { text: `${def.name} angeliefert`, icon: def.icon, tone: 'good' });
    }
    this.bus.emit('changed', undefined);
    this.bus.emit('progress', undefined);
    return true;
  }

  /** Puts a delivery on the dismantling pad. */
  loadVehicle(vehicleId: string): void {
    const def = Content.vehicle(vehicleId);
    if (!def) return;
    const active: ActiveVehicle = {
      defId: def.id,
      parts: def.parts.map((p) => ({ id: p.id, work: 0, done: false })),
    };
    this.state.active = active;
  }

  /** Pulls the next delivery from the queue onto the pad, if any. */
  loadNextFromQueue(): void {
    if (this.state.active) return;
    const next = this.state.queue.shift();
    if (next) this.loadVehicle(next);
  }

  /** Called by the teardown system once every part is off. */
  completeVehicle(): void {
    const active = this.state.active;
    if (!active) return;
    const def = Content.vehicle(active.defId);
    this.state.active = null;
    if (!def) return;

    this.state.progressStats.vehiclesDone++;
    if (!this.state.progressStats.discovered.includes(def.id)) {
      this.state.progressStats.discovered.push(def.id);
    }

    for (const find of def.rareFinds ?? []) {
      if (chance(Math.min(0.95, find.chance * this.stats.mult.rareFind))) {
        this.addMaterial(find.material, find.amount);
        this.bus.emit('notice', { text: find.label, icon: '✨', tone: 'good' });
      }
    }

    this.addXp(def.xp);
    this.bus.emit('vehicleDone', { vehicleId: def.id, xp: def.xp });
    this.loadNextFromQueue();
    this.bus.emit('progress', undefined);
  }

  /** Sells stored material at the full manual price. */
  sellMaterial(materialId: string, amount?: number): number {
    const have = this.state.storage[materialId] ?? 0;
    const value = sellUnits(this, materialId, amount ?? have, 1, false);
    if (value > 0) {
      this.state.progressStats.sales++;
      this.bus.emit('changed', undefined);
      this.bus.emit('progress', undefined);
    }
    return value;
  }

  /** Sells everything that is not locked for processing. */
  sellAll(): number {
    let total = 0;
    for (const id of Object.keys({ ...this.state.storage })) {
      if (this.state.autoSellLocked[id]) continue;
      total += this.sellMaterial(id);
    }
    if (total > 0) {
      this.bus.emit('notice', { text: `Alles verkauft`, icon: '💶', tone: 'good' });
    }
    return total;
  }

  canBuy(id: string): boolean {
    const def = Content.purchasable(id);
    if (!def) return false;
    if (owned(this.state, id) >= def.maxCount) return false;
    if (!meetsRequirement(this.state, this.stats, def.requires)) return false;
    return this.state.money >= nextCost(this.state, id);
  }

  /** Buys one copy/level of a tool, machine, employee or building. */
  buyPurchasable(id: string): boolean {
    const def = Content.purchasable(id);
    if (!def || !this.canBuy(id)) return false;
    const cost = nextCost(this.state, id);
    if (!this.spendMoney(cost)) return false;
    this.state.owned[id] = owned(this.state, id) + 1;
    this.recompute();
    if (def.category === 'lot') this.bus.emit('lotBought', { lotId: def.id });
    this.bus.emit('notice', { text: `${def.name} gekauft`, icon: def.icon, tone: 'good' });
    this.bus.emit('progress', undefined);
    return true;
  }

  canResearch(id: string): boolean {
    const node = Content.researchNode(id);
    if (!node) return false;
    if (this.state.research.done.includes(id)) return false;
    if (this.state.research.active) return false;
    if (!this.stats.unlocks.has('research')) return false;
    if (!meetsRequirement(this.state, this.stats, node.requires)) return false;
    return this.state.money >= node.cost;
  }

  startResearch(id: string): boolean {
    const node = Content.researchNode(id);
    if (!node || !this.canResearch(id)) return false;
    if (!this.spendMoney(node.cost)) return false;
    if (node.duration <= 0) {
      this.finishResearch(id);
    } else {
      this.state.research.active = { id, remaining: node.duration };
      this.bus.emit('notice', { text: `Forschung gestartet: ${node.name}`, icon: '🔬', tone: 'info' });
    }
    this.bus.emit('changed', undefined);
    return true;
  }

  finishResearch(id: string): void {
    const node = Content.researchNode(id);
    if (!node) return;
    if (!this.state.research.done.includes(id)) this.state.research.done.push(id);
    this.state.research.active = null;
    this.recompute();
    this.bus.emit('notice', { text: `Forschung fertig: ${node.name}`, icon: '🔬', tone: 'good' });
    this.bus.emit('progress', undefined);
  }

  buyPerk(id: string): boolean {
    const perk = Content.perk(id);
    if (!perk) return false;
    const level = this.state.prestige.perks[id] ?? 0;
    if (level >= perk.maxLevel) return false;
    const cost = nextPerkCost(this.state, id);
    if (this.state.prestige.reputation < cost) return false;
    this.state.prestige.reputation -= cost;
    this.state.prestige.perks[id] = level + 1;
    this.recompute();
    this.bus.emit('notice', { text: `${perk.name} verbessert`, icon: perk.icon, tone: 'good' });
    return true;
  }

  /** Restarts the company, keeping reputation and perks. */
  doPrestige(): boolean {
    if (!this.canPrestige()) return false;
    const gain = this.prestigeGain();
    const carried = {
      reputation: this.state.prestige.reputation + gain,
      perks: { ...this.state.prestige.perks },
      runs: this.state.prestige.runs + 1,
      bestRun: Math.max(this.state.prestige.bestRun, this.state.runEarned),
    };
    const lifetime = this.state.lifetimeEarned;
    const discovered = this.state.progressStats.discovered;
    const settings = this.state.settings;

    this.state = createInitialState(carried);
    this.state.lifetimeEarned = lifetime;
    this.state.progressStats.discovered = discovered;
    this.state.settings = settings;
    this.state.tutorial = { step: 0, done: true, choiceOffered: true };

    this.autoBuyCredit = 0;
    this.autoSellCredit = 0;
    this.processCredit = {};

    this.recompute();
    this.loadVehicle(BALANCE.start.starterVehicle);
    this.bus.emit('notice', { text: `Neues Unternehmen gegründet: +${gain} Reputation`, icon: '🏆', tone: 'good' });
    this.bus.emit('progress', undefined);
    return true;
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  /**
   * One simulation step.
   * @param dt seconds
   * @param efficiency scales automated output (offline progress runs reduced)
   */
  tick(dt: number, efficiency = 1): void {
    if (dt <= 0) return;
    this.state.playtime += dt;

    // Research timer
    const active = this.state.research.active;
    if (active) {
      active.remaining -= dt;
      if (active.remaining <= 0) this.finishResearch(active.id);
    }

    runLogistics(this, dt, efficiency);

    if (this.state.active && this.stats.teardownRate > 0) {
      applyTeardownWork(this, this.stats.teardownRate * dt * efficiency);
    }

    runProcessing(this, dt, efficiency);
    runAutoSell(this, dt, efficiency);
  }

  /** Random yield roll for one part. Exposed for the teardown system. */
  rollYield(min: number, max: number): number {
    return randInt(min, max);
  }
}
