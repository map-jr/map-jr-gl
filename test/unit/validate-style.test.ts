// The development build of the compat entry fires `error` with the text of MapLibre GL JS for a required field that a
// layer or a source of the style lacks, a value of the wrong type and an expression of the wrong type, and
// the map option `validateStyle: false` skips that check (#1748).
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
    // Step 3: the types of expressions, wrong arguments, unknown operators, and data expressions where the property takes none.
    {sources: {g: {type: 'geojson', data: fc}}, layers: [
        {id: 'a', type: 'line', source: 'g', layout: {'line-cap': ['get', 'cap'], 'line-join': ['feature-state', 'j'], 'line-sort-key': ['+', ['get', 'k'], 1]},
            paint: {'line-width': ['concat', 'a', 'b'], 'line-opacity': ['+', ['get', 'x'], 'a'], 'line-color': ['to-string', 1], 'line-translate': ['get', 't'],
                'line-blur': ['interpolate', ['linear'], ['zoom'], 0, 'a', 1, 2], 'line-offset': ['let', '$a', 1, ['var', '$a']], 'line-gap-width': ['step', ['zoom'], 1, 1, 2, 1, 3]}},
        {id: 'b', type: 'circle', source: 'g', paint: {'circle-radius': ['abs'], 'circle-color': ['match', ['get', 'c'], 'a', 'red', 0, 'blue', 'green'], 'circle-blur': ['at', 0, ['literal', ['a']]],
            'circle-opacity': ['case', ['get', 'b'], 1, 0], 'circle-stroke-width': ['length', 3], 'circle-translate': ['literal', [1, 2]], 'circle-stroke-color': ['coalesce', ['get', 'c'], 'red']}},
        {id: 'c', type: 'background', paint: {'background-color': ['get', 'c'], 'background-opacity': ['==', 1, 'a']}},
        {id: 'd', type: 'symbol', source: 'g', layout: {'text-field': ['format', ['get', 'name'], {'font-scale': 'big'}], 'icon-image': ['image', 3], 'text-size': ['number', ['get', 's'], 12],
            'symbol-placement': ['interpolate', ['linear'], ['zoom'], 0, 1, 1, 2], 'text-offset': ['semiliteral', [1, 'top']]}, paint: {'text-color': ['rgb', 1, 2]}},
        {id: 'e', type: 'fill', source: 'g', paint: {'fill-color': ['to-color', ['get', 'c']], 'fill-opacity': ['global-state', 'o'], 'fill-pattern': ['get', 'p']}},
    ]},
    // Step 4: filters (the legacy syntax and expressions) and the `text-font` that is not a literal.
    {sources: {g: {type: 'geojson', data: fc}}, layers: [
        {id: 'a', type: 'fill', source: 'g', filter: 5}, {id: 'b', type: 'fill', source: 'g', filter: []}, {id: 'c', type: 'fill', source: 'g', filter: true},
        {id: 'd', type: 'fill', source: 'g', filter: ['==', 'a', 1, 2]}, {id: 'e', type: 'fill', source: 'g', filter: ['>', '$type', 'Point']},
        {id: 'f', type: 'fill', source: 'g', filter: ['in', 'a', 1, 'b', null, [1]]}, {id: 'g', type: 'fill', source: 'g', filter: ['in', '$type', 'Point', 'Circle']},
        {id: 'h', type: 'fill', source: 'g', filter: ['!in', 5, 1]}, {id: 'i', type: 'fill', source: 'g', filter: ['none', ['!has', 'a', 'b'], ['foo'], 3, ['!has', 4], []]},
        {id: 'j', type: 'fill', source: 'g', filter: ['has', 'a', 'b']}, {id: 'k', type: 'fill', source: 'g', filter: ['all', ['!in', 'a', 1], ['==', 'b', {}]]},
        {id: 'l', type: 'fill', source: 'g', filter: ['==', ['get', 'a'], 1]}, {id: 'm', type: 'fill', source: 'g', filter: ['get', 'a']},
        {id: 'n', type: 'fill', source: 'g', filter: ['foo', 1]}, {id: 'o', type: 'fill', source: 'g', filter: ['all', ['==', ['get', 'a'], 1], ['feature-state', 'x']]},
        {id: 'p', type: 'fill', source: 'g', filter: ['>', ['get', 'a'], ['zoom']]}, {id: 'q', type: 'fill', source: 'g', filter: ['case', ['get', 'a'], 1, 2]},
        {id: 'r', type: 'fill', source: 'g', filter: ['==', ['feature-state', 'a'], 1]}, {id: 's', type: 'fill', source: 'g', filter: ['has', 'a']},
        {id: 't', type: 'symbol', source: 'g', layout: {'text-font': ['get', 'font']}}, {id: 'u', type: 'symbol', source: 'g', layout: {'text-font': ['literal', ['Arial']]}},
        {id: 'v', type: 'symbol', source: 'g', layout: {'text-font': ['case', ['get', 'a'], ['literal', ['A']], ['literal', ['B']]]}},
        {id: 'w', type: 'symbol', source: 'g', layout: {'text-font': ['case', ['get', 'a'], ['literal', ['A']], ['get', 'f']]}},
        {id: 'x', type: 'symbol', source: 'g', layout: {'text-font': ['step', ['zoom'], ['literal', ['A']], 5, ['literal', ['B']]]}},
        {id: 'y', type: 'symbol', source: 'g', layout: {'text-font': ['match', ['get', 'a'], 'x', ['literal', ['A']], ['get', 'f']]}},
        {id: 'z', type: 'symbol', source: 'g', layout: {'text-font': ['coalesce', ['get', 'f'], ['literal', ['A']]]}},
        {id: 'A', type: 'symbol', source: 'g', layout: {'text-font': ['array', 'string', ['get', 'f']]}},
        {id: 'B', type: 'symbol', source: 'g', layout: {'text-font': ['let', 'a', ['literal', ['A']], ['var', 'a']]}},
        {id: 'C', type: 'symbol', source: 'g', layout: {'text-font': ['at', 0, ['literal', [['A']]]]}},
    ]},
];

