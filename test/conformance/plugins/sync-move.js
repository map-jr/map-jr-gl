// @mapbox/mapbox-gl-sync-move: a second map follows the first.
import syncMaps from '@mapbox/mapbox-gl-sync-move';
export async function run({lib, map, wait, style}) {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {style: 'position:absolute;right:0;top:0;width:300px;height:300px'}));
    const other = new lib.Map({container: el, style, center: [0, 0], zoom: 2});
    await new Promise(r => other.once('load', r));
    syncMaps(map, other);
    map.jumpTo({center: [10, 50], zoom: 6});
    await wait(1000);
    const c = other.getCenter();
    return {ok: Math.abs(c.lng - 10) < 0.01 && Math.abs(other.getZoom() - 6) < 0.01, detail: `the second map is at ${c.lng.toFixed(2)}, ${c.lat.toFixed(2)}, zoom ${other.getZoom().toFixed(2)}`};
}
