import { t } from '../../core/i18n';
import { segmentRow } from '../components';
import { clear, el } from '../dom';
import type { Screen } from '../screen';

/**
 * A main area that hosts several sub-screens (GDD chapter 8).
 *
 * The GDD asks for exactly six main areas, but the game has more surfaces than
 * that - Markt alone covers buying, storage and contracts. A hub keeps the
 * navigation at six entries and puts the sub-screens behind a segment row, so
 * the bottom bar stays large and thumb-friendly instead of growing a ninth
 * cramped tab.
 *
 * Sub-screens are ordinary `Screen`s and do not know they are hosted.
 */
export class HubScreen implements Screen {
  readonly root = el('div', 'screen hub');
  private nav = el('div', 'hub-nav');
  private host = el('div', 'hub-host');
  private activeId: string;

  constructor(
    readonly id: string,
    readonly label: string,
    readonly icon: string,
    private children: Screen[],
  ) {
    this.activeId = children[0].id;
    this.root.appendChild(this.nav);
    this.root.appendChild(this.host);
    for (const child of children) {
      child.root.style.display = 'none';
      this.host.appendChild(child.root);
    }
  }

  /** True when this hub hosts the given sub-screen. */
  owns(id: string): boolean {
    return this.children.some((c) => c.id === id);
  }

  /** Sub-screens that are unlocked right now. */
  private visibleChildren(): Screen[] {
    return this.children.filter((c) => !c.available || c.available());
  }

  get active(): Screen {
    const visible = this.visibleChildren();
    return visible.find((c) => c.id === this.activeId) ?? visible[0] ?? this.children[0];
  }

  /** Switches sub-screen, or opens the hub on a specific one from outside. */
  show(id: string): void {
    const target = this.visibleChildren().find((c) => c.id === id);
    if (!target || target.id === this.activeId) return;
    const previous = this.children.find((c) => c.id === this.activeId);
    previous?.onLeave?.();
    if (previous) previous.root.style.display = 'none';
    this.activeId = target.id;
    this.refresh();
  }

  available(): boolean {
    return this.visibleChildren().length > 0;
  }

  hasNews(): boolean {
    return this.visibleChildren().some((c) => c.hasNews?.() === true);
  }

  onEnter(): void {
    this.active.onEnter?.();
  }

  onLeave(): void {
    this.active.onLeave?.();
  }

  refresh(): void {
    const visible = this.visibleChildren();
    const active = this.active;
    this.activeId = active.id;

    // A hub with a single sub-screen shows no chooser - it would be noise.
    clear(this.nav);
    if (visible.length > 1) {
      this.nav.appendChild(
        segmentRow(
          visible.map((c) => ({ id: c.id, label: c.label.includes('.') ? t(c.label) : c.label, icon: c.icon })),
          active.id,
          (id) => {
            this.show(id);
            active.onLeave?.();
            this.active.onEnter?.();
          },
        ),
      );
    }

    for (const child of this.children) {
      child.root.style.display = child.id === active.id ? '' : 'none';
    }
    active.refresh();
  }
}
