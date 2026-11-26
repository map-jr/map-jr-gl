// Tests of the web component (`@map-jr/map-jr-gl/element`): the element <map-jr> in a browser, and the markup of
// `renderElement` from the server entry, which the element takes over.   node test/element.mjs   (after pnpm build)
import http from 'node:http';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {launch} from './launch.mjs';
import makeStyle from '../demo/style.mjs';
import {renderElement, renderFirstView} from '../dist/server.js';
import {navigation, scale, fullscreen, geolocate, globe, terrain, colorScheme} from '../dist/controls.js';

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
const style = makeStyle(tiles, 'Example tiles');
const point = {type: 'FeatureCollection', features: [{type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: [-74.0065, 40.7085]}}]};
const dot = [{id: 'dot', type: 'circle', source: 'dot', paint: {'circle-radius': 30, 'circle-color': '#123456'}}];

/** The pages of the test, by path. `ssr` is set when the server has rendered the element. */
const pages = {
    // Attributes only, with a listener on the document for each event (they bubble), before the element is defined.
    '/attributes': `<map-jr id="a" map-style="/style.json" center="-74.0065,40.7085" zoom="14" min-zoom="2" interactive-layers="dot water" hover-state cursor="crosshair" style="width:600px;height:400px"></map-jr>
<script type="module">
  window.seen = [];
  const a = document.getElementById('a');
  const record = e => window.seen.push({name: e.type, target: e.target.id, detail: e.detail});
  // (Every event bubbles to the document, whoever listens and whenever the listener was added: #1257.)
  document.addEventListener('map-ready', record);
  // (Properties before the element is defined: the data and the layer, and a property that wins over its attribute.)
  a.data = {dot: ${JSON.stringify(point)}};
  a.layers = ${JSON.stringify(dot)};
  a.minZoom = 3;
  await import('/dist/element.js');
  // (The listeners of the other events are added to the document after the element has made its map.)
  await new Promise(r => setTimeout(r));
  window.startedFirst = !!a.map;
  for (const name of ['map-load', 'map-idle', 'map-click', 'map-viewchange', 'map-moveend', 'map-styleload']) document.addEventListener(name, record);
  window.ready = true;
</script>`,
    // Two elements on one page.
    '/two': `<map-jr id="a" map-style="/style.json" center="-74.0065,40.7085" zoom="14" style="width:400px;height:300px"></map-jr>
<map-jr id="b" map-style="/style.json" center="13.4,52.52" zoom="10" style="width:400px;height:300px"></map-jr>
<script type="module">
  window.seen = [];
  for (const id of ['a', 'b']) for (const name of ['map-load', 'map-click', 'map-viewchange']) document.getElementById(id).addEventListener(name, e => window.seen.push({name, on: id, target: e.target.id}));
  await import('/dist/element.js');
  window.ready = true;
</script>`,
    // An element made by script, with properties set after it was created.
    '/script': `<div id="box"></div>
<script type="module">
  const {MapJrElement} = await import('/dist/element.js');
  window.Element_ = MapJrElement;
  window.ready = true;
</script>`,
    // The boolean attributes of #1258: `no-` for a field that is on by default, and `attribution-compact`.
    '/booleans': `<map-jr id="a" map-style="/style.json" center="-74.0065,40.7085" zoom="14" no-interactive antialias no-attribution style="width:400px;height:300px"></map-jr>
<map-jr id="b" map-style="/style.json" center="-74.0065,40.7085" zoom="14" attribution-compact style="width:400px;height:300px"></map-jr>
<script type="module">await import('/dist/element.js'); window.ready = true;</script>`,
    // The development build: attributes that cannot be read, and an element without a style.
    '/dev': `<map-jr id="a" map-style="/style.json" center="Berlin" zoom="near" hover-state="false" no-attribution="false" projection="flat" style="width:400px;height:300px"></map-jr>
<map-jr id="b" style="width:400px;height:300px"></map-jr>
<script type="module">await import('/dist/element.dev.js'); window.ready = true;</script>`,
};

