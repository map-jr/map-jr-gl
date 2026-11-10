import {Engine} from './engine.ts';
import {PortBackend, serveTiles} from './tiles.ts';

/** One worker script, two roles: a tile parser, or the host of the whole rendering engine. */
const scope = self as unknown as {onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown): void};
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
