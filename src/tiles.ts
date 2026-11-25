import {compileLayer, type CompiledLayer, type LayerJSON} from './style.ts';
import {compileFor, geo, warnOnce, type MapStates} from './expr.ts';
import {buildTile, packLabels, toGL, unpackLabels, type GlobeBuild, type GlobeCut, type TileGL, type TileIR} from './tile.ts';
import {decodeElevation, queryTile, type DemEncoding, type QueriedFeature, type TileQuery} from './query.ts';
import {HEIGHT_GRID} from './geo.ts';
import {fetchWith, withTimeout, type Ask, type RequestAnswer, type RequestRules} from './requests.ts';
import {fetchTile, heads, type TileFetchState} from './tile-fetch.ts';
import {GEOJSON_PREFIX, type GeoJSONOptions, type PreparedSource} from './geojson.ts';
import {decodeVectorTile} from './mvt.ts';
import type {ContourConfig, DEM} from './contour.ts';
import {decodePixels, type ImageDecoder} from './exact-pixels.ts';
import {part, type PartName, type Parts} from './parts.ts';

/**
 * Builds a tile, cut for the globe with the code of the part `subdivide`, which loads on demand. When the part does not
 * load, the tile is built without the cut, so that the globe still draws it, and `fault` carries the message, which the
 * map reports once (`oncePerPart`).
 */
async function finish(ir: TileIR, req: TileRequest) {
    let fault: string | undefined;
    const cut: GlobeCut | undefined = req.globe && await part('subdivide').then(m => ({...req.globe!, ...m}), (err: Error) => void (fault = err.message));
    const out = toGL(ir, cut);
    out.tile.fault = fault;
    return out;
}

/** An elevation tile to fetch, and what comes back: its pixels for the GPU, and its heights on a coarse grid with their range. */
export interface ElevationRequest { id: number; url: string; encoding: DemEncoding }
export interface ElevationTile { width: number; height: number; pixels: Uint8Array; grid: Float32Array; lo: number; hi: number; /** When the tile is out of date (see `TileFetchState`). */ expires?: number }
/** A raster tile to fetch, and what comes back: its decoded image (none for a tile that does not exist or is empty) and the state of the fetch. */
export interface ImageRequest { id: number; url: string }
export interface ImageTile extends TileFetchState { image: ImageBitmap | null }
/** `overscaled`: for a tile of the deepest level of its source, the zoom of the map that the tile is built for. */
export interface TileRequest { id: number; source: string; url: string; z: number; overscaled: number | false; /** The tile: zoom, x and y, for `within` and `distance`. */ at?: [number, number, number]; /** Built again after a change of the style: the bytes that the builder has are good. */ again?: boolean; /** The map draws icons from buffers of the tile (see `IconBatch`). */ direct?: boolean;
    /** The map can show the globe: fills and lines are cut along a grid (see subdivide.ts). */ globe?: GlobeBuild }

/** Fetches and parses tiles. The same class backs tile workers, the main-thread fallback and server rendering. */
export class TileBuilder {
    private bySource = new Map<string, CompiledLayer[]>();
    private aborts = new Map<number, AbortController>();
    /** Recently fetched tiles, kept so feature queries on visible tiles need no second download. */
    private recent = new Map<string, Uint8Array>();
    /** Downloads of tiles that are loading, by the same key, so a query about such a tile waits for it instead of fetching it again. */
    private loading = new Map<string, Promise<Uint8Array | null>>();
    /** Counts the calls of `forget`: bytes that were asked for before a call are not kept after it. */
    private forgotten = 0;
    private geojson = new Map<string, PreparedSource>();

    private contours = new Map<string, ContourConfig>();
    private dems = new Map<string, Promise<DEM | null>>();
    /** Image decoder for elevation tiles where there is no browser (server rendering). */
    decodeImage?: ImageDecoder;
    /** Tells the builder how each contour source derives its lines. */
    /** `ids`: the `promoteId` of each vector source that has one. */
    setContours(sources: Record<string, ContourConfig>, ids: Record<string, string | Record<string, string>> = {}) { this.contours = new Map(Object.entries(sources)); this.ids = ids; }
    private ids: Record<string, string | Record<string, string>> = {};

