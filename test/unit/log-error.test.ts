// The prefix `[map-jr-gl]` appears once in a logged error, also when the message already has it (#92).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {logError} from '../../src/map.ts';

test('logError adds the prefix only when the message does not have it', () => {
    const calls: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => { calls.push(args); };
    try {
        logError(new Error('[map-jr-gl] Style https://example.com/style.json: HTTP 404'));
        logError(new Error('listener failed'));
        logError('text');
    } finally { console.error = original; }
    assert.equal(calls[0].length, 1);
    assert.equal(calls[1][0], '[map-jr-gl]');
    assert.deepEqual(calls[2], ['[map-jr-gl]', 'text']);
});
