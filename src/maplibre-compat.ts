export {Map, Map as MapLibreMap} from './compat-map.ts';
export {InteractionHandler, type RenderedFeature, type PointLike, type FeatureOptions, type FeaturePlace} from './map.ts';
export {addProtocol, removeProtocol, type ProtocolFunction} from './protocols.ts';
export {LngLat, LngLatBounds, type LngLatInput, type LngLatBoundsInput} from './lnglat.ts';
export type {Anchor} from './markers.ts';
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
    if (__DEV__) for (const n of names) if (options[n] !== undefined && !noEffect[n]) {
        noEffect[n] = 1;
        console.warn(`[map-jr-gl] ${type}: the option ${n} has no effect. Remove it; see "What is different" in docs/reference/maplibre-differences.md.`);
    }
};
import {toLngLat, type LngLatLike as Where} from './geo.ts';
import type {Map as CoreMap} from './map.ts';
/**
 * The popup of the core with the options `focusAfterOpen`, `closeOnMove`, `trackPointer` and `subpixelPositioning` of
 * MapLibre GL JS. `locationOccludedOpacity` has no effect.
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
export {Evented};
/** The marker of the core with the private members `_map` and `_lngLat` that wrappers for MapLibre GL JS read. */
export class Marker extends CoreMarker {
    constructor(options: MarkerOptions = {}) { super(options); }
    get _map() { return this.map; }
    get _lngLat() { return this.getLngLat(); }
    /** The offset as a `Point`, as in MapLibre GL JS. */
    getOffset() { const o = super.getOffset(); return new Point(o.x, o.y); }
}
/** The control of the core with `on`, `off` and `once`. It fires `fullscreenstart` and `fullscreenend` on itself, as in MapLibre GL JS. */
export class FullscreenControl extends CoreFullscreen {
    private events = new Evented();
    on(type: string, fn: (e: any) => void) { return this.events.on(type, fn); }
    off(type: string, fn: (e: any) => void) { this.events.off(type, fn); return this; }
    once(type: string, fn: (e: any) => void) { this.events.once(type, fn); return this; }
    protected override changed(on: boolean) { this.events.fire(on ? 'fullscreenstart' : 'fullscreenend', {target: this}); }
}
export {Point} from './compat-map.ts';
import {Point} from './compat-map.ts';
import {LogoControl as Empty, GlobeControl} from './controls-more.ts';
export {GlobeControl};
export {GPUInitializationError} from './gpu-error.ts';
import {mercX, mercY, lngFromMerc, latFromMerc, EARTH_CIRCUMFERENCE as EARTH} from './geo.ts';
import {LngLat as Position} from './lnglat.ts';
/**
 * A position in the coordinates of Web Mercator, as in MapLibre GL JS: x and y run from 0 to 1 from the north-west
 * corner of the world to the south-east corner, and z is a height in the same units. Custom layers use it.
 */
export class MercatorCoordinate {
    constructor(public x: number, public y: number, public z = 0) {}
    /** The position of a longitude and latitude at a height in meters (default 0). */
    static fromLngLat(lngLat: Where, altitude = 0) {
        const [lng, lat] = toLngLat(lngLat);
        return new MercatorCoordinate(mercX(lng), mercY(lat), altitude / (EARTH * Math.cos(lat * Math.PI / 180)));
    }
    toLngLat() { return new Position(lngFromMerc(this.x), latFromMerc(this.y)); }
    /** The height in meters. */
    toAltitude() { return this.z * EARTH * Math.cos(latFromMerc(this.y) * Math.PI / 180); }
    /** The length of one meter at this position, in the units of x, y and z. */
    meterInMercatorCoordinateUnits() { return 1 / EARTH / Math.cos(latFromMerc(this.y) * Math.PI / 180); }
}
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
import {protocols} from './protocols.ts';
declare const __VERSION__: string; // the version of package.json, set by the build
let workerUrl = '', workerCount = 0, imageRequests = 16;
/** The version of this library. */
export const getVersion = () => __VERSION__;
/** A URL of MapLibre GL JS's worker file (`maplibre-gl-worker.mjs`, `maplibre-gl-csp-worker.js`) is ignored with one warning:
 * that file cannot run here, and the library finds its own worker file. */
