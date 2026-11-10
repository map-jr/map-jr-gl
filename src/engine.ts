import {EXTENT, HEIGHT_GRID, TILE_SIZE, Transform, bezier, groundHeight, clamp, latFromMerc, lngFromMerc, mercX, mercY, type LngLatLike, type TileID} from './geo.ts';
import {setGlobalState} from './expr.ts';
import {compileLayer, isGeometrySource, loadSprite, tileURL, type CompiledLayer, type FontSource, type ResolvedStyle, type Sprite, type SpriteIcon} from './style.ts';
import {GLRenderer, MARKER_FLOATS, MARKER_STRIDE, SPRITE_ATLAS, type DemRef, type GLTile, type MarkerBuffers, type TerrainTile} from './gl.ts';
import {CollisionGrid, placeLabels, renderItems, type Placed, type RenderItem} from './placement.ts';
import {GlyphAtlas} from './text.ts';
import {decodeElevation, sampleElevation, type QueriedFeature} from './query.ts';
import type {TileBackend} from './tiles.ts';
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
    | {type: 'image'; name: string; w: number; h: number; width: number; height: number; data: Uint8Array; stretchX?: [number, number][]; stretchY?: [number, number][]; content?: [number, number, number, number]}
    | {type: 'removeImage'; name: string}
    | {type: 'geojson'; source: string; data: unknown}
    /** Replaces the feature state of one source ("sourceLayer|id" -> state); its tiles are rebuilt in place. */
    | {type: 'featureState'; source: string; states: Record<string, Record<string, unknown>>}
    | ({type: 'query'; id: number; lng: number; lat: number} & FeatureQuery)
    | {type: 'elevation'; id: number; lng: number; lat: number; source?: string; zoom?: number}
    | {type: 'repaint'};
export type EngineEvent =
    | {type: 'camera'; lng: number; lat: number; zoom: number; bearing: number; pitch: number; /** Ground height at the centre with 3D terrain, else 0. */ elevation: number; exaggeration: number; groundRange?: [number, number]; padding: [number, number, number, number]; moving: boolean}
    | {type: 'idle'}
    /** 3D terrain: the height grid of an elevation tile that has loaded (or, without `grid`, been dropped). */
    | {type: 'heights'; key: string; grid?: Float32Array}
    /** About once a second while drawing: frames drawn per second and the engine's average CPU time per frame. */
    | {type: 'stats'; fps: number; frameMs: number}
    /** A frame at a new canvas size has been drawn. */
    | {type: 'resized'; width: number; height: number; dpr: number}
    | {type: 'result'; id: number; value?: unknown; error?: string}
    | {type: 'imagemissing'; name: string}
    | {type: 'error'; message: string};

/** Heights are kept on the CPU at this resolution per elevation tile: plenty for placing labels and the camera. */
function sampleHeights(image: ImageBitmap, encoding: string): Float32Array {
    const ctx = new OffscreenCanvas(HEIGHT_GRID, HEIGHT_GRID).getContext('2d', {willReadFrequently: true})!;
    ctx.imageSmoothingEnabled = false; // heights are encoded in the colour channels, so pixels must not be blended
    ctx.drawImage(image, 0, 0, HEIGHT_GRID, HEIGHT_GRID);
    const px = ctx.getImageData(0, 0, HEIGHT_GRID, HEIGHT_GRID).data, out = new Float32Array(HEIGHT_GRID * HEIGHT_GRID);
    for (let i = 0; i < out.length; i++) out[i] = decodeElevation(px, i * 4, encoding);
    return out;
}

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

