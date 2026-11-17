// The layer type `color-relief` (#568): the stops of `color-relief-color` and the colour at each. Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {resolveStyle} from '../../src/resolve.ts';

const layer = (paint: object) => compileLayer({id: 'cr', type: 'color-relief', source: 'dem', paint} as any);

test('color-relief: an interpolate expression gives the elevations of its stops and a premultiplied colour for each', () => {
    const L = layer({'color-relief-opacity': 0.5, 'color-relief-color': ['interpolate', ['linear'], ['elevation'], -100, '#f00', 0, 'rgba(0, 255, 0, 0.5)', 2500.5, '#00f']});
    assert.ok(L, 'the layer type is known');
    assert.deepEqual([...L.relief!], [-100, 0, 2500.5]);
    assert.deepEqual([...L.ramp!], [255, 0, 0, 255, 0, 127, 0, 127, 0, 0, 255, 255]);
    assert.equal(L.p.opacity.eval(0), 0.5);
});

test('color-relief: one stop gives one colour at every elevation', () => {
    const L = layer({'color-relief-color': ['interpolate', ['linear'], ['elevation'], 300, '#f00']})!;
    assert.deepEqual([...L.relief!], [300, 301]);
    assert.deepEqual([...L.ramp!], [255, 0, 0, 255, 255, 0, 0, 255]);
});

test('color-relief: without an interpolate expression the layer is transparent', () => {
    for (const color of [undefined, '#f00', ['step', ['elevation'], '#f00', 100, '#00f'], ['interpolate', ['linear'], ['elevation']]]) {
        const L = layer({'color-relief-color': color})!;
        assert.deepEqual([...L.relief!], [0, 1]);
        assert.deepEqual([...L.ramp!], [0, 0, 0, 0, 0, 0, 0, 0]);
    }
});

test('color-relief: a style with the layer has no unsupported layer type', async () => {
    const style = await resolveStyle({version: 8, sources: {dem: {type: 'raster-dem', tiles: ['https://example.com/{z}/{x}/{y}.png']}}, layers: [{id: 'cr', type: 'color-relief', source: 'dem'}]});
    assert.equal(style.layers.length, 1);
    assert.deepEqual(style.unsupported, []);
});
