// The gallery: one live map per row, beside the code that makes it. Maps are created when they scroll into view, so
// a phone is never asked for many WebGL contexts at once.
import {Map, NavigationControl, ScaleControl, FullscreenControl} from 'map-jr-gl';
import makeStyle from '../demo/style.mjs';
import {markers, photos, manyMarkers, dot, pin} from '../demo/markers.mjs';
import {americanaShields, shieldRow} from './americana.js';

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
        code: `import {Map, NavigationControl, ScaleControl} from 'map-jr-gl';

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

    {id: 'markers', title: 'Tens of thousands of markers, drawn on the canvas',
        points: ['A marker layer is one SVG template with {{slots}} and a list of positions.', 'Markers are drawn by the GPU. 50,000 cost about the same as 50.', 'Layers can swap by zoom, hide overlaps, and open a callout that map labels move away from.'],
        code: `const pins = map.addMarkerLayer({
  id: 'places',
  svg: '<svg viewBox="0 0 24 31"><path fill="{{color}}" d="..."/></svg>',
  width: 24, height: 31, anchor: 'bottom',
  minZoom: 12,          // small dots take over below this
  overlap: 'hide',      // do not pile up
  collide: true,        // map labels keep clear
  data: places.map(p => ({lngLat: p.lngLat, props: {color: p.color}})),
});
map.on('markerclick', e => e.layer.openPopup(e.index, e.marker.props.name));`,
        make: (el, row) => { const map = base(el, {zoom: 11.4}), places = manyMarkers(50000, NYC, 0.35).data, some = places.slice(0, 500);
            map.addMarkerLayer({id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: places});
            map.addMarkerLayer({id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12, overlap: 'hide', collide: true, data: some});
            map.addMarkerLayer(structuredClone(photos));
            map.on('markerclick', e => e.layer.openPopup(e.index, e.marker.props.name ?? `Marker at ${e.marker.lngLat.map(v => v.toFixed(3)).join(', ')}`));
            map.on('stats', e => row.out(`50,000 markers, ${e.fps.toFixed(0)} frames per second. Zoom in past 12 for pins.`)); row.out('50,000 markers. Zoom in past 12 for pins, then click one.'); return map; }},

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

    {id: 'shields', title: 'Icons made on demand: highway shields',
        points: ['An icon that the style names but no sprite contains can be drawn when it is first necessary.', 'This row runs the OSM Americana shield library without changes. It draws the correct sign for each route network, and puts the signs of a road with more than one route side by side.', 'OpenMapTiles data (for example OpenFreeMap) already contains the route information.'],
        code: `// A resolver gets the icon name and supplies the image. SVG is accepted.
map.setMissingStyleImageResolver(name => {
  const [kind, network, ref] = name.split('|');
  if (kind === 'shield') return map.addImage(name, drawShieldSVG(network, ref));
});

map.addLayer({id: 'shields', type: 'symbol', source: 'omt',
  'source-layer': 'transportation_name',
  layout: {
    'symbol-placement': 'line',
    'text-rotation-alignment': 'viewport',
    // Images in the text put the shields of a road with two routes side by side.
    'text-field': ['format',
      ['image', ['concat', 'shield|', ['get', 'route_1_network'], '|', ['get', 'route_1_ref']]], {},
      ['image', ['concat', 'shield|', ['get', 'route_2_network'], '|', ['get', 'route_2_ref']]], {}],
  }});`,
        make: async (el, row) => { const map = await loaded(base(el, {zoom: 10.2, center: [-74.05, 40.78]}));
            map.setLayoutProperty('road-shield', 'visibility', 'none');
            row.out('Loading shield definitions');
            await americanaShields(map);
            let drawn = 0;
            map.on('styleimagemissing', () => row.out(`${++drawn} different shields drawn`));
            map.addLayer({id: 'americana-shield', type: 'symbol', source: 'omt', 'source-layer': 'transportation_name', minzoom: 6, filter: ['has', 'route_1_network'],
                layout: {'symbol-placement': 'line', 'symbol-spacing': 300, 'text-rotation-alignment': 'viewport', 'text-field': shieldRow(4), 'text-padding': 6}});
            return map; }},

    {id: 'query', title: 'Ask the map what is at a position',
        points: ['queryFeatures reads the tile data directly. A style layer is not necessary, and hidden data is included.', 'Feature state changes how one feature looks, for example on hover.', 'GeoJSON sources update in place with setData.'],
        code: `const features = await map.queryFeatures(lngLat, {radius: 8});
