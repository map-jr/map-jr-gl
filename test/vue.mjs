// Tests of the Vue adapter (`@map-jr/map-jr-gl/vue`): the server render with Vue's own server renderer, then the same page in
// a browser, where Vue takes over the HTML and the map takes over the SVG.   node test/vue.mjs   (after pnpm build)
import http from 'node:http';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {createSSRApp, h} from 'vue';
import {renderToString} from 'vue/server-renderer';
import {launch} from './launch.mjs';
import makeStyle from '../demo/style.mjs';
import {MapJr} from '../dist/vue.js';
import {navigation, scale} from '../dist/controls.js';
import {survive} from '../scripts/undici-assert.mjs';

// The assertion of undici from a socket event (#2289) is logged; any other uncaught error ends the run.
survive('vue');

const root = path.resolve(import.meta.dirname, '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

// The fetch is tried three times, 2 s apart: the server sometimes resets a connection, and one reset must not fail CI.
async function fetchJSON(url, tries = 3) {
    for (let i = 1; ; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            if (i >= tries) throw new Error(`could not fetch ${url} after ${tries} tries: ${e.cause?.message ?? e.message}`);
            console.warn(`fetch ${url} failed (${e.cause?.message ?? e.message}); try ${i + 1} of ${tries} in 2 s`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}
const tiles = (await fetchJSON('https://tiles.openfreemap.org/planet')).tiles[0];
const style = makeStyle(tiles, '<a href="https://example.com/credits" onclick="x()">Example <b>tiles</b></a>'), view = {center: [-74.0065, 40.7085], zoom: 14.3};
const disc = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>';
// A point for each position, with the colour for the template, and the symbol layer that draws the image at each point.
const pinData = list => ({type: 'FeatureCollection', features: list.map(([lngLat, color]) => ({type: 'Feature', properties: {color}, geometry: {type: 'Point', coordinates: lngLat}}))});
const pins = {data: {pins: pinData([[view.center, '#d00']])}, layers: [{id: 'pins', type: 'symbol', source: 'pins', layout: {'icon-image': 'disc', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]};

// 1. On the server.
const html = await renderToString(createSSRApp({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {mapStyle: style, initialView: view, images: {disc}, ...pins, ssr: {width: 800, height: 500}, attribution: false})])}));
check('server: the component renders the first view as SVG, with the marker from its image (a template with the colour of the marker)', /<svg[^>]*data-map-jr-ssr/.test(html) && html.length > 20000 && html.includes('map-jr-vue') && /<circle cx="12" cy="12" r="10" fill="#d00"/.test(html), `${(html.length / 1024).toFixed(0)} KB of HTML`);
const named = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, fontFamily: 'Own Sans', locale: {'Map.Title': 'Karte'}, ssr: {width: 800, height: 500}, attribution: false})}));
const labelled = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, locale: {'Map.Title': 'Karte'}, ssr: {width: 800, height: 500, label: 'Map of Bern'}, attribution: false})}));
check('server: the ssr prop passes the font family, and the label from ssr.label or the locale text Map.Title (#1203)', /<svg[^>]*aria-label="Karte"/.test(named) && /font-family="Own Sans"/.test(named) && /<svg[^>]*aria-label="Map of Bern"/.test(labelled), (named.match(/<svg[^>]*>/)?.[0] ?? '') + ' ' + (named.match(/font-family="[^"]*"/)?.[0] ?? 'no font-family'));
const credited = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, ssr: true})}));
check('server: the credits of the sources are in the page, as text and links only, in the attribution control', !html.includes('example.com/credits') && /<div class="map-jr-ctrl-attrib-inner[^"]*"><a href="https:\/\/example.com\/credits" target="_blank" rel="noopener noreferrer">Example tiles<\/a><\/div>/.test(credited), credited.match(/ctrl-attrib-inner.{0,160}/)?.[0] ?? 'no credits');
const withControls = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, controls: [navigation(), scale()], locale: {'NavigationControl.ZoomIn': 'Zoom avant'}, nonce: 'n2', ssr: {width: 800, height: 500, attribution: false}})}));
check('server: the controls of the description are in the first view, with the locale and the nonce of the description', /<style data-map-jr-ssr="" nonce="n2">/.test(withControls) && withControls.includes('map-jr-ctrl-zoom-in') && withControls.includes('title="Zoom avant"') && withControls.includes('map-jr-ctrl-scale') && !withControls.includes('class="map-jr-ctrl-attrib-inner'), `${(withControls.length / 1024).toFixed(0)} KB of HTML`);
const small = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, ssr: {width: 800, height: 500, overrides: {building: {hidden: true}, 'building-outline': {hidden: true}, road: {minzoom: 20}}, attribution: 'Own credits'}})}));
check('server: overrides for style layers make the render smaller, and the credits can be given', small.length < html.length * 0.8 && small.includes('>Own credits</div>'), `${(small.length / 1024).toFixed(0)} KB against ${(html.length / 1024).toFixed(0)} KB`);
const plain = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view})}));
const square = c => ({type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[c[0] - 0.002, c[1] - 0.002], [c[0] + 0.002, c[1] - 0.002], [c[0] + 0.002, c[1] + 0.002], [c[0] - 0.002, c[1] + 0.002], [c[0] - 0.002, c[1] - 0.002]]]}}]});
const empty = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
const extended = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, attribution: false, ssr: {timeout: 20000, allowHosts: [new URL(tiles).host]},
    sources: {own: {type: 'geojson', data: square(view.center)}, live: empty}, layers: [{id: 'own', type: 'fill', source: 'own', paint: {'fill-color': '#123456'}}, {id: 'live', type: 'fill', source: 'live', paint: {'fill-color': '#654321'}}],
    data: {live: square([view.center[0] + 0.004, view.center[1]])}})}));
