/**
 * The main API of the library: a map is made from one description (`MapDescription`), and is changed by giving a new
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
import {Marker, Popup, part} from './overlays.ts';
import {dataTypeError, extended, isStylePair, styleFor, withData, type Anchor} from './markers.ts';
import type {QueriedFeature} from './query.ts';
import type {Control, ControlPosition} from './controls.ts';
import type {Checked} from './mistakes.ts';
import {fontFaces, type FontFaces} from './resolve.ts';
import type {LngLatBoundsInput} from './lnglat.ts';
import type {PaddingInput} from './geo.ts';
import type {BackgroundLayerSpecification, CircleLayerSpecification, ColorReliefLayerSpecification, FillExtrusionLayerSpecification, FillLayerSpecification, HeatmapLayerSpecification, HillshadeLayerSpecification, LineLayerSpecification, ProjectionSpecification, RasterLayerSpecification, SourceSpecification, StyleSpecification, SymbolLayerSpecification, TerrainSpecification} from './compat-types.ts';

/**
 * Set by the build (`define` in build.mjs). True in the development build (`dist/*.dev.js`, which the `development`
 * condition of package.json names) and in the standalone file; false in the production build.
 */
declare const __DEV__: boolean;

/** The description of a control: see `@map-jr/map-jr-gl/controls`. Controls with the same `key` are the same control. */
export interface ControlSpec { key: string; position?: ControlPosition; create(instance?: () => MapInstance): Control }

/**
 * A position that the application gives: `[lng, lat]`. It is `readonly number[]` and not a pair, because TypeScript
 * gives an array that is declared apart from its use (`const NYC = [-74, 40.7]`) the type `number[]`. A position
 * that the map gives (`state.view.center`, the result of `unproject`) is `[number, number]`.
 */
export type Position = readonly number[];
/**
 * A box of the main API: `[[west, south], [east, north]]` or `[west, south, east, north]`, in degrees. (The map also
 * reads `LngLat` and `LngLatBounds` objects at run time, but the types of the main API take arrays only.)
 */
export type Bounds = readonly [Position, Position] | readonly [number, number, number, number];
/** A GeoJSON geometry (RFC 7946). */
export type GeoJSONGeometry =
    | {type: 'Point'; coordinates: Position} | {type: 'MultiPoint'; coordinates: readonly Position[]}
    | {type: 'LineString'; coordinates: readonly Position[]} | {type: 'MultiLineString'; coordinates: readonly (readonly Position[])[]}
    | {type: 'Polygon'; coordinates: readonly (readonly Position[])[]} | {type: 'MultiPolygon'; coordinates: readonly (readonly (readonly Position[])[])[]}
    | {type: 'GeometryCollection'; geometries: readonly GeoJSONGeometry[]};
/** A GeoJSON feature (RFC 7946). `properties` is any object, so an interface of the application fits. */
export interface GeoJSONFeature { type: 'Feature'; id?: string | number; geometry: GeoJSONGeometry | null; properties: object | null }
/** GeoJSON (RFC 7946): a feature collection, a feature or a geometry. */
export type GeoJSON = {type: 'FeatureCollection'; features: readonly GeoJSONFeature[]} | GeoJSONFeature | GeoJSONGeometry;
/**
 * A layer of the field `layers` of `MapDescription`: a style layer of one of the types that the library draws, with
 * `before`. TypeScript checks `type` and the prefix of each name in `paint` and `layout`.
 */
export type LayerInput = (BackgroundLayerSpecification | FillLayerSpecification | FillExtrusionLayerSpecification | LineLayerSpecification | CircleLayerSpecification | HeatmapLayerSpecification | RasterLayerSpecification | HillshadeLayerSpecification | ColorReliefLayerSpecification | SymbolLayerSpecification) & {before?: string};
/** A cluster or a point that the cluster methods of `MapInstance` return, as GeoJSON in longitude and latitude. */
export interface ClusterFeature {type: 'Feature'; id?: string | number; properties: Record<string, unknown>; geometry: {type: 'Point'; coordinates: [number, number]}}
/**
 * Where the camera is. `bounds` is `[[west, south], [east, north]]`: the smallest box that contains the visible map,
 * as `getBounds()` gives it in MapLibre GL JS.
 */
export interface View { center: [number, number]; zoom: number; bearing: number; pitch: number; bounds: [[number, number], [number, number]] }
/** A view that the application gives: each field is optional. */
export interface ViewInput { center?: Position; zoom?: number; bearing?: number; pitch?: number }
/**
 * A view to go to, for `initialView` and `moveTo`. `bounds` ([west, south, east, north] or [[west, south], [east, north]])
 * is fitted into the map and takes the place of `center` and `zoom`, as in MapLibre GL JS. `padding` (CSS pixels, default
 * 0) is space around `bounds` for this one fit, on top of the padding of the description, and `maxZoom` limits the zoom
 * of the fit. Without `bounds`, `padding` and `maxZoom` have no effect.
 */
