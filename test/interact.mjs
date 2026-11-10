// Drives the demo in Chromium and checks behaviour in both renderer modes: node test/interact.mjs <outDir>
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
const out = process.argv[2];
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
let failed = 0, mainFrames = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };
const settle = (page) => page.waitForFunction(() => !window.map.isMoving(), null, {polling: 100}).then(() => page.waitForTimeout(150));
const idle = (page) => page.evaluate(() => new Promise(r => window.map.once('idle', r)));

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
    await page.waitForTimeout(300);
    await settle(page);
    const z = await page.evaluate(() => window.map.getZoom());
    const p = await page.evaluate(a => window.map.project(a), anchor);
    check(`[${mode}] wheel zooms in around cursor`, z > 15.5 && Math.hypot(p.x - 700, p.y - 200) < 1.5, `zoom=${z.toFixed(2)} drift=${Math.hypot(p.x - 700, p.y - 200).toFixed(2)}px`);

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
    else check('[worker] keeps animating while the main thread is blocked', frames >= 5 && frames > mainFrames * 3, `${frames} frames vs ${mainFrames} on the main thread`);

    await page.evaluate(() => { window.map.setPaintProperty('water', 'fill-color', '#e88'); });
    await idle(page);
    await page.waitForTimeout(300);
    await page.screenshot({path: `${out}/restyle-${mode}.png`});
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
