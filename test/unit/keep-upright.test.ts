// `text-keep-upright` and `icon-keep-upright` (#1006): with `false`, a label along a line follows the direction of the
// line, as in MapLibre GL JS, also where that direction reads upside down.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';
import {CollisionGrid, placeLabels, renderItems} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

const z = 14, tx = 8000, ty = 5000, n = 2 ** z;
const lngOf = (x: number) => x / n * 360 - 180, latOf = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
const id = {z, x: tx, y: ty, w: 0, key: `${z}/${tx}/${ty}`};
// A line that runs from east to west, so that text along it in its own direction reads upside down.
const line = {type: 'LineString', coordinates: [[lngOf(tx + 0.9), latOf(ty + 0.5)], [lngOf(tx + 0.1), latOf(ty + 0.5)]]};

/** The first label of the line, placed on a map with no pitch. `icon`: the layer has an icon of 20 pixels. */
function place(layout: Record<string, unknown>, geometry: unknown = line, pitch = 0, icon = false): any {
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': 'Main Street', 'text-size': 16, ...layout}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry} as any), z, tx, ty);
    const labels = buildTile(data, z, [layer], true).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600; tr.maxPitch = 90;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, 0, pitch);
    const icons = icon ? () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any) : undefined;
    return (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid(), icons)[0];
}

test('text along a line turns over to stay upright by default, and follows the line with text-keep-upright false', () => {
    const up = place({'symbol-placement': 'line'}).curve, along = place({'symbol-placement': 'line', 'text-keep-upright': false}).curve;
    // The curve has x, y and the angle of each glyph. The line runs to the west (an angle of pi on the screen).
    assert.ok(up[0] < up[up.length - 3] && Math.abs(up[2]) < 1e-6, 'upright text reads from west to east');
    assert.ok(along[0] > along[along.length - 3] && Math.abs(Math.abs(along[2]) - Math.PI) < 1e-6, 'the text reads from east to west');
});
test('a line of text that does not bend follows text-keep-upright too', () => {
    const angle = (keep: boolean) => place({'symbol-placement': 'line', 'text-field': 'Main\nStreet', 'text-keep-upright': keep}).angle;
    assert.ok(Math.abs(angle(true)) < 1e-6, `upright: ${angle(true)}`);
    assert.ok(Math.abs(Math.abs(angle(false)) - Math.PI) < 1e-6, `along: ${angle(false)}`);
});
test('an icon along a line (beside its text) follows the line, and turns over with icon-keep-upright true', () => {
    const angle = (keep?: boolean) => place({'symbol-placement': 'line', 'icon-image': 'a', 'icon-allow-overlap': true, ...(keep === undefined ? {} : {'icon-keep-upright': keep})}, line, 0, true)?.icon?.angle;
    assert.ok(Math.abs(Math.cos(angle()) + 1) < 1e-6, `default: ${angle()}`);
    assert.ok(Math.abs(Math.cos(angle(true)) - 1) < 1e-6, `upright: ${angle(true)}`);
});
test('an icon along a line is not dropped because of its own bent text (#1072)', () => {
    const placed = place({'symbol-placement': 'line', 'icon-image': 'a'}, line, 0, true);
    assert.ok(placed?.curve, 'the text follows the line');
    assert.ok(placed.icon, 'the icon is placed with its text');
});
