// Finds the names that a piece of code uses and does not define (#1564, #1652). test/examples.mjs checks the example
// files with it, and test/doc-snippets.mjs checks the code fences of docs/.
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {parse, compileScript, compileTemplate, babelParse, walkIdentifiers, extractIdentifiers} from 'vue/compiler-sfc';
import {compile as compileSvelte} from 'svelte/compiler';

const {transformSync} = createRequire(import.meta.url)('esbuild');

// The names that the module for Nuxt (src/nuxt.ts) registers: the components, and the controls as <name>Control.
const nuxtModule = readFileSync(path.resolve(import.meta.dirname, '../src/nuxt.ts'), 'utf8');
const nuxtList = pattern => [...(nuxtModule.match(pattern)?.[1] ?? '').matchAll(/'(\w+)'/g)].map(m => m[1]);
export const nuxtComponents = new Set(nuxtList(/for \(const name of \[([^\]]*)\]\) addComponent/).flatMap(n => [n, 'Lazy' + n]));
export const nuxtControls = new Set(nuxtList(/addImports\(\[([^\]]*)\]\.map\(name => \(\{name, as: name \+ 'Control'/).map(n => n + 'Control'));
// What Nuxt imports into a page by itself: the API of Vue, and the composables and the controls of the module.
const nuxtImports = new Set([...Object.keys(await import('vue')), ...nuxtList(/addImports\(\[([^\]]*)\]\.map\(name => \(\{name, from: vue/), ...nuxtControls]);

// The names that a page has without a declaration, which are those of the browser. Node has most of them. The names
// that only Node has are left out, and the names that only a browser has are listed.
const globals = new Set([
    ...Object.getOwnPropertyNames(globalThis).filter(n => !['process', 'Buffer', 'global', 'setImmediate', 'clearImmediate'].includes(n)),
    'window', 'document', 'location', 'history', 'localStorage', 'sessionStorage', 'customElements', 'HTMLElement', 'Element', 'Node',
    'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'getComputedStyle', 'alert', 'innerWidth', 'innerHeight',
    'devicePixelRatio', 'Image', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'HTMLCanvasElement', 'OffscreenCanvas', 'Worker',
]);

/** The names that a module uses and neither declares nor imports, and that are not in `known`. */
const freeNames = (code, known) => {
    const ast = babelParse(code, {sourceType: 'module'}), declared = new Set(), names = new Set();
    // (walkIdentifiers knows the declarations in functions and blocks, but not those at the top of the module.)
    for (let s of ast.program.body) {
        if (s.type === 'ImportDeclaration') for (const spec of s.specifiers) declared.add(spec.local.name);
        if (/^Export(Named|Default)Declaration$/.test(s.type) && s.declaration) s = s.declaration;
        if (s.type === 'VariableDeclaration') for (const d of s.declarations) for (const id of extractIdentifiers(d.id)) declared.add(id.name);
        else if (/^(Function|Class)Declaration$/.test(s.type) && s.id) declared.add(s.id.name);
    }
    // (walkIdentifiers fails on a module with no statement, such as a fence of TypeScript that declares only a type.)
    if (ast.program.body.length) walkIdentifiers(ast.program, id => { if (!declared.has(id.name) && !known.has(id.name)) names.add(id.name); });
    return [...names];
};
const templateNames = (js, known) => [...new Set([...js.matchAll(/\b_ctx\.(\w+)/g)].map(m => m[1]))].filter(n => !known.has(n))
    .map(n => `the template uses ${n}, which is not defined`);

/**
 * The names that a file uses and does not define, as messages. The kind of the file comes from its name (.js, .ts,
 * .jsx, .html, .svelte, .vue, and .nuxt.vue for a page of a Nuxt app), and each kind is compiled to the module that
 * runs. `assumed` lists names that the code may use without defining them (a fence of the docs that is a fragment).
 */
export const undefinedNames = (file, code, assumed = []) => {
    const nuxt = file.endsWith('.nuxt.vue'), known = new Set([...globals, ...assumed, ...nuxt ? nuxtImports : []]), problems = [];
    let js = '';
    if (file.endsWith('.svelte')) js = compileSvelte(code, {filename: file, generate: 'client'}).js.code;
    else if (file.endsWith('.html')) js = [...code.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
    else if (file.endsWith('.vue')) {
        const {descriptor} = parse(code, {filename: file});
        if (descriptor.scriptSetup) {
            // The template becomes a part of the setup function. A name in the template that the script does not
            // define becomes `_ctx.<name>`, and a component that the script does not import becomes
            // `resolveComponent("<name>")`.
            js = compileScript(descriptor, {id: file, inlineTemplate: true}).content;
            problems.push(...templateNames(js, known));
            // (A Nuxt page leaves the import of a component to Nuxt, and test/examples.mjs checks its name.)
            if (!nuxt) problems.push(...[...js.matchAll(/_resolveComponent\("([^"]+)"/g)].map(m => `<${m[1]}> is not imported`));
        } else {
            // A component with `<script>` and no `<script setup>`, or a template alone: the names of the template come
            // from the component, which this check does not read, so only the script is checked.
            if (descriptor.script) js = compileScript(descriptor, {id: file}).content;
            else if (descriptor.template) problems.push(...templateNames(compileTemplate({source: descriptor.template.content, filename: file, id: file}).code, known));
        }
    } else js = transformSync(code, {loader: file.match(/\.(js|ts|jsx|tsx)$/)[1], jsx: 'automatic'}).code;
    return [...problems, ...freeNames(js, known).map(n => `${n} is not defined`)];
};
