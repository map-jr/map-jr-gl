// Measures this library against MapLibre GL JS in the same headless Chromium, same style, same view.
//   node test/bench/compare.mjs            (needs the demo server running: pnpm demo)
// Headless Chromium draws WebGL in software, so GPU-bound numbers (frame rate) are low for both libraries and only
// their ratio means anything. Main-thread figures (script time, long tasks) are CPU work and transfer to real devices better.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import path from 'node:path';
import {manyMarkers} from '../../demo/markers.mjs';

const require = createRequire(import.meta.url), {chromium} = require('playwright');
const root = path.resolve(import.meta.dirname, '../..'), mlDist = path.dirname(require.resolve('maplibre-gl/dist/maplibre-gl.mjs'));
const STYLE = process.env.BENCH_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';
const VIEW = {center: [-74.0065, 40.7085], zoom: 14.3};
const gz = f => (gzipSync(readFileSync(f), {level: 9}).length / 1024).toFixed(0);

const browser = await chromium.launch();
// Wrap requestAnimationFrame to time every frame callback, and record long tasks (main thread blocked for 50 ms or more).
const instrument = () => {
    const raf = window.requestAnimationFrame.bind(window);
    window.bench = {frames: [], stamps: [], long: 0, moves: 0};
    window.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); cb(t); window.bench.frames.push(performance.now() - t0); window.bench.stamps.push(t0); });
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.bench.long += e.duration; }).observe({type: 'longtask', buffered: true});
};
const reset = page => page.evaluate(() => { window.bench.frames.length = 0; window.bench.stamps.length = 0; window.bench.long = 0; window.bench.moves = 0; if (!window.bench.hooked) { window.bench.hooked = true; window.map.on('move', () => window.bench.moves++); } });
const read = page => page.evaluate(() => {
    const f = window.bench.frames.slice().sort((a, b) => a - b), s = window.bench.stamps, gaps = s.slice(1).map((t, i) => t - s[i]).sort((a, b) => a - b);
    return {frames: window.bench.moves || f.length, script: f.length ? f[f.length >> 1] : 0, worst: f.length ? f[f.length - 1] : 0, interval: gaps.length ? gaps[gaps.length >> 1] : 0, long: window.bench.long};
});

const mlPage = extra => `<div id="map" style="position:absolute;inset:0"></div><script type="module">
import * as m from '/ml/maplibre-gl.mjs'; m.setWorkerUrl('/ml/maplibre-gl-worker.mjs'); window.ml = m;
const style = await (await fetch(${JSON.stringify(STYLE)})).json(); delete style.terrain; delete style.sky;
const map = window.map = new m.Map({container: 'map', style, center: ${JSON.stringify(VIEW.center)}, zoom: ${VIEW.zoom}, attributionControl: false});
map.once('idle', () => { window.loadedAt = performance.now(); ${extra ?? ''} });</script>`;

async function open(lib, markers) {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    await page.addInitScript(instrument);
    if (lib === 'maplibre') {
        await page.route('http://bench.local/**', r => {
            const f = new URL(r.request().url()).pathname;
            if (f === '/') return r.fulfill({contentType: 'text/html', body: `<link rel="stylesheet" href="/ml/maplibre-gl.css"><style>body{margin:0}</style>` + mlPage()});
            r.fulfill({contentType: f.endsWith('.css') ? 'text/css' : 'text/javascript', body: readFileSync(path.join(mlDist, path.basename(f)))});
        });
        await page.goto('http://bench.local/');
    } else {
        await page.goto(`http://localhost:8080/?renderer=${lib}&nomarkers&nocontrols&nofonts${process.env.BENCH_QUERY ?? ''}&style=${encodeURIComponent(STYLE)}`);
        await page.evaluate(() => window.map.once('idle', () => { window.loadedAt = performance.now(); }));
    }
    await page.waitForFunction(() => window.loadedAt, null, {timeout: 120000});
    const load = await page.evaluate(() => window.loadedAt), loadStats = await read(page);
    if (markers) {
        await page.evaluate(async ({layer, lib}) => {
            const t0 = performance.now();
            if (lib === 'maplibre') for (const d of layer.data) new window.ml.Marker({color: d.props.color}).setLngLat(d.lngLat).addTo(window.map);
            else window.map.addMarkerLayer(layer);
            window.markerAddMs = performance.now() - t0;
        }, {layer: manyMarkers(markers, VIEW.center, 0.05), lib});
        await page.waitForTimeout(2500);
    }
    return {page, load, loadLong: loadStats.long};
}

async function animate(page) {
    await page.waitForTimeout(500);
    await reset(page);
    await page.evaluate(() => new Promise(done => {
        // Pan, zoom and rotate across the city for three seconds.
        window.map.easeTo({center: [-73.975, 40.735], zoom: 15.2, bearing: 40, duration: 3000});
        setTimeout(done, 3200);
    }));
    return read(page);
}

const rows = [], markerRows = [];
for (const lib of ['maplibre', 'main', 'worker']) {
    const {page, load, loadLong} = await open(lib);
    const a = await animate(page);
    rows.push({lib, load, loadLong, ...a});
    await page.close();
}
for (const [lib, n] of [['maplibre', 1000], ['main', 1000], ['worker', 1000], ['maplibre', 10000], ['main', 10000], ['worker', 10000], ['worker', 100000]]) {
    const {page} = await open(lib, n);
    const add = await page.evaluate(() => window.markerAddMs), a = await animate(page);
    markerRows.push({lib, n, add, ...a});
    await page.close();
}
await browser.close();

const name = {maplibre: 'MapLibre GL JS', main: 'This library, main thread', worker: 'This library, worker'};
const ms = v => v >= 100 ? v.toFixed(0) : v.toFixed(1);
console.log(`Style: ${STYLE}\n`);
console.log('| | Download (gzip) | Load to idle | Long tasks during load | Frames in 3 s animation | Main-thread script per frame (median / worst) | Long tasks during animation |');
console.log('|---|---|---|---|---|---|---|');
const sizes = {maplibre: `${+gz(path.join(mlDist, 'maplibre-gl.mjs')) + +gz(path.join(mlDist, 'maplibre-gl-worker.mjs'))} KB + ${gz(path.join(mlDist, 'maplibre-gl.css'))} KB CSS`, main: `${gz(path.join(root, 'dist/tessera.js'))} KB`, worker: `${gz(path.join(root, 'dist/tessera.js'))} KB`};
for (const r of rows) console.log(`| ${name[r.lib]} | ${sizes[r.lib]} | ${ms(r.load)} ms | ${ms(r.loadLong)} ms | ${r.frames} | ${ms(r.script)} / ${ms(r.worst)} ms | ${ms(r.long)} ms |`);
console.log('\n| Markers | | Time to add | Frames in 3 s animation | Main-thread script per frame (median / worst) | Long tasks during animation |');
console.log('|---|---|---|---|---|---|');
for (const r of markerRows) console.log(`| ${r.n.toLocaleString('en')} | ${r.lib === 'maplibre' ? 'MapLibre `Marker` (DOM)' : name[r.lib] + ', marker layer'} | ${ms(r.add)} ms | ${r.frames} | ${ms(r.script)} / ${ms(r.worst)} ms | ${ms(r.long)} ms |`);
