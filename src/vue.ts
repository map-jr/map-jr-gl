/**
 * The adapter for Vue 3 (and Nuxt): `import {MapJr, useMapJr} from '@map-jr/map-jr-gl/vue'`.
 *
 * It is a thin layer over `createMap` (host.ts). The component gives its props to the map as one description, and
 * the map does the rest. On a server the component can render the first view as SVG; in the browser the map takes
 * over that SVG, so a page from Nuxt shows a map before any script has run.
 */
import {computed, defineComponent, getCurrentInstance, h, inject, provide, isProxy, isReactive, onBeforeUnmount, onMounted, onServerPrefetch, shallowRef, Teleport, toRaw, toValue, watch, type AllowedComponentProps, type ComponentCustomProps, type SetupContext, type SlotsType, type VNode, type VNodeProps, type MaybeRefOrGetter, type PropType, type ShallowRef} from 'vue';
declare const __DEV__: boolean;
import {earlyMethod, mistake} from './mistakes.ts';
import type {ControlSpec, FeatureOptions, FeaturePlace, SourceOptions, MapInstance, MapOverlay as Overlay, OverlayOptions, MapEvents, MapPointer, MapDescription, MapErrorInfo, MapState, View, ViewInput, InitialView} from './host.ts';
import {FORWARDED, type Forwarded} from './map-events.ts';
import type {SSROverrides} from './style.ts';
import type {RenderedFeature} from './map.ts';
import type {QueriedFeature} from './query.ts';
import type {LngLatBoundsInput} from './lnglat.ts';

/** A description whose fields are the objects behind Vue's reactive objects (a reactive object cannot go to a worker). */
function unwrapped(spec: MapDescription): MapDescription {
    const out: any = {};
    for (const k in spec) { const v = (spec as any)[k]; out[k] = isProxy(v) ? toRaw(v) : v; }
    return out;
}

/** A copy of a value without reactive objects. It reads each part, so Vue knows that the caller depends on each part. */
function plain<T>(v: T): T {
    if (Array.isArray(v)) return v.map(plain) as T;
    if (v && typeof v === 'object') { const o: any = {}; for (const k in v) o[k] = plain(v[k]); return o; }
    return v;
}

/**
 * A map in an element, from a description that can be a ref or a function: the map follows each change.
 * `state` has the state of the map as a ref (`state.value.view`, `state.value.hover`), and `map` the map itself
 * when it is there (for `queryFeatures`, `moveTo`, `fitBounds`).
 */
export function useMapJr(container: MaybeRefOrGetter<HTMLElement | null | undefined>, spec: MaybeRefOrGetter<MapDescription>): {map: ShallowRef<MapInstance | null>; state: ShallowRef<MapState | null>} { return mapIn(container, spec, 'useMapJr()'); }

// `useMapJr` with the name that the warnings give the map: the name that the user wrote.
function mapIn(container: MaybeRefOrGetter<HTMLElement | null | undefined>, spec: MaybeRefOrGetter<MapDescription>, name: string): {map: ShallowRef<MapInstance | null>; state: ShallowRef<MapState | null>} {
    const host = shallowRef<MapInstance | null>(null), state = shallowRef<MapState | null>(null);
    let stop: (() => void) | undefined, gone = false;
    // (The map code loads here, with `import()`, so that a component that imports only `MapOverlay`, `MapImage` or
    // `useMapInstance` from this file does not load the map (#159).)
    onMounted(async () => {
        const el = toValue(container);
        if (!el) return;
        const {makeMap} = await import('./host.ts');
        if (gone) return;
        const made = host.value = makeMap(el, unwrapped(toValue(spec)), name);
        state.value = made.state.get();
        stop = made.state.subscribe(s => { state.value = s; });
    });
    // (A new description object is a change. The fields are compared by the map, not by Vue.)
    watch(() => toValue(spec), next => host.value?.update(unwrapped(next)), {flush: 'post'});
    onBeforeUnmount(() => { gone = true; stop?.(); host.value?.destroy(); host.value = null; });
    return {map: host, state};
}

const HOST = Symbol('map-jr') as unknown as import('vue').InjectionKey<ShallowRef<MapInstance | null>>;

/** The map of the `MapJr` component that this component is in (a ref; it has the map when the map has started). */
export const useMapInstance = () => inject(HOST, shallowRef(null));
/** How a `MapImage` gives its image to the `MapJr` that it is in: its name and the image, or null when it has none. */
const IMAGES = Symbol('map-jr-images') as unknown as import('vue').InjectionKey<(owner: object, image: [string, {image: string; width?: number; height?: number; pixelRatio?: number}] | null) => void>;
/**
 * The features at a place of the map, kept up to date (see `watchFeatures` of the map). For a component inside
 * `<MapJr>`. The place and the options can be refs or getters.
 */
