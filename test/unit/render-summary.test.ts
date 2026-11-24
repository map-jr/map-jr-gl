// The counts and the labels of the render tests (#558): the count for "near" includes the matches, a label has a
// decision, and a wontfix label on a test that matches is reported.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// @ts-expect-error (a plain module of the conformance tools, without types)
import {summarize, readExpectations, report, changes, percent, skipReason, operationsNotDone} from '../../test/conformance/render-summary.mjs';

const dir = new URL('../conformance/', import.meta.url);
const results = [
    {id: 'sky/fog', status: 'differ'}, {id: 'line/a', status: 'match'}, {id: 'globe/b', status: 'near'}, {id: 'globe/a', status: 'differ'},
    {id: 'text/kept', status: 'differ'}, {id: 'text/fixed', status: 'match'}, {id: 'line/b', status: 'error'}, {id: 'line/c', status: 'skipped'},
];
const expectations = readExpectations({expectations: [
    {pattern: '^globe/', label: 'globe', decision: 'later', reason: 'Not done.'},
    {test: 'text/kept', label: 'text', decision: 'wontfix', reason: 'Decided.'},
    {test: 'text/fixed', label: 'text', decision: 'wontfix', reason: 'Decided.'},
    {pattern: '^video/', label: 'video', decision: 'later', reason: 'Not done.'},
]});

test('render summary: the count for near includes the matches, and the tests that differ are counted by decision', () => {
    const s = summarize(results, expectations);
    assert.deepEqual(s.totals, {match: 2, near: 3, differ: 3, differWontfix: 1, differLater: 1, errored: 1, skipped: 1, run: 7});
    assert.deepEqual(s.labels.globe, {decision: 'later', tests: 2, match: 0, near: 1, differ: 1, error: 0, skipped: 0});
    assert.equal(report(s)[0], 'MapLibre render tests: 2 of 7 match (28.6%; 1% of pixels or less are different), 3 match or are near (42.9%; 5% or less), 3 differ (1 of them wontfix, 1 later), 1 errored; 1 skipped (tests that the run cannot do)');
});

test('render summary: a test that scripts the map or has another pixel ratio runs, and one with an operation that the run cannot do is skipped (#559)', () => {
    assert.equal(skipReason({operations: [['setPaintProperty', 'a', 'fill-color', 'red'], ['wait'], ['idle'], ['sleep', 100], ['addImage', 'a', 'image/marker.png']]}), null);
    assert.equal(skipReason({pixelRatio: 2}), null);
    assert.equal(skipReason({}), null);
    assert.equal(skipReason(), null);
    // The reason is the name of the first operation that the run cannot do.
    assert.equal(skipReason({operations: [['wait'], ['addCustomLayer', 'tent-3d'], ['pauseTiles', 'a']]}), 'pauseTiles');
    assert.equal(skipReason({operations: [['addCustomLayer', 'tent-3d']]}), null);
    for (const name of operationsNotDone) assert.equal(skipReason({operations: [[name, 'a']]}), name);
    assert.equal(skipReason({pixelRatio: 5, reportWidth: 256, reportHeight: 256}), 'reportWidth');
    // A style that setStyle loads can have tiles of the package @mapbox/mvt-fixtures, which the run may not have.
    const asset = (name: string) => name === 'styles/nepal.json' ? '{"tiles": ["http://localhost:2901/nepal/{z}-{x}-{y}.mvt"]}' : name === 'styles/basic.json' ? '{}' : '';
    assert.equal(skipReason({operations: [['setStyle', 'local://styles/nepal.json'], ['wait']]}, asset), '@mapbox/mvt-fixtures');
    assert.equal(skipReason({operations: [['setStyle', 'http://localhost:1234/styles/nepal.json']]}, asset), '@mapbox/mvt-fixtures');
    assert.equal(skipReason({operations: [['setStyle', 'local://styles/basic.json']]}, asset), null);
    // When the run has downloaded the package, those tests run (#665).
    assert.equal(skipReason({operations: [['setStyle', 'local://styles/nepal.json'], ['wait']]}, asset, true), null);
    assert.equal(skipReason({operations: [['setStyle', {version: 8, sources: {}, layers: []}]]}, asset), null);
});

