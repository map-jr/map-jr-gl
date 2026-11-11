// @maplibre/maplibre-gl-compare: two maps with a slider between them.
import Compare from '@maplibre/maplibre-gl-compare';
export async function run({lib, map, wait, style}) {
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {id: 'second', style: 'position:absolute;inset:0'}));
    const other = new lib.Map({container: el, style, center: map.getCenter(), zoom: map.getZoom()});
    await new Promise(r => other.once('load', r));
    const compare = new Compare(map, other, '#stage');
    compare.setSlider(200);
    await wait(300);
    map.jumpTo({zoom: map.getZoom() + 1});
    await wait(1000);
    return {ok: !!document.querySelector('.maplibregl-compare, .compare-swiper-vertical, [class*=compare]') && Math.abs(other.getZoom() - map.getZoom()) < 0.01, detail: `slider at ${compare.currentPosition}, zooms ${map.getZoom().toFixed(2)} and ${other.getZoom().toFixed(2)}`};
}
