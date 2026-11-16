/**
 * The main API of the library: a map is made from one description (`MapSpec`), and is changed by giving a new
 * description. The library finds what is different. The state of the map (the view, loaded, idle, the features under
 * the pointer) is in a store that code can watch.
 *
 * The adapters for the frameworks (`@map-jr/map-jr-gl/vue` and others) are thin layers over `createMap`.
 * (For the API of MapLibre GL JS, see `@map-jr/map-jr-gl/maplibre-compat`.)
 */
import {Map, logError, type FeatureOptions, type FeaturePlace, type SourceOptions, isOptions, type ImageOptions, type MapOptions, type FlyOptions, type RenderedFeature, type RequestTransform} from './map.ts';
export type {PaddingInput};
export type {FeatureOptions, FeaturePlace, SourceOptions};
import {createStore, type Readable} from './store.ts';
import {Marker, Popup} from './overlays.ts';
import {dataTypeError, extended, withData, type Anchor} from './markers.ts';
import type {QueriedFeature} from './query.ts';
import type {Control, ControlPosition} from './controls.ts';
import type {Checked} from './mistakes.ts';
import {fontFaces, type FontFaces} from './resolve.ts';
import type {LngLatBoundsInput} from './lnglat.ts';
import type {PaddingInput} from './geo.ts';
import type {ProjectionSpecification} from './compat-types.ts';

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
/** Where the pointer is over the map: `point` in CSS pixels from the top left corner of the map, `lngLat` as `[lng, lat]`. */
export interface PointerPosition { point: {x: number; y: number}; lngLat: [number, number] }
export interface MapPointer { point: {x: number; y: number}; lngLat: [number, number]; /** The features of `interactiveLayers` at the point, the top one first. */ features: RenderedFeature[] }

/** The fields of `MapSpec` that add to the parts of the style: `sources`, `layers` and `terrain`. */
type StyleParts = Pick<MapSpec, 'sources' | 'layers' | 'terrain'>;
const parts = (s: MapSpec): StyleParts => ({sources: s.sources, layers: s.layers, terrain: s.terrain});

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
     * Sources to add to the sources of the style, by id. A source here replaces the source of the style that has the
     * same id. They are added when the style has loaded, so a style from a URL can have them too.
     */
    sources?: Record<string, object>;
    /**
     * Layers to add to the layers of the style: they do not replace them. A layer with `before` goes below the layer
     * of the style with that id, and a layer without it goes on top.
     */
    layers?: ({id: string; before?: string} & Record<string, unknown>)[];
    /**
     * 3D terrain from an elevation source, `{source: 'dem', exaggeration: 1.5}`, in place of the terrain of the style.
     * `null` or no field means the terrain of the style.
     */
    terrain?: {source: string; exaggeration?: number} | null;
    /**
     * Web fonts for labels, in the shape of `font-faces` of the style specification: by `text-font` name, a URL or a
     * list of `{url, 'unicode-range'}`. A name here replaces the same name in the `font-faces` of the style. A relative
     * URL is relative to the page. A new name loads its font and the labels are drawn again. See "Web fonts" in `docs/api.md`.
     */
    fonts?: FontFaces;
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
    /** Controls from `@map-jr/map-jr-gl/controls`: `[navigation(), scale()]`. */
    controls?: ControlSpec[];
    /**
     * The projection, in place of the property `projection` of the style: `{type: 'globe'}` or `{type: 'mercator'}`
     * (the same name and shape as in the style). `null` or no field: the projection of the style. A globe turns into
     * Mercator between zoom 11 and 12, as in MapLibre GL JS.
     */
    projection?: ProjectionSpecification | null;
    /**
     * Values for the `global-state` expressions of the style, by name: `{season: 'winter'}`. A value here is used in
     * place of the default in `state` of the style with the same name. A name that `update` leaves out, or gives
     * `null`, goes back to the default of the style. A new style gets these values too. Values are JSON.
     */
    globalState?: Record<string, unknown>;
    /** Style layers whose features are found under the pointer: they are in `state.hover` and in `onClick`. */
    interactiveLayers?: string[];
    /**
     * `true`: the top feature of `interactiveLayers` under the pointer has the feature state `hover: true`, which
     * `feature-state` expressions read, and loses it when the pointer leaves it. A feature with no id gets no state.
     * The default is `false`.
     */
    hoverState?: boolean;
    onClick?: (event: MapPointer) => void;
    /** Called for each error of the map. Without it, the map writes each error to the console. (`state.error` has the last error in each case.) */
    onError?: (error: Error) => void;
    minZoom?: number; maxZoom?: number; maxPitch?: number; maxBounds?: LngLatBoundsInput | null;
    /** The mouse cursor over the map. Without it, the cursor is a pointer over a feature of `interactiveLayers`. */
    cursor?: string;
    /**
     * `true`: the wheel zooms the map only with Ctrl (⌘ on a Mac), one finger scrolls the page and two fingers move the
     * map. A blocked gesture shows a hint over the map. For a map in a page that scrolls. The default is `false`.
     */
    cooperativeGestures?: boolean;
    /**
     * Space in CSS pixels at the sides of the map that the view keeps free, for example under a side panel: one number
     * for all sides, or `{top, right, bottom, left}` (a side that is left out is 0). The centre of the view is the centre
     * of the rest of the map. The default is 0.
     */
    padding?: PaddingInput;
    /**
     * Changes a request before the map makes it, as `transformRequest` of MapLibre GL JS: it gets the URL and the
     * kind of resource (`Style`, `Source`, `Tile`, `Glyphs`, `SpriteJSON`, `SpriteImage`, `Image` or `Font`) and returns
     * `{url, headers, credentials}`, or `undefined` to leave the request as it is. It also applies to the requests of
     * the tile workers. The map always calls the function of the last description.
     */
    transformRequest?: RequestTransform | null;
}
/** The fields that are read when the map is made only. */
export interface MapSetup {
    renderer?: 'auto' | 'worker' | 'main';
    fontFamily?: string;
    interactive?: boolean;
    antialias?: boolean;
    attribution?: false | {compact?: boolean; customAttribution?: string | string[]};
    hash?: boolean | string;
    /** The nonce of a Content Security Policy with `style-src 'nonce-…'`, for the style sheet of the map. */
    nonce?: string;
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
    /** Where the pointer is while it is over the map, or `null`. It changes at each move of the mouse: subscribe with a selector. */
    pointer: PointerPosition | null;
    /** The thread that draws: known when the map has started. */
    renderer: 'worker' | 'main' | undefined;
    error: Error | undefined;
}

