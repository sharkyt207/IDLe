import { BALANCE } from '../data/balance';
import { duration, fmt, money, units } from '../core/format';
import type { Game } from '../game/game';
import { saveGame } from '../game/save';
import { simulateOffline, type OfflineReport } from '../game/systems/offline';
import { xpForLevel } from '../game/state';
import { clear, el } from './dom';
import { openModal } from './modal';
import type { Screen } from './screen';
import { Toasts } from './toast';
import { Tutorial } from './tutorial';
import { BuildScreen } from './screens/build';
import { CompanyScreen } from './screens/company';
import { MarketScreen } from './screens/market';
import { ResearchScreen } from './screens/research';
import { StorageScreen } from './screens/storage';
import { YardScreen } from './screens/yard';

const STEP = 1 / BALANCE.tickRate;

/**
 * Application shell: top bar, screen stack, tab bar, game loop, autosave and
 * offline handling. Screens stay dumb - the shell decides when they refresh.
 */
export class App {
  private root: HTMLElement;
  private screensHost = el('div');
  private tabbar = el('nav', 'tabbar');
  private toasts: Toasts;
  private tutorial: Tutorial;

  private screens: Screen[] = [];
  private yard: YardScreen;
  private activeId = 'yard';

  // top bar nodes
  private moneyNode = el('div', 'money');
  private rateNode = el('div', 'rate');
  private levelNode = el('span', 'level-chip');
  private xpFill = el('i');
  private storageFill = el('i');
  private storageBar = el('div', 'storage-bar');
  private storageText = el('span');

  private accumulator = 0;
  private lastFrame = 0;
  private uiTimer = 0;
  private saveTimer = 0;
  private hiddenAt = 0;

  /** Smoothed income for the "€/s" readout. */
  private incomeEma = 0;
  private lastEarned = 0;
  private earnSampleTimer = 0;

  constructor(private game: Game, mount: HTMLElement) {
    this.root = mount;
    clear(this.root);

    this.root.appendChild(this.buildTopbar());
    this.screensHost.id = 'screen';
    this.root.appendChild(this.screensHost);
    this.root.appendChild(this.tabbar);

    this.toasts = new Toasts(document.body);
    this.tutorial = new Tutorial(game, (tab) => this.select(tab));
    document.body.appendChild(this.tutorial.root);

    this.yard = new YardScreen(game);
    const company = new CompanyScreen(game);
    company.onReset = () => {
      this.select('yard');
      this.refreshAll();
    };

    this.screens = [
      this.yard,
      new MarketScreen(game),
      new StorageScreen(game),
      new BuildScreen(game),
      new ResearchScreen(game),
      company,
    ];
    for (const screen of this.screens) {
      screen.root.style.display = 'none';
      this.screensHost.appendChild(screen.root);
    }

    this.buildTabs();
    this.bindEvents();
    this.lastEarned = game.state.lifetimeEarned;

    this.select('yard');
    this.tutorial.update();
    this.loop(performance.now());
  }

  // -------------------------------------------------------------------------
  // Chrome
  // -------------------------------------------------------------------------

  private buildTopbar(): HTMLElement {
    const bar = el('header', 'topbar');

    const row = el('div', 'topbar-row');
    row.appendChild(this.moneyNode);
    row.appendChild(this.levelNode);
    row.appendChild(this.rateNode);
    bar.appendChild(row);

    const xp = el('div', 'xp-bar');
    xp.appendChild(this.xpFill);
    bar.appendChild(xp);

    const storageLine = el('div', 'storage-line');
    storageLine.appendChild(el('span', undefined, '📦'));
    this.storageBar.appendChild(this.storageFill);
    storageLine.appendChild(this.storageBar);
    storageLine.appendChild(this.storageText);
    bar.appendChild(storageLine);

    return bar;
  }

  private buildTabs(): void {
    clear(this.tabbar);
    for (const screen of this.screens) {
      if (screen.available && !screen.available()) continue;
      const tab = el('button', `tab${screen.id === this.activeId ? ' active' : ''}`);
      tab.dataset.id = screen.id;
      tab.appendChild(el('span', 'tab-icon', screen.icon));
      tab.appendChild(el('span', undefined, screen.label));
      if (screen.hasNews?.()) tab.appendChild(el('span', 'badge'));
      tab.addEventListener('click', () => this.select(screen.id));
      this.tabbar.appendChild(tab);
    }
  }

