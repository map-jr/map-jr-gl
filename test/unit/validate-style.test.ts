// The development build of the compat entry fires `error` with the text of MapLibre GL JS for a required field that a
// layer or a source of the style lacks, and `validate: false` skips that check (#1748).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
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
];

test('the texts are those of MapLibre GL JS for each missing required field', () => {
    for (const s of styles) {
        const ours: string[] = [];
        validateStyle(s, (where, why) => ours.push(`${where}: ${why}`));
        assert.deepEqual(ours.sort(), validateStyleMin({version: 8, ...s}).map(e => e.message).sort(), JSON.stringify(s));
    }
});

test('the compat entry fires each error once, with the place and the text, and validate: false skips it', () => {
    const errors: string[] = [], reported = new Set<string>();
    zoomCurveErrors(styles[2], reported, e => errors.push(e.message));
    zoomCurveErrors(styles[2], reported, e => errors.push(e.message));
    assert.deepEqual(errors, ['[map-jr-gl] layers[0]: missing required property "source". The map draws what it can, but MapLibre GL JS rejects the style. Add what the style specification requires.']);
    const skipped: string[] = [];
    zoomCurveErrors(styles[2], new Set(), e => skipped.push(e.message), true);
    assert.deepEqual(skipped, []);
});
