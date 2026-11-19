// On a pitched map, a frame between placements does not draw a label whose anchor a forward pan has taken behind the
// camera: its anchor projects to the top of the screen there, and the label was drawn in the sky, large (#924).
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

const camera = (cy: number) => {
    const tr = new Transform();
    tr.width = 800; tr.height = 600; tr.maxPitch = 90;
    tr.set([lngOf(tx + 0.5), latOf(cy)], 16, 0, 85);
    return tr;
};

test('a frame does not draw a label whose anchor a forward pan took behind the camera', () => {
    const tooFar = (placement as any).tooFar;
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': 'Broadway', 'symbol-placement': 'line', 'text-allow-overlap': true}})!;
    const geometry = {type: 'LineString', coordinates: [[lngOf(tx + 0.3), latOf(ty + 0.5)], [lngOf(tx + 0.7), latOf(ty + 0.5)]]};
    const labels = buildTile(sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry} as any), z, tx, ty), z, [layer], false).labels;
    // The label is placed near the bottom of the screen, a little ahead of the camera.
    const a = camera(ty + 0.18);
    const [p] = placeLabels(a, renderItems(a, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid());
    assert.ok(p && p.ay > a.cy, `the label is placed below the centre (${p?.ay})`);
    // The pan forward takes the camera past the anchor before the next placement.
    const b = camera(ty), [, ay, depth] = b.projectTile(id, p.src.x, p.src.y);
    assert.ok(depth <= 0, `the anchor is behind the camera (depth ${depth}, y ${ay})`);
    assert.equal(typeof tooFar, 'function', 'there is no check of the anchor between placements');
    assert.ok(tooFar(b, depth, b.depthRange()[1]), 'the label is drawn');
    assert.ok(!tooFar(a, p.depth, a.depthRange()[1]), 'the label is hidden where it was placed');
});
