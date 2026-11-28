// A tile worker keeps the tiles that were asked last, decoded, with the box of each feature (`TileBuilder.asked` in
// src/tiles.ts, `boxes` of `queryTile` in src/query.ts): a later question reads only the features near it. The answers
// are those of a question that reads the whole tile.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {queryTile, type TileBoxes, type TileQuery} from '../../src/query.ts';
import {decodeVectorTile} from '../../src/mvt.ts';
import {TileBuilder} from '../../src/tiles.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const road = (classes: string[]) => ['match', ['get', 'class'], classes, true, false];
const plain = [
    {layer: 'water', sourceLayer: 'water', radius: 0},
    {layer: 'landuse', sourceLayer: 'landuse', filter: ['!=', ['get', 'class'], 'residential'], radius: 0},
    {layer: 'buildings', sourceLayer: 'building', radius: 0},
    {layer: 'roads', sourceLayer: 'transportation', filter: road(['primary', 'secondary', 'tertiary']), radius: 8, ring: true},
    {layer: 'minor', sourceLayer: 'transportation', filter: road(['minor', 'service']), radius: 3, ring: true},
    {layer: 'casing', sourceLayer: 'transportation', filter: road(['minor', 'service']), also: ['!=', ['get', 'brunnel'], 'tunnel'], radius: 5, ring: true},
    {layer: 'poi', sourceLayer: 'poi', radius: 12},
    {layer: 'names', sourceLayer: 'transportation_name', radius: 0},
];
// (A line layer with a width, a gap and an offset for each feature, as the engine asks it: `size`.)
const sized = [
    ...plain.slice(0, 3),
    {layer: 'wide', sourceLayer: 'transportation', radius: 0, ring: true, size: {line: true, a: ['match', ['get', 'class'], 'motorway', 20, 'primary', 12, 4], b: 0, o: 0, zoom: 14.5, scale: 8}},
    {layer: 'gap', sourceLayer: 'transportation', filter: road(['primary', 'minor']), radius: 0, ring: true, size: {line: true, a: 3, b: ['match', ['get', 'class'], 'primary', 6, 0], o: 0, zoom: 14.5, scale: 8}},
    {layer: 'offset', sourceLayer: 'transportation', filter: road(['minor']), radius: 0, ring: true, size: {line: true, a: 4, b: 0, o: ['match', ['get', 'class'], 'minor', 5, 0], zoom: 14.5, scale: 8}},
    {layer: 'dots', sourceLayer: 'poi', radius: 0, size: {a: ['match', ['get', 'class'], 'park', 10, 4], b: 1, zoom: 14.5, scale: 8}},
    // (A width that depends on the zoom alone, as a function and as an expression, with and without an offset: the usual line layer.)
    {layer: 'zoomed', sourceLayer: 'transportation', filter: road(['primary', 'secondary']), radius: 0, ring: true, size: {line: true, a: {base: 1.2, stops: [[13, 2], [20, 30]]}, zoom: 14.5, scale: 8}},
    {layer: 'zoomed-gap', sourceLayer: 'transportation', filter: road(['minor']), radius: 0, ring: true, size: {line: true, a: ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 12], b: 3, zoom: 14.5, scale: 8}},
    {layer: 'zoomed-offset', sourceLayer: 'transportation', filter: road(['service']), radius: 0, ring: true, size: {line: true, a: 3, o: ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 6], zoom: 14.5, scale: 8}},
];
function questions(n: number): TileQuery[] {
    let s = 11;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280, out: TileQuery[] = [];
    for (let i = 0; i < n; i++) {
        const x = rnd() * 4500 - 200, y = rnd() * 4500 - 200, r = i % 4 === 0 ? rnd() * 400 : 3, sets = (i % 3 === 2 ? sized : plain) as TileQuery['sets'];
        const base = {source: 's', z: 14, zoom: 14.5, x: 4823, y: 6160, geometry: i % 2 === 0, sets};
        out.push(i % 5 === 4 ? {...base, px: x, py: y, radius: 6} : {...base, px: 0, py: 0, radius: 0, box: [x - r, y - r, x + r, y + r]});
    }
    // (The whole tile, and a question with no sets, as `querySourceFeatures` and the main API ask.)
    out.push({source: 's', z: 14, x: 4823, y: 6160, px: 0, py: 0, radius: 0, box: [-300, -300, 4400, 4400], sets: plain as TileQuery['sets']});
    out.push({source: 's', z: 14, x: 4823, y: 6160, px: 2048, py: 2048, radius: 30, sourceLayers: ['transportation'], filter: road(['primary'])});
    return out;
}

test('query boxes: a question with the boxes of the tile has the answer of a question that reads the whole tile', () => {
    const vt = decodeVectorTile(bytes), boxes: TileBoxes = {};
    let found = 0, some = 0;
    for (const [i, q] of questions(240).entries()) {
        const all = queryTile(decodeVectorTile(bytes), q), near = queryTile(vt, q, undefined, boxes);
        assert.deepEqual(near, all, `question ${i}`);
        found += all.length; if (all.length) some++;
    }
    assert.ok(found > 2000 && some > 150, `${found} features in ${some} answers`);
    // (Each source layer of the questions has the box of each of its features, and the geometry of those that were read.)
    // (The geometry that the tile keeps for the next question has a limit for the whole tile.)
    assert.ok(Object.values(boxes).reduce((n, b) => n + b.kept, 0) <= 4e5);
    for (const name of ['water', 'landuse', 'building', 'transportation', 'poi', 'transportation_name']) {
        assert.equal(boxes[name].box.length, vt[name].features.length * 4, name);
        assert.ok(boxes[name].kept > 0, name);
    }
});