export function useMapFeatures(at: MaybeRefOrGetter<FeaturePlace | undefined>, options: MaybeRefOrGetter<FeatureOptions> = {}): ShallowRef<RenderedFeature[]> {
    return kept<RenderedFeature>([() => toValue(at), () => toValue(options)], (h, [place, o], give) => h.watchFeatures(plain(place), plain(o), give));
}
/**
 * The features of the tile data of the source `sourceId` at a place, kept up to date (see `watchSource` of the map).
 * For a component inside `<MapJr>`. The id, the place and the options can be refs or getters.
 */
export function useMapSource(sourceId: MaybeRefOrGetter<string>, at?: MaybeRefOrGetter<FeaturePlace | undefined>, options: MaybeRefOrGetter<SourceOptions> = {}): ShallowRef<QueriedFeature[]> {
    return kept<QueriedFeature>([() => toValue(sourceId), () => toValue(at), () => toValue(options)], (h, [id, place, o], give) => h.watchSource(id, plain(place), plain(o), give));
}
/** A ref with the answers of `start` for the map of the `MapJr` around, started again when the map or a source changes. */
function kept<T, S extends unknown[] = any[]>(sources: {[K in keyof S]: () => S[K]}, start: (h: MapInstance, values: S, give: (features: T[]) => void) => () => void): ShallowRef<T[]> {
    const host = useMapInstance(), found = shallowRef<T[]>([]);
    let stop: (() => void) | undefined;
    watch([host, ...sources] as const, ([h, ...values]: unknown[]) => {
        stop?.();
        stop = h ? start(h as MapInstance, values as unknown as S, features => { found.value = features; }) : undefined;
    }, {immediate: true});
    onBeforeUnmount(() => stop?.());
    return found;
}

/**
 * An element of the page at a position of the map, for the inside of `MapJr`: a marker with your own content, or a
 * popup.
 *
 * ```vue
 * <MapJr :map-style="style">
 *   <MapOverlay :lng-lat="[-74.0, 40.71]" anchor="bottom"><img src="/pin.svg" alt="Office"></MapOverlay>
 *   <MapOverlay :lng-lat="home" draggable @dragend="home = $event"><img src="/pin.svg" alt="Home"></MapOverlay>
 *   <MapOverlay v-if="selected" :lng-lat="selected.lngLat" popup @close="selected = null">{{ selected.name }}</MapOverlay>
 * </MapJr>
 * ```
 * For many points, use a symbol layer in the `layers` prop of `MapJr`, with the points in `data`: those are drawn on the canvas.
 */
export const MapOverlay = defineComponent({
    name: 'MapOverlay',
    props: {
        /** The position of the content, `[lng, lat]`. */
        lngLat: {type: Array as unknown as PropType<[number, number]>, required: true},
        /**
         * The part of the content that is at the position: `'center'`, `'bottom'`, `'top-left'` and the other sides and corners.
         * Without `anchor`, a marker takes `'center'`, and a popup chooses its anchor each time it moves: `'top'` near the top
         * edge, `'bottom'` near the bottom edge or near no edge, and `'left'` or `'right'` near a side, joined into a corner.
         * @default `'center'` for a marker; for a popup, chosen by the position
         */
        anchor: String as PropType<OverlayOptions['anchor']>,
        /** A distance in CSS pixels from the position, to the right and down. */
        offset: Array as unknown as PropType<[number, number]>,
        /**
         * Whether the content is shown in a box with a tip that points to the position (a popup).
         * @default false
         */
        popup: Boolean,
        /** Called when the user closes the popup, as the listener `@close`. With it, and without `closeButton`, the popup has a button to close it. */
        onClose: Function as PropType<() => void>,
        /**
         * Whether the popup has a button to close it. The button closes the popup, so `@close` is not needed for that.
         * @default true when `onClose` is set, else false
         */
        closeButton: {type: Boolean, default: undefined},
        /**
         * Whether the user can drag the content. A popup cannot be dragged. The events `dragstart`, `drag` and `dragend` receive `[lng, lat]`.
         * @default false
         */
        draggable: Boolean,
    },
    emits: ['close', 'dragstart', 'drag', 'dragend'],
    setup(props, {slots, emit}) {
        const host = useMapInstance(), el = shallowRef<HTMLElement | null>(null), shown = shallowRef(false);
        let overlay: Overlay | null = null;
        const options = (): OverlayOptions => ({lngLat: [props.lngLat[0], props.lngLat[1]], anchor: props.anchor, offset: props.offset && [props.offset[0], props.offset[1]], popup: props.popup, onClose: props.onClose, closeButton: props.closeButton,
            draggable: props.draggable, onDragStart: p => emit('dragstart', p), onDrag: p => emit('drag', p), onDragEnd: p => emit('dragend', p)});
        // The map starts after this component is there, so the element is put on the map when the two exist.
        watch([host, el, options], ([map, element, o]) => {
            if (!map || !element) return;
            if (overlay) overlay.update(o); else { overlay = map.overlay(element, o); shown.value = true; }
        }, {flush: 'post', immediate: true});
        onBeforeUnmount(() => { overlay?.remove(); overlay = null; });
        // (Not shown until it is on the map: on a server, and before the map has started, it has no position.)
        // The visibility is Vue state, so a re-render with fallthrough attributes does not hide the content again (#161).
        // The style is an object: Vue then sets and removes only `display`, and keeps the `position` and the transform
        // that the overlay writes into the inline style (#243). A string or `undefined` would replace the whole style.
        return () => h('div', {ref: el, style: {display: shown.value ? undefined : 'none'}}, slots.default?.());
    },
});

