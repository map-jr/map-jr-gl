// The two ways in which a map starts its engine again: after a lost WebGL context (`restart`), and on the main thread
// when the engine worker has no WebGL2 (`fallBack`). Most maps never need them, so the map loads this file only then.
//
// Each function runs as a method of the map (`fn.call(map, ...)`) and uses its private members as `this.name`, so that
// the build gives these members the same short names as in src/map.ts (see scripts/private-names.mjs). That is why
// `this` has the type `any`: TypeScript does not allow private members outside the class. Keep the code in step with
// the members of the map in src/map.ts.
import type {EngineOptions} from './engine.ts';

/** True in the development build (`dist/*.dev.js`). Code behind it is not in the production build. */
declare const __DEV__: boolean;

/**
 * Starts the engine again on a new canvas, with the camera, style, images, markers and state that the map has now.
 * `ready` is whether the old engine was running. The map has already reported the loss (`Map.restart`).
 */
export async function restart(this: any, ready: boolean, main?: boolean) {
    if (this.removed) return; // (the map was removed while this file loaded)
    // (An engine on the main thread does not end with a worker. It must stop: it can still have a context when
    // the restart is for an engine that reported no frame.)
    if (ready) this.send({type: 'destroy'});
    for (const fn of this.inputCleanup.splice(0)) fn();
    this.observer?.disconnect();
    for (const w of this.workers.splice(0)) w.terminate();
    this.tilePool?.release();
    this.tilePool = undefined; // (a `remove` during the start below must not give the same workers back again)
    this.queue = []; this.tilesLoaded = false; this.seq = 0;
    this.loadedSources.clear(); // (the new engine has no tiles)
    const fresh = this.canvas.cloneNode() as HTMLCanvasElement, tr = this.tr;
    this.canvas.replaceWith(fresh);
    this.canvas = fresh;
    this.options = {...this.options, style: this.rawStyle, center: [tr.lng, tr.lat], zoom: tr.zoom, bearing: tr.bearing, pitch: tr.pitch, ...(main && {renderer: 'main' as const})};
    await this.start();
    this.resend();
    // The engine got the style without what `restyle` adds: the number of each source (without it the page does not
    // accept the report that a source is loaded), the layers that the page has hidden, and the global state.
    this.restyle(true);
    for (const [name, [source, options]] of this.imageInputs) await this.addImage(name, source, options);
    this.fire('webglcontextrestored');
    if (__DEV__) this.note('restart() ended', {renderer: this.renderer, drew: this.drew});
}

/**
 * The engine worker could not create a WebGL2 context: the engine starts on the main thread. A transferred canvas
 * cannot be taken back, so a new canvas takes its place. The map has already ended the worker and stopped sending it
 * commands (`ready` is false): the commands wait in its queue until the new engine runs.
 */
export function fallBack(this: any, engineOptions: EngineOptions) {
    if (this.removed) return; // (the map was removed while this file loaded)
    const fresh = this.canvas.cloneNode() as HTMLCanvasElement;
    this.canvas.replaceWith(fresh);
    for (const fn of this.inputCleanup.splice(0)) fn();
    this.canvas = fresh;
    // The new engine gets the style as it is now, and what `resend` sends.
    return this.startMainEngine(fresh, {...engineOptions, style: this.resolved, center: [this.tr.lng, this.tr.lat], zoom: this.tr.zoom, bearing: this.tr.bearing}, []).then(() => {
        if (this.removed) return;
        this.ready = true;
        for (const [c, t] of this.queue.splice(0)) this.deliver(c, t);
        this.resend();
        // (The data of GeoJSON sources and changes of the style since the start. It is also a numbered command:
        // the new engine reports `idle` with the number that the page waits for.)
        this.restyle(true);
        for (const [name, [source, options]] of this.imageInputs) this.addImage(name, source, options);
        if (this.listening) this.bindInput();
    });
}
