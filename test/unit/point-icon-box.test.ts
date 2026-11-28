// The collision box of an icon at a point on a tilted map (#2202). As in MapLibre GL JS 6.17 (`placeCollisionBox` and
// `_projectCollisionBox` with the `pitchWithMap` and `rotateWithMap` of the layer), `text-pitch-alignment` and
// `text-rotation-alignment` decide whether the box lies on the ground and whether it turns with the map, whatever
// `icon-pitch-alignment` and `icon-rotation-alignment` are.
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

/** The boxes that the icon of 20 by 10 pixels (with `icon-padding` 2) at the center of the map, and its text, put in the grid. */
function boxesAt(layout: Record<string, unknown>, bearing: number, pitch: number): number[][] {
    const layer = compileLayer({id: 'p', type: 'symbol', source: 'g', layout: {'icon-image': 'a', 'icon-padding': 2, ...layout}})!;
    const point = {type: 'Point', coordinates: [lngOf(tx + 0.5), latOf(ty + 0.5)]};
    const labels = buildTile(sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: point} as any), z, tx, ty), z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, bearing, pitch);
    const boxes: number[][] = [];
    const grid = new CollisionGrid(), insert = grid.insert.bind(grid);
    grid.insert = (...b: [number, number, number, number]) => { boxes.push(b); return insert(...b); };
    const placed = (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid,
        () => ({x: 0, y: 0, width: 20, height: 10, pixelRatio: 1}));
    assert.ok(placed.length === 1 && placed[0].icon && boxes.length === (layout['text-field'] ? 2 : 1), 'the label is placed with its boxes');
    return boxes;
}
/** The box that the icon puts in the grid (after the box of the text). */
const iconBox = (layout: Record<string, unknown>, bearing: number, pitch: number) => boxesAt(layout, bearing, pitch).at(-1)!;
const size = (b: number[]) => [b[2] - b[0], b[3] - b[1]];

test('the box of an icon that faces the screen lies on the ground when text-pitch-alignment is map (#2202)', () => {
    // At pitch 60 the box of 24 by 14 pixels on the ground is about half as tall on the screen.
    const b = size(iconBox({'icon-rotation-alignment': 'viewport', 'text-pitch-alignment': 'map'}, 0, 60));
    assert.ok(b[1] < 10 && Math.abs(b[0] - 24) < 1, `${b}`);
});

test('the box of an icon on the ground faces the screen when text-pitch-alignment is viewport (#2202)', () => {
    // (The anchor is at the center of the map, where the perspective ratio is 1: the box is 24 by 14 pixels.)
    const b = size(iconBox({'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map'}, 30, 50));
    assert.ok(b.every((v, i) => Math.abs(v - [24, 14][i]) < 1e-6), `${b}`);
});

test('the box on the ground of an icon that turns with the map stays upright when text-rotation-alignment is viewport (#2202)', () => {
    // MapLibre GL JS turns the box on the ground so that it is upright on the screen (`getTileSkewVectors`): at the
    // center of the map, the bearing does not change it.
    const layout = {'icon-rotation-alignment': 'map', 'icon-pitch-alignment': 'map', 'text-rotation-alignment': 'viewport', 'text-pitch-alignment': 'map'};
    const turned = size(iconBox(layout, 30, 50)), north = size(iconBox(layout, 0, 50));
    assert.ok(turned.every((v, i) => Math.abs(v - north[i]) < 0.01) && north[1] < 12, `${turned} at bearing 30, ${north} at 0`);
});

// #2505: as in MapLibre GL JS (`placeIconFeature` with the `pitchWithMap` and `rotateWithMap` of the text), an icon that
// `icon-text-fit` stretches around text on the ground has its box on the ground: it turns with the map, and
// `icon-text-fit-padding` is taken on the ground.
const fitted = {'text-field': 'ABCD', 'icon-text-fit': 'both', 'icon-padding': 0, 'text-padding': 0, 'text-pitch-alignment': 'map', 'text-rotation-alignment': 'map'};
test('the box of an icon fitted to text on the ground turns with the map (#2505)', () => {
    // (Without padding the icon covers the text: its box is the box of the text.)
    for (const layout of [fitted, {...fitted, 'text-offset': [1, 2]}]) {
        const [text, icon] = boxesAt(layout, 30, 60);
        assert.ok(icon.every((v, i) => Math.abs(v - text[i]) < 0.01), `the icon ${icon}, the text ${text}`);
    }
});

test('the padding of an icon fitted to text on the ground is taken on the ground (#2505)', () => {
    // At pitch 60 the padding of 4 pixels on the ground adds about 4 pixels and not 8 to the height on the screen.
    const [a, b] = [0, 4].map(p => size(iconBox({...fitted, 'icon-text-fit-padding': [p, p, p, p]}, 0, 60)));
    assert.ok(Math.abs(b[0] - a[0] - 8) < 0.01 && b[1] - a[1] > 3 && b[1] - a[1] < 5, `${a} without padding, ${b} with`);
});
