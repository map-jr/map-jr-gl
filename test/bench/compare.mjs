// Measures this library in the common uses of a web map, against MapLibre GL JS and, with --base, against another build
// of this library, in the same browser, with the same style and the same bytes from the network.
//
//   node test/bench/compare.mjs [options]          (needs `pnpm build`; it starts its own demo servers)
//
//   --base=<folder>     another folder of built files (a copy of dist/ of the commit to compare with): each scenario then
//                       runs for that build too, and the table has the change from it
//   --only=<regex>      only the scenarios whose id matches, for example --only='pan|zoom'
//   --skip=<regex>      leaves those scenarios out
//   --runs=<n>          runs of each scenario for each library (3); the table has the median and the range
//   --gl=<list>         software (WebGL without a GPU, as in CI), gpu (the GPU of the machine, with the frame rate not
//                       held to the screen's, so that a faster frame shows), or both (the default: software,gpu)
//   --libs=<list>       maplibre, main (this library on the main thread), worker (in a worker); the default is all
//   --json=<file>       writes every value of every run
//   --profile=<folder>  records a CPU profile of the page for each run (a .cpuprofile file for the developer tools),
//                       and prints the functions with the most time of their own; the times of such a run are slower
//   --list              prints the scenarios and stops
//
// How it measures:
// - Each run of a scenario is a page of its own in a new browser context: no run sees the HTTP cache, the workers or
//   the compiled code of another. The libraries take turns within a run, and the order turns from run to run, because
//   the speed of a machine drifts over minutes: compare the columns of one table, not two tables an hour apart.
// - An answer from another host (the style, tiles, glyphs, the sprite) is saved in .cache/bench-net at its first use
//   and comes from there afterwards, so that every run gets the same bytes and no run waits for the network.
// - A frame is a `render` event of the map (one for each frame that the library draws: with the main-thread renderer
//   the count of WebGL `clear` calls for each `move` event is the same before and after the changes of 2026-11). "Script per frame" is the time of the callbacks of requestAnimationFrame on
//   the page (the worker renderer has none there), and a long task is one that holds the page for 50 ms or more.
// - Software WebGL draws on the CPU, so its frame rates say how much work a frame is, not how fast a device is.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import path from 'node:path';
import {chromiumOptions} from '../launch.mjs';

