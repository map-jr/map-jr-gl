// Unit test for #2351: the `referrerPolicy` that `transformRequest` returns reaches the request, and a policy that the caller set stays.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchWith} from '../../src/requests.ts';

test('referrerPolicy of the answer is applied to the request (#2351)', async () => {
    const real = globalThis.fetch, seen: (RequestInit | undefined)[] = [];
    globalThis.fetch = ((_: unknown, init?: RequestInit) => (seen.push(init), Promise.resolve(new Response('')))) as typeof fetch;
    try {
        const rules = () => ({transform: true, protocols: []});
        await fetchWith(rules, async () => ({referrerPolicy: 'no-referrer'}))('https://x.test/t');
        assert.equal(seen[0]?.referrerPolicy, 'no-referrer');
        await fetchWith(rules, async () => ({}))('https://x.test/t', {referrerPolicy: 'origin'});
        assert.equal(seen[1]?.referrerPolicy, 'origin');
        await fetchWith(rules, async () => ({referrerPolicy: 'no-referrer'}))('https://x.test/t', {referrerPolicy: 'origin'});
        assert.equal(seen[2]?.referrerPolicy, 'no-referrer');
    } finally { globalThis.fetch = real; }
});
