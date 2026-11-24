// Checks the example files (examples/*): each must compile, and must import only names that the
// entries of the library have. A Svelte form compiles with no warning, a <map-jr> form (.html) has the element and
// one module script, and a Nuxt form (.nuxt.vue) uses only the names that the module for Nuxt registers.
//   node test/examples.mjs   (after pnpm build)
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {parse, compileScript, compileTemplate} from 'vue/compiler-sfc';
import {compile as compileSvelte} from 'svelte/compiler';

const dir = path.resolve(import.meta.dirname, '../examples');
const {transformSync} = createRequire(import.meta.url)('esbuild');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

import {entries, unknownImports} from './entry-exports.mjs';

// The names that the module for Nuxt (src/nuxt.ts) registers: the components, and the controls as <name>Control.
const nuxtModule = readFileSync(path.resolve(import.meta.dirname, '../src/nuxt.ts'), 'utf8');
const nuxtList = pattern => [...(nuxtModule.match(pattern)?.[1] ?? '').matchAll(/'(\w+)'/g)].map(m => m[1]);
const nuxtComponents = new Set(nuxtList(/for \(const name of \[([^\]]*)\]\) addComponent/).flatMap(n => [n, 'Lazy' + n]));
const nuxtControls = new Set(nuxtList(/addImports\(\[([^\]]*)\]\.map\(name => \(\{name, as: name \+ 'Control'/).map(n => n + 'Control'));
/** What is wrong with a Nuxt form: it imports what the module or Nuxt imports, or uses a name that the module does not register. */
const nuxtProblems = code => [
    ...[...code.matchAll(/from '(vue|@map-jr\/map-jr-gl\/vue|@map-jr\/map-jr-gl\/controls)'/g)].map(m => `imports from ${m[1]}, which Nuxt and the module import`),
    ...[...code.matchAll(/\b(\w+Control)\(/g)].filter(m => !nuxtControls.has(m[1])).map(m => `${m[1]} is not a control of the module for Nuxt`),
    ...[...code.matchAll(/<((?:Lazy)?Map[A-Z]\w*)/g)].filter(m => !nuxtComponents.has(m[1])).map(m => `<${m[1]}> is not a component of the module for Nuxt`),
];

// (The folder also has the harness page, run.html, and its folder: only the example files are checked.)
for (const file of readdirSync(dir).filter(f => /\.(js|vue|jsx|svelte|html)$/.test(f) && f !== 'run.html').sort()) {
    const code = readFileSync(path.join(dir, file), 'utf8'), problems = unknownImports(code);
    try {
        if (file.endsWith('.svelte')) {
            const {warnings} = compileSvelte(code, {filename: file, generate: 'client'});
            problems.push(...warnings.map(w => `${w.code}: ${w.message.split('\n')[0]}`));
        } else if (file.endsWith('.html')) {
            // The <map-jr> form: a page with the element and one module script.
            const scripts = [...code.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]);
            if (scripts.length !== 1) problems.push(`has ${scripts.length} module scripts, not one`);
            if (!/<map-jr[\s>]/.test(code)) problems.push('has no <map-jr> element');
            for (const script of scripts) {
                if (!script.includes("import '@map-jr/map-jr-gl/element';")) problems.push("does not import '@map-jr/map-jr-gl/element'");
                transformSync(script, {loader: 'js'});
            }
        } else if (file.endsWith('.vue')) {
            if (file.endsWith('.nuxt.vue')) problems.push(...nuxtProblems(code));
            const {descriptor, errors} = parse(code, {filename: file});
            problems.push(...errors.map(e => e.message));
            const script = compileScript(descriptor, {id: file}), template = compileTemplate({source: descriptor.template.content, filename: file, id: file, compilerOptions: {bindingMetadata: script.bindings}});
            problems.push(...template.errors.map(e => e.message ?? String(e)));
        } else if (file.endsWith('.jsx')) transformSync(code, {loader: 'jsx', jsx: 'automatic'});
        else transformSync(code, {loader: 'js'});
    } catch (e) { problems.push(String(e.message).split('\n')[0]); }
    check(file, problems.length === 0, problems.join(' | '));
}
// The component tests of the recipes (examples/tests/*.test.js and .jsx) must compile too. They run with Vitest, which
// this repository does not install.
for (const file of readdirSync(path.join(dir, 'tests')).filter(f => /\.test\.jsx?$/.test(f)).sort()) {
    let problem = '';
    try { transformSync(readFileSync(path.join(dir, 'tests', file), 'utf8'), {loader: file.endsWith('.jsx') ? 'jsx' : 'js', jsx: 'automatic'}); } catch (e) { problem = String(e.message).split('\n')[0]; }
    check(`tests/${file}`, !problem, problem);
}

// TypeScript code must compile against the built types (dist/types): code that was written for MapLibre GL JS
// against the compat entry (test/types/maplibre-code.ts, and lines from real projects in test/types/maplibre-projects-code.ts), code for the main API (test/types/main-code.ts, and a style built with its style types in test/types/style-code.ts), a template ref on the Vue component (test/types/vue-code.ts), the names in `paint` and `layout` of each layer type (test/types/layer-types-code.ts), values typed with the types of maplibre-gl (test/types/maplibre-typed-code.ts), and the names of MapLibre GL JS that the compat entry exports as types (test/types/compat-exported-types-code.ts).
{
    const tsc = path.resolve(import.meta.dirname, '../node_modules/.bin/tsc'), run = spawnSync(tsc, ['-p', path.resolve(import.meta.dirname, 'types')], {encoding: 'utf8', shell: process.platform === 'win32'});
    const errors = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ?? ''}`.split('\n').filter(l => /error/i.test(l));
    for (const [file, entry] of [['maplibre-code.ts', '@map-jr/map-jr-gl/maplibre-compat'], ['maplibre-projects-code.ts', '@map-jr/map-jr-gl/maplibre-compat'], ['main-code.ts', '@map-jr/map-jr-gl'], ['style-code.ts', '@map-jr/map-jr-gl'], ['adapters-code.tsx', '@map-jr/map-jr-gl/react'], ['vue-code.ts', '@map-jr/map-jr-gl/vue'], ['layer-types-code.ts', '@map-jr/map-jr-gl/maplibre-compat'], ['maplibre-typed-code.ts', '@map-jr/map-jr-gl/maplibre-compat'], ['compat-exported-types-code.ts', '@map-jr/map-jr-gl/maplibre-compat'], ['exported-types-code.ts', '@map-jr/map-jr-gl']]) {
        // (An error that names neither file, such as missing built types, fails both checks.)
        const mine = errors.filter(l => l.includes(`/${file}`) || !/(maplibre|maplibre-projects|maplibre-typed|compat-exported-types|exported-types|main|style|adapters|vue|layer-types)-code\.tsx?/.test(l));
        check(`types/${file} (${entry})`, run.status === 0 || mine.length === 0, mine.slice(0, 5).join(' | '));
    }
}
process.exit(failed ? 1 : 0);
