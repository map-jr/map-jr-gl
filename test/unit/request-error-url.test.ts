// Unit test for #1163: a request that fails on the network names the resource and its URL and keeps the reason as `cause`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchWith} from '../../src/requests.ts';

test('request error: a failed request says which resource and URL, and keeps the cause', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    try {
        const ask = () => Promise.resolve({});
        const sprite = await fetchWith(() => undefined, ask, 'SpriteJSON')('https://x.test/sprite.json').catch(e => e);
        assert.match(sprite.message, /^\[map-jr-gl\] the request for the sprite https:\/\/x\.test\/sprite\.json failed: Failed to fetch$/);
        assert.equal(sprite.cause.message, 'Failed to fetch');
        const tile = await fetchWith(() => undefined, ask)('https://x.test/' + 'a'.repeat(500)).catch(e => e);
        assert.match(tile.message, /^\[map-jr-gl\] the request for the tile https:\/\/x\.test\/a+\.\.\. failed/);
        assert.ok(tile.message.length < 300);
        globalThis.fetch = (() => Promise.reject(new DOMException('x', 'AbortError'))) as typeof fetch;
        assert.equal((await fetchWith(() => undefined, ask)('https://x.test/t').catch(e => e)).name, 'AbortError');
    } finally { globalThis.fetch = real; }
});
