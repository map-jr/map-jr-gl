// Warns when a check that a branch adds to test/host.mjs or test/interact.mjs compares a measured duration with a fixed
// upper bound (#1930). Such a check passes on a fast machine and fails on a loaded CI runner: the check of #1895
// expected a tile "at once" (under 1000 ms) and measured 1060 ms and 1759 ms in CI. A check should wait for the value
// that it measures instead (docs/agents/worker-brief.md).
//
//   node scripts/timing-lint.mjs [--head=<ref>] [--base=<ref>]
//
// It reads the lines that the working tree (or `--head`) adds against its merge base with origin/main (or `--base`). A finding is a
// call `check(` with an added line whose condition has `<`, `<=` or `>` against a number of 100 or more, where an added
// line in the 80 lines before it takes the difference of `performance.now()` or `Date.now()`. It prints a warning
// for each finding and always exits with 0. Without origin/main (a shallow clone) it prints that it checked nothing.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const files = ['test/host.mjs', 'test/interact.mjs'];

/** The numbers (from 1) of the lines that a unified diff with `-U0` adds. */
export function addedLines(diff) {
    const out = new Set();
    for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
        const start = Number(m[1]), count = m[2] === undefined ? 1 : Number(m[2]);
        for (let i = 0; i < count; i++) out.add(start + i);
    }
    return out;
}

/** The findings `{line, name, bound}` in the text of a file, given the numbers of its added lines. */
export function findings(text, added) {
    const lines = text.split('\n'), out = [];
    const measures = i => /\b(?:performance|Date)\.now\(\)\s*-/.test(lines[i]);
    for (let i = 0; i < lines.length; i++) {
        if (!/(?:^|[^\w.])check\(/.test(lines[i])) continue;
        // The call: from `check(` to the line where its parentheses close (at most 12 lines).
        let call = '', depth = 0, j = i;
        for (; j < Math.min(lines.length, i + 12); j++) {
            const part = j === i ? lines[j].slice(lines[j].search(/check\(/)) : lines[j];
            call += part + '\n';
            for (const c of part.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')) depth += c === '(' ? 1 : c === ')' ? -1 : 0;
            if (depth <= 0) break;
        }
        let callAdded = false;
        for (let k = i; k <= j; k++) if (added.has(k + 1)) callAdded = true;
        if (!callAdded) continue;
        const condition = call.replace(/^check\(\s*(['"`])(?:\\.|(?!\1).)*\1\s*,/s, '').replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "''");
        const bound = /[\w.[\]]*[\w\])]\s*<=?\s*\d{3,}\b|\b\d{3,}\s*>=?\s*[\w(][\w.[\]]*/.exec(condition);
        if (!bound) continue;
        let timed = false;
        for (let k = Math.max(0, i - 80); k < i; k++) if (added.has(k + 1) && measures(k)) timed = true;
        if (!timed) continue;
        out.push({line: i + 1, name: /^check\(\s*(['"`])((?:\\.|(?!\1).)*)\1/s.exec(call)?.[2] ?? '(no name)', bound: bound[0].trim()});
    }
    return out;
}

function main() {
    const head = process.argv.find(a => a.startsWith('--head='))?.slice(7);
    const git = (...args) => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']});
    let base = process.argv.find(a => a.startsWith('--base='))?.slice(7);
    try { base ??= git('merge-base', 'origin/main', head ?? 'HEAD').trim(); } catch { console.log('timing-lint: no origin/main here; nothing checked.'); return; }
    let count = 0;
    for (const file of files) {
        const diff = git('diff', '-U0', base, ...(head ? [head] : []), '--', file);
        if (!diff) continue;
        const text = head ? git('show', `${head}:${file}`) : readFileSync(path.join(root, file), 'utf8');
        for (const f of findings(text, addedLines(diff))) {
            count++;
            console.warn(`timing-lint: warning: ${file}:${f.line}: the check "${f.name}" compares a measured duration with a fixed number (${f.bound}). A loaded CI runner can take longer: wait for the value that the check measures (docs/agents/worker-brief.md).`);
        }
    }
    console.log(`timing-lint: ${count} finding${count === 1 ? '' : 's'} in the lines that this branch adds to ${files.join(' and ')} (a warning; it does not fail).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
