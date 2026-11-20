// The script that runs first in the document of a map frame (components/MapFrame.vue, utils/map-frame.ts). The frame
// is an iframe with the sandbox "allow-scripts", so its origin is opaque and this script reaches the page only through
// messages. It reports the errors of the code, the errors and warnings that the code or the library writes to the
// console, and the height of the document. In the form "description", it makes the map from the default export of the
// code that the page sends, and it changes the map when the code changes.
//
// The page puts this file into the document as text, so it is plain JavaScript with no imports.
// eslint-disable-next-line no-unused-vars
function mapFrame(config) {
    const post = (type, data) => parent.postMessage({mapFrame: type, ...data}, '*');
    const text = value => {
        if (value instanceof Error) return `${value.name}: ${value.message}`;
        if (typeof value === 'string') return value;
        try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
    };
    // `source` is "code" for an error of the code (it is thrown) and "console" for a message on the console.
    const report = (level, message, line, source) => post('message', {level, text: message, line, source});

    // The line of the code: the document has `config.offset` lines of the frame before the first line of the code. In
    // the form "description" the code is a module of its own, so its lines count from 1.
    const lineOf = (file, line) => !line ? undefined : file?.startsWith('blob:') ? line : line > config.offset ? line - config.offset : undefined;
    addEventListener('error', event => {
        if (event instanceof ErrorEvent) report('error', event.error ? text(event.error) : event.message, lineOf(event.filename, event.lineno), 'code');
        else if (event.target && event.target !== window) report('error', `${event.target.src || event.target.href || 'A file'} did not load.`, undefined, 'code');
    }, true);
    addEventListener('unhandledrejection', event => report('error', text(event.reason), undefined, 'code'));
    for (const level of ['error', 'warn']) {
        const original = console[level];
        console[level] = (...args) => {
            report(level, args.map(text).join(' '), undefined, 'console');
            original.apply(console, args);
        };
    }

    new ResizeObserver(() => post('size', {height: Math.ceil(document.documentElement.getBoundingClientRect().height)})).observe(document.documentElement);

    addEventListener('message', event => {
        if (event.source !== parent || !event.data) return;
        if (event.data.mapFrame === 'scheme') document.documentElement.dataset.scheme = event.data.scheme;
        if (event.data.mapFrame === 'description' && config.form === 'description') describe(event.data.code);
    });

    if (config.form !== 'description') return;

    // The form "description". A change of a field that the map reads only when it is made (MapSetup) makes a new map at
    // the same view. A change of `initialView` moves the map there, also when the map is new.
    const setupFields = ['renderer', 'fontFamily', 'interactive', 'antialias', 'attribution', 'hash', 'nonce'];
    const library = import('@map-jr/map-jr-gl');
    const json = value => { try { return JSON.stringify(value ?? null); } catch { return ''; } };
    // `made` is the description of the code that made the map, and `given` is the `initialView` that the map got: the
    // view of the old map or of the address, when there is one.
    let map, made, given, view = config.view, latest = 0;

    function make(createMap, value) {
        map?.destroy();
        given = made && json(value.initialView) !== json(made.initialView) ? value.initialView : view ?? value.initialView;
        // (This script runs in the head, before the container exists.)
        map = createMap(document.getElementById('map'), {...value, initialView: given});
        made = value;
        map.state.subscribe(state => state.view, next => {
            view = {center: next.center, zoom: next.zoom, bearing: next.bearing, pitch: next.pitch};
            post('view', {view});
        });
        map.state.subscribe(state => state.idle, idle => post('state', {state: idle ? 'idle' : 'loading'}));
    }

    async function describe(code) {
        const id = ++latest;
        const url = URL.createObjectURL(new Blob([code], {type: 'text/javascript'}));
        let value;
        try {
            value = (await import(url)).default;
        } catch (error) {
            if (id === latest) {
                post('clear', {source: 'code'});
                const line = String(error?.stack ?? '').split(url + ':')[1]?.match(/^(\d+)/)?.[1] ?? error?.lineNumber;
                report('error', text(error), line ? Number(line) : undefined, 'code');
            }
            return;
        } finally {
            URL.revokeObjectURL(url);
        }
        const {createMap} = await library;
        if (id !== latest) return;
        post('clear', {source: 'code'});
        if (!value || typeof value !== 'object') {
            report('error', 'The code exports no description. Write the description as "export default {style: …}".', undefined, 'code');
            return;
        }
        try {
            if (!map || setupFields.some(field => json(value[field]) !== json(made[field]))) {
                make(createMap, value);
            } else {
                if (json(value.initialView) !== json(made.initialView)) {
                    if (value.initialView) map.moveTo(value.initialView);
                    made = {...made, initialView: value.initialView};
                }
                // (The map reads `initialView` only when it is made, so the update keeps the one that the map got.)
                map.update({...value, initialView: given});
            }
        } catch (error) {
            report('error', text(error), undefined, 'code');
        }
    }
}
