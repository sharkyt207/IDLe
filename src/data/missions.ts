import type { MilestoneDef, MissionDef } from './types';

/**
 * Missions and milestones (GDD chapter 10).
 *
 * Four kinds, one shape:
 *
 *   Tutorial  five hand-written steps that teach the loop, in order.
 *   Haupt     the long chain - "der rote Faden durch das Spiel".
 *   Neben     optional, unordered, always something to pick up.
 *   Täglich   / Wöchentlich: pools the generator draws from and scales.
 *
 * A goal is a metric name from `src/progress/tracker.ts` plus an amount, so a
 * new mission is a data entry and never a new condition to evaluate. Rewards
 * are descriptors for the same reason.
 *
 * The first two hours are deliberately generous (GDD: "großzügig"): the early
 * rewards are large relative to what the yard earns, and none of them can be
 * failed - a mission the player ignores simply stays open.
 */

// ---------------------------------------------------------------------------
// Tutorial - the five steps the chapter names, in the order it names them
// ---------------------------------------------------------------------------

const TUTORIAL: MissionDef[] = [
  {
    id: 'tut_dismantle',
    kind: 'tutorial',
    name: 'Der erste Schrott',
    desc: 'Tippe die markierten Teile an, bis der Kleinwagen komplett zerlegt ist.',
    icon: '🔩',
    screen: 'yard',
    goal: { metric: 'vehiclesDone', amount: 1 },
    rewards: [
      { kind: 'money', amount: 250 },
      { kind: 'xp', amount: 10 },
    ],
  },
  {
    id: 'tut_sell',
    kind: 'tutorial',
    name: 'Schrott zu Geld',
    desc: 'Öffne das Lager und verkaufe deinen Eisenschrott. Nichts liegt hier umsonst herum.',
    icon: '💶',
    screen: 'storage',
    goal: { metric: 'sales', amount: 1 },
    rewards: [
      { kind: 'money', amount: 500 },
      // Opens the material chapter of the encyclopedia - the GDD's
      // "Materialübersicht wird freigeschaltet".
      { kind: 'flag', id: 'help_materials' },
    ],
  },
  {
    id: 'tut_torch',
    kind: 'tutorial',
    name: 'Besseres Werkzeug',
    desc: 'Kaufe im Ausbau den Schneidbrenner. Jedes Werkzeug macht jeden Tipp stärker.',
    icon: '🔥',
    screen: 'build',
    goal: { metric: 'ownedOf', id: 'torch', amount: 1 },
    rewards: [
      { kind: 'money', amount: 750 },
      { kind: 'flag', id: 'help_tools' },
    ],
  },
  {
    id: 'tut_workshop',
    kind: 'tutorial',
    name: 'Ein Dach über dem Hof',
    desc: 'Errichte deine erste Werkstatt. Danach kannst du Mechaniker einstellen.',
    icon: '🧰',
    screen: 'build',
    goal: { metric: 'ownedOf', id: 'workshop', amount: 1 },
    rewards: [
      { kind: 'money', amount: 1_200 },
      { kind: 'flag', id: 'help_buildings' },
    ],
  },
  {
    id: 'tut_hire',
    kind: 'tutorial',
    name: 'Chef statt Arbeiter',
    desc: 'Stelle deinen ersten Mechaniker ein. Ab jetzt läuft der Hof auch ohne deinen Daumen.',
    icon: '👷',
    screen: 'staff',
    goal: { metric: 'staffCount', amount: 1 },
    rewards: [
      { kind: 'money', amount: 2_000 },
      { kind: 'flag', id: 'help_staff' },
    ],
  },
];

/** Ids in order - the tutorial is the one mission chain that is strictly linear. */
export const TUTORIAL_MISSION_IDS = TUTORIAL.map((m) => m.id);

/** Flags the tutorial hands out. A migrated save gets them without the money. */
export const TUTORIAL_MISSION_FLAGS = TUTORIAL.flatMap((m) =>
  m.rewards.filter((r) => r.kind === 'flag').map((r) => r.id),
);

// ---------------------------------------------------------------------------
// Hauptmissionen - the through-line
// ---------------------------------------------------------------------------

