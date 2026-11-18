// Measures the main API (`createMap`, `update`) and the Vue adapter in scenarios with many updates, against MapLibre
// GL JS doing the same work with its own methods, in the same headless Chromium.
//   node test/bench/reactivity.mjs                 (needs the demo server: pnpm demo, or PORT=… node demo/serve.mjs)
//   node test/bench/reactivity.mjs --filter=vehicles --runs=3
//   RENDERER=main node test/bench/reactivity.mjs   (the main API draws on the main thread, as MapLibre GL JS does)
// Each scenario drives one change per animation frame (or every few frames) and records, for each arm:
//   call   the median and the worst time of the synchronous call(s) of one step, in ms (page script only)
//   frame  the median and the 95th percentile of the time between two animation frames, in ms
//   long   the total of long tasks (50 ms or more) during the run, in ms
//   drawn  the frames that the map drew (`render` events) during the run
//   settle the time from the last step until the map is idle, in ms
// Headless Chromium draws WebGL in software, so frame times are only relative. The call times are CPU work on the
// main thread, and they compare well between the arms.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url), {chromium} = require('playwright');
const root = path.resolve(import.meta.dirname, '../..');
const origin = `http://localhost:${process.env.PORT || 8080}`;
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const runs = +(args.runs ?? 1), filter = args.filter ? new RegExp(args.filter) : null;
const STYLE = process.env.BENCH_STYLE ?? 'https://tiles.openfreemap.org/styles/liberty';
const VIEW = {center: [-74.0065, 40.7085], zoom: 14};

// Code that every page gets: the instruments, a way to drive steps once per frame, and data generators.
const prelude = () => {
    const raf = window.requestAnimationFrame.bind(window);
    window.bench = {long: 0, loads: 0};
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.bench.long += e.duration; }).observe({type: 'longtask', buffered: true});
    const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    const p95 = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0; };
    // Runs `step(i)` in `n` animation frames, one in `every` frames, and measures it.
    window.drive = async ({n, every = 1, step, idle, rendered}) => {
        const calls = [], stamps = [];
        window.bench.long = 0; window.bench.loads = 0;
        const drawn0 = rendered();
        await new Promise(done => {
            let frame = 0, i = 0;
            const tick = t => {
                stamps.push(t);
                if (frame++ % every === 0) { const t0 = performance.now(); step(i++); calls.push(performance.now() - t0); }
                if (i < n) raf(tick); else done();
            };
            raf(tick);
        });
        const last = performance.now(), drawn = rendered() - drawn0;
        await idle();
        const settle = performance.now() - last;
        const gaps = stamps.slice(1).map((t, k) => t - stamps[k]);
        return {call: median(calls), worst: Math.max(...calls), frame: median(gaps), frame95: p95(gaps), long: window.bench.long, drawn, steps: n, settle, loads: window.bench.loads};
    };
    // `count` points around `center` that move along circles: step `i` gives a new FeatureCollection.
    window.points = (count, i, center = [-74.0065, 40.7085]) => {
        const features = new Array(count);
        for (let k = 0; k < count; k++) {
            const a = k * 2.399 + i * 0.02 * (1 + (k % 7) / 7), r = 0.004 + (k % 97) / 97 * 0.03;
            features[k] = {type: 'Feature', id: k, properties: {kind: k % 5}, geometry: {type: 'Point', coordinates: [center[0] + Math.cos(a) * r * 1.3, center[1] + Math.sin(a) * r]}};
        }
        return {type: 'FeatureCollection', features};
    };
};

