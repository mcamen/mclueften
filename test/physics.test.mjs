// Tests für die reinen Physik-/Hilfsfunktionen der App.
//
// Es wird KEIN Code dupliziert: Das Inline-<script> aus index.html wird
// extrahiert, der App-Start abgeschnitten und nur die Definitionen in einer
// node:vm-Sandbox ausgeführt. Getestet werden also exakt die Funktionen, die
// auch im Browser laufen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(m, 'Inline-<script> in index.html nicht gefunden');

// Schnittmarke: alles davor sind reine Definitionen, alles danach fasst das DOM an.
const MARK = '// ══ APP-START';
let code = m[1];
const cut = code.indexOf(MARK);
assert.ok(cut !== -1, `Marke "${MARK}" in index.html nicht gefunden`);
code = code.slice(0, cut);

// const-/let-Bindungen landen nicht auf dem Global-Objekt der Sandbox. Deshalb
// sammelt ein angehängter Ausdruck die benötigten Namen im selben Scope ein.
const EXPORTS = [
    'dewPoint', 'absHum', 'relHum', 'rhFromDew', 'sunTimes', 'hm', 'ventBenefit',
    'simulate', 'co2Class', 'co2Scale', 'nowIndex', 'tsHour', 'tsOffsetH', 'CO2_OUT'
];
const ctx = { Math, Date, String, Number, JSON, Object, Array, console, isNaN, parseFloat };
vm.createContext(ctx);
const {
    dewPoint, absHum, relHum, rhFromDew, sunTimes, hm, ventBenefit, simulate,
    co2Class, co2Scale, nowIndex, tsHour, tsOffsetH, CO2_OUT
} = vm.runInContext(`${code}\n;({ ${EXPORTS.join(', ')} })`, ctx);

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

test('sunTimes: Zeitzone des Ortes statt der des Browsers', () => {
    // Tübingen, Sommersonnenwende, MESZ (UTC+2): ~05:21 / ~21:29 Ortszeit –
    // unabhängig davon, in welcher Zeitzone der Browser läuft.
    const s = sunTimes(new Date(2026, 5, 21), 48.52, 9.06, 2);
    assert.ok(Math.abs(s.rise - 5.36) < 0.2, `Aufgang ${hm(s.rise)}`);
    assert.ok(Math.abs(s.set - 21.48) < 0.2, `Untergang ${hm(s.set)}`);
    // Eine Stunde anderer Versatz ⇒ eine Stunde andere Ortszeit
    const s1 = sunTimes(new Date(2026, 5, 21), 48.52, 9.06, 1);
    assert.ok(Math.abs((s.rise - s1.rise) - 1) < 1e-9, 'Versatz schlägt 1:1 durch');
});

test('tsHour/tsOffsetH: Stunde und UTC-Versatz aus dem Zeitstempel', () => {
    assert.equal(tsHour('2026-08-19T14:00:00+02:00'), 14);
    assert.equal(tsHour('2026-01-05T07:00:00+01:00'), 7);
    assert.equal(tsOffsetH('2026-08-19T14:00:00+02:00'), 2);
    assert.equal(tsOffsetH('2026-08-19T14:00:00-03:30'), -3.5);
    assert.equal(tsOffsetH('2026-08-19T12:00:00Z'), 0);
});

test('nowIndex: Stunde, in der „jetzt" liegt', () => {
    const times = ['2026-08-19T12:00:00+02:00', '2026-08-19T13:00:00+02:00', '2026-08-19T14:00:00+02:00'];
    assert.equal(nowIndex(times, Date.parse('2026-08-19T13:30:00+02:00')), 1, 'mittendrin');
    assert.equal(nowIndex(times, Date.parse('2026-08-19T13:00:00+02:00')), 1, 'exakt auf der Stunde');
    assert.equal(nowIndex(times, Date.parse('2026-08-19T09:00:00+02:00')), 0, 'vor dem Datensatz');
    assert.equal(nowIndex(times, Date.parse('2026-08-19T23:00:00+02:00')), 2, 'nach dem Datensatz');
    // Zeitzone zählt, nicht die Wanduhr: 13:30 in Lissabon (+01) ist 14:30 in Berlin
    assert.equal(nowIndex(times, Date.parse('2026-08-19T13:30:00+01:00')), 2);
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

test('simulate: Innentemperatur trifft den Anker exakt', () => {
    const outT = Array(48).fill(22), outRH = Array(48).fill(55);
    for (const anchor of [0, 14, 47]) {
        const sim = simulate(outT, outRH, 26.5, anchor);
        assert.ok(Math.abs(sim.inT[anchor] - 26.5) < 1e-9, `Anker ${anchor}`);
    }
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
    assert.ok(sim.inCO2.every(v => v >= CO2_OUT - 1), 'nie unter Außenbasis');
});

test('CO₂-Modell: Nachtfenster folgt der Ortsstunde, nicht dem Array-Index', () => {
    // Datensatz beginnt um 06:00 Ortszeit ⇒ Index 0 ist NICHT Mitternacht.
    const n = 72;
    const hours = Array.from({ length: n }, (_, i) => (i + 6) % 24);
    const sim = simulate(Array(n).fill(20), Array(n).fill(60), 24, 0, hours);
    const day = sim.inCO2.slice(24, 48);                    // zweiter voller Tag
    const hourOf = i => hours[24 + i];
    let lo = 0, hi = 0;
    day.forEach((v, i) => { if (v < day[lo]) lo = i; if (v > day[hi]) hi = i; });
    assert.ok(hourOf(lo) >= 22 || hourOf(lo) < 8, `Minimum in der Lüftungsphase, war ${hourOf(lo)} Uhr`);
    assert.ok(hourOf(hi) >= 8 && hourOf(hi) < 22, `Maximum bei geschlossenem Fenster, war ${hourOf(hi)} Uhr`);
});

test('co2Scale: skaliert den Überschuss über der Außenbasis', () => {
    assert.equal(co2Scale(1020, 1020), 1, 'Messwert = Modellwert ⇒ unverändert');
    assert.equal(co2Scale(1020, 720), 0.5, 'halber Überschuss ⇒ Faktor 0,5');
    assert.equal(co2Scale(1020, 350), 0, 'Messwert unter Außenbasis ⇒ auf Basis geklemmt');
    assert.equal(co2Scale(CO2_OUT, 900), 1, 'kein Überschuss im Modell ⇒ keine Skalierung');
});

test('CO₂-Kalibrierung bleibt über der Außenbasis (kein Offset ins Negative)', () => {
    // Regression: ein konstanter Offset (Messwert − Modellwert) hat die
    // Nachtwerte unter 420 ppm und bis ins Negative gedrückt.
    const n = 48;
    const sim = simulate(Array(n).fill(25), Array(n).fill(50), 25, 14);
    const fenster = sim.inCO2.slice(14, 38);
    const k = co2Scale(fenster[0], 450);
    const kalibriert = fenster.map(v => CO2_OUT + (v - CO2_OUT) * k);
    assert.ok(Math.abs(kalibriert[0] - 450) < 1e-9, '„jetzt" trifft den Messwert');
    assert.ok(Math.min(...kalibriert) >= CO2_OUT, `Minimum ${Math.min(...kalibriert).toFixed(0)} ppm`);
    // Der Sägezahn bleibt erhalten (nur gestaucht), wird nicht flachgebügelt
    assert.ok(Math.max(...kalibriert) > Math.min(...kalibriert) + 10, 'Verlauf bleibt sichtbar');
});
