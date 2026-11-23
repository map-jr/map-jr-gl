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
// that has the name in backticks (`## \`style\``) and belongs to the type that declares the member: the heading holds a
// block `ref:Type.member`, or a table of the type comes before it in the same or an outer section. A name in a Type
// cell links to the block of the type that the name resolves to where the member is declared (#1249). A member that is not optional is **required** in a type that has
// optional members (a type that the application writes). A block inside a code fence is an example and stays as it is.
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {API, NodeBuilderFlags, SymbolFlags} from 'typescript/unstable/sync';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const write = process.argv.includes('--write'), check = process.argv.includes('--check');
if (write === check) { console.error('Usage: node scripts/reference.mjs --write | --check'); process.exit(2); }
// The fences of signatures take the form of the docs formatter at 80 columns (website/build/format.mjs), the form
// that `docs-lint --fix` writes (#1277). Without the packages of website/, `--write` stops, and `--check` compares
// the fences with their spaces, line breaks, commas and semicolons ignored.
const format = await import('../website/build/format.mjs').catch(() => undefined);
if (!format && write) {
    console.error('FAIL  reference: website/ has no packages, so the code fences cannot be formatted. Run `pnpm install` in website/, then run this again.');
    process.exit(1);
}
const fences = /^```(\w+)\n([\s\S]*?)\n```$/gm;
async function formatFences(body) {
    if (!format) return body;
    let out = '', at = 0;
    for (const match of body.matchAll(fences)) {
        const formatted = await format.formatCode(match[2], match[1], format.desktopWidth) ?? match[2];
        out += body.slice(at, match.index) + '```' + match[1] + '\n' + formatted + '\n```';
        at = match.index + match[0].length;
    }
    return out + body.slice(at);
}
const loose = text => text.replace(fences, (_, language, code) => '```' + language + '\n' + code.replace(/[\s,;]+/g, '') + '\n```');

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
// (On a file system that ignores case, as on macOS, the paths of the declarations are in lower case.)
const src = (path.join(root, 'src') + path.sep).toLowerCase();
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
const memberCache = new Map();
function members(name) {
    if (!memberCache.has(name)) memberCache.set(name, readMembers(name));
    return memberCache.get(name);
}
function readMembers(name) {
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
        if (!String(handle.path).toLowerCase().startsWith(src)) continue;
        const node = handle.resolve(project);
        const modifiers = node?.modifiers?.map(m => m.getText()) ?? [];
        // (Private members, members that start with `_` for wrappers, and the callbacks of a custom element that the browser calls.)
        // (A member tagged `@internal` is for other parts of the library, not for the user.)
        if (modifiers.includes('private') || modifiers.includes('protected') || /^[#_]/.test(member.name) || lifecycle.has(member.name) || checker.getJsDocTagsOfSymbol(member).some(t => t.name === 'internal')) continue;
        const parent = node?.parent?.name ? `${handle.path}#${node.parent.name.getText()}` : '';
        if (parent && parent !== self && named.has(parent)) continue;
        // (A getter without a setter is read only, and its type is the type that it returns.)
        const getter = /^(\w+\s+)*get\s/.test(node?.getText() ?? ''), setter = member.declarations.some(d => /^(\w+\s+)*set\s/.test(d.resolve(project)?.getText() ?? ''));
        list.push({member, node, getter, file: String(handle.path), index: handle.index, key: `${handle.path}:${handle.index}`, readonly: modifiers.includes('readonly') || (getter && !setter)});
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
    // (A type that names a type parameter of its interface, such as `readonly P[]`, is printed as the checker sees it
    // in the type of types.ts, with the type that the reader passes in place of `P`, #1248.)
    // (A function type keeps the text of the source, where the checker would print the parameter as `unknown`.)
    const generic = !/=>/.test(node?.type?.getText() ?? '') && node?.parent?.typeParameters?.some(p => new RegExp(`\\b${p.name.getText()}\\b`).test(node.type.getText()));
    if (node?.type && !generic) return flat(node.type.getText());
    let text = checker.typeToString(checker.getTypeOfSymbol(member), undefined, NodeBuilderFlags.NoTruncation).replace(/"([^"']*)"/g, "'$1'").replace(/\{ /g, '{').replace(/;? \}/g, '}');
    // (A prop of Vue has no annotation. Where the checker shortens a long type, take the type of its `PropType<…>`.)
    const prop = /PropType<(.*)>/s.exec(node?.getText() ?? '');
    if (text.includes('...') && prop) {
        let depth = 0, end = 0;
        // (The `>` of an arrow `=>` closes nothing.)
        for (const [i, c] of [...prop[1]].entries()) { if (c === '<') depth++; else if (c === '>' && prop[1][i - 1] !== '=') { if (!depth) { end = i; break; } depth--; } end = i + 1; }
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
const slug = heading => heading.toLowerCase().replace(/`[^`]*`/g, m => m.replace(/[<>]/g, '')).replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');

/**
 * The anchors of the member headings of a page, by the declaration of the member (`file:index`). A heading names a
 * member of a type when its section holds the block `ref:Type.name`, or when a table `ref:Type` of a type with a member
 * of that name comes before it in the same section or an outer one (the nearest such table). A heading that names no
 * declared member that way gives no link.
 */
function anchors(text) {
    const found = new Map(), headings = [];
    for (const m of text.matchAll(/^(#{2,6}) (.+)$/gm)) headings.push({level: m[1].length, heading: m[2], at: m.index});
    const marks = blocks(text).map(b => ({name: b.name, at: b.start}));
    headings.forEach((h, i) => {
        const end = headings[i + 1]?.at ?? text.length;
        const own = marks.filter(b => b.at > h.at && b.at < end);
        // (The tables before the heading, the nearest first, in sections that are not deeper than the heading's.)
        const scope = [];
        let limit = h.level;
        for (let j = i - 1; j >= 0; j--) {
            const g = headings[j];
            if (g.level > limit) continue;
            limit = g.level;
            const next = headings[j + 1].at;
            scope.push(...marks.filter(b => b.at > g.at && b.at < next && !b.name.includes('.')).reverse());
        }
        for (const [, name] of h.heading.matchAll(/`([^`]+)`/g)) {
            const method = own.find(b => b.name.endsWith('.' + name));
            const types = method ? [method.name.split('.')[0]] : scope.map(b => b.name);
            for (const type of types) {
                const entry = members(type)?.find(m => m.member.name === name);
                if (!entry) continue;
                if (!found.has(entry.key)) found.set(entry.key, '#' + slug(h.heading));
                break;
            }
        }
    });
    return found;
}

/** The page and the anchor of each block, by the declaration of its type (`keyOf`): a Type cell links a type that has a block. */
const homes = new Map();
const named_ = key => key.endsWith('#undefined') ? '' : key;
/** The declaration of the type that `name` names at `context` (a node of src/), or '' when it names none. */
function declarationOf(name, context) {
    if (!context) return '';
    let symbol = checker.resolveName(name, SymbolFlags.Type | SymbolFlags.Alias, context);
    if (symbol && symbol.flags & SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    return named_(keyOf(symbol?.declarations?.[0]));
}
/** The declaration of the type of a block of types.ts. */
function blockDeclaration(name) {
    const symbol = checker.resolveName(name, SymbolFlags.Type, typesFile);
    return symbol ? named_(keyOf(checker.getDeclaredTypeOfSymbol(symbol).getSymbol()?.declarations?.[0])) : '';
}
const hrefFrom = (page, target, anchor) => (target === page ? '' : path.posix.relative(path.posix.dirname(page), target)) + anchor;
/** A Type cell: the type in code, where each name of a type with a block is a link to it. */
function typeCell(text, page, self, context) {
    const out = [];
    let at = 0;
    for (const m of text.matchAll(/\b[A-Z]\w*\b/g)) {
        // (A page of the docs links only to the docs: the tables of the fixture are not for readers.)
        const key = declarationOf(m[0], context);
        const home = key && key !== self && homes.get(key);
        if (home && home.page.startsWith('test/') && home.page !== page) continue;
        if (!home) continue;
        if (m.index > at) out.push(cell(code(text.slice(at, m.index))));
        out.push(`[${code(m[0])}](${hrefFrom(page, home.page, home.anchor)})`);
        at = m.index + m[0].length;
    }
    if (at < text.length) out.push(cell(code(text.slice(at))));
    return out.join('');
}
/** The longest table cell that scripts/docs-lint.mjs allows. */
const LIMIT = 200;
/** The length of a cell as docs-lint counts it: without the targets of links, and `\\|` as one character. */
const size = text => text.replace(/\\\|/g, '|').replace(/\]\([^)]*\)/g, ']').length;
/**
 * A Type cell that fits the limit, and a sentence for the Description cell (#1260). Over the limit, the largest inline
 * object type `{…}` becomes `object`, one at a time, and the sentence names the members of each.
 */
function shortType(text, page, self, context) {
    const notes = [];
    let out = typeCell(text, page, self, context);
    while (size(out) > LIMIT) {
        // (The outermost braces, the largest first.)
        const spans = [];
        let depth = 0, start = 0;
        for (const [i, c] of [...text].entries()) {
            if (c === '{') { if (!depth++) start = i; } else if (c === '}' && !--depth) spans.push([start, i + 1]);
        }
        if (!spans.length) break;
        const [a, b] = spans.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
        const keys = [];
        let d = 0, part = '';
        // (The `>` of an arrow `=>` closes nothing.)
        for (const c of text.slice(a + 1, b - 1) + ';') {
            if ('{([<'.includes(c)) d++; else if ('})]>'.includes(c) && !(c === '>' && part.endsWith('='))) d--;
            if (c === ';' && !d) { const k = /^\s*(\w+)\??:/.exec(part)?.[1]; if (k) keys.push(code(k)); part = ''; } else part += c;
        }
        const list = keys.length > 1 ? keys.slice(0, -1).join(', ') + ' and ' + keys.at(-1) : keys[0];
        notes.push(`The ${notes.length ? 'next ' : ''}\`object\` has the members ${list}.`);
        text = text.slice(0, a) + 'object' + text.slice(b);
        out = typeCell(text, page, self, context);
    }
    if (size(out) > LIMIT) problems.push(`${page}: the Type cell "${text.slice(0, 40)}…" has ${size(out)} characters, over the ${LIMIT} of docs-lint. Give the type a name in src/.`);
    return {type: out, note: notes.join(' ')};
}
/** A Description cell with the sentence of `shortType`. */
// (When the sentence would make the Description cell too long, it is left out, and the Description says what the object has.)
const withNote = (description, note) => note && size(description) + note.length < LIMIT ? `${description} ${note}`.trim() : description;
/** A Description cell. A link of the TSDoc to a file of the repository (`docs/guide/loading.md#…`) is made relative to the page. */
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
    const self = blockDeclaration(name);
    for (const {member, node, getter, readonly, key} of list) {
        const optional = !!(member.flags & SymbolFlags.Optional), method = !!(member.flags & SymbolFlags.Method);
        const doc = docOf(member);
        if (!doc) problems.push(`ref:${name}: the member \`${member.name}\` has no TSDoc comment. Add one in ${path.relative(root, list.find(m => m.member === member).file)}.`);
        const label = code(member.name), linked = links.has(key) ? `[${label}](${links.get(key)})` : label;
        const marks = [input && !optional && !method && !readonly ? ' **required**' : '', readonly ? ' (read only)' : ''].join('');
        const fallback = defaultOf(member);
        const {type, note} = shortType(typeText(member, optional, node, getter), page, self, node), description = withNote(describe(firstSentence(doc), page), note);
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
                const {type, note} = shortType(p.type, page, '', signature);
                return line([code(p.name) + (p.optional ? '' : ' **required**'), type, '', withNote(describe(firstSentence(text), page), note)]);
            }).join('\n'));
        }
    }
    const returns = tags.find(t => t.name === 'returns')?.text?.trim();
    const result = flat(signatures[0].type?.getText() ?? 'void');
    out.push(`**Returns:** ${typeCell(result, page, '', signatures[0])}${returns ? '. ' + describe(returns, page) : '.'}`);
    return out.join('\n\n');
}

