# Architektur

Ziel dieser Struktur ist die Vorgabe aus GDD Kapitel 1: **neue Maschinen, Gebäude und Fahrzeuge
lassen sich hinzufügen, ohne bestehende Systeme zu ändern.**

## Überblick

```
src/
  data/          Inhalte & Balancing  ← hier arbeiten Designer
    types.ts       Typdefinitionen aller Inhalte + Effekt-Deskriptoren
    balance.ts     Zentrale Stellschrauben (Start, Tickrate, Offline, Prestige …)
    economy.ts     Wirtschafts-Stellschrauben (Margen, Qualität, Markt, Verträge)
    machines.ts    Maschinenstufen, Energie, Verschleiß
    materials.ts   Materialdatenbank + Verarbeitungsrezepte
    vehicles.ts    Fahrzeugdatenbank: Klassenvorlagen, Preise werden abgeleitet
    purchasables.ts Werkzeuge, Maschinen, Mitarbeiter, Gebäude, Grundstücke, Deko
    trade.ts       Verträge, Auktionslose, Fundstücke
    lots.ts        Kartengeometrie der Grundstücke
    tech.ts        Technologiebaum: 8 Zweige, Stufen, Meilensteine
    prestige.ts    Prestige-Baum: 5 Zweige, Industriepunkte
    achievements.ts Erfolge mit Titeln und kleinen Dauerboni
    progress.ts    Forschung, Labor, Prestige-Türen, Schwierigkeitsrampe
    company.ts     Personal, Löhne, Prioritäten, Kennzahlen
    fleet.ts       Logistikfahrzeug-Klassen + Verkehrsregeln
    ui.ts          Designtokens, Paletten, Themes, Seltenheitsfarben
    index.ts       Registry + Inhalts-Validierung

  core/          Infrastruktur ohne Spiellogik (Events, Formatierung, Zufall)

  game/          Simulation, DOM-frei und damit headless testbar
    state.ts       Serialisierbarer Spielstand
    stats.ts       Leitet aus Besitz/Forschung/Prestige die abgeleiteten Werte ab
    save.ts        Versionierte Speicherstände inkl. Migration & Reparatur
    game.ts        Orchestrator: Aktionen + fester Simulationsschritt
    systems/       teardown · logistics · market · processing · maintenance · offline

  economy/       Wirtschaft (GDD Kapitel 4), unabhängig austauschbare Module
    market.ts      Preismodell: Drift, Qualität, Entsorgung, Trends
    inventory.ts   Lager mit gewichteter Qualität pro Haufen
    contracts.ts   Angebote, Annahme, Lieferung, laufendes Einkommen
    auctions.ts    Lose, Gebote, KI-Mitbieter
    collection.ts  Zufallsfunde und Vitrine
    manager.ts     Tick-Einbindung und Firmenwert

  company/       Unternehmen (GDD Kapitel 6)
    payroll.ts     Löhne, Gebäudeunterhalt, Mitarbeitererfahrung
    warehouse.ts   Lagerregeln (Mindestbestand, Sperre, Mindestpreis)
    statistics.ts  Betriebszahlen: Tag/Woche, Effizienz, CO₂

  progress/      Langzeitfortschritt (GDD Kapitel 7), einzeln testbar
    research.ts    Research Manager: Punkte, Kosten, parallele Projekte
    prestige.ts    Prestige Manager: Türen, Industriepunkte, Neustart
    achievements.ts Achievement Manager: Metriken, Titel, Belohnungen
    bonuses.ts     Permanent Bonus System: alles dauerhaft Besessene
    unlocks.ts     Unlock Manager: eine Stelle für jede Freischaltbedingung

  world/         Spielwelt (GDD Kapitel 3), unabhängig austauschbare Module
    iso.ts         Isometrische Projektion (64:36 ≈ 29,4°)
    map.ts         Gelände, Zonen, Straßen, Bauflächen, Grundstücksgrenzen
    buildings.ts   Platzierung und Ausbaustufen der Anlagen
    roads.ts       Routing-Graph: Kreuzungen, Dijkstra, Stauvermeidung
    traffic.ts     Fahrzeug-KI: Disposition, echte Wege, Kollisionsvermeidung
    logistics.ts   sichtbarer Materialfluss auf den Förderstrecken
    environment.ts Tag/Nacht-Zyklus, Wetter, Atmosphäre

  audio/         Sounddesign (GDD Kapitel 8), vollständig synthetisiert
    sound.ts       Maschinen, Oberfläche, Musikbett - ohne ein einziges Asset

  render/        Zeichnen (Kamera, isometrische Modelle, Partikel)
  ui/            DOM-Oberfläche (GDD Kapitel 8)
    theme.ts       Themes und Barrierefreiheit als CSS-Variablen
    components.ts  Designsystem: neun Komponenten, aus denen alles gebaut ist
    hud.ts         HUD oben/links/rechts
    details.ts     Detailfenster für Maschinen und Gebäude
    app.ts         Shell: sechs Hauptbereiche, Loop, Autosave, Offline
    screens/       yard · build · market · storage · trade · research
                   staff · statistics · settings · hub
```

