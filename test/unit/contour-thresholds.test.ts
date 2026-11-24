// A contour source without `thresholds` draws no lines, so it warns one time and names the option (#1229).
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle} from '../../src/resolve.ts';

test('contour source without thresholds: one warning that names "thresholds"', async () => {
    const warnings: string[] = [];
    const warn = console.warn;
    console.warn = (m: unknown) => { warnings.push(String(m)); };
    try {
        const style = {version: 8, sources: {
            dem: {type: 'raster-dem', tiles: ['https://example.com/{z}/{x}/{y}.png']},
            c: {type: 'contour', source: 'dem'},
            d: {type: 'contour', source: 'dem', thresholds: {11: [200, 1000]}},
        }, layers: []};
        const a = await resolveStyle(style);
        await resolveStyle(style);
        assert.ok(a.sources.c);
        assert.equal(warnings.length, 1);
        assert.match(warnings[0]!, /^\[map-jr-gl\] The contour source "c" has no "thresholds"/);
    } finally { console.warn = warn; }
});
