import {Engine} from './engine.ts';

declare const __VERSION__: string; // the version of package.json, set by the build
import {PortBackend, serveTiles} from './tiles.ts';

/** One worker script, two roles: a tile parser, or the host of the whole rendering engine. */
const scope = self as unknown as {onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown): void};
// Engines hosted here, by the id the page gave each; one worker can serve tiles for many maps and host an engine too.
scope.onmessage = e => {
    const m = e.data;
    if (m.role === 'tiles') serveTiles(m.port);
    else if (m.role === 'engine') {
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
