/**
 * Help, hints and the mentor (GDD chapter 10).
 *
 * Three separate things that are often confused:
 *
 *   Enzyklopädie  a reference the player opens on purpose. Its chapters are
 *                 discovery-gated - an entry that appears before the thing
 *                 exists is a spoiler, not help.
 *   Hinweise      short, contextual, at most once each, switchable off.
 *   Mentor        a voice, not a system. Friendly, competent, terse.
 */

/** A chapter of the encyclopedia. Most are generated from live content. */
export interface HelpChapter {
  id: string;
  name: string;
  icon: string;
  /** Where the entries come from. `faq` is hand-written. */
  source: 'machines' | 'materials' | 'research' | 'buildings' | 'roles' | 'tools' | 'vehicles' | 'faq';
  /**
   * Unlock flag the chapter waits for, granted by a mission reward. Without
   * one the chapter is open from the start.
   */
  flag?: string;
}

export const HELP_CHAPTERS: HelpChapter[] = [
  { id: 'help_basics', name: 'Grundlagen', icon: '📘', source: 'faq' },
  { id: 'help_materials', name: 'Materialien', icon: '🧱', source: 'materials', flag: 'help_materials' },
  { id: 'help_tools', name: 'Werkzeuge', icon: '🔧', source: 'tools', flag: 'help_tools' },
  { id: 'help_buildings', name: 'Gebäude', icon: '🏬', source: 'buildings', flag: 'help_buildings' },
  { id: 'help_machines', name: 'Maschinen', icon: '⚙️', source: 'machines', flag: 'help_machines' },
  { id: 'help_roles', name: 'Mitarbeiterrollen', icon: '👷', source: 'roles', flag: 'help_staff' },
  { id: 'help_vehicles', name: 'Fahrzeuge', icon: '🚗', source: 'vehicles' },
  { id: 'help_research', name: 'Forschung', icon: '🔬', source: 'research', flag: 'help_research' },
];

/** Hand-written questions. Everything else is generated from the content. */
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  /** Only shown once the player could plausibly ask it. */
  flag?: string;
}

export const FAQ: FaqEntry[] = [
  {
    id: 'faq_loop',
    question: 'Wie verdiene ich Geld?',
    answer:
      'Zerlegen, verkaufen, nachkaufen. Jedes Teil, das du löst, wird zu Material; Material wird im Lager zu Geld; Geld wird zur nächsten Lieferung. Alles andere im Spiel macht diesen Kreis nur schneller.',
  },
  {
    id: 'faq_offline',
    question: 'Läuft der Hof weiter, wenn ich das Spiel schließe?',
    answer:
      'Ja. Maschinen und Mitarbeiter arbeiten offline weiter, mit gedrosselter Leistung und bis zu zwölf Stunden lang. Beim Zurückkommen bekommst du eine Abrechnung.',
  },
  {
    id: 'faq_storage',
    question: 'Was passiert, wenn mein Lager voll ist?',
    answer:
      'Nichts geht verloren. Der Überschuss wird sofort als Notverkauf abgestoßen — allerdings mit Abschlag. Größeres Lager lohnt sich also, ist aber nie Pflicht.',
  },
  {
    id: 'faq_power',
    question: 'Warum arbeiten meine Maschinen langsamer?',
    answer:
      'Entweder fehlt Strom oder der Verschleiß ist hoch. Beides ist ein Effizienzfaktor, kein Stopp: unterversorgt läuft der Hof mit mindestens 40 %, völlig verschlissen mit 60 %.',
  },
  {
    id: 'faq_quality',
    question: 'Wofür ist die Materialqualität gut?',
    answer:
      'Hochwertiges Material bringt beim Verkauf mehr. Bessere Maschinen und die Forschung heben den Durchschnitt deines Hofes.',
  },
  {
    id: 'faq_hazard',
    question: 'Warum kostet Motoröl Geld?',
    answer:
      'Betriebsstoffe müssen fachgerecht entsorgt werden. Die Forschung „Flüssigkeitsrecycling" macht aus dem Kostenfaktor ein Produkt.',
    flag: 'help_materials',
  },
  {
    id: 'faq_research',
    question: 'Kann ich Forschungspunkte kaufen?',
    answer:
      'Nein. Punkte entstehen im Labor, mit der Zeit und mit dem Personal. Geld beschleunigt die Forschung, ersetzt sie aber nicht.',
    flag: 'help_research',
  },
  {
    id: 'faq_prestige',
    question: 'Was verliere ich bei einer Neugründung?',
    answer:
      'Geld, Anlagen, Lager und Level. Du behältst Industriepunkte, den Prestige-Baum, alle Erfolge, entdeckte Fahrzeuge, deine Einstellungen und die Karrierezähler.',
    flag: 'help_prestige',
  },
  {
    id: 'faq_missions',
    question: 'Kann ich eine Mission verpassen?',
    answer:
      'Haupt- und Nebenmissionen laufen nie ab. Tägliche und wöchentliche Missionen werden ersetzt, wenn der Zeitraum vorbei ist — verlieren kannst du dabei nichts.',
  },
  {
    id: 'faq_hints',
    question: 'Wie schalte ich Hinweise und den Mentor ab?',
    answer: 'In den Einstellungen unter „Spielerführung". Beide lassen sich einzeln abschalten.',
  },
];

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

