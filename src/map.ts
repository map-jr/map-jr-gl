import {fetchWith, httpError, withTimeout, type RequestAnswer} from './requests.ts';
import {protocolListeners, protocols, toBytes} from './protocols.ts';
import {LngLat, LngLatBounds, type LngLatBoundsInput} from './lnglat.ts';
import type {FilterSpecification} from './compat-types.ts';
import {MAX_PITCH, Transform, bezier, fitBox, addTurnSample, turnInertia, globeStops, groundHeight, inertiaSpan, heightsChanged, latFromMerc, lngFromMerc, mercX, mercY, sides, toLngLat, type LngLatLike} from './geo.ts';
import type {PreparedSource} from './geojson.ts';
import {DEFAULT_FONT, absolute, derefLayers, keep, kept, resolveStyle, type ResolvedStyle} from './resolve.ts';
import {layerRules} from './rules.ts';
import type {CameraOptions, Command, EngineEvent, FontSource} from './engine.ts';
import type {QueriedFeature, QuerySet} from './query.ts';
import type {ProjectionSpecification, ResourceType} from './compat-types.ts';
import type {TileBackend} from './tiles.ts';
import type {GeoJSONGeometry} from './host.ts';
import {acquireTileWorkers, defaults as loadDefaults, partUrls, partsComing, prefetchParts, startWorker, type LoadOptions} from './loader.ts';
import {fillTemplate, sizedSVG, svgSize, templateSlots, VARIANT} from './markers.ts';
import {AttributionControl, CONTROL_CSS, adoptClasses, cls, type Control, type ControlPosition} from './controls.ts';
// The warnings of the engine workers, each once on the page, as each thread warns once (expr.ts, #1141).
// The layers with `ref` of a style take the keys of the layer that they name, after `transformStyle` as in MapLibre GL JS,
// and not only when the style is resolved: a later `setLayoutProperty` of such a layer changes its own layout (#1814).
const deref = (style: any) => { if (Array.isArray(style?.layers)) style.layers = derefLayers(style.layers); return style; };
const pageWarned = new Set<string>();
const pageWarn = (msg: string) => {
    if (pageWarned.size > 200 || pageWarned.has(msg)) return;
    pageWarned.add(msg);
    console.warn('[map-jr-gl] ' + (pageWarned.size > 200 ? 'The workers sent 200 different warnings. Later ones are not shown.' : msg));
};

/** True in the development build (`dist/*.dev.js`). Code behind it is not in the production build. */
declare const __DEV__: boolean;


/** Logs an error with the prefix `[map-jr-gl]`, unless its message already starts with it. */
export const logError = (error: unknown) => /^\[map-jr-gl\]/.test((error as Error)?.message) ? console.error(error) : console.error('[map-jr-gl]', error);

export interface MapOptions extends CameraOptions, LoadOptions {
    container: HTMLElement | string;
    /** The style: an object or a URL. Leave it out to give the style later with `setStyle`. */
    style?: unknown;
    /** The area that the map shows at the start (it comes before `center` and `zoom`), and options for the fit, such as `padding`. */
    bounds?: LngLatBoundsInput;
    /** The padding of the map at the start, in place for the first fit of `bounds`. Only the main API sets it. */
    startPadding?: PaddingInput;
    fitBoundsOptions?: {padding?: number | Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>; maxZoom?: number};
    /** Keeps the camera in the fragment of the URL (`#zoom/lat/lng`), so that a link shows the same view. A string gives the camera a name in the fragment. */
    hash?: boolean | string;
    /** The number of canvas pixels for each CSS pixel, as in MapLibre GL JS. By default the map follows `devicePixelRatio`, up to 3. */
    pixelRatio?: number;
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
    /** Changes a request before the library makes it, as in MapLibre: a new URL, headers or credentials. */
    transformRequest?: RequestTransform | null;
    /** Each kind of interaction can be off from the start, as in MapLibre. */
    dragPan?: boolean; scrollZoom?: boolean; doubleClickZoom?: boolean; dragRotate?: boolean; touchZoomRotate?: boolean; touchPitch?: boolean; keyboard?: boolean; boxZoom?: boolean;
    minZoom?: number;
    maxZoom?: number;
    /** Largest camera tilt allowed, in degrees. The default is 60, and the limit is 180. Above 90 the camera looks up, and it sees the sky only when the map center has a height (`setCenterElevation`) that puts the camera above the ground. */
    maxPitch?: number;
    /** Whether copies of the world are drawn beside it, as in MapLibre GL JS (see `setRenderWorldCopies`). The default is `true`. */
    renderWorldCopies?: boolean;
    /** Data credits are shown by default; pass false to add your own, or options for the built-in control. */
    attributionControl?: false | {compact?: boolean; customAttribution?: string | string[]};
    /** Multisample antialiasing for the whole canvas. Smoother polygon edges, at a real cost in fill rate. */
    antialias?: boolean;
    /**
     * The nonce of a Content Security Policy with `style-src 'nonce-…'`. The map sets it on the `<style>` element of
     * its style sheet, which it uses where the browser cannot adopt a constructed style sheet.
     */
    nonce?: string;
}

/**
 * One kind of interaction with the map, as in MapLibre: `map.dragPan.disable()`, `map.scrollZoom.isEnabled()`.
 * A plugin that draws or edits on the map uses these to stop the map from moving.
 */
export class InteractionHandler {
    constructor(private on = true) {}
    /** @internal Called by `enable()`: a map made with `interactive: false` takes touch gestures from the page then. */
    wake?: () => void;
    enable(_options?: unknown) { this.on = true; this.wake?.(); }
    disable() { this.on = this.active = false; }
    isEnabled() { return this.on; }
    /** @internal Set by the map while the gesture of this handler is in progress. */
    active = false;
    /**
     * Whether the gesture of this handler is in progress, as in MapLibre: a drag (`dragPan`, from the press of the mouse
     * button or the first movement of a finger), a rotate drag (`dragRotate`),
     * a pinch (`touchZoomRotate`), a tilt with two fingers (`touchPitch`) or the box of a box zoom (`boxZoom`). The other
     * handlers always return false.
     */
    isActive() { return this.active; }
}
/** Pinch gestures. The rotation part can be turned off alone. */
export class TouchZoomRotateHandler extends InteractionHandler {
    rotation = true;
    disableRotation() { this.rotation = false; }
    enableRotation() { this.rotation = true; }
}

/** The `transformRequest` function of MapLibre. `resourceType` is `Tile`, `Style`, `Source`, `SpriteJSON`, `SpriteImage`, `Image`, `Glyphs` or `Font`. */
export type RequestTransform = (url: string, resourceType?: ResourceType) => {url: string; headers?: Record<string, string>; credentials?: RequestCredentials} | undefined;

/** The changes that `updateData` of a GeoJSON source takes, as in MapLibre. */
export interface GeoJSONDiff {
    removeAll?: boolean; remove?: (string | number)[]; add?: unknown[];
    update?: {id: string | number; newGeometry?: unknown; removeAllProperties?: boolean; removeProperties?: string[]; addOrUpdateProperties?: {key: string; value: unknown}[]}[];
}
type StyleChange = (previous: any, next: any) => any;
export type PointLike = {x: number; y: number} | [number, number];
/** Where `queryFeatures` looks: a point of the screen, a position (`[lng, lat]`), or the two corners of a rectangle of the screen. */
export type FeaturePlace = {x: number; y: number} | readonly number[] | readonly {x: number; y: number}[];
/** The options of `queryFeatures`. */
export interface FeatureOptions {
    /** The ids of the style layers to look in. Without it, the query looks in all style layers. */
    layers?: string[];
    /** A filter expression of the MapLibre style specification: the query returns only the features that pass it. */
    filter?: FilterSpecification;
    /**
     * At a point or a position, the distance in CSS pixels around the place within which a feature is found. It has no effect for a box or the whole map.
     * @default 3
     */
    radius?: number;
}
/** The options of `querySource`. */
export interface SourceOptions {
    /** The names of the layers of a vector tile source to look in. Without it, the query looks in all of them. */
    sourceLayers?: string[];
    /** A filter expression of the MapLibre style specification: the query returns only the features that pass it. */
    filter?: FilterSpecification;
    /**
     * At a point or a position, the distance in CSS pixels around the place within which a feature is found.
     * @default 3
     */
    radius?: number;
    /**
     * Whether each feature has `geometry`, at a point, at a position and in a query of the view.
     * @default false
     */
    geometry?: boolean;
    /**
     * At a point or a position, the zoom level of the tiles to read, rounded down and kept between `minzoom` and `maxzoom` of the source.
     * @default the zoom of the map
     */
    zoom?: number;
}
/** True for the options of a query given in the place of `at`: an object that is not a point, a position or a list. */
export const isOptions = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && !['x', 'y', 'lng', 'lat', 'lon'].some(k => k in v);
export interface RenderedQueryOptions { layers?: string[]; filter?: unknown; validate?: boolean }
/** A feature from `queryRenderedFeatures` or `querySourceFeatures`: GeoJSON, with its source, its style layer and its state. */
export interface RenderedFeature {
    /** Always `'Feature'`. */
    type: 'Feature';
    /** The id of the feature in its source, if it has one. */
    id?: number | string;
    /** The geometry as GeoJSON, in longitude and latitude. Narrow it by `type` before you read `coordinates`. It is never a `GeometryCollection`. */
    geometry: Exclude<GeoJSONGeometry, {type: 'GeometryCollection'}>;
    /** The properties of the feature. */
    properties: Record<string, unknown>;
    /** The id of the source. */
    source: string;
    /** The layer of the vector tile, for a vector source. */
    sourceLayer?: string;
    /** The style layer that draws the feature. */
    layer: StyleLayer;
    /** The feature state, as `setFeatureState` set it. */
    state: Record<string, unknown>;
}
/** A layer of the style, as the style has it (the MapLibre style specification). */
export interface StyleLayer {
    /** The id of the layer. */
    id: string;
    /** The type of the layer, such as `'fill'` or `'symbol'`. */
    type: string;
    /** The id of the source of the layer. */
    source?: string;
    /** The layer of the vector tile that the layer draws. */
    'source-layer'?: string;
    /** The smallest zoom level at which the layer is drawn. */
    minzoom?: number;
    /** The zoom level from which the layer is no longer drawn. */
    maxzoom?: number;
    /** The filter of the layer. */
    filter?: unknown;
    /** The layout properties of the layer. */
    layout?: Record<string, unknown>;
    /** The paint properties of the layer. */
    paint?: Record<string, unknown>;
    /** The `metadata` of the layer. */
    metadata?: unknown;
}

export interface MapEvent { type: string; target: Map; point?: {x: number; y: number}; lngLat?: {lng: number; lat: number}; [key: string]: unknown }
type Listener = (e: MapEvent) => void;

export class Map {
    protected container: HTMLElement;
    private canvas: HTMLCanvasElement;
    protected tr = new Transform();
    protected listeners: Record<string, Listener[]> = {};
    private send: (c: Command, transfer?: Transferable[]) => void = () => {};
    private queue: [Command, Transferable[]?][] = [];
    private workers: Worker[] = [];
    protected resolved!: ResolvedStyle;
    protected rawStyle: any;
    private dpr = 1;
    private isLoaded = false;
    private moving = false;
    protected ready = false;
    protected styleBase = '';
    /** A drag with the mouse or one finger moves the map. */
    readonly dragPan = new InteractionHandler();
    /** The scroll wheel and the trackpad zoom the map. */
    readonly scrollZoom = new InteractionHandler();
    /** A double click or a double tap zooms in by one level. */
    readonly doubleClickZoom = new InteractionHandler();
    /** A drag with the right mouse button, or with Ctrl and the left one, turns and tilts the map. */
    readonly dragRotate = new InteractionHandler();
    /** A pinch with two fingers zooms and turns the map; `disableRotation()` keeps the zoom only. */
    readonly touchZoomRotate = new TouchZoomRotateHandler();
    /** A drag up or down with two fingers tilts the map. */
    readonly touchPitch = new InteractionHandler();
    /** The arrow keys, `+` and `-` move, turn and zoom the map while it has the focus. */
    readonly keyboard = new InteractionHandler();
    /** Shift and drag draws a box, and the map zooms to it. */
    readonly boxZoom = new InteractionHandler();
    private observer?: ResizeObserver;
    private cleanup: (() => void)[] = [];
    private inputCleanup: (() => void)[] = [];
    /** The last `easeTo` (or `flyTo`) and when it was sent, for a fall back from the worker before it drew (#777). */
    private eased?: {c: Command; at: number};
    private tilePool?: {connect(): MessagePort[]; wake(): void; release(): void};
    private removed = false;
    private beforeStyle: (() => void)[] = [];
    protected imageNames = new Set<string>();
    /** A count for each image name. It goes up when the image is added or removed, so that an image that was still loading knows that it is too late. */
    private imageTurns = new globalThis.Map<string, number>();
    /** The images that are SVG templates, by name. `count` is the number of variants that the engine asked for. */
    private templates = new globalThis.Map<string, {svg: string; options: ImageOptions; slots: string[]; count: number; failed?: boolean}>();
    private sendTemplates(changed: string, rebuild: boolean) {
        this.post({type: 'templates', slots: Object.fromEntries([...this.templates].map(([name, t]) => [name, t.slots])), changed: [changed], rebuild});
    }
    /** Draws one variant of a template: the SVG with the value of each slot, made safe for XML. */
    private async addVariant(name: string, image: string, template: {svg: string; options: ImageOptions; slots: string[]; count: number; failed?: boolean}, values: string[]) {
        if (++template.count > MAX_VARIANTS) {
            if (template.count === MAX_VARIANTS + 1) this.fire('error', {error: new Error(`[map-jr-gl] The image "${image}" has more than ${MAX_VARIANTS} different sets of values for its slots, and the others are not drawn. Give its slots values from a small set.`)});
            return;
        }
        // (A picture that the SVG names is put into it first, as for a marker template.)
        const svg = await this.embedImages(fillTemplate(template.svg, Object.fromEntries(template.slots.map((s, i) => [s, values[i]]))));
        if (this.removed) return;
        // (A template given again with the same SVG, as after a fall back to the main thread, still gets the variant
        // that the engine asked for: the engine asks for each name once; #882.)
        const now = this.templates.get(image);
        if (now !== template) { if (now?.svg === template.svg && String(now.slots) === String(template.slots)) this.addVariant(name, image, now, values); return; }
        // (A template that cannot be drawn gives one error with its name, not one for each of its variants.)
        this.putImage(name, svg, template.options, true).catch(error => {
            if (!template.failed) this.fire('error', {error: new Error(`[map-jr-gl] The image "${image}" cannot be drawn with the values of its slots (${(error as Error).message}). Check that the SVG is well-formed, also with a value in each slot.`)});
            template.failed = true;
        });
    }
    private imageTurn(name: string) { const turn = (this.imageTurns.get(name) ?? 0) + 1; this.imageTurns.set(name, turn); return turn; }
    private imageResolver: ((id: string) => void | Promise<void>) | null = null;
    private tilesLoaded = false;
    /** The number of the last command to the engine that can change what is loaded. */
    private seq = 0;
    /** The `seq` of the last jumpTo, which wrote `this.tr` in advance: an older camera report does not overwrite it (#548). */
    private jumped = 0;
    /** The sources whose tiles for the view are all loaded, as the engine tells it. */
    private loadedSources = new Set<string>();
    private sourceRules = new globalThis.Map<string, {text: string; data: unknown; v: number}>();
    private sourceVersion = 0;
    /** Global state values set at runtime, on top of the style's defaults. */
    private globalState: Record<string, unknown> = {};
    protected zooming = false; protected rotating = false; protected pitching = false;
    /** Height grids of loaded elevation tiles (3D terrain), mirrored from the engine. */
    private heights = new globalThis.Map<string, Float32Array>();
    private pending = new globalThis.Map<number, {resolve(v: any): void; reject(e: Error): void; result?: Promise<unknown>}>();
    private nextQuery = 1;
    /** Only in this library: the thread that draws the map, `'worker'` or `'main'`. */
    renderer: 'worker' | 'main' = 'main';
    /** The page asked for `renderer: 'worker'` by name. Only then does a fall back to the main thread warn (#792). */
    private askedWorker: boolean;

    constructor(private options: MapOptions) {
        this.askedWorker = (options.renderer ?? loadDefaults.renderer) === 'worker';
        const c = typeof options.container === 'string' ? document.getElementById(options.container) : options.container;
        if (!c) throw new Error('Map container not found');
        // Two maps in one element leave two canvases. Hot module replacement and an effect without a clean-up do this.
        if (c.querySelector(':scope > .map-jr-canvas')) console.warn('[map-jr-gl] The container already has a map. Remove that map first: remove(), or destroy() in the main API.');
        this.container = c;
        (this as any).__v_skip = true; // (Vue does not make the map reactive: its proxies cannot be posted, #242)
        // As in MapLibre GL JS, a class gives the container `position: relative` and `overflow: hidden` (a frame from before
        // a shrink must not spill out). A style rule applies also to a container that is attached to the page later (#201).
        const mapClass = cls('map').split(' ');
        c.classList.add(...mapClass);
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'map-jr-canvas';
        // `object-fit: none` shows the canvas's current frame unscaled and centered, whatever size that frame is. With
        // worker rendering a new frame arrives a moment after the container resizes; until it does, the old frame simply
        // stays centered instead of being stretched to the new shape. The box is sized in device pixels and scaled back
        // down so one frame pixel is one screen pixel.
        this.canvas.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;object-fit:none;object-position:center;touch-action:none;outline:none;max-width:none';
        // A first view from the server is under the canvas until `load`: the canvas stays hidden while it draws, so it never shows half a map over the picture.
        if (c.querySelector('[data-map-jr-ssr]')) this.canvas.style.visibility = 'hidden';
        this.canvas.tabIndex = 0;
        // (As in MapLibre GL JS: assistive technology says that this is a map.)
        this.canvas.setAttribute('role', 'region');
        this.canvas.setAttribute('aria-label', 'Map');
        // Server-rendered markup stays visible on top until the canvas has drawn the same view.
        c.insertBefore(this.canvas, c.firstChild);
        this.tr.minZoom = options.minZoom ?? -2;
        this.tr.maxZoom = options.maxZoom ?? 22;
        this.tr.worldCopies = !!(options.renderWorldCopies ?? true);
        const ratio = options.pixelRatio;
        if (ratio! > 0 && ratio! < Infinity) this.pixelRatio = ratio;
        else if (ratio !== undefined) console.warn(`[map-jr-gl] The option pixelRatio is ${ratio}. Give a number above 0, or leave it out to follow devicePixelRatio.`);
        this.measure();
        this.canvas.width = Math.round(this.tr.width * this.dpr);
        this.canvas.height = Math.round(this.tr.height * this.dpr);
        this.tr.maxPitch = this.pitchCap(options.maxPitch);
        const key = options.hash;
        if (key) {
            // The camera is in the fragment of the URL, as in MapLibre (see hash.ts, which is loaded only for this option).
            // The fragment gives the camera at the start and overrides `center`, `zoom` and `bounds`, as in MapLibre; the options are for a URL without one.
            const all = location.hash.slice(1), p = (key === true ? all : new URLSearchParams(all).get(key) ?? '').split('/').map(Number);
            if (p.length > 2 && !p.some(isNaN)) this.options = options = {...options, zoom: p[0], center: [p[2], p[1]], bounds: undefined, bearing: p[3] ?? 0, pitch: p[4] ?? 0};
            // (A movement can end before the file has loaded: it is written then.)
            let early = false;
            this.once('moveend', () => { early = true; });
            import('./hash.ts').then(m => this.removed || this.cleanup.push(m.watchHash(this, key, early)));
        }
        this.tr.set(options.center ?? [0, 0], options.zoom ?? 0, options.bearing ?? 0, options.pitch ?? 0);
        // As in MapLibre, `bounds` comes before `center` and `zoom`: the map starts with that area in view.
        // (The padding of the map is in place for the first fit, so that the box fits into the free part; the main API passes it, #1162.)
        if (options.startPadding !== undefined) this.tr.padding = paddingOf(options.startPadding);
        if (options.bounds) { const fit = this.cameraForBounds(options.bounds, options.fitBoundsOptions); this.tr.set([fit.center.lng, fit.center.lat], fit.zoom, options.bearing ?? 0, options.pitch ?? 0); }
        // As in MapLibre, `interactive: false` turns every handler off, and `enable()` on one turns it on later (#196).
        // The map still fires its mouse events (#253), and a touch scrolls the page until a handler is enabled.
        const still = options.interactive === false;
        if (still) this.canvas.style.touchAction = '';
        // As in MapLibre's CSS, an interactive map shows `grab`, and `grabbing` while the button is down; setCursor() overrides it.
        else this.canvas.classList.add(...cls('interactive').split(' '));
        for (const k of ['dragPan', 'scrollZoom', 'doubleClickZoom', 'dragRotate', 'touchZoomRotate', 'touchPitch', 'keyboard', 'boxZoom'] as const) {
            if (options[k] === false || still) this[k].disable();
            if (still) this[k].wake = () => { this.canvas.style.touchAction = 'none'; };
        }
        this.transformRequest = options.transformRequest ?? null;
        protocolListeners.add(this.sendRequestRules);
        this.sendRequestRules(); // before the style, so that the first requests follow the rules
        this.cleanup.push(() => protocolListeners.delete(this.sendRequestRules));
        this.cleanup.push(() => c.classList.remove(...mapClass));
        // As in MapLibre GL JS, the four corners of the controls exist from the start: apps query them before they add a control.
        this.styles();
        for (const pos of ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const) {
            const corner = this.corners[pos] = document.createElement('div');
            corner.className = cls('ctrl-' + pos);
            c.appendChild(corner);
            this.cleanup.push(() => corner.remove());
        }
        this.start().catch(this.sourceFailed);
    }

