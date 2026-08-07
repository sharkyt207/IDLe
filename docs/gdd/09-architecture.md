# SCRAP EMPIRE — Game Design Document

## Kapitel 9 – Technische Architektur & Projektstruktur

---

### Ziel dieses Kapitels

Kein Prototyp, sondern ein Projekt, das über Jahre erweiterbar bleibt. Neue Inhalte sollen
überwiegend durch neue Daten ergänzt werden, ohne bestehende Systeme umzuschreiben.

---

### Projektstruktur

Das GDD skizziert eine Unity-nahe Ordnerstruktur. Umgesetzt ist dieselbe Trennung, in der Form,
die ein TypeScript/Vite-Projekt braucht:

| GDD | Hier | Inhalt |
| --- | ---- | ------ |
| `Data/` | `src/data/` | Materialien, Fahrzeuge, Maschinen, Gebäude, Mitarbeiter, Forschung, Verträge, Erfolge, Wirtschaft |
| `Core/Save` | `src/game/save.ts` | Versionierung, Migration, Sanierung |
| `Core/Events` | `src/core/events.ts` | typisierter Bus |
| `Core/Config` | `src/data/balance.ts`, `economy.ts`, `machines.ts`, `company.ts`, `progress.ts`, `ui.ts` | alle Spielwerte |
| `Core/Localization` | `src/core/i18n.ts`, `src/locales/` | acht Sprachen vorbereitet |
| `Core/Utilities` | `src/core/format.ts`, `rng.ts`, `log.ts`, `pool.ts` | |
| `Systems/Economy` | `src/economy/` | Markt, Lager, Verträge, Auktionen, Firmenwert |
| `Systems/Production` | `src/game/systems/` | Zerlegen, Verarbeitung, Logistik, Wartung, Offline, Events |
| `Systems/Buildings` | `src/world/buildings.ts` | |
| `Systems/Logistics` | `src/world/roads.ts`, `traffic.ts`, `logistics.ts` | |
| `Systems/Employees` | `src/company/payroll.ts` | |
| `Systems/Research/Prestige/Achievements` | `src/progress/` | plus Unlock-, Bonus- und Progress-Tracker |
| `Systems/Missions` | `src/missions/` | Missionen, Meilensteine, Hinweise, Lexikon (Kapitel 10) |
| `Systems/Statistics` | `src/company/statistics.ts` | |
| `Systems/Audio` | `src/audio/sound.ts` | |
| `UI/HUD` | `src/ui/hud.ts` | |
| `UI/Windows`, `Popups` | `src/ui/components.ts` (Dialog), `src/ui/details.ts` | |
| `UI/Menus` | `src/ui/screens/` | |
| `UI/Components` | `src/ui/components.ts` | |
| `Game/` | `src/game/game.ts`, `src/main.ts` | |
| `Assets/` | — | bewusst leer: alle Grafik ist Vektor, aller Ton synthetisiert |

`Assets/` fehlt, weil es nichts zu speichern gibt. Modelle sind Zeichenanweisungen in
`render/models.ts`, Symbole sind Emoji, Geräusche entstehen zur Laufzeit. Sobald echte Assets
dazukommen, ist das der Ordner dafür.

---

### Datengetriebene Architektur

Eine neue Maschine ist ein Objekt in `purchasables.ts`. Kein Systemcode. Das gilt für
Fahrzeuge, Gebäude, Forschung, Materialien, Mitarbeiter, Verträge, Erfolge, Prestige-Knoten,
Themes und Logistikfahrzeuge gleichermaßen — die Tabelle in
[ARCHITECTURE.md](../ARCHITECTURE.md) listet für jede Inhaltsart, welche Datei sie braucht und
wie viel Code (fast immer: keiner).

Möglich ist das durch **Effekt-Deskriptoren**: alles, was der Spieler besitzen kann, beschreibt
seine Wirkung mit denselben Datensätzen, und `stats.ts` faltet sie zu einem Objekt. Nur eine
*neue Art* von Wirkung kostet Code.

