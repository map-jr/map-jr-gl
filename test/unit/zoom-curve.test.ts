// The development build warns for a zoom-based "step" or "interpolate" that is nested or repeated, which MapLibre GL
// JS rejects (#1057), and not for one at the places where the style specification allows it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, type Checked} from '../../src/mistakes.ts';

const curve = ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 4];
test('a nested or repeated zoom curve warns with the layer and the property', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        const layer = (id: string, v: unknown) => ({id, type: 'line', source: 's', paint: {'line-width': v}});
        const ok = [curve, ['let', 'a', 1, curve], ['coalesce', curve, 2], ['step', ['zoom'], 1, 5, ['get', 'w']], ['interpolate', ['linear'], ['get', 'x'], 0, 1, 1, 2]];
        const bad = [['*', curve, 2], ['interpolate', ['linear'], ['zoom'], 5, curve, 10, 4], ['case', true, curve, curve], ['coalesce', curve, curve]];
        check(c, 4, {layers: [...ok.map((v, i) => layer('ok' + i, v)), ...bad.map((v, i) => layer('bad' + i, v))]});
        assert.equal(warnings.length, bad.length, JSON.stringify(warnings));
        assert.ok(warnings.every((w, i) => w.startsWith(`[map-jr-gl] the layer "bad${i}" has in "line-width" a zoom-based`)), JSON.stringify(warnings));
    } finally { console.warn = warn; }
});
