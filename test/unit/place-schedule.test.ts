// When the engine places the labels again (#122): a placement that takes long must not run in every frame.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeDue, fadeStep} from '../../src/engine.ts';

test('placement schedule: while the camera moves, a slow placement is not repeated in every frame', () => {
    // The last placement took 400 ms. Frames come 16 ms apart, so the frame after it comes 416 ms after its start.
    assert.equal(placeDue(416, 0, 400, false, true), false);
    assert.equal(placeDue(1100, 0, 400, false, true), false);
    assert.equal(placeDue(1200, 0, 400, false, true), true);
    // (The same while the zoom changes quickly.)
    assert.equal(placeDue(416, 0, 400, true, true), false);
});

test('placement schedule: a fast placement keeps the usual intervals', () => {
    assert.equal(placeDue(249, 0, 5, false, true), false);
    assert.equal(placeDue(250, 0, 5, false, true), true);
    assert.equal(placeDue(100, 0, 5, true, true), true);
});

test('placement schedule: when the camera has stopped, the labels are placed after the usual interval', () => {
    assert.equal(placeDue(250, 0, 400, false, false), true);
    assert.equal(placeDue(200, 0, 400, false, false), false);
});

test('placement schedule: at rest, the labels of a tile that arrived are placed in the next frame (#371)', () => {
    // The last placement was 16 ms ago and took 5 ms: a map at rest places again now instead of after 250 ms.
    assert.equal(placeDue(16, 0, 5, false, false, true), true);
    // (A slow placement still waits its cost.)
    assert.equal(placeDue(16, 0, 400, false, false, true), false);
    // A moving map keeps the interval.
    assert.equal(placeDue(16, 0, 5, false, true, false), false);
});

test('label fade: before the first idle a label shows and hides at once; after it, it fades (#371)', () => {
    // A label pushed out by the labels of a later tile hides in this frame, so that it does not hold idle back.
    assert.equal(fadeStep(1, 0, 16, 300, true), 0);
    assert.equal(fadeStep(0, 1, 16, 300, true), 1);
    // After the first idle, the fade stays: 16 ms of a 320 ms fade.
    assert.equal(fadeStep(1, 0, 16, 320, false), 0.95);
    assert.equal(fadeStep(0, 1, 16, 320, false), 0.05);
});
