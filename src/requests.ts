// Requests that the page can change: `transformRequest` (a new URL, headers, credentials) and custom protocols
// (`addProtocol`). The functions for these are on the page, but most requests are made in workers. A worker asks the
// page only when a rule says that it must, so maps without these features pay nothing.

/** What a thread knows about the page's request functions: if there is a transform, and which protocols are registered. */
export interface RequestRules { transform: boolean; protocols: string[] }
/** The page's answer for one request: where and how to fetch it, or the data itself (from a protocol). */
export interface RequestAnswer { url?: string; headers?: Record<string, string>; credentials?: RequestCredentials; data?: ArrayBuffer; error?: string }
export type Ask = (url: string, kind: string) => Promise<RequestAnswer>;

/** A `fetch` that follows the rules: it asks first when the page has something to say about the request. */
export function fetchWith(rules: () => RequestRules | undefined, ask: Ask, kind = 'Tile'): typeof fetch {
    return async (input, init) => {
        const url = String(input), r = rules();
        if (!r || !(r.transform || r.protocols.includes(url.slice(0, url.indexOf(':'))))) return fetch(input, init);
        const a = await ask(url, kind);
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
        const ac = new AbortController();
        // (The timer is not cleared when the headers arrive: an abort also ends a body that never finishes.)
        setTimeout(() => ac.abort(), ms);
        return Promise.race([f(input, {...init, signal: ac.signal}), new Promise<never>((_, fail) => ac.signal.addEventListener('abort',
            () => fail(new Error(`[map-jr-gl] the request to ${input} did not finish within ${ms} ms.`))))]);
    };
}