    /** Elevation tiles are shared between neighboring contour tiles, so decoded ones are kept for a while. */
    private loadDEM = (url: string, encoding: DemEncoding, c: Parts['dem']): Promise<DEM | null> => {
        let dem = this.dems.get(url);
        if (!dem) {
            dem = fetchTile(url, this.fetchFn, undefined, undefined, true).then(bytes => bytes ? c.decodeDEM(bytes, encoding, this.decodeImage) : null);
            this.dems.set(url, dem);
            dem.catch(() => this.dems.delete(url));
            if (this.dems.size > 40) this.dems.delete(this.dems.keys().next().value!);
        }
        return dem;
    };
    private async contour(url: string) {
        const m = /^contour:\/\/(.*)\/(\d+)\/(\d+)\/(\d+)$/.exec(url)!, cfg = this.contours.get(m[1]);
        if (!cfg) return {};
        const c = await part('dem');
        return c.contourTile(cfg, +m[2], +m[3], +m[4], u => this.loadDEM(u, cfg.encoding, c), m[1]);
    }

    /**
     * An elevation tile, ready for the GPU. The costly parts (decoding the image, reading its pixels back, and sampling
     * the heights that 3D terrain needs on the CPU) are done here, away from the thread that draws.
     */
    async loadElevation(req: ElevationRequest): Promise<ElevationTile | null> {
        const ac = new AbortController();
        this.aborts.set(req.id, ac);
        try {
            const st: TileFetchState = {}, bytes = await fetchTile(req.url, this.fetchFn, ac.signal, st, true);
            if (!bytes) return null;
            const px = await decodePixels(bytes, this.decodeImage), {width: w, height: h} = px, grid = new Float32Array(HEIGHT_GRID * HEIGHT_GRID);
            let lo = Infinity, hi = -Infinity;
            // Each cell of the grid is the mean of the pixels that it covers (two by two for a tile of 512 pixels), so that
            // heights read from it agree with the full image, as MapLibre GL JS reads them. A cell that took one pixel in
            // four lay up to hundreds of meters off in the mountains (#1459).
            for (let j = 0; j < HEIGHT_GRID; j++) {
                const y0 = Math.min(h - 1, Math.floor(j * h / HEIGHT_GRID)), y1 = Math.max(y0 + 1, Math.floor((j + 1) * h / HEIGHT_GRID));
                for (let i = 0; i < HEIGHT_GRID; i++) {
                    const x0 = Math.min(w - 1, Math.floor(i * w / HEIGHT_GRID)), x1 = Math.max(x0 + 1, Math.floor((i + 1) * w / HEIGHT_GRID));
                    let sum = 0;
                    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                        const v = decodeElevation(px.data, (y * w + x) * 4, req.encoding);
                        sum += v;
                        if (v < lo) lo = v;
                        if (v > hi) hi = v;
                    }
                    grid[j * HEIGHT_GRID + i] = sum / ((y1 - y0) * (x1 - x0));
                }
            }
            return {width: w, height: h, pixels: new Uint8Array(px.data.buffer, px.data.byteOffset, px.data.byteLength), grid, lo, hi, expires: st.expires};
        } finally { this.aborts.delete(req.id); }
    }

    /**
     * A raster tile, decoded. A custom protocol can answer with an image that is decoded already. (In WebKit an image is
     * decoded on the thread that asks for it, and decodes on the thread that draws held its frames for up to 230 ms in a
     * fast zoom, #2068.)
     */
    async loadImage(req: ImageRequest): Promise<ImageTile> {
        const ac = new AbortController();
        this.aborts.set(req.id, ac);
        try {
            const st: TileFetchState = {}, got = await fetchTile(req.url, this.fetchFn, ac.signal, st, true);
            return {...st, image: got && 'length' in got ? await createImageBitmap(new Blob([got as BlobPart])) : got};
        } finally { this.aborts.delete(req.id); }
    }

    /** Replaces a GeoJSON source's data. Its tiles are cut from this on demand. */
    /** (The part of the GeoJSON code loads first: a tile of the source that is asked for later waits for this data, see `part`.) */
    async setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number) { const g = await part('geojson'); this.geojson.set(source, g.prepareSource(data, options, maxzoom)); }

    /** Starts to load the parts that the style of the map needs (see `partsFor` in engine.ts), before a tile needs one. */
    need(names: PartName[]) { for (const n of names) part(n); }

    /** GeoJSON tiles are addressed as geojson://source/z/x/y and built from memory, not fetched. */
    private async slice(url: string) {
        const m = /^geojson:\/\/(.*)\/(\d+)\/(\d+)\/(\d+)$/.exec(url)!, g = await part('geojson');
        // A gradient along a line needs to know how far along the whole line each piece of it is.
        const metrics = this.bySource.get(m[1])?.some(l => l.type === 'line' && l.ramp) ?? false;
        return g.sliceGeoJSON(this.geojson.get(m[1]) ?? [], +m[2], +m[3], +m[4], metrics);
    }
    private fetchFn: typeof fetch;
    constructor(fetchFn: typeof fetch = fetch) { this.fetchFn = withTimeout((...a) => fetchFn(...a)); }
    /** Replaces how this builder makes its requests (see requests.ts). Every request has the timeout of `withTimeout`. */
    setFetch(fetchFn: typeof fetch) { this.fetchFn = withTimeout(fetchFn); }

    /** The global state and the feature state of the map of this builder. */
    private states: MapStates = {g: {}, f: {}};
    setFeatureState(source: string, states: FeatureStates, replace?: boolean) {
        const own = replace || !this.states.f[source] ? (this.states.f[source] = {}) : this.states.f[source];
        for (const k in states) { const v = states[k]; if (v) own[k] = v; else delete own[k]; }
    }
    /** The slots of each image that is an SVG template, by the name of the image. */
    private templates: Record<string, string[]> = {};
    setTemplates(templates: Record<string, string[]>) { this.templates = templates; }
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) {
        this.states.g = state ?? {};
        compileFor(this.states);
        this.bySource.clear();
        geo.wanted = false;
        for (const json of layers) {
            const l = compileLayer(json);
            if (!l?.source) continue;
            const list = this.bySource.get(l.source);
            if (list) list.push(l); else this.bySource.set(l.source, [l]);
        }
        // The code of `within` and `distance` starts to load with the style, and tiles and queries wait for it. A failed
        // load warns once, and the map draws on with false and NaN for the two (#1707).
        this.geo = geo.wanted ? this.loadGeo() : undefined;
    }
    private loadGeo() { return part('within').then(m => { geo.code = m; }, (err: Error) => warnOnce(err.message.replace(/^\[map-jr-gl\] /, ''))); }
    /** The load of the code of `within` and `distance`, when the style of this map uses one of them. */
    private geo?: Promise<void>;

    /** Builds a tile. (`within` and `distance` see the tile through `geo.tile`, which is set right before.) */
    private build(data: Parameters<typeof buildTile>[0], req: TileRequest) { geo.tile = req.at; return buildTile(data, req.z, this.bySource.get(req.source) ?? [], req.overscaled, this.states.f, this.templates, req.direct); }
    async loadIR(req: TileRequest): Promise<TileIR> {
        if (this.geo) await this.geo;
        if (req.url.startsWith(GEOJSON_PREFIX)) return this.build(await this.slice(req.url), req);
        if (req.url.startsWith('contour://')) return this.build(await this.contour(req.url), req);
        const ac = new AbortController();
        this.aborts.set(req.id, ac);
        try {
            const key = req.source + '|' + req.url, n = this.forgotten;
            let bytes = req.again && this.recent.get(key) || null;
            const st: TileFetchState = {};
            if (!bytes) {
                const p = fetchTile(req.url, this.fetchFn, ac.signal, st);
                this.loading.set(key, p);
                try { bytes = await p; } finally { if (this.loading.get(key) === p) this.loading.delete(key); }
            }
            if (!bytes) return {layers: {}, labels: {}, expires: st.expires};
            if (n === this.forgotten) this.remember(key, bytes);
            return {...bytes.length ? this.build(decodeVectorTile(bytes, this.ids[req.source]), req) : {layers: {}, labels: {}}, expires: st.expires};
        } finally {
            this.aborts.delete(req.id);
        }
    }

    cancel(id: number) { this.aborts.get(id)?.abort(); }

    /**
     * Drops the kept tiles of one source, or of every source: the next load or query fetches them again.
     * (The elevation tiles of contour sources are dropped with any source.)
     */
    forget(source?: string) {
        this.forgotten++;
        for (const key of this.loading.keys()) if (!source || key.startsWith(source + '|')) this.loading.delete(key);
        for (const key of this.recent.keys()) if (!source || key.startsWith(source + '|')) this.recent.delete(key);
        this.dems.clear();
    }

    /** `key` is the name of the source, "|" and the URL of the tile. */
    private remember(key: string, bytes: Uint8Array) {
        this.recent.delete(key);
        this.recent.set(key, bytes);
        if (this.recent.size > 64) this.recent.delete(this.recent.keys().next().value!);
    }

    /** Queries a tile's raw features. The tile is fetched if it is not already at hand; it need not be on screen. */
    /** (The filters of a question are compiled when it is answered: for the states of this map.) */
    private find(data: Parameters<typeof queryTile>[0], q: TileQuery) { compileFor(this.states); geo.tile = [q.z, q.x, q.y]; return queryTile(data, q); }
    async query(url: string, q: TileQuery): Promise<QueriedFeature[]> {
        // (A filter of the question can use them where the style does not.)
        if (!this.geo && /"(within|distance)"/.test(JSON.stringify(q.filter ?? null))) this.geo = this.loadGeo();
        if (this.geo) await this.geo;
        if (url.startsWith(GEOJSON_PREFIX)) return this.find(await this.slice(url), q);
        if (url.startsWith('contour://')) return this.find(await this.contour(url), q);
        const key = q.source + '|' + url, n = this.forgotten;
        let bytes = this.recent.get(key);
        if (!bytes) {
            // A load that is canceled or fails does not answer the query: the query then fetches the tile itself.
            const shared = this.loading.get(key), fetched = shared && await shared.catch(() => undefined) || await fetchTile(url, this.fetchFn);
            if (!fetched) return [];
            bytes = fetched;
            if (n === this.forgotten) this.remember(key, bytes);
        }
        return bytes.length ? this.find(decodeVectorTile(bytes, this.ids[q.source]), q) : [];
    }
}

