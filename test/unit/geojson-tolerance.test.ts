// The `tolerance` of a GeoJSON source simplifies lines and polygons for each zoom level, as geojson-vt does in MapLibre GL JS (#1697).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareSource, sliceGeoJSON} from '../../src/geojson.ts';
import {resolveStyle} from '../../src/resolve.ts';

// A line along the equator with 1,000 vertices that wiggle by 0.0001 degrees.
const line = {type: 'LineString', coordinates: Array.from({length: 1000}, (_, i) => [-50 + i * 0.1, i % 2 ? 0.0001 : 0])};
// The vertices of the line in all tiles of zoom z.
const vertices = (tolerance: number | undefined, z: number) => {
    const s = prepareSource(line, tolerance === undefined ? {} : {tolerance}, 18), n = 2 ** z;
    let count = 0;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
        const layer = Object.values(sliceGeoJSON(s, z, x, y))[0];
        for (const f of layer?.features ?? []) { const c: number[] = []; f.geometry(4096, c, []); count += c.length / 2; }
    }
    return count;
};

test('GeoJSON tolerance: a tile keeps fewer vertices at low zoom, 0.375 is the default, and 0 does not simplify', () => {
    const plain = vertices(0, 2), simple = vertices(0.375, 2);
    assert.ok(plain > 500, `tolerance 0: ${plain}`);
    assert.ok(simple < 20, `tolerance 0.375: ${simple}`);
    assert.equal(vertices(undefined, 2), simple, 'the default is 0.375');
});

test('GeoJSON tolerance: the style option reaches the source', async () => {
    const style = await resolveStyle({version: 8, sources: {g: {type: 'geojson', data: line, tolerance: 1}}, layers: []} as any);
    assert.equal((style.sources.g as any).options?.tolerance, 1);
});

test('GeoJSON tolerance: a tile at the maxzoom of the source keeps every vertex', () => {
    // The middle vertex is 0.2 pixels off the line at z14, 13 pixels at z20 when the z14 tile is overzoomed.
    const dy = 0.2 / 512 / 2 ** 14 * 360, n = 2 ** 14;
    const s = prepareSource({type: 'LineString', coordinates: [[0.001, 0.001], [0.002, 0.001 + dy], [0.003, 0.001]]}, {}, 14);
    const c: number[] = [];
    for (const f of Object.values(sliceGeoJSON(s, 14, Math.floor(180.002 / 360 * n), n / 2 - 1))[0].features) f.geometry(4096, c, []);
    assert.equal(c.length / 2, 3);
});
