// The gallery: one live map per row, beside the code that makes it. Maps are created when they scroll into view, so
// a phone is never asked for many WebGL contexts at once.
//
// Each example file is complete: it does not import from another file of the gallery, so a visitor can copy it.
// The code of a row is in files, one for each form (site/examples/<row>.js for the main API, .vue, .jsx, and
// .compat.js for the API of MapLibre GL JS). The live map of a row runs the file of the main API form, or of the
// MapLibre form when that form is selected: so for these two forms, the code that a visitor reads is the code that
// runs. The Vue and React forms are shown as text; `node test/examples.mjs` checks that they compile.
import {Map} from '@map-jr/map-jr-gl/maplibre-compat';
import {configure} from '@map-jr/map-jr-gl';
import {markers, view} from '../demo/markers.mjs';
import {shield} from '../demo/shields.mjs';
import makeStyle from '../demo/style.mjs';

// (The style of the server row: the one that scripts/site.mjs gives to the server renderer.)
const STYLE = makeStyle('https://tiles.openfreemap.org/planet', '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
const modules = import.meta.glob('./examples/*.js');
const texts = import.meta.glob('./examples/*', {query: '?raw', import: 'default', eager: true});
const FORMS = [['core', 'Main API', '.js'], ['vue', 'Vue', '.vue'], ['react', 'React', '.jsx'], ['compat', 'MapLibre compatible', '.compat.js']];
const query = new URLSearchParams(location.search), stored = (() => { try { return localStorage.getItem('map-jr-code'); } catch { return null; } })();
let form = FORMS.some(f => f[0] === query.get('code')) ? query.get('code') : FORMS.some(f => f[0] === stored) ? stored : 'core';
// Add ?renderer=main (or worker) to the address to choose where the maps are drawn.
configure({renderer: query.get('renderer') ?? 'auto'});
const base = (container, extra = {}) => new Map({container, style: structuredClone(STYLE), center: [-74.0065, 40.7085], zoom: 13.6, attributionControl: {compact: true}, ...extra});
const loaded = map => new Promise(done => map.once('load', () => done(map)));
const button = (row, label, onClick) => { const b = Object.assign(document.createElement('button'), {textContent: label}); b.onclick = () => onClick(b); row.actions.append(b); return b; };

/** A row whose code is in the files site/examples/<id>.*: the live map runs one of them. */
const example = (id, title, points) => ({id, title, points,
    make: async (el, row) => (await modules[`./examples/${id}${form === 'compat' ? '.compat' : ''}.js`]()).default(el, {
        show: row.out,
        button: (label, onClick) => button(row, label, onClick),
        legend: (heading, items, note) => el.insertAdjacentHTML('beforeend', `<div class="legend"><b>${heading}</b>${items.map(([line, text]) => `<span><i style="border-top:${line}"></i>${text}</span>`).join('')}<small>${note}</small></div>`),
    })});

const rows = [
    example('basic', 'A MapLibre style, drawn off the main thread', ['Reads the MapLibre style specification: sources, layers, expressions.', 'Draws in a worker when the browser allows it, so a busy page does not make the map stutter.', 'Zoom, compass, scale and fullscreen controls are included.']),
    example('reactive', 'One description, and state to watch', ['The main API makes a map from one description. To change the map, give a new description: the library finds what is different.', 'The state of the map (the view, the features under the pointer) is a store. Frameworks read it directly.', 'The components for Vue and React are thin layers over this.']),
    example('markers', 'Tens of thousands of markers, drawn on the canvas', ['A marker layer is one SVG template with {{slots}} and a list of positions.', 'Markers are drawn by the GPU. 50,000 cost about the same as 50.', 'Layers can swap by zoom, hide overlaps, and open a callout that map labels move away from.']),
    example('terrain', '3D terrain, relief shading and contour lines from one elevation source', ['Terrain raises the ground. Buildings, labels and markers stay on the surface.', 'A contour source makes labelled contour lines in the tile workers. You do not need another library.', 'queryElevation reads the height at a position. Click the map.']),
    example('query', 'Ask the map what is at a position', ['queryFeatures reads the tile data directly. You do not need a style layer, and hidden data is included.', 'The result is a promise, because the tile data is in a worker.', 'Click the map. The features at that position show in a box on the map.']),
    example('pmtiles', 'One file of tiles: PMTiles', ['A PMTiles archive is a single static file. The map reads the tiles it needs with HTTP range requests.', 'You do not need a tile server. Any file host that supports range requests is sufficient.', 'Here the purple lines come from one PMTiles file of 2025 United States boundaries. The base map is a usual tile source.']),
    {id: 'server', title: 'The first view, rendered on the server', pair: true,
        points: ['renderToSVG and renderToImage render a map without a browser, on Node or in a Cloudflare Worker.', 'A page can show that render immediately. The live map replaces it when it is ready.', 'The map on top is live. The image below it was made when this site was built, with the same style, view and size. Select SVG or JPEG.', 'The server estimates the width of text, so in a crowded place it can show a different street name than the live map.'],
        code: `import {renderToSVG, renderToImage} from '@map-jr/map-jr-gl/server';

const {svg} = await renderToSVG({
  style, center: [-74.0065, 40.7085], zoom: 14.3,
  width: 800, height: 500,
  markers: [placesLayer],
});

// A fixed-size image instead (JPEG). The rasteriser is supplied by you:
// @takumi-rs/core on Node, @takumi-rs/wasm on Cloudflare.
const {image, contentType} = await renderToImage({...options, rasteriser});`,
        make: async (el, row) => {
            el.innerHTML = '<div><span class="tag">live map</span><div class="live"></div></div>' +
                '<div><span class="tag"></span><img alt=""></div>';
            // One image at a time, so that it has exactly the frame of the live map above it.
            const img = el.querySelector('img'), tag = el.querySelectorAll('.tag')[1], kinds = {SVG: './ssr.svg', JPEG: './ssr.jpg'}, buttons = {};
            const show = kind => { img.src = kinds[kind]; img.alt = `Map rendered on the server as ${kind}`; tag.textContent = `server, ${kind}`; for (const k in buttons) buttons[k].setAttribute('aria-pressed', String(k === kind)); };
            for (const kind in kinds) buttons[kind] = button(row, kind, () => show(kind));
            show('SVG');
            // The same style, view, shields and markers as scripts/site.mjs gives to the server renderer.
            const map = base(el.querySelector('.live'), view);
            map.setMissingStyleImageResolver(id => { const s = shield(id); if (s) return map.addImage(id, s.svg, s); });
            await loaded(map);
            map.addMarkerLayer(structuredClone(markers));
            row.out('Move the live map. The image stays as the server made it.'); return map; }},
];

const main = document.getElementById('rows');
// A map starts when its row comes near the view, and is removed when the row is far away again. Each map has its own
// WebGL context and memory on the GPU; a phone does not have enough for all the rows at one time.
const live = new WeakMap();
const observer = new IntersectionObserver(entries => {
    for (const e of entries) {
        if (!e.isIntersecting || live.has(e.target)) continue;
        const row = e.target.row;
        live.set(e.target, Promise.resolve().then(() => row.spec.make(row.stage, row)).then(map => { if (map) (window.maps ||= {})[row.spec.id] = map; return map; }, err => { row.out(String(err.message)); console.error(err); }));
    }
}, {rootMargin: '150px'});
/** Removes the live map of a row (a map of the main API has `destroy`, a map of the MapLibre API has `remove`). */
const stop = el => {
    const map = live.get(el), row = el.row;
    if (!map) return;
    live.delete(el);
    return map.then(m => { m?.destroy?.(); m?.remove?.(); row.stage.replaceChildren(); row.actions.replaceChildren(); row.out(''); delete window.maps?.[row.spec.id]; });
};
const far = new IntersectionObserver(entries => { for (const e of entries) if (!e.isIntersecting) stop(e.target); }, {rootMargin: '1500px'});

/** The code of a row in the selected form. A row with one text for each form (the server row) shows that text. */
const showCode = el => {
    const spec = el.row.spec, ext = FORMS.find(f => f[0] === form)[2];
    el.querySelector('code').textContent = spec.code ?? texts[`./examples/${spec.id}${ext}`].trim();
    el.querySelector('.runs').textContent = spec.code || form === 'core' || form === 'compat' ? '' : 'The live map runs the Main API form of this code.';
};
for (const spec of rows) {
    const el = document.createElement('article');
    el.id = spec.id;
    el.innerHTML = (spec.pair ? '<div class="pair"></div>' : '<div class="map"><div class="live"></div></div>') +
        '<div class="text"><h2></h2><ul></ul><div class="readout"></div><div class="actions"></div><pre><code></code></pre><small class="runs"></small></div>';
    el.querySelector('h2').textContent = spec.title;
    for (const p of spec.points) el.querySelector('ul').append(Object.assign(document.createElement('li'), {textContent: p}));
    const readout = el.querySelector('.readout');
    el.row = {spec, stage: spec.pair ? el.querySelector('.pair') : el.querySelector('.live'), actions: el.querySelector('.actions'), out: text => { readout.textContent = text; }};
    showCode(el);
    main.append(el);
    observer.observe(el);
    far.observe(el);
}

// The switch between the forms of the code. The choice is kept, and it is in the address (?code=vue) for a link.
const forms = document.getElementById('forms');
for (const [id, label] of FORMS) {
    const b = forms.appendChild(Object.assign(document.createElement('button'), {textContent: label, type: 'button'}));
    b.setAttribute('aria-pressed', String(id === form));
    b.onclick = async () => {
        if (id === form) return;
        // The live maps are made again only when the form that runs changes (to the MapLibre API or back from it).
        const again = (id === 'compat') !== (form === 'compat');
        form = id;
        try { localStorage.setItem('map-jr-code', id); } catch { /* no storage */ }
        query.set('code', id);
        history.replaceState(history.state, '', '?' + query + location.hash);
        for (const other of forms.children) other.setAttribute('aria-pressed', String(other === b));
        for (const el of main.children) {
            showCode(el);
            if (again && !el.row.spec.code) { await stop(el); observer.unobserve(el); observer.observe(el); }
        }
    };
}
