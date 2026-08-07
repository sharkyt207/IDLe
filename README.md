# Scrap Empire

Idle-/Tycoon-Prototyp für Smartphones: aus einem verlassenen Schrottplatz wird Schritt für
Schritt ein automatisiertes Recycling-Imperium.

Umsetzung von [GDD Kapitel 1 (Vision)](docs/gdd/01-vision.md),
[Kapitel 2 (Core Gameplay)](docs/gdd/02-core-gameplay.md) und
[Kapitel 3 (Spielwelt)](docs/gdd/03-world.md).

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

## Was drin ist

**Kernschleife** — Schrott ankaufen → per Fingertipp zerlegen → Materialien lagern, verarbeiten
und verkaufen → Gewinn reinvestieren → Gelände erweitern → neu gründen (Prestige).

**Tutorial** in fünf Schritten, in unter zwei Minuten spielbar, inklusive der im GDD
festgelegten ersten Investitionsentscheidung (Hammer / Lager / Magnetkran) — ohne falsche Wahl.

**Automatisierungsleiter** vom Handhammer über Mechaniker, Magnetkran, Förderband, Greifarm,
Sortiermaschine und Roboter bis zur KI-Zerlegelinie. Jede Stufe nimmt dem Spieler Arbeit ab.

**Produktionsketten** — Schmelzofen, Drahtzieherei, Gummimühle, Plattenpresse und
Platinenfertigung veredeln Rohstoffe zu deutlich wertvolleren Produkten.

**Forschung** mit 16 Knoten in vier Zweigen, **Prestige** mit sieben dauerhaften Boni,
11 Fahrzeugtypen, 15 Materialien, 50+ Kaufobjekte.

**Isometrische Spielwelt**, die mit jedem Kauf sichtbar wächst: zehn zukaufbare Grundstücke vom
Lagerplatz bis zum eigenen Stahlwerk, Anlagen mit fünf Ausbaustufen, LKW die echte Wege über die
Straßen fahren, sichtbarer Materialfluss auf den Förderstrecken, 15-Minuten-Tageszyklus mit
Nachtbeleuchtung, sechs Wetterlagen und frei platzierbare Dekoration.

**Offline-Fortschritt** mit Rückkehr-Report, gedeckelt und über Mitarbeiter, Forschung und
Prestige-Boni erweiterbar.

**Bedienung** vollständig per Touch: Tippen zum Zerlegen, Ziehen zum Scrollen, Pinch zum Zoomen.
Die Kamera bleibt jederzeit unter Kontrolle des Spielers.

## Technik

TypeScript + Vite, **keine Laufzeit-Abhängigkeiten**. Oberfläche als DOM, die Spielwelt als
isometrisches Canvas aus Vektorformen — dadurch ≈ 37 kB gzip und flüssiger Betrieb auf
Mittelklasse-Geräten. Gezeichnet wird nur, was im Bild ist; Animationen pausieren, sobald der
Hof nicht der aktive Screen ist.

Alle Spielwerte liegen in `src/data/`. Neue Fahrzeuge, Maschinen, Mitarbeiter, Gebäude, Rezepte,
Forschungen und Prestige-Boni sind reine Datenobjekte und brauchen keinen Systemcode — siehe
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Speicherstände sind versioniert, werden beim Laden saniert und überstehen Inhalts-Updates.

## Stand

Spielbarer Prototyp. Die Kapitel 1 bis 3 des GDD sind umgesetzt; Kapitel 4 ff. sind noch offen.

Bewusst noch nicht enthalten: **Ton**. Das GDD nennt Metallgeräusche als Feedback — der Prototyp
liefert stattdessen Partikel, schwebende Beträge, Fortschrittsbalken und optionale Vibration.
Audio braucht Assets und eine eigene Ladestrategie und wartet auf echte Sounds.
