/**
 * The main API of the library: a map is made from one description (`MapSpec`), and is changed by giving a new
 * description. The library finds what is different. The state of the map (the view, loaded, idle, the features under
 * the pointer) is in a store that code can watch.
 *
 * The adapters for the frameworks (`map-jr-gl/vue` and others) are thin layers over `createMap`.
 * (For the API of MapLibre GL JS, see `map-jr-gl/maplibre-compat`.)
 */
import {Map, type MapOptions, type MarkerLayer, type RenderedFeature} from './map.ts';
import {createStore, type Readable} from './store.ts';
import {Marker, Popup, type OverlayAnchor} from './overlays.ts';
import type {MarkerLayerOptions} from './markers.ts';
import type {QueriedFeature} from './query.ts';
import type {FontSource} from './engine.ts';
import type {LngLatBoundsInput} from './lnglat.ts';

/** The description of a control: see `map-jr-gl/controls`. Controls with the same `key` are the same control. */
export interface ControlSpec { key: string; position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; create(): {onAdd(map: any): HTMLElement; onRemove(map: any): void} }

/** Where the camera is. */
export interface View { center: [number, number]; zoom: number; bearing: number; pitch: number }
export interface MapPointer { point: {x: number; y: number}; lngLat: [number, number]; /** The features of `interactiveLayers` at the point, the top one first. */ features: RenderedFeature[] }

/** The description of a map. Each field can change in `update`, but for those of `MapSetup`. */
export interface MapSpec extends MapSetup {
    /** A style object or the URL of a style (the MapLibre style specification). A new object or URL is a new style. */
    style: string | object;
    /** The view at the start. The user then moves the map. */
    initialView?: Partial<View>;
    /**
     * A view that the application owns. Give it together with `onViewChange` and write each change back, or change it
     * to move the map. (The map does not wait for the application: a view that the map itself reported is not applied again.)
     */
    view?: Partial<View>;
    onViewChange?: (view: View) => void;
    /** Marker layers, each with an `id`. A layer whose `data` is a new array gets the new data. */
    markers?: MarkerLayerOptions[];
    /** Controls from `map-jr-gl/controls`: `[navigation(), scale()]`. */
    controls?: ControlSpec[];
    /** Style layers whose features are found under the pointer: they are in `state.hover` and in `onClick`. */
    interactiveLayers?: string[];
    onClick?: (event: MapPointer) => void;
    minZoom?: number; maxZoom?: number; maxPitch?: number; maxBounds?: LngLatBoundsInput | null;
    /** The mouse cursor over the map. Without it, the cursor is a pointer over a feature of `interactiveLayers`. */
    cursor?: string;
}
/** The fields that are read when the map is made only. */
export interface MapSetup {
    renderer?: 'auto' | 'worker' | 'main';
    fonts?: FontSource[];
    fontFamily?: string;
    interactive?: boolean;
    antialias?: boolean;
    attribution?: false | {compact?: boolean; customAttribution?: string | string[]};
    hash?: boolean | string;
}

export interface MapState {
    /** The style and the first tiles have loaded. */
    loaded: boolean;
    /** Nothing moves and nothing loads. */
    idle: boolean;
    moving: boolean;
    view: View;
    /** The features of `interactiveLayers` under the pointer. */
    hover: RenderedFeature[];
    /** The thread that draws: known when the map has started. */
    renderer: 'worker' | 'main' | undefined;
    error: Error | undefined;
}

/** Where an element of the page is on the map. */
export interface OverlayOptions {
    lngLat: [number, number];
    /** The part of the element that is at the position: `'center'` (the default), `'bottom'`, `'top-left'` and others. */
    anchor?: OverlayAnchor;
    /** A distance in pixels from the position, to the right and down. */
    offset?: [number, number];
    /** Show the element in a box with a pointer to the position (a popup). With `onClose`, the box has a button to close it. */
    popup?: boolean;
    onClose?: () => void;
}
export interface MapOverlay { update(options: OverlayOptions): void; remove(): void }

