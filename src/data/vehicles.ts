import { ECONOMY } from './economy';
import { MATERIALS } from './materials';
import type { PartDef, Rarity, VehicleDef, VehicleShape } from './types';

/**
 * Vehicle database (GDD chapter 4).
 *
 * Vehicles are described by a **class template** plus a `scale`. The template
 * fixes what a class is made of; the scale says how much of it. Work, weight,
 * XP and above all the **purchase price** are derived from that, so:
 *
 *   - a new vehicle is four lines of data,
 *   - the profit ladder can never silently invert (price = value ÷ margin),
 *   - rebalancing a whole class means editing one template.
 */

type ClassId = 'everyday' | 'utility' | 'heavy' | 'special' | 'luxury' | 'industrial';

interface PartTemplate {
  id: string;
  name: string;
  icon: string;
  /** Work at scale 1. */
  work: number;
  /** [materialId, units at scale 1] */
  yields: [string, number][];
  /** Instant cash at scale 1. */
  cash?: number;
}

interface ClassTemplate {
  tier: number;
  shape: VehicleShape;
  /** Reference weight in kg at scale 1. */
  weight: number;
  parts: PartTemplate[];
}

const CLASSES: Record<ClassId, ClassTemplate> = {
  // --- Stufe 1: Alltagsfahrzeuge -------------------------------------------
  everyday: {
    tier: 1,
    shape: 'car',
    weight: 950,
    parts: [
      { id: 'wheels', name: 'Räder', icon: '🛞', work: 3, yields: [['rubber', 4], ['steel_scrap', 2]] },
      { id: 'hood', name: 'Motorhaube', icon: '🔧', work: 3, yields: [['steel_scrap', 4], ['steel', 1]] },
      { id: 'engine', name: 'Motor', icon: '⚙️', work: 5, cash: 3, yields: [['steel', 4], ['aluminium', 2], ['copper', 1]] },
      { id: 'interior', name: 'Innenraum', icon: '💺', work: 3, yields: [['plastic', 3], ['soft_plastic', 2]] },
      { id: 'glass', name: 'Scheiben', icon: '🪟', work: 2, yields: [['glass', 3], ['safety_glass', 1]] },
      { id: 'electronics', name: 'Bordelektrik', icon: '🔌', work: 3, yields: [['cable', 1], ['electronics', 0.4]] },
      { id: 'fluids', name: 'Betriebsstoffe', icon: '🛢️', work: 2, yields: [['engine_oil', 2], ['coolant', 1.5]] },
    ],
  },

  // --- Stufe 2: Nutzfahrzeuge ----------------------------------------------
  utility: {
    tier: 2,
    shape: 'van',
    weight: 2400,
    parts: [
      { id: 'wheels', name: 'Räder', icon: '🛞', work: 7, yields: [['rubber', 12], ['steel', 5]] },
      { id: 'engine', name: 'Dieselmotor', icon: '⚙️', work: 12, cash: 14, yields: [['steel', 16], ['aluminium', 7], ['copper', 4], ['brass', 2]] },
      { id: 'cargo', name: 'Laderaum', icon: '📦', work: 10, yields: [['steel_scrap', 24], ['plastic', 8], ['pvc', 5]] },
      { id: 'cab', name: 'Fahrerkabine', icon: '💺', work: 8, yields: [['safety_glass', 5], ['soft_plastic', 7], ['glass', 4]] },
      { id: 'electronics', name: 'Elektrik', icon: '🔌', work: 8, yields: [['cable', 6], ['electronics', 2], ['sensor', 0.5]] },
      { id: 'fluids', name: 'Betriebsstoffe', icon: '🛢️', work: 4, yields: [['engine_oil', 5], ['coolant', 4], ['fuel', 2]] },
    ],
  },

  // --- Stufe 3: Schwerfahrzeuge --------------------------------------------
  heavy: {
    tier: 3,
    shape: 'truck',
    weight: 9000,
    parts: [
      { id: 'wheels', name: 'Zwillingsräder', icon: '🛞', work: 22, yields: [['rubber', 55], ['steel', 26]] },
      { id: 'engine', name: 'Schwerlastmotor', icon: '⚙️', work: 34, cash: 180, yields: [['steel', 110], ['aluminium', 38], ['copper', 26], ['stainless', 8]] },
      { id: 'frame', name: 'Rahmen & Aufbau', icon: '🏗️', work: 30, yields: [['steel_scrap', 150], ['steel', 60], ['pvc', 18]] },
      { id: 'cab', name: 'Fahrerhaus', icon: '💺', work: 24, yields: [['plastic', 30], ['safety_glass', 16], ['soft_plastic', 14]] },
      { id: 'hydraulics', name: 'Hydraulik', icon: '🛠️', work: 26, yields: [['stainless', 14], ['brass', 12], ['engine_oil', 18]] },
      { id: 'electronics', name: 'Telematik', icon: '🔌', work: 26, yields: [['cable', 22], ['electronics', 10], ['ecu', 1], ['sensor', 3]] },
    ],
  },

  // --- Stufe 4: Spezialfahrzeuge -------------------------------------------
  special: {
    tier: 4,
    shape: 'truck',
    weight: 11_000,
    parts: [
      { id: 'body', name: 'Sonderaufbau', icon: '🚨', work: 40, yields: [['aluminium', 120], ['stainless', 40], ['special_glass', 8]] },
      { id: 'engine', name: 'Motor & Antrieb', icon: '⚙️', work: 46, cash: 900, yields: [['steel', 180], ['copper', 60], ['brass', 22]] },
      { id: 'equipment', name: 'Spezialausrüstung', icon: '🧰', work: 44, yields: [['stainless', 55], ['sensor', 14], ['ecu', 6]] },
      { id: 'electronics', name: 'Funk & Steuerung', icon: '📡', work: 42, yields: [['electronics', 45], ['ecu', 10], ['display', 3], ['cable', 40]] },
      { id: 'interior', name: 'Innenausbau', icon: '💺', work: 34, yields: [['plastic', 60], ['soft_plastic', 40], ['safety_glass', 22]] },
      { id: 'fluids', name: 'Betriebsstoffe', icon: '🛢️', work: 20, yields: [['engine_oil', 30], ['coolant', 24], ['brake_fluid', 12], ['fuel', 16]] },
    ],
  },

  // --- Stufe 5: Luxus & Exoten ---------------------------------------------
  luxury: {
    tier: 5,
    shape: 'car',
    weight: 1800,
    parts: [
      { id: 'body', name: 'Karosserie', icon: '✨', work: 46, yields: [['aluminium', 130], ['carbon', 12], ['steel', 60]] },
      { id: 'engine', name: 'Hochleistungsmotor', icon: '⚙️', work: 54, cash: 2_600, yields: [['titanium', 10], ['aluminium', 90], ['stainless', 40], ['brass', 18]] },
      { id: 'interior', name: 'Luxusausstattung', icon: '💺', work: 40, yields: [['soft_plastic', 40], ['special_glass', 14], ['silver', 6]] },
      { id: 'electronics', name: 'Bordsysteme', icon: '🖥️', work: 48, yields: [['display', 6], ['cpu', 3], ['ecu', 12], ['electronics', 55]] },
      { id: 'catalyst', name: 'Abgasanlage', icon: '💠', work: 42, yields: [['catalyst', 4], ['platinum', 1.2], ['palladium', 0.8], ['stainless', 25]] },
      { id: 'wheels', name: 'Sporträder', icon: '🛞', work: 34, yields: [['aluminium', 45], ['rubber', 30], ['titanium', 3]] },
    ],
  },

  // --- Stufe 6: Industrie & Großobjekte ------------------------------------
  industrial: {
    tier: 6,
    shape: 'container',
    weight: 60_000,
    parts: [
      { id: 'structure', name: 'Tragstruktur', icon: '🏗️', work: 150, yields: [['steel_scrap', 4_200], ['steel', 2_400], ['stainless', 260]] },
      { id: 'drive', name: 'Antriebseinheit', icon: '⚙️', work: 170, cash: 26_000, yields: [['copper', 900], ['titanium', 90], ['cobalt', 60]] },
      { id: 'shell', name: 'Verkleidung', icon: '🛡️', work: 155, yields: [['aluminium', 1_600], ['carbon', 120], ['pvc', 400]] },
      { id: 'control', name: 'Steuerungstechnik', icon: '🖥️', work: 180, yields: [['electronics', 700], ['cpu', 40], ['display', 30], ['ecu', 90], ['sensor', 120]] },
      { id: 'cabling', name: 'Kabelbäume', icon: '🧵', work: 160, yields: [['cable', 1_100], ['copper', 400], ['silver', 25]] },
      { id: 'rare', name: 'Sondermodule', icon: '💠', work: 190, yields: [['lithium', 130], ['cobalt', 90], ['platinum', 12], ['palladium', 9], ['gold', 5]] },
    ],
  },
};

