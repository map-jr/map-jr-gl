import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileProp} from '../../src/expr.ts';

const f = (props: Record<string, unknown>) => ({properties: props}) as any;

test('properties of kind raw evaluate zoom and feature expressions, and a list of values stays a list (#1004)', () => {
    assert.deepEqual(compileProp(['Open Sans Bold'], 'raw', null).eval(5), ['Open Sans Bold']);
    assert.deepEqual(compileProp(['literal', ['Noto Sans Regular']], 'raw', null).eval(5), ['Noto Sans Regular']);
    const font = compileProp(['step', ['zoom'], ['literal', ['A']], 10, ['literal', ['B']]], 'raw', null);
    assert.deepEqual([font.eval(5), font.eval(12)], [['A'], ['B']]);
    const byFeature = compileProp(['match', ['get', 'k'], 'x', ['literal', ['top', 'left']], ['literal', ['bottom']]], 'raw', null);
    assert.equal(byFeature.dd, true);
    assert.deepEqual(byFeature.eval(0, f({k: 'x'})), ['top', 'left']);
    assert.deepEqual(compileProp(['top', [0, 1], 'bottom', [0, -1]], 'raw', null).eval(3), ['top', [0, 1], 'bottom', [0, -1]]);
    const overlap = compileProp(['step', ['zoom'], false, 8, true], 'raw', false);
    assert.deepEqual([overlap.eval(4), overlap.eval(9)], [false, true]);
    const legacy = compileProp({stops: [[0, false], [8, true]]}, 'raw', false);
    assert.deepEqual([legacy.eval(4), legacy.eval(9)], [false, true]);
    assert.deepEqual(compileProp(undefined, 'raw', [0, 0, 0, 0]).eval(1), [0, 0, 0, 0]);
});
