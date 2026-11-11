// @maplibre/maplibre-gl-inspect: the inspect control, switched on.
import MaplibreInspect from '@maplibre/maplibre-gl-inspect';
export async function run({lib, map, wait}) {
    const inspect = new MaplibreInspect({popup: new lib.Popup({closeButton: false, closeOnClick: false})});
    map.addControl(inspect);
    await wait(500);
    inspect.toggleInspector();
    await wait(1500);
    return {ok: true, detail: `the inspect view is on; the style has ${map.getStyle().layers.length} layers`};
}
