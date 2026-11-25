// A polygon ring without a closing point keeps all its points, as in MapLibre GL JS (#1827). Before, the last point was
// dropped as if it closed the ring, and a square became a triangle.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareGeoJSON} from '../../src/geojson.ts';

const points = (ring: number[][]) => prepareGeoJSON({type: 'Polygon', coordinates: [ring]})[0].rings[0].length / 2;

test('GeoJSON polygon: a ring without a closing point keeps its last point', () => {
    assert.equal(points([[-10, 0], [-10, 10], [10, 10], [10, 0]]), 4);
    assert.equal(points([[-10, 0], [-10, 10], [10, 10], [10, 0], [-10, 0]]), 4, 'a closing point is dropped');
    assert.equal(prepareGeoJSON({type: 'MultiPolygon', coordinates: [[[[0, 0], [0, 1], [1, 1], [1, 0]]]]})[0].rings[0].length / 2, 4);
});
