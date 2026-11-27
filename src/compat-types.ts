// Types under the names that MapLibre GL JS uses, for TypeScript code that was written for MapLibre.
// This file has types only, so it adds nothing to the built files.
import type {Map} from './compat-map.ts';
import type {Map as CoreMap, MapEvent as CoreMapEvent, MapOptions as CoreMapOptions, RenderedFeature, RenderedQueryOptions, PaddingInput, RequestTransform, GeoJSONDiff} from './map.ts';
import type {CameraOptions as CoreCameraOptions} from './engine.ts';
import type {CameraInput, FlyOptions} from './map.ts';
import type {Control} from './controls.ts';
import type {LngLat, LngLatBounds, LngLatBoundsInput} from './lnglat.ts';
import type {AttributionControl} from './controls.ts';
import type {NavigationControl, ScaleControl, FullscreenControl, GeolocateControl, ScaleUnit} from './controls-more.ts';
import type {Anchor} from './markers.ts';
import type {PopupOffset} from './overlays.ts';
import type {ProtocolFunction} from './protocols.ts';
import type {FullscreenControl as CompatFullscreenControl, Marker, Popup} from './maplibre-compat.ts';

/** An event of the map. Its `target` is the map of this entry. */
export type MapEvent = CoreMapEvent & {target: Map};
/** The base of each map event. `originalEvent` is the DOM event that caused it, if there is one. */
export type MapLibreEvent<T = unknown> = MapEvent & {originalEvent?: T};
type Pointed<T> = MapEvent & {point: {x: number; y: number}; lngLat: LngLat; originalEvent: T; preventDefault(): void; readonly defaultPrevented: boolean};
/** A GeoJSON geometry. Narrow it by `type` before you read `coordinates` or `geometries`, as with the types of MapLibre GL JS. The geometry of a queried feature is never a `GeometryCollection` in this library. */
export type Geometry =
    | {type: 'Point'; coordinates: number[]} | {type: 'MultiPoint'; coordinates: number[][]}
    | {type: 'LineString'; coordinates: number[][]} | {type: 'MultiLineString'; coordinates: number[][][]}
    | {type: 'Polygon'; coordinates: number[][][]} | {type: 'MultiPolygon'; coordinates: number[][][][]}
    | {type: 'GeometryCollection'; geometries: Geometry[]};
/** A feature from `querySourceFeatures`. It has no style layer. */
export type GeoJSONFeature = Omit<RenderedFeature, 'geometry' | 'properties' | 'layer'> & {geometry: Geometry; properties: Record<string, any>};
/** A feature from `queryRenderedFeatures` or from an event of one layer, with the style layer that draws it. */
export type MapGeoJSONFeature = GeoJSONFeature & {layer: LayerSpecification};
export type MapMouseEvent = Pointed<MouseEvent>;
export type MapLayerMouseEvent = MapMouseEvent & {features?: MapGeoJSONFeature[]};
export type MapTouchEvent = Pointed<TouchEvent> & {points: {x: number; y: number}[]; lngLats: LngLat[]};
export type MapLayerTouchEvent = MapTouchEvent & {features?: MapGeoJSONFeature[]};
export type MapWheelEvent = MapEvent & {originalEvent: WheelEvent; preventDefault(): void; readonly defaultPrevented: boolean};
export type MapBoxZoomEvent = MapEvent & {originalEvent: MouseEvent; boxZoomBounds?: LngLatBounds};
export type MapLibreZoomEvent = MapBoxZoomEvent;
export type MapMovementEvent = MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
export type MapDataEvent = MapEvent & {dataType: 'source' | 'style'};
export type MapSourceDataEvent = MapDataEvent & {dataType: 'source'; sourceId: string; isSourceLoaded: boolean; sourceDataType?: MapSourceDataType};
/** What an event of the data of a source has in `sourceDataType`. */
export type MapSourceDataType = 'metadata' | 'content' | 'visibility' | 'idle';
export type MapStyleDataEvent = MapDataEvent & {dataType: 'style'};
export type MapStyleImageMissingEvent = MapEvent & {id: string};
export type MapContextEvent = MapEvent & {originalEvent?: WebGLContextEvent};
export type ErrorEvent = MapEvent & {error: Error};
type Each<K extends string, E> = {[P in K]: E};
/** The event that a listener of `map.on(type, listener)` gets, by the name of the event. */
export type MapEventType =
    Each<'click' | 'dblclick' | 'contextmenu' | 'mousedown' | 'mouseup' | 'mousemove' | 'mouseover' | 'mouseout' | 'mouseenter' | 'mouseleave', MapMouseEvent>
    & Each<'touchstart' | 'touchmove' | 'touchend' | 'touchcancel', MapTouchEvent>
    & Each<'wheel', MapWheelEvent>
    & Each<'movestart' | 'move' | 'moveend' | 'zoomstart' | 'zoom' | 'zoomend' | 'rotatestart' | 'rotate' | 'rotateend' | 'pitchstart' | 'pitch' | 'pitchend' | 'dragstart' | 'drag' | 'dragend', MapMovementEvent>
    & Each<'boxzoomstart' | 'boxzoomend' | 'boxzoomcancel', MapBoxZoomEvent>
    & Each<'load' | 'idle' | 'render' | 'resize' | 'remove' | 'style.load', MapLibreEvent>
    & Each<'webglcontextlost' | 'webglcontextrestored', MapContextEvent>
    & Each<'data' | 'dataloading', MapDataEvent>
    & Each<'sourcedata' | 'sourcedataloading', MapSourceDataEvent>
    & Each<'styledata' | 'styledataloading', MapStyleDataEvent>
    & {styleimagemissing: MapStyleImageMissingEvent; terrain: MapEvent & {terrain: TerrainSpecification | null}; projectiontransition: MapProjectionEvent; error: ErrorEvent};
