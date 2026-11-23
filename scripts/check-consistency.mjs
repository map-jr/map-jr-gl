// Checks that the parts of the project that must agree do agree. A feature often needs the same change in several
// places (the description, each adapter, the documents, the examples), and one of them is easily forgotten.
// Run by `pnpm test`. Each failure says which file to change.
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = f => readFileSync(path.join(root, f), 'utf8');
const failures = [];
const fail = (where, what) => failures.push(`${where}: ${what}`);

/** The field names of an interface in a source file. */
function fields(source, name) {
    const start = source.indexOf(`export interface ${name}`);
    if (start < 0) throw new Error(`interface ${name} not found`);
    const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('\n}', start));
    // Comments can hold words with a colon after them: take them out first.
    let text = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    // (Only the fields of the interface itself: the fields of an object type inside it are taken out.)
    for (let before = ''; before !== text;) { before = text; text = text.replace(/\{[^{}]*\}/g, ''); }
    return [...text.matchAll(/(?:^|;)\s*([a-zA-Z]\w*)\??[:(]/gm)].map(m => m[1]);
}
const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

// 1. Each field of the description is in the reference of the description.
const host = read('src/host.ts'), spec = [...new Set([...fields(host, 'MapSetup'), ...fields(host, 'MapDescription')])];
const descriptionDoc = read('docs/reference/description.md'), mapDoc = read('docs/reference/map.md'), exportsDoc = read('docs/reference/exports.md'), eventsDoc = read('docs/reference/events.md');
for (const f of spec) if (!descriptionDoc.includes('`' + f + '`')) fail('docs/reference/description.md', `the field \`${f}\` of the description (src/host.ts) is not mentioned`);

// 2. Each field of the description is a prop (or an event) of the Vue component, and is in its document.
//    A field that Vue gives in another way is named here with the reason.
const vueOther = {style: 'the prop mapStyle', onViewChange: 'v-model:view', onColorSchemeChange: 'v-model:color-scheme', onClick: 'the event click', onError: 'the event error'};
const vue = read('src/vue.ts'), vueDoc = read('docs/reference/vue.md');
const props = vue.slice(vue.indexOf('    props: {'), vue.indexOf('    emits: {'));
for (const f of spec) {
    if (vueOther[f]) continue;
    if (!new RegExp(`(^|[\\s,{])${f}:`, 'm').test(props)) fail('src/vue.ts', `the component MapJr has no prop for the field \`${f}\` of the description`);
    if (!vueDoc.includes('`' + kebab(f) + '`') && !vueDoc.includes('`' + f + '`') && !vueDoc.includes(':' + kebab(f)) && !vueDoc.includes(kebab(f) + '=')) fail('docs/reference/vue.md', `the prop \`${kebab(f)}\` is not mentioned`);
}

// 2b. Each field of the description is a property or an attribute of the element <map-jr> (src/element.ts, and the
//     table of attributes in src/element-attributes.ts), and is in docs/reference/element.md. A field that the element gives in
//     another way is named here with the word that the document must have.
const elementOther = {nonce: 'nonce', onViewChange: 'map-viewchange', onColorSchemeChange: 'map-colorschemechange', onClick: 'map-click', onError: 'map-error'};
{
    const element = read('src/element.ts'), elementDoc = read('docs/reference/element.md');
    const properties = element.match(/const PROPERTIES = \[([^\]]*)\]/)?.[1] ?? '', attributes = read('src/element-attributes.ts').match(/export const ATTRIBUTES = \{([^}]*)\}/)?.[1] ?? '';
    for (const f of spec) {
        const prop = f === 'style' ? 'mapStyle' : f, attr = f === 'style' ? 'map-style' : kebab(f);
        if (elementOther[f]) { if (!elementDoc.includes('`' + elementOther[f] + '`')) fail('docs/reference/element.md', `\`${elementOther[f]}\` (the field \`${f}\` of the description) is not mentioned`); continue; }
        if (!properties.includes(`'${prop}'`) && !new RegExp(`(^|[\\s,{])${f}:`).test(attributes)) fail('src/element.ts', `the element <map-jr> has no property (PROPERTIES) and no attribute (ATTRIBUTES in src/element-attributes.ts) for the field \`${f}\` of the description`);
        if (!elementDoc.includes('`' + prop + '`') && !elementDoc.includes('`' + attr + '`')) fail('docs/reference/element.md', `the property \`${prop}\` (the field \`${f}\` of the description) is not mentioned`);
    }
}

// 3. Each member of the map object of the main API is in the reference of the map.
for (const m of fields(host, 'MapInstance')) if (!mapDoc.includes(m)) fail('docs/reference/map.md', `the member \`${m}\` of the map (MapInstance in src/host.ts) is not mentioned`);

