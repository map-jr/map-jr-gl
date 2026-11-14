/**
 * The adapter for Vue 3 (and Nuxt): `import {MapJr, useMap} from '@map-jr/map-jr-gl/vue'`.
 *
 * It is a thin layer over `createMap` (host.ts). The component gives its props to the map as one description, and
 * the map does the rest. On a server the component can render the first view as SVG; in the browser the map takes
 * over that SVG, so a page from Nuxt shows a map before any script has run.
 */
import {computed, defineComponent, getCurrentInstance, h, inject, provide, isProxy, isReactive, onBeforeUnmount, onMounted, onServerPrefetch, shallowRef, Teleport, toRaw, toValue, watch, type AllowedComponentProps, type ComponentCustomProps, type SetupContext, type SlotsType, type VNode, type VNodeProps, type ComputedRef, type MaybeRefOrGetter, type PropType, type ShallowRef} from 'vue';
declare const __DEV__: boolean;
import type {ControlSpec, FeatureOptions, FeaturePlace, MapHost, MapOverlay as Overlay, OverlayOptions, MapEvents, MapPointer, MapSpec, MapState, View, ViewInput} from './host.ts';
import type {SSROverrides} from './style.ts';
import type {RenderedFeature} from './map.ts';
import type {QueriedFeature} from './query.ts';
import type {MarkerLayerOptions} from './markers.ts';
import type {FontSource} from './engine.ts';
import type {LngLatBoundsInput} from './lnglat.ts';

