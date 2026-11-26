// `emptyResponse: "missing"` has no effect, as in MapLibre GL JS 6.17, so it warns one time for each source (#1695).
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle} from '../../src/resolve.ts';

test('emptyResponse "missing": one warning that names the source and the property', async () => {
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (m: unknown) => { warnings.push(String(m)); };
    try {
        const style = {version: 8, sources: {
            v: {type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}.pbf'], emptyResponse: 'missing'},
            r: {type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}.png'], emptyResponse: 'blank'},
        }, layers: []};
        const a = await resolveStyle(style);
        await resolveStyle(style);
        assert.ok(a.sources.v && a.sources.r);
        assert.equal(warnings.length, 1);
        assert.match(warnings[0]!, /^\[map-jr-gl\] E1695 The source "v": "emptyResponse": "missing" has no effect/);
    } finally { console.warn = warn; }
});
