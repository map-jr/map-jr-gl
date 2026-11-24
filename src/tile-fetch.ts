import {part} from './parts.ts';

type Fetch = typeof fetch;
export const PM_PREFIX = 'pmtiles://';

/** The first bytes of PMTiles archives (header and root directory) that another thread has read already, by URL. */
export const heads = new Map<string, Uint8Array>();

/**
 * Fetches a tile by URL, wherever it lives: an ordinary tile URL, or `pmtiles://<archive>/{z}/{x}/{y}` for a tile
 * inside an archive (the PMTiles reader is a part, see parts.ts). Returns null for tiles that do not exist.
 */
export async function fetchTile(url: string, fetchFn?: Fetch, signal?: AbortSignal, state?: {missing?: boolean}): Promise<Uint8Array | null>;
/** With `image`, the tile is an image (`raster`, `raster-dem`): a custom protocol can return it decoded, as an `ImageBitmap`. */
export async function fetchTile(url: string, fetchFn: Fetch | undefined, signal: AbortSignal | undefined, state: {missing?: boolean} | undefined, image: true): Promise<Uint8Array | ImageBitmap | null>;
export async function fetchTile(url: string, fetchFn: Fetch = (...a) => fetch(...a), signal?: AbortSignal, state?: {missing?: boolean}, image?: boolean): Promise<Uint8Array | ImageBitmap | null> {
    if (url.startsWith(PM_PREFIX)) {
        const m = /^pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)$/.exec(url);
        if (!m) throw new Error(`Malformed PMTiles tile address: ${url}`);
        return (await part('pmtiles')).archive(m[1], fetchFn).tile(+m[2], +m[3], +m[4], signal, fetchFn);
    }
    const res: Response & {image?: ImageBitmap} = await fetchFn(url, image ? {signal, image} as RequestInit : {signal});
    // 404: the server does not have the tile (`state.missing`). 204: the server has the tile, and the tile is empty.
    if (res.status === 404 || res.status === 204) { if (state) state.missing = res.status > 204; return null; }
    if (!res.ok) throw Object.assign(new Error(`Tile ${url}: HTTP ${res.status}`), {final: res.status < 500});
    return res.image ?? new Uint8Array(await res.arrayBuffer());
}
