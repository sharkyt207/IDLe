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
  g.state.level = 30; g.addMoney(200_000_000); g.recompute();
});

// --- Research points: not buyable with money -------------------------------
const points = await page.evaluate(async () => {
  const research = await import('/src/progress/research.ts');
  const g = window.game;
  const before = { points: g.state.research.points, rate: g.stats.researchPointsPerSec };
  const blockedWithoutLab = research.statusOf(g, 'hardened_tools').blockers;

  g.buyPurchasable('lab');
  g.recompute();
  const withLab = { rate: g.stats.researchPointsPerSec, tier: research.techTier(g), slots: research.researchSlots(g) };
  for (let i = 0; i < 600; i++) g.tick(0.1);   // one minute of point income
  return {
    before,
    blockedWithoutLab,
    withLab,
    pointsAfterMinute: +g.state.research.points.toFixed(1),
    // Money alone must never be enough.
    moneyCannotBuyPoints: g.state.money > 1e6 && g.state.research.points < 100,
  };
});
console.log('POINTS:', JSON.stringify(points));

// --- Lab levels: speed, parallel projects, reachable tier -------------------
const lab = await page.evaluate(async () => {
  const research = await import('/src/progress/research.ts');
  const g = window.game;
  const steps = [];
  for (let level = 1; level <= 10; level++) {
    steps.push({
      level: g.state.owned['lab'],
      rate: +g.stats.researchPointsPerSec.toFixed(2),
      speed: +g.stats.mult.researchSpeed.toFixed(2),
      tier: research.techTier(g),
      slots: research.researchSlots(g),
    });
    g.buyPurchasable('lab');
    g.recompute();
  }
  const capped = g.buyPurchasable('lab');   // must refuse an 11th level
  return { steps, level: g.state.owned['lab'], refusedEleventh: !capped };
});
console.log('LAB:', JSON.stringify(lab));

// --- Technology levels, milestones and cost scaling ------------------------
const tech = await page.evaluate(async () => {
  const research = await import('/src/progress/research.ts');
  const g = window.game;
  g.state.research.points = 100_000;
  g.addMoney(500_000_000);
  g.recompute();

  const costs = [];
  const rates = [];
  for (let i = 0; i < 5; i++) {
    const status = research.statusOf(g, 'hydraulics');
    costs.push(status.cost.points);
    research.startResearch(g, 'hydraulics');
    // Fast-forward the lab.
    for (let t = 0; t < 8000 && g.state.research.active.length > 0; t++) g.tick(0.5);
    g.recompute();
    rates.push(+g.stats.mult.teardownRate.toFixed(3));
  }
  const wearAfter = g.stats.mult.wear;   // milestone at level 3 halves-ish wear
  const capped = research.startResearch(g, 'hydraulics');   // level 6 must fail
  return {
    level: g.state.research.techs['hydraulics'],
    costs,
    rates,
    wearAfter: +wearAfter.toFixed(3),
    milestonesSeen: g.state.research.seen,
    refusedSixth: !capped,
  };
});
console.log('TECH:', JSON.stringify(tech));

// --- Material cost: research needs more than points and money --------------
const materials = await page.evaluate(async () => {
  const research = await import('/src/progress/research.ts');
  const g = window.game;
  g.state.research.points = 100_000;
  g.addMoney(500_000_000);
  delete g.state.storage['stainless'];
  g.recompute();
  const blocked = research.statusOf(g, 'precision_cutting').blockers;

  const need = research.nextTechCost(g, 'precision_cutting').materials;
  for (const m of need) g.addMaterial(m.material, m.amount * 2);
  g.recompute();
  const ok = research.statusOf(g, 'precision_cutting').canStart;
  const before = g.state.storage['stainless'];
  research.startResearch(g, 'precision_cutting');
  return { blocked, need, ok, consumed: Math.round(before - (g.state.storage['stainless'] ?? 0)) };
});
console.log('MATERIALS:', JSON.stringify(materials));

// --- Parallel projects ------------------------------------------------------
const parallel = await page.evaluate(async () => {
  const research = await import('/src/progress/research.ts');
  const g = window.game;
  g.state.research.active.length = 0;
  g.state.research.points = 1_000_000;
  g.addMoney(1e10);
  g.recompute();
  const slots = research.researchSlots(g);
  const started = [];
  for (const id of ['hardened_tools', 'metallurgy', 'supply_chain', 'training', 'emissions']) {
    if (research.startResearch(g, id)) started.push(id);
  }
  return { slots, started, active: g.state.research.active.length, free: research.slotsFree(g) };
});
console.log('PARALLEL:', JSON.stringify(parallel));

