// The report of the benchmark page on the tiles of this library (#360), made from the `tile` events of the engine.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the demo, without types)
import {TileReport} from '../../demo/tile-report.mjs';

const ev = (r: InstanceType<typeof TileReport>, t: number, kind: string, key: string | string[], error?: string) => r.event({type: 'tile', key, kind, t: 1000 + t, error});

test('tile report: drawn slots are left out, and each undrawn slot has its state, cover and history', () => {
    const r = new TileReport();
    ev(r, 0, 'req', 's|11/0/0'); ev(r, 5, 'ans', 's|11/0/0'); ev(r, 8, 'up', 's|11/0/0');
    ev(r, 10, 'req', 's|14/2/2'); ev(r, 250.4, 'fail', 's|14/2/2', 'HTTP 503');
    ev(r, 12, 'req', 's|14/3/3');
    ev(r, 20, 'req', 's|14/4/4'); ev(r, 30, 'drop', 's|14/4/4');
    ev(r, 300, 'frame', ['s|11/0/0', 's|14/2/2', 's|14/3/3', 's|14/4/4', 't|2/1/1']);
    assert.deepEqual(r.undrawn(), [
        {key: 's|14/2/2', state: 'failed', cover: 'parent 11/0/0', history: ['requested@10', 'failed: HTTP 503@250']},
        {key: 's|14/3/3', state: 'requested', cover: 'parent 11/0/0', history: ['requested@12']},
        {key: 's|14/4/4', state: 'not requested', cover: 'parent 11/0/0', history: ['requested@20', 'cancelled@30']},
        {key: 't|2/1/1', state: 'not requested', cover: 'none', history: []},
    ]);
});

test('tile report: loaded children cover a slot when no parent does, and a tile dropped after it loaded is evicted', () => {
    const r = new TileReport();
    for (const k of ['s|3/2/2', 's|4/6/6', 's|2/1/1']) { ev(r, 0, 'req', k); ev(r, 1, 'up', k); }
    ev(r, 2, 'drop', 's|2/1/1');
    ev(r, 3, 'frame', ['s|2/1/1']);
    const [u] = r.undrawn();
    assert.equal(u.cover, 'children 2');
    assert.equal(u.history.at(-1), 'evicted@2');
});

test('tile report: a tile that came into view during the pan and was drawn late has its steps and fallback', () => {
    const r = new TileReport();
    ev(r, 0, 'frame', ['s|14/0/0']);
    r.mark();
    ev(r, 100, 'req', 's|14/1/1');
    // (The first frame after the mark starts the pan: 14/1/1 comes into view with nothing to stand in for it.)
    ev(r, 200, 'frame', ['s|14/0/0', 's|14/1/1']);
    ev(r, 700, 'ans', 's|14/1/1'); ev(r, 900, 'up', 's|14/1/1');
    ev(r, 920, 'frame', ['s|14/0/0', 's|14/1/1']);
    assert.deepEqual(r.late(), [{key: 's|14/1/1', ms: 720, answer: 600, upload: 200, draw: 20, ahead: 100, bare: true, drawn: true}]);
});

test('tile report: the history of a tile is bounded', () => {
    const r = new TileReport();
    for (let i = 0; i < 30; i++) ev(r, i, i % 2 ? 'ans' : 'req', 'k|1/0/0');
    assert.equal(r.tiles.get('k|1/0/0').history.length, 12);
});
