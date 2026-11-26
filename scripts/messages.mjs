// Checks the messages of the library in src/ and their codes (#1125, #1499, #2148). Run by pnpm test:consistency:
//
//   node scripts/messages.mjs --check   fails when a message of src/ cannot be read, has a placeholder that says nothing,
//                                       cannot be classed as a warning or an error, has no code or the code of another
//                                       message, uses a code that was removed, or when docs/reference/messages.md differs
//                                       from what --write makes
//   node scripts/messages.mjs --write   writes docs/reference/messages.md, and dist/messages.json when dist/ exists
//   node scripts/messages.mjs --json    writes dist/messages.json only (build.mjs runs this)
//
// Each message has a code, `E` and a number, right after the prefix: `[map-jr-gl] E1846 workerUrl: ...`. The source writes
// the code at the start of the text, and the texts of src/mistakes.ts take their number as their code. A new message takes
// the number of its issue; a second one for the same issue takes that number plus 10000 (see docs/development/error-codes.md).
// A code that leaves src/ stays in docs/reference/messages.md as removed, so that a link in an old log still works, and it
// is not used again.
//
// A message is a text that starts with `[map-jr-gl]` or that goes through a helper that adds the prefix (`warnOnce`,
// `refused`, `reject`, and `warn` in the check of the projection), and the numbered texts of src/mistakes.ts. The script
// reads src/ with a parser. A piece of a message that the source builds at run time is written `<words>`, with the words
// of `placeholderNames` or the name of the variable. A placeholder that is only `name`, `value` or `v` fails the check.
// A place that adds the prefix to a text that the script cannot read fails the check: add it to `prefixHelpers`.
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transformSync} from 'esbuild';
import {parseAst} from 'vite';
import {LINK, productionNames} from './message-codes.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mode = ['--check', '--write', '--json'].find(m => process.argv.includes(m));
if (!mode) { console.error('Usage: node scripts/messages.mjs --check | --write | --json'); process.exit(2); }
const PREFIX = '[map-jr-gl]';

/** The functions that add the prefix to their argument: the name, and the index of the argument that holds the text. */
const helperCalls = {refused: 0, warnOnce: 0, warn: 1, reject: 2};
/** The places where the source writes the prefix and then a text that comes from a variable, with the reason that each is not a message. */
const prefixHelpers = new Set([
    'map.ts pageWarn', // (the texts of warnOnce of expr.ts, which a worker relays; #1141)
    'expr.ts warnOnce', 'compat-map.ts refused', 'map.ts warn', 'host.ts reject', 'map.ts logError', 'mistakes.ts mistake', 'host.ts cluster',
]);

/**
 * The words that a placeholder shows for a piece of a text that the source builds at run time. The key is the text of the
 * expression in the template (with the name of the file in front when the same expression means two things). A piece with no
 * entry shows the name of its variable, and a variable named `name`, `value` or `v` fails the check: the entry here, or a
 * clearer name in src/, says what it stands for.
 */
