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
/**
 * Creates buttons to zoom in and out, and a compass that turns the map to the north. The control is placed at `'top-right'` unless `position` sets it.
 * @param options The options of `NavigationOptions`, and `position`.
 * @returns A control for `controls` of the description.
 */
export const navigation = spec('navigation', (m, o: NavigationOptions) => new m.NavigationControl(o));
/**
 * Creates a scale bar. The control is placed at `'top-right'` unless `position` sets it.
 * @param options The options of `ScaleOptions`, and `position`.
 * @returns A control for `controls` of the description.
 */
export const scale = spec('scale', (m, o: ScaleOptions) => new m.ScaleControl(o));
/**
 * Creates a button that shows the map on the full screen. The control is placed at `'top-right'` unless `position` sets it.
 * @returns A control for `controls` of the description.
 */
export const fullscreen = spec('fullscreen', (m, _o: {}) => new m.FullscreenControl());
/**
 * Creates a button that moves the map to the position of the user. The control is placed at `'top-right'` unless `position` sets it.
 * @param options The options of `GeolocateOptions`, and `position`.
 * @returns A control for `controls` of the description.
 */
export const geolocate = spec('geolocate', (m, o: GeolocateOptions) => new m.GeolocateControl(o));
/**
 * Creates a button that turns 3D terrain on and off. The control is placed at `'top-right'` unless `position` sets it.
 * @param options The options of `TerrainOptions`, and `position`.
 * @returns A control for `controls` of the description.
 */
export const terrain = spec('terrain', (m, o: TerrainOptions) => new m.TerrainControl(o));
/**
 * Creates a button that switches the projection between the globe and Mercator. The control is placed at `'top-right'` unless `position` sets it.
 * @returns A control for `controls` of the description.
 */
export const globe = spec('globe', (m, _o: {}) => new m.GlobeControl());
/**
 * Creates a button that switches `colorScheme` of the map between light and dark, and calls `onColorSchemeChange` of
 * the description with the new value. The control is placed at `'top-right'` unless `position` sets it.
 * @returns A control for `controls` of the description.
 */
export const colorScheme = spec('colorScheme', (m, _o: {}, instance) => new m.ColorSchemeControl(instance), () => import('./color-scheme-control.ts'));
/**
 * Creates a control from your own element, or from `onAdd` and `onRemove` as a MapLibre GL JS control has them.
 * @param options `key` identifies the control: a new description with the same `key` keeps the control on the map.
 * `element` is the element to place in the corner; `onAdd` receives the map and returns the element instead.
 * @returns A control for `controls` of the description.
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
    /**
     * Whether the control shows the buttons to zoom in and out.
     * @default true
     */
    showZoom?: boolean;
    /**
     * Whether the control shows the compass.
     * @default true
     */
    showCompass?: boolean;
    /**
     * Whether the compass also shows the pitch, a drag on it changes the pitch, and a click on it resets the pitch.
     * @default false
     */
    visualizePitch?: boolean;
}
/** The options of `scale()`. */
export interface ScaleOptions {
    /**
     * The largest width of the scale bar, in CSS pixels.
     * @default 100
     */
    maxWidth?: number;
    /**
     * The unit of the distances that the scale bar shows.
     * @default 'metric'
     */
    unit?: 'metric' | 'imperial' | 'nautical';
}
/** The options of `geolocate()`. */
export interface GeolocateOptions {
    /**
     * The zoom level that the map moves to when it finds the position. A map that is zoomed in further keeps its zoom.
     * @default 14
     */
    zoom?: number;
    /** The options that the control passes to `navigator.geolocation`. */
    positionOptions?: PositionOptions;
    /**
     * Whether the button turns tracking of the position on and off, instead of moving the map once.
     * @default false
     */
    trackUserLocation?: boolean;
    /**
     * Whether the map shows a dot at the position of the user while it tracks the position.
     * @default true
     */
    showUserLocation?: boolean;
}
/** The options of `terrain()`. */
export interface TerrainOptions {
    /** The id of the `raster-dem` source of the style that provides the heights. */
    source: string;
    /**
     * The factor by which the heights of the terrain are multiplied.
     * @default 1
     */
    exaggeration?: number;
}
declare const __DEV__: boolean;
export type {ControlSpec, ControlPosition};
