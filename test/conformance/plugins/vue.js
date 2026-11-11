// @indoorequal/vue-maplibre-gl: a map as a Vue component, with a control, a marker, a source and a layer as children.
import {createApp, h} from 'vue';
import {MglMap, MglNavigationControl, MglMarker, MglGeoJsonSource, MglCircleLayer} from '@indoorequal/vue-maplibre-gl';
export async function run({wait, style}) {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'vue', style: 'position:absolute;inset:0'}));
    const seen = new Set();
    let map = null;
    const data = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [-74.0, 40.71]}}]};
    createApp({
        render: () => h(MglMap, {mapStyle: style, center: [-74.0065, 40.7085], zoom: 12, style: 'width:100%;height:100%',
            'onMap:load': e => { seen.add('load'); map = e.map; }, 'onMap:error': e => seen.add('error: ' + (e.event?.error?.message ?? ''))}, () => [
            h(MglNavigationControl, {position: 'top-right'}),
            h(MglMarker, {coordinates: [-74.0065, 40.7085]}),
            h(MglGeoJsonSource, {sourceId: 'points', data}, () => h(MglCircleLayer, {layerId: 'points', paint: {'circle-radius': 8, 'circle-color': '#e33'}})),
        ]),
    }).mount(el);
    for (let i = 0; i < 100 && !seen.has('load'); i++) await wait(100);
    await wait(800);
    const layer = !!map?.getLayer('points'), marker = !!el.querySelector('.maplibregl-marker'), control = !!el.querySelector('.maplibregl-ctrl-group button');
    return {ok: seen.has('load') && layer && marker && control && ![...seen].some(s => s.startsWith('error')),
        detail: `events: ${[...seen].join(', ')}; layer from <MglCircleLayer>: ${layer}; marker: ${marker}; control: ${control}`};
}
