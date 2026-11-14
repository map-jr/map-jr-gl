// Labels that come back from a tile worker are plain objects, because engines read an object whose prototype was set
// afterwards much slower (#332).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packLabels, unpackLabels, type LabelSrc} from '../../src/tile.ts';

test('unpackLabels returns plain objects that keep the shared values', () => {
    const base = {text: 'Main St', size0: 12, len: 0, color: [0, 0, 0, 1]};
    const a = Object.assign(Object.create(base), {x: 1, y: 2, angle: null, len: 5}) as LabelSrc;
    const b = Object.assign(Object.create(base), {x: 3, y: 4, angle: 0.5, len: 7}) as LabelSrc;
    const plain = {x: 9, y: 9, text: 'Alone'} as unknown as LabelSrc;
    const out = unpackLabels(structuredClone(packLabels({road: [a, b, plain]})))['road'];
    for (const l of out) assert.equal(Object.getPrototypeOf(l), Object.prototype);
    assert.deepEqual({...out[0]}, {text: 'Main St', size0: 12, len: 5, color: [0, 0, 0, 1], x: 1, y: 2, angle: null});
    assert.equal(out[1].text, 'Main St');
    assert.equal(out[1].len, 7);
    assert.equal(out[2].text, 'Alone');
});
