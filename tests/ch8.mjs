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
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// --- Six main areas ---------------------------------------------------------
await page.evaluate(() => {
  const g = window.game;
  g.state.tutorial = { step: 5, done: true, choiceOffered: true };
  g.state.level = 30; g.addMoney(1e9);
  for (const d of window.content.purchasables.filter((p) => p.category !== 'decor')) {
    for (let i = 0; i < 3; i++) g.buyPurchasable(d.id);
  }
  g.recompute(); g.bus.emit('progress', undefined);
});
await page.waitForTimeout(600);

const nav = await page.evaluate(() => ({
  areas: [...document.querySelectorAll('.tabbar .tab')].map((t) => t.dataset.id),
  labels: [...document.querySelectorAll('.tabbar .tab .tab-label')].map((t) => t.textContent),
}));
console.log('AREAS:', JSON.stringify(nav));

const subs = {};
for (const id of nav.areas) {
  await goto(page, id);
  subs[id] = await page.evaluate(() => {
    const hub = [...document.querySelectorAll('.screen.hub')].find((h) => h.style.display !== 'none');
    return [...(hub?.querySelectorAll('.hub-nav .seg') ?? [])].map((b) => b.dataset.id);
  });
}
console.log('HUBS:', JSON.stringify(subs));

// --- HUD --------------------------------------------------------------------
await goto(page, 'yard');
const hud = await page.evaluate(() => ({
  top: [...document.querySelectorAll('.topbar .res-chip')].map((c) => c.title),
  money: document.querySelector('.topbar .money')?.textContent,
  left: document.querySelectorAll('.rail-left .rail-row').length,
  right: document.querySelectorAll('.rail-right .rail-row').length,
  railsOnWorld: getComputedStyle(document.querySelector('.rail-left')).display !== 'none',
}));
console.log('HUD:', JSON.stringify(hud));

// Off the isometric view the rails go away so they cannot cover a list. Since
// chapter 10 the open-task count travels on as a chip in the top bar, which is
// a reserved band rather than an overlay.
const railsOffWorld = await page.evaluate(async () => {
  window.app.select('stats');
  await new Promise((r) => setTimeout(r, 400));
  const chips = [...document.querySelectorAll('.topbar .res-chip')].map((c) => c.title);
  return {
    railsHidden: getComputedStyle(document.querySelector('.rail-left')).display === 'none',
    taskChipTravels: chips.includes('Aufgaben'),
  };
});
console.log('RAILS off-world:', JSON.stringify(railsOffWorld));

// --- Themes -----------------------------------------------------------------
const themes = await page.evaluate(async () => {
  const { THEMES } = await import('/src/data/ui.ts');
  const { applyTheme, activeTheme } = await import('/src/ui/theme.ts');
  const g = window.game;
  const out = [];
  for (const theme of THEMES) {
    g.state.settings.theme = theme.id;
    applyTheme(g.state.settings);
    const css = getComputedStyle(document.documentElement);
    out.push({
      id: theme.id,
      attr: document.documentElement.dataset.theme,
      bg: css.getPropertyValue('--bg').trim(),
      blue: css.getPropertyValue('--blue').trim(),
      tint: activeTheme().world.tintStrength,
      weather: activeTheme().world.weather ?? null,
    });
  }
  g.state.settings.theme = 'standard';
  applyTheme(g.state.settings);
  return out;
});
console.log('THEMES:', JSON.stringify(themes));

// --- Accessibility ----------------------------------------------------------
const access = await page.evaluate(async () => {
  const { applyTheme, particleScale, clampScale } = await import('/src/ui/theme.ts');
  const g = window.game;
  const s = g.state.settings;
  const root = document.documentElement;

  s.uiScale = 1.5; applyTheme(s);
  const big = root.style.fontSize;
  s.uiScale = 0.8; applyTheme(s);
  const small = root.style.fontSize;

  s.colorblind = true; applyTheme(s);
  const cbGreen = getComputedStyle(root).getPropertyValue('--green').trim();
  const cbRed = getComputedStyle(root).getPropertyValue('--red').trim();
  s.colorblind = false;

  s.reducedEffects = true; applyTheme(s);
  const reduced = { attr: root.dataset.reducedMotion, particles: particleScale(s) };
  s.reducedEffects = false;

  s.leftHanded = true; applyTheme(s);
  const hand = root.dataset.hand;
  s.leftHanded = false;

  s.uiScale = 1; applyTheme(s);
  return {
    big, small,
    clamped: [clampScale(0.1), clampScale(9)],
    cbGreen, cbRed,
    reduced,
    hand,
    particlesNormal: particleScale(s),
  };
});
console.log('ACCESSIBILITY:', JSON.stringify(access));

