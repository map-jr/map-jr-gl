import {part} from './parts.ts';
import {httpError, requestError} from './requests.ts';

type Fetch = typeof fetch;
/**
 * What a fetch of a tile tells its caller: `missing` for a tile that the server does not have (404), and `expires`,
 * the time (`Date.now()`) after which the tile is out of date. As in MapLibre GL JS, `max-age` of `Cache-Control` gives
 * it, or else `Expires` when the response has no `Cache-Control`. `etag` is the `ETag` of the response: a reload that the
 * server answers with 304 (not modified) reaches the page as a 200 with the same `ETag` (#2136).
 */
export interface TileFetchState { missing?: boolean; expires?: number; etag?: string }
export const PM_PREFIX = 'pmtiles://';

/** The first bytes of PMTiles archives (header and root directory) that another thread has read already, by URL. */
export const heads = new Map<string, Uint8Array>();

/**
 * Fetches a tile by URL, wherever it lives: an ordinary tile URL, or `pmtiles://<archive>/{z}/{x}/{y}` for a tile
 * inside an archive (the PMTiles reader is a part, see parts.ts). Returns null for tiles that do not exist.
 */
export async function fetchTile(url: string, fetchFn?: Fetch, signal?: AbortSignal, state?: TileFetchState): Promise<Uint8Array | null>;
/** With `image`, the tile is an image (`raster`, `raster-dem`): a custom protocol can return it decoded, as an `ImageBitmap`. */
export async function fetchTile(url: string, fetchFn: Fetch | undefined, signal: AbortSignal | undefined, state: TileFetchState | undefined, image: true): Promise<Uint8Array | ImageBitmap | null>;
export async function fetchTile(url: string, fetchFn: Fetch = (...a) => fetch(...a), signal?: AbortSignal, state?: TileFetchState, image?: boolean): Promise<Uint8Array | ImageBitmap | null> {
    if (url.startsWith(PM_PREFIX)) {
        const m = /^pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)$/.exec(url);
        if (!m) throw new Error(`Malformed PMTiles tile address: ${url}`);
        return (await part('pmtiles')).archive(m[1], fetchFn).tile(+m[2], +m[3], +m[4], signal, fetchFn);
    }
    const res: Response & {image?: ImageBitmap} = await fetchFn(url, image ? {signal, image} as RequestInit : {signal});
    // 404: the server does not have the tile (`state.missing`). 204: the server has the tile, and the tile is empty.
    if (res.status === 404 || res.status === 204) { if (state) state.missing = res.status > 204; return null; }
    const cc = res.headers?.get('cache-control'), age = cc && +/max-age="?(\d+)/i.exec(cc)?.[1]!, exp = !cc && res.headers?.get('expires');
    if (state && (age || exp)) state.expires = age ? Date.now() + age * 1e3 : Date.parse(exp as string);
    if (state) state.etag = res.headers?.get('etag') ?? undefined;
    // (A status 5xx is worth another request: the engine requests a tile of the view again, see `finalFailure`.)
    if (!res.ok) throw Object.assign(res.status < 500 ? httpError('tile', url, res.status) : requestError('tile', url, `HTTP ${res.status}. The tile server answered with an error. Check the server; the map requests a tile that the view needs again.`), {final: res.status < 500});
    return res.image ?? new Uint8Array(await res.arrayBuffer());
}