let warned = 0;
export const setWorkerUrl = (url: string) => {
    if (/maplibre-gl[^/]*worker/i.test(String(url))) {
        if (__DEV__ && !warned++) console.warn('[map-jr-gl] setWorkerUrl(): this is the worker file of MapLibre GL JS, which this library cannot use. Remove the call; the library finds map-jr-gl-worker.js itself.');
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
/**
 * The settings object of MapLibre GL JS. `REGISTERED_PROTOCOLS` lists the protocols of `addProtocol` (a copy: write
 * with `addProtocol`). The other two are read and written like `getMaxParallelImageRequests` and `getWorkerUrl`.
 */
export const config = {
    get REGISTERED_PROTOCOLS() { return Object.fromEntries(protocols); },
    get MAX_PARALLEL_IMAGE_REQUESTS() { return imageRequests; },
    set MAX_PARALLEL_IMAGE_REQUESTS(count: number) { imageRequests = count; },
    get WORKER_URL() { return workerUrl; },
    set WORKER_URL(url: string) { setWorkerUrl(url); },
};
import type * as T from './compat-types.ts';
/**
 * A name that exists for `instanceof` only: `x instanceof Name` is true when `x.type` is `type`, as for the object
 * of `map.getSource(id)`. The class cannot make a source.
 */
const named = <V>(type: string) => class { static [Symbol.hasInstance](x: any) { return x?.type === type; } } as unknown as abstract new () => V;
export type GeoJSONSource = T.GeoJSONSource;
export type VectorTileSource = T.VectorTileSource;
export type RasterTileSource = T.RasterTileSource;
export type RasterDEMTileSource = T.RasterDEMTileSource;
export type ImageSource = T.ImageSource;
export type VideoSource = T.VideoSource;
export type CanvasSource = T.CanvasSource;
/** `map.getSource(id) instanceof GeoJSONSource` is true for a source of type `geojson`, and likewise for the other names. */
export const GeoJSONSource = named<GeoJSONSource>('geojson');
export const VectorTileSource = named<VectorTileSource>('vector');
export const RasterTileSource = named<RasterTileSource>('raster');
export const RasterDEMTileSource = named<RasterDEMTileSource>('raster-dem');
export const ImageSource = named<ImageSource>('image');
export const VideoSource = named<VideoSource>('video');
export const CanvasSource = named<CanvasSource>('canvas');
export type Event = T.Event;
/**
 * `new Event(type, data)` makes an event to pass to `fire`, as in MapLibre GL JS: an object with the members of
 * `data` and `type`. The events that the map fires are plain objects, not instances of this class.
 */
export const Event = class { constructor(type: string, data: object = {}) { Object.assign(this, data, {type}); } } as unknown as new (type: string, data?: object) => Event;
/**
 * The event of `GeolocateControl` for `trackuserlocationstart`, `trackuserlocationend`, `userlocationfocus` and
 * `userlocationlostfocus`. `new GeolocateEvent(type)` makes one to pass to `fire`, and `e instanceof GeolocateEvent` is
 * true for an event of one of these four types, also for the plain objects that the control fires.
 */
export class GeolocateEvent extends Event {
    static [Symbol.hasInstance](x: any) { return /^(trackuserlocation(start|end)|userlocation(lost)?focus)$/.test(x?.type); }
}
/**
 * The error class of MapLibre GL JS for a failed request, for `new` and `instanceof`. The requests of this library
 * fail with an `Error`, not with an `AJAXError`.
 */
export class AJAXError extends Error {
    declare status: number; declare statusText: string; declare url: string; declare body: Blob;
    constructor(status: number, statusText: string, url: string, body: Blob) {
        super(`AJAXError: ${statusText} (${status}): ${url}`);
        Object.assign(this, {status, statusText, url, body});
    }
}
/** Padding in pixels on each side, as the class of MapLibre GL JS, with its fields only: wrappers re-export it and call no method. */
export class EdgeInsets {
    declare top: number; declare bottom: number; declare left: number; declare right: number;
    constructor(top = 0, bottom = 0, left = 0, right = 0) { Object.assign(this, {top, bottom, left, right}); }
}
/** MapLibre GL JS starts its workers ahead of the first map. This library starts them with the first map, so this does nothing. */
export const prewarm = () => {};
/** Does nothing, as `prewarm` does nothing. */
export const clearPrewarmedResources = () => {};
/** The size of a tile in tile units, as in MapLibre GL JS. */
export const EXTENT = 8192;
/**
 * The control of MapLibre GL JS that keeps the camera in the fragment of the URL (`#zoom/lat/lng/bearing/pitch`, or
 * `#name=zoom/lat/lng` with a name). Wrappers use it as `new Hash().addTo(map)`. The map loads the code that reads and
 * writes the fragment on demand, so the fragment moves the map a moment after `addTo`. `getHashString` is not provided.
 */
export class Hash {
    private map?: CoreMap;
    private token?: object;
    private stop?: () => void;
    constructor(private hashName?: string) {}
    addTo(map: CoreMap) {
        this.remove();
        const token = this.token = {}, found = this._onHashChange();
        this.map = map;
        import('./hash.ts').then(m => { if (this.token === token) this.stop = m.watchHash(map, this.hashName || true, !found, found); });
        return this;
    }
    remove() { this.stop?.(); this.stop = this.token = this.map = undefined; return this; }
    /** Wrappers call this. It tells whether the fragment has a camera, which the map takes when the hash code has loaded. */
    _onHashChange() {
        const all = location.hash.slice(1), p = (this.hashName ? new URLSearchParams(all).get(this.hashName) ?? '' : all).split('/').map(Number);
        return p.length > 2 && !p.some(isNaN);
    }
    /** Wrappers call this. The code that loads in `addTo` writes the camera into a fragment that has none, so this does nothing. */
    _updateHash() {}
}

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
    Map, MapLibreMap: Map, Point, MercatorCoordinate, InteractionHandler, LngLat, LngLatBounds, addProtocol, removeProtocol, Marker, Popup, configure: set, Hash, config, Evented, EXTENT,
    GeoJSONSource, VectorTileSource, RasterTileSource, RasterDEMTileSource, ImageSource, VideoSource, CanvasSource, Event,
    GeolocateEvent, AJAXError, EdgeInsets, prewarm, clearPrewarmedResources,
    AttributionControl, NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, TerrainControl, LogoControl, GlobeControl,
    supported, getVersion, setWorkerUrl, getWorkerUrl, setWorkerCount, getWorkerCount, setMaxParallelImageRequests, getMaxParallelImageRequests, setRTLTextPlugin, getRTLTextPluginStatus,
};
export {createTileMesh, type CreateTileMeshOptions, type TileMesh, type IndicesType} from './tile-mesh.ts';
