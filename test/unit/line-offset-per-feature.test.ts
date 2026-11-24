// A `line-offset` with a data expression moves each line by its own value, as in MapLibre GL JS (#1701; the render
// test `line-offset/property-function`). The offset goes into the line vertex, in eighths of a pixel.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate, LINE_VERTEX} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('line-offset: a data expression gives each feature its own offset in the vertices', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const line = (o: number, dy: number) => ({type: 'Feature', properties: {o}, geometry: {type: 'LineString', coordinates: [[lng - 0.05, lat + dy], [lng + 0.05, lat + dy]]}});
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [line(-3, 0), line(5.5, 0.01)]} as any), z, tx, ty);
    const offsets = (paint: Record<string, unknown>) => {
        const v = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', paint})!], false).layers.l)!.v;
        const view = new DataView(v.buffer, v.byteOffset, v.byteLength), out = new Set<number>();
        for (let o = 0; o < v.length; o += LINE_VERTEX) out.add(view.getInt16(o + 10, true) / 8);
        return [...out].sort((a, b) => a - b);
    };
    assert.deepEqual(offsets({'line-offset': ['get', 'o']}), [-3, 5.5]);
    assert.deepEqual(offsets({'line-offset': 4}), [0], 'a constant offset stays a uniform');
});
