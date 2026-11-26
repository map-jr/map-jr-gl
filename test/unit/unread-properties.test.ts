// The properties that the map accepts and does not read give one warning in the development build (#648): the layout
// properties that MapLibre GL JS reads and this library does not, and `volatile` of a source, which MapLibre GL JS 6.17
// does not read either.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {check, type Checked} from '../../src/mistakes.ts';

const run = (style: object, description?: object) => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        check(c, 4, style, description);
        check(c, 4, style, description);
    } finally { console.warn = warn; }
    return warnings;
};
const noEffect = (where: string, property: string) => `[map-jr-gl] E648 ${where}: "${property}" has no effect, because this library does not read it, while MapLibre GL JS does. Remove the property, or see docs/reference/maplibre-differences.md.`;

test('unread properties: each warns once for each layer or source that sets it to a value other than the default', () => {
    const style = {version: 8, sources: {
        v: {type: 'vector', url: 'https://example.com/v.json', volatile: true},
        r: {type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}.png'], volatile: false},
    }, layers: [
        {id: 'a', type: 'symbol', source: 'v', layout: {'text-field': 'A', 'symbol-height-offset': 10, 'symbol-height-anchor': 'absolute', 'text-writing-mode': ['vertical', 'horizontal']}},
        {id: 'b', type: 'fill-extrusion', source: 'v', layout: {'fill-extrusion-rounded-corner-distance': 2}},
        // (The defaults draw the same as in MapLibre GL JS: no warning.)
        {id: 'c', type: 'symbol', source: 'v', layout: {'text-field': 'C', 'symbol-height-offset': 0, 'symbol-height-anchor': 'ground', 'text-writing-mode': ['horizontal']}},
        {id: 'd', type: 'fill-extrusion', source: 'v', layout: {'fill-extrusion-rounded-corner-distance': 0}},
        // (MapLibre GL JS reads these symbol properties only at a point, so a layer along a line gives no warning.)
        {id: 'l', type: 'symbol', source: 'v', layout: {'text-field': 'L', 'symbol-placement': 'line', 'symbol-height-offset': 10, 'text-writing-mode': ['vertical']}},
    ]};
    const description = {sources: {g: {type: 'geojson', data: {type: 'FeatureCollection', features: []}, volatile: true}}, layers: []};
    assert.deepEqual(run(style, description), [
        noEffect('the symbol layer "a"', 'symbol-height-offset'),
        noEffect('the symbol layer "a"', 'symbol-height-anchor'),
        noEffect('the symbol layer "a"', 'text-writing-mode'),
        noEffect('the fill-extrusion layer "b"', 'fill-extrusion-rounded-corner-distance'),
        '[map-jr-gl] E20648 the source "v": "volatile" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.',
        '[map-jr-gl] E20648 the source "g": "volatile" has no effect, as in MapLibre GL JS, which does not read it. Remove the property.',
    ]);
});
