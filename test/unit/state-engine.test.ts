// The engine after a change of feature state (`featureState`, `rebuildState` in src/engine.ts): the tiles of the
// source build only the layers that read the state, the tile worker gets the keys that changed since the tile had
// them, and a tile whose layers cannot be built alone is built in full.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';

const hover = ['boolean', ['feature-state', 'hover'], false];
const fill = {id: 'lit', type: 'fill', source: 's', 'source-layer': 'building', paint: {'fill-color': ['case', hover, '#f00', '#888']}};
const label = {id: 'names', type: 'symbol', source: 's', 'source-layer': 'place', layout: {'text-field': 'x'}, paint: {'text-color': ['case', hover, '#f00', '#000']}};
const tick = () => new Promise(r => setTimeout(r, 0));

function engine(layers: unknown[]) {
    const asked: any[] = [], swaps: string[][] = [];
    let answer: (req: any) => Promise<unknown> = async () => ({layers: {}, labels: {}});
    const backend = {load: (req: any) => { asked.push(req); return answer(req); }, setFeatureState() {}, cancel() {}};
    const renderer = {replaceBatches: (_: unknown, ids: string[]) => swaps.push(ids), createTile: () => ({labels: {}, batches: {}}), destroyTile() {}};
    const e: any = Object.assign(Object.create(Engine.prototype), {
        renderer, backends: [backend], tiles: new Map(), most: new WeakMap(), nextBackend: 0, nextReq: 0, tilesVersion: 0, frameNo: 1, tap: false, dpr: 1,
        // (The signature of the layers of the source, as `sourceSignature` makes it: a new object for each style.)
        sourceSigs: new Map([['s', ['', JSON.stringify(layers)]]]), zoomBuilt: new Set(), stateLog: new Map(), stateParts: new Map(), states: {f: {}},
        style: {sources: {s: {type: 'vector', tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14}}, layers},
        repaint() {}, invalidate() {}, emit() {},
    });
    const t: any = {state: 'ok', used: 1, band: 14, gl: {labels: {}, batches: {}}, stateSeen: 0, cancel() {}};
    e.tiles.set('s|14/1/2', t);
    const set = (states: Record<string, unknown>, replace?: boolean) => e.command({type: 'featureState', source: 's', states, replace});
    const rebuild = () => e.rebuildState('s', {z: 14, x: 1, y: 2, w: 0, key: '14/1/2'}, 's|14/1/2', t);
    return {e, t, asked, swaps, set, rebuild, answers: (fn: typeof answer) => { answer = fn; }};
}

test('state engine: a change marks the tiles for a build of the layers that read the state, with the keys that changed', async () => {
    const {t, asked, swaps, set, rebuild} = engine([fill]);
    set({'building|1': {hover: true}}); set({'building|2': {hover: true}});
    assert.equal(t.stateStale, true);
    assert.ok(!t.stale);
    rebuild();
    assert.deepEqual(asked[0].state, {layers: ['lit'], changed: ['building|1', 'building|2']});
    assert.equal(asked[0].again, true);
    assert.equal(asked[0].z, 14); // (the zoom that the tile has, not a new one)
    assert.equal(t.rebuilding, true);
    assert.ok(!t.stateStale);
    await tick();
    assert.equal(t.rebuilding, false);
    assert.deepEqual(swaps, [['lit']]);
    assert.equal(t.stateSeen, 2);
    // The next change: only its key.
    set({'building|1': null});
    rebuild();
    assert.deepEqual(asked[1].state.changed, ['building|1']);
});

test('state engine: a tile whose changes are not all in the log, or were replaced, builds its state layers without the keys', async () => {
    const many = engine([fill]);
    many.set(Object.fromEntries(Array.from({length: 300}, (_, i) => [`building|${i}`, {hover: true}])));
    many.rebuild();
    assert.deepEqual(many.asked[0].state, {layers: ['lit'], changed: undefined});
    // (The log has the last 256 keys: a tile that saw the first 10 of 300 single changes has lost some.)
    const old = engine([fill]);
    for (let i = 0; i < 10; i++) old.set({[`building|${i}`]: {hover: true}});
    old.t.stateSeen = 10;
    for (let i = 10; i < 300; i++) old.set({[`building|${i}`]: {hover: true}});
    old.rebuild();
    assert.equal(old.asked[0].state.changed, undefined);
    const fresh = engine([fill]);
    for (let i = 0; i < 300; i++) fresh.set({[`building|${i}`]: {hover: true}});
    fresh.t.stateSeen = 290;
    fresh.rebuild();
    assert.deepEqual(fresh.asked[0].state.changed, Array.from({length: 10}, (_, i) => `building|${290 + i}`));
    const replaced = engine([fill]);
    replaced.set({'building|1': {hover: true}});
    replaced.t.stateSeen = 1;
    replaced.set({}, true);
    replaced.rebuild();
    assert.equal(replaced.asked[0].state.changed, undefined);
});

test('state engine: with a symbol layer that reads the state, the tiles are built in full', () => {
    const {t, set} = engine([fill, label]);
    set({'building|1': {hover: true}});
    assert.equal(t.stale, true);
    assert.ok(!t.stateStale);
});

test('state engine: an answer that nothing changed swaps nothing, and one for a tile that is stale by then is not used', async () => {
    const same = engine([fill]);
    same.answers(async () => ({layers: {}, labels: {}, same: true}));
    same.set({'building|1': {hover: true}});
    same.rebuild();
    await tick();
    assert.deepEqual(same.swaps, []);
    assert.equal(same.t.stateSeen, 1);
    const stale = engine([fill]);
    stale.set({'building|1': {hover: true}});
    stale.rebuild();
    stale.t.stale = true; // (new data of the source came while the worker built)
    await tick();
    assert.deepEqual(stale.swaps, []);
});

test('state engine: a build of the state layers that fails makes the tile build in full', async () => {
    const {t, set, rebuild, swaps, answers} = engine([fill]);
    answers(async () => { throw new Error('no bytes'); });
    set({'building|1': {hover: true}});
    rebuild();
    await tick();
    assert.equal(t.rebuilding, false);
    assert.equal(t.stale, true);
    assert.equal(t.stateSeen, undefined);
    assert.deepEqual(swaps, []);
});
