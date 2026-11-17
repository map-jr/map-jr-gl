// A GeoJSON source whose request fails is reported once for the source object (#777): the first resolve of the style
// reports it, and a later change of the style (or the new engine after a fall back to the main thread) does not fetch
// and report it again. Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle} from '../../src/resolve.ts';

test('a failed GeoJSON source is fetched and reported once, also when a partial resolve of the same style follows', async () => {
    let requests = 0;
    const fetchFn = (async () => { requests++; return new Response('', {status: 404}); }) as typeof fetch;
    const style = {version: 8, sources: {bad: {type: 'geojson', data: 'https://example.test/bad.geojson'}}, layers: []};
    const errors: unknown[] = [], fail = (e: unknown) => { errors.push(e); };
    const first = await resolveStyle(style, fetchFn, undefined, undefined, fail);
    assert.equal(first.sources.bad, undefined, 'the source is left out');
    const later = await resolveStyle(style, fetchFn, undefined, {late() {}, fail}, fail);
    assert.equal(later.sources.bad, undefined);
    await resolveStyle(style, fetchFn, undefined, undefined, fail);
    assert.equal(errors.length, 1, 'one error');
    assert.equal(requests, 1, 'one request');
});

test('without a function for failures, a failed GeoJSON source makes the style fail each time, and is fetched again', async () => {
    let requests = 0;
    const fetchFn = (async () => { requests++; return new Response('', {status: 404}); }) as typeof fetch;
    const style = {version: 8, sources: {bad: {type: 'geojson', data: 'https://example.test/bad.geojson'}}, layers: []};
    await assert.rejects(resolveStyle(style, fetchFn), /Failed to load GeoJSON/);
    await assert.rejects(resolveStyle(style, fetchFn), /Failed to load GeoJSON/);
    assert.equal(requests, 2);
});
