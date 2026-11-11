// Drives the demo in Chromium and checks behaviour in both renderer modes: node test/interact.mjs <outDir>
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
const out = process.argv[2];
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
let failed = 0, mainFrames = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };
const settle = (page) => page.waitForFunction(() => !window.map.isMoving(), null, {polling: 100}).then(() => page.waitForTimeout(150));
const idle = (page) => page.waitForFunction(() => window.map.areTilesLoaded() && !window.map.isMoving(), null, {polling: 50, timeout: 30000});

for (const mode of ['main', 'worker']) {
    const page = await browser.newPage({viewport: {width: 1000, height: 700}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:8080/?renderer=${mode}`);
    await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
    check(`[${mode}] loads with requested renderer`, await page.evaluate(() => window.map.renderer) === mode);

    // Drag pan: the point under the cursor should follow it.
    const before = await page.evaluate(() => window.map.getCenter());
    await page.mouse.move(500, 350); await page.mouse.down(); await page.mouse.move(400, 300, {steps: 8}); await page.mouse.up();
    await settle(page);
    const after = await page.evaluate(() => window.map.getCenter());
    check(`[${mode}] drag pans east and south`, after.lng > before.lng && after.lat < before.lat, `Δlng=${(after.lng - before.lng).toFixed(5)} Δlat=${(after.lat - before.lat).toFixed(5)}`);

    // Wheel zoom keeps the location under the cursor fixed.
    const anchor = await page.evaluate(() => window.map.unproject({x: 700, y: 200}));
    await page.mouse.move(700, 200); await page.mouse.wheel(0, -500);
    await page.waitForFunction(() => window.map.getZoom() > 14.31, null, {timeout: 10000}).catch(() => {}); // the zoom has started
    await settle(page);
    const z = await page.evaluate(() => window.map.getZoom());
    const p = await page.evaluate(a => window.map.project(a), anchor);
    check(`[${mode}] wheel zooms in around cursor`, z > 14.6 && Math.hypot(p.x - 700, p.y - 200) < 1.5, `zoom=${z.toFixed(2)} drift=${Math.hypot(p.x - 700, p.y - 200).toFixed(2)}px`);

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
    await page.mouse.move(500, 400); await page.mouse.down(); await page.mouse.move(520, 420, {steps: 3});
    await page.evaluate(() => window.map.getCanvas().dispatchEvent(new PointerEvent('pointermove', {pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 530, clientY: 430, bubbles: true})));
    await settle(page);
    // The release may start a short glide; wait until the centre has really stopped changing before comparing.
    const c1 = await page.evaluate(async () => { let c = window.map.getCenter(); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 200)); const n = window.map.getCenter(); if (n.lng === c.lng && n.lat === c.lat) break; c = n; } return c; });
    await page.evaluate(() => window.map.getCanvas().dispatchEvent(new PointerEvent('pointermove', {pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 700, clientY: 600, bubbles: true})));
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
            await new Promise(r => setTimeout(r, 400));
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
    await page.evaluate(() => { window.map.removeLayer('zones-fill'); window.map.removeSource('zones'); });

    // DOM marker and popup with MapLibre's API.
    const dom = await page.evaluate(async () => {
        const {Marker, Popup} = await import('/dist/map-jr-gl.js'), m = window.map;
        const marker = new Marker({color: '#c00'}).setLngLat([-74.0065, 40.7085]).setPopup(new Popup({offset: 30}).setText('Hello')).addTo(m);
        marker.togglePopup();
        const tip = marker.getElement().getBoundingClientRect(), at = m.project([-74.0065, 40.7085]);
        const open = document.querySelector('.maplibregl-popup-content')?.textContent;
        marker.remove();
        await new Promise(r => setTimeout(r, 400)); // the popup plays a short closing animation before it is removed
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
    const fs = await page.evaluate(async () => {
        const m = window.map, f = {source: 'omt', sourceLayer: 'building', id: 1};
        m.setPaintProperty('building', 'fill-color', ['case', ['boolean', ['feature-state', 'hover'], false], '#f00', '#ddd']);
        m.setFeatureState(f, {hover: true}); m.setFeatureState(f, {picked: 1});
        const both = m.getFeatureState(f);
        m.removeFeatureState(f, 'hover');
        const one = m.getFeatureState(f);
        m.removeFeatureState({source: 'omt'});
        await new Promise(r => setTimeout(r, 400));
        return {both, one, none: m.getFeatureState(f)};
    });
    check(`[${mode}] feature state is set, merged and removed`, fs.both.hover === true && fs.both.picked === 1 && !('hover' in fs.one) && fs.one.picked === 1 && Object.keys(fs.none).length === 0, JSON.stringify(fs));

    // GeoJSON clusters: the tiles show one cluster for near points, and the source answers questions about it.
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
    check(`[${mode}] 3D terrain turns on and off, keeping the map centre in the middle`, terrain.on === 'dem' && terrain.off === null && terrain.loaded && terrain.lift > 30 && terrain.roundTrip < 1 && Math.abs(terrain.centre.x - terrain.mid[0]) < 0.5 && Math.abs(terrain.centre.y - terrain.mid[1]) < 0.5, JSON.stringify(terrain));
    await page.screenshot({path: `${out}/terrain-${mode}.png`});
    check(`[${mode}] no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
}

// Hydration: server markup is visible before the client runs, then replaced once the canvas shows the same view.
const page = await browser.newPage({viewport: {width: 1000, height: 700}});
await page.route('**/dist/map-jr-gl.js', async r => { await new Promise(res => setTimeout(res, 800)); r.continue(); });
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
