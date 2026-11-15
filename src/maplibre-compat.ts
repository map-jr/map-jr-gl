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
export type {MarkerOptions, PopupOptions} from './overlays.ts';
import {Marker as CoreMarker, Popup as CorePopup, type MarkerOptions, type PopupOptions} from './overlays.ts';
/** Options of MapLibre GL JS that `Marker` and `Popup` accept with no effect: each warns once per page. */
const noEffect: Record<string, 1> = {};
const accepted = (type: string, options: Record<string, unknown>, names: string[]) => {
    for (const n of names) if (options[n] !== undefined && !noEffect[n]) {
        noEffect[n] = 1;
        console.warn(`[map-jr-gl] ${type}: the option ${n} has no effect. Remove it; see "What is different" in docs/maplibre-compatibility.md.`);
    }
};
import {toLngLat, type LngLatLike as Where} from './geo.ts';
import type {Map as CoreMap} from './map.ts';
/**
 * The popup of the core with the options `focusAfterOpen`, `closeOnMove`, `trackPointer` and `subpixelPositioning` of
 * MapLibre GL JS. `locationOccludedOpacity` warns once.
 */
export class Popup extends CorePopup {
    /** The pointer position while the popup follows the pointer, `null` before the first mouse move, `undefined` otherwise. */
    private pointer?: [number, number] | null;
    /** The camera when the popup opened. A move closes it only when the camera differs (the engine reports a jumpTo later). */
    private camera = '';
    private view = () => { const m = this.map!; return '' + [m.getCenter().toArray(), m.getZoom(), m.getBearing(), m.getPitch()]; };
    private moved = () => { if (this.view() !== this.camera) this.remove(); };
    private follow = (e: any) => { this.pointer = [e.point.x, e.point.y]; this.el.style.visibility = ''; this.update(); };
    private hide = () => { this.el.style.visibility = 'hidden'; };
    constructor(options: PopupOptions = {}) {
        super(options);
        accepted('Popup', options as any, ['locationOccludedOpacity']);
        const position = this.update;
        this.update = () => {
            if (this.pointer === null) return;
            if (this.map && this.pointer) this.lngLat = toLngLat(this.map.unproject(this.pointer));
            position();
        };
        if (options.subpixelPositioning) this.setSubpixelPositioning(true);
        if (options.trackPointer) this.trackPointer();
    }
    setSubpixelPositioning(value: boolean) { this.options.subpixelPositioning = value; this.round = value ? Number : Math.round; this.update(); }
    /**
     * Puts the popup at the mouse pointer and moves it with the pointer, until `setLngLat` is called. The popup is hidden
     * until the first mouse move and while the pointer is outside the map. It does not catch clicks, and a touch does not move it.
     */
    trackPointer() { return this.track(null); }
    setLngLat(lngLat: Where) {
        if (this.pointer !== undefined) this.track();
        return super.setLngLat(lngLat);
    }
    /** Starts (`null`) or ends (`undefined`) following the pointer. */
    private track(pointer?: null) {
        const on = (this.pointer = pointer) === null;
        this.el.style.visibility = on ? 'hidden' : '';
        this.box.style.pointerEvents = this.clicks = on ? 'none' : 'auto';
        this.listen();
        return this;
    }
    /** Listens to the pointer while the popup follows it. */
    private listen(on = this.pointer !== undefined) {
        const map = this.map;
        if (!map) return;
        for (const [type, fn] of [['mousemove', this.follow], ['mouseout', this.hide]] as const) { map.off(type, fn); if (on) map.on(type, fn); }
    }
    private focused() { if (this.isOpen() && this.options.focusAfterOpen !== false) this.focusFirst(); return this; }
    setText(text: string) { super.setText(text); return this.focused(); }
    setHTML(html: string) { super.setHTML(html); return this.focused(); }
    setDOMContent(node: Node) { super.setDOMContent(node); return this.focused(); }
    addTo(map: CoreMap) {
        super.addTo(map);
        this.listen();
        if (this.options.closeOnMove) { this.camera = this.view(); map.on('move', this.moved); }
        return this.focused();
    }
    remove() {
        if (this.isOpen()) { this.map!.off('move', this.moved); this.listen(false); }
        return super.remove();
    }
}
import {FullscreenControl as CoreFullscreen} from './controls-more.ts';
import {Evented} from './evented.ts';
/** The marker of the core with the private members `_map` and `_lngLat` that wrappers for MapLibre GL JS read. */
export class Marker extends CoreMarker {
    constructor(options: MarkerOptions = {}) { super(options); accepted('Marker', options as any, ['opacityWhenCovered']); }
    get _map() { return this.map; }
    get _lngLat() { return this.getLngLat(); }
    /** The offset as a `Point`, as in MapLibre GL JS. */
    getOffset() { const o = super.getOffset(); return new Point(o.x, o.y); }
}
/** The control of the core with `on`, `off` and `once`. It fires `fullscreenstart` and `fullscreenend` on itself, as in MapLibre GL JS. */
export class FullscreenControl extends CoreFullscreen {
    private events = new Evented();
    on(type: string, fn: (e: any) => void) { this.events.on(type, fn); return this; }
    off(type: string, fn: (e: any) => void) { this.events.off(type, fn); return this; }
    once(type: string, fn: (e: any) => void) { this.events.once(type, fn); return this; }
    protected override changed(on: boolean) { this.events.fire(on ? 'fullscreenstart' : 'fullscreenend', {target: this}); }
}
export {Point} from './compat-map.ts';
import {Point} from './compat-map.ts';
import {LogoControl as Empty, GlobeControl} from './controls-more.ts';
export {GlobeControl};
export {GPUInitializationError} from './gpu-error.ts';
// In the development build only, reading a member of MapLibre GL JS that a class here does not have warns once (see
// `watchMembers` in src/mistakes.ts). The production build has none of this.
import {watchMembers} from './mistakes.ts';
import {Map as CompatMap} from './compat-map.ts';
import {AttributionControl as Attribution} from './controls.ts';
import {NavigationControl as Navigation, ScaleControl as Scale, GeolocateControl as Geolocate, TerrainControl as Terrain} from './controls-more.ts';
declare const __DEV__: boolean;
if (__DEV__) watchMembers({Map: CompatMap, Marker, Popup, FullscreenControl, GlobeControl, NavigationControl: Navigation, ScaleControl: Scale, GeolocateControl: Geolocate, TerrainControl: Terrain, AttributionControl: Attribution, LogoControl: Empty});
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
import {GPUInitializationError} from './gpu-error.ts';
export default {
    GPUInitializationError,
    Map, MapLibreMap: Map, Point, InteractionHandler, LngLat, LngLatBounds, addProtocol, removeProtocol, Marker, Popup, configure: set,
    AttributionControl, NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, TerrainControl, LogoControl, GlobeControl,
    supported, getVersion, setWorkerUrl, getWorkerUrl, setWorkerCount, getWorkerCount, setMaxParallelImageRequests, getMaxParallelImageRequests, setRTLTextPlugin, getRTLTextPluginStatus,
};