export interface MapHost {
    /** Changes the map to a new description. Give the complete description each time. */
    update(spec: MapSpec): void;
    destroy(): void;
    readonly state: Readable<MapState>;
    /**
     * The features at a point of the screen (`{x, y}`) or in a rectangle (two points). With `layers`, the features that
     * those style layers draw, the top one first; without, the features of the tile data (`sources`, `sourceLayers`).
     */
    queryFeatures(at: {x: number; y: number} | [{x: number; y: number}, {x: number; y: number}], options?: {layers?: string[]; filter?: unknown; sources?: string[]; sourceLayers?: string[]; radius?: number; geometry?: boolean}): Promise<(RenderedFeature | QueriedFeature)[]>;
    /** The height of the ground in metres at a position (`[lng, lat]`) or a point of the screen, from the elevation source of the style. `null` where there is no data. */
    queryElevation(at: [number, number] | {x: number; y: number}): Promise<number | null>;
    /** Moves the camera now, with an animation when `duration` is not 0. */
    moveTo(view: Partial<View> & {duration?: number}): void;
    fitBounds(bounds: LngLatBoundsInput, options?: {padding?: number; duration?: number; maxZoom?: number}): void;
    project(lngLat: [number, number]): {x: number; y: number};
    unproject(point: {x: number; y: number}): [number, number];
    /**
     * Puts an element of the page at a position of the map: a marker with your own content, a label, a popup. The
     * element moves with the map. For many markers, use a marker layer (`markers` in the description): it is drawn
     * on the canvas and is much faster.
     */
    overlay(element: HTMLElement, options: OverlayOptions): MapOverlay;
    /** Calls `fn` for each event of that type. Returns a function that stops it. */
    listen(type: string, fn: (event: any) => void): () => void;
    readonly container: HTMLElement;
    /** The map object behind this host, for a need that this API does not cover yet. It can change between versions. */
    readonly map: Map;
}

const same = (a: Partial<View> | undefined, b: Partial<View> | undefined) => !!a && !!b && a.zoom === b.zoom && a.bearing === b.bearing && a.pitch === b.pitch && a.center?.[0] === b.center?.[0] && a.center?.[1] === b.center?.[1];