/** The event of `projectiontransition`: `newProjection` is `mercator`, `globe` or `vertical-perspective`, as in MapLibre GL JS. */
export type MapProjectionEvent = MapEvent & {newProjection: string};
/** The event that a listener of `map.on(type, layerId, listener)` gets. The library fires these four names for a layer. */
export type MapLayerEventType = Each<'click' | 'mousemove' | 'mouseenter' | 'mouseleave', MapLayerMouseEvent>;

/**
 * The options of `new Map(options)`. The options of MapLibre GL JS that are listed here and not in the main API are
 * accepted with no effect (see docs/reference/maplibre-differences.md).
 */
export type MapOptions = Omit<CoreMapOptions, 'dragPan' | 'dragRotate'> & {
    /** Whether a drag pans the map. An object is accepted as `true` and warns once: its options have no effect. */
    dragPan?: boolean | DragPanOptions;
    /** Whether a drag with the right mouse button turns and tilts the map. An object is accepted as `true` and warns once: its options have no effect. */
    dragRotate?: boolean | DragRotateOptions;
    /** No effect: a value other than the default 0.8 warns once. */
    rotateSpeed?: number;
    /** No effect: a value other than the default -0.5 warns once. */
    pitchSpeed?: number;
    /** No effect: `false` warns once. */
    aroundCenter?: boolean;
    /** In the development build, `false` turns off the check of the style; the default is `true`. The production build checks no style. `validate` of `setStyle` wins for that style. */
    validateStyle?: boolean;
    /** The angle in degrees from north within which `snapToNorth` and the end of a gesture turn the map north. The default is 7, and 0 turns the snap off. */
    bearingSnap?: number;
    /** No effect: ideographs use the font list of the style. */
    localIdeographFontFamily?: string | false;
    /** No effect. */
    terrainSkirtLength?: 'auto' | 'none' | number;
    /** No effect: labels show and hide without a fade. */
    fadeDuration?: number;
    /** No effect: a drag with the right mouse button changes the bearing and the pitch. */
    pitchWithRotate?: boolean;
    /** Only `true` (the default): labels of different sources always collide with each other. `false` warns once and has no effect. */
    crossSourceCollisions?: boolean;
    /** `true` (the default): a tile is requested again when its `Cache-Control` or `Expires` says that it is out of date. With `false` a tile is never requested again for that reason. */
    refreshExpiredTiles?: boolean;
    /** Raster tiles are filtered anisotropically when the pitch is above this many degrees (0 to 180), as in MapLibre GL JS. The default is 20. */
    anisotropicFilterPitch?: number;
    /** The wheel zooms only with Ctrl (⌘ on a Mac), one finger scrolls the page, and a hint shows over the map, as in MapLibre GL JS. */
    cooperativeGestures?: boolean | object;
    /** The UI strings of the controls and of the hint of `cooperativeGestures`, with the keys of MapLibre GL JS (`'NavigationControl.ZoomIn'`). A key that is missing keeps the English text of this library. */
    locale?: Record<string, string>;
};
export type IControl = Control;
export type LngLatBoundsLike = LngLatBoundsInput;
export type PaddingOptions = Exclude<PaddingInput, number>;
export type RequestTransformFunction = RequestTransform;
export type RequestParameters = NonNullable<ReturnType<RequestTransform>>;
export type QueryRenderedFeaturesOptions = RenderedQueryOptions;
export type {GeoJSONDiff as GeoJSONSourceDiff} from './map.ts';
export type QuerySourceFeatureOptions = {sourceLayer?: string; filter?: unknown; validate?: boolean};
/**
 * What `map.addLayer` accepts: a layer of the style, or a custom layer. The `source` of a style layer can be the
 * description of a source, as in MapLibre GL JS.
 */
