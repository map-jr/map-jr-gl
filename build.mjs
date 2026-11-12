// Builds the library with Vite. Run with: pnpm build   (add --sizes for a size report of partial imports)
import {build} from 'vite';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {mkdirSync, readFileSync, readdirSync, rmSync} from 'node:fs';
import {shortenPrivateNames} from './scripts/private-names.mjs';

const privates = shortenPrivateNames();

rmSync('dist', {recursive: true, force: true});
mkdirSync('dist', {recursive: true});

/**
 * Makes the shader programs smaller: the GLSL in src/gl.ts keeps its comments and layout in the source, but the built
 * files do not need them. Only whitespace and comments change, so the programs stay the same.
 */
const shaders = {
    name: 'minify-shaders',
    transform(code, id) {
        if (!id.endsWith('/src/gl.ts')) return null;
        return {map: null, code: code.replace(/`((?:[^`\\]|\\.)*)`/gs, (all, text) => /void main|uniform |\bfloat /.test(text)
            // (Spaces also go from around the operators, but not from around + and -: `a - -b` must not become `a--b`.)
            ? '`' + text.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{};,()=*\/<>?:!&|]) ?/g, '$1').trim() + '`' : all)};
    },
};

/**
 * For a built file that contains everything (the worker, the server renderer): the style resolver loads the PMTiles
 * reader on demand, which is correct for the page script only. Here the reader is in the file anyway, so the import
 * becomes a normal one and the code that loads a module on demand is not needed.
 */
const allInOne = {
    name: 'all-in-one',
    enforce: 'pre',
    transform(code, id) {
        const lazy = "await import('./pmtiles-info.ts')";
        if (!id.endsWith('/src/resolve.ts') || !code.includes(lazy)) return null;
        return {code: "import * as pmtilesInfo from './pmtiles-info.ts';\n" + code.replace(lazy, 'pmtilesInfo'), map: null};
    },
};

/**
 * Vite puts a helper around each `import()` that loads the CSS files and the other chunks of the imported file first.
 * The library has no CSS files, and a chunk imports what it needs itself, so the helper is replaced by a plain call.
 */
const noPreload = {
    name: 'no-preload-helper',
    enforce: 'pre',
    load: id => id === '\0vite/preload-helper.js' ? 'export const __vitePreload = load => load();' : null,
};

/** One Vite build. Everything is written to dist/ next to what earlier builds put there. */
const run = (options, define = {__WORKER_SRC__: '""'}, plugins = []) => build({
    configFile: false, logLevel: 'warn', define, plugins: [shaders, privates, noPreload, ...plugins],
    build: {target: 'es2022', minify: true, emptyOutDir: false, outDir: 'dist', copyPublicDir: false, reportCompressedSize: false, modulePreload: false, ...options},
});

// The worker: tile parsing, and the whole rendering engine when a map renders off the main thread. A classic script,
// so it can be started from a blob or another origin.
await run({lib: {entry: 'src/worker.ts', formats: ['iife'], name: 'MapJrWorker', fileName: () => 'map-jr-gl-worker.js'}}, undefined, [allInOne]);
const workerSrc = readFileSync('dist/map-jr-gl-worker.js', 'utf8');

// The default build. The page loads map-jr-gl.js, which is small; it finds map-jr-gl-worker.js beside itself, and the
// engine for main-thread rendering is a separate chunk that is only fetched if that path is taken.
const esm = (input, extra = {}) => ({
    rollupOptions: {input, external: ['vue', 'react', 'react-dom', '@nuxt/kit', 'map-jr-gl/server'], preserveEntrySignatures: 'strict', output: {format: 'es', entryFileNames: '[name].js', chunkFileNames: 'map-jr-gl-[name]-[hash].js',
        // (The map and the styles of its controls are always loaded together: one file is smaller after gzip than two.)
        ...(extra.codeSplitting === false ? {} : {manualChunks: id => /src[\\/](map|controls|lnglat|markers|overlays)\.ts$/.test(id) ? 'map' : undefined}), ...extra}},
});
// Two entries in one build, so that they share their chunks: the main entry (the new API) and the entry that is a
// replacement for MapLibre GL JS.
// (The adapters for the frameworks are entries of the same build: they use the main entry's files. The framework itself is not in them.)
await run(esm({'map-jr-gl': 'src/index.ts', 'map-jr-gl-maplibre-compat': 'src/maplibre-compat.ts', vue: 'src/vue.ts', react: 'src/react.ts', svelte: 'src/svelte.ts', nuxt: 'src/nuxt.ts', controls: 'src/control-specs.ts'}));

// Standalone: one self-contained file with the worker embedded, for places where shipping several files is awkward.
// (One for each of the two APIs.)
await run(esm({'map-jr-gl-standalone': 'src/standalone.ts'}, {codeSplitting: false}), {__WORKER_SRC__: JSON.stringify(workerSrc)});
await run(esm({'map-jr-gl-maplibre-compat-standalone': 'src/maplibre-compat.ts'}, {codeSplitting: false}), {__WORKER_SRC__: JSON.stringify(workerSrc)});
// The server renderer (Node, Cloudflare Workers and other runtimes without a DOM).
await run(esm({server: 'src/server.ts'}, {codeSplitting: false}), undefined, [allInOne]);

const kb = n => (n / 1024).toFixed(1).padStart(6);
const report = (label, bytes) => console.log(label.padEnd(46), `${kb(bytes.length)} KB min ${kb(gzipSync(bytes, {level: 9}).length)} KB gzip ${kb(brotliCompressSync(bytes).length)} KB brotli`);
/** A file and every chunk it imports statically (dynamic imports are fetched later, if ever). */
const withStaticImports = (name, read, seen = new Set()) => {
    if (seen.has(name)) return seen;
    seen.add(name);
    for (const m of read(name).matchAll(/(?:from|import)\s*["']\.\/([^"']+)["']/g)) if (!new RegExp(`import\\(\\s*["']\\./${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(read(name))) withStaticImports(m[1], read, seen);
    return seen;
};
const fromDist = name => readFileSync('dist/' + name, 'utf8');
const upfront = [...withStaticImports('map-jr-gl.js', fromDist)];
report('page script, up front (' + upfront.join(' + ') + ')', Buffer.concat(upfront.map(f => readFileSync('dist/' + f))));
report('map-jr-gl-worker.js (loaded in a worker)', readFileSync('dist/map-jr-gl-worker.js'));
for (const f of readdirSync('dist').filter(f => /^map-jr-gl-.*-[\w-]{8}\.js$/.test(f))) if (!upfront.includes(f)) report(`${f} (main-thread engine, on demand)`, readFileSync('dist/' + f));
report('map-jr-gl-standalone.js (everything in one file)', readFileSync('dist/map-jr-gl-standalone.js'));
report('server.js', readFileSync('dist/server.js'));

if (process.argv.includes('--sizes')) {
    // What an application's own bundler ends up with when it imports only part of the library.
    const only = async (label, code) => {
        const virtual = {name: 'virtual-entry', resolveId: id => id === 'virtual:entry' ? '\0entry.ts' : null, load: id => id === '\0entry.ts' ? code : null};
        const out = await build({configFile: false, logLevel: 'silent', define: {__WORKER_SRC__: '""'}, plugins: [virtual],
            build: {write: false, target: 'es2022', minify: true, modulePreload: false, rollupOptions: {input: {entry: 'virtual:entry'}, preserveEntrySignatures: 'strict', output: {format: 'es', entryFileNames: '[name].js', chunkFileNames: '[name]-[hash].js'}}}});
        const text = Object.fromEntries((Array.isArray(out) ? out[0] : out).output.filter(o => o.type === 'chunk').map(o => [o.fileName, o.code]));
        report(label, Buffer.from([...withStaticImports('entry.js', n => text[n])].map(n => text[n]).join('')));
    };
    const src = process.cwd() + '/src';
    console.log('\nPage script when importing selectively (tree-shaken):');
    await only('Map', `export {Map} from '${src}/map.ts'`);
    await only('Map + NavigationControl + ScaleControl', `export {Map} from '${src}/map.ts'; export {NavigationControl, ScaleControl} from '${src}/controls.ts'`);
    await only('Map + Marker + Popup', `export {Map} from '${src}/map.ts'; export {Marker, Popup} from '${src}/overlays.ts'`);
    await only('everything (index)', `export * from '${src}/index.ts'`);
}
