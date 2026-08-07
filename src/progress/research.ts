import { Content } from '../data';
import { PROGRESS, difficultyFactor } from '../data/progress';
import type { TechCost, TechDef } from '../data/types';
import type { Game } from '../game/game';
import { removeFromStorage } from '../economy/inventory';
import { meets, techLevel } from './unlocks';

/**
 * Research Manager (GDD chapter 7).
 *
 * Research is deliberately not buyable: a level costs research points, money
 * *and* often rare materials. Points come from the lab, materials come from
 * actually dismantling things, so a rich player still has to run a yard.
 *
 * Technologies have levels. `perLevel` effects stack with every step and
 * `milestones` fire once - that is where a technology changes the game instead
 * of a number.
 */

/** Cost of the next level of a technology, with all scaling applied. */
export function nextTechCost(game: Game, id: string): TechCost {
  const tech = Content.researchNode(id);
  if (!tech) return { points: Infinity, money: Infinity };
  const level = techLevel(game.state, id);
  const step = Math.pow(tech.costGrowth, level);
  // Restarts make the world tougher; patents earned in the prestige tree make
  // it cheaper again. Both land on the same number.
  const world = difficultyFactor(game.state.prestige.runs) * game.stats.mult.techCost;

  return {
    points: Math.ceil(tech.cost.points * step * world),
    money: Math.ceil(tech.cost.money * step * world),
    materials: tech.cost.materials?.map((need) => ({
      material: need.material,
      amount: Math.ceil(need.amount * step),
    })),
  };
}

/** Seconds the lab needs for the next level. */
export function nextTechDuration(game: Game, id: string): number {
  const tech = Content.researchNode(id);
  if (!tech) return 0;
  const level = techLevel(game.state, id);
  const growth = tech.durationGrowth ?? 1.35;
  return Math.round((tech.duration * Math.pow(growth, level)) / Math.max(0.1, game.stats.mult.researchSpeed));
}

/** Projects the lab can run at the same time. */
export function researchSlots(game: Game): number {
  return PROGRESS.research.baseSlots + game.stats.researchSlots;
}

export function slotsFree(game: Game): number {
  return Math.max(0, researchSlots(game) - game.state.research.active.length);
}

/** Highest technology level the current lab may reach. */
export function techTier(game: Game): number {
  return PROGRESS.research.baseTechTier + game.stats.techTier;
}

export interface TechStatus {
  level: number;
  maxLevel: number;
  /** Level currently in the lab, or 0. */
  researching: number;
  cost: TechCost;
  duration: number;
  /** Everything that stands in the way, empty when it can be started. */
  blockers: string[];
  canStart: boolean;
}

export function statusOf(game: Game, id: string): TechStatus {
  const tech = Content.researchNode(id);
  const state = game.state;
  const level = techLevel(state, id);
  const active = state.research.active.find((p) => p.id === id);
  const cost = nextTechCost(game, id);
  const duration = nextTechDuration(game, id);
  const blockers: string[] = [];

  if (!tech) return { level: 0, maxLevel: 0, researching: 0, cost, duration, blockers: ['unbekannt'], canStart: false };

  if (level >= tech.maxLevel) blockers.push('Endstufe erreicht');
  if (active) blockers.push('läuft bereits');
  if (!game.stats.unlocks.has('research')) blockers.push('Forschungslabor fehlt');
  if (level + 1 > techTier(game)) blockers.push(`Labor Stufe ${level + 1 - PROGRESS.research.baseTechTier} nötig`);
  if (slotsFree(game) <= 0 && !active) blockers.push('kein freier Laborplatz');
  if (!meets(state, tech.requires, game.stats.unlocks)) blockers.push('Voraussetzung fehlt');
  if (state.research.points < cost.points) blockers.push('zu wenig Forschungspunkte');
  if (state.money < cost.money) blockers.push('zu wenig Geld');
  for (const need of cost.materials ?? []) {
    if ((state.storage[need.material] ?? 0) < need.amount) {
      blockers.push(`Material fehlt: ${Content.material(need.material)?.name ?? need.material}`);
    }
  }

  return {
    level,
    maxLevel: tech.maxLevel,
    researching: active?.level ?? 0,
    cost,
    duration,
    blockers,
    canStart: blockers.length === 0,
  };
}

export function canStart(game: Game, id: string): boolean {
  return statusOf(game, id).canStart;
}

/** Pays the cost and puts the project into a free lab slot. */
export function startResearch(game: Game, id: string): boolean {
  const tech = Content.researchNode(id);
  const status = statusOf(game, id);
  if (!tech || !status.canStart) return false;

  game.state.research.points -= status.cost.points;
  if (!game.spendMoney(status.cost.money)) {
    game.state.research.points += status.cost.points;
    return false;
  }
  for (const need of status.cost.materials ?? []) {
    removeFromStorage(game.state, need.material, need.amount);
  }

  const level = status.level + 1;
  if (status.duration <= 0) {
    finishResearch(game, id, level);
  } else {
    game.state.research.active.push({ id, level, remaining: status.duration, total: status.duration });
    game.bus.emit('notice', { text: `Forschung gestartet: ${tech.name} ${level}`, icon: tech.icon, tone: 'info' });
  }
  game.bus.emit('changed', undefined);
  return true;
}

/** Grants a technology level and announces any milestone it crosses. */
export function finishResearch(game: Game, id: string, level: number): void {
  const tech = Content.researchNode(id);
  if (!tech) return;
  const state = game.state;
  state.research.techs[id] = Math.max(state.research.techs[id] ?? 0, Math.min(level, tech.maxLevel));
  state.research.active = state.research.active.filter((p) => p.id !== id);

  const milestone = tech.milestones?.find((m) => m.level === level);
  const key = `${id}@${level}`;
  if (milestone && !state.research.seen.includes(key)) {
    state.research.seen.push(key);
    game.bus.emit('notice', { text: milestone.desc, icon: '✨', tone: 'good' });
  } else {
    game.bus.emit('notice', { text: `${tech.name} Stufe ${level}`, icon: tech.icon, tone: 'good' });
  }

  game.recompute();
  game.bus.emit('progress', undefined);
}

/** Cancels a running project. The cost is not refunded - it was spent. */
export function abandonResearch(game: Game, id: string): void {
  game.state.research.active = game.state.research.active.filter((p) => p.id !== id);
  game.bus.emit('changed', undefined);
}

/**
 * Advances points and every running project.
 * Called from the game tick, so offline progress researches too.
 */
export function tickResearch(game: Game, dt: number, efficiency = 1): void {
  const state = game.state;
  if (game.stats.unlocks.has('research')) {
    state.research.points += game.stats.researchPointsPerSec * dt * efficiency;
  }

  if (state.research.active.length === 0) return;
  const finished: { id: string; level: number }[] = [];
  for (const project of state.research.active) {
    project.remaining -= dt;
    if (project.remaining <= 0) finished.push({ id: project.id, level: project.level });
  }
  for (const done of finished) finishResearch(game, done.id, done.level);
}

/** Technologies the player may currently see, grouped for the lab screen. */
export function visibleTechs(game: Game): TechDef[] {
  return Content.research.filter(
    (tech) => !tech.secret || techLevel(game.state, tech.id) > 0 || meets(game.state, tech.requires, game.stats.unlocks),
  );
}
