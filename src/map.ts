import {Transform, groundHeight, mercX, mercY, toLngLat, type LngLatLike} from './geo.ts';
import type {PreparedSource} from './geojson.ts';
import {resolveStyle, type ResolvedStyle} from './style.ts';
import type {CameraOptions, Command, EngineEvent, FeatureQuery, FontSource, MarkerImage} from './engine.ts';
import type {QueriedFeature} from './query.ts';
import type {TileBackend} from './tiles.ts';
import {acquireTileWorkers, createWorker, workerReady, type LoadOptions} from './loader.ts';
import {anchorOffset, resolveVariants, sizedSVG, type MarkerInput, type MarkerLayerOptions} from './markers.ts';
import {DEFAULT_FONT} from './text.ts';
import {AttributionControl, CONTROL_CSS, adoptClasses, cls, type Control, type ControlPosition} from './controls.ts';
import {Popup, type PopupOptions} from './overlays.ts';
import {CollisionGrid} from './collision.ts';


export interface MapOptions extends CameraOptions, LoadOptions {
    container: HTMLElement | string;
    style: unknown;
    /**
     * Where the engine (camera, placement, drawing) runs. 'worker' keeps the map smooth while the page is busy;
     * 'main' renders on the page's own thread. 'auto' picks 'worker' when the browser supports it.
     */
    renderer?: 'auto' | 'worker' | 'main';
    /** Fallback CSS font-family for labels, used when the family a style names is not available. */
    fontFamily?: string;
    /**
     * Web fonts to load for labels, e.g. `{family: 'Open Sans', src: '/fonts/open-sans.woff2', weight: '300 800'}`.
     * A style's `text-font` of "Open Sans Semibold" then renders in that family at weight 600. Fonts are loaded on
     * the rendering thread, so they work with worker rendering, which cannot see fonts loaded by the page's CSS.
     */
    fonts?: FontSource[];
    interactive?: boolean;
    minZoom?: number;
    maxZoom?: number;
    /** Largest camera tilt allowed, in degrees (at most 60). */
    maxPitch?: number;
    /** Data credits are shown by default; pass false to add your own, or options for the built-in control. */
    attributionControl?: false | {compact?: boolean; customAttribution?: string | string[]};
    /** Multisample antialiasing for the whole canvas. Smoother polygon edges, at a real cost in fill rate. */
    antialias?: boolean;
}

export interface MapEvent { type: string; target: Map; point?: {x: number; y: number}; lngLat?: {lng: number; lat: number}; [key: string]: unknown }
type Listener = (e: MapEvent) => void;

/** A set of markers drawn on the map canvas from an SVG template. */
export class MarkerLayer {
    data: MarkerInput[];
    constructor(private map: Map, readonly options: MarkerLayerOptions) { this.data = options.data; }
    setData(data: MarkerInput[]) { this.data = this.options.data = data; this.map._syncMarkers(this); return this; }
    /** Changes one marker's template properties, e.g. to show a hover or selected state. */
    setProps(index: number, props: Record<string, unknown>) {
        this.data[index] = {...this.data[index], props: {...this.data[index].props, ...props}};
        this.map._syncMarkers(this);
        return this;
    }
    remove() { this.map.removeMarkerLayer(this.options.id); }

    private selected: number | null = null;
    private callout?: Popup;

    /**
     * Marks one marker as selected: it grows smoothly about its anchor point (pass null to clear). Labels move out
     * of the way of the larger marker when the layer has `collide` set.
     */
    select(index: number | null, options: {scale?: number; duration?: number} = {}) {
        const duration = options.duration ?? 180, id = this.options.id;
        if (this.selected !== null && this.selected !== index) this.map._command({type: 'markerScale', id, index: this.selected, scale: 1, duration});
        this.selected = index;
        if (index !== null) this.map._command({type: 'markerScale', id, index, scale: options.scale ?? 1.35, duration});
        return this;
    }
    getSelected() { return this.selected; }

    /**
     * Selects a marker and opens a callout pointing at it. Map labels reflow around the callout while it is open.
     * `content` is text, or a DOM node for rich content. Closing the callout clears the selection.
     */
    openPopup(index: number, content: string | Node, options: PopupOptions & {scale?: number} = {}) {
        const o = this.options, scale = options.scale ?? 1.35, [ox, oy] = anchorOffset(o.anchor, o.width, o.height), key = 'callout:' + o.id;
        this.callout?.remove();
        this.select(index, {scale});
        // The enlarged marker's edges relative to its map position. The callout sits just clear of whichever edge it
        // ends up beside: above by default, below or to one side when the marker is near the edge of the map.
        const top = oy * scale - 2, bottom = (oy + o.height) * scale + 2, left = ox * scale, right = (ox + o.width) * scale;
        const popup = this.callout = new Popup({offset: {
            bottom: [0, top], 'bottom-left': [left, top], 'bottom-right': [right, top],
            top: [0, bottom], 'top-left': [left, bottom], 'top-right': [right, bottom],
        }, ...options});
        if (typeof content === 'string') popup.setText(content); else popup.setDOMContent(content);
        popup.setLngLat(this.data[index].lngLat).addTo(this.map);
        const [lng, lat] = this.data[index].lngLat;
        // Labels keep clear of the callout; told again if it flips to another side.
        let side = '';
        const reserve = () => {
            if (popup.getAnchor() === side) return;
            side = popup.getAnchor();
            const box = popup.getBox();
            if (box) this.map._command({type: 'obstacle', id: key, merc: [mercX(lng), mercY(lat)], box});
        };
        reserve();
        this.map.on('moveend', reserve);
        popup.on('close', () => {
            this.map.off('moveend', reserve);
            if (this.callout !== popup) return;
            this.callout = undefined;
            this.map._command({type: 'obstacle', id: key});
            if (this.selected === index) this.select(null);
        });
        return popup;
    }
}

export class Map {
    private container: HTMLElement;
    private canvas: HTMLCanvasElement;
    private tr = new Transform();
    private listeners: Record<string, Listener[]> = {};
    private send: (c: Command, transfer?: Transferable[]) => void = () => {};
    private queue: [Command, Transferable[]?][] = [];
    private workers: Worker[] = [];
    private style!: ResolvedStyle;
    private rawStyle: any;
    private dpr = 1;
    private isLoaded = false;
    private moving = false;
    private ready = false;
    private styleBase = '';
    private markerLayers = new globalThis.Map<string, MarkerLayer>();
    private variantIds = new globalThis.Map<string, number>();
    private hovered: {layer: MarkerLayer; index: number} | null = null;
    private observer?: ResizeObserver;
    private cleanup: (() => void)[] = [];
    private inputCleanup: (() => void)[] = [];
    private tilePool?: {connect(): MessagePort[]; release(): void};
    private removed = false;
    private beforeStyle: (() => void)[] = [];
    private imageNames = new Set<string>();
    private imageResolver: ((id: string) => void | Promise<void>) | null = null;
    private tilesLoaded = false;
    /** Global state values set at runtime, on top of the style's defaults. */
    private globalState: Record<string, unknown> = {};
    private zooming = false; private rotating = false; private pitching = false;
    /** Height grids of loaded elevation tiles (3D terrain), mirrored from the engine. */
    private heights = new globalThis.Map<string, Float32Array>();
    private pending = new globalThis.Map<number, {resolve(v: any): void; reject(e: Error): void}>();
    private nextQuery = 1;
    /** Which thread the engine ended up on. */
    renderer: 'worker' | 'main' = 'main';

