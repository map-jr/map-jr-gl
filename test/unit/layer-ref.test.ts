// A layer with the legacy property `ref` takes type, source, source-layer, minzoom, maxzoom, filter and layout from
// the layer that it names, as in MapLibre GL JS (`derefLayers`, #1814).
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {derefLayers, resolveStyle} from '../../src/resolve.ts';

const sources = {s: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}};

test('a layer with ref copies the keys of the layer that it names and keeps its own paint', async () => {
    const errors: string[] = [];
    const a = {id: 'a', type: 'line', source: 's', minzoom: 2, maxzoom: 9, filter: ['==', 'k', 1], layout: {'line-cap': 'round'}, paint: {'line-color': 'red'}};
    const style = {version: 8, sources, layers: [a, {id: 'b', ref: 'a', type: 'fill', layout: {'line-cap': 'butt'}, paint: {'line-width': 4}}]};
    const r = await resolveStyle(style, undefined, undefined, undefined, e => errors.push((e as Error).message));
    assert.deepEqual(r.layers.map(l => l.id), ['a', 'b']);
    assert.deepEqual(r.layers[1], {id: 'b', type: 'line', source: 's', minzoom: 2, maxzoom: 9, filter: ['==', 'k', 1], layout: {'line-cap': 'round'}, paint: {'line-width': 4}});
    assert.deepEqual(errors, []);
});

test('derefLayers gives the layer its own layout and does not change its input', () => {
    const a = {id: 'a', type: 'symbol', source: 's', layout: {'icon-offset': [0, 0]}}, b = {id: 'b', ref: 'a'};
    const [, out] = derefLayers([a, b]);
    out.layout['icon-offset'] = [0, 10];
    assert.deepEqual(a.layout, {'icon-offset': [0, 0]});
    assert.deepEqual(b, {id: 'b', ref: 'a'});
    assert.deepEqual(derefLayers([b]), [b]);
});

test('a ref to a layer that does not exist leaves the layer out with one message for each map', async () => {
    const errors: string[] = [];
    const style = {version: 8, sources, layers: [{id: 'a', type: 'line', source: 's'}, {id: 'b', ref: 'nope'}]};
    const fail = (e: unknown) => errors.push((e as Error).message);
    const r = await resolveStyle(style, undefined, undefined, undefined, fail);
    assert.deepEqual(r.layers.map(l => l.id), ['a']);
    // (A map resolves its style again after each change: the message comes one time.)
    await resolveStyle(style, undefined, undefined, undefined, fail);
    assert.deepEqual(errors, ['[map-jr-gl] E2033 The layer "b": "ref" names "nope", which is no layer without "ref". Name such a layer, or give "type" and "source".']);
});

test('a ref to a layer that has ref itself (a chain or a cycle) leaves the layer out with a message, as MapLibre GL JS rejects it', async () => {
    const errors: string[] = [];
    const layers = [{id: 'a', type: 'line', source: 's'}, {id: 'b', ref: 'a'}, {id: 'c', ref: 'b'}, {id: 'd', ref: 'e'}, {id: 'e', ref: 'd'}, {id: 'f', ref: 'f'}];
    const r = await resolveStyle({version: 8, sources, layers}, undefined, undefined, undefined, e => errors.push((e as Error).message));
    assert.deepEqual(r.layers.map(l => l.id), ['a', 'b']);
    assert.deepEqual(r.unsupported, []);
    assert.deepEqual(errors.map(e => e.match(/layer "(\w)"/)![1]), ['c', 'd', 'e', 'f']);
});
