# Entwicklernotizen

Kurze Begründungen für Architekturentscheidungen, die sich aus dem Code allein nicht erschließen
(GDD Kapitel 9: „dokumentiere wichtige Architekturentscheidungen kurz im Code oder in
begleitenden Entwicklernotizen"). Neueste zuerst.

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
