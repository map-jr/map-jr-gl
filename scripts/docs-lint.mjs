// Checks the user docs against the rules of docs/style-guide.md that a script can check.
// It reads docs/guide, docs/reference, docs/recipes and docs/migrate and prints one line for each finding. With `--strict`
// (as `pnpm test:consistency` runs it) it exits with 1 when there is a finding. Give paths to check only those files.
// It also checks that each relative link of a page leads to a file, and each anchor to a heading of that file.
//
// It warns about a JavaScript, TypeScript, Vue or JSX fence that is not formatted as Prettier formats it at 80
// columns (website/build/format.mjs, #1250); `--fix` formats those fences. These warnings do not fail `--strict`. It
// reports as an error a line of code that is longer than 38 columns on a phone or 80 on the desktop, unless one
// string, URL or regular expression makes it long (on the desktop, only when that token alone is longer). The
// check needs the packages of website/ (`pnpm install` in website/) and is left out without them.
//
// Usage: node scripts/docs-lint.mjs [--strict] [--fix] [file.md ...]
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
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

/** The labels of the variants and of the package managers, each set in the order of the style guide. */
const codeLabels = ['Map Jr', 'MapLibre', 'Vue', 'Nuxt', 'React', 'Svelte', '<map-jr>'];
const packageManagerLabels = ['npm', 'pnpm', 'yarn', 'bun'];
const labels = [...codeLabels, ...packageManagerLabels];
const setOf = label => codeLabels.includes(label) ? 'code' : 'pm';
/** Patterns that the user docs do not contain, each with what to do. Checked outside code. */
const banned = [
    [/\b(?:src|scripts|test)\/[\w./-]+/, 'names a file of the repository. Say what the user sees.'],
    [/(?<![\w&/])#\d{2,}\b/, 'has an issue or pull request number. The issue has the history.'],
    [/\b[Cc]hecked:|\bseen in\b|\bmeasured\b/, 'gives a test log as evidence. State the fact.'],
    [/\b[Uu]p to version \d|\b[Bb]efore version \d|\bno longer exists\b/, 'tells history. CHANGELOG.md has it.'],
    [/\b\d+(?:\.\d+)? KB\b/, 'has a size in bytes. guide/size-and-speed.md is the home of sizes.'],
    [/\b(?:simply|blazing|obviously)\b/i, 'uses a word that the writing rules exclude.'],
];
/** The variant that a line names (`**Vue**`, or **`<map-jr>`**), or undefined for any other line. */
const variantOf = line => { const name = line.trim().match(/^\*\*`?([^*`]+)`?\*\*$/)?.[1]; return labels.includes(name) ? name : undefined; };
/** The anchors that GitHub gives the headings of a markdown file. */
const anchorsOf = new Map();
const anchors = file => {
    if (!anchorsOf.has(file)) {
        const seen = new Map(), all = new Set();
        let fence = false;
        for (const line of readFileSync(file, 'utf8').split('\n')) {
            if (/^\s*(```|~~~)/.test(line)) fence = !fence;
            const text = !fence && line.match(/^#+\s+(.*)$/)?.[1];
            if (!text) continue;
            const slug = text.trim().toLowerCase().replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-'), n = seen.get(slug) ?? 0;
            seen.set(slug, n + 1);
            all.add(n ? `${slug}-${n}` : slug);
        }
        anchorsOf.set(file, all);
    }
    return anchorsOf.get(file);
};
const findings = [];

