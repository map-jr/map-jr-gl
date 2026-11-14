export {Map, Map as MapLibreMap} from './compat-map.ts';
export {InteractionHandler, type RenderedFeature, type PointLike, type FeatureOptions, type FeaturePlace} from './map.ts';
export {addProtocol, removeProtocol, type ProtocolFunction} from './protocols.ts';
export {LngLat, LngLatBounds, type LngLatInput, type LngLatBoundsInput} from './lnglat.ts';
export type {MarkerLayerOptions, MarkerInput, Anchor} from './markers.ts';
export type {FeatureQuery, FontSource} from './engine.ts';
export type {QueriedFeature} from './query.ts';
export type {LngLatLike} from './geo.ts';
export {AttributionControl, type Control, type ControlPosition} from './controls.ts';
export {NavigationControl, ScaleControl, GeolocateControl, TerrainControl, LogoControl} from './controls-more.ts';
export {Popup, type MarkerOptions, type PopupOptions} from './overlays.ts';
import {Marker as CoreMarker} from './overlays.ts';
import {FullscreenControl as CoreFullscreen} from './controls-more.ts';
import {Evented} from './evented.ts';
import type {Map as CoreMap} from './map.ts';
/** The marker of the core with the private members `_map` and `_lngLat` that wrappers for MapLibre GL JS read. */
export class Marker extends CoreMarker {
    get _map() { return this.map; }
    get _lngLat() { return this.getLngLat(); }
}
/** The control of the core with `on`, `off` and `once`. It fires `fullscreenstart` and `fullscreenend` on itself, as in MapLibre GL JS. */
export class FullscreenControl extends CoreFullscreen {
    private events = new Evented();
    private was = false;
    on(type: string, fn: (e: any) => void) { this.events.on(type, fn); return this; }
    off(type: string, fn: (e: any) => void) { this.events.off(type, fn); return this; }
    once(type: string, fn: (e: any) => void) { this.events.once(type, fn); return this; }
    private change = () => {
        const on = !!document.fullscreenElement && document.fullscreenElement === this.container;
        if (on !== this.was) { this.was = on; this.events.fire(on ? 'fullscreenstart' : 'fullscreenend', {target: this}); }
    };
    private container?: HTMLElement;
    onAdd(map: CoreMap) { this.container = map.getContainer(); document.addEventListener('fullscreenchange', this.change); return super.onAdd(map); }
    onRemove() { document.removeEventListener('fullscreenchange', this.change); super.onRemove(); }
}
export {Point} from './compat-map.ts';
import {Point} from './compat-map.ts';
import {LogoControl as Empty} from './controls-more.ts';
/** MapLibre changes between a flat map and a globe with this control. This library has no globe, so the control adds an empty element. */
export class GlobeControl extends Empty { override getDefaultPosition() { return 'top-right' as const; } }
export {GPUInitializationError} from './gpu-error.ts';
export {configure, supported, type LoadOptions} from './loader.ts';
export type * from './compat-types.ts';

// Functions that code for MapLibre GL JS calls on the module. Here they set the same things through `configure`, or
// they do nothing because the library has no need of them.
import {configure as set, supported} from './loader.ts';
declare const __VERSION__: string; // the version of package.json, set by the build
let workerUrl = '', workerCount = 0, imageRequests = 16;
/** The version of this library. */
export const getVersion = () => __VERSION__;
/** A URL of MapLibre GL JS's worker file (`maplibre-gl-worker.mjs`, `maplibre-gl-csp-worker.js`) is ignored with one warning:
 * that file cannot run here, and the library finds its own worker file. */
let warned = 0;
export const setWorkerUrl = (url: string) => {
    if (/maplibre-gl[^/]*worker/i.test(String(url))) {
        if (!warned++) console.warn('[map-jr-gl] setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself.');
        return;
    }
    workerUrl = url; set({workerUrl: url});
};
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
import {InteractionHandler} from './map.ts';
import {LngLat, LngLatBounds} from './lnglat.ts';
import {addProtocol, removeProtocol} from './protocols.ts';
import {AttributionControl} from './controls.ts';
import {NavigationControl, ScaleControl, GeolocateControl, TerrainControl, LogoControl} from './controls-more.ts';
import {Popup} from './overlays.ts';
import {GPUInitializationError} from './gpu-error.ts';
export default {
    GPUInitializationError,
    Map, MapLibreMap: Map, Point, InteractionHandler, LngLat, LngLatBounds, addProtocol, removeProtocol, Marker, Popup, configure: set,
    AttributionControl, NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, TerrainControl, LogoControl, GlobeControl,
    supported, getVersion, setWorkerUrl, getWorkerUrl, setWorkerCount, getWorkerCount, setMaxParallelImageRequests, getMaxParallelImageRequests, setRTLTextPlugin, getRTLTextPluginStatus,
};