export type AddLayerObject = (Omit<LayerSpecification, 'source'> & {source?: string | SourceSpecification}) | CustomLayerInterface;
/**
 * The projection of a tile or of the world for a shader, as in MapLibre GL JS. In Mercator, `clippingPlane` is
 * `[0, 0, 0, 0]`, `projectionTransition` is 0, and `fallbackMatrix` is `mainMatrix`. On the globe, `mainMatrix` maps
 * the unit sphere to clip space, `clippingPlane` is the plane of the horizon, `projectionTransition` is the globeness
 * (1 for the globe, less while it turns into Mercator), and `fallbackMatrix` is the Mercator matrix.
 */
export type ProjectionData = {
    mainMatrix: Float32Array | Float64Array; tileMercatorCoords: [number, number, number, number]; clippingPlane: [number, number, number, number];
    projectionTransition: number; fallbackMatrix: Float32Array | Float64Array; clipAntimeridian: boolean;
};
/** The tile of `getProjectionData`. */
export type CustomLayerProjectionDataParams = {tileID: {canonical: {x: number; y: number; z: number}; wrap?: number}; aligned?: boolean; applyTerrainMatrix?: boolean; applyGlobeMatrix?: boolean};
/**
 * What `render` and `prerender` of a custom layer get: the fields of MapLibre GL JS 6, with values that put a point on
 * the same pixel. The near and the far plane, and so the depth, differ (see docs/reference/maplibre-differences.md). The
 * matrices are `Float64Array`s. `renderTerrainHeightMap` is never set.
 */
export type CustomRenderMethodInput = {
    farZ: number; nearZ: number; /** The vertical field of view in radians. */ fov: number;
    /** From world pixels (x and y from 0 to the size of the world) and meters (z) to clip space. */
    modelViewProjectionMatrix: Float64Array;
    /** From view space to clip space. */
    projectionMatrix: Float64Array;
    shaderData: {variantName: string; vertexShaderPrelude: string; define: string};
    /** `mainMatrix` maps a `MercatorCoordinate` (x, y and z) to clip space. */
    defaultProjectionData: ProjectionData;
    /** The projection of one tile: `mainMatrix` maps tile units (0 to 8192) to clip space. */
    getProjectionData(params: CustomLayerProjectionDataParams): ProjectionData;
    renderTerrainHeightMap?: undefined;
};
export type CustomRenderMethod = (gl: WebGL2RenderingContext, options: CustomRenderMethodInput) => void;
/**
 * A layer that draws with WebGL into the context of the map, as in MapLibre GL JS. It needs a map made with
 * `renderer: 'main'`. See "Custom layers" in docs/reference/maplibre-differences.md.
 */
export interface CustomLayerInterface {
    id: string; type: 'custom';
    /** `'3d'` draws with the depth test and shares the depth buffer; the default is `'2d'`. */
    renderingMode?: '2d' | '3d';
    render: CustomRenderMethod;
    prerender?: CustomRenderMethod;
    onAdd?(map: Map, gl: WebGL2RenderingContext): void;
    onRemove?(map: Map, gl: WebGL2RenderingContext): void;
}

