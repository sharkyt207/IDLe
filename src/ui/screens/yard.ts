import { Content } from '../../data';
import { money, rate } from '../../core/format';
import type { Game } from '../../game/game';
import { WorldRenderer } from '../../render/world';
import type { Structure } from '../../world/buildings';
import { el, haptic } from '../dom';
import type { Screen } from '../screen';

/**
 * The yard: the isometric map with the vehicle on the dismantling pad, a small
 * HUD and the relocation mode for structures.
 */
export class YardScreen implements Screen {
  readonly id = 'yard';
  readonly label = 'Hof';
  readonly icon = '🏗️';
  readonly root = el('div', 'screen no-pad');

  readonly renderer: WorldRenderer;
  private canvas = el('canvas');
  private info = el('div', 'hud-card');
  private autoInfo = el('div', 'hud-card');
  private envChip = el('div', 'env-chip');
  private moveBar = el('div', 'move-bar');
  /** True while this screen is the visible one - gates all animation. */
  private visible = false;

  constructor(private game: Game) {
    const wrap = el('div', 'yard');
    wrap.appendChild(this.canvas);
    wrap.appendChild(this.envChip);

    const hud = el('div', 'yard-hud');
    const cards = el('div', 'hud-cards');
    cards.appendChild(this.info);
    cards.appendChild(this.autoInfo);
    hud.appendChild(cards);

    const actions = el('div', 'yard-actions');
    const center = el('button', 'round-btn', '🎯');
    center.title = 'Kamera auf den Zerlegeplatz';
    center.addEventListener('click', () => this.renderer.centerOnPad());
    actions.appendChild(center);
    hud.appendChild(actions);

    wrap.appendChild(hud);
    this.moveBar.style.display = 'none';
    wrap.appendChild(this.moveBar);
    this.root.appendChild(wrap);

    this.renderer = new WorldRenderer(this.canvas, game);
    this.renderer.onTapPart = (partId) => this.tapPart(partId);
    this.renderer.onTapStructure = (s) => this.showStructure(s);
    this.renderer.onPlaced = () => this.endMove('Anlage versetzt');

    this.bindEvents();
  }

  private bindEvents(): void {
    const { bus } = this.game;

    bus.on('partRemoved', ({ vehicleId, partId, cash }) => {
      const pos = this.renderer.partWorldPos(partId) ?? this.renderer.padCenter();
      this.renderer.effects.sparks(pos.x, pos.y, '#ffd27a', 18);
      if (cash > 0) this.renderer.effects.text(pos.x, pos.y - 14, `+${money(cash)}`, '#ffe9a8', 18);
      else this.renderer.effects.text(pos.x, pos.y - 14, `✔ ${partLabel(vehicleId, partId)}`, '#cfe8ff', 14);
    });

    bus.on('vehicleDone', ({ xp }) => {
      const c = this.renderer.padCenter();
      this.renderer.effects.sparks(c.x, c.y, '#8fe0a0', 30);
      this.renderer.effects.text(c.x, c.y - 34, `Fertig!  +${Math.round(xp)} XP`, '#8fe0a0', 18);
    });

    bus.on('sold', ({ amount, auto }) => {
      if (!auto || amount < 1) return;
      const c = this.renderer.padCenter();
      this.renderer.effects.text(c.x + 60, c.y + 40, `+${money(amount)}`, '#a8e6b5', 13);
    });

    // Every delivery bought sends a truck down the road - no teleportation.
    bus.on('delivery', () => this.renderer.traffic.queueDelivery());

    bus.on('lotBought', ({ lotId }) => {
      this.renderer.map.sync(this.game.state);
      this.renderer.focusLot(lotId);
    });
  }

  private tapPart(partId: string): void {
    const applied = this.game.tap(partId);
    if (applied <= 0) return;
    const pos = this.renderer.partWorldPos(partId);
    if (pos) this.renderer.effects.sparks(pos.x, pos.y, '#ffb545', 8);
    if (this.game.state.settings.haptics) haptic(8);
  }

  /** Tapping a structure offers to relocate it (GDD: frei platzierbar). */
  private showStructure(s: Structure): void {
    this.renderer.movingKey = s.key;
    this.moveBar.style.display = '';
    this.moveBar.innerHTML = '';
    const label = el('span');
    label.innerHTML = `<b>${s.name}</b> versetzen — freie Fläche antippen`;
    this.moveBar.appendChild(label);
    const cancel = el('button', 'ghost', 'Abbrechen');
    cancel.addEventListener('click', () => this.endMove());
    this.moveBar.appendChild(cancel);
  }

  private endMove(notice?: string): void {
    this.renderer.movingKey = null;
    this.moveBar.style.display = 'none';
    if (notice) this.game.bus.emit('notice', { text: notice, icon: '🏗️', tone: 'good' });
  }

  onEnter(): void {
    this.visible = true;
    this.renderer.resize();
  }

  onLeave(): void {
    this.visible = false;
    this.endMove();
  }

  resize(): void {
    this.renderer.resize();
  }

  /** Called every frame by the shell while this screen is on top. */
  draw(dt: number): void {
    this.renderer.render(dt, this.visible);
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

    const ambience = this.renderer.environment.ambience(state);
    const phaseIcon = { morgen: '🌅', mittag: '☀️', abend: '🌇', nacht: '🌙' }[ambience.phase];
    this.envChip.textContent = `${phaseIcon} ${capitalize(ambience.phase)} · ${ambience.weather.icon} ${ambience.weather.name}`;
  }
}

function partLabel(vehicleId: string, partId: string): string {
  return Content.vehicle(vehicleId)?.parts.find((p) => p.id === partId)?.name ?? 'Teil';
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
