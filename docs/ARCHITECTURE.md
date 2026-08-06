# Architektur

Ziel dieser Struktur ist die Vorgabe aus GDD Kapitel 1: **neue Maschinen, Gebäude und Fahrzeuge
lassen sich hinzufügen, ohne bestehende Systeme zu ändern.**

## Überblick

```
src/
  data/          Inhalte & Balancing  ← hier arbeiten Designer
    types.ts       Typdefinitionen aller Inhalte + Effekt-Deskriptoren
    balance.ts     Zentrale Stellschrauben (Start, Tickrate, Offline, Prestige …)
    materials.ts   Materialien + Verarbeitungsrezepte
    vehicles.ts    Lieferungen inkl. Teile, Hotspots, Fundstücke
    purchasables.ts Werkzeuge, Maschinen, Mitarbeiter, Gebäude
    research.ts    Forschungsbaum + Prestige-Boni
    index.ts       Registry + Inhalts-Validierung

  core/          Infrastruktur ohne Spiellogik (Events, Formatierung, Zufall)

  game/          Simulation, DOM-frei und damit headless testbar
    state.ts       Serialisierbarer Spielstand
    stats.ts       Leitet aus Besitz/Forschung/Prestige die abgeleiteten Werte ab
    save.ts        Versionierte Speicherstände inkl. Migration & Reparatur
    game.ts        Orchestrator: Aktionen + fester Simulationsschritt
    systems/       teardown · logistics · market · processing · offline

  render/        Canvas-Ansicht des Hofs (Kamera, Fahrzeug-Silhouetten, Partikel)
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
| Neues Fahrzeug | `vehicles.ts` | keiner — der Renderer nutzt `shape` + normalisierte Hotspots |
| Neues Material | `materials.ts` | keiner |
| Neue Produktionskette | `materials.ts` (`RECIPES`) + Maschine mit `process`-Effekt | keiner |
| Neue Maschine / Mitarbeiter / Gebäude | `purchasables.ts` | keiner |
| Neue Forschung | `research.ts` | keiner |
| Neuer Prestige-Bonus | `research.ts` (`PRESTIGE_PERKS`) | keiner |
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

## Leistung auf Mittelklasse-Geräten

- Keine Laufzeit-Abhängigkeiten; Build ≈ 26 kB gzip.
- Canvas-Zeichnung aus Vektorformen, kein Asset-Laden; DPR auf 2 begrenzt.
- Partikel und schwebende Texte sind gedeckelt (160 / 24).
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