export function createMap(container: HTMLElement | string, spec: MapSpec): MapHost {
    const first = {...spec.initialView, ...spec.view};
    const options: MapOptions = {
        container, style: spec.style, ...first, renderer: spec.renderer, fonts: spec.fonts, fontFamily: spec.fontFamily, interactive: spec.interactive, antialias: spec.antialias, hash: spec.hash,
        attributionControl: spec.attribution, minZoom: spec.minZoom, maxZoom: spec.maxZoom, maxPitch: spec.maxPitch,
    };
    for (const k in options) if ((options as any)[k] === undefined) delete (options as any)[k];
    const map = new Map(options);
    const viewOf = (): View => { const c = map.getCenter(); return {center: [c.lng, c.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch()}; };
    const state = createStore<MapState>({loaded: false, idle: false, moving: false, view: viewOf(), hover: [], renderer: undefined, error: undefined});
    const markers = new globalThis.Map<string, {layer: MarkerLayer; options: MarkerLayerOptions}>();
    const controls = new globalThis.Map<string, ReturnType<ControlSpec['create']>>();
    // The views that the map reported a short time ago. An application that owns the view gives them back, often some
    // frames later; they are not applied again, or the map would go back while the user moves it.
    const reported: View[] = [];
    let now = spec, alive = true, pointer: {x: number; y: number} | null = null, asking = false;

    map.on('load', () => state.set({loaded: true, renderer: map.renderer as MapState['renderer']}));
    map.on('idle', () => state.set({idle: true}));
    map.on('error', e => state.set({error: e.error instanceof Error ? e.error : new Error(String(e.error))}));
    const moved = (moving: boolean) => {
        const view = viewOf();
        if (same(view, state.get().view)) return state.set({moving, idle: false});
        reported.push(view);
        if (reported.length > 60) reported.shift();
        state.set({view, moving, idle: false});
        now.onViewChange?.(view);
    };
    map.on('movestart', () => moved(true));
    map.on('move', () => moved(true));
    map.on('moveend', () => moved(false));

    // The features under the pointer: one query at a time, and the last position is asked again when it has changed.
    const hover = async () => {
        if (asking || !alive) return;
        asking = true;
        while (alive) {
            const at = pointer, layers = now.interactiveLayers;
            const found = at && layers?.length ? await map.queryLayers([at.x, at.y], {layers}) : [];
            if (!alive) break;
            const before = state.get().hover;
            if (found.length !== before.length || found.some((f, i) => f.id !== before[i].id || (f.layer as any)?.id !== (before[i].layer as any)?.id || f.source !== before[i].source)) state.set({hover: found});
            if (!now.cursor) map.setCursor(found.length ? 'pointer' : '');
            if (at === pointer) break;
        }
        asking = false;
    };
    map.on('mousemove', e => { pointer = e.point ?? null; if (now.interactiveLayers?.length || state.get().hover.length) hover(); });
    map.on('mouseout', () => { pointer = null; hover(); });
    map.on('moveend', () => { if (pointer) hover(); });
    map.on('click', async e => {
        const click = now.onClick, layers = now.interactiveLayers;
        if (!click || !e.point || !e.lngLat) return;
        click({point: e.point, lngLat: [e.lngLat.lng, e.lngLat.lat], features: layers?.length ? await map.queryLayers([e.point.x, e.point.y], {layers}) : []});
    });

    const apply = (next: MapSpec, before?: MapSpec) => {
        // (A description that is made again each time, as in a template of a framework, has new objects with the same
        // content. So where the identity is different, the content is compared before the map does work.)
        const differ = (a: unknown, b: unknown) => a !== b && JSON.stringify(a) !== JSON.stringify(b);
        if (before && differ(next.style, before.style)) { state.set({idle: false}); map.setStyle(next.style); }
        if (next.view && !same(next.view, before?.view) && !reported.some(v => same(v, next.view)) && before) map.jumpTo(next.view);
        if (next.minZoom !== before?.minZoom && before) map.setMinZoom(next.minZoom);
        if (next.maxZoom !== before?.maxZoom && before) map.setMaxZoom(next.maxZoom);
        if (next.maxPitch !== before?.maxPitch && before) map.setMaxPitch(next.maxPitch);
        if (differ(next.maxBounds, before?.maxBounds)) map.setMaxBounds(next.maxBounds);
        if (next.controls !== before?.controls) {
            const wanted = new Set((next.controls ?? []).map(c => c.key));
            for (const [key, c] of controls) if (!wanted.has(key)) { map.removeControl(c as any); controls.delete(key); }
            for (const c of next.controls ?? []) if (!controls.has(c.key)) { const made = c.create(); controls.set(c.key, made); map.addControl(made as any, c.position); }
        }
        if (next.cursor !== before?.cursor) map.setCursor(next.cursor ?? '');
        if (next.markers !== before?.markers) {
            const wanted = new Set((next.markers ?? []).map(m => m.id));
            for (const [id, m] of markers) if (!wanted.has(id)) { m.layer.remove(); markers.delete(id); }
            for (const m of next.markers ?? []) {
                const have = markers.get(m.id);
                if (have?.options === m) continue;
                // Only the data is new: the layer keeps its images. Another change makes the layer again.
                const {data: a, ...restA} = m, {data: b, ...restB} = have?.options ?? {data: null};
                if (have && JSON.stringify(restA) === JSON.stringify(restB)) { if (a !== b) have.layer.setData(a); have.options = m; }
                else { have?.layer.remove(); markers.set(m.id, {layer: map.addMarkerLayer({...m}), options: m}); }
            }
        }
        if (differ(next.interactiveLayers, before?.interactiveLayers)) hover();
        now = next;
    };
    apply(spec);

    return {
        update(next) { if (alive) apply(next, now); },
        destroy() { if (!alive) return; alive = false; map.remove(); },
        state,
        queryFeatures: (at, o = {}) => Array.isArray(at) || o.layers
            ? map.queryLayers((Array.isArray(at) ? at.map(p => [p.x, p.y]) : [at.x, at.y]) as [[number, number], [number, number]], {layers: o.layers, filter: o.filter})
            : map.queryFeatures(at, o),
        queryElevation: at => map.queryElevation(at),
        moveTo({duration = 0, ...view}) { if (duration) map.easeTo({...view, duration}); else map.jumpTo(view); },
        fitBounds: (bounds, o) => { map.fitBounds(bounds, o); },
        project: lngLat => map.project(lngLat),
        unproject: point => { const p = map.unproject(point); return [p.lng, p.lat]; },
        overlay(element, o) {
            let now = o;
            const make = () => {
                if (!now.popup) return new Marker({element, anchor: now.anchor, offset: now.offset}).setLngLat(now.lngLat).addTo(map);
                const p = new Popup({anchor: now.anchor, offset: now.offset, closeButton: !!now.onClose, closeOnClick: false}).setLngLat(now.lngLat).setDOMContent(element).addTo(map);
                p.on('close', () => { if (made === p) now.onClose?.(); });
                return p;
            };
            let made: Marker | Popup | null = make();
            return {
                update(next) {
                    const again = !!next.popup !== !!now.popup || next.anchor !== now.anchor || String(next.offset) !== String(now.offset) || !!next.onClose !== !!now.onClose;
                    now = next;
                    if (!made) return;
                    if (again) { const old = made; made = null; old.remove(); made = make(); } else made.setLngLat(next.lngLat);
                },
                remove() { const old = made; made = null; old?.remove(); },
            };
        },
        listen(type, fn) { map.on(type, fn); return () => { map.off(type, fn); }; },
        container: map.getContainer(),
        map,
    };
}
