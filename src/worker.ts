import {Engine} from './engine.ts';

declare const __VERSION__: string; // the version of package.json, set by the build
import {PortBackend, serveTiles} from './tiles.ts';
import {browserColors, relayWarnings, useColorNames, warnOnce} from './expr.ts';
import {part, setPartLoader, type PartName} from './parts.ts';

// What the parts that load on demand (parts.ts) take from this file. A part file is built with these modules left
// out, and reads them from `MapJrWorker`, the global of this file (see build.mjs).
export {EXTENT, HEIGHT_GRID, TILE_SIZE, Transform, clamp, keepSize, latFromMerc, lngFromMerc, mercX, mercY, touches} from './geo.ts';
export {SHADERS, VS_COMMON, FS_CLIP, opaque, skyValues} from './gl.ts';
export {renderItems} from './placement.ts';
export {compileExpr, compileFilter, parseColor, warnOnce} from './expr.ts';
export {SPEC, LIGHT_PROPS} from './style.ts';
export {decodeElevation} from './query.ts';
export {decodePixels} from './exact-pixels.ts';
export {heads} from './tile-fetch.ts';
export {earcut} from './tile.ts';

/** One worker script, two roles: a tile parser, or the host of the whole rendering engine. */
const scope = self as unknown as {onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown): void; importScripts(url: string): void; MapJrPart?: unknown};

/**
 * Loads a part from the URL that the page gave (`partUrls` in loader.ts). The file is fetched and run from a blob,
 * so that the worker goes on with other tiles while it downloads. Where that is not allowed (no CORS on another origin,
 * a policy without `blob:`), `importScripts` loads it from its URL.
 */
let partUrls: Partial<Record<PartName, string>> = {};
/**
 * The code of a part that the page fetched once for all of its workers (`prefetchParts` in loader.ts), as a blob URL,
 * or null when the page could not fetch it. The page names a part that it fetches with the role `tiles`, and sends it
 * with the role `part`: a part that the page does not fetch is fetched here.
 */
const fromPage = new Map<string, {code: Promise<string | null>; done(url: string | null): void}>();
const given = (name: string) => {
    let e = fromPage.get(name);
    if (!e) { let done!: (url: string | null) => void; const code = new Promise<string | null>(r => done = r); fromPage.set(name, e = {code, done}); }
    return e;
};
const fromUrl = async (partName: PartName) => {
    const code = await fromPage.get(partName)?.code;
    if (code) try { scope.importScripts(code); return scope.MapJrPart; } catch { /* the fetch below */ }
    const url = partUrls[partName];
    if (!url) throw new Error(`[map-jr-gl] E21846 The worker could not load map-jr-gl-worker-${partName}.js, the part of the worker for ${partName}: it has no URL. Set workerUrl to an http(s) URL of map-jr-gl-worker.js.`);
    let blob = '';
    try {
        const res = await fetch(url);
        if (res.ok) blob = URL.createObjectURL(new Blob([await res.text(), `\n//# sourceMappingURL=${url.replace(/[?#].*/, '')}.map`], {type: 'text/javascript'}));
    } catch { /* importScripts below */ }
    try {
        try { scope.importScripts(blob || url); } catch (err) { if (!blob) throw err; scope.importScripts(url); }
    } catch {
        throw new Error(`[map-jr-gl] E31846 The worker could not load ${url}, the part of the worker for ${partName}. Serve map-jr-gl-worker-${partName}.js from the same folder and version as map-jr-gl-worker.js.`);
    } finally { if (blob) URL.revokeObjectURL(blob); }
    return scope.MapJrPart;
};

/** The URL and the referrer policy of the page that started this worker (see `ref` below). */
let referrer = '', policy = '' as ReferrerPolicy;
/** The ports of the maps that this worker serves tiles for, by the id that the page gave each. */
const tilePorts = new Map<number, MessagePort>();
/**
 * A tile worker without a 2d canvas (Safari before 16.4, WebKit on Windows) cannot ask the browser for a color name: it
 * loads the table first, and the messages of a port wait in the port until then (#72). Without the table a name is
 * not a color, and the page shows the failure of the part once.
 */
let names: Promise<unknown> | undefined;
scope.onmessage = e => {
    const m = e.data;
    // (The page sends the URLs of the parts with each role. The standalone build sends none: its worker has them inside.)
    if (m.parts) { partUrls = m.parts; setPartLoader(fromUrl); }
    // A worker that starts from a blob: URL sends no Referer, and some tile servers (OpenStreetMap) then refuse the
    // request (#2347). Each request of this worker that names no referrer of its own sends the page's URL under the
    // page's referrer policy, as MapLibre GL JS does (`getReferrer`). Both are the same for every map of a page.
    // (A `Request` reads `about:client` when it names no referrer.)
    // (The latest map that connects gives the policy: a `<meta name="referrer">` can change while the page runs.)
    if (m.ref) {
        const f = !referrer && self.fetch;
        [referrer, policy] = m.ref;
        if (f) self.fetch = (input, init) => f(input, init?.referrer != null || ((input as Request).referrer ?? 'about:client') != 'about:client' ? init : {...init, referrer, referrerPolicy: init?.referrerPolicy ?? policy});
    }
    for (const name of m.coming ?? []) given(name);
    if (m.role === 'part') given(m.name).done(m.code);
    // A warning goes through the port of any map that is still open: the page prints each once, whichever map it came from.
    if (m.role === 'tiles') {
        const port = m.port;
        tilePorts.set(m.id, port);
        relayWarnings(msg => tilePorts.values().next().value?.postMessage({type: 'warn', msg}));
        if (browserColors()) serveTiles(port);
        // (The text of a failed part starts with the prefix, which the page adds again: `isPartFailure`.)
        else (names ??= part('colors').then(p => useColorNames(p.NAMED), (err: Error) => warnOnce(err.message.slice(12)))).then(() => serveTiles(port));
    }
    // The page drops the port of a map that it no longer uses (its engine worker ended, or the map was removed; #838).
    else if (m.role === 'drop') { const p = tilePorts.get(m.id); tilePorts.delete(m.id); if (p) { p.onmessage = null; p.close(); } }
    else if (m.role === 'engine') {
        relayWarnings(msg => scope.postMessage({type: 'warn', msg}));
        try {
            const engine = new Engine(m.canvas, m.options, m.ports.map((p: MessagePort) => new PortBackend(p)), ev => scope.postMessage(ev));
            // (The code of a part that the page fetched still comes after the engine has started: #1849.)
            scope.onmessage = ev => { if (ev.data.role === 'part') given(ev.data.name).done(ev.data.code); else engine.command(ev.data); };
        } catch (err) {
            scope.postMessage({type: 'fatal', message: String((err as Error).message)});
        }
    }
};

// Tells the page the script loaded and ran, so a missing or blocked worker file is noticed at once instead of silently hanging.
// The version lets the page notice a worker file of another version (see `workerReady` in loader.ts).
scope.postMessage({type: 'hello', version: __VERSION__});
