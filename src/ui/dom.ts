/** Tiny DOM helpers - the UI stays framework free to keep the bundle small. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function button(label: string, className = '', onClick?: () => void): HTMLButtonElement {
  const b = el('button', className);
  b.innerHTML = label;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** Short vibration for tactile feedback where the device supports it. */
export function haptic(ms = 8): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      /* ignore */
    }
  }
}
