// Runs popular MapLibre plugins with this library in a browser, each in a short scenario (test/conformance/plugins/).
// The plugins import `maplibre-gl`; the page gives them this library in its place.
//   node test/conformance/plugins.mjs [--write] [name ...]      (--write puts the results in docs/ecosystem.md)
// The plugins are installed into .cache/plugins without their install scripts. Their code runs only in the browser.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {launch} from '../launch.mjs';

const root = path.resolve(import.meta.dirname, '../..'), dir = path.join(root, '.cache/plugins'), scenarios = path.join(import.meta.dirname, 'plugins');
const PACKAGES = {draw: '@mapbox/mapbox-gl-draw', 'terra-draw': 'terra-draw terra-draw-maplibre-gl-adapter', compare: '@maplibre/maplibre-gl-compare', 'sync-move': '@mapbox/mapbox-gl-sync-move',
    pmtiles: 'pmtiles', opacity: 'maplibre-gl-opacity', inspect: '@maplibre/maplibre-gl-inspect', export: '@watergis/maplibre-gl-export', react: '@vis.gl/react-maplibre react react-dom', vue: '@indoorequal/vue-maplibre-gl vue', deck: '@deck.gl/mapbox @deck.gl/layers @deck.gl/core', geocoder: '@maplibre/maplibre-gl-geocoder', directions: '@maplibre/maplibre-gl-directions'};
const only = process.argv.slice(2).filter(a => !a.startsWith('--')), names = Object.keys(PACKAGES).filter(n => !only.length || only.includes(n));
// (The folder also has shims/, which is not a scenario.)

mkdirSync(dir, {recursive: true});
if (!existsSync(path.join(dir, 'package.json'))) writeFileSync(path.join(dir, 'package.json'), '{"name":"plugins","private":true}');
const wanted = names.flatMap(n => PACKAGES[n].split(' ')).filter(p => !existsSync(path.join(dir, 'node_modules', p)));
if (wanted.length) execFileSync('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--silent', ...wanted], {cwd: dir, stdio: 'inherit'});

// Each scenario is made into one file with its plugin. `maplibre-gl` stays an import: the page maps it to this library.
const {build} = createRequire(import.meta.url)('esbuild'), bundles = {};
for (const n of names) {
    const out = await build({entryPoints: [path.join(scenarios, n + '.js')], bundle: true, format: 'esm', write: false, external: ['maplibre-gl'], nodePaths: [path.join(dir, 'node_modules')], alias: {events: path.join(scenarios, 'shims/events.js')},
        loader: {'.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl'}, define: {'process.env.NODE_ENV': '"production"', global: 'globalThis'}, logLevel: 'silent'}).catch(e => ({error: e.message.split('\n')[0]}));
    bundles[n] = out.error ? out : out.outputFiles[0].text;
}

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const page = n => `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%}#stage{position:absolute;inset:0}#map{position:absolute;inset:0}</style>
<script type="importmap">{"imports": {"maplibre-gl": "/dist/map-jr-gl.js"}}</script>
<div id="stage"><div id="map"></div></div>
<script type="module">
import * as lib from '/dist/map-jr-gl.js';
window.errors = [];
addEventListener('error', e => window.errors.push(e.message));
addEventListener('unhandledrejection', e => window.errors.push(String(e.reason?.message ?? e.reason)));
const map = window.map = new lib.Map({container: 'map', style: ${JSON.stringify(STYLE)}, center: [-74.0065, 40.7085], zoom: 13});
map.on('error', e => window.errors.push('map: ' + (e.error?.message ?? '')));
await new Promise(r => map.once('load', r));
const {run} = await import('/scenario/${n}.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
try { window.result = await run({lib, map, wait, style: ${JSON.stringify(STYLE)}, mouse: {click: window.mouseClick, drag: window.mouseDrag}}); }
catch (e) { window.result = {ok: false, detail: 'threw: ' + e.message}; }
</script>`;

const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), send = (type, body) => { res.writeHead(200, {'content-type': type}); res.end(body); };
    if (url.pathname.startsWith('/run/')) return send('text/html', page(url.pathname.slice(5)));
    if (url.pathname.startsWith('/scenario/')) return send('text/javascript', bundles[url.pathname.slice(10, -3)]);
    if (url.pathname.startsWith('/dist/') && readdirSync(path.join(root, 'dist')).includes(url.pathname.slice(6))) return send('text/javascript', readFileSync(path.join(root, url.pathname)));
    res.writeHead(404); res.end();
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await launch(), results = [];
for (const n of names) {
    const version = PACKAGES[n].split(' ').map(p => p + ' ' + JSON.parse(readFileSync(path.join(dir, 'node_modules', p, 'package.json'), 'utf8')).version).join(', ');
    if (bundles[n].error) { results.push({n, version, ok: false, detail: 'the scenario could not be built: ' + bundles[n].error, errors: []}); console.log(`FAIL  ${n} (${version}): ${results.at(-1).detail}`); continue; }
    const p = await browser.newPage({viewport: {width: 900, height: 600}});
    const consoleErrors = [];
    p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().split('\n')[0].slice(0, 160)); });
    await p.exposeFunction('mouseClick', (x, y) => p.mouse.click(x, y));
    await p.exposeFunction('mouseDrag', async (x0, y0, x1, y1) => { await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, {steps: 4}); await p.mouse.move(x1, y1, {steps: 4}); await p.mouse.up(); });
    let r;
    try {
        await p.goto(`${base}/run/${n}`);
        await p.waitForFunction(() => window.result, null, {timeout: 60000});
        r = await p.evaluate(() => ({...window.result, errors: window.errors}));
    } catch (e) { r = {ok: false, detail: 'the scenario did not finish: ' + String(e.message).split('\n')[0], errors: await p.evaluate(() => window.errors ?? []).catch(() => [])}; }
    r.errors = [...new Set([...r.errors, ...consoleErrors])].slice(0, 4);
    results.push({n, version, ...r, ok: r.ok && !r.errors.length});
    console.log(`${r.ok && !r.errors.length ? 'PASS' : 'FAIL'}  ${n} (${version}): ${r.detail}${r.errors.length ? ' | errors: ' + r.errors.join(' | ') : ''}`);
    await p.close();
}
await browser.close();
server.close();

if (process.argv.includes('--write')) {
    const file = path.join(root, 'docs/ecosystem.md'), doc = readFileSync(file, 'utf8'), cell = s => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');
    const block = ['<!-- plugins:start -->', '## Plugins that were run', '',
        'These plugins were run with this library in a browser by `node test/conformance/plugins.mjs --write`. Each one has a',
        'short scenario in `test/conformance/plugins/`. The plugin imports `maplibre-gl` and gets this library.', '',
        `**${results.filter(r => r.ok).length} of ${results.length} scenarios pass.**`, '',
        '| Plugin | Result | What the scenario found |', '|---|---|---|',
        ...results.map(r => `| ${cell(r.version)} | ${r.ok ? 'Pass' : 'Fail'} | ${cell(r.detail)}${r.errors.length ? ' Errors: ' + cell(r.errors.join('; ')) : ''} |`), '<!-- plugins:end -->'].join('\n');
    writeFileSync(file, doc.includes('<!-- plugins:start -->') ? doc.replace(/<!-- plugins:start -->[\s\S]*<!-- plugins:end -->/, block) : doc.replace('## What is missing most often', block + '\n\n## What is missing most often'));
}
