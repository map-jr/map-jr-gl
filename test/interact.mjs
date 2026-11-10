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

    await page.evaluate(() => { window.map.setPaintProperty('water', 'fill-color', '#e88'); });
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
        const added = !!document.querySelector('.maplibregl-ctrl-top-left #third-party');
        window.map.removeControl(control);
        return {added, removed: !document.getElementById('third-party'), zoom: window.map.getZoom()};
    });
    check(`[${mode}] zoom control and third-party control contract`, Math.abs(ctl.zoom - zBefore - 1) < 0.01 && ctl.added && ctl.removed, JSON.stringify(ctl));

    // A drag whose button is released where the page cannot see it must not leave the map stuck to the cursor.
    await page.mouse.move(500, 400); await page.mouse.down(); await page.mouse.move(520, 420, {steps: 3});
    await page.evaluate(() => window.map.getCanvas().dispatchEvent(new PointerEvent('pointermove', {pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 530, clientY: 430, bubbles: true})));
    await settle(page);
    const c1 = await page.evaluate(() => window.map.getCenter());
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
    check(`[${mode}] no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await page.close();
}

// Hydration: server markup is visible before the client runs, then replaced once the canvas shows the same view.
const page = await browser.newPage({viewport: {width: 1000, height: 700}});
await page.route('**/dist/tessera.js', async r => { await new Promise(res => setTimeout(res, 800)); r.continue(); });
await page.goto('http://localhost:8080/ssr', {waitUntil: 'domcontentloaded'});
check('[ssr] server SVG is in the initial HTML', await page.evaluate(() => !!document.querySelector('#map > svg[data-tessera-ssr]')));
await page.screenshot({path: `${out}/ssr-before.png`});
await page.waitForFunction(() => window.mapLoaded, null, {timeout: 30000});
await page.waitForTimeout(300);
check('[ssr] SVG removed after the client takes over', await page.evaluate(() => !document.querySelector('[data-tessera-ssr]') && !!document.querySelector('#map > canvas')));
await page.screenshot({path: `${out}/ssr-after.png`});
const preloads = await page.evaluate(() => document.querySelectorAll('link[rel=preload]').length);
check('[ssr] tile preload links emitted', preloads > 0, `${preloads} links`);
await browser.close();
process.exit(failed ? 1 : 0);
