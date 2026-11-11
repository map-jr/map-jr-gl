// Tests of the Vue adapter (`map-jr-gl/vue`): the server render with Vue's own server renderer, then the same page in
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
const pins = {id: 'pins', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>', width: 24, height: 24, data: [{lngLat: view.center, props: {color: '#d00'}}]};

// 1. On the server.
const html = await renderToString(createSSRApp({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {mapStyle: style, initialView: view, markers: [pins], ssr: {width: 800, height: 500}, attribution: false})])}));
check('server: the component renders the first view as SVG', /<svg[^>]*data-map-jr-ssr/.test(html) && html.length > 20000 && html.includes('map-jr-vue'), `${(html.length / 1024).toFixed(0)} KB of HTML`);
const credited = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, ssr: true})}));
check('server: the credits of the sources are in the page, as text and links only', !html.includes('example.com/credits') && /<div data-map-jr-ssr[^>]*><a href="https:\/\/example.com\/credits">Example tiles<\/a><\/div>/.test(credited), credited.match(/<div data-map-jr-ssr[^>]*>.{0,120}/)?.[0] ?? 'no credits');
const small = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view, ssr: {width: 800, height: 500, overrides: {building: {hidden: true}, 'building-outline': {hidden: true}, road: {minzoom: 20}}, attribution: 'Own credits'}})}));
check('server: overrides for style layers make the render smaller, and the credits can be given', small.length < html.length * 0.8 && small.includes('>Own credits</div>'), `${(small.length / 1024).toFixed(0)} KB against ${(html.length / 1024).toFixed(0)} KB`);
const plain = await renderToString(createSSRApp({render: () => h(MapJr, {mapStyle: style, initialView: view})}));
check('server: without the ssr prop the component renders an empty element', !plain.includes('<svg') && plain.includes('map-jr-vue'), plain.slice(0, 120));

const bare = await renderToString(createSSRApp({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {mapStyle: style, initialView: view, markers: [pins], attribution: false})])}));

