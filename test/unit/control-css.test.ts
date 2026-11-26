// The style sheet of the controls is valid CSS in its braces (#639). A "}" too many made the browser drop the next rule,
// which gave touch screens 32px buttons instead of 44px.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_CSS} from '../../src/controls.ts';

test('the braces of CONTROL_CSS balance and never close more than they open', () => {
    // (Comments and strings can hold braces that do not count.)
    const text = CONTROL_CSS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/"[^"]*"/g, '""');
    let depth = 0;
    text.split('\n').forEach((line, i) => {
        for (const c of line) {
            if (c === '{') depth++;
            if (c === '}') depth--;
            assert.ok(depth >= 0, `line ${i + 1} of the sheet closes a brace that is not open: ${line.slice(0, 60)}`);
        }
    });
    assert.equal(depth, 0, 'the sheet leaves braces open');
});

test('CONTROL_CSS has no comments: they are comments of the script, which the page script does not carry (#2215)', () => {
    assert.ok(!CONTROL_CSS.includes('/*'), CONTROL_CSS.slice(CONTROL_CSS.indexOf('/*'), CONTROL_CSS.indexOf('/*') + 80));
});