// --- Design system ----------------------------------------------------------
const design = await page.evaluate(async () => {
  const c = await import('/src/ui/components.ts');
  const host = document.createElement('div');
  document.body.appendChild(host);

  const primary = c.primaryButton({ label: 'Kaufen', icon: '💶', hint: '100 €' });
  const secondary = c.secondaryButton({ label: 'Abbrechen' });
  const icon = c.iconButton('⚙️', 'Regeln');
  const card = c.infoCard({ icon: '🤖', title: 'Sortierroboter', subtitle: 'Test', progress: 0.4, accent: '#4a9fe0' });
  const bar = c.progressBar(0.66, 'good', '66 %');
  const chip = c.badge('×3', 'info');
  const status = c.statusIndicator('Läuft', 'good');
  const rarity = c.rarityBadge('mythic');
  for (const node of [primary, secondary, icon, card, bar, chip, status, rarity]) host.appendChild(node);

  const style = getComputedStyle(primary);
  const out = {
    classes: [primary, secondary, icon, card, bar, chip, status, rarity].map((n) => n.className),
    primaryHasGradient: style.backgroundImage.includes('gradient'),
    primaryHasShadow: style.boxShadow !== 'none',
    primaryRounded: parseFloat(style.borderRadius) > 0,
    primaryHasIcon: !!primary.querySelector('.btn-icon'),
    cardAccent: card.style.getPropertyValue('--card-accent'),
    rarityColor: rarity.style.getPropertyValue('--chip-tone'),
  };
  host.remove();
  return out;
});
console.log('DESIGN SYSTEM:', JSON.stringify(design));

// --- Press animation --------------------------------------------------------
const press = await page.evaluate(async () => {
  const c = await import('/src/ui/components.ts');
  const btn = c.primaryButton({ label: 'Test' });
  document.body.appendChild(btn);
  btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const down = btn.style.transform;
  btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  const up = btn.style.transform;
  const spring = btn.style.transition;
  btn.remove();
  return { down, up, spring };
});
console.log('PRESS:', JSON.stringify(press));

// --- Dialog anatomy ---------------------------------------------------------
const dialogInfo = await page.evaluate(async () => {
  const c = await import('/src/ui/components.ts');
  const close = c.dialog({ title: 'Testfenster', icon: '🔧', body: 'Text', content: document.createElement('div') });
  await new Promise((r) => requestAnimationFrame(r));
  const backdrop = document.querySelector('.modal-backdrop');
  const out = {
    hasHeader: !!document.querySelector('.modal-head h2'),
    hasIcon: !!document.querySelector('.modal-icon'),
    closeTopRight: !!document.querySelector('.modal-head .modal-close'),
    opens: backdrop?.classList.contains('open'),
    shadow: getComputedStyle(document.querySelector('.modal')).boxShadow !== 'none',
  };
  close();
  return out;
});
console.log('DIALOG:', JSON.stringify(dialogInfo));

// --- Tooltip (long press) ---------------------------------------------------
const tip = await page.evaluate(async () => {
  const c = await import('/src/ui/components.ts');
  const anchor = document.createElement('button');
  anchor.textContent = 'Halten';
  document.body.appendChild(anchor);
  c.tooltip(anchor, () => 'Erklärung', 60);
  anchor.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await new Promise((r) => setTimeout(r, 160));
  const shown = !!document.querySelector('.tooltip');
  const text = document.querySelector('.tooltip')?.textContent;
  anchor.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  const hidden = !document.querySelector('.tooltip');
  anchor.remove();
  return { shown, text, hiddenOnRelease: hidden };
});
console.log('TOOLTIP:', JSON.stringify(tip));

// --- Machine detail window --------------------------------------------------
const details = await page.evaluate(async () => {
  const { openDetails } = await import('/src/ui/details.ts');
  // The previous dialog fades out; wait for it to leave the DOM first.
  await new Promise((r) => setTimeout(r, 260));
  openDetails(window.game, 'magnet_crane');
  await new Promise((r) => setTimeout(r, 60));
  const modal = document.querySelector('.modal');
  const out = {
    title: modal?.querySelector('h2')?.textContent,
    hasHero: !!modal?.querySelector('.detail-hero'),
    tiles: [...(modal?.querySelectorAll('.stat span') ?? [])].map((s) => s.textContent),
    hasMaintenance: modal?.textContent.includes('Wartungszustand'),
    hasUpgrade: modal?.textContent.includes('Ausbauen'),
  };
  document.querySelector('.modal-close')?.click();
  return out;
});
console.log('DETAILS:', JSON.stringify(details));

