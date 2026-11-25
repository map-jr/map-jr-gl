// Brings the current branch up to date with main by a merge (no rebase), and resolves the conflicts that are only in
// generated files (#1863).
//
//   node scripts/agents/merge-main.mjs [--from=<branch>]
//
// `--from` merges a local branch in place of origin/main, with no fetch; the script was tested this way.
//
// It fetches origin/main and merges it. For each file in conflict:
//   - a conflict inside a generated block of a Markdown file (`<!-- name:start -->` … `<!-- name:end -->`) takes the
//     block of main, and then the generator of that block writes it again from the merged files: `ref:` blocks by
//     `node scripts/reference.mjs --write`, `example:` and `file:` blocks by `node scripts/recipes.mjs --write`. The
//     other blocks (the status table of `pnpm status`, the sections of docs/ecosystem.md) keep the text of main, and
//     the script prints the command that writes them, which the coordinator runs once for a batch;
//   - docs/status.json takes the file of main, for the same reason;
//   - test/conformance/render-tests.json takes, for each test, the line that one side changed (#1915). Two branches that
//     move tests on adjacent lines conflict in git, but not here. A test that both sides changed to different statuses
//     is left for a person;
//   - test/conformance/render-result.json, which main no longer has, is removed;
//   - in package.json, a conflict of only the line of the script "test:render" takes the line of main: a branch from
//     before #1915 raised the floor `--min=N` there, which main no longer has.
// When that resolves every conflict, it commits the merge. Any other conflict stops it with a list of the files, and
// the merge stays in progress for you to finish by hand (`git merge --abort` undoes it).
//
// It merges with the logic of main (#1928): after the fetch, when the copy of this script on main differs from the copy
// that runs, it runs the copy of main instead (from its standard input, in this checkout). A branch whose copy is older
// than that runs the copy of main in the same way by hand:
//
//   git fetch origin main && git show origin/main:scripts/agents/merge-main.mjs | MERGE_MAIN_RUN=1 node --input-type=module -
//
// For that reason the script imports only modules of Node.js, and it finds the checkout by the working directory.
import {execFileSync, spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/** The blocks whose generator this script runs, by the name before the first ":" of the marker. */
export const generators = {ref: ['node', 'scripts/reference.mjs', '--write'], example: ['node', 'scripts/recipes.mjs', '--write'], file: ['node', 'scripts/recipes.mjs', '--write']};
/** The command that writes the other blocks, which the script leaves as they are on main. */
export const writtenBy = {status: 'pnpm status', sizes: 'pnpm status', speed: 'pnpm status', plugins: 'node test/conformance/plugins.mjs --write', maputnik: 'node test/conformance/maputnik.mjs --write', styles: 'node test/conformance/styles.mjs --write', examples: 'node test/conformance/examples.mjs --write'};

/**
 * Resolves the conflicts of a file whose conflicts are all inside generated blocks, by taking the side of main
 * ("theirs") of each. It returns `{text, blocks}`, with the names of the blocks of the conflicts, or null when a
 * conflict is outside a block or crosses the marker of one.
 */
export function resolveBlocks(text) {
    const lines = text.split('\n'), out = [], blocks = [];
    let open = null;
    const marker = line => /^<!-- ([\w.:/-]+):(start|end) -->$/.exec(line.trim());
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.startsWith('<<<<<<< ')) {
            const m = marker(line);
            if (m) open = m[2] === 'start' ? m[1] : null;
            out.push(line);
            continue;
        }
        // A conflict: "ours" up to ||||||| or =======, then the base (diff3), then "theirs" up to >>>>>>>.
        let j = i + 1, part = 'ours';
        const theirs = [];
        for (; j < lines.length && !lines[j].startsWith('>>>>>>> '); j++) {
            if (lines[j].startsWith('||||||| ')) { part = 'base'; continue; }
            if (lines[j] === '=======') { part = 'theirs'; continue; }
            if (marker(lines[j])) return null;
            if (part === 'theirs') theirs.push(lines[j]);
        }
        if (open === null || j === lines.length) return null;
        blocks.push(open);
        out.push(...theirs);
        i = j;
    }
    return {text: out.join('\n'), blocks};
}

/**
 * Merges three versions of render-tests.json (the texts of the base, of this branch and of main) test by test, and
 * returns the text in the format that render.mjs writes, or {conflicts} (one line for each test that has a different new
 * status on each side) when it cannot.
 */
export function mergeRenderTests(base, ours, theirs) {
    const [b, o, t] = [base, ours, theirs].map(text => JSON.parse(text));
    const out = {}, conflicts = [];
    for (const id of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(t)])) {
        const v = o[id] === b[id] ? t[id] : t[id] === b[id] || t[id] === o[id] ? o[id] : null;
        if (v === null) conflicts.push(`${id}: this branch has ${o[id] ?? 'no line'}, main has ${t[id] ?? 'no line'} (was ${b[id] ?? 'no line'})`);
        else if (v !== undefined) out[id] = v;
    }
    if (conflicts.length) return {conflicts};
    const ids = Object.keys(out).sort((x, y) => x < y ? -1 : x > y ? 1 : 0);
    return '{\n' + ids.map(id => `${JSON.stringify(id)}: ${JSON.stringify(out[id])}`).join(',\n') + '\n}\n';
}

/**
 * Resolves the conflicts of package.json that are only the line of the script "test:render", by taking the line of main.
 * It returns the text, or null when another conflict is left.
 */
