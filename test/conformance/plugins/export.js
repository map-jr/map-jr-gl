// @watergis/maplibre-gl-export: the export control is added to the map. The scenario does not export an image: the
// generator of the plugin reads `map._requestManager._transformRequestFn`, a private member of MapLibre GL JS that the
// compat map does not have, and throws before it draws (#719).
import {MaplibreExportControl} from '@watergis/maplibre-gl-export';
export async function run({map, wait}) {
    map.addControl(new MaplibreExportControl({}), 'top-right');
    await wait(300);
    return {ok: !!document.querySelector('[class*=export]'), detail: 'the control is in the page (an export of an image is not tested: the plugin reads map._requestManager, which the compat map does not have)'};
}
