// `symbol-z-order` (#1011): symbols that may overlap are drawn from the top of the screen down, and `viewport-y` also
// places them from the bottom up, as in MapLibre GL JS. `source` keeps the order of the source.
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
// Three points close enough that their text collides: abc0 in the middle, abc1 at the top, abc2 at the bottom.
const points = [0.5, 0.47, 0.53].map((y, i) => ({type: 'Feature', properties: {name: 'abc' + i}, geometry: {type: 'Point', coordinates: [lngOf(tx + 0.5), latOf(ty + y)]}}));

/** The names of the placed labels, in the order in which they are drawn. */
function order(layout: Record<string, unknown>): string[] {
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': '{name}', 'text-size': 40, ...layout}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'FeatureCollection', features: points} as any), z, tx, ty);
    const labels = buildTile(data, z, [layer], true).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, 0, 0);
    return (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid()).map((p: any) => p.src.text);
}

test('symbols that may overlap are drawn from the top of the screen down with auto and viewport-y', () => {
    assert.deepEqual(order({'text-allow-overlap': true}), ['abc1', 'abc0', 'abc2']);
    assert.deepEqual(order({'text-allow-overlap': true, 'symbol-z-order': 'viewport-y'}), ['abc1', 'abc0', 'abc2']);
});
test('symbol-z-order source keeps the order of the source', () => {
    assert.deepEqual(order({'text-allow-overlap': true, 'symbol-z-order': 'source'}), ['abc0', 'abc1', 'abc2']);
});
test('viewport-y places the lowest symbol first, so it wins a collision; auto places in the order of the source', () => {
    assert.deepEqual(order({'symbol-z-order': 'viewport-y'}), ['abc2']);
    assert.deepEqual(order({}), ['abc0']);
});