export function resolvePackageJson(text) {
    const lines = text.split('\n'), out = [];
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('<<<<<<< ')) { out.push(lines[i]); continue; }
        const sides = {ours: [], base: [], theirs: []};
        let j = i + 1, part = 'ours';
        for (; j < lines.length && !lines[j].startsWith('>>>>>>> '); j++) {
            if (lines[j].startsWith('||||||| ')) part = 'base';
            else if (lines[j] === '=======') part = 'theirs';
            else sides[part].push(lines[j]);
        }
        const only = side => side.length === 1 && /^\s*"test:render": /.test(side[0]);
        if (j === lines.length || !only(sides.ours) || !only(sides.theirs)) return null;
        out.push(sides.theirs[0]);
        i = j;
    }
    return out.join('\n');
}

async function main() {
    if (process.argv.includes('--help')) { console.log('node scripts/agents/merge-main.mjs [--from=<branch>]'); return; }
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim() + '/';
    const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8'});
    const tryGit = (...args) => { try { git(...args); return true; } catch { return false; } };
    if (git('status', '--porcelain', '--untracked-files=no').trim()) { console.error('[merge-main] The working tree has changes. Commit them first.'); process.exit(2); }
    const from = process.argv.find(a => a.startsWith('--from='))?.slice(7) ?? 'origin/main';
    if (from === 'origin/main') git('fetch', 'origin', 'main');
    // The copy of main merges (#1928). It runs from its standard input, so that it is the same code whatever this branch has.
    if (!process.env.MERGE_MAIN_RUN) {
        let copy = '';
        try { copy = git('show', `${from}:scripts/agents/merge-main.mjs`); } catch { /* main has no copy */ }
        if (copy && copy !== readFileSync(fileURLToPath(import.meta.url), 'utf8')) {
            console.log(`[merge-main] Running the copy of this script that ${from} has.`);
            const r = spawnSync(process.execPath, ['--input-type=module', '-', ...process.argv.slice(2)], {cwd: root, input: copy, stdio: ['pipe', 'inherit', 'inherit'], env: {...process.env, MERGE_MAIN_RUN: '1'}});
            process.exit(r.status ?? 1);
        }
    }
    const head = git('rev-parse', 'HEAD');
    if (tryGit('merge', '--no-edit', from)) { console.log(`[merge-main] ${git('rev-parse', 'HEAD') === head ? 'Already up to date with' : 'Merged with no conflict:'} ${from}.`); return; }
    const conflicts = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
    const left = [], run = new Map(), notes = new Set();
    for (const file of conflicts) {
        if (file === 'docs/status.json') { git('checkout', '--theirs', '--', file); notes.add('pnpm status'); }
        // The totals are no longer committed (#1915): a branch from before that still changes the file loses it.
        else if (file === 'test/conformance/render-result.json') { git('rm', '-q', '--', file); console.log(`[merge-main] Removed ${file}, which main no longer has.`); continue; }
        else if (file === 'test/conformance/render-tests.json') {
            const merged = mergeRenderTests(...[1, 2, 3].map(stage => git('show', `:${stage}:${file}`)));
            if (typeof merged !== 'string') {
                console.error(`[merge-main] ${file}: these tests have a different new status on each side. Keep the status that CI gives:\n${merged.conflicts.map(c => '  ' + c).join('\n')}`);
                left.push(file); continue;
            }
            writeFileSync(root + file, merged);
        }
        else if (file === 'package.json') {
            const text = resolvePackageJson(readFileSync(root + file, 'utf8'));
            if (text === null) { left.push(file); continue; }
            writeFileSync(root + file, text);
        }
        else if (file.endsWith('.md')) {
            const r = resolveBlocks(readFileSync(root + file, 'utf8'));
            if (!r) { left.push(file); continue; }
            writeFileSync(root + file, r.text);
            for (const name of r.blocks) {
                const kind = name.split(':')[0];
                if (generators[kind]) run.set(generators[kind].join(' '), generators[kind]);
                else notes.add(writtenBy[kind] ?? `the generator of the block "${name}"`);
            }
        } else { left.push(file); continue; }
        git('add', '--', file);
        console.log(`[merge-main] Resolved the conflicts of ${file}.`);
    }
    if (left.length) {
        console.error(`[merge-main] These files have conflicts outside generated blocks. Resolve them, then \`git add\` them and \`git commit --no-edit\` (or \`git merge --abort\`):\n${left.map(f => '  ' + f).join('\n')}`);
        // The generated blocks that took the text of main are written again only after the merge is complete.
        for (const text of run.keys()) console.error(`[merge-main] Then run \`${text}\`, which writes the generated blocks that took the text of main, and commit the result.`);
        process.exit(1);
    }
    for (const [text, [cmd, ...args]] of run) {
        console.log(`[merge-main] Running ${text}`);
        execFileSync(cmd, args, {cwd: root, stdio: 'inherit'});
    }
    git('add', '-u');
    git('commit', '--no-edit');
    console.log(`[merge-main] Committed the merge of ${from}.`);
    for (const n of notes) console.log(`[merge-main] A block or file took the text of main. \`${n}\` writes it again; the coordinator runs it once for a batch.`);
    console.log('[merge-main] Check that `git diff origin/main...HEAD -- src` has only your lines.');
}

// MERGE_MAIN_RUN: the code comes from standard input, where `process.argv[1]` is not a file.
if (process.env.MERGE_MAIN_RUN || process.argv[1] === fileURLToPath(import.meta.url)) await main();
