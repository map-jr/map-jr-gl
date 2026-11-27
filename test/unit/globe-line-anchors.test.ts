// Anchors along a line on the globe (#2078): the globe loads tiles of a lower level than MapLibre GL JS, and MapLibre GL JS
// places the anchors in the tiles of the level of the map, every `symbol-spacing` pixels of such a tile.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineLabels} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

test('a line of a z1 tile on the globe at zoom 3 has its anchors in the rhythm of z3 tiles, as in MapLibre GL JS', () => {
    // A straight line across a z1 tile, from its west edge, with `symbol-spacing` 60 (480 units of a tile of its own level).
    const label: any = {text: '', line: [0, 100, 4096, 100], lineSpacing: 60 * 8, tpr: 8, ov: 1, tz: 1, window: 0, maxAngle: 45, size0: 14, size1: 14};
    const xs = lineLabels([label], new EstimateShaper() as any, undefined, 22, undefined, 3).map(l => l.x);
    // At zoom 3 the tile is 4 z3 tiles a side (1024 units), and the spacing is 480 / 4 units. Each z3 tile places its
    // anchors from its own west edge, half a spacing in, as MapLibre GL JS does for a line that comes in over the edge.
    const want: number[] = [];
    for (let i = 0; i < 4; i++) for (let x = 60; x < 1024; x += 120) want.push(i * 1024 + x);
    assert.deepEqual(xs.sort((a, b) => a - b), want);
    // In Mercator (no level) the tile keeps the spacing of its own level.
    assert.equal(lineLabels([{...label}], new EstimateShaper() as any, undefined, 22).length, 9);
});
