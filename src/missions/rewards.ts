import { Content } from '../data';
import { BALANCE } from '../data/balance';
import { money as fmtMoney, fmt } from '../core/format';
import type { Reward } from '../data/types';
import type { Game } from '../game/game';
import { owned } from '../game/state';
import { nextCost } from '../game/stats';

/**
 * Reward payout (GDD chapter 10).
 *
 * One place that turns a reward descriptor into something that happened, and
 * one place that turns it into a line of text. Missions, milestones and crates
 * all go through here, so "was ist die Belohnung" and "was bekomme ich
 * tatsächlich" can never drift apart.
 */

/**
 * How many deliveries a single money reward may be worth.
 *
 * Fixed euro amounts cannot work here: the economy is exponential and the
 * numbers in a data file are not, so every reward is either trivial or
 * enormous depending on when it lands. Two earlier attempts and the headless
 * harness pinned down why the obvious denominators fail.
 *
 * A share of the **company value** was still 45× too hot at thirty minutes,
 * because company value is mostly illiquid while a reward is cash - and cash
 * is the bottleneck. A multiple of **income** was worse: unstable, swinging
 * between 10× and 30.000× across identical runs.
 *
 * The reason is chapter 4's vehicle ladder. Margins rise with the class
 * (2,2 → 3,3), so climbing a rung is strictly profitable and the only thing
 * gating it is having enough cash. A reward big enough to buy a rung does not
 * boost the yard, it *teleports* it, and the effect compounds.
 *
 * So the denominator is the ladder itself: a reward is worth a few deliveries
 * of whatever the yard currently runs on. That is meaningful at every scale,
 * needs no per-mission tuning, and can never skip a tier.
 */
export const REWARD_DELIVERIES = 4;

/**
 * What a nominal money reward actually pays out right now.
 *
 * The floor is the company's starting capital, because the chapter wants the
 * first two hours to feel generous and the very first delivery is cheap.
 */
export function payout(game: Game, amount: number): number {
  const price = game.buyPrice(game.state.autoBuyVehicle);
  const cap = Math.max(BALANCE.start.money, (Number.isFinite(price) ? price : 0) * REWARD_DELIVERIES);
  return Math.max(1, Math.min(amount, cap));
}

/** Applies one reward. Returns the text for the toast, or null if it fizzled. */
export function grant(game: Game, reward: Reward): string | null {
  switch (reward.kind) {
    case 'money': {
      const paid = payout(game, reward.amount);
      game.addMoney(paid);
      return fmtMoney(paid);
    }

    case 'xp':
      game.addXp(reward.amount);
      return `${fmt(reward.amount, 0)} XP`;

    case 'research':
      game.state.research.points += reward.amount;
      return `${fmt(reward.amount, 0)} Forschungspunkte`;

    case 'industry':
      game.state.prestige.points += reward.amount;
      game.state.prestige.lifetimePoints += reward.amount;
      return `${fmt(reward.amount, 0)} Industriepunkte`;

    case 'material': {
      const def = Content.material(reward.material);
      if (!def) return null;
      game.addMaterial(reward.material, reward.amount);
      return `${fmt(reward.amount, 0)}× ${def.name}`;
    }

    case 'purchasable': {
      const def = Content.purchasable(reward.id);
      if (!def) return null;
      const want = reward.count ?? 1;
      const have = owned(game.state, def.id);
      // A gift can never push past the definition's own ceiling - a machine at
      // level 11 of 10 would silently do nothing and look like a bug - and it
      // can never be worth more than the same reward paid in cash. The second
      // guard is what stops a mis-scaled data entry from breaking a run: the
      // Schrottskulptur is worth 1,2 Mio Firmenwert, and handing it out for a
      // level-8 side mission jumped the player straight past two milestones.
      const affordable = payout(game, Infinity) >= nextCost(game.state, def.id);
      const granted = affordable ? Math.min(want, Math.max(0, def.maxCount - have)) : 0;
      if (granted <= 0) {
        // Out of reach or already capped: pay the equivalent in cash instead,
        // so a reward is never worth nothing.
        const value = payout(game, def.baseCost * Math.pow(def.costGrowth, have) * want);
        game.addMoney(value);
        return fmtMoney(value);
      }
      game.state.owned[def.id] = have + granted;
      game.recompute();
      if (def.building) game.bus.emit('built', { defId: def.id });
      return granted > 1 ? `${granted}× ${def.name}` : def.name;
    }

    case 'vehicle': {
      const def = Content.vehicle(reward.id);
      if (!def) return null;
      const count = reward.count ?? 1;
      for (let i = 0; i < count; i++) {
        if (!game.state.active) game.loadVehicle(def.id);
        else game.state.queue.push(def.id);
        game.bus.emit('delivery', { vehicleId: def.id });
      }
      return count > 1 ? `${count}× ${def.name}` : def.name;
    }

    case 'crate':
      return openCrate(game, reward.tier);

    case 'flag':
      if (!game.state.missions.flags.includes(reward.id)) {
        game.state.missions.flags.push(reward.id);
        game.recompute();
      }
      return flagLabel(reward.id);
  }
}

