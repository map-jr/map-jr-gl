// `raster-resampling`, `resampling`, `raster-layer-blend` and `raster-fade-duration` (#1013). Run with: pnpm test:unit
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer, withFilter} from '../../src/style.ts';

const layer = (type: string, paint: object) => compileLayer({id: 'r', type, source: 's', paint} as any)!.p;
const resampling = (p: ReturnType<typeof layer>) => p.resampling?.eval(0) ?? p.rasterResampling?.eval(0);

test('raster: raster-resampling and resampling are read, and resampling comes first', () => {
    assert.equal(resampling(layer('raster', {})), 'linear');
    assert.equal(resampling(layer('raster', {'raster-resampling': 'nearest'})), 'nearest');
    assert.equal(resampling(layer('raster', {resampling: 'nearest', 'raster-resampling': 'linear'})), 'nearest');
});

test('hillshade and color-relief: resampling is read', () => {
    assert.equal(resampling(layer('hillshade', {resampling: 'nearest'})), 'nearest');
    assert.equal(resampling(layer('color-relief', {resampling: 'nearest'})), 'nearest');
    assert.equal(resampling(layer('color-relief', {})), 'linear');
});

test('raster: raster-layer-blend is read', () => {
    assert.equal(layer('raster', {'raster-layer-blend': 'multiply'}).layerBlend?.eval(0), 'multiply');
    assert.equal(layer('raster', {}).layerBlend?.eval(0), 'normal');
});

test('raster: raster-fade-duration is read, with the default 300, and writes no warning (#1694)', () => {
    const warnings: string[] = [], warn = console.warn;
    console.warn = (m: string) => { warnings.push(m); };
    try {
        assert.equal(layer('raster', {}).fadeDuration?.eval(0), 300);
        assert.equal(layer('raster', {'raster-fade-duration': 500}).fadeDuration?.eval(0), 500);
        assert.equal(warnings.filter(m => m.includes('raster-fade-duration')).length, 0);
    } finally { console.warn = warn; }
});

test('withFilter: a draw with nearest leaves the texture linear, and a linear draw changes nothing', () => {
    const filter: Record<number, number> = {}, gl = {TEXTURE_2D: 1, TEXTURE_MIN_FILTER: 2, TEXTURE_MAG_FILTER: 3, LINEAR: 4, texParameteri: (_: number, k: number, v: number) => { filter[k] = v; }};
    let during: number[] = [];
    withFilter(gl as any, 5, () => { during = [filter[2], filter[3]]; });
    assert.deepEqual(during, [5, 5]);
    assert.deepEqual([filter[2], filter[3]], [4, 4]);
    delete filter[2]; delete filter[3];
    withFilter(gl as any, 4, () => {});
    assert.deepEqual(filter, {});
});
