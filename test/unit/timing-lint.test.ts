// The lint of new checks that compare a measured duration with a fixed number (#1930).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the scripts, without types)
import {addedLines, findings} from '../../scripts/timing-lint.mjs';

const text = [
    'const t0 = performance.now();',
    'await idle;',
    'out.none = Math.round(performance.now() - t0);',
    "check('a tile shows at once (#1694)',",
    '    out.none < 1000 && out.slow >= 1400, JSON.stringify(out));',
    "check('a count', n < 1000);",
].join('\n');

test('timing-lint: a new check with a measured duration under a fixed bound is named', () => {
    assert.deepEqual([...addedLines('@@ -10,0 +1,5 @@\n@@ -20 +6 @@\n')], [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(findings(text, new Set([1, 2, 3, 4, 5])), [{line: 4, name: 'a tile shows at once (#1694)', bound: 'out.none < 1000'}]);
});

test('timing-lint: a check that the branch does not add, or one without a measured time, gives no finding', () => {
    assert.deepEqual(findings(text, new Set([1, 2, 3])), []);
    assert.deepEqual(findings(text, new Set([6])), []);
});
