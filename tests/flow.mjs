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
let page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);

const snap = () => page.evaluate(() => {
  const g = window.game;
  return {
    money: Math.round(g.state.money), level: g.state.level,
    parts: g.state.progressStats.partsRemoved, vehicles: g.state.progressStats.vehiclesDone,
    active: g.state.active?.defId ?? null, queue: g.state.queue.length,
    step: g.state.tutorial.step, tutDone: g.state.tutorial.done,
    owned: g.state.owned, rate: +g.stats.teardownRate.toFixed(2),
    storageUnits: Math.round(g.storageUsed()), cap: g.stats.storage,
    coach: document.querySelector('.coach b')?.textContent ?? null,
  };
});

await page.evaluate(() => {
  window.__cost = (g, id) => {
    const d = window.content.purchasable(id);
    return Math.ceil(d.baseCost * Math.pow(d.costGrowth, g.state.owned[id] ?? 0));
  };
});
// Real touch tap on the canvas proves input wiring; the rest drives the model.
const box = await page.locator('.yard canvas').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
console.log('1) start          ', JSON.stringify(await snap()));

async function finishVehicles(n) {
  await page.evaluate((count) => {
    const g = window.game;
    for (let v = 0; v < count; v++) {
      let guard = 0;
      while (g.state.active && guard++ < 5000) {
        const part = g.state.active.parts.find((p) => !p.done);
        if (!part) break;
        g.tap(part.id);
      }
      if (!g.state.active) break;
    }
  }, n);
}

await finishVehicles(1);
await page.waitForTimeout(400);
console.log('2) 1st car done   ', JSON.stringify(await snap()));
const modalUp = await page.locator('.modal-backdrop').count();
console.log('   choice modal:', modalUp > 0);
await page.screenshot({ path: `${OUT}/f1-choice.png` });
if (modalUp) {
  const labels = await page.locator('.choice .card-title').allTextContents();
  console.log('   options:', JSON.stringify(labels));
  await page.locator('.choice').first().click(); // Besserer Hammer
  await page.waitForTimeout(300);
}
console.log('3) after choice   ', JSON.stringify(await snap()));

// Sell everything
await goto(page, 'storage');
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/f2-storage.png` });
await page.locator('button', { hasText: 'Alles verkaufen' }).click();
await page.waitForTimeout(350);
console.log('4) sold           ', JSON.stringify(await snap()));

// Buy a delivery
await goto(page, 'market');
await page.waitForTimeout(350);
await page.locator('.screen:visible button', { hasText: 'Ankaufen' }).first().click();
await page.waitForTimeout(350);
console.log('5) bought scrap   ', JSON.stringify(await snap()));

// Buy an upgrade
await goto(page, 'build');
await page.waitForTimeout(350);
await page.locator('.screen:visible .card button:not([disabled])').first().click();
await page.waitForTimeout(400);
const s6 = await snap();
console.log('6) upgrade bought ', JSON.stringify(s6));
console.log('   tutorial done:', s6.tutDone);

// Simulate a real first session: grind vehicles and reinvest.
await goto(page, 'yard');
for (let round = 0; round < 40; round++) {
  await finishVehicles(1);
  await page.evaluate(() => {
    const g = window.game;
    g.sellAll();
    // Reinvest, but always keep enough for the next few deliveries.
    const reserve = () => g.buyPrice(g.state.autoBuyVehicle) * 3;
    for (let i = 0; i < 12; i++) {
      const affordable = window.content.purchasables
        .filter((d) => g.canBuy(d.id) && g.state.money - window.__cost(g, d.id) > reserve())
        .sort((a, b) => window.__cost(g, a.id) - window.__cost(g, b.id))[0];
      if (!affordable) break;
      g.buyPurchasable(affordable.id);
    }
    if (!g.state.active && g.state.queue.length === 0) g.buyVehicle(g.state.autoBuyVehicle, true);
  });
}
await page.waitForTimeout(500);
console.log('7) after 40 cars  ', JSON.stringify(await snap()));
await page.screenshot({ path: `${OUT}/f3-progressed.png` });

// Offline progress: close the tab, rewind the *stored* lastSeen, open fresh.
await page.close();
const page2 = await context.newPage();
page2.on('pageerror', (e) => errors.push('pageerror2: ' + e.message));
await page2.addInitScript(() => {
  const raw = localStorage.getItem('scrap-empire.save');
  if (raw) {
    const s = JSON.parse(raw);
    s.lastSeen = Date.now() - 3 * 3600 * 1000;
    localStorage.setItem('scrap-empire.save', JSON.stringify(s));
  }
});
await page2.goto(BASE, { waitUntil: 'networkidle' });
await page2.waitForTimeout(1000);
const offlineTitle = await page2.locator('.modal h2').first().textContent().catch(() => null);
const offlineStats = await page2.locator('.modal .stat').allTextContents().catch(() => []);
console.log('8) offline modal  ', JSON.stringify(offlineTitle), JSON.stringify(offlineStats.map(t => t.replace(/\s+/g, ' '))));
await page2.screenshot({ path: `${OUT}/f4-offline.png` });
await page2.locator('.modal .modal-close').click();
page = page2;
console.log('   after offline  ', JSON.stringify(await snap()));

// Tab availability + company screen
await goto(page, 'stats');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/f5-company.png` });
const tabs = await page.locator('.tab').allTextContents();
console.log('9) tabs           ', JSON.stringify(tabs));

console.log('ERRORS:', errors.length ? JSON.stringify(errors, null, 2) : 'none');
await browser.close();
