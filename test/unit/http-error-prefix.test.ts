// Unit test for #1377: a response with an HTTP error status reaches the caller as a `[map-jr-gl]` error that names the resource, the URL and the status.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle, loadSprite} from '../../src/resolve.ts';

const notFound = (() => Promise.resolve(new Response('no', {status: 404}))) as typeof fetch;

test('HTTP error: a style, a GeoJSON URL, a source and a sprite that answer 404 name the resource, the URL and the status', async () => {
    const style = await resolveStyle('https://x.test/style.json', notFound).catch(e => e);
    assert.equal(style.message, '[map-jr-gl] E1163 the request for the style https://x.test/style.json failed: HTTP 404');
    const geojson = await resolveStyle({version: 8, sources: {a: {type: 'geojson', data: 'https://x.test/a.geojson'}}, layers: []}, notFound).catch(e => e);
    assert.equal(geojson.message, '[map-jr-gl] E1163 the request for the GeoJSON https://x.test/a.geojson failed: HTTP 404');
    const source = await resolveStyle({version: 8, sources: {a: {type: 'vector', url: 'https://x.test/tiles.json'}}, layers: []}, notFound).catch(e => e);
    assert.equal(source.message, '[map-jr-gl] E1163 the request for the source https://x.test/tiles.json failed: HTTP 404');
    const sprite = await loadSprite('https://x.test/sprite', false, notFound).catch(e => e);
    assert.equal(sprite.message, '[map-jr-gl] E1163 the request for the sprite https://x.test/sprite.json failed: HTTP 404');
});

test('HTTP error: a long URL is cut', async () => {
    const e = await resolveStyle('https://x.test/' + 'a'.repeat(500), notFound).catch(e => e);
    assert.match(e.message, /^\[map-jr-gl\] E1163 the request for the style https:\/\/x\.test\/a+\.\.\. failed: HTTP 404$/);
    assert.ok(e.message.length < 300);
});
