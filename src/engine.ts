import {heightsChanged} from './geo.ts';
import {EXTENT, HEIGHT_GRID, TILE_SIZE, Transform, bezier, globeStops, groundHeight, clamp, keepSize, latFromMerc, lngFromMerc, mercX, mercY, type LngLatLike, type TileID} from './geo.ts';
import {globeBuild} from './subdivide.ts';
import {compileFor, IMAGE_OR, pickImage, type Feature, type MapStates} from './expr.ts';
import {VARIANT, variantName} from './markers.ts';
import {layerRules} from './rules.ts';
import {compileLayer, transition, isGeometrySource, screenTranslate, loadSprite, tileURL, promoteIds, type CompiledLayer, type FontSource, type ResolvedStyle, type Sprite, type SpriteIcon} from './style.ts';
import {AtlasSpace} from './atlas-space.ts';
import {GLRenderer, SPRITE_ATLAS, type DemRef, type GLTile, type TerrainTile} from './gl.ts';
import {CollisionGrid, moveLabel, placeLabels, tooFar, renderItems, type Placed, type RenderItem} from './placement.ts';
import {EM, GlyphAtlas} from './text.ts';
import {fetchWith, finalFailure, httpError, withTimeout, type Ask, type RequestAnswer, type RequestRules} from './requests.ts';
import {decodeElevation, sampleElevation, featureKey, tilesUnderBox, type QueriedFeature, type QuerySet} from './query.ts';
import type {FeatureStates, TileBackend, TileRequest} from './tiles.ts';
import type {TileGL} from './tile.ts';
import {fetchTile, heads} from './pmtiles.ts';
import {imagePixels} from './exact-pixels.ts';

export interface CameraOptions { center?: LngLatLike; zoom?: number; bearing?: number; pitch?: number; /** Space at the edges covered by other things: top, right, bottom, left. */ padding?: [number, number, number, number] }
export type {FontSource} from './style.ts';
export interface EngineOptions extends CameraOptions {
    style: ResolvedStyle; width: number; height: number; dpr: number; fontFamily: string; fonts?: FontSource[];
    minZoom?: number; maxZoom?: number; maxPitch?: number; antialias?: boolean;
    /** The page's rules for requests at the start, so that the first tiles follow them too (#355). */
    requests?: RequestRules;
    /** Answers that the page requested before the engine started, by URL (only for an engine on the page's thread). */
    early?: Map<string, Promise<Response>>;
}
export interface FeatureQuery { radius: number; zoom?: number; sources?: string[]; sourceLayers?: string[]; filter?: unknown; geometry?: boolean }
export type Command =
    | {type: 'resize'; width: number; height: number; dpr: number}
    | ({type: 'jump'} & CameraOptions)
    | ({type: 'ease'; duration: number; around?: [number, number]; easing?: number[]; fly?: number[]} & CameraOptions)
    /** Moves the map by a screen distance. With `x`, `y` (where the pointer now is) the ground first grabbed stays under the pointer, tilt, terrain and all. */
    | {type: 'pan'; dx: number; dy: number; x?: number; y?: number}
    | {type: 'zoom'; delta: number; x: number; y: number}
    | {type: 'wheel'; delta: number; x: number; y: number; kind: 'wheel' | 'trackpad'}
    | {type: 'rotate'; delta: number; pitch?: number}
    | {type: 'fling'; dx: number; dy: number; ms: number}
    | {type: 'stop'}
    | {type: 'limits'; minZoom: number; maxZoom: number; maxPitch: number; minPitch?: number; maxBounds?: [number, number, number, number] | null}
    /** Throws away a source's tiles (all sources if none is named) and loads them again. */
    | {type: 'refresh'; source?: string}
    /** The parameters of `setSourceTileLodParams` (maximum zoom levels on screen, tile count ratio) for these sources; an empty `lod` drops them (removeSource). */
    | {type: 'lod'; sources: string[]; lod: number[]}
    | {type: 'style'; style: ResolvedStyle; reload: boolean; /** A number for each source that changes when the page changes what its tiles are built from. */ versions?: Record<string, number>;
        /** The data of the GeoJSON sources that are new or changed since the last style (the sources in `style` carry no data). */ data?: Record<string, unknown>;
        /** A whole new style (`setStyle` without `diff`): its paint values do not transition from the style before. */ instant?: boolean}
    /**
     * The images that are SVG templates: the slots of each one by name. `changed` has the names whose template is new,
     * other or gone: their variants are dropped and asked for again. `rebuild`: the slots are different, so tiles are built again.
     */
    | {type: 'templates'; slots: Record<string, string[]>; changed: string[]; rebuild: boolean}
    | {type: 'fonts'; fonts: FontSource[]}
    | {type: 'image'; name: string; w: number; h: number; width: number; height: number; data: Uint8Array; stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number]; textFitWidth?: 'stretchOrShrink' | 'stretchOnly' | 'proportional'; textFitHeight?: 'stretchOrShrink' | 'stretchOnly' | 'proportional'; sdf?: boolean; update?: boolean}
    | {type: 'removeImage'; name: string}
    /** A new frame of a video or canvas source (the page makes it). The engine closes the bitmap. */
    | {type: 'frame'; source: string; image: ImageBitmap}
    | {type: 'geojson'; source: string; data: unknown}
    /** Replaces the feature state of one source ("sourceLayer|id" -> state); its tiles are rebuilt in place. */
    /** The states of the features that changed (`null`: no state), or all states of the source with `replace`. */
    | {type: 'featureState'; source: string; states: FeatureStates; replace?: boolean}
    | ({type: 'query'; id: number; lng: number; lat: number} & FeatureQuery)
    /** Features that style layers draw, in a rectangle of the screen. Each set is one style layer (its radius is in pixels). */
    | {type: 'queryRendered'; id: number; box: [number, number, number, number]; sets: (QuerySet & {source: string})[]; geometry?: boolean}
    | {type: 'elevation'; id: number; lng: number; lat: number; source?: string; zoom?: number}
    | {type: 'repaint'}
    /** The map was removed: free the memory of the GPU. */
    | {type: 'destroy'}
    /** Which requests the page wants to change (see requests.ts), and the page's answer to one question. */
    | {type: 'requests'; rules: RequestRules}
    | ({type: 'resourceResult'; id: number} & RequestAnswer)
    /** Asks for a `frame` event after each frame that is drawn (for the `render` event of the map). */
    | {type: 'frames'; on: boolean}
    /** Asks for a `pong` event with the same number after the next frame that the engine has drawn to its end. */
    | {type: 'ping'; n: number}
    /** In a worker: answers with the next frame that is drawn, encoded as an image (a Blob), taken in the same task as the frame (#965). */
    | {type: 'snapshot'; id: number; mime: string; quality?: number}
    /** For the benchmark page (#360): report the steps of each tile and the tiles of the view of each frame with `tile` events. */
    | {type: 'tileReport'; on: boolean}
    /** The compat entry, when a listener wants `data` or `sourcedata`: report each tile that has loaded with a `tileLoaded` event. */
    | {type: 'tileLoads'; on: boolean}
    /** The compat entry, with the engine on the main thread: draws its custom layers (custom-layers.ts). The answer is the WebGL context. */
    | {type: 'custom'; id: number; draw: GLRenderer['custom']}
    | {type: 'bound'; id: number; fn: ((tr: Transform) => void) | null};
export type EngineEvent =
    | {type: 'camera'; lng: number; lat: number; zoom: number; bearing: number; pitch: number; /** Ground height at the center with 3D terrain, else 0. */ elevation: number; exaggeration: number; groundRange?: [number, number]; padding: [number, number, number, number]; moving: boolean;
        /** During a drag: the ground that it grabbed, and the number of the command that grabbed it (#38). */
        grab?: [number, number, number];
        /** The number of the last command that the engine has applied (see `seq` in map.ts). */
        seq?: number}
    | {type: 'idle'; seq: number}
    /** The tiles of a source for the view are all loaded, or are no longer all loaded. */
    | {type: 'source'; source: string; loaded: boolean; /** The version of the source that the page gave (see the `style` command). */ v: number}
    /** 3D terrain: the height grid of an elevation tile that has loaded (or, without `grid`, been dropped). */
    | {type: 'heights'; key: string; grid?: Float32Array}
    /** About once a second while drawing: frames drawn per second and the engine's average CPU time per frame. */
    /** `labels`: how many labels and icons of the last frame were placed among the labels (the icons that the tiles have in buffers are not counted). */
    | {type: 'stats'; fps: number; frameMs: number; labels: number}
    /** The layers that the last style hides, also by a `visibility` expression of the global state. */
    | {type: 'hidden'; layers: string[]}
    | {type: 'frame'}
    /** The tile workers have indexed the data of the last `geojson` command for this source. The page sends the next data then. */
    | {type: 'geojsonDone'; source: string}
    /** The engine has drawn a frame to its end after the `ping` command with this number. */
    | {type: 'pong'; n: number}
    /** The browser took the WebGL context away (for example, a phone that needs the memory). The page starts the map again. */
    | {type: 'contextlost'}
    /** A question to the page about one request. */
    | {type: 'resource'; id: number; url: string; kind: string}
    /** A frame at a new canvas size has been drawn. */
    | {type: 'resized'; width: number; height: number; dpr: number; /** The size of the drawing buffer, which the browser can clamp (#950). */ buffer: [number, number]}
    | {type: 'result'; id: number; value?: unknown; error?: string}
    | {type: 'imagemissing'; name: string}
    | {type: 'error'; message: string}
    /** After `tileReport`: a step of a tile (`req`, `ans`, `up`, `miss`, `fail`, `drop`, `rebuild`), or, with `kind` `frame`, the tile slots of the view in a frame. `t`: the engine's clock, in ms. */
    | {type: 'tile'; key: string | string[]; kind: string; t: number; error?: string}
    /** After `tileLoads`: the tile `key` (`source|z/x/y`) has loaded. */
    | {type: 'tileLoaded'; key: string};

/**
 * Describes what a source's tiles depend on: first the source itself, then everything about its layers that is baked
 * into tile buffers (filters, layout, and paint values that vary per feature). Paint values that are the same for a
 * whole layer are applied at draw time, so changing them needs no new tiles.
 */
function sourceSignature(style: ResolvedStyle, name: string): [string, string] {
    const src = style.sources[name] as any;
    // (3D terrain is not part of this: an elevation tile keeps its heights, so that terrain goes on and off with the
    // tiles that are there. See `ground`. New data of a GeoJSON source is not part of it either: see `newData`.)
    const source = JSON.stringify({...src, head: undefined, data: undefined});
    if (!isGeometrySource(src)) return [source, '']; // image tiles do not depend on layers
    // (In the order of their ids: each layer is built on its own, so a new order of the layers draws the same tiles in
    // another order and needs no new tiles; #961.)
    const layers = style.layers.filter(l => l.source === name).map(l => layerRules(l)).sort((a, b) => (a[0] as string) < (b[0] as string) ? -1 : 1);
    // Layers that read global state are rebuilt when it changes. A tile for a globe is cut along a grid (subdivide.ts),
    // so a change between the globe and Mercator builds the tiles again.
    const json = JSON.stringify(layers) + (globeStops(style.projection?.type) ? 'globe' : '');
    return [source, json.includes('"global-state"') ? json + JSON.stringify(style.state ?? {}) : json];
}

interface TileState { state: 'loading' | 'ok' | 'error'; gl?: GLTile; /** An image tile that the server does not have (404). */ missing?: boolean; /** The zoom that the tile was built for (see `buildZoom`). */ band?: number; /** A number that changes each time the state or the content of the tile changes. */ rev?: number; /** Elevation tiles shaping 3D terrain: the lowest and highest ground on the tile, in meters. */ range?: [number, number]; /** An elevation tile: its heights, for when it shapes 3D terrain (see `ground`). */ dem?: {grid: Float32Array; lo: number; hi: number}; used: number; cancel(): void; /** A failed load: how many loads of this tile have failed, and when it is requested again. */ tries?: number; retryAt?: number; /** Built, and waiting for its turn to be uploaded: it is not canceled when it leaves the view. */ built?: boolean; /** Shown, but built from data that has since changed. */ stale?: boolean; rebuilding?: boolean; /** The tile worker that loaded the tile. */ backend?: number; /** The rules of the style that the tile was built for (see `sourceSignature`). */ rules?: string }
/**
 * A label that is shown or fading. `drawn` is the copy of `placed` that the frames move with the map; it is made once
 * for each placement and changed in place in each frame, so that a frame makes no new object for a label (#692).
 */
interface LabelState { placed: Placed; opacity: number; target: number; drawn?: Placed; drawnFrom?: Placed; turned?: boolean }

const raf: (cb: (t: number) => void) => unknown = globalThis.requestAnimationFrame
    ? cb => globalThis.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 16);
const MAX_TILES = 160;
/** How long the zoom must be still before new contour tiles are made, in milliseconds. */
const CONTOUR_WAIT = 250;
/** At most this many tiles of each source are requested early for one movement (#361). */
const PREFETCH_TILES = 6;
/** How often labels are re-decided while the map moves, and how long they take to fade. Between decisions they stay pinned to the map. */
const PLACE_INTERVAL = 250, FADE = 200;
/** While the zoom is changing quickly labels crowd together (or thin out) fast, so decide and fade sooner. */
const ZOOMING_PLACE_INTERVAL = 100, ZOOMING_FADE = 100;
/**
 * Says whether the labels are placed again in this frame. `now` and `last` are the times of this frame and of the last
 * placement, and `cost` is how long the last placement took, all in milliseconds. While the camera moves, the time
 * between two placements is at least three times the cost: with many labels a placement can take longer than the
 * interval, and the map would place the labels again in every frame (#122). When the camera has stopped, the usual
 * interval applies, so that the labels settle soon. With `rest` (the map is at rest, or has not been idle yet) the labels
 * are placed in the next frame, as in MapLibre GL JS, so that the labels of a tile that has just arrived do not hold
 * up `idle` (#371); the time between two placements is still at least the cost of one.
 */
export const placeDue = (now: number, last: number, cost: number, zooming: boolean, moving: boolean, rest = false) =>
    now - last >= (rest ? cost : Math.max(zooming ? ZOOMING_PLACE_INTERVAL : PLACE_INTERVAL, moving ? 3 * cost : 0));
/**
 * The opacity of a label after `dt` ms of a fade of `fade` ms toward `target` (0 or 1). Before the first `idle` of the
 * map (`instant`), a label shows or hides at once, as MapLibre GL JS 6.17 does with a fade duration of 0 until its first
 * `idle` (#371): a label pushed out by the labels of a later tile must not hold `idle` back for a fade.
 */
export const fadeStep = (opacity: number, target: number, dt: number, fade: number, instant: boolean) =>
    instant ? target : target ? Math.min(1, opacity + dt / fade) : Math.max(0, opacity - dt / fade);
/** Camera feel, matching MapLibre's defaults so the map responds the way people expect. */
/**
 * The curve of flyTo (van Wijk and Nuij, as `flyTo` of MapLibre GL JS 6.17) from `tr` to `to`. `o` is [curve, speed,
 * screenSpeed, minZoom, maxDuration, 1 when the duration follows from the distance]. Returns [r0, rho, S, the factor of
 * u, the sign of an exponential zoom when the center does not move (else 0), the duration in milliseconds]; S is 0 when
 * the camera eases instead (nothing to fly, or longer than maxDuration, which is then a jump).
 */
function flight(tr: Transform, to: Transform, [rho, speed, screenSpeed, minZoom, maxDuration, auto]: number[], given: number, globe = false) {
    const [pt, pr, pb, pl] = to.padding, world = tr.worldSize;
    // On the globe (as in MapLibre GL JS): the zooms are those of the same size of the globe at the equator (see
    // `keepSize`), and the length of the way is that of the great circle on the globe at the start, in pixels.
    const z = (t: Transform, zoom = t.zoom) => globe ? zoom + keepSize(t.lat, 0) : zoom, z0 = z(tr), z1 = z(to);
    const cos = (lat: number) => Math.cos(lat * Math.PI / 180), arc = () => Math.acos(clamp(Math.sin(tr.lat * Math.PI / 180) * Math.sin(to.lat * Math.PI / 180) + cos(tr.lat) * cos(to.lat) * cos(to.lng - tr.lng), -1, 1));
    const u1 = globe ? arc() * world / (2 * Math.PI * cos(Math.min(Math.abs(tr.lat), 85.051129))) : Math.hypot((mercX(to.lng) - mercX(tr.lng)) * world, (mercY(to.lat) - mercY(tr.lat)) * world);
    const w0 = Math.max(tr.width - pl - pr, tr.height - pt - pb), w1 = w0 / 2 ** (z1 - z0);
    if (minZoom > -99) rho = Math.sqrt(w0 / 2 ** (Math.max(z(to, tr.minZoom), Math.min(z(to, minZoom), z0, z1)) - z0) / u1 * 2);
    const rho2 = rho * rho, zr = (i: number) => {
        const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
        return Math.log(Math.sqrt(b * b + 1) - b);
    };
    const r0 = zr(0);
    let S = (zr(1) - r0) / rho, sign = 0;
    if (u1 < 2e-6 || !isFinite(S)) {
        sign = w1 < w0 ? -1 : 1;
        S = Math.abs(Math.log(w1 / w0)) / rho;
    }
    const duration = 1000 * S / (screenSpeed ? screenSpeed / rho : speed);
    const jump = auto && duration > maxDuration;
    // (Nothing to fly: the camera eases, in 500 ms as easeTo does when no duration is given.)
    const still = Math.abs(w0 - w1) < 1e-6 && sign;
    return [r0, rho, jump || still ? 0 : S, w0 / u1 / rho2, sign, jump ? 1 : !auto ? given : still ? 500 : duration];
}
/**
 * The center at the part `t` of a way on the globe, as MapLibre GL JS's `interpolateLngLatForGlobe`: the latitude
 * changes evenly, and the longitude at a speed of 1 / cos(latitude), so that the globe seems to turn evenly.
 */
