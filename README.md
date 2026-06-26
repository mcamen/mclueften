# Lüftungshelfer

[![CI](https://github.com/mcamen/mclueften/actions/workflows/ci.yml/badge.svg)](https://github.com/mcamen/mclueften/actions/workflows/ci.yml)

**Live-Demo: https://mcamen.github.io/mclueften/**

Eine kleine Single-Page-Web-App, die abschätzt, **wann sich Lüften lohnt** – um im Sommer Hitze und Feuchte aus der Wohnung zu bekommen. Sie vergleicht das modellierte Innenklima („ohne Lüften") mit der Außenluft und empfiehlt für die nächsten 24 Stunden, wann Fenster auf bzw. zu sollten. Läuft komplett im Browser, ohne Backend.

## Screenshot

![Lüftungshelfer](docs/screenshot.png)

## Funktionen

- **Lüften-Empfehlung** je Stunde: grün, wenn die Außenluft **kühler UND nicht feuchter** ist (senkt dann Temperatur *und* Feuchte), sonst „Fenster zu". Basiert auf Taupunkt (Feuchte) *und* Temperatur.
- **Rollendes 24-h-Fenster** ab der aktuellen Stunde (läuft über Mitternacht weiter) – für Taupunkt- und Temperaturverlauf sowie einen Lüftungsplan.
- **Sonnenauf- und -untergang** als Markierung in den Diagrammen (lokal berechnet).
- **CO₂-Schätzung** (Luftqualität): eigenes Diagramm (zeigt den Aufbau über den geschlossenen Tag und den Reset bei Nachtlüftung) mit Schwellenlinien, Status-Ampel und – bei stickiger Luft – ein „kurz stoßlüften"-Hinweis (unabhängig von der Hitze-Empfehlung). Skaliert mit der Personenzahl; optional auf einen gemessenen Sensorwert kalibrierbar.
- **Live-Wetterdaten** aus zwei Quellen: **DWD** (über [Brightsky](https://brightsky.dev), Standard, v. a. Deutschland) oder [Open-Meteo](https://open-meteo.com). Standort-Standard: Tübingen, beliebiger Ort per Suche.
- **Kalibrierung** der Außentemperatur auf eine echte Messung: automatisch mit der aktuellen DWD-Stationsmessung vorbelegt, manuell überschreibbar (Offset-Korrektur, Taupunkt bleibt erhalten).
- **Einstellbares Wohnungs-Profil** (Vorlagen + Slider für Wärmeträgheit und innere Last, Personenzahl).
- Ort, Quelle und Profil bleiben gespeichert (localStorage); Daten werden alle 30 min aktualisiert.

## Nutzung

Einfach `index.html` im Browser öffnen – Live-Wetterdaten werden automatisch geladen (Standard-Standort: Tübingen). Aktuelle Innentemperatur eingeben und ggf. das Wohnungs-Profil anpassen.

## Modell (Kurzfassung)

Die Innen-Kurven sind eine **freilaufende Prognose „ohne Lüften"**: Sie zeigen, wie warm und feucht es würde, wenn die Fenster geschlossen blieben (Person/Geräte als Wärme- und Feuchtequelle, gedämpfte Kopplung an außen). Lüften lohnt sich dort, wo die Außenluft dieses Innenklima verbessert. Durch Lüften kühlt die Wohnung höchstens bis auf die gleichzeitige Außentemperatur ab. Alle Werte sind Schätzungen – die eingegebene Innentemperatur und die optionale Außentemperatur-Messung dienen als Kalibrierungsanker.

## CO₂-Berechnung

Das CO₂ wird über eine einfache **Massenbilanz** des Raums geschätzt: Personen erzeugen CO₂, der Luftwechsel führt es Richtung Außenluft ab.

**Annahmen / Parameter:**

| Größe | Wert | Bedeutung |
|---|---|---|
| Außenbasis `C_out` | **~420 ppm** | CO₂-Gehalt der Frischluft |
| Erzeugung je Person | **~18 L/h** ≈ **180 ppm/h** | ruhender Erwachsener, bezogen auf ~100 m³ Raum |
| Luftwechsel zu (`ACH_zu`) | **0,3 / h** | Grundinfiltration bei geschlossenem Fenster |
| Luftwechsel offen (`ACH_offen`) | **3 / h** | Nachtlüftung, Fenster offen **22–08 Uhr** |

**Gleichgewicht** (Erzeugung = Abfuhr) für `p` Personen:

```
C_eq = C_out + p · 180 / ACH
```

Beispiele (1 Person): geschlossen → 420 + 180/0,3 = **1020 ppm**, bei offenem Fenster → 420 + 180/3 = **480 ppm**.

**Zeitverlauf:** Pro Stunde wird die *exakte* Lösung der Bilanz-Differentialgleichung verwendet (nicht das explizite Euler-Verfahren, das bei hohem Luftwechsel oszillieren/negativ werden würde):

```
C(t+1) = C_eq + (C(t) − C_eq) · e^(−ACH)
```

Dadurch ergibt sich der typische **Sägezahn**: Tagsüber (Fenster zu, kleiner Luftwechsel) baut sich CO₂ langsam Richtung ~1020 ppm auf, nachts (Fenster offen, großer Luftwechsel) fällt es rasch auf ~480 ppm. Deshalb heißt das Diagramm **„bei Nachtlüftung"** – es trifft bewusst eine andere Annahme als die Temperatur-/Feuchtekurven („ohne Lüften").

**Einstufung (Status-Ampel & Schwellenlinien):** `< 1000 ppm` gut · `1000–1400 ppm` mäßig · `≥ 1400 ppm` stickig. Ab „stickig" erscheint zusätzlich der Hinweis, kurz stoßzulüften – unabhängig von der Hitze-Empfehlung, weil Stoßlüften das CO₂ in Minuten senkt, aber kaum Wärme hereinbringt.

**Kalibrierung & Skalierung:** Die Schätzung skaliert linear mit der **Personenzahl**. Wer einen CO₂-Sensor hat, kann einen gemessenen Wert eingeben; dann wird die ganze Kurve per konstantem Offset so verschoben, dass „jetzt" dem Messwert entspricht (Anzeige wechselt zu „CO₂ gemessen").

> **Vorbehalt:** CO₂ ist – ohne Sensor – die unsicherste Größe der App. Sie hängt stark von der tatsächlichen Belegung (Personen, anwesend/abwesend, Türen) und den realen Lüftungszeiten ab; die Lüftungsfenster (22–08 Uhr) und ~100 m³ Raumvolumen sind fest angenommen. Die Werte sind als grobe Stickigkeits-Einschätzung zu verstehen.

## Technik

- Einzelne `index.html` (HTML/CSS/JS), kein Backend
- [Chart.js](https://www.chartjs.org/) für die Diagramme
- Wetterdaten: [Brightsky](https://brightsky.dev) (DWD) und [Open-Meteo](https://open-meteo.com)

### Entwicklung

Das Inline-JavaScript lässt sich mit ESLint prüfen:

```bash
npm install
npm run lint
```

## Lizenz

[MIT](LICENSE) – frei nutz-, veränder- und weiterverteilbar; einfach den Copyright-Hinweis erhalten.
