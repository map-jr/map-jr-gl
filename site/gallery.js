// The gallery: one live map per row, beside the code that makes it. Maps are created when they scroll into view, so
// a phone is never asked for many WebGL contexts at once.
import {Map, NavigationControl, Popup, ScaleControl, FullscreenControl} from 'map-jr-gl/maplibre-compat';
import {createMap} from 'map-jr-gl';
import makeStyle from '../demo/style.mjs';
import {markers, photos, manyMarkers, dot, pin, view} from '../demo/markers.mjs';
import {shield} from '../demo/shields.mjs';

const STYLE = makeStyle('https://tiles.openfreemap.org/planet', '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">© OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
const NYC = [-74.0065, 40.7085], MATTERHORN = [7.6586, 45.9763];
// Add ?renderer=main (or worker) to the address to choose where the maps are drawn.
const renderer = new URLSearchParams(location.search).get('renderer') ?? 'auto';
const base = (container, extra = {}) => new Map({container, style: structuredClone(STYLE), center: NYC, zoom: 13.6, attributionControl: {compact: true}, renderer, ...extra});
const loaded = map => new Promise(done => map.once('load', () => done(map)));
const button = (row, label, onClick) => { const b = Object.assign(document.createElement('button'), {textContent: label}); b.onclick = () => onClick(b); row.actions.append(b); return b; };

const rows = [
    {id: 'basic', title: 'A MapLibre style, drawn off the main thread',
        points: ['Reads the MapLibre style specification: sources, layers, expressions.', 'Draws in a worker when the browser allows it, so a busy page does not make the map stutter.', 'Zoom, compass, scale and fullscreen controls are included.'],
        code: `import {Map, NavigationControl, ScaleControl} from 'map-jr-gl/maplibre-compat';

const map = new Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [-74.0065, 40.7085],
  zoom: 13.6,
});
map.addControl(new NavigationControl());
map.addControl(new ScaleControl(), 'bottom-left');`,
        make: (el, row) => { const map = base(el).addControl(new NavigationControl()).addControl(new ScaleControl(), 'bottom-left').addControl(new FullscreenControl(), 'top-left');
            map.on('stats', e => row.out(`${map.renderer} rendering, ${e.fps.toFixed(0)} frames per second`));
            // Which thread draws is decided while the map starts, so it is reported once the map has loaded.
            map.once('load', () => row.out(`${map.renderer} rendering`)); row.out('Starting'); return map; }},

    {id: 'reactive', title: 'One description, and state to watch',
        points: ['The main entry makes a map from one description. To change the map, give a new description: the library finds what is different.', 'The state of the map (the view, the features under the pointer) is a store. Frameworks read it directly.', 'The Vue component of map-jr-gl/vue is a thin layer over this, with v-model:view.'],
        code: `import {createMap} from 'map-jr-gl';

let description = {
  style: 'https://tiles.openfreemap.org/styles/liberty',
  initialView: {center: [-74.0065, 40.7085], zoom: 13.6},
  interactiveLayers: ['park', 'water'],
};
const map = createMap(container, description);

// The state is a store: this runs when its part changes.
map.state.subscribe(s => s.view, view => show(view.zoom));
map.state.subscribe(s => s.hover, features => show(features[0]));

// A change is a new description.
map.update(description = {...description, markers: [pins]});`,
        make: (el, row) => {
            const pins = {id: 'reactive-pins', svg: dot, width: 14, height: 14, data: [[-74.0134, 40.7033], [-74.009, 40.7061], [-74.006, 40.7127], [-73.9969, 40.7061]].map(lngLat => ({lngLat, props: {color: '#d6453d'}}))};
            let description = {style: structuredClone(STYLE), initialView: {center: NYC, zoom: 13.6}, interactiveLayers: ['park', 'water'], renderer, attribution: {compact: true}}, shown = false;
            const host = createMap(el, description), report = () => { const s = host.state.get(), f = s.hover[0];
                row.out(`zoom ${s.view.zoom.toFixed(2)} · ${s.moving ? 'moving' : s.idle ? 'idle' : 'loading'} · under the pointer: ${f ? f.layer.id + (f.properties.name ? ' "' + f.properties.name + '"' : '') : 'nothing (move over a park or water)'}`); };
            host.state.subscribe(report);
            button(row, 'Add markers', b => { shown = !shown; host.update(description = {...description, markers: shown ? [pins] : []}); b.textContent = shown ? 'Remove markers' : 'Add markers'; });
            button(row, 'Tilt', () => host.moveTo({pitch: host.state.get().view.pitch ? 0 : 50, duration: 600}));
            report();
            return {remove: () => host.destroy()}; }},

    {id: 'markers', title: 'Tens of thousands of markers, drawn on the canvas',
        points: ['A marker layer is one SVG template with {{slots}} and a list of positions.', 'Markers are drawn by the GPU. 50,000 cost about the same as 50.', 'Layers can swap by zoom, hide overlaps, and open a callout that map labels move away from.'],
        code: `const pins = map.addMarkerLayer({
  id: 'places',
  svg: '<svg viewBox="0 0 24 31"><path fill="{{color}}" d="..."/></svg>',
  width: 24, height: 31, anchor: 'bottom',
  minZoom: 12,          // these places are dots below this zoom
  overlap: 'hide',      // do not pile up
  collide: true,        // map labels keep clear
  data: places.map(p => ({lngLat: p.lngLat, props: {color: p.color}})),
});
map.on('markerclick', e => e.layer.openPopup(e.index, e.marker.props.name));`,
        make: (el, row) => { const map = base(el, {zoom: 11.4}), places = manyMarkers(50000, NYC, 0.35).data, some = places.slice(0, 500);
            // 500 of the places are pins when the zoom is 12 or more. The other places stay as dots at each zoom.
            map.addMarkerLayer({id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', data: places.slice(500)});
            map.addMarkerLayer({id: 'dots-below-pins', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: some});
            map.addMarkerLayer({id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12, overlap: 'hide', collide: true, data: some});
            map.addMarkerLayer(structuredClone(photos));
            map.on('markerclick', e => e.layer.openPopup(e.index, e.marker.props.name ?? `Marker at ${e.marker.lngLat.map(v => v.toFixed(3)).join(', ')}`));
            map.on('stats', e => row.out(`50,000 markers, ${e.fps.toFixed(0)} frames per second. Past zoom 12, 500 of them become pins.`)); row.out('50,000 markers. Zoom in past 12: 500 of them become pins. Click one.'); return map; }},

    {id: 'terrain', title: '3D terrain, relief shading and contour lines from one elevation source',
        points: ['Terrain raises the ground. Buildings, labels and markers stay on the surface.', 'A contour source makes labelled contour lines in the tile workers. No extra library is necessary.', 'queryElevation reads the height at a position. Click the map.'],
        code: `map.addSource('dem', {type: 'raster-dem', tiles: [demUrl], encoding: 'terrarium', tileSize: 512, maxzoom: 12});
map.addLayer({id: 'relief', type: 'hillshade', source: 'dem'});
map.setTerrain({source: 'dem', exaggeration: 1.5});

map.addSource('contours', {
  type: 'contour', source: 'dem',
  multiplier: 3.28084,                       // metres to feet
  thresholds: {11: [200, 1000], 12: [100, 500], 14: [50, 200]},
});
map.addLayer({id: 'lines', type: 'line', source: 'contours', 'source-layer': 'contours',
  paint: {'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}});

const metres = await map.queryElevation(lngLat);`,
        make: async (el, row) => { const map = await loaded(base(el, {zoom: 12.4, center: MATTERHORN, pitch: 60, bearing: 25}).setTerrain({source: 'dem', exaggeration: 1.5}));
            const T = {ft: {9: [500, 1000], 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100]}, m: {9: [200, 1000], 11: [100, 500], 12: [50, 200], 14: [20, 100], 15: [10, 50]}};
            let unit = 'ft', terrain = true;
            map.addLayer({id: 'relief', type: 'hillshade', source: 'dem', paint: {'hillshade-shadow-color': '#5a4a3a', 'hillshade-exaggeration': 0.4}}, 'water');
            const contours = () => {
                for (const id of ['contour-lines', 'contour-labels']) if (map.getLayer(id)) map.removeLayer(id);
                if (map.getSource('contours')) map.removeSource('contours');
                map.addSource('contours', {type: 'contour', source: 'dem', multiplier: unit === 'ft' ? 3.28084 : 1, thresholds: T[unit]});
                map.addLayer({id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours', paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}}, 'water');
                map.addLayer({id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
                    layout: {'symbol-placement': 'line', 'text-size': 10, 'text-field': ['concat', ['number-format', ['get', 'ele'], {}], unit === 'ft' ? "'" : ' m'], 'text-font': ['Noto Sans Bold']},
                    paint: {'text-color': '#6b5a48', 'text-halo-color': '#fff', 'text-halo-width': 1.5}});
            };
            contours();
            button(row, 'Contours in metres', b => { unit = unit === 'ft' ? 'm' : 'ft'; b.textContent = unit === 'ft' ? 'Contours in metres' : 'Contours in feet'; contours(); });
            button(row, 'Flat map', b => { terrain = !terrain; map.setTerrain(terrain ? {source: 'dem', exaggeration: 1.5} : null); b.textContent = terrain ? 'Flat map' : '3D terrain'; });
            map.on('click', async e => { const m = await map.queryElevation(e.lngLat); row.out(m === null ? 'No elevation data here' : `${m.toFixed(0)} m (${(m * 3.28084).toFixed(0)} ft) above sea level`); });
            row.out('Click the map to read the elevation'); return map; }},

    {id: 'query', title: 'Ask the map what is at a position',
        points: ['queryFeatures reads the tile data directly. You do not need a style layer, and hidden data is included.', 'The result is a promise, because the tile data is in a worker.', 'Click the map. The features at that position show in a box on the map.'],
        code: `map.on('click', async e => {
  const features = await map.queryFeatures(e.lngLat, {radius: 8});
  // [{source, sourceLayer, id, properties, ...}]

  new Popup()
    .setLngLat(e.lngLat)
    .setHTML(features.map(f => f.sourceLayer + ': ' + (f.properties.name ?? f.properties.class)).join('<br>'))
    .addTo(map);
});`,
        make: async (el, row) => { const map = await loaded(base(el, {zoom: 16.2}));
            // A crosshair, so that it is clear that a click asks about one position.
            map.setCursor('crosshair');
            let popup;
            const text = v => String(v).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
            map.on('click', async e => { const f = await map.queryFeatures(e.lngLat, {radius: 8});
                popup?.remove();
                popup = new Popup({maxWidth: '260px'}).setLngLat(e.lngLat).setHTML('<div class="found">' + (f.length ? f.slice(0, 8).map(x => `<div><b>${text(x.sourceLayer)}</b> ${text(x.properties.name ?? x.properties.class ?? '')}</div>`).join('') + (f.length > 8 ? `<div>and ${f.length - 8} more</div>` : '') : 'Nothing here') + '</div>').addTo(map);
                row.out(`${f.length} features within 8 pixels`); });
            row.out('Click the map to list what is there.'); return map; }},

    {id: 'pmtiles', title: 'One file of tiles: PMTiles',
        points: ['A PMTiles archive is a single static file. The map reads the tiles it needs with HTTP range requests.', 'You do not need a tile server. Any file host that supports range requests is sufficient.', 'Here the purple lines come from one PMTiles file of 2025 United States boundaries. The base map is a usual tile source.'],
        code: `map.addSource('admin', {
  type: 'vector',
  url: 'pmtiles://https://example.com/boundaries.pmtiles',
});
map.addLayer({id: 'counties', type: 'line', source: 'admin',
  'source-layer': 'county_features',
  paint: {'line-color': '#5746af', 'line-width': 2}});`,
        make: async (el, row) => { const map = await loaded(base(el, {zoom: 9.2, center: [-74.1, 40.75]}));
            map.addSource('admin', {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'});
            map.addLayer({id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9, paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}});
            map.addLayer({id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features', paint: {'line-color': '#5746af', 'line-width': 2}});
            map.on('click', async e => { const f = await map.queryFeatures(e.lngLat, {sources: ['admin']}); row.out(f.map(x => x.properties.NAMELSAD ?? x.properties.NAME ?? x.properties.GEOID20).filter(Boolean).join(' · ') || 'Nothing here'); });
            // A label on the map for each thing that comes from the PMTiles file.
            el.insertAdjacentHTML('beforeend', '<div class="legend"><b>From one PMTiles file</b><span><i style="border-top:2px solid #5746af"></i>County boundaries</span><span><i style="border-top:1px solid #7c66dc"></i>ZIP code areas (from zoom 9)</span><small>The base map below them is a usual tile source.</small></div>');
            row.out('Click to list the county, state and ZIP code'); return map; }},

    {id: 'server', title: 'The first view, rendered on the server', pair: true,
        points: ['renderToSVG and renderToImage render a map without a browser, on Node or in a Cloudflare Worker.', 'A page can show that render immediately. The live map replaces it when it is ready.', 'The map on top is live. The image below it was made when this site was built, with the same style, view and size. Select SVG or JPEG.', 'The server estimates the width of text, so in a crowded place it can show a different street name than the live map.'],
        code: `import {renderToSVG, renderToImage} from 'map-jr-gl/server';

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
const far = new IntersectionObserver(entries => {
    for (const e of entries) {
        const map = live.get(e.target), row = e.target.row;
        if (e.isIntersecting || !map) continue;
        live.delete(e.target);
        map.then(m => { m?.remove?.(); row.stage.replaceChildren(); row.actions.replaceChildren(); row.out(''); delete window.maps?.[row.spec.id]; });
    }
}, {rootMargin: '1500px'});

for (const spec of rows) {
    const el = document.createElement('article');
    el.id = spec.id;
    el.innerHTML = (spec.pair ? '<div class="pair"></div>' : '<div class="map"><div class="live"></div></div>') +
        '<div class="text"><h2></h2><ul></ul><div class="readout"></div><div class="actions"></div><pre><code></code></pre></div>';
    el.querySelector('h2').textContent = spec.title;
    for (const p of spec.points) el.querySelector('ul').append(Object.assign(document.createElement('li'), {textContent: p}));
    el.querySelector('code').textContent = spec.code;
    const readout = el.querySelector('.readout');
    el.row = {spec, stage: spec.pair ? el.querySelector('.pair') : el.querySelector('.live'), actions: el.querySelector('.actions'), out: text => { readout.textContent = text; }};
    main.append(el);
    observer.observe(el);
    far.observe(el);
}