function globeWay([lng0, lat0, dLng, dLat]: number[], t: number): [number, number] {
    const a = clamp(lat0, -85.051129, 85.051129), b = clamp(lat0 + dLat, -85.051129, 85.051129), lat = clamp(lat0 + dLat * t, -90, 90);
    let part = t;
    if (Math.abs(b - a) > 1) {
        // (The integral of 1 / cos(x).)
        const sec = (x: number) => { const s = Math.sin(x / 2), c = Math.cos(x / 2); return Math.log(s + c) - Math.log(c - s); };
        const s0 = (Math.sign(a) !== Math.sign(b) ? -Math.abs(a) : Math.abs(a)) * Math.PI / 180, s1 = Math.abs(b) * Math.PI / 180;
        part = (sec(s0 + t * (s1 - s0)) - sec(s0)) / (sec(s1) - sec(s0));
    }
    return [((lng0 + dLng * part) % 360 + 540) % 360 - 180, lat];
}
const defaultEasing = bezier(0.25, 0.1, 0.25, 1), inertiaEasing = bezier(0, 0, 0.3, 1);
const WHEEL_STEP = 4.000244140625, WHEEL_RATE = 1 / 450, TRACKPAD_RATE = 1 / 100;

/**
 * Everything that happens per frame: camera animation, tile selection, label placement and drawing.
 * It never touches the DOM, so it runs unchanged on the main thread or inside a worker with an OffscreenCanvas,
 * driven purely by `Command` messages and reporting back through `EngineEvent`s.
 */
/** Whether two tiles cover some of the same ground: one is the other, or contains it. */
const touches = (a: TileID, b: TileID) => {
    const d = a.z - b.z;
    return a.w === b.w && (d >= 0 ? a.x >> d === b.x && a.y >> d === b.y : b.x >> -d === a.x && b.y >> -d === a.y);
};

/** How many times a tile whose request failed is requested again. */
const TILE_RETRIES = 3;
/** After the last of those, the milliseconds until the next request, for as long as the view needs the tile (#686). */
const TILE_RETRY_LATER = 15000;
/** Encodes GeoJSON data as JSON bytes on the first call, so that several tile workers cost one encoding and a copy of bytes each, not one structured clone each (#878). Data that is not an object is sent as it is. */
function packGeoJSON(data: unknown): () => Uint8Array | null {
    let bytes: Uint8Array | null | undefined;
    return () => bytes !== undefined ? bytes : (bytes = data && typeof data === 'object' ? new TextEncoder().encode(JSON.stringify(data)) : null);
}

export class Engine {
    tr = new Transform();
    private renderer: GLRenderer;
    private atlas: GlyphAtlas;
    private style!: ResolvedStyle;
    private layers: CompiledLayer[] = [];
    private tiles = new Map<string, TileState>();
    private frameNo = 0;
    /** The layers whose fonts the glyph atlas has looked up (see `GlyphAtlas.warm`). */
    private warmed?: CompiledLayer[];
    private scheduled = false;
    private nextReq = 1;
    private nextBackend = 0;
    private lastCamera = '';
    /** `lastCamera` without the height of the ground and the exaggeration of the terrain. */
    private lastView = '';
    private wasIdle = false;
    private inResize = false;
    /** The map has been idle once: the overview tiles wait for that (#326). */
    private wentIdle = false;
    /** When the previous frame began (performance.now()). */
    private lastFrameAt = 0;
    /** The view at the end of the movement under way, its tiles are requested early (#361). */
    private target: Transform | null = null;
    /** Tiles requested for a target that are on their way: they finish when a newer movement replaces it (#361). */
    private early = new Set<string>();
    /** When the engine started. A map that never becomes idle (a long animation, a style that keeps repainting) requests
     * its overview this long after the start instead: 3 s is past the first idle of a usual map here, and short enough
     * that a fast pan still lands on blurry map (#326). */
    private readonly born = performance.now();
    private seq = 0;
    private moving = false;

    private ease: {from: number[]; to: number[]; start: number; duration: number; around?: [number, number]; anchor?: [number, number]; easing?: number[]; fly?: number[]; globe?: boolean; way?: number[]} | null = null;
    private wheel: {
        delta: number; kind: 'wheel' | 'trackpad'; x: number; y: number; lastEvent: number;
        target?: number; start?: number; easing?: (t: number) => number; doneAt?: number;
    } | null = null;
    private prevWheelEase: {start: number; easing: (t: number) => number} | null = null;
    private fling: {dx: number; dy: number; start: number; duration: number; done: number} | null = null;
    private lastTime = 0;

    private labels = new Map<string, LabelState>();
    private placeDirty = true;
    /** For the delay of contour tiles while the zoom changes: the time of this frame, when the zoom last changed, and if a tile waits. */
    private frameTime = 0;
    private zoomMovedAt = -1e9;
    private zoomSeen = NaN;
    private contourWait = false;
    private reportFrames = false;
    private drew = false;
    private pinged = 0;
    /** The `snapshot` commands that wait for the next frame. */
    private shots: Extract<Command, {type: 'snapshot'}>[] = [];
    /** The WebGL context is gone: nothing more is drawn. */
    private lost = false;
    // Requests that the page can change. This thread and the tile workers ask the page through `ask`.
    private rules?: RequestRules;
    private asked = new Map<number, (a: RequestAnswer) => void>();
    private nextAsk = 0;
    private ask: Ask = (url, kind) => new Promise(done => { this.asked.set(++this.nextAsk, done); this.emit({type: 'resource', id: this.nextAsk, url, kind}); });
    private fetchAs = (kind: string) => fetchWith(() => this.rules, this.ask, kind);
    /** When the camera last changed. A short time after that still counts as movement, so that a pause in a gesture does not start costly work. */
    private cameraMovedAt = -1e9;
    /** How many sprite and font downloads are in progress. */
    private spritePending = 0;
    /** When the last paint transition ends (#960): the map draws until then and is not idle. */
    private transitionEnd = 0;
    /** The answers that the page requested before the engine started, while the first style is set. */
    private answered?: Map<string, Promise<Response>>;
    private lastPlace = -Infinity;
    /** How long the last placement took, in milliseconds. */
    private placeCost = 0;
    private placeAngle = 0;
    private placeZoom = 0;
    private fade = FADE;
    /** The tiles (`TileID.key`) that arrived in the last half second, with the time: at rest, their new labels show without a fade. */
    private freshTiles = new Map<string, number>();

    private sprite: Sprite | null = null;
    private spriteUrl = '';
    private styleFonts = '';
    /** The web fonts that were given to the browser, as text (see `loadFonts`). */
    private fontsLoaded = new Set<string>();
    private images = new Map<string, SpriteIcon & {custom: true}>();
    private missing = new Set<string>();
    /** The images of the map changed (`iconsRev` counts the changes): the icons that the tiles have in buffers are made again. */
    private iconsRev = 0;
    private iconsDone = 0;
    /** The last change that a frame saw, when it saw it, and when the first change since the last refresh was. */
    private iconsSeen = 0;
    private iconsLast = 0;
    private iconsSince = 0;
    /** An image that the map had is gone or has another place: each buffer is made again, not only those that wait for an image. */
    private iconsAll = false;
    private dem = new Map<string, Promise<{width: number; height: number; data: Uint8ClampedArray} | null>>();
    private dpr = 1;

    constructor(private canvas: HTMLCanvasElement | OffscreenCanvas, o: EngineOptions, private backends: TileBackend[], private emit: (e: EngineEvent) => void) {
        this.renderer = new GLRenderer(canvas, o.antialias);
        this.renderer.iconOf = this.icon;
        (canvas as EventTarget).addEventListener('webglcontextlost', () => { if (!this.lost) { this.lost = true; this.emit({type: 'contextlost'}); } }); // (not when the map itself freed the context)
        this.atlas = new GlyphAtlas(o.fontFamily);
        this.atlas.images = name => this.icon(name);
        this.atlas.onReset = () => this.labels.clear();
        this.atlas.fetchGlyphs = withTimeout(this.fetchAs('Glyphs'));
        this.atlas.onGlyphs = () => this.glyphsArrived();
        this.tr.width = o.width;
        this.tr.height = o.height;
        this.dpr = o.dpr;
        this.renderer.resize(o.width, o.height, o.dpr);
        Object.assign(this.tr, {minZoom: o.minZoom ?? -2, maxZoom: o.maxZoom ?? 22, maxPitch: o.maxPitch ?? 60});
        // (The projection decides how the camera is kept on the map: a globe is not kept inside the height of the world.)
        this.tr.globeStops = globeStops(o.style.projection?.type);
        this.tr.set(o.center, o.zoom, o.bearing, o.pitch);
        if (o.requests) { this.rules = o.requests; for (const b of backends) b.setRequests(o.requests, this.ask); }
        this.answered = o.early;
        this.setStyle(o.style, true);
        this.answered = undefined;
        if (o.fonts?.length) this.loadFonts(o.fonts);
    }

    /**
     * A glyph file has arrived: the labels that waited for it can be placed now. The labels on the map keep their
     * state (they did not use the file: a label waits for all its glyphs), so they do not vanish and fade in again.
     * (Clearing them here made all labels blink after a change of the view that needed a new glyph file, such as the
     * switch from the globe to the flat map: #463.)
     */
    private glyphsArrived() {
        this.lastPlace = -Infinity;
        this.invalidate();
    }
    /** Throws away placed labels (their shaped text is stale) and places again from scratch. */
    private relabel() {
        this.labels.clear();
        this.lastPlace = -Infinity;
        this.invalidate();
    }

    /** Counts elevation tiles arriving, so heights derived from them (under markers) are refreshed. */
    private demVersion = 0;
    /** The elevation tiles that arrived last, with the version that each one made and its extent (mercator, 0 to 1). */
    private demArrivals: {version: number; x0: number; y0: number; x1: number; y1: number}[] = [];
    /** True if elevation data that touches a ground tile arrived after `version`. */
    private groundChanged(id: TileID, version: number) {
        if (version === this.demVersion) return false;
        const a = this.demArrivals, n = 2 ** id.z, x0 = id.x / n, y0 = id.y / n, x1 = (id.x + 1) / n, y1 = (id.y + 1) / n;
        if (!a.length || a[0].version > version + 1) return true; // older than what is remembered
        // (Tiles that only touch count: the heights on an edge of a tile come from its neighbor.)
        for (const d of a) if (d.version > version && d.x0 <= x1 && d.x1 >= x0 && d.y0 <= y1 && d.y1 >= y0) return true;
        return false;
    }
    /** `version` is the elevation data that the heights were made from; `checked` is the newest data that is known not to change them. */
    private meshHeights = new Map<string, {data: Float32Array; version: number; checked: number; used: number}>();
    private meshBehind = false;
    /** 3D terrain: a ground picture still waits for tiles of its sources, and `idle` waits for them too (#1493). */
    private groundWaits = false;
    /** 3D terrain: an elevation tile that the ground needs is still loading in this frame. */
    private demLoading = false;
    private grab: {lng: number; lat: number; at: number; seq: number} | null = null;
    /** 3D terrain: the center was set by the API rather than reached by a gesture, so it keeps its position. */
    private centreGiven = true;
    private unplacedSince = 0;
    private easeHeights: {ease: unknown; from: number} | null = null;
    /** 3D terrain: height of the ground at the map center in real (unexaggerated) meters. */
    private rawElevation = 0;
    private lastPose = '';
    private movedAt = -1e9;
    /** When the center last took the height of the ground (a center set outright is not moved along the line of sight before the map moves, as in MapLibre GL JS, #1480). */
    private placedAt = -1e9;
    private lastTilt = '';
    private tiltedAt = -1e9;
    /** 3D terrain: the exaggeration in force this frame (zero when looking straight down, or with no terrain). */
    private exaggeration = 0;
    /** Counts changes to the style and its images, so cached terrain pictures know when they are out of date. */
    private styleVersion = 0;
    /** The parameters of `setSourceTileLodParams` by source. */
    private lod: Record<string, number[]> = {};
    private invalidate() { this.placeDirty = true; this.repaint(); }

