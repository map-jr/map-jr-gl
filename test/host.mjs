// Tests of the main API (`createMap`, see src/host.ts) in a real browser: node test/host.mjs (demo server running)
import {launch, browserName} from './launch.mjs';
import {watchdog} from './watchdog.mjs';
import {crc32, deflateSync} from 'node:zlib';

const browser = await launch();
const origin = `http://localhost:${process.env.PORT || 8080}`; // (the demo server; PORT lets two runs use two servers)
let failed = 0;
/** A PNG of `size` by `size` pixels in one colour ([r, g, b]). */
const solidPNG = (size, [r, g, b]) => {
    const chunk = (type, data) => { const len = Buffer.alloc(4), crc = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]); len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body)); return Buffer.concat([len, body, crc]); };
    const head = Buffer.alloc(13); head.writeUInt32BE(size, 0); head.writeUInt32BE(size, 4); head[8] = 8; head[9] = 2;
    const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).map((_, i) => [r, g, b][i % 3])]);
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.concat(Array(size).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
};
// TIMINGS=1 prints, before each check, the seconds since the previous check (to find the slow ones).
let lastCheck = performance.now();
const check = (name, ok, detail = '') => {
    const s = process.env.TIMINGS ? `[${((performance.now() - lastCheck) / 1000).toFixed(1)} s] ` : '';
    lastCheck = performance.now();
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${name} ${detail}`); if (!ok) failed++;
    finished(name);
};
const finished = watchdog(browser, message => { console.log(`FAIL  ${message}`); failed++; });
// A check that cannot run in this browser prints SKIP with the reason; it is neither passed nor failed.
const skip = (name, reason) => { console.log(`SKIP  ${name} (${reason})`); finished(name); };
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
            const reported = t.views.length, last = t.views.at(-1), old = t.views[Math.max(0, t.views.length - 4)];
            t.host.update(t.spec = {...t.spec, view: old}); // an application that owns the view gives back an older report
            await wait(300);
            const afterEcho = t.host.state.get().view.zoom;
            t.host.update(t.spec = {...t.spec, view: {center: [-74.0, 40.71], zoom: 13.5, bearing: 20, pitch: 0}});
            for (let i = 0; i < 80 && t.host.state.get().view.zoom !== 13.5; i++) await wait(100); // (a slow machine)
            await wait(300);
            const s = t.host.state.get().view;
            return {reported, last: last?.zoom, afterEcho, moved: [s.zoom, s.bearing, +s.center[0].toFixed(3)], zoomEvents: t.seen.filter(x => x === 'zoom').length};
        });
        check(`[${renderer}] the view: changes are reported, a reported view is not applied again, a new view moves the map`,
            view.reported >= 2 && view.last === 15 && view.afterEcho === 15 && view.moved.join() === '13.5,20,-74' && view.zoomEvents >= 2, JSON.stringify(view));

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
            await wait(200);
            for (let i = 0; i < 100 && t.host.state.get().moving; i++) await wait(100);
            off();
            const end = t.host.state.get().view;
            t.host.moveTo({center: start.center, zoom: start.zoom});
            return {low, start: start.zoom, end: [+end.center[0].toFixed(3), end.zoom]};
        });
        check(`[${renderer}] moveTo with fly zooms out on the way and ends at the view (#43)`,
            fly.low < fly.start - 0.5 && fly.end[0] === -73.9 && fly.end[1] === fly.start, JSON.stringify(fly));

        // 2b. Padding per side (#212): fitBounds and moveTo with bounds take {top, right, bottom, left} for the fit, and
        // the description has the padding of the map. moveTo leaves the padding of the map as the description gave it (#501).
        const padding = await page.evaluate(async () => {
            const t = window.t, m = t.host._map, b = [[-74.02, 40.70], [-74.00, 40.72]], mid = [-74.01, 40.71];
            const wait = ms => new Promise(r => setTimeout(r, ms));
            const at = () => { const p = m.project(mid); return [Math.round(p.x), Math.round(p.y)]; };
            const warned = [], warn = console.warn;
            console.warn = (...a) => warned.push(a.join(' '));
            t.host.fitBounds(b, {padding: {left: 400, top: 10, right: 10, bottom: 10}, duration: 0});
            const fit = at();
            t.host.moveTo({center: mid, padding: {left: 300}});
            const ignored = at();
            await wait(300);
            t.host.update({...t.spec, padding: {right: 300}});
            const spec = at();
            t.host.moveTo({bounds: b, padding: {left: 400, top: 10, right: 10, bottom: 10}, bearing: 20, pitch: 30});
            await wait(300);
            const v = t.host.state.get().view, bounds = {bearing: Math.round(v.bearing), pitch: Math.round(v.pitch)};
            t.host.moveTo({center: mid, bearing: 0, pitch: 0});
            const kept = at();
            t.host.update({...t.spec, padding: {right: 300}});
            const same = at();
            t.host.moveTo({bounds: b, padding: 20, fly: true, duration: 300});
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
            return {fit, ignored, spec, bounds, kept, same, flown, cleared: at(), detached, warned: warned.filter(w => w.includes('moveTo()')).length};
        });
        // (The page is 900 × 600: the centre of the rest of the map is at x = 400 + 245 = 645, 450 with no padding, 300 with
        // the padding {right: 300} of the description, and with both 400 + (900 - 400 - 300 - 10 - 10) / 2 ... = 300 for the fly.)
        check(`[${renderer}] padding per side: fitBounds takes {top, right, bottom, left}, and padding of the description moves the centre`,
            Math.abs(padding.fit[0] - 645) <= 2 && padding.spec[0] === 300 && padding.cleared[0] === 450, JSON.stringify(padding));
        check(`[${renderer}] moveTo leaves the padding of the map as the description gave it, and padding without bounds warns once (#501)`,
            padding.ignored[0] === 450 && padding.ignored[1] === 300 && padding.kept[0] === 300 && padding.same[0] === 300 && padding.warned === 1, JSON.stringify(padding));
        check(`[${renderer}] moveTo with bounds fits the box with its padding, with bearing and pitch, and with fly, and a destructured fitBounds works (#501)`,
            padding.bounds.bearing === 20 && padding.bounds.pitch === 30 && Math.abs(padding.flown[0] - 300) <= 2 && Math.abs(padding.flown[1] - 300) <= 2 && padding.detached === 'ok', JSON.stringify(padding));

        // 3. A new style object: a layer is added and found by a query; with the old style again it is gone.
        const style = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const idle = () => new Promise(r => { let at = t.host.state.get().idle ? performance.now() : 0; const off = t.host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const at = [{x: 0, y: 0}, {x: 900, y: 600}];
            const added = {...t.style, layers: [...t.style.layers, {id: 'test-water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': '#f00'}}]};
            t.host.update(t.spec = {...t.spec, style: added});
            await wait(200); await idle();
            const withLayer = (await t.host.queryFeatures(at, {layers: ['test-water']})).length;
            t.host.update(t.spec = {...t.spec, style: t.style});
            await wait(200); await idle();
            const without = (await t.host.queryFeatures(at, {layers: ['test-water']})).length;
            const raw = (await t.host.querySource('omt', {x: 450, y: 300}, {radius: 30})).length;
            return {withLayer, without, raw};
        });
        check(`[${renderer}] update with a new style: a layer comes and goes, and queries find features`, style.withLayer > 0 && style.without === 0 && style.raw > 0, JSON.stringify(style));

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

        // A new height of the ground under the camera is not a movement (#436). 3D terrain that is switched on gives the
        // camera its height when the elevation data comes: the map is idle then, and not 200 to 400 ms later. The
        // elevation tiles are one picture in the page (1000 m everywhere), so no network decides the time. The shortest
        // of three tries is read.
        // Elevation tiles are decoded in the tile workers, which needs OffscreenCanvas there (#778).
        const decodes = await page.evaluate(() => new Promise(resolve => {
            const w = new Worker(URL.createObjectURL(new Blob(['postMessage(typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined")'])));
            w.onmessage = e => { resolve(e.data); w.terminate(); }; w.onerror = () => resolve(false);
        }));
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
        if (renderer === 'worker') {
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
            host.destroy(); el.remove();
            return out;
        }, renderer).catch(e => ({error: String(e)}));
        check(`[${renderer}] patch keeps the other fields, undefined removes a field, and description is the last description`,
            JSON.stringify(patched) === JSON.stringify({first: true, kept: ['crosshair', 10, 2, 10, 2, 'crosshair'], removed: [false, false, 2, 22, ''], style: '[map-jr-gl] patch(): the description has no "style". Do not set "style" to undefined.', styleKept: true}), JSON.stringify(patched));

        // 3c. Mistakes and errors: a container that is not there has a message; `onError`
        // gets each error; without it the error is written to the console.
        const mistakes = await page.evaluate(async () => {
            const t = window.t, said = fn => { try { fn(); return ''; } catch (e) { return e.message; } }, wait = ms => new Promise(r => setTimeout(r, ms));
            const out = {noId: said(() => t.lib.createMap('nope', {style: t.style})), isNull: said(() => t.lib.createMap(null, {style: t.style}))};
            const el = document.body.appendChild(document.createElement('div'));
            out.left = el.childElementCount;
            const logged = [], log = console.error;
            console.error = (...a) => logged.push(a.map(x => x?.message ?? String(x)).join(' '));
            const got = [], withHook = t.lib.createMap(el, {style: '/no-such-style.json', attribution: false, onError: e => got.push(e.message)});
            await wait(1200);
            out.hook = got.join(); out.loggedWithHook = logged.length;
            withHook.destroy();
            const without = t.lib.createMap(el, {style: '/no-such-style.json', attribution: false});
            await wait(1200);
            out.logged = logged.join();
            without.destroy(); el.remove(); console.error = log;
            return out;
        });
        check(`[${renderer}] mistakes have a message: a container that is not there`,
            mistakes.noId === '[map-jr-gl] createMap(): no element with the id "nope".' && mistakes.isNull.startsWith('[map-jr-gl] createMap(): the container is null.') && mistakes.left === 0, JSON.stringify(mistakes));
        check(`[${renderer}] onError gets each error, and without it the error is written to the console`,
            /HTTP 404/.test(mistakes.hook) && mistakes.loggedWithHook === 0 && /^\[map-jr-gl\] .*HTTP 404/.test(mistakes.logged), JSON.stringify(mistakes));

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
            // A line of 2 pixels through the centre of the map, from west to east. The questions are 6 pixels below it.
            const line = {type: 'Feature', properties: {name: 'line'}, geometry: {type: 'LineString', coordinates: [[-74.02, 40.7085], [-73.99, 40.7085]]}};
            const host = t.lib.createMap(el, {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false,
                sources: {own: {type: 'geojson', data: line}}, layers: [{id: 'own-line', type: 'line', source: 'own', paint: {'line-width': 2}}]});
            await new Promise(r => { let at = host.state.get().idle ? performance.now() : 0; const off = host.state.subscribe(s => s.idle, v => { at = v ? performance.now() : 0; }), done = () => { clearInterval(timer); off(); r(); }, timer = setInterval(() => at && performance.now() - at > 500 && done(), 50); setTimeout(done, 8000); });
            const at = {x: 100, y: 81}, below = host.unproject(at), count = async (place, o) => (await host.queryFeatures(place, o)).length;
            const out = {on: await count({x: 100, y: 75}, {layers: ['own-line']}), none: await count(at, {layers: ['own-line']}), small: await count(at, {layers: ['own-line'], radius: 2}), point: await count(at, {layers: ['own-line'], radius: 8}),
                position: await count(below, {layers: ['own-line'], radius: 8}), data: (await host.querySource('own', at, {radius: 8})).length, dataDefault: (await host.querySource('own', at)).length,
                layer: (await host.queryFeatures(at, {layers: ['own-line'], radius: 8}))[0]?.layer?.id};
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
            host.destroy(); el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] queryFeatures and querySource give the string id of a GeoJSON feature and the number for a string of digits, and setFeatureState takes a string id (#528)`,
            textId.square.join('|') === '"square-a"|"square-a"|"square-a"|"square-a"' && textId.places.join('|') === '"louvre",12|"louvre",12' && textId.colour === 'red' && textId.state?.on === true, JSON.stringify(textId));
        check(`[${renderer}] queryFeatures: radius widens a query for drawn features, and its default is 0 there and 3 in querySource`,
            radius.on === 1 && radius.none === 0 && radius.small === 0 && radius.point === 1 && radius.position === 1 && radius.data === 1 && radius.dataDefault === 0 && radius.layer === 'own-line', JSON.stringify(radius));

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
            const b = await Promise.race([host.toBlob(), new Promise(r => setTimeout(() => r(null), 10000))]);
            if (!b) { host.destroy(); el.remove(); return {timeout: true}; }
            const bmp = await createImageBitmap(b), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
            g.drawImage(bmp, 0, 0);
            const px = (x, y) => Array.from(g.getImageData(Math.round(x * bmp.width), Math.round(y * bmp.height), 1, 1).data);
            const jpeg = await host.toBlob('image/jpeg', 0.8);
            const later = host.toBlob(); host.destroy(); el.remove();
            const rejected = await later.then(() => 'resolved', e => e.message);
            return {type: b.type, w: bmp.width, centre: px(0.5, 0.5), corner: px(0.02, 0.02), jpeg: jpeg.type, rejected};
        }, renderer);
        check(`[${renderer}] toBlob gives the drawn map as an image, and rejects after destroy (#44)`,
            blob.type === 'image/png' && blob.w >= 200 && blob.centre[2] > 200 && blob.centre[0] < 50 && blob.corner[0] > 200 && blob.corner[2] < 50 && blob.jpeg === 'image/jpeg' && /toBlob\(\): the map was removed/.test(blob.rejected), JSON.stringify(blob));

        // 3d. `initialView` takes bounds with padding, and `state.view.bounds` follows moves and a new size (#266).
        const viewBounds = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const host = t.lib.createMap(el, {style: {version: 8, sources: {}, layers: []}, initialView: {bounds: [[-10, -5], [10, 5]], padding: 20}, renderer, attribution: false});
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
            check(`[${renderer}] initialView with bounds and padding fits the box, and state.view.bounds is the visible box`,
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
            madeData.first === 1 && madeData.added === 1 && madeData.restyled + '' === '1,1' && madeData.removed && madeData.errors.length === 1 && madeData.errors[0].startsWith('[map-jr-gl] data: the source ')
            && madeData.said.length === 1 && madeData.said[0].startsWith('[map-jr-gl] the layer "b-fill" uses the source "b"'), JSON.stringify(madeData));

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
            console.warn = (...a) => said.push(a.join(' '));
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
        const expected = ['createMap(): the container has height 0', 'interactiveLayers: the style has no layer "nope"', 'queryFeatures(): the style has no layer "nope"',
            'querySource(): the style has no source "nope"', 'layers: the layer "lost" has before: "nonexistent"', 'layers: the layer "lost" uses the source "missing"', 'images: a layer gives the parameter "colour" to the image "dot"', 'images: a layer gives the parameter "size" to the image "dot"', 'images: a layer gives the parameter "fill" to the image "dot"',
            'update(): "interactive" changed', 'update(): "initialView" changed', 'queryFeatures(): "sourceLayers" is not an option', 'queryFeatures(): "sources" is not an option', 'queryFeatures(): "radius" has an effect only in a query at a point or a position',
            'querySource(): "radius" has an effect only', 'querySource(): "geometry" has an effect only', 'querySource(): "zoom" has an effect only', 'querySource(): "layers" is not an option'];
        check(`[${renderer}] common mistakes: each gives one warning, a wrong place of a query is refused with a message, and a correct description gives no warning`,
            warnings.correct.length === 0 && warnings.said.length === expected.length && expected.every(e => warnings.said.filter(w => w.startsWith('[map-jr-gl] ' + e)).length === 1)
            && warnings.place.startsWith('[map-jr-gl] queryFeatures(): {"lng":-74.0065,"lat":40.7085} is not a place.'), JSON.stringify(warnings));

        // 3f. A style whose root names a projection that the library does not draw: one warning per map, also after setStyle;
        // mercator gives none (#238). The globe gives none for itself (#463), and one for buildings, which it does not draw yet.
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
            return {mercSaid, otherSaid, globeSaid: said, buildings: t.style.layers.some(l => l.type === 'fill-extrusion')};
        }, renderer);
        check(`[${renderer}] a style with the projection "identity" writes one warning, "mercator" none, and "globe" one for its buildings only`,
            proj.mercSaid === 0 && proj.otherSaid.length === 1 && proj.otherSaid[0] === '[map-jr-gl] The style has the projection "identity", which is not supported, so the map uses "mercator".'
            && proj.globeSaid.length === (proj.buildings ? 1 : 0) && proj.globeSaid.every(w => w.includes('"fill-extrusion" are not drawn on the globe')), JSON.stringify(proj));

        // 3b. A description with no style (only the changed fields) throws at once with a message, and the map is not harmed.
        const partial = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), said = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
            const update = said(() => t.host.update({cursor: 'crosshair'})), none = said(() => t.host.update(undefined));
            const create = said(() => t.lib.createMap(document.createElement('div'), {initialView: {zoom: 2}}));
            await wait(500);
            return {update, none, create, drawn: (await t.host.queryFeatures([{x: 0, y: 0}, {x: 900, y: 600}])).length};
        });
        check(`[${renderer}] a description with no style: update and createMap throw and say what to write, and the map still draws`,
            partial.update.startsWith('[map-jr-gl] update(): the description has no "style".') && partial.update.includes('map.patch({cursor: ') && partial.none.startsWith('[map-jr-gl] update()')
            && partial.create.startsWith('[map-jr-gl] createMap(): the description has no "style".') && partial.drawn > 0 && !errors.length, JSON.stringify({...partial, errors}));

        // 4. Points for a symbol layer (#499): a key of `data` with `points()` and a layer of `layers`. New data is no new
        // style, and data that comes with a change of the layer is not lost.
        const pins = await page.evaluate(async () => {
            const t = window.t, map = t.host._map, wait = ms => new Promise(r => setTimeout(r, ms)), at = () => t.host.queryFeatures({x: 450, y: 300}, {layers: ['pins']});
            const centre = t.host.unproject({x: 450, y: 300}), points = list => t.lib.points(list, {lngLat: p => p.lngLat, id: p => p.id, properties: p => ({color: p.color})});
            const layer = layout => ({id: 'pins', type: 'symbol', source: 'pins', layout: {'icon-image': 'disc', 'icon-allow-overlap': true, 'icon-ignore-placement': true, ...layout}});
            t.host.update(t.spec = {...t.spec, images: {disc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>'}, data: {...t.spec.data, pins: points([{id: 1, lngLat: centre, color: '#d00'}])}, layers: [...t.spec.layers ?? [], layer()]});
            await wait(900);
            const one = await at(), top = map.getStyle().layers.at(-1).id;
            // Other data: the points move, and the style is the same.
            let restyled = 0;
            const count = () => restyled++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, data: {...t.spec.data, pins: points([{id: 1, lngLat: [centre[0] + 1, centre[1]], color: '#d00'}])}});
            await wait(700);
            const moved = (await at()).length;
            t.host.update(t.spec = {...t.spec, data: {...t.spec.data, pins: points([{id: 1, lngLat: [0, 0]}, {id: 2, lngLat: centre, color: '#00d'}])}});
            await wait(700);
            const back = await at(), sameStyle = restyled === 0;
            map.off('style.load', count);
            // Another layout and other data at once: the source gets the data.
            t.host.update(t.spec = {...t.spec, layers: [...t.spec.layers.filter(l => l.id !== 'pins'), layer({'icon-anchor': 'top'})]});
            t.host.update(t.spec = {...t.spec, data: {...t.spec.data, pins: points([{id: 3, lngLat: centre, color: '#0a0'}])}});
            await wait(1200);
            const late = await t.host.queryFeatures({x: 450, y: 310}, {layers: ['pins']});
            const {images: _, ...rest} = t.spec, {pins: __, ...data} = rest.data;
            t.host.update(t.spec = {...rest, data, layers: rest.layers.filter(l => l.id !== 'pins')});
            await wait(700);
            return {one: one.length, id: one[0]?.id, top, moved, back: back.length, index: back[0]?.id, color: back[0]?.properties.color, sameStyle,
                late: late.map(f => f.id + ' ' + f.properties.color).join(), none: !map.getLayer('pins') && !map.getSource('pins')};
        });
        check(`[${renderer}] points() in data and a symbol layer in layers: the points are features with their ids, new data is no new style, and data that comes with a change of the layer is not lost`,
            pins.one === 1 && pins.id === 1 && pins.top === 'pins' && pins.moved === 0 && pins.back === 1 && pins.index === 2 && pins.color === '#00d' && pins.sameStyle
            && pins.late === '3 #0a0' && pins.none, JSON.stringify(pins));

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
            first === '#f0f' && again === 0 && replaced === '#0ff' && last === '#00f' && stays && !gone.has && !late && !after.includes('#00f') && gone.errors.length === 1 && gone.errors[0].startsWith('[map-jr-gl] images: the image "lost" did not load.'),
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
            && styleGone.errors.some(e => e.startsWith('[map-jr-gl] the style: the image "outside"')) && styleGone.errors.some(e => e.startsWith('[map-jr-gl] the style: the image "far" did not load')),
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
            && !unsafe.includes('#f00') && many.length === 1 && many[0].startsWith('[map-jr-gl] The image "tiny" has more than 1000 different sets of values')
            && replaced30.full === 0 && replaced30.asked === 0 && replaced30.broken.length === 1 && replaced30.broken[0].startsWith('[map-jr-gl] The image "tile" cannot be drawn with the values of its slots'),
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
        }, [[flat, flatPlaced], [tilted, tiltedPlaced]]);
        // (Some pixels can differ: the two ways round the place of an icon at different points of the calculation.)
        check(`[${renderer}] icons from the buffers of the tiles are drawn as icons that are placed with the labels: on a flat map and on a turned and tilted map, with a size, a turn and an opacity for each feature`,
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
        // text is at the point of the icon. (While the map moves, the engine says how many labels it placed.)
        const avoided = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const placed = async (icon, text) => {
                t.host.update(t.spec = {...t.spec, style: t.spot({'icon-anchor': 'center', ...icon}, text)});
                await wait(300); await t.settle();
                t.placed.length = 0;
                t.host.moveTo({bearing: 20, duration: 1800}); await wait(2200);
                t.host.moveTo({bearing: 0}); await wait(300);
                return t.placed.splice(0).join();
            };
            const out = {avoid: await placed({}, 'below'), ignore: await placed({'icon-ignore-placement': true}, 'below'), above: await placed({}, 'above')};
            const {images: _, ...rest} = t.spec;
            t.host.update(t.spec = {...rest, style: t.style});
            return out;
        });
        check(`[${renderer}] a label of a layer below keeps away from an icon from a buffer, and not when the layer of the icon has icon-ignore-placement; a label of a layer above shows`,
            /^0(,0)*$/.test(avoided.avoid) && /^1(,1)*$/.test(avoided.ignore) && /^1(,1)*$/.test(avoided.above), JSON.stringify(avoided));
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

        // `locale` gives the texts of the controls, and a change adds the controls again with the new texts (#685).
        const locale = await page.evaluate(async () => {
            const t = window.t, {navigation} = await import('/dist/controls.js');
            const settle = () => new Promise(r => setTimeout(r, 50)), label = () => document.querySelector('#host .map-jr-ctrl-zoom-in')?.getAttribute('aria-label');
            t.host.update(t.spec = {...t.spec, controls: [navigation()], locale: {'NavigationControl.ZoomIn': 'Zoom avant'}});
            for (let i = 0; i < 40 && !label(); i++) await settle();
            const fr = label();
            t.host.update(t.spec = {...t.spec, locale: {'NavigationControl.ZoomIn': 'Hineinzoomen'}});
            await settle();
            const de = label();
            t.host.update(t.spec = {...t.spec, locale: undefined});
            await settle();
            const en = label();
            t.host.update(t.spec = {...t.spec, controls: undefined});
            await settle();
            return {fr, de, en};
        });
        check(`[${renderer}] locale sets the texts of the controls and follows the description`, locale.fr === 'Zoom avant' && locale.de === 'Hineinzoomen' && locale.en === 'Zoom in', JSON.stringify(locale));

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
            t.host.update(t.spec = {...t.spec, controls: undefined});
            await settle();
            return {inCorner, objIn, kept, gone: !el.isConnected && removed === 1 && !document.getElementById('own-obj')};
        });
        check(`[${renderer}] custom controls go into their corner and follow the description by key`, custom.inCorner && custom.objIn && custom.kept && custom.gone, JSON.stringify(custom));

        // 4b. An SVG image without a viewBox has the size of its width and height attributes (#175): a 9×9 image that
        // replaces a 40×40 one under the same name is drawn at 9×9 centred on its anchor, and the 40×40 one is not cropped.
        // (The blue box of each picture is read from a picture of the page; the anchor is at the centre, 450, 300.)
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
            const big = await seen('430,469,280,319');
            await page.evaluate(small => { const s = window.sized; s.host.update(s.spec = {...s.spec, images: {b: small}}); }, svg(9, '#00f'));
            const small = await seen('446,454,296,304');
            await page.evaluate(() => { window.sized.host.destroy(); document.getElementById('sized').remove(); });
            check(`[${renderer}] an SVG image without a viewBox has the size of its width and height: 40×40 is not cropped, and 9×9 after it is centred on its anchor`,
                big === '430,469,280,319' && small === '446,454,296,304', JSON.stringify({big, small}));
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
        const noId = await page.evaluate(() => { const t = window.t; console.warn = t.litLog; return t.litSaid.filter(w => w.startsWith('[map-jr-gl] hoverState: a feature of the layer "sq" has no id')).length; });
        await page.mouse.move(450, 300); await page.waitForTimeout(400);
        const litGone = await states();
        await page.evaluate(() => { window.t.litHost.destroy(); document.getElementById('lit').remove(); });
        check(`[${renderer}] hoverState gives the feature under the pointer the feature state hover, takes it away when the pointer leaves it, and warns once for a feature with no id`,
            onA[1] === true && onA[2] === false && onB[1] === false && onB[2] === true && litGone[1] === false && litGone[2] === false && noId === 1, JSON.stringify({onA, onB, litGone, noId}));
        // A click on an overlay does not call onClick (#198).
        await page.evaluate(() => { const t = window.t, el = Object.assign(document.createElement('div'), {style: 'width:20px;height:20px;background:#c00'}); t.ov = t.host.overlay(el, {lngLat: t.host.unproject({x: 200, y: 200})}); t.clicks.length = 0; });
        const ovBox = await page.evaluate(() => { const r = document.querySelector('.map-jr-marker').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
        await page.mouse.click(ovBox.x, ovBox.y); await page.waitForTimeout(500);
        const overlayClicks = await page.evaluate(() => { const t = window.t, n = t.clicks.length; t.ov.remove(); return n; });
        check(`[${renderer}] a click on an overlay does not call onClick`, overlayClicks === 0, JSON.stringify({overlayClicks}));
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
            return {focused, closes, gone, focus, plainOpen};
        });
        check(`[${renderer}] Escape closes a popup of overlay() that has onClose and holds the focus, the focus goes to the map, and a popup without onClose stays open`,
            escape.focused && escape.closes === 1 && escape.gone && escape.focus && escape.plainOpen, JSON.stringify(escape));
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
        const L2 = 'light/light/Use dark colours', D2 = 'dark/dark/Use light colours';
        const wantToggles = {
            none: `-/light/Use dark colours > ${D2} > ${L2} calls dark,light`,
            autoDark: `auto/dark/Use light colours > ${L2} > auto/dark/Use light colours calls light,auto`,
            autoLight: `auto/light/Use dark colours > ${D2} > auto/light/Use dark colours calls dark,auto`,
            fixedDark: `${D2} > ${L2} > ${D2} calls light,dark`,
        };
        check(`[${renderer}] the control colorScheme() flips light and dark, and from 'auto' sets the opposite of the system and then 'auto' again, with onColorSchemeChange and a label that names the action`,
            Object.keys(wantToggles).every(k => toggles[k] === wantToggles[k]), JSON.stringify(toggles));

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
            out.warned = [said.some(w => w.startsWith('[map-jr-gl] style: the pair has no "dark", so the map uses "light"')), said.some(w => w.startsWith('[map-jr-gl] style: the object is not a style'))].join();
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
            && clusters.ten === 10 && clusters.errors[3].startsWith('[map-jr-gl] clusterLeaves(): the third argument is 2. Pass {limit, offset}') && clusters.members.join() === 'false,true', JSON.stringify(clusters));

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
            h.destroy(); h.update(t.spec);
            const later = said(h.querySource(sources[0])), onceLater = said(h.once('idle'));
            const out = {canvas: !!document.querySelector('#host canvas'), waits: await waits, onceLater: await onceLater, pending: await pending, height: await height, later: await later};
            await new Promise(r => setTimeout(r, 300));
            return {...out, clicks, watched};
        });
        check(`[${renderer}] destroy removes the map`, !end.canvas);
        const gone = '[map-jr-gl] The query has no answer: the map was removed.';
        check(`[${renderer}] destroy rejects a once() that waits and a once() after it`,
            end.waits === '[map-jr-gl] once("dragend"): the map was removed.' && end.onceLater === '[map-jr-gl] once("idle"): the map was removed.', JSON.stringify(end));
        check(`[${renderer}] destroy rejects the queries that wait and a query after it, and onClick and a watchFeatures listener do not run after it`,
            end.pending === gone && end.height === gone && end.later === gone && end.clicks === 0 && end.watched === 0, JSON.stringify(end));
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
            got.length === 1 && got[0].startsWith('[map-jr-gl] the style: the code for the images') && !rejections.length, JSON.stringify({got, rejections}));
    } catch (e) { check('the test of a failed style-images file was completed', false, String(e.message).split('\n')[0]); }
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
        const said = /^\[map-jr-gl\] The style has no list "layers"/;
        for (const [name, r] of Object.entries(out.results)) {
            if (name === 'noSources') check(`[${renderer}] a style with no "sources" is drawn without an error`, r.first === '' && r.idle && r.second === '', JSON.stringify(r));
            else check(`[${renderer}] a style that is not a style (${name}): one error of the map that names "layers", and update() with a good style draws`,
                said.test(r.first) && !r.first.includes(' | ') && r.idle && said.test(r.second) && !r.second.includes(' | '), JSON.stringify(r));
        }
        check(`[${renderer}] a style that is not a style gives no error of the page`, !thrown.length && !out.unhandled.length, JSON.stringify({thrown, unhandled: out.unhandled}));
    } catch (e) { check(`[${renderer}] the test of a style that is not a style was completed`, false, String(e.message).split('\n')[0]); }
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
        const said = warnings.filter(w => w.startsWith('[map-jr-gl] The container already has a map.')).length, mark = warnings.indexOf('mark');
        check('a second map in one element gets a warning, and a map after destroy() does not', said === 1 && mark >= 0 && warnings.findIndex(w => w.startsWith('[map-jr-gl] The container already has a map.')) > mark && twice === 0, JSON.stringify({warnings, twice}));
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
        const mid = asked.length, removed = await run('removed'), stillAsked = asked.length > mid, warning = warned.length === 1 && warned[0].startsWith('[map-jr-gl] The description has "glyphs".');
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
        const failed = errors.some(m => m.includes('"Test Gone Regular"') && m.startsWith('[map-jr-gl] fonts:'));
        // (The squares of the font fill much more of the label than the letters of a font of the device.)
        check('fonts of the description: a font added in update() is fetched and the labels are drawn again with it; a font that does not load is an error with its name',
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
            await new Promise(r => host.state.subscribe(s => s.idle, v => v && r()));
            await new Promise(r => setTimeout(r, 1200));
            const drawn = (await host.queryFeatures(undefined, {radius: 5})).length;
            host.destroy(); el.remove(); console.warn = log;
            return {said, unhandled, place, drawn};
        }, file);
        lost.asked = asked.length;
        check(`${build}: the map draws with no warning, a wrong place of a query is refused with a short message, no rejection is unhandled, and ${file === 'map-jr-gl.js' ? 'the file of the checks is not requested' : 'the file of the checks was requested'}`,
            (file === 'map-jr-gl.js' ? asked.length === 0 : asked.length > 0) && lost.said.length === 0 && lost.drawn > 0 && lost.place === '[map-jr-gl] queryFeatures(): the place is not {x, y} or [lng, lat].' && !lost.unhandled.length, JSON.stringify(lost));
    } catch (e) { check(`${build}: the test run was completed`, false, String(e.message).split('\n')[0]); }
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
            const out = {supported, errors, ...state(), text: message()?.textContent, count: el.querySelectorAll('.map-jr-unavailable').length, children: message()?.childElementCount, covers: !!box && box.width === 900 && box.height === 600, unhandled};
            // (The message is the application's to change: a rule of its own style sheet wins over the rule of the library.)
            document.head.appendChild(Object.assign(document.createElement('style'), {textContent: '.map-jr-unavailable{display:none}'}));
            out.hidden = !!message() && getComputedStyle(message()).display === 'none';
            destroy();
            out.after = el.querySelectorAll('.map-jr-unavailable, canvas').length;
            console.warn = warn;
            return out;
        }, [entry, renderer]);
        const text = '[map-jr-gl] The map cannot be shown: WebGL2 is not available. Call supported() before you make a map, and show other content when it returns false.';
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
        const text = `[map-jr-gl] The worker file is version 0.0.1 and the page file is version ${version}. Serve map-jr-gl-worker.js from the same version of the package as the page file, or pass \`workerUrl\` with the URL of that file.`;
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
            const lib = await import('/dist/map-jr-gl.js'), {navigation} = await import('/dist/controls.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:400px'}));
            window.tapHost = lib.createMap(el, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, initialView: {center: [0, 0], zoom: 2}, controls: [navigation()], attribution: false});
            for (let i = 0; i < 50 && !el.querySelector('.map-jr-ctrl-zoom-in'); i++) await new Promise(r => setTimeout(r, 100));
        });
        const look = () => page.evaluate(() => { const e = document.querySelector('.map-jr-ctrl-zoom-in'); if (!e) return 'no button'; const s = getComputedStyle(e); return `${s.backgroundColor} ${s.outlineStyle} ${s.webkitTapHighlightColor}`; });
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
            for (let i = 1; i <= moves; i++) { const x = box.x - 500 * i / moves, y = box.y + 200 * (i / moves) ** 2; if (kind === 'touch') await touch('touchMove', x, y); else await page.mouse.move(x, y); }
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

