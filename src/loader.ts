/**
 * How the library finds and starts its workers. The default needs no configuration: the worker file is looked for
 * next to this module. Everything can be overridden per map or globally with `configure()`.
 */
declare const __WORKER_SRC__: string; // the worker's source, embedded only in the standalone build
declare const __VERSION__: string; // the version of package.json, set by the build

let canDraw: boolean | undefined;
/**
 * Whether this browser can show a map: it needs WebGL2. Call it before you make a map, to show other content instead.
 * (The first call makes a WebGL2 context on a canvas that is not in the page. Later calls return the same answer.)
 */
export function supported(): boolean {
    try { canDraw ??= !!document.createElement('canvas').getContext('webgl2'); } catch { canDraw = false; }
    return canDraw;
}

export interface LoadOptions {
    /** URL of the worker script (map-jr-gl-worker.js). Defaults to the file beside the library's own module. */
    workerUrl?: string | URL;
    /**
     * Creates a worker yourself, for full control: bundler-specific imports (`new Worker(new URL(...), ...)`,
     * Vite's `?worker`), a nonce, or a pre-warmed worker. Takes precedence over `workerUrl`.
     */
    createWorker?: () => Worker;
    /** How many workers parse tiles, shared by all maps on the page. Defaults to 1-4 depending on the device. */
    tileWorkers?: number;
    /** The thread that draws, for maps that do not say it themselves: `'auto'` (the default), `'worker'` or `'main'`. */
    renderer?: 'auto' | 'worker' | 'main';
}

export const defaults: LoadOptions = {};
/** Sets page-wide defaults for how workers are loaded. Individual maps can still override them. */
export function configure(options: LoadOptions) { Object.assign(defaults, options); }

/** The worker file's URL, or nothing when a `createWorker` function or the standalone build makes the worker. */
function workerHref(o: LoadOptions): string | undefined {
    const url = o.workerUrl ?? defaults.workerUrl;
    if (o.createWorker ?? defaults.createWorker ?? (!url && __WORKER_SRC__)) return;
    // (The marker comment stops this library's own build from rewriting the line; it is not in the published file.)
    return new URL(url ?? new URL(/* @vite-ignore */ './map-jr-gl-worker.js', import.meta.url), location.href).href;
}

/** The worker file, fetched once and kept as a blob URL for a few seconds, so that the start-up workers share one request (#325). */
const fetched = new globalThis.Map<string, Promise<string>>();
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
    let blob = fetched.get(href);
    if (!blob) {
        // (The source map comment of the file is relative, and a blob: URL cannot resolve it: the blob gets an absolute one.)
        fetched.set(href, blob = fetch(href).then(r => r.ok ? r.blob() : Promise.reject())
            .then(b => URL.createObjectURL(new Blob([b, `\n//# sourceMappingURL=${href}.map`], {type: 'text/javascript'}))));
        blob.then(u => setTimeout(() => { URL.revokeObjectURL(u); fetched.delete(href); }, 10000), () => fetched.delete(href));
    }
    return blob.then(u => workerReady(new Worker(u))).catch(() => { noBlob.add(href); return plain(); });
}

export function createWorker(o: LoadOptions = {}): Worker {
    const custom = o.createWorker ?? defaults.createWorker;
    if (custom) return custom();
    let url = o.workerUrl ?? defaults.workerUrl;
    if (!url && __WORKER_SRC__) {
        // Standalone build: the worker travels inside this file.
        const blob = URL.createObjectURL(new Blob([__WORKER_SRC__], {type: 'text/javascript'})), w = new Worker(blob);
        setTimeout(() => URL.revokeObjectURL(blob), 10000);
        return w;
    }
    // Bundlers that understand this pattern copy the worker file and rewrite the URL; loaded directly, it is simply the sibling file.
    // (The marker comment stops this library's own build from rewriting the line; it is not in the published file.)
    url ??= new URL(/* @vite-ignore */ './map-jr-gl-worker.js', import.meta.url);
    const abs = new URL(url, location.href);
    if (abs.origin === location.origin || abs.protocol === 'blob:' || abs.protocol === 'data:') return new Worker(abs);
    // Browsers refuse to start a worker from another origin (a CDN, say), but a same-origin stub may import one.
    const stub = URL.createObjectURL(new Blob([`importScripts(${JSON.stringify(abs.href)});`], {type: 'text/javascript'})), w = new Worker(stub);
    setTimeout(() => URL.revokeObjectURL(stub), 10000);
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
let pool: {key: unknown; workers: Promise<Worker[]>; users: number} | null = null;
export async function acquireTileWorkers(o: LoadOptions): Promise<{connect(): MessagePort[]; release(): void}> {
    const key = o.createWorker ?? defaults.createWorker ?? String(o.workerUrl ?? defaults.workerUrl ?? '');
    if (!pool || pool.key !== key) {
        const count = o.tileWorkers ?? defaults.tileWorkers ?? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2));
        const mine = pool = {key, users: 0, workers: Promise.all(Array.from({length: count}, () => startWorker(o)))};
        mine.workers.catch(() => { if (pool === mine) pool = null; });
    }
    const mine = pool, workers = await mine.workers;
    mine.users++;
    let ports: MessagePort[] = [];
    return {
        connect() {
            // Each map talks to each worker over its own channel, so their styles and requests stay separate.
            ports = workers.map(w => { const ch = new MessageChannel(); w.postMessage({role: 'tiles', port: ch.port1}, [ch.port1]); return ch.port2; });
            return ports;
        },
        release() {
            for (const p of ports) { try { p.postMessage({type: 'close'}); p.close(); } catch { /* already transferred to the engine worker */ } }
            // A pool that a map with another worker URL replaced is shared no more, so its last map ends it too.
            if (--mine.users <= 0) { for (const w of workers) w.terminate(); if (pool === mine) pool = null; }
        },
    };
}