for (const file of files) {
    const rel = path.relative(root, file);
    const find = (line, what) => findings.push(`${rel}:${line + 1}: ${what}`);
    const lines = readFileSync(file, 'utf8').split('\n');
    const sizes = rel.endsWith(path.join('guide', 'size-and-speed.md'));
    let fence = false, h1 = 0, callouts = 0, lastCallout = -9, paragraph = [], paragraphStart = 0;
    // The code of the open fence with its language and its line, the `##` section, and whether an example block is open.
    let code = [], lang = '', fenceLine = 0, section = '', copied = false;
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
                code = []; lang = info.split(/\s/)[0]; fenceLine = i;
                if (!info) find(i, 'this code fence has no language.');
                const label = info.match(/\[(.+)\]\s*$/)?.[1];
                if (label !== undefined && !labels.includes(label)) find(i, `the label [${label}] is not a variant. The labels are ${labels.map(l => `[${l}]`).join(', ')}.`);
                // GitHub does not show the label of a fence, so a line with the label in bold stands directly before the
                // fence: `**Vue**`, and `<map-jr>` as code. A fence continues a group when only that line and blank
                // lines stand between it and the fence before.
                const between = lines.slice(groupEnd + 1, i).filter(l => l.trim());
                if (label === undefined || between.some(l => !variantOf(l))) group = [];
                if (label !== undefined) {
                    const name = variantOf(lines.slice(0, i).findLast(l => l.trim()) ?? '');
                    if (name !== label) find(i, `the line before this fence is not the name of its variant. Write **${label.startsWith('<') ? '`' + label + '`' : label}** on a line of its own before the fence, because GitHub does not show the label.`);
                    if (group.length && setOf(label) !== setOf(group.at(-1))) find(i, `[${label}] follows [${group.at(-1)}]. A group has the labels of one table of the style guide: put text between the two groups.`);
                    else if (group.length && labels.indexOf(label) <= labels.indexOf(group.at(-1))) find(i, `[${label}] comes after [${group.at(-1)}]. Keep the order of the style guide, each variant once.`);
                    group.push(label);
                }
            } else {
                groupEnd = i;
                // A block runs when it is pasted: it imports what it creates the map with, and it declares `map`.
                // The fragments under "Variations" of a recipe, the copied files of an example block and the signatures of a
                // reference block are not checked.
                const text = code.join('\n');
                if ((lang === 'js' || lang === 'ts') && !copied && section !== 'Variations') {
                    if (/\b(?:createMap|new Map)\(/.test(text) && !/^\s*import\s|\bawait import\(/m.test(text)) find(fenceLine, 'this block creates a map and has no import. Every block is complete: add the import.');
                    if (/\bmap\.\w/.test(text) && !/\b(?:const|let|var)\s+map\b/.test(text)) find(fenceLine, 'this block uses `map` and does not declare it. Every block is complete: create the map in the block.');
                }
            }
            fence = !fence;
            return;
        }
        if (fence) { code.push(line); return; }
        if (/^<!--\s*(?:example:[\w-]+|ref:[\w.]+):(start|end)\s*-->/.test(line)) copied = line.includes(':start');
        const prose = line.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
        for (const [pattern, what] of banned) {
            if (sizes && String(pattern).includes('KB')) continue;
            if (pattern.test(prose)) find(i, `"${prose.match(pattern)[0]}" ${what}`);
        }
        const heading = line.match(/^(#+)\s+(.*)$/);
        if (heading) {
            endParagraph();
            if (heading[1].length === 1) h1++;
            if (heading[1].length === 2) section = heading[2].trim();
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
            if (lastCallout >= 0 && lines.slice(lastCallout + 1, i).every(l => !l.trim() || l.startsWith('>'))) find(i, 'two callouts follow each other. Keep one.');
            lastCallout = i;
            return;
        }
        if (!line.trim() || variantOf(line) || /^\s*(?:[-*+]|\d+\.)\s|^>|^<!--/.test(line)) { endParagraph(); return; }
        if (!paragraph.length) paragraphStart = i;
        paragraph.push(line);
    });
    endParagraph();
    // A relative link leads to a file that exists, and its anchor to a heading of that file.
    lines.forEach((line, i) => {
        for (const [, target, anchor] of line.replace(/`[^`]*`/g, '').matchAll(/\]\((?!https?:|mailto:)([^)#\s]*)(?:#([^)\s]*))?\)/g)) {
            const to = target ? path.join(path.dirname(file), target) : file;
            if (!existsSync(to)) find(i, `the link to ${target} leads to no file.`);
            else if (anchor && to.endsWith('.md') && !anchors(to).has(anchor)) find(i, `the link to ${target}#${anchor} leads to no heading of that file.`);
        }
    });
    if (fence) find(lines.length - 1, 'a code fence is not closed.');
    if (h1 !== 1) find(0, `the page has ${h1} headings of the first level. It needs one.`);
    if (callouts > 2) find(0, `the page has ${callouts} callouts. The limit is two.`);
}

for (const f of findings) console.log(f);
console.log(`docs-lint: ${files.length} pages, ${findings.length} findings${strict ? '' : ' (warnings only; --strict fails)'}`);

// The format of the code.
const format = await import('../website/build/format.mjs').catch(() => undefined);
if (!format) {
    console.log('docs-lint: the format of the code is not checked, because website/ has no packages. Run pnpm install in website/.');
} else {
    const fix = args.includes('--fix');
    let unformatted = 0, tooLong = 0;
    for (const file of files) {
        const text = readFileSync(file, 'utf8');
        const parts = [];
        let last = 0;
        for (const match of text.matchAll(/^( *)```([\w-]*)([^\n]*)\n([\s\S]*?)^\1```$/gm)) {
            const [whole, indent, language, info, body] = match;
            const code = body.split('\n').map(line => line.slice(indent.length)).join('\n').replace(/\n$/, '');
            const at = text.slice(0, match.index).split('\n').length;
            // Both forms fit their width. A line on a phone may be longer only because of one string or URL, and a
            // line on the desktop only when that token alone is longer than 80 columns.
            // A text fence shows a message as it is: its lines are the writer's (#1271).
            if (format.isVerbatim(language)) continue;
            for (const [form, width, strictForm] of [['phone', format.phoneWidth, false], ['desktop', format.desktopWidth, true]]) {
                const lines = (await format.formatCode(code, language, width) ?? code).split('\n');
                // On a phone, a line of code that Prettier leaves long cannot be broken; only a comment can.
                const prettier = !strictForm && await format.prettierFormat(code, language, width) !== undefined;
                for (const line of lines) {
                    if (prettier && !/^\s*(\/\/|\/\*|\*|<!--|#)/.test(line)) continue;
                    const why = format.overflowOf(line, width, strictForm);
                    if (!why) continue;
                    tooLong++;
                    console.log(`${path.relative(root, file)}:${at}: error: the ${language || 'plain'} fence has ${why} on the ${form}. Shorten it: ${line.trim()}`);
                }
            }
            const formatted = await format.formatCode(code, language, format.desktopWidth);
            if (formatted === undefined || formatted === code) continue;
            unformatted++;
            if (!fix) console.log(`${path.relative(root, file)}:${at}: warning: the ${language} fence is not formatted at ${format.desktopWidth} columns.`);
            parts.push(text.slice(last, match.index), `${indent}\`\`\`${language}${info}\n${formatted.split('\n').map(line => line ? indent + line : line).join('\n')}\n${indent}\`\`\``);
            last = match.index + whole.length;
        }
        if (fix && parts.length) writeFileSync(file, parts.join('') + text.slice(last));
    }
    if (fix) console.log(`docs-lint: formatted ${unformatted} fences.`);
    else if (unformatted) console.log(`docs-lint: ${unformatted} fences are not formatted (warnings). node scripts/docs-lint.mjs --fix formats them.`);
    if (tooLong) {
        console.log(`docs-lint: ${tooLong} lines of code are too long for the phone or the desktop (errors).`);
        process.exitCode = 1;
    }
}
if (strict && findings.length) process.exit(1);