const types = {'.js': 'text/javascript', '.json': 'application/json', '.map': 'application/json'};
let ssrPage = '', controlsPage = '';
// A map whose first view the server and the browser draw the same (one colour), so a screenshot compares the controls (#1396).
const blank = {version: 8, sources: {credited: {type: 'geojson', data: {type: 'FeatureCollection', features: []}, attribution: '<a href="https://example.com/credits">Test credits</a> &amp; more'}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#dde8d4'}}, {id: 'edge', type: 'line', source: 'credited'}]};
const controlList = () => [navigation(), scale(), fullscreen(), geolocate(), globe(), terrain({source: 'dem'}), colorScheme()];
const controlNames = 'navigation(), scale(), fullscreen(), geolocate(), globe(), terrain({source: "dem"}), colorScheme()';
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), send = (body, type) => { res.writeHead(200, {'content-type': type}); res.end(body); };
    try {
        if (url.pathname === '/style.json') return send(JSON.stringify(style), 'application/json');
        if (url.pathname === '/blank.json') return send(JSON.stringify(blank), 'application/json');
        if (url.pathname === '/ssrc') return send(`<!doctype html><meta charset="utf-8"><body style="margin:0">${controlsPage}<script type="module">
  const {navigation, scale, fullscreen, geolocate, globe, terrain, colorScheme} = await import('/dist/controls.js');
  const a = document.querySelector('map-jr');
  // Each frame from now on: the buttons that are visible, and where the zoom buttons are.
  window.frames = [];
  const names = {'zoom-in': '.map-jr-ctrl-zoom-in', 'zoom-out': '.map-jr-ctrl-zoom-out', compass: '.map-jr-ctrl-compass', scale: '.map-jr-ctrl-scale', fullscreen: '.map-jr-ctrl-fullscreen', geolocate: '.map-jr-ctrl-geolocate', globe: '.map-jr-ctrl-globe, .map-jr-ctrl-globe-enabled', terrain: '.map-jr-ctrl-terrain', 'color-scheme': '.map-jr-ctrl-color-scheme', attribution: '.map-jr-ctrl-attrib'};
  const watch = () => {
    const missing = [], at = [];
    for (const [name, selector] of Object.entries(names)) {
      const v = [...a.querySelectorAll(selector)].filter(b => getComputedStyle(b).visibility === 'visible');
      if (v.length !== 1) missing.push(name + ':' + v.length); else { const r = v[0].getBoundingClientRect(); at.push([name, r.x, r.y, r.width, r.height].join()); }
    }
    // The stage: the server picture and the canvas never show together (the canvas is hidden until the picture goes), and no frame has neither.
    const svg = !!a.querySelector(':scope > [data-map-jr-ssr] > svg[data-map-jr-ssr]'), canvas = a.querySelector(':scope > canvas'), hidden = !!canvas && getComputedStyle(canvas).visibility === 'hidden';
    window.frames.push({n: missing.length ? 0 : 1, missing, at: at.join(';'), svg, canvas: !!canvas, hidden});
    requestAnimationFrame(watch);
  };
  watch();
  window.idle = false;
  a.addEventListener('map-idle', () => { window.idle = true; });
  a.controls = [${controlNames}];
  await import('/dist/element.js');
  window.ready = true;
</script>`, 'text/html');
        if (url.pathname === '/ssr') return send(`<!doctype html><meta charset="utf-8"><body style="margin:0">${ssrPage}<p id="after">after</p><script type="module">
  const a = document.querySelector('map-jr');
  window.seen = [];
  a.addEventListener('map-load', () => window.seen.push('load'));
  a.layers = ${JSON.stringify(dot)}; a.data = {dot: ${JSON.stringify(point)}};
  await import('/dist/element.js');
  window.ready = true;
</script>`, 'text/html');
        if (pages[url.pathname]) return send(`<!doctype html><meta charset="utf-8"><body style="margin:0">${pages[url.pathname]}`, 'text/html');
        send(readFileSync(path.join(root, url.pathname)), types[path.extname(url.pathname)] ?? 'application/octet-stream');
    } catch { res.writeHead(404); res.end(); }
}).listen(0);
const origin = `http://localhost:${server.address().port}`, browser = await launch();
const open = async (p, options = {}) => {
    const page = await browser.newPage({viewport: {width: 900, height: 700}, ...options});
    page.errors = []; page.warnings = [];
    page.on('pageerror', e => page.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') page.warnings.push(m.text()); });
    await page.goto(origin + p);
    if (options.javaScriptEnabled !== false) await page.waitForFunction(() => window.ready, null, {timeout: 30000});
    return page;
};
try {
    // 1. The server: the markup of the element, with the attributes from the description and the first view.
    const description = {style: origin + '/style.json', initialView: {center: [-74.0065, 40.7085], zoom: 14}, interactiveLayers: ['dot', 'water'], hoverState: true, cooperativeGestures: false, projection: {type: 'globe'}, padding: {top: 10},
        layers: dot, data: {dot: point}, attribution: false};
    ssrPage = await renderElement(description, {width: 600, height: 400, attributes: {id: 'a', 'data-x': 'a"b', style: 'width:600px;height:400px'}});
    const open_ = ssrPage.slice(0, ssrPage.indexOf('>'));
    check('server: renderElement writes the attributes of the description, escaped, and leaves out objects and false booleans',
        open_ === `<map-jr map-style="${origin}/style.json" center="-74.0065,40.7085" zoom="14" interactive-layers="dot water" projection="globe" hover-state no-attribution id="a" data-x="a&quot;b" style="display:block;position:relative;overflow:hidden;width:600px;height:400px"`, open_);
    check('server: the first view is the children of the element, with the layers and the data of the description', /<map-jr[^>]*><div data-map-jr-ssr=""[^>]*><svg[^>]*data-map-jr-ssr/.test(ssrPage) && ssrPage.includes('#123456') && ssrPage.endsWith('</map-jr>'), `${(ssrPage.length / 1024).toFixed(0)} KB`);
    let thrown = '';
    try { await renderElement(description, {attributes: {'on click': 'x'}}); } catch (e) { thrown = e.message; }
    check('server: an attribute name that is not one throws a message', thrown.startsWith('[map-jr-gl] E30826 renderElement(): "on click"'), thrown);
    thrown = '';
    try { await renderElement(description, {attributes: {onload: 'alert(1)'}}); } catch (e) { thrown = e.message; }
    check('server: an event handler attribute throws a message', thrown.includes('"onload" is not the name of an attribute that the element can have'), thrown);
    const logged = [], error = console.error;
    console.error = m => logged.push(m);
    const failedRender = await renderElement({style: 'http://127.0.0.1:1/style.json', initialView: {zoom: 2}}, {timeout: 3000}).finally(() => { console.error = error; });
    check('server: a render that fails gives the element without the first view, and one message', failedRender.startsWith('<map-jr ') && !failedRender.includes('<svg') && logged.length === 1 && logged[0].startsWith('[map-jr-gl] E40826 renderElement():'), failedRender.slice(0, 120) + ' | ' + String(logged[0]).slice(0, 120));

    // 2. The markup of the server in a browser: shown without scripts, then the element takes it over.
    let page = await open('/ssr', {javaScriptEnabled: false});
    const before = await page.evaluate(() => ({svg: !!document.querySelector('map-jr > [data-map-jr-ssr] > svg[data-map-jr-ssr]'), height: document.querySelector('map-jr').getBoundingClientRect().height, after: Math.round(document.getElementById('after').getBoundingClientRect().top)}));
    await page.close();
    page = await open('/ssr');
    const early = await page.evaluate(() => !!document.querySelector('map-jr > [data-map-jr-ssr] > svg[data-map-jr-ssr]'));
    await page.waitForFunction(() => window.seen.includes('load'), null, {timeout: 60000});
    await page.waitForTimeout(500);
    const late = await page.evaluate(() => { const a = document.querySelector('map-jr'); return {svg: !!a.querySelector('[data-map-jr-ssr]'), canvas: !!a.querySelector(':scope > canvas'), layers: a.map.description.layers?.length, hover: a.map.description.hoverState, projection: a.map.description.projection, after: Math.round(document.getElementById('after').getBoundingClientRect().top)}; });
    check('browser: the first view of renderElement shows without scripts, at the size of the element', before.svg && before.height === 400, JSON.stringify(before));
    check('browser: the element takes over the markup of the server: the map removes the first view after its first frame, and nothing moves', early && !late.svg && late.canvas && late.layers === 1 && late.hover === true && late.projection?.type === 'globe' && late.after === before.after && !page.errors.length, JSON.stringify({early, late, errors: page.errors}));
    await page.close();

    // With initialView.bounds, the element starts at the view of the fit, so the dot stays where the first view drew it (#1669).
    // (The box does not have the dot at its center, so a start at another view moves the dot.)
    ssrPage = await renderElement({style: origin + '/blank.json', initialView: {bounds: [-74.03, 40.69, -73.99, 40.72], fitPadding: 20}, layers: dot, data: {dot: point}, attribution: false},
        {width: 600, height: 400, attributes: {style: 'width:600px;height:400px'}});
    check('server: with initialView.bounds, renderElement writes the center and the zoom of the fit', /^<map-jr [^>]*center="-74\.0\d+,40\.70\d+" zoom="1[23]\.\d+"/.test(ssrPage), ssrPage.slice(0, ssrPage.indexOf('>')));
    const capped = await renderElement({style: origin + '/blank.json', initialView: {bounds: [-74.03, 40.69, -73.99, 40.72], fitMaxZoom: 10}}, {width: 600, height: 400});
    check('server: renderElement fits initialView.bounds up to fitMaxZoom, as the map does', capped.includes(' zoom="10"'), capped.slice(0, capped.indexOf('>')));
    page = await open('/ssr', {javaScriptEnabled: false});
    const drawn = await page.evaluate(() => { const r = document.querySelector('map-jr [data-map-jr-ssr] svg [fill="#123456"]')?.getBoundingClientRect(); return r && [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; });
    await page.close();
    page = await open('/ssr');
    await page.waitForFunction(() => window.seen.includes('load'), null, {timeout: 60000});
    const live = await page.evaluate(() => { const a = document.querySelector('map-jr'), p = a.map.project([-74.0065, 40.7085]), r = a.getBoundingClientRect(); return [Math.round(r.x + p.x), Math.round(r.y + p.y)]; });
    check('browser: with initialView.bounds, the dot is at the same place in the first view and in the map', !!drawn && Math.hypot(drawn[0] - live[0], drawn[1] - live[1]) <= 2 && !page.errors.length, JSON.stringify({drawn, live, errors: page.errors}));
    await page.close();

    // The first view of 200 by 200 in elements of another shape and size: drawn at 1:1 and centered, cropped by a smaller
    // element, and scaled up as little as covers a larger one, with no band of the page and no overflow (#1427).
    // With `bounds` the map fits them to the element, so the first view is scaled as the fit is: the bounds of 40 by 20 degrees
    // fill the width of the render, half of it in an element of 100 x 100 and twice of it in one of 400 x 200.
    const shapeStyle = {version: 8, sources: {c: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}}},
        layers: [{id: 'bg', type: 'background', paint: {'background-color': '#00aa00'}}, {id: 'c', type: 'circle', source: 'c', paint: {'circle-radius': 20, 'circle-color': '#0000ff'}}]};
    const shapeView = await renderFirstView({style: shapeStyle, center: [0, 0], zoom: 2, width: 200, height: 200, attribution: false});
    const fitView = await renderFirstView({style: shapeStyle, bounds: [[-20, -10], [20, 10]], width: 200, height: 200, attribution: false});
    const boxes = [{w: 400, h: 200, scale: 2}, {w: 200, h: 400, scale: 2}, {w: 120, h: 160, scale: 1}, {w: 100, h: 100, scale: 0.5, fit: true}, {w: 400, h: 200, scale: 2, fit: true}];
    page = await browser.newPage({viewport: {width: 600, height: 1300}});
    await page.setContent(`<body style="margin:0;background:#ff00ff">${boxes.map(b => `<div style="position:relative;width:${b.w}px;height:${b.h}px;margin-bottom:20px">${b.fit ? fitView : shapeView}</div>`).join('')}</body>`);
    const shot = (await page.screenshot()).toString('base64');
    const shape = await page.evaluate(async ({shot, boxes}) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + shot;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data, at = (x, y) => px.slice((y * c.width + x) * 4, (y * c.width + x) * 4 + 3);
        const page_ = ([r, gr, b]) => r > 200 && gr < 60 && b > 200, blue = ([r, gr, b]) => r < 60 && gr < 60 && b > 200;
        return [...document.body.children].map((el, i) => {
            const r = el.getBoundingClientRect(), m = el.querySelector('svg').getScreenCTM();
            let band = 0, n = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (let y = Math.ceil(r.top); y < r.bottom; y++) for (let x = Math.ceil(r.left); x < r.right; x++) {
                const p = at(x, y);
                if (page_(p)) band++;
                if (blue(p)) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
            }
            return {box: `${boxes[i].w}x${boxes[i].h}${boxes[i].fit ? ' bounds' : ''}`, scale: +m.a.toFixed(3), offset: [Math.round(m.e + 100 * m.a - (r.left + r.width / 2)), Math.round(m.f + 100 * m.d - (r.top + r.height / 2))], band,
                dot: n ? {size: x1 - x0 + 1, offset: [Math.round((x0 + x1 + 1) / 2 - (r.left + r.width / 2)), Math.round((y0 + y1 + 1) / 2 - (r.top + r.height / 2))]} : null,
                outside: page_(at(Math.round(r.right) + 5, Math.round(r.top + r.height / 2)))};
        }).concat([{scrollWidth: document.documentElement.scrollWidth, innerWidth}]);
    }, {shot, boxes});
    const pageSize = shape.pop();
    check('browser: the first view of 200 x 200 in elements of 400 x 200, 200 x 400 and 120 x 160 is centered, at 1:1 or scaled up as little as covers the element, and with bounds scaled as the fit to the element, with no band of the page', shape.every((s, i) => s.scale === boxes[i].scale && s.offset.every(d => Math.abs(d) <= 1) && s.band === 0
        && s.dot && Math.abs(s.dot.size - 40 * boxes[i].scale) <= 3 && s.dot.offset.every(d => Math.abs(d) <= 2) && s.outside) && pageSize.scrollWidth === pageSize.innerWidth, JSON.stringify(shape) + ' ' + JSON.stringify(pageSize));
    await page.close();

    // 3. Attributes, properties set before the element was defined, events.
    page = await open('/attributes');
    await page.waitForFunction(() => window.seen.some(e => e.name === 'map-idle'), null, {timeout: 60000});
    const first = await page.evaluate(() => {
        const a = document.getElementById('a'), d = a.map.description;
        return {style: d.style, initialView: d.initialView, interactiveLayers: d.interactiveLayers, hoverState: d.hoverState, cursor: d.cursor, minZoom: d.minZoom, layers: d.layers?.length, data: !!d.data?.dot,
            own: Object.hasOwn(a, 'layers'), zoom: +a.state.get().view.zoom.toFixed(2), names: window.seen.map(e => e.name), ready: window.seen[0].detail === a.map, startedFirst: window.startedFirst, load: window.seen.find(e => e.name === 'map-load').detail === a.map, idle: window.seen.find(e => e.name === 'map-idle').detail};
    });
    check('browser: the attributes become the description', first.style === '/style.json' && JSON.stringify(first.initialView) === '{"center":[-74.0065,40.7085],"zoom":14}' && first.interactiveLayers.join() === 'dot,water' && first.hoverState === true && first.cursor === 'crosshair' && first.zoom === 14, JSON.stringify(first));
    check('browser: properties set before the element was defined are taken over, and a property wins over its attribute', first.layers === 1 && first.data && !first.own && first.minZoom === 3, JSON.stringify(first));
    check('browser: map-ready and map-load have the map as detail, map-idle has null, and the style loads once', first.startedFirst && first.ready && first.load && first.idle === null && first.names[0] === 'map-ready' && first.names.indexOf('map-load') < first.names.indexOf('map-idle') && first.names.filter(n => n === 'map-styleload').length === 1, JSON.stringify(first.names.slice(0, 6)));

    // One update for the changes of one task.
    const batch = await page.evaluate(async () => {
        const a = document.getElementById('a'), map = a.map, update = map.update;
        let calls = 0;
        map.update = spec => { calls++; return update(spec); };
        a.cursor = 'wait'; a.maxZoom = 18; a.globalState = {season: 'winter'}; a.setAttribute('color-scheme', 'dark');
        const sync = calls;
        await Promise.resolve(); await Promise.resolve();
        map.update = update;
        return {sync, calls, d: {cursor: map.description.cursor, maxZoom: map.description.maxZoom, season: map.description.globalState?.season, colorScheme: map.description.colorScheme}, dark: a.classList.contains('map-jr-dark')};
    });
    check('browser: four changes in one task give one update, one microtask later', batch.sync === 0 && batch.calls === 1 && batch.d.cursor === 'wait' && batch.d.maxZoom === 18 && batch.d.season === 'winter' && batch.d.colorScheme === 'dark' && batch.dark, JSON.stringify(batch));

    // A click on the point of the layer `dot`, which is in `interactive-layers`.
    await page.evaluate(() => { window.seen.length = 0; });
    await page.mouse.click(300, 200);
    await page.waitForFunction(() => window.seen.some(e => e.name === 'map-click'), null, {timeout: 10000}).catch(() => {});
    const click = await page.evaluate(() => window.seen.find(e => e.name === 'map-click'));
    check('browser: map-click bubbles to a listener on the document, added after the map started, with {point, lngLat, features}', click?.target === 'a' && Math.abs(click.detail.point.x - 300) < 1 && Math.abs(click.detail.lngLat[0] + 74.0065) < 0.001 && click.detail.features?.[0]?.layer?.id === 'dot', JSON.stringify(click && {point: click.detail.point, lngLat: click.detail.lngLat, layer: click.detail.features?.[0]?.layer?.id}));

    // A change of the attribute `zoom` moves the map; map-viewchange and map-moveend come with it.
    await page.evaluate(() => { window.seen.length = 0; document.getElementById('a').setAttribute('zoom', '12'); });
    await page.waitForFunction(() => window.seen.some(e => e.name === 'map-moveend'), null, {timeout: 20000}).catch(() => {});
    const moved = await page.evaluate(() => { const a = document.getElementById('a'), v = window.seen.filter(e => e.name === 'map-viewchange').at(-1); return {zoom: +a.state.get().view.zoom.toFixed(2), center: a.state.get().view.center.map(n => +n.toFixed(4)), view: v?.detail.zoom, moveend: window.seen.find(e => e.name === 'map-moveend')?.detail?.type}; });
    check('browser: a change of the attribute zoom moves the map, and keeps the center', moved.zoom === 12 && moved.center.join() === '-74.0065,40.7085', JSON.stringify(moved));
    check('browser: map-viewchange has the view and map-moveend the event of the map as detail', Math.abs(moved.view - 12) < 0.01 && moved.moveend === 'moveend', JSON.stringify(moved));

    // Moved in the page: the same map. Removed: the map goes.
    const removal = await page.evaluate(async () => {
        const a = document.getElementById('a'), map = a.map, box = document.createElement('div');
        document.body.append(box);
        box.append(a); // (removed and put back in one task)
        await Promise.resolve(); await Promise.resolve();
        const kept = a.map === map && !!a.querySelector(':scope > canvas');
        let removed = false;
        a.addEventListener('map-remove', () => { removed = true; });
        a.remove();
        const sync = a.map === map;
        await Promise.resolve(); await Promise.resolve();
        return {kept, sync, gone: a.map === null && a.state === null && !a.querySelector(':scope > canvas'), removed};
    });
    check('browser: an element that is moved keeps its map, and one that is removed destroys it one microtask later, with map-remove', removal.kept && removal.sync && removal.gone && removal.removed, JSON.stringify(removal));
    check('browser: no page errors on the page with attributes', !page.errors.length, page.errors.slice(0, 2).join(' | '));
    await page.close();

    // 4. Two elements on one page.
    page = await open('/two');
    await page.waitForFunction(() => window.seen.filter(e => e.name === 'map-load').length === 2, null, {timeout: 60000});
    const firstViews = await page.evaluate(() => window.seen.filter(e => e.name === 'map-viewchange').map(e => e.on).join());
    check('browser: each element reports its first view once with map-viewchange, before any move (#1135)', firstViews === 'a,b' || firstViews === 'b,a', firstViews);
    const two = await page.evaluate(async () => {
        const a = document.getElementById('a'), b = document.getElementById('b');
        window.seen.length = 0;
        a.setAttribute('zoom', '13');
        b.cursor = 'wait';
        await new Promise(r => setTimeout(r, 1500));
        return {different: a.map !== b.map, za: +a.state.get().view.zoom.toFixed(2), zb: +b.state.get().view.zoom.toFixed(2), cb: b.map.description.cursor, ca: a.map.description.cursor, views: [...new Set(window.seen.filter(e => e.name === 'map-viewchange').map(e => e.on + e.target))]};
    });
    check('browser: two elements on one page have two maps, and a change of one does not reach the other', two.different && two.za === 13 && two.zb === 10 && two.cb === 'wait' && two.ca === undefined && two.views.join() === 'aa', JSON.stringify(two));
    check('browser: no page errors with two elements', !page.errors.length, page.errors.slice(0, 2).join(' | '));
    await page.close();

    // 5. An element made by script; a listener added after the map is made.
    page = await open('/script');
    const scripted = await page.evaluate(async () => {
        const a = document.createElement('map-jr');
        a.style.cssText = 'width:400px;height:300px';
        a.mapStyle = '/style.json';
        a.initialView = {center: [-74.0065, 40.7085], zoom: 13};
        document.getElementById('box').append(a);
        a.layers = [{id: 'dot', type: 'circle', source: 'dot', paint: {'circle-radius': 5}}];
        a.data = {dot: {type: 'FeatureCollection', features: []}};
        const ready = await new Promise(r => a.addEventListener('map-ready', e => r(e.detail), {once: true}));
        const display = getComputedStyle(a).display, layers = ready.description.layers?.length;
        await new Promise(r => a.addEventListener('map-load', r, {once: true}));
        let moves = 0;
        a.addEventListener('map-moveend', () => moves++);
        a.map.moveTo({zoom: 12, duration: 0});
        await new Promise(r => setTimeout(r, 500));
        return {display, layers, moves, isElement: a instanceof window.Element_, defined: customElements.get('map-jr') === window.Element_};
    });
    check('browser: an element made by script is a block, gets its properties of the same task in its first description, and passes on an event whose listener came later', scripted.display === 'block' && scripted.layers === 1 && scripted.moves === 1 && scripted.isElement && scripted.defined, JSON.stringify(scripted));
    // A second import of the entry, and a second name with the exported class.
    const again = await page.evaluate(async () => {
        await import('/dist/element.js?again');
        customElements.define('city-map', class extends window.Element_ {});
        return customElements.get('map-jr') === window.Element_ && !!customElements.get('city-map');
    });
    check('browser: a second import of the entry does not define map-jr again, and the class defines another name', again && !page.errors.length, page.errors.slice(0, 2).join(' | '));
    // Errors: two GeoJSON sources whose URLs answer 404, for each way of listening to map-error.
    const errors = await page.evaluate(async () => {
        const logged = [], error = console.error;
        console.error = (...args) => { if (/^(Error: )?\[map-jr-gl\]/.test(String(args[0]))) logged.push(String(args[0])); return error(...args); };
        const run = async listen => {
            const a = document.createElement('map-jr');
            a.style.cssText = 'width:200px;height:150px';
            a.mapStyle = '/style.json';
            document.getElementById('box').append(a);
            await new Promise(r => a.addEventListener('map-load', r, {once: true}));
            let events = 0; const ids = [];
            const listener = e => { events++; ids.push(e.detail?.sourceId); if (listen === 'prevent') e.preventDefault(); };
            if (listen === 'once') a.addEventListener('map-error', listener, {once: true});
            if (listen === 'removed' || listen === 'prevent') a.addEventListener('map-error', listener);
            if (listen === 'removed') a.removeEventListener('map-error', listener);
            const before = logged.length, n = Math.random();
            a.sources = {m1: {type: 'geojson', data: '/missing-1.json?' + n}};
            await new Promise(r => setTimeout(r, 1500));
            a.sources = {m1: a.sources.m1, m2: {type: 'geojson', data: '/missing-2.json?' + n}};
            await new Promise(r => setTimeout(r, 1500));
            a.remove();
            return {events, ids, console: logged.length - before};
        };
        const out = {};
        for (const listen of ['none', 'once', 'removed', 'prevent']) out[listen] = await run(listen);
        console.error = error;
        return out;
    });
    check('browser: an error goes to the console unless a listener of map-error calls preventDefault(), also after a {once} listener has fired or a listener was removed',
        errors.none.events === 0 && errors.none.console === 2 && errors.once.events === 1 && errors.once.console === 2 && errors.removed.events === 0 && errors.removed.console === 2 && errors.prevent.events === 2 && errors.prevent.console === 0, JSON.stringify(errors));
    check('browser: the Error in the detail of map-error has the sourceId of the source that failed', errors.prevent.ids.join() === 'm1,m2', JSON.stringify(errors.prevent.ids));
    await page.close();

    // 6. The boolean attributes of #1258.
    const written = (await renderElement({style: 'http://127.0.0.1:1/s.json', interactive: false, antialias: true, attribution: {compact: true}}, {timeout: 1}).catch(() => '')).match(/^<map-jr[^>]*/)?.[0] ?? '';
    check('server: renderElement writes no-interactive, antialias and attribution-compact', written.includes(' no-interactive') && written.includes(' antialias') && written.includes(' attribution-compact') && !written.includes('no-attribution'), written);
    page = await open('/booleans');
    await page.waitForFunction(() => ['a', 'b'].every(id => document.getElementById(id).map?.state.get().loaded), null, {timeout: 60000});
    const fields = await page.evaluate(() => ['a', 'b'].map(id => { const d = document.getElementById(id).map.description; return {interactive: d.interactive, antialias: d.antialias, attribution: d.attribution}; }));
    check('browser: no-interactive, antialias, no-attribution and attribution-compact set their fields', JSON.stringify(fields) === JSON.stringify([{interactive: false, antialias: true, attribution: false}, {attribution: {compact: true}}]), JSON.stringify(fields));
    const centerOf = () => page.evaluate(() => JSON.stringify(document.getElementById('a').map.state.get().view.center));
    const c0 = await centerOf();
    await page.mouse.move(200, 150); await page.mouse.down(); await page.mouse.move(300, 220, {steps: 8}); await page.mouse.up();
    await page.waitForTimeout(300);
    check('browser: no-interactive turns the gestures off: a drag does not move the map', c0 === await centerOf(), c0);
    await page.close();

    // 7. The development build warns once for each attribute that cannot be read, and for an element with no style.
    page = await open('/dev');
    await page.waitForFunction(() => document.getElementById('a').map?.state.get().loaded, null, {timeout: 60000});
    await page.evaluate(() => { const a = document.getElementById('a'); a.cursor = 'wait'; a.removeAttribute('map-style'); setTimeout(() => { a.maxZoom = 18; }, 100); });
    await page.waitForTimeout(1500);
    const warned = page.warnings.filter(w => w.includes('<map-jr>'));
    const expected = ['center="Berlin"', 'zoom="near"', 'projection="flat"'];
    check('browser, development build: each attribute that cannot be read warns once, with what to write', expected.every(a => warned.filter(w => w.includes(`the attribute ${a} cannot be read`)).length === 1) && warned.some(w => w.includes('zoom="near" cannot be read, so the element ignores it. Write a number')),
        JSON.stringify(warned.map(w => w.slice(0, 110))));
    check('browser, development build: hover-state="false" and no-attribution="false" warn once each with the form to write, and the attributes take effect',
        warned.filter(w => w.includes('hover-state="false" switches the option on all the same') && w.includes('remove hover-state.')).length === 1 && warned.filter(w => w.includes('no-attribution="false" switches the option off')).length === 1
        && !warned.some(w => w.includes('hover-state="false" cannot be read')) && await page.evaluate(() => { const d = document.getElementById('a').map.description; return d.hoverState === true && d.attribution === false; }), JSON.stringify(warned.map(w => w.slice(0, 110))));
    check('browser, development build: an element with no style warns', warned.filter(w => w.includes('the element has no style')).length === 1, '');
    check('browser, development build: removing map-style from an element with a map warns once, and the map keeps its style', warned.filter(w => w.includes('"map-style" was removed')).length === 1 && await page.evaluate(() => document.getElementById('a').map.description.style === '/style.json'), '');
    await page.close();

    // 8. The controls in the first view of the server (#1396): the same places and look as the controls of the map.
    const desc = {style: origin + '/blank.json', initialView: {center: [7.4, 46.9], zoom: 9}, controls: controlList()};
    controlsPage = await renderElement(desc, {width: 600, height: 400, attributes: {id: 'a', style: 'width:600px;height:400px'}});
    check('server: renderElement puts the style sheet, the controls and the attribution into the first view', controlsPage.includes('<style data-map-jr-ssr=""') && ['zoom-in', 'compass', 'fullscreen', 'geolocate', 'globe', 'terrain', 'color-scheme'].every(n => controlsPage.includes(`map-jr-ctrl-${n} `)) && controlsPage.includes('map-jr-ctrl-scale') && controlsPage.includes('ctrl-attrib-inner'), `${(controlsPage.length / 1024).toFixed(1)} KB`);
    const png = async buffer => `data:image/png;base64,${buffer.toString('base64')}`;
    page = await open('/ssrc', {javaScriptEnabled: false});
    const shotServer = await page.locator('map-jr').screenshot();
    const dom = await page.evaluate(() => document.querySelector('map-jr').getBoundingClientRect().height);
    await page.close();
    page = await open('/ssrc');
    await page.waitForFunction(() => window.idle, null, {timeout: 60000});
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({svg: !!document.querySelector('[data-map-jr-ssr]'), style: !!document.querySelector('style[data-map-jr-ssr]'), buttons: document.querySelectorAll('map-jr button').length, frames: window.frames}));
    const shotMap = await page.locator('map-jr').screenshot();
    // Compare the corners of the two screenshots: the number of pixels that differ by more than 24 in a channel.
    const diff = await page.evaluate(async ([a, b]) => {
        const load = async src => { const img = new Image(); img.src = src; await img.decode(); const c = new OffscreenCanvas(img.width, img.height), x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
        const [one, two] = [await load(a), await load(b)], size = 200, out = {};
        const box = {'top-left': [0, 0], 'top-right': [one.width - size, 0], 'bottom-left': [0, one.height - size], 'bottom-right': [one.width - size, one.height - size]};
        for (const [name, [x0, y0]] of Object.entries(box)) {
            let n = 0, ink = 0; const at = [];
            for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) { const i = (y * one.width + x) * 4; if (Math.max(...[0, 1, 2].map(k => Math.abs(one.data[i + k] - two.data[i + k]))) > 24) { n++; if (at.length < 40) at.push(`${x},${y}:${one.data[i]}/${two.data[i]}`); } if (Math.abs(one.data[i] - 0xdd) > 24) ink++; }
            out[name] = {differ: n, ink, ...n > 20 && {at}};
        }
        return {size: [one.width, one.height, two.width, two.height], ...out};
    }, [await png(shotServer), await png(shotMap)]);
    // (DUMP=<prefix> writes both screenshots, to look at a difference.)
    if (process.env.DUMP) { const {writeFileSync} = await import('node:fs'); writeFileSync(process.env.DUMP + '-server.png', shotServer); writeFileSync(process.env.DUMP + '-map.png', shotMap); }
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    const frames = state.frames, shown = frames.filter(f => f.n === 1), at = new Set(shown.map(f => f.at));
    check('browser: the corners of the first view with controls and of the idle map are equal (up to 20 of the 40,000 pixels of each 200 by 200 corner)', corners.every(c => diff[c].differ <= 20) && diff['top-right'].ink > 500 && diff['bottom-right'].ink > 100 && diff['bottom-left'].ink > 100, JSON.stringify(diff));
    check('browser: the controls are visible in every frame from the page script on, once each (zoom in and out, compass, scale, fullscreen, geolocate, globe, terrain, colour scheme, attribution), and none of them moves', frames.length > 5 && frames.every(f => f.n === 1) && at.size === 1, JSON.stringify({frames: frames.length, none: frames.filter(f => f.n !== 1).length, missing: frames.find(f => f.n !== 1)?.missing, at: at.size}));
    check('browser: the attribution of the first view has its own width limit in each of two maps on one page', await (async () => {
        const long = {...desc, attribution: {compact: false, customAttribution: 'A long line of credits that needs more than three hundred pixels to fit on one line'}};
        const wide = await renderElement(long, {width: 900, height: 200, attributes: {id: 'w', style: 'width:900px;height:200px'}});
        const narrow = await renderElement(long, {width: 300, height: 200, attributes: {id: 'n', style: 'width:300px;height:200px'}});
        const two = await browser.newPage({viewport: {width: 1000, height: 600}, javaScriptEnabled: false});
        await two.setContent(`<body style="margin:0">${wide}${narrow}`);
        const widths = await two.evaluate(() => ['w', 'n'].map(id => Math.round(document.querySelector(`#${id} .map-jr-ctrl-attrib`).getBoundingClientRect().width)));
        await two.close();
        return widths[1] <= 283 && widths[0] > 400 ? true : (console.log(widths), false);
    })(), '');
    check('browser: in every frame the server picture is shown with the canvas hidden, or the canvas is shown with no picture: the canvas never draws over the picture',
        frames.some(f => f.svg) && frames.some(f => !f.svg) && frames.every(f => f.svg ? !f.canvas || f.hidden : f.canvas && !f.hidden), JSON.stringify({svg: frames.filter(f => f.svg).length, none: frames.filter(f => !f.svg).length, bad: frames.filter(f => f.svg ? f.canvas && !f.hidden : !f.canvas || f.hidden).length}));
    check('browser: the map removes the first view with its style sheet, and its own controls remain', !state.svg && !state.style && state.buttons >= 7 && !page.errors.length, JSON.stringify({...state, frames: undefined, errors: page.errors}));
    await page.close();
} catch (e) { check('the test run was completed', false, String(e.message).split('\n')[0]); }
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
