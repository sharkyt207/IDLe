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
  g.state.level = 20; g.addMoney(20_000_000); g.recompute();
});

// --- Machine levels --------------------------------------------------------
const levels = await page.evaluate(() => {
  const g = window.game;
  const steps = [];
  for (let i = 0; i < 10; i++) {
    g.buyPurchasable('magnet_crane');
    steps.push(+g.stats.teardownRate.toFixed(2));
  }
  const capped = g.buyPurchasable('magnet_crane');   // must refuse level 11
  return { level: g.state.owned['magnet_crane'], steps, refusedEleventh: !capped };
});
console.log('LEVELS:', JSON.stringify(levels));

// --- Power ----------------------------------------------------------------
const power = await page.evaluate(() => {
  const g = window.game;
  const before = { ...g.stats.power, rate: +g.stats.teardownRate.toFixed(2) };
  for (let i = 0; i < 10; i++) g.buyPurchasable('teardown_robot');   // heavy draw
  const starved = { ...g.stats.power, rate: +g.stats.teardownRate.toFixed(2) };
  for (let i = 0; i < 8; i++) g.buyPurchasable('grid_connection');
  for (let i = 0; i < 3; i++) g.buyPurchasable('solar');
  g.recompute();
  const fixed = { ...g.stats.power, rate: +g.stats.teardownRate.toFixed(2) };
  return { before, starved, fixed };
});
console.log('POWER:', JSON.stringify(power));

// --- Wear and maintenance --------------------------------------------------
const wear = await page.evaluate(async () => {
  const mod = await import('/src/game/systems/maintenance.ts');
  const g = window.game;
  const start = g.stats.condition;
  // Keep the pad fed so the machines actually run for the full 20 minutes.
  for (let i = 0; i < 12000; i++) {
    if (!g.state.active && g.state.queue.length === 0) { g.addMoney(1e6); g.buyVehicle('lkw', true); }
    g.tick(0.1);
  }
  g.recompute();
  const worn = { condition: +g.stats.condition.toFixed(3), rate: +g.stats.teardownRate.toFixed(1) };
  const cost = mod.serviceCost(g);
  mod.serviceAll(g);
  return { start: +start.toFixed(3), worn, serviceCost: Math.round(cost), after: +g.stats.condition.toFixed(3), rateAfter: +g.stats.teardownRate.toFixed(1) };
});
console.log('WEAR:', JSON.stringify(wear));

// --- Auto maintenance ------------------------------------------------------
const auto = await page.evaluate(() => {
  const g = window.game;
  for (let i = 0; i < 6; i++) g.buyPurchasable('technician');
  g.recompute();
  const before = g.stats.condition;
  g.state.condition['magnet_crane'] = 0.3;
  g.recompute();
  for (let i = 0; i < 3000; i++) g.tick(0.1);
  g.recompute();
  return { autoService: +g.stats.autoService.toFixed(4), before: +before.toFixed(2), recovered: +g.stats.condition.toFixed(3) };
});
console.log('AUTO-SERVICE:', JSON.stringify(auto));

// --- Lines -----------------------------------------------------------------
const lines = await page.evaluate(() => {
  const g = window.game;
  const before = { teardown: +g.stats.teardownRate.toFixed(1), buy: +g.stats.autoBuyPerMinute.toFixed(1) };
  for (let i = 0; i < 4; i++) g.buyPurchasable('line_teardown');
  g.recompute();
  return { before, after: { teardown: +g.stats.teardownRate.toFixed(1), buy: +g.stats.autoBuyPerMinute.toFixed(1) }, lines: g.state.owned['line_teardown'] };
});
console.log('LINES:', JSON.stringify(lines));

// --- Yield separators ------------------------------------------------------
const yields = await page.evaluate(() => {
  const g = window.game;
  const before = { ...g.stats.yieldMult };
  for (let i = 0; i < 3; i++) g.buyPurchasable('magnet_separator');
  for (let i = 0; i < 2; i++) g.buyPurchasable('eddy_separator');
  g.recompute();
  return { before, after: Object.fromEntries(Object.entries(g.stats.yieldMult).map(([k, v]) => [k, +v.toFixed(3)])) };
});
console.log('YIELD:', JSON.stringify(yields));

// --- Offline cap -----------------------------------------------------------
const offline = await page.evaluate(() => {
  const g = window.game;
  // Offline hours now come from purchasables and the prestige tree.
  for (let i = 0; i < 10; i++) g.buyPurchasable('shift_lead');
  g.recompute();
  return { offlineHours: g.stats.offlineHours };
});
console.log('OFFLINE CAP:', JSON.stringify(offline));

// --- UI --------------------------------------------------------------------
await goto(page, 'build');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/m1-machines.png` });
const tabs = await page.locator('.screen:visible .btn-row button').allTextContents();
console.log('BUILD TABS:', JSON.stringify(tabs.map(t => t.replace(/\s+/g,' ').trim())));
await page.locator('.screen:visible button', { hasText: 'Energie' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/m2-power.png` });
await page.locator('.screen:visible button', { hasText: 'Linien' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/m3-lines.png` });

// Robots on the map
await goto(page, 'yard');
await page.evaluate(() => { const g = window.game; g.state.research.techs['robotics'] = 5; g.recompute(); for (let i = 0; i < 3; i++) { g.buyPurchasable('sort_robot'); g.buyPurchasable('weld_robot'); g.buyPurchasable('inspection_drone'); } g.recompute(); g.bus.emit('progress', undefined); });
await page.waitForTimeout(6000);
const world = await page.evaluate(() => {
  const r = window.yard;
  const kinds = {};
  for (const v of r.traffic.vehicles) kinds[v.kind] = (kinds[v.kind] ?? 0) + 1;
  const g = window.game;
  return { kinds, robotsOwned: ['sort_robot','weld_robot','inspection_drone'].map(id => g.state.owned[id] ?? 0),
           stations: r.buildings.current().filter(s => s.flow === 'teardown' || s.flow === 'sort').length };
});
console.log('TRAFFIC KINDS:', JSON.stringify(world));
await page.screenshot({ path: `${OUT}/m4-yard.png` });

// Save round-trip with condition
await page.evaluate(() => localStorage.setItem('scrap-empire.save', JSON.stringify(window.game.state)));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const restored = await page.evaluate(() => {
  const g = window.game;
  return { conditions: Object.keys(g.state.condition).length, craneLevel: g.state.owned['magnet_crane'], power: Math.round(g.stats.power.supply) };
});
console.log('RELOAD:', JSON.stringify(restored));
console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0,4), null, 2) : 'none');
await browser.close();