// The setup of each library. Each returns, in the page: `window.m` (a handle), `idle()`, `rendered()`.
const setups = {
    jr: async ({style, view, renderer}) => {
        const lib = await import('/dist/map-jr-gl.js');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:1000px;height:700px'}));
        const spec = {style, initialView: view, attribution: false, renderer};
        const host = lib.createMap(el, spec);
        let renders = 0;
        host.listen('render', () => renders++);
        host.listen('style.load', () => window.bench.loads++);
        window.m = {lib, host, spec, el};
        window.rendered = () => renders;
        window.idle = () => new Promise(r => { if (host.state.get().idle) { setTimeout(() => host.state.get().idle ? r() : host.state.subscribe(s => s.idle, v => v && r()), 50); } else { const stop = host.state.subscribe(s => s.idle, v => { if (v) { stop(); r(); } }); } });
        await new Promise(r => host.state.subscribe(s => s.idle && s.loaded, v => v && r()));
    },
    ml: async ({style, view}) => {
        const ml = await import('/ml/maplibre-gl.mjs');
        ml.setWorkerUrl('/ml/maplibre-gl-worker.mjs');
        document.head.appendChild(Object.assign(document.createElement('link'), {rel: 'stylesheet', href: '/ml/maplibre-gl.css'}));
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:1000px;height:700px'}));
        const map = new ml.Map({container: el, style, center: view.center, zoom: view.zoom, attributionControl: false});
        let renders = 0;
        map.on('render', () => renders++);
        map.on('style.load', () => window.bench.loads++);
        window.m = {ml, map, el};
        window.rendered = () => renders;
        window.idle = () => new Promise(r => { if (map.loaded() && map.areTilesLoaded() && !map.isMoving()) setTimeout(r, 0); else map.once('idle', () => r()); });
        await new Promise(r => map.once('idle', r));
    },
};

