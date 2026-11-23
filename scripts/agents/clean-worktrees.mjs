// Removes the worktrees of agents that are done: node scripts/agents/clean-worktrees.mjs [--apply] [--no-fetch]
//
// Without --apply it is a dry run: it changes nothing and prints what it would remove and what it keeps, and why.
// It looks only at worktrees under .claude/worktrees/ of the main checkout. It removes a worktree only when all of
// these are true, and then deletes its local branch:
// - the worktree is not the checkout that runs this script;
// - it is not locked (`git worktree list --porcelain` shows "locked" for a worktree that an agent of a live session
//   holds);
// - it has no changed and no untracked files (`git status --porcelain` is empty; ignored files such as
//   node_modules and dist do not count);
// - its commit is in origin/main, or it is the head of a merged pull request or an ancestor of one (a squash merge
//   leaves the commits of the branch out of main).
// A worktree whose folder no longer exists is pruned (`git worktree prune`). It fetches origin/main first, and reads
// the merged pull requests with `gh api` (REST); without `gh` only the test "in origin/main" applies.
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';

const apply = process.argv.includes('--apply');
const run = (cmd, args, cwd) => execFileSync(cmd, args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
const git = (args, cwd) => run('git', args, cwd);
const tryGit = (args, cwd) => { try { git(args, cwd); return true; } catch { return false; } };

const here = git(['rev-parse', '--show-toplevel']);
const list = git(['worktree', 'list', '--porcelain']).split('\n\n').map(block => {
    const e = {};
    for (const line of block.split('\n')) { const [k, ...v] = line.split(' '); e[k] = v.join(' '); }
    return e;
}).filter(e => e.worktree);
const main = list[0].worktree, dir = path.join(main, '.claude/worktrees') + path.sep;
if (!process.argv.includes('--no-fetch')) { try { git(['fetch', '-q', 'origin', 'main'], main); } catch { console.log('could not fetch origin/main; using the local copy'); } }

let merged = [];
// Through the REST API, because some sessions (Claude Code in the cloud) cannot use GraphQL, which `gh pr list` needs.
try {
    merged = run('gh', ['api', '--paginate', 'repos/{owner}/{repo}/pulls?state=closed&per_page=100',
        '--jq', '.[] | select(.merged_at) | {number, headRefOid: .head.sha}'], main).split('\n').filter(Boolean).map(l => JSON.parse(l));
}
catch { console.log('could not read the merged pull requests with gh: only commits in origin/main count as done'); }
const known = sha => tryGit(['cat-file', '-e', sha + '^{commit}'], main);
const mergedHeads = merged.filter(p => known(p.headRefOid));

/** Why the commit is done, or undefined. */
function done(sha) {
    if (tryGit(['merge-base', '--is-ancestor', sha, 'origin/main'], main)) return 'in origin/main';
    const pr = merged.find(p => p.headRefOid === sha) ?? mergedHeads.find(p => tryGit(['merge-base', '--is-ancestor', sha, p.headRefOid], main));
    return pr && `in merged pull request #${pr.number}`;
}

const remove = [], keep = [];
let prune = 0;
for (const w of list.slice(1)) {
    if (!w.worktree.startsWith(dir)) continue;
    const name = path.relative(main, w.worktree), branch = w.branch?.replace('refs/heads/', '');
    const say = why => keep.push(`keep    ${name}${branch ? ` (${branch})` : ''}: ${why}`);
    if ('prunable' in w || !existsSync(w.worktree)) { prune++; continue; }
    if (path.resolve(w.worktree) === path.resolve(here)) { say('this is the checkout that runs the script'); continue; }
    if ('locked' in w) {
        // (The lock of an agent names the process of its session. When that process has ended, the lock is left over,
        // and the owner can release it; the script never does.)
        const pid = +(w.locked.match(/\bpid (\d+)/)?.[1] ?? 0);
        let alive = true;
        if (pid) { try { process.kill(pid, 0); } catch (e) { alive = e.code === 'EPERM'; } }
        say(alive ? `locked: an agent of a live session holds it (${w.locked || 'no reason given'})`
            : `locked by the process ${pid}, which has ended; if its session is over, \`git worktree unlock ${name}\` and run this again`);
        continue;
    }
    let changed;
    try { changed = git(['status', '--porcelain'], w.worktree).split('\n').filter(Boolean).length; } catch (e) { say(`git status failed: ${String(e.message).split('\n')[0]}`); continue; }
    if (changed) { say(`${changed} changed or untracked files`); continue; }
    const why = done(w.HEAD);
    if (!why) { say(`its commit ${w.HEAD.slice(0, 9)} is not in origin/main or in a merged pull request`); continue; }
    remove.push({...w, name, branch, why});
}

// The space that the removal frees (one `du` for all, so that files hard-linked between worktrees count once).
let size = '';
if (remove.length) { try { size = `, about ${(+run('du', ['-sck', ...remove.map(w => w.worktree)]).split('\n').pop().split('\t')[0] / 1048576).toFixed(1)} GB`; } catch {} }

for (const line of keep) console.log(line);
for (const w of remove) {
    const what = `${w.name}${w.branch ? ` and the branch ${w.branch}` : ''}: ${w.why}`;
    if (!apply) { console.log(`remove  ${what}`); continue; }
    try {
        git(['worktree', 'remove', w.worktree], main); // (without --force: git refuses a worktree with changes)
        if (w.branch && w.branch !== 'main') git(['branch', '-D', w.branch], main);
        console.log(`removed ${what}`);
    } catch (e) { console.log(`failed  ${w.name}: ${String(e.message).split('\n')[0]}`); }
}
if (prune) { if (apply) git(['worktree', 'prune'], main); console.log(`${apply ? 'pruned' : 'prune  '} ${prune} worktrees whose folder no longer exists`); }
console.log(`${apply ? 'Removed' : 'Would remove'} ${remove.length} worktrees${size}, kept ${keep.length}.${apply ? '' : ' This was a dry run: add --apply to remove them.'}`);
