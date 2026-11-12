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

// 1. Each field of the description is in the documents of the main API.
const host = read('src/host.ts'), spec = [...new Set([...fields(host, 'MapSetup'), ...fields(host, 'MapSpec')])];
const api = read('docs/api.md');
for (const f of spec) if (!api.includes('`' + f + '`')) fail('docs/api.md', `the field \`${f}\` of the description (src/host.ts) is not mentioned`);

// 2. Each field of the description is a prop (or an event) of the Vue component, and is in its document.
//    A field that Vue gives in another way is named here with the reason.
const vueOther = {style: 'the prop mapStyle', onViewChange: 'v-model:view', onClick: 'the event click', onError: 'the event error'};
const vue = read('src/vue.ts'), vueDoc = read('docs/vue.md');
const props = vue.slice(vue.indexOf('    props: {'), vue.indexOf('    emits: {'));
for (const f of spec) {
    if (vueOther[f]) continue;
    if (!new RegExp(`(^|[\\s,{])${f}:`, 'm').test(props)) fail('src/vue.ts', `the component MapJr has no prop for the field \`${f}\` of the description`);
    if (!vueDoc.includes('`' + kebab(f) + '`') && !vueDoc.includes('`' + f + '`') && !vueDoc.includes(':' + kebab(f)) && !vueDoc.includes(kebab(f) + '=')) fail('docs/vue.md', `the prop \`${kebab(f)}\` is not mentioned`);
}

// 3. Each member of the map object of the main API is in its document.
for (const m of fields(host, 'MapHost')) if (!api.includes(m)) fail('docs/api.md', `the member \`${m}\` of the map (MapHost in src/host.ts) is not mentioned`);

// 4. Each row of the gallery has its four forms.
const examples = readdirSync(path.join(root, 'site/examples'));
for (const row of new Set(examples.map(f => f.split('.')[0]))) {
    for (const ext of ['.js', '.vue', '.jsx', '.compat.js']) if (!examples.includes(row + ext)) fail('site/examples', `the example "${row}" has no ${ext} form`);
}

// 5. Each entry of the package has its source file, and a document names it.
const pkg = JSON.parse(read('package.json')), docs = ['README.md', ...readdirSync(path.join(root, 'docs')).filter(f => f.endsWith('.md')).map(f => 'docs/' + f)];
const allDocs = docs.map(read).join('\n');
for (const entry of Object.keys(pkg.exports ?? {})) {
    if (entry === '.' || entry === './package.json') continue;
    const name = '@map-jr/map-jr-gl' + entry.slice(1);
    if (!allDocs.includes(name)) fail('docs', `no document mentions the entry \`${name}\` (package.json "exports")`);
}

// 6. Links between the documents lead to files that exist.
for (const doc of [...docs, 'CLAUDE.md', 'CONTRIBUTING.md'].filter(f => existsSync(path.join(root, f)))) {
    for (const [, target] of read(doc).matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (!existsSync(path.join(root, path.dirname(doc), target))) fail(doc, `the link to ${target} leads to no file`);
    }
}

if (failures.length) { console.error('FAIL  the parts of the project do not agree:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
console.log(`ok    consistency: ${spec.length} fields of the description, ${fields(host, 'MapHost').length} members of the map, ${docs.length} documents`);