/** What the engine needs from wherever tiles are built. */
/** Feature states by "sourceLayer|id"; `null` means that the feature has no state any more. */
export type FeatureStates = Record<string, Record<string, unknown> | null>;
export interface TileBackend {
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>): void;
    /** Tells the builder which requests the page wants to change, and how to ask the page. */
    setRequests(rules: RequestRules, ask: Ask): void;
    /** Fetches and decodes an elevation tile for the GPU and for 3D terrain. */
    loadElevation(req: ElevationRequest): Promise<ElevationTile | null>;
    /** Fetches and decodes a raster tile. */
    loadImage(req: ImageRequest): Promise<ImageTile>;
    /** Sets the data of a GeoJSON source. A worker answers once it has indexed the data (see `geojsonDone` of the engine). */
    setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number, packed?: () => Uint8Array | null): Promise<unknown> | void;
    /** Changes the feature state of one source ("sourceLayer|id" -> state, `null` removes it); `replace` drops the other states. */
    setFeatureState(source: string, states: FeatureStates, replace?: boolean): void;
    /** The slots of each image that is an SVG template. Tiles that are built later give each icon the name of its variant. */
    setTemplates(templates: Record<string, string[]>): void;
    /** The sources of contour lines, and the `promoteId` of each vector source that has one. */
    setContours(sources: Record<string, ContourConfig>, ids?: Record<string, string | Record<string, string>>): void;
    /** The first bytes of a PMTiles archive, which the page has read already. */
    setHead(url: string, bytes: Uint8Array): void;
    /** The parts of the tile code that the style needs (see parts.ts): the builder starts to load them. */
    need(names: PartName[]): void;
    load(req: TileRequest): Promise<TileGL>;
    cancel(id: number): void;
    /** Drops the tile bytes that the builder keeps for one source, or for every source (see `refreshTiles`). */
    forget(source?: string): void;
    query(url: string, q: TileQuery): Promise<QueriedFeature[]>;
}