/**
 * A contextual hint. `when` is evaluated a few times a second; the first time
 * it is true the hint appears, and then never again.
 *
 * They are worded as observations, not instructions - the chapter asks for
 * guidance without patronising, and "Dein Lager ist fast voll" respects the
 * player more than "Du solltest jetzt…".
 */
export interface HintDef {
  id: string;
  icon: string;
  text: string;
  /** Screen the hint offers to open. */
  screen?: string;
}

export const HINTS: HintDef[] = [
  { id: 'hint_queue', icon: '🅿️', text: 'Die Zerlegebühne ist leer. Im Ankauf wartet die nächste Lieferung.', screen: 'market' },
  { id: 'hint_storage', icon: '📦', text: 'Dein Lager ist fast voll. Verkaufen oder ausbauen — beides hilft.', screen: 'storage' },
  { id: 'hint_money', icon: '💶', text: 'Auf dem Konto liegt mehr, als der Hof braucht. Im Ausbau wird daraus Leistung.', screen: 'build' },
  { id: 'hint_wear', icon: '🛠️', text: 'Deine Maschinen sind verschlissen. Eine Wartung bringt die volle Leistung zurück.', screen: 'build' },
  { id: 'hint_power', icon: '⚡', text: 'Das Netz ist überlastet. Ein Generator hebt die Leistung des ganzen Hofes.', screen: 'build' },
  { id: 'hint_staff', icon: '👷', text: 'Mitarbeiter arbeiten weiter, während du woanders bist.', screen: 'staff' },
  { id: 'hint_contract', icon: '🤝', text: 'Ein Auftrag wartet auf Annahme. Verträge zahlen auch nach der Lieferung weiter.', screen: 'trade' },
  { id: 'hint_research', icon: '🔬', text: 'Im Labor ist ein Projektplatz frei. Ein leerer Platz forscht nichts.', screen: 'research' },
  { id: 'hint_arrears', icon: '💸', text: 'Löhne sind offen. Verkaufe Material, sonst arbeitet die Belegschaft langsamer.', screen: 'storage' },
  { id: 'hint_prestige', icon: '🏆', text: 'Eine Neugründung ist möglich. Was du behältst, macht den nächsten Anlauf schneller.', screen: 'stats' },
];

// ---------------------------------------------------------------------------
// Mentor
// ---------------------------------------------------------------------------

/**
 * The mentor's lines (GDD chapter 10: "freundlich, kompetent, kurz").
 *
 * Keyed by occasion. Several variants per occasion so a returning player does
 * not hear the same sentence twice in a row.
 */
export const MENTOR: Record<string, string[]> = {
  welcome: [
    'Der Hof gehört dir. Fang mit dem an, was da steht.',
    'Willkommen. Der Kleinwagen wartet nicht von allein auf seine Einzelteile.',
  ],
  missionDone: [
    'Sauber. Weiter so.',
    'Erledigt — der Hof wächst.',
    'Gut gemacht. Das nächste liegt schon an.',
  ],
  levelUp: ['Neues Level, neue Möglichkeiten.', 'Der Betrieb wird größer. Schau in den Ausbau.'],
  milestone: ['Das war ein großer Schritt.', 'Solche Zahlen schreibt man sich auf.'],
  idle: [
    'Nichts läuft gerade. Ein bisschen Nachschub würde helfen.',
    'Der Hof steht still — das kostet mehr als es aussieht.',
  ],
  returning: ['Willkommen zurück. Hier ist, was gelaufen ist.', 'Da bist du wieder. Der Laden lief weiter.'],
};
