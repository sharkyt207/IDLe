import type { MaterialDef, RecipeDef } from './types';

/** Raw scrap (tier 0), refined goods (tier 1) and components (tier 2). */
export const MATERIALS: MaterialDef[] = [
  // --- tier 0: straight out of a vehicle -----------------------------------
  { id: 'steel_scrap', name: 'Stahlschrott', icon: '🔩', color: '#8b93a1', tier: 0, basePrice: 1.2 },
  { id: 'aluminium', name: 'Aluminium', icon: '🥫', color: '#c8d1dc', tier: 0, basePrice: 3.4 },
  { id: 'copper', name: 'Kupfer', icon: '🟠', color: '#c87d3f', tier: 0, basePrice: 8.5 },
  { id: 'rubber', name: 'Gummi', icon: '⚫', color: '#3c3f45', tier: 0, basePrice: 0.9 },
  { id: 'plastic', name: 'Kunststoff', icon: '🧴', color: '#6fa8c7', tier: 0, basePrice: 0.7 },
  { id: 'glass', name: 'Glas', icon: '🪟', color: '#9fd4d8', tier: 0, basePrice: 0.6 },
  { id: 'electronics', name: 'Elektronik', icon: '🔌', color: '#7ad17a', tier: 0, basePrice: 15 },
  { id: 'battery', name: 'Akkuzellen', icon: '🔋', color: '#d0d24a', tier: 0, basePrice: 34 },
  { id: 'catalyst', name: 'Katalysator', icon: '💠', color: '#d5a5f0', tier: 0, basePrice: 120 },

  // --- tier 1: refined ------------------------------------------------------
  { id: 'steel_ingot', name: 'Stahlbarren', icon: '🧱', color: '#a7b0be', tier: 1, basePrice: 9.5 },
  { id: 'alu_block', name: 'Alu-Block', icon: '⬜', color: '#dee5ee', tier: 1, basePrice: 22 },
  { id: 'copper_wire', name: 'Kupferdraht', icon: '🧵', color: '#e0914f', tier: 1, basePrice: 48 },
  { id: 'rubber_granulate', name: 'Gummigranulat', icon: '⬛', color: '#4a4e56', tier: 1, basePrice: 6.5 },

  // --- tier 2: components ---------------------------------------------------
  { id: 'industrial_plate', name: 'Industrieplatte', icon: '🟦', color: '#7f9ec4', tier: 2, basePrice: 78 },
  { id: 'circuit_board', name: 'Platine', icon: '🟩', color: '#5fbf7f', tier: 2, basePrice: 190 },
];

/**
 * Processing chains. A recipe only runs when the yard owns a machine that
 * emits a matching `{ kind: 'process', recipe }` effect.
 */
export const RECIPES: RecipeDef[] = [
  {
    id: 'smelt_steel',
    name: 'Stahl schmelzen',
    input: [{ material: 'steel_scrap', amount: 8 }],
    output: [{ material: 'steel_ingot', amount: 1 }],
    desc: '8 Stahlschrott → 1 Stahlbarren',
  },
  {
    id: 'smelt_alu',
    name: 'Aluminium gießen',
    input: [{ material: 'aluminium', amount: 6 }],
    output: [{ material: 'alu_block', amount: 1 }],
    desc: '6 Aluminium → 1 Alu-Block',
  },
  {
    id: 'draw_wire',
    name: 'Kupfer ziehen',
    input: [{ material: 'copper', amount: 5 }],
    output: [{ material: 'copper_wire', amount: 1 }],
    desc: '5 Kupfer → 1 Kupferdraht',
  },
  {
    id: 'grind_rubber',
    name: 'Gummi mahlen',
    input: [{ material: 'rubber', amount: 7 }],
    output: [{ material: 'rubber_granulate', amount: 1 }],
    desc: '7 Gummi → 1 Gummigranulat',
  },
  {
    id: 'press_plate',
    name: 'Platten pressen',
    input: [
      { material: 'steel_ingot', amount: 6 },
      { material: 'alu_block', amount: 2 },
    ],
    output: [{ material: 'industrial_plate', amount: 1 }],
    desc: '6 Stahlbarren + 2 Alu-Blöcke → 1 Industrieplatte',
  },
  {
    id: 'assemble_board',
    name: 'Platinen fertigen',
    input: [
      { material: 'electronics', amount: 8 },
      { material: 'copper_wire', amount: 2 },
    ],
    output: [{ material: 'circuit_board', amount: 1 }],
    desc: '8 Elektronik + 2 Kupferdraht → 1 Platine',
  },
];