    /** The deepest loaded elevation tile at or above a position, and its zoom. */
    /** Meters by which the ground reaches above the camera or above 9 points of the near clipping plane (MapLibre's 1/50 of the height); 0 or less while clear. */
    private terrainAboveCamera(tr: Transform): number {
        const [cx, cy, ch] = tr.cameraPosition(), ws = tr.worldSize, ppm = tr.pixelsPerMetre, d = tr.cameraDistance, n = tr.height / 50;
        const p = tr.pitch * Math.PI / 180, a = -tr.bearing * Math.PI / 180, sa = Math.sin(a), ca = Math.cos(a), sp = Math.sin(p), cp = Math.cos(p);
        let lift = this.heightAt(cx, cy) - ch;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
            // A point of the near plane: forward n pixels, then sideways and up by the half sizes of the plane.
            const x = i * n * tr.width / 2 / d, y = j * n * tr.height / 2 / d;
            const px = -sa * sp * n + ca * x - sa * cp * y, py = -ca * sp * n - sa * x - ca * cp * y, pz = -cp * n + sp * y;
            lift = Math.max(lift, this.heightAt(cx + px / ws, cy + py / ws) - (ch + pz / ppm));
        }
        return lift;
    }

    private demTile(x: number, y: number, z: number): {t: TileState; z: number} | null {
        const terrain = this.style.terrain, src = terrain && this.style.sources[terrain.source];
        if (!src) return null;
        for (let tz = Math.min(z, src.maxzoom); tz >= src.minzoom; tz--) {
            const n = 2 ** tz, t = this.tiles.get(`${terrain!.source}|${tz}/${Math.floor(x * n)}/${Math.floor(y * n)}`);
            if (t?.state === 'ok' && t.gl?.raw) return {t, z: tz};
        }
        return null;
    }

    /** Ground height at a mercator position in meters (exaggerated), from the best elevation tile loaded so far. */
    private heightAt = (mx: number, my: number): number => this.rawHeightAt(mx, my) * this.exaggeration;
    /** Height grids of the loaded elevation tiles, keyed "z/x/y"; mirrored to the page so it can project onto the ground too. */
    private heights = new Map<string, Float32Array>();
    private rawHeightAt(mx: number, my: number): number {
        const src = this.style.terrain && this.style.sources[this.style.terrain.source];
        return src ? groundHeight(this.heights, mx, my, src.maxzoom, src.minzoom, this.rawElevation) : 0; // where nothing is known yet, level with the center; // always the most detailed data, so heights do not shift with zoom
    }

    /**
     * Heights at the 65 x 65 corners of a ground tile's mesh. Nearly all of them lie inside one elevation tile's grid
     * and are read straight from it; only points on the far edges (which belong to the neighboring tiles) and tiles
     * with no single grid under them go through the general lookup.
     */
    private fillMesh(data: Float32Array, id: TileID) {
        const n = 2 ** id.z, G = HEIGHT_GRID, src = this.style.sources[this.style.terrain!.source];
        let grid: Float32Array | undefined, gz = Math.min(id.z, src.maxzoom);
        for (; gz >= src.minzoom && !grid; gz--) grid = this.heights.get(`${gz}/${id.x >> (id.z - gz)}/${id.y >> (id.z - gz)}`);
        gz++;
        // The grid found is the deepest that is loaded at or above the level of this tile, which is also what the general
        // lookup finds for the points inside the tile. So the points inside are read straight from it.
        const direct = !!grid, k = 2 ** (id.z - gz), ox = (id.x % k) / k, oy = (id.y % k) / k;
        for (let j = 0; j <= 64; j++) {
            for (let i = 0; i <= 64; i++) {
                if (direct && i < 64 && j < 64) {
                    const fx = clamp((ox + i / 64 / k) * G - 0.5, 0, G - 1), fy = clamp((oy + j / 64 / k) * G - 0.5, 0, G - 1);
                    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(G - 1, x0 + 1), y1 = Math.min(G - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
                    data[j * 65 + i] = (grid![y0 * G + x0] * (1 - tx) + grid![y0 * G + x1] * tx) * (1 - ty) + (grid![y1 * G + x0] * (1 - tx) + grid![y1 * G + x1] * tx) * ty;
                } else data[j * 65 + i] = this.rawHeightAt((id.x + i / 64) / n, Math.min((id.y + j / 64) / n, 1 - 1e-12));
            }
        }
    }

    /**
     * Tiles built by the workers, waiting to be sent to the GPU. Sending is the most expensive thing the drawing
     * thread does when tiles arrive, and several often arrive together, so each frame sends only a limited amount.
     */
    private uploads: {bytes: number; make(): GLTile; done(gl: GLTile): void}[] = [];
    private upload(tile: TileGL, wanted: () => boolean): Promise<GLTile> {
        let bytes = 0;
        for (const b of Object.values(tile.layers)) for (const v of Object.values(b)) if (ArrayBuffer.isView(v)) bytes += v.byteLength;
        // (A tile that is no longer wanted when its turn comes is not sent.)
        return this.paced(bytes, () => wanted() ? this.renderer.createTile(tile) : {labels: {}, batches: {}});
    }
    /** Does a piece of GPU upload work in its turn, so that one frame never has too much of it. */
    private paced(bytes: number, make: () => GLTile): Promise<GLTile> {
        return new Promise(done => { this.uploads.push({bytes, make, done}); this.repaint(); });
    }
    private flushUploads(paced = true) {
        // While the camera moves, about 4 ms of upload work a frame. Before the first idle and while the camera is still,
        // no movement is smooth to keep, so a frame does up to 24 ms, which saves a frame for most tiles that waited and
        // still answers input soon (#436). A frame always uploads at least one tile, so that progress is certain.
        for (const t0 = performance.now(), ms = paced ? 4 : 24; this.uploads.length && performance.now() - t0 < ms;) {
            const u = this.uploads.shift()!;
            u.done(u.make());
        }
        if (this.uploads.length) this.repaint();
    }

    private pictures = new Map<string, {url?: string; gl?: GLTile; /** The picture is on its way: the map is not idle (as in MapLibre GL JS, a picture that fails to load no longer holds it). */ loading?: boolean}>();
    /** The picture of an image, video or canvas source, made again when its URL changes. */
    private picture(source: string) {
        const url = this.style.sources[source].url;
        let st = this.pictures.get(source);
        if (!st || st.url !== url) {
            if (st?.gl) this.renderer.destroyTile(st.gl);
            this.pictures.set(source, st = {url});
        }
        return st;
    }
    /**
     * An image source is one picture stretched between four corners. It is drawn like a tile: positioned relative to
     * a tile near the view's center (which keeps the numbers small and exact), reaching outside it as far as it needs.
     * A video or canvas source has no URL: its pictures are the frames that the page sends (`frame`).
     */
    private pictureItems(source: string, tr: Transform): RenderItem<GLTile>[] {
        const src = this.style.sources[source], had = this.pictures.get(source);
        const st = this.picture(source);
        if (st !== had && src.url) {
            const state = st;
            state.loading = true;
            withTimeout(this.fetchAs('Image'))(src.url!).then(async res => {
                if (!res.ok) throw httpError('image', src.url!, res.status);
                const image = await createImageBitmap(await res.blob());
                if (this.pictures.get(source) === state) { state.gl = this.renderer.createImageTile(image, undefined, {z: 0, x: 0, y: 0, w: 0, key: '0/0/0'}); this.styleVersion++; this.invalidate(); }
                image.close();
            }).catch(err => this.emit({type: 'error', message: String(err.message)})).finally(() => { state.loading = false; this.invalidate(); });
        }
        if (!st.gl) return [];
        const z = clamp(Math.floor(tr.zoom), 0, 22), n = 2 ** z, cx = mercX(tr.lng) * n, w = Math.floor(cx / n);
        const id: TileID = {z, x: Math.floor(cx) - w * n, y: clamp(Math.floor(mercY(tr.lat) * n), 0, n - 1), w, key: ''};
        const corners = src.coordinates!.flatMap(([lng, lat]) => [(mercX(lng) * n - (id.x + w * n)) * EXTENT, (mercY(lat) * n - id.y) * EXTENT]);
        const item = (shift: number): RenderItem<GLTile> => ({id, corners: corners.map((v, i) => i % 2 ? v : v + shift * n * EXTENT), matrix: tr.tileMatrix(id), matrix4: tr.tileMatrix4(id), scale: tr.worldSize / n / EXTENT, clip: [-1e9, -1e9, 1e9, 1e9], tile: st!.gl!});
        // The picture is in each copy of the world: the view can show two copies at the 180 degree meridian.
        const lngs = src.coordinates!.map(c => c[0]), west = Math.min(...lngs), east = Math.max(...lngs), reach = 360 * Math.max(tr.width, tr.height) / tr.worldSize;
        return [-1, 0, 1].filter(k => east + k * 360 > tr.lng - reach && west + k * 360 < tr.lng + reach).map(item);
    }

    /** The heights under a tile, for the GPU. */
    private demRef = (id: TileID): DemRef | null => {
        const n = 2 ** id.z, found = this.demTile((id.x + 0.5) / n, (id.y + 0.5) / n, id.z);
        if (!found) return null;
        const k = 2 ** (id.z - found.z), gl = found.t.gl!;
        return {tex: gl.raw!, rect: [(id.x % k) / k, (id.y % k) / k, 1 / k, gl.rawSize!], unpack: gl.unpack!};
    };

    /** Counts each change to the set of tiles and their state, so that work that depends on the tiles can be kept until it changes. */
    private tilesVersion = 0;
    /** 3D terrain: the tiles of an image source that the view selects, found one time for each frame. */
    private viewCovers = new Map<string, TileID[]>();
    private viewCover(source: string) {
        let cover = this.viewCovers.get(source);
        if (!cover) {
            // The elevation tiles of 3D terrain are one level less detailed than the map, as in MapLibre GL JS (it selects
            // them as tiles of twice the size, and without rounding up). The ground and the relief shading need no more,
            // and a view then needs about a quarter of the elevation data.
            const src = this.style.sources[source], ground = this.style.terrain?.source === source;
            this.viewCovers.set(source, cover = this.tr.tileCover(src.minzoom, src.maxzoom, ground ? src.tileSize * 2 : src.tileSize, !ground, this.lod[source]));
        }
        return cover;
    }
    /** The raster and elevation sources that a layer on the ground draws from. */
    private imageSources: string[] = [];
    private groundCache = new Map<string, ReturnType<Engine['groundSources']> & {used?: number}>();
    /** 3D terrain: the straight-down view of one ground tile, and the source tiles that are drawn into its picture. */
    private groundSources(id: TileID, zt: number, stamp: string) {
        const n = 2 ** id.z, view = new Transform(), keys: string[] = [];
        // The picture is drawn once, at a fixed scale a little above the tile's own (it is shown at up to twice its size
        // before finer tiles take over), and stretched as the map zooms. Zooming therefore redraws nothing.
        view.width = view.height = TILE_SIZE * 2 ** (zt - id.z);
        view.lng = lngFromMerc((id.x + 0.5) / n); view.lat = latFromMerc((id.y + 0.5) / n); view.zoom = zt;
        const cover = new Transform();
        Object.assign(cover, {lng: view.lng, lat: view.lat});
        const items = new Map<string, RenderItem<GLTile>[]>();
        let complete = true;
        let signature = `${zt}|${this.styleVersion}`;
        for (const source in this.style.sources) {
            const src = this.style.sources[source];
            if (!this.layers.some(l => l.source === source && l.type !== 'symbol' && l.type !== 'fill-extrusion' && l.type !== 'circle' && l.visible && zt >= l.minzoom && zt < l.maxzoom)) continue;
            if (src.coordinates) { const list = this.pictureItems(source, view); items.set(source, list); signature += `,${source}:${list[0]?.tile.uid ?? ''}`; continue; }
            // Vector tiles are of the level of the ground tile. Image tiles (raster, elevation) are those that the view
            // itself selects, by the rule of MapLibre for each image tile: the ones that touch this ground tile are drawn
            // into it. (Near the camera they are finer than the ground tile, far away they can be coarser.)
            const image = src.type === 'raster' || src.type === 'raster-dem';
            cover.zoom = id.z;
            // (A little less than the tile: a view that ends exactly on the tile's edge would take the tiles beyond it too.)
            cover.width = cover.height = TILE_SIZE - 2;
            const ideal = image ? this.viewCover(source).filter(t => touches(t, id)) : cover.tileCover(src.minzoom, src.maxzoom, src.tileSize);
            for (const t of ideal) {
                const key = source + '|' + t.key, have = this.tiles.get(key);
                keys.push(key);
                if (!have) this.request(source, t, key);
                else this.refresh(source, t, key, have);
                if (this.tiles.get(key)?.state === 'loading') complete = false;
            }
            const list = renderItems(view, ideal, k => {
                const key = source + '|' + k, t = this.tiles.get(key);
                if (t?.state !== 'ok' || t.missing) return undefined;
                keys.push(key); // a stand-in tile of another level: it is in use too
                return t.gl;
            });
            items.set(source, list);
            // The picture depends on exactly these tiles (and which build of each), so that is what identifies it.
            for (const it of list) signature += `,${it.id.key}:${it.tile.uid}`;
        }
        // (A tile that waits to be requested, as contour tiles do while the zoom changes, is not there yet: the picture is not complete.)
        let revs = 0;
        for (const k of keys) { const t = this.tiles.get(k); if (t) { t.used = this.frameNo; revs += t.rev!; } else { revs = NaN; complete = false; } }
        return {stamp, view, items, signature, complete, keys, revs, version: this.tilesVersion};
    }

    /** 3D terrain: the ground tiles in view, each with a straight-down view of itself for drawing its picture. */
    private terrainTiles(wanted: Set<string>): TerrainTile[] {
        const tr = this.tr, terrain = this.style.terrain!, demSrc = this.style.sources[terrain.source], out: TerrainTile[] = [];
        let meshBudget = 4;
        this.meshBehind = false;
        this.groundWaits = false;
        this.demLoading = false;
        this.viewCovers.clear();
        for (const [k, m] of this.meshHeights) if (this.frameNo - m.used > 120) this.meshHeights.delete(k);
        for (const [k, m] of this.groundCache) if (this.frameNo - (m.used ?? 0) > 120) this.groundCache.delete(k);
        const viewLit = this.layers.some(l => l.type === 'hillshade' && l.visible && l.p.anchor.eval(tr.zoom) === 'viewport');
        for (const id of tr.tileCover(0, 22, TILE_SIZE).slice(0, 96)) { // nearest first; a cap keeps odd views affordable
            // Each tile's picture is drawn once for a whole level of zoom: with the style as it is three quarters of the way
            // through the level of the map, and stretched as the map zooms inside that level. A ground tile can be of a
            // coarser level than the map (far ground, and with a steep tilt also the ground at the center) or of a finer one
            // (ground near the camera). Its picture still uses the style of the map's level, as in MapLibre: the same layers
            // show, and lines have the same width.
            const zt = Math.floor(tr.zoom) + 0.75, tkey = `${id.key}|${id.w}`;
            // Which source tiles make the picture of this ground tile is much work for each of up to 96 tiles. The answer
            // changes only when a tile arrives or goes, the style changes, the map zooms to another level of tiles, or (for
            // relief that is lit from the viewer's side) the map turns. Until then the last answer is used.
            let stamp = `${this.styleVersion}|${zt}`;
            for (const source of this.imageSources) for (const t of this.viewCover(source)) if (touches(t, id)) stamp += '|' + t.key;
            let made = this.groundCache.get(tkey), revs = 0;
            if (made) for (const k of made.keys) { const t = this.tiles.get(k); if (t) { t.used = this.frameNo; revs += t.rev!; } else revs = NaN; }
            // A picture that has all its tiles depends on those tiles only. One that still waits for tiles can also get a
            // stand-in from any other tile, so it is worked out again when any tile changes.
            if (!made || made.stamp !== stamp || (made.complete ? revs !== made.revs : this.tilesVersion !== made.version)) {
                made = this.groundSources(id, zt, stamp);
                this.groundCache.set(tkey, made);
            }
            made.used = this.frameNo;
            for (const k of made.keys) wanted.add(k);
            if (!made.complete) this.groundWaits = true;
            const {view, items, signature, complete} = made;
            // The heights themselves: make sure the elevation tiles for this ground tile are on their way. They are the
            // tiles that the view selects for the source, which are also the ones that relief shading of the same source
            // draws: the two then load one set of tiles, also when the relief layer is added after the terrain. Where the
            // source has no tile at a level (the request failed), the nearest level above that does have one is used.
            for (const t of this.viewCover(terrain.source)) if (touches(t, id)) for (let dz = t.z; dz >= demSrc.minzoom; dz--) {
                const x = t.x >> t.z - dz, y = t.y >> t.z - dz, dk = `${dz}/${x}/${y}`, demKey = terrain.source + '|' + dk;
                wanted.add(demKey);
                const dem = this.tiles.get(demKey);
                if (!dem) { this.request(terrain.source, {z: dz, x, y, w: 0, key: dk}, demKey); this.demLoading = true; break; }
                dem.used = this.frameNo;
                // (A loading elevation tile holds `idle` back: no layer may draw the source, and then nothing else waits for it, #820.)
                if (dem.state === 'loading') this.demLoading = true;
                if (dem.state === 'loading' || dem.range) break; // otherwise it failed or came back empty: try the level above
            }
            // A coarse elevation tile of the surroundings stays loaded as well (one tile covers many ground tiles). Ground
            // that comes into view next to the camera then has its shape and a soft relief at once, not a flat slab
            // until its own tiles arrive.
            const oz = Math.max(demSrc.minzoom, Math.min(demSrc.maxzoom, Math.floor(tr.zoom)) - 3);
            if (id.z > oz) {
                const x = id.x >> id.z - oz, y = id.y >> id.z - oz, dk = `${oz}/${x}/${y}`, demKey = terrain.source + '|' + dk, dem = this.tiles.get(demKey);
                wanted.add(demKey);
                if (dem) dem.used = this.frameNo; else this.request(terrain.source, {z: oz, x, y, w: 0, key: dk}, demKey);
                if (!dem || dem.state === 'loading') this.demLoading = true;
            }
            // Heights for the tile's mesh, looked up by position in data all tiles share (so edges meet exactly), and
            // refreshed a few tiles per frame when new elevation data arrives.
            let mesh = this.meshHeights.get(tkey);
            // A mesh that the new elevation data does not touch is up to date as it is.
            if (mesh && mesh.checked !== this.demVersion && !this.groundChanged(id, mesh.checked)) mesh.checked = this.demVersion;
            if (!mesh || (mesh.checked !== this.demVersion && meshBudget-- > 0)) {
                const data = mesh?.data ?? new Float32Array(65 * 65);
                this.fillMesh(data, id);
                this.meshHeights.set(tkey, mesh = {data, version: this.demVersion, checked: this.demVersion, used: 0});
            }
            if (mesh.checked !== this.demVersion) this.meshBehind = true;
            mesh.used = this.frameNo;
            // Relief shading that is lit from the viewer's side turns with the map: the picture is drawn again when the
            // map has turned a dozen degrees (the renderer waits until the map is still, see updateDrapes).
            out.push({id, key: tkey, matrix: tr.tileMatrix4(id), view, items, signature, light: viewLit ? Math.round(tr.bearing / 12) : 0, complete, dem: this.demRef(id), heights: mesh.data, heightsVersion: mesh.version});
        }
        return out;
    }

    /** Per source: what its tiles were fetched from, and what they were built with. */
    private sourceLoaded = new Map<string, number>();
    private versions: Record<string, number> = {};
    private sourceSigs = new Map<string, [string, string]>();
    /**
     * A switch from Mercator to the globe that waits for the cut tiles: until then the map is drawn in Mercator. (A
     * tile without the cut has long triangles, which cut through the sphere near its edge, so that the background
     * showed through in wedges until the cut tiles arrived: #463.)
     */
    private globeWait: {stops: number[]; since: number} | null = null;
    /** What the tile workers last got from `setStyle` and `setContours`: they get it again only when it changes. */
    private sentRules?: string;
    private sentContours?: string;
    /** The global state of this map (see `MapStates`). The tile builders have the feature state. */
    private states: MapStates = {g: {}, f: {}};

    /**
     * `data`: the data of the GeoJSON sources that are new or changed. Without it (at the start), the sources of `style`
     * carry their data. The engine does not keep the data: the tile workers have it.
     */
    /** The sources with `encoding: 'custom'` whose factors got the message of `setStyle`. */
    private toldEncoding = new Set<string>();

    private setStyle(style: ResolvedStyle, reload: boolean, data?: Record<string, unknown>, instant?: boolean) {
        // (A new style can have an image that the style before did not have: the engine asks the page again, #628.)
        if (reload) this.missing.clear();
        // A source that the new style removes or replaces drops its values of setSourceTileLodParams, as in MapLibre GL JS (#1059).
        for (const id in this.lod) if (this.style?.sources[id] && JSON.stringify(style.sources[id]) !== JSON.stringify(this.style.sources[id])) delete this.lod[id];
        // `encoding: 'custom'` of a `raster-dem` source (#590): the factors and the shift come from the style or from a
        // TileJSON as they are. When one is not a finite number, the source and its contours are read as `mapbox`.
        for (const [name, src] of Object.entries(style.sources)) {
            const bad = (e?: string | number[]) => typeof e == 'object' && !e.every(Number.isFinite);
            if (src.contour && bad(src.contour.encoding)) src.contour.encoding = 'mapbox';
            if (!bad(src.encoding)) continue;
            src.encoding = 'mapbox';
            if (!this.toldEncoding.has(name)) { this.toldEncoding.add(name); console.warn(`[map-jr-gl] The source "${name}": "redFactor", "greenFactor", "blueFactor" and "baseShift" of the encoding "custom" must be finite numbers. The source is read with the encoding "mapbox". Write a number for each one, or leave it out for its default (1, 1, 1 and 0).`); }
        }
        // The globe (#463): the stops say at which zooms the projection draws it. Its code loads with the first style
        // that needs it (built into the worker file; a file of its own for the engine on the main thread), and frames
        // wait for it (see `frame`).
        // A switch from Mercator to the globe waits until the tiles that the globe draws are cut (see `holdGlobe`).
        const stops = globeStops(style.projection?.type);
        if (stops && !this.tr.globeStops && this.tiles.size) {
            // (A frame comes at the end of the wait also when no tile arrives, so that the map switches then.)
            if (!this.globeWait) setTimeout(() => this.invalidate(), 1010);
            this.globeWait ??= {stops, since: performance.now()};
        } else { this.globeWait = null; this.tr.globeStops = stops; }
        if (stops && !this.tr.globe) import('./globe.ts').then(m => { this.tr.globe = m; this.repaint(); });
        data ??= Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.type === 'geojson').map(([name, s]) => [name, s.data]));
        style = {...style, sources: Object.fromEntries(Object.entries(style.sources).map(([name, s]) => [name, s.type === 'geojson' ? {...s, data: undefined} : s]))};
        if (JSON.stringify(style.terrain) !== JSON.stringify(this.style?.terrain)) this.centreGiven = true;
        // Another source shapes the ground, or none: the elevation tiles that are loaded go in or out of the ground.
        const was = this.style?.terrain?.source, now = style.terrain?.source;
        if (was !== now) for (const [key, t] of this.tiles) { const source = key.slice(0, key.lastIndexOf('|')); if (source === was) this.ground(key, t, false); else if (source === now) this.ground(key, t, true); }
        const before = this.style;
        this.style = style;
        // The picture of an image or video source that the style no longer has is freed with its texture (#1450).
        for (const [id, st] of this.pictures) if (!style.sources[id]) { if (st.gl) this.renderer.destroyTile(st.gl); this.pictures.delete(id); }
        this.styleVersion++;
        this.states.g = style.state ?? {};
        compileFor(this.states);
        const olds = new Map(this.layers.map(l => [l.id, l])), at = performance.now();
        this.layers = style.layers.map(compileLayer).filter((l): l is CompiledLayer => !!l);
        // (The page names in the attribution only the sources that a visible layer uses, #1032.)
        this.emit({type: 'hidden', layers: this.layers.filter(l => !l.visible).map(l => l.id)});
        // (A changed paint value of a layer that stays moves to the new value over its transition, #960.)
        if (before && !instant) {
            const json = new Map(style.layers.map(l => [l.id, l]));
            for (const l of this.layers) { const was = olds.get(l.id); if (was) this.transitionEnd = Math.max(this.transitionEnd, transition(l, json.get(l.id)!, was, style.transition, at)); }
        }
        this.zoomBuilt = new Set(this.layers.filter(l => l.type === 'fill-extrusion' && Object.values(l.p).some((p: any) => p?.dd && p.zoom)).map(l => l.source));
        this.imageSources = Object.keys(style.sources).filter(name => /^raster/.test(style.sources[name].type) && this.layers.some(l => l.source === name && l.visible));
        if (style.sprite && style.sprite !== this.spriteUrl) {
            this.spriteUrl = style.sprite;
            // The map is not idle while the sprite loads: its icons are part of the first complete picture.
            this.spritePending++;
            this.loadIcons(style.sprite).catch(err => this.emit({type: 'error', message: String(err.message)})).finally(() => { this.spritePending--; this.invalidate(); });
        } else if (!style.sprite && this.spriteUrl) {
            // (A style without a sprite: the icons of the sprite before are not drawn any more.)
            this.spriteUrl = ''; this.sprite = null;
            this.iconsRev++; this.iconsAll = true; this.styleVersion++;
        }
        const faces = JSON.stringify(style.fonts ?? []);
        if (style.fonts?.length && faces !== this.styleFonts) { this.styleFonts = faces; this.loadFonts(style.fonts); }
        if (style.glyphs !== this.atlas.glyphsURL) { this.atlas.setGlyphs(style.glyphs); this.relabel(); }
        if (reload) {
            // Only the GeoJSON sources whose data or options changed are indexed again (#8).
            for (const name in data) { const src = style.sources[name]; if (src?.type === 'geojson') { const packed = packGeoJSON(data[name]); for (const b of this.backends) b.setGeoJSON(name, data[name], src.options, src.maxzoom, packed); } }
            // The page has read the first bytes of each PMTiles archive: the readers of the tiles do not fetch them again.
            for (const {head} of Object.values(style.sources)) if (head && !heads.has(head.url)) { heads.set(head.url, head.bytes); for (const b of this.backends) b.setHead(head.url, head.bytes); }
            const contours = Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.contour).map(([name, s]) => [name, s.contour!])), ids = promoteIds(style), text = JSON.stringify([contours, ids]);
            if (text !== this.sentContours) { this.sentContours = text; for (const b of this.backends) b.setContours(contours, ids); }
            // Only tiles whose contents the change can affect are touched. A changed source starts over; changed
            // layers rebuild their source's tiles in place, so the old ones stay on screen until the new are ready.
            const sigs = new Map(Object.keys(style.sources).map(name => [name, sourceSignature(style, name)]));
            // The tile workers build tiles with the rules of the layers. A change that no tile depends on (a paint value
            // that is the same for the whole layer) does not go to them.
            const rules = JSON.stringify([...sigs].map(([name, s]) => [name, s[1]]));
            if (rules !== this.sentRules) { this.sentRules = rules; for (const b of this.backends) b.setStyle(style.layers, style.state); }
            for (const [key, t] of this.tiles) {
                const name = key.slice(0, key.lastIndexOf('|')), was = this.sourceSigs.get(name), now = sigs.get(name);
                if (!was || !now || was[0] !== now[0]) this.dropTile(key, t);
                else {
                    // A tile is out of date when it was built for other rules than the present ones. (A layer that is
                    // hidden and shown again has the rules of before: its tiles are good.) A tile that is on its way
                    // was built with the rules of some moment between: it is built again.
                    const stale = t.state === 'loading' || !!t.rebuilding ? was[1] !== now[1] || !!t.stale : t.rules !== undefined && t.rules !== now[1];
                    // A stale tile that is not on screen goes: kept, it would stand in for a tile of another zoom,
                    // drawn with the rules before until its rebuild arrives (#550).
                    if (stale && t.state === 'ok' && !t.rebuilding && t.used < this.frameNo - 1) this.dropTile(key, t);
                    else if (stale !== !!t.stale) { t.stale = stale; t.rev = ++this.tilesVersion; }
                }
            }
            this.sourceSigs = sigs;
            for (const name in data) if (this.style.sources[name]) this.newData(name);
        }
        this.invalidate();
    }

    /** New data for one source: keep drawing its current tiles and rebuild them in place, so nothing blinks. */
    private newData(source: string) {
        for (const [key, t] of this.tiles) {
            if (!key.startsWith(source + '|')) continue;
            // Tiles on screen or still loading are rebuilt in place once they can be; canceling loads here
            // would starve a map that is being moved while its data updates.
            if (t.state === 'loading' || t.used >= this.frameNo - 1) { t.stale = true; t.rev = ++this.tilesVersion; } else this.dropTile(key, t);
        }
    }

    /**
     * Loads the sprite of the style: one sheet (a URL), or several sheets with ids (a list, as text). The icons of a
     * sheet with an id other than `default` have the names `id:name`. Several sheets are put into one image.
     */
    private async loadIcons(spec: string) {
        const sheets: {id: string; url: string}[] = spec[0] === '[' ? JSON.parse(spec) : [{id: 'default', url: spec}];
        // (A sheet that does not load is an error, and the icons of the other sheets are drawn.)
        const loaded = (await Promise.all(sheets.map(async ({id, url}) => {
            // (The two files of a sprite are asked for at the same time: the URL of the image does not depend on the JSON.)
            // (An answer that the page requested before the engine started is taken once; see `early` of the options.)
            const early = this.answered, got = (f: typeof fetch): typeof fetch => u => early?.get(String(u)) ?? f(u);
            const dense = this.dpr > 1, [sprite, res] = await Promise.all([loadSprite(url, dense, got(withTimeout(this.fetchAs('SpriteJSON')))), got(withTimeout(this.fetchAs('SpriteImage')))(url + (dense ? '@2x.png' : '.png'))]);
            if (!res.ok) throw httpError('sprite image', url + (dense ? '@2x.png' : '.png'), res.status);
            return {id, sprite, image: await createImageBitmap(await res.blob())};
        }).map(p => p.catch(err => { if (spec === this.spriteUrl) this.emit({type: 'error', message: String(err.message)}); })))).filter(l => !!l);
        if (spec !== this.spriteUrl || !loaded.length) return;
        const icons: Sprite['icons'] = {}, width = Math.max(...loaded.map(l => l.image.width)), height = loaded.reduce((sum, l) => sum + l.image.height, 0);
        const all = loaded.length > 1 ? new OffscreenCanvas(width, height) : null, ctx = all?.getContext('2d');
        let top = 0;
        for (const {id, sprite, image} of loaded) {
            ctx?.drawImage(image, 0, top);
            for (const name in sprite.icons) icons[id === 'default' ? name : `${id}:${name}`] = {...sprite.icons[name], y: sprite.icons[name].y + top};
            top += image.height;
        }
        this.renderer.setIcons(all ?? loaded[0].image, width, height);
        this.sprite = {icons, image: '', width, height};
        this.iconsRev++; this.iconsAll = true;
        this.styleVersion++;
        this.invalidate();
    }

    /** Loads web fonts into whichever thread the engine runs on, then redraws all text with them. */
    private loadFonts(fonts: FontSource[]) {
        const set = (globalThis as any).fonts ?? (globalThis as any).document?.fonts;
        // (A face that was loaded before is not loaded again: a new style or description with the same faces costs no request.)
        const todo = fonts.filter(f => { const key = JSON.stringify([f.family, f.src, f.weight, f.style, f.unicodeRange]); return !this.fontsLoaded.has(key) && this.fontsLoaded.add(key); });
        if (!todo.length) return;
        this.spritePending++; // fonts are also part of the first complete picture
        // (Each font loads on its own: a file that does not load is an error with its name, and the other fonts are still used.)
        Promise.all(todo.map(async f => {
            try {
                // The font file is fetched here and given to the browser as bytes. WebKit (Safari) does not load a font from a
                // URL inside a worker, and the labels then used a fallback font.
                const res = await withTimeout(this.fetchAs('Font'))(f.src);
                if (!res.ok) throw httpError('font', f.src, res.status);
                const bytes = await res.arrayBuffer();
                const face = new FontFace(f.family, bytes, {weight: String(f.weight ?? '400'), style: f.style ?? 'normal', ...(f.unicodeRange ? {unicodeRange: f.unicodeRange} : {})});
                set.add(await face.load());
            } catch (err) {
                // (A failed request already names the font and its URL: its text is used as it is, with the name of the font.)
                const m = (err as Error).message, rest = `The labels use the next font of their "text-font" instead of "${f.name ?? f.family}".`;
                this.emit({type: 'error', message: m.startsWith('[map-jr-gl]') ? `${m}. ${rest}` : `[map-jr-gl] fonts: the font "${f.name ?? f.family}" did not load from ${f.src} (${m}). The labels use the next font of their "text-font".`});
            }
        })).then(() => { this.atlas.clear(true); this.relabel(); }).finally(() => { this.spritePending--; this.invalidate(); });
    }

    /** The slots of each SVG template (see the command `templates`). */
    private slots: Record<string, string[]> = {};
    /** An image for a pattern: the name of a template with `params` names one of its variants (see `variantName`). */
    private pattern = (name: string) => this.icon(name.includes(VARIANT) ? name.split(IMAGE_OR).map(n => variantName(n, this.slots)).join(IMAGE_OR) : name);

    /**
     * Asks the page for the images of a tile that the map does not have, when the tile arrives. The page then makes them
     * while the tile goes to the GPU, and the first picture of the tile has its icons. Without this, the map asks when
     * it first draws the tile, and an image that the page draws on demand (a variant of an SVG template, an image of a
     * style) comes one round later than the tile (#628). A tile that the view does not use yet (`used` below 0: an
     * overview, a tile of the end of a movement) asks when it is drawn, so that it does not end `idle`.
     */
    private askImages(tile: {labels?: Record<string, {icon?: {name: string}}[]>; icons?: Record<string, {names: string[]}>}) {
        for (const list of Object.values(tile.labels ?? {})) for (const l of list) if (l.icon) this.icon(l.icon.name);
        for (const b of Object.values(tile.icons ?? {})) for (const name of b.names) this.icon(name);
    }
    private icon = (name: string) => {
        // `coalesce` with images: the first image that the map has, or a variant of a template (it is made when it is
        // asked for). With none, the first name is the image that is missing, as in MapLibre GL JS.
        name = pickImage(name, n => this.images.has(n) || this.sprite && Object.hasOwn(this.sprite.icons, n) || Object.hasOwn(this.slots, n.split(VARIANT)[0]));
        // (The name can come from data: `toString` is no icon of the sprite.)
        // An image of the style (`own`) takes the place of the sprite image of the same name: the page gives it on demand (#1199).
        const found = this.images.get(name) ?? (this.sprite && Object.hasOwn(this.sprite.icons, name) && !this.style?.own?.includes(name) ? this.sprite.icons[name] : undefined);
        // Ask the page for images the style names but nothing provides (once each, and only after the sprite has had its chance).
        if (!found && (this.sprite || !this.spriteUrl) && !this.missing.has(name)) {
            this.missing.add(name);
            this.emit({type: 'imagemissing', name});
        }
        return found;
    };

    command(c: Command) {
        const tr = this.tr;
        // Whatever was asked, report when the map has settled again, so callers can wait on any change.
        if (c.type !== 'query' && c.type !== 'elevation' && c.type !== 'queryRendered' && c.type !== 'ping' && c.type !== 'tileReport' && c.type !== 'tileLoads') this.wasIdle = false;
        // (The page numbers its commands. `idle` and `source` carry the last number, so that the page can tell a report
        // about a state from before its last command.)
        const seq = (c as {seq?: number}).seq;
        if (seq) this.seq = seq;
        switch (c.type) {
            case 'resize':
                tr.width = c.width; tr.height = c.height; this.dpr = c.dpr;
                this.renderer.resize(c.width, c.height, c.dpr);
                this.placeDirty = true;
                // Draw immediately: resizing clears the canvas, and waiting a frame would flash. On the page this runs in
                // the callback of the ResizeObserver, so `idle` waits for the next frame: code that runs on `idle` (a new
                // map, for example) must not change the layout in that callback (#751).
                this.inResize = true;
                try { this.frame(performance.now()); } finally { this.inResize = false; }
                this.emit({type: 'resized', width: c.width, height: c.height, dpr: c.dpr, buffer: [this.renderer.gl.drawingBufferWidth, this.renderer.gl.drawingBufferHeight]});
                return;
            case 'jump': this.stop(); if (c.padding) tr.padding = c.padding; tr.set(c.center, c.zoom, c.bearing, c.pitch); if (c.center || c.zoom !== undefined) this.centreGiven = true; break;
            case 'ease': {
                this.stop();
                const to = new Transform();
                // (The target is constrained as a jump is: it needs the size, the padding and the bounds of the map.)
                Object.assign(to, tr, {padding: c.padding ?? tr.padding});
                to.set(c.center, c.zoom, c.bearing, c.pitch);
                let db = to.bearing - tr.bearing;
                db = ((db + 180) % 360 + 360) % 360 - 180;
                // On the globe the zoom is animated as the zoom that the same size of the globe has at the equator, so
                // that the globe keeps its size while the center moves north or south (as in MapLibre GL JS).
                const globe = !!tr.globeness && !c.around, z = (t: Transform) => globe ? t.zoom + keepSize(t.lat, 0) : t.zoom;
                const fly = c.fly && flight(tr, to, c.fly, c.duration, globe);
                this.ease = {
                    from: [mercX(tr.lng), mercY(tr.lat), z(tr), tr.bearing, tr.pitch, ...tr.padding], to: [mercX(to.lng), mercY(to.lat), z(to), tr.bearing + db, to.pitch, ...(c.padding ?? tr.padding)],
                    start: performance.now(), duration: Math.max(1, fly ? fly[5] : c.duration), around: c.around, easing: c.easing, fly: fly && fly[2] ? fly : undefined,
                    anchor: c.around ? tr.unproject(c.around[0], c.around[1]) : undefined, globe,
                    way: globe ? [tr.lng, tr.lat, ((to.lng - tr.lng) % 360 + 540) % 360 - 180, to.lat - tr.lat] : undefined,
                };
                // (With `around`, the end differs from `to` in its center: the point under `around` stays there.)
                if (c.around && this.ease.anchor) to.setLocationAt(this.ease.anchor[0], this.ease.anchor[1], c.around[0], c.around[1]);
                this.aim(to);
                this.centreGiven = !c.around;
                break;
            }
            case 'pan': {
                this.fling = null; this.ease = null; this.target = null;
                const now = performance.now();
                if (c.x === undefined || c.y === undefined) { tr.set(tr.panned(-c.dx, -c.dy)); break; }
                this.centreGiven = false;
                // On the globe each move turns the globe from the last pointer to this one, as MapLibre GL JS does (globe.ts).
                if (tr.globeness) { tr.globe!.drag(tr, c.x - c.dx, c.y - c.dy, c.x, c.y); tr.constrain(); this.grab = null; break; }
                // A drag holds on to the ground (and its height) where it began; each move puts that point under the pointer.
                // (A new drag is recognized by a pause, or by the pointer not being where the held point is.)
                const held = this.grab && now - this.grab.at < 300 ? tr.project(this.grab.lng, this.grab.lat) : null;
                if (!held || Math.hypot(held[0] - (c.x - c.dx), held[1] - (c.y - c.dy)) > 24) {
                    const [lng, lat] = tr.unproject(c.x - c.dx, c.y - c.dy);
                    this.grab = {lng, lat, at: now, seq: this.seq};
                }
                tr.setLocationAt(this.grab!.lng, this.grab!.lat, c.x, c.y);
                this.grab!.at = now;
                break;
            }
            case 'zoom':
                this.centreGiven = false;
                this.stop();
                this.zoomAround(tr.zoom + c.delta, c.x, c.y);
                break;
            case 'wheel': {
                this.centreGiven = false;
                this.fling = null; this.ease = null; this.target = null;
                const now = performance.now(), w = this.wheel;
                // A pause ends the gesture: later scrolling starts from the zoom actually on screen.
                const fresh = !w || (w.doneAt !== undefined && now - w.doneAt > 200);
                this.wheel = {...(fresh ? {} : w), delta: (fresh ? 0 : w!.delta) + c.delta, kind: c.kind, x: c.x, y: c.y, lastEvent: now, doneAt: undefined};
                break;
            }
            case 'rotate': tr.set(undefined, undefined, tr.bearing + c.delta, tr.pitch + (c.pitch ?? 0)); break;
            case 'fling': {
                // Inertia: carry on at a fraction of the release speed and decelerate steadily.
                const dist = Math.hypot(c.dx, c.dy), linearity = 0.3;
                if (!dist) break;
                // (Two pointer events can have the same time where the clock of the browser is coarse.)
                const speed = Math.min(1400, dist * linearity / (Math.max(c.ms, 1) / 1000)), seconds = speed / (2500 * linearity), amount = speed * seconds / 2;
                this.grab = null;
                this.fling = {dx: c.dx / dist * amount, dy: c.dy / dist * amount, start: performance.now(), duration: seconds * 1000, done: 0};
                const end = new Transform();
                Object.assign(end, tr);
                end.set(tr.panned(-this.fling.dx, -this.fling.dy));
                this.aim(end);
                break;
            }
            case 'stop': this.stop(); break;
            case 'limits': Object.assign(tr, {minZoom: c.minZoom, maxZoom: c.maxZoom, maxPitch: c.maxPitch, minPitch: c.minPitch ?? 0, maxBounds: c.maxBounds ?? null}); tr.set(undefined, tr.zoom, undefined, tr.pitch); break;
            case 'lod': for (const id of c.sources) if (c.lod.length) this.lod[id] = c.lod; else delete this.lod[id]; this.viewCovers.clear(); this.invalidate(); break;
            case 'refresh':
                for (const [key, t] of this.tiles) if (!c.source || key.startsWith(c.source + '|')) this.dropTile(key, t);
                // The tile workers keep the bytes of recent tiles for queries: those are old now.
                for (const b of this.backends) b.forget(c.source);
                this.invalidate();
                break;
            case 'style':
                this.versions = c.versions ?? {};
                this.setStyle(c.style, c.reload, c.data ?? {}, c.instant);
                // The tiles that the changed style needs are asked for now, not in the next frame: a page can show a
                // layer for a moment only (to load one layer after another), and a frame can come later than that.
                if (!this.exaggeration && this.tr.width) for (const source in this.style.sources) {
                    const src = this.style.sources[source], tr = this.tr;
                    if (src.coordinates || this.style.terrain?.source === source || !this.layers.some(l => l.source === source && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom)) continue;
                    for (const id of tr.tileCover(src.minzoom, src.maxzoom, src.tileSize, src.type === 'raster' || src.type === 'raster-dem', this.lod[source])) {
                        const key = source + '|' + id.key;
                        if (!this.tiles.has(key)) this.request(source, id, key);
                    }
                }
                break;
            case 'fonts': this.loadFonts(c.fonts); break;
            case 'image': {
                // (`updateImage` with pixels of the same size: the texture changes in place, and the icons keep their places.)
                const old = c.update && this.images.get(c.name);
                if (old && old.width === c.w && old.height === c.h) { this.renderer.uploadSprite(old.x, old.y, c.w, c.h, c.data, false); break; }
                this.dropImage(c.name);
                const rect = this.addSprite(c.w, c.h, c.data);
                if (rect) this.images.set(c.name, {x: rect[0], y: rect[1], width: c.w, height: c.h, pixelRatio: c.w / c.width, custom: true, stretchX: c.stretchX, stretchY: c.stretchY, content: c.content, textFitWidth: c.textFitWidth, textFitHeight: c.textFitHeight, sdf: c.sdf});
                this.styleVersion++;
                this.placeDirty = true; this.iconsRev++;
                break;
            }
            case 'frame': {
                if (this.style.sources[c.source]?.coordinates) {
                    const st = this.picture(c.source);
                    st.gl = this.renderer.createImageTile(c.image, undefined, {z: 0, x: 0, y: 0, w: 0, key: ''}, st.gl);
                    this.styleVersion++;
                }
                c.image.close();
                break;
            }
            case 'removeImage': this.dropImage(c.name); this.placeDirty = true; this.iconsRev++; break;
            case 'templates':
                this.slots = c.slots;
                for (const b of this.backends) b.setTemplates(c.slots);
                for (const name of [...this.images.keys(), ...this.missing]) if (c.changed.includes(name.split(VARIANT)[0])) { this.dropImage(name); this.missing.delete(name); }
                // (Only tiles with shapes are built again: `band` is the zoom that such a tile was built for.)
                if (c.rebuild) for (const t of this.tiles.values()) if (t.band !== undefined) { t.stale = true; t.rev = ++this.tilesVersion; }
                this.styleVersion++;
                this.placeDirty = true; this.iconsRev++;
                break;
            case 'geojson': {
                const done = () => this.emit({type: 'geojsonDone', source: c.source});
                const packed = packGeoJSON(c.data);
                Promise.all(this.backends.map(b => b.setGeoJSON(c.source, c.data, this.style.sources[c.source]?.options, this.style.sources[c.source]?.maxzoom, packed))).then(done, done);
                this.newData(c.source);
                break;
            }
            case 'featureState':
                for (const b of this.backends) b.setFeatureState(c.source, c.states, c.replace);
                // The tile workers keep the state for a layer that reads it later. Tiles are built again only when a
                // layer of the source reads feature state now. (A frame comes in each case: it reports `idle` to the page.)
                if (this.sourceSigs.get(c.source)?.[1].includes('"feature-state"')) for (const [key, t] of this.tiles) if (key.startsWith(c.source + '|')) { t.stale = true; t.rev = ++this.tilesVersion; }
                break;
            case 'queryRendered':
                this.queryRendered(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                return; // (no frame: a question on `idle` must not make the map idle again)
            case 'query':
                this.queryFeatures(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                return;
            case 'elevation':
                this.queryElevation(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                return;
            case 'repaint': break;
            case 'destroy': this.lost = true; this.renderer.destroy(); return;
            case 'frames': this.reportFrames = c.on; break;
            case 'ping': this.pinged = c.n; break; // (and a frame follows)
            case 'snapshot': this.shots.push(c); break;
            case 'requests': this.rules = c.rules; for (const b of this.backends) b.setRequests(c.rules, this.ask); break;
            case 'resourceResult': this.asked.get(c.id)?.(c); this.asked.delete(c.id); break;
            case 'tileReport': this.tap = c.on; return;
            case 'tileLoads': this.tellLoads = c.on; return;
            case 'custom': this.renderer.custom = c.draw; this.emit({type: 'result', id: c.id, value: this.renderer.gl}); break;
            case 'bound': tr.customConstrain = c.fn; tr.set(undefined); this.emit({type: 'result', id: c.id, value: 0}); break;
        }
        this.repaint();
    }

    private stop() { this.ease = null; this.wheel = null; this.fling = null; this.grab = null; this.target = null; }

    /** Sets the view whose tiles are requested early. A newer movement replaces the view of an older one. */
    private aim(to: Transform) { this.target = to; }

    private zoomAround(zoom: number, x: number, y: number) {
        const [lng, lat] = this.tr.unproject(x, y);
        this.tr.set(undefined, zoom);
        this.tr.setLocationAt(lng, lat, x, y);
    }

    /** The places in the texture of images: the place of an image that the map has no more goes to later images (#27). */
    private space = new AtlasSpace(256);
    private atlasFull = false;
    /** Takes an image from the map, and frees its place in the texture. */
    private dropImage(name: string) {
        const img = this.images.get(name);
        if (!img) return;
        this.iconsAll = true;
        this.space.give(img.x, img.y, img.width, img.height);
        this.images.delete(name);
        this.atlasFull = false;
    }
    /** Copies an image into the dynamic atlas shared by markers and runtime-added icons. */
    private addSprite(w: number, h: number, data: Uint8Array): [number, number, number, number] | null {
        const at = this.space.take(w, h) ?? this.repack(w, h);
        if (!at) {
            // (One message, not one for each image that follows.)
            if (!this.atlasFull) this.emit({type: 'error', message: '[map-jr-gl] The texture of the images is full, so this image and the images after it are not drawn. Use fewer or smaller images. (An SVG template is drawn one time for each different set of values.)'});
            this.atlasFull = true;
            return null;
        }
        this.renderer.uploadSprite(at[0], at[1], w, h, data);
        return [at[0], at[1], w, h];
    }
    /**
     * Places all images again in an empty texture, moving their pixels on the GPU, then takes a place for an image of `w` by `h`.
     * Free places that share only part of an edge do not join, so a texture that is mostly free can have no place.
     * The texture starts at 256² (256 KB) and doubles here up to SPRITE_ATLAS² (16 MB) when the images do not fit (#27).
     */
    private repack(w: number, h: number): [number, number] | null {
        const list = [...this.images.values()];
        let space: AtlasSpace, at: [number, number][] | null = null;
        for (let size = this.space.size; !at && size <= SPRITE_ATLAS; size *= 2) at = (space = new AtlasSpace(size)).repack([...list.map(m => [m.width, m.height] as [number, number]), [w, h]]);
        if (!at) return null; // (the images stay where they are)
        this.space = space!;
        this.renderer.moveSprites(list.map((m, i) => [m.x, m.y, m.x = at[i][0], m.y = at[i][1], m.width, m.height]), space!.size);
        this.iconsAll = true;
        return at[list.length];
    }

    // ---- queries: answered from tile data, independent of what is drawn ----

    private tileAt(lng: number, lat: number, z: number) {
        const n = 2 ** z, mx = ((mercX(lng) % 1) + 1) % 1 * n, my = clamp(mercY(lat), 0, 1 - 1e-9) * n;
        return {x: Math.floor(mx), y: Math.floor(my), u: mx - Math.floor(mx), v: my - Math.floor(my)};
    }

    /**
     * The tile worker that answers a query about a tile: the one that loaded the tile, because it has the bytes that
     * the map shows. A tile that the map does not have goes to the next worker in turn.
     */
    private queryBackend(source: string, z: number, x: number, y: number) {
        return this.backends[this.tiles.get(`${source}|${z}/${x}/${y}`)?.backend ?? this.nextBackend++ % this.backends.length];
    }

    /** The features that the given style layers draw in a rectangle of the screen, from the tiles of the present zoom. */
    private async queryRendered(c: Extract<Command, {type: 'queryRendered'}>): Promise<QueriedFeature[]> {
        const jobs: Promise<QueriedFeature[]>[] = [];
        // (The symbol layers of the question whose features are tested with their icon, and the distance in pixels for their text.)
        const radii = new Map<string, number>(), shown = new Map<string, {x: number; y: number; box: number[]}[]>();
        for (const [name, src] of Object.entries(this.style.sources)) {
            const mine = c.sets.filter(s => s.source === name && this.layers.find(l => l.id === s.layer)?.visible !== false);
            if (!mine.length || !isGeometrySource(src)) continue;
            // A feature of a symbol layer is found where its icon is drawn. The tiles are asked with a rectangle that
            // has grown by the farthest reach of an icon of the layer, in the other direction (an icon that reaches 30
            // pixels up from its point is under a pointer that is 30 pixels above the point). Each feature that
            // comes back is then tested with its own icon (`underIcon`). Sets with the same rectangle are asked together.
            const boxes = new Map<string, {box: number[]; sets: typeof mine; exact: boolean}>();
            for (const s of mine) {
                const L = this.layers.find(l => l.id === s.layer), r = s.radius;
                let reach: [number, number, number, number] | null = L?.type === 'symbol' ? this.iconReach(L) : null;
                // (The text of a label can reach farther than its icon: the reach covers both.)
                const texts = L?.type === 'symbol' ? this.textBoxes(L.id) : [];
                for (const t of texts) {
                    const d = [t.box[0] - t.x, t.box[1] - t.y, t.box[2] - t.x, t.box[3] - t.y];
                    reach = reach ? [Math.min(reach[0], d[0]), Math.min(reach[1], d[1]), Math.max(reach[2], d[2]), Math.max(reach[3], d[3])] : [d[0], d[1], d[2], d[3]];
                }
                if (reach) radii.set(s.layer, r), shown.set(s.layer, texts);
                const box = reach ? [c.box[0] - Math.max(reach[2], r), c.box[1] - Math.max(reach[3], r), c.box[2] - Math.min(reach[0], -r), c.box[3] - Math.min(reach[1], -r)] : c.box, key = box.join();
                const group = boxes.get(key) ?? {box, sets: [], exact: !!reach};
                group.sets.push(reach ? {...s, radius: 0} : s);
                boxes.set(key, group);
            }
            for (const {box, sets, exact} of boxes.values()) for (const t of tilesUnderBox(this.tr, box, src.minzoom, src.maxzoom)) {
                jobs.push(this.queryBackend(name, t.z, t.x, t.y).query(tileURL(src, t.z, t.x, t.y, this.dpr), {
                    source: name, z: t.z, zoom: Math.max(t.z, Math.floor(this.tr.zoom)), x: t.x, y: t.y, px: 0, py: 0, radius: 0, box: t.box, geometry: c.geometry || exact,
                    sets: sets.map(s => ({layer: s.layer, sourceLayer: s.sourceLayer, filter: s.filter, also: s.also, radius: s.radius * t.scale})),
                }));
            }
        }
        // A feature that is in two tiles is given one time, when it has an id or comes from a GeoJSON source.
        const seen = new Set<string>();
        return (await Promise.all(jobs)).flat().filter(f => {
            const L = radii.has(f.layer!) && this.layers.find(l => l.id === f.layer);
            if (L && !this.underIcon(L, f, c.box, radii.get(f.layer!)!, shown.get(f.layer!)!)) return false;
            if (L && !c.geometry) delete f.geometry;
            const key = featureKey(f);
            return !key || (seen.has(key) ? false : (seen.add(key), true));
        });
    }

    private async queryFeatures(c: Extract<Command, {type: 'query'}>): Promise<QueriedFeature[]> {
        const zoom = c.zoom ?? this.tr.zoom;
        const jobs = Object.entries(this.style.sources).filter(([name, src]) => isGeometrySource(src) && (!c.sources || c.sources.includes(name))).map(([name, src]) => {
            const z = clamp(Math.floor(zoom), src.minzoom, src.maxzoom), t = this.tileAt(c.lng, c.lat, z);
            // The tolerance is given in screen pixels at the queried zoom.
            const radius = c.radius * EXTENT / (512 * 2 ** (zoom - z));
            return this.queryBackend(name, z, t.x, t.y).query(tileURL(src, z, t.x, t.y, this.dpr), {
                source: name, z, x: t.x, y: t.y, px: t.u * EXTENT, py: t.v * EXTENT, radius,
                sourceLayers: c.sourceLayers, filter: c.filter, geometry: c.geometry,
            });
        });
        return (await Promise.all(jobs)).flat();
    }

    private async queryElevation(c: Extract<Command, {type: 'elevation'}>): Promise<number | null> {
        const entry = Object.entries(this.style.sources).find(([name, src]) => src.type === 'raster-dem' && (!c.source || c.source === name));
        if (!entry) throw new Error(c.source
            ? `[map-jr-gl] queryElevation(): the style has no "raster-dem" source "${c.source}". Name a source of type "raster-dem".`
            : '[map-jr-gl] queryElevation(): the style has no "raster-dem" source. Add a source of type "raster-dem" to the style.');
        const src = entry[1], z = clamp(Math.floor(c.zoom ?? src.maxzoom), src.minzoom, src.maxzoom), t = this.tileAt(c.lng, c.lat, z);
        const url = tileURL(src, z, t.x, t.y, this.dpr);
        let pixels = this.dem.get(url);
        if (!pixels) {
            pixels = (async () => {
                const bytes = await fetchTile(url, withTimeout(this.fetchAs('Tile')), undefined, undefined, true);
                if (!bytes) return null;
                const image = 'length' in bytes ? await createImageBitmap(new Blob([bytes as BlobPart]), {premultiplyAlpha: 'none', colorSpaceConversion: 'none'}) : bytes;
                const {width, height} = image, data = imagePixels(image, width, height);
                image.close();
                return {width, height, data};
            })();
            this.dem.set(url, pixels);
            pixels.catch(() => this.dem.delete(url));
            if (this.dem.size > 16) this.dem.delete(this.dem.keys().next().value!);
        }
        const p = await pixels;
        return p ? sampleElevation(p.data, p.width, p.height, t.u, t.v, src.encoding ?? 'mapbox') : null;
    }

    // ---- frame loop ----

    repaint() {
        if (this.scheduled) return;
        this.scheduled = true;
        raf(t => { this.scheduled = false; this.frame(t); });
    }

    /** Advances camera animations; returns true while any is still running. */
    private animate(now: number): boolean {
        const tr = this.tr;
        if (this.ease) {
            const e = this.ease, t = Math.min(1, (now - e.start) / e.duration), q = e.easing, j = t * 64 | 0, k = q ? q[j] + ((q[j + 1] ?? q[j]) - q[j]) * (t * 64 - j) : defaultEasing(t);
            const v = e.from.map((f, i) => f + (e.to[i] - f) * k);
            let part = k;
            if (e.fly) {
                // flyTo (van Wijk and Nuij, as in MapLibre GL JS): w is the width of the view relative to the start, u the
                // part of the way that the center has gone.
                const [r0, rho, S, c, sign] = e.fly, s = k * S;
                const u = sign ? 0 : c * (Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0));
                v[0] = e.from[0] + (e.to[0] - e.from[0]) * u; v[1] = e.from[1] + (e.to[1] - e.from[1]) * u; part = u;
                v[2] = k < 1 ? e.from[2] - Math.log2(sign ? Math.exp(sign * rho * s) : Math.cosh(r0) / Math.cosh(r0 + rho * s)) : e.to[2];
            }
            tr.zoom = v[2];
            tr.padding = [v[5], v[6], v[7], v[8]];
            tr.set(undefined, undefined, v[3], v[4]);
            if (e.around && e.anchor) tr.setLocationAt(e.anchor[0], e.anchor[1], e.around[0], e.around[1]);
            else if (e.way) { [tr.lng, tr.lat] = globeWay(e.way, part); tr.constrain(); }
            else { tr.lng = lngFromMerc(v[0]); tr.lat = latFromMerc(v[1]); tr.constrain(); }
            if (e.globe) { tr.zoom = clamp(v[2] + keepSize(0, tr.lat), tr.minZoom, tr.maxZoom); tr.constrain(); }
            if (t >= 1) this.ease = null, this.target = null;
        }
        const w = this.wheel;
        if (w && w.doneAt === undefined) {
            if (w.delta) {
                // Each batch of scrolling multiplies the scale by up to 2, saturating smoothly for big deltas.
                const rate = w.kind === 'wheel' && Math.abs(w.delta) > WHEEL_STEP ? WHEEL_RATE : TRACKPAD_RATE;
                let scale = 2 / (1 + Math.exp(-Math.abs(w.delta * rate)));
                if (w.delta < 0) scale = 1 / scale;
                w.target = clamp((w.target ?? tr.zoom) + Math.log2(scale), tr.zoomFloor, tr.maxZoom);
                if (w.kind === 'wheel') {
                    // Mouse wheels arrive in coarse steps: ease to the target, starting at the speed already under way.
                    w.start = tr.zoom;
                    let easing = defaultEasing;
                    const prev = this.prevWheelEase;
                    if (prev) {
                        const t = (now - prev.start) / 200, speed = prev.easing(t + 0.01) - prev.easing(t);
                        const x = 0.27 / Math.sqrt(speed * speed + 0.0001) * 0.01;
                        easing = bezier(x, Math.sqrt(0.27 * 0.27 - x * x), 0.25, 1);
                    }
                    this.prevWheelEase = {start: now, easing};
                    w.easing = easing;
                }
                w.delta = 0;
            }
            if (w.target !== undefined) {
                let done = true, zoom = w.target;
                if (w.kind === 'wheel' && w.start !== undefined && w.easing) {
                    const t = Math.min((now - w.lastEvent + 5) / 200, 1);
                    zoom = w.start + (w.target - w.start) * w.easing(Math.max(0, t));
                    done = t >= 1;
                }
                // Trackpads report fine-grained deltas, so they are applied directly: any smoothing would feel like lag.
                this.zoomAround(zoom, w.x, w.y);
                if (done) w.doneAt = now;
            }
        }
        // A glide after a drag counts as movement in each frame that it is applied in, also the frame that ends it. (A
        // short glide can start and end in one frame. The page waits to see the glide before it reports `moveend`.)
        const glide = this.fling;
        if (glide) {
            const f = glide, t = Math.min(1, (now - f.start) / f.duration), k = inertiaEasing(t);
            tr.set(tr.panned(-f.dx * (k - f.done), -f.dy * (k - f.done)));
            f.done = k;
            if (t >= 1) this.fling = null, this.target = null;
        }
        return !!(this.ease || (this.wheel && this.wheel.doneAt === undefined) || glide);
    }

    /** The tile of a key, requested again first when its request failed and the time to try again has come. */
    private retried(source: string, id: TileID, key: string) {
        const t = this.tiles.get(key);
        if (!(t?.retryAt! <= performance.now())) return t;
        this.dropTile(key, t!);
        this.request(source, id, key, t!.tries! + 1);
        return this.tiles.get(key);
    }

    /** The benchmark page asks for `tile` events (#360). The report itself is made on the page (demo/tile-report.mjs). */
    private tap = false;
    private tellLoads = false;
    private tapTile(key: string | string[], kind: string, error?: string) { if (this.tap) this.emit({type: 'tile', key, kind, t: performance.now(), error}); }

    private dropTile(key: string, t: TileState) {
        this.tapTile(key, 'drop');
        if (t.state === 'loading') t.cancel();
        if (t.gl) this.renderer.destroyTile(t.gl);
        this.tiles.delete(key);
        this.tilesVersion++;
        this.ground(key, t, false);
    }

    /**
     * Makes a loaded elevation tile a part of the ground of 3D terrain, or takes it out. The tile keeps its heights in
     * each case: when terrain is switched on or off, the tiles that are there are used, and the relief does not go away.
     */
    private ground(key: string, t: TileState, on: boolean) {
        const k = key.slice(key.lastIndexOf('|') + 1);
        if (on && t.dem && !t.range) {
            const [z, x, y] = k.split('/').map(Number), n = 2 ** z;
            t.range = [t.dem.lo, t.dem.hi];
            this.heights.set(k, t.dem.grid);
            // Only the ground under and beside this tile gets new mesh heights (see terrainTiles).
            this.demArrivals.push({version: this.demVersion + 1, x0: x / n, y0: y / n, x1: (x + 1) / n, y1: (y + 1) / n});
            if (this.demArrivals.length > 48) this.demArrivals.shift();
            this.emit({type: 'heights', key: k, grid: t.dem.grid});
            this.demVersion++;
        } else if (!on && t.range) {
            t.range = undefined;
            this.heights.delete(k);
            this.emit({type: 'heights', key: k});
        } else return;
        heightsChanged(this.heights);
    }

    private request(source: string, id: TileID, key: string, tries = 0) {
        const src = this.style.sources[source], url = tileURL(src, id.z, id.x, id.y, this.dpr);
        // Contour lines are made from elevation data, which is much work. While the zoom changes, each step would start
        // tiles that are out of date a moment later, and slow devices cannot keep up. The lines of the last zoom stay
        // on the map (they are scaled) until the zoom has been still for a moment.
        if (src.contour && this.frameTime - this.zoomMovedAt < CONTOUR_WAIT) { this.contourWait = true; return; }
        const t: TileState = {state: 'loading', used: this.frameNo, tries, cancel() {}};
        this.tiles.set(key, t);
        this.tapTile(key, 'req');
        t.rev = ++this.tilesVersion;
        let load: Promise<GLTile>;
        const b = src.bounds, n = 2 ** id.z;
        // A tile outside the bounds of the source is empty, without a request.
        if (b && (id.x + 1 <= mercX(b[0]) * n || id.x >= mercX(b[2]) * n || id.y + 1 <= mercY(b[3]) * n || id.y >= mercY(b[1]) * n)) load = Promise.resolve({labels: {}, batches: {}});
        else if (isGeometrySource(src)) {
            const backend = this.backends[t.backend = this.nextBackend++ % this.backends.length], req = this.nextReq++;
            t.cancel = () => backend.cancel(req);
            load = backend.load(this.build(req, source, id, t)).then(tile => (t.built = true, this.tapTile(key, 'ans'), t.used < 0 || this.askImages(tile), this.upload(tile, () => this.tiles.get(key) === t)));
        } else {
            // Elevation tiles are decoded in a tile worker, which also reads the heights that 3D terrain needs: this thread
            // only sends the finished pixels to the GPU. (Reading pixels back here made the map hitch as tiles arrived.)
            if (src.type === 'raster-dem') {
                const backend = this.backends[this.nextBackend++ % this.backends.length], req = this.nextReq++, encoding = src.encoding ?? 'mapbox';
                t.cancel = () => backend.cancel(req);
                load = backend.loadElevation({id: req, url, encoding}).then(dem => !dem ? (t.missing = true, {labels: {}, batches: {}}) : this.paced(dem.pixels.length * 2, () => {
                    if (this.tiles.get(key) !== t) return {labels: {}, batches: {}};
                    t.dem = {grid: dem.grid, lo: dem.lo, hi: dem.hi};
                    // (Its heights now place the camera. A frame that dropped it as a tile that is no longer wanted took
                    // them away again, and the camera went back and forth between two places for good, #1468.)
                    t.built = true;
                    if (this.style.terrain?.source === source) this.ground(key, t, true);
                    return this.renderer.createImageTile({width: dem.width, height: dem.height, data: dem.pixels}, encoding, id);
                }));
            } else {
                // Image tiles need no parsing, so the engine fetches and decodes them itself.
                const ac = new AbortController();
                t.cancel = () => ac.abort();
                load = fetchTile(url, withTimeout(this.fetchAs('Tile')), ac.signal, t, true).then(async bytes => {
                    if (!bytes) return {labels: {}, batches: {}};
                    // (A custom protocol can return the image decoded.)
                    const image = 'length' in bytes ? await createImageBitmap(new Blob([bytes as BlobPart])) : bytes;
                    if (this.tiles.get(key) !== t) { image.close(); return {labels: {}, batches: {}}; }
                    const tile = this.renderer.createImageTile(image, undefined, id);
                    image.close();
                    return tile;
                });
            }
        }
        load.then(gl => {
            // A tile that was dropped while it waited (it left the view, or the source changed) frees what it sent to the GPU (#400).
            if (this.tiles.get(key) !== t) return this.renderer.destroyTile(gl);
            this.tapTile(key, t.missing ? 'miss' : 'up');
            if (this.tellLoads) this.emit({type: 'tileLoaded', key});
            t.gl = gl;
            t.state = 'ok';
            t.rev = ++this.tilesVersion;
            this.freshTiles.set(id.key, performance.now());
            // (A tile of the overview that no frame has drawn yet changes nothing in the image. From now on it ages like any other tile.)
            if (t.used >= 0) this.invalidate(); else t.used = this.frameNo;
        }, err => {
            if (this.tiles.get(key) !== t) return;
            this.tapTile(key, 'fail', err.message);
            t.state = 'error';
            t.rev = ++this.tilesVersion;
            if (err.message === 'aborted' || err.name === 'AbortError') return this.repaint();
            this.emit({type: 'error', message: err.message});
            // A failed request (a lost connection, an HTTP status 5xx) is made again while the view needs the tile:
            // after 0.5 s, 1 s and 2 s. Without this, one failed request left a hole in the map until the tile left the view (#360).
            // A status 4xx or a rejection by a protocol would fail again, so it is final (#652).
            // After those, it is requested every 15 s while the view needs it, and `idle` does not wait for it: an overview
            // tile that failed four times stood in for nothing until the source changed (#686).
            if (!finalFailure(err)) { const wait = t.tries! < TILE_RETRIES ? 500 * 2 ** t.tries! : TILE_RETRY_LATER; t.retryAt = performance.now() + wait; setTimeout(() => this.repaint(), wait); }
            this.repaint();
        });
    }

    /** Builds a tile again from changed data and swaps it in when ready; the old one stays on screen meanwhile. */
    /**
     * The zoom that a tile is built for: its own level. A tile of the deepest level of its source also serves each
     * zoom past that level. The standard 3D buildings layer gives a height that depends on the zoom and on the feature
     * (it grows from 0 between zoom 15 and 15.05), so such a tile is built for the zoom of the map, and built again when
     * the zoom has changed and is still.
     */
    private buildZoom(source: string, id: TileID) {
        return id.z >= this.style.sources[source].maxzoom ? Math.max(id.z, this.zoomBuilt.has(source) ? this.tr.zoom : Math.floor(this.tr.zoom)) : id.z;
    }
    /**
     * The request to build a tile. A tile of the deepest level of its source is shown at each higher zoom also. It has
     * the labels of the layers that show near the zoom of the map only (as in MapLibre GL JS), and is built again when
     * the map comes to another whole zoom. (A city has thousands of labels that show only from zoom 17.)
     */
    private build(req: number, source: string, id: TileID, t: TileState): TileRequest {
        const src = this.style.sources[source], band = t.band = this.buildZoom(source, id);
        t.rules = this.sourceSigs.get(source)?.[1];
        // (A map that can show the globe cuts the fills and lines of a tile along a grid: see subdivide.ts.)
        return {id: req, source, url: tileURL(src, id.z, id.x, id.y, this.dpr), z: this.zoomBuilt.has(source) ? band : id.z, overscaled: band >= src.maxzoom && band, direct: true, globe: this.globeWait || this.tr?.globeStops ? globeBuild(id, Math.max(id.z, band)) : undefined};
    }
    private zoomBuilt = new Set<string | undefined>();
    /**
     * While a switch to the globe waits: asks for the tiles that the globe will draw, with the cut, and switches when
     * they are there (or after a second, so that a slow or failed tile does not keep the map flat). Returns whether the
     * map has switched.
     */
    private holdGlobe(wanted: Set<string>, frameNo: number) {
        const wait = this.globeWait!, tr = this.tr;
        if (!tr.globe) return false;
        const g = Object.assign(new Transform(), tr, {globeStops: wait.stops});
        let ready = true;
        for (const source in this.style.sources) {
            const src = this.style.sources[source];
            // (Only the tiles of geometry are cut; and only those of the layers that the globe draws at this zoom.)
            if (!this.sourceSigs.get(source)?.[1] || !this.layers.some(l => l.source === source && l.visible && g.zoom >= l.minzoom && g.zoom < l.maxzoom)) continue;
            for (const id of g.tileCover(src.minzoom, src.maxzoom, src.tileSize, false)) {
                const key = source + '|' + id.key;
                wanted.add(key);
                const t = this.retried(source, id, key);
                if (!t) { this.request(source, id, key); ready = false; continue; }
                if (t.state === 'ok') { t.used = frameNo; this.refresh(source, id, key, t); }
                if (t.state === 'loading' || t.rebuilding || t.stale && t.state === 'ok') ready = false;
            }
        }
        if (!ready && performance.now() - wait.since < 1000) return false;
        tr.globeStops = wait.stops;
        this.globeWait = null;
        this.invalidate();
        return true;
    }
    /** Builds a tile again when its data is out of date, or when it was built for another zoom than it is now for. */
    private refresh(source: string, id: TileID, key: string, t: TileState) {
        // (Only a tile of geometry has a zoom that it was built for. An image tile is never built again: its bytes are not geometry.)
        // The zoom must be still for a moment before a tile is built for it. A frame comes after that moment (see
        // `contourWait`, which is set under the same condition in each place of a frame).
        if (t.band === undefined || t.state !== 'ok' || t.rebuilding || !t.stale && (t.band === this.buildZoom(source, id) || (this.contourWait ||= this.frameTime - this.zoomMovedAt <= CONTOUR_WAIT))) return;
        t.stale = false;
        this.rebuild(source, id, key, t);
    }

    private rebuild(source: string, id: TileID, key: string, t: TileState) {
        // (The tile worker that loaded the tile has its bytes still: it builds the tile again without a request.)
        const backend = this.backends[t.backend ?? this.nextBackend++ % this.backends.length], req = this.nextReq++;
        this.tapTile(key, 'rebuild');
        t.rebuilding = true; // one rebuild at a time per tile; data that changes meanwhile marks it stale again
        backend.load({...this.build(req, source, id, t), again: true}).then(tile => {
            t.rebuilding = false;
            if (this.tiles.get(key) !== t) return;
            const old = t.gl;
            t.gl = this.renderer.createTile(tile);
            t.rev = ++this.tilesVersion;
            if (old) this.renderer.destroyTile(old);
            this.invalidate();
        }, err => { t.rebuilding = false; this.emit({type: 'error', message: err.message}); });
    }

    private stats = {since: 0, frames: 0, cpu: 0};

    private frame(now: number) {
        const tr = this.tr, frameNo = ++this.frameNo, began = performance.now();
        // (After the last paint transition the layers get their new values back, and a frame does no work for them, #960.)
        if (this.transitionEnd && began >= this.transitionEnd) { this.transitionEnd = 0; for (const l of this.layers) for (const k in l.p) l.p[k] = (l.p[k] as any).to ?? l.p[k]; }
        compileFor(this.states); // (the light of the style is compiled when it is drawn)
        if (this.lost || (tr.globeStops && !tr.globe)) return;
        // A map of size 0 (a container with `display: none`) needs no tiles and draws nothing. As in MapLibre GL JS, it is
        // idle once the sprite and the glyphs have loaded (#964); a resize starts the usual frames.
        if (!tr.width || !tr.height) {
            const idle = !this.spritePending && !this.atlas.loading;
            if (idle && !this.wasIdle) this.emit({type: 'idle', seq: this.seq});
            this.wasIdle = idle;
            return;
        }
        // The fonts of the labels are looked up while the tiles load, and not in the first label placement (#326).
        if (this.warmed !== this.layers) {
            this.warmed = this.layers;
            this.atlas.warm(this.layers.filter(l => l.type === 'symbol' && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom && !l.p.font.dd && (l.p.field.dd || l.p.field.eval(tr.zoom) !== '')).map(l => l.p.font.eval(tr.zoom)));
        }
        const dt = Math.min(100, now - this.lastTime || 16);
        this.lastTime = now;
        this.frameTime = began;
        if (tr.zoom !== this.zoomSeen) { if (!Number.isNaN(this.zoomSeen)) this.zoomMovedAt = began; this.zoomSeen = tr.zoom; }
        const cameraAnimating = this.animate(now), animating = cameraAnimating;
        this.flushUploads(this.wentIdle && (cameraAnimating || began - this.cameraMovedAt < 200));

        const items = new Map<string, RenderItem<GLTile>[]>(), all: RenderItem<GLTile>[] = [];
        let complete = true; const loading = new Set<string>();
        const wanted = new Set<string>();
        // 3D terrain: the camera follows the ground under the map center, easing so that newly loaded heights do not jolt it.
        // Seen from straight above, relief changes nothing that matters, so the flat (sharper, cheaper) path is used; the
        // relief then grows in over the first ten degrees of tilt rather than popping.
        const tilt = clamp(tr.pitch / 10, 0, 1);
        this.exaggeration = (this.style.terrain?.exaggeration ?? 0) * tilt * tilt * (3 - 2 * tilt);
        const globeness = tr.globeness;
        const terrain = this.exaggeration > 0 ? this.style.terrain : undefined;
        if (terrain && globeness) {
            // On the globe the camera looks at the ground under the center (see `frame` in globe.ts), and screen positions
            // follow the ground as in Mercator (#1430). The camera does not ease or keep its height while it moves.
            tr.heightAt = this.heightAt;
            tr.elevation = this.heightAt(mercX(tr.lng) - Math.floor(mercX(tr.lng)), mercY(tr.lat));
            this.rawElevation = tr.elevation / this.exaggeration;
            let lo = tr.elevation, hi = tr.elevation;
            for (const [key, t] of this.tiles) if (t.range && t.used >= frameNo - 2 && key.startsWith(terrain.source + '|')) { lo = Math.min(lo, t.range[0] * this.exaggeration); hi = Math.max(hi, t.range[1] * this.exaggeration); }
            tr.groundRange = [lo, hi];
        } else if (terrain) {
            tr.heightAt = this.heightAt;
            // The center's height is remembered in real meters, so it shrinks and grows together with the relief.
            tr.elevation = this.rawElevation * this.exaggeration;
            // The lowest and highest ground on the elevation tiles in use: valleys far below the center (or peaks far
            // above it) reach further across the screen than flat ground would.
            let lo = tr.elevation, hi = tr.elevation;
            for (const [key, t] of this.tiles) {
                if (!t.range || t.used < frameNo - 2 || !key.startsWith(terrain.source + '|')) continue;
                lo = Math.min(lo, t.range[0] * this.exaggeration); hi = Math.max(hi, t.range[1] * this.exaggeration);
            }
            tr.groundRange = [lo, hi];
            // While the map is being moved the center keeps its height: the camera goes where it is sent rather than
            // bobbing over every ridge. At rest the center is put back on the ground the camera is looking at, with
            // the camera left exactly where it is, so nothing on screen moves when a gesture ends or heights arrive.
            const pose = `${tr.lng},${tr.lat},${tr.zoom}`;
            // (The first pose is not a movement: a map that starts is at rest, so the center takes the height of the
            // ground as soon as it is known, and `idle` does not come with the center still at sea level, #793.)
            if (pose !== this.lastPose) { if (this.lastPose) this.movedAt = now; this.lastPose = pose; }
            const moving = cameraAnimating || now - this.movedAt < 150;
            // (A turn or a tilt is a movement too while the camera is kept clear of the ground.)
            const tilt = `${tr.bearing},${tr.pitch}`;
            if (tilt !== this.lastTilt) { if (this.lastTilt) this.tiltedAt = now; this.lastTilt = tilt; }
            const turning = moving || now - this.tiltedAt < 150;
            const known = (mx: number, my: number) => !!this.demTile(mx - Math.floor(mx), my, 30);
            const e = this.ease;
            if (e && !e.around) {
                // An animation to a stated place: the center's height eases to the ground there along with everything else.
                if (this.easeHeights?.ease !== e) this.easeHeights = {ease: e, from: this.rawElevation};
                if (known(e.to[0], e.to[1])) {
                    const k = defaultEasing(clamp((now - e.start) / e.duration, 0, 1));
                    tr.elevation = (this.easeHeights.from + (this.rawHeightAt(e.to[0], e.to[1]) - this.easeHeights.from) * k) * this.exaggeration;
                }
            } else if (!moving) {
                if (this.centreGiven) {
                    // The center was set outright (jumpTo, the end of an animation, terrain switched on): it stays where
                    // it was put and takes the height of the ground there, as soon as that is known.
                    // It waits for the detailed elevation tile of the view (one level above the map, as `viewCover` selects)
                    // while that is loading: a height from the coarse tile of the surroundings would fix the camera at
                    // another height for good, and the picture would depend on which tile arrived first, #820.
                    const d = this.demTile(mercX(tr.lng) - Math.floor(mercX(tr.lng)), mercY(tr.lat), 30), src = this.style.sources[terrain.source];
                    if (d && (d.z >= Math.min(src.maxzoom, Math.floor(tr.zoom) - 1) || !this.demLoading)) { tr.elevation = this.heightAt(mercX(tr.lng), mercY(tr.lat)); this.centreGiven = false; this.placedAt = now; }
                } else if (this.movedAt > this.placedAt && tr.recenterOnGround()) this.lastPose = `${tr.lng},${tr.lat},${tr.zoom}`;
            }
            // Never inside the mountain (as MapLibre GL JS's _terrainHeightAboveCamera and _raiseCameraByPitchAndZoom,
            // #1480, #1486): the ground under the camera and under 9 points of the near clipping plane stays below them.
            // During a gesture or an animation the center's height rises instead, so that the pitch and the zoom that the
            // movement edits are kept. At rest the camera rises over the same point of the ground and keeps the same
            // center: the pitch and the zoom are solved again. Not while the center waits for its own height.
            for (let pass = 0; pass < 3 && !this.centreGiven; pass++) {
                const lift = this.terrainAboveCamera(tr);
                if (lift <= 0) break;
                if (turning) { tr.elevation += lift; break; }
                const ppm = tr.pixelsPerMetre, d = tr.cameraDistance, p = tr.pitch * Math.PI / 180, across = d * Math.sin(p) / ppm, up = d * Math.cos(p) / ppm + lift;
                tr.pitch = Math.atan2(across, up) * 180 / Math.PI;
                tr.zoom = Math.max(tr.minZoom, tr.zoom + Math.log2(d / ppm / Math.hypot(across, up)));
                this.lastPose = `${tr.lng},${tr.lat},${tr.zoom}`; this.lastTilt = `${tr.bearing},${tr.pitch}`;
            }
            this.rawElevation = tr.elevation / this.exaggeration;
        } else {
            tr.heightAt = undefined; tr.groundRange = undefined; tr.elevation = 0;
            const st = this.style.terrain, src = st && this.style.sources[st.source];
            if (src) {
                // Looking straight down the relief is not drawn, but the height under the center is still tracked (it
                // needs one elevation tile), so that tilting starts from the right place.
                const z = clamp(Math.round(tr.zoom), src.minzoom, src.maxzoom), n = 2 ** z, mx = mercX(tr.lng) - Math.floor(mercX(tr.lng));
                const id = {z, x: Math.floor(mx * n), y: clamp(Math.floor(mercY(tr.lat) * n), 0, n - 1), w: 0, key: ''};
                id.key = `${z}/${id.x}/${id.y}`;
                const key = st!.source + '|' + id.key, t = this.tiles.get(key);
                wanted.add(key);
                if (t) t.used = frameNo; else this.request(st!.source, id, key);
                if (this.heights.size) this.rawElevation = this.rawHeightAt(mercX(tr.lng), mercY(tr.lat));
            } else this.rawElevation = 0;
        }
        const ground = terrain ? this.terrainTiles(wanted) : undefined;
        // (The raster tiles that only the pictures of the ground draw are not in the loop below.)
        if (ground && this.groundWaits) complete = false;
        if (this.globeWait && !this.holdGlobe(wanted, frameNo)) complete = false;
        const view: string[] = [];
        for (const source in this.style.sources) {
            // Skip sources nothing visible draws from at this zoom (e.g. low-zoom relief imagery when zoomed in). With 3D
            // terrain, the flat layers are drawn into the ground textures, which ask for their own tiles (see groundSources):
            // only labels and buildings are drawn from the tiles of the view. (Without this, the elevation tiles for relief
            // shading were loaded two times, at two sets of zoom levels.)
            if (!this.layers.some(l => l.source === source && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom && (!terrain || l.type === 'symbol' || l.type === 'fill-extrusion' || l.type === 'circle'))) {
                // (Tiles on their way stay on their way: a page that hides a layer for a moment and shows it again, to
                // load one layer after another, does not start again each time.)
                // Its tiles for the view are kept too, so that the layer is there at once when the page shows it.
                const src = this.style.sources[source];
                if (!src.coordinates && this.layers.some(l => l.source === source)) for (const id of tr.tileCover(src.minzoom, src.maxzoom, src.tileSize, src.type === 'raster' || src.type === 'raster-dem', this.lod[source])) {
                    const key = source + '|' + id.key, t = this.tiles.get(key);
                    if (t) { t.used = frameNo; wanted.add(key); }
                }
                continue;
            }
            const src = this.style.sources[source];
            if (src.coordinates) { items.set(source, this.pictureItems(source, tr)); if (this.pictures.get(source)?.loading) complete = false; continue; }
            // (The elevation source of 3D terrain has the tiles of `viewCover` also while the map is seen from above and the
            // ground is flat: relief shading then looks the same as on a tilted map, and a tilt loads no other tiles.)
            const ground = this.style.terrain?.source === source;
            const ideal = tr.tileCover(src.minzoom, src.maxzoom, ground ? src.tileSize * 2 : src.tileSize, !ground && (src.type === 'raster' || src.type === 'raster-dem'), this.lod[source]);
            if (this.tap) for (const id of ideal) view.push(source + '|' + id.key);
            for (const id of ideal) {
                const key = source + '|' + id.key;
                wanted.add(key);
                const t = this.retried(source, id, key);
                if (!t) this.request(source, id, key);
                else this.refresh(source, id, key, t);
                // (A tile that was requested for the overview and that the view now needs: its arrival changes the image.)
                if (t && t.used < 0) t.used = frameNo;
                // (A tile that is drawn from old data, or that is being built again, is not complete: `idle` waits for it.
                // Only a tile of geometry is built again; see `refresh`.)
                if (!t || t.state === 'loading' || t.retryAt && t.tries! < TILE_RETRIES || t.rebuilding || t.stale && t.state === 'ok' && t.band !== undefined) complete = false;
                if (!t || t.state === 'loading' || t.stale || t.rebuilding) loading.add(source);
                // The server does not have this image tile: the nearest tile above it that the server has is drawn in its
                // place (as in MapLibre GL JS, at most 10 levels above). One level is requested at a time.
                for (let m = t, z = id.z, x = id.x, y = id.y; m?.missing && z > src.minzoom && z > id.z - 10;) {
                    const k = `${--z}/${x >>= 1}/${y >>= 1}`, pk = source + '|' + k;
                    wanted.add(pk);
                    m = this.tiles.get(pk);
                    if (!m) { this.request(source, {z, x, y, w: id.w, key: k}, pk); complete = false; } else { m.used = frameNo; if (m.state === 'loading') complete = false; }
                }
            }
            // Keep a coarse overview of the same area loaded as well. It costs a tile or two and means fast pans
            // and zoom-outs land on blurry map rather than on nothing.
            const dz = Math.min(3, ideal.length ? ideal[0].z - src.minzoom : 0);
            if (dz > 0) {
                for (const id of ideal) {
                    // (A tilted view has tiles of more than one level: the overview of a coarse tile stops at the lowest level of the source.)
                    const z = Math.max(src.minzoom, id.z - dz), x = id.x >> id.z - z, y = id.y >> id.z - z, k = `${z}/${x}/${y}`, key = source + '|' + k;
                    if (wanted.has(key)) continue;
                    wanted.add(key);
                    const oid = {z, x, y, w: id.w, key: k}, t = this.retried(source, oid, key);
                    // (The overview waits for the first `idle` of the map: its tiles are large, and before that they would take
                    // the connections and the tile workers from the tiles of the view and the engine from the label placement.
                    // A map that is not idle 3 s after the start requests it then (see `born`), once the tiles of the view
                    // have loaded. After the first `idle` it does not wait for the tiles of the view: a pan that reaches a new
                    // overview tile would otherwise show no map at its leading edge until the tiles of the view arrive (#360).)
                    // (`used` below 0: a tile that no frame has needed yet. Its arrival changes nothing in the image, so it
                    // does not place the labels again, which would delay the first `idle`. It keeps that mark while it loads.)
                    // (A tile of the view whose request failed needs its overview now: it stands in for that tile, so it is
                    // requested at once, its arrival changes the image, and `idle` waits for it (#379).)
                    const v = this.tiles.get(source + '|' + id.key), failed = v?.state === 'error' && !v.missing;
                    if (failed && t?.state === 'loading') { complete = false; if (t.used < 0) t.used = frameNo; }
                    if (!t) { if (failed || this.wentIdle || complete && performance.now() - this.born > 3000) { this.request(source, oid, key); const made = this.tiles.get(key); if (made) made.used = failed ? frameNo : -1; if (failed) complete = false; } } else {
                        if (t.state !== 'loading') t.used = frameNo;
                        // Keep the overview current too, or it would flash old data when it stands in for a missing tile.
                        this.refresh(source, oid, key, t);
                    }
                }
            }
            // The tiles of the view at the end of the movement under way, requested at its start (#361). A few at most per
            // source, the nearest to the center of that view first. When a newer movement starts, the tiles of the older one
            // that were not requested yet are not requested, and those on their way finish and stay in the cache.
            const aim = this.target;
            if (aim) {
                let n = 0;
                for (const id of aim.tileCover(src.minzoom, src.maxzoom, ground ? src.tileSize * 2 : src.tileSize, !ground && (src.type === 'raster' || src.type === 'raster-dem'), this.lod[source])) {
                    const key = source + '|' + id.key;
                    if (wanted.has(key)) continue;
                    if (++n > PREFETCH_TILES) break;
                    wanted.add(key);
                    const t = this.tiles.get(key);
                    if (!t) { this.request(source, id, key); const made = this.tiles.get(key); if (made) { made.used = -1; this.early.add(key); } } else if (t.state !== 'loading') t.used = frameNo;
                }
            }
            const list = renderItems(tr, ideal, k => {
                const t = this.tiles.get(source + '|' + k);
                if (t?.state !== 'ok' || t.missing) return undefined;
                t.used = frameNo;
                if (t.stale && !t.rebuilding) {
                    // A tile of another zoom level standing in for a missing one: bring its data up to date as well.
                    const [z, x, y] = k.split('/').map(Number);
                    t.stale = false;
                    this.rebuild(source, {z, x, y, w: 0, key: k}, source + '|' + k, t);
                }
                return t.gl;
            });
            items.set(source, list);
            all.push(...list);
        }
        this.tapTile(view, 'frame');
        for (const key of this.early) if (this.tiles.get(key)?.state !== 'loading') this.early.delete(key);
        for (const [key, t] of this.tiles) {
            // (A tile that is built and waits for its upload is kept: its work is done, and a view that turns or pans back
            // often needs it again a moment later. With 3D terrain, a tile at the edge of the view was canceled there and
            // requested again 1.4 s later, #384.)
            if (t.state === 'loading' && !t.built && !wanted.has(key) && !this.early.has(key)) this.dropTile(key, t);
        }
        // Tell the page when the tiles of a source are all there (the map can be busy with other sources still).
        for (const source in this.style.sources) {
            const loaded = !loading.has(source), v = this.versions[source] ?? 0, state = v * 2 + +loaded;
            if (this.sourceLoaded.get(source) !== state) { this.sourceLoaded.set(source, state); this.emit({type: 'source', source, loaded, v}); }
        }
        // How many tiles are kept follows what the view needs: three times that many, so that the view can go back and
        // forth without new downloads. A small screen keeps fewer tiles, and so uses less memory on the GPU.
        const keep = clamp(wanted.size * 3 + 16, 48, MAX_TILES);
        if (this.tiles.size > keep) {
            const old = [...this.tiles].filter(([, t]) => t.used !== frameNo && t.state !== 'loading').sort((a, b) => a[1].used - b[1].used);
            for (const [key, t] of old.slice(0, this.tiles.size - keep)) this.dropTile(key, t);
        }

        const camera = `${tr.padding},${tr.lng},${tr.lat},${tr.zoom},${tr.bearing},${tr.pitch},${Math.round(tr.elevation)},${this.exaggeration}`, cameraChanged = camera !== this.lastCamera;
        // (The first camera of the map is not a movement: a map that starts is at rest, and the wait for a camera that
        // has just stopped would hold up the first `idle` by a fifth of a second, #436.)
        // (Nor is a new height of the ground under the camera, which comes with the elevation data of 3D terrain and not
        // from a movement: the camera string without it is `flat`.)
        const flat = camera.replace(/,[^,]*,[^,]*$/, '');
        if (cameraChanged) { this.placeDirty = true; if (this.lastCamera && flat !== this.lastView) this.cameraMovedAt = began; }
        this.lastView = flat;

        // Decide which labels show only every so often; in between they ride along with the map and fade.
        const zooming = Math.abs(tr.zoom - this.placeZoom) > 0.12;
        // At rest (and before the first `idle`), place in this frame and show the labels of new tiles at once, as
        // MapLibre GL JS does with `skipFade` (#371). A moving map keeps the interval and the fade.
        const rest = !this.wentIdle || (!animating && !cameraChanged && began - this.cameraMovedAt >= 200);
        const place = this.placeDirty && placeDue(now, this.lastPlace, this.placeCost, zooming, cameraChanged, rest);
        if (place) this.fade = zooming ? ZOOMING_FADE : FADE;
        const grid = place ? new CollisionGrid() : null;
        if (place) {
            this.placeDirty = false;
            this.lastPlace = now;
            this.placeZoom = tr.zoom;
            this.placeAngle = -tr.bearing * Math.PI / 180;
            const keep = new Set<string>(), resets = this.atlas.resets, start = performance.now();
            // (A label with several anchors tries the one that it shows first, as in MapLibre GL JS.)
            const shown = (key: string) => { const st = this.labels.get(key); return st?.target ? st.placed.anchor : undefined; };
            let placed = placeLabels(tr, all, this.layers, this.atlas, grid!, this.icon, L => this.reserve(grid!, items, L), shown);
            if (this.atlas.resets !== resets) {
                // The glyph atlas filled up and was emptied part-way through: earlier labels now point at stale
                // glyphs. Place again; the fresh atlas only has to hold this view's text.
                const again = new CollisionGrid();
                placed = placeLabels(tr, all, this.layers, this.atlas, again, this.icon, L => this.reserve(again, items, L), shown);
            }
            for (const p of placed) {
                keep.add(p.key);
                const st = this.labels.get(p.key);
                // (Each label goes to the end of the map, so that labels are drawn in the order of this placement and
                // not in the order in which they were first seen: that order depends on which tile came first.)
                this.labels.delete(p.key);
                this.labels.set(p.key, st ? (st.placed = p, st.target = 1, st) : {placed: p, opacity: rest && this.freshTiles.has(p.tile.key) ? 1 : 0, target: 1});
            }
            // (A label of a new tile can be placed only later, when its glyphs or images have come: the tile stays new for a while.)
            for (const [key, at] of this.freshTiles) if (now - at > 500) this.freshTiles.delete(key);
            for (const [key, st] of this.labels) if (!keep.has(key)) st.target = 0;
            this.placeCost = performance.now() - start;
        }
        const labels: Placed[] = [];
        let fading = false;
        const turn = -tr.bearing * Math.PI / 180 - this.placeAngle, at: [number, number, number] = [0, 0, 0], far = tr.depthRange()[1];
        for (const [key, st] of this.labels) {
            if (st.opacity !== st.target) {
                st.opacity = fadeStep(st.opacity, st.target, dt, this.fade, !this.wentIdle);
                fading ||= st.opacity !== st.target;
            }
            if (!st.opacity && !st.target) { this.labels.delete(key); continue; }
            const p = st.placed;
            // On the globe a label whose anchor has turned behind the horizon is not drawn in this frame, as MapLibre GL
            // JS does in its shaders. It keeps its state, so that it is there at once when it turns back. (Placement
            // comes every 250 ms only, and the fade takes 200 ms more: until then the label showed through the globe.)
            if (globeness && tr.globe!.hidden(tr, (p.tile.x + p.src.x / EXTENT) / 2 ** p.tile.z, (p.tile.y + p.src.y / EXTENT) / 2 ** p.tile.z)) continue;
            const q = tr.projectTile(p.tile, p.src.x, p.src.y, undefined, at);
            // (An anchor that is too far away or beyond the horizon is not drawn in this frame, as at a placement (#924).
            // It keeps its state, as on the globe.)
            if (tooFar(tr, q[2], far)) continue;
            let d = st.drawn!;
            if (st.drawnFrom !== p) {
                d = st.drawn = {...p, icon: p.icon && {...p.icon, gx: p.icon.gx?.slice(), gy: p.icon.gy?.slice(), frame: p.icon.frame?.slice()}, curve: p.curve?.slice(), ground: p.ground?.slice(), frame: p.frame?.slice()};
                st.drawnFrom = p; st.turned = false;
            }
            d.opacity = st.opacity;
            labels.push(d);
            // (Text along a line, and a symbol at a point that is aligned with the map, turn with the map between
            // placements; otherwise they would hold the old angle and then snap, which reads as rocking while the map rotates.)
            st.turned = moveLabel(tr, p, d, q[0], q[1], q[2], turn, !!st.turned);
        }
        if (this.iconsRev !== this.iconsDone) {
            // Images often come one after another (the variants of a template, the answers to missing images). The
            // buffers are made again when no image came for a tenth of a second, and after a second at the latest.
            if (this.iconsRev !== this.iconsSeen) { this.iconsSeen = this.iconsRev; this.iconsLast = now; this.iconsSince ||= now; }
            // (Before the first `idle` the buffers do not wait: an image that a layer asked for is on the way to the first
            // complete picture, and a wait of a tenth of a second would hold up `idle` (#628).)
            if (!this.wentIdle || now - this.iconsLast >= 100 || now - this.iconsSince >= 1000) {
                this.iconsDone = this.iconsRev; this.iconsSince = 0;
                for (const t of this.tiles.values()) if (t.gl?.icons) this.renderer.refreshIcons(t.gl, this.iconsAll);
                this.iconsAll = false;
            }
        }
        // 3D terrain that has just been switched on, or a camera just sent somewhere new: until the height of the ground
        // at the center is known the camera cannot be placed, and drawing from sea level would show the wrong view and
        // then jump. Keep what is on screen for a moment instead (but not for long, in case the data never comes).
        const unplaced = !!terrain && !globeness && this.centreGiven && !this.demTile(mercX(tr.lng) - Math.floor(mercX(tr.lng)), mercY(tr.lat), 30);
        if (!unplaced) this.unplacedSince = 0; else if (!this.unplacedSince) this.unplacedSince = now;
        const hold = unplaced && now - this.unplacedSince < 3000;
        // For a moment after the camera stops, a frame is drawn as for a map that moves. One more frame comes after it:
        // the frame for the map at rest (sharp images). The map is not idle before that frame.
        const settling = began - this.cameraMovedAt < 200;
        let globeScene;
        if (globeness) {
            const f = tr.globe!.frame(tr);
            globeScene = {m: Float32Array.from(f.m), horizon: f.horizon, cam: f.cam, rays: tr.globe!.rays(tr), t: globeness, cosLat: Math.cos(Math.min(Math.abs(tr.lat), 85.051129) * Math.PI / 180), tiles: tr.tileCover(0, 5, TILE_SIZE)};
        }
        const behind = hold || this.renderer.render({tr, layers: this.layers, items, labels, atlas: this.atlas, icon: this.pattern, light: this.style.light, sky: this.style.sky, moving: settling, globe: globeScene,
            // (Past the time limit and still unplaced: draw flat rather than raise terrain around a camera in the wrong place.)
            terrain: ground && !unplaced ? {exaggeration: this.exaggeration, tiles: ground, dem: this.demRef} : undefined});

        if (cameraChanged || animating !== this.moving) {
            this.lastCamera = camera;
            this.moving = animating;
            this.emit({type: 'camera', lng: tr.lng, lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch, elevation: tr.elevation, exaggeration: this.exaggeration, groundRange: tr.groundRange, padding: tr.padding, moving: animating, seq: this.seq,
                grab: this.grab ? [this.grab.lng, this.grab.lat, this.grab.seq] : undefined});
        }
        const busy = animating || fading || began < this.transitionEnd || this.placeDirty || this.iconsRev !== this.iconsDone || behind || this.renderer.iconsBehind || this.meshBehind || !!ground && this.demLoading;
        const idle = complete && !busy && !settling && !this.spritePending && !this.contourWait && !this.atlas.loading;
        // (The frame for the map at rest comes when the 200 ms are over, not 200 ms after this frame.)
        if (settling && !busy) setTimeout(() => this.repaint(), 200 - (began - this.cameraMovedAt));
        if (this.contourWait) { this.contourWait = false; setTimeout(() => this.repaint(), CONTOUR_WAIT + 20); }
        // (A context can be lost with no event. Nothing was drawn then, and the page must not take this for a frame.)
        // The page always gets a `frame` event for the first frame that an engine has drawn to its end: a new engine that
        // sends none cannot draw (see `watch` in map.ts). The event comes after the drawing, because the drawing can fail,
        // and not while the context is lost, because a context can be lost with no event.
        if (!this.renderer.gl.isContextLost()) {
            if (this.reportFrames || !this.drew) { this.drew = true; this.emit({type: 'frame'}); }
            // (The answer to `ping`: this worker still takes messages and still draws.)
            if (this.pinged) { this.emit({type: 'pong', n: this.pinged}); this.pinged = 0; }
            // (The bitmap is copied when `convertToBlob` is called, before the drawing buffer goes to the page and is cleared.
            // WebKit gives blank pixels for the canvas of the page whose control went to a worker; #965.)
            for (const c of this.shots.splice(0)) (this.canvas as OffscreenCanvas).convertToBlob({type: c.mime, quality: c.quality})
                .then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: '[map-jr-gl] toBlob(): the browser could not encode the image as ' + c.mime + '. ' + err}));
        }
        // In a worker, the frame of the `OffscreenCanvas` reaches the page after this task, and on a loaded machine one
        // frame of the page later still (#555). The next animation frame of the worker starts once this frame has gone
        // to the page, so `idle` goes then; a hidden page runs no frames, so a timer sends it too.
        if (idle && !this.wasIdle) {
            if (typeof document !== 'undefined' && !this.inResize) this.emit({type: 'idle', seq: this.seq});
            else {
                const seq = this.seq;
                let sent = false;
                const send = () => { if (!sent) { sent = true; if (this.wasIdle && seq === this.seq) this.emit({type: 'idle', seq}); } };
                raf(send); setTimeout(send, 100);
            }
        }
        // (One more frame after the first `idle`: it requests the overview tiles.)
        if (idle && !this.wentIdle) { this.wentIdle = true; this.repaint(); }
        // WebKit does not always show the one frame that a map draws after a pause (#429): the page keeps the old picture,
        // with no error and no lost context. A frame that comes after a pause is therefore followed by one more frame.
        if (began - this.lastFrameAt > 100) this.repaint();
        this.lastFrameAt = began;
        this.wasIdle = idle;
        if (busy) this.repaint();
        const st = this.stats, end = performance.now();
        st.frames++; st.cpu += end - began;
        if (!st.since) st.since = began;
        else if (end - st.since >= 1000) {
            this.emit({type: 'stats', fps: st.frames / ((end - st.since) / 1000), frameMs: st.cpu / st.frames, labels: labels.length});
            this.stats = {since: end, frames: 0, cpu: 0};
        }
        // After a pause the next burst of frames starts a fresh measurement instead of averaging in the idle time.
        if (!busy) this.stats.since = 0;
    }

    /**
     * Where an icon of a symbol layer is drawn around the point of its feature, in pixels: the middle of the icon, and
     * half of the width and of the height of the box around it. `w` and `h` are the size of the image, and `turn` is
     * `icon-rotate` in radians. (The same rules as for an icon that is placed with the labels: see `placeLabels`.)
     */
    private iconBox(L: CompiledLayer, w: number, h: number, size: number, turn: number, f?: Feature): [number, number, number, number] {
        const z = this.tr.zoom, anchor = L.p.iconAnchor.eval(z, f) as string, offset = L.p.iconOffset.eval(z, f) as number[], move = screenTranslate(L.p.iconTranslate.eval(z), L.p.iconTranslateAnchor.eval(z), this.tr.bearing);
        const angle = (L.p.iconAlign.eval(z, f) === 'map' ? -this.tr.bearing * Math.PI / 180 : 0) + turn, cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
        return [(offset[0] + (anchor.includes('left') ? 0.5 : anchor.includes('right') ? -0.5 : 0) * w) * size + move[0], (offset[1] + (anchor.includes('top') ? 0.5 : anchor.includes('bottom') ? -0.5 : 0) * h) * size + move[1],
            (w * cos + h * sin) / 2 * size, (w * sin + h * cos) / 2 * size];
    }

    /** The image with a name, or (for the name of a template) one of its variants: they all have one size. */
    private imageNamed(name: string) {
        // An image of the style (`own`) takes the place of the sprite image of the same name: the page gives it on demand (#1199).
        const found = this.images.get(name) ?? (this.sprite && Object.hasOwn(this.sprite.icons, name) && !this.style?.own?.includes(name) ? this.sprite.icons[name] : undefined);
        if (found) return found;
        for (const [key, image] of this.images) if (key.startsWith(name + VARIANT)) return image;
    }

    /**
     * The boxes of the text of the shown labels of a layer at a point (the collision boxes, with `text-padding`), in
     * pixels of the screen, each with the point of its label on the screen now. (Text along a line is not among them.)
     */
    private textBoxes(layer: string) {
        const out: {x: number; y: number; box: number[]}[] = [], at: [number, number, number] = [0, 0, 0];
        for (const [key, {placed: p, target}] of this.labels) {
            if (!target || !p.shaped || p.curve || p.src.angle !== null || !key.startsWith(layer + '|')) continue;
            const [x, y] = this.tr.projectTile(p.tile, p.src.x, p.src.y, undefined, at), s = p.size / EM, w = p.shaped.width * s, h = p.shaped.height * s;
            const cos = Math.abs(Math.cos(p.angle)), sin = Math.abs(Math.sin(p.angle)), hw = (w * cos + h * sin) / 2 + p.src.padding, hh = (w * sin + h * cos) / 2 + p.src.padding;
            const cx = p.x + x - p.ax, cy = p.y + y - p.ay;
            out.push({x, y, box: [cx - hw, cy - hh, cx + hw, cy + hh]});
        }
        return out;
    }

    /**
     * Whether a feature of a symbol layer that a question found is drawn in the rectangle of the question (in pixels
     * of the screen): its own icon, with its image, size, anchor, offset and turn, is in the rectangle, or the box of
     * its shown text (see `textBoxes`) is in the rectangle, or, when no text of it is
     * shown at the point, the feature has text and its point is within `radius` pixels of the rectangle. (A feature with no point, and an icon whose image the map
     * does not have, is found within `radius` pixels of its geometry as before.)
     */
    private underIcon(L: CompiledLayer, q: QueriedFeature, box: number[], radius: number, texts: {x: number; y: number; box: number[]}[]): boolean {
        const tr = this.tr, z = tr.zoom, g = q.geometry, f: Feature = {type: 1, id: q.id, properties: q.properties};
        const points = g?.type === 'Point' ? [g.coordinates as number[]] : g?.type === 'MultiPoint' ? g.coordinates as number[][] : null;
        const name = pickImage(String(L.p.icon.eval(z, f) ?? ''), n => this.imageNamed(n.split(VARIANT)[0])).split(VARIANT)[0];
        const image = this.imageNamed((L.p.icon.tokens ? name.replace(/\{([^}]+)\}/g, (_, k) => f.properties[k] ?? '') : name).trim());
        if (!points) return true;
        const near = !image || !!String(L.p.field.eval(z, f) ?? ''), turn = L.p.iconRotate.eval(z, f) * Math.PI / 180;
        return points.some(([lng, lat]) => {
            const [x, y] = tr.project(lng, lat);
            // A label that is shown at the point is found on the box of its text, and only there.
            const mine = texts.filter(t => Math.abs(t.x - x) < 1 && Math.abs(t.y - y) < 1);
            if (mine.some(t => t.box[0] <= box[2] && t.box[2] >= box[0] && t.box[1] <= box[3] && t.box[3] >= box[1])) return true;
            if (near && !mine.length && x >= box[0] - radius && x <= box[2] + radius && y >= box[1] - radius && y <= box[3] + radius) return true;
            if (!image) return false;
            // (On a tilted map a near icon is larger and a far icon is smaller, as it is drawn.)
            const depth = tr.pitch ? tr.projectTile({z: 0, x: 0, y: 0, w: 0, key: ''}, mercX(lng) * EXTENT, mercY(lat) * EXTENT)[2] : 0;
            const size = L.p.iconSize.eval(z, f) * (depth > 0 ? Math.min(4, 0.5 + 0.5 * tr.cameraDistance / depth) : 1);
            const [cx, cy, hw, hh] = this.iconBox(L, image.width / image.pixelRatio, image.height / image.pixelRatio, size, turn, f);
            return x + cx - hw <= box[2] && x + cx + hw >= box[0] && y + cy - hh <= box[3] && y + cy + hh >= box[1];
        });
    }

    /**
     * How far from the point of a feature the icons of a symbol layer can reach on the screen: to the left, up, to the
     * right and down, in pixels (left and up are negative). It is found from the images that the tiles of the layer use
     * now, and it is the reach of the largest one in each direction: a question asks the tiles with it, and tests each
     * feature that comes back with its own icon. Null: the tiles have no icon of the layer.
     */
    private reaches = new Map<string, {at: string; reach: [number, number, number, number] | null}>();
    private iconReach(L: CompiledLayer): [number, number, number, number] | null {
        // (The answer is kept while the tiles, the images and the view are the same: a question comes with each move of the pointer.)
        const tr = this.tr, z = tr.zoom, at = `${this.tilesVersion}|${this.tiles.size}|${this.styleVersion}|${this.iconsRev}|${z}|${tr.bearing}|${tr.pitch}`, kept = this.reaches.get(L.id);
        if (kept?.at === at) return kept.reach;
        const names = new Set<string>(), each = L.p.iconAnchor.dd || L.p.iconOffset.dd || L.p.iconRotate.dd || L.p.iconAlign.dd;
        let size = L.p.iconSize.dd ? 0 : L.p.iconSize.eval(z);
        for (const [key, t] of this.tiles) {
            if (!t.gl || !key.startsWith(L.source + '|')) continue;
            const b = t.gl.icons?.[L.id]?.src;
            if (b) { for (const name of b.names) names.add(name); if (b.size) for (const s of b.size) if (s > size) size = s; }
            for (const l of t.gl.labels[L.id] ?? []) if (l.icon) { names.add(l.icon.name); if (L.p.iconSize.dd) size = Math.max(size, l.icon.size, l.icon.size1); }
        }
        let w = 0, h = 0, reach: [number, number, number, number] | null = null;
        for (const name of names) { const m = this.imageNamed(name); if (m) { w = Math.max(w, m.width / m.pixelRatio); h = Math.max(h, m.height / m.pixelRatio); } }
        if (w) {
            // (A tilted map can draw an icon up to four times larger. With an anchor, an offset or a turn for each
            // feature, an icon can reach as far as its corner and its offset in each direction.)
            size *= tr.pitch ? 4 : 1;
            const [cx, cy, hw, hh] = this.iconBox(L, w, h, size, L.p.iconRotate.dd ? 0 : L.p.iconRotate.eval(z) * Math.PI / 180);
            const far = Math.hypot(w, h) * size + Math.hypot(cx, cy) + 64 * size;
            reach = each ? [-far, -far, far, far] : [cx - hw, cy - hh, cx + hw, cy + hh];
        }
        this.reaches.set(L.id, {at, reach});
        return reach;
    }

    /**
     * Gives the icons of a symbol layer that the tiles have in buffers, and that labels avoid (see `IconBatch`), their
     * space among the labels. They are always shown, so each one gets its space when the placement comes to its layer:
     * before the labels of that layer and of the layers below it, and after the labels of the layers above it, as for
     * an icon that is placed.
     */
    private reserve(grid: CollisionGrid, items: Map<string, RenderItem<GLTile>[]>, only: CompiledLayer) {
        const tr = this.tr;
        const zoom = tr.zoom;
        for (const L of [only]) {
            for (const it of items.get(L.source!) ?? []) {
                const b = it.tile.icons?.[L.id]?.src;
                if (!b?.avoid) continue;
                const images = b.names.map(this.icon), t = clamp(zoom - (it.tile.z ?? it.id.z), 0, 1), pad = L.p.iconPadding.eval(zoom), fixed = L.p.iconSize.dd ? 1 : L.p.iconSize.eval(zoom), turn = L.p.iconRotate.dd ? 0 : L.p.iconRotate.eval(zoom) * Math.PI / 180;
                for (let i = 0; i < b.name.length; i++) {
                    const m = images[b.name[i]], x = b.pos[i * 2], y = b.pos[i * 2 + 1];
                    if (!m || x < it.clip[0] || y < it.clip[1] || x >= it.clip[2] || y >= it.clip[3]) continue;
                    const [ax, ay, depth] = tr.projectTile(it.id, x, y);
                    if (ax < -100 || ay < -100 || ax > tr.width + 100 || ay > tr.height + 100) continue;
                    const size = (b.size ? b.size[i * 2] + (b.size[i * 2 + 1] - b.size[i * 2]) * t : fixed) * (tr.pitch ? Math.min(4, 0.5 + 0.5 * tr.cameraDistance / depth) : 1);
                    const [cx, cy, hw, hh] = this.iconBox(L, m.width / m.pixelRatio, m.height / m.pixelRatio, size, b.rotate ? b.rotate[i] : turn);
                    grid.insert(ax + cx - hw - pad[3], ay + cy - hh - pad[0], ax + cx + hw + pad[1], ay + cy + hh + pad[2]);
                }
            }
        }
    }
}
