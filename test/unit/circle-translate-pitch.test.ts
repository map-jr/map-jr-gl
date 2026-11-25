// A circle with `circle-translate` is found where it is drawn on a tilted map too (#1910), as in MapLibre GL JS 6.17.0.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {queryGeoJSON} from '../../src/sync-query.ts';

test('a query of a tilted map finds a translated circle where it is drawn, and not at its feature', () => {
    const tr = new Transform();
    tr.width = 800; tr.height = 600; tr.set([0, 0], 3, 0, 40);
    const data = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]};
    const [x, y] = tr.project(0, 0);
    const set = {layer: 'l', radius: 5, pitch: [false, true] as [boolean, boolean], translate: [100, 0] as [number, number]};
    assert.equal(queryGeoJSON('s', {data}, tr, [x + 98, y - 2, x + 102, y + 2], [set]).length, 1);
    assert.equal(queryGeoJSON('s', {data}, tr, [x - 2, y - 2, x + 2, y + 2], [set]).length, 0);
});
