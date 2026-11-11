export {Map, MarkerLayer, InteractionHandler, type MapOptions, type MapEvent, type RenderedFeature, type PointLike} from './map.ts';
export {addProtocol, removeProtocol, type ProtocolFunction} from './protocols.ts';
export {LngLat, LngLatBounds, type LngLatInput, type LngLatBoundsInput} from './lnglat.ts';
export type {MarkerLayerOptions, MarkerInput, Anchor} from './markers.ts';
export type {CameraOptions, FeatureQuery, FontSource} from './engine.ts';
export type {QueriedFeature} from './query.ts';
export type {LngLatLike} from './geo.ts';
export {AttributionControl, NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, TerrainControl, LogoControl, type Control, type ControlPosition} from './controls.ts';
export {Marker, Popup, type MarkerOptions, type PopupOptions} from './overlays.ts';
export {configure, type LoadOptions} from './loader.ts';

// Functions that code for MapLibre GL JS calls on the module. Here they set the same things through `configure`, or
// they do nothing because the library has no need of them.
import {configure as set} from './loader.ts';
let workerUrl = '', workerCount = 0, imageRequests = 16;
/** The version of this library. */
export const getVersion = () => '1.0.0';
export const setWorkerUrl = (url: string) => { workerUrl = url; set({workerUrl: url}); };
export const getWorkerUrl = () => workerUrl;
export const setWorkerCount = (count: number) => { workerCount = count; set({tileWorkers: count}); };
export const getWorkerCount = () => workerCount;
/** Accepted for compatibility. The browser limits the number of requests. */
export const setMaxParallelImageRequests = (count: number) => { imageRequests = count; };
export const getMaxParallelImageRequests = () => imageRequests;
/** Accepted for compatibility. The browser draws right-to-left text; no plugin is loaded. */
export const setRTLTextPlugin = (_url: string, _lazy?: boolean) => Promise.resolve();
export const getRTLTextPluginStatus = () => 'loaded';
