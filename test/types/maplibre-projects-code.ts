// Lines from projects that use MapLibre GL JS (mapcn, open-tacos, afilmory, terraink; issue #208), with the import
// changed to `@map-jr/map-jr-gl/maplibre-compat`. `node test/examples.mjs` checks that they compile. They are not run.
import {Map, Marker, Popup, type MapOptions, type PopupOptions, type MarkerOptions, type LngLat, type LayerSpecification, type FillLayerSpecification, type LineLayerSpecification, type CircleLayerSpecification, type SymbolLayerSpecification, type ProjectionSpecification, type StyleSpecification, type MapMouseEvent, type MapLibreEvent, type CameraOptions, type AnimationOptions, type LngLatBoundsLike, type MapGeoJSONFeature} from '@map-jr/map-jr-gl/maplibre-compat';

const options: MapOptions = {container: 'map', fadeDuration: 0, pitchWithRotate: false, cooperativeGestures: false};
const map = new Map(options);

// `getLngLat()` returns a `LngLat`, as in MapLibre GL JS.
const marker = new Marker({opacityWhenCovered: '0.2'}).setLngLat([0, 0]).addTo(map);
const at: LngLat = marker.getLngLat();
const popupOptions: PopupOptions = {focusAfterOpen: false, locationOccludedOpacity: 0.5, closeButton: false};
const popup = new Popup(popupOptions).setLngLat(at);
const where: [number, number] = [popup.getLngLat().lng, popup.getLngLat().lat];
marker.setPopup(popup);
marker.setPopup(null);
const markerOptions: MarkerOptions = {anchor: 'bottom', opacityWhenCovered: '0.2'};

// The names of the layer types and of the projection.
const fill: FillLayerSpecification = {id: 'fill', type: 'fill', source: 'places', paint: {'fill-color': '#088'}};
const line: LineLayerSpecification = {id: 'line', type: 'line', source: 'places', paint: {'line-width': 2}};
const circle: CircleLayerSpecification = {id: 'circle', type: 'circle', source: 'places'};
const symbol: SymbolLayerSpecification = {id: 'symbol', type: 'symbol', source: 'places', layout: {'text-field': 'x'}};
const projection: ProjectionSpecification = {type: 'mercator'};
map.setPaintProperty('fill', 'fill-opacity' as keyof NonNullable<FillLayerSpecification['paint']>, 0.5);
map.setPaintProperty('line', 'line-color' as keyof NonNullable<LineLayerSpecification['paint']>, '#f00');

// `LayerSpecification` is a type of object literals, so it can be cast.
const layer: LayerSpecification = fill;
const record = layer as Record<string, unknown>;

// Options of camera and style methods.
map.easeTo({center: [0, 0], zoom: 3, duration: 500, essential: true});
map.flyTo({center: [1, 1], essential: true});
const style: StyleSpecification = {version: 8, sources: {}, layers: [fill, line, circle, symbol], light: {anchor: 'viewport', position: [1.15, 210, 30], color: '#fff', intensity: 0.5}};
map.setStyle(style, {diff: false});

// The target of an event is the compat map.
let instance: Map | null = null;
map.on('load', (e: MapLibreEvent) => { instance = e.target; });
map.on('click', (e: MapMouseEvent) => { const m: Map = e.target; m.getCanvas(); });

// Lines from Directus and hk-traffic-sign-map (report #270).
const bbox = [0, 0, 1, 1] as LngLatBoundsLike;
const fit = (o: CameraOptions & AnimationOptions) => map.fitBounds(bbox, {padding: 80, maxZoom: 8, ...o});
map.fitBounds(bbox, {padding: 100, speed: 1.3, maxZoom: 14});
const layerIds = new Set(map.getStyle().layers?.map(({id}) => id));
const hovered = (feature: MapGeoJSONFeature) => map.setFeatureState({id: feature.id, source: 'places'}, {hovered: true});
map.querySourceFeatures('places', {sourceLayer: 'roads', filter: ['==', 'a', 1], validate: false});

// `offset` of a marker is a `PointLike`, as in MapLibre GL JS (#208).
const offsetOptions: MarkerOptions = {offset: {x: 0, y: -10}};
const shifted = new Marker({offset: [0, -10]}).setOffset({x: 2, y: 3}).getOffset().x;

console.log(offsetOptions, shifted, fit, layerIds, hovered, markerOptions, where, projection, record, instance);
