// The space that text along a line takes (#2462). As in MapLibre GL JS (`placeCollisionCircles`), it is a row of circles
// of the height of the text and `text-padding`, with their centers 2.5 radii apart, and not a square at each glyph:
// the squares took about 10% more space and dropped about a tenth of the labels and of the road shields along lines.
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

/** What the text along lines at 45 degrees puts into the grid, and the placed labels. `shifts` moves each line to the right (in tiles). */
function place(layout: Record<string, unknown>, shifts = [0]) {
    const features = shifts.map((d, i) => ({type: 'Feature', properties: {name: `Main Street ${i}`}, geometry: {type: 'LineString', coordinates: [0.3, 0.5, 0.7].map(v => [lngOf(tx + v + d), latOf(ty + v)])}}));
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': ['get', 'name'], 'text-size': 16, 'symbol-placement': 'line', 'symbol-spacing': 1000, ...layout}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features} as any), z, tx, ty);
    const labels = buildTile(data, z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, 0, 0);
    const entries: number[][] = [];
    const grid = new CollisionGrid(), insert = grid.insert.bind(grid);
    grid.insert = (...b: [number, number, number, number, number?]) => { entries.push(b); return insert(...b); };
    const placed = (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid);
    return {entries, placed};
}

test('a circle and a box in the grid overlap as in MapLibre GL JS (#2462)', () => {
    const grid = new CollisionGrid();
    grid.insert(-10, -10, 10, 10, 10);
    // The bounds overlap at the corner, and the circle does not reach it.
    assert.equal(grid.hits(8, 8, 20, 20), false);
    assert.equal(grid.hits(6, 6, 20, 20), true);
    // A box beside the circle.
    assert.equal(grid.hits(9, -2, 20, 2), true);
    // Two circles: their centers are 21.2 pixels apart on the diagonal, more than the radii together.
    assert.equal(grid.hits(5, 5, 25, 25, 10), false);
    assert.equal(grid.hits(9, -10, 29, 10, 10), true);
    // A circle that is asked for against a box in the grid.
    grid.insert(100, 100, 120, 120);
    assert.equal(grid.hits(78, 78, 98, 98, 10), false);
    assert.equal(grid.hits(85, 100, 105, 120, 10), true);
});

test('text along a line takes space as circles 2.5 radii apart, as in MapLibre GL JS (#2462)', () => {
    const {entries, placed} = place({'text-padding': 2});
    assert.equal(placed.length, 1, 'the text is placed once');
    assert.ok(placed[0].curve, 'the text follows the line');
    assert.ok(entries.length >= 2, `${entries.length} entries`);
    const r = entries[0][4]!, glyphs = placed[0].curve.length / 3;
    // The radius is half the height of the text (a line height of 1.2 em at 16 pixels) and the padding.
    assert.ok(Math.abs(r - (16 * 1.2 / 2 + 2)) < 0.5, `the radius is ${r}`);
    // Fewer circles than glyphs, at even steps of at most 2.5 radii.
    assert.ok(entries.length < glyphs, `${entries.length} circles for ${glyphs} glyphs`);
    const c = entries.map(b => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]), steps = c.slice(1).map((p, i) => Math.hypot(p[0] - c[i][0], p[1] - c[i][1]));
    for (const s of steps) assert.ok(s <= 2.5 * r + 1e-6 && Math.abs(s - steps[0]) < 0.5, `steps ${steps}`);
    for (const b of entries) assert.ok(Math.abs(b[2] - b[0] - 2 * r) < 1e-6 && b[4] === r, `${b}`);
});

test('text along two lines close together is placed on both, as in MapLibre GL JS (#2462)', () => {
    // Two lines at 45 degrees, 38.4 pixels apart on the x axis, are 27.2 pixels apart across: more than the two radii of
    // 11.6 pixels. A square at each glyph reaches 1.41 radii across the line, so the squares of the two texts overlapped.
    assert.equal(place({'text-padding': 2}, [0, 0.075]).placed.length, 2);
    // At 30.7 pixels on the x axis the circles overlap too.
    assert.equal(place({'text-padding': 2}, [0, 0.06]).placed.length, 1);
});
