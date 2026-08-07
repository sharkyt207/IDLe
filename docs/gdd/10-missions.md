# SCRAP EMPIRE — Game Design Document

## Kapitel 10 – Tutorial, Missionen & Spielerführung

---

### Ziel dieses Kapitels

Der Spieler soll nie ratlos sein, ohne je bevormundet zu werden. Alles hier
führt, nichts hier zwingt: jede Mission ist optional, keine kann verloren
gehen, und jede Erklärung lässt sich abschalten.

---

### Spielbeginn

Eine Kamerafahrt über den Hof, ein Pickup fährt vor, ein kurzer Begrüßungstext.
In dieser Reihenfolge — der LKW rollt schon, während die Kamera noch fährt, und
der Text kommt erst, wenn sie steht.

Die Sequenz dauert 3,4 Sekunden und **jede Berührung bricht sie ab**. Ein
Vorspann, den man nicht überspringen kann, ist der schnellste Weg, eine erste
Sitzung langsam wirken zu lassen. Sie läuft genau einmal pro Unternehmen
(`missions.introSeen` im Spielstand).

Die Kamerafahrt ist die einzige Stelle im Spiel, an der sich die Kamera von
selbst bewegt — Kapitel 2 verbietet das ausdrücklich, und eine einmalige
Ausnahme zum Auftakt ist genau der Fall, der diese Regel nützlich macht.

---

### Die fünf Einführungsmissionen

| # | Mission | Ziel | Belohnung |
| - | ------- | ---- | --------- |
| 1 | Der erste Schrott | Kleinwagen komplett zerlegen | 250 € · 10 XP · Erfolg „Erster Schrott" |
| 2 | Schrott zu Geld | Material verkaufen | 500 € · Materialübersicht |
| 3 | Besseres Werkzeug | Schneidbrenner kaufen | 750 € · Werkzeugkapitel |
| 4 | Ein Dach über dem Hof | Werkstatt errichten | 1.200 € · Gebäudekapitel |
| 5 | Chef statt Arbeiter | Ersten Mechaniker einstellen | 2.000 € · Mitarbeiterkapitel |

Sie sind **keine Sonderlogik**, sondern gewöhnliche Missionen mit
`kind: 'tutorial'` — dieselbe Datei, derselbe Fortschritts-Tracker, dieselben
Belohnungen. Genau das war der Grund für den Umbau: „Zerlege dein erstes
Fahrzeug" existierte vorher zweimal, einmal im Tutorial-Skript und einmal als
Erfolg.

Sie erscheinen einzeln und in Reihenfolge; erst wenn alle fünf erledigt sind,
öffnen sich Haupt-, Neben- und Zeitmissionen. Fünf Schritte auf einmal wären
eine Textwand, kein Tutorial.

**Die Werkstatt ist echt.** Der Mechaniker verlangt jetzt
`requires: { level: 3, flags: ['workshop'] }`, also schaltet Mission 4 wirklich
frei, was sie verspricht — statt es nur zu behaupten.

Der eine handgeschriebene Moment bleibt: nach dem ersten fertigen Fahrzeug
wählt der Spieler ein kostenloses Upgrade aus drei Optionen. Es gibt keine
falsche Wahl; die erste Entscheidung im Spiel soll sich wie eine Entscheidung
anfühlen, nicht wie eine Prüfung.

---

### Missionssystem

| Art | Herkunft | Läuft ab |
| --- | -------- | -------- |
| Einführung | fest, in Reihenfolge | nie |
| Hauptmissionen | Kette (`after`), 12 Stück | nie |
| Nebenmissionen | ungeordnet, 8 Stück | nie |
| Täglich | 2 aus einem Pool von 6 | Mitternacht |
| Wöchentlich | 1 aus einem Pool von 4 | Montag |

Ein Ziel ist ein Metrikname aus `src/progress/tracker.ts` plus eine Menge. Eine
neue Mission ist damit ein Datensatz — nie eine neue Bedingung, die jemand
auswerten muss.

