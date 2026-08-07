import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../.screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SCRAP_URL ?? 'http://localhost:5174/';
const errors = [];

/**
 * Navigation helper for the six main areas from GDD chapter 8. Screens that
 * used to be top-level tabs (Lager, Handel, Ausbau, Firma) now live inside a
 * hub, so tests ask the shell to select them by id instead of hunting tabs.
 */
async function goto(page, id) {
  await page.evaluate((target) => window.app.select(target), id);
  await page.waitForTimeout(420);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const g = window.game;
  g.state.tutorial = { step: 5, done: true, choiceOffered: true };
  g.state.level = 25; g.addMoney(50_000_000); g.recompute();
});

// --- Payroll ---------------------------------------------------------------
const payroll = await page.evaluate(async () => {
  const mod = await import('/src/company/payroll.ts');
  const g = window.game;
  const before = mod.runningCosts(g);
  for (let i = 0; i < 5; i++) g.buyPurchasable('mechanic');
  g.buyPurchasable('warehouse_worker');
  g.buyPurchasable('shed');
  const after = mod.runningCosts(g);
  // Measure the payroll alone: income would otherwise swamp it.
  const spentBefore = g.state.metrics.daySpent;
  for (let i = 0; i < 100; i++) g.tick(0.1);   // 10 s of payroll
  return {
    before: +before.toFixed(3),
    after: +after.toFixed(3),
    wages: +mod.wageBill(g).toFixed(3),
    upkeep: +mod.upkeepBill(g).toFixed(3),
    paidOverTenSeconds: +(g.state.metrics.daySpent - spentBefore).toFixed(2),
    rows: mod.staffRows(g).map((r) => `${r.id}×${r.count}`),
  };
});
console.log('PAYROLL:', JSON.stringify(payroll));

// --- Broke: staff slow down, they never quit -------------------------------
const broke = await page.evaluate(async () => {
  const mod = await import('/src/company/payroll.ts');
  const g = window.game;
  g.state.money = 0;
  for (let i = 0; i < 100; i++) g.tick(0.1);
  const staffLeft = mod.staffRows(g).reduce((a, r) => a + r.count, 0);
  const factor = mod.payrollFactor(g);
  g.addMoney(50_000_000);
  for (let i = 0; i < 600; i++) g.tick(0.1);   // paying again clears the debt
  return {
    arrears: +g.state.metrics.arrears.toFixed(2),
    factorWhileBroke: factor,
    staffLeft,
    recovered: +g.state.metrics.arrears.toFixed(2) === 0 || g.state.metrics.arrears < 1,
  };
});
console.log('BROKE:', JSON.stringify(broke));

// --- Experience ------------------------------------------------------------
const xp = await page.evaluate(async () => {
  const company = await import('/src/data/company.ts');
  const g = window.game;
  g.state.metrics.arrears = 0;
  g.state.priority = 'balanced'; g.recompute();
  const rateBefore = g.stats.teardownRate;
  const levelBefore = company.staffLevel(g.state.staffXp['mechanic'] ?? 0);
  // 20 minutes of work with a full pad.
  for (let i = 0; i < 12000; i++) {
    if (!g.state.active && g.state.queue.length === 0) { g.addMoney(1e7); g.buyVehicle('lkw', true); }
    g.tick(0.1);
  }
  g.recompute();
  const levelAfter = company.staffLevel(g.state.staffXp['mechanic'] ?? 0);
  return {
    levelBefore, levelAfter,
    productivity: +company.staffProductivity(levelAfter).toFixed(2),
    rateBefore: +rateBefore.toFixed(2),
    rateAfter: +g.stats.teardownRate.toFixed(2),
    maxLevel: company.COMPANY.staff.maxLevel,
  };
});
console.log('EXPERIENCE:', JSON.stringify(xp));

// --- Priorities ------------------------------------------------------------
const priorities = await page.evaluate(() => {
  const g = window.game;
  g.buyPurchasable('magnet_crane');
  for (let i = 0; i < 3; i++) g.buyPurchasable('technician');
  g.recompute();
  const snap = () => ({
    teardown: +g.stats.teardownRate.toFixed(1),
    storage: Math.round(g.stats.storage),
    autoService: +g.stats.autoService.toFixed(4),
    wear: g.stats.mult.wear,
    research: g.stats.mult.researchSpeed,
    slots: g.stats.contractSlots,
  });
  const out = {};
  for (const p of window.content.priorities) {
    g.setPriority(p.id);
    out[p.id] = snap();
  }
  g.setPriority('balanced');
  return { ids: window.content.priorities.map((p) => p.id), out };
});
console.log('PRIORITIES:', JSON.stringify(priorities));

