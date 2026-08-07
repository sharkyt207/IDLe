/**
 * Headless balancing harness.
 *
 *   npm run simulate            # 30 minutes, default player
 *   npm run simulate -- 120     # 120 minutes
 *
 * Plays the game in Node with a simple but plausible player policy and prints
 * a progression timeline. Use it to check the GDD pacing promises after any
 * change to `src/data/*`:
 *   - something meaningful happens every few minutes
 *   - at least five real decisions in the first ten minutes
 *   - the yard looks different after 30 minutes
 */
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'node_modules/.scrap-sim');

await build({
  root,
  configFile: false,
  logLevel: 'error',
  build: {
    ssr: resolve(root, 'src/sim-entry.ts'),
    outDir,
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'sim.mjs' } },
  },
});

const { Game, Content, nextCost, acceptOffer, deliver, canAccept, companyValue, serviceAll, serviceCost, machineList } =
  await import(resolve(outDir, 'sim.mjs'));

const minutes = Number(process.argv[2] ?? 30);
const TICK = 0.1;
/** Taps per second while the player is actively watching the pad. */
const TAPS_PER_SECOND = 3;
/** The player stops tapping once automation carries the yard. */
const IDLE_AFTER_RATE = 25;

const game = new Game();
game.state.tutorial = { step: 5, done: true, choiceOffered: true };

const events = [];
/** Simulated seconds since start - survives a prestige reset. */
let clock = 0;
let lastLevel = 1;
let purchasesInFirstTen = 0;
const seen = new Set();

game.bus.on('levelUp', ({ level }) => {
  if (level > lastLevel) {
    lastLevel = level;
    events.push([clock, `Level ${level}`]);
  }
});

/**
 * Investment policy of a thinking player: fix the bottleneck first
 * (nachschub → verkauf → zerlegen), then push the strongest tier affordable.
 */
function invest() {
  const reserve = game.buyPrice(game.state.autoBuyVehicle) * 6;
  for (let guard = 0; guard < 8; guard++) {
    const affordable = Content.purchasables
      .filter((def) => game.canBuy(def.id))
      .filter((def) => game.state.money - nextCost(game.state, def.id) > reserve);
    if (affordable.length === 0) return;

    const byGroup = (group) =>
      affordable
        .filter((def) => def.group === group)
        .sort((a, b) => nextCost(game.state, b.id) - nextCost(game.state, a.id))[0];

    // Work the yard can chew per second vs. work its deliveries supply.
    const vehicle = Content.vehicle(game.state.autoBuyVehicle);
    const workPerVehicle = vehicle ? vehicle.parts.reduce((s, p) => s + p.work, 0) : 1;
    const suppliedWork = (game.stats.autoBuyPerMinute / 60) * workPerVehicle;
    const starving = suppliedWork < game.stats.teardownRate || game.stats.autoBuyPerMinute === 0;
    const backingUp = game.storageUsed() > game.stats.storage * 0.8;

    const unlockBuilding = affordable
      .filter((def) => def.maxCount === 1)
      .sort((a, b) => a.baseCost - b.baseCost)[0];

    // An underpowered yard throttles every machine - fix the grid first.
    const underPowered = game.stats.power.factor < 1;

    const pick =
      unlockBuilding ||
      (underPowered && byGroup('Energie')) ||
      (starving && byGroup('Logistik')) ||
      (backingUp && (byGroup('Sortierung') || byGroup('Lager'))) ||
      byGroup('Zerlegen') ||
      byGroup('Werkstatt') ||
      byGroup('Handwerkzeug') ||
      byGroup('Lager') ||
      byGroup('Gelände') ||
      affordable.sort((a, b) => nextCost(game.state, b.id) - nextCost(game.state, a.id))[0];
    if (!pick) return;

    const first = (game.state.owned[pick.id] ?? 0) === 0;
    if (!game.buyPurchasable(pick.id)) return;
    if (first) {
      events.push([clock, `Neu gekauft: ${pick.name}`]);
      seen.add(pick.id);
    }
    if (clock <= 600) purchasesInFirstTen++;
  }
}

/** Moves up to a richer delivery once it is comfortably affordable - never down. */
function chooseDelivery() {
  const current = Content.vehicle(game.state.autoBuyVehicle);
  const better = Content.vehicles
    .filter((v) => game.isUnlocked(v.id))
    .filter((v) => v.price > (current?.price ?? 0))
    .filter((v) => game.buyPrice(v.id) * 12 <= game.state.money)
    .sort((a, b) => b.price - a.price)[0];
  if (better) {
    game.state.autoBuyVehicle = better.id;
    events.push([clock, `Steigt um auf: ${better.name}`]);
  }
}

