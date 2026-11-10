import {compileLayer, type CompiledLayer, type LayerJSON} from './style.ts';
import {buildTile, toGL, type TileGL, type TileIR} from './tile.ts';
import {queryTile, type QueriedFeature, type TileQuery} from './query.ts';
import {fetchTile} from './pmtiles.ts';

export interface TileRequest { id: number; source: string; url: string; z: number; overscaled: boolean }

/** Fetches and parses tiles. The same class backs tile workers, the main-thread fallback and server rendering. */
export class TileBuilder {
    private bySource = new Map<string, CompiledLayer[]>();
    private aborts = new Map<number, AbortController>();
    /** Recently fetched tiles, kept so feature queries on visible tiles need no second download. */
    private recent = new Map<string, Uint8Array>();
    constructor(private fetchFn: typeof fetch = (...a) => fetch(...a)) {}

    setStyle(layers: LayerJSON[]) {
        this.bySource.clear();
        for (const json of layers) {
            const l = compileLayer(json);
            if (!l?.source) continue;
            const list = this.bySource.get(l.source);
            if (list) list.push(l); else this.bySource.set(l.source, [l]);
        }
    }

    async loadIR(req: TileRequest): Promise<TileIR> {
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
    setStyle(layers: LayerJSON[]): void;
    load(req: TileRequest): Promise<TileGL>;
    cancel(id: number): void;
    query(url: string, q: TileQuery): Promise<QueriedFeature[]>;
}

export class LocalBackend implements TileBackend {
    private builder = new TileBuilder();
    setStyle(layers: LayerJSON[]) { this.builder.setStyle(layers); }
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
    setStyle(layers: LayerJSON[]) { this.port.postMessage({type: 'style', layers}); }
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
        if (m.type === 'style') builder.setStyle(m.layers);
        else if (m.type === 'cancel') builder.cancel(m.id);
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
