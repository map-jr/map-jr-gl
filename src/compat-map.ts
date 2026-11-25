// The map of the entry `@map-jr/map-jr-gl/maplibre-compat`: the core map (map.ts) with the rest of the API of MapLibre GL JS.
// These methods are here, and not in the core, because the main entry does not need them: other names for a camera
// change, values that are fixed in this library, methods that only frameworks for MapLibre GL JS read, and query
// results that are arrays and promises at the same time.
import {Map as CoreMap, type CameraInput, type PointLike, type RenderedFeature, type RenderedQueryOptions, type PaddingInput, type ImageOptions, type FlyOptions} from './map.ts';
import type {QueriedFeature} from './query.ts';
import type {Command} from './engine.ts';
import {GPUInitializationError} from './gpu-error.ts';
import {zoomCurveErrors} from './mistakes.ts';
import {httpError} from './requests.ts';
import {defaults as loadDefaults} from './loader.ts';
import {absolute, LAYER_TYPES} from './resolve.ts';
import {mercX, mercY, lngFromMerc, latFromMerc, sides, toLngLat, TILE_SIZE, FOV, type LngLatLike} from './geo.ts';
import {LngLat, LngLatBounds} from './lnglat.ts';
import type {SetClusterOptions, AddLayerObject, CustomLayerInterface, GeoJSONFeature, MapGeoJSONFeature, MapEventType, MapLayerEventType, Source, MapOptions, EaseToOptions, StyleSwapOptions, FitBoundsOptions, QuerySourceFeatureOptions, FeatureIdentifier, StyleSpecification, Subscription} from './compat-types.ts';

/**
 * The types of `on`, `once`, `off` and `getSource` as in MapLibre GL JS: the event of a listener follows from the name
 * of the event, and a name that is not in the list gets an event of the type `any`. (Types only: the methods are those
 * of the core map.)
 */
export interface Map {
    /**
     * Adds a listener and returns a `Subscription`, as in MapLibre GL JS: `unsubscribe()` removes that listener, as
     * `off` with the same arguments does. With `layerId`, the event is one of a layer. `on` does not return the map, so
     * calls of `on` cannot be chained.
     */
    on<T extends keyof MapLayerEventType>(type: T, layerId: string | string[], listener: (e: MapLayerEventType[T]) => void): Subscription;
    on<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void): Subscription;
    on(type: string, listener: (e: any) => void): Subscription;
    on(type: string, layerId: string | string[], listener: (e: any) => void): Subscription;
    /**
     * Calls `listener` one time, for the next event of `type`, as in MapLibre GL JS. With `layerId`, the event is one of a
     * layer (`click` on that layer, for example). Without `listener`, `once` returns a promise of the event.
     */
    once<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void): this;
    once(type: string, listener: (e: any) => void): this;
    once<T extends keyof MapLayerEventType>(type: T, layerId: string | string[], listener: (e: MapLayerEventType[T]) => void): this;
    once<T extends keyof MapEventType>(type: T, layerId?: string | string[]): Promise<MapEventType[T]>;
    once(type: string, layerId?: string | string[]): Promise<any>;
    /** Removes a listener that `on` added, as in MapLibre GL JS. Pass the same type, layer id and function as to `on`. */
    off<T extends keyof MapLayerEventType>(type: T, layerId: string | string[], listener: (e: MapLayerEventType[T]) => void): this;
    off<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void): this;
    off(type: string, listener: (e: any) => void): this;
    off(type: string, layerId: string | string[], listener: (e: any) => void): this;
    /**
     * Returns the specification of the source with this id and the methods of its type, or `undefined` when the style has
     * no such source. MapLibre GL JS returns an object of a source class; see "Source methods" in docs/reference/maplibre-differences.md for the methods.
     */
    getSource<T extends Source = Source>(id: string): T | undefined;
    /** Moves the camera to a view with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    easeTo(o: EaseToOptions, eventData?: EventData): this;
    /**
     * Replaces the style with a style URL or a style object, and returns a promise that settles when the new style has
     * loaded. MapLibre GL JS returns the map.
     */
    setStyle(style: unknown, options?: StyleSwapOptions): Promise<void>;
    /** The style, as in MapLibre GL JS. It is `undefined` before the map has a style. */
    getStyle(): StyleSpecification;
}
/**
 * `map.cooperativeGestures`, as in MapLibre GL JS, with `enable()`, `disable()`, `isEnabled()`, `isActive()` (always
 * false) and `isBypassed(event)` (whether Ctrl, or ⌘ on a Mac, is down in the event). Its code loads on demand at the first `enable()` (cooperative-gestures.ts), so that a map without it pays little.
 */
const cooperativeGestures = (map: CoreMap) => {
    let on = false, stop: (() => void) | undefined, touchAction = '';
    // (The canvas is read each time: a fall back from the worker to the main thread replaces it; #777.)
    const style = () => map.getCanvas().style;
    const isBypassed = (event: MouseEvent | WheelEvent | PointerEvent) => event[navigator.userAgent.includes('Mac') ? 'metaKey' : 'ctrlKey'];
    const disable = () => { if (on) { on = false; stop?.(); stop = map.gate = undefined; style().touchAction = touchAction; } };
    map.on('remove', disable);
    return {enable() {
        if (on) return;
        on = true;
        // Until the file has loaded, the gestures are blocked without the hint: a wheel zooms only with Ctrl (⌘ on a
        // Mac), and one finger scrolls the page.
        touchAction = style().touchAction;
        style().touchAction = 'pan-x pan-y';
        map.gate = (type, e) => type === 'touch_pan' || !isBypassed(e as WheelEvent);
        // (After the import, the handler may be off again or the map removed: `disable()` has then set `on` to false.)
        import('./cooperative-gestures.ts').then(m => { if (on && !stop) stop = m.cooperate(map); });
    }, disable, isEnabled: () => on, isActive: () => false, isBypassed};
};
declare const __VERSION__: string; // the version of package.json, set by the build
declare const __DEV__: boolean;
/** The fields that a camera method copies onto the events of its move, as `eventData` in MapLibre GL JS. */
type EventData = Record<string, unknown>;
type XY = {x: number; y: number};
/**
 * A point in pixels, as `Point` of `@mapbox/point-geometry`, which MapLibre GL JS exports, with all of its methods.
 * A method whose name starts with `_` changes the point and returns it; the others return a new point.
 */
