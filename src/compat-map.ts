// The map of the entry `@map-jr/map-jr-gl/maplibre-compat`: the core map (map.ts) with the rest of the API of MapLibre GL JS.
// These methods are here, and not in the core, because the main entry does not need them: other names for a camera
// change, values that are fixed in this library, methods that only frameworks for MapLibre GL JS read, and query
// results that are arrays and promises at the same time.
import {Map as CoreMap, type CameraInput, type PointLike, type RenderedFeature, type RenderedQueryOptions, type PaddingInput, type ImageOptions, type FlyOptions} from './map.ts';
import type {QueriedFeature} from './query.ts';
import {GPUInitializationError} from './gpu-error.ts';
import {defaults as loadDefaults} from './loader.ts';
import type {LngLatLike} from './geo.ts';
import type {AddLayerObject, CustomLayerInterface, GeoJSONFeature, MapGeoJSONFeature, MapEventType, MapLayerEventType, Source, MapOptions, EaseToOptions, StyleSwapOptions, FitBoundsOptions, QuerySourceFeatureOptions, FeatureIdentifier, StyleSpecification} from './compat-types.ts';

/**
 * The types of `on`, `once`, `off` and `getSource` as in MapLibre GL JS: the event of a listener follows from the name
 * of the event, and a name that is not in the list gets an event of the type `any`. (Types only: the methods are those
 * of the core map.)
 */
export interface Map {
    on<T extends keyof MapLayerEventType>(type: T, layerId: string | string[], listener: (e: MapLayerEventType[T]) => void): this;
    on<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void): this;
    on(type: string, listener: (e: any) => void): this;
    on(type: string, layerId: string | string[], listener: (e: any) => void): this;
    once<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void): this;
    once(type: string, listener: (e: any) => void): this;
    once<T extends keyof MapLayerEventType>(type: T, layerId: string | string[], listener: (e: MapLayerEventType[T]) => void): this;
    once<T extends keyof MapEventType>(type: T, layerId?: string | string[]): Promise<MapEventType[T]>;
    once(type: string, layerId?: string | string[]): Promise<any>;
    off<T extends keyof MapLayerEventType>(type: T, layerId: string | string[], listener: (e: MapLayerEventType[T]) => void): this;
    off<T extends keyof MapEventType>(type: T, listener: (e: MapEventType[T]) => void): this;
    off(type: string, listener: (e: any) => void): this;
    off(type: string, layerId: string | string[], listener: (e: any) => void): this;
    getSource<T extends Source = Source>(id: string): T | undefined;
    easeTo(o: EaseToOptions, eventData?: EventData): this;
    setStyle(style: unknown, options?: StyleSwapOptions): Promise<void>;
    /** The style, as in MapLibre GL JS. It is `undefined` before the map has a style. */
    getStyle(): StyleSpecification;
}
/**
 * `map.cooperativeGestures`, as in MapLibre GL JS, with `enable()`, `disable()`, `isEnabled()` and `isActive()` (always
 * false). Its code loads on demand at the first `enable()` (cooperative-gestures.ts), so that a map without it pays little.
 */
const cooperativeGestures = (map: CoreMap) => {
    let on = false, stop: (() => void) | undefined, touchAction = '';
    const style = map.getCanvas().style;
    const disable = () => { if (on) { on = false; stop?.(); stop = map.gate = undefined; style.touchAction = touchAction; } };
    map.on('remove', disable);
    return {enable() {
        if (on) return;
        on = true;
        // Until the file has loaded, the gestures are blocked without the hint: a wheel zooms only with Ctrl (⌘ on a
        // Mac), and one finger scrolls the page.
        touchAction = style.touchAction;
        style.touchAction = 'pan-x pan-y';
        map.gate = (type, e) => type === 'touch_pan' || !(e as WheelEvent)[navigator.userAgent.includes('Mac') ? 'metaKey' : 'ctrlKey'];
        // (After the import, the handler may be off again or the map removed: `disable()` has then set `on` to false.)
        import('./cooperative-gestures.ts').then(m => { if (on && !stop) stop = m.cooperate(map); });
    }, disable, isEnabled: () => on, isActive: () => false};
};
declare const __VERSION__: string; // the version of package.json, set by the build
declare const __DEV__: boolean;
/** The fields that a camera method copies onto the events of its move, as `eventData` in MapLibre GL JS. */
type EventData = Record<string, unknown>;
/**
 * A point in pixels, as `Point` of `@mapbox/point-geometry`, which MapLibre GL JS exports. It has the methods that
 * applications use most; see docs/maplibre-compatibility.md for the list.
 */
