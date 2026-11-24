// Anchors along a line of an over-zoomed tile (#1094): MapLibre GL JS cuts a tile of the deepest level of the source into
// tiles of a deeper zoom (4 below the `maxZoom` of the map), and each of them places its anchors from its own edges.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lineLabels} from '../../src/placement.ts';
import {EstimateShaper} from '../../src/text.ts';

test('a line of a z14 tile shown at z22 has its anchors in the rhythm of the z18 squares, as in MapLibre GL JS', () => {
    const spacing = 350 * 4096 / 512 / 256;
    // A straight line across the tile, from its west edge. At z22 the tile is cut into 16 squares a side of 256 units.
    const label: any = {text: '', line: [0, 100, 4096, 100], lineSpacing: spacing, tpr: 4096 / 512 / 256, ov: 256, tz: 14, window: 0, maxAngle: 45, size0: 10, size1: 10};
    const xs = lineLabels([label], new EstimateShaper() as any, undefined, 22).map(l => l.x).filter(x => x >= 256 && x < 512);
    assert.ok(xs.length > 10, `anchors in the second square: ${xs.length}`);
    for (const x of xs) {
        const n = (x - 256) / spacing;
        assert.ok(Math.abs(n - Math.round(n)) < 1e-6, `the anchor at ${x} is not a whole number of spacings from the edge of the square`);
    }
});
