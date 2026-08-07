import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../.screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SCRAP_URL ?? 'http://localhost:5174/';
const errors = [];

async function goto(page, id) {
  await page.evaluate((target) => window.app.select(target), id);
  await page.waitForTimeout(420);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
/** Errors the test provokes on purpose must not fail the suite. */
const EXPECTED = /\[test\]|kaputter Listener/;
page.on('console', (m) => {
  if (m.type() === 'error' && !EXPECTED.test(m.text())) errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.evaluate(() => {
  const g = window.game;
  g.state.tutorial = { step: 5, done: true, choiceOffered: true };
  g.state.level = 20; g.addMoney(50_000_000); g.recompute();
});

// --- Localization -----------------------------------------------------------
const i18n = await page.evaluate(async () => {
  const mod = await import('/src/core/i18n.ts');
  const locales = mod.availableLocales();
  const before = mod.t('nav.market');
  mod.setLocale('en');
  const english = mod.t('nav.market');
  // A locale with no entry for a key must fall back to German, not to the key.
  mod.setLocale('ja');
  const fallback = mod.t('nav.market');
  // Placeholders are substituted, unknown ones are left alone.
  mod.setLocale('de');
  const params = mod.t('hud.units', { amount: '42' });
  const unknown = mod.t('this.key.does.not.exist');
  const contentOverride = mod.tc('machine', 'magnet_crane', 'name', 'Kleiner Magnetkran');
  return {
    locales: locales.map((l) => l.id),
    de: before,
    en: english,
    jaFallsBackToGerman: fallback === before,
    params,
    unknownReturnsKey: unknown === 'this.key.does.not.exist',
    contentOverride,
    untranslatedJa: mod.untranslated('ja').length > 0,
    untranslatedEn: mod.untranslated('en').length,
  };
});
console.log('I18N:', JSON.stringify(i18n));

// Switching the language must repaint the whole shell, not just the settings.
const switched = await page.evaluate(async () => {
  const mod = await import('/src/core/i18n.ts');
  const g = window.game;
  g.state.settings.locale = 'en';
  mod.setLocale('en');
  window.app.refreshAll();
  await new Promise((r) => setTimeout(r, 350));
  const tabs = [...document.querySelectorAll('.tabbar .tab-label')].map((n) => n.textContent);
  g.state.settings.locale = 'de';
  mod.setLocale('de');
  window.app.refreshAll();
  await new Promise((r) => setTimeout(r, 350));
  const back = [...document.querySelectorAll('.tabbar .tab-label')].map((n) => n.textContent);
  return { english: tabs, german: back };
});
console.log('LANGUAGE SWITCH:', JSON.stringify(switched));

// --- Object pool ------------------------------------------------------------
const pool = await page.evaluate(async () => {
  const { Pool } = await import('/src/core/pool.ts');
  let built = 0;
  const p = new Pool(() => ({ n: ++built }), (o) => (o.n = 0), 4);
  const taken = [p.take(), p.take(), p.take()];
  const afterTake = p.stats();
  p.giveAll(taken);
  const afterGive = p.stats();
  const recycled = p.take();
  const afterRecycle = p.stats();

  // The effects system must actually reuse its particles.
  const effects = window.yard.effects;
  effects.budget = 1;
  effects.clear();
  const before = effects.poolStats().particles.created;
  for (let round = 0; round < 12; round++) {
    effects.sparks(0, 0, '#fff', 20);
    effects.update(5);
  }
  const after = effects.poolStats().particles.created;
  return {
    created: built,
    afterTake,
    afterGive,
    afterRecycle,
    recycledIsPooled: recycled.n === 0,
    particlesCreatedFirst: before,
    particlesCreatedAfter240Spawns: after,
    reused: after - before < 40,
  };
});
console.log('POOL:', JSON.stringify(pool));

// --- Logging ----------------------------------------------------------------
const logging = await page.evaluate(async () => {
  const { log, guard, safeNumber } = await import('/src/core/log.ts');
  log.clear();
  log.info('test', 'eine Information');
  log.warn('test', 'eine Warnung');
  log.error('test', 'ein Fehler');
  log.once('info', 'test', 'k', 'nur einmal');
  log.once('info', 'test', 'k', 'nur einmal');
  const guarded = guard('test', 'wirft', () => {
    throw new Error('kaputt');
  });
  const ok = guard('test', 'läuft', () => 42);
  return {
    entries: log.history().length,
    levels: log.history().map((e) => e.level),
    guardedThrowReturnsUndefined: guarded === undefined,
    guardedOk: ok,
    safe: [safeNumber('7', 0), safeNumber('nope', 3), safeNumber(99, 0, 0, 10)],
  };
});
console.log('LOGGING:', JSON.stringify(logging));

// A throwing listener must not stop the other listeners.
const busIsolation = await page.evaluate(async () => {
  const { log } = await import('/src/core/log.ts');
  log.clear();
  const g = window.game;
  let reached = false;
  const offA = g.bus.on('notice', () => {
    throw new Error('kaputter Listener');
  });
  const offB = g.bus.on('notice', () => {
    reached = true;
  });
  g.bus.emit('notice', { text: 'test' });
  offA();
  offB();
  return { secondListenerRan: reached, logged: log.history().some((e) => e.level === 'error') };
});
console.log('BUS ISOLATION:', JSON.stringify(busIsolation));

// --- Event manager ----------------------------------------------------------
const events = await page.evaluate(async () => {
  const mod = await import('/src/game/systems/events.ts');
  const g = window.game;
  const fired = [];
  const off = g.bus.on('randomEvent', (p) => fired.push(p.id));
  const offDay = g.bus.on('dayEnded', () => fired.push('dayEnded'));

  // Force every event once and confirm none of them throws or destroys state.
  const results = [];
  for (const def of mod.RANDOM_EVENTS) {
    const moneyBefore = g.state.money;
    let text = null;
    try {
      text = def.apply(g);
    } catch (err) {
      text = `THREW: ${err}`;
    }
    results.push({ id: def.id, ok: typeof text === 'string' && !text.startsWith('THREW'), moneyBefore: Math.round(moneyBefore) });
  }

  // Run long enough for the timer to roll at least once.
  mod.resetEvents();
  for (let i = 0; i < 4000; i++) g.tick(0.1);
  off();
  offDay();
  return {
    definitions: mod.RANDOM_EVENTS.map((e) => e.id),
    allApplyCleanly: results.every((r) => r.ok),
    firedDuringTick: fired.length,
  };
});
console.log('EVENTS:', JSON.stringify(events));

// --- Saving -----------------------------------------------------------------
const saving = await page.evaluate(async () => {
  const g = window.game;
  let saves = 0;
  const off = g.bus.on('saved', () => saves++);

  // A purchase emits `progress`, which the shell turns into a save.
  g.addMoney(1e6);
  g.buyPurchasable('hammer');
  await new Promise((r) => setTimeout(r, 120));
  const afterBuy = saves;

  // The debounce must swallow a burst.
  for (let i = 0; i < 5; i++) g.bus.emit('progress', undefined);
  await new Promise((r) => setTimeout(r, 120));
  const afterBurst = saves;

  // A manual save always goes through.
  window.app.saveNow(true);
  await new Promise((r) => setTimeout(r, 60));
  const afterManual = saves;
  off();
  return { afterBuy, afterBurst, burstDebounced: afterBurst === afterBuy, afterManual };
});
console.log('SAVING:', JSON.stringify(saving));

// --- Debug mode -------------------------------------------------------------
const debugMode = await page.evaluate(async () => {
  const panel = window.debug;
  const g = window.game;
  const before = { money: g.state.money, level: g.state.level, playtime: g.state.playtime };

  panel.open(() => undefined);
  await new Promise((r) => setTimeout(r, 60));
  const modal = document.querySelector('.modal');
  const buttons = [...(modal?.querySelectorAll('.card-actions button, .btn-row button') ?? [])].map(
    (b) => b.textContent.trim(),
  );
  const sections = [...(modal?.querySelectorAll('.screen-title') ?? [])].map((s) => s.textContent);

  // Money button
  modal?.querySelectorAll('.btn-row button')[0]?.click();
  const moneyGrew = g.state.money > before.money;

  // Fast-forward must advance playtime through the real tick path.
  const ff = [...(modal?.querySelectorAll('.btn-row button') ?? [])].find((b) => /\+10 min|\+10 Min/.test(b.textContent));
  ff?.click();
  const timeAdvanced = g.state.playtime > before.playtime + 500;

  panel.toggleFps();
  const fpsVisible = document.querySelector('.debug-fps')?.style.display !== 'none';
  panel.toggleFps();

  document.querySelector('.modal-close')?.click();
  return { buttons: buttons.length, sections, moneyGrew, timeAdvanced, fpsVisible, hasLog: !!modal?.querySelector('.debug-log') };
});
console.log('DEBUG:', JSON.stringify(debugMode));

// --- Save migration v3 -> v4 -----------------------------------------------
const migration = await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  const legacy = { version: 3, money: 500, level: 3, settings: { haptics: false, theme: 'winter', uiScale: 1.2 } };
  const state = save.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(legacy)))));
  return {
    version: state?.version,
    keptTheme: state?.settings.theme,
    keptScale: state?.settings.uiScale,
    gotLocale: typeof state?.settings.locale === 'string',
  };
});
console.log('MIGRATION v3->v4:', JSON.stringify(migration));

// --- Corrupt save must not brick the start ---------------------------------
const corrupt = await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  return {
    garbage: save.importSave('nicht base64 ###') === null,
    emptyObject: save.importSave(btoa('{}'))?.version,
    // Unknown content is dropped rather than kept.
    unknownIds: (() => {
      const raw = { version: 4, owned: { does_not_exist: 5, hammer: 2 }, storage: { nope: 10, steel: 3 } };
      const state = save.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(raw)))));
      return { owned: Object.keys(state?.owned ?? {}), storage: Object.keys(state?.storage ?? {}) };
    })(),
  };
});
console.log('ROBUSTNESS:', JSON.stringify(corrupt));

// --- The language survives a reload ----------------------------------------
await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  window.game.state.settings.locale = 'en';
  save.saveGame(window.game.state);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const reloaded = await page.evaluate(async () => {
  const mod = await import('/src/core/i18n.ts');
  return {
    locale: window.game.state.settings.locale,
    active: mod.currentLocale(),
    tabs: [...document.querySelectorAll('.tabbar .tab-label')].map((n) => n.textContent),
  };
});
console.log('RELOAD:', JSON.stringify(reloaded));
await page.screenshot({ path: `${OUT}/a1-english.png` });

console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
