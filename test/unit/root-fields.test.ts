// The fields `sources`, `layers` and `terrain` of the description add to the style at the root, with no `extend` (#497).
import {test} from 'node:test';
import assert from 'node:assert/strict';
(globalThis as any).__DEV__ = true;
const {extended} = await import('../../src/markers.ts');
const {renderToSVG} = await import('../../src/server.ts');

const style = {version: 8, sources: {a: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'bg', type: 'background'}, {id: 'top', type: 'background'}], terrain: {source: 'a'}};

test('layers are added, sources are merged by key, a terrain of null removes that of the style, and no terrain keeps it (#1104)', () => {
    const s = extended(style, {sources: {b: {type: 'geojson', data: 'x'}}, layers: [{id: 'mid', type: 'background', before: 'top'}, {id: 'last', type: 'background'}], terrain: null});
    assert.deepEqual(s.layers.map((l: {id: string}) => l.id), ['bg', 'mid', 'top', 'last']);
    assert.deepEqual(Object.keys(s.sources), ['a', 'b']);
    assert.equal(s.terrain, undefined);
    assert.deepEqual(extended(style, {layers: []}).terrain, {source: 'a'});
    assert.deepEqual(extended(style, {terrain: undefined}).terrain, {source: 'a'});
    assert.deepEqual(extended(style, {terrain: {source: 'b'}}).terrain, {source: 'b'});
});

test('the server renders the root fields sources and layers', async () => {
    const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-10, -10], [10, -10], [10, 10], [-10, 10], [-10, -10]]]}};
    const {svg} = await renderToSVG({style: {version: 8, sources: {}, layers: []}, center: [0, 0], zoom: 2, width: 100, height: 100, attribution: false,
        sources: {own: {type: 'geojson', data: square}}, layers: [{id: 'own', type: 'fill', source: 'own', paint: {'fill-color': '#123456'}}]} as any);
    assert.ok(svg.includes('#123456'), svg.slice(0, 300));
});

test('a sprite of the description is added to the sprites of the style and replaces one with the same id (#495)', () => {
    const add = [{id: 'pins', url: 'https://x.test/pins'}];
    assert.deepEqual(extended({...style, sprite: 'https://x.test/base'}, {sprite: add}).sprite, [{id: 'default', url: 'https://x.test/base'}, ...add]);
    assert.deepEqual(extended({...style, sprite: [{id: 'pins', url: 'old'}, {id: 'b', url: 'b'}]}, {sprite: add}).sprite, [{id: 'b', url: 'b'}, ...add]);
    assert.deepEqual(extended(style, {sprite: add}).sprite, add);
    assert.equal(extended({...style, sprite: 'https://x.test/base'}, {sprite: []}).sprite, 'https://x.test/base');
});

test('the server draws an icon of a sprite of the description as id:name, from its own sheet (#495)', async () => {
    const sheet = (name: string) => ({[name]: {x: 0, y: 0, width: 10, height: 10, pixelRatio: 1}});
    const fetch = (async (url: string) => {
        if (url.endsWith('base.json')) return Response.json(sheet('dot'));
        if (url.endsWith('pins.json')) return Response.json(sheet('box'));
        return new Response(new Uint8Array([1]), {headers: {'content-type': 'image/png'}});
    }) as unknown as typeof globalThis.fetch;
    const point = (x: number) => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [x, 0]}});
    const layer = (id: string, icon: string) => ({id, type: 'symbol', source: id, layout: {'icon-image': icon, 'icon-allow-overlap': true}});
    const {svg} = await renderToSVG({style: {version: 8, sprite: 'https://x.test/base', sources: {}, layers: []}, center: [0, 0], zoom: 2, width: 200, height: 100, attribution: false, fetch,
        sprite: [{id: 'pins', url: 'https://x.test/pins'}],
        sources: {a: {type: 'geojson', data: point(-20)}, b: {type: 'geojson', data: point(20)}},
        layers: [layer('a', 'dot'), layer('b', 'pins:box')]} as any);
    assert.match(svg, /<image id="sprite" href="https:\/\/x\.test\/base\.png"/);
    assert.match(svg, /<image id="sprite-1" href="https:\/\/x\.test\/pins\.png"/);
    assert.match(svg, /<use href="#sprite-1"\/>/);
});