// --- Warehouse rules -------------------------------------------------------
const rules = await page.evaluate(async () => {
  const wh = await import('/src/company/warehouse.ts');
  const g = window.game;
  g.state.storage['steel'] = 800;
  g.state.storage['gold'] = 40;
  g.state.storage['copper'] = 200;

  wh.setRule(g, 'steel', { keep: 500 });
  g.state.autoSellLocked['gold'] = true;
  wh.setRule(g, 'copper', { minPrice: g.sellPrice('copper') * 4 });

  const sellable = {
    steel: Math.round(wh.sellableAmount(g, 'steel')),
    gold: Math.round(wh.sellableAmount(g, 'gold')),
    copper: Math.round(wh.sellableAmount(g, 'copper')),
  };
  const texts = ['steel', 'gold', 'copper'].map((id) => wh.ruleText(g, id));

  g.sellAll();   // "Alles verkaufen" has to respect the rules too
  const afterSellAll = {
    steel: Math.round(g.state.storage['steel'] ?? 0),
    gold: Math.round(g.state.storage['gold'] ?? 0),
    copper: Math.round(g.state.storage['copper'] ?? 0),
  };
  return { sellable, texts, afterSellAll, ruled: wh.ruledMaterials(g).length };
});
console.log('RULES:', JSON.stringify(rules));

// --- Statistics ------------------------------------------------------------
const stats = await page.evaluate(async () => {
  const st = await import('/src/company/statistics.ts');
  const company = await import('/src/data/company.ts');
  const g = window.game;
  const before = st.report(g);
  const daysBefore = g.state.metrics.dayHistory.length;
  // Fast-forward one full business day.
  const steps = Math.ceil(company.COMPANY.metrics.daySeconds / 0.1) + 20;
  for (let i = 0; i < steps; i++) {
    if (!g.state.active && g.state.queue.length === 0) { g.addMoney(1e7); g.buyVehicle('lkw', true); }
    g.tick(0.1);
  }
  const after = st.report(g);
  return {
    daysBefore,
    daysAfter: g.state.metrics.dayHistory.length,
    fields: Object.keys(after).length,
    dayProfit: Math.round(after.dayProfit),
    weekProfit: Math.round(after.weekProfit),
    employees: after.employees,
    machines: after.machines,
    efficiency: +after.efficiency.toFixed(3),
    co2Grew: after.co2Saved > before.co2Saved,
    unitsRecycled: Math.round(after.unitsRecycled),
    runningCosts: +after.runningCosts.toFixed(2),
    allFinite: Object.values(after).every((v) => Number.isFinite(v)),
  };
});
console.log('STATISTICS:', JSON.stringify(stats));

// --- Road network ----------------------------------------------------------
const roads = await page.evaluate(async () => {
  const { RoadNetwork } = await import('/src/world/roads.ts');
  const { MapSystem } = await import('/src/world/map.ts');
  const g = window.game;
  for (const lot of window.content.purchasables.filter((d) => d.category === 'lot')) {
    for (let i = 0; i < 3; i++) g.buyPurchasable(lot.id);
  }
  g.recompute();
  const map = new MapSystem();
  map.sync(g.state);
  const net = new RoadNetwork();
  net.build(map.roads);

  const gate = { x: 21.5, y: 7.5 };
  const connected = map.lots
    .filter((l) => l.road.length > 1)
    .map((l) => {
      const end = l.road[l.road.length - 1];
      return { id: l.id, edges: net.route(gate, end).edges.length };
    });

  // Congestion: loading the shortest route has to push the next one elsewhere.
  const target = { x: 21.5, y: 24 };
  const first = net.route(gate, target);
  for (let i = 0; i < 12; i++) net.reserve(first.edges);
  const second = net.route(gate, target);
  for (let i = 0; i < 12; i++) net.release(first.edges);

  return {
    nodes: net.nodes.length,
    edges: net.edges.length,
    connected,
    allConnected: connected.every((c) => c.edges > 0),
    firstLength: +first.length.toFixed(1),
    secondLength: +second.length.toFixed(1),
    reroutedOrDetour: second.detour || second.length !== first.length,
    congestionCleared: net.congestion() === 0,
  };
});
console.log('ROADS:', JSON.stringify(roads));