/** Where an element of the page is on the map. */
export interface OverlayOptions {
    lngLat: Position;
    /** The part of the element that is at the position: `'center'` (the default), `'bottom'`, `'top-left'` and others. */
    anchor?: Anchor;
    /** A distance in pixels from the position, to the right and down. */
    offset?: [number, number];
    /** Show the element in a box with a pointer to the position (a popup). With `onClose`, the box has a button to close it. */
    popup?: boolean;
    onClose?: () => void;
    /**
     * The user can move the element with the mouse, a finger or a pen (default `false`; not for a `popup`). A drag
     * starts once the pointer has moved 3 pixels, so a click stays a click, and the map does not pan under it. The
     * callbacks get the position of the element as `[lng, lat]`. After a drag, the element stays where it was dropped
     * until `lngLat` changes, so pass the new position to `lngLat` in `onDragEnd` to keep it in your state.
     */
    draggable?: boolean;
    onDragStart?: (lngLat: Position) => void;
    onDrag?: (lngLat: Position) => void;
    onDragEnd?: (lngLat: Position) => void;
}
export interface MapOverlay { update(options: OverlayOptions): void; remove(): void }

/** What each event of `listen` has: its type, and the `MapHost` that fired it. */
export interface MapEventBase<T extends string = string> { type: T; target: MapHost }
/** An event of a drag of the map by the user (`dragstart`, `drag`, `dragend`). */
export interface MapDragEvent extends MapEventBase<'dragstart' | 'drag' | 'dragend'> {
    /** The event of the mouse or the touch that moved the map. */
    originalEvent: MouseEvent | TouchEvent;
}
/** An event of the pointer. A listener that calls `preventDefault()` stops what the map does for the event (a drag, a zoom). */
export interface MapPointerEvent<T extends string = string, E extends MouseEvent = MouseEvent> extends MapEventBase<T> {
    /** The place in CSS pixels from the top left corner of the map. */
    point: {x: number; y: number};
    /** The position under the pointer, `[lng, lat]`, as in `onClick`. */
    lngLat: [number, number];
    originalEvent: E;
    preventDefault(): void;
    readonly defaultPrevented: boolean;
}
/** An event of a touch: `points` and `lngLats` have one entry for each finger on the map. */
export interface MapTouchEvent<T extends string = string> extends MapPointerEvent<T, PointerEvent> { points: {x: number; y: number}[]; lngLats: [number, number][] }
/** An event of the data of the map: `dataType` says whether the style or one source (`sourceId`) is concerned. */
export interface MapDataEvent<T extends string = string> extends MapEventBase<T> { dataType: 'source' | 'style'; sourceId?: string; isSourceLoaded?: boolean; source?: unknown }

type Plain<K extends string> = {[T in K]: MapEventBase<T>};
type Pointed<K extends string> = {[T in K]: MapPointerEvent<T>};
/**
 * The events of `listen`, by type. The state of the map (`state`) and the callbacks of the description (`onClick`,
 * `onViewChange`, `onError`) cover the common needs. A position is `[lng, lat]` and a box is
 * `[[west, south], [east, north]]`, as in the rest of this API.
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
    boxzoomend: MapEventBase<'boxzoomend'> & {originalEvent: Event; boxZoomBounds: [[number, number], [number, number]]};
    /** About once a second while the map draws: frames per second, and the time of a frame on the CPU in milliseconds. */
    stats: MapEventBase<'stats'> & {fps: number; frameMs: number; labels: number};
    /** The style names an image (`id`) that the map does not have. */
    styleimagemissing: MapEventBase<'styleimagemissing'> & {id: string};
    /** The terrain of the style has changed. */
    terrain: MapEventBase<'terrain'> & {terrain: {source: string; exaggeration?: number} | null};
    /**
     * The projection has been put in place: by each new style, and by a change of its name (`projection` in the
     * description, the control `globe()`). `newProjection` is `mercator`, `globe` or `vertical-perspective`.
     */
    projectiontransition: MapEventBase<'projectiontransition'> & {newProjection: string};
    /** The geolocate control of `@map-jr/map-jr-gl/controls` has a position. */
    geolocate: MapEventBase<'geolocate'> & {coords: GeolocationCoordinates};
    /** `error` is usually an `Error`. (`onError` and `state.error` always have an `Error`.) */
    error: MapEventBase<'error'> & {error: unknown};
}

