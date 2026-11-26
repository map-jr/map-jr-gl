// Tests of the main API (`createMap`, see src/host.ts) in a real browser: node test/host.mjs (demo server running)
import {launch, browserName, workerRenders, inWorker, noWorkerRender} from './launch.mjs';
import {watchdog} from './watchdog.mjs';
import {guard} from './suite-guard.mjs';
import {solidPNG} from './png.mjs';

const browser = await launch();
const origin = `http://localhost:${process.env.PORT || 8080}`; // (the demo server; PORT lets two runs use two servers)
let failed = 0;
// TIMINGS=1 prints, before each check, the seconds since the previous check (to find the slow ones).
let lastCheck = performance.now();
const check = (name, ok, detail = '') => {
    const s = process.env.TIMINGS ? `[${((performance.now() - lastCheck) / 1000).toFixed(1)} s] ` : '';
    lastCheck = performance.now();
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${name} ${detail}`); if (!ok) failed++;
    counted(); finished(name);
};
const finished = watchdog(browser, message => { console.log(`FAIL  ${message}`); failed++; });
const {counted, tally} = guard(message => { console.log(`FAIL  ${message}`); failed++; });
// A check that cannot run in this browser prints SKIP with the reason; it is neither passed nor failed.
const skip = (name, reason) => { console.log(`SKIP  ${name} (${reason})`); counted(); finished(name); };
// Touch events through a CDP session (newCDPSession) exist in Chromium only.
const cdpTouch = browserName === 'chromium', noCDP = `${browserName} has no CDP session for touch events`;

// RENDERER=main or RENDERER=worker runs the checks of one renderer, and CI runs each in its own job (#519). The checks
// after the first loop run with RENDERER=main. Without the variable the suite runs everything.
const only = process.env.RENDERER;
if (only && only !== 'main' && only !== 'worker') { console.log(`FAIL  RENDERER is "${only}". Write RENDERER=main or RENDERER=worker, or leave it out.`); process.exit(1); }
const renderers = only ? [only] : ['worker', 'main'];
for (const renderer of renderers) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    // CPU_THROTTLE=4 slows the CPU of the page four times (Chromium only), as a loaded CI runner does (#532).
    if (process.env.CPU_THROTTLE) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', {rate: Number(process.env.CPU_THROTTLE)});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
        await page.goto(`${origin}/bench`); // (a page of the demo server, for its origin; the benchmark does not start)
        // 1. A map from a description, and its state.
        const start = await page.evaluate(async renderer => {
            // (The development build: it has the checks for common mistakes. The production build is tested at the end.)
            const lib = await import('/dist/map-jr-gl.dev.js'), style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'host', style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const t = window.t = {lib, style, views: [], seen: [], clicks: []};
            t.spec = {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false, onViewChange: v => t.views.push(v)};
            t.host = lib.createMap(el, t.spec);
            t.sync = t.views.length; // (the first view comes after createMap returns)
            t.host.state.subscribe(s => s.loaded, loaded => t.seen.push('loaded:' + loaded));
            t.host.state.subscribe(s => s.view.zoom, zoom => t.seen.push('zoom'));
            t.host.listen('load', () => t.seen.push('load:idle=' + t.host.state.get().idle));
            t.host.listen('idle', () => t.seen.push('idle'));
            const before = t.host.state.get();
            await new Promise(r => t.host.state.subscribe(s => s.idle, idle => idle && r()));
            const s = t.host.state.get();
            return {before: before.loaded, loaded: s.loaded, renderer: s.renderer, zoom: s.view.zoom, seen: t.seen, canvas: !!el.querySelector('canvas')};
        }, renderer);
        check(`[${renderer}] createMap: the map loads, and the state says so`, !start.before && start.loaded && (start.renderer === renderer || (renderer === 'worker' && start.renderer === 'main' /* a browser that cannot draw in a worker */)) && start.zoom === 14.3 && start.seen.includes('loaded:true') && start.seen.indexOf('load:idle=false') >= 0 && start.seen.indexOf('load:idle=false') < start.seen.indexOf('idle') && start.canvas, JSON.stringify(start));

        // 1a. The first view is reported once, after createMap returns, and giving it back to `view` moves nothing (#1135).
        const first = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), moves = [];
            const stop = t.host.listen('move', () => moves.push(1));
            const views = t.views.length, v = t.views[0];
            t.host.update({...t.spec, view: v});
            await wait(300);
            stop();
            t.host.update(t.spec); // (the later steps do not own the view)
            return {sync: t.sync, views, zoom: v?.zoom, center: v?.center, bounds: !!v?.bounds, moves: moves.length, after: t.views.length};
        });
        check(`[${renderer}] onViewChange: the first view is reported once, after createMap returns, and giving it back moves nothing`,
            first.sync === 0 && first.views === 1 && first.zoom === 14.3 && first.bounds && first.moves === 0 && first.after === 1, JSON.stringify(first));

        // 1b. once: a promise of the next event; `load` on a loaded map resolves at once.
        const once = await page.evaluate(async () => {
            const h = window.t.host, within = (p, ms) => Promise.race([p.then(e => e.type), new Promise(r => setTimeout(() => r('not settled'), ms))]);
            const load = await within(h.once('load'), 200);
            const moveend = h.once('moveend');
            h.moveTo({zoom: 14.5});
            const moved = await within(moveend, 3000), zoom = h.state.get().view.zoom;
            h.moveTo({zoom: 14.3});
            return {load, moved, zoom};
        });
        check(`[${renderer}] once: resolves with the next event, and once('load') on a loaded map resolves at once`, once.load === 'load' && once.moved === 'moveend' && once.zoom === 14.5, JSON.stringify(once));

        // 1b2. A map in a `display: none` container fires `load` and `idle`, as in MapLibre GL JS, and `display: block`
        // later draws it and fires `idle` again (#964).
        const hidden = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'display:none;width:300px;height:200px'}));
            const h = t.lib.createMap(el, {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false});
            const within = (p, ms) => Promise.race([p.then(() => true), new Promise(r => setTimeout(() => r(false), ms))]);
            const idle = await within(h.once('idle'), 10000);
            el.style.display = 'block';
            const shown = await within(h.once('idle'), 10000), c = el.querySelector('canvas'), out = {idle, shown, width: c.width, want: Math.round(300 * devicePixelRatio)};
            h.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] a map in a display:none container fires idle, and draws once shown (#964)`, hidden.idle && hidden.shown && hidden.width === hidden.want, JSON.stringify(hidden));
        // raster-fade-duration in the main entry: a raster layer that gives none shows its tiles at once (the compat entry
        // fades them in over 300 ms, as MapLibre GL JS does), and a style that sets it fades them in (#1694). The check
        // counts the frames from the answer of the held tile to `idle`: a tile that shows at once takes a few (5 on 2026-11-24), and
        // a fade draws a frame for each step. (A time to `idle` alone says little on the worker renderer, where a loaded
        // CI runner needs more than a second also without a fade.) A tile at the edge of the view fades in over nothing.
        const fades = await page.evaluate(async renderer => {
            const t = window.t, out = {};
            for (const fade of [undefined, 1500]) {
                let release; const held = new Promise(r => release = r), name = 'fade1694h' + (fade ?? 'none');
                t.lib.addProtocol(name, async () => {
                    await held;
                    const c = Object.assign(document.createElement('canvas'), {width: 64, height: 64}); c.getContext('2d').fillRect(0, 0, 64, 64);
                    return {data: await createImageBitmap(c)};
                });
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
                const layer = {id: 'r', type: 'raster', source: 'r', ...(fade !== undefined && {paint: {'raster-fade-duration': fade}})};
                const h = t.lib.createMap(el, {style: {version: 8, sources: {r: {type: 'raster', tiles: [name + '://{z}/{x}/{y}'], tileSize: 256}}, layers: [layer]}, initialView: {center: [10, 10], zoom: 0}, renderer, attribution: false});
                await new Promise(r => setTimeout(r, 500)); // (`load` waits for the held tile)
                let frames = 0;
                const stop = h.listen('render', () => frames++);
                const idle = Promise.race([h.once('idle'), new Promise(r => setTimeout(r, 8000))]), t0 = performance.now();
                release();
                await idle;
                stop();
                out[fade ?? 'none'] = {frames, ms: Math.round(performance.now() - t0)};
                h.destroy(); el.remove(); t.lib.removeProtocol(name);
            }
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] raster-fade-duration: in the main entry a raster layer that gives none shows a tile at once, and one that sets it fades the tile in (#1694)`,
            fades.none?.frames <= 10 && fades[1500]?.frames >= 20 && fades[1500].ms >= 1400, JSON.stringify(fades));

        // 1c. The events of `listen` and `once` (#500): positions as `[lng, lat]`, a box as `[[west, south], [east, north]]`,
        // the host as `target`, and `preventDefault()` still stops what the map does.
        await page.evaluate(() => {
            const t = window.t, h = t.host, pair = v => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number');
            t.shapes = {};
            t.stops = ['mousemove', 'touchstart', 'boxzoomend'].map(type => h.listen(type, e => { t.shapes[type] ??= {target: e.target === h, lngLat: pair(e.lngLat), lngLats: e.lngLats && e.lngLats.length > 0 && e.lngLats.every(pair), box: e.boxZoomBounds && e.boxZoomBounds.length === 2 && e.boxZoomBounds.every(pair) && e.boxZoomBounds[0][0] < e.boxZoomBounds[1][0]}; }));
            t.clickOnce = h.once('click').then(e => ({target: e.target === h, lngLat: pair(e.lngLat), prevent: typeof e.preventDefault}));
        });
        await page.mouse.move(400, 300); await page.mouse.move(420, 310); await page.mouse.click(420, 310);
        await page.evaluate(() => { const c = document.querySelector('#host canvas'), o = {pointerType: 'touch', pointerId: 7, clientX: 300, clientY: 300, bubbles: true, isPrimary: true};
            c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); });
        await page.keyboard.down('Shift'); await page.mouse.move(300, 200); await page.mouse.down(); await page.mouse.move(500, 400, {steps: 6}); await page.mouse.up(); await page.keyboard.up('Shift');
        await page.waitForTimeout(800);
        const shapes = await page.evaluate(async () => ({...window.t.shapes, click: await window.t.clickOnce}));
        check(`[${renderer}] listen and once: lngLat, lngLats and boxZoomBounds are arrays, and target is the host`,
            shapes.mousemove?.target && shapes.mousemove.lngLat && shapes.touchstart?.target && shapes.touchstart.lngLat && shapes.touchstart.lngLats && shapes.boxzoomend?.target && shapes.boxzoomend.box && shapes.click.target && shapes.click.lngLat && shapes.click.prevent === 'function', JSON.stringify(shapes));
        // (The box zoom ends with an animated fit: wait until the map no longer moves, or a slow machine reads `before` mid-fit, #532.)
        await page.evaluate(async () => { const t = window.t; t.stops.forEach(f => f());
            for (let i = 0, last = ''; i < 100; i++) { const s = t.host.state.get(), now = s.view.center.join(); if (!s.moving && now === last) break; last = now; await new Promise(r => setTimeout(r, 100)); }
            t.before = t.host.state.get().view.center;
            t.stops = [t.host.listen('mousedown', e => e.preventDefault())]; });
        await page.mouse.move(450, 300); await page.mouse.down(); await page.mouse.move(600, 400, {steps: 8}); await page.mouse.up(); await page.waitForTimeout(300);
        const held = await page.evaluate(() => { const t = window.t; t.stops.forEach(f => f()); const now = t.host.state.get().view.center; return {before: t.before, now}; });
        check(`[${renderer}] listen: preventDefault() of a mousedown stops the drag`, held.before[0] === held.now[0] && held.before[1] === held.now[1], JSON.stringify(held));

        // 2. The view: the map reports each change; a view that it reported is not applied again; another view moves the map.
        const view = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            t.host.moveTo({zoom: 15, duration: 300});
            for (let i = 0; i < 100 && !(Math.abs(t.host.state.get().view.zoom - 15) < 1e-6 && !t.host.state.get().moving); i++) await wait(100); // (a slow machine)
            await wait(300);
            const reported = t.views.length, last = t.views.at(-1), old = t.views.at(-2); // (an intermediate view of the latest movement)
            const warned = [], warn = console.warn; console.warn = (...a) => warned.push(a.join(' '));
            const said = () => warned.filter(w => w.includes('update(): "view" is a view that the map reported earlier') && w.includes('moveTo(view)')).length;
            t.host.update(t.spec = {...t.spec, view: old}); // a late echo: a view of the latest movement, passed after its end
            await wait(300);
            const afterEcho = t.host.state.get().view.zoom, echoSaid = said();
            // A view of an earlier movement is a stored view: the map ignores it and warns once.
            t.host.moveTo({zoom: 14.5, duration: 300});
            for (let i = 0; i < 100 && !(Math.abs(t.host.state.get().view.zoom - 14.5) < 1e-6 && !t.host.state.get().moving); i++) await wait(100);
            await wait(300);
            t.host.update(t.spec = {...t.spec, view: last});
            await wait(300);
            t.host.update(t.spec = {...t.spec, view: last});
            await wait(100);
            const storedSaid = said(), stored = t.host.state.get().view.zoom;
            console.warn = warn;
            t.host.update(t.spec = {...t.spec, view: {center: [-74.0, 40.71], zoom: 13.5, bearing: 20, pitch: 0}});
            for (let i = 0; i < 80 && t.host.state.get().view.zoom !== 13.5; i++) await wait(100); // (a slow machine)
            await wait(300);
            const s = t.host.state.get().view;
            return {reported, last: last?.zoom, afterEcho, echoSaid, storedSaid, stored, moved: [s.zoom, s.bearing, +s.center[0].toFixed(3)], zoomEvents: t.seen.filter(x => x === 'zoom').length};
        });
        check(`[${renderer}] the view: changes are reported, a reported view is not applied again and warns once in the development build for a stored view and not for a late echo (#1190), a new view moves the map`,
            view.reported >= 2 && view.last === 15 && view.afterEcho === 15 && view.echoSaid === 0 && view.storedSaid === 1 && view.stored === 14.5 && view.moved.join() === '13.5,20,-74' && view.zoomEvents >= 2, JSON.stringify(view));

        // 2a. moveTo with `fly` (#43) zooms out and back in on the way, as flyTo of MapLibre GL JS. (For these 1650 pixels
        // at zoom 13.5 in a view of 900 pixels, the curve goes down by 1.07 zoom levels; the state sees some frames of it.)
        const fly = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            // (The new view of check 2 can still be moving on a slow machine, and its end would replace the flight, #532.)
            for (let i = 0, last = ''; i < 100; i++) { const s = t.host.state.get(), now = s.view.center.join() + s.view.zoom; if (!s.moving && now === last) break; last = now; await wait(100); }
            const start = t.host.state.get().view;
            let low = 99;
            const off = t.host.state.subscribe(s => s.view.zoom, z => { low = Math.min(low, z); });
            t.host.moveTo({center: [-73.9, 40.75], zoom: start.zoom, fly: {speed: 0.6}});
            // (The state sees the flight when the engine has drawn its first frame, which on a slow machine without a GPU comes
            // more than 200 ms after the command: wait for the start, as for the end, and report how long it took, #1335.)
            const began = performance.now();
            for (let i = 0; i < 250 && !t.host.state.get().moving; i++) await wait(20);
            const first = Math.round(performance.now() - began);
            for (let i = 0; i < 100 && t.host.state.get().moving; i++) await wait(100);
            off();
            const end = t.host.state.get().view;
            t.host.moveTo({center: start.center, zoom: start.zoom});
            return {low, start: start.zoom, end: [+end.center[0].toFixed(3), end.zoom], first};
        });
        check(`[${renderer}] moveTo with fly zooms out on the way and ends at the view (#43)`,
            fly.low < fly.start - 0.5 && fly.end[0] === -73.9 && fly.end[1] === fly.start, JSON.stringify(fly));

        // 2b. Padding per side (#212): fitBounds and moveTo with bounds take {top, right, bottom, left} as fitPadding for the fit, and
        // the description has the padding of the map. moveTo leaves the padding of the map as the description gave it (#501).
        const padding = await page.evaluate(async () => {
            const t = window.t, m = t.host._map, b = [[-74.02, 40.70], [-74.00, 40.72]], mid = [-74.01, 40.71];
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const at = () => { const p = m.project(mid); return [Math.round(p.x), Math.round(p.y)]; };
            const warned = [], warn = console.warn;
            console.warn = (...a) => warned.push(a.join(' '));
            t.host.fitBounds(b, {fitPadding: {left: 400, top: 10, right: 10, bottom: 10}, duration: 0});
            const fit = at();
            t.host.moveTo({center: mid, fitPadding: {left: 300}});
            const ignored = at();
            await wait(300);
            t.host.update({...t.spec, padding: {right: 300}});
            const spec = at();
            t.host.moveTo({bounds: b, fitPadding: {left: 400, top: 10, right: 10, bottom: 10}, bearing: 20, pitch: 30});
            // (The state store follows the engine, which reports a jump with its next frame: that frame comes more than 300 ms
            // after the command on a slow machine without a GPU, #1335. Wait for the view that was asked for.)
            const asked = performance.now();
            for (let i = 0; i < 250 && !(Math.round(t.host.state.get().view.bearing) === 20 && Math.round(t.host.state.get().view.pitch) === 30); i++) await wait(20);
            const v = t.host.state.get().view, bounds = {bearing: Math.round(v.bearing), pitch: Math.round(v.pitch), first: Math.round(performance.now() - asked)};
            t.host.moveTo({center: mid, bearing: 0, pitch: 0});
            const kept = at();
            t.host.update({...t.spec, padding: {right: 300}});
            const same = at();
            t.host.moveTo({bounds: b, fitPadding: 20, fly: true, duration: 300});
            await wait(200);
            for (let i = 0; i < 50 && t.host.state.get().moving; i++) await wait(100);
            const flown = at();
            const {fitBounds} = t.host;
            let detached = 'ok';
            try { fitBounds(b, {duration: 0}); } catch (e) { detached = e.message; }
            t.host.update({...t.spec, padding: 0});
            const cleared = at();
            t.host.moveTo({center: mid});
            console.warn = warn;
            const {width: w, height: h} = document.getElementById('host').getBoundingClientRect();
            return {w, h, fit, ignored, spec, bounds, kept, same, flown, cleared: at(), detached, warned: warned.filter(w => w.includes('moveTo()')).length};
        });
        // (The container is w × h, 900 × 600 where the page has no scroll bars; Firefox on macOS makes it 14 px smaller (#774).
        // The centre of the rest of the map is at x = 400 + (w - 410) / 2 (645), w / 2 with no padding (450), and (w - 300) / 2
        // with the padding {right: 300} of the description (300), also for the fly, whose y is h / 2.)
        const P = padding, near = (a, b) => Math.abs(a - b) <= 2, half = P.w / 2, rest = (P.w - 300) / 2;
        check(`[${renderer}] padding per side: fitBounds takes {top, right, bottom, left}, and padding of the description moves the centre`,
            near(P.fit[0], 400 + (P.w - 410) / 2) && near(P.spec[0], rest) && near(P.cleared[0], half), JSON.stringify(padding));
        // 2c. The first fit of initialView.bounds keeps the padding of the description free, as moveTo does (#1162).
        const firstFit = await page.evaluate(async renderer => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:900px;height:400px'}));
            const bounds = [[-75, 40.70], [-73, 40.72]]; // (wide, so that the width limits the zoom)
            const h = t.lib.createMap(el, {style: t.style, padding: {left: 320}, initialView: {bounds, fitPadding: 40}, renderer, attribution: false});
            await wait(300);
            const first = h._map.getZoom();
            h.moveTo({bounds, fitPadding: 40});
            await wait(300);
            const later = h._map.getZoom();
            h.destroy(); el.remove();
            return {first, later};
        }, renderer);
        check(`[${renderer}] initialView.bounds is fitted into the part that the padding of the description leaves free (#1162)`,
            Math.abs(firstFit.first - firstFit.later) < 1e-6, JSON.stringify(firstFit));
        // 2c. After a lost WebGL context, the new engine has the padding of the description (#1050). The camera that the
        // engine reports after a move carries its padding.
        if (renderer === 'main') {
            const restarted = await page.evaluate(async () => {
                const t = window.t, until = (m, type) => new Promise(r => { m.once(type, r); setTimeout(r, 15000); });
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
                const h = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, padding: {left: 50}, initialView: {center: [10, 45], zoom: 2}, renderer: 'main', attribution: false});
                const m = h._map;
                await until(m, 'idle');
                const before = m.tr.padding.join();
                const restored = until(m, 'webglcontextrestored');
                m.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
                await restored;
                await until(m, 'idle');
                const moved = until(m, 'moveend');
                m.easeTo({zoom: 4, duration: 50});
                await moved;
                const after = m.tr.padding.join();
                h.destroy(); el.remove();
                return {before, after};
            });
            check('[main] after a lost WebGL context, the padding of the description stays (#1050)',
                restarted.before === '0,0,0,50' && restarted.after === '0,0,0,50', JSON.stringify(restarted));
        }
        // 2c. A view in the URL overrides initialView.bounds as it overrides center and zoom (#1157).
        const urlView = await page.evaluate(async renderer => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const before = location.href;
            history.replaceState(history.state, '', '#11/40.7/-74.0');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:900px;height:400px'}));
            const h = t.lib.createMap(el, {style: t.style, hash: true, initialView: {bounds: [[7, 45], [9, 47]]}, renderer, attribution: false});
            await wait(300);
            const out = {zoom: h._map.getZoom(), lng: h._map.getCenter().lng};
            h.destroy(); el.remove();
            history.replaceState(history.state, '', before);
            return out;
        }, renderer);
        check(`[${renderer}] a view in the URL overrides initialView.bounds (#1157)`,
            Math.abs(urlView.zoom - 11) < 1e-6 && Math.abs(urlView.lng + 74) < 1e-3, JSON.stringify(urlView));
        check(`[${renderer}] moveTo leaves the padding of the map as the description gave it, and fitPadding without bounds warns once (#501)`,
            near(P.ignored[0], half) && near(P.ignored[1], P.h / 2) && near(P.kept[0], rest) && near(P.same[0], rest) && P.warned === 1, JSON.stringify(padding));
        check(`[${renderer}] moveTo with bounds fits the box with its padding, with bearing and pitch, and with fly, and a destructured fitBounds works (#501)`,
            padding.bounds.bearing === 20 && padding.bounds.pitch === 30 && near(P.flown[0], rest) && near(P.flown[1], P.h / 2) && padding.detached === 'ok', JSON.stringify(padding));

        // 2c. fitBounds jumps by default like moveTo, and animates with a duration (#1154).
        const fitJump = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const zoom = () => t.host._map.getZoom(); // (the state store follows the map a frame later)
            t.host.moveTo({center: [-74.01, 40.71], zoom: 3});
            t.host.fitBounds([[-74.02, 40.70], [-74.00, 40.72]]);
            const jumped = zoom();
            t.host.moveTo({center: [-74.01, 40.71], zoom: 3});
            t.host.fitBounds([[-74.02, 40.70], [-74.00, 40.72]], {duration: 800});
            // (The engine reports the move with its first frame, which on a slow machine without a GPU comes more than 150 ms
            // after the command, while the animation runs from the command. Read the view at that first report, and not at a fixed
            // time. A read that comes too early fails this check, and the animation that goes on is then cancelled by the padding
            // of an update() of check 3, so that four more checks run with the map at zoom 3, #1335.)
            const began = performance.now();
            for (let i = 0; i < 250 && !t.host.state.get().moving; i++) await wait(20);
            const first = Math.round(performance.now() - began), during = zoom(), moving = t.host.state.get().moving;
            for (let i = 0; i < 50 && t.host.state.get().moving; i++) await wait(100);
            return {jumped, during, moving, end: zoom(), first};
        });
        check(`[${renderer}] fitBounds jumps without a duration and animates with duration 800 (#1154)`,
            fitJump.jumped > 12 && fitJump.moving && fitJump.during < fitJump.jumped - 1 && Math.abs(fitJump.end - fitJump.jumped) < 0.25, JSON.stringify(fitJump));

        // 2d. update() with the padding going from 0 to unset is no change, and does not cancel a running animation (#1351).
        const padKept = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            t.host.update({...t.spec, padding: 0});
            t.host.moveTo({center: [-74.01, 40.71], zoom: 3});
            t.host.fitBounds([[-74.02, 40.70], [-74.00, 40.72]], {duration: 800});
            const began = performance.now();
            for (let i = 0; i < 250 && !t.host.state.get().moving; i++) await wait(20);
            const first = Math.round(performance.now() - began), atFirst = t.host._map.getZoom();
            t.host.update({...t.spec});
            for (let i = 0; i < 50 && t.host.state.get().moving; i++) await wait(100);
            const end = t.host._map.getZoom();
            // (When this check fails, the map is put at the view that the fitBounds should have reached, so that the checks
            // after it do not run at zoom 3 and fail too: four checks of the worker renderer failed with this one, #1418.)
            if (end <= 12) t.host.fitBounds([[-74.02, 40.70], [-74.00, 40.72]]);
            return {end, first, atFirst, moving: t.host.state.get().moving};
        });
        check(`[${renderer}] update() with padding from 0 to unset does not cancel a running fitBounds (#1351)`, padKept.end > 12, JSON.stringify(padKept));

        // 3. A new style object: a layer is added and found by a query; with the old style again it is gone.
        const style = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const idle = () => new Promise(r => { let at = t.host.state.get().idle ? performance.now() : 0; const off = t.host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const at = [{x: 0, y: 0}, {x: 900, y: 600}];
            const added = {...t.style, layers: [...t.style.layers, {id: 'test-water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': '#f00'}}]};
            t.host.update(t.spec = {...t.spec, style: added});
            await wait(200); await idle();
            const withLayer = (await t.host.queryFeatures(at, {layers: ['test-water']})).length;
            // One filter and one paint value of a layer of a new style object: edits, and no new style (#858).
            let loads = 0;
            const count = () => loads++, map = t.host._map;
            map.on('style.load', count);
            const edited = {...added, layers: added.layers.map(l => l.id === 'test-water' ? {...l, filter: ['==', ['get', 'class'], 'no-such-class'], paint: {'fill-color': '#00f'}} : l)};
            t.host.update(t.spec = {...t.spec, style: edited});
            await wait(200); await idle();
            const live = map.getStyle().layers.find(l => l.id === 'test-water');
            const inPlace = {loads, filtered: (await t.host.queryFeatures(at, {layers: ['test-water']})).length, color: live?.paint?.['fill-color'], filter: JSON.stringify(live?.filter)};
            // A new order of the layers of the style object, and a new layer before one that stays: moves, and no new style (#875).
            const two = {...edited, layers: [...edited.layers, {id: 'test-water-2', type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': '#0f0'}}]};
            t.host.update(t.spec = {...t.spec, style: two});
            await wait(200); await idle();
            const ids = () => map.getStyle().layers.map(l => l.id).filter(id => id.startsWith('test-water')).join();
            const n = two.layers.length, swapped = {...two, layers: [...two.layers.slice(0, n - 2), two.layers[n - 1], {...two.layers[n - 2], filter: undefined}]};
            t.host.update(t.spec = {...t.spec, style: swapped});
            await wait(200); await idle();
            const swapOrder = ids(), swapTop = (await t.host.queryFeatures(at, {layers: ['test-water', 'test-water-2']}))[0]?.layer?.id;
            const front = {...swapped, layers: [...swapped.layers.slice(0, n - 2), {id: 'test-water-0', type: 'fill', source: 'omt', 'source-layer': 'water'}, ...swapped.layers.slice(n - 2)]};
            t.host.update(t.spec = {...t.spec, style: front});
            await wait(200); await idle();
            inPlace.moves = {swapOrder, swapTop, frontOrder: ids(), loads};
            map.off('style.load', count);
            t.host.update(t.spec = {...t.spec, style: t.style});
            await wait(200); await idle();
            const without = (await t.host.queryFeatures(at, {layers: ['test-water']})).length;
            const raw = (await t.host.querySource('omt', {x: 450, y: 300}, {radius: 30})).length;
            return {withLayer, without, raw, inPlace};
        });
        check(`[${renderer}] update with a new style: a layer comes and goes, and queries find features`, style.withLayer > 0 && style.without === 0 && style.raw > 0, JSON.stringify(style));

        // A new order of the layers of `layers`, and a new layer before one that stays: the map moves and adds the layers
        // and loads no style (#859).
        const order = await page.evaluate(async () => {
            const t = window.t, map = t.host._map, wait = ms => new Promise(r => setTimeout(r, ms)), box = [{x: 0, y: 0}, {x: 900, y: 600}];
            const fill = (id, color) => ({id, type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': color}});
            const ours = () => map.getStyle().layers.map(l => l.id).filter(id => id.startsWith('o-')).join();
            const top = async () => (await t.host.queryFeatures(box, {layers: ['o-a', 'o-b', 'o-c']}))[0]?.layer?.id;
            const base = t.spec.layers ?? [];
            t.host.update(t.spec = {...t.spec, layers: [...base, fill('o-a', '#f00'), fill('o-b', '#00f')]});
            await wait(1200);
            const first = {order: ours(), top: await top()};
            let loads = 0;
            const count = () => loads++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, layers: [...base, fill('o-b', '#00f'), fill('o-a', '#f00')]});
            await wait(1200);
            const swapped = {order: ours(), top: await top()};
            t.host.update(t.spec = {...t.spec, layers: [...base, fill('o-c', '#0f0'), fill('o-b', '#00f'), fill('o-a', '#f00')]});
            await wait(1200);
            const inserted = {order: ours(), top: await top()};
            map.off('style.load', count);
            t.host.update(t.spec = {...t.spec, layers: base});
            await wait(800);
            return {first, swapped, inserted, loads, gone: ours()};
        });
        check(`[${renderer}] update with a new order of layers, and with a new layer before one that stays: the map draws the new order and loads no style (#859)`,
            order.first.order === 'o-a,o-b' && order.first.top === 'o-b' && order.swapped.order === 'o-b,o-a' && order.swapped.top === 'o-a'
            && order.inserted.order === 'o-c,o-b,o-a' && order.inserted.top === 'o-a' && order.loads === 0 && order.gone === '', JSON.stringify(order));
        // A new order of the layers of the style object changes only the draw order: no tile is built or loaded again (#961).
        const reorder = await page.evaluate(async renderer => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), steps = {}, style = t.style;
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:900px;height:600px'}));
            const spec = {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false};
            const host = t.lib.createMap(el, spec), map = host._map;
            const idle = async () => { await wait(100); for (let i = 0; i < 200 && !host.state.get().idle; i++) await wait(50); };
            await idle(); await wait(500); await idle();
            const layers = style.layers, fill = layers.findIndex(l => l.type === 'fill'), last = layers.findLastIndex(l => l.type !== 'symbol');
            const moved = layers.filter((_, i) => i !== fill);
            moved.splice(moved.indexOf(layers[last]) + 1, 0, layers[fill]);
            map._tileReport(true);
            map.on('tile', e => { if (e.kind !== 'frame') steps[e.kind] = (steps[e.kind] ?? 0) + 1; });
            host.update({...spec, style: {...style, layers: moved}});
            await wait(300); await idle();
            const order = map.getStyle().layers.map(l => l.id).indexOf(layers[fill].id) === last;
            // (A positive control: a zoom out after the reorder loads new tiles, so the map must report `req`. Without it
            // the check passes on an empty report, as it did on the shared map of the suite; #976.)
            const after = {...steps};
            host.moveTo({zoom: 12.3, duration: 0}); await idle();
            const control = (steps.req ?? 0) - (after.req ?? 0);
            host.destroy(); el.remove();
            return {fill: fill >= 0 && fill < last, order, steps: after, control};
        }, renderer);
        check(`[${renderer}] update with a new order of the layers of the style object builds no tile again (#961)`,
            reorder.fill && reorder.order && !reorder.steps.rebuild && !reorder.steps.req && !reorder.steps.drop && reorder.control > 0, JSON.stringify(reorder));
        // A changed minzoom of a layer of `layers` and of a layer of the style object: the map changes the zoom range in
        // place, loads no style, and draws the layer only at the new zooms (#871).
        const range = await page.evaluate(async () => {
            const t = window.t, map = t.host._map, wait = ms => new Promise(r => setTimeout(r, ms)), box = [{x: 0, y: 0}, {x: 900, y: 600}];
            const above = Math.floor(map.getZoom()) + 2, base = t.spec.layers ?? [], style = t.spec.style;
            const fill = (id, minzoom) => ({id, type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': '#f0f'}, ...(minzoom === undefined ? {} : {minzoom})});
            const found = async id => (await t.host.queryFeatures(box, {layers: [id]})).length;
            const withStyle = z => ({...style, layers: [...style.layers, fill('z-style', z)]});
            t.host.update(t.spec = {...t.spec, layers: [...base, fill('z-layers')], style: withStyle()});
            await wait(1500);
            const before = {layers: await found('z-layers'), style: await found('z-style')};
            let loads = 0;
            const count = () => loads++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, layers: [...base, fill('z-layers', above)], style: withStyle(above)});
            await wait(1500);
            const after = {layers: await found('z-layers'), style: await found('z-style'), min: map.getLayer('z-layers')?.minzoom, styleMin: map.getLayer('z-style')?.minzoom};
            t.host.update(t.spec = {...t.spec, layers: [...base, fill('z-layers')], style: withStyle()});
            await wait(1500);
            const back = {layers: await found('z-layers'), style: await found('z-style')};
            map.off('style.load', count);
            t.host.update(t.spec = {...t.spec, layers: base, style});
            await wait(1000);
            return {before, after, back, loads, above};
        });
        check(`[${renderer}] update with a new minzoom of a layer of layers and of the style object: the map draws the layer only at the new zooms and loads no style (#871)`,
            range.before.layers > 0 && range.before.style > 0 && range.after.layers === 0 && range.after.style === 0 && range.after.min === range.above && range.after.styleMin === range.above
            && range.back.layers > 0 && range.back.style > 0 && range.loads === 0, JSON.stringify(range));
        // A new filter of a layer that another layer names in `ref` reaches that layer too, as in MapLibre GL JS (#1814).
        const refEdit = await page.evaluate(async () => {
            const t = window.t, map = t.host._map, wait = ms => new Promise(r => setTimeout(r, ms)), box = [{x: 0, y: 0}, {x: 900, y: 600}], style = t.spec.style;
            const withRef = filter => ({...style, layers: [...style.layers, {id: 'ref-p', type: 'fill', source: 'omt', 'source-layer': 'water', ...(filter ? {filter} : {}), layout: {visibility: 'visible'}, paint: {'fill-color': '#f0f'}}, {id: 'ref-c', ref: 'ref-p', paint: {'fill-color': '#0ff'}}]});
            const found = async () => (await t.host.queryFeatures(box, {layers: ['ref-c']})).length;
            t.host.update(t.spec = {...t.spec, style: withRef()});
            await wait(1500);
            const before = await found();
            let loads = 0;
            const count = () => loads++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, style: withRef(['==', ['get', 'class'], 'no-such-class'])});
            await wait(1500);
            const after = {found: await found(), filter: JSON.stringify(map.getLayer('ref-c')?.filter), loads};
            map.off('style.load', count);
            t.host.update(t.spec = {...t.spec, style});
            await wait(1000);
            return {before, after};
        });
        check(`[${renderer}] update with a new filter of a layer that a layer with ref names: both layers get the filter, and the map loads no style (#1814)`,
            refEdit.before > 0 && refEdit.after.found === 0 && refEdit.after.filter?.includes('no-such-class') && refEdit.after.loads === 0, JSON.stringify(refEdit));
        check(`[${renderer}] update with a style object that changes one filter and one paint value of a layer: the map edits the layer and loads no style (#858)`,
            style.inPlace.loads === 0 && style.inPlace.filtered === 0 && style.inPlace.color === '#00f' && style.inPlace.filter.includes('no-such-class'), JSON.stringify(style.inPlace));
        check(`[${renderer}] update with a style object whose layers have a new order, and a new layer before one that stays: the map draws the new order and loads no style (#875)`,
            style.inPlace.moves.swapOrder === 'test-water-2,test-water' && style.inPlace.moves.swapTop === 'test-water' && style.inPlace.moves.frontOrder === 'test-water-0,test-water-2,test-water' && style.inPlace.moves.loads === 0, JSON.stringify(style.inPlace.moves));

        // A pair {light, dark}, and in one update() another colorScheme and a paint change of a layer of the dark style:
        // the map loads the dark style, and the paint change is in it (#858).
        const pair = await page.evaluate(async () => {
            const t = window.t, map = t.host._map, wait = ms => new Promise(r => setTimeout(r, ms));
            const id = t.style.layers.find(l => l.type === 'fill').id, mark = (c, extra) => ({...t.style, metadata: {...t.style.metadata, scheme: c}, layers: t.style.layers.map(l => l.id === id ? {...l, paint: {...l.paint, 'fill-color': extra}} : l)});
            t.host.update(t.spec = {...t.spec, style: {light: mark('light', '#111111'), dark: mark('dark', '#222222')}, colorScheme: 'light'});
            await wait(1500);
            let loads = 0;
            const count = () => loads++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, style: {light: mark('light', '#111111'), dark: mark('dark', '#333333')}, colorScheme: 'dark'});
            await wait(1500);
            map.off('style.load', count);
            const live = map.getStyle(), out = {loads, scheme: live.metadata?.scheme, color: live.layers.find(l => l.id === id)?.paint?.['fill-color']};
            const {colorScheme: _, ...rest} = t.spec;
            t.host.update(t.spec = {...rest, style: t.style});
            await wait(1500);
            return out;
        });
        check(`[${renderer}] update with a style pair, another colorScheme and a paint change at once: the map loads the other style of the pair, with the paint change (#858)`,
            pair.loads >= 1 && pair.scheme === 'dark' && pair.color === '#333333', JSON.stringify(pair));

        // 3a. A style URL that fails, with `extend`: `onError` gets the error with the URL and the status, the state has no `error` (#655), and no promise is left rejected.
        const badStyle = await page.evaluate(async () => {
            const t = window.t, el = document.body.appendChild(document.createElement('div'));
            let message;
            const host = await new Promise(r => {
                const host = t.lib.createMap(el, {style: '/no-such-style.json', layers: [{id: 'extra', type: 'background'}], attribution: false, onError: e => { message ??= e.message; r(host); }});
                setTimeout(() => r(host), 4000);
            });
            const inState = 'error' in host.state.get();
            host.destroy(); el.remove();
            return {message, inState};
        });
        check(`[${renderer}] a style URL that fails: onError has the URL and the status, the state has no "error", and no promise is left rejected`, /Style \/no-such-style\.json: HTTP 404/.test(badStyle.message ?? '') && badStyle.inState === false && !errors.length, JSON.stringify({badStyle, errors}));

        // The first `idle` does not wait for a camera that has just stopped (#436): the first camera of a map is not a
        // movement. A map with a background only is idle less than a fifth of a second after `createMap`. The
        // shortest of three starts is read, so that a slow moment of the machine does not decide the result.
        const firstIdle = await page.evaluate(async renderer => {
            const t = window.t, times = [];
            for (let i = 0; i < 3; i++) {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
                const began = performance.now();
                const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]}, renderer, attribution: false});
                const idle = await new Promise(r => { if (host.state.get().idle) r(performance.now()); else host.state.subscribe(s => s.idle, v => v && r(performance.now())); });
                times.push(Math.round(idle - began));
                host.destroy(); el.remove();
            }
            return times;
        }, renderer);
        check(`[${renderer}] the first idle of a map does not wait a fifth of a second for a camera that has just stopped (#436)`, Math.min(...firstIdle) < 200, JSON.stringify(firstIdle));

        // `idle` does not come in the callback of the map's ResizeObserver (#751). The engine on the main thread draws the
        // new size at once in that callback; code that runs on `idle` and changes the layout there (here, a new map) made
        // WebKit report "ResizeObserver loop completed with undelivered notifications" as a page error.
        const idleInObserver = await page.evaluate(async renderer => {
            const t = window.t, Native = window.ResizeObserver, seen = [];
            let inside = false;
            window.ResizeObserver = class extends Native { constructor(cb) { super((...a) => { inside = true; try { cb(...a); } finally { inside = false; } }); } };
            try {
                for (let i = 0; i < 3; i++) {
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
                    const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, renderer, attribution: false});
                    await new Promise(r => { if (host.state.get().idle) r(); else host.state.subscribe(s => s.idle, v => { if (v) { seen.push(inside); r(); } }); });
                    host.destroy(); el.remove();
                }
            } finally { window.ResizeObserver = Native; }
            await new Promise(r => setTimeout(r, 100));
            return seen;
        }, renderer);
        check(`[${renderer}] idle does not come in the callback of the map's ResizeObserver, and the page has no error from it (#751)`,
            idleInObserver.length === 3 && !idleInObserver.includes(true) && !errors.some(e => e.includes('ResizeObserver')), JSON.stringify({idleInObserver, errors}));

        // A new height of the ground under the camera is not a movement (#436). 3D terrain that is switched on gives the
        // camera its height when the elevation data comes: the map is idle then, and not 200 to 400 ms later. The
        // elevation tiles are one picture in the page (1000 m everywhere), so no network decides the time. The shortest
        // of three tries is read.
        // Elevation tiles are decoded in the tile workers, which needs OffscreenCanvas there (#778).
        const decodes = await inWorker(page, 'typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined"');
        const terrainName = `[${renderer}] 3D terrain that is switched on: the map is idle when the elevation data has come, not 200 ms after the camera got its height (#436)`;
        if (!decodes) skip(terrainName, 'no OffscreenCanvas in workers');
        else {
        const terrainIdle = await page.evaluate(async renderer => {
            const t = window.t, times = [];
            const c = Object.assign(document.createElement('canvas'), {width: 256, height: 256}), g = c.getContext('2d');
            g.fillStyle = 'rgb(131,232,0)'; g.fillRect(0, 0, 256, 256); // 1000 m in the terrarium encoding
            for (let i = 0; i < 3; i++) {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
                const spec = {style: {version: 8, sources: {dem: {type: 'raster-dem', tiles: [c.toDataURL('image/png')], encoding: 'terrarium', tileSize: 256, maxzoom: 10}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]},
                    initialView: {center: [7.7, 46], zoom: 10, pitch: 50}, renderer, attribution: false};
                const host = t.lib.createMap(el, spec);
                await new Promise(r => { if (host.state.get().idle) r(); else host.state.subscribe(s => s.idle, v => v && r()); });
                await new Promise(r => setTimeout(r, 300));
                const began = performance.now(), done = new Promise(r => host._map.once('idle', () => r(performance.now())));
                host.update({...spec, terrain: {source: 'dem'}});
                times.push(Math.round(await done - began));
                const ground = Math.round(await host.queryElevation([7.7, 46]));
                host.destroy(); el.remove();
                if (ground !== 1000) return [`the ground is at ${ground} m`];
            }
            return times;
        }, renderer);
        check(terrainName, Math.min(...terrainIdle) < 200, JSON.stringify(terrainIdle));
        }

        // #1430: 3D terrain is drawn on the globe too. The ground is 8000 m everywhere with an exaggeration of 20. The camera
        // looks at the ground under the centre, and the globe is 2.5 % larger, so it covers a little more of the view
        // (before #1430 it covered the same). queryElevation gives the height there.
        const globeName = `[${renderer}] 3D terrain on the globe raises the ground: the globe covers more of the view than without terrain, and queryElevation gives the height (#1430)`;
        if (!decodes) skip(globeName, 'no OffscreenCanvas in workers');
        else {
        const globeTerrain = await page.evaluate(async renderer => {
            const t = window.t, c = Object.assign(document.createElement('canvas'), {width: 256, height: 256}), g = c.getContext('2d');
            g.fillStyle = 'rgb(159,64,0)'; g.fillRect(0, 0, 256, 256); // 8000 m in the terrarium encoding
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const style = {version: 8, projection: {type: 'globe'}, sources: {dem: {type: 'raster-dem', tiles: [c.toDataURL('image/png')], encoding: 'terrarium', tileSize: 256, maxzoom: 6}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]};
            const covered = async host => {
                await new Promise(r => { if (host.state.get().idle) r(); else host.state.subscribe(s => s.idle, v => v && r()); });
                await new Promise(r => setTimeout(r, 200));
                const bmp = await createImageBitmap(await host.toBlob()), k = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}).getContext('2d');
                k.drawImage(bmp, 0, 0);
                const d = k.getImageData(0, 0, bmp.width, bmp.height).data;
                let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++;
                return n;
            };
            const spec = {style, initialView: {center: [0, 0], zoom: 4, pitch: 60}, renderer, attribution: false};
            const host = t.lib.createMap(el, spec);
            const flat = await covered(host);
            host.update({...spec, terrain: {source: 'dem', exaggeration: 20}});
            const raised = await covered(host), ground = Math.round(await host.queryElevation([0, 0]));
            host.destroy(); el.remove();
            return {flat, raised, ground};
        }, renderer);
        check(globeName, globeTerrain.raised > globeTerrain.flat * 1.003 && globeTerrain.ground === 8000, JSON.stringify(globeTerrain));
        }

        // `terrain` of the description (#1104): `null` gives a flat map also when the style has a `terrain`, no field or
        // `undefined` gives the terrain of the style, and `patch` goes back and forth. The terrain is read from the style
        // that the map has, so no elevation tile needs to be decoded.
        const flat = await page.evaluate(async renderer => {
            const t = window.t, out = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['data:,'], tileSize: 256, maxzoom: 1}}, terrain: {source: 'dem', exaggeration: 2}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]};
            const idle = host => new Promise(r => { const s = host.state.get(); if (s.loaded && s.idle) r(); else host.state.subscribe(s => s.loaded && s.idle, v => v && r()); });
            const read = async host => { await new Promise(r => setTimeout(r, 50)); await idle(host); return JSON.stringify(host.getResolvedDescription().style.terrain ?? null); };
            const spec = {style, initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false};
            let host = t.lib.createMap(el, {...spec, terrain: null});
            out.push(await read(host));
            host.patch({terrain: undefined}); out.push(await read(host));
            host.patch({terrain: null}); out.push(await read(host));
            host.update({...spec, terrain: {source: 'dem', exaggeration: 1.5}}); out.push(await read(host));
            host.update(spec); out.push(await read(host));
            host.destroy();
            host = t.lib.createMap(el, spec); out.push(await read(host));
            host.destroy(); el.remove();
            return out;
        }, renderer);
        const flatWant = ['null', '{"source":"dem","exaggeration":2}', 'null', '{"source":"dem","exaggeration":1.5}', '{"source":"dem","exaggeration":2}', '{"source":"dem","exaggeration":2}'];
        check(`[${renderer}] terrain: null gives a flat map with a style that has terrain, and no field or undefined gives the terrain of the style (#1104)`, JSON.stringify(flat) === JSON.stringify(flatWant), JSON.stringify(flat));

        // A change of `terrain` alone goes to the map as an edit (#1143): no `style.load` and no new request for the style,
        // and the map shows the terrain of each step (no field gives that of the style back).
        const terrainEdit = await page.evaluate(async renderer => {
            const t = window.t, out = [], styleRequests = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['data:,'], tileSize: 256, maxzoom: 1}}, terrain: {source: 'dem', exaggeration: 2}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]};
            const url = URL.createObjectURL(new Blob([JSON.stringify(style)], {type: 'application/json'}));
            const idle = host => new Promise(r => { const s = host.state.get(); if (s.loaded && s.idle) r(); else host.state.subscribe(s => s.loaded && s.idle, v => v && r()); });
            const read = async host => { await new Promise(r => setTimeout(r, 50)); await idle(host); return JSON.stringify(host.getResolvedDescription().style.terrain ?? null); };
            const spec = {style: url, initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false, transformRequest: (u, type) => { if (type === 'Style') styleRequests.push(u); }};
            const host = t.lib.createMap(el, spec);
            await read(host);
            let loads = 0;
            const count = () => loads++, map = host._map, requestsBefore = styleRequests.length;
            map.on('style.load', count);
            host.patch({terrain: {source: 'dem', exaggeration: 1.5}}); out.push(await read(host));
            host.patch({terrain: null}); out.push(await read(host));
            host.update(spec); out.push(await read(host));
            map.off('style.load', count);
            host.destroy(); el.remove(); URL.revokeObjectURL(url);
            return `${out.join(' > ')} loads ${loads} style requests ${styleRequests.length - requestsBefore}`;
        }, renderer);
        check(`[${renderer}] a change of terrain alone changes the terrain without a new style: no style.load and no style request (#1143)`,
            terrainEdit === '{"source":"dem","exaggeration":1.5} > null > {"source":"dem","exaggeration":2} loads 0 style requests 0', terrainEdit);

        // The control terrain() sets `terrain` of the description (#1106): after each click the description, the terrain
        // of the map and the label agree, onTerrainChange gets the value, an update with the description keeps it, and no
        // click loads the style (#1143). An update with a new description without `terrain`, as a component of Vue gives,
        // replaces the click with the terrain of the style (none here), and the label follows.
        const terrainButton = await page.evaluate(async renderer => {
            const t = window.t, {terrain} = await import('/dist/controls.js'), out = [], calls = [], styleRequests = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['data:,'], tileSize: 256, maxzoom: 1}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]};
            const url = URL.createObjectURL(new Blob([JSON.stringify(style)], {type: 'application/json'}));
            const idle = host => new Promise(r => { const s = host.state.get(); if (s.loaded && s.idle) r(); else host.state.subscribe(s => s.loaded && s.idle, v => v && r()); });
            const controls = [terrain({source: 'dem', exaggeration: 2, onTerrainChange: v => calls.push(JSON.stringify(v))})];
            const base = {style: url, initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false, controls, transformRequest: (u, type) => { if (type === 'Style') styleRequests.push(u); }};
            const host = t.lib.createMap(el, {...base, terrain: {source: 'dem'}});
            for (let i = 0; i < 300 && !el.querySelector('.map-jr-ctrl-terrain'); i++) await new Promise(r => setTimeout(r, 30));
            const b = el.querySelector('.map-jr-ctrl-terrain');
            const read = async () => { await new Promise(r => setTimeout(r, 50)); await idle(host); return `${JSON.stringify(host.description.terrain)}/${JSON.stringify(host.getResolvedDescription().style.terrain ?? null)}/${b.getAttribute('aria-label')}`; };
            out.push(await read());
            let loads = 0;
            const count = () => loads++, map = host._map, requestsBefore = styleRequests.length;
            map.on('style.load', count);
            b.click(); out.push(await read());
            host.update({...host.description, globalState: {x: 1}}); out.push(await read());
            b.click(); out.push(await read());
            host.patch({globalState: {x: 2}}); out.push(await read());
            const clickLoads = `loads ${loads} style requests ${styleRequests.length - requestsBefore}`;
            map.off('style.load', count);
            host.update({...base, globalState: {x: 3}}); out.push(await read());
            host.destroy(); el.remove(); URL.revokeObjectURL(url);
            return `${out.join(' > ')} calls ${calls.join(',')} ${clickLoads}`;
        }, renderer);
        const tOn1 = '{"source":"dem"}/{"source":"dem"}/Disable terrain', tOff = 'null/null/Enable terrain', tOn2 = '{"source":"dem","exaggeration":2}/{"source":"dem","exaggeration":2}/Disable terrain';
        check(`[${renderer}] the control terrain() sets terrain of the description without a new style, calls onTerrainChange, and an update with the description keeps the terrain (#1106)`,
            terrainButton === `${tOn1} > ${tOff} > ${tOff} > ${tOn2} > ${tOn2} > undefined/null/Enable terrain calls null,{"source":"dem","exaggeration":2} loads 0 style requests 0`, terrainButton);

        // #1214: queryElevation on a style without a raster-dem source rejects with a message that says what to add.
        const noDem = await page.evaluate(async renderer => {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const host = window.t.lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]}, initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false});
            const message = await host.queryElevation([0, 0]).then(() => 'resolved', e => String(e?.message ?? e));
            host.destroy(); el.remove();
            return message;
        }, renderer);
        check(`[${renderer}] queryElevation without a raster-dem source rejects with a [map-jr-gl] message that says to add one (#1214)`,
            (renderer === 'worker' ? noDem === '[map-jr-gl] E11214 https://map-jr.org/e/11214' : noDem.startsWith('[map-jr-gl] E11214 queryElevation()') && noDem.includes('raster-dem')), noDem);

        // #1213: the option `source` of queryElevation reads the named raster-dem source, and an unknown one rejects.
        const named = await page.evaluate(async renderer => {
            const tile = rgb => { const c = Object.assign(document.createElement('canvas'), {width: 256, height: 256}), g = c.getContext('2d'); g.fillStyle = rgb; g.fillRect(0, 0, 256, 256); return c.toDataURL('image/png'); };
            const dem = rgb => ({type: 'raster-dem', tiles: [tile(rgb)], encoding: 'terrarium', tileSize: 256, maxzoom: 10});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            // rgb(131,232,0) is 1000 m and rgb(135,208,0) is 2000 m in the terrarium encoding.
            const host = window.t.lib.createMap(el, {style: {version: 8, sources: {a: dem('rgb(131,232,0)'), b: dem('rgb(135,208,0)')}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]}, initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false});
            const out = [Math.round(await host.queryElevation([0, 0])), Math.round(await host.queryElevation([0, 0], {source: 'b', zoom: 3}))];
            out.push(await host.queryElevation([0, 0], {source: 'none'}).then(() => 'resolved', e => String(e?.message ?? e)));
            host.destroy(); el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] queryElevation reads the raster-dem source that the option source names, and rejects for an unknown one (#1213)`,
            named[0] === 1000 && named[1] === 2000 && (renderer === 'worker' ? named[2] === '[map-jr-gl] E1214 https://map-jr.org/e/1214 source="none"' : String(named[2]).includes('"none"')), JSON.stringify(named));

        // 3b. `projection` of the description (#463): it takes the place of the projection of the style, `null` gives the
        // projection of the style back, the same content does nothing, and the control `globe()` switches it.
        const projection = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const controls = await import('/dist/controls.dev.js');
            const style = {version: 8, projection: {type: 'vertical-perspective'}, sources: {}, layers: [{id: 'bg', type: 'background'}]};
            let spec = {style, projection: {type: 'globe'}, renderer, attribution: false, controls: [controls.globe()]};
            const host = t.lib.createMap(el, spec), events = [], out = {};
            host.listen('projectiontransition', e => events.push(e.newProjection));
            await new Promise(r => host.state.subscribe(s => s.loaded, l => l && r()));
            const type = () => host._map.getProjection()?.type ?? 'none';
            out.start = type();
            host.update(spec = {...spec, projection: null}); out.cleared = type();
            host.update(spec = {...spec, projection: {type: 'mercator'}}); out.mercator = type();
            host.update(spec = {...spec, projection: {type: 'mercator'}}); out.again = type();
            let b;
            for (let i = 0; i < 50 && !(b = el.querySelector('button.map-jr-ctrl-globe')); i++) await wait(50);
            b?.click(); out.clicked = type();
            host.update(spec = {...spec, cursor: 'crosshair'}); out.kept = type();
            out.events = events;
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] projection: the description replaces the projection of the style, null gives it back, and globe() switches it`,
            JSON.stringify(projection) === JSON.stringify({start: 'globe', cleared: 'vertical-perspective', mercator: 'mercator', again: 'mercator', clicked: 'globe', kept: 'globe', events: ['globe', 'vertical-perspective', 'mercator', 'globe']}), JSON.stringify(projection));

        // 3b2. `globalState` of the description (#486): a value replaces the default in `state` of the style, a change in
        // update() changes the paint without a new request of the style, a name left out gives the default back, and a
        // new style gets the values.
        const globalState = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:80px'}));
            const make = c => ({version: 8, state: {tone: {default: '#f00'}}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': ['global-state', 'tone'], 'background-opacity': c}}]});
            const colour = async () => {
                await new Promise(r => setTimeout(r, 150));
                const b = await host.toBlob(), bmp = await createImageBitmap(b), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return '#' + [...g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data.slice(0, 3)].map(v => (v >> 4).toString(16)).join('');
            };
            const fetches = () => performance.getEntriesByType('resource').length;
            let spec = {style: make(1), globalState: {tone: '#00f'}, renderer, attribution: false};
            const host = t.lib.createMap(el, spec), out = {};
            await new Promise(r => host.state.subscribe(s => s.loaded, l => l && r()));
            out.start = await colour();
            const before = fetches();
            host.update(spec = {...spec, globalState: {tone: '#0f0'}}); out.changed = await colour();
            out.requests = fetches() - before;
            host.update(spec = {...spec, globalState: {}}); out.cleared = await colour();
            host.update(spec = {...spec, globalState: {tone: '#0f0'}, style: make(0.999)});
            await new Promise(r => host.state.subscribe(s => s.idle, i => i && r()));
            out.restyled = await colour();
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] globalState: the description replaces the default of the style, a change repaints without a style request, a name left out goes back to the default, a new style keeps the values`,
            JSON.stringify(globalState) === JSON.stringify({start: '#00f', changed: '#0f0', requests: 0, cleared: '#f00', restyled: '#0f0'}), JSON.stringify(globalState));
        // #1085: in the main entry, a GeoJSON source without `buffer` keeps 16 pixels past the edges of a tile (the compat
        // entry keeps 128). A line 40 pixels right of a tile edge, 120 pixels wide, is cut at that edge: the tile to the
        // left does not have it. With buffer 128 the tile to the left draws its part.
        const buffer16 = await page.evaluate(async renderer => {
            const t = window.t, out = {};
            for (const [k, buffer] of [['none', undefined], ['128', 128]]) {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
                const style = {version: 8, sources: {p: {type: 'geojson', data: {type: 'LineString', coordinates: [[14.06, 10], [14.06, 30]]}, ...buffer !== undefined && {buffer}}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#000'}}, {id: 'l', type: 'line', source: 'p', paint: {'line-width': 120, 'line-color': '#f00'}}]};
                const host = t.lib.createMap(el, {style, initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false});
                await new Promise(r => host.state.subscribe(s => s.idle, i => i && r()));
                const bmp = await createImageBitmap(await host.toBlob()), g = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}).getContext('2d');
                g.drawImage(bmp, 0, 0);
                out[k] = g.getImageData(bmp.width * 180 / 400, bmp.height * 92 / 300, 1, 1).data[0];
                host.destroy(); el.remove();
            }
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] a GeoJSON source without buffer keeps 16 pixels past the tile edge in the main entry, and a buffer that is given is used (#1085)`,
            buffer16.none === 0 && buffer16['128'] === 255, JSON.stringify(buffer16));
        // #998: a `visibility` that is an expression of the global state hides a hillshade layer, and its raster-dem
        // source requests no tiles until the state shows the layer.
        const hiddenDem = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:80px'}));
            const urls = [], style = {version: 8, state: {relief: {default: false}}, sources: {dem: {type: 'raster-dem', tiles: [location.origin + '/no-such-dem-998/{z}/{x}/{y}.png'], tileSize: 256}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'relief', type: 'hillshade', source: 'dem', layout: {visibility: ['case', ['global-state', 'relief'], 'visible', 'none']}}]};
            let spec = {style, globalState: {relief: false}, renderer, attribution: false, initialView: {center: [0, 0], zoom: 3}, transformRequest: url => { if (url.includes('no-such-dem-998')) urls.push(url); }};
            const host = t.lib.createMap(el, spec), out = {};
            await new Promise(r => host.state.subscribe(s => s.idle, i => i && r()));
            await new Promise(r => setTimeout(r, 300));
            out.hidden = urls.length;
            host.update(spec = {...spec, globalState: {relief: true}});
            for (let i = 0; i < 50 && !urls.length; i++) await new Promise(r => setTimeout(r, 100));
            out.shown = urls.length > 0;
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] visibility: an expression of the global state hides a hillshade layer, whose raster-dem source requests no tiles until the state shows it (#998)`,
            JSON.stringify(hiddenDem) === JSON.stringify({hidden: 0, shown: true}), JSON.stringify(hiddenDem));
        // #1032: the attribution names a source only while a layer that the global state shows uses it.
        const credits = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const style = {version: 8, state: {relief: {default: false}}, sources: {g: {type: 'geojson', attribution: 'Relief-1032', data: {type: 'FeatureCollection', features: []}}},
                layers: [{id: 'c', type: 'circle', source: 'g', layout: {visibility: ['case', ['global-state', 'relief'], 'visible', 'none']}}]};
            let spec = {style, globalState: {relief: false}, renderer, attribution: {compact: false}, initialView: {center: [0, 0], zoom: 1}};
            const host = t.lib.createMap(el, spec), out = [], wait = ms => new Promise(r => setTimeout(r, ms));
            const text = () => !!el.querySelector('.map-jr-ctrl-attrib')?.textContent.includes('Relief-1032');
            await new Promise(r => host.state.subscribe(s => s.idle, i => i && r()));
            await wait(300); out.push(text());
            host.update(spec = {...spec, globalState: {relief: true}}); await wait(1000); out.push(text());
            host.update(spec = {...spec, globalState: {relief: false}}); await wait(1000); out.push(text());
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] attribution: a source whose layers a visibility expression of the global state hides is not named, and is named while the state shows them (#1032)`,
            JSON.stringify(credits) === '[false,true,false]', JSON.stringify(credits));
        // Paint transitions (#960): a new paint value in update() moves over the style's `transition` (here 3 s), the map
        // is not idle until it ends, and a `*-transition` of duration 0 changes the value at once. (`toBlob` waits for
        // `idle`, so a screenshot of the page reads the colour in the middle.)
        const transitioned = await (async () => {
            const red = async () => page.evaluate(async png => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d'); c.drawImage(bmp, 0, 0); return c.getImageData(0, 0, 1, 1).data[0]; }, (await page.screenshot({clip: {x: 50, y: 40, width: 1, height: 1}})).toString('base64'));
            const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
            const idle = () => page.evaluate(() => new Promise(r => { const h = window.transitionHost; if (h.state.get().idle) r(); else h.state.subscribe(s => s.idle, i => i && r()); }));
            await page.evaluate(renderer => {
                const make = window.transitionStyle = (c, own) => ({version: 8, transition: {duration: 3000, delay: 0}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': c, ...own}}]});
                const el = window.transitionEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:100px;height:80px;z-index:99999'}));
                window.transitionSpec = {style: make('#000'), renderer, attribution: false};
                window.transitionHost = window.t.lib.createMap(el, window.transitionSpec);
            }, renderer);
            await idle(); await wait(100);
            out.start = await red();
            const began = Date.now();
            await page.evaluate(() => { const s = window.transitionSpec = {...window.transitionSpec, style: window.transitionStyle('#f00')}; window.transitionHost.update(s); });
            await wait(1500);
            out.middle = await red();
            out.idleInMiddle = await page.evaluate(() => window.transitionHost.state.get().idle);
            await idle();
            out.took = Date.now() - began > 2500;
            await wait(100);
            out.end = await red();
            await page.evaluate(() => { const s = window.transitionSpec = {...window.transitionSpec, style: window.transitionStyle('#000', {'background-color-transition': {duration: 0}})}; window.transitionHost.update(s); });
            await wait(300);
            out.instant = await red();
            await page.evaluate(() => { window.transitionHost.destroy(); window.transitionEl.remove(); });
            return out;
        })().catch(e => ({error: String(e)}));
        check(`[${renderer}] paint transitions: update() moves a background colour over the style's transition, idle waits for its end, and a duration of 0 is at once (#960)`,
            transitioned.start === 0 && transitioned.middle > 40 && transitioned.middle < 215 && transitioned.idleInMiddle === false && transitioned.took && transitioned.end === 255 && transitioned.instant === 0, JSON.stringify(transitioned));
        // 3b2. The global state property `color-scheme` (#492): the map sets it to the resolved scheme, a change of the
        // scheme repaints a background and builds the tiles of an icon whose template parameter reads it, with no
        // request, and a value of `globalState` with that name wins until the description leaves it out.
        const colorState = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:80px'}));
            const pick = ['match', ['global-state', 'color-scheme'], 'dark', '#00f', '#f00'];
            const style = {version: 8, state: {'color-scheme': {default: 'light'}}, sources: {p: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}}}, layers: [
                {id: 'bg', type: 'background', paint: {'background-color': pick}},
                {id: 'icon', type: 'symbol', source: 'p', layout: {'icon-image': ['image', 'sq', {params: {fill: ['match', ['global-state', 'color-scheme'], 'dark', '#ff0', '#0f0']}}], 'icon-allow-overlap': true}},
            ]};
            const at = async (x, y) => {
                await new Promise(r => setTimeout(r, 300));
                const b = await host.toBlob(), bmp = await createImageBitmap(b), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return '#' + [...g.getImageData(bmp.width * x | 0, bmp.height * y | 0, 1, 1).data.slice(0, 3)].map(v => (v >> 4).toString(16)).join('');
            };
            const both = async () => (await at(0.1, 0.1)) + ' ' + (await at(0.5, 0.5));
            const fetches = () => performance.getEntriesByType('resource').length;
            let spec = {style, colorScheme: 'light', images: {sq: '<svg viewBox="0 0 30 30"><rect width="30" height="30" fill="{{fill}}"/></svg>'}, initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false};
            const host = t.lib.createMap(el, spec), out = {};
            await new Promise(r => host.state.subscribe(s => s.idle, i => i && r()));
            out.light = await both();
            const before = fetches();
            host.update(spec = {...spec, colorScheme: 'dark'}); out.dark = await both();
            out.requests = fetches() - before;
            host.update(spec = {...spec, globalState: {'color-scheme': 'light'}}); out.forced = await both();
            host.update(spec = {...spec, globalState: {}}); out.back = await both();
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] colorScheme sets the global state property color-scheme: a background and an icon template change with no request, and globalState of the same name wins`,
            JSON.stringify(colorState) === JSON.stringify({light: '#f00 #0f0', dark: '#00f #ff0', requests: 0, forced: '#f00 #0f0', back: '#00f #ff0'}), JSON.stringify(colorState));
        // 3b2b. getResolvedDescription() (#872): the style that a URL gave, with the `state` defaults and `globalState`
        // merged; for a pair, the style of the scheme; a copy at each call; before style.load, the style as written.
        const resolved = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:80px'}));
            const make = name => ({version: 8, name, state: {tone: {default: '#f00'}, size: {default: 2}}, sources: {}, layers: [{id: 'bg-' + name, type: 'background', paint: {'background-color': ['global-state', 'tone']}}]});
            const url = URL.createObjectURL(new Blob([JSON.stringify(make('url'))], {type: 'application/json'})), out = {};
            const host = t.lib.createMap(el, {style: url, globalState: {tone: '#00f'}, renderer, attribution: false});
            out.early = host.getResolvedDescription().style === url;
            const loaded = () => new Promise(r => { const off = host.listen('style.load', () => { off(); r(); }); setTimeout(r, 15000); });
            await loaded();
            let d = host.getResolvedDescription();
            out.url = [d.style.name, d.style.layers.map(l => l.id).join(), d.globalState.tone, d.globalState.size, d.globalState['color-scheme']];
            d.style.layers.length = 0; d.globalState.tone = '#000';
            d = host.getResolvedDescription();
            out.copy = d.style.layers.length === 1 && d.globalState.tone === '#00f' && host.description.style === url;
            host.update({style: {light: make('light'), dark: make('dark')}, colorScheme: 'light', renderer, attribution: false}); await loaded();
            out.light = [host.getResolvedDescription().style.name, host.getResolvedDescription().globalState['color-scheme']];
            host.update({style: {light: make('light'), dark: make('dark')}, colorScheme: 'dark', renderer, attribution: false}); await loaded();
            d = host.getResolvedDescription();
            out.dark = [d.style.name, d.globalState['color-scheme'], d.globalState.tone, d.colorScheme];
            host.destroy(); el.remove(); URL.revokeObjectURL(url);
            return out;
        }, renderer);
        check(`[${renderer}] getResolvedDescription: the style that a URL or a {light, dark} pair gave, the global state in effect, a copy at each call`,
            JSON.stringify(resolved) === JSON.stringify({early: true, url: ['url', 'bg-url', '#00f', 2, 'light'], copy: true, light: ['light', 'light'], dark: ['dark', 'dark', '#f00', 'dark']}), JSON.stringify(resolved));

        // 3b2a. A new style drops the tiles that it makes stale and that are not on screen (#550): kept, they stood in
        // for the tiles of a zoom out and showed the colours of the style before until they were built again. The
        // steps of the report: zoom out and in, change the scheme of `style: {light, dark}`, zoom out again.
        const staleScheme = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:80px'}));
            // (The vector tiles of the demo style, with a colour that the tiles carry: a paint value that is the same for the
            // whole layer is a uniform, and a GeoJSON source is cut again for each style.)
            const base = await (await fetch('/style.json')).json();
            const make = fill => ({...base, layers: [{id: 'bg', type: 'background', paint: {'background-color': fill}}, ...base.layers.filter(l => l.type === 'fill').map(l => ({...l, paint: {'fill-color': ['coalesce', ['get', 'no-such-property'], fill]}}))]});
            const colour = async () => {
                const bmp = await createImageBitmap(await host.toBlob()), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return '#' + [...g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data.slice(0, 3)].map(v => (v >> 4).toString(16)).join('');
            };
            const idle = async () => { await new Promise(r => setTimeout(r, 100)); for (let i = 0; i < 100 && !host.state.get().idle; i++) await new Promise(r => setTimeout(r, 50)); };
            let spec = {style: {light: make('#f00'), dark: make('#00f')}, colorScheme: 'light', initialView: {center: [-74.0065, 40.7085], zoom: 12.5}, renderer, attribution: false};
            const host = t.lib.createMap(el, spec), dropped = new Set();
            host._map.on('tile', e => { if (e.kind === 'drop') for (const k of [e.key].flat()) dropped.add(k.split('|')[1].split('/')[0]); });
            await idle();
            host._map._tileReport(true);
            host.moveTo({zoom: 10.5, duration: 0}); await idle();
            host.moveTo({zoom: 12.5, duration: 0}); await idle();
            dropped.clear();
            host.update(spec = {...spec, colorScheme: 'dark'}); await idle();
            const out = {dropped: dropped.has('10')};
            host.moveTo({zoom: 10.5, duration: 0}); await idle();
            out.colour = await colour();
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] a new style drops the stale tiles that are not on screen, so that a zoom out after a change of the scheme of style: {light, dark} draws no tile of the style before (#550)`,
            JSON.stringify(staleScheme) === JSON.stringify({dropped: true, colour: '#00f'}), JSON.stringify(staleScheme));
        // 3b2b. `state.idle` after a new style comes once the page shows the frame of the new style (#555). The worker
        // renderer sent `idle` with the frame, and the page could still show the frame before. (The canvas of the main
        // renderer cannot be read 1 s later: its drawing buffer is cleared once it is shown.)
        if (renderer === 'worker' && !await workerRenders(page)) skip('[worker] after a new style, the canvas at state.idle shows the new style: no pixel differs from the canvas 1 s later (#555)', noWorkerRender);
        else if (renderer === 'worker') {
            const shownAtIdle = await page.evaluate(async renderer => {
                const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:450px;height:300px;z-index:100'}));
                const other = JSON.parse(JSON.stringify(t.style), (k, v) => typeof v === 'string' && /^(#|rgb|hsl)/i.test(v) ? '#2050c0' : v);
                const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false};
                const host = t.lib.createMap(el, spec);
                let wake = null;
                host.state.subscribe(s => s.idle, v => { if (v && wake) { const f = wake; wake = null; f(); } });
                if (!host.state.get().idle) await new Promise(r => { wake = r; });
                const c = el.querySelector('canvas');
                const grab = () => { const o = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(c.width, c.height) : Object.assign(document.createElement('canvas'), {width: c.width, height: c.height}), g = o.getContext('2d', {willReadFrequently: true}); g.drawImage(c, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
                const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n; };
                const out = [];
                for (let i = 0; i < 6; i++) {
                    let at;
                    const shown = new Promise(r => { wake = () => { at = grab(); r(); }; });
                    host.update({...spec, style: i % 2 ? t.style : other});
                    await Promise.race([shown, new Promise(r => setTimeout(r, 10000))]);
                    await new Promise(r => setTimeout(r, 1000));
                    out.push(at ? differ(at, grab()) : 'no idle');
                }
                const used = host.state.get().renderer;
                host.destroy(); el.remove();
                return {used, out};
            }, renderer).catch(e => ({error: String(e)}));
            check(`[worker] after a new style, the canvas at state.idle shows the new style: no pixel differs from the canvas 1 s later (#555)`,
                shownAtIdle.used === 'worker' && shownAtIdle.out?.every(n => n === 0), JSON.stringify(shownAtIdle));
        }
        // 3b2b2. The first read of the canvas of the worker renderer gives the map, at `idle` and later (#965). WebKit gave
        // blank pixels to the first task that read such a canvas, and the frame only to the tasks after it.
        const firstReadName = '[worker] the first drawImage of the canvas of a new map gives the map, at state.idle and 300 ms later (#965)';
        if (renderer === 'worker' && !await workerRenders(page)) skip(firstReadName, noWorkerRender);
        else if (renderer === 'worker') {
            const firstRead = await page.evaluate(async renderer => {
                const t = window.t, out = [];
                for (const wait of [0, 0, 300, 300]) {
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px;z-index:100'}));
                    const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#f0f'}}]}, renderer, attribution: false});
                    await Promise.race([new Promise(r => host.state.subscribe(s => s.idle, v => v && r())), new Promise(r => setTimeout(r, 10000))]);
                    if (wait) await new Promise(r => setTimeout(r, wait));
                    const c = el.querySelector('canvas'), g = new OffscreenCanvas(1, 1).getContext('2d');
                    g.drawImage(c, c.width / 2, c.height / 2, 1, 1, 0, 0, 1, 1);
                    out.push([...g.getImageData(0, 0, 1, 1).data].join(','));
                    if (host.state.get().renderer !== 'worker') out.push('renderer ' + host.state.get().renderer);
                    host.destroy(); el.remove();
                }
                return out;
            }, renderer).catch(e => [String(e)]);
            check(firstReadName, firstRead.every(p => p === '255,0,255,255'), JSON.stringify(firstRead));
        }
        // 3b2c. After setPixelRatio, `idle` of the worker renderer comes once the canvas of the page has the new size (#950).
        // Chromium gives the canvas the size of a resized frame only when that frame arrives, which can be more than one
        // frame of the page after the engine sent `idle`. As in the bench of #948, new maps get setPixelRatio(2) after
        // their first `idle`: maps of the compat entry (the main API has no pixel ratio), two on one page.
        const resizedName = '[worker] after setPixelRatio, the canvas has the new size at idle, with two maps on one page (#950)';
        if (renderer === 'worker' && !await workerRenders(page)) skip(resizedName, noWorkerRender);
        else if (renderer === 'worker') {
            const resized = await page.evaluate(async () => {
                const t = window.t, mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wrong = [];
                const idle = map => new Promise(r => { map.once('idle', () => r(true)); setTimeout(() => r(false), 10000); });
                for (let round = 0; round < 6; round++) {
                    const maps = [0, 1].map(i => {
                        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: `position:fixed;left:0;top:${i * 300}px;width:450px;height:300px;z-index:100`}));
                        return {el, map: new mod.Map({container: el, style: t.style, center: [-74.0065, 40.7085], zoom: 14.3, attributionControl: false})};
                    });
                    await Promise.all(maps.map(m => idle(m.map)));
                    await Promise.all(maps.map(async ({el, map}, i) => {
                        for (const ratio of [2, 1]) {
                            const armed = idle(map);
                            map.setPixelRatio(ratio);
                            const came = await armed, width = map.getCanvas().width, want = Math.round(el.clientWidth * ratio);
                            if (!came || width !== want) wrong.push({round, map: i, ratio, came, width, want});
                        }
                    }));
                    for (const m of maps) { m.map.remove(); m.el.remove(); }
                }
                return {wrong};
            }).catch(e => ({error: String(e)}));
            check(resizedName, resized.wrong?.length === 0, JSON.stringify(resized));
            // The browser clamps a canvas that is wider than the GPU allows (16384 pixels in Chromium and WebKit on the Mac):
            // `idle` does not wait for a size that the canvas cannot have. A strip of 6000 × 200 at pixel ratio 3 asks for
            // 18000 × 600, which is wider than that and small enough to allocate (#997: 6000 × 4000 crashed WebKit). The
            // idle after setPixelRatio comes within 500 ms (an idle that waits for the size takes the whole second of the
            // wait, while frames still come), and after a jump it comes within 300 ms of the last frame.
            const clampName = '[worker] a canvas that the browser clamps: idle comes within 500 ms of setPixelRatio and 300 ms of the last frame (#950)';
            const clamped = await page.evaluate(async () => {
                const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:6000px;height:200px;z-index:100'}));
                const map = new mod.Map({container: el, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#8ac'}}]}, attributionControl: false});
                const idle = () => new Promise(r => { map.once('idle', () => r(performance.now())); setTimeout(() => r(null), 10000); });
                await idle();
                const start = performance.now(), resized = idle();
                map.setPixelRatio(3);
                const after = await resized, ratio = after === null ? 'no idle' : Math.round(after - start);
                let last = 0; map.on('render', () => { last = performance.now(); });
                const gaps = [];
                for (let i = 0; i < 3; i++) { const armed = idle(); map.jumpTo({zoom: 14.3 + (i + 1) * 0.0001}); const at = await armed; gaps.push(at === null ? 'no idle' : Math.round(at - last)); }
                const canvas = [map.getCanvas().width, map.getCanvas().height];
                map.remove(); el.remove();
                return {ratio, gaps, canvas};
            }).catch(e => ({error: String(e)}));
            check(clampName, typeof clamped.ratio === 'number' && clamped.ratio < 500 && clamped.gaps?.every(g => typeof g === 'number' && g < 300)
                && clamped.canvas[0] < 18000, JSON.stringify(clamped));
        }
        // 3b2. `patch` (#483): it keeps the fields that `part` leaves out, `undefined` removes a field, and `description` is the last description.
        const patched = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const spec = {style: t.style, renderer, attribution: false, cursor: 'crosshair', maxZoom: 10};
            const host = t.lib.createMap(el, spec), out = {};
            out.first = host.description === spec;
            host.patch({minZoom: 2});
            out.kept = [host.description.cursor, host.description.maxZoom, host.description.minZoom, host._map.getMaxZoom(), host._map.getMinZoom(), el.querySelector('canvas').style.cursor];
            host.patch({cursor: undefined, maxZoom: undefined});
            out.removed = ['cursor' in host.description, 'maxZoom' in host.description, host.description.minZoom, host._map.getMaxZoom(), el.querySelector('canvas').style.cursor];
            try { host.patch({style: undefined}); out.style = 'no error'; } catch (e) { out.style = e.message; }
            out.styleKept = host.description.style === t.style;
            // A maxPitch above 180 warns once per map, and null gives the default 60 (#886, #897).
            const warn = console.warn; let warned = 0; console.warn = (...a) => { if (String(a[0]).includes('maxPitch')) warned++; else warn(...a); };
            host._map.setMaxPitch(200); host._map.setMaxPitch(250); out.pitch = [host._map.getMaxPitch(), warned];
            host._map.setMaxPitch(null); out.pitch.push(host._map.getMaxPitch()); console.warn = warn;
            // centerElevation gives the map center a height, and null puts it back on the ground (#897).
            host.patch({centerElevation: 10000}); await new Promise(r => setTimeout(r, 300)); out.elevation = [host._map.getCenterElevation()];
            host.patch({centerElevation: null}); await new Promise(r => setTimeout(r, 300)); out.elevation.push(host._map.getCenterElevation());
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] patch keeps the other fields, undefined removes a field, and description is the last description`,
            JSON.stringify(patched) === JSON.stringify({first: true, kept: ['crosshair', 10, 2, 10, 2, 'crosshair'], removed: [false, false, 2, 22, ''], style: '[map-jr-gl] E57 patch(): the description has no "style". Do not set "style" to undefined.', styleKept: true, pitch: [180, 1, 60], elevation: [10000, 0]}), JSON.stringify(patched));

        // 3b4. `null` in an optional field means "not set" (#1146): a description from JSON with `null` in every optional
        // field except `terrain` draws the same map as one without those keys, in createMap and in update, and warns nothing.
        const nulls = await page.evaluate(async renderer => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const idle = async host => { await wait(100); for (let i = 0; i < 200 && !host.state.get().idle; i++) await wait(50); };
            const fields = ['fontFamily', 'interactive', 'antialias', 'attribution', 'hash', 'nonce', 'sources', 'layers', 'fonts', 'initialView', 'view', 'onViewChange', 'data', 'images', 'sprite', 'controls', 'projection', 'globalState', 'interactiveLayers', 'hoverState', 'onClick', 'onError', 'minZoom', 'maxZoom', 'maxPitch', 'renderWorldCopies', 'centerElevation', 'maxBounds', 'cursor', 'cooperativeGestures', 'colorScheme', 'onColorSchemeChange', 'padding', 'transformRequest', 'locale'];
            const plain = {style: t.style, renderer};
            const withNulls = JSON.parse(JSON.stringify({...plain, ...Object.fromEntries(fields.map(k => [k, null]))}));
            const warned = [], warn = console.warn, error = console.error;
            console.warn = (...a) => { warned.push(String(a[0])); warn(...a); }; console.error = (...a) => { warned.push(String(a[0])); error(...a); };
            const look = async (spec, again) => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
                const host = t.lib.createMap(el, spec);
                await idle(host);
                if (again) { host.update(again); await idle(host); }
                const m = host._map, v = host.state.get().view;
                const out = {style: JSON.stringify(m.getStyle()), view: [v.center.map(n => n.toFixed(6)), v.zoom, v.bearing, v.pitch], limits: [m.getMinZoom(), m.getMaxZoom(), m.getMaxPitch(), m.getMaxBounds()],
                    cursor: el.querySelector('canvas').style.cursor, controls: el.querySelectorAll('.maplibregl-ctrl').length, scheme: host.state.get().colorScheme, keys: Object.keys(host.description).sort()};
                host.destroy(); el.remove();
                return out;
            };
            try {
                const a = await look(plain), b = await look(withNulls), c = await look(plain, withNulls);
                return {same: JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) === JSON.stringify(c), a, b, c, warned: warned.filter(w => w.includes('map-jr-gl'))};
            } finally { console.warn = warn; console.error = error; }
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] null in every optional field draws the same map as a description without those keys, and warns nothing`,
            nulls.same === true && nulls.warned.length === 0, JSON.stringify(nulls).slice(0, 2000));

        // 3b3. `patch` merges `data` by key, and a key that is `null` removes its source; `layers` is replaced whole (#1160).
        const merged = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const wait = ms => new Promise(r => setTimeout(r, ms)), pt = c => ({type: 'Point', coordinates: c});
            const circle = id => ({id, type: 'circle', source: id});
            const host = t.lib.createMap(el, {style: t.style, renderer, attribution: false, data: {a: pt([0, 0])}, layers: [circle('a')]});
            await new Promise(r => host._map.once('load', r));
            const out = {};
            host.patch({data: {b: pt([1, 1])}, layers: [circle('a'), circle('b')]});
            out.both = [Object.keys(host.description.data), !!host._map.getSource('a'), !!host._map.getSource('b')];
            host.patch({data: {a: null}, layers: [circle('b')]});
            await wait(50);
            out.removed = [Object.keys(host.description.data), !!host._map.getSource('a'), !!host._map.getSource('b'), !!host._map.getLayer('a'), !!host._map.getLayer('b')];
            host.update(host.description);
            out.same = [Object.keys(host.description.data), !!host._map.getSource('a'), !!host._map.getSource('b')];
            // A field that is null is "not set" (#1146), while a key of `data` that is null still removes its source.
            host.patch({data: {c: pt([2, 2])}, cursor: 'crosshair'});
            host.patch({data: {c: null}, cursor: null});
            await wait(50);
            out.nulls = [Object.keys(host.description.data), !!host._map.getSource('c'), 'cursor' in host.description, el.querySelector('canvas').style.cursor];
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] patch merges data by key, null removes a source, and layers is replaced whole`,
            JSON.stringify(merged) === JSON.stringify({both: [['a', 'b'], true, true], removed: [['b'], false, true, false, true], same: [['b'], false, true], nulls: [['b'], false, false, '']}), JSON.stringify(merged));

        // 3c. Mistakes and errors: a container that is not there has a message; `onError`
        // gets each error; without it the error is written to the console.
        const tiles2007 = new Set();
        await page.route(/\/no-such-2007\//, r => { tiles2007.add(r.request().url()); r.fulfill({status: 500, body: ''}); });
        const mistakes = await page.evaluate(async () => {
            const t = window.t, said = fn => { try { fn(); return ''; } catch (e) { return e.message; } }, wait = ms => new Promise(r => setTimeout(r, ms));
            const out = {noId: said(() => t.lib.createMap('nope', {style: t.style})), isNull: said(() => t.lib.createMap(null, {style: t.style}))};
            const el = document.body.appendChild(document.createElement('div'));
            out.left = el.childElementCount;
            const logged = [], log = console.error;
            console.error = (...a) => logged.push(a.map(x => x?.message ?? String(x)).join(' '));
            const got = [], infos = [], withHook = t.lib.createMap(el, {style: '/no-such-style.json', attribution: false, onError: (e, info) => { got.push(e.message); infos.push(info); }});
            await wait(1200);
            out.hook = got.join(); out.loggedWithHook = logged.length; out.styleInfo = JSON.stringify(infos);
            withHook.destroy();
            // A source that fails: the second argument has its `sourceId` (#2008).
            const sourceInfos = [], withSource = t.lib.createMap(el, {style: {version: 8, sources: {broken: {type: 'geojson', data: '/no-such-data-2008.geojson'}}, layers: [{id: 'b', type: 'circle', source: 'broken'}]}, attribution: false, onError: (e, info) => sourceInfos.push(info)});
            await wait(1200);
            out.sourceInfo = JSON.stringify(sourceInfos);
            withSource.destroy();
            // A tile server that answers 500: one error for each tile, also after the retries (0.5 s, 1 s, 2 s) (#2007).
            const tileErrors = [], box = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const down = t.lib.createMap(box, {style: {version: 8, sources: {v: {type: 'vector', tiles: [location.origin + '/no-such-2007/{z}/{x}/{y}.pbf']}}, layers: [{id: 'v', type: 'fill', source: 'v', 'source-layer': 'x'}]}, view: {center: [0, 0], zoom: 3}, attribution: false, onError: (e, info) => tileErrors.push(info.sourceId)});
            await wait(5000);
            down.destroy(); box.remove();
            out.tileErrors = tileErrors.length; out.tileSource = [...new Set(tileErrors)].join();
            const without = t.lib.createMap(el, {style: '/no-such-style.json', attribution: false});
            await wait(1200);
            out.logged = logged.join();
            without.destroy(); el.remove(); console.error = log;
            return out;
        });
        await page.unroute(/\/no-such-2007\//);
        check(`[${renderer}] mistakes have a message: a container that is not there`,
            mistakes.noId === '[map-jr-gl] E10065 createMap(): no element with the id "nope".' && mistakes.isNull.startsWith('[map-jr-gl] E65 createMap(): the container is null.') && mistakes.left === 0, JSON.stringify(mistakes));
        check(`[${renderer}] onError gets each error, and without it the error is written to the console`,
            /HTTP 404/.test(mistakes.hook) && mistakes.loggedWithHook === 0 && /^\[map-jr-gl\] .*HTTP 404/.test(mistakes.logged), JSON.stringify(mistakes));
        check(`[${renderer}] a tile server that answers 500 gives one error for each tile, with its sourceId, also after the retries (#2007)`,
            tiles2007.size >= 4 && mistakes.tileErrors === tiles2007.size && mistakes.tileSource === 'v', JSON.stringify({...mistakes, tiles: tiles2007.size}));
        check(`[${renderer}] onError gets {sourceId} as its second argument for a source that fails, and {} for the style (#2008)`,
            mistakes.styleInfo === '[{}]' && mistakes.sourceInfo === '[{"sourceId":"broken"}]', JSON.stringify(mistakes));

        // 3d. Two maps with one `extend` object whose source has its data at a URL: both load it.
        const sharedExtend = await page.evaluate(async () => {
            const t = window.t, square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.99, 40.70], [-73.99, 40.72], [-74.02, 40.72], [-74.02, 40.70]]]}};
            const extend = {sources: {own: {type: 'geojson', data: 'data:application/json,' + encodeURIComponent(JSON.stringify(square))}}, layers: [{id: 'own-fill', type: 'fill', source: 'own'}]};
            const made = [0, 1].map(() => { const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'})); return {el, host: t.lib.createMap(el, {style: t.style, ...extend, initialView: {center: [-74.0065, 40.7085], zoom: 13}, attribution: false})}; });
            const idles = await Promise.all(made.map(({host}) => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 8000); })));
            const drawn = await Promise.all(made.map(({host}) => Promise.race([host.queryFeatures(undefined, {layers: ['own-fill']}).then(f => f.length), new Promise(r => setTimeout(() => r(-1), 4000))])));
            for (const {el, host} of made) { host.destroy(); el.remove(); }
            return {idles, drawn};
        });
        check(`[${renderer}] two maps with one extend object both load its source`, sharedExtend.idles.every(Boolean) && sharedExtend.drawn.every(n => n > 0), JSON.stringify(sharedExtend));

        // 3d. `radius` widens a query for what the style layers draw, as it widens a query of `querySource` (#12).
        const radius = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            // A line of 7 pixels through the centre of the map, from west to east, which is found within 3.5 pixels of its centre line (#2003). The questions are 6 pixels below it: the default radius of 3 finds the line there, and a radius of 2 or 0 does not.
            const line = {type: 'Feature', properties: {name: 'line'}, geometry: {type: 'LineString', coordinates: [[-74.02, 40.7085], [-73.99, 40.7085]]}};
            const host = t.lib.createMap(el, {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false,
                sources: {own: {type: 'geojson', data: line}}, layers: [{id: 'own-line', type: 'line', source: 'own', paint: {'line-width': 7}}]});
            await new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const at = {x: 100, y: 81}, below = host.unproject(at), count = async (place, o) => (await host.queryFeatures(place, o)).length;
            const out = {on: await count({x: 100, y: 75}, {layers: ['own-line']}), near: await count(at, {layers: ['own-line']}), nearZero: await count(at, {layers: ['own-line'], radius: 0}), small: await count(at, {layers: ['own-line'], radius: 2}), point: await count(at, {layers: ['own-line'], radius: 8}),
                position: await count(below, {layers: ['own-line'], radius: 8}), data: (await host.querySource('own', at, {radius: 8})).length, dataDefault: (await host.querySource('own', at)).length,
                layer: (await host.queryFeatures(at, {layers: ['own-line'], radius: 8}))[0]?.layer?.id,
                // A query of the view gives `geometry` only with `geometry: true`, as a query at a place does (#1150).
                viewGeometry: (await host.querySource('own')).map(f => 'geometry' in f).join(), viewGeometryOn: (await host.querySource('own', {geometry: true})).map(f => f.geometry?.type).join()};
            host.destroy(); el.remove();
            return out;
        }, renderer);
        // 3d. A GeoJSON feature without an id that several tiles hold is given one time (#606). [0, 0] is the corner of
        // four tiles at zoom 2, and each of them has the three points and a part of the square.
        const corner = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const point = {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}};
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}};
            const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: []}, initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false,
                sources: {points: {type: 'geojson', data: {type: 'FeatureCollection', features: [point, point, point]}}, square: {type: 'geojson', data: square}},
                layers: [{id: 'square', type: 'fill', source: 'square'}, {id: 'points', type: 'circle', source: 'points'}]});
            await new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const at = {x: 100, y: 75}, box = [{x: 90, y: 65}, {x: 110, y: 85}], out = {};
            for (const layer of ['points', 'square']) {
                const found = [await host.queryFeatures(at, {layers: [layer]}), await host.queryFeatures(box, {layers: [layer]}), await host.queryFeatures({layers: [layer]}), await host.querySource(layer, box), await host.querySource(layer)];
                out[layer] = found.map(f => f.length);
                out.keys = out.keys !== false && found.flat().every(f => !('index' in f));
            }
            host.destroy(); el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] queryFeatures and querySource give a GeoJSON feature without an id one time when several tiles hold it (#606)`,
            corner.points.join() === '3,3,3,3,3' && corner.square.join() === '1,1,1,1,1' && corner.keys, JSON.stringify(corner));
        // A string id of a GeoJSON feature stays in queries, a string of digits becomes the number, and feature state takes a string id (#528).
        const textId = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            // The square lies on the corner of four tiles, and the points are records with string ids.
            const square = {type: 'Feature', id: 'square-a', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]]}};
            const places = t.lib.points([{id: 'louvre', lng: 0, lat: 0}, {id: '12', lng: 0, lat: 0}], {lngLat: r => [r.lng, r.lat], id: r => r.id});
            const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}, initialView: {center: [0, 0], zoom: 5}, renderer, attribution: false,
                sources: {square: {type: 'geojson', data: square}, places: {type: 'geojson', data: places}},
                layers: [{id: 'square', type: 'fill', source: 'square', paint: {'fill-color': ['case', ['boolean', ['feature-state', 'on'], false], '#f00', '#00f']}}, {id: 'places', type: 'circle', source: 'places', paint: {'circle-radius': 2, 'circle-opacity': 0.01}}]});
            await idle(host);
            const at = {x: 100, y: 75}, ids = async list => (await list).map(f => JSON.stringify(f.id)).sort().join();
            const out = {square: [await ids(host.queryFeatures(at, {layers: ['square']})), await ids(host.queryFeatures({layers: ['square']})), await ids(host.querySource('square', at)), await ids(host.querySource('square'))],
                places: [await ids(host.queryFeatures(at, {layers: ['places']})), await ids(host.querySource('places'))]};
            host.setFeatureState({source: 'square', id: 'square-a'}, {on: true});
            await new Promise(r => setTimeout(r, 300)); await idle(host);
            const b = await host.toBlob(), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : Object.assign(document.createElement('canvas'), {width: 1, height: 1})).getContext('2d'), i = await createImageBitmap(b); c.drawImage(i, i.width / 2, i.height / 2, 1, 1, 0, 0, 1, 1);
            const [r, , bl] = c.getImageData(0, 0, 1, 1).data;
            out.colour = r > 200 && bl < 50 ? 'red' : `${r},${bl}`;
            out.state = (await host.queryFeatures(at, {layers: ['square']}))[0]?.state;
            // The record '12' has the id 12, and setFeatureState and removeFeatureState with '12' reach it (#753).
            const pick = async () => (await host.queryFeatures(at, {layers: ['places']})).filter(f => f.id === 12).map(f => f.state?.pick ?? 'none').join();
            host.setFeatureState({source: 'places', id: '12'}, {pick: true});
            out.digits = await pick();
            host.removeFeatureState({source: 'places', id: '12'}, 'pick');
            out.digitsRemoved = await pick();
            host.destroy(); el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] queryFeatures and querySource give the string id of a GeoJSON feature and the number for a string of digits, and setFeatureState takes a string id (#528)`,
            textId.square.join('|') === '"square-a"|"square-a"|"square-a"|"square-a"' && textId.places.join('|') === '"louvre",12|"louvre",12' && textId.colour === 'red' && textId.state?.on === true
            && textId.digits === 'true' && textId.digitsRemoved === 'none', JSON.stringify(textId));
        check(`[${renderer}] queryFeatures: radius widens a query for drawn features, its default is 3 as in querySource, and querySource of the view gives geometry only with geometry: true (#1150)`,
            radius.on === 1 && radius.near === 1 && radius.nearZero === 0 && radius.viewGeometry === 'false' && radius.viewGeometryOn === 'LineString' && radius.small === 0 && radius.point === 1 && radius.position === 1 && radius.data === 1 && radius.dataDefault === 0 && radius.layer === 'own-line', JSON.stringify(radius));

        // 3d. A GeoJSON line with longitudes past 180° is drawn on the far side of the antimeridian too, as in MapLibre (#197).
        const pastAntimeridian = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const line = {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[150, 40], [210, 40]]}};
            // The centre is at -170°, which is 190° of the line.
            const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: []}, initialView: {center: [-170, 40], zoom: 3}, renderer, attribution: false,
                sources: {own: {type: 'geojson', data: line}}, layers: [{id: 'own-line', type: 'line', source: 'own', paint: {'line-width': 4}}]});
            await new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const hits = (await host.queryFeatures({x: 100, y: 75}, {layers: ['own-line'], radius: 3})).length;
            host.destroy(); el.remove();
            return hits;
        }, renderer);
        check(`[${renderer}] a GeoJSON line with longitudes past 180° is drawn past the antimeridian`, pastAntimeridian === 1, JSON.stringify(pastAntimeridian));

        // 3e. toBlob gives the drawn map as an image in both renderers (#44): the buffer of the main renderer can be cleared after each frame.
        const blob = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-30, -30], [30, -30], [30, 30], [-30, 30], [-30, -30]]]}};
            const host = t.lib.createMap(el, {style: {version: 8, sources: {sq: {type: 'geojson', data: square}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#f00'}}, {id: 'sq', type: 'fill', source: 'sq', paint: {'fill-color': '#00f'}}]},
                initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false});
            // (A pending toBlob does not make loaded() false for the idle listeners after its own; #1454.)
            const first = host.toBlob(), idleLoaded = new Promise(r => host._map.once('idle', () => r(host._map.loaded())));
            const b = await Promise.race([first, new Promise(r => setTimeout(() => r(null), 10000))]);
            if (!b) { host.destroy(); el.remove(); return {timeout: true}; }
            const loadedAtIdle = await idleLoaded;
            const bmp = await createImageBitmap(b), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
            g.drawImage(bmp, 0, 0);
            const px = (x, y) => Array.from(g.getImageData(Math.round(x * bmp.width), Math.round(y * bmp.height), 1, 1).data);
            const jpeg = await host.toBlob('image/jpeg', 0.8);
            const later = host.toBlob(); host.destroy(); el.remove();
            const rejected = await later.then(() => 'resolved', e => e.message);
            return {type: b.type, w: bmp.width, centre: px(0.5, 0.5), corner: px(0.02, 0.02), jpeg: jpeg.type, rejected, loadedAtIdle};
        }, renderer);
        // 2c. The options of a fit are fitPadding and fitMaxZoom in initialView, moveTo and fitBounds, and the old names
        // padding and maxZoom warn in the development build and have no effect there (#1147).
        const fitNames = await page.evaluate(async renderer => {
            const t = window.t, small = [[-74.0101, 40.7101], [-74.01, 40.71]];
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const m = t.host._map, before = {center: m.getCenter().toArray(), zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch()};
            const warned = [], warn = console.warn;
            console.warn = (...a) => warned.push(a.join(' '));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const first = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: []}, initialView: {bounds: small, fitMaxZoom: 4}, renderer, attribution: false});
            const initial = Math.round(first.state.get().view.zoom * 100) / 100;
            first.destroy();
            const old = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: []}, initialView: {bounds: small, maxZoom: 4, padding: 10}, renderer, attribution: false});
            const initialOld = old.state.get().view.zoom;
            t.host.moveTo({bounds: small, fitMaxZoom: 5});
            const moved = t.host._map.getZoom();
            t.host.fitBounds(small, {fitMaxZoom: 6});
            const fitted = t.host._map.getZoom();
            t.host.moveTo({bounds: small, maxZoom: 5});
            const movedOld = t.host._map.getZoom();
            t.host.fitBounds(small, {padding: {left: 300}});
            const p = t.host._map.project([-74.01005, 40.71005]), rect = document.getElementById('host').getBoundingClientRect();
            const padded = Math.round(p.x - rect.width / 2);
            await wait(500);
            old.destroy(); el.remove();
            // (The later checks use the same map at the view that it had before.)
            t.host.moveTo(before);
            console.warn = warn;
            return {initial, initialOld, moved, fitted, movedOld, padded, warned: warned.filter(w => w.includes('is not an option of a fit'))};
        }, renderer);
        {
            const F = fitNames, said = (where, name) => F.warned.some(w => w.startsWith(`[map-jr-gl] E1147 ${where}: "${name}"`) && w.includes(`"fit${name[0].toUpperCase() + name.slice(1)}"`));
            check(`[${renderer}] fitMaxZoom limits the fit in initialView, moveTo and fitBounds (#1147)`,
                F.initial === 4 && F.moved === 5 && F.fitted === 6, JSON.stringify(F));
            check(`[${renderer}] padding and maxZoom of initialView, moveTo and fitBounds warn with the new name and have no effect (#1147)`,
                F.initialOld > 4 && F.movedOld > 5 && Math.abs(F.padded) <= 2 && said('initialView', 'maxZoom') && said('initialView', 'padding') && said('moveTo()', 'maxZoom') && said('fitBounds()', 'padding'), JSON.stringify(F));
        }

        // 2d. "view" together with "initialView.bounds": the map starts at "view", and the development build says so once (#1148).
        const viewWins = await page.evaluate(async renderer => {
            const t = window.t, warned = [], warn = console.warn;
            console.warn = (...a) => warned.push(a.join(' '));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const style = {version: 8, sources: {}, layers: []}, bounds = [[-74.0101, 40.7101], [-74.01, 40.71]];
            const both = t.lib.createMap(el, {style, view: {center: [10, 20], zoom: 3}, initialView: {bounds}, renderer, attribution: false});
            const zoom = both.state.get().view.zoom;
            both.update({style, view: {center: [11, 20], zoom: 3}, initialView: {bounds}, renderer, attribution: false});
            const only = t.lib.createMap(el, {style, initialView: {bounds}, renderer, attribution: false});
            // (The checks of the development build load on demand and run after the call.)
            await new Promise(r => setTimeout(r, 500));
            both.destroy(); only.destroy(); el.remove();
            console.warn = warn;
            return {zoom, warned: warned.filter(w => w.includes('"initialView.bounds"'))};
        }, renderer);
        check(`[${renderer}] view with initialView.bounds does not fit the bounds and warns once that view wins (#1148)`,
            viewWins.zoom === 3 && viewWins.warned.length === 1 && viewWins.warned[0].startsWith('[map-jr-gl] E1148 createMap(): ') && viewWins.warned[0].includes('"view" wins, so the map does not fit'), JSON.stringify(viewWins));

        check(`[${renderer}] a pending toBlob leaves loaded() true for the idle listeners after its own (#1454)`, blob.loadedAtIdle === true, JSON.stringify(blob));
        check(`[${renderer}] toBlob gives the drawn map as an image, and rejects after destroy (#44)`,
            blob.type === 'image/png' && blob.w >= 200 && blob.centre[2] > 200 && blob.centre[0] < 50 && blob.corner[0] > 200 && blob.corner[2] < 50 && blob.jpeg === 'image/jpeg' && /toBlob\(\): the map was removed/.test(blob.rejected), JSON.stringify(blob));

        // 3d. `initialView` takes bounds with fitPadding, and `state.view.bounds` follows moves and a new size (#266).
        const viewBounds = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: []}, initialView: {bounds: [[-10, -5], [10, 5]], fitPadding: 20}, renderer, attribution: false});
            const first = host.state.get().view;
            const changed = () => new Promise(r => { host.state.subscribe(s => s.view.bounds, () => r()); setTimeout(r, 3000); });
            let wait = changed();
            host.moveTo({center: [30, 0], zoom: 3});
            await wait;
            const moved = host.state.get().view.bounds;
            wait = changed();
            el.style.width = '400px';
            await wait;
            const wider = host.state.get().view.bounds;
            host.destroy(); el.remove();
            return {first, moved, wider};
        }, renderer);
        {
            const {first, moved, wider} = viewBounds, [[w, s], [e, n]] = first.bounds ?? [[0, 0], [0, 0]];
            // The box of 20° by 10° fits the width less 40 px of padding: 160 px for 20°, so 200 px show 25°.
            check(`[${renderer}] initialView with bounds and fitPadding fits the box, and state.view.bounds is the visible box`,
                Math.abs(first.center[0]) < 1e-6 && Math.abs(first.center[1]) < 1e-6 && Math.abs(w + 12.5) < 0.01 && Math.abs(e - 12.5) < 0.01 && s < -5 && n > 5, JSON.stringify(first));
            check(`[${renderer}] state.view.bounds follows a move and a new size of the map`,
                !!moved && moved[0][0] < 30 && moved[1][0] > 30 && !!wider && wider[1][0] - wider[0][0] > 1.9 * (moved[1][0] - moved[0][0]), JSON.stringify({moved, wider}));
        }

        // 3d. A source of `extend` gets its features from `data`; an owned view with only some fields that equals a reported view does not move the map (#33).
        const extendData = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const square = {type: 'Feature', properties: {name: 'square'}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.99, 40.70], [-73.99, 40.72], [-74.02, 40.72], [-74.02, 40.70]]]}};
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false,
                sources: {own: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'own-fill', type: 'fill', source: 'own'}]};
            const host = t.lib.createMap(el, spec);
            await idle(host);
            const before = (await host.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']})).length;
            host.update({...spec, data: {own: {type: 'FeatureCollection', features: [square]}}});
            await new Promise(r => setTimeout(r, 300)); await idle(host);
            const after = (await host.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']})).length;
            let jumps = 0; const jump = host._map.jumpTo; host._map.jumpTo = (...a) => { jumps++; return jump.apply(host._map, a); };
            host._map.jumpTo({center: [-74.0, 40.71], zoom: 13.5}); jumps = 0;
            await new Promise(r => setTimeout(r, 200));
            const v = host.state.get().view;
            host.update({...spec, data: {own: {type: 'FeatureCollection', features: [square]}}, view: {center: v.center, zoom: v.zoom}});
            host.destroy(); el.remove();
            return {before, after, jumps};
        }, renderer);
        check(`[${renderer}] extend.sources gets features from data, and a partial owned view that the map reported is not applied again`,
            extendData.before === 0 && extendData.after === 1 && extendData.jumps === 0, JSON.stringify(extendData));

        // 3d. A worker renderer keeps drawing while the page sets 10,000 points in each frame for 1 s (#856): at least 5 frames,
        // and no stretch of more than 400 ms without a frame. Without the fix, the engine worker drew no frame until the
        // updates stopped, because each update filled its queue with copies of the data. The check measures that stretch and
        // not the number of frames, because the frame rate depends on the machine: with CPU_THROTTLE=4 on 2026-11-18, the
        // fix gave 45 to 49 frames with stretches of 36 to 68 ms, and without it 0 to 2 frames with stretches of 824 to
        // 1000 ms. A CI runner drew 20 to 24 frames (about 50 ms each). The newest data that a query sees during the second
        // is not checked: it was as high without the fix. A smaller map has few tiles to build and kept up in some runs.
        const streamName = `[${renderer}] 10,000 points set in each frame for 1 s: the map draws new data during that second (#856)`;
        if (renderer === 'worker' && !await workerRenders(page)) skip(streamName, noWorkerRender);
        else if (renderer === 'worker') {
            const stream = await page.evaluate(async renderer => {
                const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:900px;height:600px'}));
                const points = v => ({type: 'FeatureCollection', features: Array.from({length: 10000}, (_, i) => ({type: 'Feature', properties: {v}, geometry: {type: 'Point', coordinates: [-74.0065 + (i % 100 - 50) * 0.0002, 40.7085 + ((i / 100 | 0) - 50) * 0.0002]}}))});
                const pre = Array.from({length: 70}, (_, i) => points(i));
                const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false,
                    sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'v-dots', type: 'circle', source: 'v', paint: {'circle-radius': 3}}]};
                const host = t.lib.createMap(el, spec);
                await new Promise(r => { const off = host.state.subscribe(s => s.idle, idle => { if (idle) { off(); r(); } }); setTimeout(r, 10000); });
                host.update({...spec, data: {v: pre[0]}});
                await new Promise(r => { const off = host.state.subscribe(s => s.idle, idle => { if (idle) { off(); r(); } }); setTimeout(r, 10000); });
                let frames = 0, newest = 0, asking = false, updates = 0, last = 0, gap = 0;
                const start = performance.now(), off = host.listen('render', () => { const now = performance.now() - start; if (now < 1000) { frames++; gap = Math.max(gap, now - last); last = now; } });
                for (let i = 1; performance.now() - start < 1000; i++, updates++) {
                    host.update({...spec, data: {v: pre[i % pre.length]}});
                    if (!asking) { asking = true; host.queryFeatures({x: 450, y: 300}, {layers: ['v-dots']}).then(f => { if (performance.now() - start < 1000) newest = Math.max(newest, ...f.map(x => x.properties.v)); asking = false; }, () => {}); }
                    await new Promise(r => requestAnimationFrame(r));
                }
                gap = Math.round(Math.max(gap, 1000 - last));
                const used = host.state.get().renderer;
                off(); host.destroy(); el.remove();
                return {frames, updates, gap, newest, used};
            }, renderer);
            if (stream.used !== 'worker') skip(streamName, 'the map fell back to the main thread');
            else check(streamName, stream.frames >= 5 && stream.gap <= 400, JSON.stringify(stream));
        }

        // 3d. setFeatureState and removeFeatureState of the host: queryFeatures reads the state, the fill draws it, and a new style keeps it (#485).
        const featureState = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const square = {type: 'Feature', id: 7, properties: {}, geometry: {type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]]}};
            const base = () => ({version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]});
            const spec = {style: base(), initialView: {center: [0, 0], zoom: 5}, renderer, attribution: false,
                sources: {own: {type: 'geojson', data: {type: 'FeatureCollection', features: [square]}}}, layers: [{id: 'own-fill', type: 'fill', source: 'own', paint: {'fill-color': ['case', ['boolean', ['feature-state', 'on'], false], '#f00', '#00f']}}]};
            const host = t.lib.createMap(el, spec);
            const red = async () => { const b = await host.toBlob(), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : Object.assign(document.createElement('canvas'), {width: 1, height: 1})).getContext('2d'), i = await createImageBitmap(b); c.drawImage(i, i.width / 2, i.height / 2, 1, 1, 0, 0, 1, 1); const [r, , bl] = c.getImageData(0, 0, 1, 1).data; return r > 200 && bl < 50 ? 'red' : bl > 200 && r < 50 ? 'blue' : `${r},${bl}`; };
            const read = async () => (await host.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']}))[0]?.state;
            const settle = async () => { await new Promise(r => setTimeout(r, 300)); await idle(host); };
            await idle(host);
            host.setFeatureState({source: 'own', id: 7}, {on: true, n: 1});
            await settle();
            const set = {state: await read(), colour: await red()};
            host.update({...spec, style: base()});
            await settle();
            const restyled = {state: await read(), colour: await red()};
            host.removeFeatureState({source: 'own', id: 7}, 'on');
            await settle();
            const removed = {state: await read(), colour: await red()};
            host.destroy(); el.remove();
            let after = 'none'; try { host.setFeatureState({source: 'own', id: 7}, {on: true}); } catch (e) { after = e.message; }
            return {set, restyled, removed, after};
        }, renderer);
        check(`[${renderer}] setFeatureState of the host: queryFeatures reads the state, the fill draws it, and a new style keeps it`,
            featureState.set.state?.on === true && featureState.set.colour === 'red' && featureState.restyled.state?.on === true && featureState.restyled.colour === 'red'
            && featureState.removed.state?.on === undefined && featureState.removed.state?.n === 1 && featureState.removed.colour === 'blue' && featureState.after === 'none', JSON.stringify(featureState));

        // 3d. toBlob right after a new style URL waits for that style, also while its answer is late (#1167).
        await page.route(/\/test-style-1167\//, async route => {
            const blue = route.request().url().includes('blue');
            if (blue || route.request().url().includes('slow')) await new Promise(r => setTimeout(r, 600));
            await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': blue ? '#00f' : '#f00'}}]})});
        });
        const lateStyle = await page.evaluate(async renderer => {
            const t = window.t, out = [];
            const colour = async b => { const c = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d'), i = await createImageBitmap(b); c.drawImage(i, i.width / 2, i.height / 2, 1, 1, 0, 0, 1, 1); const [r, , bl] = c.getImageData(0, 0, 1, 1).data; return r > 200 && bl < 50 ? 'red' : bl > 200 && r < 50 ? 'blue' : `${r},${bl}`; };
            for (let i = 0; i < 3; i++) {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
                const spec = {style: `/test-style-1167/red.json?${i}`, initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false};
                const host = t.lib.createMap(el, spec);
                await new Promise(r => host.state.subscribe(s => s.idle, v => v && r()));
                host.update({...spec, style: `/test-style-1167/blue.json?${i}`});
                out.push(await colour(await host.toBlob()));
                host.destroy(); el.remove();
            }
            // A camera move while `setStyle` with `diff` loads a style that equals the one in use: the map is idle again after it.
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const host = t.lib.createMap(el, {style: '/test-style-1167/red.json?same', initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false});
            await new Promise(r => host.state.subscribe(s => s.idle, v => v && r()));
            const idle = new Promise(r => { host._map.once('idle', () => r('idle')); setTimeout(() => r('no idle in 4 s'), 4000); });
            host._map.setStyle('/test-style-1167/slow-red.json', {diff: true}); host._map.jumpTo({zoom: 3});
            out.push(await idle);
            host.destroy(); el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] toBlob right after a new style URL shows the new style, also when the style comes 600 ms later, and a camera move during an equal style keeps idle (#1167)`, JSON.stringify(lateStyle) === '["blue","blue","blue","idle"]', JSON.stringify(lateStyle));

        // 3d. A key of `data` with no source of that id makes a GeoJSON source: in the first description, as a new key, after
        // a new style, and a removed key removes it with a warning for the layer that still names it. A key that is the id of
        // a source of another type gives an error of the map (#487).
        const madeData = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const square = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.99, 40.70], [-73.99, 40.72], [-74.02, 40.72], [-74.02, 40.70]]]}}]};
            const errors = [], said = [], warn = console.warn;
            console.warn = (...a) => { said.push(String(a[0])); warn(...a); };
            const count = async (host, layer) => (await host.queryFeatures({x: 100, y: 75}, {layers: [layer]}).catch(() => [])).length;
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false, onError: e => errors.push(e.message),
                data: {a: square}, layers: [{id: 'a-fill', type: 'fill', source: 'a'}]};
            const host = t.lib.createMap(el, spec);
            await idle(host);
            const first = await count(host, 'a-fill');
            const s2 = {...spec, data: {a: square, b: square}, layers: [...spec.layers, {id: 'b-fill', type: 'fill', source: 'b'}]};
            host.update(s2); await new Promise(r => setTimeout(r, 300)); await idle(host);
            const added = await count(host, 'b-fill');
            host.update({...s2, style: {...t.style, layers: [...t.style.layers]}}); await new Promise(r => setTimeout(r, 300)); await idle(host);
            const restyled = [await count(host, 'a-fill'), await count(host, 'b-fill')];
            host.update({...s2, data: {a: square}}); await new Promise(r => setTimeout(r, 300)); await idle(host);
            await new Promise(r => setTimeout(r, 500));
            const removed = !host._map.getSource('b');
            const wrong = Object.keys(t.style.sources).find(id => t.style.sources[id].type !== 'geojson');
            host.update({...s2, data: {a: square, [wrong]: square}}); await new Promise(r => setTimeout(r, 300));
            console.warn = warn; host.destroy(); el.remove();
            return {first, added, restyled, removed, errors, said: said.filter(w => w.includes('"b-fill"'))};
        }, renderer);
        check(`[${renderer}] a key of data with no source makes a GeoJSON source, also as a new key and after a new style; a removed key removes it, and a key of a source of another type is an error`,
            madeData.first === 1 && madeData.added === 1 && madeData.restyled + '' === '1,1' && madeData.removed && madeData.errors.length === 1 && madeData.errors[0].startsWith('[map-jr-gl] E487 data: the source ')
            && madeData.said.length === 1 && madeData.said[0].startsWith('[map-jr-gl] E2 the layer "b-fill" uses the source "b"'), JSON.stringify(madeData));

        // 3d. A paint or layout property that the style specification does not have for the type of the layer warns once
        // for each layer and property in the development build, with the nearest name: in the first description and in a
        // layer that an update() adds as an edit (#1139).
        const unknownProps = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const said = [], warn = console.warn;
            console.warn = (...a) => { said.push(String(a[0])); warn(...a); };
            const point = {type: 'Point', coordinates: [-74.0065, 40.7085]};
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false, data: {p: point},
                layers: [{id: 'p-circle', type: 'circle', source: 'p', paint: {'circle-colour': 'red', 'circle-radius': 4}}]};
            const host = t.lib.createMap(el, spec);
            await new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); });
            const s2 = {...spec, layers: [...spec.layers, {id: 'p-line', type: 'line', source: 'p', layout: {'line-capp': 'round'}}]};
            host.update(s2); await new Promise(r => setTimeout(r, 300));
            host.update({...s2, layers: s2.layers.map(l => ({...l}))});
            await new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 3000); });
            await new Promise(r => setTimeout(r, 300));
            console.warn = warn; host.destroy(); el.remove();
            return said.filter(w => / property "/.test(w));
        }, renderer);
        check(`[${renderer}] an unknown paint or layout property warns once for each layer and property with the nearest name in the development build (#1139)`,
            unknownProps.length === 2 && unknownProps[0].startsWith('[map-jr-gl] E1139 the circle layer "p-circle", paint property "circle-colour":') && unknownProps[0].endsWith('Write "circle-color".')
            && unknownProps[1].startsWith('[map-jr-gl] E1139 the line layer "p-line", layout property "line-capp":') && unknownProps[1].endsWith('Write "line-cap".'), JSON.stringify(unknownProps));

        // 3d. A layer that an update() adds as an edit is checked at the update() call, before the map is next idle: its
        // unknown property (#1139) and its zoom curve (#1087) warn then, once each (#1684).
        const editChecked = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const said = [], warn = console.warn;
            console.warn = (...a) => { said.push(String(a[0])); warn(...a); };
            const point = {type: 'Point', coordinates: [-74.0065, 40.7085]};
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false, data: {p: point},
                layers: [{id: 'p-circle', type: 'circle', source: 'p', paint: {'circle-radius': 4}}]};
            const host = t.lib.createMap(el, spec);
            await new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); });
            // (The check of that idle runs after its file has loaded: the update waits for it, or that check would see the new layer.)
            await new Promise(r => setTimeout(r, 300));
            // (The warnings that are there when the map fires its next idle: the check at idle comes after this listener.)
            const atIdle = new Promise(r => { host._map.once('idle', () => r(said.filter(w => /"p-dot"/.test(w)))); setTimeout(() => r(null), 5000); });
            const s2 = {...spec, layers: [...spec.layers, {id: 'p-dot', type: 'circle', source: 'p', paint: {'circle-colr': 'red', 'circle-radius': ['+', 1, ['interpolate', ['linear'], ['zoom'], 0, 1, 20, 8]]}}]};
            host.update(s2);
            const before = await atIdle;
            host.update({...s2, layers: s2.layers.map(l => ({...l}))});
            await new Promise(r => setTimeout(r, 500));
            console.warn = warn; host.destroy(); el.remove();
            return {before, all: said.filter(w => /"p-dot"/.test(w))};
        }, renderer);
        check(`[${renderer}] a layer that update() adds as an edit warns for its unknown property and zoom curve before the next idle, once each, in the development build (#1684)`,
            editChecked.before?.length === 2 && editChecked.all.length === 2 && editChecked.all.some(w => w.startsWith('[map-jr-gl] E1139 the circle layer "p-dot", paint property "circle-colr":'))
            && editChecked.all.some(w => w.startsWith('[map-jr-gl] E1057 the layer "p-dot", paint property "circle-radius":')), JSON.stringify(editChecked));

        // 3d. An update() that changes only `extend` or `images` sets state.idle to false, and back to true when drawn (#411).
        const idleAgain = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const next = host => new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(true); } }); setTimeout(() => { off(); r(false); }, 8000); });
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false,
                sources: {own: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'own-fill', type: 'fill', source: 'own', paint: {'fill-color': '#f00'}}]};
            const host = t.lib.createMap(el, spec);
            await next(host);
            // (The same arrays and objects again are not serialized to compare them.)
            let reads = 0; Object.defineProperty(spec.layers, 'toJSON', {value() { reads++; return [...this]; }});
            host.update({...spec}); const sameFree = reads === 0;
            const s2 = {...spec, layers: [{...spec.layers[0], paint: {'fill-color': '#00f'}}]};
            host.update(s2);
            const extendBusy = !host.state.get().idle, extendIdle = await next(host);
            host.update({...s2, images: {dot: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>'}});
            await new Promise(r => setTimeout(r, 500));
            const imagesIdle = host.state.get().idle || await next(host);
            host.destroy(); el.remove();
            return {extendBusy, extendIdle, imagesIdle, sameFree};
        }, renderer);
        check(`[${renderer}] update() that changes only extend or images sets state.idle to false and then to true again`,
            idleAgain.extendBusy && idleAgain.extendIdle && idleAgain.imagesIdle && idleAgain.sameFree, JSON.stringify(idleAgain));

        // 3d. A change of `extend` alone is applied as edits: the style URL is not requested again, and a layer that was added through `host._map` stays (#166).
        const extendEdit = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.99, 40.70], [-73.99, 40.72], [-74.02, 40.72], [-74.02, 40.70]]]}};
            const fill = (color, visibility = 'visible') => ({id: 'own-fill', type: 'fill', source: 'own', paint: {'fill-color': color}, layout: {visibility}});
            const spec = {style: '/style.json', initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false};
            const ext = (...layers) => ({sources: {own: {type: 'geojson', data: square}}, layers});
            const host = t.lib.createMap(el, {...spec, ...ext(fill('#f00'))});
            await idle(host);
            host._map.addLayer({id: 'app-layer', type: 'background', paint: {'background-color': '#00f'}});
            const requests = () => performance.getEntriesByType('resource').filter(e => e.name.endsWith('/style.json')).length, first = requests();
            let restyles = 0; const setStyle = host._map.setStyle; host._map.setStyle = (...a) => { restyles++; return setStyle.apply(host._map, a); };
            const at = {x: 100, y: 75}, hits = async () => (await host.queryFeatures(at, {layers: ['own-fill']})).length;
            const out = {};
            host.update({...spec, ...ext(fill('#0f0'))}); await idle(host);
            out.paint = host._map.getLayer('own-fill')?.paint?.['fill-color'];
            host.update({...spec, ...ext(fill('#0f0', 'none'))}); await idle(host);
            out.hidden = host._map.getLayer('own-fill')?.layout?.visibility;
            host.update({...spec, sources: {own: {type: 'geojson', data: square}, two: {type: 'geojson', data: square}}, layers: [fill('#0f0'), {id: 'two-line', type: 'line', source: 'two'}]}); await idle(host);
            out.added = !!host._map.getSource('two') && !!host._map.getLayer('two-line');
            out.hits = await hits();
            host.update({...spec, ...ext(fill('#0f0'))}); await idle(host);
            out.removed = !host._map.getSource('two') && !host._map.getLayer('two-line');
            out.app = !!host._map.getLayer('app-layer');
            out.restyles = restyles; out.requests = requests() - first;
            host.destroy(); el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] a change of extend alone edits the map: no new style request, and a layer added through host._map stays`,
            extendEdit.paint === '#0f0' && extendEdit.hidden === 'none' && extendEdit.added && extendEdit.hits === 1 && extendEdit.removed && extendEdit.app && extendEdit.restyles === 0 && extendEdit.requests === 0, JSON.stringify(extendEdit));

        // 3d. The edits of `extend` leave the description as it was, work for two maps with one `extend` object, and give
        // back a source of the style that an extend source replaced (#184).
        const extendCases = await page.evaluate(async renderer => {
            const t = window.t, idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const div = () => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.99, 40.70], [-73.99, 40.72], [-74.02, 40.72], [-74.02, 40.70]]]}};
            const spec = {style: '/style.json', initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false};
            const ext = (color, more = []) => ({sources: {own: {type: 'geojson', data: square}}, layers: [{id: 'own-fill', type: 'fill', source: 'own', paint: {'fill-color': color}}, ...more]});
            const color = h => h._map.getLayer('own-fill')?.paint?.['fill-color'], out = {};
            const red = ext('#f00'), green = ext('#0f0');
            const [a, b] = [div(), div()].map(el => t.lib.createMap(el, {...spec, ...red}));
            await Promise.all([idle(a), idle(b)]);
            a.update({...spec, ...green}); await idle(a);
            a.update({...spec, ...red}); await idle(a);
            out.back = color(a); out.description = red.layers[0].paint['fill-color'];
            b.update({...spec, ...green}); await idle(b);
            out.second = color(b);
            const o = t.lib.createMap(div(), {...spec, sources: {omt: {type: 'geojson', data: square}}}); await idle(o);
            o.update({...spec, sources: undefined, layers: undefined}); await idle(o);
            out.styleSource = o._map.getSource('omt')?.type;
            for (const h of [a, b, o]) h.destroy();
            return out;
        }, renderer);
        check(`[${renderer}] extend edits keep the description, work for two maps with one extend object and give back a style source`,
            extendCases.back === '#f00' && extendCases.description === '#f00' && extendCases.second === '#0f0' && extendCases.styleSource === 'vector', JSON.stringify(extendCases));

        // 3e. Common mistakes: each gives one warning that says what to write, and a correct description gives none.
        const warnings = await page.evaluate(async renderer => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), said = [], log = console.warn;
            // (The fallback of renderer 'worker' to the main thread warns where a worker cannot render, #792: not a mistake, #813.)
            console.warn = (...a) => { const m = a.join(' '); if (!m.startsWith('[map-jr-gl] E798 Worker rendering unavailable')) said.push(m); };
            const div = style => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;' + style}));
            const idle = host => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 8000); });
            const empty = {type: 'FeatureCollection', features: []}, dot = '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>';
            const base = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false, onError: () => {}};
            // A correct description, with each of the fields that the checks read.
            const goodEl = div('height:150px'), good = t.lib.createMap(goodEl, {...base, interactiveLayers: ['own-fill'], data: {own: empty}, images: {dot},
                sources: {own: {type: 'geojson', data: empty}}, layers: [{id: 'own-fill', type: 'fill', source: 'own', before: t.style.layers[1].id}]});
            await idle(good);
            await good.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']});
            await good.querySource('own', {x: 100, y: 75}, {radius: 5, geometry: false, zoom: 14});
            await good.queryFeatures([-74.0065, 40.7085], {layers: ['own-fill'], radius: 5});
            await good.querySource('omt', {sourceLayers: ['water']});
            // An application that adds the layer and the source itself in `load`: the ids are compared after that.
            const ownEl = div('height:150px'), own = t.lib.createMap(ownEl, {...base, interactiveLayers: ['later'], data: {'later-source': empty}});
            own.listen('load', () => { own._map.addSource('later-source', {type: 'geojson', data: empty}); own._map.addLayer({id: 'later', type: 'fill', source: 'later-source'}); });
            await idle(own);
            // A container that is hidden, and one that is not in the page yet, when the map is made: no warning for the height.
            const hiddenEl = div('height:150px;display:none'), hidden = t.lib.createMap(hiddenEl, base);
            setTimeout(() => { hiddenEl.style.display = ''; }, 500);
            const lateEl = Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:200px'}), late = t.lib.createMap(lateEl, base);
            document.body.appendChild(lateEl);
            await wait(1500);
            const correct = said.splice(0);
            for (const [el, host] of [[ownEl, own], [hiddenEl, hidden], [lateEl, late]]) { host.destroy(); el.remove(); }
            // The same map with mistakes.
            const spec = {...base, interactiveLayers: ['nope'], data: {nosuch: empty},
                images: {dot: '<svg viewBox="0 0 4 4"><rect width="4" height="4" fill="{{fill}}"/></svg>'},
                sources: {icons: {type: 'geojson', data: empty}}, layers: [{id: 'lost', type: 'fill', source: 'missing', before: 'nonexistent'}, {id: 'icons', type: 'symbol', source: 'icons', layout: {'icon-image': ['image', 'dot', {params: {fill: '#d00', colour: '#00d'}}]}},
                    {id: 'labels', type: 'symbol', source: 'icons', layout: {'text-field': ['format', ['image', 'dot', {params: {fill: '#d00', size: '2'}}], {}]}}]};
            const badEl = div('height:150px'), bad = t.lib.createMap(badEl, spec);
            await idle(bad);
            for (let i = 0; i < 2; i++) { // (twice: a warning comes once)
                // (The second time, the template is replaced by one without the slot {{fill}}.)
                bad.update({...spec, interactive: false, initialView: {center: [0, 0], zoom: 2}, images: i ? {dot: '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'} : spec.images});
                await bad.queryFeatures({x: 100, y: 75}, {layers: ['nope']}).catch(() => {});
                await bad.querySource('nope', {x: 100, y: 75}, {layers: ['lost']}).catch(() => {});
                await bad.queryFeatures({x: 100, y: 75}, {sourceLayers: ['water'], sources: ['omt'], radius: 5}).catch(() => {});
                await bad.queryFeatures({layers: ['nope'], radius: 5}).catch(() => {});
                await bad.querySource('omt', {radius: 5, geometry: false, zoom: 14}).catch(() => {});
                await bad.queryFeatures([{x: 0, y: 0}, {x: 100, y: 75}], {radius: 5}).catch(() => {});
            }
            const place = await bad.queryFeatures({lng: -74.0065, lat: 40.7085}).then(() => '', e => e.message);
            const flatEl = div('height:0'), flat = t.lib.createMap(flatEl, base);
            await wait(1500);
            for (const [el, host] of [[goodEl, good], [badEl, bad], [flatEl, flat]]) { host.destroy(); el.remove(); }
            console.warn = log;
            return {correct, said, place};
        }, renderer);
        const expected = ['E0 createMap(): the container has height 0', 'E1 interactiveLayers: the style has no layer "nope"', 'E3 queryFeatures(): the style has no layer "nope"',
            'E4 querySource(): the style has no source "nope"', 'E5 layers: the layer "lost" has before: "nonexistent"', 'E6 layers: the layer "lost" uses the source "missing"', 'E14 images: a layer gives the parameter "colour" to the image "dot"', 'E14 images: a layer gives the parameter "size" to the image "dot"', 'E14 images: a layer gives the parameter "fill" to the image "dot"',
            'E8 update(): "interactive" changed', 'E8 update(): "initialView" changed', 'E12 queryFeatures(): "sourceLayers" is not an option', 'E12 queryFeatures(): "sources" is not an option', 'E13 queryFeatures(): "radius" has an effect only in a query at a point or a position',
            'E13 querySource(): "radius" has an effect only', 'E11 querySource(): "zoom" has an effect only', 'E12 querySource(): "layers" is not an option'];
        check(`[${renderer}] common mistakes: each gives one warning, a wrong place of a query is refused with a message, and a correct description gives no warning`,
            warnings.correct.length === 0 && warnings.said.length === expected.length && expected.every(e => warnings.said.filter(w => w.startsWith('[map-jr-gl] ' + e)).length === 1)
            && warnings.place.startsWith('[map-jr-gl] E9 queryFeatures(): {"lng":-74.0065,"lat":40.7085} is not a place.'), JSON.stringify(warnings));

        // 3f. A style whose root names a projection that the library does not draw: one warning per map, also after setStyle;
        // mercator gives none (#238). The globe gives none for itself (#463), nor for its buildings, which it draws (#1429).
        const proj = await page.evaluate(async renderer => {
            const t = window.t, said = [], log = console.warn;
            console.warn = (...a) => { const m = a.join(' '); if (m.includes('projection')) said.push(m); };
            const div = () => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const idle = host => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 8000); });
            const base = {initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false, onError: () => {}};
            const merc = t.lib.createMap(div(), {...base, style: {...t.style, projection: {type: 'mercator'}}});
            await idle(merc);
            const mercSaid = said.length;
            const other = t.lib.createMap(div(), {...base, style: {...t.style, projection: {type: 'identity'}}});
            await idle(other);
            other._map.setStyle({...t.style, projection: {type: 'identity'}});
            await idle(other);
            const otherSaid = said.splice(0);
            const globe = t.lib.createMap(div(), {...base, style: {...t.style, projection: {type: 'globe'}}});
            await idle(globe);
            globe._map.setStyle({...t.style, projection: {type: 'globe'}});
            await idle(globe);
            console.warn = log;
            merc.destroy(); other.destroy(); globe.destroy();
            return {mercSaid, otherSaid, globeSaid: said};
        }, renderer);
        check(`[${renderer}] a style with the projection "identity" writes one warning, "mercator" none, and "globe" none, also for its buildings`,
            proj.mercSaid === 0 && proj.otherSaid.length === 1 && proj.otherSaid[0] === '[map-jr-gl] E238 The style has the projection "identity", which is not supported, so the map uses "mercator".'
            && proj.globeSaid.length === 0, JSON.stringify(proj));

        // 3b. A description with no style (only the changed fields) throws at once with a message, and the map is not harmed.
        const partial = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), said = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
            const update = said(() => t.host.update({cursor: 'crosshair'})), none = said(() => t.host.update(undefined));
            const create = said(() => t.lib.createMap(document.createElement('div'), {initialView: {zoom: 2}}));
            await wait(500);
            return {update, none, create, drawn: (await t.host.queryFeatures([{x: 0, y: 0}, {x: 900, y: 600}])).length};
        });
        check(`[${renderer}] a description with no style: update and createMap throw and say what to write, and the map still draws`,
            partial.update.startsWith('[map-jr-gl] E57 update(): the description has no "style".') && partial.update.includes('map.patch({cursor: ') && partial.none.startsWith('[map-jr-gl] E57 update()')
            && partial.create.startsWith('[map-jr-gl] E57 createMap(): the description has no "style".') && partial.drawn > 0 && !errors.length, JSON.stringify({...partial, errors}));

        // 4. Points for a symbol layer (#499): a key of `data` with `points()` and a layer of `layers`. New data is no new
        // style, and data that comes with a change of the layer is not lost.
        const pins = await page.evaluate(async () => {
            // A query that does not settle within 5 s gives a mark that fails the check, so that it cannot hold the run (#997).
            const t = window.t, map = t.host._map, wait = ms => new Promise(r => setTimeout(r, ms)), stuck = [];
            const query = (point, step) => Promise.race([t.host.queryFeatures(point, {layers: ['pins']}), wait(5000).then(() => (stuck.push(step), []))]);
            const at = step => query({x: 450, y: 300}, step);
            const centre = t.host.unproject({x: 450, y: 300}), points = list => t.lib.points(list, {lngLat: p => p.lngLat, id: p => p.id, properties: p => ({color: p.color})});
            const layer = layout => ({id: 'pins', type: 'symbol', source: 'pins', layout: {'icon-image': 'disc', 'icon-allow-overlap': true, 'icon-ignore-placement': true, ...layout}});
            t.host.update(t.spec = {...t.spec, images: {disc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>'}, data: {...t.spec.data, pins: points([{id: 1, lngLat: centre, color: '#d00'}])}, layers: [...t.spec.layers ?? [], layer()]});
            await wait(900);
            const one = await at('one'), top = map.getStyle().layers.at(-1).id;
            // Other data: the points move, and the style is the same.
            let restyled = 0;
            const count = () => restyled++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, data: {...t.spec.data, pins: points([{id: 1, lngLat: [centre[0] + 1, centre[1]], color: '#d00'}])}});
            await wait(700);
            const moved = (await at('moved')).length;
            t.host.update(t.spec = {...t.spec, data: {...t.spec.data, pins: points([{id: 1, lngLat: [0, 0]}, {id: 2, lngLat: centre, color: '#00d'}])}});
            await wait(700);
            const back = await at('back'), sameStyle = restyled === 0;
            map.off('style.load', count);
            // Another layout and other data at once: the source gets the data.
            t.host.update(t.spec = {...t.spec, layers: [...t.spec.layers.filter(l => l.id !== 'pins'), layer({'icon-anchor': 'top'})]});
            t.host.update(t.spec = {...t.spec, data: {...t.spec.data, pins: points([{id: 3, lngLat: centre, color: '#0a0'}])}});
            await wait(1200);
            const late = await query({x: 450, y: 310}, 'late');
            const {images: _, ...rest} = t.spec, {pins: __, ...data} = rest.data;
            t.host.update(t.spec = {...rest, data, layers: rest.layers.filter(l => l.id !== 'pins')});
            await wait(700);
            return {one: one.length, id: one[0]?.id, top, moved, back: back.length, index: back[0]?.id, color: back[0]?.properties.color, sameStyle,
                late: late.map(f => f.id + ' ' + f.properties.color).join(), none: !map.getLayer('pins') && !map.getSource('pins'), stuck};
        });
        check(`[${renderer}] points() in data and a symbol layer in layers: the points are features with their ids, new data is no new style, and data that comes with a change of the layer is not lost`,
            pins.one === 1 && pins.id === 1 && pins.top === 'pins' && pins.moved === 0 && pins.back === 1 && pins.index === 2 && pins.color === '#00d' && pins.sameStyle
            && pins.late === '3 #0a0' && pins.none && !pins.stuck.length, JSON.stringify(pins));

        // A key of `data` that names a source of `sources` (#857): the map does not write the data into the source object
        // of the description, so that an update with a copy of the same description is no new style.
        const declared = await page.evaluate(async () => {
            const t = window.t, map = t.host._map, wait = ms => new Promise(r => setTimeout(r, ms));
            const empty = () => ({type: 'FeatureCollection', features: []});
            const point = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]};
            const v = {type: 'geojson', data: empty()};
            t.host.update(t.spec = {...t.spec, sources: {...t.spec.sources, v}, data: {...t.spec.data, v: point}});
            await wait(900);
            let restyled = 0;
            const count = () => restyled++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, sources: {...t.spec.sources, v: {type: 'geojson', data: empty()}}, data: {...t.spec.data}});
            await wait(700);
            map.off('style.load', count);
            const unchanged = v.data.features.length === 0 && Object.keys(v).length === 2;
            const {v: _, ...sources} = t.spec.sources, {v: __, ...data} = t.spec.data;
            t.host.update(t.spec = {...t.spec, sources, data});
            await wait(500);
            return {restyled, unchanged};
        });
        check(`[${renderer}] data for a source of sources: the source object of the description is unchanged, and an update with an equal description is no new style (#857)`,
            declared.restyled === 0 && declared.unchanged, JSON.stringify(declared));

        {
        // Images: added, replaced and removed by the description. A symbol layer draws a square of 40 pixels at the centre.
        // (The colour of the square is read from a picture of the page, at two places inside the square.)
        const colourAt = async () => page.evaluate(async png => {
            const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = Object.assign(document.createElement('canvas'), {width: bitmap.width, height: bitmap.height}).getContext('2d');
            c.drawImage(bitmap, 0, 0);
            return [[438, 288], [462, 312]].map(([x, y]) => '#' + [...c.getImageData(x, y, 1, 1).data.slice(0, 3)].map(v => (v >> 4).toString(16)).join(''));
        }, (await page.screenshot()).toString('base64'));
        const shows = async colour => { let got; for (let i = 0; i < 40 && !(got = await colourAt()).includes(colour); i++) await page.waitForTimeout(150); return got.includes(colour) ? colour : got.join(' '); };
        const images = await page.evaluate(async () => {
            const t = window.t, map = t.host._map, c = t.host.unproject({x: 450, y: 300}), add = map.addImage;
            t.square = colour => `<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="${colour}"/></svg>`;
            t.added = []; t.imageErrors = [];
            map.addImage = function (name, ...rest) { t.added.push(name); return add.call(this, name, ...rest); };
            const style = {...t.style, sources: {...t.style.sources, spot: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: c}}}},
                layers: [...t.style.layers, {id: 'spot', type: 'symbol', source: 'spot', layout: {'icon-image': 'square', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]};
            t.host.update(t.spec = {...t.spec, style, images: {square: t.square('#f0f')}, onError: e => t.imageErrors.push(e.message)});
        });
        const first = await shows('#f0f');
        // The same content in a new object is the same image. Then other content with options: the image is replaced.
        const again = await page.evaluate(() => { const t = window.t, n = t.added.length; t.host.update(t.spec = {...t.spec, images: {square: t.square('#f0f')}}); const same = t.added.length - n;
            t.host.update(t.spec = {...t.spec, images: {square: {image: t.square('#0ff'), width: 40, height: 40}}}); return same; });
        const replaced = await shows('#0ff');
        // Two changes at once: the last one stays, also when the image of the first is ready later.
        await page.evaluate(() => { const t = window.t; t.host.update({...t.spec, images: {square: t.square('#0f0')}}); t.host.update(t.spec = {...t.spec, images: {square: t.square('#00f')}}); });
        const last = await shows('#00f');
        await page.waitForTimeout(500);
        const stays = (await colourAt()).includes('#00f');
        // An image that does not load is an error with the name of the image, and the map goes on. A description without the field removes the images.
        const gone = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            t.host.update(t.spec = {...t.spec, images: {square: t.square('#00f'), lost: '/no-such-image.png'}});
            for (let i = 0; i < 50 && !t.imageErrors.length; i++) await wait(100);
            // (An image that is added and removed at once does not come back when it is ready.)
            t.host.update({...t.spec, images: {...t.spec.images, late: t.square('#f00')}});
            const {images: _, onError: __, ...rest} = t.spec;
            t.host.update(t.spec = rest);
            return {errors: t.imageErrors, has: t.host._map.hasImage('square')};
        });
        await page.waitForTimeout(700);
        const after = await colourAt(), late = await page.evaluate(() => window.t.host._map.hasImage('late'));
        await page.evaluate(() => { const t = window.t; delete t.host._map.addImage; t.host.update(t.spec = {...t.spec, style: t.style}); });
        check(`[${renderer}] images follow the description: added, the same content is not added again, replaced, the last of two changes stays, removed, and an image that does not load is an error`,
            first === '#f0f' && again === 0 && replaced === '#0ff' && last === '#00f' && stays && !gone.has && !late && !after.includes('#00f') && gone.errors.length === 1 && gone.errors[0].startsWith('[map-jr-gl] E20121 images: the image "lost" did not load.'),
            JSON.stringify({first, again, replaced, last, stays, gone, late, after}));

        // Images of the style in metadata["map-jr:images"] (#495): drawn, replaced by an image of `images` with the same
        // name, kept by an update of `images`, removed with the style, and bounded. A URL goes through transformRequest.
        await page.evaluate(() => {
            const t = window.t, c = t.host.unproject({x: 450, y: 300});
            t.imageErrors = []; t.kinds = [];
            t.withImages = images => ({...t.style, metadata: {...t.style.metadata, 'map-jr:images': images}, sources: {...t.style.sources, spot: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: c}}}},
                // (An image of the style is requested when a layer asks for it (#628): the layer `far` asks for the URL.)
                layers: [...t.style.layers, {id: 'spot', type: 'symbol', source: 'spot', layout: {'icon-image': 'square', 'icon-allow-overlap': true, 'icon-ignore-placement': true}},
                    {id: 'far', type: 'symbol', source: 'spot', layout: {'icon-image': 'far', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]});
            t.host.update(t.spec = {...t.spec, style: t.withImages({square: t.square('#f80'), unused: t.square('#123'), far: '/no-such-style-image.png', outside: '<svg viewBox="0 0 4 4"><image href="https://example.com/a.png"/></svg>'}),
                transformRequest: (url, kind) => { if (url.includes('no-such-style-image')) t.kinds.push(kind); }, onError: e => t.imageErrors.push(e.message)});
        });
        const ofStyle = await shows('#f80');
        // (#628: the map draws an image of the style when a layer asks for it, and not an image that no layer names.)
        const onDemand = await page.evaluate(() => [window.t.host._map.hasImage('square'), window.t.host._map.hasImage('unused')]);
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, images: {square: t.square('#0f0')}}); });
        const overridden = await shows('#0f0');
        await page.evaluate(() => { const t = window.t, {images: _, ...rest} = t.spec; t.host.update(t.spec = rest); });
        const back = await shows('#f80');
        const styleGone = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), {transformRequest: _, onError: __, ...rest} = t.spec;
            for (let i = 0; i < 30 && t.imageErrors.length < 2; i++) await wait(100);
            const errors = [...t.imageErrors];
            t.host.update(t.spec = {...rest, style: t.style});
            for (let i = 0; i < 30 && t.host._map.hasImage('square'); i++) await wait(100);
            return {errors, kinds: t.kinds, has: t.host._map.hasImage('square')};
        });
        check(`[${renderer}] images of the style in metadata["map-jr:images"]: drawn, replaced by images of the description, removed with the style, an SVG with a reference to another file is left out, and a URL goes through transformRequest as Image`,
            ofStyle === '#f80' && onDemand[0] && !onDemand[1] && overridden === '#0f0' && back === '#f80' && !styleGone.has && styleGone.kinds.includes('Image')
            && styleGone.errors.some(e => e.startsWith('[map-jr-gl] E20495 the style: the image "outside"')) && styleGone.errors.some(e => e.startsWith('[map-jr-gl] E20121 the style: the image "far" did not load')),
            JSON.stringify({ofStyle, onDemand, overridden, back, styleGone}));

        // A sprite of the description (#495): added to the sprite of the style, its images named `id:name` in icon-image,
        // a relative URL is relative to the page, a sprite that does not load is an error and the other sprite is drawn,
        // and a description without it removes it.
        await page.route(/\/test-sprite-495\//, route => {
            const path = new URL(route.request().url()).pathname;
            if (path.includes('missing')) return route.fulfill({status: 404, body: ''});
            if (path.endsWith('.json')) return route.fulfill({contentType: 'application/json', body: JSON.stringify({box: {x: 0, y: 0, width: 40, height: 40, pixelRatio: 1}})});
            route.fulfill({contentType: 'image/png', body: solidPNG(40, [0x88, 0x00, 0xff])});
        });
        await page.evaluate(() => {
            const t = window.t, c = t.host.unproject({x: 450, y: 300});
            t.imageErrors = [];
            t.host.update(t.spec = {...t.spec, style: {...t.style, sources: {...t.style.sources, spot: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: c}}}},
                layers: [...t.style.layers, {id: 'spot', type: 'symbol', source: 'spot', layout: {'icon-image': 'pins:box', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]},
            sprite: [{id: 'pins', url: '/test-sprite-495/pins'}, {id: 'gone', url: '/test-sprite-495/missing'}], onError: e => t.imageErrors.push(e.message)});
        });
        const ofSprite = await shows('#80f');
        const spriteGone = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), {sprite: _, ...rest} = t.spec;
            for (let i = 0; i < 30 && !t.imageErrors.length; i++) await wait(100);
            const errors = [...t.imageErrors];
            t.host.update(t.spec = rest);
            return errors;
        });
        await page.waitForTimeout(1500);
        const withoutSprite = (await colourAt()).join(' ');
        await page.evaluate(() => { const t = window.t, {onError: _, ...rest} = t.spec; t.host.update(t.spec = {...rest, style: t.style}); });
        check(`[${renderer}] a sprite of the description: added to the sprite of the style and named id:name, a sprite that does not load is an error, and the sprite goes with the field`,
            ofSprite === '#80f' && spriteGone.some(e => e.includes('test-sprite-495/missing')) && !withoutSprite.includes('#80f'),
            JSON.stringify({ofSprite, spriteGone, withoutSprite}));

        // #1199: an image of metadata["map-jr:images"] takes the place of the sprite image of the same name, and an image
        // of `images` of the description takes the place of both.
        await page.route(/\/test-sprite-1199\//, route => route.request().url().includes('.json')
            ? route.fulfill({contentType: 'application/json', body: JSON.stringify({square: {x: 0, y: 0, width: 40, height: 40, pixelRatio: 1}})})
            : route.fulfill({contentType: 'image/png', body: solidPNG(40, [0x88, 0x00, 0xff])}));
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, style: {...t.withImages({square: t.square('#f80')}), sprite: location.origin + '/test-sprite-1199/s'}}); });
        const styleOverSprite = await shows('#f80');
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, images: {square: t.square('#0f0')}}); });
        const descriptionOverBoth = await shows('#0f0');
        await page.evaluate(() => { const t = window.t, {images: _, ...rest} = t.spec; t.host.update(t.spec = {...rest, style: t.style}); });
        check(`[${renderer}] an image of metadata["map-jr:images"] takes the place of the sprite image of the same name, and an image of images takes the place of both (#1199)`,
            styleOverSprite === '#f80' && descriptionOverBoth === '#0f0', JSON.stringify({styleOverSprite, descriptionOverBoth}));

        // An image that is an SVG template: each feature gives the slots their values. Two squares, the second 60 pixels to the right.
        // (Of each square, the colour of its upper half and of its lower half is read.)
        const halves = async () => page.evaluate(async png => {
            const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = Object.assign(document.createElement('canvas'), {width: bitmap.width, height: bitmap.height}).getContext('2d');
            c.drawImage(bitmap, 0, 0);
            return [[450, 290], [450, 310], [510, 290], [510, 310]].map(([x, y]) => '#' + [...c.getImageData(x, y, 1, 1).data.slice(0, 3)].map(v => (v >> 4).toString(16)).join('')).join(' ');
        }, (await page.screenshot()).toString('base64'));
        const becomes = async want => { let got; for (let i = 0; i < 40 && (got = await halves()) !== want; i++) await page.waitForTimeout(150); return got; };
        await page.evaluate(() => {
            const t = window.t, c = t.host.unproject({x: 450, y: 300}), right = t.host.unproject({x: 510, y: 300});
            const point = (id, coordinates, properties) => ({type: 'Feature', id, properties, geometry: {type: 'Point', coordinates}});
            t.tiles = icon => ({...t.style, sources: {...t.style.sources, spot: {type: 'geojson', data: {type: 'FeatureCollection', features: [point(1, c, {colour: '#f0f', kind: 'a'}), point(2, right, {colour: '#0ff', kind: 'b'})]}}},
                layers: [...t.style.layers, {id: 'spot', type: 'symbol', source: 'spot', layout: {'icon-image': icon, 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]});
            t.imageErrors = []; t.asked = [];
            t.host.listen('styleimagemissing', e => t.asked.push(e.id));
            t.host.update(t.spec = {...t.spec, style: t.tiles('tile'), images: {tile: t.square('{{colour}}')}, onError: e => t.imageErrors.push(e.message)});
        });
        const fromProperties = await becomes('#f0f #f0f #0ff #0ff');
        // `params` of the `image` expression: an expression gives the value of a slot.
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, style: t.tiles(['image', 'tile', {params: {colour: ['match', ['get', 'kind'], 'a', '#ff0', '#00f']}}])}); });
        const fromParams = await becomes('#ff0 #ff0 #00f #00f');
        // Another template with the same slots: the variants are drawn again (the upper half is black now).
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, images: {tile: '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#000"/><rect y="20" width="40" height="20" fill="{{colour}}"/></svg>'}}); });
        const otherTemplate = await becomes('#000 #ff0 #000 #00f');
        // The state of a feature in a parameter: the tiles are built again when the state changes.
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, style: t.tiles(['image', 'tile', {params: {colour: ['case', ['boolean', ['feature-state', 'on'], false], '#f00', '#0f0']}}])}); });
        const stateOff = await becomes('#000 #0f0 #000 #0f0');
        await page.evaluate(() => window.t.host._map.setFeatureState({source: 'spot', id: 2}, {on: true}));
        const stateOn = await becomes('#000 #0f0 #000 #f00');
        // `generateId: true`: each feature's id is its index in the data (0 and 1), replacing the ids 1 and 2 of the data.
        await page.evaluate(() => { const t = window.t, style = t.tiles(['image', 'tile', {params: {colour: ['case', ['boolean', ['feature-state', 'on'], false], '#f00', '#0f0']}}]);
            style.sources.spot.generateId = true; t.host._map.removeFeatureState({source: 'spot'}); t.host.update(t.spec = {...t.spec, style}); });
        const generatedOff = await becomes('#000 #0f0 #000 #0f0');
        await page.evaluate(() => window.t.host._map.setFeatureState({source: 'spot', id: 0}, {on: true}));
        const generatedOn = await becomes('#000 #f00 #000 #0f0');
        check(`[${renderer}] generateId on a GeoJSON source gives each feature its index as its id, and feature state finds it`, generatedOff === '#000 #0f0 #000 #0f0' && generatedOn === '#000 #f00 #000 #0f0', JSON.stringify({generatedOff, generatedOn}));
        // A value with characters of XML is text in the SVG and not markup: the image is drawn, and the map has no error.
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, style: t.tiles(['image', 'tile', {params: {colour: ['concat', '#0ff', '"/><rect width="40" height="40" fill="#f00']}}])}); });
        await page.waitForTimeout(1500);
        const unsafe = await halves();
        // A large template that is replaced many times: each variant takes the place in the texture of the variant before
        // it, so the texture does not fill. Then the template goes, and a plain image has its name: the page hears of no
        // image with the name of a variant. A template that is not well-formed gives one error with its name.
        const replaced30 = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const big = n => `<svg viewBox="0 0 40 40" data-n="${n}"><rect width="40" height="40" fill="{{colour}}"/></svg>`;
            t.host.update(t.spec = {...t.spec, style: t.tiles('tile')});
            for (let n = 0; n < 30; n++) { t.host.update(t.spec = {...t.spec, images: {tile: {image: big(n), width: 400, height: 400}}}); await wait(120); }
            await wait(600);
            const full = t.imageErrors.filter(e => e.includes('texture of the images')).length;
            t.host.update(t.spec = {...t.spec, images: {tile: t.square('#0ff')}});
            await wait(600);
            const asked = t.asked.filter(id => id.includes('\u001f')).length, before = t.imageErrors.length;
            t.host.update(t.spec = {...t.spec, images: {tile: '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="{{colour}}"></svg>'}});
            for (let i = 0; i < 60 && t.imageErrors.length === before; i++) await wait(100);
            await wait(500);
            return {full, asked, broken: t.imageErrors.slice(before)};
        });
        // A new image that finds no free place makes the map place its images again in an empty texture (#27): two large
        // images fill two rows, the first goes, and a wider one does not fit in its place. The map reports nothing, and
        // the squares that were placed before are drawn from their new places.
        const repack = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), r = devicePixelRatio, before = t.imageErrors.length;
            const block = (w, h) => ({image: `<svg viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#888"/></svg>`, width: w / r, height: h / r});
            const base = {tile: t.square('{{colour}}')};
            t.host.update(t.spec = {...t.spec, style: t.tiles('tile'), images: base});
            await wait(1500);
            t.host.update(t.spec = {...t.spec, images: {...base, a: block(1200, 900), b: block(1200, 900)}});
            await wait(1500);
            t.host.update(t.spec = {...t.spec, images: {...base, b: block(1200, 900)}});
            await wait(800);
            t.host.update(t.spec = {...t.spec, images: {...base, b: block(1200, 900), c: block(1500, 900)}});
            await wait(1500);
            return t.imageErrors.slice(before);
        });
        const afterRepack = await becomes('#f0f #f0f #0ff #0ff');
        check(`[${renderer}] a new image that finds no free place in the texture of the images makes the map place its images again, and they are drawn`,
            repack.length === 0 && afterRepack === '#f0f #f0f #0ff #0ff', JSON.stringify({repack, afterRepack}));
        // More different values than the limit: one error names the image, and the map goes on.
        const many = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), c = t.host.unproject({x: 450, y: 300}), before = t.imageErrors.length;
            const features = Array.from({length: 1040}, (_, i) => ({type: 'Feature', id: i, properties: {n: i}, geometry: {type: 'Point', coordinates: [c[0] + (i % 40 - 20) * 1e-4, c[1] + (Math.floor(i / 40) - 13) * 1e-4]}}));
            const style = {...t.style, sources: {...t.style.sources, lots: {type: 'geojson', data: {type: 'FeatureCollection', features}}},
                layers: [...t.style.layers, {id: 'lots', type: 'symbol', source: 'lots', layout: {'icon-image': 'tiny', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]};
            t.host.update(t.spec = {...t.spec, style, images: {tiny: '<svg viewBox="0 0 4 4"><rect width="4" height="4" fill="#00{{n}}"/></svg>'}});
            for (let i = 0; i < 100 && t.imageErrors.length === before; i++) await wait(100);
            await wait(500);
            const errors = t.imageErrors.slice(before), {images: _, onError: __, ...rest} = t.spec;
            t.host.update(t.spec = {...rest, style: t.style});
            return errors;
        });
        check(`[${renderer}] an image that is an SVG template: slots get the properties of each feature or the params of the image expression (also with feature-state), another template draws the variants again, a value is not markup, and too many variants give one error`,
            fromProperties === '#f0f #f0f #0ff #0ff' && fromParams === '#ff0 #ff0 #00f #00f' && otherTemplate === '#000 #ff0 #000 #00f' && stateOff === '#000 #0f0 #000 #0f0' && stateOn === '#000 #0f0 #000 #f00'
            && !unsafe.includes('#f00') && many.length === 1 && many[0].startsWith('[map-jr-gl] E30121 The image "tiny" has more than 1000 different sets of values')
            && replaced30.full === 0 && replaced30.asked === 0 && replaced30.broken.length === 1 && replaced30.broken[0].startsWith('[map-jr-gl] E40121 The image "tile" cannot be drawn with the values of its slots'),
            JSON.stringify({fromProperties, fromParams, otherTemplate, stateOff, stateOn, unsafe, many, replaced30}));

        // Icons that need no place among the labels are drawn from buffers of the tiles. The picture is the same as for
        // icons that are placed with the labels (a sort key makes the layer use that way). The style has no labels here:
        // a label is drawn over a placed icon.
        const shot = async () => { await page.evaluate(() => window.t.settle()); return (await page.screenshot()).toString('base64'); };
        await page.evaluate(() => {
            const t = window.t, c = t.host.state.get().view.center;
            let seed = 7; const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
            const features = Array.from({length: 300}, (_, i) => ({type: 'Feature', id: i, properties: {size: 0.6 + (i % 4) * 0.4, turn: i * 17 % 360, alpha: 0.4 + (i % 3) * 0.3},
                geometry: {type: 'Point', coordinates: [c[0] + (rand() - 0.5) * 0.02, c[1] + (rand() - 0.5) * 0.012]}}));
            t.arrows = more => ({...t.style, sources: {...t.style.sources, arrows: {type: 'geojson', data: {type: 'FeatureCollection', features}}},
                layers: [...t.style.layers.filter(l => l.type !== 'symbol'), {id: 'arrows', type: 'symbol', source: 'arrows', paint: {'icon-opacity': ['get', 'alpha'], 'icon-translate': [7, 3]},
                    layout: {'icon-image': 'arrow', 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-anchor': 'top-left', 'icon-offset': [6, -4], 'icon-size': ['get', 'size'], 'icon-rotate': ['get', 'turn'], ...more}}]});
            // (The map is idle and stays idle for a second. The store calls back only on a change, so a map that is
            // already idle counts from now: a change that the map makes without leaving idle would otherwise wait 30 s.)
            t.settle = () => new Promise(done => { let at = t.host.state.get().idle ? performance.now() : 0; const off = t.host.state.subscribe(s => s.idle, idle => { at = idle ? performance.now() : 0; }), timer = setInterval(() => { if (at && performance.now() - at > 1000) { clearInterval(timer); off(); done(); } }, 100); setTimeout(done, 30000); });
            t.host.moveTo({bearing: 0, pitch: 0}); // (an earlier test turned the map)
            t.host.update(t.spec = {...t.spec, style: t.arrows({}), images: {arrow: '<svg viewBox="0 0 24 30"><path d="M12 1 23 29 12 22 1 29z" fill="#d6453d" stroke="#fff" stroke-width="1.5"/></svg>'}});
        });
        // (While the map moves, the engine says how many icons it placed among the labels: none of those of the buffers.)
        await page.evaluate(() => { const t = window.t; t.placed = []; t.host.listen('stats', e => t.placed.push(e.labels)); });
        const flat = await shot();
        // (A turn in one step: the frame of the turn keeps the old order of the icons, and the frame after it, which
        // nothing else asks for, has the order of symbol-z-order.)
        await page.evaluate(() => window.t.host.moveTo({bearing: 40, pitch: 50}));
        const jumped = await shot();
        await page.evaluate(() => window.t.host.moveTo({bearing: 0, pitch: 0}));
        await shot();
        await page.evaluate(() => window.t.host.moveTo({bearing: 40, pitch: 50, duration: 2500}));
        const tilted = await shot();
        const placedFromBuffers = await page.evaluate(() => window.t.placed.splice(0));
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, style: t.arrows({'symbol-sort-key': 1})}); });
        const tiltedPlaced = await shot();
        await page.evaluate(() => window.t.placed.splice(0));
        await page.evaluate(() => window.t.host.moveTo({bearing: 0, pitch: 0, duration: 2500}));
        const flatPlaced = await shot();
        const placedWithLabels = await page.evaluate(() => window.t.placed.splice(0));
        const same = await page.evaluate(async pairs => {
            const pixels = async png => { const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = Object.assign(document.createElement('canvas'), {width: bitmap.width, height: bitmap.height}).getContext('2d'); c.drawImage(bitmap, 0, 0); return c.getImageData(0, 0, bitmap.width, bitmap.height).data; };
            const out = [];
            for (const [a, b] of pairs) {
                const A = await pixels(a), B = await pixels(b);
                let different = 0, red = 0;
                for (let i = 0; i < A.length; i += 4) { if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 48) different++; if (A[i] > 150 && A[i + 1] < 130 && A[i + 2] < 120) red++; }
                out.push({different, red});
            }
            const t = window.t, {images: _, ...rest} = t.spec;
            t.host.update(t.spec = {...rest, style: t.style});
            return out;
        }, [[flat, flatPlaced], [tilted, tiltedPlaced], [jumped, tiltedPlaced]]);
        // (Some pixels can differ: the two ways round the place of an icon at different points of the calculation.)
        check(`[${renderer}] icons from the buffers of the tiles are drawn as icons that are placed with the labels: on a flat map, on a turned and tilted map and after a turn in one step, with a size, a turn and an opacity for each feature`,
            same.every(p => p.red > 3000 && p.different < 60), JSON.stringify(same));
        check(`[${renderer}] the engine places no icon among the labels when the tiles have the icons in buffers (and it places them when they are not)`,
            placedFromBuffers.length > 0 && placedFromBuffers.every(n => n === 0) && placedWithLabels.length > 0 && placedWithLabels.every(n => n > 0), JSON.stringify({placedFromBuffers, placedWithLabels}));

        // A question for drawn features finds a feature of a symbol layer where its icon is drawn. The icon is a square of
        // 40 pixels that stands on its point (the anchor is `bottom`), at the centre of the map.
        const reach = await page.evaluate(async () => {
            const t = window.t, c = t.host.unproject({x: 450, y: 300}), wait = ms => new Promise(r => setTimeout(r, ms));
            const point = {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: c}};
            // (`text`: a layer with a label at the point, 'above' or 'below' the layer of the icon.)
            t.spot = (icon, text, data = point) => { const label = {id: 'spot-text', type: 'symbol', source: 'spot', layout: {'text-field': 'Here', 'text-size': 14}};
                return {...t.style, sources: {...t.style.sources, spot: {type: 'geojson', data}}, layers: [...t.style.layers.filter(l => l.type !== 'symbol'), ...(text === 'below' ? [label] : []),
                    {id: 'spot-icon', type: 'symbol', source: 'spot', layout: {'icon-image': 'square', 'icon-allow-overlap': true, ...icon}}, ...(text === 'above' ? [label] : [])]}; };
            const found = async (icon, places) => {
                t.host.update(t.spec = {...t.spec, style: t.spot(icon, false), images: {square: t.square('#f0f')}});
                await wait(300); await t.settle();
                const out = [];
                for (const [dx, dy] of places) out.push((await t.host.queryFeatures({x: 450 + dx, y: 300 + dy}, {layers: ['spot-icon']})).length);
                return out.join('');
            };
            // Above the point, below it, at the side inside the icon, and at the side outside it.
            const places = [[0, -32], [0, 32], [15, -20], [30, -20]];
            const out = {bottom: await found({'icon-anchor': 'bottom', 'icon-ignore-placement': true}, places), top: await found({'icon-anchor': 'top', 'icon-ignore-placement': true}, places),
                placed: await found({'icon-anchor': 'bottom', 'symbol-sort-key': 1}, places), large: await found({'icon-anchor': 'bottom', 'icon-size': 2}, [[0, -70], [35, -40], [45, -40]])};
            // Each feature is tested with its own icon: a small icon (a quarter of the size, 10 pixels) beside a large one
            // (four times the size) is found on its own picture only. Two icons at one place: the one that is drawn on top is first.
            const right = t.host.unproject({x: 650, y: 300}), at = (id, coordinates, s) => ({type: 'Feature', id, properties: {s}, geometry: {type: 'Point', coordinates}});
            t.host.update(t.spec = {...t.spec, style: t.spot({'icon-size': ['get', 's'], 'icon-ignore-placement': true}, false, {type: 'FeatureCollection', features: [at(1, c, 0.25), at(2, right, 4), at(3, c, 0.25)]})});
            await wait(300); await t.settle();
            const ask = async (x, y) => (await t.host.queryFeatures({x, y}, {layers: ['spot-icon']})).map(f => f.id).join();
            out.own = [await ask(450, 300), await ask(450 + 4, 300 - 4), await ask(450 + 12, 300), await ask(450, 300 - 30), await ask(650 - 70, 300 + 70), await ask(650 + 90, 300)].join('|');
            return out;
        });
        check(`[${renderer}] a question for drawn features finds a feature of a symbol layer where its icon is drawn: for each anchor, for an icon from a buffer and a placed icon, and for a larger icon`,
            reach.bottom === '1010' && reach.top === '0100' && reach.placed === '1010' && reach.large === '110' && reach.own === '3,1|3,1|||2|', JSON.stringify(reach));

        // An icon is found on its collision box, which has `icon-padding` around the picture, as in MapLibre GL JS (#2038).
        // The square of 40 pixels stands on its point: its sides are 20 pixels left and right of the point.
        const padded = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const found = async (icon, places) => {
                t.host.update(t.spec = {...t.spec, style: t.spot({'icon-anchor': 'bottom', 'icon-ignore-placement': true, ...icon}, false), images: {square: t.square('#f0f')}});
                await wait(300); await t.settle();
                const out = [];
                for (const [dx, dy] of places) out.push((await t.host.queryFeatures({x: 450 + dx, y: 300 + dy}, {layers: ['spot-icon'], radius: 0})).length);
                return out.join('');
            };
            // (A question at a point with no radius. The default padding is 2 pixels; a padding of 10 on each side; 20 on the left only; 30 from an expression.)
            return {default: await found({}, [[21, -20], [23, -20]]), ten: await found({'icon-padding': 10}, [[28, -20], [32, -20], [0, -48], [0, 8], [0, 12]]),
                left: await found({'icon-padding': [0, 0, 0, 20]}, [[-38, -20], [-42, -20], [21, -20]]),
                expression: await found({'icon-padding': ['coalesce', ['get', 'none'], 30]}, [[48, -20], [52, -20]])};
        });
        check(`[${renderer}] a question for drawn features finds an icon in its icon-padding, as MapLibre GL JS does: the default of 2 pixels, one number, four sides and an expression (#2038)`,
            padded.default === '10' && padded.ten === '10110' && padded.left === '100' && padded.expression === '10', JSON.stringify(padded));

        // The same question with `icon-offset` (#2029). The offset turns with `icon-rotate`: with a turn of 90 degrees an
        // offset of 40 pixels up puts the icon 40 pixels to the right. A layer with `icon-offset` has no perspective ratio
        // on a tilted map, so the icon of 40 pixels near the bottom of the map, with the default icon-padding of 2 pixels and
        // the radius of 3 pixels of the question, is found within 25 pixels of its point and not 27 pixels from it (with the
        // ratio, 1.24 there, the box reached 29.8 pixels).
        const offsetReach = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const found = async (icon, places, pitch = 0) => {
                t.host.moveTo({bearing: 0, pitch});
                t.host.update(t.spec = {...t.spec, style: t.spot(icon, false, {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: t.host.unproject({x: 450, y: pitch ? 550 : 300})}}), images: {square: t.square('#f0f')}});
                await wait(300); await t.settle();
                const out = [];
                for (const [x, y] of places) out.push((await t.host.queryFeatures({x, y}, {layers: ['spot-icon']})).length);
                return out.join('');
            };
            // At the turned place of the icon, and at the place where the offset would put it without the turn.
            const turned = [[490, 300], [450, 260]], tilted = [[450 + 15, 550], [450 + 27, 550]];
            const rotate = {'icon-rotate': 90, 'icon-offset': [0, -40], 'icon-ignore-placement': true}, still = {'icon-offset': [0, 0], 'icon-ignore-placement': true};
            const out = {turned: await found(rotate, turned), turnedPlaced: await found({...rotate, 'symbol-sort-key': 1}, turned),
                tilted: await found(still, tilted, 60), tiltedPlaced: await found({...still, 'symbol-sort-key': 1}, tilted, 60)};
            t.host.moveTo({bearing: 0, pitch: 0});
            return out;
        });
        check(`[${renderer}] a question for drawn features finds an icon with icon-offset where it is drawn: the offset turns with icon-rotate, and on a tilted map the box has no perspective ratio`,
            offsetReach.turned === '10' && offsetReach.turnedPlaced === '10' && offsetReach.tilted === '10' && offsetReach.tiltedPlaced === '10', JSON.stringify(offsetReach));

        // A feature of a symbol layer with text only is found on the box of its text, as in MapLibre GL JS, and not near
        // its point outside that box (#199). The text starts at the point (`text-anchor: left`) and is about 200 pixels long.
        const onText = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), c = t.host.unproject({x: 450, y: 300});
            t.host.update(t.spec = {...t.spec, style: {...t.style, sources: {...t.style.sources, spot: {type: 'geojson', data: {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: c}}}},
                layers: [...t.style.layers.filter(l => l.type !== 'symbol'), {id: 'spot-text', type: 'symbol', source: 'spot', layout: {'text-field': 'A long name for a crag', 'text-size': 20, 'text-anchor': 'left', 'text-max-width': 30, 'text-allow-overlap': true}}]}});
            await wait(300); await t.settle();
            const out = [];
            // On the text near its start, in its middle; then before the point, above the text, and past its end.
            for (const [dx, dy] of [[20, 0], [150, 5], [-8, 0], [60, -30], [400, 0]]) out.push((await t.host.queryFeatures({x: 450 + dx, y: 300 + dy}, {layers: ['spot-text']})).length);
            return out.join('');
        });
        check(`[${renderer}] a question for drawn features finds a feature of a symbol layer with text only on the box of its text, and not outside it`, onText === '11000', onText);

        // A label of a layer below the layer of an icon from a buffer keeps away from the icon, unless the layer of the icon
        // has `icon-ignore-placement`. A label of a layer above it is placed first and shows, as with a placed icon. The
        // text is at the point of the icon. (While the map moves, the engine says how many labels it placed. The number of
        // these reports depends on the frame rate, so the check compares the distinct counts and not the list (#1061).)
        const avoided = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const placed = async (icon, text) => {
                t.host.update(t.spec = {...t.spec, style: t.spot({'icon-anchor': 'center', ...icon}, text)});
                await wait(300); await t.settle();
                t.placed.length = 0;
                t.host.moveTo({bearing: 20, duration: 1800}); await wait(2200);
                t.host.moveTo({bearing: 0}); await wait(300);
                return [...new Set(t.placed.splice(0))].join();
            };
            const out = {avoid: await placed({}, 'below'), ignore: await placed({'icon-ignore-placement': true}, 'below'), above: await placed({}, 'above')};
            const {images: _, ...rest} = t.spec;
            t.host.update(t.spec = {...rest, style: t.style});
            return out;
        });
        check(`[${renderer}] a label of a layer below keeps away from an icon from a buffer, and not when the layer of the icon has icon-ignore-placement; a label of a layer above shows`,
            avoided.avoid === '0' && avoided.ignore === '1' && avoided.above === '1', JSON.stringify(avoided));

        // The space of an icon from a buffer has `icon-padding` added before the icon is turned, as in MapLibre GL JS
        // (#1734, #2038). The square of 40 pixels at the centre is turned by 90 degrees and has a padding of 50 on its
        // left, which the turn puts above it: a label 50 pixels left of the icon shows, and a label 60 pixels above it does not.
        const turnedSpace = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const placed = async at => {
                const data = {type: 'FeatureCollection', features: [{type: 'Feature', id: 1, properties: {}, geometry: {type: 'Point', coordinates: t.host.unproject({x: 450, y: 300})}},
                    {type: 'Feature', id: 2, properties: {}, geometry: {type: 'Point', coordinates: t.host.unproject(at)}}]};
                t.host.update(t.spec = {...t.spec, images: {square: t.square('#f0f')}, style: {...t.style, sources: {...t.style.sources, spot: {type: 'geojson', data}}, layers: [...t.style.layers.filter(l => l.type !== 'symbol'),
                    {id: 'spot-text', type: 'symbol', source: 'spot', filter: ['==', ['id'], 2], layout: {'text-field': 'Here', 'text-size': 14}},
                    {id: 'spot-icon', type: 'symbol', source: 'spot', filter: ['==', ['id'], 1], layout: {'icon-image': 'square', 'icon-allow-overlap': true, 'icon-rotate': 90, 'icon-padding': [0, 0, 0, 50]}}]}});
                await wait(300); await t.settle();
                t.placed.length = 0;
                t.host.moveTo({bearing: 20, duration: 1800}); await wait(2200);
                t.host.moveTo({bearing: 0}); await wait(300);
                return [...new Set(t.placed.splice(0))].join();
            };
            const out = {left: await placed({x: 400, y: 300}), above: await placed({x: 450, y: 240})};
            const {images: _, ...rest} = t.spec;
            t.host.update(t.spec = {...rest, style: t.style});
            return out;
        });
        check(`[${renderer}] the space of an icon from a buffer has icon-padding added before icon-rotate turns it, as in MapLibre GL JS`,
            turnedSpace.left === '1' && turnedSpace.above === '0', JSON.stringify(turnedSpace));
        }

        // GeoJSON data apart from the style: it goes to its source alone, and stays over a new style.
        const data = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), c = t.host.state.get().view.center;
            const idle = () => new Promise(r => { let at = t.host.state.get().idle ? performance.now() : 0; const off = t.host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const points = n => ({type: 'FeatureCollection', features: Array.from({length: n}, (_, i) => ({type: 'Feature', properties: {i}, geometry: {type: 'Point', coordinates: [c[0] + (i - n / 2) * 0.002, c[1]]}}))});
            // (A point at the edge of a tile is in two tiles: the points are counted by their number. The data gets time to come.)
            const once = async () => new Set((await t.host.queryFeatures([{x: 0, y: 0}, {x: 900, y: 600}], {layers: ['test-points']})).map(f => f.properties.i)).size;
            const count = async want => { let n = -1; for (let i = 0; i < 40 && (n = await once()) !== want; i++) await wait(150); return n; };
            const withSource = extra => ({...t.style, sources: {...t.style.sources, pts: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
                layers: [...t.style.layers, {id: 'test-points', type: 'circle', source: 'pts', paint: {'circle-radius': 6, 'circle-color': extra}}]});
            t.host.update(t.spec = {...t.spec, style: withSource('#f00'), data: {pts: points(3)}});
            await wait(300); await idle();
            const three = await count(3);
            t.host.update(t.spec = {...t.spec, data: {pts: points(5)}});
            await wait(300); await idle();
            const five = await count(5);
            t.host.update(t.spec = {...t.spec, style: withSource('#00f')}); // a new style: the data must stay
            await wait(300); await idle();
            await wait(500);
            const kept = await count(5);
            t.host.update(t.spec = {...t.spec, style: t.style, data: undefined});
            await wait(300); await idle();
            return {three, five, kept};
        });
        check(`[${renderer}] GeoJSON data apart from the style follows the description, and stays over a new style`, data.three === 3 && data.five === 5 && data.kept === 5, JSON.stringify(data));

        // Additions to a style from a URL: a layer below another, changed and removed by the description.
        const extend = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), box = [{x: 0, y: 0}, {x: 900, y: 600}];
            const count = async (id, want) => { let n = -1; for (let i = 0; i < 40 && ((n = (await t.host.queryFeatures(box, {layers: [id]})).length) > 0) !== want; i++) await wait(150); return n > 0; };
            const layer = id => ({sources: {extra: t.style.sources.omt}, layers: [{id, type: 'fill', source: 'extra', 'source-layer': 'water', before: 'road', paint: {'fill-color': '#f0f'}}]});
            t.host.update(t.spec = {...t.spec, style: location.origin + '/style.json', ...layer('ext-a')});
            const a = await count('ext-a', true), order = t.host._map.getStyle().layers.map(l => l.id), below = order.indexOf('ext-a') === order.indexOf('road') - 1;
            t.host.update(t.spec = {...t.spec, ...layer('ext-b')});
            const b = await count('ext-b', true), aGone = !(await count('ext-a', false));
            t.host.update(t.spec = {...t.spec, style: t.style, sources: undefined, layers: undefined});
            await wait(500);
            return {a, below, b, aGone, left: t.host._map.getStyle().layers.some(l => l.id.startsWith('ext-'))};
        });
        check(`[${renderer}] extend adds sources and layers to a style from a URL, and follows the description`, extend.a && extend.below && extend.b && extend.aGone && !extend.left, JSON.stringify(extend));

        // Controls: added and removed by the description.
        const controls = await page.evaluate(async () => {
            const t = window.t, {navigation, scale} = await import('/dist/controls.js'), count = () => document.querySelectorAll('#host .map-jr-ctrl-compass, #host .map-jr-ctrl-scale').length;
            // The control classes load with import() when the map adds the first control (#160).
            const settle = () => new Promise(r => setTimeout(r, 50));
            t.host.update(t.spec = {...t.spec, controls: [navigation(), scale({position: 'bottom-left'})]});
            for (let i = 0; i < 40 && count() < 2; i++) await settle();
            const two = count();
            t.host.update(t.spec = {...t.spec, controls: [navigation(), scale({position: 'bottom-left'})]}); // made again, the same content
            await settle();
            const still = count();
            t.host.update(t.spec = {...t.spec, controls: [scale({position: 'bottom-left'})]});
            await settle();
            const one = count();
            t.host.update(t.spec = {...t.spec, controls: undefined});
            await settle();
            return {two, still, one, none: count()};
        });
        check(`[${renderer}] controls follow the description`, controls.two === 2 && controls.still === 2 && controls.one === 1 && controls.none === 0, JSON.stringify(controls));

        // A control that the list has twice is shown once, and the development build warns once for it (#1195).
        const duplicate = await page.evaluate(async () => {
            const t = window.t, {navigation, scale, custom} = await import('/dist/controls.js');
            const warned = [], warn = console.warn;
            console.warn = (...a) => warned.push(String(a[0]));
            try {
                const spec = () => [navigation(), scale(), navigation(), custom({key: 'own', element: document.createElement('div')}), custom({key: 'own', element: document.createElement('div')})];
                t.host.update(t.spec = {...t.spec, controls: spec()});
                t.host.update(t.spec = {...t.spec, controls: spec()}); // the same list again: no second warning
                const said = () => warned.filter(w => w.startsWith('[map-jr-gl] E1195 controls:'));
                const count = () => document.querySelectorAll('#host .map-jr-ctrl-compass').length;
                for (let i = 0; i < 40 && (said().length < 2 || !count()); i++) await new Promise(r => setTimeout(r, 50));
                await new Promise(r => setTimeout(r, 100));
                const compasses = count();
                t.host.update(t.spec = {...t.spec, controls: undefined});
                return {said: said(), compasses};
            } finally { console.warn = warn; }
        });
        check(`[${renderer}] a duplicate control is shown once and warns once in the development build, naming the control (#1195)`,
            duplicate.said.length === 2 && duplicate.said.some(w => w.includes('navigation() is in the list twice') && w.includes('Remove the second navigation()'))
            && duplicate.said.some(w => w.includes('the key "own"')) && duplicate.compasses === 1, JSON.stringify(duplicate));

        // Two custom() items with one key and different positions: the first wins and stays through later changes of controls (#1662).
        const samePair = await page.evaluate(async () => {
            const t = window.t, {custom, scale} = await import('/dist/controls.js'), warn = console.warn;
            console.warn = () => {};
            try {
                let added = 0, removed = 0;
                const own = {onAdd: () => { added++; return Object.assign(document.createElement('div'), {className: 'own-pair'}); }, onRemove: () => { removed++; document.querySelector('#host .own-pair')?.remove(); }};
                const list = more => [custom({key: 'pair', position: 'top-left', ...own}), custom({key: 'pair', position: 'bottom-right', ...own}), ...more];
                t.host.update(t.spec = {...t.spec, controls: list([])});
                const first = document.querySelector('#host .own-pair');
                t.host.update(t.spec = {...t.spec, controls: list([scale()])});
                t.host.update(t.spec = {...t.spec, controls: list([])});
                await new Promise(r => setTimeout(r, 50));
                const now = document.querySelector('#host .own-pair'), r = {added, removed, same: !!first && first === now, corner: now?.parentElement?.className.match(/ctrl-(top|bottom)-(left|right)/)?.[0]};
                t.host.update(t.spec = {...t.spec, controls: undefined});
                return r;
            } finally { console.warn = warn; }
        });
        check(`[${renderer}] of two custom() controls with one key and different positions, the first is placed once and stays when controls change (#1662)`,
            samePair.added === 1 && samePair.removed === 0 && samePair.same && samePair.corner?.endsWith('top-left'), JSON.stringify(samePair));

        // Without `position`, a control goes to its own default corner: the bottom left for `scale()`, else the top right (#1197).
        const corners = await page.evaluate(async () => {
            const t = window.t, {navigation, scale} = await import('/dist/controls.js');
            const settle = () => new Promise(r => setTimeout(r, 50));
            t.host.update(t.spec = {...t.spec, controls: [navigation(), scale()]});
            for (let i = 0; i < 40 && !document.querySelector('#host .map-jr-ctrl-scale'); i++) await settle();
            await settle();
            const where = sel => document.querySelector(sel)?.closest('[class*="ctrl-top-"],[class*="ctrl-bottom-"]')?.className.match(/ctrl-(top|bottom)-(left|right)/)?.[0];
            const r = {scale: where('#host .map-jr-ctrl-scale'), nav: where('#host .map-jr-ctrl-compass')};
            t.host.update(t.spec = {...t.spec, controls: undefined});
            await settle();
            return r;
        });
        check(`[${renderer}] scale() without position goes to the bottom left, navigation() to the top right`, corners.scale?.endsWith('bottom-left') && corners.nav?.endsWith('top-right'), JSON.stringify(corners));

        // `locale` gives the texts of the controls, and a change adds the controls again with the new texts (#685).
        const locale = await page.evaluate(async () => {
            const t = window.t, {navigation} = await import('/dist/controls.js');
            const settle = () => new Promise(r => setTimeout(r, 50)), label = () => document.querySelector('#host .map-jr-ctrl-zoom-in')?.getAttribute('aria-label');
            t.host.update(t.spec = {...t.spec, controls: [navigation()], locale: {'NavigationControl.ZoomIn': 'Zoom avant', 'Map.Title': 'Carte'}});
            for (let i = 0; i < 40 && !label(); i++) await settle();
            const fr = label(), canvas = () => document.querySelector('#host canvas')?.getAttribute('aria-label'), frCanvas = canvas();
            // An open popup takes the texts of a new locale too (#748). (A marker of this entry has the element of the user, and no text of its own.)
            const at = t.host.state.get().view.center, popup = t.host.overlay(document.createElement('div'), {lngLat: at, popup: true, onClose() {}});
            t.host.update(t.spec = {...t.spec, locale: {'NavigationControl.ZoomIn': 'Hineinzoomen', 'Popup.Close': 'Popup schließen'}});
            await settle();
            const de = label(), closer = document.querySelector('#host .map-jr-popup-close-button')?.getAttribute('aria-label');
            popup.remove();
            t.host.update(t.spec = {...t.spec, locale: undefined});
            await settle();
            const en = label(), enCanvas = canvas();
            t.host.update(t.spec = {...t.spec, controls: undefined});
            await settle();
            return {fr, de, en, closer, frCanvas, enCanvas};
        });
        check(`[${renderer}] locale sets the texts of the controls and of an open popup, and follows the description`, locale.fr === 'Zoom avant' && locale.de === 'Hineinzoomen' && locale.en === 'Zoom in' && locale.closer === 'Popup schließen' && locale.frCanvas === 'Carte' && locale.enCanvas === 'Map', JSON.stringify(locale));

        // A control of your own (#216): an element, and an object with onAdd/onRemove, follow the description by key.
        const custom = await page.evaluate(async () => {
            const t = window.t, {navigation, custom} = await import('/dist/controls.js');
            const settle = () => new Promise(r => setTimeout(r, 50));
            const el = Object.assign(document.createElement('button'), {id: 'own-ctrl'});
            let added = 0, removed = 0;
            const obj = {onAdd: () => { added++; return Object.assign(document.createElement('div'), {id: 'own-obj'}); }, onRemove: () => { removed++; document.getElementById('own-obj')?.remove(); }};
            const spec = () => [navigation(), custom({key: 'el', position: 'top-left', element: el}), custom({key: 'obj', ...obj})];
            t.host.update(t.spec = {...t.spec, controls: spec()});
            await settle();
            const inCorner = !!el.parentElement?.matches('#host .map-jr-ctrl-top-left') && el.classList.contains('map-jr-ctrl');
            const objIn = !!document.querySelector('#host .map-jr-ctrl-top-right #own-obj');
            t.host.update(t.spec = {...t.spec, controls: spec()}); // made again: the same keys keep the controls
            await settle();
            const kept = added === 1 && removed === 0 && el.isConnected;
            // A new position under the same key moves the control, custom or built in (#1237).
            t.host.update(t.spec = {...t.spec, controls: [navigation({position: 'bottom-left'}), custom({key: 'el', position: 'bottom-right', element: el}), custom({key: 'obj', ...obj})]});
            // (The navigation control loads its code on demand, so the check waits up to 2 s for its buttons in the new corner.)
            const isMoved = () => !!el.parentElement?.matches('#host .map-jr-ctrl-bottom-right') && !!document.querySelector('#host .map-jr-ctrl-bottom-left .map-jr-ctrl-zoom-in')
                && !document.querySelector('#host .map-jr-ctrl-top-right .map-jr-ctrl-zoom-in') && added === 1;
            for (let i = 0; i < 40 && !isMoved(); i++) await settle();
            const moved = isMoved();
            t.host.update(t.spec = {...t.spec, controls: undefined});
            await settle();
            return {inCorner, objIn, kept, moved, gone: !el.isConnected && removed === 1 && !document.getElementById('own-obj')};
        });
        check(`[${renderer}] custom controls go into their corner, follow the description by key, and move to a new position`, custom.inCorner && custom.objIn && custom.kept && custom.moved && custom.gone, JSON.stringify(custom));

        // 4b. An SVG image without a viewBox has the size of its width and height attributes (#175): a 9×9 image that
        // replaces a 40×40 one under the same name is drawn at 9×9 centred on its anchor, and the 40×40 one is not cropped.
        // (The blue box of each picture is read from a picture of the page; the anchor is at the centre of the container,
        // 450, 300 where it is 900 × 600, and 7 px less in Firefox on macOS, whose scroll bars take 14 px (#774).)
        {
            const svg = (s, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${c}"/></svg>`;
            const box = async () => page.evaluate(async png => {
                const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = Object.assign(document.createElement('canvas'), {width: bitmap.width, height: bitmap.height}).getContext('2d');
                c.drawImage(bitmap, 0, 0);
                const d = c.getImageData(0, 0, bitmap.width, bitmap.height).data;
                let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
                for (let y = 0; y < bitmap.height; y++) for (let x = 0; x < bitmap.width; x++) { const i = (y * bitmap.width + x) * 4; if (d[i + 2] > 200 && d[i] < 80 && d[i + 1] < 80) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
                return [x0, x1, y0, y1].join();
            }, (await page.screenshot()).toString('base64'));
            const seen = async want => { let got; for (let i = 0; i < 40 && (got = await box()) !== want; i++) await page.waitForTimeout(150); return got; };
            await page.evaluate(async ({renderer, big}) => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'sized', style: 'position:fixed;inset:0;z-index:200;background:#fff'}));
                window.sized = {spec: {style: {version: 8, sources: {p: {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}},
                    {id: 'i', type: 'symbol', source: 'p', layout: {'icon-image': 'b', 'icon-allow-overlap': true}}]}, initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false, images: {b: big}}};
                window.sized.host = window.t.lib.createMap(el, window.sized.spec);
            }, {renderer, big: svg(40, '#00f')});
            const [cx, cy] = await page.evaluate(() => { const r = document.getElementById('sized').getBoundingClientRect(); return [Math.round(r.width / 2), Math.round(r.height / 2)]; });
            const want = n => [cx - n, cx + n - 1 + (n === 4), cy - n, cy + n - 1 + (n === 4)].join();
            const big = await seen(want(20));
            await page.evaluate(small => { const s = window.sized; s.host.update(s.spec = {...s.spec, images: {b: small}}); }, svg(9, '#00f'));
            const small = await seen(want(4));
            await page.evaluate(() => { window.sized.host.destroy(); document.getElementById('sized').remove(); });
            check(`[${renderer}] an SVG image without a viewBox has the size of its width and height: 40×40 is not cropped, and 9×9 after it is centred on its anchor`,
                big === want(20) && small === want(4), JSON.stringify({big, small}));
        }

        // 5. The features under the pointer, and a click.
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, interactiveLayers: ['water', 'park', 'building', 'road'], onClick: e => t.clicks.push(e)}); t.host.state.subscribe(s => s.hover, h => t.seen.push('hover:' + h.length)); });
        let hover = 0;
        for (const [x, y] of [[450, 300], [300, 200], [600, 400], [200, 450], [700, 150]]) {
            await page.mouse.move(x, y); await page.waitForTimeout(400);
            hover = Math.max(hover, await page.evaluate(() => window.t.host.state.get().hover.length));
        }
        // `state.pointer` follows each move, also without `interactiveLayers`, and is null when the pointer leaves the map.
        await page.evaluate(() => { const t = window.t; t.pointers = []; t.stopPointer = t.host.state.subscribe(s => s.pointer, p => t.pointers.push(p)); });
        await page.mouse.move(600, 400); await page.mouse.move(610, 405);
        const leave = await page.evaluate(() => {
            const t = window.t, last = t.pointers.at(-1), moves = t.pointers.length, at = t.host.unproject({x: 610, y: 405});
            document.querySelector('#host canvas').dispatchEvent(new PointerEvent('pointerleave', {pointerType: 'mouse', clientX: 950, clientY: 405}));
            t.stopPointer();
            return {moves, last, near: !!last && Math.abs(last.lngLat[0] - at[0]) < 1e-9 && Math.abs(last.lngLat[1] - at[1]) < 1e-9, after: t.host.state.get().pointer};
        });
        check(`[${renderer}] state.pointer has the point and the position at each move, and is null when the pointer leaves the map`, leave.moves === 2 && leave.last?.point.x === 610 && leave.last.point.y === 405 && leave.near && leave.after === null, JSON.stringify(leave));
        await page.mouse.move(450, 300);
        await page.mouse.click(450, 300); await page.waitForTimeout(500);
        const pointer = await page.evaluate(() => { const t = window.t, c = t.clicks[0]; return {clicks: t.clicks.length, lngLat: c?.lngLat?.length, features: Array.isArray(c?.features), hoverEvents: t.seen.filter(x => x.startsWith('hover:')).length}; });
        check(`[${renderer}] the features under the pointer are in the state, and a click has them`, hover > 0 && pointer.clicks === 1 && pointer.lngLat === 2 && pointer.features && pointer.hoverEvents > 0, JSON.stringify({hover, ...pointer}));
        // `hoverState` (#496): the top feature under the pointer has the feature state `hover`, and loses it when the pointer leaves it.
        await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'lit', style: 'position:fixed;left:0;top:0;width:200px;height:150px;z-index:99'}));
            const square = (id, w) => ({type: 'Feature', id, properties: {}, geometry: {type: 'Polygon', coordinates: [[[w, -1], [w + 1, -1], [w + 1, 1], [w, 1], [w, -1]]]}});
            const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}, renderer, attribution: false, onError: () => {},
                initialView: {center: [0, 0], zoom: 5}, sources: {sq: {type: 'geojson', data: {type: 'FeatureCollection', features: [square(1, -1), square(2, 0), square(undefined, 1)]}}},
                layers: [{id: 'sq', type: 'fill', source: 'sq', paint: {'fill-color': '#00f', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0.5]}}], interactiveLayers: ['sq'], hoverState: true});
            await new Promise(r => { host.state.subscribe(s => s.idle, v => v && r()); setTimeout(r, 8000); });
            t.litHost = host; t.litSaid = []; t.litLog = console.warn; console.warn = (...a) => { t.litSaid.push(a.join(' ')); t.litLog(...a); };
        }, renderer);
        // (A query of the layer at a point has the feature state; a query of the source does not, as in MapLibre GL JS.)
        const states = () => page.evaluate(async () => Object.fromEntries((await Promise.all([70, 130].map(x => window.t.litHost.queryFeatures({x, y: 75}, {layers: ['sq']})))).map(([f]) => [f?.id, !!f?.state?.hover])));
        await page.mouse.move(70, 75); await page.waitForTimeout(400);
        const onA = await states();
        await page.mouse.move(130, 75); await page.waitForTimeout(400);
        const onB = await states();
        // (A feature with no id gets no state, and the development build warns once for the layer.)
        for (const x of [170, 175, 130, 170]) { await page.mouse.move(x, 75); await page.waitForTimeout(300); }
        const noId = await page.evaluate(() => { const t = window.t; console.warn = t.litLog; return t.litSaid.filter(w => w.startsWith('[map-jr-gl] E30 hoverState: a feature of the layer "sq" has no id')).length; });
        await page.mouse.move(450, 300); await page.waitForTimeout(400);
        const litGone = await states();
        // A sweep of the pointer for 1 s (#694): the map asks the engine at most once in a frame, and the answer is the
        // one for the last position. (The test counts the calls of `queryFeatures` of the core map, which it finds as
        // the target of an event of that map.)
        await page.evaluate(() => {
            const t = window.t, define = Object.defineProperties;
            Object.defineProperties = (o, d) => { const m = o?.target; if (m && typeof m.queryFeatures === 'function' && !t.sweepProto) t.sweepProto = Object.getPrototypeOf(m); return define(o, d); };
            t.sweepRestore = () => { Object.defineProperties = define; };
        });
        await page.mouse.move(60, 75); await page.waitForTimeout(100);
        await page.evaluate(() => {
            const t = window.t; t.sweepRestore();
            const p = t.sweepProto, own = p.queryFeatures;
            t.sweep = {queries: 0, frames: 0, on: true};
            p.queryFeatures = function (...a) { if (t.sweep.on) t.sweep.queries++; return own.apply(this, a); };
            t.sweepUndo = () => { p.queryFeatures = own; };
            const tick = () => { if (t.sweep.on) { t.sweep.frames++; requestAnimationFrame(tick); } };
            requestAnimationFrame(tick);
        });
        // (Four moves in each frame, as a mouse that reports more often than the screen draws: the page gets them all.)
        const sweep = await page.evaluate(async () => {
            const t = window.t, canvas = document.querySelector('#lit canvas'), box = canvas.getBoundingClientRect();
            const move = x => canvas.dispatchEvent(new PointerEvent('pointermove', {pointerType: 'mouse', bubbles: true, clientX: box.left + x, clientY: box.top + 75}));
            let moves = 0;
            for (const start = performance.now(); performance.now() - start < 1000;) {
                for (let i = 0; i < 4; i++, moves++) move(20 + (moves * 3) % 150);
                await new Promise(r => requestAnimationFrame(r));
            }
            move(130); moves++;
            await new Promise(r => setTimeout(r, 400));
            t.sweep.on = false; t.sweepUndo();
            return {...t.sweep, moves, top: t.litHost.state.get().hover[0]?.id};
        });
        console.log(`      [${renderer}] hover sweep: ${JSON.stringify(sweep)}`);
        check(`[${renderer}] a sweep of the pointer for 1 s asks the engine at most once in a frame, and the hover is the feature at the last position (#694)`,
            sweep.queries > 0 && sweep.queries <= sweep.frames + 2 && sweep.top === 2, JSON.stringify(sweep));
        await page.evaluate(() => { window.t.litHost.destroy(); document.getElementById('lit').remove(); });
        check(`[${renderer}] hoverState gives the feature under the pointer the feature state hover, takes it away when the pointer leaves it, and warns once for a feature with no id`,
            onA[1] === true && onA[2] === false && onB[1] === false && onB[2] === true && litGone[1] === false && litGone[2] === false && noId === 1, JSON.stringify({onA, onB, litGone, noId}));
        // A click on an overlay does not call onClick (#198).
        await page.evaluate(() => { const t = window.t, el = Object.assign(document.createElement('div'), {style: 'width:20px;height:20px;background:#c00'}); t.ov = t.host.overlay(el, {lngLat: t.host.unproject({x: 200, y: 200})}); t.clicks.length = 0; });
        const ovBox = await page.evaluate(() => { const r = document.querySelector('.map-jr-marker').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
        await page.mouse.click(ovBox.x, ovBox.y); await page.waitForTimeout(500);
        const overlayClicks = await page.evaluate(() => { const t = window.t, n = t.clicks.length; t.ov.remove(); return n; });
        check(`[${renderer}] a click on an overlay does not call onClick`, overlayClicks === 0, JSON.stringify({overlayClicks}));
        // overlay().patch changes only the options that it has (#1153): a marker keeps its anchor and offset, and a popup
        // stays the same element with its close button. `lngLat: undefined` keeps the position, also through a later patch
        // that makes the element again.
        const overlayPatch = await page.evaluate(() => { const t = window.t, hostBox = document.querySelector('#host').getBoundingClientRect();
            const el = Object.assign(document.createElement('div'), {style: 'width:20px;height:20px'});
            const ov = t.host.overlay(el, {lngLat: t.host.unproject({x: 100, y: 100}), anchor: 'bottom', offset: [0, -10]});
            ov.patch({lngLat: t.host.unproject({x: 150, y: 120})});
            const r = el.getBoundingClientRect(), marker = {x: r.x + r.width / 2 - hostBox.x, y: r.bottom - hostBox.y};
            let kept;
            try { ov.patch({lngLat: undefined}); ov.patch({anchor: 'top'}); const k = el.getBoundingClientRect(); kept = {x: k.x + k.width / 2 - hostBox.x, y: k.top - hostBox.y}; } catch (e) { kept = String(e); }
            ov.remove();
            const content = Object.assign(document.createElement('p'), {textContent: 'Patched'});
            const pop = t.host.overlay(content, {lngLat: t.host.unproject({x: 200, y: 200}), popup: true, onClose() {}});
            const box = content.closest('.map-jr-popup');
            pop.patch({lngLat: t.host.unproject({x: 220, y: 200})});
            const after = content.closest('.map-jr-popup'), sameBox = !!box && after === box, closeButton = !!after?.querySelector('.map-jr-popup-close-button');
            pop.remove();
            return {marker, kept, sameBox, closeButton}; });
        check(`[${renderer}] overlay().patch({lngLat}) moves a marker and keeps its anchor and offset, and moves a popup and keeps it and its close button`,
            Math.abs(overlayPatch.marker.x - 150) < 1 && Math.abs(overlayPatch.marker.y - 110) < 1 && overlayPatch.sameBox && overlayPatch.closeButton, JSON.stringify(overlayPatch));
        check(`[${renderer}] overlay().patch({lngLat: undefined}) keeps the position, and a later patch of the anchor places the marker there`,
            Math.abs(overlayPatch.kept?.x - 150) < 1 && Math.abs(overlayPatch.kept?.y - 110) < 1, JSON.stringify(overlayPatch.kept));
        // An overlay of the main API is placed at its fractional pixel position, not rounded to whole pixels (#2189).
        const subpixel = await page.evaluate(() => { const t = window.t, el = document.createElement('div');
            const ov = t.host.overlay(el, {lngLat: t.host.unproject({x: 100.5, y: 100.25}), anchor: 'top-left'});
            const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform); ov.remove();
            return {transform: el.style.transform, x: m && +m[1], y: m && +m[2]}; });
        check(`[${renderer}] overlay() places an element at a fractional pixel position without rounding (#2189)`,
            Math.abs(subpixel.x - 100.5) < 0.05 && Math.abs(subpixel.y - 100.25) < 0.05, JSON.stringify(subpixel));
        // An unknown option of overlay(), update() or patch() warns once for each map in the development build (#1647). The
        // production build gives none (see "The map with no checks" below).
        const overlayUnknown = await page.evaluate(async () => {
            const t = window.t, said = [], log = console.warn, lngLat = t.host.unproject({x: 100, y: 100});
            console.warn = (...a) => { const m = a.join(' '); if (m.includes('an option of an overlay')) said.push(m); };
            try {
                const ov = t.host.overlay(document.createElement('div'), {lngLat, lnglat: [3, 3]});
                ov.update({lngLat, lnglat: [3, 3], colour: 'red'});
                ov.patch({lnglat: [3, 3], Anchor: 'top', popup: false});
                ov.remove();
                await new Promise(r => setTimeout(r, 500));
            } finally { console.warn = log; }
            return said; });
        check(`[${renderer}] an unknown option of overlay(), update() and patch() gives one warning for each option, which names the option and the known options`,
            overlayUnknown.length === 3 && overlayUnknown[0] === '[map-jr-gl] E1647 overlay(): "lnglat" is not an option of an overlay, so it has no effect. Write "lngLat". The options are lngLat, anchor, offset, popup, onClose, draggable, onDragStart, onDrag, onDragEnd.'
            && overlayUnknown[1].startsWith('[map-jr-gl] E1647 update(): "colour" is not an option of an overlay, so it has no effect. The options are')
            && overlayUnknown[2].startsWith('[map-jr-gl] E1647 patch(): "Anchor" is not an option of an overlay, so it has no effect. Write "anchor".'), JSON.stringify(overlayUnknown));
        // A draggable overlay (#167): a click is a click, a drag starts after a move, the map does not pan under it, and
        // the callbacks get [lng, lat]. A render with the same lngLat leaves it where it was dropped.
        await page.evaluate(() => { const t = window.t, el = t.dragPin = t.lib.defaultPin({color: 'rgb(200, 0, 0)'}); t.dragged = []; el.addEventListener('click', () => t.dragged.push('click'));
            const opts = t.dragOpts = {lngLat: t.host.unproject({x: 200, y: 200}), anchor: 'bottom', draggable: true, onDragStart: p => t.dragged.push('start ' + p.length), onDrag: () => t.dragged.push('drag'), onDragEnd: p => t.dragged.push(p)};
            t.ov = t.host.overlay(el, opts); t.center0 = t.host.state.get().view.center; });
        const dBox = await page.evaluate(() => { const r = window.t.dragPin.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
        await page.mouse.click(dBox.x, dBox.y); await page.waitForTimeout(200);
        const dClick = await page.evaluate(() => window.t.dragged.splice(0).join(' '));
        await page.mouse.move(dBox.x, dBox.y); await page.mouse.down(); await page.mouse.move(dBox.x + 1, dBox.y);
        const dEarly = await page.evaluate(() => window.t.dragged.length);
        await page.mouse.move(dBox.x + 60, dBox.y + 40, {steps: 6}); await page.mouse.up(); await page.waitForTimeout(300);
        const dragged = await page.evaluate(() => { const t = window.t, ev = t.dragged.splice(0), end = ev.at(-1), want = t.host.unproject({x: 260, y: 240}), c = t.host.state.get().view.center;
            t.ov.update({...t.dragOpts}); const r = t.dragPin.getBoundingClientRect(); const kept = t.host.unproject({x: r.x + r.width / 2 - document.querySelector('#host').getBoundingClientRect().x, y: r.bottom - document.querySelector('#host').getBoundingClientRect().y});
            t.ov.remove();
            return {seq: ev.slice(0, -1).map(String).join(' ').replace(/( drag)+/, ' drags'), end, endOk: Array.isArray(end) && Math.abs(end[0] - want[0]) < 1e-3 + Math.abs(want[0]) * 1e-4 && Math.abs(end[1] - want[1]) < 1e-3 + Math.abs(want[1]) * 1e-4,
                panned: Math.abs(c[0] - t.center0[0]) + Math.abs(c[1] - t.center0[1]) > 1e-9, keptOk: Math.abs(kept[0] - end[0]) < 1e-3 && Math.abs(kept[1] - end[1]) < 1e-3, fill: t.dragPin.querySelector('path')?.getAttribute('fill')}; });
        check(`[${renderer}] a draggable overlay: a click is a click, a drag after a move calls onDragStart, onDrag and onDragEnd with [lng, lat], the map does not pan, and the same lngLat keeps the dropped place; defaultPin() is the pin of Marker`,
            dClick === 'click' && dEarly === 0 && dragged.seq === 'start 2 drags' && dragged.endOk && !dragged.panned && dragged.keptOk && dragged.fill === 'rgb(200, 0, 0)', JSON.stringify({dClick, dEarly, dragged}));
        // `cooperativeGestures` (#41): a plain wheel does not zoom and shows the hint; Ctrl + wheel zooms; update() turns it off.
        const zoomNow = () => page.evaluate(() => window.t.host.state.get().view.zoom);
        // (The library asks for ⌘ instead of Ctrl when the user agent says Mac, as MapLibre GL JS does.)
        const mod = await page.evaluate(() => navigator.userAgent.includes('Mac')) ? 'Meta' : 'Control';
        const wheel = async (ctrl) => { const z = await zoomNow(); await page.mouse.move(450, 300); if (ctrl) await page.keyboard.down(mod); await page.mouse.wheel(0, -300); if (ctrl) await page.keyboard.up(mod); await page.waitForTimeout(900); return Math.abs(await zoomNow() - z) > 0.01; };
        const zoom0 = await zoomNow();
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, cooperativeGestures: true}); });
        await page.waitForTimeout(500);
        const plainOn = await wheel(false);
        const coop = await page.evaluate(() => ({hint: document.querySelectorAll('#host .map-jr-cooperative-gesture-screen').length, touch: document.querySelector('#host canvas').style.touchAction}));
        const ctrlOn = await wheel(true);
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, cooperativeGestures: false}); });
        const plainOff = await wheel(false);
        const off = await page.evaluate(() => document.querySelectorAll('#host .map-jr-cooperative-gesture-screen').length);
        await page.evaluate(z => window.t.host.moveTo({zoom: z}), zoom0); await page.waitForTimeout(300);
        check(`[${renderer}] cooperativeGestures: a plain wheel does not zoom and the hint is there, Ctrl + wheel zooms, and update() turns it off`,
            !plainOn && ctrlOn && plainOff && coop.hint === 1 && coop.touch === 'pan-x pan-y' && off === 0, JSON.stringify({plainOn, ctrlOn, plainOff, ...coop, off}));
        // #1687: with cooperativeGestures, two fingers that move up in parallel move the map and do not tilt it, and a hand
        // that puts one finger down a moment before the other, and lifts one before the other, does not see the hint.
        const coopTouch = `[${renderer}] cooperativeGestures: two fingers that move in parallel pan the map and do not tilt it, and a touch that puts its fingers down or lifts them one after the other shows no hint (#1687)`;
        if (!cdpTouch) skip(coopTouch, noCDP);
        else {
            const at = await page.evaluate(async renderer => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:50px;top:50px;width:600px;height:400px;z-index:1000'}));
                const m = window.t.lib.createMap(el, {renderer, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, initialView: {center: [0, 0], zoom: 3, pitch: 30}, cooperativeGestures: true});
                await new Promise(r => { const stop = m.state.subscribe(s => { if (s.loaded) { queueMicrotask(() => stop()); r(); } }); });
                // (The hint comes with the code of cooperativeGestures, which loads on demand.)
                while (!el.querySelector('.map-jr-cooperative-gesture-screen')) await new Promise(r => setTimeout(r, 20));
                const hint = el.querySelector('.map-jr-cooperative-gesture-screen'), c = window.coopTouch = {shown: 0, view: () => m.state.get().view, remove: () => { m.destroy(); el.remove(); }};
                new MutationObserver(() => { if (hint.style.opacity === '1') c.shown++; }).observe(hint, {attributes: true});
                const r = el.getBoundingClientRect();
                return {x: r.x, y: r.y};
            }, renderer);
            const cdp = await page.context().newCDPSession(page);
            const touch = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints});
            const two = i => [{id: 0, x: at.x + 250, y: at.y + 300 - i * 6}, {id: 1, x: at.x + 350, y: at.y + 310 - i * 6}];
            // Both fingers at once, up in parallel.
            await touch('touchStart', two(0));
            for (let i = 1; i <= 15; i++) { await touch('touchMove', two(i)); await page.waitForTimeout(16); }
            await touch('touchEnd');
            await page.waitForTimeout(500);
            const parallel = await page.evaluate(() => { const v = window.coopTouch.view(); return {lat: v.center[1], pitch: v.pitch}; });
            // One finger first, which moves 5 pixels before the second comes; the second lifts first, and the first moves on.
            // (The map waits 150 ms from the first finger for a second one, by the clock of the page. On a loaded runner
            // the three events can reach the page more than 150 ms apart, and then the hint is right (#1844). The three
            // are sent without waiting for each other, the page measures the gap between the two `pointerdown`s, and a
            // try whose gap is 150 ms or more is repeated, at most five times. `gap` is in the message.)
            let after;
            for (let attempt = 0; attempt < 5; attempt++) {
                await page.evaluate(() => {
                    const c = window.coopTouch, el = document.querySelector('.map-jr-cooperative-gesture-screen').parentElement;
                    c.shown = 0; c.downs = [];
                    if (!c.listening) { c.listening = true; el.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') c.downs.push(performance.now()); }, true); }
                });
                const lat0 = await page.evaluate(() => window.coopTouch.view().center[1]);
                await Promise.all([
                    touch('touchStart', [{id: 0, x: at.x + 250, y: at.y + 300}]),
                    touch('touchMove', [{id: 0, x: at.x + 250, y: at.y + 295}]),
                    touch('touchStart', [{id: 0, x: at.x + 250, y: at.y + 295}, two(0)[1]]),
                ]);
                for (let i = 1; i <= 10; i++) { await touch('touchMove', two(i)); await page.waitForTimeout(16); }
                await touch('touchMove', [two(10)[0]]);
                for (let i = 1; i <= 3; i++) { await touch('touchMove', [{...two(10)[0], y: two(10)[0].y - i * 5}]); await page.waitForTimeout(16); }
                await touch('touchEnd');
                // (The hint shows at most 150 ms after the first finger; the wait covers it.)
                await page.waitForTimeout(500);
                after = await page.evaluate(([lat0, attempt]) => { const c = window.coopTouch, v = c.view(); return {moved: lat0 - v.center[1], pitch: v.pitch, shown: c.shown, gap: c.downs.length === 2 ? Math.round(c.downs[1] - c.downs[0]) : null, attempt}; }, [lat0, attempt]);
                if (after.gap !== null && after.gap < 150) break;
            }
            await cdp.detach();
            await page.evaluate(() => { window.coopTouch.remove(); window.coopTouch = undefined; });
            check(coopTouch, parallel.lat < -1 && Math.abs(parallel.pitch - 30) < 0.5 && after.gap !== null && after.gap < 150 && after.moved > 1 && Math.abs(after.pitch - 30) < 0.5 && after.shown === 0, JSON.stringify({parallel, after}));
        }
        // `colorScheme` (#490): the class map-jr-dark, state.colorScheme and the colour of a control, for no value (light), 'auto', 'light' and 'dark'.
        // (The browser fires the event `change` of the media query at its next rendering step, which can come late on a
        // loaded machine, so the check waits until the state has the expected scheme, for at most 3 s.)
        // (A control loads its code with import() when the map adds the first one, so the check waits for the element of
        // the control, for at most 3 s: one frame was too short on a loaded machine, #532.)
        const until = expect => page.waitForFunction(e => window.t.host.state.get().colorScheme === e, expect, {timeout: 3000}).catch(() => {});
        const scheme = async (media, value, expect) => {
            await page.emulateMedia({colorScheme: media});
            if (expect) await until(expect);
            return page.evaluate(async value => {
                const t = window.t, {navigation} = await import('/dist/controls.js');
                t.host.update({...t.spec, controls: [navigation()], ...value === undefined ? {} : {colorScheme: value}});
                for (const end = Date.now() + 3000; !document.querySelector('#host .map-jr-ctrl-group') && Date.now() < end;) await new Promise(r => setTimeout(r, 20));
                await new Promise(r => requestAnimationFrame(r));
                const el = document.querySelector('#host .map-jr-ctrl-group');
                return [document.querySelector('#host').classList.contains('map-jr-dark') ? 'class' : '-', t.host.state.get().colorScheme, el && getComputedStyle(el).color].join(' ');
            }, value);
        };
        const schemes = {none: await scheme('dark', undefined, 'light'), autoDark: await scheme('dark', 'auto', 'dark'), autoLight: await scheme('light', 'auto', 'light'), light: await scheme('dark', 'light'), dark: await scheme('light', 'dark'), autoBack: await scheme('dark', 'auto')};
        // (The last description has 'auto': the map follows a change of the media query.)
        await page.emulateMedia({colorScheme: 'light'});
        await until('light');
        schemes.follows = await page.evaluate(() => window.t.host.state.get().colorScheme);
        await page.emulateMedia({colorScheme: null});
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec); });
        // (The text colour: the page /bench loads the CSS of MapLibre GL JS, whose background of a control wins over the rules of this library, as a rule of an application does.)
        const D = 'class dark rgb(230, 230, 230)', L = '- light rgb(34, 34, 34)';
        check(`[${renderer}] colorScheme: no value is light also when the browser asks for dark, 'auto' follows prefers-color-scheme while the page is open, 'light' and 'dark' fix it, with the class map-jr-dark and the colour of a control`,
            schemes.none === L && schemes.autoDark === D && schemes.autoLight === L && schemes.light === L && schemes.dark === D && schemes.autoBack === D && schemes.follows === 'light', JSON.stringify(schemes));
        // The look of the main API (#541): the class map-jr-glass gives the controls a blur. A rule of the page still wins
        // (the CSS of MapLibre GL JS on /bench sets the radius of a group to 4px), and a map of the compat entry has neither.
        const glass = await page.evaluate(async () => {
            const t = window.t, {navigation} = await import('/dist/controls.js'), mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            t.host.update({...t.spec, controls: [navigation()]});
            // (The control puts its element in place when its code has loaded with import(), so the check waits for it,
            // for at most 3 s, as the check of colorScheme does: one frame was too short on a loaded machine, #532.
            // A missing element gives the value null and fails this check, and the run goes on.)
            for (const end = Date.now() + 3000; !document.querySelector('#host .map-jr-ctrl-group') && Date.now() < end;) await new Promise(r => setTimeout(r, 20));
            await new Promise(r => requestAnimationFrame(r));
            const css = e => e ? getComputedStyle(e) : {};
            const s = css(document.querySelector('#host .map-jr-ctrl-group')), group = {backdropFilter: s.backdropFilter ?? null, borderTopLeftRadius: s.borderTopLeftRadius ?? null};
            const el = Object.assign(document.createElement('div'), {style: 'width:100px;height:80px'});
            document.body.appendChild(el);
            const m = new mod.Map({container: el, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: []}});
            m.addControl(new mod.NavigationControl());
            const compat = css(el.querySelector('.map-jr-ctrl-group')).backdropFilter ?? null;
            m.remove(); el.remove();
            // The two custom properties of the look reach the popup (whose inline background and radius the CSS of MapLibre does not change).
            const host = document.querySelector('#host'), content = document.createElement('div');
            content.textContent = 'Popup';
            const popup = t.host.overlay(content, {lngLat: t.host.state.get().view.center, popup: true, onClose() {}});
            await new Promise(r => requestAnimationFrame(r));
            const box = content.closest('.map-jr-popup-content'), look = () => { const p = css(box); return `${p.backgroundColor} ${p.borderTopLeftRadius}`; };
            const popupDefault = look();
            host.style.setProperty('--map-control-opacity', '.3'); host.style.setProperty('--map-control-radius', '8px');
            const popupSet = look();
            host.style.removeProperty('--map-control-opacity'); host.style.removeProperty('--map-control-radius');
            popup.remove();
            // The compass shows the direction that the map faces.
            const letter = () => document.querySelector('#host .map-jr-ctrl-compass text')?.textContent;
            const map = t.host._map, faces = [letter()];
            // (The compass follows the event move, which can come a few frames later with the worker renderer.)
            for (const [bearing, face] of [[90, 'E'], [-135, 'W'], [0, 'N']]) { map.jumpTo({bearing}); for (let i = 0; i < 40 && letter() !== face; i++) await new Promise(r => setTimeout(r, 25)); faces.push(letter() + (map.getBearing() === bearing ? '' : '@' + map.getBearing()) + document.querySelectorAll('#host .map-jr-ctrl-compass').length); }
            t.host.update(t.spec);
            return {main: host.classList.contains('map-jr-glass'), blur: group.backdropFilter, radius: group.borderTopLeftRadius, compat, compatClass: el.classList.contains('map-jr-glass'), popupDefault, popupSet, faces: faces.join(' ')};
        });
        check(`[${renderer}] the controls of the main API have a blur, a rule of the page still wins, --map-control-opacity and --map-control-radius reach the popup, the compass names the nearest of N, E, S and W, and a map of the compat entry keeps the look of MapLibre GL JS`,
            glass.main && glass.blur === 'blur(5px)' && glass.radius === '4px' && glass.compat === 'none' && !glass.compatClass
            && glass.popupDefault === 'rgba(255, 255, 255, 0.65) 12px' && glass.popupSet === 'rgba(255, 255, 255, 0.4) 6px' && glass.faces === 'N E1 W1 N1', JSON.stringify(glass));
        // #709: Escape closes a popup of overlay() that has `onClose` and holds the focus. A popup without `onClose` stays open.
        const escape = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const key = el => el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
            const lngLat = t.host.state.get().view.center, content = document.createElement('div'), plain = document.createElement('input');
            content.textContent = 'Escape';
            let closes = 0;
            const popup = t.host.overlay(content, {lngLat, popup: true, onClose() { closes++; popup.remove(); }});
            const other = t.host.overlay(plain, {lngLat, popup: true});
            await wait(300);
            const box = content.closest('.map-jr-popup-content');
            box.querySelector('button').focus();
            const focused = box.contains(document.activeElement) && document.activeElement !== document.body;
            key(document.activeElement);
            await wait(500);
            const gone = !content.isConnected, focus = document.activeElement === t.host._map.getCanvas();
            plain.focus();
            key(plain);
            await wait(300);
            const plainOpen = plain.isConnected && document.activeElement === plain;
            other.remove();
            // #832: the focus also returns to the map when it was on a button in the content.
            const inner = document.createElement('div'), button = inner.appendChild(document.createElement('button'));
            button.textContent = 'In the content';
            const second = t.host.overlay(inner, {lngLat, popup: true, onClose() { second.remove(); }});
            await wait(300);
            button.focus();
            const innerFocused = document.activeElement === button;
            key(button);
            await wait(500);
            const innerFocus = document.activeElement === t.host._map.getCanvas();
            return {focused, closes, gone, focus, plainOpen, innerFocused, innerFocus};
        });
        check(`[${renderer}] Escape closes a popup of overlay() that has onClose and holds the focus, the focus goes to the map (also from a button in the content), and a popup without onClose stays open`,
            escape.focused && escape.closes === 1 && escape.gone && escape.focus && escape.plainOpen && escape.innerFocused && escape.innerFocus, JSON.stringify(escape));
        // #866: a popup of overlay() that opens from a key press on the map takes the focus, and Escape returns it to the
        // map. A popup that opens from a click leaves the focus where it is.
        await page.evaluate(() => {
            const t = window.t, box = t.host.container;
            t.open866 = () => {
                const inner = document.createElement('div'), button = inner.appendChild(document.createElement('button'));
                button.textContent = 'Details';
                t.pop866 = t.host.overlay(inner, {lngLat: t.host.state.get().view.center, popup: true, onClose() { t.pop866.remove(); }});
                t.in866 = inner;
            };
            t.key866 = e => { if (e.key === 'Enter') t.open866(); };
            box.addEventListener('keydown', t.key866);
            t.host._map.getCanvas().focus();
        });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
        const byKey = await page.evaluate(() => window.t.in866.closest('.map-jr-popup').contains(document.activeElement));
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const back = await page.evaluate(() => { const t = window.t; t.host.container.removeEventListener('keydown', t.key866); return !t.in866.isConnected && document.activeElement === t.host._map.getCanvas(); });
        const r866 = await page.evaluate(() => { const r = window.t.host.container.getBoundingClientRect(); return {x: r.left + 20, y: r.top + 20}; });
        await page.evaluate(() => window.t.host.container.addEventListener('pointerdown', window.t.open866, {once: true}));
        await page.mouse.click(r866.x, r866.y);
        await page.waitForTimeout(300);
        const byClick = await page.evaluate(() => { const t = window.t, inside = t.in866.closest('.map-jr-popup').contains(document.activeElement); t.pop866.remove(); return inside; });
        check(`[${renderer}] a popup of overlay() opened from a key press takes the focus and Escape returns it to the map, and a popup opened from a click leaves the focus`,
            byKey && back && !byClick, JSON.stringify({byKey, back, byClick}));
        // #435: destroy() leaves no popup and no marker of overlay() on the page, and does not call onClose.
        const destroyed = await page.evaluate(async renderer => {
            const el = Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'});
            document.body.appendChild(el);
            const host = window.t.lib.createMap(el, {style: {version: 8, sources: {}, layers: []}, attribution: false, renderer});
            const content = () => Object.assign(document.createElement('div'), {textContent: 'Overlay'});
            let closes = 0;
            const open = content(), fading = content(), marker = content();
            host.overlay(open, {lngLat: [0, 0], popup: true, onClose() { closes++; }});
            const closing = host.overlay(fading, {lngLat: [0, 0], popup: true});
            host.overlay(marker, {lngLat: [0, 0]});
            await new Promise(r => setTimeout(r, 300));
            closing.remove();
            const during = el.querySelectorAll('.map-jr-popup').length;
            host.destroy();
            const out = {during, open: open.isConnected, marker: marker.isConnected, popups: el.querySelectorAll('.map-jr-popup').length, closes};
            el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] destroy() removes the popups (open or fading out) and the markers of overlay() at once, and does not call onClose`,
            destroyed.during === 2 && !destroyed.open && !destroyed.marker && destroyed.popups === 0 && destroyed.closes === 0, JSON.stringify(destroyed));
        // The control colorScheme() (#541): for each start (no value, 'auto' with the system light and dark, a fixed value),
        // what two clicks give: the value of the description, the scheme of the map, the calls of onColorSchemeChange and the label.
        const toggles = {};
        for (const [name, media, start] of [['none', 'dark', undefined], ['autoDark', 'dark', 'auto'], ['autoLight', 'light', 'auto'], ['fixedDark', 'light', 'dark']]) {
            await page.emulateMedia({colorScheme: media});
            toggles[name] = await page.evaluate(async start => {
                const t = window.t, {colorScheme} = await import('/dist/controls.js'), calls = [];
                t.host.update({...t.spec, controls: []});
                t.host.update({...t.spec, controls: [colorScheme()], ...start && {colorScheme: start}, onColorSchemeChange: v => calls.push(v)});
                const until = async f => { for (let i = 0; i < 100 && !f(); i++) await new Promise(r => setTimeout(r, 30)); };
                await until(() => document.querySelector('#host .map-jr-ctrl-color-scheme'));
                const b = document.querySelector('#host .map-jr-ctrl-color-scheme'), seen = () => `${t.host.description.colorScheme ?? '-'}/${t.host.state.get().colorScheme}/${b.getAttribute('aria-label')}`;
                const out = [seen()];
                for (let i = 0; i < 2; i++) { b.click(); await new Promise(r => requestAnimationFrame(r)); out.push(seen()); }
                t.host.update(t.spec);
                return out.join(' > ') + ' calls ' + calls.join(',');
            }, start);
        }
        await page.emulateMedia({colorScheme: null});
        const L2 = 'light/light/Use dark colors', D2 = 'dark/dark/Use light colors';
        const wantToggles = {
            none: `-/light/Use dark colors > ${D2} > ${L2} calls dark,light`,
            autoDark: `auto/dark/Use light colors > ${L2} > auto/dark/Use light colors calls light,auto`,
            autoLight: `auto/light/Use dark colors > ${D2} > auto/light/Use dark colors calls dark,auto`,
            fixedDark: `${D2} > ${L2} > ${D2} calls light,dark`,
        };
        check(`[${renderer}] the control colorScheme() flips light and dark, and from 'auto' sets the opposite of the system and then 'auto' again, with onColorSchemeChange and a label that names the action`,
            Object.keys(wantToggles).every(k => toggles[k] === wantToggles[k]), JSON.stringify(toggles));

        // The control styles() (#1504): the list opens with its labels at once, a small second map draws a picture of
        // each style after the first idle, a style that does not load keeps its label, and a choice applies the style,
        // keeps the camera, calls onStyleChange once, closes the list and gives the focus back to the button.
        const picked = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), calls = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const red = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#ff0000'}}]};
            const entries = [{label: 'Streets', style: t.style}, {label: 'Red', style: red}, {label: 'Missing', style: '/no-such-style.json'},
                {label: 'Offline', style: 'http://127.0.0.1:9/style.json'}, {label: 'Page', style: '/'}];
            const host = t.lib.createMap(el, {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14}, renderer, attribution: false, controls: [styles({entries, onStyleChange: e => calls.push(e.label)})]});
            const until = async (f, ms = 30000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 30)); return f(); };
            await until(() => el.querySelector('.map-jr-ctrl-styles'));
            const trigger = el.querySelector('.map-jr-ctrl-styles'), list = el.querySelector('.map-jr-styles-list'), out = {};
            trigger.click();
            const items = [...list.querySelectorAll('button')];
            out.open = `${!list.hidden}/${trigger.getAttribute('aria-expanded')}/${items.map(b => b.textContent).join(',')}/${items.map(b => b.getAttribute('aria-pressed')).join(',')}/${document.activeElement === items[0]}`;
            out.early = list.querySelectorAll('img').length; // (before the first idle of the map, no picture yet)
            const fades = [];
            list.addEventListener('animationstart', e => fades.push(e.animationName));
            // (#1528) Before its picture, an entry shows the placeholder image; the label lies on the picture; the list
            // takes the glass look of the other controls: a blur and a translucent background.
            const bs = items, frame = b => b.querySelector('.map-jr-styles-pic');
            out.placeholder = bs.map(b => getComputedStyle(frame(b)).backgroundImage.includes('data:image/svg+xml') ? 'p' : '-').join(',');
            out.labelOn = bs.every(b => { const f = frame(b).getBoundingClientRect(), l = b.lastElementChild.getBoundingClientRect(); return l.top >= f.top && l.bottom <= f.bottom + .5 && l.height > 0; });
            const ls = getComputedStyle(list);
            out.glass = !CSS.supports('backdrop-filter', 'blur(1px)') || (ls.backdropFilter.includes('blur') && /^rgba\(.*, 0?\.\d+\)$/.test(ls.backgroundColor)) || `${ls.backdropFilter} ${ls.backgroundColor}`;
            document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            out.escape = `${list.hidden}/${document.activeElement === trigger}`;
            // (A style that fails, by status, by network or with an answer that is not JSON, ends its picture at once.)
            const hidden = () => document.querySelectorAll('body > div[aria-hidden="true"]').length;
            await until(() => host.state.get().idle);
            const idleAt = Date.now();
            await until(() => list.querySelectorAll('img').length === 2 && !hidden());
            out.drawn = Date.now() - idleAt;
            await new Promise(r => setTimeout(r, 500));
            const pageCss = document.head.appendChild(Object.assign(document.createElement('style'), {textContent: 'img{border:4px solid red;opacity:.5}'}));
            const imgs = [...list.querySelectorAll('button')].map(b => b.querySelector('img'));
            // The fade runs once per new picture, not at each opening of the list.
            const frames = n => new Promise(r => { const f = () => --n ? requestAnimationFrame(f) : r(); requestAnimationFrame(f); });
            // (A picture that came while the list was closed fades in at this opening: the check reads after the fade.)
            trigger.click();
            if (imgs[0]?.className) await new Promise(r => { imgs[0].addEventListener('animationend', r, {once: true}); setTimeout(r, 3000); });
            await frames(2);
            out.pageRule = imgs[0] ? `${imgs[0].className || '-'}/${getComputedStyle(imgs[0]).borderTopWidth}/${getComputedStyle(imgs[0]).opacity}` : '';
            pageCss.remove();
            trigger.click(); await frames(2);
            trigger.click(); await frames(2);
            out.again = imgs[0] ? imgs[0].getAnimations().length : -1;
            trigger.click();
            out.pictures = imgs.map(i => i ? 'img' : '-').join(',');
            out.fade = [...new Set(fades)].join();
            if (imgs[1]) {
                await imgs[1].decode();
                const c = Object.assign(document.createElement('canvas'), {width: 4, height: 4}), g = c.getContext('2d');
                g.drawImage(imgs[1], 0, 0, 4, 4);
                const [r, gr, b] = g.getImageData(2, 2, 1, 1).data;
                out.red = r > 200 && gr < 60 && b < 60;
            }
            const center = host.state.get().view.center.join();
            trigger.click();
            list.querySelectorAll('button')[1].click();
            await new Promise(r => setTimeout(r, 300));
            out.chosen = `${host.description.style === red}/${calls.join(',')}/${host.state.get().view.center.join() === center}/${list.hidden}/${document.activeElement === trigger}`;
            trigger.click();
            out.pressed = [...list.querySelectorAll('button')].map(b => b.getAttribute('aria-pressed')).join(',');
            list.querySelectorAll('button')[1].click(); // the current style: no new call
            out.calls = calls.length;
            out.extraMaps = hidden();
            // Tab out of the open list closes it.
            trigger.click();
            const outsideButton = document.body.appendChild(document.createElement('button'));
            outsideButton.focus();
            out.tabOut = list.hidden;
            outsideButton.remove();
            // A new callback in a later description reaches the control that the map keeps (#1520).
            const later = [];
            host.update({...host.description, controls: [styles({entries, onStyleChange: e => later.push(e.label)})]});
            const kept = el.querySelector('.map-jr-ctrl-styles') === trigger;
            trigger.click();
            list.querySelectorAll('button')[0].click();
            await new Promise(r => setTimeout(r, 300));
            out.newCallback = `${kept}/${later.join(',')}/${calls.length}`;
            // One spec on two maps: an update of one map does not change the callback of the other (#1520).
            const sharedA = [], sharedB = [], one = styles({entries, onStyleChange: e => sharedA.push(e.label)});
            const el2 = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:400px;top:0;width:400px;height:300px;z-index:100'}));
            const other = t.lib.createMap(el2, {style: t.style, renderer, attribution: false, controls: [one]});
            host.update({...host.description, controls: []});
            host.update({...host.description, controls: [one]});
            host.update({...host.description, controls: [styles({entries, onStyleChange: e => sharedB.push(e.label)})]});
            await until(() => el2.querySelector('.map-jr-ctrl-styles'));
            el2.querySelector('.map-jr-ctrl-styles').click();
            el2.querySelectorAll('.map-jr-styles-list button')[1].click();
            await new Promise(r => setTimeout(r, 300));
            out.twoMaps = `${sharedA.join(',')}/${sharedB.join(',')}`;
            other.destroy(); el2.remove();
            host.destroy();
            el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] the control styles() lists its entries at once, draws a picture of each style that loads after the first idle, and a choice sets the style, keeps the camera, calls onStyleChange once and returns the focus; a style that fails ends its picture at once, and focus that leaves closes the list`,
            picked.open === 'true/true/Streets,Red,Missing,Offline,Page/true,false,false,false,false/true' && picked.early === 0 && picked.escape === 'true/true' && picked.pictures === 'img,img,-,-,-' && picked.placeholder === 'p,p,p,p,p' && picked.labelOn && picked.glass === true && picked.fade === 'map-jr-styles-in' && picked.pageRule === '-/0px/1' && picked.again === 0 && picked.drawn < 15000 && picked.red === true
            && picked.chosen === 'true/Red/true/true/true' && picked.pressed === 'false,true,false,false,false' && picked.calls === 1 && picked.extraMaps === 0 && picked.tabOut && picked.newCallback === 'true/Streets/1' && picked.twoMaps === 'Red/', JSON.stringify(picked));
        // With prefers-reduced-motion a new picture does not fade in (#1528); the sheet of the control stays on the page.
        await page.emulateMedia({reducedMotion: 'reduce'});
        const stillFade = await page.evaluate(() => {
            const f = document.body.appendChild(Object.assign(document.createElement('span'), {className: 'map-jr-styles-pic'})), img = f.appendChild(Object.assign(document.createElement('img'), {className: 'map-jr-styles-in'}));
            const name = getComputedStyle(img).animationName;
            f.remove();
            return name;
        });
        await page.emulateMedia({reducedMotion: null});
        check(`[${renderer}] a picture of the control styles() does not fade in with prefers-reduced-motion`, stillFade === 'none', stillFade);
        // preview.style of styles() changes the style of the pictures only, and the pictures apply map-jr:ssr unless preview.ssr is false (#1507).
        const pictureOnly = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), seen = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const bg = (id, color, metadata) => ({id, type: 'background', paint: {'background-color': color}, ...(metadata && {metadata})});
            const hidden = {version: 8, sources: {}, layers: [bg('bg', '#ff0000'), bg('cover', '#00ff00', {'map-jr:ssr': {hidden: true}})]};
            const red = {version: 8, sources: {}, layers: [bg('bg', '#ff0000')]};
            const entries = [{label: 'Hidden', style: hidden}, {label: 'Blue', style: red}, {label: 'URL', style: '/style.json'}];
            const preview = {style: (s, e) => {
                seen.push(e.label + ':' + (e.label === 'URL' ? /^https?:/.test(Object.values(s.sources)[0].url ?? Object.values(s.sources)[0].tiles?.[0] ?? '') : s.layers.length));
                if (e.label === 'Blue') s.layers[0].paint['background-color'] = '#0000ff';
            }};
            const host = t.lib.createMap(el, {style: red, renderer, attribution: false, controls: [styles({entries, preview})]});
            const until = async (f, ms = 30000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 30)); return f(); };
            const imgs = () => [...el.querySelectorAll('.map-jr-styles-pic img')];
            await until(() => imgs().length === 3);
            const pixel = async img => { await img.decode(); const c = Object.assign(document.createElement('canvas'), {width: 10, height: 10}), g = c.getContext('2d'); g.drawImage(img, 0, 0, 10, 10); const d = g.getImageData(5, 5, 1, 1).data; return d[0] > 200 ? 'r' : d[1] > 200 ? 'g' : d[2] > 200 ? 'b' : '?'; };
            const out = {count: imgs().length, colors: (await Promise.all(imgs().slice(0, 2).map(pixel))).join(''), seen: seen.join(',')};
            el.querySelector('.map-jr-ctrl-styles').click();
            el.querySelectorAll('.map-jr-styles-list button')[1].click();
            await new Promise(r => setTimeout(r, 300));
            out.mapColor = host._map.getStyle().layers[0].paint['background-color'];
            out.entryColor = red.layers[0].paint['background-color'];
            host.destroy();
            el.replaceChildren();
            // With preview.ssr false, the layer that map-jr:ssr hides is in the picture.
            const off = t.lib.createMap(el, {style: red, renderer, attribution: false, controls: [styles({entries: [entries[0]], preview: {ssr: false}})]});
            await until(() => imgs().length === 1);
            out.off = await pixel(imgs()[0]);
            off.destroy();
            el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] preview.style and the default preview.ssr of styles() change the style of the pictures only, preview.ssr false draws the full style, and a style of a URL comes to preview.style with absolute URLs`,
            pictureOnly.count === 3 && pictureOnly.colors === 'rb' && pictureOnly.off === 'g' && pictureOnly.seen === 'Hidden:1,Blue:1,URL:true' && pictureOnly.mapColor === '#ff0000' && pictureOnly.entryColor === '#ff0000', JSON.stringify(pictureOnly));
        // A picture of styles() that fails warns once for its entry, and the later pictures still draw (#1507): preview.style
        // that throws or returns no style, an HTTP error, and a style URL that never answers. A style of a protocol of
        // addProtocol loads through the request path of the map. A preview with center and no zoom warns.
        const pictureFaults = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); warn.apply(console, a); };
            const red = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#ff0000'}}]};
            t.lib.addProtocol('rev1507', async () => ({data: red}));
            t.lib.addProtocol('hang1507', () => new Promise(() => {}));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const entries = [{label: 'Throws', style: red}, {label: 'Number', style: red}, {label: 'Missing', style: '/no-such-style-1507.json'}, {label: 'Hangs', style: 'hang1507://style'},
                {label: 'Protocol', style: 'rev1507://style'}, {label: 'Last', style: red}];
            const preview = {style: (s, e) => { if (e.label === 'Throws') throw new Error('boom'); if (e.label === 'Number') return 42; }};
            const start = Date.now();
            const host = t.lib.createMap(el, {style: red, renderer, attribution: false, controls: [styles({entries, preview})]});
            const until = async (f, ms = 60000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 50)); return f(); };
            const pics = () => [...el.querySelectorAll('.map-jr-styles-pic')].map(f => f.querySelector('img') ? 'img' : '-').join(',');
            await until(() => pics() === '-,-,-,-,img,img');
            const out = {pics: pics(), seconds: Math.round((Date.now() - start) / 1000)};
            el.querySelector('.map-jr-ctrl-styles').click(); // (opening the list does not draw the failed pictures again or warn again)
            await new Promise(r => setTimeout(r, 500));
            host.destroy();
            const half = t.lib.createMap(el, {style: red, renderer, attribution: false, controls: [styles({entries: [{label: 'A', style: red}], preview: {center: [0, 0]}})]});
            await until(() => warns.some(w => w.startsWith('[map-jr-gl] E11560 ')), 5000);
            half.destroy();
            el.remove();
            console.warn = warn;
            // (The production file prints the code, its link, the label and the reason, #2148.)
            const mine = warns.filter(w => /^\[map-jr-gl\] E1?1560 https:\/\/map-jr\.org\/e\/1?1560\b/.test(w));
            out.labels = mine.filter(w => w.startsWith('[map-jr-gl] E1560 ')).map(w => w.match(/ label="([^"]*)"/)[1]).join(',');
            out.text = mine.join(' | ');
            out.half = mine.some(w => w === '[map-jr-gl] E11560 https://map-jr.org/e/11560');
            return out;
        }, renderer);
        check(`[${renderer}] a picture of styles() that fails warns once with the label and the reason, later pictures draw, a style of addProtocol has a picture, and a preview with center and no zoom warns`,
            pictureFaults.pics === '-,-,-,-,img,img' && pictureFaults.labels === 'Throws,Number,Missing,Hangs' && /threw \\"boom\\"/.test(pictureFaults.text) && /returned 42/.test(pictureFaults.text)
            && /answered HTTP 404/.test(pictureFaults.text) && /did not answer in 20 s/.test(pictureFaults.text) && pictureFaults.half, JSON.stringify(pictureFaults));
        // A request of a style that fails warns with one prefix, and removing styles() while a style request hangs aborts it
        // and removes the hidden box at once (#1507).
        const styleRequest = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); warn.apply(console, a); };
            let aborted = false, asked = false;
            t.lib.addProtocol('fail1507', async () => { throw new Error('Failed to fetch'); });
            t.lib.addProtocol('stall1507', (_, ac) => { asked = true; ac.signal.addEventListener('abort', () => { aborted = true; }); return new Promise(() => {}); });
            const red = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#ff0000'}}]};
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const until = async (f, ms = 20000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 50)); return f(); };
            const boxes = () => [...document.body.children].filter(e => e.getAttribute('aria-hidden') === 'true' && e.style.position === 'fixed').length;
            const host = t.lib.createMap(el, {style: red, renderer, attribution: false, controls: [styles({entries: [{label: 'Fails', style: 'fail1507://x'}, {label: 'Stalls', style: 'stall1507://x'}]})]});
            await until(() => asked);
            const before = boxes();
            host.destroy();
            await new Promise(r => setTimeout(r, 200));
            const out = {before, after: boxes(), aborted, warning: warns.find(w => w.startsWith('[map-jr-gl] E1560 https://map-jr.org/e/1560 label="Fails" reason="')) ?? ''};
            out.prefixes = out.warning.split('[map-jr-gl]').length - 1;
            el.remove();
            console.warn = warn;
            return out;
        }, renderer);
        check(`[${renderer}] a failed style request of styles() warns with one prefix, and removing the control while a style request hangs aborts it and removes the hidden box`,
            styleRequest.before === 1 && styleRequest.after === 0 && styleRequest.aborted && styleRequest.prefixes === 1 && /Failed to fetch/.test(styleRequest.warning), JSON.stringify(styleRequest));
        // Removing styles() while a picture is drawn removes the hidden map at once (#1504): here its tiles never answer.
        const removedWhileDrawing = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const stalled = {version: 8, sources: {r: {type: 'raster', tiles: ['http://10.255.255.1/{z}/{x}/{y}.png'], tileSize: 256}}, layers: [{id: 'r', type: 'raster', source: 'r'}]};
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14}, renderer, attribution: false};
            const host = t.lib.createMap(el, {...spec, controls: [styles({entries: [{label: 'Stalled', style: stalled}]})]});
            const hidden = () => document.querySelectorAll('body > div[aria-hidden="true"]').length;
            const until = async (f, ms = 30000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 30)); return f(); };
            const drawing = await until(() => hidden() > 0);
            await new Promise(r => setTimeout(r, 300));
            host.update({...spec, controls: []});
            await new Promise(r => setTimeout(r, 300));
            const out = {drawing, after: hidden()};
            host.destroy();
            el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] removing the control styles() while a picture is drawn removes the hidden map at once`,
            removedWhileDrawing.drawing && removedWhileDrawing.after === 0, JSON.stringify(removedWhileDrawing));
        // An entry of styles() with a light and a dark form (#1506), as a pair of styles or as a style that reads the global
        // state `color-scheme`: a picture of each form, and a choice of a form sets the style and the scheme.
        await page.emulateMedia({colorScheme: 'light'});
        const forms = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), styleCalls = [], schemeCalls = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const bg = color => ({version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': color}}]});
            const reads = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': ['case', ['==', ['global-state', 'color-scheme'], 'dark'], '#0000ff', '#00ff00']}}]};
            const pair = {light: bg('#ff0000'), dark: bg('#0000ff')};
            const entries = [{label: 'Plain', style: bg('#ffffff')}, {label: 'Pair', style: pair}, {label: 'Reads', style: reads, colorSchemes: true}];
            const host = t.lib.createMap(el, {style: entries[0].style, colorScheme: 'light', renderer, attribution: false,
                onColorSchemeChange: s => schemeCalls.push(s), controls: [styles({entries, onStyleChange: e => styleCalls.push(e.label)})]});
            const until = async (f, ms = 30000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 30)); return f(); };
            await until(() => el.querySelector('.map-jr-ctrl-styles'));
            const trigger = el.querySelector('.map-jr-ctrl-styles'), list = el.querySelector('.map-jr-styles-list'), out = {};
            const buttons = () => [...list.querySelectorAll('button')];
            out.names = buttons().map(b => b.getAttribute('aria-label') ?? b.textContent).join(',');
            await until(() => list.querySelectorAll('img').length === 5, 30000);
            const c = Object.assign(document.createElement('canvas'), {width: 4, height: 4}), g = c.getContext('2d');
            out.colors = [];
            for (const img of list.querySelectorAll('img')) {
                await img.decode();
                g.drawImage(img, 0, 0, 4, 4);
                const [r, gr, b] = g.getImageData(2, 2, 1, 1).data;
                out.colors.push(r > 200 && gr > 200 && b > 200 ? 'white' : r > 200 ? 'red' : gr > 200 ? 'green' : b > 200 ? 'blue' : `${r} ${gr} ${b}`);
            }
            out.colors = out.colors.join(',');
            trigger.click();
            buttons()[2].click(); // Pair, dark
            await new Promise(r => setTimeout(r, 100));
            out.dark = `${host.description.style === pair}/${host.description.colorScheme}/${host.state.get().colorScheme}`;
            trigger.click();
            out.pressed = buttons().map(b => b.getAttribute('aria-pressed')).join(',');
            buttons()[1].click(); // Pair, light: only the scheme changes
            await new Promise(r => setTimeout(r, 100));
            out.light = `${host.description.style === pair}/${host.description.colorScheme}`;
            trigger.click();
            buttons()[1].click(); // the current form: nothing
            out.calls = `${styleCalls.join(',')}/${schemeCalls.join(',')}`;
            // A scheme that changes while the list is open moves aria-pressed.
            trigger.click();
            host.patch({colorScheme: 'dark'});
            await new Promise(r => setTimeout(r, 50));
            out.live = buttons().map(b => b.getAttribute('aria-pressed')).join(',');
            // With 'auto', the light form (the system's) changes nothing, and the dark form sets 'dark'.
            host.patch({colorScheme: 'auto'});
            const calls = schemeCalls.length;
            buttons()[1].click();
            out.auto = `${host.description.colorScheme}/${schemeCalls.length - calls}`;
            trigger.click();
            buttons()[2].click();
            out.auto += `/${host.description.colorScheme}/${schemeCalls.at(-1)}`;
            trigger.click();
            buttons()[1].click(); // the system's scheme after 'auto': 'auto' again
            out.auto += `/${host.description.colorScheme}`;
            host.destroy();
            el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] an entry of styles() with a light and a dark form, a pair or a style that reads the global state color-scheme, has a picture of each form, and a choice of a form sets the style and colorScheme and calls onStyleChange and onColorSchemeChange`,
            forms.names === 'Plain,Pair, Light,Pair, Dark,Reads, Light,Reads, Dark' && forms.colors === 'white,red,blue,green,blue' && forms.dark === 'true/dark/dark'
            && forms.pressed === 'false,false,true,false,false' && forms.light === 'true/light' && forms.calls === 'Pair/dark,light'
            && forms.live === 'false,false,true,false,false' && forms.auto === 'auto/0/dark/dark/auto', JSON.stringify(forms));
        // The same with 'auto' and the system in dark: the dark form keeps 'auto', the light form sets 'light', and the
        // dark form then sets 'auto' again.
        await page.emulateMedia({colorScheme: 'dark'});
        const darkSystem = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), calls = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const entries = [{label: 'Reads', style: t.style, colorSchemes: true}];
            const host = t.lib.createMap(el, {style: t.style, colorScheme: 'auto', renderer, attribution: false, onColorSchemeChange: s => calls.push(s), controls: [styles({entries})]});
            const until = async (f, ms = 30000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 30)); return f(); };
            await until(() => el.querySelector('.map-jr-ctrl-styles'));
            const trigger = el.querySelector('.map-jr-ctrl-styles'), list = el.querySelector('.map-jr-styles-list'), seen = [];
            for (const i of [1, 0, 1]) { trigger.click(); list.querySelectorAll('button')[i].click(); seen.push(host.description.colorScheme); }
            host.destroy();
            el.remove();
            return `${seen.join(',')}/${calls.join(',')}`;
        }, renderer);
        await page.emulateMedia({colorScheme: 'light'});
        check(`[${renderer}] with colorScheme 'auto' and the system in dark, a choice of the dark form of styles() keeps 'auto', the light form sets 'light', and the dark form then sets 'auto'`,
            darkSystem === 'auto,light,auto/light,auto', darkSystem);

        // An entry of styles() sets terrain and global state with its style (#1505): a choice sets them together, the
        // next choice gives back the values of the application, the entry that matches the most fields is current, and
        // the picture of each entry shows its global state over that of the application.
        const overridden = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), calls = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const relief = {version: 8, state: {relief: {default: false}}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': ['case', ['global-state', 'relief'], '#ff0000', '#0000ff']}}]};
            const entries = [{label: 'Plain', style: relief}, {label: 'Flat', style: relief, terrain: null}, {label: 'Radar', style: relief, globalState: {relief: false}}, {label: 'Other', style: relief, globalState: {other: 2}}];
            const host = t.lib.createMap(el, {style: relief, globalState: {app: 1, relief: true}, initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false, controls: [styles({entries, onStyleChange: e => calls.push(e.label)})]});
            const until = async (f, ms = 30000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 30)); return f(); };
            await until(() => el.querySelector('.map-jr-ctrl-styles'));
            const trigger = el.querySelector('.map-jr-ctrl-styles'), list = el.querySelector('.map-jr-styles-list'), out = {};
            const items = () => [...list.querySelectorAll('button')];
            const pressed = () => { trigger.click(); const p = items().map(b => b.getAttribute('aria-pressed') === 'true' ? 1 : 0).join(''); trigger.click(); return p; };
            const d = () => `${JSON.stringify(host.description.globalState)}/${'terrain' in host.description ? JSON.stringify(host.description.terrain) : '-'}`;
            const pick = async i => { trigger.click(); items()[i].click(); await new Promise(r => setTimeout(r, 200)); return `${d()}/${pressed()}`; };
            out.start = pressed();
            out.flat = await pick(1);
            out.radar = await pick(2);
            out.other = await pick(3);
            out.plain = await pick(0);
            out.calls = calls.join(',');
            host.patch({terrain: null}); // (by hand: Flat matches more fields than Plain, the last choice)
            out.byHand = pressed();
            await until(() => list.querySelectorAll('img').length === 4);
            const colour = async img => {
                await img.decode();
                const c = Object.assign(document.createElement('canvas'), {width: 4, height: 4}), g = c.getContext('2d');
                g.drawImage(img, 0, 0, 4, 4);
                const [r, , b] = g.getImageData(2, 2, 1, 1).data;
                return r > 200 && b < 60 ? 'red' : b > 200 && r < 60 ? 'blue' : `${r},${b}`;
            };
            out.pictures = (await Promise.all([...list.querySelectorAll('img')].map(colour))).join(',');
            host.destroy();
            el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] an entry of styles() sets its terrain and global state with its style, the next choice gives back the values of the application, the entry that matches the most fields is current, and its picture shows its global state over that of the application`,
            overridden.start === '1000' && overridden.flat === '{"app":1,"relief":true}/null/0100' && overridden.radar === '{"app":1,"relief":false}/-/0010'
            && overridden.other === '{"app":1,"relief":true,"other":2}/-/0001' && overridden.plain === '{"app":1,"relief":true}/-/1000' && overridden.byHand === '0100'
            && overridden.calls === 'Flat,Radar,Other,Plain' && overridden.pictures === 'red,red,blue,red', JSON.stringify(overridden));

        // An entry of styles() with terrain, global state and a light and a dark form together (#1505, #1506): a form sets
        // all of them with the scheme, the other form changes only the scheme, and the next entry gives back the rest.
        await page.emulateMedia({colorScheme: 'light'});
        const together = await page.evaluate(async renderer => {
            const t = window.t, {styles} = await import('/dist/controls.js'), calls = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:100'}));
            const dark = ['==', ['global-state', 'color-scheme'], 'dark'];
            const style = {version: 8, state: {relief: {default: true}}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color':
                ['case', ['global-state', 'relief'], '#ff0000', ['case', dark, '#0000ff', '#00ff00']]}}]};
            const entries = [{label: 'Plain', style}, {label: 'Both', style, terrain: null, globalState: {relief: false}, colorSchemes: true}];
            const host = t.lib.createMap(el, {style, colorScheme: 'light', globalState: {app: 1}, initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false, controls: [styles({entries, onStyleChange: e => calls.push(e.label)})]});
            const until = async (f, ms = 30000) => { for (const end = Date.now() + ms; !f() && Date.now() < end;) await new Promise(r => setTimeout(r, 30)); return f(); };
            await until(() => el.querySelector('.map-jr-ctrl-styles'));
            const trigger = el.querySelector('.map-jr-ctrl-styles'), list = el.querySelector('.map-jr-styles-list'), out = {};
            const d = () => `${JSON.stringify(host.description.globalState)}/${'terrain' in host.description ? JSON.stringify(host.description.terrain) : '-'}/${host.description.colorScheme}`;
            const pick = async i => { trigger.click(); list.querySelectorAll('button')[i].click(); await new Promise(r => setTimeout(r, 200)); trigger.click(); const p = [...list.querySelectorAll('button')].map(b => b.getAttribute('aria-pressed') === 'true' ? 1 : 0).join(''); trigger.click(); return `${d()}/${p}`; };
            out.dark = await pick(2);
            out.light = await pick(1);
            out.plain = await pick(0);
            out.calls = calls.join(',');
            await until(() => list.querySelectorAll('img').length === 3);
            const c = Object.assign(document.createElement('canvas'), {width: 4, height: 4}), g = c.getContext('2d'), colors = [];
            for (const img of list.querySelectorAll('img')) {
                await img.decode();
                g.drawImage(img, 0, 0, 4, 4);
                const [r, gr, b] = g.getImageData(2, 2, 1, 1).data;
                colors.push(r > 200 ? 'red' : gr > 200 ? 'green' : b > 200 ? 'blue' : `${r} ${gr} ${b}`);
            }
            out.pictures = colors.join(',');
            host.destroy();
            el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] an entry of styles() with terrain, global state and a light and a dark form sets them all with the scheme, its other form changes only the scheme, and the next entry gives back the rest`,
            together.dark === '{"app":1,"relief":false}/null/dark/001' && together.light === '{"app":1,"relief":false}/null/light/010' && together.plain === '{"app":1}/-/light/100'
            && together.calls === 'Both,Plain' && together.pictures === 'red,green,blue', JSON.stringify(together));

        // `style: {light, dark}` (#491): the style of the resolved scheme, a change of the media query changes it, and a
        // layer of the description and its data stay. A pair with the same content in update() is the same style.
        await page.emulateMedia({colorScheme: 'light'});
        const paired = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:80px'}));
            const make = id => ({version: 8, sources: {}, layers: [{id, type: 'background'}]});
            const pts = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]};
            const wait = (f, end = Date.now() + 8000) => new Promise(r => { const h = () => { if (f() || Date.now() > end) r(); else setTimeout(h, 50); }; h(); });
            const ids = () => (host._map.getStyle()?.layers ?? []).map(l => l.id).join(',');
            let spec = {style: {light: make('L'), dark: make('D')}, colorScheme: 'auto', layers: [{id: 'dots', type: 'circle', source: 'pts'}], data: {pts}, renderer, attribution: false};
            const host = t.lib.createMap(el, spec), out = {};
            await wait(() => host.state.get().idle);
            out.light = ids();
            // (The development build warns for an object that is neither a style nor a pair, and for a pair with one value.)
            const said = [], log = console.warn; console.warn = (...a) => { said.push(a.join(' ')); log(...a); };
            host.update(spec = {...spec, style: {light: make('L')}});
            // (An object with layers and no version: the engine draws it, so the test has no page error.)
            host.update(spec = {...spec, style: {sources: {}, layers: [{id: 'L', type: 'background'}]}});
            await new Promise(r => setTimeout(r, 300));
            console.warn = log;
            out.warned = [said.some(w => w.startsWith('[map-jr-gl] E46 style: the pair has no "dark", so the map uses "light"')), said.some(w => w.startsWith('[map-jr-gl] E45 style: the object is not a style'))].join();
            host.update(spec = {...spec, style: {light: make('L'), dark: make('D')}});
            await wait(() => ids() === 'L,dots' && host.state.get().idle);
            window.pairHost = host;
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        await page.emulateMedia({colorScheme: 'dark'});
        Object.assign(paired, await page.evaluate(async () => {
            const host = window.pairHost, out = {};
            const wait = (f, end = Date.now() + 8000) => new Promise(r => { const h = () => { if (f() || Date.now() > end) r(); else setTimeout(h, 50); }; h(); });
            const ids = () => (host._map.getStyle()?.layers ?? []).map(l => l.id).join(',');
            await wait(() => ids().startsWith('D') && host.state.get().idle);
            out.dark = ids();
            out.data = (await Promise.race([host.querySource('pts'), new Promise(r => setTimeout(() => r({length: 'timeout'}), 3000))])).length;
            const loads = [];
            host._map.on('styledataloading', () => loads.push(1));
            host.update({...host.description, style: JSON.parse(JSON.stringify(host.description.style))});
            await new Promise(r => setTimeout(r, 200));
            out.sameReloads = loads.length;
            // (With no colorScheme the scheme is light, also while the browser asks for dark.)
            const {colorScheme, ...none} = host.description;
            host.update(none);
            await wait(() => ids().startsWith('L') && host.state.get().idle);
            out.none = ids();
            host.destroy(); delete window.pairHost;
            return out;
        }).catch(e => ({error: String(e)})));
        await page.emulateMedia({colorScheme: null});
        check(`[${renderer}] style: {light, dark} uses the style of the resolved scheme (light with no colorScheme), changes it with prefers-color-scheme under 'auto' and keeps a layer of the description and its data`,
            JSON.stringify(paired) === JSON.stringify({light: 'L,dots', warned: 'true,true', dark: 'D,dots', data: 1, sameReloads: 0, none: 'L,dots'}), JSON.stringify(paired));

        // 5b. One method to find features, and the same question kept up to date.
        const found = await page.evaluate(async () => {
            const h = window.t.host, c = h.state.get().view.center, wait = ms => new Promise(r => setTimeout(r, ms));
            const sources = Object.keys(window.t.spec.style.sources).filter(id => window.t.spec.style.sources[id].type === 'vector');
            const drawnAtPoint = await h.queryFeatures({x: 450, y: 300}), drawnAtPosition = await h.queryFeatures(c), drawnAll = await h.queryFeatures();
            const layers = [...new Set(drawnAll.map(f => f.layer.id))].slice(0, 1), drawnInLayer = await h.queryFeatures({layers}), drawnInLayerToo = await h.queryFeatures(undefined, {layers});
            const all = async (place, o) => (await Promise.all(sources.map(id => h.querySource(id, place, o)))).flat();
            const dataAtPosition = await all(c, {radius: 30}), dataInBox = await all([{x: 300, y: 200}, {x: 600, y: 400}]), dataAll = await all();
            const calls = [], sourceCalls = [];
            const stop = h.watchFeatures({x: 450, y: 300}, {}, f => calls.push(f.length)), stopSource = h.watchSource(sources[0], {x: 450, y: 300}, {radius: 30}, f => sourceCalls.push(f.length));
            await wait(600);
            const first = calls.length;
            h.moveTo({center: [c[0] + 0.01, c[1] + 0.004]});
            await wait(2500);
            const moved = calls.length;
            stop(); stopSource();
            const sourceMoved = sourceCalls.length;
            h.moveTo({center: c});
            await wait(1500);
            return {drawnInLayer: drawnInLayer.length, drawnInLayerToo: drawnInLayerToo.length, inLayer: drawnInLayer.every(f => f.layer.id === layers[0]), sourceFirst: sourceCalls[0], sourceMoved, sourceAfter: sourceCalls.length,
                drawnAtPoint: drawnAtPoint.length, drawnAtPosition: drawnAtPosition.length, drawnAll: drawnAll.length, dataAtPosition: dataAtPosition.length, dataInBox: dataInBox.length, dataAll: dataAll.length, layer: typeof drawnAll[0]?.layer, first, moved, after: calls.length};
        });
        check(`[${renderer}] queryFeatures and querySource: a point, a position, a rectangle or the whole map, options in the place of at; watchFeatures and watchSource follow the map`,
            found.drawnInLayer > 0 && found.drawnInLayer === found.drawnInLayerToo && found.inLayer && found.sourceFirst > 0 && found.sourceMoved >= 2 && found.sourceAfter === found.sourceMoved && found.drawnAtPoint > 0 && found.drawnAtPosition > 0 && found.drawnAll > found.drawnAtPoint && found.dataAtPosition > 0 && found.dataInBox > 0 && found.dataAll >= found.dataInBox && found.layer === 'object'
            && found.first === 1 && found.moved >= 2 && found.after === found.moved, JSON.stringify(found));

        // 5b. A listener that throws stops neither the watch nor the other listeners of the event (#22).
        const thrown = await page.evaluate(async () => {
            const h = window.t.host, wait = ms => new Promise(r => setTimeout(r, ms));
            let calls = 0, second = 0;
            const stop = h.watchFeatures({x: 450, y: 300}, {}, () => { if (!calls++) throw new Error('thrown by the test'); });
            await wait(600);
            h.moveTo({center: [-74.0105, 40.7045]});
            await wait(1500);
            stop();
            const offA = h.listen('test22', () => { throw new Error('thrown by a listener'); }), offB = h.listen('test22', () => second++);
            const log = console.error, reported = [], offError = h.listen('error', e => reported.push(e.error?.message));
            console.error = () => {};
            h._map.fire('test22');
            console.error = log;
            offA(); offB(); offError();
            return {calls, second, error: reported.join()};
        });
        check(`[${renderer}] a watchFeatures listener that throws is called again, and a listener that throws leaves the next listener its event and is reported as an error`,
            thrown.calls >= 2 && thrown.second === 1 && thrown.error === 'thrown by a listener', JSON.stringify(thrown));

        // 5d. The cluster methods of a GeoJSON source, as promises, and a message when the source has no clusters (#217).
        const clusters = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const points = Array.from({length: 12}, (_, i) => ({type: 'Feature', properties: {i}, geometry: {type: 'Point', coordinates: [-74.0065 + (i % 4) * 0.0004, 40.7085 + Math.floor(i / 4) * 0.0004]}}));
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 10}, renderer, attribution: false,
                sources: {pts: {type: 'geojson', cluster: true, data: {type: 'FeatureCollection', features: points}}, plain: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
                    layers: [{id: 'pts-circle', type: 'circle', source: 'pts', paint: {'circle-radius': 20}}]};
            const host = t.lib.createMap(el, spec);
            await idle(host);
            const found = await host.queryFeatures(undefined, {layers: ['pts-circle']});
            const id = found.find(f => f.properties.cluster)?.properties.cluster_id;
            const zoom = await host.clusterExpansionZoom('pts', id), children = await host.clusterChildren('pts', id);
            const all = await host.clusterLeaves('pts', id, {limit: Infinity}), two = await host.clusterLeaves('pts', id, {limit: 2, offset: 1}), ten = await host.clusterLeaves('pts', id);
            const failed = p => p.then(() => 'answered', e => e.message);
            const errors = [await failed(host.clusterExpansionZoom('plain', 1)), await failed(host.clusterLeaves('nothing', 1)), await failed(host.clusterChildren('pts', 999999)), await failed(host.clusterLeaves('pts', id, 2, 1))];
            const members = ['map' in host, '_map' in host];
            host.destroy(); el.remove();
            return {id, zoom, children: children.length, all: all.length, two: two.length, point: all[0]?.geometry.type, ten: ten.length, errors, members};
        }, renderer);
        check(`[${renderer}] clusterExpansionZoom, clusterChildren and clusterLeaves({limit, offset}) answer for a cluster, and reject with a message otherwise; the host has _map and no map (#503)`,
            typeof clusters.id === 'number' && clusters.zoom > 10 && clusters.children >= 1 && clusters.all === 12 && clusters.two === 2 && clusters.point === 'Point'
            && clusters.errors[0].startsWith('[map-jr-gl] clusterExpansionZoom(): ') && clusters.errors[1].includes('"nothing" is not a GeoJSON source') && clusters.errors[2].startsWith('[map-jr-gl] clusterChildren(): ')
            && clusters.ten === 10 && clusters.errors[3].startsWith('[map-jr-gl] clusterLeaves(): E503 the third argument is 2. Pass {limit, offset}') && clusters.members.join() === 'false,true', JSON.stringify(clusters));

        // 5d2. A GeoJSON source of `sources` whose id is a key of `data` needs no `data` of its own, at the start and when it is added by an update;
        // one with no `data` and no key warns in the development build (#1189).
        const optioned = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const idle = host => new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const points = n => ({type: 'FeatureCollection', features: Array.from({length: 12}, (_, i) => ({type: 'Feature', properties: {i}, geometry: {type: 'Point', coordinates: [-74.0065 + (i % 4) * 0.0004 + n, 40.7085 + Math.floor(i / 4) * 0.0004]}}))});
            const layer = id => ({id, type: 'circle', source: id, paint: {'circle-radius': 20}});
            const warnings = [], warn = console.warn; console.warn = (...a) => { warnings.push(String(a[0])); };
            const first = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 10}, renderer, attribution: false, sources: {pts: {type: 'geojson', cluster: true}}, data: {pts: points(0)}, layers: [layer('pts')]};
            const host = t.lib.createMap(el, first);
            await idle(host);
            const clustered = id => host.queryFeatures(undefined, {layers: [id]}).then(f => f.some(x => x.properties.cluster));
            const one = await clustered('pts');
            host.update({...first, sources: {...first.sources, more: {type: 'geojson', cluster: true}, bare: {type: 'geojson'}}, data: {pts: first.data.pts, more: points(0.01)}, layers: [layer('pts'), layer('more')]});
            await idle(host);
            const two = await clustered('more');
            const bare = warnings.filter(w => w.includes('GeoJSON source "bare"')).length, others = warnings.filter(w => w.includes('GeoJSON source "pts"') || w.includes('GeoJSON source "more"')).length;
            console.warn = warn; host.destroy(); el.remove();
            return {one, two, bare, others, warnings};
        }, renderer);
        check(`[${renderer}] a GeoJSON source of "sources" with a key in "data" needs no "data" of its own, at the start and in an update, and a bare source warns (#1189)`,
            optioned.one && optioned.two && optioned.bare === 1 && optioned.others === 0, JSON.stringify(optioned));

        // 5c. A rejection of the question of watchFeatures is an error of the map, and is not lost (#92).
        const rejected = await page.evaluate(async () => {
            const h = window.t.host, log = console.error, reported = [], offError = h.listen('error', e => reported.push(e.error?.message));
            console.error = () => {};
            const stop = h.watchFeatures({lng: -74.0105, lat: 40.7045}, {}, () => {});
            await new Promise(r => setTimeout(r, 600));
            stop(); offError(); console.error = log;
            return reported.join(' | ');
        });
        check(`[${renderer}] a watchFeatures question that is rejected is reported as an error of the map`, rejected.includes('queryFeatures()'), rejected);

        // 6. The end. The queries that have no answer yet are rejected, and so is a query after it. No callback runs after it.
        const end = await page.evaluate(async () => {
            const t = window.t, h = t.host, said = p => Promise.race([p.then(() => 'answered', e => e.message), new Promise(r => setTimeout(() => r('not settled'), 2000))]);
            const sources = Object.keys(t.spec.style.sources).filter(id => t.spec.style.sources[id].type === 'vector');
            let clicks = 0, watched = 0;
            h.update(t.spec = {...t.spec, interactiveLayers: t.spec.style.layers.filter(l => l.source).map(l => l.id), onClick: () => clicks++});
            h._map.fire('click', {point: {x: 450, y: 300}, lngLat: {lng: -74.0105, lat: 40.7045}});
            h.watchSource(sources[0], undefined, {}, () => watched++);
            const waits = said(h.once('dragend'));
            const pending = said(h.querySource(sources[0])), height = said(h.queryElevation([-74.0105, 40.7045]));
            // (Queries that nobody awaits: destroy() must not make them unhandled rejections of the page, #787.)
            h.queryFeatures({x: 450, y: 300}); h.querySource(sources[0]); h.queryElevation([-74.0105, 40.7045]);
            const forgotten = [];
            addEventListener('unhandledrejection', e => forgotten.push(String(e.reason?.message ?? e.reason)));
            h.destroy(); h.update(t.spec);
            const later = said(h.querySource(sources[0])), onceLater = said(h.once('idle'));
            const out = {canvas: !!document.querySelector('#host canvas'), waits: await waits, onceLater: await onceLater, pending: await pending, height: await height, later: await later};
            await new Promise(r => setTimeout(r, 300));
            return {...out, clicks, watched, forgotten};
        });
        check(`[${renderer}] destroy removes the map`, !end.canvas);
        const gone = '[map-jr-gl] E10022 The query has no answer: the map was removed.';
        check(`[${renderer}] destroy rejects a once() that waits and a once() after it`,
            end.waits === '[map-jr-gl] E484 once("dragend"): the map was removed.' && end.onceLater === '[map-jr-gl] E484 once("idle"): the map was removed.', JSON.stringify(end));
        check(`[${renderer}] destroy rejects the queries that wait and a query after it, and onClick and a watchFeatures listener do not run after it`,
            end.pending === gone && end.height === gone && end.later === gone && end.clicks === 0 && end.watched === 0, JSON.stringify(end));
        check(`[${renderer}] destroy with queries that nobody awaits gives no unhandled rejection (#787)`, end.forgotten.length === 0, end.forgotten.join(' | '));
        const other = errors.filter(e => !e.includes('thrown by the test')); // (the browser reports what the listener of 5b threw)
        check(`[${renderer}] no page errors`, other.length === 0, other.slice(0, 2).join(' | '));
    } catch (e) { check(`[${renderer}] the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// (The checks below run with RENDERER=main, including the loop over both renderers near the end.)
if (only === 'worker') { await browser.close(); process.exit(failed ? 1 : 0); }
// With the main renderer, the sprite is requested as soon as the style is known, not once the engine file has loaded
// (#371). The engine file is held back until both files of the sprite have been requested, for 5 s at most; the
// engine then uses those answers and asks for no file a second time.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const asked = [];
        let release, seen = false;
        const sprite = new Promise(r => release = r);
        await page.route(/\/test-sprite\//, route => {
            const url = new URL(route.request().url()).pathname;
            asked.push(url);
            if (asked.length === 2) release();
            if (url.endsWith('.json')) return route.fulfill({contentType: 'application/json', body: JSON.stringify({dot: {x: 0, y: 0, width: 1, height: 1, pixelRatio: 1}})});
            route.fulfill({contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')});
        });
        await page.route(/map-jr-gl-engine-entry/, async route => { seen = await Promise.race([sprite.then(() => true), new Promise(r => setTimeout(() => r(false), 5000))]); await route.continue(); });
        await page.goto(origin + '/bench');
        const idle = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const host = lib.createMap(el, {style: {...style, sprite: location.origin + '/test-sprite/s'}, renderer: 'main', attribution: false});
            const ok = await Promise.race([new Promise(r => host.state.subscribe(s => s.idle, i => i && r(true))), new Promise(r => setTimeout(() => r(false), 30000))]);
            host.destroy(); el.remove();
            return ok;
        });
        check('[main] the sprite is requested before the engine file has loaded, and only once', seen && idle && asked.length === 2, JSON.stringify({seen, idle, asked}));
    } catch (e) { check('the early sprite test was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The file for the images of a style does not load (#495): an error of the map, and no unhandled rejection.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    const rejections = [];
    page.on('pageerror', e => rejections.push(e.message));
    try {
        await page.route(/map-jr-gl-style-images/, route => route.abort());
        await page.goto(origin + '/bench');
        const got = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json(), errors = [];
            window.addEventListener('unhandledrejection', e => errors.push('unhandled ' + e.reason));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const host = lib.createMap(el, {style: {...style, metadata: {'map-jr:images': {sq: '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'}}}, attribution: false, onError: e => errors.push(e.message)});
            for (let i = 0; i < 100 && !errors.length; i++) await new Promise(r => setTimeout(r, 100));
            await new Promise(r => setTimeout(r, 300));
            host.destroy(); el.remove();
            return errors;
        });
        check('the file for the images of a style does not load: the map reports an error and the page has no unhandled rejection',
            got.length === 1 && got[0] === '[map-jr-gl] E495 https://map-jr.org/e/495' && !rejections.length, JSON.stringify({got, rejections}));
    } catch (e) { check('the test of a failed style-images file was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The parts of the worker load on demand (#79): a map of vector tiles requests none, a map with a GeoJSON source
// requests the GeoJSON part once in each tile worker for both of its maps and draws its data, and a part that does not load gives an error
// that names the file. (The requests of a worker are seen in Chromium only.)
for (const renderer of ['worker', 'main']) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const parts = [];
        page.context().on('request', r => { const m = /map-jr-gl-worker-(\w+)\.js/.exec(r.url()); if (m) parts.push(m[1]); });
        await page.goto(origin + '/bench');
        const run = (what, missing) => page.evaluate(async ({renderer, what, missing}) => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json(), errors = [];
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-30, -30], [30, -30], [30, 30], [-30, 30], [-30, -30]]]}};
            // (The elevation tile of `terrain` is one picture in the page: 1000 m everywhere in the terrarium encoding.)
            const dc = Object.assign(document.createElement('canvas'), {width: 256, height: 256}), cg = dc.getContext('2d');
            cg.fillStyle = 'rgb(131,232,0)'; cg.fillRect(0, 0, 256, 256);
            const spec = what === 'vector' ? {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}}
                : what === 'terrain' ? {style: {version: 8, sources: {dem: {type: 'raster-dem', tiles: [dc.toDataURL('image/png')], encoding: 'terrarium', tileSize: 256, maxzoom: 10}}, terrain: {source: 'dem'},
                    layers: [{id: 'bg', type: 'background', paint: {'background-color': '#f00'}}]}, initialView: {center: [7.7, 46], zoom: 10, pitch: 50}}
                : what === 'within' ? {style: {version: 8, sources: {pt: {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#f00'}},
                    {id: 'pt', type: 'circle', source: 'pt', paint: {'circle-radius': 60, 'circle-color': ['case', ['within', square.geometry], '#00f', '#0f0']}}]}, initialView: {center: [0, 0], zoom: 1}}
                : {style: {version: 8, sources: {sq: {type: 'geojson', data: square}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#f00'}}, {id: 'sq', type: 'fill', source: 'sq', paint: {'fill-color': '#00f'}}]}, initialView: {center: [0, 0], zoom: 1}};
            const made = [0, 1].map(() => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
                return {el, host: lib.createMap(el, {...spec, renderer, attribution: false, onError: e => errors.push(e.message)})};
            });
            const idle = await Promise.all(made.map(({host}) => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 10000); })));
            if (missing) for (let i = 0; i < 50 && !errors.length; i++) await new Promise(r => setTimeout(r, 100));
            const b = await made[1].host.toBlob(), bmp = await createImageBitmap(b), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
            g.drawImage(bmp, 0, 0);
            const centre = Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
            const ground = what === 'terrain' ? Math.round(await made[1].host.queryElevation([7.7, 46])) : undefined;
            for (const {host, el} of made) { host.destroy(); el.remove(); }
            return {idle, centre, ground, errors: [...new Set(errors)]};
        }, {renderer, what, missing});
        const vector = await run('vector'), afterVector = parts.splice(0);
        const geojson = await run('geojson'), afterGeoJSON = parts.splice(0);
        const terrain = await run('terrain'), afterTerrain = parts.splice(0);
        const within = await run('within'), afterWithin = parts.splice(0);
        const seen = browserName === 'chromium';
        // 3D terrain (#1849): the engine loads the part for elevation data. In an engine worker that is the file of the part,
        // which the page fetches once with the style; an engine on the page imports the chunk of the same part instead.
        check(`[${renderer}] the parts of the worker: a map with 3D terrain loads the part dem (${renderer === 'worker' ? 'one request of the file' : 'its chunk, not the file'}) and is idle with the height of the ground (#1849)`,
            terrain.idle.every(Boolean) && !terrain.errors.length && terrain.ground === 1000 && (!seen || (renderer === 'worker' ? afterTerrain.length === 1 && afterTerrain[0] === 'dem' : afterTerrain.length === 0)),
            JSON.stringify({terrain, afterTerrain}));
        check(`[${renderer}] the parts of the worker: a map of vector tiles requests none, and two maps with a GeoJSON source request the GeoJSON part once in each tile worker and draw it (#79)`,
            vector.idle.every(Boolean) && !vector.errors.length && geojson.idle.every(Boolean) && !geojson.errors.length && geojson.centre[2] > 200 && geojson.centre[0] < 50 &&
            (!seen || (afterVector.length === 0 && afterGeoJSON.length >= 1 && afterGeoJSON.length <= 4 && afterGeoJSON.every(p => p === 'geojson'))), JSON.stringify({vector, afterVector, geojson, afterGeoJSON}));
        // `within` and `distance` (#1707): a style that uses one loads their part, and its tiles wait for it.
        check(`[${renderer}] the parts of the worker: two maps whose style uses "within" load the part within and draw its result (#1707)`,
            within.idle.every(Boolean) && !within.errors.length && within.centre[2] > 200 && within.centre[1] < 50 && (!seen || afterWithin.includes('within')), JSON.stringify({within, afterWithin}));
        if (seen) {
            // The part of `within` does not load: one warning names the file, and the map is idle with the result false.
            const noPart = await browser.newPage({viewport: {width: 900, height: 600}});
            try {
                const warnings = [];
                noPart.on('console', m => { if (m.type() === 'warning' && m.text().includes('within')) warnings.push(m.text()); });
                await noPart.route(/map-jr-gl-worker-within\.js/, route => route.abort());
                await noPart.goto(origin + '/bench');
                const got = await noPart.evaluate(async renderer => {
                    const lib = await import('/dist/map-jr-gl.js'), errors = [], square = {type: 'Polygon', coordinates: [[[-30, -30], [30, -30], [30, 30], [-30, 30], [-30, -30]]]};
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
                    const host = lib.createMap(el, {style: {version: 8, sources: {pt: {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}}}, layers: [{id: 'pt', type: 'circle', source: 'pt', paint: {'circle-radius': 60, 'circle-color': ['case', ['within', square], '#00f', '#0f0']}}]},
                        initialView: {center: [0, 0], zoom: 1}, renderer, attribution: false, onError: e => errors.push(e.message)});
                    const idle = await new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 10000); });
                    const b = await host.toBlob(), bmp = await createImageBitmap(b), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                    g.drawImage(bmp, 0, 0);
                    const centre = Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
                    host.destroy(); el.remove();
                    return {idle, centre, errors};
                }, renderer);
                check(`[${renderer}] the part of "within" does not load: one warning names the file, and the map is idle and draws "within" as false (#1707)`,
                    got.idle && !got.errors.length && got.centre[1] > 200 && warnings.length === 1 && warnings[0].startsWith('[map-jr-gl]') && warnings[0].includes('map-jr-gl-worker-within.js'), JSON.stringify({got, warnings}));
            } finally { await noPart.close(); }
            // (A new page: its workers have not loaded the part.)
            const other = await browser.newPage({viewport: {width: 900, height: 600}});
            try {
                await other.route(/map-jr-gl-worker-geojson\.js/, route => route.abort());
                await other.goto(origin + '/bench');
                const failed = await other.evaluate(async renderer => {
                    const lib = await import('/dist/map-jr-gl.js'), errors = [];
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
                    const host = lib.createMap(el, {style: {version: 8, sources: {sq: {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}}}, layers: [{id: 'sq', type: 'circle', source: 'sq'}]}, renderer, attribution: false, onError: e => errors.push(e.message)});
                    for (let i = 0; i < 80 && !errors.length; i++) await new Promise(r => setTimeout(r, 100));
                    // (The tiles of the view, their retries and a query fail too: they add no second error.)
                    await host.queryRenderedFeatures?.().catch?.(() => {});
                    await new Promise(r => setTimeout(r, 2500));
                    host.destroy(); el.remove();
                    return errors;
                }, renderer);
                check(`[${renderer}] a part of the worker that does not load: the map reports one error that names the file (#79)`,
                    failed.length === 1 && /^\[map-jr-gl\] E(21846|31846) https:\/\/map-jr\.org\/e\/\1 /.test(failed[0]) && failed[0].includes('map-jr-gl-worker-geojson.js'), JSON.stringify(failed));
            } finally { await other.close(); }
            // The globe (#2075): the tile workers cut its tiles with the part `subdivide`. When that part does not load, the
            // map reports it once and draws its vector tiles without the cut. After setProjection to the globe, the page
            // fetches the part once for all tile workers.
            const globe = await browser.newPage({viewport: {width: 900, height: 600}});
            try {
                const asked = [];
                globe.context().on('request', r => { if (/map-jr-gl-worker-subdivide\.js/.test(r.url())) asked.push(r.url()); });
                await globe.goto(origin + '/bench');
                const run = (projection) => globe.evaluate(async ({renderer, projection}) => {
                    const lib = await import('/dist/map-jr-gl.js'), omt = (await (await fetch('/style.json')).json()).sources.omt, errors = [];
                    const style = {version: 8, ...projection === 'globe' ? {projection: {type: 'globe'}} : {}, sources: {omt},
                        layers: [{id: 'bg', type: 'background', paint: {'background-color': '#f00'}}, {id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': '#00f'}}]};
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
                    const host = lib.createMap(el, {style, initialView: {center: [-74, 40.7], zoom: 3}, renderer, attribution: false, onError: e => errors.push(e.message)});
                    const until = async (f, ms) => { for (let t = 0; t < ms && !f(); t += 50) await new Promise(r => setTimeout(r, 50)); return f(); };
                    let ok = await until(() => host.state.get().idle, 15000);
                    // (The map is busy with the tiles of the globe, and then idle again.)
                    if (projection === 'later') { host._map.setProjection({type: 'globe'}); await until(() => !host.state.get().idle, 3000); ok = await until(() => host.state.get().idle, 15000); }
                    // (The pixels of the water layer: a query finds the features of a tile that failed to build, a picture does not.)
                    const bmp = await createImageBitmap(await host.toBlob()), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                    g.drawImage(bmp, 0, 0);
                    const px = g.getImageData(0, 0, bmp.width, bmp.height).data;
                    let water = 0;
                    for (let i = 0; i < px.length; i += 4) if (px[i + 2] > 200 && px[i] < 50) water++;
                    host.destroy(); el.remove();
                    return {idle: ok, water, errors};
                }, {renderer, projection});
                const later = await run('later'), laterAsked = asked.splice(0);
                await globe.context().route(/map-jr-gl-worker-subdivide\.js/, route => route.fulfill({status: 404, body: ''}));
                // (A new page: its workers have not loaded the part.)
                await globe.goto(origin + '/bench');
                const missing = await run('globe');
                check(`[${renderer}] the part subdivide does not load: the globe reports one error that names the file, draws its vector tiles and is idle (#2075)`,
                    missing.idle && missing.water > 0 && missing.errors.length === 1 && missing.errors[0].includes('map-jr-gl-worker-subdivide.js'), JSON.stringify(missing));
                check(`[${renderer}] setProjection to the globe: the page fetches the part subdivide once for all tile workers, and the globe draws its vector tiles (#2075)`,
                    later.idle && later.water > 0 && !later.errors.length && laterAsked.length === 1, JSON.stringify({later, laterAsked}));
            } finally { await globe.close(); }
            // The layer types heatmap, hillshade and color-relief draw with the part `layers` (#2215). A heatmap map loads
            // it once and draws; when it does not load, the map reports one error and is idle without the heatmap.
            const rare = await browser.newPage({viewport: {width: 900, height: 600}});
            try {
                const asked = [], file = /map-jr-gl-(worker-layers|layers-more-[\w-]+)\.js/;
                rare.context().on('request', r => { if (file.test(r.url())) asked.push(r.url()); });
                const run = () => rare.evaluate(async renderer => {
                    const lib = await import('/dist/map-jr-gl.js'), errors = [];
                    const style = {version: 8, sources: {pt: {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}}},
                        layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'heat', type: 'heatmap', source: 'pt', paint: {'heatmap-radius': 60, 'heatmap-intensity': 3}}]};
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
                    const host = lib.createMap(el, {style, initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false, onError: e => errors.push(e.message)});
                    const until = async (f, ms) => { for (let t = 0; t < ms && !f(); t += 50) await new Promise(r => setTimeout(r, 50)); return f(); };
                    const idle = await until(() => host.state.get().idle, 15000);
                    const bmp = await createImageBitmap(await host.toBlob()), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                    g.drawImage(bmp, 0, 0);
                    const centre = Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
                    host.destroy(); el.remove();
                    return {idle, centre, errors};
                }, renderer);
                await rare.goto(origin + '/bench');
                const drawn = await run(), drawnAsked = asked.splice(0);
                await rare.context().route(file, route => route.fulfill({status: 404, body: ''}));
                // (A new page: it has not loaded the part.)
                await rare.goto(origin + '/bench');
                const missing = await run();
                check(`[${renderer}] a heatmap loads the part layers once, is idle and draws (#2215)`,
                    drawn.idle && !drawn.errors.length && drawnAsked.length === 1 && drawn.centre[0] > 200 && drawn.centre[2] < 100, JSON.stringify({drawn, drawnAsked}));
                check(`[${renderer}] the part layers does not load: the map reports one error, is idle and draws its other layers (#2215)`,
                    missing.idle && missing.errors.length === 1 && /layers/.test(missing.errors[0]) && missing.centre.slice(0, 3).every(v => v > 250), JSON.stringify(missing));
            } finally { await rare.close(); }
            // A hillshade on 3D terrain whose part `layers` comes after the pictures of the ground tiles were drawn (#2215):
            // the pictures are drawn again with the hillshade. The same for a hillshade that `update()` adds after load, and
            // on the globe. Each picture is compared with the one where the part comes at once.
            for (const mode of ['load', 'update', 'globe']) {
            const shade = await browser.newPage({viewport: {width: 900, height: 600}});
            try {
                const run = (mode) => shade.evaluate(async ({renderer, mode}) => {
                    const lib = await import('/dist/map-jr-gl.js'), errors = [];
                    // (Terrarium heights that rise from west to east in steps: the hillshade has slopes to shade.)
                    const dc = Object.assign(document.createElement('canvas'), {width: 256, height: 256}), cg = dc.getContext('2d');
                    for (let x = 0; x < 256; x++) { cg.fillStyle = `rgb(${128 + (x >> 3)},${(x * 37) & 255},0)`; cg.fillRect(x, 0, 1, 256); }
                    const hill = {id: 'hs', type: 'hillshade', source: 'dem', paint: {'hillshade-shadow-color': '#000', 'hillshade-highlight-color': '#000', 'hillshade-accent-color': '#000', 'hillshade-exaggeration': 1}};
                    const style = (withHill) => ({version: 8, ...mode === 'globe' ? {projection: {type: 'globe'}} : {},
                        sources: {dem: {type: 'raster-dem', tiles: [dc.toDataURL('image/png')], encoding: 'terrarium', tileSize: 256, maxzoom: 10}}, terrain: {source: 'dem'},
                        layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, ...withHill ? [hill] : []]});
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
                    const view = mode === 'globe' ? {center: [7.7, 46], zoom: 3, pitch: 40} : {center: [7.7, 46], zoom: 10, pitch: 60};
                    const host = lib.createMap(el, {style: style(mode !== 'update'), initialView: view, renderer, attribution: false, onError: e => errors.push(e.message)});
                    const until = async (f, ms) => { for (let t = 0; t < ms && !f(); t += 50) await new Promise(r => setTimeout(r, 50)); return f(); };
                    let idle = await until(() => host.state.get().idle, 15000);
                    if (mode === 'update') { host.update({style: style(true), initialView: view}); await until(() => !host.state.get().idle, 1000); idle = await until(() => host.state.get().idle, 15000); }
                    const bmp = await createImageBitmap(await host.toBlob()), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                    g.drawImage(bmp, 0, 0);
                    const px = g.getImageData(0, 0, bmp.width, bmp.height).data;
                    let dark = 0;
                    for (let i = 0; i < px.length; i += 4) if (px[i] < 200) dark++;
                    host.destroy(); el.remove();
                    return {idle, dark, errors};
                }, {renderer, mode});
                await shade.goto(origin + '/bench');
                const soon = await run(mode);
                await shade.context().route(/map-jr-gl-(worker-layers|layers-more-[\w-]+)\.js/, async route => { const res = await route.fetch(); await new Promise(r => setTimeout(r, 1500)); await route.fulfill({response: res}); });
                // (A new page: it has not loaded the part.)
                await shade.goto(origin + '/bench');
                const late = await run(mode);
                check(`[${renderer}] a hillshade on 3D terrain (${mode}) whose part layers comes 1.5 s late draws as when it comes at once (#2215)`,
                    late.idle && soon.idle && !late.errors.length && soon.dark > 500 && Math.abs(late.dark - soon.dark) < soon.dark * 0.05, JSON.stringify({soon, late}));
            } finally { await shade.close(); }
            }
            // 3D terrain whose part comes late (#1849): the tiles of the flat layers are requested while the part loads,
            // and do not wait for it (they did, behind the elevation tiles, by more than 3 s).
            if (renderer === 'worker') {
                const late = await browser.newPage({viewport: {width: 900, height: 600}});
                try {
                    let partAt = 0, rasterAt = 0;
                    await late.context().route(/map-jr-gl-worker-dem\.js/, async route => { const res = await route.fetch(); await new Promise(r => setTimeout(r, 1500)); partAt = Date.now(); await route.fulfill({response: res}); });
                    await late.context().route(/\/late-raster\//, route => { rasterAt ||= Date.now(); return route.fulfill({status: 404}); });
                    late.context().on('request', r => { if (/\/late-raster\//.test(r.url())) rasterAt ||= Date.now(); });
                    await late.goto(origin + '/bench');
                    const errors = await late.evaluate(async () => {
                        const lib = await import('/dist/map-jr-gl.js'), errors = [];
                        const dc = Object.assign(document.createElement('canvas'), {width: 256, height: 256}), cg = dc.getContext('2d');
                        cg.fillStyle = 'rgb(131,232,0)'; cg.fillRect(0, 0, 256, 256);
                        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
                        const host = lib.createMap(el, {style: {version: 8, sources: {dem: {type: 'raster-dem', tiles: [dc.toDataURL('image/png')], encoding: 'terrarium', tileSize: 256, maxzoom: 10},
                            r: {type: 'raster', tiles: [location.origin + '/late-raster/{z}/{x}/{y}.png'], tileSize: 256}}, terrain: {source: 'dem'},
                            layers: [{id: 'r', type: 'raster', source: 'r'}]}, initialView: {center: [7.7, 46], zoom: 10, pitch: 50}, renderer: 'worker', attribution: false, onError: e => errors.push(e.message)});
                        await new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(r, 10000); });
                        host.destroy(); el.remove();
                        return errors.filter(m => !/late-raster|404/.test(m));
                    });
                    check(`[${renderer}] 3D terrain whose part comes 1.5 s late: the tiles of the flat layers are requested before the part arrives (#1849)`,
                        rasterAt > 0 && partAt > 0 && rasterAt < partAt && !errors.length, JSON.stringify({early: partAt - rasterAt, errors}));
                } finally { await late.close(); }
            }
        } else skip(`[${renderer}] a part of the worker that does not load: the map reports one error that names the file (#79)`, `${browserName} does not show the requests of a worker to Playwright`);
    } catch (e) { check(`[${renderer}] the test of the parts of the worker was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A style that is not a style (#539): an error of the map (`onError`) that says what is missing, no error
// of the page, and the map draws the next style. Each style is given as an object and as the answer of a URL.
for (const renderer of ['main', 'worker']) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    const thrown = [];
    page.on('pageerror', e => thrown.push(e.message));
    try {
        await page.goto(origin + '/bench');
        const out = await page.evaluate(async renderer => {
            const lib = await import('/dist/map-jr-gl.js'), wait = ms => new Promise(r => setTimeout(r, ms)), results = {}, unhandled = [];
            window.addEventListener('unhandledrejection', e => unhandled.push(String(e.reason?.message ?? e.reason)));
            const good = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
            const bad = {noLayers: {version: 8, sources: {}}, layersNotAList: {version: 8, sources: {}, layers: {bg: {type: 'background'}}}, notAnObject: 42};
            const url = style => 'data:application/json,' + encodeURIComponent(JSON.stringify(style));
            const run = async (name, style) => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'})), errors = [];
                const spec = {style, renderer, attribution: false, onError: e => errors.push(e.message)};
                let host;
                try { host = lib.createMap(el, spec); } catch (e) { results[name] = {made: String(e.message)}; el.remove(); return; }
                await wait(700);
                const first = errors.join(' | ');
                // The next style is drawn, and a later style that is not a style gives an error again.
                host.update({...spec, style: good});
                const idle = await Promise.race([new Promise(r => host.state.subscribe(s => s.idle, i => i && r(true))), wait(5000).then(() => false)]);
                const before = errors.length;
                host.update(spec);
                await wait(700);
                results[name] = {first, idle, second: errors.slice(before).join(' | ')};
                host.destroy(); el.remove();
            };
            for (const [name, style] of Object.entries(bad)) { await run(name, style); await run(name + 'URL', url(style)); }
            // (A style with no "sources" has no source: its layers without a source are drawn.)
            await run('noSources', {version: 8, layers: good.layers});
            return {results, unhandled};
        }, renderer);
        const said = /^\[map-jr-gl\] E539 https:\/\/map-jr\.org\/e\/539$/;
        for (const [name, r] of Object.entries(out.results)) {
            if (name === 'noSources') check(`[${renderer}] a style with no "sources" is drawn without an error`, r.first === '' && r.idle && r.second === '', JSON.stringify(r));
            else check(`[${renderer}] a style that is not a style (${name}): one error of the map that names "layers", and update() with a good style draws`,
                said.test(r.first) && !r.first.includes(' | ') && r.idle && said.test(r.second) && !r.second.includes(' | '), JSON.stringify(r));
        }
        check(`[${renderer}] a style that is not a style gives no error of the page`, !thrown.length && !out.unhandled.length, JSON.stringify({thrown, unhandled: out.unhandled}));
    } catch (e) { check(`[${renderer}] the test of a style that is not a style was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A map that is removed while it starts again after a lost WebGL context gives the shared tile workers back once, so
// that another map on the page still gets tiles (#708, #97).
{
    const page = await browser.newPage({viewport: {width: 600, height: 400}});
    try {
        await page.goto(origin + '/bench');
        const out = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const idle = async m => { await wait(100); for (let i = 0; i < 300 && !m.state.get().idle; i++) await wait(50); return m.state.get().idle; };
            const box = () => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:600px;height:400px'}));
            const view = {center: [-74.0065, 40.7085], zoom: 14};
            const elB = box(), b = lib.createMap(elB, {style, renderer: 'main', attribution: false, initialView: view});
            const elA = box(), a = lib.createMap(elA, {style, renderer: 'main', attribution: false, initialView: view});
            await idle(b); await idle(a);
            // restart() gives the workers back and then awaits the start of the new engine. The map is removed in a microtask after
            // the event, so that the removal comes before start() takes the workers again.
            let removed = false;
            a._map.on('webglcontextlost', () => queueMicrotask(() => { a.destroy(); elA.remove(); removed = true; }));
            a._map.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
            for (let i = 0; i < 100 && !removed; i++) await wait(50);
            await wait(500);
            // Map b needs new tiles: the place is far from the tiles that it has.
            b.moveTo({center: [-73.95, 40.78], zoom: 13, duration: 0});
            const ok = await idle(b);
            // (Workers that ended give no answer: the check waits 5 s for one.)
            const features = await Promise.race([b.queryFeatures([{x: 0, y: 0}, {x: 600, y: 400}]).then(f => f.length), wait(5000).then(() => 'no answer')]);
            b.destroy(); elB.remove();
            return {removed, idle: ok, features};
        });
        check('a map removed while it starts again after a lost WebGL context leaves the tile workers to the other map, which still loads tiles (#708)',
            out.removed && out.idle && typeof out.features === 'number' && out.features > 0, JSON.stringify(out));
    } catch (e) { check('the test of a map removed during its restart was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A warning about an unsupported expression comes once on the page, not once for each thread that compiles the layer (#1141).
for (const renderer of renderers) {
    const page = await browser.newPage({viewport: {width: 600, height: 400}});
    const said = [];
    page.on('console', m => { if (m.type() === 'warning' && m.text().includes('x1141')) said.push(m.text()); });
    try {
        await page.goto(origin + '/bench');
        await page.evaluate(async renderer => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const line = style.layers.find(l => l.type === 'line' && l['source-layer']);
            style.layers.push({...line, id: 'w1141', filter: ['x1141f'], paint: {'line-width': ['x1141p']}});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0'}));
            const map = lib.createMap(el, {style, renderer, attribution: false});
            for (const end = Date.now() + 20000; !map.state.get().idle && Date.now() < end;) await new Promise(r => setTimeout(r, 50));
            await new Promise(r => setTimeout(r, 1000));
            map.destroy(); el.remove();
        }, renderer);
        const counts = {};
        for (const t of said) counts[t] = (counts[t] ?? 0) + 1;
        check(`[${renderer}] a warning about an unsupported expression or filter comes once on the page`, said.length > 0 && Object.values(counts).every(n => n === 1), JSON.stringify(counts));
    } catch (e) { check(`[${renderer}] the test of warnings once on the page was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The tile workers serve every map of the page. A warning of a live map still comes after another map was removed (#1141).
for (const renderer of renderers) {
    const page = await browser.newPage({viewport: {width: 600, height: 400}});
    const said = [];
    page.on('console', m => { if (m.type() === 'warning' && m.text().includes('y1141')) said.push(m.text()); });
    try {
        await page.goto(origin + '/bench');
        await page.evaluate(async renderer => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const idle = async map => { for (const end = Date.now() + 20000; !map.state.get().idle && Date.now() < end;) await new Promise(r => setTimeout(r, 50)); };
            const box = () => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0'}));
            const elB = box(), b = lib.createMap(elB, {style, renderer, attribution: false});
            await idle(b);
            const elA = box(), a = lib.createMap(elA, {style, renderer, attribution: false});
            await idle(a);
            a.destroy(); elA.remove();
            await new Promise(r => setTimeout(r, 300));
            const line = style.layers.find(l => l.type === 'line' && l['source-layer']);
            b.update({style: {...style, layers: [...style.layers, {id: 'w1141b', type: 'symbol', source: line.source, 'source-layer': line['source-layer'], layout: {'text-field': ['number-format', 1, {locale: 'y1141-!!'}]}}]}, renderer, attribution: false});
            await new Promise(r => setTimeout(r, 300));
            await idle(b);
            await new Promise(r => setTimeout(r, 1000));
            b.destroy(); elB.remove();
        }, renderer);
        check(`[${renderer}] a warning of a map comes after another map on the page was removed`, said.length === 1, JSON.stringify(said));
    } catch (e) { check(`[${renderer}] the test of warnings after a removed map was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A map that is destroyed while it loads (React StrictMode does this on each mount), and two maps in one element.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
    try {
        // The file of the main-thread engine is held back until the map is destroyed: the map is removed during that `await`.
        let held = 0;
        await page.route(/map-jr-gl-engine-entry/, async route => { held++; await page.evaluate(() => window.early.destroy()); await route.continue(); });
        await page.goto(origin + '/bench');
        const late = await page.evaluate(async () => {
            const lib = window.lib = await import('/dist/map-jr-gl.js'), style = window.style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            window.early = lib.createMap(el, {style, renderer: 'main'});
            await new Promise(r => setTimeout(r, 3000));
            const left = el.childElementCount;
            el.remove();
            return left;
        });
        await page.unroute(/map-jr-gl-engine-entry/);
        check('a map destroyed while the engine file loads adds nothing to its element afterwards', held === 1 && late === 0, JSON.stringify({held, late}));

        // Destroyed at once, with a style object and with a style URL: no worker stays.
        await page.evaluate(() => {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            for (const style of [window.style, '/style.json', window.style]) window.lib.createMap(el, {style, attribution: false}).destroy();
            el.remove();
        });
        for (let i = 0; i < 100 && page.workers().length; i++) await page.waitForTimeout(100);
        await page.waitForTimeout(1500); // (a worker that starts late would show now)
        check('maps destroyed at once leave no worker', page.workers().length === 0, `${page.workers().length} workers`);

        // A second map in an element that has a map: a warning says so. After the first map is destroyed, there is none.
        const twice = await page.evaluate(async () => {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const a = window.lib.createMap(el, {style: window.style, attribution: false});
            a.destroy();
            const b = window.lib.createMap(el, {style: window.style, attribution: false});
            console.warn('mark');
            const c = window.lib.createMap(el, {style: window.style, attribution: false});
            await new Promise(r => setTimeout(r, 300));
            b.destroy(); c.destroy();
            const left = el.childElementCount;
            el.remove();
            return left;
        });
        const said = warnings.filter(w => w === '[map-jr-gl] E97 https://map-jr.org/e/97').length, mark = warnings.indexOf('mark');
        check('a second map in one element gets a warning, and a map after destroy() does not', said === 1 && mark >= 0 && warnings.findIndex(w => w === '[map-jr-gl] E97 https://map-jr.org/e/97') > mark && twice === 0, JSON.stringify({warnings, twice}));
    } catch (e) { check('removed while loading: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// `transformRequest` of the description (#386): it changes the requests of the style, its sources and its tiles,
// also those that a tile worker makes, and the map calls the function of the last description.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const keyed = [];
        page.on('request', r => { const k = r.headers()['x-key']; if (k) keyed.push(k); });
        await page.goto(`${origin}/style.json`);
        const out = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const kinds = new Set(), second = new Set();
            const spec = {style: '/style.json', initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, attribution: false,
                transformRequest: (url, kind) => { kinds.add(kind); return {url, headers: {'x-key': 'one'}}; }};
            const host = lib.createMap(el, spec);
            const loaded = await Promise.race([new Promise(r => host.state.subscribe(s => s.loaded, v => v && r(true))), new Promise(r => setTimeout(() => r(false), 20000))]);
            // (A new function in each update, as a framework makes in each render.)
            const two = () => (url, kind) => { second.add(kind); return {url, headers: {'x-key': 'two'}}; };
            host.update({...spec, transformRequest: two()});
            host.update({...spec, transformRequest: two(), view: {center: [-73.99, 40.73], zoom: 14}});
            await Promise.race([new Promise(r => host.state.subscribe(s => s.idle, v => v && r(true))), new Promise(r => setTimeout(r, 20000))]);
            const renderer = host.state.get().renderer;
            host.destroy(); el.remove();
            return {loaded, kinds: [...kinds], second: [...second], renderer};
        });
        check('transformRequest of the description changes the requests of the style and of the tiles (made in a worker), and a new function in update() is used',
            out.loaded && out.kinds.includes('Style') && out.kinds.includes('Tile') && out.second.includes('Tile') && keyed.includes('one') && keyed.includes('two'), JSON.stringify({...out, keyed: [...new Set(keyed)]}));
    } catch (e) { check('transformRequest of the description: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The glyph files of the style: asked for by default, with the font stack and the range in the URL; not for a style without `glyphs`.
// The removed field `glyphs` of the description (#52) has no effect and gives a warning in the development build.
// (The test server has no glyph files: the text then uses the fonts of the device, and the map still becomes idle.)
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const asked = [];
        let answer = {status: 404, body: ''};
        await page.route(/\/test-glyphs\//, route => { asked.push(decodeURIComponent(new URL(route.request().url()).pathname)); route.fulfill(answer); });
        await page.goto(`${origin}/style.json`);
        const warned = [];
        page.on('console', m => { if (m.type() === 'warning' && m.text().includes('"glyphs"')) warned.push(m.text()); });
        const run = how => page.evaluate(async how => {
            const lib = await import(how === 'removed' ? '/dist/map-jr-gl.dev.js' : '/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            if (how !== 'none') style.glyphs = '/test-glyphs/{fontstack}/{range}.pbf'; else delete style.glyphs;
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const host = lib.createMap(el, {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, attribution: false, ...(how === 'removed' ? {glyphs: false} : how === 'fonts' ? {fonts: {'Test Sans Regular': '/nofont.woff2'}} : {})});
            const loaded = await Promise.race([new Promise(r => host.state.subscribe(s => s.loaded, v => v && r(true))), new Promise(r => setTimeout(() => r(false), 20000))]);
            await new Promise(r => setTimeout(r, 300));
            host.destroy(); el.remove();
            return loaded;
        }, how);
        const withFiles = await run(), count = asked.length, without = await run('none'), none = asked.length === count;
        const before = asked.length, fonts = await run('fonts'), withFonts = asked.length > before;
        const mid = asked.length, removed = await run('removed'), stillAsked = asked.length > mid, warning = warned.length === 1 && warned[0].startsWith('[map-jr-gl] E20 The description has "glyphs".');
        // A server that answers each URL with a page (200, HTML), and one that sends bytes that are not a glyph file:
        // the map must still load, with the fonts of the device.
        answer = {status: 200, contentType: 'text/html', body: '<!doctype html><html><body>not found</body></html>'};
        const page200 = await run();
        answer = {status: 200, contentType: 'application/x-protobuf', body: Buffer.from([10, 255, 255, 255, 127, 26, 200, 1, 8, 65, 24, 136, 39, 32, 136, 39])};
        const broken = await run();
        check('glyph files of the style: asked for by default, also with fonts, not for a style without glyphs; the removed field glyphs warns and has no effect; a map still loads without them or with bad ones',
            withFiles && without && none && fonts && withFonts && removed && stillAsked && warning && page200 && broken && count > 0 && asked.every(u => /^\/test-glyphs\/[^/]+\/\d+-\d+\.pbf$/.test(u)), JSON.stringify({withFiles, without, none, fonts, withFonts, removed, stillAsked, warned, page200, broken, count, first: asked[0]}));
    } catch (e) { check('glyph files: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// Labels without glyph files are drawn with a canvas, and the engine reads no pixels back to make them (#1841): in
// Firefox, getImageData (and readPixels, convertToBlob) in a worker waits until the page thread is free, and the map
// stops while the page is busy. The check counts these calls in the page and in every worker, for each renderer.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.addInitScript(() => {
            const patch = `(() => { const bc = new BroadcastChannel('readbacks');
                for (const [P, names] of [[self.OffscreenCanvasRenderingContext2D, ['getImageData', 'fillText']], [self.CanvasRenderingContext2D, ['getImageData', 'fillText']], [self.WebGL2RenderingContext, ['readPixels']], [self.OffscreenCanvas, ['convertToBlob']]]) {
                    if (P) for (const k of names) { const f = P.prototype[k]; P.prototype[k] = function (...a) { bc.postMessage(k); return f.apply(this, a); }; }
                } })();`;
            (0, eval)(patch);
            const Real = window.Worker;
            window.Worker = function (url, opts) {
                const src = opts?.type === 'module' ? `${patch}\nawait import(${JSON.stringify(String(new URL(url, location.href)))});` : `${patch}\nimportScripts(${JSON.stringify(String(new URL(url, location.href)))});`;
                return new Real(URL.createObjectURL(new Blob([src], {type: 'text/javascript'})), opts);
            };
            window.readbacks = {};
            new BroadcastChannel('readbacks').onmessage = e => { window.readbacks[e.data] = (window.readbacks[e.data] ?? 0) + 1; };
        });
        await page.goto(`${origin}/style.json`);
        const out = {};
        for (const renderer of ['worker', 'main']) {
            out[renderer] = await page.evaluate(async renderer => {
                const lib = await import('/dist/map-jr-gl.js'), words = ['Harbor', 'Market', 'Station', 'Library', 'Garden', 'Bridge', 'Tower', 'Museum', 'Ferry', 'Plaza', 'Theater', 'Hospital'];
                const features = words.flatMap((w, i) => [0, 1].map(j => ({type: 'Feature', properties: {name: `${w} ${renderer} ${j}`}, geometry: {type: 'Point', coordinates: [-74.02 + (i % 4) * 0.012, 40.70 + Math.floor(i / 4) * 0.008 + j * 0.004]}})));
                const style = {version: 8, sources: {p: {type: 'geojson', data: {type: 'FeatureCollection', features}}},
                    layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'names', type: 'symbol', source: 'p', layout: {'text-field': ['get', 'name'], 'text-size': 14, 'text-allow-overlap': true}}]};
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99'}));
                window.readbacks = {};
                const host = lib.createMap(el, {style, renderer, initialView: {center: [-74.0, 40.71], zoom: 12.5}, attribution: false});
                const idle = await Promise.race([new Promise(r => host.state.subscribe(s => s.idle, v => v && r(true))), new Promise(r => setTimeout(() => r(false), 20000))]);
                const used = host.state.get().renderer;
                await new Promise(r => setTimeout(r, 300));
                host.destroy(); el.remove();
                return {idle, used, ...window.readbacks};
            }, renderer);
        }
        const ok = r => r.idle && r.fillText > 0 && !r.getImageData && !r.readPixels && !r.convertToBlob;
        check('labels drawn with the canvas: the engine reads no pixels back (no getImageData, readPixels or convertToBlob), with the worker and the main renderer (#1841)',
            ok(out.worker) && ok(out.main) && out.main.used === 'main', JSON.stringify(out));
    } catch (e) { check('labels drawn with the canvas, no readback: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// Web fonts of the description (#494): `fonts` in the shape of `font-faces` follows update(). A font that is added draws
// the labels again with it, and a font file that does not load is an error that names the font.
{
    const page = await browser.newPage({viewport: {width: 600, height: 400}});
    try {
        const {squareFont} = await import('./fixtures/square-font.mjs');
        const asked = [];
        await page.route(/\/test-fonts\//, route => { asked.push(new URL(route.request().url()).pathname); route.request().url().includes('square') ? route.fulfill({status: 200, contentType: 'font/ttf', body: squareFont()}) : route.fulfill({status: 404, body: ''}); });
        await page.goto(`${origin}/style.json`);
        await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
            const point = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]};
            window.errors = [];
            window.spec = {style, attribution: false, initialView: {center: [0, 0], zoom: 2}, onError: e => window.errors.push(e.message),
                sources: {p: {type: 'geojson', data: point}},
                layers: [{id: 'label', type: 'symbol', source: 'p', layout: {'text-field': 'HELLO', 'text-font': ['Test Square Regular'], 'text-size': 40}, paint: {'text-color': '#000'}}]};
            window.host = lib.createMap(el, window.spec);
            window.settle = () => new Promise(r => { const t = setTimeout(r, 15000); const un = window.host.state.subscribe(s => s.idle, v => { if (v) { clearTimeout(t); setTimeout(r, 300); un?.(); } }); if (window.host.state.get().idle) setTimeout(r, 300); });
            await window.settle();
        });
        const dark = async () => { const png = await page.screenshot(); return page.evaluate(async b64 => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = Object.assign(document.createElement('canvas'), {width: img.width, height: img.height}).getContext('2d'); c.drawImage(img, 0, 0);
            const d = c.getImageData(0, 0, img.width, img.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 100) n++; return n;
        }, png.toString('base64')); };
        const before = await dark();
        await page.evaluate(async () => { window.host.update({...window.spec, fonts: {'Test Square Regular': '/test-fonts/square.ttf', 'Test Gone Regular': '/test-fonts/missing.ttf'}}); await new Promise(r => setTimeout(r, 200)); await window.settle(); });
        const after = await dark(), errors = await page.evaluate(() => window.errors);
        await page.evaluate(() => window.host.destroy());
        const failed = errors.some(m => /^\[map-jr-gl\] E10494 https:\/\/map-jr\.org\/e\/10494 font="Test Gone Regular" E1163 https:\/\/map-jr\.org\/e\/1163 what="font" url="http:\/\/[^ "]+\/test-fonts\/missing\.ttf" reason="HTTP 404"$/.test(m));
        // (The squares of the font fill much more of the label than the letters of a font of the device.)
        check('fonts of the description: a font added in update() is fetched and the labels are drawn again with it; a font that does not load is an error with its name and the HTTP status (#1193)',
            asked.includes('/test-fonts/square.ttf') && after > before * 1.5 && failed, JSON.stringify({asked, before, after, errors}));
    } catch (e) { check('fonts of the description: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The action and the store for Svelte, called as Svelte calls them (they do not need the Svelte package).
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/style.json`);
        const svelte = await page.evaluate(async () => {
            const {mapJr, mapState} = await import('/dist/svelte.js'), style = await (await fetch('/style.json')).json(), wait = ms => new Promise(r => setTimeout(r, ms));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            let map; const seen = [];
            const description = {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, attribution: false};
            const action = mapJr(el, {description, ready: m => { map = m; }});
            const stop = mapState(map).subscribe(s => seen.push(s.loaded));
            await new Promise(r => map.state.subscribe(s => s.loaded, v => v && r()));
            action.update({description: {...description, view: {center: [-74.0, 40.71], zoom: 13}}});
            await wait(500);
            const zoom = map.state.get().view.zoom;
            stop(); action.destroy();
            return {first: seen[0], later: seen.includes(true), zoom, canvas: !!el.querySelector('canvas')};
        });
        check('svelte: the action makes, changes and removes a map, and the store gives the state at once', svelte.first === false && svelte.later && svelte.zoom === 13 && !svelte.canvas, JSON.stringify(svelte));
    } catch (e) { check('svelte: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}

// The map with no checks: the development build when the file with the checks and the texts of the warnings does not
// load, and the production build, which must not ask for that file. The map works, a wrong place of a query is still
// refused with a short message, and no promise is left rejected.
for (const [build, file] of [['the development build, and the file of the checks does not load', 'map-jr-gl.dev.js'], ['the production build', 'map-jr-gl.js']]) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}}), asked = [];
    page.on('request', r => { if (/map-jr-gl-mistakes-/.test(r.url())) asked.push(r.url()); });
    await page.route(/map-jr-gl-mistakes-/, route => route.abort());
    try {
        await page.goto(`${origin}/bench`);
        const lost = await page.evaluate(async file => {
            const lib = await import('/dist/' + file), style = await (await fetch('/style.json')).json(), said = [], unhandled = [], log = console.warn;
            console.warn = (...a) => said.push(a.join(' '));
            addEventListener('unhandledrejection', e => unhandled.push(String(e.reason)));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const host = lib.createMap(el, {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, attribution: false, interactiveLayers: ['nope']});
            const place = await host.queryFeatures({lng: -74.0065, lat: 40.7085}).then(() => '', e => e.message);
            // (Two more messages: one that the source builds with the name of the method, and one with the name of the
            // method before its code. The production build prints the code, the link and the values, #2148.)
            let noStyle = '';
            try { lib.createMap(document.createElement('div'), {}); } catch (e) { noStyle = e.message; }
            const notCluster = await host.clusterLeaves('nope', 1).then(() => '', e => e.message);
            // (An unknown option of an overlay warns only with the checks, #1647.)
            const ov = host.overlay(document.createElement('div'), {lngLat: [-74.0065, 40.7085], lnglat: [3, 3]});
            ov.update({lngLat: [-74.0065, 40.7085], colour: 'red'}); ov.patch({Anchor: 'top'}); ov.remove();
            await new Promise(r => host.state.subscribe(s => s.idle, v => v && r()));
            await new Promise(r => setTimeout(r, 1200));
            const drawn = (await host.queryFeatures(undefined, {radius: 5})).length;
            host.destroy(); el.remove(); console.warn = log;
            return {said, unhandled, place, drawn, noStyle, notCluster};
        }, file);
        lost.asked = asked.length;
        const production = file === 'map-jr-gl.js';
        check(`${build}: the map draws with no warning, a wrong place of a query is refused with a short message, no rejection is unhandled, and ${production ? 'the file of the checks is not requested' : 'the file of the checks was requested'}`,
            (production ? asked.length === 0 : asked.length > 0) && lost.said.length === 0 && lost.drawn > 0 && !lost.unhandled.length
            && lost.place === (production ? '[map-jr-gl] E9 https://map-jr.org/e/9' : '[map-jr-gl] E9 queryFeatures(): the place is not {x, y} or [lng, lat].'), JSON.stringify(lost));
        check(`${build}: a message prints ${production ? 'its code, the link to the page of the code and its values, and not its text (#2148)' : 'its code and its full text (#2148)'}`,
            production ? lost.noStyle === '[map-jr-gl] E57 https://map-jr.org/e/57 method="createMap"' && lost.notCluster === '[map-jr-gl] clusterLeaves(): E217 https://map-jr.org/e/217 id="nope"'
                : lost.noStyle === '[map-jr-gl] E57 createMap(): the description has no "style". Pass the URL of a style or a style object as "style".'
                && lost.notCluster === '[map-jr-gl] clusterLeaves(): E217 "nope" is not a GeoJSON source of the style.', JSON.stringify(lost));
    } catch (e) { check(`${build}: the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}

// `supported()` releases its probe context once it has the answer (#825), keeps the answer, and a map starts after it.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/style.json`);
        const out = await page.evaluate(async () => {
            const made = [], get = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { const c = get.call(this, kind, ...rest); if (c && /webgl/.test(kind)) made.push(c); return c; };
            const lib = await import('/dist/map-jr-gl.js');
            const first = lib.supported(), second = lib.supported(), probes = made.length, lost = made.map(c => c.isContextLost());
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:400px;height:300px'}));
            const host = lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]}, renderer: 'main', attribution: false});
            const idle = await Promise.race([new Promise(r => { if (host.state.get().idle) r(true); else host.state.subscribe(s => s.idle, v => v && r(true)); }), new Promise(r => setTimeout(() => r(false), 8000))]);
            host.destroy();
            return {first, second, probes, lost, idle};
        });
        check('supported() returns true twice with one probe context, releases that context, and a map reaches idle after it (#825)',
            out.first && out.second && out.probes === 1 && out.lost[0] === true && out.idle, JSON.stringify(out));
    } catch (e) { check('supported() releases its probe context: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}

// A browser without WebGL2, on the page and in the worker: `supported()` says so before a map is made. A map that is
// made all the same reports one error (`onError`) and puts a message into the container.
for (const [entry, renderer] of [['main API', 'worker'], ['main API', 'main'], ['maplibre-compat', 'worker']]) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/bench`);
        const able = await page.evaluate(async () => (await import('/dist/map-jr-gl.js')).supported());
        await page.goto(`${origin}/style.json`); // (a new document: the answer of `supported()` is kept for the page)
        const none = await page.evaluate(async ([entry, renderer]) => {
            const get = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); };
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'})), createWorker = () => new Worker(url);
            const errors = [], unhandled = [], warn = console.warn, wait = ms => new Promise(r => setTimeout(r, ms));
            console.warn = () => {}; // (the map says that it uses the main thread)
            addEventListener('unhandledrejection', e => unhandled.push(String(e.reason)));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99'}));
            const style = await (await fetch('/style.json')).json(), message = () => el.querySelector('.map-jr-unavailable');
            let supported, state, destroy;
            if (entry === 'main API') {
                const lib = await import('/dist/map-jr-gl.js');
                lib.configure({createWorker});
                supported = lib.supported();
                const host = lib.createMap(el, {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false, onError: e => errors.push(e.message)});
                state = () => ({error: errors[0], loaded: host.state.get().loaded});
                destroy = () => host.destroy();
            } else {
                const lib = await import('/dist/map-jr-gl-maplibre-compat.js');
                supported = lib.supported() || lib.default.supported();
                const map = new lib.Map({container: el, style, center: [-74.0065, 40.7085], zoom: 14.3, attributionControl: false, createWorker});
                // (#205: the error is a GPUInitializationError, which the module exports, as in MapLibre GL JS.)
                map.on('error', e => errors.push(e.error.message, ...(e.error instanceof lib.GPUInitializationError && e.error.name === 'GPUInitializationError' && new lib.GPUInitializationError({}, null) instanceof Error ? [] : ['not a GPUInitializationError'])));
                state = () => ({error: errors[0], loaded: map.loaded()});
                destroy = () => map.remove();
            }
            for (let i = 0; i < 150 && !errors.length; i++) await wait(100);
            await wait(500);
            const box = message()?.getBoundingClientRect();
            const out = {supported, errors, ...state(), text: message()?.textContent, count: el.querySelectorAll('.map-jr-unavailable').length, children: message()?.childElementCount, covers: !!box && box.width === el.clientWidth && box.height === el.clientHeight && box.width > 800, unhandled};
            // (The message is the application's to change: a rule of its own style sheet wins over the rule of the library.)
            document.head.appendChild(Object.assign(document.createElement('style'), {textContent: '.map-jr-unavailable{display:none}'}));
            out.hidden = !!message() && getComputedStyle(message()).display === 'none';
            destroy();
            out.after = el.querySelectorAll('.map-jr-unavailable, canvas').length;
            console.warn = warn;
            return out;
        }, [entry, renderer]);
        const text = '[map-jr-gl] E20017 https://map-jr.org/e/20017 message="WebGL2 is not available"';
        check(`no WebGL2 (${entry}, ${renderer}): supported() is false, the map reports one error and shows a message in the container, and removing the map removes the message`,
            able === true && none.supported === false && none.errors.length === 1 && none.errors[0] === text && none.error === text && none.loaded === false && none.text === 'This browser cannot show the map.' && none.count === 1
            && none.children === 0 && none.covers && none.hidden && none.after === 0 && !none.unhandled.length, JSON.stringify({able, ...none}));
    } catch (e) { check(`no WebGL2 (${entry}, ${renderer}): the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}

// The page file and the worker file of two versions (a CDN or a cache can serve them so): two maps give one warning,
// which names both versions, and the maps load. With the files of one version there is no warning.
for (const other of [true, false]) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const version = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
        let changed = 0;
        if (other) await page.route(/\/dist\/map-jr-gl-worker\.js$/, async route => {
            const body = await (await route.fetch()).text(), next = body.replace(new RegExp('(type:.hello.,version:.)' + version.replaceAll('.', '\\.')), '$10.0.1');
            if (next !== body) changed++;
            await route.fulfill({contentType: 'text/javascript', body: next});
        });
        await page.goto(`${origin}/bench`);
        const two = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json(), said = [], warn = console.warn;
            console.warn = (...a) => said.push(a.join(' '));
            const hosts = [0, 1].map(i => lib.createMap(document.body.appendChild(Object.assign(document.createElement('div'), {style: `position:fixed;left:${i * 450}px;top:0;width:450px;height:600px;z-index:99;background:#fff`})),
                {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, attribution: false}));
            const loaded = await Promise.all(hosts.map(h => Promise.race([new Promise(r => h.state.subscribe(s => s.loaded, v => v && r(true))), new Promise(r => setTimeout(() => r(false), 30000))])));
            console.warn = warn;
            return {said, loaded};
        });
        const text = `[map-jr-gl] E10017 https://map-jr.org/e/10017 workerVersion="0.0.1" pageVersion="${version}"`;
        check(other ? 'a worker file of another version: two maps give one warning with both versions, and they load' : 'the worker file of the same version: no warning',
            two.loaded.join() === 'true,true' && (other ? changed > 0 && two.said.length === 1 && two.said[0] === text : two.said.length === 0), JSON.stringify({...two, changed}));
    } catch (e) { check(`the version of the worker file (${other ? 'another' : 'the same'}): the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}

// The one-file build of the main API: a map and a control from that file alone.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}}), requested = [];
    page.on('request', r => { if (/\/dist\//.test(r.url())) requested.push(r.url().split('/').pop()); });
    try {
        await page.goto(`${origin}/style.json`); // (a document of the demo server that loads no script)
        const one = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl-standalone.js'), style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'host', style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const host = lib.createMap(el, {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, controls: [lib.navigation()], attribution: false});
            await new Promise(r => host.state.subscribe(s => s.loaded, v => v && r()));
            return {renderer: host.state.get().renderer, control: !!el.querySelector('.map-jr-ctrl-group')};
        });
        const files = [...new Set(requested.filter(f => f.startsWith('map-jr-gl')))];
        check('standalone: the main API and a control from one file', !!one.renderer && one.control && files.join() === 'map-jr-gl-standalone.js', JSON.stringify({...one, files}));
    } catch (e) { check('standalone: the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}

// #541: a tap on a button of a control on a phone (Chromium with touch, as on Android) leaves the button as it was:
// no tap highlight, no hover background that stays after the tap, and no focus outline (the outline is for the keyboard).
{
    const context = await browser.newContext({viewport: {width: 412, height: 600}, deviceScaleFactor: 2, isMobile: true, hasTouch: true});
    const page = await context.newPage();
    try {
        await page.goto(`${origin}/style.json`);
        await page.evaluate(async () => {
            // #780: without this tag a mobile WebKit lays the page out 980 pixels wide and scales it, and page.tap misses the button.
            document.head.appendChild(Object.assign(document.createElement('meta'), {name: 'viewport', content: 'width=device-width'}));
            const lib = await import('/dist/map-jr-gl.js'), {navigation} = await import('/dist/controls.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:400px'}));
            window.tapHost = lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, initialView: {center: [0, 0], zoom: 2}, controls: [navigation()], attribution: false});
            for (let i = 0; i < 50 && !el.querySelector('.map-jr-ctrl-zoom-in'); i++) await new Promise(r => setTimeout(r, 100));
        });
        const look = () => page.evaluate(() => { const e = document.querySelector('.map-jr-ctrl-zoom-in'); if (!e) return 'no button'; const s = getComputedStyle(e); return `${s.backgroundColor} ${s.outlineStyle} ${s.webkitTapHighlightColor ?? 'rgba(0, 0, 0, 0)'}`; }); // #781: Firefox has no tap highlight and no such property
        const before = await look();
        await page.tap('.map-jr-ctrl-zoom-in'); await page.waitForTimeout(400);
        const after = await look();
        check('a tap on a button of a control on a phone leaves no highlight, hover background or focus outline', before === after && after === 'rgba(0, 0, 0, 0) none rgba(0, 0, 0, 0)', JSON.stringify({before, after}));
    } catch (e) { check('the test of a tap on a phone was completed', false, String(e.message).split('\n')[0]); }
    await context.close();
}

// #42: the compass of navigation() rotates the map when it is dragged and resets the bearing when it is clicked. Only
// with visualizePitch: true does it also show, change and reset the pitch, as in MapLibre GL JS.
for (const visualizePitch of [undefined, true]) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}}), name = `navigation(${visualizePitch ? '{visualizePitch: true}' : ''})`;
    if (process.env.CPU_THROTTLE && cdpTouch) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', {rate: Number(process.env.CPU_THROTTLE)});
    try {
        await page.goto(`${origin}/style.json`);
        await page.evaluate(async visualizePitch => {
            const lib = await import('/dist/map-jr-gl.js'), {navigation} = await import('/dist/controls.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:500px;height:300px;z-index:99'}));
            const host = window.compassHost = lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, initialView: {center: [0, 0], zoom: 2, pitch: 20}, controls: [navigation(visualizePitch ? {visualizePitch} : {})], attribution: false});
            await new Promise(r => host.state.subscribe(s => s.loaded, v => v && r()));
            for (let i = 0; i < 50 && !el.querySelector('.maplibregl-ctrl-compass'); i++) await new Promise(r => setTimeout(r, 100));
        }, visualizePitch);
        const box = await page.evaluate(() => { const r = document.querySelector('.maplibregl-ctrl-compass').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; });
        await page.mouse.move(box.x, box.y); await page.mouse.down();
        for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + i * 8, box.y - i * 4);
        await page.mouse.up(); await page.waitForTimeout(300);
        const view = () => page.evaluate(() => { const v = window.compassHost.state.get().view; return {bearing: v.bearing, pitch: v.pitch, needle: document.querySelector('.maplibregl-ctrl-compass svg g').style.transform}; });
        const dragged = await view();
        await page.mouse.click(box.x, box.y); await page.waitForTimeout(1200);
        const clicked = await view();
        const ok = Math.abs(dragged.bearing) > 1 && Math.abs(clicked.bearing) < 0.01 && (visualizePitch
            ? dragged.pitch > 21 && clicked.pitch < 0.01
            : Math.abs(dragged.pitch - 20) < 0.01 && dragged.needle.startsWith('rotateX(0deg)') && Math.abs(clicked.pitch - 20) < 0.01);
        check(`${name}: dragging the compass rotates the map${visualizePitch ? ' and pitches it, and a click resets both' : ' without pitching it, and a click resets only the bearing'}`, ok, JSON.stringify({dragged, clicked}));
        // #548: a drag sideways across the compass, with the mouse and with a finger, turns the map steadily: 0.4 degrees
        // for each pixel, as a drag with the right button does, in one direction, with no jump where the pointer passes the
        // centre of the button.
        if (!visualizePitch && !cdpTouch) for (const what of ['turns the map by 0.4 degrees for each pixel, without a jump', 'keeps one bearing']) skip(`${name}: a drag of the compass with the touch ${what}`, noCDP);
        if (!visualizePitch) for (const kind of cdpTouch ? ['mouse', 'touch'] : ['mouse']) {
            await page.evaluate(() => window.compassHost.moveTo({bearing: 0, duration: 0}));
            await page.waitForTimeout(100);
            const bearing = () => page.evaluate(() => window.compassHost._map.getBearing()); // (the state follows a frame later)
            const steps = [], cdp = kind === 'touch' && await page.context().newCDPSession(page);
            const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
            if (cdp) await touch('touchStart', box.x - 12, box.y + 2); else { await page.mouse.move(box.x - 12, box.y + 2); await page.mouse.down(); }
            // (Each read waits for the pointermove of its move, and the next move waits for that read. A fixed wait of 20 ms
            // could read before a move that the busy page had queued, and that move then merged with the next one: #632.)
            await page.evaluate(() => { if (window.moves === undefined) { window.moves = 0; document.addEventListener('pointermove', () => window.moves++, true); } });
            for (let dx = -8; dx <= 36; dx += 4) {
                const n = await page.evaluate(() => window.moves);
                if (cdp) await touch('touchMove', box.x + dx, box.y + 2); else await page.mouse.move(box.x + dx, box.y + 2);
                await page.waitForFunction(n => window.moves > n, n, {polling: 'raf', timeout: 5000});
                steps.push(await bearing());
            }
            if (cdp) await touch('touchEnd'); else await page.mouse.up();
            await page.waitForTimeout(300);
            const turns = steps.slice(1).map((b, i) => b - steps[i]), end = await bearing();
            check(`${name}: a drag sideways across the compass with the ${kind} turns the map by 0.4 degrees for each pixel, without a jump`,
                turns.every(t => t < 0 && t > -2) && Math.abs(end + 48 * .4) < 2, JSON.stringify({steps: steps.map(b => Math.round(b)), end}));
            // A pointer that is held still during the drag, and moves by one pixel back and forth as a hand does, leaves one
            // bearing in every frame: the map does not shake between two angles.
            if (cdp) await touch('touchStart', box.x, box.y); else { await page.mouse.move(box.x, box.y); await page.mouse.down(); }
            for (let dx = 4; dx <= 20; dx += 4) { if (cdp) await touch('touchMove', box.x + dx, box.y); else await page.mouse.move(box.x + dx, box.y); }
            await page.waitForTimeout(100);
            await page.evaluate(() => { const f = window.heldFrames = [], tick = () => { f.push(window.compassHost._map.getBearing()); if (f.length < 40) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
            for (let i = 0; i < 8; i++) { const x = box.x + 20 + (i % 2); if (cdp) await touch('touchMove', x, box.y); else await page.mouse.move(x, box.y); await page.waitForTimeout(40); }
            const held = await page.evaluate(async () => { while (window.heldFrames.length < 40) await new Promise(r => requestAnimationFrame(r)); return [...new Set(window.heldFrames.map(b => Math.round(b * 10) / 10))]; });
            if (cdp) await touch('touchEnd'); else await page.mouse.up();
            await page.waitForTimeout(200);
            check(`${name}: a pointer held still on a drag of the compass with the ${kind} keeps one bearing`, held.length === 1, JSON.stringify({held}));
        }
    } catch (e) { check(`${name}: the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}

// #548: a fast drag that starts on the compass and crosses the map ends at the same bearing as a slow one, with the
// mouse and with a finger and with either renderer: the drag adds up its own bearing. (It read getBearing() back at each
// move, and with the worker renderer that is the camera that the engine last reported, so a fast drag lost turns.)
for (const renderer of renderers) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/style.json`);
        await page.evaluate(async renderer => {
            // The camera that the engine draws: the worker reports it after each frame that it draws.
            const drawn = window.drawn = [], W = window.Worker;
            window.Worker = class extends W { constructor(...a) { super(...a); this.addEventListener('message', e => { if (e.data?.type === 'camera') drawn.push(e.data.bearing); }); } };
            const lib = await import('/dist/map-jr-gl.js'), {navigation} = await import('/dist/controls.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:900px;height:600px;z-index:99'}));
            const host = window.fastHost = lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, renderer, controls: [navigation()], attribution: false});
            await new Promise(r => host.state.subscribe(s => s.loaded, v => v && r()));
            for (let i = 0; i < 50 && !el.querySelector('.maplibregl-ctrl-compass'); i++) await new Promise(r => setTimeout(r, 100));
        }, renderer);
        const box = await page.evaluate(() => { const r = document.querySelector('.maplibregl-ctrl-compass').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; });
        const cdp = cdpTouch && await page.context().newCDPSession(page), ends = {}, steps = {}, letters = {};
        if (!cdpTouch) skip(`[${renderer}] a fast drag from the compass with the touch`, noCDP);
        const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
        for (const kind of cdpTouch ? ['mouse', 'touch'] : ['mouse']) for (const moves of [100, 25, 5]) {
            await page.evaluate(() => window.fastHost.moveTo({bearing: 0, duration: 0}));
            await page.waitForTimeout(200);
            await page.evaluate(() => {
                const f = window.seen = [], m = window.fastHost._map, needle = document.querySelector('.maplibregl-ctrl-compass svg g');
                window.drawn.length = 0; window.recording = true;
                const tick = () => { f.push([m.getBearing(), -parseFloat(/rotate\((-?[\d.e-]+)deg\)\s*$/.exec(needle.style.transform)?.[1] ?? 'NaN')]); if (window.recording) requestAnimationFrame(tick); };
                requestAnimationFrame(tick);
            });
            if (kind === 'touch') await touch('touchStart', box.x, box.y); else { await page.mouse.move(box.x, box.y); await page.mouse.down(); }
            // 500 pixels to the left, downwards in a shallow arc, as a hand moves a mouse.
            // (With 5 moves, each move waits for a frame: 5 moves in one frame turn the map by 200 degrees between two
            // recorded frames, and a step over 180 degrees reads as a step back. Playwright's WebKit sends them in one frame, #779.)
            for (let i = 1; i <= moves; i++) {
                const x = box.x - 500 * i / moves, y = box.y + 200 * (i / moves) ** 2;
                if (kind === 'touch') await touch('touchMove', x, y); else await page.mouse.move(x, y);
                if (moves === 5) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
            }
            if (kind === 'touch') await touch('touchEnd'); else await page.mouse.up();
            await page.waitForTimeout(400);
            ends[`${kind} ${moves}`] = Math.round(await page.evaluate(() => window.fastHost._map.getBearing()) * 10) / 10;
            letters[`${kind} ${moves}`] = await page.evaluate(() => document.querySelector('.maplibregl-ctrl-compass text')?.textContent);
            // A step against the drag (a drag to the left turns the bearing up, modulo 360) in getBearing(), the needle or the
            // drawn camera.
            const r = await page.evaluate(() => { window.recording = false; return {seen: window.seen, drawn: window.drawn}; });
            const back = list => list.slice(1).filter((b, i) => ((b - list[i] + 540) % 360) - 180 < -0.01).length;
            steps[`${kind} ${moves}`] = [back(r.seen.map(f => f[0])), back(r.seen.map(f => f[1]).filter(b => !isNaN(b))), back(r.drawn)];
        }
        // (500 pixels to the left at 0.4 degrees: 200 degrees, which is -160.)
        check(`[${renderer}] a drag from the compass across the map ends at the same bearing at any speed (#548)`, Object.values(ends).every(b => Math.abs(b + 160) < 1), JSON.stringify(ends));
        // (-160 degrees is nearest to south.)
        check(`[${renderer}] after a drag from the compass, its letter follows the bearing (#548)`, Object.values(letters).every(l => l === 'S'), JSON.stringify(letters));
        check(`[${renderer}] a fast drag from the compass never turns back: not in getBearing(), in the needle or in the drawn map (#548)`, Object.values(steps).every(s => s.every(n => n === 0)), JSON.stringify(steps));
    } catch (e) { check(`[${renderer}] a fast drag from the compass: the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}

// #557: a rotate drag (the right mouse button, or Ctrl with the left one) turns the map of the main API as it turns
// MapLibre GL JS (served at /ml/): the same way and by the same angle, at five heights of the map. (test/interact.mjs
// has the same drags for the compat entry, and two fingers.)
for (const renderer of renderers) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/style.json`);
        const drags = async kind => {
            await page.evaluate(async ([kind, renderer]) => {
                const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]};
                const el = window.turnEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:99'}));
                if (kind === 'ml') {
                    const ml = await import('/ml/maplibre-gl.mjs');
                    ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
                    const m = window.turnMap = new ml.Map({container: el, style, center: [0, 0], zoom: 2, attributionControl: false});
                    await new Promise(r => m.once('load', r));
                } else {
                    const lib = await import('/dist/map-jr-gl.js');
                    const host = window.turnHost = lib.createMap(el, {style, renderer, initialView: {center: [0, 0], zoom: 2}, attribution: false});
                    await new Promise(r => host.state.subscribe(s => s.loaded, v => v && r()));
                    window.turnMap = host._map;
                }
            }, [kind, renderer]);
            const bearing = async () => { await page.waitForTimeout(250); return page.evaluate(() => { const m = window.turnMap, b = m.getBearing(); m.jumpTo({bearing: 0, pitch: 0}); return Math.round(b * 10) / 10; }); };
            // (Each drag holds still for 250 ms before it ends, so that the inertia of MapLibre GL JS adds no turn.)
            const out = [];
            for (const y of [40, 150, 200, 250, 360]) {
                await page.waitForTimeout(100);
                await page.mouse.move(250, y); await page.mouse.down({button: 'right'});
                for (let i = 1; i <= 10; i++) await page.mouse.move(250 + i * 10, y);
                await page.waitForTimeout(250); await page.mouse.up({button: 'right'});
                out.push(await bearing());
            }
            await page.keyboard.down('Control'); await page.mouse.move(250, 250); await page.mouse.down();
            for (let i = 1; i <= 10; i++) await page.mouse.move(250 + i * 10, 250);
            await page.waitForTimeout(250); await page.mouse.up(); await page.keyboard.up('Control');
            out.push(await bearing());
            await page.evaluate(() => { window.turnHost ? window.turnHost.destroy() : window.turnMap.remove(); window.turnEl.remove(); window.turnHost = window.turnMap = undefined; });
            return out;
        };
        const ml = await drags('ml'), main = await drags('main');
        check(`[${renderer}] a rotate drag with the right button, and with Ctrl and the left button, turns the map the same way and by the same angle as MapLibre GL JS (#557)`,
            ml.length === main.length && ml.every((b, i) => Math.abs(b) > 10 && Math.abs(b - main[i]) < 1.5), JSON.stringify({ml, main}));
    } catch (e) { check(`[${renderer}] the rotate drags of #557: the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}

// The `querySource` example (examples/query.js and query.compat.js), on the harness page of the examples
// (examples/run.html; the site must be built), with the usual number of tile workers.
for (const code of ['core', 'compat']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 800}});
    try {
        await page.goto(`${origin}/site/examples/run.html?id=query&form=${code}`);
        await page.waitForFunction(() => window.maps?.query, null, {timeout: 60000});
        await page.evaluate(async code => {
            document.getElementById('query').scrollIntoView({block: 'center'});
            const map = window.maps.query, wait = ms => new Promise(r => setTimeout(r, ms));
            for (let i = 0; i < 300 && !(code === 'core' ? map.state.get().idle : map.loaded()); i++) await wait(100);
            await wait(1000);
        }, code);
        // (The row is in the middle of the page and can be taller than the page: the clicks are in the part that shows.)
        const live = await page.locator('#query .live').boundingBox(), top = Math.max(live.y, 0);
        const answerBox = () => page.evaluate(() => { const b = [...document.querySelectorAll('#query .live > div')].find(d => d.style.pointerEvents === 'none'); return b && !b.hidden ? b.textContent : null; });

        // 1. Every click gets an answer: clicks one after another, some directly after a jump (the tiles are loading),
        // and one on the box that shows the answer before. LIMIT is generous: on the development machine (4 cores,
        // software WebGL, load average 4 to 7) the slowest of 228 clicks, a third of them directly after a jump, took 1.1 seconds.
        const LIMIT = 6000, times = [], late = [];
        for (let i = 0; i < 10; i++) {
            const jump = i >= 4 && i % 2 === 0, onBox = i === 3 || i === 9;
            await page.evaluate(([code, jump, i]) => {
                document.querySelector('#query .readout').textContent = '';
                const map = window.maps.query, view = {center: [-73.99 + i * 0.011, 40.7 + i * 0.007], zoom: 15.5};
                if (jump) { if (code === 'core') map.moveTo(view); else map.jumpTo(view); }
            }, [code, jump, i]);
            const at = onBox ? [live.x + 30, top + 22] : [live.x + 120 + i * 45, top + 150 + i * 35], start = Date.now();
            await page.mouse.click(at[0], at[1]);
            const answered = await page.waitForFunction(() => /features within 8 pixels/.test(document.querySelector('#query .readout').textContent), null, {timeout: LIMIT, polling: 20}).then(() => true, () => false);
            if (answered) times.push(Date.now() - start); else late.push(`${i}${jump ? ' (after a jump)' : ''}${onBox ? ' (on the box)' : ''}`);
        }
        check(`examples, query example (${code}): each of 10 clicks gets an answer within ${LIMIT / 1000} seconds, also after a jump and on the box of the answer`, !late.length && !!(await answerBox()), JSON.stringify({withoutAnswer: late, slowestMs: Math.max(...times)}));

        // 2. The answer to an earlier click arrives after the answer to a later click: the example shows the later click.
        await page.evaluate(() => {
            const map = window.maps.query, ask = map.querySource, wait = ms => new Promise(r => setTimeout(r, ms));
            window.asked = 0;
            // The first question gets a marked answer 2 seconds late. The questions after it are not changed.
            map.querySource = function (...a) { const answer = ask.apply(this, a); return window.asked++ ? answer : answer.then(async () => { await wait(2000); return [{sourceLayer: 'first-click', properties: {}}]; }); };
        });
        await page.mouse.click(live.x + 80, top + 300);
        await page.waitForFunction(() => window.asked === 1, null, {timeout: 10000});
        await page.mouse.click(live.x + live.width - 80, top + 300);
        await page.waitForFunction(() => window.asked === 2, null, {timeout: 10000});
        await page.waitForTimeout(3500); // (the late answer of the first click has arrived)
        const shown = await answerBox();
        check(`examples, query example (${code}): after two clicks, the answer of the last click is shown`, !!shown && !shown.includes('first-click'), JSON.stringify({shown: shown?.slice(0, 80)}));
    } catch (e) { check(`examples, query example (${code}): the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The examples hover, back and fit (#1119), in each form that the harness page runs: the line of text names the landing
// under the pointer; Back returns to the view before the click on a landing; the map starts with every landing in the
// view, and the button fits them again after a move.
for (const code of ['core', 'compat', 'svelte', 'element']) {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}}), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // (A map of the compat entry has getZoom and project as in MapLibre GL JS; the other forms give a map of the main API.)
    const settled = id => page.waitForFunction(id => { const m = window.maps?.[id]; return m && (m.loaded ? m.loaded() && !m.isMoving() : m.state.get().idle && !m.state.get().moving); }, id, {timeout: 30000});
    const zoomOf = id => page.evaluate(id => { const m = window.maps[id]; return m.getZoom ? m.getZoom() : m.state.get().view.zoom; }, id);
    const screenOf = (id, lngLat) => page.evaluate(([id, lngLat]) => { const p = window.maps[id].project(lngLat), r = document.querySelector('.live').getBoundingClientRect(); return [r.x + p.x, r.y + p.y]; }, [id, lngLat]);
    const readout = () => page.evaluate(() => document.querySelector('.readout').textContent);
    const open = async id => { await page.goto(`${origin}/site/examples/run.html?id=${id}&form=${code}`); await settled(id); await page.waitForTimeout(300); };
    const whitehall = [-74.0131, 40.7013], landings = [whitehall, [-74.0067, 40.7034], [-74.0181, 40.7147], [-73.9946, 40.7036], [-74.0189, 40.6928], [-73.9785, 40.7116], [-73.9997, 40.6930]];
    const allInside = () => page.evaluate(landings => { const m = window.maps.fit, r = document.querySelector('.live').getBoundingClientRect(); return landings.every(l => { const p = m.project(l); return p.x >= 20 && p.y >= 20 && p.x <= r.width - 20 && p.y <= r.height - 20; }); }, landings);
    try {
        await open('hover');
        await page.mouse.move(...await screenOf('hover', whitehall));
        const named = await page.waitForFunction(() => document.querySelector('.readout').textContent === 'Whitehall Terminal', null, {timeout: 5000}).then(() => true, () => false);
        // The state `hover` of the landing, as a query of the layer reports it.
        const hoverOf = () => page.evaluate(async lngLat => { const m = window.maps.hover, found = await (m.queryRenderedFeatures ? m.queryRenderedFeatures(m.project(lngLat), {layers: ['landings']}) : m.queryFeatures(lngLat, {layers: ['landings']})); return found[0]?.state.hover ?? null; }, whitehall);
        const stateOver = await hoverOf();
        await page.mouse.move(5, 5);
        const left = await page.waitForFunction(() => /^Move the pointer/.test(document.querySelector('.readout').textContent), null, {timeout: 5000}).then(() => true, () => false);
        const stateAfter = await hoverOf();
        check(`examples, hover example (${code}): the landing under the pointer has the state hover and its name in the line of text, and neither after the pointer leaves it`,
            named && stateOver === true && left && !stateAfter, JSON.stringify({text: await readout(), stateOver, stateAfter}));

        await open('back');
        const before = await zoomOf('back');
        await page.mouse.click(...await screenOf('back', whitehall));
        await page.waitForFunction(() => /^Whitehall Terminal\./.test(document.querySelector('.readout').textContent), null, {timeout: 5000});
        await page.waitForTimeout(1200); await settled('back');
        const zoomedIn = await zoomOf('back');
        await page.click('.actions button');
        await page.waitForTimeout(1200); await settled('back');
        const after = await zoomOf('back');
        check(`examples, back example (${code}): a click on a landing zooms to it, and Back returns to the zoom before the click`, zoomedIn > 16.9 && Math.abs(after - before) < 0.01, JSON.stringify({before, zoomedIn, after}));

        await open('fit');
        const atStart = await allInside();
        await page.evaluate(() => { const m = window.maps.fit, to = {center: [-73.95, 40.75], zoom: 16}; if (m.jumpTo) m.jumpTo(to); else m.moveTo(to); });
        const moved = !(await allInside());
        await page.click('.actions button');
        await page.waitForTimeout(1000); await settled('fit');
        check(`examples, fit example (${code}): the map starts with every landing in the view, and the button fits them again after a move`, atStart && moved && await allInside(), JSON.stringify({atStart, moved}));
    } catch (e) { check(`examples, hover, back and fit examples (${code}): the test run was completed`, false, String(e.message).split('\n')[0]); }
    check(`examples, hover, back and fit examples (${code}): no error on the page`, !errors.length, errors.join(' | '));
    await page.close();
}
// The harness page (#1114) says which forms it runs when it is asked for a form that it does not run, and for an
// example that no file has.
{
    const page = await browser.newPage({viewport: {width: 1200, height: 800}});
    try {
        const errorOf = async query => { await page.goto(`${origin}/site/examples/run.html?${query}`); await page.waitForFunction(() => window.exampleError || window.maps, null, {timeout: 30000}); return page.evaluate(() => [window.exampleError, document.querySelector('.readout').textContent]); };
        const noForm = await errorOf('id=query&form=vue'), noId = await errorOf('id=nothing&form=core');
        check('examples, harness page: a form that does not run and an unknown example each give a message on the page and in window.exampleError (#1114)',
            /^\[map-jr-gl\] examples: the form "vue" does not run here\. Use one of: core, compat, svelte, element\.$/.test(noForm[0]) && noForm[1] === noForm[0] && /^\[map-jr-gl\] examples: no example has the id "nothing"/.test(noId[0]) && noId[1] === noId[0], JSON.stringify({noForm: noForm[0], noId: noId[0]}));
    } catch (e) { check('examples, harness page (#1114): the test run was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The Svelte and <map-jr> forms of each example run on the harness page and reach idle, with their line of text in
// .readout and their buttons in .actions (#1115).
for (const form of ['svelte', 'element']) {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}}), results = [];
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
        for (const id of ['basic', 'reactive', 'markers', 'draggable', 'images', 'terrain', 'globe', 'query', 'hover', 'fit', 'back', 'pmtiles', 'styles']) {
            await page.goto(`${origin}/site/examples/run.html?id=${id}&form=${form}`);
            const idle = await page.waitForFunction(id => window.exampleError || window.maps?.[id]?.state.get().idle, id, {timeout: 30000}).then(() => true, () => false);
            const [error, buttons, inStage] = await page.evaluate(() => [window.exampleError, document.querySelectorAll('.actions button').length, !!document.querySelector('.live canvas')]);
            results.push(`${id}:${idle && !error && inStage ? 'ok' : 'no'}${buttons ? `/${buttons}` : ''}`);
        }
    } catch (e) { results.push(String(e.message).split('\n')[0]); }
    check(`examples, harness page: the ${form} form of each example runs in the stage and reaches idle (#1115)`,
        results.join(' ') === 'basic:ok reactive:ok/2 markers:ok draggable:ok images:ok terrain:ok/2 globe:ok query:ok hover:ok fit:ok/1 back:ok/1 pmtiles:ok styles:ok/1' && !errors.length, `${results.join(' ')} ${errors.join(' | ')}`);
    await page.close();
}
// Tiles before they are in view (#361). (1) The tiles of the destination of an `easeTo` and of a `flyTo` are requested
// when it starts. The movement goes 0.3 degrees east at zoom 13 in 5 s: for the first 1500 ms
// the view is still near the start, so a request for a tile next to the destination is a request made early.
// (2) A newer movement does not cancel the early requests that are on their way (tile answers are 1.5 s late here).
// (3) A drag requests no tiles beyond the leading edge of the view.
const from = [-74.0065, 40.7085], east = from[0] + 0.3;
const tileOf = (lng, z) => Math.floor((lng + 180) / 360 * 2 ** z);
const prefetchPage = async (late = 0) => {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    const asked = [], failed = [];
    await page.goto(`${origin}/bench`);
    await page.route(/\/tiles\/\d+\/\d+\/\d+\.pbf/, async route => { asked.push(new URL(route.request().url()).pathname.split('/').slice(-3).map(v => parseInt(v))); if (late) await new Promise(r => setTimeout(r, late)); route.continue().catch(() => {}); });
    page.on('requestfailed', r => { if (/\/tiles\//.test(r.url())) failed.push(r.url()); });
    await page.evaluate(async from => {
        const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
        window.host = lib.createMap(el, {style, initialView: {center: from, zoom: 13}, renderer: 'main', attribution: false});
        await new Promise(r => window.host.state.subscribe(s => s.idle, idle => idle && r()));
        await new Promise(r => setTimeout(r, 500));
    }, from);
    return {page, asked, failed};
};
for (const method of ['easeTo', 'flyTo']) {
    let page;
    try {
        const p = await prefetchPage(); page = p.page;
        const before = p.asked.length;
        await page.evaluate(([method, east, lat]) => window.host._map[method]({center: [east, lat], duration: 5000}), [method, east, from[1]]);
        // (Only tiles of the level of the view: a flyTo zooms out, and its coarser tiles cover the destination early.)
        const zView = Math.max(...p.asked.slice(0, before).map(t => t[0]));
        const earlyOf = () => p.asked.slice(before).filter(([z, x]) => z === zView && Math.abs(x - tileOf(east, z)) <= 1);
        // Wait for the first early request instead of a fixed time (#790). Up to 1500 ms, the view is still more
        // than 5 tiles away from the destination, so a request for it cannot come from the view itself.
        const start = Date.now();
        while (!earlyOf().length && Date.now() - start < 1500) await page.waitForTimeout(25);
        const early = earlyOf();
        check(`prefetch: the tiles at the destination of ${method} are requested at its start`, early.length > 0, JSON.stringify({early: early.length, after: p.asked.length - before, ms: Date.now() - start}));
    } catch (e) { check(`prefetch, ${method}: the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page?.close();
}
{
    let page;
    try {
        const p = await prefetchPage(1500); page = p.page;
        const before = p.asked.length;
        await page.evaluate(([east, lat]) => window.host._map.easeTo({center: [east, lat], duration: 5000}), [east, from[1]]);
        await page.waitForTimeout(400);
        const early = p.asked.slice(before).filter(([z, x]) => Math.abs(x - tileOf(east, z)) <= 1).map(t => '/' + t.join('/') + '.pbf');
        await page.evaluate(([lng, lat]) => window.host._map.easeTo({center: [lng, lat], duration: 5000}), [from[0] - 0.3, from[1]]);
        await page.waitForTimeout(2500);
        const cancelled = p.failed.filter(u => early.some(e => u.endsWith(e)));
        check('prefetch: a newer movement lets the early requests of an older one finish', early.length > 0 && cancelled.length === 0, JSON.stringify({early: early.length, cancelled: cancelled.length}));
    } catch (e) { check('prefetch: the test of a newer movement was completed', false, String(e.message).split('\n')[0]); }
    await page?.close();
}
{
    let page;
    try {
        const p = await prefetchPage(); page = p.page;
        await page.mouse.move(600, 300); await page.mouse.down();
        for (let i = 1; i <= 15; i++) { await page.mouse.move(600 - i * 20, 300); await page.waitForTimeout(40); }
        // (The button stays down: a release would start the inertia.)
        const edge = await page.evaluate(() => window.host._map.getBounds().getEast());
        const z = Math.max(...p.asked.map(t => t[0]));
        const ahead = p.asked.filter(([tz, x]) => tz === z && x * 360 / 2 ** z - 180 > edge);
        await page.mouse.up();
        check('prefetch: a drag requests no tiles beyond the leading edge', ahead.length === 0, JSON.stringify({ahead: ahead.length, z}));
    } catch (e) { check(`prefetch: the drag test was completed`, false, String(e.message).split('\n')[0]); }
    await page?.close();
}
// A tile whose request fails is requested again while the view needs it (#360). The first request of each tile of
// the view fails here as a lost connection does; each of these tiles must be requested a second time, and the map
// must then be idle.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const seen = new Map();
        await page.goto(`${origin}/bench`);
        await page.route(/\/tiles\/\d+\/\d+\/\d+\.pbf/, route => {
            const k = new URL(route.request().url()).pathname, n = (seen.get(k) ?? 0) + 1;
            seen.set(k, n);
            return n === 1 ? route.abort('connectionreset') : route.continue().catch(() => {});
        });
        await page.evaluate(async from => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            window.host = lib.createMap(el, {style, initialView: {center: from, zoom: 13}, renderer: 'main', attribution: false});
            await new Promise(r => setTimeout(r, 6000));
        }, from);
        const once = [...seen].filter(([, n]) => n < 2).map(([k]) => k), idle = await page.evaluate(() => window.host.state.get().idle);
        check('a tile whose request failed is requested again, and the map becomes idle', seen.size > 0 && once.length === 0 && idle, JSON.stringify({tiles: seen.size, once: once.slice(0, 4), idle}));
    } catch (e) { check('the test of failed tile requests was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// Only a network error and an HTTP status 5xx are worth another request (#652): the tile at the center answers with
// each status for 6 s, which is longer than the three retries take (3.5 s). A 404 and a 403 are requested once, a 503
// four times.
for (const status of [404, 403, 503]) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const z = 13, x = tileOf(from[0], z), y = Math.floor((1 - Math.log(Math.tan(Math.PI / 4 + from[1] * Math.PI / 360)) / Math.PI) / 2 * 2 ** z);
        const bad = `/${z}/${x}/${y}.pbf`;
        let count = 0;
        await page.goto(`${origin}/bench`);
        await page.route(/\/tiles\/\d+\/\d+\/\d+\.pbf/, route => {
            if (!new URL(route.request().url()).pathname.endsWith(bad)) return route.continue().catch(() => {});
            count++;
            return route.fulfill({status, body: 'no'});
        });
        await page.evaluate(async from => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            window.host = lib.createMap(el, {style, initialView: {center: from, zoom: 13}, renderer: 'main', attribution: false, onError: () => {}});
            await new Promise(r => setTimeout(r, 6000));
        }, from);
        const expected = status >= 500 ? 4 : 1;
        check(`a tile that answers HTTP ${status} is requested ${expected === 1 ? 'once' : `${expected} times`}`, count === expected, `${count} requests`);
    } catch (e) { check(`the test of a tile that answers HTTP ${status} was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A raster tile that fails gives one error with the prefix and the name of its source (#2099): one source answers 500,
// the other answers 200 with bytes that are not an image. A tile that cannot be decoded would fail again, so it is
// requested once in 6 s, as in MapLibre GL JS; a 500 is requested again (0.5 s, 1 s, 2 s).
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const seen = {five: new Map(), png: new Map()};
        await page.goto(`${origin}/bench`);
        await page.route(/\/raster-2099\/(five|png)\//, route => {
            const u = new URL(route.request().url()), kind = u.pathname.split('/')[2];
            seen[kind].set(u.pathname, (seen[kind].get(u.pathname) ?? 0) + 1);
            return kind === 'five' ? route.fulfill({status: 500, body: 'down'}) : route.fulfill({status: 200, contentType: 'image/png', body: 'not a png'});
        });
        const errors = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), errors = [], tiles = kind => ({type: 'raster', tiles: [`${location.origin}/raster-2099/${kind}/{z}/{x}/{y}.png`], tileSize: 256});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = lib.createMap(el, {style: {version: 8, sources: {five: tiles('five'), png: tiles('png')}, layers: [{id: 'a', type: 'raster', source: 'five'}, {id: 'b', type: 'raster', source: 'png'}]},
                view: {center: [0, 0], zoom: 2}, attribution: false, onError: (e, info) => errors.push({source: info.sourceId, message: e.message})});
            await new Promise(r => setTimeout(r, 6000));
            m.destroy();
            return errors;
        });
        const of = s => errors.filter(e => e.source === s), most = map => Math.max(...map.values());
        // (The production build prints the codes, their links and the values, #2148.)
        const named = s => of(s).every(e => e.message.startsWith(`[map-jr-gl] E2106 https://map-jr.org/e/2106 source="${s}" E1163 https://map-jr.org/e/1163 what="tile" url="http`));
        check('a raster tile that answers HTTP 500 gives one error for each tile, with the prefix and the source (#2099)',
            seen.five.size > 0 && of('five').length === seen.five.size && named('five') && of('five').every(e => e.message.includes('.png" reason="HTTP 500"')), JSON.stringify({tiles: seen.five.size, errors: of('five').slice(0, 2)}));
        check('a raster tile that cannot be decoded gives one error for each tile, with the prefix and the source, and is requested once (#2099)',
            seen.png.size > 0 && of('png').length === seen.png.size && named('png') && most(seen.png) === 1, JSON.stringify({tiles: seen.png.size, most: seen.png.size && most(seen.png), errors: of('png').slice(0, 2)}));
    } catch (e) { check('the test of raster tiles that fail was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A raster-dem tile that cannot be decoded is final, as in MapLibre GL JS 6.17 (#2109): it is requested once in 6 s,
// gives one error with the prefix and the source, and the map reaches idle without it.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const seen = new Map();
        await page.goto(`${origin}/bench`);
        await page.route(/\/dem-2109\//, route => {
            const u = new URL(route.request().url()).pathname;
            seen.set(u, (seen.get(u) ?? 0) + 1);
            return route.fulfill({status: 200, contentType: 'image/png', body: 'not a png'});
        });
        const got = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), errors = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = lib.createMap(el, {style: {version: 8, sources: {dem: {type: 'raster-dem', tiles: [`${location.origin}/dem-2109/{z}/{x}/{y}.png`], tileSize: 256}}, layers: [{id: 'h', type: 'hillshade', source: 'dem'}]},
                view: {center: [0, 0], zoom: 2}, attribution: false, onError: (e, info) => errors.push({source: info.sourceId, message: e.message})});
            await new Promise(r => setTimeout(r, 6000));
            const idle = m.state.get().idle;
            m.destroy();
            return {errors, idle};
        });
        const most = seen.size ? Math.max(...seen.values()) : 0;
        check('a raster-dem tile that cannot be decoded is requested once and gives one error with the source, and the map is idle (#2109)',
            seen.size > 0 && most === 1 && got.errors.length === seen.size && got.idle
            && got.errors.every(e => e.source === 'dem' && e.message.startsWith('[map-jr-gl] E2106 https://map-jr.org/e/2106 source="dem" E1163 https://map-jr.org/e/1163 what="tile" url="http') && e.message.includes('reason="undecodable image"')),
            JSON.stringify({tiles: seen.size, most, idle: got.idle, errors: got.errors.slice(0, 2)}));
    } catch (e) { check('the test of a raster-dem tile that cannot be decoded was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A tile that a custom protocol rejects is asked for once (#652): the loader is called once for each tile in 6 s.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/bench`);
        const calls = await page.evaluate(async from => {
            const lib = await import('/dist/map-jr-gl.js'), calls = {};
            lib.addProtocol('reject652', async ({url}) => { calls[url] = (calls[url] ?? 0) + 1; throw new Error('no such tile'); });
            const style = {version: 8, sources: {s: {type: 'vector', tiles: ['reject652://{z}/{x}/{y}'], maxzoom: 14}}, layers: [{id: 'fill', type: 'fill', source: 's', 'source-layer': 'water'}]};
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            window.host = lib.createMap(el, {style, initialView: {center: from, zoom: 13}, renderer: 'main', attribution: false, onError: () => {}});
            await new Promise(r => setTimeout(r, 6000));
            return calls;
        }, from);
        const counts = Object.values(calls), most = Math.max(...counts);
        check('a tile that a custom protocol rejects is asked for once', counts.length > 0 && most === 1, JSON.stringify({tiles: counts.length, most}));
    } catch (e) { check('the test of a tile that a custom protocol rejects was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A tile of the view whose requests all fail is covered by its overview tile three levels up before the first `idle`
// (#379). Every request of the tile at the centre fails; the overview tile of that area must be requested and answered
// before the map becomes idle.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const z = 13, x = tileOf(from[0], z), y = Math.floor((1 - Math.log(Math.tan(Math.PI / 4 + from[1] * Math.PI / 360)) / Math.PI) / 2 * 2 ** z);
        const bad = `/${z}/${x}/${y}.pbf`, over = `/${z - 3}/${x >> 3}/${y >> 3}.pbf`;
        let overAt = 0;
        await page.goto(`${origin}/bench`);
        await page.route(/\/tiles\/\d+\/\d+\/\d+\.pbf/, async route => {
            const k = new URL(route.request().url()).pathname;
            if (k.endsWith(bad)) return route.abort('connectionreset');
            await route.continue().catch(() => {});
            if (k.endsWith(over)) overAt = Date.now();
        });
        const idleAt = await page.evaluate(async from => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            window.host = lib.createMap(el, {style, initialView: {center: from, zoom: 13}, renderer: 'main', attribution: false});
            await new Promise(r => window.host.state.subscribe(s => s.idle, idle => idle && r()));
            return Date.now();
        }, from);
        check('a tile whose requests fail is covered by its overview tile before the first idle', overAt > 0 && overAt <= idleAt, JSON.stringify({over, overAt: overAt && overAt - idleAt}));
    } catch (e) { check('the test of the overview of a failed tile was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A tile whose first four requests fail is requested again every 15 s in the background, while the view still needs it
// (#686). Two pages run at the same time, so that the check waits for 15 s once.
// - On the first, every request of the tile at the center fails, so its overview stands in for it, and the first four
//   requests of that overview fail. The fifth request of the overview is answered.
//   The first `idle` comes after the fourth request of the overview, because `idle` waits for the overview between
//   its first retries (#1644).
// - On the second, every tile request fails (a server that is down). A background request does not make the map leave
//   `idle` and its failure fires no `error`: from the first background request until 1 s after each tile that has one
//   has failed it, the map fires neither, and the map is idle at the end.
{
    const pages = [];
    try {
        const z = 13, x = tileOf(from[0], z), y = Math.floor((1 - Math.log(Math.tan(Math.PI / 4 + from[1] * Math.PI / 360)) / Math.PI) / 2 * 2 ** z);
        const bad = `/${z}/${x}/${y}.pbf`, over = `/${z - 3}/${x >> 3}/${y >> 3}.pbf`;
        let overTries = 0, answered = 0, fourthAt = 0;
        const tries = new Map(), failed = new Map();
        let background = 0;
        // (Each page has a fixed index, because the two calls of `browser.newPage` can resolve in either order. With
        // `pages.push`, the page of the server that is down was `pages[0]` in some runs, and the checks read the other map, #1761.)
        const start = async (i, route) => {
            const page = await browser.newPage({viewport: {width: 900, height: 600}});
            pages[i] = page;
            await page.goto(`${origin}/bench`);
            await page.route(/\/tiles\/\d+\/\d+\/\d+\.pbf/, route);
            return page.evaluate(async from => {
                const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
                window.seen = [];
                window.host = lib.createMap(el, {style, initialView: {center: from, zoom: 13}, renderer: 'main', attribution: false, onError: () => window.seen.push(['error', Date.now()])});
                window.host.listen('idle', () => window.seen.push(['idle', Date.now()]));
                return new Promise(r => { window.host.state.subscribe(s => s.idle, idle => idle && r(true)); setTimeout(() => r(false), 30000); });
            }, from);
        };
        const [idleOne, idleDown] = await Promise.all([
            start(0, async route => {
                const k = new URL(route.request().url()).pathname;
                if (k.endsWith(bad)) return route.abort('connectionreset');
                if (k.endsWith(over) && ++overTries <= 4) { if (overTries === 4) fourthAt = Date.now(); return route.abort('connectionreset'); }
                await route.continue().catch(() => {});
                if (k.endsWith(over)) answered = Date.now();
            }),
            start(1, async route => {
                const k = new URL(route.request().url()).pathname, n = (tries.get(k) ?? 0) + 1;
                tries.set(k, n);
                if (n === 5) background ||= Date.now();
                await route.abort('connectionreset').catch(() => {});
                if (n === 5) failed.set(k, Date.now());
            }),
        ]);
        // (A background request comes about 19 s after the first request of its tile. The bound leaves room for a loaded runner.)
        for (const end = Date.now() + 60000; (!answered || !failed.size || failed.size < [...tries.values()].filter(n => n >= 5).length) && Date.now() < end;) await pages[0].waitForTimeout(250);
        await pages[1].waitForTimeout(1000);
        check('an overview tile that failed four times is requested again later and answered', idleOne && overTries === 5 && answered > 0, JSON.stringify({idleOne, overTries, answered: answered > 0}));
        const firstIdle = (await pages[0].evaluate(() => window.seen)).find(([type]) => type === 'idle')?.[1] ?? 0;
        check('the first idle of a map whose overview tile stands in comes after the fourth request of the overview', fourthAt > 0 && firstIdle >= fourthAt, JSON.stringify({fourthAt: fourthAt > 0, idleAfter: firstIdle && fourthAt && firstIdle - fourthAt}));
        const {seen, idle} = await pages[1].evaluate(() => ({seen: window.seen, idle: window.host.state.get().idle}));
        const after = seen.filter(([, t]) => background && t >= background);
        check('a background request of a tile on a server that is down fires neither `idle` nor `error`, and the map stays idle', idleDown && background > 0 && failed.size > 0 && !after.length && idle, JSON.stringify({idleDown, background: background > 0, failed: failed.size, after, idle}));
    } catch (e) { check('the test of the background requests of failed tiles was completed', false, String(e.message).split('\n')[0]); }
    for (const page of pages) await page?.close();
}
// A tile whose response has `Cache-Control: max-age=2` is requested again when it has expired, while it is in view, as
// in MapLibre GL JS (#687). The vector tiles of the demo and the tiles of a raster source answer with that header here.
// In 8 s a tile of each source is requested at least three times, and the map fires `idle` again after each reload. A
// tile with the usual `max-age=3600` of the demo server is requested once in that time. Both renderers run at once.
{
    const pages = [];
    try {
        const run = async (renderer, short) => {
            const page = await browser.newPage({viewport: {width: 600, height: 400}});
            pages.push(page);
            const seen = new Map(), png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
            await page.goto(`${origin}/bench`);
            await page.route(/\/tiles\/\d+\/\d+\/\d+\.pbf|\/exp687\//, async route => {
                const k = new URL(route.request().url()).pathname;
                seen.set(k, (seen.get(k) ?? 0) + 1);
                const headers = {'access-control-allow-origin': '*', 'cache-control': short ? 'max-age=2' : 'max-age=3600'};
                if (k.startsWith('/exp687/')) return route.fulfill({status: 200, contentType: 'image/png', body: png, headers}).catch(() => {});
                const res = await route.fetch().catch(() => null);
                if (!res) return route.abort().catch(() => {});
                return route.fulfill({response: res, headers: {...res.headers(), ...headers}}).catch(() => {});
            });
            const out = await page.evaluate(async ({from, renderer}) => {
                const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
                style.sources.exp687 = {type: 'raster', tiles: [location.origin + '/exp687/{z}/{x}/{y}.png'], tileSize: 256};
                style.layers.splice(1, 0, {id: 'exp687', type: 'raster', source: 'exp687'});
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
                window.host = lib.createMap(el, {style, initialView: {center: from, zoom: 13}, renderer, attribution: false});
                let idles = 0;
                window.host.listen('idle', () => idles++);
                await new Promise(r => setTimeout(r, 8000));
                // (The last reload may be under way at the end: wait for the next `idle`, at most 5 s.)
                await new Promise(r => { setTimeout(r, 5000); window.host.listen('idle', r); });
                return {idles, idle: window.host.state.get().idle};
            }, {from, renderer});
            return {...out, seen};
        };
        const [main, worker, usual] = await Promise.all([run('main', true), run('worker', true), run('main', false)]);
        for (const [name, r] of [['main', main], ['worker', worker]]) {
            const vector = [...r.seen].filter(([k]) => k.startsWith('/tiles/')), raster = [...r.seen].filter(([k]) => k.startsWith('/exp687/'));
            const most = (list) => Math.max(0, ...list.map(([, n]) => n));
            check(`[${name}] a tile with max-age=2 is requested again while it is in view, and the map fires idle after reloads`,
                most(vector) >= 3 && most(raster) >= 3 && r.idles >= 3 && r.idle, JSON.stringify({vector: most(vector), raster: most(raster), idles: r.idles, idle: r.idle}));
        }
        const twice = [...usual.seen].filter(([, n]) => n > 1);
        check('a tile with max-age=3600 is requested once', usual.seen.size > 0 && twice.length === 0, JSON.stringify({tiles: usual.seen.size, twice: twice.slice(0, 3)}));
    } catch (e) { check('the test of tiles that expire was completed', false, String(e.message).split('\n')[0]); }
    for (const page of pages) await page?.close();
}
// A tile with `max-age=1` whose server then answers 500: the failed reload fires one `error` for each tile, with its
// source, as MapLibre GL JS 6.17 does, and the reloads after it (1 s, 2 s, 4 s) fire none (#2072). Both entries.
{
    const page = await browser.newPage({viewport: {width: 300, height: 200}});
    try {
        await page.goto(`${origin}/bench`);
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'), seen = new Map();
        await page.route(/\/exp2072\//, route => {
            const k = new URL(route.request().url()).pathname, n = (seen.get(k) ?? 0) + 1;
            seen.set(k, n);
            const headers = {'access-control-allow-origin': '*', 'cache-control': 'max-age=1'};
            return (n === 1 ? route.fulfill({status: 200, contentType: 'image/png', body: png, headers}) : route.fulfill({status: 500, body: '', headers})).catch(() => {});
        });
        const out = await page.evaluate(async () => {
            const result = {};
            for (const entry of ['main', 'compat']) {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99'}));
                const style = {version: 8, sources: {s: {type: 'raster', tiles: [location.origin + `/exp2072/${entry}/{z}/{x}/{y}.png`], tileSize: 256}}, layers: [{id: 's', type: 'raster', source: 's'}]};
                const errors = [];
                let remove;
                if (entry === 'main') {
                    const lib = await import('/dist/map-jr-gl.js');
                    const m = lib.createMap(el, {style, initialView: {center: [0, 0], zoom: 0}, attribution: false, onError: (e, info) => errors.push({sourceId: info?.sourceId, source: true})});
                    remove = () => m.destroy();
                } else {
                    const lib = await import('/dist/map-jr-gl-maplibre-compat.js');
                    const m = new lib.Map({container: el, style, center: [0, 0], zoom: 0, attributionControl: false});
                    m.on('error', e => errors.push({sourceId: e.sourceId, source: e.source?.type === 'raster'}));
                    remove = () => m.remove();
                }
                // (The tiles load at once, expire after 1 s and fail from then on, which reloads them after 1 s, 2 s and 4 s.)
                await new Promise(r => setTimeout(r, 9000));
                remove(); el.remove();
                result[entry] = errors;
            }
            return result;
        });
        for (const entry of ['main', 'compat']) {
            const tiles = [...seen].filter(([k]) => k.startsWith(`/exp2072/${entry}/`)), errors = out[entry];
            check(`[${entry}] a failed reload of an expired tile fires one error for each tile, with its source, also after more failed reloads (#2072)`,
                tiles.length > 0 && tiles.every(([, n]) => n >= 4) && errors.length === tiles.length && errors.every(e => e.sourceId === 's' && e.source),
                JSON.stringify({tiles: tiles.length, requests: tiles.map(([, n]) => n), errors: errors.length, first: errors[0]}));
        }
    } catch (e) { check('the test of failed reloads of expired tiles was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// An elevation tile (`raster-dem`) whose response has `Cache-Control: max-age=2` is requested again too, as in MapLibre
// GL JS (#1988). Each answer is 500 m higher than the one before (terrarium, from 1000 m). The terrain of a pitched map
// takes each new tile, and keeps the old one until then: the point that `project` gives for a place in front of the
// center moves one way only (a moment without the tile would put it back on flat ground). With `max-age=3600` an
// elevation tile is requested once in that time.
{
    const pages = [];
    try {
        const run = async (renderer, short) => {
            const page = await browser.newPage({viewport: {width: 600, height: 400}});
            pages.push(page);
            const seen = new Map();
            await page.goto(`${origin}/bench`);
            await page.route(/\/dem1988\//, route => {
                const k = new URL(route.request().url()).pathname, n = seen.get(k) ?? 0, v = 32768 + 1000 + 500 * n;
                seen.set(k, n + 1);
                return route.fulfill({status: 200, contentType: 'image/png', body: solidPNG(256, [v >> 8, v & 255, 0]),
                    headers: {'access-control-allow-origin': '*', 'cache-control': short ? 'max-age=2' : 'max-age=3600'}}).catch(() => {});
            });
            const out = await page.evaluate(async renderer => {
                const lib = await import('/dist/map-jr-gl.js');
                const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: [location.origin + '/dem1988/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 4}},
                    terrain: {source: 'dem'}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]};
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
                const host = lib.createMap(el, {style, initialView: {center: [10, 45], zoom: 6, pitch: 60}, renderer, attribution: false});
                await new Promise(r => host.listen('idle', r));
                const ys = [];
                for (const end = performance.now() + 8000; performance.now() < end;) { ys.push(Math.round(host.project([10, 45.05]).y * 10) / 10); await new Promise(r => setTimeout(r, 50)); }
                host.destroy();
                return ys;
            }, renderer);
            return {ys: out, seen};
        };
        const [main, worker, usual] = await Promise.all([run('main', true), run('worker', true), run('main', false)]);
        for (const [name, r] of [['main', main], ['worker', worker]]) {
            const most = Math.max(0, ...r.seen.values()), steps = r.ys.slice(1).map((y, i) => Math.sign(y - r.ys[i])).filter(Boolean);
            check(`[${name}] an elevation tile with max-age=2 is requested again, and the terrain keeps the old tile until the new one is there (#1988)`,
                most >= 3 && steps.length >= 2 && steps.every(d => d === steps[0]), JSON.stringify({requests: most, ys: [...new Set(r.ys)].slice(0, 8)}));
        }
        const twice = [...usual.seen].filter(([, n]) => n > 1);
        check('an elevation tile with max-age=3600 is requested once (#1988)', usual.seen.size > 0 && twice.length === 0, JSON.stringify({tiles: usual.seen.size, twice: twice.slice(0, 3)}));
    } catch (e) { check('the test of elevation tiles that expire was completed', false, String(e.message).split('\n')[0]); }
    for (const page of pages) await page?.close();
}
// An elevation tile whose reload answers 404 is dropped as a tile that the server does not have, as a vector tile is in
// the same case, and as in MapLibre GL JS (whose tile becomes `errored` and has no data then). The tile under the center
// and the tiles of lower zoom levels are at 0 m for good; the tile east of it is at 8000 m and answers 404 from its first
// reload on. The terrain then leaves its heights, so the point that `project` gives for a place east of the center goes
// back to where it is on a map without terrain, and the tile is not requested again (#2055). Before, the old heights
// stayed for good.
{
    const page = await browser.newPage({viewport: {width: 600, height: 400}});
    try {
        await page.goto(`${origin}/bench`);
        const seen = new Map();
        await page.route(/\/dem2055\//, route => {
            const k = new URL(route.request().url()).pathname, n = (seen.get(k) ?? 0) + 1, under = !k.startsWith('/dem2055/4/') || k.startsWith('/dem2055/4/8/'), v = 32768 + (under ? 0 : 8000);
            seen.set(k, n);
            const headers = {'access-control-allow-origin': '*', 'cache-control': under ? 'max-age=3600' : 'max-age=4'};
            return (n === 1 ? route.fulfill({status: 200, contentType: 'image/png', body: solidPNG(256, [v >> 8, v & 255, 0]), headers}) : route.fulfill({status: 404, body: '', headers})).catch(() => {});
        });
        const out = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), view = {center: [22, 45], zoom: 6, pitch: 60}, bg = [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}], east = [24, 45];
            const make = style => lib.createMap(document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99'})), {style, initialView: view, attribution: false});
            const flat = make({version: 8, sources: {}, layers: bg});
            await new Promise(r => flat.listen('idle', r));
            const flatX = flat.project(east).x, flatY = flat.project(east).y;
            flat.destroy();
            const host = make({version: 8, sources: {dem: {type: 'raster-dem', tiles: [location.origin + '/dem2055/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 4}}, terrain: {source: 'dem'}, layers: bg});
            await new Promise(r => host.listen('idle', r));
            const at = () => Math.hypot(host.project(east).x - flatX, host.project(east).y - flatY), first = at();
            await new Promise(r => setTimeout(r, 8000));
            const last = at();
            host.destroy();
            return {first, last};
        });
        const east = [...seen].filter(([k]) => k.startsWith('/dem2055/4/') && !k.startsWith('/dem2055/4/8/')).map(([, n]) => n);
        check('an elevation tile whose reload answers 404 leaves the terrain and is not requested again, as a vector tile (#2055)',
            east.length > 0 && east.every(n => n === 2) && out.first > 5 && out.last < 0.5, JSON.stringify({requests: east, ...out}));
    } catch (e) { check('the test of an elevation tile whose reload answers 404 was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A raster tile whose reload answers 404 becomes a tile that the server does not have, as on a first load: its old image
// goes, and a tile of a lower zoom stands in (MapLibre GL JS marks the tile `errored`, so its parent is drawn). The tiles
// of zoom 4 are green with `max-age=2` and answer 404 from their first reload on; the tiles of lower zoom levels are red.
// Before, the old tile was replaced by an empty one, and the center showed the blue background (#2124).
{
    const page = await browser.newPage({viewport: {width: 300, height: 200}});
    try {
        await page.goto(`${origin}/bench`);
        const seen = new Map();
        await page.route(/\/ras2124\//, route => {
            const k = new URL(route.request().url()).pathname, n = (seen.get(k) ?? 0) + 1, top = k.startsWith('/ras2124/4/');
            seen.set(k, n);
            const headers = {'access-control-allow-origin': '*', 'cache-control': top ? 'max-age=2' : 'max-age=3600'};
            return (!top || n === 1 ? route.fulfill({status: 200, contentType: 'image/png', body: solidPNG(256, top ? [0, 255, 0] : [255, 0, 0]), headers}) : route.fulfill({status: 404, body: '', headers})).catch(() => {});
        });
        await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js');
            const style = {version: 8, sources: {r: {type: 'raster', tiles: [location.origin + '/ras2124/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 4}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#00f'}}, {id: 'r', type: 'raster', source: 'r', paint: {'raster-fade-duration': 0}}]};
            const map = lib.createMap(document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99'})), {style, initialView: {center: [10, 20], zoom: 4.5}, attribution: false});
            await new Promise(r => map.listen('idle', r));
        });
        const color = async () => page.evaluate(async png => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d'); c.drawImage(bmp, 0, 0); return [...c.getImageData(0, 0, 1, 1).data.slice(0, 3)].join(','); }, (await page.screenshot({clip: {x: 150, y: 100, width: 1, height: 1}})).toString('base64'));
        const first = await color();
        let last = first;
        for (let i = 0; i < 40 && last !== '255,0,0'; i++) { await page.waitForTimeout(250); last = await color(); }
        check('a raster tile whose reload answers 404 loses its old image, and a tile of a lower zoom stands in (#2124)',
            first === '0,255,0' && last === '255,0,0', JSON.stringify({first, last}));
    } catch (e) { check('the test of a raster tile whose reload answers 404 was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The cost of a frame does not grow with the number of icons from buffers (#127). The engine reports the script time
// of its frames on the main thread (`stats`, `frameMs`). The check compares a symbol layer with 100,000 icons with
// the same layer with 1,000 icons, as a ratio of the medians, so it does not depend on the speed of the machine. With
// icons from buffers the ratio was 0.4 to 2.0 in local runs on software WebGL. Icons that are placed with the labels
// in each frame (a sort key makes the layer use that way) gave 63 and 107, so a limit of 5 has room for both.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/bench`);
        const ms = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json(), wait = ms => new Promise(r => setTimeout(r, ms));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const center = [-74.0065, 40.7085], frames = [];
            const host = lib.createMap(el, {style, initialView: {center, zoom: 13}, renderer: 'main', attribution: false});
            host.listen('stats', e => frames.push(e.frameMs));
            const idle = () => new Promise(r => { let at = 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), timer = setInterval(() => { if (at && performance.now() - at > 1000) { clearInterval(timer); off(); r(); } }, 100); setTimeout(r, 60000); });
            const median = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
            const measure = async count => {
                let seed = 9; const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
                const features = Array.from({length: count}, (_, i) => ({type: 'Feature', id: i, properties: {}, geometry: {type: 'Point', coordinates: [center[0] + (rand() - 0.5) * 0.08, center[1] + (rand() - 0.5) * 0.05]}}));
                host.update({style: {...style, sources: {...style.sources, many: {type: 'geojson', data: {type: 'FeatureCollection', features}}},
                    layers: [...style.layers, {id: 'many', type: 'symbol', source: 'many', layout: {'icon-image': 'dot', 'icon-allow-overlap': true, 'icon-ignore-placement': true}}]},
                    images: {dot: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#d6453d" stroke="#fff"/></svg>'}, initialView: {center, zoom: 13}, renderer: 'main', attribution: false});
                host.moveTo({center, zoom: 13, bearing: 0});
                await idle();
                frames.length = 0;
                host.moveTo({center: [center[0] + 0.01, center[1] + 0.005], zoom: 13.6, bearing: 30, duration: 6000});
                await wait(6200);
                return median(frames);
            };
            const out = {few: await measure(1000), many: await measure(100000)};
            host.destroy();
            return out;
        });
        const ratio = ms.many / ms.few;
        check(`the script time of a frame with 100,000 icons from buffers is less than 5 times that with 1,000 icons (main thread)`, ratio < 5, JSON.stringify({...ms, ratio: +ratio.toFixed(2)}));
    } catch (e) { check('the comparison of the frame time with 100,000 and 1,000 icons was completed', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// The main-thread renderer sends its first tile requests to the tile workers before it compiles a shader (#390): in
// Safari, `compileShader` takes time on the page's thread, and the requests should not wait for it.
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        await page.goto(`${origin}/bench`);
        const order = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const seen = {loadsBeforeCompile: -1, loads: 0};
            const post = MessagePort.prototype.postMessage, compile = WebGL2RenderingContext.prototype.compileShader;
            MessagePort.prototype.postMessage = function (m, ...rest) { if (m?.type === 'load') seen.loads++; return post.call(this, m, ...rest); };
            WebGL2RenderingContext.prototype.compileShader = function (s) { if (seen.loadsBeforeCompile < 0) seen.loadsBeforeCompile = seen.loads; return compile.call(this, s); };
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const host = lib.createMap(el, {style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer: 'main', attribution: false});
            await new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 30000); });
            host.destroy(); el.remove();
            MessagePort.prototype.postMessage = post; WebGL2RenderingContext.prototype.compileShader = compile;
            return seen;
        });
        check('the main-thread renderer requests its first tiles before it compiles a shader', order.loadsBeforeCompile > 0, JSON.stringify(order));
    } catch (e) { check('the order of the first tile request and the shader compile was measured', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A canvas that adds noise to `getImageData` (Safari in private browsing, #427) must not change the heights: the
// library detects it and reads elevation tiles through WebGL. The page's renderer is used, so that the patch reaches it.
{
    const heights = async noisy => {
        const page = await browser.newPage({viewport: {width: 600, height: 400}});
        try {
            if (noisy) await page.addInitScript(() => {
                for (const C of [globalThis.CanvasRenderingContext2D, globalThis.OffscreenCanvasRenderingContext2D]) {
                    if (!C) continue;
                    const read = C.prototype.getImageData;
                    C.prototype.getImageData = function (...a) {
                        const d = read.apply(this, a);
                        for (let i = 0; i < d.data.length; i++) if (i % 4 !== 3) d.data[i] = Math.max(0, Math.min(255, d.data[i] + (Math.random() * 5 | 0) - 2));
                        return d;
                    };
                }
            });
            await page.goto(`${origin}/bench`);
            return await page.evaluate(async () => {
                const lib = await import('/dist/map-jr-gl.js');
                const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99'}));
                const host = lib.createMap(el, {style, initialView: {center: [7.6586, 45.9763], zoom: 10}, renderer: 'main', attribution: false});
                await new Promise(r => { const off = host.state.subscribe(s => s.loaded, v => { if (v) { off(); r(); } }); setTimeout(r, 30000); });
                const out = [];
                for (const at of [[7.6586, 45.9763], [7.70, 45.99], [7.62, 45.95]]) out.push(await host.queryElevation(at));
                host.destroy();
                return out;
            });
        } finally { await page.close(); }
    };
    try {
        const clean = await heights(false), noisy = await heights(true);
        check('a canvas that adds noise to getImageData does not change the heights of elevation tiles', clean.every(h => typeof h === 'number') && clean.join() === noisy.join(), JSON.stringify({clean, noisy}));
    } catch (e) { check('the heights with a noisy canvas were compared', false, String(e.message).split('\n')[0]); }
}
// A change after a pause reaches the screen (#429). WebKit did not show the one frame that a map drew after a pause, so
// the engine draws one more frame then. Two maps are on the page, as in the report. The count of renders checks this in
// every browser, and the picture checks it in WebKit.
for (const renderer of ['worker', 'main']) {
    const page = await browser.newPage({viewport: {width: 400, height: 300}});
    try {
        await page.goto(`${origin}/bench`);
        const renders = await page.evaluate(async renderer => {
            const lib = await import('/dist/map-jr-gl.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const style = color => ({version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': color}}]});
            const idle = h => new Promise(r => { const off = h.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 15000); });
            const box = left => document.body.appendChild(Object.assign(document.createElement('div'), {style: `position:fixed;left:${left}px;top:0;width:200px;height:150px;z-index:99`}));
            const first = lib.createMap(box(0), {style: style('#ff0000'), renderer, attribution: false});
            const second = lib.createMap(box(200), {style: style('#0000ff'), renderer, attribution: false});
            await Promise.all([idle(first), idle(second)]);
            await wait(1000);
            let n = 0;
            first.listen('render', () => n++);
            first.update({style: style('#00ff00'), renderer, attribution: false});
            await wait(1000);
            return n;
        }, renderer);
        let px = [];
        for (let i = 0; i < 20 && !(px[1] > 200 && px[0] < 50); i++) {
            const b64 = (await page.screenshot({clip: {x: 100, y: 75, width: 1, height: 1}})).toString('base64');
            px = await page.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : Object.assign(document.createElement('canvas'), {width: 1, height: 1})).getContext('2d'); c.drawImage(img, 0, 0); return [...c.getImageData(0, 0, 1, 1).data]; }, b64);
            if (!(px[1] > 200 && px[0] < 50)) await new Promise(r => setTimeout(r, 250));
        }
        check(`[${renderer}] a change of the style after a pause reaches the screen, with two maps on the page (#429)`, renders >= 2 && px[1] > 200 && px[0] < 50, JSON.stringify({renders, px}));
    } catch (e) { check(`[${renderer}] the change after a pause was checked`, false, String(e.message).split('\n')[0]); }
    finally { await page.close(); }
}
// The style sheet goes into the root node of the container (#47): a map in a shadow root has styled controls, also when
// its container is attached to the shadow root after the map is made. A page with `style-src 'nonce-x'` and the option
// `nonce: 'x'` has styled controls, with a constructed style sheet and with a `<style>` element (no adoptedStyleSheets).
{
    const styled = async ({csp, adopt = true, shadow}) => {
        const page = await browser.newPage({viewport: {width: 600, height: 400}});
        try {
            if (csp) await page.route(`${origin}/csp-page`, r => r.fulfill({contentType: 'text/html', headers: {'Content-Security-Policy': csp}, body: '<!doctype html><title>csp</title><body></body>'}));
            if (!adopt) await page.addInitScript(() => { delete Document.prototype.adoptedStyleSheets; delete ShadowRoot.prototype.adoptedStyleSheets; });
            await page.goto(csp ? `${origin}/csp-page` : `${origin}/bench`);
            return await page.evaluate(async ({shadow}) => {
                const lib = await import('/dist/map-jr-gl.js'), wait = ms => new Promise(r => setTimeout(r, ms));
                const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
                const box = () => Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'});
                const parent = () => { const h = document.body.appendChild(document.createElement('div')); return shadow ? h.attachShadow({mode: 'open'}) : h; };
                const look = (el, pin) => ({container: getComputedStyle(el).position, corner: getComputedStyle(el.querySelector('.map-jr-ctrl-bottom-right')).position, pin: pin && getComputedStyle(pin.querySelector('svg')).display});
                const el = parent().appendChild(box()), pin = el.appendChild(lib.defaultPin());
                const host = lib.createMap(el, {style, renderer: 'main', nonce: 'x'});
                const out = {first: look(el, pin)};
                if (shadow) {
                    // (A container that is not in a document when the map is made.)
                    const later = box(), second = lib.createMap(later, {style, renderer: 'main', nonce: 'x'});
                    parent().appendChild(later);
                    await wait(300);
                    out.later = look(later);
                    second.destroy();
                }
                host.destroy();
                return out;
            }, {shadow});
        } finally { await page.close(); }
    };
    const ok = l => l && l.container === 'relative' && l.corner === 'absolute' && (l.pin === undefined || l.pin === 'block');
    try {
        const r = await styled({shadow: true});
        check('a map in a shadow root has styled controls, also when its container is attached later (#47)', ok(r.first) && ok(r.later), JSON.stringify(r));
        const n = await styled({csp: "style-src 'nonce-x'"});
        check("a page with style-src 'nonce-x' has styled controls and a styled pin (#47)", ok(n.first), JSON.stringify(n));
        const e = await styled({csp: "style-src 'nonce-x'", adopt: false});
        check("a page with style-src 'nonce-x' and no adoptedStyleSheets has styled controls with nonce: 'x' (#47)", ok(e.first), JSON.stringify(e));
    } catch (e) { check('the style sheet in a shadow root and with a nonce was checked', false, String(e.message).split('\n')[0]); }
}
// #828: a map in an open shadow root. The focus moves into a popup that opens and returns to the map after Escape, from
// the close button and from a button in the content (#832), and the fullscreen control shows its state.
{
    const page = await browser.newPage({viewport: {width: 600, height: 400}});
    try {
        await page.goto(`${origin}/bench`);
        await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), {fullscreen} = await import('/dist/controls.js');
            const root = document.body.appendChild(document.createElement('div')).attachShadow({mode: 'open'});
            const el = root.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
            window.shadowMap = {root, host: lib.createMap(el, {style, renderer: 'main', controls: [fullscreen()]})};
            await new Promise(r => setTimeout(r, 500));
        });
        const focus = await page.evaluate(async () => {
            const {root, host} = window.shadowMap, wait = ms => new Promise(r => setTimeout(r, ms)), canvas = host._map.getCanvas();
            const key = el => el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, composed: true, cancelable: true}));
            const lngLat = host.state.get().view.center, out = {};
            for (const where of ['close', 'content']) {
                const content = document.createElement('div'), button = content.appendChild(document.createElement('button'));
                button.textContent = 'In the content';
                const popup = host.overlay(content, {lngLat, popup: true, onClose() { popup.remove(); }});
                await wait(300);
                const box = content.closest('.map-jr-popup');
                const target = where === 'close' ? box.querySelector('.map-jr-popup-close-button') ?? box.querySelector('button') : button;
                target.focus();
                key(target);
                await wait(500);
                out[where + 'Back'] = root.activeElement === canvas;
            }
            // (The focus moves into a popup that Enter on its marker opens. overlay() has no marker with a popup, so the
            // compat entry makes it, in the same shadow root.)
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js'), el = root.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const map = new compat.Map({container: el, style: {version: 8, sources: {}, layers: []}});
            await wait(300);
            const marker = new compat.Marker().setLngLat([0, 0]).setPopup(new compat.Popup().setHTML('<button>Inside</button>')).addTo(map);
            marker.getElement().focus();
            marker.getElement().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, composed: true, cancelable: true}));
            await wait(300);
            out.into = root.activeElement?.textContent === 'Inside';
            map.remove();
            return out;
        });
        check('[main] a map in a shadow root: the focus moves into a popup and returns to the map after Escape, from the close button and from the content (#828)',
            focus.into && focus.closeBack && focus.contentBack, JSON.stringify(focus));
        const pressed = () => page.evaluate(() => window.shadowMap.root.querySelector('.map-jr-ctrl-fullscreen').getAttribute('aria-pressed'));
        await page.click('.map-jr-ctrl-fullscreen');
        await page.waitForTimeout(500);
        const on = await pressed();
        await page.click('.map-jr-ctrl-fullscreen');
        await page.waitForTimeout(500);
        const off = await pressed();
        check('[main] a map in a shadow root: the fullscreen control shows its state (#828)', on === 'true' && off === 'false', JSON.stringify({on, off}));
        await page.evaluate(() => window.shadowMap.host.destroy());
    } catch (e) { check('a map in a shadow root was checked for focus and fullscreen (#828)', false, String(e.message).split('\n')[0]); }
    finally { await page.close(); }
}
// #1252: configure({tileWorkers}) after the tile workers exist has no effect, and the development build warns once (#2133).
{
    const page = await browser.newPage();
    try {
        await page.route(`${origin}/blank-page`, r => r.fulfill({contentType: 'text/html', body: '<!doctype html><title>blank</title><body></body>'}));
        await page.goto(`${origin}/blank-page`);
        const r = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.dev.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); };
            lib.configure({tileWorkers: 1});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const host = lib.createMap(el, {style: await (await fetch('/style.json')).json(), renderer: 'main', attribution: false});
            for (let i = 0; i < 200 && !host.state.get().loaded; i++) await wait(50);
            // (Another workerUrl makes a new pool for the next map, so its count is not ignored.)
            lib.configure({workerUrl: '/dist/map-jr-gl-worker.js?other', tileWorkers: 4});
            const other = warns.length;
            lib.configure({workerUrl: undefined, tileWorkers: 1});
            lib.configure({tileWorkers: 2});
            lib.configure({tileWorkers: 3});
            console.warn = warn;
            host.destroy();
            return {other, warns: warns.filter(w => w.startsWith('[map-jr-gl] E1630 configure(): tileWorkers'))};
        });
        check('configure({tileWorkers}) with another count while tile workers exist warns once, the same count does not warn, and a call with another workerUrl does not warn (#1252)', r.warns.length === 1 && r.other === 0, JSON.stringify(r));
    } finally { await page.close(); }
}
// A touch screen gets buttons of 44px, as docs/reference/css.md says for `--map-control-size`, in both entries (#639). (A blank
// page: /bench loads the CSS of MapLibre GL JS, which sets the size of the buttons itself.)
{
    const context = await browser.newContext({viewport: {width: 600, height: 400}, hasTouch: true, isMobile: true});
    const page = await context.newPage();
    try {
        await page.route(`${origin}/blank-page`, r => r.fulfill({contentType: 'text/html', body: '<!doctype html><title>blank</title><body></body>'}));
        await page.goto(`${origin}/blank-page`);
        const sizes = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js'), {navigation} = await import('/dist/controls.js'), compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const wait = ms => new Promise(r => setTimeout(r, ms)), style = {version: 8, sources: {}, layers: []};
            const box = () => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const size = b => b && `${getComputedStyle(b).width} ${getComputedStyle(b).height}`;
            const el = box(), host = lib.createMap(el, {style, renderer: 'main', controls: [navigation()]});
            let b = null;
            for (let i = 0; i < 50 && !(b = el.querySelector('.map-jr-ctrl-zoom-in')); i++) await wait(50);
            const out = {coarse: matchMedia('(pointer: coarse)').matches, main: size(b)};
            host.destroy();
            const el2 = box(), m = new compat.Map({container: el2, attributionControl: false, center: [0, 0], zoom: 1, style});
            m.addControl(new compat.NavigationControl());
            out.compat = size(el2.querySelector('.map-jr-ctrl-zoom-in'));
            m.remove();
            return out;
        });
        check('a touch screen gets buttons of 44px in both entries (#639)', sizes.coarse && sizes.main === '44px 44px' && sizes.compat === '44px 44px', JSON.stringify(sizes));
    } catch (e) { check('the size of the buttons on a touch screen was checked', false, String(e.message).split('\n')[0]); }
    finally { await context.close(); }
}
// circle-pitch-alignment and circle-pitch-scale (#567). One circle of radius 20 is behind the centre of a map with a
// pitch of 60 degrees, where the map is drawn at about 0.8 of its size at the centre. The size of the dark box on the
// screen says how the circle is drawn.
if ((only ?? 'main') === 'main') {
    const page = await browser.newPage({viewport: {width: 400, height: 300}});
    try {
        await page.goto(`${origin}/bench`);
        await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:99'}));
            const spec = paint => ({style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]},
                data: {pts: {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0.0824]}}]}},
                layers: [{id: 'dot', type: 'circle', source: 'pts', paint: {'circle-radius': 20, 'circle-color': '#000', ...paint}}],
                initialView: {center: [0, 0], zoom: 10, pitch: 60}, renderer: 'main', attribution: false});
            const host = lib.createMap(el, spec({}));
            window.circle = async paint => { host.update(spec(paint)); await new Promise(r => setTimeout(r, 600)); };
            await new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 15000); });
        });
        const box = async paint => {
            await page.evaluate(paint => window.circle(paint), paint);
            const b64 = (await page.screenshot({clip: {x: 0, y: 0, width: 400, height: 300}})).toString('base64');
            return page.evaluate(async b64 => {
                const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
                const c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(400, 300) : Object.assign(document.createElement('canvas'), {width: 400, height: 300})).getContext('2d'); c.drawImage(img, 0, 0, 400, 300);
                const d = c.getImageData(0, 0, 400, 300).data;
                let x0 = 400, x1 = -1, y0 = 300, y1 = -1;
                for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4] < 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
                return [x1 - x0 + 1, y1 - y0 + 1];
            }, b64);
        };
        const near = (v, to) => Math.abs(v - to) <= 2.5;
        const usual = await box({}), viewport = await box({'circle-pitch-scale': 'viewport'});
        const flat = await box({'circle-pitch-alignment': 'map'}), flatViewport = await box({'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'viewport'});
        check('a circle behind the centre of a pitched map is smaller, and circle-pitch-scale: viewport keeps its size (#567)',
            near(usual[0], 32.5) && near(usual[1], 32.5) && near(viewport[0], 40) && near(viewport[1], 40), JSON.stringify({usual, viewport}));
        check('circle-pitch-alignment: map draws the circle on the map, with either circle-pitch-scale (#567)',
            near(flat[0], 32.5) && flat[1] < flat[0] * 0.6 && flat[1] > 5 && near(flatViewport[0], 40) && flatViewport[1] < flatViewport[0] * 0.6 && flatViewport[1] > 5, JSON.stringify({flat, flatViewport}));
    } catch (e) { check('circle-pitch-alignment and circle-pitch-scale were checked', false, String(e.message).split('\n')[0]); }
    finally { await page.close(); }
}
// circle-pitch-alignment: map on the globe (#1825). As in MapLibre GL JS, the circle lies in the plane that touches the
// sphere at its center, and its radius is an angle (60 px at zoom 1 is 21 degrees). A circle at latitude 45 is then
// 98 x 59 px in this view (measured). Offset in Mercator units, as before the fix, it was 110 x 69 px: it reached
// farther toward the pole and along the parallel, toward the edge of the globe.
if ((only ?? 'main') === 'main') {
    const page = await browser.newPage({viewport: {width: 400, height: 400}});
    try {
        await page.goto(`${origin}/bench`);
        await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:400px;z-index:99'}));
            const host = lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]},
                data: {pts: {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 45]}}]}},
                layers: [{id: 'dot', type: 'circle', source: 'pts', paint: {'circle-radius': 60, 'circle-color': '#f00', 'circle-pitch-alignment': 'map'}}],
                projection: {type: 'globe'}, initialView: {center: [0, 0], zoom: 1}, renderer: 'main', attribution: false});
            await new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 15000); });
        });
        const b64 = (await page.screenshot({clip: {x: 0, y: 0, width: 400, height: 400}})).toString('base64');
        const size = await page.evaluate(async b64 => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = Object.assign(document.createElement('canvas'), {width: 400, height: 400}).getContext('2d'); c.drawImage(img, 0, 0);
            const d = c.getImageData(0, 0, 400, 400).data;
            let x0 = 400, x1 = -1, y0 = 400, y1 = -1;
            for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4] > 192 && d[(y * 400 + x) * 4 + 1] < 64) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
            return [x1 - x0 + 1, y1 - y0 + 1];
        }, b64);
        check('circle-pitch-alignment: map on the globe lies flat on the sphere and is foreshortened toward the edge (#1825)',
            Math.abs(size[0] - 98) <= 4 && Math.abs(size[1] - 59) <= 4, JSON.stringify(size));
    } catch (e) { check('circle-pitch-alignment: map on the globe was checked', false, String(e.message).split('\n')[0]); }
    finally { await page.close(); }
}
// A text-font stack without glyphs is a CSS family list (#927): each name is tried in order before fontFamily, and a
// generic family keyword stays unquoted. A label of narrow letters is about twice as wide in monospace as in a
// proportional font, so the width of the dark pixels says which font drew it. With the stack, the two missing names
// are skipped and the third, "monospace", draws. Before the fix only the first name was used, and it was quoted.
for (const renderer of renderers) {
    const page = await browser.newPage({viewport: {width: 400, height: 300}});
    try {
        await page.goto(`${origin}/bench`);
        await page.evaluate(async renderer => {
            const lib = await import('/dist/map-jr-gl.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:99'}));
            const spec = font => ({style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]},
                data: {pts: {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]}},
                layers: [{id: 'l', type: 'symbol', source: 'pts', layout: {'text-field': 'iiiiiiiiiiii', 'text-font': font, 'text-size': 20}, paint: {'text-color': '#000'}}],
                initialView: {center: [0, 0], zoom: 2}, renderer, attribution: false, fontFamily: 'sans-serif'});
            const host = lib.createMap(el, spec(['No Such Font A']));
            const idle = () => new Promise(r => { const off = host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 15000); });
            window.label = async font => { host.update(spec(font)); await new Promise(r => setTimeout(r, 300)); await idle(); await new Promise(r => setTimeout(r, 300)); };
        }, renderer);
        const width = async font => {
            await page.evaluate(font => window.label(font), font);
            const b64 = (await page.screenshot({clip: {x: 0, y: 0, width: 400, height: 300}})).toString('base64');
            return page.evaluate(async b64 => {
                const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
                const c = Object.assign(document.createElement('canvas'), {width: 400, height: 300}).getContext('2d'); c.drawImage(img, 0, 0, 400, 300);
                const d = c.getImageData(0, 0, 400, 300).data;
                let x0 = 400, x1 = -1;
                for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) if (d[(y * 400 + x) * 4] < 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
                return x1 - x0 + 1;
            }, b64);
        };
        const sans = await width(['No Such Font A']), mono = await width(['monospace']), stack = await width(['No Such Font A', 'No Such Font B Bold', 'monospace']);
        check(`[${renderer}] text-font: an unquoted generic family and the later names of a stack are used before fontFamily (#927)`,
            sans > 10 && mono > sans * 1.5 && Math.abs(stack - mono) <= 3, JSON.stringify({sans, mono, stack}));
    } catch (e) { check(`[${renderer}] the text-font stack was checked`, false, String(e.message).split('\n')[0]); }
    finally { await page.close(); }
}
// (Chromium on 2026-11-19 printed 158 results with RENDERER=main and 94 with RENDERER=worker.)
tally((renderers.includes('main') ? 147 : 0) + (renderers.includes('worker') ? 86 : 0));
await browser.close();
process.exit(failed ? 1 : 0);