export type AnimationOptions = {duration?: number; around?: [number, number]};
export type JumpToOptions = Parameters<Map['jumpTo']>[0];
/** `essential: true` animates the change also when the user asked the system for less motion. */
export type EaseToOptions = CameraInput & {duration?: number; around?: [number, number]; essential?: boolean; offset?: [number, number] | {x: number; y: number}; easing?: (t: number) => number};
export type FlyToOptions = EaseToOptions;
/**
 * The options of `map.fitBounds`, as in MapLibre GL JS: those of `flyTo`, `maxZoom`, and `linear`, which makes the fit ease as `easeTo`
 * does instead of flying. `padding` is space around the box, on top of the padding of the map.
 */
export type FitBoundsOptions = EaseToOptions & FlyOptions & {maxZoom?: number; linear?: boolean};
/** The camera of a map. `padding` is a number or an object with `top`, `right`, `bottom` and `left`, in pixels. */
export type CameraOptions = CameraInput;
/** A feature for `setFeatureState` and `getFeatureState`. Without an `id`, the methods do nothing. */
export type FeatureIdentifier = {source: string; sourceLayer?: string; id?: string | number};
export type CameraForBoundsOptions = NonNullable<Parameters<Map['cameraForBounds']>[1]>;
export type CenterZoomBearing = Pick<CoreCameraOptions, 'center' | 'zoom' | 'bearing'>;

/** Style JSON. The library reads the style as MapLibre does; these types do not check each property. */
export type ExpressionSpecification = [string, ...unknown[]];
export type FilterSpecification = ExpressionSpecification | boolean;
/** A value of a style property: the value, an expression, or a function of the legacy form (`{type, stops}`). */
export type PropertyValueSpecification<T> = T | ExpressionSpecification | {type?: string; property?: string; stops: unknown[]; [key: string]: unknown};
/** A layer of the style. The names of `paint` and `layout` are not checked here; the types of one layer type below check their prefix. */
export type LayerSpecification = {
    id: string; type: string; source?: string | SourceSpecification; 'source-layer'?: string; minzoom?: number; maxzoom?: number;
    filter?: any; paint?: Record<string, any>; layout?: Record<string, any>; metadata?: unknown;
};
/**
 * A layer of one type. TypeScript checks the prefix of each name in `paint` and `layout`: a name must start with the
 * type of the layer (for example `fill-` for a fill layer), and `layout` also accepts `visibility`. The rest of the
 * name and the values are not checked.
 */
type LayerOf<T extends string, P extends string = T, L extends string = P> = Omit<LayerSpecification, 'type' | 'source' | 'paint' | 'layout'> & {
    type: T; source?: string; paint?: {[K in `${P}-${string}`]?: any}; layout?: {[K in `${L}-${string}` | 'visibility']?: any};
};
export type BackgroundLayerSpecification = LayerOf<'background'>;
export type FillLayerSpecification = LayerOf<'fill'>;
export type FillExtrusionLayerSpecification = LayerOf<'fill-extrusion'>;
export type LineLayerSpecification = LayerOf<'line'>;
export type CircleLayerSpecification = LayerOf<'circle'>;
export type HeatmapLayerSpecification = LayerOf<'heatmap'>;
export type RasterLayerSpecification = LayerOf<'raster'>;
export type HillshadeLayerSpecification = LayerOf<'hillshade'>;
export type ColorReliefLayerSpecification = LayerOf<'color-relief'>;
export type SymbolLayerSpecification = LayerOf<'symbol', 'text' | 'icon', 'text' | 'icon' | 'symbol'>;
/**
 * The projection of a style: `{type: 'mercator'}`, `{type: 'globe'}`, `{type: 'vertical-perspective'}`, or an expression
 * of these names (see `projection` in docs/reference/description.md for what the globe draws).
 */