export interface InitialView extends ViewInput { bounds?: Bounds; padding?: PaddingInput; maxZoom?: number }
/** The argument of `moveTo`: a view or `bounds` (as in `initialView`), with `duration` in milliseconds and `fly`. */
export interface MoveToOptions extends InitialView { duration?: number; fly?: boolean | FlyOptions }
/** Where the pointer is over the map: `point` in CSS pixels from the top left corner of the map, `lngLat` as `[lng, lat]`. */
export interface PointerPosition { point: {x: number; y: number}; lngLat: [number, number] }
export interface MapPointer { point: {x: number; y: number}; lngLat: [number, number]; /** The features of `interactiveLayers` at the point, the top one first. */ features: RenderedFeature[] }

/** The fields of `MapDescription` that add to the parts of the style: `sources`, `layers` and `terrain`. */
type StyleParts = Pick<MapDescription, 'sources' | 'layers' | 'terrain'>;
const parts = (s: MapDescription): StyleParts => ({sources: s.sources, layers: s.layers, terrain: s.terrain});

/** What an image is made from: an SVG document, the URL of an image, or an object that a canvas can draw (an `ImageBitmap`, a canvas, `ImageData`). */
export type ImageSource = Parameters<Map['addImage']>[1];
/**
 * An image of the field `images` of `MapDescription`: an `ImageSource`, or an object with the source as `image` and the
 * options of the image (`width` and `height` in CSS pixels, `pixelRatio`, and the options for an icon that fits text).
 */
export type ImageInput = ImageSource | ({image: ImageSource} & ImageOptions);

