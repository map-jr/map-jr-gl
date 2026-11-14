/**
 * The main API of the library: a map is made from one description (`MapSpec`), and is changed by giving a new
 * description. The library finds what is different. The state of the map (the view, loaded, idle, the features under
 * the pointer) is in a store that code can watch.
 *
 * The adapters for the frameworks (`@map-jr/map-jr-gl/vue` and others) are thin layers over `createMap`.
 * (For the API of MapLibre GL JS, see `@map-jr/map-jr-gl/maplibre-compat`.)
 */
import {Map, logError, type FeatureOptions, type FeaturePlace, type ImageOptions, type MapOptions, type FlyOptions, type RenderedFeature} from './map.ts';
export type {PaddingInput};
export type {FeatureOptions, FeaturePlace};
import {createStore, type Readable} from './store.ts';
import {Marker, Popup, type OverlayAnchor} from './overlays.ts';
import {extended, markerFeatures, markerStyle, withMarkers, type MarkerLayerOptions} from './markers.ts';
import type {QueriedFeature} from './query.ts';
import type {Control, ControlPosition} from './controls.ts';
import type {Checked} from './mistakes.ts';
import type {FontSource} from './engine.ts';
import type {LngLatBounds, LngLatBoundsInput} from './lnglat.ts';
import type {PaddingInput} from './geo.ts';

/**
 * Set by the build (`define` in build.mjs). True in the development build (`dist/*.dev.js`, which the `development`
 * condition of package.json names) and in the standalone file; false in the production build.
 */
declare const __DEV__: boolean;

/** The description of a control: see `@map-jr/map-jr-gl/controls`. Controls with the same `key` are the same control. */
export interface ControlSpec { key: string; position?: ControlPosition; create(): Control }

/**
 * A position that the application gives: `[lng, lat]`. It is `readonly number[]` and not a pair, because TypeScript
 * gives an array that is declared apart from its use (`const NYC = [-74, 40.7]`) the type `number[]`. A position
 * that the map gives (`state.view.center`, the result of `unproject`) is `[number, number]`.
 */
export type Position = readonly number[];
/** A cluster or a point that the cluster methods of `MapHost` return, as GeoJSON in longitude and latitude. */
export interface ClusterFeature {type: 'Feature'; id?: string | number; properties: Record<string, unknown>; geometry: {type: 'Point'; coordinates: [number, number]}}
/**
 * Where the camera is. `bounds` is `[[west, south], [east, north]]`: the smallest box that contains the visible map,
 * as `getBounds()` gives it in MapLibre GL JS.
 */
export interface View { center: [number, number]; zoom: number; bearing: number; pitch: number; bounds: [[number, number], [number, number]] }
/** A view that the application gives: each field is optional. */
export interface ViewInput { center?: Position; zoom?: number; bearing?: number; pitch?: number }
/**
 * The view at the start. `bounds` ([west, south, east, north] or [[west, south], [east, north]]) is fitted into the
 * map, with `padding` in CSS pixels (default 0), and takes the place of `center` and `zoom`, as in MapLibre GL JS.
 */
export interface InitialView extends ViewInput { bounds?: LngLatBoundsInput; padding?: PaddingInput }
export interface MapPointer { point: {x: number; y: number}; lngLat: [number, number]; /** The features of `interactiveLayers` at the point, the top one first. */ features: RenderedFeature[] }

/** Additions to a style: see `extend` in `MapSpec`. */
export interface StyleExtension {
    /** Sources to add, by id. */
    sources?: Record<string, object>;
    /** Layers to add. A layer goes below the layer with the id `before`, or on top without it. */
    layers?: ({id: string; before?: string} & Record<string, unknown>)[];
    /** 3D terrain from an elevation source: `{source: 'dem', exaggeration: 1.5}`. */
    terrain?: {source: string; exaggeration?: number} | null;
}

/** What an image is made from: an SVG document, the URL of an image, or an object that a canvas can draw (an `ImageBitmap`, a canvas, `ImageData`). */
export type ImageSource = Parameters<Map['addImage']>[1];
/**
 * An image of the field `images` of `MapSpec`: an `ImageSource`, or an object with the source as `image` and the
 * options of the image (`width` and `height` in CSS pixels, `pixelRatio`, and the options for an icon that fits text).
 */
export type ImageInput = ImageSource | ({image: ImageSource} & ImageOptions);

