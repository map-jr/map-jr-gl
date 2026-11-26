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
import type {ControlSpec, MapDescription, MapInstance, Position} from './host.ts';
import type {StyleSpecification, TerrainSpecification} from './compat-types.ts';

// The control classes import the map, so this file loads them with `import()` when the map adds a control. A page
// that imports a control function before it makes the map then does not download the map with it (#160).
// `create()` stays synchronous: it returns a stand-in, which puts the element of the real control in its place once
// the file has loaded.
const spec = <O extends object, M = typeof More>(name: string, make: (m: M, options: O, instance?: () => MapInstance) => Control, load: () => Promise<M> = () => import('./controls-more.ts') as Promise<M>, corner: ControlPosition = 'top-right') => (options: O & {position?: ControlPosition} = {} as O) => {
    const {position, ...rest} = options;
    const create = (instance?: () => MapInstance): Control & {update(o: Record<string, unknown>): void} => {
        // Each control reads its own copy of the options. A later spec with the same key replaces its functions, so that
        // a new callback reaches a control that the map keeps, and a callback that the spec leaves out is gone (#1520).
        const mine: Record<string, unknown> = {...rest};
        let real: Control | undefined, added = 0;
        const slot = document.createElement('div');
        slot.hidden = true;
        return {
            // The stand-in answers for the real control, which is not loaded yet when the map asks for the corner.
            getDefaultPosition: () => corner,
            onAdd(map: Map) {
                const now = ++added;
                load().then(m => {
                    if (now !== added || !slot.parentNode) return; // removed (or added again) while the file loaded
                    real = make(m, mine as O, instance);
                    slot.replaceWith(real.onAdd(map));
                }, e => console.error(`[map-jr-gl] E160 The control "${name}" could not be loaded. Check that the files of the library are served.`, e));
                return slot;
            },
            onRemove(map: Map) { added++; slot.remove(); real?.onRemove(map); real = undefined; },
            update(o) { for (const k in mine) if (typeof mine[k] === 'function' && !(k in o)) mine[k] = undefined; Object.assign(mine, o); },
        };
    };
    // (The key sorts the properties of each object, so that the order in which they are written does not matter; #1236.)
    const key = name + JSON.stringify(options, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a < b ? -1 : 1)) : v);
    return {key, position, create, options: rest} as ControlSpec;
};
/**
 * Creates buttons to zoom in and out, and a compass that turns the map to the north. The control is placed at `'top-right'` unless `position` sets it.
 * @param options The options of `NavigationOptions`, and `position`.
 * @returns A control for `controls` of the description.
 */
export const navigation = spec('navigation', (m, o: NavigationOptions) => new m.NavigationControl(o));
/**
 * Creates a scale bar. The control is placed at `'bottom-left'` unless `position` sets it.
 * @param options The options of `ScaleOptions`, and `position`.
 * @returns A control for `controls` of the description.
 */
export const scale = spec('scale', (m, o: ScaleOptions) => new m.ScaleControl(o), undefined, 'bottom-left');
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
export const terrain: (options: TerrainOptions & {position?: ControlPosition}) => ControlSpec = spec('terrain', (m, o: TerrainOptions, instance) => {
    // In a map of the main API, a click sets `terrain` of the description with `patch`, so that the description says what
    // the map shows, and the label follows the description. This part stays here, and not in TerrainControl, because the
    // compat entry loads that class up front.
    const c = new m.TerrainControl(o);
    if (!instance) return c;
    const add = c.onAdd.bind(c), remove = c.onRemove.bind(c);
    let off = () => {};
    c.onAdd = (map: Map) => {
        const host = instance(), el = add(map), b = el.querySelector('button')!;
        // (The description can have changed before the map has its new style: it is read first.)
        const on = () => host.description.terrain !== undefined ? !!host.description.terrain : !!map.getTerrain();
        const name = () => {
            const t = on(), key = t ? 'Disable' : 'Enable';
            b.title = (map as {_getUIString?(k: string): string | undefined})._getUIString?.('TerrainControl.' + key) ?? key + ' terrain';
            b.setAttribute('aria-label', b.title);
        };
        // The listener runs in the capture phase on the group, so the click of TerrainControl, which calls setTerrain, does not run.
        el.addEventListener('click', e => {
            e.stopPropagation();
            const {source, exaggeration} = o, to: TerrainSpecification | null = on() ? null : {source, ...exaggeration !== undefined && {exaggeration}};
            host.patch({terrain: to});
            o.onTerrainChange?.(to);
            name();
        }, true);
        map.on('terrain', name);
        map.on('styledata', name);
        off = () => { map.off('terrain', name); map.off('styledata', name); };
        name();
        return el;
    };
    c.onRemove = () => { off(); remove(); };
    return c;
});
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
 * Creates a button that opens a list of styles, each with its label and a picture of the style. A choice sets `style`
 * of the description, keeps the camera and calls `onStyleChange` with the entry. A small second map draws the pictures
 * after the map is first idle. The control is placed at `'top-right'` unless `position` sets it.
 * @param options The options of `StylesOptions`, and `position`.
 * @returns A control for `controls` of the description.
 */
