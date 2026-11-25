/**
 * How the library finds and starts its workers. The default needs no configuration: the worker file is looked for
 * next to this module. Everything can be overridden per map or globally with `configure()`.
 */
import {LOSE_CONTEXT} from './gl-names.ts';
import {globeStops} from './geo.ts';

declare const __WORKER_SRC__: string; // the worker's source, embedded only in the standalone build
declare const __VERSION__: string; // the version of package.json, set by the build

let canDraw: boolean | undefined;
/**
 * Whether this browser can show a map: it needs WebGL2. Call it before you make a map, to show other content instead.
 * (The first call makes a WebGL2 context on a canvas that is not in the page and releases it at once. Later calls
 * return the same answer.)
 */
export function supported(): boolean {
    if (canDraw === undefined) {
        try {
            const gl = document.createElement('canvas').getContext('webgl2');
            canDraw = !!gl;
            gl?.getExtension(LOSE_CONTEXT)?.loseContext();
        } catch { canDraw = false; }
    }
    return canDraw;
}

/** How the library loads its workers, for `configure`. */
export interface LoadOptions {
    /**
     * The URL of the worker file, `map-jr-gl-worker.js`. The parts of the worker (`map-jr-gl-worker-*.js`) must be in
     * the same folder.
     * @default the file next to the module of the library
     */
    workerUrl?: string | URL;
    /**
     * A function that creates the worker, for a bundler that imports workers its own way (`new Worker(new URL(...))`,
     * `?worker` of Vite). It overrides `workerUrl`.
     */
    createWorker?: () => Worker;
    /**
     * The number of workers that parse tiles, shared by all maps of the page. A change has no effect while a map of the
     * page uses workers of the same `workerUrl` or `createWorker`.
     * @default the number of CPU cores less 2, from 1 to 4
     */
    tileWorkers?: number;
    /**
     * The thread that renders a map whose description has no `renderer`.
     * @default 'auto'
     */
    renderer?: 'auto' | 'worker' | 'main';
}

export const defaults: LoadOptions = {};
/** Whether `configure` has warned that a new `tileWorkers` has no effect (once per page, as the pool is). */
let warnedCount = false;
/**
 * Sets how the library loads its workers, for the maps that are created after the call.
 * @param options The options to set. An option that is left out keeps its value.
 */
export function configure(options: LoadOptions) {
    Object.assign(defaults, options);
    // (A new workerUrl or createWorker makes the next map start a new pool, which takes the new count.)
    const n = options.tileWorkers;
    if (n !== undefined && pool && pool.key === poolKey({}) && pool.count !== n && !warnedCount) {
        warnedCount = true;
        console.warn(`[map-jr-gl] configure(): tileWorkers: ${n} has no effect while a map uses the ${pool.count} tile workers that exist. Call configure() before the first map is created, or destroy every map first.`);
    }
}

/** The worker file's URL, or nothing when a `createWorker` function or the standalone build makes the worker. */
function workerHref(o: LoadOptions): string | undefined {
    const url = o.workerUrl ?? defaults.workerUrl;
    if (o.createWorker ?? defaults.createWorker ?? (!url && __WORKER_SRC__)) return;
    // (The marker comment stops this library's own build from rewriting the line; it is not in the published file.)
    return new URL(url ?? new URL(/* @vite-ignore */ './map-jr-gl-worker.js', import.meta.url), location.href).href;
}

/**
 * The URLs of the parts of the worker that load on demand (src/parts.ts), for the worker to load when a map needs one.
 * They are next to `workerUrl` when it is given, and otherwise next to this module, where a bundler that copies the
 * worker file copies them too. The standalone build has them inside its worker.
 */
