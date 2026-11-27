// A build step for the production files (#2148, step 2; docs/development/error-codes.md): each message of src/ keeps its
// code and the values that it fills in, and its text is replaced with the link to the page of the code.
//
//   `[map-jr-gl] E1163 the request for the ${what} ${url} failed: ${reason}`
//   becomes `[map-jr-gl] E1163 https://map-jr.org/e/1163 what=${__mjrValue(what)} url=${__mjrValue(url)} reason=${__mjrValue(reason)}`
//   and prints `[map-jr-gl] E1163 https://map-jr.org/e/1163 what="tile" url="https://example.com/1/2/3.pbf" reason="HTTP 404"`
//
// A text with a code is a string or a template whose text starts with `E<n> `, after the prefix `[map-jr-gl] ` when it
// has one (the helpers `warnOnce`, `refused` and others add the prefix). Each value of a template stays, in its order, as
// ` name=value`: a string in quotes, any other value as it is, and a value that the text names twice once. The name is the
// plain word of the expression (`this.url` is `url`, `list.join(", ")` is `list`, MAX_RUNS is `maxRuns`), or the name of
// the list `valueNames` where the expression gives no clear word; the build stops when it finds neither. And a `? :` that chooses between two texts goes. When the text is the left end of a `+` chain, the
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

/**
 * The function that a production message calls on each value: a string prints in quotes, and a number or another value as
 * it is. A module that imports src/requests.ts already, and each module of the worker file, imports it from there
 * (`messageValue`), so that a built file does not repeat it for each module; any other module gets a copy of its own.
 */
const QUOTE = '__mjrValue';
/** The function that writes the code and the link of a production message (`messageHead` of src/requests.ts). */
const HEAD = '__mjrHead';
const quoteFunction = `\nfunction ${QUOTE}(v) { return typeof v == 'string' ? JSON.stringify(v) : v; }\n`;
const REQUESTS = new URL('../src/requests.ts', import.meta.url).pathname;

/**
 * The places where the source adds the code at run time: [file, text in src/, text in production, and the code and the names
 * of the values that it prints]. The build stops when one is missing.
 */
