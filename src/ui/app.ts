import { BALANCE } from '../data/balance';
import { Content } from '../data';
import { UI } from '../data/ui';
import { duration, fmt, money } from '../core/format';
import { currentLocale, setLocale, t } from '../core/i18n';
import { log } from '../core/log';
import type { Game } from '../game/game';
import { saveGame } from '../game/save';
import { simulateOffline, type OfflineReport } from '../game/systems/offline';
import { SoundSystem } from '../audio/sound';
import { applyTheme } from './theme';
import { dialog, infoCard, sectionTitle, statGrid, statTile, attachPress, tooltip } from './components';
import { Hud } from './hud';
import { clear, el } from './dom';
import type { Screen } from './screen';
import { Toasts } from './toast';
import { Tutorial } from './tutorial';
import { TaskList } from './tasks';
import { Intro } from './intro';
import { DebugPanel } from './debug';
import { mentorLine } from '../missions/hints';
import { refreshMissions, visibleRows } from '../missions/manager';
import { BuildScreen } from './screens/build';
import { HelpScreen } from './screens/help';
import { HubScreen } from './screens/hub';
import { MarketScreen } from './screens/market';
import { MissionsScreen } from './screens/missions';
import { ResearchScreen } from './screens/research';
import { SettingsScreen } from './screens/settings';
import { StaffScreen } from './screens/staff';
import { StatisticsScreen } from './screens/statistics';
import { StorageScreen } from './screens/storage';
import { TradeScreen } from './screens/trade';
import { YardScreen } from './screens/yard';

const STEP = 1 / BALANCE.tickRate;

/**
 * Application shell (GDD chapter 8).
 *
 * Six main areas in the bottom bar - Schrottplatz, Markt, Forschung,
 * Mitarbeiter, Statistik, Einstellungen - with hubs behind the two that cover
 * several surfaces. The HUD, the theme and the sound system all live here so
 * screens stay dumb: they render, the shell decides when.
 */
export class App {
  private root: HTMLElement;
  private screensHost = el('div');
  private tabbar = el('nav', 'tabbar');
  private toasts: Toasts;
  private tutorial: Tutorial;
  private tasks: TaskList;
  private intro: Intro;
  private hud: Hud;
  private sound: SoundSystem;
  /** Only built in dev builds - the whole module drops out of a release. */
  private debug?: DebugPanel;

  private screens: Screen[] = [];
  private yard: YardScreen;
  private activeId = 'yard';

  /** Signature of the last tab bar build - see `buildTabs`. */
  private tabSignature = '';

  private accumulator = 0;
  private lastFrame = 0;
  private uiTimer = 0;
  private saveTimer = 0;
  private hiddenAt = 0;
  private lastSave = 0;

  constructor(
    private game: Game,
    mount: HTMLElement,
  ) {
    this.root = mount;
    clear(this.root);

    setLocale(game.state.settings.locale);
    applyTheme(game.state.settings);
    this.sound = new SoundSystem(game.state.settings);

    this.hud = new Hud(game);
    this.root.appendChild(this.hud.top);

    this.screensHost.id = 'screen';
    this.root.appendChild(this.screensHost);
    this.root.appendChild(this.hud.left);
    this.root.appendChild(this.hud.right);
    this.root.appendChild(this.tabbar);

    this.toasts = new Toasts(document.body);
    this.tutorial = new Tutorial(game, (tab) => this.select(tab));
    document.body.appendChild(this.tutorial.root);

    this.tasks = new TaskList(game, (screen) => this.select(screen));
    this.hud.taskHost.appendChild(this.tasks.root);
    this.hud.onNavigate = (id) => this.select(id);

    this.yard = new YardScreen(game);
    this.yard.sound = this.sound;

    // The opening sequence drives the world renderer directly - the camera
    // flight and the arriving truck are both things only it can do.
    this.intro = new Intro(game, {
      flyOver: (seconds) => this.yard.renderer.startIntro(seconds),
      deliver: () => this.yard.renderer.traffic.queueDelivery(),
    });
    document.body.appendChild(this.intro.root);

    const stats = new StatisticsScreen(game);
    const settings = new SettingsScreen(game, this.sound);
    const reset = () => {
      this.select('yard');
      this.refreshAll();
    };
    stats.onReset = reset;
    settings.onReset = reset;

    // The six main areas from the GDD. Two of them are hubs.
    this.screens = [
      new HubScreen('yard', 'nav.yard', '🏗️', [this.yard, new BuildScreen(game)]),
      new HubScreen('market', 'nav.market', '🛒', [
        new MarketScreen(game),
        new StorageScreen(game),
        new TradeScreen(game),
      ]),
      new ResearchScreen(game),
      new StaffScreen(game),
      // Statistik is a hub too now: the numbers, the missions and the
      // encyclopedia are all "look things up", and the GDD caps the bottom bar
      // at six areas (chapter 8).
      new HubScreen('stats', 'nav.stats', '📊', [stats, new MissionsScreen(game), new HelpScreen(game)]),
      settings,
    ];
    for (const screen of this.screens) {
      screen.root.style.display = 'none';
      this.screensHost.appendChild(screen.root);
    }

    this.buildTabs();
    this.bindEvents();

    // Dev handle for automated playtests, plus the developer panel.
    if (import.meta.env.DEV) {
      const handle = window as unknown as Record<string, unknown>;
      handle.yard = this.yard.renderer;
      handle.app = this;
      handle.intro = this.intro;
      this.debug = new DebugPanel(game);
      handle.debug = this.debug;
      // Long-press the level chip to open it - no button in the real UI.
      tooltip(this.hud.top, () => t('debug.enabled'));
      let hold: number | undefined;
      this.hud.top.addEventListener('pointerdown', () => {
        hold = window.setTimeout(() => this.debug?.open(() => this.refreshAll()), 900);
      });
      const cancel = () => window.clearTimeout(hold);
      this.hud.top.addEventListener('pointerup', cancel);
      this.hud.top.addEventListener('pointercancel', cancel);
    }

    this.select('yard');
    // Offer whatever should already be open before the first frame, so a new
    // company sees its first task immediately rather than half a second later.
    refreshMissions(game);
    this.tutorial.update();
    this.tasks.refresh();
    if (this.intro.pending) this.intro.play();
    this.loop(performance.now());
  }

