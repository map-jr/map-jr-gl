// Formats the code of a fence for the site (#1250). The site shows each fence in two forms: the desktop form at 80
// columns, and the phone form at 38 columns, which fits a 390 px screen. A code block never wraps its lines.
// Prettier formats JavaScript, TypeScript, Vue and JSX; then a comment that is longer than the width is re-flowed
// onto several comment lines, also in Vue templates, HTML and shell. scripts/docs-lint.mjs uses the same code to
// check that the fences of docs/ are in the desktop form, and that no line of the phone form is longer than 38
// columns: a string or URL that nothing can break is the writer's to shorten.
import * as prettier from 'prettier';

export const desktopWidth = 80;
export const phoneWidth = 38;

// The style of the code in docs/.
const options = {tabWidth: 2, singleQuote: true, bracketSpacing: false, arrowParens: 'avoid', trailingComma: 'all'};

const parsers = {js: 'babel', javascript: 'babel', jsx: 'babel', ts: 'typescript', typescript: 'typescript', tsx: 'typescript', vue: 'vue'};

// The parser of Prettier for the language of a fence, or undefined when Prettier does not format that language.
export const parserOf = language => parsers[language?.toLowerCase()];

// The kinds of comment of each language whose comments the site re-flows.
const commentKinds = {js: 'js', javascript: 'js', jsx: 'js', ts: 'js', typescript: 'js', tsx: 'js', css: 'js', vue: 'vue', html: 'html', sh: 'sh', bash: 'sh', shell: 'sh', shellscript: 'sh', text: 'text', txt: 'text'};

// Whether the site formats the fences of the language.
export const formatsLanguage = language => !!commentKinds[language?.toLowerCase()];

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

// Re-flows each comment of a line that is longer than `width`. A comment after code goes on the lines above it.
export function reflowComments(code, language, width) {
    const base = commentKinds[language?.toLowerCase()];
    if (!base) return code;
    let inScript = false, inComment = false;
    return code.split('\n').flatMap(line => {
        let kind = base;
        if (base === 'vue') {
            if (/^\s*<script\b/.test(line)) inScript = true;
            kind = inScript || /^\s*<style\b/.test(line) ? 'js' : 'html';
            if (/^\s*<\/script>/.test(line)) inScript = false;
        }
        // A line inside an HTML comment that spans several lines wraps as text.
        const wasInComment = inComment;
        if (kind === 'html' || kind === 'vue') {
            if (inComment && line.includes('-->')) inComment = false;
            else if (!inComment && line.includes('<!--') && !line.includes('-->')) inComment = true;
        }
        if (line.length <= width) return [line];
        if (wasInComment && inComment) {
            const indent = line.match(/^\s*/)[0];
            return wrapWords(line.trim(), width - indent.length).map(part => indent + part);
        }
        const indent = line.match(/^\s*/)[0];
        // A plain text fence, such as a message of the library, wraps at the spaces.
        if (kind === 'text') return wrapWords(line.trim(), width - indent.length).map(part => indent + part);
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
    }).join('\n');
}

// The code at `width` columns, without the newline at the end, or undefined when the site does not format the
// language. Code that Prettier cannot parse keeps its lines, and only its comments are re-flowed.
export async function formatCode(code, language, width) {
    if (!formatsLanguage(language)) return undefined;
    return reflowComments(await prettierFormat(code, language, width) ?? code, language, width);
}

async function prettierFormat(code, language, width) {
    const parser = parserOf(language);
    if (!parser) return undefined;
    const format = async text => (await prettier.format(text, {...options, parser, printWidth: width})).replace(/\n$/, '');
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
        const ends = /;\s*$/m.test(code);
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
