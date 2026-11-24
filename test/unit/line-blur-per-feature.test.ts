// A `line-blur` with a data expression blurs each line by its own value, as in MapLibre GL JS (#1702; the render
// test `line-blur/property-function`). The blur goes into a buffer of its own, which a constant blur does not have.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('line-blur: a data expression gives each feature its own blur in the vertices', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const line = (b: number, dy: number) => ({type: 'Feature', properties: {b}, geometry: {type: 'LineString', coordinates: [[lng - 0.05, lat + dy], [lng + 0.05, lat + dy]]}});
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [line(2, 0), line(7.5, 0.01)]} as any), z, tx, ty);
    const batch = (paint: Record<string, unknown>) => tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', paint})!], false).layers.l)! as {blur?: Float32Array};
    assert.deepEqual([...new Set(batch({'line-blur': ['get', 'b']}).blur)].sort((a, b) => a - b), [2, 7.5]);
    assert.equal(batch({'line-blur': 4}).blur, undefined, 'a constant blur stays a uniform');
});
