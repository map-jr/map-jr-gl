import {build} from 'esbuild';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';

const common = {bundle: true, minify: true, target: 'es2022', logLevel: 'warning'};
rmSync('dist', {recursive: true, force: true});
mkdirSync('dist', {recursive: true});

// The worker: tile parsing, and the whole rendering engine when a map renders off the main thread.
const worker = await build({...common, entryPoints: ['src/worker.ts'], format: 'iife', write: false});
const workerSrc = worker.outputFiles[0].text;
writeFileSync('dist/tessera-worker.js', workerSrc);

// The default build. The page loads tessera.js, which is small; it finds tessera-worker.js beside itself, and the
// engine for main-thread rendering is a separate chunk that is only fetched if that path is taken.
const main = await build({...common, entryPoints: {tessera: 'src/index.ts'}, format: 'esm', outdir: 'dist', splitting: true, metafile: true,
    chunkNames: 'tessera-[name]-[hash]', define: {__WORKER_SRC__: '""'}});

// Standalone: one self-contained file with the worker embedded, for places where shipping several files is awkward.
await build({...common, entryPoints: ['src/index.ts'], format: 'esm', outfile: 'dist/tessera-standalone.js', define: {__WORKER_SRC__: JSON.stringify(workerSrc)}});
await build({...common, entryPoints: ['src/server.ts'], format: 'esm', platform: 'node', outfile: 'dist/server.js', define: {__WORKER_SRC__: '""'}});

const kb = n => (n / 1024).toFixed(1).padStart(6);
const report = (label, bytes) => console.log(label.padEnd(46), `${kb(bytes.length)} KB min ${kb(gzipSync(bytes, {level: 9}).length)} KB gzip ${kb(brotliCompressSync(bytes).length)} KB brotli`);
const chunks = readdirSync('dist').filter(f => /^tessera-.*-[A-Z0-9]{8}\.js$/.test(f));
// What the page itself downloads up front: the entry plus any chunk it imports statically.
const entry = main.metafile.outputs['dist/tessera.js'], upfront = ['dist/tessera.js', ...entry.imports.filter(i => i.kind === 'import-statement').map(i => i.path)];
report('page script, up front (' + upfront.map(f => f.replace('dist/', '')).join(' + ') + ')', Buffer.concat(upfront.map(f => readFileSync(f))));
report('tessera-worker.js (loaded in a worker)', readFileSync('dist/tessera-worker.js'));
for (const f of chunks) if (!upfront.includes('dist/' + f)) report(`${f} (main-thread engine, on demand)`, readFileSync('dist/' + f));
report('tessera-standalone.js (everything in one file)', readFileSync('dist/tessera-standalone.js'));
report('server.js', readFileSync('dist/server.js'));

if (process.argv.includes('--sizes')) {
    // What an application's own bundler ends up with when it imports only part of the library.
    const only = async (label, code) => {
        const r = await build({...common, stdin: {contents: code, resolveDir: '.', loader: 'ts'}, format: 'esm', outdir: 'out', splitting: true, write: false, define: {__WORKER_SRC__: '""'}});
        // The entry and every chunk it imports statically (dynamic imports are fetched later, if ever).
        const text = Object.fromEntries(r.outputFiles.map(f => [f.path.split('/').pop(), f.text])), seen = new Set(), walk = name => {
            if (seen.has(name)) return; seen.add(name);
            for (const m of text[name].matchAll(/from"\.\/([^"]+)"/g)) walk(m[1]);
        };
        walk('stdin.js');
        report(label, Buffer.from([...seen].map(n => text[n]).join('')));
    };
    console.log('\nPage script when importing selectively (tree-shaken):');
    await only('Map', `export {Map} from './src/map.ts'`);
    await only('Map + NavigationControl + ScaleControl', `export {Map} from './src/map.ts'; export {NavigationControl, ScaleControl} from './src/controls.ts'`);
    await only('Map + Marker + Popup', `export {Map} from './src/map.ts'; export {Marker, Popup} from './src/overlays.ts'`);
    await only('everything (index)', `export * from './src/index.ts'`);
}
