import {compileLayer, type CompiledLayer, type LayerJSON} from './style.ts';
import {setFeatureStates, setGlobalState} from './expr.ts';
import {buildTile, packLabels, toGL, unpackLabels, type TileGL, type TileIR} from './tile.ts';
import {decodeElevation, queryTile, type QueriedFeature, type TileQuery} from './query.ts';
import {HEIGHT_GRID} from './geo.ts';
import {fetchWith, type Ask, type RequestAnswer, type RequestRules} from './requests.ts';
import {fetchTile} from './pmtiles.ts';
import {GEOJSON_PREFIX, prepareSource, sliceGeoJSON, type GeoJSONOptions, type PreparedSource} from './geojson.ts';
import {contourTile, decodeDEM, decodePixels, type ContourConfig, type DEM, type ImageDecoder} from './contour.ts';

/** An elevation tile to fetch, and what comes back: its pixels for the GPU, and its heights on a coarse grid with their range. */
export interface ElevationRequest { id: number; url: string; encoding: string }
export interface ElevationTile { width: number; height: number; pixels: Uint8Array; grid: Float32Array; lo: number; hi: number }
export interface TileRequest { id: number; source: string; url: string; z: number; overscaled: boolean }

/** Fetches and parses tiles. The same class backs tile workers, the main-thread fallback and server rendering. */
export class TileBuilder {
    private bySource = new Map<string, CompiledLayer[]>();
    private aborts = new Map<number, AbortController>();
    /** Recently fetched tiles, kept so feature queries on visible tiles need no second download. */
    private recent = new Map<string, Uint8Array>();
    private geojson = new Map<string, PreparedSource>();

    private contours = new Map<string, ContourConfig>();
    private dems = new Map<string, Promise<DEM | null>>();
    /** Image decoder for elevation tiles where there is no browser (server rendering). */
    decodeImage?: ImageDecoder;
    /** Tells the builder how each contour source derives its lines. */
    setContours(sources: Record<string, ContourConfig>) { this.contours = new Map(Object.entries(sources)); }

    /** Elevation tiles are shared between neighbouring contour tiles, so decoded ones are kept for a while. */
    private loadDEM = (url: string, encoding: string): Promise<DEM | null> => {
        let dem = this.dems.get(url);
        if (!dem) {
            dem = fetchTile(url, this.fetchFn).then(bytes => bytes ? decodeDEM(bytes, encoding, this.decodeImage) : null);
            this.dems.set(url, dem);
            dem.catch(() => this.dems.delete(url));
            if (this.dems.size > 40) this.dems.delete(this.dems.keys().next().value!);
        }
        return dem;
    };
    private contour(url: string) {
        const m = /^contour:\/\/(.*)\/(\d+)\/(\d+)\/(\d+)$/.exec(url)!, cfg = this.contours.get(m[1]);
        return cfg ? contourTile(cfg, +m[2], +m[3], +m[4], u => this.loadDEM(u, cfg.encoding)) : Promise.resolve({});
    }

    /**
     * An elevation tile, ready for the GPU. The costly parts (decoding the image, reading its pixels back, and sampling
     * the heights that 3D terrain needs on the CPU) are done here, away from the thread that draws.
     */
    async loadElevation(req: ElevationRequest): Promise<ElevationTile | null> {
        const ac = new AbortController();
        this.aborts.set(req.id, ac);
        try {
            const bytes = await fetchTile(req.url, this.fetchFn, ac.signal);
            if (!bytes) return null;
            const px = await decodePixels(bytes, this.decodeImage), {width: w, height: h} = px, grid = new Float32Array(HEIGHT_GRID * HEIGHT_GRID);
            let lo = Infinity, hi = -Infinity;
            for (let j = 0; j < HEIGHT_GRID; j++) {
                const y = Math.min(h - 1, Math.floor((j + 0.5) * h / HEIGHT_GRID));
                for (let i = 0; i < HEIGHT_GRID; i++) {
                    const v = grid[j * HEIGHT_GRID + i] = decodeElevation(px.data, (y * w + Math.min(w - 1, Math.floor((i + 0.5) * w / HEIGHT_GRID))) * 4, req.encoding);
                    if (v < lo) lo = v;
                    if (v > hi) hi = v;
                }
            }
            return {width: w, height: h, pixels: new Uint8Array(px.data.buffer, px.data.byteOffset, px.data.byteLength), grid, lo, hi};
        } finally { this.aborts.delete(req.id); }
    }