  // -------------------------------------------------------------------------
  // Chrome
  // -------------------------------------------------------------------------

  /**
   * Rebuilds the bottom bar only when it would actually look different.
   *
   * It used to be rebuilt on every progress event, which replaces the button
   * under the player's finger several times a second - on a real device that
   * shows up as taps that do not register.
   */
  private buildTabs(): void {
    const visible = this.screens.filter((s) => !s.available || s.available());
    // The locale is part of the signature: the ids do not change when the
    // language does, but every label does.
    const signature = [
      currentLocale(),
      ...visible.map((s) => `${s.id}:${s.id === this.activeId ? 1 : 0}:${s.hasNews?.() ? 1 : 0}`),
    ].join('|');
    if (signature === this.tabSignature) return;
    this.tabSignature = signature;

    clear(this.tabbar);
    for (const screen of this.screens) {
      if (screen.available && !screen.available()) continue;
      const tab = el('button', `tab${screen.id === this.activeId ? ' active' : ''}`);
      tab.dataset.id = screen.id;
      tab.appendChild(el('span', 'tab-icon', screen.icon));
      // Screen labels are i18n keys where a screen has one; `t` falls through
      // to the raw string for anything not yet keyed.
      tab.appendChild(el('span', 'tab-label', label(screen.label)));
      if (screen.hasNews?.()) tab.appendChild(el('span', 'badge'));
      attachPress(tab, () => {
        this.sound.play('tap');
        this.select(screen.id);
      });
      this.tabbar.appendChild(tab);
    }
  }

