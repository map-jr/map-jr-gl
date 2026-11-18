// The root property `sky` reaches the renderer, with the defaults of the specification and zoom functions (#887).
import {test} from 'node:test';
import assert from 'node:assert/strict';
const {resolveStyle} = await import('../../src/resolve.ts');
const {Map} = await import('../../src/map.ts');
const {skyValues} = await import('../../src/gl.ts');

test('resolveStyle keeps the sky of the style', async () => {
    const sky = {'sky-color': '#ff0000'};
    assert.deepEqual((await resolveStyle({version: 8, sources: {}, layers: [], sky})).sky, sky);
    assert.equal((await resolveStyle({version: 8, sources: {}, layers: []})).sky, undefined);
});

test('the sky values have the defaults of the specification and follow zoom functions and the pitch', () => {
    const v = skyValues({}, 10, 85);
    assert.deepEqual(v.sky.map((c: number) => Math.round(c * 255)), [0x88, 0xc6, 0xfc, 255]);
    assert.deepEqual(v.horizon, [1, 1, 1, 1]);
    assert.deepEqual([v.skyBlend, v.horizonFog, v.ground, v.opacity], [0.8, 0.8, 0.5, 1]);
    assert.equal(skyValues({}, 10, 65).opacity, 0.5);
    assert.equal(skyValues({}, 10, 50).opacity, 0);
    assert.equal(skyValues({'sky-horizon-blend': ['interpolate', ['linear'], ['zoom'], 0, 0, 10, 1]}, 5, 85).skyBlend, 0.5);
});

test('atmosphere-blend has the default of the specification and follows zoom functions (#888)', () => {
    assert.equal(skyValues({}, 3, 0).atmosphere, 0.8);
    assert.equal(skyValues({'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 4, 1, 6, 0]}, 5, 0).atmosphere, 0.5);
});

test('setSky(null) leaves getSky() at null, as in MapLibre GL JS 6.17 (#916)', () => {
    const map: any = {rawStyle: {sky: {'sky-color': '#ff0000'}}, editStyle(fn: (s: any) => void) { fn(this.rawStyle); return this; }};
    Map.prototype.setSky.call(map, null);
    assert.equal(Map.prototype.getSky.call(map), null);
    const none: any = {rawStyle: {}, editStyle: map.editStyle};
    Map.prototype.setSky.call(none, null);
    assert.equal(Map.prototype.getSky.call(none), undefined);
});
