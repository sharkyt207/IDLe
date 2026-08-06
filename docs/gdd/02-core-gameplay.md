# SCRAP EMPIRE — Game Design Document

## Kapitel 2 – Core Gameplay & Spielerlebnis

---

### Ziel dieses Kapitels

Dieses Dokument definiert den eigentlichen Spielablauf.

Der Spieler muss innerhalb der ersten Minute verstehen:

> „Ich kaufe Schrott → zerlege ihn → verkaufe Materialien → erweitere meinen Schrottplatz."

Das Gameplay muss sofort verständlich sein, aber über viele Stunden neue Möglichkeiten eröffnen.

---

### Gameplay-Säulen

#### 1. Ankaufen

Der Spieler beschafft Schrott: Unfallwagen, alte Kleinwagen, Transporter, Motorräder, Maschinen,
Container, Industrieabfälle.

Jede Lieferung hat: Kaufpreis · Gewicht · Seltenheit · Materialzusammensetzung · Chance auf
seltene Fundstücke.

#### 2. Zerlegen

Anfangs erfolgt das Zerlegen manuell. Später übernehmen Maschinen diese Aufgabe.

```
Auto → Karosserie → Stahl → Kupfer → Aluminium → Gummi → Elektronik
```

#### 3. Verarbeitung

Rohstoffe können direkt verkauft, gelagert oder weiterverarbeitet werden.

```
Stahlschrott → Schmelzofen → Stahlbarren → Industrieplatten → Verkauf
```

Dadurch entstehen strategische Entscheidungen.

#### 4. Ausbau

Gewinne werden investiert in: Maschinen · Lager · Gebäude · Mitarbeiter · Fahrzeuge · Forschung.

Der Schrottplatz wächst sichtbar.

#### 5. Automatisierung

Das wichtigste Ziel des Spiels. Jedes Upgrade reduziert manuelle Arbeit.

```
Handarbeit → Mechaniker → Förderband → Greifarm → Sortiermaschine
          → Roboter → KI-System → Vollautomatische Produktion
```

Der Spieler entwickelt sich vom Arbeiter zum Geschäftsführer.

---

### Spielstart

Der Spieler besitzt: kleinen Schrottplatz · Pickup · Hammer · Schneidbrenner · 500 € ·
kleine Lagerfläche.

Es gibt keine Mitarbeiter. Keine Maschinen. Keine Automatisierung.

**Erste Aufgabe:** Ein alter Kleinwagen wird geliefert. Das Tutorial erklärt: *Tippe auf
markierte Fahrzeugteile, um sie zu entfernen.* Nach jedem Teil erhält der Spieler Geld.

**Erste Belohnung:** Nach dem ersten Fahrzeug erhält der Spieler Geld, Erfahrung und ein erstes
Upgrade. Dadurch entsteht sofort ein Erfolgserlebnis.

**Erste Investition:** Der Spieler wählt zwischen drei Upgrades:

| Option | Upgrade | Wirkung |
| ------ | ------- | ------- |
| A | Besserer Hammer | schneller zerlegen |
| B | Größeres Lager | mehr Materialien speichern |
| C | Kleiner Magnetkran | erste Automatisierung |

**Es gibt keine falsche Entscheidung.**

---

### Die ersten 30 Minuten

| Zeit | Erlebnis |
| ---- | -------- |
| Minute 1–5 | erstes Auto · erstes Geld · erste Upgrades |
| Minute 5–10 | kleine Maschine · neues Material · zweites Fahrzeug |
| Minute 10–20 | erstes Gebäude · erstes Förderband · mehr Fahrzeuge |
| Minute 20–30 | Mitarbeiter · kleine Produktionslinie · erste Automatisierung |

Nach 30 Minuten soll der Spieler das Gefühl haben:

> „Mein Schrottplatz sieht komplett anders aus als zu Beginn."

---

### Fortschrittsgefühl

Alle 2–5 Minuten passiert mindestens eines dieser Ereignisse: neues Gebäude · neue Maschine ·
neues Fahrzeug · neues Material · neuer Mitarbeiter · neue Forschung · neues Gebiet ·
sichtbares Upgrade.

**Stillstand soll vermieden werden.**

---

### Spielgeschwindigkeit

- **Frühes Spiel:** schneller Fortschritt
- **Mittleres Spiel:** mehr Entscheidungen
- **Spätes Spiel:** komplexe Produktionsketten und Optimierung

---

### Schwierigkeit

Keine Zeitlimits. Keine Bestrafung für Fehler. Alle Entscheidungen können später ausgeglichen
werden. Das Spiel soll motivieren statt frustrieren.

---

### Benutzeroberfläche

Die Bedienung erfolgt vollständig per Touch: Tippen · Halten · Ziehen · Zoomen.

Maximal zwei Fingergesten gleichzeitig.

**Kameraführung:** Der Spieler kann frei über den Schrottplatz scrollen, hinein- und
herauszoomen. Die Kamera folgt niemals automatisch dauerhaft.

**Visuelles Feedback:** Funken beim Schneiden · Metallgeräusche · schwebende Geldbeträge ·
Fortschrittsbalken · kurze Vibration (optional) · kleine Partikeleffekte.

---

### Motivation

Das Spiel arbeitet mit mehreren Motivationsschleifen gleichzeitig:

- **Kurzfristig (Sekunden):** Fahrzeug fertig zerlegt · Geld erhalten
- **Mittelfristig (Minuten):** Maschine kaufen · Gebäude freischalten
- **Langfristig (Stunden):** komplette Produktionslinien automatisieren · neue Karten
  freischalten · Prestige erreichen

---

### Anforderungen an die Umsetzung

- Der erste Spielstart ist ohne Erklärung verständlich.
- Das Tutorial kann in unter zwei Minuten abgeschlossen werden.
- Der Spieler trifft innerhalb der ersten zehn Minuten mindestens fünf sinnvolle Entscheidungen.
- Der Fortschritt ist jederzeit sichtbar.
- Neue Inhalte können modular ergänzt werden, ohne bestehende Systeme umzubauen.

> Diese Zusagen werden durch `npm run simulate` automatisiert überprüft.