export type ProjectionSpecification = {type?: PropertyValueSpecification<string>};
export type SourceSpecification = {type: string; [key: string]: unknown};
export type TerrainSpecification = {source: string; exaggeration?: number};
export type LightSpecification = {anchor?: PropertyValueSpecification<'map' | 'viewport'>; position?: PropertyValueSpecification<[number, number, number]>; color?: PropertyValueSpecification<string>; intensity?: PropertyValueSpecification<number>};
export type StyleSpecification = {
    version: 8; name?: string; sources: Record<string, SourceSpecification>; layers: LayerSpecification[];
    sprite?: string | {id: string; url: string}[]; glyphs?: string; terrain?: TerrainSpecification; light?: LightSpecification; projection?: ProjectionSpecification;
    center?: [number, number]; zoom?: number; bearing?: number; pitch?: number; metadata?: unknown; [key: string]: unknown;
};
export type StyleSetterOptions = {validate?: boolean};
/**
 * The options of `map.setStyle`. The map always replaces the whole style, so `diff` has no effect on the result.
 * `transformStyle` gets the style before and the new style, and returns the style to use. In the development build,
 * `validate: false` skips the check of this style, and `validate: true` checks it; without `validate`, the option
 * `validateStyle` of `new Map()` applies. The production build checks no style.
 */
export type StyleSwapOptions = {diff?: boolean; validate?: boolean; /** No effect: ideographs use the font list of the style. */ localIdeographFontFamily?: string | false; transformStyle?: (previous: any, next: any) => any};
export type StyleImageMetadata = {pixelRatio?: number; sdf?: boolean; stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number]; textFitWidth?: string; textFitHeight?: string};

/**
 * What `map.getSource(id)` returns: the description of the source with its `id`. Which methods exist depends on the
 * type of the source. The entry also exports each name as a value for `instanceof`, which tests the `type`.
 */
export type Source = {id: string; type: string; [key: string]: any};
export type GeoJSONSource = Source & {
    setData(data: unknown): unknown; getData(): Promise<any>; updateData(diff: GeoJSONDiff): unknown;
    getClusterExpansionZoom(clusterId: number): Promise<number>; getClusterChildren(clusterId: number): Promise<any[]>;
    getClusterLeaves(clusterId: number, limit?: number, offset?: number): Promise<any[]>;
    setClusterOptions(options: SetClusterOptions): Promise<void>; getClusterOptions(): GetClusterOptions; getBounds(): Promise<LngLatBounds>;
};
export type VectorTileSource = Source;
export type RasterTileSource = Source;
export type RasterDEMTileSource = Source;
/** A canvas source: its `<canvas>` element (`undefined` until the code of canvas sources has loaded) and the methods of MapLibre GL JS. */
export type CanvasSource = Source & {getCanvas(): HTMLCanvasElement | undefined; play(): void; pause(): void; setCoordinates(coordinates: unknown): unknown};
/** A video source: its `<video>` element (`undefined` until the code of video sources has loaded) and the methods of MapLibre GL JS. */
export type VideoSource = Source & {getVideo(): HTMLVideoElement | undefined; play(): void; pause(): void; seek(seconds: number): void; setCoordinates(coordinates: unknown): unknown};
/** The base of an event. The events that the map fires are plain objects, not instances of the class `Event`. */
export type Event = MapEvent;
export type ImageSource = Source & {updateImage(options: {url?: string; coordinates?: unknown}): unknown; setCoordinates(coordinates: unknown): unknown};

// ---- More names of MapLibre GL JS that applications and wrappers write (issue #561). Each type has what this
// library accepts. A member that has no effect here says so in its comment.

/** The first argument of a constructor. */
type OptionsOf<C extends abstract new (...args: any) => unknown> = NonNullable<ConstructorParameters<C>[0]>;
/** The options of `new NavigationControl(options)`: `showZoom`, `showCompass` and `visualizePitch`. The library has no roll, so there is no `visualizeRoll`. */
export type NavigationControlOptions = OptionsOf<typeof NavigationControl>;
/**
 * The options of `new GeolocateControl(options)`. `zoom` is the lowest zoom that the map takes at the position. Without
 * `zoom`, the map fits the accuracy circle with `fitBoundsOptions` (default `{maxZoom: 15}`). With `trackUserLocation`,
 * `showUserLocation` and `showAccuracyCircle` (both default `true`) show the dot and the accuracy
 * circle. The circle is never shown when `showUserLocation` is `false`.
 */