export class Point {
    constructor(public x: number, public y: number) {}
    static convert(p: Point | [number, number] | XY) {
        if (p instanceof Point) return p;
        if (Array.isArray(p)) return new Point(+p[0], +p[1]);
        if (p.x !== undefined && p.y !== undefined) return new Point(+p.x, +p.y);
        throw new Error('Expected [x, y] or {x, y} point format');
    }
    clone() { return new Point(this.x, this.y); }
    add(p: XY) { return this.clone()._add(p); }
    sub(p: XY) { return this.clone()._sub(p); }
    multByPoint(p: XY) { return this.clone()._multByPoint(p); }
    divByPoint(p: XY) { return this.clone()._divByPoint(p); }
    mult(k: number) { return this.clone()._mult(k); }
    div(k: number) { return this.clone()._div(k); }
    rotate(a: number) { return this.clone()._rotate(a); }
    rotateAround(a: number, p: XY) { return this.clone()._rotateAround(a, p); }
    matMult(m: number[]) { return this.clone()._matMult(m); }
    unit() { return this.clone()._unit(); }
    perp() { return this.clone()._perp(); }
    round() { return this.clone()._round(); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    equals(p: XY) { return this.x === p.x && this.y === p.y; }
    dist(p: XY) { return Math.sqrt(this.distSqr(p)); }
    distSqr(p: XY) { const dx = p.x - this.x, dy = p.y - this.y; return dx * dx + dy * dy; }
    angle() { return Math.atan2(this.y, this.x); }
    angleTo(b: XY) { return Math.atan2(this.y - b.y, this.x - b.x); }
    angleWith(b: XY) { return this.angleWithSep(b.x, b.y); }
    angleWithSep(x: number, y: number) { return Math.atan2(this.x * y - this.y * x, this.x * x + this.y * y); }
    private set(x: number, y: number) { this.x = x; this.y = y; return this; }
    _matMult(m: number[]) { return this.set(m[0] * this.x + m[1] * this.y, m[2] * this.x + m[3] * this.y); }
    _add(p: XY) { return this.set(this.x + p.x, this.y + p.y); }
    _sub(p: XY) { return this.set(this.x - p.x, this.y - p.y); }
    _mult(k: number) { return this.set(this.x * k, this.y * k); }
    _div(k: number) { return this.set(this.x / k, this.y / k); }
    _multByPoint(p: XY) { return this.set(this.x * p.x, this.y * p.y); }
    _divByPoint(p: XY) { return this.set(this.x / p.x, this.y / p.y); }
    _unit() { return this._div(this.mag()); }
    _perp() { return this.set(-this.y, this.x); }
    _rotate(a: number) { const c = Math.cos(a), s = Math.sin(a); return this.set(c * this.x - s * this.y, s * this.x + c * this.y); }
    _rotateAround(a: number, p: XY) {
        const c = Math.cos(a), s = Math.sin(a), dx = this.x - p.x, dy = this.y - p.y;
        return this.set(p.x + c * dx - s * dy, p.y + s * dx + c * dy);
    }
    _round() { return this.set(Math.round(this.x), Math.round(this.y)); }
}
export class Map extends CoreMap {
    /** As in MapLibre GL JS: with it on, the wheel zooms only with Ctrl (⌘ on a Mac), and one finger scrolls the page. */
    readonly cooperativeGestures = cooperativeGestures(this);
    /**
     * The text of a UI string from the option `locale`, with the keys of MapLibre GL JS. For a key that the option does
     * not have it returns undefined, and the control uses its own English text.
     * The controls and the hint of `cooperativeGestures` call it.
     */
    _getUIString(key: string): string | undefined {
        const text = this.uiLocale?.[key];
        return typeof text == 'string' ? text : undefined;
    }
    private uiLocale?: Record<string, unknown>;
    /** As in MapLibre, a `Point` with methods (`dist`, `sub`, …), not a plain object. */
    override project(lngLat: LngLatLike) { return Point.convert(super.project(lngLat)); }
    /** As in MapLibre GL JS: with no listener, `once` returns a promise for the event; a layer id makes it a layer event. */
    once(type: string, a?: any, b?: any): any {
        const layer = typeof a === 'string' || Array.isArray(a) ? a : undefined, fn = typeof a === 'function' ? a : b;
        if (!fn) return new Promise(resolve => layer ? this.once(type, layer, resolve) : this.once(type, resolve));
        if (!layer) return super.once(type, fn);
        const wrap = (e: any) => { this.off(type, layer, wrap); fn(e); };
        this.on(type, layer, wrap);
        return this;
    }
    /**
     * As in MapLibre GL JS, `on` returns a `Subscription`, and a listener for `data` or `sourcedata` hears each tile that
     * loads (`e.tile`); the engine reports tiles only from then on. (The return type is in the interface above.)
     */
    override on(type: string, a: any, b?: any): any {
        if (type === 'data' || type === 'sourcedata') this.reportTiles();
        super.on(type, a, b);
        return {unsubscribe: () => { this.off(type, a, b); }};
    }
    protected override tileLoaded(sourceId: string, z: number, x: number, y: number) {
        const canonical = {z, x, y, key: `${z}/${x}/${y}`}, tile = {tileID: {canonical, overscaledZ: z, wrap: 0, key: canonical.key}, state: 'loaded'};
        this.lastTile.set(sourceId, tile);
        for (const type of ['sourcedata', 'data']) this.fire(type, {dataType: 'source', sourceId, tile, coord: tile.tileID, isSourceLoaded: this.isSourceLoaded(sourceId), source: this.getSource(sourceId)});
    }
    /** The last tile that loaded, for each source (see `querySourceFeatures`). */
    private lastTile = new globalThis.Map<string, {tileID: {canonical: object}}>();
    /** The version of this library, as the member `version` of a map of MapLibre GL JS. */
    get version() { return __VERSION__; }
    /** The controls on the map, in the order they were added. vue-maplibre-gl reads this private member of MapLibre GL JS. */
    get _controls() { return this.added = (this.added ?? []).filter(c => this.hasControl(c)); }
    declare private added?: Parameters<CoreMap['addControl']>[0][];
    // ---- Accepted, with no effect ----
    // Frameworks for MapLibre GL JS call these methods when an application sets the option, often with the default
    // value. They are here so that such code does not stop. A value that this library cannot do gives one warning.
    private unsupported(name: string, isDefault: boolean) {
        if (!isDefault && !this.warned.has(name)) {
            const message = `[map-jr-gl] ${name} has no effect: this library does not have that feature.`;
            if (this.strict) throw new Error(message);
            this.warned.add(name); console.warn(message);
        }
        return this;
    }
    private warned = new Set<string>();
    /** `strict: true`: what gives a warning or an `error` event for code written for MapLibre GL JS throws an error. */
    private strict = false;
    /** The map draws on the main thread, which custom layers need: it was made with `renderer: 'main'`, or a custom layer moved it there. */
    private mainThread = false;
    /** The custom layers of the map start when their file has loaded. */
    private custom?: Promise<unknown>;
    private customLayers?: {forget(): void};
    /** The custom layers by id. A copy of the style (made when the map restores a lost WebGL context) gets them back from here. */
    private customs?: globalThis.Map<string, CustomLayerInterface>;
    /** One warning for code that used the array of a query without `await`, when the array was not complete. */
    private incomplete(name: string, had: number, has: number) {
        if (this.warned.has(name)) return;
        this.warned.add(name);
        console.warn(`[map-jr-gl] ${name}: the result was used without \`await\` and was not complete (${had} of ${has} features). Tile data is in a worker. Change\n    const features = map.${name}(...);\nto\n    const features = await map.${name}(...);\n(this also works in MapLibre GL JS). See "Feature queries" in docs/reference/maplibre-differences.md.`);
    }
    /** Has no effect: the camera has no roll. */
    setRoll(roll?: number) { return this.unsupported('setRoll', !roll); }
    /**
     * Returns the tiles that cover the view as plain objects `{canonical: {z, x, y, key}, wrap, overscaledZ, key}`; MapLibre GL JS
     * returns `OverscaledTileID` objects. `minzoom` is 0 and `maxzoom` 30 when they are left out.
     */
    coveringTiles(o: {tileSize: number, minzoom?: number, maxzoom?: number, roundZoom?: boolean}) {
        return this.tr.tileCover(o.minzoom ?? 0, o.maxzoom ?? 30, o.tileSize, o.roundZoom).map(({z, x, y, w, key}) =>
            ({canonical: {z, x, y, key}, wrap: w, overscaledZ: z, key: `${w}/${key}`}));
    }
    // The camera math of MapLibre GL JS 6 (mercator). Heights in meters convert to mercator units with the
    // circumference of MapLibre GL JS (6,371,008.8 m radius), so that the results agree with it.
    /** The camera options that look from `from` at `altitudeFrom` meters to `to` at `altitudeTo` meters, as in MapLibre GL JS. */
    calculateCameraOptionsFromTo(from: LngLatLike, altitudeFrom: number, to: LngLatLike, altitudeTo?: number) {
        altitudeTo ??= this.queryTerrainElevation(to) ?? 0;
        const [fl, fa] = toLngLat(from), [tl, ta] = toLngLat(to), tx = mercX(tl), ty = mercY(ta);
        const dx = tx - mercX(fl), dy = ty - mercY(fa), dz = altitudeTo / mercMetres(ta) - altitudeFrom / mercMetres(fa), d = Math.hypot(dx, dy, dz);
        if (!d) throw new Error("Can't calculate camera options with same From and To");
        const pitch = Math.acos(Math.hypot(dx, dy) / d) * 180 / Math.PI;
        return {center: new LngLat(lngFromMerc(tx), latFromMerc(ty)), elevation: altitudeTo, zoom: Math.log2(this.tr.cameraDistance / d / TILE_SIZE),
            pitch: dz < 0 ? 90 - pitch : 90 + pitch, bearing: Math.atan2(dx, -dy) * 180 / Math.PI};
    }
    /** The camera options that put the camera at `cameraLngLat` and `cameraAlt` meters with this rotation, as in MapLibre GL JS. */
    calculateCameraOptionsFromCameraLngLatAltRotation(cameraLngLat: LngLatLike, cameraAlt: number, bearing: number, pitch: number, roll?: number) {
        const [lng, lat] = toLngLat(cameraLngLat), p = pitch * Math.PI / 180, b = bearing * Math.PI / 180, down = -Math.cos(p), above = cameraAlt - this.tr.elevation;
        // (A camera that looks away from the ground, or along it, looks at a point 10 km away, as in MapLibre GL JS.)
        const far = down * above >= 0 || Math.abs(down) < Math.cos(89.25 * Math.PI / 180), dist = far ? 1e4 : -above / down;
        const x = mercX(lng), y = mercY(lat), sx = Math.sin(p) * Math.sin(b), sy = -Math.sin(p) * Math.cos(b);
        // The scale changes with the latitude of the center, which is not known yet: each pass takes the scale at the last center.
        let m = mercMetres(lat), dm = dist / m, cy = y + sy * dm, step = Infinity;
        for (let pass = 1; pass < 10; pass++) {
            const next = mercMetres(latFromMerc(cy)), change = Math.abs(next - m);
            if (change <= 1e-12 * m || change >= step) break;
            step = change; m = next; dm = dist / m; cy = y + sy * dm;
        }
        return {center: new LngLat(lngFromMerc(x + sx * dm), latFromMerc(cy)), elevation: far ? cameraAlt + dist * down : this.tr.elevation,
            zoom: Math.log2(this.tr.cameraDistance / dm / TILE_SIZE), bearing, pitch, roll};
    }
    /** The center and zoom that put `anchorLocation` at `anchorScreenPoint`, at `zoom` (default: the zoom of the map), as in MapLibre GL JS. */
    calculateAnchoredCameraOptions(o: {anchorLocation: LngLatLike; anchorScreenPoint: PointLike; zoom?: number}) {
        const tr = Object.assign(Object.create(Object.getPrototypeOf(this.tr)), this.tr) as typeof this.tr, [lng, lat] = toLngLat(o.anchorLocation);
        const pt = o.anchorScreenPoint as {x: number; y: number} | [number, number], px = Array.isArray(pt) ? pt[0] : pt.x, py = Array.isArray(pt) ? pt[1] : pt.y;
        tr.set(undefined, o.zoom);
        tr.setLocationAt(lng, lat, px, py);
        return {center: new LngLat(tr.lng, tr.lat), zoom: tr.zoom};
    }
    declare private unclamped?: boolean;
    /**
     * With `false`, the map center keeps its height (`setCenterElevation`) instead of following the ground, as in MapLibre
     * GL JS. With `true` (the default), the center goes back onto the ground.
     */
    setCenterClampedToGround(clamped: boolean) {
        if (!clamped === !!this.unclamped) return;
        this.unclamped = !clamped;
        super.setCenterElevation(clamped ? null : this.tr.elevation);
    }
    /** Returns whether the map center follows the ground, `true` unless `setCenterClampedToGround(false)` was called. */
    getCenterClampedToGround() { return !this.unclamped; }
    /**
     * Sets the vertical field of view of the camera in degrees, as in MapLibre GL JS: the value is clamped to 0.1 to 150,
     * the zoom stays, and the map fires `movestart`, `move` and `moveend`. The default is 36.87.
     */
    setVerticalFieldOfView(fov: number, eventData?: EventData) {
        if (!Number.isFinite(fov)) { console.warn(`[map-jr-gl] setVerticalFieldOfView(${fov}): the field of view is not a number. Pass degrees from 0.1 to 150.`); return this; }
        const r = Math.min(150, Math.max(0.1, fov)) * Math.PI / 180;
        if (r !== this.tr.fov) { this.post({type: 'jump', fov: this.tr.fov = r}); for (const t of ['movestart', 'move', 'moveend']) this.fire(t, {...eventData}); }
        return this;
    }
    /** Returns the vertical field of view of the camera in degrees (36.87 by default). */
    getVerticalFieldOfView() { return this.tr.fov * 180 / Math.PI; }
    /**
     * Sets the height of the map center in meters, as in MapLibre GL JS. It lasts only after `setCenterClampedToGround(false)`:
     * while the center is clamped to the ground, the ground height replaces it in the next frame, and the call warns once.
     */
    setCenterElevation(elevation: number, eventData?: EventData) {
        if (this.unclamped) return this.camera(eventData, () => super.setCenterElevation(+elevation));
        if (!this.warned.has('elevation')) { this.warned.add('elevation'); console.warn('[map-jr-gl] setCenterElevation(): the map center is clamped to the ground, which replaces the height in the next frame, as in MapLibre GL JS. Call setCenterClampedToGround(false) first.'); }
        return this;
    }
    /** Has no effect. */
    setAnisotropicFilterPitch(_pitch?: number | null) { return this; }
    /** Returns 20, the default of MapLibre GL JS. `setAnisotropicFilterPitch` does not change it. */
    getAnisotropicFilterPitch() { return 20; }
    /**
     * As in MapLibre GL JS, the map calls the function before each frame and draws the camera that it returns, when the
     * map draws on the main thread (`renderer: 'main'`). With the worker renderer the map does not apply what the
     * function returns, and it warns once when the function changes the camera.
     */
    setTransformCameraUpdate(fn?: ((tr: CameraLike) => CameraChanges | undefined) | null) {
        this.cameraUpdate = typeof fn == 'function' ? fn : undefined;
        if (this.mainThread) this.post({type: 'cameraUpdate', fn: this.cameraFrame()});
        // (The function also runs before each move event, as in MapLibre GL JS, where it runs before the camera of a
        // move event is set: react-map-gl reads the camera of the event from what its function was given last.)
        if (this.cameraUpdate && !this.recent) {
            this.recent = [];
            this.on('move', () => this.checkCameraUpdate());
        }
        return this;
    }
    /** The function that the engine calls before each frame: it applies the camera that the function of `setTransformCameraUpdate` returns. */
    private cameraFrame() {
        const fn = this.cameraUpdate;
        return fn ? (t: typeof this.tr) => {
            const r = fn({center: new LngLat(t.lng, t.lat), zoom: t.zoom, bearing: t.bearing, pitch: t.pitch, padding: this.getPadding(), elevation: t.elevation});
            if (!r || typeof r != 'object') return;
            const c = r.center as LngLatLike | undefined;
            t.set(c ? toLngLat(c) : undefined, r.zoom, r.bearing, r.pitch);
            this.drawn = [t.lng, t.lat, t.zoom, t.bearing, t.pitch];
        } : null;
    }
    /** The camera that the last frame drew after the function of `setTransformCameraUpdate` changed it. */
    declare private drawn?: number[];
    declare private cameraUpdate?: (tr: CameraLike) => CameraChanges | undefined;
    /** The last cameras of the map: a controlled map's state can be a few `move` events behind, and that is no change. */
    declare private recent?: {lng: number; lat: number; zoom: number; bearing: number; pitch: number}[];
    private checkCameraUpdate() {
        const fn = this.cameraUpdate, recent = this.recent!;
        if (!fn) return;
        const center = this.getCenter(), now = {lng: center.lng, lat: center.lat, zoom: this.getZoom(), bearing: this.getBearing(), pitch: this.getPitch()};
        // (On the main thread the function already saw the camera of a frame before it changed it, and a second call
        // with the changed camera would replace that camera in react-map-gl.)
        if (this.mainThread && this.drawn?.every((v, i) => v === [now.lng, now.lat, now.zoom, now.bearing, now.pitch][i])) return;
        recent.unshift(now); recent.length = Math.min(recent.length, 8);
        let r: CameraChanges | undefined;
        try { r = fn({center, zoom: now.zoom, bearing: now.bearing, pitch: now.pitch, padding: this.getPadding(), elevation: 0}); } catch { return; }
        if (this.mainThread || !r || typeof r != 'object' || this.warned.has('setTransformCameraUpdate')) return;
        const c = r.center as {lng?: number; lat?: number} | number[] | undefined, lng = Array.isArray(c) ? c[0] : c?.lng, lat = Array.isArray(c) ? c[1] : c?.lat;
        const same = (a: number | undefined, b: number) => typeof a != 'number' || Math.abs(a - b) < 1e-9;
        if (recent.some(k => same(lng, k.lng) && same(lat, k.lat) && same(r.zoom, k.zoom) && same(r.bearing, k.bearing) && same(r.pitch, k.pitch))) return;
        this.warned.add('setTransformCameraUpdate');
        console.warn('[map-jr-gl] setTransformCameraUpdate: the function changed the camera of a movement. This library draws that camera only when the movement ends (react-map-gl: onMove did not set viewState to e.viewState). To keep the map in a region, use the option maxBounds.');
    }
    // The debug drawing of MapLibre GL JS is not available (#752): setting one of these to true warns once.
    /**
     * Has no effect: the map does not draw tile borders. Reading it returns the value that was set.
     * @default false
     */
    get showTileBoundaries() { return !!this.debugDraw.showTileBoundaries; }
    set showTileBoundaries(v: boolean) { this.setDebug('showTileBoundaries', v); }
    /**
     * Has no effect: the map does not draw the padding. Reading it returns the value that was set.
     * @default false
     */
    get showPadding() { return !!this.debugDraw.showPadding; }
    set showPadding(v: boolean) { this.setDebug('showPadding', v); }
    /**
     * Has no effect: the map does not draw collision boxes. Reading it returns the value that was set.
     * @default false
     */
    get showCollisionBoxes() { return !!this.debugDraw.showCollisionBoxes; }
    set showCollisionBoxes(v: boolean) { this.setDebug('showCollisionBoxes', v); }
    /**
     * Has no effect: the map has no overdraw view. Reading it returns the value that was set.
     * @default false
     */
    get showOverdrawInspector() { return !!this.debugDraw.showOverdrawInspector; }
    set showOverdrawInspector(v: boolean) { this.setDebug('showOverdrawInspector', v); }
    private debugDraw: Record<string, boolean> = {};
    private setDebug(name: string, v: boolean) { this.debugDraw[name] = !!v; this.unsupported(name, !v); }

