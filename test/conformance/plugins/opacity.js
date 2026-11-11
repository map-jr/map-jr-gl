// maplibre-gl-opacity: a control with a slider for the opacity of a layer.
import OpacityControl from 'maplibre-gl-opacity';
export async function run({map, wait}) {
    const layer = map.getStyle().layers.find(l => l.type === 'fill').id;
    map.addControl(new OpacityControl({overLayers: {[layer]: 'Fill'}, opacityControl: true}), 'top-right');
    await wait(300);
    const slider = document.querySelector('#' + CSS.escape(layer) + ', input[type=range]');
    if (slider) { slider.value = 30; slider.dispatchEvent(new Event('input')); }
    await wait(300);
    const v = map.getPaintProperty(layer, 'fill-opacity');
    return {ok: !!slider, detail: `the control is in the page: ${!!slider}; fill-opacity after the slider: ${JSON.stringify(v)}`};
}