// --- Sound (synthesised, no assets) -----------------------------------------
const sound = await page.evaluate(async () => {
  const { SoundSystem, SOUND_PREVIEW } = await import('/src/audio/sound.ts');
  const s = { ...window.game.state.settings };
  const sys = new SoundSystem(s);
  sys.unlock();
  let threw = null;
  try {
    for (const id of ['tap', 'hit', 'shred', 'hydraulic', 'weld', 'engine', 'build', 'coin', 'levelUp']) {
      sys.play(id);
    }
    s.sound = false;
    sys.update(s);
    sys.play('hit');
  } catch (err) {
    threw = String(err);
  }
  sys.dispose();
  return { previews: SOUND_PREVIEW.length, threw };
});
console.log('SOUND:', JSON.stringify(sound));

// --- Gestures: double tap centres the camera --------------------------------
await goto(page, 'yard');
const gestures = await page.evaluate(async () => {
  const r = window.yard;
  const before = { x: r.camera.x, y: r.camera.y };
  r.centerOnScreen(60, 60);
  await new Promise((res) => setTimeout(res, 60));
  const moved = r.camera.x !== before.x || r.camera.y !== before.y;
  const scaleBefore = r.camera.scale;
  r.camera.zoomAt(100, 100, 1.4);
  return { doubleTapMoves: moved, pinchZooms: r.camera.scale !== scaleBefore };
});
console.log('GESTURES:', JSON.stringify(gestures));

// --- Rarity colours ---------------------------------------------------------
const rarity = await page.evaluate(async () => {
  const { RARITY_COLOR, RARITY_NAME, RARITY_ORDER } = await import('/src/data/ui.ts');
  return {
    order: RARITY_ORDER,
    names: RARITY_ORDER.map((t) => RARITY_NAME[t]),
    colors: RARITY_ORDER.map((t) => RARITY_COLOR[t]),
    hasMythic: RARITY_ORDER.includes('mythic'),
  };
});
console.log('RARITY:', JSON.stringify(rarity));

// --- Dust on build ----------------------------------------------------------
const dust = await page.evaluate(async () => {
  const r = window.yard;
  // Expire whatever is in flight so the two measurements are comparable.
  const drain = () => r.effects.update(5);
  drain();
  r.effects.budget = 1;
  r.effects.dust(0, 0, 20);
  const full = r.effects.particleCount();
  drain();
  r.effects.budget = 0.25;
  r.effects.dust(0, 0, 20);
  const reduced = r.effects.particleCount();
  drain();
  r.effects.budget = 1;
  return { full, reduced, budgetWorks: reduced < full };
});
console.log('DUST:', JSON.stringify(dust));

// --- Save round-trip of the settings ---------------------------------------
await page.evaluate(async () => {
  const { saveGame } = await import('/src/game/save.ts');
  const s = window.game.state.settings;
  s.theme = 'winter'; s.uiScale = 1.25; s.colorblind = true;
  s.reducedEffects = true; s.leftHanded = true; s.volumeMusic = 0.1;
  saveGame(window.game.state);
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(900);
const restored = await page.evaluate(() => ({
  settings: window.game.state.settings,
  themeAttr: document.documentElement.dataset.theme,
  hand: document.documentElement.dataset.hand,
  fontSize: document.documentElement.style.fontSize,
}));
console.log('RELOAD:', JSON.stringify(restored));

// Screenshot each theme for the record.
for (const theme of ['standard', 'night', 'winter']) {
  await page.evaluate(async (id) => {
    const { applyTheme } = await import('/src/ui/theme.ts');
    window.game.state.settings.theme = id;
    applyTheme(window.game.state.settings);
    window.app.select('yard');
  }, theme);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/t-${theme}.png` });
}

// --- v2 -> v3 migration -----------------------------------------------------
const migration = await page.evaluate(async () => {
  const save = await import('/src/game/save.ts');
  const legacy = { version: 2, money: 1000, level: 5, settings: { haptics: false } };
  const state = save.importSave(btoa(unescape(encodeURIComponent(JSON.stringify(legacy)))));
  return { version: state?.version, settings: state?.settings };
});
console.log('MIGRATION v2->v3:', JSON.stringify(migration));

console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