    /** Replaces a GeoJSON source's data. Its tiles are cut from this on demand. */
    setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number) { this.geojson.set(source, prepareSource(data, options, maxzoom)); }

    /** GeoJSON tiles are addressed as geojson://source/z/x/y and built from memory, not fetched. */
    private slice(url: string) {
        const m = /^geojson:\/\/(.*)\/(\d+)\/(\d+)\/(\d+)$/.exec(url)!;
        // A gradient along a line needs to know how far along the whole line each piece of it is.
        const metrics = this.bySource.get(m[1])?.some(l => l.type === 'line' && l.ramp) ?? false;
        return sliceGeoJSON(this.geojson.get(m[1]) ?? [], +m[2], +m[3], +m[4], metrics);
    }
    private fetchFn: typeof fetch;
    constructor(fetchFn: typeof fetch = fetch) { this.fetchFn = (...a) => fetchFn(...a); }
    /** Replaces how this builder makes its requests (see requests.ts). */
    setFetch(fetchFn: typeof fetch) { this.fetchFn = fetchFn; }

    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) {
        setGlobalState(state);
        this.bySource.clear();
        for (const json of layers) {
            const l = compileLayer(json);
            if (!l?.source) continue;
            const list = this.bySource.get(l.source);
            if (list) list.push(l); else this.bySource.set(l.source, [l]);
        }
    }

    async loadIR(req: TileRequest): Promise<TileIR> {
        if (req.url.startsWith(GEOJSON_PREFIX)) return buildTile(this.slice(req.url), req.z, this.bySource.get(req.source) ?? [], req.overscaled);
        if (req.url.startsWith('contour://')) return buildTile(await this.contour(req.url), req.z, this.bySource.get(req.source) ?? [], req.overscaled);
        const ac = new AbortController();
        this.aborts.set(req.id, ac);
        try {
            const bytes = await fetchTile(req.url, this.fetchFn, ac.signal);
            if (!bytes) return {layers: {}, labels: {}};
            this.remember(req.url, bytes);
            return bytes.length ? buildTile(bytes, req.z, this.bySource.get(req.source) ?? [], req.overscaled) : {layers: {}, labels: {}};
        } finally {
            this.aborts.delete(req.id);
        }
    }

    cancel(id: number) { this.aborts.get(id)?.abort(); }

    private remember(url: string, bytes: Uint8Array) {
        this.recent.delete(url);
        this.recent.set(url, bytes);
        if (this.recent.size > 48) this.recent.delete(this.recent.keys().next().value!);
    }

    /** Queries a tile's raw features. The tile is fetched if it is not already at hand; it need not be on screen. */
    async query(url: string, q: TileQuery): Promise<QueriedFeature[]> {
        if (url.startsWith(GEOJSON_PREFIX)) return queryTile(this.slice(url), q);
        if (url.startsWith('contour://')) return queryTile(await this.contour(url), q);
        let bytes = this.recent.get(url);
        if (!bytes) {
            const fetched = await fetchTile(url, this.fetchFn);
            if (!fetched) return [];
            bytes = fetched;
            this.remember(url, bytes);
        }
        return bytes.length ? queryTile(bytes, q) : [];
    }
}

/** What the engine needs from wherever tiles are built. */
export interface TileBackend {
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>): void;
    /** Tells the builder which requests the page wants to change, and how to ask the page. */
    setRequests(rules: RequestRules, ask: Ask): void;
    /** Fetches and decodes an elevation tile for the GPU and for 3D terrain. */
    loadElevation(req: ElevationRequest): Promise<ElevationTile | null>;
    setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number): void;
    /** Replaces the feature state of one source: "sourceLayer|id" -> state. */
    setFeatureState(source: string, states: Record<string, Record<string, unknown>>): void;
    setContours(sources: Record<string, ContourConfig>): void;
    load(req: TileRequest): Promise<TileGL>;
    cancel(id: number): void;
    query(url: string, q: TileQuery): Promise<QueriedFeature[]>;
}