  private bindEvents(): void {
    const { bus } = this.game;

    bus.on('notice', ({ text, icon, tone }) => this.toasts.show(text, icon, tone));

    bus.on('levelUp', ({ level }) => {
      this.toasts.show(`Level ${level} erreicht!`, '⭐', 'good');
      this.buildTabs();
      this.refreshActive();
    });

    bus.on('progress', () => {
      this.tutorial.update();
      this.buildTabs();
    });

    window.addEventListener('resize', () => this.yard.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.yard.resize(), 220));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.hiddenAt = Date.now();
        saveGame(this.game.state);
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

    window.addEventListener('pagehide', () => saveGame(this.game.state));
    window.addEventListener('beforeunload', () => saveGame(this.game.state));
  }

  // -------------------------------------------------------------------------
  // Navigation & refresh
  // -------------------------------------------------------------------------

  select(id: string): void {
    const target = this.screens.find((s) => s.id === id) ?? this.screens[0];
    if (this.activeId !== target.id) {
      const previous = this.screens.find((s) => s.id === this.activeId);
      previous?.onLeave?.();
      previous && (previous.root.style.display = 'none');
    }
    this.activeId = target.id;
    target.root.style.display = '';
    target.onEnter?.();
    target.refresh();
    this.buildTabs();
  }

  private get activeScreen(): Screen | undefined {
    return this.screens.find((s) => s.id === this.activeId);
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
    this.buildTabs();
    this.refreshActive();
    this.updateTopbar();
    this.tutorial.update();
  }

  private updateTopbar(): void {
    const { state, stats } = this.game;
    this.moneyNode.textContent = money(state.money);
    this.levelNode.textContent = `Lv ${state.level}`;
    this.rateNode.textContent = `${money(this.incomeEma)}/s`;

    const need = xpForLevel(state.level);
    this.xpFill.style.width = `${Math.min(100, (state.xp / need) * 100)}%`;

    const used = this.game.storageUsed();
    const ratio = stats.storage > 0 ? used / stats.storage : 0;
    this.storageFill.style.width = `${Math.min(100, ratio * 100)}%`;
    this.storageBar.classList.toggle('full', ratio >= 0.999);
    this.storageText.textContent = `${units(used)}/${units(stats.storage)}`;
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

    // Income readout (exponential moving average over ~3 s).
    this.earnSampleTimer += dt;
    if (this.earnSampleTimer >= 0.5) {
      const earned = this.game.state.lifetimeEarned - this.lastEarned;
      this.lastEarned = this.game.state.lifetimeEarned;
      const perSecond = earned / this.earnSampleTimer;
      this.incomeEma += (perSecond - this.incomeEma) * 0.35;
      this.earnSampleTimer = 0;
    }

    if (this.activeId === 'yard') this.yard.draw(dt);

    this.uiTimer += dt;
    if (this.uiTimer >= 0.25) {
      this.uiTimer = 0;
      this.updateTopbar();
      if (this.activeId === 'yard') this.yard.refresh();
      else this.refreshActive();
    }

    this.saveTimer += dt;
    if (this.saveTimer >= BALANCE.autosaveSeconds) {
      this.saveTimer = 0;
      saveGame(this.game.state);
    }

    requestAnimationFrame(this.loop);
  };

  // -------------------------------------------------------------------------
  // Offline
  // -------------------------------------------------------------------------

  showOfflineReport(report: OfflineReport): void {
    const content = el('div');
    const grid = el('div', 'stat-grid');
    grid.appendChild(statBox(money(report.moneyGained), 'Verdient'));
    grid.appendChild(statBox(fmt(report.vehiclesDone, 0), 'Fahrzeuge'));
    grid.appendChild(statBox(duration(report.seconds), 'Angerechnet'));
    grid.appendChild(statBox(`${Math.round(BALANCE.offline.efficiency * 100)} %`, 'Effizienz'));
    content.appendChild(grid);

    if (report.capped) {
      const note = el('p');
      note.textContent = `Du warst ${duration(
        report.awaySeconds,
      )} weg. Mehr Offline-Zeit gibt es über Schichtleiter, Nachtschicht-Forschung und Fernüberwachung.`;
      content.appendChild(note);
    }

    // Without logistics and sorting the yard stops as soon as the pad is empty.
    const { stats, state } = this.game;
    if (stats.autoBuyPerMinute <= 0 || !state.autoBuyEnabled || stats.autoSellPerSec <= 0) {
      const hint = el('p');
      hint.textContent =
        'Tipp: Der Hof arbeitet offline nur so lange weiter, wie Nachschub da ist. Ein Pickup kauft automatisch Schrott an, ein Förderband verkauft automatisch.';
      content.appendChild(hint);
    }

    openModal({
      title: 'Willkommen zurück!',
      body: 'Deine Anlagen haben weitergearbeitet.',
      content,
    });
  }
}

function statBox(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.appendChild(el('b', undefined, value));
  box.appendChild(el('span', undefined, label));
  return box;
}
