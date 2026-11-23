// In-browser benchmark: this library against MapLibre GL JS on the visitor's own GPU (#29). See bench.html.
// (The URLs are relative: the page is at /bench of the demo server, and in the folder bench/ of the gallery site.)
//
// The query of the page (test/bench/browsers.mjs and test/bench/webdriver.mjs use it):
//   auto              runs the scenarios that are checked when the page opens, and sets window.benchResults at the end
//   runs=N            the number of runs of each scenario (the default is 3)
//   seconds=S         the length of each animation in seconds (the default is 5; the camera parts take 0.6 × S each)
//   only=text         only the scenarios whose id or name contains the text, for example only=terrain
//   skip=a,b          leaves out the scenarios with these ids, for example skip=markers10000,terrain
//   nomarkers         leaves out the marker scenarios
//   noterrain         leaves out the 3D terrain scenario
//   nocold            leaves out the cold start (test/bench/browsers.mjs runs it apart, in a fresh browser context for each load)
//   libs=a,b          only these libraries (maplibre, main, worker)
//   latency=MS        the delay that the runner adds to each request; the page only names it in the cold start's note
//   style=URL         another style (the default is OpenFreeMap Liberty)
//   commit=SHA        the commit that the copied results name (the copy that scripts/site.mjs makes has commit.txt instead)
//
// The page keeps each finished pair of a scenario and a library in sessionStorage (#977). When a scenario ends the
// page (Safari on an iPhone can lose the tab), a reload shows the kept results with a note that names the pair that
// did not finish; with `auto`, the run then goes on after that pair, and marks the pair as failed.
import * as compat from '../dist/map-jr-gl-maplibre-compat.js';
import * as host from '../dist/map-jr-gl.js';
import * as maplibre from '../ml/maplibre-gl.mjs';
import {manyMarkers, addImages, addMarkers} from './markers.mjs';
import {startSteps, timelineLine} from './start-timeline.mjs';

maplibre.setWorkerUrl(new URL('../ml/maplibre-gl-worker.mjs', import.meta.url).href);
const q = new URLSearchParams(location.search);
const STYLE = q.get('style') || 'https://tiles.openfreemap.org/styles/liberty';
const VIEW = {center: [-74.0065, 40.7085], zoom: 14.3}, SECONDS = +(q.get('seconds') || 5);
const $ = id => document.getElementById(id);
const stage = $('stage'), status = $('status'), tbody = document.querySelector('#results tbody');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const frame = () => new Promise(r => requestAnimationFrame(r));

// Long tasks (the main thread blocked for 50 ms or more), where the browser reports them.
let blocked = 0;
try { new PerformanceObserver(list => { for (const e of list.getEntries()) blocked += e.duration; }).observe({type: 'longtask'}); } catch { blocked = NaN; }

// The tile workers fetch the tiles, and the resource timings of the page do not list their requests. To give the network
// answer of a tile of this library (#371), each classic worker that the page starts runs a few lines first that send its
// own resource timings to the page, in the page's clock. The module workers of MapLibre GL JS are left alone. The page
// also counts the workers that it starts and ends, for the lifecycle scenario.
const workerNet = [], workers = {started: 0, ended: 0};
new BroadcastChannel('bench-net').onmessage = e => { for (const r of e.data) if (workerNet.length < 20000) workerNet.push(r); };
const NET = `try{const c=new BroadcastChannel('bench-net'),o=performance.timeOrigin-${performance.timeOrigin};new PerformanceObserver(l=>c.postMessage(l.getEntries().map(e=>({name:e.name,startTime:e.startTime+o,responseEnd:e.responseEnd+o,transferSize:e.transferSize,decodedBodySize:e.decodedBodySize})))).observe({type:'resource',buffered:true})}catch{}`;
const PageWorker = window.Worker;
window.Worker = function (url, opts) {
    workers.started++;
    const blob = opts?.type === 'module' ? null : URL.createObjectURL(new Blob([`${NET};importScripts(${JSON.stringify(new URL(url, location.href).href)});`], {type: 'text/javascript'}));
    const w = new PageWorker(blob ?? url, opts);
    const end = w.terminate.bind(w);
    // (The blob URL is given back with the worker, so that the runs do not keep one for each worker that they started, #959.)
    w.terminate = () => { workers.ended++; end(); if (blob) URL.revokeObjectURL(blob); };
    return w;
};

