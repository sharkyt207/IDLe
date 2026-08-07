import { Content } from '../data';
import { FAQ, HELP_CHAPTERS, type HelpChapter } from '../data/help';
import { money } from '../core/format';
import type { Game } from '../game/game';
import { owned } from '../game/state';
import { requirementText } from '../progress/unlocks';

/**
 * Help & encyclopedia system (GDD chapter 10).
 *
 * The chapter is explicit that entries appear "nur, wenn sie im Spiel bereits
 * entdeckt wurden", and that shapes the whole module: nothing here is a
 * hand-written manual. Every entry is generated from the live content the
 * player has actually met, which means the encyclopedia can never describe a
 * machine that was rebalanced last week, and a new machine documents itself.
 *
 * Two gates, deliberately different:
 *   - a **chapter** opens when a mission hands out its flag (the player has
 *     been introduced to the concept);
 *   - an **entry** appears once the thing itself has been seen - owned,
 *     produced, researched or dismantled.
 */

export interface HelpEntry {
  id: string;
  icon: string;
  title: string;
  /** One or two lines of description. */
  body: string;
  /** Facts as label/value pairs - prices, rates, requirements. */
  facts: [string, string][];
}

export interface HelpSection {
  chapter: HelpChapter;
  unlocked: boolean;
  entries: HelpEntry[];
  /** Entries that exist but have not been discovered yet. */
  hidden: number;
}

/** Marks something as discovered. Called when the player first meets it. */
export function discover(game: Game, id: string): void {
  const seen = game.state.missions.seen;
  if (!seen.includes(id)) seen.push(id);
}

/** Whether an entry has been met - owned now, or seen at any point. */
function known(game: Game, id: string): boolean {
  return owned(game.state, id) > 0 || game.state.missions.seen.includes(id);
}

function chapterUnlocked(game: Game, chapter: HelpChapter): boolean {
  return !chapter.flag || game.stats.unlocks.has(chapter.flag);
}

/** The whole encyclopedia, in reading order. */
export function sections(game: Game): HelpSection[] {
  return HELP_CHAPTERS.map((chapter) => {
    const unlocked = chapterUnlocked(game, chapter);
    const all = entriesFor(game, chapter);
    const entries = unlocked ? all.filter((e) => e.known).map((e) => e.entry) : [];
    return {
      chapter,
      unlocked,
      entries,
      hidden: unlocked ? all.length - entries.length : all.length,
    };
  });
}

interface Candidate {
  entry: HelpEntry;
  known: boolean;
}

function entriesFor(game: Game, chapter: HelpChapter): Candidate[] {
  switch (chapter.source) {
    case 'faq':
      return FAQ.filter((q) => !q.flag || game.stats.unlocks.has(q.flag)).map((q) => ({
        known: true,
        entry: { id: q.id, icon: '❓', title: q.question, body: q.answer, facts: [] },
      }));

    case 'materials':
      return Content.materialsSorted().map((def) => ({
        known: (game.state.progressStats.materials[def.id] ?? 0) > 0,
        entry: {
          id: def.id,
          icon: def.icon,
          title: def.name,
          body: def.hazardous
            ? 'Betriebsstoff — muss entsorgt werden und kostet Geld, bis die Forschung daraus ein Produkt macht.'
            : `${def.category} · wird beim Zerlegen gewonnen und im Lager verkauft.`,
          facts: [
            ['Grundpreis', money(def.basePrice)],
            ['Kategorie', def.category],
            ['Stufe', String(def.tier)],
          ],
        },
      }));

    case 'vehicles':
      return Content.vehicles.map((def) => ({
        known: game.state.progressStats.discovered.includes(def.id),
        entry: {
          id: def.id,
          icon: def.icon,
          title: def.name,
          body: `Klasse ${def.vehicleClass} · ${def.parts.length} Baugruppen · ${Math.round(def.weightKg).toLocaleString('de-DE')} kg.`,
          facts: [
            ['Ankaufspreis', money(def.price)],
            ['Erfahrung', String(def.xp)],
            ['Arbeit', String(Math.round(def.parts.reduce((s, p) => s + p.work, 0)))],
          ],
        },
      }));

    case 'research':
      return Content.research
        .filter((def) => !def.secret || (game.state.research.techs[def.id] ?? 0) > 0)
        .map((def) => ({
          known: (game.state.research.techs[def.id] ?? 0) > 0,
          entry: {
            id: def.id,
            icon: def.icon,
            title: def.name,
            body: def.desc,
            facts: [
              ['Zweig', def.branch],
              ['Stufen', String(def.maxLevel)],
              ['Erreicht', String(game.state.research.techs[def.id] ?? 0)],
            ],
          },
        }));

    default:
      return purchasableEntries(game, chapter.source);
  }
}

/** Categories each purchasable chapter draws from. */
const CATEGORY: Record<string, string[]> = {
  machines: ['machine', 'line'],
  buildings: ['building', 'lot', 'power'],
  roles: ['employee'],
  tools: ['tool'],
};

function purchasableEntries(game: Game, source: string): Candidate[] {
  const categories = CATEGORY[source] ?? [];
  return Content.purchasables
    .filter((def) => categories.includes(def.category))
    .map((def) => {
      const level = owned(game.state, def.id);
      const facts: [string, string][] = [
        ['Gruppe', def.group],
        [def.category === 'machine' ? 'Ausbaustufen' : 'Maximal', String(def.maxCount)],
        ['Grundpreis', money(def.baseCost)],
      ];
      if (def.salary) facts.push(['Lohn', `${money(def.salary)}/s`]);
      if (def.upkeep) facts.push(['Unterhalt', `${money(def.upkeep)}/s`]);
      if (def.requires) facts.push(['Voraussetzung', requirementText(def.requires)]);
      if (level > 0) facts.push([def.category === 'machine' ? 'Deine Stufe' : 'Im Besitz', String(level)]);
      return {
        known: known(game, def.id),
        entry: { id: def.id, icon: def.icon, title: def.name, body: def.desc, facts },
      };
    });
}

/** How much of the encyclopedia is open, for the screen header. */
export function coverage(game: Game): { known: number; total: number } {
  let knownCount = 0;
  let total = 0;
  for (const section of sections(game)) {
    knownCount += section.entries.length;
    total += section.entries.length + section.hidden;
  }
  return { known: knownCount, total };
}
