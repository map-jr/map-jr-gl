// The check of where a markdown file of docs/ may be (#2252).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the scripts, without types)
import {misplaced} from '../../scripts/docs-places.mjs';

test('docs-places: the user docs, the notes for contributors and the three files for agents are in their place', () => {
    for (const file of ['guide/terrain.md', 'reference/map.md', 'recipes/pmtiles.md', 'migrate/prompt.md', 'development.md',
        'style-guide.md', 'ecosystem.md', 'development/error-codes.md', 'development/design/1740-globe-atmosphere.md',
        'agents/coordinating.md', 'agents/worker-brief.md', 'agents/subagent-models.md']) {
        assert.equal(misplaced(file), undefined, file);
    }
});

test('docs-places: a working document at the root of docs/ or in a new folder is named', () => {
    assert.match(misplaced('sky-and-fog.md'), /root of docs/);
    assert.match(misplaced('render-triage-globe.md'), /root of docs/);
    assert.match(misplaced('plans/next-batch.md'), /does not name/);
    assert.match(misplaced('development/notes/batch.md'), /does not name/);
});

test('docs-places: a design needs the number of its issue, and docs/agents/ takes no new file', () => {
    assert.match(misplaced('development/design/globe-atmosphere.md'), /number of its issue/);
    assert.match(misplaced('agents/handoff-2026-11-26.md'), /new file of docs\/agents/);
});
