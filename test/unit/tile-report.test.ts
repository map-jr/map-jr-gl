// The report of the tile slots of the view that are not drawn, for the benchmark page (#360).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lateTiles, logTile, trackView, undrawnTiles} from '../../src/tile-report.ts';

const id = (z: number, x: number, y: number) => ({z, x, y, key: `${z}/${x}/${y}`});

test('tile report: drawn slots are left out, and each undrawn slot has its state, cover and history', () => {
    const log = new Map<string, string[]>();
    logTile(log, 's|14/2/2', 'requested', 10);
    logTile(log, 's|14/2/2', 'failed: HTTP 503', 250.4);
    logTile(log, 's|14/3/3', 'requested', 12);
    const ok = new Set(['s|14/1/1', 's|11/0/0']);
    const states: Record<string, string> = {'s|14/1/1': 'ok', 's|11/0/0': 'ok', 's|14/2/2': 'error', 's|14/3/3': 'loading'};
    const ideal = new Map([['s', [id(14, 1, 1), id(14, 2, 2), id(14, 3, 3)]], ['t', [id(2, 1, 1)]]]);
    const list = undrawnTiles(ideal, k => ok.has(k), k => states[k], log);
    assert.deepEqual(list, [
        {key: 's|14/2/2', state: 'error', cover: 'parent 11/0/0', history: ['requested@10', 'failed: HTTP 503@250']},
        {key: 's|14/3/3', state: 'loading', cover: 'parent 11/0/0', history: ['requested@12']},
        {key: 't|2/1/1', state: 'none', cover: 'none', history: []},
    ]);
});

test('tile report: loaded children cover a slot when no parent does', () => {
    const ok = new Set(['s|3/2/2', 's|4/6/6']);
    const [r] = undrawnTiles(new Map([['s', [id(2, 1, 1)]]]), k => ok.has(k), () => undefined, new Map());
    assert.equal(r.cover, 'children 2');
});

test('tile report: the history is bounded', () => {
    const log = new Map<string, string[]>();
    for (let i = 0; i < 30; i++) logTile(log, 'k', 'e' + i, i);
    assert.equal(log.get('k')!.length, 12);
    assert.equal(log.get('k')!.at(-1), 'e29@29');
});

test('tile report: a tile that came into view during the movement and was drawn late has its steps and fallback', () => {
    const log = new Map<string, string[]>(), times = new Map();
    const ideal = (...ids: ReturnType<typeof id>[]) => new Map([['s', ids]]);
    logTile(log, 's|14/1/1', 'requested', 100, times);
    // Frame at 50 ms: 14/0/0 is in view and drawn. Frame at 200 ms: 14/1/1 comes into view with nothing to stand in for it.
    trackView(times, [], ideal(id(14, 0, 0)), 50);
    trackView(times, [{key: 's|14/1/1', state: 'loading', cover: 'none', history: []}], ideal(id(14, 0, 0), id(14, 1, 1)), 200);
    logTile(log, 's|14/1/1', 'answered', 700, times);
    logTile(log, 's|14/1/1', 'uploaded', 900, times);
    trackView(times, [], ideal(id(14, 0, 0), id(14, 1, 1)), 920);
    assert.deepEqual(lateTiles(times, 0), [{key: 's|14/1/1', ms: 720, answer: 600, upload: 200, draw: 20, ahead: 100, bare: true, drawn: true}]);
    // (A tile that came into view before the mark is left out.)
    assert.deepEqual(lateTiles(times, 300), []);
});
