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
import type {ControlSpec} from './host.ts';

// The control classes import the map, so this file loads them with `import()` when the map adds a control. A page
// that imports a control function before it makes the map then does not download the map with it (#160).
// `create()` stays synchronous: it returns a stand-in, which puts the element of the real control in its place once
// the file has loaded.
const spec = <O extends object>(name: string, make: (m: typeof More, options: O) => Control) => (options: O & {position?: ControlPosition} = {} as O) => {
    const {position, ...rest} = options;
    const create = (): Control => {
        let real: Control | undefined, added = 0;
        const slot = document.createElement('div');
        slot.hidden = true;
        return {
            onAdd(map: Map) {
                const now = ++added;
                import('./controls-more.ts').then(m => {
                    if (now !== added || !slot.parentNode) return; // removed (or added again) while the file loaded
                    real = make(m, rest as O);
                    slot.replaceWith(real.onAdd(map));
                }, e => console.error(`[map-jr-gl] The control "${name}" could not be loaded. Check that the files of the library are served.`, e));
                return slot;
            },
            onRemove(map: Map) { added++; slot.remove(); real?.onRemove(map); real = undefined; },
        };
    };
    return {key: name + JSON.stringify(options), position, create} as ControlSpec;
};
/** Buttons to zoom in and out, and a compass that turns the map to the north. */
export const navigation = spec('navigation', (m, o: {showZoom?: boolean; showCompass?: boolean}) => new m.NavigationControl(o));
/** A scale bar. */
export const scale = spec('scale', (m, o: {maxWidth?: number; unit?: 'metric' | 'imperial'}) => new m.ScaleControl(o));
/** A button that shows the map on the full screen. */
export const fullscreen = spec('fullscreen', (m, _o: {}) => new m.FullscreenControl());
/** A button that moves the map to the position of the user. */
export const geolocate = spec('geolocate', (m, o: {zoom?: number; positionOptions?: PositionOptions}) => new m.GeolocateControl(o));
/** A button that turns 3D terrain on and off. `source` is the id of an elevation source of the style. */
export const terrain = spec('terrain', (m, o: {source: string; exaggeration?: number}) => new m.TerrainControl(o));
/**
 * A control of your own. Give `element` (the map puts it into the corner and takes it out again), or `onAdd` and
 * `onRemove` as MapLibre GL JS controls have them (`onAdd` receives the map of `map.map` and returns the element).
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
declare const __DEV__: boolean;
export type {ControlSpec, ControlPosition};
