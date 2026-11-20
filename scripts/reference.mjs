// Writes the reference tables of the docs from the types and the TSDoc of src/ (#1112).
//
//   node scripts/reference.mjs --write   fills each marked block of README.md and docs/**/*.md
//   node scripts/reference.mjs --check   fails when a block is out of date or a member has no TSDoc (pnpm test:consistency)
//
// A block is two comments on lines of their own. `Name` is a type of scripts/reference/types.ts:
//
//   <!-- ref:MapDescription:start -->           a table of the members: Name, Type, Default, Description
//   <!-- ref:MapDescription:end -->
//   <!-- ref:MapInstance.update:start -->       one method: its signature, a table of its parameters, and Returns
//   <!-- ref:MapInstance.update:end -->
//
// A row takes the first sentence of the TSDoc of the member, and `@default`. The name links to a heading of the page
// that has the name in backticks (`## \`style\``). A member that is not optional is **required** in a type that has
// optional members (a type that the application writes). A block inside a code fence is an example and stays as it is.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {API, NodeBuilderFlags, SymbolFlags} from 'typescript/unstable/sync';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const write = process.argv.includes('--write'), check = process.argv.includes('--check');
if (write === check) { console.error('Usage: node scripts/reference.mjs --write | --check'); process.exit(2); }

/** The pages that can have blocks: README.md, every Markdown file of docs/, and the fixture of the tables. */
function pages() {
    const found = ['README.md', 'test/fixtures/reference.md'];
    const walk = dir => {
        for (const entry of readdirSync(path.join(root, dir), {withFileTypes: true})) {
            const rel = path.posix.join(dir, entry.name);
            if (entry.isDirectory()) walk(rel); else if (entry.name.endsWith('.md')) found.push(rel);
        }
    };
    walk('docs');
    return found;
}

