import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Chapter 10: tutorial, missions and player guidance.
 *
 * The questions worth asking here are all end-to-end: a mission is data, a
 * tracker, a reward and a card, and only the running game can say whether the
 * four agree with each other.
 */

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../.screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SCRAP_URL ?? 'http://localhost:5174/';
const errors = [];

async function goto(page, id) {
  await page.evaluate((target) => window.app.select(target), id);
  await page.waitForTimeout(420);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// --- Intro -----------------------------------------------------------------
// `beforeunload` writes the save on the way out, so clearing storage and
// reloading does not produce a virgin company. Replaying the sequence
// explicitly is both honest about that and how the debug panel would do it.
const flight = await page.evaluate(() => {
  window.game.state.missions.introSeen = false;
  window.intro.play();
  return {
    playedOnce: true,
    flying: window.yard.introRunning,
    cardYet: !!document.querySelector('.intro-card'),
    trucksBefore: window.yard.traffic.vehicles.length,
  };
});
// The camera flight runs first; the welcome card only appears once it lands.
await page.waitForTimeout(1400);
const midway = await page.evaluate(() => ({ midFlight: window.yard.introRunning }));
await page.waitForTimeout(2600);
const intro = await page.evaluate(() => ({
  seen: window.game.state.missions.introSeen,
  stillFlying: window.yard.introRunning,
  cardShown: !!document.querySelector('.intro-card'),
  title: document.querySelector('.intro-card h2')?.textContent ?? null,
  truckArrived: window.yard.traffic.vehicles.length > 0,
}));
console.log('INTRO:', JSON.stringify({ ...flight, ...midway, ...intro }));
await page.screenshot({ path: `${OUT}/j1-intro.png` });

// Any tap dismisses it, and it never comes back.
await page.mouse.click(195, 300);
await page.waitForTimeout(200);
const dismissed = await page.evaluate(() => {
  window.intro.play();
  return { gone: !document.querySelector('.intro-card'), replays: window.intro.pending };
});
console.log('INTRO DISMISS:', JSON.stringify(dismissed));

// --- The five tutorial missions --------------------------------------------
const tutorial = await page.evaluate(async () => {
  const mod = await import('/src/missions/manager.ts');
  const { TUTORIAL_MISSION_IDS } = await import('/src/data/missions.ts');
  const g = window.game;

  const steps = [];
  const guard = 40;
  // Play the script the chapter describes and record which mission is open at
  // each point. Nothing here calls the mission system directly - the goals are
  // met through the same actions a player performs.
  const step = () => {
    const row = mod.currentTutorial(g);
    return row ? { id: row.def.id, text: row.text, reward: row.rewardText } : null;
  };

  steps.push(step());

  // 1. Dismantle the starter vehicle.
  for (let i = 0; i < 400 && g.state.progressStats.vehiclesDone < 1; i++) {
    const part = g.state.active?.parts.find((p) => !p.done);
    if (!part) break;
    g.tap(part.id);
  }
  mod.refreshMissions(g);
  steps.push(step());

  // 2. Sell.
  g.sellAll();
  mod.refreshMissions(g);
  steps.push(step());

  // 3. Torch. 4. Workshop. 5. Mechanic.
  g.state.level = 4;
  g.addMoney(50_000);
  g.recompute();
  g.buyPurchasable('torch');
  mod.refreshMissions(g);
  steps.push(step());

  g.buyPurchasable('workshop');
  mod.refreshMissions(g);
  steps.push(step());

  const mechanicBefore = g.canBuy('mechanic');
  g.buyPurchasable('mechanic');
  mod.refreshMissions(g);

  return {
    order: TUTORIAL_MISSION_IDS,
    seen: steps.filter(Boolean).map((s) => s.id),
    firstText: steps[0]?.text ?? null,
    firstReward: steps[0]?.reward ?? null,
    mechanicNeededWorkshop: mechanicBefore,
    done: g.state.missions.done.filter((id) => TUTORIAL_MISSION_IDS.includes(id)),
    tutorialFlag: g.state.tutorial.done,
    guard,
  };
});
console.log('TUTORIAL:', JSON.stringify(tutorial));

// How much the opening is allowed to hold back.
//
// While the loop is still being taught, nothing else competes with it. Once it
// is taught, a player who ignores the remaining steps still gets missions -
// the stricter version soft-locked anyone who spent their money elsewhere, and
// the browser flow test sat on "Besseres Werkzeug" for forty vehicles.
const gating = await page.evaluate(async () => {
  const mod = await import('/src/missions/manager.ts');
  const { TUTORIAL_MISSION_IDS } = await import('/src/data/missions.ts');
  const g = window.game;

  const saved = {
    owned: { ...g.state.owned },
    done: [...g.state.missions.done],
    active: [...g.state.missions.active],
    level: g.state.level,
    vehicles: g.state.progressStats.vehiclesDone,
    sales: g.state.progressStats.sales,
    tutorialDone: g.state.tutorial.done,
  };

  /** Rewinds to a company that has done exactly `steps` of the opening. */
  const rewind = (steps, level) => {
    g.state.owned = {};
    g.state.progressStats.vehiclesDone = steps >= 1 ? 1 : 0;
    g.state.progressStats.sales = steps >= 2 ? 1 : 0;
    g.state.tutorial.done = false;
    g.state.missions.done = TUTORIAL_MISSION_IDS.slice(0, steps);
    g.state.missions.active = [];
    g.state.level = level;
    g.recompute();
    mod.refreshMissions(g);
    const open = mod.rows(g);
    return {
      open: open.map((r) => r.def.id),
      kinds: [...new Set(open.map((r) => r.def.kind))],
      tutorialStep: mod.currentTutorial(g)?.def.id ?? null,
    };
  };

  const teaching = rewind(0, 1);
  const taught = rewind(2, 8);

  Object.assign(g.state, { owned: saved.owned, level: saved.level });
  g.state.progressStats.vehiclesDone = saved.vehicles;
  g.state.progressStats.sales = saved.sales;
  g.state.tutorial.done = saved.tutorialDone;
  g.state.missions.done = saved.done;
  g.state.missions.active = saved.active;
  g.recompute();

  return { teaching, taught };
});
console.log('GATING:', JSON.stringify(gating));

// The mechanic really is gated behind the workshop, not just described as such.
const gate = await page.evaluate(async () => {
  const g = window.game;
  const before = { ...g.state.owned };
  delete g.state.owned.workshop;
  g.recompute();
  const blocked = !g.canBuy('mechanic');
  g.state.owned = before;
  g.recompute();
  return { blockedWithoutWorkshop: blocked, allowedWith: g.canBuy('mechanic') };
});
console.log('WORKSHOP GATE:', JSON.stringify(gate));

// --- Task list --------------------------------------------------------------
// The free first upgrade fires on the first finished vehicle; take it so the
// board is clear for the task list.
await page.evaluate(() => document.querySelector('.modal .choice')?.click());
await page.waitForTimeout(400);
await goto(page, 'yard');
const tasks = await page.evaluate(async () => {
  const mod = await import('/src/missions/manager.ts');
  const g = window.game;
  g.state.level = 12;
  g.addMoney(2_000_000);
  g.recompute();
  mod.refreshMissions(g);
  window.app.refreshAll();
  await new Promise((r) => setTimeout(r, 400));

  const cards = [...document.querySelectorAll('.tasks .task')];
  const rows = mod.visibleRows(g);
  return {
    visible: cards.length,
    max: mod.VISIBLE_TASKS,
    open: mod.rows(g).length,
    hasProgressBar: cards.every((c) => !!c.querySelector('.task-bar > i')),
    hasReward: cards.every((c) => (c.querySelector('.task-reward')?.textContent ?? '').length > 0),
    names: rows.map((r) => r.def.name),
  };
});
console.log('TASKS:', JSON.stringify(tasks));
await page.screenshot({ path: `${OUT}/j2-tasks.png` });

// Tracking pins a mission to the top of the list.
const tracking = await page.evaluate(async () => {
  const mod = await import('/src/missions/manager.ts');
  const g = window.game;
  const all = mod.rows(g);
  const last = all[all.length - 1];
  mod.track(g, last.def.id);
  window.app.refreshAll();
  await new Promise((r) => setTimeout(r, 350));
  const first = mod.visibleRows(g)[0];
  return { tracked: g.state.missions.tracked, firstIsTracked: first?.def.id === last.def.id };
});
console.log('TRACKING:', JSON.stringify(tracking));

// --- Rewards ----------------------------------------------------------------
const rewards = await page.evaluate(async () => {
  const mod = await import('/src/missions/rewards.ts');
  const g = window.game;

  const before = {
    money: g.state.money,
    research: g.state.research.points,
    industry: g.state.prestige.points,
    steel: g.state.storage.steel ?? 0,
    queue: g.state.queue.length,
  };

  mod.grant(g, { kind: 'research', amount: 100 });
  mod.grant(g, { kind: 'industry', amount: 2 });
  mod.grant(g, { kind: 'material', material: 'steel', amount: 50 });
  mod.grant(g, { kind: 'vehicle', id: 'kleinwagen', count: 2 });
  mod.grant(g, { kind: 'flag', id: 'test_flag' });

  // A money reward is capped against the delivery ladder, so a huge nominal
  // amount cannot teleport the yard.
  const nominal = 1e12;
  const paid = mod.payout(g, nominal);
  const price = g.buyPrice(g.state.autoBuyVehicle);

  return {
    research: g.state.research.points - before.research,
    industry: g.state.prestige.points - before.industry,
    steel: (g.state.storage.steel ?? 0) - before.steel,
    queued: g.state.queue.length - before.queue,
    flagInUnlocks: g.stats.unlocks.has('test_flag'),
    capped: paid < nominal,
    paidVsPrice: Math.round(paid / price),
    describe: mod.describeAll([{ kind: 'money', amount: 1000 }, { kind: 'crate', tier: 2 }]),
  };
});
console.log('REWARDS:', JSON.stringify(rewards));

// --- Milestones -------------------------------------------------------------
const milestones = await page.evaluate(async () => {
  const mod = await import('/src/missions/milestones.ts');
  const g = window.game;
  const fired = [];
  const off = g.bus.on('milestone', (p) => fired.push(p.id));

  g.state.missions.milestones = [];
  // Company value is assets and stock, not cash - so a pile of gold is what
  // moves it, and a bank balance is not.
  const cashOnly = g.companyValue();
  g.addMoney(1e12);
  const afterCash = g.companyValue();
  g.addMaterial('gold', 400_000);
  g.recompute();
  const value = g.companyValue();

  // Several thresholds are already behind the company, but only one fires per
  // check - the cascade guard.
  mod.checkMilestones(g);
  const afterOne = fired.length;
  for (let i = 0; i < 10; i++) mod.checkMilestones(g);
  off();

  return {
    cashDoesNotCount: afterCash === cashOnly,
    value: Math.round(value),
    afterOneCheck: afterOne,
    total: fired.length,
    defined: mod.rows(g).length,
    prestigeVisible: mod.prestigeVisible(g),
    next: mod.next(g)?.def.id ?? null,
  };
});
console.log('MILESTONES:', JSON.stringify(milestones));

// --- Daily & weekly ---------------------------------------------------------
const timed = await page.evaluate(async () => {
  const daily = await import('/src/missions/daily.ts');
  const mod = await import('/src/missions/manager.ts');
  const { Content } = await import('/src/data/index.ts');
  const g = window.game;

  const day = daily.dayIndex();
  const sameDay = daily.dayIndex(Date.now() + 3_600_000 * 1) >= day;
  const nextDay = daily.dayIndex(Date.now() + 86_400_000) === day + 1;

  // A fresh set for a new day, and the same set twice for the same day.
  g.state.missions.dailyDay = -1;
  g.state.missions.active = g.state.missions.active.filter(
    (m) => Content.mission(m.id)?.kind !== 'daily',
  );
  const accept = (game, def, expires) =>
    game.state.missions.active.push({ id: def.id, target: 1, since: {}, expires });
  daily.rollDaily(g, accept);
  const firstRoll = g.state.missions.active.filter((m) => Content.mission(m.id)?.kind === 'daily');
  daily.rollDaily(g, accept);
  const secondRoll = g.state.missions.active.filter((m) => Content.mission(m.id)?.kind === 'daily');

  // The roll is seeded by the date: the same day always yields the same set.
  g.state.missions.dailyDay = -1;
  g.state.missions.active = g.state.missions.active.filter(
    (m) => Content.mission(m.id)?.kind !== 'daily',
  );
  daily.rollDaily(g, accept);
  const repeat = g.state.missions.active.filter((m) => Content.mission(m.id)?.kind === 'daily');

  return {
    sameDay,
    nextDay,
    weekAdvances: daily.weekIndex(Date.now() + 7 * 86_400_000) === daily.weekIndex() + 1,
    rolled: firstRoll.length,
    noDoubleRoll: secondRoll.length === firstRoll.length,
    deterministic: repeat.map((m) => m.id).join() === firstRoll.map((m) => m.id).join(),
    expiresWithinADay: firstRoll.every((m) => m.expires > 0 && m.expires <= 86_400),
    scaled: mod.targetFor(g, Content.mission('daily_vehicles')) > Content.mission('daily_vehicles').goal.amount,
  };
});
console.log('DAILY/WEEKLY:', JSON.stringify(timed));

// --- Missions screen --------------------------------------------------------
await goto(page, 'missions');
const screen = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('.seg-row .btn-label')].map((n) => n.textContent),
  cards: document.querySelectorAll('#screen .card').length,
  stats: [...document.querySelectorAll('.stat b')].map((n) => n.textContent),
}));
console.log('MISSIONS SCREEN:', JSON.stringify(screen));
await page.screenshot({ path: `${OUT}/j3-missions.png` });

