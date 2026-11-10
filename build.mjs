import {build} from 'esbuild';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {readFileSync, writeFileSync} from 'node:fs';

const common = {bundle: true, minify: true, target: 'es2022', logLevel: 'warning'};
// The worker is built first and embedded in the main bundle, so the library is a single file to deploy.
const worker = await build({...common, entryPoints: ['src/worker.ts'], format: 'iife', write: false});
const workerSrc = worker.outputFiles[0].text;
writeFileSync('dist/tessera-worker.js', workerSrc);
await build({...common, entryPoints: ['src/index.ts'], format: 'esm', outfile: 'dist/tessera.js', define: {__WORKER_SRC__: JSON.stringify(workerSrc)}});
await build({...common, entryPoints: ['src/server.ts'], format: 'esm', platform: 'node', outfile: 'dist/server.js'});

for (const f of ['tessera.js', 'tessera-worker.js', 'server.js']) {
    const b = readFileSync('dist/' + f);
    console.log(f.padEnd(20), `${(b.length / 1024).toFixed(1)} KB min`, `${(gzipSync(b, {level: 9}).length / 1024).toFixed(1)} KB gzip`, `${(brotliCompressSync(b).length / 1024).toFixed(1)} KB brotli`);
}