    /**
     * Changes the level of detail of the tile cover of a pitched view for one source, or for all sources, as in MapLibre GL JS.
     * A value below 1 counts as 1.
     */
    setSourceTileLodParams(maxZoomLevelsOnScreen: number, tileCountMaxMinRatio: number, sourceId?: string) {
        if (sourceId && !this.getSource(sourceId)) throw new Error(`[map-jr-gl] setSourceTileLodParams: there is no source "${sourceId}". Add the source first, or leave out the ID for all sources.`);
        const sources = sourceId ? [sourceId] : Object.keys(this.resolved?.sources ?? {}), lod = [Math.max(1, maxZoomLevelsOnScreen), Math.max(1, tileCountMaxMinRatio)];
        for (const id of sources) this.lods[id] = lod;
        this.post({type: 'lod', sources, lod});
        return this;
    }
    /** The parameters of `setSourceTileLodParams` by source: a new engine gets them again (#1050). */
    private lods: Record<string, number[]> = {};
    /** A new engine (after a lost context or a fall back) gets what the calls of this entry set: the constraint and the parameters of the tile cover; #1050. */
    protected override resend() {
        super.resend();
        if (this.tr.fov !== FOV) this.post({type: 'jump', fov: this.tr.fov});
        const fn = this.tr.customConstrain;
        if (fn) void this.ask(id => ({type: 'bound', id, fn}));
        if (this.mainThread && this.cameraUpdate) this.post({type: 'cameraUpdate', fn: this.cameraFrame()});
        for (const [id, lod] of Object.entries(this.lods)) this.post({type: 'lod', sources: [id], lod});
    }
    /** As in MapLibre GL JS, `fn(lngLat, zoom)` returns `{center, zoom}` and replaces the constraint of the camera; null restores it. */
    setTransformConstrain(fn?: ((lngLat: LngLat, zoom: number) => {center: LngLatLike; zoom: number}) | null) {
        // The engine calls the function on each change of the camera, so it must run on this thread, as a custom layer does.
        if (fn && !this.mainThread) {
            const message = "[map-jr-gl] setTransformConstrain has no effect: the function needs the map to draw on the main thread. Pass renderer: 'main' to new Map().";
            if (this.strict) throw new Error(message);
            if (!this.warned.has('setTransformConstrain')) { this.warned.add('setTransformConstrain'); console.warn(message); }
            return this;
        }
        const wrap = fn ? (t: typeof this.tr) => { const r = fn(new LngLat(t.lng, t.lat), t.zoom); [t.lng, t.lat] = toLngLat(r.center); t.zoom = r.zoom; } : null;
        this.tr.customConstrain = wrap;
        this.tr.set(undefined);
        void this.ask(id => ({type: 'bound', id, fn: wrap}));
        return this;
    }

    // ---- zoomSnap and setEventedParent, as in MapLibre GL JS ----
    /**
     * Sets the step of the zoom, as in MapLibre GL JS: above 0, a camera method ends at the nearest multiple of it.
     * `cameraForBounds` and `fitBounds` end at the multiple below.
     */
    setZoomSnap(snap: number) { this.zoomSnap = snap; return this; }
    /** Returns the step of the zoom that the option `zoomSnap` or `setZoomSnap` set, or 0 when the zoom does not snap. */
    getZoomSnap() { return this.zoomSnap; }
    private zoomSnap = 0;
    private snapped<T extends {zoom?: number}>(o: T, down?: boolean): T {
        const s = this.zoomSnap;
        return o.zoom === undefined || !(s > 0) ? o : {...o, zoom: (down ? Math.floor(o.zoom / s + 1e-10) : Math.round(o.zoom / s)) * s};
    }
    cameraForBounds(...args: Parameters<CoreMap['cameraForBounds']>) { return this.snapped(super.cameraForBounds(...args), true); }
    /** @internal (A turn of a mouse wheel ends at a multiple of zoomSnap, as in MapLibre GL JS.) */
    /** @internal As in MapLibre GL JS, the inertia of a rotate drag that ends closer to north than bearingSnap ends at bearing 0 (#1834). */
    protected override spinBearing(bearing: number) { const b = (bearing % 360 + 540) % 360 - 180; return b !== 0 && Math.abs(b) < this.bearingSnap ? 0 : bearing; }
    protected override post(c: Command, transfer?: Transferable[]) {
        if (c.type === 'wheel' && this.zoomSnap > 0) c.snap = this.zoomSnap;
        // As in MapLibre GL JS, the inertia of a pan that ends closer to north than bearingSnap ends at bearing 0 (#1834).
        if (c.type === 'fling' && this.tr.bearing !== 0 && Math.abs(this.tr.bearing) < this.bearingSnap) c.bearing = 0;
        super.post(c, transfer);
    }
    /**
     * As in MapLibre GL JS: each event of the map also goes to `parent.fire`, as one object with the fields of `data`
     * (or of what the function `data` returns), while `parent.listens(type)` is true.
     */
    setEventedParent(parent?: {fire(e: object): unknown; listens?(type: string): boolean} | null, data?: object | (() => object)) {
        this.parent = parent ? [parent, data] : undefined;
        return this;
    }
    declare private parent?: [{fire(e: object): unknown; listens?(type: string): boolean}, (object | (() => object))?];
    override fire(type: string | {type: string}, data: Record<string, unknown> = {}): void | PromiseLike<unknown> {
        if (typeof type == 'object') { data = type as Record<string, unknown>; type = type.type; }
        const r = this.dispatch(type, data), p = this.parent, up = () => { if (p && (p[0].listens?.(type as string) ?? true)) p[0].fire({...data, ...(typeof p[1] == 'function' ? p[1]() : p[1]), type, target: this}); };
        // (A click waits for its features: the parent gets it after the listeners of the map.)
        return r ? r.then(up) : up();
    }

