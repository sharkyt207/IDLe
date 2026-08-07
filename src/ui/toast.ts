import { el } from './dom';

/** Transient notifications. Old toasts are dropped so the stack stays short. */
export class Toasts {
  private root = el('div', 'toasts');
  private max = 3;

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  /**
   * @param onTap makes the toast actionable - a hint that says "das Lager ist
   *   voll" is twice as useful when tapping it opens the warehouse.
   */
  show(text: string, icon = '', tone: 'info' | 'good' | 'warn' = 'info', onTap?: () => void): void {
    const node = el('div', `toast ${tone}`);
    node.textContent = icon ? `${icon}  ${text}` : text;
    if (onTap) {
      node.classList.add('tappable');
      node.addEventListener('click', () => {
        onTap();
        node.remove();
      });
    }
    this.root.appendChild(node);
    while (this.root.childElementCount > this.max) {
      this.root.removeChild(this.root.firstChild!);
    }
    setTimeout(() => {
      node.style.transition = 'opacity .3s';
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 320);
    }, 2200);
  }
}
