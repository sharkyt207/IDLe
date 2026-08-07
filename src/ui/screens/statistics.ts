import { Content } from '../../data';
import { COMPANY } from '../../data/company';
import { difficultyFactor } from '../../data/progress';
import { RARITY_COLOR } from '../../data/ui';
import { fmt, money, rate, units } from '../../core/format';
import type { Game } from '../../game/game';
import { report } from '../../company/statistics';
import { rows as achievementRows, titles } from '../../progress/achievements';
import { buyPerk, canBuyPerk, canPrestige, gates, nextPerkCost, pointsGain } from '../../progress/prestige';
import { meets, requirementText } from '../../progress/unlocks';
import { sellCollectible } from '../../economy/collection';
import type { PrestigeBranch } from '../../data/types';
import {
  badge,
  dialog,
  infoCard,
  primaryButton,
  progressBar,
  secondaryButton,
  segmentRow,
  sectionTitle,
  statGrid,
  statTile,
} from '../components';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

const PRESTIGE_BRANCHES: { id: PrestigeBranch; icon: string }[] = [
  { id: 'Produktion', icon: '🏭' },
  { id: 'Wirtschaft', icon: '💰' },
  { id: 'Forschung', icon: '🔬' },
  { id: 'Logistik', icon: '🚚' },
  { id: 'Spezial', icon: '✨' },
];

type Tab = 'zahlen' | 'erfolge' | 'prestige' | 'sammlung';

/**
 * Statistik (GDD chapter 8, one of the six main areas).
 *
 * Numbers, charts, profit and efficiency - plus the two long-term readouts
 * that belong with them: achievements and the prestige tree.
 */
export class StatisticsScreen implements Screen {
  readonly id = 'stats';
  readonly label = 'Statistik';
  readonly icon = '📊';
  readonly root = el('div', 'screen');

  /** Set by the shell so a prestige reset can rebuild the UI. */
  onReset?: () => void;

  private tab: Tab = 'zahlen';
  private perkBranch: PrestigeBranch = 'Produktion';

  constructor(private game: Game) {}

  hasNews(): boolean {
    return canPrestige(this.game) || Content.perks.some((p) => canBuyPerk(this.game, p.id));
  }

  refresh(): void {
    clear(this.root);
    this.root.appendChild(
      segmentRow(
        [
          { id: 'zahlen', label: 'Zahlen', icon: '📈' },
          { id: 'erfolge', label: 'Erfolge', icon: '🏅' },
          { id: 'prestige', label: 'Prestige', icon: '🏆' },
          { id: 'sammlung', label: 'Sammlung', icon: '🏺' },
        ],
        this.tab,
        (id) => {
          this.tab = id as Tab;
          this.refresh();
        },
      ),
    );

    if (this.tab === 'zahlen') this.renderNumbers();
    else if (this.tab === 'erfolge') this.renderAchievements();
    else if (this.tab === 'prestige') this.renderPrestige();
    else this.renderCollection();
  }

  // ---------------------------------------------------------------------------
  // Zahlen
  // ---------------------------------------------------------------------------

