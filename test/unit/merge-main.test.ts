// The merge script of the agents resolves conflicts inside generated blocks only (#1863).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
// @ts-expect-error (a plain module of the agent tools, without types)
import {resolveBlocks, mergeRenderTests, resolvePackageJson} from '../../scripts/agents/merge-main.mjs';

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

test('merge-main: package.json takes the line "test:render" of main, and leaves any other conflict (#1928)', () => {
    const conflict = (o: string, t: string) => ['{', '  "scripts": {', '<<<<<<< HEAD', o, '=======', t, '>>>>>>> origin/main', '  }', '}'].join('\n');
    assert.equal(resolvePackageJson(conflict('    "test:render": "node test/conformance/render.mjs --min=1268"', '    "test:render": "node test/conformance/render.mjs"')),
        ['{', '  "scripts": {', '    "test:render": "node test/conformance/render.mjs"', '  }', '}'].join('\n'));
    assert.equal(resolvePackageJson(conflict('    "test:vue": "a"', '    "test:vue": "b"')), null);
});

test('merge-main: the copy of main runs from standard input and imports only modules of Node.js (#1928)', () => {
    const text = readFileSync(new URL('../../scripts/agents/merge-main.mjs', import.meta.url), 'utf8');
    assert.deepEqual([...text.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1]).filter(m => !m.startsWith('node:')), [], 'a relative import would read the files of the branch');
    const r = spawnSync(process.execPath, ['--input-type=module', '-', '--help'], {input: text, env: {...process.env, MERGE_MAIN_RUN: '1'}, encoding: 'utf8'});
    assert.equal(r.status, 0, r.stderr);
});
