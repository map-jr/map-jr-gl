// The paragraphs of the codes of docs/reference/messages.md (#2484): scripts/message-paragraphs.mjs reads `// E<code>: <text>`.
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error a script without types
import {paragraphProblems, paragraphText, readParagraphs} from '../../scripts/message-paragraphs.mjs';

const known = (code: number) => code === 1 || code === 2;

test('a paragraph over two comment lines is joined with one space', () => {
    const p = readParagraphs([['a.ts', 'x();\n    // E1: First line,\n    // second line.\nraise();\n']]);
    assert.equal(paragraphText(p.get(1)[0]), 'First line, second line.');
    assert.deepEqual(paragraphProblems(p, known), []);
});

test('an empty // line ends a paragraph, and so does the next E<code> line', () => {
    const p = readParagraphs([['a.ts', '// E1: One.\n//\n// not part of it\n// E2: Two.\n// E3: Three.\n']]);
    assert.equal(paragraphText(p.get(1)[0]), 'One.');
    assert.equal(paragraphText(p.get(2)[0]), 'Two.');
});

test('a paragraph for an unknown code fails', () => {
    const p = readParagraphs([['a.ts', '// E99: Text.\n']]);
    assert.match(paragraphProblems(p, known)[0], /^a\.ts: the comment "\/\/ E99: \.\.\." is a paragraph for a code that no message of src\/ has/);
});

test('two paragraphs for one code fail', () => {
    const p = readParagraphs([['a.ts', '// E1: One.\n'], ['b.ts', '// E1: Again.\n']]);
    assert.deepEqual(paragraphProblems(p, known), ['E1 has 2 paragraphs (a.ts, b.ts). Keep one comment "// E1: ..." in src/.']);
});

test('an empty paragraph fails', () => {
    const p = readParagraphs([['a.ts', '// E2:\n']]);
    assert.match(paragraphProblems(p, known)[0], /^a\.ts: the comment "\/\/ E2:" has no text\./);
});
