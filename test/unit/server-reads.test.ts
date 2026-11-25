// The server build stops when the built server.js reads a method that `serverDrops` leaves out, in any form (#2041).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {removedReads} from '../../scripts/server-reads.mjs';

const methods = new Map([['unproject', {name: 'unproject', private: false}], ['project', {name: 'project', private: false}],
    ['_aB', {name: 'setLocationAt', private: false}], ['find', {name: 'find', private: true}]]);

test('a read of a removed method by a name, a string key or a destructuring key is found', () => {
    assert.deepEqual(removedReads('export const a = t => { const {unproject} = t; return unproject.call(t, 1, 1); };', methods), ['unproject']);
    assert.deepEqual(removedReads('export const b = t => t["project"](0, 0);', methods), ['project']);
    assert.deepEqual(removedReads('export const c = t => t[`project`](0, 0);', methods), ['project']);
    assert.deepEqual(removedReads('export const d = t => { const {"project": p} = t; return p; };', methods), ['project']);
    assert.deepEqual(removedReads('export const e = ([{x: {unproject: u}}]) => u;', methods), ['unproject']);
    assert.deepEqual(removedReads('export const f = t => t.unproject?.(1, 1);', methods), ['unproject']);
    assert.deepEqual(removedReads('export const g = t => t._aB(1, 2, 3, 4);', methods), ['setLocationAt']);
    assert.deepEqual(removedReads('export class C { h() { return this.find(1); } }', methods), ['find']);
    assert.deepEqual(removedReads('export class C { h(o) { return o["find"](1); } }', methods), ['find']);
});

test('other reads are not found', () => {
    assert.deepEqual(removedReads('export const a = l => l.find(x => x > 1);', methods), []);
    assert.deepEqual(removedReads('export const b = t => ({project: 1, unproject: t.lng});', methods), []);
    assert.deepEqual(removedReads('export const c = (t, k) => t[k] + "project";', methods), []);
});
