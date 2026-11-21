// svelte-maplibre-gl: a map as a Svelte component, with a control, a source, a layer, a marker and the control Hash as children.
// (It needs `Hash` and the names of the sources from the entry; see #1261.)
import {mount} from 'svelte';
import App from './svelte-gl-app.svelte';
export async function run({wait, style}) {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;inset:0'}));
    const seen = new Set();
    let map = null;
    mount(App, {target: el, props: {style, onready: (m, loaded) => { map = m; if (loaded) seen.add('load'); }}});
    for (let i = 0; i < 100 && !(seen.has('load') && map?.getLayer('points')); i++) await wait(100);
    await wait(800);
    const layer = !!map?.getLayer('points'), marker = !!el.querySelector('.maplibregl-marker'), control = !!el.querySelector('.maplibregl-ctrl-group button');
    const hash = /^#[\d.]+\/-?[\d.]+\/-?[\d.]+/.test(location.hash);
    return {ok: seen.has('load') && layer && marker && control && hash,
        detail: `load: ${seen.has('load')}; layer from <CircleLayer>: ${layer}; marker: ${marker}; control: ${control}; the fragment has the camera from <Hash>: ${hash} (${location.hash})`};
}