// 2. In a browser: the page from the server, then Vue and the map.
const types = {'.js': 'text/javascript', '.json': 'application/json'};
const client = `import {createSSRApp, createApp, h, ref} from 'vue';
import {MapJr, MapOverlay} from '/dist/vue.js';
import {navigation, scale} from '/dist/controls.js';
const style = await (await fetch('/style.json')).json();
const view = ref(${JSON.stringify(view)}), markers = ref([${JSON.stringify(pins)}]), layers = ref(['water', 'park', 'building']);
const t = window.t = {view, markers, layers, clicks: [], loads: 0, views: 0, map: ref(null), pin: ref([-74.0065, 40.7085]), tip: ref(true), closed: 0};
const make = (create, ssr) => create({render: () => h('div', {id: 'frame', style: 'width:800px;height:500px'}, [h(MapJr, {ref: t.map, mapStyle: style, controls: [navigation(), scale({position: 'bottom-left'})], ...(ssr ? {initialView: view.value, ...(ssr === 'svg' ? {ssr: {width: 800, height: 500}} : {})} : {view: view.value, 'onUpdate:view': v => { t.views++; view.value = v; }, interactiveLayers: layers.value, onClick: e => t.clicks.push(e)}), markers: markers.value, attribution: false, onLoad: () => t.loads++}, ssr ? undefined : {default: () => [h(MapOverlay, {lngLat: t.pin.value, anchor: 'bottom'}, () => h('b', {id: 'own-pin'}, 'here')), t.tip.value ? h(MapOverlay, {lngLat: t.pin.value, popup: true, onClose: () => { t.closed++; t.tip.value = false; }}, () => h('span', {id: 'own-tip'}, 'A popup')) : null]})])});
if (location.search === '?ssr') make(createSSRApp, 'svg').mount('#app'); else if (location.search === '?bare') make(createSSRApp, 'bare').mount('#app'); else make(createApp, false).mount('#app');
window.ready = true;`;
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), send = (body, type) => { res.writeHead(200, {'content-type': type}); res.end(body); };
    try {
        if (url.pathname === '/') return send(`<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="importmap">{"imports": {"vue": "/vue.js"}}</script><div id="app">${url.search === '?ssr' ? html : url.search === '?bare' ? bare : ''}</div><script type="module" src="/client.js${url.search}"></script>`, 'text/html');
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
    await page.close();
    page = await browser.newPage({viewport: {width: 900, height: 600}});
    const warnings = [], errors = [];
    page.on('console', m => { if (/hydrat|mismatch/i.test(m.text())) warnings.push(m.text().split('\n')[0]); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/?ssr');
    await page.waitForFunction(() => window.ready);
    const early = await page.evaluate(() => ({svg: !!document.querySelector('svg[data-map-jr-ssr]')}));
    await page.waitForFunction(() => window.t.loads > 0, null, {timeout: 60000});
    await page.waitForTimeout(1000);
    const late = await page.evaluate(() => ({svg: !!document.querySelector('svg[data-map-jr-ssr]'), canvas: !!document.querySelector('#frame canvas'), loaded: window.t.map.value.state.loaded}));
    check('browser: Vue takes over the HTML of the server without a difference, and the map takes over the SVG', early.svg && !late.svg && late.canvas && late.loaded && !warnings.length && !errors.length, JSON.stringify({early, late, warnings: warnings.slice(0, 2), errors: errors.slice(0, 2)}));
    const controlsWithSsr = await page.evaluate(() => document.querySelectorAll('#frame .map-jr-ctrl-group, #frame .map-jr-ctrl-scale').length);
    await page.close();
    // The page from a server without the ssr prop: an empty element from the server, then the map with its controls.
    page = await browser.newPage({viewport: {width: 900, height: 600}});
    page.on('console', m => { if (/hydrat|mismatch/i.test(m.text())) warnings.push(m.text().split('\n')[0]); });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/?bare');
    await page.waitForFunction(() => window.t?.loads > 0, null, {timeout: 60000});
    const controlsBare = await page.evaluate(() => document.querySelectorAll('#frame .map-jr-ctrl-group, #frame .map-jr-ctrl-scale').length);
    check('browser: controls show on a page from a server, with the ssr prop and without it', controlsWithSsr >= 2 && controlsBare >= 2 && !warnings.length && !errors.length, JSON.stringify({controlsWithSsr, controlsBare, warnings: warnings.slice(0, 2), errors: errors.slice(0, 2)}));
    await page.close();

    // The component in the browser only: v-model:view, markers, the pointer, and the end.
    page = await browser.newPage({viewport: {width: 900, height: 600}});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/');
    await page.waitForFunction(() => window.t?.loads > 0, null, {timeout: 60000});
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
        const at = lngLat => host.map.queryMarkers(host.project(lngLat)) ? 1 : 0;
        // Changes in place, as Vue code makes them: a marker more, a marker replaced.
        t.markers.value[0].data.push({lngLat: [-74.0, 40.71], props: {color: '#00d'}});
        await wait(600);
        const pushed = at([-74.0, 40.71]);
        t.markers.value[0].data[0] = {lngLat: [-73.99, 40.71], props: {color: '#0a0'}};
        await wait(600);
        const replaced = [at([-74.0065, 40.7085]), at([-73.99, 40.71])];
        t.markers.value[0].data[0] = {lngLat: [-74.0065, 40.7085], props: {color: '#d00'}};
        await wait(600);
        const before = host.map.queryMarkers(host.project([-74.0065, 40.7085])) ? 1 : 0;
        t.markers.value = [];
        await wait(600);
        return {followed, moved, field, views: t.views, pushed, replaced: replaced.join(), before, after: host.map.queryMarkers(host.project([-74.0065, 40.7085])) ? 1 : 0};
    });
    check('browser: v-model:view follows the map and moves it; markers follow their prop, also when the data changes in place', model.followed === 15 && model.moved === 13.5 && model.field === 14.2 && model.views > 2 && model.pushed === 1 && model.replaced === '0,1' && model.before === 1 && model.after === 0, JSON.stringify(model));
    // Elements of the page on the map: a marker with own content and a popup, as child components.
    const overlays = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.value.host;
        const where = id => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width ? [Math.round(r.x + r.width / 2), Math.round(r.bottom)] : null; };
        host.moveTo({center: [-74.0065, 40.7085], zoom: 14}); await wait(600);
        const frame = document.getElementById('frame').getBoundingClientRect(), at = host.project([-74.0065, 40.7085]);
        const pin = where('own-pin'), tip = !!document.querySelector('.map-jr-popup #own-tip');
        t.pin.value = [-74.0, 40.71]; await wait(400);
        const moved = where('own-pin'), expect = host.project([-74.0, 40.71]);
        document.querySelector('.map-jr-popup-close-button')?.click(); await wait(300);
        return {pinOk: !!pin && Math.abs(pin[0] - (frame.x + at.x)) < 3 && Math.abs(pin[1] - (frame.y + at.y)) < 3, tip, movedOk: !!moved && Math.abs(moved[0] - (frame.x + expect.x)) < 3, closed: t.closed, tipGone: !document.getElementById('own-tip')};
    });
    check('browser: MapOverlay puts own content and a popup at a position, follows its prop, and closes', overlays.pinOk && overlays.tip && overlays.movedOk && overlays.closed === 1 && overlays.tipGone, JSON.stringify(overlays));
    await page.mouse.move(400, 250); await page.waitForTimeout(300); await page.mouse.click(400, 250); await page.waitForTimeout(600);
    const click = await page.evaluate(() => ({clicks: window.t.clicks.length, features: Array.isArray(window.t.clicks[0]?.features)}));
    check('browser: a click is an event of the component, with the features there', click.clicks === 1 && click.features, JSON.stringify(click));
    check('browser: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
} catch (e) { check('the test run was completed', false, String(e.message).split('\n')[0]); }
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
