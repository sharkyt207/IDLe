import { Content } from '../../data';
import { PROGRESS } from '../../data/progress';
import { duration, fmt, money, rate } from '../../core/format';
import type { TechBranch, TechDef } from '../../data/types';
import type { Game } from '../../game/game';
import { owned } from '../../game/state';
import {
  abandonResearch,
  researchSlots,
  slotsFree,
  startResearch,
  statusOf,
  techTier,
  visibleTechs,
} from '../../progress/research';
import { requirementText } from '../../progress/unlocks';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

const BRANCH_ICON: Record<TechBranch, string> = {
  Maschinen: '⚙️',
  Materialkunde: '⚗️',
  Robotik: '🤖',
  KI: '🧠',
  Energie: '⚡',
  Logistik: '🚚',
  Personal: '👷',
  Umwelttechnik: '🌿',
};

/**
 * Labor: the technology tree (GDD chapter 7).
 *
 * Branch chooser on top, running projects below it, then the technologies of
 * the chosen branch. Rare technologies simply appear in their branch once they
 * trigger - they are never shown as locked, because the surprise is the point.
 */
export class ResearchScreen implements Screen {
  readonly id = 'research';
  readonly label = 'Labor';
  readonly icon = '🔬';
  readonly root = el('div', 'screen');

  private branch: TechBranch = 'Maschinen';

  constructor(private game: Game) {}

  available(): boolean {
    return this.game.stats.unlocks.has('research');
  }

  hasNews(): boolean {
    if (slotsFree(this.game) <= 0) return false;
    return visibleTechs(this.game).some((tech) => statusOf(this.game, tech.id).canStart);
  }

  refresh(): void {
    clear(this.root);
    const { game } = this;

    if (!this.available()) {
      this.root.appendChild(
        el('div', 'empty', 'Baue zuerst ein Forschungslabor im Ausbau, um Forschung freizuschalten.'),
      );
      return;
    }

    this.renderHeader();
    this.renderActive();
    this.renderBranchRow();

    const techs = visibleTechs(game).filter((tech) => tech.branch === this.branch);
    if (techs.length === 0) {
      this.root.appendChild(el('div', 'empty', 'In diesem Zweig ist noch nichts erforschbar.'));
      return;
    }
    for (const tech of techs) this.root.appendChild(this.techCard(tech));
  }

  private renderHeader(): void {
    const { game } = this;
    const lab = Math.min(PROGRESS.research.labLevels, owned(game.state, 'lab'));

    const grid = el('div', 'stat-grid');
    grid.appendChild(stat(fmt(game.state.research.points, 0), 'Forschungspunkte'));
    grid.appendChild(stat(rate(game.stats.researchPointsPerSec, '/s'), 'Zuwachs'));
    grid.appendChild(stat(`${lab} / ${PROGRESS.research.labLevels}`, 'Laborstufe'));
    grid.appendChild(
      stat(`${game.state.research.active.length} / ${researchSlots(game)}`, 'Projekte parallel'),
    );
    this.root.appendChild(grid);

    this.root.appendChild(
      el(
        'div',
        'card-note',
        `Das Labor erforscht Technologien bis Stufe ${techTier(game)}. Jede Laborstufe hebt Tempo, Punkte und Grenze.`,
      ),
    );
  }

  private renderActive(): void {
    const { game } = this;
    const active = game.state.research.active;
    if (active.length === 0) return;

    this.root.appendChild(el('div', 'screen-title', 'Läuft gerade'));
    for (const project of active) {
      const tech = Content.researchNode(project.id);
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', tech?.icon ?? '🔬'));
      const body = el('div', 'card-body');
      body.appendChild(el('div', 'card-title', `${tech?.name ?? project.id} — Stufe ${project.level}`));
      body.appendChild(el('div', 'card-desc', `Noch ${duration(project.remaining)}`));
      const bar = el('div', 'xp-bar');
      const fill = el('i');
      fill.style.width = `${Math.max(2, (1 - project.remaining / Math.max(1, project.total)) * 100)}%`;
      bar.appendChild(fill);
      bar.style.marginTop = '6px';
      body.appendChild(bar);
      card.appendChild(body);

      const actions = el('div', 'card-actions');
      const stop = el('button', 'ghost', 'Abbrechen');
      stop.title = 'Die bereits bezahlten Kosten werden nicht erstattet.';
      stop.addEventListener('click', () => {
        abandonResearch(game, project.id);
        this.refresh();
      });
      actions.appendChild(stop);
      card.appendChild(actions);
      this.root.appendChild(card);
    }
  }