export function partUrls(o: LoadOptions): Record<string, string> | undefined {
    const url = o.workerUrl ?? defaults.workerUrl;
    if (!url && !(o.createWorker ?? defaults.createWorker) && __WORKER_SRC__) return;
    const page = globalThis.location?.href ?? import.meta.url, folder = (u: URL) => /^(https?|file):$/.test(u.protocol);
    // A workerUrl that has no folder (a blob: or data: URL) takes the parts next to this module.
    let base: URL | undefined;
    try { base = url ? new URL(url, page) : undefined; } catch { /* the default below */ }
    const at = (name: string, own: () => URL) => {
        try { const u = base && folder(base) ? new URL(`map-jr-gl-worker-${name}.js`, base) : own(); return folder(u) ? u.href : undefined; } catch { return undefined; }
    };
    // (Each URL is written out, so that a bundler finds it. The marker comment stops this library's own build from rewriting the line.
    // `?no-inline` keeps Vite from putting a file under 4 KB into the page script as a `data:` URL; a server ignores it.)
    const out = {
        geojson: at('geojson', () => new URL(/* @vite-ignore */ './map-jr-gl-worker-geojson.js?no-inline', import.meta.url)),
        dem: at('dem', () => new URL(/* @vite-ignore */ './map-jr-gl-worker-dem.js?no-inline', import.meta.url)),
        pmtiles: at('pmtiles', () => new URL(/* @vite-ignore */ './map-jr-gl-worker-pmtiles.js?no-inline', import.meta.url)),
        within: at('within', () => new URL(/* @vite-ignore */ './map-jr-gl-worker-within.js?no-inline', import.meta.url)),
        globe: at('globe', () => new URL(/* @vite-ignore */ './map-jr-gl-worker-globe.js?no-inline', import.meta.url)),
        subdivide: at('subdivide', () => new URL(/* @vite-ignore */ './map-jr-gl-worker-subdivide.js?no-inline', import.meta.url)),
    };
    if (!out.geojson && !warnedParts) {
        warnedParts = true;
        console.warn('[map-jr-gl] workerUrl: the parts of the worker (map-jr-gl-worker-*.js) have no URL, because neither workerUrl nor the module of the library is a URL of a folder. A map with a GeoJSON, contour or PMTiles source, with 3D terrain or with a globe cannot draw it. Set workerUrl to an http(s) URL of map-jr-gl-worker.js, with the parts in the same folder.');
    }
    return out as Record<string, string>;
}
let warnedParts = false;

/**
 * The code of the parts of the worker, fetched once on the page by URL and shared by every map and tile worker of the
 * page, as a blob URL (null when the fetch failed: each worker then fetches the part itself). The fetch starts as soon
 * as the style is there, in parallel with the worker file, and not when a tile worker first needs the part (#79).
 */
const partCode = new globalThis.Map<string, Promise<string | null>>();
/**
 * Starts to fetch the parts that a style (as written) needs: see `partsFor` in engine.ts. 3D terrain needs the part
 * `dem` too, and a globe the part `globe`, in the engine worker (`engineWorker`; #1849, #2006). An engine on the page loads the chunk of that part instead.
 * A globe also needs the part `subdivide` in the tile workers (#2075).
 */
export function prefetchParts(o: LoadOptions, style: {sources?: Record<string, {type?: string; url?: unknown; tiles?: unknown}>; terrain?: unknown; projection?: {type?: unknown}}, engineWorker: boolean) {
    const urls = partUrls(o);
    if (!urls) return;
    const names: string[] = Object.values(style?.sources ?? {}).map(s => s?.type === 'geojson' ? 'geojson' : s?.type === 'contour' ? 'dem'
        : [s?.url, ...(Array.isArray(s?.tiles) ? s.tiles : [])].some(u => typeof u === 'string' && u.startsWith('pmtiles://')) ? 'pmtiles' : '');
    if (style?.terrain && engineWorker) names.push('dem');
    // (The tile workers cut the tiles of a globe with the part `subdivide`, also when the engine is on the page.)
    if (globeStops(style?.projection?.type)) names.push('subdivide', ...engineWorker ? ['globe'] : []);
    for (const name of names) {
        const url = urls[name];
        if (!url || partCode.has(url)) continue;
        partCode.set(url, fetch(url).then(r => r.ok ? r.text() : null)
            .then(t => t === null ? null : URL.createObjectURL(new Blob([t, `\n//# sourceMappingURL=${url.replace(/[?#].*/, '')}.map`], {type: 'text/javascript'})), () => null));
    }
}

