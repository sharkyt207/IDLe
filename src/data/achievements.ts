import type { AchievementDef } from './types';

/**
 * Achievements (GDD chapter 7).
 *
 * They exist to reward different ways of playing, not to prescribe one. The
 * permanent bonuses are deliberately tiny — a nod, never a second progression
 * system that punishes the player for not chasing them. Each one also grants
 * one Industriepunkt, so a completionist run is worth something concrete.
 */
export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_scrap',
    name: 'Erster Schrott',
    icon: '🔩',
    desc: 'Zerlege dein erstes Fahrzeug.',
    title: 'Schrauber',
    goal: { metric: 'vehiclesDone', amount: 1 },
  },
  {
    id: 'hundred_cars',
    name: 'Hofbetrieb',
    icon: '🚗',
    desc: 'Zerlege 100 Fahrzeuge.',
    goal: { metric: 'vehiclesDone', amount: 100 },
    effects: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.02 }],
  },
  {
    id: 'thousand_cars',
    name: 'Fließband',
    icon: '🏭',
    desc: 'Zerlege 1.000 Fahrzeuge.',
    title: 'Zerlegemeister',
    goal: { metric: 'vehiclesDone', amount: 1_000 },
    effects: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.03 }],
  },
  {
    id: 'recycling_pro',
    name: 'Recycling-Profi',
    icon: '♻️',
    desc: 'Verarbeite 10.000 Einheiten Stahl.',
    title: 'Stahlbaron',
    goal: { metric: 'materialRecycled', material: 'steel', amount: 10_000 },
    effects: [{ kind: 'multiplier', target: 'sellPrice', factor: 1.02 }],
  },
  {
    id: 'collector',
    name: 'Sammler',
    icon: '🏺',
    desc: 'Finde 100 seltene Gegenstände.',
    title: 'Sammler',
    goal: { metric: 'collectibles', amount: 100 },
    effects: [{ kind: 'multiplier', target: 'rareFind', factor: 1.05 }],
  },
  {
    id: 'automator',
    name: 'Automatisierer',
    icon: '🤖',
    desc: 'Lass den Hof komplett ohne Handarbeit laufen.',
    title: 'Automatisierer',
    goal: { metric: 'automationRate', amount: 1 },
    effects: [{ kind: 'multiplier', target: 'autoSell', factor: 1.03 }],
  },
  {
    id: 'billionaire',
    name: 'Milliardär',
    icon: '💎',
    desc: 'Erziele 1 Milliarde € Gesamtumsatz.',
    title: 'Milliardär',
    goal: { metric: 'lifetimeEarned', amount: 1_000_000_000 },
    effects: [{ kind: 'multiplier', target: 'sellPrice', factor: 1.03 }],
  },
  {
    id: 'mechanic',
    name: 'Maschinenpark',
    icon: '⚙️',
    desc: 'Bringe deine Anlagen auf zusammen 100 Ausbaustufen.',
    goal: { metric: 'machineLevels', amount: 100 },
    effects: [{ kind: 'multiplier', target: 'wear', factor: 0.97 }],
  },
  {
    id: 'scholar',
    name: 'Forschergeist',
    icon: '🔬',
    desc: 'Erforsche 50 Technologiestufen.',
    title: 'Chefingenieur',
    goal: { metric: 'techLevels', amount: 50 },
    effects: [{ kind: 'multiplier', target: 'researchPoints', factor: 1.05 }],
  },
  {
    id: 'mentor',
    name: 'Ausbilder',
    icon: '🎓',
    desc: 'Bring eine Rolle auf Erfahrungsstufe 10.',
    goal: { metric: 'staffLevel', amount: 10 },
    effects: [{ kind: 'multiplier', target: 'staffProductivity', factor: 1.04 }],
  },
  {
    id: 'founder',
    name: 'Serienunternehmer',
    icon: '🏆',
    desc: 'Gründe dein Unternehmen dreimal neu.',
    title: 'Serienunternehmer',
    goal: { metric: 'prestigeRuns', amount: 3 },
    effects: [{ kind: 'multiplier', target: 'researchSpeed', factor: 1.05 }],
  },
  {
    id: 'empire',
    name: 'Imperium',
    icon: '👑',
    desc: 'Erreiche einen Firmenwert von 1 Milliarde €.',
    title: 'Industrieller',
    goal: { metric: 'companyValue', amount: 1_000_000_000 },
    effects: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.04 }],
  },
];
