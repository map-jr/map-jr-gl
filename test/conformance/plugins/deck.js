// deck.gl: its overlay for MapLibre (MapboxOverlay) as a control, with one layer of points on its own canvas.
import {MapboxOverlay} from '@deck.gl/mapbox';
import {ScatterplotLayer} from '@deck.gl/layers';
export async function run({map, wait}) {
    const data = [{position: [-74.0065, 40.7085]}, {position: [-74.0, 40.715]}];
    let drawn = 0;
    const overlay = new MapboxOverlay({interleaved: false, onAfterRender: () => drawn++,
        layers: [new ScatterplotLayer({id: 'points', data, getPosition: d => d.position, getRadius: 120, getFillColor: [230, 50, 50], pickable: true})]});
    map.addControl(overlay);
    await wait(1500);
    const before = drawn;
    map.jumpTo({center: [-74.0, 40.715], zoom: 14, pitch: 40, bearing: 20});
    await wait(1500);
    const canvas = [...map.getContainer().querySelectorAll('canvas')].find(c => c !== map.getCanvas());
    // The point at the map centre must be at the centre of the deck.gl canvas: its view follows the map.
    const picked = overlay.pickObject({x: map.getContainer().clientWidth / 2, y: map.getContainer().clientHeight / 2, radius: 4});
    map.removeControl(overlay);
    return {ok: !!canvas && before > 0 && drawn > before && picked?.object === data[1],
        detail: `deck.gl canvas: ${!!canvas}; frames drawn: ${before} then ${drawn}; the point at the map centre was picked there: ${picked?.object === data[1]}`};
}
