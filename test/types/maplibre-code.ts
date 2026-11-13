// Common TypeScript code for MapLibre GL JS, with the import changed to `@map-jr/map-jr-gl/maplibre-compat`.
// `node test/examples.mjs` checks that it compiles against the built types (dist/types). It is not run.
import {Map, Popup, type MapMouseEvent, type MapLayerMouseEvent, type GeoJSONSource, type LayerSpecification, type MapGeoJSONFeature} from '@map-jr/map-jr-gl/maplibre-compat';

const map = new Map({container: 'map', style: 'https://demotiles.maplibre.org/style.json', center: [0, 0], zoom: 2});

map.on('load', () => {
    map.addSource('places', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
    map.addLayer({id: 'route', type: 'line', source: 'places'});
    map.addLayer({id: 'dots', type: 'circle', source: 'places', paint: {'circle-radius': 6, 'circle-color': '#b42222'}, layout: {visibility: 'visible'}, filter: ['==', '$type', 'Point']}, 'route');
    const layer: LayerSpecification = {id: 'labels', type: 'symbol', source: 'places', layout: {'text-field': ['get', 'name']}};
    map.addLayer(layer);
    map.getSource<GeoJSONSource>('places')?.setData({type: 'FeatureCollection', features: []});
    (map.getSource('places') as GeoJSONSource).setData({type: 'FeatureCollection', features: []});
});

// The event follows from the name of the event.
map.on('click', e => { new Popup().setLngLat([e.lngLat.lng, e.lngLat.lat]).setHTML(`${e.point.x}`).addTo(map); });
map.on('click', (e: MapMouseEvent) => { e.preventDefault(); console.log(e.originalEvent.button); });
map.on('click', 'dots', (e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (feature?.geometry.type === 'Point') map.flyTo({center: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]]});
    const name: string = feature?.properties.name;
    console.log(name, feature?.layer.id);
});
map.on('mouseenter', 'dots', e => { map.getCanvas().style.cursor = e.features?.length ? 'pointer' : ''; });
map.on('moveend', () => console.log(map.getCenter()));
map.on('error', e => console.error(e.error.message));
map.on('sourcedata', e => { if (e.sourceId === 'places' && e.isSourceLoaded) console.log('loaded'); });
map.once('idle', e => console.log(e.type));
const onMove = (e: MapMouseEvent) => console.log(e.lngLat.lat);
map.on('mousemove', onMove);
map.off('mousemove', onMove);
map.off('click', 'dots', onMove);
// A name that is not in the list is accepted, as in MapLibre GL JS.
map.on('draw.create', e => console.log(e.features));

const features = map.queryRenderedFeatures([10, 10], {layers: ['dots']});
const first: MapGeoJSONFeature | undefined = features[0];
console.log(first?.layer.id, first?.properties.name.toUpperCase(), first?.layer.paint?.['circle-color']);
map.queryRenderedFeatures().then(all => all.map(f => f.layer.type));
console.log(map.querySourceFeatures('places', {sourceLayer: 'x'})[0]?.properties.name);
// `queryFeatures` is an addition of this library. It has the meaning that it has in `@map-jr/map-jr-gl`.
map.on('click', e => map.queryFeatures(e.lngLat, {sources: ['places'], radius: 8}).then(found => console.log(found[0]?.sourceLayer.length)));
map.queryFeatures({x: 10, y: 10}, {radius: 8}).then(found => console.log(found[0]?.layer.id));

// The types are not `any`: each of these lines must be an error.
// @ts-expect-error a mouse event has no `sourceId`
map.on('click', e => e.sourceId.length);
// @ts-expect-error `moveend` does not give a mouse event: it need not have a position
map.on('moveend', e => e.lngLat.lng);
// @ts-expect-error a layer needs an `id`
map.addLayer({type: 'line', source: 'places'});