const MAIN: MissionDef[] = [
  {
    id: 'main_ten_cars',
    kind: 'main',
    name: 'Zehn auf einen Streich',
    desc: 'Zerlege zehn Fahrzeuge. Ein Schrottplatz lebt vom Durchsatz, nicht vom Einzelstück.',
    icon: '🚗',
    screen: 'yard',
    after: 'tut_hire',
    goal: { metric: 'vehiclesDone', amount: 10 },
    rewards: [
      { kind: 'money', amount: 3_500 },
      { kind: 'purchasable', id: 'parking_slot' },
    ],
  },
  {
    id: 'main_automate',
    kind: 'main',
    name: 'Die erste Maschine',
    desc: 'Stelle einen Magnetkran auf. Maschinen arbeiten weiter, wenn du das Handy weglegst.',
    icon: '🏗️',
    screen: 'build',
    after: 'main_ten_cars',
    goal: { metric: 'ownedOf', id: 'magnet_crane', amount: 1 },
    rewards: [
      { kind: 'money', amount: 6_000 },
      { kind: 'flag', id: 'help_machines' },
    ],
  },
  {
    id: 'main_supply',
    kind: 'main',
    name: 'Nachschub organisieren',
    desc: 'Kaufe zehn Lieferungen an. Ein leerer Hof verdient nichts.',
    icon: '🚚',
    screen: 'market',
    after: 'main_automate',
    goal: { metric: 'purchases', amount: 10 },
    rewards: [
      { kind: 'money', amount: 9_000 },
      { kind: 'vehicle', id: 'limousine', count: 2 },
    ],
  },
  {
    id: 'main_first_contract',
    kind: 'main',
    name: 'Erster Stammkunde',
    desc: 'Beliefere einen Auftraggeber vollständig. Verträge zahlen weiter, auch nach der Lieferung.',
    icon: '🤝',
    screen: 'trade',
    after: 'main_supply',
    goal: { metric: 'contractsDone', amount: 1 },
    rewards: [
      { kind: 'money', amount: 15_000 },
      { kind: 'flag', id: 'help_trade' },
    ],
  },
  {
    id: 'main_hundred_k',
    kind: 'main',
    name: 'Sechsstellig',
    desc: 'Bring deinen Firmenwert auf 100.000 €.',
    icon: '🏢',
    screen: 'stats',
    after: 'main_first_contract',
    goal: { metric: 'companyValue', amount: 100_000 },
    rewards: [
      { kind: 'money', amount: 30_000 },
      { kind: 'purchasable', id: 'decor_sign' },
    ],
  },
  {
    id: 'main_smeltery',
    kind: 'main',
    name: 'Eigene Verarbeitung',
    desc: 'Baue die Schmelzerei. Wer selbst veredelt, verkauft nicht mehr nur Schrott.',
    icon: '🏭',
    screen: 'build',
    after: 'main_hundred_k',
    goal: { metric: 'ownedOf', id: 'smeltery', amount: 1 },
    rewards: [
      { kind: 'money', amount: 40_000 },
      { kind: 'material', material: 'steel', amount: 400 },
    ],
  },
  {
    id: 'main_lab',
    kind: 'main',
    name: 'Forschung aufbauen',
    desc: 'Errichte das Forschungslabor und schalte den Technologiebaum frei.',
    icon: '🔬',
    screen: 'research',
    after: 'main_smeltery',
    goal: { metric: 'ownedOf', id: 'lab', amount: 1 },
    rewards: [
      { kind: 'research', amount: 250 },
      { kind: 'flag', id: 'help_research' },
    ],
  },
  {
    id: 'main_tech_ten',
    kind: 'main',
    name: 'Technologievorsprung',
    desc: 'Erforsche zehn Technologiestufen.',
    icon: '🧪',
    screen: 'research',
    after: 'main_lab',
    goal: { metric: 'techLevels', amount: 10 },
    rewards: [
      { kind: 'research', amount: 800 },
      { kind: 'money', amount: 120_000 },
    ],
  },
  {
    id: 'main_million',
    kind: 'main',
    name: 'Die erste Million',
    desc: 'Bring deinen Firmenwert auf 1.000.000 €.',
    icon: '💎',
    screen: 'stats',
    after: 'main_tech_ten',
    goal: { metric: 'companyValue', amount: 1_000_000 },
    rewards: [
      { kind: 'money', amount: 250_000 },
      { kind: 'crate', tier: 2 },
    ],
  },
  {
    id: 'main_robot',
    kind: 'main',
    name: 'Vollautomatisch',
    desc: 'Setze einen Zerlegeroboter ein. Ab hier bist du wirklich nur noch Chef.',
    icon: '🤖',
    screen: 'build',
    after: 'main_million',
    goal: { metric: 'ownedOf', id: 'teardown_robot', amount: 1 },
    rewards: [
      { kind: 'money', amount: 600_000 },
      { kind: 'flag', id: 'help_automation' },
    ],
  },
  {
    id: 'main_ten_million',
    kind: 'main',
    name: 'Industriebetrieb',
    desc: 'Bring deinen Firmenwert auf 10.000.000 €.',
    icon: '🏗️',
    screen: 'stats',
    after: 'main_robot',
    goal: { metric: 'companyValue', amount: 10_000_000 },
    rewards: [
      { kind: 'money', amount: 2_000_000 },
      { kind: 'industry', amount: 3 },
    ],
  },
  {
    id: 'main_prestige',
    kind: 'main',
    name: 'Ein neues Unternehmen',
    desc: 'Gründe dein Unternehmen neu. Was du gelernt hast, nimmst du mit.',
    icon: '🏆',
    screen: 'stats',
    after: 'main_ten_million',
    goal: { metric: 'prestigeRuns', amount: 1 },
    rewards: [
      { kind: 'industry', amount: 10 },
      { kind: 'flag', id: 'help_prestige' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Nebenmissionen - optional, unordered, no chain
// ---------------------------------------------------------------------------

const SIDE: MissionDef[] = [
  {
    id: 'side_collector',
    kind: 'side',
    name: 'Erster Fund',
    desc: 'Finde ein Sammlerstück beim Zerlegen. Manche Autos haben ein Geheimnis.',
    icon: '🏺',
    screen: 'stats',
    goal: { metric: 'collectibles', amount: 1 },
    rewards: [{ kind: 'money', amount: 2_500 }],
  },
  {
    id: 'side_auction',
    kind: 'side',
    name: 'Zuschlag',
    desc: 'Gewinne eine Auktion. Wer die Konkurrenz kennt, zahlt weniger.',
    icon: '🔨',
    screen: 'trade',
    requires: { level: 4 },
    goal: { metric: 'auctionsWon', amount: 1 },
    rewards: [
      { kind: 'money', amount: 8_000 },
      { kind: 'flag', id: 'help_auctions' },
    ],
  },
  {
    id: 'side_variety',
    kind: 'side',
    name: 'Alles kommt vorbei',
    desc: 'Zerlege fünf verschiedene Fahrzeugtypen.',
    icon: '🚙',
    screen: 'market',
    requires: { level: 5 },
    goal: { metric: 'vehicleTypes', amount: 5 },
    rewards: [
      { kind: 'money', amount: 12_000 },
      { kind: 'crate', tier: 1 },
    ],
  },
  {
    id: 'side_storage',
    kind: 'side',
    name: 'Platz schaffen',
    desc: 'Bring dein Lager auf 2.000 Plätze. Voll ist die teuerste Lagergröße.',
    icon: '📦',
    screen: 'build',
    requires: { level: 6 },
    goal: { metric: 'storageCapacity', amount: 2_000 },
    rewards: [{ kind: 'money', amount: 20_000 }],
  },
  {
    id: 'side_team',
    kind: 'side',
    name: 'Eine echte Belegschaft',
    desc: 'Beschäftige zehn Mitarbeiter.',
    icon: '👥',
    screen: 'staff',
    requires: { level: 7 },
    goal: { metric: 'staffCount', amount: 10 },
    rewards: [
      { kind: 'money', amount: 45_000 },
      { kind: 'flag', id: 'help_roles' },
    ],
  },
  {
    id: 'side_decor',
    kind: 'side',
    name: 'Vorzeigehof',
    desc: 'Stelle fünf Dekorationen auf. Ein Hof, den man gern betritt, ist auch etwas wert.',
    icon: '🌳',
    screen: 'build',
    requires: { level: 8 },
    goal: { metric: 'decorCount', amount: 5 },
    rewards: [
      { kind: 'money', amount: 60_000 },
      { kind: 'purchasable', id: 'decor_flag' },
    ],
  },
  {
    id: 'side_master',
    kind: 'side',
    name: 'Handwerksmeister',
    desc: 'Bring eine einzelne Maschine auf die Endstufe 10.',
    icon: '⚙️',
    screen: 'build',
    requires: { level: 10 },
    goal: { metric: 'maxMachineLevel', amount: 10 },
    rewards: [
      { kind: 'money', amount: 150_000 },
      { kind: 'crate', tier: 2 },
    ],
  },
  {
    id: 'side_veteran',
    kind: 'side',
    name: 'Tausend Wracks',
    desc: 'Zerlege 1.000 Fahrzeuge im Laufe deiner Karriere.',
    icon: '🏅',
    screen: 'stats',
    requires: { level: 12 },
    goal: { metric: 'vehiclesDone', amount: 1_000 },
    rewards: [
      { kind: 'industry', amount: 2 },
      { kind: 'crate', tier: 3 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Daily & weekly pools
//
// `levelScale` keeps a daily meaningful at level 30 without making it
// impossible at level 3: the amount grows with the company that has to do it.
// ---------------------------------------------------------------------------

const DAILY: MissionDef[] = [
  {
    id: 'daily_vehicles',
    kind: 'daily',
    name: 'Tagespensum',
    desc: 'Zerlege heute {amount} Fahrzeuge.',
    icon: '🚗',
    screen: 'yard',
    weight: 3,
    requires: { level: 4 },
    levelScale: 0.55,
    goal: { metric: 'runVehicles', amount: 12 },
    rewards: [
      { kind: 'money', amount: 5_000 },
      { kind: 'crate', tier: 1 },
    ],
  },
  {
    id: 'daily_earn',
    kind: 'daily',
    name: 'Tagesumsatz',
    desc: 'Verdiene heute {amount}.',
    icon: '💶',
    screen: 'market',
    weight: 3,
    requires: { level: 4 },
    scaleBy: 'company',
    levelScale: 0.35,
    goal: { metric: 'runEarned', amount: 25_000 },
    rewards: [{ kind: 'crate', tier: 2 }],
  },
  {
    id: 'daily_contracts',
    kind: 'daily',
    name: 'Kundschaft',
    desc: 'Erfülle heute {amount} Aufträge.',
    icon: '🤝',
    screen: 'trade',
    weight: 2,
    requires: { level: 4 },
    levelScale: 0.08,
    goal: { metric: 'runContracts', amount: 2 },
    rewards: [
      { kind: 'money', amount: 12_000 },
      { kind: 'crate', tier: 1 },
    ],
  },
  {
    id: 'daily_research',
    kind: 'daily',
    name: 'Laborschicht',
    desc: 'Schließe heute {amount} Technologiestufen ab.',
    icon: '🔬',
    screen: 'research',
    weight: 2,
    requires: { owned: [{ id: 'lab' }] },
    levelScale: 0.05,
    goal: { metric: 'runResearch', amount: 2 },
    rewards: [
      { kind: 'research', amount: 400 },
      { kind: 'crate', tier: 2 },
    ],
  },
  {
    id: 'daily_auction',
    kind: 'daily',
    name: 'Unter dem Hammer',
    desc: 'Gewinne heute {amount} Auktion(en).',
    icon: '🔨',
    screen: 'trade',
    weight: 1,
    requires: { level: 6 },
    goal: { metric: 'runAuctions', amount: 1 },
    rewards: [{ kind: 'crate', tier: 2 }],
  },
  {
    id: 'daily_steel',
    kind: 'daily',
    name: 'Stahlquote',
    desc: 'Gewinne heute {amount} Einheiten Stahl.',
    icon: '⚙️',
    screen: 'storage',
    weight: 2,
    requires: { level: 4 },
    levelScale: 1.1,
    goal: { metric: 'runMaterial', material: 'steel', amount: 900 },
    rewards: [
      { kind: 'money', amount: 9_000 },
      { kind: 'crate', tier: 1 },
    ],
  },
];

const WEEKLY: MissionDef[] = [
  {
    id: 'weekly_vehicles',
    kind: 'weekly',
    name: 'Wochenleistung',
    desc: 'Zerlege diese Woche {amount} Fahrzeuge.',
    icon: '🏭',
    screen: 'yard',
    weight: 3,
    requires: { level: 5 },
    levelScale: 0.6,
    goal: { metric: 'runVehicles', amount: 120 },
    rewards: [
      { kind: 'industry', amount: 1 },
      { kind: 'crate', tier: 3 },
    ],
  },
  {
    id: 'weekly_earn',
    kind: 'weekly',
    name: 'Wochenumsatz',
    desc: 'Verdiene diese Woche {amount}.',
    icon: '📈',
    screen: 'stats',
    weight: 3,
    requires: { level: 5 },
    scaleBy: 'company',
    levelScale: 2,
    goal: { metric: 'runEarned', amount: 400_000 },
    rewards: [
      { kind: 'industry', amount: 1 },
      { kind: 'crate', tier: 3 },
    ],
  },
  {
    id: 'weekly_contracts',
    kind: 'weekly',
    name: 'Volle Auftragsbücher',
    desc: 'Erfülle diese Woche {amount} Aufträge.',
    icon: '📋',
    screen: 'trade',
    weight: 2,
    requires: { level: 5 },
    levelScale: 0.12,
    goal: { metric: 'runContracts', amount: 10 },
    rewards: [
      { kind: 'industry', amount: 2 },
      { kind: 'crate', tier: 2 },
    ],
  },
  {
    id: 'weekly_research',
    kind: 'weekly',
    name: 'Forschungswoche',
    desc: 'Schließe diese Woche {amount} Technologiestufen ab.',
    icon: '🧪',
    screen: 'research',
    weight: 2,
    requires: { owned: [{ id: 'lab' }] },
    levelScale: 0.08,
    goal: { metric: 'runResearch', amount: 8 },
    rewards: [
      { kind: 'research', amount: 2_500 },
      { kind: 'industry', amount: 1 },
    ],
  },
];

export const MISSIONS: MissionDef[] = [...TUTORIAL, ...MAIN, ...SIDE, ...DAILY, ...WEEKLY];

// ---------------------------------------------------------------------------
// Milestones - the four the chapter names, plus the two that bracket them
// ---------------------------------------------------------------------------

/**
 * Company-value milestones (GDD chapter 10).
 *
 * These are not missions: they are never accepted, never listed as a task and
 * never missed. They fire when the company crosses a number, which is what
 * makes them read as growth rather than as another checkbox.
 */
export const MILESTONES: MilestoneDef[] = [
  {
    id: 'ms_10k',
    name: 'Der Hof läuft',
    icon: '🚧',
    desc: '10.000 € Firmenwert — aus dem Hinterhof wird ein Betrieb.',
    value: 10_000,
    rewards: [{ kind: 'money', amount: 2_000 }],
  },
  {
    id: 'ms_100k',
    name: 'Neues Gebäude',
    icon: '🏬',
    desc: '100.000 € Firmenwert — die Lagerhalle geht auf Firmenkosten.',
    value: 100_000,
    rewards: [
      { kind: 'money', amount: 15_000 },
      { kind: 'material', material: 'steel', amount: 300 },
    ],
  },
  {
    id: 'ms_1m',
    name: 'Neue Fahrzeuge',
    icon: '🚛',
    desc: '1 Mio € Firmenwert — die Spedition liefert dir schwerere Wracks an.',
    value: 1_000_000,
    rewards: [
      { kind: 'vehicle', id: 'lkw', count: 3 },
      { kind: 'money', amount: 150_000 },
    ],
  },
  {
    id: 'ms_10m',
    name: 'Neue Produktionslinie',
    icon: '🏗️',
    desc: '10 Mio € Firmenwert — der Ausbau der Sortierung zahlt sich selbst.',
    value: 10_000_000,
    rewards: [
      { kind: 'money', amount: 1_200_000 },
      { kind: 'research', amount: 300 },
    ],
  },
  {
    id: 'ms_100m',
    name: 'Neugründung in Sicht',
    icon: '🏆',
    desc: '100 Mio € Firmenwert — das Prestige-System steht dir offen.',
    value: 100_000_000,
    rewards: [
      { kind: 'flag', id: 'prestige_visible' },
      { kind: 'industry', amount: 5 },
    ],
  },
  {
    id: 'ms_1b',
    name: 'Konzern',
    icon: '👑',
    desc: '1 Mrd € Firmenwert — du bist der Markt.',
    value: 1_000_000_000,
    rewards: [
      { kind: 'industry', amount: 25 },
      { kind: 'crate', tier: 3 },
    ],
  },
];

/**
 * Crate contents by tier (GDD chapter 10: "Spezialkisten mit Zufallsinhalt").
 *
 * The value band is fixed per tier and only the *contents* are random, so a
 * crate is a surprise rather than a lottery the player can lose.
 *
 * The research figures are deliberately modest. An earlier draft paid 400 and
 * 3.000 Forschungspunkte, and the headless harness showed exactly what that
 * does: the lab is the one thing money is not supposed to buy (chapter 7), and
 * a crate handing over an hour of lab output pulled the whole technology tree
 * forward by hours. A crate may nudge research; it must not fund it.
 */
export const CRATES: { tier: number; money: number; materials: string[]; research: number }[] = [
  { tier: 1, money: 4_000, materials: ['copper', 'aluminium', 'electronics'], research: 15 },
  { tier: 2, money: 40_000, materials: ['silver', 'catalyst', 'sensor', 'ecu'], research: 70 },
  { tier: 3, money: 400_000, materials: ['platinum', 'gold', 'titanium', 'cpu'], research: 280 },
];
