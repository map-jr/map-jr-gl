// Requests that the page can change: `transformRequest` (a new URL, headers, credentials) and custom protocols
// (`addProtocol`). The functions for these are on the page, but most requests are made in workers. A worker asks the
// page only when a rule says that it must, so maps without these features pay nothing.

/** What a thread knows about the page's request functions: if there is a transform, and which protocols are registered. */
export interface RequestRules { transform: boolean; protocols: string[] }
/** The page's answer for one request: where and how to fetch it, or the data itself (from a protocol). */
export interface RequestAnswer { url?: string; headers?: Record<string, string>; credentials?: RequestCredentials; data?: ArrayBuffer; error?: string }
export type Ask = (url: string, kind: string, signal?: AbortSignal | null) => Promise<RequestAnswer>;

/** A `fetch` that follows the rules: it asks first when the page has something to say about the request. */
export function fetchWith(rules: () => RequestRules | undefined, ask: Ask, kind = 'Tile'): typeof fetch {
    return async (input, init) => {
        const url = String(input), r = rules();
        if (!r || !(r.transform || r.protocols.includes(url.slice(0, url.indexOf(':'))))) return fetch(input, init);
        const a = await ask(url, kind, init?.signal);
        if (a.error) throw new Error(a.error);
        if (a.data) return new Response(a.data);
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