    constructor(private options: MapOptions) {
        const c = typeof options.container === 'string' ? document.getElementById(options.container) : options.container;
        if (!c) throw new Error('Map container not found');
        this.container = c;
        if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
        if (getComputedStyle(c).overflow === 'visible') c.style.overflow = 'hidden'; // a frame from before a shrink must not spill out
        this.canvas = document.createElement('canvas');
        // `object-fit: none` shows the canvas's current frame unscaled and centred, whatever size that frame is. With
        // worker rendering a new frame arrives a moment after the container resizes; until it does, the old frame simply
        // stays centred instead of being stretched to the new shape. The box is sized in device pixels and scaled back
        // down so one frame pixel is one screen pixel.
        this.canvas.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;object-fit:none;object-position:center;touch-action:none;outline:none;max-width:none';
        this.canvas.tabIndex = 0;
        // Server-rendered markup stays visible on top until the canvas has drawn the same view.
        c.insertBefore(this.canvas, c.firstChild);
        this.tr.minZoom = options.minZoom ?? 0;
        this.tr.maxZoom = options.maxZoom ?? 22;
        this.measure();
        this.canvas.width = Math.round(this.tr.width * this.dpr);
        this.canvas.height = Math.round(this.tr.height * this.dpr);
        this.tr.maxPitch = options.maxPitch ?? 60;
        this.tr.set(options.center ?? [0, 0], options.zoom ?? 0, options.bearing ?? 0, options.pitch ?? 0);
        this.start().catch(err => this.fire('error', {error: err}));
    }

    private measure() {
        const r = this.container.getBoundingClientRect();
        this.tr.width = r.width; this.tr.height = r.height;
        this.dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
        Object.assign(this.canvas.style, {width: this.dpr * 100 + '%', height: this.dpr * 100 + '%', transform: `scale(${1 / this.dpr})`});
    }

    private async start() {
        const o = this.options;
        this.rawStyle = typeof o.style === 'string' ? await (await fetch(o.style)).json() : structuredClone(o.style);
        for (const fn of this.beforeStyle.splice(0)) fn();
        this.styleBase = typeof o.style === 'string' ? new URL(o.style, location.href).href : location.href;
        // As in MapLibre, a style may carry its own starting camera; explicit options win.
        const sc = this.rawStyle;
        this.tr.set(o.center === undefined ? sc.center : undefined, o.zoom === undefined ? sc.zoom : undefined, o.bearing === undefined ? sc.bearing : undefined, o.pitch === undefined ? sc.pitch : undefined);
        this.style = await resolveStyle(this.rawStyle, fetch, this.styleBase);
        if (this.style.unsupported.length) console.warn('[map-jr-gl] Skipping unsupported layer types: ' + this.style.unsupported.join(', '));
        const tr = this.tr;
        const engineOptions = {
            style: this.style, width: tr.width, height: tr.height, dpr: this.dpr, fontFamily: o.fontFamily ?? DEFAULT_FONT, fonts: o.fonts,
            center: [tr.lng, tr.lat] as [number, number], zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch,
            minZoom: tr.minZoom, maxZoom: tr.maxZoom, maxPitch: tr.maxPitch, antialias: o.antialias,
        };

        // Tile workers come from a pool shared by all maps. If workers cannot be started at all (the file is missing,
        // or a security policy forbids them), everything still works on this thread, just less smoothly.
        let ports: MessagePort[] = [];
        try {
            this.tilePool = await acquireTileWorkers(o);
            ports = this.tilePool.connect();
        } catch (err) {
            console.warn(`[map-jr-gl] Workers are unavailable (${(err as Error).message}); running on the main thread. ` +
                'If the worker file is not next to the library, pass `workerUrl` or `createWorker`, or use the standalone build.');
        }

        const wantWorker = o.renderer === 'worker' || (o.renderer ?? 'auto') === 'auto';
        let engineWorker: Worker | null = null;
        if (wantWorker && ports.length && 'transferControlToOffscreen' in this.canvas) {
            try { engineWorker = await workerReady(createWorker(o)); } catch { engineWorker = null; }
        }
        if (this.removed) { engineWorker?.terminate(); return; }
        if (engineWorker) {
            const off = this.canvas.transferControlToOffscreen(), w = engineWorker;
            this.workers.push(w);
            w.onmessage = e => {
                if (e.data.type !== 'fatal') return this.onEngineEvent(e.data);
                // The worker could not create a WebGL2 context. A transferred canvas cannot be taken back, so swap in a new one.
                console.warn('[map-jr-gl] Worker rendering unavailable, using the main thread: ' + e.data.message);
                const fresh = this.canvas.cloneNode() as HTMLCanvasElement;
                this.canvas.replaceWith(fresh);
                for (const fn of this.inputCleanup.splice(0)) fn();
                this.canvas = fresh;
                this.startMainEngine(fresh, {...engineOptions, center: [this.tr.lng, this.tr.lat], zoom: this.tr.zoom, bearing: this.tr.bearing}, []).then(() => {
                    for (const layer of this.markerLayers.values()) { this.variantIds.clear(); this._syncMarkers(layer); }
                    if (o.interactive !== false) this.bindInput();
                }, error => this.fire('error', {error}));
            };
            w.postMessage({role: 'engine', canvas: off, options: engineOptions, ports}, [off, ...ports]);
            this.send = (c, transfer) => w.postMessage(c, transfer ?? []);
            this.renderer = 'worker';
        } else {
            await this.startMainEngine(this.canvas, engineOptions, ports);
        }
        this.ready = true;
        for (const [c, t] of this.queue) this.send(c, t);
        this.queue = [];
        this.send({type: 'repaint'});

        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(this.container);
        if (o.interactive !== false) this.bindInput();
        if (o.attributionControl !== false) this.addControl(new AttributionControl(o.attributionControl || {}));
    }

    /** Runs the engine on this thread. Its code is a separate chunk, fetched only when this path is taken. */
    private async startMainEngine(canvas: HTMLCanvasElement, options: import('./engine.ts').EngineOptions, ports: MessagePort[]) {
        const {Engine, LocalBackend, PortBackend} = await import('./engine-entry.ts');
        const backends: TileBackend[] = ports.length ? ports.map(p => new PortBackend(p)) : [new LocalBackend()];
        const engine = new Engine(canvas, options, backends, e => this.onEngineEvent(e));
        this.send = c => engine.command(c);
        this.renderer = 'main';
    }

    /** @internal Sends a command to the engine. */
    _command(c: Command) { this.post(c); }

    private post(c: Command, transfer?: Transferable[]) {
        if (c.type !== 'query' && c.type !== 'elevation') this.tilesLoaded = false;
        if (this.ready) this.send(c, transfer); else this.queue.push([c, transfer]);
    }

    private onEngineEvent(e: EngineEvent) {
        if (e.type === 'camera') {
            const zoomed = e.zoom !== this.tr.zoom;
            const turned = e.bearing !== this.tr.bearing, tilted = e.pitch !== this.tr.pitch;
            Object.assign(this.tr, {lng: e.lng, lat: e.lat, zoom: e.zoom, bearing: e.bearing, pitch: e.pitch, elevation: e.elevation, padding: e.padding});
            // With 3D terrain, positions on this thread follow the ground too (clicks, project/unproject, DOM markers).
            const k = e.exaggeration;
            this.tr.groundRange = e.groundRange;
            this.tr.heightAt = k > 0 ? (mx, my) => groundHeight(this.heights, mx, my, 15, 0, e.elevation / k) * k : undefined;
            this.tilesLoaded = false;
            if (!this.moving) this.fire('movestart');
            this.moving = true;
            this.fire('move');
            if (zoomed) { if (!this.zooming) this.fire('zoomstart'); this.zooming = true; this.fire('zoom'); }
            if (turned) { if (!this.rotating) this.fire('rotatestart'); this.rotating = true; this.fire('rotate'); }
            if (tilted) { if (!this.pitching) this.fire('pitchstart'); this.pitching = true; this.fire('pitch'); }
            // After a drag is released with inertia, the last drag frame can report "not moving" before the inertia's
            // first frame arrives. Movement has not ended until the inertia has been seen to start and then stop.
            if (e.moving) this.awaitingInertia = false;
            if (!e.moving && !this.dragging && !this.awaitingInertia) {
                this.moving = false;
                if (this.zooming) { this.zooming = false; this.fire('zoomend'); }
                if (this.rotating) { this.rotating = false; this.fire('rotateend'); }
                if (this.pitching) { this.pitching = false; this.fire('pitchend'); }
                this.fire('moveend');
            }
        } else if (e.type === 'idle') {
            this.tilesLoaded = true;
            if (!this.isLoaded) {
                this.isLoaded = true;
                this.container.querySelector('[data-map-jr-ssr]')?.remove();
                this.fire('load');
            }
            this.fire('idle');
        } else if (e.type === 'heights') {
            if (e.grid) this.heights.set(e.key, e.grid); else this.heights.delete(e.key);
            if (this.tr.heightAt && !this.moving) this.fire('move'); // overlays re-position onto the newly known ground (while moving, every frame does this anyway)
        } else if (e.type === 'stats') {
            this.fire('stats', {fps: e.fps, frameMs: e.frameMs});
        } else if (e.type === 'resized') {
            this.fire('resize');
        } else if (e.type === 'result') {
            const p = this.pending.get(e.id);
            this.pending.delete(e.id);
            if (e.error) p?.reject(new Error(e.error)); else p?.resolve(e.value);
        } else if (e.type === 'imagemissing') {
            // Give the resolver the first chance to supply the image; the event is for anything it leaves unresolved.
            Promise.resolve(this.imageResolver?.(e.name)).catch(error => this.fire('error', {error})).then(() => {
                if (!this.imageNames.has(e.name)) this.fire('styleimagemissing', {id: e.name});
            });
        }
        else if (e.type === 'error') this.fire('error', {error: new Error(e.message)});
    }

