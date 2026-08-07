import { Content } from '../data';
import { THEMES, UI } from '../data/ui';
import { availableLocales, detectLocale } from '../core/i18n';
import { log } from '../core/log';
import { clampScale } from '../ui/theme';
import { createInitialState, SAVE_VERSION, type GameState } from './state';

const KEY = 'scrap-empire.save';

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Save migrations, applied in order from the stored version upwards.
 * Add one entry per breaking save change; never edit an existing one.
 */
const MIGRATIONS: Record<number, Migration> = {
  // 0 -> 1: initial format. Kept as a template for future changes.
  0: (raw) => ({ ...raw, version: 1 }),

  /**
   * 1 -> 2 (GDD chapter 7): research nodes became levelled technologies and
   * Reputation became Industriepunkte. Old completed nodes map to level 1 of
   * the technology with the same id; anything that no longer exists is
   * dropped by `sanitize` afterwards.
   */
  1: (raw) => {
    const research = (raw.research ?? {}) as { done?: unknown; active?: unknown };
    const techs: Record<string, number> = {};
    for (const id of Array.isArray(research.done) ? research.done : []) {
      if (typeof id === 'string') techs[id] = 1;
    }

    const prestige = (raw.prestige ?? {}) as Record<string, unknown>;
    // The perk ids were renamed rep_* -> ip_* when the tree grew branches.
    const perks: Record<string, number> = {};
    for (const [id, level] of Object.entries((prestige.perks ?? {}) as Record<string, number>)) {
      perks[id.startsWith('rep_') ? `ip_${id.slice(4)}` : id] = level;
    }
    const points = typeof prestige.reputation === 'number' ? prestige.reputation : 0;

    return {
      ...raw,
      version: 2,
      research: { points: 0, techs, active: [], seen: [] },
      prestige: { ...prestige, perks, points, lifetimePoints: points },
      achievements: [],
    };
  },

  /**
   * 2 -> 3 (GDD chapter 8): the settings block grew from one toggle to the
   * full presentation and accessibility set. `sanitize` fills the defaults, so
   * this only has to carry the version forward.
   */
  2: (raw) => ({ ...raw, version: 3 }),

  /**
   * 3 -> 4 (GDD chapter 9): the settings gained a language. `sanitize` falls
   * back to the browser language, so an existing save simply picks one up.
   */
  3: (raw) => ({ ...raw, version: 4 }),
};

/**
 * Rebuilds a valid state from arbitrary stored data: unknown keys are
 * dropped, missing keys fall back to defaults, content that no longer exists
 * is discarded. A corrupt or outdated save can therefore never brick a run.
 */
