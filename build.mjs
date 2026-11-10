// Builds the library with Vite. Run with: pnpm build   (add --sizes for a size report of partial imports)
import {build} from 'vite';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {mkdirSync, readFileSync, readdirSync, rmSync} from 'node:fs';

rmSync('dist', {recursive: true, force: true});
mkdirSync('dist', {recursive: true});

/** One Vite build. Everything is written to dist/ next to what earlier builds put there. */
const run = (options, define = {__WORKER_SRC__: '""'}) => build({
    configFile: false, logLevel: 'warn', define,
    build: {target: 'es2022', minify: true, emptyOutDir: false, outDir: 'dist', copyPublicDir: false, reportCompressedSize: false, modulePreload: false, ...options},
});

// The worker: tile parsing, and the whole rendering engine when a map renders off the main thread. A classic script,
// so it can be started from a blob or another origin.
await run({lib: {entry: 'src/worker.ts', formats: ['iife'], name: 'TesseraWorker', fileName: () => 'tessera-worker.js'}});
const workerSrc = readFileSync('dist/tessera-worker.js', 'utf8');

// The default build. The page loads tessera.js, which is small; it finds tessera-worker.js beside itself, and the
// engine for main-thread rendering is a separate chunk that is only fetched if that path is taken.
const esm = (input, extra = {}) => ({
    rollupOptions: {input, preserveEntrySignatures: 'strict', output: {format: 'es', entryFileNames: '[name].js', chunkFileNames: 'tessera-[name]-[hash].js', ...extra}},
});
await run(esm({tessera: 'src/index.ts'}));

// Standalone: one self-contained file with the worker embedded, for places where shipping several files is awkward.
await run(esm({'tessera-standalone': 'src/index.ts'}, {inlineDynamicImports: true}), {__WORKER_SRC__: JSON.stringify(workerSrc)});
// The server renderer (Node, Cloudflare Workers and other runtimes without a DOM).
await run(esm({server: 'src/server.ts'}, {inlineDynamicImports: true}));

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
const upfront = [...withStaticImports('tessera.js', fromDist)];
report('page script, up front (' + upfront.join(' + ') + ')', Buffer.concat(upfront.map(f => readFileSync('dist/' + f))));
report('tessera-worker.js (loaded in a worker)', readFileSync('dist/tessera-worker.js'));
for (const f of readdirSync('dist').filter(f => /^tessera-.*-[\w-]{8}\.js$/.test(f))) if (!upfront.includes(f)) report(`${f} (main-thread engine, on demand)`, readFileSync('dist/' + f));
report('tessera-standalone.js (everything in one file)', readFileSync('dist/tessera-standalone.js'));
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
