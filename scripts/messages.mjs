// Writes the list of messages of the library into docs/reference/messages.md (#1125).
//
//   node scripts/messages.mjs --write   rewrites the tables between <!-- messages:start --> and <!-- messages:end -->
//   node scripts/messages.mjs --check   fails when the tables are out of date, or when a message of src/ is not read
//                                       (pnpm test:consistency)
//
// A message is a text that starts with `[map-jr-gl]` or that goes through a helper that adds the prefix (`warnOnce`,
// `refused`, `reject`, and `warn` in the check of the projection), and the numbered texts of src/mistakes.ts. The script
// reads src/ with a parser, so a new message appears in the page after `--write`, and `--check` fails until then. A
// piece of a message that the source builds at run time is written `<name>`.
// A place that adds the prefix to a text that the script cannot read fails the check: add it to `prefixHelpers`.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {transformSync} from 'esbuild';
import {parseAst} from 'vite';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const write = process.argv.includes('--write'), check = process.argv.includes('--check');
if (write === check) { console.error('Usage: node scripts/messages.mjs --write | --check'); process.exit(2); }
const page = path.join(root, 'docs/reference/messages.md');
const PREFIX = '[map-jr-gl]';

/** The functions that add the prefix to their argument: the name, and the index of the argument that holds the text. */
const helperCalls = {refused: 0, warnOnce: 0, warn: 1, reject: 2};
/** The places where the source writes the prefix and then a text that comes from a variable, with the reason that each is not a message. */
const prefixHelpers = new Set([
    'expr.ts warnOnce', 'compat-map.ts refused', 'map.ts warn', 'host.ts reject', 'map.ts logError', 'mistakes.ts mistake', 'host.ts cluster',
]);

const sections = [
    ['main', 'Main API', 'The functions of `@map-jr/map-jr-gl` and the map that they make.'],
    ['element', '`<map-jr>`', 'The element `<map-jr>`.'],
    ['vue', 'Vue and React', 'The components of `@map-jr/map-jr-gl/vue`, `@map-jr/map-jr-gl/react` and the Nuxt module.'],
    ['map', 'Map, styles and loading', 'The map, the style, its sources and images, and the files of the library. Both entries print these.'],
    ['controls', 'Controls', 'The controls of the map.'],
    ['compat', 'MapLibre compatibility', 'The entry `@map-jr/map-jr-gl/maplibre-compat`.'],
    ['server', 'Server rendering', 'The functions of `@map-jr/map-jr-gl/server`.'],
];
const sectionOfFile = {
    'host.ts': 'main', 'markers.ts': 'main', 'points.ts': 'main', 'element.ts': 'element', 'vue.ts': 'vue', 'react.ts': 'vue',
    'server.ts': 'server', 'compat-map.ts': 'compat', 'maplibre-compat.ts': 'compat', 'compat-style-images.ts': 'compat',
    'controls-more.ts': 'controls', 'control-specs.ts': 'controls', 'color-scheme-control.ts': 'controls', 'controls.ts': 'controls',
};

