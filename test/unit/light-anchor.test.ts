// `anchor` of the style's `light` takes a zoom expression (#1699).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lightOnMap} from '../../src/gl.ts';

test('light: anchor is viewport by default and follows a constant', () => {
    assert.equal(lightOnMap({}, 5), false);
    assert.equal(lightOnMap({anchor: 'map'}, 5), true);
    assert.equal(lightOnMap({anchor: 'viewport'}, 5), false);
});

test('light: anchor follows a zoom step', () => {
    const light = {anchor: ['step', ['zoom'], 'viewport', 10, 'map']};
    assert.equal(lightOnMap(light, 9), false);
    assert.equal(lightOnMap(light, 11), true);
});
