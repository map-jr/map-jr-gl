// warnOnce keeps a bounded number of messages, because they hold style text (#588).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {warnOnce} from '../../src/expr.ts';

test('warnOnce warns at most 101 times for many different messages', () => {
    const calls: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { calls.push(args); };
    try {
        warnOnce('same');
        warnOnce('same');
        for (let i = 0; i < 1000; i++) warnOnce(`Unsupported expression "op${i}"`);
    } finally { console.warn = original; }
    assert.equal(calls.length, 101);
    assert.equal(calls[0][0], '[map-jr-gl] same');
    assert.match(String(calls[100][0]), /Later ones are not shown/);
});