---

### Zentrale Manager

| Manager | Datei |
| ------- | ----- |
| Economy | `src/economy/manager.ts` |
| Production | `src/game/systems/processing.ts`, `teardown.ts` |
| Building | `src/world/buildings.ts` |
| Employee | `src/company/payroll.ts` |
| Market | `src/economy/market.ts`, `contracts.ts`, `auctions.ts` |
| Research | `src/progress/research.ts` |
| Prestige | `src/progress/prestige.ts` |
| Achievement | `src/progress/achievements.ts` |
| Permanent Bonus | `src/progress/bonuses.ts` |
| Unlock | `src/progress/unlocks.ts` |
| Save | `src/game/save.ts` |
| Event | `src/game/systems/events.ts` |
| Mission | `src/missions/manager.ts` |
| Daily Mission Generator | `src/missions/daily.ts` |
| Milestone | `src/missions/milestones.ts` |
| Hint & Mentor | `src/missions/hints.ts` |
| Help & Encyclopedia | `src/missions/help.ts` |
| Progress Tracker | `src/progress/tracker.ts` |
| Audio | `src/audio/sound.ts` |
| Statistics | `src/company/statistics.ts` |

Jeder ist einzeln testbar und kennt die anderen nicht.

### Event-System

Systeme reden nicht miteinander, sie melden. Ein fertig zerlegtes Fahrzeug löst ein Ereignis
aus; Lager, Statistik, Erfolge, Ton und Oberfläche hängen sich unabhängig daran.

Ein Listener, der wirft, wird protokolliert und übersprungen statt den `emit` abzubrechen —
der Bus ist das, was die Systeme trennt, also darf ein kaputtes UI-Panel die Simulation nicht
davon abhalten, den anderen Bescheid zu geben.

Der **Event Manager** besitzt außerdem die Dinge, die dem Unternehmen *passieren*: den
Tageswechsel und sechs Zufallsereignisse (unerwartete Anlieferung, Großabnehmer, Fund im
Handschuhfach, Betriebsprüfung, Netzschwankung, Praktikant). Sie sind bewusst mild — Kapitel 1
schließt Bestrafungsmechaniken aus, also zerstört keines Fortschritt.

---

### Speicherstände

Automatisch nach Bauaktionen, Käufen und Forschungsabschluss (das `progress`-Ereignis), beim
Wechsel in den Hintergrund, beim Beenden und alle 10 Sekunden. Dazu ein **Jetzt speichern** in
den Einstellungen.

Das Speichern ist entprellt: eine einzelne Kaufaktion löst mehrere `progress`-Ereignisse aus,
und den kompletten Zustand fünfmal hintereinander zu serialisieren wäre reine Arbeit.

Beim Laden wird jeder Speicherstand **saniert**: unbekannte Inhalte fliegen raus, fehlende
Felder bekommen Defaults, Mengen werden geklemmt. Ein beschädigter Stand wird beiseitegelegt
statt den Start zu blockieren. Fünf Migrationen sind bisher nötig gewesen (Kapitel 7, 8, 9 und
10). Die letzte schreibt einem Altbestand die fünf Einführungsmissionen gut, zahlt sie aber
nicht aus - sie waren längst verdient, und einem Spätspiel-Hof 250 € zu schenken sähe nur nach
einem Fehler aus.

---

### Performance

- **Objekt-Pooling** für Partikel und schwebende Zahlen: im Spätspiel entstehen hunderte pro
  Sekunde, und kurzlebige Allokationen in dieser Größenordnung sind genau das Muster, das auf
  einem Mittelklasse-Telefon als GC-Ruckeln sichtbar wird.
- Feste Intervalle statt Dauerbetrieb: Simulation 10 Hz, Oberfläche 4 Hz, Autosave 0,1 Hz.
- Nur sichtbare Kacheln, Anlagen, Fahrzeuge und Pakete werden gezeichnet.
- Die Navigationsleiste wird nur neu gebaut, wenn sie anders aussehen würde.
- Partikel bei „reduzierte Effekte" auf ein Viertel.

