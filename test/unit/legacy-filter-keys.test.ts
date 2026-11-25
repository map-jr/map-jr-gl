// The legacy filters treat `$id` and `$type` as the feature id and the geometry type, as MapLibre does (#1812).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileFilter} from '../../src/expr.ts';

const withId = {type: 1, id: 7, properties: {a: 1}} as any;
const noId = {type: 1, properties: {a: 1}} as any;
const propId = {type: 1, properties: {$id: 1, $type: 1}} as any;
const run = (f: any, feature: any) => compileFilter(f)!({zoom: 0, f: feature} as any);

test('legacy has and !has read the feature id and geometry type for $id and $type', () => {
    assert.equal(run(['has', '$id'], withId), true);
    assert.equal(run(['has', '$id'], noId), false);
    assert.equal(run(['has', '$id'], propId), false);
    assert.equal(run(['!has', '$id'], withId), false);
    assert.equal(run(['!has', '$id'], noId), true);
    assert.equal(run(['has', '$type'], noId), true);
    assert.equal(run(['!has', '$type'], noId), false);
    assert.equal(run(['has', 'a'], noId), true);
    assert.equal(run(['!has', 'b'], noId), true);
});

test('legacy ==, !=, in and !in compare $id with the feature id', () => {
    assert.equal(run(['==', '$id', 7], withId), true);
    assert.equal(run(['!=', '$id', 7], withId), false);
    assert.equal(run(['in', '$id', 3, 7], withId), true);
    assert.equal(run(['!in', '$id', 3, 7], withId), false);
    assert.equal(run(['==', '$id', null], noId), true);
    assert.equal(run(['==', '$id', null], withId), false);
    assert.equal(run(['!=', '$id', null], noId), false);
    assert.equal(run(['!=', '$id', null], withId), true);
});