/** The description of a map. Each field can change in `update`, but for those of `MapSetup`. */
export interface MapSpec extends MapSetup {
    /** A style object or the URL of a style (the MapLibre style specification). A new object or URL is a new style. */
    style: string | object;
    /**
     * Your own sources and layers on a style that you do not write yourself (a style from a URL): they are added to
     * the style when it has loaded. A new object with other content changes the map.
     */
    extend?: StyleExtension;
    /** The view at the start: a view, or `bounds` to fit with `padding`. The user then moves the map. */
    initialView?: InitialView;
    /**
     * A view that the application owns. Give it together with `onViewChange` and write each change back, or change it
     * to move the map. (The map does not wait for the application: a view that the map itself reported is not applied again.)
     */
    view?: ViewInput;
    onViewChange?: (view: View) => void;
    /**
     * GeoJSON data for sources of the style, by the id of the source: `{routes: featureCollection}`. The source is in
     * the style as `{type: 'geojson', data: {type: 'FeatureCollection', features: []}}`. Data here is compared by
     * identity and goes to the map alone: use it for data that changes, so that the style stays as it is.
     */
    data?: Record<string, unknown>;
    /**
     * Images for `icon-image` of style layers, by name: `{pin: '<svg ...>...</svg>'}`. A
     * value is an SVG document, the URL of an image, or `{image, width, height}`. An image of this field is used in
     * place of an image of the sprite that has the same name.
     */
    images?: Record<string, ImageInput>;
    /**
     * Marker layers, each with an `id`. A marker layer is shorthand for a GeoJSON source and a symbol layer with that
     * id, which draws the image `image` at each marker. A layer whose `data` is a new array gets the new data.
     */
    markers?: MarkerLayerOptions[];
    /** Controls from `@map-jr/map-jr-gl/controls`: `[navigation(), scale()]`. */
    controls?: ControlSpec[];
    /** Style layers whose features are found under the pointer: they are in `state.hover` and in `onClick`. */
    interactiveLayers?: string[];
    onClick?: (event: MapPointer) => void;
    /** Called for each error of the map. Without it, the map writes each error to the console. (`state.error` has the last error in each case.) */
    onError?: (error: Error) => void;
    minZoom?: number; maxZoom?: number; maxPitch?: number; maxBounds?: LngLatBoundsInput | null;
    /** The mouse cursor over the map. Without it, the cursor is a pointer over a feature of `interactiveLayers`. */
    cursor?: string;
    /**
     * Space in CSS pixels at the sides of the map that the view keeps free, for example under a side panel: one number
     * for all sides, or `{top, right, bottom, left}` (a side that is left out is 0). The centre of the view is the centre
     * of the rest of the map. The default is 0.
     */
    padding?: PaddingInput;
}
/** The fields that are read when the map is made only. */
export interface MapSetup {
    renderer?: 'auto' | 'worker' | 'main';
    fonts?: FontSource[];
    fontFamily?: string;
    /** `false`: do not load the glyph files of the style; text uses the fonts of the device. The default loads them, unless `fonts` is given. */
    glyphs?: boolean;
    interactive?: boolean;
    antialias?: boolean;
    /**
     * Which tiles the map requests before they are in view. `true` (the default): when the destination of a movement is
     * known (`easeTo`, `flyTo`, `fitBounds`, the inertia after a drag), the map requests up to 6 tiles of each source of
     * the view at that destination when the movement starts. A newer movement cancels the requests of an older one.
     * `'ahead'`: the same, and during a drag also the tiles one tile size (256 CSS pixels) ahead of the view, in the
     * direction of the drag. `false`: only the tiles of the view and its overview, for applications that must save data.
     * The default is `true`.
     */
    prefetch?: boolean | 'ahead';
    attribution?: false | {compact?: boolean; customAttribution?: string | string[]};
    hash?: boolean | string;
}

export interface MapState {
    /** The style and the first tiles have loaded. */
    loaded: boolean;
    /** Nothing moves and nothing loads. */
    idle: boolean;
    moving: boolean;
    view: View;
    /** The features of `interactiveLayers` under the pointer. */
    hover: RenderedFeature[];
    /** The thread that draws: known when the map has started. */
    renderer: 'worker' | 'main' | undefined;
    error: Error | undefined;
}

/** Where an element of the page is on the map. */
export interface OverlayOptions {
    lngLat: Position;
    /** The part of the element that is at the position: `'center'` (the default), `'bottom'`, `'top-left'` and others. */
    anchor?: OverlayAnchor;
    /** A distance in pixels from the position, to the right and down. */
    offset?: [number, number];
    /** Show the element in a box with a pointer to the position (a popup). With `onClose`, the box has a button to close it. */
    popup?: boolean;
    onClose?: () => void;
}
export interface MapOverlay { update(options: OverlayOptions): void; remove(): void }

