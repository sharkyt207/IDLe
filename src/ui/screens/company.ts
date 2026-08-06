import { BALANCE } from '../../data/balance';
import { Content } from '../../data';
import { duration, fmt, money } from '../../core/format';
import type { Game } from '../../game/game';
import { nextPerkCost } from '../../game/stats';
import { clearSave, exportSave, importSave } from '../../game/save';
import { clear, el } from '../dom';
import { openModal } from '../modal';
import type { Screen } from '../screen';

/** Firma: company overview, prestige, permanent perks and settings. */
export class CompanyScreen implements Screen {
  readonly id = 'company';
  readonly label = 'Firma';
  readonly icon = '🏆';
  readonly root = el('div', 'screen');

  /** Set by the shell so a prestige reset can rebuild the UI. */
  onReset?: () => void;

  constructor(private game: Game) {}

  hasNews(): boolean {
    return this.game.canPrestige();
  }

  refresh(): void {
    clear(this.root);
    const { game, root } = this;
    const s = game.state;

    const grid = el('div', 'stat-grid');
    grid.appendChild(stat(`Level ${s.level}`, `${fmt(s.xp, 0)} XP`));
    grid.appendChild(stat(money(s.lifetimeEarned), 'Gesamtumsatz'));
    grid.appendChild(stat(fmt(s.progressStats.vehiclesDone, 0), 'Fahrzeuge zerlegt'));
    grid.appendChild(stat(fmt(s.progressStats.taps, 0), 'Manuelle Tipps'));
    grid.appendChild(stat(duration(s.playtime), 'Spielzeit'));
    grid.appendChild(stat(`${fmt(game.stats.offlineHours, 0)} h`, 'Offline-Fortschritt'));
    root.appendChild(grid);

    this.renderPrestige();
    this.renderPerks();
    this.renderCollection();
    this.renderSettings();
  }

  private renderPrestige(): void {
    const { game, root } = this;
    root.appendChild(el('div', 'screen-title', 'Neues Unternehmen (Prestige)'));

    const gain = game.prestigeGain();
    const card = el('div', 'card');
    card.appendChild(el('div', 'card-icon', '🏆'));
    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', `Reputation: ${fmt(game.state.prestige.reputation, 0)}`));
    body.appendChild(
      el(
        'div',
        'card-desc',
        `Ein Neustart setzt Geld, Lager, Maschinen und Forschung zurück. Reputation und dauerhafte Boni bleiben.`,
      ),
    );
    body.appendChild(
      el(
        'div',
        game.canPrestige() ? 'card-desc' : 'card-note',
        game.canPrestige()
          ? `Neustart bringt +${fmt(gain, 0)} Reputation`
          : `Benötigt Level ${BALANCE.prestige.requiredLevel} und mindestens ${BALANCE.prestige.minReputation} Reputation (aktuell ${fmt(gain, 0)})`,
      ),
    );
    if (game.state.prestige.runs > 0) {
      body.appendChild(
        el('div', 'card-desc', `Durchläufe: ${game.state.prestige.runs} · Bester Umsatz: ${money(game.state.prestige.bestRun)}`),
      );
    }
    card.appendChild(body);

    const actions = el('div', 'card-actions');
    const btn = el('button', game.canPrestige() ? 'primary' : '');
    btn.textContent = 'Neu gründen';
    btn.disabled = !game.canPrestige();
    btn.addEventListener('click', () => this.confirmPrestige(gain));
    actions.appendChild(btn);
    card.appendChild(actions);
    root.appendChild(card);
  }

  private confirmPrestige(gain: number): void {
    const content = el('div');
    const yes = el('button', 'primary wide', `Ja, +${fmt(gain, 0)} Reputation`);
    yes.addEventListener('click', () => {
      this.game.doPrestige();
      close();
      this.onReset?.();
    });
    content.appendChild(yes);

    const close = openModal({
      title: 'Unternehmen neu gründen?',
      body: 'Geld, Lager, Maschinen, Mitarbeiter und Forschung werden zurückgesetzt. Reputation, gekaufte Prestige-Boni und entdeckte Fahrzeuge bleiben erhalten.',
      content,
    });
  }

