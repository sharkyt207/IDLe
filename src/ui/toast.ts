import { el } from './dom';

/** Transient notifications. Old toasts are dropped so the stack stays short. */
export class Toasts {
  private root = el('div', 'toasts');
  private max = 3;

  constructor(parent: HTMLElement) {
    parent.appendChild(this.root);
  }

  show(text: string, icon = '', tone: 'info' | 'good' | 'warn' = 'info'): void {
    const node = el('div', `toast ${tone}`);
    node.textContent = icon ? `${icon}  ${text}` : text;
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
