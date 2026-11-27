// Labels along a line on the globe (#1823): the text lies on the sphere, as in MapLibre GL JS, and has the size of
// `text-size` on the sphere at its anchor (MapLibre's `getPitchedTextCorrection`).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Transform} from '../../src/geo.ts';
import * as globe from '../../src/globe.ts';
import {compileLayer} from '../../src/style.ts';
import {buildTile} from '../../src/tile.ts';
import {prepareGeoJSON, sliceGeoJSON} from '../../src/geojson.ts';
import {CollisionGrid, placeLabels, renderItems} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

const id = {z: 0, x: 0, y: 0, w: 0, key: '0/0/0'};

/**
 * The label of a line (by default along the equator from 45° W to 45° E), on a view of 256 pixels at zoom 0 that looks
 * at 45° N (by default).
 */
function place(onGlobe: boolean, coordinates = [[-45, 0], [45, 0]], center = [0, 45], zoom = 0, size = 256, pitch = 0, all = false, extra = {}): any {
    const layer = compileLayer({id: 't', type: 'symbol', source: 'g', layout: {'symbol-placement': 'line', 'text-field': 'AAAAAAAAAAA', 'text-size': 16, ...extra}})!;
    const data = sliceGeoJSON(prepareGeoJSON({type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates}} as any), 0, 0, 0);
    const labels = buildTile(data, 0, [layer], false).labels;
    const tr = new Transform();
    tr.width = size; tr.height = size;
    if (onGlobe) { tr.globe = globe; tr.globeStops = [0, 1]; }
    tr.set(center as [number, number], zoom, 0, pitch);
    const out = (placeLabels as any)(tr, renderItems(tr, [id], () => ({labels})), [layer], new EstimateShaper(), new CollisionGrid());
    return all ? out : out[0];
}

test('a label along a line is drawn on the globe, along the curve of the sphere', () => {
    const flat = place(false), round = place(true);
    assert.ok(flat?.curve, 'Mercator: the text follows the line');
    assert.ok(round?.curve, 'globe: the text follows the line');
    // The equator is a curve on the screen that bends down: the middle glyph is lower than the first and the last.
    const c = round.curve, ys = c.filter((_: number, i: number) => i % 3 === 1), mid = ys[ys.length >> 1];
    assert.ok(mid > ys[0] + 1 && mid > ys[ys.length - 1] + 1, `the text bends with the equator: ${ys.map((y: number) => y.toFixed(1))}`);
    // On the sphere the text has its size at the anchor: at the equator, seen from 45° N, the sphere is larger than
    // Mercator by 1 / cos 45°, and the text is not.
    const span = (p: any) => Math.hypot(p.curve[p.curve.length - 3] - p.curve[0], p.curve[p.curve.length - 2] - p.curve[1]);
    assert.ok(span(round) < span(flat), `globe ${span(round).toFixed(1)} px, Mercator ${span(flat).toFixed(1)} px`);
});

test('a label along a meridian on the globe keeps one size, also when it spans many degrees of latitude', () => {
    // The meridian at 10° E from 40° N to 80° N, seen from above 60° N at zoom 1.6. The text spans about 25 degrees of
    // latitude, where a step in the tile is about twice as long on the sphere at the south end as at the north end.
    const p = place(true, Array.from({length: 41}, (_, i) => [10, 40 + i]), [10, 60], 1.6, 800);
    assert.ok(p?.ground, 'the text lies on the sphere');
    // `ground` has, for each glyph, the length on the screen of one pixel of text along the line, and then the step across it.
    const along = p.ground.filter((_: number, i: number) => i % 3 === 0), ratio = Math.max(...along) / Math.min(...along);
    assert.ok(ratio < 1.15, `the glyphs have one size, as in MapLibre GL JS: ${along.map((v: number) => v.toFixed(2))}`);
});

test('a label along a line on the globe is hidden when its glyphs are behind the horizon, as in MapLibre GL JS (#1996)', () => {
    // A meridian from 65° S to 30° N, with text on the screen, at zoom 2.5. Its label is at 20° S (the anchors are laid out
    // in squares of zoom 2, as MapLibre GL JS lays them out in tiles of zoom 2: #2078). Seen from the equator, the label
    // is drawn. Seen from 16° N, the anchor is in front of the horizon, the line under the glyphs is behind it, and the
    // label is hidden. (Text far from the center is smaller by the perspective ratio (#2201), so with the widths of
    // `EstimateShaper` the glyphs reach behind the horizon only from about 14° N. Without the test of the glyphs, the
    // label is drawn from 16° N.)
    const viewport = {'text-pitch-alignment': 'viewport'};
    const front = place(true, [[0, -65], [0, 30]], [0, 0], 2.5, 512, 0, true, viewport);
    assert.equal(front.length, 1, 'seen from the equator, the label is drawn');
    assert.deepEqual(place(true, [[0, -65], [0, 30]], [0, 16], 2.5, 512, 0, true, viewport), [], 'seen from 16° N, the label is hidden');
});

test('a label on the globe is drawn when only the far end of the line under it is behind the horizon, as in MapLibre GL JS (#1996)', () => {
    // A parallel at 15° N from 0° to 80° E, seen from (0, 0) at zoom 2, with text on the screen. Its label is at 40° E, in
    // front of the horizon, and the end at 80° E is behind it. MapLibre GL JS divides the line on the globe and tests only
    // the points next to the glyphs, so it draws the label. A label at 100° E is behind the horizon and is hidden.
    const viewport = {'text-pitch-alignment': 'viewport', 'symbol-placement': 'line-center', 'text-field': 'AAAA'};
    assert.equal(place(true, [[0, 15], [80, 15]], [0, 0], 2, 512, 0, true, viewport).length, 1, 'the label at 40° E is drawn');
    assert.deepEqual(place(true, [[60, 15], [140, 15]], [0, 0], 2, 512, 0, true, viewport), [], 'the label at 100° E is hidden');
});