  private bindEvents(): void {
    const { bus } = this.game;

    bus.on('notice', ({ text, icon, tone }) => {
      this.toasts.show(text, icon, tone);
      if (tone === 'warn') this.sound.play('error');
      else if (tone === 'good') this.sound.play('confirm');
    });

    bus.on('levelUp', ({ level }) => {
      this.toasts.show(`Level ${level} erreicht!`, '⭐', 'good');
      this.sound.play('levelUp');
      this.buildTabs();
      this.refreshActive();
    });

    bus.on('sold', ({ amount, auto }) => {
      if (!auto && amount > 0) this.sound.play('sell');
    });

    // Missions, milestones and hints (GDD chapter 10). All three are the same
    // shape - something happened, say it once, keep it short.
    bus.on('missionDone', ({ id, rewards }) => {
      const def = Content.mission(id);
      if (!def) return;
      const line = mentorLine(this.game, 'missionDone');
      this.toasts.show(
        `${t('missions.completed', { name: def.name })} · ${rewards.join(' · ')}${line ? `\n${line}` : ''}`,
        def.icon,
        'good',
      );
      this.sound.play('levelUp');
      this.tasks.refresh();
      this.buildTabs();
    });

    // A milestone is a toast, not a dialog. It fires while the player is doing
    // something else - mid-tap, mid-purchase - and a window that takes the
    // screen to celebrate is an interruption dressed up as a reward. Tapping
    // it opens the milestone list, where the detail belongs.
    bus.on('milestone', ({ id, rewards }) => {
      const def = Content.milestone(id);
      if (!def) return;
      this.sound.play('levelUp');
      const mentor = mentorLine(this.game, 'milestone');
      this.toasts.show(
        `${def.name} · ${rewards.join(' · ')}${mentor ? `\n${mentor}` : ''}`,
        def.icon,
        'good',
        () => this.select('missions'),
      );
    });

    bus.on('hint', ({ text, icon, screen }) => {
      this.toasts.show(text, icon, 'info', screen ? () => this.select(screen) : undefined);
    });

    bus.on('progress', () => {
      this.tutorial.update();
      this.tasks.refresh();
      this.buildTabs();
      // "Speichern erfolgt automatisch nach Bauaktionen, Käufen und
      // Forschungsabschluss" - `progress` is exactly those moments.
      this.saveNow(false);
    });

    bus.on('saved', ({ manual }) => {
      if (manual) this.toasts.show(t('settings.saved'), '💾', 'good');
    });

    // Browsers block audio until a gesture; this is that gesture.
    const unlock = () => {
      this.sound.unlock();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);

    // Any touch cuts the opening short - the flight and the welcome card
    // alike. A cinematic the player cannot interrupt is the fastest way to
    // make a first session feel slow.
    window.addEventListener('pointerdown', (e) => {
      if (this.yard.renderer.introRunning) this.yard.renderer.stopIntro();
      if (!(e.target instanceof Node) || !this.intro.root.contains(e.target)) this.intro.skip();
    });

    window.addEventListener('resize', () => this.yard.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.yard.resize(), 220));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.hiddenAt = Date.now();
        this.saveNow(true);
      } else {
        const away = (Date.now() - this.hiddenAt) / 1000;
        this.hiddenAt = 0;
        this.lastFrame = performance.now();
        if (away >= BALANCE.offline.minSeconds) {
          const report = simulateOffline(this.game, away);
          if (report) this.showOfflineReport(report);
        } else if (away > 0) {
          this.game.tick(Math.min(away, 60));
        }
        this.refreshAll();
      }
    });

    window.addEventListener('pagehide', () => this.saveNow(true));
    window.addEventListener('beforeunload', () => this.saveNow(true));
  }

  // -------------------------------------------------------------------------
  // Navigation & refresh
  // -------------------------------------------------------------------------

  /**
   * @param id a main area, or a sub-screen id - the shell finds the hub that
   *   owns it, so the tutorial can point at "storage" without knowing about
   *   the Markt hub.
   */
  select(id: string): void {
    let target = this.screens.find((s) => s.id === id);
    let child: string | undefined;
    if (!target) {
      target = this.screens.find((s) => s instanceof HubScreen && s.owns(id));
      child = id;
    }
    target ??= this.screens[0];

    if (this.activeId !== target.id) {
      const previous = this.screens.find((s) => s.id === this.activeId);
      previous?.onLeave?.();
      if (previous) previous.root.style.display = 'none';
    }
    this.activeId = target.id;
    // A hub can share its id with one of its sub-screens (Schrottplatz/Hof,
    // Markt/Ankauf). Passing the id through means selecting the area also
    // brings that sub-screen forward, instead of leaving whatever was open.
    if (target instanceof HubScreen) target.show(child ?? id);
    target.root.style.display = '';
    target.onEnter?.();
    target.refresh();
    this.buildTabs();
  }

  private get activeScreen(): Screen | undefined {
    return this.screens.find((s) => s.id === this.activeId);
  }

  /** True while the isometric world is the visible surface. */
  private get yardVisible(): boolean {
    const active = this.activeScreen;
    return active instanceof HubScreen && active.active === this.yard;
  }

  /** Rebuilds the visible screen while keeping the scroll position. */
  private refreshActive(): void {
    const screen = this.activeScreen;
    if (!screen) return;
    const scroll = screen.root.scrollTop;
    screen.refresh();
    screen.root.scrollTop = scroll;
  }

  refreshAll(): void {
    applyTheme(this.game.state.settings);
    this.sound.update(this.game.state.settings);
    this.buildTabs();
    this.refreshActive();
    this.hud.refresh();
    this.tasks.refresh();
    this.tutorial.update();
  }

  // -------------------------------------------------------------------------
  // Loop
  // -------------------------------------------------------------------------

  private loop = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000 || 0);
    this.lastFrame = now;

    // Fixed-step simulation, capped so a stalled tab cannot freeze the device.
    this.accumulator = Math.min(this.accumulator + dt, STEP * 12);
    let steps = 0;
    while (this.accumulator >= STEP && steps < 12) {
      this.game.tick(STEP);
      this.accumulator -= STEP;
      steps++;
    }

    this.hud.sample(dt);
    const yardVisible = this.yardVisible;
    this.root.classList.toggle('world', yardVisible);
    if (yardVisible) this.yard.draw(dt);

    this.uiTimer += dt;
    if (this.uiTimer >= 0.25) {
      this.uiTimer = 0;
      this.hud.refresh();
      this.tasks.refresh();
      if (yardVisible) this.yard.refresh();
      else this.refreshActive();
    }

    this.saveTimer += dt;
    if (this.saveTimer >= BALANCE.autosaveSeconds) this.saveNow(false);

    this.debug?.sample(dt);
    requestAnimationFrame(this.loop);
  };

  /**
   * Writes the save.
   *
   * Rate-limited so the burst of `progress` events a single purchase produces
   * does not serialise the whole state five times in a row; a manual save
   * always goes through.
   */
  saveNow(manual: boolean): void {
    if (!manual && performance.now() - this.lastSave < 1500) return;
    this.lastSave = performance.now();
    this.saveTimer = 0;
    if (saveGame(this.game.state)) this.game.bus.emit('saved', { manual });
    else log.warn('app', 'Autospeichern fehlgeschlagen');
  }

  // -------------------------------------------------------------------------
  // Offline
  // -------------------------------------------------------------------------

  /**
   * The return summary (GDD chapter 10).
   *
   * Longer absences get a fuller report: after a day away the player has lost
   * the thread, so the window says what the yard earned, what happened while
   * they were gone, and what is waiting for them - all three, or it is not a
   * "Wiedereinstieg", just a receipt.
   */
  showOfflineReport(report: OfflineReport): void {
    const content = el('div');
    content.appendChild(
      statGrid(
        statTile(money(report.moneyGained), t('offline.earned'), 'good'),
        statTile(fmt(report.vehiclesDone, 0), t('offline.vehicles')),
        statTile(duration(report.seconds), t('offline.credited')),
        statTile(`${Math.round(report.efficiency * 100)} %`, t('offline.efficiency')),
      ),
    );

    if (report.capped) {
      const note = el('p');
      note.textContent = t('offline.capped', { away: duration(report.awaySeconds) });
      content.appendChild(note);
    }

    // What is waiting: open tasks first, then the standing warnings. Only for
    // a real absence - after ten minutes away nobody needs a briefing.
    if (report.awaySeconds >= 3600) {
      const rows = visibleRows(this.game);
      if (rows.length > 0) {
        content.appendChild(sectionTitle(t('offline.tasks')));
        for (const row of rows) {
          content.appendChild(
            infoCard({
              icon: row.def.icon,
              title: row.def.name,
              subtitle: row.text,
              progress: row.progress,
            }),
          );
        }
      }

      const waiting = this.waitingFor();
      if (waiting.length > 0) {
        content.appendChild(sectionTitle(t('offline.waiting')));
        for (const line of waiting) content.appendChild(el('p', 'card-desc', line));
      }

      const mentor = mentorLine(this.game, 'returning');
      if (mentor) content.appendChild(el('p', 'intro-mentor', `„${mentor}"`));
    }

    const { stats, state } = this.game;
    if (stats.autoBuyPerMinute <= 0 || !state.autoBuyEnabled || stats.autoSellPerSec <= 0) {
      const hint = el('p');
      hint.textContent = t('offline.hint');
      content.appendChild(hint);
    }

    dialog({ title: t('offline.title'), icon: '🌅', body: t('offline.body'), content });
  }

  /** Short list of things that want attention right now. */
  private waitingFor(): string[] {
    const { state, stats } = this.game;
    const lines: string[] = [];
    if (this.game.storageUsed() >= stats.storage * 0.9) lines.push(t('offline.wait.storage'));
    if (state.trade.offers.length > 0) lines.push(t('offline.wait.offers', { count: state.trade.offers.length }));
    if (state.metrics.arrears > 0) lines.push(t('offline.wait.arrears', { amount: money(state.metrics.arrears) }));
    if (stats.condition < 0.7) lines.push(t('offline.wait.service', { percent: Math.round(stats.condition * 100) }));
    if (!state.active && state.queue.length === 0) lines.push(t('offline.wait.empty'));
    return lines;
  }
}

/** Screen labels may be i18n keys; anything else passes through unchanged. */
function label(value: string): string {
  return value.includes('.') ? t(value) : value;
}

export { UI as UI_TOKENS };
