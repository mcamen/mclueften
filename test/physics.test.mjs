// Tests für die reinen Physik-/Hilfsfunktionen der App.
//
// Es wird KEIN Code dupliziert: Das Inline-<script> aus index.html wird
// extrahiert, der App-Start (init()) abgeschnitten und nur die Definitionen
// in einer node:vm-Sandbox ausgeführt. Getestet werden also exakt die
// Funktionen, die auch im Browser laufen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(m, 'Inline-<script> in index.html nicht gefunden');

let code = m[1];
const cut = code.indexOf("$('t-in').addEventListener");
assert.ok(cut !== -1, 'Bootstrap-Zeile nicht gefunden');
code = code.slice(0, cut);   // App-Start entfernen → nur Funktionsdefinitionen

const ctx = { Math, Date, String, Number, JSON, Object, Array, console, isNaN, parseFloat };
vm.createContext(ctx);
vm.runInContext(code, ctx);
const { dewPoint, absHum, relHum, rhFromDew, sunTimes, hm, ventBenefit, simulate, co2Class } = ctx;

test('dewPoint: bei 100 % rel. Feuchte ≈ Temperatur', () => {
    for (const T of [5, 20, 30]) assert.ok(Math.abs(dewPoint(T, 100) - T) < 0.15, `T=${T}`);
});

test('dewPoint: ≤ Temperatur und steigt mit der Feuchte', () => {
    assert.ok(dewPoint(25, 50) <= 25);
    assert.ok(dewPoint(25, 80) > dewPoint(25, 40));
});

test('absHum/relHum: Rundlauf RH → absolute Feuchte → RH', () => {
    for (const T of [10, 22, 33]) for (const RH of [30, 60, 90]) {
        const back = relHum(T, absHum(T, RH));
        assert.ok(Math.abs(back - RH) < 0.5, `T=${T} RH=${RH} → ${back}`);
    }
});

test('rhFromDew: Td = T → 100 %, und Rundlauf über den Taupunkt', () => {
    assert.ok(Math.abs(rhFromDew(20, 20) - 100) < 0.5);
    for (const [T, Td] of [[30, 14], [25, 18], [18, 5]]) {
        assert.ok(Math.abs(dewPoint(T, rhFromDew(T, Td)) - Td) < 0.2, `T=${T} Td=${Td}`);
    }
});

test('hm: Bruchstunde → "HH:MM"', () => {
    assert.equal(hm(5.5), '05:30');
    assert.equal(hm(0), '00:00');
    assert.equal(hm(13.25), '13:15');
    assert.equal(hm(23.999), '00:00');   // rundet auf 24:00 → 00:00
});

test('sunTimes: Tageslänge Sommer- vs. Wintersonnenwende (Tübingen)', () => {
    // (set - rise) ist zeitzonenunabhängig (beide verschieben sich gleich)
    const len = d => { const s = sunTimes(d, 48.52, 9.06); return ((s.set - s.rise) % 24 + 24) % 24; };
    assert.ok(Math.abs(len(new Date(2026, 5, 21)) - 16.1) < 0.6, 'Sommer ~16 h');
    assert.ok(Math.abs(len(new Date(2026, 11, 21)) - 8.2) < 0.6, 'Winter ~8 h');
});

test('ventBenefit: nur lüften, wenn außen kühler UND nicht feuchter', () => {
    assert.equal(ventBenefit(26, 20, 16, 14), true);    // kühler & trockener
    assert.equal(ventBenefit(26, 30, 16, 14), false);   // wärmer
    assert.equal(ventBenefit(26, 20, 14, 18), false);   // kühler, aber feuchter
    assert.equal(ventBenefit(26, 25.7, 16, 14), false); // innerhalb Toleranz (kein klarer Vorteil)
});

test('co2Class: Schwellen gut / mäßig / stickig', () => {
    assert.equal(co2Class(800).label, 'gut');
    assert.equal(co2Class(1100).label, 'mäßig');
    assert.equal(co2Class(1500).label, 'stickig');
});

test('CO₂-Modell: baut sich tagsüber (zu) auf, fällt nachts (offen)', () => {
    // 1 Person, INFILTR 0,3 ⇒ geschlossenes Gleichgewicht ~1020 ppm,
    // nachts (Fenster offen, ACH 3) ~480 ppm. Index = Stunde (Array ab 00:00).
    const outT = Array(24).fill(25), outRH = Array(24).fill(50);
    const sim = simulate(outT, outRH, 25, 0);
    const dayPeak  = Math.max(...sim.inCO2.slice(8, 22));   // 08–21 Uhr (zu)
    const nightLow = Math.min(...sim.inCO2.slice(0, 8));    // 00–07 Uhr (offen)
    assert.ok(dayPeak > nightLow + 300, `Tag ${dayPeak.toFixed(0)} vs Nacht ${nightLow.toFixed(0)}`);
    assert.ok(dayPeak <= 1021, 'unter geschlossenem Gleichgewicht (~1020)');
    assert.ok(nightLow < 600, 'nachts nahe Außenwert');
    assert.ok(sim.inCO2.every(v => v >= 420 - 1), 'nie unter Außenbasis');
});
