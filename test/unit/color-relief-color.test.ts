// A `color-relief` layer draws only an `interpolate` expression of `["elevation"]` in `color-relief-color`, with at most
// 2048 stops. The development build warns once for each layer whose value is something else, or that has more stops (#645).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, type Checked} from '../../src/mistakes.ts';

test('color-relief-color: the main API warns once for a value that is not interpolate, and for more than 2048 stops', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const many = Array.from({length: 2050}, (_, i) => [i, i % 2 ? 'red' : 'blue']).flat();
        const style = {layers: [
            {id: 'step', type: 'color-relief', source: 'dem', paint: {'color-relief-color': ['step', ['elevation'], 'blue', 100, 'red']}},
            {id: 'none', type: 'color-relief', source: 'dem'},
            {id: 'many', type: 'color-relief', source: 'dem', paint: {'color-relief-color': ['interpolate', ['linear'], ['elevation'], ...many]}},
            {id: 'good', type: 'color-relief', source: 'dem', paint: {'color-relief-color': ['interpolate', ['linear'], ['elevation'], 0, 'blue', 2048, 'red']}},
        ]};
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        check(c, 4, style);
        check(c, 4, style);
        assert.deepEqual(warnings.filter(w => w.includes('color-relief-color')), [
            '[map-jr-gl] the color-relief layer "step": "color-relief-color" is not an "interpolate" expression, so the layer draws nothing, as in MapLibre GL JS. Write ["interpolate", ["linear"], ["elevation"], elevation, color, ...].',
            '[map-jr-gl] the color-relief layer "none": "color-relief-color" is missing, so the layer draws nothing, as in MapLibre GL JS. Write ["interpolate", ["linear"], ["elevation"], elevation, color, ...].',
            '[map-jr-gl] the color-relief layer "many": "color-relief-color" has 2050 stops. The map uses the first 2048 and drops the others. Write at most 2048 stops.',
        ]);
    } finally { console.warn = warn; }
});
