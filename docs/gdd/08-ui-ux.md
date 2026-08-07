# SCRAP EMPIRE — Game Design Document

## Kapitel 8 – Benutzeroberfläche, Benutzererlebnis & Art Direction

---

### Ziel dieses Kapitels

Die Oberfläche entscheidet, ob sich das Spiel wie ein billiger Mobile-Klon oder wie ein
Premium-Titel anfühlt. Leitsatz: **weniger Elemente, dafür bessere.**

---

### Designsystem

Alles baut auf **neun Komponenten** in `src/ui/components.ts`:

| Komponente | Verwendung |
| ---------- | ---------- |
| Primary Button | die Handlung, die gemeint ist — Farbverlauf, Schatten, Symbol |
| Secondary Button | alles andere — umrandet, gleiche Geometrie |
| Icon Button | reine Symbole: Zahnrad, Schloss, Schließen |
| Info Card | eine Zeile Inhalt: Symbol, Text, Aktionen, farbige Kante |
| Progress Bar | Fortschritt, wahlweise mit Beschriftung |
| Dialog | Fenster mit Titelleiste, ✕ oben rechts, Einblendung |
| Tooltip | erscheint beim **Gedrückt halten** |
| Badge | Anzahl, Stufe, Seltenheit |
| Status Indicator | farbiger Punkt plus Zustand: läuft, Wartung, Strommangel |

Kein Screen baut noch eigenes Markup. Deshalb ist ein Theme-Wechsel eine Datei und keine
Woche Arbeit.

### Farben als Bedeutung

Jede Farbe heißt überall dasselbe:

| Farbe | Bedeutung |
| ----- | --------- |
| Blau | Menüs, Buttons, Informationen |
| Orange | Maschinen, Warnungen, Interaktionen |
| Grün | Geld, Erfolg, Produktion |
| Gelb | Forschung, Upgrades |
| Rot | Fehler, Strommangel, Defekte |

Darunter Industriebeton, Asphalt, Metall und Dunkelblau als Flächen. Die Werte stehen in
`src/data/ui.ts` und werden von `src/ui/theme.ts` als CSS-Variablen gesetzt — **ein Theme ist
eine andere Zahlentabelle, kein zweites Stylesheet.**

### Seltenheitsfarben

Normal grau · Ungewöhnlich grün · Selten blau · Episch lila · Legendär gold · **Mythisch
türkis**. Sie gelten für Fahrzeuge, Maschinen, Materialien und Fundstücke gleichermaßen. Eine
Maschine steigt mit ihren Ausbaustufen durch die Stufen — eine gemeisterte Anlage liest sich
auf einen Blick als legendär.

---

### HUD

| Position | Inhalt |
| -------- | ------ |
| Oben | Geld, Firmenwert, Industriepunkte, Forschungspunkte, Level, Lager |
| Links | Was gerade läuft: Verträge, Forschungsprojekte, Auktionen |
| Rechts | Stehende Warnungen: Strommangel, Lager voll, Wartung, offene Löhne |
| Unten | Große Navigationsleiste |

Die Seitenschienen erscheinen **nur über der Spielwelt** und nur, wenn sie etwas zu sagen
haben. Eine dauerhaft halbleere Leiste ist Unordnung, kein HUD.

### Sechs Hauptbereiche

Schrottplatz · Markt · Forschung · Mitarbeiter · Statistik · Einstellungen.

Zwei davon sind **Hubs**: der Schrottplatz führt Hof und Ausbau, der Markt führt Ankauf, Lager
und Handel. So bleibt die Leiste bei sechs großen Zielen, statt eine neunte gequetschte
Registerkarte zu bekommen.

---

### Animationen

| Auslöser | Feedback |
| -------- | -------- |
| Button drücken | Verkleinerung auf 94 %, dann Zurückfedern |
| Geld erhalten | grüne Zahl steigt auf und verschwindet |
| Gebäude gebaut | Staubwolke, dann erscheint das Modell |
| Fenster öffnen | Einblendung mit leichtem Aufsteigen |

Die Druckanimation läuft bewusst in JavaScript statt über `:active`: verlässt der Finger den
Button früh, soll die Animation trotzdem sauber zu Ende laufen — ein Druck, der optisch nie
fertig wird, liest sich wie eine verschluckte Eingabe.

### Touch-Steuerung

| Geste | Wirkung |
| ----- | ------- |
| Tippen | auswählen |
| Gedrückt halten | Informationen anzeigen |
| Ziehen | Karte bewegen |
| Pinch | zoomen |
| Doppeltippen | Kamera auf das Objekt zentrieren |

