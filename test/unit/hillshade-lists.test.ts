// Unit tests for the property types colorArray and numberArray of the hillshade lights (#656).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer, hillshadeLights, transition} from '../../src/style.ts';

const layer = (paint: Record<string, unknown>) => ({id: 'h', type: 'hillshade', source: 's', paint});

test('hillshade lights take a single value and a list of values', () => {
    const l = compileLayer(layer({'hillshade-method': 'multidirectional', 'hillshade-illumination-direction': [0, 90], 'hillshade-highlight-color': ['#fff', '#f00'], 'hillshade-shadow-color': '#000'}))!;
    const out = hillshadeLights(l.p, 0, 0);
    assert.equal(out.n, 2);
    assert.deepEqual(out.highlight, [1, 1, 1, 1, 1, 0, 0, 1]);
    assert.deepEqual(out.shadow, [0, 0, 0, 1, 0, 0, 0, 1]);
});

test('hillshade-illumination-altitude: 0 is a value, not the default', () => {
    const l = compileLayer(layer({'hillshade-illumination-altitude': 0}))!;
    assert.equal(hillshadeLights(l.p, 0, 0).sun[1], 0);
});

test('a transition of hillshade-highlight-color blends the colors, also when the value is a list', () => {
    const was = compileLayer(layer({'hillshade-highlight-color': '#000'}))!;
    const json = layer({'hillshade-highlight-color': '#fff', 'hillshade-highlight-color-transition': {duration: 1e9, delay: 0}});
    const l = compileLayer(json)!;
    transition(l, json, was, undefined, performance.now() - 5e8);
    const [c] = l.p.highlight.eval(0) as number[][];
    assert.ok(c[0] > 0.3 && c[0] < 0.7, `the color is half-way, not ${JSON.stringify(c)}`);
});
