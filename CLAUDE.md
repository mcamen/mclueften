# Lüftungshelfer – Projektnotizen

Statische Single-Page-App (Taupunkt-/Temperaturvergleich innen ↔ außen, CO₂-Schätzung).
Läuft ohne Backend und ohne Build-Schritt; GitHub Pages liefert `index.html` direkt aus.

## Sprache

Alles auf Deutsch: UI-Texte, Code-Kommentare, Commit-Nachrichten, README. Bezeichner
im Code sind englisch (`dewPoint`, `simulate`), Kommentare erklären sie auf Deutsch.

## Aufbau

Die App ist **eine Datei**: `index.html` enthält Markup, CSS und das gesamte
JavaScript inline. Das ist Absicht – nicht in Module aufteilen, kein Bundler,
keine Abhängigkeit außer Chart.js vom CDN.

Grobe Reihenfolge im `<script>`: Physik → Simulation → Zustand → Diagramm-Plugins
→ API-Zugriffe → UI-Helfer → `calculate()` → Profil/Persistenz → `init()`.

Die Marke `// ══ APP-START` trennt Definitionen von allem, was das DOM anfasst.
**Darüber darf kein Code stehen, der beim Laden Nebenwirkungen hat** – der
Testharness schneidet genau dort ab und führt nur den oberen Teil aus.

## Tests & Lint

```bash
npm ci && npm run lint && npm test
```

- `test/physics.test.mjs` extrahiert das Inline-`<script>`, schneidet an der
  Marke ab und führt die Definitionen in einer `node:vm`-Sandbox aus. Es wird
  bewusst **kein Code dupliziert**; getestet werden die Funktionen, die auch im
  Browser laufen. `const`-Bindungen landen nicht auf dem Sandbox-Global – neue
  Namen müssen in die `EXPORTS`-Liste des Harness.
- Getestet wird die reine Rechenlogik (Physik, Zeitrechnung, Simulation,
  Kalibrierung). Alles mit DOM- oder Netzzugriff bleibt außen vor.
- ESLint prüft das Inline-JS über `eslint-plugin-html`. `no-unused-vars` ist aus,
  weil etliche Funktionen nur über `onclick`/`oninput` im Markup referenziert sind.

## Konventionen, die leicht kaputtgehen

- **Zeit kommt aus den Zeitstempeln der Wetterdaten, nie aus der Browser-Uhr.**
  Beide Quellen liefern Ortszeit des abgefragten Ortes samt UTC-Versatz;
  `nowIndex`, `tsHour` und `tsOffsetH` leiten daraus Fenster, Stunde und Zeitzone
  ab. `getHours()` als Array-Index bricht bei fremder Zeitzone und an den
  Sommerzeit-Umstellungstagen (23-/25-Stunden-Tag).
- **Kalibrierungen sind physikalisch gedacht**, nicht als Verschiebung: die
  Außentemperatur per Offset (Taupunkt bleibt erhalten), das CO₂ per Skalierung
  des Überschusses über der Außenbasis (`co2Scale`) – ein Offset drückt die
  Nachtwerte unter 420 ppm.
- **Ausgleichsvorgänge** (Wärme, Feuchte, CO₂) nutzen einheitlich `relax()`, also
  die exakte Stundenlösung `x_eq + (x − x_eq)·e^(−rate)`, kein Euler-Verfahren.
- **Diagramme** entstehen über `renderChart(id, cfg)`. Beim zweiten Aufruf werden
  sie aktualisiert statt neu gebaut – die Eingabefelder rechnen bei jedem
  Tastendruck, ein Neuaufbau flackert. Deshalb dürfen Tooltip-Callbacks keine
  Datenarrays einfangen, sondern lesen aus `chart.data.datasets` bzw. `curVent`.
- **Chart.js ist per SRI abgesichert.** Bei einem Versionswechsel muss der
  `integrity`-Hash mit erneuert werden (sha384 des npm-Artefakts `dist/chart.umd.js`).
- **Farben** stehen als CSS-Variablen in `:root` samt `prefers-color-scheme:dark`-
  Block; Canvas kennt keine CSS-Variablen, deshalb spiegelt `THEME()` die
  Diagrammfarben in JS. Beides zusammen ändern.
- **Nutzertext nie als HTML einsetzen** (`setLoc` schreibt `textContent`) –
  Ortsnamen aus dem Suchfeld landen in Fehlermeldungen.

## Nicht committen

`.claude/` ist in `.gitignore` (lokale Hilfsskripte: statischer Server auf Port
8123, Screenshot-Empfänger für `docs/screenshot.png`).