export class LocalBackend implements TileBackend {
    private builder = new TileBuilder();
    loadElevation(req: ElevationRequest) { return this.builder.loadElevation(req); }
    loadImage(req: ImageRequest) { return this.builder.loadImage(req); }
    setRequests(rules: RequestRules, ask: Ask) { this.builder.setFetch(fetchWith(() => rules, ask)); }
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) { this.builder.setStyle(layers, state); }
    setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number) { return this.builder.setGeoJSON(source, data, options, maxzoom); }
    setFeatureState(source: string, states: FeatureStates, replace?: boolean) { this.builder.setFeatureState(source, states, replace); }
    setTemplates(templates: Record<string, string[]>) { this.builder.setTemplates(templates); }
    setContours(sources: Record<string, ContourConfig>, ids?: Record<string, string | Record<string, string>>) { this.builder.setContours(sources, ids); }
    setHead(url: string, bytes: Uint8Array) { heads.set(url, bytes); }
    need(names: PartName[]) { this.builder.need(names); }
    async load(req: TileRequest) { return (await finish(await this.builder.loadIR(req), req)).tile; }
    cancel(id: number) { this.builder.cancel(id); }
    forget(source?: string) { this.builder.forget(source); }
    query(url: string, q: TileQuery) { return this.builder.query(url, q); }
}

