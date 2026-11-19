// The types that scripts/reference.mjs writes as tables. A block `<!-- ref:Name:start -->` of a page names one of
// these types, and `<!-- ref:Name.member:start -->` one method of it. Add a type here to give a page a new table.
// (Each is an alias of its own: the script reads the aliases of this file, and a re-export is not one.)
import type * as host from '../../src/host.ts';
import type * as controls from '../../src/control-specs.ts';
import type * as react from '../../src/react.ts';
import type * as svelte from '../../src/svelte.ts';
import type * as element from '../../src/element.ts';
import type * as server from '../../src/server.ts';
import type * as compat from '../../src/maplibre-compat.ts';
import type {MapJr as VueMapJr} from '../../src/vue.ts';

export type MapDescription = host.MapDescription;
export type MapSetup = host.MapSetup;
export type MapInstance = host.MapInstance;
export type MapState = host.MapState;
export type MapEvents = host.MapEvents;
export type AttributionOptions = host.AttributionOptions;
export type View = host.View;
export type PointerPosition = host.PointerPosition;
export type MapEventBase = host.MapEventBase;
export type MapPointerEvent = host.MapPointerEvent;
export type MapDragEvent = host.MapDragEvent;
export type MapTouchEvent = host.MapTouchEvent;
export type MapDataEvent = host.MapDataEvent;
export type ViewInput = host.ViewInput;
export type InitialView = host.InitialView;
export type MoveToOptions = host.MoveToOptions;
export type OverlayOptions = host.OverlayOptions;
export type NavigationOptions = controls.NavigationOptions;
export type ScaleOptions = controls.ScaleOptions;
export type GeolocateOptions = controls.GeolocateOptions;
export type TerrainOptions = controls.TerrainOptions;
/** The props of the Vue component `MapJr` of `@map-jr/map-jr-gl/vue`. */
export type VueMapJrProps = InstanceType<typeof VueMapJr>['$props'];
/** The props of the React component `MapJr` of `@map-jr/map-jr-gl/react`. */
export type ReactMapJrProps = react.MapJrProps;
/** The options of the Svelte action `mapJr` of `@map-jr/map-jr-gl/svelte`. */
export type SvelteMapAction = svelte.MapAction;
export type MapJrElement = element.MapJrElement;
export type RenderOptions = server.RenderOptions;
export type RenderResult = server.RenderResult;
export type ElementRenderOptions = server.ElementRenderOptions;
export type ImageOptions = server.ImageOptions;
export type ImageResult = server.ImageResult;
/** The class `Map` of `@map-jr/map-jr-gl/maplibre-compat`. */
export type CompatMap = compat.Map;
export type MarkerOptions = compat.MarkerOptions;
export type PopupOptions = compat.PopupOptions;
