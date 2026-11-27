// A polygon ring drawn as a line starts its distance along the line with the length of its closing segment already
// counted, as MapLibre GL JS does, so that its dashes start at the same place (#1806; the render test `line-dasharray/slant`).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate, LINE_VERTEX} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('line distance: a polygon ring starts with the length of its closing segment, and a line string starts at 0', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const ring = [[lng, lat], [lng + 0.1, lat], [lng + 0.1, lat + 0.05], [lng, lat + 0.05], [lng, lat]];
    const dists = (geometry: any) => {
        const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry} as any), z, tx, ty);
        const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g'})!], false).layers.l)!;
        const view = new DataView(out.v.buffer, out.v.byteOffset, out.v.byteLength), vs = [];
        for (let o = 0; o < view.byteLength; o += LINE_VERTEX) vs.push({x: view.getInt16(o, true) / 2, y: view.getInt16(o + 2, true) / 2, dist: view.getFloat32(o + 12, true)});
        const span = (k: 'x' | 'y') => Math.max(...vs.map(v => v[k])) - Math.min(...vs.map(v => v[k]));
        return {first: Math.min(...vs.map(v => v.dist)), last: Math.max(...vs.map(v => v.dist)), width: span('x'), height: span('y')};
    };
    const polygon = dists({type: 'Polygon', coordinates: [ring]});
    // The ring is a rectangle. Its closing segment is one of its two sides, and the distance at its end is the whole
    // perimeter plus that side.
    assert.ok(Math.abs(polygon.last - polygon.first - 2 * (polygon.width + polygon.height)) < 1, 'the ring is one perimeter long');
    assert.ok(Math.abs(polygon.first - polygon.width) < 1 || Math.abs(polygon.first - polygon.height) < 1, `the first vertex is at ${polygon.first}, not at the length of a side`);
    assert.equal(dists({type: 'LineString', coordinates: ring}).first, 0);
});
