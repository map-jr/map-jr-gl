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
import {derefLayers, fontFaces, type FontFaces} from './resolve.ts';
import type {LngLatBoundsInput} from './lnglat.ts';
import type {PaddingInput} from './geo.ts';
import type {BackgroundLayerSpecification, CircleLayerSpecification, ColorReliefLayerSpecification, FillExtrusionLayerSpecification, FillLayerSpecification, HeatmapLayerSpecification, HillshadeLayerSpecification, LineLayerSpecification, ProjectionSpecification, RasterLayerSpecification, SourceSpecification, StyleSpecification, SymbolLayerSpecification, TerrainSpecification} from './compat-types.ts';
import {unset, type Given} from './unset.ts';
import {withCode} from './requests.ts';

/**
 * Set by the build (`define` in build.mjs). True in the development build (`dist/*.dev.js`, which the `development`
 * condition of package.json names) and in the standalone file; false in the production build.
 */
declare const __DEV__: boolean;

/** A control for `controls` of the description, as the functions of `@map-jr/map-jr-gl/controls` return it. */
export interface ControlSpec {
    /** The identity of the control. A new description with a control of the same `key` keeps the control on the map. */
    key: string;
    /** The corner of the map that holds the control. */
    position?: ControlPosition;
    /**
     * Returns the control as MapLibre GL JS controls are, with `onAdd` and `onRemove`. The map calls it when it adds the control.
     * @param instance A function that returns the map.
     */
    create(instance?: () => MapInstance): Control;
    /** @internal The options, which a kept control takes from the latest description, so that a new callback reaches it. */
    options?: object;
}

/**
 * A position as `[lng, lat]` in degrees, for example `[-74, 40.7]`. A plain `number[]` is accepted. A position that the
 * map returns, such as `state.view.center`, has the type `[number, number]`.
 */
export type Position = readonly number[];
/** A box in degrees, as `[[west, south], [east, north]]` or `[west, south, east, north]`. */
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
 * A source of the field `sources` of `MapDescription`: a source of the style specification, except that a GeoJSON source
 * needs no `data` when its id is a key of `data` of the description.
 */
export type SourceInput = SourceSpecification | (Omit<Extract<SourceSpecification, {type: 'geojson'}>, 'data'> & {data?: Extract<SourceSpecification, {type: 'geojson'}>['data']});
/**
 * A layer of the field `layers` of `MapDescription`: a style layer of one of the types that the library draws, with
 * `before`. TypeScript checks `type` and the prefix of each name in `paint` and `layout`.
 */
export type LayerInput = (BackgroundLayerSpecification | FillLayerSpecification | FillExtrusionLayerSpecification | LineLayerSpecification | CircleLayerSpecification | HeatmapLayerSpecification | RasterLayerSpecification | HillshadeLayerSpecification | ColorReliefLayerSpecification | SymbolLayerSpecification) & {before?: string};
/** A cluster or a point that the cluster methods of `MapInstance` return, as GeoJSON in longitude and latitude. */
export interface ClusterFeature {
    /** Always `'Feature'`. */
    type: 'Feature';
    /** The id of a point, from the data or from `generateId` of the source. */
    id?: string | number;
    /** The properties of a point. A cluster has `cluster: true`, `cluster_id`, `point_count` and `point_count_abbreviated`. */
    properties: Record<string, unknown>;
    /** The position of the point or of the cluster. */
    geometry: {type: 'Point'; coordinates: [number, number]};
}
/**
 * Where the camera is. `bounds` is `[[west, south], [east, north]]`: the smallest box that contains the visible map,
 * as `getBounds()` gives it in MapLibre GL JS.
 */
export interface View {
    /** The center of the view, `[lng, lat]`. */
    center: [number, number];
    /** The zoom level. */
    zoom: number;
    /** The bearing in degrees clockwise from north. */
    bearing: number;
    /** The pitch in degrees from straight down. */
    pitch: number;
    /** The smallest box that contains the visible map, `[[west, south], [east, north]]`. */
    bounds: [[number, number], [number, number]];
}
/** A view that the application gives: each field is optional. */
export interface ViewInput {
    /** The center of the view, `[lng, lat]`. */
    center?: Position;
    /** The zoom level. */
    zoom?: number;
    /** The bearing in degrees clockwise from north. */
    bearing?: number;
    /** The pitch in degrees from straight down. */
    pitch?: number;
}
/** A view to go to, for `initialView` and `moveTo`: a center, zoom, bearing and pitch, or a box to fit. */
export interface InitialView extends ViewInput {
    /** A box to fit into the map. It overrides `center` and `zoom`. */
    bounds?: Bounds;
    /**
     * Space in CSS pixels around `bounds` for this fit, which `moveTo` adds to `padding` of the description and the first fit of `initialView` does not. It has no effect without `bounds`.
     * @default 0
     */
    fitPadding?: PaddingInput;
    /** The largest zoom level of the fit of `bounds`, for a small box. It has no effect without `bounds`, and it does not change `maxZoom` of the description. */
    fitMaxZoom?: number;
}
/** The argument of `moveTo`: a view or `bounds` as in `InitialView`, and how the camera moves there. */
export interface MoveToOptions extends InitialView {
    /**
     * The duration of the animation in milliseconds. `0` moves the camera at once. With `fly`, a missing `duration` follows from the distance.
     * @default 0
     */
    duration?: number;
    /**
     * Whether the camera zooms out and back in on the way. An object sets the options `curve`, `speed`, `screenSpeed`,
     * `minZoom` and `maxDuration` of `flyTo` of MapLibre GL JS.
     * @default false
     */
    fly?: boolean | FlyOptions;
}
/** Where the pointer is over the map: `point` in CSS pixels from the top left corner of the map, `lngLat` as `[lng, lat]`. */
export interface PointerPosition {
    /** The point in CSS pixels from the top left corner of the map. */
    point: {x: number; y: number};
    /** The position under the pointer, `[lng, lat]`. */
    lngLat: [number, number];
}
/** The argument of `onClick`: where the user clicked, and the features there. */
export interface MapPointer {
    /** The point in CSS pixels from the top left corner of the map. */
    point: {x: number; y: number};
    /** The position, `[lng, lat]`. */
    lngLat: [number, number];
    /** The features of `interactiveLayers` at the point, the top one first. */
    features: RenderedFeature[];
}

/** The fields of `MapDescription` that add to the parts of the style: `sources`, `layers` and `terrain`. */
type StyleParts = Pick<Given, 'sources' | 'layers' | 'terrain'>;
const parts = (s: Given): StyleParts => ({sources: s.sources, layers: s.layers, terrain: s.terrain});

/** What an image is made from: an SVG document, the URL of an image, or an object that a canvas can draw (an `ImageBitmap`, a canvas, `ImageData`). */
export type ImageSource = Parameters<Map['addImage']>[1];
/**
 * An image of the field `images` of `MapDescription`: an `ImageSource`, or an object with the source as `image` and the
 * options of the image (`width` and `height` in CSS pixels, `pixelRatio`, and the options for an icon that fits text).
 */
