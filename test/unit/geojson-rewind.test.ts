// The rings of a GeoJSON polygon are wound so that the first ring of each polygon is an outer ring and the others are
// holes, whatever their winding in the input, as MapLibre GL JS does (#1821). Before, a part of a MultiPolygon with
// reversed winding was read as a hole of the part before it.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareGeoJSON} from '../../src/geojson.ts';

// The direction of each ring, relative to the first ring of the feature: 1 for an outer ring, -1 for a hole.
const roles = (rings: Float64Array[]) => {
    const sign = (r: Float64Array) => {
        let a = 0;
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += (r[i] - r[j]) * (r[i + 1] + r[j + 1]);
        return Math.sign(a);
    };
    return rings.map(r => sign(r) * sign(rings[0]));
};
const ccw = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], cw = [...ccw].reverse();
const hole = [[0.2, 0.2], [0.2, 0.8], [0.8, 0.8], [0.8, 0.2], [0.2, 0.2]];
const far = (r: number[][]) => r.map(([x, y]) => [x + 5, y]);

test('GeoJSON MultiPolygon: parts with mixed winding are each an outer ring', () => {
    const {rings} = prepareGeoJSON({type: 'MultiPolygon', coordinates: [[ccw, hole], [far(cw)], [far(far(ccw))]]})[0];
    assert.deepEqual(roles(rings), [1, -1, 1, 1]);
});

test('GeoJSON Polygon: a hole wound as the outer ring is still a hole, and the outer ring is kept as it is', () => {
    const {rings} = prepareGeoJSON({type: 'Polygon', coordinates: [cw, hole]})[0];
    assert.deepEqual(roles(rings), [1, -1]);
    assert.deepEqual([...rings[0]], [...prepareGeoJSON({type: 'Polygon', coordinates: [cw]})[0].rings[0]]);
    // A reversed ring keeps its first point first.
    assert.deepEqual([...rings[1].slice(0, 2)], [...prepareGeoJSON({type: 'Polygon', coordinates: [hole]})[0].rings[0].slice(0, 2)]);
});
