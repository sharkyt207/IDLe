/**
 * Contract, auction and collectible databases (GDD chapter 4).
 *
 * All three are pure data: a new customer, lot type or find is one entry.
 */

export interface ContractDef {
  id: string;
  client: string;
  icon: string;
  desc: string;
  /** Materials the client wants, in units at difficulty 1. */
  demand: { material: string; amount: number }[];
  /** Scales with the player's level so contracts stay meaningful. */
  scaleWithLevel?: boolean;
  requires?: { level?: number };
}

/** Long-term customers. Reward is derived from the delivered material value. */
export const CONTRACTS: ContractDef[] = [
  {
    id: 'builder',
    client: 'Baufirma Hartmann',
    icon: '🏗️',
    desc: 'Braucht laufend Stahl für den Rohbau.',
    demand: [
      { material: 'steel_ingot', amount: 20 },
      { material: 'steel_scrap', amount: 120 },
    ],
    scaleWithLevel: true,
    requires: { level: 6 },
  },
  {
    id: 'builder_plate',
    client: 'Stahlbau Nord',
    icon: '🏢',
    desc: 'Nimmt Stahlplatten in großen Mengen ab.',
    demand: [{ material: 'steel_plate', amount: 12 }],
    scaleWithLevel: true,
    requires: { level: 12 },
  },
  {
    id: 'electronics',
    client: 'Elektronikhersteller Voltek',
    icon: '💡',
    desc: 'Zahlt gut für Kupfer, Gold und Leiterplatten.',
    demand: [
      { material: 'copper', amount: 60 },
      { material: 'electronics', amount: 25 },
      { material: 'gold', amount: 1 },
    ],
    scaleWithLevel: true,
    requires: { level: 10 },
  },
  {
    id: 'carmaker',
    client: 'Automobilwerk Rhein',
    icon: '🚗',
    desc: 'Langfristiger Liefervertrag für Karosseriematerial.',
    demand: [
      { material: 'aluminium', amount: 90 },
      { material: 'steel', amount: 80 },
      { material: 'safety_glass', amount: 30 },
    ],
    scaleWithLevel: true,
    requires: { level: 8 },
  },
  {
    id: 'recycler',
    client: 'Kunststoffwerk Süd',
    icon: '♻️',
    desc: 'Nimmt sortierte Kunststoffe ab.',
    demand: [
      { material: 'plastic', amount: 120 },
      { material: 'soft_plastic', amount: 80 },
      { material: 'rubber_granulate', amount: 15 },
    ],
    scaleWithLevel: true,
    requires: { level: 5 },
  },
  {
    id: 'battery',
    client: 'Zellfabrik Aurum',
    icon: '🔋',
    desc: 'Sucht Batteriematerial für Energiespeicher.',
    demand: [
      { material: 'lithium', amount: 25 },
      { material: 'cobalt', amount: 15 },
      { material: 'copper_wire', amount: 8 },
    ],
    scaleWithLevel: true,
    requires: { level: 16 },
  },
  {
    id: 'aerospace',
    client: 'Luftfahrtzulieferer Delta',
    icon: '✈️',
    desc: 'Zahlt Spitzenpreise für Titan und Carbon.',
    demand: [
      { material: 'titanium', amount: 40 },
      { material: 'carbon', amount: 30 },
      { material: 'industrial_plate', amount: 5 },
    ],
    scaleWithLevel: true,
    requires: { level: 22 },
  },
  {
    id: 'refinery',
    client: 'Raffinerie Westhafen',
    icon: '🛢️',
    desc: 'Übernimmt aufbereitete Betriebsstoffe.',
    demand: [{ material: 'fuel', amount: 60 }],
    scaleWithLevel: true,
    requires: { level: 14 },
  },
];

// ---------------------------------------------------------------------------
// Auctions
// ---------------------------------------------------------------------------

export interface AuctionLotDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** Vehicles included in the lot. */
  vehicles?: { id: string; count: number }[];
  /** Loose material included in the lot. */
  materials?: { material: string; amount: number }[];
  requires?: { level?: number };
}