export class Point {
    constructor(public x: number, public y: number) {}
    static convert(p: Point | [number, number] | {x: number; y: number}) { return p instanceof Point ? p : Array.isArray(p) ? new Point(p[0], p[1]) : new Point(p.x, p.y); }
    clone() { return new Point(this.x, this.y); }
    add(p: {x: number; y: number}) { return new Point(this.x + p.x, this.y + p.y); }
    sub(p: {x: number; y: number}) { return new Point(this.x - p.x, this.y - p.y); }
    mult(k: number) { return new Point(this.x * k, this.y * k); }
    div(k: number) { return new Point(this.x / k, this.y / k); }
    round() { return new Point(Math.round(this.x), Math.round(this.y)); }
    mag() { return Math.hypot(this.x, this.y); }
    dist(p: {x: number; y: number}) { return Math.hypot(this.x - p.x, this.y - p.y); }
    equals(p: {x: number; y: number}) { return this.x === p.x && this.y === p.y; }
}
export class Map extends CoreMap {
    /** As in MapLibre GL JS: with it on, the wheel zooms only with Ctrl (⌘ on a Mac), and one finger scrolls the page. */
    readonly cooperativeGestures = cooperativeGestures(this);
    /**
     * @internal A rotate drag (the right mouse button, or Ctrl with the left one) turns the map as the default of
     * MapLibre GL JS does (`generateMouseRotationHandler` in its `src/ui/handler/mouse.ts`; the code here is new). More
     * than 100 pixels above or below the centre of the map, the map turns by the angle that the sideways movement of the
     * pointer makes around that centre. Nearer to the centre, the map turns by 0.8 degrees for each pixel: with the
     * pointer below the centre a drag to the right increases the bearing, and above the centre it decreases the bearing.
     */
    override dragTurn = (a: {x: number; y: number}, b: {x: number; y: number}) => {
        const c = super.project(this.getCenter()), y = b.y - c.y, x0 = a.x - c.x, x1 = b.x - c.x;
        return Math.abs(c.y - a.y) > 100 ? Math.atan2(y * (x1 - x0), x1 * x0 + y * y) * 180 / Math.PI : (x1 - x0) * (y < 0 ? -.8 : .8);
    };
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
        return this.on(type, layer, wrap);
    }
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
    /** The map was made with `renderer: 'main'`, which custom layers need. */
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
        console.warn(`[map-jr-gl] ${name}: the result was used without \`await\` and was not complete (${had} of ${has} features). Tile data is in a worker. Change\n    const features = map.${name}(...);\nto\n    const features = await map.${name}(...);\n(this also works in MapLibre GL JS). See "Feature queries" in docs/maplibre-compatibility.md.`);
    }
    setSky(sky?: object | null) { return this.unsupported('setSky', !sky || !Object.keys(sky).length); }
    setRenderWorldCopies(copies?: boolean | null) { return this.unsupported('setRenderWorldCopies(false)', copies !== false); }
    setRoll(roll?: number) { return this.unsupported('setRoll', !roll); }
    setVerticalFieldOfView(fov?: number) { return this.unsupported('setVerticalFieldOfView', fov === undefined || Math.abs(fov - 36.87) < 0.01); }
    getVerticalFieldOfView() { return 36.87; }
    setZoomSnap(snap?: number) { return this.unsupported('setZoomSnap', !snap); }
    getZoomSnap() { return 0; }
    setCenterClampedToGround(clamped?: boolean) { return this.unsupported('setCenterClampedToGround(false)', clamped !== false); }
    getCenterClampedToGround() { return true; }
    setCenterElevation(elevation?: number) { return this.unsupported('setCenterElevation', !elevation); }
    setAnisotropicFilterPitch(_pitch?: number | null) { return this; }
    getAnisotropicFilterPitch() { return 20; }
    setSourceTileLodParams(..._args: unknown[]) { return this; }
    /**
     * MapLibre GL JS calls this function before each frame and draws the camera that it returns. This library does not:
     * it calls the function after each `move` and warns once when the function changes the camera, because only then
     * does the map draw something else than the function asks for. react-map-gl gives a function for each map; it
     * changes the camera only when the `onMove` of a controlled map does not set `viewState` to the camera of the event.
     */
    setTransformCameraUpdate(fn?: ((tr: CameraLike) => CameraChanges | undefined) | null) {
        this.cameraUpdate = typeof fn == 'function' ? fn : undefined;
        if (this.cameraUpdate && !this.recent) {
            this.recent = [];
            this.on('move', () => this.checkCameraUpdate());
        }
        return this;
    }
    declare private cameraUpdate?: (tr: CameraLike) => CameraChanges | undefined;
    /** The last cameras of the map: a controlled map's state can be a few `move` events behind, and that is no change. */
    declare private recent?: {lng: number; lat: number; zoom: number; bearing: number; pitch: number}[];
    private checkCameraUpdate() {
        const fn = this.cameraUpdate, recent = this.recent!;
        if (!fn) return;
        const center = this.getCenter(), now = {lng: center.lng, lat: center.lat, zoom: this.getZoom(), bearing: this.getBearing(), pitch: this.getPitch()};
        recent.unshift(now); recent.length = Math.min(recent.length, 8);
        let r: CameraChanges | undefined;
        try { r = fn({center, zoom: now.zoom, bearing: now.bearing, pitch: now.pitch, padding: this.getPadding(), elevation: 0}); } catch { return; }
        if (!r || typeof r != 'object' || this.warned.has('setTransformCameraUpdate')) return;
        const c = r.center as {lng?: number; lat?: number} | number[] | undefined, lng = Array.isArray(c) ? c[0] : c?.lng, lat = Array.isArray(c) ? c[1] : c?.lat;
        const same = (a: number | undefined, b: number) => typeof a != 'number' || Math.abs(a - b) < 1e-9;
        if (recent.some(k => same(lng, k.lng) && same(lat, k.lat) && same(r.zoom, k.zoom) && same(r.bearing, k.bearing) && same(r.pitch, k.pitch))) return;
        this.warned.add('setTransformCameraUpdate');
        console.warn('[map-jr-gl] setTransformCameraUpdate: the function changed the camera of a movement. This library draws that camera only when the movement ends (react-map-gl: onMove did not set viewState to e.viewState). To keep the map in a region, use the option maxBounds.');
    }
    setTransformConstrain(fn?: unknown) { return this.unsupported('setTransformConstrain', !fn); }
    setEventedParent(..._args: unknown[]) { return this; }

    /**
     * The options of MapLibre GL JS that this library does not have give one warning each, so that a change from that
     * library does not look complete when it is not.
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
        super(context?.antialias === undefined ? options : {...options, antialias: context.antialias});
        this.strict = !!o.strict;
        this.mainThread = (o.renderer ?? loadDefaults.renderer) === 'main';
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
        if (o.maxBounds) this.setMaxBounds(o.maxBounds);
        if (o.cooperativeGestures) this.cooperativeGestures.enable();
        if ((o as {glyphs?: unknown}).glyphs !== undefined) console.warn('[map-jr-gl] Map: the option glyphs was removed and has no effect; the map loads the glyph files of the style. Remove the option. To draw text with the fonts of the browser, remove "glyphs" from the style.');
        if (o.locale != null && typeof o.locale != 'object') console.warn('[map-jr-gl] Map: the option locale is not an object. Pass an object such as {"NavigationControl.ZoomIn": "Zoom avant"}.');
        else this.uiLocale = o.locale;
        // (MapLibre GL JS 6.17 has no option projection and draws Mercator for it: pages that pass it expect that.)
        if (o.projection && ((o.projection as {type?: unknown}).type ?? o.projection) !== 'mercator' && !this.warned.has('projection')) {
            this.warned.add('projection');
            const message = '[map-jr-gl] new Map(): the option projection has no effect, as in MapLibre GL JS 6.17. Put "projection": {"type": "globe"} into the style, or call map.setProjection({type: "globe"}) after the style has loaded.';
            if (this.strict) throw new Error(message);
            console.warn(message);
        }
        this.unsupported('The option renderWorldCopies: false', o.renderWorldCopies !== false);
        this.unsupported('The option canvasContextAttributes (but for antialias)', !context || !Object.keys(context).some(k => k !== 'antialias' && k !== 'preserveDrawingBuffer'));
        if (context?.preserveDrawingBuffer) {
            const message = '[map-jr-gl] new Map(): canvasContextAttributes.preserveDrawingBuffer has no effect. Read the canvas with map.toBlob(), and remove the option.';
            if (this.strict) throw new Error(message);
            console.warn(message);
        }
        this.unsupported('The option logoPosition', !o.logoPosition);
        this.unsupported('The option validate', o.validate === undefined);
        // (Labels here always fade for a fixed time, and a drag with the right button always turns and tilts the map.)
        this.unsupported('The option fadeDuration', o.fadeDuration === undefined || o.fadeDuration === 300);
        this.unsupported('The option pitchWithRotate: false', o.pitchWithRotate !== false);
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
    addControl(control: Parameters<CoreMap['addControl']>[0], position?: Parameters<CoreMap['addControl']>[1]) {
        // (The core adds the attribution in its constructor, before the fields of this class exist: hence `??=`.)
        return (control as {onAdd?: unknown} | undefined)?.onAdd ? ((this.added ??= []).push(control), super.addControl(control, position)) : this.refused('addControl(): the argument is not a control. Pass an object with onAdd and onRemove methods.');
    }
    addLayer(layer: AddLayerObject, beforeId?: string) {
        let one: {id: string; source?: unknown} = layer;
        if (layer.type === 'custom') {
            // A custom layer draws with the WebGL context of the map, which only the engine on this thread shares. Its
            // code loads with the first one (custom-layers.ts). The style gets a layer with the id and the type, so that
            // the order and the visibility work as for other layers; the object of the user is its `implementation`.
            if (!this.mainThread) return this.refused(`addLayer: the custom layer "${layer.id}" needs the map to draw on the main thread. Pass renderer: 'main' to new Map().`);
            if (typeof (layer as CustomLayerInterface).render != 'function') return this.refused(`addLayer: the custom layer "${layer.id}" has no method render. Add render(gl, args).`);
            this.custom ??= import('./custom-layers.ts').then(m => { this.customLayers = m.customLayers(this, draw => this.ask(id => ({type: 'custom', id, draw}))); }, error => this.fire('error', {error}));
            one = Object.defineProperty({id: layer.id, type: 'custom'}, 'implementation', {value: layer});
        }
        const {id, source} = one;
        if (this.rawStyle && this.getLayer(id)) return this.refused(`addLayer: the style has a layer with the id "${id}" already. Remove that layer first, or use another id.`);
        if (this.rawStyle && typeof source === 'string' && !this.rawStyle.sources[source]) return this.refused(`addLayer: the layer "${id}" names the source "${source}", which the style does not have. Add the source first.`);
        if (one !== layer) (this.customs ??= new globalThis.Map()).set(id, layer as CustomLayerInterface);
        // As in MapLibre GL JS, a source object in the layer becomes a source with the id of the layer.
        if (source && typeof source === 'object') {
            if (this.rawStyle?.sources[id]) return this.refused(`addLayer: the layer "${id}" has a source object, and the style has a source with the id "${id}" already. Remove that source first, or pass source: "${id}".`);
            super.addSource(id, source);
            one = {...one, source: id};
        }
        return super.addLayer(one, beforeId);
    }
    removeLayer(id: string) { this.customs?.delete(id); return super.removeLayer(id); }
    /**
     * As in MapLibre GL JS 6.17: with `diff` (the default), the custom layers stay in the new style, each before the layer
     * that came after it, and get no `onRemove`. With `diff: false` they leave the map, also without `onRemove`.
     */
    setStyle(style: unknown, options: StyleSwapOptions = {}) {
        const own = options.transformStyle;
        return super.setStyle(style, !this.customs?.size ? options : {transformStyle: (previous: any, next: any) => {
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
    addSource(id: string, source: object) {
        return this.rawStyle?.sources[id] ? this.refused(`addSource: the style has a source with the id "${id}" already. Remove that source first, or use another id.`) : super.addSource(id, source);
    }
    removeSource(id: string) {
        const user = this.rawStyle?.layers.find((l: any) => l.source === id);
        return user ? this.refused(`removeSource: the layer "${user.id}" uses the source "${id}". Remove the layer first.`) : super.removeSource(id);
    }

    /**
     * As in MapLibre GL JS, `eventData` goes onto the events of this move (`movestart` to `moveend`, and the zoom,
     * rotate and pitch events). A later camera call or user input replaces it; a nested call (fitBounds calls easeTo) keeps it.
     */
    jumpTo(o: CameraInput, eventData?: EventData) { return this.camera(eventData, () => super.jumpTo(o)); }
    easeTo(o: EaseToOptions, eventData?: EventData) {
        return this.camera(eventData, () => super.easeTo(o));
    }
    fitBounds(bounds: Parameters<CoreMap['fitBounds']>[0], o?: FitBoundsOptions, eventData?: EventData) {
        this.unsupported('The options speed, curve and linear of fitBounds', o?.speed === undefined && o?.curve === undefined && o?.linear === undefined);
        return this.camera(eventData, () => super.fitBounds(bounds, o));
    }
    private camera(eventData: EventData | undefined, f: () => this) {
        if (!this.nested) this.moveData = eventData;
        this.nested++;
        try { return f(); } finally { this.nested--; }
    }
    private moveData?: EventData;
    private nested = 0;
    flyTo(o: EaseToOptions & FlyOptions, eventData?: EventData) {
        return this.camera(eventData, () => super.flyTo(o));
    }
    /** Space at the edges covered by other things (a side panel, a header). The map centre moves to the middle of what is left. */
    setPadding(padding: PaddingInput, eventData?: EventData) { return this.jumpTo({padding}, eventData); }
    getPadding() { const [top, right, bottom, left] = this.tr.padding; return {top, right, bottom, left}; }
    setCenter(center: LngLatLike, eventData?: EventData) { return this.jumpTo({center}, eventData); }
    setZoom(zoom: number, eventData?: EventData) { return this.jumpTo({zoom}, eventData); }
    setBearing(bearing: number, eventData?: EventData) { return this.jumpTo({bearing}, eventData); }
    setPitch(pitch: number, eventData?: EventData) { return this.jumpTo({pitch}, eventData); }
    resetNorth(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({bearing: 0, ...o}, eventData); }
    resetNorthPitch(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({bearing: 0, pitch: 0, ...o}, eventData); }
    panTo(center: LngLatLike, o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({center, ...o}, eventData); }
    panBy(offset: [number, number], o: {duration?: number} = {}, eventData?: EventData) {
        return this.easeTo({center: this.unproject([this.tr.cx + offset[0], this.tr.cy + offset[1]]), ...o}, eventData);
    }
    zoomTo(zoom: number, o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({zoom, ...o}, eventData); }
    zoomIn(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({zoom: this.tr.zoom + 1, duration: 300, ...o}, eventData); }
    zoomOut(o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({zoom: this.tr.zoom - 1, duration: 300, ...o}, eventData); }
    rotateTo(bearing: number, o: {duration?: number} = {}, eventData?: EventData) { return this.easeTo({bearing, ...o}, eventData); }
    snapToNorth(o: {duration?: number} = {}, eventData?: EventData) { return Math.abs(this.tr.bearing) < 7 ? this.resetNorth(o, eventData) : this; }
    getRenderWorldCopies() { return true; }
    getRoll() { return 0; }
    /** With 3D terrain: the (exaggerated) height of the ground at the map centre in metres; otherwise 0. */
    getCenterElevation() { return this.tr.elevation; }
    getCameraTargetElevation() { return this.tr.elevation; }
    isZooming() { return this.zooming; }
    isRotating() { return this.rotating; }
    isPitching() { return this.pitching; }
    getCanvasContainer() { return this.container; }
    remove() { super.remove(); this.getContainer().classList.remove('maplibregl-map'); }
    redraw() { this.triggerRepaint(); return this; }
    // react-map-gl and other wrappers read these private members of the MapLibre map. They are here only so that
    // those wrappers work: `style._loaded` tells them that sources and layers can be added.
    get style() { return this.resolved ? {_loaded: this.ready} : undefined; }
    _render() { this.triggerRepaint(); }
    _update() { this.triggerRepaint(); }
    /** There is no sky in this library. (react-map-gl reads the value when a style has loaded.) */
    getSky() { return undefined; }
    getLight() { return {anchor: 'viewport', position: [1.15, 210, 30], color: '#ffffff', intensity: 0.5, ...this.rawStyle?.light}; }
    /** The style, as in MapLibre GL JS: without its custom layers. */
    getStyle() { const style = super.getStyle(); if (style) style.layers = style.layers.filter((l: {type: string}) => l.type !== 'custom'); return style; }
    getLayersOrder(): string[] { return this.rawStyle?.layers.map((l: any) => l.id) ?? []; }
    getPaintProperty(layerId: string, name: string) { return this.getLayer(layerId)?.paint?.[name]; }
    getLayoutProperty(layerId: string, name: string) { return this.getLayer(layerId)?.layout?.[name]; }
    getFilter(layerId: string) { return this.getLayer(layerId)?.filter; }
    moveLayer(id: string, beforeId?: string) {
        return this.editStyle(s => {
            const [layer] = s.layers.splice(this.layerIndex(s, id), 1);
            s.layers.splice(beforeId ? this.layerIndex(s, beforeId) : s.layers.length, 0, layer);
        });
    }
    setLayerZoomRange(id: string, minzoom: number, maxzoom: number) { return this.editStyle(s => Object.assign(s.layers[this.layerIndex(s, id)], {minzoom, maxzoom})); }
    getSprite() { const s = this.rawStyle?.sprite; return typeof s === 'string' ? [{id: 'default', url: s}] : s ?? []; }
    setSprite(url: string | {id: string; url: string}[] | null) { return this.editStyle(s => { if (url) s.sprite = url; else delete s.sprite; }); }
    /** Adds a sprite sheet. Its icons have the names `id:name`. */
    addSprite(id: string, url: string) { return this.setSprite([...this.getSprite().filter((s: {id: string}) => s.id !== id), {id, url}]); }
    removeSprite(id: string) { const rest = this.getSprite().filter((s: {id: string}) => s.id !== id); return this.setSprite(rest.length ? rest : null); }
    getGlyphs() { return this.rawStyle?.glyphs ?? null; }
    /** Sets the URL of the glyph files of the style. The map loads them from this URL. */
    setGlyphs(url: string | null) { return this.editStyle(s => { if (url) s.glyphs = url; else delete s.glyphs; }); }
    /**
     * As in MapLibre GL JS, a vector, raster or raster-dem source has `setTiles(tiles)` and `setUrl(url)` (a TileJSON
     * URL), which replace its tiles and load them again. The TileJSON goes through the same request as in the style.
     */
    getSource(id: string): any {
        const spec = super.getSource(id);
        if (!/^(vector|raster)/.test(spec?.type)) return spec;
        const set = (k: string, v: unknown, ok: boolean) => {
            if (!ok) throw new Error(`[map-jr-gl] getSource("${id}").${k === 'url' ? 'setUrl(url): "url" must be a string' : 'setTiles(tiles): "tiles" must be an array of URL strings'}.`);
            this.editStyle(s => { const src = s.sources[id]; if (src) delete src.url, delete src.tiles, src[k] = Array.isArray(v) ? [...v] : v; });
            return source;
        };
        const source = {...spec, id, setTiles: (t: string[]) => set('tiles', t, Array.isArray(t) && t.every(x => typeof x === 'string')), setUrl: (u: string) => set('url', u, typeof u === 'string')};
        return source;
    }
    getFontFaces() { return this.rawStyle?.['font-faces'] ?? {}; }
    setFontFaces(faces: Record<string, unknown> | null) { return this.editStyle(s => { if (faces) s['font-faces'] = faces; else delete s['font-faces']; }); }
    /** As in MapLibre GL JS, the feature can come without an `id` (a feature of a query); then nothing changes and the map warns once. */
    setFeatureState(feature: FeatureIdentifier, state: Record<string, unknown>) { return this.hasId(feature, 'setFeatureState') ? super.setFeatureState(feature, state) : this; }
    getFeatureState(feature: FeatureIdentifier) { return this.hasId(feature, 'getFeatureState') ? super.getFeatureState(feature) : {}; }
    private hasId(f: FeatureIdentifier, name: string): f is FeatureIdentifier & {id: string | number} {
        if (f.id != null) return true;
        if (!this.warned.has(name)) this.warned.add(name), console.warn(`[map-jr-gl] ${name}(): the feature has no "id". Give the source features an id, or set "promoteId" on the source.`);
        return false;
    }
    /**
     * The image that addImage was given, with its options, or undefined. Raw pixels and drawable sources (canvas, image,
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
    listImages() { return [...this.imageNames]; }
    /** Fetches and decodes an image, in the shape MapLibre returns it. */
    async loadImage(url: string) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load image ${url}: ${res.status}`);
        return {data: await createImageBitmap(await res.blob())};
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
        Promise.all([this.fetchAs('Source')(new URL(spec.data, this.styleBase)).then(r => r.json()), import('./sync-query.ts')]).then(([data, m]) => {
            entry.data = data; this.syncQuery = m;
            for (const type of ['sourcedata', 'data']) this.fire(type, {dataType: 'source', sourceId: id, isSourceLoaded: true, sourceDataType: 'content'});
        }, () => {});
    }
    private geoKept = new globalThis.Map<string, {from: string; data?: object}>();
    /**
     * The features of a source in the tiles of the present view, as in MapLibre: all the features of those tiles, also
     * those that no layer draws and those outside the view. As with `queryRenderedFeatures`, the result is an array
     * that can also be awaited: at once it has the features of a GeoJSON source whose data the page has (clusters too);
     * awaited, it has the features of each kind of source.
     */
    querySourceFeatures(sourceId: string, options: QuerySourceFeatureOptions = {}): GeoJSONFeature[] & PromiseLike<GeoJSONFeature[]> {
        const sets = [{layer: '', source: sourceId, sourceLayer: options.sourceLayer, filter: options.filter, radius: Infinity}], box: [number, number, number, number] = [0, 0, this.tr.width, this.tr.height];
        // (A radius without end takes each feature of the tiles under the view, whatever the layers draw.)
        const features = (found: QueriedFeature[]): Omit<RenderedFeature, 'layer'>[] => found.map(f => ({type: 'Feature', id: f.id, geometry: f.geometry!, properties: f.properties, source: f.source, sourceLayer: f.sourceLayer || undefined,
            state: f.id === undefined ? {} : this.getFeatureState({source: f.source, sourceLayer: f.sourceLayer || undefined, id: f.id})}));
        const spec = this.rawStyle?.sources[sourceId], data = spec?.type === 'geojson' && this.geoData(sourceId);
        let now: QueriedFeature[] = [];
        if (data && this.syncQuery) try { now = this.syncQuery.queryGeoJSON(sourceId, {...spec, data}, this.tr, box, sets); } catch { /* the promise has the complete result or the error */ }
        let awaited = false;
        const result = features(now), had = now.length, all = this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: true})).then(found => {
            if (!awaited && found.length > had) this.incomplete('querySourceFeatures', had, found.length);
            return features(found);
        });
        Object.defineProperty(result, 'then', {value: (done?: (v: Omit<RenderedFeature, 'layer'>[]) => unknown, failed?: (e: unknown) => unknown) => { awaited = true; return all.then(done, failed); }});
        return result as unknown[] as GeoJSONFeature[] & PromiseLike<GeoJSONFeature[]>;
    }

    protected override styleChanged() {
        if (this.customs) for (const l of this.rawStyle.layers ?? []) if (l.type === 'custom' && !l.implementation && this.customs.has(l.id)) Object.defineProperty(l, 'implementation', {value: this.customs.get(l.id)});
        if (!this.syncQuery && Object.values<any>(this.rawStyle.sources ?? {}).some(src => src.type === 'geojson' && src.data && typeof src.data === 'object')) import('./sync-query.ts').then(m => { this.syncQuery = m; });
    }

    /**
     * The features that the style layers draw at a point or in a rectangle of the screen (the whole map when no
     * geometry is given), from the top layer down. The arguments and the features are those of MapLibre GL JS.
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
    override refreshTiles(sourceId: string) { this.forget(); return super.refreshTiles(sourceId); }
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
    override fire(type: string, data: Record<string, unknown> = {}): void | PromiseLike<unknown> {
        // The page gave new data (`setData`, a change of the style): the answers from before are old. They are not given.
        if (type === 'dataloading') this.forget();
        // No engine could start (`cannotShow` of the core): MapLibre GL JS reports this with a GPUInitializationError (#205).
        const e = data.error as Error | undefined;
        if (type === 'error' && e?.message?.startsWith('[map-jr-gl] The map cannot be shown:') && !(e instanceof GPUInitializationError)) data = {...data, error: new GPUInitializationError(e.message, null, {cause: e.cause})};
        // (New data in the engine: an answer that was kept while the data loaded can be old. It is still given at once, and
        // it is asked again: if the new answer is another, `idle` fires one more time for that question.)
        if (type === 'sourcedata' || type === 'styledata') this.refired.clear();
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

/** What `setTransformCameraUpdate` gives its function, as in MapLibre GL JS (a part of the transform). */
type CameraLike = {center: {lng: number; lat: number}; zoom: number; bearing: number; pitch: number; padding: unknown; elevation: number};
/** What the function of `setTransformCameraUpdate` returns: the parts of the camera to change. */
type CameraChanges = {center?: unknown; zoom?: number; bearing?: number; pitch?: number; elevation?: number};