/** The description of a map. Each field can change in `update`, but for those of `MapSetup`. */
export interface MapDescription extends MapSetup {
    /**
     * A style object or the URL of a style (the MapLibre style specification). A new object or URL is a new style.
     * A pair `{light, dark}` of two styles (objects or URLs) uses the style of the resolved `colorScheme`, and changes
     * to the other style when the scheme changes. Each change of scheme loads that style again, as a new style does.
     */
    style: string | StyleSpecification | {light: string | StyleSpecification; dark: string | StyleSpecification};
    /**
     * Sources to add to the sources of the style, by id. A source here replaces the source of the style that has the
     * same id. They are added when the style has loaded, so a style from a URL can have them too.
     */
    sources?: Record<string, SourceSpecification>;
    /**
     * Layers to add to the layers of the style: they do not replace them. A layer with `before` goes below the layer
     * of the style with that id, and a layer without it goes on top.
     */
    layers?: LayerInput[];
    /**
     * 3D terrain from an elevation source, `{source: 'dem', exaggeration: 1.5}`, in place of the terrain of the style.
     * `null` means no 3D terrain (a flat map), also when the style has a `terrain`. No field, or `undefined`, means the terrain of the style.
     */
    terrain?: TerrainSpecification | null;
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
    data?: Record<string, GeoJSON | string>;
    /**
     * Images for `icon-image` of style layers, by name: `{pin: '<svg ...>...</svg>'}`. A
     * value is an SVG document, the URL of an image, or `{image, width, height}`. An image of this field is used in
     * place of an image of the sprite that has the same name.
     */
    images?: Record<string, ImageInput>;
    /**
     * Sprites to add to the sprite of the style: `[{id: 'pins', url: 'https://example.com/sprites/pins'}]`, as the list
     * form of `sprite` in the style specification. The URL has no extension: the map loads `url + '.json'` and
     * `url + '.png'` (`@2x` on a screen with a pixel ratio above 1). An `icon-image` names an image of such a sprite as
     * `id:name` (`pins:hotel`). A sprite here replaces a sprite of the style with the same id, and the id `default`
     * replaces the sprite of a style whose `sprite` is one URL. A change of this field loads the style again.
     */
    sprite?: {id: string; url: string}[];
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
    /** Called for each error of the map. Without it, the map writes each error to the console. */
    onError?: (error: Error) => void;
    minZoom?: number; maxZoom?: number; maxPitch?: number; maxBounds?: Bounds | null;
    /** The mouse cursor over the map. Without it, the cursor is a pointer over a feature of `interactiveLayers`. */
    cursor?: string;
    /**
     * `true`: the wheel zooms the map only with Ctrl (⌘ on a Mac), one finger scrolls the page and two fingers move the
     * map. A blocked gesture shows a hint over the map. For a map in a page that scrolls. The default is `false`.
     */
    cooperativeGestures?: boolean;
    /**
     * The colours of the controls, the popup, the attribution and the message of a browser without WebGL 2: `'light'`
     * (the default), `'dark'`, or `'auto'`, which follows `prefers-color-scheme` of the browser and changes with it.
     * The container has the class `map-jr-dark` while the scheme is dark. The resolved scheme is also the global
     * state property `color-scheme` of the style (`['global-state', 'color-scheme']`), unless `globalState` gives it.
     */
    colorScheme?: 'auto' | 'light' | 'dark';
    /**
     * Called when the control `colorScheme()` changes `colorScheme`, with the new value. The control has changed the
     * map already (with `patch`); an application that keeps the description in its state writes the value back.
     */
    onColorSchemeChange?: (colorScheme: 'auto' | 'light' | 'dark') => void;
    /**
     * The texts of the controls, the popup, the marker and the hint of `cooperativeGestures`, by the keys of MapLibre GL
     * JS: `{'NavigationControl.ZoomIn': 'Zoom avant'}`. A key that is left out keeps the English text. The library
     * ships no translations. A change of this field adds the controls again with the new texts.
     */
    locale?: Record<string, string>;
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
/** The options of the built-in attribution (`attribution` of the description). */
export interface AttributionOptions {
    /** Whether the attribution is a button that opens the credits. @default true when the map is 640 CSS pixels wide or narrower, else false */
    compact?: boolean;
    /** Credits that the attribution shows after the credits of the sources of the style. */
    customAttribution?: string | string[];
}
/** The fields that are read when the map is made only. */
export interface MapSetup {
    renderer?: 'auto' | 'worker' | 'main';
    fontFamily?: string;
    interactive?: boolean;
    antialias?: boolean;
    /** `false` hides the built-in attribution, so that the page shows the credits itself. */
    attribution?: false | AttributionOptions;
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
    /** The colour scheme of the controls: `colorScheme` of the description, with `'auto'` resolved. */
    colorScheme: 'light' | 'dark';
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

/** What each event of `listen` has: its type, and the `MapInstance` that fired it. */
export interface MapEventBase<T extends string = string> { type: T; target: MapInstance }
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
    /** `error` is usually an `Error`. (`onError` always has an `Error`.) */
    error: MapEventBase<'error'> & {error: unknown};
}

export interface MapInstance {
    /** Changes the map to a new description. Give the complete description each time: a description with no `style` throws. */
    update(spec: MapDescription): void;
    /** Changes only the fields of `part`: `map.update({...map.description, ...part})`. A field of `part` that is `undefined` is removed. */
    patch(part: Partial<MapDescription>): void;
    /** The description of the last `createMap`, `update` or `patch`. Read only: change the map with `update` or `patch`. */
    readonly description: Readonly<MapDescription>;
    /**
     * For reading: the description with `style` as a copy of the style that the map loaded (the description's `style`
     * before the first `style.load`) and `globalState` as the global state in effect. Do not pass it to `update`.
     */
    getResolvedDescription(): MapDescription;
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
     * on the way, and without `duration` the duration follows from the distance. With `bounds`, the camera goes to the
     * box fitted with `padding` and `maxZoom`. `moveTo` does not change the padding of the map: that is `padding` of the description.
     */
    moveTo(view: MoveToOptions): void;
    /** The short form of `moveTo({bounds, ...options})`, with `duration` 800 ms by default. */
    fitBounds(bounds: Bounds, options?: Omit<MoveToOptions, 'bounds' | 'center' | 'zoom'>): void;
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
function complete(spec: MapDescription, method: string, fix: string) {
    if (!spec?.style) throw new Error(`[map-jr-gl] ${method}(): the description has no "style". ${fix}`);
}

/**
 * The popup of the main API. The box and its tip are one shape, so that one background with the blur and one shadow go
 * around both. The box clips itself to the shape (its border on the side of the tip is the room of the tip), and a
 * layer behind it draws the shadow of the same shape, cut out where the box is: a shadow under the translucent box would
 * show through it, and a `filter` on an element above the box would stop the blur of its background.
 */
class GlassPopup extends Popup {
    protected outline() {
        const b = this.box;
        if (!b.isConnected) return;
        const s = this.shade ??= this.el.insertBefore(document.createElement('div'), b);
        if (!s.firstChild) { s.className = 'map-jr-popup-shadow'; s.appendChild(document.createElement('div')); new ResizeObserver(() => this.outline()).observe(b); }
        const side = b.dataset.side!, w = b.offsetWidth, h = b.offsetHeight, P = 24, T = side === 'center' ? 0 : 8;
        const across = side === 'left' || side === 'right', L = across ? h : w, D = across ? w : h, B = D - T;
        const r = Math.min(parseFloat(getComputedStyle(b).borderTopLeftRadius) || 0, B / 2, L / 2), x = part(this.anchor)[0];
        const c = Math.min(Math.max(across ? L / 2 : x * L / 100 + 20 - x * .4, r + 8), L - r - 8);
        // (The points are written for a tip at the bottom: u along the side of the tip, v towards it.)
        const at = (o: number, ...uv: number[]) => {
            let out = '';
            for (let i = 0; i < uv.length; i += 2) {
                const u = uv[i], v = uv[i + 1];
                out += ' ' + (side === 'top' ? [u, D - v] : side === 'right' ? [v, u] : side === 'left' ? [D - v, u] : [u, v]).map(n => +(n + o).toFixed(2)).join(' ');
            }
            return out;
        };
        const shape = (o: number) => `M${at(o, r, 0)}L${at(o, L - r, 0)}Q${at(o, L, 0, L, r)}L${at(o, L, B - r)}Q${at(o, L, B, L - r, B)}` +
            (T ? `L${at(o, c + 8, B)}L${at(o, c + 1.5, D - 1.3)}Q${at(o, c, D, c - 1.5, D - 1.3)}L${at(o, c - 8, B)}` : '') +
            `L${at(o, r, B)}Q${at(o, 0, B, 0, B - r)}L${at(o, 0, r)}Q${at(o, 0, 0, r, 0)}Z`;
        b.style.clipPath = `path('${shape(0)}')`;
        Object.assign(s.style, {left: b.offsetLeft - P + 'px', top: b.offsetTop - P + 'px', width: w + 2 * P + 'px', height: h + 2 * P + 'px', clipPath: `path(evenodd,'M0 0H${w + 2 * P}V${h + 2 * P}H0Z${shape(P)}')`});
        (s.firstChild as HTMLElement).style.clipPath = `path('${shape(P)}')`;
    }
}

export function createMap(container: HTMLElement | string, spec: MapDescription): MapInstance { return makeMap(container, spec, 'createMap()'); }

/** `createMap` for the adapters: `name` is what the user wrote (`<MapJr>`, `useMapJr()`), for the warnings that name it. */
export function makeMap(container: HTMLElement | string, spec: MapDescription, name: string): MapInstance {
    complete(spec, 'createMap', 'Pass the URL of a style or a style object as "style".');
    if (!container) throw new Error('[map-jr-gl] createMap(): the container is ' + container + '. In a framework, make the map after the element is mounted.');
    if (typeof container === 'string' && !document.getElementById(container)) throw new Error(`[map-jr-gl] createMap(): no element with the id "${container}".`);
    const {bounds, padding, maxZoom, ...first} = {...spec.initialView, ...spec.view} as InitialView & {bounds?: unknown};
    const options: MapOptions = {
        container, style: spec.style, center: first.center, zoom: first.zoom, bearing: first.bearing, pitch: first.pitch,
        // (A `view` from the state has `bounds` too: it is a view, and only `initialView` gives a box to fit.)
        bounds: spec.view ? undefined : bounds as LngLatBoundsInput, fitBoundsOptions: {padding, maxZoom}, renderer: spec.renderer, fontFamily: spec.fontFamily, interactive: spec.interactive, antialias: spec.antialias, hash: spec.hash, nonce: spec.nonce,
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
    // (The controls read their texts through `ui()` of controls.ts, which calls this. `latest` is the last description.)
    (map as {_getUIString?(k: string): string | undefined})._getUIString = k => latest.locale?.[k];
    // The look of the controls of the main API (the class map-jr-glass, see controls.ts). The compat entry does not set it.
    const box = map.getContainer();
    // A popup of overlay() takes the focus when it opens within a second of a key press on the map, with no pointer
    // input in between (#866): the application opens the popup itself, so the last input on the container tells how.
    let keyAt = -1e9;
    const input = (e: Event) => { keyAt = e.type === 'keydown' ? performance.now() : -1e9; };
    box.addEventListener('keydown', input, true); box.addEventListener('pointerdown', input, true);
    box.classList.add('map-jr-glass');
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
    // (The canvas is read each time: a fall back from the worker to the main thread replaces it; #777.)
    const touchAction = map.getCanvas().style.touchAction;
    const cooperate = (on: boolean) => {
        cooperating = on;
        if (!on) { stop?.(); stop = map.gate = undefined; map.getCanvas().style.touchAction = touchAction; return; }
        map.getCanvas().style.touchAction = 'pan-x pan-y';
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
    // An image of the style is drawn when a layer asks for it (`asked` has the names), so that a style with many images
    // does not keep the page busy before the first tiles are requested (#628). `styleCode` is the load of the code.
    let fromStyle: Record<string, ImageInput> = {}, wantedImages = spec.images, styleTurn = 0, asked = new Set<string>(), styleCode: Promise<unknown> | undefined;
    const adding = new globalThis.Map<string, Promise<unknown>>();
    const absolute = (faces: FontFaces | undefined) => { const out: FontFaces = {}; for (const f of fontFaces(faces, document.baseURI)) ((out[f.name!] ??= []) as {url: string; 'unicode-range'?: string[]}[]).push({url: f.src, ...(f.unicodeRange ? {'unicode-range': f.unicodeRange.split(', ')} : {})}); return out; };
    const typeError = (id: string, type: string) => setTimeout(() => { if (alive) map.fire('error', {error: dataTypeError(id, type)}); });
    // `style: {light, dark}`: the scheme of the style that the map has (`colorScheme` resolved), and the last description.
    let styledDark = false, latest = spec;
    const darkOf = (to: MapDescription['colorScheme']) => to === 'dark' || to === 'auto' && !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const restyle = (next: MapDescription) => { styled = false; styledDark = darkOf(next.colorScheme); map.setStyle(styleFor(next.style, styledDark) as MapOptions['style'], {transformStyle: (_, style) => {
        styled = true;
        baseSources = style.sources ?? {};
        styleProjection = style.projection;
        // (The code for the images of a style is loaded only for a style that has them. After it has loaded, the map must
        // still exist and the style must not have been replaced.)
        const turn = ++styleTurn, given = style.metadata?.['map-jr:images'];
        fromStyle = {};
        asked = new Set();
        adding.clear();
        putImages();
        styleCode = given == null ? undefined : import('./style-images.ts').then(m => {
            if (!alive || turn !== styleTurn) return;
            fromStyle = m.styleImages(style, message => { if (alive) map.fire('error', {error: new Error(message)}); }, asked);
            putImages();
        }, () => { if (alive && turn === styleTurn) map.fire('error', {error: new Error('[map-jr-gl] the style: the code for the images in metadata["map-jr:images"] did not load, and the map draws the style without them. Check that the files of the library are served next to it.')}); });
        // (The description of this moment: it can have changed while the style loaded.)
        if (wantedProjection) style = {...style, projection: copy(wantedProjection)};
        if (wantedFonts) style = {...style, 'font-faces': {...style['font-faces'], ...absolute(wantedFonts)}} as typeof style;
        // (The sources of the new style have no data of the description yet: data that was given since `restyle` went to
        // the sources of the style before. It is given again when the new style is there: see `giveData`.)
        sent.clear();
        check(4, style, parts(next));
        // (A URL of `sprite` that is relative is relative to the page, and the style has its own base.)
        const sprite = Array.isArray(next.sprite) ? next.sprite.map(({id, url}) => ({id, url: new URL(url, document.baseURI).href})) : undefined;
        const made = withData(extended(style, {...parts(next), layers: next.layers && copy(next.layers), sprite}), wantedData, false, typeError);
        madeData.clear();
        for (const id in wantedData) if (!Object.hasOwn(style.sources ?? {}, id) && !Object.hasOwn(next.sources ?? {}, id)) madeData.add(id);
        return made;
    }}); };
    restyle(spec);
    // (The height of the container is read after a second, so that a container which gets its height a moment later gives no warning.)
    setTimeout(() => check(0, name), 1000);
    const viewOf = (): View => { const c = map.getCenter(), b = map.getBounds().toArray() as View['bounds']; return {center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch(), bounds: b}; };
    const state = createStore<MapState>({loaded: false, idle: false, moving: false, view: viewOf(), hover: [], pointer: null, renderer: undefined, colorScheme: 'light'});
    const controls = new globalThis.Map<string, ReturnType<ControlSpec['create']>>();
    // `colorScheme`: the class `map-jr-dark` on the container. With `'auto'`, a listener of the media query, which `destroy()` removes.
    let wanted: MapDescription['colorScheme'], dark: MediaQueryList | undefined;
    // The resolved scheme is also the global state property `color-scheme` (#492), unless `globalState` gives that name.
    let forced = false, schemeSent: string | undefined;
    const paint = () => {
        const on = wanted === 'dark' || wanted === 'auto' && !!dark?.matches;
        map.getContainer().classList.toggle('map-jr-dark', on);
        state.set({colorScheme: on ? 'dark' : 'light'});
        if (!forced && schemeSent !== (schemeSent = on ? 'dark' : 'light')) map.setGlobalStateProperty('color-scheme', schemeSent);
        if (isStylePair(latest.style) && on !== styledDark && alive) { state.set({idle: false}); sent.clear(); restyle(latest); }
    };
    const scheme = (to: MapDescription['colorScheme']) => {
        wanted = to;
        dark ??= globalThis.matchMedia?.('(prefers-color-scheme: dark)');
        dark?.removeEventListener('change', paint);
        if (to === 'auto') dark?.addEventListener('change', paint);
        paint();
    };
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

    // The features under the pointer: one query at a time and at most one in a frame (#694). The moves of a frame make
    // one query for the last of them, and the last position is asked again when it has changed during a query.
    const hover = async () => {
        if (asking || !alive) return;
        asking = true;
        while (alive) {
            await new Promise(r => requestAnimationFrame(r));
            if (!alive) break;
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
    // style: a changed `terrain`, a changed source, a source id that the style has, a changed `type`, `source` or
    // `source-layer` of a layer. A changed `minzoom` or `maxzoom` goes to `setLayerZoomRange` (#871). A new order of the layers, a new layer before one that stays
    // and another `before` move the layers of `layers` (#859).
    const edit = (next: StyleParts, before: StyleParts, differ: (a: unknown, b: unknown) => boolean) => {
        const was = before.layers ?? [], is = next.layers ?? [], ns = next.sources ?? {}, os = before.sources ?? {};
        const ids = (a: typeof is, b: typeof is) => a.filter(l => b.some(x => x.id === l.id)).map(l => l.id).join('\n');
        const kept = is.filter(l => was.some(w => w.id === l.id)), keys = ['paint', 'layout', 'filter', 'minzoom', 'maxzoom', 'id', 'before'];
        if (differ(next.terrain, before.terrain)) return false;
        // (A new order, a new layer before one that stays, or another `before`: the layers of `layers` are added again
        // in their order, with the rule of `extended()`, as the style would have them (#859).)
        const moved = ids(is, was) !== ids(was, is) || is.some((l, i) => !kept.includes(l) && i < is.indexOf(kept[kept.length - 1])) || kept.some(l => differ(l.before, was.find(x => x.id === l.id)!.before));
        for (const id in ns) if (id in os ? differ(ns[id], os[id]) : map.getSource(id)) return false;
        for (const id in {...ns, ...os}) if (Object.hasOwn(baseSources, id)) return false;
        for (const l of kept) { const w = was.find(x => x.id === l.id)!; if (Object.keys({...l, ...w}).some(k => !keys.includes(k) && differ((l as Record<string, unknown>)[k], (w as Record<string, unknown>)[k]))) return false; }
        for (const w of was) if (!kept.some(l => l.id === w.id)) map.removeLayer(w.id);
        for (const id in os) if (!(id in ns)) { sent.delete(id); map.removeSource(id); }
        for (const id in ns) if (!(id in os)) { sent.delete(id); map.addSource(id, ns[id]); }
        if (moved) for (const l of kept) map.removeLayer(l.id);
        else for (const l of kept) {
            const w = was.find(x => x.id === l.id)!;
            for (const g of ['paint', 'layout'] as const) {
                const a = (l[g] ?? {}) as Record<string, unknown>, b = (w[g] ?? {}) as Record<string, unknown>;
                for (const k in {...a, ...b}) if (differ(a[k], b[k])) (g === 'paint' ? map.setPaintProperty : map.setLayoutProperty).call(map, l.id, k, a[k]);
            }
            if (differ(l.filter, w.filter)) map.setFilter(l.id, l.filter);
            if (differ(l.minzoom, w.minzoom) || differ(l.maxzoom, w.maxzoom)) map.setLayerZoomRange(l.id, l.minzoom, l.maxzoom);
        }
        for (const {before: at, ...l} of is) if (moved || !kept.some(k => k.id === l.id)) map.addLayer(copy(l) as {id: string}, at && map.getLayer(at) ? at : undefined);
        giveData();
        return true;
    };

    // A new style object that differs from the old one only in the `paint`, `layout` and `filter` of its layers goes to
    // the map as edits, as `setStyle(style, {diff: true})` of MapLibre GL JS does (#858). A layer that is new or removed,
    // and a new order of the layers, are edits too (#875). It returns false, with nothing changed, when anything else
    // differs: a key of the style other than `layers`, a new layer whose source the map does not have, or another key of
    // a layer that stays. A changed `minzoom` or `maxzoom` goes to `setLayerZoomRange` (#871).
    const editStyle = (next: unknown, before: unknown, differ: (a: unknown, b: unknown) => boolean) => {
        type L = Record<string, unknown> & {id: string; paint?: Record<string, unknown>; layout?: Record<string, unknown>};
        const a = styleFor(next, styledDark) as Record<string, unknown>, b = styleFor(before, styledDark) as Record<string, unknown>;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || !Array.isArray(a.layers) || !Array.isArray(b.layers)) return false;
        const is = a.layers as L[], was = b.layers as L[], keys = ['paint', 'layout', 'filter', 'minzoom', 'maxzoom'];
        if (Object.keys({...a, ...b}).some(k => k !== 'layers' && differ(a[k], b[k]))) return false;
        if (is.some(l => !l || typeof l.id !== 'string') || new Set(is.map(l => l.id)).size !== is.length) return false;
        const old = (id: string) => was.find(w => w?.id === id), kept = is.filter(l => old(l.id));
        for (const l of is) {
            const w = old(l.id);
            if (w ? !map.getLayer(l.id) || Object.keys({...l, ...w}).some(k => !keys.includes(k) && differ(l[k], w[k])) : map.getLayer(l.id) || typeof l.source === 'string' && !map.getSource(l.source)) return false;
        }
        // (The layers stay in place when the kept layers keep their order and every new layer comes after them.
        // Otherwise the layers of the style are added again in their order, before the first layer that the application
        // added after them, if any.)
        const order = (x: L[]) => x.filter(l => l && (x === is ? old(l.id) : is.some(n => n.id === l.id))).map(l => l.id).join('\n');
        const last = kept.length ? is.indexOf(kept[kept.length - 1]) : -1;
        const moved = order(is) !== order(was) || is.some((l, i) => !old(l.id) && i < last);
        const live = moved || kept.length < is.length ? (map.getStyle()!.layers as {id: string}[]).map(l => l.id) : [] as string[], ids = new Set(was.map(w => w?.id));
        const anchor = live.slice(live.findLastIndex(id => ids.has(id)) + 1).find(id => !ids.has(id));
        for (const w of was) if (w && !is.some(l => l.id === w.id) && map.getLayer(w.id)) map.removeLayer(w.id);
        if (moved) for (const l of kept) map.removeLayer(l.id);
        else for (const l of kept) {
            const w = old(l.id)!;
            for (const g of ['paint', 'layout'] as const) {
                const x = l[g] ?? {}, y = w[g] ?? {};
                for (const k in {...x, ...y}) if (differ(x[k], y[k])) (g === 'paint' ? map.setPaintProperty : map.setLayoutProperty).call(map, l.id, k, x[k] === undefined ? undefined : copy(x[k]));
            }
            if (differ(l.filter, w.filter)) map.setFilter(l.id, l.filter === undefined ? undefined : copy(l.filter) as any);
            if (differ(l.minzoom, w.minzoom) || differ(l.maxzoom, w.maxzoom)) map.setLayerZoomRange(l.id, l.minzoom as number | undefined, l.maxzoom as number | undefined);
        }
        for (const l of is) if (moved || !old(l.id)) map.addLayer(copy(l) as {id: string}, anchor);
        return true;
    };

    // Gives the map the images of the style and of the description, and removes those that neither has now.
    const putImages = (only?: string) => {
        const wanted: Record<string, ImageInput> = {};
        for (const name of asked) if (Object.hasOwn(fromStyle, name)) wanted[name] = fromStyle[name];
        Object.assign(wanted, wantedImages);
        for (const name of images.keys()) if (!Object.hasOwn(wanted, name)) { images.delete(name); map.removeImage(name); }
        for (const name in wanted) {
            const v = wanted[name], key = imageKey(v);
            if (images.has(name) && images.get(name) === key) continue;
            if (images.has(name)) map.removeImage(name);
            images.set(name, key);
            const spec = v && typeof v === 'object' && 'image' in v ? v : null;
            // (An image that does not load is an error of the map, and the map goes on without it.)
            const p = map.addImage(name, spec ? spec.image : v as ImageSource, spec ?? {}).then(busy, () => {
                if (alive && images.get(name) === key) map.fire('error', {error: new Error(`[map-jr-gl] ${Object.hasOwn(wantedImages ?? {}, name) ? 'images' : 'the style'}: the image "${name}" did not load. Give an SVG document or the URL of an image that the page can read.`)});
            });
            adding.set(name, p);
        }
        return only && adding.get(only);
    };
    // (The map asks for an image that a layer names and that it does not have. The answer waits for the code of the images.)
    map.setMissingStyleImageResolver(name => { asked.add(name); return Promise.resolve(styleCode).then(() => putImages(name)) as Promise<void>; });
    // A change that gave the engine work makes the map not idle until the engine reports idle again (#411).
    const busy = () => { if (alive && state.get().idle && !map.areTilesLoaded()) state.set({idle: false}); };
    const apply = (next: MapDescription, before?: MapDescription) => {
        // (A description that is made again each time, as in a template of a framework, has new objects with the same
        // content. So where the identity is different, the content is compared before the map does work.)
        const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);
        wantedProjection = next.projection;
        wantedData = next.data;
        latest = next;
        wantedFonts = next.fonts;
        // (A new key of `data` makes its source before the edits of `sources` and `layers`, which can add a layer that names it.)
        if (styled && before) for (const id in next.data) {
            const s = map.getSource(id) as {type?: string} | undefined;
            if (!s) { madeData.add(id); map.addSource(id, {type: 'geojson', data: {type: 'FeatureCollection', features: []}}); }
            else if (!(id in (before.data ?? {})) && s.type !== 'geojson') typeError(id, s.type!);
        }
        // (After a new style the data waits for the `styledata` event: the engine must have the new style first.)
        const restyled = !!before && (differ(next.style, before.style) && !(styled && editStyle(next.style, before.style, differ)) || (['sources', 'layers', 'terrain'] as const).some(k => differ(next[k], before[k])) && !(styled && edit(parts(next), parts(before), differ)) || differ(next.sprite, before.sprite));
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
        if (differ(next.maxBounds, before?.maxBounds)) map.setMaxBounds(next.maxBounds as LngLatBoundsInput | null | undefined);
        if (differ(next.padding, before?.padding)) map.jumpTo({padding: next.padding ?? 0});
        // (Before the style is there, the style gets the projection of the description when it comes: see `restyle`.)
        // (The map keeps these values across a new style; only the names whose values changed are set.)
        forced = next.globalState?.['color-scheme'] != null;
        if (forced) schemeSent = undefined;
        for (const name of new Set([...Object.keys(next.globalState ?? {}), ...Object.keys(before?.globalState ?? {})])) {
            const value = next.globalState?.[name] ?? (name === 'color-scheme' ? (schemeSent = state.get().colorScheme) : undefined);
            if (differ(value, before?.globalState?.[name])) map.setGlobalStateProperty(name, value == null ? null : copy(value));
        }
        if (before && styled && !restyled && differ(next.projection, before.projection)) map.setProjection(next.projection ? copy(next.projection) : styleProjection);
        // (A new `locale` adds every control again: some controls set their texts only when they are added.)
        const relabel = differ(next.locale, before?.locale);
        if (relabel && before) map.fire('_locale');
        if (next.controls !== before?.controls || relabel) {
            const wanted = new Set(relabel ? [] : (next.controls ?? []).map(c => c.key));
            for (const [key, c] of controls) if (!wanted.has(key)) { map.removeControl(c as any); controls.delete(key); }
            for (const c of next.controls ?? []) if (!controls.has(c.key)) { const made = c.create(() => host); controls.set(c.key, made); map.addControl(made, c.position); }
        }
        transformLast = next.transformRequest;
        if (before && !next.transformRequest !== !before.transformRequest) map.setTransformRequest(next.transformRequest ? transform : null);
        if (next.cursor !== before?.cursor) map.setCursor(next.cursor ?? '');
        wantedImages = next.images;
        if (next.images !== before?.images) putImages();
        if (!next.cooperativeGestures !== !before?.cooperativeGestures) cooperate(!!next.cooperativeGestures);
        if (next.colorScheme !== before?.colorScheme || !before) scheme(next.colorScheme);
        if (differ(next.interactiveLayers, before?.interactiveLayers) || !next.hoverState !== !before?.hoverState) hover();
        check(2, next, before);
        now = next;
        if (next.data !== before?.data && !restyled) giveData();
        busy();
    };
    apply(spec);

    const moveTo: MapInstance['moveTo'] = ({duration, fly, bounds, padding, maxZoom, ...view}) => {
        // (`padding` is space for this one fit; the padding of the map belongs to the description.)
        if (bounds) { const fit = map.cameraForBounds(bounds as LngLatBoundsInput, {padding, maxZoom}); view = {bearing: fit.bearing, ...view, center: [fit.center.lng, fit.center.lat], zoom: fit.zoom}; }
        else if (padding !== undefined || maxZoom !== undefined) check(7);
        if (fly) map.flyTo({...view, duration, ...(fly === true ? {} : fly)}); else if (duration) map.easeTo({...view, duration}); else map.jumpTo(view);
    };
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
    // (The cluster methods of the core source, with a message that names the method of the map (`MapInstance`).)
    const cluster = (name: string, id: string, run: (source: any) => Promise<any>) => Promise.resolve().then(() => {
        const source = map.getSource(id) as any;
        if (!source?.getClusterLeaves) throw new Error(`"${id}" is not a GeoJSON source of the style.`);
        return run(source);
    }).catch(e => { throw new Error(`[map-jr-gl] ${name}(): ${(e as Error)?.message?.replace(/^\[map-jr-gl\] /, '')}`); });
    // An event of the core map as the `MapInstance` gives it: positions as `[lng, lat]`, and the `MapInstance` as `target`. The
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

    // (`_map`, the core map, is private: it is not in the type `MapInstance`, and the tests and the library read it.)
    const host: MapInstance & {readonly _map: Map} = {
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
        getResolvedDescription: () => ({...now, style: map.getStyle() as StyleSpecification ?? now.style, globalState: copy(map.getGlobalState())}),
        destroy() { if (!alive) return; alive = false; cooperate(false); box.removeEventListener('keydown', input, true); box.removeEventListener('pointerdown', input, true); dark?.removeEventListener('change', paint); map.remove(); box.classList.remove('map-jr-glass', 'map-jr-dark'); for (const drop of waiting) drop(); waiting.clear(); },
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
        moveTo,
        fitBounds: (bounds, o = {}) => moveTo({duration: 800, ...o, bounds}),
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
                const p = new GlassPopup({anchor: now.anchor, offset: now.offset, closeButton: !!now.onClose, closeOnClick: false}).setLngLat(now.lngLat).setDOMContent(element).addTo(map);
                // (`destroy()` closes the popup with the map. That is not the user's close, so `onClose` does not run.)
                p.on('close', () => { if (alive && made === p) now.onClose?.(); });
                // (Escape or the button then returns the focus to the element that had it, else to the map.)
                const active = (box.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
                if (performance.now() - keyAt < 1000) { if (active && box.contains(active)) p.opener = active; p.focusFirst(); }
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
