// Runs a command against the code without the fix:
//   node scripts/agents/without-fix.mjs [--base <ref>] [--paths <list>] [--no-build] -- <command> [<argument>...]
// For example:
//   node scripts/agents/without-fix.mjs -- node --experimental-transform-types --no-warnings --test test/unit/tiles.test.ts
//   node scripts/agents/without-fix.mjs -- node scripts/agents/suite.mjs test/host.mjs
//
// It makes a temporary git worktree in .cache/agents/ with the files of this checkout as they are now (committed or
// not, untracked files included), and then puts back the paths of --paths as they are at the point where this branch
// left --base (default: origin/main). The default of --paths is the source and the files that build it:
// src, build.mjs and scripts/private-names.mjs (a path that does not exist at that point is skipped). The tests, the
// fixtures and the other scripts stay as they are in this checkout. It runs the command there, with node_modules of
// this checkout, prints its exit code and removes the temporary worktree, also when the command fails or is
// interrupted. It does not change this checkout, and it does not use `git stash`.
//
// Before the command, it runs `pnpm build` in the copy, so that dist/ is the build without the fix (for example for
// `pnpm test:size`). --no-build skips that step. The folders of .cache/ that this checkout or the main checkout has
// (maplibre-gl-js for the render tests, fonts, styles and the others) are linked into the copy, not copied.
// The command and its arguments are passed to the program as they are, without a shell: `-- sh -c '...'` keeps
// its quoting.
import {spawn, execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2), dash = argv.indexOf('--');
const opt = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 && (dash < 0 || i < dash) ? argv[i + 1] : fallback; };
const command = dash >= 0 ? argv.slice(dash + 1) : [];
if (!command.length) {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport ')[0].replace(/^\/\/ ?/gm, ''));
    process.exit(2);
}
const git = (args, cwd = root) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
const base = opt('--base', 'origin/main'), build = !argv.slice(0, dash).includes('--no-build');
const fork = git(['merge-base', 'HEAD', base]);
const paths = opt('--paths', 'src,build.mjs,scripts/private-names.mjs').split(',').filter(p => git(['ls-tree', '--name-only', fork, '--', p]));
const quote = a => /^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;
const tmp = path.join(root, '.cache/agents', `without-fix-${process.pid}`);

let removed = false;
const remove = () => {
    if (removed) return;
    removed = true;
    try { git(['worktree', 'remove', '--force', tmp]); } catch { rmSync(tmp, {recursive: true, force: true}); try { git(['worktree', 'prune']); } catch {} }
};
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { remove(); console.error(`without-fix.mjs: stopped by ${sig}; the temporary worktree is removed.`); process.exit(130); });

mkdirSync(path.dirname(tmp), {recursive: true});
git(['worktree', 'add', '--detach', tmp, 'HEAD']);
let code = 1;
try {
    // The changes of this checkout that are not committed, staged or not (#1592): changed, added and untracked
    // files, and deleted files.
    const changed = [...git(['diff', '--name-only', '--no-renames', '-z', 'HEAD']).split('\0'), ...git(['ls-files', '-o', '--exclude-standard', '-z']).split('\0')];
    for (const f of new Set(changed.filter(Boolean))) {
        if (!existsSync(path.join(root, f)) || statSync(path.join(root, f)).isDirectory()) continue;
        mkdirSync(path.dirname(path.join(tmp, f)), {recursive: true});
        copyFileSync(path.join(root, f), path.join(tmp, f));
    }
    for (const f of git(['diff', '--name-only', '--no-renames', '--diff-filter=D', '-z', 'HEAD']).split('\0').filter(Boolean)) rmSync(path.join(tmp, f), {force: true});
    // The paths without the fix: the files of the fork point, and no file that the branch added.
    git(['checkout', fork, '--', ...paths], tmp);
    const atFork = new Set(git(['ls-tree', '-r', '--name-only', fork, '--', ...paths]).split('\n'));
    const walk = d => { for (const e of readdirSync(path.join(tmp, d), {withFileTypes: true})) { const f = path.posix.join(d, e.name); if (e.isDirectory()) walk(f); else if (!atFork.has(f)) rmSync(path.join(tmp, f)); } };
    for (const p of paths) if (existsSync(path.join(tmp, p)) && statSync(path.join(tmp, p)).isDirectory()) walk(p);
    symlinkSync(path.join(root, 'node_modules'), path.join(tmp, 'node_modules'));
    // The downloads of .cache/ (the render tests, fonts, styles): from this checkout, else from the main checkout.
    const main = path.dirname(path.resolve(root, git(['rev-parse', '--git-common-dir'])));
    const linked = [];
    for (const dir of [root, main].map(d => path.join(d, '.cache'))) {
        if (!existsSync(dir)) continue;
        for (const e of readdirSync(dir, {withFileTypes: true})) {
            const to = path.join(tmp, '.cache', e.name);
            if (!e.isDirectory() || e.name === 'agents' || existsSync(to)) continue;
            mkdirSync(path.dirname(to), {recursive: true});
            symlinkSync(path.join(dir, e.name), to);
            linked.push(e.name);
        }
    }
    console.log(`without-fix.mjs: .cache folders linked into the copy: ${linked.join(', ') || '(none)'}`);
    const taken = execFileSync('git', ['diff', '--stat', '--no-color', fork, '--', ...paths], {cwd: root, encoding: 'utf8'}).trim();
    console.log(`without-fix.mjs: ${paths.join(', ')} as at ${fork.slice(0, 9)} (where HEAD left ${base}). Taken out:\n${taken || '  (nothing: this checkout does not change these paths)'}`);
    const run = (cmd, args) => new Promise(resolve => spawn(cmd, args, {cwd: tmp, stdio: 'inherit'}).on('exit', c => resolve(c ?? 1)).on('error', e => { console.error(e.message); resolve(127); }));
    if (build) {
        console.log('without-fix.mjs: building the copy (pnpm build; --no-build skips this)');
        const b = await run('pnpm', ['build']);
        if (b) { console.log(`without-fix.mjs: the build without the fix failed with ${b}; the command did not run.`); code = b; throw null; }
    }
    console.log(`without-fix.mjs: running ${command.map(quote).join(' ')}`);
    code = await run(command[0], command.slice(1));
    console.log(`without-fix.mjs: without the fix, the command exited with ${code}.`);
} catch (e) {
    if (e !== null) throw e;
} finally {
    remove();
}
process.exit(code);
