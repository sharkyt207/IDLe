import { Content } from '../../data';
import { COMPANY } from '../../data/company';
import { difficultyFactor } from '../../data/progress';
import { RARITY_COLOR } from '../../data/ui';
import { fmt, money, rate, units } from '../../core/format';
import { t } from '../../core/i18n';
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
  readonly label = 'nav.stats';
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
          { id: 'zahlen', label: t('stats.tab.numbers'), icon: '📈' },
          { id: 'erfolge', label: t('stats.tab.achievements'), icon: '🏅' },
          { id: 'prestige', label: t('stats.tab.prestige'), icon: '🏆' },
          { id: 'sammlung', label: t('stats.tab.collection'), icon: '🏺' },
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
        signed(r.dayProfit, t('stats.dayProfit')),
        signed(r.weekProfit, t('stats.weekProfit', { days: COMPANY.metrics.weekDays })),
        statTile(units(r.unitsRecycled), t('stats.production')),
        statTile(`${units(r.storageUnits)} / ${units(game.stats.storage)}`, t('stats.storage')),
        statTile(`${fmt(r.powerDemand)} / ${fmt(r.powerSupply)} kW`, t('stats.power')),
        statTile(String(r.employees), t('stats.employees')),
        statTile(money(r.companyValue), t('hud.companyValue')),
        statTile(`${Math.round(r.efficiency * 100)} %`, t('stats.efficiency'), r.efficiency > 0.95 ? 'good' : 'warn'),
        statTile(`${fmt(r.co2Saved)} kg`, t('stats.co2'), 'good'),
        statTile(rate(r.runningCosts, ' €/s'), t('stats.runningCosts')),
      ),
    );

    if (r.efficiency < 0.95) {
      const reasons: string[] = [];
      if (game.stats.power.factor < 0.99) reasons.push(t('stats.reason.power'));
      if (game.stats.condition < 0.95) reasons.push(t('stats.reason.wear'));
      if (s.metrics.arrears > 0) reasons.push(t('stats.reason.wages'));
      if (reasons.length) {
        root.appendChild(el('div', 'card-note', t('stats.efficiencySlowedBy', { reasons: reasons.join(', ') })));
      }
    }

    // --- the business day and week, as a chart -------------------------------
    root.appendChild(sectionTitle(t('stats.businessDay')));
    const day = infoCard({
      title: t('stats.currentDay', { percent: Math.round(r.dayProgress * 100) }),
      subtitle: t('stats.income', { earned: money(r.dayEarned), spent: money(r.daySpent) }),
      progress: r.dayProgress,
    });
    root.appendChild(day);

    const history = [...s.metrics.dayHistory, { earned: r.dayEarned, spent: r.daySpent }];
    if (history.length > 1) {
      root.appendChild(sectionTitle(t('stats.profitHistory')));
      root.appendChild(barChart(history.map((d) => d.earned - d.spent)));
    }

    // --- lifetime ------------------------------------------------------------
    root.appendChild(sectionTitle(t('stats.lifetime')));
    root.appendChild(
      statGrid(
        statTile(`${t('common.level')} ${s.level}`, `${fmt(s.xp, 0)} XP`),
        statTile(money(s.lifetimeEarned), t('stats.totalRevenue')),
        statTile(fmt(s.progressStats.vehiclesDone, 0), t('stats.vehiclesDone')),
        statTile(fmt(s.progressStats.taps, 0), t('stats.taps')),
        statTile(`${fmt(game.stats.offlineHours, 0)} h`, t('stats.offlineHours')),
        statTile(`${Math.round(game.stats.condition * 100)} %`, t('stats.machineCondition')),
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

    root.appendChild(sectionTitle(t('achievements.title', { earned, total: list.length })));
    const owned = titles(game);
    if (owned.length) root.appendChild(el('div', 'card-note', t('achievements.titles', { list: owned.join(' · ') })));

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
        statTile(fmt(game.state.prestige.points, 0), t('prestige.points'), 'research'),
        statTile(`+${fmt(gain, 0)}`, t('prestige.onRestart'), open ? 'good' : 'neutral'),
        statTile(String(game.state.prestige.runs), t('prestige.runs')),
        statTile(`×${difficultyFactor(game.state.prestige.runs).toFixed(2)}`, t('prestige.costFactor')),
      ),
    );

    root.appendChild(sectionTitle(t('prestige.newCompany')));
    root.appendChild(
      infoCard({
        icon: '🏆',
        title: t('prestige.sellCompany'),
        subtitle: t('prestige.sellCompanyDesc'),
        actions: [
          primaryButton({
            label: t('prestige.restart'),
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

    root.appendChild(sectionTitle(t('prestige.tree')));
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
                  label: t('common.buy'),
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
        label: t('prestige.confirmYes', { points: fmt(gain, 0) }),
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
      title: t('prestige.confirmTitle'),
      icon: '🏆',
      body: t('prestige.confirmBody'),
      content,
    });
  }

  // ---------------------------------------------------------------------------
  // Sammlung
  // ---------------------------------------------------------------------------

  private renderCollection(): void {
    const { game, root } = this;
    const found = game.state.progressStats.discovered;

    root.appendChild(sectionTitle(t('collection.vehicleTypes', { found: found.length, total: Content.vehicles.length })));
    const box = el('div', 'card');
    const body = el('div', 'card-body');
    const line = el('div', 'collection-strip');
    for (const v of Content.vehicles) {
      const chip = el('span', 'collection-chip', found.includes(v.id) ? v.icon : '❔');
      chip.title = found.includes(v.id) ? v.name : t('collection.unknown');
      chip.style.setProperty('--chip-tone', RARITY_COLOR[v.rarity]);
      if (!found.includes(v.id)) chip.classList.add('unknown');
      line.appendChild(chip);
    }
    body.appendChild(line);
    body.appendChild(el('div', 'card-desc', t('collection.vehicleNote')));
    box.appendChild(body);
    root.appendChild(box);

    const owned = Content.collectibles.filter((c) => (game.state.collection[c.id] ?? 0) > 0);
    root.appendChild(sectionTitle(t('collection.finds', { found: owned.length, total: Content.collectibles.length })));
    if (owned.length === 0) {
      root.appendChild(el('div', 'empty', t('collection.findsEmpty')));
      return;
    }
    for (const item of owned) {
      const count = game.state.collection[item.id] ?? 0;
      const card = infoCard({
        icon: item.icon,
        title: item.name,
        subtitle: t('collection.value', { amount: money(item.value * game.stats.mult.sellPrice) }),
        accent: RARITY_COLOR.legendary,
        actions: [
          secondaryButton({
            label: t('common.sell'),
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
