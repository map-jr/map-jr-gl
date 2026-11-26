// #2104: a strongly foreshortened image source is blended toward the bilinear stretch, as in MapLibre GL JS (calculateImageWarp).
import {test} from 'node:test';
import assert from 'node:assert/strict';
const {cornerWeights} = await import('../../src/gl.ts');

test('a parallelogram and a mild trapezoid are not blended', () => {
    assert.equal(cornerWeights([0, 0, 10, 0, 10, 10, 0, 10])![4], 0);
    assert.equal(cornerWeights([0, 0, 10, 0, 8, 10, 2, 10])![4], 0);
});

test('a near triangle is blended toward bilinear by the ramp of MapLibre GL JS', () => {
    // The top side is 100 times shorter than the bottom: the foreshortening is 100.
    const q = cornerWeights([49.5, 0, 50.5, 0, 100, 10, 0, 10])!;
    const f = Math.max(...q.slice(0, 4)) / Math.min(...q.slice(0, 4));
    assert.ok(Math.abs(f - 100) < 1e-6, String(f));
    assert.ok(Math.abs(q[4] - (1 - 4 / 100) / (1 - 4 / 512)) < 1e-9, String(q[4]));
});
