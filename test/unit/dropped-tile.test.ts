// Unit test for #400: a tile that is dropped while its answer waits for the GPU upload leaves no GPU tile behind.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';

test('dropped tile: a tile dropped before or after its upload leaves no live GPU tile', async () => {
    let live = 0;
    const renderer = {
        createTile: () => (live++, {labels: {}, batches: {}, real: true}),
        createImageTile: () => (live++, {labels: {}, batches: {}, real: true}),
        destroyTile: (t: {real?: boolean}) => { if (t.real) live--; },
    };
    const answers: ((tile: unknown) => void)[] = [];
    const backend = {load: () => new Promise(r => answers.push(r)), cancel() {}};
    const e = Object.assign(Object.create(Engine.prototype), {
        renderer, backends: [backend], tiles: new Map(), uploads: [], nextBackend: 0, nextReq: 0, tilesVersion: 0,
        frameNo: 1, frameTime: 0, zoomMovedAt: -1e9, sourceSigs: new Map(), zoomBuilt: new Set(), tap: false,
        style: {sources: {s: {type: 'vector', tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], maxzoom: 14}}},
        repaint() {}, invalidate() {}, emit() {}, ground() {},
    });
    const tile = {layers: {}, labels: {}};
    const tick = () => new Promise(r => setTimeout(r, 0));
    for (let i = 0; i < 20; i++) {
        const key = `s|10/${i}/0`;
        e.request('s', {z: 10, x: i, y: 0, w: 0, key}, key);
        answers.shift()!(tile);
        await tick(); // the answer is now waiting for its upload
        if (i % 2) e.dropTile(key, e.tiles.get(key)); // dropped before its upload
        e.flushUploads();
        await tick();
        if (!(i % 2)) e.dropTile(key, e.tiles.get(key)); // dropped after its upload
    }
    assert.equal(e.tiles.size, 0);
    assert.equal(live, 0, `${live} GPU tiles of dropped tiles are still alive`);
});