// ---- The pages ----

const all = pages();
for (const page of all) {
    const text = readFileSync(path.join(root, page), 'utf8');
    for (const block of blocks(text)) {
        const key = !block.name.includes('.') && blockDeclaration(block.name);
        if (!key || homes.has(key)) continue;
        const heading = [...text.slice(0, block.start).matchAll(/^#{2,6} (.+)$/gm)].at(-1)?.[1];
        homes.set(key, {page, anchor: heading ? '#' + slug(heading) : ''});
    }
}
/** The links of a block, as `[name](target)`. */
const linksOf = text => [...text.matchAll(/\[`+ ?([^`\]]+?) ?`+\]\(([^)]*)\)/g)].map(m => `[\`${m[1]}\`](${m[2]})`);
const stale = [];
let count = 0;
for (const page of all) {
    const file = path.join(root, page), text = readFileSync(file, 'utf8'), found = blocks(text);
    if (!found.length) continue;
    const links = anchors(text);
    let out = '', at = 0;
    for (const block of found) {
        count++;
        const raw = block.name.includes('.') ? method(block.name, page) : table(block.name, links, page);
        const body = raw === null ? null : await formatFences(raw);
        // (A link of the page that the table no longer makes points to another declaration, or to none.)
        if (check && body !== null) {
            const made = new Set(linksOf(body));
            for (const link of linksOf(text.slice(block.start, block.end))) {
                if (!made.has(link)) problems.push(`${page} (ref:${block.name}): the link ${link} points to a declaration other than the one that the name stands for there. Run \`node scripts/reference.mjs --write\`.`);
            }
        }
        out += text.slice(at, block.start) + (body === null ? text.slice(block.start, block.end) : body + '\n');
        at = block.end;
    }
    out += text.slice(at);
    if (out === text || (!format && loose(out) === loose(text))) continue;
    if (write) writeFileSync(file, out); else stale.push(page);
}
api.close();

if (problems.length) console.error('FAIL  reference: the types lack what a table needs:\n' + problems.map(p => '  - ' + p).join('\n'));
if (stale.length) console.error(`FAIL  reference: the tables of ${stale.join(', ')} are out of date. Run \`node scripts/reference.mjs --write\`.`);
if (problems.length || stale.length) process.exit(1);
console.log(`ok    reference: ${count} blocks ${write ? 'written' : 'up to date'}${format ? '' : ' (fences compared without their format, because website/ has no packages)'}`);
