// The collision box of a symbol on a map with a bearing (#2037). As in MapLibre GL JS 6.17, `text-rotation-alignment`
// decides whether every box of the symbol, the icon's too, is turned by the bearing: the box at the rotation of the
// symbol is taken first, and that box is turned by the bearing.
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
const point = {type: 'Point', coordinates: [lngOf(tx + 0.5), latOf(ty + 0.5)]};

/** The width and height of the box that an icon of 20 by 10 pixels, padding 2 and `icon-rotate` 45 puts in the grid, at bearing 45. */
function iconBox(text: string, icon: string): [number, number] {
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'icon-image': 'a', 'icon-rotate': 45, 'icon-padding': 2,
        'text-rotation-alignment': text, 'icon-rotation-alignment': icon}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: point} as any), z, tx, ty);
    const labels = buildTile(data, z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, 45, 0);
    const boxes: number[][] = [];
    const grid = new CollisionGrid(), insert = grid.insert.bind(grid);
    grid.insert = (...b: [number, number, number, number]) => { boxes.push(b); return insert(...b); };
    const placed = (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid,
        () => ({x: 0, y: 0, width: 20, height: 10, pixelRatio: 1}))[0];
    assert.ok(placed?.icon && boxes.length === 1, 'the icon is placed with one box');
    return [boxes[0][2] - boxes[0][0], boxes[0][3] - boxes[0][1]];
}
const near = (a: number[], b: number[]) => assert.ok(a.every((v, i) => Math.abs(v - b[i]) < 1e-6), `${a} is not ${b}`);

test('an icon with text-rotation-alignment map is boxed at its rotation, then turned by the bearing (#2037)', () => {
    near(iconBox('map', 'map'), [38, 38]);
    // (MapLibre GL JS turns the box by the bearing also when the icon itself faces the viewport.)
    near(iconBox('map', 'viewport'), [38, 38]);
});

test('an icon with text-rotation-alignment viewport gets the box at its rotation only, as in MapLibre GL JS (#2037)', () => {
    const side = 38 * Math.SQRT1_2;
    near(iconBox('viewport', 'map'), [side, side]);
    near(iconBox('viewport', 'viewport'), [side, side]);
});
