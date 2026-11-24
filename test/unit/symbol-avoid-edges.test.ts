// `symbol-avoid-edges` has no effect, as in MapLibre GL JS 6.17, which declares it and does not read it. The development
// build says so once for each layer that has it (#1692).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, type Checked} from '../../src/mistakes.ts';

test('symbol-avoid-edges: the main API warns once for each layer that has it', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const style = {layers: [
            {id: 'a', type: 'symbol', source: 's', layout: {'text-field': 'A', 'symbol-avoid-edges': true}},
            {id: 'b', type: 'symbol', source: 's', layout: {'text-field': 'B'}},
        ]};
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        check(c, 4, style);
        check(c, 4, style);
        assert.deepEqual(warnings.filter(w => w.includes('avoid-edges')), [
            '[map-jr-gl] the symbol layer "a": "symbol-avoid-edges" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.',
        ]);
        // (The property is in the style specification, so it is not reported as an unknown property.)
        assert.equal(warnings.filter(w => w.includes('no such property')).length, 0);
    } finally { console.warn = warn; }
});
