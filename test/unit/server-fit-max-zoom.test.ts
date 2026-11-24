// Unit tests for the highest zoom of the fit to `bounds` in the server renderer (#1672).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG, renderFirstView} from '../../src/server.ts';
import {navigation} from '../../src/control-specs.ts';

const style = {version: 8, sources: {v: {type: 'vector', tiles: ['https://tiles.example.com/{z}/{x}/{y}.pbf'], maxzoom: 24}},
    layers: [{id: 'fill', type: 'fill', source: 'v', 'source-layer': 'water'}]};
const fetch = async () => new Response(null, {status: 404});
// Bounds of about 1 m: the fit is above zoom 22 without a limit.
const view = {style, fetch, width: 400, height: 300, bounds: [2.35, 48.85, 2.35001, 48.85001] as [number, number, number, number]};
// The zoom of the tiles of the view: `{z}` of the first URL.
const zoomOf = (r: {tiles: string[]}) => Number(r.tiles[0]?.split('/')[3]);

test('renderToSVG fits small bounds up to fitMaxZoom, and up to 22 without it', async () => {
    assert.equal(zoomOf(await renderToSVG(view)), 22);
    assert.equal(zoomOf(await renderToSVG({...view, fitMaxZoom: 15})), 15);
});

test('renderFirstView fits small bounds up to fitMaxZoom, else up to maxZoom', async () => {
    // The zoom-in button is disabled when the view is at `maxZoom`.
    const zoomIn = /<button class="map-jr-ctrl-zoom-in[^>]*>/;
    const atMax = await renderFirstView({...view, maxZoom: 12, controls: [navigation()]});
    assert.match(zoomIn.exec(atMax)![0], /disabled/);
    const below = await renderFirstView({...view, maxZoom: 12, fitMaxZoom: 9, controls: [navigation()]});
    assert.doesNotMatch(zoomIn.exec(below)![0], /disabled/);
});
