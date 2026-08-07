/**
 * Structured logging (GDD chapter 9: "aussagekräftige Fehlermeldungen
 * protokollieren").
 *
 * Every message carries the subsystem it came from, so a console full of
 * output is still readable, and the last few entries are kept in a ring buffer
 * that the debug panel can show. A player who hits a bug can read the log
 * without a devtools console.
 *
 * Deliberately tiny: a logging library would be a runtime dependency, and this
 * game has none.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  time: number;
  level: LogLevel;
  scope: string;
  message: string;
}

const RING = 120;
const entries: LogEntry[] = [];
const seenOnce = new Set<string>();

function push(level: LogLevel, scope: string, message: string): void {
  entries.push({ time: Date.now(), level, scope, message });
  if (entries.length > RING) entries.shift();
}

function emit(level: LogLevel, scope: string, message: string, detail?: unknown): void {
  push(level, scope, message);
  const line = `[${scope}] ${message}`;
  if (level === 'error') console.error(line, detail ?? '');
  else if (level === 'warn') console.warn(line, detail ?? '');
  else if (import.meta.env?.DEV) console.info(line, detail ?? '');
}

export const log = {
  debug: (scope: string, message: string, detail?: unknown) => {
    if (import.meta.env?.DEV) emit('debug', scope, message, detail);
  },
  info: (scope: string, message: string, detail?: unknown) => emit('info', scope, message, detail),
  warn: (scope: string, message: string, detail?: unknown) => emit('warn', scope, message, detail),
  error: (scope: string, message: string, detail?: unknown) => emit('error', scope, message, detail),

  /** Logs a message at most once per key - for recurring content problems. */
  once: (level: LogLevel, scope: string, key: string, message: string) => {
    if (seenOnce.has(key)) return;
    seenOnce.add(key);
    emit(level, scope, message);
  },

  history: (): readonly LogEntry[] => entries,
  clear: (): void => {
    entries.length = 0;
  },
};

/**
 * Guards a callback so one broken subsystem cannot take the frame with it.
 *
 * Used at the few places where a throw would be fatal - the game loop and the
 * event bus. Everywhere else a throw should be loud, not swallowed.
 */
export function guard<T>(scope: string, what: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    log.error(scope, `${what} fehlgeschlagen`, error);
    return undefined;
  }
}

/**
 * Validates a number that comes from outside the simulation (a save file, an
 * imported string, a debug command).
 */
export function safeNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
