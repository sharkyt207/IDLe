import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Installability check for the production build.
 *
 * Unlike the other suites this one runs against `dist/` behind a static
 * server, because the things it asks about - the manifest, the icons, the
 * service worker, surviving a lost connection - only exist in a real build.
 *
 *   npm run build && npx serve dist   # or any static server
 *   SCRAP_URL=http://localhost:4173/ node tests/pwa.mjs
 */

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../.screenshots');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SCRAP_URL ?? 'http://localhost:4173/';
const errors = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'allow',
});
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text());
});
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// --- The page itself --------------------------------------------------------
const shell = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  return {
    title: document.title,
    mounted: !!document.querySelector('#app .topbar'),
    tabs: [...document.querySelectorAll('.tabbar .tab-label')].map((n) => n.textContent),
    themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    // The world has to be drawn at the size of its box on a cold start. A
    // production bundle runs before the first layout, and the canvas used to
    // stay 2x2: an installed app that opened on an empty yard.
    canvas: canvas ? { css: canvas.clientWidth, backing: canvas.width } : null,
    canvasSized: !!canvas && canvas.width >= canvas.clientWidth * dpr - 2 && canvas.width > 100,
  };
});
console.log('SHELL:', JSON.stringify(shell));

// --- Manifest ---------------------------------------------------------------
const manifestHref = await page.evaluate(
  () => document.querySelector('link[rel="manifest"]')?.href ?? null,
);
const manifest = await (await fetch(manifestHref)).json();
console.log(
  'MANIFEST:',
  JSON.stringify({
    href: new URL(manifestHref).pathname,
    name: manifest.name,
    display: manifest.display,
    startUrl: manifest.start_url,
    scope: manifest.scope,
    orientation: manifest.orientation,
    themeColor: manifest.theme_color,
    icons: manifest.icons.map((i) => `${i.sizes} ${i.purpose}`),
  }),
);

// Every icon the manifest promises has to actually be there, and be a PNG.
const iconChecks = [];
for (const icon of manifest.icons) {
  const url = new URL(icon.src, manifestHref).href;
  const res = await fetch(url);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  iconChecks.push({ src: icon.src, status: res.status, png: isPng, kb: +(bytes.length / 1024).toFixed(1) });
}
const apple = await fetch(new URL('icons/apple-touch-icon.png', BASE).href);
console.log('ICONS:', JSON.stringify({ manifest: iconChecks, appleTouchIcon: apple.status }));

// --- iOS home screen --------------------------------------------------------
// iOS ignores the manifest for "Zum Home-Bildschirm", so the meta tags are the
// only thing standing between a bookmark and an app.
const ios = await page.evaluate(() => ({
  capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
  title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
  statusBar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
  touchIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
}));
console.log('IOS:', JSON.stringify(ios));

// --- Service worker ---------------------------------------------------------
const worker = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return {
    scope: new URL(reg.scope).pathname,
    active: !!reg.active,
    state: reg.active?.state ?? null,
  };
});
const caches = await page.evaluate(async () => {
  const keys = await window.caches.keys();
  const cache = await window.caches.open(keys[0]);
  const entries = await cache.keys();
  return { keys, cached: entries.length, sample: entries.slice(0, 3).map((r) => new URL(r.url).pathname) };
});
console.log('WORKER:', JSON.stringify(worker));
console.log('CACHE:', JSON.stringify(caches));

// --- Offline ----------------------------------------------------------------
// The point of a home screen icon: it starts without a connection.
await ctx.setOffline(true);
const offlinePage = await ctx.newPage();
const offlineErrors = [];
offlinePage.on('pageerror', (e) => offlineErrors.push(e.message));
await offlinePage.goto(BASE, { waitUntil: 'domcontentloaded' });
await offlinePage.waitForTimeout(2000);
const offline = await offlinePage.evaluate(() => ({
  mounted: !!document.querySelector('#app .topbar'),
  tabs: document.querySelectorAll('.tabbar .tab').length,
  money: document.querySelector('.topbar .money')?.textContent ?? null,
}));
console.log('OFFLINE:', JSON.stringify({ ...offline, pageErrors: offlineErrors }));
await offlinePage.screenshot({ path: `${OUT}/p1-offline.png` });
await ctx.setOffline(false);

console.log('ERRORS:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
