import { Content } from '../data';
import { fmt, money } from '../core/format';
import { t } from '../core/i18n';
import { log } from '../core/log';
import type { Game } from '../game/game';
import { clearSave, saveGame } from '../game/save';
import { doPrestige } from '../progress/prestige';
import { check as checkAchievements } from '../progress/achievements';
import { finishResearch } from '../progress/research';
import { dialog, secondaryButton, sectionTitle, statGrid, statTile } from './components';
import { clear, el } from './dom';

/**
 * Developer mode (GDD chapter 9).
 *
 * Opened from a long press on the level chip, and only in dev builds - the
 * whole module is behind `import.meta.env.DEV`, so it is tree-shaken out of a
 * release bundle rather than merely hidden.
 *
 * It exists to make the late game testable in seconds instead of hours: every
 * balance question in chapters 4 to 7 was answered by fast-forwarding here or
 * in the headless harness.
 */
export class DebugPanel {
  /** Frames-per-second readout, updated by the shell while enabled. */
  private fpsNode = el('div', 'debug-fps');
  private fpsVisible = false;
  private frames = 0;
  private frameTimer = 0;
  private fps = 0;

  constructor(private game: Game) {
    document.body.appendChild(this.fpsNode);
    this.fpsNode.style.display = 'none';
  }

  /** Called every frame by the shell; costs nothing while the readout is off. */
  sample(dt: number): void {
    if (!this.fpsVisible) return;
    this.frames++;
    this.frameTimer += dt;
    if (this.frameTimer < 0.5) return;
    this.fps = this.frames / this.frameTimer;
    this.frames = 0;
    this.frameTimer = 0;
    const particles = `${fmt(this.particleCount(), 0)} P`;
    this.fpsNode.textContent = `${this.fps.toFixed(0)} FPS · ${particles}`;
  }

  private particleCount(): number {
    const yard = (window as unknown as { yard?: { effects?: { particleCount(): number } } }).yard;
    return yard?.effects?.particleCount() ?? 0;
  }

  toggleFps(): void {
    this.fpsVisible = !this.fpsVisible;
    this.fpsNode.style.display = this.fpsVisible ? '' : 'none';
  }

  /** The panel itself. */
  open(onChange: () => void): void {
    const { game } = this;
    const content = el('div');

    const rebuild = () => {
      clear(content);

      content.appendChild(
        statGrid(
          statTile(money(game.state.money), t('debug.money.label')),
          statTile(`Lv ${game.state.level}`, t('common.level')),
          statTile(fmt(game.state.research.points, 0), t('debug.points')),
          statTile(`${this.fps.toFixed(0)}`, 'FPS'),
        ),
      );

      const row = (...buttons: HTMLElement[]) => {
        const r = el('div', 'btn-row');
        for (const b of buttons) r.appendChild(b);
        content.appendChild(r);
      };

      const act = (label: string, fn: () => void) =>
        secondaryButton({
          label,
          onClick: () => {
            fn();
            game.recompute();
            checkAchievements(game);
            onChange();
            rebuild();
          },
        });

      content.appendChild(sectionTitle(t('debug.resources')));
      row(
        act(t('debug.money', { amount: '100 K' }), () => game.addMoney(100_000)),
        act(t('debug.money', { amount: '1 Mrd' }), () => game.addMoney(1e9)),
        act(t('debug.levelUp', { levels: 5 }), () => {
          game.state.level += 5;
        }),
      );

      content.appendChild(sectionTitle(t('debug.progress')));
      row(
        act(t('debug.unlockResearch'), () => {
          game.state.research.points += 100_000;
          for (const tech of Content.research) finishResearch(game, tech.id, tech.maxLevel);
        }),
        act(t('debug.buildAll'), () => {
          for (const def of Content.purchasables) {
            if (def.category === 'decor') continue;
            game.state.owned[def.id] = def.maxCount;
          }
        }),
        act(t('debug.prestige'), () => {
          if (!doPrestige(game)) {
            log.warn('debug', 'Prestige-Bedingungen sind nicht erfüllt');
          }
        }),
      );

      content.appendChild(sectionTitle(t('debug.world')));
      row(
        act(t('debug.fastForward', { minutes: 10 }), () => fastForward(game, 600)),
        act(t('debug.fastForward', { minutes: 60 }), () => fastForward(game, 3600)),
        act(t('debug.spawnVehicle'), () => {
          const unlocked = Content.vehicles.filter((v) => game.isUnlocked(v.id));
          const pick = unlocked[unlocked.length - 1] ?? Content.vehicles[0];
          game.buyVehicle(pick.id, true, true);
        }),
      );

      content.appendChild(sectionTitle(t('debug.tools')));
      row(
        secondaryButton({ label: t('debug.fps'), onClick: () => this.toggleFps() }),
        secondaryButton({
          label: t('settings.saveNow'),
          onClick: () => {
            saveGame(game.state);
            game.bus.emit('saved', { manual: true });
          },
        }),
        secondaryButton({
          label: t('debug.reset'),
          tone: 'bad',
          onClick: () => {
            clearSave();
            location.reload();
          },
        }),
      );

      // The log ring buffer, so a problem can be read without devtools.
      content.appendChild(sectionTitle(t('debug.logSection')));
      const logBox = el('div', 'debug-log');
      for (const entry of log.history().slice(-14).reverse()) {
        const line = el('div', `debug-log-line ${entry.level}`);
        line.textContent = `${new Date(entry.time).toLocaleTimeString('de-DE')} [${entry.scope}] ${entry.message}`;
        logBox.appendChild(line);
      }
      if (log.history().length === 0) logBox.appendChild(el('div', 'card-desc', t('debug.logEmpty')));
      content.appendChild(logBox);
    };

    rebuild();
    dialog({ title: t('debug.title'), icon: '🛠️', content });
  }
}

/**
 * Runs the simulation forward in chunks.
 *
 * Uses the same path as offline progress so a fast-forward and a real absence
 * produce the same result - a debug tool that lies about the game is worse
 * than no debug tool.
 */
function fastForward(game: Game, seconds: number): void {
  const chunks = Math.min(400, Math.max(1, Math.ceil(seconds / 5)));
  const dt = seconds / chunks;
  for (let i = 0; i < chunks; i++) game.tick(dt);
  log.info('debug', `${Math.round(seconds / 60)} Minuten vorgespult`);
}
