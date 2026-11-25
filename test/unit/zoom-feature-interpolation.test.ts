// A line, circle or heatmap property whose expression depends on the zoom and the feature changes smoothly between
// whole zooms, as in MapLibre GL JS, and not only at the zoom of each tile (#1950). The tile keeps the change of the value
// to the next zoom (`next`, or the second number of `sb` and `radius1` for a heatmap), and the shader adds `u_zt` times
// it, as for `line-width`. The checks model the shader at zoom 11.5 on a tile of zoom 11 (u_zt = 0.5) and compare with
// what the style specification of MapLibre GL JS evaluates at 11.5.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {compileLayer} from '../../src/style.ts';
import {buildTile, tessellate} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';

const require = createRequire(createRequire(import.meta.url).resolve('maplibre-gl/package.json'));
const spec = require('@maplibre/maplibre-gl-style-spec');
const z = 11, tx = 600, ty = 760, n = 2 ** z, zoom = 11.5, zt = zoom - z;
const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
const properties = {g: 4};
const point = {type: 'Feature', properties, geometry: {type: 'Point', coordinates: [lng, lat]}};
const line = {type: 'Feature', properties, geometry: {type: 'LineString', coordinates: [[lng - 0.01, lat], [lng + 0.01, lat]]}};
const ramp = (e: unknown) => ['interpolate', ['linear'], ['zoom'], 10, e, 13, ['*', 3, e]];
const g = ['number', ['get', 'g']];
const maplibre = (group: string, name: string, value: unknown) => {
    const e = spec.createPropertyExpression(value, `layers[0].paint.${name}`, spec.v8[group][name]);
    assert.equal(e.result, 'success', JSON.stringify(e.value));
    return e.value.evaluate({zoom}, {type: 'Point', properties});
};
// (The buffers keep 32-bit floats, and `line-offset` eighths of a pixel.)
const near = (actual: number, expected: number, what: string, tolerance = 1e-5) => assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual}, and ${expected} in MapLibre GL JS`);
const batch = (type: string, paint: Record<string, unknown>, feature: object) =>
    tessellate(buildTile(sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: [feature]} as any), z, tx, ty), z, [compileLayer({id: 'l', type, source: 'g', paint})!], false).layers.l)! as any;

test('line-offset, line-blur and line-gap-width of zoom and feature change between whole zooms (#1950)', () => {
    const value = ramp(g);
    const b = batch('line', {'line-offset': value, 'line-blur': value, 'line-gap-width': ramp(['+', 1, g])}, line);
    // The shader: the offset is a_offset / 8 + u_zt * a_next.x, the blur a_blur + u_zt * a_next.y, the gap a_gap + u_zt * a_next.z.
    const view = new DataView(b.v.buffer, b.v.byteOffset), next = b.next ?? [0, 0, 0];
    const offset = view.getInt16(10, true) / 8 + zt * next[0], blur = b.blur[0] + zt * next[1], gap = b.gap[0] + zt * next[2];
    near(offset, maplibre('paint_line', 'line-offset', value), 'line-offset', 1 / 16);
    near(blur, maplibre('paint_line', 'line-blur', value), 'line-blur');
    near(gap, maplibre('paint_line', 'line-gap-width', ramp(['+', 1, g])), 'line-gap-width');
    near(gap, 10, 'g = 4: 5 + 5 * 2 * 1.5 / 3');
    assert.equal(batch('line', {'line-blur': ['get', 'g'], 'line-gap-width': ['zoom']}, line).next, undefined, 'a value of the feature alone needs no second buffer');
});

test('circle-stroke-width, circle-blur and circle-stroke-color and -opacity of zoom and feature change between whole zooms (#1950)', () => {
    const value = ramp(g);
    const color = ['interpolate', ['linear'], ['zoom'], 10, ['rgb', 0, 0, ['*', 10, g]], 13, ['rgb', 0, 0, ['*', 40, g]]];
    const opacity = ['interpolate', ['linear'], ['zoom'], 10, ['/', g, 40], 13, ['/', g, 5]];
    const b = batch('circle', {'circle-stroke-width': value, 'circle-blur': ramp(['/', g, 10]), 'circle-stroke-color': color, 'circle-stroke-opacity': opacity}, point);
    // The shader: a_sb + u_zt * a_sb1 and a_stroke + u_zt * a_stroke1, from the 6 numbers of `next` of each vertex.
    assert.equal(b.next?.length, b.sb.length * 3);
    near(b.sb[0] + zt * b.next[0], maplibre('paint_circle', 'circle-stroke-width', value), 'circle-stroke-width');
    near(b.sb[1] + zt * b.next[1], maplibre('paint_circle', 'circle-blur', ramp(['/', g, 10])), 'circle-blur');
    const c = maplibre('paint_circle', 'circle-stroke-color', color), a = maplibre('paint_circle', 'circle-stroke-opacity', opacity);
    near(b.stroke[2] / 255 + zt * b.next[4], c.b, 'blue of circle-stroke-color', 1 / 255);
    near(b.stroke[3] / 255 + zt * b.next[5], a, 'circle-stroke-opacity', 1 / 255);
    assert.equal(batch('circle', {'circle-stroke-width': ['get', 'g'], 'circle-stroke-color': ['case', ['>', ['get', 'g'], 2], 'red', 'blue']}, point).next, undefined, 'values of the feature alone need no second buffer');
});

test('heatmap-weight and heatmap-radius of zoom and feature change between whole zooms (#1950)', () => {
    const value = ramp(g);
    const b = batch('heatmap', {'heatmap-weight': value, 'heatmap-radius': value}, point);
    // The shader: mix(a_weight, a_weight1, u_zt) and mix(a_radius.x, a_radius.y, u_zt).
    near(b.radius[0] + zt * ((b.radius1 ?? b.radius)[0] - b.radius[0]), maplibre('paint_heatmap', 'heatmap-weight', value), 'heatmap-weight');
    near(b.sb[0] + zt * (b.sb[1] - b.sb[0]), maplibre('paint_heatmap', 'heatmap-radius', value), 'heatmap-radius');
});
