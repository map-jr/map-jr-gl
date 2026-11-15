// Unit tests for the timeout of requests (glyphs, sprites, fonts, images, tiles, TileJSON, GeoJSON; #135, #141, #394): a request that never answers fails like any other.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTimeout} from '../../src/requests.ts';
import {TileBuilder} from '../../src/tiles.ts';

test('request timeout: a request that never answers rejects and is aborted', async () => {
    let signal: AbortSignal | undefined;
    const never = ((_: unknown, init?: RequestInit) => { signal = init?.signal ?? undefined; return new Promise<Response>(() => {}); }) as typeof fetch;
    await assert.rejects(withTimeout(never, 50)('https://glyphs.test/0-255.pbf'), /\[map-jr-gl\] the request to https:\/\/glyphs\.test\/0-255\.pbf did not finish within 50 ms/);
    assert.equal(signal?.aborted, true);
});

test('request timeout: a body that never ends is aborted', async () => {
    const endless = (async (_: unknown, init?: RequestInit) => new Response(new ReadableStream({start(c) {
        c.enqueue(new Uint8Array(10)); init!.signal!.addEventListener('abort', () => c.error(new Error('aborted')));
    }}))) as typeof fetch;
    const res = await withTimeout(endless, 50)('https://sprites.test/s.png');
    await assert.rejects(res.arrayBuffer());
});

test('request timeout: a request that answers in time is unchanged', async () => {
    const res = await withTimeout((async () => new Response('ok')) as typeof fetch, 1000)('https://glyphs.test/a');
    assert.equal(await res.text(), 'ok');
});

test('request timeout: the engine wraps every request for glyphs, sprites, fonts and images in withTimeout', async () => {
    const {readFile} = await import('node:fs/promises');
    const src = await readFile(new URL('../../src/engine.ts', import.meta.url), 'utf8');
    for (const kind of ['Glyphs', 'SpriteJSON', 'SpriteImage', 'Font', 'Image']) {
        const calls = src.match(new RegExp(`[\\w.]*\\(?this\\.fetchAs\\('${kind}'\\)`, 'g')) ?? [];
        assert.ok(calls.length > 0, `no request of kind ${kind} found in src/engine.ts`);
        for (const c of calls) assert.match(c, /^withTimeout\(/, `the request of kind ${kind} has no timeout: ${c}`);
    }
});

test('request timeout: an abort by the caller still ends the request', async () => {
    let signal: AbortSignal | undefined;
    const never = ((_: unknown, init?: RequestInit) => { signal = init?.signal ?? undefined; return new Promise<Response>(() => {}); }) as typeof fetch;
    const ac = new AbortController(), p = withTimeout(never, 10000)('https://tiles.test/1/0/0.pbf', {signal: ac.signal});
    ac.abort(new Error('cancelled'));
    await assert.rejects(p, /cancelled/);
    assert.equal(signal?.aborted, true);
});

test('request timeout: a tile request that never answers fails after 30 s like any failed tile (#394)', async t => {
    t.mock.timers.enable({apis: ['setTimeout']});
    const builder = new TileBuilder((() => new Promise<Response>(() => {})) as typeof fetch);
    const p = builder.loadIR({id: 1, source: 's', url: 'https://tiles.test/1/0/0.pbf', z: 1} as never);
    let failed: unknown;
    p.catch(e => { failed = e; });
    await new Promise(r => setImmediate(r));
    t.mock.timers.tick(29999);
    await new Promise(r => setImmediate(r));
    assert.equal(failed, undefined);
    t.mock.timers.tick(1);
    await new Promise(r => setImmediate(r));
    assert.match(String(failed), /\[map-jr-gl\] the request to https:\/\/tiles\.test\/1\/0\/0\.pbf did not finish within 30000 ms/);
});

test('request timeout: tile requests of the engine and the requests of the map (style, TileJSON, GeoJSON) have the timeout', async () => {
    const {readFile} = await import('node:fs/promises');
    const engine = await readFile(new URL('../../src/engine.ts', import.meta.url), 'utf8');
    const tiles = engine.match(/fetchTile\(url, [^,)]*\(?this\.fetchAs\('Tile'\)/g) ?? [];
    assert.ok(tiles.length > 0);
    for (const c of tiles) assert.match(c, /withTimeout\(this\.fetchAs/, `a tile request of the engine has no timeout: ${c}`);
    const map = await readFile(new URL('../../src/map.ts', import.meta.url), 'utf8');
    assert.match(map, /protected fetchAs = \(kind: string\) => withTimeout\(fetchWith\(/);
});

test('request timeout: the timer is cleared when the request settles (#415)', async () => {
    const active = new Set<unknown>(), set = globalThis.setTimeout, clear = globalThis.clearTimeout;
    globalThis.setTimeout = ((fn: () => void, ms?: number) => { const id = set(() => { active.delete(id); fn(); }, ms); active.add(id); return id; }) as typeof setTimeout;
    globalThis.clearTimeout = ((id: ReturnType<typeof setTimeout>) => { active.delete(id); clear(id); }) as typeof clearTimeout;
    try {
        const res = await withTimeout((async () => Object.defineProperty(new Response('ok'), 'url', {value: 'https://glyphs.test/a'})) as typeof fetch)('https://glyphs.test/a');
        assert.equal(res.url, 'https://glyphs.test/a');
        assert.equal(await res.text(), 'ok');
        assert.equal(await (await withTimeout((async () => new Response('{"a":1}')) as typeof fetch)('https://glyphs.test/j')).json().then(j => j.a), 1);
        assert.equal((await withTimeout((async () => new Response(null, {status: 204})) as typeof fetch)('https://glyphs.test/b')).status, 204);
        await assert.rejects(withTimeout((async () => { throw new Error('offline'); }) as typeof fetch)('https://glyphs.test/c'), /offline/);
        const ac = new AbortController(), p = withTimeout((() => new Promise<Response>(() => {})) as typeof fetch)('https://glyphs.test/d', {signal: ac.signal});
        ac.abort(new Error('cancelled'));
        await assert.rejects(p, /cancelled/);
        assert.equal(active.size, 0, `${active.size} timers of settled requests are still pending`);
    } finally {
        for (const id of active) clear(id as ReturnType<typeof setTimeout>);
        globalThis.setTimeout = set; globalThis.clearTimeout = clear;
    }
});
