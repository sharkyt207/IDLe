import { fmt } from '../../core/format';
import { t } from '../../core/i18n';
import type { Game } from '../../game/game';
import { coverage, sections, type HelpEntry } from '../../missions/help';
import { dialog, infoCard, progressBar, sectionTitle, segmentRow, statGrid, statTile } from '../components';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/**
 * Hilfe & Lexikon (GDD chapter 10).
 *
 * A reference the player opens when *they* have a question - never a popup.
 * Chapters unlock through missions, entries through discovery, and the counter
 * at the top turns "was habe ich noch nicht gesehen" into its own quiet goal.
 */
export class HelpScreen implements Screen {
  readonly id = 'help';
  readonly label = 'nav.sub.help';
  readonly icon = '📖';
  readonly root = el('div', 'screen');

  private chapter = 'help_basics';
  private search = '';
  private signature = '';

  constructor(private game: Game) {}

  refresh(): void {
    const all = sections(this.game);
    const open = all.filter((s) => s.unlocked);
    const stats = coverage(this.game);

    // The shell refreshes the visible screen four times a second. Rebuilding
    // this one every time would replace the search field mid-word - on a phone
    // that closes the keyboard - so it is only rebuilt when it would look
    // different, the same rule the tab bar follows (chapter 9).
    const signature = [this.chapter, this.search, stats.known, open.length].join('|');
    if (signature === this.signature) return;
    this.signature = signature;

    clear(this.root);

    this.root.appendChild(
      statGrid(
        statTile(`${open.length}/${all.length}`, t('help.chapters')),
        statTile(`${fmt(stats.known, 0)}/${fmt(stats.total, 0)}`, t('help.entries')),
        statTile(`${Math.round((stats.total > 0 ? stats.known / stats.total : 0) * 100)} %`, t('help.discovered')),
      ),
    );

    const field = el('input', 'help-search');
    field.type = 'search';
    field.placeholder = t('help.search');
    field.value = this.search;
    field.addEventListener('input', () => {
      this.search = field.value;
      this.signature = [this.chapter, this.search, stats.known, open.length].join('|');
      this.renderList();
    });
    this.root.appendChild(field);

    this.root.appendChild(
      segmentRow(
        open.map((s) => ({ id: s.chapter.id, label: s.chapter.name, icon: s.chapter.icon })),
        open.some((s) => s.chapter.id === this.chapter) ? this.chapter : (open[0]?.chapter.id ?? ''),
        (id) => {
          this.chapter = id;
          this.refresh();
        },
      ),
    );

    this.list = el('div');
    this.root.appendChild(this.list);
    this.renderList();

    // Locked chapters are named but not described: knowing one exists is a
    // goal, knowing what is in it is a spoiler.
    const locked = all.filter((s) => !s.unlocked);
    if (locked.length > 0) {
      this.root.appendChild(sectionTitle(t('help.lockedTitle')));
      for (const section of locked) {
        this.root.appendChild(
          infoCard({
            icon: '🔒',
            title: section.chapter.name,
            subtitle: t('help.lockedBody'),
            locked: true,
          }),
        );
      }
    }
  }

  private list = el('div');

  private renderList(): void {
    clear(this.list);
    const section = sections(this.game).find((s) => s.chapter.id === this.chapter && s.unlocked);
    if (!section) return;

    const needle = this.search.trim().toLowerCase();
    const entries = needle
      ? section.entries.filter(
          (e) => e.title.toLowerCase().includes(needle) || e.body.toLowerCase().includes(needle),
        )
      : section.entries;

    if (entries.length === 0) {
      this.list.appendChild(el('p', 'card-desc', needle ? t('help.noMatch') : t('help.nothingYet')));
    }
    for (const entry of entries) {
      this.list.appendChild(
        infoCard({
          icon: entry.icon,
          title: entry.title,
          subtitle: entry.body,
          onClick: entry.facts.length > 0 ? () => openEntry(entry) : undefined,
        }),
      );
    }

    if (section.hidden > 0) {
      const note = el('p', 'card-desc');
      note.textContent = t('help.hidden', { count: fmt(section.hidden, 0) });
      this.list.appendChild(note);
      this.list.appendChild(progressBar(section.entries.length / (section.entries.length + section.hidden)));
    }
  }
}

/** The detail window for one entry - the same anatomy as every other dialog. */
export function openEntry(entry: HelpEntry): void {
  const content = el('div');
  const grid = el('div', 'kv-grid');
  for (const [label, value] of entry.facts) {
    grid.appendChild(el('span', 'kv-key', label));
    grid.appendChild(el('span', 'kv-value', value));
  }
  content.appendChild(grid);
  dialog({ title: entry.title, icon: entry.icon, body: entry.body, content });
}
