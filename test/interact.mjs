// Drives the demo in Chromium and checks behaviour in both renderer modes: node test/interact.mjs <outDir>
import {launch, browserName} from './launch.mjs';
const out = process.argv[2];
const browser = await launch();
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
    await page.goto(`http://localhost:8080/?renderer=${mode}`);
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
    const before = await page.evaluate(() => window.map.getCenter());
    await page.mouse.move(500, 350); await page.mouse.down(); await page.mouse.move(400, 300, {steps: 8}); await page.mouse.up();
    await page.waitForFunction(b => window.map.getCenter().lng !== b.lng, before, {timeout: 5000}).catch(() => {}); // the drag has reached the page
    await settle(page);
    const after = await page.evaluate(() => window.map.getCenter());
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

    // Marker hit testing and events.
    const pt = await page.evaluate(() => window.map.project([-74.0060, 40.7127]));
    await page.mouse.move(pt.x, pt.y - 20);
    await page.waitForTimeout(300);
    check(`[${mode}] marker hover sets pointer cursor`, await page.evaluate(() => window.map.getCanvas().style.cursor) === 'pointer');
    await page.screenshot({path: `${out}/hover-${mode}.png`, clip: {x: pt.x - 80, y: pt.y - 90, width: 160, height: 120}});
    await page.mouse.click(pt.x, pt.y - 20);
    check(`[${mode}] marker click reports the marker`, await page.evaluate(() => window.lastMarkerClick) === '3');

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
        const here = await window.map.queryFeatures([-74.0060, 40.7127], {sourceLayers: ['landcover', 'poi'], radius: 12});
        const far = await window.map.queryFeatures([2.2945, 48.8584], {zoom: 14, sourceLayers: ['poi', 'building'], radius: 30, geometry: true});
        const filtered = await window.map.queryFeatures([2.2945, 48.8584], {zoom: 14, radius: 30, filter: ['==', ['get', 'class'], 'no-such-class']});
        const centre = window.map.getCenter();
        const summit = await window.map.queryElevation([7.6586, 45.9763]), sea = await window.map.queryElevation([-74.02, 40.69]);
        return {here: here.map(f => f.sourceLayer), far: far.length, geom: far[0]?.geometry?.type, filtered: filtered.length, summit, sea, moved: centre.lng !== window.map.getCenter().lng};
    });
    check(`[${mode}] queryFeatures finds an undrawn-layer feature under a point`, q.here.includes('landcover') && q.here.includes('poi'), JSON.stringify(q.here));
    check(`[${mode}] queryFeatures works off screen, with geometry and filters`, q.far > 0 && !!q.geom && q.filtered === 0 && !q.moved, `${q.far} features, first ${q.geom}`);
    check(`[${mode}] queryElevation reads the elevation source`, q.summit > 4300 && q.summit < 4500 && Math.abs(q.sea) < 15, `Matterhorn ${q.summit?.toFixed(0)} m, New York harbour ${q.sea?.toFixed(1)} m`);
    const attribution = await page.evaluate(() => document.querySelector('.maplibregl-ctrl-attrib')?.textContent);
    check(`[${mode}] attribution shows © and keeps links`, attribution.includes('©') && !attribution.includes('&copy') && await page.evaluate(() => document.querySelectorAll('.maplibregl-ctrl-attrib a').length) > 0, attribution);
    const img = await page.evaluate(() => window.map.addImage('star', '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="gold"/></svg>').then(() => true, e => String(e)));
    check(`[${mode}] addImage accepts an SVG`, img === true, String(img));

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
        await new Promise(r => m.once('idle', r));
        const inside = m.project([-74.008, 40.7085]), found = await m.queryFeatures(inside, {sources: ['zones']});
        return {inside, found: found.map(f => f.properties.name)};
    });
    await page.screenshot({path: `${out}/geojson-${mode}.png`});
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
        MessagePort.prototype.postMessage = post;
        m.setFeatureState(f, {hover: true}); m.setFeatureState(f, {picked: 1});
        const both = m.getFeatureState(f);
        m.removeFeatureState(f, 'hover');
        const one = m.getFeatureState(f);
        m.removeFeatureState({source: 'omt'});
        await new Promise(r => setTimeout(r, 400));
        return {both, one, none: m.getFeatureState(f), unread, read, idle};
    });
    check(`[${mode}] feature state is set, merged and removed, and the map is idle after a state that no layer reads`, fs.both.hover === true && fs.both.picked === 1 && !('hover' in fs.one) && fs.one.picked === 1 && Object.keys(fs.none).length === 0 && fs.idle, JSON.stringify(fs));
    if (mode === 'main') check('[main] setFeatureState builds tiles again only when a layer of the source reads feature state', fs.unread === 0 && fs.read > 0, JSON.stringify({unread: fs.unread, read: fs.read}));

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
    // The kept network result of a source: new data at the same URL stays after a change of the style, and two maps
    // that are given the same source object both load it.
    {
        const square = JSON.stringify({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-20, -20], [20, -20], [20, 20], [-20, 20], [-20, -20]]]}});
        let body = square;
        await page.route('**/test-kept.json', async r => { await new Promise(res => setTimeout(res, 150)); r.fulfill({contentType: 'application/json', body}); });
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
            const el = a.getContainer(); a.remove(); el.remove();
            return {first: window.keptFirst, fresh, later};
        });
        await page.unroute('**/test-kept.json');
        check(`[${mode}] setData with the same URL: the new data stays after a change of the style and a zoom`, after.first > 0 && after.fresh === 0 && after.later === 0, JSON.stringify(after));
        check(`[${mode}] two maps that are given one source object both load it`, kept.idles.every(Boolean) && kept.drawn.every(n => n > 0), JSON.stringify(kept));
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
    // maplibre-compat does not accept in silence what it cannot do: options with no effect warn, style calls that MapLibre
    // refuses fire `error`, and `strict: true` throws.
    if (mode === 'main') {
        const quiet = await page.evaluate(async () => {
            const mod = await import('/dist/map-jr-gl-maplibre-compat.js'), wait = ms => new Promise(r => setTimeout(r, ms));
            const warnings = [], warn = console.warn;
            console.warn = (...a) => warnings.push(a.join(' '));
            const make = options => { const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'})); return new mod.Map({container: el, renderer: 'main', attributionControl: false, style: {version: 8, sources: {g: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'bg', type: 'background'}]}, ...options}); };
            const m = make({cooperativeGestures: true, locale: {x: 'y'}, projection: {type: 'globe'}, renderWorldCopies: false, canvasContextAttributes: {antialias: true, preserveDrawingBuffer: true}, maxBounds: [[-10, -10], [10, 10]]});
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
            const out = {options, custom, errors, layers: m.getStyle().layers.map(l => l.id).join(), source: !!m.getSource('g'), bounds: m.getMaxBounds()?.toArray()};
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
            quiet.options.length === 5 && ['cooperativeGestures', 'locale', 'projection', 'renderWorldCopies', 'canvasContextAttributes'].every(n => quiet.options.some(w => w.startsWith('[map-jr-gl] The option ' + n))) && quiet.plain.length === 0 && String(quiet.bounds) === '-10,-10,10,10' && quiet.custom.length === 1 && quiet.custom[0].includes('"custom"'), JSON.stringify({options: quiet.options, plain: quiet.plain, bounds: quiet.bounds, custom: quiet.custom}));
        check('[main] maplibre-compat: a layer or source id that exists, a source that is not there, and a source in use fire error and change nothing',
            quiet.errors.length === 4 && /addLayer: the style has a layer with the id "bg"/.test(quiet.errors[0]) && /names the source "nowhere"/.test(quiet.errors[1]) && /addSource: the style has a source with the id "g"/.test(quiet.errors[2]) && /removeSource: the layer "uses-g" uses the source "g"/.test(quiet.errors[3]) && quiet.layers === 'bg,uses-g' && quiet.source, JSON.stringify({errors: quiet.errors, layers: quiet.layers, source: quiet.source}));
        check('[main] maplibre-compat: strict: true throws for an option with no effect and for a refused style call',
            quiet.thrown.startsWith('[map-jr-gl] The option cooperativeGestures has no effect') && /addLayer: the style has a layer with the id "bg"/.test(quiet.thrownCall), JSON.stringify({thrown: quiet.thrown, thrownCall: quiet.thrownCall}));
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

// Hydration: server markup is visible before the client runs, then replaced once the canvas shows the same view.
const page = await browser.newPage({viewport: {width: 1000, height: 700}});
await page.route('**/dist/map-jr-gl-maplibre-compat.js', async r => { await new Promise(res => setTimeout(res, 800)); r.continue(); });
await page.goto('http://localhost:8080/ssr', {waitUntil: 'domcontentloaded'});
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
