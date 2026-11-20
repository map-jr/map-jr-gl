// Formats the code of a fence for the site (#1250). The site shows each fence in two forms: the desktop form at 80
// columns, and the phone form at 38 columns, which fits a 390 px screen. A code block never wraps its lines.
// Prettier formats JavaScript, TypeScript, Vue and JSX; then a comment that is longer than the width is re-flowed
// onto several comment lines, also in Vue templates, HTML and shell. A text fence keeps its lines. scripts/docs-lint.mjs uses the same code to
// check that the fences of docs/ are in the desktop form, and that no line of the phone form is longer than 38
// columns: a string or URL that nothing can break is the writer's to shorten.
import * as prettier from 'prettier';
import * as sveltePlugin from 'prettier-plugin-svelte';

export const desktopWidth = 80;
export const phoneWidth = 38;

// The style of the code in docs/.
const options = {tabWidth: 2, singleQuote: true, bracketSpacing: false, arrowParens: 'avoid', trailingComma: 'all'};

const parsers = {js: 'babel', javascript: 'babel', jsx: 'babel', ts: 'typescript', typescript: 'typescript', tsx: 'typescript', vue: 'vue', css: 'css', html: 'html', json: 'json', svelte: 'svelte'};

// The parser of Prettier for the language of a fence, or undefined when Prettier does not format that language.
export const parserOf = language => parsers[language?.toLowerCase()];

// The kinds of comment of each language whose comments the site re-flows.
const commentKinds = {js: 'js', javascript: 'js', jsx: 'js', ts: 'js', typescript: 'js', tsx: 'js', css: 'js', vue: 'vue', svelte: 'vue', html: 'html', sh: 'sh', bash: 'sh', shell: 'sh', shellscript: 'sh', json: 'js'};

// Whether the site formats the fences of the language.
export const formatsLanguage = language => !!commentKinds[language?.toLowerCase()];

// The languages of fences that show text as it is, such as a message of the library that a user searches for. The
// site neither formats them nor checks their width.
const verbatim = new Set(['text', 'txt', 'console', 'output']);
export const isVerbatim = language => verbatim.has(language?.toLowerCase());

// Splits the text of a comment into lines of at most `room` columns, at the spaces. A URL takes a line of its own.
// A word that is longer than `room` stays whole.
function wrapWords(text, room) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        const url = /^<?https?:\/\//.test(word);
        if (line && (url || line.length + 1 + word.length > room)) { lines.push(line); line = ''; }
        line = line ? line + ' ' + word : word;
        if (url) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
}

// Where a comment starts in a line of code, outside strings: [index, marker], or undefined.
function commentStart(line, kind) {
    const markers = kind === 'sh' ? ['#'] : kind === 'html' ? ['<!--'] : ['//', '/*'];
    let quote = '';
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
        if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
        for (const marker of markers) {
            if (!line.startsWith(marker, i)) continue;
            // In shell, "#" starts a comment only at the start of a word; in JavaScript "//" after ":" is a URL.
            if (marker === '#' && i > 0 && !/\s/.test(line[i - 1])) continue;
            if (marker === '//' && line[i - 1] === ':') continue;
            return [i, marker];
        }
    }
    return undefined;
}

// The comment of a line as lines that fit `width`, at the indentation of `indent`.
function commentLines(indent, marker, text, width) {
    if (marker === '//' || marker === '#') return wrapWords(text, width - indent.length - marker.length - 1).map(part => `${indent}${marker} ${part}`);
    if (marker === '*') return wrapWords(text, width - indent.length - 2).map(part => `${indent}* ${part}`);
    if (marker === '/*') return [`${indent}/*`, ...wrapWords(text, width - indent.length - 3).map(part => `${indent} * ${part}`), `${indent} */`];
    return [`${indent}<!--`, ...wrapWords(text, width - indent.length - 2).map(part => `${indent}  ${part}`), `${indent}-->`];
}

// The paragraphs of the text of a comment that spans several lines (#1281). An empty line separates paragraphs. A line
// that starts with "-", "*", "+", "1." or "@" starts a list item, and the lines after it that are indented under its
// text continue it. Any other indented line keeps its form, as code in a comment does.
function paragraphs(texts) {
    const out = [];
    let current;
    for (const text of texts) {
        if (!text.trim()) { out.push({blank: true}); current = undefined; continue; }
        const item = /^([-*+]|\d+[.)]|@\S+)\s+/.exec(text);
        const lead = text.match(/^\s*/)[0].length;
        if (item) current = {prefix: item[1].startsWith('@') ? '' : item[0], words: [item[1].startsWith('@') ? text : text.slice(item[0].length)]};
        else if (lead && current?.prefix && lead >= current.prefix.length) { current.words.push(text); continue; }
        else if (lead) current = {pre: text};
        else if (current && !current.pre) { current.words.push(text); continue; }
        else current = {prefix: '', words: [text]};
        out.push(current);
        if (current.pre) current = undefined;
    }
    return out;
}

