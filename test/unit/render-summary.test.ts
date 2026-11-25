// The counts and the labels of the render tests (#558): the count for "near" includes the matches, a label has a
// decision, and a wontfix label on a test that matches is reported.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
// @ts-expect-error (a plain module of the conformance tools, without types)
import {summarize, readExpectations, report, changes, percent, skipReason, operationsNotDone, trackedSummary, compareWithTracked} from '../../test/conformance/render-summary.mjs';

const dir = new URL('../conformance/', import.meta.url);
const results = [
    {id: 'sky/fog', status: 'differ'}, {id: 'line/a', status: 'match'}, {id: 'globe/b', status: 'near'}, {id: 'globe/a', status: 'differ'},
    {id: 'text/kept', status: 'differ'}, {id: 'text/fixed', status: 'match'}, {id: 'line/b', status: 'error'}, {id: 'line/c', status: 'skipped'},
];
const expectations = readExpectations([
    {file: 'globe.json', data: {pattern: '^globe/', label: 'globe', decision: 'later', reason: 'Not done.'}},
    {file: 'text.json', data: {tests: ['text/kept', 'text/fixed'], label: 'text', decision: 'wontfix', reason: 'Decided.'}},
    {file: 'video.json', data: {pattern: '^video/', label: 'video', decision: 'later', reason: 'Not done.'}},
]);

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
    assert.deepEqual(summarize(results, expectations, ['video/default']).unused, ['globe', 'text']);
});

test('render summary: a file with a mistake is refused with a message that names it', () => {
    const one = (data: object) => () => readExpectations([{file: 'a.json', data}]);
    assert.throws(one({pattern: '^a/', label: 'a', decision: 'wont-fix', reason: 'r'}), /render-expectations\/a\.json \("a"\): "decision" is "wont-fix"\. Write "wontfix" or "later"\./);
    assert.throws(one({label: 'a', decision: 'later', reason: 'r'}), /give either "tests"/);
    assert.throws(one({tests: ['a/b'], pattern: '^a/', label: 'a', decision: 'later', reason: 'r'}), /give either "tests"/);
    assert.throws(one({tests: [], label: 'a', decision: 'later', reason: 'r'}), /give either "tests"/);
    assert.throws(one({pattern: '^a/', label: 'a', decision: 'later'}), /"label" and "reason" are required/);
    assert.throws(one({pattern: '(', label: 'a', decision: 'later', reason: 'r'}), /"pattern" is not a regular expression/);
    assert.throws(one({pattern: '^a/', label: 'a', decision: 'later', reason: 'r', fallback: 'yes'}), /"fallback" is true or left out/);
    assert.throws(() => readExpectations([{file: 'a.json', data: {pattern: '^a/', label: 'a', decision: 'later', reason: 'r'}}, {file: 'b.json', data: {pattern: '^b/', label: 'a', decision: 'later', reason: 'r'}}]), /b\.json: the label "a" is also in a\.json/);
    assert.throws(() => readExpectations({}), /takes an array/);
});

test('render summary: a fallback label counts only the tests that no other label fits, and two labels that fit one test are reported (#1862)', () => {
    const e = (file: string, data: object) => ({file, data: {decision: 'later', reason: 'r', ...data}});
    // The fallback file sorts first by name, and it still comes last.
    const list = readExpectations([e('a-all.json', {pattern: '^globe/', label: 'all', fallback: true}), e('b-one.json', {tests: ['globe/a'], label: 'one'})]);
    const s = summarize(results, list);
    assert.equal(s.labels.one.tests, 1);
    assert.equal(s.labels.all.tests, 1);
    assert.deepEqual(s.overlaps, []);
    const twice = summarize(results, readExpectations([e('a.json', {pattern: '^globe/', label: 'x'}), e('b.json', {tests: ['globe/a'], label: 'y'})]));
    assert.deepEqual(twice.overlaps, [{id: 'globe/a', labels: ['x', 'y']}]);
    assert.ok(report(twice).includes('OVERLAP: globe/a fits the labels "x" and "y". Narrow one, or give the wider one "fallback": true.'));
});

test('render summary: a test worse than its line fails the run, and one better is printed (#1915)', () => {
    const before = {'a/m': 'match', 'a/n': 'near', 'a/d': 'differ', 'a/s': 'skipped', 'a/k': 'match'};
    const v = compareWithTracked(before, {'a/m': 'near', 'a/n': 'match', 'a/d': 'differ', 'a/s': 'match', 'a/k': 'match', 'a/new': 'match'});
    assert.deepEqual(v.worse, [{id: 'a/m', was: 'match', now: 'near'}]);
    assert.deepEqual(v.better, [{id: 'a/n', was: 'near', now: 'match'}]);
    assert.ok(v.fail);
    assert.ok(v.lines.some((l: string) => l.startsWith('FAIL:') && l.includes('a/m')));
    assert.ok(v.lines.includes('BETTER: a/n is match, and its line in render-tests.json is near. Commit the line "a/n": "match".'));
    assert.equal(compareWithTracked(before, {...before, 'a/d': 'near'}).fail, false);
    assert.equal(compareWithTracked(before, {'a/d': 'error'}, false).fail, true, 'an error is worse than differ');
    // The floor is the count of lines "match": a full run with fewer matches fails even with no worse test.
    const floor = compareWithTracked(before, {'a/m': 'match'});
    assert.deepEqual([floor.floor, floor.match, floor.fail], [2, 1, true]);
    assert.equal(compareWithTracked(before, {'a/m': 'match'}, false).fail, false, 'a run with a filter has no floor');
});

test('render summary: the tests whose status is not the one in the tracked file are listed', () => {
    assert.deepEqual(changes({'a/a': 'match', 'a/b': 'differ', 'a/gone': 'match'}, {'a/a': 'near', 'a/b': 'differ', 'a/c': 'match'}),
        ['CHANGED: a/a was match and is near', 'NEW: a/c is match']);
});

test('render summary: the tracked files agree with each other', () => {
    const read = (name: string) => JSON.parse(readFileSync(new URL(name, dir), 'utf8'));
    const tests: Record<string, string> = read('render-tests.json');
    const ids = Object.keys(tests);
    assert.deepEqual(ids, [...ids].sort(), 'render-tests.json is sorted by id');
    const s = trackedSummary(dir);
    // The totals are computed and not committed, so that two pull requests that move tests change no common line (#1861, #1915).
    assert.ok(!existsSync(new URL('render-result.json', dir)), 'render-result.json is not committed: pnpm status computes the totals from render-tests.json');
    assert.ok(Object.values(tests).every(v => ['match', 'near', 'differ', 'error', 'skipped'].includes(v)), 'each line of render-tests.json has a status');
    assert.deepEqual(s.unused, [], 'each file of render-expectations/ fits a test');
    assert.deepEqual(s.overlaps, [], 'no test has two labels of the same kind');
    // Only the owner decides that a difference is kept (#558), and a wontfix label on a test that matches is stale.
    assert.deepEqual(s.stale, []);
});

