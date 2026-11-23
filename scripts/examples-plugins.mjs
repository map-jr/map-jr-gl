// The Vite plugins and aliases of the build of the harness page of the examples (scripts/site.mjs). An example imports
// the library by its package name, which points at the built files in dist/, as an application that installed the
// package gets it.
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
/** The entries of the package as the built files in dist/. */
export const alias = [{find: '@map-jr/map-jr-gl/controls', replacement: path.join(root, '../dist/controls.js')}, {find: '@map-jr/map-jr-gl/element', replacement: path.join(root, '../dist/element.js')}, {find: '@map-jr/map-jr-gl/svelte', replacement: path.join(root, '../dist/svelte.js')}, {find: '@map-jr/map-jr-gl/maplibre-compat', replacement: path.join(root, '../dist/map-jr-gl-maplibre-compat.js')}, {find: /^@map-jr\/map-jr-gl$/, replacement: path.join(root, '../dist/map-jr-gl.js')}];
/**
 * Loads an example file (examples/<id>.js or examples/<id>.compat.js) imported with `?mount` as a module whose default
 * export is a function. An example file is the module script of a page, so an import of it would run it once; the
 * function runs the code of the file each time that it is called and resolves with the map of the file, `map`. The
 * import declarations stay at the top of the module. The harness (examples/harness/mount.js) uses this.
 */
export const examplesAsFunctions = {
    name: 'map-jr-examples-as-functions',
    enforce: 'pre',
    transform(code, id) {
        if (/[\\/]examples[\\/][\w-]+\.html\?mount$/.test(id)) {
            // A <map-jr> form: `{markup, run}`, the elements of its page (without the head and the script) and its script.
            const script = code.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1] ?? '';
            const markup = code.replace(/<script[\s\S]*?<\/script>|<!--[\s\S]*?-->|<!doctype[^>]*>|<meta[^>]*>|<title>[\s\S]*?<\/title>/gi, '').trim();
            const imports = [], body = script.replace(/^\s*import\s[^;]*;$/gm, declaration => { imports.push(declaration.trim()); return ''; });
            return {code: `${imports.join('\n')}\nexport default {markup: ${JSON.stringify(markup)}, run() {\n${body}\n}};\n`, map: null};
        }
        if (!/[\\/]examples[\\/][\w-]+(\.compat)?\.js\?mount$/.test(id)) return;
        const imports = [], body = code.replace(/^import\s[^;]*;$/gm, declaration => { imports.push(declaration); return ''; });
        return {code: `${imports.join('\n')}\nexport default async function () {\n${body}\nreturn map;\n}\n`, map: null};
    },
};
const svelteEntry = path.join(root, '../dist/svelte.js'), svelteShim = path.join(root, '../examples/harness/svelte.js');
/**
 * Compiles the Svelte forms of the examples (examples/<id>.svelte) with svelte/compiler, a development dependency. An
 * import of `@map-jr/map-jr-gl/svelte` in such a file gets examples/harness/svelte.js, which keeps the map that the
 * action makes, so that the harness can return it (examples/harness/mount.js).
 */
export const svelteExamples = {
    name: 'map-jr-svelte-examples',
    enforce: 'pre',
    resolveId(source, importer) {
        if (importer && /\.svelte(\?|$)/.test(importer) && (source === '@map-jr/map-jr-gl/svelte' || path.resolve(source) === svelteEntry)) return svelteShim;
    },
    async transform(code, id) {
        if (!/\.svelte(\?mount)?$/.test(id)) return; // (not ?raw, which reads the file as text)
        const {compile} = await import('svelte/compiler');
        return {code: compile(code, {filename: id.split('?')[0], generate: 'client', css: 'injected'}).js.code, map: null};
    },
};