interface TileState { state: 'loading' | 'ok' | 'error'; gl?: GLTile; /** Elevation tiles shaping 3D terrain: the lowest and highest ground on the tile, in metres. */ range?: [number, number]; used: number; cancel(): void; /** Shown, but built from data that has since changed. */ stale?: boolean; rebuilding?: boolean }
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
        this.atlas = new GlyphAtlas(o.fontFamily);
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

    /** The heights under a tile, for the GPU. */
    private demRef = (id: TileID): DemRef | null => {
        const n = 2 ** id.z, found = this.demTile((id.x + 0.5) / n, (id.y + 0.5) / n, id.z);
        if (!found) return null;
        const k = 2 ** (id.z - found.z), gl = found.t.gl!;
        return {tex: gl.raw!, rect: [(id.x % k) / k, (id.y % k) / k, 1 / k, gl.rawSize!], unpack: gl.unpack!};
    };

    /** 3D terrain: the ground tiles in view, each with a straight-down view of itself for drawing its picture. */
    private terrainTiles(wanted: Set<string>): TerrainTile[] {
        const tr = this.tr, terrain = this.style.terrain!, demSrc = this.style.sources[terrain.source], out: TerrainTile[] = [];
        const viewLit = this.layers.some(l => l.type === 'hillshade' && l.visible && l.p.anchor.eval(tr.zoom) === 'viewport');
        for (const id of tr.coveringTiles(0, 22, TILE_SIZE).slice(0, 96)) { // nearest first; a cap keeps odd views affordable
            // Each tile's picture is drawn once, at a fixed scale a little above the tile's own (it is shown at up to twice
            // its size before finer tiles take over), and stretched as the map zooms. Zooming therefore redraws nothing.
            const n = 2 ** id.z, view = new Transform(), zt = id.z + 0.75;
            view.width = view.height = TILE_SIZE * 2 ** (zt - id.z);
            view.lng = lngFromMerc((id.x + 0.5) / n); view.lat = latFromMerc((id.y + 0.5) / n); view.zoom = zt;
            const items = new Map<string, RenderItem<GLTile>[]>();
            // Relief shading lit from the viewer's side turns with the map, so pictures containing it are redrawn when the map has turned a dozen degrees.
            let complete = true;
            let signature = `${zt}|${this.styleVersion}|${viewLit ? Math.round(tr.bearing / 12) : ''}`;
            for (const source in this.style.sources) {
                const src = this.style.sources[source];
                if (!this.layers.some(l => l.source === source && l.type !== 'symbol' && l.type !== 'fill-extrusion' && l.visible && zt >= l.minzoom && zt < l.maxzoom)) continue;
                const ideal = view.coveringTiles(src.minzoom, src.maxzoom, src.tileSize, src.type === 'raster' || src.type === 'raster-dem');
                for (const t of ideal) { const key = source + '|' + t.key; wanted.add(key); if (!this.tiles.has(key)) this.request(source, t, key); if (this.tiles.get(key)?.state === 'loading') complete = false; }
                const list = renderItems(view, ideal, k => {
                    const t = this.tiles.get(source + '|' + k);
                    if (t?.state !== 'ok') return undefined;
                    t.used = this.frameNo;
                    return t.gl;
                });
                items.set(source, list);
                // The picture depends on exactly these tiles (and which build of each), so that is what identifies it.
                for (const it of list) signature += `,${it.id.key}:${it.tile.uid}`;
            }
            // The heights themselves: make sure the elevation tile for this ground tile is on its way.
            const dz = Math.min(id.z, demSrc.maxzoom), k = 2 ** (id.z - dz), dk = `${dz}/${Math.floor(id.x / k)}/${Math.floor(id.y / k)}`, demKey = terrain.source + '|' + dk;
            if (dz >= demSrc.minzoom) {
                wanted.add(demKey);
                const t = this.tiles.get(demKey);
                if (t) t.used = this.frameNo; else this.request(terrain.source, {z: dz, x: Math.floor(id.x / k), y: Math.floor(id.y / k), w: 0, key: dk}, demKey);
            }
            out.push({id, key: `${id.key}|${id.w}`, matrix: tr.tileMatrix4(id), view, items, signature, complete, dem: this.demRef(id)});
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
            this.loadIcons(style.sprite).catch(err => this.emit({type: 'error', message: String(err.message)}));
        }
        const faces = JSON.stringify(style.fonts ?? []);
        if (style.fonts?.length && faces !== this.styleFonts) { this.styleFonts = faces; this.loadFonts(style.fonts); }
        if (reload) {
            for (const [name, src] of Object.entries(style.sources)) if (src.type === 'geojson') for (const b of this.backends) b.setGeoJSON(name, src.data);
            const contours = Object.fromEntries(Object.entries(style.sources).filter(([, s]) => s.contour).map(([name, s]) => [name, s.contour!]));
            for (const b of this.backends) b.setContours(contours);
            for (const b of this.backends) b.setStyle(style.layers, style.state);
            // Only tiles whose contents the change can affect are touched. A changed source starts over; changed
            // layers rebuild their source's tiles in place, so the old ones stay on screen until the new are ready.
            const sigs = new Map(Object.keys(style.sources).map(name => [name, sourceSignature(style, name)]));
            for (const [key, t] of this.tiles) {
                const name = key.slice(0, key.lastIndexOf('|')), was = this.sourceSigs.get(name), now = sigs.get(name);
                if (!was || !now || was[0] !== now[0]) this.dropTile(key, t);
                else if (was[1] !== now[1]) t.stale = true;
            }
            this.sourceSigs = sigs;
        }
        this.invalidate();
    }

    private async loadIcons(url: string) {
        const sprite = await loadSprite(url, this.dpr > 1);
        const res = await fetch(sprite.image);
        if (!res.ok) throw new Error(`Failed to load sprite image ${sprite.image}: ${res.status}`);
        const image = await createImageBitmap(await res.blob());
        if (url !== this.spriteUrl) return;
        this.renderer.setIcons(image, image.width, image.height);
        this.sprite = sprite;
        this.styleVersion++;
        this.invalidate();
    }

    /** Loads web fonts into whichever thread the engine runs on, then redraws all text with them. */
    private loadFonts(fonts: FontSource[]) {
        const set = (globalThis as any).fonts ?? (globalThis as any).document?.fonts;
        Promise.all(fonts.map(async f => {
            const face = new FontFace(f.family, `url("${f.src}")`, {weight: String(f.weight ?? '400'), style: f.style ?? 'normal', ...(f.unicodeRange ? {unicodeRange: f.unicodeRange} : {})});
            set.add(await face.load());
        })).then(() => { this.atlas.clear(true); this.relabel(); },
            err => this.emit({type: 'error', message: `Could not load font: ${err.message}`}));
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
                if (!dist || c.ms <= 0) break;
                const speed = Math.min(1400, dist * linearity / (c.ms / 1000)), seconds = speed / (2500 * linearity), amount = speed * seconds / 2;
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
                if (rect) this.images.set(c.name, {x: rect[0], y: rect[1], width: c.w, height: c.h, pixelRatio: c.w / c.width, custom: true, stretchX: c.stretchX, stretchY: c.stretchY, content: c.content});
                this.styleVersion++;
                this.placeDirty = true;
                break;
            }
            case 'removeImage': this.images.delete(c.name); this.placeDirty = true; break;
            case 'geojson': {
                // New data for one source: keep drawing its current tiles and rebuild them in place, so nothing blinks.
                if (this.style.sources[c.source]) this.style.sources[c.source].data = c.data;
                for (const b of this.backends) b.setGeoJSON(c.source, c.data);
                for (const [key, t] of this.tiles) {
                    if (!key.startsWith(c.source + '|')) continue;
                    // Tiles on screen or still loading are rebuilt in place once they can be; cancelling loads here
                    // would starve a map that is being moved while its data updates.
                    if (t.state === 'loading' || t.used >= this.frameNo - 1) t.stale = true; else this.dropTile(key, t);
                }
                break;
            }
            case 'featureState':
                for (const b of this.backends) b.setFeatureState(c.source, c.states);
                for (const [key, t] of this.tiles) if (key.startsWith(c.source + '|')) t.stale = true;
                break;
            case 'query':
                this.queryFeatures(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                return;
            case 'elevation':
                this.queryElevation(c).then(value => this.emit({type: 'result', id: c.id, value}), err => this.emit({type: 'result', id: c.id, error: String(err.message)}));
                return;
            case 'repaint': break;
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
                const bytes = await fetchTile(url);
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
        if (this.fling) {
            const f = this.fling, t = Math.min(1, (now - f.start) / f.duration), k = inertiaEasing(t);
            tr.set(tr.unprojectFlat(tr.cx - f.dx * (k - f.done), tr.cy - f.dy * (k - f.done)));
            f.done = k;
            if (t >= 1) this.fling = null;
        }
        return !!(this.ease || (this.wheel && this.wheel.doneAt === undefined) || this.fling);
    }

    private dropTile(key: string, t: TileState) {
        if (t.state === 'loading') t.cancel();
        if (t.gl) this.renderer.destroyTile(t.gl);
        this.tiles.delete(key);
        if (t.range) { const k = key.slice(key.lastIndexOf('|') + 1); this.heights.delete(k); this.emit({type: 'heights', key: k}); }
    }

    private request(source: string, id: TileID, key: string) {
        const src = this.style.sources[source], url = tileURL(src, id.z, id.x, id.y);
        const t: TileState = {state: 'loading', used: this.frameNo, cancel() {}};
        this.tiles.set(key, t);
        let load: Promise<GLTile>;
        if (isGeometrySource(src)) {
            const backend = this.backends[this.nextBackend++ % this.backends.length], req = this.nextReq++;
            t.cancel = () => backend.cancel(req);
            load = backend.load({id: req, source, url, z: id.z, overscaled: id.z >= src.maxzoom}).then(tile => this.renderer.createTile(tile));
        } else {
            // Image tiles need no parsing, so the engine fetches and decodes them itself.
            const ac = new AbortController(), dem = src.type === 'raster-dem';
            t.cancel = () => ac.abort();
            load = fetchTile(url, undefined, ac.signal).then(async bytes => {
                if (!bytes) return {labels: {}, batches: {}};
                const image = await createImageBitmap(new Blob([bytes as BlobPart]), dem ? {premultiplyAlpha: 'none', colorSpaceConversion: 'none'} : {});
                if (this.tiles.get(key) !== t) { image.close(); return {labels: {}, batches: {}}; }
                const tile = this.renderer.createImageTile(image, dem ? src.encoding ?? 'mapbox' : undefined, id);
                if (dem && this.style.terrain?.source === source) {
                    const grid = sampleHeights(image, src.encoding ?? 'mapbox');
                    let lo = Infinity, hi = -Infinity;
                    for (const h of grid) { if (h < lo) lo = h; if (h > hi) hi = h; }
                    t.range = [lo, hi];
                    this.heights.set(id.key, grid);
                    this.emit({type: 'heights', key: id.key, grid});
                    this.demVersion++;
                }
                image.close();
                return tile;
            });
        }
        load.then(gl => {
            if (this.tiles.get(key) !== t) return;
            t.gl = gl;
            t.state = 'ok';
            this.invalidate();
        }, err => {
            if (this.tiles.get(key) !== t) return;
            t.state = 'error';
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
            if (old) this.renderer.destroyTile(old);
            this.invalidate();
        }, err => { t.rebuilding = false; this.emit({type: 'error', message: err.message}); });
    }

    private stats = {since: 0, frames: 0, cpu: 0};

    private frame(now: number) {
        const tr = this.tr, frameNo = ++this.frameNo, began = performance.now();
        if (!tr.width || !tr.height) return;
        const dt = Math.min(100, now - this.lastTime || 16);
        this.lastTime = now;
        const cameraAnimating = this.animate(now), markersAnimating = this.animateMarkers(now), animating = cameraAnimating;

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
            // Skip sources nothing visible draws from at this zoom (e.g. low-zoom relief imagery when zoomed in).
            if (!this.layers.some(l => l.source === source && l.visible && tr.zoom >= l.minzoom && tr.zoom < l.maxzoom)) continue;
            const src = this.style.sources[source];
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
        if (this.tiles.size > MAX_TILES) {
            const old = [...this.tiles].filter(([, t]) => t.used !== frameNo && t.state !== 'loading').sort((a, b) => a[1].used - b[1].used);
            for (const [key, t] of old.slice(0, this.tiles.size - MAX_TILES)) this.dropTile(key, t);
        }

        const camera = `${tr.padding},${tr.lng},${tr.lat},${tr.zoom},${tr.bearing},${tr.pitch},${Math.round(tr.elevation)},${this.exaggeration}`, cameraChanged = camera !== this.lastCamera;
        if (cameraChanged) this.placeDirty = true;

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
            if (turn && p.src.angle !== null && !p.src.upright) {
                // Text along a line turns with the map between placements; otherwise it would hold its old angle and
                // then snap, which reads as rocking while the map rotates.
                const ox = p.x - p.ax, oy = p.y - p.ay;
                let curve = p.curve;
                if (curve) {
                    curve = curve.slice();
                    for (let i = 0; i < curve.length; i += 3) { const cx = curve[i], cy = curve[i + 1]; curve[i] = cx * tc - cy * ts; curve[i + 1] = cx * ts + cy * tc; curve[i + 2] += turn; }
                }
                labels.push({...p, x: ax + ox * tc - oy * ts, y: ay + ox * ts + oy * tc, angle: p.angle + turn, curve, opacity: st.opacity,
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
        const behind = hold || this.renderer.render({tr, layers: this.layers, items, labels, atlas: this.atlas, markers, icon: this.icon,
            // (Past the time limit and still unplaced: draw flat rather than raise terrain around a camera in the wrong place.)
            terrain: ground && !unplaced ? {exaggeration: this.exaggeration, tiles: ground, dem: this.demRef} : undefined});

        if (cameraChanged || animating !== this.moving) {
            this.lastCamera = camera;
            this.moving = animating;
            this.emit({type: 'camera', lng: tr.lng, lat: tr.lat, zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch, elevation: tr.elevation, exaggeration: this.exaggeration, groundRange: tr.groundRange, padding: tr.padding, moving: animating});
        }
        const busy = animating || markersAnimating || fading || this.placeDirty || settling || behind;
        const idle = complete && !busy;
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
                let changed = false;
                for (let i = 0; i < m.variant.length; i++) {
                    const s = m.scale?.[i] ?? 1, mx = m.merc[i * 2] + Math.round(mercX(tr.lng) - m.merc[i * 2]), [x, y] = tr.mercToScreen(mx, m.merc[i * 2 + 1]);
                    const x0 = x + m.offset[0] * s, y0 = y + m.offset[1] * s, x1 = x0 + m.width * s, y1 = y0 + m.height * s;
                    let show = 1;
                    const was = m.data[i * MARKER_FLOATS + 11];
                    if (x0 > tr.width || y0 > tr.height || x1 < 0 || y1 < 0) show = was; // off screen: leave as it was
                    else if (own.hits(x0, y0, x1, y1)) show = 0;
                    else { own.insert(x0, y0, x1, y1); if (m.collide) grid.insert(x0, y0, x1, y1); }
                    if (was !== show) { this.setMarkerValue(m, i, 11, show); changed = true; }
                }
                if (changed) this.renderer.updateMarkers(m.gpu, m.data);
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
