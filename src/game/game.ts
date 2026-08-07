import { BALANCE } from '../data/balance';
import { Content } from '../data';
import { EventBus } from '../core/events';
import { chance, randInt } from '../core/rng';
import { computeStats, meetsRequirement, nextCost, type Stats } from './stats';
import { createInitialState, owned, storedTotal, xpForLevel, type ActiveVehicle, type GameState } from './state';
import { runLogistics } from './systems/logistics';
import { runProcessing } from './systems/processing';
import { runAutoSell, sellUnits } from './systems/market';
import { applyTeardownWork } from './systems/teardown';
import { runMaintenance } from './systems/maintenance';
import { addToStorage } from '../economy/inventory';
import { drift, isDisposal, unitPrice } from '../economy/market';
import { addToCollection, rollFind } from '../economy/collection';
import { companyValue, tickEconomy } from '../economy/manager';
import { reservedMaterials } from '../economy/contracts';
import { payrollFactor, tickPayroll } from '../company/payroll';
import { tickMetrics } from '../company/statistics';
import { sellableAmount } from '../company/warehouse';
import {
  canStart as canStartResearch,
  finishResearch,
  startResearch,
  tickResearch,
} from '../progress/research';
import { buyPerk, canPrestige, doPrestige, pointsGain } from '../progress/prestige';
import { check as checkAchievements, tickAchievements } from '../progress/achievements';
import { refreshMissions, resetTimedMissions, tickMissions } from '../missions/manager';
import { checkMilestones, tickMilestones } from '../missions/milestones';
import { resetHints, tickHints } from '../missions/hints';
import { resetEvents, tickEvents } from './systems/events';

/**
 * Largest value any running total may reach. Well below `Number.MAX_VALUE`, so
 * a few more additions or a multiplication still stay finite.
 */
const MAX_VALUE = 1e280;

