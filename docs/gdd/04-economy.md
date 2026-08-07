# SCRAP EMPIRE — Game Design Document

## Kapitel 4 – Rohstoff-, Fahrzeug- und Wirtschaftssystem

---

### Ziel dieses Kapitels

Das Wirtschaftssystem ist das Herzstück von Scrap Empire. Jede Entscheidung des Spielers soll
wirtschaftliche Auswirkungen haben. Es soll verschiedene Strategien geben, die alle erfolgreich
sein können.

Das System muss einfach zu verstehen, aber tief genug für viele Spielstunden sein.

### Grundprinzip

Jedes Fahrzeug besteht aus mehreren Bauteilen, jedes Bauteil liefert unterschiedliche Rohstoffe.
Diese können direkt verkauft, gelagert, weiterverarbeitet oder für Forschung und
Spezialprojekte verwendet werden.

---

### Fahrzeugklassen

| Stufe | Klasse | Fahrzeuge |
| ----- | ------ | --------- |
| 1 | Alltagsfahrzeuge | Kleinwagen · Limousine · Kombi · Van · SUV |
| 2 | Nutzfahrzeuge | Transporter · Pick-up · Lieferwagen · Kleinlaster |
| 3 | Schwerfahrzeuge | Sattelzug · Bus · Traktor · Radlader · Bagger |
| 4 | Spezialfahrzeuge | Polizei · Krankenwagen · Feuerwehr · Kranwagen · Militär |
| 5 | Luxus & Exoten | Sportwagen · Oldtimer · Luxuslimousine · Supersportwagen |
| 6 | Industrie & Großobjekte | Lokomotive · Windkraftanlage · Flugzeugteile · Schiffswrack · Industrieanlage |

Höhere Stufen bringen mehr Materialwert, brauchen aber stärkere Maschinen.

> Umsetzung: Fahrzeuge entstehen aus einer **Klassenvorlage** plus einem `scale`-Faktor. Preis,
> Arbeit, Gewicht und XP werden daraus berechnet — der Kaufpreis ist immer
> `Materialwert ÷ Klassenmarge`. Die Marge steigt von 2,2× (Stufe 1) auf 3,3× (Stufe 6), damit
> Aufsteigen sich immer lohnt und die Leiter sich nie umkehren kann.

---

### Rohstoffe

**Standard:** Eisenschrott · Stahl · Aluminium · Kupfer · Messing · Edelstahl

**Kunststoffe:** Hartplastik · Weichplastik · PVC · Gummi

**Glas:** Fensterglas · Sicherheitsglas · Spezialglas

**Elektronik:** Kabel · Leiterplatten · Sensoren · Steuergeräte · Displays · Prozessoren

**Flüssigkeiten:** Motoröl · Kühlmittel · Kraftstoff · Bremsflüssigkeit — müssen fachgerecht
entsorgt oder recycelt werden. Sie **kosten** Geld, bis die Forschung
*Betriebsstoff-Recycling* sie in ein verkäufliches Produkt verwandelt.

**Selten:** Titan · Carbon · Lithium · Kobalt · Platin · Gold · Silber · Palladium

---

### Materialqualität

Jeder Rohstoff besitzt eine Qualitätsstufe: **Schlecht · Normal · Gut · Hochwertig · Rein**.
Je besser die Maschinen, desto höher die durchschnittliche Qualität — und desto höher der Preis
(0,7× bis 2,2×).

> Ein frischer Hof produziert exakt „Normal" (1,0×). Jede Verbesserung ist damit ein echter
> Gewinn und keine Aufhebung einer versteckten Strafe. Ein Lagerhaufen führt einen gewichteten
> Qualitätsdurchschnitt: neues Material mischt sich ein.

---

### Produktionsketten

```
Autokarosserie → Stahl → Schmelzofen → Stahlbarren → Walzwerk → Stahlplatten → Verkauf
Kupferkabel → Kupfergranulat → Kupferdraht → Industriekabel → Verkauf
Batterie → Lithium → Batteriezellen → Energiespeicher → Premium-Verkauf
```

15 Rezepte in vier Stufen (roh → veredelt → Bauteil → Endprodukt).

---

### Marktpreise

Die Preise sind dynamisch und verändern sich langsam: eine lange Welle (15 Minuten,
±35 %) mit einer kurzen Welle darüber (3,5 Minuten, ±10 %). Steigt Kupfer, lohnt der Verkauf;
fällt Stahl, lohnt das Lagern.

Der Lagerplatz ist begrenzt — der Spieler entscheidet: sofort verkaufen oder auf bessere Preise
warten. Das schafft strategische Tiefe.

---

### Verträge

Langfristige Kunden fordern Materialmengen und zahlen dafür eine Prämie **plus regelmäßiges
Einkommen** (10 Minuten lang). Acht Kunden von der Baufirma bis zum Luftfahrtzulieferer; die
Menge skaliert mit dem Level.

> Material, das ein angenommener Vertrag noch braucht, wird von der Verkaufsautomatik
> **nicht** angerührt. Ein Förderband, das den gerade zugesagten Stahl wegverkauft, wäre eine
> Falle, keine Entscheidung.

---

### Auktionen

Mehrmals pro Spieltag geht ein Posten unter den Hammer: Unfallfahrzeuge, Firmenauflösungen,
Militärüberschüsse, Schiffswracks, Container. Der Spieler bietet gegen KI-Unternehmen, die bis
zu einer verdeckten Obergrenze (55–75 % des Schätzwerts) mitgehen. Wer darüber bietet, zahlt
drauf.

---

### Zufallsfunde

Beim Zerlegen besteht eine Chance auf Sammlerstücke: Werkzeugkiste, Bargeld, historisches
Kennzeichen, seltene Felgen, Goldmünzen, Schmuck, Sammlermodell, signiertes Bauteil, Prototyp.
Höhere Fahrzeugklassen bringen bessere Funde. Sie lassen sich verkaufen oder in der Vitrine
behalten — behaltene Stücke zählen zum Firmenwert.

---

### Firmenwert

Neben Geld besitzt der Spieler einen Firmenwert. Er steigt durch Gebäude, Maschinen,
Grundstücke, Lagerbestand, Mitarbeiter, Forschungsfortschritt und die Sammlung.

---

### Inflation & Spielbalance

- Einnahmen steigen stetig (höhere Klassen, bessere Qualität, Verträge).
- Upgrades werden teurer (exponentielle Kostenkurve).
- Neue Produktionsketten sind deutlich profitabler als alte.
- Alte Maschinen bleiben nützlich, sind aber nicht mehr optimal.

---

### Architekturhinweis

Die Wirtschaft besteht aus getrennten Modulen; alle Werte stehen in Konfigurationsdateien statt
im Code:

| Modul | Datei |
| ----- | ----- |
| Vehicle Database | `src/data/vehicles.ts` |
| Material Database | `src/data/materials.ts` |
| Market System | `src/economy/market.ts` |
| Contract System | `src/economy/contracts.ts` |
| Auction System | `src/economy/auctions.ts` |
| Inventory System | `src/economy/inventory.ts` |
| Economy Manager | `src/economy/manager.ts` |
| Zufallsfunde | `src/economy/collection.ts` |
| Zentrale Konfiguration | `src/data/economy.ts` |
| Vertrags-, Auktions- und Funddaten | `src/data/trade.ts` |
