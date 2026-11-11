// @vis.gl/react-maplibre (the MapLibre part of react-map-gl): a map as a React component, with a control, a marker,
// a popup, a source and a layer as children.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Map, Marker, Popup, Source, Layer, NavigationControl} from '@vis.gl/react-maplibre';
export async function run({lib, wait, style}) {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'react', style: 'position:absolute;inset:0'}));
    const seen = new Set(), h = React.createElement;
    let ref = null;
    const data = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-74.0, 40.71]}}]};
    const App = () => h(Map, {mapLib: lib, mapStyle: style, initialViewState: {longitude: -74.0065, latitude: 40.7085, zoom: 12}, style: {width: '100%', height: '100%'},
        ref: r => { ref = r; }, onLoad: () => seen.add('load'), onMove: () => seen.add('move'), onError: e => seen.add('error: ' + (e.error?.message ?? ''))},
        h(NavigationControl, {position: 'top-right'}),
        h(Marker, {longitude: -74.0065, latitude: 40.7085}),
        h(Popup, {longitude: -74.0065, latitude: 40.7085, closeOnClick: false, offset: 12, maxWidth: '200px'}, 'A popup from React'),
        h(Source, {id: 'points', type: 'geojson', data}, h(Layer, {id: 'points', type: 'circle', paint: {'circle-radius': 8, 'circle-color': '#e33'}})));
    createRoot(el).render(h(App));
    for (let i = 0; i < 100 && !seen.has('load'); i++) await wait(100);
    await wait(500);
    const map = ref?.getMap?.();
    ref?.jumpTo?.({center: [-73.99, 40.72], zoom: 13});
    await wait(800);
    const layer = !!map?.getLayer('points'), marker = !!el.querySelector('.maplibregl-marker'), control = !!el.querySelector('.maplibregl-ctrl-group button'), popup = el.querySelector('.maplibregl-popup')?.textContent ?? '', zoom = map?.getZoom();
    return {ok: seen.has('load') && layer && marker && control && popup.includes('A popup from React') && Math.abs(zoom - 13) < 0.01 && seen.has('move') && ![...seen].some(s => s.startsWith('error')),
        detail: `events: ${[...seen].join(', ')}; layer from <Layer>: ${layer}; marker: ${marker}; control: ${control}; popup: ${popup.includes('A popup from React')}; zoom after jumpTo: ${zoom?.toFixed(2)}`};
}
