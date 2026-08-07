import { COLORBLIND, THEMES, UI, themeById, type ThemeDef } from '../data/ui';
import type { GameState } from '../game/state';

/**
 * Theme and accessibility manager (GDD chapter 8).
 *
 * Every visual token lives in `data/ui.ts` and is pushed onto the document
 * root as a CSS custom property. A theme is therefore a different table of
 * numbers, not a second stylesheet, and a winter or night skin costs one data
 * entry.
 *
 * The accessibility options ride the same mechanism: UI scale is a root font
 * size, reduced motion is an attribute the stylesheet reads, left-hand mode
 * flips one flex direction.
 */

let current: ThemeDef = THEMES[0];
/** Weather a freshly chosen theme wants; the environment picks it up. */
let pendingWeather: string | undefined;

/** Consumed once by the environment system after a theme change. */
export function takePendingWeather(): string | undefined {
  const weather = pendingWeather;
  pendingWeather = undefined;
  return weather;
}

/** The theme in effect right now - the world renderer asks for its tint. */
export function activeTheme(): ThemeDef {
  return current;
}

/** Applies a complete settings object. Cheap enough to call on every change. */
export function applyTheme(settings: GameState['settings']): void {
  const theme = themeById(settings.theme);
  current = theme;

  const root = document.documentElement;
  const palette = settings.colorblind ? { ...theme.palette, ...COLORBLIND } : theme.palette;

  // --- semantic colours ----------------------------------------------------
  root.style.setProperty('--blue', palette.blue);
  root.style.setProperty('--blue-dim', palette.blueDim);
  root.style.setProperty('--orange', palette.orange);
  root.style.setProperty('--orange-dim', palette.orangeDim);
  root.style.setProperty('--green', palette.green);
  root.style.setProperty('--green-dim', palette.greenDim);
  root.style.setProperty('--yellow', palette.yellow);
  root.style.setProperty('--yellow-dim', palette.yellowDim);
  root.style.setProperty('--red', palette.red);
  root.style.setProperty('--red-dim', palette.redDim);

  // Legacy aliases, so older markup keeps meaning the same thing.
  root.style.setProperty('--accent', palette.yellow);
  root.style.setProperty('--accent-dim', palette.yellowDim);
  root.style.setProperty('--good', palette.green);
  root.style.setProperty('--warn', palette.orange);
  root.style.setProperty('--bad', palette.red);

  // --- surfaces ------------------------------------------------------------
  for (const [key, value] of Object.entries(theme.surfaces)) {
    root.style.setProperty(`--${key === 'bg2' ? 'bg-2' : key === 'panel2' ? 'panel-2' : key}`, value);
  }

  // --- shape and depth -----------------------------------------------------
  root.style.setProperty('--radius-sm', UI.radius.sm);
  root.style.setProperty('--radius', UI.radius.md);
  root.style.setProperty('--radius-lg', UI.radius.lg);
  root.style.setProperty('--shadow-soft', UI.shadow.soft);
  root.style.setProperty('--shadow-raised', UI.shadow.raised);
  root.style.setProperty('--shadow-dialog', UI.shadow.dialog);
  root.style.setProperty('--press-ms', `${UI.motion.press}ms`);
  root.style.setProperty('--press-scale', String(UI.motion.pressScale));
  root.style.setProperty('--spring', UI.motion.spring);

  // --- accessibility -------------------------------------------------------
  const scale = clampScale(settings.uiScale);
  root.style.setProperty('--ui-scale', String(scale));
  root.style.fontSize = `${Math.round(16 * scale)}px`;

  // A theme that pins the weather applies it at once - waiting up to two
  // minutes for the snow to arrive would read as the setting not working.
  if (theme.world.weather && pendingWeather !== theme.world.weather) {
    pendingWeather = theme.world.weather;
  } else if (!theme.world.weather) {
    pendingWeather = undefined;
  }

  root.dataset.theme = theme.id;
  root.dataset.reducedMotion = settings.reducedEffects ? 'on' : 'off';
  root.dataset.hand = settings.leftHanded ? 'left' : 'right';
  root.dataset.colorblind = settings.colorblind ? 'on' : 'off';
}

export function clampScale(value: number): number {
  if (!Number.isFinite(value)) return UI.scale.default;
  return Math.min(UI.scale.max, Math.max(UI.scale.min, value));
}

/**
 * Particle budget multiplier. "Reduzierte Partikeleffekte" is an accessibility
 * option *and* the safety valve for weaker devices, so effects read it rather
 * than checking the setting themselves.
 */
export function particleScale(settings: GameState['settings']): number {
  return settings.reducedEffects ? 0.25 : 1;
}
