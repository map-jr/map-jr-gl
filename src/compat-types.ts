// Types under the names that MapLibre GL JS uses, for TypeScript code that was written for MapLibre.
// This file has types only, so it adds nothing to the built files.
import type {Map} from './compat-map.ts';
import type {Map as CoreMap, MapEvent as CoreMapEvent, MapOptions as CoreMapOptions, RenderedFeature, RenderedQueryOptions, PaddingInput, RequestTransform, GeoJSONDiff} from './map.ts';
import type {CameraOptions as CoreCameraOptions} from './engine.ts';
import type {CameraInput} from './map.ts';
import type {Control} from './controls.ts';
import type {LngLat, LngLatBounds, LngLatBoundsInput} from './lnglat.ts';

/** An event of the map. Its `target` is the map of this entry. */
export type MapEvent = CoreMapEvent & {target: Map};
/** The base of each map event. `originalEvent` is the DOM event that caused it, if there is one. */
export type MapLibreEvent<T = unknown> = MapEvent & {originalEvent?: T};
type Pointed<T> = MapEvent & {point: {x: number; y: number}; lngLat: LngLat; originalEvent: T; preventDefault(): void; readonly defaultPrevented: boolean};
/** A GeoJSON geometry. Narrow it by `type` before you read `coordinates`, as with the types of MapLibre GL JS. */
export type Geometry =
    | {type: 'Point'; coordinates: number[]} | {type: 'MultiPoint'; coordinates: number[][]}
    | {type: 'LineString'; coordinates: number[][]} | {type: 'MultiLineString'; coordinates: number[][][]}
    | {type: 'Polygon'; coordinates: number[][][]} | {type: 'MultiPolygon'; coordinates: number[][][][]};
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
export type MapSourceDataEvent = MapDataEvent & {dataType: 'source'; sourceId: string; isSourceLoaded: boolean; sourceDataType?: 'metadata' | 'content' | 'visibility' | 'idle'};
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
    & {styleimagemissing: MapStyleImageMissingEvent; terrain: MapEvent & {terrain: TerrainSpecification | null}; error: ErrorEvent};
/** The event that a listener of `map.on(type, layerId, listener)` gets. The library fires these four names for a layer. */
export type MapLayerEventType = Each<'click' | 'mousemove' | 'mouseenter' | 'mouseleave', MapLayerMouseEvent>;

/**
 * The options of `new Map(options)`. The options of MapLibre GL JS that are listed here and not in the main API are
 * accepted with no effect (see docs/maplibre-compatibility.md).
 */
export type MapOptions = CoreMapOptions & {
    /** No effect: labels show and hide without a fade. */
    fadeDuration?: number;
    /** No effect: a drag with the right mouse button changes the bearing and the pitch. */
    pitchWithRotate?: boolean;
    /** No effect, and the map writes one warning when it is set. */
    cooperativeGestures?: boolean | object;
};
export type IControl = Control;
export type LngLatBoundsLike = LngLatBoundsInput;
export type PaddingOptions = Exclude<PaddingInput, number>;
export type RequestTransformFunction = RequestTransform;
export type RequestParameters = NonNullable<ReturnType<RequestTransform>>;
export type QueryRenderedFeaturesOptions = RenderedQueryOptions;
export type {GeoJSONDiff as GeoJSONSourceDiff} from './map.ts';
export type QuerySourceFeatureOptions = {sourceLayer?: string; filter?: unknown; validate?: boolean};
/** What `map.addLayer` accepts: a layer of the style. Its `source` can be the description of a source, as in MapLibre GL JS. */
export type AddLayerObject = Omit<LayerSpecification, 'source'> & {source?: string | SourceSpecification};

export type AnimationOptions = {duration?: number; around?: [number, number]};
export type JumpToOptions = Parameters<Map['jumpTo']>[0];
/** `essential: true` animates the change also when the user asked the system for less motion. */
export type EaseToOptions = CameraInput & {duration?: number; around?: [number, number]; essential?: boolean};
export type FlyToOptions = EaseToOptions;
/** The options of `map.fitBounds`. `speed`, `curve` and `linear` have no effect: the map always eases to the bounds. */
export type FitBoundsOptions = NonNullable<Parameters<CoreMap['fitBounds']>[1]> & {essential?: boolean; speed?: number; curve?: number; linear?: boolean};
/** The camera of a map. `padding` is a number or an object with `top`, `right`, `bottom` and `left`, in pixels. */
export type CameraOptions = CameraInput;
/** A feature for `setFeatureState` and `getFeatureState`. Without an `id`, the methods write a warning and do nothing. */
export type FeatureIdentifier = {source: string; sourceLayer?: string; id?: string | number};
export type CameraForBoundsOptions = NonNullable<Parameters<Map['cameraForBounds']>[1]>;
export type CenterZoomBearing = Pick<CoreCameraOptions, 'center' | 'zoom' | 'bearing'>;

/** Style JSON. The library reads the style as MapLibre does; these types do not check each property. */
export type ExpressionSpecification = [string, ...unknown[]];
export type FilterSpecification = ExpressionSpecification | boolean;
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
export type SymbolLayerSpecification = LayerOf<'symbol', 'text' | 'icon', 'text' | 'icon' | 'symbol'>;
/** The projection of a style. Only `mercator` is drawn; another projection writes one warning. */
export type ProjectionSpecification = {type?: string | ExpressionSpecification};
export type SourceSpecification = {type: string; [key: string]: unknown};
export type TerrainSpecification = {source: string; exaggeration?: number};
export type LightSpecification = {anchor?: 'map' | 'viewport'; position?: [number, number, number] | ExpressionSpecification; color?: string | ExpressionSpecification; intensity?: number | ExpressionSpecification};
export type StyleSpecification = {
    version: 8; name?: string; sources: Record<string, SourceSpecification>; layers: LayerSpecification[];
    sprite?: string | {id: string; url: string}[]; glyphs?: string; terrain?: TerrainSpecification; light?: LightSpecification;
    center?: [number, number]; zoom?: number; bearing?: number; pitch?: number; metadata?: unknown; [key: string]: unknown;
};
export type StyleSetterOptions = {validate?: boolean};
/**
 * The options of `map.setStyle`. The map always replaces the whole style, so `diff` has no effect on the result.
 * `transformStyle` gets the style before and the new style, and returns the style to use.
 */
export type StyleSwapOptions = {diff?: boolean; transformStyle?: (previous: any, next: any) => any};
export type StyleImageMetadata = {pixelRatio?: number; sdf?: boolean; stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number]; textFitWidth?: string; textFitHeight?: string};

/**
 * What `map.getSource(id)` returns: the description of the source with its `id`. Which methods exist depends on the
 * type of the source. These names are types only: a source of another type does not have the methods of the name.
 */
export type Source = {id: string; type: string; [key: string]: any};
export type GeoJSONSource = Source & {
    setData(data: unknown): unknown; getData(): Promise<any>; updateData(diff: GeoJSONDiff): unknown;
    getClusterExpansionZoom(clusterId: number): Promise<number>; getClusterChildren(clusterId: number): Promise<any[]>;
    getClusterLeaves(clusterId: number, limit?: number, offset?: number): Promise<any[]>;
};
export type VectorTileSource = Source;
export type RasterTileSource = Source;
export type RasterDEMTileSource = Source;
export type ImageSource = Source & {updateImage(options: {url?: string; coordinates?: unknown}): unknown; setCoordinates(coordinates: unknown): unknown};
