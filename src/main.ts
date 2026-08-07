import './styles.css';
import { Content, validateContent } from './data';
import { installLocales, LOCALES } from './locales';
import { setLocale, untranslated } from './core/i18n';
import { log } from './core/log';
import { Game } from './game/game';
import { loadGame, saveGame } from './game/save';
import { simulateOffline } from './game/systems/offline';
import { App } from './ui/app';

/**
 * Boot sequence:
 *   validate content → load save → fold offline time → start the shell.
 * Offline progress runs before the UI exists so the player sees one summary
 * instead of a storm of toasts.
 */
function boot(): void {
  // Locales first: everything that renders afterwards asks `t()` for its text.
  installLocales();

  if (import.meta.env.DEV) {
    const problems = validateContent();
    if (problems.length) log.warn('content', `\n${problems.join('\n')}`);
    for (const locale of LOCALES) {
      const missing = untranslated(locale.id);
      if (missing.length > 0) {
        log.debug('i18n', `${locale.id}: ${missing.length} Schlüssel noch nicht übersetzt`);
      }
    }
  }

  const mount = document.getElementById('app');
  if (!mount) throw new Error('#app fehlt');

  const loaded = loadGame();
  const game = new Game(loaded?.state);
  setLocale(game.state.settings.locale);

  const report = loaded ? simulateOffline(game, loaded.awaySeconds) : null;

  const app = new App(game, mount);
  if (report) app.showOfflineReport(report);

  saveGame(game.state);

  // Expose for debugging and automated playtests in dev builds only.
  if (import.meta.env.DEV) {
    const debug = window as unknown as Record<string, unknown>;
    debug.game = game;
    debug.content = Content;
  }
}

/**
 * Registers the offline worker (production builds only).
 *
 * It waits for `load` so the first paint never competes with the precache, and
 * it fails quietly: a browser without service workers, or a page served over
 * plain HTTP, still plays the game - it just does not survive a tunnel.
 */
function registerWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    // Relative to the document, so the same build works at a domain root and
    // under a project path like /IDLe/.
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch((error) => {
      log.warn('app', 'Offline-Modus nicht verfügbar', error);
    });
  });
}

boot();
registerWorker();
