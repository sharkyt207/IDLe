import { Content } from '../../data';
import { money, rate } from '../../core/format';
import type { Game } from '../../game/game';
import { YardRenderer } from '../../render/yard';
import { el, haptic } from '../dom';
import type { Screen } from '../screen';

/**
 * The yard: canvas view with the vehicle on the dismantling pad plus a small
 * HUD. This is where the whole game starts - tap the marked parts.
 */
export class YardScreen implements Screen {
  readonly id = 'yard';
  readonly label = 'Hof';
  readonly icon = '🏗️';
  readonly root = el('div', 'screen no-pad');

  readonly renderer: YardRenderer;
  private canvas = el('canvas');
  private info = el('div', 'hud-card');
  private autoInfo = el('div', 'hud-card');

  constructor(private game: Game) {
    const wrap = el('div', 'yard');
    wrap.appendChild(this.canvas);

    const hud = el('div', 'yard-hud');
    const cards = el('div', 'hud-cards');
    cards.appendChild(this.info);
    cards.appendChild(this.autoInfo);
    hud.appendChild(cards);

    const actions = el('div', 'yard-actions');
    const center = el('button', 'round-btn', '🎯');
    center.title = 'Kamera zentrieren';
    center.addEventListener('click', () => this.renderer.centerOnPad());
    actions.appendChild(center);
    hud.appendChild(actions);

    wrap.appendChild(hud);
    this.root.appendChild(wrap);

    this.renderer = new YardRenderer(this.canvas, game);
    this.renderer.onTapPart = (partId) => this.tapPart(partId);

    this.bindEvents();
  }

  private bindEvents(): void {
    const { bus } = this.game;

    bus.on('partRemoved', ({ vehicleId, partId, cash, x, y }) => {
      const pos = this.renderer.normalizedToWorld(x, y);
      this.renderer.effects.sparks(pos.x, pos.y, '#ffd27a', 22);
      if (cash > 0) this.renderer.effects.text(pos.x, pos.y - 20, `+${money(cash)}`, '#ffe9a8', 30);
      else this.renderer.effects.text(pos.x, pos.y - 20, `✔ ${partLabel(vehicleId, partId)}`, '#cfe8ff', 24);
    });

    bus.on('vehicleDone', ({ xp }) => {
      const c = this.renderer.padCenter();
      this.renderer.effects.sparks(c.x, c.y, '#8fe0a0', 40);
      this.renderer.effects.text(c.x, c.y - 60, `Fahrzeug fertig!  +${Math.round(xp)} XP`, '#8fe0a0', 34);
    });

    bus.on('sold', ({ amount, auto }) => {
      if (!auto || amount < 1) return;
      const c = this.renderer.padCenter();
      this.renderer.effects.text(c.x + 220, c.y + 120, `+${money(amount)}`, '#a8e6b5', 22);
    });
  }

  private tapPart(partId: string): void {
    const applied = this.game.tap(partId);
    if (applied <= 0) return;
    const pos = this.renderer.partWorldPos(partId);
    if (pos) this.renderer.effects.sparks(pos.x, pos.y, '#ffb545', 10);
    if (this.game.state.settings.haptics) haptic(8);
  }

  onEnter(): void {
    this.renderer.resize();
  }

  resize(): void {
    this.renderer.resize();
  }

  /** Called every frame by the shell. */
  draw(dt: number): void {
    this.renderer.render(dt);
  }

  refresh(): void {
    const { state, stats } = this.game;
    const def = state.active ? Content.vehicle(state.active.defId) : undefined;

    this.info.innerHTML = def
      ? `<b>${def.icon} ${def.name}</b>Tippleistung ${rate(stats.tapPower, '')} · Teile ${
          state.active!.parts.filter((p) => !p.done).length
        }/${def.parts.length}`
      : `<b>Kein Fahrzeug</b>Kaufe im Ankauf neuen Schrott`;

    const auto: string[] = [];
    if (stats.teardownRate > 0) auto.push(`🤖 ${rate(stats.teardownRate)} Zerlegen`);
    if (stats.autoSellPerSec > 0 && state.autoSellEnabled) auto.push(`🛤️ ${rate(stats.autoSellPerSec)} Verkauf`);
    if (stats.autoBuyPerMinute > 0 && state.autoBuyEnabled) auto.push(`🛻 ${rate(stats.autoBuyPerMinute, '/min')} Ankauf`);

    this.autoInfo.style.display = auto.length ? '' : 'none';
    this.autoInfo.innerHTML = `<b>Automatisierung</b>${auto.join(' · ')}`;
  }
}

function partLabel(vehicleId: string, partId: string): string {
  return Content.vehicle(vehicleId)?.parts.find((p) => p.id === partId)?.name ?? 'Teil';
}