/**
 * Restarts the company once a run has clearly peaked. Models the intended
 * long-game loop, so long simulations exercise prestige instead of idling.
 */
let lastPrestige = 0;
function maybePrestige() {
  if (!game.canPrestige()) return;
  const gain = game.prestigeGain();
  if (gain < 25 || clock - lastPrestige < 1800) return;
  game.doPrestige();
  lastPrestige = clock;
  events.push([clock, `Neu gegründet (+${gain} Reputation)`]);
  // Spend the reputation immediately - permanent bonuses are always worth it.
  for (let guard = 0; guard < 60; guard++) {
    const perk = Content.perks.find((p) => game.buyPerk(p.id));
    if (!perk) break;
  }
}

/**
 * Takes on contracts the yard can actually supply and ships what it can.
 * A player reads the demand before signing; so does the bot.
 */
let contractsDone = 0;
const acceptedAt = new Map();
function producible() {
  const set = new Set(Object.keys(game.state.storage));
  const vehicle = Content.vehicle(game.state.autoBuyVehicle);
  for (const part of vehicle?.parts ?? []) {
    for (const y of part.yields) set.add(y.material);
  }
  // Anything the yard refines itself counts too.
  for (const recipeId of Object.keys(game.stats.processes)) {
    for (const out of Content.recipe(recipeId)?.output ?? []) set.add(out.material);
  }
  return set;
}

function trade() {
  const state = game.state;
  const supply = producible();
  for (const offer of [...state.trade.offers]) {
    if (!canAccept(game)) break;
    if (!offer.demand.every((d) => supply.has(d.material))) continue;
    acceptOffer(game, offer.key);
    acceptedAt.set(offer.key, clock);
    events.push([clock, `Auftrag: ${Content.contract(offer.defId)?.client ?? offer.defId}`]);
  }
  for (const contract of [...state.trade.active]) {
    if (contract.done) continue;
    const before = contract.done;
    deliver(game, contract.key);
    const now = state.trade.active.find((c) => c.key === contract.key);
    if (!before && now?.done) contractsDone++;
  }
}

/** Keeps the machines serviced once wear starts to bite. */
let services = 0;
function maintain() {
  if (game.stats.condition >= 0.75) return;
  const cost = serviceCost(game);
  if (cost > 0 && game.state.money > cost * 3) {
    if (serviceAll(game)) services++;
  }
}

/** Starts whatever research is affordable - it is always a permanent gain. */
function research() {
  if (game.state.research.active) return;
  const node = Content.research
    .filter((n) => game.canResearch(n.id))
    .sort((a, b) => a.cost - b.cost)[0];
  if (node && game.startResearch(node.id)) {
    events.push([clock, `Forschung: ${node.name}`]);
  }
}

const totalSteps = Math.round((minutes * 60) / TICK);
let tapCredit = 0;

for (let step = 0; step < totalSteps; step++) {
  game.tick(TICK);
  clock += TICK;

  // Manual tapping, until automation makes it pointless.
  if (game.stats.teardownRate < IDLE_AFTER_RATE && game.state.active) {
    tapCredit += TAPS_PER_SECOND * TICK;
    while (tapCredit >= 1) {
      const part = game.state.active?.parts.find((p) => !p.done);
      if (!part) break;
      game.tap(part.id);
      tapCredit -= 1;
    }
  }

  // Roughly every 5 s the player checks in: sell, invest, keep the pad fed.
  if (step % 50 === 0) {
    if (game.storageUsed() > game.stats.storage * 0.5 || game.stats.autoSellPerSec === 0) {
      game.sellAll();
    }
    // Decide what to buy *before* spending the rest, otherwise the wallet is
    // always empty when the upgrade decision is made.
    chooseDelivery();
    research();
    trade();
    maintain();
    invest();
    maybePrestige();
    if (!game.state.active && game.state.queue.length === 0) {
      game.buyVehicle(game.state.autoBuyVehicle, true);
    }
  }
}

const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

console.log(`\n=== Scrap Empire - ${minutes} Minuten Simulation ===\n`);
console.log('Zeitachse (erste 40 Ereignisse):');
for (const [time, text] of events.slice(0, 40)) {
  console.log(`  ${fmtTime(time)}  ${text}`);
}

