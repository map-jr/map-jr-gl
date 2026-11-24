// Unit tests for the errors of the server renderer when a request has an HTTP error status (#1205).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG} from '../../src/server.ts';

const notFound = (async () => new Response('', {status: 404})) as typeof fetch;

test('a style URL that answers 404 rejects with a [map-jr-gl] error that names the style and the status', async () => {
    await assert.rejects(renderToSVG({style: 'https://styles.test/style.json', center: [0, 0], zoom: 1, width: 100, height: 100, fetch: notFound}),
        /^Error: \[map-jr-gl\] the request for the style https:\/\/styles\.test\/style\.json failed: HTTP 404$/);
});

test('a raster tile that answers 404 with inlineImages rejects with a [map-jr-gl] error', async () => {
    const style = {version: 8, sources: {r: {type: 'raster', tiles: ['https://tiles.test/{z}/{x}/{y}.png'], tileSize: 256}}, layers: [{id: 'r', type: 'raster', source: 'r'}]};
    await assert.rejects(renderToSVG({style, center: [0, 0], zoom: 1, width: 100, height: 100, inlineImages: true, fetch: notFound} as never),
        /^Error: \[map-jr-gl\] the request for the image https:\/\/tiles\.test\/\d\/\d\/\d\.png failed: HTTP 404$/);
});