// --- Help & encyclopedia ----------------------------------------------------
await goto(page, 'help');
const help = await page.evaluate(async () => {
  const mod = await import('/src/missions/help.ts');
  const g = window.game;
  const sections = mod.sections(g);
  const locked = sections.filter((s) => !s.unlocked);

  // A chapter opens when its flag arrives, and never before.
  const before = sections.find((s) => s.chapter.id === 'help_research')?.unlocked;
  g.state.missions.flags.push('help_research');
  g.recompute();
  const after = mod.sections(g).find((s) => s.chapter.id === 'help_research')?.unlocked;

  return {
    chapters: sections.length,
    open: sections.filter((s) => s.unlocked).length,
    lockedNames: locked.map((s) => s.chapter.name),
    researchBefore: before,
    researchAfter: after,
    coverage: mod.coverage(g),
    faqEntries: sections.find((s) => s.chapter.id === 'help_basics')?.entries.length ?? 0,
    // Nothing is described before it has been met.
    hidesUndiscovered: sections.some((s) => s.unlocked && s.hidden > 0),
  };
});
console.log('HELP:', JSON.stringify(help));
await page.evaluate(() => window.app.refreshAll());
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/j4-help.png` });

// --- Hints & mentor ---------------------------------------------------------
const hints = await page.evaluate(async () => {
  const mod = await import('/src/missions/hints.ts');
  const g = window.game;
  const seen = [];
  const off = g.bus.on('hint', (p) => seen.push(p.id));

  g.state.settings.hints = true;
  g.state.missions.hints = [];
  mod.resetHints();
  // Empty pad plus money in the bank is the "hint_queue" condition.
  g.state.active = null;
  g.state.queue = [];
  for (let i = 0; i < 2000; i++) mod.tickHints(g, 0.5);
  const withHints = seen.length;
  const unique = new Set(seen).size;

  // Off means off.
  seen.length = 0;
  g.state.settings.hints = false;
  g.state.missions.hints = [];
  mod.resetHints();
  for (let i = 0; i < 2000; i++) mod.tickHints(g, 0.5);
  const withoutHints = seen.length;
  off();

  g.state.settings.mentor = true;
  const line = mod.mentorLine(g, 'missionDone');
  g.state.settings.mentor = false;
  const silent = mod.mentorLine(g, 'missionDone');

  return {
    fired: withHints,
    eachOnce: withHints === unique,
    disabled: withoutHints,
    mentorSpeaks: typeof line === 'string' && line.length > 0,
    mentorSilent: silent === null,
  };
});
console.log('HINTS:', JSON.stringify(hints));

// --- Save migration v4 -> v5 ------------------------------------------------
const migration = await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  const { TUTORIAL_MISSION_IDS } = await import('/src/data/missions.ts');

  const finished = {
    version: 4,
    money: 5e6,
    level: 20,
    tutorial: { step: 5, done: true, choiceOffered: true },
  };
  const done = save.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(finished)))));

  const fresh = { version: 4, money: 500, level: 1, tutorial: { step: 0, done: false } };
  const early = save.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(fresh)))));

  // Unknown missions are dropped rather than kept.
  const junk = {
    version: 5,
    missions: {
      active: [{ id: 'does_not_exist', target: 5 }, { id: 'main_ten_cars', target: 10 }],
      done: ['nope', 'tut_sell'],
      milestones: ['nope', 'ms_10k'],
      tracked: 'does_not_exist',
    },
  };
  const cleaned = save.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(junk)))));

  return {
    version: done?.version,
    veteranCreditedWithTutorial: TUTORIAL_MISSION_IDS.every((id) => done?.missions.done.includes(id)),
    veteranMoneyUnchanged: done?.money === 5e6,
    freshStartsAtZero: early?.missions.done.length === 0,
    keptActive: cleaned?.missions.active.map((m) => m.id),
    keptDone: cleaned?.missions.done,
    keptMilestones: cleaned?.missions.milestones,
    trackedCleared: cleaned?.missions.tracked === '',
    hintsDefault: early?.settings.hints,
  };
});
console.log('MIGRATION v4->v5:', JSON.stringify(migration));

// --- Missions survive a reload ---------------------------------------------
await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  save.saveGame(window.game.state);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const reloaded = await page.evaluate(async () => {
  const mod = await import('/src/missions/manager.ts');
  const g = window.game;
  return {
    active: mod.rows(g).length,
    done: g.state.missions.done.length,
    milestones: g.state.missions.milestones.length,
    introNotReplayed: g.state.missions.introSeen && !document.querySelector('.intro-card'),
  };
});
console.log('RELOAD:', JSON.stringify(reloaded));

// --- Content integrity ------------------------------------------------------
const content = await page.evaluate(async () => {
  const { Content, validateContent } = await import('/src/data/index.ts');
  const kinds = {};
  for (const m of Content.missions) kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;
  return {
    problems: validateContent(),
    missions: Content.missions.length,
    kinds,
    milestones: Content.milestones.length,
    everyMissionRewarded: Content.missions.every((m) => m.rewards.length > 0),
  };
});
console.log('CONTENT:', JSON.stringify(content));

console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
