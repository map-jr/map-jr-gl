// The main entry of the library: a map from one description, with state that code can watch (see host.ts).
// The entry with the API of MapLibre GL JS is `@map-jr/map-jr-gl/maplibre-compat`.
export {createMap, type ControlSpec, type FeatureOptions, type FeaturePlace, type MapHost, type StyleExtension, type MapOverlay, type OverlayOptions, type MapSpec, type ImageInput, type ImageSource, type MapSetup, type MapState, type MapPointer, type View, type ViewInput, type InitialView, type Position, type MapEvents, type MapEventBase, type MapDragEvent, type MapPointerEvent, type MapTouchEvent, type MapDataEvent} from './host.ts';
export {createStore, type Readable, type Store} from './store.ts';
export {addProtocol, removeProtocol, type ProtocolFunction} from './protocols.ts';
export {configure, supported, type LoadOptions} from './loader.ts';
export type {ImageOptions, RenderedFeature, StyleLayer} from './map.ts';
export type {MarkerLayerOptions, MarkerInput, Anchor} from './markers.ts';
export type {FontSource} from './engine.ts';
export type {QueriedFeature} from './query.ts';
export type {StyleSpecification, SourceSpecification, LayerSpecification, BackgroundLayerSpecification, FillLayerSpecification, FillExtrusionLayerSpecification, LineLayerSpecification, CircleLayerSpecification, HeatmapLayerSpecification, RasterLayerSpecification, HillshadeLayerSpecification, SymbolLayerSpecification, ExpressionSpecification, FilterSpecification, ProjectionSpecification, TerrainSpecification, LightSpecification} from './compat-types.ts';
