/**
 * The parts of the worker code that only some maps need (#79; the globe, #2006; the cut of tiles for the globe, #2075). In the worker file they are files of their own
 * (`map-jr-gl-worker-<name>.js`), which the worker loads when a map needs one (see `fromUrl` in worker.ts). On the
 * page they are chunks that load on demand, and the built files that contain everything (the server renderer, the
 * worker inside the standalone build) import them (the plugin `all-in-one` of build.mjs).
 *
 * To add a part: a line in `Parts` and in `loaders`, a line in `partUrls` of loader.ts, and the names that the part
 * imports from other modules in the exports of worker.ts. build.mjs builds a file for each line of `loaders`.
 */
export interface Parts {
    geojson: typeof import('./geojson.ts');
    dem: typeof import('./dem.ts');
    pmtiles: typeof import('./pmtiles.ts');
    within: typeof import('./within.ts');
    globe: typeof import('./globe.ts');
    subdivide: typeof import('./subdivide.ts');
}
export type PartName = keyof Parts;

const loaders: {[K in PartName]: () => Promise<Parts[K]>} = {
    geojson: () => import('./geojson.ts'),
    dem: () => import('./dem.ts'),
    pmtiles: () => import('./pmtiles.ts'),
    within: () => import('./within.ts'),
    globe: () => import('./globe.ts'),
    subdivide: () => import('./subdivide.ts'),
};

/** How this thread loads a part. The worker file replaces it with a loader from URLs. */
let load = (name: PartName): Promise<unknown> => loaders[name]();
export function setPartLoader(f: (name: PartName) => Promise<unknown>) { load = f; }

/**
 * Each part loads once on a thread. A part that failed stays failed, so that each tile does not request it again.
 * Calls that wait for one part are answered in the order of the calls, so code that waits for a part after an earlier
 * call has started work with it (`setGeoJSON`, then a tile of that source) runs after that work.
 */
const loading = new Map<PartName, Promise<unknown>>();
export function part<K extends PartName>(name: K): Promise<Parts[K]> {
    let p = loading.get(name);
    if (!p) {
        const partName = name;
        p = load(name).catch((err: Error) => { throw isPartFailure(err.message) ? err : new Error(`[map-jr-gl] E11846 The page could not load the part of the library for ${partName} (${err.message}). Serve the chunks of the library from the same folder and version as its entry.`); });
        loading.set(name, p); p.catch(() => {});
    }
    return p as Promise<Parts[K]>;
}

/** Whether an error message is the failure of a part (see `fromUrl` in worker.ts): its code, which the production files keep (#2148). */
export const isPartFailure = (message: string) => /^\[map-jr-gl\] E[123]1846 /.test(message);

/** Wraps the events of one map so that the failure of each part is reported once, and not by each tile and query (#79). */
export function oncePerPart<E extends {type: string; message?: string}>(emit: (e: E) => void): (e: E) => void {
    const seen = new Set<string>();
    return e => {
        if (e.type === 'error' && e.message && isPartFailure(e.message)) { if (seen.has(e.message)) return; seen.add(e.message); }
        emit(e);
    };
}