/** What each event of `listen` has: its type, and the map object behind the host (see `map` in `MapHost`). */
export interface MapEventBase<T extends string = string> { type: T; target: Map }
/** An event of a drag of the map by the user (`dragstart`, `drag`, `dragend`). */
export interface MapDragEvent extends MapEventBase<'dragstart' | 'drag' | 'dragend'> {
    /** The event of the mouse or the touch that moved the map. */
    originalEvent: MouseEvent | TouchEvent;
}
/** An event of the pointer. A listener that calls `preventDefault()` stops what the map does for the event (a drag, a zoom). */
export interface MapPointerEvent<T extends string = string, E extends MouseEvent = MouseEvent> extends MapEventBase<T> {
    /** The place in CSS pixels from the top left corner of the map. */
    point: {x: number; y: number};
    lngLat: {lng: number; lat: number};
    originalEvent: E;
    preventDefault(): void;
    readonly defaultPrevented: boolean;
}
/** An event of a touch: `points` and `lngLats` have one entry for each finger on the map. */
export interface MapTouchEvent<T extends string = string> extends MapPointerEvent<T, PointerEvent> { points: {x: number; y: number}[]; lngLats: {lng: number; lat: number}[] }
/** An event of the data of the map: `dataType` says whether the style or one source (`sourceId`) is concerned. */
export interface MapDataEvent<T extends string = string> extends MapEventBase<T> { dataType: 'source' | 'style'; sourceId?: string; isSourceLoaded?: boolean; source?: unknown }

type Plain<K extends string> = {[T in K]: MapEventBase<T>};
type Pointed<K extends string> = {[T in K]: MapPointerEvent<T>};
/**
 * The events of `listen`, by type. The state of the map (`state`) and the callbacks of the description (`onClick`,
 * `onViewChange`, `onError`) cover the common needs. These events are those of the map object behind the host.
 */
export interface MapEvents extends
    Plain<'load' | 'idle' | 'render' | 'resize' | 'remove' | 'style.load' | 'webglcontextlost' | 'webglcontextrestored'>,
    Plain<'movestart' | 'move' | 'moveend' | 'zoomstart' | 'zoom' | 'zoomend' | 'rotatestart' | 'rotate' | 'rotateend' | 'pitchstart' | 'pitch' | 'pitchend'>,
    Record<'dragstart' | 'drag' | 'dragend', MapDragEvent>,
    Pointed<'dblclick' | 'contextmenu' | 'mousedown' | 'mousemove' | 'mouseup' | 'mouseover' | 'mouseout'>,
    Record<'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', MapTouchEvent>,
    Record<'styledata' | 'sourcedata' | 'data' | 'styledataloading' | 'sourcedataloading' | 'dataloading', MapDataEvent> {
    click: MapPointerEvent<'click'>;
    wheel: MapPointerEvent<'wheel', WheelEvent>;
    /** The box of a zoom with the Shift key and a drag. `boxzoomend` has the bounds of the box. */
    boxzoomstart: MapEventBase<'boxzoomstart'> & {originalEvent: PointerEvent};
    boxzoomcancel: MapEventBase<'boxzoomcancel'> & {originalEvent: Event};
    boxzoomend: MapEventBase<'boxzoomend'> & {originalEvent: Event; boxZoomBounds: LngLatBounds};
    /** About once a second while the map draws: frames per second, and the time of a frame on the CPU in milliseconds. */
    stats: MapEventBase<'stats'> & {fps: number; frameMs: number; labels: number};
    /** The style names an image (`id`) that the map does not have. */
    styleimagemissing: MapEventBase<'styleimagemissing'> & {id: string};
    /** The terrain of the style has changed. */
    terrain: MapEventBase<'terrain'> & {terrain: {source: string; exaggeration?: number} | null};
    /** The geolocate control of `@map-jr/map-jr-gl/controls` has a position. */
    geolocate: MapEventBase<'geolocate'> & {coords: GeolocationCoordinates};
    /** `error` is usually an `Error`. (`onError` and `state.error` always have an `Error`.) */
    error: MapEventBase<'error'> & {error: unknown};
}

