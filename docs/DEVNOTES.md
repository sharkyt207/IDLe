# Entwicklernotizen

Kurze Begründungen für Architekturentscheidungen, die sich aus dem Code allein nicht erschließen
(GDD Kapitel 9: „dokumentiere wichtige Architekturentscheidungen kurz im Code oder in
begleitenden Entwicklernotizen"). Neueste zuerst.

---

## Die Zeichenfläche folgt ihrer eigenen Box

**Symptom.** Nur im Produktionsbuild: die installierte App öffnete auf einem
leeren Hof. Die Zeichenfläche war 2×2 Pixel groß, ihre CSS-Box 390×600.

**Ursache.** `resize()` liest das Layout. Ein gebündeltes Skript läuft
vollständig, bevor der Browser überhaupt einmal umgebrochen hat — gemessen
wurde also 0. Im Entwicklungsserver lädt derselbe Code über Dutzende
Anfragen, und bis die Oberfläche entsteht, gibt es längst ein Layout. Deshalb
war das nur gegen einen echten Build zu sehen; `npm run pwa` prüft jetzt genau
das.

**Fix.** Ein `ResizeObserver` auf der Zeichenfläche. Das behebt den Kaltstart
und nebenbei alles, was ein `window`-Listener verpasst: geteilter Bildschirm,
eingeblendete Tastatur, gedrehtes Tablet.

---

## Belohnungen werden in Lieferungen gemessen, nicht in Euro

**Symptom.** Nach Kapitel 10 stand der Bot nach 30 Minuten auf Level 96 statt
18, mit 3·10¹⁶ € Umsatz statt 4·10⁵ €. Identische Läufe schwankten um vier
Zehnerpotenzen.

**Ursache.** Feste Eurobeträge in einer exponentiellen Wirtschaft. 2.500 € für
das erste Fundstück kamen 18 Sekunden nach einem Start mit 500 €. Zwei nahe
liegende Nenner halfen nicht: ein Anteil am **Firmenwert** war noch 45× zu
heiß, weil der Firmenwert illiquide ist und die Belohnung Bargeld; ein
Vielfaches des **Einkommens** war instabil.

Der eigentliche Grund liegt in Kapitel 4: die Marge steigt mit der
Fahrzeugklasse, der Aufstieg wird nur durch Bargeld begrenzt. Eine Belohnung,
die eine Sprosse kauft, teleportiert den Hof.

**Fix.** Der Nenner ist die Leiter: höchstens vier Lieferungen, Boden beim
Startkapital. Derselbe Deckel gilt für Sachpreise, was auch einen falsch
skalierten Datensatz abfängt — die Schrottskulptur (1,2 Mio Firmenwert) war als
Belohnung einer Level-8-Nebenmission eingetragen.

---

## Ein Tutorial darf nicht das Einzige sein, was das Spiel sagt

**Symptom.** Der Browser-Flow-Test spielte vierzig Fahrzeuge und fünf Level
lang mit genau einer offenen Aufgabe: „Kaufe den Schneidbrenner".

**Ursache.** Die Einführung sperrte alle anderen Missionen, bis alle fünf
Schritte erledigt waren. Schritt drei verlangt ein bestimmtes Werkzeug — wer
sein Geld anders ausgab, bekam gar keine Missionen mehr.

**Fix.** Die Sperre gilt nur noch für die beiden Schritte, die die Kernschleife
beibringen (zerlegen, verkaufen). Danach läuft der offene Schritt als
gewöhnliche Aufgabe mit. Ein Tutorial darf vorschlagen; es darf nicht der
einzige Kanal bleiben.

---

## Meilensteine dürfen nicht in ihrer eigenen Währung zahlen

**Symptom.** Zwei Firmenwert-Meilensteine, die zehnfach auseinanderliegen,
lösten im selben Tick aus.

**Ursache.** Sie zahlten Anlagen aus — und Anlagen sind Firmenwert. Jede
Auszahlung erhöhte die Zahl, an der die nächste Schwelle gemessen wird.

**Fix.** Höchstens ein Meilenstein pro Prüfung, und die Belohnungen sind
gedeckeltes Bargeld, Punkte, verbrauchbare Fahrzeuge und Freischaltungen. Das
ist auch die treuere Lesart des Kapitels: dort werden Dinge *freigeschaltet*,
nicht verschenkt.

---

## Zwei Arten von Text, zwei Mechanismen

**Entscheidung.** Oberflächentext läuft über Schlüssel (`t('nav.market')`), Inhaltstext bleibt
bei seinen Daten und wird per Override-Tabelle übersetzt (`tc('machine', id, 'name', quelle)`).

**Warum.** Die Alternative wäre, auch Maschinennamen zu Schlüsseln zu machen. Dann braucht jede
neue Maschine zwei Dateien statt einer — genau die Reibung, die Kapitel 9 vermeiden will. Der
Preis: Inhaltsübersetzungen sind eine separate Tabelle. Das ist der richtige Tausch, weil
Inhalte hundertfach dazukommen und Sprachen einstellig bleiben.

---

## Mitarbeiter skalieren Ausstoß, nicht Prozentsätze

**Symptom.** Nach Kapitel 6 lief die Spätspiel-Wirtschaft rund 120 Zehnerpotenzen zu heiß;
Werte erreichten `Infinity` und wurden bei der nächsten Subtraktion zu `NaN`.

**Ursache.** `computeStats` gab den Produktivitätsbonus in den *Exponenten* der
Multiplikator-Effekte eines Mitarbeiters. Aus „+5 % pro Manager" wurde bei gestapelten Boni
„+105 % pro Manager".

**Fix.** Multiplikator- und Ausbeuteeffekte skalieren mit der reinen Kopfzahl, flache Effekte
behalten den Produktivitätsbonus. Zusätzlich sind alle laufenden Summen auf 1e280 gedeckelt —
eine exponentielle Kurve ist Absicht, ein `NaN` im Spielstand nicht.

---

## Prestige-Türen als Checkliste, nicht als Verhältnis

**Entscheidung.** „Produktion vollständig automatisiert" prüft sechs Dinge (Ankauf, Zerlegen,
Sortieren, Verarbeiten, Wartung, alle drei Linientypen), nicht „Automatik schlägt Tippen".

