import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {boxAround} from '../../src/placement.ts';

const pad = (v: unknown) => compileLayer({id: 's', type: 'symbol', source: 'x', layout: v === undefined ? {} : {'icon-padding': v}} as any)!.p.iconPadding;

test('icon-padding takes the padding type of one to four values, as in MapLibre GL JS (#1027)', () => {
    assert.deepEqual(pad(undefined).eval(0), [2, 2, 2, 2]);
    assert.deepEqual(pad(5).eval(0), [5, 5, 5, 5]);
    assert.deepEqual(pad([5]).eval(0), [5, 5, 5, 5]);
    assert.deepEqual(pad([1, 2]).eval(0), [1, 2, 1, 2]);
    assert.deepEqual(pad([1, 2, 3]).eval(0), [1, 2, 3, 2]);
    assert.deepEqual(pad([1, 2, 3, 4]).eval(0), [1, 2, 3, 4]);
    assert.deepEqual(pad(['literal', [1, 2, 3, 4]]).eval(0), [1, 2, 3, 4]);
    const byZoom = pad(['interpolate', ['linear'], ['zoom'], 0, ['literal', [0, 0, 0, 0]], 10, ['literal', [10, 20, 30, 40]]]);
    assert.deepEqual(byZoom.eval(5), [5, 10, 15, 20]);
    assert.deepEqual(pad({type: 'identity', property: 'p'}).eval(0, {properties: {p: [3, 4]}} as any), [3, 4, 3, 4]);
    assert.deepEqual(pad('wrong').eval(0), [2, 2, 2, 2]);
    assert.deepEqual(boxAround(100, 100, 20, 10, 0, [1, 2, 3, 4]), [86, 94, 112, 108]);
});
