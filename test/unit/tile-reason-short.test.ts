// Unit test for #2232: the value `reason` of E1163 for a tile is a short code in production, and the development build keeps the advice.
import {test} from 'node:test';
import assert from 'node:assert/strict';

const g = globalThis as any;
g.__VERSION__ = 'test';
const {fetchTile} = await import('../../src/tile-fetch.ts');
const {TileBuilder} = await import('../../src/tiles.ts');
g.createImageBitmap = () => Promise.reject(new Error('bad image'));
const answer = (() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), {status: 200}))) as typeof fetch;

test('tile 503: the reason is "HTTP 503" in production and has the advice in development', async () => {
    const f = (() => Promise.resolve(new Response('x', {status: 503}))) as typeof fetch;
    g.__DEV__ = false;
    assert.match((await fetchTile('https://x.test/1/2/3.pbf', f, new AbortController().signal).catch(e => e)).message, /failed: HTTP 503$/);
    g.__DEV__ = true;
    assert.match((await fetchTile('https://x.test/1/2/3.pbf', f, new AbortController().signal).catch(e => e)).message, /failed: HTTP 503\. .*Check the server/);
});

test('elevation tile that cannot be decoded: the reason is "undecodable image" in production', async () => {
    const b = new TileBuilder(answer);
    b.decodeImage = (() => { throw new Error('bad image'); }) as any;
    g.__DEV__ = false;
    const e = await b.loadElevation({id: 1, url: 'https://x.test/0/0/0.png', encoding: 'terrarium'}).catch(e => e);
    assert.match(e.message, /failed: undecodable image$/);
    g.__DEV__ = true;
    const d = await b.loadElevation({id: 2, url: 'https://x.test/0/0/0.png', encoding: 'terrarium'}).catch(e => e);
    assert.match(d.message, /failed: the response is not an image.*PNG or WebP/);
});

test('raster tile that cannot be decoded: the reason is "undecodable image" in production', async () => {
    const b = new TileBuilder(answer);
    g.__DEV__ = false;
    const e = await b.loadImage({id: 1, url: 'https://x.test/0/0/0.png'}).catch(e => e);
    assert.match(e.message, /failed: undecodable image$/);
    g.__DEV__ = true;
    const d = await b.loadImage({id: 2, url: 'https://x.test/0/0/0.png'}).catch(e => e);
    assert.match(d.message, /failed: the response is not an image.*PNG, JPEG or WebP/);
});
