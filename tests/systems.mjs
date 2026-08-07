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
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

// Fast-forward: enough money and level to reach the late systems.
await page.evaluate(() => {
  const g = window.game;
  g.state.tutorial.done = true;
  g.state.level = 12;
  g.addMoney(5_000_000);
  g.recompute();
});

// --- Processing chain -----------------------------------------------------
const processing = await page.evaluate(() => {
  const g = window.game;
  g.buyPurchasable('smeltery');
  g.buyPurchasable('furnace_steel');
  for (let i = 0; i < 12; i++) g.buyPurchasable('storage_yard'); // realistic capacity
  g.recompute();
  g.state.storage['steel_scrap'] = 500;
  const before = { scrap: g.state.storage['steel_scrap'] ?? 0, ingots: g.state.storage['steel_ingot'] ?? 0 };
  g.state.autoSellEnabled = false;          // isolate the processing system
  for (let i = 0; i < 200; i++) g.tick(0.1); // 20 s of simulation
  return {
    before,
    after: { scrap: Math.round(g.state.storage['steel_scrap'] ?? 0), ingots: Math.round(g.state.storage['steel_ingot'] ?? 0) },
    unlocked: [...g.stats.unlocks],
    rate: g.stats.processes['smelt_steel'],
  };
});
console.log('PROCESSING:', JSON.stringify(processing));

// --- Research -------------------------------------------------------------
await page.evaluate(() => {
  const g = window.game;
  g.buyPurchasable('lab');
  g.recompute();
  g.bus.emit('progress', undefined);
});
await page.waitForTimeout(400);
const tabsWithLab = await page.locator('.tab').allTextContents();
console.log('TABS WITH LAB:', JSON.stringify(tabsWithLab));

await goto(page, 'research');
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/s1-research.png` });
await page.locator('.screen:visible .card button:not([disabled])').first().click();
await page.waitForTimeout(400);
const research = await page.evaluate(() => {
  const g = window.game;
  const active = g.state.research.active[0];
  const beforeMult = g.stats.mult.teardownRate;
  for (let i = 0; i < 1200; i++) g.tick(0.5); // fast-forward past the timer
  return {
    started: active ? `${active.id}@${active.level}` : null,
    techs: g.state.research.techs,
    multBefore: +beforeMult.toFixed(3),
    multAfter: +g.stats.mult.teardownRate.toFixed(3),
    sellMultAfter: +g.stats.mult.sellPrice.toFixed(3),
  };
});
console.log('RESEARCH:', JSON.stringify(research));

// --- Storage overflow -----------------------------------------------------
const overflow = await page.evaluate(() => {
  const g = window.game;
  g.state.autoSellEnabled = true;
  g.buyPurchasable('conveyor');
  g.recompute();
  const cap = g.stats.storage;
  g.state.storage = { steel_scrap: cap };  // completely full
  const moneyBefore = g.state.money;
  g.addMaterial('copper', 100);            // must not silently vanish
  return { cap, used: Math.round(g.storageUsed()), earnedFromOverflow: Math.round(g.state.money - moneyBefore) };
});
console.log('OVERFLOW:', JSON.stringify(overflow));

// --- Prestige -------------------------------------------------------------
const prestige = await page.evaluate(() => {
  const g = window.game;
  g.state.runEarned = 20_000_000;
  g.state.level = 12;
  const gain = g.prestigeGain();
  const can = g.canPrestige();
  const before = { money: Math.round(g.state.money), owned: Object.keys(g.state.owned).length, research: Object.keys(g.state.research.techs).length };
  g.doPrestige();
  return {
    gain, can, before,
    after: {
      money: Math.round(g.state.money),
      owned: Object.keys(g.state.owned).length,
      research: Object.keys(g.state.research.techs).length,
      reputation: g.state.prestige.reputation,
      runs: g.state.prestige.runs,
      level: g.state.level,
      active: g.state.active?.defId ?? null,
      discovered: g.state.progressStats.discovered.length,
    },
  };
});
console.log('PRESTIGE:', JSON.stringify(prestige));

await goto(page, 'stats');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/s2-company-perks.png` });

const perk = await page.evaluate(() => {
  const g = window.game;
  const before = +g.stats.mult.sellPrice.toFixed(3);
  const ok = g.buyPerk('rep_income');
  return { ok, before, after: +g.stats.mult.sellPrice.toFixed(3), repLeft: g.state.prestige.reputation };
});
console.log('PERK:', JSON.stringify(perk));

// --- Save round-trip with all of the above --------------------------------
const roundTrip = await page.evaluate(() => {
  const g = window.game;
  const text = JSON.stringify(g.state);
  localStorage.setItem('scrap-empire.save', text);
  return { bytes: text.length };
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const restored = await page.evaluate(() => {
  const g = window.game;
  return { reputation: g.state.prestige.reputation, perks: g.state.prestige.perks, runs: g.state.prestige.runs, level: g.state.level };
});
console.log('SAVE ROUNDTRIP:', JSON.stringify(roundTrip), '->', JSON.stringify(restored));

console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none');
await browser.close();
