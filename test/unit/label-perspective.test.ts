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
