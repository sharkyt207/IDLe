import { MATERIALS, RECIPES } from './materials';
import { PURCHASABLES } from './purchasables';
import { PRESTIGE_PERKS, RESEARCH } from './research';
import { VEHICLES } from './vehicles';
import { AUCTION_LOTS, COLLECTIBLES, CONTRACTS } from './trade';
import { PRIORITIES, type PriorityDef } from './company';
import type {
  AuctionLotDef,
  CollectibleDef,
  ContractDef,
} from './trade';
import type {
  MaterialDef,
  PrestigePerkDef,
  PurchasableDef,
  RecipeDef,
  ResearchDef,
  VehicleDef,
} from './types';

/**
 * Content registry.
 *
 * The single place systems look up content. Nothing else imports the raw data
 * arrays, which means new content files only need to be registered here.
 */
function index<T extends { id: string }>(list: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of list) {
    if (map.has(entry.id)) console.warn(`[content] doppelte id: ${entry.id}`);
    map.set(entry.id, entry);
  }
  return map;
}

const materialMap = index(MATERIALS);
const recipeMap = index(RECIPES);
const vehicleMap = index(VEHICLES);
const purchasableMap = index(PURCHASABLES);
const researchMap = index(RESEARCH);
const perkMap = index(PRESTIGE_PERKS);
const contractMap = index(CONTRACTS);
const auctionMap = index(AUCTION_LOTS);
const collectibleMap = index(COLLECTIBLES);
const priorityMap = index(PRIORITIES);

export const Content = {
  materials: MATERIALS as readonly MaterialDef[],
  recipes: RECIPES as readonly RecipeDef[],
  vehicles: VEHICLES as readonly VehicleDef[],
  purchasables: PURCHASABLES as readonly PurchasableDef[],
  research: RESEARCH as readonly ResearchDef[],
  perks: PRESTIGE_PERKS as readonly PrestigePerkDef[],
  contracts: CONTRACTS as readonly ContractDef[],
  auctionLots: AUCTION_LOTS as readonly AuctionLotDef[],
  collectibles: COLLECTIBLES as readonly CollectibleDef[],
  priorities: PRIORITIES as readonly PriorityDef[],

  material: (id: string) => materialMap.get(id),
  recipe: (id: string) => recipeMap.get(id),
  vehicle: (id: string) => vehicleMap.get(id),
  purchasable: (id: string) => purchasableMap.get(id),
  researchNode: (id: string) => researchMap.get(id),
  perk: (id: string) => perkMap.get(id),
  contract: (id: string) => contractMap.get(id),
  auctionLot: (id: string) => auctionMap.get(id),
  collectible: (id: string) => collectibleMap.get(id),
  priority: (id: string) => priorityMap.get(id),

  /** Materials sorted for the storage screen: tier, then value. */
  materialsSorted(): MaterialDef[] {
    return [...MATERIALS].sort((a, b) => a.tier - b.tier || a.basePrice - b.basePrice);
  },
};

/**
 * Content integrity check. Runs in dev builds so a broken data entry surfaces
 * immediately instead of failing silently mid-run.
 */
export function validateContent(): string[] {
  const problems: string[] = [];
  const mat = (id: string, where: string) => {
    if (!materialMap.has(id)) problems.push(`${where}: unbekanntes Material "${id}"`);
  };

  for (const v of VEHICLES) {
    if (v.parts.length === 0) problems.push(`Fahrzeug ${v.id}: keine Teile`);
    for (const p of v.parts) {
      if (p.work <= 0) problems.push(`Fahrzeug ${v.id}/${p.id}: work muss > 0 sein`);
      for (const y of p.yields) mat(y.material, `Fahrzeug ${v.id}/${p.id}`);
    }
    for (const r of v.rareFinds ?? []) mat(r.material, `Fahrzeug ${v.id} (Fundstück)`);
  }

  for (const r of RECIPES) {
    for (const i of r.input) mat(i.material, `Rezept ${r.id}`);
    for (const o of r.output) mat(o.material, `Rezept ${r.id}`);
  }

  const checkEffects = (id: string, effects: { kind: string; recipe?: string }[]) => {
    for (const e of effects) {
      if (e.kind === 'process' && e.recipe && !recipeMap.has(e.recipe)) {
        problems.push(`${id}: unbekanntes Rezept "${e.recipe}"`);
      }
    }
  };
  const checkRequires = (id: string, req?: { research?: string[]; owned?: { id: string }[] }) => {
    for (const r of req?.research ?? []) {
      if (!researchMap.has(r)) problems.push(`${id}: unbekannte Forschung "${r}"`);
    }
    for (const o of req?.owned ?? []) {
      if (!purchasableMap.has(o.id)) problems.push(`${id}: unbekannter Besitz "${o.id}"`);
    }
  };

  for (const p of PURCHASABLES) {
    checkEffects(`Kauf ${p.id}`, p.effects);
    checkRequires(`Kauf ${p.id}`, p.requires);
  }
  for (const r of RESEARCH) {
    checkEffects(`Forschung ${r.id}`, r.effects);
    checkRequires(`Forschung ${r.id}`, r.requires);
  }
  for (const v of VEHICLES) checkRequires(`Fahrzeug ${v.id}`, v.requires);

  for (const c of CONTRACTS) {
    for (const d of c.demand) mat(d.material, `Vertrag ${c.id}`);
  }
  for (const lot of AUCTION_LOTS) {
    for (const m of lot.materials ?? []) mat(m.material, `Auktion ${lot.id}`);
    for (const v of lot.vehicles ?? []) {
      if (!vehicleMap.has(v.id)) problems.push(`Auktion ${lot.id}: unbekanntes Fahrzeug "${v.id}"`);
    }
  }

  return problems;
}

export type {
  MaterialDef,
  RecipeDef,
  VehicleDef,
  PurchasableDef,
  ResearchDef,
  PrestigePerkDef,
  ContractDef,
  AuctionLotDef,
  CollectibleDef,
};