export interface MapHost {
    /** Changes the map to a new description. Give the complete description each time: a description with no `style` throws. */
    update(spec: MapSpec): void;
    /** Changes only the fields of `part`: `map.update({...map.description, ...part})`. A field of `part` that is `undefined` is removed. */
    patch(part: Partial<MapSpec>): void;
    /** The description of the last `createMap`, `update` or `patch`. Read only: change the map with `update` or `patch`. */
    readonly description: Readonly<MapSpec>;
    destroy(): void;
    readonly state: Readable<MapState>;
    /**
     * The features that the style layers draw, the top one first (`layers` selects layers). `at` is a point of the
     * screen (`{x, y}`), a position (`[lng, lat]`), a rectangle of the screen (two points), or nothing for the whole map.
     * The options can come in the place of `at`: `queryFeatures({layers: ['places']})` asks the whole map.
     */
    queryFeatures(at?: FeaturePlace | FeatureOptions, options?: FeatureOptions): Promise<RenderedFeature[]>;
    /**
     * The features of the tile data of the source `sourceId`. They need no style layer, and at a position they need not
     * be on the screen (the tile is fetched if necessary). `at` is a point of the screen or a position, or nothing for
     * the tiles of the view. The options can come in the place of `at`.
     */
    querySource(sourceId: string, at?: FeaturePlace | SourceOptions, options?: SourceOptions): Promise<QueriedFeature[]>;
    /**
     * The question of `queryFeatures`, kept up to date: `listener` gets the answer now, and again each time that the
     * answer changes (new tiles, a change of the style, and for a place on the screen also a movement of the map).
     * Returns a function that stops it.
     */
    watchFeatures(at: FeaturePlace | undefined, options: FeatureOptions, listener: (features: RenderedFeature[]) => void): () => void;
    /** The question of `querySource`, kept up to date in the same way as `watchFeatures`. Returns a function that stops it. */
    watchSource(sourceId: string, at: FeaturePlace | undefined, options: SourceOptions, listener: (features: QueriedFeature[]) => void): () => void;
    /**
     * Merges `state` into the state of one feature, which `feature-state` expressions read (a highlight of a hovered or
     * selected feature). `target.id` is the `id` of the feature (`RenderedFeature.id`), and `sourceLayer` is required
     * for a vector source. The state is kept by the map, also after a new `style` in `update`, until it is removed.
     */
    setFeatureState(target: {source: string; sourceLayer?: string; id: number | string}, state: Record<string, unknown>): void;
    /** Removes one key of the state of a feature, its whole state (no `key`), or the state of all features of a source (no `id`). */
    removeFeatureState(target: {source: string; sourceLayer?: string; id?: number | string}, key?: string): void;
    /** The height of the ground in metres at a position (`[lng, lat]`) or a point of the screen, from the elevation source of the style. `null` where there is no data. */
    queryElevation(at: Position | {x: number; y: number}): Promise<number | null>;
    /**
     * The map as an image, for a download or for printing. Waits until the map is idle (all tiles drawn), draws one
     * frame and resolves to a Blob of the canvas. `type` defaults to `'image/png'`; `quality` (0 to 1) applies to
     * `'image/jpeg'` and `'image/webp'`. The image has the size of the canvas in device pixels and has no markers or
     * controls (they are elements of the page). The promise rejects when the map is destroyed first.
     */
    toBlob(type?: string, quality?: number): Promise<Blob>;
    /**
     * The cluster methods of a GeoJSON source with `cluster: true`. `clusterId` is `properties.cluster_id` of a cluster
     * feature, for example from `queryFeatures`. `clusterExpansionZoom` gives the zoom level at which the cluster divides,
     * `clusterChildren` the clusters and points that it divides into, and `clusterLeaves` its points (the options `limit`, default
     * 10, and `offset`, default 0). The promise rejects when the source is not a GeoJSON source with clusters, or the cluster is not there.
     */
    clusterExpansionZoom(sourceId: string, clusterId: number): Promise<number>;
    clusterChildren(sourceId: string, clusterId: number): Promise<ClusterFeature[]>;
    clusterLeaves(sourceId: string, clusterId: number, options?: {limit?: number; offset?: number}): Promise<ClusterFeature[]>;
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
     * element moves with the map. For many points, use a symbol layer in `layers` with the points in `data`: it
     * is drawn on the canvas and is much faster.
     */
    overlay(element: HTMLElement, options: OverlayOptions): MapOverlay;
    /** Calls `fn` for each event of that type (the types are the names of `MapEvents`). Returns a function that stops it. */
    listen<K extends keyof MapEvents>(type: K, fn: (event: MapEvents[K]) => void): () => void;
    /**
     * A promise of the next event of that type. It rejects when the map is destroyed first. `once('load')` on a map
     * that has loaded resolves at once, with an event of type `load`.
     */
    once<K extends keyof MapEvents>(type: K): Promise<MapEvents[K]>;
    readonly container: HTMLElement;
}

