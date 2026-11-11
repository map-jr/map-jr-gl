// @mapbox/mapbox-gl-draw: add a polygon, select it with a click, move it with a drag.
import MapboxDraw from '@mapbox/mapbox-gl-draw';
export async function run({map, mouse, wait}) {
    const draw = new MapboxDraw({displayControlsDefault: false, controls: {polygon: true, trash: true}});
    map.addControl(draw);
    const c = map.getCenter(), d = 0.004;
    const [id] = draw.add({type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]]]}});
    await wait(1500);
    const p = map.project(c), before = map.getCenter();
    await mouse.click(p.x, p.y);
    await wait(300);
    const selected = draw.getSelectedIds().length;
    await mouse.drag(p.x, p.y, p.x + 60, p.y + 40);
    await wait(500);
    const moved = draw.get(id).geometry.coordinates[0][0][0] !== c.lng - d, panned = Math.abs(map.getCenter().lng - before.lng) > 1e-9;
    return {ok: selected === 1 && moved && !panned, detail: `added ${draw.getAll().features.length}, selected by a click: ${selected}, moved by a drag: ${moved}, the map panned: ${panned}`};
}