export type ImageInput = ImageSource | ({image: ImageSource} & ImageOptions);

/**
 * The description of a map: one object that states the style, the data, the view and the controls. To change the map, pass a new description to `update`.
 * Every optional field accepts `null` as "not set", the same as leaving the field out, except `terrain`.
 */
export interface MapDescription extends MapSetup {
    /**
     * The style: a style object, the URL of a style, or `{light, dark}` with one style for the light and one for the dark color scheme.
     * With `{light, dark}`, the map uses the style of the resolved `colorScheme`, and loads the other style when the scheme changes.
     */
    style: string | StyleSpecification | {light: string | StyleSpecification; dark: string | StyleSpecification};
    /**
     * Sources to add to the style, by id. A source here overrides the source of the style that has the same id. A GeoJSON source
     * whose id is a key of `data` needs no `data` of its own: it sets the options of the source, and `data` sets the features.
     */
    sources?: Record<string, SourceInput> | null;
    /**
     * Layers to add to the style, in order. A layer with `before` is inserted below the style layer with that id, and a
     * layer without `before` is drawn on top.
     */
    layers?: LayerInput[] | null;
    /**
     * 3D terrain from a raster-dem source, for example `{source: 'dem', exaggeration: 1.5}`, in place of the `terrain`
     * of the style. Without this field, the map uses the `terrain` of the style. Unlike the other fields, `null` is not the
     * same as leaving the field out: `null` turns off the `terrain` of the style.
     */
    terrain?: TerrainSpecification | null;
    /**
     * Web fonts for labels, by `text-font` name: a URL, or a list of `{url, 'unicode-range'}` as in `font-faces` of the
     * style specification. A name here overrides the same name in the `font-faces` of the style.
     */
    fonts?: FontFaces | null;
    /** The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. `view` overrides it, and with `hash` a view in the URL of the page overrides both. */
    initialView?: InitialView | null;
    /**
     * A view that the application controls. Set it together with `onViewChange`, and pass each view that `onViewChange`
     * receives back to `view`. The map applies a new `view` with no animation; to animate the camera, call `moveTo`.
     */
    view?: ViewInput | null;
    /**
     * Called with the first view once, right after `createMap` returns, and then with the new view at each change of the
     * view. The first call comes before `load`. The map also calls it during a movement, and when the change comes from
     * `view` or `moveTo`.
     */
    onViewChange?: ((view: View) => void) | null;
    /**
     * GeoJSON data or the URL of GeoJSON, by the id of a GeoJSON source of the style or of `sources`. To change the data
     * of a source, pass a new object; the same object again changes nothing. `patch` merges `data` by key: it changes only
     * the keys that it passes, and a key that is `null` removes the data of that source.
     */
    data?: Record<string, GeoJSON | string> | null;
    /**
     * Images for `icon-image` and the pattern properties of style layers, by name: an SVG document as a string, the URL of an image, or `{image, width, height}`.
     * An image here overrides the image of the sprite that has the same name.
     */
    images?: Record<string, ImageInput> | null;
    /**
     * Sprites to add to the sprite of the style, as `[{id: 'pins', url: 'https://example.com/sprites/pins'}]`. A layer
     * names an image of such a sprite as `id:name` (`pins:hotel`). A change of this field loads the style again.
     */
    sprite?: {id: string; url: string}[] | null;
    /** Controls from `@map-jr/map-jr-gl/controls`, for example `[navigation(), scale()]`. */
    controls?: ControlSpec[] | null;
    /**
     * The projection, `{type: 'globe'}` or `{type: 'mercator'}`, in place of the `projection` of the style. Without
     * this field, the map uses the projection of the style. A globe changes to Mercator between zoom 11 and 12.
     */
    projection?: ProjectionSpecification | null;
    /**
     * Values for the `global-state` expressions of the style, by name, for example `{season: 'winter'}`. A value here overrides the default
     * in `state` of the style. A name that is left out or set to `null` uses the default of the style.
     */
    globalState?: Record<string, unknown> | null;
    /** The ids of the style layers that respond to the pointer: their features appear in [`state.hover`](docs/reference/state.md#mapstate) and in `onClick`. */
    interactiveLayers?: string[] | null;
    /**
     * Whether the top feature of `interactiveLayers` under the pointer has the feature state `hover: true`, for
     * `feature-state` expressions. A feature with no id gets no state.
     * @default false
     */
    hoverState?: boolean | null;
    /** Called for each click on the map, with the point, the position and the features of `interactiveLayers` at the point. */
    onClick?: ((event: MapPointer) => void) | null;
    /**
     * Called with each error of the map, such as a style or a tile that does not load, and without it the map writes each error to the console.
     * The second argument is an object: its `sourceId` names the source when the error belongs to a source (a tile, TileJSON,
     * GeoJSON URL, PMTiles archive or image that failed to load), and it has no `sourceId` otherwise.
     */
    onError?: ((error: Error, info: MapErrorInfo) => void) | null;
    /**
     * The smallest zoom level of the map. It limits gestures, `view` and `moveTo`.
     * @default -2
     */
    minZoom?: number | null;
    /**
     * The largest zoom level of the map. It limits gestures, `view` and `moveTo`.
     * @default 22
     */
    maxZoom?: number | null;
    /**
     * The largest pitch of the map in degrees, at most 180, where a pitch above 90 looks up. The camera stays at or above sea level (above the ground with 3D terrain): a pitch that would put it lower is reduced, and the zoom changes with it, as in MapLibre GL JS. Give the map center a height with `centerElevation` to look up from higher. A larger value is limited to 180 and warns once. It limits gestures, `view` and `moveTo`.
     * @default 60
     */
    maxPitch?: number | null;
    /**
     * The height of the map center in meters above sea level, which keeps the camera above the ground at a pitch above 90
     * when it is high enough. The camera keeps its distance and pitch from that point. Without this field, the center is on
     * the ground (3D terrain, or sea level) and follows it. While it is set, the center does not follow 3D terrain.
     */
    centerElevation?: number | null;
    /**
     * Whether copies of the world are drawn beside it, as in MapLibre GL JS. With `false`, the view stays inside -180 to
     * 180 degrees of longitude, no tiles of other copies load, and markers and popups stay at the longitude that they were given.
     * A change to `false` in `update` moves the view inside at once.
     * @default true
     */
    renderWorldCopies?: boolean | null;
    /** A box that the view cannot leave, as `[[west, south], [east, north]]` or `[west, south, east, north]`. Without this field, the view has no limit. */
    maxBounds?: Bounds | null;
    /**
     * The CSS cursor over the map in place of the default, which is `pointer` over a feature of `interactiveLayers`.
     * Elsewhere the default is `grab` on an interactive map, and the cursor of the page on a map with `interactive: false`.
     */
    cursor?: string | null;
    /**
     * Whether the wheel zooms only with Ctrl (⌘ on a Mac) and a touch pans only with two fingers, for a map in a page
     * that scrolls. A blocked gesture shows a hint over the map.
     * @default false
     */
    cooperativeGestures?: boolean | null;
    /**
     * The color scheme of the controls, the popup and the attribution. `'auto'` follows `prefers-color-scheme` of the
     * browser. The resolved scheme is also the global state `color-scheme` of the style, unless `globalState` sets it.
     * @default 'light'
     */
    colorScheme?: 'auto' | 'light' | 'dark' | null;
    /**
     * Called with the new value when the control `colorScheme()` changes `colorScheme`. The map has applied the value
     * already; an application that keeps the description in its state stores it.
     */
    onColorSchemeChange?: ((colorScheme: 'auto' | 'light' | 'dark') => void) | null;
    /**
     * The texts of the controls, the popup, the marker and the hint of `cooperativeGestures`, by the keys of MapLibre GL
     * JS, for example `{'NavigationControl.ZoomIn': 'Zoom avant'}`. A key that is left out keeps the English text.
     */
    locale?: Record<string, string> | null;
    /**
     * Space in CSS pixels at the sides of the map that the view keeps free, for example under a side panel: one number
     * for all sides, or `{top, right, bottom, left}` with 0 for a side that is left out.
     * @default 0
     */
    padding?: PaddingInput | null;
    /**
     * A function that changes a request before the map sends it, as `transformRequest` of MapLibre GL JS. It receives the
     * URL and the resource type, and returns `{url, headers, credentials}`, or `undefined` to send the request unchanged.
     * Without this field, the map sends every request unchanged.
     */
    transformRequest?: RequestTransform | null;
}
/** The options of the built-in attribution (`attribution` of the description). */
export interface AttributionOptions {
    /**
     * Whether the attribution is a button that opens the credits.
     * @default true when the map is 640 CSS pixels wide or narrower, else false
     */
    compact?: boolean;
    /** Credits that the attribution shows after the credits of the sources of the style. */
    customAttribution?: string | string[];
}
/** The fields of the description that the map reads only when it is created. To change one, destroy the map and create a new one. */
export interface MapSetup {
    /**
     * The thread that renders the map. `'worker'` keeps the map smooth while the page is busy, and `'auto'` uses it where the browser supports it.
     * @default 'auto'
     */
    renderer?: 'auto' | 'worker' | 'main' | null;
    /**
     * The CSS font family for labels that have no glyph file and no web font, after the names of `text-font`.
     * @default '"Noto Sans", "Helvetica Neue", Arial, sans-serif'
     */
    fontFamily?: string | null;
    /**
     * Whether the user can move the map with the mouse, touch and keyboard, while `onClick` and `state.hover` work either way.
     * @default true
     */
    interactive?: boolean | null;
    /**
     * Whether the canvas uses multisample antialiasing. It smooths the edges of polygons at a cost in frame time.
     * @default false
     */
    antialias?: boolean | null;
    /** The options of the built-in attribution (`{compact, customAttribution}`), or `false` to hide it when the page shows the credits itself. */
    attribution?: false | AttributionOptions | null;
    /**
     * `true` keeps the view in the hash of the URL (`#zoom/lat/lng/bearing/pitch`), and a string keeps it in the parameter of that name.
     * A link to the page then shows the same view.
     * @default false
     */
    hash?: boolean | string | null;
    /** The nonce of a [Content Security Policy](docs/guide/loading.md#content-security-policy) with `style-src 'nonce-…'`, for the style sheet of the map. */
    nonce?: string | null;
}