Die Abhängigkeiten laufen nur in eine Richtung:
`data → game → (render, ui)`. Systeme kennen keine Inhalts-IDs.

## Der Erweiterungspunkt: Effekt-Deskriptoren

Alles, was der Spieler besitzen kann, beschreibt seine Wirkung über dieselben Deskriptoren
(`src/data/types.ts`):

```ts
{ kind: 'teardownRate', amount: 16 }              // Arbeit pro Sekunde
{ kind: 'autoBuy', perMinute: 12 }                // Fahrzeuge pro Minute
{ kind: 'process', recipe: 'smelt_steel', craftsPerSec: 0.25 }
{ kind: 'multiplier', target: 'sellPrice', factor: 1.18 }
{ kind: 'unlock', id: 'research' }
```

`stats.ts` faltet sämtliche Deskriptoren aus Werkzeugen, Maschinen, Mitarbeitern, Gebäuden,
Forschung und Prestige-Boni zu einem `Stats`-Objekt zusammen. Multiplikatoren wirken
`factor ^ Anzahl`. Die Systeme lesen ausschließlich dieses Objekt.

**Folge:** Eine neue Maschine ist ein Objekt in `purchasables.ts` — kein Systemcode.
Nur ein *neuer Effekt-Typ* erfordert Code: einen Fall in `applyEffect()` und die Auswertung
im passenden System.

## Inhalte hinzufügen

| Wunsch | Datei | Nötiger Code |
| ------ | ----- | ------------ |
| Neues Fahrzeug | `vehicles.ts` (vier Zeilen: Klasse + `scale`) | keiner — Preis, Arbeit und XP werden abgeleitet |
| Neue Fahrzeugklasse | `vehicles.ts` (`CLASSES`) | keiner |
| Neues Material | `materials.ts` | keiner |
| Neuer Kunde / Auktionslos / Fundstück | `trade.ts` | keiner |
| Neue Produktionskette | `materials.ts` (`RECIPES`) + Maschine mit `process`-Effekt | keiner |
| Neue Maschine / Mitarbeiter / Gebäude | `purchasables.ts` | keiner |
| Neue Forschung | `research.ts` | keiner |
| Neuer Prestige-Bonus | `research.ts` (`PRESTIGE_PERKS`) | keiner |
| Neues Grundstück | `lots.ts` (Geometrie) + `purchasables.ts` (Preis) | keiner |
| Neue Dekoration | `purchasables.ts` + Modell in `models.ts` | keiner |
| Neue Firmen-Ausrichtung | `company.ts` (`PRIORITIES`) | keiner |
| Neue Logistikfahrzeug-Klasse | `fleet.ts` | keiner |
| Neue Technologie / Stufe / Meilenstein | `tech.ts` | keiner |
| Neuer Prestige-Knoten | `prestige.ts` | keiner |
| Neuer Erfolg | `achievements.ts` | keiner, falls die Metrik existiert |
| Neue **Art** von Freischaltbedingung | `types.ts` + `unlocks.ts` | ja, klein |
| Neue Quelle dauerhafter Boni | `bonuses.ts` | ja, klein |
| Neues Theme | `ui.ts` (`THEMES`) | keiner |
| Neue Seltenheitsstufe | `ui.ts` + `types.ts` | keiner |
| Neues Maschinengeräusch | `audio/sound.ts` (`SOUNDS`) | keiner |
| Neuer Hauptbereich / Unterscreen | `app.ts` (eine Zeile) | keiner |
| Neues Gebäudemodell | `models.ts` (Tabelleneintrag) | keiner |
| Neue Maschine / Linie / Kraftwerk | `purchasables.ts` + Modell in `models.ts` | keiner |
| Neue **Art** von Wirkung | `types.ts` + `stats.ts` + System | ja, klein |

