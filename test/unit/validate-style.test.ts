// The development build of the compat entry fires `error` with the text of MapLibre GL JS for a required field that a
// layer or a source of the style lacks, and `validate: false` skips that check (#1748).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {validateStyle, zoomCurveErrors} from '../../src/mistakes.ts';

// (The style specification that MapLibre GL JS of the devDependencies uses.)
const require = createRequire(createRequire(import.meta.url).resolve('maplibre-gl/package.json'));
const specPath = require.resolve('@maplibre/maplibre-gl-style-spec/package.json').replace(/package\.json$/, 'dist/index.mjs');
const {validateStyleMin} = await import(pathToFileURL(specPath).href) as {validateStyleMin: (s: unknown) => {message: string}[]};

const fc = {type: 'FeatureCollection', features: []};
const styles = [
    {sources: {g: {type: 'geojson', data: fc}}, layers: [{type: 'fill', source: 'g'}]},
    {sources: {g: {type: 'geojson', data: fc}}, layers: [{id: 'a', source: 'g'}]},
    {sources: {g: {type: 'geojson', data: fc}}, layers: [{id: 'a', type: 'fill'}, {id: 'b', type: 'background'}]},
    {sources: {v: {type: 'vector', url: 'https://example.com/v.json'}}, layers: [{id: 'a', type: 'fill', source: 'v'}]},
    {sources: {a: {}, g: {type: 'geojson'}, i: {type: 'image', url: 'https://example.com/i.png'}, m: {type: 'video'}, r: {type: 'raster', url: 'https://example.com/r.json'}}, layers: []},
    {sources: {g: {type: 'geojson', data: fc}, i: {type: 'image', url: 'https://example.com/i.png', coordinates: [[0, 1], [1, 1], [1, 0], [0, 0]]}}, layers: [{id: 'a', type: 'line', source: 'g'}]},
    // Step 2: the types of values (enums, colors, numbers, arrays), the layer type, and the type of the source of a layer.
    {sources: {g: {type: 'geojson', data: fc}}, layers: [
        {id: 'a', type: 'line', source: 'g', minzoom: 30, maxzoom: '5', layout: {'line-cap': 'squared', 'line-join': 4, visibility: 'hidden', 'line-miter-limit': 'x'},
            paint: {'line-color': 'redd', 'line-opacity': 2, 'line-width': -1, 'line-dasharray': [2, 'a'], 'line-translate': [1], 'line-blur': NaN, 'line-gap-width': null, 'line-offset': [1, 2]}},
        {id: 'b', type: 'circle', source: 'g', paint: {'circle-color': 5, 'circle-radius': ['get', 'r'], 'circle-opacity': {stops: [[0, 1]]}, 'circle-stroke-color': 'hsl(10, 50%, 50%)', 'circle-translate': ['literal', [1, 2]], 'circle-blur': [1]}},
        {id: 'c', type: 'symbol', source: 'g', layout: {'text-font': ['Open Sans', 3], 'text-variable-anchor': ['top', 'middle'], 'icon-padding': [1, 2, 3, 4, 5], 'icon-allow-overlap': 'yes', 'text-size': '12', 'icon-text-fit-padding': [1, 2, 3], 'text-writing-mode': 'horizontal', 'text-anchor': 'top'},
            paint: {'text-color': 'rgba(0,0,0,0.5)', 'text-halo-width': 1, 'text-translate-anchor': 'screen'}},
        {id: 'd', type: 'hillshade', source: 'g', paint: {'hillshade-shadow-color': ['#000', 'nope'], 'hillshade-highlight-color': ['red', 7], 'hillshade-illumination-direction': [], 'hillshade-exaggeration': 1.5}},
        {id: 'e', type: 'color-relief', source: 'g'},
        {id: 'f', type: 'polygon', source: 'g'},
        {id: 'g', type: 'background', paint: {'background-color': 'transparent', 'background-opacity': 0.5}},
        {id: 'h', type: 'fill', source: 'g', paint: {'fill-antialias': 1, 'fill-layer-blend': ['get', 'x'], 'fill-color': '#12345'}},
        // An array whose first element is not an operator is a literal (#1748).
        {id: 'i', type: 'line', source: 'g', paint: {'line-translate': ['abc', 1], 'line-color': ['red']}},
        {id: 'j', type: 'symbol', source: 'g', layout: {'text-variable-anchor': ['bogus'], 'text-font': ['noto']}},
    ]},
    {sources: {v: {type: 'vector', url: 'https://example.com/v.json'}, r: {type: 'raster', url: 'https://example.com/r.json'}, d: {type: 'raster-dem', url: 'https://example.com/d.json'}}, layers: [
        {id: 'a', type: 'raster', source: 'v'}, {id: 'b', type: 'fill', source: 'r'}, {id: 'c', type: 'line', source: 'd'},
        {id: 'd', type: 'hillshade', source: 'v', 'source-layer': 'x'}, {id: 'e', type: 'hillshade', source: 'd'}, {id: 'f', type: 'raster', source: 'r', paint: {'raster-opacity': 0.5, 'raster-fade-duration': -1}},
    ]},
];

test('src/style-spec-values.ts is what scripts/style-spec-values.mjs writes', async () => {
    const {source} = await import('../../scripts/style-spec-values.mjs');
    assert.equal(readFileSync(new URL('../../src/style-spec-values.ts', import.meta.url), 'utf8'), source(), 'Run node scripts/style-spec-values.mjs.');
});

test('the texts are those of MapLibre GL JS for each missing required field and each value of the wrong type', () => {
    for (const s of styles) {
        const ours: string[] = [];
        validateStyle(s, (where, why) => ours.push(`${where}: ${why}`));
        assert.deepEqual(ours.sort(), validateStyleMin({version: 8, ...s}).map(e => e.message).sort(), JSON.stringify(s));
    }
});

test('an array whose first element is an operator, such as ["round"], is an expression and is not checked (#1748)', () => {
    const ours: string[] = [];
    validateStyle({sources: {g: {type: 'geojson', data: fc}}, layers: [{id: 'a', type: 'line', source: 'g', layout: {'line-cap': ['round']}, paint: {'line-width': ['get', 'w']}}]}, (where, why) => ours.push(`${where}: ${why}`));
    assert.deepEqual(ours, []);
});

test('the compat entry fires each error once, with the place and the text, and validate: false skips it', () => {
    const errors: string[] = [], reported = new Set<string>();
    zoomCurveErrors(styles[2], reported, e => errors.push(e.message));
    zoomCurveErrors(styles[2], reported, e => errors.push(e.message));
    assert.deepEqual(errors, ['[map-jr-gl] layers[0]: missing required property "source". The map draws what it can, but MapLibre GL JS rejects the style. Correct it as the style specification requires.']);
    const skipped: string[] = [];
    zoomCurveErrors(styles[2], new Set(), e => skipped.push(e.message), true);
    assert.deepEqual(skipped, []);
});
