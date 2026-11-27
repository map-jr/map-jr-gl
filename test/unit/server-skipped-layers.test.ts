// Unit tests for the warning of the server renderer about the layers that it does not draw (#2434).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToSVG} from '../../src/server.ts';

const square = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Polygon', coordinates: [[[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]]}}]};
const point = {type: 'FeatureCollection', features: [{type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}}]};
const style = {
    version: 8,
    sources: {g: {type: 'geojson', data: square}, p: {type: 'geojson', data: point}, dem: {type: 'raster-dem', tiles: ['https://example.com/{z}/{x}/{y}.png']}},
    layers: [
        {id: 'paper', type: 'background', paint: {'background-pattern': 'dots'}},
        {id: 'plain', type: 'fill', source: 'g', paint: {'fill-color': '#f00'}},
        {id: 'hatched', type: 'fill', source: 'g', paint: {'fill-pattern': 'dots'}},
        {id: 'blocks', type: 'fill-extrusion', source: 'g', paint: {'fill-extrusion-pattern': 'dots'}},
        {id: 'heat', type: 'heatmap', source: 'p'},
        {id: 'hills', type: 'hillshade', source: 'dem'},
        {id: 'relief', type: 'color-relief', source: 'dem'},
        {id: 'hollow', type: 'line', source: 'g', paint: {'line-color': '#00f', 'line-width': 2, 'line-gap-width': 4}},
        {id: 'later', type: 'hillshade', source: 'dem', minzoom: 10},
    ],
};
const options = {style, center: [0, 0] as [number, number], zoom: 5, width: 200, height: 200, fetch: async (url: any): Promise<Response> => { throw new Error(`no request expected: ${url}`); }};

async function warnings(o: any): Promise<string[]> {
    const seen: string[] = [], warn = console.warn;
    console.warn = (...a: unknown[]) => { seen.push(a.join(' ')); };
    try { await renderToSVG(o); } finally { console.warn = warn; }
    return seen;
}

test('each layer that the server render leaves out gets one warning in each render, with its id', async () => {
    for (let run = 0; run < 2; run++) {
        const seen = await warnings(options);
        assert.deepEqual(seen.map(w => /the layer "([^"]+)"/.exec(w)?.[1]), ['paper', 'hatched', 'blocks', 'heat', 'hills', 'relief', 'hollow']);
        assert.match(seen[0], /^\[map-jr-gl\] E2434 server render: the layer "paper" is not drawn, because the server render does not draw image patterns\. The map draws it in the browser\. .*overrides: \{"paper": \{hidden: true\}\}/);
        assert.match(seen[6], /does not draw hollow lines \(line-gap-width\)\./);
        assert.match(seen[4], /does not draw hillshade layers\./);
    }
});

test('a layer that is hidden for the server render, or left out by layerFilter, gets no warning', async () => {
    const hidden = Object.fromEntries(['paper', 'hatched', 'blocks', 'heat', 'hills', 'hollow'].map(id => [id, {hidden: true}]));
    assert.deepEqual(await warnings({...options, overrides: hidden, layerFilter: (id: string) => id !== 'relief'}), []);
});