interface VehicleSpec {
  id: string;
  name: string;
  icon: string;
  cls: ClassId;
  /** Multiplies every yield of the class template. */
  scale: number;
  color: string;
  rarity: Rarity;
  level: number;
  shape?: VehicleShape;
  /** Signature materials on top of the template. */
  extra?: [string, number][];
  rareFinds?: { chance: number; material: string; amount: number; label: string }[];
}

const SPECS: VehicleSpec[] = [
  // --- Stufe 1 --------------------------------------------------------------
  { id: 'kleinwagen', name: 'Alter Kleinwagen', icon: '🚗', cls: 'everyday', scale: 1, color: '#b9483f', rarity: 'common', level: 1 },
  { id: 'limousine', name: 'Alte Limousine', icon: '🚙', cls: 'everyday', scale: 2.3, color: '#3b5f8a', rarity: 'common', level: 3 },
  { id: 'kombi', name: 'Kombi', icon: '🚘', cls: 'everyday', scale: 3.2, color: '#4a7a5f', rarity: 'common', level: 4 },
  { id: 'van', name: 'Van', icon: '🚐', cls: 'everyday', scale: 4.6, color: '#8a7a3f', rarity: 'common', level: 6, shape: 'van' },
  { id: 'suv', name: 'Ausrangierter SUV', icon: '🚙', cls: 'everyday', scale: 6.5, color: '#31694a', rarity: 'uncommon', level: 8, shape: 'van', extra: [['catalyst', 0.6]] },

  // --- Stufe 2 --------------------------------------------------------------
  { id: 'transporter', name: 'Transporter', icon: '🚐', cls: 'utility', scale: 1, color: '#c9a227', rarity: 'uncommon', level: 5 },
  { id: 'pickup', name: 'Pick-up', icon: '🛻', cls: 'utility', scale: 1.4, color: '#a4562c', rarity: 'uncommon', level: 7 },
  { id: 'lieferwagen', name: 'Lieferwagen', icon: '🚚', cls: 'utility', scale: 2.1, color: '#4f6f9a', rarity: 'uncommon', level: 9 },
  { id: 'kleinlaster', name: 'Kleinlaster', icon: '🚛', cls: 'utility', scale: 3.4, color: '#7a5a2b', rarity: 'uncommon', level: 11, shape: 'truck', extra: [['catalyst', 1.5]] },

  // --- Stufe 3 --------------------------------------------------------------
  { id: 'lkw', name: 'Sattelzug', icon: '🚛', cls: 'heavy', scale: 1, color: '#8a5a2b', rarity: 'rare', level: 12 },
  { id: 'bus', name: 'Ausgemusterter Bus', icon: '🚌', cls: 'heavy', scale: 1.7, color: '#c46a1f', rarity: 'rare', level: 14 },
  { id: 'traktor', name: 'Traktor', icon: '🚜', cls: 'heavy', scale: 2.4, color: '#3f7a3f', rarity: 'rare', level: 16, shape: 'machine' },
  { id: 'radlader', name: 'Radlader', icon: '🚧', cls: 'heavy', scale: 3.6, color: '#d4b021', rarity: 'rare', level: 18, shape: 'machine' },
  { id: 'bagger', name: 'Bagger', icon: '🏗️', cls: 'heavy', scale: 5.2, color: '#c8a41f', rarity: 'epic', level: 20, shape: 'machine', extra: [['titanium', 6]] },

  // --- Stufe 4 --------------------------------------------------------------
  { id: 'polizei', name: 'Polizeifahrzeug', icon: '🚓', cls: 'special', scale: 1, color: '#2f4f8a', rarity: 'rare', level: 17, shape: 'car' },
  { id: 'krankenwagen', name: 'Krankenwagen', icon: '🚑', cls: 'special', scale: 1.5, color: '#d8d8d8', rarity: 'rare', level: 19, shape: 'van', extra: [['sensor', 8]] },
  { id: 'feuerwehr', name: 'Feuerwehrfahrzeug', icon: '🚒', cls: 'special', scale: 2.3, color: '#b02b2b', rarity: 'epic', level: 21 },
  { id: 'kranwagen', name: 'Kranwagen', icon: '🏗️', cls: 'special', scale: 3.4, color: '#c9821f', rarity: 'epic', level: 23, shape: 'machine' },
  { id: 'militaer', name: 'Militärfahrzeug', icon: '🪖', cls: 'special', scale: 5, color: '#5a6b3f', rarity: 'epic', level: 25, extra: [['titanium', 40], ['carbon', 25]] },

  // --- Stufe 5 --------------------------------------------------------------
  { id: 'sportwagen', name: 'Sportwagen', icon: '🏎️', cls: 'luxury', scale: 1, color: '#c42b2b', rarity: 'epic', level: 22 },
  { id: 'oldtimer', name: 'Oldtimer', icon: '🚘', cls: 'luxury', scale: 1.6, color: '#7a5a3f', rarity: 'epic', level: 24, extra: [['brass', 60], ['silver', 12]] },
  { id: 'luxuslimousine', name: 'Luxuslimousine', icon: '🚔', cls: 'luxury', scale: 2.6, color: '#1f2a3f', rarity: 'legendary', level: 26 },
  { id: 'supersportwagen', name: 'Supersportwagen', icon: '🏁', cls: 'luxury', scale: 5, color: '#e0b020', rarity: 'legendary', level: 28, extra: [['carbon', 90], ['gold', 1.5]] },

  // --- Stufe 6 --------------------------------------------------------------
  { id: 'lokomotive', name: 'Lokomotive', icon: '🚂', cls: 'industrial', scale: 1, color: '#5a4a3a', rarity: 'legendary', level: 27 },
  { id: 'windkraft', name: 'Windkraftanlage', icon: '🌬️', cls: 'industrial', scale: 1.9, color: '#dde4ea', rarity: 'legendary', level: 29, extra: [['carbon', 900], ['copper', 1_200]] },
  { id: 'flugzeugteile', name: 'Flugzeugteile', icon: '✈️', cls: 'industrial', scale: 3.1, color: '#b8c4d0', rarity: 'legendary', level: 31, extra: [['titanium', 900], ['carbon', 600]] },
  { id: 'schiff', name: 'Schiffswrack', icon: '🚢', cls: 'industrial', scale: 5.5, color: '#3f5a6b', rarity: 'legendary', level: 33, extra: [['stainless', 2_400], ['platinum', 90], ['palladium', 60]] },
  { id: 'industrieanlage', name: 'Industrieanlage', icon: '🏭', cls: 'industrial', scale: 9, color: '#6b6f76', rarity: 'legendary', level: 35 },
];

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

