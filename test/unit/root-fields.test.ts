// The fields `sources`, `layers` and `terrain` of the description add to the style at the root, with no `extend` (#497).
import {test} from 'node:test';
import assert from 'node:assert/strict';
(globalThis as any).__DEV__ = true;
const {extended} = await import('../../src/markers.ts');
const {renderToSVG} = await import('../../src/server.ts');

const style = {version: 8, sources: {a: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'bg', type: 'background'}, {id: 'top', type: 'background'}], terrain: {source: 'a'}};

test('layers are added, sources are merged by key, and a terrain of null keeps that of the style', () => {
    const s = extended(style, {sources: {b: {type: 'geojson', data: 'x'}}, layers: [{id: 'mid', type: 'background', before: 'top'}, {id: 'last', type: 'background'}], terrain: null});
    assert.deepEqual(s.layers.map((l: {id: string}) => l.id), ['bg', 'mid', 'top', 'last']);
    assert.deepEqual(Object.keys(s.sources), ['a', 'b']);
    assert.deepEqual(s.terrain, {source: 'a'});
    assert.deepEqual(extended(style, {terrain: {source: 'b'}}).terrain, {source: 'b'});
});

test('the server renders the root fields sources and layers', async () => {
    const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]]}};
    const {svg} = await renderToSVG({style: {version: 8, sources: {}, layers: []}, center: [0, 0], zoom: 2, width: 100, height: 100, attribution: false,
        sources: {own: {type: 'geojson', data: square}}, layers: [{id: 'own', type: 'fill', source: 'own', paint: {'fill-color': '#123456'}}]} as any);
    assert.ok(svg.includes('#123456'), svg.slice(0, 300));
});
