import { Content } from '../data';
import type { Requirement } from '../data/types';
import type { GameState } from '../game/state';
import { owned } from '../game/state';

/**
 * Unlock Manager (GDD chapter 7).
 *
 * One place that answers "may the player see this yet?". Every gate in the
 * game - purchasables, vehicles, technologies, prestige nodes - runs through
 * `meets()`, so a new kind of condition is added once and works everywhere.
 */

/** Technology level the player has reached, 0 when never researched. */
export function techLevel(state: GameState, id: string): number {
  return state.research.techs[id] ?? 0;
}

/** Technologies at level 1 or higher. */
export function techsDone(state: GameState): number {
  return Object.values(state.research.techs).filter((level) => level > 0).length;
}

/** Every technology level the player owns, across the whole tree. */
export function techLevelsTotal(state: GameState): number {
  return Object.values(state.research.techs).reduce((sum, level) => sum + level, 0);
}

/** How much of the tree is explored, 0…1 - one of the prestige doors. */
export function researchShare(state: GameState): number {
  const total = Content.totalTechLevels();
  return total > 0 ? techLevelsTotal(state) / total : 0;
}

/**
 * Evaluates a requirement.
 *
 * @param unlocks flags granted by `{ kind: 'unlock' }` effects; pass an empty
 *   set when stats are not available yet (content validation, save loading).
 */
export function meets(state: GameState, req: Requirement | undefined, unlocks: ReadonlySet<string>): boolean {
  if (!req) return true;
  if (req.level !== undefined && state.level < req.level) return false;
  if (req.research?.some((id) => techLevel(state, id) < 1)) return false;
  if (req.tech?.some((t) => techLevel(state, t.id) < (t.level ?? 1))) return false;
  if (req.owned?.some((o) => owned(state, o.id) < (o.count ?? 1))) return false;
  if (req.flags?.some((flag) => !unlocks.has(flag))) return false;

  const p = req.progress;
  if (p) {
    if (p.vehiclesDone !== undefined && state.progressStats.vehiclesDone < p.vehiclesDone) return false;
    if (p.prestigeRuns !== undefined && state.prestige.runs < p.prestigeRuns) return false;
    if (p.lifetimeEarned !== undefined && state.lifetimeEarned < p.lifetimeEarned) return false;
    if (p.collectible !== undefined && (state.collection[p.collectible] ?? 0) <= 0) return false;
    if (p.techsDone !== undefined && techsDone(state) < p.techsDone) return false;
    if (p.achievements !== undefined && state.achievements.length < p.achievements) return false;
  }
  return true;
}

/**
 * Whether a secret technology may be shown at all. A locked-but-visible node
 * is a goal; a locked-and-hidden one is a surprise. The GDD wants the second
 * for rare technologies, so they stay out of the list until they trigger.
 */
export function isVisible(state: GameState, id: string, unlocks: ReadonlySet<string>): boolean {
  const tech = Content.researchNode(id);
  if (!tech) return false;
  if (!tech.secret) return true;
  return techLevel(state, id) > 0 || meets(state, tech.requires, unlocks);
}

/** Human readable gate text, used on every locked card. */
export function requirementText(req?: Requirement): string {
  if (!req) return '';
  const parts: string[] = [];
  if (req.level !== undefined) parts.push(`Level ${req.level}`);
  for (const id of req.research ?? []) {
    parts.push(`Forschung: ${Content.researchNode(id)?.name ?? id}`);
  }
  for (const t of req.tech ?? []) {
    const name = Content.researchNode(t.id)?.name ?? t.id;
    parts.push(t.level && t.level > 1 ? `${name} Stufe ${t.level}` : name);
  }
  for (const o of req.owned ?? []) {
    const name = Content.purchasable(o.id)?.name ?? o.id;
    parts.push(o.count && o.count > 1 ? `${o.count}× ${name}` : name);
  }
  for (const flag of req.flags ?? []) parts.push(flag);

  const p = req.progress;
  if (p?.vehiclesDone) parts.push(`${p.vehiclesDone.toLocaleString('de-DE')} zerlegte Fahrzeuge`);
  if (p?.prestigeRuns) parts.push(`${p.prestigeRuns} Neugründungen`);
  if (p?.lifetimeEarned) parts.push(`${Math.round(p.lifetimeEarned / 1e6)} Mio € Gesamtumsatz`);
  if (p?.collectible) parts.push(`Fundstück: ${Content.collectible(p.collectible)?.name ?? p.collectible}`);
  if (p?.techsDone) parts.push(`${p.techsDone} Technologien`);
  if (p?.achievements) parts.push(`${p.achievements} Erfolge`);

  return parts.join(' · ');
}
