import { el } from './dom';

export interface ModalOptions {
  title: string;
  body?: string;
  /** Rendered below the text - buttons, choices, custom content. */
  content?: HTMLElement;
  /** Closing via backdrop tap. Off for blocking decisions. */
  dismissable?: boolean;
  onClose?: () => void;
}

/** Opens a modal and returns a close handle. */
export function openModal(options: ModalOptions): () => void {
  const backdrop = el('div', 'modal-backdrop');
  const modal = el('div', 'modal');

  const title = el('h2');
  title.textContent = options.title;
  modal.appendChild(title);

  if (options.body) {
    const p = el('p');
    p.textContent = options.body;
    modal.appendChild(p);
  }
  if (options.content) modal.appendChild(options.content);

  const close = () => {
    backdrop.remove();
    options.onClose?.();
  };

  if (options.dismissable !== false) {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    const dismiss = el('button', 'wide ghost', 'Schließen');
    dismiss.addEventListener('click', close);
    modal.appendChild(dismiss);
  }

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  return close;
}
