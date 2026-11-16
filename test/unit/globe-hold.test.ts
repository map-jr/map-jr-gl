// Unit test for #463: a switch from Mercator to the globe waits until the tiles that the globe draws are cut. (Tiles
// without the cut cut through the sphere near its edge, and the background showed through in wedges.)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../../src/engine.ts';
import {Transform} from '../../src/geo.ts';
import * as globe from '../../src/globe.ts';

const engine = (since: number) => {
    const tr = new Transform();
    tr.width = 800; tr.height = 600; tr.globe = globe;
    tr.set([10, 30], 1.5, 0, 0);
    const requested: string[] = [], tiles = new Map();
    const e = Object.assign(Object.create(Engine.prototype), {
        tr, tiles, frameNo: 1, globeWait: {stops: [11, 1, 12, 0], since},
        style: {sources: {s: {type: 'vector', tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, tileSize: 512}}},
        layers: [{source: 's', visible: true, minzoom: 0, maxzoom: 24}], sourceSigs: new Map([['s', ['src', '[rules]globe']]]),
        request(_: string, _id: unknown, key: string) { requested.push(key); tiles.set(key, {state: 'loading', used: 1}); },
        refresh() {}, invalidate() {},
    });
    return {e, tr, requested, tiles};
};

test('globe hold: the map stays in Mercator until the tiles of the globe are cut, and then switches', () => {
    const {e, tr, requested, tiles} = engine(performance.now());
    assert.equal(e.holdGlobe(new Set(), 1), false);
    assert.equal(tr.globeStops, null, 'the map switched to the globe before its tiles were there');
    assert.ok(requested.length > 0, 'the tiles of the globe were not asked for');
    // A tile that is there but not cut yet (built for Mercator, being built again) still holds the switch.
    for (const t of tiles.values()) Object.assign(t, {state: 'ok', stale: true});
    assert.equal(e.holdGlobe(new Set(), 2), false);
    for (const t of tiles.values()) t.stale = false;
    assert.equal(e.holdGlobe(new Set(), 3), true);
    assert.deepEqual(tr.globeStops, [11, 1, 12, 0]);
    assert.equal(e.globeWait, null);
});

test('globe hold: after a second the map switches also without the tiles', () => {
    const {e, tr} = engine(performance.now() - 1001);
    assert.equal(e.holdGlobe(new Set(), 1), true);
    assert.deepEqual(tr.globeStops, [11, 1, 12, 0]);
});
