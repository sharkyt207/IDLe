const SUFFIXES = ['', 'K', 'Mio', 'Mrd', 'Bio', 'Brd', 'Trio', 'Trd', 'Qa', 'Qi'];

/** Compact number formatting for idle-scale values (German notation). */
export function fmt(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return '∞';
  const sign = value < 0 ? '-' : '';
  let n = Math.abs(value);
  if (n < 1000) {
    const d = n < 10 && n % 1 !== 0 ? decimals : 0;
    return sign + n.toFixed(d).replace('.', ',');
  }
  let tier = 0;
  while (n >= 1000 && tier < SUFFIXES.length - 1) {
    n /= 1000;
    tier++;
  }
  const d = n < 10 ? 2 : n < 100 ? 1 : 0;
  return `${sign}${n.toFixed(d).replace('.', ',')} ${SUFFIXES[tier]}`.trim();
}

/** Money with currency suffix. */
export function money(value: number): string {
  return `${fmt(value)} €`;
}

/** Rates like "12,4/s". */
export function rate(value: number, unit = '/s'): string {
  return `${fmt(value)}${unit}`;
}

/** Whole units, e.g. storage counts. */
export function units(value: number): string {
  return fmt(Math.floor(value), 0);
}

/** Duration in a short German form: 2 h 14 min. */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export function pct(factor: number): string {
  return `${((factor - 1) * 100).toFixed(0)} %`;
}