check('server: the SVG has the sources and layers of the description and the GeoJSON of data', extended.includes('#123456') && extended.includes('#654321'), JSON.stringify({layers: extended.includes('#123456'), data: extended.includes('#654321')}));
// The global state of the description sets the background, and `fitMaxZoom` stops the fit at zoom 5, where the layer
// with `maxzoom: 6` shows. A fit up to zoom 22 would hide that layer (#1752).
const stateStyle = {version: 8, state: {tone: {default: '#111111'}}, sources: {wide: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[6.44, 45.95], [8.44, 45.95], [8.44, 47.95], [6.44, 47.95], [6.44, 45.95]]]}}}},
    layers: [{id: 'bg', type: 'background', paint: {'background-color': ['global-state', 'tone']}}, {id: 'low', type: 'fill', source: 'wide', maxzoom: 6, paint: {'fill-color': '#abcdef'}}]};
const stated = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: stateStyle, globalState: {tone: '#fedcba'}, initialView: {bounds: [7.43, 46.94, 7.45, 46.96], fitMaxZoom: 5}, ssr: {width: 400, height: 300}, attribution: false})}));
check('server: the ssr prop passes globalState and initialView.fitMaxZoom to the server renderer', stated.includes('#fedcba') && !stated.includes('#111111') && stated.includes('#abcdef'), JSON.stringify({globalState: stated.includes('#fedcba'), fitMaxZoom: stated.includes('#abcdef')}));
// A render that fails: the page has no first view, the console has one message, and a listener of `error` gets the error.
const failing = async (props) => {
    const logged = [], emitted = [], thrown = [], error = console.error;
    console.error = (...args) => logged.push(args.join(' '));
    const app = createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, onError: e => emitted.push(e), ...props})});
    app.config.errorHandler = e => thrown.push(e.message);
    let page = '';
    try { page = await renderToString(app); } catch (e) { thrown.push(e.message); } finally { console.error = error; }
    return {page, logged, emitted, thrown};
};
const guarded = await failing({ssr: {allowHosts: ['other.example.com']}});
check('server: the ssr prop passes allowHosts to the server renderer', guarded.logged.length === 1 && guarded.logged[0].includes('allowHosts'), (guarded.logged[0] ?? guarded.thrown[0] ?? '').slice(0, 200));
// (A tile server that answers 500 for each tile, and a style whose source has its tiles there.)
const broken = http.createServer((req, res) => { res.writeHead(500); res.end(); });
await new Promise(resolve => broken.listen(0, '127.0.0.1', resolve));
const down = await failing({mapStyle: makeStyle(`http://127.0.0.1:${broken.address().port}/{z}/{x}/{y}.pbf`, 'Example tiles'), ssr: {width: 800, height: 500}});
const silent = await failing({mapStyle: makeStyle(`http://127.0.0.1:${broken.address().port}/{z}/{x}/{y}.pbf`, 'Example tiles'), ssr: true, onError: undefined});
broken.close();
check('server: a tile with status 500 gives the page without the first view, one message in the console and one error event (#706)',
    down.page.includes('map-jr-vue') && !down.page.includes('<svg') && !down.thrown.length && down.logged.length === 1 && down.logged[0].startsWith('[map-jr-gl] E706 https://map-jr.org/e/706 message="') && down.logged[0].includes('500') && down.emitted.length === 1 && down.emitted[0] instanceof Error && down.emitted[0].message === down.logged[0]
    && silent.page.includes('map-jr-vue') && !silent.thrown.length && silent.logged.length === 1,
    JSON.stringify({page: down.page.slice(0, 80), thrown: down.thrown, logged: down.logged.map(m => m.slice(0, 200)), emitted: down.emitted.length, silent: {thrown: silent.thrown, logged: silent.logged.length}}));
check('server: without the ssr prop the component renders an empty element', !plain.includes('<svg') && plain.includes('map-jr-vue'), plain.slice(0, 120));

const bare = await renderToString(createSSRApp({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {mapStyle: style, initialView: view, images: {disc}, ...pins, attribution: false})])}));

