// TypeScript code for the main API (`map-jr-gl`), as the documentation and the gallery write it.
// `node test/examples.mjs` checks that it compiles against the built types (dist/types). It is not run.
import {createMap, type MapEvents, type MapSpec, type Position, type RenderedFeature, type View} from 'map-jr-gl';
import {navigation} from 'map-jr-gl/controls';

// A position that is declared apart from the call has the type number[].
const NYC = [-74.0065, 40.7085];
const FIXED = [-74.0065, 40.7085] as const;
const places = [[-74.0134, 40.7033], [-74.009, 40.7061]];
const pins = {id: 'pins', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', width: 14, height: 14, data: places.map(lngLat => ({lngLat, props: {color: '#d6453d'}}))};

const description: MapSpec = {
    style: 'https://demotiles.maplibre.org/style.json',
    initialView: {center: NYC, zoom: 13.6},
    view: {center: FIXED},
    markers: [pins],
    controls: [navigation(), {key: 'own', create: () => ({onAdd: map => { map.getZoom(); return document.createElement('div'); }, onRemove() {}})}],
    interactiveLayers: ['parks'],
    onViewChange: view => { const [lng, lat]: [number, number] = view.center; console.log(lng, lat); },
    onClick: e => console.log(e.features[0]?.layer.id, e.lngLat[0]),
};
const map = createMap('map', description);

// The style layer of a feature under the pointer.
map.state.subscribe(state => {
    const feature: RenderedFeature | undefined = state.hover[0];
    const id: string | undefined = state.hover[0]?.layer.id;
    console.log(feature ? feature.layer.type : 'nothing', id, feature?.layer.paint?.['fill-color']);
});

// Positions as input.
map.moveTo({center: NYC, zoom: 12, duration: 300});
map.project(NYC).x.toFixed(0);
map.queryElevation(NYC).then(metres => metres?.toFixed(0));
map.queryFeatures(NYC, {sources: ['rain']});
map.queryFeatures([{x: 0, y: 0}, {x: 400, y: 300}], {layers: ['places']});
map.watchFeatures(FIXED, {sources: ['rain']}, features => console.log(features.length));
const overlay = map.overlay(document.createElement('div'), {lngLat: NYC, anchor: 'bottom'});
overlay.update({lngLat: map.unproject({x: 10, y: 10})});
const given: Position = map.state.get().view.center;
const view: View = map.state.get().view;
console.log(given, view);

// The event follows from the type of the event.
map.listen('markerclick', e => e.layer.openPopup(e.index, `Marker at ${e.marker.lngLat.map(v => v.toFixed(3)).join(', ')}`));
map.listen('stats', e => console.log(e.fps.toFixed(0), e.frameMs));
map.listen('click', e => { e.preventDefault(); console.log(e.point.x, e.lngLat.lng, e.originalEvent.button, e.marker?.index, e.target.getZoom()); });
map.listen('wheel', e => console.log(e.originalEvent.deltaY));
map.listen('touchmove', e => console.log(e.points.length, e.lngLats[0].lat));
map.listen('sourcedata', e => console.log(e.sourceId, e.dataType === 'source'));
map.listen('error', e => console.log(e.error instanceof Error ? e.error.message : e.error));
const stop: () => void = map.listen('moveend', e => console.log(e.type === 'moveend'));
stop();
const names: (keyof MapEvents)[] = ['load', 'idle', 'move', 'zoomend', 'style.load', 'boxzoomend', 'geolocate'];
console.log(names);

// Mistakes that the types find.
// @ts-expect-error -- there is no event with this type
map.listen('markerclik', () => {});
// @ts-expect-error -- the event of 'stats' has no such member
map.listen('stats', e => e.nothing.here);
// @ts-expect-error -- the event of 'move' has no point
map.listen('move', e => e.point.x);
// @ts-expect-error -- a position is an array of numbers
map.moveTo({center: ['-74', '40.7']});
