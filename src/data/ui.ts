import type { Rarity } from './types';

/**
 * Art direction as data (GDD chapter 8).
 *
 * Every colour, radius, shadow and timing the interface uses is declared here
 * and pushed into CSS custom properties by `src/ui/theme.ts`. That is what
 * makes themes possible at all: a theme is a different token table, not a
 * second stylesheet.
 *
 * The look is "moderne Recyclinganlage", not "dreckiger Schrottplatz": clean
 * contours, strong colours, soft shadows, industrial greys underneath.
 */

/** Semantic palette from the GDD. Each colour means one thing, everywhere. */
export interface Palette {
  /** Menus, buttons, information. */
  blue: string;
  blueDim: string;
  /** Machines, warnings, interactions. */
  orange: string;
  orangeDim: string;
  /** Money, success, production. */
  green: string;
  greenDim: string;
  /** Research and upgrades. */
  yellow: string;
  yellowDim: string;
  /** Errors, power shortage, defects. */
  red: string;
  redDim: string;
}

export interface ThemeDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  palette: Palette;
  /** Backgrounds: industrial concrete, asphalt, metal, dark blue. */
  surfaces: {
    bg: string;
    bg2: string;
    panel: string;
    panel2: string;
    line: string;
    text: string;
    muted: string;
  };
  /** Ground and sky tint the isometric world is drawn with. */
  world: {
    /** Multiplied over every ground and building colour, as `#rrggbb`. */
    tint: string;
    /** How strongly the tint applies, 0…1. */
    tintStrength: number;
    /** Extra weather the theme forces, if any. */
    weather?: string;
  };
}

const INDUSTRIAL: Palette = {
  blue: '#4a9fe0',
  blueDim: '#2b5f88',
  orange: '#f08a3c',
  orangeDim: '#8a4c1e',
  green: '#5fd08c',
  greenDim: '#2f7a52',
  yellow: '#f0c04a',
  yellowDim: '#8a6f24',
  red: '#e0625f',
  redDim: '#8a3a38',
};

export const THEMES: ThemeDef[] = [
  {
    id: 'standard',
    name: 'Standard',
    icon: '🏭',
    desc: 'Moderne Recyclinganlage: Industriebeton, Asphalt, kräftige Signalfarben.',
    palette: INDUSTRIAL,
    surfaces: {
      bg: '#16191e',
      bg2: '#1e222a',
      panel: '#262b34',
      panel2: '#2f353f',
      line: '#3a414c',
      text: '#eef1f5',
      muted: '#a3acba',
    },
    world: { tint: '#ffffff', tintStrength: 0 },
  },
  {
    id: 'night',
    name: 'Nachtmodus',
    icon: '🌙',
    desc: 'Dunkler und kontrastärmer für die Nutzung im Dunkeln. Die Anlage bleibt beleuchtet.',
    palette: {
      ...INDUSTRIAL,
      blue: '#5aa8e0',
      yellow: '#e0b455',
      orange: '#d97f3c',
    },
    surfaces: {
      bg: '#0b0d12',
      bg2: '#12151b',
      panel: '#181c23',
      panel2: '#20252e',
      line: '#2a303a',
      text: '#dfe4ec',
      muted: '#8b94a3',
    },
    world: { tint: '#5a6b90', tintStrength: 0.35 },
  },
  {
    id: 'winter',
    name: 'Winter',
    icon: '❄️',
    desc: 'Kalte Lichtstimmung, Schnee auf dem Hof. Rein kosmetisch.',
    palette: {
      ...INDUSTRIAL,
      blue: '#6fbdf0',
      green: '#74d6a0',
      yellow: '#f2d072',
    },
    surfaces: {
      bg: '#141920',
      bg2: '#1c222b',
      panel: '#242b36',
      panel2: '#2e3642',
      line: '#3c4553',
      text: '#f2f6fb',
      muted: '#aab6c6',
    },
    world: { tint: '#cfe2f5', tintStrength: 0.28, weather: 'snow' },
  },
];

/**
 * Rarity colours (GDD chapter 8). They apply to vehicles, machines, materials
 * and collectibles alike, so a legendary anything reads the same everywhere.
 */
export type RarityTier = Rarity | 'mythic';

export const RARITY_COLOR: Record<RarityTier, string> = {
  common: '#9aa4b0',
  uncommon: '#5fd08c',
  rare: '#4a9fe0',
  epic: '#a97fe0',
  legendary: '#f0c04a',
  mythic: '#4fd8d0',
};

export const RARITY_NAME: Record<RarityTier, string> = {
  common: 'Normal',
  uncommon: 'Ungewöhnlich',
  rare: 'Selten',
  epic: 'Episch',
  legendary: 'Legendär',
  mythic: 'Mythisch',
};

export const RARITY_ORDER: RarityTier[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

/**
 * Shape, depth and motion. Kept in one place so a button, a card and a dialog
 * cannot drift apart - the GDD asks for one consistent system, not nine
 * similar-looking widgets.
 */
export const UI = {
  radius: { sm: '8px', md: '14px', lg: '20px', pill: '999px' },
  shadow: {
    /** Cards and panels: barely there, just enough to lift off the concrete. */
    soft: '0 1px 2px rgba(0,0,0,0.25), 0 4px 12px rgba(0,0,0,0.18)',
    /** Buttons at rest. */
    raised: '0 1px 0 rgba(255,255,255,0.08) inset, 0 2px 6px rgba(0,0,0,0.35)',
    /** Dialogs float clearly above everything. */
    dialog: '0 18px 48px rgba(0,0,0,0.55)',
  },
  motion: {
    /** Button press: shrink, then spring back. */
    press: 90,
    pressScale: 0.94,
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    /** Dialogs and windows fade + rise in. */
    dialogIn: 180,
    /** Toasts: visible time before they fade themselves out. */
    toastLife: 2600,
    toastOut: 320,
    /** Floating money numbers. */
    floatLife: 1100,
  },
  /** UI scale bounds from the accessibility section. */
  scale: { min: 0.8, max: 1.5, step: 0.05, default: 1 },
  /** Audio defaults, 0…1. */
  volume: { music: 0.35, effects: 0.6, ui: 0.5 },
} as const;

/**
 * Colour-blind safe overrides. Red/green is the one pairing the interface
 * genuinely relies on (money vs. error), so the mode shifts those two apart
 * in luminance and hue rather than just recolouring them.
 */
export const COLORBLIND: Partial<Palette> = {
  green: '#4fb3f5',
  greenDim: '#2b6d96',
  red: '#f2a33c',
  redDim: '#9a6320',
  orange: '#e0625f',
  orangeDim: '#8a3a38',
};

export function themeById(id: string): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
