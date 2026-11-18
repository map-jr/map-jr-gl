// The playground page: one map of the compat entry and a panel with controls. The state lives in the URL hash.
import {Map, NavigationControl} from '@map-jr/map-jr-gl/maplibre-compat';

const style = 'https://tiles.openfreemap.org/styles/liberty';
const dem = {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12, attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>'};

const defaults = {
    lng: 10, lat: 30, zoom: 1.5, pitch: 0, bearing: 0,
    sky: 0, 'sky-color': '#88c6fc', 'horizon-color': '#ffffff', 'fog-color': '#ffffff',
    'sky-horizon-blend': 0.8, 'horizon-fog-blend': 0.8, 'fog-ground-blend': 0.5, 'atmosphere-blend': 0.8,
    terrain: 0, exaggeration: 1, hillshade: 0, projection: 'mercator', renderer: 'worker',
};
const views = {
    city: {lng: -74.0119, lat: 40.7069, zoom: 16, pitch: 85, bearing: 30, sky: 1, terrain: 0, projection: 'mercator'},
    alps: {lng: 7.66, lat: 45.98, zoom: 12, pitch: 75, bearing: 210, sky: 1, terrain: 1, hillshade: 1, exaggeration: 1.2, projection: 'mercator'},
    globe: {lng: 10, lat: 30, zoom: 1.5, pitch: 0, bearing: 0, projection: 'globe'},
};

// Read the hash. A value that does not parse keeps the default.
function readHash() {
    const s = {...defaults};
    for (const [k, v] of new URLSearchParams(location.hash.slice(1))) {
        if (!(k in defaults)) continue;
        if (typeof defaults[k] === 'number') { const n = Number(v); if (Number.isFinite(n)) s[k] = n; }
        else if (k === 'projection' ? ['mercator', 'globe'].includes(v) : k === 'renderer' ? ['worker', 'main'].includes(v) : /^#[0-9a-f]{6}$/i.test(v)) s[k] = v;
    }
    return s;
}
const state = readHash();
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
function writeHash() {
    const p = new URLSearchParams();
    for (const k in defaults) if (state[k] !== defaults[k]) p.set(k, String(state[k]));
    const s = p.toString();
    history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
}

const map = new Map({
    container: 'map', style, center: [state.lng, state.lat], zoom: state.zoom, pitch: state.pitch, bearing: state.bearing,
    maxPitch: 90, renderer: state.renderer, attributionControl: {compact: true},
});
map.addControl(new NavigationControl({visualizePitch: true}), 'bottom-right');

const $ = id => document.getElementById(id);
// On a phone the panel is a bottom sheet that starts shrunk to one row.
if (matchMedia('(max-width: 600px)').matches) $('panel').open = false;
const skyKeys = ['sky-color', 'horizon-color', 'fog-color', 'sky-horizon-blend', 'horizon-fog-blend', 'fog-ground-blend', 'atmosphere-blend'];

// Apply the state that is not the camera to the map. It runs when the style has loaded and after each change.
let styleLoaded = false;
function applyLayers() {
    if (!styleLoaded) return;
    if (!map.getSource('dem')) map.addSource('dem', dem);
    map.setSky(state.sky ? Object.fromEntries(skyKeys.map(k => [k, state[k]])) : null);
    map.setTerrain(state.terrain ? {source: 'dem', exaggeration: state.exaggeration} : null);
    if (state.hillshade && !map.getLayer('hillshade')) {
        // The hillshade goes below the first symbol layer, so labels stay on top.
        const before = map.getStyle().layers.find(l => l.type === 'symbol')?.id;
        map.addLayer({id: 'hillshade', type: 'hillshade', source: 'dem', paint: {'hillshade-exaggeration': 0.4}}, before);
    } else if (!state.hillshade && map.getLayer('hillshade')) map.removeLayer('hillshade');
    if ((map.getProjection()?.type ?? 'mercator') !== state.projection) map.setProjection({type: state.projection});
}
map.on('style.load', () => { styleLoaded = true; applyLayers(); });

// Show the state in the controls.
function show(id, value) {
    const el = $(id);
    if (el.type === 'checkbox') el.checked = !!value; else el.value = value;
    const out = el.parentElement.querySelector('output');
    if (out) out.textContent = el.type === 'color' ? '' : String(value);
}
const showCamera = () => { for (const k of ['pitch', 'bearing', 'zoom']) show(k, round(state[k], k === 'zoom' ? 1 : 0)); };
function showAll() {
    showCamera();
    for (const k of [...skyKeys, 'sky', 'terrain', 'exaggeration', 'hillshade']) show(k, state[k]);
    for (const b of document.querySelectorAll('[data-projection]')) b.setAttribute('aria-pressed', String(b.dataset.projection === state.projection));
    for (const b of document.querySelectorAll('[data-renderer]')) b.setAttribute('aria-pressed', String(b.dataset.renderer === state.renderer));
}
showAll();

// The camera sliders follow the map while it moves.
map.on('move', () => {
    const c = map.getCenter();
    Object.assign(state, {lng: round(c.lng, 4), lat: round(c.lat, 4), zoom: round(map.getZoom(), 2), pitch: round(map.getPitch(), 1), bearing: round(map.getBearing(), 1)});
    showCamera();
});
map.on('moveend', writeHash);

for (const k of ['pitch', 'bearing', 'zoom']) $(k).addEventListener('input', e => map.jumpTo({[k]: Number(e.target.value)}));
for (const k of [...skyKeys, 'exaggeration']) $(k).addEventListener('input', e => {
    state[k] = e.target.type === 'color' ? e.target.value : Number(e.target.value);
    show(k, state[k]);
    applyLayers();
    writeHash();
});
for (const k of ['sky', 'terrain', 'hillshade']) $(k).addEventListener('change', e => {
    state[k] = e.target.checked ? 1 : 0;
    applyLayers();
    writeHash();
});
for (const b of document.querySelectorAll('[data-projection]')) b.addEventListener('click', () => {
    state.projection = b.dataset.projection;
    showAll();
    applyLayers();
    writeHash();
});
for (const b of document.querySelectorAll('[data-renderer]')) b.addEventListener('click', () => {
    if (b.dataset.renderer === state.renderer) return;
    state.renderer = b.dataset.renderer;
    writeHash();
    location.reload();
});
function go(v) {
    Object.assign(state, v);
    showAll();
    applyLayers();
    map.jumpTo({center: [state.lng, state.lat], zoom: state.zoom, pitch: state.pitch, bearing: state.bearing});
    writeHash();
}
for (const b of document.querySelectorAll('[data-view]')) b.addEventListener('click', () => go(views[b.dataset.view]));
$('reset').addEventListener('click', () => go({...defaults, renderer: state.renderer}));

// The console and the check of the page reach the map here.
window.map = map;
