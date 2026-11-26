// The development build warns for a zoom-based "step" or "interpolate" that is nested or repeated, and for a ["zoom"]
// that is not the input of one, which MapLibre GL JS rejects (#1057, #1087), and not for one at the places where the
// style specification allows it. The texts are those of MapLibre's style specification 26.6.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, zoomCurveError, type Checked} from '../../src/mistakes.ts';

const curve = ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 4];
test('a nested or repeated zoom curve, or a bare zoom, warns with the layer and the property', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        const layer = (id: string, v: unknown) => ({id, type: 'line', source: 's', paint: {'line-width': v}});
        const ok = [curve, ['let', 'a', 1, curve], ['coalesce', curve, 2], ['step', ['zoom'], 1, 5, ['get', 'w']], ['interpolate', ['linear'], ['get', 'x'], 0, 1, 1, 2]];
        const bad = [['*', curve, 2], ['interpolate', ['linear'], ['zoom'], 5, curve, 10, 4], ['case', true, curve, curve], ['coalesce', curve, curve], ['*', ['zoom'], 2]];
        check(c, 4, {layers: [...ok.map((v, i) => layer('ok' + i, v)), ...bad.map((v, i) => layer('bad' + i, v))]});
        assert.equal(warnings.length, bad.length, JSON.stringify(warnings));
        assert.ok(warnings.every((w, i) => w.startsWith(`[map-jr-gl] E1057 the layer "bad${i}", paint property "line-width": `)), JSON.stringify(warnings));
    } finally { console.warn = warn; }
});

// The messages of MapLibre's `validateStyleMin` (style specification 26.6.0) for the same expressions in a paint property.
test('the reason is the text of MapLibre GL JS for each case', () => {
    const nested = '"zoom" expression may only be used as input to a top-level "step" or "interpolate" expression.';
    const one = 'Only one zoom-based "step" or "interpolate" subexpression may be used in an expression.';
    const cases: [unknown, string][] = [
        [curve, ''], [['coalesce', curve, 3], ''], [['let', 'x', 1, curve], ''], [5, ''], [['get', 'w'], ''], [['literal', ['zoom']], ''],
        [['*', 2, curve], nested], [['+', 1, ['step', ['zoom'], 1, 5, 2]], nested], [['/', ['zoom'], 10], nested],
        [['case', ['has', 'a'], curve, curve], one], [['interpolate', ['linear'], ['zoom'], 5, curve, 10, 4], one], [['coalesce', curve, curve], one],
    ];
    for (const [e, want] of cases) assert.equal(zoomCurveError(e), want, JSON.stringify(e));
});
