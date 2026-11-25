// A `line-gap-width` with a data expression gives each line its own gap, as in MapLibre GL JS (#1704; the render
// test `line-gap-width/property-function`).
// The gap goes into the numbers of each feature (`feat`, bit 2 of `featMask`), which a constant gap does not use.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('line-gap-width: a data expression gives each feature its own gap in the vertices', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const line = (g: number, dy: number) => ({type: 'Feature', properties: {g}, geometry: {type: 'LineString', coordinates: [[lng - 0.05, lat + dy], [lng + 0.05, lat + dy]]}});
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [line(3, 0), line(-2, 0.005), line(12.5, 0.01)]} as any), z, tx, ty);
    const batch = (paint: Record<string, unknown>) => tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', paint})!], false).layers.l)! as {feat?: Float32Array; featMask?: number};
    assert.equal(batch({'line-gap-width': ['get', 'g']}).featMask, 2);
    assert.deepEqual([...new Set(batch({'line-gap-width': ['get', 'g']}).feat)].sort((a, b) => a - b), [0, 3, 12.5], 'a negative gap is 0');
    assert.equal(batch({'line-gap-width': 4}).feat, undefined, 'a constant gap stays a uniform');
});
