# SCRAP EMPIRE — Game Design Document

## Kapitel 5 – Maschinen, Produktionslinien & Automatisierung

---

### Ziel dieses Kapitels

Die Maschinen sind der zentrale Fortschrittsmotor. Der Spieler entwickelt sich vom Handwerker
zum Fabrikdirektor. Jedes Upgrade muss die Produktion beschleunigen, den Gewinn erhöhen,
manuelle Arbeit reduzieren und optisch sichtbar sein.

### Die Automatisierungsstufen

| Phase | Spielgefühl |
| ----- | ----------- |
| Handarbeit | Der Spieler zerlegt Fahrzeuge selbst. |
| Mechanisierung | Einfache Maschinen unterstützen die Arbeit. |
| Fördertechnik | Materialien bewegen sich automatisch. |
| Robotik | Greifarme und Sortierroboter übernehmen Aufgaben. |
| Industrie 4.0 | Vollautomatische Produktionslinien. |
| KI-Fabrik | Selbstoptimierende Hightech-Anlage. |

---

### Drei Fortschrittsachsen

Das Kapitel wird über drei bewusst getrennte Achsen umgesetzt:

1. **Stufe (Tier)** — eine bessere Maschine ersetzt die alte. Vom Magnetkran (0,6 Arbeit/s) bis
   zur KI-Zerlegelinie (900 Arbeit/s).
2. **Level** — jede Maschine hat **10 Ausbaustufen** nach der GDD-Tabelle: +15 % pro Stufe bis
   Stufe 5, +150 % auf Stufe 10. Ab Stufe 5 hebt die Maschine zusätzlich die Materialqualität,
   auf Stufe 10 kommen Energiebonus und erhöhte Fundchance dazu — und das Modell auf der Karte
   wechselt in seine Endausbaustufe.
3. **Linie** — parallele Produktionslinien multiplizieren den Durchsatz (+50 % je Linie). Das
   ist die eigentliche Idle-Kurve: „noch eine Linie".

Levels allein würden das Spätspiel abflachen, Linien allein die einzelne Maschine bedeutungslos
machen. Zusammen ergeben sie den „noch eine Stufe"-Sog *und* die exponentielle Kurve.

---

### Maschinen

| Maschine | Preis | Wirkung |
| -------- | ----- | ------- |
| Hammer | 0 € | vollständig manuell |
| Schneidbrenner | ab 480 € | +Tippleistung |
| Kleiner Magnetkran | 130 € | 0,6 Arbeit/s |
| Hydraulikschere | 8.000 € | zerlegt Karosserien automatisch, 6 Arbeit/s |
| Reifenpresse | 6.500 € | Gummigranulat, +15 % Gummiausbeute |
| Batteriestation | 9.000 € | +45 % Lithium, Kobalt, Elektronik |
| Greifarm | 18.000 € | 12 Arbeit/s |
| Magnetseparator | 25.000 € | +20 % Materialausbeute |
| Glassortieranlage | 32.000 € | +40 % Glasausbeute |
| Wirbelstromseparator | 40.000 € | +35 % bei Aluminium, Kupfer, Messing |
| Großschredder | 60.000 € | 34 Arbeit/s |
| Sortierroboter | 140.000 € | +8 Einheiten/s Verkauf, bessere Qualität |
| Zerlegeroboter | 200.000 € | 95 Arbeit/s |
| Schweißroboter | 260.000 € | 45 Arbeit/s |
| KI-Inspektionsdrohne | 900.000 € | deutlich höhere Qualität, weniger Ausschuss |
| KI-Zerlegelinie | 3.000.000 € | 900 Arbeit/s |

Die Roboter bewegen sich sichtbar über die Anlage; die Drohne schwebt.

---

### Energie-System

Alle Maschinen verbrauchen Strom. Der Hof startet mit einem Netzanschluss von 30 kW; dazu kommen
Netzanschluss-Ausbau, Solaranlage, Windrad, Blockheizkraftwerk und Recycling-Gaskraftwerk.

**Strom ist kein harter Stopper, sondern ein Effizienzfaktor.** Bei Unterversorgung laufen die
Anlagen langsamer — aber nie unter 40 %, und niemals still.

---

### Wartung

Jede Maschine hat einen Zustand, der beim Arbeiten sinkt. Eine verschlissene Anlage liefert
weniger, aber nie unter 60 %. Ein Instandhalter (ab Level 8) und die Forschung *Automatische
Wartung* halten den Zustand von allein oben.

> Der GDD verlangt ausdrücklich, dass der Spieler nicht ständig reparieren muss: Verschleiß ist
> ein langsamer Hintergrunddruck, der zum Instandhalter führt — kein Timer zum Babysitten.
> Ein Knopf wartet den ganzen Hof auf einmal.

---

### Produktionslinien

Eine Linie ist eine unabhängige Kette (Anlieferung → Schere → Presse → Ofen → Barren → Verkauf).
Drei Linientypen lassen sich parallel bauen:

- **Zerlegelinie** — +50 % Zerlegeleistung *und* +50 % Ankauf, damit eine neue Linie ihren
  eigenen Nachschub mitbringt und Angebot und Nachfrage nie auseinanderlaufen.
- **Sortierlinie** — +50 % Verkaufsdurchsatz.
- **Verarbeitungslinie** — +50 % Verarbeitung.

---

### Offline-Produktion

Alle automatischen Maschinen produzieren auch offline. Die Berechnung nutzt dieselben Raten wie
online — Produktionsrate, Lagerkapazität, Stromversorgung und Wartungszustand stecken bereits in
ihnen. **Maximal 12 Stunden.**

---

### Anforderungen an die Umsetzung

Das Maschinensystem ist datengetrieben: eine neue Maschine ist ein Datensatz in
`purchasables.ts` mit Effekt-Deskriptoren plus einem Modell in `models.ts`. Produktionsraten
werden zentral in `stats.ts` berechnet, die Stellschrauben stehen in `data/machines.ts`.

| Baustein | Ort |
| -------- | --- |
| Stufen-, Energie- und Verschleißkonfiguration | `src/data/machines.ts` |
| Maschinen, Linien, Kraftwerke | `src/data/purchasables.ts` |
| Ratenberechnung (Level × Zustand × Strom) | `src/game/stats.ts` |
| Verschleiß und Wartung | `src/game/systems/maintenance.ts` |
| Offline-Produktion | `src/game/systems/offline.ts` |
| Sichtbare Roboter | `src/world/traffic.ts` |
