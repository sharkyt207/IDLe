import { Content } from '../data';
import { t } from '../core/i18n';
import { money } from '../core/format';
import type { Game } from '../game/game';
import { nextCost } from '../game/stats';
import { currentTutorial, tutorialActive } from '../missions/manager';
import { mentorLine } from '../missions/hints';
import { el } from './dom';
import { openModal } from './modal';

/**
 * The tutorial coach (GDD chapter 10).
 *
 * The five steps themselves are *missions* now, not a private script: the same
 * data file, the same progress tracker, the same rewards. This class is only
 * the coach mark that points at the current one - which is the whole reason
 * the rework was worth doing, because "Zerlege dein erstes Fahrzeug" was
 * previously implemented twice, once here and once as an achievement.
 *
 * What stays hand-written is the one moment the chapter singles out: after the
 * first finished vehicle the player picks a free upgrade. Three options, no
 * wrong answer - the first decision in the game is meant to feel like a
 * decision, not a test.
 */

/** The three-way first investment from the GDD - no wrong choice. */
const FIRST_CHOICES = ['hammer', 'storage_yard', 'magnet_crane'];

export class Tutorial {
  readonly root = el('div');
  private modalOpen = false;
  private lastStep = '';

  constructor(
    private game: Game,
    private navigate: (tab: string) => void,
  ) {}

  get active(): boolean {
    return tutorialActive(this.game);
  }

  /** Toggles the body class that lifts the yard HUD above the coach card. */
  private setCoaching(on: boolean): void {
    document.body.classList.toggle('coaching', on);
  }

  /** Re-renders the coach mark for whatever tutorial mission is open. */
  update(): void {
    const tut = this.game.state.tutorial;

    // The free upgrade fires on the first completed vehicle, independently of
    // which mission is open - it is a reward for the moment, not for a step.
    if (!tut.choiceOffered && this.game.state.progressStats.vehiclesDone >= 1 && !tut.done) {
      tut.choiceOffered = true;
      this.offerFirstChoice();
    }

    const row = this.active ? currentTutorial(this.game) : null;
    if (!row || this.modalOpen) {
      if (this.lastStep && !this.active) this.finish();
      this.setCoaching(false);
      this.root.replaceChildren();
      this.lastStep = this.active ? this.lastStep : '';
      return;
    }

    this.lastStep = row.def.id;
    this.setCoaching(true);

    const coach = el('div', 'coach');
    coach.appendChild(el('div', 'coach-icon', row.def.icon));
    const body = el('div');
    body.appendChild(el('b', undefined, row.def.name));
    body.appendChild(el('span', undefined, row.text));
    coach.appendChild(body);
    coach.addEventListener('click', () => this.navigate(row.def.screen ?? 'yard'));
    this.root.replaceChildren(coach);
  }

  private finish(): void {
    this.lastStep = '';
    const line = mentorLine(this.game, 'missionDone');
    this.game.bus.emit('notice', {
      text: line ? `${t('tutorial.complete')} ${line}` : t('tutorial.complete'),
      icon: '🎉',
      tone: 'good',
    });
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
