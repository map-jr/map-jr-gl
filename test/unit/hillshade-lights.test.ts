// The lights of a `hillshade` layer (#569): `hillshade-method`, `hillshade-illumination-altitude` and the properties
// that take a list of values. Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer, hillshadeLights, LIGHTS} from '../../src/style.ts';

const lights = (paint: object, zoom = 0, bearing = 0) => hillshadeLights(compileLayer({id: 'h', type: 'hillshade', source: 'dem', paint} as any)!.p, zoom, bearing);
const near = (a: number[], b: number[]) => { assert.equal(a.length, b.length); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${a} is not ${b}`)); };
const rad = Math.PI / 180;

test('hillshade: without the properties, the method is standard with one light from 335 degrees at 45 degrees', () => {
    const h = lights({});
    assert.equal(h.method, 0);
    assert.equal(h.n, 1);
    near(h.sun, [335 * rad, 45 * rad]);
    assert.deepEqual(h.shadow, [0, 0, 0, 1]);
    assert.deepEqual(h.highlight, [1, 1, 1, 1]);
});

test('hillshade: each method has its number, and basic is multidirectional with one light', () => {
    assert.deepEqual(['standard', 'combined', 'igor', 'multidirectional', 'basic'].map(m => lights({'hillshade-method': m}).method), [0, 1, 2, 3, 3]);
    const h = lights({'hillshade-method': 'basic', 'hillshade-illumination-altitude': 60, 'hillshade-illumination-direction': 90, 'hillshade-shadow-color': 'rgba(255, 0, 0, 0.5)'}, 0, 0.25);
    assert.equal(h.n, 1);
    near(h.sun, [90 * rad + 0.25, 60 * rad]);
    near(h.shadow, [0.5, 0, 0, 0.5]);
});

test('hillshade: multidirectional has a light for each value of the longest list, and a shorter list repeats its last value', () => {
    const h = lights({'hillshade-method': 'multidirectional', 'hillshade-illumination-direction': [270, 315, 0], 'hillshade-illumination-altitude': [30, 60],
        'hillshade-highlight-color': ['#f00', '#0f0', '#00f'], 'hillshade-shadow-color': '#fff'});
    assert.equal(h.n, 3);
    near(h.sun, [270 * rad, 30 * rad, 315 * rad, 60 * rad, 0, 60 * rad]);
    assert.deepEqual(h.highlight, [1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]);
    assert.deepEqual(h.shadow, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
});

test('hillshade: the other methods use the first value of a list', () => {
    const h = lights({'hillshade-method': 'combined', 'hillshade-illumination-direction': [270, 315], 'hillshade-highlight-color': ['#f00', '#0f0']});
    assert.equal(h.n, 1);
    near(h.sun, [270 * rad, 45 * rad]);
    assert.deepEqual(h.highlight, [1, 0, 0, 1]);
});

test('hillshade: expressions and legacy functions of the zoom give one value or a list', () => {
    const h = lights({'hillshade-method': 'multidirectional', 'hillshade-illumination-altitude': ['interpolate', ['linear'], ['zoom'], 0, 10, 10, 50],
        'hillshade-highlight-color': ['interpolate', ['linear'], ['zoom'], 0, '#000', 10, '#f00'], 'hillshade-shadow-color': {stops: [[0, '#000'], [10, '#00f']]},
        'hillshade-illumination-direction': ['step', ['zoom'], ['literal', [10, 20]], 8, ['literal', [30, 40]]]}, 5);
    assert.equal(h.n, 2);
    near(h.sun, [10 * rad, 30 * rad, 20 * rad, 30 * rad]);
    near(h.highlight, [0.5, 0, 0, 1, 0.5, 0, 0, 1]);
    near(h.shadow, [0, 0, 0.5, 1, 0, 0, 0.5, 1]);
});

test('hillshade: a value that is not valid gives the default, and too many lights and an unknown method warn once', () => {
    const said: string[] = [], warn = console.warn;
    console.warn = (m: string) => { said.push(m); };
    try {
        const many = Array.from({length: LIGHTS + 3}, (_, i) => i);
        for (let i = 0; i < 2; i++) {
            assert.equal(lights({'hillshade-method': 'multidirectional', 'hillshade-illumination-direction': many}).n, LIGHTS);
            assert.equal(lights({'hillshade-method': 'soft'}).method, 0);
        }
        const h = lights({'hillshade-method': 'multidirectional', 'hillshade-illumination-direction': [null, 'north'], 'hillshade-illumination-altitude': [], 'hillshade-highlight-color': [null, 'no colour'], 'hillshade-shadow-color': []});
        near(h.sun, [335 * rad, 45 * rad, 335 * rad, 45 * rad]);
        assert.deepEqual(h.highlight, [1, 1, 1, 1, 1, 1, 1, 1]);
        assert.deepEqual(h.shadow, [0, 0, 0, 1, 0, 0, 0, 1]);
    } finally { console.warn = warn; }
    assert.equal(said.length, 2, said.join('\n'));
    assert.match(said[0], /^\[map-jr-gl\] hillshade: a layer has 11 lights, and the layer draws the first 8\./);
    assert.match(said[1], /^\[map-jr-gl\] hillshade-method: "soft" is not a method, and the layer uses "standard"\./);
});