Freischaltungen laufen über `requires` (Level, Forschung, Besitz, Flags) und werden auf jeder
Karte automatisch als Schloss-Hinweis angezeigt.

Im Dev-Build prüft `validateContent()` beim Start alle Referenzen (unbekannte Materialien,
Rezepte, Forschungen) und meldet Fehler in der Konsole.

## Simulation

- Fester Zeitschritt von `1 / BALANCE.tickRate` Sekunden, entkoppelt vom Rendering.
- Pro Frame maximal 12 Schritte, damit ein pausierter Tab das Gerät nicht blockiert.
- **Offline-Fortschritt** faltet die Abwesenheit in maximal 400 Schritten (schnelles Laden) mit
  reduzierter Effizienz, gedeckelt durch `stats.offlineHours`.
- Autosave alle 10 s sowie bei `pagehide` / `visibilitychange`.

## Speicherstände

`save.ts` ist bewusst defensiv:

- **Versioniert** mit einer Migrationskette (`MIGRATIONS`).
- **Saniert** beim Laden: unbekannte IDs fliegen raus, fehlende Felder bekommen Defaults,
  Mengen werden auf `maxCount` geklemmt, das Fahrzeug auf dem Zerlegeplatz wird gegen die
  aktuelle Definition neu aufgebaut.
- Ein beschädigter Speicherstand wird als `scrap-empire.save.broken` beiseitegelegt, statt den
  Start zu blockieren.

Dadurch überlebt ein Spielstand Inhalts-Updates, auch wenn Inhalte entfernt werden.

## Die Maschinen

Drei getrennte Fortschrittsachsen, absichtlich: **Stufe** (eine bessere Maschine ersetzt die
alte), **Level** (10 Ausbaustufen pro Maschine, bis +150 %) und **Linie** (parallele
Produktionslinien multiplizieren alles). Levels allein würden das Spätspiel abflachen, Linien
allein die einzelne Maschine bedeutungslos machen.

Deshalb bedeutet `maxCount` bei `category: 'machine'` den **Levelcap**, nicht die Stückzahl:
Effekte skalieren über die Leveltabelle statt linear. Das gilt für alle Maschinen — als die
Logistikfahrzeuge noch stückzahlbasiert waren, taten Käufe oberhalb von Level 10 schlicht nichts.

Strom und Verschleiß sind Effizienzfaktoren, keine Stopper: Unterversorgung drosselt auf
minimal 40 %, völliger Verschleiß auf 60 %. Beides fließt in `stats.ts` in die Raten ein, womit
auch die Offline-Produktion automatisch damit rechnet.

## Die Wirtschaft

Der Kaufpreis eines Fahrzeugs wird **nie von Hand gesetzt**: er ist
`Materialwert ÷ Klassenmarge` aus `economy.ts`. Damit kann eine Preisanpassung an einem Material
die Fahrzeugleiter nicht mehr still umkehren — ein Fehler, den ein früherer Datensatz genau so
hatte (ab Stufe 2 waren alle Lieferungen Verlustgeschäfte).

Ein Materialhaufen trägt einen gewichteten Qualitätsdurchschnitt statt einer Menge pro
Qualitätsstufe. Das kostet einen Bruchteil der Speichergröße, liefert dem Spieler aber dieselbe
Rückmeldung: bessere Maschinen heben den Schnitt, der Preis folgt.

Betriebsstoffe haben einen **negativen** Preis, bis die Recycling-Forschung abgeschlossen ist.
Die Verkaufsautomatik rührt sie erst an, wenn das Lager zu 85 % voll ist, damit Flüssigkeiten
nicht unbemerkt das Konto leeren.

## Die Spielwelt

Die Karte ist ein Kachelraster; die Grundstücke sind Rechtecke darin. Alles Weitere wird
abgeleitet und nur neu berechnet, wenn sich der Besitz ändert: Zonen, Bauflächen, Straßen,
Kartengrenzen. Ein neues Grundstück ist damit ein Rechteck in `lots.ts` plus ein Kaufobjekt.