    private pixelRatio?: number;
    /** Sets the number of canvas pixels for each CSS pixel. Without a value, the map follows the screen again. */
    setPixelRatio(ratio?: number | null) { this.pixelRatio = ratio ?? undefined; return this.resize(); }
    private measure() {
        // The layout size, as MapLibre reads it: a bounding box would include the CSS transforms of the ancestors.
        const r = {width: this.container.clientWidth, height: this.container.clientHeight};
        this.tr.width = r.width; this.tr.height = r.height;
        // Space for the browser's bars at the top and bottom of the screen is only for a map that fills the screen. On a
        // map in a page, that space changes while the page scrolls (Safari hides its toolbar), and the controls would move.
        this.container.classList.toggle('map-jr-fills', r.height >= globalThis.innerHeight - 1 && document.documentElement.scrollHeight <= globalThis.innerHeight + 1);
        this.dpr = this.pixelRatio ?? Math.min(globalThis.devicePixelRatio || 1, 3);
        Object.assign(this.canvas.style, {width: this.dpr * 100 + '%', height: this.dpr * 100 + '%', transform: `scale(${1 / this.dpr})`});
    }

    /** A number for each style that the map was given. After an `await`, a style that is not the last one is dropped. */
    private styleTurn = 0;
    /** The first style is on its way (see `start`). */
    private starting = false;
    private firstChange?: StyleChange;
    private async start() {
        const o = this.options;
        if (!o.style) return; // the style comes later, with setStyle
        // (`setStyle` during this request gives another style: that one is fetched, and this answer is not used.)
        // The workers start now, at the same time as the request for the style: each is a download of its own.
        // Tile workers come from a pool shared by all maps. If workers cannot be started at all (the file is missing,
        // or a security policy forbids them), everything still works on this thread, just less smoothly.
        const want = o.renderer ?? loadDefaults.renderer ?? 'auto';
        // With the main renderer, the engine chunk and its imports load now, at the same time as the style, and not
        // once the style and the workers are ready (#325). A map that cannot start the worker renderer loads the chunk as
        // soon as it knows that. (`startMainEngine` imports the same module again: the browser fetches it once.)
        const preload = () => void import('./engine-entry.ts').catch(() => {});
        const pool = acquireTileWorkers(o).catch((err: Error) => {
            preload();
            console.warn(`[map-jr-gl] Workers are unavailable (${err.message}); running on the main thread. ` +
                'If the worker file is not next to the library, pass `workerUrl` or `createWorker`, or use the standalone build.');
            // Vite in development serves the library from its dependency cache, which does not contain the worker file.
            if (__DEV__ && !(o.workerUrl ?? loadDefaults.workerUrl ?? o.createWorker ?? loadDefaults.createWorker) && import.meta.url.includes('/node_modules/.vite/deps/'))
                console.warn("[map-jr-gl] Vite's dependency cache does not contain the worker file. Add optimizeDeps: {exclude: ['@map-jr/map-jr-gl', 'maplibre-gl']} to vite.config and restart the dev server.");
        });
        const engine = want !== 'main' && 'transferControlToOffscreen' in this.canvas ? startWorker(o).catch(() => null) : null;
        if (engine) engine.then(w => w || preload()); else preload();
        // (When the style fails, or the map is removed, the workers of this start are given back.)
        const giveBack = () => { pool.then(p => p?.release()); engine?.then(w => w?.terminate()); };
        let raw: any, turn: number;
        this.starting = true;
        do {
            turn = this.styleTurn;
            try { raw = await this.loadStyle(o.style); } catch (error) { if (turn === this.styleTurn) { this.starting = false; giveBack(); throw error; } }
        } while (turn !== this.styleTurn && !this.removed);
        this.starting = false;
        // (The map can be removed during each `await` of this method. What this start acquired is then given back.)
        if (this.removed) { giveBack(); return; }
        this.rawStyle = deref(this.firstChange?.(undefined, raw) ?? raw);
        // The parts of the worker that the style needs load now, while the worker file loads (#79).
        prefetchParts(o, this.rawStyle, !!engine);
        // (With the engine on this thread, 3D terrain loads its chunk now, in parallel with the chunk of the engine: #1849.)
        if (!engine && this.rawStyle?.terrain) void import('./dem.ts').catch(() => {});
        this.styleChanged();
        this.firstChange = undefined; // (a restart of the engine starts from the style as it is then)
        for (const fn of this.beforeStyle.splice(0)) fn();
        // (A restart gives the style as an object. Its relative URLs still belong to the place that the style came from.)
        if (!this.restarting) this.styleBase = typeof o.style === 'string' ? new URL(o.style, location.href).href : location.href;
        // With the engine on this thread, the files of the sprite are requested now, as in MapLibre GL JS, and not once
        // the sources are resolved and the engine chunk has loaded; the engine takes these answers (#371).
        const early = engine ? undefined : this.spriteFiles(this.rawStyle.sprite);
        // As in MapLibre, a style may carry its own starting camera. It is used only when the options give no part of
        // the camera: with a zoom in the options and no center, the center is [0, 0], not that of the style.
        const sc = this.rawStyle;
        if (o.center === undefined && o.zoom === undefined && o.bearing === undefined && o.pitch === undefined && !o.bounds) this.tr.set(sc.center, sc.zoom, sc.bearing, sc.pitch);
        const restyled = this.restyled, [first] = await Promise.all([resolveStyle(this.rawStyle, this.fetchAs('Source'), this.styleBase, undefined, this.sourceFailed, this.geojsonBuffer()), this.globeReady()]);
        // (Values set before the style was there.)
        if (Object.keys(this.globalState).length) first.state = {...first.state, ...this.globalState};
        // A globe is not kept inside the height of the world as Mercator is: the camera of the options is set again now
        // that the map knows its projection (as MapLibre waits for the style before it constrains the camera).
        if (this.tr.globe && !this.restarting && !o.bounds) {
            const c = o.center === undefined && o.zoom === undefined && o.bearing === undefined && o.pitch === undefined ? sc : o;
            if (c.center !== undefined || c.zoom !== undefined) this.tr.set(c.center ?? [0, 0], c.zoom ?? 0, c.bearing ?? 0, c.pitch ?? 0);
        }
        if (this.removed) { giveBack(); return; }
        // (A change of the style during that step has its own result, which is newer. The engine gets it after its start.)
        if (restyled === this.restyled) this.resolved = first;
        this.warnUnsupported(this.resolved.unsupported);
        this.checkProjection();
        const tr = this.tr;
        const engineOptions = {
            style: {...this.resolved, rasterFade: this.rasterFade()}, width: tr.width, height: tr.height, dpr: this.dpr, fontFamily: o.fontFamily ?? DEFAULT_FONT, fonts: o.fonts,
            center: [tr.lng, tr.lat] as [number, number], zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch,
            minZoom: tr.minZoom, maxZoom: tr.maxZoom, maxPitch: tr.maxPitch, worldCopies: tr.worldCopies, antialias: o.antialias,
            // (A new engine, after a fall back or a restart too, gets the rules with the style: otherwise its first tiles
            // would be fetched before `resend` sends them, without `transformRequest`; #355.)
            requests: this.rulesSent ? this.requestRules() : undefined, early, noExpiry: this.noExpiry(),
        };

        const tiles = await pool;
        let engineWorker = await engine;
        if (this.removed) { giveBack(); return; }
        this.tilePool = tiles || undefined;
        const ports = this.tilePool?.connect() ?? [];
        // (An engine in a worker needs the tile workers: without them the engine runs on this thread.)
        if (!ports.length) { engineWorker?.terminate(); engineWorker = null; }
        if (engineWorker) {
            const off = this.canvas.transferControlToOffscreen(), w = engineWorker;
            this.workers.push(w);
            w.onmessage = e => {
                if (e.data.type === 'warn') return pageWarn(e.data.msg);
                if (e.data.type !== 'fatal') return this.onEngineEvent(e.data);
                // The worker could not create a WebGL2 context. A transferred canvas cannot be taken back, so swap in a new one.
                this.fellBack(e.data.message);
                const fresh = this.canvas.cloneNode() as HTMLCanvasElement;
                this.canvas.replaceWith(fresh);
                for (const fn of this.inputCleanup.splice(0)) fn();
                this.canvas = fresh;
                // The commands that the page sent so far went to the worker, which does not answer them. Until the new
                // engine runs, commands wait. It then gets the style as it is now, and what `resend` sends.
                this.ready = false;
                this.watchTurn++; // (the watch of the worker must not count while the engine chunk loads; #146)
                w.terminate();
                // (The ports went to the worker and end with it. New ones keep the tiles in the tile workers; #812.)
                this.startMainEngine(fresh, {...engineOptions, style: {...this.resolved, rasterFade: this.rasterFade()}, center: [this.tr.lng, this.tr.lat], zoom: this.tr.zoom, bearing: this.tr.bearing, pitch: this.tr.pitch}, this.tilePool?.connect() ?? []).then(() => {
                    if (this.removed) return;
                    this.ready = true;
                    for (const [c, t] of this.queue.splice(0)) this.deliver(c, t);
                    this.resend();
                    // (The data of GeoJSON sources and changes of the style since the start. It is also a numbered command:
                    // the new engine reports `idle` with the number that the page waits for. It sends the style that the
                    // map has resolved, so a source that failed is not fetched and reported again; #777.)
                    this.restyle(true, true);
                    // (`putImage` and not `addImage`: an image of the style stays one in the compat entry; #853.)
                    // (The new engine can build tiles before it has the slots of the templates: they are given as new,
                    // so that those tiles are built again; #882.)
                    this.templates.clear();
                    for (const [name, [source, options]] of this.imageInputs) this.putImage(name, source, options);
                    // (The worker drew nothing, so an animation that the page started went nowhere; #777.)
                    this.resumeEase();
                    this.bindInput();
                }, error => this.fire('error', {error}));
            };
            if (__DEV__) {
                this.note('engine worker starts', {restarting: this.restarting, ports: ports.length});
                w.onerror = e => this.note('engine worker: error', `${e.message} (${e.filename}:${e.lineno})`);
                w.onmessageerror = () => this.note('engine worker: a message could not be read');
            }
            // (A style with a Vue reactive proxy in it cannot be cloned: the engine then gets a JSON copy, #242.)
            // (The engine loads the part for 3D terrain, #1849: the page sends the code that it fetches, see `partsComing`.)
            const parts = partUrls(o), coming = partsComing(o, [w]);
            try { w.postMessage({role: 'engine', canvas: off, options: engineOptions, ports, parts, coming}, [off, ...ports]); }
            catch { w.postMessage({role: 'engine', canvas: off, options: plain(engineOptions), ports, parts, coming}, [off, ...ports]); }
            this.send = (c, transfer) => w.postMessage(c, transfer ?? []);
            this.renderer = 'worker';
        } else {
            await this.startMainEngine(this.canvas, engineOptions, ports);
            if (this.removed) return; // (`remove` gave the tile workers back, and no engine was made)
        }
        this.ready = true;
        for (const [c, t] of this.queue) this.deliver(c, t);
        this.queue = [];
        this.send({type: 'repaint'});
        // (An engine in a worker must show for 5 seconds that it draws, at the first start too: a worker can hang with no
        // event (#119). After a restart for a lost context, an engine on this thread must show it for 15 seconds. A move
        // to this thread for a custom layer is a first start there: the code of the layer can take long for its first frame.)
        this.watch(this.renderer === 'worker' ? 5 : this.restarting && !this.movingToMain ? 15 : 0);
        // (The style of a move to this thread is not new: a `style.load` listener that adds the custom layer would add it twice.)
        if (!this.movingToMain) this.styleEvents(true);

        this.observer = new ResizeObserver(() => { this.styles(); this.resize(); });
        this.observer.observe(this.container);
        this.bindInput();
        if (o.attributionControl !== false && !this.restarted) {
            // The attribution is the lowest control of its corner, as in MapLibre GL JS, also when the app added controls there before this point (#202).
            const a = new AttributionControl(o.attributionControl || {});
            this.addControl(a);
            const el = this.controls.get(a)!;
            el.parentElement!.prepend(el);
        }
    }

    private restarted = false;
    private restarting = false;
    /** The restart moves the engine to this thread for a custom layer (see `toMainThread`). */
    private movingToMain = false;
    /** What addImage was given, by name: a restart sends the images again. */
    protected imageInputs = new globalThis.Map<string, [Parameters<Map['addImage']>[1], ImageOptions]>();
    /**
     * Starts the engine again on a new canvas, with the camera, style, images, markers and state that the map has now.
     * This is how the map recovers when the browser takes the WebGL context away, which phones do to save memory.
     */
    private async restart(main?: boolean, quiet?: boolean) {
        if (this.restarting || this.removed) return;
        this.restarting = this.restarted = true;
        this.movingToMain = !!quiet;
        if (__DEV__) this.note('restart()', {main: !!main, quiet: !!quiet, renderer: this.renderer});
        this.watchTurn++;
        if (!quiet) this.fire('webglcontextlost');
        this.drop('lost its WebGL context. Ask again');
        try {
            // (An engine on the main thread does not end with a worker. It must stop: it can still have a context when
            // the restart is for an engine that reported no frame.)
            if (this.ready) this.send({type: 'destroy'});
            for (const fn of this.inputCleanup.splice(0)) fn();
            this.observer?.disconnect();
            for (const w of this.workers.splice(0)) w.terminate();
            this.tilePool?.release();
            this.tilePool = undefined; // (a `remove` during the start below must not give the same workers back again)
            this.ready = false; this.queue = []; this.tilesLoaded = false; this.seq = 0; this.buffer = undefined; this.jumped = 0;
            this.loadedSources.clear(); // (the new engine has no tiles)
            const fresh = this.canvas.cloneNode() as HTMLCanvasElement, tr = this.tr;
            this.canvas.replaceWith(fresh);
            this.canvas = fresh;
            this.options = {...this.options, style: this.rawStyle, center: [tr.lng, tr.lat], zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch, ...(main && {renderer: 'main' as const})};
            await this.start();
            this.resend();
            // The engine got the style without what `restyle` adds: the number of each source (without it the page does not
            // accept the report that a source is loaded), the layers that the page has hidden, and the global state.
            this.restyle(true);
            this.resumeEase();
            this.templates.clear(); // (as after a fall back; #882)
            for (const [name, [source, options]] of this.imageInputs) await this.putImage(name, source, options);
            if (!quiet) this.fire('webglcontextrestored');
            if (__DEV__) this.note('restart() ended', {renderer: this.renderer, drew: this.drew});
        } catch (error) { if (__DEV__) this.note('restart() failed', String(error)); this.fire('error', {error}); } finally { this.restarting = false; }
    }

    /**
     * @internal Moves the engine of a map that draws in a worker to this thread, as `restart` does after a lost context
     * but without the events of a lost context. The compat entry calls it for its first custom layer (#1730). It
     * waits for the start or a restart that runs, and does nothing when the engine is on this thread already.
     */
    protected async toMainThread() {
        // (The restart copies the style: it waits for a task, so that the custom layer and the other changes of the
        // task of the caller are in the copy.)
        do await new Promise(r => setTimeout(r, 50)); while (!this.removed && (!this.ready || this.restarting));
        if (this.renderer === 'worker') await this.restart(true, true);
    }

    /** A new engine (after a fall back or a restart) runs the last `easeTo` for the time that is left; #777, #807. */
    private resumeEase() {
        const ease = this.eased, left = ease ? (ease.c as {duration: number}).duration - (performance.now() - ease.at) : 0;
        if (left > 0) this.post({...ease!.c, duration: left} as Command);
    }

    /** The engine of the last start has drawn a frame. */
    private drew = false;
    /** The number of the last `ping` that the engine has answered with a frame. */
    private pong = 0;
    private lostAt = 0;
    private watchTurn = 0;
    /**
     * Watches a new engine. With `limit`, the engine must show for that many seconds that it draws: it reports its first
     * frame, and it answers the question of each second (`ping`) with a frame. An engine that has no first frame at the
     * end, or has not answered the question that it got 3 seconds before the end, counts as an engine without a WebGL
     * context. (Safari on a machine without a GPU: a worker draws one frame and then takes no messages and draws
     * nothing, and no event says so.)
     *
     * A second counts only while the page is visible and the map has a size, because an engine draws no frame without
     * them. The clock is a timer and not the frames of the page.
     */
    private watch(limit = 0) {
        const turn = ++this.watchTurn;
        this.drew = false;
        this.pong = 0;
        let n = 0;
        if (__DEV__) this.note('watch', {limit, renderer: this.renderer});
        const tick = () => {
            if (__DEV__) this.note('tick', {drew: this.drew, pong: this.pong, asked: n, replaced: turn !== this.watchTurn, hidden: document.hidden, width: this.tr.width, height: this.tr.height});
            if (turn !== this.watchTurn || this.removed) return;
            if (!document.hidden && this.tr.width && this.tr.height) {
                if (n === limit) { if (!this.drew || this.pong < n - 2) this.contextLost(true); return; }
                this.send({type: 'ping', n: ++n});
            }
            setTimeout(tick, 1000);
        };
        if (limit) tick();
    }

    /**
     * The development build only: when the page has set `__mapJrDebug` to an array, the map writes there what it does
     * about a lost WebGL context, each entry as [milliseconds since the page started, what, data]. The array holds at
     * most 400 entries. Each call is behind `__DEV__`, so the production build has none of this.
     */
    private note(what: string, data?: unknown) {
        const record = __DEV__ && (globalThis as {__mapJrDebug?: unknown[]}).__mapJrDebug;
        if (record && record.length < 400) record.push([Math.round(performance.now()), what, data]);
    }

    /**
     * The engine has no WebGL context: the browser says so, or (`silent`) the engine did not draw in the time that
     * `watch` gave it. An engine that drew before starts again in the same way. An engine in a worker that loses the
     * context before its first frame, or within 10 seconds of the loss before, or that did not draw in its time, would
     * fail again: the engine then starts on the main thread. An engine on the main thread that was started again
     * already and fails before its first frame, or does not draw in its time, is an error.
     */
    private contextLost(silent?: boolean) {
        if (__DEV__) this.note('contextLost()', {silent: !!silent, removed: this.removed, restarting: this.restarting, restarted: this.restarted, renderer: this.renderer, drew: this.drew, sinceLastLoss: Date.now() - this.lostAt});
        if (this.removed) return;
        // (The new engine lost its context while `restart` still waits, for the images for example.)
        if (this.restarting) return void setTimeout(() => this.contextLost(silent), 1000);
        const worker = this.renderer === 'worker', now = Date.now(), drew = this.drew && !silent, toMain = worker && (!drew || now - this.lostAt < 10000);
        this.lostAt = now;
        if (__DEV__) this.note('decision', drew || worker || !this.restarted ? toMain ? 'restart on the main thread' : 'restart with the same renderer' : 'error, no restart');
        if (drew || worker || !this.restarted) {
            if (toMain) this.fellBack('the WebGL context was lost');
            this.restart(toMain);
        } else {
            this.watchTurn++;
            this.fire('error', {error: new Error('[map-jr-gl] The WebGL context was lost again. Call remove() and create the map again later.')});
        }
    }

