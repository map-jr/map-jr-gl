/**
 * Reads tiles straight out of a PMTiles (v3) archive with HTTP range requests, so a whole tileset can sit on plain
 * static hosting. A source points at one with `url: "pmtiles://https://example.com/tiles.pmtiles"`.
 */
type Fetch = typeof fetch;
interface Entry { id: number; offset: number; length: number; run: number }
export interface PMHeader {
    rootOffset: number; rootLength: number; metaOffset: number; metaLength: number; leafOffset: number; dataOffset: number;
    internalCompression: number; tileCompression: number; tileType: number; minZoom: number; maxZoom: number;
}

export const PM_PREFIX = 'pmtiles://';
const TILE_TYPES = ['', 'mvt', 'png', 'jpeg', 'webp', 'avif'];

async function inflate(bytes: Uint8Array, compression: number): Promise<Uint8Array> {
    if (compression <= 1) return bytes;
    if (compression !== 2) throw new Error('PMTiles: the archive must use gzip');
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Tile z/x/y to its position along the archive's Hilbert curve. */
export function tileId(z: number, x: number, y: number): number {
    let id = 0;
    for (let i = 0; i < z; i++) id += 4 ** i;
    let d = 0, tx = x, ty = y;
    for (let s = 2 ** z / 2; s >= 1; s /= 2) {
        const rx = (tx & s) > 0 ? 1 : 0, ry = (ty & s) > 0 ? 1 : 0;
        d += s * s * ((3 * rx) ^ ry);
        if (ry === 0) {
            if (rx === 1) { tx = s - 1 - tx; ty = s - 1 - ty; }
            [tx, ty] = [ty, tx];
        }
    }
    return id + d;
}

function parseDirectory(b: Uint8Array): Entry[] {
    let pos = 0;
    const varint = () => {
        let v = 0, mul = 1, byte;
        do { byte = b[pos++]; v += (byte & 0x7f) * mul; mul *= 128; } while (byte & 0x80);
        return v;
    };
    const n = varint(), entries: Entry[] = [];
    let id = 0;
    for (let i = 0; i < n; i++) { id += varint(); entries.push({id, offset: 0, length: 0, run: 0}); }
    for (const e of entries) e.run = varint();
    for (const e of entries) e.length = varint();
    entries.forEach((e, i) => {
        const v = varint();
        // Zero means "directly after the previous entry", which is how contiguous tiles are stored compactly.
        e.offset = v === 0 && i > 0 ? entries[i - 1].offset + entries[i - 1].length : v - 1;
    });
    return entries;
}

/** The first bytes of archives (header and root directory) that another thread has read already, by URL. */
export const heads = new Map<string, Uint8Array>();

const LIMIT = 64 << 20;
const tooLarge = (url: string, n: number) => new Error(`[map-jr-gl] PMTiles ${url}: the server ignores Range requests, so each tile would download the whole file (${Math.round(n / 1048576)} MB). Serve the file from a server that supports Range requests.`);

export class PMTiles {
    private header?: Promise<{h: PMHeader; root: Entry[]; first: Uint8Array}>;
    private leaves = new Map<number, Promise<Entry[]>>();
    private fetchFn: Fetch;
    /** The whole file, when the server answered a range request with 200. */
    private whole?: Uint8Array;
    constructor(readonly url: string, fetchFn: Fetch = fetch) {
        // Always called as a plain function: browsers and Workers reject a global `fetch` invoked as a method of another object.
        this.fetchFn = (...a) => fetchFn(...a);
    }

    /** `fetchFn`: the requests of one map follow the rules of that map, also for an archive that another map opened. */
    private async range(offset: number, length: number, signal?: AbortSignal, fetchFn = this.fetchFn): Promise<Uint8Array> {
        if (this.whole) return this.whole.subarray(offset, offset + length);
        const res = await fetchFn(this.url, {headers: {Range: `bytes=${offset}-${offset + length - 1}`}, signal});
        if (res.status !== 206 && res.status !== 200) throw new Error(`PMTiles ${this.url}: HTTP ${res.status}`);
        // A server that ignores Range sends the whole file with 200. Keep it (up to 64 MB) and answer later ranges
        // from it, instead of downloading the whole file again for each range.
        const full = res.status === 200, size = +(res.headers.get('content-length') ?? 0);
        if (full && size > LIMIT) { res.body?.cancel(); throw tooLarge(this.url, size); }
        if (!full || !res.body) {
            const bytes = new Uint8Array(await res.arrayBuffer());
            if (!full) return bytes;
            if (bytes.length > LIMIT) throw tooLarge(this.url, bytes.length);
            return (this.whole = bytes).subarray(offset, offset + length);
        }
        // Without Content-Length, read the stream and stop as soon as it passes the limit.
        const reader = res.body.getReader(), parts: Uint8Array[] = [];
        let n = 0;
        for (let r; !(r = await reader.read()).done;) {
            parts.push(r.value);
            if ((n += r.value.length) > LIMIT) { reader.cancel(); throw tooLarge(this.url, n); }
        }
        const bytes = new Uint8Array(n);
        n = 0;
        for (const b of parts) bytes.set(b, n), n += b.length;
        return (this.whole = bytes).subarray(offset, offset + length);
    }

    private open(fetchFn?: Fetch) {
        return this.header ??= (async () => {
            // The header and (almost always) the whole root directory fit in the first 16 KB.
            const first = heads.get(this.url) ?? await this.range(0, 16384, undefined, fetchFn), v = new DataView(first.buffer, first.byteOffset, first.byteLength);
            if (String.fromCharCode(...first.subarray(0, 7)) !== 'PMTiles' || first[7] !== 3) throw new Error(`${this.url} is not a PMTiles v3 archive`);
            const u64 = (o: number) => v.getUint32(o, true) + v.getUint32(o + 4, true) * 2 ** 32;
            const h: PMHeader = {
                rootOffset: u64(8), rootLength: u64(16), metaOffset: u64(24), metaLength: u64(32), leafOffset: u64(40), dataOffset: u64(56),
                internalCompression: first[97], tileCompression: first[98], tileType: first[99], minZoom: first[100], maxZoom: first[101],
            };
            const end = h.rootOffset + h.rootLength;
            const rootBytes = end <= first.length ? first.subarray(h.rootOffset, end) : await this.range(h.rootOffset, h.rootLength, undefined, fetchFn);
            return {h, root: parseDirectory(await inflate(rootBytes, h.internalCompression)), first};
        })().catch(err => { this.header = undefined; throw err; });
    }

    async info() {
        const {h, first} = await this.open(), end = h.metaOffset + h.metaLength, rootEnd = h.rootOffset + h.rootLength;
        // (The metadata is in the first bytes too, for most archives: no second request.)
        const meta = h.metaLength ? JSON.parse(new TextDecoder().decode(await inflate(end <= first.length ? first.subarray(h.metaOffset, end) : await this.range(h.metaOffset, h.metaLength), h.internalCompression))) : {};
        return {type: TILE_TYPES[h.tileType] ?? '', minzoom: h.minZoom, maxzoom: h.maxZoom, attribution: meta.attribution as string | undefined, metadata: meta,
            /** The header and the root directory, for the threads that read the tiles (see `heads`). */
            head: rootEnd <= first.length ? first.slice(0, rootEnd) : undefined};
    }

    /** One tile's bytes (decompressed), or null when the archive has no such tile. */
    async tile(z: number, x: number, y: number, signal?: AbortSignal, fetchFn?: Fetch): Promise<Uint8Array | null> {
        const {h, root} = await this.open(fetchFn), id = tileId(z, x, y);
        let dir = root;
        for (let depth = 0; depth < 4; depth++) {
            // Last entry whose id is not past the one wanted.
            let lo = 0, hi = dir.length - 1, found = -1;
            while (lo <= hi) { const mid = (lo + hi) >> 1; if (dir[mid].id <= id) { found = mid; lo = mid + 1; } else hi = mid - 1; }
            if (found < 0) return null;
            const e = dir[found];
            if (e.run > 0) return id < e.id + e.run ? inflate(await this.range(h.dataOffset + e.offset, e.length, signal, fetchFn), h.tileCompression) : null;
            // A run of zero marks a pointer to a leaf directory covering this part of the curve.
            let leaf = this.leaves.get(e.offset);
            if (!leaf) {
                leaf = this.range(h.leafOffset + e.offset, e.length, undefined, fetchFn).then(b => inflate(b, h.internalCompression)).then(parseDirectory);
                this.leaves.set(e.offset, leaf);
                leaf.catch(() => this.leaves.delete(e.offset));
                if (this.leaves.size > 64) this.leaves.delete(this.leaves.keys().next().value!);
            }
            dir = await leaf;
        }
        return null;
    }
}

const archives = new Map<string, PMTiles>();
export function archive(url: string, fetchFn?: Fetch): PMTiles {
    let a = archives.get(url);
    if (!a) archives.set(url, a = new PMTiles(url, fetchFn));
    return a;
}

/**
 * Fetches a tile by URL, wherever it lives: an ordinary tile URL, or `pmtiles://<archive>/{z}/{x}/{y}` for a tile
 * inside an archive. Returns null for tiles that do not exist.
 */
export async function fetchTile(url: string, fetchFn: Fetch = (...a) => fetch(...a), signal?: AbortSignal, state?: {missing?: boolean}): Promise<Uint8Array | null> {
    if (url.startsWith(PM_PREFIX)) {
        const m = /^pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)$/.exec(url);
        if (!m) throw new Error(`Malformed PMTiles tile address: ${url}`);
        return archive(m[1], fetchFn).tile(+m[2], +m[3], +m[4], signal, fetchFn);
    }
    const res = await fetchFn(url, {signal});
    // 404: the server does not have the tile (`state.missing`). 204: the server has the tile, and the tile is empty.
    if (res.status === 404 || res.status === 204) { if (state) state.missing = res.status > 204; return null; }
    if (!res.ok) throw new Error(`Tile ${url}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}
