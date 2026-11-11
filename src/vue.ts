/**
 * The adapter for Vue 3 (and Nuxt): `import {MapJr, useMap} from 'map-jr-gl/vue'`.
 *
 * It is a thin layer over `createMap` (host.ts). The component gives its props to the map as one description, and
 * the map does the rest. On a server the component can render the first view as SVG; in the browser the map takes
 * over that SVG, so a page from Nuxt shows a map before any script has run.
 */
import {computed, defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, onServerPrefetch, shallowRef, toRaw, toValue, watch, type MaybeRefOrGetter, type PropType, type ShallowRef} from 'vue';
import {createMap, type MapHost, type MapPointer, type MapSpec, type MapState, type View} from './host.ts';
import type {RenderedFeature} from './map.ts';
import type {MarkerLayerOptions} from './markers.ts';
import type {FontSource} from './engine.ts';
import type {LngLatBoundsInput} from './lnglat.ts';

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
        const made = host.value = createMap(el, toValue(spec));
        state.value = made.state.get();
        stop = made.state.subscribe(s => { state.value = s; });
    });
    // (A new description object is a change. The fields are compared by the map, not by Vue.)
    watch(() => toValue(spec), next => host.value?.update(next), {flush: 'post'});
    onBeforeUnmount(() => { stop?.(); host.value?.destroy(); host.value = null; });
    return {host, state};
}

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
        renderer: String as PropType<'auto' | 'worker' | 'main'>,
        fonts: Array as PropType<FontSource[]>,
        fontFamily: String,
        interactive: {type: Boolean, default: undefined},
        antialias: {type: Boolean, default: undefined},
        attribution: {type: [Boolean, Object] as PropType<false | {compact?: boolean; customAttribution?: string | string[]}>, default: undefined},
        hash: {type: [Boolean, String] as PropType<boolean | string>, default: undefined},
        /**
         * On a server: render the first view as SVG into the page (`true`, for a map of 800 by 500 pixels, or the size
         * in pixels). The SVG is larger than an image of the same view; see the documentation of server rendering.
         */
        ssr: {type: [Boolean, Object] as PropType<boolean | {width: number; height: number}>, default: false},
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
        const spec = computed<MapSpec>(() => {
            const out: MapSpec = {
                style: props.mapStyle, view: props.view, initialView: props.initialView, markers: props.markers, interactiveLayers: props.interactiveLayers,
                minZoom: props.minZoom, maxZoom: props.maxZoom, maxPitch: props.maxPitch, maxBounds: props.maxBounds, cursor: props.cursor,
                renderer: props.renderer, fonts: props.fonts, fontFamily: props.fontFamily, interactive: props.interactive, antialias: props.antialias,
                attribution: (props.attribution as unknown) === true ? undefined : props.attribution, hash: props.hash,
                onViewChange: view => emit('update:view', view), onClick: event => emit('click', event),
            };
            // Vue gives reactive objects. The map needs the objects behind them: they go to a worker, and a part that did
            // not change must keep its identity. (So give a new array or object to change markers, the view or the style.)
            for (const k in out) { const v = (out as any)[k]; if (v === undefined) delete (out as any)[k]; else if (typeof v === 'object') (out as any)[k] = toRaw(v); }
            return out;
        });
        const {host, state} = useMap(el, spec);
        watch(() => state.value?.loaded, loaded => { if (loaded) emit('load'); });
        watch(() => state.value?.idle, idle => { if (idle) emit('idle'); });
        watch(() => state.value?.hover, hover => { if (hover) emit('hover', hover); });
        watch(() => state.value?.error, error => { if (error) emit('error', error); });
        expose({host, state});

        // The SVG of the first view. On the server it is rendered here. In the browser, when the page came from the
        // server, it is read from the element that is there already: the component then renders the same content, and
        // Vue finds no difference. The map removes the SVG when it has drawn its first frame.
        const svg = shallowRef((getCurrentInstance()?.vnode.el as HTMLElement | null)?.querySelector?.('[data-map-jr-ssr]')?.outerHTML ?? '');
        onServerPrefetch(async () => {
            if (!props.ssr) return;
            const view = {...props.initialView, ...props.view}, size = props.ssr === true ? {width: 800, height: 500} : props.ssr;
            // (By the name of the package, so that this file does not contain the server renderer, and so that a tool that
            // collects the files of a server finds it.)
            // @ts-ignore: the package refers to itself, which the type check of this project does not resolve
            const server = await import('map-jr-gl/server') as typeof import('./server.ts');
            svg.value = (await server.renderToSVG({style: props.mapStyle, center: view.center ?? [0, 0], zoom: view.zoom ?? 0, bearing: view.bearing, ...size, markers: props.markers})).svg;
        });
        return () => h('div', {class: 'map-jr-vue', style: 'position:relative;width:100%;height:100%'}, [
            h('div', {ref: el, style: 'position:absolute;inset:0', innerHTML: svg.value}),
            slots.default?.({host: host.value, state: state.value}),
        ]);
    },
});
