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
            t.host.listen('load', () => t.seen.push('load:idle=' + t.host.state.get().idle));
            t.host.listen('idle', () => t.seen.push('idle'));
            const before = t.host.state.get();
            await new Promise(r => t.host.state.subscribe(s => s.idle, idle => idle && r()));
            const s = t.host.state.get();
            return {before: before.loaded, loaded: s.loaded, renderer: s.renderer, zoom: s.view.zoom, seen: t.seen, canvas: !!el.querySelector('canvas')};
        }, renderer);
        check(`[${renderer}] createMap: the map loads, and the state says so`, !start.before && start.loaded && (start.renderer === renderer || (renderer === 'worker' && start.renderer === 'main' /* a browser that cannot draw in a worker */)) && start.zoom === 14.3 && start.seen.includes('loaded:true') && start.seen.indexOf('load:idle=false') >= 0 && start.seen.indexOf('load:idle=false') < start.seen.indexOf('idle') && start.canvas, JSON.stringify(start));

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
            out.logged = logged.join(); out.state = without.state.get().error?.message;
            without.destroy(); el.remove(); console.error = log;
            return out;
        });
        check(`[${renderer}] mistakes have a message: a container that is not there`,
            mistakes.noId === '[map-jr-gl] createMap(): no element with the id "nope".' && mistakes.isNull.startsWith('[map-jr-gl] createMap(): the container is null.') && mistakes.left === 0, JSON.stringify(mistakes));
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

        // 3d. `radius` widens a query for what the style layers draw, as it widens a query with `sources` (#12).
        const radius = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            // A line of 2 pixels through the centre of the map, from west to east. The questions are 6 pixels below it.
            const line = {type: 'Feature', properties: {name: 'line'}, geometry: {type: 'LineString', coordinates: [[-74.02, 40.7085], [-73.99, 40.7085]]}};
            const host = t.lib.createMap(el, {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false,
                extend: {sources: {own: {type: 'geojson', data: line}}, layers: [{id: 'own-line', type: 'line', source: 'own', paint: {'line-width': 2}}]}});
            await new Promise(r => { host.state.subscribe(s => s.idle, v => v && r()); setTimeout(r, 8000); });
            const at = {x: 100, y: 81}, below = host.unproject(at), count = async (place, o) => (await host.queryFeatures(place, o)).length;
            const out = {on: await count({x: 100, y: 75}, {layers: ['own-line']}), none: await count(at, {layers: ['own-line']}), small: await count(at, {layers: ['own-line'], radius: 2}), point: await count(at, {layers: ['own-line'], radius: 8}),
                position: await count(below, {layers: ['own-line'], radius: 8}), data: await count(at, {sources: ['own'], radius: 8}), dataDefault: await count(at, {sources: ['own']}),
                layer: (await host.queryFeatures(at, {layers: ['own-line'], radius: 8}))[0]?.layer?.id};
            host.destroy(); el.remove();
            return out;
        }, renderer);
        check(`[${renderer}] queryFeatures: radius widens a query for drawn features, and its default is 0 there and 3 with sources`,
            radius.on === 1 && radius.none === 0 && radius.small === 0 && radius.point === 1 && radius.position === 1 && radius.data === 1 && radius.dataDefault === 0 && radius.layer === 'own-line', JSON.stringify(radius));

        // 3d. A source of `extend` gets its features from `data`; an owned view with only some fields that equals a reported view does not move the map (#33).
        const extendData = await page.evaluate(async renderer => {
            const t = window.t, el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;height:150px'}));
            const idle = host => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r()); setTimeout(r, 8000); });
            const square = {type: 'Feature', properties: {name: 'square'}, geometry: {type: 'Polygon', coordinates: [[[-74.02, 40.70], [-73.99, 40.70], [-73.99, 40.72], [-74.02, 40.72], [-74.02, 40.70]]]}};
            const spec = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 13}, renderer, attribution: false,
                extend: {sources: {own: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'own-fill', type: 'fill', source: 'own'}]}};
            const host = t.lib.createMap(el, spec);
            await idle(host);
            const before = (await host.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']})).length;
            host.update({...spec, data: {own: {type: 'FeatureCollection', features: [square]}}});
            await new Promise(r => setTimeout(r, 300)); await idle(host);
            const after = (await host.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']})).length;
            let jumps = 0; const jump = host.map.jumpTo; host.map.jumpTo = (...a) => { jumps++; return jump.apply(host.map, a); };
            host.map.jumpTo({center: [-74.0, 40.71], zoom: 13.5}); jumps = 0;
            await new Promise(r => setTimeout(r, 200));
            const v = host.state.get().view;
            host.update({...spec, data: {own: {type: 'FeatureCollection', features: [square]}}, view: {center: v.center, zoom: v.zoom}});
            host.destroy(); el.remove();
            return {before, after, jumps};
        }, renderer);
        check(`[${renderer}] extend.sources gets features from data, and a partial owned view that the map reported is not applied again`,
            extendData.before === 0 && extendData.after === 1 && extendData.jumps === 0, JSON.stringify(extendData));

        // 3e. Common mistakes: each gives one warning that says what to write, and a correct description gives none.
        const warnings = await page.evaluate(async renderer => {
            const t = window.t, wait = ms => new Promise(r => setTimeout(r, ms)), said = [], log = console.warn;
            console.warn = (...a) => said.push(a.join(' '));
            const div = style => document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;left:-2000px;top:0;width:200px;' + style}));
            const idle = host => new Promise(r => { host.state.subscribe(s => s.idle, v => v && r(true)); setTimeout(() => r(false), 8000); });
            const empty = {type: 'FeatureCollection', features: []}, dot = '<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>', pin = id => ({id, image: 'dot', data: [{lngLat: [-74.0065, 40.7085]}]});
            const base = {style: t.style, initialView: {center: [-74.0065, 40.7085], zoom: 14.3}, renderer, attribution: false, onError: () => {}};
            // A correct description, with each of the fields that the checks read.
            const goodEl = div('height:150px'), good = t.lib.createMap(goodEl, {...base, interactiveLayers: ['own-fill'], data: {own: empty}, images: {dot}, markers: [pin('a'), pin('b')],
                extend: {sources: {own: {type: 'geojson', data: empty}}, layers: [{id: 'own-fill', type: 'fill', source: 'own', before: t.style.layers[1].id}]}});
            await idle(good);
            await good.queryFeatures({x: 100, y: 75}, {layers: ['own-fill']});
            await good.queryFeatures({x: 100, y: 75}, {sources: ['own'], radius: 5, geometry: false, zoom: 14});
            await good.queryFeatures([-74.0065, 40.7085], {layers: ['own-fill'], radius: 5});
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
            const spec = {...base, interactiveLayers: ['nope'], data: {nosuch: empty}, markers: [pin('a'), pin('a'), {id: 'old', svg: dot, width: 8, height: 8, data: []}, {...pin('gone'), image: 'nothing'},
                    {...pin(t.style.layers[1].id), before: 'no-such-layer', data: [{lngLat: [-74.0065, 40.7085]}, {props: {}}, null]}],
                images: {dot: '<svg viewBox="0 0 4 4"><rect width="4" height="4" fill="{{fill}}"/></svg>'},
                extend: {sources: {icons: {type: 'geojson', data: empty}}, layers: [{id: 'lost', type: 'fill', source: 'missing', before: 'nonexistent'}, {id: 'icons', type: 'symbol', source: 'icons', layout: {'icon-image': ['image', 'dot', {params: {fill: '#d00', colour: '#00d'}}]}},
                    {id: 'labels', type: 'symbol', source: 'icons', layout: {'text-field': ['format', ['image', 'dot', {params: {fill: '#d00', size: '2'}}], {}]}}]}};
            const badEl = div('height:150px'), bad = t.lib.createMap(badEl, spec);
            await idle(bad);
            for (let i = 0; i < 2; i++) { // (twice: a warning comes once)
                // (The second time, the template is replaced by one without the slot {{fill}}.)
                bad.update({...spec, interactive: false, initialView: {center: [0, 0], zoom: 2}, images: i ? {dot: '<svg viewBox="0 0 4 4"><rect width="4" height="4"/></svg>'} : spec.images});
                await bad.queryFeatures({x: 100, y: 75}, {layers: ['nope']}).catch(() => {});
                await bad.queryFeatures({x: 100, y: 75}, {sources: ['nope'], layers: ['lost']}).catch(() => {});
                await bad.queryFeatures({x: 100, y: 75}, {sourceLayers: ['water'], radius: 5, geometry: false}).catch(() => {});
                await bad.queryFeatures(undefined, {sources: ['omt'], radius: 5, geometry: false, zoom: 14}).catch(() => {});
                await bad.queryFeatures([{x: 0, y: 0}, {x: 100, y: 75}], {radius: 5}).catch(() => {});
            }
            const place = await bad.queryFeatures({lng: -74.0065, lat: 40.7085}).then(() => '', e => e.message);
            const flatEl = div('height:0'), flat = t.lib.createMap(flatEl, base);
            // (The warning for an image that the map does not have waits three seconds for the image.)
            await wait(3500);
            for (const [el, host] of [[goodEl, good], [badEl, bad], [flatEl, flat]]) { host.destroy(); el.remove(); }
            console.warn = log;
            return {correct, said, place};
        }, renderer);
        const styleLayer = await page.evaluate(() => window.t.style.layers[1].id);
        const expected = ['createMap(): the container has height 0', 'interactiveLayers: the style has no layer "nope"', 'data: the style has no GeoJSON source "nosuch"', 'queryFeatures(): the style has no layer "nope"',
            'queryFeatures(): the style has no source "nope"', 'extend: the layer "lost" has before: "nonexistent"', 'extend: the layer "lost" uses the source "missing"', 'markers: two marker layers have the id "a"', 'images: a layer gives the parameter "colour" to the image "dot"', 'images: a layer gives the parameter "size" to the image "dot"', 'images: a layer gives the parameter "fill" to the image "dot"', 'markers: the marker layer "old" has no "image"', 'markers: a marker layer has the image "nothing"', `markers: the marker layer "${styleLayer}" has the id of a layer of the style`, `markers: the marker layer "${styleLayer}" has before: "no-such-layer"`, `markers: the marker 1 of the marker layer "${styleLayer}" has no position`,
            'update(): "interactive" changed', 'update(): "initialView" changed', 'queryFeatures(): "sourceLayers" has an effect only', 'queryFeatures(): "radius" has an effect only in a query at a point or a position', 'queryFeatures(): "geometry" has an effect only', 'queryFeatures(): "zoom" has an effect only',
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

        // 4. Marker layers: each one is a source and a symbol layer of the style, and they follow the description.
        const markers = await page.evaluate(async () => {
            const t = window.t, map = t.host.map, wait = ms => new Promise(r => setTimeout(r, ms)), at = () => t.host.queryFeatures({x: 450, y: 300}, {layers: ['pins']});
            const centre = t.host.unproject({x: 450, y: 300});
            const layer = (data, more) => ({id: 'pins', image: 'disc', data, ...more});
            t.host.update(t.spec = {...t.spec, images: {disc: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="{{color}}"/></svg>'}, markers: [layer([{lngLat: centre, props: {color: '#d00'}}])]});
            await wait(900);
            const one = await at(), made = map.getLayer('pins'), top = map.getStyle().layers.at(-1).id;
            // Other data: the markers move, and the style is the same.
            let restyled = 0;
            const count = () => restyled++;
            map.on('style.load', count);
            t.host.update(t.spec = {...t.spec, markers: [layer([{lngLat: [centre[0] + 1, centre[1]], props: {color: '#d00'}}])]});
            await wait(700);
            const moved = (await at()).length;
            t.host.update(t.spec = {...t.spec, markers: [layer([{lngLat: [0, 0], props: {}}, {lngLat: centre, props: {color: '#00d'}}])]});
            await wait(700);
            const back = await at(), sameStyle = restyled === 0;
            map.off('style.load', count);
            // Other options: the layer is another layer of the style (here: below the first layer, and labels keep away).
            const first = map.getStyle().layers[0].id;
            t.host.update(t.spec = {...t.spec, markers: [layer([{lngLat: centre, props: {color: '#00d'}}], {before: first, anchor: 'bottom', collide: true, minZoom: 3, overlap: 'hide'})]});
            await wait(900);
            const changed = map.getLayer('pins'), below = map.getStyle().layers.findIndex(l => l.id === 'pins') === 0;
            // Another option, and other data at once: the new style comes a moment later, and its source gets the data.
            // A marker with no position is left out, and the others keep their index.
            t.host.update(t.spec = {...t.spec, markers: [layer([{lngLat: centre, props: {color: '#00d'}}], {anchor: 'top'})]});
            t.host.update(t.spec = {...t.spec, markers: [layer([{props: {}}, {lngLat: centre, props: {color: '#0a0'}}], {anchor: 'top'})]});
            await wait(1200);
            const late = await t.host.queryFeatures({x: 450, y: 310}, {layers: ['pins']});
            const {images: _, markers: __, ...rest} = t.spec;
            t.host.update(t.spec = rest);
            await wait(700);
            return {one: one.length, id: one[0]?.id, top, layout: made?.layout, moved, back: back.length, index: back[0]?.id, color: back[0]?.properties.color, sameStyle,
                changed: changed && {...changed.layout, minzoom: changed.minzoom}, below, late: late.map(f => f.id + ' ' + f.properties.color).join(), none: !map.getLayer('pins') && !map.getSource('pins')};
        });
        check(`[${renderer}] a marker layer is a source and a symbol layer: it follows the description, its markers are features with the index as the id, new data is no new style, and data that comes with another option is not lost`,
            markers.one === 1 && markers.id === 0 && markers.top === 'pins' && JSON.stringify(markers.layout) === JSON.stringify({'icon-image': 'disc', 'icon-anchor': 'center', 'icon-allow-overlap': true, 'icon-ignore-placement': true})
            && markers.moved === 0 && markers.back === 1 && markers.index === 1 && markers.color === '#00d' && markers.sameStyle
            && JSON.stringify(markers.changed) === JSON.stringify({'icon-image': 'disc', 'icon-anchor': 'bottom', 'icon-allow-overlap': false, 'icon-ignore-placement': false, minzoom: 3}) && markers.below && markers.late === '1 #0a0' && markers.none, JSON.stringify(markers));

        {
        // Images: added, replaced and removed by the description. A symbol layer draws a square of 40 pixels at the centre.
        // (The colour of the square is read from a picture of the page, at two places inside the square.)
        const colourAt = async () => page.evaluate(async png => {
            const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
            c.drawImage(bitmap, 0, 0);
            return [[438, 288], [462, 312]].map(([x, y]) => '#' + [...c.getImageData(x, y, 1, 1).data.slice(0, 3)].map(v => (v >> 4).toString(16)).join(''));
        }, (await page.screenshot()).toString('base64'));
        const shows = async colour => { let got; for (let i = 0; i < 40 && !(got = await colourAt()).includes(colour); i++) await page.waitForTimeout(150); return got.includes(colour) ? colour : got.join(' '); };
        const images = await page.evaluate(async () => {
            const t = window.t, map = t.host.map, c = t.host.unproject({x: 450, y: 300}), add = map.addImage;
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
            return {errors: t.imageErrors, has: t.host.map.hasImage('square')};
        });
        await page.waitForTimeout(700);
        const after = await colourAt(), late = await page.evaluate(() => window.t.host.map.hasImage('late'));
        await page.evaluate(() => { const t = window.t; delete t.host.map.addImage; t.host.update(t.spec = {...t.spec, style: t.style}); });
        check(`[${renderer}] images follow the description: added, the same content is not added again, replaced, the last of two changes stays, removed, and an image that does not load is an error`,
            first === '#f0f' && again === 0 && replaced === '#0ff' && last === '#00f' && stays && !gone.has && !late && !after.includes('#00f') && gone.errors.length === 1 && gone.errors[0].startsWith('[map-jr-gl] images: the image "lost" did not load.'),
            JSON.stringify({first, again, replaced, last, stays, gone, late, after}));

        // An image that is an SVG template: each feature gives the slots their values. Two squares, the second 60 pixels to the right.
        // (Of each square, the colour of its upper half and of its lower half is read.)
        const halves = async () => page.evaluate(async png => {
            const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
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
        await page.evaluate(() => window.t.host.map.setFeatureState({source: 'spot', id: 2}, {on: true}));
        const stateOn = await becomes('#000 #0f0 #000 #f00');
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
            // (The map is idle and stays idle for a second.)
            t.settle = () => new Promise(done => { let at = 0; const off = t.host.state.subscribe(s => s.idle, idle => { at = idle ? performance.now() : 0; }), timer = setInterval(() => { if (at && performance.now() - at > 1000) { clearInterval(timer); off(); done(); } }, 100); setTimeout(done, 30000); });
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
            const pixels = async png => { const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d'); c.drawImage(bitmap, 0, 0); return c.getImageData(0, 0, bitmap.width, bitmap.height).data; };
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

        // 4b. An SVG image without a viewBox has the size of its width and height attributes (#175): a 9×9 image that
        // replaces a 40×40 one under the same name is drawn at 9×9 centred on its anchor, and the 40×40 one is not cropped.
        // (The blue box of each picture is read from a picture of the page; the anchor is at the centre, 450, 300.)
        {
            const svg = (s, c) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><rect width="${s}" height="${s}" fill="${c}"/></svg>`;
            const box = async () => page.evaluate(async png => {
                const bitmap = await createImageBitmap(await (await fetch('data:image/png;base64,' + png)).blob()), c = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
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
            const log = console.error;
            console.error = () => {};
            h.map.fire('test22');
            console.error = log;
            offA(); offB();
            return {calls, second, error: h.state.get().error?.message};
        });
        check(`[${renderer}] a watchFeatures listener that throws is called again, and a listener that throws leaves the next listener its event and is reported as an error`,
            thrown.calls >= 2 && thrown.second === 1 && thrown.error === 'thrown by a listener', JSON.stringify(thrown));

        // 5c. A rejection of the question of watchFeatures is an error of the map, and is not lost (#92).
        const rejected = await page.evaluate(async () => {
            const h = window.t.host, log = console.error;
            console.error = () => {};
            const stop = h.watchFeatures({lng: -74.0105, lat: 40.7045}, {}, () => {});
            await new Promise(r => setTimeout(r, 600));
            stop(); console.error = log;
            return h.state.get().error?.message ?? '';
        });
        check(`[${renderer}] a watchFeatures question that is rejected is reported as an error of the map`, rejected.includes('queryFeatures()'), rejected);

        // 6. The end. The queries that have no answer yet are rejected, and so is a query after it. No callback runs after it.
        const end = await page.evaluate(async () => {
            const t = window.t, h = t.host, said = p => Promise.race([p.then(() => 'answered', e => e.message), new Promise(r => setTimeout(() => r('not settled'), 2000))]);
            const sources = Object.keys(t.spec.style.sources).filter(id => t.spec.style.sources[id].type === 'vector');
            let clicks = 0, watched = 0;
            h.update(t.spec = {...t.spec, interactiveLayers: t.spec.style.layers.filter(l => l.source).map(l => l.id), onClick: () => clicks++});
            h.map.fire('click', {point: {x: 450, y: 300}, lngLat: {lng: -74.0105, lat: 40.7045}});
            h.watchFeatures(undefined, {sources}, () => watched++);
            const pending = said(h.queryFeatures(undefined, {sources})), height = said(h.queryElevation([-74.0105, 40.7045]));
            h.destroy(); h.update(t.spec);
            const later = said(h.queryFeatures(undefined, {sources}));
            const out = {canvas: !!document.querySelector('#host canvas'), pending: await pending, height: await height, later: await later};
            await new Promise(r => setTimeout(r, 300));
            return {...out, clicks, watched};
        });
        check(`[${renderer}] destroy removes the map`, !end.canvas);
        const gone = '[map-jr-gl] The query has no answer: the map was removed.';
        check(`[${renderer}] destroy rejects the queries that wait and a query after it, and onClick and a watchFeatures listener do not run after it`,
            end.pending === gone && end.height === gone && end.later === gone && end.clicks === 0 && end.watched === 0, JSON.stringify(end));
        const other = errors.filter(e => !e.includes('thrown by the test')); // (the browser reports what the listener of 5b threw)
        check(`[${renderer}] no page errors`, other.length === 0, other.slice(0, 2).join(' | '));
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
            const pin = {id: 'a', image: 'dot', data: []};
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

// A browser without WebGL2, on the page and in the worker: `supported()` says so before a map is made. A map that is
// made all the same reports one error (`onError`, `state.error`) and puts a message into the container.
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
                state = () => ({error: host.state.get().error?.message, loaded: host.state.get().loaded});
                destroy = () => host.destroy();
            } else {
                const lib = await import('/dist/map-jr-gl-maplibre-compat.js');
                supported = lib.supported() || lib.default.supported();
                const map = new lib.Map({container: el, style, center: [-74.0065, 40.7085], zoom: 14.3, attributionControl: false, createWorker});
                map.on('error', e => errors.push(e.error.message));
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

// The `queryFeatures` example of the gallery (site/examples/query.js and query.compat.js; the site must be built), with
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
            const map = window.maps.query, ask = map.queryFeatures, wait = ms => new Promise(r => setTimeout(r, ms));
            window.asked = 0;
            // The first question gets a marked answer 2 seconds late. The questions after it are not changed.
            map.queryFeatures = function (...a) { const answer = ask.apply(this, a); return window.asked++ ? answer : answer.then(async () => { await wait(2000); return [{sourceLayer: 'first-click', properties: {}}]; }); };
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
await browser.close();
process.exit(failed ? 1 : 0);
