# SCRAP EMPIRE — Game Design Document

## Kapitel 7 – Forschung, Technologien & Prestige

---

### Ziel dieses Kapitels

Der Spieler soll nie das Gefühl haben, alles erreicht zu haben. Drei Systeme sorgen dafür:
Forschung, Technologien und Prestige — der langfristige Motivationstrichter.

---

### Forschung lässt sich nicht kaufen

Eine Technologiestufe kostet **Forschungspunkte, Geld und oft seltene Materialien**. Punkte
entstehen nur im Labor, Materialien nur beim Zerlegen. Ein reicher Spieler muss also weiter
einen Hof betreiben — Geld allein erzwingt keinen Fortschritt.

### Das Forschungslabor

10 Ausbaustufen. Jede hebt:

| Wirkung | Pro Stufe |
| ------- | --------- |
| Forschungspunkte | +0,14 /s |
| Forschungstempo | +12 % |
| Höchste Technologiestufe | +1 |
| Parallele Projekte | +1 auf Stufe 4 und 8 |

Damit ist das Labor ein Gebäude mit Ausbaupfad, kein Häkchen. Die erste Technologie ist
bewusst innerhalb der ersten Spielsitzung erreichbar — ein Labor, das eine halbe Stunde lang
nichts produziert, liest sich als Fehler, nicht als Langsamkeit.

---

### Der Technologiebaum

Acht Zweige, wie im GDD:

| Zweig | Verbessert / schaltet frei |
| ----- | -------------------------- |
| **Maschinen** | Geschwindigkeit, Haltbarkeit, Energieverbrauch, Qualität — bis zur Quantenhydraulik |
| **Materialkunde** | Reinheit, Ausbeute, Wiederverwertbarkeit, neue Legierungen |
| **Robotik** | Greifarme, Wartungsroboter, Sortierroboter, Schweißroboter, Transportdrohnen |
| **KI** | Marktanalyse, Preisprognose, Produktionsplanung, Lagerverwaltung, selbstoptimierende Fabrik |
| **Energie** | Solar, Wind, Biogas, Wasserstoff, Fusionsreaktor |
| **Logistik** | Lieferzeiten, Lager, Routenplanung, internationaler Handel |
| **Personal** | Motivation, Produktivität, Weiterbildung, Gehaltskosten |
| **Umwelttechnik** | Emissionen, Abfall, Firmenimage, Fördergelder |

**Jede Technologie hat mehrere Stufen, und nicht jede Stufe ist nur eine Zahl.** Neben den
`perLevel`-Effekten, die sich stapeln, tragen viele Technologien **Meilensteine**, die einmalig
auf einer bestimmten Stufe zünden und das Gameplay verändern:

```
Robotik   Stufe 1  +7 %
          Stufe 2  Greifarm und Sortierroboter werden baubar
          Stufe 3  Wartungsroboter halten die Anlagen instand
          Stufe 4  +7 %
          Stufe 5  KI-Unterstützung: +25 % Sortierung, Transportdrohnen
```

Genau so schaltet die Robotik-Forschung auch tatsächlich die Roboter im Ausbau frei —
Freischaltungen sind `unlock`-Effekte auf Meilensteinen, keine Sonderfälle im Code.

### Seltene Technologien

Manche Forschungen erscheinen **gar nicht**, bis eine Bedingung erfüllt ist, die sich nicht
kaufen lässt:

| Technologie | Bedingung |
| ----------- | --------- |
| Industrie 5.0 | 5.000 zerlegte Fahrzeuge |
| Autonome Fabrik | 3 Neugründungen |
| Exotische Legierungen | Fund eines unbekannten Metalls |

Sie stehen nicht als Schloss im Baum, sondern tauchen auf. Ein sichtbar gesperrter Knoten ist
ein Ziel; ein unsichtbarer ist eine Überraschung — und Überraschung ist hier der Zweck.

---

### Prestige

Prestige ist kein Spielende, sondern ein Neustart auf höherem Niveau. **Drei unabhängige
Türen** öffnen ihn, damit unterschiedliche Spielweisen ihn erreichen:

- Firmenwert 500 Mio €
- Produktion vollständig automatisiert
- Forschung zu 90 % abgeschlossen

„Vollständig automatisiert" ist eine Checkliste, kein Verhältnis: Ankauf, Zerlegen, Sortieren,
Verarbeiten, Wartung und alle drei Linientypen. Würde man es als „Maschinen schlagen den
Daumen" messen, stünde die Tür nach einer halben Stunde offen — eine Maschine, die schneller
ist als ein Finger, ist der *Anfang* der Automatisierung, nicht das Ende.

### Industriepunkte

Beim Neustart gibt es Industriepunkte: `√(Umsatz des Durchlaufs / 250.000)` plus einen Punkt
je Erfolg. Sie bleiben dauerhaft und werden im **Prestige-Baum** ausgegeben:

