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

test('icon-padding and text-padding are added before the box is turned, as in MapLibre GL JS (#1734)', () => {
    const near = (a: number[], b: number[]) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} is not ${b}`));
    // (The boxes of MapLibre GL JS 6.17 for an icon of 20 by 10 pixels.)
    near(boxAround(0, 0, 20, 10, Math.PI / 2, [1, 2, 3, 4]), [-8, -14, 6, 12]);
    const box = boxAround(0, 0, 20, 10, Math.PI / 4, 3);
    near(box, [-box[2], -box[3], box[2], box[3]]);
    assert.ok(Math.abs(box[2] - 42 * Math.SQRT1_2 / 2) < 1e-9 && Math.abs(box[2] - 14.85) < 0.01);
});

test('a symbol aligned with the map is boxed at its rotation, then the box is turned by the bearing, as in MapLibre GL JS (#2037)', () => {
    // (MapLibre GL JS 6.17: 20 by 10 pixels, padding 2, rotation 45 degrees, bearing 45 degrees: 38 by 38.)
    const box = boxAround(0, 0, 20, 10, Math.PI / 2, 2, Math.PI / 4);
    assert.ok(Math.abs(box[2] - box[0] - 38) < 1e-9 && Math.abs(box[3] - box[1] - 38) < 1e-9, `${box}`);
});