export interface MapHost {
    /** Changes the map to a new description. Give the complete description each time: a description with no `style` throws. */
    update(spec: MapSpec): void;
    destroy(): void;
    readonly state: Readable<MapState>;
    /**
     * Finds features. There is one method for all cases:
     *
     * - Where: a point of the screen (`{x, y}`), a position (`[lng, lat]`), a rectangle of the screen (two points), or
     *   nothing for the whole map.
     * - What: with `sources`, the features of the tile data of those sources. They need no style layer, and at a
     *   position they need not be on the screen (the tile is fetched if necessary). Without `sources`, the features
     *   that the style layers draw (`layers` selects layers), the top one first.
     */
    queryFeatures(at: FeaturePlace | undefined, options: FeatureOptions & {sources: string[]}): Promise<QueriedFeature[]>;
    queryFeatures(at?: FeaturePlace, options?: FeatureOptions & {sources?: undefined}): Promise<RenderedFeature[]>;
    queryFeatures(at?: FeaturePlace, options?: FeatureOptions): Promise<RenderedFeature[] | QueriedFeature[]>;
    /**
     * The same question, kept up to date: `listener` gets the answer now, and again each time that the answer
     * changes (new tiles, a change of the style, and for a place on the screen also a movement of the map).
     * Returns a function that stops it.
     */
    watchFeatures(at: FeaturePlace | undefined, options: FeatureOptions & {sources: string[]}, listener: (features: QueriedFeature[]) => void): () => void;
    watchFeatures(at: FeaturePlace | undefined, options: FeatureOptions & {sources?: undefined}, listener: (features: RenderedFeature[]) => void): () => void;
    watchFeatures(at: FeaturePlace | undefined, options: FeatureOptions, listener: (features: RenderedFeature[] | QueriedFeature[]) => void): () => void;
    /** The height of the ground in metres at a position (`[lng, lat]`) or a point of the screen, from the elevation source of the style. `null` where there is no data. */
    queryElevation(at: Position | {x: number; y: number}): Promise<number | null>;
    /**
     * The cluster methods of a GeoJSON source with `cluster: true`. `clusterId` is `properties.cluster_id` of a cluster
     * feature, for example from `queryFeatures`. `clusterExpansionZoom` gives the zoom level at which the cluster divides,
     * `clusterChildren` the clusters and points that it divides into, and `clusterLeaves` its points (`limit` defaults to
     * 10, and `offset` to 0). The promise rejects when the source is not a GeoJSON source with clusters, or the cluster is not there.
     */
    clusterExpansionZoom(sourceId: string, clusterId: number): Promise<number>;
    clusterChildren(sourceId: string, clusterId: number): Promise<ClusterFeature[]>;
    clusterLeaves(sourceId: string, clusterId: number, limit?: number, offset?: number): Promise<ClusterFeature[]>;
    /**
     * Moves the camera now, with an animation when `duration` is not 0. With `fly` (`true` or the options `curve`,
     * `speed`, `screenSpeed`, `minZoom`, `maxDuration` of `flyTo` of MapLibre GL JS), the camera zooms out and back in
     * on the way, and without `duration` the duration follows from the distance.
     */
    moveTo(view: ViewInput & {duration?: number; padding?: PaddingInput; fly?: boolean | FlyOptions}): void;
    fitBounds(bounds: LngLatBoundsInput, options?: {padding?: PaddingInput; duration?: number; maxZoom?: number}): void;
    project(lngLat: Position): {x: number; y: number};
    unproject(point: {x: number; y: number}): [number, number];
    /**
     * Puts an element of the page at a position of the map: a marker with your own content, a label, a popup. The
     * element moves with the map. For many markers, use a marker layer (`markers` in the description): it is drawn
     * on the canvas and is much faster.
     */
    overlay(element: HTMLElement, options: OverlayOptions): MapOverlay;
    /** Calls `fn` for each event of that type (the types are the names of `MapEvents`). Returns a function that stops it. */
    listen<K extends keyof MapEvents>(type: K, fn: (event: MapEvents[K]) => void): () => void;
    readonly container: HTMLElement;
    /** The map object behind this host, for a need that this API does not cover yet. It can change between versions. */
    readonly map: Map;
}

// (A field that `a` does not have is not compared: an owned view such as `{center, zoom}` equals a full view that the map reported.)
const same = (a: ViewInput | undefined, b: ViewInput | undefined) => !!a && !!b && (['zoom', 'bearing', 'pitch'] as const).every(k => a[k] === undefined || a[k] === b[k]) && (!a.center || (a.center[0] === b.center?.[0] && a.center[1] === b.center?.[1]));

/** What of the marker layers is a part of the style: the source and the layer of each one (not the data). */
const markerStyles = (markers?: MarkerLayerOptions[]) => (markers ?? []).map(markerStyle);


/** Stops a description with no style, with a message that says what to write (a caller in JavaScript has no type check). */
function complete(spec: MapSpec, method: string, fix: string) {
    if (!spec?.style) throw new Error(`[map-jr-gl] ${method}(): the description has no "style". ${fix}`);
}

export function createMap(container: HTMLElement | string, spec: MapSpec): MapHost { return makeMap(container, spec, 'createMap()'); }

