// A vector source with `encoding: 'mlt'` is left out with one message (#1438).
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle} from '../../src/resolve.ts';

test('mlt source: it is left out, and reported one time for the source object', async () => {
    const errors: string[] = [];
    const style = {version: 8, sources: {x: {type: 'vector', encoding: 'mlt', tiles: ['https://example.com/{z}/{x}/{y}.mlt']}, y: {type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}.pbf']}}, layers: []};
    const fail = (e: unknown) => errors.push(String((e as Error).message));
    const a = await resolveStyle(style, undefined, undefined, undefined, fail);
    await resolveStyle(style, undefined, undefined, undefined, fail);
    assert.equal(a.sources.x, undefined);
    assert.ok(a.sources.y);
    assert.deepEqual(errors, ['[map-jr-gl] The source "x" has encoding "mlt". MapLibre Tiles are not supported; use tiles with encoding "mvt".']);
});