**Warum.** Die naive Messung öffnete die Tür nach einer halben Stunde. Eine Maschine, die
schneller ist als ein Daumen, ist der *Anfang* der Automatisierung, nicht das Ende.

---

## Straßen brauchen eine Schleife

**Entscheidung.** Der Hof hat eine Ringstraße an der Ostseite, obwohl das GDD sie nicht nennt.

**Warum.** Kapitel 6 verlangt „bei Stau wird eine Alternativroute gewählt". Das Straßennetz war
ein Baum: jede Plotstraße zweigte von der Hauptstraße ab, es gab nirgends einen zweiten Weg.
Ohne Schleife kann kein Router eine Alternative finden, egal wie gut er ist.

---

## Ton wird synthetisiert, nicht gesampelt

**Entscheidung.** Alle Geräusche entstehen zur Laufzeit aus Oszillatoren und gefiltertem
Rauschen.

**Warum.** Aufnahmen wären Megabytes plus eine Ladestrategie; das Spiel wiegt 82 kB ohne
Laufzeit-Abhängigkeiten. Ein Schrottplatz ist Metall, Motoren und Hydraulik — genau das, worin
subtraktive Synthese gut ist. Die Aufrufstellen fragen nur `play('shred')`, nie nach einem
Puffer, also können echte Aufnahmen das später ersetzen, ohne dass Spielcode sich ändert.

---

## Die Navigationsleiste wird nur bei Bedarf neu gebaut

**Symptom.** Tipps auf die Leiste kamen manchmal nicht an.

**Ursache.** Jedes `progress`-Ereignis baute sie neu — mehrmals pro Sekunde wurde der Button
unter dem Finger ersetzt.

**Fix.** Eine Signatur aus IDs, aktivem Eintrag und Hinweispunkten; ist sie unverändert,
passiert nichts.

---

## Fahrzeugpreise werden abgeleitet, nie gesetzt

**Entscheidung.** `Preis = Materialwert ÷ Klassenmarge`.

**Warum.** Ein früherer Datensatz hatte handgesetzte Preise, bei denen ab Stufe 2 jede Lieferung
ein Verlustgeschäft war — eine Preisanpassung an *einem* Material hatte die ganze Leiter still
umgedreht. Abgeleitete Preise können das nicht.

---

## Strom und Verschleiß drosseln, sie stoppen nie

**Entscheidung.** Unterversorgung senkt die Leistung auf minimal 40 %, völliger Verschleiß auf
60 %.

**Warum.** Kapitel 5 sagt es ausdrücklich („Strom ist kein harter Stopper, sondern ein
Effizienzfaktor"), und ein Idle-Spiel, das beim Zurückkommen stillsteht, hat den Spieler für
seine Abwesenheit bestraft.

---

## Maschinen werden ausgebaut, nicht vervielfacht

**Entscheidung.** Bei `category: 'machine'` bedeutet `maxCount` die **Levelgrenze**, nicht die
Stückzahl; Effekte skalieren über die Leveltabelle.

**Warum.** Kapitel 5 will 10 Ausbaustufen pro Maschine. Als die Logistikmaschinen noch
stückzahlbasiert waren, zeigte die Oberfläche „Stufe 16/10" und jeder Kauf oberhalb von 10 tat
nichts.

---

## Was den Neustart überlebt

**Entscheidung.** Industriepunkte, Prestige-Baum, Erfolge, entdeckte Fahrzeuge, Einstellungen
**und die Karrierezähler** (zerlegte Fahrzeuge, recyceltes Material).

**Warum.** Die seltenen Technologien aus Kapitel 7 hängen an den Karrierezählern („nach 5.000
Fahrzeugen"). Sie bei jedem Neustart zu löschen würde sie unerreichbar machen.

---

## Effekt-Deskriptoren als einziger Erweiterungspunkt

**Entscheidung.** Werkzeuge, Maschinen, Mitarbeiter, Gebäude, Technologien, Prestige-Knoten,
Erfolge und Firmen-Ausrichtungen liefern alle dieselben Deskriptoren.

**Warum.** Das ist der Grund, warum neun Kapitel Inhalte fast ohne Systemcode dazukamen. Der
Preis ist eine Indirektionsschicht; sie hat sich in jedem einzelnen Kapitel bezahlt gemacht.

**Grenze.** Eine neue *Art* von Wirkung kostet drei Stellen: `types.ts`, `applyEffect()` in
`stats.ts` und das auswertende System. Das ist bewusst so — sonst würde die Schicht undicht.
