# SCRAP EMPIRE — Game Design Document

## Kapitel 6 – Gebäude, Mitarbeiter & Logistiksystem

---

### Ziel dieses Kapitels

Aus dem Schrottplatz wird ein Unternehmen. Der Spieler verteilt keine Einzelaufgaben mehr,
sondern trifft strategische Entscheidungen: Wen stelle ich ein, was baue ich, worauf richte ich
den Betrieb aus. Der Rest läuft von allein — sichtbar, aber ohne Mikromanagement.

### Die fünf Firmenphasen

| Phase | Gebäude | Rollen |
| ----- | ------- | ------ |
| Einzelunternehmer | Werkbank, Schuppen | keine |
| Kleinbetrieb | Werkstatt, Lagerhalle, Büro | Mechaniker, Lagerarbeiter |
| Mittelbetrieb | Sortierhalle, Aufenthaltsraum, Tankstelle | Staplerfahrer, Elektriker, LKW-Fahrer |
| Industrieunternehmen | Fahrzeughalle, Leitstand, Erste-Hilfe-Station, Feuerwache | Disponent, Werkschutz, Datenanalyst |
| Konzern | Sicherheitszentrale, Containerterminal, Konzernzentrale | Forschungsleiter, KI-Operator, Geschäftsführung |

Jedes Gebäude trägt Baukosten, Unterhaltskosten, Stromverbrauch und Kapazität; jeder Mitarbeiter
Gehalt, Erfahrungslevel und Spezialisierung. Alle Werte stehen in `purchasables.ts`, die
Stellschrauben darüber in `data/company.ts`.

---

### Mitarbeiter

Ein Mitarbeiter ist keine Zahl, die man kauft und vergisst:

- **Gehalt** — läuft sekündlich vom Konto, zusammen mit dem Gebäudeunterhalt.
- **Erfahrungslevel 1–10** — steigt, solange der Hof arbeitet. Jede Stufe gibt +9 % Leistung
  und kostet +8 % Gehalt. Die erste Beförderung kommt nach wenigen Minuten, die Meisterschaft
  nach Stunden.
- **Spezialisierung** — jede Rolle wirkt über dieselben Effekt-Deskriptoren wie Maschinen, also
  auf Zerlegen, Verkauf, Ankauf, Wartung, Forschung oder Qualität.

> **Kein Rauswurf.** Reicht das Geld für die Löhne nicht, kündigt niemand — das Team arbeitet mit
> 60 % Tempo weiter, bis der Rückstand abbezahlt ist. Das ist die Bestrafungsfreiheit aus
> Kapitel 1, angewendet auf die Personalkosten.

---

### Prioritäten statt Arbeitsanweisungen

Der Spieler weist keine Einzelaufgaben zu. Er legt eine Ausrichtung fest, das System arbeitet
danach:

| Ausrichtung | Wirkung |
| ----------- | ------- |
| Ausgeglichen | keine besondere Gewichtung |
| Produktion maximieren | +20 % Zerlegen und Verarbeitung, dafür 60 % mehr Verschleiß |
| Wartung bevorzugen | 3× automatische Wartung, halber Verschleiß |
| Forschung beschleunigen | +60 % Forschungstempo, +25 % Erfahrung, −10 % Durchsatz |
| Lager auffüllen | +35 % Lagerplatz, zurückhaltendere Verkaufsautomatik |
| Verträge priorisieren | +35 % Vertragsprämie, ein zusätzlicher Auftragsplatz |

Der Wechsel ist sofort und kostenlos: Prioritäten sind zum Nachjustieren da, nicht zum
Festlegen. Technisch sind sie eine weitere Effektquelle in `computeStats` — kein Sonderweg.

---

### Lagerregeln

Pro Material lässt sich ein Dauerauftrag hinterlegen, genau wie im GDD beschrieben:

- „Immer mindestens 500 Stahl lagern" → **Mindestbestand**
- „Gold niemals automatisch verkaufen" → **Sperre**
- „Kupfer erst ab Preis X verkaufen" → **Mindestpreis**