Anlagen stehen auf Bauflächen. Pro Kaufobjekt existiert **genau ein** Bauwerk, dessen
Ausbaustufe mit der Stückzahl wächst - der zehnte Kran wertet den Hof sichtbar auf, statt ihn
mit zehn Symbolen zuzustellen. Die Platzierung erfolgt automatisch in eine passende Zone und
kann vom Spieler per Antippen verschoben werden.

Gezeichnet wird in einem Painter's-Algorithm-Durchgang, sortiert nach `tx + ty`.

## Das Unternehmen

Löhne und Gebäudeunterhalt laufen sekündlich vom Konto. Reicht das Geld nicht, kündigt niemand —
das Team arbeitet mit 60 % Tempo weiter, bis der Rückstand getilgt ist. Ein Idle-Spiel, das den
Fortschritt beim Zurückkommen zerstört hätte, wäre gegen Kapitel 1.

Die Firmen-Ausrichtung ist bewusst **kein** Sonderweg: `PRIORITIES` liefert dieselben
Effekt-Deskriptoren wie jede Maschine, `computeStats` faltet sie mit ein. Eine neue Ausrichtung
ist damit ein Datensatz.

Mitarbeitereffekte werden **nach** den Gebäuden gefaltet, damit der Aufenthaltsraum & Co. über
`mult.staffProductivity` auf sie wirken können — die Reihenfolge in `computeStats` ist an dieser
Stelle bedeutungstragend.

## Der Langzeitfortschritt

Technologien haben **Stufen, keine Häkchen**. `perLevel`-Effekte stapeln sich mit jeder Stufe,
`milestones` zünden einmalig auf einer bestimmten Stufe — dort verändert eine Technologie das
Spiel statt einer Zahl (neue Roboter, neue Energiequelle, neue Anzeige). Freischaltungen sind
gewöhnliche `unlock`-Effekte auf Meilensteinen.

Forschung kostet **Punkte, Geld und oft Material**. Punkte entstehen nur im Labor, Material nur
beim Zerlegen — damit kann Geld allein keinen Fortschritt erzwingen, was die zentrale Forderung
aus Kapitel 7 ist.

Alles dauerhaft Besessene läuft über **ein** Modul: `bonuses.ts` liefert Technologiestufen,
Prestige-Knoten und Erfolge als `{ effect, count }`-Liste, und `stats.ts` faltet nur noch diese
Liste. Eine vierte Quelle dauerhafter Boni wird dort ergänzt, nicht in `stats.ts`.

Ebenso hat jede Freischaltbedingung **einen** Ort: `unlocks.ts`. Neben Level, Forschung, Besitz
und Flags kennt `Requirement.progress` Karrierebedingungen (zerlegte Fahrzeuge, Neugründungen,
Fundstücke), auf denen die seltenen Technologien sitzen.

### Mitarbeiter skalieren Ausstoß, nicht Prozentsätze

In `computeStats` werden Mitarbeitereffekte gesplittet: flache Effekte skalieren mit
`Anzahl × Erfahrung × Wohlfahrtsbonus`, Multiplikator- und Ausbeuteeffekte nur mit der Anzahl.
Das ist kein Detail — den Produktivitätsbonus in den *Exponenten* eines Multiplikators zu
geben, machte aus „+5 % pro Manager" bei gestapelten Boni „+105 % pro Manager" und trieb die
Spätspiel-Wirtschaft um über hundert Zehnerpotenzen nach oben.

### Endliche Zahlen

Idle-Kurven sind exponentiell, aber ein Wert, der `Infinity` erreicht, wird bei der nächsten
Subtraktion zu `NaN` und nimmt den Spielstand mit. Alle laufenden Summen (Geld, Umsatz, XP,
recycelte Menge) sind deshalb auf 1e280 gedeckelt.

## Die Logistik

`roads.ts` baut aus denselben Polylinien, die die Karte zeichnet, einen Routing-Graphen. Ein
Plotweg, der mitten auf die Hauptstraße trifft, wird beim Aufbau automatisch zur Kreuzung
aufgetrennt — ohne diesen Schritt wäre jede Seitenstraße eine Sackgasse.

Routing ist Dijkstra über `Länge × (1 + Auslastung × 0,85)`. Damit fallen drei GDD-Forderungen
auf eine Formel zusammen: kürzeste Route bevorzugt, belegte Abschnitte werden gemieden, und bei
Stau entsteht die Alternativroute von selbst. Voraussetzung dafür ist, dass es überhaupt eine
zweite Verbindung gibt — deshalb hat der Hof eine Ringstraße.