// 3b. Each value that the main entry exports (not the types) is in the reference of the exports.
for (const [, list] of read('src/index.ts').matchAll(/^export \{([^}]*)\}/gm)) {
    for (const name of list.split(',').map(s => s.trim()).filter(s => s && !s.startsWith('type '))) if (!exportsDoc.includes('`' + name + '`') && !exportsDoc.includes(name + '(')) fail('docs/reference/exports.md', `the export \`${name}\` of src/index.ts is not mentioned`);
}

// 4. Each row of the gallery has its seven forms (#1115). (run.html is the harness page, not an example.)
const examples = readdirSync(path.join(root, 'examples')).filter(f => /\.(js|vue|jsx|svelte|html)$/.test(f) && f !== 'run.html');
for (const row of new Set(examples.map(f => f.split('.')[0]))) {
    for (const ext of ['.js', '.compat.js', '.vue', '.nuxt.vue', '.jsx', '.svelte', '.html']) if (!examples.includes(row + ext)) fail('examples', `the example "${row}" has no ${ext} form`);
}

// 5. Each entry of the package has its source file, and a document names it.
const pkg = JSON.parse(read('package.json')), docs = ['README.md', ...readdirSync(path.join(root, 'docs'), {recursive: true}).filter(f => f.endsWith('.md')).map(f => 'docs/' + f.split(path.sep).join('/')).sort()];
const allDocs = docs.map(read).join('\n');
for (const entry of Object.keys(pkg.exports ?? {})) {
    if (entry === '.' || entry === './package.json') continue;
    const name = '@map-jr/map-jr-gl' + entry.slice(1);
    if (!allDocs.includes(name)) fail('docs', `no document mentions the entry \`${name}\` (package.json "exports")`);
}

// 5b. Each event of the map (MapEvents in src/host.ts) is in the reference of the events, and the documents
//     of the adapters say how an event is passed on.
{
    const start = host.indexOf('export interface MapEvents'), block = host.slice(start, host.indexOf('\n}', start));
    const names = new Set([...block.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/'([a-z.]+)'|^\s+([a-z.]+):/gm)].map(m => m[1] ?? m[2]));
    for (const drop of ['boxzoomstart', 'boxzoomcancel', 'boxzoomend', 'click', 'wheel', 'stats', 'styleimagemissing', 'terrain', 'geolocate', 'error']) names.add(drop);
    for (const name of names) if (!eventsDoc.includes('`' + name + '`')) fail('docs/reference/events.md', `the event \`${name}\` of the map (MapEvents in src/host.ts) is not in the table of events`);
    for (const [file, word] of [['docs/reference/vue.md', '@moveend'], ['docs/reference/react.md', 'onMoveend'], ['docs/reference/svelte.md', 'listen('], ['docs/reference/element.md', 'map-moveend']]) if (!read(file).includes(word)) fail(file, `the document does not say how an event of the map reaches the application (expected "${word}")`);
}

// 6. Links between the documents, in every folder of docs/, lead to files that exist.
for (const doc of [...docs, 'CLAUDE.md', 'CONTRIBUTING.md'].filter(f => existsSync(path.join(root, f)))) {
    for (const [, target] of read(doc).matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (!existsSync(path.join(root, path.dirname(doc), target))) fail(doc, `the link to ${target} leads to no file`);
    }
}

// 7. Each number of a text and each kind of a check in src/mistakes.ts is taken once. Two branches that take the
//    same number merge with no conflict when they add different lines, and the later text would replace the other.
//    A new text or kind takes the number of its issue (see the comment in src/mistakes.ts), so branches do not meet.
{
    const m = read('src/mistakes.ts'), once = (what, numbers) => {
        const seen = new Set();
        for (const n of numbers) { if (seen.has(n)) fail('src/mistakes.ts', `the ${what} ${n} is taken twice. Give the newer one the number of its issue.`); seen.add(n); }
    };
    once('text', [...m.matchAll(/\/\* (\d+) \*\/ (?:\(|\w+ =>)|^texts\[(\d+)\] =/gm)].map(x => x[1] ?? x[2]));
    // The list of the fields of the description, which warns for any other field (#524), agrees with src/host.ts.
    const list = new Set(JSON.parse('[' + (m.match(/const descriptionFields = new Set\(\[([^\]]*)\]/)?.[1] ?? '').replaceAll("'", '"') + ']'));
    for (const f of spec) if (!list.has(f)) fail('src/mistakes.ts', `the field \`${f}\` of the description is not in descriptionFields, so it would warn as unknown`);
    for (const f of list) if (!spec.includes(f)) fail('src/mistakes.ts', `descriptionFields has \`${f}\`, which is not a field of the description in src/host.ts`);
    once('check kind', [...m.matchAll(/kind === (\d+)\)/g)].map(x => x[1]));
}

if (failures.length) { console.error('FAIL  the parts of the project do not agree:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log(`ok    consistency: ${spec.length} fields of the description, ${fields(host, 'MapInstance').length} members of the map, ${docs.length} documents`);
