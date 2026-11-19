// Unit tests for `tileZoomOffset` of the server renderer (#985).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderToSVG} from '../../src/server.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const n = 2 ** 14, center: [number, number] = [(4823 + 0.5) / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (6160 + 0.5) / n))) * 180 / Math.PI];
const style = (maxzoom = 14, minzoom = 0) => ({
    version: 8,
    sources: {s: {type: 'vector', tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], minzoom, maxzoom}},
    layers: [{id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#0af'}}],
});
// Every request gets the same tile, so the paths show the scale at which a tile is drawn.
// `fetched` has the URLs that the server requested; `tiles` of the result has the URLs for the live map.
const render = async (more: object, s: unknown = style()) => {
    const fetched: string[] = [];
    const r = await renderToSVG({style: s, center, zoom: 12, width: 600, height: 400,
        fetch: (async (url: unknown) => { fetched.push(String(url)); return new Response(bytes); }) as typeof fetch, ...more});
    return {...r, fetched};
};

test('tileZoomOffset: 2 at zoom 12 fetches tiles of zoom 10 and draws them at the size of zoom 12', async () => {
    const plain = await render({});
    assert.ok(plain.tiles.every(t => /\/12\//.test(t)), plain.tiles.join());
    const low = await render({tileZoomOffset: 2});
    assert.ok(low.fetched.length > 0 && low.fetched.every(t => /\/10\//.test(t)), low.fetched.join());
    assert.ok(low.fetched.length < plain.tiles.length, `${low.fetched.length} < ${plain.tiles.length}`);
    assert.match(low.svg, /<path fill="#00aaff"/);
    assert.notEqual(low.svg, plain.svg);
    // The same image as a source that stops at zoom 10, which the renderer over-zooms to the size of zoom 12.
    assert.equal(low.svg, (await render({}, style(10))).svg);
    // The URLs for the live map stay those of zoom 12.
    assert.deepEqual(low.tiles, plain.tiles);
});

test('tileZoomOffset: 0 is the default, and a source does not go below its minzoom', async () => {
    assert.equal((await render({tileZoomOffset: 0})).svg, (await render({})).svg);
    assert.ok((await render({tileZoomOffset: 3}, style(14, 11))).fetched.every(t => /\/11\//.test(t)));
});

test('tileZoomOffset: -2 at zoom 10 fetches tiles of zoom 12, and the source maxzoom still holds', async () => {
    const plain = await render({zoom: 10});
    assert.ok(plain.tiles.every(t => /\/10\//.test(t)), plain.tiles.join());
    const high = await render({zoom: 10, tileZoomOffset: -2});
    assert.ok(high.fetched.every(t => /\/12\//.test(t)), high.fetched.join());
    assert.ok(high.fetched.length > plain.tiles.length, `${high.fetched.length} > ${plain.tiles.length}`);
    assert.match(high.svg, /<path fill="#00aaff"/);
    assert.deepEqual(high.tiles, plain.tiles);
    assert.ok((await render({zoom: 10, tileZoomOffset: -3}, style(11))).fetched.every(t => /\/11\//.test(t)));
    // The request limits still apply to the extra tiles.
    await assert.rejects(render({zoom: 10, tileZoomOffset: -2, allowHosts: ['other.test']}), /tiles\.test/);
});

test('tileZoomOffset: a value that is not a whole number rejects with a message', async () => {
    await assert.rejects(render({tileZoomOffset: 1.5}), /^Error: \[map-jr-gl\] tileZoomOffset: 1\.5 is not a whole number\. Write for example tileZoomOffset: 2/);
});

test('tileZoomOffset: with 2 a filter sees the zoom of the render, not of the tiles (#991)', async () => {
    const s: any = style();
    s.layers.push({id: 'deep', type: 'fill', source: 's', 'source-layer': 'water', filter: ['>=', ['zoom'], 12], paint: {'fill-color': '#f00'}});
    const low = await render({tileZoomOffset: 2}, s);
    assert.ok(low.fetched.every(t => /\/10\//.test(t)), low.fetched.join());
    assert.match(low.svg, /#ff0000/, 'a filter of zoom 12 and above draws at a render of zoom 12 from tiles of 10');
    // (A source that stops at zoom 10, over-zoomed to 12, is the same.)
    s.sources.s.maxzoom = 10;
    assert.match((await render({}, s)).svg, /#ff0000/);
});

test('tileZoomOffset: with -2 the style is evaluated at the zoom of the render, not of the tiles', async () => {
    const s: any = style();
    s.layers.push({id: 'deep', type: 'fill', source: 's', 'source-layer': 'water', filter: ['>=', ['zoom'], 11], paint: {'fill-color': '#f00'}},
        {id: 'edge', type: 'line', source: 's', 'source-layer': 'water', paint: {'line-color': '#0f0', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, ['coalesce', ['get', 'none'], 1], 12, ['coalesce', ['get', 'none'], 9]]}});
    const high = await render({zoom: 10, tileZoomOffset: -2}, s);
    assert.ok(high.fetched.every(t => /\/12\//.test(t)), high.fetched.join());
    assert.doesNotMatch(high.svg, /#ff0000/, 'a filter of zoom 11 and above draws nothing at zoom 10');
    const widths = [...high.svg.matchAll(/stroke="#00ff00"[^>]*?stroke-width="([\d.]+)"|stroke-width="([\d.]+)"[^>]*?stroke="#00ff00"/g)].map(m => +(m[1] ?? m[2]));
    assert.ok(widths.length > 0, 'the line layer draws');
    assert.ok(widths.every(w => Math.abs(w - 1) < 0.01), `the line width of zoom 10 is 1, not ${widths}`);
});
