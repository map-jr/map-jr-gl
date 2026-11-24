// TypeScript code for the main API (`@map-jr/map-jr-gl`), as the documentation and the examples write it.
// `node test/examples.mjs` checks that it compiles against the built types (dist/types). It is not run.
import {createMap, points, type AttributionOptions, type FeatureOptions, type MapDragEvent, type MapEvents, type MapDescription, type Position, type RenderedFeature, type View} from '@map-jr/map-jr-gl';
import {navigation, scale, geolocate, terrain, type NavigationOptions, type ScaleOptions, type GeolocateOptions, type TerrainOptions} from '@map-jr/map-jr-gl/controls';
import {renderToImage} from '@map-jr/map-jr-gl/server';

// A position that is declared apart from the call has the type number[].
const NYC = [-74.0065, 40.7085];
const FIXED = [-74.0065, 40.7085] as const;
const places = [[-74.0134, 40.7033], [-74.009, 40.7061]];
const pins = points(places, {lngLat: p => p, properties: () => ({color: '#d6453d'})});

const description: MapDescription = {
    style: 'https://demotiles.maplibre.org/style.json',
    initialView: {center: NYC, zoom: 13.6},
    view: {center: FIXED},
    data: {pins},
    layers: [{id: 'pins', type: 'symbol', source: 'pins', layout: {'icon-image': 'pin', 'icon-anchor': 'bottom'}}],
    images: {pin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"/>', photo: {image: 'https://demotiles.maplibre.org/favicon.ico', width: 16, height: 16, pixelRatio: 2}},
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
// The method gives the type of the features: `querySource` the tile data, `queryFeatures` what the style layers draw.
map.querySource('rain', NYC).then(found => console.log(found[0]?.type === 'Polygon', found[0]?.sourceLayer.length));
map.queryFeatures([{x: 0, y: 0}, {x: 400, y: 300}], {layers: ['places']}).then(found => console.log(found[0]?.layer.id, found[0]?.state));
map.queryFeatures({x: 10, y: 10}, {radius: 8}).then(found => console.log(found[0]?.layer.paint));
map.queryFeatures().then(found => console.log(found[0]?.geometry.type));
// The geometry is a union by `type`: the position of a clicked point needs no cast.
map.queryFeatures({x: 10, y: 10}).then(found => { const g = found[0]?.geometry; if (g?.type === 'Point') console.log(g.coordinates[0].toFixed(2), g.coordinates[1].toFixed(2)); });
map.watchSource('rain', FIXED, {zoom: 10}, features => console.log(features.length, features[0]?.type));
map.queryFeatures({layers: ['places']}).then(found => console.log(found[0]?.layer.id));
map.watchFeatures(undefined, {layers: ['places']}, features => console.log(features[0]?.layer.id));
// Options in a variable: the features are those that the style layers draw.
const asked: FeatureOptions = Math.random() < 0.5 ? {layers: ['places']} : {};
map.queryFeatures(NYC, asked).then(found => console.log(found.length, found[0]?.properties, found[0]?.state));
// @ts-expect-error `sources` is not an option of queryFeatures: querySource reads the tile data of a source.
map.queryFeatures(NYC, {sources: ['rain']});
// @ts-expect-error A feature of the tile data has no style layer.
map.querySource('rain', NYC).then(found => found[0]?.layer.id);
// @ts-expect-error A feature that a style layer draws has no `type` of the tile data.
map.queryFeatures(NYC).then(found => found[0]?.type === 'Polygon');
const overlay = map.overlay(document.createElement('div'), {lngLat: NYC, anchor: 'bottom'});
overlay.update({lngLat: map.unproject({x: 10, y: 10})});
const given: Position = map.state.get().view.center;
const view: View = map.state.get().view;
console.log(given, view);

// The event follows from the type of the event.
map.listen('stats', e => console.log(e.fps.toFixed(0), e.frameMs));
map.listen('click', e => { e.preventDefault(); console.log(e.point.x, e.lngLat[0], e.originalEvent.button, e.target.state.get().view.zoom); });
map.listen('drag', e => console.log(e.type, e.originalEvent instanceof MouseEvent ? e.originalEvent.clientX : e.originalEvent.touches.length));
map.listen('dragend', (e: MapDragEvent) => console.log(e.originalEvent.timeStamp));
map.listen('wheel', e => console.log(e.originalEvent.deltaY));
map.listen('touchmove', e => console.log(e.points.length, e.lngLats[0][1]));
map.listen('boxzoomend', e => console.log(e.boxZoomBounds[0][0], e.boxZoomBounds[1][1]));
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

// A control of `controls` is checked: `create()` returns a control (onAdd, onRemove, optional getDefaultPosition).
const ownControl: MapDescription['controls'] = [
    {key: 'pos', position: 'bottom-left', create: () => ({onAdd: () => document.createElement('div'), onRemove() {}, getDefaultPosition: () => 'top-left' as const})},
    // @ts-expect-error onAdd must return an HTMLElement
    {key: 'bad', create: () => ({onAdd: () => 1, onRemove() {}})},
    // @ts-expect-error a position must be one of the four corners
    {key: 'bad2', position: 'middle', create: () => ({onAdd: () => document.createElement('div'), onRemove() {}})},
];
console.log(ownControl);
// The result of `create()` is the same Control type that `addControl` takes.
const made = navigation().create();
const corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | undefined = made.getDefaultPosition?.();
console.log(corner);

// The options of the controls and of the attribution have names (#1127).
const navOptions: NavigationOptions = {showZoom: true, visualizePitch: true};
const scaleOptions: ScaleOptions = {unit: 'imperial', maxWidth: 80};
const geoOptions: GeolocateOptions = {zoom: 12, trackUserLocation: true};
const terrainOptions: TerrainOptions = {source: 'dem', exaggeration: 1.5};
const attributionOptions: AttributionOptions = {compact: true, customAttribution: ['© Me']};
createMap('map', {style: 'https://styles.map-jr.org/1/elevation-zero.json', attribution: attributionOptions, controls: [navigation(navOptions), scale(scaleOptions), geolocate(geoOptions), terrain(terrainOptions)]});
// @ts-expect-error `unit` takes one of three names.
const badScale: ScaleOptions = {unit: 'miles'};
// @ts-expect-error `source` is required.
const badTerrain: TerrainOptions = {exaggeration: 2};
// @ts-expect-error `terrain()` needs its options with `source` (#1238).
const noSource = terrain();
// @ts-expect-error `source` is required in the argument of `terrain()` too.
const emptyTerrain = terrain({exaggeration: 2});
console.log(badScale, badTerrain, noSource, emptyTerrain);

// Every optional field of the description accepts null as "not set", as a description from JSON has it (#1146).
const fromJSON: MapDescription = {
    style: 'https://demotiles.maplibre.org/style.json', renderer: null, fontFamily: null, interactive: null, antialias: null, attribution: null, hash: null, nonce: null,
    sources: null, layers: null, terrain: null, fonts: null, initialView: null, view: null, onViewChange: null, data: null, images: null, sprite: null, controls: null,
    projection: null, globalState: null, interactiveLayers: null, hoverState: null, onClick: null, onError: null, minZoom: null, maxZoom: null, maxPitch: null,
    maxBounds: null, cursor: null, cooperativeGestures: null, colorScheme: null, onColorSchemeChange: null, padding: null, transformRequest: null, locale: null,
};
map.update(fromJSON);
// @ts-expect-error `style` is required, and null is not a style.
map.update({style: null});
// @ts-expect-error renderToImage always embeds images, so its options have no `inlineImages` (#1208).
void renderToImage({style: 'https://example.com/style.json', center: [0, 0], zoom: 1, width: 1, height: 1, rasteriser: {render: async () => new Uint8Array()}, inlineImages: false});
