import {build} from 'esbuild';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const common = {bundle: true, minify: true, target: 'es2022', logLevel: 'warning'};
mkdirSync('dist', {recursive: true});
// The worker is built first. The all-in-one bundle embeds it, so the library is a single file to deploy.
const worker = await build({...common, entryPoints: ['src/worker.ts'], format: 'iife', write: false});
const workerSrc = worker.outputFiles[0].text;
writeFileSync('dist/tessera-worker.js', workerSrc);
const full = await build({...common, entryPoints: ['src/index.ts'], format: 'esm', outfile: 'dist/tessera.js', metafile: true,
    define: {__WORKER_SRC__: JSON.stringify(workerSrc), __SLIM__: 'false'}});
// The slim build leaves the engine out of the page's own script: it always renders in a worker fetched from
// `workerUrl` (tessera-worker.js), so the main thread downloads and parses far less.
await build({...common, entryPoints: ['src/index.ts'], format: 'esm', outfile: 'dist/tessera-slim.js', define: {__WORKER_SRC__: '""', __SLIM__: 'true'}});
await build({...common, entryPoints: ['src/server.ts'], format: 'esm', platform: 'node', outfile: 'dist/server.js'});

const kb = n => (n / 1024).toFixed(1).padStart(6);
const report = (label, bytes) => console.log(label.padEnd(44), `${kb(bytes.length)} KB min ${kb(gzipSync(bytes, {level: 9}).length)} KB gzip ${kb(brotliCompressSync(bytes).length)} KB brotli`);
for (const f of ['tessera.js', 'tessera-slim.js', 'tessera-worker.js', 'server.js']) report(f, readFileSync('dist/' + f));

if (process.argv.includes('--sizes')) {
    // What individual imports cost when an application bundles the library itself (tree-shaken), slim variant.
    const slim = {__WORKER_SRC__: '""', __SLIM__: 'true'};
    const only = async (label, code, define = slim) => {
        const r = await build({...common, stdin: {contents: code, resolveDir: '.', loader: 'ts'}, format: 'esm', write: false, define});
        report(label, Buffer.from(r.outputFiles[0].text));
    };
    console.log('\nImported individually (slim, tree-shaken):');
    await only('Map', `export {Map} from './src/map.ts'`);
    await only('Map + NavigationControl + ScaleControl', `export {Map} from './src/map.ts'; export {NavigationControl, ScaleControl} from './src/controls.ts'`);
    await only('Map + Marker + Popup', `export {Map} from './src/map.ts'; export {Marker, Popup} from './src/overlays.ts'`);
    await only('everything (index)', `export * from './src/index.ts'`);
    await only('Map with its own engine, no embedded worker', `export {Map} from './src/map.ts'`, {__WORKER_SRC__: '""', __SLIM__: 'false'});
    // Where the bytes of the all-in-one bundle come from.
    const out = Object.values(full.metafile.outputs)[0], rows = Object.entries(out.inputs).map(([f, v]) => [f.replace('src/', ''), v.bytesInOutput]).sort((a, b) => b[1] - a[1]);
    console.log('\nAll-in-one bundle by module (minified bytes; the embedded worker is counted under map.ts):');
    for (const [f, n] of rows.slice(0, 16)) console.log('  ' + f.padEnd(28), kb(n), 'KB');
}
