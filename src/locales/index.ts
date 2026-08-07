import { registerLocale, type LocaleDef, type LocaleId } from '../core/i18n';
import { de } from './de';
import { en } from './en';

/**
 * Locale registry (GDD chapter 9).
 *
 * German is registered first and is therefore the fallback: any key a locale
 * has not translated yet shows German rather than a raw key or an empty label.
 *
 * The six languages below are prepared but not yet translated. They exist as
 * real entries on purpose - a translator adds strings to one file and the
 * language is done, with no code change anywhere. `npm run i18n` lists what is
 * still missing per locale.
 */
const PREPARED: { id: LocaleId; name: string; flag: string }[] = [
  { id: 'fr', name: 'Français', flag: '🇫🇷' },
  { id: 'es', name: 'Español', flag: '🇪🇸' },
  { id: 'it', name: 'Italiano', flag: '🇮🇹' },
  { id: 'pl', name: 'Polski', flag: '🇵🇱' },
  { id: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { id: 'ja', name: '日本語', flag: '🇯🇵' },
];

export const LOCALES: LocaleDef[] = [de, en, ...PREPARED.map((meta) => ({ ...meta, ui: {} }))];

let installed = false;

/** Registers every locale. Safe to call more than once. */
export function installLocales(): void {
  if (installed) return;
  installed = true;
  for (const locale of LOCALES) registerLocale(locale);
}
