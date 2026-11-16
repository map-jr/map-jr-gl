// For the coordinator: the state of the checks of each open pull request, and of the last CI run on main.
//   node scripts/agents/prs.mjs           one line for each open pull request and one for main, then exits
//   node scripts/agents/prs.mjs --watch   the same lines once, and then one line each time the checks of a head (or
//                                          the CI run of a push to main) finish; it runs until it is stopped
// A line reads "#525 ci/519-browser-jobs 1a2b3c4d green", "... failed: browser-host, browser", "... running (3 of 8
// done)" or "... no checks". In --watch, a head that still has no checks after 5 minutes gets one line: GitHub can
// skip the event of a pull request, and closing and opening the pull request again starts CI.
// --repo owner/name selects another repository; --every <seconds> sets the interval of --watch (default 60).
// It needs `gh` with access to the repository.
import {execFileSync} from 'node:child_process';

const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const repo = opt('--repo', 'map-jr/map-jr-gl'), every = +opt('--every', 60) * 1000, watch = argv.includes('--watch');
const gh = args => JSON.parse(execFileSync('gh', [...args, '--repo', repo], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}));
const ok = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);

/** The state of a list of checks: running, green, failed (with the names) or none. */
function state(checks) {
    if (!checks.length) return {done: false, text: 'no checks'};
    const runs = checks.map(c => c.__typename === 'StatusContext'
        ? {name: c.context, done: c.state !== 'PENDING' && c.state !== 'EXPECTED', good: c.state === 'SUCCESS'}
        : {name: c.name, done: c.status === 'COMPLETED', good: ok.has(c.conclusion)});
    const finished = runs.filter(r => r.done).length;
    if (finished < runs.length) return {done: false, text: `running (${finished} of ${runs.length} done)`};
    const bad = [...new Set(runs.filter(r => !r.good).map(r => r.name))];
    return {done: true, text: bad.length ? `failed: ${bad.join(', ')}` : 'green'};
}

function read() {
    const lines = new Map();
    for (const pr of gh(['pr', 'list', '--state', 'open', '--limit', '100', '--json', 'number,headRefName,headRefOid,statusCheckRollup'])) {
        const s = state(pr.statusCheckRollup ?? []);
        lines.set(`#${pr.number} ${pr.headRefOid}`, {...s, line: `#${pr.number} ${pr.headRefName} ${pr.headRefOid.slice(0, 8)} ${s.text}`, empty: !pr.statusCheckRollup?.length});
    }
    const [run] = gh(['run', 'list', '--branch', 'main', '--workflow', 'CI', '--event', 'push', '--limit', '1', '--json', 'headSha,status,conclusion,databaseId']);
    if (run) {
        const done = run.status === 'completed';
        let text = done ? (run.conclusion === 'success' ? 'green' : run.conclusion) : 'running';
        if (done && run.conclusion !== 'success') {
            const jobs = gh(['run', 'view', String(run.databaseId), '--json', 'jobs']).jobs.filter(j => !['success', 'skipped'].includes(j.conclusion)).map(j => j.name);
            text = `failed: ${jobs.join(', ') || run.conclusion}`;
        }
        lines.set(`main ${run.headSha}`, {done, text, line: `main ${run.headSha.slice(0, 8)} CI ${text}`, empty: false});
    }
    return lines;
}

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
                console.log(`${stamp()} ${s.line} after 5 minutes: close and open the pull request again to start CI`);
            }
        }
        seen = now;
    }
}
