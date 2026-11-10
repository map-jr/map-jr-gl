import {compileLayer, type CompiledLayer, type LayerJSON} from './style.ts';
import {buildTile, toGL, type TileGL, type TileIR} from './tile.ts';

export interface TileRequest { id: number; source: string; url: string; z: number; overscaled: boolean }

/** Fetches and parses tiles. The same class backs tile workers, the main-thread fallback and server rendering. */
export class TileBuilder {
    private bySource = new Map<string, CompiledLayer[]>();
    private aborts = new Map<number, AbortController>();
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
            const res = await this.fetchFn(req.url, {signal: ac.signal});
            if (res.status === 404 || res.status === 204) return {layers: {}, labels: {}};
            if (!res.ok) throw new Error(`Tile ${req.url}: HTTP ${res.status}`);
            const bytes = new Uint8Array(await res.arrayBuffer());
            return bytes.length ? buildTile(bytes, req.z, this.bySource.get(req.source) ?? [], req.overscaled) : {layers: {}, labels: {}};
        } finally {
            this.aborts.delete(req.id);
        }
    }

    cancel(id: number) { this.aborts.get(id)?.abort(); }
}

/** What the engine needs from wherever tiles are built. */
export interface TileBackend {
    setStyle(layers: LayerJSON[]): void;
    load(req: TileRequest): Promise<TileGL>;
    cancel(id: number): void;
}

export class LocalBackend implements TileBackend {
    private builder = new TileBuilder();
    setStyle(layers: LayerJSON[]) { this.builder.setStyle(layers); }
    async load(req: TileRequest) { return toGL(await this.builder.loadIR(req)).tile; }
    cancel(id: number) { this.builder.cancel(id); }
}

type Port = {postMessage(msg: any, transfer?: Transferable[]): void; onmessage: ((e: MessageEvent) => void) | null};

/** Talks to a tile worker over a MessagePort, so the engine can sit on the main thread or in its own worker. */
export class PortBackend implements TileBackend {
    private pending = new Map<number, {resolve(t: TileGL): void; reject(e: Error): void}>();
    constructor(private port: Port) {
        port.onmessage = e => {
            const p = this.pending.get(e.data.id);
            if (!p) return;
            this.pending.delete(e.data.id);
            if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.tile);
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
}

/** Worker side of PortBackend. */
export function serveTiles(port: Port) {
    const builder = new TileBuilder();
    port.onmessage = async e => {
        const m = e.data;
        if (m.type === 'style') builder.setStyle(m.layers);
        else if (m.type === 'cancel') builder.cancel(m.id);
        else if (m.type === 'load') {
            try {
                const {tile, transfer} = toGL(await builder.loadIR(m.req));
                port.postMessage({id: m.req.id, tile}, transfer);
            } catch (err) {
                port.postMessage({id: m.req.id, error: (err as Error).name === 'AbortError' ? 'aborted' : String((err as Error).message)});
            }
        }
    };
}
