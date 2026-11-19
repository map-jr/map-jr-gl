// `line-miter-limit` and `line-round-limit` decide which corners of a line are mitred, as in MapLibre GL JS (#1012;
// the render test `line-miter-limit/property-function`).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate, LINE_VERTEX} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('line joins: the miter limit and the round limit choose the join of a corner', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    // A right angle: its miter is sqrt(2) = 1.41 line widths long.
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString',
        coordinates: [[lng - 0.05, lat], [lng, lat], [lng, lat + 0.05]]}} as any), z, tx, ty);
    const vertices = (layout: Record<string, unknown>) =>
        tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', layout})!], false).layers.l)!.v.length / LINE_VERTEX;
    const mitred = vertices({});
    assert.ok(vertices({'line-miter-limit': 1.2}) > mitred, 'a miter limit under 1.41 bevels the corner');
    assert.equal(vertices({'line-miter-limit': 1.5}), mitred);
    assert.equal(vertices({'line-join': 'round', 'line-round-limit': 1.5}), mitred, 'a round limit over 1.41 keeps the corner sharp');
    assert.ok(vertices({'line-join': 'round', 'line-round-limit': 1.2}) > vertices({'line-miter-limit': 1.2}), 'a round limit under 1.41 rounds it');
});