/**
 * The events of the map that `MapJr` passes on as they are: `@moveend`, `@styleimagemissing` and the others. The value
 * is the event of `listen` of the main API. (`click`, `load`, `idle` and `error` are events of the component with a
 * value of their own. The event `style.load` has the name `styleload` here: a dot in the name of an event is a
 * modifier in a template.)
 */
type Undotted<K extends string> = K extends `${infer A}.${infer B}` ? `${A}${B}` : K;
const forwarded = Object.fromEntries(FORWARDED.map(name => [name.replace('.', ''), () => true])) as unknown as {[K in Forwarded as Undotted<K>]: (event: MapEvents[K]) => true};

/** The props of `MapImage`. `P` has the names of the parameters. */
export interface MapImageProps<P extends string = never> {
    /** The name of the image, for `icon-image` of a style layer. */
    name: string;
    /** The names of the parameters of the image, as an array of strings. The slot gets a prop for each one. */
    params?: readonly P[];
    /** The URL of an image, in place of an SVG in the slot. */
    src?: string;
    /** The width in CSS pixels. Without it, an SVG has the width of its `viewBox` or else of its `width` attribute, and another image has its own width. */
    width?: number;
    /** The height in CSS pixels. Without it, an SVG has the height of its `viewBox` or else of its `height` attribute, and another image has its own height. */
    height?: number;
    /**
     * The number of image pixels for one CSS pixel, for example 2 for an image "@2x".
     * @default 1
     */
    pixelRatio?: number;
}
/**
 * An image for the style layers of the map, for the inside of `MapJr`. Write the SVG in the slot:
 *
 * ```vue
 * <MapJr :map-style="style" :sources="sources" :layers="layers">
 *   <MapImage name="pin" :params="['color']" v-slot="{color}">
 *     <svg viewBox="0 0 24 31"><path :fill="color" d="M12 30C12 30 2 17 2 11a10 10 0 0 1 20 0c0 6-10 19-10 19z"/></svg>
 *   </MapImage>
 * </MapJr>
 * ```
 * A layer uses the image with `'icon-image': 'pin'`. A parameter gets its value for each feature of the layer: from the
 * property of the feature with that name, or from `params` of the `image` expression of the layer. Vue renders the SVG
 * one time, not one time for each feature. `<MapImage name="photo" src="/photo.png" />` is an image from a URL.
 */
