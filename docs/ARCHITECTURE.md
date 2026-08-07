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
    research.ts    Forschungsbaum + Prestige-Boni
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

  world/         Spielwelt (GDD Kapitel 3), unabhängig austauschbare Module
    iso.ts         Isometrische Projektion (64:36 ≈ 29,4°)
    map.ts         Gelände, Zonen, Straßen, Bauflächen, Grundstücksgrenzen
    buildings.ts   Platzierung und Ausbaustufen der Anlagen
    traffic.ts     LKW, Straßenverkehr, Gabelstapler - fahren echte Wege
    logistics.ts   sichtbarer Materialfluss auf den Förderstrecken
    environment.ts Tag/Nacht-Zyklus, Wetter, Atmosphäre

  render/        Zeichnen (Kamera, isometrische Modelle, Partikel)
  ui/            DOM-Oberfläche (Shell, Screens, Tutorial, Modals)
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

## Leistung auf Mittelklasse-Geräten

- Keine Laufzeit-Abhängigkeiten; Build ≈ 37 kB gzip.
- Canvas-Zeichnung aus Vektorformen, kein Asset-Laden; DPR auf 2 begrenzt.
- Nur sichtbare Kacheln, Anlagen, Fahrzeuge und Pakete werden gezeichnet.
- Animationen und Spawns pausieren, sobald der Hof nicht der aktive Screen ist.
- Harte Obergrenzen: 5 Liefer-LKW, 4 Straßenfahrzeuge, 4 Gabelstapler, 40 Materialpakete,
  160 Partikel, 24 schwebende Texte, 90 Bäume pro Bild.
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
prüft die Zusagen aus Kapitel 2: mindestens fünf Entscheidungen in den ersten zehn Minuten,
kein Stillstand über fünf Minuten, erreichte Automatisierung, sichtbares Wachstum.

Nach jeder Änderung an `src/data/*` sollte dieser Lauf wiederholt werden.