/** The state of a map, which `state` of `MapInstance` holds. */
export interface MapState {
    /** Whether the style and the tiles of the view have loaded for the first time. It stays `true` afterwards. */
    loaded: boolean;
    /** Whether the camera is still and nothing loads. It becomes `false` again when the camera moves or the map loads. */
    idle: boolean;
    /** Whether the camera moves. */
    moving: boolean;
    /** The current view. */
    view: View;
    /** The features of `interactiveLayers` under the pointer, the top one first. */
    hover: RenderedFeature[];
    /** Where the pointer is over the map, or `null` when it is not over the map. It can be one frame late. */
    pointer: PointerPosition | null;
    /** The thread that renders the map, or `undefined` until `loaded` is `true`. */
    renderer: 'worker' | 'main' | undefined;
    /** The color scheme of the controls: `colorScheme` of the description, with `'auto'` resolved. */
    colorScheme: 'light' | 'dark';
}

/** Where an element of the page is on the map, for `overlay`. */
export interface OverlayOptions {
    /** The position of the element, `[lng, lat]`. */
    lngLat: Position;
    /**
     * The part of the element that is at the position: `'center'`, `'bottom'`, `'top-left'` and the other sides and corners.
     * Without `anchor`, a marker takes `'center'`, and a popup chooses its anchor each time it moves: `'top'` near the top
     * edge, `'bottom'` near the bottom edge or near no edge, and `'left'` or `'right'` near a side, joined into a corner.
     * @default `'center'` for a marker; for a popup, chosen by the position
     */
    anchor?: Anchor;
    /** A distance in CSS pixels from the position, to the right and down. */
    offset?: [number, number];
    /**
     * Whether the element is shown in a box with a tip that points to the position (a popup).
     * @default false
     */
    popup?: boolean;
    /** Called when the user closes the popup. With it, the popup has a button to close it. */
    onClose?: () => void;
    /**
     * Whether the user can drag the element. A popup cannot be dragged. To keep a dropped element in place across updates, pass its
     * new position to `lngLat` in `onDragEnd`.
     * @default false
     */
    draggable?: boolean;
    /** Called with the position of the element, `[lng, lat]`, when a drag starts. */
    onDragStart?: (lngLat: Position) => void;
    /** Called with the position of the element, `[lng, lat]`, at each move of a drag. */
    onDrag?: (lngLat: Position) => void;
    /** Called with the position where the element was dropped, `[lng, lat]`. */
    onDragEnd?: (lngLat: Position) => void;
}
/** An element that `overlay` placed on the map. */
export interface MapOverlay {
    /** Replaces all options of the overlay with `options`. The element moves only when `lngLat` changes, so a dragged element stays where it was dropped. */
    update(options: OverlayOptions): void;
    /**
     * Changes only the options that `options` has, for example `patch({lngLat: [2.35, 48.86]})` to move a popup and keep its
     * other options. `anchor`, `popup` or `draggable` set to `undefined` returns to its default. Another option set to
     * `undefined` is removed, except `lngLat`, which keeps the position. After `remove`, `patch` has no effect.
     */
    patch(options: Partial<Omit<OverlayOptions, 'lngLat'>> & {lngLat?: Position}): void;
    /** Removes the element from the map. */
    remove(): void;
}

