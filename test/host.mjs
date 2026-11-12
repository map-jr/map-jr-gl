// Tests of the main API (`createMap`, see src/host.ts) in a real browser: node test/host.mjs (demo server running)
import {launch} from './launch.mjs';

const browser = await launch();
const origin = `http://localhost:${process.env.PORT || 8080}`; // (the demo server; PORT lets two runs use two servers)
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${detail}`); if (!ok) failed++; };

for (const renderer of ['worker', 'main']) {
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
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
            const before = t.host.state.get();
            await new Promise(r => t.host.state.subscribe(s => s.idle, idle => idle && r()));
            const s = t.host.state.get();
            return {before: before.loaded, loaded: s.loaded, renderer: s.renderer, zoom: s.view.zoom, seen: t.seen, canvas: !!el.querySelector('canvas')};
        }, renderer);
        check(`[${renderer}] createMap: the map loads, and the state says so`, !start.before && start.loaded && (start.renderer === renderer || (renderer === 'worker' && start.renderer === 'main' /* a browser that cannot draw in a worker */)) && start.zoom === 14.3 && start.seen.includes('loaded:true') && start.canvas, JSON.stringify(start));

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
            for (let i = 0; i < 80 && t.host.state.get().view.zoom !== 13.5; i++) await wait(100); // (a slow machine)
            await wait(300);
            const s = t.host.state.get().view;
            return {reported, last: last?.zoom, afterEcho, moved: [s.zoom, s.bearing, +s.center[0].toFixed(3)], zoomEvents: t.seen.filter(x => x === 'zoom').length};
        });
        check(`[${renderer}] the view: changes are reported, a reported view is not applied again, a new view moves the map`,
            view.reported >= 2 && view.last === 15 && view.afterEcho === 15 && view.moved.join() === '13.5,20,-74' && view.zoomEvents >= 2, JSON.stringify(view));

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

        // 3a. A style URL that fails, with `extend`: the error is in the state with the URL and the status, and no promise is left rejected.
        const badStyle = await page.evaluate(async () => {
            const t = window.t, el = document.body.appendChild(document.createElement('div'));
            const host = t.lib.createMap(el, {style: '/no-such-style.json', extend: {layers: [{id: 'extra', type: 'background'}]}, attribution: false});
            await new Promise(r => { host.state.subscribe(s => s.error, e => e && r()); setTimeout(r, 4000); });
            const message = host.state.get().error?.message;
            host.destroy(); el.remove();
            return message;
        });
        check(`[${renderer}] a style URL that fails: state.error has the URL and the status, and no promise is left rejected`, /Style \/no-such-style\.json: HTTP 404/.test(badStyle ?? '') && !errors.length, JSON.stringify({badStyle, errors}));

        // 3c. Mistakes and errors: a container that is not there and a marker layer with no size have a message; `onError`
        // gets each error; without it the error is written to the console.
        const mistakes = await page.evaluate(async () => {
            const t = window.t, said = fn => { try { fn(); return ''; } catch (e) { return e.message; } }, wait = ms => new Promise(r => setTimeout(r, ms));
            const out = {noId: said(() => t.lib.createMap('nope', {style: t.style})), isNull: said(() => t.lib.createMap(null, {style: t.style}))};
            const el = document.body.appendChild(document.createElement('div'));
            out.marker = said(() => t.lib.createMap(el, {style: t.style, markers: [{id: 'm', svg: '<svg viewBox="0 0 2 2"/>', data: []}]}));
            out.left = el.childElementCount;
            const logged = [], log = console.error;
            console.error = (...a) => logged.push(a.map(x => x?.message ?? String(x)).join(' '));
            const got = [], withHook = t.lib.createMap(el, {style: '/no-such-style.json', attribution: false, onError: e => got.push(e.message)});
            await wait(1200);
            out.hook = got.join(); out.loggedWithHook = logged.length;
            withHook.destroy();
            const without = t.lib.createMap(el, {style: '/no-such-style.json', attribution: false});
            await wait(1200);
            out.logged = logged.join(); out.state = without.state.get().error?.message;
            without.destroy(); el.remove(); console.error = log;
            return out;
        });
        check(`[${renderer}] mistakes have a message: a container that is not there, a marker layer with no size`,
            mistakes.noId === '[map-jr-gl] createMap(): no element with the id "nope".' && mistakes.isNull.startsWith('[map-jr-gl] createMap(): the container is null.') && mistakes.marker.startsWith('[map-jr-gl] Marker layer "m": width and height are required.') && mistakes.left === 0, JSON.stringify(mistakes));
        check(`[${renderer}] onError gets each error, and without it the error is written to the console`,
            /HTTP 404/.test(mistakes.hook) && mistakes.loggedWithHook === 0 && /^\[map-jr-gl\] .*HTTP 404/.test(mistakes.logged) && /HTTP 404/.test(mistakes.state ?? ''), JSON.stringify(mistakes));

        // 3d. Two maps with one `extend` object whose source has its data at a URL: both load it.
        const sharedExtend = await page.evaluate(async () => {
            const t = window.t, square = {type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.99, 40.70], [-73.99, 40.72], [-74.02, 40.72], [-74.02, 40.70]]]}};
            const extend = {sources: {own: {type: 'geojson', data: 'data:application/json,' + encodeURIComponent(JSON.stringify(square))}}, layers: [{id: 'own-fill', type: 'fill', source: 'own'}]};
            const made = [0, 1].map(() => { const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'})); return {el, host: t.lib.createMap(el, {style: t.style, extend, initialView: {center: [-74.0065, 40.7085], zoom: 13}, attribution: false})}; });
            const idles = await Promise.all(made.map(({host}) => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 8000); })));
            const drawn = await Promise.all(made.map(({host}) => Promise.race([host.queryFeatures(undefined, {layers: ['own-fill']}).then(f => f.length), new Promise(r => setTimeout(() => r(-1), 4000))])));
            for (const {el, host} of made) { host.destroy(); el.remove(); }
            return {idles, drawn};
        });
        check(`[${renderer}] two maps with one extend object both load its source`, sharedExtend.idles.every(Boolean) && sharedExtend.drawn.every(n => n > 0), JSON.stringify(sharedExtend));

        // 3e. Common mistakes: each gives one warning that says what to write, and a correct description gives none.
        const warnings = await page.evaluate(async renderer => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), said = [], log = console.warn;
            console.warn = (...a) => said.push(a.join(' '));
            const div = style => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;' + style}));
            const idle = host => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 8000); });
            const empty = {type: 'FeatureCollection', features: []}, pin = id => ({id, svg: '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>', width: 8, height: 8, data: [{lngLat: [-74.0065, 40.7085]}]});
            const base = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false, onError: () => {}};
            // A correct description, with each of the fields that the checks read.
            const goodEl = div('height:150px'), good = t.lib.createMap(goodEl, {...base, interactiveLayers: ['own-fill'], data: {own: empty}, markers: [pin('a'), pin('b')],
                extend: {sources: {own: {type: 'geojson', data: empty}}, layers: [{id: 'own-fill', type: 'fill', source: 'own', before: t.style.layers[1].id}]}});
            await idle(good);
            await good.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']});
            await good.queryFeatures({x: 100, y: 75}, {sources: ['own'], radius: 5, geometry: false});
            await good.queryFeatures(undefined, {sources: ['omt'], sourceLayers: ['water']});
            // An application that adds the layer and the source itself in `load`: the ids are compared after that.
            const ownEl = div('height:150px'), own = t.lib.createMap(ownEl, {...base, interactiveLayers: ['later'], data: {'later-source': empty}});
            own.listen('load', () => { own.map.addSource('later-source', {type: 'geojson', data: empty}); own.map.addLayer({id: 'later', type: 'fill', source: 'later-source'}); });
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
            const spec = {...base, interactiveLayers: ['nope'], data: {nosuch: empty}, markers: [pin('a'), pin('a')],
                extend: {layers: [{id: 'lost', type: 'fill', source: 'missing', before: 'nonexistent'}]}};
            const badEl = div('height:150px'), bad = t.lib.createMap(badEl, spec);
            await idle(bad);
            for (let i = 0; i < 2; i++) { // (twice: a warning comes once)
                bad.update({...spec, interactive: false, initialView: {center: [0, 0], zoom: 2}});
                await bad.queryFeatures({x: 100, y: 75}, {layers: ['nope']}).catch(() => {});
                await bad.queryFeatures({x: 100, y: 75}, {sources: ['nope'], layers: ['lost']}).catch(() => {});
                await bad.queryFeatures({x: 100, y: 75}, {sourceLayers: ['water'], radius: 5, geometry: false}).catch(() => {});
                await bad.queryFeatures(undefined, {sources: ['omt'], radius: 5, geometry: false}).catch(() => {});
            }
            const place = await bad.queryFeatures({lng: -74.0065, lat: 40.7085}).then(() => '', e => e.message);
            const flatEl = div('height:0'), flat = t.lib.createMap(flatEl, base);
            await wait(1500);
            for (const [el, host] of [[goodEl, good], [badEl, bad], [flatEl, flat]]) { host.destroy(); el.remove(); }
            console.warn = log;
            return {correct, said, place};
        }, renderer);
        const expected = ['createMap(): the container has height 0', 'interactiveLayers: the style has no layer "nope"', 'data: the style has no GeoJSON source "nosuch"', 'queryFeatures(): the style has no layer "nope"',
            'queryFeatures(): the style has no source "nope"', 'extend: the layer "lost" has before: "nonexistent"', 'extend: the layer "lost" uses the source "missing"', 'markers: two marker layers have the id "a"',
            'update(): "interactive" changed', 'update(): "initialView" changed', 'queryFeatures(): "sourceLayers" has an effect only', 'queryFeatures(): "radius" has an effect only', 'queryFeatures(): "geometry" has an effect only',
            'queryFeatures(): "layers" has no effect'];
        check(`[${renderer}] common mistakes: each gives one warning, a wrong place of a query is refused with a message, and a correct description gives no warning`,
            warnings.correct.length === 0 && warnings.said.length === expected.length && expected.every(e => warnings.said.filter(w => w.startsWith('[map-jr-gl] ' + e)).length === 1)
            && warnings.place.startsWith('[map-jr-gl] queryFeatures(): {"lng":-74.0065,"lat":40.7085} is not a place.'), JSON.stringify(warnings));

        // 3b. A description with no style (only the changed fields) throws at once with a message, and the map is not harmed.
        const partial = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), said = fn => { try { fn(); return ''; } catch (e) { return e.message; } };
            const update = said(() => t.host.update({cursor: 'crosshair'})), none = said(() => t.host.update(undefined));
            const create = said(() => t.lib.createMap(document.createElement('div'), {initialView: {zoom: 2}}));
            await wait(500);
            return {update, none, create, drawn: (await t.host.queryFeatures([{x: 0, y: 0}, {x: 900, y: 600}])).length};
        });
        check(`[${renderer}] a description with no style: update and createMap throw and say what to write, and the map still draws`,
            partial.update.startsWith('[map-jr-gl] update(): the description has no "style".') && partial.update.includes('map.update({...description, cursor: ') && partial.none.startsWith('[map-jr-gl] update()')
            && partial.create.startsWith('[map-jr-gl] createMap(): the description has no "style".') && partial.drawn > 0 && !errors.length, JSON.stringify({...partial, errors}));

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

        // GeoJSON data apart from the style: it goes to its source alone, and stays over a new style.
        const data = await page.evaluate(async () => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), c = t.host.state.get().view.center;
            const idle = () => new Promise(r => { const off = t.host.state.subscribe(s => s.idle, v => { if (v) { off(); r(); } }); setTimeout(r, 8000); });
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
            t.host.update(t.spec = {...t.spec, style: location.origin + '/style.json', extend: layer('ext-a')});
            const a = await count('ext-a', true), order = t.host.map.getStyle().layers.map(l => l.id), below = order.indexOf('ext-a') === order.indexOf('road') - 1;
            t.host.update(t.spec = {...t.spec, extend: layer('ext-b')});
            const b = await count('ext-b', true), aGone = !(await count('ext-a', false));
            t.host.update(t.spec = {...t.spec, style: t.style, extend: undefined});
            await wait(500);
            return {a, below, b, aGone, left: t.host.map.getStyle().layers.some(l => l.id.startsWith('ext-'))};
        });
        check(`[${renderer}] extend adds sources and layers to a style from a URL, and follows the description`, extend.a && extend.below && extend.b && extend.aGone && !extend.left, JSON.stringify(extend));

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

        // 5b. One method to find features, and the same question kept up to date.
        const found = await page.evaluate(async () => {
            const h = window.t.host, c = h.state.get().view.center, wait = ms => new Promise(r => setTimeout(r, ms));
            const sources = Object.keys(window.t.spec.style.sources).filter(id => window.t.spec.style.sources[id].type === 'vector');
            const drawnAtPoint = await h.queryFeatures({x: 450, y: 300}), drawnAtPosition = await h.queryFeatures(c), drawnAll = await h.queryFeatures();
            const dataAtPosition = await h.queryFeatures(c, {sources, radius: 30}), dataInBox = await h.queryFeatures([{x: 300, y: 200}, {x: 600, y: 400}], {sources}), dataAll = await h.queryFeatures(undefined, {sources});
            const calls = [];
            const stop = h.watchFeatures({x: 450, y: 300}, {}, f => calls.push(f.length));
            await wait(600);
            const first = calls.length;
            h.moveTo({center: [c[0] + 0.01, c[1] + 0.004]});
            await wait(2500);
            const moved = calls.length;
            stop();
            h.moveTo({center: c});
            await wait(1500);
            return {drawnAtPoint: drawnAtPoint.length, drawnAtPosition: drawnAtPosition.length, drawnAll: drawnAll.length, dataAtPosition: dataAtPosition.length, dataInBox: dataInBox.length, dataAll: dataAll.length, layer: typeof drawnAll[0]?.layer, first, moved, after: calls.length};
        });
        check(`[${renderer}] queryFeatures: a point, a position, a rectangle or the whole map; drawn layers or the data of sources; watchFeatures follows the map`,
            found.drawnAtPoint > 0 && found.drawnAtPosition > 0 && found.drawnAll > found.drawnAtPoint && found.dataAtPosition > 0 && found.dataInBox > 0 && found.dataAll >= found.dataInBox && found.layer === 'object'
            && found.first === 1 && found.moved >= 2 && found.after === found.moved, JSON.stringify(found));

        // 6. The end.
        const end = await page.evaluate(() => { const t = window.t; t.host.destroy(); t.host.update(t.spec); return {canvas: !!document.querySelector('#host canvas')}; });
        check(`[${renderer}] destroy removes the map`, !end.canvas);
        check(`[${renderer}] no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    } catch (e) { check(`[${renderer}] the test run was completed`, false, String(e.message).split('\n')[0]); }
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
// The glyph files of the style: asked for by default, with the font stack and the range in the URL; not with `glyphs: false`.
// (The test server has no glyph files: the text then uses the fonts of the device, and the map still becomes idle.)
{
    const page = await browser.newPage({viewport: {width: 900, height: 600}});
    try {
        const asked = [];
        let answer = {status: 404, body: ''};
        await page.route(/\/test-glyphs\//, route => { asked.push(decodeURIComponent(new URL(route.request().url()).pathname)); route.fulfill(answer); });
        await page.goto(`${origin}/style.json`);
        const run = glyphs => page.evaluate(async glyphs => {
            const lib = await import('/dist/map-jr-gl.js'), style = await (await fetch('/style.json')).json();
            style.glyphs = '/test-glyphs/{fontstack}/{range}.pbf';
            const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;inset:0;z-index:99;background:#fff'}));
            const host = lib.createMap(el, {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, attribution: false, ...(glyphs === false ? {glyphs} : {})});
            const loaded = await Promise.race([new Promise(r => host.state.subscribe(s => s.loaded, v => v && r(true))), new Promise(r => setTimeout(() => r(false), 20000))]);
            host.destroy(); el.remove();
            return loaded;
        }, glyphs);
        const withFiles = await run(), count = asked.length, without = await run(false), none = asked.length === count;
        // A server that answers each URL with a page (200, HTML), and one that sends bytes that are not a glyph file:
        // the map must still load, with the fonts of the device.
        answer = {status: 200, contentType: 'text/html', body: '<!doctype html><html><body>not found</body></html>'};
        const page200 = await run();
        answer = {status: 200, contentType: 'application/x-protobuf', body: Buffer.from([10, 255, 255, 255, 127, 26, 200, 1, 8, 65, 24, 136, 39, 32, 136, 39])};
        const broken = await run();
        check('glyph files of the style: asked for by default, not with glyphs: false; a map still loads without them or with bad ones',
            withFiles && without && none && page200 && broken && count > 0 && asked.every(u => /^\/test-glyphs\/[^/]+\/\d+-\d+\.pbf$/.test(u)), JSON.stringify({withFiles, without, none, page200, broken, count, first: asked[0]}));
    } catch (e) { check('glyph files: the test run was completed', false, String(e.message).split('\n')[0]); }
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
            const pin = {id: 'a', svg: '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>', width: 8, height: 8, data: []};
            const host = lib.createMap(el, {style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, attribution: false, markers: [pin, pin]});
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
await browser.close();
process.exit(failed ? 1 : 0);
