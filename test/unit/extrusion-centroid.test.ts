// On 3D terrain, each polygon of a fill-extrusion stands on the ground at its centroid, as in MapLibre GL JS, so its
// roof stays flat (#2154; the render tests `terrain/fill-extrusion*`). Every vertex carries its polygon's centroid.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, toGL} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('fill-extrusion: every vertex carries the centroid of its own polygon', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.2) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const sq = (x: number, d: number) => [[[x, lat], [x + d, lat], [x + d, lat + d], [x, lat + d], [x, lat]]];
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'MultiPolygon',
        coordinates: [sq(lng, 0.02), sq(lng + 0.1, 0.04)]}} as any), z, tx, ty);
    const ir = buildTile(data, z, [compileLayer({id: 'b', type: 'fill-extrusion', source: 'g', paint: {'fill-extrusion-height': 10}})!], false);
    const b = toGL(ir).tile.layers.b as any;
    assert.ok(b.c, 'the batch has centroids');
    assert.equal(b.c.length, b.v.length / 2);
    const seen = new Map<string, number[]>();
    for (let i = 0; i < b.c.length / 2; i++) {
        const k = `${b.c[i * 2]},${b.c[i * 2 + 1]}`;
        seen.set(k, [...(seen.get(k) ?? []), b.v[i * 4], b.v[i * 4 + 1]]);
    }
    assert.equal(seen.size, 2);
    for (const [k, xy] of seen) {
        const [cx, cy] = k.split(',').map(Number), xs = xy.filter((_, i) => i % 2 === 0), ys = xy.filter((_, i) => i % 2);
        assert.ok(Math.abs(cx - (Math.min(...xs) + Math.max(...xs)) / 2) <= 1 && Math.abs(cy - (Math.min(...ys) + Math.max(...ys)) / 2) <= 1, k);
    }
});
