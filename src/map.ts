import {Transform, mercX, mercY, toLngLat, type LngLatLike} from './geo.ts';
import {resolveStyle, type ResolvedStyle} from './style.ts';
import {Engine, type CameraOptions, type Command, type EngineEvent, type FeatureQuery, type FontSource, type MarkerImage} from './engine.ts';
import type {QueriedFeature} from './query.ts';
import {LocalBackend, PortBackend, type TileBackend} from './tiles.ts';
import {anchorOffset, resolveVariants, sizedSVG, type MarkerInput, type MarkerLayerOptions} from './markers.ts';
import {DEFAULT_FONT} from './text.ts';
import {CONTROL_CSS, type Control, type ControlPosition} from './controls.ts';

declare const __WORKER_SRC__: string;

export interface MapOptions extends CameraOptions {
    container: HTMLElement | string;
    style: unknown;
    /**
     * Where the engine (camera, placement, drawing) runs. 'worker' keeps the map smooth while the page is busy;
     * 'main' renders on the page's own thread. 'auto' picks 'worker' when the browser supports it.
     */
    renderer?: 'auto' | 'worker' | 'main';
    /** URL of the worker script. Defaults to a copy embedded in the bundle, loaded through a blob URL. */
    workerUrl?: string;
    tileWorkers?: number;
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
    private pending = new globalThis.Map<number, {resolve(v: any): void; reject(e: Error): void}>();
    private nextQuery = 1;
    /** Which thread the engine ended up on. */
    renderer: 'worker' | 'main' = 'main';