Transportaufträge gehören keinem Fahrzeug, sondern einer Warteschlange. Die Disposition gibt
jeden Auftrag an die kleinste freie Klasse, die die Last trägt.

## Die Oberfläche

Neun Komponenten in `components.ts` tragen jeden Screen. Jede Farbe, jeder Radius, jeder
Schatten und jede Animationsdauer steht in `data/ui.ts` und wird von `theme.ts` als CSS-Variable
gesetzt. Ein Theme ist damit eine andere Zahlentabelle, kein zweites Stylesheet — und die
Barrierefreiheits-Optionen fahren auf derselben Mechanik: Oberflächengröße ist eine
Root-Schriftgröße, reduzierte Effekte ein Attribut, das die Stylesheet-Regeln lesen,
Linkshänder-Modus eine gespiegelte Flex-Richtung.

Die Navigationsleiste hat **sechs** Ziele. Zwei davon sind Hubs (Schrottplatz → Hof/Ausbau,
Markt → Ankauf/Lager/Handel), damit die Leiste groß und daumenfreundlich bleibt, statt eine
neunte gequetschte Registerkarte zu bekommen. Ein Hub darf seine ID mit einem seiner
Unterscreens teilen; `App.select()` reicht die ID durch, sodass „Markt anzeigen" auch den
Ankauf nach vorn holt.

Sie wird außerdem nur neu gebaut, wenn sie anders aussehen würde. Vorher ersetzte jedes
Fortschritts-Ereignis die Buttons unter dem Finger — auf einem echten Gerät sind das Tipps,
die nicht ankommen.

## Der Ton

Vollständig synthetisiert: Oszillatoren und gefiltertes Rauschen, kein einziges Audio-Asset.
Ein Schrottplatz ist Metall, Motoren und Hydraulik, und genau darin ist subtraktive Synthese
gut. Die Aufrufstellen fragen nur nach `play('shred')`, nie nach einem Puffer — echte
Aufnahmen können das später ersetzen, ohne dass Spielcode sich ändert.

## Leistung auf Mittelklasse-Geräten

- Keine Laufzeit-Abhängigkeiten; Build ≈ 74 kB gzip (JS) + 4 kB CSS, keine Assets.
- Canvas-Zeichnung aus Vektorformen, kein Asset-Laden; DPR auf 2 begrenzt.
- Nur sichtbare Kacheln, Anlagen, Fahrzeuge und Pakete werden gezeichnet.
- Animationen und Spawns pausieren, sobald der Hof nicht der aktive Screen ist.
- Harte Obergrenzen: Flottengröße pro Fahrzeugklasse (`fleet.ts`), 4 Straßenfahrzeuge,
  3 Roboter, 24 offene Transportaufträge, 40 Materialpakete, 160 Partikel, 24 schwebende Texte,
  90 Bäume pro Bild.
- Die Oberfläche baut nur den sichtbaren Screen neu, höchstens viermal pro Sekunde, und stellt
  die Scrollposition wieder her.

## Prüfen

```bash
npm run typecheck   # strenge TypeScript-Prüfung
npm run build       # Produktionsbuild
npm run simulate    # 30-Minuten-Balancing-Lauf gegen die GDD-Zusagen
npm run simulate -- 180
```

`scripts/simulate.mjs` spielt das Spiel headless in Node (die `game/`-Schicht ist DOM-frei) und
prüft die Zusagen der Kapitel 2 bis 7: mindestens fünf Entscheidungen in den ersten zehn
Minuten, kein Stillstand über fünf Minuten, erreichte Automatisierung, sichtbares Wachstum,
gedeckter Strom, gepflegte Anlagen, bezahlte Löhne, tragbare Betriebskosten, wirksame
Prioritäten, ein Straßennetz, das jedes gekaufte Grundstück erreicht, ein gebautes Labor,
laufende Forschung in der ersten Sitzung, wachsender Technologiebaum, erreichte Meilensteine,
freigeschaltete Erfolge und erreichbares Prestige.

Die Prüfungen skalieren mit der Laufzeit: Meilensteine und ein breiter Baum sind eine Zusage
für die zweite Sitzung, nicht für die erste.

Nach jeder Änderung an `src/data/*` sollte dieser Lauf wiederholt werden.
