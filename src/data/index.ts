import { MATERIALS, RECIPES } from './materials';
import { PURCHASABLES } from './purchasables';
import { TECHNOLOGIES } from './tech';
import { PRESTIGE_PERKS } from './prestige';
import { ACHIEVEMENTS } from './achievements';
import { CRATES, MILESTONES, MISSIONS } from './missions';
import { FAQ, HELP_CHAPTERS } from './help';
import { VEHICLES } from './vehicles';
import { AUCTION_LOTS, COLLECTIBLES, CONTRACTS } from './trade';
import { PRIORITIES, type PriorityDef } from './company';
import type {
  AuctionLotDef,
  CollectibleDef,
  ContractDef,
} from './trade';
import type { FaqEntry, HelpChapter } from './help';
import type {
  AchievementDef,
  MaterialDef,
  MilestoneDef,
  MissionDef,
  PrestigePerkDef,
  PurchasableDef,
  RecipeDef,
  ResearchDef,
  Reward,
  TechDef,
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
const researchMap = index(TECHNOLOGIES);
const perkMap = index(PRESTIGE_PERKS);
const achievementMap = index(ACHIEVEMENTS);
const contractMap = index(CONTRACTS);
const auctionMap = index(AUCTION_LOTS);
const collectibleMap = index(COLLECTIBLES);
const priorityMap = index(PRIORITIES);
const missionMap = index(MISSIONS);
const milestoneMap = index(MILESTONES);
const chapterMap = index(HELP_CHAPTERS);

export const Content = {
  materials: MATERIALS as readonly MaterialDef[],
  recipes: RECIPES as readonly RecipeDef[],
  vehicles: VEHICLES as readonly VehicleDef[],
  purchasables: PURCHASABLES as readonly PurchasableDef[],
  research: TECHNOLOGIES as readonly TechDef[],
  perks: PRESTIGE_PERKS as readonly PrestigePerkDef[],
  achievements: ACHIEVEMENTS as readonly AchievementDef[],
  contracts: CONTRACTS as readonly ContractDef[],
  auctionLots: AUCTION_LOTS as readonly AuctionLotDef[],
  collectibles: COLLECTIBLES as readonly CollectibleDef[],
  priorities: PRIORITIES as readonly PriorityDef[],
  missions: MISSIONS as readonly MissionDef[],
  milestones: MILESTONES as readonly MilestoneDef[],
  helpChapters: HELP_CHAPTERS as readonly HelpChapter[],
  faq: FAQ as readonly FaqEntry[],
  crates: CRATES,

  material: (id: string) => materialMap.get(id),
  recipe: (id: string) => recipeMap.get(id),
  vehicle: (id: string) => vehicleMap.get(id),
  purchasable: (id: string) => purchasableMap.get(id),
  researchNode: (id: string) => researchMap.get(id),
  perk: (id: string) => perkMap.get(id),
  achievement: (id: string) => achievementMap.get(id),
  contract: (id: string) => contractMap.get(id),
  auctionLot: (id: string) => auctionMap.get(id),
  collectible: (id: string) => collectibleMap.get(id),
  priority: (id: string) => priorityMap.get(id),
  mission: (id: string) => missionMap.get(id),
  milestone: (id: string) => milestoneMap.get(id),
  helpChapter: (id: string) => chapterMap.get(id),
  crate: (tier: number) => CRATES.find((c) => c.tier === tier) ?? CRATES[0],

  /** Total technology levels in the tree - basis for the "90 % erforscht" gate. */
  totalTechLevels(): number {
    return TECHNOLOGIES.reduce((sum, tech) => sum + tech.maxLevel, 0);
  },

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

  const checkEffects = (id: string, effects: readonly { kind: string; recipe?: string }[]) => {
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
  for (const t of TECHNOLOGIES) {
    checkEffects(`Technologie ${t.id}`, t.perLevel ?? []);
    checkRequires(`Technologie ${t.id}`, t.requires);
    for (const m of t.milestones ?? []) {
      checkEffects(`Technologie ${t.id}@${m.level}`, m.effects);
      if (m.level < 1 || m.level > t.maxLevel) {
        problems.push(`Technologie ${t.id}: Meilenstein auf Stufe ${m.level} ist unerreichbar`);
      }
    }
    for (const need of t.cost.materials ?? []) mat(need.material, `Technologie ${t.id}`);
    for (const dep of t.requires?.tech ?? []) {
      const target = researchMap.get(dep.id);
      if (!target) problems.push(`Technologie ${t.id}: unbekannte Technologie "${dep.id}"`);
      else if ((dep.level ?? 1) > target.maxLevel) {
        problems.push(`Technologie ${t.id}: verlangt ${dep.id} Stufe ${dep.level}, Maximum ist ${target.maxLevel}`);
      }
    }
  }
  for (const p of PRESTIGE_PERKS) checkEffects(`Prestige ${p.id}`, p.effects);
  for (const a of ACHIEVEMENTS) {
    checkEffects(`Erfolg ${a.id}`, a.effects ?? []);
    if (a.goal.material) mat(a.goal.material, `Erfolg ${a.id}`);
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

  // Missions and milestones (GDD chapter 10). A mission that points at content
  // which no longer exists would sit in the task list forever, so it is worth
  // catching at startup rather than in a bug report.
  const checkRewards = (where: string, rewards: readonly Reward[]) => {
    for (const reward of rewards) {
      if (reward.kind === 'material') mat(reward.material, where);
      if (reward.kind === 'purchasable' && !purchasableMap.has(reward.id)) {
        problems.push(`${where}: unbekannter Kauf "${reward.id}"`);
      }
      if (reward.kind === 'vehicle' && !vehicleMap.has(reward.id)) {
        problems.push(`${where}: unbekanntes Fahrzeug "${reward.id}"`);
      }
      if (reward.kind === 'crate' && !CRATES.some((c) => c.tier === reward.tier)) {
        problems.push(`${where}: unbekannte Kistenstufe ${reward.tier}`);
      }
    }
  };

  for (const m of MISSIONS) {
    checkRequires(`Mission ${m.id}`, m.requires);
    checkRewards(`Mission ${m.id}`, m.rewards);
    if (m.rewards.length === 0) problems.push(`Mission ${m.id}: keine Belohnung`);
    if (m.goal.amount <= 0) problems.push(`Mission ${m.id}: Ziel muss > 0 sein`);
    if (m.goal.material) mat(m.goal.material, `Mission ${m.id}`);
    if (m.goal.metric === 'ownedOf' && !purchasableMap.has(m.goal.id ?? '')) {
      problems.push(`Mission ${m.id}: unbekannter Kauf "${m.goal.id}"`);
    }
    if (m.goal.metric === 'techLevelOf' && !researchMap.has(m.goal.id ?? '')) {
      problems.push(`Mission ${m.id}: unbekannte Technologie "${m.goal.id}"`);
    }
    if (m.after && !missionMap.has(m.after)) {
      problems.push(`Mission ${m.id}: unbekannte Vorgängermission "${m.after}"`);
    }
  }
  for (const ms of MILESTONES) {
    checkRewards(`Meilenstein ${ms.id}`, ms.rewards);
    if (ms.value <= 0) problems.push(`Meilenstein ${ms.id}: Firmenwert muss > 0 sein`);
  }
  for (const crate of CRATES) {
    for (const id of crate.materials) mat(id, `Kiste ${crate.tier}`);
  }
  for (const chapter of HELP_CHAPTERS) {
    if (chapter.source === 'faq' && FAQ.length === 0) {
      problems.push(`Hilfe ${chapter.id}: keine Einträge`);
    }
  }

  return problems;
}

export type {
  AchievementDef,
  TechDef,
  MaterialDef,
  MilestoneDef,
  MissionDef,
  RecipeDef,
  Reward,
  VehicleDef,
  PurchasableDef,
  ResearchDef,
  PrestigePerkDef,
  ContractDef,
  AuctionLotDef,
  CollectibleDef,
  FaqEntry,
  HelpChapter,
};
