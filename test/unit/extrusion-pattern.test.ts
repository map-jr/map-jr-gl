// fill-extrusion-pattern draws an image on the walls and the roof, as in MapLibre GL JS (#1008). On the walls the image
// runs along the ring, so each wall vertex carries its distance along the ring.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

test('fill-extrusion-pattern: the walls carry the distance along the ring', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon',
        coordinates: [[[lng, lat], [lng + 0.01, lat], [lng + 0.01, lat + 0.01], [lng, lat + 0.01], [lng, lat]]]}}]} as any), z, tx, ty);
    const build = (paint: Record<string, unknown>) => tessellate(buildTile(data, z, [compileLayer({id: 'b', type: 'fill-extrusion', source: 'g', paint})!], false).layers.b) as any;
    assert.equal(build({'fill-extrusion-height': 10}).ed, undefined, 'without a pattern the walls carry no distances');
    const g = build({'fill-extrusion-height': 10, 'fill-extrusion-pattern': 'brick'});
    assert.ok(g.ed instanceof Float32Array, 'with a pattern the walls carry distances');
    assert.equal(g.ed.length, g.v.length / 4);
    // The roof has 0 at its corners. Each wall is a quad from its first corner at d + length to its second at d.
    const ed = Array.from(g.ed as Float32Array), roof = ed.length - 16, spans: number[][] = [];
    assert.ok(roof > 0 && ed.slice(0, roof).every(v => v === 0));
    for (let w = 0; w < 4; w++) {
        const [a, b, c, e] = ed.slice(roof + w * 4, roof + w * 4 + 4), q = (roof + w * 4) * 4, x = g.v;
        assert.ok(b === c && a === e);
        spans.push([b, a, Math.hypot(x[q] - x[q + 4], x[q + 1] - x[q + 5])]);
    }
    // The walls follow each other along the ring from 0, and each spans its own length.
    spans.sort((p, q) => p[0] - q[0]);
    for (let w = 0; w < 4; w++) {
        assert.equal(spans[w][0], w ? spans[w - 1][1] : 0);
        assert.ok(Math.abs(spans[w][1] - spans[w][0] - spans[w][2]) < 1e-3);
    }
});
