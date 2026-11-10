// Writes the current test and MapLibre coverage figures into the README, between the status markers.
// Run with: pnpm status   (run `pnpm build` first; `pnpm test:render` refreshes the render-test totals)
import {execSync} from 'node:child_process';
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

const root = new URL('..', import.meta.url).pathname;
const run = cmd => { try { return execSync(cmd, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}); } catch (e) { return String(e.stdout ?? '') + String(e.stderr ?? ''); } };
const num = (text, re) => +(re.exec(text)?.[1] ?? NaN);

const unit = run('node --experimental-transform-types --no-warnings --test test/unit/*.test.ts');
const expr = run('node test/conformance/expressions.mjs');
const api = run('node test/conformance/api.mjs --write');
const render = existsSync(root + 'test/conformance/render-result.json') ? JSON.parse(readFileSync(root + 'test/conformance/render-result.json', 'utf8')) : null;
const gz = file => (gzipSync(readFileSync(root + 'dist/' + file), {level: 9}).length / 1024).toFixed(0);
const chunk = readdirSync(root + 'dist').find(f => /^tessera-(?!worker|standalone|engine).*-[\w-]{8}\.js$/.test(f));
const page = ((gzipSync(readFileSync(root + 'dist/tessera.js'), {level: 9}).length + (chunk ? gzipSync(readFileSync(root + 'dist/' + chunk), {level: 9}).length : 0)) / 1024).toFixed(0);
const ml = JSON.parse(readFileSync(root + 'node_modules/maplibre-gl/package.json', 'utf8')).version;
const mlSize = (...files) => (files.reduce((n, f) => n + gzipSync(readFileSync(root + 'node_modules/maplibre-gl/dist/' + f), {level: 9}).length, 0) / 1024).toFixed(0);

const exprPass = num(expr, /(\d+) pass/), exprFail = num(expr, /(\d+) fail/);
const lines = [
    '<!-- status:start -->',
    `These figures are written by \`pnpm status\`. They compare this library with MapLibre GL JS ${ml}.`,
    '',
    '| Measure | Result |',
    '|---|---|',
    `| Unit tests | ${num(unit, /# pass (\d+)/)} pass, ${num(unit, /# fail (\d+)/)} fail |`,
    `| MapLibre expression tests | ${exprPass} of ${exprPass + exprFail} pass |`,
    `| MapLibre \`Map\` methods | ${num(api, /coverage: (\d+)/)} of ${num(api, /of (\d+) methods/)} are available |`,
    ...(render ? [`| MapLibre render tests | ${render.match} of ${render.run} are the same (1% of pixels or less are different). ${render.close} more are near (5% or less). |`] : []),
    `| Page script (gzip) | ${page} KB. MapLibre GL JS: ${mlSize('maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl.css')} KB. |`,
    `| Worker script (gzip) | ${gz('tessera-worker.js')} KB. MapLibre GL JS: ${mlSize('maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs')} KB. |`,
    `| Server renderer (gzip) | ${gz('server.js')} KB |`,
    '<!-- status:end -->',
];
const file = root + 'README.md', doc = readFileSync(file, 'utf8');
if (!/<!-- status:start -->[\s\S]*<!-- status:end -->/.test(doc)) { console.error('README.md has no status markers'); process.exit(1); }
writeFileSync(file, doc.replace(/<!-- status:start -->[\s\S]*<!-- status:end -->/, lines.join('\n')));
console.log(lines.slice(3, -1).join('\n'));
