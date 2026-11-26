// Unit test for #2232: the value `reason` of E1163 for a tile is a short code, not a sentence, so production prints it short.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchTile} from '../../src/tile-fetch.ts';

test('tile 503: the reason is "HTTP 503" only', async () => {
    const f = (() => Promise.resolve(new Response('x', {status: 503}))) as typeof fetch;
    const e = await fetchTile('https://x.test/1/2/3.pbf', f, new AbortController().signal).catch(e => e);
    assert.match(e.message, /failed: HTTP 503$/);
});
