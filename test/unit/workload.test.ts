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

test('a job pinned to a worker counts on that worker', () => {
    const w = new Workload(3);
    w.track(2, job().promise);
    w.track(0, job().promise);
    assert.equal(w.pick(), 1);
    w.track(1, job().promise);
    w.track(1, job().promise);
    assert.equal(w.pick(), 0);
});

test('two maps on the same workers keep separate counts', () => {
    const one = new Workload(2), two = new Workload(2);
    one.track(one.pick(), job().promise);
    assert.equal(one.pick(), 1);
    assert.equal(two.pick(), 0);
});

test('a job waits while every worker is at its limit, and the worker that is free first takes it', async () => {
    const w = new Workload(2, 1), jobs = [job(), job(), job()], started: number[] = [];
    const runs = jobs.map((j, k) => w.run(i => { started[k] = i; return j.promise; }));
    assert.deepEqual(started, [0, 1]);
    jobs[1].resolve(); // worker 1 ends first, while worker 0 still builds a dense tile
    await settle();
    assert.equal(started[2], 1);
    jobs[0].resolve();
    jobs[2].resolve();
    await Promise.all(runs.map(r => r.job));
});

test('a job that is cancelled while it waits fails as aborted and never starts', async () => {
    const w = new Workload(1, 1), first = job();
    let starts = 0;
    w.run(() => { starts++; return first.promise; });
    const second = w.run(() => { starts++; return job().promise; });
    second.cancel();
    await assert.rejects(second.job, /aborted/);
    first.resolve();
    await settle();
    assert.equal(starts, 1);
});

test('a job with `now` starts at once, on the worker with the fewest jobs', () => {
    const w = new Workload(2, 1), started: number[] = [];
    w.run(() => job().promise);
    w.run(() => job().promise);
    w.run(() => job().promise); // waits
    w.run(i => { started.push(i); return job().promise; }, true);
    assert.deepEqual(started, [0]);
});

test('a job that throws when it starts fails, and the worker is free again', async () => {
    const w = new Workload(1, 1);
    await assert.rejects(w.run(() => { throw new Error('bad'); }).job, /bad/);
    await settle();
    assert.equal(await w.run(() => Promise.resolve(7)).job, 7);
});
