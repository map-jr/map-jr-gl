// Drives the demo in Chromium and checks behaviour in both renderer modes: node test/interact.mjs [outDir] (default .cache/shots)
import {launch, browserName} from './launch.mjs';
const out = process.argv[2] || '.cache/shots'; // (the directory for the screenshots; Playwright creates it)
const browser = await launch();
const origin = `http://localhost:${process.env.PORT || 8080}`; // (the demo server; PORT lets two runs use two servers)
let failed = 0, mainFrames = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };
// The map is settled when it does not move and the camera has been the same for a quarter of a second. (A browser
// can report that the mouse was released before the page has handled the events, so `isMoving()` alone can be
// false before a drag and its inertia have started.)
const settle = (page) => page.waitForFunction(() => {
    const m = window.map, c = m.getCenter(), pose = [c.lng, c.lat, m.getZoom(), m.getBearing(), m.getPitch(), m.isMoving()].join();
    if (pose !== window.settlePose) { window.settlePose = pose; window.settleAt = performance.now(); }
    return !m.isMoving() && performance.now() - window.settleAt > 250;
}, null, {polling: 50});
const idle = (page) => page.waitForFunction(() => window.map.areTilesLoaded() && !window.map.isMoving(), null, {polling: 50, timeout: 30000});

for (const mode of ['main', 'worker']) {
  try {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${origin}/?renderer=${mode}`);
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    // Some browsers cannot make a WebGL context in a worker (WebKit on Linux and Windows, Safari before 16.4). The map
    // must then render on the main thread, and the tests of the worker have nothing to test.
    const workerCan = mode !== 'worker' || await page.evaluate(() => new Promise(resolve => {
        const w = new Worker(URL.createObjectURL(new Blob(['postMessage(typeof OffscreenCanvas !== "undefined" && !!new OffscreenCanvas(1, 1).getContext("webgl2"))'])));
        w.onmessage = e => resolve(e.data); w.onerror = () => resolve(false);
    }));
    if (!workerCan) console.log('INFO  [worker] this browser cannot render in a worker: the map must use the main thread');
    check(`[${mode}] loads with requested renderer`, await page.evaluate(() => window.map.renderer) === (workerCan ? mode : 'main'));

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
        await new Promise(r => setTimeout(r, 600));
        const events = [...new Set(seen)];
        m.jumpTo({bearing: 0, pitch: 0});
        await new Promise(r => setTimeout(r, 400));
        return {now, fit, kept, events};
    });
    check(`[${mode}] easeTo and fitBounds with duration 0 apply at once and survive a following jumpTo`, instant.now === 13 && instant.fit > 13 && Math.abs(instant.kept - instant.fit) < 1e-9, JSON.stringify(instant));
    check(`[${mode}] jumpTo fires zoom, rotate and pitch`, ['zoom', 'rotate', 'pitch'].every(t => instant.events.includes(t)), instant.events.join(' '));

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
        const here = await window.map.queryFeatures([-74.0060, 40.7127], {sources, sourceLayers: ['landcover', 'poi'], radius: 12});
        const far = await window.map.queryFeatures([2.2945, 48.8584], {sources, zoom: 14, sourceLayers: ['poi', 'building'], radius: 30, geometry: true});
        const filtered = await window.map.queryFeatures([2.2945, 48.8584], {sources, zoom: 14, radius: 30, filter: ['==', ['get', 'class'], 'no-such-class']});
        // Without `sources`, the same method gives what the style layers draw (#12), as `queryRenderedFeatures` does.
        const c = window.map.getCenter(), at = window.map.project(c), key = f => f.layer.id + ' ' + f.id;
        const drawn = await window.map.queryFeatures(c), same = await window.map.queryRenderedFeatures([at.x, at.y]);
        const wide = await window.map.queryFeatures({x: at.x, y: at.y}, {radius: 40}), box = await window.map.queryRenderedFeatures([[at.x - 40, at.y - 40], [at.x + 40, at.y + 40]]);
        const one = {drawn: drawn.length, layer: typeof drawn[0]?.layer?.id, same: drawn.map(key).join() === same.map(key).join(), wide: wide.length, box: wide.map(key).join() === box.map(key).join(), all: (await window.map.queryFeatures()).length};
        const centre = window.map.getCenter();
        const summit = await window.map.queryElevation([7.6586, 45.9763]), sea = await window.map.queryElevation([-74.02, 40.69]);
        return {one, here: here.map(f => f.sourceLayer), far: far.length, geom: far[0]?.geometry?.type, filtered: filtered.length, summit, sea, moved: centre.lng !== window.map.getCenter().lng};
    });
    check(`[${mode}] queryFeatures finds an undrawn-layer feature under a point`, q.here.includes('landcover') && q.here.includes('poi'), JSON.stringify(q.here));
    check(`[${mode}] queryFeatures without sources gives what the style layers draw, and radius widens the place`,
        q.one.drawn > 0 && q.one.layer === 'string' && q.one.same && q.one.wide > q.one.drawn && q.one.box && q.one.all > q.one.wide, JSON.stringify(q.one));
    check(`[${mode}] queryFeatures works off screen, with geometry and filters`, q.far > 0 && !!q.geom && q.filtered === 0 && !q.moved, `${q.far} features, first ${q.geom}`);
    check(`[${mode}] queryElevation reads the elevation source`, q.summit > 4300 && q.summit < 4500 && Math.abs(q.sea) < 15, `Matterhorn ${q.summit?.toFixed(0)} m, New York harbour ${q.sea?.toFixed(1)} m`);
    const attribution = await page.evaluate(() => document.querySelector('.maplibregl-ctrl-attrib')?.textContent);
    check(`[${mode}] attribution shows © and keeps links`, attribution.includes('©') && !attribution.includes('&copy') && await page.evaluate(() => document.querySelectorAll('.maplibregl-ctrl-attrib a').length) > 0, attribution);
    const img = await page.evaluate(() => window.map.addImage('star', '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="gold"/></svg>').then(() => true, e => String(e)));
    check(`[${mode}] addImage accepts an SVG`, img === true, String(img));
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
        // Waits for an animation to end. A fixed time is not sufficient when software rendering is slow.
        const still = async () => {
            await new Promise(r => setTimeout(r, 400));
            for (let i = 0, quiet = 0, z = window.cam().zoom; i < 40 && quiet < 2; i++) {
                await new Promise(r => setTimeout(r, 150));
                const now = window.cam().zoom;
                quiet = Math.abs(now - z) < 1e-6 && !window.map.isMoving() ? quiet + 1 : 0;
                z = now;
            }
        };
        const tap = async (x, y) => { window.touch('pointerdown', 11, x, y); window.touch('pointerup', 11, x, y); await new Promise(r => setTimeout(r, 60)); };
        await tap(500, 350); await tap(500, 350);
        await still();
        out.doubleTap = window.cam();
        window.touch('pointerdown', 11, 450, 350); window.touch('pointerdown', 12, 550, 350); window.touch('pointerup', 11, 450, 350); window.touch('pointerup', 12, 550, 350);
        await still();
        out.twoFingerTap = window.cam();
        await tap(500, 350);
        window.touch('pointerdown', 11, 500, 350);
        for (let y = 350; y <= 450; y += 10) { window.touch('pointermove', 11, 500, y); await new Promise(r => setTimeout(r, 16)); }
        window.touch('pointerup', 11, 500, 450);
        await still();
        out.tapDrag = window.cam();
        return out;
    });
    check(`[${mode}] touch: pinch zooms without rotating on a slight twist`, Math.abs(t.pinch.zoom - 15) < 0.05 && t.pinch.bearing === 0 && t.smallTwist.bearing === 0, JSON.stringify([t.pinch, t.smallTwist]));
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
        const inside = m.project([-74.008, 40.7085]), found = await m.queryFeatures(inside, {sources: ['zones']});
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
        return (await m.queryFeatures([-74.008, 40.7085], {sources: ['zones'], radius: 5})).map(f => f.type + ':' + f.properties.name);
    });
    check(`[${mode}] GeoJSON source, layer click event and setData`, gj.found[0] === 'first' && JSON.stringify(await page.evaluate(() => window.zoneClicks)) === '["first"]' && gj2[0] === 'Point:second', JSON.stringify({found: gj.found, clicks: await page.evaluate(() => window.zoneClicks), after: gj2}));
    await page.waitForFunction(() => window.arrayEvents.some(e => e.startsWith('click:')), null, {timeout: 5000}).catch(() => {});
    const arrayEvents = await page.evaluate(() => window.arrayEvents.join());
    check(`[${mode}] on, once and off with an array of layer ids; a wrong argument gives a message`, arrayEvents === 'message,enter,click:first', arrayEvents);
    // MapLibre's updateData: add, change and remove features of a GeoJSON source by their id.
    const diff = await page.evaluate(async () => {
        const m = window.map, source = m.getSource('zones'), point = (id, name, lng) => ({type: 'Feature', id, properties: {name}, geometry: {type: 'Point', coordinates: [lng, 40.7085]}});
        await source.setData({type: 'FeatureCollection', features: [point(1, 'one', -74.008), point(2, 'two', -74.006)]});
        source.updateData({add: [point(3, 'three', -74.004)], remove: [2], update: [{id: 1, addOrUpdateProperties: [{key: 'name', value: 'changed'}], newGeometry: {type: 'Point', coordinates: [-74.007, 40.7085]}}]});
        const data = await m.getSource('zones').getData();
        await new Promise(r => setTimeout(r, 600));
        const drawn = (await m.queryFeatures([-74.007, 40.7085], {sources: ['zones'], radius: 5})).map(f => f.properties.name);
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
            const drawn = (await m.queryFeatures([-74.008, 40.7085], {sources: ['zones'], radius: 5})).map(f => f.properties.name);
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
        const names = async () => (await m.queryFeatures([-74.008, 40.7085], {sources: ['same'], radius: 5})).map(f => f.properties.name).join();
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
        const {Marker, Popup} = await import('/dist/map-jr-gl-maplibre-compat.js'), m = window.map;
        const marker = new Marker({color: '#c00'}).setLngLat([-74.0065, 40.7085]).setPopup(new Popup({offset: 30}).setText('Hello')).addTo(m);
        marker.togglePopup();
        const tip = marker.getElement().getBoundingClientRect(), at = m.project([-74.0065, 40.7085]);
        const open = document.querySelector('.maplibregl-popup-content')?.textContent;
        marker.remove();
        // The popup plays a short closing animation before it is removed. (A slow machine can take longer than the animation.)
        for (let i = 0; i < 30 && document.querySelector('.maplibregl-marker, .maplibregl-popup'); i++) await new Promise(r => setTimeout(r, 100));
        return {dx: Math.abs((tip.left + tip.right) / 2 - at.x), dy: Math.abs(tip.bottom - at.y), open, gone: !document.querySelector('.maplibregl-marker, .maplibregl-popup')};
    });
    check(`[${mode}] DOM Marker and Popup`, dom.dx < 1 && dom.dy < 1 && dom.open.startsWith('Hello') && dom.gone, JSON.stringify(dom));

    // A PMTiles archive as a vector source, read by range requests.
    const pm = await page.evaluate(async () => {
        const m = window.map;
        m.addSource('admin', {type: 'vector', url: 'pmtiles://https://tiles.whatismyelevation.com/2025-state-county-zip.pmtiles'});
        m.addLayer({id: 'counties', type: 'line', source: 'admin', 'source-layer': 'county_features', paint: {'line-color': '#70c', 'line-width': 2}});
        // Adding the source first fetches the archive's header, so poll until the source answers queries.
        for (let i = 0; i < 40; i++) {
            const found = await m.queryFeatures([-74.0065, 40.7085], {sources: ['admin'], sourceLayers: ['county_features']});
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
        m.setFeatureState(f, {hover: true});
        await wait(600);
        const read = rebuilds - edit;
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
        return {both, one, none: m.getFeatureState(f), unread, read, idle, sent};
    });
    check(`[${mode}] feature state is set, merged and removed, and the map is idle after a state that no layer reads`, fs.both.hover === true && fs.both.picked === 1 && !('hover' in fs.one) && fs.one.picked === 1 && Object.keys(fs.none).length === 0 && fs.idle, JSON.stringify(fs));
    if (mode === 'main') check('[main] setFeatureState builds tiles again only when a layer of the source reads feature state', fs.unread === 0 && fs.read > 0, JSON.stringify({unread: fs.unread, read: fs.read}));
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
        m.removeLayer('asked'); m.removeSource('asked');
        return out;
    });
    check(`[${mode}] queryRenderedFeatures: a point, a box, all layers (top layer first), a filter; querySourceFeatures`,
        rendered.point.join() === '7' && rendered.layer === 'asked' && rendered.geometry === 'Point' && rendered.box.join() === '7,8' && rendered.all > 10 && rendered.top === 'asked' && rendered.filtered.join() === '8' && rendered.source === 2, JSON.stringify(rendered));

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
        for (let i = 0; i < 40 && !found.length; i++) { await new Promise(r => setTimeout(r, 100)); found = await m.queryFeatures(c, {sources: ['grouped'], radius: 10}); }
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
            const counts = async () => { const out = []; for (let i = 0; i < 8; i++) out.push((await m.queryFeatures([0, 0], {sources: ['v'], radius: 5})).length, (await m.queryRenderedFeatures({layers: ['a']})).length); return out; };
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
    {
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
                m = new mod.Map({container: el, center: [0, 0], zoom: 1, attributionControl: false, logoPosition: 'top-left', validate: false, style: {version: 8, sources: {}, layers: []}});
                for (let i = 0; i < 2; i++) {
                    new mod.NavigationControl({visualizePitch: true});
                    new mod.FullscreenControl({container: document.body});
                    m.flyTo({center: [1, 1], speed: 2, curve: 1.2, duration: 0});
                    m.easeTo({center: [0, 0], offset: [0, -150], easing: t => t, duration: 0});
                }
            } finally { console.warn = warn; }
            m.remove(); el.remove();
            const names = ['logoPosition', 'validate', 'visualizePitch', 'container', 'speed and curve', 'offset', 'easing'];
            return Object.fromEntries(names.map(n => [n, warns.filter(w => w.startsWith('[map-jr-gl]') && w.includes(n)).length]));
        });
        check('maplibre-compat: logoPosition, validate, visualizePitch, the container of FullscreenControl and speed/curve of flyTo, offset and easing of easeTo each warn once (#43)',
            Object.values(r).every(n => n === 1), JSON.stringify(r));
    }
    // #208: fitBounds warns once for speed, curve and linear; Marker takes offset as {x, y}; getImage gives RGBA pixels.
    if (mode === 'main') {
        const r = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const warns = [], warn = console.warn;
            console.warn = (...a) => { warns.push(String(a[0])); };
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:100px;height:100px'}));
            const out = {};
            let m;
            try {
                m = new mod.Map({container: el, center: [0, 0], zoom: 1, attributionControl: false, style: {version: 8, sources: {}, layers: []}});
                for (let i = 0; i < 2; i++) m.fitBounds([[-1, -1], [1, 1]], {speed: 2, curve: 1, linear: true, duration: 0});
                out.fit = warns.filter(w => w.startsWith('[map-jr-gl]') && w.includes('fitBounds')).length;
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
            } finally { console.warn = warn; }
            m.remove(); el.remove();
            return out;
        });
        check('maplibre-compat: fitBounds speed/curve/linear warn once, Marker offset {x, y}, getImage returns RGBA pixels',
            r.fit === 1 && r.offset?.x === 3 && r.offset?.y === -4 && r.raw?.join('|') === '2|1|true|255,0,0,255,0,255,0,128'
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
            return page.evaluate(async b64 => { const img = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob()); const c = new OffscreenCanvas(1, 1).getContext('2d'); c.drawImage(img, 1, 1, 1, 1, 0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3).join(); }, shot.toString('base64'));
        };
        const two = {a: await colour('pair-a'), b: await colour('pair-b'), stateA: await page.evaluate(() => JSON.stringify(window.pair[0].getFeatureState({source: 'g', id: 1})))};
        await page.evaluate(() => { for (const m of window.pair) { const el = m.getContainer(); m.remove(); el.remove(); } });
        check(`[${mode}] two maps with the same source name keep their own feature state and global state`, two.a === '255,0,0' && two.b === '0,255,0' && two.stateA === '{}', JSON.stringify(two));
    }
    // A source or a style that fails: the map reports it with an `error` event and goes on with the rest.
    {
        const errorsBefore = errors.length;
        const failed = await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            // (A map that never starts does not answer a query: the test must not wait for ever.)
            const count = query => Promise.race([query.then(found => found.length), wait(4000).then(() => -1)]);
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
            removeEventListener('unhandledrejection', onRejection);
            for (const x of [a, b, c]) { x.m.remove(); x.el.remove(); }
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
        // (The browser writes its own line to the console for each 404 that this test asks for.)
        for (let i = errors.length; i-- > errorsBefore;) if (errors[i].startsWith('Failed to load resource')) errors.splice(i, 1);
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
        await page.unroute('**/test-255.json'); await page.unroute(/\/t255[abc]\//);
        check(`[${mode}] raster source: setTiles and setUrl load tiles from the new URLs, and a wrong argument gives a message`,
            r.a && r.b && r.c && r.same && r.url === '/test-255.json' && !r.tiles && r.message.startsWith('[map-jr-gl] getSource("r").setTiles'), JSON.stringify(r));
    }
    // The coarse overview tiles (zoom 11 for a view at zoom 14.3) are not drawn while the tiles of the view are there.
    // Their arrival does not place the labels again: the map fires no second `idle`, and before the first `idle` it
    // does not wait for another placement.
    {
        let late = 0;
        const slow = async r => { await new Promise(res => setTimeout(res, 2000)); late++; r.continue(); };
        await page.route('**/tiles/11/**', slow);
        await page.evaluate(async mode => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:1000px;height:700px'}));
            // (A view with many labels: their fade keeps frames coming after the overview is requested.)
            const m = new mod.Map({container: el, renderer: mode, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14.3, attributionControl: false});
            window.overview = {m, el, idles: 0};
            m.on('idle', () => window.overview.idles++);
            await new Promise(r => { m.once('idle', r); setTimeout(r, 15000); });
        }, mode);
        for (let i = 0; i < 100 && !late; i++) await page.waitForTimeout(100);
        await page.waitForTimeout(1500); // (the tiles arrive and are built, and a frame would place the labels)
        const idles = await page.evaluate(() => { const {m, el, idles} = window.overview; m.remove(); el.remove(); return idles; });
        await page.unroute('**/tiles/11/**', slow);
        check(`[${mode}] the overview tiles arrive after the first idle: no second idle`, late > 0 && idles === 1, `idle events=${idles}, late tiles=${late}`);
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
    // A worker that cannot make a WebGL2 context: the map goes to the main thread, `load` and `idle` fire, and what the
    // page sent before the fall back (the rules for requests, a change of the style) is not lost.
    if (mode === 'worker') {
        const fell = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:300px;height:200px'}));
            const code = `const get = OffscreenCanvas.prototype.getContext; OffscreenCanvas.prototype.getContext = function (kind, ...rest) { return /webgl/.test(kind) ? null : get.call(this, kind, ...rest); }; importScripts(${JSON.stringify(location.origin + '/dist/map-jr-gl-worker.js')});`;
            const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
            const seen = [], asked = [], warn = console.warn;
            console.warn = () => {}; // (the map says that it uses the main thread)
            const m = new mod.Map({container: el, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14, attributionControl: false, createWorker: () => new Worker(url),
                transformRequest: (u, kind) => { asked.push(kind); return {url: u}; }});
            for (const type of ['load', 'idle', 'error']) m.on(type, () => seen.push(type));
            // A change of the style at once: it goes to the worker that fails.
            m.once('style.load', () => m.addLayer({id: 'fall-back-test', type: 'background', paint: {'background-color': '#f0f', 'background-opacity': 0.01}}));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 12000); });
            console.warn = warn;
            const out = {renderer: m.renderer, seen: [...new Set(seen)], tiles: asked.filter(k => k === 'Tile').length, layer: (await Promise.race([m.queryRenderedFeatures({layers: ['building']}), new Promise(r => setTimeout(() => r([]), 4000))])).length};
            m.remove(); el.remove();
            return out;
        });
        check('[worker] a worker without WebGL2: the map uses the main thread, load and idle fire, and transformRequest sees the tile requests',
            fell.renderer === 'main' && fell.seen.includes('load') && fell.seen.includes('idle') && !fell.seen.includes('error') && fell.tiles > 0 && fell.layer > 0, JSON.stringify(fell));
    }
    // The same with the engine chunk delayed by 6 seconds, on a page of its own (the chunk is not in its module cache).
    // The watch of the worker must not count while the chunk loads: one warning, no `webglcontextlost`, one canvas.
    if (mode === 'worker') {
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
            const m = new mod.Map({container: el, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14, attributionControl: false, createWorker: () => new Worker(url)});
            for (const type of ['load', 'idle', 'error', 'webglcontextlost']) m.on(type, () => seen.push(type));
            await new Promise(r => { m.once('idle', r); setTimeout(r, 20000); });
            await new Promise(r => setTimeout(r, 2000));
            console.warn = warn;
            const out = {renderer: m.renderer, seen: [...new Set(seen)], warnings: warnings.filter(w => /using the main thread/.test(w)).length, canvases: el.querySelectorAll('canvas').length};
            m.remove(); el.remove();
            return out;
        });
        await slowContext.close();
        check('[worker] a worker without WebGL2 and an engine chunk that takes 6 seconds: one engine on the main thread, one warning, and no webglcontextlost',
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
    if (mode === 'worker') {
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
                const m = new mod.Map({container: el, style: '/style.json', center: [-74.0065, 40.7085], zoom: 14, attributionControl: false,
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
                    waited: Math.round(secondLoss - firstLoss), toMain: Math.round(toMain), loaded: m.areTilesLoaded(), layer: (await Promise.race([m.queryRenderedFeatures({layers: ['building']}), new Promise(r => setTimeout(() => r([]), 4000))])).length};
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
            const m = make({cooperativeGestures: true, locale: {x: 'y'}, projection: {type: 'globe'}, renderWorldCopies: false, canvasContextAttributes: {antialias: true, preserveDrawingBuffer: true}, center: [50, 50], zoom: 3, maxBounds: [[-10, -10], [10, 10]]});
            // The view is inside maxBounds directly after the constructor, before the engine reports the camera (MapLibre GL JS 6.17 gives [1.2109, 3.4573]).
            const clamped = m.getCenter().toArray();
            const options = warnings.splice(0), errors = [];
            m.on('error', e => errors.push(e.error.message));
            await new Promise(r => m.once('load', r));
            m.addLayer({id: 'custom', type: 'custom', render() {}});
            const custom = warnings.splice(0);
            m.addLayer({id: 'bg', type: 'background'});
            m.addLayer({id: 'lost', type: 'fill', source: 'nowhere'});
            m.addSource('g', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
            m.addLayer({id: 'uses-g', type: 'fill', source: 'g'});
            m.removeSource('g');
            await wait(300);
            const out = {options, custom, errors, layers: m.getStyle().layers.map(l => l.id).join(), source: !!m.getSource('g'), bounds: m.getMaxBounds()?.toArray(), clamped, later: m.getCenter().toArray()};
            // The defaults give no warning.
            const plain = make({projection: {type: 'mercator'}, renderWorldCopies: true, canvasContextAttributes: {antialias: false}});
            out.plain = warnings.splice(0);
            let thrown = '';
            try { make({strict: true, cooperativeGestures: true}); } catch (e) { thrown = e.message; }
            const strict = make({strict: true});
            await new Promise(r => strict.once('load', r));
            let thrownCall = '';
            try { strict.addLayer({id: 'bg', type: 'background'}); } catch (e) { thrownCall = e.message; }
            console.warn = warn;
            for (const x of [m, plain, strict]) { const el = x.getContainer(); x.remove(); el.remove(); }
            return {...out, thrown, thrownCall};
        });
        check('[main] maplibre-compat: each option with no effect gives one warning, the defaults give none, and maxBounds works',
            quiet.options.length === 5 && ['cooperativeGestures', 'locale', 'projection', 'renderWorldCopies', 'canvasContextAttributes'].every(n => quiet.options.some(w => w.startsWith('[map-jr-gl] The option ' + n))) && quiet.plain.length === 0 && String(quiet.bounds) === '-10,-10,10,10' && quiet.clamped.every((v, i) => Math.abs(v - [1.2109, 3.4573][i]) < 1e-3) && quiet.later.every((v, i) => Math.abs(v - [1.2109, 3.4573][i]) < 1e-3) && quiet.custom.length === 1 && quiet.custom[0].includes('"custom"'), JSON.stringify({options: quiet.options, plain: quiet.plain, bounds: quiet.bounds, clamped: quiet.clamped, later: quiet.later, custom: quiet.custom}));
        check('[main] maplibre-compat: a layer or source id that exists, a source that is not there, and a source in use fire error and change nothing',
            quiet.errors.length === 4 && /addLayer: the style has a layer with the id "bg"/.test(quiet.errors[0]) && /names the source "nowhere"/.test(quiet.errors[1]) && /addSource: the style has a source with the id "g"/.test(quiet.errors[2]) && /removeSource: the layer "uses-g" uses the source "g"/.test(quiet.errors[3]) && quiet.layers === 'bg,uses-g' && quiet.source, JSON.stringify({errors: quiet.errors, layers: quiet.layers, source: quiet.source}));
        check('[main] maplibre-compat: strict: true throws for an option with no effect and for a refused style call',
            quiet.thrown.startsWith('[map-jr-gl] The option cooperativeGestures has no effect') && /addLayer: the style has a layer with the id "bg"/.test(quiet.thrownCall), JSON.stringify({thrown: quiet.thrown, thrownCall: quiet.thrownCall}));
    }
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
            const gc = new mod.GeolocateControl({trackUserLocation: true});
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
        check('[main] maplibre-compat: GeolocateControl has on/once/trigger() and fires geolocate, error and outofmaxbounds on itself, and warns once for trackUserLocation',
            geo.notAdded === false && geo.triggered === true && geo.events.join() === 'geolocate:true,error:true,outofmaxbounds:true,geolocate:true,off,geolocate:true' && geo.onMap.join() === 'geolocate,error,geolocate,geolocate'
            && geo.warnings.length === 1 && geo.warnings[0].startsWith('[map-jr-gl] GeolocateControl: the option trackUserLocation'), JSON.stringify(geo));
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
            // A click on the marker leaves it where it is. A link in the content comes before the close button.
            const popup = window.a11yMarker.getPopup(), close = popup.getElement().querySelector('button');
            el.focus();
            el.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
            const focusIn = document.activeElement === close;
            close.click();
            await new Promise(r => setTimeout(r, 400));
            const focusBack = document.activeElement === el && !popup.isOpen();
            window.a11yMap.getCanvas().focus();
            el.click();
            const focusClick = document.activeElement === window.a11yMap.getCanvas() && popup.isOpen();
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
        // A camera animation of one second: with "reduce motion" the map is there at once; `essential: true` keeps the animation.
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
    // no click after it, as in MapLibre GL JS (#258).
    if (mode === 'main') {
        await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js');
            const el = window.dragEl = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:400px;height:300px;z-index:1000'}));
            const m = window.dragMap = new mod.Map({container: el, renderer: 'main', center: [0, 0], zoom: 2, style: {version: 8, sources: {}, layers: [{id: 'bg', type: 'background'}]}});
            const mk = new mod.Marker({draggable: true}).setLngLat(m.unproject({x: 200, y: 150})).addTo(m);
            window.markerEvents = [];
            for (const t of ['dragstart', 'drag', 'dragend']) mk.on(t, () => window.markerEvents.push(t));
            mk.getElement().addEventListener('click', () => window.markerEvents.push('click'));
            await new Promise(r => m.once('load', r));
        });
        const box = await page.evaluate(() => { const r = window.dragEl.querySelector('.map-jr-marker').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
        await page.mouse.click(box.x, box.y);
        await page.waitForTimeout(100);
        const click = await page.evaluate(() => window.markerEvents.splice(0).join(' '));
        await page.mouse.move(box.x, box.y); await page.mouse.down();
        await page.mouse.move(box.x + 1, box.y);
        const early = await page.evaluate(() => window.markerEvents.join(' '));
        await page.mouse.move(box.x + 30, box.y + 20, {steps: 5}); await page.mouse.up();
        await page.waitForTimeout(100);
        const drag = await page.evaluate(() => { const ev = window.markerEvents.join(' '); window.dragMap.remove(); window.dragEl.remove(); return ev; });
        check('[main] a click on a draggable marker fires no drag events, and a drag starts after a move and fires no click', click === 'click' && early === '' && /^dragstart( drag)+ dragend$/.test(drag), JSON.stringify({click, early, drag}));
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
    // 3D terrain off and on again: the elevation tiles that are loaded stay, so the relief does not go away for a
    // moment and no tile is asked for again.
    {
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
        const m = new mod.Map({container: el, style: {version: 8, sources: {}, layers: []}, hash: true, zoom: 3, center: [0, 0]});
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
        if (!u.pathname.startsWith('/elsewhere/')) return r.fulfill({status: 404, body: ''});
        const response = await r.fetch({url: origin + u.pathname.replace('/elsewhere/rel/', '/tiles/')});
        await new Promise(res => setTimeout(res, wait)); // after the restart the tiles are slow, so that the map is not idle at once
        return r.fulfill({response});
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
await browser.close();
process.exit(failed ? 1 : 0);
