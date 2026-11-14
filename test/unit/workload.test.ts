// Each tile goes to the tile worker with the fewest jobs in progress, not to the next one in turn (#324).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Workload} from '../../src/tiles.ts';

/** A job that ends when the test says so. */
function job() {
    let resolve!: () => void, reject!: (e: Error) => void;
    const promise = new Promise<void>((y, n) => { resolve = y; reject = n; });
    return {promise, resolve, reject};
}
const settle = () => new Promise(r => setTimeout(r, 0));

test('a new job goes to the worker that is free, not to the next in turn', async () => {
    const w = new Workload(2), slow = job(), quick = job();
    w.track(w.pick(), slow.promise); // worker 0: a dense tile
    assert.equal(w.pick(), 1);
    w.track(1, quick.promise);
    quick.resolve();
    await settle();
    // Round robin would give the third job to worker 0, which still builds the dense tile.
    assert.equal(w.pick(), 1);
    slow.resolve();
});

test('a job that fails or is cancelled no longer counts', async () => {
    const w = new Workload(2), a = job(), b = job();
    w.track(0, a.promise);
    w.track(0, b.promise).catch(() => {});
    w.track(1, job().promise);
    assert.equal(w.pick(), 1);
    a.resolve();
    b.reject(new Error('aborted'));
    await settle();
    assert.equal(w.pick(), 0);
});