/** Lots rotate; the system picks whatever the player has unlocked. */
export const AUCTION_LOTS: AuctionLotDef[] = [
  {
    id: 'accident_batch',
    name: 'Unfallfahrzeuge',
    icon: '🚗',
    desc: 'Posten aus einer Versicherungsauflösung.',
    vehicles: [{ id: 'kleinwagen', count: 3 }, { id: 'limousine', count: 2 }],
    requires: { level: 3 },
  },
  {
    id: 'fleet_closure',
    name: 'Firmenauflösung',
    icon: '🏢',
    desc: 'Kompletter Fuhrpark einer Spedition.',
    vehicles: [{ id: 'transporter', count: 3 }, { id: 'lieferwagen', count: 2 }],
    requires: { level: 9 },
  },
  {
    id: 'metal_lot',
    name: 'Metallposten',
    icon: '🔩',
    desc: 'Gemischter Metallschrott aus einer Halle.',
    materials: [
      { material: 'steel_scrap', amount: 900 },
      { material: 'aluminium', amount: 260 },
      { material: 'copper', amount: 90 },
    ],
    requires: { level: 6 },
  },
  {
    id: 'military_surplus',
    name: 'Militärüberschuss',
    icon: '🪖',
    desc: 'Ausgemusterte Technik vom Bundeswehrdepot.',
    vehicles: [{ id: 'militaer', count: 2 }],
    materials: [{ material: 'titanium', amount: 120 }],
    requires: { level: 24 },
  },
  {
    id: 'container_lot',
    name: 'Containerposten',
    icon: '📦',
    desc: 'Unversteigerte Seecontainer, Inhalt gemischt.',
    materials: [
      { material: 'electronics', amount: 240 },
      { material: 'cable', amount: 600 },
      { material: 'plastic', amount: 800 },
    ],
    requires: { level: 12 },
  },
  {
    id: 'shipwreck',
    name: 'Schiffswrack',
    icon: '🚢',
    desc: 'Bergungsposten aus dem Hafenbecken.',
    vehicles: [{ id: 'schiff', count: 1 }],
    requires: { level: 30 },
  },
  {
    id: 'classic_lot',
    name: 'Oldtimer-Nachlass',
    icon: '🚘',
    desc: 'Scheunenfund aus einem Nachlass.',
    vehicles: [{ id: 'oldtimer', count: 2 }],
    requires: { level: 23 },
  },
  {
    id: 'heavy_lot',
    name: 'Baumaschinen-Auflösung',
    icon: '🚧',
    desc: 'Maschinenpark einer insolventen Baufirma.',
    vehicles: [{ id: 'bagger', count: 1 }, { id: 'radlader', count: 2 }],
    requires: { level: 19 },
  },
];

// ---------------------------------------------------------------------------
// Collectibles
// ---------------------------------------------------------------------------

export interface CollectibleDef {
  id: string;
  name: string;
  icon: string;
  /** Sale value in EUR. */
  value: number;
  /** Relative draw weight. */
  weight: number;
  /** Only found in vehicles of at least this class. */
  minClass?: number;
}

/** Random finds while dismantling - sellable or kept for the collection. */
export const COLLECTIBLES: CollectibleDef[] = [
  { id: 'toolbox', name: 'Alte Werkzeugkiste', icon: '🧰', value: 180, weight: 22 },
  { id: 'cash', name: 'Vergessenes Bargeld', icon: '💵', value: 340, weight: 18 },
  { id: 'plate', name: 'Historisches Kennzeichen', icon: '🪧', value: 700, weight: 14 },
  { id: 'rims', name: 'Seltene Felgen', icon: '🛞', value: 1_400, weight: 12, minClass: 2 },
  { id: 'coins', name: 'Goldmünzen', icon: '🪙', value: 3_200, weight: 9 },
  { id: 'jewellery', name: 'Schmuckstück', icon: '💍', value: 5_500, weight: 7, minClass: 2 },
  { id: 'model', name: 'Sammlermodell', icon: '🏎️', value: 12_000, weight: 6, minClass: 3 },
  { id: 'signed', name: 'Signiertes Bauteil', icon: '✍️', value: 42_000, weight: 4, minClass: 4 },
  { id: 'prototype', name: 'Prototyp', icon: '🧪', value: 260_000, weight: 2, minClass: 5 },
];
