// Two GeoJSON features with the same id are two query results, as in MapLibre GL JS 6.17.0 (#659), while a feature
// that several tiles hold is still one result (#606, #613, #755).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {queryGeoJSON} from '../../src/sync-query.ts';

const point = (id: number | string | undefined, lng: number, name: string) => ({type: 'Feature', ...(id === undefined ? {} : {id}), properties: {name}, geometry: {type: 'Point', coordinates: [lng, 0]}});

test('a query gives two GeoJSON features with the same id as two results, and a feature on a tile edge once', () => {
    const tr = new Transform();
    tr.width = 800; tr.height = 600; tr.set([0, 0], 3, 0, 0);
    const data = {type: 'FeatureCollection', features: [point(12, -10, 'a'), point(12, 10, 'b'), point('12', 20, 'c'), point(7, 0, 'edge'), point(undefined, 0, 'edge, no id')]};
    const found = queryGeoJSON('s', {data}, tr, [0, 0, 800, 600], [{layer: 'l', radius: 0}]);
    assert.deepEqual(found.map(f => f.properties.name).sort(), ['a', 'b', 'c', 'edge', 'edge, no id']);
    assert.ok(found.every(f => !('index' in f)));
});
