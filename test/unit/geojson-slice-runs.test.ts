// A tile reads only the runs of vertices near it, and gives the same geometry as a slice that reads every vertex (#1888).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSource, sliceGeoJSON} from '../../src/geojson.ts';
import {mercX, mercY} from '../../src/geo.ts';

const N = 20000;
const ring = (wiggle: number) => Array.from({length: N}, (_, i) => {
    const a = i / N * 2 * Math.PI, r = 5 + wiggle * Math.sin(i * 0.7);
    return [10 + r * Math.cos(a), 45 + r * Math.sin(a) * 0.7];
});
/** A rough ring that crosses the edges of a tile many times within one run of vertices. */
let seed = 1;
const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
const rough = Array.from({length: 2000}, (_, i) => {
    const a = i / 2000 * 2 * Math.PI, r = 3 * (1 + 0.3 * Math.sin(i * 0.37) + 0.1 * (random() - 0.5));
    return [10 + r * Math.cos(a) + 0.3 * (random() - 0.5), 45 + r * Math.sin(a) * 0.7 + 0.3 * (random() - 0.5)];
});
const sources = (o: {tolerance?: number}) => {
    const poly = ring(0.01), line = ring(0.02);
    return [
        prepareSource({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[...poly, poly[0]]]}}, o),
        prepareSource({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: line}}, o),
        prepareSource({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[...rough, rough[0]]]}}, o),
    ];
};
/** The geometry of each feature, with each ring starting at the same vertex: a line along a polygon outline starts its dashes there. */
const geometry = (out: ReturnType<typeof sliceGeoJSON>) => Object.values(out)[0]?.features.map(f => {
    const c: number[] = [], e: number[] = [];
    f.geometry(4096, c, e);
    return [c, e];
});

test('a tile gives the same geometry as a slice that reads every vertex', () => {
    for (const tolerance of [0, undefined]) for (const src of sources({tolerance})) {
        // Boxes that are never outside a tile turn the skipping off.
        const all = {...src, features: src.features.map(f => ({...f}))};
        sliceGeoJSON(src, 0, 0, 0);
        (all.features[0] as any).runs = [new Float64Array((src.features[0] as any).runs[0].length).map((_, i) => i % 4 < 2 ? -Infinity : Infinity)];
        for (const z of [3, 6, 9, 10, 12]) {
            const n = 2 ** z, xa = Math.floor(mercX(4) * n), xb = Math.floor(mercX(16) * n), ya = Math.floor(mercY(50) * n), yb = Math.floor(mercY(40) * n);
            const step = Math.max(1, Math.floor((xb - xa) / 12));
            for (let x = xa; x <= xb; x += step) for (let y = ya; y <= yb; y += step) assert.deepEqual(geometry(sliceGeoJSON(src, z, x, y)), geometry(sliceGeoJSON(all, z, x, y)), `${z}/${x}/${y}`);
        }
    }
});

test('a tile at zoom 10 reads a small part of a long ring', () => {
    const [src] = sources({});
    const f = src.features[0], r = f.rings[0];
    let reads = 0;
    f.rings[0] = new Proxy(r, {get: (t, k) => (typeof k === 'string' && /^\d+$/.test(k) && reads++, Reflect.get(t, k) as unknown)}) as Float64Array;
    sliceGeoJSON(src, 0, 0, 0); // makes the boxes of the runs
    const n = 2 ** 10;
    reads = 0;
    const out = sliceGeoJSON(src, 10, Math.floor(mercX(15) * n), Math.floor(mercY(45) * n));
    assert.ok(geometry(out)?.length, 'the tile has the polygon');
    assert.ok(reads < r.length / 10, `${reads} reads of ${r.length} values`);
});