const special = [
    ['host.ts', "() => '[map-jr-gl] E' + code + ' ' + short)", `() => '[map-jr-gl] E' + code + ' ${LINK}' + code)`],
    // (The text `fix` of each call of complete() goes, so the message ends with the name of the method.)
    ['host.ts', '`[map-jr-gl] E57 ${method}(): the description has no "style". ${fix}`', `\`[map-jr-gl] E57 ${LINK}57 method=\${${QUOTE}(method)}\``, [57, ['method']]],
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

/**
 * The names of the values whose expression gives no plain word, or a word that says too little:
 * [file, code, text of the expression, name]. A name stays the same in later versions, because users read it in logs.
 */
const valueNames = [
    ['compat-map.ts', 2145, 'name', 'member'],
    ['compat-map.ts', 32148, 'name', 'method'],
    ['compat-map.ts', 1855, 'name', 'option'],
    ['compat-map.ts', 208, 'name', 'method'],
    ['compat-style-images.ts', 121, 'name', 'image'],
    ['control-specs.ts', 160, 'name', 'control'],
    ['engine.ts', 590, 'name', 'source'],
    ['engine.ts', 494, 'f.name ?? f.family', 'font'],
    ['expr.ts', 583, "JSON.stringify({locale: l, 'min-fraction-digits': mn, 'max-fraction-digits': mx, currency: cur, unit: u})", 'options'],
    ['gpu-error.ts', 10205, "status ? ` (${status}).` : '.'", 'status'],
    ['host.ts', 20121, 'name', 'image'],
    ['host.ts', 50121, 'name', 'image'],
    ['loader.ts', 1630, 'n', 'tileWorkers'],
    ['loader.ts', 10017, "v ?? 'unknown'", 'workerVersion'],
    ['loader.ts', 10017, '__VERSION__', 'pageVersion'],
    ['map.ts', 893, 'p', 'pitch'],
    ['map.ts', 1245, 'p', 'pitch'],
    ['map.ts', 238, 'JSON.stringify(t)', 'projection'],
    ['map.ts', 24, 'to', 'url'],
    ['compat-map.ts', 2004, 'user.id', 'layer'],
    ['compat-map.ts', 2004, 'id', 'source'],
    ['engine.ts', 494, 'f.src', 'url'],
    ['engine.ts', 494, 'm', 'reason'],
    ['map.ts', 464, 'name', 'image'],
    ['map.ts', 2233, 'name', 'image'],
    ['maplibre-compat.ts', 11510, 'n', 'option'],
    ['mistakes.ts', 206, 'name', 'member'],
    ['mistakes.ts', 206, 'privateState[key]', 'advice'],
    ['mistakes.ts', 10206, 'name', 'member'],
    ['pmtiles.ts', 277, 'Math.round(n / 1048576)', 'megabytes'],
    ['react.ts', 129, 'name', 'image'],
    ['react.ts', 10129, 'name', 'image'],
    ['requests.ts', 1163, "url.length > 200 ? url.slice(0, 200) + '...' : url", 'url'],
    ['resolve.ts', 10063, 'name', 'source'],
    ['resolve.ts', 1695, 'name', 'source'],
    ['resolve.ts', 1438, 'name', 'source'],
    ['style-images.ts', 20495, 'name', 'image'],
    ['layers-more.ts', 569, 'JSON.stringify(name)', 'method'],
    ['layers-more.ts', 10569, 'n', 'lights'],
    ['layers-more.ts', 10569, 'LIGHTS', 'maxLights'],
    ['video.ts', 11452, "typeof key === 'string' ? `the page has no <canvas> with the id \"${key}\"` : '\"canvas\" is not a <canvas> element'", 'problem'],
    ['vue.ts', 20129, 'props.name', 'image'],
    ['vue.ts', 30129, 'props.name', 'image'],
];
/** The methods whose result shows the value of their object (`list.join(", ")` prints as `list`). */
const sameValue = /^(join|slice|substring|trim|toFixed|toString|toLowerCase|toUpperCase|replace|map|filter|sort|at)$/;

/** The name that a production message prints before a value: from `valueNames`, else the plain word of the expression. */
function valueName(node, src, file, code) {
    const own = valueNames.find(([f, c, text]) => file.endsWith('/src/' + f) && c === +code && text === src(node).replace(/\s+/g, ' '));
    if (own) return own[3];
    const word = n => {
        switch (n?.type) {
            // (A constant such as MAX_RUNS prints as maxRuns.)
            case 'Identifier': return /^[A-Z][A-Z_]+$/.test(n.name) ? n.name.toLowerCase().replace(/_(\w)/g, (_, c) => c.toUpperCase()) : n.name.replace(/(?<=[a-z]{3})\d+$/, '');
            case 'MemberExpression': return n.computed ? word(n.object) : n.property.name;
            case 'ChainExpression': case 'ParenthesizedExpression': case 'TSAsExpression': case 'TSNonNullExpression': return word(n.expression);
            case 'LogicalExpression': return word(n.left);
            case 'CallExpression': {
                const c = n.callee.type === 'ChainExpression' ? n.callee.expression : n.callee;
                if (c.type === 'MemberExpression' && !c.computed && sameValue.test(c.property.name)) return word(c.object);
                return n.arguments.length ? word(n.arguments[0]) : null;
            }
            default: return null;
        }
    };
    const name = word(node);
    if (!name || !/^[A-Za-z]\w*$/.test(name) || /^(v|x|s|e|n|i|value|name)$/.test(name)) {
        throw new Error(`scripts/message-codes.mjs: the value "${src(node)}" of E${code} in ${file} has no clear name. Add it to the list "valueNames".`);
    }
    return name;
}

/** The edits of one file of src/: [start, end, text]. */
function shortenMessages(code, file, found = [], shared = false) {
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
        if (n.type === 'TemplateLiteral') return n.expressions.filter(e => !choice(e));
        if (n.type === 'BinaryExpression' && n.operator === '+') return [...values(n.left), ...values(n.right)];
        if (n.type === 'ParenthesizedExpression') return values(n.expression);
        if (choice(n)) return [];
        return [n];
    };
    /** The text at the right end of a message: of its last piece, when that piece is text. */
    const lastText = n => n.type === 'Literal' && typeof n.value === 'string' ? n.value : n.type === 'TemplateLiteral' ? n.quasis.at(-1).value.cooked ?? ''
        : n.type === 'BinaryExpression' && n.operator === '+' ? lastText(n.right) : '';
    /** Drops a text argument: a string becomes '' and a template keeps its values. */
    const dropText = n => edits.push([n.start, n.end, n.type === 'Literal' ? "''" : '`' + n.expressions.map(e => '${' + src(e) + '}').join(' ') + '`']);
    for (const [name, from, to, names] of special) {
        if (!file.endsWith('/src/' + name)) continue;
        const at = code.indexOf(from);
        if (at < 0) throw new Error(`scripts/message-codes.mjs: src/${name} has no text "${from}". Change the list "special".`);
        edits.push([at, at + from.length, to]);
        if (names) found.push(names);
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
        // (A value that the text names twice prints once.)
        // (Where the module shares the functions of src/requests.ts, the code and the link come from `messageHead`, which
        // writes the number of the code once.)
        const head = shared ? `${prefix}\${${HEAD}(${number})}` : `${prefix}E${number} ${LINK}${number}`, list = values(top).filter((v, i, all) => all.findIndex(w => src(w) === src(v)) === i), space = /\s$/.test(lastText(top)) ? ' ' : '';
        const names = list.map(v => valueName(v, src, file, number));
        if (!special.some(x => x[3]?.[0] === +number)) found.push([+number, names]);
        edits.push([top.start, top.end, list.length || shared ? '`' + head + list.map((v, i) => ` ${names[i]}=\${${QUOTE}(${src(v)})}`).join('') + space + '`' : JSON.stringify(head + space)]);
    });
    // The texts that `complete(spec, method, fix)` and `reject(code, value, short)` of src/host.ts get go: the code is added by those functions.
    if (file.endsWith('/src/host.ts')) walk(ast, n => {
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'complete' && n.arguments.length === 3 && isText(n.arguments[2])) dropText(n.arguments[2]);
        if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'reject' && n.arguments.length === 3 && isText(n.arguments[2])) dropText(n.arguments[2]);
    });
    return edits;
}

