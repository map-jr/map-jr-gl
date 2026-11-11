// @geoman-io/maplibre-geoman-free: drawing and editing of shapes. The scenario starts it, imports a polygon and
// reads it back, and draws a marker with a click.
import {Geoman} from '@geoman-io/maplibre-geoman-free';
export async function run({map, wait, mouse}) {
    const geoman = new Geoman(map, {});
    await new Promise(resolve => { map.on('gm:loaded', resolve); setTimeout(resolve, 8000); });
    const c = map.getCenter(), d = 0.004;
    await geoman.features.importGeoJsonFeature({type: 'Feature', properties: {shape: 'polygon'}, geometry: {type: 'Polygon', coordinates: [[[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]]]}});
    await wait(800);
    const imported = geoman.features.exportGeoJson().features.length;
    await geoman.enableDraw('marker');
    await wait(300);
    await mouse.click(300, 250);
    await wait(1000);
    const after = geoman.features.exportGeoJson().features.length, layers = map.getStyle().layers.filter(l => String(l.source).startsWith('gm_')).length;
    return {ok: imported === 1 && after === 2 && layers > 0, detail: `features after the import: ${imported}; after a marker was drawn with a click: ${after}; layers of the plugin: ${layers}`};
}
