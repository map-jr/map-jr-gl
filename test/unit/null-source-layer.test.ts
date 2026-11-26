// A source or a layer that is null is left out with a message, and the rest of the style is used (#653).
// Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveStyle} from '../../src/resolve.ts';

test('null source and null layer: each is reported and left out', async () => {
    const errors: string[] = [];
    const style = {version: 8, sources: {a: null, b: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
        layers: [{id: 'bg', type: 'background'}, null, {id: 'f', type: 'fill', source: 'b'}]};
    const r = await resolveStyle(style, undefined, undefined, undefined, e => errors.push((e as Error).message));
    assert.deepEqual(r.layers.map(l => l.id), ['bg', 'f']);
    assert.ok(r.sources.b);
    assert.equal(r.sources.a, undefined);
    assert.deepEqual(errors, [
        '[map-jr-gl] E1613 The source "a" is not an object. Give it an object with "type", or remove it from "sources".',
        '[map-jr-gl] E11613 The layer at index 1 of "layers" is not an object. Give it an object with "id" and "type", or remove it.',
    ]);
});