### Detailfenster

Jede Maschine hat eines: Name, Bild, Stufe, Produktionsrate, Stromverbrauch, Wartungszustand,
Ausbau und Beschreibung. Alles darin wird aus denselben Effekt-Deskriptoren gelesen, die auch
die Simulation benutzt — eine neue Maschine braucht hier keine Zeile Code.

### Benachrichtigungen

Oben rechts, dezent, verschwinden von allein. Im Linkshänder-Modus wandern sie auf die andere
Seite.

---

### Sounddesign

Jede Maschine hat ein eigenes Geräusch: Metall, Hydraulik, Motor, Funken, Schredder. Dazu ein
ruhiger elektronischer Klangteppich mit leichtem Industrial-Einschlag.

**Alles ist synthetisiert, nicht gesampelt.** Aufnahmen wären Megabytes an Assets plus eine
Ladestrategie; das ganze Spiel wiegt 74 kB ohne Laufzeit-Abhängigkeiten. Ein Schrottplatz ist
Metall, Motoren und Hydraulik — genau das, worin subtraktive Synthese gut ist. Die Aufrufstellen
fragen nur nach `play('shred')`, nie nach einem Puffer: echte Aufnahmen können das später
ersetzen, ohne dass eine Zeile Spielcode sich ändert.

Ton startet erst nach der ersten Berührung — Browser blockieren Audio davor, und ein Spiel, das
beim Laden nach Ton fragt, wird stummgeschaltet.

---

### Barrierefreiheit

| Option | Umfang |
| ------ | ------ |
| Oberflächengröße | 80–150 %, stufenlos |
| Farbenblind-Modus | ersetzt Rot/Grün durch Orange/Blau |
| Vibration | an/aus |
| Reduzierte Effekte | weniger Partikel *und* ruhigere Animationen |
| Lautstärke | getrennt für Musik, Effekte und Oberfläche |
| Linkshänder-Modus | spiegelt Navigation, Schienen und Benachrichtigungen |

„Reduzierte Effekte" ist absichtlich beides: eine Barrierefreiheits-Option und das billigste
Mittel gegen ein schwaches Gerät.

### Leistung

- Nur sichtbare Kacheln, Anlagen, Fahrzeuge und Pakete werden gezeichnet.
- Animationen und Spawns pausieren, sobald die Welt nicht der aktive Screen ist.
- Die Navigationsleiste wird **nur neu gebaut, wenn sie anders aussehen würde**. Vorher wurde
  sie mehrmals pro Sekunde ersetzt — auf einem echten Gerät zeigt sich das als Tipps, die
  nicht ankommen.
- Der Theme-Anstrich der Welt ist ein einziger Bildschirm-Composite, kein Aufschlag pro Objekt.

---

### Art Pipeline

Drei Kategorien, modular und austauschbar:

| Kategorie | Ort |
| --------- | --- |
| Welt (Gelände, Straßen, Gebäude, Maschinen, Fahrzeuge, Vegetation) | `src/render/models.ts`, `src/world/` |
| Oberfläche (Buttons, Fenster, Icons, Balken, Diagramme) | `src/ui/components.ts`, `src/data/ui.ts` |
| Effekte (Funken, Rauch, Staub, Licht, Geldanimationen) | `src/render/effects.ts` |

Alles ist Vektor und Emoji, kein einziges Bild wird geladen. Später können echte Grafiken die
Modelltabelle ersetzen, ohne dass Spielcode angefasst wird.

### Themes

Standard · Nachtmodus · Winter. Ein Theme setzt Palette, Flächenfarben, einen Weltanstrich und
optional das Wetter. Ein Winter-Theme ist damit ein Datensatz von rund zwanzig Zeilen.

---

### Anforderungen an die Umsetzung

| Baustein | Ort |
| -------- | --- |
| Designtokens, Paletten, Themes, Seltenheitsfarben | `src/data/ui.ts` |
| Theme- und Barrierefreiheits-Manager | `src/ui/theme.ts` |
| Komponentenbibliothek | `src/ui/components.ts` |
| HUD (oben, links, rechts) | `src/ui/hud.ts` |
| Hauptbereiche und Hubs | `src/ui/app.ts`, `src/ui/screens/hub.ts` |
| Detailfenster | `src/ui/details.ts` |
| Sounddesign | `src/audio/sound.ts` |
| Statistik mit Diagrammen | `src/ui/screens/statistics.ts` |
| Mitarbeiterverwaltung | `src/ui/screens/staff.ts` |
| Einstellungen | `src/ui/screens/settings.ts` |
