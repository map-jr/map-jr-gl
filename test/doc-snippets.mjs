// Checks the code fences of docs/**/*.md as test/examples.mjs checks the example files: each `js`, `ts`, `jsx`, `vue`
// and `svelte` fence must compile, and must import only names that the entries of the library export.
// A fence is left out when it is a fragment on purpose: it is under a "Variations" heading, or its info string has
// `nocheck` (```js nocheck). A fence that has a line with only `…` or `...` is a fragment too.
// A checked fence must also use only names that it defines or imports or that a browser defines (#1652). A fence that
// continues an earlier one names what it takes from it with `uses=` (```js uses=map,style). A `vue` fence with the label
// `[Nuxt]` or with `nuxt` in its info string is a page of a Nuxt app, which may use what Nuxt and the module import.
//   node test/doc-snippets.mjs   (after pnpm build)
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {parse, compileScript, compileTemplate} from 'vue/compiler-sfc';
import {compile as compileSvelte} from 'svelte/compiler';
import {unknownImports} from './entry-exports.mjs';
import {undefinedNames} from './undefined-names.mjs';

const docs = path.resolve(import.meta.dirname, '../docs');
const {transformSync} = createRequire(import.meta.url)('esbuild');
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []);

/** What is wrong with a fence that is checked. A `ts` fence that is a declaration is checked only for its imports. */
const fenceProblems = (lang, info, code, declaration) => {
    const problems = unknownImports(code);
    if (declaration) return problems;
    try {
        // A fence with no <script> and no <template> shows markup for a template: wrap it.
        const source = lang === 'vue' && !/^\s*<(?:script|template)\b/m.test(code) ? `<template>\n${code}\n</template>` : code;
        if (lang === 'svelte') compileSvelte(code, {filename: 'snippet.svelte', generate: 'client'});
        else if (lang === 'vue') {
            const {descriptor, errors} = parse(source, {filename: 'snippet.vue'});
            problems.push(...errors.map(e => e.message));
            if (!errors.length) {
                const script = descriptor.script || descriptor.scriptSetup ? compileScript(descriptor, {id: 'snippet'}) : undefined;
                if (descriptor.template) problems.push(...compileTemplate({source: descriptor.template.content, filename: 'snippet.vue', id: 'snippet', compilerOptions: {bindingMetadata: script?.bindings}}).errors.map(e => e.message ?? String(e)));
            }
        } else transformSync(code, {loader: lang, jsx: 'automatic'});
        if (!problems.length) problems.push(...undefinedNames(lang === 'vue' && /\[Nuxt\]|\bnuxt\b/.test(info) ? 'snippet.nuxt.vue' : `snippet.${lang}`, source, info.match(/\buses=(\S+)/)?.[1].split(',')));
    } catch (e) { problems.push(String(e.message).split('\n')[0]); }
    return problems;
};

let failed = 0, checked = 0;
for (const file of walk(docs).sort()) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let section = '', open = null;
    lines.forEach((line, i) => {
        const fence = line.match(/^\s*(```+|~~~+)(.*)$/);
        if (!open) {
            if (fence) open = {line: i, info: fence[2].trim(), indent: line.match(/^\s*/)[0].length, body: []};
            else if (/^##\s/.test(line)) section = line.slice(3).trim();
            return;
        }
        if (!fence) { open.body.push(line.slice(Math.min(open.indent, line.match(/^\s*/)[0].length))); return; }
        const {info, body} = open, lang = info.split(/\s/)[0], code = body.join('\n'), at = open.line + 1;
        open = null;
        if (!['js', 'ts', 'jsx', 'vue', 'svelte'].includes(lang) || /\bnocheck\b/.test(info) || section === 'Variations') return;
        if (/^\s*(?:…|\.\.\.)\s*;?\s*$/m.test(code)) return;
        // A `ts` fence of the reference shows a declaration (a signature, an interface), which is not a program: only its imports are checked.
        const problems = fenceProblems(lang, info, code, lang === 'ts' && path.relative(docs, file).startsWith('reference' + path.sep));
        checked++;
        if (problems.length) { failed++; console.log(`FAIL  ${path.relative(path.dirname(docs), file)}:${at} the ${lang} fence: ${problems.join(' | ')}`); }
    });
}

// The check of undefined names finds a misspelled name in each kind of fence, and `uses=` and `nuxt` accept the
// names that a fence takes from elsewhere (#1652).
const selfChecks = [
    ['js', 'const metres = 1;\nconsole.log(meters);', ['meters is not defined']],
    ['ts', 'const metres: number = 1;\nconsole.log(meters);', ['meters is not defined']],
    ['jsx', 'export default function App() { return <MapJr />; }', ['MapJr is not defined']],
    ['svelte', '<script>let metres = $state(1);</script><p>{meters}</p>', ['meters is not defined']],
    ['vue', '<script setup>const metres = 1;</script><template><p>{{ meters }}</p></template>', ['the template uses meters, which is not defined']],
    ['vue', '<p>{{ meters }}</p>', ['the template uses meters, which is not defined']],
    ['vue nuxt', '<script setup>const unit = ref(1);</script><template><MapJr :controls="[scaleControll()]" /></template>', ['the template uses scaleControll, which is not defined']],
    ['js', "map.setCenter([0, 0]);", ['map is not defined']],
    ['js uses=map', "map.setCenter([0, 0]);", []],
    ['vue uses=height', '<p>{{ height }}</p>', []],
    ['vue [Nuxt]', '<script setup>const unit = ref(1);</script><template><MapJr :controls="[navigationControl()]" /></template>', []],
    ['vue', '<script setup>const unit = ref(1);</script><template><MapJr /></template>', ['<MapJr> is not imported', 'ref is not defined']],
    ['js', 'const worker = new Worker(new URL(\'./w.js\', import.meta.url)); worker.postMessage(document.title);', []],
];
for (const [info, code, expected] of selfChecks) {
    const found = fenceProblems(info.split(/\s/)[0], info, code, false), ok = expected.every(p => found.includes(p)) && (expected.length > 0 || found.length === 0);
    if (!ok) { failed++; console.log(`FAIL  the check of a \`${info}\` fence finds ${found.join(' | ') || 'nothing'}, not ${expected.join(' | ') || 'nothing'}: ${code}`); }
}
console.log(`doc-snippets: ${checked} fences checked, ${failed} failed (and ${selfChecks.length} checks of the check)`);
process.exit(failed ? 1 : 0);