export const styles = spec('styles', (m, o: StylesOptions, instance) => new m.StylesControl(o, instance), () => import('./styles-control.ts'));
/**
 * Creates a control from your own element, or from `onAdd` and `onRemove` as a MapLibre GL JS control has them.
 * @param options `key` identifies the control: a new description with the same `key` keeps the control on the map,
 * and a new `position` with the same `key` moves it: the map calls `onRemove`, then `onAdd` again.
 * `element` is the element to place in the corner; `onAdd` receives the map and returns the element instead.
 * @returns A control for `controls` of the description.
 */
export const custom = (options: {key: string; position?: ControlPosition} & ({element: HTMLElement} | Control)): ControlSpec => {
    const {key, position} = options;
    if (__DEV__ && (typeof key !== 'string' || !('element' in options || 'onAdd' in options))) throw new Error('[map-jr-gl] E216 custom(): write custom({key: "my-control", element}) or custom({key: "my-control", onAdd(map) { return element; }, onRemove() {}}).');
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
     * Whether the compass shows and changes the pitch as well as the bearing.
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
    /**
     * Called with the new value of `terrain` of the description after a click has set it: `{source, exaggeration}` or
     * `null`. An application that passes its description again, as a component of Vue, React or Svelte does, keeps the
     * value here and passes it as `terrain`, or its next description replaces the terrain of the click.
     */
    onTerrainChange?: (terrain: TerrainSpecification | null) => void;
}
/** An entry of `styles()`. */
export interface StyleEntry {
    /** The text of the entry in the list. */
    label: string;
    /** The style that a choice of the entry sets: a value of `style` of the description. */
    style: MapDescription['style'];
    /**
     * The terrain that a choice of the entry sets: a value of `terrain` of the description. `null` turns off the
     * terrain of the style. Without this field, a choice leaves `terrain` as it is, unless the entry before set it.
     */
    terrain?: MapDescription['terrain'];
    /**
     * Values of global state that a choice of the entry sets, by name, for example `{relief: false}`. A choice keeps
     * the other names of `globalState` of the description, and gives the names that the entry before set back the
     * values of the application.
     */
    globalState?: Record<string, unknown>;
    /**
     * The style reads the global state `color-scheme`, as the official styles do: the entry then has a light and a dark
     * form, as an entry whose `style` is `{light, dark}` has. Default `false`.
     */
    colorSchemes?: boolean;
}
/** The options of the pictures of `styles()`. */
export interface StylesPreview {
    /** The center of the pictures, with `zoom`. Without the two, the pictures show the view of the map when the list opens. */
    center?: Position;
    /** The zoom of the pictures, with `center`. */
    zoom?: number;
    /**
     * Whether a picture applies the overrides that each layer of the style has for the server renderer, in
     * `metadata["map-jr:ssr"]`: `hidden`, `filter`, `minzoom`, `maxzoom`, `paint` and `layout`. The pictures never
     * apply `simplify` or `minSize`. Default `true`. A style without these overrides is drawn as it is.
     */
    ssr?: boolean;
    /**
     * Changes the style of a picture only, for example to hide the labels. It gets a copy of the style of the entry
     * (after `ssr`), which it can change, and returns the style to draw or nothing. The map of the control keeps
     * the style of the entry as it is. A style of a URL is fetched once more for this.
     */
    style?: (style: StyleSpecification, entry: StyleEntry) => StyleSpecification | void;
}
/** The options of `styles()`. */
export interface StylesOptions {
    /** The styles of the list, in their order. */
    entries: StyleEntry[];
    /** How the pictures are drawn. */
    preview?: StylesPreview;
    /**
     * Called with the entry after a choice has set `style`, `terrain` and `globalState`. An application that passes these
     * fields itself keeps their values here, or its next description sets the old style again.
     */
    onStyleChange?: (entry: StyleEntry) => void;
}
declare const __DEV__: boolean;
export type {ControlSpec, ControlPosition};
