// When the engine places the labels again (#122): a placement that takes long must not run in every frame.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeDue} from '../../src/engine.ts';

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