    /**
     * Creates a map with the options of MapLibre GL JS, and the options `renderer`, `strict`, `fonts`, `fontFamily` and
     * `nonce` of this library.
     */
    // (The first signature takes a variable of the type `MapOptions`; the second takes other options of MapLibre GL JS.)
    constructor(options: MapOptions & {strict?: boolean});
    constructor(options: MapOptions & {strict?: boolean; [option: string]: unknown});
    constructor(options: MapOptions & {strict?: boolean; [option: string]: unknown}) {
        const o = options as Record<string, any>, context = o.canvasContextAttributes;
        // The name that stylesheets for MapLibre GL JS select by, added before the core measures the container, as
        // MapLibre GL JS does: CSS on `.maplibregl-map` can give the container its size.
        (typeof o.container == 'string' ? document.getElementById(o.container) : o.container)?.classList?.add('maplibregl-map');
        // (MapLibre GL JS has `antialias` in `canvasContextAttributes`.)
        // (A transformConstrain function runs in the engine, so without a renderer the map draws on the main thread.)
        super({...options, ...context?.antialias !== undefined && {antialias: context.antialias}, ...o.transformConstrain && !o.renderer && {renderer: 'main'}});
        this.strict = !!o.strict;
        this.mainThread = (o.transformConstrain && !o.renderer ? 'main' : o.renderer ?? loadDefaults.renderer) === 'main';
        // (The core constrained the camera of the options already: it is set again with the function.)
        if (o.transformConstrain) { this.setTransformConstrain(o.transformConstrain); this.jumpTo({center: o.center, zoom: o.zoom}); }
        // (A canvas that replaces this one is a copy of it.)
        this.getCanvas().classList.add('maplibregl-canvas');
        // As in MapLibre GL JS, the element of getCanvasContainer() has `maplibregl-touch-drag-pan` while dragPan is
        // enabled and `maplibregl-touch-zoom-rotate` while touchZoomRotate is enabled. Wrappers read them; the library does not.
        for (const [handler, name] of [[this.dragPan, 'touch-drag-pan'], [this.touchZoomRotate, 'touch-zoom-rotate']] as const) {
            const el = this.getCanvasContainer(), set = () => el.classList.toggle('maplibregl-' + name, handler.isEnabled());
            const {enable, disable} = handler;
            handler.enable = (opts?: unknown) => { enable.call(handler, opts); set(); };
            handler.disable = () => { disable.call(handler); set(); };
            set();
            this.once('remove', () => el.classList.remove('maplibregl-' + name));
        }
        if (typeof o.style === 'string') this.styleUrl = o.style;
        if (o.maxBounds) this.setMaxBounds(o.maxBounds);
        if (o.cooperativeGestures) this.cooperativeGestures.enable();
        if (o.centerClampedToGround === false) this.setCenterClampedToGround(false);
        if (o.elevation != null) this.setCenterElevation(o.elevation);
        if ((o as {glyphs?: unknown}).glyphs !== undefined) console.warn('[map-jr-gl] Map: the option glyphs was removed and has no effect; the map loads the glyph files of the style. Remove the option. To draw text with the fonts of the browser, remove "glyphs" from the style.');
        if (o.locale != null && typeof o.locale != 'object') console.warn('[map-jr-gl] Map: the option locale is not an object. Pass an object such as {"NavigationControl.ZoomIn": "Zoom avant"}.');
        else this.uiLocale = o.locale;
        const title = this._getUIString('Map.Title');
        if (title != null) this.getCanvas().setAttribute('aria-label', title);
        // (MapLibre GL JS 6.17 has no option projection and draws Mercator for it: pages that pass it expect that.)
        if (o.projection && ((o.projection as {type?: unknown}).type ?? o.projection) !== 'mercator' && !this.warned.has('projection')) {
            this.warned.add('projection');
            const message = '[map-jr-gl] new Map(): the option projection has no effect, as in MapLibre GL JS 6.17. Put "projection": {"type": "globe"} into the style, or call map.setProjection({type: "globe"}) after the style has loaded.';
            if (this.strict) throw new Error(message);
            console.warn(message);
        }
        this.unsupported('The option canvasContextAttributes (but for antialias)', !context || !Object.keys(context).some(k => k !== 'antialias' && k !== 'preserveDrawingBuffer'));
        if (context?.preserveDrawingBuffer) {
            const message = '[map-jr-gl] new Map(): canvasContextAttributes.preserveDrawingBuffer has no effect. Read the canvas with map.toBlob(), and remove the option.';
            if (this.strict) throw new Error(message);
            console.warn(message);
        }
        this.unsupported('The option logoPosition', !o.logoPosition);
        // (Development build) `validate: false` skips the check of the required fields of the style (#1748).
        if (__DEV__) this.noValidate = o.validate === false;
        // (Labels here always fade for a fixed time, and a drag with the right button always turns and tilts the map.)
        this.unsupported('The option fadeDuration', o.fadeDuration === undefined || o.fadeDuration === 300);
        this.unsupported('The option pitchWithRotate: false', o.pitchWithRotate !== false);
        this.unsupported('The option crossSourceCollisions: false', o.crossSourceCollisions !== false);
        // The drag handlers of MapLibre GL JS take options that this library does not read (#673): one warning each.
        const dragOptions = (name: string, used: boolean, todo: string) => {
            if (!used || this.warned.has(name)) return;
            const message = `[map-jr-gl] ${name} has no effect: the drag handlers here have no options. ${todo}.`;
            if (this.strict) throw new Error(message);
            this.warned.add(name); console.warn(message);
        };
        for (const k of ['dragPan', 'dragRotate'] as const) {
            dragOptions(`new Map(): an object as the option ${k}`, typeof o[k] == 'object' && o[k] !== null, 'Remove it, or pass true');
            const handler = this[k], on = handler.enable.bind(handler);
            handler.enable = (options?: unknown) => { dragOptions(`map.${k}.enable(options)`, typeof options == 'object' && options !== null, 'Call enable() with no argument'); on(); };
        }
        dragOptions('new Map(): the option rotateSpeed', o.rotateSpeed !== undefined && o.rotateSpeed !== 0.8, 'Remove it; the speed is fixed at 0.8');
        dragOptions('new Map(): the option pitchSpeed', o.pitchSpeed !== undefined && o.pitchSpeed !== -0.5, 'Remove it; the speed is fixed at -0.5');
        dragOptions('new Map(): the option aroundCenter: false', o.aroundCenter === false, 'Remove it; the map always rotates around the center');
        if (o.zoomSnap) { this.zoomSnap = o.zoomSnap; this.jumpTo({zoom: this.tr.zoom}); }
        if (typeof o.bearingSnap == 'number') this.bearingSnap = o.bearingSnap;
        // As in MapLibre GL JS, a gesture (a drag, a wheel zoom, a pinch, a rotate or a tilt) that ends with the map
        // closer to north than bearingSnap turns the map north. The inertia of a pan or of a rotate drag ends at north (see
        // `post` and `spinBearing`); after a gesture without inertia, the snap follows the gesture.
        let byHand = false;
        const handlers = [this.dragPan, this.dragRotate, this.touchZoomRotate, this.touchPitch];
        const held = () => handlers.some(h => h.isActive());
        this.on('move', () => { byHand ||= held(); });
        const wheel = () => { byHand ||= this.scrollZoom.isEnabled(); };
        this.getCanvasContainer().addEventListener('wheel', wheel, {passive: true});
        // (A pause during a gesture also ends a move: the snap waits until the pointers of the gesture lift.)
        const end = () => {
            if (!byHand || held() || this.isMoving()) return;
            byHand = false;
            if (this.tr.bearing !== 0) this.snapToNorth();
        };
        this.on('moveend', end);
        for (const type of ['pointerup', 'touchend'] as const) {
            const lifted = () => setTimeout(end);
            addEventListener(type, lifted, true);
            this.once('remove', () => removeEventListener(type, lifted, true));
        }
        super.setMissingStyleImageResolver(name => this.styleImage(name));
        this.once('remove', () => { this.imagesTurn++; });
    }

    // ---- The images in metadata["map-jr:images"] of the style (#759), as the main entry has them (#495) ----
    // The code is in a file loaded only for a style that has the key (see compat-style-images.ts). `styleImageNames`
    // has the names of the images that came from the style; an image that the page adds wins.
    private imagesSeen: unknown;
    private imagesTurn = 0;
    private imagesFor?: Promise<((name: string) => unknown) | void>;
    private styleImageNames = new Set<string>();
    private resolver: Parameters<CoreMap['setMissingStyleImageResolver']>[0] = null;
    setMissingStyleImageResolver(resolver: Parameters<CoreMap['setMissingStyleImageResolver']>[0]) { this.resolver = resolver; return this; }
    addImage(...args: Parameters<CoreMap['addImage']>) { this.styleImageNames.delete(args[0]); return super.addImage(...args); }
    private async styleImage(name: string) {
        if (!await (await this.imagesFor)?.(name)) await this.resolver?.(name);
    }
    private styleImages() {
        const given = this.rawStyle.metadata?.['map-jr:images'];
        if (given === this.imagesSeen) return;
        const turn = ++this.imagesTurn, live = () => turn === this.imagesTurn;
        this.imagesSeen = given;
        for (const name of this.styleImageNames) this.removeImage(name);
        this.styleImageNames.clear();
        this.imagesFor = given == null ? undefined : import('./compat-style-images.ts').then(m => live() ? m.compatImages(this, this.rawStyle, this.styleImageNames, live, (n, s, o) => super.addImage(n, s, o)) : undefined,
            () => { if (live()) this.fire('error', {error: new Error('[map-jr-gl] the style: the code for metadata["map-jr:images"] did not load, so the map has no images of the style. Serve the files of the library together.')}); });
    }