/** What each event of `listen` has: its type, and the `MapInstance` that fired it. */
export interface MapEventBase<T extends string = string> {
    /** The name of the event. */
    type: T;
    /** The map that fired the event, as `createMap` returned it. */
    target: MapInstance;
}
/** An event of a drag of the map by the user (`dragstart`, `drag`, `dragend`). */
export interface MapDragEvent extends MapEventBase<'dragstart' | 'drag' | 'dragend'> {
    /** The mouse or touch event that moved the map. */
    originalEvent: MouseEvent | TouchEvent;
}
/** An event of the pointer. A listener that calls `preventDefault()` stops what the map does for the event (a drag, a zoom). */
export interface MapPointerEvent<T extends string = string, E extends MouseEvent = MouseEvent> extends MapEventBase<T> {
    /** The point in CSS pixels from the top left corner of the map. */
    point: {x: number; y: number};
    /** The position under the pointer, `[lng, lat]`. */
    lngLat: [number, number];
    /** The DOM event. */
    originalEvent: E;
    /** Stops what the map does for this event. */
    preventDefault(): void;
    /** Whether a listener called `preventDefault()`. */
    readonly defaultPrevented: boolean;
}
/** An event of a touch: `points` and `lngLats` have one entry for each finger on the map. */
export interface MapTouchEvent<T extends string = string> extends MapPointerEvent<T, PointerEvent> {
    /** The point of each finger on the map, in CSS pixels from the top left corner of the map. */
    points: {x: number; y: number}[];
    /** The position of each finger on the map, `[lng, lat]`. */
    lngLats: [number, number][];
}
/** The second argument of `onError`: `sourceId` names the source when the error belongs to a source, and is absent otherwise. */
export interface MapErrorInfo {
    sourceId?: string;
}

/** An event of the data of the map: `dataType` says whether the style or one source (`sourceId`) changed. */
export interface MapDataEvent<T extends string = string> extends MapEventBase<T> {
    /** Whether the event concerns the style or one source. */
    dataType: 'source' | 'style';
    /** The id of the source, for `dataType: 'source'`. */
    sourceId?: string;
    /** Whether the tiles of the source for the view have loaded, for `dataType: 'source'`. */
    isSourceLoaded?: boolean;
    /** The source as the style specifies it, for `dataType: 'source'`. */
    source?: unknown;
}

/**
 * The events of `listen`, by type. A position is `[lng, lat]` and a box is `[[west, south], [east, north]]`. For the
 * common needs, read `state` or set `onClick`, `onViewChange` and `onError` in the description.
 */
export interface MapEvents {
    /** The style and the first tiles have loaded. It comes once, before the first `idle`. */
    load: MapEventBase<'load'>;
    /** Nothing moves and nothing loads. */
    idle: MapEventBase<'idle'>;
    /** The map has drawn a frame. */
    render: MapEventBase<'render'>;
    /** The size of the map has changed. */
    resize: MapEventBase<'resize'>;
    /** The map is removed. */
    remove: MapEventBase<'remove'>;
    /** A complete style has loaded. */
    'style.load': MapEventBase<'style.load'>;
    /** The browser has taken the WebGL context away. The map starts again on a new canvas with the same view and data. */
    webglcontextlost: MapEventBase<'webglcontextlost'>;
    /** The map has a WebGL context again after `webglcontextlost`. */
    webglcontextrestored: MapEventBase<'webglcontextrestored'>;
    /** The view starts to change. */
    movestart: MapEventBase<'movestart'>;
    /** The view changes. */
    move: MapEventBase<'move'>;
    /** The view has stopped changing. */
    moveend: MapEventBase<'moveend'>;
    /** The zoom starts to change. */
    zoomstart: MapEventBase<'zoomstart'>;
    /** The zoom changes. */
    zoom: MapEventBase<'zoom'>;
    /** The zoom has stopped changing. */
    zoomend: MapEventBase<'zoomend'>;
    /** The bearing starts to change. */
    rotatestart: MapEventBase<'rotatestart'>;
    /** The bearing changes. */
    rotate: MapEventBase<'rotate'>;
    /** The bearing has stopped changing. */
    rotateend: MapEventBase<'rotateend'>;
    /** The pitch starts to change. */
    pitchstart: MapEventBase<'pitchstart'>;
    /** The pitch changes. */
    pitch: MapEventBase<'pitch'>;
    /** The pitch has stopped changing. */
    pitchend: MapEventBase<'pitchend'>;
    /** The user starts to drag the map. */
    dragstart: MapDragEvent;
    /** The user drags the map. */
    drag: MapDragEvent;
    /** The user stops dragging the map. */
    dragend: MapDragEvent;
    /** A double click on the map. */
    dblclick: MapPointerEvent<'dblclick'>;
    /** The browser asks for a context menu over the map, usually after a click with the right mouse button. */
    contextmenu: MapPointerEvent<'contextmenu'>;
    /** A mouse button is pressed over the map. */
    mousedown: MapPointerEvent<'mousedown'>;
    /** The mouse moves over the map. */
    mousemove: MapPointerEvent<'mousemove'>;
    /** A mouse button is released over the map. */
    mouseup: MapPointerEvent<'mouseup'>;
    /** The mouse enters the map. */
    mouseover: MapPointerEvent<'mouseover'>;
    /** The mouse leaves the map. */
    mouseout: MapPointerEvent<'mouseout'>;
    /** A finger touches the map. */
    touchstart: MapTouchEvent<'touchstart'>;
    /** A finger moves on the map. */
    touchmove: MapTouchEvent<'touchmove'>;
    /** A finger leaves the map. */
    touchend: MapTouchEvent<'touchend'>;
    /** The browser cancels a touch on the map. */
    touchcancel: MapTouchEvent<'touchcancel'>;
    /** The style has changed. */
    styledata: MapDataEvent<'styledata'>;
    /** A source has new data. */
    sourcedata: MapDataEvent<'sourcedata'>;
    /** Each time that `styledata` or `sourcedata` fires. */
    data: MapDataEvent<'data'>;
    /** The style starts to load. */
    styledataloading: MapDataEvent<'styledataloading'>;
    /** A source starts to load. */
    sourcedataloading: MapDataEvent<'sourcedataloading'>;
    /** Each time that `styledataloading` or `sourcedataloading` fires. */
    dataloading: MapDataEvent<'dataloading'>;
    /** A click on the map. */
    click: MapPointerEvent<'click'>;
    /** A turn of the mouse wheel over the map. */
    wheel: MapPointerEvent<'wheel', WheelEvent>;
    /** A zoom to a box drawn with the Shift key and a drag starts. `boxzoomend` has the bounds of the box. */
    boxzoomstart: MapEventBase<'boxzoomstart'> & {originalEvent: PointerEvent};
    /** A zoom to a box is canceled. */
    boxzoomcancel: MapEventBase<'boxzoomcancel'> & {originalEvent: Event};
    /** A zoom to a box ends, with the bounds of the box as `boxZoomBounds`. */
    boxzoomend: MapEventBase<'boxzoomend'> & {originalEvent: Event; boxZoomBounds: [[number, number], [number, number]]};
    /** About once a second while the map renders: the frames per second, the CPU time of a frame in milliseconds on the thread that renders, and the number of labels placed. */
    stats: MapEventBase<'stats'> & {fps: number; frameMs: number; labels: number};
    /** The style names an image (`id`) that the map does not have. */
    styleimagemissing: MapEventBase<'styleimagemissing'> & {id: string};
    /** The terrain changed. */
    terrain: MapEventBase<'terrain'> & {terrain: {source: string; exaggeration?: number} | null};
    /**
     * The projection was applied, by a new style or a change of the projection type. `newProjection` is `mercator`, `globe`
     * or `vertical-perspective`.
     */
    projectiontransition: MapEventBase<'projectiontransition'> & {newProjection: string};
    /** The geolocate control of `@map-jr/map-jr-gl/controls` received a position. */
    geolocate: MapEventBase<'geolocate'> & {coords: GeolocationCoordinates};
    /** An error of the map. `error` is the value that failed, which can be other than an `Error`; `onError` of the description receives it as an `Error`. `sourceId` names the source of a tile, TileJSON, GeoJSON URL, PMTiles archive or image that failed to load. */
    error: MapEventBase<'error'> & {error: unknown; sourceId?: string};
}

