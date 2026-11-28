// A `line-gradient` with a `step` expression keeps hard steps, as in MapLibre GL JS, even where its stops are a
// millionth of the line apart (#1808; the render tests `line-gradient/gradient-step-zoomed*`). The layer has the stops,
// the shader takes the color of the last stop at or below the place along the line, and the vertices carry that place
// in 24 bits.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

const gradient = ['step', ['line-progress'], 'rgba(0, 0, 255, 0.5)', 0.03, '#f00', 0.4, '#0f0'];

test('line-gradient step: the layer has each stop and the color from each, the color of a stop as written', () => {
    const L = compileLayer({id: 'l', type: 'line', source: 'g', paint: {'line-gradient': gradient}})!;
    assert.deepEqual(Array.from(L.steps ?? []), [-1, Math.fround(0.03), Math.fround(0.4)]);
    // (0.03 as a 32-bit float is below 0.03: a color taken there would be the one before.)
    assert.deepEqual(Array.from(L.ramp!), [0, 0, 127, 127, 255, 0, 0, 255, 0, 255, 0, 255]);
    assert.equal(compileLayer({id: 'l', type: 'line', source: 'g', paint: {'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'red', 1, 'blue']}})!.steps, undefined);
});

test('line-gradient step: a vertex carries its place along the line in 24 bits', () => {
    const z = 10, tx = 300, ty = 380, n = 2 ** z;
    const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString',
        coordinates: [[lng - 0.05, lat], [lng + 0.05, lat]]}} as any), z, tx, ty);
    // The piece in this tile is the part from 0.000001 to 0.000004 of a much longer line.
    const f = Object.values(data)[0].features[0];
    f.properties = {...f.properties, mapbox_clip_start: 0.000001, mapbox_clip_end: 0.000004};
    const out = tessellate(buildTile(data, z, [compileLayer({id: 'l', type: 'line', source: 'g', paint: {'line-gradient': gradient}})!], false).layers.l)!;
    const places = new Set<number>();
    for (let i = 0; i < out.color!.length; i += 4) places.add((out.color![i] * 65536 + out.color![i + 1] * 256 + out.color![i + 2]) / 16777215);
    const sorted = [...places].sort((a, b) => a - b);
    assert.ok(Math.abs(sorted[0] - 0.000001) < 1e-7 && Math.abs(sorted[sorted.length - 1] - 0.000004) < 1e-7, `the places ${sorted}`);
});
