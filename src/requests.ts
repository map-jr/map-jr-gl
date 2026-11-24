// Requests that the page can change: `transformRequest` (a new URL, headers, credentials) and custom protocols
// (`addProtocol`). The functions for these are on the page, but most requests are made in workers. A worker asks the
// page only when a rule says that it must, so maps without these features pay nothing.

/** What a thread knows about the page's request functions: if there is a transform, and which protocols are registered. */
export interface RequestRules { transform: boolean; protocols: string[] }
/** The page's answer for one request: where and how to fetch it, or the data itself (from a protocol). */
export interface RequestAnswer { url?: string; headers?: Record<string, string>; credentials?: RequestCredentials; data?: ArrayBuffer | ImageBitmap; error?: string }
/** The options of a request for an image tile (`raster`, `raster-dem`). */
export type ImageInit = RequestInit & {image?: boolean};
export type Ask = (url: string, kind: string, signal?: AbortSignal | null) => Promise<RequestAnswer>;

/** A `fetch` that follows the rules: it asks first when the page has something to say about the request. */
export function fetchWith(rules: () => RequestRules | undefined, ask: Ask, kind = 'Tile'): typeof fetch {
    const run = fetchRules(rules, ask, kind);
    // A request that fails (no network, a blocked origin) says which resource and URL it was for. The URL is cut, because it comes from a style.
    return (input, init) => run(input, init).catch(e => {
        if (e?.name === 'AbortError' || String(e?.message).startsWith('[map-jr-gl]')) throw e;
        throw Object.assign(requestError(KINDS[kind] ?? kind, String(input), e?.message ?? e, e), {final: e?.final});
    });
}
/** The error of a request that failed: it names the resource, the URL (cut, because it comes from a style) and the reason. */
export const requestError = (what: string, url: string, reason: unknown, cause?: unknown) => new Error(`[map-jr-gl] the request for the ${what} ${url.length > 200 ? url.slice(0, 200) + '...' : url} failed: ${reason}`, {cause});
/** The error of a response with an HTTP error status. */
export const httpError = (what: string, url: string, status: number) => requestError(what, url, 'HTTP ' + status);
/**
 * Whether a failed request would fail again: an HTTP status 4xx, or a rejection by a custom protocol or by
 * `transformRequest`. A network error and an HTTP status 5xx are worth another request (#652). Such an error has
 * `final: true`, also after it crossed from a tile worker. The message is read for an error that comes from elsewhere.
 */
export const finalFailure = (err: {final?: boolean; message?: unknown}) => !!err.final || /HTTP 4\d\d\b|: the protocol rejected it: |: transformRequest threw: /.test(String(err.message));
const KINDS: Record<string, string> = {Tile: 'tile', RasterTile: 'tile', SpriteJSON: 'sprite', SpriteImage: 'sprite image', Glyphs: 'glyphs', Font: 'font', Image: 'image'};
function fetchRules(rules: () => RequestRules | undefined, ask: Ask, kind: string): typeof fetch {
    return async (input, init) => {
        const url = String(input), r = rules();
        if (!r || !(r.transform || r.protocols.includes(url.slice(0, url.indexOf(':'))))) return fetch(input, init);
        // (The kind `RasterTile` is `Tile` for `transformRequest`, and a protocol gets the request type `image` for it.)
        const a = await ask(url, (init as ImageInit | undefined)?.image ? 'RasterTile' : kind, init?.signal);
        // (The engine does not request again after a rejection: see `finalFailure`.)
        // (A request that is no longer wanted stays an abort, which is not an error of the map.)
        if (a.error && init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
        if (a.error) throw Object.assign(new Error(r.protocols.includes(url.slice(0, url.indexOf(':'))) ? `the protocol rejected it: ${a.error}` : `transformRequest threw: ${a.error}`), {final: true});
        // (A response cannot hold an image that a protocol returned: `fetchTile` reads it from the member `image`.)
        if (a.data) return a.data instanceof ArrayBuffer ? new Response(a.data) : Object.assign(new Response(), {image: a.data});
        return fetch(a.url ?? url, {...init, headers: {...a.headers, ...(init?.headers as Record<string, string> | undefined)}, credentials: a.credentials});
    };
}

/**
 * A `fetch` that fails when the response, its body included, has not arrived after `ms` milliseconds. The request is
 * aborted, and the promise rejects as a failed request does, so the map goes on without the file.
 */
export function withTimeout(f: typeof fetch, ms = 30000): typeof fetch {
    return (input, init) => {
        const ac = new AbortController(), outer = init?.signal;
        const timer = setTimeout(() => ac.abort(new Error(`[map-jr-gl] the request to ${input} did not finish within ${ms} ms.`)), ms), done = () => clearTimeout(timer);
        ac.signal.addEventListener('abort', done);
        // An abort by the caller (a tile that is no longer needed) still ends the request.
        if (outer) outer.aborted ? ac.abort(outer.reason) : outer.addEventListener('abort', () => ac.abort(outer.reason));
        return Promise.race([f(input, {...init, signal: ac.signal}), new Promise<never>((_, fail) => ac.signal.addEventListener('abort', () => fail(ac.signal.reason)))]).then(res => {
            // The timer runs on until the body has been read (an abort also ends a body that never finishes), and stops then (#415).
            if (!res.body) return done(), res;
            for (const m of ['arrayBuffer', 'json', 'text', 'blob'] as const) {
                const read = res[m];
                Object.defineProperty(res, m, {value: () => read.call(res).finally(done)});
            }
            return res;
        }, e => { done(); throw e; });
    };
}