type Port = {postMessage(msg: any, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null};

/** Talks to a tile worker over a MessagePort, so the engine can sit on the main thread or in its own worker. */
export class PortBackend implements TileBackend {
    private pending = new Map<number, {resolve(t: any): void; reject(e: Error): void}>();
    private nextQuery = -1;
    private port: Port;
    constructor(port: Port) {
        // (Structured clone refuses a Vue reactive proxy in the data of the page. Such a message goes as a JSON copy, #242.)
        this.port = {postMessage: (m, t) => { try { port.postMessage(m, t); } catch (e) { if ((e as Error).name !== 'DataCloneError') throw e; port.postMessage(JSON.parse(JSON.stringify(m)), t); } }, onmessage: null};
        port.onmessage = e => {
            // The worker asks about a request: pass the question on, and the answer back.
            // (The answer can carry the number that the engine gave the question. The worker must get its own number back:
            // each worker counts its questions separately.)
            if (e.data.type === 'warn') return warnOnce(e.data.msg);
            if (e.data.type === 'resource') {
                this.ask?.(e.data.url, e.data.kind).then(a => a, (err): RequestAnswer => ({error: String(err.message)})).then(a => port.postMessage({...a, type: 'resourceResult', id: e.data.id}, a.data ? [a.data] : []));
                return;
            }
            const p = this.pending.get(e.data.id);
            if (!p) return;
            this.pending.delete(e.data.id);
            if (e.data.error) p.reject(Object.assign(new Error(e.data.error), {final: e.data.final}));
            else if (e.data.tile) p.resolve({layers: e.data.tile.layers, labels: unpackLabels(e.data.tile.labels), icons: e.data.tile.icons, z: e.data.tile.z, expires: e.data.tile.expires, fault: e.data.tile.fault});
            else p.resolve(e.data.result);
        };
    }
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) { this.port.postMessage({type: 'style', layers, state}); }
    private ask?: Ask;
    setRequests(rules: RequestRules, ask: Ask) { this.ask = ask; this.port.postMessage({type: 'requests', rules}); }
    loadElevation(req: ElevationRequest): Promise<ElevationTile | null> {
        return new Promise((resolve, reject) => { this.pending.set(req.id, {resolve, reject}); this.port.postMessage({type: 'dem', req}); });
    }
    loadImage(req: ImageRequest): Promise<ImageTile> {
        return new Promise((resolve, reject) => { this.pending.set(req.id, {resolve, reject}); this.port.postMessage({type: 'image', req}); });
    }
    setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number, packed?: () => Uint8Array | null) {
        // (Data that cannot be copied throws here, before the promise, so that the engine reports it as before.)
        // (The bytes of `packGeoJSON` are encoded once for all tile workers; each worker gets its own copy and parses it, #878.)
        const id = this.nextQuery--, bytes = packed?.()?.slice();
        if (bytes) this.port.postMessage({type: 'geojson', id, source, bytes, options, maxzoom}, [bytes.buffer]);
        else this.port.postMessage({type: 'geojson', id, source, data, options, maxzoom});
        return new Promise((resolve, reject) => this.pending.set(id, {resolve, reject}));
    }
    setFeatureState(source: string, states: FeatureStates, replace?: boolean) { this.port.postMessage({type: 'featureState', source, states, replace}); }
    setTemplates(templates: Record<string, string[]>) { this.port.postMessage({type: 'templates', templates}); }
    setContours(sources: Record<string, ContourConfig>, ids?: Record<string, string | Record<string, string>>) { this.port.postMessage({type: 'contours', sources, ids}); }
    setHead(url: string, bytes: Uint8Array) { this.port.postMessage({type: 'head', url, bytes}); }
    need(names: PartName[]) { this.port.postMessage({type: 'need', names}); }
    load(req: TileRequest) {
        return new Promise<TileGL>((resolve, reject) => {
            this.pending.set(req.id, {resolve, reject});
            this.port.postMessage({type: 'load', req});
        });
    }
    cancel(id: number) { this.port.postMessage({type: 'cancel', id}); }
    forget(source?: string) { this.port.postMessage({type: 'forget', source}); }
    query(url: string, q: TileQuery) {
        return new Promise<QueriedFeature[]>((resolve, reject) => {
            const id = this.nextQuery--; // negative ids keep queries apart from tile requests
            this.pending.set(id, {resolve, reject});
            this.port.postMessage({type: 'query', id, url, q});
        });
    }
}

