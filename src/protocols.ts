// Custom protocols, as in MapLibre: `addProtocol('name', fn)` makes the library load each URL that starts with
// `name://` through `fn`. The registry is on the page and is the same for every map.

/** A protocol function, with the arguments of MapLibre GL JS. It returns the data of the request. */
export type ProtocolFunction = (request: {url: string; type?: string; headers?: Record<string, string>}, abort: AbortController) => Promise<{data: unknown}>;

export const protocols = new Map<string, ProtocolFunction>();
/** Called when the registry changes, so that each map can tell its threads. */
export const protocolListeners = new Set<() => void>();

let warnedPmtiles = false;
export function addProtocol(name: string, fn: ProtocolFunction) {
    // (Accepted with no effect for `pmtiles://` URLs, so it warns in every build, once per page: the registry is too.)
    if (name == 'pmtiles' && !warnedPmtiles) { warnedPmtiles = true; console.warn('[map-jr-gl] addProtocol("pmtiles"): the library reads pmtiles:// URLs itself and does not use this protocol. Remove the addProtocol call.'); }
    protocols.set(name, fn); for (const f of protocolListeners) f();
}
export function removeProtocol(name: string) { protocols.delete(name); for (const f of protocolListeners) f(); }

/** The data that a protocol returned, as bytes: tiles come as buffers, and JSON as objects or text. */
export function toBytes(data: unknown): ArrayBuffer {
    // (A copy: the bytes go to a worker, and the buffer of the protocol must stay whole. A protocol can give the same
    // buffer for two requests, or keep it.)
    if (data instanceof ArrayBuffer) return data.slice(0);
    if (ArrayBuffer.isView(data)) return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return new TextEncoder().encode(typeof data === 'string' ? data : JSON.stringify(data)).buffer as ArrayBuffer;
}
