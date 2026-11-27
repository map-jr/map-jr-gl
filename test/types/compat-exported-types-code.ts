// The types of MapLibre GL JS that an application or a wrapper writes are exported from the compat entry
// (`@map-jr/map-jr-gl/maplibre-compat`, issue #561). Each name is imported and used once.
// `node test/examples.mjs` checks that this file compiles against the built types (dist/types). It is not run.
import {
    Map, Marker, Popup, NavigationControl, GeolocateControl, FullscreenControl, ScaleControl, AttributionControl, addProtocol,
    type NavigationControlOptions, type GeolocateControlOptions, type FullscreenControlOptions, type ScaleControlOptions,
    type AttributionControlOptions, type LogoControlOptions, type Unit, type PositionAnchor, type Alignment, type Offset,
    type Listener, type Subscription, type EventTypeMap, type ErrorEventType, type MarkerEventType, type PopupEventType,
    type FullscreenControlEventType, type GeolocateControlEventType, type GestureOptions, type DragPanOptions,
    type DragRotateOptions, type AroundCenterOptions, type GeoJSONSourceDiff, type GeoJSONFeatureDiff, type GeoJSONFeatureId,
    type GetClusterOptions, type SetClusterOptions, type Coordinates, type UpdateImageOptions, type CanvasSourceSpecification,
    type CustomLayerInterface, type StyleImageInterface, type StyleImageData, type MissingStyleImageResolver,
    type TransformStyleFunction, type StyleOptions, type MapSourceDataType, type MapSourceDataEvent, type ResourceType,
    type AddProtocolAction, type CustomLayerProjectionData, type ProjectionData, type GeoJSONSource, type ImageSource,
    type MapMouseEvent, type Geometry,
} from '@map-jr/map-jr-gl/maplibre-compat';

declare const map: Map;

// The options of the controls go to the constructors.
const unit: Unit = 'nautical';
const navigation: NavigationControlOptions = {showCompass: true, showZoom: true, visualizePitch: true};
const geolocate: GeolocateControlOptions = {positionOptions: {enableHighAccuracy: true}, trackUserLocation: true, showUserLocation: true};
const fullscreen: FullscreenControlOptions = {pseudo: true};
const scale: ScaleControlOptions = {maxWidth: 120, unit};
const attribution: AttributionControlOptions = {compact: true, customAttribution: ['© Example']};
const logo: LogoControlOptions = {compact: true};
map.addControl(new NavigationControl(navigation)).addControl(new ScaleControl(scale)).addControl(new AttributionControl(attribution));
const locate = new GeolocateControl(geolocate), full = new FullscreenControl(fullscreen);

// Markers and popups.
const anchor: PositionAnchor = 'bottom-left', alignment: Alignment = 'viewport';
const offset: Offset = {top: [0, 8], bottom: [0, -8]};
const marker = new Marker({anchor, rotationAlignment: alignment, pitchAlignment: alignment, draggable: true});
const popup = new Popup({anchor, offset}).setOffset(12);

// Listeners and the events of each object.
const onClick: Listener<MapMouseEvent> = e => e.lngLat.lng;
const onLoad: Listener = e => e.target.getZoom();
// `on` returns a `Subscription`, as in MapLibre GL JS (#675), with and without a layer id; it does not return the map.
const subscription: Subscription = map.on('click', onClick);
subscription.unsubscribe();
map.on('click', 'water', e => e.features).unsubscribe();
map.on('load', onLoad);
// @ts-expect-error `on` cannot be chained: it returns a `Subscription`.
map.on('click', onClick).on('load', onLoad);
// `once` with a listener returns the map, and without one a promise, as in MapLibre GL JS.
map.once('click', onClick).once('load', onLoad);
map.once('click', 'water', onClick).getZoom();
// The `on` of `Marker`, `Popup` and the evented controls also returns a `Subscription`, as in MapLibre GL JS (#1901).
const overlaySubscriptions: Subscription[] = [new Marker().on('drag', () => {}), new Popup().on('close', () => {}),
    new GeolocateControl({}).on('geolocate', () => {}), new FullscreenControl({}).on('fullscreenstart', () => {})];
