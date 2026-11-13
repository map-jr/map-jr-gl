// A query about a tile that is loading shares the download of the load (#95).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TileBuilder} from '../../src/tiles.ts';

const bytes = new Uint8Array(readFileSync(new URL('../fixtures/14-4823-6160.pbf', import.meta.url)));
const q = {source: 's', z: 14, x: 4823, y: 6160, px: 2048, py: 2048, radius: 4096};
const req = {id: 1, source: 's', url: 'https://example.com/t.pbf', z: 14, overscaled: false as const};

/** A fetch that counts its calls and answers only after `release`. */
function counting() {
    let calls = 0, release!: () => void;
    const gate = new Promise<void>(r => { release = r; });
    const fetchFn = (async () => { calls++; await gate; return new Response(bytes); }) as unknown as typeof fetch;
    return {fetchFn, release: () => release(), calls: () => calls};
}

test('a query about a tile that is loading does not fetch it again', async () => {
    const f = counting(), b = new TileBuilder(f.fetchFn);
    const load = b.loadIR(req);
    await new Promise(r => setTimeout(r, 0));
    const query = b.query(req.url, q);
    f.release();
    await load;
    assert.ok((await query).length > 0);
    assert.equal(f.calls(), 1);
});

test('a query fetches the tile itself when the load is cancelled', async () => {
    const f = counting(), b = new TileBuilder(f.fetchFn);
    const load = b.loadIR(req).catch(() => null);
    await new Promise(r => setTimeout(r, 0));
    const query = b.query(req.url, q);
    b.cancel(1);
    f.release();
    await load;
    assert.ok((await query).length > 0);
});
