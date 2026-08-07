import { dialog, type DialogOptions } from './components';

/**
 * Compatibility wrapper.
 *
 * Windows are built by `components.dialog()` since chapter 8 (title bar, close
 * button, fade-in). This alias keeps the older call sites readable rather than
 * churning them all.
 */
export type ModalOptions = DialogOptions;

export function openModal(options: ModalOptions): () => void {
  return dialog(options);
}