export type GeolocateControlOptions = OptionsOf<typeof GeolocateControl>;
/** The options of `new FullscreenControl(options)`. `container` is the element that goes fullscreen (default: the container of the map). */
export type FullscreenControlOptions = OptionsOf<typeof FullscreenControl>;
/** The options of `new ScaleControl(options)`: `maxWidth` in pixels and `unit`. */
export type ScaleControlOptions = OptionsOf<typeof ScaleControl>;
/** The options of `new AttributionControl(options)`: `compact` and `customAttribution`. */
export type AttributionControlOptions = OptionsOf<typeof AttributionControl>;
/**
 * The options of `new LogoControl(options)`. `compact` has no effect and writes one warning: this library has no logo,
 * and the control adds an empty element.
 */
export type LogoControlOptions = {compact?: boolean};
/** The unit of the `ScaleControl`. */
export type Unit = ScaleUnit;
/** The part of a marker or popup that sits at the position. It is the same type as `Anchor`. */
export type PositionAnchor = Anchor;
/** The values of `rotationAlignment` and `pitchAlignment` of a marker. */
export type Alignment = 'map' | 'viewport' | 'auto';
/**
 * The offset of a popup in pixels: one distance, `[x, y]`, or `[x, y]` for each anchor. MapLibre GL JS also accepts a
 * `Point` in these places, and this library does not.
 */
export type Offset = PopupOffset;

/** A listener of `on`, `once` and `off`. */
export type Listener<E = MapLibreEvent> = (event: E) => any;
/** What `map.on` returns, as in MapLibre GL JS: `unsubscribe()` removes the listener that `on` added. */
export interface Subscription { unsubscribe(): void }
/** The events of one object by name, as the type parameter of `Evented` in MapLibre GL JS. */
export type EventTypeMap = Record<string, {type: string; target?: unknown}>;
export type ErrorEventType = {error: ErrorEvent};
type Fired<T, D = {}> = {type: string; target: T} & D;
/** The events that a `Marker` fires on itself. A click on a marker fires `click` on the marker and then on the map. */
export type MarkerEventType = Each<'dragstart' | 'drag' | 'dragend', Fired<Marker>> & {click: Fired<Marker, {originalEvent: MouseEvent}>};
/** The events that a `Popup` fires on itself. */
export type PopupEventType = Each<'open' | 'close', Fired<Popup>>;
/** The events that a `FullscreenControl` of this entry fires on itself. */
export type FullscreenControlEventType = Each<'fullscreenstart' | 'fullscreenend', Fired<CompatFullscreenControl>>;
/** The events that a `GeolocateControl` fires on itself. The event of `error` has the `code` and the `message` of the `GeolocationPositionError`. */
export type GeolocateControlEventType =
    Each<'geolocate' | 'outofmaxbounds', Fired<GeolocateControl, {coords: GeolocationCoordinates; timestamp: number}>>
    & Each<'trackuserlocationstart' | 'trackuserlocationend' | 'userlocationfocus' | 'userlocationlostfocus', Fired<GeolocateControl>>
    & {error: Fired<GeolocateControl, {code: number; message: string}>};

/** The value of `cooperativeGestures`. */
export type GestureOptions = boolean;
/**
 * The options of `map.dragPan.enable(options)` in MapLibre GL JS. They have no effect: `enable(options)` turns the
 * handler on and warns once. An object as the option `dragPan` of `new Map()` turns it on and warns once.
 */
export type DragPanOptions = {linearity?: number; easing?: (t: number) => number; deceleration?: number; maxSpeed?: number};
/** The options of the handlers of MapLibre GL JS that zoom around the center. They have no effect, as `DragPanOptions`. */
export type AroundCenterOptions = {around: 'center'};
/**
 * The options of `map.dragRotate.enable(options)` in MapLibre GL JS. They have no effect: `enable(options)` turns the
 * handler on and warns once. An object as the option `dragRotate` of `new Map()` turns it on and warns once.
 */
export type DragRotateOptions = {around?: 'center'; movement?: 'circular' | 'linear'} | {around: 'pointer'};