/** A map that `createMap` returns. */
export interface MapInstance {
    /**
     * Applies a new description to the map. Pass the complete description each time.
     * @param spec The new description.
     */
    update(spec: MapDescription): void;
    /**
     * Applies the fields of `part` and keeps the other fields of the current description. A field of `part` that is `undefined` is removed.
     * `data` is merged by key: `patch({data: {a: x}})` changes only the source `a`, and a key that is `null` removes the
     * data of that source. Every other field, `layers` included, is replaced whole.
     * @param part The fields to change.
     */
    patch(part: Partial<Omit<MapDescription, 'data'>> & {data?: Record<string, GeoJSON | string | null>}): void;
    /** The description of the last `createMap`, `update` or `patch`. To change the map, call `update` or `patch`. */
    readonly description: Readonly<MapDescription>;
    /**
     * Returns the description with `style` as a copy of the style that the map loaded and `globalState` as the global state in effect.
     * Do not pass the result to `update`.
     * @returns A new object for reading.
     */
    getResolvedDescription(): MapDescription;
    /** Removes the map, its controls and its overlays from the page. A pending `toBlob` or `once` rejects. */
    destroy(): void;
    /** A store of the state of the map (`MapState`): `state.get()` returns it, and `state.subscribe(fn)` calls `fn` at each change. */
    readonly state: Readable<MapState>;
    /**
     * Returns the features that the style layers render at a place, the top one first.
     * @param at A point of the screen (`{x, y}`), a position (`[lng, lat]`), a box of the screen (two points), or nothing for the whole map. The options can be passed here instead, and `options` is then ignored.
     * @param options `layers` (the ids of style layers), `filter` (a filter expression) and `radius` (in CSS pixels around a point).
     * @returns A promise of the features.
     */
    queryFeatures(at?: FeaturePlace | FeatureOptions, options?: FeatureOptions): Promise<RenderedFeature[]>;
    /**
     * Returns the features of the tile data of a source, with no need of a style layer. A position need not be in the view.
     * @param sourceId The id of a source of the style or of `sources`.
     * @param at A point of the screen or a position, or nothing for the tiles of the view. The options can be passed here instead, and `options` is then ignored.
     * @param options `sourceLayers`, `filter`, `radius` (CSS pixels), `geometry` and `zoom`.
     * @returns A promise of the features.
     */
    querySource(sourceId: string, at?: FeaturePlace | SourceOptions, options?: SourceOptions): Promise<QueriedFeature[]>;
    /**
     * Calls `listener` with the result of `queryFeatures` now and again each time that the result changes.
     * @param at A place as for `queryFeatures`, or `undefined` for the whole map.
     * @param options The options of `queryFeatures`.
     * @param listener Called with the features at the start and after each change of the result.
     * @returns A function that stops the calls.
     */
    watchFeatures(at: FeaturePlace | undefined, options: FeatureOptions, listener: (features: RenderedFeature[]) => void): () => void;
    /**
     * Calls `listener` with the result of `querySource` now and again each time that the result changes.
     * @param sourceId The id of a source of the style or of `sources`.
     * @param at A place as for `querySource`, or `undefined` for the tiles of the view.
     * @param options The options of `querySource`.
     * @param listener Called with the features at the start and after each change of the result.
     * @returns A function that stops the calls.
     */
    watchSource(sourceId: string, at: FeaturePlace | undefined, options: SourceOptions, listener: (features: QueriedFeature[]) => void): () => void;
    /**
     * Merges `state` into the feature state of one feature, which `feature-state` expressions read. The map keeps the state,
     * also after a new `style`, until it is removed.
     * @param target `id` is the `id` of the feature; `sourceLayer` is required for a vector source.
     * @param state The keys and values to set.
     */
    setFeatureState(target: {source: string; sourceLayer?: string; id: number | string}, state: Record<string, unknown>): void;
    /**
     * Removes one key of the feature state of a feature, or its whole state when `key` is left out.
     * @param target Without `id`, the state of all features of the source is removed.
     * @param key The key to remove. Without it, the whole state is removed.
     */
    removeFeatureState(target: {source: string; sourceLayer?: string; id?: number | string}, key?: string): void;
    /**
     * Returns the height of the ground at a position (`[lng, lat]`) or a point of the screen, read from the elevation tiles
     * of a `raster-dem` source of the style. The `exaggeration` of the terrain does not change it.
     * @param at A position, `[lng, lat]`, or a point of the screen, `{x, y}` in CSS pixels.
     * @param options `source` is the ID of the `raster-dem` source (default the first one of the style), and `zoom` is the zoom level of its tile (default its `maxzoom`).
     * @returns A promise of the height in meters, or of `null` when the tile has no data. It rejects when the style has no `raster-dem` source, or none with the ID of `options.source`.
     */
    queryElevation(at: Position | {x: number; y: number}, options?: {source?: string; zoom?: number}): Promise<number | null>;
    /**
     * Returns the map as an image once the map is idle, in the size of the canvas in device pixels. Markers, popups and controls are not in the image.
     * @param type The MIME type of the image. Default `'image/png'`.
     * @param quality From 0 to 1, for `'image/jpeg'` and `'image/webp'`.
     * @returns A promise of the image. It rejects when the map is destroyed first.
     */
    toBlob(type?: string, quality?: number): Promise<Blob>;
    /**
     * Returns the zoom level at which a cluster of a GeoJSON source with `cluster: true` divides.
     * @param sourceId The id of a GeoJSON source with `cluster: true`.
     * @param clusterId `properties.cluster_id` of the cluster feature.
     * @returns A promise that rejects when the source has no cluster with this id.
     */
    clusterExpansionZoom(sourceId: string, clusterId: number): Promise<number>;
    /**
     * Returns the clusters and points that a cluster divides into at the next zoom level.
     * @param sourceId The id of a GeoJSON source with `cluster: true`.
     * @param clusterId `properties.cluster_id` of the cluster feature.
     * @returns A promise that rejects when the source has no cluster with this id.
     */
    clusterChildren(sourceId: string, clusterId: number): Promise<ClusterFeature[]>;
    /**
     * Returns the points of a cluster.
     * @param sourceId The id of a GeoJSON source with `cluster: true`.
     * @param clusterId `properties.cluster_id` of the cluster feature.
     * @param options `limit` is the largest number of points (default 10), and `offset` the number to skip (default 0).
     * @returns A promise that rejects when the source has no cluster with this id.
     */
    clusterLeaves(sourceId: string, clusterId: number, options?: {limit?: number; offset?: number}): Promise<ClusterFeature[]>;
    /**
     * Moves the camera to a view or to `bounds`, with an animation when `duration` is more than 0 or `fly` is set. The
     * padding of the map stays that of the description.
     * @param view Where the camera goes, and how it moves.
     */
    moveTo(view: MoveToOptions): void;
    /**
     * Moves the camera to fit a box, as `moveTo({bounds, ...options})`. The camera jumps unless `options` sets `duration`
     * or `fly`, as with `moveTo`.
     * @param bounds The box to fit.
     * @param options The options of `moveTo` other than `bounds`, `center` and `zoom`.
     */
    fitBounds(bounds: Bounds, options?: Omit<MoveToOptions, 'bounds' | 'center' | 'zoom'>): void;
    /**
     * Converts a position to a point of the screen.
     * @param lngLat The position, `[lng, lat]`.
     * @returns The point in CSS pixels from the top left corner of the map.
     */
    project(lngLat: Position): {x: number; y: number};
    /**
     * Converts a point of the screen, in CSS pixels from the top left corner of the map, to a position. The position is
     * where the line of sight through the point meets the ground (with 3D terrain, the nearest ground). Above the
     * horizon, the line of sight meets the plane of the map center behind the camera, and the result is that point, as
     * in MapLibre GL JS. With 3D terrain and a pitch above 90, a point above the horizon gives a position on the ground
     * in view instead.
     * @param point The point, `{x, y}`.
     * @returns The position as `[lng, lat]`.
     */
    unproject(point: {x: number; y: number}): [number, number];
    /**
     * Places an element of the page at a position of the map, as a marker, a label or a popup; the element moves with
     * the map. For many points, a symbol layer in `layers` renders much faster.
     * @param element The element to place.
     * @param options The position of the element, and whether it is a popup or can be dragged.
     * @returns An overlay with `update`, `patch` and `remove`.
     */
    overlay(element: HTMLElement, options: OverlayOptions): MapOverlay;
    /**
     * Calls `fn` for each event of a type of `MapEvents`.
     * @param type The name of the event.
     * @param fn Called with the event.
     * @returns A function that stops the calls.
     */
    listen<K extends keyof MapEvents>(type: K, fn: (event: MapEvents[K]) => void): () => void;
    /**
     * Waits for the next event of a type of `MapEvents`. On a map that has loaded, `once('load')` resolves at once.
     * @param type The name of the event.
     * @returns A promise of the event. It rejects when the map is destroyed first.
     */
    once<K extends keyof MapEvents>(type: K): Promise<MapEvents[K]>;
    /** The element that holds the map. */
    readonly container: HTMLElement;
}