/**
 * The parts that the page fetches (`prefetchParts`), for workers that start: their names, which go with the first message
 * to each worker, and then their code to each worker when it arrives.
 */
export function partsComing(o: LoadOptions, workers: {postMessage(m: unknown): void}[]): string[] {
    const coming = Object.entries(partUrls(o) ?? {}).filter(([, url]) => partCode.has(url));
    for (const [name, url] of coming) partCode.get(url)!.then(code => { for (const w of workers) w.postMessage({role: 'part', name, code}); });
    return coming.map(([n]) => n);
}

/**
 * The worker file, fetched once and kept as a blob URL so that the start-up workers share one request (#325). The URL
 * is revoked 10 s after the last worker that uses it has started or failed, never while a worker still loads it (#782).
 */
const fetched = new globalThis.Map<string, {url: Promise<string>; pending: number; timer?: ReturnType<typeof setTimeout>}>();
/** Worker URLs whose blob worker failed (a `worker-src` policy without `blob:`): later workers start from the URL. */
const noBlob = new Set<string>();
/**
 * Starts a worker and resolves once it runs. The tile workers and the engine worker start in parallel from one fetch
 * of the worker file. If that fetch or the worker from the blob fails (CORS, a `worker-src` policy without `blob:`),
 * the worker starts from its URL as before, and later workers of that URL start from it directly.
 */
export function startWorker(o: LoadOptions = {}): Promise<Worker> {
    const href = workerHref(o), plain = () => workerReady(createWorker(o));
    if (!href || !/^https?:/.test(href) || noBlob.has(href)) return plain();
    let e = fetched.get(href);
    if (!e) {
        // (The source map comment of the file is relative, and a blob: URL cannot resolve it: the blob gets an absolute one.)
        const url = fetch(href).then(r => r.ok ? r.blob() : Promise.reject())
            .then(b => URL.createObjectURL(new Blob([b, `\n//# sourceMappingURL=${href}.map`], {type: 'text/javascript'})));
        fetched.set(href, e = {url, pending: 0});
        url.catch(() => fetched.delete(href));
    }
    const entry = e;
    entry.pending++;
    clearTimeout(entry.timer);
    const settle = () => {
        if (--entry.pending) return;
        entry.timer = setTimeout(() => {
            if (fetched.get(href) === entry) fetched.delete(href);
            entry.url.then(u => URL.revokeObjectURL(u), () => {});
        }, 10000);
    };
    const started = entry.url.then(u => workerReady(new Worker(u)));
    started.then(settle, settle);
    return started.catch(() => { noBlob.add(href); return plain(); });
}

/** Revokes a blob URL once the worker that loads it has answered or failed: Firefox loads it after `new Worker` returns. */
function revokeWhenLoaded(w: Worker, url: string) {
    const done = () => { URL.revokeObjectURL(url); w.removeEventListener('message', done); w.removeEventListener('error', done); };
    w.addEventListener('message', done);
    w.addEventListener('error', done);
}

export function createWorker(o: LoadOptions = {}): Worker {
    const custom = o.createWorker ?? defaults.createWorker;
    if (custom) return custom();
    let url = o.workerUrl ?? defaults.workerUrl;
    if (!url && __WORKER_SRC__) {
        // Standalone build: the worker travels inside this file.
        const blob = URL.createObjectURL(new Blob([__WORKER_SRC__], {type: 'text/javascript'})), w = new Worker(blob);
        revokeWhenLoaded(w, blob);
        return w;
    }
    // Bundlers that understand this pattern copy the worker file and rewrite the URL; loaded directly, it is simply the sibling file.
    // (The marker comment stops this library's own build from rewriting the line; it is not in the published file.)
    url ??= new URL(/* @vite-ignore */ './map-jr-gl-worker.js', import.meta.url);
    const abs = new URL(url, location.href);
    if (abs.origin === location.origin || abs.protocol === 'blob:' || abs.protocol === 'data:') return new Worker(abs);
    // Browsers refuse to start a worker from another origin (a CDN, say), but a same-origin stub may import one.
    const stub = URL.createObjectURL(new Blob([`importScripts(${JSON.stringify(abs.href)});`], {type: 'text/javascript'})), w = new Worker(stub);
    revokeWhenLoaded(w, stub);
    return w;
}