| Zweig | Inhalt |
| ----- | ------ |
| Produktion | Geschwindigkeit, Qualität, Automatisierung |
| Wirtschaft | Verkaufspreise, Einkaufspreise, Verträge, Startkapital |
| Forschung | Forschungspunkte, Labor, Technologiekosten |
| Logistik | Fahrzeuge, Lager, Transport, Strom |
| Spezial | exklusive Gebäude, seltene Funde, kosmetische Inhalte |

### Prestige-Level

Jeder Durchlauf macht die Welt etwas teurer (+6 % Technologiekosten, gedeckelt bei 12
Durchläufen) und die Belohnungen deutlich größer. Bewusst mild: die Kurve soll sich nach oben
biegen, nicht Veteranen bestrafen.

**Was den Neustart überlebt:** Industriepunkte, der Prestige-Baum, Erfolge, entdeckte
Fahrzeuge, die Karrierezähler (zerlegte Fahrzeuge, recyceltes Material) und die Einstellungen.
Die Karrierezähler bleiben bewusst, weil die seltenen Technologien auf ihnen sitzen — sie bei
jedem Neustart zu löschen würde sie unerreichbar machen.

---

### Endgame

Nach mehreren Durchläufen wächst der Umfang deutlich über den Schrottplatz hinaus:

| Inhalt | Ab |
| ------ | -- |
| Internationaler Handel | 1 Neugründung |
| Schiffsrecycling | 1 Neugründung + Containerhafen |
| Flugzeugfriedhof | 2 Neugründungen |
| Weltraumschrott-Annahme | 3 Neugründungen + Fusionsreaktor |
| Orbitale Recyclingstation | 4 Neugründungen + selbstoptimierende Fabrik |

---

### Erfolge

Zwölf Erfolge belohnen unterschiedliche Spielweisen — Zerlegen, Sammeln, Automatisieren,
Forschen, Ausbilden, Neugründen. Sie geben einen Titel, einen Industriepunkt und einen
**bewusst winzigen** dauerhaften Bonus (2–5 %). Erfolge sollen ein Nicken sein, kein zweites
Fortschrittssystem, das eine ungespielte Spielweise zur Pflicht macht.

---

### Langzeitmotivation

| Horizont | Ziel |
| -------- | ---- |
| Kurzfristig | die nächste Maschine |
| Mittelfristig | das nächste Gebäude, die nächste Technologiestufe |
| Langfristig | Prestige |
| Sehr langfristig | vollständiger Technologiebaum, alle Karten, alle Fahrzeuge, alle Erfolge |

---

### Anforderungen an die Umsetzung

Sechs unabhängige Module, jedes einzeln testbar:

| Modul | Ort |
| ----- | --- |
| Research Manager | `src/progress/research.ts` |
| Prestige Manager | `src/progress/prestige.ts` |
| Achievement Manager | `src/progress/achievements.ts` |
| Permanent Bonus System | `src/progress/bonuses.ts` |
| Unlock Manager | `src/progress/unlocks.ts` |
| Technology Tree (Daten) | `src/data/tech.ts` |
| Prestige-Baum (Daten) | `src/data/prestige.ts` |
| Erfolge (Daten) | `src/data/achievements.ts` |
| Stellschrauben | `src/data/progress.ts` |

Der Baum ist vollständig datengetrieben: eine neue Technologie ist ein Objekt in `tech.ts`,
eine neue Prestige-Stufe ein Objekt in `prestige.ts`, ein neuer Erfolg ein Objekt in
`achievements.ts`. Kein Systemcode.

### Roadmap

Die Architektur hat bereits Platz für spätere Inhalte, ohne Spielstände zu zerstören:

- **Neue Karten und Kontinente** — ein Rechteck in `lots.ts` plus ein Kaufobjekt.
- **Neue Materialklassen** (radioaktiv, exotisch) — ein Eintrag in `materials.ts`.
- **Saisonale Events und Herausforderungen** — `Requirement.progress` nimmt neue Bedingungen
  auf, ohne dass ein bestehendes Gate angefasst wird.
- **Neue dauerhafte Bonusquellen** (Season Pass, Event-Belohnung) — eine weitere Funktion in
  `bonuses.ts`; `stats.ts` bleibt unverändert.
- **NPC-Kooperationen** — Verträge sind schon eine Datenliste.

Speicherstände sind versioniert und werden beim Laden saniert: unbekannte Technologien,
Erfolge und Prestige-Knoten fliegen still raus, statt den Start zu blockieren. Die Migration
von Kapitel 6 auf Kapitel 7 (`research.done` → Technologiestufen, Reputation →
Industriepunkte) läuft automatisch.
