/**
 * The parts of the tile code that only some maps need (#79). In the worker file they are files of their own
 * (`map-jr-gl-worker-<name>.js`), which the worker loads when a map needs one (see `fromUrl` in worker.ts). On the
 * page they are chunks that load on demand, and the built files that contain everything (the server renderer, the
 * worker inside the standalone build) import them (the plugin `all-in-one` of build.mjs).
 *
 * To add a part: a line in `Parts` and in `loaders`, a line in `partUrls` of loader.ts, and the names that the part
 * imports from other modules in the exports of worker.ts. build.mjs builds a file for each line of `loaders`.
 */
export interface Parts {
    geojson: typeof import('./geojson.ts');
    contour: typeof import('./contour.ts');
    pmtiles: typeof import('./pmtiles.ts');
}
export type PartName = keyof Parts;

const loaders: {[K in PartName]: () => Promise<Parts[K]>} = {
    geojson: () => import('./geojson.ts'),
    contour: () => import('./contour.ts'),
    pmtiles: () => import('./pmtiles.ts'),
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
    if (!p) { loading.set(name, p = load(name)); p.catch(() => {}); }
    return p as Promise<Parts[K]>;
}