function sanitize(raw: Record<string, unknown>): GameState {
  const base = createInitialState();
  const src = raw as Partial<GameState>;

  const num = (value: unknown, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const bool = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;

  const state: GameState = {
    ...base,
    createdAt: num(src.createdAt, base.createdAt),
    lastSeen: num(src.lastSeen, Date.now()),
    playtime: num(src.playtime, 0),
    money: Math.max(0, num(src.money, base.money)),
    runEarned: Math.max(0, num(src.runEarned, 0)),
    lifetimeEarned: Math.max(0, num(src.lifetimeEarned, 0)),
    level: Math.max(1, Math.floor(num(src.level, 1))),
    xp: Math.max(0, num(src.xp, 0)),
    autoBuyVehicle: Content.vehicle(String(src.autoBuyVehicle)) ? String(src.autoBuyVehicle) : 'kleinwagen',
    autoBuyEnabled: bool(src.autoBuyEnabled, true),
    autoSellEnabled: bool(src.autoSellEnabled, true),
  };

  // Storage: keep only known materials, non-negative amounts.
  state.storage = {};
  for (const [id, amount] of Object.entries(src.storage ?? {})) {
    if (Content.material(id) && typeof amount === 'number' && amount > 0) {
      state.storage[id] = amount;
    }
  }

  // Owned: clamp to the definition's maxCount so a nerfed cap stays valid.
  state.owned = {};
  for (const [id, count] of Object.entries(src.owned ?? {})) {
    const def = Content.purchasable(id);
    if (def && typeof count === 'number' && count > 0) {
      state.owned[id] = Math.min(Math.floor(count), def.maxCount);
    }
  }

  state.condition = {};
  for (const [id, value] of Object.entries(src.condition ?? {})) {
    if (Content.purchasable(id) && typeof value === 'number' && Number.isFinite(value)) {
      state.condition[id] = Math.max(0, Math.min(1, value));
    }
  }

  state.staffXp = {};
  for (const [id, xp] of Object.entries(src.staffXp ?? {})) {
    if (Content.purchasable(id) && typeof xp === 'number' && xp > 0) state.staffXp[id] = xp;
  }

  state.rules = {};
  for (const [id, rule] of Object.entries(src.rules ?? {})) {
    if (!Content.material(id) || !rule || typeof rule !== 'object') continue;
    const clean: { keep?: number; minPrice?: number } = {};
    const r = rule as { keep?: unknown; minPrice?: unknown };
    if (typeof r.keep === 'number' && r.keep > 0) clean.keep = Math.floor(r.keep);
    if (typeof r.minPrice === 'number' && r.minPrice > 0) clean.minPrice = r.minPrice;
    if (Object.keys(clean).length > 0) state.rules[id] = clean;
  }

  state.priority = Content.priority(String(src.priority)) ? String(src.priority) : 'balanced';

  state.metrics = {
    dayTime: Math.max(0, num(src.metrics?.dayTime, 0)),
    dayEarned: Math.max(0, num(src.metrics?.dayEarned, 0)),
    daySpent: Math.max(0, num(src.metrics?.daySpent, 0)),
    dayHistory: (src.metrics?.dayHistory ?? [])
      .filter((d) => d && typeof d === 'object')
      .slice(-7)
      .map((d) => ({ earned: Math.max(0, num(d.earned, 0)), spent: Math.max(0, num(d.spent, 0)) })),
    unitsRecycled: Math.max(0, num(src.metrics?.unitsRecycled, 0)),
    arrears: Math.max(0, num(src.metrics?.arrears, 0)),
  };

  // Quality only makes sense for material that is actually there.
  state.quality = {};
  for (const [id, value] of Object.entries(src.quality ?? {})) {
    if (state.storage[id] !== undefined && typeof value === 'number' && Number.isFinite(value)) {
      state.quality[id] = Math.max(0, Math.min(1, value));
    }
  }

  state.collection = {};
  for (const [id, count] of Object.entries(src.collection ?? {})) {
    if (Content.collectible(id) && typeof count === 'number' && count > 0) {
      state.collection[id] = Math.floor(count);
    }
  }

  const validDemand = (demand: unknown): demand is { material: string; amount: number }[] =>
    Array.isArray(demand) &&
    demand.every((d) => d && Content.material((d as { material: string }).material));
  const cleanOffer = (offer: unknown) => {
    const o = offer as { key?: string; defId?: string; demand?: unknown; payout?: number; income?: number };
    if (!o?.key || !o.defId || !Content.contract(o.defId) || !validDemand(o.demand)) return null;
    return {
      key: String(o.key),
      defId: o.defId,
      demand: o.demand,
      payout: Math.max(0, num(o.payout, 0)),
      income: Math.max(0, num(o.income, 0)),
    };
  };

  const offers = (src.trade?.offers ?? []).map(cleanOffer).filter((o) => o !== null);
  const activeContracts = (src.trade?.active ?? [])
    .map((entry) => {
      const base = cleanOffer(entry);
      if (!base) return null;
      const source = entry as unknown as { delivered?: Record<string, number>; incomeLeft?: number; done?: boolean };
      const delivered: Record<string, number> = {};
      for (const [id, amount] of Object.entries(source.delivered ?? {})) {
        if (Content.material(id) && typeof amount === 'number' && amount > 0) delivered[id] = amount;
      }
      return {
        ...base,
        delivered,
        incomeLeft: Math.max(0, num(source.incomeLeft, 0)),
        done: source.done === true,
      };
    })
    .filter((c) => c !== null);

  const rawAuction = src.trade?.auction;
  state.trade = {
    offers,
    active: activeContracts,
    offerTimer: Math.max(0, num(src.trade?.offerTimer, 20)),
    auction:
      rawAuction && Content.auctionLot(rawAuction.lotId)
        ? {
            lotId: rawAuction.lotId,
            value: Math.max(0, num(rawAuction.value, 0)),
            bid: Math.max(0, num(rawAuction.bid, 0)),
            increment: Math.max(1, num(rawAuction.increment, 1)),
            playerLeads: rawAuction.playerLeads === true,
            timeLeft: Math.max(0, num(rawAuction.timeLeft, 0)),
            aiThink: Math.max(0, num(rawAuction.aiThink, 0)),
            aiMax: Math.max(0, num(rawAuction.aiMax, 0)),
          }
        : null,
    auctionTimer: Math.max(0, num(src.trade?.auctionTimer, 90)),
  };

  state.autoSellLocked = {};
  for (const [id, locked] of Object.entries(src.autoSellLocked ?? {})) {
    if (Content.material(id) && locked === true) state.autoSellLocked[id] = true;
  }

  // Technologies: keep only known ids, clamp levels to the current maxLevel.
  const techs: Record<string, number> = {};
  for (const [id, level] of Object.entries(src.research?.techs ?? {})) {
    const tech = Content.researchNode(id);
    if (tech && typeof level === 'number' && level > 0) {
      techs[id] = Math.min(Math.floor(level), tech.maxLevel);
    }
  }
  const active = (src.research?.active ?? [])
    .map((raw) => {
      const p = raw as unknown as { id?: string; level?: number; remaining?: number; total?: number };
      const tech = p?.id ? Content.researchNode(p.id) : undefined;
      if (!tech) return null;
      const level = Math.max(1, Math.min(Math.floor(num(p.level, 1)), tech.maxLevel));
      // A project for a level the player already has would never finish.
      if ((techs[tech.id] ?? 0) >= level) return null;
      const total = Math.max(1, num(p.total, tech.duration));
      return { id: tech.id, level, remaining: Math.max(0, Math.min(total, num(p.remaining, total))), total };
    })
    .filter((p) => p !== null);

  state.research = {
    points: Math.max(0, num(src.research?.points, 0)),
    techs,
    active,
    seen: (src.research?.seen ?? []).filter((key) => typeof key === 'string'),
  };

  state.queue = (src.queue ?? []).filter((id) => !!Content.vehicle(id)).slice(0, 64);

  // Active vehicle: rebuild parts against the current definition so content
  // updates (added/removed parts) never desync a save.
  const activeDef = src.active ? Content.vehicle(src.active.defId) : undefined;
  state.active = activeDef
    ? {
        defId: activeDef.id,
        parts: activeDef.parts.map((part) => {
          const saved = src.active?.parts.find((p) => p.id === part.id);
          const work = Math.min(part.work, Math.max(0, num(saved?.work, 0)));
          return { id: part.id, work, done: saved?.done === true || work >= part.work };
        }),
      }
    : null;

  const perks: Record<string, number> = {};
  for (const [id, level] of Object.entries(src.prestige?.perks ?? {})) {
    const perk = Content.perk(id);
    if (perk && typeof level === 'number' && level > 0) {
      perks[id] = Math.min(Math.floor(level), perk.maxLevel);
    }
  }
  const points = Math.max(0, num(src.prestige?.points, 0));
  state.prestige = {
    points,
    lifetimePoints: Math.max(points, num(src.prestige?.lifetimePoints, points)),
    perks,
    runs: Math.max(0, Math.floor(num(src.prestige?.runs, 0))),
    bestRun: Math.max(0, num(src.prestige?.bestRun, 0)),
  };

  state.achievements = [...new Set((src.achievements ?? []).filter((id) => !!Content.achievement(id)))];

  // World: keep only placements whose keys still exist as content.
  const placements: Record<string, string> = {};
  for (const [key, slot] of Object.entries(src.world?.placements ?? {})) {
    const defId = key.split('#')[0];
    if (Content.purchasable(defId) && typeof slot === 'string') placements[key] = slot;
  }
  state.world = {
    placements,
    dayTime: Math.max(0, num(src.world?.dayTime, 300)),
    weather: typeof src.world?.weather === 'string' ? src.world.weather : 'clear',
    weatherLeft: Math.max(0, num(src.world?.weatherLeft, 120)),
  };

  state.tutorial = {
    step: Math.max(0, Math.floor(num(src.tutorial?.step, 0))),
    done: bool(src.tutorial?.done, false),
    choiceOffered: bool(src.tutorial?.choiceOffered, false),
  };

  state.progressStats = {
    vehiclesDone: Math.max(0, Math.floor(num(src.progressStats?.vehiclesDone, 0))),
    partsRemoved: Math.max(0, Math.floor(num(src.progressStats?.partsRemoved, 0))),
    taps: Math.max(0, Math.floor(num(src.progressStats?.taps, 0))),
    sales: Math.max(0, Math.floor(num(src.progressStats?.sales, 0))),
    purchases: Math.max(0, Math.floor(num(src.progressStats?.purchases, 0))),
    discovered: (src.progressStats?.discovered ?? []).filter((id) => !!Content.vehicle(id)),
    materials: Object.fromEntries(
      Object.entries(src.progressStats?.materials ?? {}).filter(
        ([id, amount]) => Content.material(id) && typeof amount === 'number' && amount > 0,
      ),
    ),
  };

  const volume = (value: unknown, fallback: number) => Math.max(0, Math.min(1, num(value, fallback)));
  state.settings = {
    haptics: bool(src.settings?.haptics, true),
    locale: availableLocales().some((l) => l.id === src.settings?.locale)
      ? String(src.settings?.locale)
      : detectLocale(),
    theme: THEMES.some((t) => t.id === src.settings?.theme) ? String(src.settings?.theme) : 'standard',
    uiScale: clampScale(num(src.settings?.uiScale, UI.scale.default)),
    colorblind: bool(src.settings?.colorblind, false),
    reducedEffects: bool(src.settings?.reducedEffects, false),
    leftHanded: bool(src.settings?.leftHanded, false),
    sound: bool(src.settings?.sound, true),
    volumeMusic: volume(src.settings?.volumeMusic, UI.volume.music),
    volumeEffects: volume(src.settings?.volumeEffects, UI.volume.effects),
    volumeUi: volume(src.settings?.volumeUi, UI.volume.ui),
  };

  state.version = SAVE_VERSION;
  return state;
}

function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let version = typeof raw.version === 'number' ? raw.version : 0;
  let data = raw;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version = typeof data.version === 'number' ? data.version : version + 1;
  }
  return data;
}

export interface LoadResult {
  state: GameState;
  /** Seconds elapsed since the save was written. */
  awaySeconds: number;
}

export function loadGame(): LoadResult | null {
  let text: string | null = null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    return null; // private mode / storage disabled - play without persistence
  }
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const state = sanitize(migrate(parsed));
    const awaySeconds = Math.max(0, (Date.now() - state.lastSeen) / 1000);
    return { state, awaySeconds };
  } catch (err) {
    log.error('save', 'beschädigter Speicherstand, starte neu', err);
    try {
      localStorage.setItem(`${KEY}.broken`, text);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function saveGame(state: GameState): boolean {
  state.lastSeen = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    log.warn('save', 'konnte nicht speichern', err);
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Backup string the player can copy out of the settings screen. */
export function exportSave(state: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(text: string): GameState | null {
  try {
    const raw = JSON.parse(decodeURIComponent(escape(atob(text.trim()))));
    return sanitize(migrate(raw));
  } catch {
    return null;
  }
}
