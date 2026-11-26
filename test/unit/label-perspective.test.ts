// On a tilted map, labels that the frames move between placements grow and shrink with their distance from the
// camera, as at their next placement, and do not change size in a step at each placement (#914).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';
import * as placement from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

const {CollisionGrid, placeLabels, renderItems} = placement;
const z = 14, tx = 8000, ty = 5000, n = 2 ** z;
const lngOf = (x: number) => x / n * 360 - 180, latOf = (y: number) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
const id = {z, x: tx, y: ty, w: 0, key: `${z}/${tx}/${ty}`};

/** The label of one feature, placed with the camera at `cy` (in tiles) and the pitch. */
function place(layout: Record<string, unknown>, geometry: any, cy: number, pitch: number, icon = false) {
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': 'Main Street', 'text-size': 16, ...layout}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry}), z, tx, ty);
    const labels = buildTile(data, z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.maxPitch = 90;
    tr.set([lngOf(tx + 0.5), latOf(cy)], z, 0, pitch);
    const icons = icon ? () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any) : undefined;
    const [p] = (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid(), icons);
    return {tr, p};
}

/** The width on the screen of the first glyph (for ground text, with its length along the line). */
const width = (p: any) => p.size * (p.ground?.[0] ?? 1);

const cases: [string, Record<string, unknown>, unknown][] = [
    ['text along a line', {'symbol-placement': 'line'}, {type: 'LineString', coordinates: [[lngOf(tx + 0.1), latOf(ty + 0.5)], [lngOf(tx + 0.9), latOf(ty + 0.5)]]}],
    ['text at a point', {}, {type: 'Point', coordinates: [lngOf(tx + 0.5), latOf(ty + 0.5)]}],
];
for (const [name, layout, geometry] of cases) for (const pitch of [60, 85]) test(`moveLabel: ${name} at pitch ${pitch} has the size of a new placement after a pan`, () => {
    const move = (placement as any).moveLabel;
    const a = place(layout, geometry, ty + 0.8, pitch), b = place(layout, geometry, ty + 0.9, pitch);
    assert.ok(a.p && b.p, 'the label is placed');
    const d = {...a.p, curve: a.p.curve?.slice(), ground: a.p.ground?.slice()};
    const q = b.tr.projectTile(id, a.p.src.x, a.p.src.y);
    // (Without moveLabel, a frame moved the copy and kept its size until the next placement.)
    if (move) move(b.tr, a.p, d, q[0], q[1], q[2], 0, false);
    const step = width(b.p) / width(a.p) - 1, left = width(b.p) / width(d) - 1;
    console.log(`${name}, pitch ${pitch}: the pan changes the size by ${(step * 100).toFixed(2)} %, the moved label is ${(left * 100).toFixed(2)} % off`);
    assert.ok(Math.abs(step) > 0.01, `the pan changes the size by ${step}`);
    assert.ok(Math.abs(left) < Math.abs(step) / 5, `the moved label is ${(left * 100).toFixed(2)} % off the new placement; the pan changes its size by ${(step * 100).toFixed(2)} %`);
});

// An icon keeps its place at its anchor between placements: its offset from the anchor grows as the icon does, not as
// the text does (#2029; with `icon-offset` the icon has no perspective ratio, and the text keeps it). On the ground the
// frame of the icon is not found again between placements, so the moved icon is near its next placement, not on it.
for (const [align, near] of [['viewport', 0.01], ['map', 0.05]] as const) test(`moveLabel: an icon with icon-offset and icon-pitch-alignment ${align} stays where its next placement puts it`, () => {
    const layout = {'icon-image': 'a', 'icon-offset': [0, -30], 'icon-pitch-alignment': align}, geometry = cases[1][2];
    const a = place(layout, geometry, ty + 0.8, 60, true), b = place(layout, geometry, ty + 0.9, 60, true);
    assert.ok(a.p?.icon && b.p?.icon, 'the icon is placed');
    const d = {...a.p, icon: {...a.p.icon, frame: a.p.icon.frame?.slice()}, frame: a.p.frame?.slice()};
    const q = b.tr.projectTile(id, a.p.src.x, a.p.src.y);
    (placement as any).moveLabel(b.tr, a.p, d, q[0], q[1], q[2], 0, false);
    const moved = d.icon.y - q[1], placed = b.p.icon.y - b.p.ay;
    assert.ok(Math.abs(moved - placed) < Math.abs(placed) * near, `the moved icon is ${moved.toFixed(2)} px from its anchor, the new placement ${placed.toFixed(2)} px`);
});

