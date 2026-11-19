// Checks the user docs against the rules of docs/style-guide.md that a script can check.
// It reads docs/guide, docs/reference, docs/recipes and docs/migrate, prints one line for each finding, and exits
// with 0. With `--strict` it exits with 1 when there is a finding. Give paths to check only those files.
//
// Usage: node scripts/docs-lint.mjs [--strict] [file.md ...]
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const named = args.filter(a => !a.startsWith('--'));
const folders = ['guide', 'reference', 'recipes', 'migrate'];
const walk = dir => !existsSync(dir) ? [] : readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []);
const files = named.length ? named.map(f => path.resolve(f)) : folders.flatMap(f => walk(path.join(root, 'docs', f)));

/** The labels of the variants in the order of the style guide. */
const labels = ['Main API', 'MapLibre compat', 'Vue', 'Nuxt', 'React', 'Svelte', '<map-jr>'];
/** Patterns that the user docs do not contain, each with what to do. Checked outside code. */
const banned = [
    [/\b(?:src|scripts|test)\/[\w./-]+/, 'names a file of the repository. Say what the user sees.'],
    [/(?<![\w&/])#\d{2,}\b/, 'has an issue or pull request number. The issue has the history.'],
    [/\b[Cc]hecked:|\bseen in\b|\bmeasured\b/, 'gives a test log as evidence. State the fact.'],
    [/\b[Uu]p to version \d|\b[Bb]efore version \d|\bno longer exists\b/, 'tells history. CHANGELOG.md has it.'],
    [/\b\d+(?:\.\d+)? KB\b/, 'has a size in bytes. guide/size-and-speed.md is the home of sizes.'],
    [/\b(?:simply|blazing|obviously)\b/i, 'uses a word that the writing rules exclude.'],
];
const findings = [];

for (const file of files) {
    const rel = path.relative(root, file);
    const find = (line, what) => findings.push(`${rel}:${line + 1}: ${what}`);
    const lines = readFileSync(file, 'utf8').split('\n');
    const sizes = rel.endsWith(path.join('guide', 'size-and-speed.md'));
    let fence = false, h1 = 0, callouts = 0, lastCallout = -9, paragraph = [], paragraphStart = 0;
    let group = [], groupEnd = -9; // the labels of the fences that follow each other, and the line where the last one ended
    const endParagraph = () => {
        const words = paragraph.join(' ').split(/\s+/).filter(Boolean).length;
        if (words > 90) find(paragraphStart, `this paragraph has ${words} words. The limit is 90: split it, or make a list or a table.`);
        paragraph = [];
    };
    lines.forEach((line, i) => {
        const open = line.match(/^\s*(```+|~~~+)(.*)$/);
        if (open) {
            endParagraph();
            if (!fence) {
                const info = open[2].trim();
                if (!info) find(i, 'this code fence has no language.');
                const label = info.match(/\[(.+)\]\s*$/)?.[1];
                if (label !== undefined && !labels.includes(label)) find(i, `the label [${label}] is not a variant. The labels are ${labels.map(l => `[${l}]`).join(', ')}.`);
                // A fence continues a group when only blank lines stand between it and the fence before.
                if (label === undefined || lines.slice(groupEnd + 1, i).some(l => l.trim())) group = [];
                if (label !== undefined) {
                    if (group.length && labels.indexOf(label) <= labels.indexOf(group.at(-1))) find(i, `[${label}] comes after [${group.at(-1)}]. Keep the order of the style guide, each variant once.`);
                    group.push(label);
                }
            } else groupEnd = i;
            fence = !fence;
            return;
        }
        if (fence) return;
        const prose = line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
        for (const [pattern, what] of banned) {
            if (sizes && String(pattern).includes('KB')) continue;
            if (pattern.test(prose)) find(i, `"${prose.match(pattern)[0]}" ${what}`);
        }
        const heading = line.match(/^(#+)\s+(.*)$/);
        if (heading) {
            endParagraph();
            if (heading[1].length === 1) h1++;
            if (heading[1].length > 3) find(i, 'this heading is below the third level. Make it a list or a page.');
            if (/^(overview|introduction)$/i.test(heading[2].trim())) find(i, `the heading "${heading[2]}" names no task and no thing.`);
            return;
        }
        if (/^\s*\|/.test(line)) {
            endParagraph();
            if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return;
            // (A `\|` inside a cell is part of the cell, as in a union type.)
            for (const cell of line.replace(/\\\|/g, '\u0000').split('|').slice(1, -1)) {
                const text = cell.replace(/\u0000/g, '|').replace(/\]\([^)]*\)/g, ']').trim();
                if (text.length > 200) find(i, `a table cell has ${text.length} characters ("${text.slice(0, 40)}…"). The limit is 200: move the rest to a section.`);
            }
            return;
        }
        if (/^>\s*\*\*(Note|Warning|Tip|Important)\b|^>\s*\[!/.test(line)) {
            endParagraph();
            callouts++;
            if (lines.slice(lastCallout + 1, i).every(l => !l.trim() || l.startsWith('>'))) find(i, 'two callouts follow each other. Keep one.');
            lastCallout = i;
            return;
        }
        if (!line.trim() || /^\s*(?:[-*+]|\d+\.)\s|^>|^<!--/.test(line)) { endParagraph(); return; }
        if (!paragraph.length) paragraphStart = i;
        paragraph.push(line);
    });
    endParagraph();
    if (fence) find(lines.length - 1, 'a code fence is not closed.');
    if (h1 !== 1) find(0, `the page has ${h1} headings of the first level. It needs one.`);
    if (callouts > 2) find(0, `the page has ${callouts} callouts. The limit is two.`);
}

for (const f of findings) console.log(f);
console.log(`docs-lint: ${files.length} pages, ${findings.length} findings${strict ? '' : ' (warnings only; --strict fails)'}`);
if (strict && findings.length) process.exit(1);
