// The server renderer does not take the sprite image where the style or `images` defines an image of the same name, as the map (#1300).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG} from '../../src/server.ts';

const fetchFn = (async (url: string) => String(url).endsWith('sprite.json') ? new Response(JSON.stringify({pin: {x: 0, y: 0, width: 10, height: 10, pixelRatio: 1}}))
    : new Response('', {status: 404})) as unknown as typeof fetch;
const style = (images: Record<string, unknown>) => ({version: 8, sprite: 'https://example.test/sprite', metadata: {'map-jr:images': images},
    sources: {p: {type: 'geojson', data: {type: 'Feature', geometry: {type: 'Point', coordinates: [0, 0]}, properties: {}}}},
    layers: [{id: 's', type: 'symbol', source: 'p', layout: {'icon-image': 'pin'}}]});
const render = (images: Record<string, unknown>) => renderToSVG({style: style(images), center: [0, 0], zoom: 2, width: 200, height: 200, fetch: fetchFn});

test('without an image of its own, the sprite image is drawn', async () => {
    assert.match((await render({})).svg, /href="#sprite"/);
});

test('a style image that is a URL is drawn in place of the sprite image', async () => {
    const {svg} = await render({pin: {image: 'https://example.test/pin.png', width: 12, height: 12}});
    assert.doesNotMatch(svg, /#sprite/);
    assert.match(svg, /https:\/\/example\.test\/pin\.png/);
});

test('a style image that cannot load or is left out hides the sprite image', async (t) => {
    t.mock.method(console, 'warn', () => {});
    assert.doesNotMatch((await render({pin: 'https://example.test/missing.png'})).svg, /#sprite/);
    assert.doesNotMatch((await render({pin: '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.test/a.png"/></svg>'})).svg, /#sprite/);
});