// The heading of the copied results: browser, GPU, pixel ratio, version and commit.
const gl = document.createElement('canvas').getContext('webgl2'), info = gl?.getExtension('WEBGL_debug_renderer_info');
let commit = q.get('commit') ?? '';
// (Safari 27.2 has the extension and gives null for it, #967: then the plain renderer string, or a note that there is none.)
const gpu = (info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl?.getParameter(gl.RENDERER) || 'not given by the browser';
const env = () => `GPU: ${gpu} · screen pixel ratio ${devicePixelRatio} · map-jr-gl ${compat.getVersion()}, commit ${commit || 'unknown'} · MapLibre GL JS ${maplibre.getVersion()} · ${navigator.userAgent.replace(/^.*?\) /, '')}`;
$('env').textContent = env();
// (The copy of scripts/site.mjs has commit.txt next to the page, at bench/; the demo server has none, and answers 404.)
if (!commit) fetch('commit.txt').then(r => r.ok ? r.text() : '').then(t => { if (/^[0-9a-f]{7,40}$/.test(t.trim())) { commit = t.trim().slice(0, 12); $('env').textContent = env(); } }).catch(() => {});

const LIBS = {maplibre: 'MapLibre GL JS', main: 'This library, main thread', worker: 'This library, worker'};
const ALL = Object.keys(LIBS).filter(l => !q.get('libs') || q.get('libs').split(',').includes(l));

// Whether the stage is in view (#973). A browser can throttle the drawing and the animation frames of a map that is out
// of view, as Safari on a phone does, so each run records whether the stage was at least 90 % in view, and the tab in
// front, the whole time. The page scrolls the stage into view before each run.
let stageSeen = false, stageOut = false;
const checkView = () => { if (!stageSeen || document.hidden) stageOut = true; };
new IntersectionObserver(([e]) => { stageSeen = e.intersectionRatio >= 0.9; checkView(); }, {threshold: [0.9]}).observe(stage);
document.addEventListener('visibilitychange', checkView);
async function intoView() {
    stage.scrollIntoView({block: 'nearest'});
    // (The observer answers after a frame or two.)
    await frame(); await frame(); await frame();
    stageOut = false; checkView();
}

// ---- Statistics of numbers ----
const sorted = a => a.filter(v => typeof v === 'number' && !Number.isNaN(v)).sort((x, y) => x - y);
const pct = (a, p) => { const s = sorted(a); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const median = a => { const s = sorted(a), m = s.length >> 1; return !s.length ? NaN : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Records the frames that a map draws (its `render` events) from `start()` until `stop()`, and the gaps between them. */
function frames(map) {
    let stamps = null;
    const on = () => { if (stamps) stamps.push(performance.now()); };
    const off = map.listen ? map.listen('render', on) : (map.on('render', on), () => map.off('render', on));
    return {
        start() { stamps = []; blocked = Number.isNaN(blocked) ? NaN : 0; return this; },
        stop() {
            const s = stamps ?? []; stamps = null; off();
            const gaps = s.slice(1).map((t, i) => t - s[i]), span = s.length > 1 ? (s.at(-1) - s[0]) / 1000 : 0;
            return {fps: span ? (s.length - 1) / span : 0, gap: median(gaps), p90: pct(gaps, 0.9), worst: gaps.length ? Math.max(...gaps) : NaN, blocked};
        },
    };
}

/** A promise of the next `idle` of the map. Take it before an edit: a map can be idle again before the edit's call returns to the page. */
const nextIdle = map => new Promise(r => map.once('idle', () => r(true)));
/**
 * Waits until the map has fired `idle` (the one that `armed` holds, or the next one) and every source of `ids` reports
 * isSourceLoaded (#29: `idle` alone can come early). Returns the time.
 */
async function settle(map, ids = [], armed = nextIdle(map), limit = 60000) {
    const end = performance.now() + limit;
    const loaded = () => ids.every(id => { try { return map.isSourceLoaded(id); } catch { return true; } });
    const idle = await Promise.race([armed, sleep(limit).then(() => false)]);
    if (!idle) throw new Error(`the map was not idle after ${limit / 1000} s`);
    while (!loaded()) {
        if (performance.now() > end) throw new Error('a source did not load');
        await Promise.race([new Promise(r => map.once('sourcedata', r)), sleep(50)]);
    }
    return performance.now();
}
/** The same for a map of the main API, which has no isSourceLoaded: its `idle` waits for the sources. */
async function settleHost(map, armed = map.once('idle'), limit = 60000) {
    if (!await Promise.race([armed.then(() => true), sleep(limit).then(() => false)])) throw new Error(`the map was not idle after ${limit / 1000} s`);
    return performance.now();
}

// ---- Styles ----
let styleJSON;
const loadStyle = async () => structuredClone(styleJSON ??= await (await fetch(STYLE)).json());
const sourceIds = style => Object.keys(style.sources ?? {});
/** Elevation, relief shading and terrain on the style (Mapterhorn tiles, as in the gallery). */
function withTerrain(style) {
    style.sources.benchdem = {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12};
    const firstSymbol = style.layers.findIndex(l => l.type === 'symbol');
    style.layers.splice(firstSymbol < 0 ? style.layers.length : firstSymbol, 0, {id: 'bench-relief', type: 'hillshade', source: 'benchdem', paint: {'hillshade-exaggeration': 0.4}});
    style.terrain = {source: 'benchdem', exaggeration: 1.5};
    return style;
}
const SKY = {'sky-color': '#7fb4e8', 'horizon-color': '#dceaf5', 'fog-color': '#e8eef2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.4};
/** Points around the centre of the view, for the GeoJSON scenarios. A different `seed` gives other positions. */
const points = (n, seed = 0, [lng, lat] = VIEW.center, spread = 0.03) => {
    let s = seed * 9301 + 49297;
    const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    return {type: 'FeatureCollection', features: Array.from({length: n}, (_, id) => ({type: 'Feature', id, properties: {}, geometry: {type: 'Point', coordinates: [lng + (rnd() - 0.5) * spread * 2, lat + (rnd() - 0.5) * spread * 1.5]}}))};
};

// ---- Maps ----
/** Makes a map of the compat entry or of MapLibre GL JS in `el`. */
function makeMap(lib, el, style, view, more = {}) {
    if (lib === 'maplibre') return new maplibre.Map({container: el, style, ...view, attributionControl: false, ...more});
    return new compat.Map({container: el, style, ...view, renderer: lib, attributionControl: false, ...more});
}
function box(style = 'position:absolute;inset:0') { return stage.appendChild(Object.assign(document.createElement('div'), {style})); }
/** Loads a map in the stage to idle: {map, load (ms from the map's creation to idle), ids}. */
async function loaded(lib, {style, view = VIEW, more} = {}) {
    style ??= await loadStyle();
    const t0 = performance.now(), map = makeMap(lib, box(), style, view, more), ids = sourceIds(style);
    try { return {map, load: await settle(map, ids) - t0, ids}; } catch (e) { map.remove(); throw e; }
}
/** An animation of `ms` with the frames counted while it runs (once it stops, a map that rightly stops drawing would look slower). */
async function animate(map, to, ms = SECONDS * 1000) {
    const f = frames(map).start();
    map.benchIdle = nextIdle(map);
    // (`essential`: the animation is what is measured, so it also runs where the system asks for less motion.)
    map.easeTo({...to, duration: ms, essential: true});
    await sleep(ms);
    return f.stop();
}
/** Calls `fn` once in each frame for `ms`, with the frames counted. */
async function everyFrame(map, ms, fn) {
    const f = frames(map).start(), end = performance.now() + ms;
    let calls = 0;
    // (map.benchIdle is the first idle after the last call.)
    while (performance.now() < end) { fn(calls++); map.benchIdle = nextIdle(map); await frame(); }
    return {...f.stop(), calls: calls / (ms / 1000)};
}

// ---- The start timeline (#371) ----
/** The network answer (page clock) of the tile "source|z/x/y" from the resource timings of the workers: the last answer of a URL with /z/x/y before it was built. */
const tileNet = (entries, key, built) => {
    const zxy = '/' + key.slice(key.lastIndexOf('|') + 1), v = entries.filter(e => e.name.includes(zxy) && e.responseEnd <= built).map(e => e.responseEnd);
    return v.length ? Math.max(...v) : undefined;
};
async function loadWithTimeline(lib) {
    try { performance.setResourceTimingBufferSize(5000); performance.clearResourceTimings(); } catch {}
    // (The style is fetched again for each start, so that the timeline has its answer.)
    const style = await (await fetch(STYLE)).json(), ids = sourceIds(style);
    workerNet.length = 0;
    const t0 = performance.now(), map = makeMap(lib, box(), style, VIEW);
    // (The times of the start events. Tiles are fetched in workers, which the resource timings of the page do not list,
    // so the tile steps come from the tile events, counted until the first idle. For this library: the key of the tile
    // built last before idle and the upload of each tile; the network answer of that tile comes from the worker timings.)
    const events = {}, at = k => () => { events[k] ??= performance.now(); };
    map.once('render', at('frame')); map.once('load', at('load')); map.once('idle', at('idle'));
    let lastKey; const ups = {};
    const ans = key => { at('tileAns')(); if (events.idle === undefined) { events.tileLast = performance.now(); lastKey = key; events.tiles = (events.tiles ?? 0) + 1; } };
    map.on('render', () => { if (events.idle === undefined) events.lastFrame = performance.now(); });
    if (lib === 'maplibre') { map.on('dataloading', e => { if (e.tile) at('tileReq')(); }); map.on('data', e => { if (e.tile) ans(); }); }
    else {
        map._tileReport(true);
        map.on('tile', e => { if (e.kind === 'req') at('tileReq')(); else if (e.kind === 'ans') ans(e.key); else if (e.kind === 'up' || e.kind === 'miss') ups[e.key] = performance.now(); });
    }
    let idle;
    try { idle = await settle(map, ids); } catch (e) { map.remove(); throw e; }
    if (lastKey) { events.tileUp = ups[lastKey]; events.tileNet = tileNet(workerNet, lastKey, events.tileLast); }
    const steps = startSteps(performance.getEntriesByType('resource'), t0, events, STYLE);
    return {map, values: {load: idle - t0, firstFrame: events.frame - t0, loadEvent: events.load - t0}, steps};
}

// ---- The cold start (#29) ----
/** The kind of a request of a start, for the order of the requests. */
const kindOf = (url, styleUrl) => url === styleUrl ? 'style' : /\/fonts\/|glyphs/.test(url) ? 'glyphs' : /sprite/.test(url) ? 'sprite'
    : /worker/.test(url) ? 'worker' : /\.(pbf|mvt)\b|\/\d+\/\d+\/\d+/.test(url) ? 'tiles' : /\.json\b|\/planet/.test(url) ? 'TileJSON' : 'other';
/**
 * A start with the style given by URL, with a query that no cache has, so that the map fetches the style itself. The
 * other files can still come from the HTTP cache of the page: the measure `cached` counts them, and test/bench/browsers.mjs
 * runs this scenario in a fresh browser context, with no cache, for each load.
 */
async function coldStart(lib) {
    try { performance.setResourceTimingBufferSize(5000); performance.clearResourceTimings(); } catch {}
    workerNet.length = 0;
    const url = STYLE + (STYLE.includes('?') ? '&' : '?') + 'benchcold=' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const t0 = performance.now(), map = makeMap(lib, box(), url, VIEW), ev = {}, at = k => () => { ev[k] ??= performance.now(); };
    map.once('render', at('frame'));
    if (lib === 'maplibre') map.on('dataloading', e => { if (e.tile) at('tileReq')(); });
    else { map._tileReport(true); map.on('tile', e => { if (e.kind === 'req') at('tileReq')(); }); }
    let idle;
    try {
        idle = await settle(map);
        // (The sources are known once the style has loaded.)
        idle = await settle(map, Object.keys(map.getStyle()?.sources ?? {}), Promise.resolve(true));
    } catch (e) { map.remove(); throw e; }
    map.remove();
    const pick = e => ({name: e.name, startTime: e.startTime, transferSize: e.transferSize, decodedBodySize: e.decodedBodySize});
    const entries = [...performance.getEntriesByType('resource').map(pick), ...workerNet].filter(e => e.startTime >= t0 - 1 && e.startTime <= idle);
    // (The workers of MapLibre GL JS are modules, whose requests the page does not see: its tiles come from the tile event.)
    const seen = entries.map(e => ({kind: kindOf(e.name, url), at: e.startTime}));
    if (ev.tileReq !== undefined && !seen.some(e => e.kind === 'tiles')) seen.push({kind: 'tiles', at: ev.tileReq});
    const order = [...new Set(seen.sort((a, b) => a.at - b.at).map(e => e.kind))].filter(k => k !== 'other').join(' → ');
    // (A cross-origin answer without Timing-Allow-Origin has both sizes 0, and is not counted.)
    const cached = entries.filter(e => e.transferSize === 0 && e.decodedBodySize > 0).length;
    return {values: {tileReq: ev.tileReq - t0, firstFrame: ev.frame - t0, idle: idle - t0, requests: entries.length, cached}, order};
}
/** Raw pixels of a 64 × 64 icon with stripes; `i` moves them. */
const pixels = i => {
    const S = 64, d = new Uint8Array(S * S * 4);
    for (let p = 0; p < S * S; p++) d.set(((p % S + (p / S | 0) + i * 4) >> 3) & 1 ? [209, 73, 91, 255] : [47, 127, 209, 255], p * 4);
    return {width: S, height: S, data: d};
};
const camera = ratio => ({id: ratio ? 'camera' + ratio : 'camera', name: ratio ? `Camera at pixel ratio ${ratio}` : 'Camera',
    note: `a static repaint, a pan, a rotation and a zoom, apart${ratio ? ` (setPixelRatio(${ratio}) after the load)` : ''}`,
    measures: [...cam('static', 'Static repaint'), ...cam('pan', 'Pan'), ...cam('rotate', 'Rotation'), ...cam('zoom', 'Zoom'), ['blocked', 'Main thread blocked (long tasks) in the pan', 'ms', 0], ['ratio', 'Pixel ratio of the drawing buffer', '', 2]],
    async run(lib) {
        const {map, ids} = await loaded(lib), part = SECONDS * 600;
        // (setPixelRatio and not the option of the constructor, which the compat entry does not read yet: #662.)
        if (ratio) { const armed = nextIdle(map); map.setPixelRatio(ratio); await settle(map, ids, armed); }
        // (Against the container: the canvas of this library has a CSS size of the ratio × 100 %, scaled down.)
        const values = {ratio: map.getCanvas().width / map.getContainer().clientWidth};
        await sleep(300);
        // (A static repaint draws the same view in each frame: the cost of a frame without new tiles or labels.)
        Object.assign(values, camValues('static', await everyFrame(map, part, () => map.triggerRepaint())));
        const pan = await animate(map, {center: [-73.99, 40.725]}, part);
        Object.assign(values, camValues('pan', pan), {blocked: pan.blocked});
        await settle(map, ids, map.benchIdle);
        Object.assign(values, camValues('rotate', await animate(map, {bearing: 90}, part)));
        await settle(map, ids, map.benchIdle);
        Object.assign(values, camValues('zoom', await animate(map, {zoom: VIEW.zoom + 1.5}, part)));
        map.remove();
        return {values};
    }});

// ---- The scenarios ----
// Each scenario has an id, a name, the libraries it compares, its measures ([key, label, unit]) and `run(lib)`, which
// returns {values, steps?} for one run and removes its maps.
const cam = (key, label) => [[key + 'Fps', `${label}: frames per second`, 'fps', 1], [key + 'Gap', `${label}: median frame gap`, 'ms', 1], [key + 'P90', `${label}: 90th percentile frame gap`, 'ms', 1], [key + 'Worst', `${label}: worst frame gap`, 'ms', 0]];
const camValues = (key, f) => ({[key + 'Fps']: f.fps, [key + 'Gap']: f.gap, [key + 'P90']: f.p90, [key + 'Worst']: f.worst});
const TERRAIN_VIEW = {center: [7.70, 45.99], zoom: 12, pitch: 60, bearing: 20}, TERRAIN_END = {center: [7.66, 45.975], zoom: 13.2, bearing: 110, pitch: 60};

const scenarios = [
    {id: 'load', name: 'Load to idle', note: 'with the start timeline', measures: [['load', 'Load to idle', 'ms', 0], ['firstFrame', 'First frame', 'ms', 0], ['loadEvent', 'load event', 'ms', 0]],
        async run(lib) { const {map, values, steps} = await loadWithTimeline(lib); map.remove(); return {values, steps}; }},
    {id: 'cold', name: 'Cold start', note: q.get('latency') ? `the style by URL, ${q.get('latency')} ms added to each request, no cache` : 'the style by URL, past the cache, on the network of this device',
        skip: q.has('nocold'), measures: [['tileReq', 'First tile request', 'ms', 0], ['firstFrame', 'First frame', 'ms', 0], ['idle', 'Idle', 'ms', 0],
            ['requests', 'Requests before idle (the page, and the workers of this library)', '', 0], ['cached', 'Of these, answered from the HTTP cache', '', 0]],
        run: coldStart},
    {id: 'terrain', name: '3D terrain', note: 'load and a pan around the Matterhorn', skip: q.has('noterrain'), measures: [['load', 'Load to idle', 'ms', 0], ...cam('pan', 'Pan')],
        async run(lib) {
            const {map, load} = await loaded(lib, {style: withTerrain(await loadStyle()), view: TERRAIN_VIEW});
            await sleep(300);
            const f = await animate(map, TERRAIN_END); map.remove();
            return {values: {load, ...camValues('pan', f)}};
        }},
    {id: 'sky', name: 'Pitch 85 with sky', note: 'load and a turn of 90°', measures: [['load', 'Load to idle', 'ms', 0], ...cam('turn', 'Turn')],
        async run(lib) {
            const style = await loadStyle(); style.sky = SKY;
            const {map, load} = await loaded(lib, {style, view: {...VIEW, pitch: 85, bearing: 0}, more: {maxPitch: 85}});
            await sleep(300);
            const f = await animate(map, {bearing: 90, pitch: 85}); map.remove();
            return {values: {load, ...camValues('turn', f)}};
        }},
    {id: 'globe', name: 'Globe', note: 'load and a turn of 90° of longitude', measures: [['load', 'Load to idle', 'ms', 0], ...cam('turn', 'Turn')],
        async run(lib) {
            const style = await loadStyle(); style.projection = {type: 'globe'};
            const {map, load} = await loaded(lib, {style, view: {center: [-40, 30], zoom: 1.6}});
            await sleep(300);
            const f = await animate(map, {center: [50, 30]}); map.remove();
            return {values: {load, ...camValues('turn', f)}};
        }},
    camera(), camera(2), camera(3),
    ...[1000, 10000].map(n => ({id: 'markers' + n, name: `${n.toLocaleString('en')} markers`, note: 'MapLibre GL JS: Marker (DOM); this library: a marker layer', skip: q.has('nomarkers'), markers: true,
        measures: [['add', 'Add the markers', 'ms', 0], ...cam('pan', 'Pan').filter(m => !m[0].endsWith('Gap'))],
        async run(lib) {
            const {map} = await loaded(lib), layer = manyMarkers(n, VIEW.center, 0.05), a0 = performance.now();
            if (lib === 'maplibre') for (const d of layer.data) new maplibre.Marker({color: d.props.color}).setLngLat(d.lngLat).addTo(map);
            // (A marker layer is a symbol layer with an image that is an SVG template: each marker fills its slots.)
            else { await addImages(map); addMarkers(map, layer); }
            const add = performance.now() - a0;
            await sleep(1500);
            const f = await animate(map, {center: [-73.975, 40.735], zoom: 15.2, bearing: 40}); map.remove();
            const v = camValues('pan', f); delete v.panGap;
            return {values: {add, ...v}};
        }})),
    {id: 'geojson', name: 'GeoJSON setData', note: '10,000 points, new data in every frame for 3 s (#878)', measures: [['add', 'addSource to idle', 'ms', 0], ['fps', 'Frames per second during the updates', 'fps', 1], ['calls', 'setData calls per second', '/s', 1], ['worst', 'Worst frame gap', 'ms', 0], ['after', 'Last setData to idle', 'ms', 0]],
        async run(lib) {
            const {map, ids} = await loaded(lib), sets = [0, 1, 2, 3].map(i => points(10000, i + 1));
            const a0 = performance.now(), armed = nextIdle(map);
            map.addSource('bench-points', {type: 'geojson', data: sets[0]});
            map.addLayer({id: 'bench-points', type: 'circle', source: 'bench-points', paint: {'circle-radius': 3, 'circle-color': '#d1495b'}});
            const add = await settle(map, [...ids, 'bench-points'], armed) - a0;
            const f = await everyFrame(map, 3000 * SECONDS / 5, i => map.getSource('bench-points').setData(sets[(i + 1) % sets.length]));
            const t = performance.now(), after = await settle(map, [...ids, 'bench-points'], map.benchIdle) - t;
            map.remove();
            return {values: {add, fps: f.fps, calls: f.calls, worst: f.worst, after}};
        }},
    {id: 'edits', name: 'Run-time edits', note: 'setPaintProperty, setFeatureState, a layer reorder through update() (#875)',
        measures: [['paintFrames', '100 × setPaintProperty, one per frame: first call to idle', 'ms', 0], ['paintTask', '100 × setPaintProperty in one task: the calls', 'ms', 1], ['paintTaskIdle', '100 × setPaintProperty in one task: first call to idle', 'ms', 0],
            ['hover', '30 hover steps of setFeatureState, one per frame: first step to idle', 'ms', 0], ['reorder', 'Layer reorder (this library: update() of the main API; MapLibre GL JS: moveLayer): to idle', 'ms', 0]],
        async run(lib) {
            const style = await loadStyle(), {map, ids} = await loaded(lib, {style}), values = {};
            const fill = style.layers.find(l => l.type === 'fill' && /water/.test(l.id))?.id ?? style.layers.find(l => l.type === 'fill').id;
            const colour = i => i % 2 ? '#7fa8d8' : '#9cc0ea';
            await sleep(300);
            // (The idle that ends an edit is the first one after its last call.)
            let t = performance.now(), armed;
            for (let i = 0; i < 100; i++) { map.setPaintProperty(fill, 'fill-color', colour(i)); if (i === 99) armed = nextIdle(map); await frame(); }
            values.paintFrames = await settle(map, ids, armed) - t;
            t = performance.now();
            for (let i = 0; i < 100; i++) map.setPaintProperty(fill, 'fill-color', colour(i + 1));
            values.paintTask = performance.now() - t;
            values.paintTaskIdle = await settle(map, ids, nextIdle(map)) - t;
            map.addSource('bench-hover', {type: 'geojson', data: points(1000, 7)});
            map.addLayer({id: 'bench-hover', type: 'circle', source: 'bench-hover', paint: {'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 8, 4], 'circle-color': '#2f7fd1'}});
            await settle(map, [...ids, 'bench-hover']);
            t = performance.now();
            for (let i = 0; i < 30; i++) {
                if (i) map.setFeatureState({source: 'bench-hover', id: i - 1}, {hover: false});
                map.setFeatureState({source: 'bench-hover', id: i}, {hover: true});
                if (i === 29) armed = nextIdle(map);
                await frame();
            }
            values.hover = await settle(map, [...ids, 'bench-hover'], armed) - t;
            // The reorder moves the fill layer above the last layer that is not a symbol layer.
            const order = style.layers.map(l => l.id), to = style.layers.findLastIndex(l => l.type !== 'symbol');
            const moved = [...style.layers.filter(l => l.id !== fill)];
            moved.splice(moved.findIndex(l => l.id === order[to]) + 1, 0, style.layers.find(l => l.id === fill));
            if (lib === 'maplibre') {
                t = performance.now();
                map.moveLayer(fill, moved[moved.findIndex(l => l.id === fill) + 1]?.id);
                values.reorder = await settle(map, ids, nextIdle(map)) - t;
                map.remove();
            } else {
                map.remove();
                const el = box(), description = {style, initialView: VIEW, renderer: lib, attribution: false};
                const m = host.createMap(el, description);
                try {
                    await settleHost(m);
                    await sleep(300);
                    t = performance.now();
                    m.update({...description, style: {...style, layers: moved}});
                    values.reorder = await settleHost(m, m.once('idle')) - t;
                } finally { m.destroy(); }
            }
            return {values};
        }},
    {id: 'images', name: 'Images', note: 'addImage with raw pixels (64 × 64) for 1,000 icons, then 500 × updateImage, each with triggerRepaint (MapLibre GL JS draws no frame for updateImage alone)',
        measures: [['add', 'addImage and the icon layer: to idle', 'ms', 0], ['frames', '500 × updateImage, one per frame: first call to idle', 'ms', 0],
            ['fps', 'Frames per second during the updates', 'fps', 1], ['worst', 'Worst frame gap during the updates', 'ms', 0],
            ['task', '500 × updateImage in one task: the calls', 'ms', 1], ['taskIdle', '500 × updateImage in one task: first call to idle', 'ms', 0]],
        async run(lib) {
            const {map, ids} = await loaded(lib), pics = [0, 1, 2, 3, 4, 5, 6, 7].map(pixels), all = [...ids, 'bench-icons'], values = {};
            await sleep(300);
            let t = performance.now(), armed = nextIdle(map);
            map.addImage('bench-icon', pics[0]);
            map.addSource('bench-icons', {type: 'geojson', data: points(1000, 5)});
            map.addLayer({id: 'bench-icons', type: 'symbol', source: 'bench-icons', layout: {'icon-image': 'bench-icon', 'icon-size': 0.4, 'icon-allow-overlap': true}});
            values.add = await settle(map, all, armed) - t;
            const f = frames(map).start();
            t = performance.now();
            for (let i = 0; i < 500; i++) { map.updateImage('bench-icon', pics[(i + 1) % pics.length]); map.triggerRepaint(); if (i === 499) armed = nextIdle(map); await frame(); }
            Object.assign(values, (({fps, worst}) => ({fps, worst}))(f.stop()));
            values.frames = await settle(map, all, armed) - t;
            t = performance.now();
            for (let i = 0; i < 500; i++) { map.updateImage('bench-icon', pics[i % pics.length]); map.triggerRepaint(); }
            values.task = performance.now() - t;
            values.taskIdle = await settle(map, all, nextIdle(map)) - t;
            map.remove();
            return {values};
        }},
    {id: 'lifecycle', name: 'Lifecycle', note: '8 × create and remove(), and two maps on one page',
        measures: [['create', 'Create to idle, median of 8', 'ms', 0], ['remove', 'remove(), median of 8', 'ms', 1], ['workers', 'Workers started by the 8 maps and not ended', '', 0],
            ['two', 'Two maps: create both to both idle', 'ms', 0], ['twoFps', 'Two maps: frames per second of each in a pan', 'fps', 1], ['twoWorst', 'Two maps: worst frame gap', 'ms', 0]],
        async run(lib) {
            const style = await loadStyle(), ids = sourceIds(style), creates = [], removes = [];
            const before = workers.started - workers.ended;
            for (let i = 0; i < 8; i++) {
                const t = performance.now(), map = makeMap(lib, box(), style, VIEW);
                try { creates.push(await settle(map, ids) - t); } finally { const r = performance.now(); map.remove(); removes.push(performance.now() - r); }
                stage.replaceChildren();
            }
            await sleep(500);
            const values = {create: median(creates), remove: median(removes), workers: workers.started - workers.ended - before};
            const t = performance.now(), maps = [box('position:absolute;left:0;top:0;bottom:0;width:50%'), box('position:absolute;right:0;top:0;bottom:0;width:50%')].map(el => makeMap(lib, el, style, VIEW));
            try {
                await Promise.all(maps.map(m => settle(m, ids)));
                values.two = performance.now() - t;
                await sleep(300);
                const f = await Promise.all(maps.map(m => animate(m, {center: [-73.99, 40.725], bearing: 30})));
                values.twoFps = (f[0].fps + f[1].fps) / 2; values.twoWorst = Math.max(f[0].worst, f[1].worst);
            } finally { for (const m of maps) m.remove(); }
            return {values};
        }},
];

// ---- The page ----
const list = $('scenarios'), only = q.get('only')?.toLowerCase(), skipped = new Set((q.get('skip') ?? '').split(',').map(x => x.trim()).filter(Boolean));
for (const s of scenarios) {
    const li = list.appendChild(document.createElement('li')), label = li.appendChild(document.createElement('label'));
    s.box = label.appendChild(Object.assign(document.createElement('input'), {type: 'checkbox', checked: !s.skip && !skipped.has(s.id) && (!only || s.id.toLowerCase().includes(only) || s.name.toLowerCase().includes(only))}));
    const text = label.appendChild(document.createElement('span'));
    text.append(s.name, Object.assign(document.createElement('small'), {textContent: s.note}));
}
if (q.get('runs')) $('runs').value = q.get('runs');

const fmt = (v, d = 0) => typeof v !== 'number' || Number.isNaN(v) ? 'n/a' : v.toFixed(d);
/** The results: one entry for each scenario and library, with the runs and, for each measure, the median as a field (results.load, results.panFps). */
const results = [];
/** The count of runs, with the runs that were measured while the map was not in view (#973). */
const runsCell = (r, n) => { const out = r.runs.filter(x => x.outOfView).length; return out ? `${n} (${out} out of view)` : `${n}`; };
const rowsOf = r => r.error ? [[r.scenarioName, r.libName, `failed: ${r.error}`, '', '', runsCell(r, r.runs.length)]]
    : r.measures.map(([key, label, unit, d]) => {
        const v = r.runs.map(x => x.values[key]), s = sorted(v), u = unit ? ' ' + unit : '';
        return [r.scenarioName, r.libName, label, fmt(r[key], d) + u, s.length > 1 ? `${fmt(s[0], d)}–${fmt(s.at(-1), d)}` : '', runsCell(r, s.length)];
    });
const OUT_NOTE = '"out of view": the map was less than 90 % in view, or the tab was not in front, during that many runs; the browser can slow such a map, and its numbers are not comparable.';
const TIMELINE = 'Start timeline, ms after the map was made (sprite, glyphs and worker file from resource timings, which do not list requests made in a worker; tiles from the tile events, counted until idle; for the last tile before idle, "net" is its network answer, "built" its tile event and "up" its upload to the GPU; the tile event of MapLibre GL JS (`data` with a tile) fires when the tile is built, before the upload; the style is fetched by the page before the map is made):';
/** The order of the first request of each kind in the cold start, the most common one over the runs, with its count. */
const orderLines = () => results.filter(r => r.scenario === 'cold' && r.runs.length).map(r => {
    const n = {}; for (const x of r.runs) n[x.order] = (n[x.order] ?? 0) + 1;
    const [order, k] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
    return `${r.libName}, cold start, order of the first requests: ${order || 'none seen'} (${k} of ${r.runs.length} runs)`;
});
const timelineLines = () => [...results.filter(r => r.scenario === 'load' && r.runs.length).map(r => timelineLine(r.libName, r.runs.map(x => x.steps))), ...orderLines()];

// ---- Kept results (#977): {search, runs, done: [results without measures], current: the name of the pair in progress} ----
const KEEP = 'map-jr-bench-kept', SEARCH = (() => { const k = new URLSearchParams(location.search); k.delete('auto'); return k.toString(); })();
const readKept = () => { try { const k = JSON.parse(sessionStorage.getItem(KEEP)); return k?.search === SEARCH && Array.isArray(k.done) ? k : null; } catch { return null; } };
const writeKept = k => { try { if (k) sessionStorage.setItem(KEEP, JSON.stringify(k)); else sessionStorage.removeItem(KEEP); } catch { /* storage full or blocked: the run goes on without it */ } };
const addRow = r => { for (const cells of rowsOf(r)) { const tr = tbody.insertRow(); for (const c of cells) tr.insertCell().textContent = c; } };
const withMeasures = r => ({...r, measures: scenarios.find(s => s.id === r.scenario)?.measures ?? []});
let keptNote = '';

async function runAll(chosen, kept = null) {
    $('run').disabled = $('runSelected').disabled = true; $('copy').disabled = true;
    tbody.replaceChildren(); $('timeline').replaceChildren(); results.length = 0; delete window.benchResults;
    const runs = kept?.runs ?? Math.max(1, Math.min(20, Math.round(+$('runs').value) || 3));
    const jobs = chosen.flatMap(s => (s.libs ?? ALL).map(lib => ({s, lib})));
    const keep = {search: SEARCH, runs, done: [], current: null};
    const save = () => { keep.done = results.map(({measures, ...r}) => r); writeKept(keep); };
    if (kept) {
        for (const r of kept.done) { results.push(withMeasures(r)); addRow(results.at(-1)); }
        const ended = kept.current && jobs.find(({s, lib}) => `${s.name}: ${LIBS[lib]}` === kept.current);
        if (ended) { const r = {scenario: ended.s.id, scenarioName: ended.s.name, lib: ended.lib, libName: LIBS[ended.lib], name: kept.current, measures: ended.s.measures, runs: [], error: 'the page ended during this scenario'}; for (const [key] of r.measures) r[key] = NaN; results.push(r); addRow(r); }
        save();
    } else writeKept(null);
    let n = 0;
    for (const {s, lib} of jobs) {
        n++;
        if (results.some(x => x.scenario === s.id && x.lib === lib)) continue;
        const r = {scenario: s.id, scenarioName: s.name, lib, libName: LIBS[lib], name: `${s.name}: ${LIBS[lib]}`, measures: s.measures, runs: []};
        keep.current = r.name; save();
        for (let i = 0; i < runs; i++) {
            status.textContent = `Running ${n} of ${jobs.length}, run ${i + 1} of ${runs}: ${r.name}`;
            stage.replaceChildren();
            await intoView();
            try { const x = await s.run(lib); if (stageOut) x.outOfView = true; r.runs.push(x); } catch (err) { r.error = String(err?.message ?? err); break; }
            stage.replaceChildren();
            // (A pause, so that the browser can give back the memory of the removed maps before the next run. Safari on
            // an iPhone ended the page during 3 runs when the pause was 300 ms, #959.)
            await sleep(1000);
            await window.benchBetween?.(`${r.name}, run ${i + 1}`); // (a measuring script can set it, to read the memory once the maps of a run are removed)
        }
        for (const [key] of s.measures) r[key] = median(r.runs.map(x => x.values[key]));
        results.push(r); keep.current = null; save();
        addRow(r);
    }
    const lines = timelineLines();
    const shown = [...(keptNote ? [keptNote] : []), ...(results.some(r => r.runs.some(x => x.outOfView)) ? [OUT_NOTE] : []), ...(lines.length ? [TIMELINE, ...lines] : [])];
    $('timeline').replaceChildren(...shown.map(l => Object.assign(document.createElement('div'), {textContent: l})));
    stage.replaceChildren();
    status.textContent = `Done: ${jobs.length} pairs of a scenario and a library, ${runs === 1 ? '1 run' : runs + ' runs'} of each.`;
    window.benchResults = results.map(({measures, ...r}) => r);
    writeKept(null); keptNote = '';
    $('run').disabled = $('runSelected').disabled = false; $('copy').disabled = false;
}
const runButton = $('run');
runButton.after(Object.assign(document.createElement('button'), {id: 'runSelected', textContent: 'Run the checked ones'}));
runButton.onclick = () => { for (const s of scenarios) s.box.checked = !s.skip; runAll(scenarios.filter(s => !s.skip)); };
$('runSelected').onclick = () => runAll(scenarios.filter(s => s.box.checked));
$('copy').onclick = () => {
    const head = [...document.querySelectorAll('#results th')].map(th => th.textContent);
    const md = [env(), '', `| ${head.join(' | ')} |`, `|${head.map((_, i) => i < 3 ? '---' : '---:').join('|')}|`,
        ...results.flatMap(rowsOf).map(c => `| ${c.join(' | ')} |`), '',
        ...(results.some(r => r.runs.some(x => x.outOfView)) ? [OUT_NOTE, ''] : []), ...(timelineLines().length ? [TIMELINE, '', ...timelineLines().map(l => `- ${l}`)] : [])].join('\n');
    navigator.clipboard.writeText(md).then(() => { status.textContent = 'Copied.'; }, () => { status.textContent = 'The browser did not allow the copy.'; });
};
/**
 * For the scripts that run the page several times (test/bench/browsers.mjs, webdriver.mjs): joins the runs of several
 * lists of benchResults, computes the medians again, and returns {bench, table} with the rows of the table as the page has them.
 */
window.benchMerge = lists => {
    const by = new Map();
    for (const list of lists) for (const r of list) {
        const k = r.scenario + '|' + r.lib, m = by.get(k);
        if (!m) by.set(k, {...r, runs: [...r.runs]}); else { m.runs.push(...r.runs); if (r.error) m.error ??= r.error; }
    }
    const bench = [...by.values()];
    for (const r of bench) { const s = scenarios.find(x => x.id === r.scenario); if (s) { r.measures = s.measures; for (const [key] of s.measures) r[key] = median(r.runs.map(x => x.values[key])); } }
    const head = [...document.querySelectorAll('#results th')].map(th => th.textContent);
    return {bench: bench.map(({measures, ...r}) => r), table: [head, ...bench.flatMap(r => r.measures ? rowsOf(r) : [])]};
};
const kept = readKept();
if (kept) {
    keptNote = `The page was reloaded${kept.current ? ` or ended during "${kept.current}"` : ''}; it kept ${kept.done.length} finished ${kept.done.length === 1 ? 'pair' : 'pairs'} of a scenario and a library from before.`;
    if (q.has('auto')) runAll(scenarios.filter(s => s.box.checked), kept);
    else {
        for (const r of kept.done) { results.push(withMeasures(r)); addRow(results.at(-1)); }
        $('timeline').replaceChildren(Object.assign(document.createElement('div'), {textContent: keptNote + (kept.current ? ' Open the page with ?auto to go on after it.' : '')}));
        status.textContent = keptNote; $('copy').disabled = false;
    }
} else if (q.has('auto')) $('runSelected').click();
