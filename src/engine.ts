import {heightsChanged} from './geo.ts';
import {EXTENT, HEIGHT_GRID, TILE_SIZE, Transform, bezier, groundHeight, clamp, latFromMerc, lngFromMerc, mercX, mercY, type LngLatLike, type TileID} from './geo.ts';
import {setGlobalState} from './expr.ts';
import {compileLayer, isGeometrySource, loadSprite, tileURL, type CompiledLayer, type FontSource, type ResolvedStyle, type Sprite, type SpriteIcon} from './style.ts';
import {GLRenderer, MARKER_FLOATS, MARKER_STRIDE, SPRITE_ATLAS, type DemRef, type GLTile, type MarkerBuffers, type TerrainTile} from './gl.ts';
import {CollisionGrid, placeLabels, renderItems, type Placed, type RenderItem} from './placement.ts';
import {GlyphAtlas} from './text.ts';
import {fetchWith, type Ask, type RequestAnswer, type RequestRules} from './requests.ts';
import {decodeElevation, sampleElevation, tilesUnderBox, type QueriedFeature, type QuerySet} from './query.ts';
import type {TileBackend} from './tiles.ts';
import type {TileGL} from './tile.ts';
import {fetchTile} from './pmtiles.ts';

export interface CameraOptions { center?: LngLatLike; zoom?: number; bearing?: number; pitch?: number; /** Space at the edges covered by other things: top, right, bottom, left. */ padding?: [number, number, number, number] }
export type {FontSource} from './style.ts';
export interface EngineOptions extends CameraOptions {
    style: ResolvedStyle; width: number; height: number; dpr: number; fontFamily: string; fonts?: FontSource[];
    minZoom?: number; maxZoom?: number; maxPitch?: number; antialias?: boolean;
}
export interface MarkerImage { variant: number; w: number; h: number; data: Uint8Array }
export interface FeatureQuery { radius: number; zoom?: number; sources?: string[]; sourceLayers?: string[]; filter?: unknown; geometry?: boolean }
export type Command =
    | {type: 'resize'; width: number; height: number; dpr: number}
    | ({type: 'jump'} & CameraOptions)
    | ({type: 'ease'; duration: number; around?: [number, number]} & CameraOptions)
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
    | {type: 'style'; style: ResolvedStyle; reload: boolean}
    | {type: 'markers'; id: string; width: number; height: number; offset: [number, number]; collide: boolean; minZoom: number; maxZoom: number; hideOverlaps: boolean;
        merc: Float64Array; variant: Uint32Array; images: MarkerImage[]}
    | {type: 'removeMarkers'; id: string}
    /** Animates one marker to a new size, about its anchor point. */
    | {type: 'markerScale'; id: string; index: number; scale: number; duration: number}
    /** A screen-space box pinned to a map position that labels must keep clear of (e.g. an open callout). Omit `box` to remove it. */
    | {type: 'obstacle'; id: string; merc?: [number, number]; box?: [number, number, number, number]}
    | {type: 'fonts'; fonts: FontSource[]}
    | {type: 'image'; name: string; w: number; h: number; width: number; height: number; data: Uint8Array; stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number]; textFitWidth?: 'stretchOrShrink' | 'stretchOnly' | 'proportional'; textFitHeight?: 'stretchOrShrink' | 'stretchOnly' | 'proportional'}
    | {type: 'removeImage'; name: string}
    | {type: 'geojson'; source: string; data: unknown}
    /** Replaces the feature state of one source ("sourceLayer|id" -> state); its tiles are rebuilt in place. */
    | {type: 'featureState'; source: string; states: Record<string, Record<string, unknown>>}
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
    | {type: 'frames'; on: boolean};
export type EngineEvent =
    | {type: 'camera'; lng: number; lat: number; zoom: number; bearing: number; pitch: number; /** Ground height at the centre with 3D terrain, else 0. */ elevation: number; exaggeration: number; groundRange?: [number, number]; padding: [number, number, number, number]; moving: boolean}
    | {type: 'idle'}
    /** 3D terrain: the height grid of an elevation tile that has loaded (or, without `grid`, been dropped). */
    | {type: 'heights'; key: string; grid?: Float32Array}
    /** About once a second while drawing: frames drawn per second and the engine's average CPU time per frame. */
    | {type: 'stats'; fps: number; frameMs: number}
    | {type: 'frame'}
    /** The browser took the WebGL context away (for example, a phone that needs the memory). The page starts the map again. */
    | {type: 'contextlost'}
    /** A question to the page about one request. */
    | {type: 'resource'; id: number; url: string; kind: string}
    /** A frame at a new canvas size has been drawn. */
    | {type: 'resized'; width: number; height: number; dpr: number}
    | {type: 'result'; id: number; value?: unknown; error?: string}
    | {type: 'imagemissing'; name: string}
    | {type: 'error'; message: string};

const DATA_OPS = /"(get|has|id|properties|geometry-type|feature-state|global-state|property|line-progress|accumulated)"/;
/**
 * Describes what a source's tiles depend on: first the source itself, then everything about its layers that is baked
 * into tile buffers (filters, layout, and paint values that vary per feature). Paint values that are the same for a
 * whole layer are applied at draw time, so changing them needs no new tiles.
 */
function sourceSignature(style: ResolvedStyle, name: string): [string, string] {
    const src = style.sources[name] as any, data = src.data;
    // Elevation tiles keep extra data when they shape 3D terrain, so switching terrain on or off starts them over.
    const source = JSON.stringify({...src, data: undefined, features: data?.features?.length, kind: data?.type, terrain: style.terrain?.source === name});
    if (!isGeometrySource(src)) return [source, '']; // image tiles do not depend on layers
    const layers = style.layers.filter(l => l.source === name).map(l => {
        const paint = Object.entries(l.paint ?? {}).filter(([k, v]) =>
            l.type === 'symbol' || l.type === 'fill-extrusion' || k === 'fill-antialias' || k === 'fill-outline-color' || k.endsWith('-pattern') || DATA_OPS.test(JSON.stringify(v)));
        return [l.id, l.type, (l as any)['source-layer'], l.filter, l.minzoom, l.maxzoom, l.layout, paint, (l as any).metadata];
    });
    // Layers that read global state are rebuilt when it changes.
    const json = JSON.stringify(layers);
    return [source, json.includes('"global-state"') ? json + JSON.stringify(style.state ?? {}) : json];
}

interface TileState { state: 'loading' | 'ok' | 'error'; gl?: GLTile; /** A number that changes each time the state or the content of the tile changes. */ rev?: number; /** Elevation tiles shaping 3D terrain: the lowest and highest ground on the tile, in metres. */ range?: [number, number]; used: number; cancel(): void; /** Shown, but built from data that has since changed. */ stale?: boolean; rebuilding?: boolean }
interface MarkerLayer {
    width: number; height: number; offset: [number, number]; collide: boolean; merc: Float64Array; variant: Uint32Array;
    minZoom: number; maxZoom: number; hideOverlaps: boolean;
    gpu?: MarkerBuffers; data?: Float32Array; scale?: Float32Array;
    /** 3D terrain: which buffers and which set of elevation tiles the markers' ground heights were last worked out for. */
    heightsFor?: MarkerBuffers; heightsVersion?: number;
}
interface LabelState { placed: Placed; opacity: number; target: number }

const raf: (cb: (t: number) => void) => unknown = globalThis.requestAnimationFrame
    ? cb => globalThis.requestAnimationFrame(cb) : cb => setTimeout(() => cb(performance.now()), 16);
