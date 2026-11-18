// Unit test for #436: before the first idle and while the camera is still, a frame does up to 24 ms of the waiting GPU
// uploads; while the camera moves, about 4 ms. A frame always does at least one.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';

const engine = () => Object.assign(Object.create(Engine.prototype), {uploads: [], repaints: 0, repaint() { this.repaints++; }});
const queue = (e: {uploads: unknown[]}, n: number, ms: number) => {
    let made = 0;
    for (let i = 0; i < n; i++) e.uploads.push({bytes: 2e6, make: () => { made++; for (const t = performance.now(); performance.now() - t < ms;); return {labels: {}, batches: {}}; }, done() {}});
    return () => made;
};

test('upload pacing: an unpaced frame uploads many dense tiles', () => {
    const e = engine(), made = queue(e, 12, 0);
    e.flushUploads(false);
    assert.equal(made(), 12, `${made()} of 12 dense tiles were uploaded in the frame`);
});

test('upload pacing: a paced frame stops after about 4 ms and asks for the next frame', () => {
    const e = engine(), made = queue(e, 12, 3);
    e.flushUploads(true);
    assert.ok(made() >= 1 && made() <= 2, `${made()} uploads of 3 ms in a paced frame`);
    assert.ok(e.repaints > 0);
});

test('upload pacing: an unpaced frame stops after about 24 ms', () => {
    const e = engine(), made = queue(e, 12, 5);
    e.flushUploads(false);
    assert.ok(made() >= 4 && made() <= 6, `${made()} uploads of 5 ms in an unpaced frame`);
    assert.ok(e.repaints > 0);
});
