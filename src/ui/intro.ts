import { t } from '../core/i18n';
import type { Game } from '../game/game';
import { mentorLine } from '../missions/hints';
import { primaryButton } from './components';
import { el } from './dom';

/**
 * The opening (GDD chapter 10).
 *
 * "Kamerafahrt über den Hof, ein Pickup fährt vor, kurzer Begrüßungstext." All
 * three, in that order, and all three skippable - the sequence runs once per
 * company and never blocks the first tap for longer than it takes to read one
 * sentence.
 *
 * It is deliberately short. A first-time player is here to take a car apart;
 * everything that delays that has to earn its seconds.
 */

export interface IntroHost {
  /** Runs the scripted camera move over the yard. */
  flyOver(seconds: number): void;
  /** Sends a delivery truck down the road. */
  deliver(): void;
}

const FLIGHT_SECONDS = 3.4;

export class Intro {
  readonly root = el('div', 'intro');
  private running = false;

  constructor(
    private game: Game,
    private host: IntroHost,
  ) {}

  /** True while a fresh company has not seen the opening yet. */
  get pending(): boolean {
    return !this.game.state.missions.introSeen;
  }

  /** Plays it. Safe to call more than once - only the first call does anything. */
  play(): void {
    if (this.running || !this.pending) return;
    this.running = true;
    this.game.state.missions.introSeen = true;

    this.host.flyOver(FLIGHT_SECONDS);

    // The truck arrives while the camera is still moving, so the yard is
    // already doing something by the time the text appears.
    window.setTimeout(() => this.host.deliver(), FLIGHT_SECONDS * 380);
    window.setTimeout(() => this.showWelcome(), FLIGHT_SECONDS * 1000);
  }

  /** Cuts the sequence short - any tap during the flight lands here. */
  skip(): void {
    if (!this.running) return;
    this.running = false;
    this.root.replaceChildren();
  }

  private showWelcome(): void {
    const card = el('div', 'intro-card');
    card.appendChild(el('div', 'intro-icon', '🏗️'));
    card.appendChild(el('h2', undefined, t('intro.title')));
    card.appendChild(el('p', undefined, t('intro.body')));

    const line = mentorLine(this.game, 'welcome');
    if (line) card.appendChild(el('p', 'intro-mentor', `„${line}"`));

    card.appendChild(
      primaryButton({
        label: t('intro.start'),
        icon: '👉',
        wide: true,
        onClick: () => this.skip(),
      }),
    );
    this.root.replaceChildren(card);
    this.running = true;
  }
}
