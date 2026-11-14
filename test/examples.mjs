// Checks the example files of the gallery that the gallery shows as text and does not run (site/examples/*.vue and
// *.jsx): each must compile, and must import only names that the adapters and the other example files have.
//   node test/examples.mjs   (after pnpm build)
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {parse, compileScript, compileTemplate} from 'vue/compiler-sfc';

const dir = path.resolve(import.meta.dirname, '../site/examples'), dist = path.resolve(import.meta.dirname, '../dist');
const {transformSync} = createRequire(import.meta.url)('esbuild');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

// The names that each entry of the library has, from its built file.
const exportsOf = file => { const code = readFileSync(path.join(dist, file), 'utf8'), last = [...code.matchAll(/export\s*\{([^}]*)\}/g)].flatMap(m => m[1].split(',').map(p => p.trim().split(/\s+as\s+/).pop())); return new Set(last.filter(Boolean)); };
const entries = {'@map-jr/map-jr-gl': exportsOf('map-jr-gl.js'), '@map-jr/map-jr-gl/vue': exportsOf('vue.js'), '@map-jr/map-jr-gl/react': exportsOf('react.js'), '@map-jr/map-jr-gl/controls': exportsOf('controls.js'), '@map-jr/map-jr-gl/maplibre-compat': exportsOf('map-jr-gl-maplibre-compat.js')};
const unknownImports = code => [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(@map-jr\/map-jr-gl[^']*)'/g)].flatMap(m => m[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]).filter(n => n && !entries[m[2]]?.has(n)).map(n => `${n} from ${m[2]}`));

for (const file of readdirSync(dir).sort()) {
    const code = readFileSync(path.join(dir, file), 'utf8'), problems = unknownImports(code);
    try {
        if (file.endsWith('.vue')) {
            const {descriptor, errors} = parse(code, {filename: file});
            problems.push(...errors.map(e => e.message));
            const script = compileScript(descriptor, {id: file}), template = compileTemplate({source: descriptor.template.content, filename: file, id: file, compilerOptions: {bindingMetadata: script.bindings}});
            problems.push(...template.errors.map(e => e.message ?? String(e)));
        } else if (file.endsWith('.jsx')) transformSync(code, {loader: 'jsx', jsx: 'automatic'});
        else transformSync(code, {loader: 'js'});
    } catch (e) { problems.push(String(e.message).split('\n')[0]); }
    check(file, problems.length === 0, problems.join(' | '));
}

// TypeScript code must compile against the built types (dist/types): code that was written for MapLibre GL JS
// against the compat entry (test/types/maplibre-code.ts, and lines from real projects in test/types/maplibre-projects-code.ts), code for the main API (test/types/main-code.ts, and a style built with its style types in test/types/style-code.ts), a template ref on the Vue component (test/types/vue-code.ts), and the names in `paint` and `layout` of each layer type (test/types/layer-types-code.ts).
{
    const tsc = path.resolve(import.meta.dirname, '../node_modules/.bin/tsc'), run = spawnSync(tsc, ['-p', path.resolve(import.meta.dirname, 'types')], {encoding: 'utf8', shell: process.platform === 'win32'});
    const errors = `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ?? ''}`.split('\n').filter(l => /error/i.test(l));
    for (const [file, entry] of [['maplibre-code.ts', '@map-jr/map-jr-gl/maplibre-compat'], ['maplibre-projects-code.ts', '@map-jr/map-jr-gl/maplibre-compat'], ['main-code.ts', '@map-jr/map-jr-gl'], ['style-code.ts', '@map-jr/map-jr-gl'], ['adapters-code.tsx', '@map-jr/map-jr-gl/react'], ['vue-code.ts', '@map-jr/map-jr-gl/vue'], ['layer-types-code.ts', '@map-jr/map-jr-gl/maplibre-compat']]) {
        // (An error that names neither file, such as missing built types, fails both checks.)
        const mine = errors.filter(l => l.includes(file) || !/(maplibre|maplibre-projects|main|style|adapters|vue|layer-types)-code\.tsx?/.test(l));
        check(`types/${file} (${entry})`, run.status === 0 || mine.length === 0, mine.slice(0, 5).join(' | '));
    }
}
process.exit(failed ? 1 : 0);
