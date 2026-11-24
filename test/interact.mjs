// Drives the demo in Chromium and checks behaviour in both renderer modes: node test/interact.mjs [outDir] (default .cache/shots)
import {launch, browserName, workerRenders, noWorkerRender} from './launch.mjs';
import {watchdog} from './watchdog.mjs';
import {guard} from './suite-guard.mjs';
import {checkCustomLayers} from './custom-layers.mjs';
import {solidPNG} from './png.mjs';
const out = process.argv[2] || '.cache/shots'; // (the directory for the screenshots; Playwright creates it)
const browser = await launch();
const origin = `http://localhost:${process.env.PORT || 8080}`; // (the demo server; PORT lets two runs use two servers)
let failed = 0, mainFrames = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; counted(); finished(name); };
const finished = watchdog(browser, message => { console.log(`FAIL  ${message}`); failed++; });
const {counted, tally} = guard(message => { console.log(`FAIL  ${message}`); failed++; });
// A check that cannot run in this browser prints SKIP with the reason; it is neither passed nor failed.
const skip = (name, reason) => { console.log(`SKIP  ${name} (${reason})`); counted(); finished(name); };
const noCDP = `${browserName} has no CDP session for touch events`;
// The map is settled when it does not move and the camera has been the same for a quarter of a second. (A browser
// can report that the mouse was released before the page has handled the events, so `isMoving()` alone can be
// false before a drag and its inertia have started.)
const settle = (page) => page.waitForFunction(() => {
    const m = window.map, c = m.getCenter(), pose = [c.lng, c.lat, m.getZoom(), m.getBearing(), m.getPitch(), m.isMoving()].join();
    if (pose !== window.settlePose) { window.settlePose = pose; window.settleAt = performance.now(); }
    return !m.isMoving() && performance.now() - window.settleAt > 250;
}, null, {polling: 50});
const idle = (page) => page.waitForFunction(() => window.map.areTilesLoaded() && !window.map.isMoving(), null, {polling: 50, timeout: 30000});

// RENDERER=main or RENDERER=worker runs the checks of one renderer, and CI runs each in its own job (#519). The checks
// after the loop run with RENDERER=main. Without the variable the suite runs everything.
const only = process.env.RENDERER;
if (only && only !== 'main' && only !== 'worker') { console.log(`FAIL  RENDERER is "${only}". Write RENDERER=main or RENDERER=worker, or leave it out.`); process.exit(1); }
const renderers = only ? [only] : ['main', 'worker'];
for (const mode of renderers) {
  try {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    // CPU_THROTTLE=4 slows the CPU of the page four times (Chromium only), as a loaded CI runner does (#328).
    if (process.env.CPU_THROTTLE) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', {rate: Number(process.env.CPU_THROTTLE)});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // (The browser's own line for a 404 that a test asks for on purpose, from `/no-such-…`, can come after that test.)
    // (WebKit keeps a context that loseContext() released on its list of active contexts until the canvas is collected,
    // so a page that makes and removes more than 16 maps gets these two lines from WebKit itself, about contexts that
    // the library has already lost; #776.)
    const webkitList = m => browserName === 'webkit' && /too many active WebGL contexts|loseContext: context already lost/.test(m.text());
    page.on('console', m => { if (m.type() === 'error' && !webkitList(m) && !(m.text().startsWith('Failed to load resource') && m.location().url?.includes('/no-such-'))) errors.push(m.text() + (m.location().url ? ' (' + m.location().url + ')' : '')); });
    await page.goto(`${origin}/?renderer=${mode}`);
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    // Some browsers cannot make a WebGL context in a worker (WebKit on Linux and Windows, Safari before 16.4). The map
    // must then render on the main thread, and the tests of the worker have nothing to test.
    const canWorker = await workerRenders(page), workerCan = mode !== 'worker' || canWorker;
    if (!workerCan) console.log('INFO  [worker] this browser cannot render in a worker: the map must use the main thread');
    check(`[${mode}] loads with requested renderer`, await page.evaluate(() => window.map.renderer) === (workerCan ? mode : 'main'));

    // A map in a `display: none` container fires `load` and `idle`, as in MapLibre GL JS 6.17, and after `display: block`
    // the map draws at its new size and fires `idle` again (#964).
    const hidden = await page.evaluate(async renderer => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'display:none;width:300px;height:200px'}));
        const m = new mod.Map({container: el, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#123'}}]}, renderer, attributionControl: false});
        const within = (type, ms) => new Promise(r => { m.once(type, () => r(true)); setTimeout(() => r(false), ms); });
        const [load, idle] = await Promise.all([within('load', 10000), within('idle', 10000)]);
        el.style.display = 'block';
        const shown = await within('idle', 10000), out = {load, idle, shown, width: m.getCanvas().width, want: Math.round(300 * devicePixelRatio)};
        m.remove(); el.remove();
        return out;
    }, mode).catch(e => ({error: String(e)}));
    check(`[${mode}] a map in a display:none container fires load and idle, and draws once shown (#964)`, hidden.load && hidden.idle && hidden.shown && hidden.width === hidden.want, JSON.stringify(hidden));

    // The picture of an image source is part of the first complete picture: `idle` waits for it, as in MapLibre GL JS
    // 6.17 (`ImageSource.loaded()`). A picture that fails to load does not hold `idle` back, and the map says once what
    // failed (#1449). The server answers the picture 400 ms late, so that a map that does not wait is idle before it.
    const redPng = Buffer.from((await page.evaluate(() => { const c = Object.assign(document.createElement('canvas'), {width: 8, height: 8}), g = c.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0, 0, 8, 8); return c.toDataURL('image/png'); })).split(',')[1], 'base64');
    await page.route('**/slow-1449.png', async r => { await new Promise(t => setTimeout(t, 400)); await r.fulfill({status: 200, contentType: 'image/png', body: redPng}); });
    const picture = await page.evaluate(async renderer => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
        const m = new mod.Map({container: el, renderer, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8,
            sources: {a: {type: 'image', url: location.origin + '/slow-1449.png', coordinates: [[-170, 80], [-10, 80], [-10, -80], [-170, -80]]}, b: {type: 'image', url: location.origin + '/no-such-1449.png', coordinates: [[10, 80], [170, 80], [170, -80], [10, -80]]}},
            layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'a', type: 'raster', source: 'a'}, {id: 'b', type: 'raster', source: 'b'}]}});
        const said = []; m.on('error', e => said.push(String(e.error?.message ?? e.message)));
        const idle = await new Promise(r => { m.once('idle', () => r(true)); setTimeout(() => r(false), 15000); });
        const bmp = await createImageBitmap(await m.toBlob()), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
        g.drawImage(bmp, 0, 0);
        const px = Array.from(g.getImageData(Math.round(bmp.width * 0.25), Math.round(bmp.height / 2), 1, 1).data).slice(0, 3);
        m.remove(); el.remove();
        return {idle, px, said};
    }, mode).catch(e => ({error: String(e)}));
    await page.unroute('**/slow-1449.png');
    check(`[${mode}] the first idle comes after the picture of an image source has loaded, and a picture that fails says so once (#1449)`,
        picture.idle && picture.px?.[0] > 200 && picture.px[1] < 60 && picture.said?.length === 1 && picture.said[0].includes('no-such-1449.png'), JSON.stringify(picture));

    // Paint transitions (#960), as in MapLibre GL JS: setPaintProperty and setStyle with `diff` move a colour over the
    // layer's `*-transition` (here 3 s), `idle` waits for the end, and setStyle with `diff: false` changes it at once.
    // (`toBlob` waits for `idle`, so a screenshot of the page reads the colour in the middle.)
    const transitions = await (async () => {
        const red = async () => page.evaluate(async png => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d'); c.drawImage(bmp, 0, 0); return c.getImageData(0, 0, 1, 1).data[0]; }, (await page.screenshot({clip: {x: 50, y: 40, width: 1, height: 1}})).toString('base64'));
        const wait = ms => new Promise(r => setTimeout(r, ms)), idle = () => page.evaluate(() => new Promise(r => window.transitionMap.once('idle', r))), out = {};
        await page.evaluate(async renderer => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const style = window.transitionStyle = c => ({version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': c, 'background-color-transition': {duration: 3000, delay: 0}}}]});
            const el = window.transitionEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:100px;height:80px;z-index:99999'}));
            const m = window.transitionMap = new mod.Map({container: el, style: style('#000'), center: [0, 0], zoom: 1, renderer, attributionControl: false});
            await new Promise(r => m.once('idle', r));
        }, mode);
        await wait(100);
        out.start = await red();
        await page.evaluate(() => { window.idled = false; window.transitionMap.setPaintProperty('bg', 'background-color', '#f00'); window.transitionMap.once('idle', () => window.idled = true); });
        await wait(1500);
        out.middle = await red(); out.idleInMiddle = await page.evaluate(() => window.idled);
        await idle(); await wait(100); out.end = await red();
        await page.evaluate(() => window.transitionMap.setStyle(window.transitionStyle('#000')));
        await wait(1500); out.diffMiddle = await red();
        await idle();
        await page.evaluate(() => window.transitionMap.setStyle(window.transitionStyle('#f00'), {diff: false}));
        await wait(300); out.instant = await red();
        await page.evaluate(() => { window.transitionMap.remove(); window.transitionEl.remove(); });
        return out;
    })().catch(e => ({error: String(e)}));
    check(`[${mode}] paint transitions: setPaintProperty and setStyle with diff move a colour over its transition, idle waits, diff: false is at once (#960)`,
        transitions.start === 0 && transitions.middle > 40 && transitions.middle < 215 && !transitions.idleInMiddle && transitions.end === 255 && transitions.diffMiddle > 40 && transitions.diffMiddle < 215 && transitions.instant === 255, JSON.stringify(transitions));

    // The globe (#463): a map with the projection globe draws a sphere (the corners of the canvas stay empty), places
    // a point where `project` says, turns under a drag as in MapLibre GL JS, and turns into Mercator at zoom 12.
    // A second map on the page with Mercator is not affected.
    {
        const globe = await page.evaluate(async renderer => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), style = await (await fetch('/style.json')).json();
            const box = (left) => document.body.appendChild(Object.assign(document.createElement('div'), {style: `position:fixed;left:${left}px;top:0;width:400px;height:400px;z-index:50;background:#fff`}));
            const a = box(0), b = box(450), idle = m => new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
            const g = window.globeMap = new mod.Map({container: a, style: {...style, projection: {type: 'globe'}}, center: [10, 45], zoom: 1, renderer, attributionControl: false});
            const m = window.flatMap = new mod.Map({container: b, style, center: [10, 45], zoom: 1, renderer, attributionControl: false});
            await Promise.all([idle(g), idle(m)]);
            const pixels = async map => { const blob = await map.toBlob(); const bmp = await createImageBitmap(blob), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height})).getContext('2d'); c.drawImage(bmp, 0, 0); const at = (x, y) => [...c.getImageData(x * bmp.width, y * bmp.height, 1, 1).data]; return {corner: at(0.02, 0.02), middle: at(0.5, 0.5)}; };
            const p = g.project([10, 45]), q = g.project([-60, 10]), back = g.unproject([q.x, q.y]).toArray().map(v => +v.toFixed(3));
            // getBounds has the visible edge of the globe and a pole in view (MapLibre GL JS 6.17: -180, -46.81, 180, 90),
            // and a Marker on the far side takes opacityWhenCovered and the covered class (MapLibre: 0.2).
            g.jumpTo({center: [10, 30], zoom: 1.5});
            const near = new mod.Marker().setLngLat([10, 30]).addTo(g), far = new mod.Marker().setLngLat([-140, 0]).addTo(g);
            const markers = [near, far].map(k => [k.getElement().style.opacity || '1', k.getElement().classList.contains('maplibregl-marker-covered')]);
            near.remove(); far.remove();
            return {globe: await pixels(g), flat: await pixels(m), centre: [p.x, p.y].map(Math.round), q: [q.x, q.y], back,
                bounds: g.getBounds().toArray().flat().map(v => +v.toFixed(2)), markers};
        }, mode);
        check(`[${mode}] the globe: the corners stay empty on the globe and not on Mercator, project and unproject agree, getBounds reaches the pole, and a marker on the far side is faint`,
            globe.globe.corner[3] === 0 && globe.globe.middle[3] === 255 && globe.flat.corner[3] === 255 && globe.centre.join() === '200,200' && Math.abs(globe.back[0] + 60) < 0.01 && Math.abs(globe.back[1] - 10) < 0.01
            && JSON.stringify(globe.markers) === '[["1",false],["0.2",true]]' && globe.bounds[0] === -180 && globe.bounds[2] === 180 && globe.bounds[3] === 90 && globe.bounds[1] < -20, JSON.stringify(globe));
        // A drag on the globe turns it as MapLibre GL JS 6.17 does: the place under the pointer at the start ends
        // at (180.39, 163.47), 3.5 px from the pointer, with the centre at (31.885, 27.12) and zoom 1.332 (measured with MapLibre).
        await page.mouse.move(250, 230); await page.mouse.down(); await page.mouse.move(180, 160, {steps: 10}); await page.mouse.up();
        await page.waitForTimeout(400);
        const dragged = await page.evaluate(async () => {
            const g = window.globeMap;
            return {centre: g.getCenter().toArray(), zoom: g.getZoom()};
        });
        const follow = await page.evaluate(async () => {
            const g = window.globeMap;
            g.jumpTo({center: [10, 45], zoom: 1});
            const at = g.unproject([250, 230]);
            return [at.lng, at.lat];
        });
        await page.mouse.move(250, 230); await page.mouse.down(); await page.mouse.move(180, 160, {steps: 10});
        // (The worker reports the camera a frame later.)
        await page.waitForTimeout(200);
        const held = await page.evaluate(([lng, lat]) => { const p = window.globeMap.project([lng, lat]); const c = window.globeMap.getCenter(); return [p.x, p.y, c.lng, c.lat, window.globeMap.getZoom()]; }, follow);
        await page.mouse.up();
        // easeTo to the north without a zoom keeps the size of the globe on the screen in each frame, and the zoom
        // changes instead (MapLibre GL JS 6.17 ends at zoom -0.048).
        const kept = await page.evaluate(async () => {
            const g = window.globeMap, size = () => { const c = g.getCenter(), a = g.project([c.lng, c.lat - 0.05]), b = g.project([c.lng, c.lat + 0.05]); return Math.hypot(a.x - b.x, a.y - b.y) / 0.1; };
            // (After each jump, the map is idle first: with the worker renderer, the end of the jump comes later.)
            g.jumpTo({center: [10, 0], zoom: 1.5});
            await new Promise(r => { g.once('idle', r); setTimeout(r, 15000); });
            const s0 = size(), seen = [];
            const moved = () => seen.push(size());
            g.on('move', moved);
            await new Promise(r => { g.once('moveend', r); g.easeTo({center: [10, 70], duration: 400}); });
            g.off('move', moved);
            const zoom = g.getZoom(), lat = g.getCenter().lat;
            // flyTo on the globe from New York to Tokyo at zoom 10 goes out to zoom 1.171 in MapLibre GL JS 6.17 in this view of
            // 400 by 400 pixels (the curve does not depend on the speed or the easing). The lowest zoom of the drawn frames
            // depends on which frames are drawn (1.3135 and 1.2297 in CI, #517), so the test reads the curve at fixed
            // parts of the flight instead: an easing that is constant puts every frame, the last one included, at that part.
            // The lowest point is at the middle of the way (part 0.5); the parts 0.4 to 0.6 in steps of 0.005 find it to
            // within 0.001.
            g.jumpTo({center: [-74, 40.7], zoom: 10});
            await new Promise(r => { g.once('idle', r); setTimeout(r, 15000); });
            const zooms = [];
            for (let i = 80; i <= 120; i++) {
                const part = i / 200;
                g.jumpTo({center: [-74, 40.7], zoom: 10});
                await new Promise(r => { g.once('moveend', r); setTimeout(r, 15000); g.flyTo({center: [139.7, 35.7], zoom: 10, duration: 1, easing: () => part}); });
                zooms.push(g.getZoom());
            }
            return {s0, min: Math.min(...seen), max: Math.max(...seen), frames: seen.length, zoom, lat, flyMin: Math.min(...zooms)};
        });
        check(`[${mode}] the globe: easeTo to the north without a zoom keeps the size of the globe, the zoom changes, and flyTo has the curve of MapLibre GL JS`,
            kept.frames > 3 && kept.min > kept.s0 * 0.99 && kept.max < kept.s0 * 1.01 && Math.abs(kept.zoom - -0.048) < 0.002 && Math.abs(kept.lat - 70) < 1e-6 && Math.abs(kept.flyMin - 1.171) < 0.05, JSON.stringify(kept));
        // A label that turns behind the globe is not drawn in the next frame (not only after the next placement and its
        // fade, as before, when labels showed through the globe during a fast drag).
        await page.evaluate(async renderer => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:400px;z-index:60;background:#fff'}));
            const style = {version: 8, projection: {type: 'globe'}, sources: {p: {type: 'geojson', data: {type: 'Point', coordinates: [10, 0]}}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#0000ff'}}, {id: 'l', type: 'symbol', source: 'p', layout: {'text-field': 'WWW', 'text-size': 28, 'text-allow-overlap': true}, paint: {'text-color': '#ff0000'}}]};
            const map = window.farMap = new mod.Map({container: el, style, center: [10, 0], zoom: 1, renderer, attributionControl: false});
            await new Promise(r => { map.once('idle', r); setTimeout(r, 15000); });
        }, mode);
        const redPixels = async () => page.evaluate(async b64 => {
            const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(img.width, img.height) : Object.assign(document.createElement('canvas'), {width: img.width, height: img.height})).getContext('2d');
            c.drawImage(img, 0, 0);
            const d = c.getImageData(0, 0, img.width, img.height).data;
            let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 60 && d[i + 1] < 60) n++;
            return n;
        }, (await page.screenshot({clip: {x: 0, y: 0, width: 400, height: 400}})).toString('base64'));
        const front = await redPixels();
        // (The first frame of the new camera, then two frames of the page to show it: in WebKit the frame of the worker
        // renderer can come later than two frames of the page after jumpTo; #965.)
        await page.evaluate(() => new Promise(r => { window.farMap.once('render', () => requestAnimationFrame(() => requestAnimationFrame(r))); window.farMap.jumpTo({center: [170, 0]}); }));
        const back = await redPixels();
        await page.evaluate(() => { const el = window.farMap.getContainer(); window.farMap.remove(); el.remove(); });
        check(`[${mode}] the globe: a label that turns behind the globe is not drawn in the next frame`, front > 50 && back === 0, JSON.stringify({front, back}));
        // A fill-extrusion layer draws on the globe at zoom 4, with its height along the normal of the sphere, and not
        // when it is on the far side (#1429).
        const towers = await page.evaluate(async renderer => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:400px;z-index:60'}));
            const box = [[[8, -2], [12, -2], [12, 2], [8, 2], [8, -2]]], said = [], log = console.warn;
            console.warn = (...a) => said.push(a.join(' '));
            const style = {version: 8, projection: {type: 'globe'}, sources: {p: {type: 'geojson', data: {type: 'Polygon', coordinates: box}}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#0000ff'}}, {id: 'x', type: 'fill-extrusion', source: 'p', paint: {'fill-extrusion-color': '#ff0000', 'fill-extrusion-height': 300000}}]};
            const map = new mod.Map({container: el, style, center: [10, 0], zoom: 4, pitch: 50, renderer, attributionControl: false});
            const idle = () => new Promise(r => { map.once('idle', r); setTimeout(r, 15000); });
            const red = async () => {
                const bmp = await createImageBitmap(await map.toBlob()), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height})).getContext('2d');
                c.drawImage(bmp, 0, 0);
                const d = c.getImageData(0, 0, bmp.width, bmp.height).data;
                let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 60 && d[i] > 2 * d[i + 2]) n++;
                return n;
            };
            await idle();
            const front = await red();
            map.jumpTo({center: [-170, 0], zoom: 1, pitch: 0});
            await idle();
            const back = await red();
            console.warn = log;
            map.remove(); el.remove();
            return {front, back, said: said.filter(w => w.includes('globe'))};
        }, mode);
        check(`[${mode}] the globe: a fill-extrusion layer draws at zoom 4 without a warning, and not on the far side (#1429)`, towers.front > 2000 && towers.back === 0 && towers.said.length === 0, JSON.stringify(towers));
        // A loaded Mercator map that switches to the globe waits for the cut tiles, and then draws the globe.
        const switched = await page.evaluate(async () => {
            const m = window.flatMap, t0 = performance.now();
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
            m.setProjection({type: 'globe'});
            await new Promise(r => setTimeout(r, 50));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
            const bmp = await createImageBitmap(await m.toBlob()), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height})).getContext('2d');
            c.drawImage(bmp, 0, 0);
            const corner = c.getImageData(2, 2, 1, 1).data[3];
            m.setProjection({type: 'mercator'});
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
            return {corner, ms: Math.round(performance.now() - t0)};
        });
        check(`[${mode}] the globe: a loaded Mercator map switches to the globe once its tiles are cut, and draws the globe`, switched.corner === 0, JSON.stringify(switched));
        const zoomed = await page.evaluate(async () => {
            const g = window.globeMap; g.jumpTo({center: [10, 45], zoom: 12.5}); await new Promise(r => { g.once('idle', r); setTimeout(r, 15000); });
            const p = g.project([10.01, 45]), m = window.flatMap; m.jumpTo({center: [10, 45], zoom: 12.5});
            const q = m.project([10.01, 45]);
            for (const map of [g, m]) { const el = map.getContainer(); map.remove(); el.remove(); }
            return Math.hypot(p.x - q.x, p.y - q.y);
        });
        check(`[${mode}] the globe: a drag turns the globe as in MapLibre GL JS, and at zoom 12.5 the globe is Mercator`,
            Math.hypot(held[0] - 180.39, held[1] - 163.47) < 0.5 && Math.hypot(held[2] - 31.885, held[3] - 27.12) < 0.05 && Math.abs(held[4] - 1.332) < 0.005 && dragged.centre[0] !== 10 && zoomed < 1e-6, JSON.stringify({held, dragged, zoomed}));
    }

    // Drag pan: the point under the cursor should follow it.
    const before = await page.evaluate(() => { window.dragEvents = []; for (const t of ['dragstart', 'drag', 'dragend']) window.map.on(t, e => window.dragEvents.push(t + (e.originalEvent ? '' : '!'))); return window.map.getCenter(); });
    await page.mouse.move(500, 350); await page.mouse.down(); await page.mouse.move(400, 300, {steps: 8}); await page.mouse.up();
    await page.waitForFunction(b => window.map.getCenter().lng !== b.lng, before, {timeout: 5000}).catch(() => {}); // the drag has reached the page
    await settle(page);
    const after = await page.evaluate(() => window.map.getCenter());
    const dragEvents = await page.evaluate(() => window.dragEvents);
    check(`[${mode}] a drag fires dragstart, drag and dragend once each in order, with originalEvent`, dragEvents[0] === 'dragstart' && dragEvents.at(-1) === 'dragend' && dragEvents.filter(t => t === 'drag').length === dragEvents.length - 2 && dragEvents.length > 2, dragEvents.join(' '));
    check(`[${mode}] drag pans east and south`, after.lng > before.lng && after.lat < before.lat, `Δlng=${(after.lng - before.lng).toFixed(5)} Δlat=${(after.lat - before.lat).toFixed(5)}`);

    // Wheel zoom keeps the location under the cursor fixed.
    const anchor = await page.evaluate(() => window.map.unproject({x: 700, y: 200}));
    // (What the browser reports for the wheel is kept: browsers differ here, and a failure then explains itself.)
    await page.evaluate(() => { window.wheels = []; window.map.on('wheel', e => window.wheels.push([e.point.x, e.point.y, e.originalEvent.deltaY, e.originalEvent.deltaMode, e.originalEvent.ctrlKey].join('/'))); });
    await page.mouse.move(700, 200);
    const beforeWheel = await page.evaluate(a => { const q = window.map.project(a); return `${q.x.toFixed(0)},${q.y.toFixed(0)} moving=${window.map.isMoving()}`; }, anchor);
    await page.mouse.wheel(0, -500);
    await page.waitForFunction(() => window.map.getZoom() > 14.31, null, {timeout: 10000}).catch(() => {}); // the zoom has started
    await settle(page);
    const z = await page.evaluate(() => window.map.getZoom());
    const p = await page.evaluate(a => window.map.project(a), anchor);
    check(`[${mode}] wheel zooms in around cursor`, z > 14.6 && Math.hypot(p.x - 700, p.y - 200) < 1.5, `zoom=${z.toFixed(2)} drift=${Math.hypot(p.x - 700, p.y - 200).toFixed(2)}px at ${p.x.toFixed(0)},${p.y.toFixed(0)}; before the wheel the place was at ${beforeWheel}; wheel events (x/y/deltaY/mode/ctrl): ${(await page.evaluate(() => window.wheels.slice(0, 4))).join(' ')}`);

    // A drag that ends with a very small movement gives a glide that is over in less than one frame. The map must
    // still report the end of the movement.
    await page.mouse.move(500, 350); await page.mouse.down(); await page.mouse.move(470, 340, {steps: 4}); await page.waitForTimeout(120);
    await page.mouse.move(470.6, 340); await page.mouse.move(471.2, 340); await page.mouse.up();
    const ended = await page.waitForFunction(() => !window.map.isMoving(), null, {timeout: 4000}).then(() => true, () => false);
    check(`[${mode}] a drag with a very short glide ends (isMoving is false again)`, ended);
    await settle(page);

    // Read-after-write is immediate even when the engine lives in a worker.
    const sync = await page.evaluate(() => { window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14.3, bearing: 0}); return [window.map.getZoom(), window.map.getCenter().lng]; });
    check(`[${mode}] jumpTo is readable synchronously`, sync[0] === 14.3 && sync[1] === -74.0065);
    await page.waitForTimeout(800);

    // A camera call with duration 0 is a jump (#193), and jumps fire zoom, rotate and pitch (#192), as in MapLibre GL JS.
    const instant = await page.evaluate(async () => {
        const m = window.map, seen = [], on = t => m.on(t, () => seen.push(t));
        ['zoom', 'rotate', 'pitch'].forEach(on);
        m.easeTo({center: [-74.0, 40.71], zoom: 13, duration: 0});
        const now = m.getZoom();
        m.jumpTo({padding: {left: 0}});
        m.fitBounds([[-74.02, 40.70], [-74.0, 40.72]], {duration: 0});
        const fit = m.getZoom();
        await new Promise(r => setTimeout(r, 600));
        const kept = m.getZoom();
        seen.length = 0;
        m.jumpTo({zoom: 14.3, bearing: 10, pitch: 10});
        // Wait for the events themselves (#714): with the engine in a worker they can arrive late on a loaded runner.
        for (const end = performance.now() + 5000; !['zoom', 'rotate', 'pitch'].every(t => seen.includes(t)) && performance.now() < end;) await new Promise(r => setTimeout(r, 20));
        const events = [...new Set(seen)];
        m.jumpTo({bearing: 0, pitch: 0});
        await new Promise(r => setTimeout(r, 400));
        return {now, fit, kept, events};
    });
    check(`[${mode}] easeTo and fitBounds with duration 0 apply at once and survive a following jumpTo`, instant.now === 13 && instant.fit > 13 && Math.abs(instant.kept - instant.fit) < 1e-9, JSON.stringify(instant));
    check(`[${mode}] jumpTo fires zoom, rotate and pitch`, ['zoom', 'rotate', 'pitch'].every(t => instant.events.includes(t)), instant.events.join(' '));

    // As in MapLibre's CSS, the controls take the font of the map's container, and an interactive map shows `grab` (#211).
    const css = await page.evaluate(() => {
        const c = window.map.getContainer(), ctrl = c.querySelector('.map-jr-ctrl'), before = c.style.fontFamily;
        c.style.fontFamily = 'monospace';
        const r = {ctrl: ctrl && getComputedStyle(ctrl).fontFamily, cursor: getComputedStyle(window.map.getCanvas()).cursor};
        c.style.fontFamily = before;
        return r;
    });
    check(`[${mode}] controls inherit the container's font; the canvas shows grab`, css.ctrl === 'monospace' && css.cursor === 'grab', JSON.stringify(css));
    // #1356: each rule of the library's CSS that names an element (button, a, svg, path) has the specificity of one class, so element rules of the page (`button`, `a`,
    // `svg`) leave the controls alone, and a page rule with two classes still wins. Both entries, light and dark.
    if (mode === 'main' && browserName === 'chromium') {
        for (const entry of ['host', 'compat']) {
            const r = await page.evaluate(async entry => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:100px;top:100px;width:600px;height:400px;z-index:1000'}));
                const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, credit = '<a href="https://example.com/">credit</a>';
                let m;
                if (entry === 'host') {
                    const {createMap} = await import('/dist/map-jr-gl.js'), {navigation} = await import('/dist/controls.js');
                    m = createMap(el, {renderer: 'main', style, initialView: {center: [0, 0], zoom: 3}, controls: [navigation()], attribution: {compact: true, customAttribution: credit}});
                    m.overlay(Object.assign(document.createElement('div'), {textContent: 'Popup'}), {lngLat: [0, 0], popup: true, onClose() {}});
                } else {
                    const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
                    m = new mod.Map({container: el, renderer: 'main', attributionControl: false, style, center: [0, 0], zoom: 3});
                    new mod.Popup().setLngLat([0, 0]).setText('Popup').addTo(m);
                    m.addControl(new mod.NavigationControl(), 'top-right');
                    m.addControl(new mod.AttributionControl({compact: true, customAttribution: credit}), 'bottom-right');
                }
                await new Promise(res => setTimeout(res, 500));
                const look = () => {
                    const b = el.querySelector('.map-jr-ctrl-group button'), a = el.querySelector('.map-jr-ctrl-attrib a'), g = el.querySelector('.map-jr-ctrl-group'), icon = el.querySelector('.map-jr-ctrl-group .map-jr-ctrl-icon, .map-jr-ctrl-group svg');
                    const pick = (e, props) => props.map(k => getComputedStyle(e)[k]).join('|');
                    return [pick(b, ['marginTop', 'marginLeft', 'paddingLeft', 'borderTopWidth', 'borderTopLeftRadius', 'backgroundColor', 'width', 'height', 'display']), pick(a, ['color', 'textDecorationLine']), pick(g, ['backgroundColor', 'borderTopLeftRadius']), pick(icon, ['width', 'height', 'display', 'marginLeft']), pick(el.querySelector('.map-jr-ctrl-attrib-button'), ['marginLeft', 'paddingLeft', 'borderTopWidth', 'borderTopLeftRadius', 'width', 'height', 'display']), pick(el.querySelector('.map-jr-popup-close-button'), ['marginLeft', 'paddingLeft', 'borderTopWidth', 'width', 'height', 'display'])].join(' || ');
                };
                const out = {};
                const sheet = document.head.appendChild(document.createElement('style'));
                for (const scheme of ['light', 'dark']) {
                    el.classList.toggle('map-jr-dark', scheme === 'dark');
                    sheet.textContent = '';
                    out[scheme] = {plain: look()};
                    sheet.textContent = 'button{margin:0 0 8px 12px;padding:4px 10px;border:1px solid red;border-radius:0;background:red;width:99px;height:99px;display:block} a{color:red;text-decoration:underline;margin-left:5px;padding-left:5px;display:block} svg,div{width:50px;height:50px;display:block;margin-left:4px}';
                    out[scheme].elements = look();
                    sheet.textContent = '.page-x .map-jr-ctrl-group button{margin-left:7px;background:rgb(1,2,3)} .page-x .map-jr-ctrl-attrib a{color:rgb(4,5,6)}';
                    el.classList.add('page-x');
                    const b = el.querySelector('.map-jr-ctrl-group button'), a = el.querySelector('.map-jr-ctrl-attrib a');
                    out[scheme].two = [getComputedStyle(b).marginLeft, getComputedStyle(b).backgroundColor, getComputedStyle(a).color].join('|');
                    el.classList.remove('page-x');
                    // A page rule with one class on a container (the group, the attribution) wins: those rules have no specificity.
                    sheet.textContent = '.map-jr-ctrl-group,.maplibregl-ctrl-group{background:rgb(1,1,1)} .map-jr-ctrl-attrib,.maplibregl-ctrl-attrib{background:rgb(1,1,1)}';
                    out[scheme].one = [getComputedStyle(el.querySelector('.map-jr-ctrl-group')).backgroundColor, getComputedStyle(el.querySelector('.map-jr-ctrl-attrib')).backgroundColor].join('|');
                }
                sheet.remove();
                if (entry === 'host') m.destroy(); else m.remove();
                el.remove();
                return out;
            }, entry);
            const same = s => r[s].plain === r[s].elements, two = s => r[s].two === '7px|rgb(1, 2, 3)|rgb(4, 5, 6)' && r[s].one === 'rgb(1, 1, 1)|rgb(1, 1, 1)';
            check(`[main] ${entry === 'host' ? 'createMap' : 'maplibre-compat'}: page rules for button, a, svg and div leave the controls, the compact attribution button and the popup close button unchanged, a page rule with two classes wins, and a page rule with one class on the group and the attribution wins, in light and dark (#1356)`,
                same('light') && same('dark') && two('light') && two('dark') && /^\d/.test(r.light.plain), JSON.stringify(r));
        }
    }
    // Marker hit testing and events.
    const pt = await page.evaluate(() => window.map.project([-74.0060, 40.7127]));
    await page.mouse.move(pt.x, pt.y - 20);
    await page.waitForTimeout(300);
    check(`[${mode}] marker hover sets pointer cursor`, await page.evaluate(() => window.map.getCanvas().style.cursor) === 'pointer');
    await page.screenshot({path: `${out}/hover-${mode}.png`, clip: {x: pt.x - 80, y: pt.y - 90, width: 160, height: 120}});
    await page.mouse.click(pt.x, pt.y - 20);
    // (The pin is a feature of a symbol layer, and the answer to the click is a promise.)
    const clicked = await page.waitForFunction(() => window.lastMarkerClick, null, {timeout: 5000}).then(h => h.jsonValue(), () => null);
    check(`[${mode}] marker click reports the marker`, clicked === '3', String(clicked));

    // Rotation and animated camera.
    await page.evaluate(() => window.map.easeTo({bearing: 40, zoom: 15, duration: 300}));
    await page.waitForTimeout(900);
    const cam = await page.evaluate(() => [window.map.getBearing(), window.map.getZoom()]);
    check(`[${mode}] easeTo reaches target`, Math.abs(cam[0] - 40) < 0.01 && Math.abs(cam[1] - 15) < 0.01, JSON.stringify(cam));

    // Frames produced while the page's own thread is blocked for a second, mid-animation.
    const frames = await page.evaluate(async () => {
        let moves = 0;
        window.map.on('move', () => moves++);
        window.map.easeTo({center: [-73.99, 40.72], duration: 1500});
        await new Promise(r => setTimeout(r, 100));
        const start = moves, t0 = performance.now();
        while (performance.now() - t0 < 1000) { /* simulate a busy page */ }
        await new Promise(r => setTimeout(r, 0));
        return moves - start;
    });
    console.log(`INFO  [${mode}] camera frames rendered during a 1s main-thread block: ${frames}`);
    if (mode === 'main') mainFrames = frames;
    // (In Firefox the measurements show that a blocked page also stops the frames of a worker: 1 frame, as on the main thread.)
    else if (!workerCan || browserName === 'firefox') console.log(`INFO  [worker] not tested in this browser: keeps animating while the main thread is blocked (${frames} frames vs ${mainFrames})`);
    else check('[worker] keeps animating while the main thread is blocked', frames > mainFrames, `${frames} frames vs ${mainFrames} on the main thread`);

    // Queries read tile data directly: no layer needs to draw the feature, and the place need not be on screen.
    await settle(page);
    const q = await page.evaluate(async () => {
        const sources = Object.keys(window.map.getStyle().sources).filter(id => window.map.getStyle().sources[id].type === 'vector');
        const all = async (at, o) => (await Promise.all(sources.map(id => window.map.querySource(id, at, o)))).flat();
        const here = await all([-74.0060, 40.7127], {sourceLayers: ['landcover', 'poi'], radius: 12});
        const far = await all([2.2945, 48.8584], {zoom: 14, sourceLayers: ['poi', 'building'], radius: 30, geometry: true});
        const filtered = await all([2.2945, 48.8584], {zoom: 14, radius: 30, filter: ['==', ['get', 'class'], 'no-such-class']});
        // `queryFeatures` gives what the style layers draw (#12), as `queryRenderedFeatures` does. MapLibre has no radius,
        // so the comparison sets `radius: 0` (the default of `queryFeatures` is 3, #1150).
        const c = window.map.getCenter(), at = window.map.project(c), key = f => f.layer.id + ' ' + f.id;
        const drawn = await window.map.queryFeatures(c, {radius: 0}), same = await window.map.queryRenderedFeatures([at.x, at.y]);
        const wide = await window.map.queryFeatures({x: at.x, y: at.y}, {radius: 40}), box = await window.map.queryRenderedFeatures([[at.x - 40, at.y - 40], [at.x + 40, at.y + 40]]);
        const one = {drawn: drawn.length, layer: typeof drawn[0]?.layer?.id, same: drawn.map(key).join() === same.map(key).join(), wide: wide.length, box: wide.map(key).join() === box.map(key).join(), all: (await window.map.queryFeatures()).length};
        const centre = window.map.getCenter();
        const summit = await window.map.queryElevation([7.6586, 45.9763]), sea = await window.map.queryElevation([-74.02, 40.69]);
        return {one, here: here.map(f => f.sourceLayer), far: far.length, geom: far[0]?.geometry?.type, filtered: filtered.length, summit, sea, moved: centre.lng !== window.map.getCenter().lng};
    });
    check(`[${mode}] querySource finds an undrawn-layer feature under a point`, q.here.includes('landcover') && q.here.includes('poi'), JSON.stringify(q.here));
    check(`[${mode}] queryFeatures gives what the style layers draw, and radius widens the place`,
        q.one.drawn > 0 && q.one.layer === 'string' && q.one.same && q.one.wide > q.one.drawn && q.one.box && q.one.all > q.one.wide, JSON.stringify(q.one));
    check(`[${mode}] querySource works off screen, with geometry and filters`, q.far > 0 && !!q.geom && q.filtered === 0 && !q.moved, `${q.far} features, first ${q.geom}`);
    check(`[${mode}] queryElevation reads the elevation source`, q.summit > 4300 && q.summit < 4500 && Math.abs(q.sea) < 15, `Matterhorn ${q.summit?.toFixed(0)} m, New York harbour ${q.sea?.toFixed(1)} m`);
    const attribution = await page.evaluate(() => document.querySelector('.maplibregl-ctrl-attrib')?.textContent);
    check(`[${mode}] attribution shows © and keeps links`, attribution.includes('©') && !attribution.includes('&copy') && await page.evaluate(() => document.querySelectorAll('.maplibregl-ctrl-attrib a').length) > 0, attribution);
    // A page-wide rule for links does not colour the attribution links (#757), as in MapLibre GL JS.
    const linkColour = await page.evaluate(() => {
        const style = document.head.appendChild(document.createElement('style'));
        style.textContent = 'a {color: rgb(255, 255, 255)}';
        const ctrl = document.querySelector('.maplibregl-ctrl-attrib'), a = ctrl?.querySelector('a');
        const r = {control: ctrl && getComputedStyle(ctrl).color, link: a && getComputedStyle(a).color};
        style.remove();
        return r;
    });
    check(`[${mode}] attribution links keep the colour of the control under a page rule for a`, !!linkColour.link && linkColour.link === linkColour.control, JSON.stringify(linkColour));
    const img = await page.evaluate(() => window.map.addImage('star', '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="gold"/></svg>').then(() => true, e => String(e)));
    check(`[${mode}] addImage accepts an SVG`, img === true, String(img));
    const gl = await page.evaluate(() => Promise.resolve().then(() => window.map.addImage('gl', {width: 1, height: 1, data: {renderWithWebGL() {}}})).then(() => 'resolved', e => String(e.message)));
    const arr = await page.evaluate(() => window.map.addImage('arr', {width: 1, height: 1, data: [255, 0, 0, 255]}).then(() => true, e => String(e)));
    check(`[${mode}] addImage accepts a plain array of pixels (#442)`, arr === true, String(arr));
    check(`[${mode}] addImage with an image that draws with WebGL rejects with a clear error (#442)`, gl.startsWith('[map-jr-gl] addImage("gl")') && gl.includes('WebGL'), gl);
    // Raw pixels at the stored size are premultiplied as they are: no canvas is read back (#26).
    const reads = await page.evaluate(async () => {
        const proto = CanvasRenderingContext2D.prototype, get = proto.getImageData, draw = proto.drawImage;
        let n = 0;
        proto.getImageData = function (...a) { n++; return get.apply(this, a); };
        proto.drawImage = function (...a) { n++; return draw.apply(this, a); };
        try {
            const r = devicePixelRatio;
            for (let i = 0; i < 20; i++) await window.map.addImage('raw' + i, new ImageData(16 * r, 16 * r), {pixelRatio: r});
        } finally { proto.getImageData = get; proto.drawImage = draw; }
        return n;
    });
    check(`[${mode}] addImage with ImageData reads no canvas back`, reads === 0, `${reads} canvas reads for 20 images`);

    // A colour that is the same for the whole layer is applied at draw time: no tiles are fetched or rebuilt.
    let refetched = 0;
    const count = r => { if (r.url().includes('/tiles/')) refetched++; };
    page.on('request', count);
    await page.evaluate(() => { window.map.setPaintProperty('water', 'fill-color', '#e88'); });
    await page.waitForTimeout(400);
    page.off('request', count);
    check(`[${mode}] setPaintProperty with a plain colour fetches no tiles`, refetched === 0, `${refetched} requests`);
    await idle(page);
    await page.waitForTimeout(300);
    await page.screenshot({path: `${out}/restyle-${mode}.png`});
    // Tilt: the camera pitches, and screen positions still convert both ways.
    await page.evaluate(() => window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 15, bearing: 20, pitch: 50}));
    await idle(page);
    const tilt = await page.evaluate(() => { const m = window.map, ll = m.unproject({x: 300, y: 200}), back = m.project(ll); return {pitch: m.getPitch(), err: Math.hypot(back.x - 300, back.y - 200)}; });
    check(`[${mode}] pitch applies and projection round-trips`, tilt.pitch === 50 && tilt.err < 0.01, JSON.stringify(tilt));
    await page.screenshot({path: `${out}/pitch-${mode}.png`});
    await page.evaluate(() => window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14.3, bearing: 0, pitch: 0}));
    await idle(page);

    // Controls: the zoom-in button works, and a control written against MapLibre's contract can be added.
    const zBefore = await page.evaluate(() => window.map.getZoom());
    await page.click('button[aria-label="Zoom in"]');
    await page.waitForTimeout(300); await settle(page);
    const ctl = await page.evaluate(() => {
        const control = {onAdd(map) { this.el = Object.assign(document.createElement('div'), {className: 'maplibregl-ctrl', id: 'third-party', textContent: 'z' + map.getZoom().toFixed(0)}); return this.el; }, onRemove() { this.el.remove(); }};
        window.map.addControl(control, 'top-left');
        // Found by MapLibre's class names (kept for compatibility), and given this library's own so its styles apply.
        const added = !!document.querySelector('.maplibregl-ctrl-top-left #third-party') && !!document.querySelector('.map-jr-ctrl-top-left #third-party.map-jr-ctrl');
        window.map.removeControl(control);
        return {added, removed: !document.getElementById('third-party'), zoom: window.map.getZoom()};
    });
    check(`[${mode}] zoom control and third-party control contract`, Math.abs(ctl.zoom - zBefore - 1) < 0.01 && ctl.added && ctl.removed, JSON.stringify(ctl));

    // A drag whose button is released where the page cannot see it must not leave the map stuck to the cursor.
    // (The made event must have the id of the real mouse pointer, which differs between browsers: 1 in Chromium, 0 in Firefox.)
    await page.evaluate(() => window.map.getCanvas().addEventListener('pointerdown', e => { window.mouseId = e.pointerId; }, {once: true, capture: true}));
    await page.mouse.move(500, 400); await page.mouse.down(); await page.mouse.move(520, 420, {steps: 3});
    await page.evaluate(() => window.map.getCanvas().dispatchEvent(new PointerEvent('pointermove', {pointerId: window.mouseId ?? 1, pointerType: 'mouse', buttons: 0, clientX: 530, clientY: 430, bubbles: true})));
    await settle(page);
    // The release may start a short glide; wait until the centre has really stopped changing before comparing.
    const c1 = await page.evaluate(async () => { let c = window.map.getCenter(); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 200)); const n = window.map.getCenter(); if (n.lng === c.lng && n.lat === c.lat) break; c = n; } return c; });
    await page.evaluate(() => window.map.getCanvas().dispatchEvent(new PointerEvent('pointermove', {pointerId: window.mouseId ?? 1, pointerType: 'mouse', buttons: 0, clientX: 700, clientY: 600, bubbles: true})));
    await page.waitForTimeout(300);
    const c2 = await page.evaluate(() => window.map.getCenter());
    await page.mouse.up();
    check(`[${mode}] a drag released out of sight does not stick`, c1.lng === c2.lng && c1.lat === c2.lat);

    // `once` with no listener returns a promise for the event, as in MapLibre GL JS (#33).
    const oncePromise = await page.evaluate(async () => {
        const m = window.map, p = m.once('moveend'), isPromise = p instanceof Promise;
        m.jumpTo({center: m.getCenter(), zoom: m.getZoom() + 0.01});
        const e = await Promise.race([p, new Promise(r => setTimeout(() => r(null), 3000))]);
        return {isPromise, type: e?.type, chained: m.once('idle', () => {}) === m};
    });
    check(`[${mode}] once with no listener returns a promise for the event`, oncePromise.isPromise && oncePromise.type === 'moveend' && oncePromise.chained, JSON.stringify(oncePromise));

    // Runtime style changes and camera helpers from MapLibre's API.
    const api = await page.evaluate(async () => {
        const m = window.map;
        m.addLayer({id: 'test-water-line', type: 'line', source: 'omt', 'source-layer': 'water', paint: {'line-color': '#f0f', 'line-width': 3}}, 'building');
        const order = m.getLayersOrder(), added = order.indexOf('test-water-line') === order.indexOf('building') - 1;
        m.removeLayer('test-water-line');
        const cam = m.cameraForBounds([-74.02, 40.70, -73.99, 40.72], {padding: 40});
        m.fitBounds([-74.02, 40.70, -73.99, 40.72], {padding: 40, duration: 0});
        await new Promise(r => m.once('moveend', r));
        const b = m.getBounds();
        return {added, removed: !m.getLayer('test-water-line'), fits: b.west <= -74.02 && b.east >= -73.99 && b.south <= 40.70 && b.north >= 40.72, zoom: cam.zoom, images: m.listImages().filter(n => n.startsWith('shield|')).length};
    });
    check(`[${mode}] addLayer/removeLayer and fitBounds`, api.added && api.removed && api.fits && api.zoom > 13 && api.zoom < 16, JSON.stringify(api));
    check(`[${mode}] missing-image resolver supplied generated shields`, api.images > 0, `${api.images} shield images`);

    // #203: as in MapLibre, `project()` and `point`/`points` of mouse and touch events are a `Point` with methods.
    const points = await page.evaluate(async () => {
        const m = window.map, c = m.getCanvas(), r = c.getBoundingClientRect(), got = {};
        const off = [m.on('mousemove', e => { got.mouse ??= typeof e.point.dist === 'function' && typeof e.defaultPrevented === 'boolean'; }), m.on('touchstart', e => { got.touch ??= typeof e.point.sub === 'function' && e.points.every(p => typeof p.add === 'function'); })];
        c.dispatchEvent(new PointerEvent('pointermove', {pointerId: window.mouseId ?? 1, pointerType: 'mouse', buttons: 0, clientX: r.left + 300, clientY: r.top + 300, bubbles: true}));
        c.dispatchEvent(new PointerEvent('pointerdown', {pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: r.left + 300, clientY: r.top + 300, button: 0, buttons: 1, bubbles: true}));
        c.dispatchEvent(new PointerEvent('pointerup', {pointerId: 31, pointerType: 'touch', isPrimary: true, clientX: r.left + 300, clientY: r.top + 300, button: 0, buttons: 0, bubbles: true}));
        await new Promise(res => setTimeout(res, 400));
        const p = m.project(m.getCenter());
        got.project = typeof p.dist === 'function' && p.dist(p.add({x: 3, y: 4})) === 5;
        return got;
    });
    check(`[${mode}] project() and the point of mouse and touch events are a Point with methods`, points.mouse && points.touch && points.project, JSON.stringify(points));
    // Touch gestures, driven with synthetic touch pointers.
    await page.evaluate(() => {
        window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14, bearing: 0, pitch: 0});
        const c = window.map.getCanvas();
        window.touch = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true}));
        // Moves two fingers from one pair of positions to another over several steps, then lifts them.
        window.twoFingers = async (from, to, steps = 8) => {
            window.touch('pointerdown', 11, ...from[0]); window.touch('pointerdown', 12, ...from[1]);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps, at = k => [from[k][0] + (to[k][0] - from[k][0]) * t, from[k][1] + (to[k][1] - from[k][1]) * t];
                window.touch('pointermove', 11, ...at(0)); window.touch('pointermove', 12, ...at(1));
                await new Promise(r => setTimeout(r, 16));
            }
            window.touch('pointerup', 11, ...to[0]); window.touch('pointerup', 12, ...to[1]);
            // Wait until the camera has not changed for some time: in a worker the gesture is applied a little later.
            await new Promise(r => setTimeout(r, 400));
            for (let i = 0, quiet = 0, last = ''; i < 40 && quiet < 2; i++) {
                await new Promise(r => setTimeout(r, 100));
                const now = JSON.stringify(window.cam());
                quiet = now === last ? quiet + 1 : 0;
                last = now;
            }
        };
        window.cam = () => ({zoom: window.map.getZoom(), bearing: window.map.getBearing(), pitch: window.map.getPitch()});
    });
    await idle(page);
    const t = await page.evaluate(async () => {
        const out = {};
        await window.twoFingers([[400, 350], [600, 350]], [[300, 350], [700, 350]]); // spread to twice the distance
        out.pinch = window.cam();
        await window.twoFingers([[400, 350], [600, 350]], [[400, 345], [600, 355]]); // a slight twist, as any pinch has
        out.smallTwist = window.cam();
        await window.twoFingers([[400, 350], [600, 350]], [[430, 280], [570, 420]]); // a deliberate turn
        out.turn = window.cam();
        window.map.jumpTo({bearing: 0});
        await window.twoFingers([[450, 400], [550, 400]], [[450, 320], [550, 320]]); // both fingers up together
        out.tilt = window.cam();
        window.map.jumpTo({pitch: 0, zoom: 14});
        // Waits for an animation to end. A fixed time is not sufficient when software rendering is slow. With
        // `expect`, it also waits until the zoom is near that value: under load the worker can report the start of
        // an animation later than two quiet samples, and the zoom then still reads the old value.
        const still = async (expect) => {
            await new Promise(r => setTimeout(r, 400));
            for (let i = 0, quiet = 0, z = window.cam().zoom; i < 40 && (quiet < 2 || (expect !== undefined && Math.abs(z - expect) >= 0.02)); i++) {
                await new Promise(r => setTimeout(r, 150));
                const now = window.cam().zoom;
                quiet = Math.abs(now - z) < 1e-6 && !window.map.isMoving() ? quiet + 1 : 0;
                z = now;
            }
        };
        const tap = async (x, y) => { window.touch('pointerdown', 11, x, y); window.touch('pointerup', 11, x, y); await new Promise(r => setTimeout(r, 60)); };
        await tap(500, 350); await tap(500, 350);
        await still(15);
        out.doubleTap = window.cam();
        window.touch('pointerdown', 11, 450, 350); window.touch('pointerdown', 12, 550, 350); window.touch('pointerup', 11, 450, 350); window.touch('pointerup', 12, 550, 350);
        await still(14);
        out.twoFingerTap = window.cam();
        await tap(500, 350);
        window.touch('pointerdown', 11, 500, 350);
        for (let y = 350; y <= 450; y += 10) { window.touch('pointermove', 11, 500, y); await new Promise(r => setTimeout(r, 16)); }
        window.touch('pointerup', 11, 500, 450);
        await still();
        out.tapDrag = window.cam();
        return out;
    });
    check(`[${mode}] touch: pinch zooms without rotating on a slight twist`, Math.abs(t.pinch.zoom - 15) < 0.05 && Math.abs(t.pinch.bearing) < 1e-6 && Math.abs(t.smallTwist.bearing) < 1e-6, JSON.stringify([t.pinch, t.smallTwist]));
    check(`[${mode}] touch: a deliberate twist rotates, two fingers moving up tilts`, Math.abs(t.turn.bearing) > 10 && t.tilt.pitch > 20 && Math.abs(t.tilt.bearing) < 0.01, JSON.stringify([t.turn, t.tilt]));
    check(`[${mode}] touch: double-tap zooms in, two-finger tap zooms out, tap-and-drag zooms`, Math.abs(t.doubleTap.zoom - 15) < 0.02 && Math.abs(t.twoFingerTap.zoom - 14) < 0.02 && t.tapDrag.zoom > 14.5, JSON.stringify([t.doubleTap.zoom, t.twoFingerTap.zoom, t.tapDrag.zoom]));

    // GeoJSON source added at runtime, hit through a layer-scoped click, then replaced with setData.
    await page.evaluate(() => window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14.3, bearing: 0, pitch: 0}));
    const gj = await page.evaluate(async () => {
        const m = window.map, box = (w, s, e, n, name) => ({type: 'Feature', properties: {name}, geometry: {type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]]}});
        m.addSource('zones', {type: 'geojson', data: {type: 'FeatureCollection', features: [box(-74.012, 40.706, -74.004, 40.711, 'first')]}});
        m.addLayer({id: 'zones-fill', type: 'fill', source: 'zones', paint: {'fill-color': '#e11', 'fill-opacity': 0.5}});
        window.zoneClicks = [];
        m.on('click', 'zones-fill', e => window.zoneClicks.push(e.features[0].properties.name));
        // An array of layer ids, as in MapLibre GL JS (#245); a wrong second argument throws a message and breaks nothing.
        window.arrayEvents = [];
        const gone = () => window.arrayEvents.push('removed');
        m.on('click', ['missing-layer', 'zones-fill'], e => window.arrayEvents.push('click:' + e.features[0].properties.name));
        m.once('mouseenter', ['zones-fill'], () => window.arrayEvents.push('enter'));
        m.on('click', ['zones-fill'], gone); m.off('click', ['zones-fill'], gone);
        try { m.on('mouseenter', 42, () => {}); } catch (error) { window.arrayEvents.push(String(error.message).startsWith('[map-jr-gl] on("mouseenter")') ? 'message' : error.message); }
        await new Promise(r => m.once('idle', r));
        const inside = m.project([-74.008, 40.7085]), found = await m.querySource('zones', inside);
        return {inside, found: found.map(f => f.properties.name)};
    });
    await page.screenshot({path: `${out}/geojson-${mode}.png`});
    await page.mouse.move(760, 90); await page.mouse.move(gj.inside.x, gj.inside.y, {steps: 3});
    await page.waitForFunction(() => window.arrayEvents.includes('enter'), null, {timeout: 5000}).catch(() => {});
    await page.mouse.click(gj.inside.x, gj.inside.y);
    await page.mouse.click(760, 90); // outside the zone: must not fire
    await page.waitForFunction(() => window.zoneClicks.length > 0, null, {timeout: 5000}).catch(() => {});
    const gj2 = await page.evaluate(async () => {
        const m = window.map;
        m.getSource('zones').setData({type: 'FeatureCollection', features: [{type: 'Feature', properties: {name: 'second'}, geometry: {type: 'Point', coordinates: [-74.008, 40.7085]}}]});
        await new Promise(r => setTimeout(r, 600));
        return (await m.querySource('zones', [-74.008, 40.7085], {radius: 5})).map(f => f.type + ':' + f.properties.name);
    });
    check(`[${mode}] GeoJSON source, layer click event and setData`, gj.found[0] === 'first' && JSON.stringify(await page.evaluate(() => window.zoneClicks)) === '["first"]' && gj2[0] === 'Point:second', JSON.stringify({found: gj.found, clicks: await page.evaluate(() => window.zoneClicks), after: gj2}));
    await page.waitForFunction(() => window.arrayEvents.some(e => e.startsWith('click:')), null, {timeout: 5000}).catch(() => {});
    const arrayEvents = await page.evaluate(() => window.arrayEvents.join());
    check(`[${mode}] on, once and off with an array of layer ids; a wrong argument gives a message`, arrayEvents === 'message,enter,click:first', arrayEvents);
    // The pointer that leaves the canvas fires mouseleave for the layer that it was over, and the layer can be entered again (#1326).
    await page.evaluate(async () => { // (the data of the source is the point of setData above: put the polygon back)
        const box = {type: 'Feature', properties: {name: 'first'}, geometry: {type: 'Polygon', coordinates: [[[-74.012, 40.706], [-74.004, 40.706], [-74.004, 40.711], [-74.012, 40.711], [-74.012, 40.706]]]}};
        await window.map.getSource('zones').setData({type: 'FeatureCollection', features: [box]}); await new Promise(r => setTimeout(r, 800));
    });
    await page.evaluate(() => { window.leaves = []; window.map.on('mouseleave', 'zones-fill', e => window.leaves.push('leave:' + e.features.length)); window.map.on('mouseenter', 'zones-fill', () => window.leaves.push('enter')); });
    // (A mousemove that arrives while the query of the one before it runs is dropped, so the pointer settles on the point with a last move.)
    const hoverTo = async () => { await page.mouse.move(760, 90); await page.mouse.move(gj.inside.x, gj.inside.y, {steps: 3}); await page.waitForTimeout(800); await page.mouse.move(gj.inside.x + 1, gj.inside.y); };
    await hoverTo();
    await page.waitForFunction(() => window.leaves.includes('enter'), null, {timeout: 5000}).catch(() => {});
    // (Read at once: without the fix the next mousemove, which finds nothing under the pointer, would fire the mouseleave late.)
    const atOnce = await page.evaluate(() => { window.map.getCanvas().dispatchEvent(new PointerEvent('pointerleave', {pointerId: window.mouseId ?? 1, pointerType: 'mouse', bubbles: false})); return window.leaves.join(); });
    await hoverTo();
    await page.waitForFunction(() => window.leaves.length >= 3, null, {timeout: 5000}).catch(() => {});
    const leaves = await page.evaluate(() => window.leaves.join());
    check(`[${mode}] layer mouseleave fires when the pointer leaves the canvas`, atOnce === 'enter,leave:0' && leaves === 'enter,leave:0,enter', atOnce + ' / ' + leaves);
    // MapLibre's updateData: add, change and remove features of a GeoJSON source by their id.
    const diff = await page.evaluate(async () => {
        const m = window.map, source = m.getSource('zones'), point = (id, name, lng) => ({type: 'Feature', id, properties: {name}, geometry: {type: 'Point', coordinates: [lng, 40.7085]}});
        await source.setData({type: 'FeatureCollection', features: [point(1, 'one', -74.008), point(2, 'two', -74.006)]});
        source.updateData({add: [point(3, 'three', -74.004)], remove: [2], update: [{id: 1, addOrUpdateProperties: [{key: 'name', value: 'changed'}], newGeometry: {type: 'Point', coordinates: [-74.007, 40.7085]}}]});
        const data = await m.getSource('zones').getData();
        await new Promise(r => setTimeout(r, 600));
        const drawn = (await m.querySource('zones', [-74.007, 40.7085], {radius: 5})).map(f => f.properties.name);
        return {names: data.features.map(f => f.properties.name).join(), at: data.features[0].geometry.coordinates[0], drawn};
    });
    check(`[${mode}] GeoJSON source: updateData adds, changes and removes features by id`, diff.names === 'changed,three' && diff.at === -74.007 && diff.drawn[0] === 'changed', JSON.stringify(diff));
    // updateData on a source whose data is a URL: two diffs in a row both apply, and a newer setData is kept (#83).
    const urlDiff = await page.evaluate(async () => {
        const m = window.map, source = m.getSource('zones'), point = (id, name) => ({type: 'Feature', id, properties: {name}, geometry: {type: 'Point', coordinates: [-74.008, 40.7085]}});
        const url = URL.createObjectURL(new Blob([JSON.stringify({type: 'FeatureCollection', features: [point(1, 'one')]})], {type: 'application/json'}));
        await source.setData(url);
        await Promise.all([source.updateData({add: [point(2, 'two')]}), source.updateData({add: [point(3, 'three')]})]);
        const both = (await source.getData()).features.map(f => f.properties.name).join();
        await source.setData(url);
        const c = source.updateData({add: [point(4, 'four')]});
        source.setData({type: 'FeatureCollection', features: [point(5, 'newer')]});
        await c;
        const kept = (await source.getData()).features.map(f => f.properties.name).join();
        return {both, kept};
    });
    check(`[${mode}] GeoJSON source with a URL: updateData keeps both diffs and a newer setData`, urlDiff.both === 'one,two,three' && urlDiff.kept === 'newer', JSON.stringify(urlDiff));
    // setData with a URL: a newer setData aborts the older request, and getData uses the kept answer without a request (#83).
    const urlReq = await page.evaluate(async () => {
        const m = window.map, source = m.getSource('zones'), real = window.fetch, seen = [];
        const blob = name => URL.createObjectURL(new Blob([JSON.stringify({type: 'FeatureCollection', features: [{type: 'Feature', properties: {name}, geometry: {type: 'Point', coordinates: [-74.008, 40.7085]}}]})], {type: 'application/json'}));
        const first = blob('first'), second = blob('second');
        window.fetch = (input, init) => { seen.push({url: String(input), signal: init?.signal}); return real(input, init); };
        try {
            const old = source.setData(first);
            await source.setData(second);
            await old;
            const names = [(await source.getData()).features[0].properties.name, (await source.getData()).features[0].properties.name].join();
            return {aborted: seen.find(s => s.url === first)?.signal?.aborted ?? null, requests: seen.filter(s => s.url === second).length, names};
        } finally { window.fetch = real; }
    });
    check(`[${mode}] GeoJSON source with a URL: a newer setData aborts the older request, and getData makes no request`, urlReq.aborted === true && urlReq.requests === 1 && urlReq.names === 'second,second', JSON.stringify(urlReq));
    // 50 calls of setData in a loop send only the last data to the tile workers (as many messages as one call), and
    // every promise resolves (#28).
    const many = await page.evaluate(async () => {
        const m = window.map, source = m.getSource('zones'), point = name => ({type: 'Feature', properties: {name}, geometry: {type: 'Point', coordinates: [-74.008, 40.7085]}});
        let sent = 0;
        const protos = [Worker.prototype, MessagePort.prototype], real = protos.map(p => p.postMessage);
        protos.forEach((p, i) => { p.postMessage = function (msg, ...rest) { if (msg?.type === 'geojson' && msg.source === 'zones') sent++; return real[i].call(this, msg, ...rest); }; });
        try {
            await source.setData({type: 'FeatureCollection', features: [point('single')]});
            await new Promise(r => setTimeout(r, 100));
            const one = sent;
            sent = 0;
            const calls = [];
            for (let i = 0; i < 50; i++) calls.push(source.setData({type: 'FeatureCollection', features: [point('n' + i)]}));
            await Promise.all(calls);
            await new Promise(r => setTimeout(r, 300));
            const drawn = (await m.querySource('zones', [-74.008, 40.7085], {radius: 5})).map(f => f.properties.name);
            return {one, fifty: sent, drawn};
        } finally { protos.forEach((p, i) => { p.postMessage = real[i]; }); }
    });
    check(`[${mode}] GeoJSON source: 50 calls of setData in a loop send only the last data`, many.one > 0 && many.fifty === many.one && many.drawn.join() === 'n49', JSON.stringify(many));
    // setData in the same task as addSource and addLayer is not lost: the data arrives before the engine knows the source (#244).
    const early = await page.evaluate(async () => {
        const m = window.map, point = name => ({type: 'Feature', properties: {name}, geometry: {type: 'Point', coordinates: [-74.008, 40.7085]}});
        m.addSource('early', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
        m.addLayer({id: 'early', type: 'circle', source: 'early'});
        m.getSource('early').setData({type: 'FeatureCollection', features: [point('a')]});
        m.getSource('early').setData({type: 'FeatureCollection', features: [point('b')]});
        let names = [];
        for (let i = 0; i < 30 && !names.length; i++) { await new Promise(r => setTimeout(r, 100)); names = (await m.querySourceFeatures('early')).map(f => f.properties.name); }
        m.removeLayer('early'); m.removeSource('early');
        return names;
    });
    check(`[${mode}] GeoJSON source: setData right after addSource and addLayer is kept`, early.join() === 'b', JSON.stringify(early));
    // setData with the same object again, changed in place or not, sends the data again and the source loads (#8 review).
    const sameObject = await page.evaluate(async () => {
        const m = window.map, wait = ms => new Promise(r => setTimeout(r, ms)), x = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {name: 'a'}, geometry: {type: 'Point', coordinates: [-74.008, 40.7085]}}]};
        m.addSource('same', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
        m.addLayer({id: 'same', type: 'circle', source: 'same'});
        await wait(500);
        const names = async () => (await m.querySource('same', [-74.008, 40.7085], {radius: 5})).map(f => f.properties.name).join();
        const settled = async () => { for (let i = 0; i < 30 && !m.isSourceLoaded('same'); i++) await wait(100); return m.isSourceLoaded('same'); };
        m.getSource('same').setData(x);
        const first = [await settled(), await names()];
        x.features[0].properties.name = 'b';
        m.getSource('same').setData(x);
        const changed = [await settled(), await names()];
        m.getSource('same').setData(x);
        const again = [await settled(), await names()];
        m.removeLayer('same'); m.removeSource('same');
        return {first, changed, again};
    });
    check(`[${mode}] GeoJSON source: setData with the same object again sends its data and the source loads`, sameObject.first.join() === 'true,a' && sameObject.changed.join() === 'true,b' && sameObject.again.join() === 'true,b', JSON.stringify(sameObject));
    // A paint value that is the same for the whole layer sends no GeoJSON data, and nothing to the tile workers. A new
    // filter sends the rules of the layers to the tile workers, but not the data (#8).
    const edit = await page.evaluate(async () => {
        const m = window.map, count = {geojson: 0, data: 0, rules: 0, contours: 0};
        const protos = [Worker.prototype, MessagePort.prototype], real = protos.map(p => p.postMessage);
        protos.forEach((p, i) => { p.postMessage = function (msg, ...rest) {
            if (msg?.type === 'geojson') count.geojson++;
            if (msg?.type === 'style' && msg.style) count.data += Object.keys(msg.data ?? {}).length + Object.values(msg.style.sources).filter(s => s.data !== undefined).length;
            if (msg?.type === 'style' && msg.layers) count.rules++;
            if (msg?.type === 'contours') count.contours++;
            return real[i].call(this, msg, ...rest);
        }; });
        const settle = () => new Promise(r => setTimeout(r, 300));
        try {
            await settle();
            for (const k in count) count[k] = 0;
            m.setPaintProperty('zones-fill', 'fill-color', '#0a0');
            await settle();
            const paint = {...count};
            for (const k in count) count[k] = 0;
            m.setFilter('zones-fill', ['has', 'name']);
            await settle();
            const filter = {...count};
            m.setFilter('zones-fill', null);
            await settle();
            // 100 edits in one task compare the rules of the layers once, as one edit does: count the calls of JSON.stringify.
            const stringify = JSON.stringify;
            let calls = 0;
            JSON.stringify = function (...a) { calls++; return stringify.apply(this, a); };
            try {
                m.setPaintProperty('zones-fill', 'fill-opacity', 0.4);
                await Promise.resolve(); await Promise.resolve();
                const one = calls;
                calls = 0;
                for (let i = 0; i < 100; i++) m.setPaintProperty('zones-fill', 'fill-opacity', 0.3 + i / 1000);
                await Promise.resolve(); await Promise.resolve();
                return {paint, filter, stringify: {one, hundred: calls}};
            } finally { JSON.stringify = stringify; await settle(); }
        } finally { protos.forEach((p, i) => { p.postMessage = real[i]; }); }
    });
    check(`[${mode}] A style edit sends no GeoJSON data, and the tile workers get only rules that changed`, Object.values(edit.paint).every(n => n === 0) && edit.filter.geojson === 0 && edit.filter.data === 0 && (mode === 'worker' || edit.filter.rules > 0), JSON.stringify(edit));
    check(`[${mode}] 100 style edits in one task compare the style once`, edit.stringify.one > 0 && edit.stringify.hundred < edit.stringify.one * 2, JSON.stringify(edit.stringify));
    await page.evaluate(() => { window.map.removeLayer('zones-fill'); window.map.removeSource('zones'); });

    // DOM marker and popup with MapLibre's API.
    const dom = await page.evaluate(async () => {
        const {Marker, Popup, Point} = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.map;
        const marker = new Marker({color: '#c00'}).setLngLat([-74.0065, 40.7085]).setPopup(new Popup({offset: 30}).setText('Hello')).addTo(m);
        marker.togglePopup();
        const tip = marker.getElement().getBoundingClientRect(), at = m.project([-74.0065, 40.7085]);
        const open = document.querySelector('.maplibregl-popup-content')?.textContent;
        // `offset` is a `PointLike`: `{x, y}` moves the marker as `[x, y]` does (#208).
        const moved = new Marker({color: '#c00', offset: {x: 7, y: -5}}).setLngLat([-74.0065, 40.7085]).addTo(m), r = moved.getElement().getBoundingClientRect();
        const shift = [(r.left + r.right) / 2 - (tip.left + tip.right) / 2, r.bottom - tip.bottom], got = moved.setOffset([3, 4]).getOffset(), isPoint = got instanceof Point;
        moved.remove();
        marker.remove();
        // The popup plays a short closing animation before it is removed. (A slow machine can take longer than the animation.)
        for (let i = 0; i < 30 && document.querySelector('.maplibregl-marker, .maplibregl-popup'); i++) await new Promise(r => setTimeout(r, 100));
        return {dx: Math.abs((tip.left + tip.right) / 2 - at.x), dy: Math.abs(tip.bottom - at.y), shift, got, isPoint, open, gone: !document.querySelector('.maplibregl-marker, .maplibregl-popup')};
    });
    check(`[${mode}] DOM Marker and Popup`, dom.dx < 1 && dom.dy < 1 && Math.abs(dom.shift[0] - 7) < 1 && Math.abs(dom.shift[1] + 5) < 1 && dom.got.x === 3 && dom.got.y === 4 && dom.isPoint && dom.open.startsWith('Hello') && dom.gone, JSON.stringify(dom));
    // #672: a popup `offset` that is `{x, y}`, a `Point` or a point per anchor moves the popup as `[x, y]` does.
    const popOffset = await page.evaluate(async () => {
        const {Popup, Point} = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.map;
        const at = (offset) => { const p = new Popup({anchor: 'bottom', offset, closeOnClick: false}).setLngLat([-74.0065, 40.7085]).setText('x').addTo(m), r = p.getElement().getBoundingClientRect(); p.remove(); return [r.left, r.bottom]; };
        const base = at([0, 0]);
        return [[7, -5], {x: 7, y: -5}, new Point(7, -5), {bottom: {x: 7, y: -5}}, {bottom: new Point(7, -5)}].map(o => { const r = at(o); return [Math.round(r[0] - base[0]), Math.round(r[1] - base[1])]; });
    });
    check(`[${mode}] Popup offset as {x, y}, a Point or a point per anchor (#672)`, popOffset.every(([dx, dy]) => dx === 7 && dy === -5), JSON.stringify(popOffset));

    // A PMTiles archive as a vector source, read by range requests.
    const pm = await page.evaluate(async () => {
        const m = window.map;
        m.addSource('admin', {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'});
        m.addLayer({id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features', paint: {'line-color': '#70c', 'line-width': 2}});
        // Adding the source first fetches the archive's header, so poll until the source answers queries.
        for (let i = 0; i < 40; i++) {
            const found = await m.querySource('admin', [-74.0065, 40.7085], {sourceLayers: ['county_features']});
            if (found.length) return found.map(f => f.properties.NAME);
            await new Promise(r => setTimeout(r, 250));
        }
        return [];
    });
    check(`[${mode}] PMTiles archive source`, pm.includes('New York'), JSON.stringify(pm));
    await page.evaluate(() => { window.map.removeLayer('counties'); window.map.removeSource('admin'); });
    await idle(page);

    // Resizing: the canvas ends up exactly covering the container, with the map centre still in the middle.
    await idle(page); // the camera must be at rest, or the centre legitimately changes underneath the comparison
    const centreBefore = await page.evaluate(() => window.map.getCenter());
    await page.setViewportSize({width: 820, height: 560});
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => { const c = window.map.getCanvas(), b = c.getBoundingClientRect(), m = window.map.getContainer().getBoundingClientRect();
        return {css: [b.width, b.height, b.left, b.top], box: [m.width, m.height], mid: window.map.project(window.map.getCenter()), centre: window.map.getCenter()}; });
    check(`[${mode}] resize keeps the canvas matched to its container`, r.css[0] === 820 && r.css[1] === 560 && r.css[2] === 0 && r.css[3] === 0 && Math.abs(r.mid.x - 410) < 0.01 && Math.abs(r.mid.y - 280) < 0.01 && r.centre.lng === centreBefore.lng, JSON.stringify({css: r.css, mid: r.mid, before: centreBefore, after: r.centre}));
    await page.setViewportSize({width: 1000, height: 700});
    await page.waitForTimeout(300);
    // Padding: with a panel over the left 300px, the map centre is drawn in the middle of what remains.
    const padded = await page.evaluate(async () => {
        const m = window.map;
        m.jumpTo({center: [-74.0065, 40.7085], zoom: 14, bearing: 0, pitch: 0});
        m.setPadding({left: 300});
        await new Promise(r => setTimeout(r, 300));
        const size = m.getContainer().getBoundingClientRect(), at = m.project(m.getCenter()), pad = m.getPadding();
        m.setPadding(0);
        return {at, expected: [size.width / 2 + 150, size.height / 2], pad};
    });
    check(`[${mode}] setPadding moves the centre to the middle of the unpadded area`, Math.abs(padded.at.x - padded.expected[0]) < 0.5 && Math.abs(padded.at.y - padded.expected[1]) < 0.5 && padded.pad.left === 300, JSON.stringify(padded));

    // Feature state: set, read back and removed through the API, with tiles rebuilt in the background and no errors.
    // Tiles are built again only when a layer of the source reads feature state. (With the engine on the main thread,
    // the requests to the tile workers leave the page, so the test can count them.)
    const fs = await page.evaluate(async () => {
        const m = window.map, f = {source: 'omt', sourceLayer: 'building', id: 1}, wait = ms => new Promise(r => setTimeout(r, ms));
        const post = MessagePort.prototype.postMessage;
        let rebuilds = 0;
        MessagePort.prototype.postMessage = function (message, ...rest) { if (message?.type === 'load' && message.req?.again) rebuilds++; return post.call(this, message, ...rest); };
        for (let i = 0; i < 5; i++) { m.setFeatureState(f, {hover: i % 2 === 0}); await wait(60); }
        m.removeFeatureState({source: 'omt'});
        const idle = await Promise.race([new Promise(r => m.once('idle', () => r(true))), wait(3000).then(() => false)]);
        await wait(400);
        const unread = rebuilds;
        m.setPaintProperty('building', 'fill-color', ['case', ['boolean', ['feature-state', 'hover'], false], '#f00', '#ddd']);
        await wait(1500);
        const edit = rebuilds;
        // (The check waits for the first rebuild, for at most 5 s: a tile that is still being built for the edit above
        // is built again when that build ends, which on a loaded machine came later than a fixed 600 ms, #328.)
        const asked = performance.now();
        m.setFeatureState(f, {hover: true});
        while (rebuilds === edit && performance.now() - asked < 5000) await wait(20);
        const read = rebuilds - edit, readMs = Math.round(performance.now() - asked);
        // The page sends only the features that changed: with 10,000 states, one call sends one state.
        for (let i = 0; i < 10000; i++) m.setFeatureState({source: 'omt', sourceLayer: 'building', id: 100000 + i}, {hover: true});
        const sent = [];
        MessagePort.prototype.postMessage = function (message, ...rest) { if (message?.type === 'featureState') sent.push(JSON.stringify(message.states).length); return post.call(this, message, ...rest); };
        m.setFeatureState(f, {hover: false});
        await wait(200);
        m.removeFeatureState({source: 'omt'});
        MessagePort.prototype.postMessage = post;
        m.setFeatureState(f, {hover: true}); m.setFeatureState(f, {picked: 1});
        const both = m.getFeatureState(f);
        m.removeFeatureState(f, 'hover');
        const one = m.getFeatureState(f);
        m.removeFeatureState({source: 'omt'});
        await new Promise(r => setTimeout(r, 400));
        // A text id on a vector source has no effect: one warning (#207). A string of digits gives no warning.
        const warn = console.warn, warned = [];
        console.warn = msg => warned.push(String(msg));
        m.setFeatureState({source: 'omt', sourceLayer: 'building', id: '7'}, {hover: true});
        m.setFeatureState({source: 'omt', sourceLayer: 'building', id: 'abc'}, {hover: true});
        m.setFeatureState({source: 'omt', sourceLayer: 'building', id: 'def'}, {hover: true});
        console.warn = warn;
        m.removeFeatureState({source: 'omt'});
        return {both, one, none: m.getFeatureState(f), unread, read, readMs, idle, sent, warned};
    });
    check(`[${mode}] setFeatureState with a text id on a vector source warns once`, fs.warned.length === 1 && /setFeatureState\(\): the source "omt"/.test(fs.warned[0]), JSON.stringify(fs.warned));
    check(`[${mode}] feature state is set, merged and removed, and the map is idle after a state that no layer reads`, fs.both.hover === true && fs.both.picked === 1 && !('hover' in fs.one) && fs.one.picked === 1 && Object.keys(fs.none).length === 0 && fs.idle, JSON.stringify(fs));
    // A GeoJSON feature with the id '12' has the id 12 (#528). The string and the number name the same feature state, as
    // in MapLibre GL JS 6.17.0, and '012' is another id there and here (#753).
    const digitId = await page.evaluate(async () => {
        const m = window.map, s = 'fs-digits', point = id => ({type: 'Feature', id, properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}});
        m.addSource(s, {type: 'geojson', data: {type: 'FeatureCollection', features: [point('12')]}});
        m.setFeatureState({source: s, id: '12'}, {on: true});
        const r = {number: m.getFeatureState({source: s, id: 12}), string: m.getFeatureState({source: s, id: '12'}), padded: m.getFeatureState({source: s, id: '012'})};
        m.removeFeatureState({source: s, id: '12'}, 'on');
        r.removed = m.getFeatureState({source: s, id: 12});
        m.removeSource(s);
        return r;
    });
    check(`[${mode}] setFeatureState and removeFeatureState with the id '12' reach the GeoJSON feature whose id became 12 (#753)`,
        digitId.number.on === true && digitId.string.on === true && Object.keys(digitId.padded).length === 0 && Object.keys(digitId.removed).length === 0, JSON.stringify(digitId));
    if (mode === 'main') check('[main] setFeatureState builds tiles again only when a layer of the source reads feature state', fs.unread === 0 && fs.read > 0, JSON.stringify({unread: fs.unread, read: fs.read, readMs: fs.readMs}));
    if (mode === 'main') check('[main] setFeatureState sends the tile workers only the state that changed', fs.sent.length > 0 && fs.sent[0] < 200, JSON.stringify(fs.sent));

    // Map events and interaction handlers, as plugins for MapLibre use them: a listener can take a drag for itself
    // with preventDefault(), and a handler can be turned off.
    await page.evaluate(() => {
        const m = window.map; m.jumpTo({center: [-74.0065, 40.7085], zoom: 14, bearing: 0, pitch: 0});
        window.seen = {types: [], renders: 0, sourcedata: 0};
        for (const t of ['mousedown', 'mouseup', 'mousemove', 'dblclick', 'contextmenu', 'wheel', 'mouseover', 'mouseout']) m.on(t, e => { if (!window.seen.types.includes(t)) window.seen.types.push(t); if (t === 'mousedown' && window.block) e.preventDefault(); if (t === 'wheel' && window.blockWheel) e.preventDefault(); });
        m.on('render', () => window.seen.renders++);
        m.on('sourcedata', e => { if (e.isSourceLoaded) window.seen.sourcedata++; });
    });
    await settle(page);
    const centre = () => page.evaluate(() => { const c = window.map.getCenter(); return [c.lng, c.lat, window.map.getZoom()]; });
    const drag = async () => { await page.mouse.move(500, 350); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(500 + i * 10, 350, {steps: 1}); await page.mouse.up(); await page.waitForTimeout(600); await settle(page); };
    const c0 = await centre();
    await page.evaluate(() => { window.block = true; }); await drag();
    const cBlocked = await centre();
    await page.evaluate(() => { window.block = false; window.map.dragPan.disable(); }); await drag();
    const cOff = await centre();
    // (A slow test machine can take longer than the wait in `drag` to start the movement: wait until the pose has changed.)
    const changed = from => page.waitForFunction(f => { const c = window.map.getCenter(); return [c.lng, c.lat, window.map.getZoom()].join() !== f.join(); }, from, {timeout: 5000, polling: 50}).catch(() => {});
    await page.evaluate(() => { window.map.dragPan.enable(); }); await drag(); await changed(cOff); await settle(page);
    const cMoved = await centre();
    await page.evaluate(() => { window.blockWheel = true; }); await page.mouse.wheel(0, -400); await page.waitForTimeout(500); await settle(page);
    const zBlocked = (await centre())[2];
    await page.evaluate(() => { window.blockWheel = false; }); await page.mouse.wheel(0, -400); await changed(await centre()); await page.waitForTimeout(700); await settle(page);
    const zMoved = (await centre())[2];
    await page.mouse.dblclick(500, 350); await page.mouse.click(500, 350, {button: 'right'}); await page.mouse.move(2000, 2000); await page.waitForTimeout(600); await settle(page);
    // Box zoom: shift and drag zooms to the box.
    const zBox0 = (await centre())[2];
    await page.mouse.move(400, 250); await page.keyboard.down('Shift'); await page.mouse.down(); await page.mouse.move(500, 320, {steps: 3}); await page.mouse.move(600, 400, {steps: 3}); await page.mouse.up(); await page.keyboard.up('Shift');
    await page.waitForTimeout(700); await settle(page);
    const zBox = (await centre())[2];
    await page.evaluate(() => window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14}));
    await settle(page);
    const ev = await page.evaluate(async () => {
        const m = window.map, mod = await import('/dist/map-jr-gl-maplibre-compat.js'), b = m.getBounds();
        return {...window.seen, lngLat: m.getCenter() instanceof mod.LngLat, bounds: b instanceof mod.LngLatBounds && b.getWest() < b.getEast() && b.contains(m.getCenter()), handler: m.scrollZoom.isEnabled() && m.boxZoom.isEnabled()};
    });
    check(`[${mode}] map events and handlers: preventDefault and dragPan.disable stop a drag, a wheel event can be prevented, render and sourcedata fire`,
        cBlocked[0] === c0[0] && cOff[0] === c0[0] && cMoved[0] !== c0[0] && zBlocked === cMoved[2] && zMoved > zBlocked
        && ['mousedown', 'mouseup', 'mousemove', 'dblclick', 'contextmenu', 'wheel', 'mouseout'].every(t => ev.types.includes(t)) && ev.renders > 5 && ev.sourcedata > 0 && ev.lngLat && ev.bounds && ev.handler && zBox > zBox0 + 1,
        JSON.stringify({c0, cBlocked, cOff, cMoved, zBlocked, zMoved, zBox0, zBox, ...ev}));

    // #765: as in MapLibre, `data` fires with `dataType: 'source'` and `e.tile` for each tile that loads.
    const tileEvents = await page.evaluate(async () => {
        const m = window.map, got = new Set(), drawn = new Set(), odd = 'a/b|c';
        let bad = 0, oddTiles = 0;
        m.addSource(odd, {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-73.98, 40.75]}}});
        m.addLayer({id: 'odd-765', type: 'circle', source: odd});
        const onData = e => { if (e.dataType !== 'source' || !e.tile) return; if (e.sourceId === odd) oddTiles++; if (e.sourceId === 'omt') got.add(e.tile.tileID.canonical.key); if (e.tile.tileID.canonical.key !== `${e.tile.tileID.canonical.z}/${e.tile.tileID.canonical.x}/${e.tile.tileID.canonical.y}`) bad++; };
        const onFrame = e => { if (e.kind === 'frame') { drawn.clear(); for (const k of [e.key].flat()) if (k.startsWith('omt|')) drawn.add(k.split('|')[1]); } };
        m.on('data', onData); m.on('tile', onFrame); m._tileReport(true);
        m.jumpTo({center: [-73.98, 40.75], zoom: 15});
        await new Promise(r => m.once('idle', r));
        m._tileReport(false); m.off('data', onData); m.off('tile', onFrame);
        m.removeLayer('odd-765'); m.removeSource(odd);
        return {oddTiles, got: got.size, drawn: [...drawn], missing: [...drawn].filter(k => !got.has(k)), bad};
    });
    check(`[${mode}] data events with dataType "source" carry e.tile for each tile that loads, also for a source id with "/" and "|"`, tileEvents.drawn.length > 0 && tileEvents.missing.length === 0 && tileEvents.bad === 0 && tileEvents.oddTiles > 0, JSON.stringify(tileEvents));

    // #7: `dblclick` reaches the listener after a query of the engine. preventDefault() there still stops the zoom, and
    // without it the map zooms. The array of queryRenderedFeatures is not an answer from before setData.
    const dbl = async prevent => {
        await page.evaluate(() => window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14})); await settle(page);
        await page.evaluate(prevent => { window.dbl = 0; window.map.once('dblclick', e => { window.dbl++; if (prevent) e.preventDefault(); }); }, prevent);
        await page.mouse.dblclick(500, 350); await page.waitForFunction(() => window.dbl > 0, null, {timeout: 5000}).catch(() => {}); await page.waitForTimeout(700); await settle(page);
        return (await centre())[2];
    };
    const zPrevented = await dbl(true), zDouble = await dbl(false);
    check(`[${mode}] dblclick: preventDefault() in a listener stops the zoom, and without it the map zooms in`, zPrevented === 14 && Math.abs(zDouble - 15) < 0.01, JSON.stringify({zPrevented, zDouble}));
    // A touch double-tap: preventDefault() in a `dblclick` listener stops its zoom too, and `defaultPrevented` reads true.
    const tap2 = async prevent => {
        await page.evaluate(() => window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14})); await settle(page);
        await page.evaluate(async prevent => {
            window.dbl = 0; window.dblSeen = null;
            window.map.once('dblclick', e => { window.dbl++; if (prevent) e.preventDefault(); window.dblSeen = e.defaultPrevented; });
            for (let i = 0; i < 2; i++) { window.touch('pointerdown', 11, 500, 350); window.touch('pointerup', 11, 500, 350); await new Promise(r => setTimeout(r, 60)); }
        }, prevent);
        await page.waitForFunction(() => window.dbl > 0, null, {timeout: 5000}).catch(() => {}); await page.waitForTimeout(700); await settle(page);
        return {z: (await centre())[2], seen: await page.evaluate(() => window.dblSeen)};
    };
    const tPrevented = await tap2(true), tDouble = await tap2(false);
    check(`[${mode}] touch double-tap: preventDefault() in a dblclick listener stops the zoom and sets defaultPrevented`, tPrevented.z === 14 && tPrevented.seen === true && Math.abs(tDouble.z - 15) < 0.01 && tDouble.seen === false, JSON.stringify({tPrevented, tDouble}));
    await page.evaluate(() => window.map.jumpTo({center: [-74.0065, 40.7085], zoom: 14})); await settle(page);
    // #7: a touch tap with no hover before it: the listener reads the features of tiles at once, and the time from
    // pointerdown to `click` is printed.
    const tap = await page.evaluate(async () => {
        const m = window.map, c = m.getCanvas(), r = {}, x = c.clientWidth / 2 - 70, y = c.clientHeight / 2 + 50;
        m.once('click', e => { r.ms = Math.round(performance.now() - r.t0); r.found = [...m.queryRenderedFeatures(e.point)].filter(f => f.sourceLayer).length; });
        await new Promise(f => setTimeout(f, 500)); r.t0 = performance.now(); window.touch('pointerdown', 11, x, y); await new Promise(f => setTimeout(f, 80)); window.touch('pointerup', 11, x, y);
        await new Promise(f => setTimeout(f, 1000)); delete r.t0;
        // The tap lands on a pin, so the demo opens a popup there that would cover the clicks of the tests below.
        window.popup?.remove(); return r;
    });
    check(`[${mode}] a touch tap with no hover: a click listener reads the features of tiles at once`, tap.found > 0, JSON.stringify(tap));
    const stale = await page.evaluate(async () => {
        const m = window.map, idle = () => new Promise(r => m.once('idle', r)), at = [-74.0065, 40.7085];
        m.jumpTo({center: at, zoom: 14});
        m.addSource('stale', {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: at}}});
        m.addLayer({id: 'stale-dot', type: 'circle', source: 'stale', paint: {'circle-radius': 8}});
        await idle();
        const p = m.project(at), ask = () => m.queryRenderedFeatures(p, {layers: ['stale-dot']});
        const first = (await ask()).length, kept = ask().length;
        let wait = idle(); m.getSource('stale').setData({type: 'FeatureCollection', features: []});
        const before = ask().length; await wait;
        const array = ask().length, awaited = (await ask()).length;
        m.removeLayer('stale-dot'); m.removeSource('stale');
        return {first, kept, before, array, awaited};
    });
    check(`[${mode}] queryRenderedFeatures: the array is not the answer from before setData`, stale.first === 1 && stale.kept === 1 && stale.before === 0 && stale.array === 0 && stale.awaited === 0, JSON.stringify(stale));
    await settle(page);
    // #7: `click` and `contextmenu` reach a map listener within 300 ms of the pointer event (the bounded wait for the
    // features), not after a query of any length.
    await page.evaluate(() => {
        window.late = {}; const t = {};
        for (const [dom, ev] of [['pointerup', 'click'], ['contextmenu', 'contextmenu']]) {
            window.addEventListener(dom, () => { t[ev] = performance.now(); }, {once: true, capture: true});
            window.map.once(ev, () => { window.late[ev] = Math.round(performance.now() - t[ev]); });
        }
    });
    await page.mouse.click(500, 350); await page.mouse.click(500, 350, {button: 'right'}); await page.waitForTimeout(500);
    const lateness = await page.evaluate(() => window.late);
    check(`[${mode}] click and contextmenu: a map listener runs within 300 ms of the pointer event`, lateness.click <= 330 && lateness.contextmenu <= 330, JSON.stringify(lateness));
    await settle(page);

    // transformRequest and addProtocol: the functions are on the page, and the requests are made in workers.
    const requests = await page.evaluate(async () => {
        const m = window.map, mod = await import('/dist/map-jr-gl-maplibre-compat.js'), c = m.getCenter(), kinds = new Set();
        m.setTransformRequest((url, kind) => { kinds.add(kind); return {url: url + (url.includes('?') ? '&' : '?') + 'seen=1'}; });
        mod.addProtocol('made', async request => ({data: {type: 'Feature', id: 3, properties: {from: request.url}, geometry: {type: 'Point', coordinates: [c.lng, c.lat]}}}));
        m.addSource('made', {type: 'geojson', data: 'made://point'});
        m.addLayer({id: 'made', type: 'circle', source: 'made', paint: {'circle-radius': 6}});
        m.jumpTo({center: [c.lng + 0.3, c.lat + 0.2]}); // a place with tiles that are not loaded, so that tile requests go through the transform
        let found = [];
        for (let i = 0; i < 50 && !kinds.has('Tile'); i++) await new Promise(r => setTimeout(r, 100));
        // Each tile of the new place must arrive. (The tile workers ask the page about each request. With more than one
        // worker, an answer went back with the wrong number, and some tiles never finished.)
        let arrived = false;
        for (let i = 0; i < 100 && !arrived; i++) { await new Promise(r => setTimeout(r, 100)); arrived = m.areTilesLoaded(); }
        m.jumpTo({center: c});
        for (let i = 0; i < 50 && !found.length; i++) { await new Promise(r => setTimeout(r, 100)); found = await m.queryRenderedFeatures({layers: ['made']}); }
        const tiles = performance.getEntriesByType('resource').filter(e => e.name.includes('seen=1')).length;
        m.removeLayer('made'); m.removeSource('made'); m.setTransformRequest(null); mod.removeProtocol('made');
        return {from: found[0]?.properties.from, kinds: [...kinds].sort(), tiles, arrived};
    });
    check(`[${mode}] transformRequest changes tile requests made in workers (each tile arrives), and addProtocol supplies data for a URL`,
        requests.from === 'made://point?seen=1' && requests.kinds.includes('Tile') && requests.kinds.includes('Source') && requests.arrived, JSON.stringify(requests));
    // A protocol named "pmtiles" (the pmtiles library's) is not used, because the library reads pmtiles:// itself: it warns once (#250).
    const pmWarns = await page.evaluate(async () => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), warns = [], warn = console.warn;
        console.warn = (...a) => { warns.push(String(a[0])); };
        try { mod.addProtocol('pmtiles', async () => ({data: new ArrayBuffer(0)})); mod.addProtocol('pmtiles', async () => ({data: new ArrayBuffer(0)})); mod.addProtocol('other', async () => ({data: ''})); }
        finally { console.warn = warn; mod.removeProtocol('pmtiles'); mod.removeProtocol('other'); }
        return warns.filter(w => w.includes('addProtocol'));
    });
    check(`[${mode}] addProtocol('pmtiles') warns once that the library reads pmtiles:// itself`,
        pmWarns.length === 1 && pmWarns[0].startsWith('[map-jr-gl]') && pmWarns[0].includes('pmtiles://'), JSON.stringify(pmWarns));
    // #603: a protocol gets the request of a raster or raster-dem tile with the type `image` and an `accept` header, as in
    // MapLibre GL JS, and it can answer with an ImageBitmap, an HTMLImageElement or the bytes of an image file.
    const drawn = await page.evaluate(async () => {
        const m = window.map, mod = await import('/dist/map-jr-gl-maplibre-compat.js'), asked = {}, kept = [], urls = [];
        const colours = {bitmap: '#ff0000', element: '#00ff00', bytes: '#0000ff', dem: '#018000'};
        mod.addProtocol('drawn', async request => {
            const how = request.url.split('/')[2], c = Object.assign(document.createElement('canvas'), {width: 64, height: 64}), g = c.getContext('2d');
            if (how === 'https:') { urls.push(request.url); return {data: {type: 'FeatureCollection', features: []}}; }
            asked[how] = request.type + ' ' + request.headers?.accept;
            g.fillStyle = colours[how]; g.fillRect(0, 0, 64, 64);
            if (how === 'element') { const img = new Image(); img.src = c.toDataURL(); await img.decode(); return {data: img}; }
            if (how === 'bytes') return {data: await (await new Promise(r => c.toBlob(r))).arrayBuffer()};
            const data = await createImageBitmap(c);
            kept.push(data); // (the protocol keeps its image, as a protocol with a cache does)
            return {data};
        });
        const middle = async () => { const bmp = await createImageBitmap(await m.toBlob()), g = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height})).getContext('2d'); g.drawImage(bmp, 0, 0); return [...g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data].slice(0, 3).join(); };
        const seen = {};
        try {
            for (const how of ['bitmap', 'element', 'bytes']) {
                m.addSource('drawn', {type: 'raster', tiles: [`drawn://${how}/{z}/{x}/{y}`], tileSize: 256});
                m.addLayer({id: 'drawn', type: 'raster', source: 'drawn', paint: {'raster-fade-duration': 0}});
                for (let i = 0; i < 80 && !(asked[how] && m.areTilesLoaded()); i++) await new Promise(r => setTimeout(r, 100));
                await new Promise(r => { m.once('idle', r); m.triggerRepaint(); setTimeout(r, 5000); });
                seen[how] = await middle();
                m.removeLayer('drawn'); m.removeSource('drawn');
            }
            m.addSource('drawn', {type: 'raster-dem', tiles: ['drawn://dem/{z}/{x}/{y}'], tileSize: 256});
            m.addLayer({id: 'drawn', type: 'hillshade', source: 'drawn'});
            for (let i = 0; i < 80 && !(asked.dem && m.areTilesLoaded()); i++) await new Promise(r => setTimeout(r, 100));
            seen.demLoaded = m.areTilesLoaded();
            m.removeLayer('drawn'); m.removeSource('drawn');
            // The compat entry fetches the data of a GeoJSON source for querySourceFeatures: the URL of a protocol that has
            // another URL inside reaches the protocol as it is written.
            m.addSource('drawn', {type: 'geojson', data: 'drawn://https://example.com/points.json'});
            m.querySourceFeatures('drawn');
            for (let i = 0; i < 30 && urls.length < 2; i++) await new Promise(r => setTimeout(r, 100));
            m.removeSource('drawn');
        } finally { mod.removeProtocol('drawn'); }
        return {asked, seen, urls, keptWhole: kept.length > 0 && kept.every(b => b.width === 64)};
    });
    check(`[${mode}] addProtocol: a raster and a raster-dem tile have the request type image, and an ImageBitmap, an HTMLImageElement and bytes are drawn; querySourceFeatures asks for the URL of a GeoJSON source as written (#603)`,
        Object.values(drawn.asked).length === 4 && Object.values(drawn.asked).every(a => a === 'image image/webp,*/*') && drawn.seen.bitmap === '255,0,0' && drawn.seen.element === '0,255,0' && drawn.seen.bytes === '0,0,255' && drawn.seen.demLoaded && drawn.keptWhole && drawn.urls.length === 2 && drawn.urls.every(u => u === 'drawn://https://example.com/points.json'), JSON.stringify(drawn));
    // map.painter (#205): the development build warns once per map, and the value is undefined; the production build does not warn.
    const painter = await page.evaluate(async () => {
        const out = {}, warn = console.warn;
        for (const file of ['map-jr-gl-maplibre-compat.dev.js', 'map-jr-gl-maplibre-compat.js']) {
            const mod = await import('/dist/' + file), warns = [], maps = [];
            console.warn = (...a) => { warns.push(String(a[0])); };
            try {
                for (let i = 0; i < 2; i++) {
                    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:100px'}));
                    maps.push(new mod.Map({container: el, attributionControl: false, style: {version: 8, sources: {}, layers: []}}));
                }
                out[file] = {values: maps.flatMap(m => [m.painter, m.painter]).map(v => v === undefined), warns: warns.filter(w => w.includes('painter'))};
            } finally { console.warn = warn; for (const m of maps) { const el = m.getContainer(); m.remove(); el.remove(); } }
        }
        return out;
    });
    const devP = painter['map-jr-gl-maplibre-compat.dev.js'], prodP = painter['map-jr-gl-maplibre-compat.js'];
    check(`[${mode}] map.painter is undefined; the development build warns once per map, the production build does not warn`,
        [...devP.values, ...prodP.values].every(Boolean) && devP.warns.length === 2 && devP.warns.every(w => w.startsWith('[map-jr-gl] map.painter') && w.includes('supported()')) && prodP.warns.length === 0, JSON.stringify(painter));
    // A member of MapLibre GL JS that a class here does not have (#206): the development build warns once per name, and
    // a map that is used as usual, with controls, a marker and a popup, gives no such warning.
    const missing = await page.evaluate(async () => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.dev.js'), warns = [], warn = console.warn;
        console.warn = (...a) => { warns.push(String(a[0])); };
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
        let m;
        try {
            m = new mod.Map({container: el, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: []}});
            const attribution = new mod.AttributionControl(), scale = new mod.ScaleControl(), geo = new mod.GeolocateControl();
            m.addControl(new mod.NavigationControl()); m.addControl(scale); m.addControl(geo); m.addControl(attribution); m.addControl(new mod.FullscreenControl());
            const popup = new mod.Popup().setText('a'), marker = new mod.Marker().setLngLat([0, 0]).setPopup(popup).addTo(m);
            await new Promise(r => m.once('load', r));
            m.jumpTo({center: [1, 1], zoom: 2}); marker.togglePopup(); marker.togglePopup(); marker.setLngLat([1, 1]);
            await new Promise(r => m.once('idle', r));
            // (Only the warnings about members, which name the entry: a browser with no WebGL2 adds a warning about the renderer.)
            const member = w => w.includes('in @map-jr/map-jr-gl/maplibre-compat'), usual = warns.filter(member);
            for (let i = 0; i < 2; i++) { void attribution.styleOwner; void scale.setUnit; void m.transform; void m.cameraHelper; void m.then; void m.$$typeof; void m.__v_skip; void m.toJSON; }
            return {usual, after: warns.filter(member)};
        } finally { console.warn = warn; m?.remove(); el.remove(); }
    });
    check(`[${mode}] the development build warns once for each member of MapLibre GL JS that a class here does not have, and not in usual use`,
        missing.usual.length === 0 && missing.after.length === 2 && missing.after.every(w => w.startsWith('[map-jr-gl] ')) &&
        ['AttributionControl.styleOwner', 'map.cameraHelper'].every(n => missing.after.some(w => w.includes(n))) && !missing.after.some(w => w.includes('map.transform')), JSON.stringify(missing));
    // The AbortController that a protocol gets is aborted when the request is no longer wanted: a newer setData, a newer
    // setData that drops the diffs of updateData, and the removal of the map (#92).
    const aborts = await page.evaluate(async mode => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), signals = {}, point = name => ({type: 'Feature', id: 1, properties: {name}, geometry: {type: 'Point', coordinates: [0, 0]}});
        // A protocol that answers only after 300 ms, and remembers the signal of each URL.
        mod.addProtocol('slow', (request, ac) => { signals[request.url] = ac.signal; return new Promise(r => setTimeout(() => r({data: {type: 'FeatureCollection', features: [point(request.url)]}}), 300)); });
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
        const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {g: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: []}});
        await new Promise(r => m.once('load', r));
        const source = m.getSource('g');
        try {
            // (2) setData with a URL of a protocol, then a newer setData.
            const old = source.setData('slow://a');
            await new Promise(r => setTimeout(r, 50));
            await source.setData('slow://b');
            await old;
            const name = (await source.getData()).features[0]?.properties.name;
            // (3) updateData on a URL source, then a newer setData that drops its diff.
            const diff = source.updateData({add: [point('diff')]});
            await new Promise(r => setTimeout(r, 50));
            const diffSignal = signals['slow://b'];
            source.setData({type: 'FeatureCollection', features: [point('newer')]});
            await diff;
            // (1) A request that runs when the map is removed.
            source.setData('slow://c');
            await new Promise(r => setTimeout(r, 50));
            const removeSignal = signals['slow://c'];
            m.remove(); el.remove();
            return {setData: signals['slow://a']?.aborted ?? null, name, updateData: diffSignal?.aborted ?? null, remove: removeSignal?.aborted ?? null};
        } finally { mod.removeProtocol('slow'); }
    }, mode);
    check(`[${mode}] addProtocol: the controller is aborted by a newer setData, by a setData that drops the diffs of updateData, and by remove()`,
        aborts.setData === true && aborts.name === 'slow://b' && aborts.updateData === true && aborts.remove === true, JSON.stringify(aborts));
    // Data of a setData that waits behind an update in flight does not draw over newer data that a change of the style
    // carries: a source removed and added again, or setStyle (#856). D1 is large, so that it is still in flight when D2 waits.
    const waited = await page.evaluate(async mode => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), out = {};
        const pts = (v, n) => ({type: 'FeatureCollection', features: Array.from({length: n}, (_, i) => ({type: 'Feature', properties: {v}, geometry: {type: 'Point', coordinates: [(i % 200 - 100) * 0.00005, ((i / 200 | 0) - 50) * 0.00005]}}))});
        const style = d => ({version: 8, sources: {s: {type: 'geojson', data: d}}, layers: [{id: 'c', type: 'circle', source: 's', paint: {'circle-radius': 2}}]});
        const task = () => new Promise(r => setTimeout(r, 0)), idle = m => new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
        for (const how of ['remove and add the source', 'setStyle']) {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
            const m = new mod.Map({container: el, style: style(pts(0, 10)), center: [0, 0], zoom: 15, attributionControl: false, renderer: mode});
            await new Promise(r => m.once('load', r));
            m.getSource('s').setData(pts(1, 40000)); await task();
            m.getSource('s').setData(pts(2, 10)); await task();
            if (how === 'setStyle') m.setStyle(style(pts(3, 10)));
            else { m.removeLayer('c'); m.removeSource('s'); m.addSource('s', {type: 'geojson', data: pts(3, 10)}); m.addLayer({id: 'c', type: 'circle', source: 's', paint: {'circle-radius': 2}}); }
            await idle(m); await new Promise(r => setTimeout(r, 1500)); await idle(m);
            out[how] = [...new Set((await m.querySourceFeatures('s')).map(f => f.properties.v))].join(',');
            m.remove(); el.remove();
        }
        return out;
    }, mode);
    check(`[${mode}] setData that waits behind an update in flight does not draw over the data of a later setStyle or a source added again (#856)`,
        Object.values(waited).every(v => v === '3'), JSON.stringify(waited));

    // #1085: as in MapLibre GL JS, a GeoJSON source without `buffer` keeps 128 pixels past the edges of a tile, in the
    // options of the map, through setStyle and through addSource; a buffer that is given is kept. A line 40 pixels right
    // of a tile edge, 120 pixels wide, has its left part drawn by the tile to the left only when that tile keeps it.
    const buffers = await page.evaluate(async mode => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), out = {};
        const source = buffer => ({type: 'geojson', data: {type: 'LineString', coordinates: [[14.06, 10], [14.06, 30]]}, ...buffer !== undefined && {buffer}});
        const style = (sources, line = true) => ({version: 8, sources, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#000'}}, ...line ? [{id: 'l', type: 'line', source: 'p', paint: {'line-width': 120, 'line-color': '#f00'}}] : []]});
        const red = async m => {
            const bmp = await createImageBitmap(await m.toBlob()), g = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}).getContext('2d');
            g.drawImage(bmp, 0, 0);
            return g.getImageData(bmp.width * 180 / 400, bmp.height * 92 / 300, 1, 1).data[0];
        };
        for (const how of ['options', 'setStyle', 'addSource', 'buffer 16']) {
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
            const first = how === 'options' ? style({p: source()}) : how === 'buffer 16' ? style({p: source(16)}) : style({}, false);
            const m = new mod.Map({container: el, style: first, center: [0, 0], zoom: 1, attributionControl: false, renderer: mode});
            await new Promise(r => m.once('idle', r));
            if (how === 'setStyle') { m.setStyle(style({p: source()})); await new Promise(r => m.once('idle', r)); }
            if (how === 'addSource') { m.addSource('p', source()); m.addLayer({id: 'l', type: 'line', source: 'p', paint: {'line-width': 120, 'line-color': '#f00'}}); await new Promise(r => m.once('idle', r)); }
            out[how] = await red(m);
            m.remove(); el.remove();
        }
        return out;
    }, mode).catch(e => ({error: String(e)}));
    check(`[${mode}] a GeoJSON source without buffer keeps 128 pixels past the tile edge, from the options, setStyle and addSource, and a buffer that is given is kept (#1085)`,
        JSON.stringify(buffers) === JSON.stringify({options: 255, setStyle: 255, addSource: 255, 'buffer 16': 0}), JSON.stringify(buffers));

    // A map made in a container that is not yet in the page: the container is positioned and clips once it is attached (#201).
    const detached = await page.evaluate(async mode => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
        const el = Object.assign(document.createElement('div'), {style: 'width:100px;height:80px'});
        const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: []}});
        document.body.appendChild(el);
        const s = getComputedStyle(el), r = {position: s.position, overflow: s.overflow};
        m.remove();
        r.after = el.classList.contains('map-jr-map'); el.remove();
        return r;
    }, mode);
    check(`[${mode}] a map made in a detached container gets position: relative and overflow: hidden once attached`,
        detached.position === 'relative' && detached.overflow === 'hidden' && !detached.after, JSON.stringify(detached));

    // A lost WebGL context (phones take it away to save memory): the map starts again with the same view and data.
    // The context can only be reached from the page when the engine is on the main thread.
    if (mode === 'main') {
        const lost = await page.evaluate(async () => {
            const m = window.map, before = m.getCanvas(), c = m.getCenter(), z = m.getZoom(), events = [];
            m.on('webglcontextlost', () => events.push('lost')); m.on('webglcontextrestored', () => events.push('restored'));
            before.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
            for (let i = 0; i < 100 && !events.includes('restored'); i++) await new Promise(r => setTimeout(r, 100));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
            const found = await m.queryRenderedFeatures();
            return {events, newCanvas: m.getCanvas() !== before && m.getCanvas().isConnected, same: Math.abs(m.getCenter().lng - c.lng) < 1e-9 && m.getZoom() === z, features: found.length, loaded: m.areTilesLoaded()};
        });
        check(`[${mode}] a lost WebGL context: the map starts again on a new canvas with the same view`, lost.events.join() === 'lost,restored' && lost.newCanvas && lost.same && lost.features > 100, JSON.stringify(lost));
    }

    // A lost WebGL context during an `easeTo`: the new engine runs the animation for the time that is left, so the camera
    // reaches the target and `moveend` fires once (#807). On the worker, the workers of the first start lose their context
    // 600 ms after they get the `ease` (only the engine worker has one). A browser that cannot render in a worker has
    // no engine worker to lose its context: the map draws on the main thread from the start.
    const easeName = `[${mode}] a lost WebGL context during an easeTo: the camera reaches the target and moveend fires once`;
    if (!workerCan) skip(easeName, noWorkerRender);
    else {
    const easeLost = await page.evaluate(async mode => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
        let armed = true;
        const loser = URL.createObjectURL(new Blob([`let lose; const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { const gl = get.call(this, kind, ...rest); if (gl && /webgl/.test(kind)) lose = () => gl.getExtension('WEBGL_lose_context').loseContext(); return gl; }; self.addEventListener('message', e => { let text = ''; try { text = JSON.stringify(e.data); } catch {} if (text.includes('"type":"ease"')) setTimeout(() => lose && lose(), 600); }); importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`], {type: 'text/javascript'}));
        const m = new mod.Map({container: el, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#abc'}}]}, center: [0, 0], zoom: 2, attributionControl: false, renderer: mode,
            ...(mode === 'worker' && {createWorker: () => new Worker(armed ? loser : location.origin + '/dist/map-jr-gl-worker.js')})});
        await new Promise(r => m.once('load', r));
        m.once('webglcontextlost', () => armed = false);
        const events = [];
        for (const type of ['webglcontextlost', 'webglcontextrestored', 'moveend']) m.on(type, () => events.push(type));
        m.easeTo({center: [20, 10], zoom: 4, duration: 3000});
        if (mode === 'main') setTimeout(() => m.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(), 600);
        await new Promise(r => setTimeout(r, 6000));
        const c = m.getCenter(), out = {events, lng: c.lng, lat: c.lat, zoom: m.getZoom(), renderer: m.renderer};
        m.remove(); el.remove();
        return out;
    }, mode);
    check(easeName,
        easeLost.events.includes('webglcontextrestored') && easeLost.events.filter(e => e === 'moveend').length === 1 && Math.abs(easeLost.lng - 20) < 1e-6 && Math.abs(easeLost.lat - 10) < 1e-6 && Math.abs(easeLost.zoom - 4) < 1e-6, JSON.stringify(easeLost));
    }

    // queryRenderedFeatures, as in MapLibre but with a promise: at a point, in a box, and with a list of layers.
    const rendered = await page.evaluate(async () => {
        const m = window.map, c = m.getCenter(), p = m.project(c);
        m.addSource('asked', {type: 'geojson', data: {type: 'FeatureCollection', features: [
            {type: 'Feature', id: 7, properties: {kind: 'spot'}, geometry: {type: 'Point', coordinates: [c.lng, c.lat]}},
            {type: 'Feature', id: 8, properties: {kind: 'far'}, geometry: {type: 'Point', coordinates: [c.lng + 0.01, c.lat]}}]}});
        m.addLayer({id: 'asked', type: 'circle', source: 'asked', paint: {'circle-radius': 6}});
        let at = [];
        for (let i = 0; i < 100 && !at.length; i++) { await new Promise(r => setTimeout(r, 100)); at = await m.queryRenderedFeatures(p, {layers: ['asked']}); }
        const far = m.project([c.lng + 0.01, c.lat]);
        const box = await m.queryRenderedFeatures([[p.x - 5, p.y - 20], [far.x + 5, p.y + 20]], {layers: ['asked']});
        const all = await m.queryRenderedFeatures(), filtered = await m.queryRenderedFeatures({layers: ['asked'], filter: ['==', ['get', 'kind'], 'far']});
        const source = await m.querySourceFeatures('asked');
        const out = {point: at.map(f => f.id), layer: at[0]?.layer?.id, geometry: at[0]?.geometry?.type, box: box.map(f => f.id).sort(), all: all.length, top: all[0]?.layer?.id, filtered: filtered.map(f => f.id), source: source.length};
        // A layer removed while a query is in flight: its features are left out, so every feature has a `layer` (#705).
        const pending = m.queryRenderedFeatures(p, {layers: ['asked']});
        m.removeLayer('asked');
        const gone = await pending;
        out.removed = gone.length; out.noLayer = gone.filter(f => !f.layer).length;
        m.removeSource('asked');
        return out;
    });
    check(`[${mode}] queryRenderedFeatures: a point, a box, all layers (top layer first), a filter; querySourceFeatures; a layer removed during a query`,
        rendered.removed === 0 && rendered.noLayer === 0 && rendered.point.join() === '7' && rendered.layer === 'asked' && rendered.geometry === 'Point' && rendered.box.join() === '7,8' && rendered.all > 10 && rendered.top === 'asked' && rendered.filtered.join() === '8' && rendered.source === 2, JSON.stringify(rendered));

    // querySourceFeatures reads the tile data of the source, as in MapLibre: also features that no layer draws
    // (a layer with `circle-radius: 0`, used for HTML markers) and features in a tile under the view but outside the
    // view. The array at once and the awaited result agree, and an awaited call does not warn (#252).
    const unseen = await page.evaluate(async () => {
        // (Point 2 is 3 pixels right of the view, in the tile of the right edge of the view.)
        const m = window.map, c = m.getCenter(), right = m.getCanvas().clientWidth, cy = m.getCanvas().clientHeight / 2, beyond = m.unproject([right + 3, cy]);
        const point = (id, lng, lat) => ({type: 'Feature', id, properties: {}, geometry: {type: 'Point', coordinates: [lng, lat]}});
        m.addSource('unseen', {type: 'geojson', data: {type: 'FeatureCollection', features: [point(1, c.lng, c.lat), point(2, beyond.lng, beyond.lat)]}});
        m.addLayer({id: 'unseen', type: 'circle', source: 'unseen', paint: {'circle-radius': 0}});
        const warnings = [], warn = console.warn;
        console.warn = (...a) => { warnings.push(String(a[0])); warn(...a); };
        let found = [], now = [];
        try {
            for (let i = 0; i < 50 && found.length < 2; i++) { await new Promise(r => setTimeout(r, 100)); found = await m.querySourceFeatures('unseen'); }
            now = m.querySourceFeatures('unseen'); await now;
        } finally { console.warn = warn; }
        const outside = m.project(beyond).x > right;
        m.removeLayer('unseen'); m.removeSource('unseen');
        return {found: found.map(f => f.id).sort(), now: [...now].map(f => f.id).sort(), outside, warnings: warnings.filter(w => w.includes('querySourceFeatures'))};
    });
    check(`[${mode}] querySourceFeatures: features that no layer draws and features outside the view, the same at once and awaited, no warning`,
        unseen.found.join() === '1,2' && unseen.now.join() === '1,2' && unseen.outside && !unseen.warnings.length, JSON.stringify(unseen));

    // A vector source: without `await`, the array has the last answer for the same source and options, as Maputnik
    // reads it every 5 seconds (#804).
    const vectorSource = await page.evaluate(async () => {
        const m = window.map, id = Object.keys(m.getStyle().sources).find(s => m.getStyle().sources[s].type === 'vector');
        let all = [];
        for (let i = 0; i < 50 && !all.length; i++) { await new Promise(r => setTimeout(r, 100)); all = await m.querySourceFeatures(id); }
        const sourceLayer = all[0]?.sourceLayer, awaited = await m.querySourceFeatures(id, {sourceLayer});
        const now = [...m.querySourceFeatures(id, {sourceLayer})], other = [...m.querySourceFeatures(id, {sourceLayer: 'no-such-layer'})];
        return {sourceLayer, awaited: awaited.length, now: now.length, same: now.every(f => f.sourceLayer === sourceLayer), other: other.length};
    });
    check(`[${mode}] querySourceFeatures on a vector source: a call without await has the last answer for the same source and options (#804)`,
        vectorSource.awaited > 0 && vectorSource.now === vectorSource.awaited && vectorSource.same && vectorSource.other === 0, JSON.stringify(vectorSource));

    // MapLibre code reads the result of queryRenderedFeatures at once. The features of tiles are there when the code
    // asks in a click listener, and when it asks on `idle`.
    {
        await page.evaluate(async () => {
            const m = window.map, c = m.getCanvas(), tiles = p => [...m.queryRenderedFeatures(p)].filter(f => f.sourceLayer).length;
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
            window.atOnce = {idle: [], click: -1};
            window.atOnceIdle = () => window.atOnce.idle.push(tiles([c.clientWidth / 2, c.clientHeight / 2]));
            m.on('idle', window.atOnceIdle); window.atOnceIdle();
            m.once('click', e => { window.atOnce.click = tiles(e.point); });
        });
        await page.waitForTimeout(1500);
        const box = await page.locator('canvas').first().boundingBox();
        await page.mouse.click(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
        await page.waitForTimeout(1000);
        const atOnce = await page.evaluate(() => { window.map.off('idle', window.atOnceIdle); return window.atOnce; });
        check(`[${mode}] queryRenderedFeatures read at once has the features of tiles: in a click listener, and on idle`, atOnce.click > 0 && atOnce.idle.at(-1) > 0 && atOnce.idle.length <= 3, JSON.stringify(atOnce));
    }
    // react-map-gl 8 drives `onMouseEnter` and `cursor` with `queryRenderedFeatures(e.point, {layers})`, read at once in
    // its `mousemove` listener (#195). One move of the mouse onto features of tiles must reach the enter state.
    {
        await page.evaluate(() => {
            const m = window.map, layers = m.getStyle().layers.filter(l => l.source && l.type !== 'raster').map(l => l.id);
            window.hover = {enter: 0, moves: 0};
            window.hoverMove = e => { window.hover.moves++; const f = m.queryRenderedFeatures(e.point, {layers}); if (f.length && !window.hover.on) { window.hover.on = true; window.hover.enter++; } };
            m.on('mousemove', window.hoverMove);
        });
        const box = await page.locator('canvas').first().boundingBox();
        await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2 - 30);
        await page.waitForTimeout(1500);
        const hover = await page.evaluate(() => { window.map.off('mousemove', window.hoverMove); return window.hover; });
        check(`[${mode}] react-map-gl hover: a mousemove listener that reads queryRenderedFeatures with layers at once gets the features`, hover.enter === 1, JSON.stringify(hover));
    }
    // The colour of a marker can come from data: it cannot bring HTML into the page.
    {
        const marker = await page.evaluate(async () => {
            const lib = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.map;
            const one = new lib.Marker({color: '"/></svg><img src=x onerror="window.markerScript=1">'}).setLngLat(m.getCenter()).addTo(m);
            await new Promise(r => setTimeout(r, 300));
            const out = {ran: !!window.markerScript, images: one.getElement().querySelectorAll('img').length, paths: one.getElement().querySelectorAll('path').length};
            one.remove();
            return out;
        });
        check(`[${mode}] a marker colour with HTML in it stays an attribute`, !marker.ran && marker.images === 0 && marker.paths === 1, JSON.stringify(marker));
    }


    const clusters = await page.evaluate(async () => {
        const m = window.map, c = m.getCenter();
        const point = (dx, n) => ({type: 'Feature', properties: {n}, geometry: {type: 'Point', coordinates: [c.lng + dx, c.lat]}});
        m.addSource('grouped', {type: 'geojson', cluster: true, data: {type: 'FeatureCollection', features: [point(0, 1), point(0.00001, 2), point(0.00002, 3)]}});
        m.addLayer({id: 'grouped', type: 'circle', source: 'grouped', paint: {'circle-radius': 10}});
        let found = [];
        for (let i = 0; i < 40 && !found.length; i++) { await new Promise(r => setTimeout(r, 100)); found = await m.querySource('grouped', c, {radius: 10}); }
        const id = found[0]?.properties.cluster_id, source = m.getSource('grouped');
        const out = {count: found[0]?.properties.point_count, zoom: await source.getClusterExpansionZoom(id), leaves: (await source.getClusterLeaves(id)).length};
        m.removeLayer('grouped'); m.removeSource('grouped');
        return out;
    });
    check(`[${mode}] GeoJSON clusters: a cluster in the tiles, and its expansion zoom and points from the source`, clusters.count === 3 && clusters.zoom > 14 && clusters.leaves === 3, JSON.stringify(clusters));

    // 3D terrain, as people use it: a dragged point of ground stays under the pointer on a tilted map, and nothing
    // moves once the drag is over.
    await page.evaluate(() => { const m = window.map; m.jumpTo({center: [7.70, 45.99], zoom: 12, bearing: 20, pitch: 60}); m.setTerrain({source: 'dem', exaggeration: 1.5}); });
    await page.waitForTimeout(500);
    await idle(page);
    const from = {x: 640, y: 420}, held = await page.evaluate(q => window.map.unproject(q), from);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    for (let i = 1; i <= 12; i++) { await page.mouse.move(from.x - i * 10, from.y - i * 5); await page.waitForTimeout(25); }
    // The worker may still be applying the last moves (software rendering is slow): wait until the position has not
    // changed for some time. One quiet interval is not sufficient, because a slow frame can be longer than that.
    const during = await page.evaluate(async q => {
        let at = window.map.project([q.lng, q.lat]);
        for (let i = 0, quiet = 0; i < 40 && quiet < 4; i++) {
            await new Promise(r => setTimeout(r, 150));
            const now = window.map.project([q.lng, q.lat]);
            quiet = Math.hypot(now.x - at.x, now.y - at.y) < 0.01 ? quiet + 1 : 0;
            at = now;
        }
        return at;
    }, held);
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const peakAt = () => page.evaluate(() => window.map.project([7.6586, 45.9763]));
    const rest1 = await peakAt(); await page.waitForTimeout(1500); const rest2 = await peakAt();
    check(`[${mode}] 3D terrain: a dragged point stays under the pointer, and the view is still afterwards`,
        Math.hypot(during.x - (from.x - 120), during.y - (from.y - 60)) < 1.5 && Math.hypot(rest1.x - rest2.x, rest1.y - rest2.y) < 0.5, JSON.stringify({during, rest1, rest2}));
    // A drag over ground whose elevation tiles have not arrived (a slow connection) must still move the map, at each
    // step. (Reported from an iPhone: the map stopped panning at a tile with no terrain yet.)
    const slow = /mapterhorn/, late = async route => { await new Promise(r => setTimeout(r, 2500)); route.continue().catch(() => {}); };
    await page.route(slow, late);
    await page.evaluate(() => window.map.jumpTo({center: [8.45, 46.55], zoom: 12, bearing: 20, pitch: 60})); // ground that is not loaded
    await page.waitForTimeout(400);
    const centres = [];
    for (let k = 0; k < 3; k++) {
        await page.mouse.move(500, 200); await page.mouse.down();
        for (let i = 1; i <= 10; i++) { await page.mouse.move(500 + i * 4, 200 + i * 20); await page.waitForTimeout(30); }
        // (A slow test machine draws these frames slowly: the centre is read when it has changed, or after 3 seconds.)
        const last = centres[k - 1] ?? [8.45, 46.55];
        await page.waitForFunction(([lng, lat]) => { const c = window.map.getCenter(); return Math.hypot(c.lng - lng, c.lat - lat) > 0.01; }, last, {timeout: 3000, polling: 50}).catch(() => {});
        await page.waitForTimeout(250);
        centres.push(await page.evaluate(() => { const c = window.map.getCenter(); return [c.lng, c.lat]; }));
        await page.mouse.up(); await page.waitForTimeout(300);
    }
    await page.unroute(slow, late);
    // Each drag pulls the far ground towards the viewer by a good part of the view: the centre goes on each time.
    const moved = centres.map((c, i) => Math.hypot(c[0] - (i ? centres[i - 1][0] : 8.45), c[1] - (i ? centres[i - 1][1] : 46.55)));
    check(`[${mode}] 3D terrain: a drag moves the map over ground whose elevation has not arrived`, moved.every(d => d > 0.01), JSON.stringify(moved.map(d => +d.toFixed(4))));
    await idle(page).catch(() => {});
    await page.evaluate(() => window.map.setTerrain(null));
    // 3D terrain: the ground rises, so a summit's label position moves up the screen once the map is tilted.
    const terrain = await page.evaluate(async () => {
        const m = window.map, peak = [7.6586, 45.9763];
        m.jumpTo({center: [7.70, 45.99], zoom: 12, bearing: 0, pitch: 60});
        const flat = m.project(peak);
        m.setTerrain({source: 'dem', exaggeration: 1});
        for (let i = 0; i < 150 && !(m.areTilesLoaded() && i > 20); i++) await new Promise(r => setTimeout(r, 100));
        const centre = m.project(m.getCenter()), size = m.getContainer().getBoundingClientRect();
        // On the raised ground a summit appears higher up the screen, and screen points convert both ways.
        const lifted = m.project(peak), ground = m.unproject({x: 600, y: 300}), again = m.project(ground);
        const out = {on: m.getTerrain()?.source, lift: flat.y - lifted.y, roundTrip: Math.hypot(again.x - 600, again.y - 300), centre, mid: [size.width / 2, size.height / 2], loaded: m.areTilesLoaded()};
        m.setTerrain(null);
        m.jumpTo({pitch: 0});
        return {...out, off: m.getTerrain(), flat};
    });
    // Elevation tiles are decoded in the tile workers, which needs OffscreenCanvas there. Safari before 16.4 and the
    // WebKit build for Windows do not have it: the map then has no heights, and these two tests have nothing to test.
    const decodes = await page.evaluate(() => new Promise(resolve => {
        const w = new Worker(URL.createObjectURL(new Blob(['postMessage(typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined")'])));
        w.onmessage = e => resolve(e.data); w.onerror = () => resolve(false);
    }));
    if (!decodes) console.log(`INFO  [${mode}] not tested in this browser (no OffscreenCanvas in workers): 3D terrain heights, relief shading`);
    else check(`[${mode}] 3D terrain turns on and off, keeping the map centre in the middle`, terrain.on === 'dem' && terrain.off === null && terrain.loaded && terrain.lift > 30 && terrain.roundTrip < 1 && Math.abs(terrain.centre.x - terrain.mid[0]) < 0.5 && Math.abs(terrain.centre.y - terrain.mid[1]) < 0.5, JSON.stringify(terrain));
    await page.screenshot({path: `${out}/terrain-${mode}.png`});
    // The `hash` option: the fragment of the URL gives the camera at the start, a movement writes it, and a change of the
    // `idle` comes after changed data is drawn, not before. With the engine on the main thread, a listener can read the
    // canvas in the event: it must show the new picture. A source is not loaded directly after its data changed.
    if (mode === 'main') {
        const late = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const square = id => ({type: 'Feature', id, properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}});
            const full = {type: 'FeatureCollection', features: [square(1)]}, empty = {type: 'FeatureCollection', features: []};
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {g: {type: 'geojson', data: full}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'fill', type: 'fill', source: 'g', paint: {'fill-color': ['case', ['boolean', ['feature-state', 'on'], false], '#00f', '#f00']}}]}});
            await new Promise(r => m.once('load', r));
            const pad = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d', {willReadFrequently: true});
            // The colour of the middle of the map in the next `idle` event, as 'r,g,b'.
            const atIdle = () => new Promise(r => { m.once('idle', () => { const c = m.getCanvas(); pad.drawImage(c, c.width / 2, c.height / 2, 1, 1, 0, 0, 1, 1); r([...pad.getImageData(0, 0, 1, 1).data].slice(0, 3).join()); }); setTimeout(() => r('no idle'), 5000); });
            const out = {};
            let wait = atIdle(); m.getSource('g').setData(empty); out.loadedAfterSetData = m.isSourceLoaded('g'); out.setData = await wait;
            wait = atIdle(); m.getSource('g').setData(full); out.back = await wait;
            wait = atIdle(); m.setFeatureState({source: 'g', id: 1}, {on: true}); out.featureState = await wait;
            wait = atIdle(); m.setFilter('fill', ['==', ['id'], 2]); out.setFilter = await wait;
            wait = atIdle(); m.setFilter('fill', null); m.refreshTiles('g'); out.loadedAfterRefresh = m.isSourceLoaded('g'); out.refreshTiles = await wait;
            m.remove(); el.remove();
            return out;
        });
        check('[main] idle comes after changed data is drawn (setData, setFeatureState, setFilter, refreshTiles), and the source is not loaded before that',
            late.setData === '255,255,255' && late.back === '255,0,0' && late.featureState === '0,0,255' && late.setFilter === '255,255,255' && late.refreshTiles === '0,0,255' && !late.loadedAfterSetData && !late.loadedAfterRefresh, JSON.stringify(late));

        // A layer that comes after a symbol layer in the style draws over that layer's labels, as in MapLibre GL JS. The
        // label is a wide black halo in the middle; a red square after it covers it, and a square before it does not.
        const order = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const point = {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}};
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}};
            const label = {id: 'label', type: 'symbol', source: 'p', layout: {'text-field': 'MMM', 'text-size': 24}, paint: {'text-color': '#000', 'text-halo-color': '#000', 'text-halo-width': 8}};
            const fill = {id: 'fill', type: 'fill', source: 's', paint: {'fill-color': '#f00'}};
            const pad = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d', {willReadFrequently: true});
            const middle = async layers => {
                const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, fadeDuration: 0, style: {version: 8,
                    sources: {p: {type: 'geojson', data: point}, q: {type: 'geojson', data: {...point, geometry: {type: 'Point', coordinates: [-10, 0]}}}, s: {type: 'geojson', data: square}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, ...layers]}});
                const colour = await new Promise(r => { m.once('idle', () => {
                    const c = m.getCanvas(), at = x => { pad.drawImage(c, x, c.height / 2, 1, 1, 0, 0, 1, 1); return [...pad.getImageData(0, 0, 1, 1).data].slice(0, 3).join(); };
                    const centre = at(c.width / 2);
                    r(layers.length > 2 ? centre + '/' + at(m.project([-10, 0]).x * c.width / 200) : centre);
                }); setTimeout(() => r('no idle'), 8000); });
                m.remove();
                return colour;
            };
            // A second symbol layer after the fill, with its label on the left, also over the square (#885).
            const left = {id: 'left', type: 'symbol', source: 'q', layout: {'text-field': 'MMM', 'text-size': 24, 'text-allow-overlap': true, 'text-ignore-placement': true}, paint: {'text-color': '#000', 'text-halo-color': '#000', 'text-halo-width': 8}};
            const out = {fillAbove: await middle([label, fill]), fillBelow: await middle([fill, label]), fillBetween: await middle([label, fill, left])};
            el.remove();
            return out;
        });
        check('[main] a fill layer after a symbol layer draws over its labels, and a fill layer before it draws under them', order.fillAbove === '255,0,0' && order.fillBelow === '0,0,0', JSON.stringify(order));
        check('[main] a fill layer between two symbol layers draws over the labels of the first and under the labels of the second (#885)', order.fillBetween === '255,0,0/0,0,0', JSON.stringify(order));

        // refreshTiles with four tile workers: queries after it see the new tile, and each query goes to the worker
        // that loaded the tile, so the tile is requested one time before the refresh and one time after it.
        const fresh = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            // A vector tile with one layer "a" that has `n` points in the middle of the tile.
            const point = [0x18, 1, 0x22, 5, 9, 0x80, 0x20, 0x80, 0x20];
            const tile = n => { const layer = [0x78, 2, 0x0a, 1, 0x61, ...Array.from({length: n}, () => [0x12, point.length, ...point]).flat(), 0x28, 0x80, 0x20]; return new Uint8Array([0x1a, layer.length, ...layer]).buffer; };
            let points = 5, requests = 0;
            mod.addProtocol('fresh', async () => { requests++; return {data: tile(points)}; });
            // (A worker URL of its own gives this map its own tile workers: the other maps of the page keep theirs.)
            const m = new mod.Map({container: el, renderer: 'main', tileWorkers: 4, workerUrl: '/dist/map-jr-gl-worker.js?fresh', center: [0, 0], zoom: 1, attributionControl: false,
                style: {version: 8, sources: {v: {type: 'vector', tiles: ['fresh://{z}/{x}/{y}'], minzoom: 0, maxzoom: 0}}, layers: [{id: 'a', type: 'circle', source: 'v', 'source-layer': 'a'}]}});
            await new Promise(r => { m.once('idle', r); setTimeout(r, 2000); });
            const counts = async () => { const out = []; for (let i = 0; i < 8; i++) out.push((await m.querySource('v', [0, 0], {radius: 5})).length, (await m.queryRenderedFeatures({layers: ['a']})).length); return out; };
            const before = await counts(), requestsBefore = requests;
            points = 1;
            m.refreshTiles('v');
            // Asked at once, while the new tile loads, and again when it is on the map.
            const during = await counts();
            if (!m.areTilesLoaded()) await new Promise(r => m.once('idle', r));
            const requestsLoaded = requests, after = await counts();
            m.remove(); el.remove(); mod.removeProtocol('fresh');
            return {before, during, after, requestsBefore, requestsForQueries: requests - requestsLoaded};
        });
        check('[main] with four tile workers, queries after refreshTiles see the new tile, and a tile on the map is not requested again for a query',
            fresh.before.every(n => n === 5) && fresh.during.every(n => n === 1) && fresh.after.every(n => n === 1) && fresh.requestsBefore === 1 && fresh.requestsForQueries === 0, JSON.stringify(fresh));
    }
    // once('idle') inside a `load` listener that adds a source (#247): the idle comes after the source is loaded, and
    // a query then finds its feature, as in MapLibre GL JS.
    {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, center: [0, 0], zoom: 1, attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const data = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-60, -40], [60, -40], [60, 40], [-60, 40], [-60, -40]]]}}]};
            const out = await new Promise(res => {
                m.on('load', () => {
                    m.addSource('areas', {type: 'geojson', data});
                    m.addLayer({id: 'areas', type: 'fill', source: 'areas'});
                    m.once('idle', async () => res({tiles: m.areTilesLoaded(), loaded: m.isSourceLoaded('areas'), found: (await m.queryRenderedFeatures([100, 75], {layers: ['areas']})).length}));
                });
                setTimeout(() => res({timeout: true}), 15000);
            });
            m.remove(); el.remove();
            return out;
        });
        check('once(\'idle\') in a load listener that adds a source fires after the source is loaded, and a query finds its feature',
            r.tiles === true && r.loaded === true && r.found === 1, JSON.stringify(r));
    }
    // setWorkerUrl with the worker file of MapLibre GL JS (#219): the URL is ignored with one warning, and the map
    // keeps the worker of this library.
    if (!canWorker) skip('setWorkerUrl with the worker file of MapLibre GL JS is ignored with one warning, and the map keeps its own worker', noWorkerRender);
    else {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); };
            mod.setWorkerUrl('/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs');
            mod.setWorkerUrl('https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl-csp-worker.js');
            console.warn = warn;
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:100px'}));
            const m = new mod.Map({container: el, center: [0, 0], zoom: 1, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
            await new Promise(res => m.once('idle', res));
            const out = {renderer: m.renderer, url: mod.getWorkerUrl(), warns: warns.filter(w => w.includes('setWorkerUrl'))};
            m.remove(); el.remove(); mod.configure({workerUrl: undefined});
            return out;
        });
        check('setWorkerUrl with the worker file of MapLibre GL JS is ignored with one warning, and the map keeps its own worker',
            r.renderer === 'worker' && r.url === '' && r.warns.length === 1 && r.warns[0].startsWith('[map-jr-gl] setWorkerUrl():'), JSON.stringify(r));
    }
    // Options that are accepted and have no effect (#262): each warns once, also when it is given twice. The map warns
    // once per map, and a control once per page, so this runs in one mode. (GeolocateControl is checked further down.)
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); };
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:100px'}));
            let m;
            try {
                m = new mod.Map({container: el, center: [0, 0], zoom: 1, attributionControl: false, logoPosition: 'top-left', validate: false, fadeDuration: 0, pitchWithRotate: false, crossSourceCollisions: false, style: {version: 8, sources: {}, layers: []}});
                for (let i = 0; i < 2; i++) {
                    new mod.NavigationControl({visualizePitch: true});
                    new mod.FullscreenControl({container: document.body});
                    new mod.Popup({locationOccludedOpacity: 0.5});
                    new mod.Marker({opacityWhenCovered: '0.2'});
                }
                // (The default values write no warning.)
                new mod.Map({container: el, attributionControl: false, fadeDuration: 300, pitchWithRotate: true, crossSourceCollisions: true, style: {version: 8, sources: {}, layers: []}}).remove();
            } finally { console.warn = warn; }
            m.remove(); el.remove();
            const names = ['logoPosition', 'validate', 'visualizePitch', 'container', 'fadeDuration', 'pitchWithRotate', 'crossSourceCollisions', 'locationOccludedOpacity', 'opacityWhenCovered'];
            return Object.fromEntries(names.map(n => [n, warns.filter(w => w.startsWith('[map-jr-gl]') && w.toLowerCase().includes('the option ' + n.toLowerCase())).length]));
        });
        // visualizePitch of NavigationControl (#42) and opacityWhenCovered of Marker (the globe, #463) have an effect in
        // this entry, so they write no warning.
        check('maplibre-compat: options with no effect (logoPosition, validate, fadeDuration, pitchWithRotate, crossSourceCollisions, the container of FullscreenControl, and locationOccludedOpacity of Popup) each warn once, and visualizePitch and opacityWhenCovered do not warn',
            Object.entries(r).every(([k, n]) => n === (k === 'visualizePitch' || k === 'opacityWhenCovered' ? 0 : 1)), JSON.stringify(r));
    }
    // #43: easeTo and flyTo of maplibre-compat use `offset` (also with bearing and pitch) and a custom `easing`, without a warning.
    {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); };
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
            const m = new mod.Map({container: el, center: [0, 0], zoom: 3, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
            await new Promise(res => m.once('load', res));
            const out = {};
            try {
                m.easeTo({center: [10, 20], offset: [0, -100], bearing: 90, pitch: 30, duration: 0});
                out.jump = m.project([10, 20]);
                m.easeTo({center: [10, 20], bearing: 0, pitch: 0, duration: 0});
                // A step: nothing moves in the first half of the time, then the map is at the end.
                m.flyTo({center: [-30, 5], offset: {x: 50, y: 0}, easing: t => t < 0.5 ? 0 : 1, duration: 1600});
                await new Promise(res => setTimeout(res, 400));
                out.early = m.getCenter().lng;
                await new Promise(res => m.once('moveend', res));
                out.end = m.project([-30, 5]);
            } finally { console.warn = warn; }
            out.warns = warns.filter(w => w.startsWith('[map-jr-gl]') && /offset|easing/.test(w)).length;
            m.remove(); el.remove();
            return out;
        });
        const near = (p, x, y) => Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1;
        check(`maplibre-compat (${mode}): easeTo and flyTo put the center at the offset and use a custom easing (#43)`,
            near(r.jump, 200, 50) && Math.abs(r.early - 10) < 1e-6 && near(r.end, 250, 150) && r.warns === 0, JSON.stringify(r));
    }
    // #43: flyTo zooms out and back in on the way (van Wijk and Nuij, as MapLibre GL JS), and without `duration` it takes
    // the time that follows from the distance and `speed`. `maxDuration` makes a long flight a jump.
    {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
            const m = new mod.Map({container: el, center: [0, 0], zoom: 5, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
            await new Promise(res => m.once('load', res));
            const out = {low: 99, warns: 0};
            const warn = console.warn;
            console.warn = (...a) => { if (String(a[0]).startsWith('[map-jr-gl]')) out.warns++; };
            try {
                const onMove = () => { out.low = Math.min(out.low, m.getZoom()); };
                m.on('move', onMove);
                const t0 = performance.now();
                m.flyTo({center: [40, 0], zoom: 5, curve: 1.42, speed: 4});
                await new Promise(res => m.once('moveend', res));
                out.ms = performance.now() - t0;
                m.off('move', onMove);
                out.end = [+m.getCenter().lng.toFixed(4), m.getZoom()];
                const t1 = performance.now();
                m.flyTo({center: [-40, 0], maxDuration: 10});
                await new Promise(res => m.once('moveend', res));
                out.jumpMs = performance.now() - t1;
                out.jump = +m.getCenter().lng.toFixed(4);
            } finally { console.warn = warn; }
            m.remove(); el.remove();
            return out;
        });
        // (1820 pixels at zoom 5 in a view of 400 pixels: S is 3.14, so the flight takes 785 ms at speed 4, and its lowest
        // zoom is 2.77, as the formula of MapLibre GL JS gives.)
        check(`maplibre-compat (${mode}): flyTo zooms out on the way, takes its duration from speed, and maxDuration jumps (#43)`,
            r.low < 3.2 && r.end[0] === 40 && r.end[1] === 5 && r.ms > 700 && r.ms < 3000 && r.jump === -40 && r.jumpMs < 500 && r.warns === 0, JSON.stringify(r));
    }
    // #208: Marker takes offset as {x, y}; getImage gives RGBA pixels.
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:100px'}));
            const out = {};
            const m = new mod.Map({container: el, center: [0, 0], zoom: 1, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
            try {
                out.offset = new mod.Marker({offset: {x: 3, y: -4}}).getOffset();
                const px = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 128]);
                await m.addImage('raw', {width: 2, height: 1, data: px});
                const raw = m.getImage('raw').data;
                out.raw = [raw.width, raw.height, raw.data instanceof Uint8Array, [...(raw.data ?? [])].join()];
                const c = Object.assign(document.createElement('canvas'), {width: 2, height: 2}), g = c.getContext('2d');
                g.fillStyle = '#0000ff'; g.fillRect(0, 0, 2, 2);
                await m.addImage('canvas', c);
                const cv = m.getImage('canvas').data;
                out.canvas = [cv.width, cv.height, cv.data instanceof Uint8Array, [...(cv.data?.slice?.(0, 4) ?? [])].join()];
            } finally {
                m.remove(); el.remove();
            }
            return out;
        });
        check('maplibre-compat: Marker offset {x, y}, getImage returns RGBA pixels',
            r.offset?.x === 3 && r.offset?.y === -4 && r.raw?.join('|') === '2|1|true|255,0,0,255,0,255,0,128'
            && r.canvas?.join('|') === '2|2|true|0,0,255,255', JSON.stringify(r));
    }
    // Two styles that are asked for one after the other: the last one wins, also when the first answers later, and
    // also when the first is the style of the constructor. The style, the layers and the pixels agree.
    {
        const styleOf = (name, color) => JSON.stringify({version: 8, name, sources: {}, layers: [{id: name.toLowerCase(), type: 'background', paint: {'background-color': color}}]});
        await page.route('**/test-order-a.json', async r => { await new Promise(res => setTimeout(res, 700)); r.fulfill({contentType: 'application/json', body: styleOf('A', '#f00')}); });
        await page.route('**/test-order-b.json', r => r.fulfill({contentType: 'application/json', body: styleOf('B', '#00f')}));
        const clip = {x: 0, y: 0, width: 200, height: 150};
        const make = style => page.evaluate(async ([style, mode]) => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            window.orderEl?.remove(); window.orderMap?.remove();
            const el = window.orderEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:200px;height:150px;z-index:1000'}));
            const m = window.orderMap = new mod.Map({container: el, style, renderer: mode, attributionControl: false});
            window.orderErrors = [];
            m.on('error', e => window.orderErrors.push(String(e.error?.message ?? e.error)));
        }, [style, mode]);
        const state = async () => {
            await page.waitForTimeout(1800);
            const s = await page.evaluate(() => { const m = window.orderMap; m.setPaintProperty('b', 'background-color', '#00f'); return {name: m.getStyle()?.name, layers: m.getStyle()?.layers.map(l => l.id).join(), errors: window.orderErrors}; });
            await page.waitForTimeout(300);
            return {...s, shot: await page.screenshot({clip})};
        };
        await make('/test-order-b.json');
        await page.waitForTimeout(1200);
        const wanted = await page.screenshot({clip});
        await page.evaluate(() => { window.orderMap.setStyle('/test-order-a.json'); window.orderMap.setStyle('/test-order-b.json'); });
        const later = await state();
        await make('/test-order-a.json');
        await page.evaluate(() => { window.orderMap.setStyle('/test-order-b.json'); });
        const first = await state();
        await page.evaluate(() => { window.orderEl.remove(); window.orderMap.remove(); });
        await page.unroute('**/test-order-a.json'); await page.unroute('**/test-order-b.json');
        const ok = s => s.name === 'B' && s.layers === 'b' && !s.errors.length && s.shot.equals(wanted);
        check(`[${mode}] setStyle two times, the first answer last: the last style is the style, in getStyle, the layers and the pixels`, ok(later), JSON.stringify({...later, shot: later.shot.equals(wanted)}));
        check(`[${mode}] setStyle before the style of the constructor has come: the new style takes its place`, ok(first), JSON.stringify({...first, shot: first.shot.equals(wanted)}));
    }
    // #259: addControl with a value that is not a control fires `error` and returns the map, as in MapLibre GL JS.
    // A position that does not exist throws.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:200px;height:150px'}));
            const m = new mod.Map({container: el, style: {version: 8, sources: {}, layers: []}, renderer: mode, attributionControl: false});
            const errors = [];
            m.on('error', e => errors.push(String(e.error?.message)));
            const out = {};
            try { out.same = m.addControl(undefined) === m && m.addControl({}, 'top-left') === m; } catch (e) { out.threw = String(e); }
            try { m.addControl(new mod.NavigationControl(), 'middle'); } catch (e) { out.bad = String(e.message); }
            m.remove(); el.remove();
            return {...out, errors};
        }, mode);
        check(`[${mode}] compat addControl(undefined) and addControl({}): error event, returns the map; a bad position throws`,
            r.same === true && r.errors.length === 2 && r.errors.every(e => e.includes('addControl()')) && r.bad?.includes('"middle"'), JSON.stringify(r));
    }
    // #44: in the compat entry, toBlob gives the drawn map, and getCanvas().toDataURL() in a `render` listener is not blank.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#0f0'}}]}});
            const centre = async src => { const bmp = await createImageBitmap(src), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d'); g.drawImage(bmp, 0, 0); return Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data); };
            const b = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 10000))]);
            const blob = b ? await centre(b) : null;
            const url = await new Promise(res => { m.once('render', () => res(m.getCanvas().toDataURL())); m.triggerRepaint(); setTimeout(() => res(null), 5000); });
            const fromUrl = url ? await centre(await (await fetch(url)).blob()) : null;
            m.remove(); el.remove();
            return {blob, fromUrl};
        }, mode);
        check(`[${mode}] compat: toBlob and toDataURL in a render listener give the drawn map (#44)`, r.blob?.[1] > 200 && r.blob[0] < 50 && r.fromUrl?.[1] > 200 && r.fromUrl[0] < 50, JSON.stringify(r));
    }
    // #759: the compat entry draws the images in metadata["map-jr:images"] of the style: a template with `params`, and
    // an image when a layer asks for it. setStyle to a style without the key removes them.
    // (In worker mode it also runs with a worker that has no WebGL2: the images of the style stay images of the style
    // after the fall back to the main thread; #853.)
    // (The style has a sprite with a yellow image "box" too: the image of the style takes its place, #1199.)
    await page.route(/\/test-sprite-1199\//, r => r.request().url().includes('.json') ? r.fulfill({contentType: 'application/json', body: JSON.stringify({box: {x: 0, y: 0, width: 40, height: 40, pixelRatio: 1}})})
        : r.fulfill({contentType: 'image/png', body: solidPNG(40, [0xff, 0xff, 0x00])}));
    for (const fall of mode === 'worker' ? [false, true] : [false]) {
        const r = await page.evaluate(async ([mode, fall]) => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(res => setTimeout(res, ms));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const bg = {id: 'bg', type: 'background', paint: {'background-color': '#fff'}};
            const icon = (id, image) => ({id, type: 'symbol', source: 'spot', layout: {'icon-image': image, 'icon-allow-overlap': true, 'icon-ignore-placement': true}});
            const style = {version: 8, metadata: {'map-jr:images': {pin: '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="{{c}}"/></svg>', box: '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#00f"/></svg>', unused: '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'}}, sprite: location.origin + '/test-sprite-1199/s',
                sources: {spot: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}}},
                layers: [bg, icon('pin', ['image', 'pin', {params: {c: '#f00'}}]), {...icon('box', 'box'), layout: {...icon('box', 'box').layout, 'icon-offset': [0, 40]}}, {...icon('other', 'other'), layout: {...icon('other', 'other').layout, 'icon-offset': [0, -40]}}]};
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const failing = fall && {createWorker: () => new Worker(URL.createObjectURL(new Blob([code], {type: 'text/javascript'})))};
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style, ...failing}), resolved = [];
            const square = c => `<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="${c}"/></svg>`;
            // (A resolver of the page gets a name that the style does not have, and not one that it has.)
            m.setMissingStyleImageResolver(name => { resolved.push(name); if (name === 'other') return m.addImage('other', square('#0f0')); });
            const at = async (dy) => { const bmp = await createImageBitmap(await m.toBlob()), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d'); g.drawImage(bmp, 0, 0); const k = bmp.width / 200; return Array.from(g.getImageData(bmp.width >> 1, (bmp.height >> 1) + dy * k, 1, 1).data).slice(0, 3).join(); };
            // (Each step waits for what it expects, up to 20 s, and the check gives the last value: a busy CPU can draw
            // late, and a fixed time made the check fail in some runs; #795.)
            const took = {}, until = async (name, read, ok) => { const t0 = performance.now(); let v = await read(); while (!ok(v) && performance.now() - t0 < 20000) { await wait(100); v = await read(); } took[name] = Math.round(performance.now() - t0); return v; };
            let [pin, box] = await until('pin', async () => [await at(0), await at(40)], ([p, b]) => p === '255,0,0' && b === '0,0,255');
            const had = ['pin', 'box', 'unused'].map(n => m.hasImage(n));
            const other = await until('other', () => at(-40), v => v === '0,255,0');
            // (An image that the page adds under the name of an image of the style wins, and a new style keeps it.)
            await m.addImage('box', square('#f0f'));
            box = await until('addImage', () => at(40), v => v === '255,0,255');
            m.setStyle({version: 8, sources: {}, layers: [bg]});
            await until('setStyle', async () => m.hasImage('pin'), v => !v); // (the image of addImage, box, stays)
            const after = ['pin', 'box', 'other'].map(n => m.hasImage(n));
            m.remove(); el.remove();
            return {renderer: m.renderer, pin, box, other, had, after, resolved, took};
        }, [mode, fall]);
        check(`[${mode}${fall ? ', fell back' : ''}] compat: the images in metadata["map-jr:images"] of the style are drawn (a template with params, an image on demand), an image of the style wins over the sprite image of the same name (#1199), an image of addImage wins, a resolver of the page gets only other names, and setStyle without the key removes them (#759)`,
            (!fall || r.renderer === 'main') && r.pin === '255,0,0' && r.box === '255,0,255' && r.other === '0,255,0' && r.had.join() === 'true,true,false' && r.after.join() === 'false,true,true' && r.resolved.join() === 'other', JSON.stringify(r));
    }
    // #591: the textures of colour ramps (heatmap, line-gradient, color-relief) are deleted when their layer goes. The
    // probe counts live textures whose image is one pixel high (only ramps are), in the page or in the drawing worker.
    if (!workerCan) skip(`[${mode}] the textures of colour ramps are deleted when their layers are removed or the style changes (#591)`, noWorkerRender);
    else {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const probe = `(() => { const P = WebGL2RenderingContext.prototype, live = new Set(), bound = new WeakMap(), ch = new BroadcastChannel('ramps-591-${mode}');
                const bind = P.bindTexture, img = P.texImage2D, del = P.deleteTexture;
                P.bindTexture = function (t, x) { bound.set(this, x); return bind.call(this, t, x); };
                P.texImage2D = function (...a) { const x = bound.get(this); if (x && a.length >= 9) { if (a[4] === 1) live.add(x); else live.delete(x); } return img.apply(this, a); };
                P.deleteTexture = function (x) { live.delete(x); return del.call(this, x); };
                ch.onmessage = e => { if (e.data === 'ask') ch.postMessage(live.size); }; })();`;
            if (mode === 'main') (0, eval)(probe);
            const url = URL.createObjectURL(new Blob([`${probe} importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`], {type: 'text/javascript'}));
            const ch = new BroadcastChannel(`ramps-591-${mode}`);
            // (The tile workers load the same file and answer too, with 0: the largest answer is the one of the drawing context.)
            const ask = () => new Promise(res => { let n = null; ch.onmessage = e => { n = Math.max(n ?? 0, e.data); }; ch.postMessage('ask'); setTimeout(() => res(n), 300); });
            // (The worker draws a new style some frames after `idle` can fire, so the count is read until it is as expected.)
            const count = async want => { let n; for (let i = 0; i < 25 && (n = await ask()) !== want; i++) { m.triggerRepaint(); await new Promise(f => setTimeout(f, 200)); } return n; };
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const pts = {type: 'FeatureCollection', features: [[0, 0], [5, 5]].map(c => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: c}}))};
            const line = {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-20, 0], [20, 0]]}};
            const style = () => ({version: 8, sources: {p: {type: 'geojson', data: pts}, l: {type: 'geojson', data: line, lineMetrics: true}}, layers: [
                {id: 'heat', type: 'heatmap', source: 'p'},
                {id: 'grad', type: 'line', source: 'l', paint: {'line-width': 8, 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#f00', 1, '#00f']}}]});
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 2, style: style(), ...(mode === 'worker' ? {createWorker: () => new Worker(url)} : {})});
            const idle = () => new Promise(res => { m.once('idle', res); m.triggerRepaint(); setTimeout(res, 10000); });
            await idle();
            const out = {renderer: m.renderer, start: await count(2)};
            m.removeLayer('heat'); m.removeLayer('grad'); await idle(); out.removed = await count(0);
            for (let i = 0; i < 3; i++) { m.setStyle(style()); await idle(); }
            out.restyled = await count(2);
            m.setStyle({version: 8, sources: {}, layers: []}); await idle(); out.empty = await count(0);
            m.remove(); el.remove(); ch.close();
            return out;
        }, mode);
        check(`[${mode}] the textures of colour ramps are deleted when their layers are removed or the style changes (#591)`,
            r.renderer === mode && r.start === 2 && r.removed === 0 && r.restyled === 2 && r.empty === 0, JSON.stringify(r));
    }
    // #1450: a removed image source frees its picture and its texture. The probe counts live textures that hold a 3x5
    // image (only the pictures of this check do), on the main thread.
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const P = WebGL2RenderingContext.prototype, live = new Set(), bound = new WeakMap();
            const bind = P.bindTexture, img = P.texImage2D, del = P.deleteTexture;
            P.bindTexture = function (t, x) { bound.set(this, x); return bind.call(this, t, x); };
            P.texImage2D = function (...a) { const x = bound.get(this), s = a[a.length - 1]; if (x) { if (s?.width === 3 && s?.height === 5) live.add(x); else live.delete(x); } return img.apply(this, a); };
            P.deleteTexture = function (x) { live.delete(x); return del.call(this, x); };
            try {
                const c = Object.assign(document.createElement('canvas'), {width: 3, height: 5}), url = c.toDataURL('image/png');
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
                const m = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: []}});
                const idle = () => new Promise(res => { m.once('idle', res); m.triggerRepaint(); setTimeout(res, 10000); });
                await idle();
                let most = 0;
                for (let i = 0; i < 20; i++) {
                    m.addSource(`pic${i}`, {type: 'image', url: `${url}#${i}`, coordinates: [[-10, 10], [10, 10], [10, -10], [-10, -10]]});
                    m.addLayer({id: `pic${i}`, type: 'raster', source: `pic${i}`});
                    await idle(); most = Math.max(most, live.size);
                    m.removeLayer(`pic${i}`); m.removeSource(`pic${i}`);
                    await idle();
                }
                const out = {renderer: m.renderer, most, left: live.size};
                m.remove(); el.remove();
                return out;
            } finally { Object.assign(P, {bindTexture: bind, texImage2D: img, deleteTexture: del}); }
        });
        check('[main] a removed image source frees its picture and its texture: 20 sources added and removed leave no texture (#1450)',
            r.renderer === 'main' && r.most === 1 && r.left === 0, JSON.stringify(r));
    }
    // #46: an image added with `sdf: true` is a signed distance field, and `icon-color` recolours it, as in MapLibre GL JS.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            // A white disc whose alpha falls from 255 at the centre to 0 at the edge: 191 (0.75) is the outline.
            const n = 32, data = new Uint8Array(n * n * 4);
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = (y * n + x) * 4, d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2); data.fill(255, i, i + 3); data[i + 3] = Math.max(0, Math.min(255, 255 - d * 8)); }
            await m.addImage('dot', {width: n, height: n, data}, {sdf: true});
            m.addSource('p', {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}});
            m.addLayer({id: 'p', type: 'symbol', source: 'p', layout: {'icon-image': 'dot'}, paint: {'icon-color': '#f00'}});
            await new Promise(res => { m.once('idle', res); setTimeout(res, 8000); });
            const url = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
            let px = null;
            if (url) { const bmp = await createImageBitmap(url), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d'); g.drawImage(bmp, 0, 0); px = Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data); }
            const meta = m.getImage('dot');
            m.remove(); el.remove();
            return {px, sdf: meta?.sdf};
        }, mode);
        check(`[${mode}] compat: addImage with sdf: true is recoloured by icon-color (#46)`, r.px?.[0] > 200 && r.px[1] < 60 && r.px[2] < 60 && r.sdf === true, JSON.stringify(r));
    }
    // #1433: a distance-field image as fill-pattern is drawn in fill-color, also a fill-color for each feature, as in
    // MapLibre GL JS (its shader fillPattern with u_sdf_pattern). The image is inside its outline everywhere.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            const data = new Uint8Array(16 * 16 * 4).fill(255);
            await m.addImage('sdf', {width: 16, height: 16, data}, {sdf: true});
            const box = (x0, x1, c) => ({type: 'Feature', properties: {c}, geometry: {type: 'Polygon', coordinates: [[[x0, -60], [x1, -60], [x1, 60], [x0, 60], [x0, -60]]]}});
            m.addSource('l', {type: 'geojson', data: box(-170, 0, '#0f0')});
            m.addSource('r', {type: 'geojson', data: box(0, 170, '')});
            m.addLayer({id: 'l', type: 'fill', source: 'l', paint: {'fill-pattern': 'sdf', 'fill-color': ['get', 'c']}});
            m.addLayer({id: 'r', type: 'fill', source: 'r', paint: {'fill-pattern': 'sdf', 'fill-color': '#f00'}});
            await new Promise(res => { m.once('idle', res); setTimeout(res, 8000); });
            const url = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
            let left = null, right = null;
            if (url) {
                const bmp = await createImageBitmap(url), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                left = Array.from(g.getImageData(bmp.width >> 2, bmp.height >> 1, 1, 1).data);
                right = Array.from(g.getImageData(bmp.width * 3 >> 2, bmp.height >> 1, 1, 1).data);
            }
            m.remove(); el.remove();
            return {left, right};
        }, mode);
        check(`[${mode}] compat: a distance-field image as fill-pattern takes fill-color, also for each feature (#1433)`,
            r.left?.[1] > 200 && r.left[0] < 60 && r.left[2] < 60 && r.right?.[0] > 200 && r.right[1] < 60 && r.right[2] < 60, JSON.stringify(r));
    }
    // #1469: with fill-antialias true and no fill-outline-color, a fill-pattern layer draws its edges in the pattern,
    // as in MapLibre GL JS (its program fillOutlinePattern). The fill starts 0.3 pixels left of the middle of the canvas,
    // so the edge line runs through the column left of the middle, which the fill does not cover. With fill-antialias
    // false that column stays white, also with a fill-outline-color.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            const data = new Uint8Array(16 * 16 * 4);
            for (let i = 0; i < data.length; i += 4) { data[i] = 255; data[i + 3] = 255; }
            await m.addImage('red', {width: 16, height: 16, data});
            const box = (y0, y1) => ({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-0.1, y0], [170, y0], [170, y1], [-0.1, y1], [-0.1, y0]]]}});
            m.addSource('a', {type: 'geojson', data: box(3, 60)});
            m.addSource('b', {type: 'geojson', data: box(-60, -3)});
            m.addLayer({id: 'a', type: 'fill', source: 'a', paint: {'fill-pattern': 'red', 'fill-color': '#00f'}});
            m.addLayer({id: 'b', type: 'fill', source: 'b', paint: {'fill-pattern': 'red', 'fill-color': '#00f', 'fill-outline-color': '#0f0', 'fill-antialias': false}});
            await new Promise(res => { m.once('idle', res); setTimeout(res, 8000); });
            const url = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
            let on = null, off = null;
            if (url) {
                const bmp = await createImageBitmap(url), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                on = Array.from(g.getImageData((bmp.width >> 1) - 1, bmp.height >> 2, 1, 1).data);
                off = Array.from(g.getImageData((bmp.width >> 1) - 1, bmp.height * 3 >> 2, 1, 1).data);
            }
            m.remove(); el.remove();
            return {on, off};
        }, mode);
        check(`[${mode}] compat: fill-antialias draws the edges of a fill-pattern in the pattern, and false draws none, also with fill-outline-color (#1469)`,
            r.on?.[0] > 200 && r.on[1] < 230 && Math.abs(r.on[1] - r.on[2]) < 20 && r.off?.every(v => v > 245), JSON.stringify(r));
    }
    // #949: updateImage replaces the pixels in place and keeps the options of the image (here `sdf`), as in MapLibre
    // GL JS. The icon is drawn with the new pixels, and an image of another size replaces the old one.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            const square = (n, r, g, b) => { const data = new Uint8Array(n * n * 4); for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i); return {width: n, height: n, data}; };
            const centre = async () => {
                await new Promise(res => { m.once('idle', res); setTimeout(res, 8000); });
                const url = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
                if (!url) return null;
                const bmp = await createImageBitmap(url), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
            };
            await m.addImage('sq', square(16, 255, 0, 0));
            await m.addImage('dot', square(16, 255, 255, 255), {sdf: true});
            m.addSource('p', {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}});
            m.addLayer({id: 'p', type: 'symbol', source: 'p', layout: {'icon-image': 'sq'}});
            const before = await centre();
            await m.updateImage('sq', square(16, 0, 0, 255));
            const after = await centre();
            await m.updateImage('sq', square(24, 0, 255, 0));
            const resized = await centre();
            await m.updateImage('dot', square(16, 255, 255, 255));
            const sdf = m.getImage('dot')?.sdf;
            m.remove(); el.remove();
            return {before, after, resized, sdf};
        }, mode);
        check(`[${mode}] compat: updateImage draws the new pixels, also at another size, and keeps the options of the image (#949)`,
            r.before?.[0] > 200 && r.before[2] < 60 && r.after?.[2] > 200 && r.after[0] < 60 && r.resized?.[1] > 200 && r.resized[0] < 60 && r.sdf === true, JSON.stringify(r));
    }
    // #1434: a video source draws the frames of its video, and `play`, `pause` and `getVideo` work as in MapLibre GL JS.
    // The video is made here: half a second of red, then half a second of blue. Its code loads only with a video source.
    {
        const r = await page.evaluate(async mode => {
            // WebKit on Linux and Windows has no MediaRecorder, so the test video cannot be made there (#1471).
            if (typeof MediaRecorder !== 'function' || !MediaRecorder.isTypeSupported?.('video/webm')) return {unsupported: 'no MediaRecorder for video/webm'};
            if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return {unsupported: 'no canvas captureStream'};
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const paint = Object.assign(document.createElement('canvas'), {width: 64, height: 64}), pg = paint.getContext('2d');
            const recorder = new MediaRecorder(paint.captureStream(30), {mimeType: 'video/webm'}), parts = [];
            recorder.ondataavailable = e => parts.push(e.data);
            const fill = colour => { pg.fillStyle = colour; pg.fillRect(0, 0, 64, 64); };
            fill('#f00');
            const drawn = setInterval(() => fill(pg.fillStyle), 20);
            recorder.start();
            await new Promise(res => setTimeout(res, 600));
            fill('#00f');
            await new Promise(res => setTimeout(res, 600));
            recorder.stop();
            await new Promise(res => { recorder.onstop = res; });
            clearInterval(drawn);
            const url = URL.createObjectURL(new Blob(parts, {type: 'video/webm'}));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            const chunk = () => performance.getEntriesByType('resource').some(e => /map-jr-gl-video-/.test(e.name));
            const early = chunk();
            const centre = async () => {
                const blob = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
                if (!blob) return null;
                const bmp = await createImageBitmap(blob), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
            };
            m.addSource('v', {type: 'video', urls: [url], coordinates: [[-60, 50], [60, 50], [60, -50], [-60, -50]]});
            m.addLayer({id: 'v', type: 'raster', source: 'v'});
            const seen = new Set();
            for (const t0 = performance.now(); performance.now() - t0 < 15000 && seen.size < 2;) {
                const px = await centre();
                if (px?.[0] > 200 && px[1] < 60 && px[2] < 60) seen.add('red');
                if (px?.[2] > 200 && px[0] < 60 && px[1] < 60) seen.add('blue');
                await new Promise(res => setTimeout(res, 50));
            }
            // As in MapLibre GL JS, the map is not loaded() and fires no `idle` while the video plays, and it does after a pause.
            let idles = 0;
            m.on('idle', () => idles++);
            await new Promise(res => setTimeout(res, 1000));
            const whilePlaying = {idles, loaded: m.loaded(), moving: m.isMoving()};
            const video = m.getSource('v').getVideo();
            const idleAfter = new Promise(res => { m.once('idle', () => res(m.loaded())); setTimeout(() => res('none'), 5000); });
            m.getSource('v').pause();
            const afterPause = await idleAfter;
            await new Promise(res => setTimeout(res, 300));
            const paused = await centre();
            await new Promise(res => setTimeout(res, 700));
            const still = await centre();
            const result = {early, whilePlaying, afterPause, loaded: chunk(), seen: [...seen], isVideo: video instanceof HTMLVideoElement, wasPaused: video?.paused, paused, still};
            m.remove(); el.remove(); URL.revokeObjectURL(url);
            result.stopped = video?.paused && !video.childElementCount;
            return result;
        }, mode);
        const name = `[${mode}] compat: a video source draws its frames, and pause() keeps the frame that it shows; no idle while it plays (#1434)`;
        if (r.unsupported) skip(name, `${browserName} has ${r.unsupported}`);
        else check(name,
            r.whilePlaying.idles === 0 && !r.whilePlaying.loaded && !r.whilePlaying.moving && r.afterPause === true && !r.early && r.loaded && r.seen.length === 2 && r.isVideo && r.wasPaused && r.paused && String(r.paused) === String(r.still) && r.stopped, JSON.stringify(r));
    }
    // #1435: a canvas source copies its canvas in each frame while it plays (`animate`, default true), and once with
    // `animate: false`, as in MapLibre GL JS. While it plays the map fires no `idle`; a pause copies it one more time.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const paint = document.body.appendChild(Object.assign(document.createElement('canvas'), {id: 'canvas-1435', width: 32, height: 32, style: 'display:none'}));
            const fill = colour => { const g = paint.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, 32, 32); };
            fill('#f00');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            const errors = [];
            m.on('error', e => errors.push(String(e.error?.message)));
            const centre = async () => {
                const blob = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
                if (!blob) return null;
                const bmp = await createImageBitmap(blob), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
            };
            const colour = px => !px ? 'none' : px[0] > 200 && px[1] < 60 && px[2] < 60 ? 'red' : px[2] > 200 && px[0] < 60 && px[1] < 60 ? 'blue' : px[1] > 200 && px[0] < 60 && px[2] < 60 ? 'green' : px.join();
            const until = async want => { let got; for (const t0 = performance.now(); performance.now() - t0 < 8000;) { got = colour(await centre()); if (got === want) break; await new Promise(res => setTimeout(res, 50)); } return got; };
            const coordinates = [[-60, 50], [60, 50], [60, -50], [-60, -50]];
            m.addSource('c', {type: 'canvas', canvas: 'canvas-1435', coordinates});
            m.addLayer({id: 'c', type: 'raster', source: 'c'});
            // (toBlob() waits for `idle`, which a canvas that plays keeps away: it takes the image once the canvas plays.)
            const t0 = performance.now(), shot = await Promise.race([m.toBlob().then(() => Math.round(performance.now() - t0)), new Promise(res => setTimeout(() => res('none'), 4000))]);
            const first = await until('red');
            fill('#00f');
            const second = await until('blue');
            let idles = 0;
            m.on('idle', () => idles++);
            await new Promise(res => setTimeout(res, 1000));
            const whilePlaying = {idles, loaded: m.loaded()};
            const isCanvas = m.getSource('c').getCanvas() === paint;
            const idleAfter = new Promise(res => { m.once('idle', () => res(m.loaded())); setTimeout(() => res('none'), 5000); });
            m.getSource('c').pause();
            const afterPause = await idleAfter;
            fill('#0f0');
            await new Promise(res => setTimeout(res, 500));
            const paused = colour(await centre());
            // animate: false copies the canvas once.
            m.removeLayer('c'); m.removeSource('c');
            m.addSource('s', {type: 'canvas', canvas: paint, animate: false, coordinates});
            m.addLayer({id: 's', type: 'raster', source: 's'});
            const still = await until('green');
            fill('#f00');
            await new Promise(res => setTimeout(res, 500));
            const stillAfter = colour(await centre());
            m.addSource('x', {type: 'canvas', canvas: 'no-such-canvas', coordinates});
            await new Promise(res => setTimeout(res, 300));
            m.remove(); el.remove(); paint.remove();
            return {shot, first, second, whilePlaying, isCanvas, afterPause, paused, still, stillAfter, errors};
        }, mode);
        check(`[${mode}] compat: a canvas source copies its canvas while it plays, once with animate: false, and fires no idle while it plays (#1435)`,
            typeof r.shot === 'number' && r.first === 'red' && r.second === 'blue' && r.whilePlaying.idles === 0 && !r.whilePlaying.loaded && r.isCanvas && r.afterPause === true && r.paused === 'blue'
            && r.still === 'green' && r.stillAfter === 'green' && r.errors.length === 1 && /no-such-canvas/.test(r.errors[0]), JSON.stringify(r));
    }
    // #979: 500 × updateImage of a 64 × 64 image in one task send the pixels once (16 KB), not 500 times, and the
    // icon shows the pixels of the last call. (Each call sent its pixels, 8 MB in all, and at a pixel ratio of 3 the
    // pixels went at 192 × 192: the bench scenario `images` ended the Safari page on an iPhone.)
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            const square = (r, g, b) => { const data = new Uint8Array(64 * 64 * 4); for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i); return {width: 64, height: 64, data}; };
            await m.addImage('sq', square(255, 0, 0));
            m.addSource('p', {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}});
            m.addLayer({id: 'p', type: 'symbol', source: 'p', layout: {'icon-image': 'sq'}});
            await new Promise(res => { m.once('idle', res); setTimeout(res, 8000); });
            const red = square(255, 0, 0), blue = square(0, 0, 255);
            let bytes = 0;
            const posts = [Worker.prototype.postMessage, MessagePort.prototype.postMessage];
            for (const C of [Worker, MessagePort]) { const p = C.prototype.postMessage; C.prototype.postMessage = function (msg, t) { for (const c of [msg].flat()) if (c?.type === 'image') bytes += c.data.byteLength; return p.call(this, msg, t); }; }
            try {
                for (let i = 0; i < 500; i++) { m.updateImage('sq', i === 499 ? blue : i % 2 ? blue : red); m.triggerRepaint(); }
                await new Promise(res => setTimeout(res, 0));
            } finally { [Worker.prototype.postMessage, MessagePort.prototype.postMessage] = posts; }
            await new Promise(res => { m.once('idle', res); setTimeout(res, 8000); });
            const url = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
            let px = null;
            if (url) {
                const bmp = await createImageBitmap(url), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                px = Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
            }
            m.remove(); el.remove();
            return {bytes, px};
        }, mode);
        check(`[${mode}] compat: 500 × updateImage in one task send the pixels once and draw the last ones (#979)`,
            (mode !== 'worker' || r.bytes <= 2 * 64 * 64 * 4) && r.px?.[2] > 200 && r.px[0] < 60, JSON.stringify(r));
    }
    // `coalesce` with images: the icon is the first image that the map has. The map has only the second image (blue)
    // when the layer is added, and it gets the first image (red) after that.
    // The map asks for no image (`styleimagemissing`), because one of the two is there.
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            await new Promise(res => m.once('load', res));
            const asked = [];
            m.on('styleimagemissing', e => asked.push(e.id));
            const square = (r, g, b) => { const data = new Uint8Array(16 * 16 * 4); for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i); return {width: 16, height: 16, data}; };
            const centre = async () => {
                await new Promise(res => { m.once('idle', res); setTimeout(res, 8000); });
                const url = await Promise.race([m.toBlob(), new Promise(res => setTimeout(() => res(null), 5000))]);
                if (!url) return null;
                const bmp = await createImageBitmap(url), c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height}), g = c.getContext('2d');
                g.drawImage(bmp, 0, 0);
                return Array.from(g.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data);
            };
            await m.addImage('second', square(0, 0, 255));
            m.addSource('p', {type: 'geojson', data: {type: 'Point', coordinates: [0, 0]}});
            m.addLayer({id: 'p', type: 'symbol', source: 'p', layout: {'icon-image': ['coalesce', ['image', 'first'], ['image', 'second']]}});
            const before = await centre();
            await m.addImage('first', square(255, 0, 0));
            const after = await centre();
            m.remove(); el.remove();
            return {before, after, asked};
        }, mode);
        check(`[${mode}] compat: coalesce with images draws the first image that the map has, also one that is added after the layer (#584)`,
            r.before?.[2] > 200 && r.before[0] < 60 && r.after?.[0] > 200 && r.after[2] < 60 && r.asked.length === 0, JSON.stringify(r));
    }
    // #196: with `interactive: false`, the handlers are off, a drag does nothing, and `enable()` on a handler turns it on,
    // as in MapLibre GL JS. #253: the map still fires `click`, `mousemove` and the events of a layer.
    {
        await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = window.niEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:1000'}));
            const m = window.niMap = new mod.Map({container: el, renderer: mode, attributionControl: false, interactive: false, center: [0, 0], zoom: 2, style: {version: 8, sources: {sq: {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-30, -30], [30, -30], [30, 30], [-30, 30], [-30, -30]]]}}}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'sq', type: 'fill', source: 'sq', paint: {'fill-color': '#00f'}}]}});
            const seen = window.niSeen = [];
            for (const t of ['click', 'mousemove']) m.on(t, () => seen.includes(t) || seen.push(t));
            m.on('click', 'sq', e => seen.includes('click sq') || seen.push(e.features?.length ? 'click sq' : 'click sq, no features'));
            await new Promise(r => m.once('load', r));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 2000); });
        }, mode);
        await page.mouse.move(190, 140); await page.mouse.move(200, 150); await page.mouse.click(200, 150);
        await page.waitForFunction(() => window.niSeen.includes('click sq'), null, {timeout: 3000, polling: 50}).catch(() => {});
        const seen = await page.evaluate(() => window.niSeen.slice().sort());
        const pose = () => page.evaluate(() => { const c = window.niMap.getCenter(); return [c.lng, c.lat, window.niMap.getZoom()]; });
        const drag = async () => { await page.mouse.move(200, 150); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(200 + i * 10, 150, {steps: 1}); await page.mouse.up(); await page.waitForTimeout(600); };
        const off = await page.evaluate(() => ['dragPan', 'scrollZoom', 'doubleClickZoom', 'dragRotate', 'touchZoomRotate', 'touchPitch', 'keyboard', 'boxZoom'].filter(k => window.niMap[k].isEnabled()));
        const p0 = await pose();
        await drag(); await page.mouse.wheel(0, -400); await page.waitForTimeout(600);
        const pOff = await pose();
        await page.evaluate(() => { window.niMap.dragPan.enable(); window.niMap.scrollZoom.enable(); });
        await drag();
        await page.waitForFunction(x => window.niMap.getCenter().lng !== x, pOff[0], {timeout: 5000, polling: 50}).catch(() => {});
        const pDrag = await pose();
        await page.mouse.move(200, 150); await page.mouse.wheel(0, -400);
        await page.waitForFunction(z => window.niMap.getZoom() > z, pDrag[2], {timeout: 5000, polling: 50}).catch(() => {});
        await page.waitForTimeout(300);
        const pWheel = await pose();
        await page.evaluate(() => { window.niMap.remove(); window.niEl.remove(); });
        check(`[${mode}] interactive: false turns the handlers off, and enable() on dragPan and scrollZoom turns them on (#196)`,
            off.length === 0 && pOff.join() === p0.join() && pDrag[0] !== p0[0] && pWheel[2] > pDrag[2], JSON.stringify({off, p0, pOff, pDrag, pWheel}));
        check(`[${mode}] interactive: false still fires click, mousemove and the click of a layer (#253)`, seen.join() === 'click,click sq,mousemove', JSON.stringify(seen));
    }
    // #998: a `visibility` that is an expression of the global state hides a hillshade layer and a line layer together, as the Elevation style of map-jr-styles does. The
    // raster-dem source requests no tiles and the line is not found by a query until setGlobalStateProperty shows them.
    {
        const vis = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:200px;height:150px;z-index:1000'}));
            const urls = [], line = {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-30, 0], [30, 0]]}};
            const map = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1,
                transformRequest: url => { if (url.includes('no-such-dem-998')) urls.push(url); return {url}; },
                style: {version: 8, state: {relief: {default: false}},
                    sources: {dem: {type: 'raster-dem', tiles: [location.origin + '/no-such-dem-998/{z}/{x}/{y}.png'], tileSize: 256}, g: {type: 'geojson', data: line}},
                    layers: [{id: 'relief', type: 'hillshade', source: 'dem', layout: {visibility: ['case', ['global-state', 'relief'], 'visible', 'none']}},
                        {id: 'line', type: 'line', source: 'g', layout: {visibility: ['case', ['global-state', 'relief'], 'visible', 'none']}, paint: {'line-width': 10}}]}});
            const idle = () => new Promise(r => { map.once('idle', r); setTimeout(r, 5000); });
            await idle();
            await new Promise(r => setTimeout(r, 300));
            const out = {hidden: urls.length, foundHidden: (await map.queryRenderedFeatures([100, 75], {layers: ['line']})).length};
            map.setGlobalStateProperty('relief', true);
            await idle();
            for (let i = 0; i < 50 && !urls.length; i++) await new Promise(r => setTimeout(r, 100));
            out.shown = urls.length > 0;
            out.found = (await map.queryRenderedFeatures([100, 75], {layers: ['line']})).length;
            map.remove(); el.remove();
            return out;
        }, mode).catch(e => ({error: String(e)}));
        check(`[${mode}] visibility: an expression of the global state hides a hillshade and a line layer, loads no DEM tiles, and setGlobalStateProperty shows them (#998)`,
            vis.hidden === 0 && vis.foundHidden === 0 && vis.shown && vis.found > 0, JSON.stringify(vis));
    }
    // Two maps on one page with the same source name: each has its own feature state and its own global state.
    {
        const clip = id => page.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return {x: r.left + r.width / 2 - 2, y: r.top + r.height / 2 - 2, width: 4, height: 4}; }, id);
        await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const square = {type: 'Feature', id: 1, properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}};
            // Feature state "on" gives blue; the global state "tone" gives the colour without it.
            const style = () => ({version: 8, state: {tone: {default: '#ff0000'}}, sources: {g: {type: 'geojson', data: square}},
                layers: [{id: 'fill', type: 'fill', source: 'g', paint: {'fill-color': ['case', ['boolean', ['feature-state', 'on'], false], '#0000ff', ['to-color', ['global-state', 'tone']]]}}]});
            window.pair = ['pair-a', 'pair-b'].map((id, i) => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {id, style: `position:fixed;left:${i * 220}px;top:0;width:200px;height:150px;z-index:1000`}));
                return new mod.Map({container: el, style: style(), renderer: mode, attributionControl: false, center: [0, 0], zoom: 1});
            });
            await Promise.all(window.pair.map(m => new Promise(r => m.once('idle', r))));
            const [a, b] = window.pair, idle = m => new Promise(r => { m.once('idle', r); setTimeout(r, 4000); });
            b.setFeatureState({source: 'g', id: 1}, {on: true});
            b.setGlobalStateProperty('tone', '#00ff00');
            await idle(b);
            // A zoom makes map A build its tiles again, in the tile workers that also built the tiles of map B.
            a.jumpTo({zoom: 2.2});
            await idle(a);
            b.removeFeatureState({source: 'g', id: 1});
            await idle(b);
            await new Promise(r => setTimeout(r, 500));
        }, mode);
        const colour = async id => {
            const shot = await page.screenshot({clip: await clip(id)});
            return page.evaluate(async b64 => { const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d'); c.drawImage(img, 1, 1, 1, 1, 0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3).join(); }, shot.toString('base64'));
        };
        const two = {a: await colour('pair-a'), b: await colour('pair-b'), stateA: await page.evaluate(() => JSON.stringify(window.pair[0].getFeatureState({source: 'g', id: 1})))};
        await page.evaluate(() => { for (const m of window.pair) { const el = m.getContainer(); m.remove(); el.remove(); } });
        check(`[${mode}] two maps with the same source name keep their own feature state and global state`, two.a === '255,0,0' && two.b === '0,255,0' && two.stateA === '{}', JSON.stringify(two));
    }
    // A string id of a GeoJSON feature stays in the queries of the compat entry, a string of digits becomes the number as in
    // MapLibre GL JS, and feature state takes a string id (#528).
    {
        const textId = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const square = {type: 'Feature', id: 'square-a', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}};
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:200px;height:150px;z-index:1000'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources: {g: {type: 'geojson', data: {type: 'FeatureCollection', features: [square, {...square, id: '12', geometry: {type: 'Point', coordinates: [60, 0]}}]}}},
                layers: [{id: 'fill', type: 'fill', source: 'g', paint: {'fill-color': ['case', ['boolean', ['feature-state', 'on'], false], '#0000ff', '#ff0000']}}]}});
            await new Promise(r => { m.once('idle', r); setTimeout(r, 8000); });
            const rendered = (await m.queryRenderedFeatures([100, 75], {layers: ['fill']})).map(f => f.id), source = (await m.querySourceFeatures('g')).map(f => f.id);
            m.setFeatureState({source: 'g', id: 'square-a'}, {on: true});
            await new Promise(r => { m.once('idle', r); setTimeout(r, 4000); });
            const state = (await m.queryRenderedFeatures([100, 75], {layers: ['fill']}))[0]?.state;
            m.remove(); el.remove();
            return {rendered, source: [...new Set(source.map(id => JSON.stringify(id)))].sort(), state};
        }, mode);
        check(`[${mode}] queryRenderedFeatures and querySourceFeatures give the string id of a GeoJSON feature and the number for a string of digits, and setFeatureState takes a string id (#528)`,
            textId.rendered.join() === 'square-a' && textId.source.join() === '"square-a",12' && textId.state?.on === true, JSON.stringify(textId));
    }
    // A source or a style that fails: the map reports it with an `error` event and goes on with the rest.
    {
        const errorsBefore = errors.length;
        const failed = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            // (A map that never starts does not answer a query: the test must not wait for ever.)
            // (A query that loses the race is rejected by remove() at the end; its rejection is handled here, #787.)
            const count = query => Promise.race([query.then(found => found.length, () => -2), wait(4000).then(() => -1)]);
            const make = style => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
                const m = new mod.Map({container: el, style, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1}), seen = [];
                for (const type of ['error', 'load', 'style.load']) m.on(type, e => seen.push(type === 'error' ? 'error: ' + (e.error?.message ?? e.error) : type));
                return {m, el, seen};
            };
            const rejections = [], onRejection = e => rejections.push(String(e.reason?.message ?? e.reason));
            addEventListener('unhandledrejection', onRejection);
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}};
            const good = {version: 8, sources: {g: {type: 'geojson', data: square}}, layers: [{id: 'bg', type: 'background'}, {id: 'fill', type: 'fill', source: 'g'}]};
            const out = {};
            // 1. One good source and one whose TileJSON is not there.
            const a = make({...good, sources: {...good.sources, gone: {type: 'vector', url: '/no-such-tilejson.json'}}, layers: [...good.layers, {id: 'lost', type: 'line', source: 'gone', 'source-layer': 'x'}]});
            await wait(2500);
            out.oneSource = {seen: a.seen, loaded: a.m.loaded(), drawn: await count(a.m.queryRenderedFeatures({layers: ['fill']}))};
            // 2. A first style that fails, then a good style.
            const b = make('/no-such-style.json');
            await wait(1200);
            const firstError = b.seen.join();
            b.m.setStyle(good);
            await wait(2000);
            out.afterFailure = {firstError, seen: b.seen.slice(1), loaded: b.m.loaded(), styleLoaded: b.m.isStyleLoaded()};
            // 3. setStyle with a URL that fails: an `error` event, a promise that is not rejected, and the map keeps its style.
            const c = make(good);
            await wait(1500);
            const before = c.seen.length;
            let rejected = false;
            await Promise.race([c.m.setStyle('/no-such-style.json').catch(() => { rejected = true; }), wait(4000)]);
            await wait(500);
            out.badStyle = {seen: c.seen.slice(before), rejected, kept: !!c.m.getLayer('fill')};
            // 4. A source with no tiles and no url: one `error`, and later changes of the style work.
            const errorsBefore = c.seen.length;
            c.m.addSource('bad', {type: 'vector'});
            await wait(500);
            c.m.addLayer({id: 'later', type: 'fill', source: 'g', paint: {'fill-color': '#f00'}});
            c.m.setPaintProperty('fill', 'fill-color', '#00f');
            await wait(1500);
            out.badSource = {seen: c.seen.slice(errorsBefore), later: await count(c.m.queryRenderedFeatures({layers: ['later']}))};
            // 5. Queries that nobody awaits, then remove(): as in MapLibre, whose queries are synchronous, the page hears of no rejection (#787).
            const before5 = rejections.length;
            c.m.queryRenderedFeatures({layers: ['fill']}); c.m.querySourceFeatures('g'); c.m.queryRenderedFeatures([10, 10]);
            for (const x of [a, b, c]) { x.m.remove(); x.el.remove(); }
            await wait(300);
            out.forgotten = rejections.slice(before5);
            removeEventListener('unhandledrejection', onRejection);
            return {...out, rejections};
        }, mode);
        check(`[${mode}] a source that fails: one error with the URL, the other layers are drawn and load fires`,
            failed.oneSource.seen.filter(s => s.startsWith('error')).length === 1 && failed.oneSource.seen[0].includes('/no-such-tilejson.json') && failed.oneSource.seen.includes('load') && failed.oneSource.loaded && failed.oneSource.drawn > 0, JSON.stringify(failed.oneSource));
        check(`[${mode}] a first style that fails says the URL and the status, and setStyle with a good style then loads the map`,
            /Style \/no-such-style\.json: HTTP 404/.test(failed.afterFailure.firstError) && failed.afterFailure.seen.includes('load') && failed.afterFailure.loaded && failed.afterFailure.styleLoaded, JSON.stringify(failed.afterFailure));
        check(`[${mode}] setStyle with a URL that fails: an error event, no rejected promise, and the map keeps its style`,
            failed.badStyle.seen.length === 1 && /HTTP 404/.test(failed.badStyle.seen[0]) && !failed.badStyle.rejected && failed.badStyle.kept && !failed.rejections.length, JSON.stringify({...failed.badStyle, rejections: failed.rejections}));
        check(`[${mode}] addSource with no tiles and no url: one error that names the source, and later changes of the style work`,
            failed.badSource.seen.length === 1 && failed.badSource.seen[0].includes('"bad"') && failed.badSource.later > 0, JSON.stringify(failed.badSource));
        check(`[${mode}] maplibre-compat: remove() with queries that nobody awaits gives no unhandled rejection (#787)`, failed.forgotten.length === 0, failed.forgotten.join(' | '));
        // (The browser writes its own line to the console for each 404 that this test asks for.)
        for (let i = errors.length; i-- > errorsBefore;) if (errors[i].startsWith('Failed to load resource')) errors.splice(i, 1);
    }
    // A style that is not a style (#539): an `error` event that says what is missing, no error of the page, and the map
    // works with the next style. Each style is given as an object and as the answer of a URL.
    {
        const errorsBefore = errors.length;
        const out = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const thrown = [], onError = e => thrown.push(String(e.reason?.message ?? e.message));
            addEventListener('unhandledrejection', onError); addEventListener('error', onError);
            const good = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
            const bad = {noLayers: {version: 8, sources: {}}, layersNotAList: {version: 8, sources: {}, layers: {bg: {type: 'background'}}}, notAnObject: 42};
            const url = style => 'data:application/json,' + encodeURIComponent(JSON.stringify(style)), results = {};
            const run = async (name, style) => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'})), seen = [];
                let m, made = '';
                try { m = new mod.Map({container: el, style, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1}); } catch (e) { made = String(e.message); }
                if (m) {
                    for (const type of ['error', 'load']) m.on(type, e => seen.push(type === 'error' ? 'error: ' + (e.error?.message ?? e.error) : type));
                    await wait(700);
                    const first = seen.join(' | ');
                    // The next style loads the map, and a later style that is not a style leaves that style in place.
                    m.setStyle(good);
                    for (let i = 0; i < 40 && !seen.includes('load'); i++) await wait(100);
                    const loaded = seen.includes('load'), before = seen.length;
                    m.setStyle(style);
                    await wait(700);
                    results[name] = {first, loaded, second: seen.slice(before).join(' | '), kept: !!m.getLayer('bg')};
                    m.remove();
                } else results[name] = {made};
                el.remove();
            };
            for (const [name, style] of Object.entries(bad)) { await run(name, style); await run(name + 'URL', url(style)); }
            // (A style with no "sources" has no source: its layers without a source are drawn.)
            await run('noSources', {version: 8, layers: good.layers});
            removeEventListener('unhandledrejection', onError); removeEventListener('error', onError);
            return {results, thrown};
        }, mode);
        const said = /^error: \[map-jr-gl\] The style has no list "layers"/;
        for (const [name, r] of Object.entries(out.results)) {
            if (name === 'noSources') check(`[${mode}] a style with no "sources" loads without an error`, r.first === 'load' && r.loaded && r.second === '', JSON.stringify(r));
            else check(`[${mode}] a style that is not a style (${name}): one error event that names "layers", then setStyle with a good style loads the map and the map keeps it`,
                said.test(r.first) && !r.first.includes(' | ') && r.loaded && said.test(r.second) && !r.second.includes(' | ') && r.kept, JSON.stringify(r));
        }
        check(`[${mode}] a style that is not a style gives no error of the page`, !out.thrown.length && errors.length === errorsBefore, JSON.stringify({thrown: out.thrown, page: errors.slice(errorsBefore)}));
    }
    // A container under a CSS transform (#189): the map takes the layout size, as MapLibre does, and event.point is in
    // element pixels. One container is scaled itself, the other sits in a scaled parent.
    {
        for (const where of ['self', 'parent']) {
            const out = await page.evaluate(async ({mode, where}) => {
                const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
                const wrap = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:400px;height:300px;transform-origin:0 0;z-index:99' + (where === 'parent' ? ';transform:scale(0.5)' : '')}));
                const el = wrap.appendChild(Object.assign(document.createElement('div'), {style: 'width:400px;height:300px;transform-origin:0 0' + (where === 'self' ? ';transform:scale(0.5)' : '')}));
                const m = window.scaledMap = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
                await new Promise(r => m.once('load', r));
                window.scaledClicks = []; m.on('click', e => window.scaledClicks.push(e.point));
                const p = m.project([0, 0]), c = m.getCanvas();
                return {p: [p.x, p.y], buffer: [c.width / devicePixelRatio, c.height / devicePixelRatio]};
            }, {mode, where});
            // The screen point (100, 75) is element point (200, 150), the centre.
            await page.mouse.click(100, 75);
            await new Promise(r => setTimeout(r, 400));
            const click = await page.evaluate(() => { const c = window.scaledClicks[0]; const el = window.scaledMap.getContainer(); window.scaledMap.remove(); el.parentElement.remove(); return c && [c.x, c.y]; });
            check(`[${mode}] a container scaled by CSS (${where}) keeps its layout size, and event.point is in element pixels`,
                Math.abs(out.p[0] - 200) < 0.5 && Math.abs(out.p[1] - 150) < 0.5 && Math.abs(out.buffer[0] - 400) < 1.5 && Math.abs(out.buffer[1] - 300) < 1.5 && click && Math.abs(click[0] - 200) < 1.5 && Math.abs(click[1] - 150) < 1.5, JSON.stringify({...out, click}));
        }
    }
    // loaded() is false from setStyle or a style edit until the next idle, as in MapLibre (#190).
    {
        const got = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const style = n => ({version: 8, sources: {}, layers: Array.from({length: n}, (_, i) => ({id: 'bg' + i, type: 'background'}))});
            const m = new mod.Map({container: el, style: style(1), renderer: mode, attributionControl: false, center: [0, 0], zoom: 1});
            const idle = () => Promise.race([new Promise(r => m.once('idle', r)), new Promise(r => setTimeout(r, 5000))]);
            await new Promise(r => m.once('load', r)); if (!m.loaded()) await idle();
            const out = {start: m.loaded()};
            m.setLayoutProperty('bg0', 'visibility', 'none');
            out.afterEdit = m.loaded();
            await idle(); out.editIdle = m.loaded();
            const styledata = new Promise(r => m.once('styledata', () => r(m.loaded())));
            m.setStyle(style(2));
            out.afterSetStyle = m.loaded();
            out.onStyledata = await styledata;
            await idle(); out.styleIdle = m.loaded();
            m.remove(); el.remove();
            return out;
        }, mode);
        check(`[${mode}] loaded() is false after a style edit and after setStyle until idle`,
            got.start && !got.afterEdit && got.editIdle && !got.afterSetStyle && !got.onStyledata && got.styleIdle, JSON.stringify(got));
    }
    // The events of setStyle are those of MapLibre GL JS 6.17 (served at /ml/): with `diff` (the default), the same style
    // fires nothing and a changed style (a paint value, another sprite) fires `style.load` once; `diff: false` fires it
    // for the same style. A listener of `style.load` that calls setStyle with what it already gave, as
    // @mapbox/mapbox-gl-language does, stops after one more load (#743).
    {
        // (A sprite of one pixel.)
        await page.route(/\/test-sprite-743\//, r => r.request().url().endsWith('.json') ? r.fulfill({contentType: 'application/json', body: '{"a": {"x": 0, "y": 0, "width": 1, "height": 1, "pixelRatio": 1}}'})
            : r.fulfill({contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64')}));
        const run = (lib, mode) => page.evaluate(async ([lib, mode]) => {
            const mod = await import(lib === 'ml' ? '/ml/maplibre-gl.mjs' : '/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            if (lib === 'ml') mod.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const style = (colour, sprite) => ({version: 8, ...sprite ? {sprite} : {}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': colour}}]});
            const m = new mod.Map({container: el, style: style('#fff'), ...lib === 'ml' ? {} : {renderer: mode}, attributionControl: false, center: [0, 0], zoom: 1});
            await new Promise(r => m.once('load', r));
            let loads = 0;
            m.on('style.load', () => loads++);
            const step = async f => { loads = 0; f(); await wait(1000); return loads; };
            const out = {};
            out.same = await step(() => m.setStyle(style('#fff')));
            out.paint = await step(() => m.setStyle(style('#f00')));
            out.sprite = await step(() => m.setStyle(style('#f00', location.origin + '/test-sprite-743/s')));
            out.whole = await step(() => m.setStyle(style('#f00', location.origin + '/test-sprite-743/s'), {diff: false}));
            const again = () => m.setStyle(style('#00f'));
            m.on('style.load', again);
            out.listener = await step(() => m.setStyle(style('#0f0'), {diff: false}));
            m.off('style.load', again);
            m.remove(); el.remove();
            return out;
        }, [lib, mode]);
        const ours = await run('ours', mode), ml = mode === 'main' ? await run('ml', mode) : {same: 0, paint: 1, sprite: 1, whole: 1, listener: 2};
        check(`[${mode}] compat: the style.load events of setStyle are those of MapLibre GL JS (the same style, a paint change, another sprite, diff: false, setStyle in a listener of style.load) (#743)`,
            JSON.stringify(ours) === JSON.stringify(ml), JSON.stringify({ours, maplibre: ml}));
    }
    // The attribution names a source only while one of its layers is visible, also when a `visibility` expression of
    // the global state hides the layers, and it follows a change of that state, as in MapLibre GL JS 6.17 (#1032).
    {
        const run = (lib, mode) => page.evaluate(async ([lib, mode]) => {
            const mod = await import(lib === 'ml' ? '/ml/maplibre-gl.mjs' : '/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            if (lib === 'ml') mod.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const style = {version: 8, state: {relief: {default: false}}, sources: {g: {type: 'geojson', attribution: 'Relief-1032', data: {type: 'FeatureCollection', features: []}}},
                layers: [{id: 'c', type: 'circle', source: 'g', layout: {visibility: ['case', ['global-state', 'relief'], 'visible', 'none']}}]};
            const m = new mod.Map({container: el, style, ...lib === 'ml' ? {} : {renderer: mode}, attributionControl: {compact: false}, center: [0, 0], zoom: 1});
            await new Promise(r => m.once('load', r));
            const text = () => !!el.querySelector('.maplibregl-ctrl-attrib')?.textContent.includes('Relief-1032');
            const out = [];
            await wait(500); out.push(text());
            m.setGlobalStateProperty('relief', true); await wait(1000); out.push(text());
            m.setGlobalStateProperty('relief', false); await wait(1000); out.push(text());
            m.remove(); el.remove();
            return out;
        }, [lib, mode]);
        // (MapLibre GL JS 6.17 keeps the source in the attribution after the state hides its layers again, until a
        // source changes: this library drops it, so only the first two steps are compared, see docs/reference/maplibre-differences.md.)
        const ours = await run('ours', mode), ml = mode === 'main' ? await run('ml', mode) : [false, true, true];
        check(`[${mode}] compat: the attribution follows a visibility expression of the global state, as in MapLibre GL JS, and drops the source when the state hides it again (#1032)`,
            JSON.stringify(ours) === JSON.stringify([...ml.slice(0, 2), false]) && JSON.stringify(ml.slice(0, 2)) === '[false,true]', JSON.stringify({ours, maplibre: ml}));
    }
    // A GeoJSON source whose URL fails (404) is requested, and fires `error`, as often as in MapLibre GL JS 6.17: one time,
    // and not again after a paint change or a setStyle (with `diff`) that keeps the source. `diff: false` loads it again.
    // A second map with the same style object gets its own `error` (#809). MapLibre GL JS in WebKit requests the
    // source again more than 1 s after `diff: false`, so that step waits 4 s (#931).
    {
        await page.route(/\/no-such-809\//, r => { globalThis.asked809++; return r.fulfill({status: 404, body: ''}); });
        const run = (lib, mode) => page.evaluate(async ([lib, mode]) => {
            const mod = await import(lib === 'ml' ? '/ml/maplibre-gl.mjs' : '/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            if (lib === 'ml') mod.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const style = colour => ({version: 8, sources: {bad: {type: 'geojson', data: location.origin + '/no-such-809/a.geojson'}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': colour}}, {id: 'c', type: 'circle', source: 'bad'}]});
            const first = style('#fff'), errors = [0, 0], maps = [];
            for (const i of [0, 1]) {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
                const m = new mod.Map({container: el, style: first, ...lib === 'ml' ? {} : {renderer: mode}, attributionControl: false, center: [0, 0], zoom: 1});
                m.on('error', () => errors[i]++);
                maps.push(m);
                await wait(1500);
            }
            const [m] = maps, out = {start: [await window.asked809(), ...errors]};
            const step = async (name, f) => { f(); await wait(name === 'noDiff' ? 4000 : 1000); out[name] = [await window.asked809(), ...errors]; };
            await step('paint', () => m.setPaintProperty('bg', 'background-color', '#eee'));
            await step('sameObject', () => m.setStyle(first));
            await step('newStyle', () => m.setStyle(style('#f00')));
            await step('noDiff', () => m.setStyle(style('#f00'), {diff: false}));
            for (const x of maps) { x.getContainer().remove(); x.remove(); }
            return out;
        }, [lib, mode]);
        if (!await page.evaluate(() => !!window.asked809)) await page.exposeFunction('asked809', () => globalThis.asked809);
        const once = async (lib, mode) => { globalThis.asked809 = 0; return run(lib, mode); };
        const ours = await once('ours', mode), ml = mode === 'main' ? await once('ml', mode) : {start: [2, 1, 1], paint: [2, 1, 1], sameObject: [2, 1, 1], newStyle: [2, 1, 1], noDiff: [3, 2, 1]};
        await page.unroute(/\/no-such-809\//);
        check(`[${mode}] compat: a GeoJSON source that fails is requested and fires error as in MapLibre GL JS after a paint change and setStyle (#809)`,
            JSON.stringify(ours) === JSON.stringify(ml), JSON.stringify({ours, maplibre: ml}));
    }
    // A filter with ["zoom"] on a tile that is over-zoomed past the source's maxzoom sees the over-zoomed zoom, as in
    // MapLibre GL JS 6.17 (`overscaledZ`): at zoom 16 on a source that stops at 14, [">=", ["zoom"], 15] passes (#991).
    {
        const run = (lib, mode) => page.evaluate(async ([lib, mode]) => {
            const mod = await import(lib === 'ml' ? '/ml/maplibre-gl.mjs' : '/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            if (lib === 'ml') mod.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-0.01, -0.01], [0.01, -0.01], [0.01, 0.01], [-0.01, 0.01], [-0.01, -0.01]]]}};
            const layer = (id, z) => ({id, type: 'fill', source: 'g', filter: ['>=', ['zoom'], z], paint: {'fill-color': '#f00'}});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, ...lib === 'ml' ? {} : {renderer: mode}, attributionControl: false, center: [0, 0], zoom: 16,
                style: {version: 8, sources: {g: {type: 'geojson', data: square, maxzoom: 14}}, layers: [layer('z15', 15), layer('z17', 17)]}});
            await new Promise(r => { m.once('idle', r); setTimeout(r, 8000); });
            const out = {};
            for (const at of [16, 14.5]) {
                m.jumpTo({zoom: at});
                await new Promise(r => { m.once('idle', r); setTimeout(r, 4000); });
                await wait(300);
                const found = await m.queryRenderedFeatures([100, 75]);
                out[at] = [...new Set([...found].map(f => f.layer.id))].sort().join() || 'none';
            }
            m.remove(); el.remove();
            return out;
        }, [lib, mode]);
        const ours = await run('ours', mode), ml = mode === 'main' ? await run('ml', mode) : {16: 'z15', 14.5: 'none'};
        check(`[${mode}] compat: a filter with ["zoom"] on an over-zoomed tile sees the over-zoomed zoom, as in MapLibre GL JS (#991)`,
            JSON.stringify(ours) === JSON.stringify(ml), JSON.stringify({ours, maplibre: ml}));
    }
    // The kept network result of a source: new data at the same URL stays after a change of the style, and two maps
    // that are given the same source object both load it.
    {
        const square = JSON.stringify({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}});
        let body = square;
        await page.route('**/test-kept.json', async r => { await new Promise(res => setTimeout(res, 150)); r.fulfill({contentType: 'application/json', body}); });
        // A request with "?slow" is answered late with the square, the others at once with no features. (A newer setData
        // aborts the older request, so that request may never arrive here.)
        await page.route('**/test-order.json*', async r => {
            const slow = r.request().url().endsWith('?slow');
            await new Promise(res => setTimeout(res, slow ? 900 : 20));
            r.fulfill({contentType: 'application/json', body: slow ? square : JSON.stringify({type: 'FeatureCollection', features: []})});
        });
        const kept = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const idle = m => new Promise(r => { m.once('idle', () => r(true)); setTimeout(() => r(false), 6000); });
            const count = m => Promise.race([m.queryRenderedFeatures({layers: ['fill']}).then(f => f.length), wait(4000).then(() => -1)]);
            const make = sources => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
                return new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1, style: {version: 8, sources, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]}});
            };
            const a = window.keptMap = make({g: {type: 'geojson', data: '/test-kept.json'}});
            await new Promise(r => a.once('load', r));
            a.addLayer({id: 'fill', type: 'fill', source: 'g'});
            await idle(a);
            window.keptFirst = await count(a);
            // Two other maps get one source object.
            const shared = {type: 'geojson', data: '/test-kept.json'}, pair = [make({}), make({})];
            await Promise.all(pair.map(m => new Promise(r => m.once('load', r))));
            for (const m of pair) { m.addSource('g', shared); m.addLayer({id: 'fill', type: 'fill', source: 'g'}); }
            const idles = await Promise.all(pair.map(idle));
            const two = {idles, drawn: await Promise.all(pair.map(count))};
            for (const m of pair) { const el = m.getContainer(); m.remove(); el.remove(); }
            return two;
        }, mode);
        body = JSON.stringify({type: 'FeatureCollection', features: []});
        const after = await page.evaluate(async () => {
            const a = window.keptMap, wait = ms => new Promise(r => setTimeout(r, ms));
            const idle = () => new Promise(r => { a.once('idle', () => r(true)); setTimeout(() => r(false), 6000); });
            const count = () => Promise.race([a.queryRenderedFeatures({layers: ['fill']}).then(f => f.length), wait(4000).then(() => -1)]);
            a.getSource('g').setData('/test-kept.json');
            await wait(600); await idle();
            const fresh = await count();
            // A change of another layer and a zoom: the map must not go back to the data that it had first.
            a.setPaintProperty('bg', 'background-color', '#eee');
            a.jumpTo({zoom: 2.5});
            await wait(600); await idle();
            const later = await count();
            // Two calls of setData: the data of the later call stays, also when the earlier call is answered after it.
            a.getSource('g').setData('/test-order.json?slow');
            a.getSource('g').setData('/test-order.json');
            await wait(1800);
            const sameURL = await count();
            const none = {type: 'FeatureCollection', features: []};
            a.getSource('g').setData('/test-order.json?slow');
            a.getSource('g').setData(none);
            await wait(1800);
            const order = {sameURL, object: await count(), data: a.getSource('g').data === none};
            a.setPaintProperty('bg', 'background-color', '#ddd');
            await wait(600);
            order.afterStyle = await count();
            const el = a.getContainer(); a.remove(); el.remove();
            return {first: window.keptFirst, fresh, later, order};
        });
        await page.unroute('**/test-kept.json');
        await page.unroute('**/test-order.json*');
        check(`[${mode}] two setData calls: the later one stays when the earlier one is answered after it`,
            after.order.sameURL === 0 && after.order.object === 0 && after.order.data && after.order.afterStyle === 0, JSON.stringify(after.order));
        check(`[${mode}] setData with the same URL: the new data stays after a change of the style and a zoom`, after.first > 0 && after.fresh === 0 && after.later === 0, JSON.stringify(after));
        check(`[${mode}] two maps that are given one source object both load it`, kept.idles.every(Boolean) && kept.drawn.every(n => n > 0), JSON.stringify(kept));
    }
    // The sources of the first style go through transformRequest and addProtocol, as those of a later addSource do.
    {
        await page.route('**/test-first-tiles.json*', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({tilejson: '2.2.0', tiles: [new URL('/test-first/{z}/{x}/{y}.pbf', page.url()).href], minzoom: 0, maxzoom: 14})}));
        const first = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), asked = [], errors = [];
            mod.addProtocol('first', async request => ({data: {type: 'Feature', properties: {from: request.url}, geometry: {type: 'Point', coordinates: [0, 0]}}}));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1,
                transformRequest: (url, kind) => { asked.push([kind, url.replace(location.origin, '')]); return {url: url + (url.includes('?') ? '&' : '?') + 'seen=1'}; },
                style: {version: 8, sources: {t: {type: 'vector', url: '/test-first-tiles.json'}, g: {type: 'geojson', data: 'first://point'}},
                    layers: [{id: 'point', type: 'circle', source: 'g', paint: {'circle-radius': 6}}]}});
            m.on('error', e => errors.push(String(e.error?.message ?? e.error)));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 8000); });
            const found = await Promise.race([m.queryRenderedFeatures({layers: ['point']}), new Promise(r => setTimeout(() => r([]), 4000))]);
            const tileJson = performance.getEntriesByType('resource').some(e => e.name.includes('/test-first-tiles.json?seen=1'));
            m.remove(); el.remove(); mod.removeProtocol('first');
            return {asked, errors, from: found[0]?.properties.from, tileJson};
        }, mode);
        await page.unroute('**/test-first-tiles.json*');
        const kind = url => first.asked.find(a => a[1] === url)?.[0];
        check(`[${mode}] the sources of the first style: transformRequest gets the TileJSON and the GeoJSON as Source, and addProtocol supplies the GeoJSON`,
            kind('/test-first-tiles.json') === 'Source' && kind('first://point') === 'Source' && first.tileJson && first.from === 'first://point?seen=1' && !first.errors.length, JSON.stringify(first));
    }
    // setTiles and setUrl on a raster source replace its tiles, and the map loads the new ones (#255).
    {
        await page.route('**/test-255.json', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({tilejson: '2.2.0', tiles: [new URL('/t255c/{z}/{x}/{y}.png', page.url()).href], minzoom: 0, maxzoom: 14})}));
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
        await page.route(/\/t255[abc]\//, route => route.fulfill({contentType: 'image/png', body: png}));
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), asked = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1,
                transformRequest: url => { asked.push(url.replace(location.origin, '')); return {url}; },
                style: {version: 8, sources: {r: {type: 'raster', tiles: ['/t255a/{z}/{x}/{y}.png'], tileSize: 256}}, layers: [{id: 'r', type: 'raster', source: 'r'}]}});
            m.on('error', () => {});
            const idle = () => new Promise(r => { m.once('idle', r); setTimeout(r, 5000); });
            const seen = p => asked.some(u => u.startsWith(p));
            await idle();
            const a = seen('/t255a/'), source = m.getSource('r');
            const same = source.setTiles(['/t255b/{z}/{x}/{y}.png']) === source;
            await idle();
            const b = seen('/t255b/');
            m.getSource('r').setUrl('/test-255.json');
            await idle();
            const c = seen('/t255c/'), spec = m.getStyle().sources.r;
            let message = '';
            try { m.getSource('r').setTiles('/t255d/{z}/{x}/{y}.png'); } catch (e) { message = e.message; }
            m.remove(); el.remove();
            return {a, b, c, same, url: spec.url, tiles: spec.tiles, message};
        }, mode);
        // (The route of the tiles stays: a request that the map started before `remove()` can reach the server after
        // an unroute, and its 404 is a page error, #517.)
        await page.unroute('**/test-255.json');
        check(`[${mode}] raster source: setTiles and setUrl load tiles from the new URLs, and a wrong argument gives a message`,
            r.a && r.b && r.c && r.same && r.url === '/test-255.json' && !r.tiles && r.message.startsWith('[map-jr-gl] getSource("r").setTiles'), JSON.stringify(r));
    }
    // Maputnik reads the source layers of each vector source from `map.style.tileManagers[id]._source.vectorLayerIds`
    // (`sourceCaches` in MapLibre GL JS 5), which come from `vector_layers` of the TileJSON (#766).
    {
        await page.route('**/test-766.json', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({tilejson: '2.2.0', tiles: [new URL('/t766/{z}/{x}/{y}.pbf', page.url()).href], vector_layers: [{id: 'roads', fields: {}}, {id: 'water', fields: {}}]})}));
        await page.route(/\/t766\//, route => route.fulfill({status: 404}));
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [0, 0], zoom: 1,
                style: {version: 8, sources: {v: {type: 'vector', url: '/test-766.json'}, g: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: []}});
            m.on('error', () => {});
            await new Promise(r => { m.once('load', r); setTimeout(r, 5000); });
            const gr = () => { const x = m.style.projection.subdivisionGranularity; return [x.tile.getGranularityForZoomLevel(0), x.tile.getGranularityForZoomLevel(3), x.fill.getGranularityForZoomLevel(9), x.circle]; };
            const merc = gr(); m.setProjection({type: 'globe'}); const globe = gr();
            const s = m.style, out = {merc, globe, ids: Object.keys(s.tileManagers).sort(), layers: s.tileManagers.v?._source.vectorLayerIds, geo: s.tileManagers.g?._source.vectorLayerIds, same: s.sourceCaches === s.tileManagers};
            m.remove(); el.remove();
            return out;
        }, mode);
        await page.unroute('**/test-766.json'); await page.unroute(/\/t766\//);
        check(`[${mode}] compat map.style.tileManagers gives the vector_layers ids of each vector source (#766)`,
            r.ids.join() === 'g,v' && r.layers?.join() === 'roads,water' && r.geo === undefined && r.same, JSON.stringify(r));
        // The example page "Add a custom layer with tiles to a globe" reads map.style.projection.subdivisionGranularity (#1453).
        check(`[${mode}] compat map.style.projection.subdivisionGranularity has the values of MapLibre GL JS (#1453)`,
            r.merc.join() === '1,1,1,1' && r.globe.join() === '128,32,2,3', JSON.stringify(r));
    }
    // svelte-maplibre-gl reads `map.style._loaded` before the style has loaded, and the camera in `map.transform` (and
    // `getTransformForUpdate()`) on each `move` (#1375).
    {
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [10, 20], zoom: 3, style: {version: 8, sources: {}, layers: []}});
            const before = {style: !!m.style, loaded: m.style?._loaded};
            await new Promise(r => { m.once('load', r); setTimeout(r, 5000); });
            m.jumpTo({center: [11, 21], zoom: 4, bearing: 30, pitch: 20, padding: {top: 5}});
            const t = m.getTransformForUpdate(), u = m._getTransformForUpdate();
            const out = {before, loaded: m.style._loaded, center: [t.center.lng, t.center.lat], zoom: t.zoom, bearing: t.bearing, pitch: t.pitch, roll: t.roll, elevation: t.elevation,
                padA: t.isPaddingEqual({top: 5}), padB: t.isPaddingEqual(5), same: u.zoom === t.zoom && m.transform.zoom === 4, stopped: m._stop(true) === m};
            m.remove(); el.remove();
            return out;
        }, mode);
        check(`[${mode}] compat map.style exists before the style has loaded, and map.transform has the camera (#1375)`,
            r.before.style && r.before.loaded === false && r.loaded === true && r.center.join() === '11,21' && r.zoom === 4 && r.bearing === 30 && r.pitch === 20 && r.roll === 0
            && r.elevation === 0 && r.padA && !r.padB && r.same && r.stopped, JSON.stringify(r));
    }
    // The other members of a source of the compat entry: the cluster options and the bounds of a GeoJSON source, and
    // `reload` and the values of the TileJSON of a tile source (#566).
    {
        await page.route('**/test-566.json', route => route.fulfill({contentType: 'application/json', body: JSON.stringify({tilejson: '2.2.0', tiles: [new URL('/t566/{z}/{x}/{y}.png', page.url()).href], minzoom: 1, maxzoom: 9})}));
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');
        await page.route(/\/t566\//, route => route.fulfill({contentType: 'image/png', body: png}));
        const r = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), asked = [];
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const point = (lng, lat) => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lng, lat, 5, 7]}});
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [20, 20], zoom: 2,
                transformRequest: url => { asked.push(url.replace(location.origin, '')); return {url}; },
                style: {version: 8, sources: {
                    r: {type: 'raster', url: '/test-566.json', tileSize: 256},
                    g: {type: 'geojson', cluster: true, data: {type: 'FeatureCollection', features: [point(20, 20), point(20.001, 20.002), point(19.997, 20.001)]}},
                }, layers: [{id: 'r', type: 'raster', source: 'r'}, {id: 'g', type: 'circle', source: 'g', paint: {'circle-radius': 10}}]}});
            m.on('error', () => {});
            const idle = () => new Promise(r => { m.once('idle', r); setTimeout(r, 5000); });
            const tiles = () => asked.filter(u => u.startsWith('/t566/')).length;
            const found = async () => { let f = []; for (let i = 0; i < 40 && !f.length; i++) { await new Promise(r => setTimeout(r, 100)); f = await m.queryRenderedFeatures({layers: ['g']}); } return f; };
            const shown = async () => (await found()).map(f => f.properties.point_count ?? 1);
            await idle();
            const g = m.getSource('g'), before = {options: g.getClusterOptions(), shown: await shown(), zoom: await g.getClusterExpansionZoom((await found())[0]?.properties.cluster_id).catch(e => e.message)};
            const promise = g.setClusterOptions({cluster: false, clusterRadius: 20});
            await promise;
            await idle();
            for (let i = 0; i < 40 && (await shown()).length < 3; i++) await new Promise(r => setTimeout(r, 100));
            const g2 = m.getSource('g'), after = {options: g2.getClusterOptions(), shown: await shown(), spec: m.getStyle().sources.g.cluster, zoom: await g2.getClusterExpansionZoom(1).catch(e => e.message)};
            const bounds = (await g2.getBounds()).toArray();
            const message = await g2.setClusterOptions(true).catch(e => e.message);
            const t = m.getSource('r'), had = tiles(), loaded = t.loaded(), serialized = t.serialize();
            const result = t.reload();
            await idle();
            const out = {before, after, bounds, message, isPromise: promise instanceof Promise, had, again: tiles(), loaded, serialized, result,
                minzoom: t.minzoom, maxzoom: t.maxzoom, tiles: t.tiles, geoLoaded: g2.loaded(), geoSerialized: Object.keys(g2.serialize()).sort().join()};
            m.remove(); el.remove();
            return out;
        }, mode);
        // (The route of the tiles stays, as for #255 above.)
        await page.unroute('**/test-566.json');
        check(`[${mode}] GeoJSON source: setClusterOptions builds the clusters again, getClusterOptions gives the options, and getBounds gives the bounds of the data`,
            r.isPromise && JSON.stringify(r.before.options) === '{"cluster":true,"clusterMaxZoom":17,"clusterRadius":50}' && r.before.shown.join() === '3' && r.before.zoom > 2
            && JSON.stringify(r.after.options) === '{"cluster":false,"clusterMaxZoom":17,"clusterRadius":20}' && r.after.shown.join() === '1,1,1' && r.after.spec === false && /no clusters/.test(r.after.zoom)
            && JSON.stringify(r.bounds) === '[[19.997,20],[20.001,20.002]]' && r.message.startsWith('[map-jr-gl] getSource("g").setClusterOptions') && r.geoLoaded && r.geoSerialized === 'cluster,clusterRadius,data,type', JSON.stringify(r));
        check(`[${mode}] raster source: reload loads the tiles again, and the source has the zoom range and the tiles of its TileJSON`,
            r.had > 0 && r.again > r.had && r.result === undefined && r.loaded && r.minzoom === 1 && r.maxzoom === 9 && /\/t566\/\{z\}/.test(r.tiles?.[0]) && JSON.stringify(r.serialized) === '{"type":"raster","url":"/test-566.json","tileSize":256}', JSON.stringify(r));
    }
    // The coarse overview tiles (zoom 11 for a view at zoom 14.3) are not drawn while the tiles of the view are there.
    // Their arrival does not place the labels again: the map fires no second `idle`, and before the first `idle` it
    // does not wait for another placement. They are requested only after the first `idle` (#326).
    {
        let late = 0, first = 0;
        const slow = async r => { first ||= Date.now(); await new Promise(res => setTimeout(res, 2000)); late++; r.continue(); };
        await page.route('**/tiles/11/**', slow);
        await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:1000px;height:700px'}));
            // (A view with many labels: their fade keeps frames coming after the overview is requested.)
            const m = new mod.Map({container: el, renderer: mode, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14.3, attributionControl: false});
            window.overview = {m, el, idles: 0};
            m.on('idle', () => { window.overview.idles++; window.overview.at ||= Date.now(); });
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
        }, mode);
        for (let i = 0; i < 100 && !late; i++) await page.waitForTimeout(100);
        await page.waitForTimeout(1500); // (the tiles arrive and are built, and a frame would place the labels)
        const {idles, at} = await page.evaluate(() => { const {m, el, idles, at} = window.overview; m.remove(); el.remove(); return {idles, at}; });
        await page.unroute('**/tiles/11/**', slow);
        // (A first request up to one worker frame before the page gets `idle` passes: the worker sends `idle` after its
        // frame has gone to the page, and its next frame, which requests the overview, can run first (#555, #756,
        // src/engine.ts:1753-1762). Both times are `Date.now()` of one machine (#789).)
        check(`[${mode}] the overview tiles are requested after the first idle and arrive with no second idle`, late > 0 && idles === 1 && at > 0 && first >= at - 50,
            `idle events=${idles}, late tiles=${late}, first request ${first - at} ms after the first idle`);
    }
    // A map that never becomes idle (here one that keeps rotating from the start) still requests its overview tiles (#326).
    {
        let asked = 0;
        const count = r => { asked++; r.continue(); };
        await page.route('**/tiles/11/**', count);
        await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:600px;height:400px'}));
            const m = new mod.Map({container: el, renderer: mode, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14.3, attributionControl: false});
            m.easeTo({bearing: 170, duration: 60000, easing: t => t});
            window.spinning = {m, el, idles: 0};
            m.on('idle', () => window.spinning.idles++);
        }, mode);
        for (let i = 0; i < 150 && !asked; i++) await page.waitForTimeout(100);
        const idles = await page.evaluate(() => { const {m, el, idles} = window.spinning; m.remove(); el.remove(); return idles; });
        await page.unroute('**/tiles/11/**', count);
        check(`[${mode}] a map that keeps moving from the start still requests its overview tiles`, asked > 0 && idles === 0, `requests=${asked}, idle events=${idles}`);
    }
    // After the first idle, a move to another overview tile requests that tile while the tiles of the view are still on
    // their way, so that the new area shows blurry map and not the background (#360).
    {
        const held = [], hold = r => { held.push(r); };
        let asked = 0;
        const count = r => { asked++; r.continue(); };
        await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:600px;height:400px'}));
            const m = new mod.Map({container: el, renderer: mode, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14.3, attributionControl: false});
            window.moved = {m, el};
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
        }, mode);
        // (The view at -73.80 is in the overview tile 11/604/769; the start is in 11/602/769.)
        await page.route('**/tiles/14/**', hold);
        await page.route('**/tiles/11/604/**', count);
        await page.evaluate(() => window.moved.m.jumpTo({center: [-73.80, 40.7085]}));
        for (let i = 0; i < 50 && !asked; i++) await page.waitForTimeout(100);
        await page.unroute('**/tiles/11/604/**', count);
        await page.unroute('**/tiles/14/**', hold);
        for (const r of held) r.continue().catch(() => {});
        await page.evaluate(() => { const {m, el} = window.moved; m.remove(); el.remove(); });
        check(`[${mode}] after the first idle, a move requests the new overview tile before the tiles of the view arrive`, asked > 0 && held.length > 0, `overview requests=${asked}, held tiles=${held.length}`);
    }
    // CSS on `.maplibregl-map` sizes the container before the map measures it, as in MapLibre GL JS (#248).
    if (mode === 'worker') {
        const sized = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const css = document.head.appendChild(Object.assign(document.createElement('style'), {textContent: '.sized-248.maplibregl-map{height:300px}'}));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {className: 'sized-248', style: 'position:absolute;left:-2000px;top:0;width:300px'}));
            const m = new mod.Map({container: el, style: '/style.json', center: [0, 0], zoom: 1, attributionControl: false});
            // The bounds right after the constructor come from the size that the map measured (0 high without the class).
            const b = m.getBounds(), first = Math.round((b.getNorth() - b.getSouth()) * 1000) / 1000;
            // As in Directus: fitBounds on `load` uses the size that the map measured.
            const zoom = await new Promise(r => { m.once('load', () => { m.fitBounds([[-0.01, -0.01], [0.01, 0.01]], {maxZoom: 8, duration: 0}); r(m.getZoom()); }); setTimeout(() => r(-1), 12000); });
            m.remove(); el.remove(); css.remove();
            return {first, zoom};
        });
        check('[worker] compat: CSS on .maplibregl-map gives the container its height before the first measurement', sized.first > 0 && Math.abs(sized.zoom - 8) < 0.01, JSON.stringify(sized));
    }
    // An HTML marker follows a drag in the frame after each pointer move, as the worker draws it, and does not wait for
    // the camera that the engine reports, which came one frame after the picture (#38). The worker here sends its
    // camera 150 ms late, so that the marker can only be in place in time when the page places it. (The page learns the
    // ground that the engine grabbed from the first report of the drag: the test waits for it after the first move.)
    if (mode === 'worker' && !workerCan) for (const name of ['an HTML marker follows a drag in the second frame after each pointer move, without waiting for the camera of the engine (#38)', 'a drag that starts during an easeTo does not jump back (#38)']) skip(`[worker] compat: ${name}`, noWorkerRender);
    else if (mode === 'worker') {
        const followed = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const code = `const post = self.postMessage.bind(self); self.postMessage = (m, t) => m && m.type === 'camera' ? setTimeout(() => post(m, t), 150) : post(m, t); importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const m = new mod.Map({container: el, renderer: 'worker', center: [0, 0], zoom: 3, attributionControl: false, dragPan: {inertia: false}, createWorker: () => new Worker(url),
                style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            await new Promise(r => { m.once('load', r); setTimeout(r, 12000); });
            const dot = Object.assign(document.createElement('div'), {style: 'width:4px;height:4px'});
            new mod.Marker({element: dot}).setLngLat([0, 0]).addTo(m);
            const x = () => +/translate\((-?\d+)px/.exec(dot.style.transform)[1];
            const frame = () => new Promise(r => requestAnimationFrame(r));
            const c = m.getCanvas(), r = c.getBoundingClientRect();
            const ptr = (type, px) => c.dispatchEvent(new PointerEvent(type, {bubbles: true, clientX: r.left + px, clientY: r.top + 150, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true}));
            const start = x(), moved = [];
            ptr('pointerdown', 260); ptr('pointermove', 250);
            await new Promise(res => setTimeout(res, 250));
            for (let i = 1; i <= 8; i++) { ptr('pointermove', 250 - i * 10); await frame(); await frame(); moved.push(start - x() - 10); }
            ptr('pointerup', 170);
            // (The last camera of the engine comes 150 ms late.)
            await new Promise(res => setTimeout(res, 400));
            const out = {renderer: m.renderer, moved, end: start - x(), project: Math.round(m.project([0, 0]).x) - x()};
            m.remove(); el.remove();
            return out;
        });
        check('[worker] compat: an HTML marker follows a drag in the second frame after each pointer move, without waiting for the camera of the engine (#38)',
            followed.renderer === 'worker' && followed.moved.every((d, i) => d === (i + 1) * 10) && followed.end === 90 && followed.project === 0, JSON.stringify(followed));
        // A drag that starts during an `easeTo` holds the ground where the engine stopped, not where the page last saw the
        // camera: the map does not jump back. The worker sends its camera 50 ms late, and the test logs each camera
        // in the worker, before the delay.
        const steps = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:500px;height:400px'}));
            const code = `const post = self.postMessage.bind(self); self.postMessage = (m, t) => { if (m && m.type === 'camera') { post({type: 'test-camera', lng: m.lng, t: performance.timeOrigin + performance.now()}); setTimeout(() => post(m, t), 50); } else post(m, t); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const log = [];
            const m = new mod.Map({container: el, renderer: 'worker', center: [-150, 0], zoom: 3, attributionControl: false, dragPan: {inertia: false},
                createWorker: () => { const w = new Worker(url); w.addEventListener('message', e => { if (e.data?.type === 'test-camera') log.push(e.data); }); return w; },
                style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            await new Promise(r => { m.once('idle', r); setTimeout(r, 12000); });
            const c = m.getCanvas(), r = c.getBoundingClientRect();
            const ptr = (type, px) => c.dispatchEvent(new PointerEvent(type, {bubbles: true, clientX: r.left + px, clientY: r.top + 200, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true}));
            const frame = () => new Promise(r => requestAnimationFrame(r));
            m.easeTo({center: [150, 0], duration: 3000, easing: t => t});
            await new Promise(r => setTimeout(r, 1000));
            const t0 = performance.timeOrigin + performance.now();
            ptr('pointerdown', 250); ptr('pointermove', 240);
            for (let i = 2; i <= 5; i++) { await frame(); ptr('pointermove', 250 - i * 10); }
            await frame(); await frame();
            ptr('pointerup', 200);
            await new Promise(r => setTimeout(r, 400));
            m.remove(); el.remove();
            // Pixels that the centre moved east between two reports, from the last report before the drag.
            const i0 = log.findIndex(s => s.t >= t0), perDegree = 512 * 8 / 360;
            return {renderer: m.renderer, steps: log.slice(Math.max(0, i0 - 1), i0 + 6).map((s, i, a) => i ? Math.round((s.lng - a[i - 1].lng) * perDegree) : null).slice(1)};
        });
        // (Each move goes 10 px west, and the centre goes east. A jump back is a step west: the page's camera is 50 ms and
        // more than 57 px behind the engine's. The first step is 10 px or more: it is one move when the worker draws a
        // frame between the first move and the second, which happens in CI (#616), two moves when the second move
        // arrives before that frame, or a frame of the `easeTo`, about 19 px.)
        check('[worker] compat: a drag that starts during an easeTo does not jump back (#38)',
            steps.renderer === 'worker' && steps.steps.length >= 4 && steps.steps[0] >= 10 && steps.steps.every(d => d >= 0), JSON.stringify(steps));
    }
    // A worker that cannot make a WebGL2 context: the map goes to the main thread, `load` and `idle` fire, and what the
    // page sent before the fall back (the rules for requests, a change of the style) is not lost.
    if (mode === 'worker') {
        const fell = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const seen = [], asked = [], warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(a.join(' ')); // (with the default renderer 'auto' the map does not warn; #792)
            const m = new mod.Map({container: el, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14, attributionControl: false, createWorker: () => new Worker(url),
                transformRequest: (u, kind) => { asked.push(kind === 'Tile' && /\/14\//.test(u) ? 'view' : kind); return {url: u}; }});
            for (const type of ['load', 'idle', 'error']) m.on(type, () => seen.push(type));
            // A change of the style at once: it goes to the worker that fails.
            m.once('style.load', () => m.addLayer({id: 'fall-back-test', type: 'background', paint: {'background-color': '#f0f', 'background-opacity': 0.01}}));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 12000); });
            console.warn = warn;
            const out = {renderer: m.renderer, seen: [...new Set(seen)], warnings: warnings.filter(w => /using the main thread/.test(w)).length, tiles: asked.filter(k => k === 'view').length, layer: (await Promise.race([m.queryRenderedFeatures({layers: ['building']}), new Promise(r => setTimeout(() => r([]), 4000))])).length};
            m.remove(); el.remove();
            return out;
        });
        // (Only the tiles of the view count: the coarse overview tiles come later and could hide a tile of the view that
        // the new engine fetched before it had the rules for requests; #355.)
        check('[worker] a worker without WebGL2 and renderer \'auto\': the map uses the main thread without a warning, load and idle fire, and transformRequest sees the tile requests of the view',
            fell.renderer === 'main' && fell.warnings === 0 && fell.seen.includes('load') && fell.seen.includes('idle') && !fell.seen.includes('error') && fell.tiles > 0 && fell.layer > 0, JSON.stringify(fell));
    }
    // The data that setData gives to the worker that fails reaches the engine on the main thread (#852).
    if (mode === 'worker') {
        const data = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, attributionControl: false, center: [0, 0], zoom: 2, createWorker: () => new Worker(url),
                style: {version: 8, sources: {pts: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'p', type: 'circle', source: 'pts'}]}});
            m.once('style.load', () => m.getSource('pts').setData({type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [1, 1]}}]}));
            let count = 0;
            for (let i = 0; i < 16 && !count; i++) { await new Promise(r => setTimeout(r, 500)); count = m.renderer === 'main' ? (await m.querySourceFeatures('pts')).length : 0; }
            const out = {renderer: m.renderer, count};
            m.remove(); el.remove();
            return out;
        });
        check('[worker] the data of setData that went to a worker without WebGL2 reaches the engine on the main thread (#852)',
            data.renderer === 'main' && data.count === 1, JSON.stringify(data));
    }
    // A map whose worker cannot make a WebGL2 context behaves as a map that started on the main thread (#777): a source
    // that fails gives one error, an easeTo of 60 s that started before the fall back still runs, and cooperativeGestures
    // turned on after the fall back sets touch-action on the canvas that the map shows and blocks a plain wheel.
    if (mode === 'worker') {
        const same = {};
        for (const kind of ['main', 'fallback']) same[kind] = await page.evaluate(async kind => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:1000'}));
            const wait = ms => new Promise(r => setTimeout(r, ms)), errors = [], idles = [];
            const m = new mod.Map({container: el, attributionControl: false, center: [0, 0], zoom: 2, pitch: 20, ...(kind === 'main' ? {renderer: 'main'} : {createWorker: () => new Worker(url)}),
                style: {version: 8, sources: {gone: {type: 'vector', url: '/no-such-tilejson.json'}, bad: {type: 'geojson', data: '/no-such-file.geojson'}}, layers: [{id: 'b', type: 'background', paint: {'background-color': '#ccc'}}]}});
            m.on('error', e => errors.push(String(e.error?.message).replace(location.origin, '')));
            m.on('idle', () => idles.push(m.isMoving()));
            m.easeTo({zoom: 5, duration: 60000, easing: t => t});
            await wait(3000);
            const easing = {moving: m.isMoving(), idles: idles.length, zoomed: m.getZoom() > 2.02, pitch: m.getPitch()};
            m.stop();
            await new Promise(r => { m.once('idle', r); setTimeout(r, 5000); });
            m.cooperativeGestures.enable();
            await wait(500);
            const z = m.getZoom(), r = m.getCanvas().getBoundingClientRect();
            m.getCanvas().dispatchEvent(new WheelEvent('wheel', {deltaY: -300, clientX: r.left + 300, clientY: r.top + 200, bubbles: true, cancelable: true}));
            await wait(800);
            const out = {renderer: m.renderer, errors: errors.sort(), ...easing, touch: m.getCanvas().style.touchAction, wheel: Math.abs(m.getZoom() - z) > 0.01, canvases: el.querySelectorAll('canvas').length};
            m.remove(); el.remove();
            return out;
        }, kind);
        const {renderer, ...main} = same.main, {renderer: fellTo, ...fell} = same.fallback;
        check('[worker] a map that fell back to the main thread behaves as one that started there: one error for each failed source, an easeTo of 60 s keeps running, and cooperativeGestures blocks the wheel on the canvas it shows (#777)',
            renderer === 'main' && fellTo === 'main' && JSON.stringify(main) === JSON.stringify(fell) && main.errors.length === 2 && main.moving && main.idles === 0 && main.touch === 'pan-x pan-y' && !main.wheel,
            JSON.stringify(same));
        // Two maps that fall back and share one style object, with a GeoJSON source that fails: each fires its own one error.
        const pair = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const style = {version: 8, sources: {bad: {type: 'geojson', data: '/no-such-shared.geojson'}}, layers: [{id: 'b', type: 'background', paint: {'background-color': '#ccc'}}]};
            const maps = [0, 1].map(() => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
                const m = new mod.Map({container: el, style, attributionControl: false, createWorker: () => new Worker(url)}), errors = [];
                m.on('error', e => errors.push(String(e.error?.message)));
                return {m, el, errors};
            });
            await Promise.all(maps.map(({m}) => new Promise(r => { m.once('idle', r); setTimeout(r, 10000); })));
            await new Promise(r => setTimeout(r, 2000));
            const out = maps.map(({m, errors}) => ({renderer: m.renderer, errors: errors.length}));
            for (const {m, el} of maps) { m.remove(); el.remove(); }
            return out;
        });
        check('[worker] two maps that fall back and share a style object with a GeoJSON source that fails: each map fires one error (#777)',
            pair.every(p => p.renderer === 'main' && p.errors === 1), JSON.stringify(pair));
    }
    // The same with the engine chunk delayed by 6 seconds, on a page of its own (the chunk is not in its module cache).
    // The watch of the worker must not count while the chunk loads: one warning, no `webglcontextlost`, one canvas.
    // (A browser that cannot render in a worker goes to the main thread before the worker of the test can fail.)
    if (mode === 'worker' && !workerCan) skip('[worker] a worker without WebGL2, renderer \'worker\' and an engine chunk that takes 6 seconds: one engine on the main thread, one warning, and no webglcontextlost', noWorkerRender);
    else if (mode === 'worker') {
        const slowContext = await page.context().browser().newContext({viewport: page.viewportSize()}), slow = await slowContext.newPage();
        await slow.route(/engine-entry-.*\.js/, async r => { await new Promise(f => setTimeout(f, 6000)); await r.continue(); });
        await slow.goto(page.url());
        const late = await slow.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const seen = [], warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(a.join(' '));
            const m = new mod.Map({container: el, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14, attributionControl: false, renderer: 'worker', createWorker: () => new Worker(url)});
            for (const type of ['load', 'idle', 'error', 'webglcontextlost']) m.on(type, () => seen.push(type));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 20000); });
            await new Promise(r => setTimeout(r, 2000));
            console.warn = warn;
            const out = {renderer: m.renderer, seen: [...new Set(seen)], warnings: warnings.filter(w => /using the main thread/.test(w)).length, canvases: el.querySelectorAll('canvas').length};
            m.remove(); el.remove();
            return out;
        });
        await slowContext.close();
        check('[worker] a worker without WebGL2, renderer \'worker\' and an engine chunk that takes 6 seconds: one engine on the main thread, one warning, and no webglcontextlost',
            late.renderer === 'main' && late.seen.includes('idle') && !late.seen.includes('webglcontextlost') && !late.seen.includes('error') && late.warnings === 1 && late.canvases === 1, JSON.stringify(late));
    }
    // A worker whose WebGL context is lost (#78). In each case the map must go to the main thread and warn once.
    // - `now`: each worker loses the context directly after the start, before its first frame or just after it.
    // - `quiet`: the first worker loses the context after some frames, so the map starts a second worker. That one gets
    //   no event and cannot draw (each drawing call fails, and the worker keeps that error to itself), so it reports
    //   no frame. After 5 seconds the map goes to the main thread.
    // - `hang`: as `quiet`, but the second worker draws its first frame and then stops: it takes no messages and draws
    //   nothing. This is what Safari 27.2 did on a machine without a GPU (the debug record of the Safari job of
    //   2026-11-12: one loss, one restore, a first frame, and then no answer from the worker).
    // - `hidden`: as `hang`, while the page is hidden for 8 seconds. That time does not count, because an engine draws
    //   nothing for a hidden page.
    // - `first`: the first worker draws its first frame and then stops, with no lost context at all (#119).
    if (mode === 'worker' && !workerCan) {
        for (const name of ['a worker that loses its WebGL context at once: the map goes to the main thread after one or two losses, warns once, and load and idle fire',
            'one loss, one restore, then a worker that cannot draw: the map goes to the main thread after 5 seconds, warns once, and load and idle fire',
            'one loss, one restore, then a worker that stops after its first frame: the map goes to the main thread after 5 seconds, warns once, and load and idle fire',
            'the same while the page is hidden for 8 seconds: the map stays with the worker for that time, and goes to the main thread 5 seconds later',
            'a worker that stops after its first frame at its first start, with no lost context: the map goes to the main thread after 5 seconds, warns once, and load and idle fire']) skip(`[worker] ${name}`, noWorkerRender);
    } else if (mode === 'worker') {
        for (const kind of ['now', 'quiet', 'hang', 'hidden', 'first']) {
            const fell = await page.evaluate(async kind => {
                const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
                const wrap = then => URL.createObjectURL(new Blob([`const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { const gl = get.call(this, kind, ...rest); if (gl && /webgl/.test(kind)) { const lose = () => gl.getExtension('WEBGL_lose_context').loseContext(); ${then} } return gl; }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`], {type: 'text/javascript'}));
                const now = wrap('setTimeout(lose, 0);');
                const later = wrap('let n = 0; const f = () => ++n < 30 ? requestAnimationFrame(f) : lose(); f();');
                const silent = wrap(`self.onerror = () => true; for (const call of ['clear', 'drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) gl[call] = () => { throw new Error('no drawing'); };`);
                // (The worker stops 50 ms after the message of its first frame: a loop without end, until the map ends the worker.)
                const hang = URL.createObjectURL(new Blob([`const post = self.postMessage; self.postMessage = function (m, ...rest) { post.call(this, m, ...rest); if (m && m.type === 'frame') setTimeout(() => { for (;;); }, 50); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`], {type: 'text/javascript'}));
                const seen = [], warnings = [], warn = console.warn, start = performance.now();
                console.warn = (...a) => warnings.push(a.join(' '));
                let lost = 0, secondLoss = 0;
                const m = new mod.Map({container: el, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14, attributionControl: false, renderer: 'worker',
                    createWorker: () => new Worker(kind === 'first' ? hang : kind === 'now' ? now : !lost ? later : kind === 'quiet' ? silent : hang)});
                for (const type of ['load', 'idle', 'error']) m.on(type, () => seen.push(type));
                m.on('webglcontextlost', () => { if (++lost === 2) secondLoss = performance.now(); });
                let firstLoss = 0, hide = false, whileHidden;
                if (kind === 'hidden') Object.defineProperty(document, 'hidden', {get: () => hide, configurable: true});
                m.once('webglcontextlost', () => {
                    firstLoss = performance.now();
                    hide = true;
                    setTimeout(() => { whileHidden = m.renderer; hide = false; }, 8000);
                });
                let toMain = 0;
                for (let i = 0; i < 300 && !(m.renderer === 'main' && m.areTilesLoaded()); i++) { await new Promise(r => setTimeout(r, 100)); if (!toMain && m.renderer === 'main') toMain = performance.now() - start; }
                console.warn = warn;
                delete document.hidden; // (the property of the test: the one of the browser is on the prototype)
                const out = {renderer: m.renderer, lost, whileHidden, seen: [...new Set(seen)], warnings: warnings.filter(w => /using the main thread: the WebGL context was lost/.test(w)).length,
                    waited: secondLoss && firstLoss ? Math.round(secondLoss - firstLoss) : null, toMain: Math.round(toMain), loaded: m.areTilesLoaded(), layer: (await Promise.race([m.queryRenderedFeatures({layers: ['building']}), new Promise(r => setTimeout(() => r([]), 4000))])).length};
                m.remove(); el.remove();
                return out;
            }, kind);
            const ok = fell.renderer === 'main' && fell.seen.includes('load') && fell.seen.includes('idle') && !fell.seen.includes('error') && fell.warnings === 1 && fell.loaded && fell.layer > 0;
            if (kind === 'now') check('[worker] a worker that loses its WebGL context at once: the map goes to the main thread after one or two losses, warns once, and load and idle fire', ok && fell.lost <= 2, JSON.stringify(fell));
            else if (kind === 'quiet' || kind === 'hang') check(`[worker] one loss, one restore, then a worker that ${kind === 'quiet' ? 'cannot draw' : 'stops after its first frame'}: the map goes to the main thread after 5 seconds, warns once, and load and idle fire`, ok && fell.lost === 2 && fell.waited >= 5000 && fell.waited < 9000, JSON.stringify(fell));
            else if (kind === 'first') check('[worker] a worker that stops after its first frame at its first start, with no lost context: the map goes to the main thread after 5 seconds, warns once, and load and idle fire', ok && fell.lost === 1 && fell.toMain >= 5000 && fell.toMain < 10000, JSON.stringify(fell));
            else check('[worker] the same while the page is hidden for 8 seconds: the map stays with the worker for that time, and goes to the main thread 5 seconds later', ok && fell.lost === 2 && fell.whileHidden === 'worker' && fell.waited >= 13000, JSON.stringify(fell));
        }
    }
    // maplibre-compat does not accept in silence what it cannot do: options with no effect warn, style calls that MapLibre
    // refuses fire `error`, and `strict: true` throws.
    if (mode === 'main') {
        const quiet = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(a.join(' '));
            const make = options => { const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'})); return new mod.Map({container: el, renderer: 'main', attributionControl: false, style: {version: 8, sources: {g: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'bg', type: 'background'}]}, ...options}); };
            const m = make({locale: {x: 'y'}, renderWorldCopies: false, canvasContextAttributes: {antialias: true, preserveDrawingBuffer: true}, center: [50, 50], zoom: 3, maxBounds: [[-10, -10], [10, 10]]});
            // The view is inside maxBounds directly after the constructor, before the engine reports the camera (MapLibre GL JS 6.17 gives [1.2109, 3.4573]).
            const clamped = m.getCenter().toArray();
            const options = warnings.splice(0), errors = [];
            m.on('error', e => errors.push(e.error.message));
            await new Promise(r => m.once('load', r));
            // (A custom layer works on this map, made with renderer: 'main': it gives no warning. See test/custom-layers.mjs.)
            m.addLayer({id: 'custom', type: 'custom', render() {}});
            const custom = warnings.splice(0);
            m.addLayer({id: 'bg', type: 'background'});
            m.addLayer({id: 'lost', type: 'fill', source: 'nowhere'});
            m.addSource('g', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
            m.addLayer({id: 'uses-g', type: 'fill', source: 'g'});
            m.removeSource('g');
            await wait(300);
            const out = {options, custom, errors: errors.slice(), layers: m.getStyle().layers.map(l => l.id).join(), source: !!m.getSource('g'), bounds: m.getMaxBounds()?.toArray(), clamped, later: m.getCenter().toArray()};
            // A source object in the layer becomes a source with the id of the layer, as in MapLibre GL JS (#469).
            const line = {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-8, -8], [8, 8]]}}};
            const given = {id: 'inline', type: 'line', source: line, paint: {'line-width': 10}};
            m.addLayer(given);
            m.addLayer({id: 'inline-2', type: 'circle', source: 'inline'});
            m.addLayer({id: 'g', type: 'line', source: line});
            await wait(600);
            out.inline = {errors: errors.slice(4), layers: m.getStyle().layers.map(l => l.id).join(), source: m.getStyle().sources.inline?.type, of: m.getStyle().layers.find(l => l.id === 'inline')?.source,
                drawn: m.queryRenderedFeatures({layers: ['inline']}).length, kept: given.source === line};
            // The option projection has no effect, as in MapLibre GL JS 6.17 (#463): one warning, and Mercator.
            const projected = make({projection: {type: 'globe'}});
            await new Promise(r => projected.once('load', r));
            out.projected = [projected.getProjection()?.type ?? 'none', warnings.splice(0).filter(w => w.includes('the option projection has no effect')).length];
            // The debug drawing is not available (#752): showCollisionBoxes = true warns once, false does not warn.
            projected.showTileBoundaries = false;
            projected.showCollisionBoxes = true; projected.showCollisionBoxes = true;
            out.debugDraw = [projected.showCollisionBoxes, warnings.splice(0).filter(w => w.startsWith('[map-jr-gl] showCollisionBoxes has no effect')).length, warnings.length];
            projected.getContainer().remove(); projected.remove();
            // The defaults give no warning.
            const plain = make({projection: {type: 'mercator'}, renderWorldCopies: true, canvasContextAttributes: {antialias: false}});
            out.plain = warnings.splice(0);
            let thrown = '';
            try { make({strict: true, renderWorldCopies: false}); } catch (e) { thrown = e.message; }
            const strict = make({strict: true});
            await new Promise(r => strict.once('load', r));
            let thrownCall = '';
            try { strict.addLayer({id: 'bg', type: 'background'}); } catch (e) { thrownCall = e.message; }
            console.warn = warn;
            for (const x of [m, plain, strict]) { const el = x.getContainer(); x.remove(); el.remove(); }
            return {...out, thrown, thrownCall};
        });
        check('[main] maplibre-compat: showCollisionBoxes = true gives one warning, and showTileBoundaries = false none (#752)',
            JSON.stringify(quiet.debugDraw) === '[true,1,0]', JSON.stringify(quiet.debugDraw));
        check('[main] maplibre-compat: each option with no effect gives one warning, the defaults give none, the option projection has no effect, and maxBounds works',
            quiet.options.length === 2 && ['The option renderWorldCopies', 'new Map(): canvasContextAttributes.preserveDrawingBuffer has no effect. Read the canvas with map.toBlob()'].every(n => quiet.options.some(w => w.startsWith('[map-jr-gl] ' + n))) && quiet.plain.length === 0 && String(quiet.bounds) === '-10,-10,10,10' && quiet.clamped.every((v, i) => Math.abs(v - [1.2109, 3.4573][i]) < 1e-3) && quiet.later.every((v, i) => Math.abs(v - [1.2109, 3.4573][i]) < 1e-3)
            && quiet.custom.length === 0 && quiet.projected?.join() === 'none,1', JSON.stringify({options: quiet.options, plain: quiet.plain, bounds: quiet.bounds, clamped: quiet.clamped, later: quiet.later, custom: quiet.custom, projected: quiet.projected}));
        check('[main] maplibre-compat: a layer or source id that exists, a source that is not there, and a source in use fire error and change nothing',
            quiet.errors.length === 4 && /addLayer: the style has a layer with the id "bg"/.test(quiet.errors[0]) && /names the source "nowhere"/.test(quiet.errors[1]) && /addSource: the style has a source with the id "g"/.test(quiet.errors[2]) && /removeSource: the layer "uses-g" uses the source "g"/.test(quiet.errors[3]) && quiet.layers === 'bg,uses-g' && quiet.source, JSON.stringify({errors: quiet.errors, layers: quiet.layers, source: quiet.source}));
        check('[main] maplibre-compat: addLayer with a source object adds the source under the id of the layer, and fires error when that source exists',
            quiet.inline.errors.length === 1 && /addLayer: the layer "g" has a source object, and the style has a source with the id "g" already/.test(quiet.inline.errors[0]) && quiet.inline.layers === 'bg,uses-g,inline,inline-2'
            && quiet.inline.source === 'geojson' && quiet.inline.of === 'inline' && quiet.inline.drawn > 0 && quiet.inline.kept, JSON.stringify(quiet.inline));
        check('[main] maplibre-compat: strict: true throws for an option with no effect and for a refused style call',
            quiet.thrown.startsWith('[map-jr-gl] The option renderWorldCopies: false has no effect') && /addLayer: the style has a layer with the id "bg"/.test(quiet.thrownCall), JSON.stringify({thrown: quiet.thrown, thrownCall: quiet.thrownCall}));
    }
    // #1431: on the globe a '3d' custom layer shares the depth of the fill-extrusion layers below it: a quad at 1000 m
    // is hidden inside a building 3000 m tall and shows above a building 300 m tall. (The building is small: the roof
    // of an extrusion on the globe is flat between its corners, so a wide one stands kilometres above the sphere.)
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const out = {};
            for (const height of [3000, 300]) {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:200px;height:150px'}));
                const box = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-0.02, -0.02], [0.02, -0.02], [0.02, 0.02], [-0.02, 0.02], [-0.02, -0.02]]]}};
                const m = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 9, pitch: 30, canvasContextAttributes: {preserveDrawingBuffer: true},
                    style: {version: 8, projection: {type: 'globe'}, sources: {b: {type: 'geojson', data: box}}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#000'}},
                        {id: 'x', type: 'fill-extrusion', source: 'b', paint: {'fill-extrusion-color': '#f00', 'fill-extrusion-height': height}}]}});
                let program, buffer, pixel = null, error = null;
                const layer = {id: 'c', type: 'custom', renderingMode: '3d', onAdd(map, gl) { buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([4095, 4095, 4097, 4095, 4095, 4097, 4097, 4097]), gl.STATIC_DRAW); },
                    render(gl, args) {
                        if (args.shaderData.variantName !== 'globe') return;
                        const t = args.getProjectionData({tileID: {canonical: {x: 0, y: 0, z: 0}, wrap: 0}, applyGlobeMatrix: true});
                        if (!program) {
                            const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) error = gl.getShaderInfoLog(s); return s; };
                            program = gl.createProgram();
                            gl.attachShader(program, sh(gl.VERTEX_SHADER, `#version 300 es\n${args.shaderData.define}\n${args.shaderData.vertexShaderPrelude}\nin vec2 a_pos; void main() { gl_Position = projectTileFor3D(a_pos, 1000.0); }`));
                            gl.attachShader(program, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 c; void main() { c = vec4(0.0, 1.0, 0.0, 1.0); }'));
                            gl.bindAttribLocation(program, 0, 'a_pos'); gl.linkProgram(program);
                        }
                        gl.useProgram(program);
                        const u = n => gl.getUniformLocation(program, n);
                        gl.uniformMatrix4fv(u('u_projection_matrix'), false, t.mainMatrix); gl.uniformMatrix4fv(u('u_projection_fallback_matrix'), false, t.fallbackMatrix);
                        gl.uniform4f(u('u_projection_tile_mercator_coords'), ...t.tileMercatorCoords); gl.uniform4f(u('u_projection_clipping_plane'), ...t.clippingPlane);
                        gl.uniform1f(u('u_projection_transition'), t.projectionTransition);
                        gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                        const px = new Uint8Array(4); gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); pixel = Array.from(px);
                    }};
                try {
                    await new Promise(r => m.once('load', r));
                    m.addLayer(layer);
                    await new Promise(r => m.once('idle', r)); m.triggerRepaint(); await wait(300);
                    out[height] = {pixel, error};
                } finally { m.remove(); el.remove(); }
            }
            return out;
        });
        const hidden = r[3000]?.pixel, shown = r[300]?.pixel;
        check('[main] maplibre-compat: on the globe a \'3d\' custom layer and a fill-extrusion layer below it hide each other (#1431)',
            !r[3000]?.error && hidden?.[0] > 100 && hidden[1] < 50 && shown?.[1] > 200 && shown[0] < 50, JSON.stringify(r));
    }
    // Custom layers (#45): with renderer: 'main' they draw in their place; with the worker renderer they are an error.
    if (mode === 'main') await checkCustomLayers(page, check);
    // #1431: on the globe a custom layer draws with the projection data of the globe, as in MapLibre GL JS 6.17, and
    // the map writes no warning; in Mercator it gets the Mercator data again.
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const warnings = [], warn = console.warn;
            console.warn = (...a) => { if (String(a[0]).startsWith('[map-jr-gl]')) warnings.push(a.join(' ')); else warn(...a); };
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:200px;height:150px'}));
            const m = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 1, canvasContextAttributes: {preserveDrawingBuffer: true},
                style: {version: 8, projection: {type: 'globe'}, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#000'}}]}});
            const seen = [];
            let program, buffer, error = null, pixel = null;
            const layer = {id: 'c', type: 'custom', onAdd(map, gl) { buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([3696, 3696, 4496, 3696, 3696, 4496, 4496, 4496]), gl.STATIC_DRAW); },
                render(gl, args) {
                    const t = args.getProjectionData({tileID: {canonical: {x: 0, y: 0, z: 0}, wrap: 0}, applyGlobeMatrix: true}), d = args.defaultProjectionData, M = d.mainMatrix;
                    const w = M[11] + M[15];
                    seen.push({variant: args.shaderData.variantName, define: args.shaderData.define, transition: d.projectionTransition, tileTransition: t.projectionTransition,
                        plane: Array.from(d.clippingPlane).map(v => +v.toFixed(3)), coords: t.tileMercatorCoords, centre: [(M[8] + M[12]) / w, (M[9] + M[13]) / w, (M[10] + M[14]) / w].map(v => +v.toFixed(3)),
                        nearZ: args.nearZ, farZ: args.farZ === Infinity ? null : args.farZ, fallback: t.fallbackMatrix !== t.mainMatrix});
                    if (!program && args.shaderData.variantName === 'globe') {
                        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) error = gl.getShaderInfoLog(s); return s; };
                        program = gl.createProgram();
                        gl.attachShader(program, sh(gl.VERTEX_SHADER, `#version 300 es\n${args.shaderData.define}\n${args.shaderData.vertexShaderPrelude}\nin vec2 a_pos; void main() { gl_Position = projectTile(a_pos); }`));
                        gl.attachShader(program, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 c; void main() { c = vec4(1.0, 0.0, 0.0, 1.0); }'));
                        gl.bindAttribLocation(program, 0, 'a_pos'); gl.linkProgram(program);
                    }
                    if (args.shaderData.variantName !== 'globe') return;
                    gl.useProgram(program);
                    const u = n => gl.getUniformLocation(program, n);
                    gl.uniformMatrix4fv(u('u_projection_matrix'), false, t.mainMatrix); gl.uniformMatrix4fv(u('u_projection_fallback_matrix'), false, t.fallbackMatrix);
                    gl.uniform4f(u('u_projection_tile_mercator_coords'), ...t.tileMercatorCoords); gl.uniform4f(u('u_projection_clipping_plane'), ...t.clippingPlane);
                    gl.uniform1f(u('u_projection_transition'), t.projectionTransition);
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                    const px = new Uint8Array(4); gl.readPixels(gl.drawingBufferWidth >> 1, gl.drawingBufferHeight >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); pixel = Array.from(px);
                }};
            try {
                await new Promise(r => m.once('load', r));
                m.addLayer(layer);
                await wait(500); m.triggerRepaint(); await wait(300);
                const globe = seen.at(-1), globePixel = pixel;
                m.setProjection({type: 'mercator'});
                await wait(500); m.triggerRepaint(); await wait(300);
                return {globe, pixel: globePixel, error, mercator: seen.at(-1), warnings: warnings.filter(w => w.includes('ustom'))};
            } finally { console.warn = warn; m.remove(); el.remove(); }
        });
        const g = r.globe;
        check('[main] maplibre-compat: on the globe a custom layer gets the projection data of the globe, its prelude draws, and no warning (#1431)',
            g?.variant === 'globe' && g.define === '#define GLOBE' && g.transition === 1 && g.tileTransition === 1 && g.fallback && g.nearZ > 0 && g.farZ === null
            && Math.hypot(...g.plane.slice(0, 3)) > 0.99 && g.plane[3] < 0 && g.coords.join() === '0,0,0.0001220703125,0.0001220703125'
            && Math.abs(g.centre[0]) < 0.01 && Math.abs(g.centre[1]) < 0.01 && g.centre[2] > -1 && g.centre[2] < 1
            && !r.error && r.pixel?.[0] > 200 && r.pixel[1] < 50 && r.mercator?.variant === 'mercator' && r.mercator.transition === 0 && r.warnings.length === 0, JSON.stringify(r));
    }
    // #1430: with 3D terrain a circle stands on the ground, and the ground in front of its centre hides it, as in MapLibre
    // GL JS. The ground is 1000 m with a ridge of 1500 m along lng 0.01: a circle behind the ridge is hidden (0 px), and
    // one in front of it is whole (about 1176 px for a radius of 20).
    {
        const r = await page.evaluate(async renderer => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), proto = 'ridge' + renderer;
            // The pixels of the canvas, read in the frame that draws them (the canvas keeps no picture after its frame).
            const shot = (map, w, h) => new Promise(r => { map.once('render', () => { const k = Object.assign(document.createElement('canvas'), {width: w, height: h}).getContext('2d'); k.drawImage(map.getCanvas(), 0, 0, w, h); r(k.getImageData(0, 0, w, h).data); }); map.triggerRepaint(); });
            mod.addProtocol(proto, async p => {
                const [z, x] = p.url.split('://')[1].split('/').map(Number), c = new OffscreenCanvas(256, 256), g = c.getContext('2d'), img = g.createImageData(256, 256);
                for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
                    const lng = (x + (i + 0.5) / 256) / 2 ** z * 360 - 180, v = 1000 + 1500 * Math.exp(-(((lng - 0.01) / 0.003) ** 2)) + 32768, k = (j * 256 + i) * 4;
                    img.data[k] = Math.floor(v / 256); img.data[k + 1] = Math.floor(v % 256); img.data[k + 2] = Math.round(v % 1 * 256); img.data[k + 3] = 255;
                }
                g.putImageData(img, 0, 0);
                return {data: await (await c.convertToBlob({type: 'image/png'})).arrayBuffer()};
            });
            const red = async (point, view, want) => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:60'}));
                const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: [proto + '://{z}/{x}/{y}'], encoding: 'terrarium', tileSize: 256, maxzoom: 12}, p: {type: 'geojson', data: {type: 'Point', coordinates: point}}},
                    terrain: {source: 'dem'}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'c', type: 'circle', source: 'p', paint: {'circle-color': '#f00', 'circle-radius': 20}}]};
                const map = new mod.Map({container: el, style, center: [0, 0], bearing: 90, ...view, renderer, attributionControl: false});
                try {
                    await new Promise(r => map.once('idle', r));
                    // Read when the ridge has its height (and for the circle in front, when the circle is drawn), for up to 10 s.
                    let n = 0;
                    for (let t = 0; t < 50; t++) {
                        await new Promise(r => setTimeout(r, 200));
                        const d = await shot(map, 900, 700); n = 0;
                        for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 80 && d[i + 2] < 80) n++;
                        if ((map.queryTerrainElevation([0.01, 0]) ?? 0) > 2000 && (want === 'none' || n > 1100)) break;
                    }
                    return n;
                } finally { map.remove(); el.remove(); }
            };
            return {behind: await red([0.02, 0], {zoom: 14, pitch: 80}, 'none'), front: await red([0, 0], {zoom: 13, pitch: 60}, 'whole')};
        }, mode);
        check(`[${mode}] 3D terrain: a circle behind a ridge is hidden, and a circle in front of it is whole (#1430)`, r.behind === 0 && r.front > 1100, JSON.stringify(r));
    }
    // #1430: on the globe with 3D terrain, project() gives the place where a circle is drawn, and queryRenderedFeatures
    // finds it there. The ground is 3000 m everywhere (before, project() took the place at sea level, 15 px off).
    {
        const r = await page.evaluate(async renderer => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            // The pixels of the canvas, read in the frame that draws them (the canvas keeps no picture after its frame).
            const shot = (map, w, h) => new Promise(r => { map.once('render', () => { const k = Object.assign(document.createElement('canvas'), {width: w, height: h}).getContext('2d'); k.drawImage(map.getCanvas(), 0, 0, w, h); r(k.getImageData(0, 0, w, h).data); }); map.triggerRepaint(); });
            const c = Object.assign(document.createElement('canvas'), {width: 256, height: 256}), g = c.getContext('2d');
            g.fillStyle = 'rgb(140,184,0)'; g.fillRect(0, 0, 256, 256); // 3000 m in the terrarium encoding
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:600px;height:500px;z-index:60'}));
            const style = {version: 8, projection: {type: 'globe'}, sources: {dem: {type: 'raster-dem', tiles: [c.toDataURL('image/png')], encoding: 'terrarium', tileSize: 256, maxzoom: 10},
                p: {type: 'geojson', data: {type: 'Point', coordinates: [0.005, 0.003]}}}, terrain: {source: 'dem'},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'c', type: 'circle', source: 'p', paint: {'circle-color': '#f00', 'circle-radius': 15}}]};
            const map = new mod.Map({container: el, style, center: [0, 0], zoom: 11.6, pitch: 60, bearing: 90, renderer, attributionControl: false});
            try {
                await new Promise(r => map.once('idle', r));
                // (The check waits for the circle itself, for up to 10 s: on a slow machine the frame with it can come later.)
                let n = 0, sx = 0, sy = 0;
                for (let t = 0; t < 50 && n < 100; t++) {
                    await new Promise(r => setTimeout(r, 200));
                    const d = await shot(map, 600, 500); n = 0; sx = 0; sy = 0;
                    for (let y = 0; y < 500; y++) for (let x = 0; x < 600; x++) { const i = (y * 600 + x) * 4; if (d[i] > 200 && d[i + 1] < 80) { n++; sx += x; sy += y; } }
                }
                const p = map.project([0.005, 0.003]);
                return {n, x: Math.round(sx / n), y: Math.round(sy / n), px: Math.round(p.x), py: Math.round(p.y), found: (await map.queryRenderedFeatures(p, {layers: ['c']})).length};
            } finally { map.remove(); el.remove(); }
        }, mode);
        check(`[${mode}] the globe with 3D terrain: project() gives the place where a circle is drawn, and queryRenderedFeatures finds it there (#1430)`,
            r.n > 100 && Math.hypot(r.x - r.px, r.y - r.py) < 6 && r.found === 1, JSON.stringify(r));
    }
    // cooperativeGestures, as in MapLibre GL JS 6.17: a plain wheel and one finger leave the map to the page and show the hint;
    // Ctrl + wheel (⌘ on a Mac) zooms; disable() gives the gestures back.
    if (mode === 'main') {
        const coop = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(a.join(' '));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', attributionControl: false, cooperativeGestures: true, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [0, 0], zoom: 3});
            console.warn = warn;
            await new Promise(r => m.once('load', r));
            await wait(100);
            const c = m.getCanvas(), prevented = [];
            m.on('cooperativegestureprevented', e => prevented.push(e.gestureType));
            const wheel = (ctrlKey, metaKey) => { const e = new WheelEvent('wheel', {deltaY: -100, clientX: 150, clientY: 100, ctrlKey, metaKey, bubbles: true, cancelable: true}); c.dispatchEvent(e); return e.defaultPrevented; };
            const touch = (type, x) => c.dispatchEvent(new PointerEvent(type, {pointerId: 21, pointerType: 'touch', isPrimary: true, clientX: x, clientY: 100, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true}));
            const out = {warnings, enabled: m.cooperativeGestures.isEnabled(), touchAction: c.style.touchAction};
            const z0 = m.getZoom();
            out.plainPrevented = wheel(false, false);
            // (The hint shows at once and fades from 100 ms on, as in MapLibre GL JS.)
            out.hint = el.querySelector('.maplibregl-cooperative-gesture-screen')?.textContent;
            out.hintOpacity = el.querySelector('.maplibregl-cooperative-gesture-screen')?.style.opacity;
            await wait(300);
            out.plainZoom = m.getZoom() - z0;
            const x0 = m.getCenter().lng;
            touch('pointerdown', 150); for (const x of [170, 190, 210, 230]) touch('pointermove', x); touch('pointerup', 230);
            await wait(300);
            out.touchMoved = m.getCenter().lng - x0;
            out.prevented = prevented.join();
            const mac = navigator.userAgent.includes('Mac');
            wheel(!mac, mac);
            await wait(400);
            out.bypassZoom = m.getZoom() - z0;
            m.cooperativeGestures.disable();
            const z1 = m.getZoom();
            wheel(false, false);
            await wait(400);
            out.afterZoom = m.getZoom() - z1;
            out.afterHint = !!el.querySelector('.maplibregl-cooperative-gesture-screen');
            out.afterTouchAction = c.style.touchAction;
            out.afterEnabled = m.cooperativeGestures.isEnabled();
            m.remove(); el.remove();
            return out;
        });
        check('[main] maplibre-compat: cooperativeGestures: a plain wheel and one finger leave the map to the page, fire cooperativegestureprevented and show the hint; Ctrl + wheel zooms; disable() gives the gestures back',
            coop.warnings.length === 0 && coop.enabled && coop.touchAction === 'pan-x pan-y' && !coop.plainPrevented && coop.plainZoom === 0 && /scroll to zoom the map/.test(coop.hint) && coop.hintOpacity === '1' && coop.touchMoved === 0 && coop.prevented.startsWith('wheel_zoom,touch_pan') && coop.bypassZoom > 0.1 && coop.afterZoom > 0.1 && !coop.afterHint && coop.afterTouchAction === 'none' && !coop.afterEnabled, JSON.stringify(coop));
    }
    // #1286: with cooperativeGestures, a move of two fingers cancels the default of `touchmove`, as in MapLibre GL JS,
    // so that the browser does not take the gesture (iOS Safari ends it with pointercancel); one finger does not, so the
    // page scrolls. A two-finger drag keeps moving the map while a finger is over a control or out of the container.
    if (mode === 'main' && browserName === 'chromium') {
        for (const entry of ['host', 'compat']) {
            await page.evaluate(async entry => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:100px;top:100px;width:600px;height:400px;z-index:1000'}));
                const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]};
                if (entry === 'host') {
                    const {createMap} = await import('/dist/map-jr-gl.js'), {navigation} = await import('/dist/controls.js');
                    const m = createMap(el, {renderer: 'main', style, initialView: {center: [0, 0], zoom: 3}, cooperativeGestures: true, controls: [navigation()]});
                    await new Promise(r => { const stop = m.state.subscribe(s => { if (s.loaded) { queueMicrotask(() => stop()); r(); } }); });
                    window.coopDrag = {el, lng: () => m.state.get().view.center[0], remove: () => { m.destroy(); el.remove(); }};
                } else {
                    const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
                    const m = new mod.Map({container: el, renderer: 'main', attributionControl: false, style, center: [0, 0], zoom: 3, cooperativeGestures: true});
                    m.addControl(new mod.NavigationControl(), 'top-right');
                    await new Promise(r => m.once('load', r));
                    window.coopDrag = {el, lng: () => m.getCenter().lng, remove: () => { m.remove(); el.remove(); }};
                }
                await new Promise(r => setTimeout(r, 300));
                window.coopDrag.moves = [];
                window.coopDrag.record = e => window.coopDrag.moves.push(e.touches.length + ':' + e.defaultPrevented);
                document.addEventListener('touchmove', window.coopDrag.record);
            }, entry);
            const cdp = await page.context().newCDPSession(page);
            const touch = (type, touchPoints = []) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints});
            const ctrl = await page.evaluate(() => { const r = window.coopDrag.el.querySelector('.map-jr-ctrl').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + 10}; });
            const out = {};
            // One finger: the default stays (the page scrolls).
            await touch('touchStart', [{id: 0, x: 400, y: 300}]);
            for (let i = 1; i <= 5; i++) await touch('touchMove', [{id: 0, x: 400, y: 300 - i * 4}]);
            await touch('touchEnd');
            out.one = await page.evaluate(() => window.coopDrag.moves.splice(0).join());
            for (const [name, target] of [['control', ctrl], ['outside', {x: 850, y: 120}]]) {
                const at = i => { const x = 500 + (target.x - 500) * i / 20, y = 200 + (target.y - 200) * i / 20; return [{id: 0, x, y}, {id: 1, x: x - 100, y: y + 50}]; };
                await touch('touchStart', at(0));
                for (let i = 1; i <= 20; i++) { await touch('touchMove', at(i)); await page.waitForTimeout(16); }
                const before = await page.evaluate(() => window.coopDrag.lng());
                for (let i = 1; i <= 10; i++) { await touch('touchMove', at(20).map(p => ({...p, x: p.x - i * 15}))); await page.waitForTimeout(16); }
                await page.waitForTimeout(100);
                out[name] = await page.evaluate(() => window.coopDrag.lng()) - before;
                await touch('touchEnd');
                await page.waitForTimeout(300);
            }
            out.two = [...new Set(await page.evaluate(() => window.coopDrag.moves.splice(0)))].join();
            await cdp.detach();
            await page.evaluate(() => { document.removeEventListener('touchmove', window.coopDrag.record); window.coopDrag.remove(); window.coopDrag = undefined; });
            check(`[main] ${entry === 'host' ? 'createMap' : 'maplibre-compat'}: cooperativeGestures: a two-finger touchmove is defaultPrevented and a one-finger one is not; a two-finger drag keeps moving the map over a control and out of the container (#1286)`,
                /^(1:false,?)+$/.test(out.one) && out.two === '2:true' && out.control > 1 && out.outside > 1, JSON.stringify(out));
        }
    }
    if (mode === 'main' && browserName !== 'chromium') skip('[main] cooperativeGestures: a two-finger drag over a control and out of the container (#1286)', noCDP);
    // Class names of MapLibre GL JS: stylesheets and end-to-end tests written for that library select by them.
    if (mode === 'main') {
        const names = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px;z-index:1000'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            for (const control of [new mod.NavigationControl(), new mod.FullscreenControl(), new mod.GeolocateControl(), new mod.TerrainControl({source: 'none'}), new mod.ScaleControl()]) m.addControl(control);
            new mod.Marker().setLngLat([0, 0]).setPopup(new mod.Popup().setText('A popup')).addTo(m).togglePopup();
            await new Promise(r => m.once('load', r));
            const expected = ['div.maplibregl-map', 'canvas.maplibregl-canvas', '.maplibregl-ctrl-top-right', '.maplibregl-ctrl-bottom-right',
                '.maplibregl-ctrl.maplibregl-ctrl-group', 'button.maplibregl-ctrl-zoom-in', 'button.maplibregl-ctrl-zoom-out', 'button.maplibregl-ctrl-compass', 'button.maplibregl-ctrl-fullscreen',
                'button.maplibregl-ctrl-geolocate', 'button.maplibregl-ctrl-terrain', '.maplibregl-ctrl.maplibregl-ctrl-scale', '.maplibregl-ctrl.maplibregl-ctrl-attrib', '.maplibregl-ctrl-attrib-inner',
                'button.maplibregl-ctrl-attrib-button', '.maplibregl-marker', '.maplibregl-popup', '.maplibregl-popup-content', '.maplibregl-popup-tip', 'button.maplibregl-popup-close-button'];
            const missing = expected.filter(selector => !el.matches(selector) && !el.querySelector(selector));
            const canvasInMap = m.getCanvas().matches('.maplibregl-map > .maplibregl-canvas');
            m.remove();
            const left = el.classList.contains('maplibregl-map');
            el.remove();
            return {missing, canvasInMap, left};
        });
        check('[main] maplibre-compat: the container, the canvas, the controls, their buttons, markers and popups have their maplibregl-* class names, and remove() takes the name from the container',
            names.missing.length === 0 && names.canvasInMap && !names.left, JSON.stringify(names));
    }
    // Each button has a span maplibregl-ctrl-icon, and a page that sets a background-image on it sees that image in place of the library's icon (#758).
    if (mode === 'main') {
        const icons = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const css = document.head.appendChild(Object.assign(document.createElement('style'), {textContent: '.icon758 .maplibregl-ctrl button.maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon,.icon758 .maplibregl-ctrl-compass .maplibregl-ctrl-icon{background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E")}'}));
            const run = async (styled) => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px', className: styled ? 'icon758' : ''}));
                const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
                m.addControl(new mod.NavigationControl());
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                m.setBearing(30);
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                const out = ['zoom-in', 'zoom-out', 'compass'].map(n => {
                    const span = el.querySelector(`.maplibregl-ctrl-${n} > .maplibregl-ctrl-icon`);
                    return span && {image: getComputedStyle(span).backgroundImage !== 'none', svg: getComputedStyle(span.querySelector('svg')).color, w: span.offsetWidth, turn: span.style.transform};
                });
                m.remove(); el.remove();
                return out;
            };
            const r = {plain: await run(false), styled: await run(true)};
            css.remove();
            return r;
        });
        const hidden = c => c === 'rgba(0, 0, 0, 0)';
        check('[main] maplibre-compat: the navigation buttons have a span maplibregl-ctrl-icon; a page background-image on it replaces the icon of the library, the compass span turns with the bearing, and without such CSS the icons show',
            icons.plain.every(i => i && !i.image && !hidden(i.svg) && i.w > 0) && icons.styled[0]?.image && hidden(icons.styled[0].svg) && !hidden(icons.styled[1]?.svg) && icons.styled[2]?.image && hidden(icons.styled[2].svg) && /rotate\(-30deg\)/.test(icons.styled[2].turn) && !icons.plain[2].turn, JSON.stringify(icons));
    }
    // A control added without a position goes to the corner that MapLibre GL JS uses for it (#257).
    if (mode === 'main') {
        const corners = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const controls = {NavigationControl: new mod.NavigationControl(), GeolocateControl: new mod.GeolocateControl(), FullscreenControl: new mod.FullscreenControl(), TerrainControl: new mod.TerrainControl({source: 'none'}),
                GlobeControl: new mod.GlobeControl(), ScaleControl: new mod.ScaleControl(), AttributionControl: new mod.AttributionControl(), LogoControl: new mod.LogoControl()};
            const found = {};
            for (const [name, c] of Object.entries(controls)) {
                const before = new Set(el.querySelectorAll('*'));
                m.addControl(c);
                const added = [...el.querySelectorAll('*')].find(n => !before.has(n));
                const corner = added?.parentElement?.className.match(/ctrl-((top|bottom)-(left|right))/);
                found[name] = corner ? corner[1] : 'none';
            }
            m.remove(); el.remove();
            return found;
        });
        const want = {NavigationControl: 'top-right', GeolocateControl: 'top-right', FullscreenControl: 'top-right', TerrainControl: 'top-right', GlobeControl: 'top-right', ScaleControl: 'bottom-left', AttributionControl: 'bottom-right', LogoControl: 'bottom-left'};
        check('[main] maplibre-compat: each control class added without a position goes to the corner that MapLibre GL JS uses', JSON.stringify(corners) === JSON.stringify(want), JSON.stringify(corners));
    }
    // addLayer with a layer type that the library does not draw warns once for each type, as a loaded style does (#1140).
    // (The first layer is refused for its id, and the type still warns for the next one.)
    if (mode === 'main') {
        const unknown = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            await new Promise(r => m.once('load', r));
            const warnings = [], warn = console.warn;
            let afterRefused;
            m.on('error', () => {}); // (the refusal of the duplicate id is an error event; handled, it is no page error)
            console.warn = (...a) => { warnings.push(String(a[0])); warn(...a); };
            try {
                m.addLayer({id: 'bg', type: 'no-such-type'}); afterRefused = warnings.length; m.addLayer({id: 'a', type: 'no-such-type'}); m.addLayer({id: 'b', type: 'no-such-type'}); m.addLayer({id: 'c', type: 'background'});
            } finally { console.warn = warn; }
            m.remove(); el.remove();
            return {afterRefused, warnings: warnings.filter(w => w.includes('layer type'))};
        });
        check('[main] maplibre-compat: addLayer with an unknown layer type warns once for the type, as a loaded style does',
            unknown.afterRefused === 0 && unknown.warnings.length === 1 && unknown.warnings[0] === '[map-jr-gl] Skipping unsupported layer types: no-such-type', JSON.stringify(unknown));
    }
    // `new LogoControl({compact})` is accepted as in MapLibre GL JS, and `compact` warns once, because it has no effect (#671).
    if (mode === 'main') {
        const logo = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const warnings = [], warn = console.warn;
            console.warn = (...a) => { warnings.push(String(a[0])); warn(...a); };
            try {
                const a = new mod.LogoControl({compact: true});
                new mod.LogoControl({compact: false}); new mod.LogoControl();
                return {compact: a.options.compact, warnings: warnings.filter(w => w.includes('LogoControl'))};
            } finally { console.warn = warn; }
        });
        check('[main] maplibre-compat: new LogoControl({compact}) keeps the options and warns once that compact has no effect',
            logo.compact === true && logo.warnings.length === 1 && logo.warnings[0].startsWith('[map-jr-gl] LogoControl: the option compact has no effect.'), JSON.stringify(logo));
    }
    // The label of TerrainControl says what a click does, with the texts of MapLibre GL JS (#1234).
    if (mode === 'main') {
        const labels = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['data:,'], tileSize: 256}}, layers: [{id: 'bg', type: 'background'}]}});
            await new Promise(r => m.once('load', r));
            m.addControl(new mod.TerrainControl({source: 'dem'}));
            const b = el.querySelector('.maplibregl-ctrl-terrain');
            const off = b.title;
            b.click();
            const on = b.title, aria = b.getAttribute('aria-label');
            m.remove(); el.remove();
            return {off, on, aria};
        });
        check('[main] maplibre-compat: TerrainControl is labeled "Enable terrain" and, with terrain on, "Disable terrain"',
            labels.off === 'Enable terrain' && labels.on === 'Disable terrain' && labels.aria === 'Disable terrain', JSON.stringify(labels));
    }
    // The projection in the API of MapLibre GL JS (#463): getProjection() gives what the style has, setProjection()
    // changes it and fires projectiontransition when the name changes, and GlobeControl switches it. A globe writes no
    // warning (#463).
    if (mode === 'main') {
        const projection = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const warnings = [], warn = console.warn;
            console.warn = (...a) => { warnings.push(String(a[0])); warn(...a); };
            try {
                const out = {};
                const plain = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
                const first = [];
                plain.on('projectiontransition', e => first.push(e.newProjection));
                await new Promise(r => plain.once('load', r));
                out.none = plain.getProjection() ?? 'undefined';
                out.first = first.slice();
                const events = [];
                plain.on('projectiontransition', e => events.push(e.newProjection));
                const spec = {type: 'globe'};
                plain.setProjection(spec);
                out.same = plain.getProjection() === spec;
                plain.setProjection({type: 'globe'});
                plain.setProjection({type: 'vertical-perspective'});
                plain.setProjection(null);
                out.after = plain.getProjection() ?? 'undefined';
                out.events = events.slice();
                const c = new mod.GlobeControl();
                plain.addControl(c);
                const b = el.querySelector('button.maplibregl-ctrl-globe');
                out.button = [!!b, b?.title, b?.getAttribute('aria-pressed')];
                b?.click();
                out.clicked = [plain.getProjection()?.type, b?.classList.contains('maplibregl-ctrl-globe-enabled'), b?.classList.contains('map-jr-ctrl-globe-enabled'), b?.classList.contains('maplibregl-ctrl-globe'), b?.title, b?.getAttribute('aria-pressed')];
                b?.click();
                out.back = [plain.getProjection()?.type, b?.classList.contains('maplibregl-ctrl-globe')];
                plain.remove();
                const styled = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, projection: {type: 'globe'}, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
                await new Promise(r => styled.once('load', r));
                out.style = styled.getProjection();
                styled.remove();
                out.warnings = warnings.filter(w => w.includes('projection')).length;
                return out;
            } finally { console.warn = warn; el.remove(); }
        }).catch(e => ({error: String(e)}));
        const want = {none: 'undefined', first: ['mercator'], same: true, after: 'undefined', events: ['globe', 'vertical-perspective', 'mercator'],
            button: [true, 'Enable globe', 'false'], clicked: ['globe', true, true, false, 'Disable globe', 'true'], back: ['mercator', true], style: {type: 'globe'}, warnings: 0};
        check('[main] maplibre-compat: getProjection, setProjection, projectiontransition and GlobeControl follow MapLibre GL JS, and a globe writes no warning', JSON.stringify(projection) === JSON.stringify(want), JSON.stringify(projection));
    }
    // getFontFaces() returns null for a style without font-faces, as MapLibre GL JS does (#1244).
    if (mode === 'main') {
        const faces = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            try {
                await new Promise(r => m.once('load', r));
                const none = m.getFontFaces();
                m.setFontFaces({Demo: 'https://example.com/demo.woff2'});
                const set = m.getFontFaces();
                m.setFontFaces(null);
                return [none, set, m.getFontFaces()];
            } finally { m.remove(); el.remove(); }
        }).catch(e => ({error: String(e)}));
        check('[main] maplibre-compat: getFontFaces() returns null without font-faces, as MapLibre GL JS does', JSON.stringify(faces) === JSON.stringify([null, {Demo: 'https://example.com/demo.woff2'}, null]), JSON.stringify(faces));
    }
    // getLight() returns only the fields of the light that the style sets, as MapLibre GL JS does (#1243).
    if (mode === 'main') {
        const lights = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            try {
                await new Promise(r => m.once('load', r));
                const none = m.getLight();
                m.setLight({anchor: 'map', intensity: 0.3});
                return [none, m.getLight()];
            } finally { m.remove(); el.remove(); }
        }).catch(e => ({error: String(e)}));
        check('[main] maplibre-compat: getLight() returns only the fields that the style sets, as MapLibre GL JS does', JSON.stringify(lights) === JSON.stringify([{}, {anchor: 'map', intensity: 0.3}]), JSON.stringify(lights));
    }
    // ScaleControl.setUnit() changes the unit, and 'nautical' shows nautical miles, as in MapLibre GL JS (#204).
    if (mode === 'main') {
        const texts = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const c = new mod.ScaleControl({unit: 'nautical'});
            m.addControl(c);
            const bar = el.querySelector('.map-jr-ctrl-scale'), out = [bar.textContent];
            for (const unit of ['imperial', 'metric', 'nautical']) { c.setUnit(unit); out.push(bar.textContent); }
            m.remove(); el.remove();
            return out;
        }).catch(e => [String(e)]);
        check('[main] maplibre-compat: ScaleControl takes the unit nautical and setUnit() changes the unit', JSON.stringify(texts) === JSON.stringify(['1000 nm', '1000 mi', '1000 km', '1000 nm']), JSON.stringify(texts));
    }
    // react-map-gl 8 gives every map a function with setTransformCameraUpdate (#210). The map warns only when the
    // function changes the camera, which is the one case that this library does not draw as MapLibre GL JS does.
    if (mode === 'main') {
        const hook = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const warnings = [], warn = console.warn, out = {};
            console.warn = (...a) => warnings.push(String(a[0]));
            try {
                await new Promise(r => m.once('load', r));
                const moved = () => new Promise(r => m.once('moveend', () => setTimeout(r, 50)));
                // A controlled map whose state is one move behind: the function returns the camera before.
                let last = null, calls = 0;
                m.setTransformCameraUpdate(tr => { calls++; const r = last ?? {}; last = {center: tr.center, zoom: tr.zoom}; return r; });
                let done = moved(); m.jumpTo({center: [10, 5], zoom: 3}); await done;
                done = moved(); m.jumpTo({center: [20, 5], zoom: 4}); await done;
                out.lagging = {calls, warnings: warnings.length};
                // A function that changes the zoom.
                m.setTransformCameraUpdate(() => ({zoom: 1}));
                done = moved(); m.jumpTo({zoom: 5}); await done;
                done = moved(); m.jumpTo({zoom: 6}); await done;
                out.changing = warnings.filter(w => w.startsWith('[map-jr-gl] setTransformCameraUpdate')).length;
            } finally { console.warn = warn; m.remove(); el.remove(); }
            return out;
        }).catch(e => ({error: String(e)}));
        check('[main] maplibre-compat: setTransformCameraUpdate warns once when its function changes the camera, and not when it returns an earlier camera', hook.lagging?.calls > 0 && hook.lagging.warnings === 0 && hook.changing === 1, JSON.stringify(hook));
    }
    // GeolocateControl is an event emitter, as react-map-gl 8 expects (#194), with a mocked navigator.geolocation.
    if (mode === 'main') {
        const geo = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const real = Object.getOwnPropertyDescriptor(Navigator.prototype, 'geolocation');
            let answer;
            Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {getCurrentPosition: (ok, fail) => setTimeout(() => answer(ok, fail), 0)}});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(String(a[0]));
            const gc = new mod.GeolocateControl({showAccuracyCircle: true});
            console.warn = warn;
            const notAdded = gc.trigger();
            m.addControl(gc);
            await new Promise(r => m.once('load', r));
            const events = [];
            for (const t of ['geolocate', 'error', 'outofmaxbounds', 'trackuserlocationstart', 'trackuserlocationend']) gc.on(t, e => events.push(t + ':' + (e.target === gc)));
            const onMap = [];
            m.on('geolocate', () => onMap.push('geolocate'));
            m.on('error', () => onMap.push('error'));
            const step = f => new Promise(r => { answer = (ok, fail) => { f(ok, fail); setTimeout(r, 0); }; });
            let s = step(ok => ok({coords: {longitude: 10, latitude: 20}, timestamp: 1}));
            const triggered = gc.trigger();
            await s;
            s = step((ok, fail) => fail({code: 1, message: 'denied'}));
            gc.trigger(); await s;
            m.setMaxBounds([[-5, -5], [5, 5]]);
            s = step(ok => ok({coords: {longitude: 50, latitude: 50}, timestamp: 2}));
            gc.trigger(); await s;
            const off = () => events.push('off');
            gc.once('geolocate', off);
            m.setMaxBounds(null);
            s = step(ok => ok({coords: {longitude: 1, latitude: 1}, timestamp: 3}));
            gc.trigger(); await s;
            s = step(ok => ok({coords: {longitude: 1, latitude: 1}, timestamp: 4}));
            gc.trigger(); await s;
            m.remove(); el.remove();
            if (real) delete navigator.geolocation;
            return {notAdded, triggered, events, onMap, warnings};
        });
        check('[main] maplibre-compat: GeolocateControl has on/once/trigger() and fires geolocate, error and outofmaxbounds on itself, and warns once for showAccuracyCircle',
            geo.notAdded === false && geo.triggered === true && geo.events.join() === 'geolocate:true,error:true,outofmaxbounds:true,geolocate:true,off,geolocate:true' && geo.onMap.join() === 'geolocate,error,geolocate,geolocate'
            && geo.warnings.length === 1 && geo.warnings[0].startsWith('[map-jr-gl] GeolocateControl: the option showAccuracyCircle'), JSON.stringify(geo));
        // fitBoundsOptions.maxZoom sets the zoom at the position when `zoom` is not given; other members warn once (#677).
        const fit = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const real = Object.getOwnPropertyDescriptor(Navigator.prototype, 'geolocation');
            Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {getCurrentPosition: ok => setTimeout(() => ok({coords: {longitude: 3, latitude: 4}, timestamp: 1}), 0)}});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(String(a[0]));
            const gc = new mod.GeolocateControl({fitBoundsOptions: {maxZoom: 9, linear: true}});
            console.warn = warn;
            m.addControl(gc);
            await new Promise(r => m.once('load', r));
            gc.trigger();
            await new Promise(r => m.once('moveend', r));
            const zoom = m.getZoom();
            m.remove(); el.remove();
            if (real) delete navigator.geolocation;
            return {zoom, warnings: warnings.filter(w => w.includes('GeolocateControl'))};
        });
        check('[main] maplibre-compat: GeolocateControl zooms to fitBoundsOptions.maxZoom, and another member of fitBoundsOptions warns once',
            Math.abs(fit.zoom - 9) < 1e-6 && fit.warnings.length === 1 && fit.warnings[0].startsWith('[map-jr-gl] GeolocateControl: the option fitBoundsOptions.linear'), JSON.stringify(fit));
        // trackUserLocation (#42): the states and events of MapLibre GL JS 6.17, the dot, and clearWatch, with a mocked watchPosition.
        const track = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const real = Object.getOwnPropertyDescriptor(Navigator.prototype, 'geolocation');
            let ok, fail, cleared = 0;
            Object.defineProperty(navigator, 'geolocation', {configurable: true, value: {getCurrentPosition() {}, watchPosition: (a, b) => { ok = a; fail = b; return 7; }, clearWatch: id => { cleared = id; }}});
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const gc = new mod.GeolocateControl({trackUserLocation: true});
            m.addControl(gc);
            await new Promise(r => m.once('load', r));
            const events = [], b = el.querySelector('button.maplibregl-ctrl-geolocate');
            for (const t of ['geolocate', 'error', 'trackuserlocationstart', 'trackuserlocationend', 'userlocationfocus', 'userlocationlostfocus']) gc.on(t, () => events.push(t));
            const cls = () => [...b.classList].filter(c => c.startsWith('maplibregl-ctrl-geolocate-')).join(' ') || 'off';
            const idle = () => new Promise(r => { const t = () => m.isMoving() ? setTimeout(t, 50) : r(); setTimeout(t, 50); });
            const states = [];
            // The code of tracking loads at the first click (geolocate-track.ts), so each click acts after a task.
            const press = async () => { b.click(); for (let i = 0; i < 100 && !ok; i++) await new Promise(r => setTimeout(r, 20)); await new Promise(r => setTimeout(r, 0)); };
            await press(); states.push(cls());
            ok({coords: {longitude: 10, latitude: 20, accuracy: 5}, timestamp: 1}); states.push(cls());
            await idle();
            const centred = Math.round(m.getCenter().lng) === 10;
            const dot = !!el.querySelector('.maplibregl-user-location-dot');
            m.jumpTo({center: [0, 0]}); await idle(); states.push(cls());
            ok({coords: {longitude: 11, latitude: 20, accuracy: 5}, timestamp: 2}); await idle();
            const stayed = Math.round(m.getCenter().lng) === 0;
            await press(); states.push(cls());
            for (let i = 0; i < 60 && Math.round(m.getCenter().lng) !== 11; i++) await new Promise(r => setTimeout(r, 50));
            const back = Math.round(m.getCenter().lng) === 11;
            await press(); states.push(cls());
            const dotGone = !el.querySelector('.maplibregl-user-location-dot');
            m.remove(); el.remove();
            if (real) delete navigator.geolocation;
            return {states, events, centred, dot, stayed, back, dotGone, cleared};
        });
        check('[main] maplibre-compat: GeolocateControl with trackUserLocation follows the position, goes to the background when the map moves, and turns off with the events of MapLibre GL JS',
            track.states.join() === 'maplibregl-ctrl-geolocate-waiting,maplibregl-ctrl-geolocate-active,maplibregl-ctrl-geolocate-background,maplibregl-ctrl-geolocate-active,off'
            && track.events.join() === 'trackuserlocationstart,geolocate,trackuserlocationend,userlocationlostfocus,geolocate,trackuserlocationstart,userlocationfocus,trackuserlocationend'
            && track.centred && track.dot && track.stayed && track.back && track.dotGone && track.cleared === 7, JSON.stringify(track));
    }
    // #254: members and exports that Vue wrappers and apps read on the compat entry.
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.MapLibreMap({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const marker = new mod.Marker().setLngLat([3, 4]), before = marker._map;
            marker.addTo(m);
            const fc = new mod.FullscreenControl(), nav = new mod.NavigationControl(), events = [];
            m.addControl(fc); m.addControl(nav); m.removeControl(nav);
            fc.on('fullscreenstart', e => events.push('start:' + (e.target === fc))).on('fullscreenend', () => events.push('end'));
            const set = v => { Object.defineProperty(document, 'fullscreenElement', {configurable: true, get: () => v}); document.dispatchEvent(new Event('fullscreenchange')); };
            set(el); set(null); delete document.fullscreenElement;
            const p = mod.Point.convert([3, 4]);
            const out = {sameMap: mod.MapLibreMap === mod.Map && mod.default.MapLibreMap === mod.Map && mod.default.Point === mod.Point, before: before === undefined, map: marker._map === m, lngLat: marker._lngLat.toArray().join(),
                controls: m._controls.map(c => c.constructor.name).join(), controlFc: m._controls.includes(fc) && !m._controls.includes(nav), version: m.version === mod.getVersion(), events: events.join(),
                point: [p.mag(), p.add({x: 1, y: 1}).x, p.sub(new mod.Point(1, 1)).y, p.mult(2).x, p.div(2).y, p.dist({x: 0, y: 0}), p.equals(p.clone()), p.round().x].join()};
            m.remove(); el.remove();
            return out;
        });
        check('[main] maplibre-compat: Marker._map/_lngLat, Map._controls/version, FullscreenControl events, Point and MapLibreMap exist (#254)',
            r.sameMap && r.before && r.map && r.lngLat === '3,4' && r.controlFc && r.version && r.events === 'start:true,end'
            && r.point === '5,4,3,6,2,5,true,3', JSON.stringify(r));
    }
    if (mode === 'main') {
        // #42: the option `locale` of the compat entry names the controls and the hint of cooperativeGestures with the
        // keys of MapLibre GL JS; a key that is missing keeps MapLibre's English text. Without the Fullscreen API
        // (Safari on iPhone), FullscreenControl falls back to the class `maplibregl-pseudo-fullscreen`.
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(res => setTimeout(res, ms));
            const warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(a.join(' '));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:300px;height:200px'}));
            // (An own property hides the Fullscreen API of the prototype, as on an iPhone.)
            el.requestFullscreen = undefined;
            const locale = {'NavigationControl.ZoomIn': 'Zoom avant', 'FullscreenControl.Enter': 'Plein écran', 'FullscreenControl.Exit': 'Quitter le plein écran',
                'ScaleControl.Kilometers': 'kilomètres', 'AttributionControl.ToggleAttribution': 'Attributions', 'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl + molette', 'CooperativeGesturesHandler.MacHelpText': '⌘ + molette', 'CooperativeGesturesHandler.MobileHelpText': 'Deux doigts',
                'Popup.Close': 'Fermer', 'Marker.Title': 'Repère', 'Map.Title': 'Carte'};
            const m = new mod.Map({container: el, renderer: 'main', locale, cooperativeGestures: true, center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const nav = new mod.NavigationControl(), scale = new mod.ScaleControl(), fc = new mod.FullscreenControl(), events = [];
            m.addControl(nav); m.addControl(scale); m.addControl(fc);
            fc.on('fullscreenstart', () => events.push('start')).on('fullscreenend', () => events.push('end'));
            await new Promise(res => m.once('load', res));
            await wait(100);
            const q = s => el.querySelector(s), fb = q('.maplibregl-ctrl-fullscreen');
            const out = {zoomIn: q('.maplibregl-ctrl-zoom-in').title, zoomOut: q('.maplibregl-ctrl-zoom-out').title, compass: q('.maplibregl-ctrl-compass').title,
                scale: q('.maplibregl-ctrl-scale').textContent, attrib: q('.maplibregl-ctrl-attrib-button')?.getAttribute('aria-label'), enter: fb.title, uiString: m._getUIString('Popup.Missing')};
            // The close button of Popup and the name of Marker take the locale when they are added to the map.
            const marker = new mod.Marker().setLngLat([0, 0]).addTo(m), popup = new mod.Popup().setLngLat([0, 0]).setText('x').addTo(m);
            out.marker = marker.getElement().getAttribute('aria-label'); out.close = popup.getElement().querySelector('.maplibregl-popup-close-button')?.getAttribute('aria-label');
            popup.remove(); marker.remove();
            m.getCanvas().dispatchEvent(new WheelEvent('wheel', {deltaY: -100, clientX: 150, clientY: 100, bubbles: true, cancelable: true}));
            out.hint = q('.maplibregl-cooperative-gesture-screen')?.textContent;
            fb.click();
            out.pseudo = el.classList.contains('maplibregl-pseudo-fullscreen') && el.classList.contains('map-jr-pseudo-fullscreen');
            out.position = getComputedStyle(el).position;
            out.exit = fb.title; out.pressed = fb.getAttribute('aria-pressed');
            // As in MapLibre GL JS, cooperativeGestures is off while the map fills the screen, and on again after.
            out.gesturesFull = m.cooperativeGestures.isEnabled();
            fb.click();
            out.gesturesAfter = m.cooperativeGestures.isEnabled();
            out.after = el.className.includes('pseudo-fullscreen'); out.enterAgain = fb.title; out.events = events.join();
            out.warnings = warnings.filter(w => /locale/.test(w));
            console.warn = warn;
            out.canvasLabel = m.getCanvas().getAttribute('aria-label');
            m.remove(); el.remove();
            // A map of the main API keeps its own English names.
            const core = await import('/dist/map-jr-gl.js');
            const el2 = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:0;top:0;width:300px;height:200px'}));
            const {navigation} = await import('/dist/controls.js');
            const m2 = core.createMap(el2, {style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, controls: [navigation()]});
            for (let i = 0; i < 50 && !el2.querySelector('.maplibregl-ctrl-compass'); i++) await wait(100);
            out.coreCompass = el2.querySelector('.maplibregl-ctrl-compass')?.title;
            out.coreCanvasLabel = m2.getCanvas?.().getAttribute('aria-label') ?? el2.querySelector('canvas')?.getAttribute('aria-label');
            m2.destroy(); el2.remove();
            return out;
        });
        check('[main] maplibre-compat: locale names the controls and the hint of cooperativeGestures; Popup and Marker take it; FullscreenControl falls back to pseudo fullscreen without the Fullscreen API and turns off cooperativeGestures there (#42)',
            r.zoomIn === 'Zoom avant' && r.zoomOut === 'Zoom out' && r.compass === 'Reset bearing to north' && /kilomètres$/.test(r.scale) && r.attrib === 'Attributions'
            && r.enter === 'Plein écran' && r.uiString === undefined && r.marker === 'Repère' && r.close === 'Fermer' && r.gesturesFull === false && r.gesturesAfter === true && ['Ctrl + molette', '⌘ + molette', 'Deux doigts'].includes(r.hint)
            && r.pseudo && r.position === 'fixed' && r.exit === 'Quitter le plein écran' && r.pressed === 'true' && !r.after && r.enterAgain === 'Plein écran' && r.events === 'start,end'
            && r.canvasLabel === 'Carte' && r.coreCanvasLabel === 'Map'
            && r.warnings.length === 0 && r.coreCompass === 'Reset bearing to north', JSON.stringify(r));
    }
    if (mode === 'main') {
        // #246: an animated move and fitBounds end where jumpTo would, inside maxBounds and the edge of the world.
        const cam = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [5, 45], zoom: 4, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            await new Promise(r => m.once('load', r));
            const end = f => new Promise(r => { m.once('moveend', () => r([m.getCenter().lng, m.getCenter().lat, m.getZoom()])); f(); });
            m.setMaxBounds([[0, 40], [10, 50]]);
            const eased = await end(() => m.easeTo({center: [50, 60], duration: 100}));
            m.jumpTo({center: [5, 45]});
            m.jumpTo({center: [50, 60]});
            const jumped = [m.getCenter().lng, m.getCenter().lat];
            // #280: the edges of the view stay inside the bounds, as MapLibre's Mercator transform keeps them. The bearing and
            // the pitch do not change the result, and the padding makes the view smaller.
            m.jumpTo({zoom: 6, bearing: 30, pitch: 40});
            m.jumpTo({center: [50, 60]});
            const turned = [m.getCenter().lng, m.getCenter().lat, m.getZoom()];
            m.jumpTo({bearing: 0, pitch: 0});
            const easedEdge = await end(() => m.easeTo({center: [-50, 20], duration: 100}));
            m.jumpTo({padding: {left: 100, top: 0, right: 0, bottom: 50}});
            m.jumpTo({center: [50, 60]});
            const padded = [m.getCenter().lng, m.getCenter().lat, m.getZoom()];
            m.jumpTo({padding: 0});
            m.setMaxBounds(null);
            const world = [[-180, -18.3], [180, 83.2]];
            const fitted = await end(() => m.fitBounds(world, {duration: 100}));
            const fittedAtOnce = await end(() => m.fitBounds(world, {duration: 0}));
            m.remove(); el.remove();
            return {eased, jumped, fitted, fittedAtOnce, turned, easedEdge, padded};
        });
        const near = (a, b) => Math.abs(a - b) < 1e-6;
        check('[main] maplibre-compat: easeTo and fitBounds end inside maxBounds and the edge of the world, as jumpTo does (#246)',
            near(cam.eased[0], cam.jumped[0]) && near(cam.eased[1], cam.jumped[1]) && cam.eased[0] <= 10 && cam.eased[1] <= 50
            && near(cam.fitted[1], cam.fittedAtOnce[1]) && cam.fitted[1] < 55, JSON.stringify(cam));
        // The results of MapLibre GL JS 6.17 for the same moves, at a precision of 1e-3.
        const ml = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3);
        check('[main] maplibre-compat: maxBounds keeps the edges of the view inside, raises the zoom when the view is larger, and counts the padding, as MapLibre does (#280)',
            ml(cam.jumped, [5, 47.8094]) && ml(cam.eased, [5, 47.8094, 4.3987]) && ml(cam.turned, [8.3521, 49.2886, 6]) && ml(cam.easedEdge, [1.6479, 40.8364, 6]) && ml(cam.padded, [8.9014, 49.4674, 6]), JSON.stringify(cam));
        // #309: maxBounds whose west edge is east of the east edge cross the antimeridian. The same jumps and drags, in
        // MapLibre GL JS (served at /ml/), in the compat entry and in the main API, end at the same centre.
        const anti = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js'), lib = await import('/dist/map-jr-gl.js');
            const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, maxBounds = [[150, -50], [-120, 10]];
            const jumps = [[-170, -20], [100, 0], [-100, 0], [190, -60], [-200, 30]];
            const run = async make => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = await make(el);
                const at = () => [m.getCenter().lng, m.getCenter().lat];
                const out = [];
                for (const c of jumps) { m.jumpTo({center: c, zoom: 3}); out.push(at()); }
                // Narrower bounds (20 degrees, 455 pixels at zoom 4): a drag across the antimeridian stops at the edge in
                // both libraries, whatever their drag does with the first and the last pixels.
                m.setMaxBounds([[170, -50], [-170, 10]]);
                const c = m.getCanvas(), r = c.getBoundingClientRect();
                const ptr = (type, x) => c.dispatchEvent(new PointerEvent(type, {bubbles: true, clientX: r.left + x, clientY: r.top + 100, pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true}));
                const mouse = (type, x) => c.dispatchEvent(new MouseEvent(type, {bubbles: true, clientX: r.left + x, clientY: r.top + 100, button: 0, buttons: type === 'mouseup' ? 0 : 1}));
                for (const [lng, from, to] of [[177, 280, 20], [-177, 20, 280]]) {
                    m.jumpTo({center: [lng, -20], zoom: 4});
                    await new Promise(res => setTimeout(res, 50));
                    ptr('pointerdown', from); mouse('mousedown', from);
                    for (let i = 1; i <= 10; i++) { const x = from + (to - from) * i / 10; ptr('pointermove', x); mouse('mousemove', x); await new Promise(res => setTimeout(res, 40)); }
                    ptr('pointerup', to); mouse('mouseup', to);
                    await new Promise(res => setTimeout(res, 200));
                    out.push(at());
                }
                m.remove(); el.remove();
                return out;
            };
            const loaded = m => new Promise(r => m.loaded?.() ? r(m) : m.once('load', () => r(m)));
            const opts = el => ({container: el, style, maxBounds, center: [170, -20], zoom: 3, fadeDuration: 0, dragPan: {inertia: false}});
            const mlr = await run(el => loaded(new ml.Map(opts(el))));
            const cr = await run(el => loaded(new compat.Map({...opts(el), renderer: 'main'})));
            // The main API: the description carries the bounds, and the view moves by jumps (no drag here).
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const host = lib.createMap(el, {style, maxBounds, view: {center: [170, -20], zoom: 3}, renderer: 'main'});
            await new Promise(r => host.state.subscribe(s => s.loaded, l => l && r()));
            const hr = [];
            for (const c of jumps) {
                host.update({style, maxBounds, view: {center: c, zoom: 3}, renderer: 'main'});
                // (Each expected centre differs from the one before: wait up to 2 s for the state to report it.)
                const was = host.state.get().view.center[0];
                for (let i = 0; i < 40 && host.state.get().view.center[0] === was; i++) await new Promise(r => setTimeout(r, 50));
                hr.push(host.state.get().view.center);
            }
            host.destroy(); el.remove();
            return {ml: mlr, compat: cr, main: hr};
        });
        const sameLng = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180) < 1e-3;
        const same = (a, b) => a.length === b.length && a.every((p, i) => sameLng(p[0], b[i][0]) && Math.abs(p[1] - b[i][1]) < 1e-3);
        check('[main] maplibre-compat and createMap: maxBounds that cross the antimeridian keep the view where MapLibre keeps it, after a jump and a drag (#309)',
            same(anti.compat, anti.ml) && same(anti.main, anti.ml.slice(0, 5)), JSON.stringify(anti));
        // #334: LngLatBounds keeps its corners as given (as MapLibre does), so a bounds object can cross the antimeridian.
        // The same calls in MapLibre GL JS (served at /ml/) and in the compat entry give the same results, and
        // fitBounds with such bounds ends at the same centre and zoom.
        const llb = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const b = new lib.LngLatBounds([170, -10], [-170, 10]), arr = new lib.LngLatBounds([170, -10, -170, 10]);
                const out = [b.getWest(), b.getEast(), b.getCenter().lng, b.getCenter().lat, ...b.toArray().flat(), ...arr.toArray().flat(),
                    ...lib.LngLatBounds.convert([[170, -10], [-170, 10]]).toArray().flat(),
                    ...[[175, 0], [-175, 0], [0, 0], [180, 0], [-180, 0], [170, 0]].map(p => b.contains(p) ? 1 : 0),
                    ...new lib.LngLatBounds([10, 20], [0, 0]).toArray().flat(), ...new lib.LngLatBounds([10, 20], [0, 0]).extend([5, 30]).toArray().flat()];
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [0, 0], zoom: 1, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                m.fitBounds(b, {duration: 0});
                out.push(((m.getCenter().lng % 360) + 360) % 360, m.getCenter().lat, m.getZoom());
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: LngLatBounds keeps the corners as given, and contains, getCenter and fitBounds across the antimeridian agree with MapLibre (#334)',
            llb.ml.length === llb.compat.length && llb.ml.every((v, i) => Math.abs(v - llb.compat[i]) < 1e-3), JSON.stringify(llb));
        // #564: listens, getStyleUrl and fitScreenCoordinates give the results of MapLibre GL JS (served at /ml/).
        const m564 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]};
            const url = URL.createObjectURL(new Blob([JSON.stringify(style)], {type: 'application/json'}));
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style, center: [10, 45], zoom: 4, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const fn = () => {}, out = [m.listens('click'), m.getStyleUrl()];
                m.on('click', fn); out.push(m.listens('click'), m.listens('dblclick')); m.off('click', fn); out.push(m.listens('click'));
                m.on('mousemove', 'bg', fn); out.push(m.listens('mousemove')); m.off('mousemove', 'bg', fn); out.push(m.listens('mousemove'));
                const camera = () => [m.getCenter().lng, m.getCenter().lat, m.getZoom(), m.getBearing()];
                m.fitScreenCoordinates([40, 30], [200, 150], 0, {duration: 0}); out.push(...camera());
                m.fitScreenCoordinates({x: 250, y: 20}, [120, 180], 30, {duration: 0, padding: {top: 10, bottom: 25, left: 40, right: 5}}); out.push(...camera());
                m.fitScreenCoordinates([100, 50], [110, 60], -100, {duration: 0, maxZoom: 6, padding: 20}); out.push(...camera());
                m.setStyle(url); out.push(m.getStyleUrl() === url);
                m.setStyle(style); out.push(m.getStyleUrl());
                m.remove();
                const second = new lib.Map({container: el, renderer: 'main', style: url, fadeDuration: 0});
                out.push(second.getStyleUrl() === url);
                second.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: listens, getStyleUrl and fitScreenCoordinates (with a bearing, padding and maxZoom) agree with MapLibre (#564)',
            m564.ml.length === m564.compat.length && m564.ml.every((v, i) => typeof v === 'number' ? Math.abs(v - m564.compat[i]) < 1e-3 : v === m564.compat[i]), JSON.stringify(m564));
        // #1018: calculateCameraOptionsFromTo, calculateCameraOptionsFromCameraLngLatAltRotation and
        // calculateAnchoredCameraOptions give the results of MapLibre GL JS (served at /ml/) for the same inputs.
        const m1018 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [10, 45], zoom: 4, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const out = [], put = c => out.push(c.center.lng, c.center.lat, c.zoom, c.elevation ?? null, c.pitch ?? null, c.bearing ?? null, c.roll ?? null);
                put(m.calculateCameraOptionsFromTo(new lib.LngLat(1, 0), 1000, new lib.LngLat(1, 1), 0));
                put(m.calculateCameraOptionsFromTo([10, 45], 5000, [10.2, 45.1], 200));
                put(m.calculateCameraOptionsFromTo({lng: -30, lat: 60}, 100, {lng: -30.01, lat: 60.02}));
                put(m.calculateCameraOptionsFromTo([5, 5], 10, [5, 5], -300));
                try { m.calculateCameraOptionsFromTo([5, 5], 10, [5, 5], 10); out.push('no error'); } catch { out.push('error'); }
                put(m.calculateCameraOptionsFromCameraLngLatAltRotation(new lib.LngLat(1, 0), 1000, 90, 30, 45));
                put(m.calculateCameraOptionsFromCameraLngLatAltRotation([10, 45], 2000, 0, 0));
                put(m.calculateCameraOptionsFromCameraLngLatAltRotation([10, 45], 500, 20, 95));
                put(m.calculateCameraOptionsFromCameraLngLatAltRotation([10, 70], 1e6, -150, 60));
                put(m.calculateAnchoredCameraOptions({anchorLocation: [11, 46], anchorScreenPoint: [50, 60], zoom: 5}));
                put(m.calculateAnchoredCameraOptions({anchorLocation: new lib.LngLat(9, 44), anchorScreenPoint: {x: 200, y: 100}}));
                m.jumpTo({bearing: 30, pitch: 40});
                put(m.calculateAnchoredCameraOptions({anchorLocation: m.unproject([100, 150]), anchorScreenPoint: [140, 90], zoom: 4.5}));
                out.push(m.getZoom(), m.getCenter().lng);
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: calculateCameraOptionsFromTo, calculateCameraOptionsFromCameraLngLatAltRotation and calculateAnchoredCameraOptions agree with MapLibre to 1e-9 (#1018)',
            m1018.ml.length === m1018.compat.length && m1018.ml.every((v, i) => typeof v === 'number' ? Math.abs(v - m1018.compat[i]) <= 1e-9 * Math.max(1, Math.abs(v)) : v === m1018.compat[i]), JSON.stringify(m1018));
        // #1020: setTransformConstrain and the option transformConstrain limit the camera as in MapLibre GL JS (served at /ml/).
        const m1020 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const free = (lngLat, zoom) => ({center: lngLat, zoom: zoom ?? 0});
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]};
                const out = [], put = m => out.push(+m.getZoom().toFixed(6), +m.getCenter().lng.toFixed(6), +m.getCenter().lat.toFixed(6));
                // The example page of MapLibre GL JS: under the zoom at which the world fills the view, and past the bounds.
                let m = new lib.Map({container: el, style, transformConstrain: free, zoom: -2, center: [360, 0], fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                put(m);
                m.jumpTo({center: [20, 89], zoom: -1}); put(m);
                m.remove();
                m = new lib.Map({container: el, renderer: 'main', style, center: [10, 45], zoom: 2, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                // A function that keeps the zoom at 3 or less and the centre east of 0.
                m.setTransformConstrain((lngLat, zoom) => ({center: new lib.LngLat(Math.max(0, lngLat.lng), lngLat.lat), zoom: Math.min(zoom, 3)}));
                m.jumpTo({center: [-20, 10], zoom: 6}); put(m);
                await new Promise(r => { m.once('moveend', r); m.easeTo({center: [-5, 20], zoom: 5, duration: 100}); });
                put(m);
                m.setTransformConstrain(null);
                m.jumpTo({center: [-20, 10], zoom: 6}); put(m);
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: setTransformConstrain and transformConstrain limit the camera as in MapLibre (#1020)',
            m1020.ml.length === m1020.compat.length && m1020.ml.every((v, i) => Math.abs(v - m1020.compat[i]) < 1e-6), JSON.stringify(m1020));
        // On a map that draws in a worker, the function has no effect and warns once; it fires no error (#1020).
        const w1020 = await page.evaluate(async () => {
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new compat.Map({container: el, renderer: 'worker', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [10, 45], zoom: 2});
            const warnings = [], errors = [], warn = console.warn;
            console.warn = (...a) => { warnings.push(String(a[0])); warn(...a); };
            m.on('error', e => errors.push(e.error?.message));
            const fn = (lngLat, zoom) => ({center: lngLat, zoom: Math.min(zoom, 1)});
            m.setTransformConstrain(fn); m.setTransformConstrain(fn);
            console.warn = warn;
            const zoom = m.getZoom();
            m.remove(); el.remove();
            return {warnings: warnings.filter(w => w.includes('setTransformConstrain')), errors, zoom};
        });
        check('[main] maplibre-compat: setTransformConstrain on a map that draws in a worker warns once and fires no error (#1020)',
            w1020.warnings.length === 1 && w1020.warnings[0].includes("renderer: 'main'") && !w1020.errors.length && w1020.zoom === 2, JSON.stringify(w1020));
        // #1022: coveringTiles gives the tiles of MapLibre GL JS (served at /ml/) for the same view and options.
        const m1022 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [179.9, 45], zoom: 4.6, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const cover = o => m.coveringTiles(o).map(t => `${t.overscaledZ}/${t.wrap}/${t.canonical.z}/${t.canonical.x}/${t.canonical.y}`).sort().join(' ');
                const out = {};
                for (const [name, o] of Object.entries({flat: {tileSize: 512}, small: {tileSize: 256}, round: {tileSize: 512, roundZoom: true}, max: {tileSize: 512, maxzoom: 3}, min: {tileSize: 512, minzoom: 6}})) out[name] = cover(o);
                m.jumpTo({pitch: 60, bearing: 20});
                out.pitched = cover({tileSize: 512, maxzoom: 14});
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        // Pitched, MapLibre GL JS can take one more tile at the edge of the view (4/0/6 here): the compat tiles are a part of its tiles.
        const pitchedML = m1022.ml.pitched?.split(' ') ?? [];
        check('[main] maplibre-compat: coveringTiles gives the tiles of MapLibre (flat, tileSize, roundZoom, minzoom, maxzoom; pitched within them) (#1022)',
            ['flat', 'small', 'round', 'max', 'min'].every(k => m1022.ml[k] === m1022.compat[k]) && m1022.compat.pitched?.split(' ').every(t => pitchedML.includes(t)) && m1022.compat.pitched.length > 0, JSON.stringify(m1022));
        // #1021: setSourceTileLodParams changes the tiles of a view at pitch 80 as in MapLibre GL JS (served at /ml/), with
        // the engine on the main thread and in a worker. (A tile that a requested deeper tile covers is a placeholder and is left out.)
        const m1021 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).arrayBuffer();
            const leaves = a => a.filter(t => { const [z, x, y] = t.split('/').map(Number); return !a.some(u => { const [c, i, j] = u.split('/').map(Number); return c > z && i >> (c - z) === x && j >> (c - z) === y; }); }).sort().join(' ');
            const run = async (lib, lod, renderer, readd) => {
                const seen = new Set();
                lib.addProtocol('lod', async p => { seen.add(p.url.slice(6).split('?')[0]); return {data: png.slice(0)}; });
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px'}));
                const m = new lib.Map({container: el, renderer, style: {version: 8, sources: {}, layers: []}, center: [10, 45], zoom: 10, pitch: 80, maxPitch: 85, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                m.addSource('s', {type: 'raster', tiles: ['lod://{z}/{x}/{y}'], tileSize: 256});
                if (lod) m.setSourceTileLodParams(...lod, 's');
                m.addLayer({id: 'r', type: 'raster', source: 's'});
                await new Promise(r => m.once('idle', r));
                if (readd === 'setStyle') {
                    // #1059: setStyle replaces the source with one of the same id, which starts with the default values.
                    seen.clear();
                    m.setStyle({version: 8, sources: {s: {type: 'raster', tiles: ['lod://{z}/{x}/{y}?again'], tileSize: 256}}, layers: [{id: 'r', type: 'raster', source: 's'}]});
                    await new Promise(r => m.once('idle', r));
                } else if (readd) {
                    // #1059: a source added again with the same id starts with the default values.
                    m.removeLayer('r'); m.removeSource('s'); seen.clear();
                    m.addSource('s', {type: 'raster', tiles: ['lod://{z}/{x}/{y}?again'], tileSize: 256});
                    m.addLayer({id: 'r', type: 'raster', source: 's'});
                    await new Promise(r => m.once('idle', r));
                }
                m.remove(); el.remove(); lib.removeProtocol('lod');
                return leaves([...seen]);
            };
            const out = {};
            for (const lod of [[2, 1], [12, 5]]) out[lod] = {ml: await run(ml, lod), main: await run(compat, lod, 'main'), worker: await run(compat, lod)};
            out.readd = {ml: await run(ml, [2, 1], undefined, true), base: await run(ml, null), cbase: await run(compat, null, 'main'), main: await run(compat, [2, 1], 'main', true), worker: await run(compat, [2, 1], undefined, true)};
            out.restyle = {ml: await run(ml, [2, 1], undefined, 'setStyle'), main: await run(compat, [2, 1], 'main', 'setStyle'), worker: await run(compat, [2, 1], undefined, 'setStyle')};
            return out;
        });
        check('[main] maplibre-compat: setSourceTileLodParams gives the tiles of MapLibre at pitch 80 for two values, on the main thread and in a worker (#1021)',
            m1021['2,1'].ml !== m1021['12,5'].ml && [m1021['2,1'], m1021['12,5']].every(r => r.ml && r.main === r.ml && r.worker === r.ml), JSON.stringify(m1021));
        check('[main] maplibre-compat: a source removed and added again with the same id uses the default setSourceTileLodParams values, as in MapLibre GL JS (#1059)',
            // The compat tiles with the default values are compared with the compat tiles of a new map, because they differ from MapLibre's at pitch 80 (a separate fault).
            m1021.readd.ml === m1021.readd.base && m1021.readd.ml !== m1021['2,1'].ml && m1021.readd.main === m1021.readd.cbase && m1021.readd.worker === m1021.readd.cbase && m1021.readd.cbase !== m1021['2,1'].main, JSON.stringify(m1021.readd));
        check('[main] maplibre-compat: setStyle that replaces a source with one of the same id drops its setSourceTileLodParams values, as in MapLibre GL JS (#1059)',
            m1021.restyle.ml === m1021.readd.base && m1021.restyle.main === m1021.readd.cbase && m1021.restyle.worker === m1021.readd.cbase, JSON.stringify(m1021.restyle));
        // #1242: zoomIn and zoomOut take 500 ms and resetNorth and resetNorthPitch 1000 ms by default, as in MapLibre GL JS (served at /ml/).
        const m1242 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [10, 45], zoom: 4});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const time = async f => { const t = performance.now(); const end = new Promise(r => m.once('moveend', r)); f(); await end; return performance.now() - t; };
                const out = [await time(() => m.zoomIn()), await time(() => m.zoomOut())];
                m.jumpTo({bearing: 40}); out.push(await time(() => m.resetNorth()));
                m.jumpTo({bearing: 40, pitch: 30}); out.push(await time(() => m.resetNorthPitch()));
                m.remove(); el.remove();
                return out.map(Math.round);
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        // The times are at least the duration (the old defaults were 300 and 500 ms) and less than twice it, for a loaded machine.
        check('[main] maplibre-compat: zoomIn and zoomOut take 500 ms and resetNorth and resetNorthPitch 1000 ms by default, as in MapLibre GL JS (#1242)',
            [m1242.ml, m1242.compat].every(t => [500, 500, 1000, 1000].every((d, i) => t[i] >= d - 20 && t[i] < 2 * d)), JSON.stringify(m1242));
        // #1245: setMinPitch throws for a value below 0 or above the largest pitch, and null restores 0, as in MapLibre GL JS (served at /ml/).
        const m1245 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [10, 45], zoom: 4});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const out = [];
                for (const p of [-5, 70]) { try { m.setMinPitch(p); out.push(m.getMinPitch()); } catch { out.push('threw'); } }
                m.setMinPitch(20); out.push(m.getMinPitch());
                m.setMinPitch(null); out.push(m.getMinPitch());
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: setMinPitch throws for a value out of range and null restores 0, as in MapLibre GL JS (#1245)',
            JSON.stringify(m1245.ml) === '["threw","threw",20,0]' && JSON.stringify(m1245.compat) === JSON.stringify(m1245.ml), JSON.stringify(m1245));
        // #1246: setMinZoom(null) and setMaxZoom(null) restore the defaults, as in MapLibre GL JS (served at /ml/).
        const m1246 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [10, 45], zoom: 4, minZoom: 1, maxZoom: 10});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                m.setMinZoom(null); m.setMaxZoom(null);
                const out = [m.getMinZoom(), m.getMaxZoom()];
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: setMinZoom(null) and setMaxZoom(null) restore -2 and 22, as in MapLibre GL JS (#1246)',
            JSON.stringify(m1246.ml) === '[-2,22]' && JSON.stringify(m1246.compat) === '[-2,22]', JSON.stringify(m1246));
        // #1019: zoomSnap (the option and setZoomSnap) and setEventedParent work as in MapLibre GL JS (served at /ml/).
        const m1019 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [10, 45], zoom: 4.3, zoomSnap: 0.5, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const out = [m.getZoom(), m.getZoomSnap()];
                m.setZoom(3.2); out.push(m.getZoom());
                m.jumpTo({zoom: 3.3}); out.push(m.getZoom());
                m.easeTo({zoom: 5.74, duration: 0}); out.push(m.getZoom());
                m.zoomIn({duration: 0}); out.push(m.getZoom());
                m.setZoomSnap(0.25);
                out.push(m.cameraForBounds([[0, 0], [10, 10]]).zoom);
                m.fitBounds([[0, 0], [10, 10]], {duration: 0}); out.push(m.getZoom());
                m.setZoomSnap(0); out.push(m.getZoomSnap()); m.setZoom(3.3); out.push(m.getZoom());
                const wait = () => new Promise(r => setTimeout(r, 100));
                // (MapLibre GL JS passes the parent every event that the map listens to, and its own listeners are many. An
                // Evented parent drops the events that it has no listener for, and so does this one.)
                const parent = {got: [], listens: t => t === 'custom' || t === 'zoomend', fire(e) { if (this.listens(e.type)) this.got.push([e.type, e.a ?? null, e.extra ?? null, e.target === m]); }};
                out.push(m.listens('custom'));
                m.setEventedParent(parent, {extra: 7}); out.push(m.listens('custom'), m.listens('other'));
                m.fire('custom', {a: 1}); m.fire('other', {a: 2});
                m.setZoom(4); await wait();
                m.setEventedParent(parent, () => ({extra: 8})); m.fire('custom', {a: 3});
                m.setEventedParent(null); m.fire('custom', {a: 4}); out.push(m.listens('custom'));
                await wait();
                out.push(JSON.stringify(parent.got));
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: zoomSnap snaps the zoom of camera calls and fitBounds, and setEventedParent passes events to the parent, as in MapLibre (#1019)',
            m1019.ml.length === m1019.compat.length && m1019.ml.every((v, i) => typeof v === 'number' ? Math.abs(v - m1019.compat[i]) < 1e-9 : v === m1019.compat[i]), JSON.stringify(m1019));
        // #1198: fitBounds and fitScreenCoordinates with `pitch` end at that pitch and fit the box as seen from above, and
        // without `pitch` keep the pitch of the map, as in MapLibre GL JS (served at /ml/).
        const m1198 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [10, 45], zoom: 4, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const view = () => [m.getCenter().lng, m.getCenter().lat, m.getZoom(), m.getPitch(), m.getBearing()];
                const out = [];
                m.fitBounds([[0, 40], [10, 50]], {pitch: 30, padding: 10, duration: 0}); out.push(view());
                m.fitBounds([[5, 40], [20, 45]], {duration: 0}); out.push(view());
                m.jumpTo({center: [10, 45], zoom: 4, pitch: 0});
                m.fitScreenCoordinates([50, 40], [250, 160], 20, {pitch: 40, duration: 0}); out.push(view());
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: fitBounds and fitScreenCoordinates end at the pitch of the options, or keep the pitch, as in MapLibre GL JS (#1198)',
            m1198.ml.length === 3 && m1198.ml.every((v, i) => v.every((x, j) => Math.abs(x - m1198.compat[i][j]) < 1e-4)), JSON.stringify(m1198));
        // #1235: fitBounds flies as flyTo does, with a duration from `speed`, and eases as easeTo does with `linear`, as in
        // MapLibre GL JS (served at /ml/).
        const m1235 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px'}));
                const m = new lib.Map({container: el, renderer: 'main', style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}, center: [0, 0], zoom: 5, fadeDuration: 0});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                const fit = async (bounds, o) => {
                    let low = m.getZoom();
                    const onMove = () => { low = Math.min(low, m.getZoom()); };
                    m.on('move', onMove);
                    const t0 = performance.now();
                    const end = new Promise(r => m.once('moveend', r));
                    m.fitBounds(bounds, o);
                    await end;
                    m.off('move', onMove);
                    return {ms: performance.now() - t0, low, end: [m.getCenter().lng, m.getCenter().lat, m.getZoom()]};
                };
                const out = {fly: await fit([[38, -2], [42, 2]], {speed: 4}), linear: await fit([[-2, -2], [2, 2]], {linear: true})};
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        // (The flight dips more than one zoom level below its end. The linear fit moves 40 degrees at one zoom and does not dip.)
        check('[main] maplibre-compat: fitBounds flies with a duration from speed, and eases with linear, as in MapLibre GL JS (#1235)',
            ['fly', 'linear'].every(k => {
                const a = m1235.ml[k], b = m1235.compat[k];
                return a.end.every((x, i) => Math.abs(x - b.end[i]) < 1e-4) && Math.abs(a.low - b.low) < 0.05 && b.ms > a.ms * 0.6 && b.ms < a.ms * 1.6;
            }) && m1235.ml.fly.low < m1235.ml.fly.end[2] - 1 && m1235.ml.linear.low > m1235.ml.fly.end[2] - 0.01, JSON.stringify(m1235));
        // #565: isSourceLoaded(id) answers for one source and fires `error` for an id that the style does not have, and
        // isActive() of a handler is true during its gesture, as in MapLibre GL JS (served at /ml/).
        const m565 = {};
        for (const name of ['ml', 'compat']) {
            const sources = await page.evaluate(async name => {
                const lib = await import(name === 'ml' ? '/ml/maplibre-gl.mjs' : '/dist/map-jr-gl-maplibre-compat.js');
                if (name === 'ml') lib.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px;z-index:99999'}));
                const point = lng => ({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lng, 45]}});
                const style = {version: 8, sources: {a: {type: 'geojson', data: point(10)}, b: {type: 'geojson', data: point(11)}},
                    layers: [{id: 'bg', type: 'background'}, {id: 'a', type: 'circle', source: 'a'}, {id: 'b', type: 'circle', source: 'b'}]};
                const m = window.m565 = new lib.Map({container: el, renderer: 'main', style, center: [10, 45], zoom: 4, fadeDuration: 0});
                await new Promise(r => m.once('idle', r));
                const errors = [];
                m.on('error', e => errors.push(e.error));
                let missing;
                try { missing = m.isSourceLoaded('nope'); } catch { missing = 'threw'; }
                const out = [String(missing), errors.length, errors[0] instanceof Error, m.isSourceLoaded('a'), m.isSourceLoaded('b')];
                m.getSource('a').setData(point(12));
                out.push(m.isSourceLoaded('a'), m.isSourceLoaded('b'), m.getSource('a').loaded(), m.getSource('b').loaded());
                await new Promise(r => m.once('idle', r));
                out.push(m.isSourceLoaded('a'), errors.length);
                return out.join();
            }, name);
            const active = () => page.evaluate(() => ['dragPan', 'dragRotate', 'boxZoom', 'touchZoomRotate', 'touchPitch', 'scrollZoom'].map(h => +window.m565[h].isActive()).join(''));
            const gesture = async (button, key) => {
                await page.mouse.move(150, 100);
                if (key) await page.keyboard.down(key);
                await page.mouse.down({button});
                const before = await active();
                await page.mouse.move(180, 120, {steps: 5});
                const during = await active();
                await page.mouse.up({button});
                if (key) await page.keyboard.up(key);
                const after = await active();
                await page.waitForTimeout(500);
                return [before, during, after].join('>');
            };
            m565[name] = [sources, await gesture('left'), await gesture('right'), await gesture('left', 'Shift')].join(' ');
            // (Chromium has no touch input here: the two-finger gestures are checked for the compat entry alone.)
            if (name === 'compat') m565.touch = await page.evaluate(() => {
                const m = window.m565, c = m.getCanvas(), out = [];
                const send = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, {pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true}));
                const read = () => out.push(['touchZoomRotate', 'touchPitch', 'dragPan'].map(h => +m[h].isActive()).join(''));
                send('pointerdown', 11, 100, 100); send('pointerdown', 12, 200, 100);
                for (let i = 1; i <= 3; i++) { send('pointermove', 11, 100 - i * 15, 100); send('pointermove', 12, 200 + i * 15, 100); }
                read();
                send('pointerup', 11, 55, 100); read(); send('pointerup', 12, 245, 100);
                send('pointerdown', 13, 120, 60); send('pointerdown', 14, 180, 60);
                for (let i = 1; i <= 3; i++) { send('pointermove', 13, 120, 60 + i * 10); send('pointermove', 14, 180, 60 + i * 10); }
                read();
                m.touchPitch.disable(); read(); m.touchPitch.enable();
                send('pointerup', 13, 120, 90); send('pointerup', 14, 180, 90); read();
                return out.join();
            });
            await page.evaluate(() => { const el = window.m565.getContainer(); window.m565.remove(); el.remove(); delete window.m565; });
        }
        check('[main] maplibre-compat: isSourceLoaded answers for one source and fires error for an unknown id, and isActive of dragPan, dragRotate and boxZoom is true during the gesture, as in MapLibre (#565)',
            m565.ml === m565.compat && m565.compat.startsWith('undefined,1,true,true,true,false,true,false,true,true,1 100000>100000>000000 000000>010000>000000 001000>001000>000000'), JSON.stringify(m565));
        check('[main] maplibre-compat: isActive of touchZoomRotate is true during a pinch and of touchPitch during a tilt, and false after a finger lifts or after disable() (#565)',
            m565.touch === '100,000,010,000,000', JSON.stringify(m565));
        // #606: a GeoJSON feature without an id that several tiles hold is given one time. [0, 0] is the corner of four
        // tiles at zoom 2, and each of them has the three points in its buffer. MapLibre GL JS (served at /ml/) gives the
        // points one time too. It gives the square once for each tile, and this library gives it one time.
        const m606 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const point = {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}};
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}};
            const style = {version: 8, sources: {points: {type: 'geojson', data: {type: 'FeatureCollection', features: [point, point, point]}}, square: {type: 'geojson', data: square}},
                layers: [{id: 'square', type: 'fill', source: 'square'}, {id: 'points', type: 'circle', source: 'points'}]};
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style, center: [0, 0], zoom: 2});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                await new Promise(r => { m.once('idle', r); setTimeout(r, 3000); });
                const box = [[140, 90], [160, 110]], out = {};
                for (const layer of ['points', 'square']) {
                    const found = [await m.queryRenderedFeatures([150, 100], {layers: [layer]}), await m.queryRenderedFeatures(box, {layers: [layer]}), await m.queryRenderedFeatures({layers: [layer]})];
                    out[layer] = found.map(f => f.length);
                    out.keys = out.keys !== false && found.flat().every(f => !('index' in f));
                }
                // (The array is read at once. The promise is awaited so that the map is not removed while the question is open.)
                const atOnce = m.queryRenderedFeatures(box, {layers: ['points']});
                out.atOnce = [...atOnce].length;
                await atOnce;
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: queryRenderedFeatures gives a GeoJSON feature without an id one time when several tiles hold it, as MapLibre gives three points at the corner of four tiles (#606)',
            m606.ml.points.join() === '3,3,3' && m606.compat.points.join() === '3,3,3' && m606.compat.atOnce === 3 && m606.ml.atOnce === 3 && m606.compat.square.join() === '1,1,1' && m606.compat.keys, JSON.stringify(m606));
        // #659: two GeoJSON features with the same id are two results, as in MapLibre GL JS (served at /ml/). Three points
        // share the id 12, one point has no id, and a square crosses the borders of four tiles at zoom 2.
        const m659 = await page.evaluate(async () => {
            const ml = await import('/ml/maplibre-gl.mjs');
            ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
            const compat = await import('/dist/map-jr-gl-maplibre-compat.js');
            const point = (id, c) => ({type: 'Feature', ...(id === undefined ? {} : {id}), properties: {}, geometry: {type: 'Point', coordinates: c}});
            const square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}};
            const style = {version: 8, sources: {points: {type: 'geojson', data: {type: 'FeatureCollection', features: [point(12, [-10, 5]), point(12, [10, 5]), point(12, [10, -5]), point(undefined, [-10, -5])]}}, square: {type: 'geojson', data: square}},
                layers: [{id: 'square', type: 'fill', source: 'square'}, {id: 'points', type: 'circle', source: 'points'}]};
            const run = async lib => {
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
                const m = new lib.Map({container: el, renderer: 'main', style, center: [0, 0], zoom: 2});
                await new Promise(r => m.loaded?.() ? r() : m.once('load', r));
                await new Promise(r => { m.once('idle', r); setTimeout(r, 3000); });
                const at = m.project([10, 5]), out = {};
                for (const layer of ['points', 'square']) out[layer] = [(await m.queryRenderedFeatures([at.x, at.y], {layers: [layer]})).length, (await m.queryRenderedFeatures([[0, 0], [300, 200]], {layers: [layer]})).length];
                out.source = [(await m.querySourceFeatures('points')).length, (await m.querySourceFeatures('square')).length];
                m.remove(); el.remove();
                return out;
            };
            return {ml: await run(ml), compat: await run(compat)};
        });
        check('[main] maplibre-compat: queryRenderedFeatures gives each GeoJSON feature that shares an id with another, as MapLibre does (#659)',
            JSON.stringify(m659.ml.points) === JSON.stringify(m659.compat.points) && m659.compat.points.join() === '1,4' && m659.compat.square.join() === '1,1', JSON.stringify(m659));
        // #261: the eventData argument of a camera method is on the events of that move, and not on the next move.
        const tagged = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [5, 45], zoom: 4, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            await new Promise(r => m.once('load', r));
            const seen = [];
            for (const t of ['movestart', 'move', 'moveend', 'zoomstart', 'zoomend']) m.on(t, e => seen.push(t + ':' + e.automated));
            const end = f => new Promise(r => { m.once('moveend', () => setTimeout(r, 50)); f(); });
            const out = {};
            for (const [name, f] of [
                ['fitBounds', () => m.fitBounds([[0, 40], [10, 50]], {duration: 100}, {automated: true})],
                ['flyTo', () => m.flyTo({zoom: 6, duration: 100}, {automated: true})],
                ['jumpTo', () => m.jumpTo({zoom: 3}, {automated: true})],
                ['setCenter', () => m.setCenter([1, 1], {automated: true})],
                ['plain', () => m.easeTo({zoom: 5, duration: 100})],
            ]) { seen.length = 0; await end(f); out[name] = [...seen]; }
            // A jumpTo that does not move the camera, then a drag: the drag's events have no eventData fields.
            m.jumpTo({center: m.getCenter()}, {automated: true});
            await new Promise(r => setTimeout(r, 100));
            seen.length = 0;
            const c = m.getCanvas(), at = (type, x) => c.dispatchEvent(new PointerEvent(type, {bubbles: true, clientX: x, clientY: 100, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true}));
            await end(() => { at('pointerdown', 150); for (let x = 160; x <= 220; x += 10) at('pointermove', x); at('pointerup', 220); });
            out.drag = [...seen];
            m.remove(); el.remove();
            return out;
        });
        const tags = list => [...new Set(list.map(s => s.split(':')[1]))].join();
        check('[main] maplibre-compat: the eventData of fitBounds, flyTo, jumpTo and setCenter is on the events of that move only, and not on a later drag (#261)',
            ['fitBounds', 'flyTo', 'jumpTo', 'setCenter'].every(k => tagged[k].includes('moveend:true') && tags(tagged[k]) === 'true')
            && tagged.fitBounds.includes('zoomend:true') && tags(tagged.plain) === 'undefined' && tagged.drag.includes('moveend:undefined') && tags(tagged.drag) === 'undefined', JSON.stringify(tagged));
    }
    // Accessibility: the canvas says that it is a map and shows the keyboard focus, a marker with a popup works with the
    // keyboard, the fullscreen button says what it does, and a camera animation respects "reduce motion".
    if (mode === 'main') {
        await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = window.a11yEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px;z-index:1000'}));
            const m = window.a11yMap = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            m.addControl(new mod.FullscreenControl());
            window.a11yMarker = new mod.Marker().setLngLat([0, 0]).setPopup(new mod.Popup().setText('Popup of the marker')).addTo(m);
            window.a11yPlain = new mod.Marker().setLngLat([5, 5]).addTo(m);
            await new Promise(r => m.once('load', r));
            document.activeElement?.blur();
        });
        const before = await page.evaluate(() => ({outline: window.a11yEl.style.outline, role: window.a11yMap.getCanvas().getAttribute('role'), label: window.a11yMap.getCanvas().getAttribute('aria-label')}));
        await page.evaluate(() => window.a11yMap.getCanvas().focus({focusVisible: true}));
        await page.keyboard.press('Shift'); // (a key press: the browser now shows the focus as for a keyboard user)
        const focused = await page.evaluate(() => { const c = window.a11yMap.getCanvas(); c.blur(); c.focus({focusVisible: true}); return window.a11yEl.style.outline; });
        const blurred = await page.evaluate(() => { window.a11yMap.getCanvas().blur(); return window.a11yEl.style.outline; });
        const marker = await page.evaluate(async () => {
            const el = window.a11yMarker.getElement(), plain = window.a11yPlain.getElement(), button = window.a11yEl.querySelector('.map-jr-ctrl-group button');
            el.focus();
            el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            const open = window.a11yMarker.getPopup().isOpen();
            el.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
            await new Promise(r => setTimeout(r, 400)); // (the popup closes with a short animation)
            // The focus: Enter moves it to the close button of the popup, and it is on the marker again after the close button.
            // A click on the marker moves it into the popup too (focusAfterOpen, as in MapLibre GL JS). A link in the content comes before the close button.
            const popup = window.a11yMarker.getPopup(), close = popup.getElement().querySelector('button');
            el.focus();
            el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            const focusIn = document.activeElement === close;
            close.click();
            await new Promise(r => setTimeout(r, 400));
            const focusBack = document.activeElement === el && !popup.isOpen();
            window.a11yMap.getCanvas().focus();
            el.click();
            const focusClick = document.activeElement === close && popup.isOpen();
            el.click();
            await new Promise(r => setTimeout(r, 400));
            popup.setHTML('<a href="https://example.com/">A link</a>');
            el.focus();
            el.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
            const focusLink = document.activeElement?.tagName === 'A';
            el.dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
            await new Promise(r => setTimeout(r, 400));
            // Candidates that cannot take the focus are passed over, up to the close button.
            popup.setHTML('<button disabled>Off</button><input type="hidden"><a href="https://example.com/" style="display:none">Hidden</a><link href="data:text/css,">');
            el.focus();
            el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            const focusSkips = document.activeElement === close;
            await new Promise(r => setTimeout(r, 400));
            // (This is a second opening: the box is opaque when the opening animation has ended.)
            const opacity = getComputedStyle(close.parentElement).opacity;
            close.click();
            await new Promise(r => setTimeout(r, 400));
            // A popup wider than the map does not scroll the container when it takes the focus.
            popup.setMaxWidth('520px').setHTML('<div style="width:500px">Wide</div>');
            el.focus();
            el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            await new Promise(r => setTimeout(r, 100));
            const scroll = [document.activeElement === close, window.a11yEl.scrollLeft, window.a11yEl.scrollTop].join();
            close.click();
            await new Promise(r => setTimeout(r, 400));
            window.a11yFocus = {focusIn, focusBack, focusClick, focusLink, focusSkips, opacity, scroll, closed: !popup.isOpen()};
            return {label: el.getAttribute('aria-label'), role: el.getAttribute('role'), tab: el.tabIndex, plainRole: plain.getAttribute('role'), plainTab: plain.getAttribute('tabindex'), open, closed: !window.a11yMarker.getPopup().isOpen(),
                fullscreen: button.getAttribute('aria-label'), title: button.title, pressed: button.getAttribute('aria-pressed')};
        });
        // Faults of #92: a popup that opens again during its closing animation stays open, a second remove() fires `close`
        // once, the focus goes to the map when the marker of a focused popup is removed, and Enter on a child of a
        // marker element does not toggle the popup.
        const faults = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.a11yMap, wait = t => new Promise(r => setTimeout(r, t));
            let closes = 0;
            const p = new mod.Popup().setLngLat([0, 0]).setText('Again').on('close', () => closes++).addTo(m);
            await wait(300);
            p.remove(); p.remove(); p.addTo(m);
            await wait(500);
            const reopened = p.isOpen() && p.getElement().isConnected, closesReopen = closes;
            p.remove(); p.remove();
            await wait(500);
            const closesTwice = closes - closesReopen, gone = !p.getElement().isConnected;
            const mk = new mod.Marker().setLngLat([0, 0]).setPopup(new mod.Popup().setText('Focus')).addTo(m);
            mk.getElement().focus();
            mk.getElement().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            const inPopup = mk.getPopup().getElement().contains(document.activeElement);
            mk.remove();
            await wait(500);
            const focusMap = document.activeElement === m.getCanvas();
            const custom = Object.assign(document.createElement('div'), {innerHTML: '<button type="button">Child</button>'});
            const ck = new mod.Marker({element: custom}).setLngLat([0, 0]).setPopup(new mod.Popup().setText('Child')).addTo(m);
            custom.firstChild.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            const childToggles = ck.getPopup().isOpen();
            ck.remove();
            await wait(300);
            return {reopened, closesReopen, closesTwice, gone, inPopup, focusMap, childToggles};
        });
        check('[main] Popup: addTo() during the closing animation keeps it open, remove() twice fires close once, the focus goes to the map when its marker is removed, and Enter on a child of the marker does not toggle it',
            faults.reopened && faults.closesReopen === 1 && faults.closesTwice === 1 && faults.gone && faults.inPopup && faults.focusMap && !faults.childToggles, JSON.stringify(faults));
        // #709: Escape closes a popup that has a close button and holds the focus, and the focus returns to the marker.
        const escape = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.a11yMap, wait = t => new Promise(r => setTimeout(r, t));
            const key = el => { const e = new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}); el.dispatchEvent(e); return e.defaultPrevented; };
            let closes = 0;
            const mk = new mod.Marker().setLngLat([0, 0]).setPopup(new mod.Popup().setText('Escape').on('close', () => closes++)).addTo(m);
            mk.getElement().focus();
            mk.getElement().dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            const p = mk.getPopup(), inPopup = p.getElement().contains(document.activeElement);
            // (A key that the content used does not close the popup.)
            const used = e => e.preventDefault();
            p.getElement().addEventListener('keydown', used, true);
            key(document.activeElement);
            const keptUsed = p.isOpen();
            p.getElement().removeEventListener('keydown', used, true);
            const prevented = key(document.activeElement), closed = !p.isOpen();
            await wait(500);
            const focusMarker = document.activeElement === mk.getElement(), gone = !p.getElement().isConnected;
            mk.remove();
            // (Without a close button, the popup stays open.)
            const input = document.createElement('input');
            const plain = new mod.Popup({closeButton: false}).setLngLat([0, 0]).setDOMContent(input).addTo(m);
            input.focus();
            const plainPrevented = key(input), plainOpen = plain.isOpen() && document.activeElement === input;
            plain.remove();
            await wait(500);
            return {inPopup, keptUsed, prevented, closed, closes, focusMarker, gone, plainPrevented, plainOpen};
        });
        check('[main] Popup: Escape closes a popup that has a close button and holds the focus, the focus returns to the marker, and a popup without a close button stays open',
            escape.inPopup && escape.keptUsed && escape.prevented && escape.closed && escape.closes === 1 && escape.focusMarker && escape.gone && !escape.plainPrevented && escape.plainOpen, JSON.stringify(escape));
        // A closing animation that never ends (here: paused, as on a page that draws no frames) does not keep the popup on the page.
        const stuck = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.a11yMap, wait = t => new Promise(r => setTimeout(r, t));
            const p = new mod.Popup().setLngLat([0, 0]).setText('Stuck').addTo(m);
            await wait(300);
            const animate = Element.prototype.animate;
            Element.prototype.animate = function (...a) { const an = animate.apply(this, a); an.pause(); return an; };
            try { p.remove(); } finally { Element.prototype.animate = animate; }
            await wait(1000);
            return {connected: p.getElement().isConnected, open: p.isOpen()};
        });
        check('[main] Popup: remove() removes the element when the closing animation never ends', !stuck.connected && !stuck.open, JSON.stringify(stuck));
        // #435: the other cases in which the closing animation does not play. The element leaves the page on a hidden page
        // (at once), in a container with `display: none`, and when the map is removed (at once, open or fading out).
        const left = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = t => new Promise(r => setTimeout(r, t));
            const el = Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'});
            document.body.appendChild(el);
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 1, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
            const popup = text => new mod.Popup().setLngLat([0, 0]).setText(text).addTo(m), on = p => p.getElement().isConnected;
            const hidden = popup('Hidden page'), none = popup('No display');
            await wait(300);
            Object.defineProperty(document, 'hidden', {get: () => true, configurable: true});
            try { hidden.remove(); } finally { delete document.hidden; }
            const hiddenPage = on(hidden);
            el.style.display = 'none';
            none.remove();
            await wait(1000);
            const displayNone = on(none);
            el.style.display = '';
            let closes = 0;
            const open = popup('Open').on('close', () => closes++), fading = popup('Fading').on('close', () => closes++);
            const marker = new mod.Marker().setLngLat([0, 0]).setPopup(new mod.Popup().setText('Of the marker')).addTo(m).togglePopup();
            await wait(300);
            fading.remove();
            const during = on(fading);
            m.remove();
            const out = {hiddenPage, displayNone, during, open: on(open) || open.isOpen(), fading: on(fading), marker: on(marker) || on(marker.getPopup()), closes,
                rest: el.querySelectorAll('.maplibregl-popup,.maplibregl-marker').length};
            el.remove();
            return out;
        });
        check('[main] Popup: remove() removes the element at once on a hidden page and within a second in a container with display: none; Map.remove() removes its popups and markers at once, and each popup fires close once',
            !left.hiddenPage && !left.displayNone && left.during && !left.open && !left.fading && !left.marker && left.closes === 2 && left.rest === 0, JSON.stringify(left));
        // A popup that fades out after remove() does not catch a click: the click goes to the map below it.
        const fading = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.a11yMap, wait = t => new Promise(r => setTimeout(r, t));
            const p = new mod.Popup().setLngLat(m.getCenter()).setText('Fading').addTo(m);
            await wait(300);
            const r = p.getElement().querySelector('.maplibregl-popup-content').getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
            const before = p.getElement().contains(document.elementFromPoint(x, y));
            p.remove();
            const during = p.getElement().contains(document.elementFromPoint(x, y)), connected = p.getElement().isConnected;
            await wait(500);
            return {before, during, connected};
        });
        check('[main] Popup: while it fades out after remove(), a click goes to the map below it', fading.before && !fading.during, JSON.stringify(fading));
        // #42: the options focusAfterOpen, closeOnMove, trackPointer and subpixelPositioning work as in MapLibre GL JS.
        const options = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.a11yMap, wait = t => new Promise(r => setTimeout(r, t));
            const warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); };
            const out = {};
            try {
                m.getCanvas().focus();
                let p = new mod.Popup({closeOnClick: false}).setLngLat([0, 0]).setHTML('<a href="https://example.com/">Link</a>').addTo(m);
                out.focus = document.activeElement?.tagName === 'A';
                p.remove(); await wait(400);
                m.getCanvas().focus();
                p = new mod.Popup({focusAfterOpen: false}).setLngLat([0, 0]).setText('No focus').addTo(m);
                out.noFocus = document.activeElement === m.getCanvas();
                p.remove(); await wait(400);
                // (A jumpTo just before addTo does not close it: the engine reports that move after addTo.)
                m.jumpTo({center: [0.5, 0.5]});
                p = new mod.Popup({closeOnMove: true}).setLngLat([0, 0]).setText('Move').addTo(m);
                await wait(100);
                const still = p.isOpen();
                m.jumpTo({center: [1, 1]});
                await wait(100);
                out.closeOnMove = still && !p.isOpen();
                m.jumpTo({center: [0, 0]}); await wait(400);
                const c = m.getContainer().getBoundingClientRect();
                p = new mod.Popup({trackPointer: true, closeOnClick: false, animate: false}).setText('Pointer').addTo(m);
                out.hiddenFirst = p.getElement().style.visibility === 'hidden';
                m.getCanvas().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse', clientX: c.left + 100, clientY: c.top + 120}));
                await wait(50);
                const at = p.getLngLat() ? m.project(p.getLngLat()) : {x: NaN, y: NaN};
                out.follows = p.getElement().style.visibility !== 'hidden' && Math.abs(at.x - 100) < 1 && Math.abs(at.y - 120) < 1;
                out.noClicks = p.getElement().querySelector('.maplibregl-popup-content').style.pointerEvents === 'none';
                p.setLngLat([0, 0]);
                m.getCanvas().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse', clientX: c.left + 30, clientY: c.top + 30}));
                await wait(50);
                const fixed = m.project(p.getLngLat()), mid = m.project([0, 0]);
                out.setLngLatStops = Math.abs(fixed.x - mid.x) < 1e-6 && Math.abs(fixed.y - mid.y) < 1e-6;
                p.trackPointer();
                m.getCanvas().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse', clientX: c.left + 60, clientY: c.top + 70}));
                await wait(50);
                const again = p.getLngLat() ? m.project(p.getLngLat()) : {x: NaN, y: NaN};
                out.trackAgain = Math.abs(again.x - 60) < 1 && Math.abs(again.y - 70) < 1;
                p.remove();
                const frac = m.unproject([100.4, 80.3]);
                const t = q => (q.getElement().style.transform.match(/translate\(([^p]+)px/) || [])[1];
                const round = new mod.Popup({anchor: 'top-left', animate: false}).setLngLat(frac).setText('a').addTo(m);
                const sub = new mod.Popup({anchor: 'top-left', animate: false, subpixelPositioning: true}).setLngLat(frac).setText('b').addTo(m);
                out.round = t(round); out.sub = t(sub);
                out.subpixel = round.getElement().style.transform.startsWith('translate(100px') && Math.abs(parseFloat(t(sub)) - 100.4) < 0.01;
                round.remove(); sub.remove();
            } finally { console.warn = warn; }
            out.warns = warns.filter(w => w.includes('Popup'));
            return out;
        });
        check('[main] maplibre-compat: Popup moves the focus into itself (unless focusAfterOpen is false), closes on a move with closeOnMove, follows the pointer with trackPointer until setLngLat, and places itself on fractions of a pixel with subpixelPositioning (#42)',
            options.focus && options.noFocus && options.closeOnMove && options.hiddenFirst && options.follows && options.noClicks && options.setLngLatStops && options.trackAgain && options.subpixel && !options.warns.length, JSON.stringify(options));
        // A camera animation of one second: with "reduce motion" the map is there at once; `essential: true` keeps the animation.
        const keys = await page.evaluate(async () => {
            const m = window.a11yMap, c = m.getCanvas(), out = {};
            const press = async (key, shiftKey) => { c.dispatchEvent(new KeyboardEvent('keydown', {key, shiftKey, bubbles: true})); await new Promise(r => setTimeout(r, 450)); };
            m.jumpTo({center: [0, 0], bearing: 0, pitch: 0});
            await press('ArrowRight', true); out.bearing = Math.round(m.getBearing()); out.center = m.getCenter().lng;
            await press('ArrowUp', true); out.pitch = Math.round(m.getPitch());
            await press('ArrowLeft', true); out.back = Math.round(m.getBearing());
            m.jumpTo({bearing: 0, pitch: 0}); await press('ArrowRight', false); out.panned = m.getCenter().lng > 1 && m.getBearing() === 0;
            m.jumpTo({center: [0, 0]});
            return out;
        });
        check('[main] Shift with an arrow key rotates and pitches the map; an arrow key alone pans it', keys.bearing === 15 && Math.abs(keys.center) < 1e-6 && keys.pitch === 10 && keys.back === 0 && keys.panned, JSON.stringify(keys));
        const zoomSoon = async options => page.evaluate(async options => { const m = window.a11yMap; m.jumpTo({zoom: 2}); await new Promise(r => setTimeout(r, 200)); m.easeTo({zoom: 4, duration: 1000, ...options}); await new Promise(r => setTimeout(r, 250)); return m.getZoom(); }, options);
        const moving = await zoomSoon({});
        await page.emulateMedia({reducedMotion: 'reduce'});
        const reduced = await zoomSoon({}), essential = await zoomSoon({essential: true});
        await page.emulateMedia({reducedMotion: null});
        await page.evaluate(() => { window.a11yMap.remove(); window.a11yEl.remove(); });
        check('[main] the canvas has the role and the name of a map, and the frame of the map shows the keyboard focus', before.role === 'region' && before.label === 'Map' && !before.outline && /2px solid/.test(focused) && !blurred, JSON.stringify({before, focused, blurred}));
        check('[main] a marker with a popup is a button that Enter and the space bar work; the fullscreen button says what it does',
            marker.label === 'Map marker' && marker.role === 'button' && marker.tab === 0 && marker.plainRole === null && marker.plainTab === null && marker.open && marker.closed && marker.fullscreen === 'Enter fullscreen' && marker.title === 'Enter fullscreen' && marker.pressed === 'false', JSON.stringify(marker));
        const focus = await page.evaluate(() => window.a11yFocus);
        check('[main] the focus goes into a popup that the keyboard opens, and back to the marker when the popup closes', focus.focusIn && focus.focusBack && focus.focusClick && focus.focusLink && focus.focusSkips && focus.opacity === '1' && focus.scroll === 'true,0,0' && focus.closed, JSON.stringify(focus));
        check('[main] a camera animation jumps with "reduce motion", but for essential: true', moving < 3.9 && reduced === 4 && essential < 3.9, JSON.stringify({moving, reduced, essential}));
    }
    // A click on a draggable marker fires no drag events, and a drag fires dragstart only after the pointer moves, with
    // no click after it, as in MapLibre GL JS (#258). A click fires `click` on the marker before the map's (#676).
    if (mode === 'main') {
        await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = window.dragEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:1000'}));
            const m = window.dragMap = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const mk = new mod.Marker({draggable: true}).setLngLat(m.unproject({x: 200, y: 150})).addTo(m);
            window.markerEvents = [];
            for (const t of ['dragstart', 'drag', 'dragend']) mk.on(t, () => window.markerEvents.push(t));
            mk.on('click', e => window.markerEvents.push('marker click' + (e.originalEvent && e.target === mk ? '' : '!')));
            mk.getElement().addEventListener('click', () => window.markerEvents.push('click'));
            // #198: the marker has a popup, and another popup with closeOnClick is open.
            (window.popup198 = new mod.Popup({offset: 40}).setText('Marker')), mk.setPopup(window.popup198); // (the offset keeps the popup off the marker)
            m.on('click', () => window.markerEvents.push('map click'));
            await new Promise(r => m.once('load', r));
            window.otherPopup = new mod.Popup().setLngLat(m.unproject({x: 50, y: 50})).setText('Other').addTo(m);
            await new Promise(r => setTimeout(r, 100));
        });
        const box = await page.evaluate(() => { const r = window.dragEl.querySelector('.map-jr-marker').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
        await page.mouse.click(box.x, box.y);
        await page.waitForTimeout(500); // (a map `click` of the compat entry can wait up to 300 ms for the features, and the popup opens after it)
        const click = await page.evaluate(() => window.markerEvents.splice(0).join(' '));
        const afterClick = await page.evaluate(() => ({other: window.otherPopup.isOpen()}));
        afterClick.own = await page.evaluate(() => window.popup198.isOpen());
        await page.mouse.click(box.x, box.y); // closes the popup of the marker again
        await page.waitForTimeout(400);
        await page.evaluate(() => window.markerEvents.splice(0));
        await page.mouse.move(box.x, box.y); await page.mouse.down();
        await page.mouse.move(box.x + 1, box.y);
        const early = await page.evaluate(() => window.markerEvents.join(' '));
        await page.mouse.move(box.x + 30, box.y + 20, {steps: 5}); await page.mouse.up();
        await page.waitForTimeout(100);
        await page.waitForTimeout(300);
        const popupAfterDrag = await page.evaluate(() => window.popup198.isOpen());
        const drag = await page.evaluate(() => { const ev = window.markerEvents.join(' '); window.dragMap.remove(); window.dragEl.remove(); return ev; });
        check('[main] a click on a draggable marker fires click on the marker and the map and no drag events, and a drag starts after a move and fires no click', ['marker click map click click', 'click marker click map click'].includes(click) && early === '' && /^dragstart( drag)+ dragend$/.test(drag), JSON.stringify({click, early, drag}));
        check('[main] a click on a marker toggles its popup and is a click of the map that closes a closeOnClick popup; a drag does not open the popup (#198)', afterClick.own && !afterClick.other && !popupAfterDrag, JSON.stringify({afterClick, popupAfterDrag}));
    }
    // A marker in a container scaled by CSS follows the pointer, and the 3 px threshold is in CSS pixels of the map
    // (#234): at scale(0.5), 2 screen pixels are 4 map pixels, and a move of (30, 20) on the screen is (60, 40) on the map.
    if (mode === 'main') {
        await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = window.dragEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:1000;transform:scale(0.5);transform-origin:0 0'}));
            const m = window.dragMap = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const mk = window.dragMarker = new mod.Marker({draggable: true}).setLngLat(m.unproject({x: 200, y: 150})).addTo(m);
            window.markerEvents = [];
            mk.on('dragstart', () => window.markerEvents.push('dragstart'));
            await new Promise(r => m.once('load', r));
        });
        const box = await page.evaluate(() => { const r = window.dragMarker.getElement().getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
        await page.mouse.move(box.x, box.y); await page.mouse.down();
        await page.mouse.move(box.x + 2, box.y);
        const early = await page.evaluate(() => window.markerEvents.join(' '));
        await page.mouse.move(box.x + 30, box.y + 20, {steps: 5}); await page.mouse.up();
        await page.waitForTimeout(100);
        // (The marker moves on the map and the map does not pan, so the centre of the map stays at [0, 0].)
        const at = await page.evaluate(() => { const m = window.dragMap, p = m.project(window.dragMarker.getLngLat()), c = m.getCenter(); m.remove(); window.dragEl.remove(); return [p.x, p.y, Math.abs(c.lng) + Math.abs(c.lat)]; });
        check('[main] a marker dragged in a container scaled by CSS follows the pointer, with the threshold in map pixels', early === 'dragstart' && Math.abs(at[0] - 260) < 1.5 && Math.abs(at[1] - 190) < 1.5 && at[2] < 1e-6, JSON.stringify({early, at}));
    }
    // The credits of a small map: they do not go under the controls of the other corner, markers are below them, and a
    // press on the map closes them.
    if (mode === 'main') {
        const box = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = window.creditsEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:390px;height:300px;z-index:1000'}));
            const m = window.creditsMap = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            m.addControl(new mod.AttributionControl({customAttribution: '© Mapterhorn | OpenFreeMap © OpenMapTiles Data from OpenStreetMap contributors and more'}), 'top-left');
            m.addControl(new mod.NavigationControl({showCompass: false}), 'top-right');
            const marker = new mod.Marker().setLngLat(m.unproject({x: 150, y: 40})).addTo(m);
            await new Promise(r => { m.once('idle', r); setTimeout(r, 2000); });
            await new Promise(r => setTimeout(r, 100));
            const credits = el.querySelector('.map-jr-ctrl-attrib'), a = credits.getBoundingClientRect(), n = el.querySelector('.map-jr-ctrl-group').getBoundingClientRect();
            return {open: credits.classList.contains('map-jr-compact-show'), creditsRight: Math.round(a.right), controlsLeft: Math.round(n.left), markerZ: +getComputedStyle(marker.getElement()).zIndex, cornerZ: +getComputedStyle(credits.parentElement).zIndex};
        });
        const isOpen = () => page.evaluate(() => window.creditsEl.querySelector('.map-jr-ctrl-attrib').classList.contains('map-jr-compact-show'));
        await page.mouse.click(200, 220); // a press on the map, with no drag: MapLibre keeps the credits open
        await page.waitForTimeout(200);
        const afterClick = await isOpen();
        await page.mouse.move(200, 220); await page.mouse.down(); await page.mouse.move(240, 240, {steps: 5}); await page.mouse.up();
        await page.waitForTimeout(200);
        const closed = !await isOpen();
        await page.evaluate(() => { window.creditsMap.remove(); window.creditsEl.remove(); });
        check('[main] the credits of a small map end before the controls of the other corner, are above markers, stay open after a click and close with a drag (#263)',
            box.open && box.creditsRight < box.controlsLeft && box.markerZ < box.cornerZ && afterClick && closed, JSON.stringify({...box, afterClick, closed}));
        // As in MapLibre: the "i" button is placed absolutely inside the compact credits, so page CSS on `button` does
        // not move it out of the box, closed or open, in either bottom corner (#263).
        const placed = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const css = document.head.appendChild(Object.assign(document.createElement('style'), {textContent: 'button{position:static;margin:40px;float:left;display:inline-block}'}));
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:390px;height:300px;z-index:1000'}));
            const m = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: []}});
            const out = [];
            for (const corner of ['bottom-right', 'bottom-left']) {
                const c = new mod.AttributionControl({compact: true, customAttribution: '© Example contributors'});
                m.addControl(c, corner);
                const box = el.querySelector('.map-jr-ctrl-attrib'), b = box.querySelector('.map-jr-ctrl-attrib-button');
                for (const open of [false, true]) {
                    box.classList.toggle('map-jr-compact-show', open);
                    const r = box.getBoundingClientRect(), q = b.getBoundingClientRect();
                    out.push({corner, open, inside: q.width > 0 && q.left >= r.left - 1 && q.right <= r.right + 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1, atRight: Math.abs(q.right - r.right) < 1.5});
                }
                m.removeControl(c);
            }
            m.remove(); el.remove(); css.remove();
            return out;
        });
        check('[main] page CSS on button does not move the "i" button of the compact credits out of their box (#263)', placed.every(p => p.inside && p.atRight), JSON.stringify(placed));
        // As in MapLibre: a source used only by hidden layers or outside the zoom range of its layers gives no credit,
        // and a blank attribution gives no box (#263).
        const credits = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:800px;height:300px'}));
            const fc = a => ({type: 'geojson', attribution: a, data: {type: 'FeatureCollection', features: []}});
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8,
                sources: {shown: fc('Shown'), hidden: fc('Hidden'), far: fc('Far'), unused: fc('Unused'), blank: fc(' ')},
                layers: [{id: 's', type: 'circle', source: 'shown'}, {id: 'h', type: 'circle', source: 'hidden', layout: {visibility: 'none'}}, {id: 'f', type: 'circle', source: 'far', minzoom: 10}, {id: 'b', type: 'circle', source: 'blank'}]}});
            await new Promise(r => { m.once('idle', r); setTimeout(r, 3000); });
            const text = el.querySelector('.map-jr-ctrl-attrib-inner').textContent;
            m.setLayoutProperty('s', 'visibility', 'none');
            await new Promise(r => setTimeout(r, 300)); m.triggerRepaint(); await new Promise(r => { m.once('idle', r); setTimeout(r, 2000); });
            const box = el.querySelector('.map-jr-ctrl-attrib'), shown = box.style.display !== 'none' && box.getBoundingClientRect().width > 0;
            m.remove(); el.remove();
            return {text, shown};
        });
        check('[main] the credits list only sources of visible layers at the current zoom, and a blank attribution shows no box (#263)', credits.text === 'Shown' && !credits.shown, JSON.stringify(credits));
    }
    // The four corners of the controls exist as soon as the map is made, as in MapLibre GL JS (#200), and the attribution
    // is the lowest control of the bottom-right corner, also below a control that the app added at once (#202).
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:500px;height:300px'}));
            const m = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'].every(p => el.querySelector(`.maplibregl-ctrl-${p}.map-jr-ctrl-${p}`));
            m.addControl(new mod.NavigationControl(), 'bottom-right');
            await new Promise(r => m.once('load', r));
            const first = el.querySelector('.map-jr-ctrl-bottom-right').firstElementChild?.className ?? '';
            m.remove(); el.remove();
            return {corners, first};
        });
        check('[main] the four control corners exist at once, and the attribution is the lowest control of its corner', r.corners && r.first.includes('ctrl-attrib'), JSON.stringify(r));
    }
    // #46: as in MapLibre GL JS, the element of getCanvasContainer() carries the state names of dragPan and touchZoomRotate.
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:300px;height:200px'}));
            const m = new mod.Map({container: el, renderer: 'main', touchZoomRotate: false, style: {version: 8, sources: {}, layers: []}});
            const c = m.getCanvasContainer(), has = n => c.classList.contains('maplibregl-' + n);
            const out = [has('touch-drag-pan'), has('touch-zoom-rotate')];
            m.dragPan.disable(); m.touchZoomRotate.enable();
            out.push(has('touch-drag-pan'), has('touch-zoom-rotate'));
            m.remove(); out.push(has('touch-zoom-rotate')); el.remove();
            return out.join();
        });
        check('[main] maplibre-compat: the canvas container has maplibregl-touch-drag-pan and maplibregl-touch-zoom-rotate while those handlers are enabled (#46)', r === 'true,false,false,true,false', r);
    }
    // #16, #42: dragging the compass rotates the map, and a click resets the bearing, as in MapLibre GL JS. In the compat
    // entry, the compass shows and changes the pitch only with visualizePitch: true (MapLibre's default is false). The
    // drag is made with the mouse and, with visualizePitch, with touch events.
    if (mode === 'main') {
        const compass = async (visualizePitch, touch) => {
            await page.evaluate(async visualizePitch => {
                const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
                const el = window.compassEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:500px;height:300px;z-index:9'}));
                const m = window.compassMap = new mod.Map({container: el, renderer: 'main', attributionControl: false, center: [0, 0], zoom: 2, pitch: 20, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
                m.addControl(new mod.NavigationControl(visualizePitch === undefined ? {} : {visualizePitch}), 'top-right');
                await new Promise(r => m.once('load', r));
            }, visualizePitch);
            const box = await page.evaluate(() => { const r = window.compassEl.querySelector('.maplibregl-ctrl-compass').getBoundingClientRect(); return {x: r.left + r.width / 2, y: r.top + r.height / 2}; });
            const center = await page.evaluate(() => window.compassMap.getCenter().lng);
            if (touch) {
                const cdp = await page.context().newCDPSession(page);
                const t = (type, x, y) => cdp.send('Input.dispatchTouchEvent', {type, touchPoints: type === 'touchEnd' ? [] : [{x, y}]});
                await t('touchStart', box.x, box.y);
                for (let i = 1; i <= 6; i++) await t('touchMove', box.x + i * 8, box.y - i * 4);
                await t('touchEnd'); await cdp.detach();
            } else {
                await page.mouse.move(box.x, box.y); await page.mouse.down();
                for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + i * 8, box.y - i * 4);
                await page.mouse.up();
            }
            const dragged = await page.evaluate(() => { const m = window.compassMap; return {bearing: m.getBearing(), pitch: m.getPitch(), lng: m.getCenter().lng, needle: m.getContainer().querySelector('.maplibregl-ctrl-compass svg').style.transform}; });
            dragged.panned = Math.abs(dragged.lng - center) > 1e-6;
            await page.waitForTimeout(100);
            await page.mouse.click(box.x, box.y); await page.waitForTimeout(1200);
            const clicked = await page.evaluate(() => { const m = window.compassMap, r = {bearing: m.getBearing(), pitch: m.getPitch()}; m.remove(); window.compassEl.remove(); return r; });
            return {dragged, clicked};
        };
        let r = await compass(undefined, false);
        check('[main] compat: without visualizePitch, dragging the compass only rotates, the needle shows no pitch, and a click resets only the bearing', Math.abs(r.dragged.bearing) > 1 && Math.abs(r.dragged.pitch - 20) < 0.01 && !r.dragged.panned && r.dragged.needle.startsWith('rotateX(0deg)') && Math.abs(r.clicked.bearing) < 0.01 && Math.abs(r.clicked.pitch - 20) < 0.01, JSON.stringify(r));
        r = await compass(true, false);
        check('[main] compat: with visualizePitch, dragging the compass rotates and pitches the map, and a click resets both', Math.abs(r.dragged.bearing) > 1 && r.dragged.pitch > 21 && !r.dragged.panned && Math.abs(r.clicked.bearing) < 0.01 && r.clicked.pitch < 0.01, JSON.stringify(r));
        if (browserName === 'chromium') {
            r = await compass(true, true);
            check('[main] compat: a touch drag on the compass rotates and pitches the map without panning it', Math.abs(r.dragged.bearing) > 1 && r.dragged.pitch > 21 && !r.dragged.panned, JSON.stringify(r));
        } else skip('[main] compat: a touch drag on the compass rotates and pitches the map without panning it', noCDP);
    }
    // #557: a rotate drag (the right mouse button, or Ctrl with the left one) turns the map of the compat entry as it
    // turns MapLibre GL JS (served at /ml/): the same way and by the same angle, at five heights of the map. Two fingers
    // that turn (Chromium only) do the same. test/host.mjs has the same drags for the main API.
    try {
        const make = kind => page.evaluate(async ([kind, renderer]) => {
            const style = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]};
            const el = window.turnEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:9'}));
            if (kind === 'ml') {
                const ml = await import('/ml/maplibre-gl.mjs');
                ml.setWorkerUrl(new URL('/ml/maplibre-gl-worker.mjs', location.href).href);
                window.turnMap = new ml.Map({container: el, style, center: [0, 0], zoom: 2, attributionControl: false});
            } else {
                const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
                window.turnMap = new mod.Map({container: el, renderer, style, center: [0, 0], zoom: 2, attributionControl: false});
            }
            await new Promise(r => window.turnMap.once('load', r));
        }, [kind, mode]);
        const bearing = async () => { await page.waitForTimeout(250); return page.evaluate(() => { const m = window.turnMap, b = m.getBearing(); m.jumpTo({bearing: 0, pitch: 0}); return b; }); };
        const drags = async kind => {
            await make(kind);
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
            if (browserName === 'chromium') {
                // Two fingers 200 pixels apart turn by 40 degrees around the centre of the map, clockwise on the screen.
                const cdp = await page.context().newCDPSession(page);
                const at = deg => [0, 1].map(k => ({id: k, x: 300 + (k ? -100 : 100) * Math.cos(deg * Math.PI / 180), y: 200 + (k ? -100 : 100) * Math.sin(deg * Math.PI / 180)}));
                await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: at(0)});
                for (let d = 2; d <= 40; d += 2) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: at(d)});
                await page.waitForTimeout(250); await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); await cdp.detach();
                out.push(await bearing());
            }
            await page.evaluate(() => { window.turnMap.remove(); window.turnEl.remove(); window.turnMap = undefined; });
            return out.map(b => Math.round(b * 10) / 10);
        };
        const ml = await drags('ml'), compat = await drags('compat');
        check(`[${mode}] compat: a rotate drag with the right button, with Ctrl and the left button${browserName === 'chromium' ? ', and with two fingers' : ''} turns the map the same way and by the same angle as MapLibre GL JS (#557)`,
            ml.length === compat.length && ml.every((b, i) => Math.abs(b) > 10 && Math.abs(b - compat[i]) < 1.5), JSON.stringify({ml, compat}));
        if (browserName !== 'chromium') skip(`[${mode}] compat: a rotate drag with two fingers turns the map as MapLibre GL JS does (#557)`, noCDP);
        // #679: a rotate drag released while it moves turns on with inertia. (The amount depends on the timing of the
        // moves; test/unit/turn-inertia.test.ts compares it with MapLibre GL JS on fixed samples.)
        await make('compat');
        await page.mouse.move(250, 250); await page.mouse.down({button: 'right'});
        for (let i = 1; i <= 10; i++) { await page.mouse.move(250 + i * 10, 250); await page.waitForTimeout(8); }
        const atRelease = await page.evaluate(() => window.turnMap.getBearing());
        await page.mouse.up({button: 'right'});
        await page.waitForTimeout(1500);
        const spun = await page.evaluate(() => { const b = window.turnMap.getBearing(); window.turnMap.remove(); window.turnEl.remove(); window.turnMap = undefined; return b; });
        check(`[${mode}] compat: a rotate drag released while it moves turns on with inertia (#679)`, spun - atRelease > 3, JSON.stringify({atRelease, end: spun}));
    } catch (e) { check(`[${mode}] the rotate drags of #557: the test run was completed`, false, String(e.message).split('\n')[0]); }
    // 3D terrain off and on again: the elevation tiles that are loaded stay, so the relief does not go away for a
    // moment and no tile is asked for again. Elevation tiles need OffscreenCanvas in the workers (#778).
    if (!decodes) skip(`[${mode}] 3D terrain off and on again asks for no elevation tile again, and the ground has its height at once`, 'no OffscreenCanvas in workers');
    else {
        const asked = [];
        let done = 0;
        const count = r => { if (r.url().includes('tiles.mapterhorn.com')) asked.push(r.url()); };
        const ended = r => { if (r.url().includes('tiles.mapterhorn.com')) done++; };
        page.on('request', count); page.on('requestfinished', ended); page.on('requestfailed', ended);
        await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = window.flashEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
            const m = window.flashMap = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [7.6586, 45.9763], zoom: 12.4, pitch: 60, style: {version: 8,
                sources: {dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}, {id: 'relief', type: 'hillshade', source: 'dem'}], terrain: {source: 'dem', exaggeration: 1.5}}});
            window.flashIdle = () => new Promise(r => { m.once('idle', () => r(true)); setTimeout(() => r(false), 20000); });
            await window.flashIdle();
        }, mode);
        await page.waitForTimeout(500);
        // (`idle` does not wait for the coarse overview tiles. A tile that is still on its way when the terrain goes off
        // is cancelled, and it is asked for again later: the test starts when no tile is on its way.)
        for (let i = 0; i < 100 && done < asked.length; i++) await page.waitForTimeout(100);
        const first = asked.length;
        const toggled = await page.evaluate(async () => {
            const m = window.flashMap, out = {};
            m.setTerrain(null);
            out.off = await window.flashIdle(); out.ground = m.queryTerrainElevation?.([7.6586, 45.9763]) ?? null;
            m.setTerrain({source: 'dem', exaggeration: 1.5});
            out.on = await window.flashIdle();
            await new Promise(r => setTimeout(r, 300));
            out.elevation = Math.round(m.getCenterElevation?.() ?? NaN);
            const el = m.getContainer(); m.remove(); el.remove();
            return out;
        });
        page.off('request', count); page.off('requestfinished', ended); page.off('requestfailed', ended);
        check(`[${mode}] 3D terrain off and on again asks for no elevation tile again, and the ground has its height at once`,
            first > 0 && asked.length === first && toggled.off && toggled.on && toggled.elevation > 1000, JSON.stringify({first, later: asked.length - first, ...toggled}));
    }
    // fragment moves the map.
    const hash = await page.evaluate(async () => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
        const before = location.hash;
        location.hash = '#12/40.71/-74.01/30';
        const m = new mod.Map({container: el, style: {version: 8, sources: {}, layers: []}, hash: true, zoom: 3, center: [0, 0], bounds: [[7, 45], [9, 47]]});
        await new Promise(r => m.once('load', r));
        const start = [m.getZoom(), m.getCenter().lat, m.getCenter().lng, m.getBearing()];
        m.jumpTo({center: [2.5, 48.25], zoom: 5, bearing: 0});
        await new Promise(r => setTimeout(r, 600));
        const written = location.hash;
        location.hash = '#6/10/20';
        await new Promise(r => setTimeout(r, 600));
        const moved = [m.getZoom(), m.getCenter().lat, m.getCenter().lng];
        m.remove(); el.remove();
        history.replaceState(history.state, '', location.href.replace(/(#.*)?$/, before));
        return {start, written, moved};
    });
    // A map with `hash` that is removed before the file of the hash has loaded does not listen to the fragment (#22).
    const lateHash = await page.evaluate(async () => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:400px;height:300px'}));
        const add = window.addEventListener;
        let listeners = 0;
        window.addEventListener = function (type, ...rest) { if (type === 'hashchange') listeners++; return add.call(this, type, ...rest); };
        new mod.Map({container: el, style: {version: 8, sources: {}, layers: []}, hash: 'late', zoom: 3, center: [0, 0]}).remove();
        await new Promise(r => setTimeout(r, 1000));
        window.addEventListener = add;
        el.remove();
        return listeners;
    });
    check(`[${mode}] a map with the hash option that is removed at once does not listen to the URL`, lateHash === 0, `${lateHash} listeners`);
    // The option `bounds` of the constructor: the map starts with that area in view, whatever `center` and `zoom` say.
    const fitted = await page.evaluate(async mode => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:50'}));
        const m = new mod.Map({container: el, style: {version: 8, sources: {}, layers: []}, renderer: mode, center: [0, 0], zoom: 1, bounds: [[7, 45], [9, 47]], fitBoundsOptions: {padding: 20}});
        await new Promise(r => m.once('load', r));
        const b = m.getBounds(), out = {zoom: +m.getZoom().toFixed(2), centre: [+m.getCenter().lng.toFixed(2), +m.getCenter().lat.toFixed(2)], inside: b.getWest() < 7 && b.getEast() > 9 && b.getSouth() < 45 && b.getNorth() > 47};
        m.remove(); el.remove();
        return out;
    }, mode);
    check(`[${mode}] the bounds option of the constructor sets the first view`, fitted.inside && fitted.zoom > 6 && fitted.zoom < 8.5 && Math.abs(fitted.centre[0] - 8) < 0.05, JSON.stringify(fitted));
    check(`[${mode}] the hash option reads and writes the camera in the URL`, hash.start.join() === '12,40.71,-74.01,30' && hash.written === '#5/48.25/2.5' && hash.moved.join() === '6,10,20', JSON.stringify(hash));

    // Image tiles (raster, elevation) are not geometry: a change of zoom or of the style must not send them to be built
    // again as vector tiles (that gave "Unsupported protobuf wire type" errors).
    const imageErrors = await page.evaluate(async () => {
        const m = window.map, seen = [];
        m.on('error', e => seen.push(String(e.error?.message ?? e.error)));
        m.jumpTo({center: [7.70, 45.99], zoom: 11.2, pitch: 0, bearing: 0});
        m.addLayer({id: 'test-relief', type: 'hillshade', source: 'dem'});
        await new Promise(r => m.once('idle', r));
        m.jumpTo({zoom: 11.7});
        await new Promise(r => setTimeout(r, 1200));
        m.setPaintProperty('test-relief', 'hillshade-exaggeration', 0.3);
        await new Promise(r => setTimeout(r, 1200));
        m.removeLayer('test-relief');
        return seen;
    });
    if (decodes) check(`[${mode}] image tiles are not built again as geometry`, imageErrors.length === 0, imageErrors.slice(0, 2).join(' | '));

    // #568: a `color-relief` layer colours the ground by its elevation. The view is around the Matterhorn, where all the
    // ground is above 1000 m: the ramp is red up to 1000 m and blue from 1001 m.
    if (decodes) {
        const relief = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:200px'}));
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [7.6586, 45.9763], zoom: 12.4, style: {version: 8,
                sources: {dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'terrarium', tileSize: 512, maxzoom: 12}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}},
                    {id: 'relief', type: 'color-relief', source: 'dem', paint: {'color-relief-color': ['interpolate', ['linear'], ['elevation'], 0, '#f00', 1000, '#f00', 1001, '#00f', 9000, '#00f']}}]}});
            const idle = () => new Promise(r => { m.once('idle', () => r(true)); setTimeout(() => r(false), 20000); });
            const centre = async () => { const bmp = await createImageBitmap(await m.toBlob()), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height})).getContext('2d'); c.drawImage(bmp, 0, 0); return [...c.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data].slice(0, 3); };
            const out = {idle: await idle()};
            out.full = await centre();
            m.setPaintProperty('relief', 'color-relief-opacity', 0.5);
            await idle();
            out.half = await centre();
            m.remove(); el.remove();
            return out;
        }, mode);
        check(`[${mode}] a color-relief layer colours the ground by its elevation, with color-relief-opacity`, relief.idle && relief.full.join() === '0,0,255' && Math.abs(relief.half[0] - 128) < 3 && Math.abs(relief.half[1] - 128) < 3 && relief.half[2] === 255, JSON.stringify(relief));
    }

    // #590: `encoding: 'custom'` of a `raster-dem` source. With the factors 0 and `baseShift: -500`, every elevation is
    // 500 m, whatever the tiles hold (read as `mapbox`, these tiles give elevations far above 1000 m). A
    // `color-relief-color` with one stop draws the colour of the stop. With two stops at one elevation it draws one of
    // the two colours (the expression of the style decides which one), and not a colour that the division by the
    // distance of zero between the stops makes.
    if (decodes) {
        const custom = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:200px'}));
            const ramp = (...stops) => ['interpolate', ['linear'], ['elevation'], ...stops];
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [7.6586, 45.9763], zoom: 12.4, style: {version: 8,
                sources: {dem: {type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], encoding: 'custom', redFactor: 0, greenFactor: 0, blueFactor: 0, baseShift: -500, tileSize: 512, maxzoom: 12}},
                layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}},
                    {id: 'relief', type: 'color-relief', source: 'dem', paint: {'color-relief-color': ramp(0, '#f00', 1000, '#f00', 1001, '#00f', 9000, '#00f')}}]}});
            const idle = () => new Promise(r => { m.once('idle', () => r(true)); setTimeout(() => r(false), 20000); });
            const centre = async () => { const bmp = await createImageBitmap(await m.toBlob()), c = (typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height})).getContext('2d'); c.drawImage(bmp, 0, 0); return [...c.getImageData(bmp.width >> 1, bmp.height >> 1, 1, 1).data].slice(0, 3).join(); };
            const out = {idle: await idle()};
            out.custom = await centre();
            out.elevation = await m.queryElevation([7.6586, 45.9763], {source: 'dem'});
            const colour = async stops => { m.setPaintProperty('relief', 'color-relief-color', stops); await idle(); return centre(); };
            out.one = await colour(ramp(300, '#0f0'));
            out.below = await colour(ramp(400, '#f00', 400, '#0f0'));
            out.at = await colour(ramp(500, '#f00', 500, '#0f0'));
            out.above = await colour(ramp(600, '#f00', 600, '#0f0'));
            m.remove(); el.remove();
            return out;
        }, mode);
        check(`[${mode}] a raster-dem source with encoding 'custom' gives its elevations from the factors and the shift`, custom.idle && custom.custom === '255,0,0' && custom.elevation === 500, JSON.stringify(custom));
        // A factor that is not a finite number: the engine warns one time for the source (also when the style is set
        // again) and reads the source as `mapbox`, so it gives the elevation of a source without `encoding`.
        const told = [], listen = m => { if (m.type() === 'warning' && m.text().includes('"redFactor"')) told.push(m.text()); };
        page.on('console', listen);
        const wrong = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:200px'}));
            const dem = more => ({type: 'raster-dem', tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'], tileSize: 512, maxzoom: 12, ...more});
            const style = () => ({version: 8, sources: {wrong: dem({encoding: 'custom', redFactor: '2', baseShift: 5}), plain: dem({})},
                layers: [{id: 'hills', type: 'hillshade', source: 'wrong'}]});
            const m = new mod.Map({container: el, renderer: mode, attributionControl: false, center: [7.6586, 45.9763], zoom: 12.4, style: style()});
            const idle = () => new Promise(r => { m.once('idle', () => r(true)); setTimeout(() => r(false), 20000); });
            const out = {idle: await idle()};
            m.setStyle(style());
            await idle();
            out.wrong = await m.queryElevation([7.6586, 45.9763], {source: 'wrong'});
            out.plain = await m.queryElevation([7.6586, 45.9763], {source: 'plain'});
            m.remove(); el.remove();
            return out;
        }, mode);
        await page.waitForTimeout(100);
        page.off('console', listen);
        check(`[${mode}] a factor of encoding 'custom' that is not a finite number gives one warning and the mapbox encoding`, wrong.idle && told.length === 1 && told[0].startsWith('[map-jr-gl] The source "wrong": ') && Number.isFinite(wrong.wrong) && wrong.wrong === wrong.plain, JSON.stringify({wrong, told}));
        check(`[${mode}] a color-relief layer with one stop, or two stops at one elevation, draws the colour of a stop`, custom.one === '0,255,0' && [custom.below, custom.at, custom.above].every(c => c === '255,0,0' || c === '0,255,0'), JSON.stringify(custom));
    }

    // A tile of the deepest level of its source has only the labels of the layers that show near the zoom of the map.
    // When the map goes to a much higher zoom, the tile is built again and the labels of the other layers come.
    // (The labels are found in the image: with the layer hidden, the image is another.)
    await page.evaluate(async () => {
        const m = window.map;
        m.jumpTo({center: [-74.0065, 40.7085], zoom: 14.3, pitch: 0, bearing: 0});
        m.addLayer({id: 'test-deep', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 17, layout: {'text-field': ['get', 'name'], 'text-size': 14, 'text-allow-overlap': true}, paint: {'text-color': '#f00'}});
        await Promise.race([new Promise(r => m.once('idle', r)), new Promise(r => setTimeout(r, 8000))]);
        m.jumpTo({zoom: 17.3});
    });
    // (The image without the layer first; then, with the layer, the image must become another. A slow machine gets time.)
    const part = {x: 200, y: 150, width: 600, height: 400};
    await page.evaluate(() => window.map.setLayoutProperty('test-deep', 'visibility', 'none'));
    await idle(page).catch(() => {}); await page.waitForTimeout(1500);
    const without = await page.screenshot({clip: part});
    await page.evaluate(() => window.map.setLayoutProperty('test-deep', 'visibility', 'visible'));
    let came = false;
    for (let i = 0; i < 24 && !came; i++) { await page.waitForTimeout(500); came = !(await page.screenshot({clip: part})).equals(without); }
    await page.evaluate(() => window.map.removeLayer('test-deep'));
    check(`[${mode}] labels of a layer for high zooms come after a zoom far past the deepest tiles`, came);
    check(`[${mode}] no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
  } catch (err) {
    // A browser that stops the run (a timeout, a feature that is not there) is reported as one failure.
    check(`[${mode}] the test run was completed`, false, String(err.message).split('\n')[0]);
  }
}
// (The checks below run with RENDERER=main.)
if (only === 'worker') { await browser.close(); process.exit(failed ? 1 : 0); }

// The compat Map with a style that has a null source and a null layer: each is reported, the rest loads, and the methods
// that read the raw style do not throw (#653).
{
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    await page.goto(origin + '/?renderer=main&nomarkers');
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    const r = await page.evaluate(async () => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
        const errors = [], thrown = [];
        const onError = e => thrown.push(String(e.message ?? e.reason));
        addEventListener('error', onError); addEventListener('unhandledrejection', onError);
        const m = new mod.Map({container: el, renderer: 'main', attributionControl: false,
            style: {version: 8, sources: {a: null, b: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'bg', type: 'background'}, null]}});
        m.on('error', e => errors.push(e.error?.message));
        const loaded = await new Promise(r => { m.once('load', () => r(true)); setTimeout(() => r(false), 10000); });
        let order, removed;
        try { order = m.getLayersOrder(); m.removeSource('b'); removed = !m.getSource('b'); } catch (e) { thrown.push(String(e)); }
        removeEventListener('error', onError); removeEventListener('unhandledrejection', onError);
        m.remove(); el.remove();
        return {loaded, errors, thrown, order, removed};
    });
    check('[main] compat Map: a null source and a null layer are reported, the style loads, and getLayersOrder and removeSource work',
        r.loaded && r.thrown.length === 0 && r.errors.length === 2 && r.errors.every(t => t?.startsWith('[map-jr-gl]')) && JSON.stringify(r.order) === '["bg"]' && r.removed, JSON.stringify(r));
    await page.close();
}
// remove() on a map whose WebGL context is lost does not lose it a second time: WebKit reports that as an error (#776).
{
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    // (Every call of loseContext() on the page is counted, and those on a context that is already lost.)
    await page.addInitScript(() => {
        const calls = window.loseCalls = {all: 0, whileLost: 0}, get = WebGL2RenderingContext.prototype.getExtension;
        WebGL2RenderingContext.prototype.getExtension = function (name) {
            const ext = get.call(this, name), gl = this;
            if (ext && name === 'WEBGL_lose_context' && !ext.counted) {
                const lose = ext.loseContext.bind(ext);
                ext.loseContext = () => { calls.all++; if (gl.isContextLost()) calls.whileLost++; lose(); };
                ext.counted = true;
            }
            return ext;
        };
    });
    await page.goto(origin + '/?renderer=main&nomarkers');
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    const calls = await page.evaluate(async () => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
        const m = new mod.Map({container: el, renderer: 'main', attributionControl: false, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
        await new Promise(r => { m.once('load', r); setTimeout(r, 10000); });
        const gl = m.getCanvas().getContext('webgl2'), before = {...window.loseCalls};
        gl.getExtension('WEBGL_lose_context').loseContext();
        const lost = gl.isContextLost();
        // (The map starts again on a new canvas after a moment, and remove() then loses that new context.)
        await new Promise(r => setTimeout(r, 300));
        m.remove(); el.remove();
        await new Promise(r => setTimeout(r, 300));
        return {lost, all: window.loseCalls.all - before.all, whileLost: window.loseCalls.whileLost - before.whileLost};
    });
    check('[main] after a lost WebGL context the map does not call loseContext() on the lost context, and remove() loses the new one', calls.lost && calls.whileLost === 0 && calls.all === 2, JSON.stringify(calls));
    await page.close();
}
// 3D terrain: the camera is kept above the ground as MapLibre GL JS 6.17 keeps it (#1480, #1486). A pitch drag and a rotate
// drag keep the pitch and the zoom that they edit (the centre's height rises instead), and a jumpTo whose camera would be
// inside a cone solves the pitch and the zoom again. (The MapLibre values were measured with the same terrain.)
{
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    await page.goto(origin + '/?renderer=main&nomarkers');
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    const open = kind => page.evaluate(async ([kind]) => {
        const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
        // A plateau 3000 m high that starts 3 km south of the centre, or a cone 4000 m high with a radius of 6 km.
        const heightAt = kind === 'plateau' ? (lng, lat) => Math.max(0, Math.min(3000, (-lat * 110540 - 3000) * 1.5))
            : (lng, lat) => Math.max(0, 4000 * (1 - Math.hypot(lng * 111320 * Math.cos(lat * Math.PI / 180), (lat + 0.0747) * 110540) / 6000));
        try { mod.removeProtocol('dem1480'); } catch { /* not added yet */ }
        mod.addProtocol('dem1480', async request => {
            const [z, x, y] = request.url.slice(10).split('/').map(Number), n = 2 ** z, c = new OffscreenCanvas(256, 256), g = c.getContext('2d'), img = g.createImageData(256, 256);
            for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
                const mx = (x + (i + 0.5) / 256) / n, my = (y + (j + 0.5) / 256) / n, lat = 360 / Math.PI * Math.atan(Math.exp((180 - my * 360) * Math.PI / 180)) - 90;
                const v = heightAt(mx * 360 - 180, lat) + 32768, k = (j * 256 + i) * 4;
                img.data[k] = Math.floor(v / 256); img.data[k + 1] = Math.floor(v) % 256; img.data[k + 2] = Math.floor((v % 1) * 256); img.data[k + 3] = 255;
            }
            g.putImageData(img, 0, 0);
            return {data: await (await c.convertToBlob()).arrayBuffer()};
        });
        window.liftEl?.remove(); window.liftMap?.remove();
        const el = window.liftEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:800px;height:600px;z-index:9'}));
        const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['dem1480://{z}/{x}/{y}'], tileSize: 256, encoding: 'terrarium', maxzoom: 14}},
            layers: [{id: 'bg', type: 'background', paint: {'background-color': '#9c9'}}], terrain: {source: 'dem', exaggeration: 1}};
        const m = window.liftMap = new mod.Map({container: el, renderer: 'main', style, center: [0, 0], zoom: 13, pitch: 0, maxPitch: 85, attributionControl: false});
        await new Promise(r => m.once('load', r));
    }, [kind]);
    const settle = () => page.evaluate(() => new Promise(r => { const t = setTimeout(r, 4000); window.liftMap.once('idle', () => { clearTimeout(t); setTimeout(r, 700); }); window.liftMap.triggerRepaint(); }));
    const snap = () => page.evaluate(() => [window.liftMap.getZoom(), window.liftMap.getPitch()].map(v => +v.toFixed(3)));
    try {
        await open('plateau');
        await page.evaluate(() => window.liftMap.jumpTo({pitch: 60})); await settle();
        await page.mouse.move(400, 300); await page.mouse.down({button: 'right'});
        for (let i = 1; i <= 30; i++) { await page.mouse.move(400, 300 - i * 6); await page.waitForTimeout(50); }
        const dragged = await snap();
        await page.mouse.up({button: 'right'});
        check('[main] 3D terrain: a pitch drag over a plateau keeps the zoom and reaches the maximum pitch, as in MapLibre GL JS (#1480)', dragged[0] === 13 && dragged[1] > 84.9, JSON.stringify(dragged));
        await open('plateau');
        await page.evaluate(() => window.liftMap.jumpTo({pitch: 72, bearing: 120})); await settle();
        await page.mouse.move(100, 300); await page.mouse.down({button: 'right'});
        for (let i = 1; i <= 30; i++) { await page.mouse.move(100 + i * 20, 300); await page.waitForTimeout(40); }
        await page.mouse.up({button: 'right'}); await settle();
        const turned = await snap();
        check('[main] 3D terrain: a rotate drag over a plateau keeps the pitch and the zoom, as in MapLibre GL JS (#1480)', turned[0] === 13 && turned[1] === 72, JSON.stringify(turned));
        await open('cone');
        await page.evaluate(() => window.liftMap.jumpTo({pitch: 75})); await settle();
        const cone = await snap();
        check('[main] 3D terrain: jumpTo with the camera inside a cone solves the pitch and the zoom as MapLibre GL JS does (64.349, 12.9003; #1486)', Math.abs(cone[0] - 12.9003) < 0.05 && Math.abs(cone[1] - 64.349) < 1, JSON.stringify(cone));
    } catch (e) { check('[main] 3D terrain: the checks of the camera above the ground ran (#1480)', false, String(e.message).split('\n')[0]); }
    await page.close();
}
// 3D terrain: `idle` waits for the raster tiles that only the pictures of the ground draw (#1493). Those tiles answer
// after 1.5 s, which is more than the half second for which an incomplete picture held `idle` back before. One tile
// fails, and `idle` still comes.
for (const mode of renderers) {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    await page.goto(origin + `/?renderer=${mode}&nomarkers`);
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    try {
        const got = await page.evaluate(async ([mode]) => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const png = async colour => { const c = new OffscreenCanvas(256, 256), g = c.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, 256, 256); return (await c.convertToBlob()).arrayBuffer(); };
            const flat = await png('rgb(128,0,0)'), red = await png('#f00');
            const state = window.state1493 = {asked: 0, answered: 0, failed: 0};
            for (const p of ['dem1493', 'slow1493']) try { mod.removeProtocol(p); } catch { /* not added yet */ }
            mod.addProtocol('dem1493', async () => ({data: flat.slice(0)}));
            mod.addProtocol('slow1493', async request => {
                const n = ++state.asked;
                await new Promise(r => setTimeout(r, 1500));
                // (One tile of the view fails: it must not hold `idle` back for ever.)
                if (n === 2) { state.failed++; state.answered++; throw new Error('tile 1493 failed'); }
                state.answered++;
                return {data: red.slice(0)};
            });
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:600px;height:400px;z-index:9'}));
            const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['dem1493://{z}/{x}/{y}'], tileSize: 256, encoding: 'terrarium', maxzoom: 12},
                r: {type: 'raster', tiles: ['slow1493://{z}/{x}/{y}'], tileSize: 256}},
                layers: [{id: 'r', type: 'raster', source: 'r'}], terrain: {source: 'dem', exaggeration: 1}};
            const m = new mod.Map({container: el, renderer: mode, style, center: [10, 45], zoom: 13, pitch: 60, attributionControl: false});
            m.on('error', () => {});
            const start = performance.now();
            const idle = await new Promise(r => { m.once('idle', () => r(true)); setTimeout(() => r(false), 20000); });
            const at = {idle, ms: Math.round(performance.now() - start), asked: state.asked, answered: state.answered, failed: state.failed};
            m.remove(); el.remove();
            return at;
        }, [mode]);
        check(`[${mode}] 3D terrain: idle waits for the raster tiles of the ground pictures, and a tile that fails does not hold it back (#1493)`, got.idle && got.asked > 1 && got.failed === 1 && got.answered === got.asked, JSON.stringify(got));
    } catch (e) { check(`[${mode}] 3D terrain: the check of idle and the tiles of the ground pictures ran (#1493)`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
// A lost WebGL context when the style came from a URL in another folder. The relative URLs of the style still belong
// to that folder after the restart, and a source that is loaded says so before the tiles of the other sources are there.
{
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    const style = (await (await fetch(origin + '/style.json')).text()).replaceAll(origin + '/tiles/', 'rel/');
    const paths = [];
    let wait = 0;
    // (Patterns for the path only: the address of the page names the style as well.)
    await page.route(u => u.pathname === '/elsewhere/style.json', r => r.fulfill({contentType: 'application/json', body: style}));
    await page.route(u => /^\/(elsewhere\/)?rel\//.test(u.pathname), async r => {
        const u = new URL(r.request().url());
        paths.push(u.pathname);
        if (!u.pathname.startsWith('/elsewhere/')) return r.fulfill({status: 404, body: ''}).catch(() => {});
        // (The page can close while a slow tile waits here; the request is then gone, and that is not a fault.)
        try {
            const response = await r.fetch({url: origin + u.pathname.replace('/elsewhere/rel/', '/tiles/')});
            await new Promise(res => setTimeout(res, wait)); // after the restart the tiles are slow, so that the map is not idle at once
            await r.fulfill({response});
        } catch {}
    });
    await page.goto(origin + '/?renderer=main&nomarkers&style=/elsewhere/style.json');
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    const before = paths.length;
    wait = 500;
    const lost = await page.evaluate(async () => {
        const m = window.map;
        m.addSource('here', {type: 'geojson', data: {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: m.getCenter().toArray()}}});
        m.addLayer({id: 'here', type: 'circle', source: 'here'});
        await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
        let restored = false, atRestored, early = false, idle = false;
        m.on('webglcontextrestored', () => { restored = true; atRestored = m.isSourceLoaded('omt'); m.once('idle', () => idle = true); });
        m.getCanvas().getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
        for (let i = 0; i < 600 && !idle; i++) { await new Promise(r => setTimeout(r, 25)); early ||= restored && !m.areTilesLoaded() && !m.isSourceLoaded('omt') && m.isSourceLoaded('here'); }
        return {restored, idle, atRestored, early, loaded: m.isSourceLoaded('omt')};
    });
    const after = paths.slice(before), wrong = after.filter(p => !p.startsWith('/elsewhere/'));
    check('[main] a lost WebGL context: the tiles of a style from another folder are still requested from that folder', lost.restored && lost.idle && after.length > 0 && !wrong.length, `${after.length} requests, wrong: ${wrong.slice(0, 2).join(' ') || 'none'}`);
    check('[main] a lost WebGL context: no source is loaded at the restart, and a GeoJSON source is loaded before the tiles of the others', lost.atRestored === false && lost.early && lost.loaded, JSON.stringify(lost));
    await page.close();
}

// Hydration: server markup is visible before the client runs, then replaced once the canvas shows the same view.
const page = await browser.newPage({viewport: {width: 1000, height: 700}});
await page.route('**/dist/map-jr-gl-maplibre-compat.js', async r => { await new Promise(res => setTimeout(res, 800)); r.continue(); });
await page.goto(`${origin}/ssr`, {waitUntil: 'domcontentloaded'});
check('[ssr] server SVG is in the initial HTML', await page.evaluate(() => !!document.querySelector('#map > svg[data-map-jr-ssr]')));
await page.screenshot({path: `${out}/ssr-before.png`});
await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
await page.waitForTimeout(300);
check('[ssr] SVG removed after the client takes over', await page.evaluate(() => !document.querySelector('[data-map-jr-ssr]') && !!document.querySelector('#map > canvas')));
await page.screenshot({path: `${out}/ssr-after.png`});
const preloads = await page.evaluate(() => document.querySelectorAll('link[rel=preload]').length);
check('[ssr] tile preload links emitted', preloads > 0, `${preloads} links`);
// (Chromium on 2026-11-19 printed 218 results with RENDERER=main and 160 with RENDERER=worker.)
tally((renderers.includes('main') ? 196 : 0) + (renderers.includes('worker') ? 146 : 0));
await browser.close();
process.exit(failed ? 1 : 0);
