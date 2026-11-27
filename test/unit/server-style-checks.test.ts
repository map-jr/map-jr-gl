// Unit tests for the checks of the style in the server renderer (#654).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG} from '../../src/server.ts';

const view = {width: 10, height: 10, center: [0, 0] as [number, number], zoom: 2};

test('a style without a list "layers" rejects with the message E654, not a TypeError', async () => {
    const message = /^\[map-jr-gl\] E654 The style has no list "layers"\. Give a style object/;
    await assert.rejects(renderToSVG({...view, style: {version: 8, sources: {}} as any}), {message});
    await assert.rejects(renderToSVG({...view, style: {version: 8, sources: {}, layers: 3} as any}), {message});
    await assert.rejects(renderToSVG({...view, style: {version: 8, sources: {}} as any, layers: [{id: 'a', type: 'background'}]}), {message});
    const fetch = async () => new Response(JSON.stringify({version: 8, sources: {}}));
    await assert.rejects(renderToSVG({...view, style: 'https://example.com/style.json', fetch: fetch as any}), {message});
});

test('a custom encoding with a factor that is not finite warns once and reads the source as mapbox', async () => {
    const told: string[] = [], warn = console.warn;
    console.warn = (m: string) => { told.push(m); };
    try {
        const style = {version: 8, sources: {dem: {type: 'raster-dem', tiles: ['https://example.com/{z}/{x}/{y}.png'], encoding: 'custom', redFactor: NaN}},
            layers: [{id: 'bg', type: 'background', paint: {'background-color': '#fff'}}]};
        assert.match((await renderToSVG({...view, style: style as any})).svg, /^<svg/);
    } finally { console.warn = warn; }
    assert.equal(told.length, 1);
    assert.match(told[0], /^\[map-jr-gl\] E590 The source "dem"/);
});