    /** Says that the engine goes to the main thread: a warning for `renderer: 'worker'`, and with `'auto'` only a note of the development build. */
    private fellBack(why: string) {
        const text = '[map-jr-gl] Worker rendering unavailable, using the main thread: ' + why;
        if (this.askedWorker) console.warn(text);
        else if (__DEV__) console.info(text);
    }

    /** Sends again what an engine gets through commands, and not through the style. A new engine needs it. */
    protected resend() {
        this.geoSent = undefined;
        // (The answers for data sent to the old engine do not come: the data that waits goes to the new one.)
        this.geoBusy.clear();
        if (this.geoPending.size) queueMicrotask(() => { if (this.restyled === this.restyles) this.sendGeo(); });
        this.limits();
        if (this.rulesSent) this.sendRequestRules();
        if (this.wantsFrames) this.post({type: 'frames', on: true});
        if (this.wantsTiles) this.post({type: 'tileLoads', on: true});
        if (this.videos) this.videos.frame();
        for (const source of Object.keys(this.featureStates)) this.post({type: 'featureState', source, states: this.featureStates[source], replace: true});
        // (The padding of the camera, the fonts of `addFonts` and the report of the benchmark page are set by calls; #1050.)
        if (this.tr.padding.some(Boolean)) { this.post({type: 'jump', padding: this.tr.padding}); this.jumped = this.seq; }
        if (this.fontsAdded.length) this.post({type: 'fonts', fonts: this.fontsAdded});
        if (this.tapped) this.post({type: 'tileReport', on: true});
    }

    /** Requests the JSON and the image of each sheet of a sprite, by URL, as the engine asks for them (see `loadIcons`). */
    private spriteFiles(sprite: unknown) {
        const sheets = typeof sprite === 'string' ? [sprite] : Array.isArray(sprite) ? sprite.map(s => s?.url) : [];
        const files = new globalThis.Map<string, Promise<Response>>(), dense = this.dpr > 1 ? '@2x' : '';
        for (const sheet of sheets) {
            if (typeof sheet !== 'string') continue;
            const url = new URL(sheet, this.styleBase).href + dense;
            for (const [ext, kind] of [['.json', 'SpriteJSON'], ['.png', 'SpriteImage']]) {
                const answer = this.fetchAs(kind)(url + ext);
                answer.catch(() => {}); // (the engine reports a failure when it takes the answer)
                files.set(url + ext, answer);
            }
        }
        return files.size ? files : undefined;
    }

    /** Runs the engine on this thread. Its code is a separate chunk, fetched only when this path is taken. */
    private async startMainEngine(canvas: HTMLCanvasElement, options: import('./engine.ts').EngineOptions, ports: MessagePort[]) {
        const {Engine, LocalBackend, PortBackend} = await import('./engine-entry.ts');
        if (this.removed) return;
        const backends: TileBackend[] = ports.length ? ports.map(p => new PortBackend(p)) : [new LocalBackend()];
        let engine: InstanceType<typeof Engine>;
        try { engine = new Engine(canvas, options, backends, e => this.onEngineEvent(e)); } catch (cause) { throw this.cannotShow(cause as Error); }
        this.send = c => engine.command(c);
        this.renderer = 'main';
    }

    private unavailable?: HTMLElement;
    /**
     * No engine could start, usually because the browser has no WebGL2. The container gets a message in place of an
     * empty canvas, and the caller reports the error that this returns. An application changes the message with CSS
     * (`.map-jr-unavailable`), or avoids it with `supported()`.
     */
    private cannotShow(cause: Error) {
        if (!this.unavailable) {
            this.styles();
            const el = this.unavailable = document.createElement('div');
            el.className = 'map-jr-unavailable';
            el.textContent = 'This browser cannot show the map.';
            this.canvas.after(el);
        }
        return new Error(`[map-jr-gl] The map cannot be shown: ${cause.message}.` + (/WebGL2/.test(cause.message) ? ' Call supported() before you make a map, and show other content when it returns false.' : ''), {cause});
    }

    /** @internal Sends a command to the engine. */

    protected post(c: Command, transfer?: Transferable[]) {
        // (A command that changes or reads the images goes after the updates of this task. A repaint does not wait.)
        if (c.type === 'style' || c.type === 'templates' || c.type === 'removeImage' || c.type === 'snapshot' || c.type === 'image' && !c.update) this.sendUpdates();
        if (c.type !== 'query' && c.type !== 'elevation' && c.type !== 'queryRendered' && c.type !== 'frames' && c.type !== 'snapshot' && c.type !== 'tileReport' && c.type !== 'tileLoads') { this.tilesLoaded = false; (c as {seq?: number}).seq = ++this.seq; }
        if (c.type === 'query' || c.type === 'queryRendered') this.tilePool?.wake(); // (#824)
        if (this.ready) this.deliver(c, transfer); else this.queue.push([c, transfer]);
    }
    /** Sends a command. A value that structured clone refuses (a Vue reactive proxy, #242) is sent as a JSON copy. */
    private deliver(c: Command, transfer?: Transferable[]) {
        try { this.send(c, transfer); } catch (e) {
            try { if ((e as Error).name !== 'DataCloneError') throw e; this.send(plain(c), transfer); }
            catch (error) {
                // (Data that did not go gets no `geojsonDone`: the source must not wait for it.)
                if (c.type === 'geojson') this.geoBusy.delete(c.source);
                this.fire('error', {error: new Error(`[map-jr-gl] The map could not copy data to its workers (${(e as Error).message}). Pass plain objects (toRaw() in Vue).`, {cause: error})});
            }
        }
    }

    private seen?: {zoom: number; bearing: number; pitch: number};
    /**
     * A drag with one pointer and the worker renderer (#38): the number of its first `pan`, the ground that the engine
     * grabbed (known from its first report), and the pointer positions that the page has placed (`x`, `y`, at the time
     * `t`), will place in the next frame (`next`) and has just received (`pend`). The page moves its own camera as the
     * engine does and places the HTML markers from it in the frame in which the worker draws the move. Placed from the
     * camera that the engine reports, they trailed the map by a frame. (The page does not grab the ground itself: its
     * camera can be behind the engine's, for example when a drag stops an `easeTo`.)
     */
    private held: {from: number; at?: [number, number]; x?: number; y?: number; t: number; pend?: [number, number]; next?: [number, number]; loop?: boolean} | null = null;
    /** @internal What places the HTML markers and popups of this map (see `held`). */
    readonly overlays = new Set<() => void>();
    /** The `idle` report of the worker that waited for the page to show its frame (see `onEngineEvent`). */
    private shown?: EngineEvent;
    /** The size of the drawing buffer after the last resize, as the engine reports it, and the time until which an `idle` waits for the canvas to have it (see `onEngineEvent`). */
    private buffer?: [number, number, number];
    /**
     * In WebKit the first task that reads the canvas of a worker after a frame came, with `drawImage`, `toDataURL` or
     * `createImageBitmap`, reads blank pixels, and each later task reads the frame (#965). This read is that first one.
     * The page makes it at the engine's first frame and when an `idle` report comes, in tasks before the page fires `idle`.
     */
    private firstRead() {
        if (this.renderer === 'worker' && navigator.vendor.startsWith('Apple')) try { new OffscreenCanvas(1, 1).getContext('2d')!.drawImage(this.canvas, 0, 0); } catch { /* (nothing to read yet) */ }
    }
    private onEngineEvent(e: EngineEvent) {
        if (__DEV__ && e.type !== 'camera' && e.type !== 'heights' && e.type !== 'result') this.note('engine: ' + e.type, e.type === 'pong' ? e.n : e.type === 'idle' ? {seq: e.seq, expected: this.seq} : e.type === 'frame' ? {first: !this.drew} : e.type === 'error' ? e.message : undefined);
        if (e.type === 'camera') {
            // Compared with the last camera that the engine reported, not with `this.tr`: jumpTo writes `this.tr` in advance.
            const was = this.seen ?? this.tr, zoomed = e.zoom !== was.zoom;
            const turned = e.bearing !== was.bearing, tilted = e.pitch !== was.pitch;
            this.seen = {zoom: e.zoom, bearing: e.bearing, pitch: e.pitch};
            // (A report from before the last jumpTo would move the camera back for a frame: the needle of the compass and
            // getBearing() stepped back during a fast drag of the compass with the worker renderer, #548.)
            if ((e.seq ?? this.jumped) >= this.jumped) Object.assign(this.tr, {lng: e.lng, lat: e.lat, zoom: e.zoom, bearing: e.bearing, pitch: e.pitch, elevation: e.elevation, padding: e.padding});
            // With 3D terrain, positions on this thread follow the ground too (clicks, project/unproject, DOM markers).
            const k = e.exaggeration;
            this.tr.groundRange = e.groundRange;
            this.tr.heightAt = k > 0 ? (mx, my) => groundHeight(this.heights, mx, my, 15, 0, e.elevation / k) * k : undefined;
            // (During a drag the engine's report can be older than the last pointer move that the page has already applied.)
            const h = this.held;
            if (h && e.grab && e.grab[2] >= h.from) h.at = [e.grab[0], e.grab[1]];
            if (h?.at && h.x !== undefined && !this.tr.heightAt && !this.tr.globeness && performance.now() - h.t < 100) this.tr.setLocationAt(h.at[0], h.at[1], h.x, h.y!);
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
            this.engineMoving = !!e.moving;
            // (A rotate drag that pauses with the button down has not ended: MapLibre GL JS ends it once, at the release, #1873.)
            if (!e.moving && !this.dragging && !this.awaitingInertia && !this.dragRotate.active) this.settle();
        } else if (e.type === 'resource') {
            this.answer(e.url, e.kind).then(a => a, (err): RequestAnswer => ({error: String(err.message)})).then(a => this.post({type: 'resourceResult', id: e.id, ...a}, a.data ? [a.data] : undefined));
        } else if (e.type === 'contextlost') {
            this.contextLost();
        } else if (e.type === 'hidden') {
            this.hidden = new Set(e.layers);
        } else if (e.type === 'geojsonDone') {
            this.geoBusy.delete(e.source);
            if (this.geoPending.has(e.source) && this.restyled === this.restyles) this.sendGeo();
        } else if (e.type === 'pong') {
            this.pong = e.n;
        } else if (e.type === 'frame') {
            if (!this.drew) this.firstRead();
            this.drew = true; // (an engine reports its first frame also when the page did not ask for frames)
            this.fire('render');
        } else if (e.type === 'source') {
            if (!e.loaded) this.loadedSources.delete(e.source);
            else if (e.v === this.sourceRules.get(e.source)?.v) {
                this.loadedSources.add(e.source);
                this.loadedEvents(e.source);
            }
        } else if (e.type === 'idle') {
            // (A report from before the last command: the engine sends another after that command.)
            // (While a style of `setStyle` loads, the map is not idle: its `idle` comes after that style; #1167.)
            if (e.seq !== this.seq || this.restyled !== this.restyles || this.resolved?.waiting || this.styleLoading) return;
            // An engine in a worker sends `idle` once its frame has gone to the page (see `frame` in engine.ts), and the
            // page shows that frame when it next paints (#555). Wait for the page's next frame; a hidden page runs none,
            // so a timer ends the wait too. The canvas of the page takes the size of a resized frame only when that frame
            // arrives, which can be several frames after the resize (#950): the wait also lasts until the canvas has the
            // size of the drawing buffer after the last resize, until a second after that resize. (The engine reports that size: the
            // browser clamps a large canvas.)
            if (this.renderer === 'worker' && this.shown !== e) {
                if (!this.tilesLoaded) this.firstRead();
                let done = false;
                const c = this.canvas;
                const go = () => {
                    if (done || this.removed) { done = true; return; }
                    const b = this.buffer;
                    if (b && (c.width !== b[0] || c.height !== b[1]) && performance.now() < b[2]) return;
                    this.buffer = undefined; // (the size has arrived, or will not: later reports do not wait for it)
                    done = true; this.shown = e; this.onEngineEvent(e);
                };
                const frame = () => { go(); if (!done) requestAnimationFrame(frame); }, timer = () => { go(); if (!done) setTimeout(timer, 100); };
                requestAnimationFrame(frame); setTimeout(timer, 100);
                return;
            }
            this.tilesLoaded = true;
            if (!this.isLoaded) {
                this.isLoaded = true;
                for (const el of this.container.querySelectorAll('[data-map-jr-ssr]')) el.remove();
                this.canvas.style.visibility = '';
                this.fire('load');
                // A `load` listener that changed the style or the camera made this report old: wait for the next one.
                if (e.seq !== this.seq || this.restyled !== this.restyles || this.resolved?.waiting) return;
            }
            // The data of each source is complete now. As in MapLibre, `sourcedata` and `data` tell listeners so.
            {
                for (const sourceId of Object.keys(this.rawStyle?.sources ?? {})) this.loadedSources.add(sourceId);
                for (const sourceId of Object.keys(this.rawStyle?.sources ?? {})) this.loadedEvents(sourceId);
            }
            // (As in MapLibre GL JS, a video that plays, or a canvas source that plays, keeps the map from `idle`. A pause sends a frame, and then `idle` fires.)
            if (!this.videos || !this.videos.playing()) this.fire('idle');
        } else if (e.type === 'heights') {
            if (e.grid) this.heights.set(e.key, e.grid); else this.heights.delete(e.key);
            heightsChanged(this.heights);
            if (this.tr.heightAt && !this.moving) this.fire('move'); // overlays re-position onto the newly known ground (while moving, every frame does this anyway)
        } else if (e.type === 'tileLoaded') {
            // (A source id can hold "|" and "/"; the part after the last "|" is z/x/y.)
            const cut = e.key.lastIndexOf('|'), source = e.key.slice(0, cut), [z, x, y] = e.key.slice(cut + 1).split('/');
            if (!this.removed && this.rawStyle?.sources[source]) this.tileLoaded(source, +z, +x, +y);
        } else if (e.type === 'tile') {
            this.fire('tile', e); // (for the benchmark page, after `_tileReport`; #360)
        } else if (e.type === 'stats') {
            this.fire('stats', {fps: e.fps, frameMs: e.frameMs, labels: e.labels});
        } else if (e.type === 'resized') {
            this.buffer = [...e.buffer, performance.now() + 1000];
            this.fire('resize');
        } else if (e.type === 'result') {
            const p = this.pending.get(e.id);
            this.pending.delete(e.id);
            if (e.error) p?.reject(new Error(e.error)); else p?.resolve(e.value);
        } else if (e.type === 'imagemissing') {
            // A variant of an SVG template: the name has the values of the slots (see `buildTile`).
            // (Such a name is not a name of the style: the page hears nothing of it, also when the template is gone.)
            const [image, ...values] = e.name.split(VARIANT), template = this.templates.get(image);
            if (template || values.length) { if (template && values.length) this.addVariant(e.name, image, template, values); return; }
            // Give the resolver the first chance to supply the image; the event is for anything it leaves unresolved.
            Promise.resolve(this.imageResolver?.(e.name)).catch(error => this.fire('error', {error})).then(() => {
                if (!this.imageNames.has(e.name)) this.fire('styleimagemissing', {id: e.name});
            });
        }
        else if (e.type === 'error') this.fire('error', {error: new Error(e.message), ...e.source && {sourceId: e.source}});
    }

