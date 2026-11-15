// @vis.gl/react-maplibre (the MapLibre part of react-map-gl) with a controlled map: `viewState` and `onMove`. MapLibre
// GL JS calls the function that react-map-gl gives to `setTransformCameraUpdate` before each frame, so that the map
// never draws a camera that differs from `viewState`. The scenario checks three cases: a drag that the state follows,
// a change of the state from outside, and an `onMove` that keeps the latitude below a limit.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Map} from '@vis.gl/react-maplibre';
export async function run({lib, wait, style, mouse}) {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'react', style: 'position:absolute;inset:0'}));
    const h = React.createElement, warnings = [], warn = console.warn;
    console.warn = (...a) => { warnings.push(String(a[0])); warn(...a); };
    let ref = null, setView = null, limit = Infinity, loaded = false, view = null;
    const App = () => {
        const [viewState, set] = React.useState({longitude: -74.0065, latitude: 40.7085, zoom: 12});
        setView = set; view = viewState;
        return h(Map, {mapLib: lib, mapStyle: style, viewState, style: {width: '100%', height: '100%'}, ref: r => { ref = r; }, onLoad: () => { loaded = true; },
            onMove: e => set({...e.viewState, latitude: Math.min(e.viewState.latitude, limit)})});
    };
    createRoot(el).render(h(App));
    for (let i = 0; i < 100 && !loaded; i++) await wait(100);
    await wait(500);
    const map = ref.getMap(), near = (a, b) => Math.abs(a - b) < 1e-6;
    // (After each step the map and the state must agree.)
    const agree = () => near(map.getCenter().lng, view.longitude) && near(map.getCenter().lat, view.latitude) && near(map.getZoom(), view.zoom);
    // 1. A drag: the state follows the map.
    const before = view.longitude;
    await mouse.drag(450, 300, 300, 300);
    await wait(1500);
    const drag = view.longitude !== before && agree();
    // 2. The state changes from outside: the map follows the state.
    setView(v => ({...v, longitude: -73.99, latitude: 40.72, zoom: 13}));
    await wait(800);
    const outside = near(map.getCenter().lng, -73.99) && near(map.getZoom(), 13) && agree();
    // 3. onMove keeps the latitude at or below the current one, and a drag downwards would move the map north.
    const warnedBefore = warnings.filter(w => w.includes('setTransformCameraUpdate')).length;
    limit = view.latitude;
    let highest = -90;
    const track = () => { highest = Math.max(highest, map.getCenter().lat); };
    map.on('move', track);
    await mouse.drag(450, 200, 450, 400);
    await wait(1500);
    map.off('move', track);
    const lat = map.getCenter().lat, clamped = lat <= limit + 1e-6 && agree(), during = highest - limit;
    console.warn = warn;
    const warned = warnings.filter(w => w.includes('setTransformCameraUpdate'));
    return {ok: drag && outside && clamped,
        detail: `drag followed by the state: ${drag}; state change from outside: ${outside}; onMove that limits the latitude: ${clamped} (after the drag: map ${lat.toFixed(5)}, limit ${limit.toFixed(5)}; during the drag the map went ${during.toFixed(5)}° past the limit); warnings about setTransformCameraUpdate: ${warnedBefore} before the limit, ${warned.length - warnedBefore} after it`};
}
