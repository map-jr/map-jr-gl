// A `heatmap-radius` with a data expression gives each point its own radius, as in MapLibre GL JS (#1705; the render
// test `heatmap-radius/data-expression`). The radius goes into the buffer `sb` of the points, which a constant radius
// does not have, on the flat map and on the grid of 4 × 4 corners of the globe below zoom 6.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('heatmap-radius: a data expression gives each feature its own radius in the vertices', () => {
    const z = 3, tx = 4, ty = 3, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const point = (r: number, dx: number) => ({type: 'Feature', properties: {r}, geometry: {type: 'Point', coordinates: [lng + dx, lat]}});
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [point(10, 0), point(45, 1)]} as any), z, tx, ty);
    const batch = (paint: Record<string, unknown>, globe?: object) =>
        tessellate(buildTile(data, z, [compileLayer({id: 'h', type: 'heatmap', source: 'g', paint})!], false).layers.h, globe as any)! as {sb?: Float32Array};
    const radii = (sb?: Float32Array) => [...new Set(sb?.filter((_, i) => i % 2 === 0))].sort((a, b) => a - b);
    assert.deepEqual(radii(batch({'heatmap-radius': ['get', 'r']}).sb), [10, 45]);
    const grid = batch({'heatmap-radius': ['get', 'r']}, {grid: 8, heat: true}).sb!;
    assert.equal(grid.length, 2 * 16 * 2, 'on the globe each of the 16 corners of a point has the radius');
    assert.deepEqual(radii(grid), [10, 45]);
    assert.equal(batch({'heatmap-radius': 20}).sb, undefined, 'a constant radius stays a uniform');
});
