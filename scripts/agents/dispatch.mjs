// For the hourly dispatcher (#2580; "The hourly dispatcher" in docs/agents/coordinating.md): one plan of what a fresh
// coordinator session does in its round.
//   node scripts/agents/dispatch.mjs          the plan in plain text
//   node scripts/agents/dispatch.mjs --json   the same plan as JSON
//   --repo owner/name selects another repository; --help prints this text.
// The plan has three parts:
// 1. Each open pull request: its head, the state of CI (from `headState` of prs.mjs), auto-merge on or off,
//    `mergeable_state`, its changed files and the action: "read the diff and turn on auto-merge" (green, auto-merge
//    off), "send the failure to its author" (red), "merge main" (`dirty`).
// 2. The cluster issues (an open issue whose body has a field `**Symptoms:**`) with the files of their `**Where:**`.
//    A cluster is ready when no open pull request names it and no open pull request changes one of its files. The
//    ready ones are listed oldest first, with the count that may start now: the share of CI (the number of pull
//    requests in CI that #2255 gives, else 8) minus the open pull requests.
// 3. The "Found" lines of the pull requests merged in the last day (the section or the line "Found" of the body)
//    that have no issue yet by a search of their title: candidates that the session files.
// It needs `gh` with access to the repository and uses only REST (`gh api`): GraphQL is blocked in cloud sessions.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {headState} from './prs.mjs';

const HELP = `Usage: node scripts/agents/dispatch.mjs [--json] [--repo owner/name] [--help]
Prints the plan of one round of the hourly dispatcher: the open pull requests with their action, the cluster issues
that are ready to start and how many may start now, and the "Found" lines of the last day that have no issue yet.`;

/** The paths of files in the field `**Where:**` of an issue body: each backticked word that looks like a path. */
export function whereFiles(body) {
    const m = /\*\*Where:\*\*([^\n]*(?:\n(?!\s*\*\*[A-Z][^*]*:\*\*)[^\n]*)*)/.exec(body ?? '');
    if (!m) return [];
    const files = new Set();
    for (const [, code] of m[1].matchAll(/`([^`\s]+)`/g)) {
        const path = code.replace(/:[\d,\-:]+$/, '');
        if (/^[\w.\-]+(\/[\w.\-]+)*\.[a-z]{1,5}$/i.test(path) && path.includes('/') && !path.startsWith('maplibre-gl')) files.add(path);
    }
    return [...files];
}

/** The cluster of an issue body: null when it has no field `**Symptoms:**`, else the numbers of its symptoms and its files. */
export function parseCluster(body) {
    const m = /\*\*Symptoms:\*\*([\s\S]*?)(?=\n\s*\*\*[A-Z][^*]*:\*\*|\n#+ |$)/.exec(body ?? '');
    if (!m) return null;
    const symptoms = [...m[1].matchAll(/^\s*[-*]\s*(?:\[.\]\s*)?#(\d+)/gm)].map(x => +x[1]);
    return {symptoms, files: whereFiles(body)};
}

/** The "Found" lines of a pull request body: the items under a heading "Found", or the line "- Found: a; b". */
export function foundLines(body) {
    const text = (body ?? '').replace(/\r/g, '');
    const lines = [];
    const section = /^#+\s*Found\s*\n([\s\S]*?)(?=^#+\s|(?![\s\S]))/m.exec(text);
    if (section) for (const l of section[1].split('\n')) { const t = l.replace(/^\s*[-*]\s*/, '').trim(); if (t && !/^<!--/.test(t)) lines.push(t); }
    const line = /^\s*[-*]?\s*\**Found\**:\**\s*(.*)$/m.exec(text);
    if (!section && line) {
        const items = [];
        // The line can go on with indented items on the next lines.
        const rest = text.slice(line.index + line[0].length).split('\n').slice(1);
        if (line[1].trim()) items.push(...line[1].split(/;\s+(?=[A-Z#])/));
        for (const l of rest) { if (!/^\s{2,}[-*]\s/.test(l)) break; items.push(l.replace(/^\s*[-*]\s*/, '')); }
        for (const t of items.map(s => s.trim())) if (t && !/^(none|nothing|no)\.?$/i.test(t)) lines.push(t);
    }
    return lines;
}

/** The title of a Found line: the text before the first `|`. */
export const foundTitle = line => line.split('|')[0].replace(/^Symptom of #\d+:\s*/, '').trim();

/** Whether a text names issue n (`#n` not followed by a digit). */
const names = (text, n) => new RegExp(`#${n}(?!\\d)`).test(text ?? '');

/**
 * The ready rule: a cluster is ready when no open pull request names it (title or body) and no open pull request
 * changes one of its files, and no older ready cluster has one of its files. `prs` are `{title, body, files}`; the result is the clusters with `ready` and `why`.
 */
export function readyClusters(clusters, prs) {
    return clusters.map(c => {
        const naming = prs.filter(p => names(p.title, c.number) || names(p.body, c.number)).map(p => p.number);
        const touching = prs.filter(p => c.files.some(f => p.files.includes(f))).map(p => p.number);
        const why = naming.length ? `named by #${naming.join(', #')}` : touching.length ? `files changed by #${touching.join(', #')}` : '';
        return {...c, ready: !why, why};
    }).sort((a, b) => a.created.localeCompare(b.created)).map((c, i, all) => {
        // Clusters that change the same file go one after the other: the older ready one goes first.
        const before = c.ready && all.slice(0, i).find(o => o.ready && o.files.some(f => c.files.includes(f)));
        return before ? {...c, ready: false, why: `shares files with #${before.number}`} : c;
    });
}

/** The share of CI over all coordinators from the body of the coordination issue, else 8. */
export function ciShare(body) {
    const words = {six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12};
    const m = /(\d+|six|seven|eight|nine|ten|twelve) pull requests in CI/i.exec(body ?? '');
    return m ? (words[m[1].toLowerCase()] ?? +m[1]) : 8;
}

/** The action of an open pull request. */
export function prAction(pr) {
    if (pr.mergeable_state === 'dirty') return 'merge main';
    if (pr.ci.startsWith('failed')) return 'send the failure to its author';
    if (pr.ci === 'green' && !pr.auto_merge) return 'read the diff and turn on auto-merge';
    if (pr.ci === 'green') return 'in the queue (auto-merge on)';
    return 'wait for CI';
}

function plan(repo) {
    const gh = path => JSON.parse(execFileSync('gh', ['api', path], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20}));
    const api = path => gh(`repos/${repo}/${path}`);
    const prs = api('pulls?state=open&per_page=100').map(p => {
        const one = api(`pulls/${p.number}`);
        const files = api(`pulls/${p.number}/files?per_page=100`).map(f => f.filename);
        const ci = headState(p.head.sha, api).text;
        const pr = {number: p.number, title: p.title, branch: p.head.ref, sha: p.head.sha, ci, auto_merge: !!p.auto_merge, mergeable_state: one.mergeable_state, files, body: p.body ?? ''};
        return {...pr, action: prAction(pr)};
    });
    const issues = [];
    for (let page = 1; page < 20; page++) {
        const batch = api(`issues?state=open&per_page=100&page=${page}`);
        issues.push(...batch.filter(i => !i.pull_request));
        if (batch.length < 100) break;
    }
    const clusters = issues.flatMap(i => { const c = parseCluster(i.body); return c ? [{number: i.number, title: i.title, created: i.created_at, ...c}] : []; });
    const ranked = readyClusters(clusters, prs);
    const share = ciShare(issues.find(i => i.number === 2255)?.body);
    const free = Math.max(0, share - prs.length);
    const since = new Date(Date.now() - 86400_000).toISOString();
    const merged = api('pulls?state=closed&sort=updated&direction=desc&per_page=100').filter(p => p.merged_at && p.merged_at >= since);
    const found = [];
    for (const p of merged) for (const line of foundLines(p.body)) {
        const title = foundTitle(line);
        if (!title) continue;
        const q = `repo:${repo} is:issue in:title "${title.replace(/["`]/g, '').slice(0, 120)}"`;
        const hits = gh(`search/issues?q=${encodeURIComponent(q)}&per_page=1`).total_count;
        if (!hits) found.push({pr: p.number, line});
    }
    return {prs: prs.map(({body, ...p}) => p), share, free, clusters: ranked, found};
}

