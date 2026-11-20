// Tests of the web component (`@map-jr/map-jr-gl/element`): the element <map-jr> in a browser, and the markup of
// `renderElement` from the server entry, which the element takes over.   node test/element.mjs   (after pnpm build)
import http from 'node:http';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {launch} from './launch.mjs';
import makeStyle from '../demo/style.mjs';
import {renderElement} from '../dist/server.js';

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
let ssrPage = '';
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x'), send = (body, type) => { res.writeHead(200, {'content-type': type}); res.end(body); };
    try {
        if (url.pathname === '/style.json') return send(JSON.stringify(style), 'application/json');
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
    check('server: the first view is the children of the element, with the layers and the data of the description', /<map-jr[^>]*><svg[^>]*data-map-jr-ssr/.test(ssrPage) && ssrPage.includes('#123456') && ssrPage.endsWith('</map-jr>'), `${(ssrPage.length / 1024).toFixed(0)} KB`);
    let thrown = '';
    try { await renderElement(description, {attributes: {'on click': 'x'}}); } catch (e) { thrown = e.message; }
    check('server: an attribute name that is not one throws a message', thrown.startsWith('[map-jr-gl] renderElement(): "on click"'), thrown);
    thrown = '';
    try { await renderElement(description, {attributes: {onload: 'alert(1)'}}); } catch (e) { thrown = e.message; }
    check('server: an event handler attribute throws a message', thrown.includes('"onload" is not the name of an attribute that the element can have'), thrown);
    const logged = [], error = console.error;
    console.error = m => logged.push(m);
    const failedRender = await renderElement({style: 'http://127.0.0.1:1/style.json', initialView: {zoom: 2}}, {timeout: 3000}).finally(() => { console.error = error; });
    check('server: a render that fails gives the element without the first view, and one message', failedRender.startsWith('<map-jr ') && !failedRender.includes('<svg') && logged.length === 1 && logged[0].startsWith('[map-jr-gl] renderElement():'), failedRender.slice(0, 120) + ' | ' + String(logged[0]).slice(0, 120));

    // 2. The markup of the server in a browser: shown without scripts, then the element takes it over.
    let page = await open('/ssr', {javaScriptEnabled: false});
    const before = await page.evaluate(() => ({svg: !!document.querySelector('map-jr > svg[data-map-jr-ssr]'), height: document.querySelector('map-jr').getBoundingClientRect().height, after: Math.round(document.getElementById('after').getBoundingClientRect().top)}));
    await page.close();
    page = await open('/ssr');
    const early = await page.evaluate(() => !!document.querySelector('map-jr > svg[data-map-jr-ssr]'));
    await page.waitForFunction(() => window.seen.includes('load'), null, {timeout: 60000});
    await page.waitForTimeout(500);
    const late = await page.evaluate(() => { const a = document.querySelector('map-jr'); return {svg: !!a.querySelector('[data-map-jr-ssr]'), canvas: !!a.querySelector(':scope > canvas'), layers: a.map.description.layers?.length, hover: a.map.description.hoverState, projection: a.map.description.projection, after: Math.round(document.getElementById('after').getBoundingClientRect().top)}; });
    check('browser: the first view of renderElement shows without scripts, at the size of the element', before.svg && before.height === 400, JSON.stringify(before));
    check('browser: the element takes over the markup of the server: the map removes the first view after its first frame, and nothing moves', early && !late.svg && late.canvas && late.layers === 1 && late.hover === true && late.projection?.type === 'globe' && late.after === before.after && !page.errors.length, JSON.stringify({early, late, errors: page.errors}));
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
        console.error = (...args) => { if (String(args[0]).startsWith('[map-jr-gl]')) logged.push(String(args[0])); return error(...args); };
        const run = async listen => {
            const a = document.createElement('map-jr');
            a.style.cssText = 'width:200px;height:150px';
            a.mapStyle = '/style.json';
            document.getElementById('box').append(a);
            await new Promise(r => a.addEventListener('map-load', r, {once: true}));
            let events = 0;
            const listener = e => { events++; if (listen === 'prevent') e.preventDefault(); };
            if (listen === 'once') a.addEventListener('map-error', listener, {once: true});
            if (listen === 'removed' || listen === 'prevent') a.addEventListener('map-error', listener);
            if (listen === 'removed') a.removeEventListener('map-error', listener);
            const before = logged.length, n = Math.random();
            a.sources = {m1: {type: 'geojson', data: '/missing-1.json?' + n}};
            await new Promise(r => setTimeout(r, 1500));
            a.sources = {m1: a.sources.m1, m2: {type: 'geojson', data: '/missing-2.json?' + n}};
            await new Promise(r => setTimeout(r, 1500));
            a.remove();
            return {events, console: logged.length - before};
        };
        const out = {};
        for (const listen of ['none', 'once', 'removed', 'prevent']) out[listen] = await run(listen);
        console.error = error;
        return out;
    });
    check('browser: an error goes to the console unless a listener of map-error calls preventDefault(), also after a {once} listener has fired or a listener was removed',
        errors.none.events === 0 && errors.none.console === 2 && errors.once.events === 1 && errors.once.console === 2 && errors.removed.events === 0 && errors.removed.console === 2 && errors.prevent.events === 2 && errors.prevent.console === 0, JSON.stringify(errors));
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
} catch (e) { check('the test run was completed', false, String(e.message).split('\n')[0]); }
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
