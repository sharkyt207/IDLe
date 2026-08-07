# Scrap Empire

Idle-/Tycoon-Prototyp für Smartphones: aus einem verlassenen Schrottplatz wird Schritt für
Schritt ein automatisiertes Recycling-Imperium.

Umsetzung von [GDD Kapitel 1 (Vision)](docs/gdd/01-vision.md),
[Kapitel 2 (Core Gameplay)](docs/gdd/02-core-gameplay.md),
[Kapitel 3 (Spielwelt)](docs/gdd/03-world.md),
[Kapitel 4 (Wirtschaft)](docs/gdd/04-economy.md),
[Kapitel 5 (Maschinen)](docs/gdd/05-machines.md),
[Kapitel 6 (Unternehmen)](docs/gdd/06-company.md),
[Kapitel 7 (Forschung & Prestige)](docs/gdd/07-research-prestige.md),
[Kapitel 8 (UI, UX & Art Direction)](docs/gdd/08-ui-ux.md) und
[Kapitel 9 (Architektur)](docs/gdd/09-architecture.md).

## Loslegen

```bash
npm install
npm run dev        # http://localhost:5173 - am besten in der Mobilansicht öffnen
```

| Befehl | Zweck |
| ------ | ----- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktionsbuild nach `dist/` |
| `npm run preview` | Produktionsbuild lokal testen |
| `npm run typecheck` | TypeScript im strict mode |
| `npm run simulate` | Headless-Balancinglauf (30 Min.), prüft die GDD-Zusagen |
| `npm test` | 8 Browser-Suiten in echtem Chromium |
| `npm run i18n` | Übersetzungsstand und Suche nach hartkodiertem Text |
| `npm run check` | typecheck + simulate + test |

## Was drin ist

**Kernschleife** — Schrott ankaufen → per Fingertipp zerlegen → Materialien lagern, verarbeiten
und verkaufen → Gewinn reinvestieren → Gelände erweitern → neu gründen (Prestige).

**Tutorial** in fünf Schritten, in unter zwei Minuten spielbar, inklusive der im GDD
festgelegten ersten Investitionsentscheidung (Hammer / Lager / Magnetkran) — ohne falsche Wahl.

**Automatisierungsleiter** vom Handhammer über Magnetkran, Hydraulikschere, Separatoren,
Förderband und Greifarm bis zu Robotern und der KI-Zerlegelinie. Jede Maschine hat **10
Ausbaustufen** (bis +150 %, ab Stufe 5 Qualitätsbonus, auf Stufe 10 Meisterstufe), zieht **Strom**
und **verschleißt** — beides drosselt, stoppt aber nie. Parallele **Produktionslinien**
multiplizieren den Durchsatz: die eigentliche Idle-Kurve.

**Produktionsketten** — Schmelzofen, Drahtzieherei, Gummimühle, Plattenpresse und
Platinenfertigung veredeln Rohstoffe zu deutlich wertvolleren Produkten.

**Wirtschaft mit Tiefe** — 28 Fahrzeuge in sechs Qualitätsklassen, 46 Materialien von
Eisenschrott bis Palladium, fünf Qualitätsstufen, 15 Produktionsrezepte, dynamische Marktpreise,
acht Vertragskunden mit laufendem Einkommen, Auktionen gegen KI-Bieter, neun Sammler-Fundstücke
und ein Firmenwert aus allem, was gebaut wurde.

**Technologiebaum** mit 31 Technologien in acht Zweigen (Maschinen, Materialkunde, Robotik, KI,
Energie, Logistik, Personal, Umwelttechnik), jede mit mehreren Stufen. Forschung lässt sich
**nicht mit Geld erzwingen**: eine Stufe kostet Forschungspunkte, Geld *und* oft seltene
Materialien. Viele Stufen sind Meilensteine, die neue Mechaniken freischalten statt Zahlen zu
erhöhen — Roboter, Drohnen, Preisprognosen, Fusionsreaktor. **Drei seltene Technologien**
erscheinen erst, wenn etwas passiert, das man nicht kaufen kann: 5.000 zerlegte Fahrzeuge,
drei Neugründungen, ein unbekanntes Metall im Schrott. Das **Forschungslabor** hat 10
Ausbaustufen und bestimmt Tempo, Punkte, erreichbare Technologiestufe und parallele Projekte.

**Prestige** mit drei unabhängigen Türen (Firmenwert, vollständige Automatisierung, 90 %
Forschung), **Industriepunkten** und einem Baum aus fünf Zweigen. Jeder Durchlauf macht die
Welt etwas teurer und die Belohnungen deutlich größer. **Endgame-Inhalte** ab der ersten
Neugründung: internationaler Handel, Schiffsrecycling, Flugzeugfriedhof, Weltraumschrott und
die orbitale Recyclingstation.

**Zwölf Erfolge** mit Titeln und bewusst winzigen Dauerboni, 100+ Kaufobjekte.