export const MapImage = defineComponent(<P extends string>(props: MapImageProps<P>, {slots}: SetupContext<{}, SlotsType<{default?: (params: Record<P, string>) => any}>>) => {
    // The image is a part of the description of the map, as an image of the prop `images` is: the map of this
    // component gets it from `give`, and it finds what is different. (Two components can then have one name, and
    // a component can go: the map has what the components that are there give.)
    const give = inject(IMAGES, null), owner = {};
    // The content is rendered into an element that is not in the page: a `<style>` or an id in the SVG is then no
    // style and no id of the page. (On a server, and in the first render in the browser, the component renders nothing.)
    const el = typeof document === 'undefined' ? null : document.createElement('div'), mounted = shallowRef(false), svg = shallowRef('');
    const read = () => { const node = el!.querySelector('svg'); svg.value = node ? new XMLSerializer().serializeToString(node) : ''; };
    // (Each change of the content is seen, also a change that a component inside the SVG makes.)
    const changes = el && new MutationObserver(read);
    const number = (v?: number) => v === undefined ? undefined : +v;
    onMounted(() => {
        mounted.value = true;
        changes!.observe(el!, {subtree: true, childList: true, attributes: true, characterData: true});
        if (__DEV__ && !give) console.warn(`[map-jr-gl] E20129 MapImage "${props.name}" is not inside MapJr, so no map gets the image. Put it into the content of MapJr.`);
        // (The value of a parameter in the SVG is the text of a slot of a template: `{{color}}`.)
        if (__DEV__) setTimeout(() => { if (!props.src && !svg.value && mounted.value) console.warn(`[map-jr-gl] E30129 MapImage "${props.name}" has no image: its content has no <svg> element. Write an <svg> in its slot, or give the URL of an image as "src".`); }, 1000);
    });
    watch(() => [props.name, props.src ?? svg.value, number(props.width), number(props.height), number(props.pixelRatio)] as const, ([name, image, width, height, pixelRatio]) =>
        give?.(owner, image ? [name, JSON.parse(JSON.stringify({image, width, height, pixelRatio}))] : null), {immediate: true});
    onBeforeUnmount(() => { mounted.value = false; changes?.disconnect(); give?.(owner, null); });
    return () => mounted.value ? h(Teleport, {to: el}, slots.default?.(Object.fromEntries((props.params ?? []).map(p => [p, `{{${p}}}`])) as Record<P, string>)) : null;
// (The type is written out. The type that `defineComponent` gives a generic function has no types for the slot.)
}, {name: 'MapImage', props: ['name', 'params', 'src', 'width', 'height', 'pixelRatio']}) as unknown as new <const P extends string = never>(props: MapImageProps<P> & VNodeProps & AllowedComponentProps & ComponentCustomProps) => {
    $props: MapImageProps<P>;
    $slots: {default?: (params: Record<P, string>) => VNode[]};
};

/**
 * The map as a component. It fills its parent element, so give the parent a height.
 *
 * ```vue
 * <MapJr :map-style="style" v-model:view="view" :data="{places}" :layers="[placesLayer]" :interactive-layers="['places']" @click="onClick" />
 * ```
 * The style is the prop `map-style` (`style` is the CSS style of an element in Vue).
 */
/** The options of the prop `ssr` of `MapJr`: how the server renders the first view as SVG. */
export interface MapJrSSROptions {
    /** The width in CSS pixels that the map has on most screens. @default 800 */
    width?: number;
    /** The height in CSS pixels that the map has on most screens. @default 500 */
    height?: number;
    /** Changes for the server render, for each id of a style layer, as `overrides` of `renderToSVG`. */
    overrides?: false | Record<string, SSROverrides>;
    /** The attribution to show, as HTML. The prop `:attribution="false"` overrides it and shows none. @default the attribution of the sources */
    attribution?: string | string[];
    /** The time in milliseconds that all requests of the render can take together, as `timeout` of `renderToSVG`. `0` sets no limit. @default 30000 */
    timeout?: number;
    /** The time in milliseconds that one request can take, as `requestTimeout` of `renderToSVG`. `0` sets no limit. @default 10000 */
    requestTimeout?: number;
    /** The largest body of one response in bytes, after decompression, as `maxBytes` of `renderToSVG`. `0` sets no limit. @default 0 */
    maxBytes?: number;
    /** The host names that the render can request, as `allowHosts` of `renderToSVG`. Without it, all hosts are allowed. */
    allowHosts?: string[];
    /** The number of zoom levels below the zoom of the render at which the server loads vector tiles, as `tileZoomOffset` of `renderToSVG`. @default 0 */
    tileZoomOffset?: number;
    /**
     * The `aria-label` of the SVG, as `label` of `renderToSVG`. Say what the map shows, for example "Map of the hotels in Bern".
     * @default the text `Map.Title` of the prop `locale`, as the canvas of the map has it, else `'Map'`
     */
    label?: string;
}

/**
 * What a template ref on `MapJr` holds: the members of the map (`MapInstance`), as the ref of the React component
 * holds them. Call them as `mapRef.value.queryFeatures(…)`, and read the state as `mapRef.value.state.get()`.
 *
 * The code of the map loads after the component is mounted, and the members cannot be used until then. Call the
 * members from `@load` or later, or use `useMapInstance()` in a component inside `MapJr`.
 */
export type MapJrExposed = MapInstance;

