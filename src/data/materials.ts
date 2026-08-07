import type { MaterialDef, RecipeDef } from './types';

/**
 * Material database (GDD chapter 4).
 *
 * `tier` groups by refinement (0 raw, 1 refined, 2 component, 3 finished good)
 * and `category` groups for the UI. `basePrice` is the only balancing knob -
 * vehicle prices are derived from it, so raising a material's value
 * automatically makes the vehicles that contain it worth more.
 */
export const MATERIALS: MaterialDef[] = [
  // --- Standard metals ------------------------------------------------------
  { id: 'steel_scrap', name: 'Eisenschrott', icon: '🔩', color: '#8b93a1', tier: 0, category: 'Metall', basePrice: 0.9 },
  { id: 'steel', name: 'Stahl', icon: '⚙️', color: '#9aa3b2', tier: 0, category: 'Metall', basePrice: 1.7 },
  { id: 'aluminium', name: 'Aluminium', icon: '🥫', color: '#c8d1dc', tier: 0, category: 'Metall', basePrice: 3.4 },
  { id: 'copper', name: 'Kupfer', icon: '🟠', color: '#c87d3f', tier: 0, category: 'Metall', basePrice: 8.5 },
  { id: 'brass', name: 'Messing', icon: '🔶', color: '#c9a541', tier: 0, category: 'Metall', basePrice: 6.2 },
  { id: 'stainless', name: 'Edelstahl', icon: '🪙', color: '#b9c4cf', tier: 0, category: 'Metall', basePrice: 12 },

  // --- Plastics -------------------------------------------------------------
  { id: 'plastic', name: 'Hartplastik', icon: '🧴', color: '#6fa8c7', tier: 0, category: 'Kunststoff', basePrice: 0.7 },
  { id: 'soft_plastic', name: 'Weichplastik', icon: '🧻', color: '#8fbfd8', tier: 0, category: 'Kunststoff', basePrice: 0.5 },
  { id: 'pvc', name: 'PVC', icon: '🧱', color: '#7f9fb8', tier: 0, category: 'Kunststoff', basePrice: 0.9 },
  { id: 'rubber', name: 'Gummi', icon: '⚫', color: '#3c3f45', tier: 0, category: 'Kunststoff', basePrice: 0.9 },

  // --- Glass ----------------------------------------------------------------
  { id: 'glass', name: 'Fensterglas', icon: '🪟', color: '#9fd4d8', tier: 0, category: 'Glas', basePrice: 0.6 },
  { id: 'safety_glass', name: 'Sicherheitsglas', icon: '🛡️', color: '#a8dde0', tier: 0, category: 'Glas', basePrice: 1.4 },
  { id: 'special_glass', name: 'Spezialglas', icon: '💎', color: '#b6e8ea', tier: 0, category: 'Glas', basePrice: 4.5 },

  // --- Electronics ----------------------------------------------------------
  { id: 'cable', name: 'Kabel', icon: '🧵', color: '#d08a4a', tier: 0, category: 'Elektronik', basePrice: 5 },
  { id: 'electronics', name: 'Leiterplatten', icon: '🔌', color: '#7ad17a', tier: 0, category: 'Elektronik', basePrice: 22 },
  { id: 'sensor', name: 'Sensoren', icon: '📡', color: '#7ac7d1', tier: 0, category: 'Elektronik', basePrice: 45 },
  { id: 'ecu', name: 'Steuergeräte', icon: '🖲️', color: '#8a9fd1', tier: 0, category: 'Elektronik', basePrice: 90 },
  { id: 'display', name: 'Displays', icon: '📺', color: '#9ad1e8', tier: 0, category: 'Elektronik', basePrice: 140 },
  { id: 'cpu', name: 'Prozessoren', icon: '🧠', color: '#d1a5f0', tier: 0, category: 'Elektronik', basePrice: 380 },

  // --- Fluids: a cost until recycling is researched --------------------------
  { id: 'engine_oil', name: 'Motoröl', icon: '🛢️', color: '#4a4030', tier: 0, category: 'Flüssigkeit', basePrice: 1.2, hazardous: true },
  { id: 'coolant', name: 'Kühlmittel', icon: '🧊', color: '#5fa8b8', tier: 0, category: 'Flüssigkeit', basePrice: 1, hazardous: true },
  { id: 'fuel', name: 'Kraftstoff', icon: '⛽', color: '#b8a04a', tier: 0, category: 'Flüssigkeit', basePrice: 2.2, hazardous: true },
  { id: 'brake_fluid', name: 'Bremsflüssigkeit', icon: '🧪', color: '#9a7fb8', tier: 0, category: 'Flüssigkeit', basePrice: 1.8, hazardous: true },

  // --- Rare materials -------------------------------------------------------
  { id: 'silver', name: 'Silber', icon: '🥈', color: '#d6dde4', tier: 0, category: 'Selten', basePrice: 75 },
  { id: 'lithium', name: 'Lithium', icon: '🔋', color: '#d0d24a', tier: 0, category: 'Selten', basePrice: 95 },
  { id: 'cobalt', name: 'Kobalt', icon: '🔵', color: '#4a6ad0', tier: 0, category: 'Selten', basePrice: 130 },
  { id: 'carbon', name: 'Carbon', icon: '🕸️', color: '#3a3d42', tier: 0, category: 'Selten', basePrice: 180 },
  { id: 'titanium', name: 'Titan', icon: '⬜', color: '#c3ccd6', tier: 0, category: 'Selten', basePrice: 220 },
  { id: 'catalyst', name: 'Katalysator', icon: '💠', color: '#d5a5f0', tier: 0, category: 'Selten', basePrice: 320 },
  { id: 'platinum', name: 'Platin', icon: '⚪', color: '#e2e8ee', tier: 0, category: 'Selten', basePrice: 900 },
  { id: 'palladium', name: 'Palladium', icon: '🔘', color: '#cfd6dd', tier: 0, category: 'Selten', basePrice: 1_100 },
  { id: 'gold', name: 'Gold', icon: '🥇', color: '#e8c34a', tier: 0, category: 'Selten', basePrice: 1_600 },

  // --- Refined (tier 1) -----------------------------------------------------
  { id: 'steel_ingot', name: 'Stahlbarren', icon: '🧱', color: '#a7b0be', tier: 1, category: 'Veredelt', basePrice: 11 },
  { id: 'alu_block', name: 'Alu-Block', icon: '⬜', color: '#dee5ee', tier: 1, category: 'Veredelt', basePrice: 22 },
  { id: 'copper_granulate', name: 'Kupfergranulat', icon: '🟤', color: '#c98a52', tier: 1, category: 'Veredelt', basePrice: 30 },
  { id: 'copper_wire', name: 'Kupferdraht', icon: '🪢', color: '#e0914f', tier: 1, category: 'Veredelt', basePrice: 72 },
  { id: 'rubber_granulate', name: 'Gummigranulat', icon: '⬛', color: '#4a4e56', tier: 1, category: 'Veredelt', basePrice: 6.5 },
  { id: 'plastic_pellets', name: 'Kunststoffgranulat', icon: '🔵', color: '#7fb8d8', tier: 1, category: 'Veredelt', basePrice: 4.2 },
  { id: 'glass_cullet', name: 'Glasbruch', icon: '🔷', color: '#a9dde2', tier: 1, category: 'Veredelt', basePrice: 3.6 },
  { id: 'battery_cell', name: 'Batteriezellen', icon: '🔋', color: '#c8d04a', tier: 1, category: 'Veredelt', basePrice: 460 },

  // --- Components (tier 2) --------------------------------------------------
  { id: 'steel_plate', name: 'Stahlplatten', icon: '🟦', color: '#7f9ec4', tier: 2, category: 'Bauteil', basePrice: 95 },
  { id: 'industrial_plate', name: 'Industrieplatte', icon: '🟪', color: '#8f8fc4', tier: 2, category: 'Bauteil', basePrice: 210 },
  { id: 'industrial_cable', name: 'Industriekabel', icon: '🔌', color: '#e0a84f', tier: 2, category: 'Bauteil', basePrice: 340 },
  { id: 'circuit_board', name: 'Platine', icon: '🟩', color: '#5fbf7f', tier: 2, category: 'Bauteil', basePrice: 900 },

  // --- Finished goods (tier 3) ----------------------------------------------
  { id: 'energy_storage', name: 'Energiespeicher', icon: '🔌', color: '#d0c04a', tier: 3, category: 'Endprodukt', basePrice: 3_400 },
  { id: 'control_unit', name: 'Industriesteuerung', icon: '🖥️', color: '#8fc4e0', tier: 3, category: 'Endprodukt', basePrice: 5_200 },
];

