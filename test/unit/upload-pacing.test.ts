// Unit test for #436: before the first idle and while the camera is still, a frame does up to 24 ms of the waiting GPU
// uploads; while the camera moves, about 4 ms. A frame always does at least one.
// The test replaces performance.now with a clock that only the uploads advance, so the counts are exact and do not
// depend on how busy the machine is (#919).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';

let clock = 0;
test.beforeEach(t => { clock = 0; t.mock.method(performance, 'now', () => clock); });

const engine = () => Object.assign(Object.create(Engine.prototype), {uploads: [], repaints: 0, repaint() { this.repaints++; }});
const queue = (e: {uploads: unknown[]}, n: number, ms: number) => {
    let made = 0;
    for (let i = 0; i < n; i++) e.uploads.push({bytes: 2e6, make: () => { made++; clock += ms; return {labels: {}, batches: {}}; }, done() {}});
    return () => made;
};

test('upload pacing: an unpaced frame uploads many dense tiles', () => {
    const e = engine(), made = queue(e, 12, 0);
    e.flushUploads(false);
    assert.equal(made(), 12, `${made()} of 12 dense tiles were uploaded in the frame`);
});

test('upload pacing: a paced frame stops after 4 ms and asks for the next frame', () => {
    // Uploads of 3 ms start at 0 and 3 ms; the third would start at 6 ms, after the budget.
    const e = engine(), made = queue(e, 12, 3);
    e.flushUploads(true);
    assert.equal(made(), 2, `${made()} uploads of 3 ms in a paced frame`);
    assert.ok(e.repaints > 0);
});

test('upload pacing: an unpaced frame stops after 24 ms', () => {
    // Uploads of 5 ms start at 0, 5, 10, 15 and 20 ms; the sixth would start at 25 ms, after the budget.
    const e = engine(), made = queue(e, 12, 5);
    e.flushUploads(false);
    assert.equal(made(), 5, `${made()} uploads of 5 ms in an unpaced frame`);
    assert.ok(e.repaints > 0);
});

test('upload pacing: a frame uploads at least one tile, however long it takes', () => {
    const e = engine(), made = queue(e, 3, 100);
    e.flushUploads(true);
    assert.equal(made(), 1);
    assert.ok(e.repaints > 0);
});
