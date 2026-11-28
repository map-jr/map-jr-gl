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

test('a line label near a pole of the globe keeps the line that its text takes on the sphere (#2508)', () => {
    // A meridian in a z2 tile of the first row, from its south edge to 85° N (y 27). `window` is the one of tile.ts for
    // "Meridian 0" at `text-size` 14: the path of the text at 8 tile units a pixel. At 82.5° N a tile unit is shorter on
    // the sphere by cos 82.5°, so on the globe the text needs about 7 times that line, and the path of the anchor there
    // goes to the end of the line, as the line of MapLibre GL JS does. Before, it stopped at 670 units, and the text did
    // not fit (`followLine`).
    const label: any = {text: 'Meridian 0', line: [2048, 4096, 2048, 27], lineSpacing: 250 * 8, tpr: 8, ov: 1, tz: 2, window: 670.4, maxAngle: 45, size0: 14, size1: 14};
    const north = (out: any[]) => {
        const a = out.reduce((p, l) => l.y < p.y ? l : p);
        return {y: a.y, length: a.y - Math.min(...a.path.filter((_: number, i: number) => i % 2))};
    };
    assert.deepEqual(north(lineLabels([{...label}], new EstimateShaper() as any, undefined, 22, undefined, 2, 0)), {y: 1096, length: 1069});
    // In Mercator (no row) a tile unit has the same length everywhere, and the path keeps the length of the text.
    assert.deepEqual(north(lineLabels([{...label}], new EstimateShaper() as any, undefined, 22)), {y: 1096, length: 670});
});
