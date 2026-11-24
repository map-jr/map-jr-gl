// `symbol-avoid-edges`: a symbol whose box reaches past the edge of its tile is not placed (#1692).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';
import {CollisionGrid, placeLabels, renderItems} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

const z = 10, tx = 300, ty = 380, n = 2 ** z;
const lngAt = (x: number) => (tx + x) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
const id = {z, x: tx, y: ty, w: 0, key: `${z}/${tx}/${ty}`};
/** The number of symbols placed for a point at `x` (a fraction of the tile across) with the layout `layout`. */
const placed = (x: number, layout: Record<string, unknown>, bearing = 0) => {
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lngAt(x), lat]}}), z, tx, ty);
    const layer = compileLayer({id: 'p', type: 'symbol', source: 'g', layout})!;
    const labels = buildTile(data, z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lngAt(0.5), lat], z, bearing, 0);
    const icon = {x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any;
    return placeLabels(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid(), () => icon).length;
};

test('symbol-avoid-edges: text that reaches past the edge of its tile is not placed, and text inside is', () => {
    const text = {'text-field': 'A long name'};
    // The point is 4 pixels inside the west edge of the tile (512 pixels across): the text reaches past it.
    assert.equal(placed(4 / 512, text), 1);
    assert.equal(placed(4 / 512, {...text, 'symbol-avoid-edges': true}), 0);
    assert.equal(placed(0.5, {...text, 'symbol-avoid-edges': true}), 1);
    assert.equal(placed(0.5, {...text, 'symbol-avoid-edges': true}, 45), 1);
});

test('symbol-avoid-edges: an icon that reaches past the edge of its tile is not placed', () => {
    const icon = {'icon-image': 'pin'};
    assert.equal(placed(4 / 512, icon), 1);
    assert.equal(placed(4 / 512, {...icon, 'symbol-avoid-edges': true}), 0);
    assert.equal(placed(0.5, {...icon, 'symbol-avoid-edges': true}), 1);
});
