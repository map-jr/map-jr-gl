// `text-keep-upright` and `icon-keep-upright` (#1006): with `false`, a label along a line follows the direction of the
// line, as in MapLibre GL JS, also where that direction reads upside down.
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
// A line that runs from east to west, so that text along it in its own direction reads upside down.
const line = {type: 'LineString', coordinates: [[lngOf(tx + 0.9), latOf(ty + 0.5)], [lngOf(tx + 0.1), latOf(ty + 0.5)]]};

/** The first label of the line, placed on a map with no pitch. `icon`: the layer has an icon of 20 pixels. */
function place(layout: Record<string, unknown>, geometry: unknown = line, pitch = 0, icon = false, grid = new CollisionGrid()): any {
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': 'Main Street', 'text-size': 16, ...layout}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry} as any), z, tx, ty);
    const labels = buildTile(data, z, [layer], false).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600; tr.maxPitch = 90;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, 0, pitch);
    const icons = icon ? () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any) : undefined;
    return (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), grid, icons)[0];
}

test('text along a line turns over to stay upright by default, and follows the line with text-keep-upright false', () => {
    const up = place({'symbol-placement': 'line'}).curve, along = place({'symbol-placement': 'line', 'text-keep-upright': false}).curve;
    // The curve has x, y and the angle of each glyph. The line runs to the west (an angle of pi on the screen).
    assert.ok(up[0] < up[up.length - 3] && Math.abs(up[2]) < 1e-6, 'upright text reads from west to east');
    assert.ok(along[0] > along[along.length - 3] && Math.abs(Math.abs(along[2]) - Math.PI) < 1e-6, 'the text reads from east to west');
});
test('a line of text that does not bend follows text-keep-upright too', () => {
    const angle = (keep: boolean) => place({'symbol-placement': 'line', 'text-field': 'Main\nStreet', 'text-keep-upright': keep}).angle;
    assert.ok(Math.abs(angle(true)) < 1e-6, `upright: ${angle(true)}`);
    assert.ok(Math.abs(Math.abs(angle(false)) - Math.PI) < 1e-6, `along: ${angle(false)}`);
});
test('an icon along a line (beside its text) follows the line, and turns over with icon-keep-upright true', () => {
    const angle = (keep?: boolean) => place({'symbol-placement': 'line', 'icon-image': 'a', 'icon-allow-overlap': true, ...(keep === undefined ? {} : {'icon-keep-upright': keep})}, line, 0, true)?.icon?.angle;
    assert.ok(Math.abs(Math.cos(angle()) + 1) < 1e-6, `default: ${angle()}`);
    assert.ok(Math.abs(Math.cos(angle(true)) - 1) < 1e-6, `upright: ${angle(true)}`);
});
test('an icon along a line is not dropped because of its own bent text (#1072)', () => {
    const placed = place({'symbol-placement': 'line', 'icon-image': 'a'}, line, 0, true);
    assert.ok(placed?.curve, 'the text follows the line');
    assert.ok(placed.icon, 'the icon is placed with its text');
});
test('text along a line is not drawn when its required icon is not placed (#1080)', () => {
    // A box over the whole screen blocks the icon. The text may overlap it.
    const blocked = () => { const g = new CollisionGrid(); g.insert(-1e4, -1e4, 1e4, 1e4); return g; };
    const layout = {'symbol-placement': 'line', 'icon-image': 'a', 'text-allow-overlap': true};
    assert.equal(place(layout, line, 0, true, blocked()), undefined, 'icon-optional false: neither is drawn');
    const optional = place({...layout, 'icon-optional': true}, line, 0, true, blocked());
    assert.ok(optional?.curve && !optional.icon, 'icon-optional true: the text is drawn alone');
});

test('anchors along a line start at an offset and repeat every symbol-spacing, as in MapLibre GL JS (#1016)', async () => {
    const {lineLabels} = await import('../../src/placement.ts');
    /** The x of each anchor, in tile units from the start of a line that runs east inside the tile from `x0` to `x1` (in tiles). */
    const anchorsX = (spacing: number, x0: number, x1: number) => {
        const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': 'Main Street', 'text-size': 16, 'symbol-placement': 'line', 'symbol-spacing': spacing}})!;
        const geometry = {type: 'LineString', coordinates: [[lngOf(tx + x0), latOf(ty + 0.5)], [lngOf(tx + x1), latOf(ty + 0.5)]]};
        const labels = buildTile(sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry} as any), z, tx, ty), z, [layer], false).labels.r;
        return lineLabels(labels, new EstimateShaper()).map(l => Math.round(l.x - x0 * 4096));
    };
    // The text is 124 pixels at 24 pixels an em, so the label is 662 tile units long at a text-size of 16 (8 tile units a
    // pixel). The first anchor is half of that and two ems in (587), and the next ones follow every symbol-spacing while
    // the whole label fits on the line (3686 tile units).
    assert.deepEqual(anchorsX(250, 0.05, 0.95), [587, 2587]);
    // A spacing (800) that leaves less than a quarter of itself free beside the label becomes the label and a quarter: 862.
    assert.deepEqual(anchorsX(100, 0.05, 0.95), [587, 1449, 2311, 3172]);
    // A line shorter than its label has no anchor.
    assert.deepEqual(anchorsX(250, 0.4, 0.5), []);
});
