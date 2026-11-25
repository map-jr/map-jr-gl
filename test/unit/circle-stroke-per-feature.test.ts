// `circle-stroke-color`, `circle-stroke-opacity`, `circle-stroke-width` and `circle-blur` with a data expression give
// each circle its own value, as in MapLibre GL JS (#1703; the render tests `circle-stroke-*/property-function` and
// `circle-blur/property-function`). The values go into buffers of their own, which constant values do not have.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('circle stroke and blur: a data expression gives each feature its own values in the vertices', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const point = (v: number, dx: number) => ({type: 'Feature', properties: {v}, geometry: {type: 'Point', coordinates: [lng + dx, lat]}});
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [point(0, 0), point(1, 0.05)]} as any), z, tx, ty);
    const batch = (paint: Record<string, unknown>) => tessellate(buildTile(data, z, [compileLayer({id: 'c', type: 'circle', source: 'g', paint})!], false).layers.c)! as {stroke?: Uint8Array; sb?: Float32Array};
    // The distinct values of the vertices, `size` numbers each.
    const values = (a: ArrayLike<number>, size: number) => [...new Set(Array.from({length: a.length / size}, (_, i) => Array.from(a).slice(i * size, i * size + size).join(',')))].sort();

    const b = batch({
        'circle-stroke-color': ['case', ['==', ['get', 'v'], 0], 'red', 'blue'],
        'circle-stroke-opacity': ['case', ['==', ['get', 'v'], 0], 1, 0.5],
        'circle-stroke-width': ['+', 2, ['get', 'v']],
        'circle-blur': 0.25,
    });
    assert.deepEqual(values(b.stroke!, 4), ['0,0,255,128', '255,0,0,255']);
    assert.deepEqual(values(b.sb!, 2), ['2,0', '3,0'], 'a constant blur is 0 here and stays in its uniform');
    assert.deepEqual(values(batch({'circle-blur': ['get', 'v']}).sb!, 2), ['0,0', '0,1']);
    const constant = batch({'circle-stroke-color': 'red', 'circle-stroke-width': 2, 'circle-blur': 0.5});
    assert.equal(constant.stroke, undefined, 'a constant stroke color stays a uniform');
    assert.equal(constant.sb, undefined, 'a constant stroke width and blur stay uniforms');
});