const require = createRequire(import.meta.url), {chromium} = require('playwright');
const root = path.resolve(import.meta.dirname, '../..');
const arg = (name, def) => { const a = process.argv.find(a => a.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : def; };
const known = /^--(base|only|skip|runs|gl|libs|json|profile)=|^--list$/, unknown = process.argv.slice(2).filter(a => !known.test(a));
if (unknown.length) { console.error(`[bench] Unknown option ${unknown.join(' ')}. The options are at the head of test/bench/compare.mjs.`); process.exit(2); }
const base = arg('base') && path.resolve(arg('base')), runs = +arg('runs', 3), only = arg('only') && new RegExp(arg('only')), skip = arg('skip') && new RegExp(arg('skip'));
const modes = arg('gl', 'software,gpu').split(','), libs = arg('libs', 'maplibre,main,worker').split(',');
if (base && !existsSync(path.join(base, 'map-jr-gl-maplibre-compat.js'))) { console.error(`[bench] --base=${base} has no map-jr-gl-maplibre-compat.js. Give a folder of built files (a copy of dist/).`); process.exit(2); }
if (!existsSync(path.join(root, 'dist/map-jr-gl-maplibre-compat.js'))) { console.error('[bench] dist/ has no built files. Run pnpm build first.'); process.exit(2); }

const STYLE = process.env.BENCH_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';
const CITY = {center: [-74.0065, 40.7085], zoom: 14.3}, SIZE = {width: 1000, height: 700};

// ---- The page ----
// Runs before the scripts of the page: the time of each callback of requestAnimationFrame, and the long tasks.
const instrument = () => {
    const raf = window.requestAnimationFrame.bind(window);
    window.benchTimes = {script: [], long: 0};
    window.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); cb(t); window.benchTimes.script.push(performance.now() - t0); });
    try { new PerformanceObserver(list => { for (const e of list.getEntries()) window.benchTimes.long += e.duration; }).observe({type: 'longtask', buffered: true}); } catch { /* (no long tasks in this browser) */ }
};
// The helpers of the page, as `B`. A scenario calls them through page.evaluate.
const pageScript = `
const q = new URLSearchParams(location.search), lib = q.get('lib');
const mod = lib === 'maplibre' ? await import('/ml/maplibre-gl.mjs') : await import('/dist/map-jr-gl-maplibre-compat.js');
if (lib === 'maplibre') mod.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
const sleep = ms => new Promise(r => setTimeout(r, ms)), frame = () => new Promise(r => requestAnimationFrame(r));
/** The color of a hovered feature of the hover scenarios (#d1495b), with the soft edge of a shape. */
window.RED = (r, g, b) => r > 170 && g > 40 && g < 120 && b > 50 && b < 135;
const sorted = a => a.slice().sort((x, y) => x - y), at = (a, p) => a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(p * a.length))] : 0;
const B = window.B = {
    mod, lib, sleep, frame,
    /** The style of the benchmark, without terrain and sky (each library then draws the same layers). */
    async style() { const s = await (await fetch(${JSON.stringify(STYLE)})).json(); delete s.terrain; delete s.sky; return s; },
    box(css = 'position:absolute;inset:0') { return document.getElementById('stage').appendChild(Object.assign(document.createElement('div'), {style: css})); },
    make(el, style, view, more = {}) { return lib === 'maplibre' ? new mod.Map({container: el, style, ...view, attributionControl: false, ...more}) : new mod.Map({container: el, style, ...view, renderer: lib, attributionControl: false, ...more}); },
    /** The next idle of the map, at most \`limit\` ms from now: the time, or NaN. */
    idle(map, limit = 60000) { return new Promise(r => { map.once('idle', () => r(performance.now())); setTimeout(() => r(NaN), limit); }); },
    /** Makes a map and waits for its first idle: the times from its creation. */
    async open(view, more, style, el) {
        style ??= await B.style();
        window.benchTimes.long = 0;
        const t0 = performance.now(), ev = {};
        const map = window.map = B.make(el ?? B.box(), style, view, more);
        map.once('render', () => { ev.frame = performance.now() - t0; });
        const idle = await B.idle(map);
        return {map, firstFrame: ev.frame, load: idle - t0, longLoad: window.benchTimes.long};
    },
    /** Counts the frames of the map from now until stop(). */
    record(map) {
        const stamps = [], on = () => stamps.push(performance.now());
        map.on('render', on);
        window.benchTimes.script.length = 0; window.benchTimes.long = 0;
        const t0 = performance.now();
        return {stop() {
            map.off('render', on);
            const span = performance.now() - t0, gaps = stamps.slice(1).map((t, i) => t - stamps[i]), script = window.benchTimes.script;
            return {frames: stamps.length, fps: stamps.length / span * 1000, gap95: at(gaps, 0.95), worst: gaps.length ? Math.max(...gaps) : 0, script: at(script, 0.5), long: window.benchTimes.long};
        }};
    },
    /** A camera animation of \`ms\`, with its frames, and how long the map then takes to be idle. */
    async animate(map, to, ms, fly) {
        const r = B.record(map), idle = B.idle(map, ms + 30000);
        map[fly ? 'flyTo' : 'easeTo']({...to, duration: ms, essential: true});
        await sleep(ms);
        const out = r.stop(), end = performance.now();
        return {...out, settle: Math.max(0, await idle - end)};
    },
    /** How many pixels of the canvas of the map, as the page shows it now, pass the test of red, green and blue. */
    async count(map, test) {
        const bmp = await createImageBitmap(map.getCanvas()), c = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d');
        c.drawImage(bmp, 0, 0);
        const d = c.getImageData(0, 0, bmp.width, bmp.height).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n++;
        return n;
    },
    /** Points around a place, as GeoJSON. */
    points(n, seed = 0, [lng, lat] = ${JSON.stringify(CITY.center)}, spread = 0.03) {
        let s = seed * 9301 + 49297;
        const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
        return {type: 'FeatureCollection', features: Array.from({length: n}, (_, id) => ({type: 'Feature', id, properties: {kind: id % 5}, geometry: {type: 'Point', coordinates: [lng + (rnd() - 0.5) * spread * 2, lat + (rnd() - 0.5) * spread * 1.5]}}))};
    },
};
window.benchReady = true;
if (q.has('cold')) {
    // The first visit: the map gets the URL of the style, and the time counts from the start of the navigation.
    const map = window.map = B.make(B.box(), ${JSON.stringify(STYLE)}, ${JSON.stringify(CITY)});
    map.once('render', () => { window.coldFrame = performance.now(); });
    map.once('idle', () => { window.coldIdle = performance.now(); });
}`;
const pageHTML = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/ml/maplibre-gl.css"><style>body{margin:0}</style>
<div id="stage" style="position:relative;width:${SIZE.width}px;height:${SIZE.height}px"></div><script type="module">${pageScript}</script>`;

// ---- The scenarios ----
// A measure is [key, label, unit, which way is better]. `run(page)` gives the values. `view` and `more` are the map
// that the page opens first (none for a scenario that makes its maps itself).
// (The hover scenarios read the canvas at the last idle: the map keeps its drawing buffer for that, in each library.)
const KEEP = {canvasContextAttributes: {preserveDrawingBuffer: true}};
const SHOWN = ['shown', 'Pixels of the hovered feature on the canvas at the last idle', '', 'none'];
const LOAD = [['load', 'Load to idle', 'ms', 'low'], ['firstFrame', 'First frame', 'ms', 'low'], ['longLoad', 'Long tasks during the load', 'ms', 'low']];
const MOVE = name => [['fps', `${name}: frames per second`, 'fps', 'high'], ['gap95', `${name}: 95th percentile of the time between frames`, 'ms', 'low'], ['script', `${name}: script per frame on the page (median)`, 'ms', 'low'],
    ['long', `${name}: long tasks`, 'ms', 'low'], ['settle', `${name}: to idle after it`, 'ms', 'low']];
const move = (to, ms = 2000, fly = false) => page => page.evaluate(([to, ms, fly]) => B.animate(window.map, to, ms, fly), [to, ms, fly]);
/** Frames while `drive` moves the mouse or the wheel. (The time to idle after it is not measured: the map can be idle between two moves.) */
const input = drive => async page => {
    await page.evaluate(() => { window.rec = B.record(window.map); });
    await drive(page);
    return page.evaluate(() => window.rec.stop());
};
const scenarios = [
    {id: 'load', name: 'Load a city', note: 'New York at zoom 14.3, the style as an object', view: CITY, measures: LOAD, run: async (_, opened) => opened},
    {id: 'cold', name: 'First visit', note: 'the page, the library and the style by URL, 100 ms for each request', latency: 100, cold: true,
        measures: [['idle', 'Navigation to idle', 'ms', 'low'], ['frame', 'Navigation to first frame', 'ms', 'low']],
        run: async page => { await page.waitForFunction(() => window.coldIdle, null, {timeout: 120000}); return page.evaluate(() => ({idle: window.coldIdle, frame: window.coldFrame})); }},
    {id: 'pan', name: 'Pan', note: 'across the city in 2 s', view: CITY, measures: MOVE('Pan'), run: move({center: [-73.985, 40.725]})},
    {id: 'zoom', name: 'Zoom in', note: 'from 14.3 to 16.5, past the deepest tiles of the source', view: CITY, measures: MOVE('Zoom'), run: move({zoom: 16.5})},
    {id: 'zoomout', name: 'Zoom out', note: 'from 14.3 to 11, which needs other tiles', view: CITY, measures: MOVE('Zoom out'), run: move({zoom: 11})},
    {id: 'turn', name: 'Turn and tilt', note: 'bearing 0 to 120 and pitch 0 to 60', view: CITY, measures: MOVE('Turn'), run: move({bearing: 120, pitch: 60})},
    {id: 'tilted', name: 'Pan a tilted city', note: 'pitch 60 at zoom 15.5, with the buildings', view: {center: [-73.985, 40.748], zoom: 15.5, pitch: 60, bearing: 30}, measures: MOVE('Tilted pan'), run: move({center: [-73.975, 40.758]})},
    {id: 'fly', name: 'Fly to another place', note: 'flyTo over 12 km in 3 s', view: CITY, measures: MOVE('Flight'), run: move({center: [-73.94, 40.80], zoom: 14.3}, 3000, true)},
    {id: 'world', name: 'The world', note: 'zoom 2, and a pan of 120 degrees', view: {center: [0, 20], zoom: 2}, measures: [...LOAD.slice(0, 1), ...MOVE('World pan')],
        run: async (page, opened) => ({load: opened.load, ...await move({center: [120, 20]})(page)})},
    {id: 'globe', name: 'The globe', note: 'zoom 2 on the globe, and a turn of 90 degrees', view: {center: [0, 20], zoom: 2}, globe: true, measures: [...LOAD.slice(0, 1), ...MOVE('Globe turn')],
        run: async (page, opened) => ({load: opened.load, ...await move({center: [90, 20]})(page)})},
    {id: 'drag', name: 'Drag with the mouse', note: '40 moves of 12 pixels, then the release', view: CITY, measures: MOVE('Drag').slice(0, 4),
        run: input(async page => {
            await page.mouse.move(500, 350); await page.mouse.down();
            for (let i = 1; i <= 40; i++) { await page.mouse.move(500 - i * 12, 350 - i * 5); await page.waitForTimeout(16); }
            await page.mouse.up(); await page.waitForTimeout(800);
        })},
    {id: 'wheel', name: 'Zoom with the wheel', note: '12 steps of the wheel in 1.2 s', view: CITY, measures: MOVE('Wheel').slice(0, 4),
        run: input(async page => { await page.mouse.move(500, 350); for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(100); } await page.waitForTimeout(600); })},
    {id: 'points', name: 'A layer of 10,000 points', note: 'a GeoJSON source with a circle layer, then a pan', view: CITY, measures: [['add', 'addSource and addLayer to idle', 'ms', 'low'], ...MOVE('Pan with points')],
        run: async page => {
            const add = await page.evaluate(async () => {
                const m = window.map, t0 = performance.now(), idle = B.idle(m);
                m.addSource('pts', {type: 'geojson', data: B.points(10000)});
                m.addLayer({id: 'pts', type: 'circle', source: 'pts', paint: {'circle-radius': 4, 'circle-color': ['match', ['get', 'kind'], 0, '#d1495b', 1, '#2f7fd1', '#3a9d5d'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff'}});
                return await idle - t0;
            });
            return {add, ...await move({center: [-73.985, 40.725]})(page)};
        }},
    {id: 'setdata', name: 'New data in every frame', note: 'setData with 5,000 points for 2 s', view: CITY, measures: [['fps', 'Updates: frames per second', 'fps', 'high'], ['gap95', 'Updates: 95th percentile of the time between frames', 'ms', 'low'], ['long', 'Updates: long tasks', 'ms', 'low'], ['last', 'Last setData to idle', 'ms', 'low']],
        run: page => page.evaluate(async () => {
            const m = window.map, first = B.idle(m);
            m.addSource('pts', {type: 'geojson', data: B.points(5000)});
            m.addLayer({id: 'pts', type: 'circle', source: 'pts', paint: {'circle-radius': 4, 'circle-color': '#d1495b'}});
            await first;
            const data = Array.from({length: 8}, (_, i) => B.points(5000, i + 1)), r = B.record(m), end = performance.now() + 2000;
            let idle;
            for (let i = 0; performance.now() < end; i++) { idle = B.idle(m, 30000); m.getSource('pts').setData(data[i % 8]); await B.frame(); }
            const out = r.stop(), t = performance.now();
            return {...out, last: Math.max(0, await idle - t)};
        })},
    // (What the canvas shows in the task of the last idle, less what it showed before the first step: the pixels in the
    // color of the hovered feature. An idle that came before the state was drawn shows as 0, or as less than the others.)
    // (Each step waits for the idle of the map, not for a frame of the page: with the worker renderer the page draws
    // nothing itself, and its frames come at the rate of the screen.)
    {id: 'hover', name: 'Hover over points', more: KEEP, note: 'setFeatureState on a point of a GeoJSON source of 2,000, with a layer that reads it, 40 times, each to idle', view: CITY, measures: [['step', 'A hover step to idle (median)', 'ms', 'low'], ['time', '40 hover steps', 'ms', 'low'], ['long', 'Hover: long tasks', 'ms', 'low'], SHOWN],
        run: page => page.evaluate(async () => {
            const m = window.map, first = B.idle(m);
            m.addSource('pts', {type: 'geojson', data: B.points(2000)});
            m.addLayer({id: 'pts', type: 'circle', source: 'pts', paint: {'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 9, 4], 'circle-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#d1495b', '#2f7fd1']}});
            await first; await B.sleep(200);
            // (The points that the view shows, away from its edge, so that the last one is on the canvas.)
            const ids = B.points(2000).features.filter(f => { const p = m.project(f.geometry.coordinates); return p.x > 30 && p.y > 30 && p.x < 970 && p.y < 670; }).map(f => f.id).slice(0, 40);
            if (ids.length < 40) throw new Error(`only ${ids.length} points in the view`);
            const before = await B.count(m, RED);
            window.benchTimes.long = 0;
            const t0 = performance.now(), steps = [];
            for (let i = 0; i < 40; i++) { const t = performance.now(), idle = B.idle(m, 30000); if (i) m.setFeatureState({source: 'pts', id: ids[i - 1]}, {hover: false}); m.setFeatureState({source: 'pts', id: ids[i]}, {hover: true}); steps.push(await idle - t); }
            const time = performance.now() - t0, long = window.benchTimes.long;
            return {step: steps.sort((a, b) => a - b)[20], time, long, shown: await B.count(m, RED) - before};
        })},
    {id: 'hoverfill', name: 'Hover over buildings', more: KEEP, note: 'setFeatureState on a building of the vector tiles, with a fill layer that reads it, 30 times, each to idle', view: CITY, measures: [['step', 'A hover step to idle (median)', 'ms', 'low'], ['time', '30 hover steps', 'ms', 'low'], ['long', 'Hover: long tasks', 'ms', 'low'], SHOWN],
        run: page => page.evaluate(async () => {
            const m = window.map, layers = m.getStyle().layers, building = layers.find(l => l['source-layer'] === 'building'), first = B.idle(m);
            m.addLayer({id: 'hover', type: 'fill', source: building.source, 'source-layer': 'building', paint: {'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#d1495b', 'rgba(0,0,0,0)']}});
            await first; await B.sleep(200);
            // (The buildings in the order of their ids, so that each library hovers the same ones: the order of the answer
            // of queryRenderedFeatures differs between the libraries.)
            const found = await m.queryRenderedFeatures({layers: ['hover']}), ids = [...new Set(found.map(f => f.id).filter(id => id !== undefined))].sort((a, b) => a - b).slice(0, 30);
            if (ids.length < 30) throw new Error(`only ${ids.length} buildings with an id in the view`);
            const before = await B.count(m, RED);
            window.benchTimes.long = 0;
            const t0 = performance.now(), steps = [], at = id => ({source: building.source, sourceLayer: 'building', id});
            for (let i = 0; i < 30; i++) { const t = performance.now(), idle = B.idle(m, 30000); if (i) m.setFeatureState(at(ids[i - 1]), {hover: false}); m.setFeatureState(at(ids[i]), {hover: true}); steps.push(await idle - t); }
            const time = performance.now() - t0, long = window.benchTimes.long;
            return {step: steps.sort((a, b) => a - b)[15], time, long, shown: await B.count(m, RED) - before};
        })},
    {id: 'paint', name: 'Restyle', note: 'setPaintProperty on 20 layers in one task', view: CITY, measures: [['time', 'setPaintProperty on 20 layers to idle', 'ms', 'low'], ['long', 'Restyle: long tasks', 'ms', 'low']],
        run: page => page.evaluate(async () => {
            const m = window.map, lines = m.getStyle().layers.filter(l => l.type === 'line').slice(0, 20);
            window.benchTimes.long = 0;
            const t0 = performance.now(), idle = B.idle(m, 30000);
            for (const l of lines) m.setPaintProperty(l.id, 'line-color', '#d1495b');
            return {time: await idle - t0, long: window.benchTimes.long};
        })},
    {id: 'filter', name: 'Filter', note: 'setFilter on the layers of the buildings and of four road layers', view: CITY, measures: [['time', 'setFilter to idle', 'ms', 'low'], ['long', 'Filter: long tasks', 'ms', 'low']],
        run: page => page.evaluate(async () => {
            const m = window.map, layers = m.getStyle().layers, ids = [...layers.filter(l => l['source-layer'] === 'building'), ...layers.filter(l => l.type === 'line' && l['source-layer'] === 'transportation').slice(0, 4)].map(l => l.id);
            window.benchTimes.long = 0;
            const t0 = performance.now(), idle = B.idle(m, 30000);
            for (const id of ids) m.setFilter(id, ['all', ['has', 'class'], m.getFilter(id) ?? true]);
            return {time: await idle - t0, long: window.benchTimes.long};
        })},
    {id: 'toggle', name: 'Show and hide layers', note: 'the labels off and on again', view: CITY, measures: [['time', 'Two changes of visibility to idle', 'ms', 'low']],
        run: page => page.evaluate(async () => {
            const m = window.map, ids = m.getStyle().layers.filter(l => l.type === 'symbol').map(l => l.id), t0 = performance.now();
            let idle = B.idle(m, 30000);
            for (const id of ids) m.setLayoutProperty(id, 'visibility', 'none');
            await idle; idle = B.idle(m, 30000);
            for (const id of ids) m.setLayoutProperty(id, 'visibility', 'visible');
            return {time: await idle - t0};
        })},
    {id: 'query', name: 'Query', note: 'queryRenderedFeatures at 200 points of the view', view: CITY, measures: [['time', '200 queries', 'ms', 'low'], ['found', 'Features found', '', 'none']],
        run: page => page.evaluate(async () => {
            const m = window.map, t0 = performance.now();
            let found = 0;
            for (let i = 0; i < 200; i++) found += (await m.queryRenderedFeatures([50 + (i % 20) * 45, 40 + Math.floor(i / 20) * 62])).length;
            return {time: performance.now() - t0, found};
        })},
    {id: 'resize', name: 'Resize', note: 'the container in 20 steps to 600 by 420 and back', view: CITY, measures: [['time', '20 sizes to idle', 'ms', 'low'], ['long', 'Resize: long tasks', 'ms', 'low']],
        run: page => page.evaluate(async () => {
            const m = window.map, el = document.getElementById('stage');
            window.benchTimes.long = 0;
            const t0 = performance.now();
            let idle;
            for (let i = 1; i <= 20; i++) { const k = i <= 10 ? 1 - i * 0.04 : 0.6 + (i - 10) * 0.04; idle = B.idle(m, 30000); el.style.width = 1000 * k + 'px'; el.style.height = 700 * k + 'px'; m.resize(); await B.frame(); }
            return {time: await idle - t0, long: window.benchTimes.long};
        })},
    {id: 'two', name: 'Two maps on a page', note: 'both made at once, each 500 pixels wide', measures: [['both', 'Both idle', 'ms', 'low'], ['long', 'Two maps: long tasks', 'ms', 'low']],
        run: page => page.evaluate(async () => {
            const style = await B.style();
            window.benchTimes.long = 0;
            const t0 = performance.now();
            const maps = [0, 1].map(i => B.make(B.box(`position:absolute;top:0;bottom:0;left:${i * 500}px;width:500px`), style, i ? {center: [-73.95, 40.78], zoom: 13.5} : {center: [-74.0065, 40.7085], zoom: 14.3}));
            const done = await Promise.all(maps.map(m => B.idle(m)));
            return {both: Math.max(...done) - t0, long: window.benchTimes.long};
        })},
    {id: 'lifecycle', name: 'Make and remove', note: 'five maps one after the other on one page', measures: [['create', 'Create to idle, median of the last four', 'ms', 'low'], ['remove', 'remove(), median', 'ms', 'low']],
        run: page => page.evaluate(async () => {
            const style = await B.style(), create = [], remove = [];
            for (let i = 0; i < 5; i++) {
                const el = B.box(), t0 = performance.now(), m = B.make(el, structuredClone(style), {center: [-74.0065, 40.7085], zoom: 14.3});
                create.push(await B.idle(m) - t0);
                const t1 = performance.now(); m.remove(); remove.push(performance.now() - t1); el.remove();
                await B.sleep(100);
            }
            const med = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
            return {create: med(create.slice(1)), remove: med(remove)};
        })},
].filter(s => (!only || only.test(s.id)) && !(skip && skip.test(s.id)));
if (process.argv.includes('--list')) { for (const s of scenarios) console.log(`${s.id.padEnd(10)} ${s.name}: ${s.note}`); process.exit(0); }
if (!scenarios.length) { console.error('[bench] No scenario matches --only and --skip. --list prints the scenarios.'); process.exit(2); }

// ---- The servers, and the answers of other hosts ----
const freePort = () => new Promise(r => { const s = createServer().listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
const servers = [];
async function serve(dist) {
    const port = await freePort(), child = spawn(process.execPath, ['demo/serve.mjs'], {cwd: root, env: {...process.env, PORT: String(port), ...(dist ? {DIST: dist} : {})}, stdio: 'ignore'});
    servers.push(child);
    for (let i = 0; i < 100; i++) { try { await fetch(`http://localhost:${port}/style.json`); return `http://localhost:${port}`; } catch { await new Promise(r => setTimeout(r, 200)); } }
    throw new Error('[bench] the demo server did not start');
}
const stop = () => { for (const s of servers) s.kill(); };
process.on('exit', stop); process.on('SIGINT', () => { stop(); process.exit(130); });
const cacheDir = path.join(root, '.cache/bench-net'), memory = new Map();
function cached(url) {
    if (!memory.has(url)) memory.set(url, (async () => {
        const file = path.join(cacheDir, createHash('sha1').update(url).digest('hex'));
        try { return {meta: JSON.parse(await readFile(file + '.json', 'utf8')), body: await readFile(file)}; } catch { /* (not saved yet) */ }
        const res = await fetch(url), body = Buffer.from(await res.arrayBuffer()), meta = {status: res.status, type: res.headers.get('content-type') || 'application/octet-stream'};
        // (Only a good answer is saved: a failure of the host must not become the input of every later run.)
        if (res.ok) { await mkdir(cacheDir, {recursive: true}); await writeFile(file, body); await writeFile(file + '.json', JSON.stringify(meta)); }
        else process.stderr.write(`[bench] ${url} answered ${res.status}: not saved\n`);
        return {meta, body};
    })());
    return memory.get(url);
}

