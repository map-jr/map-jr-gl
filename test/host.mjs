// Tests of the main API (`createMap`, see src/host.ts) in a real browser: node test/host.mjs (demo server running)
import {launch} from './launch.mjs';

const browser = await launch();
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

for (const renderer of ['worker', 'main']) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    try {
        await page.goto('http://localhost:8080/bench'); // (a page of the demo server, for its origin; the benchmark does not start)
        // 1. A map from a description, and its state.
        const start = await page.evaluate(async renderer => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'host', style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const t = window.t = {lib, style, views: [], seen: [], clicks: []};
            t.spec = {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false, onViewChange: v => t.views.push(v)};
            t.host = lib.createMap(el, t.spec);
            t.host.state.subscribe(s => s.loaded, loaded => t.seen.push('loaded:' + loaded));
            t.host.state.subscribe(s => s.view.zoom, zoom => t.seen.push('zoom'));
            const before = t.host.state.get();
            await new Promise(r => t.host.state.subscribe(s => s.idle, idle => idle && r()));
            const s = t.host.state.get();
            return {before: before.loaded, loaded: s.loaded, renderer: s.renderer, zoom: s.view.zoom, seen: t.seen, canvas: !!el.querySelector('canvas')};
        }, renderer);
        check(`[${renderer}] createMap: the map loads, and the state says so`, !start.before && start.loaded && start.renderer === renderer && start.zoom === 14.3 && start.seen.includes('loaded:true') && start.canvas, JSON.stringify(start));

        // 2. The view: the map reports each change; a view that it reported is not applied again; another view moves the map.
        const view = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            t.host.moveTo({zoom: 15, duration: 300});
            for (let i = 0; i < 100 && !(t.host.state.get().view.zoom === 15 && !t.host.state.get().moving); i++) await wait(100); // (a slow machine)
            await wait(300);
            const reported = t.views.length, last = t.views.at(-1), old = t.views[Math.max(0, t.views.length - 4)];
            t.host.update(t.spec = {...t.spec, view: old}); // an application that owns the view gives back an older report
            await wait(300);
            const afterEcho = t.host.state.get().view.zoom;
            t.host.update(t.spec = {...t.spec, view: {center: [-74.0, 40.71], zoom: 13.5, bearing: 20, pitch: 0}});
            await wait(600);
            const s = t.host.state.get().view;
            return {reported, last: last?.zoom, afterEcho, moved: [s.zoom, s.bearing, +s.center[0].toFixed(3)], zoomEvents: t.seen.filter(x => x === 'zoom').length};
        });
        check(`[${renderer}] the view: changes are reported, a reported view is not applied again, a new view moves the map`,
            view.reported > 2 && view.last === 15 && view.afterEcho === 15 && view.moved.join() === '13.5,20,-74' && view.zoomEvents > 2, JSON.stringify(view));

        // 3. A new style object: a layer is added and found by a query; with the old style again it is gone.
        const style = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms));
            const idle = () => new Promise(r => { const off = t.host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 8000); });
            const at = [{x: 0, y: 0}, {x: 900, y: 600}];
            const added = {...t.style, layers: [...t.style.layers, {id: 'test-water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: {'fill-color': '#f00'}}]};
            t.host.update(t.spec = {...t.spec, style: added});
            await wait(200); await idle();
            const withLayer = (await t.host.queryFeatures(at, {layers: ['test-water']})).length;
            t.host.update(t.spec = {...t.spec, style: t.style});
            await wait(200); await idle();
            const without = (await t.host.queryFeatures(at, {layers: ['test-water']})).length;
            const raw = (await t.host.queryFeatures({x: 450, y: 300}, {sources: ['omt'], radius: 30})).length;
            return {withLayer, without, raw};
        });
        check(`[${renderer}] update with a new style: a layer comes and goes, and queries find features`, style.withLayer > 0 && style.without === 0 && style.raw > 0, JSON.stringify(style));

        // 4. Marker layers: added, changed and removed by the description.
        const markers = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), count = () => t.host.map.queryMarkers({x: 450, y: 300}) ? 1 : 0;
            const centre = t.host.unproject({x: 450, y: 300});
            const layer = data => ({id: 'pins', svg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>', width: 24, height: 24, data});
            t.host.update(t.spec = {...t.spec, markers: [layer([{lngLat: centre, props: {color: '#d00'}}])]});
            await wait(700);
            const one = count();
            t.host.update(t.spec = {...t.spec, markers: [layer([{lngLat: [centre[0] + 1, centre[1]], props: {color: '#d00'}}])]});
            await wait(700);
            const moved = count();
            t.host.update(t.spec = {...t.spec, markers: [layer([{lngLat: centre, props: {color: '#00d'}}])]});
            await wait(700);
            const back = count();
            t.host.update(t.spec = {...t.spec, markers: undefined});
            await wait(500);
            return {one, moved, back, none: count()};
        });
        check(`[${renderer}] marker layers follow the description`, markers.one === 1 && markers.moved === 0 && markers.back === 1 && markers.none === 0, JSON.stringify(markers));

        // Controls: added and removed by the description.
        const controls = await page.evaluate(async () => {
            const t = window.t, {navigation, scale} = await import('/dist/controls.js'), count = () => document.querySelectorAll('#host .map-jr-ctrl-group, #host .map-jr-ctrl-scale').length;
            t.host.update(t.spec = {...t.spec, controls: [navigation(), scale({position: 'bottom-left'})]});
            const two = count();
            t.host.update(t.spec = {...t.spec, controls: [navigation(), scale({position: 'bottom-left'})]}); // made again, the same content
            const still = count();
            t.host.update(t.spec = {...t.spec, controls: [scale({position: 'bottom-left'})]});
            const one = count();
            t.host.update(t.spec = {...t.spec, controls: undefined});
            return {two, still, one, none: count()};
        });
        check(`[${renderer}] controls follow the description`, controls.two === 2 && controls.still === 2 && controls.one === 1 && controls.none === 0, JSON.stringify(controls));

        // 5. The features under the pointer, and a click.
        await page.evaluate(() => { const t = window.t; t.host.update(t.spec = {...t.spec, interactiveLayers: ['water', 'park', 'building', 'road'], onClick: e => t.clicks.push(e)}); t.host.state.subscribe(s => s.hover, h => t.seen.push('hover:' + h.length)); });
        let hover = 0;
        for (const [x, y] of [[450, 300], [300, 200], [600, 400], [200, 450], [700, 150]]) {
            await page.mouse.move(x, y); await page.waitForTimeout(400);
            hover = Math.max(hover, await page.evaluate(() => window.t.host.state.get().hover.length));
        }
        await page.mouse.click(450, 300); await page.waitForTimeout(500);
        const pointer = await page.evaluate(() => { const t = window.t, c = t.clicks[0]; return {clicks: t.clicks.length, lngLat: c?.lngLat?.length, features: Array.isArray(c?.features), hoverEvents: t.seen.filter(x => x.startsWith('hover:')).length}; });
        check(`[${renderer}] the features under the pointer are in the state, and a click has them`, hover > 0 && pointer.clicks === 1 && pointer.lngLat === 2 && pointer.features && pointer.hoverEvents > 0, JSON.stringify({hover, ...pointer}));

        // 6. The end.
        const end = await page.evaluate(() => { const t = window.t; t.host.destroy(); t.host.update(t.spec); return {canvas: !!document.querySelector('#host canvas')}; });
        check(`[${renderer}] destroy removes the map`, !end.canvas);
        check(`[${renderer}] no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    } catch (e) { check(`[${renderer}] the test run was completed`, false, String(e.message).split('\n')[0]); }
    await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
