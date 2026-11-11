// Types under the names that MapLibre GL JS uses, for TypeScript code that was written for MapLibre.
// This file has types only, so it adds nothing to the built files.
import type {Map, MapEvent, RenderedFeature, RenderedQueryOptions, PaddingInput, RequestTransform} from './map.ts';
import type {CameraOptions} from './engine.ts';
import type {Control} from './controls.ts';
import type {LngLat, LngLatBounds, LngLatBoundsInput} from './lnglat.ts';
import type {LayerJSON} from './resolve.ts';

/** The base of each map event. `originalEvent` is the DOM event that caused it, if there is one. */
export type MapLibreEvent<T = unknown> = MapEvent & {originalEvent?: T};
type Pointed<T> = MapEvent & {point: {x: number; y: number}; lngLat: LngLat; originalEvent: T; preventDefault(): void; readonly defaultPrevented: boolean};
export type MapGeoJSONFeature = RenderedFeature;
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
export type MapEventType = Record<string, MapEvent>;

export type IControl = Control;
export type LngLatBoundsLike = LngLatBoundsInput;
export type PaddingOptions = Exclude<PaddingInput, number>;
export type RequestTransformFunction = RequestTransform;
export type RequestParameters = NonNullable<ReturnType<RequestTransform>>;
export type QueryRenderedFeaturesOptions = RenderedQueryOptions;
export type {GeoJSONDiff as GeoJSONSourceDiff} from './map.ts';
export type QuerySourceFeatureOptions = {sourceLayer?: string; filter?: unknown; validate?: boolean};

export type AnimationOptions = {duration?: number; around?: [number, number]};
export type JumpToOptions = Parameters<Map['jumpTo']>[0];
export type EaseToOptions = Parameters<Map['easeTo']>[0];
export type FlyToOptions = Parameters<Map['flyTo']>[0];
export type FitBoundsOptions = NonNullable<Parameters<Map['fitBounds']>[1]>;
export type CameraForBoundsOptions = NonNullable<Parameters<Map['cameraForBounds']>[1]>;
export type CenterZoomBearing = Pick<CameraOptions, 'center' | 'zoom' | 'bearing'>;

/** Style JSON. The library reads the style as MapLibre does; these types do not check each property. */
export type ExpressionSpecification = [string, ...unknown[]];
export type FilterSpecification = ExpressionSpecification | boolean;
export type LayerSpecification = LayerJSON;
export type SourceSpecification = {type: string; [key: string]: unknown};
export type TerrainSpecification = {source: string; exaggeration?: number};
export type LightSpecification = {anchor?: 'map' | 'viewport'; position?: unknown; color?: unknown; intensity?: unknown};
export type StyleSpecification = {
    version: 8; name?: string; sources: Record<string, SourceSpecification>; layers: LayerSpecification[];
    sprite?: string | {id: string; url: string}[]; glyphs?: string; terrain?: TerrainSpecification; light?: LightSpecification;
    center?: [number, number]; zoom?: number; bearing?: number; pitch?: number; metadata?: unknown; [key: string]: unknown;
};
export type StyleSetterOptions = {validate?: boolean};
export type StyleImageMetadata = {pixelRatio?: number; sdf?: boolean; stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number]; textFitWidth?: string; textFitHeight?: string};

/** What `map.getSource(id)` returns. Which methods exist depends on the type of the source. */
export type Source = NonNullable<ReturnType<Map['getSource']>>;
export type GeoJSONSource = Source;
export type VectorTileSource = Source;
export type RasterTileSource = Source;
export type RasterDEMTileSource = Source;
export type ImageSource = Source;
