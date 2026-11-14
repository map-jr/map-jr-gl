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

const root = path.resolve(import.meta.dirname, '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

const tiles = (await (await fetch('https://tiles.openfreemap.org/planet')).json()).tiles[0];
const style = makeStyle(tiles, '<a href="https://example.com/credits" onclick="x()">Example <b>tiles</b></a>'), view = {center: [-74.0065, 40.7085], zoom: 14.3};
const disc = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>';
const pins = {id: 'pins', image: 'disc', data: [{lngLat: view.center, props: {color: '#d00'}}]};

// 1. On the server.
const html = await renderToString(createSSRApp({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {mapStyle: style, initialView: view, images: {disc}, markers: [pins], ssr: {width: 800, height: 500}, attribution: false})])}));
check('server: the component renders the first view as SVG, with the marker from its image (a template with the colour of the marker)', /<svg[^>]*data-map-jr-ssr/.test(html) && html.length > 20000 && html.includes('map-jr-vue') && /<circle cx="12" cy="12" r="10" fill="#d00"/.test(html), `${(html.length / 1024).toFixed(0)} KB of HTML`);
const credited = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, ssr: true})}));
check('server: the credits of the sources are in the page, as text and links only', !html.includes('example.com/credits') && /<div data-map-jr-ssr[^>]*><a href="https:\/\/example.com\/credits">Example tiles<\/a><\/div>/.test(credited), credited.match(/<div data-map-jr-ssr[^>]*>.{0,120}/)?.[0] ?? 'no credits');
const small = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, ssr: {width: 800, height: 500, overrides: {building: {hidden: true}, 'building-outline': {hidden: true}, road: {minzoom: 20}}, attribution: 'Own credits'}})}));
check('server: overrides for style layers make the render smaller, and the credits can be given', small.length < html.length * 0.8 && small.includes('>Own credits</div>'), `${(small.length / 1024).toFixed(0)} KB against ${(html.length / 1024).toFixed(0)} KB`);
const plain = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view})}));
const square = c => ({type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[c[0] - 0.002, c[1] - 0.002], [c[0] + 0.002, c[1] - 0.002], [c[0] + 0.002, c[1] + 0.002], [c[0] - 0.002, c[1] + 0.002], [c[0] - 0.002, c[1] - 0.002]]]}}]});
const empty = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
const extended = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, attribution: false, ssr: {timeout: 20000, allowHosts: [new URL(tiles).host]},
    extend: {sources: {own: {type: 'geojson', data: square(view.center)}, live: empty}, layers: [{id: 'own', type: 'fill', source: 'own', paint: {'fill-color': '#123456'}}, {id: 'live', type: 'fill', source: 'live', paint: {'fill-color': '#654321'}}]},
    data: {live: square([view.center[0] + 0.004, view.center[1]])}})}));
check('server: the SVG has the layers of extend and the GeoJSON of data', extended.includes('#123456') && extended.includes('#654321'), JSON.stringify({extend: extended.includes('#123456'), data: extended.includes('#654321')}));
let blocked = '';
const guarded = createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, ssr: {allowHosts: ['other.example.com']}})});
guarded.config.errorHandler = e => { blocked = e.message; };
await renderToString(guarded);
check('server: the ssr prop passes allowHosts to the server renderer', blocked.includes('allowHosts'), blocked.slice(0, 120));
check('server: without the ssr prop the component renders an empty element', !plain.includes('<svg') && plain.includes('map-jr-vue'), plain.slice(0, 120));

const bare = await renderToString(createSSRApp({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {mapStyle: style, initialView: view, images: {disc}, markers: [pins], attribution: false})])}));

