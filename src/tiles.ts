import {compileLayer, type CompiledLayer, type LayerJSON} from './style.ts';
import {setFeatureStates, setGlobalState} from './expr.ts';
import {buildTile, toGL, type TileGL, type TileIR} from './tile.ts';
import {queryTile, type QueriedFeature, type TileQuery} from './query.ts';
import {fetchTile} from './pmtiles.ts';
import {GEOJSON_PREFIX, prepareGeoJSON, sliceGeoJSON} from './geojson.ts';
import {contourTile, decodeDEM, type ContourConfig, type DEM, type ImageDecoder} from './contour.ts';

export interface TileRequest { id: number; source: string; url: string; z: number; overscaled: boolean }

/** Fetches and parses tiles. The same class backs tile workers, the main-thread fallback and server rendering. */
export class TileBuilder {
    private bySource = new Map<string, CompiledLayer[]>();
    private aborts = new Map<number, AbortController>();
    /** Recently fetched tiles, kept so feature queries on visible tiles need no second download. */
    private recent = new Map<string, Uint8Array>();
    private geojson = new Map<string, ReturnType<typeof prepareGeoJSON>>();

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

    /** Replaces a GeoJSON source's data. Its tiles are cut from this on demand. */
    setGeoJSON(source: string, data: unknown) { this.geojson.set(source, prepareGeoJSON(data)); }

    /** GeoJSON tiles are addressed as geojson://source/z/x/y and built from memory, not fetched. */
    private slice(url: string) {
        const m = /^geojson:\/\/(.*)\/(\d+)\/(\d+)\/(\d+)$/.exec(url)!;
        return sliceGeoJSON(this.geojson.get(m[1]) ?? [], +m[2], +m[3], +m[4]);
    }
    private fetchFn: typeof fetch;
    constructor(fetchFn: typeof fetch = fetch) { this.fetchFn = (...a) => fetchFn(...a); }

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
    setGeoJSON(source: string, data: unknown): void;
    /** Replaces the feature state of one source: "sourceLayer|id" -> state. */
    setFeatureState(source: string, states: Record<string, Record<string, unknown>>): void;
    setContours(sources: Record<string, ContourConfig>): void;
    load(req: TileRequest): Promise<TileGL>;
    cancel(id: number): void;
    query(url: string, q: TileQuery): Promise<QueriedFeature[]>;
}

export class LocalBackend implements TileBackend {
    private builder = new TileBuilder();
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) { this.builder.setStyle(layers, state); }
    setGeoJSON(source: string, data: unknown) { this.builder.setGeoJSON(source, data); }
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
            const p = this.pending.get(e.data.id);
            if (!p) return;
            this.pending.delete(e.data.id);
            if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.tile ?? e.data.result);
        };
    }
    setStyle(layers: LayerJSON[], state?: Record<string, unknown>) { this.port.postMessage({type: 'style', layers, state}); }
    setGeoJSON(source: string, data: unknown) { this.port.postMessage({type: 'geojson', source, data}); }
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
    const builder = new TileBuilder();
    port.onmessage = async e => {
        const m = e.data;
        if (m.type === 'style') builder.setStyle(m.layers, m.state);
        else if (m.type === 'geojson') builder.setGeoJSON(m.source, m.data);
        else if (m.type === 'featureState') setFeatureStates(m.source, m.states);
        else if (m.type === 'contours') builder.setContours(m.sources);
        else if (m.type === 'cancel') builder.cancel(m.id);
        else if (m.type === 'close') { port.onmessage = null; (port as any).close?.(); }
        else if (m.type === 'query') {
            builder.query(m.url, m.q).then(result => port.postMessage({id: m.id, result}), err => port.postMessage({id: m.id, error: String(err.message)}));
        } else if (m.type === 'load') {
            try {
                const {tile, transfer} = toGL(await builder.loadIR(m.req));
                port.postMessage({id: m.req.id, tile}, transfer);
            } catch (err) {
                port.postMessage({id: m.req.id, error: (err as Error).name === 'AbortError' ? 'aborted' : String((err as Error).message)});
            }
        }
    };
}
