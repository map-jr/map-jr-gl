// Which changed files need the browser jobs of the CI workflow (issue #1601).
//   node scripts/ci-paths.mjs < files.txt   prints "browser=true" or "browser=false" for the file names on stdin
//   node scripts/ci-paths.mjs --check       fails when a browser job reads a file under a path that NO_BROWSER skips
// The job "changes" of .github/workflows/ci.yml runs the first form with no install, so this file imports only node:.
import {readFileSync, existsSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Paths that no browser job reads. A changed file that matches none of them runs the browser jobs.
export const NO_BROWSER = [
    /^docs\//, /\.md$/, /^LICENSE/, /^\.github\/ISSUE_TEMPLATE\//,
    /^scripts\/agents\//, /^test\/types\//, /^test\/unit\//, /^test\/examples\.mjs$/,
    /^test\/conformance\/(?!render)/, /^website\//, /^\.github\/workflows\/(?!ci\.yml$)/, /^\.claude\//,
];
export const needsBrowser = files => files.some(f => f && !NO_BROWSER.some(re => re.test(f)));

const root = fileURLToPath(new URL('..', import.meta.url));

// The files that the browser jobs start from: the suites of the matrix of ci.yml, and what each job runs before them.
function roots() {
    const ci = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
    const part = ci.slice(ci.indexOf('browser-part:'), ci.indexOf('\n  browser:'));
    const suites = [...part.matchAll(/test\/[\w./-]+\.mjs/g)].map(m => m[0]);
    if (suites.length < 5) throw new Error(`[ci-paths] found ${suites.length} suites in the matrix of browser-part; the check cannot read ci.yml.`);
    return [...new Set([...suites, 'build.mjs', 'scripts/site.mjs', 'demo/serve.mjs', 'test/launch.mjs'])];
}

// Every file of the repository that a reached file names in a string, relative to itself or to the root. This is
// wider than the import graph on purpose: a suite that reads a fixture by its path counts too.
function reached() {
    const seen = new Set(), queue = roots();
    while (queue.length) {
        const rel = queue.pop();
        if (seen.has(rel)) continue;
        seen.add(rel);
        if (!/\.(m?[jt]s|html)$/.test(rel)) continue;
        const text = readFileSync(path.join(root, rel), 'utf8');
        for (const [, s] of text.matchAll(/['"`]([\w.@/-]*\.[a-z]{2,5})['"`]/g)) {
            for (const base of [path.dirname(rel), '.']) {
                const to = path.normalize(path.join(base, s.replace(/^\//, ''))).split(path.sep).join('/');
                if (to.startsWith('..') || /^(node_modules|dist|\.cache)\//.test(to)) continue;
                const abs = path.join(root, to);
                if (existsSync(abs) && statSync(abs).isFile()) queue.push(to);
            }
        }
    }
    return seen;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    if (process.argv.includes('--check')) {
        const files = reached(), bad = [...files].filter(f => !needsBrowser([f]));
        if (bad.length) {
            console.error(`[ci-paths] the browser jobs read these files, but NO_BROWSER in scripts/ci-paths.mjs skips them:\n  ${bad.join('\n  ')}\nRemove their path from NO_BROWSER.`);
            process.exit(1);
        }
        console.log(`ci-paths: the browser jobs read ${files.size} files, and none is under a path that NO_BROWSER skips`);
    } else {
        const files = readFileSync(0, 'utf8').split('\n').map(s => s.trim());
        console.log(`browser=${needsBrowser(files)}`);
    }
}