Die Regeln gelten für die Verkaufsautomatik *und* für „Alles verkaufen" — eine Regel, die der
große Knopf ignoriert, wäre keine.

---

### Logistik

Alle Gebäude hängen an einem echten Straßennetz. Die Straßen, die die Karte zeichnet, sind
dieselben, auf denen die Fahrzeuge fahren:

- Jede Plotstraße zweigt von der Hauptstraße oder der öffentlichen Straße ab; ein T-Stück wird
  beim Aufbau des Graphen automatisch zur Kreuzung aufgetrennt.
- Eine **Ringstraße** an der Ostseite gibt dem Hof eine zweite Verbindung. Ohne Schleife könnte
  es die vom GDD geforderte Alternativroute nicht geben.
- Routing ist Dijkstra über `Länge × (1 + Auslastung)`. Die kürzeste Route gewinnt, ein
  belegter Abschnitt wird teuer, und das nächste Fahrzeug fährt außen herum — ohne Sonderfall.
- **Kollisionsvermeidung**: Wer jemandem direkt auffährt, wird langsamer, bis auf 18 % Tempo.
  Nie bis zum Stillstand — ein verklemmter Hof liest sich wie ein Bug, nicht wie Verkehr.

### Fuhrpark

| Klasse | Aufgabe | Freischaltung |
| ------ | ------- | ------------- |
| Hubwagen | innerbetrieblich | von Anfang an |
| Gabelstapler | innerbetrieblich | Staplerfahrer |
| Kleintransporter | Anlieferung, Versand | von Anfang an |
| LKW | Anlieferung, Versand | LKW-Fahrer |
| Schwertransporter | schwere Anlieferung | Fahrzeughalle |
| Containerfahrzeug | Versand | Containerterminal |

Aufträge landen in einer Warteschlange, nicht bei einem festen Besitzer. Der Disponent gibt jede
Fahrt an die *kleinste freie Klasse, die die Last trägt* — so bleiben die großen Fahrzeuge für
die großen Jobs frei. Das ist die „intelligente Aufgabenverteilung" aus dem GDD.

Der Verkehr ist ein Messgerät: Wie viele Fahrzeuge unterwegs sind, folgt der tatsächlichen
Zerlege- und Verkaufsleistung. Ein leerer Hof hat leere Straßen.

---

### Betriebszahlen

Auf dem Firma-Tab sieht der Spieler jederzeit: Tagesgewinn, Wochengewinn, Produktionsmenge,
Lagerbestand, Stromverbrauch, Mitarbeiterzahl, Firmenwert, Effizienz, CO₂-Einsparung und die
laufenden Kosten. Ein Geschäftstag sind die 15 Minuten aus Kapitel 3, eine Woche sieben davon.

Die Effizienz ist ein einziger, ehrlicher Wert: `Strom × Anlagenzustand × Zahlungsfähigkeit`.
Liegt sie unter 95 %, nennt der Bildschirm den Grund.

---

### Anforderungen an die Umsetzung

| Baustein | Ort |
| -------- | --- |
| Löhne, Unterhalt, Erfahrung | `src/company/payroll.ts` |
| Lagerregeln | `src/company/warehouse.ts` |
| Betriebszahlen | `src/company/statistics.ts` |
| Prioritäten und Personalkonfiguration | `src/data/company.ts` |
| Gebäude, Mitarbeiter, Plätze | `src/data/purchasables.ts` |
| Fuhrpark und Verkehrsregeln | `src/data/fleet.ts` |
| Straßennetz und Routing | `src/world/roads.ts` |
| Fahrzeug-KI und Disposition | `src/world/traffic.ts` |
| Oberfläche | `src/ui/screens/company.ts`, `src/ui/screens/storage.ts` |

### Endzustand

Im Spätspiel trifft der Spieler nur noch strategische Entscheidungen: expandieren, forschen,
Ausrichtung wechseln, Verträge annehmen. Zerlegen, Sortieren, Verkaufen und Transportieren
erledigt das Unternehmen selbst — sichtbar auf der Karte, nachlesbar in den Betriebszahlen.