// ---- The runs ----
const here = await serve(), there = base ? await serve(base) : null;
const variants = libs.flatMap(lib => lib === 'maplibre' || !base ? [{id: lib, lib, origin: here}] : [{id: lib + '@base', lib, origin: there}, {id: lib, lib, origin: here}]);
const names = {maplibre: 'MapLibre GL JS', main: 'Main thread', worker: 'Worker', 'main@base': 'Main thread, base', 'worker@base': 'Worker, base'};
const launchArgs = {
    software: [],
    // (The frame rate is not held to that of the screen, so that a frame that costs less shows as more frames.)
    gpu: ['--ignore-gpu-blocklist', '--enable-gpu', '--disable-frame-rate-limit', '--disable-gpu-vsync'],
};
const results = [], started = Date.now();

async function once(browser, s, v) {
    const context = await browser.newContext({viewport: {width: SIZE.width + 40, height: SIZE.height + 40}});
    try {
        await context.addInitScript(instrument);
        await context.route('**/*', async route => {
            const url = route.request().url();
            if (s.latency) await new Promise(r => setTimeout(r, s.latency));
            if (url.startsWith(v.origin + '/bench-page')) return route.fulfill({status: 200, contentType: 'text/html', body: pageHTML});
            if (url.startsWith(v.origin)) return route.continue().catch(() => {});
            try { const {meta, body} = await cached(url); return route.fulfill({status: meta.status, contentType: meta.type, body, headers: {'access-control-allow-origin': '*'}}).catch(() => {}); }
            catch { return route.abort().catch(() => {}); }
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(`${v.origin}/bench-page?lib=${v.lib}${s.cold ? '&cold' : ''}`);
        await page.waitForFunction(() => window.benchReady, null, {timeout: 60000});
        const cdp = arg('profile') ? await context.newCDPSession(page) : null;
        if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', {interval: 200}); await cdp.send('Profiler.start'); }
        const opened = s.view ? await page.evaluate(async ([view, globe, more]) => {
            const style = await B.style();
            if (globe) style.projection = {type: 'globe'};
            const {map, ...times} = await B.open(view, more, style);
            // (A moment at rest, so that a scenario starts from a map that has finished its start.)
            await B.sleep(300);
            return times;
        }, [s.view, !!s.globe, s.more]) : undefined;
        const values = await s.run(page, opened);
        if (cdp) {
            const {profile} = await cdp.send('Profiler.stop'), file = path.join(arg('profile'), `${s.id}-${v.id.replace('@', '-')}-${Date.now().toString(36)}.cpuprofile`);
            await mkdir(arg('profile'), {recursive: true});
            await writeFile(file, JSON.stringify(profile));
            const self = new Map(), nodes = new Map(profile.nodes.map(n => [n.id, n]));
            profile.samples.forEach((id, i) => { const f = nodes.get(id).callFrame, k = `${f.functionName || '(anonymous)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}:${f.columnNumber + 1}`; self.set(k, (self.get(k) ?? 0) + profile.timeDeltas[i] / 1000); });
            process.stderr.write(`[bench] ${s.id}, ${names[v.id]}: ${file}\n${[...self].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, ms]) => `    ${ms.toFixed(1).padStart(8)} ms  ${k}`).join('\n')}\n`);
        }
        if (errors.length) values.error = errors[0];
        return values;
    } finally { await context.close(); }
}

for (const mode of modes) {
    if (!launchArgs[mode]) { console.error(`[bench] --gl=${mode} is not software or gpu.`); process.exit(2); }
    const browser = await chromium.launch({...chromiumOptions(chromium), args: launchArgs[mode]});
    const about = await (async () => {
        const page = await browser.newPage();
        const gl = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'), d = g?.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
        await page.close();
        return gl;
    })();
    // (One run that is not counted: it saves the answers of the other hosts and starts the servers' own caches.)
    for (const v of variants) await once(browser, scenarios[0], v).catch(e => process.stderr.write(`[bench] the first run of ${names[v.id]} failed: ${String(e.message).split('\n')[0]}\n`));
    for (const s of scenarios) {
        for (let run = 0; run < runs; run++) {
            // (The order of the libraries turns with each run.)
            const order = variants.map((_, i) => variants[(i + run) % variants.length]);
            for (const v of order) {
                let values;
                try { values = await once(browser, s, v); } catch (e) { values = {error: String(e.message).split('\n')[0]}; }
                results.push({mode, scenario: s.id, variant: v.id, run, values});
            }
        }
        process.stderr.write(`[bench] ${mode}: ${s.id} done (${((Date.now() - started) / 60000).toFixed(1)} min)\n`);
    }
    await browser.close();

    // ---- The table of this mode ----
    const median = a => { const v = a.filter(x => typeof x === 'number' && !Number.isNaN(x)).sort((x, y) => x - y), m = v.length >> 1; return !v.length ? NaN : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
    const fmt = (v, unit) => Number.isNaN(v) ? '–' : (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)) + (unit ? ' ' + unit : '');
    const of = (s, v, key) => results.filter(r => r.mode === mode && r.scenario === s.id && r.variant === v.id).map(r => r.values[key]).filter(x => typeof x === 'number' && !Number.isNaN(x));
    const cell = (s, v, key, unit) => { const a = of(s, v, key); return a.length ? `${fmt(median(a), unit)}${a.length > 1 ? ` (${fmt(Math.min(...a))}–${fmt(Math.max(...a))})` : ''}` : '–'; };
    // The change from the base: by how much the measure is better (+) or worse (−), whichever way is better for it.
    const change = (s, lib, key, better) => {
        const a = median(of(s, {id: lib + '@base'}, key)), b = median(of(s, {id: lib}, key));
        if (better === 'none' || Number.isNaN(a) || Number.isNaN(b) || !a) return '';
        const pct = (better === 'high' ? b / a - 1 : 1 - b / a) * 100;
        // (A time under 2 ms, or a difference under a millisecond, is not a measured change.)
        return Math.abs(b - a) < 1 && better === 'low' ? '=' : `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)} %`;
    };
    const mine = libs.filter(l => l !== 'maplibre'), cols = variants.flatMap(v => base && mine.includes(v.id) ? [v, {change: v.id}] : [v]);
    console.log(`\n### ${mode === 'software' ? 'Software WebGL' : 'GPU, frame rate not held to the screen'} (${about})\n`);
    console.log(`Style ${STYLE}, ${SIZE.width} × ${SIZE.height} pixels, ${runs} ${runs === 1 ? 'run' : 'runs'} of each: median (smallest–largest).${base ? ' The change is from the base build, + for better.' : ''}\n`);
    console.log(`| Scenario | Measure | ${cols.map(c => c.change ? 'Change' : names[c.id]).join(' | ')} |`);
    console.log(`|---|---|${cols.map(() => '---').join('|')}|`);
    for (const s of scenarios) for (const [key, label, unit, better] of s.measures) {
        console.log(`| ${s.name} | ${label} | ${cols.map(c => c.change ? change(s, c.change, key, better) : cell(s, c, key, unit)).join(' | ')} |`);
    }
    const failed = results.filter(r => r.mode === mode && r.values.error);
    if (failed.length) console.log(`\nErrors: ${[...new Set(failed.map(r => `${r.scenario} (${names[r.variant]}): ${r.values.error}`))].join(' | ')}`);
}
if (arg('json')) await writeFile(arg('json'), JSON.stringify({style: STYLE, base, runs, results}, null, 1));
stop();
process.stderr.write(`[bench] ${results.length} runs in ${((Date.now() - started) / 60000).toFixed(1)} min\n`);
