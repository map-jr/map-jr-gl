// The placement of `text-variable-anchor` follows MapLibre GL JS (#1035): an anchor where nothing is in the way comes
// before an anchor that overlaps, the anchor of the previous placement is tried first, and an icon fitted to the text
// must fit at the anchor too.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';
import {CollisionGrid, placeLabels, renderItems} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

const z = 10, tx = 300, ty = 380, n = 2 ** z;
const lng = (tx + 0.5) / n * 360 - 180, lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (ty + 0.5) / n))) * 180 / Math.PI;
const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [lng, lat]}}), z, tx, ty);
const id = {z, x: tx, y: ty, w: 0, key: `${z}/${tx}/${ty}`};
const icon = {x: 0, y: 0, width: 10, height: 10, pixelRatio: 1} as any;

const place = (layout: Record<string, unknown>, grid = new CollisionGrid(), prev?: (key: string) => string | undefined) => {
    const layer = compileLayer({id: 'p', type: 'symbol', source: 'g', layout: {'text-field': 'Name', ...layout}})!;
    const labels = buildTile(data, z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600;
    tr.set([lng, lat], z, 0, 0);
    return placeLabels(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid, () => icon, undefined, prev)[0];
};
/** A grid with a box over the screen below the point (where text at the anchor `top` goes). */
const blockedBelow = () => { const g = new CollisionGrid(); g.insert(0, 312, 800, 600); return g; };

test('variable anchor: with text-allow-overlap, a free anchor comes before the first anchor that overlaps', () => {
    const p = place({'text-variable-anchor': ['top', 'bottom'], 'text-allow-overlap': true}, blockedBelow());
    assert.equal(p.anchor, 'bottom');
    assert.ok(p.y < p.ay);
});

test('variable anchor: when every anchor overlaps, text-allow-overlap places it at the first anchor', () => {
    const g = blockedBelow(); g.insert(0, 0, 800, 288);
    assert.equal(place({'text-variable-anchor': ['top', 'bottom'], 'text-allow-overlap': true}, g).anchor, 'top');
    assert.equal(place({'text-variable-anchor': ['top', 'bottom']}, g), undefined);
});

test('variable anchor: the anchor of the previous placement is tried first', () => {
    assert.equal(place({'text-variable-anchor': ['top', 'bottom']}).anchor, 'top');
    assert.equal(place({'text-variable-anchor': ['top', 'bottom']}, undefined, () => 'bottom').anchor, 'bottom');
});

test('variable anchor: with icon-text-fit, an anchor where the fitted icon overlaps is not taken', () => {
    // The icon is fitted with a padding of 30 pixels on the right of the text.
    const layout = {'text-variable-anchor': ['left', 'right'], 'icon-image': 'pin', 'icon-text-fit': 'both', 'icon-text-fit-padding': [0, 30, 0, 0]};
    const free = place(layout);
    assert.equal(free.anchor, 'left');
    // A box right of the text at the anchor left, which only its icon reaches.
    const right = free.x + free.shaped!.width * free.size / 24 / 2 + 10, g = new CollisionGrid();
    g.insert(right, 0, 800, 600);
    const p = place(layout, g);
    assert.equal(p.anchor, 'right');
    assert.ok(p.icon!.x - p.icon!.w / 2 < p.x && p.x < p.ax);
});
