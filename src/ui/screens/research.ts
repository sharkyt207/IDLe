import { Content } from '../../data';
import { duration, money } from '../../core/format';
import type { ResearchDef } from '../../data/types';
import type { Game } from '../../game/game';
import { meetsRequirement, requirementText } from '../../game/stats';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/** Forschung: permanent multipliers and unlocks, gated by the lab. */
export class ResearchScreen implements Screen {
  readonly id = 'research';
  readonly label = 'Forschung';
  readonly icon = '🔬';
  readonly root = el('div', 'screen');

  constructor(private game: Game) {}

  available(): boolean {
    return this.game.stats.unlocks.has('research');
  }

  hasNews(): boolean {
    return !this.game.state.research.active && Content.research.some((node) => this.game.canResearch(node.id));
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

    const active = game.state.research.active;
    if (active) {
      const node = Content.researchNode(active.id);
      const card = el('div', 'card');
      card.appendChild(el('div', 'card-icon', node?.icon ?? '🔬'));
      const body = el('div', 'card-body');
      body.appendChild(el('div', 'card-title', `Läuft: ${node?.name ?? active.id}`));
      body.appendChild(el('div', 'card-desc', `Noch ${duration(active.remaining)}`));
      const bar = el('div', 'xp-bar');
      const fill = el('i');
      const total = node?.duration || 1;
      fill.style.width = `${Math.max(2, (1 - active.remaining / total) * 100)}%`;
      bar.appendChild(fill);
      bar.style.marginTop = '6px';
      body.appendChild(bar);
      card.appendChild(body);
      this.root.appendChild(card);
    }

    const branches = new Map<string, ResearchDef[]>();
    for (const node of Content.research) {
      const list = branches.get(node.branch) ?? [];
      list.push(node);
      branches.set(node.branch, list);
    }

    for (const [branch, nodes] of branches) {
      this.root.appendChild(el('div', 'screen-title', branch));
      for (const node of nodes) this.root.appendChild(this.nodeCard(node));
    }
  }

  private nodeCard(node: ResearchDef): HTMLElement {
    const { game } = this;
    const done = game.state.research.done.includes(node.id);
    const reachable = meetsRequirement(game.state, game.stats, node.requires);
    const busy = !!game.state.research.active;
    const affordable = game.state.money >= node.cost;

    const card = el('div', `card${reachable || done ? '' : ' locked'}`);
    card.appendChild(el('div', 'card-icon', node.icon));

    const body = el('div', 'card-body');
    body.appendChild(el('div', 'card-title', node.name));
    body.appendChild(el('div', 'card-desc', node.desc));
    if (done) body.appendChild(el('div', 'card-desc', '✔ Abgeschlossen'));
    else if (!reachable) body.appendChild(el('div', 'card-note', `🔒 ${requirementText(node.requires)}`));
    else body.appendChild(el('div', 'card-desc', `Dauer: ${duration(node.duration)}`));
    card.appendChild(body);

    if (!done && reachable) {
      const actions = el('div', 'card-actions');
      const btn = el('button', affordable && !busy ? 'primary' : '');
      btn.innerHTML = `Forschen<span class="price">${money(node.cost)}</span>`;
      btn.disabled = !affordable || busy;
      btn.addEventListener('click', () => {
        if (game.startResearch(node.id)) this.refresh();
      });
      actions.appendChild(btn);
      card.appendChild(actions);
    }
    return card;
  }
}
