// The merge script of the agents resolves conflicts inside generated blocks only (#1863).
import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error (a plain module of the agent tools, without types)
import {resolveBlocks, mergeRenderTests} from '../../scripts/agents/merge-main.mjs';

test('merge-main: a conflict inside a generated block takes the side of main', () => {
    const text = ['# Page', '<!-- ref:MapDescription:start -->', '| a |', '<<<<<<< HEAD', '| ours |', '||||||| base', '| base |', '=======', '| theirs |', '>>>>>>> origin/main', '<!-- ref:MapDescription:end -->', 'Text.'].join('\n');
    assert.deepEqual(resolveBlocks(text), {text: ['# Page', '<!-- ref:MapDescription:start -->', '| a |', '| theirs |', '<!-- ref:MapDescription:end -->', 'Text.'].join('\n'), blocks: ['ref:MapDescription']});
});

test('merge-main: a conflict outside a block, or across a marker, is left for a person', () => {
    assert.equal(resolveBlocks(['<!-- ref:A:start -->', '<!-- ref:A:end -->', '<<<<<<< HEAD', 'a', '=======', 'b', '>>>>>>> origin/main'].join('\n')), null);
    assert.equal(resolveBlocks(['<!-- status:start -->', '<<<<<<< HEAD', 'a', '<!-- status:end -->', '=======', 'b', '>>>>>>> origin/main', '<!-- status:end -->'].join('\n')), null);
});

test('merge-main: render-tests.json takes the line that each side changed, also on adjacent lines (#1915)', () => {
    const text = (o: Record<string, string>) => '{\n' + Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n';
    const base = {'a/1': 'near', 'a/2': 'near', 'a/3': 'differ'};
    assert.equal(mergeRenderTests(text(base), text({...base, 'a/1': 'match'}), text({...base, 'a/2': 'match', 'a/0': 'match'})),
        text({'a/0': 'match', 'a/1': 'match', 'a/2': 'match', 'a/3': 'differ'}));
    assert.deepEqual(mergeRenderTests(text(base), text({...base, 'a/1': 'match'}), text({...base, 'a/1': 'differ'})), {conflicts: ['a/1: this branch has match, main has differ (was near)']}, 'a test that both sides moved differently is left for a person');
});