**Unternehmen statt Maschinenpark** — Mitarbeiter kosten Gehalt, sammeln Erfahrung (10 Stufen)
und werden dadurch besser; Gebäude kosten Unterhalt. Wer die Löhne nicht zahlen kann, verliert
niemanden — das Team arbeitet langsamer, bis der Rückstand getilgt ist. Statt Einzelaufgaben
setzt der Spieler eine **Ausrichtung** (Produktion, Wartung, Forschung, Lager, Verträge), und
**Lagerregeln** halten Mindestbestände, sperren Material oder warten auf einen Mindestpreis. Die
**Betriebszahlen** zeigen Tages- und Wochengewinn, Produktionsmenge, Stromverbrauch,
Mitarbeiterzahl, Firmenwert, Effizienz und CO₂-Einsparung.

**Logistik auf echten Straßen** — sechs Fahrzeugklassen vom Hubwagen bis zum Containerfahrzeug
fahren einen echten Routing-Graphen: kürzeste Route bevorzugt, Kollisionsvermeidung durch
Abstandhalten, und bei Stau geht es über die Ringstraße. Transportaufträge landen in einer
Warteschlange und gehen an die kleinste freie Klasse, die die Last trägt.

**Isometrische Spielwelt**, die mit jedem Kauf sichtbar wächst: zehn zukaufbare Grundstücke vom
Lagerplatz bis zum eigenen Stahlwerk, Anlagen mit fünf Ausbaustufen, LKW die echte Wege über die
Straßen fahren, sichtbarer Materialfluss auf den Förderstrecken, 15-Minuten-Tageszyklus mit
Nachtbeleuchtung, sechs Wetterlagen und frei platzierbare Dekoration.

**Offline-Fortschritt** mit Rückkehr-Report, gedeckelt und über Mitarbeiter, Forschung und
Prestige-Boni erweiterbar.

**Oberfläche aus einem Guss** — ein Designsystem aus neun Komponenten trägt jeden Screen, jede
Farbe hat überall dieselbe Bedeutung (Blau Information, Orange Maschinen, Grün Geld, Gelb
Forschung, Rot Fehler), und Seltenheit ist von Normal bis **Mythisch** durchgefärbt. Sechs
Hauptbereiche: Schrottplatz, Markt, Forschung, Mitarbeiter, Statistik, Einstellungen. Ein HUD
zeigt oben Geld, Firmenwert, Industrie- und Forschungspunkte, links was gerade läuft, rechts
was klemmt.

**Drei Themes** (Standard, Nachtmodus, Winter) — ein Theme ist eine Zahlentabelle, kein zweites
Stylesheet.

**Ton ohne ein einziges Asset**: Maschinen, Hydraulik, Funken, Motoren und ein ruhiges
Klangbett werden zur Laufzeit synthetisiert.

**Barrierefreiheit**: Oberflächengröße 80–150 %, Farbenblind-Modus, reduzierte Effekte,
Vibration, getrennte Lautstärken und ein Linkshänder-Modus.

**Acht Sprachen vorbereitet** — Deutsch als Quelle, Englisch vollständig, sechs weitere
registriert und leer. Keine einzige Zeichenkette in `src/ui` steht noch fest im Code.

**Bedienung** vollständig per Touch: Tippen zum Auswählen, Gedrückt halten für Informationen,
Ziehen zum Scrollen, Pinch zum Zoomen, Doppeltippen zentriert die Kamera. Die Kamera bleibt
jederzeit unter Kontrolle des Spielers.

## Technik

TypeScript + Vite, **keine Laufzeit-Abhängigkeiten und keine Assets**. Oberfläche als DOM, die
Spielwelt als isometrisches Canvas aus Vektorformen, der Ton aus Oszillatoren — dadurch ≈ 78 kB
gzip insgesamt und flüssiger Betrieb auf Mittelklasse-Geräten. Gezeichnet wird nur, was im Bild ist; Animationen pausieren, sobald der
Hof nicht der aktive Screen ist.

Alle Spielwerte liegen in `src/data/`. Neue Fahrzeuge, Maschinen, Mitarbeiter, Gebäude, Rezepte,
Forschungen und Prestige-Boni sind reine Datenobjekte und brauchen keinen Systemcode — siehe
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Speicherstände sind versioniert, werden beim Laden saniert und überstehen Inhalts-Updates.

## Stand

Spielbarer Prototyp. Die Kapitel 1 bis 9 des GDD sind umgesetzt; Kapitel 10 ff. sind noch offen.

Architekturentscheidungen sind kurz in [docs/DEVNOTES.md](docs/DEVNOTES.md) begründet.

Bewusst noch offen: **echte Grafik- und Audio-Assets**. Modelle sind Vektorformen, Symbole sind
Emoji, Geräusche sind synthetisiert. Beides ist so gebaut, dass professionelle Assets die
jeweilige Tabelle ersetzen können, ohne dass Spielcode sich ändert.