export function grantAll(game: Game, rewards: readonly Reward[]): string[] {
  const lines: string[] = [];
  for (const reward of rewards) {
    const text = grant(game, reward);
    if (text) lines.push(text);
  }
  game.bus.emit('progress', undefined);
  return lines;
}

/**
 * A special crate: money plus one random material from the tier's table, and
 * sometimes research points.
 *
 * The *value* is fixed by tier and the *content* is random, which is what makes
 * a crate a small surprise instead of a lottery the player can lose.
 */
export function openCrate(game: Game, tier: number): string {
  const crate = Content.crate(tier);
  // The whole crate is scaled by the same factor its money half is capped at,
  // so a tier-3 crate that lands early is small in every component rather than
  // small in cash and absurd in platinum.
  const paid = payout(game, crate.money);
  const scale = paid / crate.money;
  game.addMoney(paid);

  const pool = crate.materials.filter((id) => !!Content.material(id));
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const parts = [fmtMoney(paid)];

  if (pick) {
    const def = Content.material(pick);
    // A quarter of the crate's value in material, so the two halves of the
    // reward stay comparable across tiers.
    const amount = Math.max(1, Math.round((paid * 0.25) / Math.max(0.5, def?.basePrice ?? 1)));
    game.addMaterial(pick, amount);
    parts.push(`${fmt(amount, 0)}× ${def?.name ?? pick}`);
  }
  if (Math.random() < 0.5) {
    const points = Math.max(1, Math.round(crate.research * scale));
    game.state.research.points += points;
    parts.push(`${fmt(points, 0)} FP`);
  }
  return parts.join(' · ');
}

/**
 * Short description of a reward, for the task list and the mission screen.
 *
 * @param game when given, money is shown at what it would actually pay out -
 *   a promised amount the cap then reduces would be a small lie.
 */
export function describe(reward: Reward, game?: Game): string {
  switch (reward.kind) {
    case 'money':
      return fmtMoney(game ? payout(game, reward.amount) : reward.amount);
    case 'xp':
      return `${fmt(reward.amount, 0)} XP`;
    case 'research':
      return `${fmt(reward.amount, 0)} 🔬`;
    case 'industry':
      return `${fmt(reward.amount, 0)} 🏆`;
    case 'material':
      return `${fmt(reward.amount, 0)}× ${Content.material(reward.material)?.name ?? reward.material}`;
    case 'purchasable': {
      const def = Content.purchasable(reward.id);
      const count = reward.count ?? 1;
      return count > 1 ? `${count}× ${def?.name ?? reward.id}` : (def?.name ?? reward.id);
    }
    case 'vehicle': {
      const def = Content.vehicle(reward.id);
      const count = reward.count ?? 1;
      return count > 1 ? `${count}× ${def?.name ?? reward.id}` : (def?.name ?? reward.id);
    }
    case 'crate':
      return `Spezialkiste ${'★'.repeat(reward.tier)}`;
    case 'flag':
      return flagLabel(reward.id);
  }
}

export function describeAll(rewards: readonly Reward[], game?: Game): string {
  return rewards.map((reward) => describe(reward, game)).join(' · ');
}

/** Human name for an unlock flag - the only place these strings live. */
function flagLabel(id: string): string {
  const chapter = Content.helpChapter(id);
  if (chapter) return `Hilfe: ${chapter.name}`;
  const named: Record<string, string> = {
    prestige_visible: 'Neugründung sichtbar',
    help_trade: 'Hilfe: Handel',
    help_auctions: 'Hilfe: Auktionen',
    help_automation: 'Hilfe: Automatisierung',
    help_prestige: 'Hilfe: Neugründung',
    help_staff: 'Hilfe: Mitarbeiterrollen',
  };
  return named[id] ?? id;
}
