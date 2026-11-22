// Unit test for #1468: an elevation tile whose heights have arrived is not dropped as a tile on its way. Its heights
// place the camera at rest, and the camera then decides which tiles the view wants: dropped, the tile took its heights
// away again, and the camera went back and forth between two places, so the map never became idle.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';

test('an elevation tile with heights counts as built while its upload is on its way', async () => {
    const grounded: string[] = [];
    let answer!: (dem: unknown) => void;
    const backend = {loadElevation: () => new Promise(r => { answer = r; }), cancel() {}};
    const e = Object.assign(Object.create(Engine.prototype), {
        renderer: {createImageTile: () => ({labels: {}, batches: {}}), destroyTile() {}}, backends: [backend], tiles: new Map(), uploads: [],
        nextBackend: 0, nextReq: 0, tilesVersion: 0, freshTiles: new Map(), frameNo: 1, frameTime: 0, zoomMovedAt: -1e9, sourceSigs: new Map(),
        zoomBuilt: new Set(), tap: false,
        style: {sources: {dem: {type: 'raster-dem', tiles: ['https://tiles.test/{z}/{x}/{y}.png'], maxzoom: 14}}, terrain: {source: 'dem'}},
        repaint() {}, invalidate() {}, emit() {}, ground: (key: string) => grounded.push(key),
    });
    const key = 'dem|10/189/402';
    e.request('dem', {z: 10, x: 189, y: 402, w: 0, key}, key);
    answer({grid: new Float32Array(4), lo: 0, hi: 1, width: 1, height: 1, pixels: new Uint8Array(4)});
    await new Promise(r => setTimeout(r, 0));
    e.flushUploads(); // the heights arrive in this frame; the tile stays on its way until a later task
    const t = e.tiles.get(key);
    assert.deepEqual(grounded, [key]);
    assert.equal(t.state, 'loading');
    // (The frame drops a tile that is on its way, not built and not wanted.)
    assert.equal(t.built, true);
});
