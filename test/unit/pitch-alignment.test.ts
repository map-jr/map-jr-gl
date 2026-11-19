// `text-pitch-alignment` and `icon-pitch-alignment` (#1005): on a tilted map a symbol with `map` lies on the ground,
// one with `viewport` faces the screen, and `auto` follows the rotation alignment, as in MapLibre GL JS.
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
const line = {type: 'LineString', coordinates: [[lngOf(tx + 0.1), latOf(ty + 0.5)], [lngOf(tx + 0.9), latOf(ty + 0.5)]]};

/** The first label of one feature, placed on a map with the pitch. `icon`: the layer has an icon of 20 pixels. */
function place(layout: Record<string, unknown>, geometry: unknown, pitch: number, icon = false): any {
    const layer = compileLayer({id: 'r', type: 'symbol', source: 'g', layout: {'text-field': 'Main Street', 'text-size': 16, ...layout}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry} as any), z, tx, ty);
    const labels = buildTile(data, z, [layer], true).labels;
    const tr = new Transform();
    tr.width = 800; tr.height = 600; tr.maxPitch = 90;
    tr.set([lngOf(tx + 0.5), latOf(ty + 0.5)], z, 0, pitch);
    const icons = icon ? () => ({x: 0, y: 0, width: 20, height: 20, pixelRatio: 1} as any) : undefined;
    return (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid(), icons)[0];
}

test('text at a point with text-pitch-alignment map lies on the ground of a tilted map', () => {
    const p = place({'text-pitch-alignment': 'map'}, point, 60);
    assert.ok(p?.frame, 'the label has a frame on the ground');
    // Down the text, the pitch foreshortens it (cos 60° = 0.5); along it, it does not.
    const across = Math.hypot(p.frame[0], p.frame[1]), down = Math.hypot(p.frame[2], p.frame[3]);
    assert.ok(Math.abs(down / across - 0.5) < 0.05, `down / across is ${down / across}`);
});
test('text at a point with text-pitch-alignment viewport faces the screen, and auto follows the rotation alignment', () => {
    assert.equal(place({}, point, 60).frame, undefined);
    assert.equal(place({'text-pitch-alignment': 'viewport', 'text-rotation-alignment': 'map'}, point, 60).frame, undefined);
    assert.ok(place({'text-rotation-alignment': 'map'}, point, 60).frame);
});
test('text along a line with text-pitch-alignment viewport does not lie on the ground', () => {
    assert.ok(place({'symbol-placement': 'line'}, line, 60).ground, 'auto lies on the ground along a line');
    assert.equal(place({'symbol-placement': 'line', 'text-pitch-alignment': 'viewport'}, line, 60).ground, undefined);
});
test('an icon with icon-pitch-alignment map lies on the ground of a tilted map', () => {
    assert.ok(place({'text-field': '', 'icon-image': 'a', 'icon-pitch-alignment': 'map'}, point, 60, true)?.icon?.frame, 'the icon has a frame on the ground');
    assert.equal(place({'text-field': '', 'icon-image': 'a'}, point, 60, true)?.icon?.frame, undefined);
});
test('an image inside text with text-pitch-alignment map uses the frame of its label (#1064)', async () => {
    const {GLRenderer} = await import('../../src/gl.ts');
    const p = place({'text-pitch-alignment': 'map'}, point, 60);
    // One line with one square image as wide as the em.
    const label = {...p, opacity: 1, curve: undefined, justify: 0, shaped: {width: 24, height: 24, lineHeight: 24, lines: [{width: 24, glyphs: [{image: 'a', advance: 24, imageHeight: 24}]}]}};
    const quads: Float32Array = (GLRenderer.prototype as any).iconQuads.call({iconData: new Float32Array(0), dpr: 1}, [label], false, () => ({x: 0, y: 0, width: 20, height: 20}));
    assert.equal(quads.length, 54, 'one quad');
    // Corners (0, 0), (1, 0) and (0, 1) of the image: down it, the pitch foreshortens it as it does the glyphs.
    const across = Math.hypot(quads[9] - quads[0], quads[10] - quads[1]), down = Math.hypot(quads[18] - quads[0], quads[19] - quads[1]);
    assert.ok(Math.abs(down / across - 0.5) < 0.05, `down / across is ${down / across}`);
});
