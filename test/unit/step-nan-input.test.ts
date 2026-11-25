import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileProp} from '../../src/expr.ts';

const f = (props: Record<string, unknown>) => ({properties: props}) as any;

test('step and interpolate with an input that is not a number give the default of the property, as in MapLibre GL JS (#1811)', () => {
    const nan = ['/', 0, ['get', 'zero']];
    assert.equal(compileProp(['interpolate', ['linear'], nan, 1, 1, 2, 2], 'number', 5).eval(0, f({zero: 0})), 5);
    assert.equal(compileProp(['step', nan, 1, 2, 2], 'number', 5).eval(0, f({zero: 0})), 5);
    assert.deepEqual(compileProp(['step', nan, 'red', 2, 'blue'], 'color', '#000000').eval(0, f({zero: 0})), [0, 0, 0, 1]);
    // A number input still selects a stop.
    assert.equal(compileProp(['step', ['get', 'zero'], 1, 2, 2], 'number', 5).eval(0, f({zero: 0})), 1);
});