// --- Rare technologies: hidden until their condition fires -----------------
const secrets = await page.evaluate(async () => {
  const research = await import('/src/progress/research.ts');
  const g = window.game;
  const hiddenIds = ['industry_5', 'autonomous_factory', 'exotic_alloys'];
  const before = research.visibleTechs(g).map((t) => t.id);

  g.state.progressStats.vehiclesDone = 5000;
  g.state.prestige.runs = 3;
  g.state.collection['meteorite'] = 1;
  g.recompute();
  const after = research.visibleTechs(g).map((t) => t.id);

  return {
    hiddenBefore: hiddenIds.filter((id) => !before.includes(id)),
    visibleAfter: hiddenIds.filter((id) => after.includes(id)),
    total: after.length,
  };
});
console.log('SECRETS:', JSON.stringify(secrets));

// --- Achievements -----------------------------------------------------------
const achievements = await page.evaluate(async () => {
  const mod = await import('/src/progress/achievements.ts');
  const g = window.game;
  const before = g.state.achievements.length;
  g.state.progressStats.vehiclesDone = 1200;
  g.state.progressStats.materials['steel'] = 20_000;
  g.state.lifetimeEarned = 2e9;
  mod.check(g);
  const pointsAfter = g.state.prestige.points;
  const rows = mod.rows(g);
  return {
    before,
    after: g.state.achievements.length,
    titles: mod.titles(g),
    pointsAwarded: pointsAfter > 0,
    // Rewards have to be tiny - never a second progression system.
    bonusOnSell: +g.stats.mult.sellPrice.toFixed(3),
    withProgress: rows.filter((r) => !r.earned && r.progress > 0).length,
  };
});
console.log('ACHIEVEMENTS:', JSON.stringify(achievements));

// --- Prestige: three doors, Industriepunkte, difficulty ramp ---------------
const prestige = await page.evaluate(async () => {
  const mod = await import('/src/progress/prestige.ts');
  const progress = await import('/src/data/progress.ts');
  const g = window.game;

  const closed = { can: mod.canPrestige(g), gates: mod.gates(g).map((x) => ({ id: x.id, met: x.met })) };

  // Open the company-value door.
  g.addMoney(2e9);
  for (const d of window.content.purchasables.filter((p) => p.category === 'lot')) g.buyPurchasable(d.id);
  g.recompute();
  const open = { can: mod.canPrestige(g), gain: mod.pointsGain(g), value: Math.round(g.companyValue()) };

  const beforeTechs = Object.keys(g.state.research.techs).length;
  const beforeAchievements = g.state.achievements.length;
  const gain = mod.pointsGain(g);
  const ok = g.doPrestige();

  return {
    closed,
    open,
    reset: ok,
    // Kept across the restart.
    points: g.state.prestige.points >= gain,
    achievementsKept: g.state.achievements.length === beforeAchievements,
    runs: g.state.prestige.runs,
    difficulty: +progress.difficultyFactor(g.state.prestige.runs).toFixed(2),
    // Wiped by the restart.
    techsWiped: Object.keys(g.state.research.techs).length === 0 && beforeTechs > 0,
    moneyReset: g.state.money,
    levelReset: g.state.level,
    lotsWiped: Object.keys(g.state.owned).length === 0,
  };
});
console.log('PRESTIGE:', JSON.stringify(prestige));

// --- Prestige tree ----------------------------------------------------------
const tree = await page.evaluate(async () => {
  const mod = await import('/src/progress/prestige.ts');
  const g = window.game;
  g.state.prestige.points = 5_000;
  g.recompute();

  const branches = [...new Set(window.content.perks.map((p) => p.branch))];
  const before = g.stats.mult.teardownRate;
  const costs = [];
  for (let i = 0; i < 5; i++) {
    costs.push(mod.nextPerkCost(g, 'ip_speed'));
    mod.buyPerk(g, 'ip_speed');
  }
  const gated = window.content.perks.filter((p) => p.requires).map((p) => p.id);
  return {
    branches,
    costs,
    level: g.state.prestige.perks['ip_speed'],
    multBefore: +before.toFixed(3),
    multAfter: +g.stats.mult.teardownRate.toFixed(3),
    gatedNodes: gated,
    pointsLeft: g.state.prestige.points,
  };
});
console.log('TREE:', JSON.stringify(tree));