// The GDD's "alle 2-5 Minuten passiert etwas" promise covers the opening
// session, so the stall check looks at the first 30 minutes.
const early = events.filter(([t]) => t <= 1800);
const gaps = [];
for (let i = 1; i < early.length; i++) gaps.push(early[i][0] - early[i - 1][0]);
const longestGap = gaps.length ? Math.max(...gaps) : 0;

console.log('\nErgebnis nach', minutes, 'Minuten:');
console.log('  Level              ', game.state.level);
console.log('  Umsatz             ', Math.round(game.state.lifetimeEarned).toLocaleString('de-DE'), '€');
console.log('  Fahrzeuge zerlegt  ', game.state.progressStats.vehiclesDone);
console.log('  Fahrzeugtypen      ', game.state.progressStats.discovered.length, '/', Content.vehicles.length);
console.log('  Zerlegen/s         ', game.stats.teardownRate.toFixed(1));
console.log('  Verkauf/s          ', game.stats.autoSellPerSec.toFixed(1));
console.log('  Ankauf/min         ', game.stats.autoBuyPerMinute.toFixed(1));
console.log('  Lagerplätze        ', game.stats.storage);
console.log('  Verschiedene Käufe ', seen.size);
console.log('  Forschungen        ', game.state.research.done.length);
console.log('  Reputation möglich ', game.prestigeGain());
console.log('  Neugründungen      ', game.state.prestige.runs);
const lots = Content.purchasables.filter((d) => d.category === 'lot' && (game.state.owned[d.id] ?? 0) > 0);
const decor = Content.purchasables.filter((d) => d.category === 'decor' && (game.state.owned[d.id] ?? 0) > 0);
console.log('  Grundstücke        ', lots.length, '/', Content.purchasables.filter((d) => d.category === 'lot').length);
console.log('  Deko-Arten         ', decor.length);
console.log('  Firmenwert         ', Math.round(companyValue(game)).toLocaleString('de-DE'), '€');
console.log('  Verträge erfüllt   ', contractsDone);
console.log('  Fundstücke         ', Object.values(game.state.collection).reduce((a, b) => a + b, 0));
const quality = ['Schlecht', 'Normal', 'Gut', 'Hochwertig', 'Rein'][Math.min(4, Math.floor(game.stats.quality * 5))];
console.log('  Materialqualität   ', quality);
const machines = machineList(game);
console.log('  Maschinen          ', machines.length, '· Stufen gesamt', machines.reduce((a, m) => a + m.level, 0));
console.log('  Höchste Stufe      ', machines.reduce((a, m) => Math.max(a, m.level), 0), '/ 10');
console.log('  Strom              ', Math.round(game.stats.power.supply), '/', Math.round(game.stats.power.demand), 'kW',
  '(' + Math.round(game.stats.power.factor * 100) + ' %)');
console.log('  Anlagenzustand     ', Math.round(game.stats.condition * 100), '% · Wartungen', services);
const lines = Content.purchasables.filter((d) => d.category === 'line').reduce((a, d) => a + (game.state.owned[d.id] ?? 0), 0);
console.log('  Produktionslinien  ', lines);

console.log('\nGDD-Prüfungen:');
check('Erste 10 Minuten: mindestens 5 Entscheidungen', purchasesInFirstTen >= 5, `${purchasesInFirstTen} Käufe`);
check('Erste 30 Min ohne Stillstand > 5 Min', longestGap <= 300, `längste Pause ${fmtTime(longestGap)}`);
check('Automatisierung erreicht', game.stats.teardownRate > 0, `${game.stats.teardownRate.toFixed(1)}/s`);
check('Sichtbares Wachstum (>=6 Anlagen-Arten)', seen.size >= 6, `${seen.size} Arten`);
check('Gelände wächst (mind. 1 Grundstück)', lots.length >= 1, `${lots.length} Grundstücke`);
check('Wirtschaft: Verträge laufen', contractsDone >= 1, `${contractsDone} erfüllt`);
check('Strom gedeckt', game.stats.power.factor >= 0.99, `${Math.round(game.stats.power.factor * 100)} %`);
check('Anlagen gepflegt (>60 %)', game.stats.condition > 0.6, `${Math.round(game.stats.condition * 100)} %`);

function check(label, ok, detail) {
  console.log(`  ${ok ? '✅' : '❌'} ${label} — ${detail}`);
  if (!ok) process.exitCode = 1;
}
console.log('');