export class LocalBackend implements TileBackend {
    private builder = new TileBuilder();
    loadElevation(req: ElevationRequest) { return this.builder.loadElevation(req); }
    setRequests(rules: RequestRules, ask: Ask) { this.builder.setFetch(fetchWith(() => rules, ask)); }
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) { this.builder.setStyle(layers, state); }
    setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number) { this.builder.setGeoJSON(source, data, options, maxzoom); }
    setFeatureState(source: string, states: Record<string, Record<string, unknown>>) { setFeatureStates(source, states); }
    setContours(sources: Record<string, ContourConfig>) { this.builder.setContours(sources); }
    async load(req: TileRequest) { return toGL(await this.builder.loadIR(req)).tile; }
    cancel(id: number) { this.builder.cancel(id); }
    query(url: string, q: TileQuery) { return this.builder.query(url, q); }
}

type Port = {postMessage(msg: any, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null};

/** Talks to a tile worker over a MessagePort, so the engine can sit on the main thread or in its own worker. */
export class PortBackend implements TileBackend {
    private pending = new Map<number, {resolve(t: any): void; reject(e: Error): void}>();
    private nextQuery = -1;
    constructor(private port: Port) {
        port.onmessage = e => {
            // The worker asks about a request: pass the question on, and the answer back.
            // (The answer can carry the number that the engine gave the question. The worker must get its own number back:
            // each worker counts its questions separately.)
            if (e.data.type === 'resource') {
                this.ask?.(e.data.url, e.data.kind).then(a => a, (err): RequestAnswer => ({error: String(err.message)})).then(a => port.postMessage({...a, type: 'resourceResult', id: e.data.id}, a.data ? [a.data] : []));
                return;
            }
            const p = this.pending.get(e.data.id);
            if (!p) return;
            this.pending.delete(e.data.id);
            if (e.data.error) p.reject(new Error(e.data.error));
            else if (e.data.tile) p.resolve({layers: e.data.tile.layers, labels: unpackLabels(e.data.tile.labels)});
            else p.resolve(e.data.result);
        };
    }
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) { this.port.postMessage({type: 'style', layers, state}); }
    private ask?: Ask;
    setRequests(rules: RequestRules, ask: Ask) { this.ask = ask; this.port.postMessage({type: 'requests', rules}); }
    loadElevation(req: ElevationRequest): Promise<ElevationTile | null> {
        return new Promise((resolve, reject) => { this.pending.set(req.id, {resolve, reject}); this.port.postMessage({type: 'dem', req}); });
    }
    setGeoJSON(source: string, data: unknown, options?: GeoJSONOptions, maxzoom?: number) { this.port.postMessage({type: 'geojson', source, data, options, maxzoom}); }
    setFeatureState(source: string, states: Record<string, Record<string, unknown>>) { this.port.postMessage({type: 'featureState', source, states}); }
    setContours(sources: Record<string, ContourConfig>) { this.port.postMessage({type: 'contours', sources}); }
    load(req: TileRequest) {
        return new Promise<TileGL>((resolve, reject) => {
            this.pending.set(req.id, {resolve, reject});
            this.port.postMessage({type: 'load', req});
        });
    }
    cancel(id: number) { this.port.postMessage({type: 'cancel', id}); }
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
        else if (m.type === 'geojson') builder.setGeoJSON(m.source, m.data, m.options, m.maxzoom);
        else if (m.type === 'featureState') setFeatureStates(m.source, m.states);
        else if (m.type === 'contours') builder.setContours(m.sources);
        else if (m.type === 'cancel') builder.cancel(m.id);
        else if (m.type === 'close') { port.onmessage = null; (port as any).close?.(); }
        else if (m.type === 'query') {
            builder.query(m.url, m.q).then(result => port.postMessage({id: m.id, result}), err => port.postMessage({id: m.id, error: String(err.message)}));
        } else if (m.type === 'dem') {
            builder.loadElevation(m.req).then(result => port.postMessage({id: m.req.id, result}, result ? [result.pixels.buffer, result.grid.buffer] : []),
                err => port.postMessage({id: m.req.id, error: (err as Error).name === 'AbortError' ? 'aborted' : String((err as Error).message)}));
        } else if (m.type === 'load') {
            try {
                const {tile, transfer} = toGL(await builder.loadIR(m.req));
                port.postMessage({id: m.req.id, tile: {layers: tile.layers, labels: packLabels(tile.labels)}}, transfer);
            } catch (err) {
                port.postMessage({id: m.req.id, error: (err as Error).name === 'AbortError' ? 'aborted' : String((err as Error).message)});
            }
        }
    };
}
