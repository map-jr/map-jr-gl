// The development build names a paint or layout property that the style specification does not have for the type of
// the layer, once for each layer and property, with the nearest property of that type (#1139).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {check, layerProperties, zoomCurveErrors, type Checked} from '../../src/mistakes.ts';

// (The style specification that MapLibre GL JS of the devDependencies uses.)
const require = createRequire(createRequire(import.meta.url).resolve('maplibre-gl/package.json'));
const spec = JSON.parse(readFileSync(require.resolve('@maplibre/maplibre-gl-style-spec/package.json').replace(/package\.json$/, 'dist/latest.json'), 'utf8'));

test('the known properties of each layer type are those of the style specification', () => {
    for (const type of Object.keys(spec.layer.type.values)) {
        const want = [...Object.keys(spec['paint_' + type] ?? {}), ...Object.keys(spec['layout_' + type] ?? {})].sort();
        assert.deepEqual([...new Set(layerProperties(type))].sort(), want, type);
    }
    assert.equal(layerProperties('custom'), undefined);
});

const style = {layers: [
    {id: 'c', type: 'circle', source: 's', paint: {'circle-colour': 'red', 'circle-radius': 4, 'circle-radius-transition': {duration: 0}, 'zzz-unknown': 1}, layout: {visibility: 'visible'}},
    {id: 'l', type: 'line', source: 's', paint: {'line-gradient': ['get', 'a']}, layout: {lineCap: 'round'}},
    {id: 'x', type: 'custom'},
]};

test('the main API warns once for each layer and unknown property, with the nearest name', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        const c = {map: {}, warned: new Set<string>(), spec: () => ({}), ready: () => false} as unknown as Checked;
        check(c, 4, style);
        check(c, 4, style, {layers: [style.layers[0]]});
        assert.deepEqual(warnings.filter(w => w.includes(' property "')), [
            '[map-jr-gl] the circle layer "c", paint property "circle-colour": a layer of this type has no such property in the style specification, so the map ignores it. Write "circle-color".',
            '[map-jr-gl] the circle layer "c", paint property "zzz-unknown": a layer of this type has no such property in the style specification, so the map ignores it. Check the name in the style specification, or remove it.',
            '[map-jr-gl] the line layer "l", layout property "lineCap": a layer of this type has no such property in the style specification, so the map ignores it. Write "line-cap".',
        ]);
    } finally { console.warn = warn; }
});

test('the compat entry reports the error text of MapLibre GL JS once for each layer and property', () => {
    const errors: string[] = [], reported = new Set<string>();
    zoomCurveErrors(style, reported, e => errors.push(e.message));
    zoomCurveErrors(style, reported, e => errors.push(e.message));
    // (The first is the type check of expressions of #1748: "line-gradient" takes no data expression in MapLibre GL JS.)
    assert.equal(errors.length, 4, JSON.stringify(errors));
    assert.ok(errors[0].startsWith('[map-jr-gl] layers[1].paint.line-gradient: data expressions not supported.'), errors[0]);
    errors.shift();
    assert.equal(errors[0], '[map-jr-gl] layers.c.paint.circle-colour: unknown property "circle-colour". The map draws the layer without it, but MapLibre GL JS rejects the style. Write "circle-color".');
    assert.ok(errors[2].startsWith('[map-jr-gl] layers.l.layout.lineCap: unknown property "lineCap".'), errors[2]);
});
