// `points()` makes a GeoJSON FeatureCollection from records, with ids from the records and not from the index (#488).
import {test} from 'node:test';
import assert from 'node:assert/strict';
(globalThis as any).__DEV__ = true;
const {points} = await import('../../src/points.ts');

const records = [{id: 'a', lng: 1, lat: 2}, {id: 'b', lng: NaN, lat: 2}, {id: 'c', lng: 3, lat: 4}, {id: 'd', lng: '5', lat: 6}];

test('a feature has the id of its record, and the record as its properties', () => {
    const c = points(records, {lngLat: r => [r.lng as number, r.lat], id: r => r.id});
    assert.equal(c.type, 'FeatureCollection');
    assert.deepEqual(c.features, [
        {type: 'Feature', id: 'a', properties: records[0], geometry: {type: 'Point', coordinates: [1, 2]}},
        {type: 'Feature', id: 'c', properties: records[2], geometry: {type: 'Point', coordinates: [3, 4]}},
    ]);
});

test('without "id" a feature has no id, and "properties" replaces the record', () => {
    const c = points([{lng: 1, lat: 2, n: 7}], {lngLat: r => [r.lng, r.lat], properties: r => ({n: r.n})});
    assert.equal('id' in c.features[0], false);
    assert.deepEqual(c.features[0].properties, {n: 7});
});

test('a record without a position of two finite numbers is left out, and one warning names the first index', async () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        assert.equal(points(records, {lngLat: r => [r.lng as number, r.lat]}).features.length, 2);
        assert.equal(points([null, {}], {lngLat: (r: any) => r?.p}).features.length, 0);
        await new Promise(r => setTimeout(r, 50));
        assert.deepEqual(warnings, ['[map-jr-gl] E21 points(): the record 1 has no position of two finite numbers, so it is left out. Make "lngLat" return [lng, lat] for each record.']);
    } finally { console.warn = warn; }
});
