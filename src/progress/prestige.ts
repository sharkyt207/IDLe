import { BALANCE } from '../data/balance';
import { PROGRESS } from '../data/progress';
import { Content } from '../data';
import type { Game } from '../game/game';
import { createInitialState, owned } from '../game/state';
import { meets, researchShare } from './unlocks';

/**
 * Prestige Manager (GDD chapter 7).
 *
 * "Prestige ist kein Spielende. Es ist ein Neustart auf höherem Niveau."
 *
 * Three independent doors open the restart - company value, full automation,
 * or a nearly explored tree - so different playstyles all reach it. What
 * carries over lives entirely in `prestige` and `achievements`; everything
 * else is rebuilt from scratch, which keeps the reset honest and the save
 * small.
 */

export interface PrestigeGate {
  id: string;
  label: string;
  progress: number;
  met: boolean;
}

/**
 * How much of the yard runs without the player touching it, 0…1.
 *
 * "Alle Produktionslinien vollständig automatisiert" is a checklist, not a
 * ratio: supply, dismantling, sorting, processing, maintenance and all three
 * production line types. Measuring it as "automation beats tapping" would open
 * the restart half an hour in, which is not what the GDD means by a late-game
 * door - a machine outpacing a thumb is the *start* of automation, not the end.
 */
export function automationRate(game: Game): number {
  const { teardownRate, tapPower, autoBuyPerMinute, autoSellPerSec, autoService, processes } = game.stats;
  const lineTypes = Content.purchasables.filter((d) => d.category === 'line');
  const linesBuilt = lineTypes.filter((d) => owned(game.state, d.id) > 0).length;

  const steps = [
    // A tapping player manages roughly three taps a second.
    tapPower > 0 ? Math.min(1, teardownRate / (tapPower * 3)) : 1,
    autoBuyPerMinute > 0 ? 1 : 0,
    autoSellPerSec > 0 ? 1 : 0,
    autoService > 0 ? 1 : 0,
    Object.keys(processes).length > 0 ? 1 : 0,
    lineTypes.length > 0 ? linesBuilt / lineTypes.length : 1,
  ];
  return steps.reduce((sum, step) => sum + step, 0) / steps.length;
}

/** The three GDD conditions, with their progress for the UI. */
export function gates(game: Game): PrestigeGate[] {
  const value = game.companyValue();
  const rate = automationRate(game);
  const share = researchShare(game.state);
  return [
    {
      id: 'value',
      label: `Firmenwert ${Math.round(PROGRESS.prestige.companyValue / 1e6)} Mio €`,
      progress: Math.min(1, value / PROGRESS.prestige.companyValue),
      met: value >= PROGRESS.prestige.companyValue,
    },
    {
      id: 'automation',
      label: 'Produktion vollständig automatisiert',
      progress: rate / PROGRESS.prestige.automationRate,
      met: rate >= PROGRESS.prestige.automationRate,
    },
    {
      id: 'research',
      label: `Forschung zu ${Math.round(PROGRESS.prestige.researchShare * 100)} % abgeschlossen`,
      progress: share / PROGRESS.prestige.researchShare,
      met: share >= PROGRESS.prestige.researchShare,
    },
  ];
}

/** Industriepunkte a restart would pay out right now. */
export function pointsGain(game: Game): number {
  const { divisor, exponent } = PROGRESS.prestige;
  if (game.state.runEarned <= 0) return 0;
  const base = Math.pow(game.state.runEarned / divisor, exponent);
  // Every completed achievement is worth a point, so a completionist run pays
  // more than a pure money run of the same size.
  const total = Math.floor(base) + game.state.achievements.length * PROGRESS.achievements.prestigePoints;
  return Number.isFinite(total) ? total : Number.MAX_SAFE_INTEGER;
}

export function canPrestige(game: Game): boolean {
  if (game.state.level < BALANCE.prestige.requiredLevel) return false;
  if (pointsGain(game) < PROGRESS.prestige.minPoints) return false;
  return gates(game).some((gate) => gate.met);
}

/**
 * Sells the company and starts over.
 * Kept: Industriepunkte, the prestige tree, achievements, discovered vehicles
 * and the player's settings. Everything else is a fresh yard.
 */
export function doPrestige(game: Game): boolean {
  if (!canPrestige(game)) return false;
  const state = game.state;
  const gain = pointsGain(game);

  const carried = {
    points: state.prestige.points + gain,
    lifetimePoints: state.prestige.lifetimePoints + gain,
    perks: { ...state.prestige.perks },
    runs: state.prestige.runs + 1,
    bestRun: Math.max(state.prestige.bestRun, state.runEarned),
  };
  const lifetime = state.lifetimeEarned;
  const discovered = state.progressStats.discovered;
  const materials = state.progressStats.materials;
  const vehiclesDone = state.progressStats.vehiclesDone;
  const settings = state.settings;

  game.state = createInitialState(carried, [...state.achievements]);
  game.state.lifetimeEarned = lifetime;
  game.state.progressStats.discovered = discovered;
  game.state.progressStats.materials = materials;
  // Career totals survive - the rare technologies from the GDD are gated on
  // them, and losing them at every restart would put those out of reach.
  game.state.progressStats.vehiclesDone = vehiclesDone;
  game.state.settings = settings;
  game.state.tutorial = { step: 0, done: true, choiceOffered: true };

  return true;
}

/** Reputation cost of the next level of a prestige node. */
export function nextPerkCost(game: Game, id: string): number {
  const perk = Content.perk(id);
  if (!perk) return Infinity;
  const level = game.state.prestige.perks[id] ?? 0;
  return Math.ceil(perk.cost * Math.pow(perk.costGrowth, level));
}

export function canBuyPerk(game: Game, id: string): boolean {
  const perk = Content.perk(id);
  if (!perk) return false;
  const level = game.state.prestige.perks[id] ?? 0;
  if (level >= perk.maxLevel) return false;
  if (!meets(game.state, perk.requires, game.stats.unlocks)) return false;
  return game.state.prestige.points >= nextPerkCost(game, id);
}

export function buyPerk(game: Game, id: string): boolean {
  if (!canBuyPerk(game, id)) return false;
  const cost = nextPerkCost(game, id);
  game.state.prestige.points -= cost;
  game.state.prestige.perks[id] = (game.state.prestige.perks[id] ?? 0) + 1;
  game.recompute();
  const perk = Content.perk(id);
  game.bus.emit('notice', {
    text: `${perk?.name ?? id} Stufe ${game.state.prestige.perks[id]}`,
    icon: perk?.icon ?? '🏆',
    tone: 'good',
  });
  return true;
}