    // ---- Changes of the style that MapLibre GL JS refuses ----
    // The call has no effect and the map fires `error`, as in MapLibre GL JS. (Before the style has come, nothing is checked.)
    private refused(message: string) {
        const error = new Error('[map-jr-gl] ' + message);
        if (this.strict) throw error;
        this.fire('error', {error});
        return this;
    }
    // A value that is not a control fires `error`, as in MapLibre GL JS. A bad position throws, as there (from the core).
    /**
     * Adds a control to a corner of the map, as in MapLibre GL JS.
     * @param position `'top-left'`, `'top-right'`, `'bottom-left'` or `'bottom-right'`. When it is left out, the corner that `getDefaultPosition()` of the control returns, or else `'top-right'`.
     */
    addControl(control: Parameters<CoreMap['addControl']>[0], position?: Parameters<CoreMap['addControl']>[1]) {
        // (The core adds the attribution in its constructor, before the fields of this class exist: hence `??=`.)
        return (control as {onAdd?: unknown} | undefined)?.onAdd ? ((this.added ??= []).push(control), super.addControl(control, position)) : this.refused('addControl(): the argument is not a control. Pass an object with onAdd and onRemove methods.');
    }
    private warnedTypes?: Set<string>;
    /**
     * Adds a style layer below the layer `beforeId`, or on top when `beforeId` is left out, as in MapLibre GL JS.
     * A custom layer needs the map to draw on the main thread. A map that draws in a worker starts again on the main thread at its first custom layer, with its camera, style, sources, images and state. The map draws a custom layer only while the projection is Mercator.
     * A layer type that the library does not draw writes the warning of a loaded style, once for each type added with `addLayer`, for each map.
     */
    addLayer(layer: AddLayerObject, beforeId?: string) {
        let one: {id: string; source?: unknown} = layer;
        if (layer.type === 'custom') {
            // A custom layer draws with the WebGL context of the map, which only the engine on this thread shares. Its
            // code loads with the first one (custom-layers.ts). The style gets a layer with the id and the type, so that
            // the order and the visibility work as for other layers; the object of the user is its `implementation`.
            if (typeof (layer as CustomLayerInterface).render != 'function') return this.refused(`addLayer: the custom layer "${layer.id}" has no method render. Add render(gl, args).`);
            // (A map that draws in a worker moves its engine to this thread first, as after a lost context; #1730. The
            // layers start after that, so that `onAdd` gets the context of the new engine once.)
            const moved = this.mainThread || this.toMainThread();
            this.mainThread = true;
            this.custom ??= Promise.resolve(moved).then(() => import('./custom-layers.ts')).then(m => { this.customLayers = m.customLayers(this, draw => this.ask(id => ({type: 'custom', id, draw}))); }, error => this.fire('error', {error}));
            one = Object.defineProperty({id: layer.id, type: 'custom'}, 'implementation', {value: layer});
        }
        const {id, source} = one;
        if (this.rawStyle && this.getLayer(id)) return this.refused(`addLayer: the style has a layer with the id "${id}" already. Remove that layer first, or use another id.`);
        if (this.rawStyle && typeof source === 'string' && !this.rawStyle.sources[source]) return this.refused(`addLayer: the layer "${id}" names the source "${source}", which the style does not have. Add the source first.`);
        // (As a loaded style does, once for each type added with addLayer on this map, after the refusals above; #1140.)
        const type = (one as {type?: string}).type;
        if (one === layer && type && !LAYER_TYPES.has(type) && !(this.warnedTypes ??= new Set()).has(type)) { this.warnedTypes.add(type); console.warn('[map-jr-gl] Skipping unsupported layer types: ' + type); }
        if (one !== layer) (this.customs ??= new globalThis.Map()).set(id, layer as CustomLayerInterface);
        // As in MapLibre GL JS, a source object in the layer becomes a source with the id of the layer.
        if (source && typeof source === 'object') {
            if (this.rawStyle?.sources[id]) return this.refused(`addLayer: the layer "${id}" has a source object, and the style has a source with the id "${id}" already. Remove that source first, or pass source: "${id}".`);
            super.addSource(id, source);
            one = {...one, source: id};
        }
        return super.addLayer(one, beforeId);
    }
    /** As in MapLibre GL JS, a GeoJSON source without `buffer` keeps 128 pixels around each tile (the main entry keeps 16). */
    protected geojsonBuffer() { return 128; }
    /** As in MapLibre GL JS, a raster layer without `raster-fade-duration` fades a tile in over 300 ms (the main entry shows it at once). */
    protected rasterFade() { return 300; }
    /** Removes a style layer, as in MapLibre GL JS. */
    removeLayer(id: string) { this.customs?.delete(id); return super.removeLayer(id); }
    private styleUrl: string | null = null;
    /** The URL given as the option `style` or to the latest call of `setStyle`, as it was written; `null` when that was an object or nothing. */
    getStyleUrl() { return this.styleUrl; }
    /** Whether the map has a listener for the event `type`, a listener for a layer included. */
    listens(type: string): boolean { return !!this.listeners[type]?.length || this.layerListeners.some(l => l.type === type) || !!this.parent?.[0].listens?.(type); }
    /**
     * As in MapLibre GL JS 6.17: with `diff` (the default), the custom layers stay in the new style, each before the layer
     * that came after it, and get no `onRemove`. With `diff: false` they leave the map, also without `onRemove`.
     * With `diff`, a style equal to this one (apart from the camera) fires no event, as in MapLibre GL JS 6.17.
     */
    setStyle(style: unknown, options: StyleSwapOptions = {}) {
        this.styleUrl = typeof style === 'string' ? style : null;
        const own = options.transformStyle, diff = options.diff !== false;
        return super.setStyle(style, !this.customs?.size ? {transformStyle: own, diff} : {diff, transformStyle: (previous: any, next: any) => {
            next = own ? own(previous, next) : next;
            if (options.diff === false) { this.customs!.clear(); this.customLayers?.forget(); return next; }
            const layers = [...next.layers], ids = new Set(layers.map((l: {id: string}) => l.id));
            previous.layers.forEach((l: any, i: number) => {
                if (!l.implementation || ids.has(l.id)) return;
                const after = previous.layers.slice(i + 1).find((a: any) => !a.implementation && ids.has(a.id));
                layers.splice(after ? layers.findIndex((a: {id: string}) => a.id === after.id) : layers.length, 0, l);
            });
            return {...next, layers};
        }});
    }
    /** Adds a source to the style, as in MapLibre GL JS. */
    addSource(id: string, source: object) {
        return this.rawStyle?.sources[id] ? this.refused(`addSource: the style has a source with the id "${id}" already. Remove that source first, or use another id.`) : super.addSource(id, source);
    }
    /** Removes a source from the style, as in MapLibre GL JS. */
    removeSource(id: string) {
        const user = this.rawStyle?.layers.find((l: any) => l?.source === id);
        return user ? this.refused(`removeSource: the layer "${user.id}" uses the source "${id}". Remove the layer first.`) : (this.forgetSource(id), delete this.lods[id], this.post({type: 'lod', sources: [id], lod: []}), super.removeSource(id));
    }