  private renderNumbers(): void {
    const { game, root } = this;
    const r = report(game);
    const s = game.state;

    root.appendChild(
      statGrid(
        signed(r.dayProfit, 'Tagesgewinn'),
        signed(r.weekProfit, `Wochengewinn (${COMPANY.metrics.weekDays} Tage)`),
        statTile(units(r.unitsRecycled), 'Produktionsmenge'),
        statTile(`${units(r.storageUnits)} / ${units(game.stats.storage)}`, 'Lagerbestand'),
        statTile(`${fmt(r.powerDemand)} / ${fmt(r.powerSupply)} kW`, 'Stromverbrauch'),
        statTile(String(r.employees), 'Mitarbeiter'),
        statTile(money(r.companyValue), 'Firmenwert'),
        statTile(`${Math.round(r.efficiency * 100)} %`, 'Effizienz', r.efficiency > 0.95 ? 'good' : 'warn'),
        statTile(`${fmt(r.co2Saved)} kg`, 'CO₂-Einsparung', 'good'),
        statTile(rate(r.runningCosts, ' €/s'), 'Laufende Kosten'),
      ),
    );

    if (r.efficiency < 0.95) {
      const reasons: string[] = [];
      if (game.stats.power.factor < 0.99) reasons.push('Strommangel');
      if (game.stats.condition < 0.95) reasons.push('Verschleiß');
      if (s.metrics.arrears > 0) reasons.push('offene Löhne');
      if (reasons.length) root.appendChild(el('div', 'card-note', `Effizienz gebremst durch: ${reasons.join(', ')}`));
    }

    // --- the business day and week, as a chart -------------------------------
    root.appendChild(sectionTitle('Geschäftstag'));
    const day = infoCard({
      title: `Laufender Tag — ${Math.round(r.dayProgress * 100)} %`,
      subtitle: `Einnahmen ${money(r.dayEarned)} · Ausgaben ${money(r.daySpent)}`,
      progress: r.dayProgress,
    });
    root.appendChild(day);

    const history = [...s.metrics.dayHistory, { earned: r.dayEarned, spent: r.daySpent }];
    if (history.length > 1) {
      root.appendChild(sectionTitle('Gewinn der letzten Tage'));
      root.appendChild(barChart(history.map((d) => d.earned - d.spent)));
    }

    // --- lifetime ------------------------------------------------------------
    root.appendChild(sectionTitle('Gesamt'));
    root.appendChild(
      statGrid(
        statTile(`Level ${s.level}`, `${fmt(s.xp, 0)} XP`),
        statTile(money(s.lifetimeEarned), 'Gesamtumsatz'),
        statTile(fmt(s.progressStats.vehiclesDone, 0), 'Fahrzeuge zerlegt'),
        statTile(fmt(s.progressStats.taps, 0), 'Manuelle Tipps'),
        statTile(`${fmt(game.stats.offlineHours, 0)} h`, 'Offline-Fortschritt'),
        statTile(`${Math.round(game.stats.condition * 100)} %`, 'Anlagenzustand'),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Erfolge
  // ---------------------------------------------------------------------------

  private renderAchievements(): void {
    const { game, root } = this;
    const list = achievementRows(game);
    const earned = list.filter((r) => r.earned).length;

    root.appendChild(sectionTitle(`Erfolge (${earned}/${list.length})`));
    const owned = titles(game);
    if (owned.length) root.appendChild(el('div', 'card-note', `Titel: ${owned.join(' · ')}`));

    const sorted = [...list].sort((a, b) => Number(b.earned) - Number(a.earned) || b.progress - a.progress);
    for (const row of sorted) {
      const card = infoCard({
        icon: row.earned ? row.def.icon : '🔒',
        title: row.def.name,
        subtitle: row.def.desc,
        lines: row.earned ? undefined : [`${fmt(row.value, 0)} / ${fmt(row.target, 0)}`],
        progress: row.earned ? undefined : row.progress,
        locked: !row.earned,
        accent: row.earned ? RARITY_COLOR.legendary : undefined,
      });
      if (row.def.title) {
        card.querySelector('.card-title')?.appendChild(badge(`„${row.def.title}"`, 'research'));
      }
      root.appendChild(card);
    }
  }

  // ---------------------------------------------------------------------------
  // Prestige
  // ---------------------------------------------------------------------------

  private renderPrestige(): void {
    const { game, root } = this;
    const gain = pointsGain(game);
    const open = canPrestige(game);

    root.appendChild(
      statGrid(
        statTile(fmt(game.state.prestige.points, 0), 'Industriepunkte', 'research'),
        statTile(`+${fmt(gain, 0)}`, 'bei Neustart', open ? 'good' : 'neutral'),
        statTile(String(game.state.prestige.runs), 'Neugründungen'),
        statTile(`×${difficultyFactor(game.state.prestige.runs).toFixed(2)}`, 'Kostenfaktor'),
      ),
    );

    root.appendChild(sectionTitle('Neues Unternehmen'));
    root.appendChild(
      infoCard({
        icon: '🏆',
        title: 'Unternehmen verkaufen',
        subtitle:
          'Industriepunkte, der Prestige-Baum, Erfolge und entdeckte Fahrzeuge bleiben. Alles andere beginnt von vorn.',
        actions: [
          primaryButton({
            label: 'Neu gründen',
            icon: '🏆',
            tone: 'research',
            disabled: !open,
            onClick: () => this.confirmPrestige(gain),
          }),
        ],
      }),
    );

    for (const gate of gates(game)) {
      const row = el('div', 'card');
      const body = el('div', 'card-body');
      body.appendChild(el('div', gate.met ? 'card-desc' : 'card-note', `${gate.met ? '✔' : '○'} ${gate.label}`));
      body.appendChild(progressBar(gate.progress, gate.met ? 'good' : 'info'));
      row.appendChild(body);
      root.appendChild(row);
    }

    root.appendChild(sectionTitle('Prestige-Baum'));
    root.appendChild(
      segmentRow(
        PRESTIGE_BRANCHES.map((b) => ({ id: b.id, label: b.id, icon: b.icon })),
        this.perkBranch,
        (id) => {
          this.perkBranch = id as PrestigeBranch;
          this.refresh();
        },
      ),
    );

    for (const perk of Content.perks.filter((p) => p.branch === this.perkBranch)) {
      const level = game.state.prestige.perks[perk.id] ?? 0;
      const cost = nextPerkCost(game, perk.id);
      const maxed = level >= perk.maxLevel;
      const reachable = meets(game.state, perk.requires, game.stats.unlocks);

      const card = infoCard({
        icon: perk.icon,
        title: perk.name,
        subtitle: perk.desc,
        note: reachable ? undefined : `🔒 ${requirementText(perk.requires)}`,
        locked: !reachable && level === 0,
        progress: level / perk.maxLevel,
        actions:
          maxed || !reachable
            ? undefined
            : [
                primaryButton({
                  label: 'Kaufen',
                  icon: '🏆',
                  tone: 'research',
                  hint: `${fmt(cost, 0)}`,
                  disabled: !canBuyPerk(game, perk.id),
                  onClick: () => {
                    if (buyPerk(game, perk.id)) this.refresh();
                  },
                }),
              ],
      });
      card.querySelector('.card-title')?.appendChild(badge(`${level}/${perk.maxLevel}`, 'research'));
      root.appendChild(card);
    }
  }

  private confirmPrestige(gain: number): void {
    const content = el('div');
    content.appendChild(
      primaryButton({
        label: `Ja, +${fmt(gain, 0)} Industriepunkte`,
        icon: '🏆',
        tone: 'research',
        wide: true,
        onClick: () => {
          this.game.doPrestige();
          close();
          this.onReset?.();
        },
      }),
    );
    const close = dialog({
      title: 'Unternehmen neu gründen?',
      icon: '🏆',
      body: 'Geld, Lager, Maschinen, Mitarbeiter, Technologien und Gelände werden zurückgesetzt. Jeder Durchlauf macht die Welt etwas teurer — und die Belohnungen deutlich größer.',
      content,
    });
  }

  // ---------------------------------------------------------------------------
  // Sammlung
  // ---------------------------------------------------------------------------

  private renderCollection(): void {
    const { game, root } = this;
    const found = game.state.progressStats.discovered;

    root.appendChild(sectionTitle(`Fahrzeugtypen (${found.length}/${Content.vehicles.length})`));
    const box = el('div', 'card');
    const body = el('div', 'card-body');
    const line = el('div', 'collection-strip');
    for (const v of Content.vehicles) {
      const chip = el('span', 'collection-chip', found.includes(v.id) ? v.icon : '❔');
      chip.title = found.includes(v.id) ? v.name : 'Noch nicht entdeckt';
      chip.style.setProperty('--chip-tone', RARITY_COLOR[v.rarity]);
      if (!found.includes(v.id)) chip.classList.add('unknown');
      line.appendChild(chip);
    }
    body.appendChild(line);
    body.appendChild(el('div', 'card-desc', 'Jeder zerlegte Fahrzeugtyp wird dauerhaft freigeschaltet.'));
    box.appendChild(body);
    root.appendChild(box);

    const owned = Content.collectibles.filter((c) => (game.state.collection[c.id] ?? 0) > 0);
    root.appendChild(sectionTitle(`Fundstücke (${owned.length}/${Content.collectibles.length})`));
    if (owned.length === 0) {
      root.appendChild(el('div', 'empty', 'Beim Zerlegen findet sich manchmal etwas Wertvolles.'));
      return;
    }
    for (const item of owned) {
      const count = game.state.collection[item.id] ?? 0;
      const card = infoCard({
        icon: item.icon,
        title: item.name,
        subtitle: `Verkaufswert ${money(item.value * game.stats.mult.sellPrice)}`,
        accent: RARITY_COLOR.legendary,
        actions: [
          secondaryButton({
            label: 'Verkaufen',
            icon: '💶',
            tone: 'good',
            onClick: () => {
              sellCollectible(game, item.id);
              this.refresh();
            },
          }),
        ],
      });
      card.querySelector('.card-title')?.appendChild(badge(`×${count}`));
      root.appendChild(card);
    }
  }
}

function signed(value: number, label: string): HTMLElement {
  return statTile(`${value >= 0 ? '+' : ''}${money(value)}`, label, value >= 0 ? 'good' : 'bad');
}

/**
 * A bar chart, drawn with DOM boxes rather than a canvas.
 *
 * A week is at most eight bars, so a chart library (or a second canvas) would
 * cost more than it delivers - and this one inherits the theme for free.
 */
function barChart(values: number[]): HTMLElement {
  const chart = el('div', 'chart');
  const peak = Math.max(1, ...values.map((v) => Math.abs(v)));
  values.forEach((value, index) => {
    const col = el('div', 'chart-col');
    const bar = el('i', value >= 0 ? 'up' : 'down');
    bar.style.height = `${Math.max(3, (Math.abs(value) / peak) * 100)}%`;
    bar.title = money(value);
    col.appendChild(bar);
    col.appendChild(el('span', undefined, index === values.length - 1 ? 'heute' : `−${values.length - 1 - index}`));
    chart.appendChild(col);
  });
  return chart;
}