const MapJrComponent = defineComponent({
    name: 'MapJr',
    props: {
        /** The style: a style object, the URL of a style, or `{light, dark}`, of which the map draws the style that matches `colorScheme`. */
        mapStyle: {type: [String, Object] as PropType<MapDescription['style']>, required: true},
        /** The view that the application controls, for `v-model:view`. Without it, the map starts at `initialView` and the user moves it. */
        view: Object as PropType<ViewInput | null>,
        /** The view when the map is created: a center, zoom, bearing and pitch, or `bounds` to fit. */
        initialView: Object as PropType<InitialView | null>,
        /** Sources to add to the style, by id. A source here overrides the source of the style that has the same id. */
        sources: Object as PropType<MapDescription['sources']>,
        /** Layers to add to the style. A layer with `before` is inserted below the style layer with that id, and a layer without it is drawn on top. */
        layers: Array as PropType<MapDescription['layers']>,
        /** 3D terrain from a raster-dem source. It overrides the `terrain` of the style, and `null` turns 3D terrain off. */
        terrain: {type: Object as PropType<MapDescription['terrain']>, default: undefined},
        /** Images for `icon-image` of style layers, by name: an SVG document as a string, the URL of an image, or `{image, width, height}`. */
        images: Object as PropType<MapDescription['images']>,
        /** Sprites to add to the sprite of the style, as `[{id: 'pins', url}]`. A layer names an image of such a sprite as `id:name`. */
        sprite: Array as PropType<MapDescription['sprite']>,
        /** GeoJSON data or the URL of GeoJSON, by the id of a GeoJSON source of the style or of `sources`. To change the data of a source, pass a new object. */
        data: Object as PropType<MapDescription['data']>,
        /** The ids of the style layers that respond to the pointer: their features are in the events `click` and `hover`. */
        interactiveLayers: Array as PropType<string[] | null>,
        /**
         * Whether the top feature of `interactive-layers` under the pointer has the feature state `hover: true`.
         * @default false
         */
        hoverState: {type: Boolean as PropType<boolean | null>, default: undefined},
        /**
         * The smallest zoom level of the map.
         * @default -2
         */
        minZoom: Number as PropType<number | null>,
        /**
         * The largest zoom level of the map.
         * @default 22
         */
        maxZoom: Number as PropType<number | null>,
        /**
         * The largest pitch of the map in degrees, at most 180, where a pitch above 90 looks up. The camera stays at or above sea level (above the ground with 3D terrain): a pitch that would put it lower is reduced, and the zoom changes with it, as in MapLibre GL JS. Give the map center a height with `centerElevation` to look up from higher. A larger value is limited to 180 and warns once. It limits gestures, `view` and `moveTo`.
         * @default 60
         */
        maxPitch: Number as PropType<number | null>,
        /**
         * Whether copies of the world are drawn beside it. With `false`, the view stays inside -180 to 180 degrees of longitude, and markers and popups are not wrapped.
         * @default true
         */
        renderWorldCopies: {type: Boolean as PropType<boolean | null>, default: undefined},
        /** The height of the map center in meters above sea level, which keeps the camera above the ground at a pitch above 90 when it is high enough. Without it, the center is on the ground and follows it. */
        centerElevation: Number as PropType<number | null>,
        /** A box that the view cannot leave, as `[[west, south], [east, north]]` or `[west, south, east, north]`. */
        maxBounds: [Array, Object] as unknown as PropType<MapDescription['maxBounds']>,
        /** The CSS cursor over the map. Without it, the cursor is `pointer` over a feature of `interactive-layers`. */
        cursor: String as PropType<string | null>,
        /**
         * Whether the wheel zooms only with Ctrl (⌘ on a Mac) and a touch pans only with two fingers, for a map in a page that scrolls.
         * @default false
         */
        cooperativeGestures: {type: Boolean as PropType<boolean | null>, default: undefined},
        /**
         * The color scheme of the controls, the popup and the attribution, for `v-model:color-scheme`. `'auto'` follows the browser.
         * @default 'light'
         */
        colorScheme: String as PropType<MapDescription['colorScheme']>,
        /** The texts of the controls by the keys of MapLibre GL JS, for example `{'NavigationControl.ZoomIn': 'Zoom avant'}`. */
        locale: Object as PropType<MapDescription['locale']>,
        /**
         * Space in CSS pixels at the sides of the map that the view keeps free: one number, or `{top, right, bottom, left}`.
         * @default 0
         */
        padding: [Number, Object] as PropType<MapDescription['padding']>,
        /** Controls from `@map-jr/map-jr-gl/controls`, for example `[navigation(), scale()]`. */
        controls: Array as PropType<ControlSpec[] | null>,
        /** The projection, `{type: 'globe'}` or `{type: 'mercator'}`. It overrides the `projection` of the style. */
        projection: Object as PropType<MapDescription['projection']>,
        /** Values for the `global-state` expressions of the style, by name, for example `{season: 'winter'}`. */
        globalState: Object as PropType<MapDescription['globalState']>,
        /** A function that changes a request before the map sends it, as `transformRequest` of MapLibre GL JS. */
        transformRequest: Function as PropType<MapDescription['transformRequest']>,
        /**
         * The thread that renders the map. Read only when the map is created.
         * @default 'auto'
         */
        renderer: String as PropType<'auto' | 'worker' | 'main' | null>,
        /** Web fonts for labels, by `text-font` name: a URL, or a list of `{url, 'unicode-range'}` as in `font-faces` of the style specification. */
        fonts: Object as PropType<MapDescription['fonts']>,
        /**
         * The CSS font family for labels whose `text-font` names no loaded font. Read only when the map is created.
         * @default the `@default` of {@link MapSetup.fontFamily} in the main API
         */
        fontFamily: String as PropType<string | null>,
        /**
         * Whether the user can move the map. Read only when the map is created.
         * @default true
         */
        interactive: {type: Boolean as PropType<boolean | null>, default: undefined},
        /**
         * Whether the canvas uses multisample antialiasing. Read only when the map is created.
         * @default false
         */
        antialias: {type: Boolean as PropType<boolean | null>, default: undefined},
        /** The nonce of a Content Security Policy with `style-src 'nonce-…'`, for the style sheet of the map. */
        nonce: String as PropType<string | null>,
        /** The options of the built-in attribution, or `false` to hide it. Read only when the map is created. */
        attribution: {type: [Boolean, Object] as PropType<false | {compact?: boolean; customAttribution?: string | string[]} | null>, default: undefined},
        /**
         * Whether the view is kept in the hash of the URL; a string is the name of the parameter. Read only when the map is created.
         * @default false
         */
        hash: {type: [Boolean, String] as PropType<boolean | string | null>, default: undefined},
        /**
         * Whether a server renders the first view as SVG into the page: `true`, or options. `width` and `height` are the
         * size in CSS pixels on most screens (default 800 by 500). `attribution` sets the credits. The other options are
         * those of `RenderOptions` of `@map-jr/map-jr-gl/server` with the same names.
         * @default false
         */
        ssr: {type: [Boolean, Object] as PropType<boolean | MapJrSSROptions>, default: false},
    },
    emits: {
        'update:view': (_view: View) => true,
        'update:colorScheme': (_scheme: 'auto' | 'light' | 'dark') => true,
        click: (_event: MapPointer) => true,
        hover: (_features: RenderedFeature[]) => true,
        /** Emitted with the map when the style and the first tiles have loaded. */
        load: (_map: MapInstance) => true,
        idle: () => true,
        error: (_error: Error, _info: MapErrorInfo) => true,
        ...forwarded,
    },
    setup(props, {emit, slots, expose}) {
        const el = shallowRef<HTMLElement | null>(null);
        // Each part of the description is found on its own, so that a change of one prop does not make the other parts
        // again. Objects from Vue can be changed in place: the view, the layers, a reactive style. (Not the data of a
        // source: give a new object.)
        const style = computed(() => { const v = props.mapStyle; return typeof v === 'object' && isReactive(v) ? plain(v) : v; });
        const view = computed(() => props.view && plain(props.view));
        const sources = computed(() => props.sources && plain(props.sources));
        const added = computed(() => props.layers && plain(props.layers));
        const terrain = computed(() => props.terrain && plain(props.terrain));
        // (The data of each source is the object behind Vue's object. The list itself can be made again in each render.)
        let lastData: MapDescription['data'];
        const data = computed(() => {
            if (!props.data) return undefined;
            const out: NonNullable<MapDescription['data']> = {};
            for (const id in props.data) out[id] = toRaw(props.data[id]);
            return lastData && Object.keys(out).length === Object.keys(lastData).length && Object.keys(out).every(id => out[id] === lastData![id]) ? lastData : lastData = out;
        });
        // (Each image is the object behind Vue's object: an image element or a bitmap cannot be copied.)
        // The images of the `MapImage` components in this map, by component. They come after the images of the prop:
        // with one name in both, the image of the component is used.
        const owners = new Map<object, [string, NonNullable<MapDescription['images']>[string]]>(), fromChildren = shallowRef<NonNullable<MapDescription['images']>>({});
        provide(IMAGES, (owner, image) => {
            if (JSON.stringify(owners.get(owner) ?? null) === JSON.stringify(image)) return;
            if (image) owners.set(owner, image); else owners.delete(owner);
            fromChildren.value = Object.fromEntries(owners.values());
        });
        const images = computed(() => {
            const out: NonNullable<MapDescription['images']> = {};
            for (const name in props.images) out[name] = toRaw(props.images[name]);
            Object.assign(out, fromChildren.value);
            return props.images || owners.size ? out : undefined;
        });
        const layers = computed(() => props.interactiveLayers && [...props.interactiveLayers]);
        const controls = computed(() => props.controls && [...props.controls].map(c => toRaw(c)));
        const listensForError = !!getCurrentInstance()?.vnode.props?.onError;
        const spec = computed<MapDescription>(() => {
            const out: MapDescription = {
                style: style.value, sources: sources.value, layers: added.value, terrain: terrain.value, view: view.value, initialView: props.initialView && toRaw(props.initialView), images: images.value, data: data.value, interactiveLayers: layers.value, hoverState: props.hoverState, controls: controls.value,
                minZoom: props.minZoom, maxZoom: props.maxZoom, maxPitch: props.maxPitch, renderWorldCopies: props.renderWorldCopies, centerElevation: props.centerElevation, maxBounds: props.maxBounds && toRaw(props.maxBounds), cursor: props.cursor, transformRequest: props.transformRequest, cooperativeGestures: props.cooperativeGestures, colorScheme: props.colorScheme, locale: props.locale && toRaw(props.locale), padding: props.padding && typeof props.padding === 'object' ? toRaw(props.padding) : props.padding, projection: props.projection && toRaw(props.projection), globalState: props.globalState && toRaw(props.globalState),
                fonts: props.fonts && toRaw(props.fonts), sprite: props.sprite && toRaw(props.sprite), renderer: props.renderer, fontFamily: props.fontFamily, interactive: props.interactive, antialias: props.antialias,
                attribution: (props.attribution as unknown) === true ? undefined : props.attribution && toRaw(props.attribution), hash: props.hash, nonce: props.nonce,
                onViewChange: view => emit('update:view', view), onColorSchemeChange: scheme => emit('update:colorScheme', scheme), onClick: event => emit('click', event),
                // (Without a listener for `error`, the map writes each error to the console.)
                onError: listensForError ? (error, info) => emit('error', error, info) : undefined,
            };
            for (const k in out) if ((out as any)[k] === undefined) delete (out as any)[k];
            return out;
        });
        const {map: host, state} = mapIn(el, spec, '<MapJr>');
        provide(HOST, host);
        // The other events of the map, each one only when the component has a listener for it.
        const listeners = getCurrentInstance()?.vnode.props ?? {};
        // (`load` and `idle` come from the store of the map and not from a watcher: a watcher runs after both have
        // changed, and a listener of `load` would find the map idle already.)
        watch(host, map => {
            if (map) map.state.subscribe(s => s.loaded, v => { if (v) emit('load', map); });
            if (map) map.state.subscribe(s => s.idle, v => { if (v) emit('idle'); });
            if (map) for (const name of FORWARDED) { const event = name.replace('.', '') as 'move'; if (listeners['on' + event[0].toUpperCase() + event.slice(1)]) map.listen(name as 'move', e => emit(event, e)); }
        }, {immediate: true});
        watch(() => state.value?.hover, hover => { if (hover) emit('hover', hover); });
        // The members of the map, read when they are used. Before the map has loaded, the members are undefined; in the
        // development build, a method is a function that throws a message. (Functions are bound to the map, because Vue calls them on its
        // own proxy, and each one is bound once for each map, so that a read gives the same function again.)
        const target = {} as Record<PropertyKey, unknown>;
        let bound = new Map<PropertyKey, unknown>(), of: MapInstance | null = null;
        const read = (k: PropertyKey) => {
            const m = host.value as any;
            if (m !== of) { of = m; bound = new Map(); }
            if (!bound.has(k)) bound.set(k, m ? (typeof m[k] === 'function' ? m[k].bind(m) : undefined) : (__DEV__ && earlyMethod(k) ? () => { throw new Error(mistake(1151, String(k))); } : undefined));
            return bound.get(k) ?? m?.[k];
        };
        expose(new Proxy(target, {
            has: (t, k) => k in t || (host.value ? k in host.value : __DEV__ && earlyMethod(k)),
            get: (t, k) => k in t ? t[k] : read(k),
            ownKeys: t => [...new Set([...Reflect.ownKeys(t), ...(host.value ? Reflect.ownKeys(host.value) : [])])],
            getOwnPropertyDescriptor: (t, k) => k in t ? Reflect.getOwnPropertyDescriptor(t, k) : host.value && k in host.value ? {value: read(k), enumerable: true, configurable: true, writable: false} : undefined,
        }));

        // The first view from the server: the SVG and the credits. On the server they are made here. In the browser,
        // when the page came from the server, they are read from the element that is there already: the component then
        // renders the same content, and Vue finds no difference. The map removes them when it has drawn its first frame.
        const first = shallowRef((getCurrentInstance()?.vnode.el as HTMLElement | null)?.firstElementChild?.innerHTML ?? '');
        // (Vite writes `false` for `import.meta.env.SSR` in a client build, which then drops this code and does not emit
        // the server renderer as a file. Without Vite, `import.meta.env` is undefined and the server render runs.)
        // @ts-ignore: `import.meta.env` is Vite's, and it must stay written out in full for Vite to replace it
        if (!import.meta.env || import.meta.env.SSR) onServerPrefetch(async () => {
            if (!props.ssr) return;
            const view = {...props.initialView, ...props.view}, fit = !props.view && props.initialView?.bounds, o = props.ssr === true ? {} : props.ssr;
            // A render that fails does not fail the page (#706): the page is sent without the first view, and the map
            // draws in the browser as it does without the `ssr` prop.
            try {
            // (By the name of the package, so that this file does not contain the server renderer, and so that a tool that
            // collects the files of a server finds it.)
            // @ts-ignore: the package refers to itself, which the type check of this project does not resolve
            const server = await import('@map-jr/map-jr-gl/server') as typeof import('./server.ts');
            first.value = await server.renderFirstView({style: toRaw(props.mapStyle), center: view.center ?? [0, 0], zoom: view.zoom ?? 0, bearing: view.bearing, bounds: fit ? toRaw(fit) as LngLatBoundsInput : undefined, padding: props.initialView?.fitPadding, fitMaxZoom: props.initialView?.fitMaxZoom, width: o.width ?? 800, height: o.height ?? 500,
                images: props.images ? toRaw(props.images) as Record<string, string> : undefined, overrides: o.overrides, sources: toRaw(props.sources) ?? undefined, layers: toRaw(props.layers) ?? undefined, terrain: toRaw(props.terrain), sprite: props.sprite ? toRaw(props.sprite) : undefined, data: props.data ? toRaw(props.data) : undefined, timeout: o.timeout, requestTimeout: o.requestTimeout, maxBytes: o.maxBytes, allowHosts: o.allowHosts, tileZoomOffset: o.tileZoomOffset, fontFamily: props.fontFamily ?? undefined, label: o.label ?? props.locale?.['Map.Title'], attribution: props.attribution === false ? false : o.attribution, colorScheme: props.colorScheme ?? 'light', globalState: props.globalState && toRaw(props.globalState),
                controls: controls.value ?? [], locale: props.locale && toRaw(props.locale), nonce: props.nonce, minZoom: props.minZoom, maxZoom: props.maxZoom, projection: props.projection && toRaw(props.projection),
                attributionOptions: typeof props.attribution === 'object' ? toRaw(props.attribution) : undefined});
            } catch (cause) {
                const error = new Error(`[map-jr-gl] E706 <MapJr>: the server render failed, and the page has no first view. The map draws in the browser. The cause: ${(cause as Error)?.message ?? cause}`, {cause});
                console.error(error.message);
                if (listensForError) emit('error', error, {});
            }
        });
        return () => h('div', {class: 'map-jr-vue', style: 'position:relative;width:100%;height:100%'}, [
            h('div', {ref: el, style: 'position:absolute;inset:0', innerHTML: first.value}),
            // (`state` is read when the slot reads it: a slot that does not read it does not render again at each move of the
            // pointer, which changes `state.pointer`.)
            slots.default?.({map: host.value, get state() { return state.value; }}),
        ]);
    },
});
// (The type of `defineComponent` does not name the exposed members: the type adds them, so that
// `InstanceType<typeof MapJr>['queryFeatures']` is the method of the map.)
export const MapJr = MapJrComponent as typeof MapJrComponent & (new (...args: any[]) => InstanceType<typeof MapJrComponent> & MapJrExposed);

/**
 * Puts the code of the message in the field `code` of the error (`error.code === 'E63'`, #2148). `name` stays `Error`. An
 * error with no code in its message is not changed. The build wraps each `new Error(text)` of src/ whose text has a code
 * (a copy of src/requests.ts, which would make this file load the map chunk; scripts/message-codes.mjs, `errorCodes`), and `fire('error')` of the map does the same for the errors that it passes on.
 */
function withCode<T extends Error>(error: T): T {
    const code = /^(?:\[map-jr-gl\] )?(?:\w+\(\): )?(E\d+) /.exec(error.message)?.[1];
    if (code) (error as T & {code?: string}).code = code;
    return error;
}