test('render summary: a percent has one decimal place, so that a change of two tests of 1429 shows', () => {
    assert.equal(percent(874, 1429), '61.2%');
    assert.equal(percent(1154, 1429), '80.8%');
    assert.notEqual(percent(876, 1429), percent(874, 1429));
    assert.equal(percent(0, 0), '0.0%');
});

test('render summary: the status of each test is sorted by id, so that the tracked file has a stable order', () => {
    const s = summarize(results, expectations);
    assert.deepEqual(Object.keys(s.tests), ['globe/a', 'globe/b', 'line/a', 'line/b', 'line/c', 'sky/fog', 'text/fixed', 'text/kept']);
    assert.equal(s.tests['line/b'], 'error');
    assert.deepEqual(summarize([...results].reverse(), expectations).tests, s.tests);
});

test('render summary: a wontfix label on a test that matches is reported, and so is a label that fits no test', () => {
    const s = summarize(results, expectations);
    assert.deepEqual(s.stale, [{id: 'text/fixed', label: 'text'}]);
    assert.deepEqual(s.unused, ['video']);
    const lines = report(s);
    assert.ok(lines.includes('Labels with the decision wontfix (differ/tests): text 1/2'));
    assert.ok(lines.includes('Labels with the decision later (differ/tests): globe 1/2'));
    assert.ok(lines.some((l: string) => l.startsWith('STALE: text/fixed matches')));
    assert.ok(lines.some((l: string) => l.startsWith('UNUSED: the label "video"')));
    // A filter leaves tests out of the run. A label that fits one of those is not unused.
    assert.deepEqual(summarize(results, expectations, ['video/default']).unused, ['globe', 'text', 'text']);
});

test('render summary: an entry with a mistake is refused with a message that names it', () => {
    const one = (e: object) => () => readExpectations({expectations: [e]});
    assert.throws(one({pattern: '^a/', label: 'a', decision: 'wont-fix', reason: 'r'}), /entry 1 \("a"\): "decision" is "wont-fix"\. Write "wontfix" or "later"\./);
    assert.throws(one({label: 'a', decision: 'later', reason: 'r'}), /give either "test"/);
    assert.throws(one({test: 'a/b', pattern: '^a/', label: 'a', decision: 'later', reason: 'r'}), /give either "test"/);
    assert.throws(one({pattern: '^a/', label: 'a', decision: 'later'}), /"label" and "reason" are required/);
    assert.throws(one({pattern: '(', label: 'a', decision: 'later', reason: 'r'}), /"pattern" is not a regular expression/);
    assert.throws(() => readExpectations({}), /no "expectations" array/);
});

test('render summary: the tests whose status is not the one in the tracked file are listed', () => {
    assert.deepEqual(changes({'a/a': 'match', 'a/b': 'differ', 'a/gone': 'match'}, {'a/a': 'near', 'a/b': 'differ', 'a/c': 'match'}),
        ['CHANGED: a/a was match and is near', 'NEW: a/c is match']);
});

test('render summary: the tracked files agree with each other', () => {
    const read = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
    const tests: Record<string, string> = read('render-tests.json'), totals = read('render-result.json'), expectations = readExpectations(read('render-expectations.json'));
    const ids = Object.keys(tests);
    assert.deepEqual(ids, [...ids].sort(), 'render-tests.json is sorted by id');
    const s = summarize(ids.map(id => ({id, status: tests[id]})), expectations);
    assert.deepEqual(s.totals, totals, 'render-result.json has the totals of render-tests.json and render-expectations.json');
    assert.deepEqual(s.unused, [], 'each entry of render-expectations.json fits a test');
    // Only the owner decides that a difference is kept (#558), and a wontfix label on a test that matches is stale.
    assert.deepEqual(s.stale, []);
});