test('query boxes: a question for a point reads the geometry of few features', () => {
    const vt = decodeVectorTile(bytes), boxes: TileBoxes = {};
    let read = 0;
    for (const f of vt.transportation.features) { const geometry = f.geometry.bind(f); f.geometry = (...a) => { read++; return geometry(...a); }; }
    const q: TileQuery = {source: 's', z: 14, x: 4823, y: 6160, px: 0, py: 0, radius: 0, box: [2040, 2040, 2046, 2046], sets: plain as TileQuery['sets']};
    queryTile(vt, q, undefined, boxes);
    const first = read, n = vt.transportation.features.length;
    // (The first question reads each feature one time, for its box, and then those near the point.)
    assert.ok(first >= n && first < n * 1.1, `${first} reads of ${n} features`);
    queryTile(vt, q, undefined, boxes);
    assert.equal(read, first, 'the same question again reads nothing');
    queryTile(vt, {...q, box: [1000, 3000, 1006, 3006]}, undefined, boxes);
    assert.ok(read - first < n * 0.05, `${read - first} reads for another point`);
});

test('query boxes: an answer has its own copy of the properties of a feature', () => {
    const vt = decodeVectorTile(bytes), boxes: TileBoxes = {};
    const q: TileQuery = {source: 's', z: 14, x: 4823, y: 6160, px: 0, py: 0, radius: 0, box: [0, 0, 4096, 4096], sets: [{layer: 'roads', sourceLayer: 'transportation', radius: 0}]};
    const a = queryTile(vt, q, undefined, boxes);
    const was = structuredClone(a[0].properties);
    a[0].properties.class = 'changed by the page';
    assert.deepEqual(queryTile(vt, q, undefined, boxes)[0].properties, was);
});

test('query boxes: a tile worker keeps the last tiles decoded, and decodes a tile again when it was loaded again', async () => {
    let answer = bytes, fetches = 0;
    const b = new TileBuilder((async () => (fetches++, new Response(answer))) as unknown as typeof fetch);
    const q = {source: 's', z: 14, x: 4823, y: 6160, px: 2048, py: 2048, radius: 60};
    const first = await b.query('https://example.com/a.pbf', q);
    assert.ok(first.length > 0);
    assert.deepEqual(await b.query('https://example.com/a.pbf', q), first);
    assert.equal(fetches, 1);
    // (At most six tiles are kept: the one that was asked longest ago goes.)
    for (let i = 0; i < 8; i++) await b.query(`https://example.com/${i}.pbf`, q);
    assert.equal((b as any).asked.size, 6);
    assert.ok(!(b as any).asked.has('s|https://example.com/a.pbf') && (b as any).asked.has('s|https://example.com/7.pbf'));
    // The source is loaded again with other data: the answer is of the new bytes.
    b.forget('s');
    assert.equal((b as any).asked.size, 0);
    answer = new Uint8Array(0);
    assert.deepEqual(await b.query('https://example.com/7.pbf', q), []);
});

test('query boxes: a feature with no id in the buffer of the tile, and a polygon that only touches the question, are found as without the boxes', () => {
    // (A tile of features without ids: one in the tile, one wholly in the buffer, one across the edge, and a polygon
    // whose edge runs along the side of the question.)
    const feature = (type: number, rings: number[][], id?: number): any => ({type, id, properties: {n: rings.length}, geometry(_: number, c: number[], ends: number[]) { for (const r of rings) { c.push(...r); ends.push(c.length / 2); } return rings.length; }});
    const data = () => ({places: {features: [
        feature(3, [[100, 100, 300, 100, 300, 300, 100, 300]]),
        feature(3, [[-200, 100, -50, 100, -50, 300, -200, 300]]),
        feature(3, [[-100, 400, 80, 400, 80, 600, -100, 600]]),
        feature(3, [[500, 500, 900, 500, 900, 900, 500, 900]], 7),
        feature(2, [[4000, 0, 4200, 50, 4300, 4000]]),
        feature(1, [[2048, 2048]], 9),
        feature(1, []),
    ]}});
    const kept = data(), boxes: TileBoxes = {};
    const sets = [{layer: 'p', sourceLayer: 'places', radius: 0}, {layer: 'l', sourceLayer: 'places', radius: 20, ring: true}] as TileQuery['sets'];
    const base = {source: 's', z: 1, x: 0, y: 0, px: 0, py: 0, radius: 0, sets, geometry: true};
    const asks: TileQuery[] = [
        {...base, box: [0, 0, 4096, 4096]}, {...base, box: [-300, 0, 0, 4096]}, {...base, box: [300, 300, 400, 400]}, {...base, box: [310, 100, 400, 300]}, {...base, box: [900, 900, 900, 900]},
        {...base, box: [880, 480, 880, 480]}, {...base, box: [4250, 2000, 4260, 2010]}, {...base, box: undefined, px: 2048, py: 2048, radius: 0}, {...base, box: undefined, px: 700, py: 700, radius: 5}, {...base, box: undefined, px: 320, py: 200, radius: 21},
    ];
    for (const [i, q] of asks.entries()) assert.deepEqual(queryTile(kept, q, undefined, boxes), queryTile(data(), q), `question ${i}`);
    // (The feature in the buffer alone is in no answer, with or without the boxes.)
    assert.equal(queryTile(kept, asks[1], undefined, boxes).filter(f => f.properties.n === 1 && f.type === 'Polygon').length, queryTile(data(), asks[1]).filter(f => f.type === 'Polygon').length);
});