**Tägliche Missionen kommen aus dem Kalender, nicht aus einem Timer.** Wer
einmal pro Woche spielt, bekommt einen frischen Satz statt sechs alten, und
niemand kann eine Tagesmission farmen, indem er die App offen lässt. Der Wurf
ist mit dem Datum initialisiert: derselbe Tag ergibt immer denselben Satz, ein
Neuladen kann also nicht auf etwas Leichteres würfeln.

**Nichts kann fehlschlagen.** Eine abgelaufene Tagesmission wird *ersetzt*, nie
bestraft — Kapitel 1 schließt Bestrafungsmechaniken aus, und das Missionssystem
ist das einzige, das sonst in Versuchung käme.

#### Skalierung

Zählziele (Fahrzeuge, Aufträge, Technologiestufen) wachsen linear mit dem
Level. **Geldziele wachsen mit dem Firmenwert**, und das ist keine Kosmetik:
die Wirtschaft ist exponentiell, ein linearer Faktor auf das Spielerlevel ist
es nicht. Eine „verdiene heute 25.000 €"-Mission mit Levelskalierung war in der
30. Minute in unter zwei Minuten erledigt.

---

### Meilensteine

| Firmenwert | Meilenstein |
| ---------- | ----------- |
| 10.000 € | Der Hof läuft |
| 100.000 € | Neues Gebäude |
| 1 Mio € | Neue Fahrzeuge |
| 10 Mio € | Neue Produktionslinie |
| 100 Mio € | Neugründung sichtbar |
| 1 Mrd € | Konzern |

Meilensteine werden nie angenommen, nie als Aufgabe angezeigt und können nie
verpasst werden. Sie passieren einfach — das ist es, was sie wie Wachstum
wirken lässt statt wie eine weitere Checkliste.

**Höchstens einer pro Prüfung.** Der Firmenwert kann sich durch einen einzigen
großen Verkauf um eine Zehnerpotenz bewegen, und drei Meilensteine im selben
Frame sind drei Feiern gleichzeitig — und, wenn die Belohnungen Anlagen wären,
eine Kaskade: jede Auszahlung erhöht die Zahl, an der die nächste Schwelle
gemessen wird. Genau das ist im Balancing-Harness passiert (siehe unten).

Sie melden sich als Hinweis oben rechts, nicht als Fenster. Ein Meilenstein
fällt mitten in eine Aktion; ein Dialog, der dafür den Bildschirm nimmt, ist
eine Unterbrechung im Festtagskleid.

---

### Aufgabenanzeige

Links oben, **höchstens drei** Einträge, jeder mit Symbol, Titel,
Fortschrittsbalken, Belohnung und einem Weg dorthin, wo die Arbeit passiert.
Angezeigt werden die verfolgte Mission (die hat der Spieler ausgewählt) und
danach die, die am nächsten an der Fertigstellung sind.

