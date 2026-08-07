import { THEMES, UI } from '../../data/ui';
import { availableLocales, setLocale, t } from '../../core/i18n';
import type { Game } from '../../game/game';
import { clearSave, exportSave, importSave, saveGame } from '../../game/save';
import type { SoundSystem } from '../../audio/sound';
import { SOUND_PREVIEW } from '../../audio/sound';
import { forgetHints } from '../../missions/hints';
import { applyTheme, clampScale } from '../theme';
import {
  dialog,
  iconButton,
  infoCard,
  primaryButton,
  secondaryButton,
  sectionTitle,
  segmentRow,
} from '../components';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/**
 * Einstellungen (GDD chapter 8, one of the six main areas).
 *
 * Graphics, sound, saving - and the full accessibility set the chapter asks
 * for: UI scale 80–150 %, colour-blind mode, vibration, reduced particles,
 * separate volumes and a left-hand layout.
 *
 * Every change applies immediately. A settings screen with an "apply" button
 * is a settings screen people do not trust.
 */
export class SettingsScreen implements Screen {
  readonly id = 'settings';
  readonly label = 'nav.settings';
  readonly icon = '⚙️';
  readonly root = el('div', 'screen');

  /** Set by the shell so a reset or import can rebuild everything. */
  onReset?: () => void;

  constructor(
    private game: Game,
    private sound: SoundSystem,
  ) {}

  private apply(): void {
    setLocale(this.game.state.settings.locale);
    applyTheme(this.game.state.settings);
    this.sound.update(this.game.state.settings);
    this.onReset?.();
    this.refresh();
  }

  refresh(): void {
    clear(this.root);
    this.renderLanguage();
    this.renderThemes();
    this.renderDisplay();
    this.renderGuidance();
    this.renderAudio();
    this.renderSave();
  }

  /**
   * Spielerführung (GDD chapter 10).
   *
   * Hints and the mentor are separate switches on purpose: a player who finds
   * the voice too chatty usually still wants to be told the yard is full.
   */
  private renderGuidance(): void {
    const { game, root } = this;
    const s = game.state.settings;
    root.appendChild(sectionTitle(t('settings.guidance')));

    root.appendChild(
      this.toggle('💡', t('settings.hints'), t('settings.hintsDesc'), s.hints, () => {
        s.hints = !s.hints;
        this.apply();
      }),
    );
    root.appendChild(
      this.toggle('🧑‍🏫', t('settings.mentor'), t('settings.mentorDesc'), s.mentor, () => {
        s.mentor = !s.mentor;
        this.apply();
      }),
    );

    const seen = game.state.missions.hints.length;
    root.appendChild(
      secondaryButton({
        label: t('settings.hintsReset', { count: seen }),
        icon: '🔁',
        wide: true,
        disabled: seen === 0,
        onClick: () => {
          forgetHints(game);
          game.bus.emit('notice', { text: t('settings.hintsResetDone'), icon: '💡', tone: 'good' });
          this.refresh();
        },
      }),
    );
  }

  // ---------------------------------------------------------------------------

  /** Language picker (GDD chapter 9). Applies immediately, like everything else. */
  private renderLanguage(): void {
    const { game, root } = this;
    root.appendChild(sectionTitle(t('settings.language')));
    root.appendChild(
      segmentRow(
        availableLocales().map((l) => ({ id: l.id, label: l.name, icon: l.flag })),
        game.state.settings.locale,
        (id) => {
          game.state.settings.locale = id;
          this.apply();
        },
      ),
    );
  }

  private renderThemes(): void {
    const { game, root } = this;
    root.appendChild(sectionTitle(t('settings.display')));

    for (const theme of THEMES) {
      const active = game.state.settings.theme === theme.id;
      const card = infoCard({
        icon: theme.icon,
        title: theme.name,
        subtitle: theme.desc,
        accent: theme.palette.blue,
        actions: [
          active
            ? secondaryButton({ label: t('common.active'), icon: '✔', tone: 'good', disabled: true })
            : primaryButton({
                label: t('common.choose'),
                onClick: () => {
                  game.state.settings.theme = theme.id;
                  this.apply();
                },
              }),
        ],
      });
      root.appendChild(card);
    }
  }

  private renderDisplay(): void {
    const { game, root } = this;
    const s = game.state.settings;
    root.appendChild(sectionTitle(t('settings.accessibility')));

    // UI scale, 80–150 %.
    const scaleCard = el('div', 'card');
    const scaleBody = el('div', 'card-body');
    scaleBody.appendChild(el('div', 'card-title', t('settings.uiScale', { percent: Math.round(s.uiScale * 100) })));
    scaleBody.appendChild(
      el('div', 'card-desc', t('settings.uiScaleDesc', { min: UI.scale.min * 100, max: UI.scale.max * 100 })),
    );
    scaleBody.appendChild(
      slider(UI.scale.min, UI.scale.max, UI.scale.step, s.uiScale, (value) => {
        s.uiScale = clampScale(value);
        this.apply();
      }),
    );
    scaleCard.appendChild(scaleBody);

    const scaleActions = el('div', 'card-actions');
    scaleActions.appendChild(
      iconButton('↺', t('common.reset'), () => {
        s.uiScale = UI.scale.default;
        this.apply();
      }),
    );
    scaleCard.appendChild(scaleActions);
    root.appendChild(scaleCard);

    root.appendChild(
      this.toggle('🎨', t('settings.colorblind'), t('settings.colorblindDesc'), s.colorblind, () => {
        s.colorblind = !s.colorblind;
        this.apply();
      }),
    );
    root.appendChild(
      this.toggle(
        '✨',
        t('settings.reducedEffects'),
        t('settings.reducedEffectsDesc'),
        s.reducedEffects,
        () => {
          s.reducedEffects = !s.reducedEffects;
          this.apply();
        },
      ),
    );
    root.appendChild(
      this.toggle('📳', t('settings.haptics'), t('settings.hapticsDesc'), s.haptics, () => {
        s.haptics = !s.haptics;
        this.apply();
      }),
    );
    root.appendChild(
      this.toggle(
        '🤚',
        t('settings.leftHanded'),
        t('settings.leftHandedDesc'),
        s.leftHanded,
        () => {
          s.leftHanded = !s.leftHanded;
          this.apply();
        },
      ),
    );
  }

