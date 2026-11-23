// The callouts of the docs site (website/build/callouts.ts): a GitHub alert becomes a callout block of Nuxt UI.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {callouts} from '../../website/build/callouts.ts';
import {safeMarkdown} from '../../website/build/styles.ts';

test('a GitHub alert becomes a callout block with its text', () => {
    assert.equal(callouts('Text.\n\n> [!WARNING]\n> One sentence.\n> Two `code`.\n\nAfter.'),
        'Text.\n\n::warning\nOne sentence.\nTwo `code`.\n::\n\nAfter.');
    assert.equal(callouts('> [!NOTE]\n> A.'), '::note\nA.\n::');
    assert.equal(callouts('> [!TIP]\n> A.'), '::tip\nA.\n::');
});

test('an alert in a code fence, a plain quote and an unknown kind stay as they are', () => {
    const fenced = '```md\n> [!NOTE]\n> A.\n```';
    assert.equal(callouts(fenced), fenced);
    assert.equal(callouts('> A quote.'), '> A quote.');
    assert.equal(callouts('> [!OTHER]\n> A.'), '> [!OTHER]\n> A.');
});

test('an alert of another repository after safeMarkdown is a callout whose text stays escaped', () => {
    assert.equal(callouts(safeMarkdown('> [!NOTE]\n> ::x <b>')), '::note\n\\:\\:x &lt;b&gt;\n::');
});
