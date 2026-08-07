# SCRAP EMPIRE — Game Design Document

## Kapitel 3 – Spielwelt & Kartenaufbau

---

### Ziel dieses Kapitels

Die Spielwelt soll sich mit jedem Ausbau verändern. Der Spieler soll nicht nur Zahlen steigen
sehen, sondern auch optisch erkennen, wie aus einem kleinen Schrottplatz ein modernes
Recyclingunternehmen wird.

Die Karte muss so aufgebaut sein, dass neue Bereiche später leicht ergänzt werden können.

---

### Designprinzipien

Die Karte soll leicht verständlich sein, übersichtlich bleiben, natürlich wachsen, den Spieler
nie überfordern und sichtbar auf jede Investition reagieren.

**Jedes neue Gebäude verändert den Schrottplatz dauerhaft.**

---

### Kameraperspektive

Leicht isometrisch (ca. 30–35°). Dadurch: gute Übersicht, einfache Touch-Steuerung, moderne
Optik, geringe Anforderungen an Grafiken.

> Umsetzung: Kachelverhältnis 64:36 ≈ 29,4°, siehe `src/world/iso.ts`.

---

### Der erste Schrottplatz

Der Spieler startet auf einem kleinen Grundstück mit Einfahrt, Waage, Bürocontainer, kleinem
Parkplatz, Schrotthaufen, Werkbank, Lagerfläche und einfachem Zaun. Alles wirkt alt und
reparaturbedürftig.

### Kartenaufteilung

```
────────────────────────────
 Straße
 ──────── Tor ─────────
 Anlieferung
 ████████████████
 Schrottplatz
 ████████████████
 Werkstatt
 ████████████████
 Lager
 ████████████████
 Freie Bauflächen
 ████████████████
 Wald
────────────────────────────
```

Der Spieler erkennt sofort: Wo Schrott ankommt. Wo gearbeitet wird. Wo neue Gebäude entstehen
können.

---

### Erweiterungen

Mit Geld können angrenzende Grundstücke gekauft werden. Jede Erweiterung verändert das
Erscheinungsbild sichtbar.

| # | Erweiterung | Lage |
| - | ----------- | ---- |
| 1 | Mehr Lagerfläche | Osten |
| 2 | Zweite Werkstatt | Westen |
| 3 | Recyclinghalle | Süden |
| 4 | Schmelzwerk | Südosten |
| 5 | Logistikzentrum | Südwesten |
| 6 | Forschungslabor | Nordosten |
| 7 | Containerhafen | Nordwesten |
| 8 | Bahnhof | Süden (Gleisanschluss) |
| 9 | Industriepark | Osten (Großgelände) |
| 10 | Eigener Stahlhersteller | Westen |

---

### Straßen

Alle Gebäude werden über Straßen verbunden. LKW bewegen sich tatsächlich über diese Straßen.

**Keine Teleportation.** Dadurch wirkt der Betrieb lebendig.

### Förderbänder

Materialien bewegen sich sichtbar:

```
Auto → Zerlegung → Sortierung → Lager → Schmelze → Produktion → Verkauf
```

Der Spieler sieht jederzeit den Materialfluss.

---

### Tageszeiten

Ein vollständiger Tag dauert etwa 15 Minuten: Morgen · Mittag · Abend · Nacht. Die Beleuchtung
ändert sich sanft. Nachts: Flutlicht, leuchtende Gebäude, Blinklichter an Maschinen.

### Wetter

Wetter beeinflusst nur die Atmosphäre: Sonne · Bewölkt · Regen · Schnee · Nebel · Gewitter
(selten).

**Keine negativen Auswirkungen auf die Produktion.**

---

### Dekoration

Der Spieler kann kosmetische Elemente platzieren: Bäume, Blumen, Lampen, Schilder, Flaggen,
Container, alte Fahrzeuge, Schrottskulpturen.

Diese erhöhen den Firmenwert und verbessern das Erscheinungsbild, haben aber **keinen Einfluss
auf die Produktion**.

---

### Gebäudezustände

Jedes Gebäude entwickelt sich optisch mit Upgrades:

```
Stufe 1 → alter Schuppen
Stufe 2 → renoviert
Stufe 3 → moderne Halle
Stufe 4 → Hightech-Werkstatt
Stufe 5 → futuristische Produktionshalle
```

Der Fortschritt soll sofort sichtbar sein.

> Umsetzung: `building.stageAt` in `src/data/purchasables.ts` legt fest, ab welcher Stückzahl
> eine Anlage die nächste Ausbaustufe zeigt.

---

### Animationen

Die Karte lebt durch viele kleine Details: Kräne bewegen sich, Förderbänder laufen, Funken
fliegen, Schweißarbeiten, Rauch aus Schornsteinen, Gabelstapler fahren, Wind bewegt Fahnen.

Diese Animationen laufen dezent im Hintergrund und vermitteln Aktivität.

---

### Optimierung für Mobilgeräte

- Nur sichtbare Bereiche rendern.
- Animationen außerhalb des Bildschirms pausieren.
- Partikeleffekte sparsam einsetzen.
- Effiziente Objektverwaltung für viele Maschinen und Fahrzeuge.

---

### Anforderungen an die Umsetzung

Die Karte muss modular aufgebaut, beliebig erweiterbar sein, Gebäude innerhalb vorgesehener
Bauflächen frei platzierbar machen, den Materialfluss visuell darstellen und auf Smartphones
flüssig laufen.

### Architekturhinweis

Die Spielwelt ist in klar getrennte Module aufgeteilt, die unabhängig erweitert oder
ausgetauscht werden können:

| Modul | Datei | Aufgabe |
| ----- | ----- | ------- |
| Map-System | `src/world/map.ts` | Gelände, Zonen, Wege, Bauflächen, Grundstücksgrenzen |
| Building-System | `src/world/buildings.ts` | Platzierung und Ausbaustufen |
| Vehicle-System | `src/world/traffic.ts` | LKW, Straßenverkehr, Gabelstapler |
| Logistics-System | `src/world/logistics.ts` | sichtbarer Materialtransport |
| Environment-System | `src/world/environment.ts` | Tag/Nacht, Wetter, Atmosphäre |

Die Geometrie der Karte liegt als Daten in `src/data/lots.ts`, die Optik der Modelle in
`src/render/models.ts`.
