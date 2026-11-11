// The main entry of the library: a map from one description, with state that code can watch (see host.ts).
// The entry with the API of MapLibre GL JS is `map-jr-gl/maplibre-compat`.
export {createMap, type ControlSpec, type MapHost, type MapOverlay, type OverlayOptions, type MapSpec, type MapSetup, type MapState, type MapPointer, type View} from './host.ts';
export {createStore, type Readable, type Store} from './store.ts';
export {addProtocol, removeProtocol, type ProtocolFunction} from './protocols.ts';
export {configure, type LoadOptions} from './loader.ts';
export type {RenderedFeature} from './map.ts';
export type {MarkerLayerOptions, MarkerInput, Anchor} from './markers.ts';
export type {FontSource} from './engine.ts';
export type {QueriedFeature} from './query.ts';
