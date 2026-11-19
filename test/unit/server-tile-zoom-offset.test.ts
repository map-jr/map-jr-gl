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
const render = (more: object, s: unknown = style()) => renderToSVG({style: s, center, zoom: 12, width: 600, height: 400,
    fetch: (async () => new Response(bytes)) as typeof fetch, ...more});

test('tileZoomOffset: 2 at zoom 12 fetches tiles of zoom 10 and draws them at the size of zoom 12', async () => {
    const plain = await render({});
    assert.ok(plain.tiles.every(t => /\/12\//.test(t)), plain.tiles.join());
    const low = await render({tileZoomOffset: 2});
    assert.ok(low.tiles.length > 0 && low.tiles.every(t => /\/10\//.test(t)), low.tiles.join());
    assert.ok(low.tiles.length < plain.tiles.length, `${low.tiles.length} < ${plain.tiles.length}`);
    assert.match(low.svg, /<path fill="#00aaff"/);
    assert.notEqual(low.svg, plain.svg);
    // The same image as a source that stops at zoom 10, which the renderer over-zooms to the size of zoom 12.
    assert.equal(low.svg, (await render({}, style(10))).svg);
});

test('tileZoomOffset: 0 is the default, and a source does not go below its minzoom', async () => {
    assert.equal((await render({tileZoomOffset: 0})).svg, (await render({})).svg);
    assert.ok((await render({tileZoomOffset: 3}, style(14, 11))).tiles.every(t => /\/11\//.test(t)));
});

test('tileZoomOffset: -2 at zoom 10 fetches tiles of zoom 12, and the source maxzoom still holds', async () => {
    const plain = await render({zoom: 10});
    assert.ok(plain.tiles.every(t => /\/10\//.test(t)), plain.tiles.join());
    const high = await render({zoom: 10, tileZoomOffset: -2});
    assert.ok(high.tiles.every(t => /\/12\//.test(t)), high.tiles.join());
    assert.ok(high.tiles.length > plain.tiles.length, `${high.tiles.length} > ${plain.tiles.length}`);
    assert.match(high.svg, /<path fill="#00aaff"/);
    assert.ok((await render({zoom: 10, tileZoomOffset: -3}, style(11))).tiles.every(t => /\/11\//.test(t)));
    // The request limits still apply to the extra tiles.
    await assert.rejects(render({zoom: 10, tileZoomOffset: -2, allowHosts: ['other.test']}), /tiles\.test/);
});

test('tileZoomOffset: a value that is not a whole number rejects with a message', async () => {
    await assert.rejects(render({tileZoomOffset: 1.5}), /^Error: \[map-jr-gl\] tileZoomOffset: 1\.5 is not a whole number\. Write for example tileZoomOffset: 2/);
});
