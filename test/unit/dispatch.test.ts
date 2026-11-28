// The hourly dispatcher reads cluster issues, the "Found" lines of reports and the ready rule from fixed texts (#2580).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the agent tools, without types)
import {parseCluster, foundLines, foundTitle, readyClusters, ciShare, prAction} from '../../scripts/agents/dispatch.mjs';

const cluster = `**Fault:** queries test symbols on rebuilt boxes.
**Where:** \`src/engine-query.ts:159-265\` (\`textBoxes\`); \`src/engine.ts:2070-2078\`; MapLibre GL JS: \`maplibre-gl-dev.mjs:40719\`.
**Evidence:** read.
**Done when:** the checks agree.
**From:** #2581
**Symptoms:**
- #2070 Queries of icons with icon-text-fit test the image size
- #2098 A query tells labels apart by their text

**Moved (2026-11-28):** #2330 stays an issue of its own.`;

test('a cluster body gives its symptoms and the files of its Where', () => {
    assert.deepEqual(parseCluster(cluster), {symptoms: [2070, 2098], files: ['src/engine-query.ts', 'src/engine.ts']});
});

test('an issue without Symptoms is not a cluster', () => {
    assert.equal(parseCluster('**Fault:** x\n**Where:** `src/a.ts:1`'), null);
    assert.equal(parseCluster(null), null);
});

test('Found lines come from the report line, with "none" left out', () => {
    const body = '## Report\n- PR: x\n- Found: Engine drops a tile on resize | `src/engine.ts:12` | ran; Symptom of #2586: Query misses icons | `src/q.ts:3` | read\n- Needs owner: no';
    assert.deepEqual(foundLines(body), ['Engine drops a tile on resize | `src/engine.ts:12` | ran', 'Symptom of #2586: Query misses icons | `src/q.ts:3` | read']);
    assert.deepEqual(foundLines('- Found: none'), []);
    assert.equal(foundTitle('Symptom of #2586: Query misses icons | `src/q.ts:3` | read'), 'Query misses icons');
});

test('Found lines come from a section, until the next heading', () => {
    const body = '## What\ntext\n## Found\n- Hash drops the bearing | `src/hash.ts:4` | ran\n- Popup leaks | `src/popup.ts:9` | read\n## Needs the owner?\nno';
    assert.deepEqual(foundLines(body), ['Hash drops the bearing | `src/hash.ts:4` | ran', 'Popup leaks | `src/popup.ts:9` | read']);
});

test('a sentence that only mentions "Found" is not a Found line', () => {
    assert.deepEqual(foundLines('- `docs/x.md`: a "Found" line can start with "Symptom of #N:".\nFound the cause in the engine.'), []);
});

test('the ready rule holds a cluster that a pull request names or whose files it changes, oldest first', () => {
    const clusters = [
        {number: 30, created: '2026-11-28T03:00:00Z', files: ['src/c.ts']},
        {number: 10, created: '2026-11-28T01:00:00Z', files: ['src/a.ts']},
        {number: 20, created: '2026-11-28T02:00:00Z', files: ['src/b.ts']},
        {number: 40, created: '2026-11-28T00:00:00Z', files: ['src/d.ts']},
    ];
    const prs = [
        {number: 1, title: 'Fix it', body: 'Fixes #10', files: ['src/x.ts']},
        {number: 2, title: 'Other', body: 'Fixes #200', files: ['src/b.ts']},
    ];
    const r = readyClusters(clusters, prs);
    assert.deepEqual(r.map((c: {number: number}) => c.number), [40, 10, 20, 30]);
    assert.deepEqual(r.map((c: {ready: boolean}) => c.ready), [true, false, false, true]);
    assert.equal(r[1].why, 'named by #1');
    assert.equal(r[2].why, 'files changed by #2');
});

test('of two ready clusters that change the same file, only the older one is ready', () => {
    const r = readyClusters([
        {number: 2, created: '2026-11-28T02:00:00Z', files: ['src/terrain.ts', 'src/b.ts']},
        {number: 1, created: '2026-11-28T01:00:00Z', files: ['src/a.ts', 'src/terrain.ts']},
    ], []);
    assert.deepEqual(r.map((c: {ready: boolean}) => c.ready), [true, false]);
    assert.equal(r[1].why, 'shares files with #1');
});

test('the share of CI is read from the coordination issue, else 8', () => {
    assert.equal(ciShare('Keep about six pull requests in CI at once.'), 6);
    assert.equal(ciShare('no number here'), 8);
});

test('the action of a pull request', () => {
    assert.equal(prAction({mergeable_state: 'dirty', ci: 'green', auto_merge: false}), 'merge main');
    assert.equal(prAction({mergeable_state: 'blocked', ci: 'failed: render', auto_merge: true}), 'send the failure to its author');
    assert.equal(prAction({mergeable_state: 'clean', ci: 'green', auto_merge: false}), 'read the diff and turn on auto-merge');
});