const placeholderNames = [
    // [file, text of the expression, a pattern for the template that it is in (or null), the words of the placeholder]
    ['compat-map.ts', 'name', /has no effect/, 'member'],
    ['compat-map.ts', 'name', /the result was used without/, 'method'],
    ['compat-map.ts', 'name', /the feature has no "id"/, 'method'],
    ['compat-style-images.ts', 'name', /the image "/, 'image name'],
    ['host.ts', 'name', /the image "/, 'image name'],
    ['host.ts', 'name', /\}\(\): \$\{/, 'method'],
    ['host.ts', 'e?.message?.replace(/^\\[map-jr-gl\\] /, "")', null, 'cause'],
    ['host.ts', 'Object.keys(next ?? {})[0]', null, 'field'],
    ['control-specs.ts', 'name', /The control "/, 'control name'],
    ['engine.ts', 'name', /The source "/, 'source name'],
    ['engine.ts', 'f.name', null, 'font name'],
    ['expr.ts', 'JSON.stringify({ locale: l, "min-fraction-digits": mn, "max-fraction-digits": mx, currency: cur, unit: u })', null, 'options'],
    ['loader.ts', 'v', /The worker file is version/, 'worker version'],
    ['map.ts', 'name', /addImage\("/, 'image name'],
    ['map.ts', 'this.resolved.unsupported.join(", ")', null, 'layer types'],
    ['mistakes.ts', 'name', /MapLibre GL JS|not available in/, 'member'],
    ['mistakes.ts', 'privateState[key]', null, 'advice'],
    ['mistakes.ts', 'overlayOptions.join(", ")', null, 'overlay options'],
    // (The last part of layers.<id>.<group>.<property>, #1139.)
    ['mistakes.ts', 'where.slice(where.lastIndexOf(".") + 1)', null, 'property'],
    ['pmtiles.ts', 'Math.round(n / 1048576)', null, 'file size'],
    ['react.ts', 'name', /MapImage "/, 'image name'],
    ['vue.ts', 'props.name', /MapImage "/, 'image name'],
    ['requests.ts', 'url.slice(0, 200)', null, 'url'],
    ['requests.ts', 'what', null, 'resource'],
    ['resolve.ts', 'name', /The source "/, 'source name'],
    ['server.ts', 'name', /server render: "/, 'option name'],
    ['server.ts', 'v', /server render: "/, 'option value'],
    ['server.ts', 'name', /renderElement\(\): "/, 'attribute name'],
    ['server.ts', 'cause?.message', null, 'cause'],
    ['vue.ts', 'cause?.message', null, 'cause'],
    ['style.ts', 'JSON.stringify(name)', /hillshade-method/, 'hillshade method'],
    ['style-images.ts', 'name', /the image "/, 'image name'],
];
/** The placeholders that say nothing about what they stand for. A piece of a message that gets one of these fails the check. */
const genericNames = new Set(['name', 'value', 'v']);


const files = readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort();
const problems = [];
const messages = [];
/** Each place in src/ that writes a message: its file, its kind, its code and the texts that it can give. */
const sites = [];

const PH = (name) => `\u0001${name}\u0002`;
const bare = text => text.replace(/\u0001[^\u0002]*\u0002/g, '').replace(/\[map-jr-gl\]/g, '').trim();
const limit = list => list.length > 4 ? [list[0]] : list;
const cross = (a, b) => limit(a.flatMap(x => b.map(y => x + y)));

for (const file of files) {
    const source = readFileSync(path.join(root, 'src', file), 'utf8');
    const code = transformSync(source, {loader: 'ts', target: 'esnext', define: {}}).code;
    const ast = parseAst(code);
    const text = node => code.slice(node.start, node.end);

    // The constants of the file that hold a text, by name, when the name is declared once: `const fix = '...'`.
    const declared = new Map(), counts = new Map();
    const scan = (node, parent) => {
        if (!node || typeof node.type !== 'string') return;
        node.parent = parent;
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
            counts.set(node.id.name, (counts.get(node.id.name) ?? 0) + 1);
            if (node.init) declared.set(node.id.name, node.init);
        }
        for (const key in node) {
            if (key === 'parent') continue;
            const value = node[key];
            if (Array.isArray(value)) for (const v of value) scan(v, node); else if (value && typeof value.type === 'string') scan(value, node);
        }
    };
    scan(ast, null);

    const stringy = node => node && (node.type === 'Literal' && typeof node.value === 'string' || node.type === 'TemplateLiteral' || node.type === 'BinaryExpression' && node.operator === '+' || node.type === 'ConditionalExpression');
    const name = node => node.type === 'Identifier' ? node.name.replace(/(?<=[a-z]{3})\d+$/, '') : node.type === 'MemberExpression' && !node.computed ? node.property.name
        : node.type === 'CallExpression' ? (node.arguments[0] ? name(node.arguments[0]) : 'value') : 'value';
    /** The placeholder for an expression: the name that `placeholderNames` gives to the text of the expression, else the name of the variable. */
    const label = (node, fallback) => {
        let template = node.parent;
        while (template && template.type !== 'TemplateLiteral') template = template.parent;
        const whole = template ? text(template) : '';
        const own = placeholderNames.find(([f, expr, pattern]) => f === file && (expr === null ? template && template.expressions.includes(node) : expr === text(node).replace(/\s+/g, ' ').replace(/(?<=[a-z]{3})\d+\b/g, '')) && (!pattern || pattern.test(whole)));
        const result = own ? own[3] : fallback ?? name(node);
        if (genericNames.has(result)) problems.push(`${file}: the placeholder for "${text(node).slice(0, 50)}" says nothing about what it stands for. Add it to placeholderNames in scripts/messages.mjs, or name the variable in src/.`);
        return result;
    };
    /** The texts that an expression can give, each piece that is not known written as a placeholder. */
    const render = (node, depth = 0) => {
        if (depth > 6) return [PH(label(node, 'value'))];
        switch (node.type) {
            case 'Literal': return [String(node.value)];
            case 'TemplateLiteral': {
                let out = [node.quasis[0].value.cooked];
                node.expressions.forEach((e, i) => { out = cross(cross(out, render(e, depth + 1)), [node.quasis[i + 1].value.cooked]); });
                return out;
            }
            case 'BinaryExpression':
                // `x[0].toUpperCase() + x.slice(1)` is the value of x with a capital letter.
                if (node.operator === '+' && /^(\w+)\[0\]\.toUpperCase\(\) \+ \1\.slice\(1\)$/.test(text(node))) return [PH(node.right.callee.object.name)];
                return node.operator === '+' ? cross(render(node.left, depth + 1), render(node.right, depth + 1)) : [PH(label(node, 'value'))];
            case 'ConditionalExpression': return limit([...render(node.consequent, depth + 1), ...render(node.alternate, depth + 1)]);
            case 'LogicalExpression': return node.left.type === 'MemberExpression' && node.left.computed ? render(node.left, depth + 1) : [PH(label(node.left))];
            case 'MemberExpression':
                if (node.computed && node.object.type === 'ObjectExpression') return limit(node.object.properties.filter(p => stringy(p.value)).flatMap(p => render(p.value, depth + 1)));
                return [PH(label(node))];
            case 'Identifier': {
                const init = declared.get(node.name);
                if (init && counts.get(node.name) === 1 && stringy(init) && /[a-z]{3}/.test(bare(render(init, depth + 1)[0]))) return render(init, depth + 1);
                return [PH(label(node))];
            }
            case 'CallExpression': return [PH(label(node))];
            default: return [PH(label(node, 'value'))];
        }
    };
    const clean = s => s.replace(/\u0001([^\u0002]*)\u0002/g, '<$1>').replace(/\s*\n\s*/g, ' ').trim();

    /** The enclosing function of a node, as `name`. */
    const functionOf = node => {
        for (let p = node.parent; p; p = p.parent) {
            if (p.type === 'FunctionDeclaration' && p.id) return p.id.name;
            if ((p.type === 'MethodDefinition') && p.key) return p.key.name ?? p.key.value;
            if (p.type === 'VariableDeclarator' && p.id.type === 'Identifier' && /Function/.test(p.init?.type ?? '')) return p.id.name;
        }
        return '';
    };
    const enclosingFunction = node => { for (let p = node.parent; p; p = p.parent) if (/Function|MethodDefinition/.test(p.type)) return p; return ast; };
    /** The node is inside an argument of a call of the function `callee`. */
    const insideCall = (node, callee) => { for (let p = node.parent; p; p = p.parent) if (p.type === 'CallExpression' && p.callee.type === 'Identifier' && p.callee.name === callee) return true; return false; };
    const calleeName = c => c.type === 'Super' ? 'super' : c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? text(c) : '';
    /** `Warning` when the message goes to console.warn, and `Error` when it is thrown, rejected, fired as an `error` event or logged with console.error. */
    const kindOf = node => {
        for (let p = node.parent; p; p = p.parent) {
            if (p.type === 'ThrowStatement') return 'Error';
            if (p.type === 'NewExpression' && /Error$/.test(calleeName(p.callee))) return 'Error';
            if (p.type === 'CallExpression') {
                const c = calleeName(p.callee);
                if (c === 'console.warn' || c === 'warnOnce' || c === 'warn' || c === 'noEffect' || c === 'this.mistake') return 'Warning';
                if (c === 'console.error' || c === 'super' || c === 'refused' || c === 'reject' || c === 'fault' || c === 'bad' || /\.fire$|^emit$|\.emit$/.test(c)) return 'Error';
            }
            if (p.type === 'VariableDeclarator') {
                const body = text(enclosingFunction(p));
                const warns = body.includes('console.warn'), errors = /throw |new Error|fire\('error'/.test(body);
                if (warns) return 'Warning';
                if (errors) return 'Error';
            }
        }
        return '';
    };
    const add = (node, message, extra = {}) => {
        if (!/[a-z]{3}/.test(bare(message))) return;
        const kind = extra.kind || kindOf(node);
        if (!kind) problems.push(`${file}: cannot tell whether "${clean(message).slice(0, 60)}" is a warning or an error. Teach scripts/messages.mjs where it goes.`);
        message = clean(message);
        messages.push(message);
        const code = extra.code ?? message.match(/^\[map-jr-gl\] (?:<method>\(\): )?E(\d+) /)?.[1];
        // (The branches of one expression can give texts with codes of their own.)
        const key = file + ' ' + (extra.site ?? node).start + ' ' + code;
        let site = sites.find(x => x.key === key);
        if (!site) sites.push(site = {key, file, kind, code: code === undefined ? undefined : +code, texts: [], alias: extra.alias});
        site.texts.push(message);
        if (code === undefined && !extra.later) problems.push(`${file}: "${message.slice(0, 70)}" has no code. Write E and the number of its issue after the prefix, for example "[map-jr-gl] E${2148} ..." (see docs/development/error-codes.md).`);
    };

    /** A root of a message: climbs from a piece to the whole `+` chain that it belongs to. */
    const rootOf = node => { let n = node; while (n.parent && (n.parent.type === 'BinaryExpression' && n.parent.operator === '+' || n.parent.type === 'ConditionalExpression' && n.parent.test !== n || n.parent.type === 'LogicalExpression' && n.parent.right === n)) n = n.parent; return n; };
    const seen = new Set();
    const visit = node => {
        if (!node || typeof node.type !== 'string') return;
        const isText = node.type === 'Literal' && typeof node.value === 'string' || node.type === 'TemplateLiteral';
        if (isText && (node.type === 'Literal' ? node.value : node.quasis.map(q => q.value.cooked).join('')).includes(PREFIX)) {
            const top = rootOf(node);
            if (!seen.has(top)) {
                seen.add(top);
                const call = top.parent?.type === 'CallExpression' ? calleeName(top.parent.callee) : '';
                if (/\.(startsWith|includes)$/.test(call)) { /* a test of the prefix, not a message */ }
                else {
                    const variants = render(top).filter(v => /[a-z]{3}/.test(bare(v))).map(clean);
                    if (!variants.length) {
                        const fn = functionOf(top) || 'file';
                        if (!prefixHelpers.has(`${file} ${fn}`)) problems.push(`${file}: "${text(top).slice(0, 70)}" adds the prefix to a text that the script cannot read. Add "${file} ${fn}" to prefixHelpers in scripts/messages.mjs.`);
                    } else for (const v of variants) add(top, v);
                }
            }
        }
        // A function that adds its name and the prefix to the error of the function that it calls.
        if (node.type === 'NewExpression' && /Error$/.test(calleeName(node.callee)) && file === 'host.ts' && (functionOf(node) === 'cluster' || insideCall(node, 'cluster')) && stringy(node.arguments[0]) && !text(node.arguments[0]).includes('[map-jr-gl]'))
            for (const v of render(node.arguments[0])) add(node, PREFIX + ' <method>(): ' + v, {kind: 'Error'});
        // `complete(spec, method, fix)` of host.ts: the message has the name of the method and the text of the call.
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'complete' && file === 'host.ts' && node.arguments[1]?.type === 'Literal' && stringy(node.arguments[2]))
            for (const v of render(node.arguments[2])) add(node, `${PREFIX} ${node.arguments[1].value}(): the description has no "style". ${v}`, {kind: 'Error', later: 'complete'});
        // `this.refused(text)` of compat-map.ts adds the prefix.
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.type === 'ThisExpression' && node.callee.property.name === 'refused' && stringy(node.arguments[0]))
            for (const v of render(node.arguments[0]).map(clean)) add(node.arguments[0], PREFIX + ' ' + v, {kind: 'Error'});
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name in helperCalls) {
            const arg = node.arguments[helperCalls[node.callee.name]];
            // (`reject(code, value, text)` of host.ts gives the short text of a numbered text of src/mistakes.ts, with its code.)
            const numbered = node.callee.name === 'reject' && node.arguments[0]?.type === 'Literal' ? {code: node.arguments[0].value, alias: true} : {};
            if (arg && stringy(arg) && !(file === 'mistakes.ts')) for (const v of render(arg).map(clean)) add(arg, PREFIX + ' ' + (numbered.code === undefined ? '' : `E${numbered.code} `) + v, numbered);
        }
        for (const key in node) {
            if (key === 'parent') continue;
            const value = node[key];
            if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value.type === 'string') visit(value);
        }
    };
    if (file !== 'mistakes.ts') visit(ast);
    else {
        // The numbered texts: the array `texts`, and the assignments `texts[n] = ...`.
        const arrows = [];
        const find = node => {
            if (!node || typeof node.type !== 'string') return;
            if (node.type === 'VariableDeclarator' && node.id.name === 'texts') node.init.elements.forEach((e, i) => e && arrows.push([i, e]));
            if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.name === 'texts') arrows.push([node.left.property.value, node.right]);
            for (const key in node) {
                if (key === 'parent') continue;
                const value = node[key];
                if (Array.isArray(value)) value.forEach(find); else if (value && typeof value.type === 'string') find(value);
            }
        };
        find(ast);
        for (const [n, arrow] of arrows) {
            const body = arrow.body;
            for (const v of render(body)) {
                // (A parameter of the text names what it stands for in camel case, for example `layerId`: the entry shows `<layer id>`.)
                const params = new Set(arrow.params.map(x => x.name));
                for (const x of params) if (/^[ab]$/.test(x)) { problems.push(`${file}: text ${n} names a parameter "${x}". Name what it stands for, for example "layerId", so that the message reads <layer id>.`); break; }
                const message = clean(v.replace(/\u0001([^\u0002]*)\u0002/g, (all, x) => params.has(x) ? PH(x.replace(/[A-Z]/g, c => ' ' + c.toLowerCase())) : all));
                if (!/[a-z]{3}/.test(bare(message))) continue;
                messages.push(PREFIX + ' ' + message);
                let site = sites.find(x => x.key === file + ' text ' + n);
                if (!site) sites.push(site = {key: file + ' text ' + n, file, kind: 'Warning', code: n, texts: []});
                site.texts.push(`${PREFIX} E${n} ${message}`);
            }
        }
        visit(ast);
    }
}

// The same text from two places counts once.
const unique = new Set(messages.filter(m => !m.endsWith('has no "style". <fix>')));

// The calls of `complete()` in host.ts give the message of its template, which has the code.
const template = sites.find(x => x.file === 'host.ts' && x.texts.some(t => t.endsWith('has no "style". <fix>')));
for (const site of sites.filter(x => x.code === undefined)) {
    if (!template || template.code === undefined) { problems.push(`host.ts: "${site.texts[0].slice(0, 70)}" has no code.`); continue; }
    site.code = template.code; site.alias = true; site.texts = site.texts.map(t => t.replace(PREFIX + ' ', `${PREFIX} E${template.code} `));
}
// A text of src/mistakes.ts that the source throws or rejects is an error.
const mistakesSource = readFileSync(path.join(root, 'src', 'mistakes.ts'), 'utf8');
for (const site of sites) if (site.file === 'mistakes.ts' && (new RegExp(`new Error\\(mistake\\(${site.code}\\b`).test(mistakesSource) || sites.some(x => x.alias && x.code === site.code && x.file === 'host.ts'))) site.kind = 'Error';

// Each code belongs to one place. (A short text that reject() of host.ts gives in production shares the code of its text in
// src/mistakes.ts, and the calls of complete() share the code of their template.)
const byCode = new Map();
for (const site of sites) {
    if (site.code === undefined) continue;
    const owner = byCode.get(site.code);
    if (!owner) { byCode.set(site.code, {...site, texts: [...site.texts]}); continue; }
    if (site.alias || owner.alias) { owner.texts.push(...site.texts.filter(t => !owner.texts.includes(t))); if (owner.alias && !site.alias) Object.assign(owner, {file: site.file, kind: site.kind, alias: false}); continue; }
    problems.push(`${site.file}: the code E${site.code} of "${site.texts[0].slice(0, 60)}" is also the code of "${owner.texts[0].slice(0, 60)}" in ${owner.file}. Give the newer message the number of its issue, or that number plus 10000.`);
}

// The reference page: one section for each code, and the sections of the codes that were removed.
const pagePath = path.join(root, 'docs', 'reference', 'messages.md');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const old = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
const START = '<!-- messages:start -->', END = '<!-- messages:end -->';
/** The sections of the page as it is, by code. */
const before = new Map();
const generated = old.includes(START) ? old.slice(old.indexOf(START) + START.length, old.indexOf(END)) : '';
for (const part of generated.split(/^(?=## E\d+$)/m)) { const m = part.match(/^## E(\d+)\n/); if (m) before.set(+m[1], part.trim()); }
const isRemoved = section => /\nRemoved after /.test(section);
for (const [code, section] of before) if (isRemoved(section) && byCode.has(code))
    problems.push(`the code E${code} was removed (see docs/reference/messages.md), and a message of src/ uses it again. Give the message the number of its issue.`);
const entryOf = (code, file) => file === 'server.ts' ? 'the server renderer' : file === 'host.ts' ? 'the main API' : file === 'mistakes.ts' ? (sites.some(x => x.alias && x.code === code && x.file === 'host.ts') ? 'the main API' : 'the main API (development build only)')
    : /^(compat-|maplibre-compat)/.test(file) ? 'the compat entry' : file === 'vue.ts' ? 'the Vue component' : file === 'nuxt.ts' ? 'the module for Nuxt' : file === 'react.ts' ? 'the React component' : 'both entries';
const plain = text => text.replace(/\n/g, ' ').replace(/^\[map-jr-gl\] E\d+ /, '').replace(/^\[map-jr-gl\] (<method>\(\): )E\d+ /, '$1').replace(/^\[map-jr-gl\] (\w+\(\): )/, '$1');
// The names of the values that the production build prints for each code (scripts/message-codes.mjs).
const valueNames = new Map();
for (const file of files) for (const [code, names] of productionNames(readFileSync(path.join(root, 'src', file), 'utf8'), path.join(root, 'src', file))) valueNames.set(code, names);
/** What the production build prints for a code, with each value as `name=…`; nothing for a message that production does not have. */
const production = (code, x) => /development build only|server renderer/.test(entryOf(code, x.file)) ? ''
    : `The production build prints this:\n\n\`\`\`text\n[map-jr-gl] ${x.texts.some(t => t.startsWith(`${PREFIX} <method>(): `)) ? '<method>(): ' : ''}E${code} ${LINK}${code}${(valueNames.get(code) ?? []).map(n => ` ${n}=…`).join('')}\n\`\`\`\n\n`;
const sections = new Map();
for (const [code, x] of byCode) sections.set(code, `## E${code}\n\nA${x.kind === 'Error' ? 'n error' : ' warning'} of ${entryOf(code, x.file)}.\n\n` + production(code, x) + x.texts.map(t => '```text\n' + plain(t) + '\n```').join('\n\n'));
for (const [code, section] of before) if (!byCode.has(code)) sections.set(code, isRemoved(section) ? section : section.replace(/\n\n/, `\n\nRemoved after ${pkg.version}.\n\n`));
const page = `# Messages

Each error and warning of the library starts with \`[map-jr-gl]\` and a code, such as \`E1846\`. This page gives the text
of each code. A placeholder such as \`<source name>\` stands for a value that the message fills in. The package has the
same texts in \`dist/messages.json\` (each code with its kind and its texts), so that a log can be read without network.

The development build prints the code and the text. The production build prints the code, the address
\`https://map-jr.org/e/<number>\` and the values of the placeholders in their order, each with its name, for example
\`[map-jr-gl] E1163 https://map-jr.org/e/1163 what="tile" url="https://example.com/1/2/3.pbf" reason="HTTP 404"\`. A string
prints in quotes, and a number without. The section of each code gives the names. The worker prints the same short form
in both builds. The server renderer (\`@map-jr/map-jr-gl/server\`) and the standalone files print the full
text.

An error that the library throws, or rejects a promise with, carries its code in the field \`code\`, such as
\`error.code === 'E63'\`, in both builds and in both entries. The \`name\` stays \`Error\` (or \`TypeError\`). The same holds for
the errors of the server renderer and for the errors that fire in an \`error\` event (\`event.error.code\`).

An error that
the library does not number, or that comes from the browser, has no \`code\`. Test the field and not the text, because the
text differs between the development build and the production build.

A code stays the same in later versions. When a message is removed, its section stays here with the version after which
it was removed, and the code is not used again.

${START}
${[...sections].sort((a, b) => a[0] - b[0]).map(x => x[1]).join('\n\n')}
${END}
`;
const json = JSON.stringify(Object.fromEntries([...byCode].sort((a, b) => a[0] - b[0]).map(([code, x]) => ['E' + code, {kind: x.kind.toLowerCase(), text: x.texts.map(plain)}])), null, 1) + '\n';
if (mode === '--check' && old !== page) problems.push('docs/reference/messages.md is not what the messages of src/ give. Run node scripts/messages.mjs --write.');

if (problems.length) { for (const p of problems) console.error('FAIL  messages: ' + p); process.exit(1); }
if (mode === '--write') writeFileSync(pagePath, page);
if (mode !== '--check' && existsSync(path.join(root, 'dist'))) writeFileSync(path.join(root, 'dist', 'messages.json'), json);
console.log(`ok    messages: ${unique.size} messages checked, ${byCode.size} codes`);