/**
 * The production form of one file of src/, with its source map, or null when the file has no message.
 * `shared`: each module that needs the value function imports it from src/requests.ts (the worker file, which is one
 * file); otherwise only a module that imports src/requests.ts already does.
 */
export function productionMessages(code, id, shared = false) {
    id = id.replaceAll('\\', '/'); // (A path of Windows, as scripts/messages.mjs gives it.)
    if (!/\/src\/[^/]+\.ts$/.test(id) || !/E\d+ |\[map-jr-gl\] E'/.test(code)) return null;
    // (Only an import that src/ writes counts: the plugin `errorCodes` adds one for a `new Error` that can be in the
    // development build only, which the bundler then drops.)
    const own = id.endsWith('/src/requests.ts'), share = own || shared || /^import (?!type )[^;]*from '\.\/requests\.ts';$/m.test(code);
    const edits = shortenMessages(code, id, [], share);
    if (!edits.length) return null;
    // (An edit inside another one, such as a text with a code inside a longer message, is left out, and of two edits of
    // the same text the first, which is the one of `special`, wins.)
    edits.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    const edited = new MagicString(code);
    let end = -1;
    for (const [s, e, t] of edits) { if (s < end) continue; edited.overwrite(s, e, t); end = e; }
    const used = [['messageValue', QUOTE], ['messageHead', HEAD]].filter(([, local]) => edits.some(e => e[2].includes(local + '(')));
    if (own) for (const [name, local] of used) edited.append(`\nconst ${local} = ${name};\n`);
    else if (share && used.length) edited.append(`\nimport {${used.map(([name, local]) => name + ' as ' + local).join(', ')}} from ${JSON.stringify(REQUESTS)};\n`);
    else if (used.length) edited.append(quoteFunction);
    return {code: edited.toString(), map: edited.generateMap({source: id, hires: true})};
}

/** The names of the values that each message with a code prints in production, as [code, names], for docs/reference/messages.md. */
export function productionNames(code, id) {
    const found = [];
    id = id.replaceAll('\\', '/');
    // (server.js keeps the full texts.)
    if (/E\d+ /.test(code) && !id.endsWith('/src/server.ts')) shortenMessages(code, id, found);
    return found;
}

/** The plugin of build.mjs. */
export const messageCodes = {name: 'message-codes', enforce: 'pre', transform: (code, id) => productionMessages(code, id)};
/** The plugin of build.mjs for the worker file, where every module shares the value function of src/requests.ts. */
export const workerMessageCodes = {name: 'message-codes', enforce: 'pre', transform: (code, id) => productionMessages(code, id, true)};

/**
 * The plugin of build.mjs for both builds (#2148): `new Error(text)` and `new TypeError(text)` whose text has a code become
 * `withCode(new Error(text))`, which sets the field `code` (src/requests.ts). It runs before `messageCodes`.
 */
export const errorCodes = {
    name: 'error-codes', enforce: 'pre',
    transform(code, id) {
        id = id.replaceAll('\\', '/');
        if (!/\/src\/[^/]+\.ts$/.test(id) || id.endsWith('/src/mistakes.ts') || !/E\d+ /.test(code)) return null;
        const ast = parseAst(code, {lang: 'ts'}, id), edited = new MagicString(code);
        let any = false;
        walk(ast, n => {
            if (n.type !== 'NewExpression' || n.callee.type !== 'Identifier' || !/^(Error|TypeError)$/.test(n.callee.name)) return;
            let first = n.arguments[0];
            while (first?.type === 'ParenthesizedExpression' || first?.type === 'BinaryExpression' && first.operator === '+') first = first.type === 'ParenthesizedExpression' ? first.expression : first.left;
            if (!isText(first) || !CODED.test(textOf(first))) return;
            edited.prependLeft(n.start, 'withCode(').appendRight(n.end, ')');
            any = true;
        });
        if (!any) return null;
        // (vue.js sets the code itself: an import of src/requests.ts would make it load the map chunk.)
        if (!/\/src\/(requests|vue)\.ts$/.test(id) && !code.includes('withCode')) edited.prepend(`import {withCode} from ${JSON.stringify(new URL('../src/requests.ts', import.meta.url).pathname)};\n`);
        return {code: edited.toString(), map: edited.generateMap({source: id, hires: true})};
    },
};