const PRICE = new Map(MATERIALS.map((m) => [m.id, m.basePrice]));
/** Hazardous material is a cost, so it must not inflate a vehicle's value. */
const IS_COST = new Set(MATERIALS.filter((m) => m.hazardous).map((m) => m.id));

function buildParts(spec: VehicleSpec, template: ClassTemplate): PartDef[] {
  const parts: PartDef[] = template.parts.map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
    work: Math.max(2, Math.round(p.work * Math.pow(spec.scale, 0.55))),
    cash: p.cash ? Math.round(p.cash * spec.scale) : undefined,
    yields: p.yields
      .map(([material, amount]) => scaleYield(material, amount * spec.scale))
      .filter((y): y is { material: string; min: number; max: number } => y !== null),
  }));

  // Signature materials ride along on the most valuable part.
  if (spec.extra?.length) {
    const target = parts[parts.length - 1];
    for (const [material, amount] of spec.extra) {
      const y = scaleYield(material, amount);
      if (y) target.yields.push(y);
    }
  }
  return parts;
}

/** A fractional amount becomes a chance-like 0…n range rather than vanishing. */
function scaleYield(material: string, amount: number): { material: string; min: number; max: number } | null {
  if (!PRICE.has(material)) {
    console.warn(`[content] unbekanntes Material in Fahrzeugvorlage: ${material}`);
    return null;
  }
  if (amount < 1) return { material, min: 0, max: Math.max(1, Math.round(amount * 2)) };
  return {
    material,
    min: Math.max(1, Math.round(amount * 0.85)),
    max: Math.max(1, Math.round(amount * 1.15)),
  };
}

