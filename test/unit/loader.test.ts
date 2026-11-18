// The shared pool of tile workers (src/loader.ts). Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
(globalThis as any).__VERSION__ = 'test';
(globalThis as any).__WORKER_SRC__ = '';
const {acquireTileWorkers} = await import('../../src/loader.ts');

/** A worker that says hello at once and records whether it was terminated. */
function fakeWorker(all: {terminated: boolean}[]) {
    const t = new EventTarget() as any, rec = {terminated: false};
    all.push(rec);
    t.postMessage = () => {};
    t.terminate = () => { rec.terminated = true; };
    queueMicrotask(() => t.dispatchEvent(Object.assign(new Event('message'), {data: {type: 'hello', version: 'test'}})));
    return t as Worker;
}

test('the workers of a replaced pool end when its last map releases them', async () => {
    const a: {terminated: boolean}[] = [], b: {terminated: boolean}[] = [];
    const first = await acquireTileWorkers({createWorker: () => fakeWorker(a), tileWorkers: 2});
    const second = await acquireTileWorkers({createWorker: () => fakeWorker(b), tileWorkers: 2});
    first.release();
    assert.deepEqual(a.map(w => w.terminated), [true, true]);
    assert.deepEqual(b.map(w => w.terminated), [false, false]);
    second.release();
    assert.deepEqual(b.map(w => w.terminated), [true, true]);
});

test('a map that connects again closes its old tile ports and leaves the other map\'s open (#838)', async () => {
    // The fake tile worker keeps its open ports by id, as src/worker.ts does.
    const open: Set<number>[] = [];
    const tileWorker = () => {
        const w = fakeWorker([]) as any, mine = new Set<number>();
        open.push(mine);
        w.postMessage = (m: any) => { if (m.role === 'tiles') { mine.add(m.id); m.port.close(); } else if (m.role === 'drop') mine.delete(m.id); };
        return w as Worker;
    };
    const o = {createWorker: tileWorker, tileWorkers: 2};
    const a = await acquireTileWorkers(o), b = await acquireTileWorkers(o);
    for (const p of [...a.connect(), ...b.connect()]) p.close();
    const sizes = () => open.map(s => s.size);
    assert.deepEqual(sizes(), [2, 2]);
    for (const p of a.connect()) p.close(); // a fallback to the main thread (#812)
    assert.deepEqual(sizes(), [2, 2]);
    a.release();
    assert.deepEqual(sizes(), [1, 1]);
    b.release();
    assert.deepEqual(sizes(), [0, 0]);
});
