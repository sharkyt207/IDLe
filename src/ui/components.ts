import { RARITY_COLOR, RARITY_NAME, UI, type RarityTier } from '../data/ui';
import { t } from '../core/i18n';
import { el, haptic } from './dom';

/**
 * The design system (GDD chapter 8).
 *
 * Nine components, one look. Every screen builds from these instead of
 * hand-rolling markup, which is what keeps a nine-screen game consistent and
 * makes a theme change a one-file job.
 *
 *   Primary Button · Secondary Button · Icon Button · Info Card
 *   Progress Bar · Dialog · Tooltip · Badge · Status Indicator
 *
 * Everything here is framework free and returns plain DOM nodes.
 */

export type Tone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'research';

/** Maps a semantic tone to the palette from the art direction. */
const TONE_VAR: Record<Tone, string> = {
  neutral: '--muted',
  info: '--blue',
  good: '--green',
  warn: '--orange',
  bad: '--red',
  research: '--yellow',
};

export interface ButtonOptions {
  label: string;
  /** Small symbol in front of the label - the GDD asks for one on every button. */
  icon?: string;
  /** Right-aligned secondary line: a price, a cost, a rate. */
  hint?: string;
  tone?: Tone;
  disabled?: boolean;
  /** Fills the row. */
  wide?: boolean;
  onClick?: () => void;
  title?: string;
}

/**
 * Press feedback: shrink, then spring back (GDD chapter 8).
 *
 * Done in JS rather than `:active` so the animation completes even when the
 * finger leaves the button early - a press that visually never finishes reads
 * as a dropped input.
 */
export function attachPress(node: HTMLElement, onClick?: () => void): void {
  const down = () => {
    if ((node as HTMLButtonElement).disabled) return;
    node.style.transform = `scale(${UI.motion.pressScale})`;
    node.style.transition = `transform ${UI.motion.press}ms ease-out`;
  };
  const up = () => {
    node.style.transform = '';
    node.style.transition = `transform ${UI.motion.press * 3}ms ${UI.motion.spring}`;
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  node.addEventListener('pointerleave', up);
  if (onClick) node.addEventListener('click', onClick);
}

function baseButton(options: ButtonOptions, variant: string): HTMLButtonElement {
  const node = el('button', `btn ${variant}${options.wide ? ' wide' : ''}`);
  node.disabled = !!options.disabled;
  if (options.title) node.title = options.title;
  if (options.tone) node.style.setProperty('--btn-tone', `var(${TONE_VAR[options.tone]})`);

  if (options.icon) node.appendChild(el('span', 'btn-icon', options.icon));
  node.appendChild(el('span', 'btn-label', options.label));
  if (options.hint) node.appendChild(el('span', 'btn-hint', options.hint));

  attachPress(node, options.onClick);
  return node;
}

/** The call to action: gradient fill, shadow, icon. */
export function primaryButton(options: ButtonOptions): HTMLButtonElement {
  return baseButton({ tone: 'info', ...options }, 'btn-primary');
}

/** Everything else: outlined, quieter, same geometry. */
export function secondaryButton(options: ButtonOptions): HTMLButtonElement {
  return baseButton(options, 'btn-secondary');
}

/** Square button that is only a symbol - settings gears, locks, close. */
export function iconButton(icon: string, title: string, onClick?: () => void): HTMLButtonElement {
  const node = el('button', 'btn btn-icon-only');
  node.textContent = icon;
  node.title = title;
  node.setAttribute('aria-label', title);
  attachPress(node, onClick);
  return node;
}

export interface InfoCardOptions {
  icon?: string;
  title: string;
  /** One line under the title. */
  subtitle?: string;
  /** Additional muted lines. */
  lines?: string[];
  /** Warning-coloured line - "Material fehlt", "Wartung nötig". */
  note?: string;
  /** Right-hand column: buttons, values. */
  actions?: HTMLElement[];
  /** Colours the left edge - rarity, status, category. */
  accent?: string;
  /** Dimmed and non-interactive. */
  locked?: boolean;
  progress?: number;
  onClick?: () => void;
}

/** The workhorse: one row of content with an icon, text and actions. */
export function infoCard(options: InfoCardOptions): HTMLElement {
  const card = el('div', `card${options.locked ? ' locked' : ''}`);
  if (options.accent) card.style.setProperty('--card-accent', options.accent);

  if (options.icon !== undefined) card.appendChild(el('div', 'card-icon', options.icon));

  const body = el('div', 'card-body');
  body.appendChild(el('div', 'card-title', options.title));
  if (options.subtitle) body.appendChild(el('div', 'card-desc', options.subtitle));
  for (const line of options.lines ?? []) body.appendChild(el('div', 'card-desc', line));
  if (options.progress !== undefined) body.appendChild(progressBar(options.progress));
  if (options.note) body.appendChild(el('div', 'card-note', options.note));
  card.appendChild(body);

  if (options.actions?.length) {
    const actions = el('div', 'card-actions');
    for (const action of options.actions) actions.appendChild(action);
    card.appendChild(actions);
  }
  if (options.onClick) attachPress(card, options.onClick);
  return card;
}

/**
 * @param value 0…1
 * @param tone colours the fill; defaults to the accent gradient
 */
export function progressBar(value: number, tone?: Tone, label?: string): HTMLElement {
  const bar = el('div', 'xp-bar');
  const fill = el('i');
  fill.style.width = `${Math.max(0, Math.min(100, value * 100))}%`;
  if (tone) fill.style.background = `var(${TONE_VAR[tone]})`;
  bar.appendChild(fill);
  if (label) {
    const wrap = el('div', 'bar-wrap');
    wrap.appendChild(bar);
    wrap.appendChild(el('span', 'bar-label', label));
    return wrap;
  }
  return bar;
}

/** Small count or state chip next to a title. */
export function badge(text: string, tone: Tone = 'neutral'): HTMLElement {
  const node = el('span', 'badge-chip', text);
  node.style.setProperty('--chip-tone', `var(${TONE_VAR[tone]})`);
  return node;
}

/** A coloured dot plus label: running, idle, worn, offline. */
export function statusIndicator(text: string, tone: Tone): HTMLElement {
  const node = el('span', 'status');
  const dot = el('i', 'status-dot');
  dot.style.background = `var(${TONE_VAR[tone]})`;
  node.appendChild(dot);
  node.appendChild(el('span', undefined, text));
  return node;
}

/** Rarity chip - the same colours for vehicles, machines and materials. */
export function rarityBadge(tier: RarityTier): HTMLElement {
  const node = el('span', 'badge-chip rarity', RARITY_NAME[tier]);
  node.style.setProperty('--chip-tone', RARITY_COLOR[tier]);
  return node;
}

/**
 * Long-press to reveal information (GDD chapter 8: "Gedrückt halten →
 * Informationen anzeigen"). Returns a detach function.
 */
export function tooltip(anchor: HTMLElement, text: () => string, holdMs = 380): () => void {
  let timer: number | undefined;
  let node: HTMLElement | undefined;

  const hide = () => {
    window.clearTimeout(timer);
    timer = undefined;
    node?.remove();
    node = undefined;
  };

  const show = () => {
    hide();
    const box = el('div', 'tooltip', text());
    document.body.appendChild(box);
    const rect = anchor.getBoundingClientRect();
    // Keep it on screen: prefer above, fall back below, clamp horizontally.
    const top = rect.top - box.offsetHeight - 8;
    box.style.top = `${top > 8 ? top : rect.bottom + 8}px`;
    const left = rect.left + rect.width / 2 - box.offsetWidth / 2;
    box.style.left = `${Math.max(8, Math.min(window.innerWidth - box.offsetWidth - 8, left))}px`;
    box.style.opacity = '1';
    node = box;
    haptic(6);
  };

  const start = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(show, holdMs);
  };

  anchor.addEventListener('pointerdown', start);
  anchor.addEventListener('pointerup', hide);
  anchor.addEventListener('pointercancel', hide);
  anchor.addEventListener('pointerleave', hide);
  anchor.addEventListener('contextmenu', (e) => e.preventDefault());

  return () => {
    hide();
    anchor.removeEventListener('pointerdown', start);
    anchor.removeEventListener('pointerup', hide);
    anchor.removeEventListener('pointercancel', hide);
    anchor.removeEventListener('pointerleave', hide);
  };
}

