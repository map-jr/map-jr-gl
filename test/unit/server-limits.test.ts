// Unit tests for the limits of the server renderer: timeouts, the size of a response, the allowed hosts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToSVG} from '../../src/server.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const n = 2 ** 14, center: [number, number] = [(4823 + 0.5) / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (6160 + 0.5) / n))) * 180 / Math.PI];
const style = (tiles = 'https://tiles.test/{z}/{x}/{y}.pbf') => ({
    version: 8,
    sources: {s: {type: 'vector', tiles: [tiles], maxzoom: 14}},
    layers: [{id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#0af'}}],
});
// One tile covers the view.
const view = {center, zoom: 14, width: 200, height: 200};
const render = (fetch: (url: string, init?: RequestInit) => Promise<Response>, more: object = {}, s: unknown = style()) =>
    renderToSVG({style: s, ...view, fetch: ((url: any, init: any) => fetch(String(url), init)) as typeof globalThis.fetch, ...more});
/** A body that sends one chunk and then does not end. */
const endless = () => new Response(new ReadableStream({start(c) { c.enqueue(bytes.subarray(0, 100)); }}));

test('server limits: a render within the limits is the same as before', async () => {
    const {svg, tiles} = await render(async () => new Response(bytes), {maxBytes: bytes.length, allowHosts: ['tiles.test'], timeout: 5000, requestTimeout: 5000});
    assert.deepEqual(tiles, ['https://tiles.test/14/4823/6160.pbf']);
    assert.match(svg, /<path fill="#00aaff"/);
    const plain = await render(async () => new Response(bytes), {timeout: 0, requestTimeout: 0});
    assert.equal(plain.svg, svg);
});

test('server limits: a response that does not end stops at requestTimeout, also when fetch does not follow the signal', async () => {
    const start = Date.now();
    let aborted = false;
    await assert.rejects(render(async (_url, init) => { init!.signal!.addEventListener('abort', () => { aborted = true; }); return endless(); }, {requestTimeout: 60}),
        /^Error: \[map-jr-gl\] server render: the request to https:\/\/tiles\.test\/14\/4823\/6160\.pbf took longer than the "requestTimeout" of 60 ms/);
    assert.ok(Date.now() - start < 3000);
    assert.ok(aborted, 'the request gets an abort signal');
    // A fetch that never answers at all.
    await assert.rejects(render(() => new Promise(() => {}), {requestTimeout: 60}), /"requestTimeout" of 60 ms/);
});

test('server limits: timeout is for all requests of a render together', async () => {
    // The style takes 80 ms, so the tile has 40 ms left, and its body does not end.
    const fetch = async (url: string) => {
        if (url.endsWith('style.json')) { await new Promise(r => setTimeout(r, 80)); return new Response(JSON.stringify(style())); }
        return endless();
    };
    const start = Date.now();
    await assert.rejects(render(fetch, {timeout: 120, requestTimeout: 5000}, 'https://styles.test/style.json'), /took longer than the "timeout" of 120 ms; the request to https:\/\/tiles\.test\/14\/4823\/6160\.pbf was not complete/);
    assert.ok(Date.now() - start < 3000);
});

test('server limits: a response larger than maxBytes rejects, with and without a content-length', async () => {
    const message = /the response of https:\/\/tiles\.test\/14\/4823\/6160\.pbf is larger than "maxBytes" \(1000 bytes\)/;
    let read = 0;
    const chunks = () => new Response(new ReadableStream({pull(c) { read += 400; c.enqueue(new Uint8Array(400)); }}));
    await assert.rejects(render(async () => chunks(), {maxBytes: 1000}), message);
    assert.ok(read <= 2000, `the body is not read to its end (${read} bytes read)`);
    let touched = false;
    const declared = new Response(new ReadableStream({pull() { touched = true; }}, {highWaterMark: 0}), {headers: {'content-length': '5000'}});
    await assert.rejects(render(async () => declared, {maxBytes: 1000}), message);
    assert.equal(touched, false, 'a body with a content-length over the limit is not read');
});

test('server limits: a host that is not in allowHosts is not requested', async () => {
    const requested: string[] = [];
    const fetch = async (url: string) => { requested.push(url); return new Response(bytes); };
    await assert.rejects(render(fetch, {allowHosts: ['tiles.test']}, style('http://169.254.169.254/{z}/{x}/{y}.pbf')),
        /the host of http:\/\/169\.254\.169\.254\/14\/4823\/6160\.pbf is not in "allowHosts"\. Add "169\.254\.169\.254"/);
    assert.deepEqual(requested, []);
    // The URL of the style, and a host name in capitals in the list.
    await assert.rejects(render(fetch, {allowHosts: ['tiles.test']}, 'https://styles.test/style.json'), /the host of https:\/\/styles\.test\/style\.json is not in "allowHosts"/);
    assert.deepEqual(requested, []);
    await render(fetch, {allowHosts: ['Tiles.Test']});
    assert.deepEqual(requested, ['https://tiles.test/14/4823/6160.pbf']);
});

test('server limits: a redirect is followed only to a host in allowHosts', async () => {
    const requested: string[] = [], modes: unknown[] = [];
    const to = (location: string) => async (url: string, init?: RequestInit) => {
        requested.push(url); modes.push(init?.redirect);
        return url.startsWith('https://tiles.test/') ? new Response(null, {status: 302, headers: {location}}) : new Response(bytes);
    };
    await assert.rejects(render(to('http://localhost:9200/secret'), {allowHosts: ['tiles.test']}), /the host of http:\/\/localhost:9200\/secret is not in "allowHosts"/);
    assert.deepEqual(requested, ['https://tiles.test/14/4823/6160.pbf']);
    assert.deepEqual(modes, ['manual']);
    // An allowed host, with a relative location.
    requested.length = 0;
    const {tiles} = await render(to('//mirror.test/tile.pbf'), {allowHosts: ['tiles.test', 'mirror.test']});
    assert.deepEqual(requested, ['https://tiles.test/14/4823/6160.pbf', 'https://mirror.test/tile.pbf']);
    assert.equal(tiles.length, 1);
    // A redirect that does not end.
    await assert.rejects(render(async () => new Response(null, {status: 302, headers: {location: '/again'}}), {allowHosts: ['tiles.test']}), /was redirected more than 5 times/);
    // A fetch that follows the redirect itself: the response says where it came from.
    const followed = new Response(bytes);
    Object.defineProperty(followed, 'url', {value: 'http://localhost:9200/secret'});
    await assert.rejects(render(async () => followed, {allowHosts: ['tiles.test']}), /the host of http:\/\/localhost:9200\/secret is not in "allowHosts"/);
    // Without allowHosts the redirect stays with fetch, as before.
    modes.length = 0;
    await render(async (_url, init) => { modes.push(init?.redirect); return new Response(bytes); });
    assert.deepEqual(modes, [undefined]);
});

test('server limits: a wrong value of an option gets a message', async () => {
    const fetch = async () => new Response(bytes);
    await assert.rejects(render(fetch, {timeout: -1}), /"timeout" is -1\. Pass a number that is 0 \(no limit\) or more/);
    await assert.rejects(render(fetch, {maxBytes: '1MB'}), /"maxBytes" is 1MB/);
    await assert.rejects(render(fetch, {allowHosts: ['https://tiles.test']}), /"allowHosts" is \["https:\/\/tiles\.test"\]\. Pass a list of host names without a scheme/);
    await assert.rejects(render(fetch, {allowHosts: 'tiles.test'}), /"allowHosts" is "tiles\.test"/);
});
