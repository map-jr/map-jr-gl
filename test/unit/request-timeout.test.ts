// Unit tests for the timeout of glyph and sprite requests: a request that never answers fails like any other.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTimeout} from '../../src/requests.ts';

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
    // Tile requests are left out here: their timeout is #95.
    for (const kind of ['Glyphs', 'SpriteJSON', 'SpriteImage', 'Font', 'Image']) {
        const calls = src.match(new RegExp(`[\\w.]*\\(?this\\.fetchAs\\('${kind}'\\)`, 'g')) ?? [];
        assert.ok(calls.length > 0, `no request of kind ${kind} found in src/engine.ts`);
        for (const c of calls) assert.match(c, /^withTimeout\(/, `the request of kind ${kind} has no timeout: ${c}`);
    }
});
