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
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/w1-start.png` });

const info = () => page.evaluate(() => {
  const g = window.game;
  return {
    active: g.state.active?.defId ?? null,
    lots: Object.keys(g.state.owned).filter(k => k.startsWith('lot_')),
    placements: Object.keys(g.state.world.placements).length,
    dayTime: Math.round(g.state.world.dayTime),
    weather: g.state.world.weather,
    companyValue: Math.round(g.stats.companyValue),
    env: document.querySelector('.env-chip')?.textContent ?? null,
  };
});
console.log('START:', JSON.stringify(await info()));

// Real tap on a part hotspot, via the renderer's own hit test.
const tapped = await page.evaluate(() => {
  const g = window.game;
  const before = g.state.progressStats.partsRemoved;
  // find the canvas + dispatch a pointer tap at the first hotspot's screen pos
  return { before, parts: g.state.active.parts.length };
});
console.log('PAD:', JSON.stringify(tapped));

// Grow the yard: money + levels, buy everything reasonable.
await page.evaluate(() => {
  const g = window.game;
  g.state.tutorial = { step: 5, done: true, choiceOffered: true };
  g.state.level = 26;
  g.addMoney(1e9);
  g.recompute();
  for (const id of ['lot_storage','lot_workshop2','lot_recycling','lot_smelter','lot_logistics','lot_lab','lot_port']) {
    g.buyPurchasable(id);
  }
  for (const id of ['magnet_crane','grabber','conveyor','sorter','pickup','smeltery','furnace_steel','lab','office','warehouse','storage_yard','decor_tree','decor_lamp','decor_flag','tow_truck']) {
    for (let i = 0; i < 6; i++) g.buyPurchasable(id);
  }
  g.state.autoBuyVehicle = 'transporter';
  g.recompute();
  g.bus.emit('progress', undefined);
});
await page.waitForTimeout(1500);
console.log('GROWN:', JSON.stringify(await info()));
await page.screenshot({ path: `${OUT}/w2-grown.png` });

// Zoom out to see the whole estate.
const box = await page.locator('.yard canvas').boundingBox();
for (let i = 0; i < 6; i++) {
  await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(60);
}
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/w3-zoomout.png` });

// Night: fast-forward the day cycle.
await page.evaluate(() => { window.game.state.world.dayTime = 810; window.game.state.world.weather = 'rain'; window.game.state.world.weatherLeft = 300; });
await page.waitForTimeout(900);
console.log('NIGHT:', JSON.stringify(await info()));
await page.screenshot({ path: `${OUT}/w4-night-rain.png` });

// Snow + fog check
await page.evaluate(() => { window.game.state.world.dayTime = 200; window.game.state.world.weather = 'snow'; window.game.state.world.weatherLeft = 300; });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/w5-snow.png` });

// Traffic + flow: are vehicles and packets alive?
const alive = await page.evaluate(() => {
  const r = window.yard;
  return r ? { vehicles: r.traffic.vehicles.length, packets: r.logistics.packets.length, lines: r.logistics.lines.length, structures: r.buildings.current().length, slots: r.map.slots.length, decorSpots: r.map.decorSpots.length } : null;
});
console.log('WORLD:', JSON.stringify(alive));

// Build screen: new tabs
await goto(page, 'build');
await page.waitForTimeout(400);
const tabs = await page.locator('.screen:visible .btn-row button').allTextContents();
console.log('BUILD TABS:', JSON.stringify(tabs.map(t => t.replace(/\s+/g,' ').trim())));
await page.locator('.screen:visible button', { hasText: 'Grundstück' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/w6-lots.png` });
await page.locator('.screen:visible button', { hasText: 'Deko' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/w7-decor.png` });

// Save round-trip with world state
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
console.log('AFTER RELOAD:', JSON.stringify(await info()));

console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0,5), null, 2) : 'none');
await browser.close();