// (A field that `a` does not have is not compared: an owned view such as `{center, zoom}` equals a full view that the map reported.)
const same = (a: ViewInput | undefined, b: ViewInput | undefined) => !!a && !!b && (['zoom', 'bearing', 'pitch'] as const).every(k => a[k] === undefined || a[k] === b[k]) && (!a.center || (a.center[0] === b.center?.[0] && a.center[1] === b.center?.[1]));


/** Stops a description with no style, with a message that says what to write (a caller in JavaScript has no type check). */
function complete(spec: MapSpec, method: string, fix: string) {
    if (!spec?.style) throw new Error(`[map-jr-gl] ${method}(): the description has no "style". ${fix}`);
}

export function createMap(container: HTMLElement | string, spec: MapSpec): MapHost { return makeMap(container, spec, 'createMap()'); }

/** `createMap` for the adapters: `name` is what the user wrote (`<MapJr>`, `useMapJr()`), for the warnings that name it. */
export function makeMap(container: HTMLElement | string, spec: MapSpec, name: string): MapHost {
    complete(spec, 'createMap', 'Pass the URL of a style or a style object as "style".');
    if (!container) throw new Error('[map-jr-gl] createMap(): the container is ' + container + '. In a framework, make the map after the element is mounted.');
    if (typeof container === 'string' && !document.getElementById(container)) throw new Error(`[map-jr-gl] createMap(): no element with the id "${container}".`);
    const {bounds, padding, ...first} = {...spec.initialView, ...spec.view} as InitialView & {bounds?: unknown};
    const options: MapOptions = {
        container, style: spec.style, center: first.center, zoom: first.zoom, bearing: first.bearing, pitch: first.pitch,
        // (A `view` from the state has `bounds` too: it is a view, and only `initialView` gives a box to fit.)
        bounds: spec.view ? undefined : bounds as LngLatBoundsInput, fitBoundsOptions: {padding}, renderer: spec.renderer, fontFamily: spec.fontFamily, interactive: spec.interactive, antialias: spec.antialias, hash: spec.hash, nonce: spec.nonce,
        attributionControl: spec.attribution, minZoom: spec.minZoom, maxZoom: spec.maxZoom, maxPitch: spec.maxPitch,
    };
    for (const k in options) if ((options as any)[k] === undefined) delete (options as any)[k];
    // (The style is given after the map is made, with a function that adds the `sources`, `layers` and `terrain` of the description when it has loaded.)
    delete options.style;
    // (The map calls the function of the last description, so a function that is made again in each render does not
    // send the rules of requests to the engine again. Only a change between none and a function does.)
    let transformLast = spec.transformRequest;
    const transform: RequestTransform = (url, kind) => transformLast?.(url, kind);
    if (spec.transformRequest) options.transformRequest = transform;
    const map = new Map(options);
    // The checks for mistakes of the user, and the texts of their warnings, are in a file that is loaded after the map
    // has started: `check` gives it the kind of the check (see `src/mistakes.ts`). A file that does not load gives no check.
    // `styled`: the map has the style of the last description, so its layers and sources can be compared with the description.
    let styled = false;
    // Only the development build loads the file (see `__DEV__`): the production build has no request for it and no check.
    const checks = (): Promise<typeof import('./mistakes.ts')> => __DEV__ ? import('./mistakes.ts') : Promise.reject();
    const checked: Checked = {map, warned: new Set(), spec: () => now, ready: () => alive && styled && state.get().loaded};
    const check = (kind: number, a?: unknown, b?: unknown) => { if (__DEV__) checks().then(m => m.check(checked, kind, a, b), () => {}); };
    // The data that each source has from the description: the GeoJSON of `data`.
    const sent = new globalThis.Map<string, unknown>();
    // `cooperativeGestures`: the handler of the compat entry (cooperative-gestures.ts) loads on demand. Until it has
    // loaded, the gestures are blocked without the hint. `stop` removes the hint; `cooperating` is the wanted state.
    let cooperating = false, stop: (() => void) | undefined;
    const canvasStyle = map.getCanvas().style, touchAction = canvasStyle.touchAction;
    const cooperate = (on: boolean) => {
        cooperating = on;
        if (!on) { stop?.(); stop = map.gate = undefined; canvasStyle.touchAction = touchAction; return; }
        canvasStyle.touchAction = 'pan-x pan-y';
        map.gate = (type, e) => type === 'touch_pan' || !(e as WheelEvent)[navigator.userAgent.includes('Mac') ? 'metaKey' : 'ctrlKey'];
        // (After the import, the field may be off again or the map destroyed.)
        import('./cooperative-gestures.ts').then(m => { if (alive && cooperating && !stop) stop = m.cooperate(map); });
    };
    // (The layers go to the style as copies: the map writes its edits into the style, and the description stays as the application gave it.)
    const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    // The sources of the base style: a source of the description with one of these ids replaces it, and only a new style gives it back.
    let baseSources: object = {};
    // The projection of the style itself, which applies when the description has none, and that of the last description.
    let styleProjection: ProjectionSpecification | undefined, wantedProjection = spec.projection;
    // The ids of the GeoJSON sources that keys of `data` made, because the style and `sources` have no source of that id (#487).
    const madeData = new Set<string>();
    // (The `data` of the last description: keys can change while the style loads.)
    let wantedData = spec.data;
    // (The `fonts` of the last description, with URLs that are relative to the page made absolute: the style has its own base.)
    let wantedFonts = spec.fonts;
    // The images in `metadata['map-jr:images']` of the style (#495), and the `images` of the last description, which win by name.
    let fromStyle: Record<string, ImageInput> = {}, wantedImages = spec.images, styleTurn = 0;
    const absolute = (faces: FontFaces | undefined) => { const out: FontFaces = {}; for (const f of fontFaces(faces, document.baseURI)) ((out[f.name!] ??= []) as {url: string; 'unicode-range'?: string[]}[]).push({url: f.src, ...(f.unicodeRange ? {'unicode-range': f.unicodeRange.split(', ')} : {})}); return out; };
    const typeError = (id: string, type: string) => setTimeout(() => { if (alive) map.fire('error', {error: dataTypeError(id, type)}); });
    const restyle = (next: MapSpec) => { styled = false; map.setStyle(next.style, {transformStyle: (_, style) => {
        styled = true;
        baseSources = style.sources ?? {};
        styleProjection = style.projection;
        // (The code for the images of a style is loaded only for a style that has them. After it has loaded, the map must
        // still exist and the style must not have been replaced.)
        const turn = ++styleTurn, given = style.metadata?.['map-jr:images'];
        fromStyle = {};
        putImages();
        if (given != null) import('./style-images.ts').then(m => {
            if (!alive || turn !== styleTurn) return;
            fromStyle = m.styleImages(style, message => { if (alive) map.fire('error', {error: new Error(message)}); });
            putImages();
        });
        // (The description of this moment: it can have changed while the style loaded.)
        if (wantedProjection) style = {...style, projection: copy(wantedProjection)};
        if (wantedFonts) style = {...style, 'font-faces': {...style['font-faces'], ...absolute(wantedFonts)}} as typeof style;
        // (The sources of the new style have no data of the description yet: data that was given since `restyle` went to
        // the sources of the style before. It is given again when the new style is there: see `giveData`.)
        sent.clear();
        check(4, style, parts(next));
        const made = withData(extended(style, {...parts(next), layers: next.layers && copy(next.layers)}), wantedData, false, typeError);
        madeData.clear();
        for (const id in wantedData) if (!Object.hasOwn(style.sources ?? {}, id) && !Object.hasOwn(next.sources ?? {}, id)) madeData.add(id);
        return made;
    }}); };
    restyle(spec);
    // (The height of the container is read after a second, so that a container which gets its height a moment later gives no warning.)
    setTimeout(() => check(0, name), 1000);
    const viewOf = (): View => { const c = map.getCenter(), b = map.getBounds().toArray() as View['bounds']; return {center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), bounds: b}; };
    const state = createStore<MapState>({loaded: false, idle: false, moving: false, view: viewOf(), hover: [], pointer: null, renderer: undefined, error: undefined});
    const controls = new globalThis.Map<string, ReturnType<ControlSpec['create']>>();
    // The images of `images` that the map has, by name. The value says what the image was made from: the text of an
    // image that is given as text (so the same content in a new object is the same image), or else the object itself.
    const images = new globalThis.Map<string, unknown>();
    const imageKey = (v: ImageInput) => typeof v === 'string' ? v : typeof (v as {image?: unknown}).image === 'string' ? JSON.stringify(v) : v;
    // The views that the map reported a short time ago. An application that owns the view gives them back, often some
    // frames later; they are not applied again, or the map would go back while the user moves it.
    const reported: View[] = [];
    const waiting = new Set<() => void>(); // the promises of `once` that wait for an event
    let now = spec, alive = true, pointer: {x: number; y: number} | null = null, asking = false;
    // `hoverState`: the feature that has the state `hover` from the map.
    let lit: {source: string; sourceLayer?: string; id: number | string} | undefined;

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
            const top = now.hoverState ? found[0] : undefined;
            if (top && top.id == null) check(9, top.layer.id);
            const next = top && top.id != null ? {source: top.source, sourceLayer: top.sourceLayer, id: top.id} : undefined;
            if (next?.id !== lit?.id || next?.source !== lit?.source || next?.sourceLayer !== lit?.sourceLayer) {
                // (A source that the style no longer has throws: its feature state is gone with it.)
                if (lit) try { map.removeFeatureState(lit, 'hover'); } catch {}
                lit = next;
                if (next) map.setFeatureState(next, {hover: true});
            }
            if (at === pointer) break;
        }
        asking = false;
    };
    map.on('mousemove', e => { pointer = e.point ?? null; state.set({pointer: e.point && e.lngLat ? {point: {x: e.point.x, y: e.point.y}, lngLat: [e.lngLat.lng, e.lngLat.lat]} : null}); if (now.interactiveLayers?.length || state.get().hover.length) hover(); });
    map.on('mouseout', () => { pointer = null; state.set({pointer: null}); hover(); });
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
        for (const id in now.data) {
            const data = now.data[id];
            if (sent.get(id) === data) continue;
            const source = map.getSource(id) as {setData?: (data: unknown) => void} | undefined;
            if (source?.setData) { sent.set(id, data); source.setData(data); }
        }
    };
    map.on('styledata', giveData);
    // (At `idle`, and not when the style comes: an application can add a layer or a source itself in `load`.)
    map.on('idle', () => check(1));

    // A change of only `sources`, `layers` and `terrain` goes to the map as edits, so that the style is not loaded again and the layers that the
    // application added through the core map stay. It returns false, with nothing changed, for a change that needs a new
    // style: a changed `terrain`, a changed source, a source id that the style has, a changed `type`, `source`,
    // `source-layer`, `minzoom`, `maxzoom` or `before` of a layer, a new order of the layers, or a new layer before
    // one that stays.
    const edit = (next: StyleParts, before: StyleParts, differ: (a: unknown, b: unknown) => boolean) => {
        const was = before.layers ?? [], is = next.layers ?? [], ns = next.sources ?? {}, os = before.sources ?? {};
        const ids = (a: typeof is, b: typeof is) => a.filter(l => b.some(x => x.id === l.id)).map(l => l.id).join('\n');
        const kept = is.filter(l => was.some(w => w.id === l.id)), keys = ['paint', 'layout', 'filter', 'id'];
        if (differ(next.terrain, before.terrain) || ids(is, was) !== ids(was, is) || is.some((l, i) => !kept.includes(l) && i < is.indexOf(kept[kept.length - 1]))) return false;
        for (const id in ns) if (id in os ? differ(ns[id], os[id]) : map.getSource(id)) return false;
        for (const id in {...ns, ...os}) if (Object.hasOwn(baseSources, id)) return false;
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

    // Gives the map the images of the style and of the description, and removes those that neither has now.
    const putImages = () => {
        const wanted: Record<string, ImageInput> = {...fromStyle, ...wantedImages};
        for (const name of images.keys()) if (!Object.hasOwn(wanted, name)) { images.delete(name); map.removeImage(name); }
        for (const name in wanted) {
            const v = wanted[name], key = imageKey(v);
            if (images.has(name) && images.get(name) === key) continue;
            if (images.has(name)) map.removeImage(name);
            images.set(name, key);
            const spec = v && typeof v === 'object' && 'image' in v ? v : null;
            // (An image that does not load is an error of the map, and the map goes on without it.)
            map.addImage(name, spec ? spec.image : v as ImageSource, spec ?? {}).then(busy, () => {
                if (alive && images.get(name) === key) map.fire('error', {error: new Error(`[map-jr-gl] ${Object.hasOwn(wantedImages ?? {}, name) ? 'images' : 'the style'}: the image "${name}" did not load. Give an SVG document or the URL of an image that the page can read.`)});
            });
        }
    };
    // A change that gave the engine work makes the map not idle until the engine reports idle again (#411).
    const busy = () => { if (alive && state.get().idle && !map.areTilesLoaded()) state.set({idle: false}); };
    const apply = (next: MapSpec, before?: MapSpec) => {
        // (A description that is made again each time, as in a template of a framework, has new objects with the same
        // content. So where the identity is different, the content is compared before the map does work.)
        const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);
        wantedProjection = next.projection;
        wantedData = next.data;
        wantedFonts = next.fonts;
        // (A new key of `data` makes its source before the edits of `sources` and `layers`, which can add a layer that names it.)
        if (styled && before) for (const id in next.data) {
            const s = map.getSource(id) as {type?: string} | undefined;
            if (!s) { madeData.add(id); map.addSource(id, {type: 'geojson', data: {type: 'FeatureCollection', features: []}}); }
            else if (!(id in (before.data ?? {})) && s.type !== 'geojson') typeError(id, s.type!);
        }
        // (After a new style the data waits for the `styledata` event: the engine must have the new style first.)
        const restyled = !!before && (differ(next.style, before.style) || (['sources', 'layers', 'terrain'] as const).some(k => differ(next[k], before[k])) && !(styled && edit(parts(next), parts(before), differ)));
        if (restyled) { state.set({idle: false}); sent.clear(); restyle(next); }
        else for (const id of madeData) if (!Object.hasOwn(next.data ?? {}, id)) { madeData.delete(id); sent.delete(id); map.removeSource(id); }
        // (A font of a name that is new or changed is loaded; the new style of a restyle has the fonts already. A font
        // that is removed stays with the browser, and the labels keep it until the page is loaded again.)
        if (styled && !restyled && differ(next.fonts, before?.fonts)) {
            const changed: FontFaces = {};
            for (const name in next.fonts) if (differ(next.fonts[name], before?.fonts?.[name])) changed[name] = next.fonts[name];
            map.addFonts(fontFaces(absolute(changed)));
        }
        if (next.view && !same(next.view, before?.view) && !reported.some(v => same(next.view, v)) && before) map.jumpTo(next.view);
        if (next.minZoom !== before?.minZoom && before) map.setMinZoom(next.minZoom);
        if (next.maxZoom !== before?.maxZoom && before) map.setMaxZoom(next.maxZoom);
        if (next.maxPitch !== before?.maxPitch && before) map.setMaxPitch(next.maxPitch);
        if (differ(next.maxBounds, before?.maxBounds)) map.setMaxBounds(next.maxBounds);
        if (differ(next.padding, before?.padding)) map.jumpTo({padding: next.padding ?? 0});
        // (Before the style is there, the style gets the projection of the description when it comes: see `restyle`.)
        // (The map keeps these values across a new style; only the names whose values changed are set.)
        for (const name of new Set([...Object.keys(next.globalState ?? {}), ...Object.keys(before?.globalState ?? {})])) {
            const value = next.globalState?.[name];
            if (differ(value, before?.globalState?.[name])) map.setGlobalStateProperty(name, value == null ? null : copy(value));
        }
        if (before && styled && !restyled && differ(next.projection, before.projection)) map.setProjection(next.projection ? copy(next.projection) : styleProjection);
        if (next.controls !== before?.controls) {
            const wanted = new Set((next.controls ?? []).map(c => c.key));
            for (const [key, c] of controls) if (!wanted.has(key)) { map.removeControl(c as any); controls.delete(key); }
            for (const c of next.controls ?? []) if (!controls.has(c.key)) { const made = c.create(); controls.set(c.key, made); map.addControl(made, c.position); }
        }
        transformLast = next.transformRequest;
        if (before && !next.transformRequest !== !before.transformRequest) map.setTransformRequest(next.transformRequest ? transform : null);
        if (next.cursor !== before?.cursor) map.setCursor(next.cursor ?? '');
        wantedImages = next.images;
        if (next.images !== before?.images) putImages();
        if (!next.cooperativeGestures !== !before?.cooperativeGestures) cooperate(!!next.cooperativeGestures);
        if (differ(next.interactiveLayers, before?.interactiveLayers) || !next.hoverState !== !before?.hoverState) hover();
        check(2, next, before);
        now = next;
        if (next.data !== before?.data && !restyled) giveData();
        busy();
    };
    apply(spec);

    const isPosition = (at: FeaturePlace): at is [number, number] => typeof (at as number[])[0] === 'number';
    /** Rejects with the message of the mistake `code`, or with `short` when the checks do not load. */
    const reject = (code: number, a: string, short: string) => checks().then(m => m.mistake(code, a), () => '[map-jr-gl] ' + short).then(text => { throw new Error(text); });
    const queryFeatures = (at?: FeaturePlace | FeatureOptions, o: FeatureOptions = {}): Promise<RenderedFeature[]> => {
        if (isOptions(at)) { o = at as FeatureOptions; at = undefined; }
        check(3, at, o);
        if (at && !Array.isArray(at) && typeof (at as {x: number}).x !== 'number') return reject(9, JSON.stringify(at), 'queryFeatures(): the place is not {x, y} or [lng, lat].');
        return map.queryFeatures(at as FeaturePlace | undefined, o);
    };
    const querySource = (id: string, at?: FeaturePlace | SourceOptions, o: SourceOptions = {}): Promise<QueriedFeature[]> => {
        if (typeof id !== 'string') return reject(10, JSON.stringify(id) ?? String(id), 'querySource(): the first argument is not the id of a source.');
        if (isOptions(at)) { o = at as SourceOptions; at = undefined; }
        check(6, at, {...o, id});
        return map.querySource(id, at as FeaturePlace | undefined, o);
    };
    /** Runs `ask` now and after each change that can change its answer, and gives each new answer to `listener`. */
    const watch = <T extends {layer?: unknown; source: string; id?: unknown; properties: unknown}>(at: FeaturePlace | undefined, source: string | undefined, ask: () => Promise<T[]>, listener: (features: T[]) => void) => {
        // One question at a time. An event during a question asks again after it.
        let last: string | undefined, busy = false, again = false, stopped = false;
        const run = () => {
            if (busy) { again = true; return; }
            busy = true;
            ask().then(found => {
                const text = JSON.stringify(found.map(f => [(f.layer as {id?: string})?.id ?? f.layer, f.source, f.id, f.properties]));
                if (alive && !stopped && text !== last) { last = text; listener(found); }
            }, e => {
                // (A query of a removed map or of a lost context has no answer and is asked again later. Any other
                // rejection is a mistake of the caller: it is an error of the map, once until the answer changes.)
                const text = 'e' + (e as Error)?.message;
                if (alive && !stopped && text !== last && !text.includes('has no answer')) { last = text; map.fire('error', {error: e}); }
            }).finally(() => { busy = false; if (again && !stopped) { again = false; run(); } });
        };
        const data = (e: any) => { if (!source || !e.sourceId || e.sourceId === source) run(); };
        const moved = () => { if (!at || !isPosition(at)) run(); };
        map.on('sourcedata', data); map.on('idle', run); map.on('moveend', moved);
        run();
        return () => { stopped = true; map.off('sourcedata', data); map.off('idle', run); map.off('moveend', moved); };
    };
    // (The cluster methods of the core source, with a message that names the method of the host.)
    const cluster = (name: string, id: string, run: (source: any) => Promise<any>) => Promise.resolve().then(() => {
        const source = map.getSource(id) as any;
        if (!source?.getClusterLeaves) throw new Error(`"${id}" is not a GeoJSON source of the style.`);
        return run(source);
    }).catch(e => { throw new Error(`[map-jr-gl] ${name}(): ${(e as Error)?.message?.replace(/^\[map-jr-gl\] /, '')}`); });
    // An event of the core map as the host gives it: positions as `[lng, lat]`, and the host as `target`. The
    // descriptors are copied, so that `preventDefault()` and the getter `defaultPrevented` still act on the event of the map.
    const pair = (p: {lng: number; lat: number}): [number, number] => [p.lng, p.lat];
    const hostEvent = (e: any) => {
        const out = Object.defineProperties({} as any, Object.getOwnPropertyDescriptors(e));
        out.target = host;
        if (e.lngLat) out.lngLat = pair(e.lngLat);
        if (e.lngLats) out.lngLats = e.lngLats.map(pair);
        if (e.boxZoomBounds) out.boxZoomBounds = e.boxZoomBounds.toArray();
        return out;
    };

    // (`_map`, the core map, is private: it is not in the type `MapHost`, and the tests and the library read it.)
    const host: MapHost & {readonly _map: Map} = {
        update(next) {
            complete(next, 'update', `update() takes the complete description, not only the changed fields. Write map.patch({${Object.keys(next ?? {})[0] ?? 'field'}: …}) to change only some fields.`);
            if (alive) apply(next, now);
        },
        patch(part) {
            const next: any = {...now, ...part};
            for (const k in part) if ((part as any)[k] === undefined) delete next[k];
            complete(next, 'patch', 'Do not set "style" to undefined.');
            if (alive) apply(next, now);
        },
        get description() { return now; },
        destroy() { if (!alive) return; alive = false; cooperate(false); map.remove(); for (const drop of waiting) drop(); waiting.clear(); },
        state,
        queryFeatures,
        setFeatureState(target, value) { if (alive) map.setFeatureState(target, value); },
        removeFeatureState(target, key) { if (alive) map.removeFeatureState(target, key); },
        clusterExpansionZoom: (id, clusterId) => cluster('clusterExpansionZoom', id, s => s.getClusterExpansionZoom(clusterId)),
        clusterChildren: (id, clusterId) => cluster('clusterChildren', id, s => s.getClusterChildren(clusterId)),
        clusterLeaves: (id, clusterId, options) => cluster('clusterLeaves', id, s => {
            if (typeof options !== 'object' && options !== undefined) throw new Error(`the third argument is ${options}. Pass {limit, offset}, for example clusterLeaves(sourceId, clusterId, {limit: 50, offset: 100}).`);
            return s.getClusterLeaves(clusterId, options?.limit, options?.offset);
        }),
        querySource,
        watchFeatures: (at, o, listener) => watch(at, undefined, () => queryFeatures(at, o), listener),
        watchSource: (id, at, o, listener) => watch(at, id, () => querySource(id, at, o), listener),
        queryElevation: at => map.queryElevation(at),
        toBlob: (type, quality) => map.toBlob(type, quality),
        moveTo({duration, fly, ...view}) { if (fly) map.flyTo({...view, duration, ...(fly === true ? {} : fly)}); else if (duration) map.easeTo({...view, duration}); else map.jumpTo(view); },
        fitBounds: (bounds, o) => { map.fitBounds(bounds, o); },
        project: lngLat => map.project(lngLat),
        unproject: point => { const p = map.unproject(point); return [p.lng, p.lat]; },
        overlay(element, o) {
            let now = o;
            const make = () => {
                if (!now.popup) {
                    const m = new Marker({element, anchor: now.anchor, offset: now.offset, draggable: now.draggable}).setLngLat(now.lngLat).addTo(map);
                    // (The callbacks of the latest options run, so that a framework can pass a new function each render.)
                    const at = (): Position => { const p = m.getLngLat(); return [p.lng, p.lat]; };
                    m.on('dragstart', () => now.onDragStart?.(at())); m.on('drag', () => now.onDrag?.(at())); m.on('dragend', () => now.onDragEnd?.(at()));
                    return m;
                }
                const p = new Popup({anchor: now.anchor, offset: now.offset, closeButton: !!now.onClose, closeOnClick: false}).setLngLat(now.lngLat).setDOMContent(element).addTo(map);
                p.on('close', () => { if (made === p) now.onClose?.(); });
                return p;
            };
            let made: Marker | Popup | null = make();
            return {
                update(next) {
                    const again = !!next.popup !== !!now.popup || next.anchor !== now.anchor || String(next.offset) !== String(now.offset) || !!next.onClose !== !!now.onClose;
                    // (Only a new position moves the element: a render during or after a drag that passes the same
                    // `lngLat` again leaves it where the user put it.)
                    const moved = String(next.lngLat) !== String(now.lngLat);
                    now = next;
                    if (!made) return;
                    if (again) { const old = made; made = null; old.remove(); made = make(); return; }
                    if (made instanceof Marker) made.setDraggable(!!next.draggable);
                    if (moved) made.setLngLat(next.lngLat);
                },
                remove() { const old = made; made = null; old?.remove(); },
            };
        },
        listen(type, fn: (event: any) => void) { const w = (e: any) => fn(hostEvent(e)); map.on(type, w); return () => { map.off(type, w); }; },
        once(type) {
            return new Promise<any>((resolve, reject) => {
                const removed = () => new Error(`[map-jr-gl] once("${type}"): the map was removed.`);
                if (!alive) return reject(removed());
                if (type === 'load' && state.get().loaded) return resolve({type, target: host});
                const fn = (event: any) => { map.off(type, fn); waiting.delete(drop); resolve(hostEvent(event)); };
                const drop = () => { map.off(type, fn); reject(removed()); };
                waiting.add(drop); map.on(type, fn);
            });
        },
        container: map.getContainer(),
        _map: map,
    };
    return host;
}
