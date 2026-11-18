// #679: the inertia after a rotate drag agrees with HandlerInertia of MapLibre GL JS 6.17
// (node_modules/maplibre-gl/src/ui/handler_inertia.ts) on the same recorded samples.
import test from 'node:test';
import assert from 'node:assert/strict';
import {turnInertia} from '../../src/geo.ts';

// MapLibre GL JS: the entries of the last 60 ms (at least the last two), the deltas after the first entry, the time
// from the first entry to the release, then calculateEasing with linearity 0.3 and deceleration 1000.
function maplibre(entries: {t: number; b: number; p: number}[], now: number) {
    let i = Math.max(0, entries.length - 2);
    while (i > 0 && entries[i - 1].t >= now - 60) i--;
    const e = entries.slice(i), ms = now - e[0].t;
    const ease = (amount: number, max: number) => {
        const speed = Math.min(max, Math.max(-max, amount * 0.3 / (ms / 1000))), s = Math.abs(speed) / (1000 * 0.3);
        return {duration: s * 1000, amount: speed * s / 2};
    };
    const b = ease(e.slice(1).reduce((a, x) => a + x.b, 0), 360), p = ease(e.slice(1).reduce((a, x) => a + x.p, 0), 90);
    return {bearing: Math.min(179, Math.max(-179, b.amount)), pitch: p.amount, duration: Math.max(b.duration, p.duration)};
}

test('turnInertia gives the turn, tilt and duration of MapLibre GL JS for the same samples (#679)', () => {
    const cases = [
        {moves: Array.from({length: 10}, (_, k) => ({t: k * 17, b: 8, p: 0})), now: 9 * 17 + 4},
        {moves: Array.from({length: 6}, (_, k) => ({t: k * 30, b: -5, p: 2})), now: 5 * 30 + 20},
        {moves: [{t: 0, b: 40, p: 0}, {t: 100, b: 40, p: -10}], now: 140},
        {moves: Array.from({length: 8}, (_, k) => ({t: k * 16, b: 30, p: 10})), now: 7 * 16 + 1},
    ];
    for (const {moves, now} of cases) {
        let x = 0, y = 0;
        const samples = moves.map(m => ({t: m.t, x: x += m.b, y: y += m.p}));
        const ours = turnInertia(samples, now)!, ml = maplibre(moves, now);
        for (const k of ['bearing', 'pitch', 'duration'] as const) assert.ok(Math.abs(ours[k] - ml[k]) < 1e-9, `${k}: ${ours[k]} against ${ml[k]} (${JSON.stringify(moves[0])})`);
    }
    assert.equal(turnInertia([{t: 0, x: 5, y: 0}], 10), undefined);
    assert.equal(turnInertia([{t: 0, x: 5, y: 0}, {t: 16, x: 5, y: 0}], 20), undefined);
});