### Fehlerbehandlung

`src/core/log.ts` ist ein winziger, strukturierter Logger: jede Meldung trägt ihr Subsystem,
die letzten 120 landen in einem Ringpuffer, den der Entwicklermodus anzeigt. Dazu `guard()` für
die wenigen Stellen, an denen ein Wurf fatal wäre, und `safeNumber()` für Zahlen, die von außen
kommen.

### Debug-Modus

Langer Druck auf die obere Leiste, **nur in Dev-Builds** — das Modul hängt an
`import.meta.env.DEV` und fällt aus dem Release-Bundle heraus, statt nur versteckt zu sein.

Enthält: Geld hinzufügen, Level, Forschung freischalten, alles bauen, Prestige auslösen, Zeit
vorspulen (10/60 Minuten), Fahrzeug spawnen, FPS-Anzeige, manuelles Speichern, Speicherstand
zurücksetzen und das Protokoll.

Das Vorspulen benutzt denselben Pfad wie der Offline-Fortschritt — ein Debug-Werkzeug, das über
das Spiel lügt, ist schlimmer als keines.

---

### Lokalisierung

Zwei Arten von Text, absichtlich unterschiedlich behandelt:

1. **Oberflächentext** ist von Anfang an ein Schlüssel: `t('nav.market')`. 279 Schlüssel,
   Deutsch als Quelle, Englisch vollständig, sechs weitere Sprachen registriert und leer.
   Fehlt ein Schlüssel, erscheint Deutsch statt einer Lücke.
2. **Inhaltstext** (Namen und Beschreibungen von 300+ Maschinen, Fahrzeugen, Materialien) lebt
   bei seinen Daten, weil genau das eine neue Maschine zu *einem* Datensatz macht. Eine
   Übersetzung ist eine Override-Tabelle nach Inhalts-ID: `tc('machine', id, 'name', quelle)`.

Beides durch Schlüssel zu zwingen hieße, dass jede neue Maschine zwei Dateien braucht — genau
die Reibung, die dieses Kapitel vermeiden will.

`npm run i18n` meldet pro Sprache den Stand, warnt bei abweichenden Platzhaltern und **scannt
`src/ui` nach deutschen Zeichenketten, die nie durch `t()` gelaufen sind** — aktuell null.

---

### Qualitätsstandards & Definition of Done

```bash
npm run typecheck   # TypeScript strict
npm run build       # Produktionsbuild
npm run simulate    # 26 GDD-Prüfungen, headless
npm test            # 10 Browser-Suiten in echtem Chromium
npm run i18n        # Übersetzungsstand
npm run check       # typecheck + simulate + test
```

Die Browser-Suiten liegen in `tests/` und sind bewusst End-to-End: das Spiel ist eine
Simulation plus ein DOM, und die Fragen, die sich lohnen („produziert eine ausgebaute Maschine
wirklich mehr", „übersteht der Spielstand einen Reload") haben nur dann Antworten, wenn das
Ganze läuft.

Ein Feature gilt als fertig, wenn es funktioniert, gespeichert und geladen wird, in der
Oberfläche steckt, Ereignisse auslöst, Statistiken aktualisiert, keine Performanceprobleme
verursacht und erweiterbar bleibt — jede dieser Zusagen hat oben einen Befehl, der sie prüft.

### Telemetrie

Nicht eingebaut. Das Kapitel führt sie als optional, sie bräuchte eine Einwilligung, einen
Server und eine Datenschutzerklärung, und keines davon existiert. Der Ringpuffer in `log.ts`
und die Kennzahlen in `statistics.ts` liefern dieselben Antworten lokal, ohne dass Daten das
Gerät verlassen. Wenn Telemetrie kommt, hängt sie sich als weiterer Listener an den Bus.