/** The warning about a worker file of another version, when it was given: the page gets it once. */
let mismatch = '';
/** Resolves once the worker's script has loaded and run; rejects if it fails to (missing file, blocked by policy). */
export function workerReady(w: Worker, timeout = 8000): Promise<Worker> {
    return new Promise((resolve, reject) => {
        const done = (err?: Error) => { clearTimeout(timer); w.removeEventListener('message', onMessage); w.removeEventListener('error', onError); if (err) { w.terminate(); reject(err); } else resolve(w); };
        const onMessage = (e: MessageEvent) => {
            if (e.data?.type !== 'hello') return;
            // The page file and the worker file can come from two versions of the package (a CDN, a cache, a copy that
            // was not replaced). Messages between them can then differ, so the page says it, once.
            const v = e.data.version;
            if (v !== __VERSION__ && !mismatch) console.warn(mismatch = `[map-jr-gl] The worker file is version ${v ?? 'unknown'} and the page file is version ${__VERSION__}. Serve map-jr-gl-worker.js from the same version of the package as the page file, or pass \`workerUrl\` with the URL of that file.`);
            done();
        };
        const onError = (e: ErrorEvent) => done(new Error(e.message || 'the worker script could not be loaded'));
        const timer = setTimeout(() => done(new Error('the worker did not start')), timeout);
        w.addEventListener('message', onMessage);
        w.addEventListener('error', onError);
    });
}

/** Tile workers are shared by every map on the page: a dozen maps should not mean four dozen workers. */
/** Numbers the channels to the tile workers, so a tile worker can close the end of one; unique on the page. */
let channels = 0;
/** The pool of tile workers is shared by the maps that make their workers the same way. */
const poolKey = (o: LoadOptions): unknown => o.createWorker ?? defaults.createWorker ?? String(o.workerUrl ?? defaults.workerUrl ?? '');
let pool: {key: unknown; count: number; workers: Promise<Worker[]>; users: number} | null = null;
export async function acquireTileWorkers(o: LoadOptions): Promise<{connect(): MessagePort[]; wake(): void; release(): void}> {
    const key = poolKey(o);
    if (!pool || pool.key !== key) {
        const count = o.tileWorkers ?? defaults.tileWorkers ?? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
        const mine = pool = {key, count, users: 0, workers: Promise.all(Array.from({length: count}, () => startWorker(o)))};
        mine.workers.catch(() => { if (pool === mine) pool = null; });
    }
    const mine = pool, workers = await mine.workers;
    mine.users++;
    let ports: MessagePort[] = [], ids: number[] = [];
    const parts = partUrls(o);
    // The tile-worker end of a port that went to an engine worker can only be closed by the tile worker (#838).
    const drop = () => { for (const id of ids) for (const w of workers) w.postMessage({role: 'drop', id}); };
    return {
        connect() {
            drop();
            // Each map talks to each worker over its own channel, so their styles and requests stay separate.
            ids = workers.map(() => ++channels);
            // (The parts that the page fetches for this style go to each worker when they arrive; the worker waits for them.)
            const coming = partsComing(o, workers);
            ports = workers.map((w, i) => { const ch = new MessageChannel(); w.postMessage({role: 'tiles', port: ch.port1, id: ids[i], parts, coming}, [ch.port1]); return ch.port2; });
            return ports;
        },
        // WebKit can hold a message on the port of a worker that has been idle for a few seconds for about a second
        // (#824). A message to the worker itself wakes it, and the message on the port then arrives at once. The map
        // wakes the workers when it asks a query, so that a `click` listener has the features in time.
        wake() { for (const w of workers) w.postMessage(0); },
        release() {
            for (const p of ports) { try { p.postMessage({type: 'close'}); p.close(); } catch { /* already transferred to the engine worker */ } }
            drop();
            // A pool that a map with another worker URL replaced is shared no more, so its last map ends it too.
            if (--mine.users <= 0) { for (const w of workers) w.terminate(); if (pool === mine) pool = null; }
        },
    };
}
