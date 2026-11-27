// The server renderer draws flat, so a pitch other than 0 warns once for each render (#2513).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG, renderToImage, renderFirstView, firstViewOptions} from '../../src/server.ts';

const style = {version: 8, sources: {}, layers: [{id: 'b', type: 'background', paint: {'background-color': '#fff'}}]};
const base = {style, center: [0, 0] as [number, number], zoom: 1, width: 64, height: 64};

async function warned(run: () => Promise<unknown>) {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try { await run(); } finally { console.warn = warn; }
    return warnings;
}

test('renderToSVG, renderToImage and renderFirstView warn once when pitch is not 0 (#2513)', async () => {
    const rasteriser = {render: async () => new Uint8Array()};
    for (const run of [() => renderToSVG({...base, pitch: 45}), () => renderToImage({...base, pitch: 45, rasteriser}), () => renderFirstView({...base, pitch: 45})]) {
        const w = await warned(run);
        assert.equal(w.length, 1);
        assert.match(w[0], /^\[map-jr-gl\] E2513 server render: "pitch" is 45/);
    }
    assert.deepEqual(await warned(() => renderToSVG({...base, pitch: 0})), []);
    assert.deepEqual(await warned(() => renderToSVG(base)), []);
});

test('firstViewOptions passes the pitch of the description to the render (#2513)', async () => {
    const w = await warned(() => renderFirstView(firstViewOptions({style, initialView: {center: [0, 0], zoom: 1, pitch: 30}} as any)));
    assert.equal(w.length, 1);
    assert.match(w[0], /E2513/);
});