- **Tippen** springt zum passenden Bildschirm („Verfolgen").
- **Gedrückt halten** heftet die Mission oben an.
- Der Farbstreifen links zeigt die Art: Einführung, Haupt, Neben, Zeitmission.

Abseits der isometrischen Ansicht verschwindet die Liste: dort läge sie genau
auf dem Inhalt, den sie ergänzen soll. Mitgereist kommt trotzdem die Zahl der
offenen Aufgaben — als 🎯-Chip in der oberen Leiste, also in einem reservierten
Band statt als Overlay. Ein Tipp darauf öffnet die Missionsliste.

Neu gebaut wird sie nur, wenn sie anders aussehen würde; denselben Grund hat
die Navigationsleiste (Kapitel 9).

---

### Belohnungen

Geld, Erfahrung, Forschungspunkte, Industriepunkte, Materialien, Maschinen,
Gebäude, Dekorationen, Fahrzeuge, Freischaltungen und Spezialkisten — alles
Deskriptoren, aus demselben Grund wie die Effekte: eine neue Mission ist ein
Datensatz.

#### Warum Belohnungen gedeckelt sind

Feste Eurobeträge funktionieren hier nicht. Die Wirtschaft ist exponentiell,
die Zahlen in einer Datendatei sind es nicht — also ist jede Belohnung entweder
belanglos oder gewaltig, je nachdem, wann sie kommt. Das Balancing-Harness hat
beide Fehlermodi vorgeführt:

1. **Fester Betrag.** 2.500 € für das erste Fundstück, 18 Sekunden nach einem
   Start mit 500 €. Nach 30 Minuten: Level 96 statt 18, Umsatz 3·10¹⁶ € statt
   4·10⁵ €.
2. **Anteil am Firmenwert.** Immer noch 45× zu heiß — der Firmenwert steckt
   größtenteils in Grundstücken, Anlagen und Lagerbestand, die Belohnung ist
   Bargeld, und Bargeld ist der Engpass.
3. **Vielfaches des Einkommens.** Schlimmer: instabil. Identische Läufe
   schwankten zwischen 10× und 30.000×.

Der Grund liegt in Kapitel 4. Die Marge steigt mit der Fahrzeugklasse
(2,2 → 3,3), eine Sprosse höher ist also immer besser, und das Einzige, was den
Aufstieg begrenzt, ist Bargeld. Eine Belohnung, die eine Sprosse kauft, hebt
den Hof nicht an — sie teleportiert ihn, und das schaukelt sich auf.

Der Nenner ist deshalb die Leiter selbst: **eine Belohnung ist höchstens vier
Lieferungen wert**, plus einen Boden in Höhe des Startkapitals, damit die
ersten zwei Stunden trotzdem großzügig sind. Das ist auf jeder Stufe sinnvoll,
braucht keine Feinabstimmung pro Mission und kann keine Klasse überspringen —
dieselbe Begründung, aus der Fahrzeugpreise abgeleitet und nicht gesetzt werden.

Derselbe Deckel gilt für Sachpreise: ein geschenkter Gegenstand, der teurer
wäre als die Bargeldvariante, wird als Bargeld ausgezahlt. Das ist die Bremse,
die einen falsch skalierten Datensatz auffängt — die Schrottskulptur ist
1,2 Mio Firmenwert wert, und sie als Belohnung einer Nebenmission auf Level 8
hat den Spieler an zwei Meilensteinen vorbeigeschoben.

**Spezialkisten** haben einen festen Wert pro Stufe und zufälligen Inhalt. Das
macht sie zur Überraschung statt zur Lotterie, die man verlieren kann. Ihre
Forschungspunkte sind bewusst knapp: das Labor ist das Eine, was Geld nicht
kaufen soll (Kapitel 7).

---

### Hilfe & Lexikon

Acht Kapitel: Grundlagen (FAQ), Materialien, Werkzeuge, Gebäude, Maschinen,
Mitarbeiterrollen, Fahrzeuge, Forschung. 213 Einträge.

Nichts davon ist ein handgeschriebenes Handbuch — **jeder Eintrag wird aus den
laufenden Inhalten erzeugt**. Das Lexikon kann deshalb keine Maschine
beschreiben, die letzte Woche umbalanciert wurde, und eine neue Maschine
dokumentiert sich selbst.

Zwei Schranken, bewusst unterschiedlich:

- Ein **Kapitel** öffnet sich, wenn eine Mission seine Freischaltung auszahlt —
  der Spieler wurde dem Thema vorgestellt.
- Ein **Eintrag** erscheint, wenn die Sache selbst begegnet ist: besessen,
  produziert, erforscht oder zerlegt.

Ein Eintrag, der vor der Sache da ist, ist kein Hilfetext, sondern ein
Spoiler. Der Zähler oben („28 von 213 entdeckt") macht daraus nebenbei ein
eigenes stilles Ziel.

---

### Hinweise & Mentor

Drei Regeln, alle über Zurückhaltung:

1. **Jeder Hinweis genau einmal.** Was gelesen wurde, ist kein Hinweis mehr,
   sondern Lärm. Die IDs stehen im Spielstand.
2. **Einer nach dem anderen, mit Abstand.** Auch ein Hof, an dem fünf Dinge
   falsch laufen, bekommt einen Satz pro Minute statt fünf auf einmal. Nach dem
   Start 45 Sekunden Ruhe — das Tutorial redet bereits.
3. **Abschaltbar, und dann bleibt es aus.** `settings.hints` und
   `settings.mentor` sind getrennte Schalter: wem die Stimme zu viel ist, will
   meistens trotzdem wissen, dass das Lager voll ist. Beide unter
   Einstellungen → Spielerführung, dazu „Hinweise zurücksetzen".

Hinweise sind als Beobachtungen formuliert, nicht als Anweisungen. „Dein Lager
ist fast voll" respektiert den Spieler mehr als „Du solltest jetzt…". Ein Tipp
auf den Hinweis öffnet den passenden Bildschirm.

Der Mentor ist eine Stimme, kein System: freundlich, kompetent, kurz. Mehrere
Varianten pro Anlass, und nie zweimal hintereinander dieselbe.

---

### Schwierigkeitskurve & Wiedereinstieg

Die ersten zwei Stunden sind großzügig: die Einführungsbelohnungen sind groß
gemessen an dem, was der Hof dann verdient, und der Belohnungsboden liegt beim
Startkapital, damit die ersten Missionen wirklich etwas ändern.

Nach längerer Abwesenheit (ab einer Stunde) zeigt die Rückkehr mehr als eine
Abrechnung: was verdient wurde, **was ansteht** (die drei offenen Aufgaben) und
**was wartet** (volles Lager, offene Anfragen, Lohnrückstand, Wartung, leere
Bühne) — dazu ein Satz vom Mentor. Nach zehn Minuten Pause braucht niemand ein
Briefing, deshalb die Schwelle.

---

### Technische Architektur

| Modul | Datei |
| ----- | ----- |
| Tutorial Manager | `src/ui/tutorial.ts` (Coach) + `src/missions/manager.ts` (Schritte) |
| Mission Manager | `src/missions/manager.ts` |
| Daily Mission Generator | `src/missions/daily.ts` |
| Milestone Manager | `src/missions/milestones.ts` |
| Belohnungen | `src/missions/rewards.ts` |
| Hint Manager & Mentor | `src/missions/hints.ts` |
| Help & Encyclopedia | `src/missions/help.ts`, `src/ui/screens/help.ts` |
| Progress Tracker | `src/progress/tracker.ts` |
| Aufgabenanzeige | `src/ui/tasks.ts` |
| Intro | `src/ui/intro.ts` + `WorldRenderer.startIntro` |
| Inhalte | `src/data/missions.ts`, `src/data/help.ts` |

Der **Progress Tracker** ist der Schlüssel: eine Stelle, die beantwortet „wie
hoch ist X gerade". Erfolge, Missionen und Meilensteine fragen dort, statt
jeweils neu zu implementieren, was „zerlegte Fahrzeuge" heißt. Vorher hätte
jede neue Missionsart eine eigene `switch`-Anweisung bedeutet, und zwei davon
wären beim ersten Bedeutungswechsel eines Zählers auseinandergelaufen.

Freischaltungen aus Missionen landen in derselben Menge, in die auch Gebäude
und Forschung schreiben (`stats.unlocks`), also funktioniert `requires.flags`
überall weiter, ohne dass es eine zweite Art von Schranke gibt.

---

### Prüfungen

`npm run simulate` spielt die Einführung jetzt wirklich durch statt sie zu
überspringen — die fünf Missionen sperren alle anderen, ein Lauf, der hinter
ihnen beginnt, würde die eine Sequenz nie testen, die jeder Spieler sieht.

```
✅ Einführung abgeschlossen — 5/5 Schritte
✅ Missionen laufen durch — 16 erfüllt
✅ Immer eine offene Aufgabe — 3 offen
✅ Aufgabenliste bleibt bei höchstens drei — 3 gleichzeitig
✅ Meilensteine greifen — 2 erreicht
✅ Lexikon füllt sich — 60 von 212 Einträgen
```

`npm test -- ch10` prüft im echten Browser: Intro-Ablauf und Abbruch, die fünf
Schritte in Reihenfolge, die Werkstatt-Schranke, die Aufgabenliste samt
Anheften, jede Belohnungsart, den Kaskadenschutz der Meilensteine, den
kalendergesteuerten Tageswurf, das Lexikon vor und nach einer Freischaltung,
Hinweise (einmal je, abschaltbar), die Migration v4 → v5 und einen Neustart.
