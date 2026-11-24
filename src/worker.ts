import {Engine} from './engine.ts';

declare const __VERSION__: string; // the version of package.json, set by the build
import {PortBackend, serveTiles} from './tiles.ts';
import {relayWarnings} from './expr.ts';

/** One worker script, two roles: a tile parser, or the host of the whole rendering engine. */
const scope = self as unknown as {onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown): void};
// Engines hosted here, by the id the page gave each; one worker can serve tiles for many maps and host an engine too.
/** The ports of the maps that this worker serves tiles for, by the id that the page gave each. */
const tilePorts = new Map<number, MessagePort>();
scope.onmessage = e => {
    const m = e.data;
    // A warning goes through the port of any map that is still open: the page prints each once, whichever map it came from.
    if (m.role === 'tiles') { tilePorts.set(m.id, m.port); serveTiles(m.port); relayWarnings(msg => tilePorts.values().next().value?.postMessage({type: 'warn', msg})); }
    // The page drops the port of a map that it no longer uses (its engine worker ended, or the map was removed; #838).
    else if (m.role === 'drop') { const p = tilePorts.get(m.id); tilePorts.delete(m.id); if (p) { p.onmessage = null; p.close(); } }
    else if (m.role === 'engine') {
        relayWarnings(msg => scope.postMessage({type: 'warn', msg}));
        try {
            const engine = new Engine(m.canvas, m.options, m.ports.map((p: MessagePort) => new PortBackend(p)), ev => scope.postMessage(ev));
            scope.onmessage = ev => engine.command(ev.data);
        } catch (err) {
            scope.postMessage({type: 'fatal', message: String((err as Error).message)});
        }
    }
};

// Tells the page the script loaded and ran, so a missing or blocked worker file is noticed at once instead of silently hanging.
// The version lets the page notice a worker file of another version (see `workerReady` in loader.ts).
scope.postMessage({type: 'hello', version: __VERSION__});