// 2. In a browser: the page from the server, then Vue and the map.
const types = {'.js': 'text/javascript', '.json': 'application/json'};
const client = `import {createSSRApp, createApp, h, ref} from 'vue';
import {MapJr, MapOverlay, MapImage} from '/dist/vue.js';
import {navigation, scale} from '/dist/controls.js';
const style = await (await fetch('/style.json')).json();
const view = ref(${JSON.stringify(view)}), data = ref(${JSON.stringify(pins.data)}), pinLayers = ref(${JSON.stringify(pins.layers)}), layers = ref(['water', 'park', 'building']), images = ref({dot: '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>', disc: ${JSON.stringify(disc)}});
const tone = ref('#fff'), arrow = ref(true), twin = ref(false), full = ref(true), radius = ref(2);
// (A component inside the SVG of an image: its own change must reach the map.)
const Dot = {render: () => h('circle', {cx: 4, cy: 4, r: radius.value})};
const t = window.t = {view, data, pinLayers, layers, images, tone, arrow, twin, full, radius, moves: [], asked: [], clicks: [], loads: 0, order: [], views: 0, map: ref(null), pin: ref([-74.0065, 40.7085]), tip: ref(true), closed: 0, home: ref([-74.01, 40.705]), dragged: [], projection: ref(null)};
const make = (create, ssr) => create({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {ref: t.map, mapStyle: style, controls: [navigation(), scale({position: 'bottom-left'})], ...(ssr ? {initialView: view.value, ...(ssr === 'svg' ? {ssr: {width: 800, height: 500}} : {})} : {view: view.value, 'onUpdate:view': v => { t.views++; view.value = v; }, interactiveLayers: layers.value, onClick: e => t.clicks.push(e)}), data: data.value, layers: pinLayers.value, images: images.value, projection: t.projection.value, attribution: false, onLoad: host => { t.loads++; t.loadHost = host; t.order.push('load:' + t.map.value.state.get().idle); }, onIdle: () => t.order.push('idle'), onMoveend: e => t.moves.push(e.type + ' ' + typeof e.target.state.get().view.zoom),
  // An image that the style asks for and the map does not have: the application adds it to the prop images.
  onStyleimagemissing: e => { t.asked.push(e.id); if (!images.value[e.id]) images.value[e.id] = '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'; }}, ssr ? undefined : {default: () => (t.renders = (t.renders ?? 0) + 1, [h(MapOverlay, {lngLat: t.pin.value, anchor: 'bottom', 'data-own': '', class: 'own-class', style: 'color: rgb(255, 0, 0)'}, () => h('b', {id: 'own-pin'}, 'here')), arrow.value ? h(MapImage, {name: 'arrow', params: ['color']}, {default: ({color}) => h('svg', {viewBox: '0 0 8 8'}, [h('path', {d: 'M4 0 8 8 0 8z', fill: color, stroke: tone.value})])}) : null, twin.value ? h(MapImage, {name: 'arrow'}, () => h('svg', {viewBox: '0 0 8 8'}, [h('path', {d: 'M4 0 8 8 0 8z'})])) : null,
  h(MapImage, {name: 'maybe'}, () => full.value ? h('svg', {viewBox: '0 0 8 8'}, [h('style', 'p{color:rgb(1,2,3)}'), h('rect', {id: 'in-image', width: 8, height: 8})]) : null),
  h(MapImage, {name: 'nested'}, () => h('svg', {viewBox: '0 0 8 8'}, [h(Dot)])),
  h(MapImage, {name: 'photo', src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22/%3E', width: 4, height: 4}), h(MapOverlay, {lngLat: [-74.002, 40.7095], anchor: 'bottom', color: '#d6453d'}), h(MapOverlay, {lngLat: t.pin.value}, () => h('i', {id: 'bare-pin'}, 'bare')), h(MapOverlay, {lngLat: t.home.value, draggable: true, onDragstart: p => t.dragged.push('start ' + p.length), onDragend: p => { t.dragged.push('end'); t.home.value = p; }, onClick: () => t.dragged.push('click')}, () => h('u', {id: 'drag-pin', style: 'display:block;width:16px;height:16px'}, '')), t.tip.value ? h(MapOverlay, {lngLat: t.pin.value, popup: true, 'pointer-events-none': '', onClose: () => { t.closed++; t.tip.value = false; }}, () => h('span', {id: 'own-tip'}, 'A popup')) : null])})])});
if (location.search === '?ssr') make(createSSRApp, 'svg').mount('#app'); else if (location.search === '?bare') make(createSSRApp, 'bare').mount('#app'); else make(createApp, false).mount('#app');
window.ready = true;`;
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), send = (body, type) => { res.writeHead(200, {'content-type': type}); res.end(body); };
    try {
        if (url.pathname === '/') return send(`<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="importmap">{"imports": {"vue": "/vue.js"}}</script><script>window.shifts = []; try { new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.shifts.push(+e.value.toFixed(4)); }).observe({type: 'layout-shift', buffered: true}); } catch { window.shifts = null; }</script><div id="app">${url.search === '?ssr' ? html : url.search === '?bare' ? bare : ''}</div><p id="after">Text after the map</p><script type="module" src="/client.js${url.search}"></script>`, 'text/html');
        if (url.pathname === '/client.js') return send(client, 'text/javascript');
        if (url.pathname === '/style.json') return send(JSON.stringify(style), 'application/json');
        if (url.pathname === '/vue.js') return send(readFileSync(path.join(root, 'node_modules/vue/dist/vue.esm-browser.js')), 'text/javascript'); // (the build with warnings)
        send(readFileSync(path.join(root, url.pathname)), types[path.extname(url.pathname)] ?? 'application/octet-stream');
    } catch { res.writeHead(404); res.end(); }
}).listen(0);
const origin = `http://localhost:${server.address().port}`, browser = await launch();
try {
    // The page from the server: the SVG is there before any script, Vue finds no difference, the map replaces the SVG.
    let page = await browser.newPage({viewport: {width: 900, height: 600}, javaScriptEnabled: false});
    await page.goto(origin + '/?ssr');
    check('browser, without scripts: the page shows the SVG of the server', await page.locator('svg[data-map-jr-ssr]').count() === 1);
    const afterBefore = await page.evaluate(() => Math.round(document.getElementById('after').getBoundingClientRect().top)).catch(() => null) ?? Math.round((await page.locator('#after').boundingBox()).y);
    await page.close();
    page = await browser.newPage({viewport: {width: 900, height: 600}});
    const warnings = [], errors = [];
    page.on('console', m => { if (/warn|error/.test(m.type()) && /hydrat|mismatch/i.test(m.text())) warnings.push(m.text().split('\n')[0]); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/?ssr');
    await page.waitForFunction(() => window.ready);
    const early = await page.evaluate(() => ({svg: !!document.querySelector('svg[data-map-jr-ssr]')}));
    await page.waitForFunction(() => window.t.loads > 0, null, {timeout: 60000});
    await page.waitForTimeout(1000);
    const late = await page.evaluate(() => ({svg: !!document.querySelector('svg[data-map-jr-ssr]'), canvas: !!document.querySelector('#frame canvas'), loaded: window.t.map.value.state.get().loaded}));
    // No layout shift: the element of the map has its size from the page, and the takeover changes nothing around it.
    // (The browser reports shifts in Chromium only. The position of the text after the map is compared in each browser.)
    const shift = await page.evaluate(() => ({shifts: window.shifts, after: Math.round(document.getElementById('after').getBoundingClientRect().top), frame: (r => [r.width, r.height])(document.getElementById('frame').getBoundingClientRect())}));
    check('browser: no layout shift when the map takes over the server render', (shift.shifts === null || shift.shifts.length === 0) && shift.after === afterBefore && shift.frame.join() === '800,500', JSON.stringify({...shift, afterBefore}));
    check('browser: Vue takes over the HTML of the server without a difference, and the map takes over the SVG', early.svg && !late.svg && late.canvas && late.loaded && !warnings.length && !errors.length, JSON.stringify({early, late, warnings: warnings.slice(0, 2), errors: errors.slice(0, 2)}));
    const controlsWithSsr = await page.evaluate(() => document.querySelectorAll('#frame .map-jr-ctrl-group, #frame .map-jr-ctrl-scale').length);
    await page.close();
    // The page from a server without the ssr prop: an empty element from the server, then the map with its controls.
    page = await browser.newPage({viewport: {width: 900, height: 600}});
    page.on('console', m => { if (/warn|error/.test(m.type()) && /hydrat|mismatch/i.test(m.text())) warnings.push(m.text().split('\n')[0]); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/?bare');
    await page.waitForFunction(() => window.t?.loads > 0, null, {timeout: 60000});
    const controlsBare = await page.evaluate(() => document.querySelectorAll('#frame .map-jr-ctrl-group, #frame .map-jr-ctrl-scale').length);
    const bareShift = await page.evaluate(() => ({shifts: window.shifts, after: Math.round(document.getElementById('after').getBoundingClientRect().top)}));
    check('browser: no layout shift when the map starts in an empty element from the server', (bareShift.shifts === null || bareShift.shifts.length === 0) && bareShift.after === afterBefore, JSON.stringify(bareShift));
    check('browser: controls show on a page from a server, with the ssr prop and without it', controlsWithSsr >= 2 && controlsBare >= 2 && !warnings.length && !errors.length, JSON.stringify({controlsWithSsr, controlsBare, warnings: warnings.slice(0, 2), errors: errors.slice(0, 2)}));
    await page.close();

    // The component in the browser only: v-model:view, the points of data, the pointer, and the end.
    page = await browser.newPage({viewport: {width: 900, height: 600}});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/');
    await page.waitForFunction(() => window.t?.loads > 0, null, {timeout: 60000});
    await page.waitForFunction(() => window.t.order.includes('idle'), null, {timeout: 60000});
    const order = await page.evaluate(() => window.t.order.slice(0, 2));
    check('browser: the component emits load before the first idle, and the map is not idle yet at load', order[0] === 'load:false' && order[1] === 'idle', JSON.stringify(order));
    // v-model:view gets the first view once, and the view that it gives back moves nothing: a move would report a second view (#1135).
    const firstView = await page.evaluate(() => ({views: window.t.views, zoom: window.t.view.value.zoom, bounds: !!window.t.view.value.bounds, }));
    check('browser: update:view comes once with the first view, and v-model:view giving it back moves nothing (#1135)', firstView.views === 1 && firstView.bounds, JSON.stringify(firstView));
    const exposed = await page.evaluate(() => { const r = window.t.map.value, m = window.t.loadHost; return {members: typeof r.queryFeatures === 'function' && typeof r.moveTo === 'function' && 'queryFeatures' in r, store: r.state === m.state && r.description === m.description, noMap: !('map' in r) && r.map === undefined, same: r.queryFeatures === r.queryFeatures, keys: Object.keys(r).includes('queryFeatures') && Object.keys(r).includes('state'), gives: typeof m.moveTo === 'function'}; });
    check('browser: the template ref exposes the members of the map that load gives, and has no member map (#265, #1151)', exposed.members && exposed.store && exposed.noMap && exposed.same && exposed.keys && exposed.gives, JSON.stringify(exposed));
    const model = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.value;
        host.moveTo({zoom: 15, duration: 200});
        for (let i = 0; i < 80 && !(t.view.value.zoom === 15 && !host.state.get().moving); i++) await wait(100);
        const followed = t.view.value.zoom;
        t.view.value = {center: [-74.0, 40.71], zoom: 13.5, bearing: 0, pitch: 0}; // the application moves the map
        await wait(800);
        const moved = host.state.get().view.zoom;
        t.view.value.zoom = 14.2; // a field of the view, in place
        await wait(800);
        const field = host.state.get().view.zoom;
        // (A point is a feature of the symbol layer "pins".)
        const at = async lngLat => (await host.queryFeatures(host.project(lngLat), {layers: ['pins']})).length ? 1 : 0;
        const pinData = list => ({type: 'FeatureCollection', features: list.map(([lngLat, color]) => ({type: 'Feature', properties: {color}, geometry: {type: 'Point', coordinates: lngLat}}))});
        // A change of the data of a source is a new object: a point more, a point replaced.
        t.data.value = {pins: pinData([[[-74.0065, 40.7085], '#d00'], [[-74.0, 40.71], '#00d']])};
        await wait(600);
        const pushed = await at([-74.0, 40.71]);
        t.data.value = {pins: pinData([[[-73.99, 40.71], '#0a0'], [[-74.0, 40.71], '#00d']])};
        await wait(600);
        const replaced = [await at([-74.0065, 40.7085]), await at([-73.99, 40.71])];
        // A key of `data` in place: the map gets the new object.
        t.data.value.pins = pinData([[[-74.0065, 40.7085], '#d00']]);
        await wait(600);
        const before = await at([-74.0065, 40.7085]);
        t.pinLayers.value = [];
        t.data.value = {};
        // An image of the prop `images`, and a change in place that removes it.
        const image = host._map.hasImage('dot');
        delete t.images.value.dot;
        await wait(600);
        return {events: t.moves[0], asked: t.asked.length, added: t.asked.length > 0 && t.asked.every(id => host._map.hasImage(id)), image, imageAfter: host._map.hasImage('dot'), followed, moved, field, views: t.views, pushed, replaced: replaced.join(), before, after: host._map.getLayer('pins') ? 1 : 0};
    });
    check('browser: an event of the map is an event of the component (moveend), and an image that the style asks for (styleimagemissing) is on the map after the listener adds it to the prop images', model.events === 'moveend number' && model.asked > 0 && model.added, JSON.stringify({events: model.events, asked: model.asked, added: model.added}));
    // The prop projection is the field `projection` of the description (#463).
    const projected = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.value, events = [];
        const stop = host.listen('projectiontransition', e => events.push(e.newProjection));
        t.projection.value = {type: 'globe'};
        await wait(300);
        const on = host._map.getProjection()?.type;
        t.projection.value = null;
        await wait(300);
        stop();
        return {on, off: host._map.getProjection()?.type ?? 'none', events};
    });
    check('browser: the prop projection sets the projection of the map, and null gives back that of the style', JSON.stringify(projected) === JSON.stringify({on: 'globe', off: 'none', events: ['globe', 'mercator']}), JSON.stringify(projected));
    check('browser: v-model:view follows the map and moves it; the points of data, the layers and the images follow their props', model.image && !model.imageAfter && model.followed === 15 && model.moved === 13.5 && model.field === 14.2 && model.views > 2 && model.pushed === 1 && model.replaced === '0,1' && model.before === 1 && model.after === 0, JSON.stringify(model));
    // A component without the prop terrain gives `undefined` to the description, which keeps the terrain of the style; `null` would make the map flat (#1104).
    const unsetTerrain = await page.evaluate(() => { const d = t.map.value.description; return d.terrain === undefined ? 'undefined' : JSON.stringify(d.terrain); });
    check('browser: without the prop terrain, the description has terrain undefined, so the map keeps the terrain of the style (#1104)', unsetTerrain === 'undefined', unsetTerrain);
    // An image as a child component: the SVG of its slot is a template of the map, and it follows the component.
    const child = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), map = t.map.value._map, add = map.addImage, given = [];
        const first = ['arrow', 'photo', 'maybe', 'nested'].map(name => map.hasImage(name)).join();
        // (The SVG is not in the page: its <style> is no style of the page, and its id is no id of the page.)
        const p = document.body.appendChild(document.createElement('p')), apart = !document.querySelector('svg[viewBox="0 0 8 8"]') && !document.getElementById('in-image') && getComputedStyle(p).color !== 'rgb(1, 2, 3)';
        p.remove();
        map.addImage = function (name, source, ...rest) { given.push(name + ' ' + source); return add.call(this, name, source, ...rest); };
        t.view.value = {...t.view.value}; // (a render with the same content gives the image no second time)
        await wait(300);
        const again = given.length;
        t.tone.value = '#00f';
        await wait(300);
        const changed = given.splice(0).join();
        // A change that a component inside the SVG makes.
        t.radius.value = 3;
        await wait(300);
        const nested = given.splice(0).join();
        // Two components with one name: the image stays while one of them is there.
        t.twin.value = true; await wait(300);
        t.arrow.value = false; await wait(300);
        const kept = map.hasImage('arrow');
        t.twin.value = false; await wait(300);
        const gone = !map.hasImage('arrow');
        // Content that becomes empty: the image goes.
        t.full.value = false; await wait(300);
        delete map.addImage;
        return {first, apart, again, changed, nested, kept, gone, emptied: !map.hasImage('maybe')};
    });
    check('browser: MapImage gives the SVG of its slot to the map as a template and keeps it out of the page; it gives it again only when it changes (also inside a nested component); the image stays while a second component has its name, and goes with its content',
        child.first === 'true,true,true,true' && child.apart && child.again === 0 && /^arrow <svg[^>]*viewBox="0 0 8 8"[^>]*><path d="M4 0 8 8 0 8z" fill="\{\{color\}\}" stroke="#00f"\/?>(<\/path>)?<\/svg>$/.test(child.changed)
        && /^nested <svg[^>]*><circle cx="4" cy="4" r="3"\/?>(<\/circle>)?<\/svg>$/.test(child.nested) && child.kept && child.gone && child.emptied, JSON.stringify(child));
    // Elements of the page on the map: a marker with own content and a popup, as child components.
    const overlays = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.value;
        // Waits until `ok()` is true, for at most 5 s (a fixed wait failed on a loaded machine, #711).
        const until = async ok => { for (const end = performance.now() + 5000; !ok() && performance.now() < end;) await wait(50); };
        const near = (el, lngLat, frame) => { const r = el?.getBoundingClientRect(), q = host.project(lngLat); return !!r?.width && Math.abs(r.x + r.width / 2 - frame.x - q.x) < 3 && Math.abs(r.bottom - frame.y - q.y) < 3; };
        const where = id => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width ? [Math.round(r.x + r.width / 2), Math.round(r.bottom)] : null; };
        const frame = document.getElementById('frame').getBoundingClientRect();
        host.moveTo({center: [-74.0065, 40.7085], zoom: 14});
        await until(() => !host.state.get().moving && Math.abs(host.state.get().view.zoom - 14) < 1e-6 && near(document.getElementById('own-pin'), [-74.0065, 40.7085], frame) && !!document.querySelector('.map-jr-popup #own-tip'));
        const at = host.project([-74.0065, 40.7085]);
        const pin = where('own-pin'), tip = !!document.querySelector('.map-jr-popup #own-tip');
        t.pin.value = [-74.0, 40.71];
        await until(() => near(document.getElementById('own-pin'), [-74.0, 40.71], frame));
        // Attributes that are not props fall through to the element, and the content stays visible after a re-render (#161).
        const box = document.getElementById('own-pin')?.parentElement, tipShown = !!document.getElementById('own-tip')?.getClientRects().length;
        const attrsOk = !!box && box.hasAttribute('data-own') && box.classList.contains('own-class') && getComputedStyle(box).color === 'rgb(255, 0, 0)' && box.style.display !== 'none';
        const moved = where('own-pin'), expect = host.project([-74.0, 40.71]);
        // The overlay keeps position absolute and its place after re-renders, with and without fallthrough attributes (#243).
        const kept = [];
        for (const p of [[-74.003, 40.709], [-74.001, 40.711], [-74.0, 40.71]]) {
            t.pin.value = p;
            await until(() => { const b = document.getElementById('bare-pin')?.parentElement?.getBoundingClientRect(), q = host.project(p); return !!b?.width && Math.abs(b.x + b.width / 2 - frame.x - q.x) < 3 && Math.abs(b.y + b.height / 2 - frame.y - q.y) < 3; });
            const bare = document.getElementById('bare-pin')?.parentElement, own = document.getElementById('own-pin')?.parentElement, r = bare?.getBoundingClientRect(), q = host.project(p);
            kept.push(!!bare && !!own && getComputedStyle(bare).position === 'absolute' && getComputedStyle(own).position === 'absolute' && own.classList.contains('own-class')
                && Math.abs(r.x + r.width / 2 - frame.x - q.x) < 3 && Math.abs(r.y + r.height / 2 - frame.y - q.y) < 3);
        }
        const keptOk = kept.every(Boolean);
        // (The callback runs at the click, not after the fade: a busy page plays the fade late. See #172.)
        document.querySelector('.map-jr-popup-close-button')?.click();
        const atOnce = t.closed;
        await until(() => !document.getElementById('own-tip'));
        return {pinOk: !!pin && Math.abs(pin[0] - (frame.x + at.x)) < 3 && Math.abs(pin[1] - (frame.y + at.y)) < 3, tip, movedOk: !!moved && Math.abs(moved[0] - (frame.x + expect.x)) < 3, atOnce, closed: t.closed, tipGone: !document.getElementById('own-tip'), tipShown, attrsOk, keptOk, kept};
    });
    check('browser: MapOverlay puts own content and a popup at a position, follows its prop, and closes at the click', overlays.pinOk && overlays.tip && overlays.movedOk && overlays.atOnce === 1 && overlays.closed === 1 && overlays.tipGone && overlays.tipShown && overlays.attrsOk && overlays.keptOk, JSON.stringify(overlays));
    // A MapOverlay with no content shows the default pin, in the color of the prop `color`, with its tip at the position.
    const defaultPin = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.value, frame = document.getElementById('frame').getBoundingClientRect();
        host.moveTo({center: [-74.0065, 40.7085], zoom: 14});
        for (let i = 0; i < 100 && !(document.querySelector('#frame path[fill="#d6453d"]')?.ownerSVGElement.getBoundingClientRect().width && !host.state.get().moving); i++) await wait(50);
        await wait(200);
        const svg = document.querySelector('#frame path[fill="#d6453d"]')?.ownerSVGElement, r = svg?.getBoundingClientRect(), q = host.project([-74.002, 40.7095]);
        return {svg: !!svg, size: r && [Math.round(r.width), Math.round(r.height)], tip: r && Math.abs(r.x + r.width / 2 - frame.x - q.x) < 3 && Math.abs(r.bottom - frame.y - q.y) < 3, count: document.querySelectorAll('#frame path[fill="#d6453d"]').length};
    });
    check('browser: a MapOverlay with no content shows the default pin in the color of the prop color, with its tip at the position', defaultPin.svg && defaultPin.size?.join() === '27,41' && defaultPin.tip && defaultPin.count === 1, JSON.stringify(defaultPin));
    // A draggable MapOverlay (#167): a click is a click, and a drag emits dragstart and dragend with [lng, lat].
    const dragBox = async () => page.evaluate(() => { const r = document.getElementById('drag-pin').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
    let db = await dragBox();
    await page.mouse.click(db.x, db.y); await page.waitForTimeout(200);
    const dragClick = await page.evaluate(() => window.t.dragged.splice(0).join(' '));
    await page.mouse.move(db.x, db.y); await page.mouse.down(); await page.mouse.move(db.x + 50, db.y + 30, {steps: 5}); await page.mouse.up(); await page.waitForTimeout(400);
    const dragVue = await page.evaluate(() => ({ev: window.t.dragged.join(' '), home: [...window.t.home.value]}));
    db = await dragBox();
    check('browser: a draggable MapOverlay keeps a click a click and emits dragstart and dragend with [lng, lat], and stays at the new position', dragClick === 'click' && dragVue.ev === 'start 2 end' && dragVue.home[0] > -74.01, JSON.stringify({dragClick, dragVue, db}));
    await page.evaluate(() => { window.t.pin.value = [-73.5, 41]; }); // (the element of the pin must not be under the click)
    await page.waitForTimeout(400);
    // (The state has the pointer, which changes at each move: the content of the component must not render at each move.)
    await page.mouse.move(400, 250); await page.waitForTimeout(300);
    const before = await page.evaluate(() => window.t.renders);
    for (let i = 1; i <= 20; i++) await page.mouse.move(400 + i, 250);
    await page.waitForTimeout(300);
    const moved = await page.evaluate(b => ({renders: window.t.renders - b, pointer: window.t.map.value.state.get().pointer}), before);
    check('browser: 20 moves of the pointer change state.pointer and do not render the content of the component again', moved.renders === 0 && moved.pointer?.point.x === 420, JSON.stringify(moved));
    await page.mouse.click(400, 250); await page.waitForTimeout(600);
    const click = await page.evaluate(() => ({clicks: window.t.clicks.length, features: Array.isArray(window.t.clicks[0]?.features)}));
    check('browser: a click is an event of the component, with the features there', click.clicks === 1 && click.features, JSON.stringify(click));
    // The event `error`: a component with a listener gets each error; without a listener the map writes it to the console.
    const failing = await page.evaluate(async () => {
        const {createApp, h} = await import('vue'), {MapJr} = await import('/dist/vue.js'), wait = ms => new Promise(r => setTimeout(r, ms));
        const logged = [], log = console.error;
        console.error = (...a) => logged.push(a.map(x => x?.message ?? String(x)).join(' '));
        const run = async props => {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
            const app = createApp({render: () => h(MapJr, {mapStyle: '/no-such-style.json', attribution: false, ...props})});
            app.mount(el);
            await wait(1200);
            app.unmount(); el.remove();
        };
        const got = [], infos = [];
        await run({onError: (e, info) => { got.push(e.message); infos.push(info); }});
        const loggedWithListener = logged.length;
        await run({});
        // A source that fails: the second value has its `sourceId` (#2008).
        const sourceInfos = [];
        await run({mapStyle: {version: 8, sources: {broken: {type: 'geojson', data: '/no-such-data-2008.geojson'}}, layers: [{id: 'b', type: 'circle', source: 'broken'}]}, onError: (e, info) => sourceInfos.push(info)});
        console.error = log;
        return {got, loggedWithListener, logged, infos: JSON.stringify(infos), sourceInfos: JSON.stringify(sourceInfos)};
    });
    check('browser: the event error has {sourceId} as its second value for a source that fails, and {} for the style (#2008)',
        failing.infos === '[{}]' && failing.sourceInfos === '[{"sourceId":"broken"}]', JSON.stringify(failing));
    check('browser: the event error gets each error, and without a listener the error is written to the console',
        failing.got.length === 1 && /^\[map-jr-gl\] E63 https:\/\/map-jr\.org\/e\/63 style="\S*no-such-style\.json" status=404$/.test(failing.got[0]) && failing.loggedWithListener === 0 && failing.logged.length === 1 && /^\[map-jr-gl\] E63 https:\/\/map-jr\.org\/e\/63 style="\S*no-such-style\.json" status=404$/.test(failing.logged[0]), JSON.stringify(failing));
    // The warning for a container of height 0 names what the user wrote: `<MapJr>` or `useMapJr()`, not `createMap()` (#268).
    const flat = await page.evaluate(async () => {
        const {createApp, h, ref} = await import('vue'), {MapJr, useMapJr} = await import('/dist/vue.dev.js');
        const warned = [], warn = console.warn;
        console.warn = (...a) => { if (/height 0/.test(String(a[0]))) warned.push(String(a[0])); };
        const run = async component => {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px'}));
            const app = createApp(component);
            app.mount(el);
            await new Promise(r => setTimeout(r, 2500));
            app.unmount(); el.remove();
        };
        await run({render: () => h(MapJr, {mapStyle: '/style.json', attribution: false, style: 'height:0'})});
        await run({setup() { const box = ref(null); useMapJr(box, {style: '/style.json', attribution: false}); return () => h('div', {ref: box, style: 'height:0'}); }});
        console.warn = warn;
        return warned;
    });
    check('browser: the warning for height 0 names <MapJr> and useMapJr()', flat.length === 2 && flat[0].startsWith('[map-jr-gl] E0 <MapJr>: the container has height 0') && flat[1].startsWith('[map-jr-gl] E0 useMapJr(): the container has height 0'), JSON.stringify(flat));
    // v-model:color-scheme keeps the value that the control colorScheme() sets (#541).
    const schemes = await page.evaluate(async () => {
        const {createApp, h, ref} = await import('vue'), {MapJr} = await import('/dist/vue.js'), {colorScheme} = await import('/dist/controls.js');
        const scheme = ref('light'), controls = [colorScheme()], seen = [];
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
        const app = createApp({render: () => h(MapJr, {mapStyle: '/style.json', attribution: false, controls, colorScheme: scheme.value, 'onUpdate:colorScheme': v => { scheme.value = v; }, style: 'height:200px'})});
        app.mount(el);
        const wait = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 80 && !el.querySelector('.map-jr-ctrl-color-scheme'); i++) await wait(100);
        const box = () => el.querySelector('.map-jr-map');
        for (let i = 0; i < 2; i++) {
            el.querySelector('.map-jr-ctrl-color-scheme').click();
            await wait(100);
            seen.push(`${scheme.value}/${box().classList.contains('map-jr-dark') ? 'dark' : 'light'}`);
        }
        app.unmount(); el.remove();
        return seen.join(' ');
    });
    check('browser: v-model:color-scheme follows the control colorScheme(), and the map keeps the value', schemes === 'dark/dark light/light', schemes);
    // useMapFeatures gives what the style layers draw, and useMapSource the tile data of one source (#502).
    const kept = await page.evaluate(async () => {
        const {createApp, h, ref} = await import('vue'), {MapJr, useMapFeatures, useMapSource} = await import('/dist/vue.js');
        const c = [-74.0065, 40.7085], data = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {n: 1}, geometry: {type: 'Point', coordinates: c}}]};
        const out = {}, id = ref('pts');
        const Child = {setup() { const drawn = useMapFeatures(c, {layers: ['pts']}), raw = useMapSource(id, c, {radius: 10}); out.read = () => ({drawn: drawn.value.length, layer: drawn.value[0]?.layer?.id, raw: raw.value.length, type: raw.value[0]?.type}); return () => null; }};
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
        const app = createApp({render: () => h(MapJr, {mapStyle: '/style.json', initialView: {center: c, zoom: 14}, attribution: false, sources: {pts: {type: 'geojson', data}}, layers: [{id: 'pts', type: 'circle', source: 'pts'}], style: 'height:200px'}, () => h(Child))});
        app.mount(el);
        const wait = ms => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 80 && !(out.read?.().drawn && out.read().raw); i++) await wait(100);
        const first = out.read();
        id.value = 'no-such-source';
        await wait(1500);
        const other = out.read();
        app.unmount(); el.remove();
        return {first, other};
    });
    check('browser: useMapFeatures gives what the style layers draw, and useMapSource the data of the source that a ref names',
        kept.first.drawn === 1 && kept.first.layer === 'pts' && kept.first.raw === 1 && kept.first.type === 'Point' && kept.other.raw === 0 && kept.other.drawn === 1, JSON.stringify(kept));
    // `:sources` written in the render and `:data` from a shallowRef (#857): new data is no new style, and the map does
    // not write the data into the source object of the render.
    const declared = await page.evaluate(async () => {
        const {createApp, h, ref, shallowRef} = await import('vue'), {MapJr} = await import('/dist/vue.js'), wait = ms => new Promise(r => setTimeout(r, ms));
        const c = [-74.0065, 40.7085], fc = coords => ({type: 'FeatureCollection', features: coords.map(coordinates => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates}}))});
        const data = shallowRef({v: fc([c])}), mapRef = ref(), made = [];
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
        const app = createApp({render: () => { const sources = {v: {type: 'geojson', data: fc([])}}; made.push(sources.v); return h(MapJr, {ref: mapRef, mapStyle: '/style.json', initialView: {center: c, zoom: 14}, attribution: false, sources, data: data.value, layers: [{id: 'v', type: 'circle', source: 'v'}], style: 'height:200px'}); }});
        app.mount(el);
        for (let i = 0; i < 80 && !mapRef.value?.state?.get().loaded; i++) await wait(100);
        await wait(500);
        const map = mapRef.value._map;
        let restyled = 0;
        map.on('style.load', () => restyled++);
        data.value = {v: fc([c, [c[0] + 0.001, c[1]]])};
        await wait(1000);
        data.value = {v: fc([c])};
        await wait(1000);
        const unchanged = made.every(s => s.data.features.length === 0);
        app.unmount(); el.remove();
        return {restyled, unchanged, renders: made.length};
    });
    // Before the map has loaded (#1151): in the production build the members are undefined, as the ref of React is null;
    // in the development build a method throws a message that names it.
    const beforeLoad = await page.evaluate(async () => {
        const {createApp, h, ref} = await import('vue'), out = {};
        for (const file of ['vue.js', 'vue.dev.js']) {
            const {MapJr} = await import('/dist/' + file), mapRef = ref();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const app = createApp({render: () => h(MapJr, {ref: mapRef, mapStyle: '/style.json', attribution: false})});
            app.mount(el);
            let threw = '';
            try { mapRef.value.moveTo({zoom: 1}); } catch (e) { threw = e.message; }
            out[file] = ['moveTo' in mapRef.value, typeof mapRef.value.moveTo, typeof mapRef.value.state, Object.keys(mapRef.value).length, threw].map(String);
            app.unmount(); el.remove();
        }
        return out;
    });
    check('browser: before the map has loaded, the members of the template ref are undefined, and in the development build a method throws a message that names it (#1151)',
        JSON.stringify(beforeLoad['vue.js'].slice(0, 4)) === JSON.stringify(['false', 'undefined', 'undefined', '0']) && JSON.stringify(beforeLoad['vue.dev.js'].slice(0, 4)) === JSON.stringify(['true', 'function', 'undefined', '0']) && beforeLoad['vue.dev.js'][4].startsWith('[map-jr-gl] E1151 <MapJr>: the template ref has no method "moveTo" until the map has loaded.'), JSON.stringify(beforeLoad));
    check('browser: :sources in the render and :data from a shallowRef: new data is no new style, and the source objects of the render are unchanged (#857)',
        declared.restyled === 0 && declared.unchanged && declared.renders >= 3, JSON.stringify(declared));
    // Reactive data (Vue proxies, #242): structured clone refuses a proxy, and the map copies it instead, in both entries
    // and with both renderers. The data must be drawn, getStyle() must work, and no error may be reported.
    const proxied = await page.evaluate(() => { let step = 'start'; return Promise.race([new Promise(r => setTimeout(() => r({timeout: 'no answer in 60 s at the step: ' + step}), 60000)), (async () => {
        const {reactive} = await import('vue'), {createMap} = await import('/dist/map-jr-gl.js'), {Map} = await import('/dist/map-jr-gl-maplibre-compat.js');
        const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
        const style = await (await fetch('/style.json')).json();
        const points = () => reactive({type: 'FeatureCollection', features: [{type: 'Feature', properties: {n: 1}, geometry: {type: 'Point', coordinates: [-74.0065, 40.7085]}}]});
        const box = () => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
        for (const renderer of ['worker', 'main']) {
            const errs = [], el = box();
            const map = new Map({container: el, style: reactive(structuredClone(style)), center: [-74.0065, 40.7085], zoom: 14, renderer});
            map.on('error', e => errs.push(String(e.error?.message ?? e.error)));
            step = 'load of the compat map, ' + renderer;
            await new Promise(r => map.once('load', r));
            map.addSource('pts', {type: 'geojson', data: points()});
            map.addLayer({id: 'pts', type: 'circle', source: 'pts'});
            map.getSource('pts').setData(points());
            map.jumpTo({center: reactive([-74.0065, 40.7085])});
            let style2; try { style2 = !!map.getStyle().sources.pts; } catch (e) { style2 = e.message; }
            await wait(1500);
            const found = (await map.querySourceFeatures('pts')).length;
            // (A value that JSON cannot copy either, here a cycle, is an error event with a message, not an uncaught error.)
            const cycle = reactive({type: 'FeatureCollection', features: []}); cycle.self = cycle;
            map.getSource('pts').setData(cycle);
            await wait(500);
            // (After that error, new data of the source still goes to the engine: the source does not wait for an answer, #856.)
            map.getSource('pts').setData({type: 'FeatureCollection', features: [1, 2].map(n => ({type: 'Feature', properties: {n}, geometry: {type: 'Point', coordinates: [-74.0065, 40.7085]}}))});
            await wait(1500);
            const after = (await map.querySourceFeatures('pts')).length;
            out['compat ' + renderer] = {found, style: style2, errs: errs.filter(m => !m.startsWith('[map-jr-gl] E242 ')), cycle: errs.length === 1, after};
            map.remove(); el.remove();
            step = 'main API map, ' + renderer;
            const herrs = [], hel = box();
            const host = createMap(hel, {style: reactive(structuredClone(style)), renderer, view: {center: [-74.0065, 40.7085], zoom: 14}, attribution: false, onError: e => herrs.push(e.message),
                sources: {pts: {type: 'geojson', data: points()}}, layers: [{id: 'pts', type: 'circle', source: 'pts'}]});
            await wait(2500);
            host.update({style: reactive(structuredClone(style)), renderer, view: {center: [-74.0065, 40.7085], zoom: 14}, attribution: false, onError: e => herrs.push(e.message),
                sources: {pts: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'pts', type: 'circle', source: 'pts'}], data: {pts: points()}});
            await wait(1500);
            step = 'queryFeatures of the main API, ' + renderer;
            out['main API ' + renderer] = {found: (await host.querySource('pts')).length, errs: herrs};
            host.destroy(); hel.remove();
        }
        return out;
    })()]); });
    check('browser: reactive GeoJSON and a reactive style (Vue proxies) are drawn in both entries and with both renderers, without errors, and data that cannot be copied is an error event (#242)',
        Object.values(proxied).every(r => r.found >= 1 && r.errs.length === 0 && (r.style ?? true) === true && (r.cycle ?? true) && (r.after ?? 2) === 2), JSON.stringify(proxied));

    // A reactive map-style whose paint value changes in place: the map edits the layer and loads no style (#858).
    const repainted = await page.evaluate(async () => {
        const {reactive, createApp, h, nextTick} = await import('vue'), {MapJr} = await import('/dist/vue.js');
        const wait = ms => new Promise(r => setTimeout(r, ms)), style = reactive(await (await fetch('/style.json')).json());
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
        let loads = 0, host;
        const app = createApp({render: () => h(MapJr, {mapStyle: style, initialView: {center: [-74.0065, 40.7085], zoom: 14}, attribution: false, onLoad: m => { host = m; }, onStyleload: () => loads++})});
        app.mount(el);
        for (let i = 0; i < 100 && !host; i++) await wait(100);
        await wait(500);
        const before = loads, layer = style.layers.find(l => l.type === 'fill');
        layer.paint = {...layer.paint, 'fill-color': '#123456'};
        await nextTick(); await wait(500);
        const color = host?._map.getStyle().layers.find(l => l.id === layer.id)?.paint?.['fill-color'];
        app.unmount(); el.remove();
        return {loaded: !!host, loads: loads - before, color};
    });
    check('browser: a paint value that changes in a reactive map-style reaches the map without a new style (#858)', repainted.loaded && repainted.loads === 0 && repainted.color === '#123456', JSON.stringify(repainted));
    check('browser: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
} catch (e) { check('the test run was completed', false, String(e.message).split('\n')[0]); }
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
