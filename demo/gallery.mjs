// The gallery: one small map per feature. Maps are created lazily so a phone is not asked for a dozen WebGL contexts at once.
import {Map, Marker, Popup, NavigationControl, ScaleControl, FullscreenControl} from '/dist/tessera.js';
import {markers, photos, manyMarkers, dot, bubble, pin, cluster} from '/demo/markers.mjs';
import {shield} from '/demo/shields.mjs';

const NYC = [-74.0065, 40.7085];
const base = (container, extra = {}) => new Map({container, style: '/style.json', center: NYC, zoom: 13.6, attributionControl: {compact: true}, ...extra});
const withShields = map => map.setMissingStyleImageResolver(id => { const s = shield(id); if (s) return map.addImage(id, s.svg, s); });
const when = (map, fn) => map.once('load', () => fn(map));

const cards = [
    {title: 'Vector map with controls', text: 'A MapLibre style rendered with WebGL2 in a worker. Zoom, compass, scale and fullscreen controls are built in and themed with CSS variables.',
        make: el => base(el).addControl(new NavigationControl()).addControl(new ScaleControl(), 'bottom-left').addControl(new FullscreenControl(), 'top-left')},
    {title: 'Tilt and 3D buildings', text: 'Right-drag, ctrl-drag or move two fingers vertically to tilt. Building heights come from the tile data.',
        make: el => when(base(el, {zoom: 15.4, pitch: 55, bearing: 30}), map => {
            map.setLayoutProperty('building', 'visibility', 'none');
            map.addLayer({id: 'building-3d', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
                paint: {'fill-extrusion-color': '#e2dbd1', 'fill-extrusion-height': ['get', 'render_height'], 'fill-extrusion-base': ['get', 'render_min_height'], 'fill-extrusion-opacity': 0.85}}, 'road-casing');
        })},
    {title: '50,000 markers on the canvas', text: 'One SVG template, drawn as textured quads. The frame rate below is the map\'s own measurement while it moves.', readout: true,
        make: (el, out) => { const map = base(el, {zoom: 10.5}); map.addMarkerLayer(manyMarkers(50000)); map.on('stats', e => out(`${e.fps.toFixed(0)} frames/s, ${e.frameMs.toFixed(1)} ms of work per frame`)); out('Pan or zoom to measure'); return map; }},
    {title: 'Photos in markers, callouts that labels avoid', text: 'These markers are SVG with a raster image inside. Click one: it grows, a callout points at it, and map labels reflow around both.',
        make: el => { const map = base(el, {zoom: 12.4, center: [-74.02, 40.70]}); map.addMarkerLayer(structuredClone(photos)); map.addMarkerLayer(structuredClone(markers));
            map.on('markerclick', e => e.layer.openPopup(e.index, e.marker.props.name ?? 'Marker ' + e.marker.props.label)); return map; }},
    {title: 'Markers that adapt to zoom and avoid overlapping', text: 'Zoomed out, every place is a dot. Zoom in past 12 and the same data cross-fades to pins, which hide rather than pile up when they would overlap.', readout: true,
        make: (el, out) => { const map = base(el, {zoom: 11.2}), places = manyMarkers(600, NYC, 0.09).data;
            map.addMarkerLayer({id: 'dots', svg: dot, width: 12, height: 12, anchor: 'center', maxZoom: 12, data: places});
            map.addMarkerLayer({id: 'pins', svg: pin, width: 24, height: 31, anchor: 'bottom', minZoom: 12, overlap: 'hide', collide: true, data: places});
            const show = () => out(`zoom ${map.getZoom().toFixed(1)}: ${map.getZoom() < 12 ? 'dots' : 'pins, overlaps hidden'}`); map.on('move', show); show(); return map; }},
    {title: 'Clustering with the public API', text: 'Clustering is not built in. This card groups 20,000 points in about twenty lines of application code and feeds the result to two marker layers whenever the zoom settles.', readout: true,
        make: (el, out) => { const map = base(el, {zoom: 9.5}), points = manyMarkers(20000, NYC, 0.5).data;
            const bubbles = map.addMarkerLayer({id: 'clusters', svg: bubble, width: 40, height: 40, anchor: 'center', data: []});
            const singles = map.addMarkerLayer({id: 'singles', svg: pin, width: 24, height: 31, anchor: 'bottom', data: []});
            const update = () => { const t0 = performance.now(), r = cluster(points, Math.round(map.getZoom())); bubbles.setData(r.clusters); singles.setData(r.singles);
                out(`${r.clusters.length} clusters and ${r.singles.length} single markers, grouped in ${(performance.now() - t0).toFixed(0)} ms`); };
            map.on('moveend', update); update();
            map.on('markerclick', e => { if (e.layer === bubbles) map.easeTo({center: e.marker.lngLat, zoom: map.getZoom() + 2}); });
            return map; }},
    {title: 'Highway shields generated as SVG', text: 'The style computes an icon name per road; a resolver draws the matching shield on demand. No sprite sheet involved.',
        make: el => withShields(base(el, {zoom: 11.2, center: [-74.05, 40.74]}))},
    {title: 'GeoJSON, live updates and layer events', text: 'A GeoJSON source updated every frame with setData, and a layer-scoped click handler.', readout: true,
        make: (el, out) => when(base(el, {zoom: 13}), map => {
            const ring = t => ({type: 'FeatureCollection', features: [
                {type: 'Feature', properties: {name: 'Zone'}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.995, 40.70], [-73.995, 40.716], [-74.02, 40.716], [-74.02, 40.70]]]}},
                {type: 'Feature', properties: {name: 'Courier'}, geometry: {type: 'Point', coordinates: [-74.0075 + 0.011 * Math.cos(t), 40.708 + 0.007 * Math.sin(t)]}}]});
            map.addSource('live', {type: 'geojson', data: ring(0)});
            map.addLayer({id: 'zone', type: 'fill', source: 'live', filter: ['==', ['geometry-type'], 'Polygon'], paint: {'fill-color': '#e5484d', 'fill-opacity': 0.18, 'fill-outline-color': '#e5484d'}});
            map.addLayer({id: 'courier', type: 'circle', source: 'live', filter: ['==', ['geometry-type'], 'Point'], paint: {'circle-radius': 8, 'circle-color': '#e5484d', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2}});
            map.on('click', 'zone', e => out(`Clicked "${e.features[0].properties.name}" at ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)}`));
            out('Click inside the red zone');
            const tick = () => { if (!el.isConnected) return; map.getSource('live')?.setData(ring(performance.now() / 4000)); requestAnimationFrame(tick); };
            setTimeout(tick, 500);
        })},
    {title: 'PMTiles archive', text: 'County and ZIP code boundaries read straight from a single static file with HTTP range requests.', readout: true,
        make: (el, out) => when(base(el, {zoom: 9.2, center: [-74.1, 40.75]}), map => {
            map.addSource('admin', {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'});
            map.addLayer({id: 'zips', type: 'line', source: 'admin', 'source-layer': 'zip_features', minzoom: 9, paint: {'line-color': '#7c66dc', 'line-width': 0.6, 'line-opacity': 0.6}});
            map.addLayer({id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features', paint: {'line-color': '#5746af', 'line-width': 2}});
            map.on('click', async e => { const f = await map.queryFeatures(e.lngLat, {sources: ['admin']}); out(f.map(x => x.properties.NAMELSAD ?? x.properties.NAME ?? x.properties.GEOID20).filter(Boolean).join(' · ') || 'Nothing here'); });
            out('Click to list the county, state and ZIP code');
        })},
    {title: 'Hillshade and elevation queries', text: 'Relief shading from elevation tiles, and queryElevation reading the same data. Click anywhere.', readout: true,
        make: (el, out) => when(base(el, {zoom: 10.6, center: [7.6586, 45.9763]}), map => {
            map.addLayer({id: 'relief', type: 'hillshade', source: 'dem', paint: {'hillshade-shadow-color': '#5a4a3a', 'hillshade-exaggeration': 0.6}}, 'water');
            map.on('click', async e => { const m = await map.queryElevation(e.lngLat); out(m === null ? 'No elevation data here' : `${m.toFixed(0)} m (${(m * 3.28084).toFixed(0)} ft) above sea level`); });
            out('Click the map (this is the Matterhorn)');
        })},
    {title: 'Contour lines from elevation tiles', text: 'A built-in contour source turns elevation tiles into labelled contour lines in the tile workers. Intervals change with zoom; these are in feet.',
        make: el => when(base(el, {zoom: 12.3, center: [7.6586, 45.9763]}), map => {
            map.addLayer({id: 'relief', type: 'hillshade', source: 'dem', paint: {'hillshade-shadow-color': '#5a4a3a', 'hillshade-exaggeration': 0.35}}, 'water');
            map.addSource('contours', {type: 'contour', source: 'dem', multiplier: 3.28084, overzoom: 1,
                thresholds: {9: [500, 1000], 11: [200, 1000], 12: [100, 500], 14: [50, 200], 15: [20, 100]}});
            map.addLayer({id: 'contour-lines', type: 'line', source: 'contours', 'source-layer': 'contours',
                paint: {'line-color': 'hsla(25, 30%, 35%, 0.55)', 'line-width': ['match', ['get', 'level'], 1, 1.2, 0.5]}}, 'water');
            map.addLayer({id: 'contour-labels', type: 'symbol', source: 'contours', 'source-layer': 'contours', filter: ['>', ['get', 'level'], 0],
                layout: {'symbol-placement': 'line', 'text-size': 10, 'text-field': ['concat', ['number-format', ['get', 'ele'], {}], "'"], 'text-font': ['Noto Sans Bold']},
                paint: {'text-color': '#6b5a48', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5}});
        })},
    {title: 'Features under the cursor, from tile data', text: 'queryFeatures needs no style layer: it reads what the tiles contain, including things this style does not draw.', readout: true,
        make: (el, out) => { const map = base(el, {zoom: 15.2}); out('Click the map');
            map.on('click', async e => { const f = await map.queryFeatures(e.lngLat, {radius: 4}); out(f.map(x => x.sourceLayer + (x.properties.name ? ` "${x.properties.name}"` : x.properties.class ? ` (${x.properties.class})` : '')).join(', ') || 'Nothing here'); }); return map; }},
    {title: 'DOM marker and popup (MapLibre API)', text: 'For rich or draggable content there is a Marker and Popup with MapLibre\'s interface. Drag the pin.', readout: true,
        make: (el, out) => { const map = base(el, {zoom: 13.4}); const m = new Marker({color: '#e5484d', draggable: true}).setLngLat(NYC).setPopup(new Popup({offset: 38}).setText('Drag me, or click to toggle this popup')).addTo(map);
            m.on('dragend', () => { const p = m.getLngLat(); out(`Dropped at ${p.lng.toFixed(5)}, ${p.lat.toFixed(5)}`); }); m.togglePopup(); return map; }},
    {title: 'Worker rendering against a busy page', text: 'Both maps spin continuously. The button freezes this page\'s main thread for two seconds: the worker-rendered map keeps moving.', wide: true, pair: true,
        make: (el, out, card) => {
            const [a, b] = el.children, maps = [['worker', a], ['main', b]].map(([renderer, box]) => { box.insertAdjacentHTML('beforeend', `<span class="tag">renderer: ${renderer}</span>`); return base(box, {renderer, zoom: 14.2}); });
            // One long rotation per command, so the animation runs inside the engine and needs nothing from this page
            // while it plays. (Re-issuing short animations from a timer would stop whenever the page is busy.)
            const spin = map => { let bearing = 0; const step = () => { if (!el.isConnected) return; bearing += 170; map.easeTo({bearing, duration: 12000}); setTimeout(step, 12000); }; map.once('load', step); };
            maps.forEach(spin);
            const button = Object.assign(document.createElement('button'), {className: 'action', textContent: 'Block the main thread for 2 seconds'});
            button.onclick = () => { const end = performance.now() + 2000; while (performance.now() < end) { /* busy */ } };
            card.querySelector('.text').appendChild(button);
        }},
    {title: 'Server rendering', text: 'The same view three ways: SVG and JPEG produced on the server with no browser, and the live map. A page can show the server version instantly and swap in the live map when it is ready.', wide: true, pair: true,
        make: async el => {
            const [a, b] = el.children;
            a.innerHTML = '<span class="tag">server-rendered SVG</span>' + await (await fetch('/ssr.svg?w=640&h=300&zoom=13.6')).text();
            a.querySelector('svg').removeAttribute('style');
            b.insertAdjacentHTML('beforeend', '<span class="tag">live map</span>');
            base(b).addMarkerLayer(structuredClone(markers));
        }},
];

const root = document.getElementById('cards');
const seen = new IntersectionObserver(entries => {
    for (const e of entries) {
        if (!e.isIntersecting) continue;
        seen.unobserve(e.target);
        const card = e.target, spec = cards[+card.dataset.i], el = card.querySelector('.map, .pair'), readout = card.querySelector('.readout');
        Promise.resolve().then(() => spec.make(el, text => { if (readout) readout.textContent = text; }, card)).catch(err => { if (readout) readout.textContent = String(err.message); console.error(err); });
    }
}, {rootMargin: '200px'});
cards.forEach((c, i) => {
    const card = document.createElement('article');
    card.dataset.i = i;
    if (c.wide) card.className = 'wide';
    card.innerHTML = (c.pair ? '<div class="pair"><div></div><div></div></div>' : '<div class="map"></div>') + '<div class="text"><h2></h2><p></p>' + (c.readout ? '<div class="readout"></div>' : '') + '</div>';
    card.querySelector('h2').textContent = c.title;
    card.querySelector('p').textContent = c.text;
    root.appendChild(card);
    seen.observe(card);
});