/**
 * Production chains. A recipe runs only when the yard owns a machine that
 * emits a matching `{ kind: 'process', recipe }` effect.
 */
export const RECIPES: RecipeDef[] = [
  // Karosserie → Stahl → Barren → Platten
  {
    id: 'smelt_steel',
    name: 'Stahl schmelzen',
    input: [{ material: 'steel_scrap', amount: 8 }],
    output: [{ material: 'steel_ingot', amount: 1 }],
    desc: '8 Eisenschrott → 1 Stahlbarren',
  },
  {
    id: 'roll_plate',
    name: 'Stahl walzen',
    input: [{ material: 'steel_ingot', amount: 7 }],
    output: [{ material: 'steel_plate', amount: 1 }],
    desc: '7 Stahlbarren → 1 Stahlplatte',
  },
  {
    id: 'smelt_alu',
    name: 'Aluminium gießen',
    input: [{ material: 'aluminium', amount: 6 }],
    output: [{ material: 'alu_block', amount: 1 }],
    desc: '6 Aluminium → 1 Alu-Block',
  },

  // Kabel → Granulat → Draht → Industriekabel
  {
    id: 'granulate_copper',
    name: 'Kabel granulieren',
    input: [{ material: 'cable', amount: 5 }],
    output: [{ material: 'copper_granulate', amount: 1 }],
    desc: '5 Kabel → 1 Kupfergranulat',
  },
  {
    id: 'draw_wire',
    name: 'Kupfer ziehen',
    input: [
      { material: 'copper_granulate', amount: 2 },
      { material: 'copper', amount: 4 },
    ],
    output: [{ material: 'copper_wire', amount: 1 }],
    desc: '2 Granulat + 4 Kupfer → 1 Kupferdraht',
  },
  {
    id: 'make_cable',
    name: 'Industriekabel fertigen',
    input: [
      { material: 'copper_wire', amount: 4 },
      { material: 'pvc', amount: 8 },
    ],
    output: [{ material: 'industrial_cable', amount: 1 }],
    desc: '4 Kupferdraht + 8 PVC → 1 Industriekabel',
  },

  // Kunststoff und Glas
  {
    id: 'grind_rubber',
    name: 'Gummi mahlen',
    input: [{ material: 'rubber', amount: 7 }],
    output: [{ material: 'rubber_granulate', amount: 1 }],
    desc: '7 Gummi → 1 Gummigranulat',
  },
  {
    id: 'pelletize',
    name: 'Kunststoff pelletieren',
    input: [
      { material: 'plastic', amount: 5 },
      { material: 'soft_plastic', amount: 3 },
    ],
    output: [{ material: 'plastic_pellets', amount: 1 }],
    desc: '5 Hartplastik + 3 Weichplastik → 1 Granulat',
  },
  {
    id: 'crush_glass',
    name: 'Glas aufbereiten',
    input: [
      { material: 'glass', amount: 6 },
      { material: 'safety_glass', amount: 2 },
    ],
    output: [{ material: 'glass_cullet', amount: 1 }],
    desc: '6 Fensterglas + 2 Sicherheitsglas → 1 Glasbruch',
  },

  // Batterie → Lithium → Zellen → Energiespeicher
  {
    id: 'refine_cells',
    name: 'Batteriezellen aufbereiten',
    input: [
      { material: 'lithium', amount: 4 },
      { material: 'cobalt', amount: 2 },
    ],
    output: [{ material: 'battery_cell', amount: 1 }],
    desc: '4 Lithium + 2 Kobalt → 1 Batteriezelle',
  },
  {
    id: 'build_storage',
    name: 'Energiespeicher bauen',
    input: [
      { material: 'battery_cell', amount: 6 },
      { material: 'industrial_cable', amount: 1 },
      { material: 'steel_plate', amount: 2 },
    ],
    output: [{ material: 'energy_storage', amount: 1 }],
    desc: '6 Zellen + 1 Industriekabel + 2 Stahlplatten → 1 Energiespeicher',
  },

  // Schwerindustrie und Elektronik
  {
    id: 'press_plate',
    name: 'Industrieplatten pressen',
    input: [
      { material: 'steel_plate', amount: 2 },
      { material: 'alu_block', amount: 3 },
      { material: 'titanium', amount: 1 },
    ],
    output: [{ material: 'industrial_plate', amount: 1 }],
    desc: '2 Stahlplatten + 3 Alu-Blöcke + 1 Titan → 1 Industrieplatte',
  },
  {
    id: 'assemble_board',
    name: 'Platinen fertigen',
    input: [
      { material: 'electronics', amount: 8 },
      { material: 'copper_wire', amount: 2 },
      { material: 'silver', amount: 1 },
    ],
    output: [{ material: 'circuit_board', amount: 1 }],
    desc: '8 Leiterplatten + 2 Draht + 1 Silber → 1 Platine',
  },
  {
    id: 'assemble_control',
    name: 'Industriesteuerung bauen',
    input: [
      { material: 'circuit_board', amount: 3 },
      { material: 'cpu', amount: 2 },
      { material: 'display', amount: 2 },
    ],
    output: [{ material: 'control_unit', amount: 1 }],
    desc: '3 Platinen + 2 Prozessoren + 2 Displays → 1 Steuerung',
  },

  // Fluids: recycling turns a disposal cost into a product.
  {
    id: 'recycle_oil',
    name: 'Altöl aufbereiten',
    input: [
      { material: 'engine_oil', amount: 6 },
      { material: 'coolant', amount: 4 },
    ],
    output: [{ material: 'fuel', amount: 3 }],
    desc: '6 Motoröl + 4 Kühlmittel → 3 Kraftstoff',
  },
];