    /**
     * Moves the camera to a view without an animation, as in MapLibre GL JS.
     * As in MapLibre GL JS, `eventData` goes onto the events of this move (`movestart` to `moveend`, and the zoom,
     * rotate and pitch events). A later camera call or user input replaces it; a nested call (fitBounds calls flyTo) keeps it.
     */
    jumpTo(o: CameraInput, eventData?: EventData) { return this.camera(eventData, () => super.jumpTo(this.snapped(o))); }
    easeTo(o: EaseToOptions, eventData?: EventData) {
        return this.camera(eventData, () => super.easeTo(this.snapped(o)));
    }
    /**
     * Moves the camera to fit a box, as in MapLibre GL JS: it flies there as `flyTo` does, or eases there as `easeTo` does when `o` sets `linear`.
     * The zoom fits the box as seen from above, turned by `bearing`. As in MapLibre GL JS, `offset` moves the fitted view and then the move, so it counts twice. The other options of `o` (`pitch`, `duration`, `speed`, `curve`, `essential` and the rest) go to that move.
     * @param eventData Fields that the events of this move carry.
     */
    fitBounds(bounds: Parameters<CoreMap['fitBounds']>[0], o: FitBoundsOptions = {}, eventData?: EventData) {
        return this.fit(this.cameraForBounds(bounds, o), o, eventData);
    }
    /**
     * Moves the map so that the box between the screen points `p0` and `p1` (CSS pixels) fills the view at `bearing`. The method
     * is that of MapLibre GL JS 6.17, and the options are those of `fitBounds`.
     */
    fitScreenCoordinates(p0: PointLike, p1: PointLike, bearing: number, o: FitBoundsOptions = {}, eventData?: EventData) {
        // The box of the two places, with edges along the meridians and parallels, is fitted turned by the bearing.
        const a = this.unproject(p0), b = this.unproject(p1);
        return this.fit(this.cameraForBounds([Math.min(a.lng, b.lng), Math.min(a.lat, b.lat), Math.max(a.lng, b.lng), Math.max(a.lat, b.lat)], {...o, bearing}), o, eventData);
    }
    /** As `_fitInternal` of MapLibre GL JS 6.17: the options of the call go onto the move, and the fit flies unless `linear` is set. */
    private fit(camera: EaseToOptions, {padding, linear, ...o}: FitBoundsOptions, eventData?: EventData) {
        return linear ? this.easeTo({...camera, ...o}, eventData) : this.flyTo({...camera, ...o}, eventData);
    }
    private camera(eventData: EventData | undefined, f: () => this) {
        if (!this.nested) this.moveData = eventData;
        this.nested++;
        try { return f(); } finally { this.nested--; }
    }
    private moveData?: EventData;
    private nested = 0;
    flyTo(o: EaseToOptions & FlyOptions, eventData?: EventData) {
        return this.camera(eventData, () => super.flyTo(this.snapped(o)));
    }
    /** Sets the padding in CSS pixels: the space at the edges that other things cover, such as a side panel. The map center moves to the middle of the rest. */
    setPadding(padding: PaddingInput, eventData?: EventData) { return this.jumpTo({padding}, eventData); }
    /** Returns the padding of the map in CSS pixels, as `{top, right, bottom, left}`. */
    getPadding() { const [top, right, bottom, left] = this.tr.padding; return {top, right, bottom, left}; }
    /** Moves the map center to a position without an animation, as in MapLibre GL JS. */
    setCenter(center: LngLatLike, eventData?: EventData) { return this.jumpTo({center}, eventData); }
    /** Sets the zoom level without an animation, as in MapLibre GL JS. */
    setZoom(zoom: number, eventData?: EventData) { return this.jumpTo({zoom}, eventData); }
    /** Sets the bearing in degrees without an animation, as in MapLibre GL JS. */
    setBearing(bearing: number, eventData?: EventData) { return this.jumpTo({bearing}, eventData); }
    /** Sets the pitch in degrees without an animation, as in MapLibre GL JS. */
    setPitch(pitch: number, eventData?: EventData) { return this.jumpTo({pitch}, eventData); }
    /** Turns the map to bearing 0 with an animation of 1000 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    resetNorth(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({bearing: 0, duration: 1000, ...o}, eventData); }
    /** Turns the map to bearing 0 and pitch 0 with an animation of 1000 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    resetNorthPitch(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({bearing: 0, pitch: 0, duration: 1000, ...o}, eventData); }
    /** Moves the map center to a position with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    panTo(center: LngLatLike, o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({center, ...o}, eventData); }
    /** Moves the map by `offset` in CSS pixels with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    panBy(offset: [number, number], o: {duration?: number} = {}, eventData?: EventData) {
        return this.easeTo({center: this.unproject([this.tr.cx + offset[0], this.tr.cy + offset[1]]), ...o}, eventData);
    }
    /** Changes the zoom level with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    zoomTo(zoom: number, o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({zoom, ...o}, eventData); }
    /** Increases the zoom level by 1 with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    zoomIn(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({zoom: this.tr.zoom + 1, ...o}, eventData); }
    /** Decreases the zoom level by 1 with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    zoomOut(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({zoom: this.tr.zoom - 1, ...o}, eventData); }
    /** Changes the bearing in degrees with an animation of 500 ms unless `o` sets `duration`, as in MapLibre GL JS. */
    rotateTo(bearing: number, o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({bearing, ...o}, eventData); }
    /** The option `bearingSnap` in degrees: a gesture that ends closer to north than this turns the map north. */
    private bearingSnap = 7;
    /**
     * Turns the map to bearing 0 when the bearing is less than the option `bearingSnap` (7 degrees by default) from
     * north, as in MapLibre GL JS.
     */
    snapToNorth(o: {duration?: number} = {}, eventData?: EventData) { return Math.abs(this.tr.bearing) < this.bearingSnap ? this.resetNorth(o, eventData) : this; }
    /** Returns 0: the camera has no roll. */
    getRoll() { return 0; }
    /** Returns the elevation of the ground at the map center in meters, as `getCenterElevation` does. */
    getCameraTargetElevation() { return this.tr.elevation; }
    /** Whether the zoom level changes now, by the user or by a camera method. */
    isZooming() { return this.zooming; }
    /** Whether the bearing changes now, by the user or by a camera method. */
    isRotating() { return this.rotating; }
    /** Returns `false`: the camera has no roll. */
    isRolling() { return false; }
    /** Whether the pitch changes now, by the user or by a camera method. */
    isPitching() { return this.pitching; }
    /** Returns the container of the map. MapLibre GL JS returns an element inside the container, which this library does not have. */
    getCanvasContainer() { return this.container; }
    /** Removes the map and its controls from the page, as in MapLibre GL JS. */
    remove() { super.remove(); this.getContainer().classList.remove('maplibregl-map'); }
    /** Draws the map again in the next frame. */
    redraw() { this.triggerRepaint(); return this; }
    // react-map-gl and other wrappers read these private members of the MapLibre map. They are here only so that
    // those wrappers work: `style._loaded` tells them that sources and layers can be added, and Maputnik reads the
    // source layers of each vector source in `tileManagers[id]._source.vectorLayerIds` (`sourceCaches` in MapLibre 5).
    /**
     * For wrappers that read the private `style` of MapLibre GL JS: `_loaded`, `updateImage`, and `tileManagers` (also
     * `sourceCaches`) with the id, type and `vectorLayerIds` of each source. Before the style has resolved, `_loaded` is
     * `false` and there are no sources, as in MapLibre GL JS. `projection.subdivisionGranularity` has the values of
     * MapLibre GL JS 6.17 for the projection of the style (#1453).
     */
    get style() {
        // A granularity as in MapLibre GL JS: [base, min], and the number of segments of a tile at zoom z.
        const g = (base: number, min: number) => ({getGranularityForZoomLevel: (z: number) => Math.max(Math.floor(base / (1 << z)), min, 1)}),
            globe = (this.getProjection() as {type?: unknown} | undefined)?.type === 'globe';
        const subdivisionGranularity = globe ? {fill: g(128, 2), line: g(512, 0), tile: g(128, 32), stencil: g(128, 1), circle: 3}
            : {fill: g(0, 0), line: g(0, 0), tile: g(0, 0), stencil: g(0, 0), circle: 1};
        const tileManagers: Record<string, {_source: {id: string; type: string; vectorLayerIds?: string[]}}> = {};
        for (const [id, s] of Object.entries(this.resolved?.sources ?? {})) tileManagers[id] = {_source: {id, type: s.type, vectorLayerIds: s.layerIds}};
        return {_loaded: this.ready, projection: {subdivisionGranularity}, tileManagers, sourceCaches: tileManagers, updateImage: (name: string, image: Parameters<CoreMap['addImage']>[1]): void => { this.updateImage(name, image); }};
    }
    /** For wrappers that read the private `transform` of MapLibre GL JS: `center`, `zoom`, `bearing`, `pitch`, `roll`, `elevation` and `isPaddingEqual`, as a copy of the camera. */
    get transform() {
        const tr = this.tr, padding = this.getPadding();
        return {center: new LngLat(tr.lng, tr.lat), zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch, roll: 0, elevation: tr.elevation, padding,
            isPaddingEqual: (p: PaddingInput) => { const [t, r, b, l] = sides(p); return t === padding.top && r === padding.right && b === padding.bottom && l === padding.left; }};
    }
    /** The camera that wrappers compare their state with (`transform`); MapLibre GL JS 6 has this name, and 5 has `_getTransformForUpdate`. */
    getTransformForUpdate() { return this.transform; }
    _getTransformForUpdate() { return this.transform; }
    /** `_stop(true)` is how wrappers stop the camera while they keep gestures; here it is `stop()`. */
    _stop(_allowGestures?: boolean) { return this.stop(); }
    _render() { this.triggerRepaint(); }
    _update() { this.triggerRepaint(); }
    /** Returns the fields of the light that the style sets, or `{}` when the style has no light. */
    getLight(): {anchor?: string; position?: number[]; color?: string; intensity?: number} { return {...this.rawStyle?.light}; }
    /** The style, as in MapLibre GL JS: without its custom layers. */
    getStyle() { const style = super.getStyle(); if (style) style.layers = style.layers.filter((l: {type: string}) => l.type !== 'custom'); return style; }
    /** Returns the ids of the style layers, from the bottom layer up. */
    getLayersOrder(): string[] { return this.rawStyle?.layers.filter((l: any) => l).map((l: any) => l.id) ?? []; }
    /** Returns the value of a paint property as the style sets it, or `undefined` when the style does not set it. */
    getPaintProperty(layerId: string, name: string): unknown { return this.getLayer(layerId)?.paint?.[name]; }
    /** Returns the value of a layout property as the style sets it, or `undefined` when the style does not set it. */
    getLayoutProperty(layerId: string, name: string): unknown { return this.getLayer(layerId)?.layout?.[name]; }
    /** Returns the filter of a style layer, or `undefined` when it has none. */
    getFilter(layerId: string): unknown { return this.getLayer(layerId)?.filter; }
    /** Moves a style layer below the layer `beforeId`, or to the top when `beforeId` is left out. */
    moveLayer(id: string, beforeId?: string) {
        return this.editStyle(s => {
            const [layer] = s.layers.splice(this.layerIndex(s, id), 1);
            s.layers.splice(beforeId ? this.layerIndex(s, beforeId) : s.layers.length, 0, layer);
        });
    }
    /** Returns the sprites of the style as `{id, url}` objects. A sprite that the style gives as one URL has the id `'default'`. */
    getSprite(): {id: string; url: string}[] { const s = this.rawStyle?.sprite; return typeof s === 'string' ? [{id: 'default', url: s}] : s ?? []; }
    /** Replaces the sprites of the style, or removes them with `null`. */
    setSprite(url: string | {id: string; url: string}[] | null) { return this.editStyle(s => { if (url) s.sprite = url; else delete s.sprite; }); }
    /** Adds a sprite sheet with an id and a URL to the style, as in MapLibre GL JS. Its images have the names `id:name`. */
    addSprite(id: string, url: string) { return this.setSprite([...this.getSprite().filter((s: {id: string}) => s.id !== id), {id, url}]); }
    /** Removes the sprite sheet with this id from the style. */
    removeSprite(id: string) { const rest = this.getSprite().filter((s: {id: string}) => s.id !== id); return this.setSprite(rest.length ? rest : null); }
    /** Returns the URL of the glyph files of the style, or `null` when the style has none. */
    getGlyphs(): string | null { return this.rawStyle?.glyphs ?? null; }
    /** Sets the URL of the glyph files of the style. The map loads them from this URL. */
    setGlyphs(url: string | null) { return this.editStyle(s => { if (url) s.glyphs = url; else delete s.glyphs; }); }
    /**
     * As in MapLibre GL JS, a vector, raster or raster-dem source has `setTiles(tiles)` and `setUrl(url)` (a TileJSON
     * URL), which replace its tiles and load them again. The TileJSON goes through the same request as in the style.
     * Such a source also has `minzoom`, `maxzoom` and `tiles` of its TileJSON once that has loaded, and `reload()`.
     * A GeoJSON source has `setClusterOptions`, `getClusterOptions` and `getBounds`.
     */
    getSource(id: string): any {
        const spec = super.getSource(id), type = spec?.type;
        const more = {loaded: () => this.isSourceLoaded(id), serialize: () => this.getStyle()?.sources[id]};
        if (type === 'geojson') return {
            ...spec, ...more,
            getClusterOptions: () => ({cluster: !!spec.cluster, clusterMaxZoom: spec.clusterMaxZoom ?? (spec.maxzoom ?? 18) - 1, clusterRadius: spec.clusterRadius ?? 50}),
            // (A promise, as in MapLibre GL JS. The map builds the clusters again with the next frame.)
            setClusterOptions: async (o: SetClusterOptions) => {
                if (!o || typeof o !== 'object') throw new Error(`[map-jr-gl] getSource("${id}").setClusterOptions(options): "options" must be an object with cluster, clusterMaxZoom or clusterRadius.`);
                this.editStyle(s => { const src = s.sources[id]; if (src) for (const k of ['cluster', 'clusterMaxZoom', 'clusterRadius'] as const) if (o[k] !== undefined) src[k] = o[k]; });
            },
            getBounds: async () => {
                const bounds = new LngLatBounds();
                const walk = (g: any, depth: number) => {
                    if (typeof g?.[0] === 'number') bounds.extend([g[0], g[1]]);
                    else if (g && depth < 9) for (const x of g.features ?? g.geometries ?? (Array.isArray(g) ? g : [g.geometry ?? g.coordinates])) walk(x, depth + 1);
                };
                walk(await spec.getData(), 0);
                return bounds;
            },
        };
        if (!/^(vector|raster)/.test(type)) return spec;
        const set = (k: string, v: unknown, ok: boolean) => {
            if (!ok) throw new Error(`[map-jr-gl] getSource("${id}").${k === 'url' ? 'setUrl(url): "url" must be a string' : 'setTiles(tiles): "tiles" must be an array of URL strings'}.`);
            this.editStyle(s => { const src = s.sources[id]; if (src) delete src.url, delete src.tiles, src[k] = Array.isArray(v) ? [...v] : v; });
            return source;
        };
        const {minzoom, maxzoom, tiles} = this.resolved?.sources[id] ?? {};
        const source = {minzoom, maxzoom, tiles, ...spec, ...more, id, setTiles: (t: string[]) => set('tiles', t, Array.isArray(t) && t.every(x => typeof x === 'string')), setUrl: (u: string) => set('url', u, typeof u === 'string'), reload: () => { this.refreshTiles(id); }};
        return source;
    }
    /** Returns the `font-faces` of the style, or `null` when the style has none. */
    getFontFaces(): Record<string, unknown> | null { return this.rawStyle?.['font-faces'] || null; }
    /** Replaces the `font-faces` of the style, or removes them with `null`. */
    setFontFaces(faces: Record<string, unknown> | null) { return this.editStyle(s => { if (faces) s['font-faces'] = faces; else delete s['font-faces']; }); }
    /** Merges `state` into the feature state of one feature. A feature without an `id` changes nothing. */
    setFeatureState(feature: FeatureIdentifier, state: Record<string, unknown>) { return this.hasId(feature, 'setFeatureState') ? super.setFeatureState(feature, state) : this; }
    /** Returns the feature state of one feature. A feature without an `id` returns `{}`. */
    getFeatureState(feature: FeatureIdentifier) { return this.hasId(feature, 'getFeatureState') ? super.getFeatureState(feature) : {}; }
    private hasId(f: FeatureIdentifier, name: string): f is FeatureIdentifier & {id: string | number} {
        if (f.id != null) return true;
        if (!this.warned.has(name)) this.warned.add(name), console.warn(`[map-jr-gl] ${name}(): the feature has no "id". Give the source features an id, or set "promoteId" on the source.`);
        return false;
    }
    /**
     * Returns `{data, pixelRatio, sdf}` and the other options of an image that `addImage` added, or `undefined`. Raw pixels and drawable sources (canvas, image,
     * bitmap) come back as `{width, height, data}` with RGBA pixels, as in MapLibre; a URL or SVG text comes back as given.
     */
    getImage(name: string) {
        const i = this.imageInputs.get(name);
        if (!i) return;
        let data: unknown = i[0];
        if (typeof data === 'object' && data) {
            if ('data' in data) { const d = data as {width: number; height: number; data: ArrayLike<number>}; data = {width: d.width, height: d.height, data: new Uint8Array(d.data)}; }
            else try {
                const s = data as HTMLImageElement, width = s.naturalWidth || s.width, height = s.naturalHeight || s.height, c = document.createElement('canvas');
                c.width = width; c.height = height;
                const g = c.getContext('2d', {willReadFrequently: true})!;
                g.drawImage(s, 0, 0);
                data = {width, height, data: new Uint8Array(g.getImageData(0, 0, width, height).data.buffer)};
            } catch { /* A source of another origin or with no size stays as given. */ }
        }
        return {pixelRatio: i[1].pixelRatio ?? 1, sdf: false, ...i[1], data};
    }
    /** Returns the names of the images that the map has. */
    listImages() { return [...this.imageNames]; }
    /** Fetches and decodes the image at a URL, and returns a promise of `{data}` with an `ImageBitmap`, as in MapLibre GL JS. */
    async loadImage(url: string) {
        const res = await this.fetchAs('Image')(url);
        if (!res.ok) throw httpError('image', url, res.status);
        return {data: (res as {image?: ImageBitmap}).image ?? await createImageBitmap(await res.blob())};
    }
    /** The code for queries on the page, loaded when the style has a GeoJSON source with its data in the style. */
    private syncQuery?: typeof import('./sync-query.ts');
    /**
     * The data of a GeoJSON source, when the page has it: the data is in the style, or the page has fetched it for a
     * query before. If not, the page fetches it now (the browser has it in its cache already) and then fires the data
     * events of the source, so that code that listens for them asks again.
     */
    private geoData(id: string): object | undefined {
        const spec = this.rawStyle?.sources[id], kept = this.geoKept.get(id);
        if (!spec?.data || typeof spec.data === 'object') return spec?.data;
        if (kept?.from === spec.data) return kept!.data;
        const entry: {from: string; data?: object} = {from: spec.data};
        this.geoKept.set(id, entry);
        Promise.all([this.fetchAs('Source')(absolute(spec.data, this.styleBase)).then(r => r.json()), import('./sync-query.ts')]).then(([data, m]) => {
            entry.data = data; this.syncQuery = m;
            for (const type of ['sourcedata', 'data']) this.fire(type, {dataType: 'source', sourceId: id, isSourceLoaded: true, sourceDataType: 'content'});
        }, () => {});
    }
    private geoKept = new globalThis.Map<string, {from: string; data?: object}>();
    /**
     * Returns the features of a source in the tiles of the present view, as an array that is also a promise; MapLibre GL JS
     * returns only the array. The features are all the features of those tiles, as in MapLibre GL JS, and
     * also
     * those that no layer draws and those outside the view. As with `queryRenderedFeatures`, the result is an array
     * that can also be awaited: at once it has the features of a GeoJSON source whose data the page has (clusters too),
     * and for other sources the last answer of the engine for the same source and options; awaited, it has the
     * features of each kind of source in the present view.
     */
    querySourceFeatures(sourceId: string, options: QuerySourceFeatureOptions = {}): GeoJSONFeature[] & PromiseLike<GeoJSONFeature[]> {
        const sets = [{layer: '', source: sourceId, sourceLayer: options.sourceLayer, filter: options.filter, radius: Infinity}], box: [number, number, number, number] = [0, 0, this.tr.width, this.tr.height];
        // (A radius without end takes each feature of the tiles under the view, whatever the layers draw.)
        const features = (found: QueriedFeature[]): Omit<RenderedFeature, 'layer'>[] => found.map(f => ({type: 'Feature', id: f.id, geometry: f.geometry!, properties: f.properties, source: f.source, sourceLayer: f.sourceLayer || undefined,
            state: f.id === undefined ? {} : this.getFeatureState({source: f.source, sourceLayer: f.sourceLayer || undefined, id: f.id})}));
        const spec = this.rawStyle?.sources[sourceId], data = spec?.type === 'geojson' && this.geoData(sourceId);
        // At once: the last answer of the engine for this source and these options, in any view (see `sourceAnswers`).
        const key = JSON.stringify([sourceId, options.sourceLayer, options.filter]), turn = this.sourceTurn.get(sourceId);
        let now: QueriedFeature[] = this.sourceAnswers.get(key)?.found ?? [];
        if (data && this.syncQuery) try { now = this.syncQuery.queryGeoJSON(sourceId, {...spec, data}, this.tr, box, sets); } catch { /* the promise has the complete result or the error */ }
        let awaited = false;
        const result = features(now), had = now.length, all = this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: true})).then(found => {
            if (turn === this.sourceTurn.get(sourceId)) {
                this.sourceAnswers.delete(key);
                this.sourceAnswers.set(key, {sourceId, found});
                if (this.sourceAnswers.size > 64) this.sourceAnswers.delete(this.sourceAnswers.keys().next().value!);
            }
            if (!awaited && found.length > had) {
                this.incomplete('querySourceFeatures', had, found.length);
                // Code that reads the array asks again when a tile loads (Maputnik does): report the last tile of the
                // source again, one time for a question, and the same question then has the answer at once.
                const tile = this.lastTile.get(sourceId);
                if (tile && !this.refired.has(key)) { this.refired.add(key); for (const type of ['sourcedata', 'data']) this.fire(type, {dataType: 'source', sourceId, tile, coord: tile.tileID, isSourceLoaded: this.isSourceLoaded(sourceId), source: this.getSource(sourceId)}); }
            }
            return features(found);
        });
        all.catch(() => {}); // (MapLibre's query is synchronous: a result that nobody awaits rejects nothing on the page, also after `remove()`.)
        Object.defineProperty(result, 'then', {value: (done?: (v: Omit<RenderedFeature, 'layer'>[]) => unknown, failed?: (e: unknown) => unknown) => { awaited = true; return all.then(done, failed); }});
        return result as unknown[] as GeoJSONFeature[] & PromiseLike<GeoJSONFeature[]>;
    }

    protected override styleChanged() {
        this.styleImages();
        if (this.customs) for (const l of this.rawStyle.layers ?? []) if (l?.type === 'custom' && !l.implementation && this.customs.has(l.id)) Object.defineProperty(l, 'implementation', {value: this.customs.get(l.id)});
        if (!this.syncQuery && Object.values<any>(this.rawStyle.sources ?? {}).some(src => src?.type === 'geojson' && src.data && typeof src.data === 'object')) import('./sync-query.ts').then(m => { this.syncQuery = m; });
    }

    /**
     * Returns the features that the style layers draw at a point or in a box of the screen, the top layer first, as an
     * array that is also a promise; MapLibre GL JS returns only the array. With no geometry, the box is the whole map.
     * The arguments and the features are those of MapLibre GL JS.
     *
     * The tile data is in a worker, so the complete result is a promise: `await map.queryRenderedFeatures(...)`.
     * The value is also an array, for code that uses the result at once as MapLibre permits. As an array it has the
     * features of the GeoJSON sources whose data is in the style (which the page can read itself), and not those of
     * tile sources. Plugins that draw and edit on the map query their own GeoJSON sources in this way.
     */
    queryRenderedFeatures(geometry?: PointLike | [PointLike, PointLike] | RenderedQueryOptions, options?: RenderedQueryOptions): MapGeoJSONFeature[] & PromiseLike<MapGeoJSONFeature[]> {
        const {box, sets, features} = this.rendered(geometry, options);
        // At once: the answer of the engine to the same question before, if there is one (see `answers`).
        const key = this.questionKey(box, sets), all = this.questionKey(box), kept = this.answers.get(key);
        const wide = !kept && sets.every(s => !s.also) ? this.answers.get(all) : undefined, wanted = new Set(sets.map(s => s.layer));
        let now: QueriedFeature[] = kept?.found ?? wide?.found.filter(f => wanted.has(f.layer!)) ?? [];
        // The GeoJSON sources that the page has the data of are read here, also when an answer was kept: that answer can
        // be from before a `setData`.
        const sync = this.syncQuery, own = new Set<string>();
        if (sync) for (const [id, spec] of Object.entries<any>(this.rawStyle?.sources ?? {})) {
            const mine = sets.filter(s => s.source === id);
            const data = mine.length && spec.type === 'geojson' && this.geoData(id);
            if (data) try { const found = sync.queryGeoJSON(id, {...spec, data}, this.tr, box, mine); now = now.filter(f => f.source !== id || own.has(id)); own.add(id); now.push(...found); } catch { /* the promise has the complete result or the error */ }
        }
        const result = features([...now]), given = this.summary(now);
        // Later: all the sources, from the engine.
        const turn = this.turn, move = this.inMove, later = sets.length ? this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: true})).then(found => {
            this.keep(key, found, turn);
            // A `mousemove` listener read the array (react-map-gl does so for hover): while the pointer has not moved
            // since, that `mousemove` fires again, and the same question then has the answer at once.
            if (move && !awaited && this.summary(found) !== given) { if (move === this.lastMove && !move.again) { move.again = true; this.fire('mousemove', move.data); } return features([...found]); }
            if (!awaited && this.summary(found) !== given) this.incomplete('queryRenderedFeatures', now.length, found.length);
            // The array that the caller got at once was not the complete result. Code that reads the array asks again
            // on `idle` (and the map is idle, or will be): tell it, and the same question then has the answer at once.
            if (this.summary(found) !== given && !this.again && !this.refired.has(key)) {
                this.refired.add(key); // (one time for a question: a listener with many questions must not make `idle` fire for ever)
                this.again = true;
                setTimeout(() => { this.again = false; if (this.areTilesLoaded() && !this.isMoving()) this.fire('idle'); });
            }
            return features([...found]);
        }) : Promise.resolve([]);
        let awaited = false;
        later.catch(() => {}); // (As in `querySourceFeatures`: a result that nobody awaits rejects nothing on the page.)
        Object.defineProperty(result, 'then', {value: (done?: (v: RenderedFeature[]) => unknown, failed?: (e: unknown) => unknown) => { awaited = true; return later.then(done, failed); }});
        return result as unknown[] as MapGeoJSONFeature[] & PromiseLike<MapGeoJSONFeature[]>;
    }
    /**
     * The last answers of the engine to `queryRenderedFeatures`, by question (the view, the place on the screen, the
     * layers). MapLibre code reads the result of a query at once, but the tile data is in a worker. So the array has
     * the answer to the same question before. Two things make that answer present when the code asks:
     * the map asks the engine where the pointer rests and when `click`, `dblclick` or `contextmenu` fires; and after a first answer that the
     * caller did not get, the map fires `idle` again.
     */
    private answers = new globalThis.Map<string, {found: QueriedFeature[]}>();
    private again = false;
    private refired = new Set<string>();
    private questionKey(box: number[], sets?: {layer: string; also?: unknown}[]) {
        const t = this.tr;
        return JSON.stringify([t.lng, t.lat, t.zoom, t.bearing, t.pitch, t.width, t.height, box, sets ? sets.map(s => [s.layer, s.also]) : 0]);
    }
    /** (`turn` counts the changes of data by the page. An answer to a question from before such a change is not kept.) */
    private turn = 0;
    private forget() { this.answers.clear(); this.turn++; }
    /**
     * The last answer of the engine to `querySourceFeatures`, by source and options. A change of the style keeps it (the
     * tile data stays the same); new data of the source (`setData`, `refreshTiles`, a new source) drops it.
     */
    private sourceAnswers = new globalThis.Map<string, {sourceId: string; found: QueriedFeature[]}>();
    /** (A count of the changes of data of each source: an answer to a question from before such a change is not kept.) */
    private sourceTurn = new globalThis.Map<string, object>();
    private forgetSource(sourceId: string) {
        this.sourceTurn.set(sourceId, {});
        for (const [key, a] of this.sourceAnswers) if (a.sourceId === sourceId) this.sourceAnswers.delete(key);
    }
    override refreshTiles(sourceId: string) { this.forget(); this.forgetSource(sourceId); return super.refreshTiles(sourceId); }
    private keep(key: string, found: QueriedFeature[], turn: number) {
        if (turn !== this.turn) return;
        this.answers.delete(key);
        this.answers.set(key, {found});
        if (this.answers.size > 64) this.answers.delete(this.answers.keys().next().value!);
    }
    private summary(found: QueriedFeature[]) { return JSON.stringify(found.map(f => [f.layer, f.id, f.properties])); }
    /**
     * (`click`, `dblclick` and `contextmenu` must have the features at their place when a listener reads
     * `queryRenderedFeatures(e.point)` at once. The map asks the engine at `mousedown` and `touchstart`, which come
     * before these events, and where a pointer rests. An event fires at once when the answer is there, and else waits
     * for it for at most 300 ms. Listeners for a layer get their features from the core map.)
     */
    private zoomErrors?: Set<string>;
    private noValidate = false;
    private dispatch(type: string, data: Record<string, unknown>): void | PromiseLike<unknown> {
        // The page gave new data (`setData`, a change of the style): the answers from before are old. They are not given.
        if (type === 'dataloading') { this.forget(); if (data.sourceId) this.forgetSource(data.sourceId as string); }
        // No engine could start (`cannotShow` of the core): MapLibre GL JS reports this with a GPUInitializationError (#205).
        const e = data.error as Error | undefined;
        if (type === 'error' && e?.message?.startsWith('[map-jr-gl] The map cannot be shown:') && !(e instanceof GPUInitializationError)) data = {...data, error: new GPUInitializationError(e.message, null, {cause: e.cause})};
        // (New data in the engine: an answer that was kept while the data loaded can be old. It is still given at once, and
        // it is asked again: if the new answer is another, `idle` fires one more time for that question.)
        if (type === 'sourcedata' || type === 'styledata') this.refired.clear();
        // (Development build) An expression whose ["zoom"] MapLibre GL JS rejects fires `error` with MapLibre's text, once for
        // each layer, property and value. The map still draws it (#1087). So does a property that the style specification
        // does not have for the type of the layer, once for each layer and property (#1139).
        if (__DEV__ && type === 'styledataloading') zoomCurveErrors(this.rawStyle, this.zoomErrors ??= new Set(), error => this.fire('error', {error}), this.noValidate);
        // The `eventData` of the camera call that made this move (see `jumpTo`). The move's own fields win.
        // User input starts a move of the user's: kept eventData (of a call that did not move the camera) is not on it.
        if (/^(mousedown|touchstart|wheel|dragstart|dblclick)$/.test(type)) this.moveData = undefined;
        if (this.moveData && /^(move|zoom|rotate|pitch)(start|end)?$/.test(type)) {
            data = {...this.moveData, ...data};
            if (type === 'moveend') this.moveData = undefined;
        }
        // As in MapLibre, `point` and `points` of mouse and touch events are a `Point`.
        // (In place: the object has a getter, `defaultPrevented`, that a copy would lose.)
        if (data.point) data.point = Point.convert(data.point as Point);
        if (Array.isArray(data.points)) data.points = data.points.map(Point.convert);
        const point = data.point as Point | undefined;
        if (!point || !this.rawStyle || data.asked) return super.fire(type, data);
        const warm = () => {
            const {box, sets} = this.rendered([point.x, point.y]), key = this.questionKey(box), turn = this.turn;
            if (!sets.length || this.answers.has(key)) return;
            if (!this.asking.has(key)) this.asking.set(key, this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: true}))
                .then(found => this.keep(key, found, turn), () => {}).finally(() => this.asking.delete(key)));
            return this.asking.get(key);
        };
        if (type === 'mousemove') {
            clearTimeout(this.resting); this.resting = setTimeout(warm, 50);
            const move = this.lastMove?.data === data ? this.lastMove : this.lastMove = {data};
            this.inMove = move;
            try { return super.fire(type, data); } finally { this.inMove = undefined; }
        }
        if (type === 'mousedown' || type === 'touchstart') warm();
        if (!/^(click|dblclick|contextmenu)$/.test(type)) return super.fire(type, data);
        const pending = warm();
        // (The descriptors are copied, so that the getter `defaultPrevented` stays live.)
        const send = () => super.fire(type, Object.defineProperties({asked: true}, Object.getOwnPropertyDescriptors(data)));
        if (!pending) return send();
        return Promise.race([pending, new Promise(r => setTimeout(r, 300))]).then(send);
    }
    private asking = new globalThis.Map<string, Promise<void>>();
    private resting?: ReturnType<typeof setTimeout>;
    /** The last `mousemove`, and the one whose listeners run now (see `queryRenderedFeatures`). */
    private lastMove?: {data: Record<string, unknown>; again?: boolean};
    private inMove?: {data: Record<string, unknown>; again?: boolean};
    // The map of MapLibre GL JS has a `painter`, and some code reads it to check for WebGL (#205). This map has none.
    // In the development build only, reading it warns once per map; the value stays `undefined`.
    static {
        if (__DEV__) Object.defineProperty(this.prototype, 'painter', {configurable: true, get(this: Map) {
            if (this.warned && !this.warned.has('painter')) this.warned.add('painter'), console.warn('[map-jr-gl] map.painter does not exist in @map-jr/map-jr-gl/maplibre-compat. To check for WebGL, use supported(); a failed start fires "error" with a GPUInitializationError.');
            return undefined;
        }});
    }
}

/** Meters in one mercator unit at a latitude, with the earth of MapLibre GL JS. */
const mercMetres = (lat: number) => 2 * Math.PI * 6371008.8 * Math.cos(lat * Math.PI / 180);
/** What `setTransformCameraUpdate` gives its function, as in MapLibre GL JS (a part of the transform). */
type CameraLike = {center: {lng: number; lat: number}; zoom: number; bearing: number; pitch: number; padding: unknown; elevation: number};
/** What the function of `setTransformCameraUpdate` returns: the parts of the camera to change. */
type CameraChanges = {center?: unknown; zoom?: number; bearing?: number; pitch?: number; elevation?: number};
