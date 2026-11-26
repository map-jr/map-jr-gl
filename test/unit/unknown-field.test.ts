// The development build warns once for a field that the description does not have, and names the root fields for
// the removed "extend" (#524).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, type Checked} from '../../src/mistakes.ts';

test('an unknown field of the description warns once with its name, and "extend" names the root fields', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        const style = {version: 8, sources: {}, layers: []};
        const first = {style, intialView: {zoom: 2}, extend: {layers: []}, layers: []} as any;
        check(c, 2, first);
        check(c, 2, {...first}, first);
        assert.equal(warnings.length, 2, JSON.stringify(warnings));
        assert.ok(warnings.some(w => w.startsWith('[map-jr-gl] E524 the description has no field "intialView"')), JSON.stringify(warnings));
        assert.ok(warnings.some(w => w.includes('"extend"') && w.includes('"sources", "layers" and "terrain"')), JSON.stringify(warnings));
    } finally { console.warn = warn; }
});
