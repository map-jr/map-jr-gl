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
