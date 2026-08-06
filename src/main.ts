import './styles.css';
import { Content, validateContent } from './data';
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
  if (import.meta.env.DEV) {
    const problems = validateContent();
    if (problems.length) console.warn('[content]\n' + problems.join('\n'));
  }

  const mount = document.getElementById('app');
  if (!mount) throw new Error('#app fehlt');

  const loaded = loadGame();
  const game = new Game(loaded?.state);

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

boot();
