import { Content } from '../data';
import { t } from '../core/i18n';
import { money } from '../core/format';
import type { Game } from '../game/game';
import { nextCost } from '../game/stats';
import { el } from './dom';
import { openModal } from './modal';

interface Step {
  icon: string;
  title: string;
  text: string;
  /** Tab the coach mark points at. */
  tab: string;
  done: (game: Game) => boolean;
}

/**
 * Five short steps, playable in well under two minutes:
 * tap a part, finish the car, pick a free upgrade, sell, buy, upgrade.
 */
const STEPS: Step[] = [
  {
    icon: '👆',
    title: 'tutorial.tap.title',
    text: 'tutorial.tap.text',
    tab: 'yard',
    done: (g) => g.state.progressStats.partsRemoved >= 1,
  },
  {
    icon: '🚗',
    title: 'tutorial.finish.title',
    text: 'tutorial.finish.text',
    tab: 'yard',
    done: (g) => g.state.progressStats.vehiclesDone >= 1,
  },
  {
    icon: '💶',
    title: 'tutorial.sell.title',
    text: 'tutorial.sell.text',
    tab: 'storage',
    done: (g) => g.state.progressStats.sales >= 1,
  },
  {
    icon: '🛒',
    title: 'tutorial.buy.title',
    text: 'tutorial.buy.text',
    tab: 'market',
    done: (g) => g.state.progressStats.purchases >= 1,
  },
  {
    icon: '🛠️',
    title: 'tutorial.upgrade.title',
    text: 'tutorial.upgrade.text',
    tab: 'build',
    done: (g) => Object.values(g.state.owned).reduce((sum, n) => sum + n, 0) >= 2,
  },
];

/** The three-way first investment from the GDD - no wrong choice. */
const FIRST_CHOICES = ['hammer', 'storage_yard', 'magnet_crane'];

export class Tutorial {
  readonly root = el('div');
  private modalOpen = false;

  constructor(private game: Game, private navigate: (tab: string) => void) {}

  get active(): boolean {
    return !this.game.state.tutorial.done;
  }

  /** Toggles the body class that lifts the yard HUD above the coach card. */
  private setCoaching(on: boolean): void {
    document.body.classList.toggle('coaching', on);
  }

  /** Advances the script and re-renders the coach mark. */
  update(): void {
    const tut = this.game.state.tutorial;
    if (tut.done) {
      this.setCoaching(false);
      this.root.replaceChildren();
      return;
    }

    while (tut.step < STEPS.length && STEPS[tut.step].done(this.game)) {
      tut.step++;
      // The reward moment: after the first finished vehicle, pick a free upgrade.
      if (tut.step === 2 && !tut.choiceOffered) {
        tut.choiceOffered = true;
        this.offerFirstChoice();
      }
    }

    if (tut.step >= STEPS.length) {
      tut.done = true;
      this.setCoaching(false);
      this.root.replaceChildren();
      this.game.bus.emit('notice', {
        text: t('tutorial.complete'),
        icon: '🎉',
        tone: 'good',
      });
      return;
    }

    this.render(STEPS[tut.step]);
  }

  private render(step: Step): void {
    if (this.modalOpen) {
      this.setCoaching(false);
      this.root.replaceChildren();
      return;
    }
    this.setCoaching(true);
    const coach = el('div', 'coach');
    coach.appendChild(el('div', 'coach-icon', step.icon));
    const body = el('div');
    // Steps carry i18n keys, not text (GDD chapter 9).
    body.appendChild(el('b', undefined, t(step.title)));
    body.appendChild(el('span', undefined, t(step.text)));
    coach.appendChild(body);
    coach.addEventListener('click', () => this.navigate(step.tab));
    this.root.replaceChildren(coach);
  }

  private offerFirstChoice(): void {
    this.modalOpen = true;
    const content = el('div');

    for (const id of FIRST_CHOICES) {
      const def = Content.purchasable(id);
      if (!def) continue;
      const btn = el('button', 'choice');
      btn.appendChild(el('div', 'card-icon', def.icon));
      const body = el('div', 'card-body');
      body.appendChild(el('div', 'card-title', def.name));
      const small = el('small');
      small.textContent = `${def.desc}  (normal ${money(nextCost(this.game.state, id))})`;
      body.appendChild(small);
      btn.appendChild(body);
      btn.addEventListener('click', () => {
        this.grant(id);
        close();
      });
      content.appendChild(btn);
    }

    const close = openModal({
      title: t('tutorial.choiceTitle'),
      body: t('tutorial.choiceBody'),
      content,
      dismissable: false,
      onClose: () => {
        this.modalOpen = false;
        this.update();
      },
    });
  }

  private grant(id: string): void {
    const def = Content.purchasable(id);
    if (!def) return;
    this.game.state.owned[id] = (this.game.state.owned[id] ?? 0) + 1;
    this.game.recompute();
    this.game.bus.emit('notice', { text: `${def.name} freigeschaltet!`, icon: def.icon, tone: 'good' });
  }
}
