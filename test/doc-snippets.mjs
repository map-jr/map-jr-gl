// Checks the code fences of docs/**/*.md as test/examples.mjs checks the example files: each `js`, `ts`, `jsx`, `vue`
// and `svelte` fence must compile, and must import only names that the entries of the library export.
// A fence is left out when it is a fragment on purpose: it is under a "Variations" heading, or its info string has
// `nocheck` (```js nocheck). A fence that has a line with only `…` or `...` is a fragment too.
//   node test/doc-snippets.mjs   (after pnpm build)
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {parse, compileScript, compileTemplate} from 'vue/compiler-sfc';
import {compile as compileSvelte} from 'svelte/compiler';
import {unknownImports} from './entry-exports.mjs';

const docs = path.resolve(import.meta.dirname, '../docs');
const {transformSync} = createRequire(import.meta.url)('esbuild');
const walk = dir => readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []);

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
        const problems = unknownImports(code);
        // A `ts` fence of the reference shows a declaration (a signature, an interface), which is not a program: only its imports are checked.
        const declaration = lang === 'ts' && path.relative(docs, file).startsWith('reference' + path.sep);
        try {
            if (declaration) return void (checked++, problems.length && (failed++, console.log(`FAIL  ${path.relative(path.dirname(docs), file)}:${at} the ${lang} fence: ${problems.join(' | ')}`)));
            if (lang === 'svelte') compileSvelte(code, {filename: 'snippet.svelte', generate: 'client'});
            else if (lang === 'vue') {
                // A fence with no <script> and no <template> shows markup for a template: wrap it.
                const source = /^\s*<(?:script|template)\b/m.test(code) ? code : `<template>\n${code}\n</template>`;
                const {descriptor, errors} = parse(source, {filename: 'snippet.vue'});
                problems.push(...errors.map(e => e.message));
                if (!errors.length) {
                    const script = descriptor.script || descriptor.scriptSetup ? compileScript(descriptor, {id: 'snippet'}) : undefined;
                    if (descriptor.template) problems.push(...compileTemplate({source: descriptor.template.content, filename: 'snippet.vue', id: 'snippet', compilerOptions: {bindingMetadata: script?.bindings}}).errors.map(e => e.message ?? String(e)));
                }
            } else transformSync(code, {loader: lang, jsx: 'automatic'});
        } catch (e) { problems.push(String(e.message).split('\n')[0]); }
        checked++;
        if (problems.length) { failed++; console.log(`FAIL  ${path.relative(path.dirname(docs), file)}:${at} the ${lang} fence: ${problems.join(' | ')}`); }
    });
}
console.log(`doc-snippets: ${checked} fences checked, ${failed} failed`);
process.exit(failed ? 1 : 0);