/** The `id` of a feature in the diff of `updateData`. */
export type GeoJSONFeatureId = number | string;
/** The change of one feature in the diff of `updateData`. */
export type GeoJSONFeatureDiff = NonNullable<GeoJSONDiff['update']>[number];
/** The cluster options that `setClusterOptions` of a GeoJSON source takes. An option that is left out keeps its value. */
export type SetClusterOptions = {cluster?: boolean; clusterMaxZoom?: number; clusterRadius?: number};
/** The cluster options of a GeoJSON source, as `getClusterOptions` gives them. */
export type GetClusterOptions = Required<SetClusterOptions>;
/** The four corners of an image source: top left, top right, bottom right and bottom left, each `[lng, lat]`. */
export type Coordinates = [[number, number], [number, number], [number, number], [number, number]];
/**
 * The options of `updateImage` of an image source: `url` and `coordinates`. MapLibre GL JS 6.17 also accepts `image`
 * in place of `url`, which this type does not have.
 */
export type UpdateImageOptions = Parameters<ImageSource['updateImage']>[0];
/**
 * The description of a canvas source of MapLibre GL JS. This library does not draw canvas sources (see "What is not
 * available" in docs/reference/maplibre-differences.md).
 */
export type CanvasSourceSpecification = {type: 'canvas'; coordinates: Coordinates; animate?: boolean; canvas?: string | HTMLCanvasElement};

/**
 * An image for `map.addImage` as an object with pixels, as in MapLibre GL JS. The map reads `data` (RGBA, `width` ×
 * `height` × 4 bytes) when the image is added. `onAdd(map, id)` is called when the image is added, and `onRemove()` when
 * it is removed, replaced or the map is removed. `render()` is called after each frame that the map draws; when it
 * returns true and the pixels changed, the map reads `data` again and draws it in the next frame. As in MapLibre GL JS, this does not repaint:
 * call `map.triggerRepaint()` to animate. Unlike MapLibre GL JS, `render` runs after a frame and not before it, so new
 * pixels show one frame later; it runs also while no layer uses the image; and `setStyle` keeps the image with `diff` and
 * drops it with `diff: false`, and neither calls `onRemove`. A `data` that is not pixels (the WebGL form of MapLibre GL JS) is not supported.
 */
export interface StyleImageInterface {
    width: number; height: number; data: Uint8Array | Uint8ClampedArray;
    render?: () => boolean; onAdd?: (map: Map, id: string) => void; onRemove?: () => void;
}
/**
 * The `data` of what `map.getImage` returns. An image that was added as pixels, a canvas, an image element or a bitmap
 * has `{width, height, data}` with RGBA pixels. An image that was added as a URL or as SVG text has that string.
 */
export type StyleImageData = {data: Parameters<CoreMap['addImage']>[1]};
/** The function of `map.setMissingStyleImageResolver`: it gets the name of an image that the style asks for, and it can call `map.addImage`. */
export type MissingStyleImageResolver = NonNullable<Parameters<CoreMap['setMissingStyleImageResolver']>[0]>;
/** The function of `transformStyle`: it gets the style before (`undefined` for the first style) and the new style, and returns the style to use. */
export type TransformStyleFunction = (previous: StyleSpecification | undefined, next: StyleSpecification) => StyleSpecification;
/**
 * The options of a style in MapLibre GL JS. They have no effect in `map.setStyle`, which reads only `transformStyle`
 * of its options. Set the global state with `map.setGlobalStateProperty` or with `state` in the style.
 */
export type StyleOptions = {validate?: boolean; localIdeographFontFamily?: string | false; globalState?: Record<string, any>};
/**
 * The kind of a request, the second argument of `transformRequest`. MapLibre GL JS declares a `const enum` with these
 * values. The library also passes `'Font'` for a font file, and it never passes `'Unknown'`.
 */
export type ResourceType = 'Glyphs' | 'Image' | 'Source' | 'SpriteImage' | 'SpriteJSON' | 'Style' | 'Tile' | 'Unknown' | 'Font';
/** The function of `addProtocol`. It is the same type as `ProtocolFunction`. */
export type AddProtocolAction = ProtocolFunction;
/** What `getProjectionData` of a custom layer returns. It is the same type as `ProjectionData`. */
export type CustomLayerProjectionData = ProjectionData;
