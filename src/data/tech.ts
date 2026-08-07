import type { TechDef } from './types';

/**
 * Technology tree (GDD chapter 7).
 *
 * Eight branches, every technology with several levels. `perLevel` effects
 * stack; `milestones` fire once and are where a technology changes the game
 * rather than a number — a new robot, a new energy source, a new screen.
 *
 * Adding a technology means adding one object here. Nothing in `progress/` or
 * `game/` needs to know it exists.
 */
export const TECHNOLOGIES: TechDef[] = [
  // ===========================================================================
  // Maschinen — Geschwindigkeit, Haltbarkeit, Energieverbrauch, Qualität
  // ===========================================================================
  {
    id: 'hydraulics',
    name: 'Hydraulik 2.0',
    icon: '🛠️',
    desc: 'Stärkere Pressen und Scheren. Jede Stufe +9 % Zerlegeleistung.',
    branch: 'Maschinen',
    maxLevel: 5,
    cost: { points: 3, money: 8_000 },
    costGrowth: 2.1,
    duration: 60,
    durationGrowth: 1.5,
    perLevel: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.09 }],
    milestones: [
      {
        level: 3,
        desc: 'Industriehydraulik: Anlagen verschleißen 30 % langsamer.',
        effects: [{ kind: 'multiplier', target: 'wear', factor: 0.7 }],
      },
      {
        level: 5,
        desc: 'Magnetische Pressen: +25 % Zerlegeleistung und bessere Qualität.',
        effects: [
          { kind: 'multiplier', target: 'teardownRate', factor: 1.25 },
          { kind: 'quality', amount: 0.04 },
        ],
      },
    ],
  },
  {
    id: 'precision_cutting',
    name: 'Präzisionsschnitt',
    icon: '📐',
    desc: 'Saubere Trennung statt roher Gewalt. Jede Stufe +10 % Ausbeute.',
    branch: 'Maschinen',
    maxLevel: 5,
    cost: { points: 4, money: 40_000, materials: [{ material: 'stainless', amount: 40 }] },
    costGrowth: 2.2,
    duration: 90,
    perLevel: [{ kind: 'yield', factor: 1.1 }],
    milestones: [
      {
        level: 4,
        desc: 'Wasserstrahlschneiden: +6 % Materialqualität im ganzen Hof.',
        effects: [{ kind: 'quality', amount: 0.06 }],
      },
    ],
  },
  {
    id: 'hardened_tools',
    name: 'Gehärtete Werkzeuge',
    icon: '🔨',
    desc: 'Jede Stufe +35 % Tippleistung — auch der Hammer wird besser.',
    branch: 'Maschinen',
    maxLevel: 5,
    cost: { points: 2, money: 4_000 },
    costGrowth: 2,
    duration: 45,
    perLevel: [{ kind: 'multiplier', target: 'tapPower', factor: 1.35 }],
  },
  {
    id: 'quantum_hydraulics',
    name: 'Quantenhydraulik',
    icon: '🌀',
    desc: 'Endstufe der Maschinenforschung. Jede Stufe +35 % Zerlegeleistung.',
    branch: 'Maschinen',
    maxLevel: 5,
    cost: { points: 90, money: 12_000_000, materials: [{ material: 'titanium', amount: 400 }] },
    costGrowth: 2.6,
    duration: 480,
    requires: { tech: [{ id: 'hydraulics', level: 5 }], level: 24 },
    perLevel: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.35 }],
    milestones: [
      {
        level: 5,
        desc: 'Feldstabilisierung: Anlagen verschleißen nur noch halb so schnell.',
        effects: [{ kind: 'multiplier', target: 'wear', factor: 0.5 }],
      },
    ],
  },

  // ===========================================================================
  // Materialkunde — Reinheit, Ausbeute, Wiederverwertbarkeit, Legierungen
  // ===========================================================================
  {
    id: 'metallurgy',
    name: 'Metallurgie',
    icon: '⚗️',
    desc: 'Jede Stufe +5 % Materialqualität und +8 % Verarbeitungstempo.',
    branch: 'Materialkunde',
    maxLevel: 5,
    cost: { points: 3, money: 10_000 },
    costGrowth: 2.1,
    duration: 75,
    perLevel: [
      { kind: 'quality', amount: 0.05 },
      { kind: 'multiplier', target: 'processSpeed', factor: 1.08 },
    ],
    milestones: [
      {
        level: 2,
        desc: 'Schmelzanalyse: schaltet die Verarbeitung veredelter Legierungen frei.',
        effects: [{ kind: 'unlock', id: 'alloys' }],
      },
    ],
  },
  {
    id: 'fluid_recycling',
    name: 'Flüssigkeitsaufbereitung',
    icon: '🛢️',
    desc: 'Betriebsstoffe werden vom Kostenfaktor zum Produkt.',
    branch: 'Materialkunde',
    maxLevel: 3,
    cost: { points: 5, money: 60_000, materials: [{ material: 'engine_oil', amount: 200 }] },
    costGrowth: 2.4,
    duration: 150,
    perLevel: [{ kind: 'multiplier', target: 'sellPrice', factor: 1.06 }],
    milestones: [
      {
        level: 1,
        desc: 'Öl, Kühlmittel und Kraftstoff bringen Geld statt Entsorgungskosten.',
        effects: [{ kind: 'unlock', id: 'fluid_recycling' }],
      },
    ],
  },
  {
    id: 'purity',
    name: 'Reinheitsgrade',
    icon: '💎',
    desc: 'Jede Stufe +7 % Qualität. Reines Material bringt bis zum Doppelten.',
    branch: 'Materialkunde',
    maxLevel: 5,
    cost: { points: 8, money: 220_000, materials: [{ material: 'silver', amount: 60 }] },
    costGrowth: 2.3,
    duration: 210,
    requires: { tech: [{ id: 'metallurgy', level: 3 }] },
    perLevel: [{ kind: 'quality', amount: 0.07 }],
  },
  {
    id: 'plate_pressing',
    name: 'Plattenwalzwerk',
    icon: '🗜️',
    desc: 'Industrieplatten und Plattenpresse. Jede Stufe +15 % Verarbeitung.',
    branch: 'Materialkunde',
    maxLevel: 5,
    cost: { points: 7, money: 240_000, materials: [{ material: 'steel_ingot', amount: 80 }] },
    costGrowth: 2.2,
    duration: 210,
    requires: { tech: [{ id: 'metallurgy', level: 2 }] },
    perLevel: [{ kind: 'multiplier', target: 'processSpeed', factor: 1.15 }],
    milestones: [
      {
        level: 1,
        desc: 'Schaltet Industrieplatten und die Plattenpresse frei.',
        effects: [{ kind: 'unlock', id: 'press_plate' }],
      },
      {
        level: 4,
        desc: 'Stranggießanlage: +60 % Verarbeitungsgeschwindigkeit.',
        effects: [{ kind: 'multiplier', target: 'processSpeed', factor: 1.6 }],
      },
    ],
  },
  {
    id: 'electronics_line',
    name: 'Elektronikfertigung',
    icon: '🟩',
    desc: 'Platinen und Steuergeräte. Jede Stufe +12 % Verarbeitung und Qualität.',
    branch: 'Materialkunde',
    maxLevel: 5,
    cost: { points: 22, money: 1_200_000, materials: [{ material: 'copper_wire', amount: 150 }] },
    costGrowth: 2.35,
    duration: 300,
    requires: { tech: [{ id: 'plate_pressing', level: 2 }] },
    perLevel: [
      { kind: 'multiplier', target: 'processSpeed', factor: 1.12 },
      { kind: 'quality', amount: 0.03 },
    ],
    milestones: [
      {
        level: 1,
        desc: 'Schaltet Platinen und die Platinenfertigung frei.',
        effects: [{ kind: 'unlock', id: 'assemble_board' }],
      },
    ],
  },
  {
    id: 'battery_tech',
    name: 'Batterietechnik',
    icon: '🔋',
    desc: 'Batteriezellen und Energiespeicher. Jede Stufe +20 % Lithium- und Kobaltausbeute.',
    branch: 'Materialkunde',
    maxLevel: 5,
    cost: { points: 34, money: 3_200_000, materials: [{ material: 'lithium', amount: 250 }] },
    costGrowth: 2.4,
    duration: 360,
    requires: { tech: [{ id: 'electronics_line', level: 1 }], level: 20 },
    perLevel: [
      { kind: 'yield', material: 'lithium', factor: 1.2 },
      { kind: 'yield', material: 'cobalt', factor: 1.2 },
    ],
    milestones: [
      {
        level: 1,
        desc: 'Schaltet Batteriezellen und Energiespeicher frei.',
        effects: [{ kind: 'unlock', id: 'battery_tech' }],
      },
    ],
  },

  {
    id: 'exotic_alloys',
    name: 'Exotische Legierungen',
    icon: '🛸',
    desc: 'Aus dem Fund im Schrott wurde eine Werkstoffklasse. +20 % Ausbeute pro Stufe.',
    branch: 'Materialkunde',
    maxLevel: 3,
    cost: { points: 140, money: 40_000_000, materials: [{ material: 'palladium', amount: 300 }] },
    costGrowth: 3,
    duration: 900,
    secret: true,
    requires: { progress: { collectible: 'meteorite' } },
    perLevel: [
      { kind: 'yield', factor: 1.2 },
      { kind: 'quality', amount: 0.08 },
    ],
  },

  // ===========================================================================
  // Robotik — Greifarme, Wartung, Sortierung, Schweißen, Drohnen
  // ===========================================================================
  {
    id: 'robotics',
    name: 'Robotik',
    icon: '🤖',
    desc: 'Der Weg zur Roboterhalle. Jede Stufe +7 % Zerlegeleistung.',
    branch: 'Robotik',
    maxLevel: 5,
    cost: { points: 6, money: 120_000, materials: [{ material: 'ecu', amount: 20 }] },
    costGrowth: 2.2,
    duration: 180,
    requires: { level: 12 },
    perLevel: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.07 }],
    milestones: [
      {
        level: 2,
        desc: 'Greifarme: schaltet Greifarm und Sortierroboter im Ausbau frei.',
        effects: [{ kind: 'unlock', id: 'robots' }],
      },
      {
        level: 3,
        desc: 'Wartungsroboter: hält die Anlagen von allein instand.',
        effects: [{ kind: 'autoService', amount: 0.006 }],
      },
      {
        level: 5,
        desc: 'KI-Unterstützung: +25 % Sortierdurchsatz und Transportdrohnen.',
        effects: [
          { kind: 'multiplier', target: 'autoSell', factor: 1.25 },
          { kind: 'unlock', id: 'drones' },
        ],
      },
    ],
  },
  {
    id: 'welding_robots',
    name: 'Schweißroboter',
    icon: '⚡',
    desc: 'Zerlegte Baugruppen werden vor Ort getrennt. Jede Stufe +11 % Zerlegeleistung.',
    branch: 'Robotik',
    maxLevel: 5,
    cost: { points: 14, money: 700_000, materials: [{ material: 'sensor', amount: 60 }] },
    costGrowth: 2.4,
    duration: 300,
    requires: { tech: [{ id: 'robotics', level: 3 }] },
    perLevel: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.11 }],
  },
  {
    id: 'autonomous_factory',
    name: 'Autonome Fabrik',
    icon: '🏗️',
    desc: 'Nur für Unternehmer mit Erfahrung: der Hof läuft ohne Aufsicht weiter.',
    branch: 'Robotik',
    maxLevel: 3,
    cost: { points: 120, money: 25_000_000 },
    costGrowth: 2.8,
    duration: 720,
    secret: true,
    requires: { progress: { prestigeRuns: 3 } },
    perLevel: [
      { kind: 'multiplier', target: 'teardownRate', factor: 1.22 },
      { kind: 'multiplier', target: 'autoSell', factor: 1.22 },
      { kind: 'offlineHours', amount: 2 },
    ],
    milestones: [
      {
        level: 1,
        desc: 'Der Hof arbeitet offline mit voller statt gedrosselter Leistung.',
        effects: [{ kind: 'multiplier', target: 'offlineRate', factor: 1.6 }],
      },
    ],
  },

  // ===========================================================================
  // KI — Marktanalyse, Produktionsplanung, Lagerverwaltung, Prognosen
  // ===========================================================================
  {
    id: 'market_ai',
    name: 'Marktanalyse-KI',
    icon: '📈',
    desc: 'Jede Stufe +14 % Verkaufspreis. Der Markt wird lesbar.',
    branch: 'KI',
    maxLevel: 5,
    cost: { points: 10, money: 400_000, materials: [{ material: 'cpu', amount: 15 }] },
    costGrowth: 2.3,
    duration: 240,
    requires: { level: 15 },
    perLevel: [{ kind: 'multiplier', target: 'sellPrice', factor: 1.14 }],
    milestones: [
      {
        level: 2,
        desc: 'Preisprognose: der Markt zeigt an, wohin sich ein Preis bewegt.',
        effects: [{ kind: 'unlock', id: 'price_forecast' }],
      },
      {
        level: 4,
        desc: 'Automatische Lagerverwaltung: +2 Vertragsplätze.',
        effects: [{ kind: 'contractSlots', amount: 2 }],
      },
    ],
  },
  {
    id: 'ai_control',
    name: 'KI-Steuerung',
    icon: '🎛️',
    desc: 'Schaltet die KI-Zerlegelinie frei. Jede Stufe +16 % Zerlegeleistung.',
    branch: 'KI',
    maxLevel: 5,
    cost: { points: 40, money: 4_800_000, materials: [{ material: 'cpu', amount: 60 }] },
    costGrowth: 2.5,
    duration: 420,
    requires: { tech: [{ id: 'market_ai', level: 1 }], level: 18 },
    perLevel: [{ kind: 'multiplier', target: 'teardownRate', factor: 1.16 }],
    milestones: [
      {
        level: 1,
        desc: 'Die KI-Zerlegelinie und die Inspektionsdrohne werden baubar.',
        effects: [{ kind: 'unlock', id: 'ai_line' }],
      },
    ],
  },

  {
    id: 'production_ai',
    name: 'Intelligente Produktionsplanung',
    icon: '🧠',
    desc: 'Jede Stufe +16 % Verarbeitung und +10 % Ankauf.',
    branch: 'KI',
    maxLevel: 5,
    cost: { points: 18, money: 1_400_000, materials: [{ material: 'control_unit', amount: 25 }] },
    costGrowth: 2.4,
    duration: 360,
    requires: { tech: [{ id: 'market_ai', level: 2 }] },
    perLevel: [
      { kind: 'multiplier', target: 'processSpeed', factor: 1.16 },
      { kind: 'multiplier', target: 'autoBuy', factor: 1.1 },
    ],
  },
  {
    id: 'self_optimising',
    name: 'Selbstoptimierende Fabrik',
    icon: '♾️',
    desc: 'Die Anlage justiert sich selbst nach. Jede Stufe wirkt auf alles.',
    branch: 'KI',
    maxLevel: 5,
    cost: { points: 60, money: 9_000_000, materials: [{ material: 'circuit_board', amount: 120 }] },
    costGrowth: 2.6,
    duration: 600,
    requires: { tech: [{ id: 'production_ai', level: 3 }], level: 26 },
    perLevel: [
      { kind: 'multiplier', target: 'teardownRate', factor: 1.13 },
      { kind: 'multiplier', target: 'processSpeed', factor: 1.13 },
      { kind: 'multiplier', target: 'autoSell', factor: 1.13 },
    ],
  },
  {
    id: 'industry_5',
    name: 'Industrie 5.0',
    icon: '🌐',
    desc: '5.000 zerlegte Fahrzeuge später ist der Hof eine Referenzanlage.',
    branch: 'KI',
    maxLevel: 3,
    cost: { points: 100, money: 30_000_000 },
    costGrowth: 2.8,
    duration: 720,
    secret: true,
    requires: { progress: { vehiclesDone: 5_000 } },
    perLevel: [
      { kind: 'multiplier', target: 'sellPrice', factor: 1.2 },
      { kind: 'multiplier', target: 'researchPoints', factor: 1.3 },
    ],
  },

  // ===========================================================================
  // Energie — Solar, Wind, Biogas, Wasserstoff, Fusion
  // ===========================================================================
  {
    id: 'renewables',
    name: 'Erneuerbare Energien',
    icon: '🌞',
    desc: 'Jede Stufe +900 kW aus eigener Erzeugung.',
    branch: 'Energie',
    maxLevel: 5,
    cost: { points: 4, money: 80_000 },
    costGrowth: 2.1,
    duration: 120,
    perLevel: [{ kind: 'power', amount: 900 }],
    milestones: [
      {
        level: 2,
        desc: 'Solar- und Windpark werden im Ausbau baubar.',
        effects: [{ kind: 'unlock', id: 'renewable_plants' }],
      },
      {
        level: 4,
        desc: 'Biogas aus Reststoffen: −20 % Stromverbrauch im ganzen Hof.',
        effects: [{ kind: 'multiplier', target: 'powerUse', factor: 0.8 }],
      },
    ],
  },
  {
    id: 'hydrogen',
    name: 'Wasserstoffspeicher',
    icon: '💨',
    desc: 'Jede Stufe +6.000 kW und ein ruhigeres Netz.',
    branch: 'Energie',
    maxLevel: 5,
    cost: { points: 20, money: 2_200_000, materials: [{ material: 'platinum', amount: 40 }] },
    costGrowth: 2.4,
    duration: 300,
    requires: { tech: [{ id: 'renewables', level: 3 }] },
    perLevel: [{ kind: 'power', amount: 6_000 }],
  },
  {
    id: 'fusion',
    name: 'Fusionsreaktor',
    icon: '☢️',
    desc: 'Endgame-Energie. Jede Stufe +250.000 kW.',
    branch: 'Energie',
    maxLevel: 3,
    cost: { points: 150, money: 80_000_000, materials: [{ material: 'titanium', amount: 2_000 }] },
    costGrowth: 3,
    duration: 900,
    requires: { tech: [{ id: 'hydrogen', level: 4 }], level: 30 },
    perLevel: [{ kind: 'power', amount: 250_000 }],
    milestones: [
      {
        level: 1,
        desc: 'Strom ist kein Thema mehr: −60 % Verbrauch aller Anlagen.',
        effects: [{ kind: 'multiplier', target: 'powerUse', factor: 0.4 }],
      },
    ],
  },

  // ===========================================================================
  // Logistik — Lieferzeiten, Tempo, Lager, Routen
  // ===========================================================================
  {
    id: 'supply_chain',
    name: 'Lieferketten',
    icon: '🚚',
    desc: 'Jede Stufe +18 % Ankauf und −5 % Einkaufspreis.',
    branch: 'Logistik',
    maxLevel: 5,
    cost: { points: 3, money: 12_000 },
    costGrowth: 2.1,
    duration: 90,
    perLevel: [
      { kind: 'multiplier', target: 'autoBuy', factor: 1.18 },
      { kind: 'multiplier', target: 'buyPrice', factor: 0.95 },
    ],
  },
  {
    id: 'warehousing',
    name: 'Lagertechnik',
    icon: '📦',
    desc: 'Jede Stufe +30 % Lagerplatz.',
    branch: 'Logistik',
    maxLevel: 5,
    cost: { points: 4, money: 55_000 },
    costGrowth: 2.15,
    duration: 105,
    perLevel: [{ kind: 'multiplier', target: 'storage', factor: 1.3 }],
    milestones: [
      {
        level: 3,
        desc: 'Hochregallager: +1 Stellplatz für Lieferungen.',
        effects: [{ kind: 'queueSlots', amount: 1 }],
      },
    ],
  },
  {
    id: 'route_planning',
    name: 'Routenplanung',
    icon: '🗺️',
    desc: 'Jede Stufe +15 % Verkaufsdurchsatz. Der Fuhrpark steht seltener.',
    branch: 'Logistik',
    maxLevel: 5,
    cost: { points: 9, money: 320_000 },
    costGrowth: 2.3,
    duration: 200,
    requires: { tech: [{ id: 'supply_chain', level: 2 }] },
    perLevel: [{ kind: 'multiplier', target: 'autoSell', factor: 1.15 }],
    milestones: [
      {
        level: 4,
        desc: 'Internationaler Handel: +1 Vertragsplatz und +20 % Prämien.',
        effects: [
          { kind: 'contractSlots', amount: 1 },
          { kind: 'multiplier', target: 'contractReward', factor: 1.2 },
        ],
      },
    ],
  },

  // ===========================================================================
  // Personal — Motivation, Produktivität, Weiterbildung, Gehalt
  // ===========================================================================
  {
    id: 'training',
    name: 'Weiterbildung',
    icon: '📚',
    desc: 'Jede Stufe +12 % Mitarbeiterleistung und +15 % Erfahrung.',
    branch: 'Personal',
    maxLevel: 5,
    cost: { points: 4, money: 45_000 },
    costGrowth: 2.1,
    duration: 120,
    perLevel: [
      { kind: 'multiplier', target: 'staffProductivity', factor: 1.12 },
      { kind: 'multiplier', target: 'xpGain', factor: 1.15 },
    ],
  },
  {
    id: 'motivation',
    name: 'Betriebsklima',
    icon: '🎯',
    desc: 'Jede Stufe −8 % Lohnkosten bei gleicher Leistung.',
    branch: 'Personal',
    maxLevel: 5,
    cost: { points: 7, money: 180_000 },
    costGrowth: 2.2,
    duration: 165,
    requires: { tech: [{ id: 'training', level: 2 }] },
    perLevel: [{ kind: 'multiplier', target: 'salary', factor: 0.92 }],
    milestones: [
      {
        level: 5,
        desc: 'Beteiligungsmodell: +30 % Mitarbeiterleistung obendrauf.',
        effects: [{ kind: 'multiplier', target: 'staffProductivity', factor: 1.3 }],
      },
    ],
  },
  {
    id: 'lab_staff',
    name: 'Forschungsabteilung',
    icon: '🔬',
    desc: 'Jede Stufe +45 % Forschungspunkte und +12 % Forschungstempo.',
    branch: 'Personal',
    maxLevel: 5,
    cost: { points: 6, money: 140_000 },
    costGrowth: 2.25,
    duration: 150,
    perLevel: [
      { kind: 'multiplier', target: 'researchPoints', factor: 1.45 },
      { kind: 'multiplier', target: 'researchSpeed', factor: 1.12 },
    ],
  },

  // ===========================================================================
  // Umwelttechnik — Emissionen, Strom, Abfall, Image, Fördergelder
  // ===========================================================================
  {
    id: 'emissions',
    name: 'Emissionsminderung',
    icon: '🌿',
    desc: 'Jede Stufe −12 % Stromverbrauch und +8 % Verkaufspreis durch das Image.',
    branch: 'Umwelttechnik',
    maxLevel: 5,
    cost: { points: 5, money: 90_000 },
    costGrowth: 2.15,
    duration: 135,
    perLevel: [
      { kind: 'multiplier', target: 'powerUse', factor: 0.88 },
      { kind: 'multiplier', target: 'sellPrice', factor: 1.08 },
    ],
  },
  {
    id: 'zero_waste',
    name: 'Abfallfreie Anlage',
    icon: '♻️',
    desc: 'Jede Stufe +14 % Ausbeute — was früher Rest war, ist jetzt Ware.',
    branch: 'Umwelttechnik',
    maxLevel: 5,
    cost: { points: 12, money: 500_000 },
    costGrowth: 2.35,
    duration: 240,
    requires: { tech: [{ id: 'emissions', level: 3 }] },
    perLevel: [{ kind: 'yield', factor: 1.14 }],
  },
  {
    id: 'subsidies',
    name: 'Fördermittel',
    icon: '🏅',
    desc: 'Ein gutes Image zahlt sich aus: jede Stufe +18 % Vertragsprämien.',
    branch: 'Umwelttechnik',
    maxLevel: 5,
    cost: { points: 16, money: 900_000 },
    costGrowth: 2.4,
    duration: 270,
    requires: { tech: [{ id: 'emissions', level: 2 }] },
    perLevel: [{ kind: 'multiplier', target: 'contractReward', factor: 1.18 }],
    milestones: [
      {
        level: 3,
        desc: 'Anerkannter Entsorgungsfachbetrieb: +1 Vertragsplatz.',
        effects: [{ kind: 'contractSlots', amount: 1 }],
      },
    ],
  },
];