// The `querySource` example of the gallery (site/examples/query.js and query.compat.js; the site must be built), with
// the usual number of tile workers.
for (const code of ['core', 'compat']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 800}});
    try {
        await page.goto(`${origin}/gallery/?code=${code}#query`);
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
        check(`gallery, query example (${code}): each of 10 clicks gets an answer within ${LIMIT / 1000} seconds, also after a jump and on the box of the answer`, !late.length && !!(await answerBox()), JSON.stringify({withoutAnswer: late, slowestMs: Math.max(...times)}));

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
        check(`gallery, query example (${code}): after two clicks, the answer of the last click is shown`, !!shown && !shown.includes('first-click'), JSON.stringify({shown: shown?.slice(0, 80)}));
    } catch (e) { check(`gallery, query example (${code}): the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// Tiles before they are in view (#361). (1) The tiles of the destination of an `easeTo` and of a `flyTo` are requested
// when it starts. The movement goes 0.3 degrees east at zoom 13 in 5 s: after 500 ms
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
        await page.waitForTimeout(500);
        // (Only tiles of the level of the view: a flyTo zooms out, and its coarser tiles cover the destination early.)
        const zView = Math.max(...p.asked.slice(0, before).map(t => t[0]));
        const early = p.asked.slice(before).filter(([z, x]) => z === zView && Math.abs(x - tileOf(east, z)) <= 1);
        check(`prefetch: the tiles at the destination of ${method} are requested at its start`, early.length > 0, JSON.stringify({early: early.length, after: p.asked.length - before}));
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
// A touch screen gets buttons of 44px, as docs/api.md says for `--map-control-size`, in both entries (#639). (A blank
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
await browser.close();
process.exit(failed ? 1 : 0);
