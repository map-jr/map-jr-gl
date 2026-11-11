export {Map} from './compat-map.ts';
export {MarkerLayer, InteractionHandler, type MapOptions, type MapEvent, type RenderedFeature, type PointLike} from './map.ts';
export {addProtocol, removeProtocol, type ProtocolFunction} from './protocols.ts';
export {LngLat, LngLatBounds, type LngLatInput, type LngLatBoundsInput} from './lnglat.ts';
export type {MarkerLayerOptions, MarkerInput, Anchor} from './markers.ts';
export type {CameraOptions, FeatureQuery, FontSource} from './engine.ts';
export type {QueriedFeature} from './query.ts';
export type {LngLatLike} from './geo.ts';
export {AttributionControl, type Control, type ControlPosition} from './controls.ts';
export {NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, TerrainControl, LogoControl} from './controls-more.ts';
export {Marker, Popup, type MarkerOptions, type PopupOptions} from './overlays.ts';
import {LogoControl as Empty} from './controls-more.ts';
/** MapLibre changes between a flat map and a globe with this control. This library has no globe, so the control adds an empty element. */
export class GlobeControl extends Empty { override getDefaultPosition() { return 'top-right' as const; } }
export {configure, type LoadOptions} from './loader.ts';
export type * from './compat-types.ts';

// Functions that code for MapLibre GL JS calls on the module. Here they set the same things through `configure`, or
// they do nothing because the library has no need of them.
import {configure as set} from './loader.ts';
let workerUrl = '', workerCount = 0, imageRequests = 16;
/** The version of this library. */
export const getVersion = () => '0.2.0';
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

// The default export is for plugins only. Some plugins of MapLibre GL JS contain `import maplibregl from 'maplibre-gl'`
// (4 of the 15 in test/conformance/plugins.mjs), and an application cannot change that line: it can only map the name
// `maplibre-gl` to this library. An application itself uses the named exports.
// (A bundler leaves the object out when nothing imports it.)
import {Map} from './compat-map.ts';
import {MarkerLayer, InteractionHandler} from './map.ts';
import {LngLat, LngLatBounds} from './lnglat.ts';
import {addProtocol, removeProtocol} from './protocols.ts';
import {AttributionControl} from './controls.ts';
import {NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, TerrainControl, LogoControl} from './controls-more.ts';
import {Marker, Popup} from './overlays.ts';
export default {
    Map, MarkerLayer, InteractionHandler, LngLat, LngLatBounds, addProtocol, removeProtocol, Marker, Popup, configure: set,
    AttributionControl, NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, TerrainControl, LogoControl, GlobeControl,
    getVersion, setWorkerUrl, getWorkerUrl, setWorkerCount, getWorkerCount, setMaxParallelImageRequests, getMaxParallelImageRequests, setRTLTextPlugin, getRTLTextPluginStatus,
};