/** The marked blocks of a page that are outside code fences: `{name, start, end}` with the offsets of their content. */
function blocks(text) {
    const found = [];
    let fence = null, offset = 0, open = null;
    for (const line of text.split('\n')) {
        const next = offset + line.length + 1, marker = line.trim();
        const f = /^(`{3,}|~{3,})/.exec(marker);
        if (f) { if (!fence) fence = f[1]; else if (marker.startsWith(fence) && marker.slice(fence.length).trim() === '') fence = null; }
        else if (!fence) {
            const m = /^<!-- ref:([\w.]+):(start|end) -->$/.exec(marker);
            if (m?.[2] === 'start') open = {name: m[1], start: next};
            else if (m && open?.name === m[1]) { found.push({name: open.name, start: open.start, end: offset}); open = null; }
        }
        offset = next;
    }
    return found;
}

// ---- Reading the types ----

const config = path.join(root, 'scripts/reference/tsconfig.json');
const api = new API();
const snapshot = api.updateSnapshot({openProjects: [config]});
const project = snapshot.getProject(config) ?? snapshot.getProjects()[0];
const {checker, program} = project;
const typesFile = program.getSourceFile(path.join(root, 'scripts/reference/types.ts'));
const src = path.join(root, 'src') + path.sep;
const problems = [];

/** `file#name` of the interface or class that a declaration handle points to. */
const keyOf = handle => handle ? `${handle.path}#${handle.resolve(project)?.name?.getText()}` : '';
/** The interfaces that types.ts names: a table leaves out the members that one of them declares for another. */
const named = new Set();
for (const statement of typesFile.statements) {
    if (statement.type) named.add(keyOf(checker.getTypeFromTypeNode(statement.type).getSymbol()?.declarations?.[0]));
}

const lifecycle = new Set(['connectedCallback', 'disconnectedCallback', 'connectedMoveCallback', 'adoptedCallback', 'attributeChangedCallback']);

/** The members of a type of types.ts that src/ declares and that are not private, in the order of the source. */
function members(name) {
    const symbol = checker.resolveName(name, SymbolFlags.Type, typesFile);
    if (!symbol) return null;
    const type = checker.getDeclaredTypeOfSymbol(symbol), self = keyOf(type.getSymbol()?.declarations?.[0]);
    const list = [];
    list.undeclared = [];
    for (const property of checker.getPropertiesOfType(type)) {
        // (An export of a module, for `typeof` an entry, is an alias: the TSDoc is on the function that it names.)
        const member = property.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(property) : property;
        const handle = member.declarations?.[0];
        // (A member that a mapped type makes, such as `Record<'a' | 'b', T>`, has no declaration and so no TSDoc.)
        // A listener `onX` of that kind is an event of the component (the `emits` of Vue, `MapEventProps` of React),
        // which the table of `MapEvents` describes, and is left out.
        if (!handle) { if (!/^on[A-Z]/.test(member.name)) list.undeclared.push(member.name); continue; }
        if (!String(handle.path).startsWith(src)) continue;
        const node = handle.resolve(project);
        const modifiers = node?.modifiers?.map(m => m.getText()) ?? [];
        // (Private members, members that start with `_` for wrappers, and the callbacks of a custom element that the browser calls.)
        // (A member tagged `@internal` is for other parts of the library, not for the user.)
        if (modifiers.includes('private') || modifiers.includes('protected') || /^[#_]/.test(member.name) || lifecycle.has(member.name) || checker.getJsDocTagsOfSymbol(member).some(t => t.name === 'internal')) continue;
        const parent = node?.parent?.name ? `${handle.path}#${node.parent.name.getText()}` : '';
        if (parent && parent !== self && named.has(parent)) continue;
        // (A getter without a setter is read only, and its type is the type that it returns.)
        const getter = /^(\w+\s+)*get\s/.test(node?.getText() ?? ''), setter = member.declarations.some(d => /^(\w+\s+)*set\s/.test(d.resolve(project)?.getText() ?? ''));
        list.push({member, node, getter, file: String(handle.path), index: handle.index, readonly: modifiers.includes('readonly') || (getter && !setter)});
    }
    // (A type can join the members of several files, for example an interface that extends one of another file.)
    const files = [...new Set(list.map(m => m.file))];
    return Object.assign(list.sort((a, b) => files.indexOf(a.file) - files.indexOf(b.file) || a.index - b.index), {undeclared: list.undeclared});
}

const cell = text => text.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim();
/** A row of a table. An empty cell is `| |`, as a hand-written table has it. */
const line = cells => '|' + cells.map(c => c ? ` ${c} ` : ' ').join('|') + '|';
const code = text => text.includes('`') ? '`` ' + text + ' ``' : '`' + text + '`';
const docOf = member => checker.getDocumentationCommentOfSymbol(member).replace(/\s*\n\s*/g, ' ').trim();
const tagsOf = member => checker.getJsDocTagsOfSymbol(member);
/** The first sentence: up to a full stop that a space and a capital letter or a backtick follow. */
const firstSentence = text => /^.*?[.!?](?=\s+[A-Z`(]|$)/.exec(text)?.[0] ?? text;
/** The type as the source writes it, or as the checker prints it where the source has no annotation (a prop of Vue). */
const typeText = (member, optional, node, getter = false) => {
    const flat = text => text.replace(/\s*\n\s*/g, ' ');
    if (node?.type && node.parameters && !getter) {
        const generics = node.typeParameters?.length ? `<${node.typeParameters.map(p => p.getText()).join(', ')}>` : '';
        // (A parameter with a default value is optional, and the value is not part of the type.)
        const param = p => `${p.dotDotDotToken ? '...' : ''}${p.name.getText()}${p.questionToken || p.initializer ? '?' : ''}${p.type ? ': ' + p.type.getText() : ''}`;
        return flat(`${generics}(${node.parameters.map(param).join(', ')}) => ${node.type.getText()}`);
    }
    if (node?.type) return flat(node.type.getText());
    let text = checker.typeToString(checker.getTypeOfSymbol(member), undefined, NodeBuilderFlags.NoTruncation).replace(/"([^"']*)"/g, "'$1'").replace(/\{ /g, '{').replace(/;? \}/g, '}');
    // (A prop of Vue has no annotation. Where the checker shortens a long type, take the type of its `PropType<…>`.)
    const prop = /PropType<(.*)>/s.exec(node?.getText() ?? '');
    if (text.includes('...') && prop) {
        let depth = 0, end = 0;
        for (const [i, c] of [...prop[1]].entries()) { if (c === '<') depth++; else if (c === '>') { if (!depth) { end = i; break; } depth--; } end = i + 1; }
        text = flat(prop[1].slice(0, end));
    }
    // (`| undefined` of an optional member says what `?` says, also for the members of an object type inside it.)
    text = text.replace(/\?: ([^;{}]*?) \| undefined(?=[;}])/g, '?: $1');
    return optional ? text.replace(/ \| undefined$/, '').replace(/^undefined \| /, '') : text;
};
/** The `@default` of a member. `{@link Type.member}` takes the default of that member. */
function defaultOf(member) {
    const text = tagsOf(member).find(t => t.name === 'default')?.text?.trim();
    const link = /\{@link (\w+)\.(\w+)\}/.exec(text ?? '');
    if (!link) return text;
    const target = members(link[1])?.find(m => m.member.name === link[2]);
    return target ? defaultOf(target.member) : text;
}
const slug = heading => heading.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');

/** The anchors of the headings of a page, by each name in backticks that a heading has. */
function anchors(text) {
    const found = new Map();
    for (const [, heading] of text.matchAll(/^#{2,6} (.+)$/gm)) {
        for (const [, name] of heading.matchAll(/`([^`]+)`/g)) if (!found.has(name)) found.set(name, '#' + slug(heading));
    }
    return found;
}

/** The page and the anchor of each block, by the name of its type: a Type cell links a type that has a block. */
const homes = new Map();
const hrefFrom = (page, target, anchor) => (target === page ? '' : path.posix.relative(path.posix.dirname(page), target)) + anchor;
/** A Type cell: the type in code, where each name of a type with a block is a link to it. */
function typeCell(text, page, self) {
    const out = [];
    let at = 0;
    for (const m of text.matchAll(/\b[A-Z]\w*\b/g)) {
        // (A page of the docs links only to the docs: the tables of the fixture are not for readers.)
        const home = m[0] !== self && homes.get(m[0]);
        if (home && home.page.startsWith('test/') && home.page !== page) continue;
        if (!home) continue;
        if (m.index > at) out.push(cell(code(text.slice(at, m.index))));
        out.push(`[${code(m[0])}](${hrefFrom(page, home.page, home.anchor)})`);
        at = m.index + m[0].length;
    }
    if (at < text.length) out.push(cell(code(text.slice(at))));
    return out.join('');
}
/** A Description cell. A link of the TSDoc to a file of the repository (`docs/loading.md#…`) is made relative to the page. */
const describe = (text, page) => cell(text.replace(/\]\(((?:docs\/|README\.md)[^)\s]*)\)/g, (_, target) => {
    const [file, anchor = ''] = target.split(/(?=#)/);
    return `](${hrefFrom(page, file, anchor)})`;
}));

function table(name, links, page) {
    const list = members(name);
    if (!list) return problems.push(`ref:${name}: scripts/reference/types.ts has no type "${name}". Add it there.`), null;
    for (const key of list.undeclared) problems.push(`ref:${name}: the member \`${key}\` comes from a mapped type and has no TSDoc. Declare it in the type with a comment of its own.`);
    const input = list.some(({member}) => member.flags & SymbolFlags.Optional);
    // (A type that the application only reads, such as the methods of the map or its events, has no defaults: its
    // table has no column Default.)
    const rows = input ? ['| Name | Type | Default | Description |', '|---|---|---|---|'] : ['| Name | Type | Description |', '|---|---|---|'];
    for (const {member, node, getter, readonly} of list) {
        const optional = !!(member.flags & SymbolFlags.Optional), method = !!(member.flags & SymbolFlags.Method);
        const doc = docOf(member);
        if (!doc) problems.push(`ref:${name}: the member \`${member.name}\` has no TSDoc comment. Add one in ${path.relative(root, list.find(m => m.member === member).file)}.`);
        const label = code(member.name), linked = links.has(member.name) ? `[${label}](${links.get(member.name)})` : label;
        const marks = [input && !optional && !method && !readonly ? ' **required**' : '', readonly ? ' (read only)' : ''].join('');
        const fallback = defaultOf(member);
        const type = typeCell(typeText(member, optional, node, getter), page, name), description = describe(firstSentence(doc), page);
        rows.push(line(input ? [linked + marks, type, fallback ? cell(/^`.*`$/.test(fallback) || /\s/.test(fallback.replace(/'[^']*'/g, '')) ? fallback : code(fallback)) : '', description] : [linked + marks, type, description]));
    }
    return rows.join('\n');
}

function method(name, page) {
    const [type, key] = name.split('.');
    const entry = members(type)?.find(m => m.member.name === key);
    if (!entry) return problems.push(`ref:${name}: the type "${type}" of scripts/reference/types.ts has no member "${key}".`), null;
    // (Each declaration is one signature: an overload, or the method itself. A body of a class is not a signature.)
    const {member} = entry, all = member.declarations.map(d => d.resolve(project)).filter(n => n?.parameters);
    const signatures = all.length > 1 ? all.filter(n => !n.body) : all;
    if (!signatures.length) return problems.push(`ref:${name}: \`${key}\` is not a method.`), null;
    const tags = tagsOf(member), doc = docOf(member);
    if (!doc) problems.push(`ref:${name}: the method has no TSDoc comment.`);
    const flat = text => text.replace(/\s*\n\s*/g, ' ');
    const out = [];
    for (const signature of signatures) {
        const params = signature.parameters.map(p => ({name: p.name.getText(), optional: !!p.questionToken || !!p.initializer, type: p.type ? flat(p.type.getText()) : 'unknown'}));
        out.push('```ts\n' + flat(`${key}(${params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}): ${signature.type?.getText() ?? 'void'}`) + '\n```');
        if (params.length) {
            out.push('| Name | Type | Default | Description |\n|---|---|---|---|\n' + params.map(p => {
                const text = tags.find(t => t.name === 'param' && t.text?.trim().split(/\s/)[0] === p.name)?.text?.trim().slice(p.name.length).replace(/^\s*-?\s*/, '') ?? '';
                if (!text) problems.push(`ref:${name}: the parameter \`${p.name}\` has no @param text.`);
                return line([code(p.name) + (p.optional ? '' : ' **required**'), typeCell(p.type, page), '', describe(firstSentence(text), page)]);
            }).join('\n'));
        }
    }
    const returns = tags.find(t => t.name === 'returns')?.text?.trim();
    const result = flat(signatures[0].type?.getText() ?? 'void');
    out.push(`**Returns:** ${typeCell(result, page)}${returns ? '. ' + describe(returns, page) : '.'}`);
    return out.join('\n\n');
}

// ---- The pages ----

const all = pages();
for (const page of all) {
    const text = readFileSync(path.join(root, page), 'utf8');
    for (const block of blocks(text)) {
        if (block.name.includes('.') || homes.has(block.name)) continue;
        const heading = [...text.slice(0, block.start).matchAll(/^#{2,6} (.+)$/gm)].at(-1)?.[1];
        homes.set(block.name, {page, anchor: heading ? '#' + slug(heading) : ''});
    }
}
const stale = [];
let count = 0;
for (const page of all) {
    const file = path.join(root, page), text = readFileSync(file, 'utf8'), found = blocks(text);
    if (!found.length) continue;
    const links = anchors(text);
    let out = '', at = 0;
    for (const block of found) {
        count++;
        const body = block.name.includes('.') ? method(block.name, page) : table(block.name, links, page);
        out += text.slice(at, block.start) + (body === null ? text.slice(block.start, block.end) : body + '\n');
        at = block.end;
    }
    out += text.slice(at);
    if (out === text) continue;
    if (write) writeFileSync(file, out); else stale.push(page);
}
api.close();

if (problems.length) console.error('FAIL  reference: the types lack what a table needs:\n' + problems.map(p => '  - ' + p).join('\n'));
if (stale.length) console.error(`FAIL  reference: the tables of ${stale.join(', ')} are out of date. Run \`node scripts/reference.mjs --write\`.`);
if (problems.length || stale.length) process.exit(1);
console.log(`ok    reference: ${count} blocks ${write ? 'written' : 'up to date'}`);