function clampTotal(value: number): number {
  return Number.isFinite(value) ? Math.min(value, MAX_VALUE) : MAX_VALUE;
}

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
  /** Wear changes stats constantly; rebuild at most a few times a second. */
  private statsDirty = false;
  private statsTimer = 0;

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
    this.statsDirty = false;
    this.bus.emit('changed', undefined);
  }

  /** Flags a cheap stat change (wear) for the next throttled rebuild. */
  markStatsDirty(): void {
    this.statsDirty = true;
  }

  /**
   * Sets the company focus (GDD chapter 6). It is a plain effect source, so the
   * switch is instant and free - the player is meant to retune, not to commit.
   */
  setPriority(id: string): void {
    const def = Content.priority(id);
    if (!def || this.state.priority === id) return;
    this.state.priority = id;
    this.recompute();
    this.bus.emit('notice', { text: `Ausrichtung: ${def.name}`, icon: def.icon, tone: 'info' });
  }

  /**
   * Market drift: deterministic from playtime, so the price the player sees is
   * identical before and after a reload.
   */
  marketFactor(materialId: string): number {
    return drift(materialId, this.state.playtime);
  }

  /**
   * Current price for one unit: market drift, pile quality and multipliers.
   * Negative for hazardous material that still has to be disposed of.
   */
  sellPrice(materialId: string): number {
    return unitPrice(this.state, this.stats, materialId);
  }

  /** True while this material costs money to get rid of. */
  isDisposal(materialId: string): boolean {
    return isDisposal(materialId, this.stats);
  }

  /** Firmenwert: assets, stock, staff, research and collection. */
  companyValue(): number {
    return companyValue(this);
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


  // -------------------------------------------------------------------------
  // Resource helpers
  // -------------------------------------------------------------------------

  addMoney(amount: number): void {
    if (!(amount > 0)) return;
    // Idle curves are exponential by design, but a value that reaches Infinity
    // turns into NaN on the next subtraction and takes the save with it. Every
    // running total is therefore clamped to a large-but-finite ceiling.
    const gain = Math.min(amount, MAX_VALUE);
    this.state.money = clampTotal(this.state.money + gain);
    this.state.runEarned = clampTotal(this.state.runEarned + gain);
    this.state.lifetimeEarned = clampTotal(this.state.lifetimeEarned + gain);
    this.state.metrics.dayEarned = clampTotal(this.state.metrics.dayEarned + gain);
  }

  spendMoney(amount: number): boolean {
    if (this.state.money < amount) return false;
    this.state.money -= amount;
    this.state.metrics.daySpent += amount;
    return true;
  }

  /**
   * Adds material to storage. Anything above capacity is sold on the spot at
   * the automation price - material is never destroyed (GDD: no punishment),
   * but a full yard costs margin, which keeps storage upgrades worth buying.
   */
  addMaterial(materialId: string, amount: number): void {
    if (!(amount > 0)) return;
    amount = Math.min(amount, MAX_VALUE);
    const free = this.storageFree();
    const fits = Math.min(amount, free);
    if (fits > 0) addToStorage(this.state, materialId, fits, this.rollQuality());
    this.state.metrics.unitsRecycled = clampTotal(this.state.metrics.unitsRecycled + amount);
    const totals = this.state.progressStats.materials;
    totals[materialId] = clampTotal((totals[materialId] ?? 0) + amount);

    const overflow = amount - fits;
    if (overflow <= 0) return;

    const value = overflow * this.sellPrice(materialId) * BALANCE.overflowPriceFactor;
    if (value > 0) {
      this.addMoney(value);
      this.addXp(value * BALANCE.xpPerEuroSold);
      this.bus.emit('sold', { amount: value, auto: true });
    } else {
      // Hazardous overflow is disposed of at the player's expense.
      this.state.money = Math.max(0, this.state.money + value);
    }
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

  /** Quality of freshly produced material - the machines' average, jittered. */
  rollQuality(): number {
    const jitter = (Math.random() - 0.5) * 0.12;
    return Math.max(0, Math.min(1, this.stats.quality + jitter));
  }

  addXp(amount: number): void {
    if (!(amount > 0)) return;
    this.state.xp = clampTotal(this.state.xp + Math.min(amount * this.stats.mult.xpGain, MAX_VALUE));
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
  /**
   * @param silent skips the toast and the manual-purchase counter
   * @param free the delivery is a gift (random event) - no money changes hands
   */
  buyVehicle(vehicleId: string, silent = false, free = false): boolean {
    const def = Content.vehicle(vehicleId);
    if (!def || !this.isUnlocked(vehicleId)) return false;
    if (this.state.queue.length >= this.stats.queueSlots && this.state.active) return false;

    const price = free ? 0 : this.buyPrice(vehicleId);
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

    const find = rollFind(this, def.vehicleClass);
    if (find) {
      addToCollection(this, find.id);
      this.bus.emit('notice', { text: `Fundstück: ${find.name}`, icon: find.icon, tone: 'good' });
      this.bus.emit('found', { collectibleId: find.id });
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

  /** Sells everything that is neither locked nor promised to a customer. */
  sellAll(): number {
    const reserved = reservedMaterials(this);
    let total = 0;
    for (const id of Object.keys({ ...this.state.storage })) {
      if (reserved.has(id)) continue;
      // Standing orders (keep N, never sell) apply to "sell everything" too.
      const sellable = sellableAmount(this, id);
      if (sellable <= 0) continue;
      total += this.sellMaterial(id, sellable);
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
    // The encyclopedia only shows what the player has met (GDD chapter 10).
    // Recorded here rather than derived from `owned` so a prestige restart
    // does not un-discover half the book.
    if (!this.state.missions.seen.includes(id)) this.state.missions.seen.push(id);
    this.recompute();
    if (def.category === 'lot') this.bus.emit('lotBought', { lotId: def.id });
    if (def.building) this.bus.emit('built', { defId: def.id });
    this.bus.emit('notice', { text: `${def.name} gekauft`, icon: def.icon, tone: 'good' });
    this.bus.emit('progress', undefined);
    return true;
  }

  // -------------------------------------------------------------------------
  // Long-term progression (GDD chapter 7)
  //
  // The orchestrator only forwards here: research, prestige and achievements
  // each own their rules in `src/progress/`, so they can be tested and
  // extended without touching the game loop.
  // -------------------------------------------------------------------------

  canResearch(id: string): boolean {
    return canStartResearch(this, id);
  }

  startResearch(id: string): boolean {
    return startResearch(this, id);
  }

  finishResearch(id: string, level = (this.state.research.techs[id] ?? 0) + 1): void {
    finishResearch(this, id, level);
  }

  /** Level the player has reached in one technology. */
  techLevel(id: string): number {
    return this.state.research.techs[id] ?? 0;
  }

  buyPerk(id: string): boolean {
    return buyPerk(this, id);
  }

  /** Industriepunkte a restart would pay out right now. */
  prestigeGain(): number {
    return pointsGain(this);
  }

  canPrestige(): boolean {
    return canPrestige(this);
  }

  /** Restarts the company, keeping Industriepunkte, the tree and achievements. */
  doPrestige(): boolean {
    const gain = this.prestigeGain();
    if (!doPrestige(this)) return false;

    this.autoBuyCredit = 0;
    this.autoSellCredit = 0;
    this.processCredit = {};
    resetEvents();
    resetHints();
    // The company is small again, so the daily goals have to be re-scaled to
    // it - a "verdiene 4 Mio heute" left over from the old run is not a goal.
    resetTimedMissions(this);

    this.recompute();
    this.loadVehicle(BALANCE.start.starterVehicle);
    checkAchievements(this);
    refreshMissions(this);
    checkMilestones(this);
    this.bus.emit('notice', {
      text: `Neues Unternehmen gegründet: +${gain} Industriepunkte`,
      icon: '🏆',
      tone: 'good',
    });
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

    tickResearch(this, dt, efficiency);

    runLogistics(this, dt, efficiency);

    if (this.state.active && this.stats.teardownRate > 0) {
      applyTeardownWork(this, this.stats.teardownRate * dt * efficiency * payrollFactor(this));
    }

    runProcessing(this, dt, efficiency);
    runAutoSell(this, dt, efficiency);
    tickEconomy(this, dt, efficiency);

    const working = !!this.state.active || this.state.queue.length > 0;
    runMaintenance(this, dt, working, efficiency);
    tickPayroll(this, dt, working);
    tickMetrics(this, dt);
    tickEvents(this, dt, efficiency);
    tickAchievements(this, dt);
    // Guidance (GDD chapter 10). All three are slow scans of counters the
    // simulation has already updated, so they run last and cost nothing.
    tickMissions(this, dt);
    tickMilestones(this, dt);
    tickHints(this, dt);
    this.statsTimer += dt;
    if (this.statsDirty && this.statsTimer >= 0.5) {
      this.statsTimer = 0;
      this.stats = computeStats(this.state);
      this.statsDirty = false;
    }
  }

  /** Random yield roll for one part. Exposed for the teardown system. */
  rollYield(min: number, max: number): number {
    return randInt(min, max);
  }
}