export interface DialogOptions {
  title: string;
  icon?: string;
  body?: string;
  content?: HTMLElement;
  /** Closing via backdrop tap and the ✕. Off for blocking decisions. */
  dismissable?: boolean;
  onClose?: () => void;
}

/**
 * A window: soft fade-in, slight transparency, shadow, clear title bar and a
 * close button in the top right - exactly the anatomy the GDD describes.
 */
export function dialog(options: DialogOptions): () => void {
  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', 'modal');

  const close = () => {
    backdrop.classList.add('closing');
    window.setTimeout(() => backdrop.remove(), UI.motion.dialogIn);
    options.onClose?.();
  };

  const header = el('div', 'modal-head');
  if (options.icon) header.appendChild(el('span', 'modal-icon', options.icon));
  header.appendChild(el('h2', undefined, options.title));
  if (options.dismissable !== false) {
    const x = iconButton('✕', t('common.close'), close);
    x.classList.add('modal-close');
    header.appendChild(x);
  }
  modal.appendChild(header);

  if (options.body) {
    const p = el('p');
    p.textContent = options.body;
    modal.appendChild(p);
  }
  if (options.content) modal.appendChild(options.content);

  if (options.dismissable !== false) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  // One frame later so the entry transition actually runs.
  requestAnimationFrame(() => backdrop.classList.add('open'));
  return close;
}

/** A row of segment buttons - branch pickers, category tabs. */
export function segmentRow(
  entries: { id: string; label: string; icon?: string }[],
  active: string,
  onPick: (id: string) => void,
): HTMLElement {
  const row = el('div', 'btn-row seg-row');
  for (const entry of entries) {
    const btn = el('button', `btn seg${entry.id === active ? ' active' : ''}`);
    btn.dataset.id = entry.id;
    if (entry.icon) btn.appendChild(el('span', 'btn-icon', entry.icon));
    btn.appendChild(el('span', 'btn-label', entry.label));
    attachPress(btn, () => onPick(entry.id));
    row.appendChild(btn);
  }
  return row;
}

/** Section heading used by every screen. */
export function sectionTitle(text: string, right?: HTMLElement): HTMLElement {
  const node = el('div', 'screen-title', right ? undefined : text);
  if (right) {
    node.appendChild(el('span', undefined, text));
    node.appendChild(right);
    node.classList.add('with-action');
  }
  return node;
}

/** Big number plus caption, used in every stat grid. */
export function statTile(value: string, label: string, tone?: Tone): HTMLElement {
  const box = el('div', 'stat');
  const b = el('b', undefined, value);
  if (tone) b.style.color = `var(${TONE_VAR[tone]})`;
  box.appendChild(b);
  box.appendChild(el('span', undefined, label));
  return box;
}

export function statGrid(...tiles: HTMLElement[]): HTMLElement {
  const grid = el('div', 'stat-grid');
  for (const tile of tiles) grid.appendChild(tile);
  return grid;
}