// MapLibre GL JS draws the icons of a layer with `icon-offset` without the perspective ratio, but its collision box
// keeps the ratio (`CollisionIndex.placeCollisionBox`): the box and its offset from the anchor grow toward the camera
// as for a layer without `icon-offset` (#2058).
for (const align of ['viewport', 'map'] as const) test(`placeLabels: the collision box of an icon with icon-offset and icon-pitch-alignment ${align} keeps the perspective ratio`, () => {
    const boxOf = (layout: Record<string, unknown>) => {
        const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'icon-image': 'a', 'icon-pitch-alignment': align, ...layout}})!;
        const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: cases[1][2] as any}), z, tx, ty);
        const labels = buildTile(data, z, [layer], false).labels;
        const tr = new Transform();
        tr.width = 800; tr.height = 600; tr.maxPitch = 90;
        tr.set([lngOf(tx + 0.5), latOf(ty + 0.8)], z, 0, 60);
        const boxes: number[][] = [], grid = new CollisionGrid(), insert = grid.insert.bind(grid);
        grid.insert = (...b: [number, number, number, number]) => { boxes.push(b); insert(...b); };
        const icons = () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any);
        (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid, icons);
        return boxes[0];
    };
    // A layer without `icon-offset` has the ratio. An offset of [0, 0] moves nothing, so its box is the same.
    const plain = boxOf({}), zero = boxOf({'icon-offset': [0, 0]}), moved = boxOf({'icon-offset': [0, -10]});
    assert.ok(plain && zero && moved, 'the icons are placed');
    // (The box has `icon-padding`, 2 px, on each side.)
    const h = plain[3] - plain[1] - 4;
    assert.ok(Math.abs(h - 20) > 1, `the ratio changes the height of the box (${h} px)`);
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(zero[i] - plain[i]) < 0.01, `the box with icon-offset [0, 0] is ${zero.map(v => v.toFixed(2))}, without it ${plain.map(v => v.toFixed(2))}`);
    // With an offset of half the icon, the box moves by half of its height, as the offset grows with the ratio too.
    assert.ok(Math.abs(moved[3] - moved[1] - (plain[3] - plain[1])) < 0.01, `the box is ${(moved[3] - moved[1]).toFixed(2)} px high, not ${(plain[3] - plain[1]).toFixed(2)}`);
    assert.ok(Math.abs(moved[1] - plain[1] + h / 2) < 0.05, `the box moves by ${(moved[1] - plain[1]).toFixed(2)} px, not ${(-h / 2).toFixed(2)}`);
});

// An icon that `icon-text-fit` stretches around its text takes its size from the text, which already has the ratio: its
// box does not get the ratio a second time when the layer has `icon-offset` (#2058).
test('placeLabels: the collision box of an icon fitted to its text is the same with icon-offset [0, 0] on a tilted map', () => {
    const boxesOf = (layout: Record<string, unknown>) => {
        const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'icon-image': 'a', 'text-field': 'Main', 'icon-text-fit': 'both', ...layout}})!;
        const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: cases[1][2] as any}), z, tx, ty);
        const labels = buildTile(data, z, [layer], false).labels;
        const tr = new Transform();
        tr.width = 800; tr.height = 600; tr.maxPitch = 90;
        tr.set([lngOf(tx + 0.5), latOf(ty + 0.8)], z, 0, 60);
        const boxes: number[][] = [], grid = new CollisionGrid(), insert = grid.insert.bind(grid);
        grid.insert = (...b: [number, number, number, number]) => { boxes.push(b); insert(...b); };
        const icons = () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any);
        (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid, icons);
        return boxes;
    };
    const plain = boxesOf({}), zero = boxesOf({'icon-offset': [0, 0]});
    assert.equal(plain.length, 2, 'the text and the icon are placed');
    for (let i = 0; i < 4; i++) assert.ok(Math.abs(zero[1][i] - plain[1][i]) < 0.01, `the box with icon-offset [0, 0] is ${zero[1].map(v => v.toFixed(2))}, without it ${plain[1].map(v => v.toFixed(2))}`);
});
