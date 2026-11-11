/**
 * The adapter for Vue 3 (and Nuxt): `import {MapJr, useMap} from 'map-jr-gl/vue'`.
 *
 * It is a thin layer over `createMap` (host.ts). The component gives its props to the map as one description, and
 * the map does the rest. On a server the component can render the first view as SVG; in the browser the map takes
 * over that SVG, so a page from Nuxt shows a map before any script has run.
 */
import {computed, defineComponent, getCurrentInstance, h, inject, provide, isProxy, isReactive, onBeforeUnmount, onMounted, onServerPrefetch, shallowRef, toRaw, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type PropType, type ShallowRef} from 'vue';
import {createMap, type ControlSpec, type MapHost, type MapOverlay as Overlay, type OverlayOptions, type MapPointer, type MapSpec, type MapState, type View} from './host.ts';
import type {SSROverrides} from './style.ts';
import type {RenderedFeature} from './map.ts';
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
export function useMap(container: MaybeRefOrGetter<HTMLElement | null | undefined>, spec: MaybeRefOrGetter<MapSpec>): {host: ShallowRef<MapHost | null>; state: ShallowRef<MapState | null>} {
    const host = shallowRef<MapHost | null>(null), state = shallowRef<MapState | null>(null);
    let stop: (() => void) | undefined;
    onMounted(() => {
        const el = toValue(container);
        if (!el) return;
        const made = host.value = createMap(el, unwrapped(toValue(spec)));
        state.value = made.state.get();
        stop = made.state.subscribe(s => { state.value = s; });
    });
    // (A new description object is a change. The fields are compared by the map, not by Vue.)
    watch(() => toValue(spec), next => host.value?.update(unwrapped(next)), {flush: 'post'});
    onBeforeUnmount(() => { stop?.(); host.value?.destroy(); host.value = null; });
    return {host, state};
}

const HOST = Symbol('map-jr') as unknown as import('vue').InjectionKey<ShallowRef<MapHost | null>>;

/** The map of the `MapJr` component that this component is in (a ref; it has the map when the map has started). */
export const useMapHost = () => inject(HOST, shallowRef(null));

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
        const host = useMapHost(), el = shallowRef<HTMLElement | null>(null);
        let overlay: Overlay | null = null;
        const options = (): OverlayOptions => ({lngLat: [props.lngLat[0], props.lngLat[1]], anchor: props.anchor, offset: props.offset && [props.offset[0], props.offset[1]], popup: props.popup, onClose: props.onClose});
        // The map starts after this component is there, so the element is put on the map when the two exist.
        watch([host, el, options], ([map, element, o]) => {
            if (!map || !element) return;
            if (overlay) overlay.update(o); else { overlay = map.overlay(element, o); element.style.display = ''; }
        }, {flush: 'post', immediate: true});
        onBeforeUnmount(() => { overlay?.remove(); overlay = null; });
        // (Not shown until it is on the map: on a server, and before the map has started, it has no position.)
        return () => h('div', {ref: el, style: 'display:none'}, slots.default?.());
    },
});

/**
 * The map as a component. It fills its parent element, so give the parent a height.
 *
 * ```vue
 * <MapJr :map-style="style" v-model:view="view" :markers="[pins]" :interactive-layers="['places']" @click="onClick" />
 * ```
 * The style is the prop `map-style` (`style` is the CSS style of an element in Vue).
 */
