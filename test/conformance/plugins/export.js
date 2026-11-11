// @watergis/maplibre-gl-export: the export control is added to the map.
import {MaplibreExportControl} from '@watergis/maplibre-gl-export';
export async function run({map, wait}) {
    map.addControl(new MaplibreExportControl({}), 'top-right');
    await wait(300);
    return {ok: !!document.querySelector('[class*=export]'), detail: 'the control is in the page'};
}
