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
  g.state.level = 20;
  g.addMoney(50_000_000);
  for (let i = 0; i < 12; i++) g.buyPurchasable('warehouse');   // real capacity
  g.recompute();
});

// --- Quality ---------------------------------------------------------------
const quality = await page.evaluate(() => {
  const g = window.game;
  const before = g.stats.quality;
  g.state.autoSellEnabled = false;
  g.addMaterial('steel_scrap', 100);
  const q1 = g.state.quality['steel_scrap'];
  for (let i = 0; i < 20; i++) g.buyPurchasable('grabber');
  for (let i = 0; i < 20; i++) g.buyPurchasable('sorter');
  g.recompute();
  const after = g.stats.quality;
  g.addMaterial('steel_scrap', 900);            // blends the pile upward
  const priceLow = g.sellPrice('steel_scrap');
  g.state.quality['steel_scrap'] = 1;
  const priceHigh = g.sellPrice('steel_scrap');
  return {
    yardBefore: +before.toFixed(3), yardAfter: +after.toFixed(3),
    pileBefore: +q1.toFixed(3), pileAfter: +g.state.quality['steel_scrap'].toFixed(3),
    priceAtPileQuality: +priceLow.toFixed(3), priceAtPure: +priceHigh.toFixed(3),
  };
});
console.log('QUALITY:', JSON.stringify(quality));

// --- Disposal --------------------------------------------------------------
const disposal = await page.evaluate(() => {
  const g = window.game;
  g.state.storage['engine_oil'] = 100;
  g.state.quality['engine_oil'] = 0.5;
  const priceBefore = g.sellPrice('engine_oil');
  const moneyBefore = g.state.money;
  g.sellMaterial('engine_oil', 50);
  const cost = g.state.money - moneyBefore;
  g.state.research.techs['fluid_recycling'] = 1;
  g.recompute();
  return { priceBefore: +priceBefore.toFixed(2), costOf50: Math.round(cost), priceAfterResearch: +g.sellPrice('engine_oil').toFixed(2), isDisposal: g.isDisposal('engine_oil') };
});
console.log('DISPOSAL:', JSON.stringify(disposal));

// --- Contracts -------------------------------------------------------------
await goto(page, 'trade');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/c1-contracts.png` });
const contracts = await page.evaluate(async () => {
  const g = window.game;
  const trade = g.state.trade;
  const offer = trade.offers[0];
  if (!offer) return { error: 'no offers' };
  // Stock the yard with what the contract wants.
  for (const d of offer.demand) { g.state.storage[d.material] = d.amount * 2; g.state.quality[d.material] = 0.5; }
  const before = g.state.money;
  const mod = await import('/src/economy/contracts.ts');
  mod.acceptOffer(g, offer.key);
  const active = trade.active[0];
  mod.deliver(g, active.key);
  const done = trade.active[0];
  // Let the recurring income run.
  for (let i = 0; i < 300; i++) g.tick(0.1);
  return {
    client: offer.defId,
    payout: Math.round(offer.payout),
    income: +offer.income.toFixed(2),
    delivered: done?.done,
    incomeLeftAfter30s: Math.round(done?.incomeLeft ?? -1),
    earned: Math.round(g.state.money - before),
  };
});
console.log('CONTRACT:', JSON.stringify(contracts));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/c2-contract-active.png` });

// --- Auction ---------------------------------------------------------------
const auction = await page.evaluate(async () => {
  const mod = await import('/src/economy/auctions.ts');
  const g = window.game;
  mod.openLot(g);
  const a = g.state.trade.auction;
  if (!a) return { error: 'no lot' };
  const start = { lot: a.lotId, value: Math.round(a.value), bid: Math.round(a.bid), aiMax: Math.round(a.aiMax) };
  // Bid until the AI drops out, then run the clock down.
  let bids = 0;
  for (let i = 0; i < 40; i++) {
    if (!g.state.trade.auction) break;
    mod.placeBid(g);
    bids++;
    for (let t = 0; t < 80; t++) g.tick(0.1);
    if (g.state.trade.auction?.playerLeads && g.state.trade.auction.bid > g.state.trade.auction.aiMax) break;
  }
  const mid = g.state.trade.auction;
  const doneBefore = g.state.progressStats.vehiclesDone + g.state.queue.length + (g.state.active ? 1 : 0);
  const moneyBefore = g.state.money;
  for (let t = 0; t < 600; t++) g.tick(0.1);
  return {
    ...start, bids,
    finalBid: Math.round(mid?.bid ?? 0),
    playerLed: mid?.playerLeads,
    resolved: g.state.trade.auction === null,
    vehiclesGained: g.state.progressStats.vehiclesDone + g.state.queue.length + (g.state.active ? 1 : 0) - doneBefore,
    spent: Math.round(moneyBefore - g.state.money),
  };
});
console.log('AUCTION:', JSON.stringify(auction));
await goto(page, 'trade');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/c3-auction.png` });

// --- Finds + company value -------------------------------------------------
const finds = await page.evaluate(async () => {
  const mod = await import('/src/economy/collection.ts');
  const g = window.game;
  let found = 0;
  for (let i = 0; i < 400; i++) {
    const f = mod.rollFind(g, 5);
    if (f) { mod.addToCollection(g, f.id); found++; }
  }
  return { found, kinds: Object.keys(g.state.collection).length, value: Math.round(mod.collectionValue(g)), companyValue: Math.round(g.companyValue()) };
});
console.log('FINDS:', JSON.stringify(finds));

// --- Market drift ----------------------------------------------------------
const drift = await page.evaluate(() => {
  const g = window.game;
  const samples = [];
  for (const t of [0, 200, 450, 700]) {
    g.state.playtime = t;
    samples.push(+g.marketFactor('copper').toFixed(3));
  }
  return samples;
});
console.log('DRIFT (copper over time):', JSON.stringify(drift));

// --- Save round-trip -------------------------------------------------------
await page.evaluate(() => localStorage.setItem('scrap-empire.save', JSON.stringify(window.game.state)));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
const restored = await page.evaluate(() => {
  const g = window.game;
  return {
    collection: Object.keys(g.state.collection).length,
    contracts: g.state.trade.active.length,
    offers: g.state.trade.offers.length,
    qualityKeys: Object.keys(g.state.quality).length,
    level: g.state.level,
  };
});
console.log('RELOAD:', JSON.stringify(restored));
await goto(page, 'storage');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/c4-storage-quality.png` });
await goto(page, 'stats');
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/c5-company.png` });

console.log('ERRORS:', errors.length ? JSON.stringify(errors.slice(0, 4), null, 2) : 'none');
await browser.close();
