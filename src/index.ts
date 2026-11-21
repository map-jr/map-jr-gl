// The main entry of the library: a map from one description, with state that code can watch (see host.ts).
// The entry with the API of MapLibre GL JS is `@map-jr/map-jr-gl/maplibre-compat`.
export {createMap, type ControlSpec, type FeatureOptions, type FeaturePlace, type SourceOptions, type MapInstance, type MapOverlay, type OverlayOptions, type MapDescription, type ImageInput, type ImageSource, type MapSetup, type AttributionOptions, type MapState, type MapPointer, type PointerPosition, type View, type ViewInput, type InitialView, type MoveToOptions, type PaddingInput, type Position, type Bounds, type GeoJSON, type GeoJSONGeometry, type GeoJSONFeature, type LayerInput, type SourceInput, type ClusterFeature, type MapEvents, type MapEventBase, type MapDragEvent, type MapPointerEvent, type MapTouchEvent, type MapDataEvent} from './host.ts';
export {points, type PointsOptions, type PointFeature, type PointCollection} from './points.ts';
export {defaultPin} from './overlays.ts';
export {createStore, type Readable, type Store} from './store.ts';
export {addProtocol, removeProtocol, type ProtocolFunction} from './protocols.ts';
export {configure, supported, type LoadOptions} from './loader.ts';
export type {FlyOptions, ImageOptions, RenderedFeature, RequestTransform, StyleLayer} from './map.ts';
export type {LngLatBounds, LngLatBoundsInput, LngLatInput} from './lnglat.ts';
export type {Anchor} from './markers.ts';
export type {FontFaces} from './resolve.ts';
export type {QueriedFeature} from './query.ts';
export type {StyleSpecification, SourceSpecification, LayerSpecification, BackgroundLayerSpecification, FillLayerSpecification, FillExtrusionLayerSpecification, LineLayerSpecification, CircleLayerSpecification, HeatmapLayerSpecification, RasterLayerSpecification, HillshadeLayerSpecification, ColorReliefLayerSpecification, SymbolLayerSpecification, ExpressionSpecification, FilterSpecification, ProjectionSpecification, TerrainSpecification, LightSpecification} from './compat-types.ts';