// 2. In a browser: the page from the server, then Vue and the map.
const types = {'.js': 'text/javascript', '.json': 'application/json'};
const client = `import {createSSRApp, createApp, h, ref} from 'vue';
import {MapJr, MapOverlay, MapImage} from '/dist/vue.js';
import {navigation, scale} from '/dist/controls.js';
const style = await (await fetch('/style.json')).json();
const view = ref(${JSON.stringify(view)}), markers = ref([${JSON.stringify(pins)}]), layers = ref(['water', 'park', 'building']), images = ref({dot: '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>', disc: ${JSON.stringify(disc)}});
const tone = ref('#fff'), arrow = ref(true), twin = ref(false), full = ref(true), radius = ref(2);
// (A component inside the SVG of an image: its own change must reach the map.)
const Dot = {render: () => h('circle', {cx: 4, cy: 4, r: radius.value})};
const t = window.t = {view, markers, layers, images, tone, arrow, twin, full, radius, moves: [], asked: [], clicks: [], loads: 0, order: [], views: 0, map: ref(null), pin: ref([-74.0065, 40.7085]), tip: ref(true), closed: 0};
const make = (create, ssr) => create({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {ref: t.map, mapStyle: style, controls: [navigation(), scale({position: 'bottom-left'})], ...(ssr ? {initialView: view.value, ...(ssr === 'svg' ? {ssr: {width: 800, height: 500}} : {})} : {view: view.value, 'onUpdate:view': v => { t.views++; view.value = v; }, interactiveLayers: layers.value, onClick: e => t.clicks.push(e)}), markers: markers.value, images: images.value, attribution: false, onLoad: () => { t.loads++; t.order.push('load:' + t.map.value.host.state.get().idle); }, onIdle: () => t.order.push('idle'), onMoveend: e => t.moves.push(e.type + ' ' + typeof e.target.getZoom()),
  // An image that the style asks for and the map does not have: the application adds it to the prop images.
  onStyleimagemissing: e => { t.asked.push(e.id); if (!images.value[e.id]) images.value[e.id] = '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'; }}, ssr ? undefined : {default: () => [h(MapOverlay, {lngLat: t.pin.value, anchor: 'bottom', 'data-own': '', class: 'own-class', style: 'color: rgb(255, 0, 0)'}, () => h('b', {id: 'own-pin'}, 'here')), arrow.value ? h(MapImage, {name: 'arrow', params: ['color']}, {default: ({color}) => h('svg', {viewBox: '0 0 8 8'}, [h('path', {d: 'M4 0 8 8 0 8z', fill: color, stroke: tone.value})])}) : null, twin.value ? h(MapImage, {name: 'arrow'}, () => h('svg', {viewBox: '0 0 8 8'}, [h('path', {d: 'M4 0 8 8 0 8z'})])) : null,
  h(MapImage, {name: 'maybe'}, () => full.value ? h('svg', {viewBox: '0 0 8 8'}, [h('style', 'p{color:rgb(1,2,3)}'), h('rect', {id: 'in-image', width: 8, height: 8})]) : null),
  h(MapImage, {name: 'nested'}, () => h('svg', {viewBox: '0 0 8 8'}, [h(Dot)])),
  h(MapImage, {name: 'photo', src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22/%3E', width: 4, height: 4}), t.tip.value ? h(MapOverlay, {lngLat: t.pin.value, popup: true, 'pointer-events-none': '', onClose: () => { t.closed++; t.tip.value = false; }}, () => h('span', {id: 'own-tip'}, 'A popup')) : null]})])});
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
    const late = await page.evaluate(() => ({svg: !!document.querySelector('svg[data-map-jr-ssr]'), canvas: !!document.querySelector('#frame canvas'), loaded: window.t.map.value.state.loaded}));
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

    // The component in the browser only: v-model:view, markers, the pointer, and the end.
    page = await browser.newPage({viewport: {width: 900, height: 600}});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/');
    await page.waitForFunction(() => window.t?.loads > 0, null, {timeout: 60000});
    await page.waitForFunction(() => window.t.order.includes('idle'), null, {timeout: 60000});
    const order = await page.evaluate(() => window.t.order.slice(0, 2));
    check('browser: the component emits load before the first idle, and the map is not idle yet at load', order[0] === 'load:false' && order[1] === 'idle', JSON.stringify(order));
    const model = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.value.host;
        host.moveTo({zoom: 15, duration: 200});
        for (let i = 0; i < 80 && !(t.view.value.zoom === 15 && !host.state.get().moving); i++) await wait(100);
        const followed = t.view.value.zoom;
        t.view.value = {center: [-74.0, 40.71], zoom: 13.5, bearing: 0, pitch: 0}; // the application moves the map
        await wait(800);
        const moved = host.state.get().view.zoom;
        t.view.value.zoom = 14.2; // a field of the view, in place
        await wait(800);
        const field = host.state.get().view.zoom;
        // (A marker is a feature of the layer of its marker layer.)
        const at = async lngLat => (await host.queryFeatures(host.project(lngLat), {layers: ['pins']})).length ? 1 : 0;
        // Changes in place, as Vue code makes them: a marker more, a marker replaced.
        t.markers.value[0].data.push({lngLat: [-74.0, 40.71], props: {color: '#00d'}});
        await wait(600);
        const pushed = await at([-74.0, 40.71]);
        t.markers.value[0].data[0] = {lngLat: [-73.99, 40.71], props: {color: '#0a0'}};
        await wait(600);
        const replaced = [await at([-74.0065, 40.7085]), await at([-73.99, 40.71])];
        t.markers.value[0].data[0] = {lngLat: [-74.0065, 40.7085], props: {color: '#d00'}};
        await wait(600);
        const before = await at([-74.0065, 40.7085]);
        t.markers.value = [];
        // An image of the prop `images`, and a change in place that removes it.
        const image = host.map.hasImage('dot');
        delete t.images.value.dot;
        await wait(600);
        return {events: t.moves[0], asked: t.asked.length, added: t.asked.length > 0 && t.asked.every(id => host.map.hasImage(id)), image, imageAfter: host.map.hasImage('dot'), followed, moved, field, views: t.views, pushed, replaced: replaced.join(), before, after: host.map.getLayer('pins') ? 1 : 0};
    });
    check('browser: an event of the map is an event of the component (moveend), and an image that the style asks for (styleimagemissing) is on the map after the listener adds it to the prop images', model.events === 'moveend number' && model.asked > 0 && model.added, JSON.stringify({events: model.events, asked: model.asked, added: model.added}));
    check('browser: v-model:view follows the map and moves it; markers and images follow their props, also when the data changes in place', model.image && !model.imageAfter && model.followed === 15 && model.moved === 13.5 && model.field === 14.2 && model.views > 2 && model.pushed === 1 && model.replaced === '0,1' && model.before === 1 && model.after === 0, JSON.stringify(model));
    // An image as a child component: the SVG of its slot is a template of the map, and it follows the component.
    const child = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), map = t.map.value.host.map, add = map.addImage, given = [];
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
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.value.host;
        const where = id => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width ? [Math.round(r.x + r.width / 2), Math.round(r.bottom)] : null; };
        host.moveTo({center: [-74.0065, 40.7085], zoom: 14}); await wait(600);
        const frame = document.getElementById('frame').getBoundingClientRect(), at = host.project([-74.0065, 40.7085]);
        const pin = where('own-pin'), tip = !!document.querySelector('.map-jr-popup #own-tip');
        t.pin.value = [-74.0, 40.71]; await wait(400);
        // Attributes that are not props fall through to the element, and the content stays visible after a re-render (#161).
        const box = document.getElementById('own-pin')?.parentElement, tipShown = !!document.getElementById('own-tip')?.getClientRects().length;
        const attrsOk = !!box && box.hasAttribute('data-own') && box.classList.contains('own-class') && getComputedStyle(box).color === 'rgb(255, 0, 0)' && box.style.display !== 'none';
        const moved = where('own-pin'), expect = host.project([-74.0, 40.71]);
        // (The callback runs at the click, not after the fade: a busy page plays the fade late. See #172.)
        document.querySelector('.map-jr-popup-close-button')?.click();
        const atOnce = t.closed; await wait(300);
        return {pinOk: !!pin && Math.abs(pin[0] - (frame.x + at.x)) < 3 && Math.abs(pin[1] - (frame.y + at.y)) < 3, tip, movedOk: !!moved && Math.abs(moved[0] - (frame.x + expect.x)) < 3, atOnce, closed: t.closed, tipGone: !document.getElementById('own-tip'), tipShown, attrsOk};
    });
    check('browser: MapOverlay puts own content and a popup at a position, follows its prop, and closes at the click', overlays.pinOk && overlays.tip && overlays.movedOk && overlays.atOnce === 1 && overlays.closed === 1 && overlays.tipGone && overlays.tipShown && overlays.attrsOk, JSON.stringify(overlays));
    await page.evaluate(() => { window.t.pin.value = [-73.5, 41]; }); // (the element of the pin must not be under the click)
    await page.waitForTimeout(400);
    await page.mouse.move(400, 250); await page.waitForTimeout(300); await page.mouse.click(400, 250); await page.waitForTimeout(600);
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
        const got = [];
        await run({onError: e => got.push(e.message)});
        const loggedWithListener = logged.length;
        await run({});
        console.error = log;
        return {got, loggedWithListener, logged};
    });
    check('browser: the event error gets each error, and without a listener the error is written to the console',
        failing.got.length === 1 && /HTTP 404/.test(failing.got[0]) && failing.loggedWithListener === 0 && failing.logged.length === 1 && /HTTP 404/.test(failing.logged[0]), JSON.stringify(failing));
    check('browser: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
} catch (e) { check('the test run was completed', false, String(e.message).split('\n')[0]); }
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