// --- Endgame content --------------------------------------------------------
const endgame = await page.evaluate(() => {
  const g = window.game;
  const ids = ['trade_office', 'ship_breaking', 'aircraft_yard', 'space_debris', 'orbital_station'];
  const lockedAtStart = ids.filter((id) => !g.canBuy(id));

  g.state.prestige.runs = 5;
  g.state.level = 40;
  g.addMoney(1e13);
  // The harbour plot has its own unlock chain - buy the whole ladder.
  for (let pass = 0; pass < 3; pass++) {
    for (const d of window.content.purchasables.filter((p) => p.category === 'lot')) g.buyPurchasable(d.id);
  }
  g.state.research.techs['fusion'] = 1;
  g.state.research.techs['self_optimising'] = 3;
  g.recompute();
  const reachable = ids.filter((id) => window.content.purchasable(id) && g.canBuy(id));
  return { lockedAtStart, reachable, total: ids.length };
});
console.log('ENDGAME:', JSON.stringify(endgame));

// --- UI ---------------------------------------------------------------------
await page.evaluate(() => {
  const g = window.game;
  g.state.level = 30; g.addMoney(1e10);
  for (let i = 0; i < 5; i++) g.buyPurchasable('lab');
  g.state.research.points = 5000;
  g.recompute();
  g.bus.emit('progress', undefined);
});
await page.waitForTimeout(400);
await goto(page, 'research');
await page.waitForTimeout(500);
const labUi = await page.evaluate(() => ({
  stats: [...document.querySelectorAll('.screen:not([style*="none"]) .stat span')].map((e) => e.textContent),
  branches: [...document.querySelectorAll('.screen:not([style*="none"]) .seg-row > button')].map((b) => b.textContent),
  cards: document.querySelectorAll('.screen:not([style*="none"]) .card').length,
}));
console.log('UI/LABOR:', JSON.stringify(labUi));
await page.screenshot({ path: `${OUT}/l1-lab.png` });

// Start a technology through the UI.
const uiStart = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.screen:not([style*="none"]) .card-actions button')]
    .find((b) => b.textContent.includes('Forschen') && !b.disabled);
  btn?.click();
  return { active: window.game.state.research.active.map((p) => `${p.id}@${p.level}`) };
});
console.log('UI/START:', JSON.stringify(uiStart));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/l2-running.png` });

await goto(page, 'stats');
await page.waitForTimeout(500);
const companyUi = await page.evaluate(() => ({
  titles: [...document.querySelectorAll('.screen:not([style*="none"]) .screen-title')].map((e) => e.textContent),
}));
console.log('UI/FIRMA:', JSON.stringify(companyUi));
await page.screenshot({ path: `${OUT}/l3-prestige.png` });

// --- Save round-trip, including the v1 -> v2 migration ---------------------
const migration = await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  const legacy = {
    version: 1,
    money: 4321,
    level: 12,
    research: { done: ['hardened_tools', 'gone_forever'], active: { id: 'hardened_tools', remaining: 5 } },
    prestige: { reputation: 42, perks: { rep_income: 3, rep_speed: 2 }, runs: 1, bestRun: 999 },
  };
  const restored = save.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(legacy)))));
  return {
    version: restored?.version,
    techs: restored?.research.techs,
    points: restored?.prestige.points,
    perks: restored?.prestige.perks,
    achievements: restored?.achievements,
    droppedUnknown: !(restored?.research.techs ?? {})['gone_forever'],
  };
});
console.log('MIGRATION v1->v2:', JSON.stringify(migration));

await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  const g = window.game;
  g.state.research.techs['metallurgy'] = 3;
  g.state.research.points = 777;
  save.saveGame(g.state);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const reloaded = await page.evaluate(() => {
  const g = window.game;
  return {
    techs: g.state.research.techs,
    points: Math.round(g.state.research.points),
    achievements: g.state.achievements.length,
    prestigePoints: Math.round(g.state.prestige.points),
    runs: g.state.prestige.runs,
    labLevel: g.state.owned['lab'],
  };
});
console.log('RELOAD:', JSON.stringify(reloaded));

console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