  private renderAudio(): void {
    const { game, root } = this;
    const s = game.state.settings;
    root.appendChild(sectionTitle(t('settings.audio')));

    root.appendChild(
      this.toggle('🔊', t('settings.sound'), t('settings.soundDesc'), s.sound, () => {
        s.sound = !s.sound;
        this.apply();
      }),
    );

    if (!s.sound) return;

    const volumes: [string, string, 'volumeMusic' | 'volumeEffects' | 'volumeUi'][] = [
      ['🎵', t('settings.volumeMusic'), 'volumeMusic'],
      ['🏭', t('settings.volumeEffects'), 'volumeEffects'],
      ['🔘', t('settings.volumeUi'), 'volumeUi'],
    ];
    for (const [icon, label, key] of volumes) {
      const card = el('div', 'card');
      const body = el('div', 'card-body');
      body.appendChild(el('div', 'card-title', `${icon} ${label}: ${Math.round(s[key] * 100)} %`));
      body.appendChild(
        slider(0, 1, 0.05, s[key], (value) => {
          s[key] = value;
          this.apply();
          if (key !== 'volumeMusic') this.sound.play(key === 'volumeUi' ? 'tap' : 'hit');
        }),
      );
      card.appendChild(body);
      root.appendChild(card);
    }

    const preview = el('div', 'btn-row seg-row');
    for (const entry of SOUND_PREVIEW) {
      preview.appendChild(
        secondaryButton({ label: entry.label, onClick: () => this.sound.play(entry.id) }),
      );
    }
    root.appendChild(preview);
  }

  private renderSave(): void {
    const { game, root } = this;
    root.appendChild(sectionTitle(t('settings.save')));

    const row = el('div', 'btn-row');
    row.appendChild(
      primaryButton({
        label: t('settings.saveNow'),
        icon: '💾',
        onClick: () => {
          saveGame(game.state);
          game.bus.emit('saved', { manual: true });
        },
      }),
    );
    row.appendChild(
      secondaryButton({
        label: t('settings.export'),
        icon: '📤',
        onClick: () => {
          const content = el('div');
          const area = el('textarea');
          area.value = exportSave(game.state);
          area.readOnly = true;
          content.appendChild(area);
          dialog({ title: t('settings.save'), icon: '📤', body: t('settings.exportBody'), content });
        },
      }),
    );
    row.appendChild(
      secondaryButton({
        label: t('settings.import'),
        icon: '📥',
        onClick: () => {
          const content = el('div');
          const area = el('textarea');
          area.placeholder = t('settings.importPlaceholder');
          content.appendChild(area);
          content.appendChild(
            primaryButton({
              label: t('common.load'),
              wide: true,
              onClick: () => {
                const state = importSave(area.value);
                if (!state) {
                  game.bus.emit('notice', { text: t('settings.importInvalid'), icon: '⚠️', tone: 'warn' });
                  return;
                }
                game.state = state;
                game.recompute();
                close();
                this.onReset?.();
              },
            }),
          );
          const close = dialog({ title: t('settings.importTitle'), icon: '📥', content });
        },
      }),
    );
    root.appendChild(row);

    const reset = secondaryButton({
      label: t('settings.resetAll'),
      icon: '🗑️',
      tone: 'bad',
      wide: true,
      onClick: () => {
        const content = el('div');
        content.appendChild(
          primaryButton({
            label: t('settings.resetYes'),
            tone: 'bad',
            wide: true,
            onClick: () => {
              clearSave();
              location.reload();
            },
          }),
        );
        dialog({
          title: t('settings.resetTitle'),
          icon: '⚠️',
          body: t('settings.resetBody'),
          content,
        });
      },
    });
    reset.style.color = 'var(--red)';
    root.appendChild(reset);
  }

  private toggle(icon: string, label: string, desc: string, on: boolean, onToggle: () => void): HTMLElement {
    const row = el('div', 'toggle-row');
    row.appendChild(el('span', 'toggle-icon', icon));
    const body = el('div', 'toggle-body');
    body.appendChild(el('span', 'toggle-label', label));
    body.appendChild(el('span', 'toggle-desc', desc));
    row.appendChild(body);
    const pill = el('span', on ? 'pill on' : 'pill', on ? 'An' : 'Aus');
    row.appendChild(pill);
    row.addEventListener('click', onToggle);
    return row;
  }
}

function slider(
  min: number,
  max: number,
  step: number,
  value: number,
  onInput: (value: number) => void,
): HTMLInputElement {
  const input = el('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.className = 'slider';
  let frame = 0;
  input.addEventListener('input', () => {
    // The whole screen rebuilds on change, so coalesce to one per frame.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => onInput(Number(input.value)));
  });
  return input;
}
