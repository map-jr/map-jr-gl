// Bundles the worker and runs it in workerd (Cloudflare's runtime) through Miniflare: node test/cloudflare/run.mjs [outDir]
import {build} from 'esbuild';
import {Miniflare} from 'miniflare';
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import path from 'node:path';

const dir = import.meta.dirname, out = process.argv[2];
const bundle = await build({entryPoints: [path.join(dir, 'worker.js')], bundle: true, format: 'esm', minify: true, write: false, external: ['./takumi.wasm'], conditions: ['workerd', 'worker', 'browser']});
const script = bundle.outputFiles[0].text;
const wasm = readFileSync(createRequire(import.meta.url).resolve('@takumi-rs/wasm/takumi_wasm_bg.wasm'));
console.log(`worker script ${(gzipSync(script).length / 1024).toFixed(0)} KB gzip, wasm ${(gzipSync(wasm).length / 1024).toFixed(0)} KB gzip`);
const mf = new Miniflare({
    modules: [{type: 'ESModule', path: 'worker.js', contents: script}, {type: 'CompiledWasm', path: 'takumi.wasm', contents: wasm}],
    compatibilityDate: '2025-01-01', bindings: {TILES: 'http://localhost:8080/tiles/{z}/{x}/{y}.pbf'},
});
let failed = false;
for (const p of ['/map.svg', '/map.jpg', '/map.jpg', '/contours.svg']) {
    const res = await mf.dispatchFetch('http://worker' + p), body = Buffer.from(await res.arrayBuffer());
    const ok = res.status === 200 && body.length > 10000;
    failed ||= !ok;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${p} -> ${res.status} ${res.headers.get('content-type')} ${(body.length / 1024).toFixed(0)} KB in ${res.headers.get('x-render-ms')} ms${ok ? '' : ' ' + body.toString().slice(0, 300)}`);
    if (out && ok) writeFileSync(path.join(out, 'cloudflare' + path.extname(p)), body);
}
await mf.dispose();
process.exit(failed ? 1 : 0);