// (A field that `a` does not have is not compared: an owned view such as `{center, zoom}` equals a full view that the map reported.)
const same = (a: ViewInput | undefined, b: ViewInput | undefined) => !!a && !!b && (['zoom', 'bearing', 'pitch'] as const).every(k => a[k] === undefined || a[k] === b[k]) && (!a.center || (a.center[0] === b.center?.[0] && a.center[1] === b.center?.[1]));


/** Stops a description with no style, with a message that says what to write (a caller in JavaScript has no type check). */
function complete(spec: MapDescription, method: string, fix: string) {
    if (!spec?.style) throw new Error(`[map-jr-gl] E57 ${method}(): the description has no "style". ${fix}`);
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

/**
 * Creates a map in an element of the page from a description.
 * @param container The element, or the `id` of an element. The map fills it, so the element needs a height.
 * @param spec The description of the map.
 * @returns The map.
 */
export function createMap(container: HTMLElement | string, spec: MapDescription): MapInstance { return makeMap(container, spec, 'createMap()'); }

/** @internal `createMap` for the adapters of this package. */
export function makeMap(container: HTMLElement | string, given: MapDescription, name: string): MapInstance {
    complete(given, 'createMap', 'Pass the URL of a style or a style object as "style".');
    const spec = unset(given);
    if (!container) throw new Error('[map-jr-gl] E65 createMap(): the container is ' + container + '. In a framework, make the map after the element is mounted.');
    if (typeof container === 'string' && !document.getElementById(container)) throw new Error(`[map-jr-gl] E10065 createMap(): no element with the id "${container}".`);
    const {bounds, fitPadding, fitMaxZoom, ...first} = {...spec.initialView, ...spec.view} as InitialView & {bounds?: unknown};
    const options: MapOptions = {
        container, style: spec.style, center: first.center, zoom: first.zoom, bearing: first.bearing, pitch: first.pitch,
        // (A `view` from the state has `bounds` too: it is a view, and only `initialView` gives a box to fit.)
        startPadding: spec.padding as PaddingInput | undefined, bounds: spec.view ? undefined : bounds as LngLatBoundsInput, fitBoundsOptions: {padding: fitPadding, maxZoom: fitMaxZoom}, renderer: spec.renderer, fontFamily: spec.fontFamily, interactive: spec.interactive, antialias: spec.antialias, hash: spec.hash, nonce: spec.nonce,
        attributionControl: spec.attribution, minZoom: spec.minZoom, maxZoom: spec.maxZoom, maxPitch: spec.maxPitch, renderWorldCopies: spec.renderWorldCopies,
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
    const nameCanvas = (locale: Record<string, string> | null | undefined) => map.getCanvas().setAttribute('aria-label', locale?.['Map.Title'] ?? 'Map');
    nameCanvas(spec.locale);
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
    const checked: Checked = {map, name, warned: new Set(), spec: () => now, ready: () => alive && styled && state.get().loaded};
    const check = (kind: number, a?: unknown, b?: unknown) => { if (__DEV__) checks().then(m => m.check(checked, kind, a, b), () => {}); };
    if (spec.initialView) check(1147, 'initialView', spec.initialView);
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
    // The terrain of the base style, which a description without `terrain` gives back without a new style (#1143).
    let styleTerrain: TerrainSpecification | null = null;
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
    const restyle = (next: Given) => { styled = false; styledDark = darkOf(next.colorScheme); map.setStyle(styleFor(next.style, styledDark) as MapOptions['style'], {transformStyle: (_, style) => {
        styled = true;
        baseSources = style.sources ?? {};
        styleTerrain = style.terrain ?? null;
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
        }, () => { if (alive && turn === styleTurn) map.fire('error', {error: new Error('[map-jr-gl] E495 the style: the code for the images in metadata["map-jr:images"] did not load, and the map draws the style without them. Check that the files of the library are served next to it.')}); });
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
    const controls = new globalThis.Map<string, ReturnType<ControlSpec['create']>>(), placed = new globalThis.Map<string, ControlSpec['position']>();
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
    let run = 0, fresh = false; // the number of the last views of `reported` that belong to the latest movement (#1190)
    const waiting = new Set<() => void>(); // the promises of `once` that wait for an event
    let now = spec, alive = true, pointer: {x: number; y: number} | null = null, asking = false;
    // `hoverState`: the feature that has the state `hover` from the map.
    let lit: {source: string; sourceLayer?: string; id: number | string} | undefined;

    map.on('load', () => state.set({loaded: true, renderer: map.renderer as MapState['renderer']}));
    map.on('idle', () => state.set({idle: true}));
    map.on('error', e => {
        const error = e.error instanceof Error ? e.error : new Error(String(e.error));
        // (This listener takes the place of the report of the map itself: an error must not be lost in silence.)
        if (now.onError) now.onError(error, typeof e.sourceId === 'string' ? {sourceId: e.sourceId} : {}); else logError(error);
    });
    const moved = (moving: boolean) => {
        const view = viewOf();
        // (A new size of the map changes only `bounds`.)
        if (same(view, state.get().view) && view.bounds + '' === state.get().view.bounds + '') return state.set({moving, idle: false});
        if (fresh) { run = 0; fresh = false; }
        reported.push(view); run++;
        if (reported.length > 60) reported.shift();
        state.set({view, moving, idle: false});
        now.onViewChange?.(view);
    };
    map.on('movestart', () => { fresh = true; moved(true); });
    map.on('move', () => moved(true));
    map.on('moveend', () => moved(false));
    map.on('resize', () => moved(state.get().moving));
    // The first view is reported once, after `createMap` has returned, unless a move has reported a view before (#1135).
    queueMicrotask(() => {
        if (!alive || reported.length) return;
        const view = viewOf();
        reported.push(view);
        state.set({view});
        now.onViewChange?.(view);
    });

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
            if (top && top.id == null) check(9, top.layer.id, top.source);
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
    // style: a changed source, a source id that the style has, a changed `type`, `source` or
    // `source-layer` of a layer. A changed `minzoom` or `maxzoom` goes to `setLayerZoomRange` (#871). A new order of the layers, a new layer before one that stays
    // and another `before` move the layers of `layers` (#859).
    const edit = (next: StyleParts, before: StyleParts, differ: (a: unknown, b: unknown) => boolean) => {
        const was = before.layers ?? [], is = next.layers ?? [], ns = next.sources ?? {}, os = before.sources ?? {};
        const ids = (a: typeof is, b: typeof is) => a.filter(l => b.some(x => x.id === l.id)).map(l => l.id).join('\n');
        const kept = is.filter(l => was.some(w => w.id === l.id)), keys = ['paint', 'layout', 'filter', 'minzoom', 'maxzoom', 'id', 'before'];
        // (A new order, a new layer before one that stays, or another `before`: the layers of `layers` are added again
        // in their order, with the rule of `extended()`, as the style would have them (#859).)
        const moved = ids(is, was) !== ids(was, is) || is.some((l, i) => !kept.includes(l) && i < is.indexOf(kept[kept.length - 1])) || kept.some(l => differ(l.before, was.find(x => x.id === l.id)!.before));
        for (const id in ns) if (id in os ? differ(ns[id], os[id]) : map.getSource(id)) return false;
        for (const id in {...ns, ...os}) if (Object.hasOwn(baseSources, id)) return false;
        for (const l of kept) { const w = was.find(x => x.id === l.id)!; if (Object.keys({...l, ...w}).some(k => !keys.includes(k) && differ((l as Record<string, unknown>)[k], (w as Record<string, unknown>)[k]))) return false; }
        for (const w of was) if (!kept.some(l => l.id === w.id)) map.removeLayer(w.id);
        for (const id in os) if (!(id in ns)) { sent.delete(id); map.removeSource(id); }
        for (const id in ns) if (!(id in os)) { sent.delete(id); map.addSource(id, ns[id].type === 'geojson' && (ns[id] as {data?: unknown}).data == null && wantedData && id in wantedData ? {...ns[id], data: {type: 'FeatureCollection', features: []}} : ns[id]); }
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
        // (A changed `terrain` goes to `setTerrain`, after the sources that it can name. No `terrain` gives back that of the style, #1143.)
        if (differ(next.terrain, before.terrain)) map.setTerrain(next.terrain === undefined ? styleTerrain : next.terrain && copy(next.terrain));
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
        // (The layers are compared after `ref` is resolved, as in MapLibre GL JS: a new `layout` of a layer reaches the layers that name it, #1814.)
        const is = derefLayers(a.layers) as L[], was = derefLayers(b.layers) as L[], keys = ['paint', 'layout', 'filter', 'minzoom', 'maxzoom'];
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
            const p = map.addImage(name, spec ? spec.image : v as ImageSource, spec ?? {}).then(busy, (e: unknown) => {
                // (The message of a mistake in the pixels, E2233, names the image and the sizes, so it goes on as it is.)
                if (alive && images.get(name) === key) map.fire('error', {error: (e as Error)?.message?.startsWith('[map-jr-gl] E2233') ? e as Error : new Error(Object.hasOwn(wantedImages ?? {}, name) ? `[map-jr-gl] E20121 images: the image "${name}" did not load. Give an SVG document or the URL of an image that the page can read.` : `[map-jr-gl] E50121 the style: the image "${name}" did not load. Give an SVG document or the URL of an image that the page can read.`)});
            });
            adding.set(name, p);
        }
        return only && adding.get(only);
    };
    // (The map asks for an image that a layer names and that it does not have. The answer waits for the code of the images.)
    map.setMissingStyleImageResolver(name => { asked.add(name); return Promise.resolve(styleCode).then(() => putImages(name)) as Promise<void>; });
    // A change that gave the engine work makes the map not idle until the engine reports idle again (#411).
    const busy = () => { if (alive && state.get().idle && !map.areTilesLoaded()) state.set({idle: false}); };
    const apply = (input: MapDescription, before?: Given) => {
        const next = unset(input);
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
        else {
            // (Layers that went to the map as edits are checked now, as a new style is, and not only when the map is next idle; #1684.)
            // (A new style object that went to the map as edits is checked as a style is: its zoom curves too, #1765. The layers of the description are checked with the style that the map has, so that a `before` that names no layer warns, #1766.)
            if (__DEV__ && before && differ(next.style, before.style)) check(4, styleFor(next.style, styledDark));
            if (__DEV__ && before && next.layers && differ(next.layers, before.layers)) {
                const now = map.getStyle(), added = new Set(next.layers.map((l: {id: string}) => l?.id));
                check(4, {sources: now?.sources, layers: now?.layers.filter((l: {id: string}) => !added.has(l.id)) ?? []}, {sources: next.sources, layers: next.layers});
            }
            for (const id of madeData) if (!Object.hasOwn(next.data ?? {}, id)) { madeData.delete(id); sent.delete(id); map.removeSource(id); }
        }
        // (A font of a name that is new or changed is loaded; the new style of a restyle has the fonts already. A font
        // that is removed stays with the browser, and the labels keep it until the page is loaded again.)
        if (styled && !restyled && differ(next.fonts, before?.fonts)) {
            const changed: FontFaces = {};
            for (const name in next.fonts) if (differ(next.fonts[name], before?.fonts?.[name])) changed[name] = next.fonts[name];
            map.addFonts(fontFaces(absolute(changed)));
        }
        // (Before the view: a view past the antimeridian is constrained by the new setting.)
        if ((next.renderWorldCopies ?? true) !== (before?.renderWorldCopies ?? true) && before) { map.setRenderWorldCopies(next.renderWorldCopies ?? true); map.jumpTo({}); }
        if (next.view && !same(next.view, before?.view) && before) {
            if (!reported.some(v => same(next.view, v))) map.jumpTo(next.view);
            // (A view that the map reported is not applied. A view of the latest movement can be a late echo of a slow application, so only a view of an earlier movement is a stored view: #1190.)
            else if (__DEV__ && !state.get().moving && !same(next.view, state.get().view) && !(run && reported.slice(-run).some(v => same(next.view, v)))) check(1190);
        }
        if (next.minZoom !== before?.minZoom && before) map.setMinZoom(next.minZoom);
        if (next.maxZoom !== before?.maxZoom && before) map.setMaxZoom(next.maxZoom);
        if (next.maxPitch !== before?.maxPitch && before) map.setMaxPitch(next.maxPitch);
        if ((next.centerElevation ?? null) !== (before?.centerElevation ?? null)) map.setCenterElevation(next.centerElevation ?? null);
        if (differ(next.maxBounds, before?.maxBounds)) map.setMaxBounds(next.maxBounds as LngLatBoundsInput | null | undefined);
        if (differ(next.padding ?? 0, before?.padding ?? 0)) map.jumpTo({padding: next.padding ?? 0});
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
        if (relabel && before) { map.fire('_locale'); nameCanvas(next.locale); }
        if (next.controls !== before?.controls || relabel) {
            // (A control whose `position` changed is added again in its new corner; #1237. Of two items with one key, the
            // first wins, as below: the list is reversed so that the first sets the position; #1662.)
            const wanted = new globalThis.Map(relabel ? [] : (next.controls ?? []).map(c => [c.key, c.position] as const).reverse());
            for (const [key, c] of controls) if (!wanted.has(key) || wanted.get(key) !== placed.get(key)) { map.removeControl(c as any); controls.delete(key); placed.delete(key); }
            for (const c of next.controls ?? []) if (controls.has(c.key)) (controls.get(c.key) as any).update?.(c.options); else { const made = c.create(() => host); controls.set(c.key, made); placed.set(c.key, c.position); map.addControl(made, c.position); }
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

    const moveTo = ({duration, fly, bounds, fitPadding, fitMaxZoom, ...view}: MoveToOptions, name = 'moveTo') => {
        // (`fitPadding` is space for this one fit; the padding of the map belongs to the description.)
        // (The old names of the two options of a fit are left out, so that `padding` does not reach the camera; #1147.)
        if ('padding' in view || 'maxZoom' in view) { check(1147, name + '()', view); const {padding: _p, maxZoom: _m, ...rest} = view as MoveToOptions & {padding?: unknown; maxZoom?: unknown}; view = rest; }
        if (bounds) { const fit = map.cameraForBounds(bounds as LngLatBoundsInput, {padding: fitPadding, maxZoom: fitMaxZoom}); view = {bearing: fit.bearing, ...view, center: [fit.center.lng, fit.center.lat], zoom: fit.zoom}; }
        else if (fitPadding !== undefined || fitMaxZoom !== undefined) check(7);
        if (fly) map.flyTo({...view, duration, ...(fly === true ? {} : fly)}); else if (duration) map.easeTo({...view, duration}); else map.jumpTo(view);
    };
    const isPosition = (at: FeaturePlace): at is [number, number] => typeof (at as number[])[0] === 'number';
    /** Rejects with the message of the mistake `code`, or with `short` when the checks do not load. */
    const reject = (code: number, a: string, short: string) => checks().then(m => m.mistake(code, a), () => '[map-jr-gl] E' + code + ' ' + short).then(text => { throw withCode(new Error(text)); });
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
                // rejection is a mistake of the caller: it is an error of the map, once until the answer changes. The code E10022 is
                // the one of "The query has no answer", which the production files keep without the text; #2148.)
                const text = 'e' + (e as Error)?.message;
                if (alive && !stopped && text !== last && !text.includes('] E10022 ')) { last = text; map.fire('error', {error: e}); }
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
        if (!source?.getClusterLeaves) throw new Error(`E217 "${id}" is not a GeoJSON source of the style.`);
        return run(source);
    }).catch(e => { throw withCode(new Error(`[map-jr-gl] ${name}(): ${(e as Error)?.message?.replace(/^\[map-jr-gl\] /, '')}`)); });
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
            // (`data` is merged by key, and a key that is `null` is removed, #1160.)
            if (part.data && typeof part.data === 'object') {
                next.data = {...now.data};
                for (const id in part.data) if (part.data[id] == null) delete next.data[id]; else next.data[id] = part.data[id];
            }
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
            if (typeof options !== 'object' && options !== undefined) throw new Error(`E503 the third argument is ${options}. Pass {limit, offset}, for example clusterLeaves(sourceId, clusterId, {limit: 50, offset: 100}).`);
            return s.getClusterLeaves(clusterId, options?.limit, options?.offset);
        }),
        querySource,
        watchFeatures: (at, o, listener) => watch(at, undefined, () => queryFeatures(at, o), listener),
        watchSource: (id, at, o, listener) => watch(at, id, () => querySource(id, at, o), listener),
        queryElevation: (at, options) => map.queryElevation(at, options),
        toBlob: (type, quality) => map.toBlob(type, quality),
        moveTo,
        fitBounds: (bounds, o = {}) => moveTo({...o, bounds}, 'fitBounds'),
        project: lngLat => map.project(lngLat),
        unproject: point => { const p = map.unproject(point); return [p.lng, p.lat]; },
        overlay(element, o) {
            check(1647, 'overlay()', o);
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
            const set = (next: OverlayOptions) => {
                const again = !!next.popup !== !!now.popup || next.anchor !== now.anchor || String(next.offset) !== String(now.offset) || !!next.onClose !== !!now.onClose;
                // (Only a new position moves the element: a render during or after a drag that passes the same
                // `lngLat` again leaves it where the user put it.)
                const moved = String(next.lngLat) !== String(now.lngLat);
                now = next;
                if (!made) return;
                if (again) { const old = made; made = null; old.remove(); made = make(); return; }
                if (made instanceof Marker) made.setDraggable(!!next.draggable);
                if (moved) made.setLngLat(next.lngLat);
            };
            const overlay: MapOverlay = {
                update(next) { check(1647, 'update()', next); set(next); },
                // (An explicit `lngLat: undefined` keeps the position: the element cannot be placed without one.)
                patch(part) { check(1647, 'patch()', part); set({...now, ...part, lngLat: part?.lngLat ?? now.lngLat}); },
                remove() { const old = made; made = null; old?.remove(); },
            };
            return overlay;
        },
        listen(type, fn: (event: any) => void) { const w = (e: any) => fn(hostEvent(e)); map.on(type, w); return () => { map.off(type, w); }; },
        once(type) {
            return new Promise<any>((resolve, reject) => {
                const removed = () => new Error(`[map-jr-gl] E484 once("${type}"): the map was removed.`);
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