  private renderPerks(): void {
    const { game, root } = this;
    if (game.state.prestige.runs === 0 && game.state.prestige.reputation === 0) return;

    root.appendChild(el('div', 'screen-title', 'Dauerhafte Boni'));
    for (const perk of Content.perks) {
      const level = game.state.prestige.perks[perk.id] ?? 0;
      const cost = nextPerkCost(game.state, perk.id);
      const maxed = level >= perk.maxLevel;
      const affordable = game.state.prestige.reputation >= cost;

      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', perk.icon));
      const body = el('div', 'card-body');
      const title = el('div', 'card-title');
      title.appendChild(document.createTextNode(perk.name));
      title.appendChild(el('span', 'count', `Stufe ${level}/${perk.maxLevel}`));
      body.appendChild(title);
      body.appendChild(el('div', 'card-desc', perk.desc));
      card.appendChild(body);

      if (!maxed) {
        const actions = el('div', 'card-actions');
        const btn = el('button', affordable ? 'primary' : '');
        btn.innerHTML = `Kaufen<span class="price">${fmt(cost, 0)} 🏆</span>`;
        btn.disabled = !affordable;
        btn.addEventListener('click', () => {
          if (game.buyPerk(perk.id)) this.refresh();
        });
        actions.appendChild(btn);
        card.appendChild(actions);
      }
      root.appendChild(card);
    }
  }

  /** "Alle Fahrzeugtypen entdeckt" from the Definition of Done. */
  private renderCollection(): void {
    const { game, root } = this;
    const found = game.state.progressStats.discovered;
    root.appendChild(
      el('div', 'screen-title', `Sammlung (${found.length}/${Content.vehicles.length})`),
    );
    const box = el('div', 'card');
    const body = el('div', 'card-body');
    const line = el('div', 'card-title');
    line.style.fontSize = '22px';
    line.textContent = Content.vehicles
      .map((v) => (found.includes(v.id) ? v.icon : '❔'))
      .join(' ');
    body.appendChild(line);
    body.appendChild(el('div', 'card-desc', 'Jeder zerlegte Fahrzeugtyp wird dauerhaft freigeschaltet.'));
    box.appendChild(body);
    root.appendChild(box);
  }

  private renderSettings(): void {
    const { game, root } = this;
    root.appendChild(el('div', 'screen-title', 'Einstellungen'));

    root.appendChild(
      toggleRow('📳', 'Vibration', game.state.settings.haptics, () => {
        game.state.settings.haptics = !game.state.settings.haptics;
        this.refresh();
      }),
    );

    const row = el('div', 'btn-row');
    const exportBtn = el('button', 'ghost', 'Spielstand exportieren');
    exportBtn.addEventListener('click', () => {
      const content = el('div');
      const area = el('textarea');
      area.value = exportSave(game.state);
      area.readOnly = true;
      content.appendChild(area);
      openModal({ title: 'Spielstand', body: 'Kopiere diesen Text als Sicherung.', content });
    });
    row.appendChild(exportBtn);

    const importBtn = el('button', 'ghost', 'Importieren');
    importBtn.addEventListener('click', () => {
      const content = el('div');
      const area = el('textarea');
      area.placeholder = 'Spielstand hier einfügen';
      content.appendChild(area);
      const apply = el('button', 'primary wide', 'Laden');
      apply.addEventListener('click', () => {
        const state = importSave(area.value);
        if (!state) {
          game.bus.emit('notice', { text: 'Ungültiger Spielstand', icon: '⚠️', tone: 'warn' });
          return;
        }
        game.state = state;
        game.recompute();
        close();
        this.onReset?.();
      });
      content.appendChild(apply);
      const close = openModal({ title: 'Spielstand importieren', content });
    });
    row.appendChild(importBtn);
    root.appendChild(row);

    const reset = el('button', 'ghost wide', 'Alles zurücksetzen');
    reset.style.color = 'var(--bad)';
    reset.addEventListener('click', () => {
      const content = el('div');
      const yes = el('button', 'wide', 'Ja, alles löschen');
      yes.style.background = 'var(--bad)';
      yes.addEventListener('click', () => {
        clearSave();
        location.reload();
      });
      content.appendChild(yes);
      openModal({
        title: 'Wirklich alles löschen?',
        body: 'Der komplette Fortschritt inklusive Reputation geht verloren.',
        content,
      });
    });
    root.appendChild(reset);
  }
}

function stat(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.appendChild(el('b', undefined, value));
  box.appendChild(el('span', undefined, label));
  return box;
}

function toggleRow(icon: string, label: string, on: boolean, onToggle: () => void): HTMLElement {
  const row = el('div', 'toggle-row');
  row.appendChild(el('span', undefined, icon));
  row.appendChild(el('span', undefined, label));
  row.appendChild(el('span', 'spacer'));
  const pill = el('span', on ? 'pill on' : 'pill', on ? 'An' : 'Aus');
  row.appendChild(pill);
  row.addEventListener('click', onToggle);
  return row;
}
