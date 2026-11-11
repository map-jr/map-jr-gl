/** Demo server: client-only page, server-rendered page with hydration, and a caching tile proxy. */
import http from 'node:http';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import makeStyle from './style.mjs';
import {markers, view} from './markers.mjs';
import {shield} from './shields.mjs';
import {renderToSVG, renderToImage} from '../dist/server.js';
import {Renderer} from '@takumi-rs/core';

const rasteriser = new Renderer();

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = +(process.env.PORT || 8080), origin = `http://localhost:${port}`;
const cache = path.join(root, '.cache/tiles');
const tilejson = await (await fetch('https://tiles.openfreemap.org/planet')).json();
const style = makeStyle(`${origin}/tiles/{z}/{x}/{y}.pbf`, tilejson.attribution);

async function tile(z, x, y) {
    const file = path.join(cache, `${z}-${x}-${y}.pbf`);
    try { return await readFile(file); } catch {}
    const res = await fetch(tilejson.tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y));
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(cache, {recursive: true});
    await writeFile(file, buf);
    return buf;
}

const page = (body, head = '') => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Map Jr. GL demo</title>${head}<style>html,body{margin:0;height:100%;font-family:system-ui,sans-serif}#map{position:absolute;inset:0}
#hud{position:absolute;left:8px;top:8px;z-index:2;background:#fff;padding:6px 10px;border-radius:6px;font-size:12px;box-shadow:0 1px 4px #0003}</style></head>
<body>${body}</body></html>`;

const client = (q) => `<script type="module">
// ?standalone loads the single-file build (worker embedded); ?from=<origin> loads the library from another origin, as a CDN would serve it.
const params = new URLSearchParams(location.search);
const {Map, NavigationControl, ScaleControl} = await import((params.get('from') ?? '') + (params.has('standalone') ? '/dist/map-jr-gl-maplibre-compat-standalone.js' : '/dist/map-jr-gl-maplibre-compat.js'));
import {markers, view, photos, manyMarkers} from '/demo/markers.mjs';
import {shield} from '/demo/shields.mjs';
const q = new URLSearchParams(location.search);
const map = window.map = new Map({container: 'map', style: q.get('style') || ('/style.json' + (q.has('local') ? '?local' : '')), ...view,
  ...(q.has('zoom') ? {zoom: +q.get('zoom')} : {}), ...(q.has('bearing') ? {bearing: +q.get('bearing')} : {}), ...(q.has('pitch') ? {pitch: +q.get('pitch')} : {}),
  ...(q.has('center') ? {center: q.get('center').split(',').map(Number)} : {}), renderer: q.get('renderer') || 'auto', antialias: q.has('msaa'),
  // Styles naming Open Sans get the real font; it loads on the rendering thread, so it works with worker rendering.
  fonts: q.has('nofonts') ? [] : ['normal', 'italic'].map(style => ({family: 'Open Sans', style, weight: '300 800',
    src: 'https://cdn.jsdelivr.net/fontsource/fonts/open-sans:vf@latest/latin-wght-' + style + '.woff2'}))});