function text(p) {
    const out = [`Open pull requests (${p.prs.length}):`];
    for (const r of p.prs) out.push(`  #${r.number} ${r.branch} ${r.sha.slice(0, 8)} ${r.ci.startsWith("CI") ? r.ci : `CI ${r.ci}`}; auto-merge ${r.auto_merge ? 'on' : 'off'}; ${r.mergeable_state}; ${r.files.length} files -> ${r.action}`);
    const ready = p.clusters.filter(c => c.ready);
    out.push('', `Cluster issues (${p.clusters.length}, ${ready.length} ready); share of CI ${p.share}, ${p.free} may start now:`);
    for (const c of ready) out.push(`  ready #${c.number} ${c.title} (${c.created.slice(0, 10)}; ${c.files.join(', ') || 'no files'})`);
    for (const c of p.clusters.filter(c => !c.ready)) out.push(`  held  #${c.number} ${c.title} (${c.why})`);
    out.push('', `Found lines of the last day with no issue (${p.found.length}):`);
    for (const f of p.found) out.push(`  #${f.pr}: ${f.line}`);
    return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) { console.log(HELP); process.exit(0); }
    const known = new Set(['--json', '--repo']);
    const bad = argv.filter((a, i) => a.startsWith('-') && !known.has(a) && argv[i - 1] !== '--repo');
    if (bad.length) { console.error(`dispatch.mjs: unknown option ${bad.join(' ')}\n${HELP}`); process.exit(2); }
    const i = argv.indexOf('--repo'), p = plan(i >= 0 ? argv[i + 1] : 'map-jr/map-jr-gl');
    console.log(argv.includes('--json') ? JSON.stringify(p, null, 2) : text(p));
}
