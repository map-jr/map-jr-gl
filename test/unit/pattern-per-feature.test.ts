// A fill-pattern, line-pattern or fill-extrusion-pattern that reads feature properties draws the image of each feature,
// as in MapLibre GL JS (#1432). The tile has one batch for each image, and a feature with no image is not drawn.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, patternKey, toGL} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

const z = 10, tx = 300, ty = 380, n = 2 ** z;
const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
const square = (dx: number, kind?: string) => ({type: 'Feature', properties: kind ? {kind} : {}, geometry: {type: 'Polygon',
    coordinates: [[[lng + dx, lat], [lng + dx + 0.01, lat], [lng + dx + 0.01, lat + 0.01], [lng + dx, lat + 0.01], [lng + dx, lat]]]}});
const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [square(0, 'brick'), square(0.02, 'wave'), square(0.04, 'brick'), square(0.06)]} as any), z, tx, ty);

for (const [type, prop] of [['fill', 'fill-pattern'], ['line', 'line-pattern'], ['fill-extrusion', 'fill-extrusion-pattern']]) {
    test(`${prop} with ["get", "kind"]: one batch for each image`, () => {
        const L = compileLayer({id: 'p', type, source: 'g', paint: {[prop]: ['get', 'kind']}} as any)!;
        const {tile} = toGL(buildTile(data, z, [L], false));
        const batches = [0, 1, 2].map(k => tile.layers[patternKey('p', k)]);
        assert.deepEqual(batches.map(b => b?.pat), ['brick', 'wave', undefined]);
    });
}

test('a pattern that is the same for every feature keeps one batch', () => {
    const L = compileLayer({id: 'p', type: 'fill', source: 'g', paint: {'fill-pattern': 'brick'}})!;
    const {tile} = toGL(buildTile(data, z, [L], false));
    assert.deepEqual(Object.keys(tile.layers), ['p']);
    assert.equal(tile.layers.p.pat, undefined);
});
