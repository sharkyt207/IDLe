/**
 * Localization (GDD chapter 9).
 *
 * Two kinds of text need translating, and they behave differently:
 *
 * 1. **Interface text** — buttons, labels, headings. These are keys from the
 *    start: `t('nav.market')`. A locale that misses a key falls back to German
 *    and logs it once in dev, so a gap is visible without breaking the screen.
 *
 * 2. **Content text** — the names and descriptions of 300+ machines, vehicles,
 *    materials and technologies. These live with their data (`name`, `desc`)
 *    because that is what makes a new machine one data entry rather than two.
 *    German is therefore the *source* locale, and a translation is an override
 *    table keyed by content id: `content.machine.magnet_crane.name`.
 *
 * That split is deliberate. Forcing content through keys as well would mean
 * every new machine needs an edit in two files, which is exactly the friction
 * chapter 9 tells us to avoid.
 */

export type LocaleId = 'de' | 'en' | 'fr' | 'es' | 'it' | 'pl' | 'tr' | 'ja';

export interface LocaleDef {
  id: LocaleId;
  /** Endonym, shown in the language picker. */
  name: string;
  flag: string;
  /** Interface strings. Missing keys fall back to German. */
  ui: Record<string, string>;
  /**
   * Content overrides, keyed `<kind>.<id>.<field>`, e.g.
   * `machine.magnet_crane.name`. Anything missing keeps the German source.
   */
  content?: Record<string, string>;
}

const locales = new Map<LocaleId, LocaleDef>();
let active: LocaleDef | undefined;
let fallback: LocaleDef | undefined;
const missing = new Set<string>();

/** Registers a locale. The first one registered is the fallback. */
export function registerLocale(def: LocaleDef): void {
  locales.set(def.id, def);
  fallback ??= def;
  active ??= def;
}

export function availableLocales(): LocaleDef[] {
  return [...locales.values()];
}

export function currentLocale(): LocaleId {
  return active?.id ?? 'de';
}

export function setLocale(id: string): boolean {
  const def = locales.get(id as LocaleId);
  if (!def) return false;
  active = def;
  return true;
}

/**
 * Interface string by key.
 *
 * @param params replaced as `{name}` placeholders; numbers are passed through
 *   untouched so the caller stays in charge of formatting.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const raw = active?.ui[key] ?? fallback?.ui[key];
  if (raw === undefined) {
    if (import.meta.env?.DEV && !missing.has(key)) {
      missing.add(key);
      console.warn(`[i18n] fehlender Schlüssel: ${key}`);
    }
    return key;
  }
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params[name] !== undefined ? String(params[name]) : whole,
  );
}

/**
 * Content string with the German source as fallback.
 *
 * @param kind content family: machine, vehicle, material, tech, …
 * @param source the German text from the data file
 */
export function tc(kind: string, id: string, field: string, source: string): string {
  return active?.content?.[`${kind}.${id}.${field}`] ?? source;
}

/** Keys that were requested but not defined. Used by the content check. */
export function missingKeys(): string[] {
  return [...missing];
}

/**
 * Locale keys that exist in German but not in `id`. Run in dev so a
 * half-translated locale is visible before it ships.
 */
export function untranslated(id: LocaleId): string[] {
  const target = locales.get(id);
  const base = fallback;
  if (!target || !base || target === base) return [];
  return Object.keys(base.ui).filter((key) => target.ui[key] === undefined);
}

/** Best guess from the browser, so a first start is already in the right language. */
export function detectLocale(): LocaleId {
  const candidates = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const tag of candidates) {
    const short = String(tag).slice(0, 2).toLowerCase() as LocaleId;
    if (locales.has(short)) return short;
  }
  return fallback?.id ?? 'de';
}
