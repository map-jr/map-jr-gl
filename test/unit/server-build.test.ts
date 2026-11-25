// The built server renderer leaves out the methods that only the browser map calls, and the decoding of images by a
// browser (`serverDrops` in build.mjs, #2041). It draws the same as the source.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import * as source from '../../src/server.ts';

const built: typeof source = await import(new URL('../../dist/server.js', import.meta.url).href);
const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const n = 2 ** 14, center: [number, number] = [(4823 + 0.5) / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * (6160 + 0.5) / n))) * 180 / Math.PI];

test('the built server renderer has no code of the camera of the map, of queries or of image decoding by a browser', () => {
    const code = readFileSync('dist/server.js', 'utf8');
    for (const text of ['fogRange', 'unproject', 'loadElevation', 'createImageBitmap', 'Elevation tiles need a browser']) assert.ok(!code.includes(text), text);
});

test('the built server renderer draws vector tiles, labels, GeoJSON and a bearing as the source does', async () => {
    const style = {
        version: 8,
        sources: {s: {type: 'vector', tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], maxzoom: 14},
            g: {type: 'geojson', data: {type: 'FeatureCollection', features: [{type: 'Feature', properties: {name: 'A'}, geometry: {type: 'Point', coordinates: center}}]}}},
        layers: [
            {id: 'water', type: 'fill', source: 's', 'source-layer': 'water', paint: {'fill-color': '#0af'}},
            {id: 'roads', type: 'line', source: 's', 'source-layer': 'transportation', paint: {'line-color': '#555', 'line-width': 2}},
            {id: 'names', type: 'symbol', source: 's', 'source-layer': 'transportation_name', layout: {'text-field': ['get', 'name'], 'symbol-placement': 'line'}},
            {id: 'point', type: 'circle', source: 'g', paint: {'circle-radius': 6, 'circle-color': '#f00'}},
            {id: 'label', type: 'symbol', source: 'g', layout: {'text-field': ['get', 'name']}},
        ],
    };
    const options = {style, center, zoom: 14.5, bearing: 20, width: 600, height: 400, fetch: (async () => new Response(bytes)) as typeof fetch};
    const [a, b] = await Promise.all([source.renderToSVG(options), built.renderToSVG(options)]);
    assert.match(a.svg, /<path fill="#00aaff"/);
    assert.match(a.svg, /<text[^>]*>A</);
    assert.equal(b.svg, a.svg);
    assert.deepEqual(b.tiles, a.tiles);
});

/** A PNG image of 8-bit RGB pixels without filters. */
function png(width: number, height: number, color: (x: number, y: number) => number[]) {
    const raw = new Uint8Array(height * (width * 3 + 1));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(color(x, y), y * (width * 3 + 1) + 1 + x * 3);
    const crc = (b: Uint8Array) => { let c = ~0; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c >>> 1 ^ 0xedb88320 & -(c & 1); } return ~c >>> 0; };
    const chunk = (type: string, data: Uint8Array) => {
        const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
        view.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8); view.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
        return out;
    };
    const head = new Uint8Array(13);
    new DataView(head.buffer).setUint32(0, width); new DataView(head.buffer).setUint32(4, height);
    head[8] = 8; head[9] = 2;
    return Buffer.concat([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())]);
}

test('the built server renderer decodes elevation tiles and draws contours as the source does', async () => {
    // A cone 0-1000 m high in terrarium encoding, the same for every tile.
    const dem = png(64, 64, (x, y) => { const e = Math.max(0, 1000 - Math.hypot(x - 32, y - 32) * 40) + 32768; return [Math.floor(e / 256), Math.floor(e) % 256, 0]; });
    const style = {version: 8, sources: {
        dem: {type: 'raster-dem', tiles: ['https://example.test/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 512, maxzoom: 12},
        contours: {type: 'contour', source: 'dem', overzoom: 0, thresholds: {0: [100, 500]}}},
    layers: [{id: 'c', type: 'line', source: 'contours', 'source-layer': 'contours', paint: {'line-color': '#963'}}]};
    const options = {style, width: 256, height: 256, center: [0, 0] as [number, number], zoom: 3, fetch: (async () => new Response(dem as BodyInit)) as typeof fetch};
    const [a, b] = await Promise.all([source.renderToSVG(options), built.renderToSVG(options)]);
    assert.match(b.svg, /<(path|use)[^>]*stroke="#996633"/);
    assert.equal(b.svg, a.svg);
});