// The lines of the paragraphs at `room` columns of text, without markers; an empty string is an empty comment line.
function paragraphLines(paras, room) {
    return paras.flatMap(para => {
        if (para.blank) return [''];
        if (para.pre) return [para.pre];
        const pad = ' '.repeat(para.prefix.length);
        return wrapWords(para.words.join(' '), room - para.prefix.length).map((part, i) => (i ? pad : para.prefix) + part);
    });
}

// The comment that starts at line `i` and spans several lines, as {end, render(width)}, or undefined: consecutive
// lines of "//" or "#" at one indentation, a block of "/* */" or an HTML comment.
function commentGroup(lines, kinds, i) {
    const kind = kinds[i], line = lines[i];
    const lineMarker = kind === 'sh' ? '#' : kind === 'js' ? '//' : undefined;
    const pattern = lineMarker === '#' ? /^(\s*)#(?!!)( ?)(.*)$/ : /^(\s*)\/\/( ?)(.*)$/;
    const first = lineMarker && pattern.exec(line);
    if (first) {
        const texts = [];
        let end = i;
        for (let m; end < lines.length && kinds[end] === kind && (m = pattern.exec(lines[end])) && m[1] === first[1]; end++) texts.push(m[3]);
        if (end - i < 2) return undefined;
        const indent = first[1];
        return {end, render: width => paragraphLines(paragraphs(texts), width - indent.length - lineMarker.length - 1)
            .map(part => part ? `${indent}${lineMarker} ${part}` : `${indent}${lineMarker}`)};
    }
    const open = kind === 'js' ? /^(\s*)(\/\*\*?)(.*)$/.exec(line) : kind === 'html' ? /^(\s*)(<!--)(.*)$/.exec(line) : null;
    if (!open) return undefined;
    const close = open[2] === '<!--' ? '-->' : '*/';
    if (open[3].includes(close)) return undefined;
    let end = i + 1;
    while (end < lines.length && !lines[end].includes(close)) end++;
    // Code after the end of the comment keeps the comment as written.
    if (end >= lines.length || lines[end].indexOf(close) + close.length < lines[end].trimEnd().length) return undefined;
    const indent = open[1];
    const texts = [open[3].trim(), ...lines.slice(i + 1, end + 1).map((text, k, all) => {
        if (k === all.length - 1) text = text.slice(0, text.indexOf(close));
        if (close === '*/') return text.replace(/^\s*\*? ?/, '').trimEnd();
        // In an HTML comment, the lines are often aligned under the text after "<!--": the indentation is not text.
        return text.trim();
    })];
    while (texts.length && !texts[0].trim()) texts.shift();
    while (texts.length && !texts[texts.length - 1].trim()) texts.pop();
    return {end: end + 1, render: width => close === '*/'
        ? [`${indent}${open[2]}`, ...paragraphLines(paragraphs(texts), width - indent.length - 3).map(part => part ? `${indent} * ${part}` : `${indent} *`), `${indent} */`]
        : [`${indent}<!--`, ...paragraphLines(paragraphs(texts), width - indent.length - 2).map(part => part ? `${indent}  ${part}` : ''), `${indent}-->`]};
}

