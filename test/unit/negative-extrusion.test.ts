// A negative `fill-extrusion-height` or `fill-extrusion-base` is 0, as in MapLibre GL JS (#600; the render tests
// `fill-extrusion-height/negative` and `fill-extrusion-base/negative`).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('fill-extrusion: a negative height or base is 0', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const square = (height: number, base: number) => ({type: 'Feature', properties: {height, base}, geometry: {type: 'Polygon',
        coordinates: [[[lng, lat], [lng + 0.01, lat], [lng + 0.01, lat + 0.01], [lng, lat + 0.01], [lng, lat]]]}});
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [square(-10, -20), square(20, -5), square(30, 10)]} as any), z, tx, ty);
    const build = (paint: Record<string, unknown>) => buildTile(data, z, [compileLayer({id: 'b', type: 'fill-extrusion', source: 'g', paint})!], false).layers.b;
    const each = build({'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'base']});
    assert.deepEqual(Array.from(each.height!), [0, 20, 30]);
    assert.deepEqual(Array.from(each.base!), [0, 0, 10]);
    // (A height and a base of the whole layer are drawn by the page, which makes a negative value 0: the tile has 1 and 0, #972.)
    const constant = build({'fill-extrusion-height': -10, 'fill-extrusion-base': -20});
    assert.equal(constant.lift, true);
    assert.deepEqual(Array.from(constant.height!), [1, 1, 1]);
    assert.deepEqual(Array.from(constant.base!), [0, 0, 0]);
});
