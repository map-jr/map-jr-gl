/**
 * How the library finds and starts its workers. The default needs no configuration: the worker file is looked for
 * next to this module. Everything can be overridden per map or globally with `configure()`.
 */
declare const __WORKER_SRC__: string; // the worker's source, embedded only in the standalone build

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
}

const defaults: LoadOptions = {};
/** Sets page-wide defaults for how workers are loaded. Individual maps can still override them. */
export function configure(options: LoadOptions) { Object.assign(defaults, options); }

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

/** Resolves once the worker's script has loaded and run; rejects if it fails to (missing file, blocked by policy). */
export function workerReady(w: Worker, timeout = 8000): Promise<Worker> {
    return new Promise((resolve, reject) => {
        const done = (err?: Error) => { clearTimeout(timer); w.removeEventListener('message', onMessage); w.removeEventListener('error', onError); if (err) { w.terminate(); reject(err); } else resolve(w); };
        const onMessage = (e: MessageEvent) => { if (e.data?.type === 'hello') done(); };
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
        const mine = pool = {key, users: 0, workers: Promise.all(Array.from({length: count}, () => workerReady(createWorker(o))))};
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
            if (--mine.users <= 0 && pool === mine) { for (const w of workers) w.terminate(); pool = null; }
        },
    };
}
