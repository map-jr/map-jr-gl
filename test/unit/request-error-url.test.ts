// Unit test for #1163: a request that fails on the network names the resource and its URL and keeps the reason as `cause`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchWith} from '../../src/requests.ts';

test('request rejection (#652): a protocol that rejects is final, and a rejection after an abort stays an abort', async () => {
    const rules = () => ({transform: false, protocols: ['p652']});
    const rejected = await fetchWith(rules, async () => ({error: 'no such tile'}))('p652://1/2/3').catch(e => e);
    assert.equal(rejected.final, true);
    assert.match(rejected.message, /failed: the protocol rejected it: no such tile$/);
    const ac = new AbortController();
    const aborted = await fetchWith(rules, async () => { ac.abort(); return {error: '[map-jr-gl] the request was aborted.'}; })('p652://1/2/3', {signal: ac.signal}).catch(e => e);
    assert.equal(aborted.name, 'AbortError');
});

test('request error: a failed request says which resource and URL, and keeps the cause', async () => {
    const real = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    try {
        const ask = () => Promise.resolve({});
        const sprite = await fetchWith(() => undefined, ask, 'SpriteJSON')('https://x.test/sprite.json').catch(e => e);
        assert.match(sprite.message, /^\[map-jr-gl\] E1163 the request for the sprite https:\/\/x\.test\/sprite\.json failed: Failed to fetch$/);
        assert.equal(sprite.cause.message, 'Failed to fetch');
        const tile = await fetchWith(() => undefined, ask)('https://x.test/' + 'a'.repeat(500)).catch(e => e);
        assert.match(tile.message, /^\[map-jr-gl\] E1163 the request for the tile https:\/\/x\.test\/a+\.\.\. failed/);
        assert.ok(tile.message.length < 300);
        globalThis.fetch = (() => Promise.reject(new DOMException('x', 'AbortError'))) as typeof fetch;
        assert.equal((await fetchWith(() => undefined, ask)('https://x.test/t').catch(e => e)).name, 'AbortError');
    } finally { globalThis.fetch = real; }
});
