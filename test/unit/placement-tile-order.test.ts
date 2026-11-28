// The order in which the labels of the tiles are placed (#2511). MapLibre GL JS places the tiles of a source from the
// deepest level, then by world copy, x and y (`_updatePlacement`), so where the labels of two tiles collide, the label of
// the tile with the smaller x wins. The tiles of the view come nearest to the center first: on a tilted map the label of
// the nearer tile won, and the compat entry drew a far label at the edge of the screen that MapLibre GL JS hides.
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

test('labels of two tiles that collide: the tile with the smaller x wins, as in MapLibre GL JS (#2511)', () => {
    // Two points 10 pixels apart on both sides of the edge between two tiles, with text that is wider than that.
    const features = [tx + 0.99, tx + 1.01].map((x, i) => ({type: 'Feature', properties: {name: `Main Street ${i}`}, geometry: {type: 'Point', coordinates: [lngOf(x), latOf(ty + 0.5)]}}));
    const layer = compileLayer({id: 'p', type: 'symbol', source: 'g', layout: {'text-field': ['get', 'name'], 'text-size': 16}})!;
    const data = prepareGeoJSON({type: 'FeatureCollection', features} as any);
    const ids = [tx, tx + 1].map(x => ({z, x, y: ty, w: 0, key: `${z}/${x}/${ty}`}));
    const tiles = new Map(ids.map(id => [id.key, {labels: buildTile(sliceGeoJSON(data, z, id.x, ty), z, [layer], false).labels}]));
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lngOf(tx + 1), latOf(ty + 0.5)], z, 0, 0);
    // Both orders of the tiles of the view give the same label.
    for (const order of [ids, [...ids].reverse()]) {
        const placed = (placeLabels as any)(tr, renderItems(tr, order, k => tiles.get(k)), [layer], new EstimateShaper(), new CollisionGrid());
        assert.deepEqual(placed.map((p: any) => [p.src.text, p.tile.x]), [['Main Street 0', tx]], `tiles in the order ${order.map(id => id.x)}`);
    }
});