const MAX_TILES = 160;
/** How long the zoom must be still before new contour tiles are made, in milliseconds. */
const CONTOUR_WAIT = 250;
/** How often labels are re-decided while the map moves, and how long they take to fade. Between decisions they stay pinned to the map. */
const PLACE_INTERVAL = 250, FADE = 200;
/** While the zoom is changing quickly labels crowd together (or thin out) fast, so decide and fade sooner. */
const ZOOMING_PLACE_INTERVAL = 100, ZOOMING_FADE = 100;
/** Camera feel, matching MapLibre's defaults so the map responds the way people expect. */
const defaultEasing = bezier(0.25, 0.1, 0.25, 1), inertiaEasing = bezier(0, 0, 0.3, 1);
const WHEEL_STEP = 4.000244140625, WHEEL_RATE = 1 / 450, TRACKPAD_RATE = 1 / 100;

/**
 * Everything that happens per frame: camera animation, tile selection, label placement and drawing.
 * It never touches the DOM, so it runs unchanged on the main thread or inside a worker with an OffscreenCanvas,
 * driven purely by `Command` messages and reporting back through `EngineEvent`s.
 */
/**
 * 3D terrain: the zoom at which a ground tile takes its image tiles (raster, elevation). The tile knows the detail that
 * the view wants at its nearest point; a little less is correct for the tile as a whole.
 */
const imageLevel = (id: TileID, zoom: number) => clamp((id.lod ?? zoom) - 0.25, id.z, id.z + 0.75);

export class Engine {
    tr = new Transform();
    private renderer: GLRenderer;
    private atlas: GlyphAtlas;
    private style!: ResolvedStyle;
    private layers: CompiledLayer[] = [];
    private tiles = new Map<string, TileState>();
    private frameNo = 0;
    private scheduled = false;
    private nextReq = 1;
    private nextBackend = 0;
    private lastCamera = '';
    private wasIdle = false;
    private moving = false;

    private ease: {from: number[]; to: number[]; start: number; duration: number; around?: [number, number]; anchor?: [number, number]} | null = null;
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
    private lastPlace = -Infinity;
    private placeAngle = 0;
    private placeZoom = 0;
    private fade = FADE;

