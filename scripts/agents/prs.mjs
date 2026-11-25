// For the coordinator: the state of the checks of each open pull request, and of the last CI run on main.
//   node scripts/agents/prs.mjs           one line for each open pull request and one for main, then exits
//   node scripts/agents/prs.mjs --watch   the same lines once, and then one line each time the CI run of a head (or
//                                          the CI run of a push to main) finishes; it runs until it is stopped
// A head is green only when the latest run of the workflow `CI` for it has the jobs that gate a merge (`checks`,
// `render` and the `browser-*` jobs, or their skip) and each of its jobs has passed or was skipped. The summary job
// `browser` does not count (#1602), and other workflows (`Docs site`) never make a head green (#2052).
// A line reads "#525 ci/519-browser-jobs 1a2b3c4d green", "... failed: browser-host-main", "... CI pending (3 of 6
// jobs done)" or "... CI pending (no run yet)". In --watch, a head that still has no CI run after 5 minutes gets one
// line "... CI missing": GitHub can skip the event of a pull request, and closing and opening the pull request again
// starts CI.
// --repo owner/name selects another repository; --every <seconds> sets the interval of --watch (default 60).
// It needs `gh` with access to the repository, and uses only its REST calls, so it also runs in a cloud session.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const repo = opt('--repo', 'map-jr/map-jr-gl'), every = +opt('--every', 60) * 1000, watch = argv.includes('--watch');
// Only REST (`gh api`): GraphQL, which `gh pr list` and `gh run list` use, is blocked in cloud sessions (#1404).
const api = path => JSON.parse(execFileSync('gh', ['api', `repos/${repo}/${path}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20}));
const ok = new Set(['success', 'skipped', 'neutral']), summary = 'browser';
// The jobs of CI that gate a merge (CLAUDE.md, "Branches, pull requests and merging"); `browser-` is a prefix.
const gates = ['checks', 'browser-', 'render'];

/**
 * The state of the CI run of a pull request head: pending, green or failed (with the names of the jobs). `api(path)`
 * answers a REST path of the repository; the unit test passes fixed answers.
 */
export function headState(sha, api) {
    // The newest run first; a run started again keeps its id, and the jobs of its latest attempt are listed.
    const [run] = api(`actions/workflows/ci.yml/runs?event=pull_request&head_sha=${sha}&per_page=5`).workflow_runs ?? [];
    if (!run) return {done: false, empty: true, text: 'CI pending (no run yet)'};
    // The summary job `browser` waits minutes for a runner after its parts; the owner merges on the parts (#1602).
    const jobs = api(`actions/runs/${run.id}/jobs?per_page=100`).jobs.filter(j => j.name !== summary);
    const missing = gates.filter(g => !jobs.some(j => g.endsWith('-') ? j.name.startsWith(g) : j.name === g)).map(g => g.endsWith('-') ? `${g}*` : g);
    const finished = jobs.filter(j => j.status === 'completed').length;
    // A queued run can list no jobs yet, or only some: it is pending until each job that gates a merge has finished.
    if (run.status !== 'completed' && (missing.length || finished < jobs.length))
        return {done: false, empty: false, text: `CI pending (${finished} of ${Math.max(jobs.length, finished + missing.length)} jobs done)`};
    const bad = [...missing, ...new Set(jobs.filter(j => !ok.has(j.conclusion)).map(j => j.name))];
    return {done: true, empty: false, text: bad.length ? `failed: ${bad.join(', ')}` : 'green'};
}

function read() {
    const lines = new Map();
    for (const pr of api('pulls?state=open&per_page=100')) {
        const sha = pr.head.sha, head = `#${pr.number} ${pr.head.ref} ${sha.slice(0, 8)}`, s = headState(sha, api);
        lines.set(`#${pr.number} ${sha}`, {...s, head, line: `${head} ${s.text}`});
    }
    const [run] = api('actions/workflows/ci.yml/runs?branch=main&event=push&per_page=1').workflow_runs;
    if (run) {
        const done = run.status === 'completed';
        let text = done ? (run.conclusion === 'success' ? 'green' : run.conclusion) : 'running';
        if (done && run.conclusion !== 'success') {
            const jobs = api(`actions/runs/${run.id}/jobs?per_page=100`).jobs.filter(j => !['success', 'skipped'].includes(j.conclusion)).map(j => j.name);
            text = `failed: ${jobs.join(', ') || run.conclusion}`;
        }
        lines.set(`main ${run.head_sha}`, {done, text, head: `main ${run.head_sha.slice(0, 8)}`, line: `main ${run.head_sha.slice(0, 8)} CI ${text}`, empty: false});
    }
    return lines;
}

async function main() {
    const stamp = () => new Date().toTimeString().slice(0, 5);
    let seen = read();
    for (const {line} of seen.values()) console.log(watch ? `${stamp()} ${line}` : line);
    if (watch) {
        const first = new Map([...seen.keys()].map(k => [k, Date.now()])), warned = new Set();
        for (;;) {
            await new Promise(r => setTimeout(r, every));
            let now;
            try { now = read(); } catch (e) { console.log(`${stamp()} gh failed: ${String(e.message).split('\n')[0]}`); continue; }
            for (const [key, s] of now) {
                const before = seen.get(key);
                if (!first.has(key)) first.set(key, Date.now());
                if (s.done && !before?.done) console.log(`${stamp()} ${s.line}`);
                else if (!before) console.log(`${stamp()} ${s.line} (new head)`);
                if (s.empty && !warned.has(key) && Date.now() - first.get(key) > 5 * 60_000) {
                    warned.add(key);
                    console.log(`${stamp()} ${s.head} CI missing after 5 minutes: close and open the pull request again to start CI`);
                }
            }
            seen = now;
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
