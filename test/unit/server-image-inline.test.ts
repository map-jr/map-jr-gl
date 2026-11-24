// renderToImage always embeds images, whatever a JavaScript caller passes (#1208).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToImage} from '../../src/server.ts';

const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/q0eh2QAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
const style = {version: 8, sources: {r: {type: 'raster', tiles: ['https://tiles.test/{z}/{x}/{y}.png'], tileSize: 256}}, layers: [{id: 'r', type: 'raster', source: 'r'}]};

test('renderToImage embeds raster tiles even when a caller passes inlineImages: false (#1208)', async () => {
    let html = '';
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    const rasteriser = {render: async (source: string) => { html = source; return new Uint8Array(); }};
    const options = {style, center: [0, 0] as [number, number], zoom: 1, width: 256, height: 256, rasteriser,
        fetch: (async () => new Response(png, {headers: {'content-type': 'image/png'}})) as typeof fetch};
    try {
        await renderToImage(options);
        assert.deepEqual(warnings, []);
        await renderToImage({...options, ...{inlineImages: false}});
        await renderToImage({...options, ...{inlineImages: false}});
    } finally { console.warn = warn; }
    assert.match(html, /href="data:image\/png/);
    assert.doesNotMatch(html, /https:\/\/tiles\.test/);
    // A JavaScript caller that passes the option gets one warning.
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /^\[map-jr-gl\] renderToImage\(\): "inlineImages"/);
});
