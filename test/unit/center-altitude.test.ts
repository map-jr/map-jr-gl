// The root property `centerAltitude` of a style has no effect, as in MapLibre GL JS 6.17, which declares it and does not
// read it. The development build says so once for each map (#1712).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, type Checked} from '../../src/mistakes.ts';

test('centerAltitude: the main API warns once for each map whose style has it', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const style = {version: 8, centerAltitude: 1000, sources: {}, layers: []};
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        check(c, 4, style);
        check(c, 4, style);
        check(c, 4, {version: 8, sources: {}, layers: []});
        assert.deepEqual(warnings, [
            '[map-jr-gl] E1712 style: the root property "centerAltitude" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.',
        ]);
    } finally { console.warn = warn; }
});