// Each scenario: a name, what it stands for, and one function per arm that runs in the page after the setup.
// `lib` says which setup an arm uses.
const circleLayer = {id: 'v', type: 'circle', source: 'v', paint: {'circle-radius': 3, 'circle-color': ['match', ['get', 'kind'], 0, '#e33', 1, '#3a3', 2, '#33e', 3, '#ea3', '#888']}};
const scenarios = [
    {
        name: 'vehicles-1k', what: '1,000 moving points, a new FeatureCollection in each frame (live tracking), 180 frames',
        arms: {
            jr: {lib: 'jr', run: async layer => {
                const {host, spec} = window.m;
                let d = {...spec, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [layer], data: {v: window.points(1000, 0)}};
                host.update(d); await window.idle();
                return window.drive({n: 180, step: i => { d = {...d, data: {v: window.points(1000, i)}}; host.update(d); }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async layer => {
                const {map} = window.m;
                map.addSource('v', {type: 'geojson', data: window.points(1000, 0)}); map.addLayer(layer); await window.idle();
                const src = map.getSource('v');
                return window.drive({n: 180, step: i => src.setData(window.points(1000, i)), idle: window.idle, rendered: window.rendered});
            }},
        }, arg: circleLayer,
    },
    {
        name: 'vehicles-10k', what: '10,000 moving points, a new FeatureCollection in every 6th frame (10 per second at 60 fps), 40 updates',
        arms: {
            jr: {lib: 'jr', run: async layer => {
                const {host, spec} = window.m;
                let d = {...spec, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [layer], data: {v: window.points(10000, 0)}};
                host.update(d); await window.idle();
                const pre = Array.from({length: 40}, (_, i) => window.points(10000, i));
                return window.drive({n: 40, every: 6, step: i => { d = {...d, data: {v: pre[i]}}; host.update(d); }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async layer => {
                const {map} = window.m;
                map.addSource('v', {type: 'geojson', data: window.points(10000, 0)}); map.addLayer(layer); await window.idle();
                const src = map.getSource('v'), pre = Array.from({length: 40}, (_, i) => window.points(10000, i));
                return window.drive({n: 40, every: 6, step: i => src.setData(pre[i]), idle: window.idle, rendered: window.rendered});
            }},
        }, arg: circleLayer,
    },
    ...[1, 2].map(every => ({
        name: `vehicles-10k-every-${every}`, what: `10,000 moving points, a new FeatureCollection in every ${every === 1 ? '' : every === 2 ? '2nd ' : every + 'th '}frame, 60 updates`,
        arms: {
            jr: {lib: 'jr', run: new Function('layer', `return (async () => {
                const {host, spec} = window.m;
                let d = {...spec, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [layer], data: {v: window.points(10000, 0)}};
                host.update(d); await window.idle();
                const pre = Array.from({length: 60}, (_, i) => window.points(10000, i));
                return window.drive({n: 60, every: ${every}, step: i => { d = {...d, data: {v: pre[i]}}; host.update(d); }, idle: window.idle, rendered: window.rendered});
            })()`)},
            ml: {lib: 'ml', run: new Function('layer', `return (async () => {
                const {map} = window.m;
                map.addSource('v', {type: 'geojson', data: window.points(10000, 0)}); map.addLayer(layer); await window.idle();
                const src = map.getSource('v'), pre = Array.from({length: 60}, (_, i) => window.points(10000, i));
                return window.drive({n: 60, every: ${every}, step: i => src.setData(pre[i]), idle: window.idle, rendered: window.rendered});
            })()`)},
        }, arg: circleLayer,
    })),
    {
        name: 'one-of-10k', what: '10,000 points, one of them moves in each frame (a selected vehicle), 120 frames',
        arms: {
            jr: {lib: 'jr', run: async layer => {
                // (The main API has no diff of GeoJSON: the application gives a new FeatureCollection with one new feature.)
                const {host, spec} = window.m, fc = window.points(10000, 0);
                let d = {...spec, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [layer], data: {v: fc}};
                host.update(d); await window.idle();
                return window.drive({n: 120, step: i => {
                    const features = fc.features.slice(); features[0] = {...features[0], geometry: {type: 'Point', coordinates: [-74.0065 + i * 0.0001, 40.7085]}}; fc.features = features;
                    d = {...d, data: {v: {type: 'FeatureCollection', features}}}; host.update(d);
                }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async layer => {
                const {map} = window.m;
                map.addSource('v', {type: 'geojson', data: window.points(10000, 0)}); map.addLayer(layer); await window.idle();
                const src = map.getSource('v');
                return window.drive({n: 120, step: i => src.updateData({update: [{id: 0, newGeometry: {type: 'Point', coordinates: [-74.0065 + i * 0.0001, 40.7085]}}]}), idle: window.idle, rendered: window.rendered});
            }},
            'ml-setData': {lib: 'ml', run: async layer => {
                const {map} = window.m, fc = window.points(10000, 0);
                map.addSource('v', {type: 'geojson', data: fc}); map.addLayer(layer); await window.idle();
                const src = map.getSource('v');
                return window.drive({n: 120, step: i => { const features = fc.features.slice(); features[0] = {...features[0], geometry: {type: 'Point', coordinates: [-74.0065 + i * 0.0001, 40.7085]}}; fc.features = features; src.setData({type: 'FeatureCollection', features}); }, idle: window.idle, rendered: window.rendered});
            }},
        }, arg: circleLayer,
    },
    {
        name: 'follow-view', what: 'the application moves the camera in each frame (follow a vehicle), 180 frames',
        arms: {
            jr: {lib: 'jr', run: async () => {
                const {host, spec} = window.m;
                let d = spec;
                return window.drive({n: 180, step: i => { d = {...d, view: {center: [-74.0065 + i * 0.00005, 40.7085 + i * 0.00002], zoom: 14, bearing: i * 0.2}}; host.update(d); }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async () => {
                const {map} = window.m;
                return window.drive({n: 180, step: i => map.jumpTo({center: [-74.0065 + i * 0.00005, 40.7085 + i * 0.00002], zoom: 14, bearing: i * 0.2}), idle: window.idle, rendered: window.rendered});
            }},
        },
    },
    {
        name: 'paint-anim', what: 'a paint property of an added layer changes in each frame (a pulse or a slider), 180 frames',
        arms: {
            jr: {lib: 'jr', run: async layer => {
                const {host, spec} = window.m;
                let d = {...spec, sources: {v: {type: 'geojson', data: window.points(1000, 0)}}, layers: [layer]};
                host.update(d); await window.idle();
                return window.drive({n: 180, step: i => { d = {...d, layers: [{...layer, paint: {...layer.paint, 'circle-radius': 3 + (i % 20) / 4}}]}; host.update(d); }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async layer => {
                const {map} = window.m;
                map.addSource('v', {type: 'geojson', data: window.points(1000, 0)}); map.addLayer(layer); await window.idle();
                return window.drive({n: 180, step: i => map.setPaintProperty('v', 'circle-radius', 3 + (i % 20) / 4), idle: window.idle, rendered: window.rendered});
            }},
        }, arg: circleLayer,
    },
    {
        name: 'style-filter', what: 'a filter of a layer of the style changes in every 3rd frame (a search box), 40 changes',
        arms: {
            // (The main API changes a layer of the style with a new style object.)
            jr: {lib: 'jr', run: async () => {
                const {host, spec} = window.m, style = spec.style, at = style.layers.findIndex(l => l.type === 'symbol' && /poi/.test(l.id));
                let d = spec;
                return window.drive({n: 40, every: 3, step: i => {
                    const layers = style.layers.slice(); layers[at] = {...layers[at], filter: ['>=', ['get', 'rank'], i % 10]};
                    d = {...d, style: {...style, layers}}; host.update(d);
                }, idle: window.idle, rendered: window.rendered});
            }},
            'jr-globalState': {lib: 'jr', run: async () => {
                // (The same with the filter written once with `global-state`, and only the value in the description.)
                const {host, spec} = window.m, style = structuredClone(spec.style), at = style.layers.findIndex(l => l.type === 'symbol' && /poi/.test(l.id));
                style.layers[at].filter = ['>=', ['get', 'rank'], ['global-state', 'rank']]; style.state = {rank: {default: 0}};
                let d = {...spec, style, globalState: {rank: 0}};
                host.update(d); await window.idle();
                return window.drive({n: 40, every: 3, step: i => { d = {...d, globalState: {rank: i % 10}}; host.update(d); }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async () => {
                const {map} = window.m, id = map.getStyle().layers.find(l => l.type === 'symbol' && /poi/.test(l.id)).id;
                return window.drive({n: 40, every: 3, step: i => map.setFilter(id, ['>=', ['get', 'rank'], i % 10]), idle: window.idle, rendered: window.rendered});
            }},
            'ml-diff': {lib: 'ml', run: async () => {
                // (react-map-gl and other wrappers give MapLibre the whole style, and `setStyle` with `diff` finds the change.)
                const {map} = window.m, style = map.getStyle(), at = style.layers.findIndex(l => l.type === 'symbol' && /poi/.test(l.id));
                return window.drive({n: 40, every: 3, step: i => { const layers = style.layers.slice(); layers[at] = {...layers[at], filter: ['>=', ['get', 'rank'], i % 10]}; map.setStyle({...style, layers}, {diff: true}); }, idle: window.idle, rendered: window.rendered});
            }},
        },
    },
    {
        name: 'rerender', what: 'a framework renders again in each frame and makes the description again with the same content (no change), 180 frames',
        arms: {
            // (React: `<MapJr mapStyle={style} layers={[layer]} sources={{v: …}} interactiveLayers={['v']} />` in a component that renders at 60 fps.)
            'jr-same-style': {lib: 'jr', run: async layer => {
                const {host, spec} = window.m, data = window.points(1000, 0);
                const make = () => ({...spec, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [structuredClone(layer)], data: {v: data}, interactiveLayers: ['v'], padding: {top: 10, bottom: 10, left: 10, right: 10}});
                host.update(make()); await window.idle();
                return window.drive({n: 180, step: () => host.update(make()), idle: window.idle, rendered: window.rendered});
            }},
            // (The same with a style object that the component makes again each time: `mapStyle={{...base, …}}`.)
            'jr-new-style': {lib: 'jr', run: async layer => {
                const {host, spec} = window.m, data = window.points(1000, 0);
                const make = () => ({...spec, style: structuredClone(spec.style), sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [structuredClone(layer)], data: {v: data}});
                host.update(make()); await window.idle();
                return window.drive({n: 180, step: () => host.update(make()), idle: window.idle, rendered: window.rendered});
            }},
            'ml-diff': {lib: 'ml', run: async () => {
                const {map} = window.m, style = map.getStyle();
                return window.drive({n: 180, step: () => map.setStyle(structuredClone(style), {diff: true}), idle: window.idle, rendered: window.rendered});
            }},
        }, arg: circleLayer,
    },
    {
        name: 'overlays-200', what: '200 HTML overlays (markers) move in each frame, 120 frames',
        arms: {
            jr: {lib: 'jr', run: async () => {
                const {host} = window.m, list = [];
                for (let k = 0; k < 200; k++) { const e = document.createElement('div'); e.style.cssText = 'width:10px;height:10px;background:#e33;border-radius:5px'; list.push(host.overlay(e, {lngLat: [-74.0065, 40.7085]})); }
                await window.idle();
                return window.drive({n: 120, step: i => { for (let k = 0; k < 200; k++) { const a = k * 2.399 + i * 0.03; list[k].update({lngLat: [-74.0065 + Math.cos(a) * 0.01, 40.7085 + Math.sin(a) * 0.007]}); } }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async () => {
                const {map, ml} = window.m, list = [];
                for (let k = 0; k < 200; k++) { const e = document.createElement('div'); e.style.cssText = 'width:10px;height:10px;background:#e33;border-radius:5px'; list.push(new ml.Marker({element: e}).setLngLat([-74.0065, 40.7085]).addTo(map)); }
                await window.idle();
                return window.drive({n: 120, step: i => { for (let k = 0; k < 200; k++) { const a = k * 2.399 + i * 0.03; list[k].setLngLat([-74.0065 + Math.cos(a) * 0.01, 40.7085 + Math.sin(a) * 0.007]); } }, idle: window.idle, rendered: window.rendered});
            }},
        },
    },
    {
        name: 'global-state-anim', what: 'a value of global-state that a data-driven paint property reads changes in each frame (a time slider), 180 frames',
        arms: {
            jr: {lib: 'jr', run: async layer => {
                const {host, spec} = window.m, style = {...spec.style, state: {...spec.style.state, t: {default: 0}}};
                const l = {...layer, paint: {...layer.paint, 'circle-radius': ['+', 2, ['%', ['+', ['get', 'kind'], ['global-state', 't']], 5]]}};
                let d = {...spec, style, sources: {v: {type: 'geojson', data: window.points(1000, 0)}}, layers: [l], globalState: {t: 0}};
                host.update(d); await window.idle();
                return window.drive({n: 180, step: i => { d = {...d, globalState: {t: i % 5}}; host.update(d); }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async layer => {
                const {map} = window.m;
                map.addSource('v', {type: 'geojson', data: window.points(1000, 0)});
                map.addLayer({...layer, paint: {...layer.paint, 'circle-radius': ['+', 2, ['%', ['+', ['get', 'kind'], ['global-state', 't']], 5]]}});
                map.setGlobalStateProperty('t', 0); await window.idle();
                return window.drive({n: 180, step: i => map.setGlobalStateProperty('t', i % 5), idle: window.idle, rendered: window.rendered});
            }},
        }, arg: circleLayer,
    },
    {
        name: 'feature-state-anim', what: 'feature-state of 50 of 1,000 points changes in each frame (a selection that moves), 120 frames',
        arms: {
            jr: {lib: 'jr', run: async layer => {
                const {host, spec} = window.m, l = {...layer, paint: {...layer.paint, 'circle-radius': ['case', ['boolean', ['feature-state', 'on'], false], 8, 3]}};
                host.update({...spec, sources: {v: {type: 'geojson', data: window.points(1000, 0)}}, layers: [l]}); await window.idle();
                return window.drive({n: 120, step: i => { for (let k = 0; k < 50; k++) { host.setFeatureState({source: 'v', id: (i * 50 + k) % 1000}, {on: true}); host.setFeatureState({source: 'v', id: ((i - 1) * 50 + k + 1000) % 1000}, {on: false}); } }, idle: window.idle, rendered: window.rendered});
            }},
            ml: {lib: 'ml', run: async layer => {
                const {map} = window.m;
                map.addSource('v', {type: 'geojson', data: window.points(1000, 0)});
                map.addLayer({...layer, paint: {...layer.paint, 'circle-radius': ['case', ['boolean', ['feature-state', 'on'], false], 8, 3]}}); await window.idle();
                return window.drive({n: 120, step: i => { for (let k = 0; k < 50; k++) { map.setFeatureState({source: 'v', id: (i * 50 + k) % 1000}, {on: true}); map.setFeatureState({source: 'v', id: ((i - 1) * 50 + k + 1000) % 1000}, {on: false}); } }, idle: window.idle, rendered: window.rendered});
            }},
        }, arg: circleLayer,
    },
    {
        name: 'two-maps', what: 'map B follows map A, which moves in each frame (a synced overview), 120 frames; "lag" is the frames where B is behind A',
        two: true,
        arms: {
            jr: {lib: 'jr', run: async () => {
                const {host, spec, lib} = window.m;
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:700px;width:400px;height:300px'}));
                let bSpec = {style: spec.style, initialView: spec.initialView, attribution: false};
                const b = lib.createMap(el, bSpec);
                await new Promise(r => b.state.subscribe(s => s.idle && s.loaded, v => v && r()));
                host.update({...spec, onViewChange: v => { bSpec = {...bSpec, view: {center: v.center, zoom: v.zoom - 2, bearing: v.bearing}}; b.update(bSpec); }});
                let lag = 0;
                const r = await window.drive({n: 120, step: i => {
                    host.moveTo({center: [-74.0065 + i * 0.00005, 40.7085], zoom: 14});
                    const a = host.state.get().view.center, bc = b.state.get().view.center;
                    if (Math.abs(a[0] - bc[0]) > 1e-9) lag++;
                }, idle: window.idle, rendered: window.rendered});
                return {...r, lag};
            }},
            ml: {lib: 'ml', run: async () => {
                const {map, ml} = window.m;
                const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:700px;width:400px;height:300px'}));
                const b = new ml.Map({container: el, style: map.getStyle(), center: map.getCenter(), zoom: map.getZoom() - 2, attributionControl: false});
                await new Promise(r => b.once('idle', r));
                map.on('move', () => b.jumpTo({center: map.getCenter(), zoom: map.getZoom() - 2, bearing: map.getBearing()}));
                let lag = 0;
                const r = await window.drive({n: 120, step: i => {
                    map.jumpTo({center: [-74.0065 + i * 0.00005, 40.7085], zoom: 14});
                    if (Math.abs(map.getCenter().lng - b.getCenter().lng) > 1e-9) lag++;
                }, idle: window.idle, rendered: window.rendered});
                return {...r, lag};
            }},
        },
    },
];

// Vue: `<MapJr>` with props that change in each frame. The page loads Vue from node_modules through an import map.
const vueScenarios = [
    {
        name: 'vue-reactive-style', what: 'Vue: a paint property of a layer of a reactive style object changes in every 3rd frame (style.layers[i].paint[…] = …), 40 changes',
        arms: {
            'vue-ref-style': {mode: 'ref-style'},
            'vue-layers-prop': {mode: 'layers-prop'},
            'ml': {mode: 'ml'},
        },
    },
    {
        name: 'vue-v-model-view', what: 'Vue: v-model:view while the map moves in each frame (the view goes to the parent and comes back), 120 frames',
        arms: {
            'vue-v-model': {mode: 'v-model'},
            'vue-no-model': {mode: 'no-model'},
        },
    },
    {
        name: 'vue-data', what: 'Vue: 1,000 points in a ref (deep) or a shallowRef, a new FeatureCollection in each frame, 120 frames',
        arms: {
            'vue-ref': {mode: 'data-ref'},
            'vue-shallowRef': {mode: 'data-shallow'},
        },
    },
];

const vuePage = async ({mode, style, view, renderer}) => {
    if (mode === 'ml') {
        // (The same edit in MapLibre GL JS: one `setPaintProperty`.)
        const ml = await import('/ml/maplibre-gl.mjs');
        ml.setWorkerUrl('/ml/maplibre-gl-worker.mjs');
        const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:1000px;height:700px'}));
        const map = new ml.Map({container: el, style, center: view.center, zoom: view.zoom, attributionControl: false});
        let renders = 0; map.on('render', () => renders++);
        await new Promise(r => map.once('idle', r));
        const id = style.layers.find(l => l.type === 'line' && /road|highway|transportation/.test(l.id)).id;
        const idle = () => new Promise(r => { if (map.loaded() && map.areTilesLoaded()) setTimeout(r, 0); else map.once('idle', () => r()); });
        return window.drive({n: 40, every: 3, step: i => map.setPaintProperty(id, 'line-color', `hsl(${i * 9}, 70%, 50%)`), idle, rendered: () => renders});
    }
    const vue = await import('vue'), {MapJr} = await import('/dist/vue.js');
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:fixed;left:0;top:0;width:1000px;height:700px'}));
    const roadAt = style.layers.findIndex(l => l.type === 'line' && /road|highway|transportation/.test(l.id));
    let api;
    const state = {
        styleRef: vue.ref(structuredClone(style)),
        layers: vue.ref([{id: 'v', type: 'circle', source: 'v', paint: {'circle-radius': 3, 'circle-color': '#e33'}}]),
        view: vue.ref({...view, bearing: 0, pitch: 0}),
        dataRef: vue.ref({v: window.points(1000, 0)}),
        dataShallow: vue.shallowRef({v: window.points(1000, 0)}),
        echoes: 0,
    };
    const App = {setup() {
        const mapRef = vue.ref(null);
        api = {mapRef};
        return () => {
            const props = {ref: mapRef, attribution: false, renderer, style: 'position:absolute;inset:0'};
            if (mode === 'ref-style') Object.assign(props, {mapStyle: state.styleRef.value, initialView: view});
            if (mode === 'layers-prop') Object.assign(props, {mapStyle: style, initialView: view, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: state.layers.value, data: {v: window.points(1000, 0)}});
            if (mode === 'v-model') Object.assign(props, {mapStyle: style, view: state.view.value, 'onUpdate:view': v => { state.echoes++; state.view.value = v; }});
            if (mode === 'no-model') Object.assign(props, {mapStyle: style, initialView: view});
            if (mode === 'data-ref') Object.assign(props, {mapStyle: style, initialView: view, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'v', type: 'circle', source: 'v'}], data: state.dataRef.value});
            if (mode === 'data-shallow') Object.assign(props, {mapStyle: style, initialView: view, sources: {v: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers: [{id: 'v', type: 'circle', source: 'v'}], data: state.dataShallow.value});
            return vue.h('div', {style: 'position:absolute;inset:0'}, [vue.h(MapJr, props)]);
        };
    }};
    vue.createApp(App).mount(el);
    while (!api.mapRef.value?.map) await new Promise(r => setTimeout(r, 20));
    const host = api.mapRef.value.map;
    let renders = 0; host.listen('render', () => renders++); host.listen('style.load', () => window.bench.loads++);
    const idle = () => new Promise(r => { const go = () => setTimeout(() => host.state.get().idle ? r() : host.state.subscribe(s => s.idle, v => v && r()), 50); if (host.state.get().idle) go(); else { const stop = host.state.subscribe(s => s.idle, v => { if (v) { stop(); go(); } }); } });
    await new Promise(r => host.state.subscribe(s => s.idle && s.loaded, v => v && r()));
    await idle();
    // (Vue applies a change in a microtask, and the map gets it after the render: the time of a step includes both.)
    const tick = async fn => { fn(); await vue.nextTick(); };
    const timed = async (n, every, fn) => {
        // `drive` measures a synchronous step; here each step also waits for Vue's flush, so the time is measured around it.
        const calls = [], stamps = []; window.bench.long = 0; window.bench.loads = 0; const d0 = renders;
        for (let i = 0; i < n; i++) {
            for (let f = 0; f < every; f++) await new Promise(r => requestAnimationFrame(t => { stamps.push(t); r(); }));
            const t0 = performance.now(); await tick(() => fn(i)); calls.push(performance.now() - t0);
        }
        const last = performance.now(), drawn = renders - d0; await idle();
        const s = [...calls].sort((a, b) => a - b), gaps = stamps.slice(1).map((t, k) => t - stamps[k]).sort((a, b) => a - b);
        return {call: s[s.length >> 1], worst: s[s.length - 1], frame: gaps[gaps.length >> 1], frame95: gaps[Math.floor(gaps.length * 0.95)], long: window.bench.long, drawn, steps: n, settle: performance.now() - last, echoes: state.echoes, loads: window.bench.loads};
    };
    if (mode === 'ref-style') return timed(40, 3, i => { state.styleRef.value.layers[roadAt].paint['line-color'] = `hsl(${i * 9}, 70%, 50%)`; });
    if (mode === 'layers-prop') return timed(40, 3, i => { state.layers.value[0].paint['circle-radius'] = 3 + i % 5; });
    if (mode === 'v-model' || mode === 'no-model') return timed(120, 1, i => host.moveTo({center: [-74.0065 + i * 0.00005, 40.7085], zoom: 14}));
    if (mode === 'data-ref') return timed(120, 1, i => { state.dataRef.value.v = window.points(1000, i); });
    if (mode === 'data-shallow') return timed(120, 1, i => { state.dataShallow.value = {v: window.points(1000, i)}; });
};

const browser = await chromium.launch({args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
const style = await (await fetch(STYLE)).json();
delete style.terrain; delete style.sky;

async function page() {
    const p = await browser.newPage({viewport: {width: 1000, height: 1000}});
    p.on('pageerror', e => console.error('  page error:', e.message));
    // (A page of the demo server's origin with an import map for Vue, which must come before the first module import.)
    await p.route(`${origin}/vuejs`, r => r.fulfill({contentType: 'text/javascript', body: readFileSync(path.join(root, 'node_modules/vue/dist/vue.esm-browser.prod.js'))}));
    await p.route(`${origin}/reactivity.html`, r => r.fulfill({contentType: 'text/html', body: '<!doctype html><script type="importmap">{"imports":{"vue":"/vuejs"}}</script><body style="margin:0"></body>'}));
    await p.addInitScript(prelude);
    await p.goto(`${origin}/reactivity.html`);
    return p;
}

const results = [];
const fmt = n => n === undefined ? '' : n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
for (const s of [...scenarios, ...vueScenarios]) {
    if (filter && !filter.test(s.name)) continue;
    console.log(`\n${s.name}: ${s.what}`);
    console.log('  arm              call ms  worst ms  frame ms  p95 ms  long ms  drawn/steps  settle ms' + (s.two ? '  lag' : ''));
    for (const [arm, spec] of Object.entries(s.arms)) {
        for (let r = 0; r < runs; r++) {
            const p = await page();
            try {
                let res;
                if (spec.mode) {
                    res = await p.evaluate(async ([fn, o]) => { const f = new Function('return ' + fn)(); return f(o); }, [vuePage.toString(), {mode: spec.mode, style, view: VIEW, renderer: process.env.RENDERER ?? 'auto'}]);
                } else {
                    await p.evaluate(async ([fn, o]) => { const f = new Function('return ' + fn)(); await f(o); }, [setups[spec.lib].toString(), {style, view: VIEW, renderer: process.env.RENDERER ?? 'auto'}]);
                    res = await p.evaluate(async ([fn, arg]) => { const f = new Function('return ' + fn)(); return f(arg); }, [spec.run.toString(), s.arg]);
                }
                results.push({scenario: s.name, arm, ...res});
                console.log(`  ${arm.padEnd(16)} ${fmt(res.call).padStart(7)}  ${fmt(res.worst).padStart(8)}  ${fmt(res.frame).padStart(8)}  ${fmt(res.frame95).padStart(6)}  ${fmt(res.long).padStart(7)}  ${String(res.drawn + '/' + res.steps).padStart(11)}  ${fmt(res.settle).padStart(9)}` + (res.lag !== undefined ? `  ${res.lag}` : '') + (res.echoes !== undefined ? `  echoes ${res.echoes}` : '') + (res.loads ? `  style loads ${res.loads}` : ''));
            } catch (e) {
                console.log(`  ${arm.padEnd(16)} FAILED: ${e.message.split('\n')[0]}`);
            } finally { await p.close(); }
        }
    }
}
if (args.json) (await import('node:fs')).writeFileSync(args.json, JSON.stringify(results, null, 1));
await browser.close();
