// The collision box of an icon along a line (#1774). As in MapLibre GL JS 6.17 (`CollisionFeature` with `alignLine`
// false), the box of the icon is not turned with the line: it is the box that the icon would have at a point. A box
// that is turned with a diagonal line is wider by up to the square root of 2, and drops a third of the icons that
// MapLibre GL JS draws along lines with a small `symbol-spacing`.
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
// A line from the top left to the bottom right of the tile, at 45 degrees on the screen.
const line = {type: 'LineString', coordinates: [[lngOf(tx + 0.1), latOf(ty + 0.1)], [lngOf(tx + 0.9), latOf(ty + 0.9)]]};

/** The boxes that the icons of 20 by 10 pixels along the line put in the grid, with `layout` added to the layer. */
function iconBoxes(layout: Record<string, unknown>, bearing = 0): number[][] {
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'icon-image': 'a', 'icon-padding': 2, 'symbol-placement': 'line', 'symbol-spacing': 100, ...layout}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: line} as any), z, tx, ty);
    const labels = buildTile(data, z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, bearing, 0);
    const boxes: number[][] = [];
    const grid = new CollisionGrid(), insert = grid.insert.bind(grid);
    grid.insert = (...b: [number, number, number, number]) => { boxes.push(b); return insert(...b); };
    const placed = (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid,
        () => ({x: 0, y: 0, width: 20, height: 10, pixelRatio: 1}));
    assert.ok(placed.length > 1 && placed.every((p: any) => p.icon) && boxes.length === placed.length, 'the icons are placed with one box each');
    return boxes;
}
const size = (b: number[]) => [b[2] - b[0], b[3] - b[1]];
const near = (a: number[], b: number[]) => assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-6), `${a} is not ${b}`);

test('the box of an icon along a line is not turned with the line (#1774)', () => {
    // (The icon is drawn along the line at 45 degrees; its box is the one of 20 by 10 pixels and padding 2.)
    for (const b of iconBoxes({})) near(size(b), [24, 14]);
});

test('the box of an icon along a line turns with icon-rotate and the bearing, as at a point (#1774)', () => {
    const side = 38 * Math.SQRT1_2;
    // `icon-rotate` 45 turns the box of 24 by 14 pixels to a square of 38 / sqrt(2) pixels a side.
    for (const b of iconBoxes({'icon-rotate': 45})) near(size(b), [side, side]);
    // At bearing 45 that square is turned by the bearing again, as `text-rotation-alignment` is `map` along a line (#2037).
    for (const b of iconBoxes({'icon-rotate': 45}, 45)) near(size(b), [38, 38]);
});

test('the icons of a long line with a small symbol-spacing are placed every spacing, as in MapLibre GL JS (#1774)', () => {
    // (The icons are 20 pixels wide every 24 pixels: a box turned with the line, 24 * sqrt(2) wide, drops every second one.)
    const all = iconBoxes({'symbol-spacing': 24, 'icon-padding': 1}).length, spaced = iconBoxes({'symbol-spacing': 48, 'icon-padding': 1}).length;
    assert.ok(all >= 2 * spaced - 1, `${all} icons at a spacing of 24 pixels, ${spaced} at 48`);
});