/** Expected material value of a finished vehicle at base prices. */
export function vehicleValue(parts: PartDef[]): number {
  let value = 0;
  for (const part of parts) {
    value += part.cash ?? 0;
    for (const y of part.yields) {
      const price = PRICE.get(y.material) ?? 0;
      const units = (y.min + y.max) / 2;
      value += IS_COST.has(y.material) ? -units * price : units * price;
    }
  }
  return value;
}

function build(spec: VehicleSpec): VehicleDef {
  const template = CLASSES[spec.cls];
  const parts = buildParts(spec, template);
  const value = vehicleValue(parts);
  const margin = ECONOMY.vehicleMargin[template.tier - 1] ?? 2.5;

  return {
    id: spec.id,
    name: spec.name,
    icon: spec.icon,
    shape: spec.shape ?? template.shape,
    color: spec.color,
    rarity: spec.rarity,
    vehicleClass: template.tier,
    price: Math.max(1, Math.ceil(value / margin)),
    weightKg: Math.round(template.weight * Math.pow(spec.scale, 0.8)),
    xp: Math.max(8, Math.round(Math.pow(Math.max(1, value), 0.5) * 1.6)),
    requires: spec.level > 1 ? { level: spec.level } : undefined,
    parts,
    rareFinds: spec.rareFinds,
  };
}

export const VEHICLES: VehicleDef[] = SPECS.map(build);

/** Human-readable class names for the UI. */
export const VEHICLE_CLASS_NAMES = [
  'Alltagsfahrzeuge',
  'Nutzfahrzeuge',
  'Schwerfahrzeuge',
  'Spezialfahrzeuge',
  'Luxus & Exoten',
  'Industrie & Großobjekte',
];