/** `createMap` for the adapters: `name` is what the user wrote (`<MapJr>`, `useMap()`), for the warnings that name it. */
export function makeMap(container: HTMLElement | string, spec: MapSpec, name: string): MapHost {
    complete(spec, 'createMap', 'Pass the URL of a style or a style object as "style".');
    if (!container) throw new Error('[map-jr-gl] createMap(): the container is ' + container + '. In a framework, make the map after the element is mounted.');
    if (typeof container === 'string' && !document.getElementById(container)) throw new Error(`[map-jr-gl] createMap(): no element with the id "${container}".`);
    const {bounds, padding, ...first} = {...spec.initialView, ...spec.view} as InitialView & {bounds?: unknown};
    const options: MapOptions = {
        container, style: spec.style, center: first.center, zoom: first.zoom, bearing: first.bearing, pitch: first.pitch,
        // (A `view` from the state has `bounds` too: it is a view, and only `initialView` gives a box to fit.)
        bounds: spec.view ? undefined : bounds as LngLatBoundsInput, fitBoundsOptions: {padding}, renderer: spec.renderer, fonts: spec.fonts, fontFamily: spec.fontFamily, glyphs: spec.glyphs, interactive: spec.interactive, antialias: spec.antialias, prefetch: spec.prefetch, hash: spec.hash,
        attributionControl: spec.attribution, minZoom: spec.minZoom, maxZoom: spec.maxZoom, maxPitch: spec.maxPitch,
    };
    for (const k in options) if ((options as any)[k] === undefined) delete (options as any)[k];
    // (The style is given after the map is made, with a function that adds the additions of `extend` when it has loaded.)
    delete options.style;
    const map = new Map(options);
    // The checks for mistakes of the user, and the texts of their warnings, are in a file that is loaded after the map
    // has started: `check` gives it the kind of the check (see `src/mistakes.ts`). A file that does not load gives no check.
    // `styled`: the map has the style of the last description, so its layers and sources can be compared with the description.
    let styled = false;
    // Only the development build loads the file (see `__DEV__`): the production build has no request for it and no check.
    const checks = (): Promise<typeof import('./mistakes.ts')> => __DEV__ ? import('./mistakes.ts') : Promise.reject();
    const checked: Checked = {map, warned: new Set(), spec: () => now, ready: () => alive && styled && state.get().loaded};
    const check = (kind: number, a?: unknown, b?: unknown) => { if (__DEV__) checks().then(m => m.check(checked, kind, a, b), () => {}); };
    // The data that each source has from the description: the GeoJSON of `data`, and the markers of a marker layer.
    const sent = new globalThis.Map<string, unknown>();
    // (The layers go to the style as copies: the map writes its edits into the style, and the description stays as the application gave it.)
    const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    // The sources of the base style: an extend source with one of these ids replaces it, and only a new style gives it back.
    let baseSources: object = {};
    const restyle = (next: MapSpec) => { styled = false; map.setStyle(next.style, {transformStyle: (_, style) => {
        styled = true;
        baseSources = style.sources ?? {};
        // (The sources of the new style have no data of the description yet: data that was given since `restyle` went to
        // the sources of the style before. It is given again when the new style is there: see `giveData`.)
        sent.clear();
        check(4, style, next.extend);
        return withMarkers(extended(style, next.extend && {...next.extend, layers: next.extend.layers && copy(next.extend.layers)}), next.markers);
    }}); };
    restyle(spec);
    // (The height of the container is read after a second, so that a container which gets its height a moment later gives no warning.)
    setTimeout(() => check(0, name), 1000);
    const viewOf = (): View => { const c = map.getCenter(), b = map.getBounds().toArray() as View['bounds']; return {center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), bounds: b}; };
    const state = createStore<MapState>({loaded: false, idle: false, moving: false, view: viewOf(), hover: [], renderer: undefined, error: undefined});
    const controls = new globalThis.Map<string, ReturnType<ControlSpec['create']>>();
    // The images of `images` that the map has, by name. The value says what the image was made from: the text of an
    // image that is given as text (so the same content in a new object is the same image), or else the object itself.
    const images = new globalThis.Map<string, unknown>();
    const imageKey = (v: ImageInput) => typeof v === 'string' ? v : typeof (v as {image?: unknown}).image === 'string' ? JSON.stringify(v) : v;
    // The views that the map reported a short time ago. An application that owns the view gives them back, often some
    // frames later; they are not applied again, or the map would go back while the user moves it.
    const reported: View[] = [];
    let now = spec, alive = true, pointer: {x: number; y: number} | null = null, asking = false;

    map.on('load', () => state.set({loaded: true, renderer: map.renderer as MapState['renderer']}));
    map.on('idle', () => state.set({idle: true}));
    map.on('error', e => {
        const error = e.error instanceof Error ? e.error : new Error(String(e.error));
        state.set({error});
        // (This listener takes the place of the report of the map itself: an error must not be lost in silence.)
        if (now.onError) now.onError(error); else logError(error);
    });
    const moved = (moving: boolean) => {
        const view = viewOf();
        // (A new size of the map changes only `bounds`.)
        if (same(view, state.get().view) && view.bounds + '' === state.get().view.bounds + '') return state.set({moving, idle: false});
        reported.push(view);
        if (reported.length > 60) reported.shift();
        state.set({view, moving, idle: false});
        now.onViewChange?.(view);
    };
    map.on('movestart', () => moved(true));
    map.on('move', () => moved(true));
    map.on('moveend', () => moved(false));
    map.on('resize', () => moved(state.get().moving));

    // The features under the pointer: one query at a time, and the last position is asked again when it has changed.
    const hover = async () => {
        if (asking || !alive) return;
        asking = true;
        while (alive) {
            const at = pointer, layers = now.interactiveLayers;
            // (A query is rejected when the map is removed or loses its WebGL context: nothing is under the pointer then.)
            const found = at && layers?.length ? await map.queryFeatures(at, {layers}).catch(() => []) : [];
            if (!alive) break;
            const before = state.get().hover;
            if (found.length !== before.length || found.some((f, i) => f.id !== before[i].id || (f.layer as any)?.id !== (before[i].layer as any)?.id || f.source !== before[i].source)) state.set({hover: found});
            if (!now.cursor) map.setCursor(found.length ? 'pointer' : '');
            if (at === pointer) break;
        }
        asking = false;
    };
    map.on('mousemove', e => { pointer = e.point ?? null; if (now.interactiveLayers?.length || state.get().hover.length) hover(); });
    map.on('mouseout', () => { pointer = null; hover(); });
    map.on('moveend', () => { if (pointer) hover(); });
    map.on('click', async e => {
        const click = now.onClick, layers = now.interactiveLayers;
        // (A click on an overlay is a map `click` for the compat entry (#198), but not a click of the map for `onClick`.)
        if (!click || !e.point || !e.lngLat || (e.originalEvent as Event)?.target !== map.getCanvas()) return;
        const features = layers?.length ? await map.queryFeatures(e.point, {layers}).catch(() => []) : [];
        if (alive) click({point: e.point, lngLat: [e.lngLat.lng, e.lngLat.lat], features});
    });

    // The GeoJSON data of `data`. A source gets its data when the style has it (a style from a URL comes later), and
    // again after a new style, which has the data of the style itself.
    const giveData = () => {
        const give = (id: string, data: unknown, made?: (data: any) => unknown) => {
            if (sent.get(id) === data) return;
            const source = map.getSource(id) as {setData?: (data: unknown) => void} | undefined;
            if (source?.setData) { sent.set(id, data); source.setData(made ? made(data) : data); }
        };
        for (const id in now.data) give(id, now.data[id]);
        // (The markers of a marker layer are the data of its source: a point for each one.)
        for (const m of now.markers ?? []) give(m.id, m.data, markerFeatures);
    };
    map.on('styledata', giveData);
    // An image that a marker layer names and that the map does not have. (A style can name other images that nothing
    // has. An image from a URL, and an image of a later description, come a moment later: the check waits for them.)
    map.on('styleimagemissing', e => setTimeout(() => { if (alive && !map.hasImage(e.id as string) && now.markers?.some(m => m.image === e.id)) check(5, e.id); }, 3000));
    // (At `idle`, and not when the style comes: an application can add a layer or a source itself in `load`.)
    map.on('idle', () => check(1));

    // A change of `extend` alone goes to the map as edits, so that the style is not loaded again and the layers that the
    // application added through `host.map` stay. It returns false, with nothing changed, for a change that needs a new
    // style: a changed `terrain`, a changed source, a source id that the style has, a changed `type`, `source`,
    // `source-layer`, `minzoom`, `maxzoom` or `before` of a layer, a new order of the layers, or a new layer before
    // one that stays.
    const edit = (next: StyleExtension = {}, before: StyleExtension = {}, differ: (a: unknown, b: unknown) => boolean) => {
        const was = before.layers ?? [], is = next.layers ?? [], ns = next.sources ?? {}, os = before.sources ?? {};
        const ids = (a: typeof is, b: typeof is) => a.filter(l => b.some(x => x.id === l.id)).map(l => l.id).join('\n');
        const kept = is.filter(l => was.some(w => w.id === l.id)), keys = ['paint', 'layout', 'filter', 'id'];
        if (differ(next.terrain, before.terrain) || ids(is, was) !== ids(was, is) || is.some((l, i) => !kept.includes(l) && i < is.indexOf(kept[kept.length - 1]))) return false;
        for (const id in ns) if (id in os ? differ(ns[id], os[id]) : map.getSource(id)) return false;
        for (const id in {...ns, ...os}) if (Object.hasOwn(baseSources, id)) return false;
        // (A new layer would go above the layers of `markers`, which a new style puts on top.)
        if (now.markers?.length && kept.length < is.length) return false;
        for (const l of kept) { const w = was.find(x => x.id === l.id)!; if (Object.keys({...l, ...w}).some(k => !keys.includes(k) && differ(l[k], w[k]))) return false; }
        for (const w of was) if (!kept.some(l => l.id === w.id)) map.removeLayer(w.id);
        for (const id in os) if (!(id in ns)) { sent.delete(id); map.removeSource(id); }
        for (const id in ns) if (!(id in os)) { sent.delete(id); map.addSource(id, ns[id]); }
        for (const l of kept) {
            const w = was.find(x => x.id === l.id)!;
            for (const g of ['paint', 'layout'] as const) {
                const a = (l[g] ?? {}) as Record<string, unknown>, b = (w[g] ?? {}) as Record<string, unknown>;
                for (const k in {...a, ...b}) if (differ(a[k], b[k])) (g === 'paint' ? map.setPaintProperty : map.setLayoutProperty).call(map, l.id, k, a[k]);
            }
            if (differ(l.filter, w.filter)) map.setFilter(l.id, l.filter);
        }
        for (const {before: at, ...l} of is) if (!kept.some(k => k.id === l.id)) map.addLayer(copy(l) as {id: string}, at && map.getLayer(at) ? at : undefined);
        giveData();
        return true;
    };

    const apply = (next: MapSpec, before?: MapSpec) => {
        // (A description that is made again each time, as in a template of a framework, has new objects with the same
        // content. So where the identity is different, the content is compared before the map does work.)
        const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);
        // (After a new style the data waits for the `styledata` event: the engine must have the new style first.)
        const restyled = !!before && (differ(next.style, before.style) || differ(next.extend, before.extend) && !(styled && edit(next.extend, before.extend, differ)) || differ(markerStyles(next.markers), markerStyles(before.markers)));
        if (restyled) { state.set({idle: false}); sent.clear(); restyle(next); }
        if (next.view && !same(next.view, before?.view) && !reported.some(v => same(next.view, v)) && before) map.jumpTo(next.view);
        if (next.minZoom !== before?.minZoom && before) map.setMinZoom(next.minZoom);
        if (next.maxZoom !== before?.maxZoom && before) map.setMaxZoom(next.maxZoom);
        if (next.maxPitch !== before?.maxPitch && before) map.setMaxPitch(next.maxPitch);
        if (differ(next.maxBounds, before?.maxBounds)) map.setMaxBounds(next.maxBounds);
        if (differ(next.padding, before?.padding)) map.jumpTo({padding: next.padding ?? 0});
        if (next.controls !== before?.controls) {
            const wanted = new Set((next.controls ?? []).map(c => c.key));
            for (const [key, c] of controls) if (!wanted.has(key)) { map.removeControl(c as any); controls.delete(key); }
            for (const c of next.controls ?? []) if (!controls.has(c.key)) { const made = c.create(); controls.set(c.key, made); map.addControl(made, c.position); }
        }
        if (next.cursor !== before?.cursor) map.setCursor(next.cursor ?? '');
        if (next.images !== before?.images) {
            const wanted = next.images ?? {};
            for (const name of images.keys()) if (!Object.hasOwn(wanted, name)) { images.delete(name); map.removeImage(name); }
            for (const name in wanted) {
                const v = wanted[name], key = imageKey(v);
                if (images.has(name) && images.get(name) === key) continue;
                if (images.has(name)) map.removeImage(name);
                images.set(name, key);
                const spec = v && typeof v === 'object' && 'image' in v ? v : null;
                // (An image that does not load is an error of the map, and the map goes on without it.)
                map.addImage(name, spec ? spec.image : v as ImageSource, spec ?? {}).catch(() => {
                    if (alive && images.get(name) === key) map.fire('error', {error: new Error(`[map-jr-gl] images: the image "${name}" did not load. Give an SVG document or the URL of an image that the page can read.`)});
                });
            }
        }
        if (differ(next.interactiveLayers, before?.interactiveLayers)) hover();
        check(2, next, before);
        now = next;
        if ((next.data !== before?.data || next.markers !== before?.markers) && !restyled) giveData();
    };
    apply(spec);

    const isPosition = (at: FeaturePlace): at is [number, number] => typeof (at as number[])[0] === 'number';
    const queryFeatures = ((at?: FeaturePlace, o: FeatureOptions = {}) => {
        const box = Array.isArray(at) && !isPosition(at);
        check(3, at, o);
        if (at && !box && !o.sources && !isPosition(at) && typeof (at as {x: number}).x !== 'number') return checks().then(m => m.mistake(9, JSON.stringify(at)), () => '[map-jr-gl] queryFeatures(): the place is not {x, y} or [lng, lat].').then(text => { throw new Error(text); });
        return map.queryFeatures(at, o);
    }) as MapHost['queryFeatures'];
    // (The cluster methods of the core source, with a message that names the method of the host.)
    const cluster = (name: string, id: string, run: (source: any) => Promise<any>) => Promise.resolve().then(() => {
        const source = map.getSource(id) as any;
        if (!source?.getClusterLeaves) throw new Error(`"${id}" is not a GeoJSON source of the style.`);
        return run(source);
    }).catch(e => { throw new Error(`[map-jr-gl] ${name}(): ${(e as Error)?.message?.replace(/^\[map-jr-gl\] /, '')}`); });

    return {
        update(next) {
            complete(next, 'update', `update() takes the complete description, not only the changed fields. Write map.update({...description, ${Object.keys(next ?? {})[0] ?? 'field'}: …}).`);
            if (alive) apply(next, now);
        },
        destroy() { if (!alive) return; alive = false; map.remove(); },
        state,
        queryFeatures,
        clusterExpansionZoom: (id, clusterId) => cluster('clusterExpansionZoom', id, s => s.getClusterExpansionZoom(clusterId)),
        clusterChildren: (id, clusterId) => cluster('clusterChildren', id, s => s.getClusterChildren(clusterId)),
        clusterLeaves: (id, clusterId, limit, offset) => cluster('clusterLeaves', id, s => s.getClusterLeaves(clusterId, limit, offset)),
        watchFeatures(at: FeaturePlace | undefined, o: FeatureOptions, listener: (features: any) => void) {
            // One question at a time. An event during a question asks again after it.
            let last: string | undefined, busy = false, again = false, stopped = false;
            const run = () => {
                if (busy) { again = true; return; }
                busy = true;
                queryFeatures(at, o).then(found => {
                    const text = JSON.stringify(found.map(f => [(f.layer as {id?: string})?.id ?? f.layer, f.source, f.id, f.properties]));
                    if (alive && !stopped && text !== last) { last = text; listener(found); }
                }, e => {
                    // (A query of a removed map or of a lost context has no answer and is asked again later. Any other
                    // rejection is a mistake of the caller: it is an error of the map, once until the answer changes.)
                    const text = 'e' + (e as Error)?.message;
                    if (alive && !stopped && text !== last && !text.includes('has no answer')) { last = text; map.fire('error', {error: e}); }
                }).finally(() => { busy = false; if (again && !stopped) { again = false; run(); } });
            };
            const data = (e: any) => { if (!o.sources || !e.sourceId || o.sources.includes(e.sourceId)) run(); };
            const moved = () => { if (!at || !isPosition(at)) run(); };
            map.on('sourcedata', data); map.on('idle', run); map.on('moveend', moved);
            run();
            return () => { stopped = true; map.off('sourcedata', data); map.off('idle', run); map.off('moveend', moved); };
        },
        queryElevation: at => map.queryElevation(at),
        moveTo({duration, fly, ...view}) { if (fly) map.flyTo({...view, duration, ...(fly === true ? {} : fly)}); else if (duration) map.easeTo({...view, duration}); else map.jumpTo(view); },
        fitBounds: (bounds, o) => { map.fitBounds(bounds, o); },
        project: lngLat => map.project(lngLat),
        unproject: point => { const p = map.unproject(point); return [p.lng, p.lat]; },
        overlay(element, o) {
            let now = o;
            const make = () => {
                if (!now.popup) return new Marker({element, anchor: now.anchor, offset: now.offset}).setLngLat(now.lngLat).addTo(map);
                const p = new Popup({anchor: now.anchor, offset: now.offset, closeButton: !!now.onClose, closeOnClick: false}).setLngLat(now.lngLat).setDOMContent(element).addTo(map);
                p.on('close', () => { if (made === p) now.onClose?.(); });
                return p;
            };
            let made: Marker | Popup | null = make();
            return {
                update(next) {
                    const again = !!next.popup !== !!now.popup || next.anchor !== now.anchor || String(next.offset) !== String(now.offset) || !!next.onClose !== !!now.onClose;
                    now = next;
                    if (!made) return;
                    if (again) { const old = made; made = null; old.remove(); made = make(); } else made.setLngLat(next.lngLat);
                },
                remove() { const old = made; made = null; old?.remove(); },
            };
        },
        listen(type, fn: (event: any) => void) { map.on(type, fn); return () => { map.off(type, fn); }; },
        container: map.getContainer(),
        map,
    };
}
