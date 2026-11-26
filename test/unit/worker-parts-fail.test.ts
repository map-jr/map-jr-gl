// A part of the worker that does not load (#79, src/parts.ts). (A file of its own: a part that failed stays failed in
// its process, and worker-parts.test.ts loads the parts.)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {oncePerPart, setPartLoader} from '../../src/parts.ts';
import {serveTiles} from '../../src/tiles.ts';

const failure = '[map-jr-gl] E31846 The worker could not load http://x/map-jr-gl-worker-geojson.js, the part of the worker for geojson. Serve it.';

test('a GeoJSON part that fails in a tile worker answers the message with its error, and leaves no unhandled rejection', async () => {
    const unhandled: unknown[] = [], onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    try {
        setPartLoader(async () => { throw new Error(failure); });
        const sent: any[] = [], port: any = {postMessage: (m: unknown) => sent.push(m), onmessage: null};
        serveTiles(port);
        await port.onmessage({data: {type: 'geojson', id: -1, source: 'g', data: {type: 'Point', coordinates: [0, 0]}}});
        await new Promise(r => setTimeout(r, 20));
        assert.equal(unhandled.length, 0, String(unhandled[0]));
        assert.deepEqual(sent, [{id: -1, error: failure}]);
    } finally { process.off('unhandledRejection', onUnhandled); }
});

test('the failure of a part is reported once for a map, and other errors each time', () => {
    const out: string[] = [], emit = oncePerPart<{type: string; message?: string}>(e => out.push(e.message!));
    for (let i = 0; i < 20; i++) emit({type: 'error', message: failure});
    emit({type: 'error', message: 'HTTP 404'}); emit({type: 'error', message: 'HTTP 404'});
    assert.deepEqual(out, [failure, 'HTTP 404', 'HTTP 404']);
    // (Another map has its own wrapper, and reports the failure too.)
    const other: string[] = [];
    oncePerPart<{type: string; message?: string}>(e => other.push(e.message!))({type: 'error', message: failure});
    assert.equal(other.length, 1);
});