/** A description whose fields are the objects behind Vue's reactive objects (a reactive object cannot go to a worker). */
function unwrapped(spec: MapSpec): MapSpec {
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
 * The data of a marker layer for the map. A reactive array can be changed in place (`data.push(marker)`,
 * `data[3] = marker`, `data.splice(...)`): Vue is asked about the array as a whole, which costs the same for ten
 * markers and for 100,000, and the map gets a copy after a change. An array that is not reactive is used as it is.
 */
const copies = new WeakMap<object, ComputedRef<unknown[]>>();
function markerData(data: unknown[]): unknown[] {
    if (!isReactive(data)) return data;
    const raw = toRaw(data);
    let copy = copies.get(raw);
    // (To ask for the iterator of a reactive array is to depend on each change of its items, without a look at each item.)
    if (!copy) copies.set(raw, copy = computed(() => { data[Symbol.iterator](); return raw.slice(); }));
    return copy.value;
}

/**
 * A map in an element, from a description that can be a ref or a function: the map follows each change.
 * `state` has the state of the map as a ref (`state.value.view`, `state.value.hover`), and `host` the map itself
 * when it is there (for `queryFeatures`, `moveTo`, `fitBounds`).
 */
export function useMap(container: MaybeRefOrGetter<HTMLElement | null | undefined>, spec: MaybeRefOrGetter<MapSpec>): {host: ShallowRef<MapHost | null>; state: ShallowRef<MapState | null>} { return mapIn(container, spec, 'useMap()'); }

// `useMap` with the name that the warnings give the map: the name that the user wrote.
function mapIn(container: MaybeRefOrGetter<HTMLElement | null | undefined>, spec: MaybeRefOrGetter<MapSpec>, name: string): {host: ShallowRef<MapHost | null>; state: ShallowRef<MapState | null>} {
    const host = shallowRef<MapHost | null>(null), state = shallowRef<MapState | null>(null);
    let stop: (() => void) | undefined, gone = false;
    // (The map code loads here, with `import()`, so that a component that imports only `MapOverlay`, `MapImage` or
    // `useMapHost` from this file does not load the map (#159).)
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
    return {host, state};
}

const HOST = Symbol('map-jr') as unknown as import('vue').InjectionKey<ShallowRef<MapHost | null>>;

/** The map of the `MapJr` component that this component is in (a ref; it has the map when the map has started). */
export const useMapHost = () => inject(HOST, shallowRef(null));
/** How a `MapImage` gives its image to the `MapJr` that it is in: its name and the image, or null when it has none. */
const IMAGES = Symbol('map-jr-images') as unknown as import('vue').InjectionKey<(owner: object, image: [string, {image: string; width?: number; height?: number; pixelRatio?: number}] | null) => void>;
/**
 * The features at a place of the map, kept up to date (see `watchFeatures` of the map). For a component inside
 * `<MapJr>`. The place and the options can be refs or getters.
 */
export function useMapFeatures(at: MaybeRefOrGetter<FeaturePlace | undefined>, options: MaybeRefOrGetter<FeatureOptions & {sources: string[]}>): ShallowRef<QueriedFeature[]>;
export function useMapFeatures(at: MaybeRefOrGetter<FeaturePlace | undefined>, options?: MaybeRefOrGetter<FeatureOptions & {sources?: undefined}>): ShallowRef<RenderedFeature[]>;
export function useMapFeatures(at: MaybeRefOrGetter<FeaturePlace | undefined>, options?: MaybeRefOrGetter<FeatureOptions>): ShallowRef<RenderedFeature[] | QueriedFeature[]>;
export function useMapFeatures(at: MaybeRefOrGetter<FeaturePlace | undefined>, options: MaybeRefOrGetter<FeatureOptions> = {}): ShallowRef<RenderedFeature[] | QueriedFeature[]> {
    const host = useMapHost(), found = shallowRef<RenderedFeature[] | QueriedFeature[]>([]);
    let stop: (() => void) | undefined;
    watch([host, () => toValue(at), () => toValue(options)], ([h, place, o]) => {
        stop?.();
        stop = h?.watchFeatures(plain(place), plain(o), features => { found.value = features; });
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
 *   <MapOverlay v-if="selected" :lng-lat="selected.lngLat" popup @close="selected = null">{{ selected.name }}</MapOverlay>
 * </MapJr>
 * ```
 * For many markers, use the `markers` prop of `MapJr`: those are drawn on the canvas.
 */
export const MapOverlay = defineComponent({
    name: 'MapOverlay',
    props: {
        lngLat: {type: Array as unknown as PropType<[number, number]>, required: true},
        anchor: String as PropType<OverlayOptions['anchor']>,
        offset: Array as unknown as PropType<[number, number]>,
        /** Show the content in a box with a pointer to the position. */
        popup: Boolean,
        /** With a listener for `close`, a popup has a button to close it. */
        onClose: Function as PropType<() => void>,
    },
    emits: ['close'],
    setup(props, {slots}) {
        const host = useMapHost(), el = shallowRef<HTMLElement | null>(null), shown = shallowRef(false);
        let overlay: Overlay | null = null;
        const options = (): OverlayOptions => ({lngLat: [props.lngLat[0], props.lngLat[1]], anchor: props.anchor, offset: props.offset && [props.offset[0], props.offset[1]], popup: props.popup, onClose: props.onClose});
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
type Forwarded = Exclude<keyof MapEvents, 'click' | 'load' | 'idle' | 'error'>;
const FORWARDED = ['render', 'resize', 'remove', 'style.load', 'webglcontextlost', 'webglcontextrestored', 'movestart', 'move', 'moveend', 'zoomstart', 'zoom', 'zoomend',
    'rotatestart', 'rotate', 'rotateend', 'pitchstart', 'pitch', 'pitchend', 'dragstart', 'drag', 'dragend', 'dblclick', 'contextmenu', 'mousedown', 'mousemove', 'mouseup', 'mouseover', 'mouseout',
    'touchstart', 'touchmove', 'touchend', 'touchcancel', 'styledata', 'sourcedata', 'data', 'styledataloading', 'sourcedataloading', 'dataloading', 'wheel',
    'boxzoomstart', 'boxzoomcancel', 'boxzoomend', 'stats', 'styleimagemissing', 'terrain', 'geolocate'] as const satisfies readonly Forwarded[];
// (The type check fails here when the map gets an event that the list does not have.)
true satisfies (Forwarded extends typeof FORWARDED[number] ? true : false);
type Undotted<K extends string> = K extends `${infer A}.${infer B}` ? `${A}${B}` : K;
const forwarded = Object.fromEntries(FORWARDED.map(name => [name.replace('.', ''), () => true])) as unknown as {[K in Forwarded as Undotted<K>]: (event: MapEvents[K]) => true};

/** The props of `MapImage`. `P` has the names of the parameters. */
export interface MapImageProps<P extends string = never> {
    /** The name of the image, for `icon-image` of a style layer. */
    name: string;
    /** The names of the parameters of the image. The slot gets a prop for each one. */
    params?: readonly P[];
    /** The URL of an image, in place of an SVG in the slot. */
    src?: string;
    /** The size in CSS pixels. Without it, an SVG has the size of its `viewBox` or else of its `width` and `height` attributes, and another image has its own size. */
    width?: number; height?: number;
    /** The number of image pixels for one CSS pixel (2 for an image "@2x"). */
    pixelRatio?: number;
}
/**
 * An image for the style layers of the map, for the inside of `MapJr`. Write the SVG in the slot:
 *
 * ```vue
 * <MapJr :map-style="style" :extend="places">
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
        if (__DEV__ && !give) console.warn(`[map-jr-gl] MapImage "${props.name}" is not inside MapJr, so no map gets the image. Put it into the content of MapJr.`);
        // (The value of a parameter in the SVG is the text of a slot of a template: `{{color}}`.)
        if (__DEV__) setTimeout(() => { if (!props.src && !svg.value && mounted.value) console.warn(`[map-jr-gl] MapImage "${props.name}" has no image: its content has no <svg> element. Write an <svg> in its slot, or give the URL of an image as "src".`); }, 1000);
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
 * <MapJr :map-style="style" v-model:view="view" :markers="[pins]" :interactive-layers="['places']" @click="onClick" />
 * ```
 * The style is the prop `map-style` (`style` is the CSS style of an element in Vue).
 */
/** What a template ref on `MapJr` has: the map (`null` until it is made) and its state. */
export interface MapJrExposed {
    readonly host: MapHost | null;
    readonly state: MapState | null;
}

const MapJrComponent = defineComponent({
    name: 'MapJr',
    props: {
        /** A style object or the URL of a style. */
        mapStyle: {type: [String, Object] as PropType<string | object>, required: true},
        /** The view, for `v-model:view`. Without it the map starts at `initialView` and the user moves it. */
        view: Object as PropType<ViewInput>,
        initialView: Object as PropType<ViewInput>,
        /** Your own sources and layers on a style from a URL: `{sources, layers, terrain}`. */
        extend: Object as PropType<MapSpec['extend']>,
        /** Images for `icon-image` of style layers, by name. A value is an SVG document, the URL of an image, or `{image, width, height}`. */
        images: Object as PropType<MapSpec['images']>,
        markers: Array as PropType<MarkerLayerOptions[]>,
        /** GeoJSON data for sources of the style, by the id of the source. Each value is compared by identity: give a new object to change it. */
        data: Object as PropType<Record<string, unknown>>,
        interactiveLayers: Array as PropType<string[]>,
        minZoom: Number, maxZoom: Number, maxPitch: Number,
        maxBounds: [Array, Object] as PropType<LngLatBoundsInput | null>,
        cursor: String,
        /** Controls from `@map-jr/map-jr-gl/controls`: `[navigation(), scale()]`. */
        controls: Array as PropType<ControlSpec[]>,
        renderer: String as PropType<'auto' | 'worker' | 'main'>,
        fonts: Array as PropType<FontSource[]>,
        fontFamily: String,
        /** `false`: text uses the fonts of the device, not the glyph files of the style. */
        glyphs: {type: Boolean, default: undefined},
        interactive: {type: Boolean, default: undefined},
        antialias: {type: Boolean, default: undefined},
        attribution: {type: [Boolean, Object] as PropType<false | {compact?: boolean; customAttribution?: string | string[]}>, default: undefined},
        hash: {type: [Boolean, String] as PropType<boolean | string>, default: undefined},
        /**
         * On a server: render the first view as SVG into the page. `true`, or options: the size in pixels that the map
         * has on most screens (800 by 500 without them), `overrides` (changes to style layers for the server render, by
         * the id of the layer: `{building: {hidden: true}}`), and `attribution` (the credits to show, when the server
         * must not take them from the sources of the style), and the limits for requests of the server renderer
         * (`timeout`, `requestTimeout`, `maxBytes`, `allowHosts`). The server also renders `extend` and `data`.
         */
        ssr: {type: [Boolean, Object] as PropType<boolean | {width?: number; height?: number; overrides?: Record<string, SSROverrides>; attribution?: string | string[]; timeout?: number; requestTimeout?: number; maxBytes?: number; allowHosts?: string[]}>, default: false},
    },
    emits: {
        'update:view': (_view: View) => true,
        click: (_event: MapPointer) => true,
        hover: (_features: RenderedFeature[]) => true,
        /** The map. */
        load: (_host: MapHost) => true,
        idle: () => true,
        error: (_error: Error) => true,
        ...forwarded,
    },
    setup(props, {emit, slots, expose}) {
        const el = shallowRef<HTMLElement | null>(null);
        // Each part of the description is found on its own, so that a change of one prop does not make the other parts
        // again. Objects from Vue can be changed in place: the view, the list of marker layers, the data of a layer,
        // a reactive style. (Not the inside of one marker: replace the marker.)
        const style = computed(() => { const v = props.mapStyle; return typeof v === 'object' && isReactive(v) ? plain(v) : v; });
        const view = computed(() => props.view && plain(props.view));
        const extend = computed(() => props.extend && plain(props.extend));
        const markers = computed(() => props.markers?.map(m => {
            const out: any = {};
            for (const k in m) out[k] = k === 'data' ? markerData(m.data) : plain((m as any)[k]);
            return out as MarkerLayerOptions;
        }));
        // (The data of each source is the object behind Vue's object. The list itself can be made again in each render.)
        let lastData: Record<string, unknown> | undefined;
        const data = computed(() => {
            if (!props.data) return undefined;
            const out: Record<string, unknown> = {};
            for (const id in props.data) out[id] = toRaw(props.data[id]);
            return lastData && Object.keys(out).length === Object.keys(lastData).length && Object.keys(out).every(id => out[id] === lastData![id]) ? lastData : lastData = out;
        });
        // (Each image is the object behind Vue's object: an image element or a bitmap cannot be copied.)
        // The images of the `MapImage` components in this map, by component. They come after the images of the prop:
        // with one name in both, the image of the component is used.
        const owners = new Map<object, [string, NonNullable<MapSpec['images']>[string]]>(), fromChildren = shallowRef<NonNullable<MapSpec['images']>>({});
        provide(IMAGES, (owner, image) => {
            if (JSON.stringify(owners.get(owner) ?? null) === JSON.stringify(image)) return;
            if (image) owners.set(owner, image); else owners.delete(owner);
            fromChildren.value = Object.fromEntries(owners.values());
        });
        const images = computed(() => {
            const out: NonNullable<MapSpec['images']> = {};
            for (const name in props.images) out[name] = toRaw(props.images[name]);
            Object.assign(out, fromChildren.value);
            return props.images || owners.size ? out : undefined;
        });
        const layers = computed(() => props.interactiveLayers && [...props.interactiveLayers]);
        const controls = computed(() => props.controls && [...props.controls].map(c => toRaw(c)));
        const listensForError = !!getCurrentInstance()?.vnode.props?.onError;
        const spec = computed<MapSpec>(() => {
            const out: MapSpec = {
                style: style.value, extend: extend.value, view: view.value, initialView: props.initialView && toRaw(props.initialView), images: images.value, markers: markers.value, data: data.value, interactiveLayers: layers.value, controls: controls.value,
                minZoom: props.minZoom, maxZoom: props.maxZoom, maxPitch: props.maxPitch, maxBounds: props.maxBounds && toRaw(props.maxBounds), cursor: props.cursor,
                renderer: props.renderer, fonts: props.fonts && toRaw(props.fonts), fontFamily: props.fontFamily, glyphs: props.glyphs, interactive: props.interactive, antialias: props.antialias,
                attribution: (props.attribution as unknown) === true ? undefined : props.attribution && toRaw(props.attribution), hash: props.hash,
                onViewChange: view => emit('update:view', view), onClick: event => emit('click', event),
                // (Without a listener for `error`, the map writes each error to the console.)
                onError: listensForError ? error => emit('error', error) : undefined,
            };
            for (const k in out) if ((out as any)[k] === undefined) delete (out as any)[k];
            return out;
        });
        const {host, state} = mapIn(el, spec, '<MapJr>');
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
        expose({host, state});

        // The first view from the server: the SVG and the credits. On the server they are made here. In the browser,
        // when the page came from the server, they are read from the element that is there already: the component then
        // renders the same content, and Vue finds no difference. The map removes them when it has drawn its first frame.
        const first = shallowRef((getCurrentInstance()?.vnode.el as HTMLElement | null)?.firstElementChild?.innerHTML ?? '');
        onServerPrefetch(async () => {
            if (!props.ssr) return;
            const view = {...props.initialView, ...props.view}, o = props.ssr === true ? {} : props.ssr;
            // (By the name of the package, so that this file does not contain the server renderer, and so that a tool that
            // collects the files of a server finds it.)
            // @ts-ignore: the package refers to itself, which the type check of this project does not resolve
            const server = await import('@map-jr/map-jr-gl/server') as typeof import('./server.ts');
            first.value = await server.renderFirstView({style: toRaw(props.mapStyle), center: view.center ?? [0, 0], zoom: view.zoom ?? 0, bearing: view.bearing, width: o.width ?? 800, height: o.height ?? 500,
                markers: props.markers && plain(props.markers), images: props.images && toRaw(props.images) as Record<string, string>, overrides: o.overrides, extend: toRaw(props.extend), data: props.data && toRaw(props.data), timeout: o.timeout, requestTimeout: o.requestTimeout, maxBytes: o.maxBytes, allowHosts: o.allowHosts, attribution: props.attribution === false ? false : o.attribution});
        });
        return () => h('div', {class: 'map-jr-vue', style: 'position:relative;width:100%;height:100%'}, [
            h('div', {ref: el, style: 'position:absolute;inset:0', innerHTML: first.value}),
            slots.default?.({host: host.value, state: state.value}),
        ]);
    },
});
// (Vue unwraps the exposed refs on the instance, but the type of `defineComponent` does not name them: the type adds
// them, so that `InstanceType<typeof MapJr>['host']` is `MapHost | null`.)
export const MapJr = MapJrComponent as typeof MapJrComponent & (new (...args: any[]) => InstanceType<typeof MapJrComponent> & MapJrExposed);
