import { Content } from '../data';
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
    title: 'Tippe auf die markierten Teile',
    text: 'Jeder Tipp löst ein Fahrzeugteil und bringt Material.',
    tab: 'yard',
    done: (g) => g.state.progressStats.partsRemoved >= 1,
  },
  {
    icon: '🚗',
    title: 'Zerlege das ganze Fahrzeug',
    text: 'Entferne alle Teile, dann ist der Kleinwagen erledigt.',
    tab: 'yard',
    done: (g) => g.state.progressStats.vehiclesDone >= 1,
  },
  {
    icon: '💶',
    title: 'Verkaufe deine Materialien',
    text: 'Öffne das Lager und mache aus Schrott Geld.',
    tab: 'storage',
    done: (g) => g.state.progressStats.sales >= 1,
  },
  {
    icon: '🛒',
    title: 'Kaufe neuen Schrott an',
    text: 'Im Ankauf bestellst du die nächste Lieferung.',
    tab: 'market',
    done: (g) => g.state.progressStats.purchases >= 1,
  },
  {
    icon: '🛠️',
    title: 'Kaufe dein erstes Upgrade',
    text: 'Im Ausbau wird aus Gewinn dauerhafte Leistung.',
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
    const t = this.game.state.tutorial;
    if (t.done) {
      this.setCoaching(false);
      this.root.replaceChildren();
      return;
    }

    while (t.step < STEPS.length && STEPS[t.step].done(this.game)) {
      t.step++;
      // The reward moment: after the first finished vehicle, pick a free upgrade.
      if (t.step === 2 && !t.choiceOffered) {
        t.choiceOffered = true;
        this.offerFirstChoice();
      }
    }

    if (t.step >= STEPS.length) {
      t.done = true;
      this.setCoaching(false);
      this.root.replaceChildren();
      this.game.bus.emit('notice', {
        text: 'Einführung abgeschlossen — der Hof gehört dir!',
        icon: '🎉',
        tone: 'good',
      });
      return;
    }

    this.render(STEPS[t.step]);
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
    body.appendChild(el('b', undefined, step.title));
    body.appendChild(el('span', undefined, step.text));
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
      title: 'Erstes Upgrade — geschenkt',
      body: 'Dein erstes Fahrzeug ist zerlegt. Wähle, womit dein Schrottplatz wächst. Es gibt keine falsche Entscheidung — alles andere kannst du später ebenfalls kaufen.',
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