  private renderBranchRow(): void {
    const row = el('div', 'btn-row seg-row');
    const visible = visibleTechs(this.game);
    for (const branch of Object.keys(BRANCH_ICON) as TechBranch[]) {
      const count = visible.filter((t) => t.branch === branch).length;
      if (count === 0) continue;
      const btn = el('button', branch === this.branch ? '' : 'ghost');
      btn.innerHTML = `${BRANCH_ICON[branch]}<span class="price">${branch}</span>`;
      btn.addEventListener('click', () => {
        this.branch = branch;
        this.refresh();
      });
      row.appendChild(btn);
    }
    this.root.appendChild(row);
  }

  private techCard(tech: TechDef): HTMLElement {
    const { game } = this;
    const status = statusOf(game, tech.id);
    const maxed = status.level >= tech.maxLevel;
    const reachable = status.blockers.every((b) => b !== 'Voraussetzung fehlt');

    const card = el('div', `card${reachable || status.level > 0 ? '' : ' locked'}`);
    card.appendChild(el('div', 'card-icon', tech.icon));

    const body = el('div', 'card-body');
    const title = el('div', 'card-title');
    title.appendChild(document.createTextNode(tech.name));
    title.appendChild(el('span', 'count', `Stufe ${status.level}/${tech.maxLevel}`));
    body.appendChild(title);
    body.appendChild(el('div', 'card-desc', tech.desc));

    if (tech.secret) body.appendChild(el('div', 'card-desc', '✨ Seltene Technologie'));

    // Level bar, so the tree reads as progress rather than a list of buttons.
    const bar = el('div', 'xp-bar');
    const fill = el('i');
    fill.style.width = `${(status.level / tech.maxLevel) * 100}%`;
    bar.appendChild(fill);
    bar.style.margin = '5px 0 3px';
    body.appendChild(bar);

    // The next milestone is the reason to keep going - always name it.
    const next = tech.milestones?.find((m) => m.level > status.level);
    if (next) body.appendChild(el('div', 'card-desc', `Stufe ${next.level}: ${next.desc}`));

    if (maxed) {
      body.appendChild(el('div', 'card-desc', '✔ Endstufe erreicht'));
    } else if (!reachable) {
      body.appendChild(el('div', 'card-note', `🔒 ${requirementText(tech.requires)}`));
    } else {
      body.appendChild(el('div', 'card-desc', costText(status.cost, status.duration)));
      const missing = status.blockers.filter((b) => b !== 'Voraussetzung fehlt');
      if (missing.length > 0) body.appendChild(el('div', 'card-note', missing.join(' · ')));
    }
    card.appendChild(body);

    if (!maxed && reachable) {
      const actions = el('div', 'card-actions');
      const btn = el('button', status.canStart ? 'primary' : '');
      btn.innerHTML = `Forschen<span class="price">${fmt(status.cost.points, 0)} 🔬</span>`;
      btn.disabled = !status.canStart;
      btn.addEventListener('click', () => {
        if (startResearch(game, tech.id)) this.refresh();
      });
      actions.appendChild(btn);
      card.appendChild(actions);
    }
    return card;
  }
}

function costText(cost: { points: number; money: number; materials?: { material: string; amount: number }[] }, seconds: number): string {
  const parts = [`${fmt(cost.points, 0)} Punkte`, money(cost.money)];
  for (const need of cost.materials ?? []) {
    const def = Content.material(need.material);
    parts.push(`${fmt(need.amount, 0)} ${def?.icon ?? ''} ${def?.name ?? need.material}`);
  }
  parts.push(duration(seconds));
  return parts.join(' · ');
}

function stat(value: string, label: string): HTMLElement {
  const box = el('div', 'stat');
  box.appendChild(el('b', undefined, value));
  box.appendChild(el('span', undefined, label));
  return box;
}