map.setMissingStyleImageResolver(id => { const s = shield(id); if (s) return map.addImage(id, s.svg, s); });
if (!q.has('nocontrols')) map.addControl(new NavigationControl()).addControl(new ScaleControl(), 'bottom-left');
const layer = q.has('nomarkers') ? null : map.addMarkerLayer(structuredClone(markers));
// ?photos adds markers with a photograph inside the SVG; ?markers=50000 adds that many pins to pan around.
if (q.has('photos')) map.addMarkerLayer(structuredClone(photos));
if (q.has('markers')) { const t0 = performance.now(); map.addMarkerLayer(manyMarkers(+q.get('markers'))); window.manyMs = performance.now() - t0; }
const hud = document.getElementById('hud');
let stats = '';
const show = () => hud.textContent = 'renderer: ' + map.renderer + ' | zoom ' + map.getZoom().toFixed(2) + stats + (map.loaded() ? '' : ' | loading');
map.on('stats', e => { stats = ' | ' + e.fps.toFixed(0) + ' fps, ' + e.frameMs.toFixed(1) + ' ms/frame'; show(); });
map.on('move', show); map.on('load', () => { show(); window.mapLoaded = true; window.loadedAt = performance.now(); }); map.on('idle', () => window.mapIdle = (window.mapIdle || 0) + 1);
map.on('markerenter', e => e.layer.setProps(e.index, {stroke: '#222', strokeWidth: 3}));
map.on('markerleave', e => e.layer.setProps(e.index, {stroke: '#fff', strokeWidth: 1.5}));
map.on('markerclick', e => {
  window.lastMarkerClick = e.marker.props.label;
  hud.textContent = 'clicked marker ' + (e.marker.props.label ?? e.marker.props.name);
  // The marker grows and a callout points at it; map labels move out of the callout's way.
  const body = document.createElement('div');
  body.innerHTML = '<strong></strong><div style="color:#666;margin-top:2px"></div>';
  body.firstChild.textContent = e.marker.props.name ?? 'Marker ' + e.marker.props.label;
  body.lastChild.textContent = e.marker.lngLat.map(v => v.toFixed(4)).join(', ');
  window.popup = e.layer.openPopup(e.index, body);
});
map.on('click', async e => {
  if (e.marker) return;
  const [features, elevation] = await Promise.all([map.queryFeatures(e.lngLat), map.queryElevation(e.lngLat).catch(() => null)]);
  hud.textContent = (elevation === null ? '' : elevation.toFixed(0) + ' m | ') + features.map(f => f.sourceLayer + (f.properties.name ? ' "' + f.properties.name + '"' : '')).join(', ');
});
map.on('error', e => { (window.mapErrors ||= []).push(String(e.error?.message || e.error)); });
</script>`;

http.createServer(async (req, res) => {
    const url = new URL(req.url, origin);
    // no-store: the demo should always run the code that is on disk, never a cached copy from before a rebuild.
    const send = (status, type, body, extra = {}) => { res.writeHead(status, {'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-store', ...extra}); res.end(body); };
    try {
        const t = /^\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(url.pathname);
        if (t) {
            const buf = await tile(t[1], t[2], t[3]);
            return buf ? send(200, 'application/x-protobuf', buf, {'cache-control': 'max-age=3600'}) : send(204, 'text/plain', '');
        }
        // ?local labels places in their local script instead of English, to exercise non-Latin text.
        if (url.pathname === '/style.json') return send(200, 'application/json', JSON.stringify(style).replaceAll(url.searchParams.has('local') ? '["get","name:en"],' : '\u0000', ''));
        if (url.pathname === '/bench') return send(200, 'text/html', await readFile(path.join(root, 'demo/bench.html')));
        // MapLibre GL JS itself, for the side-by-side benchmark page.
        if (url.pathname.startsWith('/ml/')) {
            const file = path.join(root, 'node_modules/maplibre-gl/dist', path.basename(url.pathname));
            return send(200, file.endsWith('.css') ? 'text/css' : 'text/javascript', await readFile(file));
        }
        // The gallery is a static site (built by `pnpm site` into site-dist/, the same files GitHub Pages serves).
        if (url.pathname === '/gallery') { res.writeHead(302, {location: '/gallery/'}); return res.end(); }
        if (url.pathname.startsWith('/gallery/')) {
            const file = path.join(root, 'site-dist', path.normalize(url.pathname.slice(9) || 'index.html'));
            if (!file.startsWith(path.join(root, 'site-dist'))) return send(403, 'text/plain', 'Forbidden');
            const types = {'.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.css': 'text/css'};
            return send(200, types[path.extname(file)] ?? 'application/octet-stream', await readFile(file));
        }
        if (url.pathname === '/') return send(200, 'text/html', page(`<div id="map"></div><div id="hud"></div><a href="/gallery" style="position:absolute;left:8px;bottom:34px;z-index:2;background:#fff;padding:5px 10px;border-radius:6px;font-size:12px;box-shadow:0 1px 4px #0003;color:#222;text-decoration:none">Feature gallery</a>${client()}`));
        if (url.pathname === '/map.jpg') {
            const q = url.searchParams, ratio = +(q.get('ratio') || 1);
            const {image, contentType} = await renderToImage({style, ...view, zoom: +(q.get('zoom') || view.zoom), bearing: +(q.get('bearing') || 0),
                width: +(q.get('w') || 1000), height: +(q.get('h') || 700), resolveImage: shield, markers: q.has('nomarkers') ? [] : [markers], rasteriser, pixelRatio: ratio});
            return send(200, contentType, image, {'cache-control': 'max-age=3600'});
        }
        if (url.pathname === '/ssr' || url.pathname === '/ssr.svg' || url.pathname === '/static') {
            const width = +(url.searchParams.get('w') || 1000), height = +(url.searchParams.get('h') || 700);
            const zoom = +(url.searchParams.get('zoom') || view.zoom), bearing = +(url.searchParams.get('bearing') || view.bearing);
            const t0 = performance.now();
            const {svg, tiles} = await renderToSVG({style, ...view, zoom, bearing, width, height, resolveImage: shield, ssrOverrides: !url.searchParams.has('full'), markers: url.searchParams.has('nomarkers') ? [] : [markers]});
            const ms = (performance.now() - t0).toFixed(0);
            if (url.pathname === '/ssr.svg') return send(200, 'image/svg+xml', svg, {'x-render-ms': ms});
            const preload = tiles.map(u => `<link rel="preload" as="fetch" crossorigin href="${u}">`).join('');
            // ?image swaps the inline SVG for a server-rendered JPEG: a fixed payload however dense the data is.
            const first = url.searchParams.has('image')
                ? `<img data-map-jr-ssr alt="" src="/map.jpg?${url.searchParams}&w=${width}&h=${height}" style="position:absolute;inset:0;width:100%;height:100%">` : svg;
            const frame = `<div id="map" style="position:relative;width:${width}px;height:${height}px;inset:auto">${first}</div><div id="hud">server render ${ms} ms, ${(svg.length / 1024).toFixed(0)} KB SVG</div>`;
            // /static shows the server output alone; /ssr also loads the client, which takes over the same element.
            return send(200, 'text/html', page(frame + (url.pathname === '/ssr' ? client() : ''), url.pathname === '/ssr' ? preload : ''));
        }
        if (url.pathname.startsWith('/dist/') || url.pathname.startsWith('/demo/')) {
            return send(200, 'text/javascript', await readFile(path.join(root, url.pathname)));
        }
        send(404, 'text/plain', 'Not found');
    } catch (err) {
        console.error(err);
        send(500, 'text/plain', String(err.stack));
    }
}).listen(port, () => console.log(`Demo at ${origin}  (also /ssr, /static, /ssr.svg)`));