// Re-flows each comment that has a line longer than `width`. A comment that spans several lines is re-flowed as a
// whole, by paragraphs (#1281). A comment after code goes on the lines above it.
export function reflowComments(code, language, width) {
    const base = commentKinds[language?.toLowerCase()];
    if (!base) return code;
    const lines = code.split('\n');
    // In Vue, Svelte and HTML, the lines of a <script> or <style> element have the comments of JavaScript and CSS
    // (#1271). An element that opens and closes on one line, such as <script src="…"></script>, is markup.
    let inScript = false;
    const kinds = lines.map(line => {
        if (base !== 'vue' && base !== 'html') return base;
        const opens = /^\s*<(script|style)\b/.test(line), closes = /<\/(script|style)>/.test(line);
        if (opens && closes) return 'html';
        if (opens) { inScript = true; return 'html'; }
        if (closes && inScript) { inScript = false; return /^\s*<\//.test(line) ? 'html' : 'js'; }
        return inScript ? 'js' : 'html';
    });
    const out = [];
    for (let i = 0; i < lines.length;) {
        const group = commentGroup(lines, kinds, i);
        const own = group && lines.slice(i, group.end);
        if (group) out.push(...(own.some(line => line.length > width) ? group.render(width) : own));
        else out.push(...reflowLine(lines[i], kinds[i], width));
        i = group ? group.end : i + 1;
    }
    return out.join('\n');
}

// Re-flows the comment of one line that is longer than `width`.
function reflowLine(line, kind, width) {
    if (line.length <= width) return [line];
    const indent = line.match(/^\s*/)[0];
    // A line inside a block comment that starts with "*".
    const star = /^(\s*)\* (.*)$/.exec(line);
    if (kind === 'js' && star && !star[2].includes('*/')) return commentLines(star[1], '*', star[2], width);
    const start = commentStart(line, kind);
    if (!start) return [line];
    const [index, marker] = start;
    let text = line.slice(index + marker.length);
    if (marker === '/*' || marker === '<!--') {
        const end = marker === '/*' ? '*/' : '-->';
        if (!text.trimEnd().endsWith(end)) return [line];
        text = text.trimEnd().slice(0, -end.length);
    }
    const before = line.slice(0, index).trimEnd();
    return [...commentLines(indent, marker, text.trim(), width), ...(before.trim() ? [before] : [])];
}

// The code at `width` columns, without the newline at the end, or undefined when the site does not format the
// language. Code that Prettier cannot parse keeps its lines, and only its comments are re-flowed.
export async function formatCode(code, language, width) {
    if (!formatsLanguage(language)) return undefined;
    return reflowComments(await prettierFormat(code, language, width) ?? code, language, width);
}

// The code formatted by Prettier alone, or undefined when Prettier does not format the language or cannot parse it.
export async function prettierFormat(code, language, width) {
    const parser = parserOf(language);
    if (!parser) return undefined;
    // The JSON of an import map keeps its lines as written: a mapping to a long path can then put the path on a line
    // of its own, which Prettier would join.
    const maps = [];
    const hide = text => parser === 'html' ? text.replace(/(<script type="importmap">)([\s\S]*?)(<\/script>)/g, (_, open, body, close) => `${open}${close}<!--importmap-${maps.push(body) - 1}-->`) : text;
    const show = text => text.replace(/^(\s*)(<script type="importmap">)<\/script>\s*<!--importmap-(\d+)-->/gm, (_, indent, open, index) => `${indent}${open}${maps[index]}</script>`);
    const format = async text => show((await prettier.format(hide(text), {...options, parser, printWidth: width, plugins: [sveltePlugin]})).replace(/\n$/, ''));
    try {
        return await format(code);
    } catch {}
    // A list of signatures, as in the reference pages ("decodePNG(bytes: Uint8Array): Promise<…>"), parses as
    // declarations of functions.
    const declare = 'declare function ';
    // A signature can span several lines: the lines after its first are indented or start with ")" or "}".
    const starts = line => /^[A-Za-z_$][\w$]*\s*[(<]/.test(line);
    if (parser !== 'typescript' || !starts(code) || !code.split('\n').every(line => !line.trim() || starts(line) || /^[\s)}]/.test(line))) return undefined;
    try {
        const out = await format(code.split('\n').map(line => starts(line) ? declare + line : line).join('\n'));
        // Prettier ends each declaration with ";", which the signatures of the page do not have.
        const ends = /^\S.*;\s*$/m.test(code);
        return out.split('\n').map(line => line.startsWith(declare) ? line.slice(declare.length) : line)
            .map(line => ends || /^\s/.test(line) && !/^\)/.test(line.trim()) ? line : line.replace(/;$/, '')).join('\n');
    } catch {
        return undefined;
    }
}

// The tokens that no formatter can break: a string, a quoted attribute, a URL, or a regular expression.
const tokenPattern = /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`|https?:\/\/\S+|\/(?:[^/\\\n]|\\.)+\/[dgimsuy]*/g;

// Why a line of a form is too long for `width`, or undefined when it fits or when its overflow comes from one token
// that no formatter can break (#1250). On the desktop form (`strict`), such a token is accepted only when it is itself
// longer than the width.
export function overflowOf(line, width, strict = false) {
    if (line.length <= width) return undefined;
    const longest = Math.max(0, ...[...line.matchAll(tokenPattern)].map(match => match[0].length));
    if (strict ? longest > width : longest && line.length - longest <= width) return undefined;
    return `a line of ${line.length} columns, more than ${width}`;
}
