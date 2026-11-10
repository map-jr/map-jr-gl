// In-browser benchmark: this library against MapLibre GL JS on the visitor's own GPU. See bench.html.
import * as mapjr from '/dist/map-jr-gl.js';
import * as maplibre from '/ml/maplibre-gl.mjs';
import {manyMarkers} from '/demo/markers.mjs';

maplibre.setWorkerUrl('/ml/maplibre-gl-worker.mjs');
const q = new URLSearchParams(location.search);
const STYLE = q.get('style') || 'https://tiles.openfreemap.org/styles/liberty';
const VIEW = {center: [-74.0065, 40.7085], zoom: 14.3}, SECONDS = +(q.get('seconds') || 5);
const stage = document.getElementById('stage'), status = document.getElementById('status'), tbody = document.querySelector('#results tbody');

// Time every animation-frame callback on this thread, and total up long tasks (the thread blocked for 50 ms or more).
const raf = window.requestAnimationFrame.bind(window), scripts = [];
window.requestAnimationFrame = cb => raf(t => { const t0 = performance.now(); cb(t); scripts.push(performance.now() - t0); });
let blocked = 0;
try { new PerformanceObserver(list => { for (const e of list.getEntries()) blocked += e.duration; }).observe({type: 'longtask'}); } catch { blocked = NaN; /* not every browser reports long tasks */ }

