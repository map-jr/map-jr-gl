// The coordinator's script reports a head as green only when the jobs of CI that gate a merge have passed (#2052).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the agent tools, without types)
import {headState} from '../../scripts/agents/prs.mjs';

type Job = {name: string, status: string, conclusion: string | null};
const done = (name: string, conclusion = 'success'): Job => ({name, status: 'completed', conclusion});
const queued = (name: string): Job => ({name, status: 'queued', conclusion: null});
const parts = ['browser-interact-main', 'browser-interact-worker', 'browser-host-main', 'browser-host-worker'];

/** Fixed REST answers: the CI runs of the head (newest first) and the jobs of the newest one. */
function api(runs: {id: number, status: string}[], jobs: Job[]) {
    return (path: string) => {
        if (path.startsWith('actions/workflows/ci.yml/runs?event=pull_request&head_sha=abc&')) return {workflow_runs: runs};
        if (runs.length && path.startsWith(`actions/runs/${runs[0].id}/jobs?`)) return {jobs};
        throw new Error(`unexpected path ${path}`);
    };
}

test('prs: a head without a CI run is pending, and only the CI run counts (#2052)', () => {
    // The fault: the check `site` of the workflow Docs site had passed, and CI had not started.
    assert.deepEqual(headState('abc', api([], [])), {done: false, empty: true, text: 'CI pending (no run yet)'});
});

test('prs: a queued or running CI run is pending, also when it lists no jobs yet or only some', () => {
    assert.equal(headState('abc', api([{id: 1, status: 'queued'}], [])).text, 'CI pending (0 of 3 jobs done)');
    assert.equal(headState('abc', api([{id: 1, status: 'queued'}], [done('changes'), queued('checks'), queued('render'), ...parts.map(queued)])).text, 'CI pending (1 of 7 jobs done)');
    assert.equal(headState('abc', api([{id: 1, status: 'in_progress'}], [done('changes'), done('checks')])).text, 'CI pending (2 of 4 jobs done)', 'render and browser-* are not listed yet');
    assert.equal(headState('abc', api([{id: 1, status: 'in_progress'}], [done('changes'), done('checks'), done('render'), ...parts.slice(1).map(p => done(p)), queued(parts[0])])).done, false);
});

test('prs: a head is green when the gating jobs passed, while the summary job browser still waits', () => {
    const s = headState('abc', api([{id: 1, status: 'in_progress'}], [done('changes'), done('checks'), done('render'), ...parts.map(p => done(p)), queued('browser')]));
    assert.deepEqual(s, {done: true, empty: false, text: 'green'});
    // A pull request that skips the browser jobs and render: the matrix job is listed once, unexpanded.
    assert.equal(headState('abc', api([{id: 1, status: 'completed'}], [done('changes'), done('checks'), done('render', 'skipped'), done('browser-${{ matrix.part }}', 'skipped'), done('browser', 'success')])).text, 'green');
});

test('prs: a failed or cancelled job, or a finished run without a gating job, is a failure', () => {
    assert.equal(headState('abc', api([{id: 1, status: 'completed'}], [done('changes'), done('checks', 'failure'), done('render'), ...parts.map(p => done(p, p.endsWith('worker') ? 'cancelled' : 'success'))])).text,
        'failed: checks, browser-interact-worker, browser-host-worker');
    assert.equal(headState('abc', api([{id: 1, status: 'completed'}], [])).text, 'failed: checks, browser-*, render');
});