overlaySubscriptions[0].unsubscribe();
// @ts-expect-error `on` of a marker cannot be chained: it returns a `Subscription`.
new Marker().on('drag', () => {}).on('dragend', () => {});
const loaded: Promise<unknown> = map.once('load');
const events: EventTypeMap = {load: {type: 'load', target: map}};
const onError = (e: ErrorEventType['error']) => e.error.message;
const onDrag = (e: MarkerEventType['dragend']) => e.target.getLngLat();
const onOpen = (e: PopupEventType['open']) => e.target.isOpen();
const onFull = (e: FullscreenControlEventType['fullscreenstart']) => e.target;
const onPosition = (e: GeolocateControlEventType['geolocate']) => e.coords.accuracy + e.timestamp;
const onDenied = (e: GeolocateControlEventType['error']) => `${e.code}: ${e.message}`;
map.on('error', onError); marker.on('dragend', onDrag); popup.on('open', onOpen); full.on('fullscreenstart', onFull);
locate.on('geolocate', onPosition); locate.on('error', onDenied);

// Gestures. The options of the handlers have no effect, and `enable` accepts them.
const gestures: GestureOptions = true;
const pan: DragPanOptions = {linearity: 0.3, deceleration: 1400, maxSpeed: 2500, easing: t => t};
const rotate: DragRotateOptions = {around: 'center', movement: 'linear'}, around: AroundCenterOptions = {around: 'center'};
map.dragPan.enable(pan); map.dragRotate.enable(rotate); map.scrollZoom.enable(around);

// Sources.
const id: GeoJSONFeatureId = 'a';
const change: GeoJSONFeatureDiff = {id, newGeometry: {type: 'Point', coordinates: [0, 0]}, addOrUpdateProperties: [{key: 'name', value: 'A'}]};
const diff: GeoJSONSourceDiff = {remove: [1, 'b'], update: [change]};
(map.getSource('points') as GeoJSONSource).updateData(diff);
const cluster: SetClusterOptions = {clusterRadius: 40}, clusters: GetClusterOptions = {cluster: true, clusterMaxZoom: 14, clusterRadius: 40};
const corners: Coordinates = [[-80, 46], [-71, 46], [-71, 37], [-80, 37]];
const image: UpdateImageOptions = {url: 'https://maplibre.org/maplibre-gl-js/docs/assets/radar.gif', coordinates: corners};
(map.getSource('radar') as ImageSource).updateImage(image);
const canvas: CanvasSourceSpecification = {type: 'canvas', canvas: 'canvas-id', coordinates: corners, animate: false};
const dataType: MapSourceDataType = 'content';
map.on('sourcedata', (e: MapSourceDataEvent) => e.sourceDataType === dataType);

// Images and the style.
const pixels: StyleImageInterface = {width: 2, height: 2, data: new Uint8Array(16)};
map.addImage('dot', pixels);
const stored: StyleImageData = {data: pixels};
const resolver: MissingStyleImageResolver = async name => { await map.addImage(name, pixels); };
map.setMissingStyleImageResolver(resolver);
const transformStyle: TransformStyleFunction = (previous, next) => ({...next, layers: [...(previous?.layers ?? []), ...next.layers]});
map.setStyle('https://demotiles.maplibre.org/style.json', {transformStyle});
const styleOptions: StyleOptions = {validate: false};

// Requests and custom layers.
const kind: ResourceType = 'Tile';
const protocol: AddProtocolAction = async request => ({data: await (await fetch(request.url.replace('custom://', 'https://'))).arrayBuffer()});
addProtocol('custom', protocol);
const layer: CustomLayerInterface = {id: 'custom', type: 'custom', render(_gl, input) { const data: CustomLayerProjectionData = input.defaultProjectionData, same: ProjectionData = data; void same; }};
map.addLayer(layer);

// Geometry has the GeometryCollection member of the GeoJSON types of MapLibre GL JS.
const collection: Geometry = {type: 'GeometryCollection', geometries: [{type: 'Point', coordinates: [0, 0]}]};
if (collection.type === 'GeometryCollection') collection.geometries[0].type;
// @ts-expect-error a GeometryCollection has `geometries`, not `coordinates`
collection.coordinates;

export {collection, logo, subscription, loaded, events, gestures, cluster, clusters, canvas, stored, styleOptions, kind};