// [{source, sourceLayer, id, properties, ...}]

map.addLayer({id: 'buildings', type: 'fill', source: 'omt', 'source-layer': 'building',
  paint: {'fill-color': ['case',
    ['boolean', ['feature-state', 'hover'], false], '#e5484d', '#d9d2c7']}});

map.on('mousemove', 'buildings', e => {
  map.removeFeatureState({source: 'omt', sourceLayer: 'building'});
  map.setFeatureState({source: 'omt', sourceLayer: 'building', id: e.features[0].id}, {hover: true});
});`,
        make: async (el, row) => { const map = await loaded(base(el, {zoom: 16.2}));
            map.setPaintProperty('building', 'fill-color', ['case', ['boolean', ['feature-state', 'hover'], false], '#e5484d', '#d9d2c7']);
            let last;
            map.on('mousemove', 'building', e => { const id = e.features[0]?.id; if (id === undefined || id === last) return; last = id;
                map.removeFeatureState({source: 'omt', sourceLayer: 'building'}); map.setFeatureState({source: 'omt', sourceLayer: 'building', id}, {hover: true}); });
            map.on('click', async e => { const f = await map.queryFeatures(e.lngLat, {radius: 8}); row.out(f.length ? f.slice(0, 6).map(x => x.sourceLayer + (x.properties.name ? ` "${x.properties.name}"` : x.properties.class ? ` (${x.properties.class})` : '')).join(', ') : 'Nothing here'); });
            row.out('Move the pointer across buildings. Click to list what is there.'); return map; }},

    {id: 'pmtiles', title: 'One file of tiles: PMTiles',
        points: ['A PMTiles archive is a single static file. The map reads the tiles it needs with HTTP range requests.', 'No tile server is necessary. Any file host that supports range requests is sufficient.'],
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
            row.out('Click to list the county, state and ZIP code'); return map; }},

    {id: 'server', title: 'The first picture, made on the server', pair: true,
        points: ['renderToSVG and renderToImage draw a map without a browser, on Node or in a Cloudflare Worker.', 'A page can show that picture immediately. The live map replaces it when it is ready.', 'The two pictures on the left were made when this site was built.'],
        code: `import {renderToSVG, renderToImage} from 'map-jr-gl/server';

const {svg} = await renderToSVG({
  style, center: [-74.0065, 40.7085], zoom: 14.3,
  width: 800, height: 500,
  markers: [placesLayer],
});

// A fixed-size image instead (JPEG). The rasteriser is supplied by you:
// @takumi-rs/core on Node, @takumi-rs/wasm on Cloudflare.
const {image, contentType} = await renderToImage({...options, rasteriser});`,
        make: (el, row) => {
            const [a, b] = el.children;
            a.innerHTML = '<span class="tag">server, SVG</span><img alt="Map drawn on the server as SVG" src="./ssr.svg">';
            b.innerHTML = '<span class="tag">server, JPEG</span><img alt="Map drawn on the server as a JPEG image" src="./ssr.jpg">';
            row.out('Both pictures show the same view as the first row.'); }},
];

const main = document.getElementById('rows');
const started = new WeakSet();
const observer = new IntersectionObserver(entries => {
    for (const e of entries) {
        if (!e.isIntersecting || started.has(e.target)) continue;
        started.add(e.target);
        const row = e.target.row;
        Promise.resolve().then(() => row.spec.make(row.stage, row)).then(map => { if (map) (window.maps ||= {})[row.spec.id] = map; }, err => { row.out(String(err.message)); console.error(err); });
    }
}, {rootMargin: '150px'});

for (const spec of rows) {
    const el = document.createElement('article');
    el.id = spec.id;
    el.innerHTML = (spec.pair ? '<div class="pair"><div></div><div></div></div>' : '<div class="map"><div class="live"></div></div>') +
        '<div class="text"><h2></h2><ul></ul><div class="readout"></div><div class="actions"></div><pre><code></code></pre></div>';
    el.querySelector('h2').textContent = spec.title;
    for (const p of spec.points) el.querySelector('ul').append(Object.assign(document.createElement('li'), {textContent: p}));
    el.querySelector('code').textContent = spec.code;
    const readout = el.querySelector('.readout');
    el.row = {spec, stage: spec.pair ? el.querySelector('.pair') : el.querySelector('.live'), actions: el.querySelector('.actions'), out: text => { readout.textContent = text; }};
    main.append(el);
    observer.observe(el);
}
