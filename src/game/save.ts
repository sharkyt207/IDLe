import { Content } from '../data';
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

  const done = (src.research?.done ?? []).filter((id) => !!Content.researchNode(id));
  const active = src.research?.active;
  state.research = {
    done: [...new Set(done)],
    active:
      active && Content.researchNode(active.id) && !done.includes(active.id)
        ? { id: active.id, remaining: Math.max(0, num(active.remaining, 0)) }
        : null,
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
  state.prestige = {
    reputation: Math.max(0, num(src.prestige?.reputation, 0)),
    perks,
    runs: Math.max(0, Math.floor(num(src.prestige?.runs, 0))),
    bestRun: Math.max(0, num(src.prestige?.bestRun, 0)),
  };

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
  };

  state.settings = { haptics: bool(src.settings?.haptics, true) };

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
    console.error('[save] beschädigter Speicherstand, starte neu', err);
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
    console.warn('[save] konnte nicht speichern', err);
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
