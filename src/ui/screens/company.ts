import { BALANCE } from '../../data/balance';
import { Content } from '../../data';
import { COMPANY, staffXpForLevel } from '../../data/company';
import { duration, fmt, money, rate, units } from '../../core/format';
import type { Game } from '../../game/game';
import { clearSave, exportSave, importSave } from '../../game/save';
import { sellCollectible } from '../../economy/collection';
import { staffRows, upkeepBill, wageBill } from '../../company/payroll';
import { report } from '../../company/statistics';
import { difficultyFactor } from '../../data/progress';
import type { PrestigeBranch } from '../../data/types';
import { buyPerk, canBuyPerk, canPrestige, gates, nextPerkCost, pointsGain } from '../../progress/prestige';
import { rows as achievementRows, titles } from '../../progress/achievements';
import { meets, requirementText } from '../../progress/unlocks';
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

  private perkBranch: PrestigeBranch = 'Produktion';

  constructor(private game: Game) {}

  hasNews(): boolean {
    return canPrestige(this.game) || canAffordPerk(this.game);
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
    grid.appendChild(stat(money(game.companyValue()), 'Firmenwert'));
    grid.appendChild(stat(`${fmt(game.stats.offlineHours, 0)} h`, 'Offline-Fortschritt'));
    root.appendChild(grid);

    this.renderPriorities();
    this.renderStatistics();
    this.renderStaff();
    this.renderPrestige();
    this.renderPerks();
    this.renderAchievements();
    this.renderCollection();
    this.renderFinds();
    this.renderSettings();
  }

  /**
   * Company focus (GDD chapter 6). The player never assigns individual jobs -
   * they pick a direction and the operation reorganises itself around it.
   */
  private renderPriorities(): void {
    const { game, root } = this;
    root.appendChild(el('div', 'screen-title', 'Ausrichtung'));

    const row = el('div', 'btn-row seg-row');
    for (const priority of Content.priorities) {
      const active = game.state.priority === priority.id;
      const btn = el('button', active ? '' : 'ghost');
      btn.innerHTML = `${priority.icon}<span class="price">${priority.name}</span>`;
      btn.addEventListener('click', () => {
        game.setPriority(priority.id);
        this.refresh();
      });
      row.appendChild(btn);
    }
    root.appendChild(row);

    const current = Content.priority(game.state.priority) ?? Content.priorities[0];
    const card = el('div', 'card');
    card.appendChild(el('div', 'card-icon', current.icon));
    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', current.name));
    body.appendChild(el('div', 'card-desc', current.desc));
    body.appendChild(
      el('div', 'card-desc', 'Das Team arbeitet ab sofort danach — einzelne Aufgaben musst du nicht verteilen.'),
    );
    card.appendChild(body);
    root.appendChild(card);
  }

  /** The dashboard from chapter 6: everything the player may want to see. */
  private renderStatistics(): void {
    const { game, root } = this;
    const r = report(game);

    root.appendChild(el('div', 'screen-title', 'Betriebszahlen'));

    const day = el('div', 'card');
    const dayBody = el('div', 'card-body');
    const dayTitle = el('div', 'card-title');
    dayTitle.appendChild(document.createTextNode('Geschäftstag'));
    dayTitle.appendChild(el('span', 'count', `${Math.round(r.dayProgress * 100)} %`));
    dayBody.appendChild(dayTitle);
    const bar = el('div', 'xp-bar');
    const fill = el('i');
    fill.style.width = `${Math.min(100, r.dayProgress * 100)}%`;
    bar.appendChild(fill);
    dayBody.appendChild(bar);
    dayBody.appendChild(
      el('div', 'card-desc', `Einnahmen ${money(r.dayEarned)} · Ausgaben ${money(r.daySpent)}`),
    );
    day.appendChild(dayBody);
    root.appendChild(day);

    const grid = el('div', 'stat-grid');
    grid.appendChild(signedStat(r.dayProfit, 'Tagesgewinn'));
    grid.appendChild(signedStat(r.weekProfit, `Wochengewinn (${COMPANY.metrics.weekDays} Tage)`));
    grid.appendChild(stat(units(r.unitsRecycled), 'Produktionsmenge'));
    grid.appendChild(stat(`${units(r.storageUnits)} / ${units(game.stats.storage)}`, 'Lagerbestand'));
    grid.appendChild(stat(`${fmt(r.powerDemand)} / ${fmt(r.powerSupply)} kW`, 'Stromverbrauch'));
    grid.appendChild(stat(fmt(r.employees, 0), 'Mitarbeiter'));
    grid.appendChild(stat(money(r.companyValue), 'Firmenwert'));
    grid.appendChild(stat(`${Math.round(r.efficiency * 100)} %`, 'Effizienz'));
    grid.appendChild(stat(`${fmt(r.co2Saved)} kg`, 'CO₂-Einsparung'));
    grid.appendChild(stat(rate(r.runningCosts, ' €/s'), 'Laufende Kosten'));
    root.appendChild(grid);

    if (r.efficiency < 0.95) {
      const reasons: string[] = [];
      if (game.stats.power.factor < 0.99) reasons.push('Strommangel');
      if (game.stats.condition < 0.95) reasons.push('Verschleiß');
      if (game.state.metrics.arrears > 0) reasons.push('offene Löhne');
      if (reasons.length > 0) {
        root.appendChild(el('div', 'card-note', `Effizienz gebremst durch: ${reasons.join(', ')}`));
      }
    }
  }

  /** Payroll overview - who works here and what they have learned. */
  private renderStaff(): void {
    const { game, root } = this;
    const rows = staffRows(game);
    if (rows.length === 0) return;

    root.appendChild(el('div', 'screen-title', 'Belegschaft'));
    const wages = wageBill(game);
    const upkeep = upkeepBill(game);
    const summary = el('div', 'card');
    const summaryBody = el('div', 'card-body');
    summaryBody.appendChild(el('div', 'card-title', `Personalkosten ${rate(wages, ' €/s')}`));
    summaryBody.appendChild(el('div', 'card-desc', `Gebäudeunterhalt ${rate(upkeep, ' €/s')}`));
    if (game.state.metrics.arrears > 0) {
      summaryBody.appendChild(
        el(
          'div',
          'card-note',
          `Rückstand ${money(game.state.metrics.arrears)} — das Team arbeitet mit ${Math.round(
            COMPANY.payroll.unpaidFactor * 100,
          )} % Tempo.`,
        ),
      );
    }
    summary.appendChild(summaryBody);
    root.appendChild(summary);

    for (const row of rows) {
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', row.icon));
      const body = el('div', 'card-body');
      const title = el('div', 'card-title');
      title.appendChild(document.createTextNode(row.name));
      title.appendChild(el('span', 'count', `×${row.count}`));
      body.appendChild(title);
      body.appendChild(
        el('div', 'card-desc', `Erfahrung ${row.level}/${COMPANY.staff.maxLevel} · Lohn ${rate(row.wage, ' €/s')}`),
      );
      body.appendChild(xpBar(row.xp, row.level));
      card.appendChild(body);
      root.appendChild(card);
    }
  }

  /**
   * Prestige (GDD chapter 7). Three independent doors open the restart, so the
   * card shows all three with their progress rather than one opaque condition.
   */
  private renderPrestige(): void {
    const { game, root } = this;
    root.appendChild(el('div', 'screen-title', 'Neues Unternehmen (Prestige)'));

    const gain = pointsGain(game);
    const open = canPrestige(game);
    const card = el('div', 'card');
    card.appendChild(el('div', 'card-icon', '🏆'));
    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', `Industriepunkte: ${fmt(game.state.prestige.points, 0)}`));
    body.appendChild(
      el(
        'div',
        'card-desc',
        'Ein Neustart verkauft das Unternehmen. Industriepunkte, der Prestige-Baum, Erfolge und entdeckte Fahrzeuge bleiben.',
      ),
    );
    body.appendChild(
      el('div', open ? 'card-desc' : 'card-note', `Neustart bringt +${fmt(gain, 0)} Industriepunkte`),
    );
    if (game.state.level < BALANCE.prestige.requiredLevel) {
      body.appendChild(el('div', 'card-note', `Ab Level ${BALANCE.prestige.requiredLevel} möglich.`));
    }
    if (game.state.prestige.runs > 0) {
      body.appendChild(
        el(
          'div',
          'card-desc',
          `Durchläufe: ${game.state.prestige.runs} · Bester Umsatz: ${money(game.state.prestige.bestRun)} · Kosten ×${difficultyFactor(
            game.state.prestige.runs,
          ).toFixed(2)}`,
        ),
      );
    }
    card.appendChild(body);

    const actions = el('div', 'card-actions');
    const btn = el('button', open ? 'primary' : '');
    btn.textContent = 'Neu gründen';
    btn.disabled = !open;
    btn.addEventListener('click', () => this.confirmPrestige(gain));
    actions.appendChild(btn);
    card.appendChild(actions);
    root.appendChild(card);

    // One of these has to be met - show which is closest.
    for (const gate of gates(game)) {
      const row = el('div', 'card');
      const gbody = el('div', 'card-body');
      gbody.appendChild(
        el('div', gate.met ? 'card-desc' : 'card-note', `${gate.met ? '✔' : '○'} ${gate.label}`),
      );
      const bar = el('div', 'xp-bar');
      const fill = el('i');
      fill.style.width = `${Math.min(100, Math.max(1, gate.progress * 100))}%`;
      bar.appendChild(fill);
      gbody.appendChild(bar);
      row.appendChild(gbody);
      root.appendChild(row);
    }
  }

  private confirmPrestige(gain: number): void {
    const content = el('div');
    const yes = el('button', 'primary wide', `Ja, +${fmt(gain, 0)} Industriepunkte`);
    yes.addEventListener('click', () => {
      this.game.doPrestige();
      close();
      this.onReset?.();
    });
    content.appendChild(yes);

    const close = openModal({
      title: 'Unternehmen neu gründen?',
      body: 'Geld, Lager, Maschinen, Mitarbeiter, Technologien und Gelände werden zurückgesetzt. Industriepunkte, der Prestige-Baum, Erfolge und entdeckte Fahrzeuge bleiben erhalten. Jeder Durchlauf macht die Welt etwas teurer — und die Belohnungen deutlich größer.',
      content,
    });
  }

  /** The prestige tree: five branches, bought with Industriepunkte. */
  private renderPerks(): void {
    const { game, root } = this;
    if (game.state.prestige.runs === 0 && game.state.prestige.points === 0) return;

    root.appendChild(el('div', 'screen-title', `Prestige-Baum (${fmt(game.state.prestige.points, 0)} 🏆)`));

    const row = el('div', 'btn-row seg-row');
    for (const branch of PRESTIGE_BRANCHES) {
      const btn = el('button', branch === this.perkBranch ? '' : 'ghost');
      btn.innerHTML = `${PRESTIGE_ICON[branch]}<span class="price">${branch}</span>`;
      btn.addEventListener('click', () => {
        this.perkBranch = branch;
        this.refresh();
      });
      row.appendChild(btn);
    }
    root.appendChild(row);

    for (const perk of Content.perks.filter((p) => p.branch === this.perkBranch)) {
      const level = game.state.prestige.perks[perk.id] ?? 0;
      const cost = nextPerkCost(game, perk.id);
      const maxed = level >= perk.maxLevel;
      const reachable = meets(game.state, perk.requires, game.stats.unlocks);
      const affordable = canBuyPerk(game, perk.id);

      const card = el('div', `card${reachable || level > 0 ? '' : ' locked'}`);
      card.appendChild(el('div', 'card-icon', perk.icon));
      const body = el('div', 'card-body');
      const title = el('div', 'card-title');
      title.appendChild(document.createTextNode(perk.name));
      title.appendChild(el('span', 'count', `Stufe ${level}/${perk.maxLevel}`));
      body.appendChild(title);
      body.appendChild(el('div', 'card-desc', perk.desc));
      if (!reachable) body.appendChild(el('div', 'card-note', `🔒 ${requirementText(perk.requires)}`));
      card.appendChild(body);

      if (!maxed && reachable) {
        const actions = el('div', 'card-actions');
        const btn = el('button', affordable ? 'primary' : '');
        btn.innerHTML = `Kaufen<span class="price">${fmt(cost, 0)} 🏆</span>`;
        btn.disabled = !affordable;
        btn.addEventListener('click', () => {
          if (buyPerk(game, perk.id)) this.refresh();
        });
        actions.appendChild(btn);
        card.appendChild(actions);
      }
      root.appendChild(card);
    }
  }

  /** Achievements: different playstyles, small permanent nods. */
  private renderAchievements(): void {
    const { game, root } = this;
    const list = achievementRows(game);
    const earned = list.filter((r) => r.earned).length;
    root.appendChild(el('div', 'screen-title', `Erfolge (${earned}/${list.length})`));

    const owned = titles(game);
    if (owned.length > 0) {
      root.appendChild(el('div', 'card-note', `Titel: ${owned.join(' · ')}`));
    }

    // Earned first, then whatever is closest to completion - the next goal is
    // always the one at the top of the unearned pile.
    const sorted = [...list].sort(
      (a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress,
    );
    for (const row of sorted) {
      const card = el('div', `card${row.earned ? '' : ' locked'}`);
      card.appendChild(el('div', 'card-icon', row.earned ? row.def.icon : '🔒'));
      const body = el('div', 'card-body');
      const title = el('div', 'card-title');
      title.appendChild(document.createTextNode(row.def.name));
      if (row.def.title) title.appendChild(el('span', 'count', `„${row.def.title}"`));
      body.appendChild(title);
      body.appendChild(el('div', 'card-desc', row.def.desc));
      if (!row.earned) {
        const bar = el('div', 'xp-bar');
        const fill = el('i');
        fill.style.width = `${Math.max(1, row.progress * 100)}%`;
        bar.appendChild(fill);
        bar.style.margin = '5px 0 3px';
        body.appendChild(bar);
        body.appendChild(
          el('div', 'card-desc', `${fmt(row.value, 0)} / ${fmt(row.target, 0)}`),
        );
      }
      card.appendChild(body);
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

  /** The display case of random finds (GDD chapter 4: Zufallsfunde). */
  private renderFinds(): void {
    const { game, root } = this;
    const owned = Content.collectibles.filter((c) => (game.state.collection[c.id] ?? 0) > 0);
    root.appendChild(
      el('div', 'screen-title', `Fundstücke (${owned.length}/${Content.collectibles.length})`),
    );
    if (owned.length === 0) {
      root.appendChild(
        el('div', 'empty', 'Beim Zerlegen findet sich manchmal etwas Wertvolles. Noch nichts dabei.'),
      );
      return;
    }
    for (const item of owned) {
      const count = game.state.collection[item.id] ?? 0;
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', item.icon));
      const body = el('div', 'card-body');
      const title = el('div', 'card-title');
      title.appendChild(document.createTextNode(item.name));
      title.appendChild(el('span', 'count', `×${count}`));
      body.appendChild(title);
      body.appendChild(el('div', 'card-desc', `Verkaufswert ${money(item.value * game.stats.mult.sellPrice)}`));
      card.appendChild(body);

      const actions = el('div', 'card-actions');
      const sell = el('button', 'primary', 'Verkaufen');
      sell.addEventListener('click', () => {
        sellCollectible(game, item.id);
        this.refresh();
      });
      actions.appendChild(sell);
      card.appendChild(actions);
      root.appendChild(card);
    }
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

/** Profit figures read better when the sign is obvious at a glance. */
function signedStat(value: number, label: string): HTMLElement {
  const box = stat(`${value >= 0 ? '+' : ''}${money(value)}`, label);
  const b = box.querySelector('b');
  if (b) (b as HTMLElement).style.color = value >= 0 ? 'var(--good)' : 'var(--bad)';
  return box;
}

/** Progress towards the next experience level of a role. */
function xpBar(xp: number, level: number): HTMLElement {
  const bar = el('div', 'xp-bar');
  const fill = el('i');
  if (level >= COMPANY.staff.maxLevel) {
    fill.style.width = '100%';
  } else {
    let spent = 0;
    for (let l = 1; l < level; l++) spent += staffXpForLevel(l);
    const need = staffXpForLevel(level);
    fill.style.width = `${Math.min(100, ((xp - spent) / need) * 100)}%`;
  }
  bar.appendChild(fill);
  return bar;
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

const PRESTIGE_BRANCHES: PrestigeBranch[] = ['Produktion', 'Wirtschaft', 'Forschung', 'Logistik', 'Spezial'];

const PRESTIGE_ICON: Record<PrestigeBranch, string> = {
  Produktion: '🏭',
  Wirtschaft: '💰',
  Forschung: '🔬',
  Logistik: '🚚',
  Spezial: '✨',
};

/** A spendable Industriepunkt is worth a badge on the tab. */
function canAffordPerk(game: Game): boolean {
  return Content.perks.some((perk) => canBuyPerk(game, perk.id));
}
