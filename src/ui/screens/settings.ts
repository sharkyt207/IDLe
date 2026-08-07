import { THEMES, UI } from '../../data/ui';
import type { Game } from '../../game/game';
import { clearSave, exportSave, importSave } from '../../game/save';
import type { SoundSystem } from '../../audio/sound';
import { SOUND_PREVIEW } from '../../audio/sound';
import { applyTheme, clampScale } from '../theme';
import {
  dialog,
  iconButton,
  infoCard,
  primaryButton,
  secondaryButton,
  sectionTitle,
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
  readonly label = 'Einstellungen';
  readonly icon = '⚙️';
  readonly root = el('div', 'screen');

  /** Set by the shell so a reset or import can rebuild everything. */
  onReset?: () => void;

  constructor(
    private game: Game,
    private sound: SoundSystem,
  ) {}

  private apply(): void {
    applyTheme(this.game.state.settings);
    this.sound.update(this.game.state.settings);
    this.refresh();
  }

  refresh(): void {
    clear(this.root);
    this.renderThemes();
    this.renderDisplay();
    this.renderAudio();
    this.renderSave();
  }

  // ---------------------------------------------------------------------------

  private renderThemes(): void {
    const { game, root } = this;
    root.appendChild(sectionTitle('Darstellung'));

    for (const theme of THEMES) {
      const active = game.state.settings.theme === theme.id;
      const card = infoCard({
        icon: theme.icon,
        title: theme.name,
        subtitle: theme.desc,
        accent: theme.palette.blue,
        actions: [
          active
            ? secondaryButton({ label: 'Aktiv', icon: '✔', tone: 'good', disabled: true })
            : primaryButton({
                label: 'Wählen',
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
    root.appendChild(sectionTitle('Bedienung & Barrierefreiheit'));

    // UI scale, 80–150 %.
    const scaleCard = el('div', 'card');
    const scaleBody = el('div', 'card-body');
    scaleBody.appendChild(el('div', 'card-title', `Oberflächengröße: ${Math.round(s.uiScale * 100)} %`));
    scaleBody.appendChild(
      el('div', 'card-desc', `Zwischen ${UI.scale.min * 100} % und ${UI.scale.max * 100} % frei einstellbar.`),
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
      iconButton('↺', 'Zurücksetzen', () => {
        s.uiScale = UI.scale.default;
        this.apply();
      }),
    );
    scaleCard.appendChild(scaleActions);
    root.appendChild(scaleCard);

    root.appendChild(
      this.toggle('🎨', 'Farbenblind-Modus', 'Ersetzt Rot/Grün durch Blau/Orange.', s.colorblind, () => {
        s.colorblind = !s.colorblind;
        this.apply();
      }),
    );
    root.appendChild(
      this.toggle(
        '✨',
        'Reduzierte Effekte',
        'Weniger Partikel und ruhigere Animationen. Hilft auch auf schwächeren Geräten.',
        s.reducedEffects,
        () => {
          s.reducedEffects = !s.reducedEffects;
          this.apply();
        },
      ),
    );
    root.appendChild(
      this.toggle('📳', 'Vibration', 'Kurzes Feedback beim Zerlegen.', s.haptics, () => {
        s.haptics = !s.haptics;
        this.apply();
      }),
    );
    root.appendChild(
      this.toggle(
        '🤚',
        'Linkshänder-Modus',
        'Legt die Hauptbuttons auf die linke Seite.',
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
    root.appendChild(sectionTitle('Ton'));

    root.appendChild(
      this.toggle('🔊', 'Ton', 'Musik und Effekte insgesamt.', s.sound, () => {
        s.sound = !s.sound;
        this.apply();
      }),
    );

    if (!s.sound) return;

    const volumes: [string, string, 'volumeMusic' | 'volumeEffects' | 'volumeUi'][] = [
      ['🎵', 'Musik', 'volumeMusic'],
      ['🏭', 'Effekte', 'volumeEffects'],
      ['🔘', 'Oberfläche', 'volumeUi'],
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
    root.appendChild(sectionTitle('Spielstand'));

    const row = el('div', 'btn-row');
    row.appendChild(
      secondaryButton({
        label: 'Exportieren',
        icon: '📤',
        onClick: () => {
          const content = el('div');
          const area = el('textarea');
          area.value = exportSave(game.state);
          area.readOnly = true;
          content.appendChild(area);
          dialog({ title: 'Spielstand', icon: '📤', body: 'Kopiere diesen Text als Sicherung.', content });
        },
      }),
    );
    row.appendChild(
      secondaryButton({
        label: 'Importieren',
        icon: '📥',
        onClick: () => {
          const content = el('div');
          const area = el('textarea');
          area.placeholder = 'Spielstand hier einfügen';
          content.appendChild(area);
          content.appendChild(
            primaryButton({
              label: 'Laden',
              wide: true,
              onClick: () => {
                const state = importSave(area.value);
                if (!state) {
                  game.bus.emit('notice', { text: 'Ungültiger Spielstand', icon: '⚠️', tone: 'warn' });
                  return;
                }
                game.state = state;
                game.recompute();
                close();
                this.onReset?.();
              },
            }),
          );
          const close = dialog({ title: 'Spielstand importieren', icon: '📥', content });
        },
      }),
    );
    root.appendChild(row);

    const reset = secondaryButton({
      label: 'Alles zurücksetzen',
      icon: '🗑️',
      tone: 'bad',
      wide: true,
      onClick: () => {
        const content = el('div');
        content.appendChild(
          primaryButton({
            label: 'Ja, alles löschen',
            tone: 'bad',
            wide: true,
            onClick: () => {
              clearSave();
              location.reload();
            },
          }),
        );
        dialog({
          title: 'Wirklich alles löschen?',
          icon: '⚠️',
          body: 'Der komplette Fortschritt inklusive Industriepunkte und Erfolge geht verloren.',
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
