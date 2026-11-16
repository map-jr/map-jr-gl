// Runs a command against the code without the fix: node scripts/agents/without-fix.mjs [--base <ref>] [--paths <list>] -- <command>
// For example:
//   node scripts/agents/without-fix.mjs -- node --experimental-transform-types --no-warnings --test test/unit/tiles.test.ts
//   node scripts/agents/without-fix.mjs -- node scripts/agents/suite.mjs test/host.mjs
//
// It makes a temporary git worktree in .cache/agents/ with the files of this checkout as they are now (committed or
// not, untracked files included), and then puts back the paths of --paths (default: src) as they are at the point
// where this branch left --base (default: origin/main). The tests, the fixtures and the scripts stay as they are in
// this checkout. It runs the command there, with node_modules of this checkout, prints its exit code and removes the
// temporary worktree, also when the command fails or is interrupted. It does not change this checkout, and it does
// not use `git stash`.
//
// The temporary worktree has no dist/: a command that needs the built files builds them (suite.mjs does).
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
const base = opt('--base', 'origin/main'), paths = opt('--paths', 'src').split(',');
const fork = git(['merge-base', 'HEAD', base]);
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
    // The changes of this checkout that are not committed: changed and untracked files, and deleted files.
    for (const f of git(['ls-files', '-m', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean)) {
        if (!existsSync(path.join(root, f)) || statSync(path.join(root, f)).isDirectory()) continue;
        mkdirSync(path.dirname(path.join(tmp, f)), {recursive: true});
        copyFileSync(path.join(root, f), path.join(tmp, f));
    }
    for (const f of git(['ls-files', '-d', '-z']).split('\0').filter(Boolean)) rmSync(path.join(tmp, f), {force: true});
    // The paths without the fix: the files of the fork point, and no file that the branch added.
    git(['checkout', fork, '--', ...paths], tmp);
    const atFork = new Set(git(['ls-tree', '-r', '--name-only', fork, '--', ...paths]).split('\n'));
    const walk = d => { for (const e of readdirSync(path.join(tmp, d), {withFileTypes: true})) { const f = path.posix.join(d, e.name); if (e.isDirectory()) walk(f); else if (!atFork.has(f)) rmSync(path.join(tmp, f)); } };
    for (const p of paths) if (existsSync(path.join(tmp, p)) && statSync(path.join(tmp, p)).isDirectory()) walk(p);
    symlinkSync(path.join(root, 'node_modules'), path.join(tmp, 'node_modules'));
    const taken = execFileSync('git', ['diff', '--stat', '--no-color', fork, '--', ...paths], {cwd: root, encoding: 'utf8'}).trim();
    console.log(`without-fix.mjs: ${paths.join(', ')} as at ${fork.slice(0, 9)} (where HEAD left ${base}). Taken out:\n${taken || '  (nothing: this checkout does not change these paths)'}`);
    console.log(`without-fix.mjs: running ${command.join(' ')}`);
    code = await new Promise(resolve => spawn(command[0], command.slice(1), {cwd: tmp, stdio: 'inherit'}).on('exit', c => resolve(c ?? 1)).on('error', e => { console.error(e.message); resolve(127); }));
    console.log(`without-fix.mjs: without the fix, the command exited with ${code}.`);
} finally {
    remove();
}
process.exit(code);