/** Worker side of PortBackend. */
export function serveTiles(port: Port) {
    // Questions about requests go over the port, to the engine, which asks the page.
    let rules: RequestRules | undefined, nextAsk = 0;
    const asked = new Map<number, (a: RequestAnswer) => void>();
    const builder = new TileBuilder(fetchWith(() => rules, (url, kind) => new Promise(done => { asked.set(++nextAsk, done); port.postMessage({type: 'resource', id: nextAsk, url, kind}); })));
    port.onmessage = async e => {
        const m = e.data;
        if (m.type === 'requests') rules = m.rules;
        else if (m.type === 'resourceResult') { asked.get(m.id)?.(m); asked.delete(m.id); }
        else if (m.type === 'style') builder.setStyle(m.layers, m.state);
        // (A failure, as of the part of the GeoJSON code, goes back to the engine, which reports it: #79.)
        else if (m.type === 'geojson') {
            try { await builder.setGeoJSON(m.source, m.bytes ? JSON.parse(new TextDecoder().decode(m.bytes)) : m.data, m.options, m.maxzoom); port.postMessage({id: m.id, result: null}); }
            catch (err) { port.postMessage({id: m.id, error: String((err as Error).message)}); }
        }
        else if (m.type === 'need') builder.need(m.names);
        else if (m.type === 'featureState') builder.setFeatureState(m.source, m.states, m.replace);
        else if (m.type === 'templates') builder.setTemplates(m.templates);
        else if (m.type === 'contours') builder.setContours(m.sources, m.ids);
        else if (m.type === 'head') heads.set(m.url, m.bytes);
        else if (m.type === 'cancel') builder.cancel(m.id);
        else if (m.type === 'forget') builder.forget(m.source);
        else if (m.type === 'close') { port.onmessage = null; (port as any).close?.(); }
        else if (m.type === 'query') {
            builder.query(m.url, m.q).then(result => port.postMessage({id: m.id, result}), err => port.postMessage({id: m.id, error: String(err.message)}));
        } else if (m.type === 'dem' || m.type === 'image') {
            (m.type === 'dem' ? builder.loadElevation(m.req) : builder.loadImage(m.req)).then(result => port.postMessage({id: m.req.id, result}, !result ? [] : 'grid' in result ? [result.pixels.buffer, result.grid.buffer] : result.image ? [result.image] : []),
                err => port.postMessage({id: m.req.id, error: (err as Error).name === 'AbortError' ? 'aborted' : String((err as Error).message), final: (err as {final?: boolean}).final}));
        } else if (m.type === 'load') {
            try {
                const {tile, transfer} = await finish(await builder.loadIR(m.req), m.req);
                port.postMessage({id: m.req.id, tile: {layers: tile.layers, labels: packLabels(tile.labels), icons: tile.icons, z: tile.z, expires: tile.expires, fault: tile.fault}}, transfer);
            } catch (err) {
                port.postMessage({id: m.req.id, error: (err as Error).name === 'AbortError' ? 'aborted' : String((err as Error).message), final: (err as {final?: boolean}).final});
            }
        }
    };
}
