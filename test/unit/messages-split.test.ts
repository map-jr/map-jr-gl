// A message is not chosen between two cases by `? :` (#2148): each case has a message and a code of its own, so that the
// code says which case happened. scripts/messages.mjs --check fails on a code whose text a `? :` chooses between.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

test('the messages of src/ have no code whose text is chosen between two cases', () => {
    const out = execFileSync(process.execPath, ['scripts/messages.mjs', '--check'], {encoding: 'utf8'});
    assert.match(out, /^ok /);
});

test('each case of a split message has its own section in docs/reference/messages.md', () => {
    const page = readFileSync('docs/reference/messages.md', 'utf8');
    for (const code of [255, 10255, 278, 10278, 1640, 11640, 21640, 20017, 30017, 20121, 50121, 30826, 50826, 11560, 21560, 11452, 21452])
        assert.ok(page.includes(`\n## E${code}\n`), `E${code} is missing`);
});
