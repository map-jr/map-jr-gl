// Tests of the React adapter (`@map-jr/map-jr-gl/react`): the server render with React's own server renderer, then the same
// page in a browser, where React takes over the HTML and the map takes over the SVG.   node test/react.mjs   (after pnpm build)
import http from 'node:http';
import path from 'node:path';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createElement as h} from 'react';
import {renderToString} from 'react-dom/server';
import {launch} from './launch.mjs';
import makeStyle from '../demo/style.mjs';
import {MapJr} from '../dist/react.js';
import {renderFirstView} from '../dist/server.js';

const root = path.resolve(import.meta.dirname, '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

const tiles = (await (await fetch('https://tiles.openfreemap.org/planet')).json()).tiles[0];
const style = makeStyle(tiles, '<a href="https://example.com/credits">Example tiles</a>'), view = {center: [-74.0065, 40.7085], zoom: 14.3};
const pins = {id: 'pins', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>', width: 24, height: 24, data: [{lngLat: view.center, props: {color: '#d00'}}]};

// 1. On the server: the first view from the server entry, given to the component.
const firstView = await renderFirstView({style, ...view, width: 800, height: 500, markers: [pins], overrides: {building: {hidden: true}}});
const frame = child => h('div', {id: 'frame', style: {width: 800, height: 500}}, child);
const html = renderToString(frame(h(MapJr, {mapStyle: style, initialView: view, markers: [pins], firstView})));
check('server: the component renders the first view', /<svg[^>]*data-map-jr-ssr/.test(html) && html.includes('Example tiles') && html.includes('map-jr-react'), `${(html.length / 1024).toFixed(0)} KB of HTML`);

// 2. In a browser. React for the browser is made into module files one time (the package has no such files).
const esm = path.join(root, '.cache/react-esm'), require = createRequire(import.meta.url), entryPoints = {};
mkdirSync(esm, {recursive: true});
for (const [name, id] of [['react', 'react'], ['react-dom', 'react-dom'], ['react-dom-client', 'react-dom/client']]) {
    // (The package is CommonJS: a file for each module gives its values as named exports.)
    const names = Object.keys(require(id)).filter(n => n !== 'default' && /^[A-Za-z_$][\w$]*$/.test(n));
    writeFileSync(entryPoints[name] = path.join(esm, name + '.src.js'), `import m from '${id}';\nexport default m;\nexport const {${names.join(', ')}} = m;\n`);
}
await require('esbuild').build({entryPoints, bundle: true, splitting: true, format: 'esm', outdir: esm, absWorkingDir: root, define: {'process.env.NODE_ENV': '"development"'}, logLevel: 'silent'});
const client = `import {createElement as h, useState, useRef} from 'react';
import {createRoot, hydrateRoot} from 'react-dom/client';
import {MapJr, MapOverlay, MapImage, useMapState} from '/dist/react.js';
import {navigation, scale} from '/dist/controls.js';
const style = await (await fetch('/style.json')).json();
const pins = ${JSON.stringify(pins)}, t = window.t = {loads: 0, views: 0, clicks: [], closed: 0, renders: 0};
function Zoom() { const zoom = useMapState(s => s.view.zoom); return h('p', {id: 'zoom'}, zoom === undefined ? '' : zoom.toFixed(1)); }
function App({ssr}) {
    const [view, setView] = useState(${JSON.stringify(view)}), [markers, setMarkers] = useState([pins]), [pin, setPin] = useState([-74.0065, 40.7085]), [tip, setTip] = useState(true), [tone, setTone] = useState('#fff'), [arrow, setArrow] = useState(true), map = useRef(null);
    Object.assign(t, {setView, setMarkers, setPin, setTone, setArrow, map, view});
    t.renders++;
    // (The props are made again in each render, as React code does: the arrays of controls and layers, the functions.)
    return h('div', {id: 'frame', style: {width: 800, height: 500}}, ssr
        ? h(MapJr, {ref: map, mapStyle: style, initialView: view, markers, controls: [navigation()], onLoad: () => t.loads++})
        : h(MapJr, {ref: map, mapStyle: style, view, onViewChange: v => { t.views++; setView(v); }, markers, controls: [navigation(), scale({position: 'bottom-left'})], interactiveLayers: ['water', 'park', 'building'],
            onClick: e => t.clicks.push(e), onLoad: () => t.loads++, attribution: false},
            h(Zoom), h(MapOverlay, {lngLat: pin, anchor: 'bottom'}, h('b', {id: 'own-pin'}, 'here')),
            arrow && h(MapImage, {name: 'arrow', params: ['color']}, ({color}) => h('svg', {viewBox: '0 0 8 8'}, h('path', {d: 'M4 0 8 8 0 8z', fill: color, stroke: tone}))),
            h(MapImage, {name: 'photo', src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%224%22 height=%224%22/%3E', width: 4, height: 4}),
            tip && h(MapOverlay, {lngLat: pin, popup: true, onClose: () => { t.closed++; setTip(false); }}, h('span', {id: 'own-tip'}, 'A popup'))));
}
if (location.search === '?ssr') hydrateRoot(document.getElementById('app'), h(App, {ssr: true}), {onRecoverableError: e => (window.recovered ||= []).push(String(e.message))});
else createRoot(document.getElementById('app')).render(h(App, {}));
window.ready = true;`;
const types = {'.js': 'text/javascript', '.json': 'application/json'};
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), send = (body, type) => { res.writeHead(200, {'content-type': type}); res.end(body); };
    try {
        if (url.pathname === '/') return send(`<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="importmap">{"imports": {"react": "/esm/react.js", "react-dom": "/esm/react-dom.js", "react-dom/client": "/esm/react-dom-client.js"}}</script><div id="app">${url.search === '?ssr' ? html : ''}</div><script type="module" src="/client.js${url.search}"></script>`, 'text/html');
        if (url.pathname === '/client.js') return send(client, 'text/javascript');
        if (url.pathname === '/style.json') return send(JSON.stringify(style), 'application/json');
        if (url.pathname.startsWith('/esm/')) return send(readFileSync(path.join(esm, url.pathname.slice(5))), 'text/javascript');
        send(readFileSync(path.join(root, url.pathname)), types[path.extname(url.pathname)] ?? 'application/octet-stream');
    } catch { res.writeHead(404); res.end(); }
}).listen(0);
const origin = `http://localhost:${server.address().port}`, browser = await launch();
try {
    let page = await browser.newPage({viewport: {width: 900, height: 600}});
    const warnings = [], errors = [];
    // (Only warnings and errors: a browser can write other lines with these words.)
    page.on('console', m => { if (/warn|error/.test(m.type()) && /hydrat|did not match|mismatch/i.test(m.text())) warnings.push(m.text().replace(/\s+/g, ' ').slice(0, 600)); });
    page.on('pageerror', e => errors.push(e.message));
    if (process.env.DEBUG) { page.on('console', m => console.log('console:', m.text().slice(0, 300))); page.on('pageerror', e => console.log('pageerror:', e.message.slice(0, 300))); page.on('requestfailed', r => console.log('failed:', r.url())); page.on('response', r => { if (r.status() >= 400) console.log(r.status(), r.url()); }); }
    await page.goto(origin + '/?ssr');
    await page.waitForFunction(() => window.ready);
    const early = await page.evaluate(() => !!document.querySelector('svg[data-map-jr-ssr]'));
    await page.waitForFunction(() => window.t.loads > 0, null, {timeout: 60000});
    await page.waitForTimeout(1000);
    const late = await page.evaluate(() => ({svg: !!document.querySelector('[data-map-jr-ssr]'), canvas: !!document.querySelector('#frame canvas'), controls: document.querySelectorAll('#frame .map-jr-ctrl-group').length, recovered: window.recovered ?? []}));
    check('browser: React takes over the HTML of the server, the map takes over the SVG, and the controls show', early && !late.svg && late.canvas && late.controls === 1 && !late.recovered.length && !warnings.length && !errors.length, JSON.stringify({early, late, warnings: warnings.slice(0, 2), errors: errors.slice(0, 2)}));
    await page.close();

    page = await browser.newPage({viewport: {width: 900, height: 600}});
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/');
    await page.waitForFunction(() => window.t?.loads > 0, null, {timeout: 60000});
    const model = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), host = t.map.current;
        const frame = document.getElementById('frame').getBoundingClientRect();
        const where = id => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width ? [Math.round(r.x + r.width / 2 - frame.x), Math.round(r.bottom - frame.y)] : null; };
        const near = (p, q) => !!p && Math.abs(p[0] - q.x) < 3 && Math.abs(p[1] - q.y) < 3;
        host.moveTo({zoom: 15, duration: 200});
        for (let i = 0; i < 80 && !(host.state.get().view.zoom === 15 && !host.state.get().moving); i++) await wait(100);
        await wait(300);
        const followed = t.view.zoom, shown = document.getElementById('zoom').textContent, controls = document.querySelectorAll('#frame .map-jr-ctrl-group, #frame .map-jr-ctrl-scale').length;
        t.setView({center: [-74.0065, 40.7085], zoom: 14, bearing: 0, pitch: 0}); // the application moves the map
        for (let i = 0; i < 80 && host.state.get().view.zoom !== 14; i++) await wait(100);
        await wait(300);
        const moved = host.state.get().view.zoom, pinOk = near(where('own-pin'), host.project([-74.0065, 40.7085])), tip = !!document.querySelector('.map-jr-popup #own-tip');
        t.setPin([-74.0, 40.71]); await wait(400);
        const pinMoved = near(where('own-pin'), host.project([-74.0, 40.71]));
        document.querySelector('.map-jr-popup-close-button')?.click(); await wait(300);
        const before = host.map.queryMarkers(host.project([-74.0065, 40.7085])) ? 1 : 0;
        t.setMarkers([]); await wait(600);
        return {followed, shown, controls, moved, pinOk, tip, pinMoved, closed: t.closed, tipGone: !document.getElementById('own-tip'), views: t.views, before, after: host.map.queryMarkers(host.project([-74.0065, 40.7085])) ? 1 : 0};
    });
    check('browser: the view follows the map and moves it; useMapState, controls, overlays and markers follow React', model.followed === 15 && model.shown === '15.0' && model.controls === 2 && model.moved === 14 && model.pinOk && model.tip && model.pinMoved
        && model.closed === 1 && model.tipGone && model.views > 1 && model.before === 1 && model.after === 0, JSON.stringify(model));
    await page.evaluate(() => window.t.setPin([-73.5, 41])); // (the element of the pin must not be under the click)
    await page.waitForTimeout(400);
    await page.mouse.move(400, 250); await page.waitForTimeout(300); await page.mouse.click(400, 250); await page.waitForTimeout(800);
    const click = await page.evaluate(() => ({clicks: window.t.clicks.length, features: Array.isArray(window.t.clicks[0]?.features)}));
    check('browser: a click calls onClick, with the features there', click.clicks === 1 && click.features, JSON.stringify(click));
    // An image as a child component: the SVG of its content is a template of the map, and it follows the component.
    const child = await page.evaluate(async () => {
        const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), map = t.map.current.map, add = map.addImage, given = [];
        const first = [map.hasImage('arrow'), map.hasImage('photo')];
        map.addImage = function (name, source, ...rest) { given.push([name, source]); return add.call(this, name, source, ...rest); };
        t.setPin([-74.0064, 40.7085]); // (a render with the same image gives the image no second time)
        await wait(300);
        const again = given.length;
        t.setTone('#00f');
        await wait(300);
        const changed = given.map(([name, source]) => name + ' ' + source).join();
        t.setArrow(false);
        await wait(300);
        delete map.addImage;
        return {first, again, changed, gone: !map.hasImage('arrow')};
    });
    check('browser: MapImage gives the SVG of its content to the map as a template, gives it again only when it changes, and takes it away', child.first.join() === 'true,true' && child.again === 0
        && /^arrow <svg[^>]*viewBox="0 0 8 8"[^>]*><path d="M4 0 8 8 0 8z" fill="\{\{color\}\}" stroke="#00f"\/?>(<\/path>)?<\/svg>$/.test(child.changed) && child.gone, JSON.stringify(child));
    // `onError` gets each error; without it the map writes the error to the console.
    const failing = await page.evaluate(async () => {
        const {createElement: h} = await import('react'), {createRoot} = await import('react-dom/client'), {MapJr} = await import('/dist/react.js'), wait = ms => new Promise(r => setTimeout(r, ms));
        const logged = [], log = console.error;
        console.error = (...a) => logged.push(a.map(x => x?.message ?? String(x)).join(' '));
        const run = async props => {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
            const root = createRoot(el);
            root.render(h(MapJr, {mapStyle: '/no-such-style.json', attribution: false, ...props}));
            await wait(1500);
            root.unmount(); el.remove();
        };
        const got = [];
        await run({onError: e => got.push(e.message)});
        const loggedWithProp = logged.filter(l => l.includes('map-jr-gl')).length;
        await run({});
        console.error = log;
        return {got, loggedWithProp, logged: logged.filter(l => l.includes('map-jr-gl'))};
    });
    check('browser: onError gets each error, and without it the error is written to the console',
        failing.got.length === 1 && /HTTP 404/.test(failing.got[0]) && failing.loggedWithProp === 0 && failing.logged.length === 1 && /HTTP 404/.test(failing.logged[0]), JSON.stringify(failing));
    check('browser: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await page.close();
} catch (e) { check('the test run was completed', false, String(e.message).split('\n')[0]); }
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