    // ---- events ----
    /**
     * Adds a listener for an event; `on(type, layerId, listener)` hears `click`, `mousemove`, `mouseenter` and
     * `mouseleave` over the features of a style layer. The event then has the features as `e.features`.
     * (The type of the result is `unknown`: the compat entry returns a `Subscription` instead of the map, #675.)
     */
    on(type: string, a: string | string[] | Listener, b?: Listener): unknown {
        const layers = this.layerArg(type, a, b);
        if (layers) this.layerListeners.push({type, layers, fn: b!}); else (this.listeners[type] ??= []).push(a as Listener);
        // The engine reports each frame only when a listener wants the `render` event: most pages do not.
        if (type === 'render' && !this.wantsFrames) { this.wantsFrames = true; this.post({type: 'frames', on: true}); }
        return this;
    }
    off(type: string, a: string | string[] | Listener, b?: Listener) {
        const layers = typeof a === 'string' ? [a] : Array.isArray(a) ? a : null, key = String(layers);
        if (layers) this.layerListeners = this.layerListeners.filter(l => !(l.type === type && String(l.layers) === key && l.fn === b));
        else this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== a);
        return this;
    }
    /** The layer ids of `on(type, layerIds, listener)` (one id or an array, as in MapLibre GL JS), or null for `on(type, listener)`. */
    private layerArg(type: string, a: unknown, b: unknown): string[] | null {
        const layers = typeof a === 'string' ? [a] : Array.isArray(a) && a.every(id => typeof id === 'string') ? a.slice() : null;
        if (layers ? typeof b !== 'function' : typeof a !== 'function') throw new TypeError(`[map-jr-gl] on("${type}"): ${layers ? 'the listener after the layer id is not a function' : 'the second argument is neither a layer id, an array of layer ids nor a listener'}.`);
        return layers;
    }
    private wantsFrames = false;

    // ---- requests ----
    private transformRequest: RequestTransform | null = null;
    /** Sets or removes the function that changes each request (for example, to add a header). */
    setTransformRequest(fn: RequestTransform | null) { this.transformRequest = fn; this.sendRequestRules(); return this; }
    /** Tells the engine which requests need a question to this thread. */
    private sendRequestRules = () => {
        const rules = this.requestRules();
        // (Nothing is sent to a map that has never had a rule: most maps have none.)
        if (rules.transform || rules.protocols.length || this.rulesSent) { this.rulesSent = true; this.post({type: 'requests', rules}); }
    };
    private rulesSent = false;
    private requestRules = () => ({transform: !!this.transformRequest, protocols: [...protocols.keys()]});
    /** What to do with one request: the transform first, then a custom protocol if the URL has one. */
    private async answer(url: string, kind: string, signal?: AbortSignal | null): Promise<RequestAnswer> {
        // (`RasterTile` is the kind of a `raster` or `raster-dem` tile on the way to this function only.)
        const image = kind === 'RasterTile' || kind === 'Image' || kind === 'SpriteImage';
        if (kind === 'RasterTile') kind = 'Tile';
        const t = this.transformRequest?.(url, kind as ResourceType), to = t?.url ?? url, protocol = protocols.get(to.slice(0, to.indexOf(':')));
        if (!protocol) return {url: to, headers: t?.headers, credentials: t?.credentials};
        // The protocol's controller is aborted when the request is no longer wanted (`signal`) or the map is removed.
        const ac = new AbortController(), stop = () => ac.abort();
        if (this.removed || signal?.aborted) stop();
        signal?.addEventListener('abort', stop);
        this.protocolAborts.add(ac);
        try {
            // An image tile, an image (`loadImage`, `addImage` by URL, an image source) and a sprite image have the type
            // `image` and the `accept` header of MapLibre GL JS (#603, #651). The protocol can answer with the bytes of the
            // file or with a decoded image, which is copied as bytes are: the copy can go to another thread. A vector tile,
            // a glyph range and a font file have the type `arrayBuffer`, as in MapLibre GL JS (#1675).
            const {data} = await protocol({url: to, type: image ? 'image' : kind === 'Tile' || kind === 'Glyphs' || kind === 'Font' ? 'arrayBuffer' : 'json', headers: image ? {...t?.headers, accept: 'image/webp,*/*'} : t?.headers}, ac);
            const out = image && (data instanceof ImageBitmap || data instanceof HTMLImageElement) ? await createImageBitmap(data) : toBytes(data);
            if (ac.signal.aborted) { (out as Partial<ImageBitmap>).close?.(); throw new Error(`[map-jr-gl] the request to ${to} was aborted.`); }
            return {data: out};
        } finally { this.protocolAborts.delete(ac); signal?.removeEventListener('abort', stop); }
    }
    /** The controllers of the protocol requests that run: `remove()` aborts them. */
    private protocolAborts = new Set<AbortController>();
    /** A `fetch` for requests that this thread makes itself (the style, its sources, GeoJSON data), with the timeout of `withTimeout`. */
    protected fetchAs = (kind: string) => withTimeout(fetchWith(() => ({transform: !!this.transformRequest, protocols: [...protocols.keys()]}), (url, k, signal) => this.answer(url, k, signal), kind));
    /** (For the control `styles()`, which loads the styles of its pictures as the map loads its style.) @internal */
    _fetch = (kind: string) => this.fetchAs(kind);
    protected layerListeners: {type: string; layers: string[]; fn: Listener}[] = [];
    /** The `mouseenter` and `mouseleave` listeners whose layers are under the pointer. */
    private hovered = new WeakSet<object>();
    private hoverBusy = false;

    private async dispatchLayerEvents(kind: 'click' | 'mousemove', data: Record<string, unknown>) {
        const point = data.point as {x: number; y: number};
        const wanted = kind === 'click' ? ['click'] : ['mousemove', 'mouseenter', 'mouseleave'];
        const listening = this.layerListeners.filter(l => wanted.includes(l.type)), layers = [...new Set(listening.flatMap(l => l.layers))];
        if (!layers.length || (kind === 'mousemove' && this.hoverBusy)) return;
        this.hoverBusy = kind === 'mousemove';
        try {
            // One query for all the layers that have listeners. The features have the form of queryRenderedFeatures.
            const found = await this.queryLayers(point, {layers});
            // A listener hears the features of any of its layers (as in MapLibre GL JS, which takes an array of ids too).
            for (const l of listening) {
                if (!this.layerListeners.includes(l)) continue; // (removed by a listener before it)
                const features = found.filter(f => l.layers.includes((f.layer as {id: string}).id)), hit = features.length > 0, {type} = l;
                if (type === 'mouseenter' || type === 'mouseleave') {
                    if (hit === this.hovered.has(l)) continue;
                    if (hit) this.hovered.add(l); else this.hovered.delete(l);
                    if (hit !== (type === 'mouseenter')) continue;
                } else if (!hit) continue;
                l.fn({type, target: this, ...data, features});
            }
        } finally { if (kind === 'mousemove') this.hoverBusy = false; }
    }
    once(type: string, fn: Listener) {
        const wrap: Listener = e => { this.off(type, wrap); fn(e); };
        // (Not `return this.on(…)`: the `on` of the compat entry returns a `Subscription`.)
        this.on(type, wrap);
        return this;
    }
    /** Only in this library: sets the CSS cursor over the map, such as `'pointer'` over something that the user can click. `''` restores the default. */
    setCursor(cursor: string) { this.canvas.style.cursor = cursor; return this; }
    /**
     * Calls the listeners of the event `type` with `data` as the event, as in MapLibre GL JS. Controls and plugins use it for their own events.
     * (A subclass that sends an event later returns a promise for that moment: the default action of the map waits for it.)
     */
    fire(type: string, data: Record<string, unknown> = {}): void | PromiseLike<unknown> {
        const list = this.listeners[type];
        if (type === 'error' && !list?.length) logError(data.error);
        // A listener that throws does not stop the listeners after it: its error is an `error` event.
        if (list) for (const fn of [...list]) try { fn(Object.defineProperties({type, target: this}, Object.getOwnPropertyDescriptors(data))); } catch (error) { if (type === 'error') logError(error); else this.fire('error', {error}); }
        // (A query that the removal of the map or the loss of the context rejects is not an error of the map.)
        if ((type === 'click' || type === 'mousemove') && this.layerListeners.length && data.point) this.dispatchLayerEvents(type, data).catch(error => this.removed || this.restarting || this.fire('error', {error}));
        // As in MapLibre GL JS, the pointer that leaves the canvas leaves the layers that it was over.
        if (type === 'mouseout') for (const l of [...this.layerListeners]) if ((l.type === 'mouseleave' || l.type === 'mouseenter') && this.hovered.delete(l) && l.type === 'mouseleave') l.fn({type: 'mouseleave', target: this, ...data, features: []});
    }

    // ---- camera ----
    /** Returns the map center. */
    getCenter() { return new LngLat(this.tr.lng, this.tr.lat); }
    /** Returns the zoom level. */
    getZoom() { return this.tr.zoom; }
    /** Returns the bearing in degrees clockwise from north. */
    getBearing() { return this.tr.bearing; }
    /** Returns the pitch in degrees from straight down. */
    getPitch() { return this.tr.pitch; }
    /** Returns the smallest zoom level that the user can reach. */
    getMinZoom() { return this.tr.minZoom; }
    /** Returns the largest zoom level that the user can reach. */
    getMaxZoom() { return this.tr.maxZoom; }
    /** Returns the element that holds the map. */
    getContainer() { return this.container; }
    /** Returns the canvas that the map draws on. */
    getCanvas() { return this.canvas; }
    /**
     * Only in this library: returns a promise of the map as an image. It waits until the map is idle, draws one frame and gives the canvas of that frame as a Blob
     * (`type` and `quality` as in `HTMLCanvasElement.toBlob`; the default is PNG). It works with both renderers: the
     * drawing buffer of the main renderer can be cleared after each frame, so the image is taken in the same task as the frame.
     */
    toBlob(type = 'image/png', quality?: number): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const gone = () => reject(new Error('[map-jr-gl] toBlob(): the map was removed before its image was taken.'));
            const shoot = () => {
                if (this.removed) return gone();
                // (The engine in a worker takes the image itself: WebKit gives blank pixels for the canvas of the page; #965.)
                if (this.renderer === 'worker') { this.off('remove', gone); return void this.ask<Blob>(id => ({type: 'snapshot', id, mime: type, quality})).then(resolve, e => this.removed ? gone() : reject(e)); }
                this.once('render', () => {
                    // (The engine reports frames only while a page listens to `render`.)
                    if (!this.listeners.render?.length) { this.wantsFrames = false; this.post({type: 'frames', on: false}); }
                    this.off('remove', gone);
                    this.canvas.toBlob(b => b ? resolve(b) : reject(new Error('[map-jr-gl] toBlob(): the browser could not encode the image as ' + type + '.')), type, quality);
                });
                this.triggerRepaint();
            };
            this.once('remove', gone);
            // (A video or canvas source that plays keeps the map from `idle`: the image then shows the frame of the moment,
            // also when the source starts to play while the image waits.)
            const playing = () => !!this.videos && this.videos.playing();
            if (this.loaded() || playing()) return shoot();
            const done = () => {
                this.off('idle', done); this.off('render', check);
                if (!this.listeners.render?.length) { this.wantsFrames = false; this.post({type: 'frames', on: false}); }
                // (After the other listeners of this `idle`: the repaint of `shoot` makes `loaded()` false; #1454.)
                queueMicrotask(shoot);
            }, check = () => { if (playing()) done(); };
            this.on('idle', done); this.on('render', check);
        });
    }
    /**
     * As in MapLibre: `false` from a call of `setStyle`, a style edit, a source change or a camera move until the next
     * complete frame (the frame that fires `idle`).
     */
    loaded() { return this.isLoaded && this.tilesLoaded && !this.styleLoading && this.restyled === this.restyles && !(this.videos && this.videos.playing()); }
    /** A `setStyle` whose style has not come yet. */
    private styleLoading = false;
    /** Whether the camera moves now, by the user or by a camera method. */
    isMoving() { return this.moving; }
    project(lngLat: LngLatLike) { const [x, y] = this.tr.project(...toLngLat(lngLat)); return {x, y}; }
    /** Converts a point of the screen, in CSS pixels from the top left corner of the map, to a position. */
    unproject(point: {x: number; y: number} | [number, number]) {
        const [x, y] = Array.isArray(point) ? point : [point.x, point.y];
        const [lng, lat] = this.tr.unproject(x, y, true);
        return new LngLat(lng, lat);
    }
    /** Only in this library: whether the far side of the globe hides a position from the camera. It is always `false` for Mercator. */
    isLocationOccluded(lngLat: LngLatLike) {
        const [lng, lat] = toLngLat(lngLat);
        return !!this.tr.globeness && this.tr.globe!.hidden(this.tr, mercX(lng), mercY(lat));
    }
    /** Returns the smallest box that contains the visible map. */
    getBounds() {
        // (On the globe: the edges of the screen and of the globe, and a pole in view; see `bounds` in globe.ts.)
        if (this.tr.globeness) return new LngLatBounds(this.tr.globe!.bounds(this.tr));
        // With 3D terrain, as in MapLibre GL JS: the top edge moves down to the horizon, and the corners are taken on the
        // plane of the map center, so that the far ground at the top of the screen is in the box (#898).
        const tr = this.tr, {width: w, height: h} = tr, top = tr.heightAt ? Math.max(0, h / 2 - tr.horizon()) : 0;
        const pts = [[0, top], [w, top], [0, h], [w, h]].map(([x, y]) => {
            if (!tr.heightAt) return tr.unproject(x, y);
            const [mx, my] = tr.screenToMerc(x, y, tr.flatZ, true);
            return [lngFromMerc(mx), latFromMerc(my)];
        });
        return new LngLatBounds([Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]);
    }
    jumpTo(o: CameraInput) {
        // Applied locally as well, so reads immediately after a write are correct even when the engine is in a worker.
        const padding = o.padding === undefined ? undefined : paddingOf(o.padding);
        if (padding) this.tr.padding = padding;
        this.tr.set(o.center, o.zoom, o.bearing, o.pitch);
        this.eased = undefined;
        this.post({type: 'jump', center: o.center && toLngLat(o.center), zoom: o.zoom, bearing: o.bearing, pitch: o.pitch, padding});
        this.jumped = this.seq;
        return this;
    }
    /**
     * `offset` ([x, y] or {x, y}, CSS pixels) puts `center` at that distance from the center of the view, as in
     * MapLibre GL JS. `easing` maps the time (0 to 1) to the progress (0 to 1); it is sampled into a table of 65
     * values, because a function cannot be sent to the engine's worker.
     */
    easeTo(o: CameraInput & {duration?: number; around?: [number, number]; offset?: PointLike; easing?: (t: number) => number}) {
        const fly = this.flight; this.flight = undefined;
        const {zoom, bearing, pitch, around} = o;
        let center = o.center;
        const padding = o.padding === undefined ? undefined : paddingOf(o.padding);
        if (o.offset) {
            const [ox, oy] = Array.isArray(o.offset) ? o.offset : [o.offset.x, o.offset.y];
            if (ox || oy) {
                // The view at the end, with the given center moved to the offset point (with bearing and pitch).
                const to = Object.assign(new Transform(), this.tr, padding && {padding});
                to.set(center, zoom, bearing, pitch);
                to.setLocationAt(to.lng, to.lat, to.cx + ox, to.cy + oy);
                center = [to.lng, to.lat];
            }
        }
        // A user who asked the system for less motion gets the new view at once (as in MapLibre GL JS, `essential: true`
        // keeps the animation).
        const still = !(o as {essential?: boolean}).essential && matchMedia('(prefers-reduced-motion: reduce)').matches;
        const duration = still ? 0 : o.duration ?? 500;
        // As in MapLibre GL JS, no duration is a jump, so reads right after the call see the new view.
        if (duration <= 0 && !around) return this.jumpTo({...o, center});
        const easing = o.easing && Array.from({length: 65}, (_, i) => o.easing!(i / 64));
        const c: Command = {type: 'ease', duration, center: center && toLngLat(center), zoom, bearing, pitch, around, padding, easing, fly};
        this.post(c);
        this.eased = {c, at: performance.now()};
        return this;
    }
    /**
     * Moves the camera along a curve that zooms out and back in, with the options of `flyTo` of MapLibre GL JS 6.17.
     * The defaults are `curve` 1.42 and `speed` 1.2, and without `duration` the duration follows from the distance.
     * The engine computes the curve, also in a worker, from these options.
     */
    flyTo(o: Parameters<Map['easeTo']>[0] & FlyOptions) {
        // (The options reach easeTo, also through the override of the compat entry, in this member.)
        this.flight = [o.curve ?? 1.42, o.speed ?? 1.2, o.screenSpeed ?? 0, o.minZoom ?? -99, o.maxDuration ?? 1e12, o.duration === undefined ? 1 : 0];
        return this.easeTo({...o, duration: o.duration ?? 1});
    }
    private flight?: number[];
    /** Stops the animation of the camera, where it is. */
    stop() { this.eased = undefined; this.post({type: 'stop'}); return this; }

    /**
     * The center and zoom that fit `bounds` ([west, south, east, north] or [[west, south], [east, north]]) in view at
     * `bearing` (degrees, default 0), as in MapLibre GL JS. `offset` ([x, y] or {x, y}, CSS pixels) moves the box by that much from the middle of the view.
     */
    cameraForBounds(bounds: LngLatBoundsInput, o: {padding?: PaddingInput; maxZoom?: number; bearing?: number; offset?: PointLike} = {}) {
        // The map's own padding already moves the center; padding given here is on top of it.
        const pad = sides(o.padding), own = this.tr.padding, bearing = o.bearing || 0, off = o.offset;
        return {...fitBox(LngLatBounds.convert(bounds).toArray().flat(), this.tr.width, this.tr.height, pad.map((v, i) => v + own[i]), pad, o.maxZoom ?? this.tr.maxZoom, bearing, off && (Array.isArray(off) ? off : [off.x, off.y])), bearing};
    }
    fitBounds(bounds: Parameters<Map['cameraForBounds']>[0], o: Parameters<Map['cameraForBounds']>[1] & {duration?: number} = {}) {
        return this.easeTo({...this.cameraForBounds(bounds, o), duration: o.duration ?? 800});
    }

    private limits(keep?: boolean) { this.post({type: 'limits', keep, minZoom: this.tr.minZoom, maxZoom: this.tr.maxZoom, maxPitch: this.tr.maxPitch, minPitch: this.tr.minPitch, maxBounds: this.tr.maxBounds, worldCopies: this.tr.worldCopies, aniso: this.tr.aniso}); return this; }
    /**
     * Sets whether copies of the world are drawn beside it, as in MapLibre GL JS. With `false`, the view stays inside
     * -180 to 180 degrees of longitude, no tiles of other copies are loaded or drawn, and markers and popups stay at the
     * longitude that they were given. As in MapLibre GL JS, the view does not move now: the next camera change keeps it inside.
     * @param copies `undefined` is `true` and `null` is `false`, as in MapLibre GL JS.
     */
    setRenderWorldCopies(copies?: boolean | null) {
        this.tr.worldCopies = copies ?? copies === undefined;
        return this.limits(true);
    }
    /** Returns whether copies of the world are drawn beside it. */
    getRenderWorldCopies() { return this.tr.worldCopies; }
    /**
     * Sets the smallest zoom level that the user can reach.
     * @param z The zoom level. `undefined` or `null` restores the default, -2.
     */
    setMinZoom(z?: number | null) { this.tr.minZoom = z ?? -2; return this.limits(); }
    /**
     * Sets the largest zoom level that the user can reach.
     * @param z The zoom level. `undefined` or `null` restores the default, 22.
     */
    setMaxZoom(z?: number | null) { this.tr.maxZoom = z ?? 22; return this.limits(); }
    declare private pitchWarned?: boolean;
    /**
     * Sets the largest pitch that the user can reach, in degrees. A value above 180 is limited to 180 and warns once.
     * Above 90 the camera looks up. While the map center is on the ground, the camera is then below the ground and sees
     * the map from below; give the center a height with `setCenterElevation` to keep the camera above the ground.
     * @param p The pitch. `undefined` or `null` restores the default, 60.
     */
    setMaxPitch(p?: number | null) { this.tr.maxPitch = this.pitchCap(p); return this.limits(); }
    private pitchCap(p?: number | null) {
        p ??= 60;
        if (p > MAX_PITCH && !this.pitchWarned && (this.pitchWarned = true)) console.warn(`[map-jr-gl] maxPitch ${p}: the pitch stops at ${MAX_PITCH}. Pass ${MAX_PITCH} or less.`);
        return Math.min(MAX_PITCH, p);
    }
    declare private centreHeld?: boolean;
    /**
     * Gives the map center a height of its own, in meters above sea level, or puts it back on the ground with `null` (the
     * default). The camera keeps its distance and its pitch from the center, so with a center high above the ground a
     * pitch above 90 looks up at the sky from above the ground. While the center has a height, it does not follow 3D terrain.
     * @param meters The height in meters, or `null` for the ground (3D terrain, or sea level without it).
     */
    setCenterElevation(meters: number | null) {
        if (meters !== null && !Number.isFinite(meters)) { console.warn(`[map-jr-gl] setCenterElevation(${meters}): the height is not a number. Pass a number of meters, or null to put the center on the ground.`); return this; }
        this.centreHeld = meters !== null;
        if (meters !== null || !this.tr.heightAt) this.tr.elevation = meters ?? 0;
        this.post({type: 'jump', elevation: meters});
        this.jumped = this.seq;
        return this;
    }
    /** Returns the height of the map center in meters: the height that `setCenterElevation` gave, or else the height of the ground there, multiplied by the exaggeration of 3D terrain (0 without 3D terrain). */
    getCenterElevation() { return this.tr.elevation; }
    /** Returns the largest pitch that the user can reach, in degrees. */
    getMaxPitch() { return this.tr.maxPitch; }
    /** Returns the smallest pitch that the user can reach, in degrees. */
    getMinPitch() { return this.tr.minPitch; }
    /**
     * Sets the smallest pitch that the user can reach, in degrees, from 0 to the largest pitch.
     * @param p The pitch. `undefined` or `null` restores the default, 0.
     */
    setMinPitch(p?: number | null) {
        p ??= 0;
        if (!(p >= 0 && p <= this.tr.maxPitch)) throw new Error(`[map-jr-gl] setMinPitch(${p}): the pitch must be between 0 and the largest pitch, ${this.tr.maxPitch}. Pass a value in that range, or raise the largest pitch with setMaxPitch first.`);
        this.tr.minPitch = p;
        return this.limits();
    }
    /** Keeps the map center inside a box (`[[west, south], [east, north]]`), or lifts the restriction with `null`. */
    setMaxBounds(bounds?: LngLatBoundsInput | null) {
        // The corners are kept as given (as MapLibre keeps them): a west edge east of the east edge crosses the antimeridian.
        const flat = bounds && (bounds instanceof LngLatBounds ? bounds.toArray().flat()
            : bounds.length === 4 ? bounds : [...LngLat.convert(bounds[0]).toArray(), ...LngLat.convert(bounds[1]).toArray()]);
        this.tr.maxBounds = flat ? [flat[0], flat[1], flat[2], flat[3]] : null;
        // The engine clamps its own camera when it gets the limits. This clamps the copy here, so that `getCenter()` is right at once.
        this.tr.constrain();
        return this.limits();
    }
    /** Returns the box that the map center stays in, or `null` when there is none. */
    getMaxBounds() { const b = this.tr.maxBounds; return b && {getWest: () => b[0], getSouth: () => b[1], getEast: () => b[2], getNorth: () => b[3], toArray: () => [[b[0], b[1]], [b[2], b[3]]]}; }
    /** Returns the ratio of device pixels to CSS pixels that the canvas uses. */
    getPixelRatio() { return this.dpr; }
    /** Returns the elevation of the ground at a position in meters, multiplied by the exaggeration as in MapLibre GL JS, or `null` without 3D terrain. */
    queryTerrainElevation(lngLat: LngLatLike): number | null {
        const [lng, lat] = toLngLat(lngLat);
        return this.tr.heightAt ? this.tr.heightAt(mercX(lng), mercY(lat)) : null;
    }
    /**
     * Whether the data of one source is loaded for the current view. As in MapLibre, an id that the style does not have
     * fires `error`, and the result is `undefined` then.
     */
    isSourceLoaded(id: string): boolean {
        if (!this.rawStyle?.sources[id]) { this.fire('error', {error: new Error(`There is no source with ID "${id}"`)}); return undefined!; }
        return !!this.resolved?.sources[id] && (this.tilesLoaded || this.loadedSources.has(id));
    }
    /** Loads the tiles of a source again, for example after the data behind its URL changed. */
    refreshTiles(sourceId: string) { this.unloaded(sourceId); this.post({type: 'refresh', source: sourceId}); return this; }
    /** The data of a source changed: the source is not loaded until the engine says so. */
    private unloaded(id: string) { this.loadedSources.delete(id); this.tilesLoaded = false; }
    /** Whether the style has loaded. */
    isStyleLoaded() { return this.ready; }
    /** Whether the tiles of the current view have loaded. */
    areTilesLoaded() { return this.tilesLoaded; }
    zoomIn() { return this.easeTo({zoom: this.tr.zoom + 1, duration: 300}); }
    zoomOut() { return this.easeTo({zoom: this.tr.zoom - 1, duration: 300}); }
    /** Draws the map again in the next frame. */
    triggerRepaint() { this.post({type: 'repaint'}); }

    /** Reads the size of the container again and resizes the map to it. Call it after a change of the size that the map does not see. */
    resize() {
        this.measure();
        this.post({type: 'resize', width: this.tr.width, height: this.tr.height, dpr: this.dpr});
        return this;
    }

    // ---- style ----
    private restyles = 0;
    /** The last change of the style that the engine has got (`restyles`: the last that the page asked for). */
    private restyled = 0;
    private newStyle = false;
    /** The new style came from `setStyle` without `diff`: its paint values do not transition (#960). */
    private instant = false;
    /** The events after the style changed. `style.load` is only for a whole new style (the first one, or `setStyle`). */
    /** The video and canvas sources (video.ts): loaded with the first style that has one, `0` while it loads. */
    private videos?: import('./video.ts').Videos | 0;
    private syncVideos() {
        if (this.videos) return this.videos.sync();
        if (this.videos === 0 || this.removed || !Object.values<any>(this.rawStyle?.sources ?? {}).some(s => s?.type === 'video' || s?.type === 'canvas')) return;
        this.videos = 0;
        import('./video.ts').then(m => {
            if (this.removed) return;
            (this.videos = new m.Videos(() => this.removed ? {} : this.rawStyle?.sources ?? {}, () => this.styleBase,
                (source, image) => this.ready ? this.post({type: 'frame', source, image}, [image]) : image.close(),
                error => this.fire('error', {error}), fn => this.editStyle(fn))).sync();
        }, error => this.fire('error', {error}));
    }
    private styleEvents(whole: boolean) {
        this.syncVideos();
        // (As in MapLibre, a whole new style puts its projection in place first, and that fires `projectiontransition`.)
        if (whole) this.fire('projectiontransition', {newProjection: projectionName(this.rawStyle?.projection?.type)});
        this.fire('styledata', {dataType: 'style'});
        this.fire('data', {dataType: 'style'});
        if (whole) this.fire('style.load');
    }
    /** After `reportTiles()`: a tile of the source has loaded (for a class that extends this one). */
    protected tileLoaded(_source: string, _z: number, _x: number, _y: number) {}
    /** @internal The bearing at which the inertia of a rotate drag ends (the compat entry snaps it north, #1834). */
    protected spinBearing(bearing: number) { return bearing; }
    private wantsTiles = false;
    /** Asks the engine to report each tile that loads (one message for each tile), for `tileLoaded`. */
    protected reportTiles() { if (!this.wantsTiles) { this.wantsTiles = true; this.post({type: 'tileLoads', on: true}); } }
    /** Called when the style has changed, before it is resolved (for a class that extends this one). */
    protected styleChanged() {}
    /** The buffer of a GeoJSON source that gives none, in pixels; `undefined` keeps the default of the tiles (16). */
    protected geojsonBuffer(): number | undefined { return undefined; }
    /** The `raster-fade-duration` of a raster layer that gives none, in ms: 0 here, so that a tile shows at once. */
    protected rasterFade() { return 0; }
    /** Whether tiles stay when they expire (see `refreshExpiredTiles` of the compat entry). */
    protected noExpiry() { return false; }
    private reloadPending = false;
    /** The next resolve of the style uses `resolved` as it is, without requests (see `restyle`). */
    private reuse = false;
    /** The layer types of the style that were last reported as unsupported, joined, so that each new set warns one time (#1594). */
    private unsupportedTold = '';
    private warnUnsupported(types: string[]) {
        const list = types.join(', ');
        if (list && list !== this.unsupportedTold) console.warn('[map-jr-gl] Skipping unsupported layer types: ' + list);
        this.unsupportedTold = list;
    }
    /**
     * `reuse`: the style has not changed, and the engine needs it again (a new engine after a fall back). It is used only
     * when no other change waits or is being resolved.
     */
    private restyle(reload: boolean, reuse = false) {
        this.reuse = reuse && this.restyled === this.restyles && (this.reuse || !this.restyleQueued);
        // As in MapLibre, the loading events come before the data events.
        for (const type of ['styledataloading', 'dataloading']) this.fire(type, {dataType: 'style'});
        this.styleChanged();
        // Two changes to the style in quick succession are resolved at the same time, and the first can finish last.
        // Only the newest result is used. It reloads the sources if one of the changes that it replaces asked for that.
        ++this.restyles;
        this.reloadPending ||= reload;
        // (The engine does not have this change yet: its reports of what is loaded are old from now on. See `seq`.)
        this.tilesLoaded = false; this.seq++;
        // The style is compared and resolved once for all the changes of one task (#8).
        if (this.restyleQueued) return;
        this.restyleQueued = true;
        queueMicrotask(() => { this.restyleQueued = false; if (this.rawStyle && !this.removed) this.resolveRestyle(); });
    }
    private restyleQueued = false;
    private resolveRestyle() {
        const turn = this.restyles;
        // A source whose rules changed is not loaded until the engine says so. The other sources keep their state.
        const texts: Record<string, string> = {}, was = this.sourceRules, versions: Record<string, number> = {};
        for (const l of this.rawStyle.layers ?? []) if (l.source) texts[l.source] = (texts[l.source] ?? '') + JSON.stringify(layerRules(l, this.toggled.has(l.id)));
        this.sourceRules = new globalThis.Map();
        for (const [id, src] of Object.entries<any>(this.rawStyle.sources ?? {})) {
            const old = was.get(id), text = JSON.stringify({...src, data: 0}) + texts[id], same = old?.text === text && old.data === src.data;
            this.sourceRules.set(id, {text, data: src.data, v: versions[id] = same ? old.v : ++this.sourceVersion});
            if (!same) this.loadedSources.delete(id);
        }
        // A change of a style that the map shows does not wait for a source that is new: the source comes later.
        const partial = this.newStyle || !this.resolved ? undefined : {late: () => { if (this.rawStyle) this.restyle(true); }, fail: this.sourceFailed};
        const reuse = this.reuse && this.resolved;
        this.reuse = false;
        Promise.all([reuse || resolveStyle(this.rawStyle, this.fetchAs('Source'), this.styleBase, partial, this.sourceFailed, this.geojsonBuffer()), this.globeReady()]).then(([style]) => {
            if (turn !== this.restyles) return;
            this.warnUnsupported(style.unsupported);
            const reload = this.reloadPending;
            this.reloadPending = false;
            if (Object.keys(this.globalState).length) style.state = {...style.state, ...this.globalState};
            // The data of a GeoJSON source goes to the engine only when it, or the options of the source, changed (#8).
            const sent = this.geoSent ??= geoOf(this.resolved), data: Record<string, unknown> = {}, sources: typeof style.sources = {};
            for (const name of [...sent.keys()]) if (style.sources[name]?.type !== 'geojson') sent.delete(name);
            for (const [name, src] of Object.entries(style.sources)) {
                if (src.type !== 'geojson') { sources[name] = src; continue; }
                const old = sent.get(name), key = JSON.stringify([src.options, src.maxzoom]);
                if (!old || old.data !== src.data || old.key !== key) {
                    data[name] = src.data; sent.set(name, {data: src.data, key});
                    // (This message carries the newest data of a `setData` that waits: it is not sent again. Data of a
                    // `setData` from before this change of the style waits behind an update in flight, and this data
                    // replaces it: sent later, it would draw over the newer data, #856.)
                    if (this.geoPending.get(name) === src.data || (this.geoTurns.get(name) ?? turn) < turn) this.geoPending.delete(name);
                }
                sources[name] = {...src, data: undefined};
            }
            this.resolved = style;
            this.restyled = turn;
            this.checkProjection();
            if (this.toggled.size) style.layers = style.layers.map(l => this.toggled.has(l.id) ? {...l, keep: true} : l);
            this.post({type: 'style', style: {...style, sources, rasterFade: this.rasterFade()}, reload, versions, data, instant: this.newStyle && this.instant});
            this.sendGeo();
            this.styleEvents(this.newStyle);
            this.newStyle = false;
        }, err => { this.fire('error', {error: err}); if (turn === this.restyles) { this.restyled = turn; this.sendGeo(); this.post({type: 'repaint'}); } });
    }
    /**
     * The globe (globe.ts) for `project`, `unproject` and the overlays on this thread, loaded with the first style that
     * draws a globe (#463). A map without a globe never loads it. (The engine has the same code built in.)
     */
    private globeReady(): Promise<unknown> {
        const stops = globeStops(this.rawStyle?.projection?.type);
        this.tr.globeStops = stops;
        if (!stops || this.tr.globe) return Promise.resolve();
        return import('./globe.ts').then(m => { if (!this.removed) this.tr.globe = m; }, error => this.fire('error', {error}));
    }
    private projectionWarned = new Set<string>();
    /** Warns once per map for a projection that the library does not draw (it draws Mercator). */
    private checkProjection() {
        const t = this.rawStyle?.projection?.type, said = this.projectionWarned;
        if (t === undefined || t === 'mercator' || globeStops(t) || said.has('name')) return;
        said.add('name');
        console.warn(`[map-jr-gl] The style has the projection ${JSON.stringify(t)}, which is not supported, so the map uses "mercator".`);
    }
    /**
     * Sets the projection of the style, as MapLibre GL JS does: `{type: 'globe'}`, `{type: 'mercator'}`, or `null` for
     * the default (Mercator). Fires `projectiontransition` when the name of the projection changes.
     */
    setProjection(projection?: ProjectionSpecification | null) {
        const name = projectionName(projection?.type);
        // (As in MapLibre, the same name gives no event and no new style; the object is kept for getProjection.)
        if (this.rawStyle && name === projectionName(this.rawStyle.projection?.type)) {
            if (projection) this.rawStyle.projection = projection; else delete this.rawStyle.projection;
            return this;
        }
        return this.editStyle(s => {
            const was = projectionName(s.projection?.type);
            if (projection) s.projection = projection; else delete s.projection;
            if (name !== was) this.fire('projectiontransition', {newProjection: name});
        });
    }
    /** The projection of the style as it was given (`undefined` when the style has none), as in MapLibre GL JS. */
    getProjection(): ProjectionSpecification | undefined { return this.rawStyle?.projection; }
    /** Runs a change to the style JSON now, or as soon as the style has been fetched. */
    protected editStyle(fn: (style: any) => void) {
        // As in MapLibre, a change that names a layer that does not exist gives an `error` event, not an exception.
        const run = () => { try { fn(this.rawStyle); return true; } catch (error) { this.fire('error', {error}); } };
        if (!this.rawStyle) this.beforeStyle.push(run); else if (run()) this.restyle(true);
        return this;
    }
    protected layerIndex(style: any, id: string) {
        const i = style.layers.findIndex((l: any) => l.id === id);
        if (i < 0) throw new Error(`Layer "${id}" does not exist`);
        return i;
    }
    getStyle() { return this.rawStyle ? plain(this.rawStyle) : undefined; }
    // ---- feature state ----
    private featureStates: Record<string, Record<string, Record<string, unknown>>> = {};
    private warnedTextId = false;
    /** Sends the states of the features in `keys` that changed; `null` for a feature that has no state any more. */
    private sendFeatureState(source: string, keys: string[]) {
        const states = this.featureStates[source], diff: Record<string, Record<string, unknown> | null> = {};
        for (const k of keys) diff[k] = states[k] ?? null;
        if (keys.length) this.post({type: 'featureState', source, states: diff});
        return this;
    }
    /**
     * Merges `state` into a feature's state, which `feature-state` expressions in paint properties read (hover and
     * selection highlights). The feature needs an `id`. Tiles showing the source are rebuilt in the background.
     */
    setFeatureState(feature: {source: string; sourceLayer?: string; id: number | string}, state: Record<string, unknown>) {
        // A string of digits gives the same key as the number, so only other text has no effect (unless `promoteId` gives the ids).
        const raw = this.rawStyle?.sources[feature.source];
        if (typeof feature.id === 'string' && !this.warnedTextId && isNaN(+feature.id) && /^(vector|raster)/.test(raw?.type) && raw?.promoteId == null) {
            this.warnedTextId = true;
            console.warn(`[map-jr-gl] setFeatureState(): the source "${feature.source}" is not GeoJSON, and the id "${feature.id}" is a string. Feature state on a vector source needs the numeric id of the feature in the tile, or "promoteId" on the source.`);
        }
        const states = this.featureStates[feature.source] ??= {}, key = `${feature.sourceLayer ?? ''}|${feature.id}`;
        states[key] = {...states[key], ...state};
        return this.sendFeatureState(feature.source, [key]);
    }
    getFeatureState(feature: {source: string; sourceLayer?: string; id: number | string}): Record<string, unknown> {
        return {...this.featureStates[feature.source]?.[`${feature.sourceLayer ?? ''}|${feature.id}`]};
    }
    /** Removes one key of a feature's state, a feature's whole state (no `key`), or all state of a source (no `id`). */
    removeFeatureState(target: {source: string; sourceLayer?: string; id?: number | string}, key?: string) {
        const states = this.featureStates[target.source];
        if (!states) return this;
        const prefix = `${target.sourceLayer ?? ''}|`, changed: string[] = [];
        for (const k of Object.keys(states)) {
            if (target.id !== undefined ? k !== prefix + target.id : target.sourceLayer !== undefined && !k.startsWith(prefix)) continue;
            changed.push(k);
            if (key !== undefined && target.id !== undefined) states[k] = {...states[k]}, delete states[k][key]; else delete states[k];
        }
        // (Without an id, many features can change: the page sends the states that remain instead.)
        if (target.id === undefined) { this.post({type: 'featureState', source: target.source, states, replace: true}); return this; }
        return this.sendFeatureState(target.source, changed);
    }

    /** The values `global-state` expressions read: the style's `state` defaults with anything set since. */
    getGlobalState(): Record<string, unknown> { return {...this.resolved?.state, ...this.globalState}; }
    /** Sets one global state value (`null` or `undefined` returns it to the style's default); layers that read it update. */
    setGlobalStateProperty(name: string, value: unknown) {
        if (value === null || value === undefined) delete this.globalState[name]; else this.globalState[name] = value;
        return this.editStyle(() => {});
    }
    /** Turns 3D terrain on (`{source, exaggeration}`, naming a raster-dem source) or off (`null`). */
    setTerrain(terrain: {source: string; exaggeration?: number} | null) {
        // (Without terrain the positions on this thread are flat at once, before the engine answers.)
        if (!terrain) { this.tr.heightAt = undefined; if (!this.centreHeld) this.tr.elevation = 0; }
        return this.editStyle(s => { if (terrain) s.terrain = terrain; else delete s.terrain; this.fire('terrain', {terrain}); });
    }
    /** Returns the `terrain` of the style, or `null` when the map has no 3D terrain. */
    getTerrain(): {source: string; exaggeration?: number} | null { return this.rawStyle?.terrain ?? null; }
    /** Sets the light on buildings: its anchor, position (distance, azimuth, polar angle), color and intensity. */
    setLight(light: {anchor?: 'map' | 'viewport'; position?: [number, number, number]; color?: string; intensity?: number}) {
        return this.editStyle(s => { s.light = {...s.light, ...light}; });
    }
    /** Sets the sky above the horizon and the fog on 3D terrain (the `sky` of the style); `null` removes them. */
    setSky(sky?: Record<string, unknown> | null) {
        // As in MapLibre GL JS, removing a sky leaves `sky: null` in the style, and removing none changes nothing.
        return this.editStyle(s => { if (sky) s.sky = {...sky}; else if (s.sky !== undefined) s.sky = null; });
    }
    /** The `sky` of the style: `undefined` when the style has none, and `null` after `setSky(null)` removed it. */
    getSky(): Record<string, unknown> | null | undefined { return this.rawStyle?.sky; }
    /** A source or a style that cannot be used: the map reports it, and draws the rest of the style or keeps its style. */
    private sourceFailed = (error: unknown) => { const sourceId = (error as {sourceId?: string})?.sourceId; this.fire('error', {error, ...sourceId && {sourceId}}); };
    /**
     * The JSON of a style: a copy of an object, or the answer of a URL. A style comes from another party: one without a
     * list of layers is an error here, before the map and the engine read the layers (#539).
     */
    private async loadStyle(style: unknown) {
        let made: any;
        if (typeof style !== 'string') made = plain(style);
        else {
            const res = await this.fetchAs('Style')(style);
            if (!res.ok) throw new Error(`[map-jr-gl] Style ${style}: HTTP ${res.status}`);
            made = await res.json();
        }
        if (!Array.isArray(made?.layers)) throw new Error('[map-jr-gl] The style has no list "layers". Give a style object with "version", "sources" and "layers", or its URL.');
        return made;
    }
    /** `transformStyle` gets the style before and the new style, and returns the style to use (as in MapLibre). */
    async setStyle(style: unknown, options?: {transformStyle?: StyleChange, diff?: boolean}) {
        const turn = ++this.styleTurn;
        // Before the first style has come, the new style takes its place.
        if (!this.rawStyle) { this.options.style = style; this.firstChange = options?.transformStyle; return this.starting ? undefined : this.start().catch(this.sourceFailed); }
        // (A style that cannot be loaded is an `error` event, as a failure of the first style is. The map keeps its style.)
        let next: any;
        this.styleLoading = true;
        try { next = await this.loadStyle(style); } catch (error) { if (turn === this.styleTurn) { this.styleLoading = false; this.fire('error', {error}); this.post({type: 'repaint'}); } return; }
        // (A style that was asked for later has replaced this one.)
        if (turn !== this.styleTurn) return;
        // (An `idle` of the engine was dropped while the style loaded, and a style that changes nothing below sends no command: a repaint brings `idle` again.)
        this.styleLoading = false; this.post({type: 'repaint'});
        this.styleBase = typeof style === 'string' ? new URL(style, location.href).href : location.href;
        next = deref(options?.transformStyle?.(this.rawStyle, next) ?? next);
        // (With `diff`, as in MapLibre GL JS 6.17: a style that differs from this one only in the camera changes nothing
        // and fires no event. Any other style fires `style.load`.)
        if (options?.diff && sameStyle(this.rawStyle, next)) return;
        // (With `diff`, a source that is equal to the one before keeps its object, so that its data, or the failure of its
        // request, is not fetched again, as in MapLibre (#809).)
        if (options?.diff) for (const [id, src] of Object.entries<any>(next.sources ?? {})) { const old = this.rawStyle.sources?.[id]; if (old && equal(old, src)) next.sources[id] = old; }
        this.rawStyle = next;
        this.newStyle = true;
        this.instant = !options?.diff;
        this.restyle(true);
    }
    /** Returns the style layer with this id as an object of the style specification (`id`, `type`, `paint`, `layout` and the others), or `undefined`. */
    getLayer(id: string) { return this.rawStyle?.layers.find((l: any) => l.id === id); }
    /** The source's specification. GeoJSON sources also get MapLibre's `setData(data)` to replace their contents. */
    getSource(id: string) {
        const spec = this.rawStyle?.sources[id];
        // An image source can get another image or other corners, as in MapLibre.
        // (A video or canvas source has its methods once the code of these sources has loaded.)
        if ((spec?.type === 'video' || spec?.type === 'canvas') && this.videos) return this.videos.source(id, spec);
        if (spec?.type === 'image') return {...spec, id, updateImage: (o: {url?: string; coordinates?: unknown}) => this.editStyle(() => { Object.assign(spec, o); }), setCoordinates: (coordinates: unknown) => this.editStyle(() => { spec.coordinates = coordinates; })};
        if (!spec || spec.type !== 'geojson') return spec;
        const clusters = async () => {
            const index = (await this.clusterIndex(id)).clusters;
            if (!index) throw new Error(`Source "${id}" has no clusters.`);
            return index;
        };
        return {
            ...spec, id, setData: (data: unknown) => this.setGeoJSON(id, data),
            // (A URL: the answer that the map keeps for the source, and a request only when it has none for this URL.)
            // (The source object of the map now: `setData` can have replaced it with a copy, #857.)
            getData: async () => {
                const now = this.rawStyle?.sources[id] ?? spec;
                if (typeof now.data !== 'string') return now.data;
                const url = absolute(now.data, this.styleBase);
                return kept(now, url) ?? (await this.fetchAs('Source')(url)).json();
            },
            updateData: (diff: GeoJSONDiff) => this.updateGeoJSON(id, diff),
            // The cluster methods give promises, as in MapLibre. The page makes its own copy of the cluster index for them.
            getClusterExpansionZoom: async (clusterId: number) => (await clusters()).expansionZoom(clusterId),
            getClusterChildren: async (clusterId: number) => (await clusters()).children(clusterId),
            getClusterLeaves: async (clusterId: number, limit?: number, offset?: number) => (await clusters()).leaves(clusterId, limit, offset),
        };
    }
    private clusterIndexes = new globalThis.Map<string, {data: unknown; key: string; index: Promise<PreparedSource>}>();
    private clusterIndex(id: string): Promise<PreparedSource> {
        const spec = this.rawStyle.sources[id], known = this.clusterIndexes.get(id);
        // (The cluster options are part of the key: the compat entry can change them with `setClusterOptions`.)
        const key = '' + [spec.cluster, spec.clusterRadius, spec.clusterMaxZoom];
        if (known && known.data === spec.data && known.key === key) return known.index;
        const index = (async () => {
            const data = typeof spec.data === 'string' ? await (await this.fetchAs('Source')(absolute(spec.data, this.styleBase))).json() : spec.data;
            // Loaded only when a page asks about clusters, so that the page script stays small.
            const {prepareSource} = await import('./geojson.ts');
            return prepareSource(data, spec, spec.maxzoom ?? 18);
        })();
        this.clusterIndexes.set(id, {data: spec.data, key, index});
        return index;
    }
    /**
     * MapLibre's `updateData`: adds, removes and changes features of a GeoJSON source by their id (the `id` of the
     * feature, or the property that `promoteId` names). The new data replaces the old in one step.
     */
    private updateGeoJSON(id: string, diff: GeoJSONDiff): Promise<void> {
        const raw = this.rawStyle.sources[id], data = raw.data, call = this.dataCalls.get(id) ?? 0;
        if (typeof data !== 'string') return this.setGeoJSON(id, applyDiff(data, diff, raw.promoteId));
        // (A URL: the diffs that arrive while it loads are applied in order to the one answer. A newer `setData`, or
        // the removal of the source, drops them.)
        const queued = this.diffQueues.get(id);
        if (queued?.call === call && queued.raw === raw) { queued.diffs.push(diff); return queued.p; }
        const q = {call, raw, diffs: [diff], p: undefined as unknown as Promise<void>, ac: new AbortController()};
        q.p = this.fetchAs('Source')(absolute(data, this.styleBase), {signal: q.ac.signal}).then(r => r.json()).then(d => {
            if (this.diffQueues.get(id) === q) this.diffQueues.delete(id);
            if (this.rawStyle?.sources[id] !== raw || this.dataCalls.get(id) !== call) return;
            return this.setGeoJSON(id, q.diffs.reduce((d, f) => applyDiff(d, f, raw.promoteId), d));
        }, e => { if (!q.ac.signal.aborted && !this.removed) throw e; });
        this.diffQueues.set(id, q);
        return q.p;
    }
    /** The diffs of `updateData` that wait for the URL of a GeoJSON source, with the call number they started from. */
    private diffQueues = new globalThis.Map<string, {call: number, raw: object, diffs: GeoJSONDiff[], p: Promise<void>, ac: AbortController}>();
    /** The number of the newest call that set the data of each GeoJSON source: an answer for an older call is dropped. */
    private dataCalls = new globalThis.Map<string, number>();
    /** The request of the newest `setData` with a URL of each GeoJSON source, while it loads. */
    private dataAborts = new globalThis.Map<string, AbortController>();
    /** The source objects that the map copied from the description and may change (#857). */
    private ownSources = new WeakSet<object>();
    /** Fires `sourcedata` and `data` when a source has loaded. (The compat entry fires MapLibre's `sourceDataType` events before them.) */
    protected loadedEvents(id: string) {
        for (const type of ['sourcedata', 'data']) this.fire(type, {dataType: 'source', sourceId: id, isSourceLoaded: true, source: this.rawStyle.sources[id]});
    }
    private async setGeoJSON(id: string, data: unknown) {
        const call = (this.dataCalls.get(id) ?? 0) + 1;
        this.dataCalls.set(id, call);
        // (A copy: the source object can be the application's own, from the description, and the map does not change it (#857).)
        // (Copied once: later calls write into the map's copy, so that requests keyed by the source object stay valid.)
        let src = this.rawStyle.sources[id];
        if (!this.ownSources.has(src)) this.ownSources.add(src = this.rawStyle.sources[id] = {...src});
        src.data = data;
        this.unloaded(id);
        for (const type of ['sourcedataloading', 'dataloading']) this.fire(type, {dataType: 'source', sourceId: id, isSourceLoaded: false, source: src});
        // A request of an older call is no longer wanted: it is aborted.
        this.dataAborts.get(id)?.abort();
        this.dataAborts.delete(id);
        // (The fetch of `updateData` for an older call is dropped too. Its promise resolves without a change.)
        const queued = this.diffQueues.get(id);
        if (queued && queued.call < call) { queued.ac.abort(); this.diffQueues.delete(id); }
        if (typeof data === 'string') {
            const raw = this.rawStyle.sources[id], url = absolute(data, this.styleBase), ac = new AbortController();
            this.dataAborts.set(id, ac);
            try { data = await (await this.fetchAs('Source')(url, {signal: ac.signal})).json(); } catch (e) { if (ac.signal.aborted || this.removed) return; throw e; }
            if (this.dataAborts.get(id) === ac) this.dataAborts.delete(id);
            // (The source was removed, or its data was set again since, also to the same URL: this answer is old.)
            if (this.rawStyle?.sources[id] !== raw || this.dataCalls.get(id) !== call) return;
            // A later change of the style sends the data of the source again: it must be this data, not the first answer.
            keep(raw, url, data);
        }
        // (Calls in the same task send only the last data of each source: the tile workers index it once.)
        // (While a change of the style is on its way, the engine may not know the source yet, and that change carries
        // older data: the data waits and is sent after that change.)
        if (!this.geoQueued) { this.geoQueued = true; queueMicrotask(() => { this.geoQueued = false; if (this.restyled === this.restyles) this.sendGeo(); }); }
        this.geoPending.set(id, data);
        this.geoTurns.set(id, this.restyles);
    }
    private sendGeo() {
        const sent = this.geoSent ??= geoOf(this.resolved);
        // (Data from `setData` is always sent, also the same object again: it can have changed in place.)
        // One update of each source is on its way to the tile workers at a time, and a newer one replaces the one that
        // waits, as in MapLibre GL JS. Without this, a page that sets data in each frame fills the queue of a worker
        // engine with copies of the data, and the engine draws no frame until the updates stop (#856).
        for (const [source, d] of this.geoPending) {
            if (this.geoBusy.has(source)) continue;
            this.geoPending.delete(source);
            if (!this.rawStyle?.sources[source]) continue;
            this.geoBusy.add(source);
            this.post({type: 'geojson', source, data: d});
            const old = sent.get(source), src = this.resolved?.sources[source];
            if (old) old.data = d;
            // (A new engine, after a fall back or a restart, starts with `resolved`: it must have this data; #852.)
            if (src?.type === 'geojson') this.resolved.sources[source] = {...src, data: d};
        }
    }
    /**
     * The data of each GeoJSON source that the engine has, and its options as text. `undefined`: as in `resolved` (the
     * style that a new engine starts with; `resend` sets it so).
     */
    private geoSent?: globalThis.Map<string, {data: unknown, key: string}>;
    /** The newest data of each GeoJSON source that waits to be sent to the engine at the end of the task. */
    private geoPending = new globalThis.Map<string, unknown>();
    /** The GeoJSON sources whose last data the engine has not yet indexed (see `geojsonDone`). */
    private geoBusy = new Set<string>();
    private geoQueued = false;
    /** The change of the style (`restyles`) at the time of the `setData` that waits in `geoPending`, for each source. */
    private geoTurns = new globalThis.Map<string, number>();
    // (A copy of the description: the map keeps the network result of a source by this object, and another map that is
    // given the same object must have its own. The data of a GeoJSON source is not copied.)
    addSource(id: string, source: object) { return this.editStyle(s => { s.sources[id] = {...source}; }); }
    removeSource(id: string) { return this.editStyle(s => { delete s.sources[id]; }); }
    addLayer(layer: {id: string}, beforeId?: string) {
        return this.editStyle(s => { s.layers.splice(beforeId ? this.layerIndex(s, beforeId) : s.layers.length, 0, layer); });
    }
    removeLayer(id: string) { return this.editStyle(s => { s.layers.splice(this.layerIndex(s, id), 1); }); }
    /** Changes the zooms at which a layer is drawn, without a new style. `undefined` or `null` removes the bound. */
    setLayerZoomRange(id: string, minzoom?: number | null, maxzoom?: number | null) {
        return this.editStyle(s => {
            const l = s.layers[this.layerIndex(s, id)];
            if (minzoom == null) delete l.minzoom; else l.minzoom = minzoom;
            if (maxzoom == null) delete l.maxzoom; else l.maxzoom = maxzoom;
        });
    }

    private setProp(group: 'paint' | 'layout', layerId: string, name: string, value: unknown) {
        // (The engine works out whether this needs tiles rebuilt: per-feature values are baked into their buffers.)
        return this.editStyle(s => { (s.layers[this.layerIndex(s, layerId)][group] ??= {})[name] = value; });
    }
    /** Sets the value of a paint property of a style layer. */
    setPaintProperty(layerId: string, name: string, value: unknown) { return this.setProp('paint', layerId, name, value); }
    /** Sets the value of a layout property of a style layer. */
    setLayoutProperty(layerId: string, name: string, value: unknown) {
        if (name === 'visibility') this.toggled.add(layerId);
        return this.setProp('layout', layerId, name, value);
    }
    /** The layers that the page has hidden or shown. Their tiles are built also while they are hidden: the next change is at once. */
    private toggled = new Set<string>();
    /** The layers that the engine hides after the last style, as it reported them (#1032). */
    private hidden = new Set<string>();
    /** Sets the filter of a style layer. */
    setFilter(layerId: string, filter: unknown) { return this.editStyle(s => { s.layers[this.layerIndex(s, layerId)].filter = filter; }); }

    /**
     * Adds the style sheet of the container, the controls and the message of `cannotShow` to the root node of the
     * container, once for each root: the document, or the shadow root of a map inside one (#47). A container that is
     * not in a document yet gets it in the page, and again in its root when it is attached (the resize observer).
     */
    private styles() {
        const node = this.container.getRootNode() as Document | ShadowRoot;
        const root = node.nodeType === 9 || (node as ShadowRoot).host ? node : document;
        const doc = root.ownerDocument ?? root as Document;
        // A constructed style sheet is not subject to `style-src`. One sheet serves each root of its document.
        if (root.adoptedStyleSheets) try {
            let sheet = sheets.get(doc);
            if (!sheet) { sheet = new doc.defaultView!.CSSStyleSheet(); sheet.replaceSync(CONTROL_CSS); sheets.set(doc, sheet); }
            if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
            return;
        } catch { /* a browser without constructable style sheets uses a <style> element */ }
        if (!root.getElementById('map-jr-control-css')) {
            const el = Object.assign(doc.createElement('style'), {id: 'map-jr-control-css', textContent: CONTROL_CSS});
            if (this.options.nonce) el.nonce = this.options.nonce;
            ((root as Document).head ?? root).appendChild(el);
        }
    }

    // ---- controls ----
    private corners: Partial<Record<ControlPosition, HTMLElement>> = {};
    private controls = new globalThis.Map<Control, HTMLElement>();
    addControl(control: Control, position?: ControlPosition) {
        const pos = position ?? control.getDefaultPosition?.() ?? 'top-right';
        const corner = this.corners[pos];
        if (!corner) throw new Error(`[map-jr-gl] addControl(): "${pos}" is not a position. Write "top-left", "top-right", "bottom-left" or "bottom-right".`);
        const el = control.onAdd(this);
        adoptClasses(el); // a control written for MapLibre GL JS gets this library's styles
        this.controls.set(control, el);
        corner.appendChild(el);
        return this;
    }
    /** Removes a control that `addControl` added. */
    removeControl(control: Control) {
        if (this.controls.delete(control)) control.onRemove(this);
        return this;
    }
    /** Whether the map has this control. */
    hasControl(control: Control) { return this.controls.has(control); }

    // ---- fonts and images ----
    /** Only in this library: loads more web fonts for labels after the map is created. See the option `fonts`. */
    addFonts(fonts: FontSource[]) { this.fontsAdded.push(...fonts); this.post({type: 'fonts', fonts}); return this; }
    /** What `addFonts` was given: a new engine gets it again. */
    private fontsAdded: FontSource[] = [];

    /**
     * Makes an image available to `icon-image` under `name`, and returns a promise of the map; MapLibre GL JS returns the map. `source` may be an SVG document (rasterized at the
     * screen's pixel density, so it stays sharp), an image URL, or anything drawable such as an ImageBitmap or canvas.
     * `width`/`height` are the display size in CSS pixels; they default to the image's natural size.
     *
     * An SVG document with slots (`{{name}}`) is a template. It is drawn one time for each different set of values that
     * the features of a layer give its slots: see "images" in docs/reference/description.md.
     */
    addImage(name: string, source: string | CanvasImageSource | ImageData | {width: number; height: number; data: Uint8Array | Uint8ClampedArray}, options: ImageOptions = {}) { return this.putImage(name, source, options); }
    /** `variant`: the image is one variant of a template. It is not an image that the page added, and it is not looked at for slots. */
    private async putImage(name: string, source: Parameters<Map['addImage']>[1], options: ImageOptions, variant?: boolean, update?: boolean): Promise<this> {
        if (!update) this.sendUpdates();
        let drawable: CanvasImageSource | undefined, width = options.width, height = options.height, sourceWidth = 0, w = 0, h = 0;
        const turn = this.imageTurn(name);
        if (!variant) {
            const slots = typeof source === 'string' && source.trimStart().startsWith('<') ? templateSlots(source) : [], before = this.templates.get(name);
            if (slots.length) {
                this.templates.set(name, {svg: source as string, options, slots, count: 0});
                this.imageNames.add(name);
                this.imageInputs.set(name, [source, options]);
                this.sendTemplates(name, String(before?.slots) !== String(slots));
                return this;
            }
            if (this.templates.delete(name)) this.sendTemplates(name, true);
        }
        if (typeof source === 'string') {
            const img = new Image();
            let pic: HTMLImageElement | ImageBitmap = img;
            if (source.trimStart().startsWith('<')) {
                const [w, h] = svgSize(source);
                width ??= w; height ??= h;
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sizedSVG(source, width, height));
            } else {
                // (The request goes through `transformRequest` and the protocols with the kind `Image`, as in MapLibre GL JS.
                // A protocol can answer with a decoded image, #651.)
                const a = await this.answer(source, 'Image');
                if (a.data instanceof ImageBitmap) pic = a.data;
                else {
                    img.crossOrigin = a.credentials === 'include' ? 'use-credentials' : 'anonymous';
                    img.src = a.data ? URL.createObjectURL(new Blob([a.data])) : a.url!;
                }
            }
            if (pic === img) try { await img.decode(); } finally { if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); }
            // (While the image loaded, the map was removed, or the name got another image or was removed.)
            if (this.removed || this.imageTurns.get(name) !== turn) return this;
            sourceWidth = pic === img ? img.naturalWidth : pic.width;
            width ??= sourceWidth / (options.pixelRatio ?? 1); height ??= (pic === img ? img.naturalHeight : pic.height) / (options.pixelRatio ?? 1);
            drawable = pic;
        } else if ('data' in source) {
            if (typeof (source.data as {length?: unknown})?.length !== 'number') throw new Error(`[map-jr-gl] addImage("${name}"): images that draw themselves with WebGL (renderWithWebGL) are not supported. Pass pixels, a canvas, an image or SVG text.`);
            // Raw pixels, as MapLibre accepts (ImageData or {width, height, data}). They are stored at their own size, as in
            // MapLibre GL JS, and premultiplied directly below: scaling them to the screen adds no detail, and at a pixel
            // ratio of 3 it sent 9 times the bytes for each updateImage (#979). Pixels whose length is not width × height × 4
            // go through ImageData, which throws an error that names the lengths.
            sourceWidth = source.width;
            width ??= source.width / (options.pixelRatio ?? 1); height ??= source.height / (options.pixelRatio ?? 1);
            if (source.data.length === source.width * source.height * 4) { w = source.width; h = source.height; } else {
                const canvas = this.scratch[1] ??= document.createElement('canvas');
                canvas.width = source.width; canvas.height = source.height;
                canvas.getContext('2d', {willReadFrequently: true})!.putImageData(new ImageData(new Uint8ClampedArray(source.data), source.width, source.height), 0, 0);
                drawable = canvas;
            }
        } else {
            drawable = source;
            sourceWidth = (source as ImageBitmap).width as number;
            width ??= sourceWidth / (options.pixelRatio ?? 1); height ??= (source as ImageBitmap).height as number / (options.pixelRatio ?? 1);
        }
        if (!w) { w = Math.ceil(width * this.dpr); h = Math.ceil(height * this.dpr); }
        const data = drawable ? pixels(this.scratch[0] ??= document.createElement('canvas'), drawable, w, h) : premultiply((source as {data: ArrayLike<number>}).data);
        // Stretch ranges and the content box are given in the source image's pixels; the stored copy may be another size.
        const k = sourceWidth ? w / sourceWidth : 1, scale = (v?: number[]) => v?.map(n => n * k);
        if (!variant) { this.imageNames.add(name); this.imageInputs.set(name, [source, options]); }
        this.post({type: 'image', name, w, h, width, height, data, stretchX: options.stretchX?.map(r => scale(r) as [number, number]), stretchY: options.stretchY?.map(r => scale(r) as [number, number]),
            content: scale(options.content) as [number, number, number, number] | undefined, textFitWidth: options.textFitWidth, textFitHeight: options.textFitHeight, sdf: options.sdf, update}, [data.buffer]);
        return this;
    }
    /** Removes an image that `addImage` added. */
    removeImage(name: string) {
        this.sendUpdates();
        this.imageTurn(name); this.imageNames.delete(name); this.imageInputs.delete(name);
        if (this.templates.delete(name)) this.sendTemplates(name, true);
        this.post({type: 'removeImage', name});
        return this;
    }
    /**
     * Replaces the pixels of an image added earlier, keeps its options (stretch, content, sdf) and returns a promise of the map; MapLibre GL JS returns the map. As MapLibre GL JS
     * does. When the new pixels have the size of the old ones, they are copied into the texture in place and the map
     * redraws without placing its icons again. Another size replaces the image as `addImage` would. (#949)
     * Pixels and drawables go to the map at the end of the task: of several calls in one task, only the last is sent (#979).
     */
    updateImage(name: string, source: Parameters<Map['addImage']>[1]) {
        if (!this.imageNames.has(name)) throw new Error(`There is no image with ID "${name}"`);
        if (this.templates.has(name) || typeof source === 'string' && source.trimStart().startsWith('<') && templateSlots(source).length) return this.removeImage(name).addImage(name, source, this.imageInputs.get(name)?.[1]);
        // Pixels and drawables wait for the end of the task: of several calls in one task, only the last is scaled,
        // premultiplied and sent (#979). Any other command sends them first, so the order stays.
        if (typeof source === 'string' || 'data' in source && typeof (source.data as {length?: unknown})?.length !== 'number') return this.putImage(name, source, this.imageInputs.get(name)?.[1] ?? {}, false, true);
        if (!this.updates.size) queueMicrotask(() => this.sendUpdates());
        this.updates.set(name, source);
        return Promise.resolve(this);
    }
    /** The sources that `updateImage` got in this task, by image name (see `updateImage`). */
    private updates = new globalThis.Map<string, Parameters<Map['addImage']>[1]>();
    /** Two canvases that scale images: one holds raw pixels, and the other draws at the stored size. */
    private scratch: HTMLCanvasElement[] = [];
    private sendUpdates() {
        if (!this.updates.size) return;
        const list = [...this.updates];
        this.updates.clear();
        for (const [name, source] of list) if (!this.removed && this.imageNames.has(name)) this.putImage(name, source, this.imageInputs.get(name)?.[1] ?? {}, false, true);
    }
    /** Whether the map has an image with this name. */
    hasImage(name: string) { return this.imageNames.has(name); }
    /**
     * Sets a function that supplies images on demand, as in MapLibre GL JS. When a style asks for an `icon-image` nothing provides, the resolver is called with
     * its name and may call `addImage` (it can be async). This is how generated icons such as highway shields work:
     * encode what to draw in the name, and build the SVG for it here.
     */
    setMissingStyleImageResolver(resolver: ((id: string) => void | Promise<void>) | null) { this.imageResolver = resolver; return this; }

    // ---- queries ----
    /** (`then` makes the result from the answer. The promise that the caller gets is kept, so that `drop` can find it.) */
    protected ask<T, R = T>(command: (id: number) => Command, then?: (answer: T) => R): Promise<R> {
        const id = this.nextQuery++;
        const answer = new Promise<T>((resolve, reject) => this.pending.set(id, {resolve, reject}));
        const result = then ? answer.then(then) : answer as unknown as Promise<R>;
        this.pending.get(id)!.result = result;
        if (this.removed) this.drop('was removed'); else this.post(command(id));
        return result;
    }
    /** @internal For the benchmark page (#360): the engine fires a `tile` event for each step of a tile and for each frame. */
    _tileReport(on: boolean) { this.tapped = on; this.post({type: 'tileReport', on}); }
    private tapped = false;
    /** Rejects the queries that have no answer yet. The engine that had them is gone, so no answer can come. */
    private drop(why: string) {
        // (After `remove()`, a query that nobody awaits is not an unhandled rejection of the page: a caller that awaits
        // still gets the error, but the page that forgot the query does not hear of it, as with MapLibre's synchronous queries.)
        for (const p of this.pending.values()) { if (why === 'was removed') p.result?.catch(() => {}); p.reject(new Error(`[map-jr-gl] The query has no answer: the map ${why}.`)); }
        this.pending.clear();
    }

    /**
     * Only in this library: returns a promise of the features that the style layers draw, the top one first. `MapInstance.queryFeatures` of the main API is this method.
     * `at` is a point of the screen (`{x, y}`), a position (`[lng, lat]`), a rectangle of the screen (two points), or
     * nothing for the whole map; the options can come in its place (`queryFeatures({layers})`).
     */
    queryFeatures(at?: FeaturePlace | LngLatLike | FeatureOptions, o: FeatureOptions = {}): Promise<RenderedFeature[]> {
        if (isOptions(at)) { o = at as FeatureOptions; at = undefined; }
        const corners = Array.isArray(at) && typeof at[0] !== 'number' ? at as {x: number; y: number}[] : undefined, r = o.radius ?? 3;
        const place = at && !corners ? at as LngLatLike | {x: number; y: number} : undefined;
        const p = place ? 'x' in place ? place : this.project(place) : undefined;
        return this.queryLayers(p ? [[p.x - r, p.y - r], [p.x + r, p.y + r]] : corners as [PointLike, PointLike] | undefined, {layers: o.layers, filter: o.filter});
    }

    /**
     * Only in this library: returns a promise of the features of the tile data of the source `sourceId`. They need no style layer, and at a position they need not
     * be on the screen (the tile is fetched if necessary). `at` is a point of the screen or a position, or nothing for the
     * tiles of the view; the options can come in its place. `MapInstance.querySource` of the main API is this method.
     */
    querySource(sourceId: string, at?: FeaturePlace | LngLatLike | SourceOptions, o: SourceOptions = {}): Promise<QueriedFeature[]> {
        if (isOptions(at)) { o = at as SourceOptions; at = undefined; }
        const corners = Array.isArray(at) && typeof at[0] !== 'number' ? at as {x: number; y: number}[] : undefined;
        const place = at && !corners ? at as LngLatLike | {x: number; y: number} : undefined;
        if (place) {
            const [lng, lat] = 'x' in place ? this.tr.unproject(place.x, place.y) : toLngLat(place);
            return this.ask(id => ({...o, sources: [sourceId], type: 'query', id, lng, lat, radius: o.radius ?? 3}));
        }
        const sets = (o.sourceLayers ?? [undefined]).map(sourceLayer => ({layer: '', source: sourceId, sourceLayer, filter: o.filter, radius: 0}));
        const box: [number, number, number, number] = corners ? [corners[0].x, corners[0].y, corners[1].x, corners[1].y] : [0, 0, this.tr.width, this.tr.height];
        return this.ask<QueriedFeature[]>(id => ({type: 'queryRendered', id, box, sets, geometry: o.geometry}));
    }

    /**
     * The features that the style layers draw at a point or in a rectangle of the screen (the whole map when no
     * geometry is given), from the top layer down. The arguments and the features are those of MapLibre GL JS.
     *
     * The tile data is in a worker, so the complete result is a promise: `await map.queryRenderedFeatures(...)`.
     * The value is also an array, for code that uses the result at once as MapLibre permits. As an array it has the
     * features of the GeoJSON sources whose data is in the style (which the page can read itself), and not those of
     * tile sources. Plugins that draw and edit on the map query their own GeoJSON sources in this way.
     */
    /** What a query for drawn features needs: the rectangle of the screen, the layers to ask, and how to make the result. */
    protected rendered(geometry?: PointLike | [PointLike, PointLike] | RenderedQueryOptions, options: RenderedQueryOptions = {}) {
        const point = (p: PointLike): [number, number] => Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y];
        const isPoint = (g: unknown): g is PointLike => !!g && (Array.isArray(g) ? typeof g[0] === 'number' : typeof (g as {x?: unknown}).x === 'number');
        let box: [number, number, number, number];
        if (isPoint(geometry)) { const [x, y] = point(geometry); box = [x, y, x, y]; }
        else if (Array.isArray(geometry)) { const [a, b] = [point(geometry[0] as PointLike), point(geometry[1] as PointLike)]; box = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
        else { box = [0, 0, this.tr.width, this.tr.height]; if (geometry) options = geometry as RenderedQueryOptions; }
        const only = options.layers ? new Set(options.layers) : null, z = this.tr.zoom, layers: any[] = this.rawStyle?.layers ?? [];
        const number = (v: unknown, fallback: number) => typeof v === 'number' ? v : fallback;
        // (As `sizeOf` of `src/query.ts`, which the page script does not load: half of the width, or of the gap and two widths.)
        const lineReach = (w: number, gap: number) => Math.max(3, (gap > 0 ? gap + 2 * w : w) / 2);
        // A circle or line layer whose size is not a number (an expression or a function) is tested with the size of
        // each feature at the zoom of the map, as in MapLibre GL JS: the worker evaluates it (`QuerySet.size`).
        const size = (l: any): QuerySet['size'] => {
            const line = l.type === 'line', ab = line ? [l.paint?.['line-width'], l.paint?.['line-gap-width']] : l.type === 'circle' ? [l.paint?.['circle-radius'], l.paint?.['circle-stroke-width']] : [];
            return ab.some(v => v !== undefined && typeof v !== 'number') ? {line, a: ab[0], b: ab[1], zoom: z} : undefined;
        };
        // A circle is drawn moved by `circle-translate` (pixels; with the anchor `map` they turn with the bearing), and is
        // found where it is drawn, as in MapLibre GL JS.
        const shift = (t: unknown, anchor: unknown): [number, number] | undefined => {
            const [x, y] = Array.isArray(t) && typeof t[0] === 'number' && typeof t[1] === 'number' ? t : [0, 0];
            if (!x && !y) return undefined;
            const a = anchor === 'viewport' ? 0 : -this.tr.bearing * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
            return [x * c - y * s, x * s + y * c];
        };
        const sets = layers.filter(l => l.source && (!only || only.has(l.id)) && l.layout?.visibility !== 'none' && z >= (l.minzoom ?? 0) && z < (l.maxzoom ?? 24)
            && this.rawStyle.sources[l.source] && !/raster|image/.test(this.rawStyle.sources[l.source].type) && !/raster|hillshade|heatmap/.test(l.type)).map(l => ({
            layer: l.id as string, source: l.source as string, sourceLayer: l['source-layer'] as string | undefined, filter: l.filter, also: options.filter,
            // How far from its geometry a feature is drawn, in pixels: half the line width, the circle radius, a part of an icon or text.
            radius: l.type === 'line' ? lineReach(number(l.paint?.['line-width'], 4), number(l.paint?.['line-gap-width'], 0)) : l.type === 'circle' ? number(l.paint?.['circle-radius'], 5) + number(l.paint?.['circle-stroke-width'], 0) : l.type === 'symbol' ? 10 : 0,
            size: size(l),
            // On a tilted map a circle is tested where the shader draws it (see `circleTouches`).
            pitch: l.type === 'circle' ? [l.paint?.['circle-pitch-alignment'] === 'map', l.paint?.['circle-pitch-scale'] !== 'viewport'] as [boolean, boolean] : undefined,
            translate: l.type === 'circle' ? shift(l.paint?.['circle-translate'], l.paint?.['circle-translate-anchor']) : undefined,
        }));
        const order = new globalThis.Map(layers.map((l, i) => [l.id, i]));
        // (From the top layer down, and in a layer the feature that is drawn last, which is on top, first.)
        // A layer that was removed while the query was in flight has no features in the answer (#705).
        const features = (found: QueriedFeature[]): RenderedFeature[] => found.filter(f => this.getLayer(f.layer!)).reverse().sort((a, b) => order.get(b.layer!)! - order.get(a.layer!)!).map(f => ({
            type: 'Feature', id: f.id, geometry: f.geometry!, properties: f.properties, source: f.source, sourceLayer: f.sourceLayer || undefined,
            layer: this.getLayer(f.layer!), state: f.id === undefined ? {} : this.getFeatureState({source: f.source, sourceLayer: f.sourceLayer || undefined, id: f.id}),
        }));
        return {box, sets, features};
    }
    /** The features that the style layers draw in the geometry that `rendered` takes, from the top layer down. */
    private queryLayers(geometry?: PointLike | [PointLike, PointLike], options?: RenderedQueryOptions): Promise<RenderedFeature[]> {
        const {box, sets, features} = this.rendered(geometry, options);
        return sets.length ? this.ask(id => ({type: 'queryRendered', id, box, sets, geometry: true}), features) : Promise.resolve([]);
    }



    /** Only in this library: returns a promise of the elevation of the ground in meters at a position, from the raster-dem source of the style, or `null` where it has no data. */
    queryElevation(at: LngLatLike | {x: number; y: number}, options: {source?: string; zoom?: number} = {}): Promise<number | null> {
        const [lng, lat] = 'x' in at ? this.tr.unproject(at.x, at.y) : toLngLat(at);
        return this.ask(id => ({type: 'elevation', id, lng, lat, ...options}));
    }

    private embedded = new globalThis.Map<string, Promise<string>>();
    /** Replaces `<image href="https://...">` inside an SVG with the picture's data, fetched once per URL. */
    private async embedImages(svg: string): Promise<string> {
        const urls = [...new Set([...svg.matchAll(/<image\b[^>]*?\bhref\s*=\s*["'](https?:[^"']+|\/[^"']+)["']/g)].map(m => m[1]))];
        for (const url of urls) {
            let data = this.embedded.get(url);
            if (!data) {
                data = fetch(url.replace(/&#38;|&amp;/g, '&')).then(async res => {
                    if (!res.ok) throw httpError('marker image', url, res.status);
                    const blob = await res.blob();
                    return new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = () => reject(r.error); r.readAsDataURL(blob); });
                });
                this.embedded.set(url, data);
                // (The URL can come from data, through a slot of a template: the list has a limit.)
                if (this.embedded.size > 200) this.embedded.delete(this.embedded.keys().next().value!);
            }
            svg = svg.split(url).join(await data.catch(error => { this.fire('error', {error}); return ''; }));
        }
        return svg;
    }

    // ---- input ----
    private dragging = false;
    private awaitingInertia = false;
    private engineMoving = false;
    /** Ends a movement: the end events of zoom, rotate and pitch, then `moveend`. */
    private settle() {
        this.moving = false;
        if (this.zooming) { this.zooming = false; this.fire('zoomend'); }
        if (this.rotating) { this.rotating = false; this.fire('rotateend'); }
        if (this.pitching) { this.pitching = false; this.fire('pitchend'); }
        this.fire('moveend');
        this.wheelDone?.();
    }
    private gated?: (gestureType: 'wheel_zoom' | 'touch_pan', e: Event) => boolean;
    private holdTouch?: () => void;
    /** @internal Set by `cooperativeGestures`: returns true when the gesture is blocked (the page scrolls). */
    get gate() { return this.gated; }
    /** Called when the movement of the map ends: ends the activity of `scrollZoom` 200 ms later. */
    private wheelDone?: () => void;
    set gate(fn) { this.gated = fn; this.holdTouch?.(); }
    private bindInput() {
        const el = this.canvas, pointers = new globalThis.Map<number, {x: number; y: number}>();
        const listen = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
            el.addEventListener(type, fn, opts);
            this.inputCleanup.push(() => el.removeEventListener(type, fn, opts));
        };
        // Screen pixels are divided by the CSS scale of the container, as in MapLibre's DOM.mousePos.
        const pos = (e: MouseEvent) => { const c = this.container, r = c.getBoundingClientRect(), sx = r.width / c.offsetWidth || 1, sy = r.height / c.offsetHeight || 1; return {x: (e.clientX - r.left) / sx - c.clientLeft, y: (e.clientY - r.top) / sy - c.clientTop}; };
        /**
         * Fires a map event for a DOM event. Returns true if a listener called preventDefault(): the map then does not act on it.
         * `act` is what the map does when no listener prevents it. It waits when `fire` sends the event later (see `fire`).
         */
        const mouseEvent = (type: string, e: MouseEvent, extra = {}, act?: () => void) => {
            const point = pos(e);
            let prevented = false;
            const sent = this.fire(type, {point, lngLat: this.unproject(point), originalEvent: e, preventDefault() { prevented = true; }, get defaultPrevented() { return prevented; }, ...extra});
            if (sent) sent.then(() => { if (!prevented && !this.removed) act?.(); });
            else if (!prevented) act?.();
            return prevented;
        };
        /** The same for a pointer: touches fire touchstart, touchmove, touchend; a mouse fires mousedown, mousemove, mouseup. */
        const pointerEvent = (kind: 'start' | 'move' | 'end' | 'cancel', e: PointerEvent) => {
            if (e.pointerType !== 'touch') return kind === 'cancel' ? false : mouseEvent(kind === 'start' ? 'mousedown' : kind === 'move' ? 'mousemove' : 'mouseup', e);
            const points = [...pointers.values()].map(p => ({...p}));
            return mouseEvent('touch' + kind, e, {points, lngLats: points.map(p => this.unproject(p))});
        };
        // A listener that prevents the default of the event that starts a gesture takes the whole gesture for itself.
        let inert = false;
        let box: {x: number; y: number; el: HTMLElement} | null = null;
        // `isActive()` of a handler is true from the start of its gesture (see where each is set) until a pointer of the gesture lifts.
        const rest = () => { for (const h of [this.dragPan, this.dragRotate, this.touchZoomRotate, this.touchPitch, this.boxZoom]) h.active = false; };
        this.inputCleanup.push(rest);
        let panFrame = 0, pendingPan: {x: number; y: number} | null = null, rotating = false, moved = 0, samples: {t: number; x: number; y: number; w?: number}[] = [], aim = {b: 0, p: 0}, pinch: {dist: number; angle: number} | null = null;
        // Wheel events do not say what produced them. As MapLibre does, tell mouse wheels from trackpads by their
        // deltas and timing, because the two need different handling to feel right.
        let wheelKind: 'wheel' | 'trackpad' | null = null, lastWheel = 0, held = 0, heldTimer: ReturnType<typeof setTimeout> | undefined, wheelEnd: ReturnType<typeof setTimeout> | undefined;
        // `scrollZoom.isActive()` is true from a wheel event until 200 ms after the zoom has ended, as in MapLibre GL JS.
        const rested = () => { this.scrollZoom.active = false; };
        this.wheelDone = () => { if (this.scrollZoom.active) { clearTimeout(wheelEnd); wheelEnd = setTimeout(rested, 200); } };
        this.inputCleanup.push(() => { clearTimeout(heldTimer); clearTimeout(wheelEnd); this.wheelDone = undefined; });

        // Touch gestures, matching MapLibre's set: one-finger pan, pinch to zoom and (past a threshold) rotate,
        // two fingers moving vertically together to tilt, double-tap to zoom in, two-finger tap to zoom out, and
        // double-tap-then-drag to zoom with one hand.
        let gesture: {mode: 'undecided' | 'pinch' | 'pitch'; dist: number; angle: number; startAngle: number; rotating: boolean; mid: {x: number; y: number}; start: {x: number; y: number}[]; t0: number; travel: number} | null = null;
        let lastTap = {t: 0, x: 0, y: 0}, tapDrag: {x: number; y: number; zoomed: boolean} | null = null, suppressClick = false, lastPointerType = 'mouse';
        // With `cooperativeGestures`, a touch that stays one finger is blocked and reported (the hint). The report waits
        // 150 ms from the first finger, because a hand puts its two fingers down one after the other (iOS, #1687), and a
        // touch that has had two fingers is not reported again when one of them lifts first, as in MapLibre GL JS.
        let touches = {two: false, t: 0}, report: ReturnType<typeof setTimeout> | undefined;
        this.inputCleanup.push(() => clearTimeout(report));
        const solo = (e: PointerEvent) => {
            const seq = touches, wait = seq.t + 150 - performance.now();
            if (seq.two) return;
            if (wait <= 0) { this.gate?.('touch_pan', e); return; }
            report ??= setTimeout(() => { report = undefined; if (!seq.two) this.gate?.('touch_pan', e); }, wait);
        };
        const twoFingers = () => { const [a, b] = [...pointers.values()]; return {a, b, dist: Math.hypot(a.x - b.x, a.y - b.y), angle: Math.atan2(b.y - a.y, b.x - a.x), mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}}; };

        // A rotate drag (the right mouse button, or Ctrl with the left one) turns the map as the default of MapLibre GL JS
        // does (`generateMouseRotationHandler` in its `src/ui/handler/mouse.ts`; the code here is new, #557). More than 100
        // pixels above or below the center of the map, the map turns by the angle that the sideways movement of the pointer
        // makes around that center. Nearer to the center, the map turns by 0.8 degrees for each pixel: with the pointer
        // below the center a drag to the right increases the bearing, and above the center it decreases the bearing.
        // The center is the point of the screen that the camera looks at (`centerPoint` in MapLibre GL JS), not the
        // projected center position: with 3D terrain the two differ (#1489).
        const turn = (a: {x: number; y: number}, b: {x: number; y: number}) => {
            const {cx, cy} = this.tr, y = b.y - cy, x0 = a.x - cx, x1 = b.x - cx;
            return Math.abs(cy - a.y) > 100 ? Math.atan2(y * (x1 - x0), x1 * x0 + y * y) * 180 / Math.PI : (x1 - x0) * (y < 0 ? -.8 : .8);
        };
        listen('pointerdown', e => {
            try { el.setPointerCapture(e.pointerId); } catch { /* synthetic events have no capturable pointer */ }
            const p = pos(e), now = performance.now();
            lastPointerType = e.pointerType;
            pointers.set(e.pointerId, p);
            if (pointers.size === 1) touches = {two: false, t: now};
            else touches.two = true;
            rotating = e.button === 2 || e.ctrlKey;
            moved = 0; samples = []; aim = {b: this.tr.bearing, p: this.tr.pitch}; pinch = null; this.held = null;
            if (pointerEvent('start', e)) inert = true;
            if (inert) return;
            // Shift and drag: a box to zoom to.
            if (e.shiftKey && e.button === 0 && e.pointerType === 'mouse' && this.boxZoom.isEnabled()) {
                box = {x: p.x, y: p.y, el: this.container.appendChild(Object.assign(document.createElement('div'), {className: cls('boxzoom')}))};
                box.el.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;border:2px dotted #202020;background:rgba(255,255,255,.3);pointer-events:none;z-index:2';
                this.boxZoom.active = true;
                this.fire('boxzoomstart', {originalEvent: e});
                return;
            }
            this.post({type: 'stop'});
            if (pointers.size === 1) {
                // (As in MapLibre, a mouse button that is down makes `dragPan` active before the pointer moves.)
                this.dragPan.active = e.pointerType === 'mouse' && !rotating && this.dragPan.isEnabled();
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
                mouseEvent('mousemove', e);
                return;
            }
            pointers.set(e.pointerId, p);
            const dx = p.x - prev.x, dy = p.y - prev.y;
            moved += Math.abs(dx) + Math.abs(dy);
            pointerEvent('move', e);
            if (inert) return;
            if (box) {
                Object.assign(box.el.style, {left: Math.min(box.x, p.x) + 'px', top: Math.min(box.y, p.y) + 'px', width: Math.abs(p.x - box.x) + 'px', height: Math.abs(p.y - box.y) + 'px'});
                return;
            }
            if (pointers.size === 2 && gesture) {
                const g = gesture, f = twoFingers();
                g.travel += Math.abs(dx) + Math.abs(dy);
                // Decide what the gesture is once both fingers have moved (events arrive one finger at a time).
                const moved2 = (k: 0 | 1) => Math.hypot((k ? f.b : f.a).x - g.start[k].x, (k ? f.b : f.a).y - g.start[k].y);
                if (g.mode === 'undecided' && g.travel > 8 && ((moved2(0) > 3 && moved2(1) > 3) || g.travel > 40)) {
                    // Tilt: both fingers travel vertically in the same direction while staying side by side.
                    const da = f.a.y - g.start[0].y, db = f.b.y - g.start[1].y, sideways = Math.abs(f.a.x - g.start[0].x) + Math.abs(f.b.x - g.start[1].x);
                    const together = Math.sign(da) === Math.sign(db) && Math.abs(da) > 4 && Math.abs(db) > 4 && sideways < Math.abs(da) + Math.abs(db);
                    // (With `cooperativeGestures`, two fingers move the map and do not tilt it: MapLibre GL JS tilts with three there; #1687.)
                    g.mode = together && !this.gated && Math.abs(f.a.y - f.b.y) < 120 && Math.abs(f.dist - g.dist) < 12 ? 'pitch' : 'pinch';
                    if (!this.dragging) this.fire('dragstart', {originalEvent: e});
                    this.dragging = true;
                }
                if (g.mode !== 'undecided') this.fire('drag', {originalEvent: e});
                if (g.mode === 'pitch') { if (this.touchPitch.isEnabled()) { this.touchPitch.active = true; this.post({type: 'rotate', delta: 0, pitch: -(f.mid.y - g.mid.y) * 0.5}); } }
                else if (g.mode === 'pinch' && this.touchZoomRotate.isEnabled()) {
                    // (As in MapLibre GL JS, whose touch pan runs together with the pinch.)
                    this.touchZoomRotate.active = true; this.dragPan.active = this.dragPan.isEnabled();
                    this.post({type: 'pan', dx: f.mid.x - g.mid.x, dy: f.mid.y - g.mid.y, x: f.mid.x, y: f.mid.y});
                    if (f.dist > 0 && g.dist > 0) this.post({type: 'zoom', delta: Math.log2(f.dist / g.dist), x: f.mid.x, y: f.mid.y});
                    let turn = f.angle - g.angle;
                    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
                    if (!g.rotating) {
                        // Ignore small twists, which every pinch has: rotation starts once the fingers have swept about 25px of arc.
                        let total = f.angle - g.startAngle;
                        total = Math.atan2(Math.sin(total), Math.cos(total));
                        g.rotating = Math.abs(total) * f.dist / 2 > 25;
                    } else if (this.touchZoomRotate.rotation) this.post({type: 'rotate', delta: -turn * 180 / Math.PI});
                }
                // Until the gesture is decided, keep measuring from where it began so no movement is lost.
                if (g.mode !== 'undecided') { g.dist = f.dist; g.angle = f.angle; g.mid = f.mid; }
            } else if (tapDrag && pointers.size === 1) {
                // Second tap held and dragged: down zooms in, up zooms out, around where the taps landed.
                if (moved > 6) { tapDrag.zoomed = this.touchZoomRotate.active = true; this.post({type: 'zoom', delta: dy * 0.01, x: tapDrag.x, y: tapDrag.y}); }
            } else if (rotating) { if (this.dragRotate.isEnabled()) { this.dragRotate.active = true; const b = turn(prev, p), t = performance.now(); aim = {b: aim.b + b, p: Math.max(this.tr.minPitch, Math.min(this.tr.maxPitch, aim.p - dy * 0.5))}; addTurnSample(samples, {t, x: aim.b, y: aim.p}); this.post({type: 'rotate', delta: b, pitch: -dy * 0.5}); } } // right- or ctrl-drag: turn and tilt
            else if (moved > 3 && pointers.size === 1 && this.dragPan.isEnabled() && !(e.pointerType === 'touch' && this.gated && (solo(e), true))) {
                if (!this.dragging) this.fire('dragstart', {originalEvent: e});
                this.dragging = this.dragPan.active = true;
                this.fire('drag', {originalEvent: e});
                // (With 3D terrain the page does not know the ground well enough, and the engine moves the camera alone.)
                const pan = {type: 'pan' as const, dx, dy, x: p.x, y: p.y};
                this.post(pan);
                // (Not on the globe: there each move turns the globe from the last pointer, and the page waits for the engine's camera.)
                const h = this.tr.heightAt || this.tr.globeness || this.renderer !== 'worker' ? null : this.held ??= {from: (pan as {seq?: number}).seq!, t: 0};
                if (h) {
                    // The worker draws a move in the frame after the one in which the page receives it: the page places
                    // the markers for each move one frame later too.
                    h.pend = [p.x, p.y];
                    const frame = () => {
                        if (this.held !== h) return;
                        if (h.next && h.at) {
                            [h.x, h.y] = h.next; h.t = performance.now();
                            this.tr.setLocationAt(h.at[0], h.at[1], h.x, h.y);
                            for (const place of this.overlays) place();
                        }
                        h.next = h.pend; h.pend = undefined;
                        if (h.next) requestAnimationFrame(frame); else h.loop = false;
                    };
                    if (!h.loop) { h.loop = true; requestAnimationFrame(frame); }
                }
                // As in MapLibre GL JS, the moves of one frame give one sample, at the time of the frame (see `up`).
                const list = samples;
                pendingPan = {x: p.x, y: p.y};
                if (!panFrame) panFrame = requestAnimationFrame(() => { panFrame = 0; if (pendingPan && list === samples) list.push({t: performance.now(), ...pendingPan}); pendingPan = null; });
            }
        });
        const up = (e: PointerEvent) => {
            if (!pointers.has(e.pointerId)) return;
            this.held = null;
            rest();
            if (e.type !== 'blur') pointerEvent(e.type === 'pointerup' ? 'end' : 'cancel', e);
            pointers.delete(e.pointerId);
            if (inert) { if (!pointers.size) inert = false; return; }
            if (box) {
                const b = box, at = e.type === 'blur' ? b : pos(e);
                box = null;
                b.el.remove();
                if (e.type !== 'pointerup' || Math.abs(at.x - b.x) < 4 || Math.abs(at.y - b.y) < 4) { this.fire('boxzoomcancel', {originalEvent: e}); return; }
                const bounds = new LngLatBounds(this.unproject(b), this.unproject(at)).extend(this.unproject({x: b.x, y: at.y})).extend(this.unproject({x: at.x, y: b.y}));
                // (An ease, as in MapLibre GL JS, also in the compat entry, whose fitBounds flies.)
                this.easeTo({...this.cameraForBounds(bounds), duration: 300});
                this.fire('boxzoomend', {originalEvent: e, boxZoomBounds: bounds});
                return;
            }
            pinch = null;
            const now = performance.now();
            if (gesture) {
                // Two fingers down and up again quickly, without moving: zoom out.
                if (gesture.mode === 'undecided' && now - gesture.t0 < 300 && gesture.travel < 12 && this.touchZoomRotate.isEnabled()) this.easeTo({zoom: this.tr.zoom - 1, around: [gesture.mid.x, gesture.mid.y], duration: 300});
                gesture = null;
                suppressClick = true; // the finger still down must not pan-fling or click when it lifts
                samples = [];
            }
            if (pointers.size) return;
            const wasDragging = this.dragging;
            this.dragging = false;
            if (wasDragging) this.fire('dragend', {originalEvent: e});
            if (tapDrag) {
                if (!tapDrag.zoomed) {
                    // (The zoom waits for the listeners of `dblclick`, which the compat entry calls later: see `mouseEvent`.)
                    // (`doubleClickZoom.isActive()` is true until the next task, as in MapLibre GL JS.)
                    if (this.doubleClickZoom.isEnabled()) { this.doubleClickZoom.active = true; setTimeout(() => { this.doubleClickZoom.active = false; }); }
                    const {x, y} = tapDrag, zoom = () => { if (this.doubleClickZoom.isEnabled()) this.easeTo({zoom: this.tr.zoom + 1, around: [x, y], duration: 300}); };
                    if (e.type === 'blur') zoom(); else mouseEvent('dblclick', e, {}, zoom);
                }
                tapDrag = null;
                lastTap.t = 0;
                if (wasDragging) { this.moving = false; this.fire('moveend'); }
                return;
            }
            const last = samples[samples.length - 1];
            // A rotate drag turns on as in MapLibre GL JS (see `turnInertia`). Its samples are the bearing and the pitch
            // that the drag asked for, because the view of a worker renderer can be a frame behind.
            const spin = rotating && this.dragRotate.isEnabled() && turnInertia(samples, now);
            if (rotating) samples = [];
            if (spin) this.easeTo({bearing: this.spinBearing(last.x + spin.bearing), pitch: last.y + spin.pitch, duration: spin.duration, easing: bezier(0, 0, 0.3, 1)});
            // A rotate drag released after a pause ends here; one released while the engine still turns ends at its next report.
            else if (rotating && this.moving && !this.engineMoving && !this.dragging) this.settle();
            if (wasDragging && !rotating) {
                // Inertia as in MapLibre GL JS (see `inertiaSpan`): in the next frame, the movement of the last 60 ms of
                // frames over the time up to that frame, so that a pointer that slowed or stopped before the release
                // gives less or none (#479).
                const list = samples;
                this.awaitingInertia = true;
                cancelAnimationFrame(panFrame); panFrame = 0;
                requestAnimationFrame(() => {
                    if (this.removed) return;
                    if (list !== samples || this.dragging) { this.awaitingInertia = false; return; }
                    const t = performance.now();
                    if (pendingPan) list.push({t, ...pendingPan}), pendingPan = null;
                    const [a, b] = inertiaSpan(list, t);
                    if (a && b && (a.x !== b.x || a.y !== b.y)) this.post({type: 'fling', dx: b.x - a.x, dy: b.y - a.y, ms: t - a.t});
                    else { this.awaitingInertia = false; this.moving = false; this.fire('moveend'); }
                });
            } else if (wasDragging) { this.moving = false; this.fire('moveend'); }
            if (moved <= 3 && e.type === 'pointerup' && e.button === 0 && !suppressClick) {
                const at = pos(e);
                if (e.pointerType === 'touch') lastTap = {t: now, x: at.x, y: at.y};
                mouseEvent('click', e);
            }
        };
        // While `cooperativeGestures` is on, the canvas has `touch-action: pan-x pan-y` so that one finger scrolls the
        // page. A move of two fingers that started on the canvas cancels its default, as MapLibre GL JS does, so that
        // the browser does not take the gesture and end it with `pointercancel` (iOS Safari, #1286).
        const hold = (e: TouchEvent) => { if (e.targetTouches.length > 1 && e.cancelable) e.preventDefault(); };
        (this.holdTouch = () => { el.removeEventListener('touchmove', hold); if (this.gated) el.addEventListener('touchmove', hold, {passive: false}); })();
        this.inputCleanup.push(() => { el.removeEventListener('touchmove', hold); this.holdTouch = undefined; });
        listen('pointerup', up);
        listen('pointercancel', up);
        listen('lostpointercapture', up);
        const blur = () => { for (const id of [...pointers.keys()]) up({pointerId: id, type: 'blur'} as PointerEvent); };
        window.addEventListener('blur', blur);
        this.inputCleanup.push(() => window.removeEventListener('blur', blur));
        listen('wheel', e => {
            // With scroll zoom off, the wheel scrolls the page as it does outside the map.
            if (mouseEvent('wheel', e) || !this.scrollZoom.isEnabled() || this.gate?.('wheel_zoom', e)) return;
            e.preventDefault();
            const p = pos(e), now = performance.now(), gap = now - lastWheel;
            let value = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
            lastWheel = now;
            const send = (v: number) => {
                this.scrollZoom.active = true;
                clearTimeout(wheelEnd);
                // (If the map does not move, at the limit of the zoom, the handler rests after 1 s.)
                wheelEnd = setTimeout(rested, 1000);
                this.post({type: 'wheel', delta: -v, x: p.x, y: p.y, kind: wheelKind!});
            };
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
        listen('dblclick', e => { if (lastPointerType === 'touch') return; /* touch double-taps are handled above, uniformly across browsers */ const p = pos(e); mouseEvent('dblclick', e, {}, () => { if (this.doubleClickZoom.isEnabled()) this.easeTo({zoom: this.tr.zoom + (e.shiftKey ? -1 : 1), around: [p.x, p.y], duration: 300}); }); });
        listen('contextmenu', e => { e.preventDefault(); mouseEvent('contextmenu', e); });
        listen('pointerenter', e => { if (e.pointerType === 'mouse') mouseEvent('mouseover', e); });
        listen('pointerleave', e => { if (e.pointerType === 'mouse') mouseEvent('mouseout', e); });
        // The keyboard focus shows on the frame of the map. (The canvas has no outline of its own: it is scaled.)
        const ring = (on: boolean) => { this.container.style.outline = on ? '2px solid var(--map-control-focus,#2f7fd1)' : ''; this.container.style.outlineOffset = on ? '-2px' : ''; };
        listen('focus', () => ring(this.canvas.matches(':focus-visible')));
        listen('blur', () => ring(false));
        listen('keydown', e => {
            if (!this.keyboard.isEnabled()) return;
            const step = 100, k = e.key;
            if (k === '+' || k === '=') this.zoomIn();
            else if (k === '-') this.zoomOut();
            else if (k.startsWith('Arrow')) {
                e.preventDefault();
                // As in MapLibre GL JS: Shift with left or right rotates by 15°, with up or down pitches by 10°.
                if (e.shiftKey) { this.easeTo(k === 'ArrowLeft' || k === 'ArrowRight' ? {bearing: this.getBearing() + (k === 'ArrowLeft' ? -15 : 15), duration: 300} : {pitch: this.getPitch() + (k === 'ArrowUp' ? 10 : -10), duration: 300}); return; }
                const c = this.unproject({x: this.tr.cx + (k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0), y: this.tr.cy + (k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0)});
                // (With the zoom given, as MapLibre GL JS does: on the globe the arrows keep the zoom, and the size of the globe changes.)
                this.easeTo({center: c, zoom: this.tr.zoom, duration: 200});
            }
        });
    }

    /** Only in this library: returns the attribution texts of the sources of the style as they are written, which can be HTML that the attribution control shows. */
    getAttributions(): string[] {
        // As in MapLibre GL JS: only the sources that a visible layer uses at the current zoom, and no blank text.
        const z = this.tr.zoom, sources = this.resolved?.sources ?? {}, layers: any[] = this.rawStyle?.layers ?? [];
        // A `visibility` expression of the global state is evaluated by the engine, which reports the layers it hides (#1032).
        const used = new Set(layers.filter(l => l.source && (Array.isArray(l.layout?.visibility) ? !this.hidden.has(l.id) : l.layout?.visibility !== 'none') && z >= (l.minzoom ?? 0) && z < (l.maxzoom ?? 24)).map(l => l.source as string));
        return [...new Set(Object.entries(sources).filter(([id]) => used.has(id)).map(([, s]) => s.attribution?.trim()).filter((a): a is string => !!a))];
    }

    remove() {
        this.removed = true;
        for (const ac of this.protocolAborts) ac.abort();
        this.fire('remove');
        this.drop('was removed');
        for (const c of [...this.controls.keys()]) this.removeControl(c);
        for (const fn of this.inputCleanup) fn();
        this.tilePool?.release();
        this.observer?.disconnect();
        for (const fn of this.cleanup) fn();
        this.syncVideos();
        // The engine frees the memory of the GPU first. A worker is stopped a moment later, so that it gets the message.
        if (this.ready) this.send({type: 'destroy'});
        const workers = this.workers;
        setTimeout(() => { for (const w of workers) w.terminate(); }, 100);
        this.canvas.remove();
        this.unavailable?.remove();
        this.listeners = {};
    }
}

/** Padding as MapLibre takes it: one number for all sides, or any of the four sides. */
export type {PaddingInput} from './geo.ts';
import type {PaddingInput} from './geo.ts';
/** The options of `flyTo` that `easeTo` does not have, as in MapLibre GL JS. */
export interface FlyOptions {
    /**
     * How far the camera zooms out on the way: a larger value zooms out further.
     * @default 1.42
     */
    curve?: number;
    /**
     * The average speed of the flight, relative to `curve`.
     * @default 1.2
     */
    speed?: number;
    /** The average speed of the flight in screens per second. It overrides `speed`. */
    screenSpeed?: number;
    /** The zoom level at the top of the flight. It overrides `curve`. */
    minZoom?: number;
    /** The longest duration of the flight in milliseconds, without `duration`: a longer flight jumps to the target instead. */
    maxDuration?: number;
}
export type CameraInput = Omit<CameraOptions, 'padding'> & {padding?: PaddingInput};
function paddingOf(p: PaddingInput): [number, number, number, number] {
    return typeof p === 'number' ? [p, p, p, p] : [p.top ?? 0, p.right ?? 0, p.bottom ?? 0, p.left ?? 0];
}

/** The largest number of variants of one SVG template that a map draws. The values come from data, and the texture of the images has a fixed size. */
const MAX_VARIANTS = 1000;
/** The style sheet of the controls, constructed once for each document (see `styles`). */
const sheets = new WeakMap<Document, CSSStyleSheet>();
/**
 * The name of a projection as MapLibre GL JS gives it in `projectiontransition`: `mercator`, `globe` or
 * `vertical-perspective`, and `globe` for an expression (MapLibre makes a globe of each expression). A name that it
 * does not know is `mercator`, which it draws then.
 */
export const projectionName = (type: unknown): string => Array.isArray(type) ? 'globe' : type === 'globe' || type === 'vertical-perspective' ? type : 'mercator';
/** A deep copy. Structured clone refuses a proxy (a Vue reactive object, #242), and JSON reads through one. */
function plain<T>(v: T): T { try { return structuredClone(v); } catch { return JSON.parse(JSON.stringify(v)); } }

/** Options for `addImage`, as in MapLibre, plus an explicit size in CSS pixels. */
export interface ImageOptions {
    width?: number; height?: number;
    /** How many image pixels make one CSS pixel (2 for a "@2x" image). */
    pixelRatio?: number;
    /** For icons fitted around text: the ranges that may stretch and the box the text sits in, in image pixels. */
    stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number];
    textFitWidth?: 'stretchOrShrink' | 'stretchOnly' | 'proportional'; textFitHeight?: 'stretchOrShrink' | 'stretchOnly' | 'proportional';
    /** The image is a signed distance field in its alpha channel: `icon-color` and `icon-halo-*` recolor it. Default false. */
    sdf?: boolean;
}