    private markers = new Map<string, MarkerLayer>();
    private spriteRects = new Map<number, [number, number, number, number]>();
    private spritePen = [1, 1, 0];
    private markerAnims = new Map<string, {layer: string; index: number; from: number; to: number; start: number; duration: number}>();
    private obstacles = new Map<string, {merc: [number, number]; box: [number, number, number, number]}>();
    private sprite: Sprite | null = null;
    private spriteUrl = '';
    private styleFonts = '';
    private images = new Map<string, SpriteIcon & {custom: true}>();
    private missing = new Set<string>();
    private dem = new Map<string, Promise<{width: number; height: number; data: Uint8ClampedArray} | null>>();
    private dpr = 1;

    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, o: EngineOptions, private backends: TileBackend[], private emit: (e: EngineEvent) => void) {
        this.renderer = new GLRenderer(canvas, o.antialias);
        (canvas as EventTarget).addEventListener('webglcontextlost', () => { if (!this.lost) { this.lost = true; this.emit({type: 'contextlost'}); } }); // (not when the map itself freed the context)
        this.atlas = new GlyphAtlas(o.fontFamily);
        this.atlas.images = name => this.icon(name);
        this.atlas.onReset = () => this.labels.clear();
        this.tr.width = o.width;
        this.tr.height = o.height;
        this.dpr = o.dpr;
        this.renderer.resize(o.width, o.height, o.dpr);
        Object.assign(this.tr, {minZoom: o.minZoom ?? 0, maxZoom: o.maxZoom ?? 22, maxPitch: o.maxPitch ?? 60});
        this.tr.set(o.center, o.zoom, o.bearing, o.pitch);
        this.setStyle(o.style, true);
        if (o.fonts?.length) this.loadFonts(o.fonts);
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
        // (Tiles that only touch count: the heights on an edge of a tile come from its neighbour.)
        for (const d of a) if (d.version > version && d.x0 <= x1 && d.x1 >= x0 && d.y0 <= y1 && d.y1 >= y0) return true;
        return false;
    }
    /** `version` is the elevation data that the heights were made from; `checked` is the newest data that is known not to change them. */
    private meshHeights = new Map<string, {data: Float32Array; version: number; checked: number; used: number}>();
    private meshBehind = false;
    private grab: {lng: number; lat: number; at: number} | null = null;
    /** 3D terrain: the centre was set by the API rather than reached by a gesture, so it keeps its position. */
    private centreGiven = true;
    private unplacedSince = 0;
    private easeHeights: {ease: unknown; from: number} | null = null;
    /** 3D terrain: height of the ground at the map centre in real (unexaggerated) metres. */
    private rawElevation = 0;
    private lastPose = '';
    private movedAt = 0;
    private markerHeightsAt = 0;
    /** 3D terrain: the exaggeration in force this frame (zero when looking straight down, or with no terrain). */
    private exaggeration = 0;
    /** Counts changes to the style and its images, so cached terrain pictures know when they are out of date. */
    private styleVersion = 0;
    private invalidate() { this.placeDirty = true; this.repaint(); }

    /** The deepest loaded elevation tile at or above a position, and its zoom. */
    private demTile(x: number, y: number, z: number): {t: TileState; z: number} | null {
        const terrain = this.style.terrain, src = terrain && this.style.sources[terrain.source];
        if (!src) return null;
        for (let tz = Math.min(z, src.maxzoom); tz >= src.minzoom; tz--) {
            const n = 2 ** tz, t = this.tiles.get(`${terrain!.source}|${tz}/${Math.floor(x * n)}/${Math.floor(y * n)}`);
            if (t?.state === 'ok' && t.gl?.raw) return {t, z: tz};
        }
        return null;
    }

    /** Ground height at a mercator position in metres (exaggerated), from the best elevation tile loaded so far. */
    private heightAt = (mx: number, my: number): number => this.rawHeightAt(mx, my) * this.exaggeration;
    /** Height grids of the loaded elevation tiles, keyed "z/x/y"; mirrored to the page so it can project onto the ground too. */
    private heights = new Map<string, Float32Array>();
    private rawHeightAt(mx: number, my: number): number {
        const src = this.style.terrain && this.style.sources[this.style.terrain.source];
        return src ? groundHeight(this.heights, mx, my, src.maxzoom, src.minzoom, this.rawElevation) : 0; // where nothing is known yet, level with the centre; // always the most detailed data, so heights do not shift with zoom
    }

    /**
     * Heights at the 65 x 65 corners of a ground tile's mesh. Nearly all of them lie inside one elevation tile's grid
     * and are read straight from it; only points on the far edges (which belong to the neighbouring tiles) and tiles
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
    private upload(tile: TileGL): Promise<GLTile> {
        let bytes = 0;
        for (const b of Object.values(tile.layers)) for (const v of Object.values(b)) if (ArrayBuffer.isView(v)) bytes += v.byteLength;
        return this.paced(bytes, () => this.renderer.createTile(tile));
    }
    /** Does a piece of GPU upload work in its turn, so that one frame never has too much of it. */
    private paced(bytes: number, make: () => GLTile): Promise<GLTile> {
        return new Promise(done => { this.uploads.push({bytes, make, done}); this.repaint(); });
    }
    private flushUploads() {
        // About 1.5 MB a frame, and always at least one tile so that progress is certain.
        for (let budget = 1.5e6; this.uploads.length && budget > 0;) {
            const u = this.uploads.shift()!;
            budget -= u.bytes;
            u.done(u.make());
        }
        if (this.uploads.length) this.repaint();
    }

    private pictures = new Map<string, {url: string; gl?: GLTile}>();
    /**
     * An image source is one picture stretched between four corners. It is drawn like a tile: positioned relative to
     * a tile near the view's centre (which keeps the numbers small and exact), reaching outside it as far as it needs.
     */
    private pictureItems(source: string, tr: Transform): RenderItem<GLTile>[] {
        const src = this.style.sources[source];
        let st = this.pictures.get(source);
        if (!st || st.url !== src.url) {
            if (st?.gl) this.renderer.destroyTile(st.gl);
            const state: {url: string; gl?: GLTile} = st = {url: src.url!};
            this.pictures.set(source, state);
            this.fetchAs('Image')(src.url!).then(async res => {
                if (!res.ok) throw new Error(`Failed to load image ${src.url}: ${res.status}`);
                const image = await createImageBitmap(await res.blob());
                if (this.pictures.get(source) === state) { state.gl = this.renderer.createImageTile(image, undefined, {z: 0, x: 0, y: 0, w: 0, key: '0/0/0'}); this.styleVersion++; this.invalidate(); }
                image.close();
            }).catch(err => this.emit({type: 'error', message: String(err.message)}));
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
    private groundCache = new Map<string, ReturnType<Engine['groundSources']> & {used?: number}>();
    /** 3D terrain: the straight-down view of one ground tile, and the source tiles that are drawn into its picture. */
    private groundSources(id: TileID, zt: number, stamp: string) {
        const tr = this.tr, n = 2 ** id.z, view = new Transform(), keys: string[] = [];
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
            if (!this.layers.some(l => l.source === source && l.type !== 'symbol' && l.type !== 'fill-extrusion' && l.visible && zt >= l.minzoom && zt < l.maxzoom)) continue;
            if (src.type === 'image') { const list = this.pictureItems(source, view); items.set(source, list); signature += `,${source}:${list[0]?.tile.uid ?? ''}`; continue; }
            // Which level of tiles to draw follows the map's own zoom (not the picture's fixed scale), as it would without terrain.
            cover.zoom = clamp(tr.zoom, id.z, zt);
            // Image tiles are taken one level deeper when the detail that the view wants at this ground tile is past the
            // middle of a level, for a sharp image near the camera. Far ground tiles want less, so they stay at their own level.
            const image = src.type === 'raster' || src.type === 'raster-dem';
            if (image) cover.zoom = imageLevel(id, tr.zoom);
            // (A little less than the tile: a view that ends exactly on the tile's edge would take the tiles beyond it too.)
            cover.width = cover.height = TILE_SIZE * 2 ** (cover.zoom - id.z) - 2;
            const ideal = cover.coveringTiles(src.minzoom, src.maxzoom, src.tileSize, image);
            for (const t of ideal) {
                const key = source + '|' + t.key, have = this.tiles.get(key);
                keys.push(key);
                if (!have) this.request(source, t, key);
                else if (have.stale && have.state === 'ok' && !have.rebuilding) { have.stale = false; this.rebuild(source, t, key, have); }
                if (this.tiles.get(key)?.state === 'loading') complete = false;
            }
            const list = renderItems(view, ideal, k => {
                const key = source + '|' + k, t = this.tiles.get(key);
                if (t?.state !== 'ok') return undefined;
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
        for (const [k, m] of this.meshHeights) if (this.frameNo - m.used > 120) this.meshHeights.delete(k);
        for (const [k, m] of this.groundCache) if (this.frameNo - (m.used ?? 0) > 120) this.groundCache.delete(k);
        const viewLit = this.layers.some(l => l.type === 'hillshade' && l.visible && l.p.anchor.eval(tr.zoom) === 'viewport');
        for (const id of tr.coveringTiles(0, 22, TILE_SIZE).slice(0, 96)) { // nearest first; a cap keeps odd views affordable
            // Each tile's picture is drawn once, at a fixed scale a little above the tile's own (it is shown at up to twice
            // its size before finer tiles take over), and stretched as the map zooms. Zooming therefore redraws nothing.
            const zt = id.z + 0.75, tkey = `${id.key}|${id.w}`;
            // Which source tiles make the picture of this ground tile is much work for each of up to 96 tiles. The answer
            // changes only when a tile arrives or goes, the style changes, the map zooms to another level of tiles, or (for
            // relief that is lit from the viewer's side) the map turns. Until then the last answer is used.
            const stamp = `${this.styleVersion}|${Math.round(imageLevel(id, tr.zoom))}`;
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
            const {view, items, signature, complete} = made;
            // The heights themselves: make sure the elevation tile for this ground tile is on its way. Where the source
            // has no tile at that level (the request failed), the nearest level above that does have one is used.
            for (let dz = Math.min(id.z, demSrc.maxzoom); dz >= demSrc.minzoom; dz--) {
                const k = 2 ** (id.z - dz), dk = `${dz}/${Math.floor(id.x / k)}/${Math.floor(id.y / k)}`, demKey = terrain.source + '|' + dk;
                wanted.add(demKey);
                const t = this.tiles.get(demKey);
                if (!t) { this.request(terrain.source, {z: dz, x: Math.floor(id.x / k), y: Math.floor(id.y / k), w: 0, key: dk}, demKey); break; }
                t.used = this.frameNo;
                if (t.state === 'loading' || t.range) break; // otherwise it failed or came back empty: try the level above
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
    private sourceSigs = new Map<string, [string, string]>();

    private setStyle(style: ResolvedStyle, reload: boolean) {
        if (JSON.stringify(style.terrain) !== JSON.stringify(this.style?.terrain)) this.centreGiven = true;
        this.style = style;
        this.styleVersion++;
        setGlobalState(style.state);
        this.layers = style.layers.map(compileLayer).filter((l): l is CompiledLayer => !!l);
        if (style.sprite && style.sprite !== this.spriteUrl) {
            this.spriteUrl = style.sprite;
            // The map is not idle while the sprite loads: its icons are part of the first complete picture.
            this.spritePending++;
            this.loadIcons(style.sprite).catch(err => this.emit({type: 'error', message: String(err.message)})).finally(() => { this.spritePending--; this.invalidate(); });
        }
        const faces = JSON.stringify(style.fonts ?? []);
        if (style.fonts?.length && faces !== this.styleFonts) { this.styleFonts = faces; this.loadFonts(style.fonts); }
        if (reload) {
            for (const [name, src] of Object.entries(style.sources)) if (src.type === 'geojson') for (const b of this.backends) b.setGeoJSON(name, src.data, src.options, src.maxzoom);
            const contours = Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.contour).map(([name, s]) => [name, s.contour!]));
            for (const b of this.backends) b.setContours(contours);
            for (const b of this.backends) b.setStyle(style.layers, style.state);
            // Only tiles whose contents the change can affect are touched. A changed source starts over; changed
            // layers rebuild their source's tiles in place, so the old ones stay on screen until the new are ready.
            const sigs = new Map(Object.keys(style.sources).map(name => [name, sourceSignature(style, name)]));
            for (const [key, t] of this.tiles) {
                const name = key.slice(0, key.lastIndexOf('|')), was = this.sourceSigs.get(name), now = sigs.get(name);
                if (!was || !now || was[0] !== now[0]) this.dropTile(key, t);
                else if (was[1] !== now[1]) { t.stale = true; t.rev = ++this.tilesVersion; }
            }
            this.sourceSigs = sigs;
        }
        this.invalidate();
    }

    /**
     * Loads the sprite of the style: one sheet (a URL), or several sheets with ids (a list, as text). The icons of a
     * sheet with an id other than `default` have the names `id:name`. Several sheets are put into one image.
     */
    private async loadIcons(spec: string) {
        const sheets: {id: string; url: string}[] = spec[0] === '[' ? JSON.parse(spec) : [{id: 'default', url: spec}];
        const loaded = await Promise.all(sheets.map(async ({id, url}) => {
            const sprite = await loadSprite(url, this.dpr > 1, this.fetchAs('SpriteJSON'));
            const res = await this.fetchAs('SpriteImage')(sprite.image);
            if (!res.ok) throw new Error(`Failed to load sprite image ${sprite.image}: ${res.status}`);
            return {id, sprite, image: await createImageBitmap(await res.blob())};
        }));
        if (spec !== this.spriteUrl) return;
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
        this.styleVersion++;
        this.invalidate();
    }

    /** Loads web fonts into whichever thread the engine runs on, then redraws all text with them. */
    private loadFonts(fonts: FontSource[]) {
        const set = (globalThis as any).fonts ?? (globalThis as any).document?.fonts;
        this.spritePending++; // fonts are also part of the first complete picture
        Promise.all(fonts.map(async f => {
            // The font file is fetched here and given to the browser as bytes. WebKit (Safari) does not load a font from a
            // URL inside a worker, and the labels then used a fallback font.
            const bytes = await (await this.fetchAs('Font')(f.src)).arrayBuffer();
            const face = new FontFace(f.family, bytes, {weight: String(f.weight ?? '400'), style: f.style ?? 'normal', ...(f.unicodeRange ? {unicodeRange: f.unicodeRange} : {})});
            set.add(await face.load());
        })).then(() => { this.atlas.clear(true); this.relabel(); },
            err => this.emit({type: 'error', message: `Could not load font: ${err.message}`})).finally(() => { this.spritePending--; this.invalidate(); });
    }

    private icon = (name: string) => {
        const found = this.images.get(name) ?? this.sprite?.icons[name];
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
        if (c.type !== 'query' && c.type !== 'elevation') this.wasIdle = false;
        switch (c.type) {
            case 'resize':
                tr.width = c.width; tr.height = c.height; this.dpr = c.dpr;
                this.renderer.resize(c.width, c.height, c.dpr);
                this.placeDirty = true;
                // Draw immediately: resizing clears the canvas, and waiting a frame would flash.
                this.frame(performance.now());
                this.emit({type: 'resized', width: c.width, height: c.height, dpr: c.dpr});
                return;
            case 'jump': this.stop(); if (c.padding) tr.padding = c.padding; tr.set(c.center, c.zoom, c.bearing, c.pitch); if (c.center || c.zoom !== undefined) this.centreGiven = true; break;
            case 'ease': {
                this.stop();
                const to = new Transform();
                Object.assign(to, {lng: tr.lng, lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch, minZoom: tr.minZoom, maxZoom: tr.maxZoom});
                to.set(c.center, c.zoom, c.bearing, c.pitch);
                let db = to.bearing - tr.bearing;
                db = ((db + 180) % 360 + 360) % 360 - 180;
                this.ease = {
                    from: [mercX(tr.lng), mercY(tr.lat), tr.zoom, tr.bearing, tr.pitch, ...tr.padding], to: [mercX(to.lng), mercY(to.lat), to.zoom, tr.bearing + db, to.pitch, ...(c.padding ?? tr.padding)],
                    start: performance.now(), duration: Math.max(1, c.duration), around: c.around,
                    anchor: c.around ? tr.unproject(c.around[0], c.around[1]) : undefined,
                };
                this.centreGiven = !c.around;
                break;
            }
            case 'pan': {
                this.fling = null; this.ease = null;
                const now = performance.now();
                if (c.x === undefined || c.y === undefined) { tr.set(tr.unprojectFlat(tr.cx - c.dx, tr.cy - c.dy)); break; }
                this.centreGiven = false;
                // A drag holds on to the ground (and its height) where it began; each move puts that point under the pointer.
                // (A new drag is recognised by a pause, or by the pointer not being where the held point is.)
                const held = this.grab && now - this.grab.at < 300 ? tr.project(this.grab.lng, this.grab.lat) : null;
                if (!held || Math.hypot(held[0] - (c.x - c.dx), held[1] - (c.y - c.dy)) > 24) {
                    const [lng, lat] = tr.unproject(c.x - c.dx, c.y - c.dy);
                    this.grab = {lng, lat, at: now};
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
                this.fling = null; this.ease = null;
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
                break;
            }
            case 'stop': this.stop(); break;
            case 'limits': Object.assign(tr, {minZoom: c.minZoom, maxZoom: c.maxZoom, maxPitch: c.maxPitch, minPitch: c.minPitch ?? 0, maxBounds: c.maxBounds ?? null}); tr.set(undefined, tr.zoom, undefined, tr.pitch); break;
            case 'refresh':
                for (const [key, t] of this.tiles) if (!c.source || key.startsWith(c.source + '|')) this.dropTile(key, t);
                this.invalidate();
                break;
            case 'style': this.setStyle(c.style, c.reload); break;
            case 'markers': {
                for (const img of c.images) { const rect = this.addSprite(img.w, img.h, img.data); if (rect) this.spriteRects.set(img.variant, rect); }
                // Re-sent data (e.g. after a property change) keeps each marker's current size when the count is unchanged.
                const previous = this.markers.get(c.id), layer: MarkerLayer = {...c, gpu: previous?.gpu, scale: previous?.scale?.length === c.variant.length ? previous.scale : undefined};
                this.markers.set(c.id, layer);
                this.uploadMarkers(c.id, layer);
                this.placeDirty = true;
                break;
            }
            case 'removeMarkers': { const m = this.markers.get(c.id); if (m?.gpu) this.renderer.removeMarkers(m.gpu); this.markers.delete(c.id); this.placeDirty = true; break; }
            case 'markerScale': {
                const m = this.markers.get(c.id), from = m?.scale?.[c.index] ?? 1;
                if (m) this.markerAnims.set(c.id + '|' + c.index, {layer: c.id, index: c.index, from, to: c.scale, start: performance.now(), duration: Math.max(1, c.duration)});
                break;
            }
            case 'obstacle':
                if (c.box && c.merc) this.obstacles.set(c.id, {merc: c.merc, box: c.box}); else this.obstacles.delete(c.id);
                this.placeDirty = true;
                break;
            case 'fonts': this.loadFonts(c.fonts); break;
            case 'image': {
                const rect = this.addSprite(c.w, c.h, c.data);
                if (rect) this.images.set(c.name, {x: rect[0], y: rect[1], width: c.w, height: c.h, pixelRatio: c.w / c.width, custom: true, stretchX: c.stretchX, stretchY: c.stretchY, content: c.content, textFitWidth: c.textFitWidth, textFitHeight: c.textFitHeight});
                this.styleVersion++;
                this.placeDirty = true;
                break;
            }
            case 'removeImage': this.images.delete(c.name); this.placeDirty = true; break;
            case 'geojson': {
                // New data for one source: keep drawing its current tiles and rebuild them in place, so nothing blinks.
                if (this.style.sources[c.source]) this.style.sources[c.source].data = c.data;
                for (const b of this.backends) b.setGeoJSON(c.source, c.data, this.style.sources[c.source]?.options, this.style.sources[c.source]?.maxzoom);
                for (const [key, t] of this.tiles) {
                    if (!key.startsWith(c.source + '|')) continue;
                    // Tiles on screen or still loading are rebuilt in place once they can be; cancelling loads here
                    // would starve a map that is being moved while its data updates.
                    if (t.state === 'loading' || t.used >= this.frameNo - 1) { t.stale = true; t.rev = ++this.tilesVersion; } else this.dropTile(key, t);
                }
                break;
            }
            case 'featureState':
                for (const b of this.backends) b.setFeatureState(c.source, c.states);
                for (const [key, t] of this.tiles) if (key.startsWith(c.source + '|')) { t.stale = true; t.rev = ++this.tilesVersion; }
                break;
            case 'queryRendered':
                this.queryRendered(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                break;
            case 'query':
                this.queryFeatures(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                return;
            case 'elevation':
                this.queryElevation(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                return;
            case 'repaint': break;
            case 'destroy': this.lost = true; this.renderer.destroy(); return;
            case 'frames': this.reportFrames = c.on; break;
            case 'requests': this.rules = c.rules; for (const b of this.backends) b.setRequests(c.rules, this.ask); break;
            case 'resourceResult': this.asked.get(c.id)?.(c); this.asked.delete(c.id); break;
        }
        this.repaint();
    }

    private stop() { this.ease = null; this.wheel = null; this.fling = null; this.grab = null; }

    private zoomAround(zoom: number, x: number, y: number) {
        const [lng, lat] = this.tr.unproject(x, y);
        this.tr.set(undefined, zoom);
        this.tr.setLocationAt(lng, lat, x, y);
    }

    /** Copies an image into the dynamic atlas shared by markers and runtime-added icons. */
    private addSprite(w: number, h: number, data: Uint8Array): [number, number, number, number] | null {
        const pen = this.spritePen;
        if (pen[0] + w + 1 > SPRITE_ATLAS) { pen[0] = 1; pen[1] += pen[2] + 1; pen[2] = 0; }
        if (pen[1] + h + 1 > SPRITE_ATLAS) { this.emit({type: 'error', message: 'Image atlas is full'}); return null; }
        this.renderer.uploadSprite(pen[0], pen[1], w, h, data);
        const rect: [number, number, number, number] = [pen[0], pen[1], w, h];
        pen[0] += w + 1;
        pen[2] = Math.max(pen[2], h);
        return rect;
    }

    // ---- queries: answered from tile data, independent of what is drawn ----

    private tileAt(lng: number, lat: number, z: number) {
        const n = 2 ** z, mx = ((mercX(lng) % 1) + 1) % 1 * n, my = clamp(mercY(lat), 0, 1 - 1e-9) * n;
        return {x: Math.floor(mx), y: Math.floor(my), u: mx - Math.floor(mx), v: my - Math.floor(my)};
    }

    /** The features that the given style layers draw in a rectangle of the screen, from the tiles of the present zoom. */
    private async queryRendered(c: Extract<Command, {type: 'queryRendered'}>): Promise<QueriedFeature[]> {
        const jobs: Promise<QueriedFeature[]>[] = [];
        for (const [name, src] of Object.entries(this.style.sources)) {
            const sets = c.sets.filter(s => s.source === name);
            if (!sets.length || !isGeometrySource(src)) continue;
            for (const t of tilesUnderBox(this.tr, c.box, src.minzoom, src.maxzoom)) {
                jobs.push(this.backends[this.nextBackend++ % this.backends.length].query(tileURL(src, t.z, t.x, t.y), {
                    source: name, z: t.z, x: t.x, y: t.y, px: 0, py: 0, radius: 0, box: t.box, geometry: c.geometry,
                    sets: sets.map(s => ({layer: s.layer, sourceLayer: s.sourceLayer, filter: s.filter, also: s.also, radius: s.radius * t.scale})),
                }));
            }
        }
        // A feature with an id that is in two tiles is given one time.
        const seen = new Set<string>();
        return (await Promise.all(jobs)).flat().filter(f => {
            if (f.id === undefined) return true;
            const key = `${f.layer}|${f.source}|${f.sourceLayer}|${f.id}`;
            return seen.has(key) ? false : (seen.add(key), true);
        });
    }

    private async queryFeatures(c: Extract<Command, {type: 'query'}>): Promise<QueriedFeature[]> {
        const zoom = c.zoom ?? this.tr.zoom;
        const jobs = Object.entries(this.style.sources).filter(([name, src]) => isGeometrySource(src) && (!c.sources || c.sources.includes(name))).map(([name, src]) => {
            const z = clamp(Math.floor(zoom), src.minzoom, src.maxzoom), t = this.tileAt(c.lng, c.lat, z);
            // The tolerance is given in screen pixels at the queried zoom.
            const radius = c.radius * EXTENT / (512 * 2 ** (zoom - z));
            return this.backends[this.nextBackend++ % this.backends.length].query(tileURL(src, z, t.x, t.y), {
                source: name, z, x: t.x, y: t.y, px: t.u * EXTENT, py: t.v * EXTENT, radius,
                sourceLayers: c.sourceLayers, filter: c.filter, geometry: c.geometry,
            });
        });
        return (await Promise.all(jobs)).flat();
    }

    private async queryElevation(c: Extract<Command, {type: 'elevation'}>): Promise<number | null> {
        const entry = Object.entries(this.style.sources).find(([name, src]) => src.type === 'raster-dem' && (!c.source || c.source === name));
        if (!entry) throw new Error('No elevation (raster-dem) source in the style');
        const src = entry[1], z = clamp(Math.floor(c.zoom ?? src.maxzoom), src.minzoom, src.maxzoom), t = this.tileAt(c.lng, c.lat, z);
        const url = tileURL(src, z, t.x, t.y);
        let pixels = this.dem.get(url);
        if (!pixels) {
            pixels = (async () => {
                const bytes = await fetchTile(url, this.fetchAs('Tile'));
                if (!bytes) return null;
                const image = await createImageBitmap(new Blob([bytes as BlobPart]), {premultiplyAlpha: 'none', colorSpaceConversion: 'none'});
                const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(image.width, image.height)
                    : Object.assign((globalThis as any).document.createElement('canvas'), {width: image.width, height: image.height});
                const ctx = canvas.getContext('2d', {willReadFrequently: true});
                ctx.drawImage(image, 0, 0);
                image.close();
                return ctx.getImageData(0, 0, canvas.width, canvas.height) as ImageData;
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
            const e = this.ease, t = Math.min(1, (now - e.start) / e.duration), k = defaultEasing(t);
            const v = e.from.map((f, i) => f + (e.to[i] - f) * k);
            tr.zoom = v[2];
            tr.padding = [v[5], v[6], v[7], v[8]];
            tr.set(undefined, undefined, v[3], v[4]);
            if (e.around && e.anchor) tr.setLocationAt(e.anchor[0], e.anchor[1], e.around[0], e.around[1]);
            else { tr.lng = lngFromMerc(v[0]); tr.lat = latFromMerc(v[1]); }
            if (t >= 1) this.ease = null;
        }
        const w = this.wheel;
        if (w && w.doneAt === undefined) {
            if (w.delta) {
                // Each batch of scrolling multiplies the scale by up to 2, saturating smoothly for big deltas.
                const rate = w.kind === 'wheel' && Math.abs(w.delta) > WHEEL_STEP ? WHEEL_RATE : TRACKPAD_RATE;
                let scale = 2 / (1 + Math.exp(-Math.abs(w.delta * rate)));
                if (w.delta < 0) scale = 1 / scale;
                w.target = clamp((w.target ?? tr.zoom) + Math.log2(scale), tr.minZoom, tr.maxZoom);
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
            tr.set(tr.unprojectFlat(tr.cx - f.dx * (k - f.done), tr.cy - f.dy * (k - f.done)));
            f.done = k;
            if (t >= 1) this.fling = null;
        }
        return !!(this.ease || (this.wheel && this.wheel.doneAt === undefined) || glide);
    }

    private dropTile(key: string, t: TileState) {
        if (t.state === 'loading') t.cancel();
        if (t.gl) this.renderer.destroyTile(t.gl);
        this.tiles.delete(key);
        this.tilesVersion++;
        if (t.range) { const k = key.slice(key.lastIndexOf('|') + 1); this.heights.delete(k); heightsChanged(this.heights); this.emit({type: 'heights', key: k}); }
    }

    private request(source: string, id: TileID, key: string) {
        const src = this.style.sources[source], url = tileURL(src, id.z, id.x, id.y);
        // Contour lines are made from elevation data, which is much work. While the zoom changes, each step would start
        // tiles that are out of date a moment later, and slow devices cannot keep up. The lines of the last zoom stay
        // on the map (they are scaled) until the zoom has been still for a moment.
        if (src.contour && this.frameTime - this.zoomMovedAt < CONTOUR_WAIT) { this.contourWait = true; return; }
        const t: TileState = {state: 'loading', used: this.frameNo, cancel() {}};
        this.tiles.set(key, t);
        t.rev = ++this.tilesVersion;
        let load: Promise<GLTile>;
        if (isGeometrySource(src)) {
            const backend = this.backends[this.nextBackend++ % this.backends.length], req = this.nextReq++;
            t.cancel = () => backend.cancel(req);
            load = backend.load({id: req, source, url, z: id.z, overscaled: id.z >= src.maxzoom}).then(tile => this.upload(tile));
        } else {
            // Elevation tiles are decoded in a tile worker, which also reads the heights that 3D terrain needs: this thread
            // only sends the finished pixels to the GPU. (Reading pixels back here made the map hitch as tiles arrived.)
            if (src.type === 'raster-dem') {
                const backend = this.backends[this.nextBackend++ % this.backends.length], req = this.nextReq++, encoding = src.encoding ?? 'mapbox';
                t.cancel = () => backend.cancel(req);
                load = backend.loadElevation({id: req, url, encoding}).then(dem => !dem ? {labels: {}, batches: {}} : this.paced(dem.pixels.length * 2, () => {
                    if (this.tiles.get(key) !== t) return {labels: {}, batches: {}};
                    if (this.style.terrain?.source === source) {
                        t.range = [dem.lo, dem.hi];
                        this.heights.set(id.key, dem.grid);
                        heightsChanged(this.heights);
                        // Only the ground under and beside this tile gets new mesh heights (see terrainTiles).
                        this.demArrivals.push({version: this.demVersion + 1, x0: id.x / 2 ** id.z, y0: id.y / 2 ** id.z, x1: (id.x + 1) / 2 ** id.z, y1: (id.y + 1) / 2 ** id.z});
                        if (this.demArrivals.length > 48) this.demArrivals.shift();
                        this.emit({type: 'heights', key: id.key, grid: dem.grid});
                        this.demVersion++;
                    }
                    return this.renderer.createImageTile({width: dem.width, height: dem.height, data: dem.pixels}, encoding, id);
                }));
            } else {
                // Image tiles need no parsing, so the engine fetches and decodes them itself.
                const ac = new AbortController();
                t.cancel = () => ac.abort();
                load = fetchTile(url, this.fetchAs('Tile'), ac.signal).then(async bytes => {
                    if (!bytes) return {labels: {}, batches: {}};
                    const image = await createImageBitmap(new Blob([bytes as BlobPart]));
                    if (this.tiles.get(key) !== t) { image.close(); return {labels: {}, batches: {}}; }
                    const tile = this.renderer.createImageTile(image, undefined, id);
                    image.close();
                    return tile;
                });
            }
        }
        load.then(gl => {
            if (this.tiles.get(key) !== t) return;
            t.gl = gl;
            t.state = 'ok';
            t.rev = ++this.tilesVersion;
            this.invalidate();
        }, err => {
            if (this.tiles.get(key) !== t) return;
            t.state = 'error';
            t.rev = ++this.tilesVersion;
            if (err.message !== 'aborted' && err.name !== 'AbortError') this.emit({type: 'error', message: err.message});
            this.repaint();
        });
    }

    /** Builds a tile again from changed data and swaps it in when ready; the old one stays on screen meanwhile. */
    private rebuild(source: string, id: TileID, key: string, t: TileState) {
        const src = this.style.sources[source], backend = this.backends[this.nextBackend++ % this.backends.length], req = this.nextReq++;
        t.rebuilding = true; // one rebuild at a time per tile; data that changes meanwhile marks it stale again
        backend.load({id: req, source, url: tileURL(src, id.z, id.x, id.y), z: id.z, overscaled: id.z >= src.maxzoom}).then(tile => {
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
        if (!tr.width || !tr.height || this.lost) return;
        const dt = Math.min(100, now - this.lastTime || 16);
        this.lastTime = now;
        this.frameTime = began;
        if (tr.zoom !== this.zoomSeen) { if (!Number.isNaN(this.zoomSeen)) this.zoomMovedAt = began; this.zoomSeen = tr.zoom; }
        const cameraAnimating = this.animate(now), markersAnimating = this.animateMarkers(now), animating = cameraAnimating;
        this.flushUploads();

        const items = new Map<string, RenderItem<GLTile>[]>(), all: RenderItem<GLTile>[] = [];
        let complete = true;
        const wanted = new Set<string>();
        // 3D terrain: the camera follows the ground under the map centre, easing so that newly loaded heights do not jolt it.
        // Seen from straight above, relief changes nothing that matters, so the flat (sharper, cheaper) path is used; the
        // relief then grows in over the first ten degrees of tilt rather than popping.
        const tilt = clamp(tr.pitch / 10, 0, 1);
        this.exaggeration = (this.style.terrain?.exaggeration ?? 0) * tilt * tilt * (3 - 2 * tilt);
        const terrain = this.exaggeration > 0 ? this.style.terrain : undefined;
        const settling = false;
        if (terrain) {
            tr.heightAt = this.heightAt;
            // The centre's height is remembered in real metres, so it shrinks and grows together with the relief.
            tr.elevation = this.rawElevation * this.exaggeration;
            // The lowest and highest ground on the elevation tiles in use: valleys far below the centre (or peaks far
            // above it) reach further across the screen than flat ground would.
            let lo = tr.elevation, hi = tr.elevation;
            for (const [key, t] of this.tiles) {
                if (!t.range || t.used < frameNo - 2 || !key.startsWith(terrain.source + '|')) continue;
                lo = Math.min(lo, t.range[0] * this.exaggeration); hi = Math.max(hi, t.range[1] * this.exaggeration);
            }
            tr.groundRange = [lo, hi];
            // While the map is being moved the centre keeps its height: the camera goes where it is sent rather than
            // bobbing over every ridge. At rest the centre is put back on the ground the camera is looking at, with
            // the camera left exactly where it is, so nothing on screen moves when a gesture ends or heights arrive.
            const pose = `${tr.lng},${tr.lat},${tr.zoom}`;
            if (pose !== this.lastPose) { this.lastPose = pose; this.movedAt = now; }
            const moving = cameraAnimating || now - this.movedAt < 150;
            const known = (mx: number, my: number) => !!this.demTile(mx - Math.floor(mx), my, 30);
            const e = this.ease;
            if (e && !e.around) {
                // An animation to a stated place: the centre's height eases to the ground there along with everything else.
                if (this.easeHeights?.ease !== e) this.easeHeights = {ease: e, from: this.rawElevation};
                if (known(e.to[0], e.to[1])) {
                    const k = defaultEasing(clamp((now - e.start) / e.duration, 0, 1));
                    tr.elevation = (this.easeHeights.from + (this.rawHeightAt(e.to[0], e.to[1]) - this.easeHeights.from) * k) * this.exaggeration;
                }
            } else if (!moving) {
                if (this.centreGiven) {
                    // The centre was set outright (jumpTo, the end of an animation, terrain switched on): it stays where
                    // it was put and takes the height of the ground there, as soon as that is known.
                    if (known(mercX(tr.lng), mercY(tr.lat))) { tr.elevation = this.heightAt(mercX(tr.lng), mercY(tr.lat)); this.centreGiven = false; }
                } else if (tr.recenterOnGround()) this.lastPose = `${tr.lng},${tr.lat},${tr.zoom}`;
            }
            // Never inside the mountain: if the ground under the camera reaches it, the camera is lifted clear.
            const [camX, camY, camH] = tr.cameraPosition(), clear = this.heightAt(camX, camY) + (camH - tr.elevation) * 0.05;
            if (camH < clear) tr.elevation += clear - camH;
            this.rawElevation = tr.elevation / this.exaggeration;
        } else {
            tr.heightAt = undefined; tr.groundRange = undefined; tr.elevation = 0;
            const st = this.style.terrain, src = st && this.style.sources[st.source];
            if (src) {
                // Looking straight down the relief is not drawn, but the height under the centre is still tracked (it
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
        if (terrain && now - this.markerHeightsAt > 300) {
            // Markers stand on the ground: look up the height under each when its layer or the elevation data changes.
            for (const m of this.markers.values()) {
                if (!m.gpu || (m.heightsFor === m.gpu && m.heightsVersion === this.demVersion)) continue;
                const metres = new Float32Array(m.gpu.count);
                for (let i = 0; i < metres.length; i++) metres[i] = this.rawHeightAt(m.merc[i * 2], m.merc[i * 2 + 1]);
                this.renderer.setMarkerHeights(m.gpu, metres);
                m.heightsFor = m.gpu; m.heightsVersion = this.demVersion;
                this.markerHeightsAt = now;
            }
        }
        for (const source in this.style.sources) {
            // Skip sources nothing visible draws from at this zoom (e.g. low-zoom relief imagery when zoomed in). With 3D
            // terrain, the flat layers are drawn into the ground textures, which ask for their own tiles (see groundSources):
            // only labels and buildings are drawn from the tiles of the view. (Without this, the elevation tiles for relief
            // shading were loaded two times, at two sets of zoom levels.)
            if (!this.layers.some(l => l.source === source && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom && (!terrain || l.type === 'symbol' || l.type === 'fill-extrusion'))) continue;
            const src = this.style.sources[source];
            if (src.type === 'image') { items.set(source, this.pictureItems(source, tr)); continue; }
            const ideal = tr.coveringTiles(src.minzoom, src.maxzoom, src.tileSize, src.type === 'raster' || src.type === 'raster-dem');
            for (const id of ideal) {
                const key = source + '|' + id.key;
                wanted.add(key);
                const t = this.tiles.get(key);
                if (!t) this.request(source, id, key);
                else if (t.stale && t.state === 'ok' && !t.rebuilding) { t.stale = false; this.rebuild(source, id, key, t); }
                if (!t || t.state === 'loading') complete = false;
            }
            // Keep a coarse overview of the same area loaded as well. It costs a tile or two and means fast pans
            // and zoom-outs land on blurry map rather than on nothing.
            const dz = Math.min(3, ideal.length ? ideal[0].z - src.minzoom : 0);
            if (dz > 0) {
                for (const id of ideal) {
                    const z = id.z - dz, k = `${z}/${id.x >> dz}/${id.y >> dz}`, key = source + '|' + k;
                    if (wanted.has(key)) continue;
                    wanted.add(key);
                    const t = this.tiles.get(key);
                    const oid = {z, x: id.x >> dz, y: id.y >> dz, w: id.w, key: k};
                    if (!t) this.request(source, oid, key);
                    else {
                        t.used = frameNo;
                        // Keep the overview current too, or it would flash old data when it stands in for a missing tile.
                        if (t.stale && t.state === 'ok' && !t.rebuilding) { t.stale = false; this.rebuild(source, oid, key, t); }
                    }
                }
            }
            const list = renderItems(tr, ideal, k => {
                const t = this.tiles.get(source + '|' + k);
                if (t?.state !== 'ok') return undefined;
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
        for (const [key, t] of this.tiles) {
            if (t.state === 'loading' && !wanted.has(key)) this.dropTile(key, t);
        }
        // How many tiles are kept follows what the view needs: three times that many, so that the view can go back and
        // forth without new downloads. A small screen keeps fewer tiles, and so uses less memory on the GPU.
        const keep = clamp(wanted.size * 3 + 16, 48, MAX_TILES);
        if (this.tiles.size > keep) {
            const old = [...this.tiles].filter(([, t]) => t.used !== frameNo && t.state !== 'loading').sort((a, b) => a[1].used - b[1].used);
            for (const [key, t] of old.slice(0, this.tiles.size - keep)) this.dropTile(key, t);
        }

        const camera = `${tr.padding},${tr.lng},${tr.lat},${tr.zoom},${tr.bearing},${tr.pitch},${Math.round(tr.elevation)},${this.exaggeration}`, cameraChanged = camera !== this.lastCamera;
        if (cameraChanged) { this.placeDirty = true; this.cameraMovedAt = began; }

        // Decide which labels show only every so often; in between they ride along with the map and fade.
        const zooming = Math.abs(tr.zoom - this.placeZoom) > 0.12;
        const place = this.placeDirty && now - this.lastPlace >= (zooming ? ZOOMING_PLACE_INTERVAL : PLACE_INTERVAL);
        if (place) this.fade = zooming ? ZOOMING_FADE : FADE;
        const grid = place ? new CollisionGrid() : null;
        if (grid) this.reserve(grid);
        if (place) {
            this.placeDirty = false;
            this.lastPlace = now;
            this.placeZoom = tr.zoom;
            this.placeAngle = -tr.bearing * Math.PI / 180;
            const keep = new Set<string>(), resets = this.atlas.resets;
            let placed = placeLabels(tr, all, this.layers, this.atlas, grid!, this.icon);
            if (this.atlas.resets !== resets) {
                // The glyph atlas filled up and was emptied part-way through: earlier labels now point at stale
                // glyphs. Place again; the fresh atlas only has to hold this view's text.
                const again = new CollisionGrid();
                this.reserve(again);
                placed = placeLabels(tr, all, this.layers, this.atlas, again, this.icon);
            }
            for (const p of placed) {
                keep.add(p.key);
                const st = this.labels.get(p.key);
                if (st) { st.placed = p; st.target = 1; } else this.labels.set(p.key, {placed: p, opacity: 0, target: 1});
            }
            for (const [key, st] of this.labels) if (!keep.has(key)) st.target = 0;
        }
        const labels: Placed[] = [];
        let fading = false;
        const turn = -tr.bearing * Math.PI / 180 - this.placeAngle, tc = Math.cos(turn), ts = Math.sin(turn);
        for (const [key, st] of this.labels) {
            if (st.opacity !== st.target) {
                st.opacity = st.target ? Math.min(1, st.opacity + dt / this.fade) : Math.max(0, st.opacity - dt / this.fade);
                fading ||= st.opacity !== st.target;
            }
            if (!st.opacity && !st.target) { this.labels.delete(key); continue; }
            const p = st.placed, [ax, ay] = tr.projectTile(p.tile, p.src.x, p.src.y), dx = ax - p.ax, dy = ay - p.ay;
            if (turn && (!p.src.upright || (!p.shaped && p.icon && !p.src.icon!.upright))) {
                // Text along a line (and a symbol at a point that is aligned with the map) turns with the map between placements; otherwise it would hold its old angle and
                // then snap, which reads as rocking while the map rotates.
                const ox = p.x - p.ax, oy = p.y - p.ay;
                let curve = p.curve, ground = p.ground;
                if (curve) {
                    curve = curve.slice();
                    for (let i = 0; i < curve.length; i += 3) { const cx = curve[i], cy = curve[i + 1]; curve[i] = cx * tc - cy * ts; curve[i + 1] = cx * ts + cy * tc; curve[i + 2] += turn; }
                }
                if (ground) {
                    ground = ground.slice();
                    for (let i = 0; i < ground.length; i += 3) { const cx = ground[i + 1], cy = ground[i + 2]; ground[i + 1] = cx * tc - cy * ts; ground[i + 2] = cx * ts + cy * tc; }
                }
                labels.push({...p, x: ax + ox * tc - oy * ts, y: ay + ox * ts + oy * tc, angle: p.angle + turn, curve, ground, opacity: st.opacity,
                    icon: p.icon && {...p.icon, x: ax + (p.icon.x - p.ax) * tc - (p.icon.y - p.ay) * ts, y: ay + (p.icon.x - p.ax) * ts + (p.icon.y - p.ay) * tc, angle: p.icon.angle + turn}});
                continue;
            }
            labels.push({...p, x: p.x + dx, y: p.y + dy, icon: p.icon && {...p.icon, x: p.icon.x + dx, y: p.icon.y + dy}, opacity: st.opacity});
        }
        const markers: MarkerBuffers[] = [];
        for (const m of this.markers.values()) {
            if (!m.gpu?.count) continue;
            // Fade over the last fifth of a zoom level at either end of the layer's range, so paired layers cross-fade.
            m.gpu.opacity = Math.max(0, Math.min(1, (tr.zoom - m.minZoom) / 0.2 + 1, (m.maxZoom - tr.zoom) / 0.2));
            if (m.gpu.opacity > 0) markers.push(m.gpu);
        }
        // 3D terrain that has just been switched on, or a camera just sent somewhere new: until the height of the ground
        // at the centre is known the camera cannot be placed, and drawing from sea level would show the wrong view and
        // then jump. Keep what is on screen for a moment instead (but not for long, in case the data never comes).
        const unplaced = !!terrain && this.centreGiven && !this.demTile(mercX(tr.lng) - Math.floor(mercX(tr.lng)), mercY(tr.lat), 30);
        if (!unplaced) this.unplacedSince = 0; else if (!this.unplacedSince) this.unplacedSince = now;
        const hold = unplaced && now - this.unplacedSince < 3000;
        const behind = hold || this.renderer.render({tr, layers: this.layers, items, labels, atlas: this.atlas, markers, icon: this.icon, light: this.style.light, moving: began - this.cameraMovedAt < 200,
            // (Past the time limit and still unplaced: draw flat rather than raise terrain around a camera in the wrong place.)
            terrain: ground && !unplaced ? {exaggeration: this.exaggeration, tiles: ground, dem: this.demRef} : undefined});

        if (cameraChanged || animating !== this.moving) {
            this.lastCamera = camera;
            this.moving = animating;
            this.emit({type: 'camera', lng: tr.lng, lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch, elevation: tr.elevation, exaggeration: this.exaggeration, groundRange: tr.groundRange, padding: tr.padding, moving: animating});
        }
        const busy = animating || markersAnimating || fading || this.placeDirty || settling || behind || this.meshBehind;
        const idle = complete && !busy && !this.spritePending && !this.contourWait;
        if (this.contourWait) { this.contourWait = false; setTimeout(() => this.repaint(), CONTOUR_WAIT + 20); }
        if (this.reportFrames) this.emit({type: 'frame'});
        if (idle && !this.wasIdle) this.emit({type: 'idle'});
        this.wasIdle = idle;
        if (busy) this.repaint();
        const st = this.stats, end = performance.now();
        st.frames++; st.cpu += end - began;
        if (!st.since) st.since = began;
        else if (end - st.since >= 1000) {
            this.emit({type: 'stats', fps: st.frames / ((end - st.since) / 1000), frameMs: st.cpu / st.frames});
            this.stats = {since: end, frames: 0, cpu: 0};
        }
        // After a pause the next burst of frames starts a fresh measurement instead of averaging in the idle time.
        if (!busy) this.stats.since = 0;
    }

    /** Uploads a marker layer to the GPU. Markers whose image is not ready yet get a scale of zero (hidden). */
    private uploadMarkers(id: string, m: MarkerLayer) {
        const n = m.variant.length, data = m.data = new Float32Array(n * MARKER_FLOATS);
        for (let i = 0; i < n; i++) {
            const rect = this.spriteRects.get(m.variant[i]), x = m.merc[i * 2], y = m.merc[i * 2 + 1], xh = Math.fround(x), yh = Math.fround(y);
            for (let k = 0; k < 4; k++) {
                const o = i * MARKER_FLOATS + k * MARKER_STRIDE;
                data[o] = xh; data[o + 1] = x - xh; data[o + 2] = yh; data[o + 3] = y - yh;
                if (rect) data.set(rect, o + 4);
                data[o + 8] = k & 1; data[o + 9] = k >> 1;
                data[o + 10] = rect ? m.scale?.[i] ?? 1 : 0;
                data[o + 11] = 1;
            }
        }
        m.gpu = this.renderer.setMarkers(m.gpu, data, n, m.width, m.height, m.offset);
    }

    /** Sets one per-marker value (10 = scale, 11 = opacity) on all four of a marker's vertices. */
    private setMarkerValue(m: MarkerLayer, i: number, field: 10 | 11, value: number) {
        for (let k = 0; k < 4; k++) m.data![i * MARKER_FLOATS + k * MARKER_STRIDE + field] = value;
    }

    /** Advances marker size animations; returns true while any is running. */
    private animateMarkers(now: number): boolean {
        for (const [key, a] of this.markerAnims) {
            const m = this.markers.get(a.layer);
            if (!m?.gpu || !m.data || a.index >= m.variant.length) { this.markerAnims.delete(key); continue; }
            const t = Math.min(1, (now - a.start) / a.duration), scale = a.from + (a.to - a.from) * inertiaEasing(t), o = a.index * MARKER_FLOATS;
            (m.scale ??= new Float32Array(m.variant.length).fill(1))[a.index] = scale;
            if (this.spriteRects.has(m.variant[a.index])) this.setMarkerValue(m, a.index, 10, scale);
            this.renderer.updateMarker(m.gpu, a.index, m.data.subarray(o, o + MARKER_FLOATS));
            if (m.collide) this.placeDirty = true;
            if (t >= 1) this.markerAnims.delete(key);
        }
        return this.markerAnims.size > 0;
    }

    /** Reserves space in the label collision grid for markers that labels should avoid, and for registered obstacles. */
    private reserve(grid: CollisionGrid) {
        const tr = this.tr;
        const zoom = tr.zoom;
        for (const m of this.markers.values()) {
            if (zoom < m.minZoom || zoom >= m.maxZoom) continue;
            if (m.hideOverlaps && m.gpu && m.data) {
                // Markers compete for space among themselves, first come first served, exactly as labels do.
                const own = new CollisionGrid();
                const changed: number[] = [];
                for (let i = 0; i < m.variant.length; i++) {
                    const s = m.scale?.[i] ?? 1, mx = m.merc[i * 2] + Math.round(mercX(tr.lng) - m.merc[i * 2]), [x, y] = tr.mercToScreen(mx, m.merc[i * 2 + 1]);
                    const x0 = x + m.offset[0] * s, y0 = y + m.offset[1] * s, x1 = x0 + m.width * s, y1 = y0 + m.height * s;
                    let show = 1;
                    const was = m.data[i * MARKER_FLOATS + 11];
                    if (x0 > tr.width || y0 > tr.height || x1 < 0 || y1 < 0) show = was; // off screen: leave as it was
                    else if (own.hits(x0, y0, x1, y1)) show = 0;
                    else { own.insert(x0, y0, x1, y1); if (m.collide) grid.insert(x0, y0, x1, y1); }
                    if (was !== show) { this.setMarkerValue(m, i, 11, show); changed.push(i); }
                }
                // Send only what changed: a few markers one by one, or else the part of the buffer that holds them all.
                // (The whole buffer of a large layer is some megabytes, and this runs each time labels are placed.)
                if (changed.length && changed.length <= 64) for (const i of changed) this.renderer.updateMarker(m.gpu, i, m.data.subarray(i * MARKER_FLOATS, (i + 1) * MARKER_FLOATS));
                else if (changed.length) {
                    const first = changed[0], last = changed[changed.length - 1];
                    this.renderer.updateMarker(m.gpu, first, m.data.subarray(first * MARKER_FLOATS, (last + 1) * MARKER_FLOATS));
                }
                continue;
            }
            if (!m.collide) continue;
            for (let i = 0; i < m.variant.length; i++) {
                const s = m.scale?.[i] ?? 1, mx = m.merc[i * 2] + Math.round(mercX(tr.lng) - m.merc[i * 2]), [x, y] = tr.mercToScreen(mx, m.merc[i * 2 + 1]);
                const x0 = x + m.offset[0] * s, y0 = y + m.offset[1] * s;
                if (x0 > tr.width || y0 > tr.height || x0 + m.width * s < 0 || y0 + m.height * s < 0) continue;
                grid.insert(x0, y0, x0 + m.width * s, y0 + m.height * s);
            }
        }
        for (const o of this.obstacles.values()) {
            const [x, y] = tr.mercToScreen(o.merc[0] + Math.round(mercX(tr.lng) - o.merc[0]), o.merc[1]);
            grid.insert(x + o.box[0], y + o.box[1], x + o.box[2], y + o.box[3]);
        }
    }
}