export const MapJr = defineComponent({
    name: 'MapJr',
    props: {
        /** A style object or the URL of a style. */
        mapStyle: {type: [String, Object] as PropType<string | object>, required: true},
        /** The view, for `v-model:view`. Without it the map starts at `initialView` and the user moves it. */
        view: Object as PropType<Partial<View>>,
        initialView: Object as PropType<Partial<View>>,
        markers: Array as PropType<MarkerLayerOptions[]>,
        interactiveLayers: Array as PropType<string[]>,
        minZoom: Number, maxZoom: Number, maxPitch: Number,
        maxBounds: [Array, Object] as PropType<LngLatBoundsInput | null>,
        cursor: String,
        /** Controls from `map-jr-gl/controls`: `[navigation(), scale()]`. */
        controls: Array as PropType<ControlSpec[]>,
        renderer: String as PropType<'auto' | 'worker' | 'main'>,
        fonts: Array as PropType<FontSource[]>,
        fontFamily: String,
        interactive: {type: Boolean, default: undefined},
        antialias: {type: Boolean, default: undefined},
        attribution: {type: [Boolean, Object] as PropType<false | {compact?: boolean; customAttribution?: string | string[]}>, default: undefined},
        hash: {type: [Boolean, String] as PropType<boolean | string>, default: undefined},
        /**
         * On a server: render the first view as SVG into the page. `true`, or options: the size in pixels that the map
         * has on most screens (800 by 500 without them), `overrides` (changes to style layers for the server render, by
         * the id of the layer: `{building: {hidden: true}}`), and `attribution` (the credits to show, when the server
         * must not take them from the sources of the style).
         */
        ssr: {type: [Boolean, Object] as PropType<boolean | {width?: number; height?: number; overrides?: Record<string, SSROverrides>; attribution?: string | string[]}>, default: false},
    },
    emits: {
        'update:view': (_view: View) => true,
        click: (_event: MapPointer) => true,
        hover: (_features: RenderedFeature[]) => true,
        load: () => true,
        idle: () => true,
        error: (_error: Error) => true,
    },
    setup(props, {emit, slots, expose}) {
        const el = shallowRef<HTMLElement | null>(null);
        // Each part of the description is found on its own, so that a change of one prop does not make the other parts
        // again. Objects from Vue can be changed in place: the view, the list of marker layers, the data of a layer,
        // a reactive style. (Not the inside of one marker: replace the marker.)
        const style = computed(() => { const v = props.mapStyle; return typeof v === 'object' && isReactive(v) ? plain(v) : v; });
        const view = computed(() => props.view && plain(props.view));
        const markers = computed(() => props.markers?.map(m => {
            const out: any = {};
            for (const k in m) out[k] = k === 'data' ? markerData(m.data) : plain((m as any)[k]);
            return out as MarkerLayerOptions;
        }));
        const layers = computed(() => props.interactiveLayers && [...props.interactiveLayers]);
        const controls = computed(() => props.controls && [...props.controls].map(c => toRaw(c)));
        const spec = computed<MapSpec>(() => {
            const out: MapSpec = {
                style: style.value, view: view.value, initialView: props.initialView && toRaw(props.initialView), markers: markers.value, interactiveLayers: layers.value, controls: controls.value,
                minZoom: props.minZoom, maxZoom: props.maxZoom, maxPitch: props.maxPitch, maxBounds: props.maxBounds && toRaw(props.maxBounds), cursor: props.cursor,
                renderer: props.renderer, fonts: props.fonts && toRaw(props.fonts), fontFamily: props.fontFamily, interactive: props.interactive, antialias: props.antialias,
                attribution: (props.attribution as unknown) === true ? undefined : props.attribution && toRaw(props.attribution), hash: props.hash,
                onViewChange: view => emit('update:view', view), onClick: event => emit('click', event),
            };
            for (const k in out) if ((out as any)[k] === undefined) delete (out as any)[k];
            return out;
        });
        const {host, state} = useMap(el, spec);
        provide(HOST, host);
        watch(() => state.value?.loaded, loaded => { if (loaded) emit('load'); });
        watch(() => state.value?.idle, idle => { if (idle) emit('idle'); });
        watch(() => state.value?.hover, hover => { if (hover) emit('hover', hover); });
        watch(() => state.value?.error, error => { if (error) emit('error', error); });
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
            const server = await import('map-jr-gl/server') as typeof import('./server.ts');
            const made = await server.renderToSVG({style: toRaw(props.mapStyle), center: view.center ?? [0, 0], zoom: view.zoom ?? 0, bearing: view.bearing, width: o.width ?? 800, height: o.height ?? 500,
                markers: props.markers && plain(props.markers), overrides: o.overrides});
            // The credits: only text and links to http(s) addresses are kept from the HTML of a source.
            const credits = [o.attribution ?? made.attribution].flat().map(html => html.replace(/<(?!\/?a(?=[\s>]))[^>]*>/gi, '').replace(/<a\b([^>]*)>/gi, (_, attrs: string) => { const m = /href\s*=\s*"(https?:[^"]*)"/i.exec(attrs); return m ? `<a href="${m[1]}">` : '<a>'; })).filter(Boolean);
            first.value = made.svg + (credits.length && props.attribution !== false
                ? `<div data-map-jr-ssr="" style="position:absolute;right:0;bottom:0;background:rgba(255,255,255,.75);color:#333;font:11px/1.4 sans-serif;padding:2px 6px">${credits.join(' ')}</div>` : '');
        });
        return () => h('div', {class: 'map-jr-vue', style: 'position:relative;width:100%;height:100%'}, [
            h('div', {ref: el, style: 'position:absolute;inset:0', innerHTML: first.value}),
            slots.default?.({host: host.value, state: state.value}),
        ]);
    },
});