function pixels(canvas: HTMLCanvasElement, source: CanvasImageSource, w: number, h: number): Uint8Array {
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', {willReadFrequently: true})!;
    ctx.drawImage(source, 0, 0, w, h);
    return premultiply(ctx.getImageData(0, 0, w, h).data);
}

function premultiply(px: ArrayLike<number>): Uint8Array {
    const out = new Uint8Array(px.length);
    for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3] / 255;
        out[i] = px[i] * a; out[i + 1] = px[i + 1] * a; out[i + 2] = px[i + 2] * a; out[i + 3] = px[i + 3];
    }
    return out;
}

/** Applies one diff of `updateData` to GeoJSON data and returns a new FeatureCollection. */
function applyDiff(data: any, diff: GeoJSONDiff, promoteId?: string | Record<string, string>) {
    const key = typeof promoteId === 'string' ? promoteId : promoteId?._geojsonTileLayer;
    const idOf = (f: any) => key ? f.properties?.[key] : f.id;
    let features: any[] = diff.removeAll ? [] : data?.type === 'FeatureCollection' ? data.features : data?.type === 'Feature' ? [data] : [];
    const added = new Set((diff.add ?? []).map(idOf));
    features = [...features.filter(f => !diff.remove?.includes(idOf(f)) && !added.has(idOf(f))), ...diff.add ?? []];
    for (const u of diff.update ?? []) {
        const i = features.findIndex(f => idOf(f) === u.id);
        if (i < 0) continue;
        const f = features[i] = {...features[i], properties: u.removeAllProperties ? {} : {...features[i].properties}};
        if (u.newGeometry) f.geometry = u.newGeometry;
        for (const k of u.removeProperties ?? []) delete f.properties[k];
        for (const p of u.addOrUpdateProperties ?? []) f.properties[p.key] = p.value;
    }
    return {type: 'FeatureCollection', features};
}

/** The data and the options (as text) of each GeoJSON source of a resolved style: what an engine that starts with it has. */
function geoOf(style?: ResolvedStyle) {
    return new globalThis.Map(Object.entries(style?.sources ?? {}).filter(([, s]) => s.type === 'geojson').map(([name, s]) => [name, {data: s.data, key: JSON.stringify([s.options, s.maxzoom])}]));
}

/** Whether two styles are equal, apart from the camera fields that MapLibre GL JS leaves out of a diff. */
function sameStyle(a: any, b: any) {
    const camera = {center: 0, zoom: 0, bearing: 0, pitch: 0, roll: 0};
    return equal({...a, ...camera}, {...b, ...camera});
}
function equal(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => equal(a[k], b[k]));
}
