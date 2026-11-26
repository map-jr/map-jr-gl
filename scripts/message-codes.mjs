// A build step for the production files (#2148, step 2; docs/development/error-codes.md): each message of src/ keeps its
// code and the values that it fills in, and its text is replaced with the link to the page of the code.
//
//   `[map-jr-gl] E1163 the request for the ${what} ${url} failed: ${reason}`
//   becomes `[map-jr-gl] E1163 https://map-jr.org/e/1163 ${what} ${url} ${reason}`
//
// A text with a code is a string or a template whose text starts with `E<n> `, after the prefix `[map-jr-gl] ` when it
// has one (the helpers `warnOnce`, `refused` and others add the prefix). Each value of a template stays, in its order, with
// a space before it, and a `? :` that chooses between two texts goes. When the text is the left end of a `+` chain, the
// other pieces of text of the chain go too, and its values stay in the same way. A message whose code is added at run time is changed where it is built: `reject()` and
// `complete()` of src/host.ts (see `special`). The message of src/host.ts that puts the name of a method before the code
// (`[map-jr-gl] getClusterLeaves(): E217 ...`) builds on a text with a code, so it needs nothing here.
//
// The development build, the standalone files and server.js do not use this step: they keep the full texts.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import MagicString from 'magic-string';

const {parseAst} = await import(pathToFileURL(createRequire(createRequire(import.meta.url).resolve('vite')).resolve('rolldown/parseAst')).href);

export const LINK = 'https://map-jr.org/e/';
const CODED = /^(\[map-jr-gl\] )?E(\d+) /;

/** The places where the source adds the code at run time: [file, text in src/, text in production]. The build stops when one is missing. */
const special = [
    ['host.ts', "() => '[map-jr-gl] E' + code + ' ' + short)", `() => '[map-jr-gl] E' + code + ' ${LINK}' + code)`],
    // (The text `fix` of each call of complete() goes, so the message ends with the name of the method.)
    ['host.ts', '`[map-jr-gl] E57 ${method}(): the description has no "style". ${fix}`', `\`[map-jr-gl] E57 ${LINK}57 \${method}\``],
];

const isText = n => n && (n.type === 'Literal' && typeof n.value === 'string' || n.type === 'TemplateLiteral');
const textOf = n => n.type === 'Literal' ? n.value : n.quasis[0].value.cooked ?? '';
const walk = (node, fn, parent = null) => {
    if (!node || typeof node.type !== 'string') return;
    fn(node, parent);
    for (const key in node) {
        const v = node[key];
        if (Array.isArray(v)) for (const c of v) walk(c, fn, node); else if (v && typeof v.type === 'string' && key !== 'parent') walk(v, fn, node);
    }
};

/** The edits of one file of src/: [start, end, text]. */
function shortenMessages(code, file) {
    const ast = parseAst(code, {lang: 'ts'}, file), edits = [], parents = new Map();
    walk(ast, (n, parent) => parents.set(n, parent));
    const src = n => code.slice(n.start, n.end);
    /** A piece of text with no value (a string, or a template with no `${}`). */
    const plainText = n => n.type === 'Literal' && typeof n.value === 'string' || n.type === 'TemplateLiteral' && !n.expressions.length
        || n.type === 'ParenthesizedExpression' && plainText(n.expression);
    /** A `? :` that chooses between two texts: a piece of text, not a value. */
    const choice = n => n.type === 'ConditionalExpression' && plainText(n.consequent) && plainText(n.alternate);
    /** The values of the pieces of a `+` chain or a template, as source: the text of each piece goes, and so does a `? :` of two texts. */
    const values = n => {
        if (n.type === 'Literal') return [];
        if (n.type === 'TemplateLiteral') return n.expressions.filter(e => !choice(e)).map(src);
        if (n.type === 'BinaryExpression' && n.operator === '+') return [...values(n.left), ...values(n.right)];
        if (n.type === 'ParenthesizedExpression') return values(n.expression);
        if (choice(n)) return [];
        return [src(n)];
    };
    /** The text at the right end of a message: of its last piece, when that piece is text. */
    const lastText = n => n.type === 'Literal' && typeof n.value === 'string' ? n.value : n.type === 'TemplateLiteral' ? n.quasis.at(-1).value.cooked ?? ''
        : n.type === 'BinaryExpression' && n.operator === '+' ? lastText(n.right) : '';
    /** Drops a text argument: a string becomes '' and a template keeps its values. */
    const dropText = n => edits.push([n.start, n.end, n.type === 'Literal' ? "''" : '`' + n.expressions.map(e => '${' + src(e) + '}').join(' ') + '`']);
    for (const [name, from, to] of special) {
        if (!file.endsWith('/src/' + name)) continue;
        const at = code.indexOf(from);
        if (at < 0) throw new Error(`scripts/message-codes.mjs: src/${name} has no text "${from}". Change the list "special".`);
        edits.push([at, at + from.length, to]);
    }
    walk(ast, n => {
        if (!isText(n) || !CODED.test(textOf(n))) return;
        // (A text that a test of a message compares, `message.startsWith('[map-jr-gl] E20017 ')`, is not a message.)
        const call = parents.get(n);
        if (call?.type === 'CallExpression' && call.arguments.includes(n) && /^(startsWith|endsWith|includes|indexOf)$/.test(call.callee.property?.name ?? '')) return;
        const [, prefix = '', number] = CODED.exec(textOf(n));
        // (When the text is the left end of a `+` chain, the whole chain is the message.)
        let top = n;
        for (let p = parents.get(top); p?.type === 'BinaryExpression' && p.operator === '+' && p.left === top; p = parents.get(p)) top = p;
        // (A text that ends with a space, such as a prefix that the source puts before another message, keeps one.)
        const head = `${prefix}E${number} ${LINK}${number}`, list = values(top), space = /\s$/.test(lastText(top)) ? ' ' : '';
        edits.push([top.start, top.end, list.length ? '`' + head + list.map(v => ' ${' + v + '}').join('') + space + '`' : JSON.stringify(head + space)]);
    });
    // The texts that `complete(spec, method, fix)` and `reject(code, value, short)` of src/host.ts get go: the code is added by those functions.
    if (file.endsWith('/src/host.ts')) walk(ast, n => {
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'complete' && n.arguments.length === 3 && isText(n.arguments[2])) dropText(n.arguments[2]);
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'reject' && n.arguments.length === 3 && isText(n.arguments[2])) dropText(n.arguments[2]);
    });
    return edits;
}

/** The production form of one file of src/, with its source map, or null when the file has no message. */
export function productionMessages(code, id) {
    if (!/\/src\/[^/]+\.ts$/.test(id) || !/E\d+ |\[map-jr-gl\] E'/.test(code)) return null;
    const edits = shortenMessages(code, id);
    if (!edits.length) return null;
    // (An edit inside another one, such as a text with a code inside a longer message, is left out, and of two edits of
    // the same text the first, which is the one of `special`, wins.)
    edits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const edited = new MagicString(code);
    let end = -1;
    for (const [s, e, t] of edits) { if (s < end) continue; edited.overwrite(s, e, t); end = e; }
    return {code: edited.toString(), map: edited.generateMap({source: id, hires: true})};
}

/** The plugin of build.mjs. */
export const messageCodes = {name: 'message-codes', enforce: 'pre', transform: productionMessages};
