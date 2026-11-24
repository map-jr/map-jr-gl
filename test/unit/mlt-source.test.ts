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

test('a source that cannot be used is reported one time to each map that uses the source object (#855)', async () => {
    const style = {version: 8, sources: {none: {type: 'vector'}, x: {type: 'vector', encoding: 'mlt', tiles: ['https://example.com/{z}/{x}/{y}.mlt']}}, layers: []};
    const a: string[] = [], b: string[] = [];
    const failA = (e: unknown) => a.push(String((e as Error).message)), failB = (e: unknown) => b.push(String((e as Error).message));
    for (const fail of [failA, failB, failA, failB]) await resolveStyle(style, undefined, undefined, undefined, fail);
    const expected = ['[map-jr-gl] The source "none" has no "tiles" and no "url". Give it one of them.', '[map-jr-gl] The source "x" has encoding "mlt". MapLibre Tiles are not supported; use tiles with encoding "mvt".'];
    assert.deepEqual(a, expected);
    assert.deepEqual(b, expected);
});
