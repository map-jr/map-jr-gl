// A style built in TypeScript with the style types of the main API (`@map-jr/map-jr-gl`), without `maplibre-gl`.
// `node test/examples.mjs` checks that it compiles against the built types (dist/types). It is not run.
import {createMap, type FillLayerSpecification, type FilterSpecification, type LayerSpecification, type LineLayerSpecification, type SourceSpecification, type StyleSpecification} from '@map-jr/map-jr-gl';

const parks: SourceSpecification = {type: 'geojson', data: {type: 'FeatureCollection', features: []}};
const filter: FilterSpecification = ['==', ['get', 'kind'], 'park'];
const fill: FillLayerSpecification = {id: 'parks', type: 'fill', source: 'parks', filter, paint: {'fill-color': '#3a7d44', 'fill-opacity': 0.5}};
const outline: LineLayerSpecification = {id: 'parks-outline', type: 'line', source: 'parks', paint: {'line-width': 2}, layout: {visibility: 'visible'}};
const layers: LayerSpecification[] = [{id: 'background', type: 'background', paint: {'background-color': '#eee'}}, fill, outline];

const style: StyleSpecification = {version: 8, sources: {parks}, layers, glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'};
createMap(document.body, {style});

// The description (`MapSpec`) uses these types (#504). A layer of `layers` has a layer type that the library draws,
// `data` takes GeoJSON or a URL, and bounds are arrays.
const routes: GeoJSON.FeatureCollection = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[-74, 40.7], [-73.9, 40.8]]}}]};
interface Place { name: string }
const place: {type: 'Feature'; properties: Place; geometry: {type: 'Point'; coordinates: [number, number]}} = {type: 'Feature', properties: {name: 'a'}, geometry: {type: 'Point', coordinates: [-74, 40.7]}};
const box = [-74.1, 40.6, -73.8, 40.9] as const;
const described = createMap(document.body, {
    style: 'https://demotiles.maplibre.org/style.json',
    sources: {parks},
    layers: [{...fill, before: 'parks-outline'}, {id: 'routes', type: 'line', source: 'routes', paint: {'line-color': '#c00'}}],
    data: {routes, place, remote: 'https://example.com/places.geojson'},
    initialView: {bounds: [[-74.1, 40.6], [-73.8, 40.9]]},
    maxBounds: box,
});
described.fitBounds([-74.1, 40.6, -73.8, 40.9]);
described.queryFeatures({filter: ['==', ['get', 'kind'], 'park']});
// @ts-expect-error a layer of the description has a layer type that the library draws
createMap(document.body, {style: 'https://demotiles.maplibre.org/style.json', layers: [{id: 'x', type: 'filll', source: 'parks'}]});
// @ts-expect-error a fill layer of the description has no `line-width`
createMap(document.body, {style: 'https://demotiles.maplibre.org/style.json', layers: [{id: 'x', type: 'fill', source: 'parks', paint: {'line-width': 2}}]});
// @ts-expect-error bounds of the main API are arrays: `{lng, lat}` objects do not compile
described.fitBounds([{lng: -74.1, lat: 40.6}, {lng: -73.8, lat: 40.9}]);
// @ts-expect-error `data` takes GeoJSON or a URL
createMap(document.body, {style: 'https://demotiles.maplibre.org/style.json', data: {routes: 42}});