// --- Vehicle AI ------------------------------------------------------------
const fleet = await page.evaluate(async () => {
  const g = window.game;
  for (const id of ['forklift_driver', 'truck_driver', 'vehicle_hall', 'container_terminal']) {
    g.buyPurchasable(id);
  }
  g.recompute();
  const traffic = window.yard.traffic;
  const classes = traffic.fleetClasses().map((c) => c.id);
  // Let the yard run so the dispatcher hands out work.
  for (let i = 0; i < 400; i++) {
    if (!g.state.active && g.state.queue.length === 0) { g.addMoney(1e7); g.buyVehicle('lkw', true); }
    g.tick(0.1);
  }
  await new Promise((r) => setTimeout(r, 2500));
  const vehicles = traffic.vehicles;
  const kinds = {};
  const fleets = {};
  for (const v of vehicles) {
    kinds[v.kind] = (kinds[v.kind] ?? 0) + 1;
    if (v.fleet) fleets[v.fleet] = (fleets[v.fleet] ?? 0) + 1;
  }
  // Every fleet vehicle has to sit on a real path, not be teleported.
  const onRoad = vehicles.every((v) => v.path.length >= 2 && v.length > 0);
  const slowed = vehicles.some((v) => v.actualSpeed < v.speed - 1e-6);
  return { classes, kinds, fleets, count: vehicles.length, onRoad, slowedByTraffic: slowed };
});
console.log('FLEET:', JSON.stringify(fleet));

// --- UI --------------------------------------------------------------------
await goto(page, 'stats');
await page.waitForTimeout(400);
const ui = await page.evaluate(() => {
  const titles = [...document.querySelectorAll('.screen-title')].map((e) => e.textContent);
  const stats = [...document.querySelectorAll('.stat span')].map((e) => e.textContent);
  const priorityButtons = [...document.querySelectorAll('.seg-row > button')].map((b) => b.textContent);
  return { titles, stats, priorityButtons };
});
console.log('UI/FIRMA:', JSON.stringify(ui));
await page.screenshot({ path: `${OUT}/k1-company.png` });

// Switch focus through the UI and confirm it lands in the state.
const switched = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.seg-row > button')].find((b) => /Wartung/.test(b.textContent));
  btn?.click();
  return { priority: window.game.state.priority, autoService: window.game.stats.mult.autoService };
});
console.log('UI/SWITCH:', JSON.stringify(switched));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/k2-priority.png` });

await goto(page, 'storage');
await page.waitForTimeout(400);
const storageUi = await page.evaluate(() => {
  const gear = [...document.querySelectorAll('.card-actions button')].find((b) => b.textContent.includes('⚙️'));
  gear?.click();
  const modal = document.querySelector('.modal, .sheet, dialog');
  return {
    notes: [...document.querySelectorAll('.card-note')].map((e) => e.textContent).slice(0, 4),
    modalOpen: !!modal,
    inputs: modal ? modal.querySelectorAll('input').length : 0,
    modalText: modal ? modal.textContent.slice(0, 120) : null,
  };
});
console.log('UI/LAGER:', JSON.stringify(storageUi));
await page.screenshot({ path: `${OUT}/k3-rule.png` });

// --- Save roundtrip --------------------------------------------------------
const reload = await page.evaluate(async () => {
  const { saveGame } = await import('/src/game/save.ts');
  window.game.setPriority('contracts');
  saveGame(window.game.state);
  return { priority: window.game.state.priority };
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const afterReload = await page.evaluate(() => {
  const g = window.game;
  return {
    priority: g.state.priority,
    contractSlots: g.stats.contractSlots,
    staffXpKeys: Object.keys(g.state.staffXp).length,
    rules: Object.keys(g.state.rules).length,
    dayHistory: g.state.metrics.dayHistory.length,
    unitsRecycled: Math.round(g.state.metrics.unitsRecycled),
  };
});
console.log('RELOAD:', JSON.stringify({ ...reload, afterReload }));

console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