const gl = document.createElement('canvas').getContext('webgl2'), info = gl?.getExtension('WEBGL_debug_renderer_info');
document.getElementById('env').textContent = `GPU: ${info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown'} · screen pixel ratio ${devicePixelRatio} · ${navigator.userAgent.replace(/^.*?\) /, '')}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = a => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : 0;

/** Each scenario builds a map, optionally adds markers, and says how to count the frames it draws. */
const scenarios = [
    {name: 'MapLibre GL JS', lib: 'maplibre'},
    {name: 'This library, main thread', lib: 'main'},
    {name: 'This library, worker', lib: 'worker'},
    ...(q.has('nomarkers') ? [] : [1000, 10000].flatMap(n => [
        {name: `${n.toLocaleString()} markers: MapLibre Marker (DOM)`, lib: 'maplibre', markers: n},
        {name: `${n.toLocaleString()} markers: marker layer, main thread`, lib: 'main', markers: n},
        {name: `${n.toLocaleString()} markers: marker layer, worker`, lib: 'worker', markers: n},
    ])),
    ...(q.has('nomarkers') ? [] : [{name: '100,000 markers: marker layer, worker', lib: 'worker', markers: 100000}]),
    // 3D terrain: the same style with an elevation source, relief shading and terrain, flown around the Matterhorn.
    ...(q.has('noterrain') ? [] : [
        {name: '3D terrain: MapLibre GL JS', lib: 'maplibre', terrain: true},
        {name: '3D terrain: this library, main thread', lib: 'main', terrain: true},
        {name: '3D terrain: this library, worker', lib: 'worker', terrain: true},
    ]),
];
const TERRAIN_VIEW = {center: [7.70, 45.99], zoom: 12, pitch: 60, bearing: 20}, TERRAIN_END = {center: [7.66, 45.975], zoom: 13.2, bearing: 110, pitch: 60};
/** Adds elevation, relief shading and terrain to a style (Mapterhorn tiles, as in the gallery). */
function withTerrain(style) {
    style.sources.benchdem = {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12};
    const firstSymbol = style.layers.findIndex(l => l.type === 'symbol');
    style.layers.splice(firstSymbol < 0 ? style.layers.length : firstSymbol, 0, {id: 'bench-relief', type: 'hillshade', source: 'benchdem', paint: {'hillshade-exaggeration': 0.4}});
    style.terrain = {source: 'benchdem', exaggeration: 1.5};
    return style;
}

async function run(s) {
    stage.replaceChildren();
    const el = stage.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;inset:0'}));
    const style = await (await fetch(STYLE)).json();
    delete style.terrain; delete style.sky;
    if (s.terrain) withTerrain(style);
    const view = s.terrain ? TERRAIN_VIEW : VIEW;
    const t0 = performance.now();
    let map, frames = 0, stamps = [];
    const frame = () => { frames++; stamps.push(performance.now()); };
    if (s.lib === 'maplibre') {
        map = new maplibre.Map({container: el, style, ...view, attributionControl: false});
        map.on('render', frame);
    } else {
        map = new mapjr.Map({container: el, style, ...view, renderer: s.lib, attributionControl: false});
        map.on('move', frame); // one camera report per frame drawn, whichever thread draws it
    }
    await new Promise(r => map.once('idle', r));
    const load = performance.now() - t0;
    let add = null;
    if (s.markers) {
        const layer = manyMarkers(s.markers, VIEW.center, 0.05), a0 = performance.now();
        if (s.lib === 'maplibre') for (const d of layer.data) new maplibre.Marker({color: d.props.color}).setLngLat(d.lngLat).addTo(map);
        else map.addMarkerLayer(layer);
        add = performance.now() - a0;
        await sleep(1500);
    }
    await sleep(600);
    frames = 0; stamps = []; scripts.length = 0; blocked = Number.isNaN(blocked) ? NaN : 0;
    const a0 = performance.now();
    map.easeTo({...(s.terrain ? TERRAIN_END : {center: [-73.975, 40.735], zoom: 15.2, bearing: 40}), duration: SECONDS * 1000});
    await sleep(SECONDS * 1000 + 100);
    // Count only frames drawn while the camera was animating: once it stops, a map that correctly stops drawing
    // would otherwise look slower than one that keeps redrawing an unchanged view.
    const during = stamps.filter(t => t <= a0 + SECONDS * 1000), gaps = during.slice(1).map((t, i) => t - during[i]);
    const span = during.length > 1 ? (during[during.length - 1] - during[0]) / 1000 : 1;
    const result = {name: s.name, load, add, fps: Math.max(0, during.length - 1) / span, worstGap: gaps.length ? Math.max(...gaps) : 0, script: median(scripts), worstScript: scripts.length ? Math.max(...scripts) : 0, blocked};
    map.remove();
    await sleep(300);
    return result;
}

const fmt = (v, d = 0) => v === null || Number.isNaN(v) ? 'n/a' : v.toFixed(d);
const cells = r => [r.name + (r.add !== null ? ` (added in ${fmt(r.add)} ms)` : ''), `${fmt(r.load)} ms`, fmt(r.fps, 1), `${fmt(r.worstGap)} ms`, `${fmt(r.script, 1)} / ${fmt(r.worstScript, 1)} ms`, `${fmt(r.blocked)} ms`];
const results = [];
document.getElementById('run').onclick = async e => {
    e.target.disabled = true; tbody.replaceChildren(); results.length = 0;
    const only = q.get('only'); // e.g. ?only=terrain
    const list = (document.getElementById('markers').checked ? scenarios : scenarios.filter(s => !s.markers)).filter(s => !only || s.name.toLowerCase().includes(only.toLowerCase()));
    for (const [i, s] of list.entries()) {
        status.textContent = `Running ${i + 1} of ${list.length}: ${s.name}`;
        try {
            const r = await run(s);
            results.push(r);
            const tr = tbody.insertRow();
            for (const c of cells(r)) tr.insertCell().textContent = c;
        } catch (err) { const tr = tbody.insertRow(); tr.insertCell().textContent = `${s.name}: failed (${err.message})`; tr.cells[0].colSpan = 6; }
    }
    stage.replaceChildren();
    status.textContent = 'Done.';
    window.benchResults = results;
    e.target.disabled = false; document.getElementById('copy').disabled = false;
};
document.getElementById('copy').onclick = () => {
    const head = [...document.querySelectorAll('#results th')].map(th => th.textContent);
    const md = [document.getElementById('env').textContent, '', `| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...results.map(r => `| ${cells(r).join(' | ')} |`)].join('\n');
    navigator.clipboard.writeText(md).then(() => { status.textContent = 'Copied.'; });
};
if (q.has('auto')) document.getElementById('run').click();
