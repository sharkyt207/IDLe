# SCRAP EMPIRE — Game Design Document

## Kapitel 1 – Vision

**Version 1.0**

---

### Elevator Pitch

Scrap Empire ist ein hochwertiges Idle-/Tycoon-Spiel für Smartphones.

Der Spieler beginnt mit einem verlassenen Schrottplatz, einem alten Pickup und einer Handvoll
Werkzeuge. Aus wenigen rostigen Autos entsteht Schritt für Schritt ein riesiges
Recyclingunternehmen. Mit jeder Investition wird der Betrieb effizienter.

Anfangs zerlegt der Spieler Autos per Fingertipp. Später übernehmen Kräne, Förderbänder, Roboter
und KI-gesteuerte Fabriken sämtliche Arbeiten automatisch.

Der Fokus liegt auf dem Gefühl, aus „Schrott" ein Imperium aufzubauen.

---

### Leitbild

Das Spiel soll drei Dinge vermitteln:

**Wachstum** — Der Spieler soll alle paar Minuten merken: *Mein Schrottplatz wird größer.*

**Automatisierung** — Mit jedem Upgrade muss der Spieler weniger selbst machen. Die Maschinen
übernehmen immer mehr Aufgaben.

**Optimierung** — Es gibt niemals die perfekte Fabrik. Der Spieler kann ständig:

- Förderbänder verbessern
- Maschinen austauschen
- Lager erweitern
- Mitarbeiter optimieren
- Produktionsketten umbauen

---

### Spielgefühl

Der Spieler soll sich fühlen wie: Unternehmer, Fabrikleiter, Logistikchef, Recycling-Experte.

**Nicht wie ein Arbeiter.**

---

### Inspirationsquellen

Das Spiel orientiert sich an erfolgreichen Mechaniken ähnlicher Titel, übernimmt aber keine
geschützten Inhalte oder Designs:

Idle Factory Tycoon · Junkyard Tycoon · Car Industry Tycoon · Assembly Line · Builderment ·
Shapez · Factorio (Automatisierung) · Satisfactory (Produktionsketten)

Die Umsetzung soll eine eigenständige Identität entwickeln.

---

### Zielgruppe

**Alter:** 12–60 Jahre

**Spielertypen:** Idle-Spieler · Tycoon-Fans · Simulationsspieler · Optimierer · Casual-Spieler

---

### Sessions

Das Spiel muss Spaß machen bei **2 Minuten** und bei **45 Minuten**.

Der Spieler darf jederzeit pausieren. Offline-Fortschritt gehört zum Kern des Spiels.

---

### Kernwerte

Jedes System muss mindestens einen dieser Werte unterstützen:

Fortschritt · Expansion · Automatisierung · Optimierung · Sammeln · Freischalten

> Wenn ein Feature keinen dieser Werte unterstützt, soll es nicht eingebaut werden.

---

### Spielprinzip

Die komplette Spielschleife lautet:

```
Schrott kaufen
   ↓
Fahrzeuge zerlegen
   ↓
Materialien sortieren
   ↓
Materialien verarbeiten
   ↓
Produkte verkaufen
   ↓
Gewinn erzielen
   ↓
Maschinen kaufen
   ↓
Produktion beschleunigen
   ↓
Gelände erweitern
   ↓
Noch mehr Schrott verarbeiten
   ↓
Prestige
   ↓
Neues Unternehmen mit dauerhaften Boni gründen
```

---

### Schwierigkeit

Sehr leicht zu lernen. Sehr schwer vollständig zu optimieren.

Neue Spieler sollen innerhalb der ersten Minute verstehen, was zu tun ist. Erfahrene Spieler
sollen nach vielen Stunden noch Ziele haben.

---

### Monetarisierung

Das Spiel wird zunächst als **Premium-Spiel** geplant. Daher gilt:

- Keine Energie-Systeme.
- Keine Wartezeiten, die nur durch Bezahlen übersprungen werden können.
- Keine Pay-to-Win-Mechaniken.

Später können optionale Inhalte ergänzt werden, z. B. kosmetische Skins, alternative Designs,
zusätzliche Szenarien oder Karten.

---

### Technische Grundsätze

Das Projekt ist so strukturiert, dass:

- alle Spielwerte zentral konfigurierbar sind,
- Inhalte datengetrieben ergänzt werden können,
- neue Maschinen, Gebäude und Fahrzeuge ohne Änderungen an bestehenden Systemen hinzugefügt
  werden können,
- Speicherstände robust funktionieren,
- das Spiel auch auf Mittelklasse-Smartphones flüssig läuft.

Siehe [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) für die Umsetzung dieser Grundsätze.

---

### Definition of Done

Das Spiel gilt langfristig als vollständig, wenn der Spieler:

- einen vollständig automatisierten Schrottplatz betreiben kann,
- alle Gebäude freigeschaltet hat,
- alle Maschinen besitzt,
- alle Forschungszweige abgeschlossen hat,
- alle Fahrzeugtypen entdeckt hat,
- mehrere Prestige-Durchläufe absolvieren kann,
- langfristig neue Inhalte durch Updates erhalten kann, ohne dass die Grundarchitektur geändert
  werden muss.