    constructor(private options: MapOptions) {
        const c = typeof options.container === 'string' ? document.getElementById(options.container) : options.container;
        if (!c) throw new Error('Map container not found');
        this.container = c;
        if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
        this.canvas = document.createElement('canvas');
        // Centred with an explicit pixel size rather than stretched to fit. With worker rendering the new frame arrives
        // a moment after the container resizes; until then the old frame stays put and undistorted instead of wobbling.
        this.canvas.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);touch-action:none;outline:none';
        this.canvas.tabIndex = 0;
        // Server-rendered markup stays visible on top until the canvas has drawn the same view.
        c.insertBefore(this.canvas, c.firstChild);
        this.tr.minZoom = options.minZoom ?? 0;
        this.tr.maxZoom = options.maxZoom ?? 22;
        this.measure();
        this.canvas.style.width = this.tr.width + 'px';
        this.canvas.style.height = this.tr.height + 'px';
        this.tr.maxPitch = options.maxPitch ?? 60;
        this.tr.set(options.center ?? [0, 0], options.zoom ?? 0, options.bearing ?? 0, options.pitch ?? 0);
        this.start().catch(err => this.fire('error', {error: err}));
    }

    private measure() {
        const r = this.container.getBoundingClientRect();
        this.tr.width = r.width; this.tr.height = r.height;
        this.dpr = Math.min(globalThis.devicePixelRatio || 1, 3);
    }

    private async start() {
        const o = this.options;
        this.rawStyle = typeof o.style === 'string' ? await (await fetch(o.style)).json() : o.style;
        this.styleBase = typeof o.style === 'string' ? new URL(o.style, location.href).href : location.href;
        this.style = await resolveStyle(this.rawStyle, fetch, this.styleBase);
        if (this.style.unsupported.length) console.warn('[tessera] Skipping unsupported layer types: ' + this.style.unsupported.join(', '));
        const tr = this.tr;
        const engineOptions = {
            style: this.style, width: tr.width, height: tr.height, dpr: this.dpr, fontFamily: o.fontFamily ?? DEFAULT_FONT, fonts: o.fonts,
            center: [tr.lng, tr.lat] as [number, number], zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch,
        };

        let workerUrl = o.workerUrl, blobUrl: string | undefined;
        const spawn = () => {
            if (!workerUrl) workerUrl = blobUrl = URL.createObjectURL(new Blob([__WORKER_SRC__], {type: 'text/javascript'}));
            const w = new Worker(workerUrl);
            this.workers.push(w);
            return w;
        };
        const tileWorkerCount = o.tileWorkers ?? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
        let ports: MessagePort[] = [];
        try {
            for (let i = 0; i < tileWorkerCount; i++) {
                const ch = new MessageChannel();
                spawn().postMessage({role: 'tiles', port: ch.port1}, [ch.port1]);
                ports.push(ch.port2);
            }
        } catch {
            ports = []; // e.g. a Content-Security-Policy that forbids blob workers: parse tiles on this thread instead
        }

        const wantWorker = o.renderer === 'worker' || (o.renderer ?? 'auto') === 'auto';
        if (wantWorker && ports.length && 'transferControlToOffscreen' in this.canvas) {
            const off = this.canvas.transferControlToOffscreen(), w = spawn();
            w.onmessage = e => {
                if (e.data.type !== 'fatal') return this.onEngineEvent(e.data);
                // The worker could not create a WebGL2 context. A transferred canvas cannot be taken back, so swap in a new one.
                console.warn('[tessera] Worker rendering unavailable, using the main thread: ' + e.data.message);
                const fresh = this.canvas.cloneNode() as HTMLCanvasElement;
                this.canvas.replaceWith(fresh);
                for (const fn of this.cleanup.splice(0)) fn();
                this.canvas = fresh;
                this.renderer = 'main';
                try {
                    const engine = new Engine(fresh, {...engineOptions, center: [this.tr.lng, this.tr.lat], zoom: this.tr.zoom, bearing: this.tr.bearing}, [new LocalBackend()], ev => this.onEngineEvent(ev));
                    this.send = c => engine.command(c);
                    for (const layer of this.markerLayers.values()) { this.variantIds.clear(); this._syncMarkers(layer); }
                    if (o.interactive !== false) this.bindInput();
                    this.addAttribution();
                } catch (err) { this.fire('error', {error: err}); }
            };
            w.postMessage({role: 'engine', canvas: off, options: engineOptions, ports}, [off, ...ports]);
            this.send = (c, transfer) => w.postMessage(c, transfer ?? []);
            this.renderer = 'worker';
        } else {
            const backends: TileBackend[] = ports.length ? ports.map(p => new PortBackend(p)) : [new LocalBackend()];
            const engine = new Engine(this.canvas, engineOptions, backends, e => this.onEngineEvent(e));
            this.send = c => engine.command(c);
        }
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        this.ready = true;
        for (const [c, t] of this.queue) this.send(c, t);
        this.queue = [];
        this.send({type: 'repaint'});

        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(this.container);
        if (o.interactive !== false) this.bindInput();
        this.addAttribution();
    }

    private post(c: Command, transfer?: Transferable[]) {
        if (this.ready) this.send(c, transfer); else this.queue.push([c, transfer]);
    }

    private onEngineEvent(e: EngineEvent) {
        if (e.type === 'camera') {
            const zoomed = e.zoom !== this.tr.zoom;
            const turned = e.bearing !== this.tr.bearing, tilted = e.pitch !== this.tr.pitch;
            Object.assign(this.tr, {lng: e.lng, lat: e.lat, zoom: e.zoom, bearing: e.bearing, pitch: e.pitch});
            if (!this.moving) this.fire('movestart');
            this.moving = true;
            this.fire('move');
            if (zoomed) this.fire('zoom');
            if (turned) this.fire('rotate');
            if (tilted) this.fire('pitch');
            if (!e.moving && !this.dragging) { this.moving = false; this.fire('moveend'); }
        } else if (e.type === 'idle') {
            if (!this.isLoaded) {
                this.isLoaded = true;
                this.container.querySelector('[data-tessera-ssr]')?.remove();
                this.fire('load');
            }
            this.fire('idle');
        } else if (e.type === 'resized') {
            this.canvas.style.width = e.width + 'px';
            this.canvas.style.height = e.height + 'px';
        } else if (e.type === 'result') {
            const p = this.pending.get(e.id);
            this.pending.delete(e.id);
            if (e.error) p?.reject(new Error(e.error)); else p?.resolve(e.value);
        } else if (e.type === 'imagemissing') this.fire('styleimagemissing', {id: e.name});
        else if (e.type === 'error') this.fire('error', {error: new Error(e.message)});
    }

    // ---- events ----
    on(type: string, fn: Listener) { (this.listeners[type] ??= []).push(fn); return this; }
    off(type: string, fn: Listener) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); return this; }
    once(type: string, fn: Listener) {
        const wrap: Listener = e => { this.off(type, wrap); fn(e); };
        return this.on(type, wrap);
    }
    /** Dispatches an event to listeners. Public so controls and plugins can raise their own. */
    fire(type: string, data: Record<string, unknown> = {}) {
        const list = this.listeners[type];
        if (type === 'error' && !list?.length) console.error('[tessera]', data.error);
        if (list) for (const fn of [...list]) fn({type, target: this, ...data});
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
    jumpTo(o: CameraOptions) {
        // Applied locally as well, so reads immediately after a write are correct even when the engine is in a worker.
        this.tr.set(o.center, o.zoom, o.bearing, o.pitch);
        this.post({type: 'jump', ...o});
        return this;
    }
    easeTo(o: CameraOptions & {duration?: number; around?: [number, number]}) {
        this.post({type: 'ease', duration: o.duration ?? 500, ...o});
        return this;
    }
    flyTo(o: CameraOptions & {duration?: number}) { return this.easeTo({duration: 1200, ...o}); }
    setCenter(center: LngLatLike) { return this.jumpTo({center}); }
    setZoom(zoom: number) { return this.jumpTo({zoom}); }
    setBearing(bearing: number) { return this.jumpTo({bearing}); }
    setPitch(pitch: number) { return this.jumpTo({pitch}); }
    resetNorth(o: {duration?: number} = {}) { return this.easeTo({bearing: 0, ...o}); }
    resetNorthPitch(o: {duration?: number} = {}) { return this.easeTo({bearing: 0, pitch: 0, ...o}); }
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
            this.style = style;
            this.post({type: 'style', style, reload});
        }, err => this.fire('error', {error: err}));
    }
    private setProp(group: 'paint' | 'layout', layerId: string, name: string, value: unknown) {
        const layer = this.rawStyle?.layers.find((l: any) => l.id === layerId);
        if (!layer) throw new Error(`Layer "${layerId}" does not exist`);
        (layer[group] ??= {})[name] = value;
        // Values are baked into tile buffers when data-driven, so tiles are rebuilt; cheap for the handful on screen.
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
        if (!document.getElementById('tessera-control-css')) {
            document.head.appendChild(Object.assign(document.createElement('style'), {id: 'tessera-control-css', textContent: CONTROL_CSS}));
        }
        let corner = this.corners[pos];
        if (!corner) {
            corner = this.corners[pos] = document.createElement('div');
            corner.className = 'maplibregl-ctrl-' + pos;
            this.container.appendChild(corner);
            this.cleanup.push(() => corner!.remove());
        }
        const el = control.onAdd(this);
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
    async addImage(name: string, source: string | CanvasImageSource, size: {width?: number; height?: number} = {}) {
        let drawable: CanvasImageSource, width = size.width, height = size.height;
        if (typeof source === 'string') {
            const img = new Image();
            if (source.trimStart().startsWith('<')) {
                const vb = /viewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(source);
                width ??= vb ? +vb[1] : 24; height ??= vb ? +vb[2] : 24;
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sizedSVG(source, width, height));
            } else { img.crossOrigin = 'anonymous'; img.src = source; }
            await img.decode();
            width ??= img.naturalWidth; height ??= img.naturalHeight;
            drawable = img;
        } else {
            drawable = source;
            width ??= (source as ImageBitmap).width as number; height ??= (source as ImageBitmap).height as number;
        }
        const w = Math.ceil(width * this.dpr), h = Math.ceil(height * this.dpr), data = pixels(drawable, w, h);
        this.post({type: 'image', name, w, h, width, height, data}, [data.buffer]);
        return this;
    }
    removeImage(name: string) { this.post({type: 'removeImage', name}); return this; }

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
        const o = layer.options, {svgs, variant} = resolveVariants(o);
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
            collide: !!o.collide, merc, variant: globalVariant, images,
        }, [merc.buffer, globalVariant.buffer, ...images.map(i => i.data.buffer)]);
    }

    /** Topmost marker under a screen point. Runs on the calling thread against the mirrored camera, so it is synchronous. */
    queryMarkers(point: {x: number; y: number}): {layer: MarkerLayer; index: number; marker: MarkerInput} | null {
        const layers = [...this.markerLayers.values()].reverse();
        for (const layer of layers) {
            const o = layer.options, [ox, oy] = anchorOffset(o.anchor, o.width, o.height);
            for (let i = layer.data.length - 1; i >= 0; i--) {
                const [x, y] = this.tr.project(...layer.data[i].lngLat);
                if (point.x >= x + ox && point.x <= x + ox + o.width && point.y >= y + oy && point.y <= y + oy + o.height) return {layer, index: i, marker: layer.data[i]};
            }
        }
        return null;
    }

    // ---- input ----
    private dragging = false;
    private bindInput() {
        const el = this.canvas, pointers = new globalThis.Map<number, {x: number; y: number}>();
        const listen = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
            el.addEventListener(type, fn, opts);
            this.cleanup.push(() => el.removeEventListener(type, fn, opts));
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

        listen('pointerdown', e => {
            el.setPointerCapture(e.pointerId);
            pointers.set(e.pointerId, pos(e));
            rotating = e.button === 2 || e.ctrlKey;
            moved = 0; samples = []; pinch = null;
            this.post({type: 'stop'});
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
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), angle = Math.atan2(b.y - a.y, b.x - a.x);
                const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
                if (pinch) {
                    this.post({type: 'zoom', delta: Math.log2(dist / pinch.dist), x: cx, y: cy});
                    this.post({type: 'rotate', delta: -(angle - pinch.angle) * 180 / Math.PI});
                    this.post({type: 'pan', dx: dx / 2, dy: dy / 2});
                }
                pinch = {dist, angle};
            } else if (rotating) this.post({type: 'rotate', delta: -dx * 0.4, pitch: -dy * 0.5}); // right- or ctrl-drag: turn and tilt
            else if (moved > 3) {
                this.dragging = true;
                this.post({type: 'pan', dx, dy});
                samples.push({t: performance.now(), x: p.x, y: p.y});
                while (samples.length > 2 && samples[0].t < performance.now() - 160) samples.shift();
            }
        });
        const up = (e: PointerEvent) => {
            if (!pointers.delete(e.pointerId)) return;
            pinch = null;
            if (pointers.size) return;
            const wasDragging = this.dragging;
            this.dragging = false;
            // Inertia from the last 60ms of movement; a pointer that stopped before release gives none.
            const now = performance.now(), last = samples[samples.length - 1];
            const first = samples.find(s => now - s.t <= 60) ?? last;
            if (wasDragging && last && first !== last && now - last.t < 60) {
                this.post({type: 'fling', dx: last.x - first.x, dy: last.y - first.y, ms: now - first.t});
            } else if (wasDragging) { this.moving = false; this.fire('moveend'); }
            if (moved <= 3 && e.type === 'pointerup' && e.button === 0) {
                const hit = this.queryMarkers(pos(e));
                if (hit) mouseEvent('markerclick', e, hit);
                mouseEvent('click', e, {marker: hit});
            }
        };
        listen('pointerup', up);
        listen('pointercancel', up);
        listen('lostpointercapture', up);
        const blur = () => { for (const id of [...pointers.keys()]) up({pointerId: id, type: 'blur'} as PointerEvent); };
        window.addEventListener('blur', blur);
        this.cleanup.push(() => window.removeEventListener('blur', blur));
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
        listen('dblclick', e => { const p = pos(e); this.easeTo({zoom: this.tr.zoom + (e.shiftKey ? -1 : 1), around: [p.x, p.y], duration: 300}); });
        listen('contextmenu', e => e.preventDefault());
        listen('keydown', e => {
            const step = 100, k = e.key;
            if (k === '+' || k === '=') this.zoomIn();
            else if (k === '-') this.zoomOut();
            else if (k.startsWith('Arrow')) {
                e.preventDefault();
                const c = this.unproject({x: this.tr.width / 2 + (k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0), y: this.tr.height / 2 + (k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0)});
                this.easeTo({center: c, duration: 200});
            }
        });
    }

    private addAttribution() {
        const html = [...new Set(Object.values(this.style.sources).map(s => s.attribution).filter(Boolean))].join(' | ');
        if (!html) return;
        const div = document.createElement('div');
        div.className = 'maplibregl-ctrl-attrib';
        div.style.cssText = 'position:absolute;right:0;bottom:0;z-index:2;padding:2px 6px;font:11px/1.4 system-ui,sans-serif;background:rgba(255,255,255,.7);color:#333';
        // Attribution arrives as HTML from tile providers. Keep its text and links, and nothing else.
        const copy = (from: Node, to: Node) => {
            for (const node of from.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) to.appendChild(document.createTextNode(node.textContent ?? ''));
                else if (node instanceof Element) {
                    const href = node.tagName === 'A' ? node.getAttribute('href') : null;
                    if (href && /^https?:\/\//i.test(href)) {
                        const a = Object.assign(document.createElement('a'), {href, target: '_blank', rel: 'noopener noreferrer'});
                        a.style.color = 'inherit';
                        copy(node, to.appendChild(a));
                    } else copy(node, to);
                }
            }
        };
        copy(new DOMParser().parseFromString(html, 'text/html').body, div);
        this.container.appendChild(div);
        this.cleanup.push(() => div.remove());
    }

    remove() {
        for (const c of [...this.controls.keys()]) this.removeControl(c);
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