test('src/style-spec-values.ts is what scripts/style-spec-values.mjs writes', async () => {
    const {source} = await import('../../scripts/style-spec-values.mjs');
    assert.equal(readFileSync(new URL('../../src/style-spec-values.ts', import.meta.url), 'utf8'), source(), 'Run node scripts/style-spec-values.mjs.');
});

test('the texts are those of MapLibre GL JS for each missing required field, each value of the wrong type and each expression of the wrong type', () => {
    for (const s of styles) {
        const ours: string[] = [];
        validateStyle(s, (where, why) => ours.push(`${where}: ${why}`));
        assert.deepEqual(ours.sort(), validateStyleMin({version: 8, ...s}).map(e => e.message).sort(), JSON.stringify(s));
    }
});

test('an array whose first element is an operator, such as ["round"], is an expression and gets the type check of expressions (#1748)', () => {
    const ours: string[] = [];
    validateStyle({sources: {g: {type: 'geojson', data: fc}}, layers: [{id: 'a', type: 'line', source: 'g', layout: {'line-cap': ['round']}, paint: {'line-width': ['get', 'w']}}]}, (where, why) => ours.push(`${where}: ${why}`));
    assert.deepEqual(ours, ['layers[0].layout.line-cap: Expected arguments of type (number), but found () instead.']);
    // (A name of the prototype of an object is not a variable. MapLibre GL JS 6.17 throws a TypeError for it.)
    const vars: string[] = [];
    validateStyle({sources: {g: {type: 'geojson', data: fc}}, layers: [{id: 'a', type: 'line', source: 'g', paint: {'line-width': ['var', 'constructor']}}]}, (where, why) => vars.push(`${where}: ${why}`));
    assert.deepEqual(vars, ['layers[0].paint.line-width[1]: Unknown variable "constructor". Make sure "constructor" has been bound in an enclosing "let" expression before using it.']);
});

test('the compat entry fires each error once, with the place and the text, and validateStyle: false skips it', () => {
    const errors: string[] = [], reported = new Set<string>();
    zoomCurveErrors(styles[2], reported, e => errors.push(e.message));
    zoomCurveErrors(styles[2], reported, e => errors.push(e.message));
    assert.deepEqual(errors, ['[map-jr-gl] E1748 layers[0]: missing required property "source". The map draws what it can, but MapLibre GL JS rejects the style. Correct it as the style specification requires.']);
    const skipped: string[] = [];
    zoomCurveErrors(styles[2], new Set(), e => skipped.push(e.message), true);
    assert.deepEqual(skipped, []);
});
