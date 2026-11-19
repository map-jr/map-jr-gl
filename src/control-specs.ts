/**
 * Controls for the main API: `import {navigation, scale} from '@map-jr/map-jr-gl/controls'`, then
 * `createMap(el, {controls: [navigation(), scale({position: 'bottom-left'})]})`.
 * Each function returns a description of a control. The map adds the control, and removes it when a later
 * description of the map does not have it. Importing these functions does not load the map: the
 * code of the controls loads when the map adds the first one.
 */
import type * as More from './controls-more.ts';
import type {Map} from './map.ts';
import type {Control, ControlPosition} from './controls.ts';
import type {ControlSpec, MapInstance} from './host.ts';

// The control classes import the map, so this file loads them with `import()` when the map adds a control. A page
// that imports a control function before it makes the map then does not download the map with it (#160).
// `create()` stays synchronous: it returns a stand-in, which puts the element of the real control in its place once
// the file has loaded.
const spec = <O extends object, M = typeof More>(name: string, make: (m: M, options: O, instance?: () => MapInstance) => Control, load: () => Promise<M> = () => import('./controls-more.ts') as Promise<M>) => (options: O & {position?: ControlPosition} = {} as O) => {
    const {position, ...rest} = options;
    const create = (instance?: () => MapInstance): Control => {
        let real: Control | undefined, added = 0;
        const slot = document.createElement('div');
        slot.hidden = true;
        return {
            onAdd(map: Map) {
                const now = ++added;
                load().then(m => {
                    if (now !== added || !slot.parentNode) return; // removed (or added again) while the file loaded
                    real = make(m, rest as O, instance);
                    slot.replaceWith(real.onAdd(map));
                }, e => console.error(`[map-jr-gl] The control "${name}" could not be loaded. Check that the files of the library are served.`, e));
                return slot;
            },
            onRemove(map: Map) { added++; slot.remove(); real?.onRemove(map); real = undefined; },
        };
    };
    return {key: name + JSON.stringify(options), position, create} as ControlSpec;
};
/** Buttons to zoom in and out, and a compass that turns the map to the north. With `visualizePitch: true`, the compass also shows and resets the pitch. */
export const navigation = spec('navigation', (m, o: NavigationOptions) => new m.NavigationControl(o));
/** A scale bar. */
export const scale = spec('scale', (m, o: ScaleOptions) => new m.ScaleControl(o));
/** A button that shows the map on the full screen. */
export const fullscreen = spec('fullscreen', (m, _o: {}) => new m.FullscreenControl());
/** A button that moves the map to the position of the user. With `trackUserLocation`, it turns tracking on and off and shows a dot at the position. */
export const geolocate = spec('geolocate', (m, o: GeolocateOptions) => new m.GeolocateControl(o));
/** A button that turns 3D terrain on and off. `source` is the id of an elevation source of the style. */
export const terrain = spec('terrain', (m, o: TerrainOptions) => new m.TerrainControl(o));
/** A button that switches the projection between the globe and Mercator. */
export const globe = spec('globe', (m, _o: {}) => new m.GlobeControl());
/**
 * A button that switches the colour scheme of the map between light and dark, and shows the scheme that the map has
 * (a prototype). It changes `colorScheme` of the description and calls `onColorSchemeChange`.
 */
export const colorScheme = spec('colorScheme', (m, _o: {}, instance) => new m.ColorSchemeControl(instance), () => import('./color-scheme-control.ts'));
/**
 * A control of your own. Give `element` (the map puts it into the corner and takes it out again), or `onAdd` and
 * `onRemove` as MapLibre GL JS controls have them (`onAdd` receives the core map and returns the element).
 * `key` names the control: a description with the same `key` keeps the control that the map has.
 */
export const custom = (options: {key: string; position?: ControlPosition} & ({element: HTMLElement} | Control)): ControlSpec => {
    const {key, position} = options;
    if (__DEV__ && (typeof key !== 'string' || !('element' in options || 'onAdd' in options))) throw new Error('[map-jr-gl] custom(): write custom({key: "my-control", element}) or custom({key: "my-control", onAdd(map) { return element; }, onRemove() {}}).');
    return {key: 'custom:' + key, position, create: () => 'element' in options ? {
        onAdd: () => { options.element.classList.add('map-jr-ctrl', 'maplibregl-ctrl'); return options.element; },
        onRemove: () => options.element.remove(),
    } : options};
};
/** The options of `navigation()`. */
export interface NavigationOptions {
    /** Whether the control shows the buttons to zoom in and out. @default true */
    showZoom?: boolean;
    /** Whether the control shows the compass. @default true */
    showCompass?: boolean;
    /** Whether the compass also shows the pitch, a drag of it also pitches the map, and a click resets the pitch. @default false */
    visualizePitch?: boolean;
}
/** The options of `scale()`. */
export interface ScaleOptions {
    /** The largest width of the scale bar, in CSS pixels. @default 100 */
    maxWidth?: number;
    /** The unit of the distances that the scale bar shows. @default 'metric' */
    unit?: 'metric' | 'imperial' | 'nautical';
}
/** The options of `geolocate()`. */
export interface GeolocateOptions {
    /** The zoom that the map moves to when it finds the position; a map that is zoomed in further keeps its zoom. @default 14 */
    zoom?: number;
    /** The options that the control passes to `navigator.geolocation`. */
    positionOptions?: PositionOptions;
    /** Whether the button turns tracking of the position on and off, instead of moving the map once. @default false */
    trackUserLocation?: boolean;
    /** Whether the map shows a dot at the position while it tracks the position. @default true */
    showUserLocation?: boolean;
}
/** The options of `terrain()`. */
export interface TerrainOptions {
    /** The id of the `raster-dem` source of the style that gives the heights. This option is required. */
    source: string;
    /** The factor by which the heights of the terrain are multiplied. */
    exaggeration?: number;
}
declare const __DEV__: boolean;
export type {ControlSpec, ControlPosition};
