// The merge script of the agents resolves conflicts inside generated blocks only (#1863).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the agent tools, without types)
import {resolveBlocks} from '../../scripts/agents/merge-main.mjs';

test('merge-main: a conflict inside a generated block takes the side of main', () => {
    const text = ['# Page', '<!-- ref:MapDescription:start -->', '| a |', '<<<<<<< HEAD', '| ours |', '||||||| base', '| base |', '=======', '| theirs |', '>>>>>>> origin/main', '<!-- ref:MapDescription:end -->', 'Text.'].join('\n');
    assert.deepEqual(resolveBlocks(text), {text: ['# Page', '<!-- ref:MapDescription:start -->', '| a |', '| theirs |', '<!-- ref:MapDescription:end -->', 'Text.'].join('\n'), blocks: ['ref:MapDescription']});
});

test('merge-main: a conflict outside a block, or across a marker, is left for a person', () => {
    assert.equal(resolveBlocks(['<!-- ref:A:start -->', '<!-- ref:A:end -->', '<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> origin/main'].join('\n')), null);
    assert.equal(resolveBlocks(['<!-- status:start -->', '<<<<<<< HEAD', 'a', '<!-- status:end -->', '=======', 'b', '>>>>>>> origin/main', '<!-- status:end -->'].join('\n')), null);
});