    // ---- events ----
    /**
     * `on(type, listener)`, or `on(type, layerId, listener)` to hear `click`, `mousemove`, `mouseenter` and
     * `mouseleave` only where that style layer's features are, with the features on the event as `e.features`.
     */
    on(type: string, a: string | Listener, b?: Listener) {
        if (typeof a === 'string') this.layerListeners.push({type, layer: a, fn: b!}); else (this.listeners[type] ??= []).push(a);
        return this;
    }
    off(type: string, a: string | Listener, b?: Listener) {
        if (typeof a === 'string') this.layerListeners = this.layerListeners.filter(l => !(l.type === type && l.layer === a && l.fn === b));
        else this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== a);
        return this;
    }
    private layerListeners: {type: string; layer: string; fn: Listener}[] = [];
    private hoveredLayers = new Set<string>();
    private hoverBusy = false;

    /** Features of one style layer at a screen point, found from tile data using the layer's source, source layer and filter. */
    private async layerFeatures(layerId: string, point: {x: number; y: number}) {
        const layer = this.getLayer(layerId);
        if (!layer || layer.layout?.visibility === 'none') return [];
        const z = this.tr.zoom;
        if (z < (layer.minzoom ?? 0) || z >= (layer.maxzoom ?? 24)) return [];
        // Thin things get a little slack so they can be hit; areas must actually contain the point.
        const radius = layer.type === 'fill' || layer.type === 'fill-extrusion' ? 0 : layer.type === 'line' ? 5 : 8;
        const found = await this.queryFeatures(point, {sources: [layer.source], sourceLayers: layer['source-layer'] ? [layer['source-layer']] : undefined, filter: layer.filter, radius, geometry: true});
        return found.map(f => ({...f, layer}));
    }

    private async dispatchLayerEvents(kind: 'click' | 'mousemove', data: Record<string, unknown>) {
        const point = data.point as {x: number; y: number};
        const wanted = kind === 'click' ? ['click'] : ['mousemove', 'mouseenter', 'mouseleave'];
        const layers = [...new Set(this.layerListeners.filter(l => wanted.includes(l.type)).map(l => l.layer))];
        if (!layers.length || (kind === 'mousemove' && this.hoverBusy)) return;
        this.hoverBusy = kind === 'mousemove';
        try {
            for (const layer of layers) {
                const features = await this.layerFeatures(layer, point), hit = features.length > 0;
                const emit = (type: string) => { for (const l of this.layerListeners) if (l.type === type && l.layer === layer) l.fn({type, target: this, ...data, features}); };
                if (kind === 'click') { if (hit) emit('click'); continue; }
                const was = this.hoveredLayers.has(layer);
                if (hit && !was) { this.hoveredLayers.add(layer); emit('mouseenter'); }
                if (hit) emit('mousemove');
                if (!hit && was) { this.hoveredLayers.delete(layer); emit('mouseleave'); }
            }
        } finally { if (kind === 'mousemove') this.hoverBusy = false; }
    }
    once(type: string, fn: Listener) {
        const wrap: Listener = e => { this.off(type, wrap); fn(e); };
        return this.on(type, wrap);
    }
    /** The cursor shown over the map, e.g. 'pointer' while hovering something clickable; '' restores the default. */
    setCursor(cursor: string) { this.canvas.style.cursor = cursor; return this; }
    /** Dispatches an event to listeners. Public so controls and plugins can raise their own. */
    fire(type: string, data: Record<string, unknown> = {}) {
        const list = this.listeners[type];
        if (type === 'error' && !list?.length) console.error('[map-jr-gl]', data.error);
        if (list) for (const fn of [...list]) fn({type, target: this, ...data});
        if ((type === 'click' || type === 'mousemove') && this.layerListeners.length && data.point) this.dispatchLayerEvents(type, data).catch(error => this.fire('error', {error}));
    }

    // ---- camera ----
    getCenter() { return {lng: this.tr.lng, lat: this.tr.lat}; }
    getZoom() { return this.tr.zoom; }
    getBearing() { return this.tr.bearing; }
    getPitch() { return this.tr.pitch; }
    getMinZoom() { return this.tr.minZoom; }
    getMaxZoom() { return this.tr.maxZoom; }
    getContainer() { return this.container; }
    getCanvas() { return this.canvas; }
    loaded() { return this.isLoaded; }
    isMoving() { return this.moving; }
    project(lngLat: LngLatLike) { const [x, y] = this.tr.project(...toLngLat(lngLat)); return {x, y}; }
    unproject(point: {x: number; y: number} | [number, number]) {
        const [x, y] = Array.isArray(point) ? point : [point.x, point.y];
        const [lng, lat] = this.tr.unproject(x, y);
        return {lng, lat};
    }
    getBounds() {
        const {width: w, height: h} = this.tr, pts = [[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => this.tr.unproject(x, y));
        return {west: Math.min(...pts.map(p => p[0])), south: Math.min(...pts.map(p => p[1])), east: Math.max(...pts.map(p => p[0])), north: Math.max(...pts.map(p => p[1]))};
    }
    jumpTo(o: CameraInput) {
        // Applied locally as well, so reads immediately after a write are correct even when the engine is in a worker.
        const padding = o.padding === undefined ? undefined : paddingOf(o.padding);
        if (padding) this.tr.padding = padding;
        this.tr.set(o.center, o.zoom, o.bearing, o.pitch);
        this.post({type: 'jump', center: o.center && toLngLat(o.center), zoom: o.zoom, bearing: o.bearing, pitch: o.pitch, padding});
        return this;
    }
    easeTo(o: CameraInput & {duration?: number; around?: [number, number]}) {
        // Only plain camera values cross to the engine. Extra options written for MapLibre (such as an `easing`
        // function, which cannot be sent to a worker) are ignored rather than breaking the call.
        const {center, zoom, bearing, pitch, around} = o;
        this.post({type: 'ease', duration: o.duration ?? 500, center: center && toLngLat(center), zoom, bearing, pitch, around, padding: o.padding === undefined ? undefined : paddingOf(o.padding)});
        return this;
    }
    flyTo(o: CameraInput & {duration?: number}) { return this.easeTo({duration: 1200, ...o}); }
    /** Space at the edges covered by other things (a side panel, a header). The map centre moves to the middle of what is left. */
    setPadding(padding: PaddingInput) { return this.jumpTo({padding}); }
    getPadding() { const [top, right, bottom, left] = this.tr.padding; return {top, right, bottom, left}; }
    setCenter(center: LngLatLike) { return this.jumpTo({center}); }
    setZoom(zoom: number) { return this.jumpTo({zoom}); }
    setBearing(bearing: number) { return this.jumpTo({bearing}); }
    setPitch(pitch: number) { return this.jumpTo({pitch}); }
    resetNorth(o: {duration?: number} = {}) { return this.easeTo({bearing: 0, ...o}); }
    resetNorthPitch(o: {duration?: number} = {}) { return this.easeTo({bearing: 0, pitch: 0, ...o}); }
    panTo(center: LngLatLike, o: {duration?: number} = {}) { return this.easeTo({center, ...o}); }
    panBy(offset: [number, number], o: {duration?: number} = {}) {
        return this.easeTo({center: this.unproject([this.tr.cx + offset[0], this.tr.cy + offset[1]]), ...o});
    }
    zoomTo(zoom: number, o: {duration?: number} = {}) { return this.easeTo({zoom, ...o}); }
    rotateTo(bearing: number, o: {duration?: number} = {}) { return this.easeTo({bearing, ...o}); }
    snapToNorth(o: {duration?: number} = {}) { return Math.abs(this.tr.bearing) < 7 ? this.resetNorth(o) : this; }
    stop() { this.post({type: 'stop'}); return this; }

    /** The centre and zoom that fit `bounds` ([west, south, east, north] or [[west, south], [east, north]]) in view. */
    cameraForBounds(bounds: [number, number, number, number] | [[number, number], [number, number]], o: {padding?: number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>; maxZoom?: number} = {}) {
        const [w, s, e, n] = bounds.flat() as number[];
        const pad = typeof o.padding === 'number' ? {top: o.padding, right: o.padding, bottom: o.padding, left: o.padding} : {top: 0, right: 0, bottom: 0, left: 0, ...o.padding};
        const x0 = mercX(w), x1 = mercX(e), y0 = mercY(n), y1 = mercY(s);
        // The map's own padding already moves the centre; padding given here is on top of it.
        const [pt, pr, pb, pl] = this.tr.padding;
        const availW = Math.max(1, this.tr.width - pad.left - pad.right - pl - pr), availH = Math.max(1, this.tr.height - pad.top - pad.bottom - pt - pb);
        const zoom = Math.min(o.maxZoom ?? this.tr.maxZoom, Math.log2(Math.min(availW / Math.max(x1 - x0, 1e-12), availH / Math.max(y1 - y0, 1e-12)) / 512));
        // Shift the centre so the bounds sit in the middle of the unpadded area.
        const world = 512 * 2 ** zoom, cx = (x0 + x1) / 2 - (pad.left - pad.right) / 2 / world, cy = (y0 + y1) / 2 - (pad.top - pad.bottom) / 2 / world;
        return {center: {lng: cx * 360 - 180, lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * cy))) * 180 / Math.PI}, zoom, bearing: 0};
    }
    fitBounds(bounds: Parameters<Map['cameraForBounds']>[0], o: Parameters<Map['cameraForBounds']>[1] & {duration?: number} = {}) {
        return this.easeTo({...this.cameraForBounds(bounds, o), duration: o.duration ?? 800});
    }

    private limits() { this.post({type: 'limits', minZoom: this.tr.minZoom, maxZoom: this.tr.maxZoom, maxPitch: this.tr.maxPitch, minPitch: this.tr.minPitch, maxBounds: this.tr.maxBounds}); return this; }
    setMinZoom(z = 0) { this.tr.minZoom = z; return this.limits(); }
    setMaxZoom(z = 22) { this.tr.maxZoom = z; return this.limits(); }
    setMaxPitch(p = 60) { this.tr.maxPitch = Math.min(60, p); return this.limits(); }
    getMaxPitch() { return this.tr.maxPitch; }
    getMinPitch() { return this.tr.minPitch; }
    setMinPitch(p = 0) { this.tr.minPitch = Math.max(0, Math.min(p, this.tr.maxPitch)); return this.limits(); }
    /** Keeps the map centre inside a box (`[[west, south], [east, north]]`), or lifts the restriction with `null`. */
    setMaxBounds(bounds?: [LngLatLike, LngLatLike] | [number, number, number, number] | null) {
        const flat = bounds && (bounds as unknown[]).flat().map(v => typeof v === 'object' ? toLngLat(v as LngLatLike) : v).flat() as number[];
        this.tr.maxBounds = flat ? [flat[0], flat[1], flat[2], flat[3]] : null;
        return this.limits();
    }
    getMaxBounds() { const b = this.tr.maxBounds; return b && {getWest: () => b[0], getSouth: () => b[1], getEast: () => b[2], getNorth: () => b[3], toArray: () => [[b[0], b[1]], [b[2], b[3]]]}; }
    getPixelRatio() { return this.dpr; }
    getProjection() { return {type: 'mercator'}; }
    getRenderWorldCopies() { return true; }
    getRoll() { return 0; }
    /** With 3D terrain: the (exaggerated) height of the ground at the map centre in metres; otherwise 0. */
    getCenterElevation() { return this.tr.elevation; }
    getCameraTargetElevation() { return this.tr.elevation; }
    /** With 3D terrain: how far the ground at a position is above the ground at the map centre, in exaggerated metres (as in MapLibre); `null` without terrain. */
    queryTerrainElevation(lngLat: LngLatLike): number | null {
        const [lng, lat] = toLngLat(lngLat);
        return this.tr.heightAt ? this.tr.heightAt(mercX(lng), mercY(lat)) - this.tr.elevation : null;
    }
    isZooming() { return this.zooming; }
    isRotating() { return this.rotating; }
    isPitching() { return this.pitching; }
    /** Whether the tiles needed for the current view have loaded. (Tracked for the map as a whole, not per source.) */
    isSourceLoaded(id: string) {
        if (!this.rawStyle?.sources[id]) throw new Error(`There is no source with ID "${id}"`);
        return this.tilesLoaded;
    }
    /** Loads a source's tiles again, e.g. after the data behind its URL changed. */
    refreshTiles(sourceId: string) { this.post({type: 'refresh', source: sourceId}); return this; }
    getCanvasContainer() { return this.container; }
    isStyleLoaded() { return this.ready; }
    areTilesLoaded() { return this.tilesLoaded; }
    redraw() { this.triggerRepaint(); return this; }
    zoomIn() { return this.easeTo({zoom: this.tr.zoom + 1, duration: 300}); }
    zoomOut() { return this.easeTo({zoom: this.tr.zoom - 1, duration: 300}); }
    triggerRepaint() { this.post({type: 'repaint'}); }

    resize() {
        this.measure();
        this.post({type: 'resize', width: this.tr.width, height: this.tr.height, dpr: this.dpr});
        return this;
    }

    // ---- style ----
    private restyle(reload: boolean) {
        resolveStyle(this.rawStyle, fetch, this.styleBase).then(style => {
            if (Object.keys(this.globalState).length) style.state = {...style.state, ...this.globalState};
            this.style = style;
            this.post({type: 'style', style, reload});
            this.fire('styledata');
        }, err => this.fire('error', {error: err}));
    }
    /** Runs a change to the style JSON now, or as soon as the style has been fetched. */
    private editStyle(fn: (style: any) => void) {
        if (this.rawStyle) { fn(this.rawStyle); this.restyle(true); } else this.beforeStyle.push(() => fn(this.rawStyle));
        return this;
    }
    private layerIndex(style: any, id: string) {
        const i = style.layers.findIndex((l: any) => l.id === id);
        if (i < 0) throw new Error(`Layer "${id}" does not exist`);
        return i;
    }
    getStyle() { return this.rawStyle ? structuredClone(this.rawStyle) : undefined; }
    // ---- feature state ----
    private featureStates: Record<string, Record<string, Record<string, unknown>>> = {};
    private sendFeatureState(source: string) { this.post({type: 'featureState', source, states: this.featureStates[source] ?? {}}); return this; }
    /**
     * Merges `state` into a feature's state, which `feature-state` expressions in paint properties read (hover and
     * selection highlights). The feature needs an `id`. Tiles showing the source are rebuilt in the background.
     */
    setFeatureState(feature: {source: string; sourceLayer?: string; id: number | string}, state: Record<string, unknown>) {
        const states = this.featureStates[feature.source] ??= {}, key = `${feature.sourceLayer ?? ''}|${feature.id}`;
        states[key] = {...states[key], ...state};
        return this.sendFeatureState(feature.source);
    }
    getFeatureState(feature: {source: string; sourceLayer?: string; id: number | string}): Record<string, unknown> {
        return {...this.featureStates[feature.source]?.[`${feature.sourceLayer ?? ''}|${feature.id}`]};
    }
    /** Removes one key of a feature's state, a feature's whole state (no `key`), or all state of a source (no `id`). */
    removeFeatureState(target: {source: string; sourceLayer?: string; id?: number | string}, key?: string) {
        const states = this.featureStates[target.source];
        if (!states) return this;
        const prefix = `${target.sourceLayer ?? ''}|`;
        for (const k of Object.keys(states)) {
            if (target.id !== undefined ? k !== prefix + target.id : target.sourceLayer !== undefined && !k.startsWith(prefix)) continue;
            if (key !== undefined && target.id !== undefined) delete states[k][key]; else delete states[k];
        }
        return this.sendFeatureState(target.source);
    }

    /** The values `global-state` expressions read: the style's `state` defaults with anything set since. */
    getGlobalState(): Record<string, unknown> { return {...this.style?.state, ...this.globalState}; }
    /** Sets one global state value (`null` or `undefined` returns it to the style's default); layers that read it update. */
    setGlobalStateProperty(name: string, value: unknown) {
        if (value === null || value === undefined) delete this.globalState[name]; else this.globalState[name] = value;
        return this.editStyle(() => {});
    }
    /** Turns 3D terrain on (`{source, exaggeration}`, naming a raster-dem source) or off (`null`). */
    setTerrain(terrain: {source: string; exaggeration?: number} | null) {
        return this.editStyle(s => { if (terrain) s.terrain = terrain; else delete s.terrain; this.fire('terrain', {terrain}); });
    }
    getTerrain(): {source: string; exaggeration?: number} | null { return this.rawStyle?.terrain ?? null; }
    async setStyle(style: unknown) {
        this.styleBase = typeof style === 'string' ? new URL(style, location.href).href : location.href;
        this.rawStyle = typeof style === 'string' ? await (await fetch(style)).json() : structuredClone(style);
        this.restyle(true);
    }
    getLayer(id: string) { return this.rawStyle?.layers.find((l: any) => l.id === id); }
    getLayersOrder(): string[] { return this.rawStyle?.layers.map((l: any) => l.id) ?? []; }
    /** The source's specification. GeoJSON sources also get MapLibre's `setData(data)` to replace their contents. */
    getSource(id: string) {
        const spec = this.rawStyle?.sources[id];
        if (!spec || spec.type !== 'geojson') return spec;
        const clusters = async () => {
            const index = (await this.clusterIndex(id)).clusters;
            if (!index) throw new Error(`Source "${id}" has no clusters.`);
            return index;
        };
        return {
            ...spec, id, setData: (data: unknown) => this.setGeoJSON(id, data),
            // The cluster methods give promises, as in MapLibre. The page makes its own copy of the cluster index for them.
            getClusterExpansionZoom: async (clusterId: number) => (await clusters()).expansionZoom(clusterId),
            getClusterChildren: async (clusterId: number) => (await clusters()).children(clusterId),
            getClusterLeaves: async (clusterId: number, limit?: number, offset?: number) => (await clusters()).leaves(clusterId, limit, offset),
        };
    }
    private clusterIndexes = new globalThis.Map<string, {data: unknown; index: Promise<PreparedSource>}>();
    private clusterIndex(id: string): Promise<PreparedSource> {
        const spec = this.rawStyle.sources[id], known = this.clusterIndexes.get(id);
        if (known && known.data === spec.data) return known.index;
        const index = (async () => {
            const data = typeof spec.data === 'string' ? await (await fetch(new URL(spec.data, this.styleBase))).json() : spec.data;
            // Loaded only when a page asks about clusters, so that the page script stays small.
            const {prepareSource} = await import('./geojson.ts');
            return prepareSource(data, spec, spec.maxzoom ?? 18);
        })();
        this.clusterIndexes.set(id, {data: spec.data, index});
        return index;
    }
    private async setGeoJSON(id: string, data: unknown) {
        this.rawStyle.sources[id].data = data;
        if (typeof data === 'string') { const res = await fetch(new URL(data, this.styleBase)); data = await res.json(); }
        this.post({type: 'geojson', source: id, data});
    }
    getPaintProperty(layerId: string, name: string) { return this.getLayer(layerId)?.paint?.[name]; }
    getLayoutProperty(layerId: string, name: string) { return this.getLayer(layerId)?.layout?.[name]; }
    getFilter(layerId: string) { return this.getLayer(layerId)?.filter; }
    addSource(id: string, source: unknown) { return this.editStyle(s => { s.sources[id] = source; }); }
    removeSource(id: string) { return this.editStyle(s => { delete s.sources[id]; }); }
    addLayer(layer: {id: string}, beforeId?: string) {
        return this.editStyle(s => { s.layers.splice(beforeId ? this.layerIndex(s, beforeId) : s.layers.length, 0, layer); });
    }
    removeLayer(id: string) { return this.editStyle(s => { s.layers.splice(this.layerIndex(s, id), 1); }); }
    moveLayer(id: string, beforeId?: string) {
        return this.editStyle(s => {
            const [layer] = s.layers.splice(this.layerIndex(s, id), 1);
            s.layers.splice(beforeId ? this.layerIndex(s, beforeId) : s.layers.length, 0, layer);
        });
    }
    setLayerZoomRange(id: string, minzoom: number, maxzoom: number) { return this.editStyle(s => Object.assign(s.layers[this.layerIndex(s, id)], {minzoom, maxzoom})); }

    private setProp(group: 'paint' | 'layout', layerId: string, name: string, value: unknown) {
        const layer = this.rawStyle?.layers.find((l: any) => l.id === layerId);
        if (!layer) throw new Error(`Layer "${layerId}" does not exist`);
        (layer[group] ??= {})[name] = value;
        // The engine works out whether this needs tiles rebuilt (per-feature values are baked into their buffers).
        this.restyle(true);
        return this;
    }
    setPaintProperty(layerId: string, name: string, value: unknown) { return this.setProp('paint', layerId, name, value); }
    setLayoutProperty(layerId: string, name: string, value: unknown) { return this.setProp('layout', layerId, name, value); }
    setFilter(layerId: string, filter: unknown) {
        const layer = this.rawStyle?.layers.find((l: any) => l.id === layerId);
        if (!layer) throw new Error(`Layer "${layerId}" does not exist`);
        layer.filter = filter;
        this.restyle(true);
        return this;
    }

    // ---- controls ----
    private corners: Partial<Record<ControlPosition, HTMLElement>> = {};
    private controls = new globalThis.Map<Control, HTMLElement>();
    addControl(control: Control, position?: ControlPosition) {
        const pos = position ?? control.getDefaultPosition?.() ?? 'top-right';
        if (!document.getElementById('map-jr-control-css')) {
            document.head.appendChild(Object.assign(document.createElement('style'), {id: 'map-jr-control-css', textContent: CONTROL_CSS}));
        }
        let corner = this.corners[pos];
        if (!corner) {
            corner = this.corners[pos] = document.createElement('div');
            corner.className = cls('ctrl-' + pos);
            this.container.appendChild(corner);
            this.cleanup.push(() => corner!.remove());
        }
        const el = control.onAdd(this);
        adoptClasses(el); // a control written for MapLibre GL JS gets this library's styles
        this.controls.set(control, el);
        corner.appendChild(el);
        return this;
    }
    removeControl(control: Control) {
        if (this.controls.delete(control)) control.onRemove(this);
        return this;
    }
    hasControl(control: Control) { return this.controls.has(control); }

    // ---- fonts and images ----
    /** Loads more web fonts for labels after construction. See the `fonts` option. */
    addFonts(fonts: FontSource[]) { this.post({type: 'fonts', fonts}); return this; }

    /**
     * Makes an image available to `icon-image` under `name`. `source` may be an SVG document (rasterised at the
     * screen's pixel density, so it stays sharp), an image URL, or anything drawable such as an ImageBitmap or canvas.
     * `width`/`height` are the display size in CSS pixels; they default to the image's natural size.
     */
    async addImage(name: string, source: string | CanvasImageSource | ImageData | {width: number; height: number; data: Uint8Array | Uint8ClampedArray}, options: ImageOptions = {}) {
        let drawable: CanvasImageSource, width = options.width, height = options.height, sourceWidth = 0;
        if (typeof source === 'string') {
            const img = new Image();
            if (source.trimStart().startsWith('<')) {
                const vb = /viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(source);
                width ??= vb ? +vb[1] : 24; height ??= vb ? +vb[2] : 24;
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sizedSVG(source, width, height));
            } else { img.crossOrigin = 'anonymous'; img.src = source; }
            await img.decode();
            width ??= img.naturalWidth / (options.pixelRatio ?? 1); height ??= img.naturalHeight / (options.pixelRatio ?? 1);
            sourceWidth = img.naturalWidth;
            drawable = img;
        } else if ('data' in source) {
            // Raw pixels, as MapLibre accepts (ImageData or {width, height, data}): put them on a canvas to draw from.
            const canvas = document.createElement('canvas');
            canvas.width = sourceWidth = source.width; canvas.height = source.height;
            canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(source.data), source.width, source.height), 0, 0);
            width ??= source.width / (options.pixelRatio ?? 1); height ??= source.height / (options.pixelRatio ?? 1);
            drawable = canvas;
        } else {
            drawable = source;
            sourceWidth = (source as ImageBitmap).width as number;
            width ??= sourceWidth / (options.pixelRatio ?? 1); height ??= (source as ImageBitmap).height as number / (options.pixelRatio ?? 1);
        }
        const w = Math.ceil(width * this.dpr), h = Math.ceil(height * this.dpr), data = pixels(drawable, w, h);
        // Stretch ranges and the content box are given in the source image's pixels; the stored copy may be another size.
        const k = sourceWidth ? w / sourceWidth : 1, scale = (v?: number[]) => v?.map(n => n * k);
        this.imageNames.add(name);
        this.post({type: 'image', name, w, h, width, height, data, stretchX: options.stretchX?.map(r => scale(r) as [number, number]), stretchY: options.stretchY?.map(r => scale(r) as [number, number]),
            content: scale(options.content) as [number, number, number, number] | undefined, textFitWidth: options.textFitWidth, textFitHeight: options.textFitHeight}, [data.buffer]);
        return this;
    }
    removeImage(name: string) { this.imageNames.delete(name); this.post({type: 'removeImage', name}); return this; }
    /** Replaces an image added earlier; icons using it are redrawn. */
    updateImage(name: string, source: Parameters<Map['addImage']>[1], options: ImageOptions = {}) {
        if (!this.imageNames.has(name)) throw new Error(`There is no image with ID "${name}"`);
        return this.removeImage(name).addImage(name, source, options);
    }
    getSprite() { const s = this.rawStyle?.sprite; return typeof s === 'string' ? [{id: 'default', url: s}] : s ?? []; }
    setSprite(url: string | null) { return this.editStyle(s => { if (url) s.sprite = url; else delete s.sprite; }); }
    getGlyphs() { return this.rawStyle?.glyphs ?? null; }
    /** Stored with the style for compatibility. Text is drawn with web fonts, so glyph files are never fetched. */
    setGlyphs(url: string | null) { return this.editStyle(s => { if (url) s.glyphs = url; else delete s.glyphs; }); }
    getFontFaces() { return this.rawStyle?.['font-faces'] ?? {}; }
    setFontFaces(faces: Record<string, unknown> | null) { return this.editStyle(s => { if (faces) s['font-faces'] = faces; else delete s['font-faces']; }); }
    hasImage(name: string) { return this.imageNames.has(name); }
    listImages() { return [...this.imageNames]; }
    /** Fetches and decodes an image, in the shape MapLibre returns it. */
    async loadImage(url: string) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load image ${url}: ${res.status}`);
        return {data: await createImageBitmap(await res.blob())};
    }
    /**
     * Supplies images on demand. When a style asks for an `icon-image` nothing provides, the resolver is called with
     * its name and may call `addImage` (it can be async). This is how generated icons such as highway shields work:
     * encode what to draw in the name, and build the SVG for it here.
     */
    setMissingStyleImageResolver(resolver: ((id: string) => void | Promise<void>) | null) { this.imageResolver = resolver; return this; }

    // ---- queries ----
    private ask<T>(command: (id: number) => Command): Promise<T> {
        return new Promise((resolve, reject) => {
            const id = this.nextQuery++;
            this.pending.set(id, {resolve, reject});
            this.post(command(id));
        });
    }

    /**
     * Finds features at a location straight from the tile data. Unlike `queryRenderedFeatures`, nothing has to be
     * drawn: features need no style layer, and the location may be off screen (the tile is fetched if necessary).
     * `at` is a longitude/latitude, or a screen position as `{x, y}`.
     */
    queryFeatures(at: LngLatLike | {x: number; y: number}, options: Partial<FeatureQuery> = {}): Promise<QueriedFeature[]> {
        const [lng, lat] = 'x' in at ? this.tr.unproject(at.x, at.y) : toLngLat(at);
        return this.ask(id => ({type: 'query', id, lng, lat, radius: 3, ...options}));
    }

    /** Ground elevation in metres at a location, read from the style's elevation (raster-dem) source; null where there is no data. */
    queryElevation(at: LngLatLike | {x: number; y: number}, options: {source?: string; zoom?: number} = {}): Promise<number | null> {
        const [lng, lat] = 'x' in at ? this.tr.unproject(at.x, at.y) : toLngLat(at);
        return this.ask(id => ({type: 'elevation', id, lng, lat, ...options}));
    }

    // ---- markers ----
    addMarkerLayer(options: MarkerLayerOptions): MarkerLayer {
        const layer = new MarkerLayer(this, options);
        this.markerLayers.set(options.id, layer);
        this._syncMarkers(layer);
        return layer;
    }
    removeMarkerLayer(id: string) {
        this.markerLayers.delete(id);
        this.post({type: 'removeMarkers', id});
    }

    /** @internal Rasterises any new marker appearances and hands the layer to the engine. */
    async _syncMarkers(layer: MarkerLayer) {
        const o = layer.options, {svgs: resolved, variant} = resolveVariants(o);
        // An SVG drawn as an image cannot fetch anything itself, so pictures it references are embedded first.
        const svgs = await Promise.all(resolved.map(svg => this.embedImages(svg)));
        const w = Math.ceil(o.width * this.dpr), h = Math.ceil(o.height * this.dpr);
        const local = new Uint32Array(svgs.length), images: MarkerImage[] = [];
        await Promise.all(svgs.map(async (svg, i) => {
            const key = `${w}x${h}|${svg}`;
            let id = this.variantIds.get(key);
            if (id === undefined) {
                id = this.variantIds.size;
                this.variantIds.set(key, id);
                try {
                    images.push({variant: id, w, h, data: await rasterise(sizedSVG(svg, o.width, o.height), w, h)});
                } catch (err) {
                    this.fire('error', {error: new Error(`Marker layer "${o.id}": could not render SVG (${(err as Error).message})`)});
                }
            }
            local[i] = id;
        }));
        if (this.markerLayers.get(o.id) !== layer || layer.data !== o.data) return; // replaced while rasterising
        const merc = new Float64Array(o.data.length * 2);
        o.data.forEach((m, i) => { merc[i * 2] = mercX(m.lngLat[0]); merc[i * 2 + 1] = mercY(m.lngLat[1]); });
        const globalVariant = variant.map(v => local[v]);
        this.post({
            type: 'markers', id: o.id, width: o.width, height: o.height, offset: anchorOffset(o.anchor, o.width, o.height),
            collide: !!o.collide, minZoom: o.minZoom ?? -Infinity, maxZoom: o.maxZoom ?? Infinity, hideOverlaps: o.overlap === 'hide', merc, variant: globalVariant, images,
        }, [merc.buffer, globalVariant.buffer, ...images.map(i => i.data.buffer)]);
    }

    private embedded = new globalThis.Map<string, Promise<string>>();
    /** Replaces `<image href="https://...">` inside an SVG with the picture's data, fetched once per URL. */
    private async embedImages(svg: string): Promise<string> {
        const urls = [...new Set([...svg.matchAll(/<image\b[^>]*?\bhref\s*=\s*["'](https?:[^"']+|\/[^"']+)["']/g)].map(m => m[1]))];
        for (const url of urls) {
            let data = this.embedded.get(url);
            if (!data) {
                data = fetch(url.replace(/&#38;|&amp;/g, '&')).then(async res => {
                    if (!res.ok) throw new Error(`Marker image ${url}: HTTP ${res.status}`);
                    const blob = await res.blob();
                    return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
                });
                this.embedded.set(url, data);
            }
            svg = svg.split(url).join(await data.catch(error => { this.fire('error', {error}); return ''; }));
        }
        return svg;
    }

    /** Topmost marker under a screen point. Runs on the calling thread against the mirrored camera, so it is synchronous. */
    queryMarkers(point: {x: number; y: number}): {layer: MarkerLayer; index: number; marker: MarkerInput} | null {
        const layers = [...this.markerLayers.values()].reverse();
        for (const layer of layers) {
            const o = layer.options, [ox, oy] = anchorOffset(o.anchor, o.width, o.height);
            if (this.tr.zoom < (o.minZoom ?? -Infinity) || this.tr.zoom >= (o.maxZoom ?? Infinity)) continue;
            // Only markers whose position falls in the patch of map around the pointer can be under it; comparing raw
            // coordinates first keeps this cheap with very many markers.
            const reach = [[-o.width, -o.height], [o.width, -o.height], [-o.width, o.height], [o.width, o.height]].map(([dx, dy]) => this.tr.unproject(point.x + dx, point.y + dy));
            const w = Math.min(...reach.map(r => r[0])), e = Math.max(...reach.map(r => r[0])), s = Math.min(...reach.map(r => r[1])), n = Math.max(...reach.map(r => r[1]));
            const near = e - w < 180; // not when the view spans the antimeridian or most of the world
            // Layers that hide overlapping markers: the same first-come-first-served decision the renderer makes,
            // worked out only once something is actually under the pointer.
            let shown: Set<number> | null = null;
            const visible = (index: number) => {
                if (o.overlap !== 'hide') return true;
                if (!shown) {
                    shown = new Set();
                    const grid = new CollisionGrid();
                    for (let i = 0; i < layer.data.length; i++) {
                        const [x, y] = this.tr.project(...layer.data[i].lngLat), x0 = x + ox, y0 = y + oy, x1 = x0 + o.width, y1 = y0 + o.height;
                        if (x0 > this.tr.width || y0 > this.tr.height || x1 < 0 || y1 < 0 || grid.hits(x0, y0, x1, y1)) continue;
                        grid.insert(x0, y0, x1, y1);
                        shown.add(i);
                    }
                }
                return shown.has(index);
            };
            for (let i = layer.data.length - 1; i >= 0; i--) {
                const ll = layer.data[i].lngLat;
                if (near && (ll[0] < w || ll[0] > e || ll[1] < s || ll[1] > n)) continue;
                const [x, y] = this.tr.project(...ll);
                if (point.x >= x + ox && point.x <= x + ox + o.width && point.y >= y + oy && point.y <= y + oy + o.height && visible(i)) return {layer, index: i, marker: layer.data[i]};
            }
        }
        return null;
    }

    // ---- input ----
    private dragging = false;
    private awaitingInertia = false;
    private bindInput() {
        const el = this.canvas, pointers = new globalThis.Map<number, {x: number; y: number}>();
        const listen = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
            el.addEventListener(type, fn, opts);
            this.inputCleanup.push(() => el.removeEventListener(type, fn, opts));
        };
        const pos = (e: MouseEvent) => { const r = this.container.getBoundingClientRect(); return {x: e.clientX - r.left - this.container.clientLeft, y: e.clientY - r.top - this.container.clientTop}; };
        const mouseEvent = (type: string, e: MouseEvent, extra = {}) => {
            const point = pos(e);
            this.fire(type, {point, lngLat: this.unproject(point), originalEvent: e, ...extra});
        };
        let rotating = false, moved = 0, samples: {t: number; x: number; y: number}[] = [], pinch: {dist: number; angle: number} | null = null;
        // Wheel events do not say what produced them. As MapLibre does, tell mouse wheels from trackpads by their
        // deltas and timing, because the two need different handling to feel right.
        let wheelKind: 'wheel' | 'trackpad' | null = null, lastWheel = 0, held = 0, heldTimer: ReturnType<typeof setTimeout> | undefined;

        // Touch gestures, matching MapLibre's set: one-finger pan, pinch to zoom and (past a threshold) rotate,
        // two fingers moving vertically together to tilt, double-tap to zoom in, two-finger tap to zoom out, and
        // double-tap-then-drag to zoom with one hand.
        let gesture: {mode: 'undecided' | 'pinch' | 'pitch'; dist: number; angle: number; startAngle: number; rotating: boolean; mid: {x: number; y: number}; start: {x: number; y: number}[]; t0: number; travel: number} | null = null;
        let lastTap = {t: 0, x: 0, y: 0}, tapDrag: {x: number; y: number; zoomed: boolean} | null = null, suppressClick = false, lastPointerType = 'mouse';
        const twoFingers = () => { const [a, b] = [...pointers.values()]; return {a, b, dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}}; };

        listen('pointerdown', e => {
            try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events have no capturable pointer */ }
            const p = pos(e), now = performance.now();
            lastPointerType = e.pointerType;
            pointers.set(e.pointerId, p);
            rotating = e.button === 2 || e.ctrlKey;
            moved = 0; samples = []; pinch = null;
            this.post({type: 'stop'});
            if (pointers.size === 1) {
                suppressClick = false;
                // A second tap landing soon after and near the first starts a double-tap (or tap-and-drag zoom).
                tapDrag = e.pointerType === 'touch' && now - lastTap.t < 300 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30 ? {x: p.x, y: p.y, zoomed: false} : null;
            } else if (pointers.size === 2) {
                const f = twoFingers();
                tapDrag = null;
                gesture = {mode: 'undecided', dist: f.dist, angle: f.angle, startAngle: f.angle, rotating: false, mid: f.mid, start: [{...f.a}, {...f.b}], t0: now, travel: 0};
            }
        });
        listen('pointermove', e => {
            // A mouse button released where we could not see it (outside the window, over a native dialog) leaves a
            // pointer we still think is down. No buttons pressed means the drag is over.
            if (e.pointerType === 'mouse' && e.buttons === 0 && pointers.has(e.pointerId)) up(e);
            const p = pos(e), prev = pointers.get(e.pointerId);
            if (!prev) {
                const hit = this.queryMarkers(p), was = this.hovered;
                if (hit?.layer !== was?.layer || hit?.index !== was?.index) {
                    if (was) this.fire('markerleave', {...was, marker: was.layer.data[was.index]});
                    this.hovered = hit;
                    if (hit) this.fire('markerenter', hit);
                    el.style.cursor = hit ? 'pointer' : '';
                }
                mouseEvent('mousemove', e);
                return;
            }
            pointers.set(e.pointerId, p);
            const dx = p.x - prev.x, dy = p.y - prev.y;
            moved += Math.abs(dx) + Math.abs(dy);
            if (pointers.size === 2 && gesture) {
                const g = gesture, f = twoFingers();
                g.travel += Math.abs(dx) + Math.abs(dy);
                // Decide what the gesture is once both fingers have moved (events arrive one finger at a time).
                const moved2 = (k: 0 | 1) => Math.hypot((k ? f.b : f.a).x - g.start[k].x, (k ? f.b : f.a).y - g.start[k].y);
                if (g.mode === 'undecided' && g.travel > 8 && ((moved2(0) > 3 && moved2(1) > 3) || g.travel > 40)) {
                    // Tilt: both fingers travel vertically in the same direction while staying side by side.
                    const da = f.a.y - g.start[0].y, db = f.b.y - g.start[1].y, sideways = Math.abs(f.a.x - g.start[0].x) + Math.abs(f.b.x - g.start[1].x);
                    const together = Math.sign(da) === Math.sign(db) && Math.abs(da) > 4 && Math.abs(db) > 4 && sideways < Math.abs(da) + Math.abs(db);
                    g.mode = together && Math.abs(f.a.y - f.b.y) < 120 && Math.abs(f.dist - g.dist) < 12 ? 'pitch' : 'pinch';
                    if (!this.dragging) this.fire('dragstart');
                    this.dragging = true;
                }
                if (g.mode === 'pitch') this.post({type: 'rotate', delta: 0, pitch: -(f.mid.y - g.mid.y) * 0.5});
                else if (g.mode === 'pinch') {
                    this.post({type: 'pan', dx: f.mid.x - g.mid.x, dy: f.mid.y - g.mid.y, x: f.mid.x, y: f.mid.y});
                    if (f.dist > 0 && g.dist > 0) this.post({type: 'zoom', delta: Math.log2(f.dist / g.dist), x: f.mid.x, y: f.mid.y});
                    let turn = f.angle - g.angle;
                    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
                    if (!g.rotating) {
                        // Ignore small twists, which every pinch has: rotation starts once the fingers have swept about 25px of arc.
                        let total = f.angle - g.startAngle;
                        total = Math.atan2(Math.sin(total), Math.cos(total));
                        g.rotating = Math.abs(total) * f.dist / 2 > 25;
                    } else this.post({type: 'rotate', delta: -turn * 180 / Math.PI});
                }
                // Until the gesture is decided, keep measuring from where it began so no movement is lost.
                if (g.mode !== 'undecided') { g.dist = f.dist; g.angle = f.angle; g.mid = f.mid; }
            } else if (tapDrag && pointers.size === 1) {
                // Second tap held and dragged: down zooms in, up zooms out, around where the taps landed.
                if (moved > 6) { tapDrag.zoomed = true; this.post({type: 'zoom', delta: dy * 0.01, x: tapDrag.x, y: tapDrag.y}); }
            } else if (rotating) this.post({type: 'rotate', delta: -dx * 0.4, pitch: -dy * 0.5}); // right- or ctrl-drag: turn and tilt
            else if (moved > 3 && pointers.size === 1) {
                if (!this.dragging) this.fire('dragstart');
                this.dragging = true;
                this.post({type: 'pan', dx, dy, x: p.x, y: p.y});
                samples.push({t: performance.now(), x: p.x, y: p.y});
                while (samples.length > 2 && samples[0].t < performance.now() - 160) samples.shift();
            }
        });
        const up = (e: PointerEvent) => {
            if (!pointers.delete(e.pointerId)) return;
            pinch = null;
            const now = performance.now();
            if (gesture) {
                // Two fingers down and up again quickly, without moving: zoom out.
                if (gesture.mode === 'undecided' && now - gesture.t0 < 300 && gesture.travel < 12) this.easeTo({zoom: this.tr.zoom - 1, around: [gesture.mid.x, gesture.mid.y], duration: 300});
                gesture = null;
                suppressClick = true; // the finger still down must not pan-fling or click when it lifts
                samples = [];
            }
            if (pointers.size) return;
            const wasDragging = this.dragging;
            this.dragging = false;
            if (tapDrag) {
                if (!tapDrag.zoomed) this.easeTo({zoom: this.tr.zoom + 1, around: [tapDrag.x, tapDrag.y], duration: 300});
                tapDrag = null;
                lastTap.t = 0;
                if (wasDragging) { this.moving = false; this.fire('moveend'); }
                return;
            }
            // Inertia from the last 60ms of movement; a pointer that stopped before release gives none.
            const last = samples[samples.length - 1];
            const first = samples.find(s => now - s.t <= 60) ?? last;
            if (wasDragging && last && first !== last && now - last.t < 60 && (last.x !== first.x || last.y !== first.y)) {
                this.awaitingInertia = true;
                this.post({type: 'fling', dx: last.x - first.x, dy: last.y - first.y, ms: now - first.t});
            } else if (wasDragging) { this.moving = false; this.fire('moveend'); }
            if (moved <= 3 && e.type === 'pointerup' && e.button === 0 && !suppressClick) {
                const at = pos(e), hit = this.queryMarkers(at);
                if (e.pointerType === 'touch') lastTap = {t: now, x: at.x, y: at.y};
                if (hit) mouseEvent('markerclick', e, hit);
                mouseEvent('click', e, {marker: hit});
            }
        };
        listen('pointerup', up);
        listen('pointercancel', up);
        listen('lostpointercapture', up);
        const blur = () => { for (const id of [...pointers.keys()]) up({pointerId: id, type: 'blur'} as PointerEvent); };
        window.addEventListener('blur', blur);
        this.inputCleanup.push(() => window.removeEventListener('blur', blur));
        listen('wheel', e => {
            e.preventDefault();
            const p = pos(e), now = performance.now(), gap = now - lastWheel;
            let value = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
            lastWheel = now;
            const send = (v: number) => this.post({type: 'wheel', delta: -v, x: p.x, y: p.y, kind: wheelKind!});
            if (value !== 0 && value % 4.000244140625 === 0) wheelKind = 'wheel';
            else if (value !== 0 && Math.abs(value) < 4) wheelKind = 'trackpad';
            else if (gap > 400) {
                // First event after a pause and ambiguous: wait a moment to see whether more follow quickly.
                wheelKind = null;
                held = value;
                heldTimer = setTimeout(() => { wheelKind = 'wheel'; heldTimer = undefined; send(held); }, 40);
                return;
            } else if (!wheelKind) {
                wheelKind = Math.abs(gap * value) < 200 ? 'trackpad' : 'wheel';
                if (heldTimer) { clearTimeout(heldTimer); heldTimer = undefined; value += held; }
            }
            if (e.shiftKey) value /= 4;
            if (wheelKind && value) send(value);
        }, {passive: false});
        listen('dblclick', e => { if (lastPointerType === 'touch') return; /* touch double-taps are handled above, uniformly across browsers */ const p = pos(e); this.easeTo({zoom: this.tr.zoom + (e.shiftKey ? -1 : 1), around: [p.x, p.y], duration: 300}); });
        listen('contextmenu', e => e.preventDefault());
        listen('keydown', e => {
            const step = 100, k = e.key;
            if (k === '+' || k === '=') this.zoomIn();
            else if (k === '-') this.zoomOut();
            else if (k.startsWith('Arrow')) {
                e.preventDefault();
                const c = this.unproject({x: this.tr.cx + (k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0), y: this.tr.cy + (k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0)});
                this.easeTo({center: c, duration: 200});
            }
        });
    }

    /** Attribution strings (as provided, possibly HTML) of the sources in the current style. */
    getAttributions(): string[] {
        return [...new Set(Object.values(this.style?.sources ?? {}).map(s => s.attribution).filter((a): a is string => !!a))];
    }

    remove() {
        this.removed = true;
        for (const c of [...this.controls.keys()]) this.removeControl(c);
        for (const fn of this.inputCleanup) fn();
        this.tilePool?.release();
        this.observer?.disconnect();
        for (const fn of this.cleanup) fn();
        for (const w of this.workers) w.terminate();
        this.canvas.remove();
        this.listeners = {};
    }
}

/** SVG string -> premultiplied RGBA pixels, via an <img>, which is the one SVG rasterisation path every browser supports. */
async function rasterise(svg: string, w: number, h: number): Promise<Uint8Array> {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    return pixels(img, w, h);
}

/** Padding as MapLibre takes it: one number for all sides, or any of the four sides. */
export type PaddingInput = number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
type CameraInput = Omit<CameraOptions, 'padding'> & {padding?: PaddingInput};
function paddingOf(p: PaddingInput): [number, number, number, number] {
    return typeof p === 'number' ? [p, p, p, p] : [p.top ?? 0, p.right ?? 0, p.bottom ?? 0, p.left ?? 0];
}

/** Options for `addImage`, as in MapLibre, plus an explicit size in CSS pixels. */
export interface ImageOptions {
    width?: number; height?: number;
    /** How many image pixels make one CSS pixel (2 for a "@2x" image). */
    pixelRatio?: number;
    /** For icons fitted around text: the ranges that may stretch and the box the text sits in, in image pixels. */
    stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number];
    textFitWidth?: 'stretchOrShrink' | 'stretchOnly' | 'proportional'; textFitHeight?: 'stretchOrShrink' | 'stretchOnly' | 'proportional';
}

function pixels(source: CanvasImageSource, w: number, h: number): Uint8Array {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
    ctx.drawImage(source, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data, out = new Uint8Array(px.length);
    for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3] / 255;
        out[i] = px[i] * a; out[i + 1] = px[i + 1] * a; out[i + 2] = px[i + 2] * a; out[i + 3] = px[i + 3];
    }
    return out;
}