const files = readdirSync(path.join(root, 'src')).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort();
const problems = [];
const messages = [];

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
    /** The texts that an expression can give, each piece that is not known written as a placeholder. */
    const render = (node, depth = 0) => {
        if (depth > 6) return [PH('value')];
        switch (node.type) {
            case 'Literal': return [String(node.value)];
            case 'TemplateLiteral': {
                let out = [node.quasis[0].value.cooked];
                node.expressions.forEach((e, i) => { out = cross(cross(out, render(e, depth + 1)), [node.quasis[i + 1].value.cooked]); });
                return out;
            }
            case 'BinaryExpression': return node.operator === '+' ? cross(render(node.left, depth + 1), render(node.right, depth + 1)) : [PH('value')];
            case 'ConditionalExpression': return limit([...render(node.consequent, depth + 1), ...render(node.alternate, depth + 1)]);
            case 'LogicalExpression': return node.left.type === 'MemberExpression' && node.left.computed ? render(node.left, depth + 1) : [PH(name(node.left))];
            case 'MemberExpression':
                if (node.computed && node.object.type === 'ObjectExpression') return limit(node.object.properties.filter(p => stringy(p.value)).flatMap(p => render(p.value, depth + 1)));
                return [PH(name(node))];
            case 'Identifier': {
                const init = declared.get(node.name);
                if (init && counts.get(node.name) === 1 && stringy(init) && /[a-z]{3}/.test(bare(render(init, depth + 1)[0]))) return render(init, depth + 1);
                return [PH(name(node))];
            }
            case 'CallExpression': return [PH(name(node))];
            default: return [PH('value')];
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
    const calleeName = c => c.type === 'Super' ? 'super' : c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? text(c) : '';
    /** Whether a node is inside code that exists only in the development build. */
    const development = node => {
        for (let p = node.parent; p; p = p.parent) {
            if ((p.type === 'LogicalExpression' || p.type === 'IfStatement' || p.type === 'ConditionalExpression') && /\b__DEV__\b/.test(text(p.test ?? p.left))) return true;
        }
        return false;
    };
    /** `Warning` when the message goes to console.warn, and `Error` when it is thrown, rejected, fired as an `error` event or logged with console.error. */
    const kindOf = node => {
        for (let p = node.parent; p; p = p.parent) {
            if (p.type === 'ThrowStatement') return 'Error';
            if (p.type === 'NewExpression' && /Error$/.test(calleeName(p.callee))) return 'Error';
            if (p.type === 'CallExpression') {
                const c = calleeName(p.callee);
                if (c === 'console.warn' || c === 'warnOnce' || c === 'warn' || c === 'noEffect') return 'Warning';
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
    const sectionOf = (node, message) => {
        if (message.startsWith(PREFIX + ' <map-jr>')) return 'element';
        if (message.startsWith(PREFIX + ' <MapJr>') || /MapImage/.test(message)) return 'vue';
        if (functionOf(node) === 'watchMembers') return 'compat';
        if (/^\[map-jr-gl\] (map\.painter|setTransform|setSourceTileLodParams|setWorkerUrl|Map:|new Map\(\)|getSource\(|[\w.]+ has no effect: this library)/.test(message)) return 'compat';
        if (/^\[map-jr-gl\] colorScheme\(\)/.test(message)) return 'controls';
        return sectionOfFile[file] ?? 'map';
    };
    const add = (node, message, extra = {}) => {
        if (!/[a-z]{3}/.test(bare(message))) return;
        const kind = extra.kind || kindOf(node);
        if (!kind) problems.push(`${file}: cannot tell whether "${clean(message).slice(0, 60)}" is a warning or an error. Teach scripts/messages.mjs where it goes.`);
        messages.push({section: extra.section ?? sectionOf(node, clean(message)), message: clean(message), kind, dev: extra.dev ?? development(node), file, at: node.start});
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
        if (node.type === 'NewExpression' && /Error$/.test(calleeName(node.callee)) && file === 'host.ts' && functionOf(node) === 'cluster' && stringy(node.arguments[0]) && !text(node.arguments[0]).includes('[map-jr-gl]'))
            for (const v of render(node.arguments[0])) add(node, PREFIX + ' <name>(): ' + v, {kind: 'Error'});
        // `complete(spec, method, fix)` of host.ts: the message has the name of the method and the text of the call.
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'complete' && file === 'host.ts' && node.arguments[1]?.type === 'Literal' && stringy(node.arguments[2]))
            for (const v of render(node.arguments[2])) add(node, `${PREFIX} ${node.arguments[1].value}(): the description has no "style". ${v}`, {kind: 'Error', section: 'main'});
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name in helperCalls) {
            const arg = node.arguments[helperCalls[node.callee.name]];
            if (arg && stringy(arg) && !(file === 'mistakes.ts')) for (const v of render(arg).map(clean)) add(arg, PREFIX + ' ' + v);
        }
        for (const key in node) {
            if (key === 'parent') continue;
            const value = node[key];
            if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value.type === 'string') visit(value);
        }
    };
    if (file !== 'mistakes.ts') visit(ast);
    else {
        // The numbered texts: the array `texts`, and the assignments `texts[n] = ...`. A text that is thrown has its code in a call.
        const thrown = new Set();
        for (const f of files) for (const m of readFileSync(path.join(root, 'src', f), 'utf8').matchAll(/\b(?:mistake|reject)\((\d+)/g)) thrown.add(Number(m[1]));
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
                // (The parameters `a` and `b` are the names that the user wrote and the other value of the check.)
                const message = clean(v.replace(/\u0001([ab])\u0002/g, (_, x) => PH(x === 'a' ? 'name' : 'value')));
                if (!/[a-z]{3}/.test(bare(message))) continue;
                messages.push({section: /^<map-jr>/.test(message) ? 'element' : /^<MapJr>/.test(message) ? 'vue' : 'main', message: PREFIX + ' ' + message, kind: thrown.has(Number(n)) ? 'Error' : 'Warning', dev: true, file, at: Number(n)});
            }
        }
        visit(ast);
    }
}

// The same text from two places is one entry.
const unique = [], keys = new Set();
for (const m of messages.filter(m => !m.message.endsWith('has no "style". <fix>'))) { const key = m.section + '\n' + m.message; if (!keys.has(key)) { keys.add(key); unique.push(m); } }

const cell = text => {
    const body = text;
    return body.includes('`') ? '`` ' + body + ' ``' : '`' + body + '`';
};
let out = '';
for (const [key, title, intro] of sections) {
    const list = unique.filter(m => m.section === key);
    if (!list.length) continue;
    out += `## ${title}\n\n${intro}\n\n`;
    for (const m of list) out += `- ${cell(m.message)}\n  ${m.kind}${m.dev ? ', development build only' : ''}.\n`;
    out += '\n';
}
out = out.trimEnd() + '\n';

if (problems.length) { for (const p of problems) console.error('FAIL  messages: ' + p); process.exit(1); }
const start = '<!-- messages:start -->', end = '<!-- messages:end -->';
const current = readFileSync(page, 'utf8'), a = current.indexOf(start), b = current.indexOf(end);
if (a < 0 || b < a) { console.error(`FAIL  messages: ${path.relative(root, page)} has no ${start} and ${end}.`); process.exit(1); }
const next = current.slice(0, a + start.length) + '\n' + out + current.slice(b);
if (write) { writeFileSync(page, next); console.log(`ok    messages: ${unique.length} messages written`); }
else if (next !== current) { console.error(`FAIL  messages: ${path.relative(root, page)} is out of date (${unique.length} messages in src/). Run \`node scripts/messages.mjs --write\`.`); process.exit(1); }
else console.log(`ok    messages: ${unique.length} messages up to date`);
